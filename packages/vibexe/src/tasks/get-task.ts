import type { TaskId } from "@vibexe-ai/protocol";
import { Task } from "@vibexe-ai/protocol";
import { taskPath } from "../path";
import type { VibexeContext } from "../types";

export async function getTask(args: {
	taskId: TaskId;
	context: VibexeContext;
}) {
	const task = await args.context.storage.getJson({
		path: taskPath(args.taskId),
		schema: Task,
	});
	return task;
}
