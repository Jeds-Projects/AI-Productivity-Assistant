import { createFileRoute } from "@tanstack/react-router";
import { History, Mail, PenLine, RefreshCw, Send, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { emailPrompt, emailSchema } from "@/lib/prompts";
import { relativeTime } from "@/lib/stats";
import { actions, useAppData } from "@/lib/store";
import type { EmailResult, Tone } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/email")({
  head: () => ({
    meta: [
      { title: "AI Email Generator — Workplace AI" },
      {
        name: "description",
        content: "Generate original, professional workplace emails in formal, friendly or persuasive tones.",
      },
      { property: "og:title", content: "AI Email Generator — Workplace AI" },
      {
        property: "og:description",
        content: "Context-aware professional emails you can edit, regenerate and copy in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmailPage,
});

const TONES: { value: Tone; hint: string }[] = [
  { value: "Formal", hint: "Polished & precise" },
  { value: "Friendly", hint: "Warm & approachable" },
  { value: "Persuasive", hint: "Benefit-led & convincing" },
];

interface FormState {
  recipient: string;
  subject: string;
  context: string;
  objective: string;
  tone: Tone;
}

const EMPTY: FormState = { recipient: "", subject: "", context: "", objective: "", tone: "Formal" };

function validate(f: FormState) {
  const e: Partial<Record<keyof FormState, string | undefined>> = {};
  if (!f.recipient.trim()) e.recipient = "Who is this email for?";
  if (!f.subject.trim()) e.subject = "Add a subject or topic.";
  if (f.context.trim().length < 15) e.context = "Give at least a sentence of context (15+ characters).";
  if (!f.objective.trim()) e.objective = "What should this email achieve?";
  return e;
}

function EmailPage() {
  const { emails, settings } = useAppData();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [refinement, setRefinement] = useState("");
  const ai = useAiRequest<EmailResult>();

  const current = emails.find((e) => e.id === currentId) ?? null;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const generate = async (mode: "new" | "regenerate") => {
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please complete the highlighted fields.");
      return;
    }
    const { system, prompt } = emailPrompt({
      ...form,
      settings,
      previous: mode === "regenerate" ? current?.result.body : undefined,
      refinement: mode === "regenerate" ? refinement.trim() || undefined : undefined,
    });
    const result = await ai.run({ system, prompt, schema: emailSchema, temperature: mode === "regenerate" ? 0.95 : 0.75 });
    if (!result?.body) return;
    const saved = actions.addEmail({ ...form, result: { subject: result.subject || form.subject, body: result.body } });
    setCurrentId(saved.id);
    setRefinement("");
    toast.success(mode === "regenerate" ? "New version generated" : "Email generated");
  };

  const loadFromHistory = (id: string) => {
    const e = emails.find((x) => x.id === id);
    if (!e) return;
    setForm({ recipient: e.recipient, subject: e.subject, context: e.context, objective: e.objective, tone: e.tone });
    setErrors({});
    setCurrentId(id);
    ai.setError(null);
  };

  const fullText = current ? `Subject: ${current.result.subject}\n\n${current.result.body}` : "";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Mail}
        title="AI Email Generator"
        description="Describe the situation and Gemini drafts an original, professional email tailored to your recipient."
      />
      <ApiKeyNotice />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel title="Email details" description="The more specific the context, the better the draft." icon={PenLine}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              generate("new");
            }}
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="recipient">Recipient</Label>
                <Input
                  id="recipient"
                  className="mt-1.5"
                  placeholder="e.g. Sarah Chen, Head of Procurement"
                  value={form.recipient}
                  onChange={(e) => set("recipient", e.target.value)}
                  aria-invalid={!!errors.recipient}
                />
                <FieldError message={errors.recipient} />
              </div>
              <div>
                <Label htmlFor="subject">Subject / topic</Label>
                <Input
                  id="subject"
                  className="mt-1.5"
                  placeholder="e.g. Q3 vendor contract renewal"
                  value={form.subject}
                  onChange={(e) => set("subject", e.target.value)}
                  aria-invalid={!!errors.subject}
                />
                <FieldError message={errors.subject} />
              </div>
            </div>
            <div>
              <Label htmlFor="context">Context & key facts</Label>
              <Textarea
                id="context"
                className="mt-1.5 min-h-32"
                placeholder="Background, relevant numbers, dates, prior conversations…"
                value={form.context}
                onChange={(e) => set("context", e.target.value)}
                aria-invalid={!!errors.context}
              />
              <FieldError message={errors.context} />
            </div>
            <div>
              <Label htmlFor="objective">Objective</Label>
              <Input
                id="objective"
                className="mt-1.5"
                placeholder="e.g. Get approval to extend the contract by 12 months"
                value={form.objective}
                onChange={(e) => set("objective", e.target.value)}
                aria-invalid={!!errors.objective}
              />
              <FieldError message={errors.objective} />
            </div>
            <div>
              <Label>Tone</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tone">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={form.tone === t.value}
                    onClick={() => set("tone", t.value)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left transition-all hover:border-primary/40",
                      form.tone === t.value ? "border-primary bg-accent shadow-glow" : "bg-card",
                    )}
                  >
                    <span className="block text-sm font-semibold">{t.value}</span>
                    <span className="block text-[11px] text-muted-foreground">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="submit" variant="hero" size="lg" disabled={ai.loading}>
                <Sparkles /> {ai.loading ? "Generating…" : "Generate email"}
              </Button>
              {ai.loading ? (
                <Button type="button" variant="ghost" onClick={ai.cancel}>
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setForm(EMPTY);
                    setErrors({});
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </form>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              Generated email {current && <AiBadge />}
            </span>
          }
          description={current ? `${current.tone} tone · editable` : "Your draft will appear here."}
          icon={Send}
          action={
            current && !ai.loading ? (
              <div className="flex gap-2">
                <CopyButton text={fullText} />
                <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                  <a
                    href={`mailto:?subject=${encodeURIComponent(current.result.subject)}&body=${encodeURIComponent(current.result.body)}`}
                  >
                    <Mail /> Open in mail
                  </a>
                </Button>
              </div>
            ) : null
          }
        >
          {ai.loading ? (
            <AiLoading label="Gemini is writing your email…" lines={8} />
          ) : ai.error ? (
            <ErrorNotice message={ai.error.message} onRetry={() => generate(current ? "regenerate" : "new")} />
          ) : current ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="out-subject" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Subject
                </Label>
                <Input
                  id="out-subject"
                  className="mt-1.5 font-semibold"
                  value={current.result.subject}
                  onChange={(e) =>
                    actions.updateEmail(current.id, { result: { ...current.result, subject: e.target.value } })
                  }
                />
              </div>
              <div>
                <Label htmlFor="out-body" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Body
                </Label>
                <Textarea
                  id="out-body"
                  className="mt-1.5 min-h-[22rem] leading-relaxed"
                  value={current.result.body}
                  onChange={(e) =>
                    actions.updateEmail(current.id, { result: { ...current.result, body: e.target.value } })
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Edits are saved automatically.</p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-3">
                <Label htmlFor="refine" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Wand2 className="size-3.5 text-primary" /> Regenerate with instructions (optional)
                </Label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="refine"
                    placeholder="e.g. Make it shorter and mention the budget deadline"
                    value={refinement}
                    onChange={(e) => setRefinement(e.target.value)}
                  />
                  <Button variant="soft" onClick={() => generate("regenerate")}>
                    <RefreshCw /> Regenerate
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Mail}
              title="No email yet"
              description="Fill in the details and choose a tone. Gemini will write an original draft using only the facts you provide."
            />
          )}
        </Panel>
      </div>

      <Panel title="Recent emails" description="Stored in this browser." icon={History}>
        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">Generated emails will be saved here for quick reuse.</p>
        ) : (
          <ul className="divide-y">
            {emails.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  onClick={() => loadFromHistory(e.id)}
                  className={cn(
                    "min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent",
                    e.id === currentId && "bg-accent",
                  )}
                >
                  <p className="truncate text-sm font-semibold">{e.result.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    To {e.recipient} · {e.tone} · {relativeTime(e.createdAt)}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete email"
                  onClick={() => {
                    actions.deleteEmail(e.id);
                    if (currentId === e.id) setCurrentId(null);
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
