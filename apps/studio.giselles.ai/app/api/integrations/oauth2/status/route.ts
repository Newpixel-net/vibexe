import { NextResponse } from "next/server";
import {
	getCatalogEntry,
	getOAuthProvider,
} from "@giselles-ai/activepieces-adapter";
import { isOAuthConfigured } from "@/services/integrations/oauth-app-config";

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const pieceName = url.searchParams.get("pieceName");

		if (!pieceName) {
			return NextResponse.json(
				{ error: "pieceName query parameter is required" },
				{ status: 400 },
			);
		}

		// Check if the piece uses OAuth2
		const catalogEntry = getCatalogEntry(pieceName);
		if (!catalogEntry || catalogEntry.authType !== "oauth2") {
			return NextResponse.json({
				available: false,
				reason: `Piece "${pieceName}" does not use OAuth2 authentication`,
			});
		}

		// Check if OAuth app is configured for this piece's provider
		const provider = getOAuthProvider(pieceName);
		const configured = await isOAuthConfigured(provider);

		if (!configured) {
			return NextResponse.json({
				available: false,
				reason: `No OAuth app configured for provider "${provider}". Ask your admin to configure it in Settings > OAuth Apps.`,
				provider,
			});
		}

		return NextResponse.json({
			available: true,
			provider,
			pieceName,
			displayName: catalogEntry.displayName,
		});
	} catch (error) {
		console.error("Failed to check OAuth status:", error);
		return NextResponse.json(
			{ error: "Failed to check OAuth status" },
			{ status: 500 },
		);
	}
}
