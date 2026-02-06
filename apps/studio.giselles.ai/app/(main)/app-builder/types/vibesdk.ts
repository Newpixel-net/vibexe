/**
 * VibeSDK Type Definitions
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/types/vibesdk.ts
 *
 * These types are adapted from Vibexe's VibeSDK type system for the App Builder feature.
 * They define the interfaces used by chat, timeline, and file components.
 */

/**
 * File representation for the file explorer and editor.
 * Maps to builder_files table in database.
 */
export interface FileType {
	/** Unique file identifier */
	id: string;
	/** File path relative to project root (e.g., "src/App.tsx") */
	filePath: string;
	/** File contents as string */
	fileContents: string;
	/** True when AI is actively generating this file */
	isGenerating?: boolean;
	/** True when file has validation errors that need fixing */
	needsFixing?: boolean;
	/** True when file has runtime errors */
	hasErrors?: boolean;
	/** Programming language for syntax highlighting */
	language?: string | null;
}

/**
 * Individual phase in the generation timeline.
 * Used by PhaseTimeline component to show progress.
 */
export interface PhaseTimelineItem {
	/** Unique identifier for this phase */
	id: string;
	/** Display name (e.g., "Creating Components") */
	name: string;
	/** Detailed description of what's happening */
	description: string;
	/** Files being generated in this phase */
	files: PhaseFile[];
	/** Current status of this phase */
	status:
		| "pending"
		| "generating"
		| "validating"
		| "completed"
		| "error"
		| "cancelled";
	/** Unix timestamp when phase started */
	timestamp: number;
}

/**
 * File within a phase timeline item.
 */
export interface PhaseFile {
	/** File path being generated */
	path: string;
	/** Generation status */
	status: "generating" | "completed" | "error";
	/** File contents (available when completed) */
	contents?: string;
}

/**
 * High-level project stage indicator.
 * Shows overall progress: bootstrap -> blueprint -> code
 */
export interface ProjectStage {
	/** Stage identifier */
	id: "bootstrap" | "blueprint" | "code";
	/** Display title */
	title: string;
	/** Current status */
	status: "pending" | "active" | "completed" | "error";
}

/**
 * Chat message format for VibeSDK message components.
 * Adapted from Vibexe's ChatMessage to work with AI SDK v6.
 */
export interface ChatMessage {
	/** Unique message ID */
	id: string;
	/** Message role */
	role: "user" | "assistant";
	/** Message text content */
	content: string;
	/** Unix timestamp */
	timestamp: number;
	/** Tool invocations embedded in this message */
	toolEvents?: ToolEvent[];
	/** Image attachments (for user messages) */
	images?: ImageAttachment[];
}

/**
 * Tool invocation event for inline display.
 * Maps to AI SDK tool call structure.
 */
export interface ToolEvent {
	/** Tool invocation ID */
	id: string;
	/** Tool name (e.g., "createFile", "updateFile") */
	toolName: string;
	/** Tool arguments */
	args: Record<string, unknown>;
	/** Tool result */
	result?: unknown;
	/** Status */
	status: "pending" | "running" | "completed" | "error";
}

/**
 * Image attachment for chat messages.
 * Used for tracking attached images before sending.
 */
export interface ImageAttachment {
	/** Unique ID */
	id: string;
	/** Original File object (for upload) */
	file: File;
	/** Object URL for preview display */
	url: string;
	/** Display name (usually filename) */
	name: string;
}

/**
 * File tree item for the FileExplorer component.
 * Recursive structure for nested folder hierarchy.
 */
export interface FileTreeItem {
	/** Display name (filename or folder name) */
	name: string;
	/** Item type */
	type: "file" | "folder";
	/** Full path for this item */
	filePath: string;
	/** Child items (for folders) */
	children?: Record<string, FileTreeItem>;
	/** Associated file data (for files) */
	file?: FileType;
}

/**
 * Chat mode for the builder.
 * - generate: AI can create/modify files
 * - discuss: AI can only discuss, no file operations
 */
export type ChatMode = "generate" | "discuss";

/**
 * Builder app state for the main component.
 */
export interface BuilderAppState {
	/** App ID */
	id: string;
	/** App name */
	name: string;
	/** App description */
	description?: string;
	/** Current files in the app */
	files: FileType[];
	/** Active file being edited */
	activeFile?: FileType;
	/** Current chat mode */
	chatMode: ChatMode;
	/** Is app currently generating */
	isGenerating: boolean;
}

/**
 * Message stored in database (builderChats.messages JSONB)
 * Simplified format for persistence
 */
export interface StoredMessage {
	/** Message ID */
	id: string;
	/** Role */
	role: "user" | "assistant";
	/** Content */
	content: string;
	/** Timestamp */
	timestamp: number;
	/** Tool calls (stored as JSON) */
	toolCalls?: Array<{
		id: string;
		toolName: string;
		args: Record<string, unknown>;
		result?: unknown;
	}>;
}

/**
 * Version snapshot stored in database (builderVersions.files JSONB)
 */
export interface VersionFileSnapshot {
	/** File path */
	path: string;
	/** File content at this version */
	content: string;
	/** Language */
	language?: string | null;
}

/**
 * AppFile interface for frontend components.
 * Maps to BuilderFile from database but with nullable content handling.
 * Re-exported here for type consistency across components.
 */
export interface AppFile {
	/** Unique file identifier */
	id: string;
	/** File path relative to project root */
	path: string;
	/** File content (may be null for empty files) */
	content: string | null;
	/** Programming language for syntax highlighting */
	language?: string | null;
}
