/**
 * Dashboard Data Layer
 *
 * Single async function that fetches all data needed for the main dashboard.
 * All queries run in parallel via Promise.all for minimum latency.
 *
 * Expected wall-clock time: ~50-100ms (all queries parallelized, each indexed).
 */

import { and, count, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	builderApps,
	builderDeployments,
	builderAppDatabases,
	builderAppAuthSettings,
	builderAppTemplates,
	builderAppFunctions,
	builderAppStorageSettings,
	workspaces,
	teams,
	users,
	teamMemberships,
} from "@/db/schema";

// ====================================================================
// TYPE DEFINITIONS
// ====================================================================

export interface DashboardStats {
	totalApps: number;
	totalWorkflows: number;
	liveDeployments: number;
	totalEntities: number;
}

export interface EnhancedApp {
	id: string;
	name: string;
	description: string | null;
	updatedAt: string; // ISO string for serialization across RSC boundary
	createdAt: string;
	/** Deployment info, null if never deployed */
	deployment: {
		status: string;
		subdomain: string | null;
		deployedAt: string | null;
	} | null;
	/** Number of data entities defined in the app schema */
	entityCount: number;
	/** Whether the app has auth settings configured */
	hasAuth: boolean;
	/** Number of serverless functions attached */
	functionCount: number;
}

export interface RecentWorkflow {
	id: string;
	name: string | null;
	updatedAt: string;
	createdAt: string;
}

export interface ActivityItem {
	type: "app_created" | "app_deployed" | "workflow_created";
	title: string;
	timestamp: string; // ISO string
	metadata: Record<string, unknown>;
}

export interface SuggestedTemplate {
	id: string;
	name: string;
	description: string | null;
	category: string;
	tags: string[];
	useCount: number;
	entityCount: number;
	fileCount: number;
	thumbnailUrl: string | null;
}

export interface ManageableApp {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	deployment: { status: string; subdomain: string | null; deployedAt: string | null } | null;
	entityCount: number;
	functionCount: number;
	usedStorageBytes: number;
	storageQuotaMb: number;
	shareToken: string | null;
}

export interface StorageStats {
	totalUsedBytes: number;
	totalQuotaMb: number;
}

export interface DashboardUser {
	displayName: string;
}

export interface DashboardTeam {
	name: string;
	plan: string;
}

export interface DashboardData {
	user: DashboardUser;
	team: DashboardTeam;
	stats: DashboardStats;
	recentApps: EnhancedApp[];
	recentWorkflows: RecentWorkflow[];
	activity: ActivityItem[];
	suggestedTemplates: SuggestedTemplate[];
	allApps: ManageableApp[];
	storageStats: StorageStats;
}

// ====================================================================
// STATS QUERIES
// ====================================================================

/**
 * Fetch all four dashboard stat numbers in a single Promise.all.
 * Each is a simple COUNT or SUM — all indexed on teamDbId.
 */
