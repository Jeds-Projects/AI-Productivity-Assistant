import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Lightbulb,
  ListPlus,
  Mail,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AiDisclaimer, AiLoading, EmptyState, ErrorNotice, Panel } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAiRequest } from "@/hooks/use-ai";
import { useApiKey } from "@/lib/api-key";
import { insightsPrompt, insightsSchema } from "@/lib/prompts";
import { computeKpis, daysUntil, formatMinutes, relativeTime, weeklySeries, type Kpi } from "@/lib/stats";
import { actions, useAppData } from "@/lib/store";
import type { ActivityType, Insights } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useHydrated } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Workplace AI Productivity Assistant" },
      {
        name: "description",
        content: "Track time saved, emails generated, meetings summarised and tasks completed with AI insights.",
      },
      { property: "og:title", content: "Workplace AI — Productivity Dashboard" },
      {
        property: "og:description",
        content: "Your AI workplace assistant for emails, meeting summaries and prioritised schedules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const ACTIVITY_META: Record<ActivityType, { icon: LucideIcon; tone: string }> = {
  email: { icon: Mail, tone: "bg-royal/10 text-royal" },
  meeting: { icon: FileText, tone: "bg-cyan/10 text-cyan" },
  schedule: { icon: CalendarClock, tone: "bg-deep/10 text-deep" },
  task_completed: { icon: CheckCircle2, tone: "bg-success/10 text-success" },
  task_added: { icon: ListPlus, tone: "bg-sky/15 text-deep" },
  insights: { icon: Lightbulb, tone: "bg-warning/15 text-warning-foreground" },
};

const TOOLS = [
  { to: "/email", title: "Email Generator", text: "Draft a professional email", icon: Mail },
  { to: "/meetings", title: "Meeting Summarizer", text: "Summarise notes or a file", icon: FileText },
  { to: "/planner", title: "Task Planner", text: "Plan a prioritised day", icon: CalendarClock },
] as const;

type Metric = "minutesSaved" | "actions" | "tasksCompleted";

