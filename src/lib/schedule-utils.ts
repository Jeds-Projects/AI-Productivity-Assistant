import type { ScheduleBlock } from "./types";

export function toMinutes(hhmm: string) {
  const [h = NaN, m = NaN] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function fromMinutes(min: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** Re-time blocks sequentially, keeping each block's duration, starting at the earliest original start. */
export function retime(blocks: ScheduleBlock[]): ScheduleBlock[] {
  if (blocks.length === 0) return blocks;
  let cursor = Math.min(...blocks.map((b) => toMinutes(b.start)));
  return blocks.map((b) => {
    const dur = Math.max(5, toMinutes(b.end) - toMinutes(b.start));
    const next = { ...b, start: fromMinutes(cursor), end: fromMinutes(cursor + dur) };
    cursor += dur;
    return next;
  });
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** Returns ids of blocks that overlap another block or have end <= start. */
export function findConflicts(blocks: ScheduleBlock[]): Set<string> {
  const bad = new Set<string>();
  const sorted = [...blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  sorted.forEach((b, i) => {
    if (toMinutes(b.end) <= toMinutes(b.start)) bad.add(b.id);
    const next = sorted[i + 1];
    if (next && toMinutes(next.start) < toMinutes(b.end)) {
      bad.add(b.id);
      bad.add(next.id);
    }
  });
  return bad;
}
