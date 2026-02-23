/**
 * CORS headers for app-level auth endpoints.
 *
 * These endpoints are called cross-origin by client-side SDKs
 * (deployed apps, Sandpack previews, etc.).
 */

import { NextResponse } from "next/server";

export const AUTH_CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
	"Access-Control-Max-Age": "86400",
} as const;

/** Preflight OPTIONS handler for auth routes */
export function handleAuthOptions(): NextResponse {
	return new NextResponse(null, { status: 204, headers: AUTH_CORS_HEADERS });
}

/** Add CORS headers to a NextResponse */
export function withCors(response: NextResponse): NextResponse {
	for (const [key, value] of Object.entries(AUTH_CORS_HEADERS)) {
		response.headers.set(key, value);
	}
	return response;
}
