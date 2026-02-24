import {
	isLanguageModelId,
	isLanguageModelProvider,
	type LanguageModelId,
	type LanguageModelProvider,
} from "@vibexe-ai/language-model-registry";
import * as z from "zod/v4";

export const ChatModelContent = z.object({
	type: z.literal("chatModel"),
	languageModel: z.object({
		provider: z.custom<LanguageModelProvider>((v) =>
			isLanguageModelProvider(v),
		),
		id: z.custom<LanguageModelId>(isLanguageModelId),
		configuration: z.record(z.string(), z.any()),
	}),
});

export type ChatModelContent = z.infer<typeof ChatModelContent>;

export const ChatModelContentReference = z.object({
	type: ChatModelContent.shape.type,
});
export type ChatModelContentReference = z.infer<
	typeof ChatModelContentReference
>;
