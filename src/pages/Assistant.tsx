import {
  ArrowUp,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  CircleAlert,
  FileSearch,
  FolderKanban,
  History,
  ListTodo,
  MessageSquarePlus,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Target,
  Wifi,
  WifiOff,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  Conversation,
  TaskStatus,
} from "../types";
import { useStore } from "../store";
import { formatDateTime, todayKey } from "../date";
import {
  buildAIContext,
  requestAI,
  type AIProposedAction,
} from "../ai";
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
  const [error, setError] = useState("");
  const [lastFailedPrompt, setLastFailedPrompt] = useState("");
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
      messages: [],
    };
    createConversation(conversation);
    setActiveId(conversation.id);
  };

  const send = async (text = input) => {
    if (!text.trim() || !active) return;
    if (!data.settings.aiEndpoint.trim()) {
      setError("真实 AI 尚未配置。请先在个人设置中填写安全的服务端代理地址。");
      return;
    }
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
    setError("");
    setLastFailedPrompt("");
    try {
      const result = await requestAI({
        endpoint: data.settings.aiEndpoint.trim(),
        message: prompt,
        mode,
        history: nextConversation.messages,
        context: data.settings.aiConsent ? buildAIContext(data) : null,
      });
      const assistantMessage: ChatMessage = {
        id: `message-${Date.now()}-assistant`,
        role: "assistant",
        content: result.reply,
        proposedActions: result.actions,
        createdAt: new Date().toISOString(),
      };
      saveConversation({
        ...nextConversation,
        messages: [...nextConversation.messages, assistantMessage],
        updatedAt: new Date().toISOString(),
      });
      setLastFailedPrompt("");
    } catch (requestError) {
      setLastFailedPrompt(prompt);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "AI 请求失败，请稍后重试。",
      );
    } finally {
      setThinking(false);
    }
  };

  const openTaskAction = (proposed?: AIProposedAction) => {
    const title = proposed?.title ||
      lastUserMessage?.content
        .replace(/帮我|请|根据|一下|建议|今天|安排/g, "")
        .trim()
        .slice(0, 42) || "整理今天的下一步行动";
    setActionTitle(title);
    setActionEstimate(proposed?.estimate || 30);
    setActionOpen(true);
  };

  return (
    <div className="page assistant-page">
      <PageHeader
        eyebrow="智能协作"
        title="AI 助理"
        description="读取当前工作台上下文，陪你分析和决定下一步。"
        actions={
          <span
            className={`ai-connection ${data.settings.aiEndpoint ? "connected" : ""}`}
          >
            {data.settings.aiEndpoint ? (
              <Wifi size={14} />
            ) : (
              <WifiOff size={14} />
            )}
            {data.settings.aiEndpoint
              ? "真实 AI 服务已配置"
              : "真实 AI 尚未配置"}
          </span>
        }
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
                <em>
                  {data.settings.aiConsent ? "已授权上下文" : "未授权上下文"}
                </em>
              </div>
            </div>
            {!data.settings.aiEndpoint ? (
              <div className="ai-config-notice">
                <WifiOff size={18} />
                <div>
                  <strong>不会用固定回复冒充 AI</strong>
                  <p>
                    请先在个人设置中填写服务端 AI 代理地址，并在部署环境配置密钥。
                    GitHub Pages 只托管静态前端，不能安全保存 API Key。
                  </p>
                </div>
              </div>
            ) : null}
            {error ? (
              <div className="ai-error-banner">
                <CircleAlert size={16} />
                <span>{error}</span>
                {lastFailedPrompt ? (
                  <button onClick={() => send(lastFailedPrompt)}>重试</button>
                ) : null}
              </div>
            ) : null}

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
                    {message.proposedActions?.length ? (
                      <div className="ai-proposed-actions">
                        {message.proposedActions.map((proposed, index) => (
                          <button
                            key={`${proposed.title}-${index}`}
                            onClick={() => openTaskAction(proposed)}
                          >
                            <ListTodo size={14} />
                            建议：{proposed.title}
                          </button>
                        ))}
                      </div>
                    ) : null}
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
                <span>继续追问</span>
                <button
                  onClick={() =>
                    send("请给出一个更小、可以在 15 分钟内开始的行动。")
                  }
                  disabled={!data.settings.aiEndpoint}
                >
                  <WandSparkles size={14} /> 进一步拆解
                </button>
                <button
                  onClick={() => send("这个判断有哪些风险？")}
                  disabled={!data.settings.aiEndpoint}
                >
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
                    disabled={thinking || !data.settings.aiEndpoint}
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
                disabled={!input.trim() || thinking || !data.settings.aiEndpoint}
                onClick={() => send()}
              >
                <ArrowUp size={18} />
              </button>
            </div>
            <p>
              {data.settings.aiEndpoint
                ? "回复来自已配置的服务端 AI；操作建议仍需你确认。"
                : "配置真实 AI 服务前，发送功能保持停用。"}
            </p>
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
              只有开启上下文授权后，工作台数据才会发送给已配置的 AI 服务。
              重要修改不会自动执行。
            </p>
          </section>
        </aside>
      </div>

      <Modal
        open={actionOpen}
        title="确认创建任务"
        description="这是 AI 提出的操作建议，确认后才会写入工作台。"
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
                  remainingWork: "",
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
