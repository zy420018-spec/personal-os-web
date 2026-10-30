import type { AppData, ChatMessage } from "./types";

export interface AIProposedAction {
  type: "create_task";
  title: string;
  estimate: number;
}

export interface AIResponse {
  reply: string;
  model: string;
  actions: AIProposedAction[];
}

export const buildAIContext = (data: AppData) => ({
  settings: {
    dayStart: data.settings.dayStart,
    dayEnd: data.settings.dayEnd,
    semesterStart: data.settings.semesterStart,
    totalWeeks: data.settings.totalWeeks,
  },
  goals: data.goals,
  projects: data.projects,
  tasks: data.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    projectId: task.projectId,
    goalId: task.goalId,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline,
    estimate: task.estimate,
    remainingWork: task.remainingWork,
    completedAt: task.completedAt,
  })),
  courses: data.courses,
  courseChanges: data.courseChanges,
  schedules: data.schedules,
  focusSessions: data.focusSessions.slice(0, 80),
  evidence: data.evidence.slice(0, 80).map((item) => ({
    id: item.id,
    taskId: item.taskId,
    sessionId: item.sessionId,
    type: item.type,
    title: item.title,
    content: item.content,
    url: item.url,
  })),
  inbox: data.inbox.filter((item) => !item.archived).slice(0, 80),
  knowledge: data.knowledge.slice(0, 80).map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    content: item.content.slice(0, 4000),
    source: item.source,
    url: item.url,
    tags: item.tags,
    linkedProjectId: item.linkedProjectId,
  })),
  reviews: data.reviews.slice(0, 20),
  growth: data.growth.slice(0, 50),
});

const parseActions = (reply: string) => {
  const actions: AIProposedAction[] = [];
  const cleaned = reply.replace(
    /\[\[ACTION:(\{.*?\})\]\]/g,
    (_match, raw: string) => {
      try {
        const action = JSON.parse(raw) as AIProposedAction;
        if (
          action.type === "create_task" &&
          action.title?.trim() &&
          Number.isFinite(action.estimate)
        ) {
          actions.push({
            ...action,
            title: action.title.trim().slice(0, 120),
            estimate: Math.max(5, Math.min(480, action.estimate)),
          });
        }
      } catch {
        // Ignore malformed suggestions rather than executing anything.
      }
      return "";
    },
  );
  return { reply: cleaned.trim(), actions };
};

export const requestAI = async ({
  endpoint,
  message,
  mode,
  history,
  context,
}: {
  endpoint: string;
  message: string;
  mode: "advisory" | "collaborative" | "proactive";
  history: ChatMessage[];
  context: unknown;
}): Promise<AIResponse> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        mode,
        context,
        history: history.slice(-12).map((item) => ({
          role: item.role,
          content: item.content,
        })),
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as {
      reply?: string;
      model?: string;
      error?: string;
    };
    if (!response.ok || !payload.reply) {
      throw new Error(payload.error || "AI 服务请求失败。");
    }
    const parsed = parseActions(payload.reply);
    return {
      reply: parsed.reply,
      model: payload.model || "server model",
      actions: parsed.actions,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI 请求超时，请检查服务连接后重试。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};
