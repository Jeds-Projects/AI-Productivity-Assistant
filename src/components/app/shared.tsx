import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Copy, KeyRound, Loader2, ShieldAlert, Sparkles, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApiKey } from "@/lib/api-key";
import { useAppData } from "@/lib/store";
import { cn } from "@/lib/utils";

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 animate-fade-up sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
          <Icon className="size-5.5 text-primary-foreground" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface animate-fade-up", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-start gap-3">
            {Icon && (
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <Icon className="size-4" />
              </span>
            )}
            <div>
              {title && <h2 className="text-base font-semibold">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="relative grid size-14 place-items-center rounded-2xl bg-accent text-primary">
        <span className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" aria-hidden />
        <Icon className="relative size-6" />
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function AiLoading({ label = "Gemini is analysing your input…", lines = 6 }: { label?: string; lines?: number }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3.5 rounded-full skeleton-shimmer"
            style={{ width: `${[92, 100, 84, 96, 70, 88, 60][i % 7]}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ApiKeyNotice() {
  const { hasKey } = useApiKey();
  if (hasKey) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 animate-fade-up sm:flex-row sm:items-center">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/20 text-warning-foreground">
        <KeyRound className="size-4" />
      </span>
      <div className="flex-1 text-sm">
        <p className="font-semibold text-warning-foreground">Gemini API key required</p>
        <p className="text-warning-foreground/80">
          AI generation is disabled until you add your Google Gemini API key. It stays in memory only.
        </p>
      </div>
      <Button asChild size="sm">
        <Link to="/settings">Add API key</Link>
      </Button>
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-destructive">No AI response generated</p>
        <p className="mt-0.5 text-foreground/80">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function AiDisclaimer({ className }: { className?: string }) {
  const { settings } = useAppData();
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border border-dashed bg-muted/50 px-4 py-3 text-xs text-muted-foreground", className)}>
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <p>
        <span className="font-semibold text-foreground">Responsible AI: </span>
        {settings.disclaimer}{" "}
        <Link to="/settings" hash="disclaimer" className="font-medium text-primary hover:underline">
          Edit
        </Link>
      </p>
    </div>
  );
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error("Couldn't access the clipboard. Select the text and copy manually.");
        }
      }}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">
      <Sparkles className="size-3" /> Gemini
    </span>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-destructive">{message}</p>;
}
