import {
  Bell,
  BellRing,
  Bot,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  FolderKanban,
  ListTodo,
  MailOpen,
  Plus,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type {
  Notification as AppNotification,
  PageId,
} from "../types";
import { useStore } from "../store";
import { formatDateTime, todayKey } from "../date";
import {
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SimulatedTag,
  Tabs,
  useToast,
} from "../components/ui";

type NotificationFilter = "all" | "task" | "project" | "ai";

const categoryMeta = {
  task: {
    label: "任务提醒",
    icon: ListTodo,
    description: "截止日期和日程开始提醒",
  },
  project: {
    label: "项目跟进",
    icon: FolderKanban,
    description: "停滞项目与长期未启动事项",
  },
  ai: {
    label: "AI 建议",
    icon: Bot,
    description: "由本地规则生成的行动建议",
  },
} as const;

export function NotificationsPage({
  onNavigate,
}: {
  onNavigate: (page: PageId) => void;
}) {
  const {
    data,
    updateNotification,
    markAllNotificationsRead,
    createTask,
    addAILog,
  } = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [selected, setSelected] = useState<AppNotification | undefined>();
  const [actionOpen, setActionOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>();

  const visible = data.notifications
    .filter((notification) => {
      if (filter === "all") return true;
      return notification.category === filter;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = data.notifications.filter((item) => !item.read).length;
  const openFollowUps = data.followUps.filter(
    (followUp) => followUp.status === "open",
  );

  const openNotification = (notification: AppNotification) => {
    updateNotification({ ...notification, read: true });
    setSelected({ ...notification, read: true });
  };

  const handleNotificationNavigate = () => {
    if (!selected) return;
    const task = data.tasks.find((item) => item.id === selected.relatedId);
    const project = data.projects.find(
      (item) => item.id === selected.relatedId,
    );
    setSelected(undefined);
    if (task || project) onNavigate("goals");
    else onNavigate("schedule");
  };

  const prepareSmallAction = (notification: AppNotification) => {
    const project = data.projects.find(
      (item) => item.id === notification.relatedId,
    );
    const task = data.tasks.find(
      (item) => item.id === notification.relatedId,
    );
    setProjectId(project?.id || task?.projectId);
    setTaskTitle(
      project
        ? `将“${project.title}”拆出一个 30 分钟行动`
        : task
          ? `先推进“${task.title}”中最关键的一步`
          : "处理这条跟进建议",
    );
    setActionOpen(true);
  };

  return (
    <div className="page notifications-page">
      <PageHeader
        eyebrow="动态跟进"
        title="通知"
        description="把真正需要行动的提醒和普通信息分开。"
        actions={
          <Button
            variant="secondary"
            icon={CheckCheck}
            disabled={!unread}
            onClick={() => {
              markAllNotificationsRead();
              toast("所有通知已标记为已读");
            }}
          >
            全部已读
          </Button>
        }
      />

      <div className="notification-overview">
        <div className="notification-count">
          <span className="count-icon">
            <BellRing size={22} />
          </span>
          <div>
            <strong>{unread}</strong>
            <span>条未读动态</span>
          </div>
          <p>
            {unread
              ? "优先处理与真实任务或项目关联的事项。"
              : "当前没有未读通知，工作台保持清爽。"}
          </p>
        </div>
        <div className="followup-summary">
          <CircleAlert size={19} />
          <div>
            <strong>{openFollowUps.length} 个跟进项</strong>
            <span>不会重复创建已有任务</span>
          </div>
          <SimulatedTag label="规则生成" />
        </div>
      </div>

      <div className="notifications-toolbar">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            {
              value: "all",
              label: "全部",
              count: data.notifications.length,
            },
            {
              value: "task",
              label: "任务提醒",
              count: data.notifications.filter(
                (item) => item.category === "task",
              ).length,
            },
            {
              value: "project",
              label: "项目跟进",
              count: data.notifications.filter(
                (item) => item.category === "project",
              ).length,
            },
            {
              value: "ai",
              label: "AI 建议",
              count: data.notifications.filter(
                (item) => item.category === "ai",
              ).length,
            },
          ]}
        />
      </div>

      <div className="notifications-layout">
        <section className="notification-list">
          {visible.map((notification) => {
            const meta = categoryMeta[notification.category];
            const Icon = meta.icon;
            return (
              <article
                key={notification.id}
                className={`notification-item ${notification.read ? "read" : "unread"}`}
              >
                <button
                  className={`notification-type type-${notification.category}`}
                  onClick={() => openNotification(notification)}
                  aria-label={meta.label}
                >
                  <Icon size={19} />
                </button>
                <button
                  className="notification-main"
                  onClick={() => openNotification(notification)}
                >
                  <div>
                    <span>{meta.label}</span>
                    {notification.simulated ? <SimulatedTag /> : null}
                    {!notification.read ? <em>未读</em> : null}
                  </div>
                  <h3>{notification.title}</h3>
                  <p>{notification.body}</p>
                  <small>{formatDateTime(notification.createdAt)}</small>
                </button>
                <div className="notification-actions">
                  {!notification.read ? (
                    <button
                      onClick={() => {
                        updateNotification({ ...notification, read: true });
                        toast("已标记为已读");
                      }}
                    >
                      <MailOpen size={15} />
                      标记已读
                    </button>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openNotification(notification)}
                  >
                    查看 <ChevronRight size={14} />
                  </Button>
                </div>
              </article>
            );
          })}
          {!visible.length ? (
            <EmptyState
              icon={Bell}
              title="这里暂时没有通知"
              description="任务和项目发生变化后会出现在这里。"
            />
          ) : null}
        </section>

        <aside className="notification-side">
          <section className="panel category-guide">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">通知分类</span>
                <h2>只保留可行动信息</h2>
              </div>
              <Bell size={18} />
            </div>
            <div className="category-guide-list">
              {(Object.keys(categoryMeta) as NotificationFilter[])
                .filter((key): key is Exclude<NotificationFilter, "all"> => key !== "all")
                .map((key) => {
                  const meta = categoryMeta[key];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={filter === key ? "active" : ""}
                    >
                      <span className={`type-${key}`}>
                        <Icon size={16} />
                      </span>
                      <div>
                        <strong>{meta.label}</strong>
                        <small>{meta.description}</small>
                      </div>
                      <em>
                        {
                          data.notifications.filter(
                            (item) =>
                              item.category === key && !item.read,
                          ).length
                        }
                      </em>
                    </button>
                  );
                })}
            </div>
          </section>

          <section className="panel followup-panel">
            <div className="panel-heading compact">
              <div>
                <SimulatedTag />
                <h2>跟进建议</h2>
              </div>
              <Sparkles size={17} />
            </div>
            {openFollowUps.map((followUp) => {
              const project = data.projects.find(
                (item) => item.id === followUp.relatedId,
              );
              return (
                <div className="followup-card" key={followUp.id}>
                  <div>
                    <FolderKanban size={16} />
                    <span>{project?.title || "关联项目"}</span>
                  </div>
                  <p>{followUp.reason}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Plus}
                    onClick={() => {
                      setProjectId(project?.id);
                      setTaskTitle(
                        project
                          ? `联系一位目标用户，推进“${project.title}”`
                          : "推进停滞项目的下一步",
                      );
                      setActionOpen(true);
                    }}
                  >
                    创建小行动
                  </Button>
                </div>
              );
            })}
            {!openFollowUps.length ? (
              <p className="small-empty">当前没有需要跟进的停滞事项。</p>
            ) : null}
            <p className="simulation-disclaimer">
              建议与已有项目关联，确认后才会创建行动。
            </p>
          </section>

          <section className="notification-tip">
            <Clock3 size={17} />
            <div>
              <strong>站内提醒说明</strong>
              <p>
                当前版本只提供站内通知，尚未接入手机或桌面系统推送。
              </p>
            </div>
          </section>
        </aside>
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected?.title || "通知详情"}
        onClose={() => setSelected(undefined)}
        footer={
          <>
            {selected?.simulated || selected?.category === "project" ? (
              <Button
                variant="secondary"
                icon={Sparkles}
                onClick={() => {
                  if (selected) prepareSmallAction(selected);
                  setSelected(undefined);
                }}
              >
                拆成小行动
              </Button>
            ) : null}
            <Button onClick={handleNotificationNavigate}>去处理</Button>
          </>
        }
      >
        {selected ? (
          <div className="notification-detail">
            <div className={`notification-type type-${selected.category}`}>
              {selected.category === "task" ? (
                <ListTodo size={20} />
              ) : selected.category === "project" ? (
                <FolderKanban size={20} />
              ) : (
                <Bot size={20} />
              )}
            </div>
            <div>
              {selected.simulated ? <SimulatedTag /> : null}
              <p>{selected.body}</p>
              <span>{formatDateTime(selected.createdAt)}</span>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={actionOpen}
        title="创建一个更小的行动"
        description="这条行动会关联已有项目，不会复制原任务。"
        onClose={() => setActionOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActionOpen(false)}>
              取消
            </Button>
            <Button
              icon={Check}
              disabled={!taskTitle.trim()}
              onClick={() => {
                createTask({
                  title: taskTitle.trim(),
                  description: "由站内跟进建议创建，确认后已写入工作台。",
                  projectId,
                  status: "todo",
                  priority: "medium",
                  deadline: todayKey(),
                  estimate: 30,
                  remainingWork: "",
                });
                addAILog({
                  action: "从跟进建议创建任务",
                  detail: taskTitle.trim(),
                  confirmed: true,
                });
                setActionOpen(false);
                toast("小行动已创建并关联到项目");
              }}
            >
              确认创建
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="行动标题" required className="span-2">
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
            />
          </Field>
          <Field label="关联项目">
            <select
              value={projectId || ""}
              onChange={(event) =>
                setProjectId(event.target.value || undefined)
              }
            >
              <option value="">不关联</option>
              {data.projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="action-estimate">
            <CalendarClock size={16} />
            <span>默认安排 30 分钟，可在任务详情中调整。</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
