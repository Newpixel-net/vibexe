import * as z from "zod/v4";

export const IntegrationContent = z.object({
	type: z.literal("integration"),
	pieceName: z.string(),
	actionName: z.string(),
	pieceVersion: z.string(),
	configuration: z.record(z.string(), z.unknown()).default({}),
	credentialId: z.string().optional(),
});
export type IntegrationContent = z.infer<typeof IntegrationContent>;

export const IntegrationContentReference = z.object({
	type: IntegrationContent.shape.type,
});
export type IntegrationContentReference = z.infer<
	typeof IntegrationContentReference
>;
