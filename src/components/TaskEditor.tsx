import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import type { Task, TaskStatus, Priority } from "../types";
import { useStore } from "../store";
import { todayKey } from "../date";
import { useToast, Button, ConfirmDialog, Field, Modal } from "./ui";
import { EvidenceManager } from "./EvidenceManager";

type TaskInput = Omit<Task, "id" | "createdAt" | "updatedAt">;

const emptyTask = (projectId?: string, goalId?: string): TaskInput => ({
  title: "",
  description: "",
  projectId,
  goalId,
  status: "todo",
  priority: "medium",
  deadline: todayKey(),
  estimate: 30,
  minDuration: 15,
  allowSplit: false,
  focusRequirement: "normal",
  planningScenes: ["course", "short-gap", "full-gap"],
  prerequisiteTaskId: undefined,
  remainingWork: "",
});

export function TaskEditor({
  open,
  onClose,
  task,
  projectId,
  goalId,
  initialDeadline,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task;
  projectId?: string;
  goalId?: string;
  initialDeadline?: string;
  onCreated?: (task: Task) => void;
}) {
  const {
    data,
    createTask,
    updateTask,
    deleteTask,
    createEvidence,
  } = useStore();
  const toast = useToast();
  const [form, setForm] = useState<TaskInput>(emptyTask());
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      task
        ? {
            title: task.title,
            description: task.description,
            projectId: task.projectId,
            goalId: task.goalId,
            status: task.status,
            priority: task.priority,
            deadline: task.deadline || "",
            estimate: task.estimate,
            minDuration: task.minDuration,
            allowSplit: task.allowSplit,
            focusRequirement: task.focusRequirement,
            planningScenes: task.planningScenes,
            prerequisiteTaskId: task.prerequisiteTaskId,
            remainingWork: task.remainingWork,
          }
        : {
            ...emptyTask(projectId, goalId),
            deadline: initialDeadline || todayKey(),
          },
    );
  }, [open, task, projectId, goalId, initialDeadline]);

  const submit = () => {
    if (!form.title.trim()) {
      setError("请填写任务名称。");
      return;
    }
    if (form.estimate < 5) {
      setError("预计耗时至少为 5 分钟。");
      return;
    }
    if (form.minDuration < 5 || form.minDuration > form.estimate) {
      setError("最短执行时长必须在 5 分钟到预计耗时之间。");
      return;
    }
    if (!form.planningScenes.length) {
      setError("请至少选择一种适用场景。");
      return;
    }
    if (form.status === "partial" && !form.remainingWork.trim()) {
      setError("部分完成任务需要写明剩余工作。");
      return;
    }
    const hasEvidence = task
      ? data.evidence.some((evidence) => evidence.taskId === task.id)
      : false;
    if (form.status === "done" && !hasEvidence && !form.description.trim()) {
      setError(
        "完成前需要留下成果记录。请在任务描述中写下实际结果，或通过执行页结束一次专注。",
      );
      return;
    }
    const linkedProject = data.projects.find(
      (project) => project.id === form.projectId,
    );
    const normalized = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      remainingWork: form.remainingWork.trim(),
      deadline: form.deadline || undefined,
      goalId: form.goalId || linkedProject?.goalId,
    };
    if (task) {
      updateTask({ ...task, ...normalized });
      if (normalized.status === "done" && !hasEvidence) {
        createEvidence({
          taskId: task.id,
          projectId: task.projectId,
          type: "text",
          title: `${normalized.title} · 完成成果`,
          content: normalized.description,
        });
      }
      toast("任务已更新，关联页面已同步");
    } else {
      const created = createTask(normalized);
      if (normalized.status === "done") {
        createEvidence({
          taskId: created.id,
          projectId: created.projectId,
          type: "text",
          title: `${normalized.title} · 完成成果`,
          content: normalized.description,
        });
      }
      onCreated?.(created);
      toast("任务已创建");
    }
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        title={task ? "编辑任务" : "创建任务"}
        description="任务状态与专注计时分别记录，实际执行不会覆盖计划。"
        onClose={onClose}
        footer={
          <>
            {task ? (
              <Button
                variant="ghost"
                icon={Trash2}
                className="footer-delete"
                onClick={() => setConfirmDelete(true)}
              >
                删除
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button icon={Save} onClick={submit}>
              {task ? "保存修改" : "创建任务"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="任务名称" required className="span-2">
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="例如：完成项目首页线框"
            />
          </Field>
          <Field label="所属项目">
            <select
              value={form.projectId || ""}
              onChange={(event) => {
                const projectIdValue = event.target.value || undefined;
                const project = data.projects.find(
                  (item) => item.id === projectIdValue,
                );
                setForm({
                  ...form,
                  projectId: projectIdValue,
                  goalId: project?.goalId || form.goalId,
                });
              }}
            >
              <option value="">独立任务</option>
              {data.projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="任务状态">
            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as TaskStatus,
                })
              }
            >
              <option value="todo">待开始</option>
              <option value="doing">进行中</option>
              <option value="partial">部分完成</option>
              <option value="done">已完成</option>
              <option value="abandoned">已放弃</option>
            </select>
          </Field>
          <Field label="优先级">
            <select
              value={form.priority}
              onChange={(event) =>
                setForm({
                  ...form,
                  priority: event.target.value as Priority,
                })
              }
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </select>
          </Field>
          <Field label="截止日期">
            <input
              type="date"
              value={form.deadline || ""}
              onChange={(event) =>
                setForm({ ...form, deadline: event.target.value })
              }
            />
          </Field>
          <Field label="预计耗时" hint="分钟">
            <input
              type="number"
              min={5}
              step={5}
              value={form.estimate}
              onChange={(event) =>
                setForm({ ...form, estimate: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="关联目标">
            <select
              value={form.goalId || ""}
              onChange={(event) =>
                setForm({ ...form, goalId: event.target.value || undefined })
              }
            >
              <option value="">不关联</option>
              {data.goals.map((goal) => (
                <option value={goal.id} key={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="任务描述" className="span-2">
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="补充完成标准、上下文或参考资料"
            />
          </Field>
          <details className="task-advanced span-2">
            <summary>排程高级设置</summary>
            <div className="task-advanced-grid">
              <Field label="最短执行时长" hint="分钟">
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={form.minDuration}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      minDuration: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="拆分方式">
                <select
                  value={form.allowSplit ? "yes" : "no"}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      allowSplit: event.target.value === "yes",
                    })
                  }
                >
                  <option value="no">不允许拆分</option>
                  <option value="yes">允许拆分</option>
                </select>
              </Field>
              <Field label="专注要求">
                <select
                  value={form.focusRequirement}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      focusRequirement: event.target.value as
                        | "light"
                        | "normal"
                        | "deep",
                    })
                  }
                >
                  <option value="light">轻量</option>
                  <option value="normal">普通</option>
                  <option value="deep">深度</option>
                </select>
              </Field>
              <Field label="前置任务">
                <select
                  value={form.prerequisiteTaskId || ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      prerequisiteTaskId: event.target.value || undefined,
                    })
                  }
                >
                  <option value="">无前置任务</option>
                  {data.tasks
                    .filter((item) => item.id !== task?.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="适用场景" className="span-2">
                <div className="task-scene-picker">
                  {[
                    ["course", "水课"],
                    ["short-gap", "短空闲"],
                    ["full-gap", "完整空闲"],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        checked={form.planningScenes.includes(
                          value as "course" | "short-gap" | "full-gap",
                        )}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            planningScenes: event.target.checked
                              ? [
                                  ...form.planningScenes,
                                  value as
                                    | "course"
                                    | "short-gap"
                                    | "full-gap",
                                ]
                              : form.planningScenes.filter(
                                  (scene) => scene !== value,
                                ),
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </details>
          {form.status === "partial" ? (
            <Field label="剩余工作" required className="span-2">
              <textarea
                rows={3}
                value={form.remainingWork}
                onChange={(event) =>
                  setForm({ ...form, remainingWork: event.target.value })
                }
                placeholder="记录还没完成的具体内容，方便下次继续"
              />
            </Field>
          ) : null}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {task ? (
          <EvidenceManager taskId={task.id} sessionId={undefined} compact />
        ) : (
          <p className="form-hint">
            创建任务后，可在任务详情中追加文字、图片、文件或链接成果。
          </p>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        description={`删除“${task?.title || ""}”后，相关日程也会移除，历史执行记录仍会保留。`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (task) deleteTask(task.id);
          setConfirmDelete(false);
          onClose();
          toast("任务已删除");
        }}
      />
    </>
  );
}