async function fetchStats(teamDbId: number): Promise<DashboardStats> {
	const [totalAppsResult, totalWorkflowsResult, liveDeploymentsResult, totalEntitiesResult] =
		await Promise.all([
			// 1. Total apps for this team
			db
				.select({ value: count() })
				.from(builderApps)
				.where(eq(builderApps.teamDbId, teamDbId)),

			// 2. Total workflows for this team
			db
				.select({ value: count() })
				.from(workspaces)
				.where(eq(workspaces.teamDbId, teamDbId)),

			// 3. Live deployments (status = 'live') for apps owned by this team
			db
				.select({ value: count() })
				.from(builderDeployments)
				.innerJoin(
					builderApps,
					eq(builderDeployments.appDbId, builderApps.dbId),
				)
				.where(
					and(
						eq(builderApps.teamDbId, teamDbId),
						eq(builderDeployments.status, "live"),
					),
				),

			// 4. Total entities across all app databases for this team.
			//    schemaJson is { version: number, entities: EntityDefinition[] }.
			//    We use jsonb_array_length on the 'entities' array.
			db.execute<{ total: string }>(sql`
				SELECT COALESCE(
					SUM(
						CASE
							WHEN d.schema_json IS NOT NULL
								AND d.schema_json->'entities' IS NOT NULL
								AND jsonb_typeof(d.schema_json->'entities') = 'array'
							THEN jsonb_array_length(d.schema_json->'entities')
							ELSE 0
						END
					), 0
				)::text AS total
				FROM builder_app_databases d
				INNER JOIN builder_apps a ON a.db_id = d.app_db_id
				WHERE a.team_db_id = ${teamDbId}
			`),
		]);

	return {
		totalApps: totalAppsResult[0]?.value ?? 0,
		totalWorkflows: totalWorkflowsResult[0]?.value ?? 0,
		liveDeployments: liveDeploymentsResult[0]?.value ?? 0,
		totalEntities: Number.parseInt(totalEntitiesResult.rows[0]?.total ?? "0", 10),
	};
}

// ====================================================================
// ENHANCED RECENT APPS
// ====================================================================

/**
 * Fetch 6 most recently updated apps with deployment info, entity count,
 * and auth configuration status.
 *
 * Uses a raw SQL query with LEFT JOINs for efficiency (single round trip).
 * The alternative — multiple Drizzle relational queries — would require
 * N+1 sub-queries for entity counts from jsonb.
 */
async function fetchRecentApps(teamDbId: number): Promise<EnhancedApp[]> {
	const result = await db.execute<{
		id: string;
		name: string;
		description: string | null;
		updated_at: string;
		created_at: string;
		deploy_status: string | null;
		deploy_subdomain: string | null;
		deployed_at: string | null;
		entity_count: string;
		has_auth: boolean;
		function_count: string;
	}>(sql`
		SELECT
			a.id,
			a.name,
			a.description,
			a.updated_at,
			a.created_at,
			dep.status       AS deploy_status,
			dep.subdomain    AS deploy_subdomain,
			dep.deployed_at,
			COALESCE(
				CASE
					WHEN d.schema_json IS NOT NULL
						AND d.schema_json->'entities' IS NOT NULL
						AND jsonb_typeof(d.schema_json->'entities') = 'array'
					THEN jsonb_array_length(d.schema_json->'entities')
					ELSE 0
				END, 0
			)::text AS entity_count,
			(auth.db_id IS NOT NULL) AS has_auth,
			COALESCE(fn.cnt, 0)::text AS function_count
		FROM builder_apps a
		LEFT JOIN LATERAL (
			SELECT status, subdomain, deployed_at
			FROM builder_deployments
			WHERE app_db_id = a.db_id
			ORDER BY deployed_at DESC NULLS LAST
			LIMIT 1
		) dep ON true
		LEFT JOIN builder_app_databases d ON d.app_db_id = a.db_id
		LEFT JOIN builder_app_auth_settings auth ON auth.app_db_id = a.db_id
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS cnt
			FROM builder_app_functions
			WHERE app_db_id = a.db_id
		) fn ON true
		WHERE a.team_db_id = ${teamDbId}
		ORDER BY a.updated_at DESC
		LIMIT 6
	`);

	return result.rows.map((row) => ({
		id: row.id,
		name: row.name,
		description: row.description,
		updatedAt: new Date(row.updated_at).toISOString(),
		createdAt: new Date(row.created_at).toISOString(),
		deployment: row.deploy_status
			? {
					status: row.deploy_status,
					subdomain: row.deploy_subdomain,
					deployedAt: row.deployed_at
						? new Date(row.deployed_at).toISOString()
						: null,
				}
			: null,
		entityCount: Number.parseInt(row.entity_count, 10),
		hasAuth: row.has_auth,
		functionCount: Number.parseInt(row.function_count, 10),
	}));
}

// ====================================================================
// RECENT WORKFLOWS
// ====================================================================

