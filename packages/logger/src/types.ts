import type { Logger } from "pino";

export type VibexeLogger = Pick<Logger, "info" | "warn" | "error" | "debug">;
