import {
  Archive,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Edit3,
  FolderKanban,
  Layers3,
  Plus,
  Target,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Goal, PageId, Project, Task } from "../types";
import { useStore } from "../store";
import { formatShortDate, todayKey } from "../date";
import { TaskEditor } from "../components/TaskEditor";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
  useToast,
} from "../components/ui";

const emptyGoal: Omit<Goal, "id" | "createdAt"> = {
  title: "",
  outcome: "",
  description: "",
  deadline: "",
};

const emptyProject: Omit<Project, "id" | "createdAt"> = {
  title: "",
  outcome: "",
  deadline: "",
  goalId: "",
  mode: "simple",
  background: "",
  risks: "",
};

export function GoalsPage({
  onNavigate,
}: {
  onNavigate: (page: PageId) => void;
}) {
  const {
    data,
    createGoal,
    updateGoal,
    deleteGoal,
    createProject,
    updateProject,
    deleteProject,
  } = useStore();
  const toast = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState(
    data.projects[0]?.id || "",
  );
  const [goalModal, setGoalModal] = useState(false);
  const [projectModal, setProjectModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [goalForm, setGoalForm] =
    useState<Omit<Goal, "id" | "createdAt">>(emptyGoal);
  const [projectForm, setProjectForm] =
    useState<Omit<Project, "id" | "createdAt">>(emptyProject);
  const [taskModal, setTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<
    { type: "goal" | "project"; id: string; title: string } | undefined
  >();
  const [formError, setFormError] = useState("");

  const selectedProject = data.projects.find(
    (project) => project.id === selectedProjectId,
  );
  const projectTasks = data.tasks.filter(
    (task) => task.projectId === selectedProjectId,
  );
  const projectDone = projectTasks.filter(
    (task) => task.status === "done",
  ).length;
  const projectProgress = projectTasks.length
    ? (projectDone / projectTasks.length) * 100
    : 0;

  useEffect(() => {
    if (
      selectedProjectId &&
      !data.projects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId(data.projects[0]?.id || "");
    }
  }, [data.projects, selectedProjectId]);

  const openGoal = (goal?: Goal) => {
    setEditingGoal(goal);
    setGoalForm(
      goal
        ? {
            title: goal.title,
            outcome: goal.outcome,
            description: goal.description,
            deadline: goal.deadline || "",
          }
        : emptyGoal,
    );
    setFormError("");
    setGoalModal(true);
  };

  const openProject = (project?: Project) => {
    setEditingProject(project);
    setProjectForm(
      project
        ? {
            title: project.title,
            outcome: project.outcome,
            deadline: project.deadline || "",
            goalId: project.goalId || "",
            mode: project.mode,
            background: project.background || "",
            risks: project.risks || "",
          }
        : { ...emptyProject, goalId: data.goals[0]?.id || "" },
    );
    setFormError("");
    setProjectModal(true);
  };

  const saveGoal = () => {
    if (!goalForm.title.trim() || !goalForm.outcome.trim()) {
      setFormError("请填写目标名称和预期成果。");
      return;
    }
    const normalized = { ...goalForm, deadline: goalForm.deadline || undefined };
    if (editingGoal) {
      updateGoal({ ...editingGoal, ...normalized });
      toast("目标已更新");
    } else {
      createGoal(normalized);
      toast("目标已创建");
    }
    setGoalModal(false);
  };

  const saveProject = () => {
    if (!projectForm.title.trim() || !projectForm.outcome.trim()) {
      setFormError("请填写项目名称和预期成果。");
      return;
    }
    const normalized = {
      ...projectForm,
      deadline: projectForm.deadline || undefined,
      goalId: projectForm.goalId || undefined,
    };
    if (editingProject) {
      updateProject({ ...editingProject, ...normalized });
      toast("项目已更新");
    } else {
      createProject(normalized);
      toast("项目已创建，可以开始添加任务");
    }
    setProjectModal(false);
  };

  return (
    <div className="page goals-page">
      <PageHeader
        eyebrow="行动结构"
        title="目标与项目"
        description="把想实现的结果，拆成可以持续推进的项目和任务。"
        actions={
          <>
            <Button
              variant="secondary"
              icon={Target}
              onClick={() => openGoal()}
            >
              新建目标
            </Button>
            <Button icon={Plus} onClick={() => openProject()}>
              新建项目
            </Button>
          </>
        }
      />

      <div className="goals-layout">
        <section className="goals-column">
          <div className="column-heading">
            <div>
              <span className="column-number">01</span>
              <h2>目标</h2>
            </div>
            <IconButton
              icon={Plus}
              label="新建目标"
              onClick={() => openGoal()}
            />
          </div>
          <div className="goal-card-list">
            {data.goals.map((goal) => {
              const projects = data.projects.filter(
                (project) => project.goalId === goal.id,
              );
              const taskCount = data.tasks.filter(
                (task) => task.goalId === goal.id,
              ).length;
              return (
                <article className="goal-card" key={goal.id}>
                  <div className="goal-card-top">
                    <span className="target-icon">
                      <Target size={16} />
                    </span>
                    <div className="row-actions">
                      <IconButton
                        icon={Edit3}
                        label="编辑目标"
                        onClick={() => openGoal(goal)}
                      />
                      <IconButton
                        icon={Trash2}
                        label="删除目标"
                        onClick={() =>
                          setDeleteTarget({
                            type: "goal",
                            id: goal.id,
                            title: goal.title,
                          })
                        }
                      />
                    </div>
                  </div>
                  <h3>{goal.title}</h3>
                  <p>{goal.outcome}</p>
                  <div className="goal-meta">
                    <span>{projects.length} 个项目</span>
                    <i />
                    <span>{taskCount} 项任务</span>
                    <i />
                    <span>{formatShortDate(goal.deadline)}</span>
                  </div>
                </article>
              );
            })}
            {!data.goals.length ? (
              <EmptyState
                icon={Target}
                title="还没有目标"
                description="先写下一个真正想实现的结果。"
                action={
                  <Button size="sm" onClick={() => openGoal()}>
                    新建目标
                  </Button>
                }
              />
            ) : null}
          </div>
        </section>

        <section className="projects-column">
          <div className="column-heading">
            <div>
              <span className="column-number">02</span>
              <h2>项目</h2>
            </div>
            <IconButton
              icon={Plus}
              label="新建项目"
              onClick={() => openProject()}
            />
          </div>
          <div className="project-list">
            {data.projects.map((project) => {
              const tasks = data.tasks.filter(
                (task) => task.projectId === project.id,
              );
              const done = tasks.filter((task) => task.status === "done").length;
              const progress = tasks.length ? (done / tasks.length) * 100 : 0;
              return (
                <button
                  className={`project-row ${selectedProjectId === project.id ? "selected" : ""}`}
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <span className="project-icon">
                    <FolderKanban size={18} />
                  </span>
                  <span className="project-main">
                    <strong>{project.title}</strong>
                    <small>
                      {done}/{tasks.length} 项任务
                    </small>
                    <ProgressBar value={progress} />
                  </span>
                  <span className="project-date">
                    {formatShortDate(project.deadline)}
                  </span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="project-detail-column">
          <div className="column-heading">
            <div>
              <span className="column-number">03</span>
              <h2>项目详情</h2>
            </div>
          </div>
          {selectedProject ? (
            <article className="project-detail">
              <div className="project-detail-head">
                <div>
                  <span className="mode-label">
                    {selectedProject.mode === "full" ? "完整模式" : "简单模式"}
                  </span>
                  <h2>{selectedProject.title}</h2>
                  <p>{selectedProject.outcome}</p>
                </div>
                <div className="row-actions">
                  <IconButton
                    icon={Edit3}
                    label="编辑项目"
                    onClick={() => openProject(selectedProject)}
                  />
                  <IconButton
                    icon={Trash2}
                    label="删除项目"
                    onClick={() =>
                      setDeleteTarget({
                        type: "project",
                        id: selectedProject.id,
                        title: selectedProject.title,
                      })
                    }
                  />
                </div>
              </div>

              <div className="project-stat-strip">
                <div>
                  <span>完成进度</span>
                  <strong>{Math.round(projectProgress)}%</strong>
                </div>
                <div>
                  <span>截止日期</span>
                  <strong>{formatShortDate(selectedProject.deadline)}</strong>
                </div>
                <div>
                  <span>任务</span>
                  <strong>
                    {projectDone}/{projectTasks.length}
                  </strong>
                </div>
              </div>
              <ProgressBar value={projectProgress} />

              {selectedProject.mode === "full" ? (
                <div className="project-context">
                  <div>
                    <span>背景</span>
                    <p>{selectedProject.background || "暂未补充项目背景。"}</p>
                  </div>
                  <div>
                    <span>
                      <TriangleAlert size={14} /> 风险
                    </span>
                    <p>{selectedProject.risks || "暂未记录风险。"}</p>
                  </div>
                </div>
              ) : null}

              <div className="detail-task-heading">
                <h3>任务清单</h3>
                <Button
                  variant="text"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    setSelectedTask(undefined);
                    setTaskModal(true);
                  }}
                >
                  添加任务
                </Button>
              </div>
              <div className="detail-task-list">
                {projectTasks.map((task) => (
                  <button
                    className="detail-task-row"
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      setTaskModal(true);
                    }}
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 size={17} className="done-icon" />
                    ) : (
                      <Circle size={17} />
                    )}
                    <span>
                      <strong>{task.title}</strong>
                      <small>{formatShortDate(task.deadline)}</small>
                    </span>
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                  </button>
                ))}
                {!projectTasks.length ? (
                  <div className="small-empty bordered">
                    <Layers3 size={20} />
                    <span>还没有任务，先添加一个明确的下一步。</span>
                  </div>
                ) : null}
              </div>

              <div className="project-detail-footer">
                <span>
                  <Archive size={15} /> 相关资料可在知识库关联到此项目
                </span>
                <button onClick={() => onNavigate("library")}>
                  查看关联内容 <ArrowRight size={14} />
                </button>
              </div>
            </article>
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="选择一个项目"
              description="项目详情、任务和进度会显示在这里。"
            />
          )}
        </section>
      </div>

      <Modal
        open={goalModal}
        title={editingGoal ? "编辑目标" : "新建目标"}
        description="目标描述想实现的结果，不强制拆成长期、中期或短期。"
        onClose={() => setGoalModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGoalModal(false)}>
              取消
            </Button>
            <Button onClick={saveGoal}>
              {editingGoal ? "保存修改" : "创建目标"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="目标名称" required className="span-2">
            <input
              value={goalForm.title}
              onChange={(event) =>
                setGoalForm({ ...goalForm, title: event.target.value })
              }
              placeholder="例如：建立可持续的个人产品能力"
            />
          </Field>
          <Field label="预期成果" required className="span-2">
            <textarea
              rows={3}
              value={goalForm.outcome}
              onChange={(event) =>
                setGoalForm({ ...goalForm, outcome: event.target.value })
              }
              placeholder="达成时，什么会变得不同？"
            />
          </Field>
          <Field label="期限" hint="可选">
            <input
              type="date"
              value={goalForm.deadline || ""}
              onChange={(event) =>
                setGoalForm({ ...goalForm, deadline: event.target.value })
              }
            />
          </Field>
          <Field label="补充说明" className="span-2">
            <textarea
              rows={3}
              value={goalForm.description}
              onChange={(event) =>
                setGoalForm({ ...goalForm, description: event.target.value })
              }
            />
          </Field>
          {formError ? <p className="form-error span-2">{formError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={projectModal}
        title={editingProject ? "编辑项目" : "新建项目"}
        description="先用简单模式开始，需要时再补充背景和风险。"
        onClose={() => setProjectModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setProjectModal(false)}>
              取消
            </Button>
            <Button onClick={saveProject}>
              {editingProject ? "保存修改" : "创建项目"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="项目名称" required className="span-2">
            <input
              value={projectForm.title}
              onChange={(event) =>
                setProjectForm({
                  ...projectForm,
                  title: event.target.value,
                })
              }
              placeholder="给这个项目一个清楚的名字"
            />
          </Field>
          <Field label="预期成果" required className="span-2">
            <textarea
              rows={3}
              value={projectForm.outcome}
              onChange={(event) =>
                setProjectForm({
                  ...projectForm,
                  outcome: event.target.value,
                })
              }
              placeholder="完成时会产生什么可见结果？"
            />
          </Field>
          <Field label="关联目标">
            <select
              value={projectForm.goalId || ""}
              onChange={(event) =>
                setProjectForm({
                  ...projectForm,
                  goalId: event.target.value,
                })
              }
            >
              <option value="">不关联目标</option>
              {data.goals.map((goal) => (
                <option value={goal.id} key={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="截止日期">
            <input
              type="date"
              min={todayKey()}
              value={projectForm.deadline || ""}
              onChange={(event) =>
                setProjectForm({
                  ...projectForm,
                  deadline: event.target.value,
                })
              }
            />
          </Field>
          <Field label="项目模式">
            <select
              value={projectForm.mode}
              onChange={(event) =>
                setProjectForm({
                  ...projectForm,
                  mode: event.target.value as "simple" | "full",
                })
              }
            >
              <option value="simple">简单模式</option>
              <option value="full">完整模式</option>
            </select>
          </Field>
          {projectForm.mode === "full" ? (
            <>
              <Field label="项目背景" className="span-2">
                <textarea
                  rows={2}
                  value={projectForm.background || ""}
                  onChange={(event) =>
                    setProjectForm({
                      ...projectForm,
                      background: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="已知风险" className="span-2">
                <textarea
                  rows={2}
                  value={projectForm.risks || ""}
                  onChange={(event) =>
                    setProjectForm({
                      ...projectForm,
                      risks: event.target.value,
                    })
                  }
                />
              </Field>
            </>
          ) : null}
          {formError ? <p className="form-error span-2">{formError}</p> : null}
        </div>
      </Modal>

      <TaskEditor
        open={taskModal}
        onClose={() => {
          setTaskModal(false);
          setSelectedTask(undefined);
        }}
        task={selectedTask}
        projectId={selectedProject?.id}
        goalId={selectedProject?.goalId}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        description={
          deleteTarget?.type === "goal"
            ? `删除“${deleteTarget?.title}”后，关联项目会保留但不再归属该目标。`
            : `删除“${deleteTarget?.title}”后，项目中的任务会保留为独立任务。`
        }
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={() => {
          if (deleteTarget?.type === "goal") deleteGoal(deleteTarget.id);
          if (deleteTarget?.type === "project") {
            deleteProject(deleteTarget.id);
          }
          toast(deleteTarget?.type === "goal" ? "目标已删除" : "项目已删除");
          setDeleteTarget(undefined);
        }}
      />
    </div>
  );
}
