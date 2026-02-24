import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getProviderKeys } from "@/lib/ai-provider-keys";
import { SystemClient } from "./system-client";

const ENV_VARS = [
	"POSTGRES_URL",
	"COOKIE_SECRET",
	"TOKEN_ENCRYPTION_KEY",
	"NEXT_PUBLIC_SITE_URL",
	"GITHUB_CLIENT_ID",
	"GITHUB_CLIENT_SECRET",
	"GITHUB_APP_CLIENT_ID",
	"GITHUB_APP_CLIENT_SECRET",
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"ADMIN_EMAIL",
	"OPENAI_API_KEY",
	"ANTHROPIC_API_KEY",
	"GOOGLE_GENERATIVE_AI_API_KEY",
	"XAI_API_KEY",
	"NVIDIA_API_KEY",
	"PERPLEXITY_API_KEY",
	"SMTP_HOST",
	"S3_STORAGE_BUCKET",
	"S3_STORAGE_ENDPOINT",
	"S3_STORAGE_ACCESS_KEY_ID",
	"S3_STORAGE_SECRET_ACCESS_KEY",
	"STRIPE_SECRET_KEY",
	"CRON_SECRET",
] as const;

const FEATURE_FLAGS = [
	"DEVELOPER_FLAG",
	"STAGE_V2_FLAG",
	"DATA_STORE_FLAG",
] as const;

export default async function SystemPage() {
	const envStatus = ENV_VARS.map((name) => ({
		name,
		isSet: !!process.env[name],
	}));

	const flagStatus = FEATURE_FLAGS.map((name) => ({
		name,
		value: process.env[name] ?? "unset",
	}));

	let dbHealthy = false;
	try {
		await db.execute(sql`SELECT 1`);
		dbHealthy = true;
	} catch {
		dbHealthy = false;
	}

	let tableSizes: { name: string; rows: number }[] = [];
	try {
		const result = await db.execute(
			sql`SELECT relname, n_live_tup::int as row_count FROM pg_stat_user_tables ORDER BY n_live_tup DESC`,
		);
		tableSizes = (result.rows as { relname: string; row_count: number }[]).map(
			(r) => ({
				name: r.relname,
				rows: r.row_count,
			}),
		);
	} catch {
		// ignore
	}

	const providerKeys = await getProviderKeys();
	const providers = providerKeys.map((k) => ({
		provider: k.provider,
		isActive: k.isActive,
		errorReason: k.errorReason ?? null,
	}));

	const mem = process.memoryUsage();
	const runtime = {
		nodeVersion: process.version,
		uptimeSeconds: Math.floor(process.uptime()),
		heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
		heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
		rssMB: Math.round(mem.rss / 1024 / 1024),
	};

	return (
		<SystemClient
			envStatus={envStatus}
			flagStatus={flagStatus}
			dbHealthy={dbHealthy}
			tableSizes={tableSizes}
			providers={providers}
			runtime={runtime}
		/>
	);
}