function Dashboard() {
  const data = useAppData();
  const hydrated = useHydrated();
  const { hasKey } = useApiKey();
  const [metric, setMetric] = useState<Metric>("minutesSaved");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const ai = useAiRequest<Omit<Insights, "generatedAt">>();

  const kpis = useMemo(() => computeKpis(data), [data]);
  const series = useMemo(() => weeklySeries(data), [data]);

  const greeting = useMemo(() => {
    if (!hydrated) return "Welcome back";
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, [hydrated]);
  const today = hydrated
    ? new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
    : "";

  const openTasks = data.tasks.filter((t) => !t.completed);
  const dueSoon = openTasks.filter((t) => {
    const d = daysUntil(t.deadline);
    return d !== undefined && d <= 1;
  }).length;

  const timeline = useMemo(() => {
    const list = selectedDay
      ? data.activity.filter((a) => {
          const d = new Date(a.at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return key === selectedDay;
        })
      : data.activity;
    return list.slice(0, 8);
  }, [data.activity, selectedDay]);

  const generateInsights = async () => {
    const snapshot = {
      profile: { role: data.settings.role || "not provided", workingHours: `${data.settings.workStart}-${data.settings.workEnd}` },
      kpis,
      last7Days: series.map((d) => ({ day: d.label, minutesSaved: d.minutesSaved, aiActions: d.actions, tasksCompleted: d.tasksCompleted })),
      openTasks: openTasks.slice(0, 25).map((t) => ({
        title: t.title,
        priority: t.priority,
        important: t.important,
        deadline: t.deadline ?? "none",
        daysUntilDeadline: daysUntil(t.deadline) ?? null,
        minutes: t.durationMin,
      })),
      recentActivity: data.activity.slice(0, 15).map((a) => ({ type: a.type, title: a.title, at: a.at })),
    };
    const { system, prompt } = insightsPrompt(snapshot);
    const result = await ai.run({ system, prompt, schema: insightsSchema, temperature: 0.6 });
    if (!result) return;
    actions.setInsights({ generatedAt: new Date().toISOString(), headline: result.headline, items: result.items ?? [] });
  };

  const metricLabel: Record<Metric, string> = {
    minutesSaved: "Minutes saved",
    actions: "AI actions",
    tasksCompleted: "Tasks completed",
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-navy-gradient p-6 shadow-card animate-fade-up sm:p-8">
        <div className="pointer-events-none absolute inset-0 grid-glow" aria-hidden />
        <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-royal/40 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 right-40 size-64 rounded-full bg-cyan/25 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-sky">{today || "\u00a0"}</p>
            <h1 className="mt-1 text-3xl font-semibold text-on-dark sm:text-4xl">
              {greeting}
              {data.settings.userName ? `, ${data.settings.userName.split(" ")[0]}` : ""}.
            </h1>
            <p className="mt-2 text-on-dark-muted">
              {openTasks.length === 0
                ? "No open tasks. Draft an email, summarise a meeting or plan your next day."
                : `You have ${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}${dueSoon ? `, ${dueSoon} due within a day` : ""}.`}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 2xl:shrink-0">
            {TOOLS.map((t) => (
              <Button key={t.to} asChild variant="glass" size="lg" className="justify-start">
                <Link to={t.to}>
                  <t.icon /> {t.title}
                </Link>
              </Button>
            ))}
          </div>
        </div>
        {!hasKey && (
          <div className="relative mt-6 flex flex-col gap-3 rounded-2xl border border-on-dark/15 bg-on-dark/5 p-4 backdrop-blur-md sm:flex-row sm:items-center">
            <Sparkles className="size-5 shrink-0 text-sky" />
            <p className="flex-1 text-sm text-on-dark-muted">
              Connect your Google Gemini API key to start generating real AI results.
            </p>
            <Button asChild variant="hero" size="sm">
              <Link to="/settings">Connect Gemini</Link>
            </Button>
          </div>
        )}
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={CheckCircle2} label="Tasks Completed" kpi={kpis.tasksCompleted} accent="bg-success/10 text-success" />
        <KpiCard icon={Clock} label="Time Saved" kpi={kpis.minutesSaved} format={formatMinutes} accent="bg-royal/10 text-royal" hint="Estimated" />
        <KpiCard icon={Mail} label="Emails Generated" kpi={kpis.emails} accent="bg-sky/15 text-deep" />
        <KpiCard icon={FileText} label="Meetings Summarised" kpi={kpis.meetings} accent="bg-cyan/10 text-cyan" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Weekly productivity"
          description={selectedDay ? "Showing activity for the selected day — click again to clear." : "Last 7 days · click a bar to filter activity"}
          icon={TrendingUp}
          action={
            <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <TabsList className="h-8">
                <TabsTrigger value="minutesSaved" className="text-xs">Time</TabsTrigger>
                <TabsTrigger value="actions" className="text-xs">AI actions</TabsTrigger>
                <TabsTrigger value="tasksCompleted" className="text-xs">Tasks</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          <div className="h-72">
            <ClientOnly fallback={<div className="h-full rounded-xl skeleton-shimmer" />}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--royal)" />
                      <stop offset="100%" stopColor="var(--cyan)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "var(--accent)", radius: 8 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      boxShadow: "var(--shadow-card-v)",
                      background: "var(--card)",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [metric === "minutesSaved" ? formatMinutes(v) : v, metricLabel[metric]]}
                  />
                  <Bar
                    dataKey={metric}
                    radius={[8, 8, 4, 4]}
                    maxBarSize={44}
                    className="cursor-pointer"
                    onClick={(d: { key?: string; payload?: { key: string } }) => {
                      const key = d.payload?.key ?? d.key;
                      if (key) setSelectedDay((s) => (s === key ? null : key));
                    }}
                  >
                    {series.map((p) => (
                      <Cell key={p.key} fill="url(#barFill)" fillOpacity={selectedDay && selectedDay !== p.key ? 0.3 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
          {data.activity.length === 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Your chart fills in as you use the AI tools and complete tasks.
            </p>
          )}
        </Panel>

        <Panel
          title="Recent activity"
          icon={Clock}
          description={selectedDay ? `Filtered to ${series.find((s) => s.key === selectedDay)?.label}` : "Latest actions"}
          action={
            selectedDay ? (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedDay(null)}>
                Clear
              </Button>
            ) : null
          }
        >
          {timeline.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No activity yet"
              description={selectedDay ? "Nothing happened on this day." : "Generated emails, summaries and completed tasks appear here."}
              className="py-6"
            />
          ) : (
            <ol className="relative space-y-4 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
              {timeline.map((a) => {
                const meta = ACTIVITY_META[a.type];
                return (
                  <li key={a.id} className="relative flex gap-3">
                    <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-lg ring-4 ring-card", meta.tone)}>
                      <meta.icon className="size-4" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {hydrated ? relativeTime(a.at) : ""}
                        {a.minutesSaved > 0 && ` · saved ~${a.minutesSaved}m`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="AI productivity insights"
          icon={Lightbulb}
          description={
            data.insights && hydrated ? `Generated ${relativeTime(data.insights.generatedAt)} from your real data` : "Personalised analysis of your workload and activity"
          }
          action={
            <Button size="sm" variant={data.insights ? "outline" : "hero"} onClick={generateInsights} disabled={ai.loading || !hasKey}>
              {data.insights ? <RefreshCw /> : <Sparkles />}
              {ai.loading ? "Analysing…" : data.insights ? "Refresh" : "Generate"}
            </Button>
          }
        >
          {ai.loading ? (
            <AiLoading label="Gemini is analysing your productivity data…" lines={5} />
          ) : ai.error ? (
            <ErrorNotice message={ai.error.message} onRetry={generateInsights} />
          ) : data.insights ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-accent/60 p-4 font-display text-base font-medium text-accent-foreground">
                {data.insights.headline}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {data.insights.items.map((it, i) => {
                  const Icon = it.type === "win" ? Trophy : it.type === "risk" ? TriangleAlert : Target;
                  return (
                    <div key={i} className="rounded-xl border bg-card p-4 surface-hover">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "grid size-7 place-items-center rounded-lg",
                            it.type === "win" && "bg-success/10 text-success",
                            it.type === "risk" && "bg-destructive/10 text-destructive",
                            it.type === "tip" && "bg-accent text-primary",
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <p className="text-sm font-semibold">{it.title}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{it.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Lightbulb}
              title={hasKey ? "Ready when you are" : "Connect Gemini for insights"}
              description={
                hasKey
                  ? "Gemini will analyse your tasks, deadlines and activity to surface wins, risks and recommendations."
                  : "Insights are generated from your real data — add your API key in Settings first."
              }
              action={
                !hasKey && (
                  <Button asChild size="sm">
                    <Link to="/settings">Open Settings</Link>
                  </Button>
                )
              }
              className="py-8"
            />
          )}
        </Panel>

        <Panel title="Quick access" icon={Sparkles} description="Jump into an AI tool">
          <div className="space-y-3">
            {TOOLS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 surface-hover"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-glow">
                  <t.icon className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{t.text}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <AiDisclaimer />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  kpi,
  accent,
  format = (n: number) => n.toLocaleString(),
  hint,
}: {
  icon: LucideIcon;
  label: string;
  kpi: Kpi;
  accent: string;
  format?: (n: number) => string;
  hint?: string;
}) {
  const diff = kpi.thisWeek - kpi.lastWeek;
  const up = diff >= 0;
  return (
    <div className="surface surface-hover p-5 animate-fade-up">
      <div className="flex items-start justify-between">
        <span className={cn("grid size-10 place-items-center rounded-xl", accent)}>
          <Icon className="size-5" />
        </span>
        {(kpi.thisWeek > 0 || kpi.lastWeek > 0) && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {up ? "+" : "−"}
            {format(Math.abs(diff))} vs last wk
          </span>
        )}
      </div>
      <p className="mt-4 font-display text-3xl font-semibold tracking-tight">{format(kpi.total)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-xs">({hint})</span>}
      </p>
    </div>
  );
}