async function fetchRecentWorkflows(teamDbId: number): Promise<RecentWorkflow[]> {
	const rows = await db.query.workspaces.findMany({
		where: eq(workspaces.teamDbId, teamDbId),
		orderBy: (w, { desc }) => [desc(w.updatedAt)],
		columns: {
			id: true,
			name: true,
			updatedAt: true,
			createdAt: true,
		},
		limit: 6,
	});

	return rows.map((w) => ({
		id: w.id,
		name: w.name,
		updatedAt: w.updatedAt.toISOString(),
		createdAt: w.createdAt.toISOString(),
	}));
}

// ====================================================================
// ACTIVITY FEED
// ====================================================================

/**
 * Build a unified activity timeline from three event sources using UNION ALL.
 * Each sub-query extracts a typed event with a title and metadata JSON.
 * Results are ordered by timestamp descending, limited to 15 most recent.
 *
 * Performance: Each sub-query hits an indexed column (team_db_id, created_at).
 * The UNION is over small result sets (LIMIT per sub-query not needed since
 * the outer LIMIT handles it and PostgreSQL optimizes well with ORDER BY + LIMIT).
 */
async function fetchActivity(teamDbId: number): Promise<ActivityItem[]> {
	const result = await db.execute<{
		type: string;
		title: string;
		timestamp: string;
		metadata: string; // JSON string
	}>(sql`
		(
			SELECT
				'app_created'::text AS type,
				a.name AS title,
				a.created_at AS timestamp,
				jsonb_build_object(
					'appId', a.id,
					'description', a.description
				)::text AS metadata
			FROM builder_apps a
			WHERE a.team_db_id = ${teamDbId}
			ORDER BY a.created_at DESC
			LIMIT 15
		)
		UNION ALL
		(
			SELECT
				'app_deployed'::text AS type,
				COALESCE(a.name, 'Unknown App') || ' deployed to ' || COALESCE(dep.subdomain, 'custom domain') AS title,
				dep.deployed_at AS timestamp,
				jsonb_build_object(
					'appId', a.id,
					'subdomain', dep.subdomain,
					'status', dep.status
				)::text AS metadata
			FROM builder_deployments dep
			INNER JOIN builder_apps a ON a.db_id = dep.app_db_id
			WHERE a.team_db_id = ${teamDbId}
				AND dep.deployed_at IS NOT NULL
			ORDER BY dep.deployed_at DESC
			LIMIT 15
		)
		UNION ALL
		(
			SELECT
				'workflow_created'::text AS type,
				COALESCE(w.name, 'Untitled Workflow') AS title,
				w.created_at AS timestamp,
				jsonb_build_object(
					'workflowId', w.id
				)::text AS metadata
			FROM workspaces w
			WHERE w.team_db_id = ${teamDbId}
			ORDER BY w.created_at DESC
			LIMIT 15
		)
		ORDER BY timestamp DESC
		LIMIT 15
	`);

	return result.rows
		.filter((row) => row.timestamp !== null)
		.map((row) => ({
			type: row.type as ActivityItem["type"],
			title: row.title,
			timestamp: new Date(row.timestamp).toISOString(),
			metadata: typeof row.metadata === "string"
				? JSON.parse(row.metadata)
				: (row.metadata as Record<string, unknown>),
		}));
}

// ====================================================================
// ALL APPS FOR MANAGEMENT CAROUSEL
// ====================================================================

/**
 * Fetch ALL apps (no limit) with lightweight management data for the
 * Manage Your Apps carousel. Includes deployment info, entity/function
 * counts, and storage usage per app.
 */
