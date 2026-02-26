import type { NextRequest } from "next/server";
import {
	loadPiece,
	getPieceMetadata,
} from "@vibexe-ai/activepieces-adapter/server";
import { isInstalledPiece, INSTALLED_CATALOG } from "@vibexe-ai/activepieces-adapter";

/**
 * GET /api/integrations/triggers
 *
 * List all installed Activepieces pieces that have trigger definitions.
 * Returns piece name, display name, and available triggers.
 *
 * Query params:
 * - piece: (optional) filter by specific piece name
 */
export async function GET(request: NextRequest) {
	const pieceName = request.nextUrl.searchParams.get("piece");

	try {
		if (pieceName) {
			// Return triggers for a specific piece
			if (!isInstalledPiece(pieceName)) {
				return Response.json(
					{ error: `Piece "${pieceName}" is not installed` },
					{ status: 404 },
				);
			}

			const piece = await loadPiece(pieceName);
			const metadata = getPieceMetadata(piece);
			if (!metadata) {
				return Response.json(
					{ error: `Could not load metadata for piece "${pieceName}"` },
					{ status: 500 },
				);
			}

			return Response.json({
				piece: pieceName,
				displayName: metadata.displayName,
				triggers: Object.values(metadata.triggers),
			});
		}

		// Return all pieces that have triggers
		const piecesWithTriggers: Array<{
			piece: string;
			displayName: string;
			triggerCount: number;
			triggers: Array<{ name: string; displayName: string; description: string }>;
		}> = [];

		for (const entry of INSTALLED_CATALOG) {
			try {
				const piece = await loadPiece(entry.name);
				const metadata = getPieceMetadata(piece);
				if (metadata && Object.keys(metadata.triggers).length > 0) {
					piecesWithTriggers.push({
						piece: entry.name,
						displayName: metadata.displayName,
						triggerCount: Object.keys(metadata.triggers).length,
						triggers: Object.values(metadata.triggers),
					});
				}
			} catch {
				// Skip pieces that fail to load
			}
		}

		return Response.json({
			total: piecesWithTriggers.length,
			pieces: piecesWithTriggers,
		});
	} catch (error) {
		console.error("[Triggers API] Error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
