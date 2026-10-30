import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AIActionLog,
  AppData,
  Course,
  CourseChange,
  Conversation,
  Evidence,
  FocusSession,
  Goal,
  GrowthEntry,
  InboxItem,
  KnowledgeItem,
  Notification,
  Project,
  Review,
  Schedule,
  Task,
} from "./types";
import { createSeedData } from "./data/seed";

const STORAGE_KEY = "personal-os-data-v1";
const CURRENT_VERSION = 2;

const normalizeData = (source: Partial<AppData>): AppData => {
  const defaults = createSeedData();
  const settings = {
    ...defaults.settings,
    ...(source.settings || {}),
  };
  const tasks = (source.tasks || []).map((task) => ({
    ...task,
    remainingWork: task.remainingWork || "",
    completedAt:
      task.completedAt ||
      (task.status === "done" ? task.updatedAt || task.createdAt : undefined),
  }));
  const reviews = (source.reviews || []).map((review) => ({
    ...review,
    taskIds: review.taskIds || [],
    projectIds: review.projectIds || [],
    focusSessionIds: review.focusSessionIds || [],
    evidenceIds: review.evidenceIds || [],
  }));

  return {
    ...defaults,
    ...source,
    version: CURRENT_VERSION,
    goals: source.goals || [],
    projects: source.projects || [],
    tasks,
    schedules: source.schedules || [],
    courses: source.courses || [],
    courseChanges: source.courseChanges || [],
    focusSessions: source.focusSessions || [],
    evidence: source.evidence || [],
    inbox: source.inbox || [],
    knowledge: source.knowledge || [],
    reviews,
    notifications: source.notifications || [],
    followUps: source.followUps || [],
    growth: source.growth || [],
    conversations: source.conversations || [],
    aiLogs: source.aiLogs || [],
    settings,
  };
};

const loadData = (): AppData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AppData;
      if (parsed && Array.isArray(parsed.tasks)) {
        if (parsed.version !== CURRENT_VERSION) {
          localStorage.setItem(
            `${STORAGE_KEY}-backup-${Date.now()}`,
            stored,
          );
        }
        return normalizeData(parsed);
      }
    }
  } catch {
    // Keep the original value untouched so a user can recover it manually.
  }
  return createSeedData();
};

