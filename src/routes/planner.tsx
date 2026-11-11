import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  Coffee,
  GripVertical,
  Lightbulb,
  ListTodo,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AiBadge,
  AiDisclaimer,
  AiLoading,
  ApiKeyNotice,
  EmptyState,
  ErrorNotice,
  FieldError,
  PageHeader,
  Panel,
} from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAiRequest } from "@/hooks/use-ai";
import { schedulePrompt, scheduleSchema } from "@/lib/prompts";
import { findConflicts, fromMinutes, moveItem, retime, toMinutes } from "@/lib/schedule-utils";
import { daysUntil, formatMinutes, isUrgent, relativeTime } from "@/lib/stats";
import { actions, uid, useAppData } from "@/lib/store";
import type { BlockKind, Priority, Schedule, ScheduleBlock, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "AI Task Planner — Workplace AI" },
      {
        name: "description",
        content: "Turn tasks, deadlines and priorities into realistic daily and weekly schedules with breaks.",
      },
      { property: "og:title", content: "AI Task Planner — Workplace AI" },
      {
        property: "og:description",
        content: "Prioritised, editable schedules that put urgent and important work first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlannerPage,
});

const PRIORITY_STYLE: Record<Priority, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/15 text-warning-foreground",
  low: "bg-muted text-muted-foreground",
};

const KIND_STYLE: Record<BlockKind, string> = {
  task: "border-l-primary",
  focus: "border-l-deep",
  break: "border-l-cyan bg-cyan/5",
  buffer: "border-l-sky bg-sky/5",
};

interface TaskForm {
  title: string;
  deadline: string;
  duration: string;
  priority: Priority;
  important: boolean;
}

const EMPTY_FORM: TaskForm = { title: "", deadline: "", duration: "60", priority: "medium", important: false };

function validateTask(f: TaskForm) {
  const e: Partial<Record<keyof TaskForm, string | undefined>> = {};
  if (!f.title.trim()) e.title = "Task name is required.";
  const d = Number(f.duration);
  if (!Number.isFinite(d) || d < 5 || d > 600) e.duration = "Use 5–600 minutes.";
  return e;
}

