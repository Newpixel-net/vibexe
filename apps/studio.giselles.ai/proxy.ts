import { NextResponse } from "next/server";
import { sessionMiddleware } from "./lib/auth/session-middleware";

// biome-ignore lint/suspicious/useAwait: async required for TypeScript signature compatibility
export const proxy = sessionMiddleware(async (user, request) => {
	// Edge Config disabled for self-hosted mode - maintenance mode always false
	const maintenance = false;
	if (maintenance) {
		request.nextUrl.pathname = "/maintenance";

		// Rewrite to the url
		return NextResponse.rewrite(request.nextUrl);
	}
	if (user == null) {
		// no user, potentially respond by redirecting the user to the login page
		const url = request.nextUrl.clone();
		const returnUrl = request.nextUrl.pathname + request.nextUrl.search;
		url.pathname = "/login";
		url.searchParams.set("returnUrl", returnUrl);
		return NextResponse.redirect(url);
	}
});

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|.well-known|webhooks|legal|login|signup|join|pricing|password_reset|subscription|auth|api/vector-stores/cron|api/apps|robots\.txt|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
