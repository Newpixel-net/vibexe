import type { TaskId } from "@vibexe-ai/protocol";
import { NodeGenerationIndex } from "@vibexe-ai/protocol";
import type { VibexeStorage } from "@vibexe-ai/storage";
import { taskGenerationIndexesPath } from "../../path";

export async function getTaskGenerationIndexes(args: {
	taskId: TaskId;
	storage: VibexeStorage;
}) {
	if (!(await args.storage.exists(taskGenerationIndexesPath(args.taskId)))) {
		return undefined;
	}
	return await args.storage.getJson({
		path: taskGenerationIndexesPath(args.taskId),
		schema: NodeGenerationIndex.array(),
	});
}