function PlannerPage() {
  const { tasks, schedules, settings } = useAppData();
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<ReturnType<typeof validateTask>>({});
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<"daily" | "weekly">("daily");
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const ai = useAiRequest<Omit<Schedule, "id" | "createdAt" | "mode">>();

  const schedule = schedules.find((s) => s.id === scheduleId) ?? schedules[0] ?? null;
  const openTasks = tasks.filter((t) => !t.completed);

  const visible = useMemo(() => {
    const list = filter === "open" ? tasks.filter((t) => !t.completed) : filter === "done" ? tasks.filter((t) => t.completed) : tasks;
    const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const ua = isUrgent(a) ? 0 : 1;
      const ub = isUrgent(b) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      if (a.important !== b.important) return a.important ? -1 : 1;
      return rank[a.priority] - rank[b.priority];
    });
  }, [tasks, filter]);

  const addTask = () => {
    const e = validateTask(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    actions.addTask({
      title: form.title.trim(),
      deadline: form.deadline || undefined,
      durationMin: Number(form.duration),
      priority: form.priority,
      important: form.important,
    });
    setForm({ ...EMPTY_FORM, priority: form.priority });
    toast.success("Task added");
  };

  const generate = async () => {
    if (openTasks.length === 0) {
      toast.error("Add at least one open task to plan.");
      return;
    }
    if (toMinutes(settings.workEnd) <= toMinutes(settings.workStart)) {
      toast.error("Your working hours are invalid. Fix them in Settings.");
      return;
    }
    const { system, prompt } = schedulePrompt(openTasks, mode, settings);
    const result = await ai.run({ system, prompt, schema: scheduleSchema, temperature: 0.4 });
    if (!result) return;
    const validIds = new Set(openTasks.map((t) => t.id));
    const saved = actions.addSchedule({
      mode,
      summary: result.summary ?? "",
      recommendations: result.recommendations ?? [],
      unscheduled: result.unscheduled ?? [],
      days: (result.days ?? []).map((d) => ({
        id: uid(),
        date: d.date,
        label: d.label,
        blocks: (d.blocks ?? [])
          .map((b) => ({
            ...b,
            id: uid(),
            taskId: b.taskId && validIds.has(b.taskId) ? b.taskId : undefined,
            kind: (["task", "break", "focus", "buffer"].includes(b.kind) ? b.kind : "task") as BlockKind,
          }))
          .sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
      })),
    });
    setScheduleId(saved.id);
    toast.success(`${mode === "daily" ? "Daily" : "Weekly"} schedule ready`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarClock}
        title="AI Task Planner"
        description="Add your tasks and let Gemini build a realistic, prioritised schedule with breaks — then fine-tune it."
      />
      <ApiKeyNotice />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          <Panel title="Add a task" icon={Plus} description="Deadline, duration and priority guide the AI.">
            <form
              className="space-y-3"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                addTask();
              }}
            >
              <div>
                <Label htmlFor="t-title">Task</Label>
                <Input
                  id="t-title"
                  className="mt-1.5"
                  placeholder="e.g. Prepare board presentation"
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    if (errors.title) setErrors({ ...errors, title: undefined });
                  }}
                  aria-invalid={!!errors.title}
                />
                <FieldError message={errors.title} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="t-deadline">Deadline</Label>
                  <Input
                    id="t-deadline"
                    type="date"
                    className="mt-1.5"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="t-duration">Minutes</Label>
                  <Input
                    id="t-duration"
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    className="mt-1.5"
                    value={form.duration}
                    onChange={(e) => {
                      setForm({ ...form, duration: e.target.value });
                      if (errors.duration) setErrors({ ...errors, duration: undefined });
                    }}
                    aria-invalid={!!errors.duration}
                  />
                  <FieldError message={errors.duration} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                    <SelectTrigger className="mt-1.5" aria-label="Priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={form.important} onCheckedChange={(c) => setForm({ ...form, important: c === true })} />
                  Important (high impact)
                </label>
                <Button type="submit">
                  <Plus /> Add task
                </Button>
              </div>
            </form>
          </Panel>

          <Panel
            title="Your tasks"
            icon={ListTodo}
            description={`${openTasks.length} open · ${formatMinutes(openTasks.reduce((s, t) => s + t.durationMin, 0))} estimated`}
            action={
              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <TabsList className="h-8">
                  <TabsTrigger value="open" className="text-xs">Open</TabsTrigger>
                  <TabsTrigger value="done" className="text-xs">Done</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                </TabsList>
              </Tabs>
            }
            bodyClassName="p-2 sm:p-3"
          >
            {visible.length === 0 ? (
              <EmptyState
                icon={ListTodo}
                title={filter === "done" ? "Nothing completed yet" : "No tasks yet"}
                description={filter === "done" ? "Completed tasks will show up here." : "Add tasks above, then generate a schedule."}
                className="py-8"
              />
            ) : (
              <ul className="space-y-1.5">
                {visible.map((t) =>
                  editingId === t.id ? (
                    <TaskEditor key={t.id} task={t} onDone={() => setEditingId(null)} />
                  ) : (
                    <TaskRow key={t.id} task={t} onEdit={() => setEditingId(t.id)} />
                  ),
                )}
              </ul>
            )}
          </Panel>
        </div>

        <Panel
          title={
            <span className="flex items-center gap-2">
              Schedule {schedule && !ai.loading && <AiBadge />}
            </span>
          }
          icon={CalendarDays}
          description={
            schedule ? `${schedule.mode === "daily" ? "Daily" : "Weekly"} plan · generated ${relativeTime(schedule.createdAt)} · drag to rearrange` : `Working hours ${settings.workStart}–${settings.workEnd}`
          }
          action={
            schedules.length > 1 ? (
              <Select value={schedule?.id ?? ""} onValueChange={setScheduleId}>
                <SelectTrigger className="h-8 w-40 text-xs" aria-label="Previous schedules">
                  <SelectValue placeholder="History" />
                </SelectTrigger>
                <SelectContent>
                  {schedules.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.mode === "daily" ? "Daily" : "Weekly"} · {new Date(s.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null
          }
        >
          <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-muted/40 p-3 sm:flex-row sm:items-center">
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="flex-1 text-xs text-muted-foreground">
              Plans {openTasks.length} open task{openTasks.length === 1 ? "" : "s"} using urgency, importance and deadlines.
            </p>
            <div className="flex gap-2">
              {ai.loading && (
                <Button variant="ghost" onClick={ai.cancel}>
                  Cancel
                </Button>
              )}
              <Button variant="hero" onClick={generate} disabled={ai.loading}>
                <Sparkles /> {ai.loading ? "Planning…" : schedule ? "Regenerate" : "Generate schedule"}
              </Button>
            </div>
          </div>

          {ai.loading ? (
            <AiLoading label={`Gemini is building your ${mode} schedule…`} lines={10} />
          ) : ai.error ? (
            <ErrorNotice message={ai.error.message} onRetry={generate} />
          ) : schedule ? (
            <ScheduleView schedule={schedule} tasks={tasks} />
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No schedule yet"
              description="Add tasks with deadlines and durations, choose daily or weekly, and generate a prioritised plan."
            />
          )}
        </Panel>
      </div>

      <AiDisclaimer />
    </div>
  );
}

/* ---------------- Tasks ---------------- */

function DueBadge({ task }: { task: Task }) {
  const d = daysUntil(task.deadline);
  if (d === undefined) return null;
  const label = d < 0 ? `${-d}d overdue` : d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : `Due in ${d}d`;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        d < 0 ? "bg-destructive text-destructive-foreground" : d <= 2 ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function TaskRow({ task, onEdit }: { task: Task; onEdit: () => void }) {
  return (
    <li className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/60">
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => actions.toggleTask(task.id)}
        className="mt-0.5"
        aria-label={task.completed ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", task.completed && "text-muted-foreground line-through")}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", PRIORITY_STYLE[task.priority])}>
            {task.priority}
          </span>
          {task.important && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Star className="size-3" /> Important
            </span>
          )}
          {!task.completed && <DueBadge task={task} />}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3" /> {formatMinutes(task.durationMin)}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} aria-label="Edit task">
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => actions.deleteTask(task.id)} aria-label="Delete task">
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

