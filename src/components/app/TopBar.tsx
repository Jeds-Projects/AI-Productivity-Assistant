import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, Download, FileText, LogOut, Mail, Search, Settings, ShieldAlert, Trash2, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useApiKey } from "@/lib/api-key";
import { NAV_ITEMS } from "@/lib/nav";
import { daysUntil, relativeTime } from "@/lib/stats";
import { actions, useAppData } from "@/lib/store";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 glass border-x-0 border-t-0">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <SidebarTrigger className="size-9 rounded-lg" aria-label="Toggle sidebar" />
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-input bg-card/70 px-3 text-sm text-muted-foreground transition-all hover:border-primary/40 hover:shadow-soft sm:max-w-md"
        >
          <Search className="size-4 shrink-0 transition-colors group-hover:text-primary" />
          <span className="truncate">Search tools, tasks, emails…</span>
          <kbd className="ml-auto hidden rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-semibold sm:inline">
            Ctrl K
          </kbd>
        </button>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Notifications />
          <ProfileMenu />
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}

/* ---------------- Search ---------------- */

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const data = useAppData();
  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search tools, tasks, emails and meetings…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.url} value={`${item.title} ${item.description}`} onSelect={() => go(item.url)}>
              <item.icon className="text-primary" />
              <span>{item.title}</span>
              <span className="ml-auto text-xs text-muted-foreground">{item.description}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {data.tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {data.tasks.slice(0, 20).map((t) => (
                <CommandItem key={t.id} value={`task ${t.title} ${t.id}`} onSelect={() => go("/planner")}>
                  <CheckCheck className={t.completed ? "text-success" : "text-muted-foreground"} />
                  <span className={cn("truncate", t.completed && "line-through opacity-60")}>{t.title}</span>
                  {t.deadline && <span className="ml-auto text-xs text-muted-foreground">Due {t.deadline}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {data.emails.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Emails">
              {data.emails.slice(0, 10).map((e) => (
                <CommandItem key={e.id} value={`email ${e.result.subject} ${e.recipient} ${e.id}`} onSelect={() => go("/email")}>
                  <Mail className="text-primary" />
                  <span className="truncate">{e.result.subject}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{e.recipient}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {data.meetings.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Meetings">
              {data.meetings.slice(0, 10).map((m) => (
                <CommandItem key={m.id} value={`meeting ${m.title} ${m.id}`} onSelect={() => go("/meetings")}>
                  <FileText className="text-cyan" />
                  <span className="truncate">{m.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/* ---------------- Notifications ---------------- */

interface Note {
  id: string;
  title: string;
  detail: string;
  tone: "warning" | "info" | "danger";
  to: string;
}

function Notifications() {
  const data = useAppData();
  const { hasKey } = useApiKey();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const notes = useMemo<Note[]>(() => {
    const list: Note[] = [];
    if (!hasKey) {
      list.push({
        id: "no-key",
        title: "Connect Google Gemini",
        detail: "Add your API key in Settings to enable AI tools.",
        tone: "warning",
        to: "/settings",
      });
    }
    for (const t of data.tasks) {
      if (t.completed) continue;
      const d = daysUntil(t.deadline);
      if (d === undefined || d > 1) continue;
      list.push({
        id: `due-${t.id}-${t.deadline}`,
        title: d < 0 ? `Overdue: ${t.title}` : d === 0 ? `Due today: ${t.title}` : `Due tomorrow: ${t.title}`,
        detail: `${t.durationMin} min · ${t.priority} priority`,
        tone: d < 0 ? "danger" : "warning",
        to: "/planner",
      });
    }
    for (const a of data.activity.filter((x) => ["email", "meeting", "schedule"].includes(x.type)).slice(0, 5)) {
      list.push({
        id: `act-${a.id}`,
        title: a.title,
        detail: relativeTime(a.at),
        tone: "info",
        to: a.type === "email" ? "/email" : a.type === "meeting" ? "/meetings" : "/planner",
      });
    }
    return list;
  }, [data.tasks, data.activity, hasKey]);

  const unread = notes.filter((n) => n.id !== "no-key" && !data.readNotifications.includes(n.id));
  const badge = unread.length + (hasKey ? 0 : 1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-lg" aria-label={`Notifications (${badge} unread)`}>
          <Bell className="size-5" />
          {badge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] rounded-xl p-0 shadow-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-display text-sm font-semibold">Notifications</p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            disabled={unread.length === 0}
            onClick={() => actions.markNotificationsRead(unread.map((n) => n.id))}
          >
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {notes.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            notes.map((n) => {
              const isUnread = n.id === "no-key" || !data.readNotifications.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (n.id !== "no-key") actions.markNotificationsRead([n.id]);
                    setOpen(false);
                    navigate({ to: n.to });
                  }}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      !isUnread && "opacity-0",
                      n.tone === "danger" && "bg-destructive",
                      n.tone === "warning" && "bg-warning",
                      n.tone === "info" && "bg-primary",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{n.title}</span>
                    <span className="block text-xs text-muted-foreground">{n.detail}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------- Profile ---------------- */

function ProfileMenu() {
  const { settings } = useAppData();
  const { hasKey, setApiKey } = useApiKey();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const ini = initials(settings.userName);

  const exportData = () => {
    const blob = new Blob([actions.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workplace-ai-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl p-1 pr-1 transition-colors hover:bg-accent sm:pr-3"
            aria-label="Profile menu"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-deep-gradient text-xs font-bold text-primary-foreground">
              {ini ?? <User className="size-4" />}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-32 truncate text-sm font-semibold">
                {settings.userName || "Your profile"}
              </span>
              <span className="block max-w-32 truncate text-[11px] text-muted-foreground">
                {settings.role || "Set up in Settings"}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-xl">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold">{settings.userName || "Guest"}</p>
            <p className="text-xs text-muted-foreground">{settings.role || "No role set"}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}>
            <Settings /> Profile & settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportData}>
            <Download /> Export my data
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings" hash="disclaimer">
              <ShieldAlert /> Responsible AI disclaimer
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {hasKey && (
            <DropdownMenuItem
              onSelect={() => {
                setApiKey("");
                toast.success("API key removed from memory");
              }}
            >
              <LogOut /> Forget API key
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}>
            <Trash2 /> Clear all history
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ClearHistoryDialog open={confirm} onOpenChange={setConfirm} />
    </>
  );
}

export function ClearHistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Clear all history?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your tasks, schedules, generated emails, meeting summaries and activity from this
            browser. Your settings are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              actions.clearHistory();
              toast.success("History cleared");
            }}
          >
            Delete everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
