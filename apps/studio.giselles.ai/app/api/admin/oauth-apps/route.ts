import { NextResponse } from "next/server";
import { fetchCurrentTeam } from "@/services/teams";
import {
	getAllOAuthAppConfigs,
	upsertOAuthAppConfig,
	deleteOAuthAppConfig,
} from "@/services/integrations/oauth-app-config";

export async function GET() {
	try {
		// Verify user is authenticated (team access check)
		await fetchCurrentTeam();
		const configs = await getAllOAuthAppConfigs();

		return NextResponse.json({ configs });
	} catch (error) {
		console.error("Failed to fetch OAuth app configs:", error);
		return NextResponse.json(
			{ error: "Failed to fetch OAuth app configs" },
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
	try {
		await fetchCurrentTeam();

		const body = (await request.json()) as {
			provider?: string;
			clientId?: string;
			clientSecret?: string;
			scopes?: string;
			extraParams?: Record<string, string>;
		};

		if (!body.provider || !body.clientId || !body.clientSecret) {
			return NextResponse.json(
				{ error: "provider, clientId, and clientSecret are required" },
				{ status: 400 },
			);
		}

		const config = await upsertOAuthAppConfig({
			provider: body.provider,
			clientId: body.clientId,
			clientSecret: body.clientSecret,
			scopes: body.scopes,
			extraParams: body.extraParams,
		});

		return NextResponse.json(
			{
				dbId: config.dbId,
				provider: config.provider,
				clientId: config.clientId,
				enabled: config.enabled,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Failed to save OAuth app config:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to save OAuth app config",
			},
			{ status: 500 },
		);
	}
}

export async function DELETE(request: Request) {
	try {
		await fetchCurrentTeam();

		const url = new URL(request.url);
		const provider = url.searchParams.get("provider");

		if (!provider) {
			return NextResponse.json(
				{ error: "provider query parameter is required" },
				{ status: 400 },
			);
		}

		const deleted = await deleteOAuthAppConfig(provider);

		if (!deleted) {
			return NextResponse.json(
				{ error: "Config not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to delete OAuth app config:", error);
		return NextResponse.json(
			{ error: "Failed to delete OAuth app config" },
			{ status: 500 },
		);
	}
}
