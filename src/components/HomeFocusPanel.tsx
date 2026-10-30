import {
  Check,
  Clock3,
  FileText,
  Pause,
  Play,
  Plus,
  Square,
  Timer,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Task } from "../types";
import { useStore } from "../store";
import {
  durationLabel,
  isToday,
  secondsToClock,
  todayKey,
} from "../date";
import { saveEvidenceFile } from "../storage/files";
import {
  Button,
  Field,
  Modal,
  ProgressBar,
  StatusBadge,
  useToast,
} from "./ui";

export function HomeFocusPanel({
  onOpenTask,
  onOpenPlanning,
}: {
  onOpenTask: (task: Task) => void;
  onOpenPlanning: () => void;
}) {
  const {
    data,
    createEvidence,
    saveFocusSession,
    updateTask,
  } = useStore();
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [endOpen, setEndOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [remainingWork, setRemainingWork] = useState("");
  const [completion, setCompletion] =
    useState<"done" | "partial" | "todo">("partial");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeSession = data.focusSessions.find(
    (session) => session.status === "active" || session.status === "paused",
  );
  const activeTask = data.tasks.find(
    (task) => task.id === activeSession?.taskId,
  );
  const openTasks = data.tasks.filter(
    (task) => !["done", "abandoned"].includes(task.status),
  );
  const upcoming = data.schedules
    .filter((schedule) => schedule.date === todayKey())
    .map((schedule) => ({
      schedule,
      task: data.tasks.find((task) => task.id === schedule.taskId),
    }))
    .filter(
      (item) =>
        item.task &&
        !["done", "abandoned"].includes(item.task.status) &&
        item.task.id !== activeTask?.id,
    );
  const completedToday = data.tasks.filter(
    (task) => task.status === "done" && isToday(task.completedAt),
  );
  const todayMinutes = data.focusSessions
    .filter(
      (session) =>
        isToday(session.startedAt) &&
        session.status === "ended" &&
        session.endedAt,
    )
    .reduce(
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  const start = (taskId = selectedTaskId) => {
    if (activeSession || !taskId) return;
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task) return;
    saveFocusSession({
      id: `focus-${Date.now()}`,
      taskId,
      startedAt: new Date().toISOString(),
      totalPausedMs: 0,
      status: "active",
    });
    if (task.status === "todo") {
      updateTask({ ...task, status: "doing" });
    }
    setSelectedTaskId(taskId);
    toast(`已开始：${task.title}`);
  };

  const togglePause = () => {
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
    setRemainingWork(activeTask?.remainingWork || "");
    setCompletion("partial");
    setEvidenceFile(null);
    setError("");
    setEndOpen(true);
  };

  const finish = async () => {
    if (!activeSession || !activeTask || saving) return;
    if (!outcome.trim()) {
      setError("请填写这次实际完成了什么。");
      return;
    }
    if (completion === "partial" && !remainingWork.trim()) {
      setError("部分完成时需要记录剩余工作。");
      return;
    }
    if (evidenceFile && evidenceFile.size > 25 * 1024 * 1024) {
      setError("成果文件不能超过 25 MB。");
      return;
    }
    setSaving(true);
    setError("");
    const endedAt = new Date().toISOString();
    const totalPausedMs =
      activeSession.totalPausedMs +
      (activeSession.status === "paused" && activeSession.pausedAt
        ? new Date(endedAt).getTime() -
          new Date(activeSession.pausedAt).getTime()
        : 0);
    try {
      let fileInfo:
        | {
            fileId: string;
            fileName: string;
            mimeType: string;
            fileSize: number;
          }
        | undefined;
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
      });
      createEvidence({
        taskId: activeTask.id,
        projectId: activeTask.projectId,
        sessionId: activeSession.id,
        type: "text",
        title: `${activeTask.title} · 执行成果`,
        content: outcome.trim(),
      });
      if (fileInfo && evidenceFile) {
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
      updateTask({
        ...activeTask,
        status:
          completion === "done"
            ? "done"
            : completion === "partial"
              ? "partial"
              : "doing",
        remainingWork:
          completion === "partial" ? remainingWork.trim() : "",
      });
      setEndOpen(false);
      toast("执行、成果和任务状态已同步");
    } catch (finishError) {
      setError(
        finishError instanceof Error
          ? finishError.message
          : "成果保存失败，请重试。",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`home-focus-panel ${activeSession ? "active" : ""}`}>
      <div className="home-focus-main">
        <div className="home-focus-label">
          <span className="live-dot" />
          {activeSession
            ? activeSession.status === "paused"
              ? "执行已暂停"
              : "当前正在执行"
            : "执行控制台"}
        </div>
        {activeSession && activeTask ? (
          <>
            <div className="home-focus-title">
              <div>
                <h2>{activeTask.title}</h2>
                <p>
                  {data.projects.find(
                    (project) => project.id === activeTask.projectId,
                  )?.title || "独立任务"}{" "}
                  · 预计 {durationLabel(activeTask.estimate)}
                </p>
              </div>
              <span className="home-focus-time">
                {secondsToClock(elapsedSeconds)}
              </span>
            </div>
            <ProgressBar
              value={
                (elapsedSeconds / Math.max(1, activeTask.estimate * 60)) * 100
              }
            />
            <div className="home-focus-actions">
              <Button
                icon={activeSession.status === "paused" ? Play : Pause}
                onClick={togglePause}
              >
                {activeSession.status === "paused" ? "继续" : "暂停"}
              </Button>
              <Button variant="secondary" icon={Square} onClick={openEnd}>
                结束并记录成果
              </Button>
              <button className="text-action" onClick={() => onOpenTask(activeTask)}>
                查看任务详情
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>从最重要的一件事开始</h2>
            <p>
              今天已专注 {durationLabel(Math.round(todayMinutes))}，完成{" "}
              {completedToday.length} 项任务。
            </p>
            <div className="home-focus-start">
              <select
                value={selectedTaskId}
                onChange={(event) => setSelectedTaskId(event.target.value)}
              >
                <option value="">选择任务开始专注</option>
                {openTasks.map((task) => (
                  <option value={task.id} key={task.id}>
                    {task.title} · {durationLabel(task.estimate)}
                  </option>
                ))}
              </select>
              <Button
                icon={Play}
                disabled={!selectedTaskId}
                onClick={() => start()}
              >
                开始执行
              </Button>
              <Button
                variant="secondary"
                icon={Plus}
                onClick={onOpenPlanning}
              >
                安排时间
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="home-focus-side">
        <div className="home-focus-mini-head">
          <span>
            <Zap size={14} /> 接下来执行
          </span>
          <button onClick={onOpenPlanning}>查看规划</button>
        </div>
        <div className="home-upcoming">
          {upcoming.slice(0, 3).map(({ schedule, task }) => (
            <button
              key={schedule.id}
              disabled={Boolean(activeSession)}
              onClick={() => start(task!.id)}
            >
              <span>{schedule.start}</span>
              <div>
                <strong>{task!.title}</strong>
                <small>{durationLabel(task!.estimate)}</small>
              </div>
              <Play size={14} />
            </button>
          ))}
          {!upcoming.length ? (
            <p>今天暂无待执行日程，可直接从任务开始。</p>
          ) : null}
        </div>
        <div className="home-completed-head">
          <span>
            <Check size={14} /> 今日完成
          </span>
          <span>
            <Timer size={13} /> {durationLabel(Math.round(todayMinutes))}
          </span>
        </div>
        <div className="home-completed-list">
          {completedToday.slice(0, 3).map((task) => (
            <button key={task.id} onClick={() => onOpenTask(task)}>
              <span className="done-icon">
                <Check size={12} />
              </span>
              <span>
                <strong>{task.title}</strong>
                <small>{task.remainingWork || "已留下成果记录"}</small>
              </span>
              <StatusBadge status={task.status} />
            </button>
          ))}
          {!completedToday.length ? (
            <p>今天还没有完成记录。</p>
          ) : null}
        </div>
      </div>

      <Modal
        open={endOpen}
        title="结束执行并提交成果"
        description="实际完成内容会与任务、项目和专注记录关联。"
        onClose={() => setEndOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndOpen(false)}>
              继续执行
            </Button>
            <Button
              icon={Check}
              onClick={finish}
              disabled={saving}
            >
              {saving ? "保存中…" : "保存并结束"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="实际成果" required className="span-2">
            <textarea
              rows={4}
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            />
          </Field>
          <Field label="任务状态">
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
          <Field label="附加图片或文件" hint="最大 25 MB">
            <label className="file-drop-zone compact">
              <input
                type="file"
                onChange={(event) =>
                  setEvidenceFile(event.target.files?.[0] || null)
                }
              />
              <FileText size={16} />
              <strong>{evidenceFile?.name || "选择成果文件"}</strong>
            </label>
          </Field>
          {completion === "partial" ? (
            <Field label="剩余工作" required className="span-2">
              <textarea
                rows={2}
                value={remainingWork}
                onChange={(event) => setRemainingWork(event.target.value)}
              />
            </Field>
          ) : null}
          {error ? <p className="form-error span-2">{error}</p> : null}
        </div>
      </Modal>
    </section>
  );
}
