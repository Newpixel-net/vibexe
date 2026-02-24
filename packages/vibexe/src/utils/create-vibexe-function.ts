import type * as z from "zod/v4";
import type { VibexeContext } from "../types";

type HandlerArgs<TSchema extends z.ZodObject> = {
	input: z.infer<TSchema>;
	context: VibexeContext;
};

type FunctionInputArgs<TSchema extends z.ZodObject> = {
	input: z.infer<TSchema>;
	context: VibexeContext;
};

type VibexeFunctionInput<
	// biome-ignore lint/suspicious/noExplicitAny: For use in utility functions
	T extends (args: { input: any; context: VibexeContext }) => unknown,
> = Parameters<T>[0]["input"];

export function createVibexeFunction<
	TInputSchema extends z.ZodObject,
	TOutput,
>({
	input,
	handler,
}: {
	input: TInputSchema;
	handler: (args: HandlerArgs<TInputSchema>) => TOutput;
}) {
	const fn = async (
		args: FunctionInputArgs<TInputSchema>,
	): Promise<Awaited<TOutput>> => {
		// Validate input against schema
		const validatedInput = input.parse(args.input);

		// Process request with validated input
		return await handler({
			input: validatedInput,
			context: args.context,
		});
	};

	return Object.assign(fn, { inputSchema: input });
}

/**
 * Binds a Vibexe function to a context to be used as a Vibexe method.
 * Transfers the inputSchema property so it can be accessed from the  instance.
 */
export function bindVibexeFunction<
	T extends {
		inputSchema: z.ZodObject;
	} & ((args: {
		// biome-ignore lint/suspicious/noExplicitAny: For use in utility functions
		input: any;
		context: VibexeContext;
	}) => unknown),
>(
	fn: T,
	context: VibexeContext,
): ((input: VibexeFunctionInput<T>) => Promise<Awaited<ReturnType<T>>>) & {
	inputSchema: T["inputSchema"];
} {
	return Object.assign(
		(input: VibexeFunctionInput<T>) => {
			return fn({ input, context });
		},
		{ inputSchema: fn.inputSchema },
	) as ((input: VibexeFunctionInput<T>) => Promise<Awaited<ReturnType<T>>>) & {
		inputSchema: T["inputSchema"];
	};
}
