import type { VibexeLogger } from "./types";

const noop = (..._args: unknown[]): void => {};

export const noopLogger: VibexeLogger = {
	info: noop,
	warn: noop,
	error: noop,
	debug: noop,
};
