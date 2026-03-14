import { getWorldBuilderBridgeScript } from "@/app/(main)/app-builder/lib/world-builder-bridge";

export function GET() {
	return new Response(getWorldBuilderBridgeScript(), {
		headers: {
			"Content-Type": "application/javascript",
			"Cache-Control": "public, max-age=3600",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
