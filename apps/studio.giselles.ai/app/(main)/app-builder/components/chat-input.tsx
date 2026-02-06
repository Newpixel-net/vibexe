"use client";

/**
 * ChatInput Component
 *
 * Auto-resizing textarea with Enter to submit, Shift+Enter for newlines.
 * Minimal UI: only image attachment button and send button.
 * Supports image attachments via file picker.
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Send, Loader2, Image as ImageIcon, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageAttachmentPreview } from "./image-attachment-preview";
import type { ImageAttachment } from "../types/vibesdk";

// Internal word limit (not visible to user)
const MAX_WORDS = 4000;

/** Count words in a string */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface ChatInputProps {
  /** Current input value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Callback when form is submitted */
  onSubmit: () => void;
  /** Whether a message is being processed */
  isLoading?: boolean;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional className */
  className?: string;
  /** Whether AI is currently generating (shows stop button) */
  isGenerating?: boolean;
  /** Callback to stop generation */
  onStop?: () => void;
  /** Current image attachments */
  attachments?: ImageAttachment[];
  /** Callback when attachments change */
  onAttachmentsChange?: (attachments: ImageAttachment[]) => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = "Chat with AI...",
  className,
  isGenerating = false,
  onStop,
  attachments = [],
  onAttachmentsChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-resize textarea based on content (max 120px)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Process files into ImageAttachment format
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      if (!onAttachmentsChange) return;

      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/")
      );

      if (imageFiles.length === 0) return;

      const newAttachments: ImageAttachment[] = imageFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        name: file.name,
      }));

      onAttachmentsChange([...attachments, ...newAttachments]);
    },
    [attachments, onAttachmentsChange]
  );

  // Handle file input change
  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
        // Reset input so same file can be selected again
        e.target.value = "";
      }
    },
    [processFiles]
  );

  // Handle removing an attachment
  const handleRemoveAttachment = useCallback(
    (id: string) => {
      if (!onAttachmentsChange) return;

      const attachment = attachments.find((a) => a.id === id);
      if (attachment) {
        // Revoke object URL to prevent memory leak
        URL.revokeObjectURL(attachment.url);
      }

      onAttachmentsChange(attachments.filter((a) => a.id !== id));
    },
    [attachments, onAttachmentsChange]
  );

  // Open file picker
  const handleImageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle text change with internal word limit enforcement
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    // Enforce word limit internally (no visible counter)
    if (countWords(newValue) <= MAX_WORDS) {
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift submits
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading && !disabled) {
        onSubmit();
      }
    }
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging false if leaving the container entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading && !disabled) {
      onSubmit();
    }
  };

  const isDisabled = disabled || isLoading;
  const canSubmit = value.trim().length > 0 && !isDisabled;

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      {/* Hidden file input for image attachments */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Drag wrapper */}
      <div
        className="relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay - shows when dragging files over */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-accent/10 backdrop-blur-sm rounded-xl z-50 border-2 border-dashed border-accent">
            <span className="text-sm font-medium text-accent-foreground">
              Drop images here
            </span>
          </div>
        )}

        <div className="space-y-2">
          {/* Image attachment previews */}
          {attachments.length > 0 && (
            <ImageAttachmentPreview
              attachments={attachments}
              onRemove={handleRemoveAttachment}
            />
          )}

          {/* Text input area with ALL buttons inline */}
          <div className="flex items-end gap-2 p-2 rounded-xl border border-input bg-muted focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isDisabled}
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent border-0 focus:ring-0 focus:outline-none",
                "text-foreground placeholder:text-muted-foreground",
                "min-h-[24px] max-h-[120px] py-1 px-1",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
            />

            {/* Image button - INLINE */}
            <button
              type="button"
              className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              onClick={handleImageClick}
              disabled={isDisabled}
              title="Attach image"
            >
              <ImageIcon className="h-4 w-4" />
            </button>

            {/* Stop button - INLINE, shows during generation */}
            {isGenerating && onStop && (
              <button
                type="button"
                className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                onClick={onStop}
                title="Stop generation"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            )}

            {/* Send button - INLINE */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-50",
                canSubmit ? "text-primary hover:bg-primary/10" : "text-muted-foreground"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Send message</span>
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mt-1.5 px-1">
        Press Enter to send, Shift+Enter for new line
      </div>
    </form>
  );
}
