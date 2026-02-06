"use client";

/**
 * ImageAttachmentPreview Component
 *
 * Displays attached images with remove functionality.
 * Used in ChatInput for previewing images before sending.
 */

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ImageAttachment } from '../types/vibesdk';

interface ImageAttachmentPreviewProps {
  /** List of attached images */
  attachments: ImageAttachment[];
  /** Callback when an image is removed */
  onRemove: (id: string) => void;
  /** Additional className */
  className?: string;
}

export function ImageAttachmentPreview({
  attachments,
  onRemove,
  className,
}: ImageAttachmentPreviewProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="relative group rounded-lg overflow-hidden border border-border bg-muted"
        >
          {/* Image thumbnail */}
          <img
            src={attachment.url}
            alt={attachment.name}
            className="w-16 h-16 object-cover"
          />

          {/* Remove button - shown on hover */}
          <Button
            type="button"
            variant="link"
            onClick={() => onRemove(attachment.id)}
            className={cn(
              "absolute top-0.5 right-0.5 h-5 w-5",
              "bg-background/80 hover:bg-background",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove {attachment.name}</span>
          </Button>

          {/* Filename tooltip on hover */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 px-1 py-0.5",
            "bg-background/80 text-[10px] text-muted-foreground truncate",
            "opacity-0 group-hover:opacity-100 transition-opacity"
          )}>
            {attachment.name}
          </div>
        </div>
      ))}
    </div>
  );
}
