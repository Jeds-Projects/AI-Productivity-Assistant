import { CalendarClock, FileText, LayoutDashboard, Mail, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, description: "Overview & insights" },
  { title: "Email Generator", url: "/email", icon: Mail, description: "Write professional emails" },
  {
    title: "Meeting Summarizer",
    url: "/meetings",
    icon: FileText,
    description: "Summarise notes & files",
  },
  {
    title: "Task Planner",
    url: "/planner",
    icon: CalendarClock,
    description: "Prioritised schedules",
  },
  { title: "Settings", url: "/settings", icon: Settings, description: "API key & preferences" },
] as const;

export type NavUrl = (typeof NAV_ITEMS)[number]["url"];
