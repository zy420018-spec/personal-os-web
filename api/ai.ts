type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end: () => void;
};

type AIRequest = {
  message?: string;
  mode?: "advisory" | "collaborative" | "proactive";
  history?: { role: "user" | "assistant"; content: string }[];
  context?: unknown;
};

const runtimeEnvironment =
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env || {};

const modeInstructions = {
  advisory:
    "你是 PersonalOS 的顾问。重点分析问题、风险、取舍和限制。避免擅自给出大规模改动，先帮助用户看清局势。",
  collaborative:
    "你是 PersonalOS 的协作伙伴。基于数据与用户共同制定清晰、可执行的下一步，并解释建议依据。",
  proactive:
    "你是 PersonalOS 的主动审视助手。主动检查停滞任务、截止日期风险、课程冲突、计划与实际的差距。这里不是后台定时任务，只在用户发起对话时进行分析。",
};

const outputInstructions = `
你可以读取用户授权发送的 PersonalOS 数据快照。不要声称访问了快照之外的信息。
当回答缺少数据时必须明确说明。不得虚构知识库来源。
如果建议创建任务，可在回答末尾追加一行机器可读标记：
[[ACTION:{"type":"create_task","title":"具体任务名","estimate":30}]]
这个标记只代表建议，不会自动执行；客户端必须获得用户确认。
不要提出删除操作。重要修改只能作为建议呈现。
请使用简洁中文 Markdown，避免重复用户已经知道的信息。
`.trim();

const parseBody = (body: unknown): AIRequest => {
  if (typeof body === "string") return JSON.parse(body) as AIRequest;
  if (body && typeof body === "object") return body as AIRequest;
  return {};
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const configuredOrigins = (runtimeEnvironment.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = (req.headers.origin as string) || "";
  if (configuredOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "只支持 POST 请求。" });
    return;
  }
  if (!configuredOrigins.length) {
    res.status(503).json({
      error: "服务端尚未配置 ALLOWED_ORIGINS。",
      code: "SERVER_NOT_CONFIGURED",
    });
    return;
  }
  if (!configuredOrigins.includes(origin)) {
    res.status(403).json({ error: "当前来源未被允许。" });
    return;
  }

  const apiKey = runtimeEnvironment.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: "服务端尚未配置 OPENAI_API_KEY。",
      code: "AI_KEY_MISSING",
    });
    return;
  }

  let body: AIRequest;
  try {
    body = parseBody(req.body);
  } catch {
    res.status(400).json({ error: "请求内容不是有效 JSON。" });
    return;
  }

  const message = body.message?.trim();
  if (!message) {
    res.status(400).json({ error: "消息不能为空。" });
    return;
  }
  if (message.length > 12000) {
    res.status(413).json({ error: "消息过长，请缩短后重试。" });
    return;
  }

  const contextText = body.context
    ? JSON.stringify(body.context).slice(0, 120000)
    : "用户未授权发送工作台数据上下文。";
  const history = (body.history || [])
    .slice(-12)
    .map((item) => `${item.role === "user" ? "用户" : "助手"}：${item.content}`)
    .join("\n");
  const mode = body.mode || "collaborative";
  const model = runtimeEnvironment.OPENAI_MODEL || "Qwen/Qwen3-8B";
  const baseUrl = runtimeEnvironment.OPENAI_BASE_URL || "https://api.siliconflow.cn/v1";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `${modeInstructions[mode]}\n\n${outputInstructions}`,
          },
          {
            role: "user",
            content: `工作台数据快照：\n${contextText}\n\n最近对话：\n${history || "无"}\n\n用户当前消息：\n${message}`,
          },
        ],
        max_tokens: 1400,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    const payload = await response.json();
    if (!response.ok) {
      const apiMessage =
        (payload as { error?: { message?: string } }).error?.message ||
        "模型服务请求失败。";
      res.status(response.status).json({
        error: apiMessage,
        code: "MODEL_REQUEST_FAILED",
      });
      return;
    }

    const reply =
      (payload as { choices?: { message?: { content?: string } }[] })
        .choices?.[0]?.message?.content?.trim() || "";

    if (!reply) {
      res.status(502).json({
        error: "模型返回了空内容，请重试。",
        code: "EMPTY_MODEL_RESPONSE",
      });
      return;
    }
    res.status(200).json({ reply, model });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    res.status(aborted ? 504 : 502).json({
      error: aborted
        ? "模型响应超时，请重试。"
        : "无法连接模型服务，请检查服务端配置。",
      code: aborted ? "AI_TIMEOUT" : "AI_NETWORK_ERROR",
    });
  } finally {
    clearTimeout(timeout);
  }
}
