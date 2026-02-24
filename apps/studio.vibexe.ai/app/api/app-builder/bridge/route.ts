import { getVisualEditBridgeScript } from "@/app/(main)/app-builder/lib/visual-edit-bridge";

export function GET() {
	return new Response(getVisualEditBridgeScript(), {
		headers: {
			"Content-Type": "application/javascript",
			"Cache-Control": "public, max-age=3600",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
