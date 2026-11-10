import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Editable list of strings with add/remove. */
export function EditableList({
  items,
  onChange,
  placeholder = "Add an item…",
  emptyText = "Nothing identified.",
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-muted-foreground">{emptyText}</p>}
      {items.map((item, i) => (
        <div key={i} className="group flex items-start gap-2">
          <span className="mt-3 size-1.5 shrink-0 rounded-full bg-primary" />
          <Textarea
            value={item}
            rows={1}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            className="min-h-9 resize-y border-transparent bg-transparent px-2 py-1.5 shadow-none hover:border-input focus-visible:border-input focus-visible:bg-card"
            aria-label={`Item ${i + 1}`}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 opacity-60 hover:opacity-100"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label="Remove item"
          >
            <X />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="text-primary" onClick={() => onChange([...items, ""])}>
        <Plus /> {placeholder}
      </Button>
    </div>
  );
}
