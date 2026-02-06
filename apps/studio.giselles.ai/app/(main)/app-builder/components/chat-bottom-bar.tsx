"use client";

/**
 * ChatBottomBar Component
 *
 * Bottom action bar with 4 buttons (BASE44 style):
 * Settings, Plus, Discuss, Mic
 *
 * Reference: base44-Dashboard-1.png shows: gear | + | Discuss | mic
 */

import { Button } from "@/components/ui/button";
import { Settings, Plus, MessageSquare, Mic } from "lucide-react";

interface ChatBottomBarProps {
  onSettings?: () => void;
  onPlus?: () => void;
  onDiscuss?: () => void;
  onMic?: () => void;
}

/**
 * ChatBottomBar - 4-button action bar below chat input
 *
 * Layout (matching BASE44):
 * - Settings gear (left)
 * - Plus button (left)
 * - Discuss button with text (center-left)
 * - Mic button (right)
 */
export function ChatBottomBar({
  onSettings,
  onPlus,
  onDiscuss,
  onMic,
}: ChatBottomBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-card">
      {/* Settings icon button */}
      <Button
        variant="link"
        
        onClick={onSettings}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <Settings className="h-4 w-4" />
        <span className="sr-only">Settings</span>
      </Button>

      {/* Plus icon button */}
      <Button
        variant="link"
        
        onClick={onPlus}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        <span className="sr-only">Add attachment</span>
      </Button>

      {/* Discuss button with icon and text */}
      <Button
        variant="link"
        
        onClick={onDiscuss}
        className="h-8 text-muted-foreground hover:text-foreground"
      >
        <MessageSquare className="h-4 w-4 mr-1.5" />
        Discuss
      </Button>

      {/* Spacer to push mic to right */}
      <div className="flex-1" />

      {/* Mic icon button */}
      <Button
        variant="link"
        
        onClick={onMic}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <Mic className="h-4 w-4" />
        <span className="sr-only">Voice input</span>
      </Button>
    </div>
  );
}
