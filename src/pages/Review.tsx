import {
  Archive,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  MessageSquareText,
  Printer,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Review } from "../types";
import { useStore } from "../store";
import { durationLabel, formatDateTime, todayKey } from "../date";
import {
  downloadText,
  getReviewPeriod,
  openReviewPrint,
  reviewToCsv,
  reviewToMarkdown,
} from "../export";
import { requestAI } from "../ai";
import {
  Button,
  EmptyState,
  Field,
  PageHeader,
  ProgressBar,
  SimulatedTag,
  Tabs,
  useToast,
} from "../components/ui";

type ReviewType = Review["type"];

const reviewTabs: { value: ReviewType; label: string }[] = [
  { value: "daily", label: "每日复盘" },
  { value: "weekly", label: "每周复盘" },
  { value: "monthly", label: "每月复盘" },
];

export function ReviewPage() {
  const { data, createReview } = useStore();
  const toast = useToast();
  const [type, setType] = useState<ReviewType>("daily");
  const [anchor, setAnchor] = useState(todayKey());
  const [highlights, setHighlights] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const period = useMemo(
    () => getReviewPeriod(data, type, anchor),
    [data, type, anchor],
  );
  const periodTasks = period.tasks;
  const periodSessions = period.focusSessions;
  const completed = period.completed;
  const partial = period.partial;
  const unfinished = period.unfinished;
  const plannedMinutes = period.plannedMinutes;
  const actualMinutes = period.actualMinutes;
  const todayEvidence = period.evidence;
  const reviews = data.reviews.filter((review) => review.type === type);
  const completionRate = period.completionRate;

  const autoSummary = useMemo(() => {
    const scope =
      type === "daily" ? "今天" : type === "weekly" ? "本周" : "本月";
    if (!periodTasks.length && !periodSessions.length) {
      return `${scope}还没有任务和执行记录。可以先把最重要的一件事放进工作台，再回来复盘。`;
    }
    const incompleteTitles = unfinished
      .slice(0, 2)
      .map((task) => `“${task.title}”`)
      .join("、");
    return `${scope}共有 ${periodTasks.length} 项任务，完成 ${completed} 项，部分完成 ${partial} 项。实际专注 ${durationLabel(actualMinutes)}，计划耗时 ${durationLabel(plannedMinutes)}，完成率为 ${completionRate}%。${
      unfinished.length
        ? `尚未处理的事项包括${incompleteTitles}。`
        : "开放任务均已处理。"
    }${todayEvidence.length ? `留下 ${todayEvidence.length} 条可复用的成果记录。` : "还没有成果记录，完成时建议留下真实结果。"}`;
  }, [
    type,
    periodTasks.length,
    periodSessions.length,
    completed,
    partial,
    actualMinutes,
    plannedMinutes,
    completionRate,
    unfinished,
    todayEvidence.length,
  ]);

  const saveReview = () => {
    if (!highlights.trim() && !blockers.trim() && !nextAction.trim()) {
      toast("至少写下一项复盘内容再保存");
      return;
    }
    createReview({
      type,
      periodLabel: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      completed,
      plannedMinutes,
      actualMinutes,
      highlights: highlights.trim() || "本次未单独记录。",
      blockers: blockers.trim() || "本次未记录明显阻碍。",
      nextAction: nextAction.trim() || "按当前节奏继续推进。",
      taskIds: period.tasks.map((task) => task.id),
      projectIds: period.projects.map((project) => project.id),
      focusSessionIds: period.focusSessions.map((session) => session.id),
      evidenceIds: period.evidence.map((item) => item.id),
    });
    setHighlights("");
    setBlockers("");
    setNextAction("");
    toast("复盘已保存到历史记录");
  };

  const exportAnswers = { highlights, blockers, nextAction };
  const promptCopy = {
    daily: {
      highlights: "今天最重要的具体成果是什么？",
      blockers: "今天没有完成的部分，具体卡在哪里？",
      nextAction: "明天只调整一件事，会是什么？",
      highlightHint: "写下可验证的结果或发现…",
      blockerHint: "区分时间不足、任务不清、被打断或其他原因…",
      nextHint: "给明天一个明确、可执行的调整…",
    },
    weekly: {
      highlights: "本周哪项项目或目标进展最值得保留？",
      blockers: "本周重复出现的拖延、冲突或时间浪费是什么？",
      nextAction: "下周要优先推进的一个重点是什么？",
      highlightHint: "说明目标、项目或任务发生了什么变化…",
      blockerHint: "关注重复出现的问题，而不是单次意外…",
      nextHint: "明确下周最重要的项目、任务或时间块…",
    },
    monthly: {
      highlights: "本月最重要的实践、成果或能力变化是什么？",
      blockers: "哪些习惯或工作方式需要停止或调整？",
      nextAction: "下个月要形成的一个重点方向是什么？",
      highlightHint: "结合项目成果、成长记录和关键经验…",
      blockerHint: "从反复出现的阻碍中提炼方法问题…",
      nextHint: "写下一个方向，以及月底如何判断是否有效…",
    },
  }[type];

  const exportReview = (format: "markdown" | "csv" | "pdf") => {
    try {
      if (format === "markdown") {
        downloadText(
          reviewToMarkdown(period, exportAnswers),
          `${period.start}-${period.end}-review.md`,
          "text/markdown;charset=utf-8",
        );
      }
      if (format === "csv") {
        downloadText(
          reviewToCsv(period),
          `${period.start}-${period.end}-review.csv`,
          "text/csv;charset=utf-8",
        );
      }
      if (format === "pdf") {
        openReviewPrint(period, exportAnswers);
      }
      toast(format === "pdf" ? "已打开打印 / PDF 面板" : "复盘文件已导出");
    } catch (exportError) {
      toast(
        exportError instanceof Error ? exportError.message : "导出失败",
      );
    }
  };

  const analyzeWithAI = async () => {
    if (!data.settings.aiEndpoint || !data.settings.aiConsent) {
      toast("请先在个人设置中连接真实 AI，并授权上下文");
      return;
    }
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const result = await requestAI({
        endpoint: data.settings.aiEndpoint,
        message:
          "请分析这个复盘周期：结合计划与实际耗时、完成任务、未完成原因、成果材料和项目进展，指出最关键的问题，并给出三条有依据的下一步调整。不要自动修改计划。",
        mode: "advisory",
        history: [],
        context: {
          period: {
            type: period.type,
            start: period.start,
            end: period.end,
            plannedMinutes: period.plannedMinutes,
            actualMinutes: period.actualMinutes,
            completed: period.completed,
            completionRate: period.completionRate,
          },
          tasks: period.tasks,
          projects: period.projects,
          focusSessions: period.focusSessions,
          evidence: period.evidence,
          growth: period.growth,
          userNotes: exportAnswers,
        },
      });
      setAiAnalysis(result.reply);
    } catch (error) {
      setAiAnalysis(
        error instanceof Error ? `AI 分析失败：${error.message}` : "AI 分析失败。",
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="page review-page">
      <PageHeader
        eyebrow="持续优化"
        title="复盘"
        description="用已经发生的真实数据，调整下一次行动。"
        actions={
          <div className="review-header-actions">
            <Button
              size="sm"
              icon={Sparkles}
              disabled={!data.settings.aiEndpoint || !data.settings.aiConsent}
              onClick={analyzeWithAI}
            >
              {aiLoading ? "AI 分析中…" : "AI 分析"}
            </Button>
            <div className="review-history-count">
              <Archive size={16} />
              <span>{reviews.length} 条{reviewTabs.find((tab) => tab.value === type)?.label}</span>
            </div>
          </div>
        }
      />

      <div className="review-toolbar">
        <Tabs value={type} onChange={setType} options={reviewTabs} />
        <div className="review-toolbar-actions">
          <input
            type="date"
            value={anchor}
            onChange={(event) => setAnchor(event.target.value || todayKey())}
            aria-label="复盘周期日期"
          />
          <Button
            size="sm"
            variant="secondary"
            icon={FileText}
            onClick={() => exportReview("markdown")}
          >
            Markdown
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={FileSpreadsheet}
            onClick={() => exportReview("csv")}
          >
            CSV
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={Printer}
            onClick={() => exportReview("pdf")}
          >
            PDF
          </Button>
        </div>
      </div>

      <div className="review-layout">
        <div className="review-main">
          <section className="review-summary">
            <div className="review-summary-head">
              <div>
                <span className="review-data-label">
                  <Download size={12} /> 自动汇总 · 真实数据
                </span>
                <h2>
                  {type === "daily"
                    ? "今天的行动数据"
                    : type === "weekly"
                      ? "这一周的行动数据"
                      : "这个月的行动数据"}
                </h2>
              </div>
              <Sparkles size={22} />
            </div>
            <p>{autoSummary}</p>
            <div className="review-metric-grid">
              <div>
                <span>
                  <CheckCircle2 size={15} /> 已完成
                </span>
                <strong>{completed}</strong>
                <small>/ {periodTasks.length} 项任务</small>
              </div>
              <div>
                <span>
                  <Clock3 size={15} /> 实际投入
                </span>
                <strong>{durationLabel(actualMinutes)}</strong>
                <small>计划 {durationLabel(plannedMinutes)}</small>
              </div>
              <div>
                <span>
                  <ClipboardCheck size={15} /> 执行完成率
                </span>
                <strong>{completionRate}%</strong>
                <ProgressBar value={completionRate} />
              </div>
            </div>
            <div className="review-period-detail">
              {type === "daily" ? (
                <div>
                  <span>今日完成</span>
                  <strong>
                    {period.tasks
                      .filter((task) => task.status === "done")
                      .map((task) => task.title)
                      .join("、") || "暂无完成任务"}
                  </strong>
                </div>
              ) : null}
              {type === "weekly" ? (
                <div>
                  <span>项目进展</span>
                  <strong>
                    {period.projects
                      .map((project) => project.title)
                      .join("、") || "本周没有关联项目活动"}
                  </strong>
                </div>
              ) : null}
              {type === "monthly" ? (
                <div>
                  <span>成长与经验</span>
                  <strong>
                    {period.growth
                      .map((entry) => entry.title)
                      .join("、") || "本月没有成长记录"}
                  </strong>
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel review-conversation">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">几个问题，不需要问卷</span>
                <h2>把这次经验说清楚</h2>
              </div>
              <MessageSquareText size={20} className="muted-icon" />
            </div>
            <div className="review-prompts">
              <Field label={promptCopy.highlights}>
                <textarea
                  rows={3}
                  value={highlights}
                  onChange={(event) => setHighlights(event.target.value)}
                  placeholder={promptCopy.highlightHint}
                />
              </Field>
              <Field label={promptCopy.blockers}>
                <textarea
                  rows={3}
                  value={blockers}
                  onChange={(event) => setBlockers(event.target.value)}
                  placeholder={promptCopy.blockerHint}
                />
              </Field>
              <Field label={promptCopy.nextAction}>
                <textarea
                  rows={3}
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                  placeholder={promptCopy.nextHint}
                />
              </Field>
            </div>
            <div className="review-save-row">
              <span>
                <Lightbulb size={15} />
                复盘会保存当时的任务状态和执行数据。
              </span>
              <Button icon={Save} onClick={saveReview}>
                保存这次复盘
              </Button>
            </div>
          </section>
        </div>

        <aside className="review-side">
          <section className="panel review-insight">
            <div className="panel-heading compact">
              <div>
                <SimulatedTag />
                <h2>行动观察</h2>
              </div>
              <Sparkles size={18} />
            </div>
            <div className="insight-main">
              <div>
                <span>计划与实际的差异</span>
                <strong
                  className={
                    actualMinutes > plannedMinutes ? "warning-text" : ""
                  }
                >
                  {actualMinutes > plannedMinutes ? "+" : ""}
                  {actualMinutes - plannedMinutes} 分钟
                </strong>
              </div>
              <p>
                {actualMinutes > plannedMinutes
                  ? "实际投入超过了计划，检查是否低估难度或临时扩大了范围。"
                  : actualMinutes === 0
                    ? "还没有专注记录，建议从一次短时间执行开始。"
                    : "实际投入在计划之内，注意区分投入时间和实际结果。"}
              </p>
            </div>
            <div className="insight-list">
              <div>
                <CheckCircle2 size={15} />
                <span>有 {todayEvidence.length} 条成果材料可支撑复盘。</span>
              </div>
              <div>
                <TriangleAlert size={15} />
                <span>
                  {unfinished.length
                    ? `${unfinished.length} 项任务尚未完成。`
                    : "开放任务已处理，没有明显积压。"}
                </span>
              </div>
            </div>
            <p className="simulation-disclaimer">
              内容根据本地数据生成，正式计划仍需你确认。
            </p>
          </section>

          <section className="panel review-ai-panel">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">真实 AI</span>
                <h2>周期执行分析</h2>
              </div>
              <Sparkles size={18} />
            </div>
            {aiAnalysis ? (
              <div className="review-ai-content">
                {aiAnalysis.split("\n").map((line, index) => (
                  <p key={index}>{line || "\u00a0"}</p>
                ))}
              </div>
            ) : (
              <div className="review-ai-empty">
                <Sparkles size={18} />
                <p>
                  {data.settings.aiEndpoint && data.settings.aiConsent
                    ? "点击页面上方“AI 分析”，基于当前周期真实数据生成建议。"
                    : "真实 AI 尚未配置或未授权上下文。当前统计仍完全来自本地真实数据。"}
                </p>
              </div>
            )}
          </section>

          <section className="panel review-history">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">历史</span>
                <h2>复盘记录</h2>
              </div>
              <CalendarDays size={18} />
            </div>
            <div className="review-history-list">
              {reviews.map((review) => (
                <article key={review.id}>
                  <div>
                    <span>{review.periodLabel}</span>
                    <small>{formatDateTime(review.createdAt)}</small>
                  </div>
                  <p>{review.nextAction}</p>
                  <div className="review-history-meta">
                    <span>{review.completed} 项完成</span>
                    <i />
                    <span>{durationLabel(review.actualMinutes)} 投入</span>
                  </div>
                </article>
              ))}
              {!reviews.length ? (
                <EmptyState
                  icon={CalendarDays}
                  title="还没有历史复盘"
                  description="完成后保存，下一次会看到变化。"
                />
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <div className="review-flow">
        <span>数据汇总</span>
        <ArrowRight size={15} />
        <span>简短对话</span>
        <ArrowRight size={15} />
        <span>明确一个调整</span>
        <ArrowRight size={15} />
        <span>保存历史</span>
      </div>
    </div>
  );
}