async function fetchAllAppsForManagement(teamDbId: number): Promise<ManageableApp[]> {
	const result = await db.execute<{
		id: string;
		name: string;
		description: string | null;
		updated_at: string;
		created_at: string;
		deploy_status: string | null;
		deploy_subdomain: string | null;
		deployed_at: string | null;
		entity_count: string;
		function_count: string;
		used_storage_bytes: string;
		storage_quota_mb: string;
		share_token: string | null;
	}>(sql`
		SELECT
			a.id,
			a.name,
			a.description,
			a.updated_at,
			a.created_at,
			a.share_token,
			dep.status       AS deploy_status,
			dep.subdomain    AS deploy_subdomain,
			dep.deployed_at,
			COALESCE(
				CASE
					WHEN d.schema_json IS NOT NULL
						AND d.schema_json->'entities' IS NOT NULL
						AND jsonb_typeof(d.schema_json->'entities') = 'array'
					THEN jsonb_array_length(d.schema_json->'entities')
					ELSE 0
				END, 0
			)::text AS entity_count,
			COALESCE(fn.cnt, 0)::text AS function_count,
			COALESCE(st.used_storage_bytes, '0') AS used_storage_bytes,
			COALESCE(st.storage_quota_mb, 500)::text AS storage_quota_mb
		FROM builder_apps a
		LEFT JOIN LATERAL (
			SELECT status, subdomain, deployed_at
			FROM builder_deployments
			WHERE app_db_id = a.db_id
			ORDER BY deployed_at DESC NULLS LAST
			LIMIT 1
		) dep ON true
		LEFT JOIN builder_app_databases d ON d.app_db_id = a.db_id
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS cnt
			FROM builder_app_functions
			WHERE app_db_id = a.db_id
		) fn ON true
		LEFT JOIN builder_app_storage_settings st ON st.app_db_id = a.db_id
		WHERE a.team_db_id = ${teamDbId}
		ORDER BY a.updated_at DESC
	`);

	return result.rows.map((row) => ({
		id: row.id,
		name: row.name,
		description: row.description,
		updatedAt: new Date(row.updated_at).toISOString(),
		createdAt: new Date(row.created_at).toISOString(),
		deployment: row.deploy_status
			? {
					status: row.deploy_status,
					subdomain: row.deploy_subdomain,
					deployedAt: row.deployed_at
						? new Date(row.deployed_at).toISOString()
						: null,
				}
			: null,
		entityCount: Number.parseInt(row.entity_count, 10),
		functionCount: Number.parseInt(row.function_count, 10),
		usedStorageBytes: Number.parseInt(row.used_storage_bytes, 10) || 0,
		storageQuotaMb: Number.parseInt(row.storage_quota_mb, 10) || 500,
		shareToken: row.share_token,
	}));
}

// ====================================================================
// TOTAL STORAGE STATS
// ====================================================================

/**
 * Aggregate storage usage across all apps for the Storage stat card.
 */
async function fetchTotalStorage(teamDbId: number): Promise<StorageStats> {
	const result = await db.execute<{
		total_used: string;
		total_quota_mb: string;
	}>(sql`
		SELECT
			COALESCE(SUM(CAST(st.used_storage_bytes AS bigint)), 0)::text AS total_used,
			COALESCE(SUM(st.storage_quota_mb), 0)::text AS total_quota_mb
		FROM builder_app_storage_settings st
		INNER JOIN builder_apps a ON a.db_id = st.app_db_id
		WHERE a.team_db_id = ${teamDbId}
	`);

	return {
		totalUsedBytes: Number.parseInt(result.rows[0]?.total_used ?? "0", 10),
		totalQuotaMb: Number.parseInt(result.rows[0]?.total_quota_mb ?? "0", 10),
	};
}

// ====================================================================
// TEMPLATE SUGGESTIONS
// ====================================================================

/**
 * Fetch the 5 most popular public templates.
 *
 * Note: We do not filter out "already cloned" templates because the
 * builderApps table does not store a `clonedFromTemplateId` column.
 * A future enhancement could add that column to enable "don't show
 * templates the user already cloned" filtering.
 */
