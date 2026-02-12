import * as z from "zod/v4";

export const FieldOperation = z.object({
	operation: z.enum(["set", "remove", "rename"]),
	fieldName: z.string(),
	value: z.string().optional(),
	newFieldName: z.string().optional(),
});
export type FieldOperation = z.infer<typeof FieldOperation>;

export const EditFieldsNodeContent = z.object({
	type: z.literal("editFields"),
	operations: z.array(FieldOperation).default([]),
	keepOnlySet: z.boolean().default(false),
});
export type EditFieldsNodeContent = z.infer<typeof EditFieldsNodeContent>;

export const EditFieldsNodeContentReference = z.object({
	type: EditFieldsNodeContent.shape.type,
});
export type EditFieldsNodeContentReference = z.infer<
	typeof EditFieldsNodeContentReference
>;
