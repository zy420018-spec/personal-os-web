import {
  Archive,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Lightbulb,
  MessageSquareText,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Review } from "../types";
import { useStore } from "../store";
import {
  durationLabel,
  formatDateTime,
  isThisWeek,
  isToday,
  todayKey,
} from "../date";
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
  const [highlights, setHighlights] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextAction, setNextAction] = useState("");

  const periodTasks = data.tasks.filter((task) => {
    if (type === "daily") return isToday(task.deadline);
    if (type === "weekly") return isThisWeek(task.deadline);
    const now = new Date();
    return task.createdAt.slice(0, 7) === todayKey().slice(0, 7);
  });
  const periodSessions = data.focusSessions.filter((session) => {
    if (type === "daily") return isToday(session.startedAt);
    if (type === "weekly") return isThisWeek(session.startedAt);
    return session.startedAt.slice(0, 7) === todayKey().slice(0, 7);
  });
  const completed = periodTasks.filter(
    (task) => task.status === "done",
  ).length;
  const partial = periodTasks.filter(
    (task) => task.status === "partial",
  ).length;
  const unfinished = periodTasks.filter(
    (task) => !["done", "abandoned"].includes(task.status),
  );
  const plannedMinutes = periodTasks.reduce(
    (sum, task) => sum + task.estimate,
    0,
  );
  const actualMinutes = Math.round(
    periodSessions.reduce((sum, session) => {
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
    }, 0),
  );
  const todayEvidence = data.evidence.filter((evidence) => {
    if (type === "daily") return isToday(evidence.createdAt);
    if (type === "weekly") return isThisWeek(evidence.createdAt);
    return evidence.createdAt.slice(0, 7) === todayKey().slice(0, 7);
  });
  const reviews = data.reviews.filter((review) => review.type === type);
  const completionRate = periodTasks.length
    ? Math.round((completed / periodTasks.length) * 100)
    : 0;

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
      periodLabel:
        type === "daily"
          ? "今日复盘"
          : type === "weekly"
            ? "本周复盘"
            : "本月复盘",
      completed,
      plannedMinutes,
      actualMinutes,
      highlights: highlights.trim() || "本次未单独记录。",
      blockers: blockers.trim() || "本次未记录明显阻碍。",
      nextAction: nextAction.trim() || "按当前节奏继续推进。",
    });
    setHighlights("");
    setBlockers("");
    setNextAction("");
    toast("复盘已保存到历史记录");
  };

  return (
    <div className="page review-page">
      <PageHeader
        eyebrow="持续优化"
        title="复盘"
        description="用已经发生的真实数据，调整下一次行动。"
        actions={
          <div className="review-history-count">
            <Archive size={16} />
            <span>{reviews.length} 条{reviewTabs.find((tab) => tab.value === type)?.label}</span>
          </div>
        }
      />

      <Tabs value={type} onChange={setType} options={reviewTabs} />

      <div className="review-layout">
        <div className="review-main">
          <section className="review-summary">
            <div className="review-summary-head">
              <div>
                <SimulatedTag label="自动汇总 · 模拟" />
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
              <Field label="这次最重要的结果或发现是什么？">
                <textarea
                  rows={3}
                  value={highlights}
                  onChange={(event) => setHighlights(event.target.value)}
                  placeholder="写下一个真正值得保留的结果…"
                />
              </Field>
              <Field label="什么让计划产生了偏差？">
                <textarea
                  rows={3}
                  value={blockers}
                  onChange={(event) => setBlockers(event.target.value)}
                  placeholder="可以没有阻碍；如果有，具体发生了什么？"
                />
              </Field>
              <Field label="下一次只调整一件事，会是什么？">
                <textarea
                  rows={3}
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                  placeholder="给下一次行动一个明确、可执行的调整…"
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
