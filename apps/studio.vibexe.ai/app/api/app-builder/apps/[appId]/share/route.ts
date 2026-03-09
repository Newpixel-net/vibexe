import {
	disableShare,
	enableShare,
	getAppById,
} from "@/app/(main)/app-builder/lib/queries";
import { getUser } from "@/lib/auth/get-user";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vibexe.online";

/**
 * POST /api/app-builder/apps/[appId]/share
 * Body: { enabled: boolean }
 * Returns: { shareToken, shareUrl } or { shareToken: null }
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ appId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { appId } = await params;
	const app = await getAppById(appId, user.dbId);
	if (!app) {
		return Response.json({ error: "App not found" }, { status: 404 });
	}

	const body = await request.json();
	const enabled = body.enabled !== false; // default to true

	if (enabled) {
		const token = await enableShare(appId);
		return Response.json({
			shareToken: token,
			shareUrl: `${SITE_URL}/preview/${token}`,
		});
	}

	await disableShare(appId);
	return Response.json({ shareToken: null, shareUrl: null });
}

/**
 * GET /api/app-builder/apps/[appId]/share
 * Returns current share status
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ appId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { appId } = await params;
	const app = await getAppById(appId, user.dbId);
	if (!app) {
		return Response.json({ error: "App not found" }, { status: 404 });
	}

	const token = app.shareToken;
	return Response.json({
		shareToken: token ?? null,
		shareUrl: token ? `${SITE_URL}/preview/${token}` : null,
	});
}
