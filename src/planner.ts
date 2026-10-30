import type {
  AppData,
  Course,
  CourseChange,
  Priority,
  Schedule,
  Task,
  TaskPlanningScene,
} from "./types";
import { dateAt, todayKey } from "./date";
import {
  courseMinutes,
  minutesToTime,
  occurrencesForDate,
  timeToMinutes,
  type CourseOccurrence,
} from "./course";

export type EnergyLevel = "high" | "steady" | "low";

export interface PlanningSuggestion {
  id: string;
  taskId: string;
  taskTitle: string;
  date: string;
  start: string;
  end: string;
  minutes: number;
  reason: string;
  source: "free" | "course-manual" | "course-auto";
  precision: "exact" | "suggested";
}

export interface UnscheduledTask {
  taskId: string;
  taskTitle: string;
  minutes: number;
  reason: string;
}

export interface PlanningResult {
  suggestions: PlanningSuggestion[];
  unscheduled: UnscheduledTask[];
  busyMinutes: number;
  freeMinutes: number;
}

interface Interval {
  start: number;
  end: number;
}

interface PlanningWindow {
  interval: Interval;
  source: PlanningSuggestion["source"];
  precision: PlanningSuggestion["precision"];
  reason: string;
  courseKey?: string;
  courseOccurrenceId?: string;
}

interface CourseUsage {
  used: number;
  autoUsed: number;
  manualQuota: number;
  capacity: number;
}

const priorityRank: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const focusRank = { light: 0, normal: 1, deep: 2 } as const;

const mergeIntervals = (intervals: Interval[]) => {
  const sorted = intervals
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start);
  return sorted.reduce<Interval[]>((result, item) => {
    const previous = result[result.length - 1];
    if (!previous || item.start > previous.end) {
      result.push({ ...item });
    } else {
      previous.end = Math.max(previous.end, item.end);
    }
    return result;
  }, []);
};

const subtractIntervals = (range: Interval, blocked: Interval[]) => {
  const result: Interval[] = [];
  let cursor = range.start;
  for (const item of mergeIntervals(blocked)) {
    if (item.end <= cursor) continue;
    if (item.start >= range.end) break;
    if (item.start > cursor) {
      result.push({ start: cursor, end: Math.min(item.start, range.end) });
    }
    cursor = Math.max(cursor, item.end);
  }
  if (cursor < range.end) result.push({ start: cursor, end: range.end });
  return result;
};

const scheduleInterval = (schedule: Schedule): Interval => ({
  start: timeToMinutes(schedule.start),
  end: timeToMinutes(schedule.end),
});

const courseInterval = (course: CourseOccurrence): Interval => ({
  start: timeToMinutes(course.startTime),
  end: timeToMinutes(course.endTime),
});

const intervalMinutes = (interval: Interval) => interval.end - interval.start;

const historicalRatio = (data: AppData, task: Task) => {
  const sessions = data.focusSessions.filter(
    (session) =>
      session.taskId === task.id &&
      session.status === "ended" &&
      session.endedAt,
  );
  if (!sessions.length) return 1;
  const actual = sessions.reduce(
    (sum, session) =>
      sum +
      Math.max(
        0,
        (new Date(session.endedAt!).getTime() -
          new Date(session.startedAt).getTime() -
          session.totalPausedMs) /
          60000,
      ),
    0,
  );
  return Math.min(1.8, Math.max(0.6, actual / Math.max(1, task.estimate)));
};

const taskRemainingMinutes = (data: AppData, task: Task) => {
  const futureMinutes = data.schedules
    .filter(
      (schedule) =>
        schedule.taskId === task.id && schedule.date >= todayKey(),
    )
    .reduce(
      (sum, schedule) =>
        sum + courseMinutes(schedule.start, schedule.end),
      0,
    );
  return Math.max(
    0,
    Math.ceil(task.estimate * historicalRatio(data, task) - futureMinutes),
  );
};

const taskHasIncompletePrerequisite = (data: AppData, task: Task) => {
  if (!task.prerequisiteTaskId) return false;
  const prerequisite = data.tasks.find(
    (item) => item.id === task.prerequisiteTaskId,
  );
  return !prerequisite || prerequisite.status !== "done";
};

