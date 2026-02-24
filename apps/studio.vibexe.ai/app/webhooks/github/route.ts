import {
	GitHubWebhookUnauthorizedError,
	verifyRequest,
} from "@vibexe-ai/github-tool";
import { after } from "next/server";
import { vibexe, githubWebhookCallbacks } from "@/app/vibexe";

export const maxDuration = 800;

export async function POST(request: Request) {
	try {
		await verifyRequest({
			secret:
				vibexe.getContext().integrationConfigs?.github?.authV2.webhookSecret ??
				"",
			request,
		});
	} catch (e) {
		if (GitHubWebhookUnauthorizedError.isInstance(e)) {
			return new Response("Unauthorized", { status: 401 });
		}
		return new Response("Internal Server Error", { status: 500 });
	}

	after(() =>
		vibexe.handleGitHubWebhookV2({
			request,
			...githubWebhookCallbacks,
		}),
	);

	return new Response("Accepted", { status: 202 });
}
