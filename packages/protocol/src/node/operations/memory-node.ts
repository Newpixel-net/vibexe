import * as z from "zod/v4";

export const MemoryNodeContent = z.object({
	type: z.literal("memoryNode"),
	memoryType: z.enum(["simpleMemory", "windowBuffer"]),
	contextWindowLength: z.number().default(10),
	sessionScope: z.enum(["workspace", "agent"]).default("agent"),
});

export type MemoryNodeContent = z.infer<typeof MemoryNodeContent>;

export const MemoryNodeContentReference = z.object({
	type: MemoryNodeContent.shape.type,
});
export type MemoryNodeContentReference = z.infer<
	typeof MemoryNodeContentReference
>;