const sceneForGap = (minutes: number): TaskPlanningScene =>
  minutes <= 30 ? "short-gap" : "full-gap";

const segmentDuration = (
  remaining: number,
  intervalLength: number,
  minimum: number,
  allowSplit: boolean,
) => {
  if (!allowSplit) {
    return remaining <= intervalLength ? remaining : undefined;
  }
  if (intervalLength < minimum) return undefined;
  if (remaining <= intervalLength) return remaining;
  const naturalSegment = Math.min(remaining, intervalLength);
  const leftover = remaining - naturalSegment;
  if (leftover > 0 && leftover < minimum) {
    const adjusted = remaining - minimum;
    return adjusted >= minimum && adjusted <= intervalLength
      ? adjusted
      : undefined;
  }
  return naturalSegment;
};

const findBestWindow = (
  windows: PlanningWindow[],
  duration: number,
) => {
  let best: PlanningWindow | undefined;
  for (const window of windows) {
    if (intervalMinutes(window.interval) < duration) continue;
    if (
      !best ||
      intervalMinutes(window.interval) < intervalMinutes(best.interval)
    ) {
      best = window;
    }
  }
  return best;
};

const normalizeTaskPlanning = (task: Task): Task => ({
  ...task,
  minDuration: task.minDuration || 5,
  allowSplit: task.allowSplit ?? false,
  focusRequirement: task.focusRequirement || "normal",
  planningScenes:
    task.planningScenes?.length
      ? task.planningScenes
      : ["course" as const, "short-gap" as const, "full-gap" as const],
});

const waterWindowsForOccurrence = (
  occurrence: CourseOccurrence,
  course: Course | undefined,
  task: Task,
) => {
  if (
    !course ||
    occurrence.kind === "activity" ||
    occurrence.focusLevel === "must" ||
    course.availableMinutes <= 0 ||
    !task.planningScenes.includes("course") ||
    !course.allowedTaskFocus.includes(task.focusRequirement) ||
    (task.focusRequirement === "deep" && !course.allowedTaskFocus.includes("deep"))
  ) {
    return [];
  }

  const windows: PlanningWindow[] = [];
  const courseKey = `${occurrence.date}:${occurrence.courseId}`;
  const manualWindows =
    course.arrangementMode === "manual" ||
    course.arrangementMode === "hybrid"
      ? course.availableWindows
      : [];
  const validManualIntervals: Interval[] = [];
  for (const window of manualWindows) {
    if (
      window.startTime < occurrence.startTime ||
      window.endTime > occurrence.endTime ||
      window.endTime <= window.startTime
    ) {
      continue;
    }
    const interval = {
      start: timeToMinutes(window.startTime),
      end: timeToMinutes(window.endTime),
    };
    validManualIntervals.push(interval);
    windows.push({
      interval,
      source: "course-manual",
      precision: "exact",
      reason: `“${occurrence.title}”中由你明确指定的可利用时段。`,
      courseKey,
      courseOccurrenceId: occurrence.id,
    });
  }

  if (
    course.arrangementMode === "auto" ||
    course.arrangementMode === "hybrid"
  ) {
    const buffer = course.avoidStartEnd ? 10 : 0;
    const autoStart = timeToMinutes(occurrence.startTime) + buffer;
    const autoEnd = timeToMinutes(occurrence.endTime) - buffer;
    if (autoEnd > autoStart) {
      for (const interval of subtractIntervals(
        { start: autoStart, end: autoEnd },
        validManualIntervals,
      )) {
        windows.push({
          interval,
          source: "course-auto",
          precision: "suggested",
          reason: `系统根据“${occurrence.title}”的 ${course.availableMinutes} 分钟额度生成的课程内候选；不代表课堂已确认真实空闲。`,
          courseKey,
          courseOccurrenceId: occurrence.id,
        });
      }
    }
  }
  return windows;
};

