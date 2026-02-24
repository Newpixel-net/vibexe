import { NextResponse } from "next/server";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ pieceName: string }> },
) {
	const { pieceName } = await params;

	if (!pieceName || typeof pieceName !== "string") {
		return NextResponse.json(
			{ error: "pieceName parameter is required" },
			{ status: 400 },
		);
	}

	try {
		const { getPieceOAuth2Metadata } = await import(
			"@vibexe-ai/activepieces-adapter/server"
		);

		const metadata = await getPieceOAuth2Metadata(pieceName);
		if (!metadata) {
			return NextResponse.json({
				authType: "none",
				message: "No OAuth2 configuration found for this piece",
			});
		}

		return NextResponse.json({
			authType: "oauth2",
			...metadata,
		});
	} catch (error) {
		console.error(
			`Failed to get piece auth metadata for "${pieceName}":`,
			error,
		);
		return NextResponse.json(
			{
				error: `Failed to get piece auth metadata: ${
					error instanceof Error ? error.message : String(error)
				}`,
			},
			{ status: 500 },
		);
	}
}
