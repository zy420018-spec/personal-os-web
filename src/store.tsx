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

const loadData = (): AppData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AppData;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    // A clean first-run dataset is safer than a broken persisted state.
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
  createGoal: (goal: Omit<Goal, "id" | "createdAt">) => void;
  updateGoal: (goal: Goal) => void;
  deleteGoal: (goalId: string) => void;
  createProject: (project: Omit<Project, "id" | "createdAt">) => void;
  updateProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  createSchedule: (schedule: Omit<Schedule, "id">) => void;
  updateSchedule: (schedule: Schedule) => void;
  deleteSchedule: (scheduleId: string) => void;
  createEvidence: (evidence: Omit<Evidence, "id" | "createdAt">) => void;
  saveFocusSession: (session: FocusSession) => void;
  createInboxItem: (item: Omit<InboxItem, "id" | "createdAt">) => void;
  updateInboxItem: (item: InboxItem) => void;
  deleteInboxItem: (itemId: string) => void;
  createKnowledge: (item: Omit<KnowledgeItem, "id" | "createdAt">) => void;
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
        mutate((draft) => ({
          ...draft,
          tasks: draft.tasks.map((item) =>
            item.id === task.id
              ? { ...task, updatedAt: new Date().toISOString() }
              : item,
          ),
        })),
      createTask: (task) => {
        const created: Task = {
          ...task,
          id: id("task"),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mutate((draft) => ({ ...draft, tasks: [created, ...draft.tasks] }));
        return created;
      },
      deleteTask: (taskId) =>
        mutate((draft) => ({
          ...draft,
          tasks: draft.tasks.filter((task) => task.id !== taskId),
          schedules: draft.schedules.filter(
            (schedule) => schedule.taskId !== taskId,
          ),
        })),
      createGoal: (goal) =>
        mutate((draft) => ({
          ...draft,
          goals: [
            {
              ...goal,
              id: id("goal"),
              createdAt: new Date().toISOString(),
            },
            ...draft.goals,
          ],
        })),
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
        })),
      createProject: (project) =>
        mutate((draft) => ({
          ...draft,
          projects: [
            {
              ...project,
              id: id("project"),
              createdAt: new Date().toISOString(),
            },
            ...draft.projects,
          ],
        })),
      updateProject: (project) =>
        mutate((draft) => ({
          ...draft,
          projects: draft.projects.map((item) =>
            item.id === project.id ? project : item,
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
      saveFocusSession: (session) =>
        mutate((draft) => ({
          ...draft,
          focusSessions: draft.focusSessions.some(
            (item) => item.id === session.id,
          )
            ? draft.focusSessions.map((item) =>
                item.id === session.id ? session : item,
              )
            : [session, ...draft.focusSessions],
        })),
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
      createKnowledge: (item) =>
        mutate((draft) => ({
          ...draft,
          knowledge: [
            {
              ...item,
              id: id("knowledge"),
              createdAt: new Date().toISOString(),
            },
            ...draft.knowledge,
          ],
        })),
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