function TaskEditor({ task, onDone }: { task: Task; onDone: () => void }) {
  const [f, setF] = useState<TaskForm>({
    title: task.title,
    deadline: task.deadline ?? "",
    duration: String(task.durationMin),
    priority: task.priority,
    important: task.important,
  });
  const errs = validateTask(f);
  return (
    <li className="space-y-2 rounded-xl border border-primary/30 bg-accent/40 p-3">
      <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Task name" />
      <div className="grid grid-cols-3 gap-2">
        <Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} aria-label="Deadline" />
        <Input type="number" min={5} max={600} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} aria-label="Minutes" />
        <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as Priority })}>
          <SelectTrigger aria-label="Priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <FieldError message={errs.title ?? errs.duration} />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={f.important} onCheckedChange={(c) => setF({ ...f, important: c === true })} /> Important
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onDone}>
            <X /> Cancel
          </Button>
          <Button
            size="sm"
            disabled={Object.keys(errs).length > 0}
            onClick={() => {
              actions.updateTask(task.id, {
                title: f.title.trim(),
                deadline: f.deadline || undefined,
                durationMin: Number(f.duration),
                priority: f.priority,
                important: f.important,
              });
              onDone();
            }}
          >
            <Check /> Save
          </Button>
        </div>
      </div>
    </li>
  );
}

/* ---------------- Schedule ---------------- */

