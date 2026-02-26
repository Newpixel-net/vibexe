/**
 * App Store Analyzer — Server-side App Store / Google Play listing scraper.
 * Fetches listing pages, extracts app metadata (name, description, screenshots,
 * features, rating), and formats for prompt injection so the mobile agent can
 * clone the app.
 */

export interface AppStoreAnalysis {
	platform: "ios" | "android";
	appName: string;
	developer: string;
	description: string;
	category: string;
	rating: string;
	screenshotUrls: string[];
	features: string[];
	url: string;
}

const CHROME_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Check if a URL points to an Apple App Store or Google Play listing.
 */
export function isAppStoreUrl(url: string): boolean {
	return /apps\.apple\.com/i.test(url) || /play\.google\.com\/store\/apps/i.test(url);
}

/**
 * Fetch an App Store or Google Play listing and extract structured metadata.
 * Returns null on failure (graceful, same pattern as analyzeUrl).
 */
export async function analyzeAppStoreUrl(
	url: string,
): Promise<AppStoreAnalysis | null> {
	try {
		const response = await fetch(url, {
			headers: { "User-Agent": CHROME_UA },
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) return null;

		const html = await response.text();
		const isApple = /apps\.apple\.com/i.test(url);

		if (isApple) {
			return parseAppleListing(html, url);
		}
		return parseGooglePlayListing(html, url);
	} catch (error) {
		console.error("[App Store Analyzer] Failed to analyze:", url, error);
		return null;
	}
}

// ─── Apple App Store Parser ──────────────────────────────────────

function parseAppleListing(
	html: string,
	url: string,
): AppStoreAnalysis | null {
	// Try structured data (JSON-LD) first — most reliable
	const jsonLdMatch = html.match(
		/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
	);

	let appName = "";
	let developer = "";
	let description = "";
	let category = "";
	let rating = "";

	if (jsonLdMatch) {
		try {
			const ld = JSON.parse(jsonLdMatch[1]);
			appName = ld.name || "";
			developer = ld.author?.name || "";
			description = ld.description || "";
			category = ld.applicationCategory || "";
			if (ld.aggregateRating) {
				rating = `${ld.aggregateRating.ratingValue}/5 (${ld.aggregateRating.ratingCount} ratings)`;
			}
		} catch {
			// Fall through to meta tag parsing
		}
	}

	// Fallback to meta tags
	if (!appName) appName = extractMeta(html, "og:title") || extractTitle(html) || "";
	if (!description) description = extractMeta(html, "og:description") || extractMeta(html, "description") || "";

	// Extract screenshot URLs from <picture> source sets or <img> tags in screenshot sections
	const screenshotUrls = extractAppleScreenshots(html);

	// Extract features from description
	const features = extractFeatures(description);

	if (!appName) return null;

	return {
		platform: "ios",
		appName,
		developer,
		description,
		category,
		rating,
		screenshotUrls: screenshotUrls.slice(0, 5),
		features,
		url,
	};
}

function extractAppleScreenshots(html: string): string[] {
	const urls: string[] = [];
	const seen = new Set<string>();

	// Apple uses <picture> with <source srcset> for screenshots
	const sourceRegex =
		/<source[^>]+srcset=["']([^"']+)["'][^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = sourceRegex.exec(html)) !== null) {
		const srcset = match[1];
		// Pick the largest image from srcset
		const candidates = srcset.split(",").map((s) => s.trim().split(/\s+/));
		const best = candidates[candidates.length - 1];
		if (best && best[0] && isScreenshotUrl(best[0])) {
			const u = best[0];
			if (!seen.has(u)) {
				seen.add(u);
				urls.push(u);
			}
		}
	}

	// Fallback: look for img tags with screenshot-like URLs
	if (urls.length === 0) {
		const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
		while ((match = imgRegex.exec(html)) !== null) {
			const src = match[1];
			if (isScreenshotUrl(src) && !seen.has(src)) {
				seen.add(src);
				urls.push(src);
			}
		}
	}

	return urls;
}

function isScreenshotUrl(url: string): boolean {
	// Apple screenshot URLs typically contain these patterns
	return (
		/is\d+-ssl\.mzstatic\.com/i.test(url) ||
		/screenshot/i.test(url) ||
		(/\d{3,4}x\d{3,4}/.test(url) && /\.(png|jpg|jpeg|webp)/i.test(url))
	);
}

// ─── Google Play Parser ──────────────────────────────────────────

