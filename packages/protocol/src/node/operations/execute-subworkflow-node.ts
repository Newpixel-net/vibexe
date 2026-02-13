import * as z from "zod/v4";

export const ExecuteSubWorkflowNodeContent = z.object({
	type: z.literal("executeSubWorkflow"),
	targetWorkspaceId: z.string().default(""),
	inputMapping: z.record(z.string(), z.string()).default({}),
	outputMapping: z.record(z.string(), z.string()).default({}),
	timeout: z.number().default(300000),
	waitForCompletion: z.boolean().default(true),
});
export type ExecuteSubWorkflowNodeContent = z.infer<
	typeof ExecuteSubWorkflowNodeContent
>;

export const ExecuteSubWorkflowNodeContentReference = z.object({
	type: ExecuteSubWorkflowNodeContent.shape.type,
});
export type ExecuteSubWorkflowNodeContentReference = z.infer<
	typeof ExecuteSubWorkflowNodeContentReference
>;
