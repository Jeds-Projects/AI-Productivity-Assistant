import type { Activity, ActivityType, AppData, Task } from "./types";

/** Estimated minutes a professional saves per AI-assisted action. */
export const MINUTES_SAVED: Record<ActivityType, number> = {
  email: 12,
  meeting: 25,
  schedule: 20,
  insights: 5,
  task_completed: 0,
  task_added: 0,
};

const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inRange(iso: string | undefined, from: number, to: number) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from && t < to;
}

export interface Kpi {
  total: number;
  thisWeek: number;
  lastWeek: number;
}

export interface Kpis {
  tasksCompleted: Kpi;
  minutesSaved: Kpi;
  emails: Kpi;
  meetings: Kpi;
}

export function computeKpis(data: Pick<AppData, "tasks" | "activity">, now = new Date()): Kpis {
  const end = startOfDay(now).getTime() + DAY;
  const weekStart = end - 7 * DAY;
  const prevStart = end - 14 * DAY;

  const count = (list: { at?: string | undefined }[], from: number, to: number) =>
    list.filter((a) => inRange(a.at, from, to)).length;

  const completed = data.tasks.filter((t) => t.completed);
  const completedAt = completed.map((t) => ({ at: t.completedAt }));
  const emails = data.activity.filter((a) => a.type === "email");
  const meetings = data.activity.filter((a) => a.type === "meeting");
  const sumMinutes = (from: number, to: number) =>
    data.activity
      .filter((a) => inRange(a.at, from, to))
      .reduce((s, a) => s + a.minutesSaved, 0);

  return {
    tasksCompleted: {
      total: completed.length,
      thisWeek: count(completedAt, weekStart, end),
      lastWeek: count(completedAt, prevStart, weekStart),
    },
    minutesSaved: {
      total: data.activity.reduce((s, a) => s + a.minutesSaved, 0),
      thisWeek: sumMinutes(weekStart, end),
      lastWeek: sumMinutes(prevStart, weekStart),
    },
    emails: {
      total: emails.length,
      thisWeek: count(emails, weekStart, end),
      lastWeek: count(emails, prevStart, weekStart),
    },
    meetings: {
      total: meetings.length,
      thisWeek: count(meetings, weekStart, end),
      lastWeek: count(meetings, prevStart, weekStart),
    },
  };
}

export interface DayPoint {
  key: string;
  label: string;
  minutesSaved: number;
  actions: number;
  tasksCompleted: number;
}

/** Last 7 days (oldest first), including today. */
export function weeklySeries(
  data: Pick<AppData, "tasks" | "activity">,
  now = new Date(),
): DayPoint[] {
  const today = startOfDay(now);
  const points: DayPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const from = d.getTime();
    const to = from + DAY;
    const acts = data.activity.filter((a) => inRange(a.at, from, to));
    points.push({
      key: toDateKey(d),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      minutesSaved: acts.reduce((s, a) => s + a.minutesSaved, 0),
      actions: acts.filter((a) => a.type !== "task_completed" && a.type !== "task_added").length,
      tasksCompleted: data.tasks.filter((t) => t.completed && inRange(t.completedAt, from, to))
        .length,
    });
  }
  return points;
}

export function formatMinutes(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function daysUntil(deadline: string | undefined, now = new Date()) {
  if (!deadline) return undefined;
  const [y = 0, m = 1, d = 1] = deadline.split("-").map(Number);
  const due = new Date(y, m - 1, d).getTime();
  return Math.round((due - startOfDay(now).getTime()) / DAY);
}

/** Urgent = due within 2 days (or overdue). */
export function isUrgent(task: Task, now = new Date()) {
  const d = daysUntil(task.deadline, now);
  return d !== undefined && d <= 2;
}

export function relativeTime(iso: string, now = new Date()) {
  const diff = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export type { Activity };
