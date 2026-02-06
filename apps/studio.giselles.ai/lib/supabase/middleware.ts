import { type NextRequest, NextResponse } from "next/server";
import { extendSession, getSessionByToken } from "../session-store";

const SESSION_COOKIE_NAME = "giselle-session";
const PUBLIC_PATHS = [
	"/",
	"/login",
	"/signup",
	"/auth/callback",
	"/api/health",
];

export const supabaseMiddleware = (
	guardCallback?: (
		user: { id: string } | null,
		request: NextRequest,
	) => Promise<NextResponse | undefined>,
) => {
	return async (request: NextRequest) => {
		const response = NextResponse.next({ request });

		const _isPublicPath = PUBLIC_PATHS.some(
			(path) =>
				request.nextUrl.pathname === path ||
				request.nextUrl.pathname.startsWith("/auth/"),
		);

		const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

		if (!sessionToken) {
			const guardResponse = await guardCallback?.(null, request);
			if (guardResponse) return guardResponse;
			return response;
		}

		const session = await getSessionByToken(sessionToken);

		if (!session) {
			response.cookies.delete(SESSION_COOKIE_NAME);
			const guardResponse = await guardCallback?.(null, request);
			if (guardResponse) return guardResponse;
			return response;
		}

		// Extend session if close to expiry (within 1 day)
		const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
		if (session.expiresAt < oneDayFromNow) {
			await extendSession(sessionToken, 7);
		}

		const guardResponse = await guardCallback?.(
			{ id: session.userId },
			request,
		);
		if (guardResponse) return guardResponse;

		return response;
	};
};
