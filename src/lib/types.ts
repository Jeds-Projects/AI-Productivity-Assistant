export type Priority = "high" | "medium" | "low";
export type Tone = "Formal" | "Friendly" | "Persuasive";

export interface Task {
  id: string;
  title: string;
  /** yyyy-mm-dd, optional */
  deadline?: string;
  durationMin: number;
  priority: Priority;
  important: boolean;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface EmailResult {
  subject: string;
  body: string;
}

export interface EmailOutput {
  id: string;
  createdAt: string;
  recipient: string;
  subject: string;
  context: string;
  objective: string;
  tone: Tone;
  result: EmailResult;
}

export interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
}

export interface Responsibility {
  person: string;
  items: string[];
}

export interface DeadlineItem {
  item: string;
  date: string;
}

export interface MeetingResult {
  summary: string;
  keyDecisions: string[];
  actionItems: ActionItem[];
  responsibilities: Responsibility[];
  deadlines: DeadlineItem[];
}

export interface MeetingOutput {
  id: string;
  createdAt: string;
  title: string;
  source: string;
  result: MeetingResult;
}

export type BlockKind = "task" | "break" | "focus" | "buffer";

export interface ScheduleBlock {
  id: string;
  start: string; // HH:mm
  end: string; // HH:mm
  title: string;
  kind: BlockKind;
  taskId?: string;
  reason?: string;
}

export interface ScheduleDay {
  id: string;
  date: string; // yyyy-mm-dd
  label: string;
  blocks: ScheduleBlock[];
}

export interface UnscheduledTask {
  taskId?: string;
  title: string;
  reason: string;
}

export interface Schedule {
  id: string;
  createdAt: string;
  mode: "daily" | "weekly";
  summary: string;
  days: ScheduleDay[];
  recommendations: string[];
  unscheduled: UnscheduledTask[];
}

export type ActivityType = "email" | "meeting" | "schedule" | "task_completed" | "task_added" | "insights";

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  at: string;
  minutesSaved: number;
  refId?: string;
}

export interface Insight {
  title: string;
  detail: string;
  type: "win" | "risk" | "tip";
}

export interface Insights {
  generatedAt: string;
  headline: string;
  items: Insight[];
}

export interface Settings {
  userName: string;
  role: string;
  workStart: string;
  workEnd: string;
  model: string;
  disclaimer: string;
}

export interface AppData {
  version: 1;
  tasks: Task[];
  emails: EmailOutput[];
  meetings: MeetingOutput[];
  schedules: Schedule[];
  activity: Activity[];
  settings: Settings;
  insights?: Insights;
  readNotifications: string[];
}
