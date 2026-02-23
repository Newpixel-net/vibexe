/**
 * Real-Time Event Bus
 *
 * In-process EventEmitter for propagating data mutations to SSE subscribers.
 * Each app gets its own channel: `data:{appId}`.
 *
 * Usage:
 *   emitDataEvent(appId, { entity: "tasks", action: "created", record: row });
 *   onDataEvent(appId, callback);
 *   offDataEvent(appId, callback);
 */

import { EventEmitter } from "node:events";

export interface DataChangeEvent {
	entity: string;
	action: "created" | "updated" | "deleted";
	record: Record<string, unknown>;
	timestamp: string;
}

export type DataEventCallback = (event: DataChangeEvent) => void;

// Global singleton — survives across requests in the same Node process
const emitter = new EventEmitter();
emitter.setMaxListeners(1000); // Allow many concurrent SSE connections

function channelKey(appId: string): string {
	return `data:${appId}`;
}

/** Emit a data mutation event for an app. Fire-and-forget — never throws. */
export function emitDataEvent(
	appId: string,
	event: Omit<DataChangeEvent, "timestamp">,
): void {
	try {
		emitter.emit(channelKey(appId), {
			...event,
			timestamp: new Date().toISOString(),
		} satisfies DataChangeEvent);
	} catch {
		// Never let event emission break a data mutation
	}
}

/** Subscribe to data events for an app. */
export function onDataEvent(
	appId: string,
	callback: DataEventCallback,
): void {
	emitter.on(channelKey(appId), callback);
}

/** Unsubscribe from data events for an app. */
export function offDataEvent(
	appId: string,
	callback: DataEventCallback,
): void {
	emitter.off(channelKey(appId), callback);
}

/** Get the number of active listeners for an app (for debugging/monitoring). */
export function getListenerCount(appId: string): number {
	return emitter.listenerCount(channelKey(appId));
}

/** Get total listener count across all channels. */
export function getTotalListenerCount(): number {
	return emitter.eventNames().reduce(
		(sum, name) => sum + emitter.listenerCount(name),
		0,
	);
}
