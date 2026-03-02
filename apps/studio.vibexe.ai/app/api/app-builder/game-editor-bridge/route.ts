import { getGameEditorBridgeScript } from "@/app/(main)/app-builder/lib/game-editor-bridge";

export function GET() {
	return new Response(getGameEditorBridgeScript(), {
		headers: {
			"Content-Type": "application/javascript",
			"Cache-Control": "public, max-age=3600",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
