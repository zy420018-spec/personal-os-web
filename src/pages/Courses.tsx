import {
  Activity,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  MapPin,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  Course,
  CourseChange,
  CourseFocusLevel,
} from "../types";
import { useStore } from "../store";
import {
  formatWeeks,
  occurrencesForDate,
  parseWeeks,
  weekNumberForDate,
} from "../course";
import { dateAt, formatShortDate, toDateKey, todayKey } from "../date";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  Tabs,
  useToast,
} from "../components/ui";

type CourseInput = Omit<Course, "id" | "createdAt">;
type ChangeInput = Omit<CourseChange, "id" | "createdAt">;

const focusLabels: Record<CourseFocusLevel, string> = {
  must: "必须专心",
  light: "轻度空闲",
  flexible: "相对空闲",
};

const emptyCourse = (): CourseInput => ({
  title: "",
  weekdays: [1],
  startTime: "08:00",
  endTime: "09:40",
  location: "",
  teacher: "",
  weeks: Array.from({ length: 16 }, (_, index) => index + 1),
  focusLevel: "must",
  availableMinutes: 0,
  arrangementMode: "manual",
  allowedTaskFocus: ["light"],
  avoidStartEnd: true,
  availableWindows: [],
  note: "",
});

const emptyChange = (date = todayKey()): ChangeInput => ({
  type: "activity",
  title: "",
  date,
  startTime: "18:00",
  endTime: "19:00",
  location: "",
  focusLevel: "must",
  note: "",
});

