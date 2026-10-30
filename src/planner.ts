import type {
  AppData,
  CourseChange,
  CourseFocusLevel,
  Priority,
  Schedule,
  Task,
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
  source: "free" | "course-light" | "course-flexible";
}

export interface PlanningResult {
  suggestions: PlanningSuggestion[];
  unscheduled: { taskId: string; taskTitle: string; minutes: number }[];
  busyMinutes: number;
  freeMinutes: number;
}

interface Interval {
  start: number;
  end: number;
}

const priorityRank: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

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

const subtractIntervals = (
  range: Interval,
  blocked: Interval[],
) => {
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

const canUseCourseWindow = (
  course: CourseOccurrence,
  task: Task,
  duration: number,
) => {
  if (course.focusLevel === "must") return false;
  if (course.focusLevel === "light") {
    return duration <= 15 && ["low", "medium"].includes(task.priority);
  }
  return (
    course.focusLevel === "flexible" &&
    duration <= 30 &&
    task.priority !== "urgent"
  );
};

const historicalRatio = (data: AppData, task: Task) => {
  const sessions = data.focusSessions.filter(
    (session) =>
      session.taskId === task.id &&
      session.status === "ended" &&
      session.endedAt,
  );
  if (!sessions.length) return 1;
  const actual = sessions.reduce((sum, session) => {
    return (
      sum +
      Math.max(
        0,
        (new Date(session.endedAt!).getTime() -
          new Date(session.startedAt).getTime() -
          session.totalPausedMs) /
          60000,
      )
    );
  }, 0);
  return Math.min(1.8, Math.max(0.6, actual / Math.max(1, task.estimate)));
};

const taskRemainingMinutes = (data: AppData, task: Task) => {
  const futureMinutes = data.schedules
    .filter(
      (schedule) =>
        schedule.taskId === task.id &&
        schedule.date >= todayKey(),
    )
    .reduce(
      (sum, schedule) =>
        sum +
        Math.max(
          0,
          timeToMinutes(schedule.end) - timeToMinutes(schedule.start),
        ),
      0,
    );
  return Math.max(
    0,
    Math.ceil(task.estimate * historicalRatio(data, task) - futureMinutes),
  );
};

const energyCapacity = (energy: EnergyLevel) =>
  energy === "high" ? 1 : energy === "steady" ? 0.86 : 0.68;

const findInWindows = (
  windows: {
    interval: Interval;
    source: PlanningSuggestion["source"];
    reason: string;
  }[],
  duration: number,
) => {
  let best:
    | {
        interval: Interval;
        source: PlanningSuggestion["source"];
        reason: string;
      }
    | undefined;
  for (const window of windows) {
    const available = window.interval.end - window.interval.start;
    if (available >= duration) {
      if (
        !best ||
        available < best.interval.end - best.interval.start
      ) {
        best = window;
      }
    }
  }
  if (!best) return undefined;
  return {
    ...best,
    start: best.interval.start,
    end: best.interval.start + duration,
  };
};

export const buildPlanningSuggestions = (
  data: AppData,
  energy: EnergyLevel,
): PlanningResult => {
  const tasks = data.tasks
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
      return priorityRank[a.task.priority] - priorityRank[b.task.priority];
    });

  const suggestions: PlanningSuggestion[] = [];
  const unscheduled: PlanningResult["unscheduled"] = [];
  let busyMinutes = 0;
  let freeMinutes = 0;
  const capacity = energyCapacity(energy);

  for (const { task, remaining } of tasks) {
    let remainingToPlace = remaining;
    const deadline = task.deadline || dateAt(7);
    const dayLimit = Math.min(7, Math.max(1, Math.ceil(
      (new Date(`${deadline}T12:00:00`).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000),
    )));
    const latestDate =
      deadline < todayKey() ? dateAt(7) : deadline;

    for (let offset = 0; offset <= dayLimit && remainingToPlace > 0; offset += 1) {
      const date = dateAt(offset);
      if (date > latestDate) break;
      const courses = occurrencesForDate(
        date,
        data.courses,
        data.courseChanges as CourseChange[],
        data.settings,
      );
      const schedules = data.schedules.filter((item) => item.date === date);
      const scheduledMinutes = schedules.reduce(
        (sum, item) => sum + courseMinutes(item.start, item.end),
        0,
      );
      const courseBlocked = courses.reduce(
        (sum, course) =>
          course.focusLevel === "must"
            ? sum + courseMinutes(course.startTime, course.endTime)
            : sum,
        0,
      );
      busyMinutes += scheduledMinutes + courseBlocked;

      const dayStart = timeToMinutes(data.settings.dayStart);
      const dayEnd = timeToMinutes(data.settings.dayEnd);
      const today = date === todayKey();
      const currentMinute = new Date().getHours() * 60 + new Date().getMinutes() + 10;
      const startFloor = today
        ? Math.max(dayStart, Math.ceil(currentMinute / 5) * 5)
        : dayStart;
      const hardBlocks = [
        ...schedules.map(scheduleInterval),
        ...courses
          .filter((course) => course.focusLevel === "must")
          .map(courseInterval),
      ];
      const free = subtractIntervals(
        { start: startFloor, end: dayEnd },
        hardBlocks,
      );
      freeMinutes += free.reduce(
        (sum, interval) => sum + interval.end - interval.start,
        0,
      );

      const preferredDuration = Math.min(
        energy === "low" ? 45 : energy === "steady" ? 60 : 90,
        Math.max(25, Math.ceil(remainingToPlace * capacity)),
      );
      const duration = Math.min(
        remainingToPlace,
        remainingToPlace <= 90
          ? remainingToPlace
          : Math.max(25, preferredDuration),
      );
      const windows: {
        interval: Interval;
        source: PlanningSuggestion["source"];
        reason: string;
      }[] = free.map((interval) => ({
        interval,
        source: "free" as const,
        reason: courses.length
          ? `避开 ${courses.map((course) => course.title).join("、")} 后的完整空闲时段。`
          : "当天没有课程冲突，可安排完整专注块。",
      }));
      for (const course of courses.filter(
        (item) => item.focusLevel !== "must",
      )) {
        const courseWindow = courseInterval(course);
        if (canUseCourseWindow(course, task, duration)) {
          windows.push({
            interval: courseWindow,
            source:
              course.focusLevel === "light"
                ? "course-light"
                : "course-flexible",
            reason: `“${course.title}”为${
              course.focusLevel === "light" ? "轻度空闲" : "相对空闲"
            }，适合轻量任务。`,
          });
        }
      }
      const found = findInWindows(windows, duration);
      if (!found) continue;

      const energyPenalty =
        energy === "low" &&
        found.start < 10 * 60 &&
        found.interval.end - found.start >= duration + 15
          ? 15
          : 0;
      suggestions.push({
        id: `suggestion-${task.id}-${date}-${found.start}`,
        taskId: task.id,
        taskTitle: task.title,
        date,
        start: minutesToTime(found.start + energyPenalty),
        end: minutesToTime(found.start + energyPenalty + duration),
        minutes: duration,
        reason:
          energy === "low" && energyPenalty
            ? `${found.reason} 低精力状态下已避开过早时段。`
            : found.reason,
        source: found.source,
      });
      remainingToPlace -= duration;
    }

    if (remainingToPlace > 0) {
      unscheduled.push({
        taskId: task.id,
        taskTitle: task.title,
        minutes: remainingToPlace,
      });
    }
  }

  return { suggestions, unscheduled, busyMinutes, freeMinutes };
};
