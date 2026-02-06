/**
 * Phase Adapter
 *
 * Generates PhaseTimelineItem data from AI SDK tool events.
 * Since AI SDK does not have native "phases", we create phases based on tool invocations:
 * - createFile/updateFile tools trigger phases
 * - Multiple file operations in succession get grouped into a single phase
 * - Phase status updates as tools complete
 */

import type {
	PhaseFile,
	PhaseTimelineItem,
	ProjectStage,
} from "../types/vibesdk";

/**
 * Tool event from AI SDK streaming (used by message-adapter)
 */
export interface ToolStreamEvent {
	type: "tool-call" | "tool-result";
	toolCallId: string;
	toolName?: string;
	args?: Record<string, unknown>;
	result?: unknown;
}

/**
 * Phase grouping configuration
 */
interface PhaseConfig {
	/** Minimum files to start a new phase (default: 1) */
	minFilesForPhase?: number;
	/** Tool names that create files */
	fileCreationTools?: string[];
	/** Tool names that update files */
	fileUpdateTools?: string[];
}

const DEFAULT_CONFIG: Required<PhaseConfig> = {
	minFilesForPhase: 1,
	fileCreationTools: ["createFile", "writeFile", "create_file", "write_file"],
	fileUpdateTools: ["updateFile", "editFile", "update_file", "edit_file"],
};

/**
 * Extract file path from tool arguments
 */
function extractFilePath(args: Record<string, unknown>): string | null {
	const pathKeys = ["path", "filePath", "file_path", "filename", "file"];

	for (const key of pathKeys) {
		const value = args[key];
		if (typeof value === "string" && value.length > 0) {
			return value;
		}
	}

	return null;
}

/**
 * Check if a file path is a blueprint file
 */
function isBlueprintFile(path: string): boolean {
	const lowerPath = path.toLowerCase();
	return (
		lowerPath === "blueprint.md" ||
		lowerPath.endsWith("/blueprint.md") ||
		lowerPath.includes("blueprint")
	);
}

/**
 * Generate phase name from file paths
 */
function generatePhaseName(filePaths: string[]): string {
	if (filePaths.length === 0) return "Processing";

	// Check if this is a blueprint file
	if (filePaths.length === 1 && isBlueprintFile(filePaths[0])) {
		return "Generating Blueprint";
	}

	if (filePaths.length === 1) {
		const fileName = filePaths[0].split("/").pop() || filePaths[0];
		return `Creating ${fileName}`;
	}

	const dirs = new Set(
		filePaths.map((p) => {
			const parts = p.split("/");
			return parts.length > 1 ? parts.slice(0, -1).join("/") : "root";
		}),
	);

	if (dirs.size === 1) {
		const dir = [...dirs][0];
		return dir === "root"
			? `Creating ${filePaths.length} files`
			: `Creating ${dir} files`;
	}

	return `Creating ${filePaths.length} files`;
}

/**
 * Generate phase description
 */
function generatePhaseDescription(
	toolName: string,
	filePaths: string[],
): string {
	const isUpdate =
		DEFAULT_CONFIG.fileUpdateTools.includes(toolName) ||
		toolName.includes("update") ||
		toolName.includes("edit");

	const action = isUpdate ? "Updating" : "Creating";

	if (filePaths.length === 1) {
		return `${action} ${filePaths[0]}`;
	}

	return `${action} ${filePaths.length} files`;
}

/**
 * Create a new phase from a tool event
 */
