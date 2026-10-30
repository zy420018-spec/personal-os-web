export type TaskStatus =
  | "todo"
  | "doing"
  | "partial"
  | "done"
  | "abandoned";

export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskFocusRequirement = "light" | "normal" | "deep";
export type TaskPlanningScene = "course" | "short-gap" | "full-gap";

export interface Goal {
  id: string;
  title: string;
  outcome: string;
  description: string;
  deadline?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  outcome: string;
  deadline?: string;
  goalId?: string;
  mode: "simple" | "full";
  background?: string;
  risks?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId?: string;
  goalId?: string;
  status: TaskStatus;
  priority: Priority;
  deadline?: string;
  estimate: number;
  minDuration: number;
  allowSplit: boolean;
  focusRequirement: TaskFocusRequirement;
  planningScenes: TaskPlanningScene[];
  prerequisiteTaskId?: string;
  completedAt?: string;
  remainingWork: string;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  taskId?: string;
  note?: string;
}

export interface Evidence {
  id: string;
  taskId?: string;
  projectId?: string;
  taskTitleSnapshot?: string;
  sessionId?: string;
  type: "text" | "link" | "image" | "file";
  title: string;
  content: string;
  url?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  createdAt: string;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  taskTitleSnapshot?: string;
  startedAt: string;
  endedAt?: string;
  pausedAt?: string;
  totalPausedMs: number;
  status: "active" | "paused" | "ended";
  completion?: "done" | "partial" | "todo";
  outcome?: string;
  distraction?: string;
}

export type CourseFocusLevel = "must" | "light" | "flexible";
export type CourseArrangementMode = "auto" | "manual" | "hybrid";

export interface CourseAvailableWindow {
  id: string;
  startTime: string;
  endTime: string;
}

export interface Course {
  id: string;
  title: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  location: string;
  teacher?: string;
  weeks: number[];
  focusLevel: CourseFocusLevel;
  availableMinutes: number;
  arrangementMode: CourseArrangementMode;
  allowedTaskFocus: TaskFocusRequirement[];
  avoidStartEnd: boolean;
  availableWindows: CourseAvailableWindow[];
  note?: string;
  createdAt: string;
}

export interface CourseChange {
  id: string;
  courseId?: string;
  type: "cancelled" | "rescheduled" | "activity";
  title: string;
  originalDate?: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  focusLevel: CourseFocusLevel;
  note?: string;
  createdAt: string;
}

export type InboxCategory =
  | "idea"
  | "task"
  | "project"
  | "goal"
  | "knowledge";

export interface InboxItem {
  id: string;
  content: string;
  createdAt: string;
  category: InboxCategory;
  archived: boolean;
  convertedTo?: string;
  convertedToId?: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  source?: string;
  url?: string;
  category: string;
  type: "article" | "note" | "book" | "video" | "link";
  tags: string[];
  linkedProjectId?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  type: "daily" | "weekly" | "monthly";
  periodLabel: string;
  periodStart?: string;
  periodEnd?: string;
  completed: number;
  plannedMinutes: number;
  actualMinutes: number;
  highlights: string;
  blockers: string;
  nextAction: string;
  taskIds?: string[];
  projectIds?: string[];
  focusSessionIds?: string[];
  evidenceIds?: string[];
  createdAt: string;
}

export type NotificationCategory = "task" | "project" | "ai";

export interface Notification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  relatedId?: string;
  read: boolean;
  createdAt: string;
  simulated?: boolean;
}

export interface FollowUp {
  id: string;
  relatedType: "project" | "task" | "inbox";
  relatedId: string;
  reason: string;
  status: "open" | "resolved";
  createdAt: string;
}

export interface GrowthEntry {
  id: string;
  title: string;
  category: "ability" | "practice" | "milestone";
  summary: string;
  date: string;
  skills: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  simulated?: boolean;
  proposedActions?: {
    type: "create_task";
    title: string;
    estimate: number;
  }[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  mode: "advisory" | "collaborative" | "proactive";
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AIActionLog {
  id: string;
  action: string;
  detail: string;
  confirmed: boolean;
  createdAt: string;
}

export interface AppSettings {
  name: string;
  compactMode: boolean;
  semesterStart: string;
  totalWeeks: number;
  dayStart: string;
  dayEnd: string;
  aiEndpoint: string;
  aiConsent: boolean;
}

export interface AppData {
  version: number;
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  schedules: Schedule[];
  courses: Course[];
  courseChanges: CourseChange[];
  focusSessions: FocusSession[];
  evidence: Evidence[];
  inbox: InboxItem[];
  knowledge: KnowledgeItem[];
  reviews: Review[];
  notifications: Notification[];
  followUps: FollowUp[];
  growth: GrowthEntry[];
  conversations: Conversation[];
  aiLogs: AIActionLog[];
  settings: AppSettings;
}

export type PageId =
  | "dashboard"
  | "planning"
  | "library"
  | "schedule"
  | "goals"
  | "inbox"
  | "knowledge"
  | "growth"
  | "assistant"
  | "focus"
  | "review"
  | "notifications";
