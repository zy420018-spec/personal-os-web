import {
  ArrowUp,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  FileSearch,
  FolderKanban,
  History,
  ListTodo,
  MessageSquarePlus,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  Conversation,
  TaskStatus,
} from "../types";
import { useStore } from "../store";
import { durationLabel, formatDateTime, todayKey } from "../date";
import {
  Button,
  IconButton,
  Modal,
  PageHeader,
  SimulatedTag,
  StatusBadge,
  useToast,
} from "../components/ui";

type AIMode = Conversation["mode"];

const modeOptions: {
  id: AIMode;
  label: string;
  description: string;
}[] = [
  {
    id: "advisory",
    label: "顾问",
    description: "分析问题与风险",
  },
  {
    id: "collaborative",
    label: "协作",
    description: "一起讨论下一步",
  },
  {
    id: "proactive",
    label: "主动",
    description: "发现停滞与冲突",
  },
];

const quickActions = [
  {
    label: "规划今天",
    icon: CalendarDays,
    prompt: "根据今天的任务和日程，帮我安排今天的重点。",
  },
  {
    label: "分析项目",
    icon: FolderKanban,
    prompt: "分析我最需要关注的项目，哪些地方可能卡住了？",
  },
  {
    label: "整理想法",
    icon: WandSparkles,
    prompt: "看看收集箱里有哪些内容值得进一步整理。",
  },
  {
    label: "每日复盘",
    icon: Target,
    prompt: "帮我根据今天的执行数据做一个简短复盘。",
  },
];

const makeId = () => `conversation-${Date.now()}`;

