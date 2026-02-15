/**
 * Polyfill requestAnimationFrame for server-side (Node.js) environments.
 *
 * TipTap/ProseMirror extensions (dropcursor, gapcursor) reference
 * requestAnimationFrame at module load time. When these modules are
 * imported on the server during generation (e.g. jsonContentToText),
 * Node.js throws "ReferenceError: requestAnimationFrame is not defined".
 *
 * This polyfill must be imported BEFORE any TipTap/ProseMirror imports.
 */
if (typeof globalThis.requestAnimationFrame === "undefined") {
	(globalThis as Record<string, unknown>).requestAnimationFrame = (
		fn: FrameRequestCallback,
	) => setTimeout(fn, 0) as unknown as number;
}
if (typeof globalThis.cancelAnimationFrame === "undefined") {
	(globalThis as Record<string, unknown>).cancelAnimationFrame = (
		id: number,
	) => clearTimeout(id);
}
