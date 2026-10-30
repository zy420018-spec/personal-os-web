import type {
  AppSettings,
  Course,
  CourseChange,
  CourseFocusLevel,
} from "./types";
import { toDateKey } from "./date";

export interface CourseOccurrence {
  id: string;
  courseId?: string;
  changeId?: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  teacher?: string;
  focusLevel: CourseFocusLevel;
  kind: "course" | "activity" | "rescheduled";
  note?: string;
}

export const parseWeeks = (value: string) =>
  [...new Set(
    value
      .split(/[,，、\s]+/)
      .flatMap((part) => {
        const match = part.match(/^(\d+)-(\d+)$/);
        if (match) {
          const start = Math.max(1, Number(match[1]));
          const end = Math.min(60, Number(match[2]));
          return Array.from(
            { length: Math.max(0, end - start + 1) },
            (_, index) => start + index,
          );
        }
        const week = Number(part);
        return Number.isInteger(week) && week > 0 ? [week] : [];
      }),
  )].sort((a, b) => a - b);

export const formatWeeks = (weeks: number[]) => {
  if (!weeks.length) return "";
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (const week of sorted.slice(1)) {
    if (week === previous + 1) {
      previous = week;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = week;
    previous = week;
  }
  ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
  return ranges.join(", ");
};

export const weekNumberForDate = (
  dateKey: string,
  semesterStart: string,
) => {
  if (!semesterStart) return 0;
  const start = new Date(`${semesterStart}T00:00:00`);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const date = new Date(`${dateKey}T00:00:00`);
  const milliseconds = date.getTime() - start.getTime();
  return Math.floor(milliseconds / (7 * 24 * 60 * 60 * 1000)) + 1;
};

export const dateForWeekday = (
  dateKey: string,
  withinWeek = false,
) => {
  const date = new Date(`${dateKey}T12:00:00`);
  const weekday = date.getDay() || 7;
  if (withinWeek) {
    const mondayOffset = weekday - 1;
    date.setDate(date.getDate() - mondayOffset);
  }
  return toDateKey(date);
};

export const occurrencesForDate = (
  date: string,
  courses: Course[],
  changes: CourseChange[],
  settings: AppSettings,
) => {
  const dateValue = new Date(`${date}T12:00:00`);
  const weekday = dateValue.getDay() || 7;
  const week = weekNumberForDate(date, settings.semesterStart);
  const changesForDate = changes.filter((change) => change.date === date);
  const originalChanges = changes.filter(
    (change) => change.originalDate === date,
  );
  const cancelledCourseIds = new Set(
    originalChanges
      .filter((change) => change.type === "cancelled")
      .map((change) => change.courseId)
      .filter(Boolean),
  );
  const rescheduledCourseIds = new Set(
    originalChanges
      .filter((change) => change.type === "rescheduled")
      .map((change) => change.courseId)
      .filter(Boolean),
  );

  const base: CourseOccurrence[] = courses
    .filter(
      (course) =>
        week >= 1 &&
        week <= settings.totalWeeks &&
        course.weeks.includes(week) &&
        course.weekdays.includes(weekday) &&
        !cancelledCourseIds.has(course.id) &&
        !rescheduledCourseIds.has(course.id),
    )
    .map((course) => ({
      id: `${course.id}-${date}`,
      courseId: course.id,
      title: course.title,
      date,
      startTime: course.startTime,
      endTime: course.endTime,
      location: course.location,
      teacher: course.teacher,
      focusLevel: course.focusLevel,
      kind: "course",
      note: course.note,
    }));

  const temporary: CourseOccurrence[] = changesForDate
    .filter(
      (change) =>
        change.type === "activity" || change.type === "rescheduled",
    )
    .map((change): CourseOccurrence => ({
      id: change.id,
      courseId: change.courseId,
      changeId: change.id,
      title: change.title,
      date,
      startTime: change.startTime,
      endTime: change.endTime,
      location: change.location || "",
      focusLevel: change.focusLevel,
      kind: change.type as "activity" | "rescheduled",
      note: change.note,
    }));

  return [...base, ...temporary].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
};

export const courseMinutes = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
};

export const minutesToTime = (minutes: number) => {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(minutes / 5) * 5));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
    safe % 60,
  ).padStart(2, "0")}`;
};

export const timeToMinutes = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};
