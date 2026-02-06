"use client";

import { Plus, Ban, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeftNavBarProps {
  onNewApp?: () => void;
  onClearChat?: () => void;
  onSettings?: () => void;
  className?: string;
}

export function LeftNavBar({
  onNewApp,
  onClearChat,
  onSettings,
  className,
}: LeftNavBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between py-4 px-2 bg-background border-r w-14 h-full",
        className
      )}
    >
      {/* Top section - New app button */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onNewApp}
          className="h-10 w-10 rounded-lg bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors"
          title="New App"
        >
          <Plus className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Bottom section - Settings and clear */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onClearChat}
          className="h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Clear Chat"
        >
          <Ban className="h-5 w-5" />
        </button>
        <button
          onClick={onSettings}
          className="h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
