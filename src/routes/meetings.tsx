import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  CheckSquare,
  Download,
  FileText,
  FileUp,
  Gavel,
  History,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { EditableList } from "@/components/app/EditableList";
import {
  AiBadge,
  AiDisclaimer,
  AiLoading,
  ApiKeyNotice,
  CopyButton,
  EmptyState,
  ErrorNotice,
  FieldError,
  PageHeader,
  Panel,
} from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAiRequest } from "@/hooks/use-ai";
import { ACCEPTED_EXTENSIONS, extractText } from "@/lib/documents";
import { MAX_NOTES_CHARS, meetingPrompt, meetingSchema } from "@/lib/prompts";
import { relativeTime } from "@/lib/stats";
import { actions, useAppData } from "@/lib/store";
import type { MeetingOutput, MeetingResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/meetings")({
  head: () => ({
    meta: [
      { title: "Meeting Notes Summarizer — Workplace AI" },
      {
        name: "description",
        content: "Summarise meeting notes and PDF, DOCX or TXT files into decisions, action items and deadlines.",
      },
      { property: "og:title", content: "Meeting Notes Summarizer — Workplace AI" },
      {
        property: "og:description",
        content: "Turn raw notes into clear summaries, owners and deadlines — processed locally in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MeetingsPage,
});

function toText(m: MeetingOutput) {
  const r = m.result;
  const lines = [`# ${m.title}`, "", "## Summary", r.summary, "", "## Key decisions"];
  r.keyDecisions.forEach((d) => lines.push(`- ${d}`));
  lines.push("", "## Action items");
  r.actionItems.forEach((a) => lines.push(`- ${a.task} — ${a.owner} (due: ${a.deadline})`));
  lines.push("", "## Responsibilities");
  r.responsibilities.forEach((p) => {
    lines.push(`${p.person}:`);
    p.items.forEach((i) => lines.push(`  - ${i}`));
  });
  lines.push("", "## Deadlines");
  r.deadlines.forEach((d) => lines.push(`- ${d.date}: ${d.item}`));
  return lines.join("\n");
}

function MeetingsPage() {
  const { meetings } = useAppData();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState<string>("Pasted notes");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notesError, setNotesError] = useState<string>();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ai = useAiRequest<MeetingResult>();

  const current = meetings.find((m) => m.id === currentId) ?? null;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setNotesError(undefined);
    try {
      const text = await extractText(file);
      setNotes(text);
      setFileName(file.name);
      setSource(file.name);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success(`Extracted ${text.length.toLocaleString()} characters from ${file.name}`);
    } catch (e) {
      toast.error((e as Error).message);
      setNotesError((e as Error).message);
    } finally {
      setParsing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const generate = async () => {
    if (notes.trim().length < 40) {
      setNotesError("Paste or upload meeting notes (at least 40 characters) to summarise.");
      toast.error("Add more meeting notes first.");
      return;
    }
    const { system, prompt } = meetingPrompt(notes, title);
    const result = await ai.run({ system, prompt, schema: meetingSchema, temperature: 0.3 });
    if (!result) return;
    const saved = actions.addMeeting({
      title: title.trim() || "Untitled meeting",
      source,
      result: {
        summary: result.summary ?? "",
        keyDecisions: result.keyDecisions ?? [],
        actionItems: result.actionItems ?? [],
        responsibilities: result.responsibilities ?? [],
        deadlines: result.deadlines ?? [],
      },
    });
    setCurrentId(saved.id);
    toast.success("Meeting summarised");
  };

  const update = (patch: Partial<MeetingResult>) => {
    if (!current) return;
    actions.updateMeeting(current.id, { result: { ...current.result, ...patch } });
  };

  const addActionsToPlanner = () => {
    if (!current) return;
    const items = current.result.actionItems.filter((a) => a.task.trim());
    items.forEach((a) => {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(a.deadline) ? a.deadline : undefined;
      actions.addTask({
        title: a.owner && a.owner !== "Unassigned" ? `${a.task} (${a.owner})` : a.task,
        deadline: iso,
        durationMin: 30,
        priority: iso ? "high" : "medium",
        important: true,
      });
    });
    toast.success(`${items.length} action item${items.length === 1 ? "" : "s"} added to Task Planner`);
  };

  const download = () => {
    if (!current) return;
    const blob = new Blob([toText(current)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${current.title.replace(/[^\w-]+/g, "-").toLowerCase()}-summary.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const over = notes.length > MAX_NOTES_CHARS;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Meeting Notes Summarizer"
        description="Paste notes or upload a PDF, DOCX or TXT file. Files are read locally in your browser."
      />
      <ApiKeyNotice />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel title="Meeting input" description="Only the extracted text is sent to Gemini." icon={FileUp}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="m-title">Meeting title</Label>
              <Input
                id="m-title"
                className="mt-1.5"
                placeholder="e.g. Product roadmap sync — 10 Nov"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all",
                dragging ? "border-primary bg-accent shadow-glow" : "border-input bg-muted/40 hover:border-primary/40",
              )}
            >
              {parsing ? (
                <>
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="text-sm font-medium">Reading document locally…</p>
                </>
              ) : (
                <>
                  <FileUp className="size-6 text-primary" />
                  <p className="text-sm font-medium">Drop a file here or</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                    Browse files
                  </Button>
                  <p className="text-[11px] text-muted-foreground">PDF, DOCX or TXT · up to 10 MB</p>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(",")}
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
                aria-label="Upload meeting notes file"
              />
            </div>

            {fileName && (
              <div className="flex items-center gap-2 rounded-lg border bg-accent/60 px-3 py-2 text-sm">
                <FileText className="size-4 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium">{fileName}</span>
                <button
                  type="button"
                  aria-label="Remove file"
                  className="rounded p-1 hover:bg-card"
                  onClick={() => {
                    setFileName(null);
                    setSource("Pasted notes");
                    setNotes("");
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notes">Notes {fileName && <span className="text-muted-foreground">(extracted — editable)</span>}</Label>
                <span className={cn("text-[11px]", over ? "font-semibold text-warning-foreground" : "text-muted-foreground")}>
                  {notes.length.toLocaleString()} / {MAX_NOTES_CHARS.toLocaleString()}
                </span>
              </div>
              <Textarea
                id="notes"
                className="mt-1.5 min-h-56 font-mono text-[13px]"
                placeholder="Paste your raw meeting notes or transcript here…"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  if (notesError) setNotesError(undefined);
                }}
                aria-invalid={!!notesError}
              />
              <FieldError message={notesError} />
              {over && (
                <p className="mt-1 text-xs text-warning-foreground">
                  Only the first {MAX_NOTES_CHARS.toLocaleString()} characters will be analysed.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="hero" size="lg" onClick={generate} disabled={ai.loading || parsing}>
                <Sparkles /> {ai.loading ? "Summarising…" : "Summarise meeting"}
              </Button>
              {ai.loading && (
                <Button variant="ghost" onClick={ai.cancel}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              {current ? current.title : "Summary"} {current && <AiBadge />}
            </span>
          }
          description={current ? `From ${current.source} · all sections editable` : "Structured results appear here."}
          icon={ListChecks}
          action={
            current && !ai.loading ? (
              <div className="flex gap-2">
                <CopyButton text={toText(current)} />
                <Button size="sm" variant="outline" onClick={download} aria-label="Download summary">
                  <Download />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              </div>
            ) : null
          }
        >
          {ai.loading ? (
            <AiLoading label="Gemini is extracting decisions and action items…" lines={9} />
          ) : ai.error ? (
            <ErrorNotice message={ai.error.message} onRetry={generate} />
          ) : current ? (
            <div className="space-y-6">
              <Section icon={Sparkles} title="Summary">
                <Textarea
                  value={current.result.summary}
                  onChange={(e) => update({ summary: e.target.value })}
                  className="min-h-28 leading-relaxed"
                  aria-label="Summary"
                />
              </Section>

              <Section icon={Gavel} title="Key decisions" count={current.result.keyDecisions.length}>
                <EditableList
                  items={current.result.keyDecisions}
                  onChange={(keyDecisions) => update({ keyDecisions })}
                  placeholder="Add decision"
                  emptyText="No firm decisions were recorded."
                />
              </Section>

              <Section
                icon={CheckSquare}
                title="Action items"
                count={current.result.actionItems.length}
                action={
                  current.result.actionItems.length > 0 && (
                    <Button size="sm" variant="soft" onClick={addActionsToPlanner}>
                      <CalendarClock /> Add to planner
                    </Button>
                  )
                }
              >
                <div className="space-y-2">
                  {current.result.actionItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">No action items identified.</p>
                  )}
                  {current.result.actionItems.map((a, i) => (
                    <div key={i} className="grid gap-2 rounded-xl border bg-muted/30 p-2.5 sm:grid-cols-[1fr_9rem_9rem_auto]">
                      <Input
                        value={a.task}
                        aria-label="Action"
                        onChange={(e) =>
                          update({
                            actionItems: current.result.actionItems.map((x, j) => (j === i ? { ...x, task: e.target.value } : x)),
                          })
                        }
                      />
                      <Input
                        value={a.owner}
                        aria-label="Owner"
                        placeholder="Owner"
                        onChange={(e) =>
                          update({
                            actionItems: current.result.actionItems.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)),
                          })
                        }
                      />
                      <Input
                        value={a.deadline}
                        aria-label="Deadline"
                        placeholder="Deadline"
                        onChange={(e) =>
                          update({
                            actionItems: current.result.actionItems.map((x, j) => (j === i ? { ...x, deadline: e.target.value } : x)),
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove action"
                        onClick={() => update({ actionItems: current.result.actionItems.filter((_, j) => j !== i) })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    onClick={() =>
                      update({ actionItems: [...current.result.actionItems, { task: "", owner: "Unassigned", deadline: "Not specified" }] })
                    }
                  >
                    <Plus /> Add action item
                  </Button>
                </div>
              </Section>

              <Section icon={Users} title="Responsibilities" count={current.result.responsibilities.length}>
                <div className="grid gap-3 md:grid-cols-2">
                  {current.result.responsibilities.length === 0 && (
                    <p className="text-sm text-muted-foreground">No assigned responsibilities found.</p>
                  )}
                  {current.result.responsibilities.map((r, i) => (
                    <div key={i} className="rounded-xl border bg-card p-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-deep-gradient text-[11px] font-bold text-primary-foreground">
                          {r.person.slice(0, 1).toUpperCase() || "?"}
                        </span>
                        <Input
                          value={r.person}
                          aria-label="Person"
                          className="h-8 font-semibold"
                          onChange={(e) =>
                            update({
                              responsibilities: current.result.responsibilities.map((x, j) =>
                                j === i ? { ...x, person: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Remove person"
                          onClick={() =>
                            update({ responsibilities: current.result.responsibilities.filter((_, j) => j !== i) })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="mt-2">
                        <EditableList
                          items={r.items}
                          placeholder="Add responsibility"
                          onChange={(items) =>
                            update({
                              responsibilities: current.result.responsibilities.map((x, j) => (j === i ? { ...x, items } : x)),
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-primary"
                  onClick={() => update({ responsibilities: [...current.result.responsibilities, { person: "", items: [] }] })}
                >
                  <Plus /> Add person
                </Button>
              </Section>

              <Section icon={CalendarClock} title="Deadlines" count={current.result.deadlines.length}>
                <div className="space-y-2">
                  {current.result.deadlines.length === 0 && (
                    <p className="text-sm text-muted-foreground">No deadlines mentioned.</p>
                  )}
                  {current.result.deadlines.map((d, i) => (
                    <div key={i} className="grid grid-cols-[8.5rem_1fr_auto] gap-2">
                      <Input
                        value={d.date}
                        aria-label="Date"
                        onChange={(e) =>
                          update({ deadlines: current.result.deadlines.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })
                        }
                      />
                      <Input
                        value={d.item}
                        aria-label="Deadline item"
                        onChange={(e) =>
                          update({ deadlines: current.result.deadlines.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)) })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove deadline"
                        onClick={() => update({ deadlines: current.result.deadlines.filter((_, j) => j !== i) })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    onClick={() => update({ deadlines: [...current.result.deadlines, { date: "", item: "" }] })}
                  >
                    <Plus /> Add deadline
                  </Button>
                </div>
              </Section>
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No summary yet"
              description="Add notes and Gemini will extract a summary, key decisions, action items, owners and deadlines."
            />
          )}
        </Panel>
      </div>

      <Panel title="Recent meetings" description="Stored in this browser." icon={History}>
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Summaries you generate will be saved here.</p>
        ) : (
          <ul className="divide-y">
            {meetings.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentId(m.id);
                    ai.setError(null);
                  }}
                  className={cn(
                    "min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent",
                    m.id === currentId && "bg-accent",
                  )}
                >
                  <p className="truncate text-sm font-semibold">{m.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.result.actionItems.length} actions · {m.result.keyDecisions.length} decisions · {relativeTime(m.createdAt)}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete meeting"
                  onClick={() => {
                    actions.deleteMeeting(m.id);
                    if (currentId === m.id) setCurrentId(null);
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <AiDisclaimer />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  action,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" />
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">{count}</span>
          )}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
