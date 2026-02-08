/**
 * Built-in piece implementations.
 *
 * These provide direct API calls for popular integrations without
 * needing to install @activepieces/piece-* npm packages.
 * Falls back to the generic Activepieces loader for unhandled pieces.
 */

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&#x27;/g, "'")
		.replace(/&#x2F;/g, "/")
		.replace(/&apos;/g, "'");
}

function extractVideoId(url: string): string | null {
	const patterns = [
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
		/^([a-zA-Z0-9_-]{11})$/,
	];
	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match) return match[1];
	}
	return null;
}

async function fetchTranscript(videoId: string): Promise<string> {
	try {
		const response = await fetch(
			`https://www.youtube.com/watch?v=${videoId}`,
			{
				headers: {
					"Accept-Language": "en-US,en;q=0.9",
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				},
			},
		);
		const html = await response.text();

		const match = html.match(/"captionTracks":\s*(\[.*?\])/);
		if (!match) return "";

		const tracks = JSON.parse(match[1]) as Array<{
			languageCode: string;
			baseUrl: string;
		}>;
		const track =
			tracks.find((t) => t.languageCode === "en") || tracks[0];
		if (!track?.baseUrl) return "";

		const captionResponse = await fetch(track.baseUrl);
		const xml = await captionResponse.text();

		const textMatches = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs)];
		if (textMatches.length === 0) return "";

		return textMatches
			.map((m) => decodeHtmlEntities(m[1].replace(/\n/g, " ").trim()))
			.filter(Boolean)
			.join(" ")
			.trim();
	} catch {
		return "";
	}
}

function parseDuration(iso: string): string {
	const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
	if (!match) return iso;
	const h = match[1] ? `${match[1]}:` : "";
	const m = match[2] || "0";
	const s = match[3] || "0";
	return `${h}${h ? m.padStart(2, "0") : m}:${s.padStart(2, "0")}`;
}

// ─── YouTube Actions ────────────────────────────────

async function youtubeFetchVideoInfo(
	properties: Record<string, unknown>,
	auth: unknown,
): Promise<unknown> {
	// Find the connected input value - could arrive under any accessor name
	// (e.g. "input", "start", "url", etc. depending on how the workflow builder named the port)
	const knownConfigKeys = new Set(["apiKey", "videoUrl"]);
	const connectedInput = Object.entries(properties).find(
		([key, val]) =>
			!knownConfigKeys.has(key) &&
			typeof val === "string" &&
			val.trim().length > 0,
	)?.[1] as string | undefined;

	// Prefer connected input over static videoUrl config
	const videoUrl = connectedInput || (properties.videoUrl as string) || "";
	const apiKey =
		(properties.apiKey as string) ||
		(auth && typeof auth === "object" && "apiKey" in auth
			? (auth as { apiKey: string }).apiKey
			: "");

	if (!videoUrl) {
		throw new Error(
			"Missing videoUrl. Set it in the integration node configuration.",
		);
	}
	if (!apiKey) {
		throw new Error(
			"Missing apiKey. Store a YouTube credential or add apiKey to configuration.",
		);
	}

	const videoId = extractVideoId(videoUrl);
	if (!videoId) {
		throw new Error(`Invalid YouTube URL: ${videoUrl}`);
	}

	const apiUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
	apiUrl.searchParams.set("part", "snippet,statistics,contentDetails");
	apiUrl.searchParams.set("id", videoId);
	apiUrl.searchParams.set("key", apiKey);

	const response = await fetch(apiUrl.toString());
	const data = (await response.json()) as {
		error?: { message: string };
		items?: Array<{
			snippet: {
				title: string;
				description: string;
				channelTitle: string;
				publishedAt: string;
				tags?: string[];
				thumbnails: Record<
					string,
					{ url: string; width: number; height: number }
				>;
			};
			statistics: {
				viewCount: string;
				likeCount: string;
				commentCount: string;
			};
			contentDetails: {
				duration: string;
				definition: string;
				caption: string;
			};
		}>;
	};

	if (!response.ok) {
		throw new Error(
			`YouTube API error: ${data.error?.message || response.statusText}`,
		);
	}

	if (!data.items?.length) {
		throw new Error(`Video not found: ${videoId}`);
	}

	const video = data.items[0];
	const { snippet, statistics, contentDetails } = video;

	// Try to fetch transcript
	const transcript = await fetchTranscript(videoId);

	const thumbnail =
		snippet.thumbnails.maxres?.url ||
		snippet.thumbnails.high?.url ||
		snippet.thumbnails.medium?.url ||
		"";

	return [
		`Title: ${snippet.title}`,
		`Channel: ${snippet.channelTitle}`,
		`Published: ${snippet.publishedAt}`,
		`Duration: ${parseDuration(contentDetails.duration)}`,
		`Views: ${Number(statistics.viewCount).toLocaleString()}`,
		`Likes: ${Number(statistics.likeCount).toLocaleString()}`,
		`Comments: ${Number(statistics.commentCount).toLocaleString()}`,
		`Thumbnail: ${thumbnail}`,
		`Tags: ${(snippet.tags || []).join(", ") || "none"}`,
		``,
		`Description:`,
		snippet.description,
		...(transcript
			? [``, `Transcript:`, transcript.substring(0, 5000)]
			: []),
	].join("\n");
}

// ─── Registry ───────────────────────────────────────

type BuiltInAction = (
	properties: Record<string, unknown>,
	auth: unknown,
) => Promise<unknown>;

const BUILT_IN_ACTIONS: Record<string, Record<string, BuiltInAction>> = {
	youtube: {
		"fetch-video-info": youtubeFetchVideoInfo,
	},
};

/**
 * Try to execute a piece action using a built-in implementation.
 * Returns undefined if no built-in handler exists for the piece/action.
 */
export async function tryBuiltInExecution(args: {
	pieceName: string;
	actionName: string;
	properties: Record<string, unknown>;
	auth: unknown;
}): Promise<{ result: unknown } | undefined> {
	const pieceActions = BUILT_IN_ACTIONS[args.pieceName];
	if (!pieceActions) return undefined;

	const action = pieceActions[args.actionName];
	if (!action) return undefined;

	const result = await action(args.properties, args.auth);
	return { result };
}
