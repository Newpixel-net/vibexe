import { NextResponse } from "next/server";
import { fetchCurrentTeam } from "@/services/teams";
import {
	createCredential,
	getCredentialsForTeam,
} from "@/services/integrations/credential-store";

export async function GET(request: Request) {
	try {
		const team = await fetchCurrentTeam();
		const credentials = await getCredentialsForTeam(team.dbId);

		// Optional filter by pieceName
		const url = new URL(request.url);
		const pieceNameFilter = url.searchParams.get("pieceName");
		const filtered = pieceNameFilter
			? credentials.filter((c) => c.pieceName === pieceNameFilter)
			: credentials;

		return NextResponse.json({
			credentials: filtered.map((c) => ({
				dbId: c.dbId,
				pieceName: c.pieceName,
				displayName: c.displayName,
				authType: c.authType,
				createdAt: c.createdAt.toISOString(),
			})),
		});
	} catch (error) {
		console.error("Failed to fetch credentials:", error);
		return NextResponse.json(
			{ error: "Failed to fetch credentials" },
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as {
			pieceName?: string;
			displayName?: string;
			authType?: string;
			config?: Record<string, unknown>;
		};

		if (!body.pieceName || !body.authType || !body.config) {
			return NextResponse.json(
				{ error: "pieceName, authType, and config are required" },
				{ status: 400 },
			);
		}

		const team = await fetchCurrentTeam();
		const credential = await createCredential({
			teamDbId: team.dbId,
			pieceName: body.pieceName,
			displayName: body.displayName || body.pieceName,
			authType: body.authType,
			config: body.config,
		});

		return NextResponse.json(
			{
				dbId: credential.dbId,
				pieceName: credential.pieceName,
				displayName: credential.displayName,
				authType: credential.authType,
				createdAt: credential.createdAt.toISOString(),
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Failed to create credential:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to create credential",
			},
			{ status: 500 },
		);
	}
}
