"use client";

/**
 * DashboardSidebar Component
 *
 * Navigation sidebar for the Dashboard panel with 13 menu items (BASE44 style).
 * Provides vertical navigation for all dashboard sections.
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/components/dashboard-sidebar.tsx
 */

import type { LucideIcon } from "lucide-react";
import {
  Home,
  Users,
  Database,
  BarChart3,
  Globe,
  Puzzle,
  Shield,
  Code2,
  Bot,
  Zap,
  FileText,
  Key,
  Settings,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Available sections in the dashboard sidebar.
 * Each section corresponds to a menu item in the navigation.
 */
export type DashboardSection =
  | "overview"
  | "users"
  | "data"
  | "analytics"
  | "domains"
  | "integrations"
  | "security"
  | "code"
  | "agents"
  | "automations"
  | "logs"
  | "api"
  | "settings";

interface NavItem {
  id: DashboardSection;
  label: string;
  icon: LucideIcon;
}

/**
 * Navigation items for the dashboard sidebar.
 * Order matches BASE44 layout:
 * 1. Overview, 2. Users, 3. Data, 4. Analytics, 5. Domains,
 * 6. Integrations, 7. Security, 8. Code, 9. Agents, 10. Automations,
 * 11. Logs, 12. API, 13. Settings
 */
const navItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "users", label: "Users", icon: Users },
  { id: "data", label: "Data", icon: Database },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "domains", label: "Domains", icon: Globe },
  { id: "integrations", label: "Integrations", icon: Puzzle },
  { id: "security", label: "Security", icon: Shield },
  { id: "code", label: "Code", icon: Code2 },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "logs", label: "Logs", icon: FileText },
  { id: "api", label: "API", icon: Key },
  { id: "settings", label: "Settings", icon: Settings },
];

interface DashboardSidebarProps {
  /** Currently active section */
  activeSection: DashboardSection;
  /** Callback when section changes */
  onSectionChange: (section: DashboardSection) => void;
}

/**
 * DashboardSidebar - Vertical navigation menu with 13 items
 *
 * Layout:
 * - Fixed width (200px) sidebar with vertical scroll
 * - Each item has icon + label
 * - Active item highlighted with bg-muted
 * - Hover states for interactive feedback
 */
export function DashboardSidebar({
  activeSection,
  onSectionChange,
}: DashboardSidebarProps) {
  return (
    <div className="w-[200px] border-r border-border bg-background">
      <ScrollArea className="h-full">
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}
