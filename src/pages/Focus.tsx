import {
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  FileText,
  History,
  Paperclip,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
  Square,
  Timer,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FocusSession, PageId, TaskStatus } from "../types";
import { useStore } from "../store";
import {
  durationLabel,
  formatDateTime,
  secondsToClock,
  time,
  todayKey,
} from "../date";
import {
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  ProgressBar,
  StatusBadge,
  useToast,
} from "../components/ui";
import { saveEvidenceFile } from "../storage/files";

export function FocusPage({
  onNavigate,
}: {
  onNavigate: (page: PageId) => void;
}) {
  const {
    data,
    createTask,
    createEvidence,
    saveFocusSession,
    updateTask,
  } = useStore();
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [endOpen, setEndOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [completion, setCompletion] =
    useState<"done" | "partial" | "todo">("partial");
  const [distraction, setDistraction] = useState("");
  const [remainingWork, setRemainingWork] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [savingEnd, setSavingEnd] = useState(false);
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const [cooldownReason, setCooldownReason] = useState("");
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [error, setError] = useState("");

  const activeSession = data.focusSessions.find(
    (session) => session.status === "active" || session.status === "paused",
  );
  const activeTask = data.tasks.find(
    (task) => task.id === activeSession?.taskId,
  );
  const activeProject = data.projects.find(
    (project) => project.id === activeTask?.projectId,
  );
  const openTasks = data.tasks.filter(
    (task) => !["done", "abandoned"].includes(task.status),
  );
  const todaySchedules = data.schedules
    .filter((schedule) => schedule.date === todayKey())
    .sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = todaySchedules
    .map((schedule) => ({
      schedule,
      task: data.tasks.find((task) => task.id === schedule.taskId),
    }))
    .filter(
      (entry) =>
        entry.task &&
        !["done", "abandoned"].includes(entry.task.status) &&
        entry.task.id !== activeTask?.id,
    );
  const endedSessions = data.focusSessions
    .filter((session) => session.status === "ended")
    .sort((a, b) =>
      (b.endedAt || "").localeCompare(a.endedAt || ""),
    );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!cooldownOpen || cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldownOpen, cooldown]);

  const elapsedSeconds = useMemo(() => {
    if (!activeSession) return 0;
    const endpoint =
      activeSession.status === "paused" && activeSession.pausedAt
        ? new Date(activeSession.pausedAt).getTime()
        : now;
    return Math.max(
      0,
      (endpoint -
        new Date(activeSession.startedAt).getTime() -
        activeSession.totalPausedMs) /
        1000,
    );
  }, [activeSession, now]);

  const startFocus = (taskId: string) => {
    if (!taskId) {
      setSelectionOpen(true);
      return;
    }
    if (activeSession) return;
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const session: FocusSession = {
      id: `focus-${Date.now()}`,
      taskId,
      startedAt: new Date().toISOString(),
      totalPausedMs: 0,
      status: "active",
    };
    saveFocusSession(session);
    if (task.status === "todo") {
      updateTask({ ...task, status: "doing" });
    }
    setSelectedTaskId(taskId);
    setSelectionOpen(false);
    toast(`已开始专注：${task.title}`);
  };

  const pause = () => {
    if (!activeSession) return;
    if (activeSession.status === "active") {
      saveFocusSession({
        ...activeSession,
        status: "paused",
        pausedAt: new Date().toISOString(),
      });
      toast("专注已暂停");
    } else {
      const pausedFor = activeSession.pausedAt
        ? Date.now() - new Date(activeSession.pausedAt).getTime()
        : 0;
      saveFocusSession({
        ...activeSession,
        status: "active",
        pausedAt: undefined,
        totalPausedMs: activeSession.totalPausedMs + pausedFor,
      });
      toast("继续专注");
    }
  };

  const openEnd = () => {
    setOutcome("");
    setDistraction("");
    setRemainingWork(activeTask?.remainingWork || "");
    setEvidenceFile(null);
    setCompletion("partial");
    setError("");
    setEndOpen(true);
  };

  const endSession = async () => {
    if (!activeSession || !activeTask || savingEnd) return;
    if (!outcome.trim()) {
      setError("请记录这次实际完成了什么。");
      return;
    }
    if (completion === "partial" && !remainingWork.trim()) {
      setError("部分完成时需要记录剩余工作。");
      return;
    }
    if (evidenceFile && evidenceFile.size > 25 * 1024 * 1024) {
      setError("单个成果文件不能超过 25 MB。");
      return;
    }
    setSavingEnd(true);
    setError("");
    const endedAt = new Date().toISOString();
    const totalPausedMs =
      activeSession.totalPausedMs +
      (activeSession.status === "paused" && activeSession.pausedAt
        ? new Date(endedAt).getTime() -
          new Date(activeSession.pausedAt).getTime()
        : 0);
    let fileInfo:
      | {
          fileId: string;
          fileName: string;
          mimeType: string;
          fileSize: number;
        }
      | undefined;
    try {
      if (evidenceFile) {
        fileInfo = await saveEvidenceFile(evidenceFile);
      }
      saveFocusSession({
        ...activeSession,
        status: "ended",
        endedAt,
        pausedAt: undefined,
        totalPausedMs,
        completion,
        outcome: outcome.trim(),
        distraction: distraction.trim(),
      });
      createEvidence({
        taskId: activeTask.id,
        projectId: activeTask.projectId,
        sessionId: activeSession.id,
        type: "text",
        title: `${activeTask.title} · 执行成果`,
        content: outcome.trim(),
      });
      if (evidenceFile && fileInfo) {
        createEvidence({
          taskId: activeTask.id,
          projectId: activeTask.projectId,
          sessionId: activeSession.id,
          type: evidenceFile.type.startsWith("image/") ? "image" : "file",
          title: evidenceFile.name,
          content: "专注结束时提交的成果材料。",
          ...fileInfo,
        });
      }
    } catch (saveError) {
      setSavingEnd(false);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "成果文件保存失败，请重试。",
      );
      return;
    }
    updateTask({
      ...activeTask,
      remainingWork:
        completion === "partial" ? remainingWork.trim() : "",
      status:
        completion === "done"
          ? "done"
          : completion === "partial"
            ? "partial"
            : "doing",
    });
    setEndOpen(false);
    setSavingEnd(false);
    toast("执行记录和成果已保存，任务状态已同步");
  };

  const todayMinutes = endedSessions
    .filter((session) => session.startedAt.slice(0, 10) === todayKey())
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
  const sessionProgress = activeTask
    ? Math.min(100, (elapsedSeconds / (activeTask.estimate * 60)) * 100)
    : 0;

  return (
    <div className="page focus-page">
      <PageHeader
        eyebrow="专注执行"
        title="执行"
        description="让时间真实流动，结束时留下结果和证据。"
        actions={
          <div className="focus-today-stat">
            <Timer size={16} />
            <span>今日专注</span>
            <strong>{durationLabel(Math.round(todayMinutes))}</strong>
          </div>
        }
      />

      <div className="focus-layout">
        <section className={`focus-stage ${activeSession ? "active" : ""}`}>
          {activeSession && activeTask ? (
            <>
              <div className="focus-status">
                <span className="live-dot" />
                {activeSession.status === "paused" ? "已暂停" : "正在专注"}
                <span className="focus-project">
                  {activeProject?.title || "独立任务"}
                </span>
              </div>
              <h2>{activeTask.title}</h2>
              <p>{activeTask.description || "专注完成这一件事。"}</p>
              <div className="focus-clock-wrap">
                <div
                  className="focus-ring"
                  style={
                    {
                      "--focus-progress": `${Math.min(100, sessionProgress)}%`,
                    } as React.CSSProperties
                  }
                >
                  <div>
                    <span>{secondsToClock(elapsedSeconds)}</span>
                    <small>
                      预计 {durationLabel(activeTask.estimate)}
                    </small>
                  </div>
                </div>
              </div>
              <div className="focus-progress-label">
                <span>
                  实际已投入{" "}
                  <strong>{durationLabel(Math.floor(elapsedSeconds / 60))}</strong>
                </span>
                <span>
                  开始于 <strong>{time(activeSession.startedAt)}</strong>
                </span>
              </div>
              <ProgressBar value={sessionProgress} />
              <div className="focus-controls">
                <Button
                  variant="secondary"
                  icon={activeSession.status === "paused" ? Play : Pause}
                  onClick={pause}
                >
                  {activeSession.status === "paused" ? "继续" : "暂停"}
                </Button>
                <Button
                  variant="ghost"
                  icon={Coffee}
                  onClick={() => {
                    setCooldown(30);
                    setCooldownReason("");
                    setCooldownOpen(true);
                  }}
                >
                  暂时离开
                </Button>
                <Button variant="primary" icon={Square} onClick={openEnd}>
                  结束专注
                </Button>
              </div>
            </>
          ) : (
            <div className="focus-idle">
              <span className="idle-icon">
                <Zap size={30} />
              </span>
              <span className="section-kicker">准备开始</span>
              <h2>先选一件事，然后给它完整时间</h2>
              <p>专注计时采用正计时，不会被固定倒计时打断。</p>
              <div className="focus-task-options">
                {openTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => startFocus(task.id)}
                  >
                    <span
                      className={`priority-dot priority-${task.priority}`}
                    />
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        {data.projects.find(
                          (project) => project.id === task.projectId,
                        )?.title || "独立任务"}{" "}
                        · {durationLabel(task.estimate)}
                      </small>
                    </span>
                    <PlayCircle size={20} />
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                icon={Play}
                onClick={() => setSelectionOpen(true)}
              >
                从全部任务中选择
              </Button>
            </div>
          )}
        </section>

        <aside className="focus-side">
          <section className="panel upcoming-focus">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">接下来</span>
                <h2>等待执行</h2>
              </div>
              <span className="count-label">{upcoming.length}</span>
            </div>
            <div className="upcoming-list">
              {upcoming.map(({ schedule, task }) => (
                <div key={schedule.id}>
                  <span className="upcoming-time">{schedule.start}</span>
                  <div>
                    <strong>{task?.title}</strong>
                    <small>
                      {durationLabel(task?.estimate || 0)} ·{" "}
                      {schedule.end} 结束
                    </small>
                  </div>
                  <button
                    onClick={() => startFocus(task!.id)}
                    disabled={Boolean(activeSession)}
                    aria-label={`开始${task?.title}`}
                    title={activeSession ? "请先结束当前专注" : "开始专注"}
                  >
                    <Play size={14} />
                  </button>
                </div>
              ))}
              {!upcoming.length ? (
                <p className="small-empty">
                  {todaySchedules.length
                    ? "今天的日程都已处理。"
                    : "今天还没有日程安排。"}
                </p>
              ) : null}
            </div>
            <button
              className="schedule-link"
              onClick={() => onNavigate("schedule")}
            >
              管理今日日程
            </button>
          </section>

          <section className="panel focus-history">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">记录</span>
                <h2>执行历史</h2>
              </div>
              <History size={18} />
            </div>
            <div className="session-list">
              {endedSessions.slice(0, 5).map((session) => {
                const task = data.tasks.find(
                  (item) => item.id === session.taskId,
                );
                const minutes = session.endedAt
                  ? Math.round(
                      Math.max(
                        0,
                        (new Date(session.endedAt).getTime() -
                          new Date(session.startedAt).getTime() -
                          session.totalPausedMs) /
                          60000,
                      ),
                    )
                  : 0;
                return (
                  <article key={session.id}>
                    <span
                      className={`session-state ${session.completion || "todo"}`}
                    >
                      {session.completion === "done" ? (
                        <Check size={15} />
                      ) : session.completion === "partial" ? (
                        <TriangleAlert size={15} />
                      ) : (
                        <Clock3 size={15} />
                      )}
                    </span>
                    <div>
                      <strong>{task?.title || "已删除的任务"}</strong>
                      <small>
                        {formatDateTime(session.startedAt)} ·{" "}
                        {durationLabel(minutes)}
                      </small>
                      {session.outcome ? (
                        <p className="session-outcome">{session.outcome}</p>
                      ) : null}
                    </div>
                    {task ? <StatusBadge status={task.status} /> : null}
                  </article>
                );
              })}
              {!endedSessions.length ? (
                <EmptyState
                  icon={History}
                  title="还没有执行记录"
                  description="第一次专注结束后会出现在这里。"
                />
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <Modal
        open={selectionOpen}
        title="选择专注任务"
        description="只有一条专注记录会同时进行。"
        onClose={() => setSelectionOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setSelectionOpen(false)}>
            取消
          </Button>
        }
      >
        <div className="task-picker">
          {openTasks.map((task) => (
            <button
              key={task.id}
              className={selectedTaskId === task.id ? "selected" : ""}
              onClick={() => setSelectedTaskId(task.id)}
            >
              <span>
                <strong>{task.title}</strong>
                <small>
                  {durationLabel(task.estimate)} ·{" "}
                  {data.projects.find(
                    (project) => project.id === task.projectId,
                  )?.title || "独立任务"}
                </small>
              </span>
              {selectedTaskId === task.id ? <CheckCircle2 size={18} /> : null}
            </button>
          ))}
          {!openTasks.length ? (
            <EmptyState
              icon={CheckCircle2}
              title="没有开放任务"
              description="先创建一个任务再开始专注。"
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    const task = createTask({
                      title: "新的专注任务",
                      description: "",
                      status: "todo",
                      priority: "medium",
                      deadline: todayKey(),
                      estimate: 30,
                      remainingWork: "",
                    });
                    setSelectionOpen(false);
                    startFocus(task.id);
                  }}
                >
                  创建任务
                </Button>
              }
            />
          ) : null}
        </div>
        {openTasks.length ? (
          <div className="picker-footer">
            <Button
              icon={Play}
              disabled={!selectedTaskId}
              onClick={() => startFocus(selectedTaskId)}
            >
              开始专注
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={endOpen}
        title="结束专注"
        description={`实际投入 ${durationLabel(Math.floor(elapsedSeconds / 60))}。完成后请留下真实结果。`}
        onClose={() => setEndOpen(false)}
        width="620px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndOpen(false)}>
              继续专注
            </Button>
            <Button
              icon={Check}
              onClick={endSession}
              disabled={savingEnd}
            >
              {savingEnd ? "保存中…" : "保存并结束"}
            </Button>
          </>
        }
      >
        <div className="end-session-summary">
          <div>
            <span>任务</span>
            <strong>{activeTask?.title}</strong>
          </div>
          <div>
            <span>实际投入</span>
            <strong>{durationLabel(Math.floor(elapsedSeconds / 60))}</strong>
          </div>
          <div>
            <span>计划耗时</span>
            <strong>{durationLabel(activeTask?.estimate || 0)}</strong>
          </div>
        </div>
        <div className="form-grid">
          <Field label="实际完成了什么？" required className="span-2">
            <textarea
              rows={4}
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              placeholder="写下结果、产出或推进到哪里"
            />
          </Field>
          <Field label="任务当前状态" required>
            <select
              value={completion}
              onChange={(event) =>
                setCompletion(
                  event.target.value as "done" | "partial" | "todo",
                )
              }
            >
              <option value="done">已完成</option>
              <option value="partial">部分完成</option>
              <option value="todo">未完成</option>
            </select>
          </Field>
          <Field label="分心或阻碍" hint="可选">
            <input
              value={distraction}
              onChange={(event) => setDistraction(event.target.value)}
              placeholder="例如：临时消息打断了两次"
            />
          </Field>
          {completion === "partial" ? (
            <Field label="剩余工作" required className="span-2">
              <textarea
                rows={2}
                value={remainingWork}
                onChange={(event) => setRemainingWork(event.target.value)}
                placeholder="下一次继续时需要完成什么？"
              />
            </Field>
          ) : null}
          <Field label="附加图片或文件" hint="可选，最大 25 MB" className="span-2">
            <label className="file-drop-zone compact">
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                onChange={(event) =>
                  setEvidenceFile(event.target.files?.[0] || null)
                }
              />
              <Paperclip size={17} />
              <strong>
                {evidenceFile ? evidenceFile.name : "选择成果文件"}
              </strong>
            </label>
          </Field>
          <div className="evidence-requirement span-2">
            <FileText size={16} />
            <span>这次结果会自动保存为一条文字成果记录。</span>
          </div>
          {error ? <p className="form-error span-2">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        open={cooldownOpen}
        title="暂时离开"
        description="给自己 30 秒离开冷静期，防止冲动退出。"
        onClose={() => setCooldownOpen(false)}
        width="460px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCooldownOpen(false)}>
              返回专注
            </Button>
            <Button
              icon={Pause}
              onClick={() => {
                if (activeSession) {
                  saveFocusSession({
                    ...activeSession,
                    status: "paused",
                    pausedAt: new Date().toISOString(),
                    distraction: cooldownReason || activeSession.distraction,
                  });
                }
                setCooldownOpen(false);
                toast("已暂停并离开专注");
              }}
            >
              立即暂停
            </Button>
          </>
        }
      >
        <div className="cooldown-display">
          <span>{cooldown}</span>
          <small>秒</small>
        </div>
        <Field label="离开原因" hint="可选">
          <input
            value={cooldownReason}
            onChange={(event) => setCooldownReason(event.target.value)}
            placeholder="例如：需要处理紧急电话"
          />
        </Field>
      </Modal>
    </div>
  );
}
