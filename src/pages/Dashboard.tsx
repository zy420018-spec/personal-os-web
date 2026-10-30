import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Play,
  Plus,
  Target,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PageId, Task } from "../types";
import { useStore } from "../store";
import {
  durationLabel,
  formatShortDate,
  isThisWeek,
  isToday,
  todayKey,
} from "../date";
import {
  Button,
  PageHeader,
  PriorityBadge,
  ProgressBar,
  SimulatedTag,
  StatusBadge,
} from "../components/ui";
import { TaskEditor } from "../components/TaskEditor";

export function DashboardPage({
  onNavigate,
}: {
  onNavigate: (page: PageId) => void;
}) {
  const { data } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();

  const todaySchedules = data.schedules
    .filter((item) => item.date === todayKey())
    .sort((a, b) => a.start.localeCompare(b.start));
  const todayTaskIds = new Set(
    todaySchedules.map((item) => item.taskId).filter(Boolean),
  );
  const openTasks = data.tasks
    .filter((task) => !["done", "abandoned"].includes(task.status))
    .sort((a, b) => {
      const priority = { urgent: 0, high: 1, medium: 2, low: 3 };
      if (a.deadline !== b.deadline) {
        return (a.deadline || "9999").localeCompare(b.deadline || "9999");
      }
      return priority[a.priority] - priority[b.priority];
    });
  const visibleTasks = expanded ? openTasks : openTasks.slice(0, 4);
  const todayCompleted = data.tasks.filter(
    (task) => task.status === "done" && isToday(task.deadline),
  ).length;
  const todayTotal = Math.max(
    todaySchedules.length,
    todaySchedules.length + openTasks.filter((task) => isToday(task.deadline)).length,
  );
  const todayPercent = todayTotal
    ? Math.round((todayCompleted / todayTotal) * 100)
    : 0;
  const weekDone = data.tasks.filter(
    (task) => task.status === "done" && isThisWeek(task.deadline),
  ).length;
  const weekOpen = data.tasks.filter(
    (task) =>
      !["done", "abandoned"].includes(task.status) &&
      isThisWeek(task.deadline),
  ).length;
  const weekPercent = weekDone + weekOpen
    ? Math.round((weekDone / (weekDone + weekOpen)) * 100)
    : 0;
  const focusToday = data.focusSessions
    .filter((session) => isToday(session.startedAt))
    .reduce((sum, session) => {
      if (!session.endedAt) return sum;
      return (
        sum +
        Math.max(
          0,
          (new Date(session.endedAt).getTime() -
            new Date(session.startedAt).getTime() -
            session.totalPausedMs) /
            60000,
        )
      );
    }, 0);

  const nextSchedule = todaySchedules.find(
    (schedule) =>
      data.tasks.find((task) => task.id === schedule.taskId)?.status !== "done",
  );
  const currentFocus = data.focusSessions.find(
    (session) => session.status === "active" || session.status === "paused",
  );
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return "早上好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }, []);

  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow="今天"
        title={`${greeting}，${data.settings.name}`}
        description={
          openTasks.length
            ? `还有 ${openTasks.length} 件事在推进，先完成最重要的一件。`
            : "当前没有未完成任务，可以留一点时间整理下一步。"
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={CalendarClock}
              onClick={() => onNavigate("schedule")}
            >
              查看日程
            </Button>
            <Button
              icon={Plus}
              onClick={() => {
                setSelectedTask(undefined);
                setTaskEditorOpen(true);
              }}
            >
              新任务
            </Button>
          </>
        }
      />

      <div className="dashboard-grid">
        <section className="panel dashboard-tasks">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">优先处理</span>
              <h2>我的事情</h2>
            </div>
            <span className="count-label">{openTasks.length} 项待完成</span>
          </div>
          <div className="task-list">
            {visibleTasks.map((task, index) => {
              const project = data.projects.find(
                (item) => item.id === task.projectId,
              );
              const overdue =
                task.deadline && task.deadline < todayKey()
                  ? true
                  : false;
              return (
                <button
                  className={`dashboard-task ${overdue ? "overdue" : ""}`}
                  key={task.id}
                  onClick={() => {
                    setSelectedTask(task);
                    setTaskEditorOpen(true);
                  }}
                >
                  <span
                    className={`task-index ${index === 0 ? "featured" : ""}`}
                  >
                    {index + 1}
                  </span>
                  <span className="dashboard-task-main">
                    <strong>{task.title}</strong>
                    <small>
                      <span>{project?.title || "独立任务"}</span>
                      <i />
                      <span>
                        {overdue ? "已逾期 · " : ""}
                        {formatShortDate(task.deadline)}
                      </span>
                    </small>
                  </span>
                  <span className="dashboard-task-side">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                  </span>
                  <ArrowRight size={16} className="row-arrow" />
                </button>
              );
            })}
            {!visibleTasks.length ? (
              <div className="inline-empty">
                <Check size={20} />
                <div>
                  <strong>所有任务都处理好了</strong>
                  <p>可以把新的想法放进收集箱。</p>
                </div>
              </div>
            ) : null}
          </div>
          {openTasks.length > 4 ? (
            <button
              className="expand-button"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "收起" : `展开其余 ${openTasks.length - 4} 项`}
              <ChevronDown
                size={15}
                style={{ transform: expanded ? "rotate(180deg)" : "" }}
              />
            </button>
          ) : null}
        </section>

        <section className="panel today-schedule">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">时间轴</span>
              <h2>今日计划</h2>
            </div>
            <button
              className="text-action"
              onClick={() => onNavigate("schedule")}
            >
              打开日程 <ArrowRight size={14} />
            </button>
          </div>
          <div className="timeline">
            {todaySchedules.length ? (
              todaySchedules.map((schedule) => {
                const task = data.tasks.find(
                  (item) => item.id === schedule.taskId,
                );
                return (
                  <button
                    className="timeline-row"
                    key={schedule.id}
                    onClick={() => {
                      if (task) {
                        setSelectedTask(task);
                        setTaskEditorOpen(true);
                      } else {
                        onNavigate("schedule");
                      }
                    }}
                  >
                    <span className="timeline-time">
                      <strong>{schedule.start}</strong>
                      <small>{schedule.end}</small>
                    </span>
                    <span
                      className={`timeline-dot ${task?.status === "done" ? "done" : ""}`}
                    />
                    <span className="timeline-content">
                      <strong>{schedule.title}</strong>
                      <small>
                        {task ? durationLabel(task.estimate) : "未关联任务"}
                      </small>
                    </span>
                    {task ? <StatusBadge status={task.status} /> : null}
                  </button>
                );
              })
            ) : (
              <div className="timeline-empty">
                <CalendarClock size={22} />
                <p>今天还没有安排，给重要的事留一个时间块。</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigate("schedule")}
                >
                  安排日程
                </Button>
              </div>
            )}
          </div>
          {nextSchedule ? (
            <div className="next-up">
              <span>
                <Zap size={14} /> 接下来
              </span>
              <strong>{nextSchedule.title}</strong>
              <small>
                {nextSchedule.start} ·{" "}
                {data.projects.find(
                  (project) =>
                    project.id ===
                    data.tasks.find(
                      (task) => task.id === nextSchedule.taskId,
                    )?.projectId,
                )?.title || "独立任务"}
              </small>
              <Button
                size="sm"
                icon={currentFocus ? Zap : Play}
                onClick={() => onNavigate("focus")}
              >
                {currentFocus ? "继续专注" : "开始专注"}
              </Button>
            </div>
          ) : null}
        </section>

        <section className="panel progress-panel">
          <div className="panel-heading compact">
            <div>
              <span className="section-kicker">节奏</span>
              <h2>今日进度</h2>
            </div>
            <span className="metric-highlight">
              {todayPercent}
              <small>%</small>
            </span>
          </div>
          <ProgressBar value={todayPercent} />
          <div className="metric-pair">
            <div>
              <span>
                <Check size={15} /> 已完成
              </span>
              <strong>{todayCompleted}</strong>
            </div>
            <div>
              <span>
                <CircleDot size={15} /> 待处理
              </span>
              <strong>{Math.max(0, todayTotal - todayCompleted)}</strong>
            </div>
          </div>
          <div className="focus-stat">
            <Clock3 size={16} />
            <span>今日专注</span>
            <strong>{durationLabel(Math.round(focusToday))}</strong>
          </div>
        </section>

        <section className="panel week-panel">
          <div className="panel-heading compact">
            <div>
              <span className="section-kicker">本周</span>
              <h2>整体推进</h2>
            </div>
            <Target size={20} className="muted-icon" />
          </div>
          <div className="week-numbers">
            <div>
              <strong>{weekDone}</strong>
              <span>已完成</span>
            </div>
            <div>
              <strong>{weekOpen}</strong>
              <span>进行中</span>
            </div>
          </div>
          <div className="week-progress-copy">
            <span>完成率</span>
            <strong>{weekPercent}%</strong>
          </div>
          <ProgressBar value={weekPercent} color="orange" />
          <div className="week-footer">
            <span>计划 {todaySchedules.length} 个时间块</span>
            <SimulatedTag label="AI 建议" />
          </div>
        </section>
      </div>

      <TaskEditor
        open={taskEditorOpen}
        onClose={() => {
          setTaskEditorOpen(false);
          setSelectedTask(undefined);
        }}
        task={selectedTask}
      />
    </div>
  );
}
