import { NextResponse } from "next/server";

/**
 * POST /api/integrations/pieces/:pieceName/properties
 *
 * Resolves dynamic dropdown options for a specific property at runtime.
 * Used when a property has dynamic options that depend on auth credentials
 * and/or current field values.
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ pieceName: string }> },
) {
	const { pieceName } = await params;

	if (!pieceName || typeof pieceName !== "string") {
		return NextResponse.json(
			{ error: "pieceName parameter is required" },
			{ status: 400 },
		);
	}

	let body: {
		actionName: string;
		propertyName: string;
		credentialId?: string;
		currentValues?: Record<string, unknown>;
	};

	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Invalid JSON body" },
			{ status: 400 },
		);
	}

	const { actionName, propertyName, currentValues } = body;

	if (!actionName || !propertyName) {
		return NextResponse.json(
			{ error: "actionName and propertyName are required" },
			{ status: 400 },
		);
	}

	try {
		const { resolveDynamicOptions } = await import(
			"@giselles-ai/activepieces-adapter/server"
		);

		// For now, pass null auth — credential resolution requires team context
		// which would need to be added via the giselle engine context
		const result = await resolveDynamicOptions(
			pieceName,
			actionName,
			propertyName,
			null, // auth — would need credential resolution for real dynamic options
			currentValues ?? {},
		);

		return NextResponse.json(result);
	} catch (error) {
		console.error(
			`Failed to resolve dynamic options for "${pieceName}/${actionName}/${propertyName}":`,
			error,
		);
		return NextResponse.json(
			{
				error: `Failed to resolve options: ${
					error instanceof Error ? error.message : String(error)
				}`,
				options: [],
			},
			{ status: 200 }, // Return 200 with empty options so UI handles gracefully
		);
	}
}
