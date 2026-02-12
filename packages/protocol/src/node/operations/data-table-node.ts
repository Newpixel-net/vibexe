import * as z from "zod/v4";
import { ConditionGroup } from "./if-node";

export const FieldMapping = z.object({
	column: z.string(),
	value: z.string(), // expression or literal
});
export type FieldMapping = z.infer<typeof FieldMapping>;

export const DataTableNodeContent = z.object({
	type: z.literal("dataTable"),
	tableId: z.string().default(""),
	tableName: z.string().default(""),
	operation: z
		.enum(["query", "insert", "update", "delete", "upsert"])
		.default("query"),
	filter: ConditionGroup.optional(),
	fields: z.array(FieldMapping).default([]),
	limit: z.number().int().min(0).default(100),
});
export type DataTableNodeContent = z.infer<typeof DataTableNodeContent>;

export const DataTableNodeContentReference = z.object({
	type: DataTableNodeContent.shape.type,
});
export type DataTableNodeContentReference = z.infer<
	typeof DataTableNodeContentReference
>;