const mondayFor = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00`);
  const offset = (date.getDay() || 7) - 1;
  date.setDate(date.getDate() - offset);
  return date;
};

export function CoursesPage({ embedded = false }: { embedded?: boolean }) {
  const {
    data,
    createCourse,
    updateCourse,
    deleteCourse,
    createCourseChange,
    deleteCourseChange,
  } = useStore();
  const toast = useToast();
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [courseOpen, setCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | undefined>();
  const [courseForm, setCourseForm] = useState<CourseInput>(emptyCourse);
  const [weeksText, setWeeksText] = useState("1-16");
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeForm, setChangeForm] = useState<ChangeInput>(emptyChange);
  const [deleteCourseTarget, setDeleteCourseTarget] = useState<Course>();
  const [deleteChangeTarget, setDeleteChangeTarget] = useState<CourseChange>();
  const [error, setError] = useState("");

  const weekMonday = mondayFor(anchorDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekMonday);
    date.setDate(date.getDate() + index);
    return date;
  });
  const currentWeek = weekNumberForDate(
    toDateKey(weekMonday),
    data.settings.semesterStart,
  );
  const dayOccurrences = useMemo(
    () =>
      occurrencesForDate(
        anchorDate,
        data.courses,
        data.courseChanges,
        data.settings,
      ),
    [anchorDate, data.courses, data.courseChanges, data.settings],
  );

  const openCourse = (course?: Course) => {
    setEditingCourse(course);
    setCourseForm(
      course
        ? {
            title: course.title,
            weekdays: course.weekdays,
            startTime: course.startTime,
            endTime: course.endTime,
            location: course.location,
            teacher: course.teacher || "",
            weeks: course.weeks,
            focusLevel: course.focusLevel,
            availableMinutes: course.availableMinutes,
            arrangementMode: course.arrangementMode,
            allowedTaskFocus: course.allowedTaskFocus,
            avoidStartEnd: course.avoidStartEnd,
            availableWindows: course.availableWindows,
            note: course.note || "",
          }
        : emptyCourse(),
    );
    setWeeksText(course ? formatWeeks(course.weeks) : "1-16");
    setError("");
    setCourseOpen(true);
  };

  const saveCourse = () => {
    const weeks = parseWeeks(weeksText);
    if (!courseForm.title.trim() || !courseForm.location.trim()) {
      setError("请填写课程名称和上课地点。");
      return;
    }
    if (!courseForm.weekdays.length || !weeks.length) {
      setError("请至少选择一个星期和有效上课周次。");
      return;
    }
    if (courseForm.endTime <= courseForm.startTime) {
      setError("下课时间需要晚于上课时间。");
      return;
    }
    const courseDuration =
      Number(courseForm.endTime.slice(0, 2)) * 60 +
      Number(courseForm.endTime.slice(3)) -
      (Number(courseForm.startTime.slice(0, 2)) * 60 +
        Number(courseForm.startTime.slice(3)));
    if (courseForm.availableMinutes > courseDuration) {
      setError("可利用总分钟数不能超过课程总时长。");
      return;
    }
    if (
      courseForm.focusLevel !== "must" &&
      courseForm.availableMinutes > 0 &&
      !courseForm.allowedTaskFocus.length
    ) {
      setError("启用课堂可利用时间后，请至少选择一种允许的任务类型。");
      return;
    }
    const invalidWindow = courseForm.availableWindows.find(
      (window) =>
        window.startTime < courseForm.startTime ||
        window.endTime > courseForm.endTime ||
        window.endTime <= window.startTime,
    );
    if (invalidWindow) {
      setError("可利用时段必须晚于课程开始、早于课程结束，并保持正确顺序。");
      return;
    }
    const fixedWindowConflict = courseForm.availableWindows.find((window) =>
      data.courses.some(
        (course) =>
          course.id !== editingCourse?.id &&
          course.weekdays.some((day) =>
            courseForm.weekdays.includes(day),
          ) &&
          weeks.some((week) => course.weeks.includes(week)) &&
          window.startTime < course.endTime &&
          window.endTime > course.startTime,
      ),
    );
    if (fixedWindowConflict) {
      setError("可利用时段与其他固定课程时间冲突。");
      return;
    }
    const sortedWindows = [...courseForm.availableWindows].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    const overlappingWindow = sortedWindows.find(
      (window, index) =>
        index > 0 &&
        window.startTime < sortedWindows[index - 1].endTime,
    );
    if (overlappingWindow) {
      setError("多个可利用时段之间不能重叠。");
      return;
    }
    const manualMinutes = sortedWindows.reduce((sum, window) => {
      const [startHour, startMinute] = window.startTime.split(":").map(Number);
      const [endHour, endMinute] = window.endTime.split(":").map(Number);
      return sum + endHour * 60 + endMinute - startHour * 60 - startMinute;
    }, 0);
    if (
      courseForm.focusLevel !== "must" &&
      courseForm.arrangementMode !== "auto" &&
      manualMinutes > courseForm.availableMinutes
    ) {
      setError("手动指定时段的总时长不能超过可利用总额度。");
      return;
    }
    if (
      courseForm.focusLevel !== "must" &&
      courseForm.arrangementMode === "manual" &&
      courseForm.availableMinutes > 0 &&
      manualMinutes === 0
    ) {
      setError("手动模式需要至少一个具体可利用时段。");
      return;
    }
    const conflictedCourse = data.courses.find(
      (course) =>
        course.id !== editingCourse?.id &&
        course.weekdays.some((day) => courseForm.weekdays.includes(day)) &&
        weeks.some((week) => course.weeks.includes(week)) &&
        courseForm.startTime < course.endTime &&
        courseForm.endTime > course.startTime,
    );
    if (conflictedCourse) {
      setError(`与课程“${conflictedCourse.title}”的时间安排冲突。`);
      return;
    }
    const normalized = {
      ...courseForm,
      title: courseForm.title.trim(),
      location: courseForm.location.trim(),
      teacher: courseForm.teacher?.trim(),
      note: courseForm.note?.trim(),
      weeks,
      availableWindows:
        courseForm.focusLevel === "must" ||
        courseForm.arrangementMode === "auto"
          ? []
          : sortedWindows,
      availableMinutes:
        courseForm.focusLevel === "must"
          ? 0
          : Math.max(0, courseForm.availableMinutes),
    };
    if (editingCourse) {
      updateCourse({ ...editingCourse, ...normalized });
      toast("课程已更新，临时变动记录仍然保留");
    } else {
      createCourse(normalized);
      toast("固定课程已添加");
    }
    setCourseOpen(false);
  };

  const openActivity = (date = anchorDate) => {
    setChangeForm(emptyChange(date));
    setError("");
    setChangeOpen(true);
  };

  const saveChange = () => {
    if (!changeForm.title.trim() || !changeForm.date) {
      setError("请填写活动名称和日期。");
      return;
    }
    if (changeForm.endTime <= changeForm.startTime) {
      setError("结束时间需要晚于开始时间。");
      return;
    }
    const conflictedChange = data.courseChanges.find(
      (change) =>
        change.date === changeForm.date &&
        changeForm.startTime < change.endTime &&
        changeForm.endTime > change.startTime &&
        change.type !== "cancelled" &&
        changeForm.type !== "cancelled",
    );
    if (conflictedChange) {
      setError(`与临时安排“${conflictedChange.title}”时间冲突。`);
      return;
    }
    createCourseChange({
      ...changeForm,
      title: changeForm.title.trim(),
      location: changeForm.location?.trim(),
      note: changeForm.note?.trim(),
    });
    setChangeOpen(false);
    toast(
      changeForm.type === "cancelled"
        ? "停课记录已添加，固定课程数据未被修改"
        : changeForm.type === "rescheduled"
          ? "调课记录已添加，原课程仍保留"
          : "临时活动已添加",
    );
  };

  const shiftWeek = (amount: number) => {
    const next = new Date(weekMonday);
    next.setDate(next.getDate() + amount * 7);
    setAnchorDate(toDateKey(next));
  };

  const toggleWeekday = (weekday: number) => {
    setCourseForm((current) => ({
      ...current,
      weekdays: current.weekdays.includes(weekday)
        ? current.weekdays.filter((item) => item !== weekday)
        : [...current.weekdays, weekday].sort(),
    }));
  };

  return (
    <div className={`courses-page ${embedded ? "embedded-page" : "page"}`}>
      {!embedded ? (
        <PageHeader
          eyebrow="课程与时间"
          title="课程表"
          description="固定课程与临时变动分开保存，并参与真实空闲时间计算。"
          actions={
            <>
              <Button
                variant="secondary"
                icon={Activity}
                onClick={() => openActivity()}
              >
                添加临时活动
              </Button>
              <Button icon={Plus} onClick={() => openCourse()}>
                添加课程
              </Button>
            </>
          }
        />
      ) : null}

      <div className="course-toolbar">
        <div className="date-navigator">
          <IconButton
            icon={ChevronLeft}
            label="上一周"
            onClick={() => shiftWeek(-1)}
          />
          <button className="current-date-button" onClick={() => setAnchorDate(todayKey())}>
            第 {currentWeek} 周 · {formatShortDate(toDateKey(weekMonday))} 起
          </button>
          <IconButton
            icon={ChevronRight}
            label="下一周"
            onClick={() => shiftWeek(1)}
          />
          <Button
            size="sm"
            variant="text"
            onClick={() => setAnchorDate(todayKey())}
          >
            本周
          </Button>
        </div>
        <div className="course-toolbar-actions">
          <Button
            size="sm"
            variant="secondary"
            icon={Activity}
            onClick={() => openActivity()}
          >
            临时活动
          </Button>
          <Button size="sm" icon={Plus} onClick={() => openCourse()}>
            添加课程
          </Button>
        </div>
      </div>

      <div className="course-layout">
        <section className="panel course-week">
          <div className="course-week-head">
            <div>
              <span className="section-kicker">周课程表</span>
              <h2>第 {currentWeek} 周</h2>
            </div>
            <span>
              学期共 {data.settings.totalWeeks} 周 · 起始{" "}
              {formatShortDate(data.settings.semesterStart)}
            </span>
          </div>
          <div className="course-week-grid">
            {weekDays.map((date, index) => {
              const key = toDateKey(date);
              const occurrences = occurrencesForDate(
                key,
                data.courses,
                data.courseChanges,
                data.settings,
              );
              return (
                <div
                  className={`course-day-column ${key === todayKey() ? "today" : ""}`}
                  key={key}
                >
                  <button
                    className="course-day-head"
                    onClick={() => setAnchorDate(key)}
                  >
                    <span>周{"一二三四五六日"[index]}</span>
                    <strong>{date.getDate()}</strong>
                  </button>
                  <div className="course-day-items">
                    {occurrences.map((occurrence) => (
                      <article
                        className={`course-card focus-${occurrence.focusLevel} kind-${occurrence.kind}`}
                        key={occurrence.id}
                      >
                        <span className="course-time">
                          {occurrence.startTime} - {occurrence.endTime}
                        </span>
                        <strong>{occurrence.title}</strong>
                        <small>
                          <MapPin size={11} /> {occurrence.location || "地点待定"}
                        </small>
                        <em>{focusLabels[occurrence.focusLevel]}</em>
                        {occurrence.kind !== "course" ? (
                          <span className="change-label">
                            {occurrence.kind === "activity"
                              ? "临时活动"
                              : "调课"}
                          </span>
                        ) : null}
                      </article>
                    ))}
                    <button
                      className="course-add-inline"
                      onClick={() => {
                        setAnchorDate(key);
                        openActivity(key);
                      }}
                    >
                      <Plus size={13} /> 活动
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="course-side">
          <section className="panel course-day-detail">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">当天安排</span>
                <h2>{formatShortDate(anchorDate)}</h2>
              </div>
              <CalendarClock size={18} />
            </div>
            <div className="course-detail-list">
              {dayOccurrences.map((occurrence) => (
                <article key={occurrence.id}>
                  <div>
                    <strong>{occurrence.title}</strong>
                    <span>
                      {occurrence.startTime} - {occurrence.endTime}
                    </span>
                  </div>
                  <div className="course-detail-meta">
                    {occurrence.teacher ? (
                      <span>
                        <UserRound size={12} /> {occurrence.teacher}
                      </span>
                    ) : null}
                    <span>{focusLabels[occurrence.focusLevel]}</span>
                  </div>
                  {occurrence.courseId && occurrence.kind === "course" ? (
                    <div className="course-detail-actions">
                      <button
                        onClick={() => {
                          setChangeForm({
                            ...emptyChange(anchorDate),
                            courseId: occurrence.courseId,
                            originalDate: anchorDate,
                            type: "rescheduled",
                            title: occurrence.title,
                            startTime: occurrence.startTime,
                            endTime: occurrence.endTime,
                            location: occurrence.location,
                          });
                          setError("");
                          setChangeOpen(true);
                        }}
                      >
                        <RotateCcw size={13} /> 调课
                      </button>
                      <button
                        onClick={() => {
                          createCourseChange({
                            courseId: occurrence.courseId,
                            originalDate: anchorDate,
                            type: "cancelled",
                            title: occurrence.title,
                            date: anchorDate,
                            startTime: occurrence.startTime,
                            endTime: occurrence.endTime,
                            location: occurrence.location,
                            focusLevel: occurrence.focusLevel,
                          });
                          toast("已记录临时停课");
                        }}
                      >
                        停课
                      </button>
                    </div>
                  ) : null}
                  {occurrence.changeId ? (
                    <IconButton
                      icon={Trash2}
                      label="删除临时变动"
                      onClick={() => {
                        const change = data.courseChanges.find(
                          (item) => item.id === occurrence.changeId,
                        );
                        if (change) setDeleteChangeTarget(change);
                      }}
                    />
                  ) : null}
                </article>
              ))}
              {!dayOccurrences.length ? (
                <EmptyState
                  icon={Clock3}
                  title="当天没有课程"
                  description="可以添加临时活动，或把完整时间留给任务。"
                />
              ) : null}
            </div>
          </section>

          <section className="panel course-list-panel">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">固定课程</span>
                <h2>{data.courses.length} 门课程</h2>
              </div>
              <IconButton
                icon={Plus}
                label="添加课程"
                onClick={() => openCourse()}
              />
            </div>
            <div className="fixed-course-list">
              {data.courses.map((course) => (
                <article key={course.id}>
                  <span className={`focus-dot focus-${course.focusLevel}`} />
                  <div>
                    <strong>{course.title}</strong>
                    <small>
                      周{course.weekdays.join("、")} · {formatWeeks(course.weeks)} 周
                    </small>
                  </div>
                  <IconButton
                    icon={Edit3}
                    label={`编辑${course.title}`}
                    onClick={() => openCourse(course)}
                  />
                  <IconButton
                    icon={Trash2}
                    label={`删除${course.title}`}
                    onClick={() => setDeleteCourseTarget(course)}
                  />
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <Modal
        open={courseOpen}
        title={editingCourse ? "编辑课程" : "添加固定课程"}
        description="固定课程会按周次重复出现，临时变动不会覆盖这里的数据。"
        onClose={() => setCourseOpen(false)}
        width="680px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCourseOpen(false)}>
              取消
            </Button>
            <Button onClick={saveCourse}>
              {editingCourse ? "保存修改" : "添加课程"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="课程名称" required className="span-2">
            <input
              value={courseForm.title}
              onChange={(event) =>
                setCourseForm({ ...courseForm, title: event.target.value })
              }
            />
          </Field>
          <Field label="上课时间" required>
            <input
              type="time"
              value={courseForm.startTime}
              onChange={(event) =>
                setCourseForm({
                  ...courseForm,
                  startTime: event.target.value,
                })
              }
            />
          </Field>
          <Field label="下课时间" required>
            <input
              type="time"
              value={courseForm.endTime}
              onChange={(event) =>
                setCourseForm({
                  ...courseForm,
                  endTime: event.target.value,
                })
              }
            />
          </Field>
          <Field label="上课地点" required>
            <input
              value={courseForm.location}
              onChange={(event) =>
                setCourseForm({ ...courseForm, location: event.target.value })
              }
            />
          </Field>
          <Field label="任课教师" hint="可选">
            <input
              value={courseForm.teacher || ""}
              onChange={(event) =>
                setCourseForm({ ...courseForm, teacher: event.target.value })
              }
            />
          </Field>
          <Field label="上课星期" required className="span-2">
            <div className="weekday-picker">
              {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                <button
                  type="button"
                  key={weekday}
                  className={
                    courseForm.weekdays.includes(weekday) ? "active" : ""
                  }
                  onClick={() => toggleWeekday(weekday)}
                >
                  周{"一二三四五六日"[weekday - 1]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="上课周次" hint="例如 1-8,10,12-16" className="span-2">
            <input
              value={weeksText}
              onChange={(event) => setWeeksText(event.target.value)}
            />
          </Field>
          <Field label="课堂专注属性" className="span-2">
            <Tabs
              value={courseForm.focusLevel}
              onChange={(focusLevel) =>
                setCourseForm({ ...courseForm, focusLevel })
              }
              options={[
                { value: "must", label: "必须专心" },
                { value: "light", label: "轻度空闲" },
                { value: "flexible", label: "相对空闲" },
              ]}
            />
          </Field>
          {courseForm.focusLevel !== "must" ? (
            <div className="course-water-settings span-2">
              <div className="course-water-heading">
                <div>
                  <strong>课堂可利用时间</strong>
                  <p>额度是整节课的总上限，不代表一段连续空闲时间。</p>
                </div>
                <span>{courseForm.availableMinutes} 分钟</span>
              </div>
              <div className="form-grid">
                <Field label="可利用总分钟数">
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={courseForm.availableMinutes}
                    onChange={(event) =>
                      setCourseForm({
                        ...courseForm,
                        availableMinutes: Math.max(
                          0,
                          Number(event.target.value),
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="安排模式">
                  <select
                    value={courseForm.arrangementMode}
                    onChange={(event) =>
                      setCourseForm({
                        ...courseForm,
                        arrangementMode: event.target
                          .value as CourseInput["arrangementMode"],
                      })
                    }
                  >
                    <option value="auto">自动建议（本地规则）</option>
                    <option value="manual">手动指定时段</option>
                    <option value="hybrid">混合模式</option>
                  </select>
                </Field>
                <Field label="允许安排的任务类型" className="span-2">
                  <div className="task-scene-picker">
                    {[
                      ["light", "轻量任务"],
                      ["normal", "普通任务"],
                      ["deep", "深度任务"],
                    ].map(([value, label]) => (
                      <label key={value}>
                        <input
                          type="checkbox"
                          checked={courseForm.allowedTaskFocus.includes(
                            value as "light" | "normal" | "deep",
                          )}
                          onChange={(event) =>
                            setCourseForm({
                              ...courseForm,
                              allowedTaskFocus: event.target.checked
                                ? [
                                    ...courseForm.allowedTaskFocus,
                                    value as "light" | "normal" | "deep",
                                  ]
                                : courseForm.allowedTaskFocus.filter(
                                    (item) => item !== value,
                                  ),
                            })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </Field>
                <label className="settings-checkbox span-2">
                  <input
                    type="checkbox"
                    checked={courseForm.avoidStartEnd}
                    onChange={(event) =>
                      setCourseForm({
                        ...courseForm,
                        avoidStartEnd: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>自动候选尽量避开课程开始和结束阶段</strong>
                    <small>
                      系统会保留前后缓冲；这仍是建议，不表示课堂中已确认真实空闲。
                    </small>
                  </span>
                </label>
              </div>
              {courseForm.arrangementMode !== "auto" ? (
                <div className="course-window-editor">
                  <div>
                    <strong>具体可利用时段</strong>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      icon={Plus}
                      onClick={() =>
                        setCourseForm({
                          ...courseForm,
                          availableWindows: [
                            ...courseForm.availableWindows,
                            {
                              id: `window-${Date.now()}`,
                              startTime: courseForm.startTime,
                              endTime: courseForm.startTime,
                            },
                          ],
                        })
                      }
                    >
                      添加时段
                    </Button>
                  </div>
                  {courseForm.availableWindows.map((window) => (
                    <div className="course-window-row" key={window.id}>
                      <input
                        type="time"
                        value={window.startTime}
                        onChange={(event) =>
                          setCourseForm({
                            ...courseForm,
                            availableWindows: courseForm.availableWindows.map(
                              (item) =>
                                item.id === window.id
                                  ? {
                                      ...item,
                                      startTime: event.target.value,
                                    }
                                  : item,
                            ),
                          })
                        }
                      />
                      <span>至</span>
                      <input
                        type="time"
                        value={window.endTime}
                        onChange={(event) =>
                          setCourseForm({
                            ...courseForm,
                            availableWindows: courseForm.availableWindows.map(
                              (item) =>
                                item.id === window.id
                                  ? {
                                      ...item,
                                      endTime: event.target.value,
                                    }
                                  : item,
                            ),
                          })
                        }
                      />
                      <IconButton
                        icon={Trash2}
                        label="删除可利用时段"
                        onClick={() =>
                          setCourseForm({
                            ...courseForm,
                            availableWindows:
                              courseForm.availableWindows.filter(
                                (item) => item.id !== window.id,
                              ),
                          })
                        }
                      />
                    </div>
                  ))}
                  {!courseForm.availableWindows.length ? (
                    <p className="small-empty">
                      尚未指定具体时段。手动模式必须至少添加一个时段。
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <Field label="课程备注" className="span-2">
            <textarea
              rows={3}
              value={courseForm.note || ""}
              onChange={(event) =>
                setCourseForm({ ...courseForm, note: event.target.value })
              }
            />
          </Field>
          {error ? <p className="form-error span-2">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        open={changeOpen}
        title="添加临时变动"
        description="临时安排单独保存，原始固定课程不会被删除或覆盖。"
        onClose={() => setChangeOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setChangeOpen(false)}>
              取消
            </Button>
            <Button onClick={saveChange}>保存临时变动</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="变动类型" className="span-2">
            <Tabs
              value={changeForm.type}
              onChange={(type) => setChangeForm({ ...changeForm, type })}
              options={[
                { value: "rescheduled", label: "调课" },
                { value: "cancelled", label: "停课" },
                { value: "activity", label: "临时活动" },
              ]}
            />
          </Field>
          <Field label="名称" required className="span-2">
            <input
              value={changeForm.title}
              onChange={(event) =>
                setChangeForm({ ...changeForm, title: event.target.value })
              }
            />
          </Field>
          <Field label={changeForm.type === "cancelled" ? "停课日期" : "新日期"} required>
            <input
              type="date"
              value={changeForm.date}
              onChange={(event) =>
                setChangeForm({ ...changeForm, date: event.target.value })
              }
            />
          </Field>
          <Field label="地点">
            <input
              value={changeForm.location || ""}
              onChange={(event) =>
                setChangeForm({ ...changeForm, location: event.target.value })
              }
            />
          </Field>
          <Field label="开始时间">
            <input
              type="time"
              value={changeForm.startTime}
              onChange={(event) =>
                setChangeForm({
                  ...changeForm,
                  startTime: event.target.value,
                })
              }
            />
          </Field>
          <Field label="结束时间">
            <input
              type="time"
              value={changeForm.endTime}
              onChange={(event) =>
                setChangeForm({ ...changeForm, endTime: event.target.value })
              }
            />
          </Field>
          <Field label="专注属性">
            <select
              value={changeForm.focusLevel}
              onChange={(event) =>
                setChangeForm({
                  ...changeForm,
                  focusLevel: event.target.value as CourseFocusLevel,
                })
              }
            >
              <option value="must">必须专心</option>
              <option value="light">轻度空闲</option>
              <option value="flexible">相对空闲</option>
            </select>
          </Field>
          <Field label="备注">
            <input
              value={changeForm.note || ""}
              onChange={(event) =>
                setChangeForm({ ...changeForm, note: event.target.value })
              }
            />
          </Field>
          {error ? <p className="form-error span-2">{error}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteCourseTarget)}
        description={`删除“${deleteCourseTarget?.title || ""}”会同时移除它的临时变动，但不会删除普通日程。`}
        onCancel={() => setDeleteCourseTarget(undefined)}
        onConfirm={() => {
          if (deleteCourseTarget) deleteCourse(deleteCourseTarget.id);
          setDeleteCourseTarget(undefined);
          toast("课程已删除");
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteChangeTarget)}
        description="删除后，原固定课程会恢复按正常规则显示。"
        onCancel={() => setDeleteChangeTarget(undefined)}
        onConfirm={() => {
          if (deleteChangeTarget) deleteCourseChange(deleteChangeTarget.id);
          setDeleteChangeTarget(undefined);
          toast("临时变动已删除");
        }}
      />
    </div>
  );
}
