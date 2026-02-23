/**
 * Simple in-memory sliding window rate limiter.
 *
 * Designed for single-server deployments. Tracks request counts per key
 * (typically IP address) within a sliding time window.
 *
 * Entries are lazily cleaned up to prevent unbounded memory growth.
 */

interface RateLimitEntry {
	timestamps: number[];
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function getStore(namespace: string): Map<string, RateLimitEntry> {
	let store = stores.get(namespace);
	if (!store) {
		store = new Map();
		stores.set(namespace, store);
	}
	return store;
}

function cleanup(store: Map<string, RateLimitEntry>, windowMs: number): void {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;
	lastCleanup = now;

	const cutoff = now - windowMs;
	for (const [key, entry] of store) {
		entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
		if (entry.timestamps.length === 0) {
			store.delete(key);
		}
	}
}

/**
 * Check if a request should be rate-limited.
 *
 * @param namespace - Category name (e.g., "signin", "signup")
 * @param key - Identifier to rate limit (e.g., IP address)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Object with `allowed` boolean and `retryAfterMs` if blocked
 */
export function checkRateLimit(
	namespace: string,
	key: string,
	maxRequests: number,
	windowMs: number,
): { allowed: boolean; retryAfterMs?: number; remaining: number } {
	const store = getStore(namespace);
	cleanup(store, windowMs);

	const now = Date.now();
	const cutoff = now - windowMs;

	let entry = store.get(key);
	if (!entry) {
		entry = { timestamps: [] };
		store.set(key, entry);
	}

	// Remove expired timestamps
	entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

	if (entry.timestamps.length >= maxRequests) {
		const oldestInWindow = entry.timestamps[0];
		const retryAfterMs = oldestInWindow + windowMs - now;
		return {
			allowed: false,
			retryAfterMs: Math.max(0, retryAfterMs),
			remaining: 0,
		};
	}

	entry.timestamps.push(now);
	return {
		allowed: true,
		remaining: maxRequests - entry.timestamps.length,
	};
}

/**
 * Extract client IP from a request. Checks X-Forwarded-For (for proxies),
 * X-Real-IP, then falls back to a default.
 */
export function getClientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		// Take the first IP (client's IP before proxies)
		return forwarded.split(",")[0].trim();
	}
	return request.headers.get("x-real-ip") ?? "unknown";
}
