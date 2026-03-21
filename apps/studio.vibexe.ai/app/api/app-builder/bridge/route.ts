import { getVisualEditBridgeScript } from "@/app/(main)/app-builder/lib/visual-edit-bridge";

export const dynamic = "force-dynamic";

export function GET() {
	return new Response(getVisualEditBridgeScript(), {
		headers: {
			"Content-Type": "application/javascript",
			"Cache-Control": "no-cache",
		},
	});
}
