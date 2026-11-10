import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldAlert,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClearHistoryDialog } from "@/components/app/TopBar";
import { PageHeader, Panel } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiKey } from "@/lib/api-key";
import { GEMINI_MODELS, errorMessage, testConnection } from "@/lib/gemini";
import { toMinutes } from "@/lib/schedule-utils";
import { DEFAULT_DISCLAIMER, actions, useAppData } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Workplace AI" },
      { name: "description", content: "Connect your Google Gemini API key and set your profile, working hours and AI disclaimer." },
      { property: "og:title", content: "Settings — Workplace AI" },
      { property: "og:description", content: "Manage your Gemini API key, preferences and local data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { apiKey, setApiKey, hasKey } = useApiKey();
  const data = useAppData();
  const { settings } = data;
  const [draftKey, setDraftKey] = useState(apiKey);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [disclaimer, setDisclaimer] = useState(settings.disclaimer);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => setDisclaimer(settings.disclaimer), [settings.disclaimer]);

  const saveKey = async (test: boolean) => {
    const key = draftKey.trim();
    if (!key) {
      setStatus({ ok: false, message: "Enter an API key first." });
      return;
    }
    setApiKey(key);
    if (!test) {
      setStatus(null);
      toast.success("API key saved in memory for this session");
      return;
    }
    setTesting(true);
    setStatus(null);
    try {
      await testConnection(key, settings.model);
      setStatus({ ok: true, message: `Connected to ${settings.model}. AI features are ready.` });
      toast.success("Gemini connection verified");
    } catch (e) {
      setStatus({ ok: false, message: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  };

  const hoursInvalid = toMinutes(settings.workEnd) <= toMinutes(settings.workStart);

  const exportData = () => {
    const blob = new Blob([actions.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workplace-ai-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={SettingsIcon} title="Settings" description="Connect Google Gemini and tailor the assistant to how you work." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Google Gemini API key"
          icon={KeyRound}
          description="Get a free key from Google AI Studio (aistudio.google.com/apikey)."
          className="xl:row-span-2"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <div className="text-warning-foreground">
                <p className="font-semibold">Client-side key warning</p>
                <p className="mt-1 opacity-90">
                  Your key is sent directly from this browser to Google with every AI request, so it is visible in network
                  traffic and browser developer tools. Use a restricted key with a spending limit, and avoid shared or
                  untrusted computers.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveKey(true);
              }}
              className="space-y-3"
            >
              <Label htmlFor="api-key">API key</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={show ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="AIza…"
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Hide key" : "Show key"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={testing}>
                  {testing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  {testing ? "Testing…" : "Save & test connection"}
                </Button>
                <Button type="button" variant="outline" onClick={() => saveKey(false)} disabled={testing}>
                  Save without testing
                </Button>
                {hasKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setApiKey("");
                      setDraftKey("");
                      setStatus(null);
                      toast.success("API key removed from memory");
                    }}
                  >
                    Forget key
                  </Button>
                )}
              </div>
            </form>

            {status && (
              <div
                role="status"
                className={
                  status.ok
                    ? "flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success"
                    : "flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                }
              >
                {status.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
                {status.message}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={hasKey ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-warning"} />
              {hasKey
                ? "A key is held in memory. It will be cleared when you refresh or close this tab."
                : "No key in memory. AI features are disabled."}
            </div>

            <div className="border-t pt-4">
              <Label>Model</Label>
              <Select value={settings.model} onValueChange={(model) => actions.updateSettings({ model })}>
                <SelectTrigger className="mt-1.5" aria-label="Gemini model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label} <span className="text-muted-foreground">— {m.hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Panel>

        <Panel title="Profile" icon={User} description="Used to sign emails and personalise insights.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                className="mt-1.5"
                placeholder="e.g. Jordan Smith"
                value={settings.userName}
                onChange={(e) => actions.updateSettings({ userName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="role">Role & company</Label>
              <Input
                id="role"
                className="mt-1.5"
                placeholder="e.g. Operations Manager, Acme"
                value={settings.role}
                onChange={(e) => actions.updateSettings({ role: e.target.value })}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Working hours" icon={Clock} description="The task planner schedules within these hours.">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ws">Start</Label>
              <Input id="ws" type="time" className="mt-1.5" value={settings.workStart} onChange={(e) => actions.updateSettings({ workStart: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="we">End</Label>
              <Input id="we" type="time" className="mt-1.5" value={settings.workEnd} onChange={(e) => actions.updateSettings({ workEnd: e.target.value })} />
            </div>
          </div>
          {hoursInvalid && <p className="mt-2 text-xs font-medium text-destructive">End time must be after start time.</p>}
        </Panel>

        <div id="disclaimer" className="scroll-mt-24">
          <Panel title="Responsible AI disclaimer" icon={ShieldAlert} description="Shown under every AI tool. Edit it to match your organisation's policy.">
            <Textarea value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} className="min-h-28" aria-label="Disclaimer text" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={disclaimer.trim() === settings.disclaimer || !disclaimer.trim()}
                onClick={() => {
                  actions.updateSettings({ disclaimer: disclaimer.trim() });
                  toast.success("Disclaimer updated");
                }}
              >
                Save disclaimer
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDisclaimer(DEFAULT_DISCLAIMER);
                  actions.updateSettings({ disclaimer: DEFAULT_DISCLAIMER });
                  toast.success("Disclaimer reset");
                }}
              >
                <RotateCcw /> Reset to default
              </Button>
            </div>
          </Panel>
        </div>

        <Panel title="Your data" icon={Database} description="Everything is stored locally in this browser — nothing is uploaded to a server.">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Tasks", data.tasks.length],
              ["Emails", data.emails.length],
              ["Meetings", data.meetings.length],
              ["Schedules", data.schedules.length],
            ].map(([label, n]) => (
              <div key={label} className="rounded-xl border bg-muted/40 p-3">
                <p className="text-xl font-semibold">{n}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}>
              <Download /> Export JSON
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmClear(true)}>
              <Trash2 /> Clear all history
            </Button>
          </div>
        </Panel>
      </div>
      <ClearHistoryDialog open={confirmClear} onOpenChange={setConfirmClear} />
    </div>
  );
}