async function fetchSuggestedTemplates(): Promise<SuggestedTemplate[]> {
	const rows = await db.query.builderAppTemplates.findMany({
		where: and(
			eq(builderAppTemplates.visibility, "public"),
			eq(builderAppTemplates.status, "active"),
		),
		orderBy: [desc(builderAppTemplates.useCount)],
		columns: {
			id: true,
			name: true,
			description: true,
			category: true,
			tags: true,
			useCount: true,
			entityCount: true,
			fileCount: true,
			thumbnailUrl: true,
		},
		limit: 5,
	});

	return rows.map((t) => ({
		id: t.id,
		name: t.name,
		description: t.description,
		category: t.category,
		tags: t.tags,
		useCount: t.useCount,
		entityCount: t.entityCount,
		fileCount: t.fileCount,
		thumbnailUrl: t.thumbnailUrl,
	}));
}

// ====================================================================
// MAIN ENTRY POINT
// ====================================================================

/**
 * Fetch all dashboard data in parallel.
 *
 * @param userDbId - The authenticated user's database ID (users.dbId)
 * @param teamDbId - The user's active team database ID (teams.dbId)
 *
 * @returns Fully typed DashboardData object, ready to pass to client components.
 *
 * Performance characteristics:
 * - 6 independent query groups run in parallel via Promise.all
 * - All queries use indexed columns (teamDbId, status, created_at)
 * - Entity count uses PostgreSQL jsonb_array_length (no JS-side parsing)
 * - Recent apps uses LATERAL JOINs to avoid N+1 for deployment/auth/functions
 * - Activity feed uses UNION ALL with per-branch ORDER BY + LIMIT for efficiency
 * - Estimated total wall time: 50-100ms for teams with <100 apps
 *
 * Caching recommendations:
 * - Stats: Could be cached with 60s TTL (stale-while-revalidate) if dashboard
 *   is hit frequently. These are aggregate queries that don't need to be real-time.
 * - Templates: Cache for 5 minutes — they change rarely and are global.
 * - Activity: Do NOT cache — users expect to see their latest actions immediately.
 * - Recent apps/workflows: Do NOT cache — stale data here would be confusing.
 *
 * Client-side loading candidates:
 * - Activity feed could be loaded client-side (not critical for first paint).
 * - Template suggestions could be loaded client-side (below the fold).
 * - Stats and recent apps/workflows should remain server-rendered (above the fold).
 */
export async function getDashboardData(
	userDbId: number,
	teamDbId: number,
): Promise<DashboardData> {
	// Fetch user + team info and all dashboard sections in parallel
	const [
		userResult,
		teamResult,
		stats,
		recentApps,
		recentWorkflows,
		activity,
		suggestedTemplates,
		allApps,
		storageStats,
	] = await Promise.all([
		// User display name
		db.query.users.findFirst({
			where: eq(users.dbId, userDbId),
			columns: { displayName: true },
		}),

		// Team name and plan
		db.query.teams.findFirst({
			where: eq(teams.dbId, teamDbId),
			columns: { name: true, plan: true },
		}),

		// Dashboard stats (4 aggregate queries, internally parallelized)
		fetchStats(teamDbId),

		// Enhanced recent apps with deployment, entity count, auth, functions
		fetchRecentApps(teamDbId),

		// Recent workflows
		fetchRecentWorkflows(teamDbId),

		// Activity timeline
		fetchActivity(teamDbId),

		// Template suggestions
		fetchSuggestedTemplates(),

		// All apps for management carousel
		fetchAllAppsForManagement(teamDbId),

		// Aggregated storage for stat card
		fetchTotalStorage(teamDbId),
	]);

	return {
		user: {
			displayName: userResult?.displayName ?? "User",
		},
		team: {
			name: teamResult?.name ?? "My Team",
			plan: teamResult?.plan ?? "free",
		},
		stats,
		recentApps,
		recentWorkflows,
		activity,
		suggestedTemplates,
		allApps,
		storageStats,
	};
}