export function createPhaseFromToolEvent(
	event: ToolStreamEvent,
	existingPhases: PhaseTimelineItem[] = [],
	config: PhaseConfig = {},
): PhaseTimelineItem | null {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	if (event.type !== "tool-call") return null;

	const toolName = event.toolName || "";
	const isFileOperation =
		cfg.fileCreationTools.includes(toolName) ||
		cfg.fileUpdateTools.includes(toolName);

	if (!isFileOperation || !event.args) return null;

	const filePath = extractFilePath(event.args);
	if (!filePath) return null;

	const activePhase = existingPhases.find((p) => p.status === "generating");

	if (activePhase) {
		return null;
	}

	const phase: PhaseTimelineItem = {
		id: `phase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		name: generatePhaseName([filePath]),
		description: generatePhaseDescription(toolName, [filePath]),
		files: [
			{
				path: filePath,
				status: "generating",
			},
		],
		status: "generating",
		timestamp: Date.now(),
	};

	return phase;
}

/**
 * Update an existing phase with a new file
 */
export function updatePhaseWithFile(
	phase: PhaseTimelineItem,
	event: ToolStreamEvent,
	config: PhaseConfig = {},
): PhaseTimelineItem | null {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	if (event.type !== "tool-call" || !event.args) return null;

	const toolName = event.toolName || "";
	const isFileOperation =
		cfg.fileCreationTools.includes(toolName) ||
		cfg.fileUpdateTools.includes(toolName);

	if (!isFileOperation) return null;

	const filePath = extractFilePath(event.args);
	if (!filePath) return null;

	const existingFile = phase.files.find((f) => f.path === filePath);
	if (existingFile) {
		return {
			...phase,
			files: phase.files.map((f) =>
				f.path === filePath ? { ...f, status: "generating" as const } : f,
			),
		};
	}

	const newFiles: PhaseFile[] = [
		...phase.files,
		{ path: filePath, status: "generating" },
	];

	return {
		...phase,
		name: generatePhaseName(newFiles.map((f) => f.path)),
		description: generatePhaseDescription(
			toolName,
			newFiles.map((f) => f.path),
		),
		files: newFiles,
	};
}

/**
 * Update phase status based on tool completion
 */
export function updatePhaseStatus(
	phases: PhaseTimelineItem[],
	_toolCallId: string,
	result: { success: boolean; error?: string },
	fileContents?: string,
): PhaseTimelineItem[] {
	return phases.map((phase) => {
		const fileIndex = phase.files.findIndex((f) => f.status === "generating");

		if (fileIndex === -1) return phase;

		const updatedFiles = phase.files.map((file, idx) => {
			if (idx === fileIndex && file.status === "generating") {
				return {
					...file,
					status: result.success ? ("completed" as const) : ("error" as const),
					contents: fileContents,
				};
			}
			return file;
		});

		const allComplete = updatedFiles.every(
			(f) => f.status === "completed" || f.status === "error",
		);
		const hasError = updatedFiles.some((f) => f.status === "error");

		return {
			...phase,
			files: updatedFiles,
			status: allComplete ? (hasError ? "error" : "completed") : phase.status,
		};
	});
}

/**
 * Mark a phase file as completed
 */
export function markFileCompleted(
	phases: PhaseTimelineItem[],
	filePath: string,
	contents?: string,
): PhaseTimelineItem[] {
	return phases.map((phase) => {
		const fileIndex = phase.files.findIndex((f) => f.path === filePath);

		if (fileIndex === -1) return phase;

		const updatedFiles = phase.files.map((file) => {
			if (file.path === filePath) {
				return {
					...file,
					status: "completed" as const,
					contents,
				};
			}
			return file;
		});

		const allComplete = updatedFiles.every(
			(f) => f.status === "completed" || f.status === "error",
		);
		const hasError = updatedFiles.some((f) => f.status === "error");

		return {
			...phase,
			files: updatedFiles,
			status: allComplete ? (hasError ? "error" : "completed") : phase.status,
		};
	});
}

/**
 * Mark a phase file as errored
 */
export function markFileError(
	phases: PhaseTimelineItem[],
	filePath: string,
): PhaseTimelineItem[] {
	return phases.map((phase) => {
		const fileIndex = phase.files.findIndex((f) => f.path === filePath);

		if (fileIndex === -1) return phase;

		const updatedFiles = phase.files.map((file) => {
			if (file.path === filePath) {
				return {
					...file,
					status: "error" as const,
				};
			}
			return file;
		});

		const allComplete = updatedFiles.every(
			(f) => f.status === "completed" || f.status === "error",
		);

		return {
			...phase,
			files: updatedFiles,
			status: allComplete ? "error" : phase.status,
		};
	});
}

/**
 * Create default project stages
 * Matches VibeSDK Phase Timeline naming
 */
export function createDefaultProjectStages(): ProjectStage[] {
	return [
		{ id: "bootstrap", title: "Bootstrapping project", status: "pending" },
		{ id: "blueprint", title: "Generating Blueprint", status: "pending" },
		{ id: "code", title: "Generating code", status: "pending" },
		{ id: "done", title: "Done", status: "pending" },
	];
}

/**
 * Update project stage status
 */
export function updateProjectStage(
	stages: ProjectStage[],
	stageId: "bootstrap" | "blueprint" | "code" | "done",
	status: ProjectStage["status"],
): ProjectStage[] {
	return stages.map((stage) =>
		stage.id === stageId ? { ...stage, status } : stage,
	);
}

/**
 * Calculate overall progress from phases
 */
export function calculateProgress(phases: PhaseTimelineItem[]): {
	completed: number;
	total: number;
	percentage: number;
} {
	const completed = phases.filter(
		(p) => p.status === "completed" || p.status === "error",
	).length;
	const total = phases.length;
	const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

	return { completed, total, percentage };
}

/**
 * Get the currently active phase
 */
export function getActivePhase(
	phases: PhaseTimelineItem[],
): PhaseTimelineItem | undefined {
	return phases.find(
		(p) => p.status === "generating" || p.status === "validating",
	);
}