const id = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export interface StoreValue {
  data: AppData;
  updateTask: (task: Task) => void;
  createTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => Task;
  deleteTask: (taskId: string) => void;
  createGoal: (goal: Omit<Goal, "id" | "createdAt">) => Goal;
  updateGoal: (goal: Goal) => void;
  deleteGoal: (goalId: string) => void;
  createProject: (project: Omit<Project, "id" | "createdAt">) => Project;
  updateProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  createSchedule: (schedule: Omit<Schedule, "id">) => void;
  updateSchedule: (schedule: Schedule) => void;
  deleteSchedule: (scheduleId: string) => void;
  createCourse: (course: Omit<Course, "id" | "createdAt">) => void;
  updateCourse: (course: Course) => void;
  deleteCourse: (courseId: string) => void;
  createCourseChange: (
    change: Omit<CourseChange, "id" | "createdAt">,
  ) => void;
  updateCourseChange: (change: CourseChange) => void;
  deleteCourseChange: (changeId: string) => void;
  createEvidence: (evidence: Omit<Evidence, "id" | "createdAt">) => void;
  deleteEvidence: (evidenceId: string) => void;
  saveFocusSession: (session: FocusSession) => void;
  createInboxItem: (item: Omit<InboxItem, "id" | "createdAt">) => void;
  updateInboxItem: (item: InboxItem) => void;
  deleteInboxItem: (itemId: string) => void;
  createKnowledge: (
    item: Omit<KnowledgeItem, "id" | "createdAt">,
  ) => KnowledgeItem;
  updateKnowledge: (item: KnowledgeItem) => void;
  deleteKnowledge: (itemId: string) => void;
  createReview: (review: Omit<Review, "id" | "createdAt">) => void;
  updateNotification: (notification: Notification) => void;
  markAllNotificationsRead: () => void;
  createGrowth: (entry: Omit<GrowthEntry, "id">) => void;
  deleteGrowth: (entryId: string) => void;
  saveConversation: (conversation: Conversation) => void;
  createConversation: (conversation: Conversation) => void;
  addAILog: (log: Omit<AIActionLog, "id" | "createdAt">) => void;
  setSettings: (settings: AppData["settings"]) => void;
  importData: (data: AppData) => void;
  resetData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const value = useMemo<StoreValue>(() => {
    const mutate = (updater: (draft: AppData) => AppData) =>
      setData((current) => updater(structuredClone(current)));

    return {
      data,
      updateTask: (task) =>
        mutate((draft) => {
          const now = new Date().toISOString();
          return {
            ...draft,
            tasks: draft.tasks.map((item) => {
              if (item.id !== task.id) return item;
              return {
                ...task,
                completedAt:
                  task.status === "done"
                    ? item.completedAt || now
                    : undefined,
                updatedAt: now,
              };
            }),
          };
        }),
      createTask: (task) => {
        const created: Task = {
          ...task,
          id: id("task"),
          completedAt:
            task.status === "done" ? new Date().toISOString() : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mutate((draft) => ({ ...draft, tasks: [created, ...draft.tasks] }));
        return created;
      },
      deleteTask: (taskId) =>
        mutate((draft) => {
          const task = draft.tasks.find((item) => item.id === taskId);
          return {
            ...draft,
            tasks: draft.tasks.filter((item) => item.id !== taskId),
            schedules: draft.schedules.filter(
              (schedule) => schedule.taskId !== taskId,
            ),
            focusSessions: draft.focusSessions.map((session) =>
              session.taskId === taskId
                ? {
                    ...session,
                    taskId: undefined,
                    taskTitleSnapshot: task?.title,
                  }
                : session,
            ),
            evidence: draft.evidence.map((item) =>
              item.taskId === taskId
                ? {
                    ...item,
                    taskId: undefined,
                    taskTitleSnapshot: task?.title,
                  }
                : item,
            ),
            reviews: draft.reviews.map((review) => ({
              ...review,
              taskIds: (review.taskIds || []).filter(
                (idValue) => idValue !== taskId,
              ),
            })),
          };
        }),
      createGoal: (goal) => {
        const created: Goal = {
          ...goal,
          id: id("goal"),
          createdAt: new Date().toISOString(),
        };
        mutate((draft) => ({
          ...draft,
          goals: [created, ...draft.goals],
        }));
        return created;
      },
      updateGoal: (goal) =>
        mutate((draft) => ({
          ...draft,
          goals: draft.goals.map((item) =>
            item.id === goal.id ? goal : item,
          ),
        })),
      deleteGoal: (goalId) =>
        mutate((draft) => ({
          ...draft,
          goals: draft.goals.filter((goal) => goal.id !== goalId),
          projects: draft.projects.map((project) =>
            project.goalId === goalId
              ? { ...project, goalId: undefined }
              : project,
          ),
          tasks: draft.tasks.map((task) =>
            task.goalId === goalId ? { ...task, goalId: undefined } : task,
          ),
        })),
      createProject: (project) => {
        const created: Project = {
          ...project,
          id: id("project"),
          createdAt: new Date().toISOString(),
        };
        mutate((draft) => ({
          ...draft,
          projects: [created, ...draft.projects],
        }));
        return created;
      },
      updateProject: (project) =>
        mutate((draft) => ({
          ...draft,
          projects: draft.projects.map((item) =>
            item.id === project.id ? project : item,
          ),
          tasks: draft.tasks.map((task) =>
            task.projectId === project.id
              ? { ...task, goalId: project.goalId }
              : task,
          ),
        })),
      deleteProject: (projectId) =>
        mutate((draft) => ({
          ...draft,
          projects: draft.projects.filter(
            (project) => project.id !== projectId,
          ),
          tasks: draft.tasks.map((task) =>
            task.projectId === projectId
              ? { ...task, projectId: undefined }
              : task,
          ),
          knowledge: draft.knowledge.map((item) =>
            item.linkedProjectId === projectId
              ? { ...item, linkedProjectId: undefined }
              : item,
          ),
          evidence: draft.evidence.map((item) =>
            item.projectId === projectId
              ? { ...item, projectId: undefined }
              : item,
          ),
        })),
      createSchedule: (schedule) =>
        mutate((draft) => ({
          ...draft,
          schedules: [
            ...draft.schedules,
            { ...schedule, id: id("schedule") },
          ],
        })),
      updateSchedule: (schedule) =>
        mutate((draft) => ({
          ...draft,
          schedules: draft.schedules.map((item) =>
            item.id === schedule.id ? schedule : item,
          ),
        })),
      deleteSchedule: (scheduleId) =>
        mutate((draft) => ({
          ...draft,
          schedules: draft.schedules.filter(
            (schedule) => schedule.id !== scheduleId,
          ),
        })),
      createCourse: (course) =>
        mutate((draft) => ({
          ...draft,
          courses: [
            {
              ...course,
              id: id("course"),
              createdAt: new Date().toISOString(),
            },
            ...draft.courses,
          ],
        })),
      updateCourse: (course) =>
        mutate((draft) => ({
          ...draft,
          courses: draft.courses.map((item) =>
            item.id === course.id ? course : item,
          ),
        })),
      deleteCourse: (courseId) =>
        mutate((draft) => ({
          ...draft,
          courses: draft.courses.filter((course) => course.id !== courseId),
          courseChanges: draft.courseChanges.filter(
            (change) => change.courseId !== courseId,
          ),
        })),
      createCourseChange: (change) =>
        mutate((draft) => ({
          ...draft,
          courseChanges: [
            {
              ...change,
              id: id("course-change"),
              createdAt: new Date().toISOString(),
            },
            ...draft.courseChanges,
          ],
        })),
      updateCourseChange: (change) =>
        mutate((draft) => ({
          ...draft,
          courseChanges: draft.courseChanges.map((item) =>
            item.id === change.id ? change : item,
          ),
        })),
      deleteCourseChange: (changeId) =>
        mutate((draft) => ({
          ...draft,
          courseChanges: draft.courseChanges.filter(
            (change) => change.id !== changeId,
          ),
        })),
      createEvidence: (evidence) =>
        mutate((draft) => ({
          ...draft,
          evidence: [
            {
              ...evidence,
              id: id("evidence"),
              createdAt: new Date().toISOString(),
            },
            ...draft.evidence,
          ],
        })),
      deleteEvidence: (evidenceId) =>
        mutate((draft) => ({
          ...draft,
          evidence: draft.evidence.filter((item) => item.id !== evidenceId),
        })),
      saveFocusSession: (session) =>
        mutate((draft) => {
          const hasAnotherOpenSession = draft.focusSessions.some(
            (item) =>
              item.id !== session.id &&
              (item.status === "active" || item.status === "paused"),
          );
          if (
            hasAnotherOpenSession &&
            (session.status === "active" || session.status === "paused")
          ) {
            return draft;
          }
          return {
            ...draft,
            focusSessions: draft.focusSessions.some(
              (item) => item.id === session.id,
            )
              ? draft.focusSessions.map((item) =>
                  item.id === session.id ? session : item,
                )
              : [session, ...draft.focusSessions],
          };
        }),
      createInboxItem: (item) =>
        mutate((draft) => ({
          ...draft,
          inbox: [
            {
              ...item,
              id: id("inbox"),
              createdAt: new Date().toISOString(),
            },
            ...draft.inbox,
          ],
        })),
      updateInboxItem: (item) =>
        mutate((draft) => ({
          ...draft,
          inbox: draft.inbox.map((entry) =>
            entry.id === item.id ? item : entry,
          ),
        })),
      deleteInboxItem: (itemId) =>
        mutate((draft) => ({
          ...draft,
          inbox: draft.inbox.filter((item) => item.id !== itemId),
        })),
      createKnowledge: (item) => {
        const created: KnowledgeItem = {
          ...item,
          id: id("knowledge"),
          createdAt: new Date().toISOString(),
        };
        mutate((draft) => ({
          ...draft,
          knowledge: [created, ...draft.knowledge],
        }));
        return created;
      },
      updateKnowledge: (item) =>
        mutate((draft) => ({
          ...draft,
          knowledge: draft.knowledge.map((entry) =>
            entry.id === item.id ? item : entry,
          ),
        })),
      deleteKnowledge: (itemId) =>
        mutate((draft) => ({
          ...draft,
          knowledge: draft.knowledge.filter((item) => item.id !== itemId),
        })),
      createReview: (review) =>
        mutate((draft) => ({
          ...draft,
          reviews: [
            {
              ...review,
              id: id("review"),
              createdAt: new Date().toISOString(),
            },
            ...draft.reviews,
          ],
        })),
      updateNotification: (notification) =>
        mutate((draft) => ({
          ...draft,
          notifications: draft.notifications.map((item) =>
            item.id === notification.id ? notification : item,
          ),
        })),
      markAllNotificationsRead: () =>
        mutate((draft) => ({
          ...draft,
          notifications: draft.notifications.map((item) => ({
            ...item,
            read: true,
          })),
        })),
      createGrowth: (entry) =>
        mutate((draft) => ({
          ...draft,
          growth: [
            { ...entry, id: id("growth") },
            ...draft.growth,
          ],
        })),
      deleteGrowth: (entryId) =>
        mutate((draft) => ({
          ...draft,
          growth: draft.growth.filter((entry) => entry.id !== entryId),
        })),
      saveConversation: (conversation) =>
        mutate((draft) => ({
          ...draft,
          conversations: draft.conversations.some(
            (item) => item.id === conversation.id,
          )
            ? draft.conversations.map((item) =>
                item.id === conversation.id ? conversation : item,
              )
            : [conversation, ...draft.conversations],
        })),
      createConversation: (conversation) =>
        mutate((draft) => ({
          ...draft,
          conversations: [conversation, ...draft.conversations],
        })),
      addAILog: (log) =>
        mutate((draft) => ({
          ...draft,
          aiLogs: [
            {
              ...log,
              id: id("ai-log"),
              createdAt: new Date().toISOString(),
            },
            ...draft.aiLogs,
          ],
        })),
      setSettings: (settings) =>
        mutate((draft) => ({ ...draft, settings })),
      importData: (imported) => {
        const current = localStorage.getItem(STORAGE_KEY);
        if (current) {
          localStorage.setItem(
            `${STORAGE_KEY}-backup-import-${Date.now()}`,
            current,
          );
        }
        setData(normalizeData(imported));
      },
      resetData: () => setData(createSeedData()),
    };
  }, [data]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
};
