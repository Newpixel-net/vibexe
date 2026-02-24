import type { Task } from "@vibexe-ai/protocol";
import { create } from "zustand";

export interface DebugSession {
	taskId: string;
	taskName: string;
	createdAt: number;
	/** Maps nodeId (from step.name or dagNodeGenerationMap) to generationId */
	nodeGenerationMap: Record<string, string>;
}

interface DebugSessionStore {
	debugSession: DebugSession | null;
	enterDebugSession: (task: Task) => void;
	exitDebugSession: () => void;
}

export const useDebugSessionStore = create<DebugSessionStore>((set) => ({
	debugSession: null,
	enterDebugSession: (task: Task) => {
		const nodeGenerationMap: Record<string, string> = {};

		// First, use dagNodeGenerationMap if available (DAG executions)
		if (task.dagNodeGenerationMap) {
			for (const [nodeId, genId] of Object.entries(task.dagNodeGenerationMap)) {
				nodeGenerationMap[nodeId] = genId;
			}
		}

		// Also extract from sequences/steps (legacy executions)
		for (const sequence of task.sequences) {
			for (const step of sequence.steps) {
				if (step.generationId) {
					// step.name is the node display name, but we need nodeId
					// The generationId is the reliable key for looking up data
					nodeGenerationMap[step.name] = step.generationId;
				}
			}
		}

		set({
			debugSession: {
				taskId: task.id,
				taskName: task.name || "Untitled Run",
				createdAt: task.createdAt,
				nodeGenerationMap,
			},
		});
	},
	exitDebugSession: () => set({ debugSession: null }),
}));
