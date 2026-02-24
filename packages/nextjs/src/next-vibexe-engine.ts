import {
	GenerationId,
	Vibexe,
	type VibexeConfig,
	type VibexeContext,
} from "@vibexe-ai/vibexe";
import {
	GitHubWebhookUnauthorizedError,
	verifyRequest as verifyRequestAsGitHubWebook,
} from "@vibexe-ai/github-tool";
import {
	formDataRoutes,
	isFormDataRoutePath,
	isJsonRoutePath,
	jsonRoutes,
} from "@vibexe-ai/http";
import { after } from "next/server";
import { ZodError } from "zod";
import { type RequestContext, requestContextStore } from "./context";

interface NextVibexeConfig extends Omit<VibexeConfig, "waitUntil"> {
	basePath: string;
	useAfterFunction?: boolean;
	onRequest?: (args: {
		request: Request;
		context: VibexeContext;
		updateContext: (updates: Partial<VibexeContext>) => void;
	}) => void | Promise<void>;
}

async function getBody(
	req: Request,
): Promise<Record<string, unknown> | undefined> {
	if (!("body" in req) || !req.body || req.method !== "POST") return;

	const contentType = req.headers.get("content-type");
	if (contentType?.includes("application/json")) {
		const text = await req.text();
		if (text.length === 0) return;
		return JSON.parse(text);
	}
	if (contentType?.includes("application/x-www-form-urlencoded")) {
		const params = new URLSearchParams(await req.text());
		return Object.fromEntries(params);
	}
	if (contentType?.includes("multipart/form-data")) {
		const formData = await req.formData();
		const data = Object.fromEntries(formData.entries());
		return data;
	}
}

export function createHttpHandler({
	vibexe,
	config,
}: {
	vibexe: Vibexe;
	config: NextVibexeConfig;
}) {
	return async function httpHandler(request: Request) {
		// Update context per request if onRequest is provided
		// This must be done BEFORE requestContextStore.run to ensure context
		// is updated before any workspace operations
		if (config.onRequest) {
			await config.onRequest({
				request,
				context: vibexe.getContext(),
				updateContext: (updates) => vibexe.updateContext(updates),
			});
		}

		let ctx: RequestContext | undefined;
		// Vercel sets the system env var `VERCEL` to "1" on all deployments
		// (builds/functions). This is the supported way to detect Vercel runtime.
		// Ref: Vercel Docs → System Environment Variables: VERCEL
		// https://vercel.com/docs/projects/environment-variables/system-environment-variables
		if (process.env.VERCEL === "1") {
			ctx = {
				// When on Vercel, `x-vercel-id` header can be used as a request correlation ID.
				// Ref: Vercel Docs → Request headers: x-vercel-id
				// https://vercel.com/docs/headers/request-headers#x-vercel-id
				requestId: request.headers.get("x-vercel-id") ?? undefined,
			};
		}
		return await requestContextStore.run(ctx, async () => {
			const url = new URL(request.url);
			const pathname = url.pathname;

			// Check if pathname matches /generations/{generationId}/generated-images/{filename}
			const generatedImageMatch = pathname.match(
				new RegExp(
					`^${config.basePath}/generations/([^/]+)/generated-images/([^/]+)$`,
				),
			);
			if (generatedImageMatch) {
				const generationId = generatedImageMatch[1];
				const filename = generatedImageMatch[2];
				const file = await vibexe.getGeneratedImage(
					GenerationId.parse(generationId),
					filename,
				);
				return new Response(file, {
					headers: {
						"Content-Type": file.type,
						"Content-Disposition": `inline; filename="${file.name}"`,
					},
				});
			}

			// Human review: approve/reject a generation awaiting review
			const reviewMatch = pathname.match(
				new RegExp(
					`^${config.basePath}/generations/([^/]+)/review$`,
				),
			);
			if (reviewMatch && request.method === "POST") {
				const generationId = reviewMatch[1];
				const body = await getBody(request);
				const action = body?.action as string | undefined;

				try {
					if (action === "approve") {
						await vibexe.approveReview(generationId);
						return new Response(JSON.stringify({ ok: true }), {
							status: 200,
							headers: { "Content-Type": "application/json" },
						});
					}
					if (action === "reject") {
						await vibexe.rejectReview(
							generationId,
							(body?.reason as string) ?? "Rejected by user",
						);
						return new Response(JSON.stringify({ ok: true }), {
							status: 200,
							headers: { "Content-Type": "application/json" },
						});
					}
					return new Response("Invalid action", { status: 400 });
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					return new Response(
						JSON.stringify({ error: msg }),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			}

			const a = url.pathname.match(new RegExp(`^${config.basePath}(.+)`));

			const segmentString = a?.at(-1);
			if (segmentString == null)
				throw new Error(`Cannot parse action at ${pathname}`);
			const segments = segmentString
				.replace(/^\//, "")
				.split("/")
				.filter(Boolean);

			if (segments.length !== 1) {
				throw new Error(`Invalid action at ${pathname}`);
			}

			const [routerPath] = segments;

			if (config.useAfterFunction) {
				if (config.telemetry?.isEnabled && config.telemetry?.waitForFlushFn) {
					after(config.telemetry.waitForFlushFn);
				}

				// Flush generation index patches after response
				after(async () => {
					await vibexe.flushGenerationIndexQueue();
				});
			}

			if (isJsonRoutePath(routerPath)) {
				try {
					return await jsonRoutes[routerPath](vibexe)({
						// @ts-expect-error
						input: await getBody(request),
						signal: request.signal,
					});
				} catch (e) {
					if (e instanceof ZodError) {
						// @todo replace logger
						console.log(e.message);
						return new Response("Invalid request body", { status: 400 });
					}
					console.log(e);
					return new Response("Internal Server Error", { status: 500 });
				}
			}
			if (isFormDataRoutePath(routerPath)) {
				return await formDataRoutes[routerPath](vibexe)({
					// @ts-expect-error
					input: await getBody(request),
				});
			}
			/** Handle GitHub webhooks with Vibexe */
			if (routerPath === "github-webhook") {
				try {
					await verifyRequestAsGitHubWebook({
						secret:
							config.integrationConfigs?.github?.authV2.webhookSecret ?? "",
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
						onGenerationComplete: config.callbacks?.generationComplete,
						onGenerationError: config.callbacks?.generationError,
						onTaskCreate: config.callbacks?.taskCreate,
					}),
				);
				return new Response("Accepted", { status: 202 });
			}
			throw new Error(`Invalid router path at ${pathname}`);
		});
	};
}

/**
 * Self-hosted waitUntil: directly invokes callbacks as fire-and-forget.
 * Next.js `after()` may not execute callbacks in Server Action contexts
 * on non-Vercel hosts. This ensures async work actually runs.
 */
function selfHostedWaitUntil(task: Promise<unknown> | (() => unknown | Promise<unknown>)): void {
	if (typeof task === "function") {
		Promise.resolve().then(() => task()).catch((err) => {
			console.error("[waitUntil] callback error:", err);
		});
	} else {
		task.catch((err: unknown) => {
			console.error("[waitUntil] promise error:", err);
		});
	}
}

export function NextVibexe(config: NextVibexeConfig) {
	const isVercel = process.env.VERCEL === "1";
	const waitUntil = isVercel ? after : selfHostedWaitUntil;
	const vibexe = Vibexe({ ...config, waitUntil });
	const httpHandler = createHttpHandler({
		vibexe,
		config,
	});
	return {
		...vibexe,
		handlers: {
			GET: httpHandler,
			POST: httpHandler,
		},
	};
}