const buildCourseUsage = (
  occurrences: CourseOccurrence[],
  courses: Course[],
  state: Map<string, CourseUsage>,
) => {
  for (const occurrence of occurrences) {
    const course = courses.find((item) => item.id === occurrence.courseId);
    if (!course || course.availableMinutes <= 0) continue;
    const courseKey = `${occurrence.date}:${occurrence.courseId}`;
    if (state.has(courseKey)) continue;
    const manualQuota =
      course.arrangementMode === "auto"
        ? 0
        : Math.min(
            course.availableMinutes,
            course.availableWindows
              .filter(
                (window) =>
                  window.startTime >= occurrence.startTime &&
                  window.endTime <= occurrence.endTime,
              )
              .reduce(
              (sum, window) =>
                sum +
                Math.max(
                  0,
                  timeToMinutes(window.endTime) -
                    timeToMinutes(window.startTime),
                ),
              0,
              ),
          );
    state.set(courseKey, {
      used: 0,
      autoUsed: 0,
      manualQuota,
      capacity: Math.min(
        course.availableMinutes,
        courseMinutes(occurrence.startTime, occurrence.endTime),
      ),
    });
  }
};

export const buildPlanningSuggestions = (
  data: AppData,
  energy: EnergyLevel,
): PlanningResult => {
  const suggestions: PlanningSuggestion[] = [];
  const unscheduled: UnscheduledTask[] = [];
  const occupiedByDate = new Map<string, Interval[]>();
  const courseUsage = new Map<string, CourseUsage>();
  const energyBudget =
    energy === "low" ? 180 : energy === "steady" ? 360 : 540;
  let plannedMinutes = 0;

  const tasks = data.tasks
    .map(normalizeTaskPlanning)
    .filter((task) => !["done", "abandoned"].includes(task.status))
    .map((task) => ({
      task,
      remaining: taskRemainingMinutes(data, task),
    }))
    .filter((entry) => entry.remaining > 0)
    .sort((a, b) => {
      const deadlineA = a.task.deadline || "9999-12-31";
      const deadlineB = b.task.deadline || "9999-12-31";
      if (deadlineA !== deadlineB) return deadlineA.localeCompare(deadlineB);
      const priorityDifference =
        priorityRank[a.task.priority] - priorityRank[b.task.priority];
      if (priorityDifference) return priorityDifference;
      return focusRank[a.task.focusRequirement] - focusRank[b.task.focusRequirement];
    });

  for (const { task, remaining } of tasks) {
    if (taskHasIncompletePrerequisite(data, task)) {
      unscheduled.push({
        taskId: task.id,
        taskTitle: task.title,
        minutes: remaining,
        reason: "前置任务尚未完成，暂不能安排。",
      });
      continue;
    }

    let remainingToPlace = remaining;
    const deadline = task.deadline || dateAt(7);
    const dayLimit = Math.min(
      7,
      Math.max(
        1,
        Math.ceil(
          (new Date(`${deadline}T12:00:00`).getTime() - Date.now()) /
            (24 * 60 * 60 * 1000),
        ),
      ),
    );
    const latestDate = deadline < todayKey() ? dateAt(7) : deadline;
    let sawSceneMismatch = false;
    let sawTooShort = false;
    let sawWaterQuotaExhausted = false;
    let sawCourseEligibilityMismatch = false;
    let sawEnergyLimit = false;
    let sawAnyWindow = false;

    for (
      let offset = 0;
      offset <= dayLimit && remainingToPlace > 0;
      offset += 1
    ) {
      const date = dateAt(offset);
      if (date > latestDate) break;
      const occurrences = occurrencesForDate(
        date,
        data.courses,
        data.courseChanges as CourseChange[],
        data.settings,
      );
      buildCourseUsage(occurrences, data.courses, courseUsage);
      const schedules = data.schedules.filter((item) => item.date === date);
      const previousSuggestions = occupiedByDate.get(date) || [];
      const courseBlocks = occurrences.map(courseInterval);
      const hardBlocks = [
        ...schedules.map(scheduleInterval),
        ...courseBlocks,
        ...previousSuggestions,
      ];
      const dayStart = timeToMinutes(data.settings.dayStart);
      const dayEnd = timeToMinutes(data.settings.dayEnd);
      const nowMinute =
        new Date().getHours() * 60 + new Date().getMinutes() + 10;
      const startFloor =
        date === todayKey()
          ? Math.max(dayStart, Math.ceil(nowMinute / 5) * 5)
          : dayStart;
      const free = subtractIntervals(
        { start: startFloor, end: dayEnd },
        hardBlocks,
      );
      const freeWindows: PlanningWindow[] = free
        .filter((interval) =>
          task.planningScenes.includes(sceneForGap(intervalMinutes(interval))),
        )
        .map((interval) => ({
          interval,
          source: "free",
          precision: "exact",
          reason:
            sceneForGap(intervalMinutes(interval)) === "short-gap"
              ? "匹配到一个短空闲时段。"
              : "匹配到一个完整连续空闲时段。",
        }));
      if (!free.length) sawAnyWindow = false;

      const courseWindows: PlanningWindow[] = [];
      for (const occurrence of occurrences) {
        const sourceCourse = data.courses.find(
          (course) => course.id === occurrence.courseId,
        );
        if (
          sourceCourse &&
          occurrence.focusLevel !== "must" &&
          sourceCourse.availableMinutes > 0 &&
          (!task.planningScenes.includes("course") ||
            !sourceCourse.allowedTaskFocus.includes(task.focusRequirement))
        ) {
          sawCourseEligibilityMismatch = true;
        }
        const candidateWindows = waterWindowsForOccurrence(
          occurrence,
          sourceCourse,
          task,
        );
        for (const candidate of candidateWindows) {
          const otherCourseBlocks = occurrences
            .filter(
              (item) => item.id !== candidate.courseOccurrenceId,
            )
            .map(courseInterval);
          const clearParts = subtractIntervals(candidate.interval, [
            ...schedules.map(scheduleInterval),
            ...otherCourseBlocks,
            ...previousSuggestions,
          ]);
          for (const interval of clearParts) {
            courseWindows.push({ ...candidate, interval });
          }
        }
      }

      const allWindows = [...freeWindows, ...courseWindows];
      if (allWindows.length) sawAnyWindow = true;

      const matchingWindows = allWindows.filter((window) => {
        if (
          window.source !== "free" &&
          task.focusRequirement === "deep" &&
          window.source === "course-auto" &&
          !sourceAllowsDeep(data.courses, window.courseKey, task)
        ) {
          return false;
        }
        const scene =
          window.source === "free"
            ? sceneForGap(intervalMinutes(window.interval))
            : "course";
        return task.planningScenes.includes(scene);
      });
      if (!matchingWindows.length) {
        if (
          free.length &&
          !free.some((interval) =>
            task.planningScenes.includes(
              sceneForGap(intervalMinutes(interval)),
            ),
          )
        ) {
          sawSceneMismatch = true;
        }
      }

      let chosen:
        | {
            window: PlanningWindow;
            duration: number;
          }
        | undefined;
      for (const window of [...matchingWindows].sort((a, b) => {
        if (a.source === "course-manual") return -1;
        if (b.source === "course-manual") return 1;
        return intervalMinutes(a.interval) - intervalMinutes(b.interval);
      })) {
        const usage = window.courseKey
          ? courseUsage.get(window.courseKey)
          : undefined;
        if (window.courseKey && !usage) continue;
        if (usage) {
          const autoBudget = Math.max(
            0,
            usage.capacity - usage.manualQuota,
          );
          if (usage.used >= usage.capacity) {
            sawWaterQuotaExhausted = true;
            continue;
          }
          if (
            window.source === "course-auto" &&
            usage.autoUsed >= autoBudget
          ) {
            sawWaterQuotaExhausted = true;
            continue;
          }
        }
        let duration = segmentDuration(
          remainingToPlace,
          intervalMinutes(window.interval),
          Math.min(task.minDuration, remainingToPlace),
          task.allowSplit,
        );
        if (!duration) {
          sawTooShort = true;
          continue;
        }
        const energyRemaining = Math.max(0, energyBudget - plannedMinutes);
        if (duration > energyRemaining) {
          if (
            task.allowSplit &&
            energyRemaining >=
              Math.min(task.minDuration, remainingToPlace)
          ) {
            duration = energyRemaining;
          } else {
            sawEnergyLimit = true;
            continue;
          }
        }
        if (usage && usage.used + duration > usage.capacity) {
          sawWaterQuotaExhausted = true;
          continue;
        }
        if (
          usage &&
          window.source === "course-auto" &&
          usage.autoUsed + duration >
            Math.max(0, usage.capacity - usage.manualQuota)
        ) {
          sawWaterQuotaExhausted = true;
          continue;
        }
        let start = window.interval.start;
        if (energy === "low" && start < 10 * 60) {
          const shifted = start + 15;
          if (
            shifted + duration <= window.interval.end ||
            window.source === "course-auto"
          ) {
            start = shifted;
          }
        }
        chosen = { window, duration };
        chosen.window = {
          ...window,
          interval: { start, end: start + duration },
        };
        break;
      }

      if (!chosen) continue;
      const suggestion: PlanningSuggestion = {
        id: `suggestion-${task.id}-${date}-${chosen.window.interval.start}`,
        taskId: task.id,
        taskTitle: task.title,
        date,
        start: minutesToTime(chosen.window.interval.start),
        end: minutesToTime(chosen.window.interval.end),
        minutes: chosen.duration,
        reason:
          energy === "low" &&
          chosen.window.interval.start < 10 * 60
            ? `${chosen.window.reason} 低精力状态下已避开过早时段。`
            : chosen.window.reason,
        source: chosen.window.source,
        precision: chosen.window.precision,
      };
      suggestions.push(suggestion);
      occupiedByDate.set(date, [
        ...(occupiedByDate.get(date) || []),
        chosen.window.interval,
      ]);
      if (chosen.window.courseKey) {
        const usage = courseUsage.get(chosen.window.courseKey)!;
        usage.used += chosen.duration;
        if (chosen.window.source === "course-auto") {
          usage.autoUsed += chosen.duration;
        }
      }
      remainingToPlace -= chosen.duration;
      plannedMinutes += chosen.duration;
      if (task.allowSplit && remainingToPlace > 0) {
        offset -= 1;
      }
    }

    if (remainingToPlace > 0) {
      let reason = "截止日期前没有符合任务专注要求和场景的空闲时间。";
      if (sawSceneMismatch) {
        reason = task.allowSplit
          ? "现有空闲时间的长度不符合任务适用场景。"
          : "没有足够长的连续时间，现有空闲时间长度不符合任务场景。";
      } else if (sawEnergyLimit) {
        reason = "当前精力水平下已接近本次规划负荷上限，剩余任务暂不强行安排。";
      } else if (sawTooShort) {
        reason = task.allowSplit
          ? "没有满足最短执行时长的剩余时间。"
          : "没有足够长的连续时间，任务又设置为不可拆分。";
      } else if (sawWaterQuotaExhausted) {
        reason = "水课可利用额度不足，或已被其他建议占用。";
      } else if (sawCourseEligibilityMismatch) {
        reason = "任务类型或适用场景与水课允许规则不匹配。";
      } else if (!sawAnyWindow) {
        reason = "截止日期前没有可用的空闲时间。";
      }
      unscheduled.push({
        taskId: task.id,
        taskTitle: task.title,
        minutes: remainingToPlace,
        reason,
      });
    }
  }

  let busyMinutes = 0;
  let freeMinutes = 0;
  for (let offset = 0; offset < 8; offset += 1) {
    const date = dateAt(offset);
    const occurrences = occurrencesForDate(
      date,
      data.courses,
      data.courseChanges,
      data.settings,
    );
    const schedules = data.schedules.filter((item) => item.date === date);
    const blocks = [
      ...schedules.map(scheduleInterval),
      ...occurrences.map(courseInterval),
    ];
    busyMinutes += blocks.reduce(
      (sum, interval) => sum + intervalMinutes(interval),
      0,
    );
    const dayStart = timeToMinutes(data.settings.dayStart);
    const dayEnd = timeToMinutes(data.settings.dayEnd);
    const startFloor =
      date === todayKey()
        ? Math.max(
            dayStart,
            new Date().getHours() * 60 + new Date().getMinutes() + 10,
          )
        : dayStart;
    freeMinutes += subtractIntervals(
      { start: startFloor, end: dayEnd },
      blocks,
    ).reduce((sum, interval) => sum + intervalMinutes(interval), 0);
  }

  return { suggestions, unscheduled, busyMinutes, freeMinutes };
};

const sourceAllowsDeep = (
  courses: Course[],
  courseKey: string | undefined,
  task: Task,
) => {
  if (!courseKey) return false;
  const courseId = courseKey.split(":").slice(1).join(":");
  const course = courses.find((item) => item.id === courseId);
  return Boolean(
    course &&
      course.allowedTaskFocus.includes("deep") &&
      task.planningScenes.includes("course"),
  );
};
