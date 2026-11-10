import type { Schema } from "./gemini";
import { daysUntil, isUrgent, toDateKey } from "./stats";
import type { Settings, Task, Tone } from "./types";

function sender(settings: Settings) {
  const name = settings.userName.trim();
  const role = settings.role.trim();
  if (!name && !role) return "The sender has not provided a name; sign off with a neutral placeholder like [Your Name].";
  return `The sender is ${name || "[Your Name]"}${role ? `, ${role}` : ""}. Sign off with this identity.`;
}

/* ---------------- Email ---------------- */

export const emailSchema: Schema = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING", description: "Concise, specific subject line" },
    body: {
      type: "STRING",
      description: "Full email body with greeting, paragraphs separated by blank lines, and sign-off",
    },
  },
  required: ["subject", "body"],
  propertyOrdering: ["subject", "body"],
};

const TONE_GUIDE: Record<Tone, string> = {
  Formal:
    "Formal: polished, respectful and precise. No contractions, no slang, measured sentences, clear structure.",
  Friendly:
    "Friendly: warm, approachable and conversational while still professional. Contractions are fine; show genuine goodwill.",
  Persuasive:
    "Persuasive: confident and benefit-led. Lead with what the recipient gains, anticipate one objection, support claims with the provided facts, and end with a specific, low-friction call to action.",
};

export function emailPrompt(input: {
  recipient: string;
  subject: string;
  context: string;
  objective: string;
  tone: Tone;
  settings: Settings;
  previous?: string;
  refinement?: string;
}) {
  const system = `You are a senior business communications specialist who writes original, context-aware workplace emails.
Rules:
- Use ONLY facts given by the user. Never invent names, figures, dates, commitments or attachments. If a necessary detail is missing, insert a clear bracketed placeholder such as [date] rather than guessing.
- Address the specific recipient and tailor vocabulary to their relationship with the sender.
- Every paragraph must serve the stated objective. No filler, no clichés like "I hope this email finds you well" unless the tone is Friendly and it fits naturally.
- Keep it scannable: short paragraphs; use a short bulleted list only when listing 3+ items.
- End with a clear next step aligned to the objective.
- ${TONE_GUIDE[input.tone]}
- ${sender(input.settings)}`;

  const prompt = `Write an email with these inputs.

Recipient: ${input.recipient}
Subject / topic: ${input.subject}
Objective (what this email must achieve): ${input.objective}
Tone: ${input.tone}

Context and key facts:
"""
${input.context}
"""
${
  input.previous
    ? `\nA previous draft exists. Write a clearly different version (different opening, structure and phrasing) while keeping all facts accurate.\nPrevious draft:\n"""\n${input.previous}\n"""\n`
    : ""
}${input.refinement ? `\nAdditional instructions from the user for this version: ${input.refinement}\n` : ""}
Return JSON with "subject" and "body". The body must be plain text (no markdown symbols like ** or #).`;

  return { system, prompt };
}

/* ---------------- Meeting ---------------- */

export const meetingSchema: Schema = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
      description: "3-6 sentence executive summary of purpose, discussion and outcomes",
    },
    keyDecisions: { type: "ARRAY", items: { type: "STRING" } },
    actionItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          task: { type: "STRING" },
          owner: { type: "STRING", description: "Person responsible or 'Unassigned'" },
          deadline: { type: "STRING", description: "Deadline as stated, or 'Not specified'" },
        },
        required: ["task", "owner", "deadline"],
      },
    },
    responsibilities: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          person: { type: "STRING" },
          items: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["person", "items"],
      },
    },
    deadlines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { item: { type: "STRING" }, date: { type: "STRING" } },
        required: ["item", "date"],
      },
    },
  },
  required: ["summary", "keyDecisions", "actionItems", "responsibilities", "deadlines"],
  propertyOrdering: ["summary", "keyDecisions", "actionItems", "responsibilities", "deadlines"],
};

export const MAX_NOTES_CHARS = 60000;

export function meetingPrompt(notes: string, title: string) {
  const system = `You are an expert chief-of-staff who turns raw meeting notes and transcripts into accurate, structured minutes.
Rules:
- Extract only what is supported by the notes. Never fabricate people, decisions or dates.
- A "decision" is something agreed or resolved, not merely discussed.
- Action items must be concrete and start with a verb. Use the owner's name exactly as written; use "Unassigned" if no owner is stated. Use "Not specified" when no deadline is given.
- Resolve relative dates (e.g. "next Friday") only if the meeting date is stated; otherwise keep the wording as written.
- "responsibilities" groups every action item and commitment by person.
- "deadlines" lists every dated commitment or milestone mentioned.
- Return empty arrays when a section genuinely has no content.`;

  const prompt = `Meeting title: ${title || "Untitled meeting"}
Today's date: ${toDateKey(new Date())}

Meeting notes:
"""
${notes.slice(0, MAX_NOTES_CHARS)}
"""

Return the structured JSON summary.`;
  return { system, prompt };
}

