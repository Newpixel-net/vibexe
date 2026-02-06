"use client";

/**
 * BuilderHeader Component
 *
 * Top bar for the App Builder matching BASE44 style.
 * Reference: base44-Dashboard-1.png header layout
 */

import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BuilderHeaderProps {
  appName: string;
}

/**
 * BuilderHeader - Top bar with back button, app name, and action buttons.
 *
 * Layout (matching BASE44):
 * - Far left: Back arrow button (compact)
 * - Left: App name (prominent)
 * - Right: Upgrade and Publish buttons
 */
export function BuilderHeader({ appName }: BuilderHeaderProps) {
  const router = useRouter();

  const handleBackClick = () => {
    router.push("/app-builder");
  };

  return (
    <div className="h-14 border-b border-border bg-background flex items-center px-4">
      {/* Back button - compact */}
      <Button
        
        onClick={handleBackClick}
        className="h-9 w-9 mr-3 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="sr-only">Back to Apps</span>
      </Button>

      {/* App name - prominent */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-foreground truncate">
          {appName}
        </h1>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button variant="link"  className="h-9">
          <Sparkles className="h-4 w-4 mr-1.5" />
          Upgrade
        </Button>
        <Button variant="default"  className="h-9">
          Publish
        </Button>
      </div>
    </div>
  );
}
