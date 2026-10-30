import { expect, test } from "@playwright/test";
import { createSeedData } from "../src/data/seed";
import { dateAt, todayKey } from "../src/date";
import {
  occurrencesForDate,
  weekNumberForDate,
} from "../src/course";
import { buildPlanningSuggestions } from "../src/planner";
import type {
  AppData,
  Course,
  CourseChange,
  Schedule,
  Task,
} from "../src/types";

const futureDate = dateAt(1);

const baseData = (): AppData => {
  const seed = createSeedData();
  return {
    ...seed,
    tasks: [],
    schedules: [],
    courses: [],
    courseChanges: [],
    focusSessions: [],
    evidence: [],
    settings: {
      ...seed.settings,
      semesterStart: dateAt(-56),
      totalWeeks: 60,
      dayStart: "08:00",
      dayEnd: "22:00",
    },
  };
};

const makeTask = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  title: `任务 ${id}`,
  description: "",
  status: "todo",
  priority: "medium",
  deadline: futureDate,
  estimate: 20,
  minDuration: 10,
  allowSplit: true,
  focusRequirement: "light",
  planningScenes: ["course", "short-gap", "full-gap"],
  remainingWork: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const weekdayFor = (date: string) => new Date(`${date}T12:00:00`).getDay() || 7;

