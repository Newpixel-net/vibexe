import type { TaskId } from "@vibexe-ai/protocol";
import { getTask } from "../tasks";
import type { VibexeContext } from "../types";
import { getTaskGenerationIndexes as internal_getTaskGenerationIndexes } from "./internal/get-task-generation-indexes";

export async function getTaskGenerationIndexes({
	taskId,
	context,
}: {
	context: VibexeContext;
	taskId: TaskId;
}) {
	const [task, generationIndexes] = await Promise.all([
		getTask({ taskId, context }),
		internal_getTaskGenerationIndexes({
			taskId,
			storage: context.storage,
		}),
	]);
	return { task, generationIndexes };
}
