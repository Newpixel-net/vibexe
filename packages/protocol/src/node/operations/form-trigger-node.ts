import * as z from "zod/v4";

export const FormField = z.object({
	id: z.string(),
	name: z.string(),
	label: z.string(),
	type: z.enum([
		"text",
		"number",
		"email",
		"textarea",
		"select",
		"checkbox",
		"date",
	]),
	required: z.boolean().default(false),
	options: z.array(z.string()).default([]),
	placeholder: z.string().default(""),
	defaultValue: z.string().default(""),
});
export type FormField = z.infer<typeof FormField>;

export const FormTriggerNodeContent = z.object({
	type: z.literal("formTrigger"),
	fields: z.array(FormField).default([]),
	submitButtonText: z.string().default("Submit"),
	successMessage: z.string().default("Form submitted successfully!"),
	title: z.string().default(""),
	description: z.string().default(""),
});
export type FormTriggerNodeContent = z.infer<typeof FormTriggerNodeContent>;

export const FormTriggerNodeContentReference = z.object({
	type: FormTriggerNodeContent.shape.type,
});
export type FormTriggerNodeContentReference = z.infer<
	typeof FormTriggerNodeContentReference
>;