function ScheduleView({ schedule, tasks }: { schedule: Schedule; tasks: Task[] }) {
  const [dayIdx, setDayIdx] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const day = schedule.days[Math.min(dayIdx, schedule.days.length - 1)];
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const conflicts = useMemo(() => (day ? findConflicts(day.blocks) : new Set<string>()), [day]);

  const updateBlocks = (updater: (blocks: ScheduleBlock[]) => ScheduleBlock[]) => {
    if (!day) return;
    actions.updateSchedule(schedule.id, (s) => ({
      ...s,
      days: s.days.map((d) => (d.id === day.id ? { ...d, blocks: updater(d.blocks) } : d)),
    }));
  };

  const move = (from: number, to: number) => updateBlocks((b) => retime(moveItem(b, from, to)));

  const addBlock = () =>
    updateBlocks((b) => {
      const last = b[b.length - 1];
      const start = last ? toMinutes(last.end) : 9 * 60;
      return [...b, { id: uid(), start: fromMinutes(start), end: fromMinutes(start + 30), title: "New block", kind: "task" }];
    });

  const totalWork = day?.blocks.filter((b) => b.kind === "task" || b.kind === "focus").reduce((s, b) => s + toMinutes(b.end) - toMinutes(b.start), 0) ?? 0;
  const totalBreak = day?.blocks.filter((b) => b.kind === "break").reduce((s, b) => s + toMinutes(b.end) - toMinutes(b.start), 0) ?? 0;

  return (
    <div className="space-y-5">
      {schedule.summary && (
        <p className="rounded-xl bg-navy-gradient p-4 text-sm leading-relaxed text-on-dark-muted shadow-card">
          <span className="mb-1 flex items-center gap-1.5 font-semibold text-on-dark">
            <Target className="size-4 text-sky" /> Strategy
          </span>
          {schedule.summary}
        </p>
      )}

      {schedule.days.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {schedule.days.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDayIdx(i)}
              className={cn(
                "shrink-0 rounded-xl border px-3 py-2 text-left transition-all",
                i === dayIdx ? "border-primary bg-accent shadow-glow" : "bg-card hover:border-primary/40",
              )}
            >
              <span className="block text-xs font-semibold">{d.label}</span>
              <span className="block text-[11px] text-muted-foreground">{d.blocks.filter((b) => b.kind === "task").length} tasks</span>
            </button>
          ))}
        </div>
      )}

      {!day ? (
        <p className="text-sm text-muted-foreground">Gemini didn't return any days for this schedule. Try regenerating.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{day.label}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {formatMinutes(totalWork)} work</span>
            <span className="inline-flex items-center gap-1"><Coffee className="size-3" /> {formatMinutes(totalBreak)} breaks</span>
            {conflicts.size > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                <AlertTriangle className="size-3" /> {conflicts.size} time conflict{conflicts.size === 1 ? "" : "s"}
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 text-xs"
              onClick={() => updateBlocks((b) => [...b].sort((x, y) => toMinutes(x.start) - toMinutes(y.start)))}
            >
              Sort by time
            </Button>
          </div>

          <ol className="space-y-2">
            {day.blocks.map((b, i) => {
              const task = b.taskId ? taskById.get(b.taskId) : undefined;
              return (
                <li
                  key={b.id}
                  draggable
                  onDragStart={(e) => {
                    setDrag(i);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIdx(i);
                  }}
                  onDragLeave={() => setOverIdx((o) => (o === i ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag !== null) move(drag, i);
                    setDrag(null);
                    setOverIdx(null);
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setOverIdx(null);
                  }}
                  className={cn(
                    "group rounded-xl border border-l-4 bg-card p-3 shadow-soft transition-all",
                    KIND_STYLE[b.kind],
                    drag === i && "opacity-40",
                    overIdx === i && drag !== i && "ring-2 ring-primary",
                    conflicts.has(b.id) && "border-destructive/50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-2 size-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          value={b.start}
                          className="h-8 w-[6.5rem] text-xs"
                          aria-label="Start time"
                          onChange={(e) => updateBlocks((bl) => bl.map((x) => (x.id === b.id ? { ...x, start: e.target.value } : x)))}
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <Input
                          type="time"
                          value={b.end}
                          className="h-8 w-[6.5rem] text-xs"
                          aria-label="End time"
                          onChange={(e) => updateBlocks((bl) => bl.map((x) => (x.id === b.id ? { ...x, end: e.target.value } : x)))}
                        />
                        <Select
                          value={b.kind}
                          onValueChange={(v) => updateBlocks((bl) => bl.map((x) => (x.id === b.id ? { ...x, kind: v as BlockKind } : x)))}
                        >
                          <SelectTrigger className="h-8 w-24 text-xs capitalize" aria-label="Block type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["task", "focus", "break", "buffer"] as BlockKind[]).map((k) => (
                              <SelectItem key={k} value={k} className="text-xs capitalize">
                                {k}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {task && (
                          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Checkbox checked={task.completed} onCheckedChange={() => actions.toggleTask(task.id)} aria-label="Task done" />
                            Done
                          </label>
                        )}
                      </div>
                      <Input
                        value={b.title}
                        className={cn("h-9 font-medium", task?.completed && "text-muted-foreground line-through")}
                        aria-label="Block title"
                        onChange={(e) => updateBlocks((bl) => bl.map((x) => (x.id === b.id ? { ...x, title: e.target.value } : x)))}
                      />
                      {b.reason && <p className="text-xs leading-relaxed text-muted-foreground">{b.reason}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <Button variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up">
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={i === day.blocks.length - 1}
                        onClick={() => move(i, i + 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => updateBlocks((bl) => bl.filter((x) => x.id !== b.id))}
                        aria-label="Remove block"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <Button variant="outline" size="sm" onClick={addBlock}>
            <Plus /> Add block
          </Button>
        </>
      )}

      {schedule.recommendations.length > 0 && (
        <div className="rounded-xl border bg-accent/40 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="size-4 text-primary" /> Why this schedule
          </h3>
          <ul className="mt-2 space-y-1.5">
            {schedule.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground/85">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /> {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {schedule.unscheduled.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-warning-foreground">
            <AlertTriangle className="size-4" /> Didn't fit
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {schedule.unscheduled.map((u, i) => (
              <li key={i}>
                <span className="font-medium">{u.title}</span> — <span className="text-muted-foreground">{u.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => {
            actions.deleteSchedule(schedule.id);
            toast.success("Schedule deleted");
          }}
        >
          <Trash2 /> Delete schedule
        </Button>
      </div>
    </div>
  );
}
