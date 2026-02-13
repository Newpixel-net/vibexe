import * as z from "zod/v4";

export const RenameKeyMapping = z.object({
	from: z.string(),
	to: z.string(),
});
export type RenameKeyMapping = z.infer<typeof RenameKeyMapping>;

export const RenameKeysNodeContent = z.object({
	type: z.literal("renameKeys"),
	mappings: z.array(RenameKeyMapping).default([]),
});
export type RenameKeysNodeContent = z.infer<typeof RenameKeysNodeContent>;

export const RenameKeysNodeContentReference = z.object({
	type: RenameKeysNodeContent.shape.type,
});
export type RenameKeysNodeContentReference = z.infer<
	typeof RenameKeysNodeContentReference
>;
