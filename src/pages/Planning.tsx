import {
  CalendarDays,
  Check,
  Clock3,
  GraduationCap,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useStore } from "../store";
import type { PageId } from "../types";
import { formatShortDate, todayKey } from "../date";
import {
  buildPlanningSuggestions,
  type EnergyLevel,
  type PlanningSuggestion,
} from "../planner";
import {
  Button,
  Modal,
  PageHeader,
  ProgressBar,
  Tabs,
  useToast,
} from "../components/ui";
import { SchedulePage } from "./Schedule";
import { CoursesPage } from "./Courses";
import { requestAI } from "../ai";

type PlanningTab = "schedule" | "courses";

export function PlanningPage({
  initialTab = "schedule",
  onNavigate,
}: {
  initialTab?: PlanningTab;
  onNavigate: (page: PageId) => void;
}) {
  const { data, createSchedule } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<PlanningTab>(initialTab);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [energy, setEnergy] = useState<EnergyLevel>("steady");
  const [selected, setSelected] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<PlanningSuggestion[]>([]);
  const [unscheduled, setUnscheduled] = useState<
    { taskId: string; taskTitle: string; minutes: number }[]
  >([]);
  const [summary, setSummary] = useState({ busyMinutes: 0, freeMinutes: 0 });
  const [aiReview, setAiReview] = useState("");
  const [aiReviewLoading, setAiReviewLoading] = useState(false);

  const runPlanner = () => {
    const result = buildPlanningSuggestions(data, energy);
    setSuggestions(result.suggestions);
    setUnscheduled(result.unscheduled);
    setSummary({
      busyMinutes: result.busyMinutes,
      freeMinutes: result.freeMinutes,
    });
    setAiReview("");
    setSelected(result.suggestions.map((item) => item.id));
  };

  const openPlanner = () => {
    setPlannerOpen(true);
    runPlanner();
  };

  const confirmPlan = () => {
    const chosen = suggestions.filter((item) => selected.includes(item.id));
    chosen.forEach((suggestion) => {
      createSchedule({
        title: suggestion.taskTitle,
        date: suggestion.date,
        start: suggestion.start,
        end: suggestion.end,
        taskId: suggestion.taskId,
        note: suggestion.reason,
      });
    });
    setPlannerOpen(false);
    toast(`已确认写入 ${chosen.length} 个时间块`);
  };

  const reviewPlanWithAI = async () => {
    if (!data.settings.aiEndpoint || !data.settings.aiConsent) {
      toast("请先在个人设置中连接真实 AI，并授权上下文");
      return;
    }
    setAiReviewLoading(true);
    setAiReview("");
    try {
      const result = await requestAI({
        endpoint: data.settings.aiEndpoint,
        message:
          "请复核以下课程与任务排程候选。检查截止日期、课程冲突、缓冲、精力水平和时间不足，说明是否应调整；不要自动写入日程。",
        mode: "advisory",
        history: [],
        context: {
          energy,
          settings: data.settings,
          courses: data.courses,
          courseChanges: data.courseChanges,
          schedules: data.schedules,
          tasks: data.tasks,
          suggestions,
          unscheduled,
        },
      });
      setAiReview(result.reply);
    } catch (error) {
      setAiReview(
        error instanceof Error ? `AI 复核失败：${error.message}` : "AI 复核失败。",
      );
    } finally {
      setAiReviewLoading(false);
    }
  };

  return (
    <div className="page planning-page">
      <PageHeader
        eyebrow="时间与课程"
        title="规划"
        description="课程、固定安排和任务排期在同一套真实时间模型里工作。"
        actions={
          <Button icon={Sparkles} onClick={openPlanner}>
            智能排程
          </Button>
        }
      />
      <div className="planning-topline">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "schedule", label: "日程与周计划" },
            { value: "courses", label: "课程表" },
          ]}
        />
        <span>
          今日 {formatShortDate(todayKey())} · 排程会避开必须专心的课程
        </span>
      </div>

      {tab === "schedule" ? (
        <SchedulePage embedded onOpenPlanner={openPlanner} />
      ) : (
        <CoursesPage embedded />
      )}

      <Modal
        open={plannerOpen}
        title="智能排程"
        description="这是可解释的本地排程引擎；接入真实 AI 后会给出进一步分析，但写入仍需确认。"
        onClose={() => setPlannerOpen(false)}
        width="760px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlannerOpen(false)}>
              取消
            </Button>
            <Button
              icon={Check}
              onClick={confirmPlan}
              disabled={!selected.length}
            >
              确认写入 {selected.length} 个安排
            </Button>
          </>
        }
      >
        <div className="planner-studio">
          <div className="planner-energy">
            <div>
              <span className="section-kicker">今天的状态</span>
              <h3>选择精力水平</h3>
            </div>
            <Tabs
              value={energy}
              onChange={(value) => {
                setEnergy(value);
                const result = buildPlanningSuggestions(data, value);
                setSuggestions(result.suggestions);
                setUnscheduled(result.unscheduled);
                setSummary({
                  busyMinutes: result.busyMinutes,
                  freeMinutes: result.freeMinutes,
                });
                setSelected(
                  result.suggestions.map((suggestion) => suggestion.id),
                );
              }}
              options={[
                { value: "high", label: "充沛" },
                { value: "steady", label: "稳定" },
                { value: "low", label: "低精力" },
              ]}
            />
          </div>
          <div className="planner-metrics">
            <div>
              <Clock3 size={16} />
              <span>已占用</span>
              <strong>{Math.round(summary.busyMinutes / 6) / 10} 小时</strong>
            </div>
            <div>
              <CalendarDays size={16} />
              <span>可规划</span>
              <strong>{Math.round(summary.freeMinutes / 6) / 10} 小时</strong>
            </div>
            <div>
              <GraduationCap size={16} />
              <span>课程冲突</span>
              <strong>已避开</strong>
            </div>
          </div>
          <div className="planner-ai-review">
            <Button
              size="sm"
              variant="secondary"
              icon={Sparkles}
              disabled={
                !data.settings.aiEndpoint ||
                !data.settings.aiConsent ||
                aiReviewLoading
              }
              onClick={reviewPlanWithAI}
            >
              {aiReviewLoading ? "AI 复核中…" : "请真实 AI 复核"}
            </Button>
            <span>
              {data.settings.aiEndpoint && data.settings.aiConsent
                ? "AI 会复核本地排程，但不会自动写入。"
                : "真实 AI 未配置；当前只展示可解释的本地排程结果。"}
            </span>
          </div>
          {aiReview ? (
            <div className="planner-ai-result">
              {aiReview.split("\n").map((line, index) => (
                <p key={index}>{line || "\u00a0"}</p>
              ))}
            </div>
          ) : null}
          <ProgressBar
            value={
              summary.busyMinutes + summary.freeMinutes
                ? (summary.busyMinutes /
                    (summary.busyMinutes + summary.freeMinutes)) *
                  100
                : 0
            }
            color="orange"
          />
          <div className="planner-results">
            {suggestions.map((suggestion) => (
              <label
                className={`planner-suggestion ${selected.includes(suggestion.id) ? "selected" : ""}`}
                key={suggestion.id}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(suggestion.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, suggestion.id]
                        : current.filter((id) => id !== suggestion.id),
                    )
                  }
                />
                <div>
                  <div className="planner-suggestion-head">
                    <strong>{suggestion.taskTitle}</strong>
                    <span>
                      {formatShortDate(suggestion.date)} · {suggestion.start}-
                      {suggestion.end}
                    </span>
                  </div>
                  <p>{suggestion.reason}</p>
                  <div className="planner-suggestion-meta">
                    <em>{suggestion.minutes} 分钟</em>
                    <em>{suggestion.source === "free" ? "完整空闲" : "课程弹性时间"}</em>
                  </div>
                </div>
              </label>
            ))}
            {!suggestions.length ? (
              <div className="planner-empty">
                <Clock3 size={20} />
                <p>未来几天没有足够连续空闲时间。可以减少任务范围或延后截止日期。</p>
              </div>
            ) : null}
          </div>
          {unscheduled.length ? (
            <div className="planner-shortage">
              <TriangleAlert size={17} />
              <div>
                <strong>以下任务无法在期限内完整安排</strong>
                {unscheduled.map((item) => (
                  <p key={item.taskId}>
                    {item.taskTitle} · 还差 {item.minutes} 分钟
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