export function AssistantPage() {
  const {
    data,
    saveConversation,
    createConversation,
    createTask,
    addAILog,
  } = useStore();
  const toast = useToast();
  const [activeId, setActiveId] = useState(data.conversations[0]?.id || "");
  const [mode, setMode] = useState<AIMode>(
    data.conversations[0]?.mode || "collaborative",
  );
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [actionEstimate, setActionEstimate] = useState(30);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active =
    data.conversations.find((item) => item.id === activeId) ||
    data.conversations[0];
  const lastUserMessage = [...(active?.messages || [])]
    .reverse()
    .find((item) => item.role === "user");
  const lastAssistant = [...(active?.messages || [])]
    .reverse()
    .find((item) => item.role === "assistant");

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [active?.messages, thinking]);

  const newConversation = () => {
    const conversation: Conversation = {
      id: makeId(),
      title: "新对话",
      mode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: `message-${Date.now()}`,
          role: "assistant",
          content:
            "这是模拟 AI 协作界面。我已经载入当前工作台上下文，可以一起规划、分析或复盘。所有内容均为本地规则生成。",
          simulated: true,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    createConversation(conversation);
    setActiveId(conversation.id);
  };

  const createReply = (prompt: string): string => {
    const openTasks = data.tasks
      .filter((task) => !["done", "abandoned"].includes(task.status))
      .sort((a, b) => {
        const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
        return rank[a.priority] - rank[b.priority];
      });
    const todaySchedules = data.schedules.filter(
      (schedule) => schedule.date === todayKey(),
    );
    const unfinishedProjects = data.projects.filter((project) => {
      const tasks = data.tasks.filter(
        (task) => task.projectId === project.id,
      );
      return tasks.some((task) => task.status !== "done");
    });
    if (prompt.includes("规划今天") || prompt.includes("今天的重点")) {
      return `我建议今天只确定一个主要结果：\n\n1. 先推进“${openTasks[0]?.title || "当前最重要的任务"}”。它优先级高，预计 ${openTasks[0]?.estimate || 30} 分钟。\n2. 今天的日程目前有 ${todaySchedules.length} 个时间块，建议给每个时间块后留 10 分钟缓冲。\n3. 如果上午精力更好，可以把最难的部分放在第一个完整时间块。\n\n需要我基于这个建议创建一个具体任务吗？`;
    }
    if (prompt.includes("分析项目") || prompt.includes("项目")) {
      const project = unfinishedProjects[0];
      const tasks = data.tasks.filter(
        (task) => task.projectId === project?.id,
      );
      const done = tasks.filter((task) => task.status === "done").length;
      return `当前最值得关注的是“${project?.title || "暂无开放项目"}”。\n\n它有 ${tasks.length} 项任务，已完成 ${done} 项。下一步建议检查：“${tasks.find((task) => task.status !== "done")?.title || "为项目增加一个最小行动"}”。\n\n风险在于：${
        project?.risks || "项目还没有记录明确风险，可能导致范围持续扩大。"
      }\n\n先把下一步缩小到 30 分钟能开始的动作。`;
    }
    if (prompt.includes("收集箱") || prompt.includes("想法")) {
      const pending = data.inbox.filter((item) => !item.archived);
      return `收集箱里还有 ${pending.length} 条待整理内容。\n\n${pending
        .slice(0, 3)
        .map((item, index) => `${index + 1}. ${item.content.slice(0, 45)}`)
        .join("\n")}\n\n建议先处理最接近行动的一项。分类与转换都由你确认后才执行。`;
    }
    if (prompt.includes("复盘") || prompt.includes("执行数据")) {
      const completed = data.tasks.filter(
        (task) => task.status === "done",
      ).length;
      const focusMinutes = data.focusSessions.reduce((sum, item) => {
        if (!item.endedAt) return sum;
        return (
          sum +
          Math.max(
            0,
            (new Date(item.endedAt).getTime() -
              new Date(item.startedAt).getTime() -
              item.totalPausedMs) /
              60000,
          )
        );
      }, 0);
      return `我从工作台里读到 ${completed} 项已完成任务和 ${durationLabel(Math.round(focusMinutes))} 的专注记录。\n\n可以围绕三个问题快速复盘：今天最重要的结果是什么？什么造成了计划偏差？明天要保留或停止什么？\n\n目前最明显的风险是任务完成状态与专注成果需要继续补充，否则后续复盘只能看到数量，看不到质量。`;
    }
    return `我先基于工作台当前数据给你一个简要判断：\n\n• ${openTasks.length} 项任务仍未完成\n• ${unfinishedProjects.length} 个项目在推进\n• ${data.inbox.filter((item) => !item.archived).length} 条想法待整理\n\n如果你愿意，我建议先确定今天唯一必须完成的结果，再决定时间安排。你也可以告诉我更具体的卡点。`;
  };

  const send = (text = input) => {
    if (!text.trim() || !active) return;
    const prompt = text.trim();
    const userMessage: ChatMessage = {
      id: `message-${Date.now()}`,
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    const nextConversation: Conversation = {
      ...active,
      title:
        active.messages.filter((item) => item.role === "user").length === 0
          ? prompt.slice(0, 18)
          : active.title,
      mode,
      updatedAt: new Date().toISOString(),
      messages: [...active.messages, userMessage],
    };
    saveConversation(nextConversation);
    setInput("");
    setThinking(true);
    window.setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: `message-${Date.now()}-assistant`,
        role: "assistant",
        content: createReply(prompt),
        simulated: true,
        createdAt: new Date().toISOString(),
      };
      saveConversation({
        ...nextConversation,
        messages: [...nextConversation.messages, assistantMessage],
        updatedAt: new Date().toISOString(),
      });
      setThinking(false);
    }, 700);
  };

  const openTaskAction = () => {
    const title =
      lastUserMessage?.content
        .replace(/帮我|请|根据|一下|建议|今天|安排/g, "")
        .trim()
        .slice(0, 42) || "整理今天的下一步行动";
    setActionTitle(title);
    setActionEstimate(30);
    setActionOpen(true);
  };

  return (
    <div className="page assistant-page">
      <PageHeader
        eyebrow="智能协作"
        title="AI 助理"
        description="读取当前工作台上下文，陪你分析和决定下一步。"
        actions={<SimulatedTag label="模拟 AI · 本地规则" />}
      />

      <div className="assistant-layout">
        <aside className="assistant-history">
          <Button
            icon={MessageSquarePlus}
            onClick={newConversation}
            className="new-chat-button"
          >
            新建对话
          </Button>
          <div className="history-heading">
            <span>
              <History size={14} /> 最近对话
            </span>
          </div>
          <div className="history-list">
            {data.conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={active?.id === conversation.id ? "active" : ""}
                onClick={() => {
                  setActiveId(conversation.id);
                  setMode(conversation.mode);
                }}
              >
                <span>
                  <strong>{conversation.title}</strong>
                  <small>{formatDateTime(conversation.updatedAt)}</small>
                </span>
                <MoreHorizontal size={15} />
              </button>
            ))}
          </div>
          <div className="history-permission">
            <ShieldCheck size={16} />
            <div>
              <strong>你的决定始终优先</strong>
              <p>重要修改会在执行前请求确认。</p>
            </div>
          </div>
        </aside>

        <section className="chat-panel">
          <div className="chat-topbar">
            <div className="mode-selector">
              {modeOptions.map((option) => (
                <button
                  key={option.id}
                  className={mode === option.id ? "active" : ""}
                  onClick={() => {
                    setMode(option.id);
                    if (active) saveConversation({ ...active, mode: option.id });
                  }}
                  title={option.description}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="mode-description">
              {modeOptions.find((option) => option.id === mode)?.description}
            </span>
          </div>

          <div className="chat-scroll" ref={scrollRef}>
            <div className="context-strip">
              <span>
                <BrainCircuit size={15} /> 当前上下文
              </span>
              <div>
                <em>{data.tasks.filter((task) => task.status !== "done").length} 个开放任务</em>
                <em>{data.projects.length} 个项目</em>
                <em>{data.knowledge.length} 条知识</em>
              </div>
            </div>

            <div className="message-list">
              {active?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`message-row ${message.role}`}
                >
                  {message.role === "assistant" ? (
                    <span className="message-avatar">
                      <Sparkles size={16} />
                    </span>
                  ) : null}
                  <div className="message-bubble">
                    {message.role === "assistant" &&
                    message.simulated ? (
                      <SimulatedTag />
                    ) : null}
                    {message.content.split("\n").map((line, index) => (
                      <p key={index}>{line || "\u00a0"}</p>
                    ))}
                  </div>
                </div>
              ))}
              {thinking ? (
                <div className="message-row assistant">
                  <span className="message-avatar">
                    <Sparkles size={16} />
                  </span>
                  <div className="message-bubble typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}
            </div>

            {lastAssistant && !thinking ? (
              <div className="suggested-actions">
                <span>基于这条回复</span>
                <button onClick={openTaskAction}>
                  <ListTodo size={14} /> 创建任务
                </button>
                <button
                  onClick={() =>
                    send("请给出一个更小、可以在 15 分钟内开始的行动。")
                  }
                >
                  <WandSparkles size={14} /> 进一步拆解
                </button>
                <button onClick={() => send("这个判断有哪些风险？")}>
                  <FileSearch size={14} /> 检查风险
                </button>
              </div>
            ) : null}
          </div>

          <div className="chat-composer">
            <div className="quick-actions">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => send(action.prompt)}
                  >
                    <Icon size={14} />
                    {action.label}
                  </button>
                );
              })}
            </div>
            <div className="composer-box">
              <textarea
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="告诉 AI 你在想什么…"
              />
              <button
                aria-label="发送消息"
                disabled={!input.trim() || thinking}
                onClick={() => send()}
              >
                <ArrowUp size={18} />
              </button>
            </div>
            <p>模拟回复：内容由本地规则生成，不会调用外部模型。</p>
          </div>
        </section>

        <aside className="assistant-context-panel">
          <section>
            <div className="context-title">
              <span>工作台快照</span>
              <BrainCircuit size={17} />
            </div>
            <div className="context-stat-grid">
              <div>
                <strong>
                  {
                    data.tasks.filter(
                      (task) => !["done", "abandoned"].includes(task.status),
                    ).length
                  }
                </strong>
                <span>开放任务</span>
              </div>
              <div>
                <strong>{data.projects.length}</strong>
                <span>项目</span>
              </div>
              <div>
                <strong>{data.inbox.filter((item) => !item.archived).length}</strong>
                <span>待整理</span>
              </div>
              <div>
                <strong>{data.knowledge.length}</strong>
                <span>知识资料</span>
              </div>
            </div>
          </section>
          <section>
            <div className="context-title">
              <span>当前重点</span>
              <Target size={16} />
            </div>
            <div className="context-task-list">
              {data.tasks
                .filter(
                  (task) => !["done", "abandoned"].includes(task.status),
                )
                .slice(0, 4)
                .map((task) => (
                  <div key={task.id}>
                    <span className={`priority-dot priority-${task.priority}`} />
                    <div>
                      <strong>{task.title}</strong>
                      <StatusBadge status={task.status as TaskStatus} />
                    </div>
                  </div>
                ))}
            </div>
          </section>
          <section className="context-note">
            <Bot size={17} />
            <p>
              默认使用协作模式。AI 可以读取本地工作台数据，但不会直接修改正式计划。
            </p>
          </section>
        </aside>
      </div>

      <Modal
        open={actionOpen}
        title="确认创建任务"
        description="这是由模拟 AI 提出的操作，确认后才会写入工作台。"
        onClose={() => setActionOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActionOpen(false)}>
              取消
            </Button>
            <Button
              icon={Check}
              onClick={() => {
                createTask({
                  title: actionTitle,
                  description: "由模拟 AI 对话建议创建，等待补充具体完成标准。",
                  status: "todo",
                  priority: "medium",
                  deadline: todayKey(),
                  estimate: actionEstimate,
                });
                addAILog({
                  action: "创建任务",
                  detail: actionTitle,
                  confirmed: true,
                });
                setActionOpen(false);
                toast("任务已创建，并记录了确认操作");
              }}
            >
              确认创建
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field span-2">
            <span className="field-label">任务标题</span>
            <input
              value={actionTitle}
              onChange={(event) => setActionTitle(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">预计耗时（分钟）</span>
            <input
              type="number"
              min={5}
              step={5}
              value={actionEstimate}
              onChange={(event) => setActionEstimate(Number(event.target.value))}
            />
          </label>
        </div>
      </Modal>

    </div>
  );
}
