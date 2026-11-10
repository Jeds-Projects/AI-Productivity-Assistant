import { useSyncExternalStore } from "react";
import { MINUTES_SAVED } from "./stats";
import type {
  Activity,
  ActivityType,
  AppData,
  EmailOutput,
  Insights,
  MeetingOutput,
  Schedule,
  Settings,
  Task,
} from "./types";

const STORAGE_KEY = "ai-workplace-assistant:v1";

export const DEFAULT_DISCLAIMER =
  "AI-generated content may contain errors, omissions or outdated information. Always review, verify and edit outputs before using them in professional communication or decision-making, and avoid sharing confidential data you are not authorised to process.";

export const DEFAULT_SETTINGS: Settings = {
  userName: "",
  role: "",
  workStart: "09:00",
  workEnd: "17:00",
  model: "gemini-2.5-flash",
  disclaimer: DEFAULT_DISCLAIMER,
};

export const DEFAULT_DATA: AppData = {
  version: 1,
  tasks: [],
  emails: [],
  meetings: [],
  schedules: [],
  activity: [],
  settings: DEFAULT_SETTINGS,
  insights: undefined,
  readNotifications: [],
};

let state: AppData | null = null;
const listeners = new Set<() => void>();

function load(): AppData {
  if (typeof window === "undefined") return DEFAULT_DATA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      ...DEFAULT_DATA,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return DEFAULT_DATA;
  }
}

function getSnapshot(): AppData {
  if (state === null) state = load();
  return state;
}

function getServerSnapshot(): AppData {
  return DEFAULT_DATA;
}

function persist(next: AppData) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("Could not save to localStorage", e);
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setData(updater: (prev: AppData) => AppData) {
  const next = updater(getSnapshot());
  state = next;
  persist(next);
  listeners.forEach((l) => l());
}

export function getData() {
  return getSnapshot();
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function uid() {
  return crypto.randomUUID();
}

const now = () => new Date().toISOString();

function activity(type: ActivityType, title: string, refId?: string): Activity {
  return { id: uid(), type, title, at: now(), minutesSaved: MINUTES_SAVED[type], refId };
}

const MAX_ACTIVITY = 300;
function withActivity(prev: AppData, a: Activity): Activity[] {
  return [a, ...prev.activity].slice(0, MAX_ACTIVITY);
}

/* ---------- Actions ---------- */

export const actions = {
  addTask(input: Omit<Task, "id" | "createdAt" | "completed">) {
    const task: Task = { ...input, id: uid(), createdAt: now(), completed: false };
    setData((p) => ({
      ...p,
      tasks: [task, ...p.tasks],
      activity: withActivity(p, activity("task_added", `Added task "${task.title}"`, task.id)),
    }));
    return task;
  },
  updateTask(id: string, patch: Partial<Task>) {
    setData((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },
  deleteTask(id: string) {
    setData((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== id) }));
  },
  toggleTask(id: string) {
    setData((p) => {
      const task = p.tasks.find((t) => t.id === id);
      if (!task) return p;
      const completed = !task.completed;
      return {
        ...p,
        tasks: p.tasks.map((t) =>
          t.id === id ? { ...t, completed, completedAt: completed ? now() : undefined } : t,
        ),
        activity: completed
          ? withActivity(p, activity("task_completed", `Completed "${task.title}"`, id))
          : p.activity.filter((a) => !(a.type === "task_completed" && a.refId === id)),
      };
    });
  },

  addEmail(input: Omit<EmailOutput, "id" | "createdAt">) {
    const email: EmailOutput = { ...input, id: uid(), createdAt: now() };
    setData((p) => ({
      ...p,
      emails: [email, ...p.emails].slice(0, 50),
      activity: withActivity(p, activity("email", `Email: ${email.result.subject}`, email.id)),
    }));
    return email;
  },
  updateEmail(id: string, patch: Partial<EmailOutput>) {
    setData((p) => ({ ...p, emails: p.emails.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  },
  deleteEmail(id: string) {
    setData((p) => ({ ...p, emails: p.emails.filter((e) => e.id !== id) }));
  },

  addMeeting(input: Omit<MeetingOutput, "id" | "createdAt">) {
    const meeting: MeetingOutput = { ...input, id: uid(), createdAt: now() };
    setData((p) => ({
      ...p,
      meetings: [meeting, ...p.meetings].slice(0, 50),
      activity: withActivity(p, activity("meeting", `Summarised "${meeting.title}"`, meeting.id)),
    }));
    return meeting;
  },
  updateMeeting(id: string, patch: Partial<MeetingOutput>) {
    setData((p) => ({
      ...p,
      meetings: p.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  },
  deleteMeeting(id: string) {
    setData((p) => ({ ...p, meetings: p.meetings.filter((m) => m.id !== id) }));
  },

  addSchedule(input: Omit<Schedule, "id" | "createdAt">) {
    const schedule: Schedule = { ...input, id: uid(), createdAt: now() };
    setData((p) => ({
      ...p,
      schedules: [schedule, ...p.schedules].slice(0, 20),
      activity: withActivity(
        p,
        activity(
          "schedule",
          `Planned a ${schedule.mode === "daily" ? "daily" : "weekly"} schedule`,
          schedule.id,
        ),
      ),
    }));
    return schedule;
  },
  updateSchedule(id: string, updater: (s: Schedule) => Schedule) {
    setData((p) => ({ ...p, schedules: p.schedules.map((s) => (s.id === id ? updater(s) : s)) }));
  },
  deleteSchedule(id: string) {
    setData((p) => ({ ...p, schedules: p.schedules.filter((s) => s.id !== id) }));
  },

  setInsights(insights: Insights) {
    setData((p) => ({
      ...p,
      insights,
      activity: withActivity(p, activity("insights", "Generated productivity insights")),
    }));
  },

  updateSettings(patch: Partial<Settings>) {
    setData((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  },

  markNotificationsRead(ids: string[]) {
    setData((p) => ({
      ...p,
      readNotifications: Array.from(new Set([...p.readNotifications, ...ids])).slice(-500),
    }));
  },

  clearHistory() {
    setData((p) => ({ ...DEFAULT_DATA, settings: p.settings }));
  },

  exportJson() {
    return JSON.stringify(getSnapshot(), null, 2);
  },
};