function parseGooglePlayListing(
	html: string,
	url: string,
): AppStoreAnalysis | null {
	const appName =
		extractMeta(html, "og:title") || extractTitle(html) || "";
	const description =
		extractMeta(html, "og:description") ||
		extractMeta(html, "description") ||
		"";

	// Google Play: developer from structured data or page content
	let developer = "";
	const devMatch = html.match(
		/itemprop=["']author["'][^>]*>[\s\S]*?<span[^>]*>([^<]+)</i,
	);
	if (devMatch) developer = devMatch[1].trim();
	if (!developer) {
		const devMeta = html.match(
			/<a[^>]+href=["']\/store\/apps\/dev[^"']*["'][^>]*>([^<]+)</i,
		);
		if (devMeta) developer = devMeta[1].trim();
	}

	// Category from structured data
	let category = "";
	const catMatch = html.match(
		/itemprop=["']genre["'][^>]*>([^<]+)/i,
	);
	if (catMatch) category = catMatch[1].trim();
	if (!category) {
		const catMeta = html.match(
			/<a[^>]+href=["']\/store\/apps\/category\/[^"']*["'][^>]*>([^<]+)</i,
		);
		if (catMeta) category = catMeta[1].trim();
	}

	// Rating
	let rating = "";
	const ratingMatch = html.match(
		/itemprop=["']ratingValue["'][^>]*content=["']([^"']+)["']/i,
	);
	if (ratingMatch) {
		const countMatch = html.match(
			/itemprop=["']ratingCount["'][^>]*content=["']([^"']+)["']/i,
		);
		rating = `${ratingMatch[1]}/5${countMatch ? ` (${countMatch[1]} ratings)` : ""}`;
	}

	// Screenshots from og:image and additional image tags
	const screenshotUrls = extractGooglePlayScreenshots(html);

	const features = extractFeatures(description);

	if (!appName) return null;

	return {
		platform: "android",
		appName,
		developer,
		description,
		category,
		rating,
		screenshotUrls: screenshotUrls.slice(0, 5),
		features,
		url,
	};
}

function extractGooglePlayScreenshots(html: string): string[] {
	const urls: string[] = [];
	const seen = new Set<string>();

	// Google Play screenshots are in img tags with play-lh.googleusercontent.com
	const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = imgRegex.exec(html)) !== null) {
		const src = match[1];
		if (
			/play-lh\.googleusercontent\.com/i.test(src) &&
			!seen.has(src)
		) {
			seen.add(src);
			urls.push(src);
		}
	}

	// Also check srcset attributes
	const srcsetRegex = /srcset=["']([^"']+)["']/gi;
	while ((match = srcsetRegex.exec(html)) !== null) {
		const candidates = match[1].split(",").map((s) => s.trim().split(/\s+/));
		for (const [u] of candidates) {
			if (
				u &&
				/play-lh\.googleusercontent\.com/i.test(u) &&
				!seen.has(u)
			) {
				seen.add(u);
				urls.push(u);
			}
		}
	}

	// Fallback: og:image
	const ogImage = html.match(
		/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
	);
	if (ogImage && !seen.has(ogImage[1])) {
		urls.unshift(ogImage[1]);
	}

	return urls;
}

// ─── Shared Helpers ──────────────────────────────────────────────

function extractTitle(html: string): string | null {
	const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
	return match ? match[1].trim() : null;
}

function extractMeta(html: string, name: string): string | null {
	const patterns = [
		new RegExp(
			`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`,
			"i",
		),
		new RegExp(
			`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
			"i",
		),
	];
	for (const pattern of patterns) {
		const match = html.match(pattern);
		if (match) return match[1];
	}
	return null;
}

/**
 * Extract feature bullet points from app description text.
 * Looks for list patterns, sentence starters, and key phrases.
 */
function extractFeatures(description: string): string[] {
	const features: string[] = [];
	if (!description) return features;

	// Split on common list delimiters
	const lines = description.split(/[•\-\n\r]+/).map((l) => l.trim()).filter(Boolean);

	for (const line of lines) {
		// Keep lines that look like feature descriptions (5-200 chars, starts with capital or emoji)
		if (line.length >= 5 && line.length <= 200) {
			// Skip generic marketing fluff
			if (
				/^(download|install|update|version|copyright|privacy|terms)/i.test(
					line,
				)
			)
				continue;
			features.push(line);
		}
	}

	return features.slice(0, 15);
}

// ─── Format for Prompt Injection ─────────────────────────────────

/**
 * Format AppStoreAnalysis into a markdown string for injection into the AI prompt.
 */
export function formatAppStoreAnalysis(analysis: AppStoreAnalysis): string {
	const sections: string[] = [];

	sections.push(
		`## App Store Listing Analysis: ${analysis.appName} (${analysis.platform === "ios" ? "iOS" : "Android"})`,
	);
	sections.push(`**URL**: ${analysis.url}`);
	if (analysis.developer) sections.push(`**Developer**: ${analysis.developer}`);
	if (analysis.category) sections.push(`**Category**: ${analysis.category}`);
	if (analysis.rating) sections.push(`**Rating**: ${analysis.rating}`);

	if (analysis.description) {
		sections.push(`\n### App Description`);
		sections.push(analysis.description.slice(0, 2000));
	}

	if (analysis.features.length > 0) {
		sections.push(`\n### Key Features`);
		for (const feature of analysis.features) {
			sections.push(`- ${feature}`);
		}
	}

	if (analysis.screenshotUrls.length > 0) {
		sections.push(`\n### Screenshots (${analysis.screenshotUrls.length} captured)`);
		sections.push(
			"Use these as visual reference for the app's design language, color scheme, and layout patterns:",
		);
		for (let i = 0; i < analysis.screenshotUrls.length; i++) {
			sections.push(`- Screenshot ${i + 1}: ${analysis.screenshotUrls[i]}`);
		}
	}

	sections.push(`\n### Replication Instructions`);
	sections.push(
		`Build a mobile PWA that replicates this app's functionality and visual design:`,
	);
	sections.push(`- Match the app's feature set as closely as possible`);
	sections.push(`- Recreate the visual design from the screenshots (colors, layout, typography)`);
	sections.push(`- Use the description and features list to understand all capabilities`);
	sections.push(`- Implement as a React + TypeScript + Tailwind mobile-first PWA`);

	return sections.join("\n");
}
