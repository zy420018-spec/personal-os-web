import {
  Bot,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Schedule } from "../types";
import { useStore } from "../store";
import {
  dateAt,
  formatShortDate,
  monthGrid,
  pad,
  startOfWeek,
  toDateKey,
  todayKey,
} from "../date";
import {
  Button,
  ConfirmDialog,
  Field,
  IconButton,
  Modal,
  PageHeader,
  SimulatedTag,
  Tabs,
  useToast,
} from "../components/ui";
import { occurrencesForDate } from "../course";

type ViewMode = "day" | "week" | "month";

const emptySchedule = (date: string): Omit<Schedule, "id"> => ({
  title: "",
  date,
  start: "09:00",
  end: "10:00",
  taskId: "",
  note: "",
});

const dayNames = ["一", "二", "三", "四", "五", "六", "日"];

const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

export function SchedulePage({
  embedded = false,
  onOpenPlanner,
}: {
  embedded?: boolean;
  onOpenPlanner?: () => void;
} = {}) {
  const {
    data,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  } = useStore();
  const toast = useToast();
  const [view, setView] = useState<ViewMode>("day");
  const [dateKey, setDateKey] = useState(todayKey());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | undefined>();
  const [form, setForm] = useState<Omit<Schedule, "id">>(
    emptySchedule(todayKey()),
  );
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const selectedDate = new Date(`${dateKey}T12:00:00`);
  const displayDate = useMemo(() => {
    if (view === "month") {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
      }).format(selectedDate);
    }
    if (view === "week") {
      const start = startOfWeek(selectedDate);
      const end = addDays(start, 6);
      return `${formatShortDate(toDateKey(start))} - ${formatShortDate(toDateKey(end))}`;
    }
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(selectedDate);
  }, [dateKey, view]);

  const openCreate = (date = dateKey, start = "09:00") => {
    setEditing(undefined);
    setForm({
      ...emptySchedule(date),
      start,
      end: `${pad(Math.min(23, Number(start.slice(0, 2)) + 1))}:${start.slice(3)}`,
    });
    setError("");
    setEditorOpen(true);
  };

  const openEdit = (schedule: Schedule) => {
    setEditing(schedule);
    setForm({ ...schedule });
    setError("");
    setEditorOpen(true);
  };

  const submit = () => {
    if (!form.title.trim()) {
      setError("请填写日程名称。");
      return;
    }
    if (!form.date || !form.start || !form.end) {
      setError("请填写日期和开始、结束时间。");
      return;
    }
    if (form.end <= form.start) {
      setError("结束时间需要晚于开始时间。");
      return;
    }
    const overlaps = (startA: string, endA: string, startB: string, endB: string) =>
      startA < endB && endA > startB;
    const scheduleConflict = data.schedules.find(
      (schedule) =>
        schedule.id !== editing?.id &&
        schedule.date === form.date &&
        overlaps(
          form.start,
          form.end,
          schedule.start,
          schedule.end,
        ),
    );
    if (scheduleConflict) {
      setError(`与已有日程“${scheduleConflict.title}”时间重叠。`);
      return;
    }
    const courseConflict = occurrencesForDate(
      form.date,
      data.courses,
      data.courseChanges,
      data.settings,
    ).find(
      (course) =>
        course.focusLevel === "must" &&
        overlaps(
          form.start,
          form.end,
          course.startTime,
          course.endTime,
        ),
    );
    if (courseConflict) {
      setError(`与必须专心的课程“${courseConflict.title}”时间冲突。`);
      return;
    }
    const normalized = {
      ...form,
      title: form.title.trim(),
      taskId: form.taskId || undefined,
      note: form.note?.trim(),
    };
    if (editing) {
      updateSchedule({ ...editing, ...normalized });
      toast("日程已更新");
    } else {
      createSchedule(normalized);
      toast("日程已创建，任务仍保持原状态");
    }
    setEditorOpen(false);
  };

  const shiftDate = (direction: number) => {
    const current = new Date(`${dateKey}T12:00:00`);
    const amount = view === "day" ? direction : view === "week" ? direction * 7 : direction;
    if (view === "month") {
      current.setMonth(current.getMonth() + amount);
    } else {
      current.setDate(current.getDate() + amount);
    }
    setDateKey(toDateKey(current));
  };

  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const visibleMonthDays = monthGrid(selectedDate);
  const daySchedules = data.schedules
    .filter((item) => item.date === dateKey)
    .sort((a, b) => a.start.localeCompare(b.start));
  const pendingTasks = data.tasks.filter(
    (task) =>
      !["done", "abandoned"].includes(task.status) &&
      !data.schedules.some(
        (schedule) =>
          schedule.taskId === task.id && schedule.date >= todayKey(),
      ),
  );
  const occupiedMinutes = daySchedules.reduce((total, item) => {
    const [sh, sm] = item.start.split(":").map(Number);
    const [eh, em] = item.end.split(":").map(Number);
    return total + Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }, 0);

  const scheduleForm = (
    <div className="form-grid">
      <Field label="日程名称" required className="span-2">
        <input
          value={form.title}
          onChange={(event) =>
            setForm({ ...form, title: event.target.value })
          }
          placeholder="这段时间准备完成什么？"
        />
      </Field>
      <Field label="关联任务">
        <select
          value={form.taskId || ""}
          onChange={(event) => {
            const taskId = event.target.value || undefined;
            const task = data.tasks.find((item) => item.id === taskId);
            setForm({
              ...form,
              taskId,
              title: form.title || task?.title || "",
              end:
                task && !editing
                  ? `${pad(
                      Math.min(
                        23,
                        Number(form.start.slice(0, 2)) +
                          Math.ceil(task.estimate / 60),
                      ),
                    )}:${form.start.slice(3)}`
                  : form.end,
            });
          }}
        >
          <option value="">不关联任务</option>
          {data.tasks
            .filter((task) => task.status !== "abandoned")
            .map((task) => (
              <option value={task.id} key={task.id}>
                {task.title}
              </option>
            ))}
        </select>
      </Field>
      <Field label="日期" required>
        <input
          type="date"
          value={form.date}
          onChange={(event) => setForm({ ...form, date: event.target.value })}
        />
      </Field>
      <Field label="开始时间" required>
        <input
          type="time"
          value={form.start}
          onChange={(event) =>
            setForm({ ...form, start: event.target.value })
          }
        />
      </Field>
      <Field label="结束时间" required>
        <input
          type="time"
          value={form.end}
          onChange={(event) => setForm({ ...form, end: event.target.value })}
        />
      </Field>
      <Field label="备注" className="span-2">
        <textarea
          rows={3}
          value={form.note || ""}
          onChange={(event) => setForm({ ...form, note: event.target.value })}
          placeholder="地点、准备材料或其他说明"
        />
      </Field>
      {error ? <p className="form-error span-2">{error}</p> : null}
    </div>
  );

  return (
    <div className={`${embedded ? "embedded-page" : "page"} schedule-page`}>
      {!embedded ? (
        <PageHeader
          eyebrow="时间规划"
          title="日程"
          description="给任务预留时间，实际执行会单独记录。"
          actions={
            <Button icon={CalendarPlus} onClick={() => openCreate()}>
              新建日程
            </Button>
          }
        />
      ) : null}

      <div className="schedule-toolbar">
        <div className="date-navigator">
          <IconButton
            icon={ChevronLeft}
            label="上一个时间段"
            onClick={() => shiftDate(-1)}
          />
          <button
            className="current-date-button"
            onClick={() => setDateKey(todayKey())}
          >
            {displayDate}
          </button>
          <IconButton
            icon={ChevronRight}
            label="下一个时间段"
            onClick={() => shiftDate(1)}
          />
          <Button
            size="sm"
            variant="text"
            onClick={() => setDateKey(todayKey())}
          >
            今天
          </Button>
        </div>
        <Tabs
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: "日" },
            { value: "week", label: "周" },
            { value: "month", label: "月" },
          ]}
        />
      </div>

      <div className="schedule-layout">
        <section className="panel calendar-panel">
          {view === "day" ? (
            <>
              <div className="calendar-day-heading">
                <div>
                  <span>{new Date(`${dateKey}T12:00:00`).getDate()}</span>
                  <div>
                    <strong>
                      {
                        ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][
                          new Date(`${dateKey}T12:00:00`).getDay()
                        ]
                      }
                    </strong>
                    <small>{dateKey === todayKey() ? "今天" : "日程视图"}</small>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={() => openCreate()}
                >
                  添加时间块
                </Button>
              </div>
              <div className="day-timeline">
                {Array.from({ length: 12 }, (_, index) => index + 8).map(
                  (hour) => {
                    const time = `${pad(hour)}:00`;
                    const items = daySchedules.filter(
                      (item) =>
                        Number(item.start.slice(0, 2)) === hour ||
                        (Number(item.start.slice(0, 2)) < hour &&
                          Number(item.end.slice(0, 2)) > hour),
                    );
                    return (
                      <div className="time-slot" key={hour}>
                        <button
                          className="time-label"
                          onClick={() => openCreate(dateKey, time)}
                        >
                          {time}
                        </button>
                        <div className="time-content">
                          {items.map((item) => {
                            const task = data.tasks.find(
                              (entry) => entry.id === item.taskId,
                            );
                            return (
                              <article
                                className={`schedule-block ${task?.status === "done" ? "done" : ""}`}
                                key={item.id}
                              >
                                <div>
                                  <span>
                                    {item.start} - {item.end}
                                  </span>
                                  <strong>{item.title}</strong>
                                  <small>
                                    {task
                                      ? `${task.estimate} 分钟预计 · ${task.status === "done" ? "已完成" : "待执行"}`
                                      : item.note || "个人日程"}
                                  </small>
                                </div>
                                <div className="schedule-block-actions">
                                  <IconButton
                                    icon={Edit3}
                                    label="编辑日程"
                                    onClick={() => openEdit(item)}
                                  />
                                  <IconButton
                                    icon={Trash2}
                                    label="删除日程"
                                    onClick={() => setDeleteId(item.id)}
                                  />
                                </div>
                              </article>
                            );
                          })}
                          <button
                            className="add-inline"
                            onClick={() => openCreate(dateKey, time)}
                          >
                            <Plus size={13} /> 添加
                          </button>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </>
          ) : null}

          {view === "week" ? (
            <div className="week-calendar">
              {weekDays.map((date, index) => {
                const key = toDateKey(date);
                const items = data.schedules
                  .filter((item) => item.date === key)
                  .sort((a, b) => a.start.localeCompare(b.start));
                return (
                  <div
                    className={`week-column ${key === todayKey() ? "today" : ""}`}
                    key={key}
                  >
                    <button
                      className="week-day-head"
                      onClick={() => {
                        setDateKey(key);
                        setView("day");
                      }}
                    >
                      <span>周{dayNames[index]}</span>
                      <strong>{date.getDate()}</strong>
                    </button>
                    <div className="week-column-items">
                      {items.map((item) => (
                        <button
                          className="week-event"
                          key={item.id}
                          onClick={() => openEdit(item)}
                        >
                          <span>{item.start}</span>
                          <strong>{item.title}</strong>
                        </button>
                      ))}
                      <button
                        className="week-add"
                        onClick={() => openCreate(key)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {view === "month" ? (
            <div className="month-calendar">
              <div className="month-weekdays">
                {dayNames.map((day) => (
                  <span key={day}>周{day}</span>
                ))}
              </div>
              <div className="month-grid">
                {visibleMonthDays.map((date) => {
                  const key = toDateKey(date);
                  const items = data.schedules.filter(
                    (item) => item.date === key,
                  );
                  return (
                    <button
                      className={`month-cell ${date.getMonth() !== selectedDate.getMonth() ? "outside" : ""} ${key === todayKey() ? "today" : ""}`}
                      key={key}
                      onClick={() => {
                        setDateKey(key);
                        if (!items.length) {
                          openCreate(key);
                        }
                      }}
                      onDoubleClick={() => {
                        setDateKey(key);
                        setView("day");
                      }}
                    >
                      <span>{date.getDate()}</span>
                      {items.slice(0, 3).map((item) => (
                        <small key={item.id}>
                          <i />
                          {item.start} {item.title}
                        </small>
                      ))}
                      {items.length > 3 ? (
                        <em>还有 {items.length - 3} 项</em>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="schedule-sidebar">
          <section className="panel smart-panel">
            <div className="panel-heading compact">
              <div>
                <h2>规划建议</h2>
              </div>
              <Bot size={19} />
            </div>
            <div className="plan-summary">
              <div>
                <Clock3 size={15} />
                <span>已安排</span>
                <strong>{occupiedMinutes} 分钟</strong>
              </div>
              <p>
                当前有 {daySchedules.length} 个时间块。
                {occupiedMinutes > 180
                  ? " 时间密度较高，建议保留 30 分钟缓冲。"
                  : " 可以在上午安排一个完整专注块。"}
              </p>
            </div>
            <div className="suggestion-card">
              <Sparkles size={16} />
              <div>
                <strong>从真实空闲时间生成安排</strong>
                <p>
                  {pendingTasks.length
                    ? `${pendingTasks.length} 项任务待安排，将同时检查课程与已有日程`
                    : "当前没有任务需要额外安排"}
                </p>
              </div>
              {pendingTasks.length && onOpenPlanner ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onOpenPlanner}
                >
                  开始排程
                </Button>
              ) : null}
            </div>
            <p className="simulation-disclaimer">
              使用可解释的本地时间规则，确认后才会写入日程。
            </p>
          </section>

          <section className="panel pending-panel">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">任务池</span>
                <h2>待安排任务</h2>
              </div>
              <span className="count-label">{pendingTasks.length}</span>
            </div>
            <div className="pending-list">
              {pendingTasks.slice(0, 5).map((task) => (
                <button
                  key={task.id}
                  onClick={() => {
                    setForm({
                      ...emptySchedule(dateKey),
                      title: task.title,
                      taskId: task.id,
                    });
                    setEditing(undefined);
                    setEditorOpen(true);
                  }}
                >
                  <span
                    className={`priority-dot priority-${task.priority}`}
                  />
                  <span>
                    <strong>{task.title}</strong>
                    <small>
                      {task.estimate} 分钟 · {formatShortDate(task.deadline)}
                    </small>
                  </span>
                  <Plus size={14} />
                </button>
              ))}
              {!pendingTasks.length ? (
                <p className="small-empty">所有开放任务都已进入日程。</p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <Modal
        open={editorOpen}
        title={editing ? "编辑日程" : "新建日程"}
        description="日程中的预计时间不会随实际执行自动变化。"
        onClose={() => setEditorOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button onClick={submit}>{editing ? "保存修改" : "创建日程"}</Button>
          </>
        }
      >
        {scheduleForm}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        description="删除这个日程不会删除关联任务。"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteSchedule(deleteId);
          setDeleteId(null);
          toast("日程已删除");
        }}
      />
    </div>
  );
}
