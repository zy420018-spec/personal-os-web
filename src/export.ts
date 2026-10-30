import type {
  AppData,
  Evidence,
  FocusSession,
  GrowthEntry,
  Project,
  Review,
  Task,
} from "./types";
import {
  durationLabel,
  formatShortDate,
  startOfWeek,
  toDateKey,
  todayKey,
} from "./date";

export interface ReviewPeriodData {
  type: Review["type"];
  start: string;
  end: string;
  label: string;
  tasks: Task[];
  focusSessions: FocusSession[];
  evidence: Evidence[];
  projects: Project[];
  growth: GrowthEntry[];
  completed: number;
  partial: number;
  unfinished: Task[];
  plannedMinutes: number;
  actualMinutes: number;
  completionRate: number;
}

const inRange = (value: string | undefined, start: string, end: string) =>
  Boolean(value && value >= start && value <= end);

export const getReviewPeriod = (
  data: AppData,
  type: Review["type"],
  anchor = todayKey(),
): ReviewPeriodData => {
  const anchorDate = new Date(`${anchor}T12:00:00`);
  let startDate: Date;
  let endDate: Date;
  let label: string;
  if (type === "daily") {
    startDate = anchorDate;
    endDate = anchorDate;
    label = `${formatShortDate(anchor)} 每日复盘`;
  } else if (type === "weekly") {
    startDate = startOfWeek(anchorDate);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    label = `${formatShortDate(toDateKey(startDate))} - ${formatShortDate(
      toDateKey(endDate),
    )} 每周复盘`;
  } else {
    startDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    endDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
    label = `${anchorDate.getFullYear()} 年 ${
      anchorDate.getMonth() + 1
    } 月复盘`;
  }
  const start = toDateKey(startDate);
  const end = toDateKey(endDate);
  const focusSessions = data.focusSessions.filter((session) =>
    inRange(session.startedAt.slice(0, 10), start, end),
  );
  const evidence = data.evidence.filter((item) =>
    inRange(item.createdAt.slice(0, 10), start, end),
  );
  const taskIdsFromSessions = new Set(
    focusSessions.map((session) => session.taskId).filter(Boolean),
  );
  const taskIdsFromSchedules = new Set(
    data.schedules
      .filter((schedule) => inRange(schedule.date, start, end))
      .map((schedule) => schedule.taskId)
      .filter(Boolean),
  );
  const tasks = data.tasks.filter(
    (task) =>
      inRange(task.deadline, start, end) ||
      inRange(task.completedAt?.slice(0, 10), start, end) ||
      (type === "monthly" &&
        inRange(task.createdAt.slice(0, 10), start, end)) ||
      taskIdsFromSessions.has(task.id) ||
      taskIdsFromSchedules.has(task.id),
  );
  const projectIds = new Set(
    tasks.map((task) => task.projectId).filter(Boolean),
  );
  const projects = data.projects.filter((project) =>
    projectIds.has(project.id),
  );
  const growth = data.growth.filter((entry) =>
    inRange(entry.date, start, end),
  );
  const completed = tasks.filter(
    (task) =>
      task.status === "done" &&
      inRange(task.completedAt?.slice(0, 10), start, end),
  ).length;
  const partial = tasks.filter((task) => task.status === "partial").length;
  const unfinished = tasks.filter(
    (task) => !["done", "abandoned"].includes(task.status),
  );
  const plannedMinutes = tasks.reduce(
    (sum, task) => sum + task.estimate,
    0,
  );
  const actualMinutes = Math.round(
    focusSessions.reduce((sum, session) => {
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
  const completionRate = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  return {
    type,
    start,
    end,
    label,
    tasks,
    focusSessions,
    evidence,
    projects,
    growth,
    completed,
    partial,
    unfinished,
    plannedMinutes,
    actualMinutes,
    completionRate,
  };
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export const downloadText = (
  content: string,
  filename: string,
  type: string,
) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const reviewToMarkdown = (
  period: ReviewPeriodData,
  answers: { highlights: string; blockers: string; nextAction: string },
) => {
  const completedTasks = period.tasks
    .filter((task) => task.status === "done")
    .map((task) => `- ${task.title}`)
    .join("\n");
  const unfinishedTasks = period.unfinished
    .map(
      (task) =>
        `- ${task.title}${task.remainingWork ? `：${task.remainingWork}` : ""}`,
    )
    .join("\n");
  const evidence = period.evidence
    .map((item) => `- ${item.title}${item.url ? ` (${item.url})` : ""}`)
    .join("\n");
  return `# ${period.label}

> 周期：${period.start} 至 ${period.end}

## 数据摘要

| 指标 | 数值 |
| --- | ---: |
| 任务数 | ${period.tasks.length} |
| 已完成 | ${period.completed} |
| 部分完成 | ${period.partial} |
| 未完成 | ${period.unfinished.length} |
| 计划耗时 | ${durationLabel(period.plannedMinutes)} |
| 实际专注 | ${durationLabel(period.actualMinutes)} |
| 完成率 | ${period.completionRate}% |

## 完成的任务

${completedTasks || "暂无"}

## 未完成与剩余工作

${unfinishedTasks || "暂无"}

## 成果材料

${evidence || "暂无"}

## 重要发现

${answers.highlights || "未填写"}

## 阻碍与问题

${answers.blockers || "未填写"}

## 下一步调整

${answers.nextAction || "未填写"}
`;
};

export const reviewToCsv = (period: ReviewPeriodData) => {
  const header = [
    "任务",
    "项目",
    "状态",
    "优先级",
    "预计分钟",
    "截止日期",
    "完成时间",
    "剩余工作",
  ];
  const rows = period.tasks.map((task) => {
    const project = period.projects.find(
      (item) => item.id === task.projectId,
    );
    return [
      task.title,
      project?.title || "独立任务",
      task.status,
      task.priority,
      task.estimate,
      task.deadline || "",
      task.completedAt || "",
      task.remainingWork,
    ].map(csvCell);
  });
  return `\uFEFF${header.map(csvCell).join(",")}\n${rows
    .map((row) => row.join(","))
    .join("\n")}`;
};

export const openReviewPrint = (
  period: ReviewPeriodData,
  answers: { highlights: string; blockers: string; nextAction: string },
) => {
  const popup = window.open("", "_blank", "width=920,height=760");
  if (!popup) throw new Error("浏览器阻止了打印窗口，请允许弹窗后重试。");
  const completedTasks = period.tasks
    .filter((task) => task.status === "done")
    .map((task) => `<li>${escapeHtml(task.title)}</li>`)
    .join("");
  popup.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(period.label)}</title>
<style>
body{font-family:"Segoe UI","Microsoft YaHei",sans-serif;color:#17201b;margin:36px;line-height:1.7}
h1{font-size:28px;margin:0 0 4px}h2{font-size:17px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:6px}
.meta{color:#68736c}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:20px 0}
.metric{border:1px solid #ddd;padding:12px}.metric strong{display:block;font-size:22px}.metric span{color:#68736c;font-size:11px}
ul{padding-left:22px}.section{white-space:pre-wrap;background:#f7f7f3;padding:14px;border:1px solid #e4e3dc}
@media print{body{margin:18mm}.no-print{display:none}}
</style>
</head>
<body>
<h1>${escapeHtml(period.label)}</h1>
<div class="meta">${escapeHtml(period.start)} 至 ${escapeHtml(period.end)}</div>
<div class="metrics">
<div class="metric"><strong>${period.completed}</strong><span>完成任务</span></div>
<div class="metric"><strong>${period.unfinished.length}</strong><span>未完成</span></div>
<div class="metric"><strong>${phraseDuration(period.actualMinutes)}</strong><span>实际专注</span></div>
<div class="metric"><strong>${period.completionRate}%</strong><span>完成率</span></div>
</div>
<h2>完成的任务</h2><ul>${completedTasks || "<li>暂无</li>"}</ul>
<h2>重要发现</h2><div class="section">${escapeHtml(answers.highlights || "未填写")}</div>
<h2>阻碍与问题</h2><div class="section">${escapeHtml(answers.blockers || "未填写")}</div>
<h2>下一步调整</h2><div class="section">${escapeHtml(answers.nextAction || "未填写")}</div>
<button class="no-print" onclick="window.print()">打印 / 保存为 PDF</button>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body>
</html>`);
  popup.document.close();
};

const phraseDuration = (minutes: number) => durationLabel(minutes);
