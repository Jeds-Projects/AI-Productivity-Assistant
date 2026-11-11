import { describe, expect, it } from "vitest";
import { computeKpis, isUrgent, MINUTES_SAVED, weeklySeries } from "./stats";
import type { Activity, Task } from "./types";

const now = new Date(2026, 10, 10, 15, 0, 0);
const at = (daysAgo: number) => new Date(2026, 10, 10 - daysAgo, 10, 0, 0).toISOString();
const act = (type: Activity["type"], daysAgo: number): Activity => ({
  id: `${type}-${daysAgo}-${Math.random()}`,
  type,
  title: type,
  at: at(daysAgo),
  minutesSaved: MINUTES_SAVED[type],
});
const task = (p: Partial<Task>): Task => ({
  id: Math.random().toString(),
  title: "t",
  durationMin: 30,
  priority: "medium",
  important: false,
  completed: false,
  createdAt: at(0),
  ...p,
});

describe("dashboard KPIs", () => {
  it("counts emails and meetings this week vs last week", () => {
    const activity = [act("email", 0), act("email", 3), act("email", 9), act("meeting", 1)];
    const k = computeKpis({ tasks: [], activity }, now);
    expect(k.emails).toEqual({ total: 3, thisWeek: 2, lastWeek: 1 });
    expect(k.meetings.total).toBe(1);
  });

  it("sums time saved from activity", () => {
    const activity = [act("email", 0), act("meeting", 0), act("schedule", 0)];
    expect(computeKpis({ tasks: [], activity }, now).minutesSaved.total).toBe(12 + 25 + 20);
  });

  it("counts only completed tasks", () => {
    const tasks = [task({ completed: true, completedAt: at(0) }), task({})];
    expect(computeKpis({ tasks, activity: [] }, now).tasksCompleted.total).toBe(1);
  });

  it("weekly series covers 7 days ending today", () => {
    const s = weeklySeries({ tasks: [], activity: [act("email", 0)] }, now);
    expect(s).toHaveLength(7);
    expect(s[6]?.actions).toBe(1);
    expect(s[6]?.minutesSaved).toBe(12);
  });
});

describe("urgency", () => {
  it("treats tasks due within 2 days or overdue as urgent", () => {
    expect(isUrgent(task({ deadline: "2026-11-12" }), now)).toBe(true);
    expect(isUrgent(task({ deadline: "2026-11-08" }), now)).toBe(true);
    expect(isUrgent(task({ deadline: "2026-11-13" }), now)).toBe(false);
    expect(isUrgent(task({}), now)).toBe(false);
  });
});
