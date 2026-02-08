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
		const { inspectPiece } = await import(
			"@giselles-ai/activepieces-adapter/server"
		);
		const info = await inspectPiece(pieceName);
		return NextResponse.json(info);
	} catch (error) {
		console.error(`Failed to inspect piece "${pieceName}":`, error);
		return NextResponse.json(
			{
				error: `Failed to inspect piece "${pieceName}": ${
					error instanceof Error ? error.message : String(error)
				}`,
			},
			{ status: 404 },
		);
	}
}
