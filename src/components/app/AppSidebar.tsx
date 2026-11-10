import { Link, useRouterState } from "@tanstack/react-router";
import { KeyRound, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useApiKey } from "@/lib/api-key";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasKey } = useApiKey();

  const close = () => isMobile && setOpenMobile(false);
  const main = NAV_ITEMS.filter((i) => i.url !== "/settings");
  const settings = NAV_ITEMS.find((i) => i.url === "/settings")!;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="pointer-events-none absolute inset-0 bg-navy-gradient" aria-hidden />
      <div className="pointer-events-none absolute inset-0 grid-glow opacity-60" aria-hidden />
      <SidebarHeader className="relative z-10 px-3 pt-4 pb-2">
        <Link to="/" onClick={close} className="flex items-center gap-2.5 overflow-hidden">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-gradient shadow-glow">
            <Sparkles className="size-4.5 text-primary-foreground" />
          </span>
          {!collapsed && (
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold text-on-dark">
                Workplace AI
              </span>
              <span className="block text-[11px] text-on-dark-muted">Productivity Assistant</span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="relative z-10">
        <SidebarGroup>
          <SidebarGroupLabel className="text-on-dark-muted/70">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {main.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        "h-10 rounded-lg transition-all",
                        active &&
                          "bg-sidebar-primary/90 text-sidebar-primary-foreground shadow-glow hover:bg-sidebar-primary hover:text-sidebar-primary-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground",
                      )}
                    >
                      <Link to={item.url} onClick={close}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="relative z-10 gap-2 pb-4">
        {!collapsed && (
          <Link
            to="/settings"
            onClick={close}
            className="rounded-xl border border-sidebar-border bg-sidebar-accent p-3 text-xs transition-colors hover:bg-on-dark/10"
          >
            <div className="flex items-center gap-2 font-semibold text-on-dark">
              <span
                className={cn(
                  "size-2 rounded-full",
                  hasKey ? "bg-success shadow-[0_0_8px] shadow-success" : "bg-warning",
                )}
              />
              {hasKey ? "Gemini connected" : "Gemini not connected"}
            </div>
            <p className="mt-1 text-on-dark-muted">
              {hasKey ? "Key held in memory for this session." : "Add your API key to enable AI."}
            </p>
          </Link>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === settings.url}
              tooltip={settings.title}
              className={cn(
                "h-10 rounded-lg",
                pathname === settings.url &&
                  "data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground",
              )}
            >
              <Link to="/settings" onClick={close}>
                {collapsed && !hasKey ? <KeyRound className="text-warning" /> : <settings.icon />}
                <span>{settings.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
