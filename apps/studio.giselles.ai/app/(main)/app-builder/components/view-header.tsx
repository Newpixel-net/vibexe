"use client";

/**
 * ViewHeader Component
 *
 * Tab navigation for Preview | Code | Read me views (VibeSDK style).
 * Provides slots for center content and right actions.
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/components/view-header.tsx
 */

import type { ReactNode } from "react";
import { Eye, FileCode2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewType = "preview" | "code" | "readme";

interface ViewHeaderProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  centerContent?: ReactNode;
  rightActions?: ReactNode;
}

export function ViewHeader({
  view,
  onViewChange,
  centerContent,
  rightActions,
}: ViewHeaderProps) {
  return (
    <div className="border-b border-border px-2">
      <div className="grid grid-cols-3 h-10 items-center">
        {/* Left column: tab buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewChange("preview")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              view === "preview"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={() => onViewChange("code")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              view === "code"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <FileCode2 className="h-4 w-4" />
            Code
          </button>
          <button
            onClick={() => onViewChange("readme")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              view === "readme"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <FileText className="h-4 w-4" />
            Read me
          </button>
        </div>

        {/* Center column: centerContent slot */}
        <div className="flex items-center justify-center">{centerContent}</div>

        {/* Right column: rightActions slot */}
        <div className="flex items-center justify-end">{rightActions}</div>
      </div>
    </div>
  );
}
