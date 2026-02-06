"use client";

/**
 * Table of Contents
 *
 * Displays document headings for navigation with scroll spy functionality
 * that highlights the currently visible section.
 *
 * Features matching VibeSDK:
 * - "ON THIS PAGE" header in uppercase
 * - Emoji icons next to section titles
 * - Proper indentation based on heading level
 */

import { useState, useEffect, type RefObject } from "react";
import { cn } from "@/lib/utils";

export interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings: Heading[];
  activeId: string | null;
  onHeadingClick: (id: string) => void;
}

/**
 * Map common section names to emojis (matching VibeSDK)
 */
function getSectionEmoji(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("feature")) return "✨";
  if (lower.includes("tech") || lower.includes("stack")) return "🛠";
  if (lower.includes("quick start")) return "🚀";
  if (lower.includes("install")) return "📦";
  if (lower.includes("development") || lower.includes("dev")) return "💻";
  if (lower.includes("deploy")) return "🚀";
  if (lower.includes("contribut")) return "🤝";
  if (lower.includes("license")) return "📄";
  if (lower.includes("support")) return "💬";
  if (lower.includes("environment")) return "🔧";
  if (lower.includes("overview")) return "📖";
  if (lower.includes("getting started")) return "🏁";
  if (lower.includes("api")) return "🔌";
  if (lower.includes("config")) return "⚙️";
  if (lower.includes("test")) return "🧪";
  if (lower.includes("usage")) return "📚";
  if (lower.includes("requirement")) return "📋";
  if (lower.includes("depend")) return "📦";
  return "";
}

/**
 * Custom hook for scroll spy functionality.
 * Uses Intersection Observer to track which heading is currently visible.
 *
 * @param containerRef - Reference to the scrollable container
 * @param headingIds - Array of heading IDs to observe
 * @returns The ID of the currently active heading
 */
export function useScrollSpy(
  containerRef: RefObject<HTMLElement | null>,
  headingIds: string[]
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || headingIds.length === 0) return;

    const container = containerRef.current;
    const headings = headingIds
      .map((id) => container.querySelector(`#${CSS.escape(id)}`))
      .filter(Boolean) as Element[];

    if (headings.length === 0) return;

    // Set initial active heading to first one
    if (headings[0]) {
      setActiveId(headingIds[0]);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        root: container,
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      }
    );

    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, [containerRef, headingIds]);

  return activeId;
}

/**
 * Table of contents component displaying document headings.
 * Highlights the active heading and allows click navigation.
 */
export function TableOfContents({
  headings,
  activeId,
  onHeadingClick,
}: TableOfContentsProps) {
  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          ON THIS PAGE
        </h3>
      </div>

      {/* TOC items */}
      <nav className="flex-1 overflow-y-auto p-2">
        {headings.length === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">
            No headings found
          </p>
        ) : (
          <ul className="space-y-1">
            {headings.map((heading) => {
              const isActive = heading.id === activeId;
              const emoji = getSectionEmoji(heading.text);
              // Indentation based on heading level (h1=0, h2=1, h3=2, etc.)
              const indent = Math.max(0, heading.level - 1) * 12;

              return (
                <li key={heading.id}>
                  <button
                    onClick={() => onHeadingClick(heading.id)}
                    className={cn(
                      "w-full text-left text-sm py-1 px-2 rounded transition-colors",
                      isActive
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    style={{ paddingLeft: `${8 + indent}px` }}
                    title={heading.text}
                  >
                    {emoji && <span className="mr-1.5">{emoji}</span>}
                    {heading.text}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}