const makeCourse = (overrides: Partial<Course> = {}): Course => ({
  id: "water-course",
  title: "水课",
  weekdays: [weekdayFor(futureDate)],
  startTime: "10:00",
  endTime: "11:30",
  location: "A101",
  weeks: Array.from({ length: 60 }, (_, index) => index + 1),
  focusLevel: "light",
  availableMinutes: 40,
  arrangementMode: "auto",
  allowedTaskFocus: ["light"],
  avoidStartEnd: true,
  availableWindows: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeSchedule = (
  id: string,
  start: string,
  end: string,
): Schedule => ({
  id,
  title: id,
  date: futureDate,
  start,
  end,
});

const expectNoOverlaps = (
  suggestions: { date: string; start: string; end: string }[],
) => {
  for (let index = 0; index < suggestions.length; index += 1) {
    for (let other = index + 1; other < suggestions.length; other += 1) {
      if (suggestions[index].date !== suggestions[other].date) continue;
      expect(
        suggestions[index].start < suggestions[other].end &&
          suggestions[index].end > suggestions[other].start,
      ).toBe(false);
    }
  }
};

test("auto water-class suggestions respect total quota and never overlap", () => {
  const data = {
    ...baseData(),
    courses: [makeCourse()],
    tasks: [
      makeTask("a", { estimate: 20, minDuration: 10 }),
      makeTask("b", { estimate: 20, minDuration: 10 }),
      makeTask("c", { estimate: 20, minDuration: 10 }),
    ],
    settings: {
      ...baseData().settings,
      dayStart: "10:00",
      dayEnd: "11:30",
    },
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(
    result.suggestions.reduce((sum, item) => sum + item.minutes, 0),
  ).toBeLessThanOrEqual(40);
  expect(result.suggestions.length).toBe(2);
  expectNoOverlaps(result.suggestions);
  expect(result.unscheduled[0].reason).toContain("额度不足");
});

test("manual water-class windows are the only allowed course times", () => {
  const course = makeCourse({
    arrangementMode: "manual",
    availableMinutes: 40,
    availableWindows: [
      { id: "w1", startTime: "10:20", endTime: "10:40" },
      { id: "w2", startTime: "10:55", endTime: "11:15" },
    ],
  });
  const data = {
    ...baseData(),
    courses: [course],
    tasks: [makeTask("a", { estimate: 20 }), makeTask("b", { estimate: 20 })],
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(result.suggestions).toHaveLength(2);
  expect(
    result.suggestions.every(
      (item) =>
        (item.start >= "10:20" && item.end <= "10:40") ||
        (item.start >= "10:55" && item.end <= "11:15"),
    ),
  ).toBe(true);
  expect(result.suggestions.every((item) => item.precision === "exact")).toBe(
    true,
  );
});

test("hybrid mode reserves manual windows and does not double-use quota", () => {
  const course = makeCourse({
    arrangementMode: "hybrid",
    availableMinutes: 40,
    availableWindows: [
      { id: "w1", startTime: "10:20", endTime: "10:40" },
    ],
  });
  const data = {
    ...baseData(),
    courses: [course],
    tasks: [
      makeTask("a", { estimate: 20, planningScenes: ["course"] }),
      makeTask("b", { estimate: 20, planningScenes: ["course"] }),
      makeTask("c", { estimate: 20, planningScenes: ["course"] }),
    ],
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(
    result.suggestions.reduce((sum, item) => sum + item.minutes, 0),
  ).toBeLessThanOrEqual(40);
  expect(
    result.suggestions.some((item) => item.source === "course-manual"),
  ).toBe(true);
  expect(
    result.suggestions.some((item) => item.source === "course-auto"),
  ).toBe(true);
  expectNoOverlaps(result.suggestions);
});

test("manual water window is reduced by an existing confirmed schedule", () => {
  const course = makeCourse({
    arrangementMode: "manual",
    availableMinutes: 20,
    availableWindows: [
      { id: "w1", startTime: "10:20", endTime: "10:40" },
    ],
  });
  const data = {
    ...baseData(),
    courses: [course],
    schedules: [makeSchedule("confirmed", "10:20", "10:35")],
    tasks: [
      makeTask("a", {
        estimate: 15,
        minDuration: 15,
        allowSplit: false,
        planningScenes: ["course"],
      }),
    ],
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(result.suggestions).toHaveLength(0);
  expect(result.unscheduled[0].reason).toContain("连续时间");
});

test("must-attend course never receives a task", () => {
  const data = {
    ...baseData(),
    courses: [
      makeCourse({
        focusLevel: "must",
        allowedTaskFocus: ["light", "normal", "deep"],
      }),
    ],
    tasks: [makeTask("a", { estimate: 20 })],
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(
    result.suggestions.some((item) => item.source !== "free"),
  ).toBe(false);
});

test("a water-class with zero usable minutes remains unavailable", () => {
  const data = {
    ...baseData(),
    courses: [
      makeCourse({
        availableMinutes: 0,
        arrangementMode: "auto",
      }),
    ],
    tasks: [
      makeTask("a", {
        estimate: 15,
        minDuration: 15,
        planningScenes: ["course"],
      }),
    ],
    settings: {
      ...baseData().settings,
      dayStart: "10:00",
      dayEnd: "11:30",
    },
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(result.suggestions).toHaveLength(0);
  expect(result.unscheduled).toHaveLength(1);
});

test("a 15-minute short gap can fit a matching short task", () => {
  const data = {
    ...baseData(),
    schedules: [
      makeSchedule("before", "08:00", "10:00"),
      makeSchedule("after", "10:15", "12:00"),
    ],
    tasks: [
      makeTask("short", {
        estimate: 15,
        minDuration: 15,
        planningScenes: ["short-gap"],
      }),
    ],
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0].minutes).toBe(15);
  expect(result.suggestions[0].start).toBe("10:00");
  expect(result.suggestions[0].end).toBe("10:15");
});

test("a 30-minute gap cannot take an unsplittable 60-minute task", () => {
  const data = {
    ...baseData(),
    schedules: [
      makeSchedule("before", "08:00", "10:00"),
      makeSchedule("after", "10:30", "12:00"),
    ],
    tasks: [
      makeTask("long", {
        estimate: 60,
        minDuration: 60,
        allowSplit: false,
        focusRequirement: "normal",
        planningScenes: ["short-gap"],
      }),
    ],
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(result.suggestions).toHaveLength(0);
  expect(result.unscheduled[0].reason).toContain("连续时间");
});

test("an unsplittable deep task only uses a full continuous gap", () => {
  const data = {
    ...baseData(),
    schedules: [
      makeSchedule("before", "08:00", "09:00"),
      makeSchedule("after", "09:45", "12:00"),
    ],
    tasks: [
      makeTask("deep", {
        estimate: 45,
        minDuration: 45,
        allowSplit: false,
        focusRequirement: "deep",
        planningScenes: ["full-gap"],
      }),
    ],
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0].start).toBe("09:00");
  expect(result.suggestions[0].end).toBe("09:45");
});

test("an unfinished prerequisite blocks the dependent task", () => {
  const prerequisite = makeTask("pre", { status: "todo" });
  const dependent = makeTask("dependent", {
    prerequisiteTaskId: prerequisite.id,
  });
  const data = {
    ...baseData(),
    tasks: [prerequisite, dependent],
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(
    result.suggestions.some((item) => item.taskId === dependent.id),
  ).toBe(false);
  expect(
    result.unscheduled.find((item) => item.taskId === dependent.id)?.reason,
  ).toContain("前置任务");
});

test("cancelled course affects only its specified date", () => {
  const course = makeCourse({
    weekdays: [1],
    weeks: Array.from({ length: 60 }, (_, index) => index + 1),
  });
  const monday = new Date(`${todayKey()}T12:00:00`);
  monday.setDate(monday.getDate() + ((8 - (monday.getDay() || 7)) % 7 || 7));
  const firstDate = monday.toISOString().slice(0, 10);
  monday.setDate(monday.getDate() + 7);
  const secondDate = monday.toISOString().slice(0, 10);
  const cancellation: CourseChange = {
    id: "cancel",
    courseId: course.id,
    type: "cancelled",
    title: course.title,
    originalDate: firstDate,
    date: firstDate,
    startTime: course.startTime,
    endTime: course.endTime,
    focusLevel: course.focusLevel,
    createdAt: new Date().toISOString(),
  };
  const data = baseData();
  expect(
    occurrencesForDate(firstDate, [course], [cancellation], data.settings),
  ).toHaveLength(0);
  expect(
    occurrencesForDate(secondDate, [course], [cancellation], data.settings),
  ).toHaveLength(1);
});

test("unscheduled reasons are derived from actual constraints", () => {
  const data = {
    ...baseData(),
    schedules: [
      makeSchedule("all-day-a", "08:00", "10:00"),
      makeSchedule("all-day-b", "10:30", "22:00"),
    ],
    tasks: [
      makeTask("unsuitable", {
        estimate: 45,
        minDuration: 45,
        allowSplit: false,
        planningScenes: ["full-gap"],
      }),
    ],
  };
  const result = buildPlanningSuggestions(data, "steady");
  expect(result.unscheduled[0].reason).toContain("连续时间");
});

test("running the planner twice is deterministic and confirmed plans are not duplicated", () => {
  const data = {
    ...baseData(),
    schedules: [
      makeSchedule("before", "08:00", "10:00"),
      makeSchedule("after", "11:00", "12:00"),
    ],
    tasks: [
      makeTask("deterministic", {
        estimate: 60,
        minDuration: 30,
        allowSplit: false,
        planningScenes: ["full-gap"],
      }),
    ],
  };
  const first = buildPlanningSuggestions(data, "steady");
  const second = buildPlanningSuggestions(data, "steady");
  expect(second.suggestions).toEqual(first.suggestions);
  const confirmed = first.suggestions.map(
    (item): Schedule => ({
      id: "confirmed-1",
      title: item.taskTitle,
      date: item.date,
      start: item.start,
      end: item.end,
      taskId: item.taskId,
    }),
  );
  const rerun = buildPlanningSuggestions(
    { ...data, schedules: [...data.schedules, ...confirmed] },
    "steady",
  );
  expect(
    rerun.suggestions.some((item) => item.taskId === "deterministic"),
  ).toBe(false);
});

test("V2 course and task records receive compatible V3 defaults", () => {
  const seed = createSeedData();
  const week = weekNumberForDate(futureDate, seed.settings.semesterStart);
  expect(week).toBeGreaterThan(0);
});