/* ---------------- Schedule ---------------- */

export const scheduleSchema: Schema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING", description: "2-3 sentence overview of the scheduling strategy" },
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING", description: "yyyy-mm-dd" },
          label: { type: "STRING", description: "e.g. Monday, 12 Nov" },
          blocks: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                start: { type: "STRING", description: "HH:mm 24h" },
                end: { type: "STRING", description: "HH:mm 24h" },
                title: { type: "STRING" },
                kind: { type: "STRING", enum: ["task", "break", "focus", "buffer"] },
                taskId: { type: "STRING", description: "id of the task, empty for breaks" },
                reason: { type: "STRING", description: "One sentence on why it's placed here" },
              },
              required: ["start", "end", "title", "kind", "reason"],
            },
          },
        },
        required: ["date", "label", "blocks"],
      },
    },
    recommendations: { type: "ARRAY", items: { type: "STRING" } },
    unscheduled: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          taskId: { type: "STRING" },
          title: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["title", "reason"],
      },
    },
  },
  required: ["summary", "days", "recommendations", "unscheduled"],
  propertyOrdering: ["summary", "days", "recommendations", "unscheduled"],
};

export function schedulePrompt(tasks: Task[], mode: "daily" | "weekly", settings: Settings) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });

  const taskLines = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    durationMinutes: t.durationMin,
    priority: t.priority,
    important: t.important,
    deadline: t.deadline ?? "none",
    daysUntilDeadline: daysUntil(t.deadline, now) ?? null,
    urgent: isUrgent(t, now),
  }));

  const system = `You are an expert productivity coach and scheduler. You build realistic, humane work schedules using the Eisenhower matrix (urgent/important), deadline proximity and energy management.
Rules:
- Schedule only within working hours ${settings.workStart}–${settings.workEnd}. Never overlap blocks. Blocks must be in chronological order.
- Order by: overdue/urgent+important first, then important, then urgent-but-less-important, then the rest. Respect deadlines: a task must be finished on or before its deadline day.
- Place demanding, high-priority work in the morning focus window; lighter tasks after lunch.
- Insert a 10–15 minute break after every 75–90 minutes of work and a 30–60 minute lunch break around midday. Use kind "break".
- Split tasks longer than 120 minutes into multiple sessions labelled "(part 1/2)" etc.
- Leave a small buffer (kind "buffer") near the end of each day when there is room.
- Use the exact task id in taskId for task blocks. Do not invent tasks.
- If tasks don't fit, put them in "unscheduled" with the reason, and suggest what to defer or delegate in recommendations.
- recommendations: 3–6 specific, actionable explanations of your scheduling choices referencing actual task names.`;

  const scope =
    mode === "daily"
      ? `Build a DAILY schedule for one day: today (${toDateKey(now)}, ${weekday}) starting no earlier than ${hh}:${mm} if the current time is within working hours; if the working day is over or it's a weekend, plan the next working day instead.`
      : `Build a WEEKLY schedule across the next 5 working days (Mon–Fri), starting today (${toDateKey(now)}, ${weekday}) if it's a working day, otherwise the next Monday. For today, start no earlier than ${hh}:${mm}. Spread work sensibly and don't overload any single day.`;

  const prompt = `${scope}

Tasks (JSON):
${JSON.stringify(taskLines, null, 2)}

Return the JSON schedule.`;
  return { system, prompt };
}

/* ---------------- Insights ---------------- */

export const insightsSchema: Schema = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING", description: "One-sentence takeaway about the user's week" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          detail: { type: "STRING", description: "1-2 sentences, specific and actionable" },
          type: { type: "STRING", enum: ["win", "risk", "tip"] },
        },
        required: ["title", "detail", "type"],
      },
    },
  },
  required: ["headline", "items"],
};

export function insightsPrompt(snapshot: unknown) {
  const system = `You are a pragmatic productivity analyst. Analyse the user's real workload and activity data and give 4 specific insights: at least one "win", one "risk" and one "tip".
Rules:
- Reference actual task names, counts and deadlines from the data. Never invent data.
- If there is little data, say so honestly and recommend concrete first steps using the app's tools (email generator, meeting summariser, task planner).
- Be concise and actionable.`;
  const prompt = `Today: ${toDateKey(new Date())}
User data:
${JSON.stringify(snapshot, null, 2)}`;
  return { system, prompt };
}
