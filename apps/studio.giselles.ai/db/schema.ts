import type {
	GitHubIssueDocumentKey,
	GitHubIssueState,
	GitHubIssueStateReason,
	GitHubRepositoryIssueContentType,
} from "@giselles-ai/github-tool";
import type {
	AppId,
	DataStoreId,
	EmbeddingDimensions,
	EmbeddingProfileId,
	NodeId,
	TaskId,
	TriggerId,
	WorkspaceId,
} from "@giselles-ai/protocol";
import type {
	DocumentVectorStoreId,
	DocumentVectorStoreSourceId,
	GitHubRepositoryIndexId,
} from "@giselles-ai/types";
import { createIdGenerator } from "@giselles-ai/utils";
import { relations, sql } from "drizzle-orm";
import {
	boolean,
	foreignKey,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	unique,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import type * as z from "zod/v4";
import type { ContentStatusMetadata } from "@/lib/vector-stores/github/types";
import type { AgentId } from "@/services/agents/types";
import type { TeamId } from "@/services/teams/types";
import { vectorWithoutDimensions } from "./custom-types";

/**
 * Stripe v2 Billing Cadence history table
 *
 * Stores snapshots of billing cadence data from Stripe v2 API.
 * Each webhook event creates a new history record.
 *
 * @see https://docs.stripe.com/api/v2/billing-cadences/object?api-version=2025-12-15.preview
 */
export const stripeBillingCadenceHistories = pgTable(
	"stripe_billing_cadence_histories",
	{
		// Giselle fields
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),

		// Stripe cadence ID (bc_xxx) - not unique, can have multiple records
		id: text("id").notNull(),

		// Payer info
		customerId: text("customer_id").notNull(), // cus_xxx
		billingProfileId: text("billing_profile_id").notNull(), // bilp_xxx
		payerType: text("payer_type").notNull(), // "customer"

		// Billing cycle
		billingCycleType: text("billing_cycle_type").notNull(), // "month" | "year"
		billingCycleIntervalCount: integer(
			"billing_cycle_interval_count",
		).notNull(),
		billingCycleDayOfMonth: integer("billing_cycle_day_of_month"),
		billingCycleMonthOfYear: integer("billing_cycle_month_of_year"),
		billingCycleTimeHour: integer("billing_cycle_time_hour").notNull(),
		billingCycleTimeMinute: integer("billing_cycle_time_minute").notNull(),
		billingCycleTimeSecond: integer("billing_cycle_time_second").notNull(),

		// Billing dates
		nextBillingDate: timestamp("next_billing_date").notNull(),

		// Status
		status: text("status").notNull(), // "active" | etc.

		// Settings
		billSettingsId: text("bill_settings_id"), // bblset_xxx

		// Timestamps from Stripe
		created: timestamp("created").notNull(), // cadence.created

		// Metadata
		metadata: jsonb("metadata"),
		lookupKey: text("lookup_key"),

		// Note: livemode is available in Stripe response but omitted here as it's self-evident from the environment
	},
	(table) => [
		index("stripe_cadence_hist_id_idx").on(table.id),
		index("stripe_cadence_hist_team_db_id_idx").on(table.teamDbId),
		index("stripe_cadence_hist_customer_id_idx").on(table.customerId),
	],
);

export const stripeBillingCadenceHistoryRelations = relations(
	stripeBillingCadenceHistories,
	({ one }) => ({
		team: one(teams, {
			fields: [stripeBillingCadenceHistories.teamDbId],
			references: [teams.dbId],
		}),
	}),
);

/**
 * Stripe v2 Pricing Plan Subscription history table
 *
 * Stores snapshots of pricing plan subscription data from Stripe v2 API.
 * Each webhook event creates a new history record.
 *
 * @see https://docs.stripe.com/api/v2/pricing-plan-subscriptions/object?api-version=2025-12-15.preview
 */
export const stripePricingPlanSubscriptionHistories = pgTable(
	"stripe_pricing_plan_subscription_histories",
	{
		// Giselle fields
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		billingCadenceDbId: integer("billing_cadence_db_id")
			.notNull()
			.references(() => stripeBillingCadenceHistories.dbId, {
				onDelete: "cascade",
			}),
		createdAt: timestamp("created_at").defaultNow().notNull(),

		// Stripe subscription ID (bpps_xxx) - not unique, can have multiple records
		id: text("id").notNull(),

		// Stripe IDs
		billingCadenceId: text("billing_cadence_id").notNull(), // bc_xxx
		pricingPlanId: text("pricing_plan_id").notNull(), // bpp_xxx
		pricingPlanVersionId: text("pricing_plan_version_id").notNull(), // bppv_xxx

		// Status fields
		servicingStatus: text("servicing_status").notNull(), // "active" | "canceled" | "paused" | "pending"
		collectionStatus: text("collection_status").notNull(), // "current" | "past_due" | "paused" | "unpaid" | "awaiting_customer_action"

		// Servicing status transitions
		activatedAt: timestamp("activated_at"),
		canceledAt: timestamp("canceled_at"),
		pausedAt: timestamp("paused_at"),
		willCancelAt: timestamp("will_cancel_at"), // https://docs.stripe.com/api/v2/pricing-plan-subscriptions/update?api-version=2025-12-15.preview#v2_update_pricing_plan_subscriptions-response-servicing_status_transitions-will_cancel_at

		// Collection status transitions
		collectionCurrentAt: timestamp("collection_current_at"),
		collectionPastDueAt: timestamp("collection_past_due_at"),
		collectionPausedAt: timestamp("collection_paused_at"),
		collectionUnpaidAt: timestamp("collection_unpaid_at"),
		collectionAwaitingCustomerActionAt: timestamp(
			"collection_awaiting_customer_action_at",
		),

		// Timestamps from Stripe
		created: timestamp("created").notNull(), // subscription.created

		// Metadata
		metadata: jsonb("metadata"),

		// Note: livemode is available in Stripe response but omitted here as it's self-evident from the environment
	},
	(table) => [
		index("stripe_pps_hist_id_idx").on(table.id),
		index("stripe_pps_hist_team_db_id_idx").on(table.teamDbId),
		index("stripe_pps_hist_billing_cadence_db_id_idx").on(
			table.billingCadenceDbId,
		),
	],
);

export const stripePricingPlanSubscriptionHistoryRelations = relations(
	stripePricingPlanSubscriptionHistories,
	({ one }) => ({
		team: one(teams, {
			fields: [stripePricingPlanSubscriptionHistories.teamDbId],
			references: [teams.dbId],
		}),
		billingCadence: one(stripeBillingCadenceHistories, {
			fields: [stripePricingPlanSubscriptionHistories.billingCadenceDbId],
			references: [stripeBillingCadenceHistories.dbId],
		}),
	}),
);

export type TeamPlan = "free" | "pro" | "team" | "enterprise" | "internal";
export const teams = pgTable("teams", {
	id: text("id").$type<TeamId>().notNull().unique(),
	dbId: serial("db_id").primaryKey(),
	name: text("name").notNull(),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
	plan: text("plan").$type<TeamPlan>().notNull().default("free"),
	activeSubscriptionId: text("active_subscription_id").unique(),
	activeCustomerId: text("active_customer_id"),
});

export const teamRelations = relations(teams, ({ many }) => ({
	apps: many(apps),
	tasks: many(tasks),
	dataStores: many(dataStores),
}));

export type UserId = `usr_${string}`;
export const users = pgTable("users", {
	id: text("id").$type<UserId>().notNull().unique(),
	email: text("email").unique(),
	displayName: text("display_name"),
	avatarUrl: text("avatar_url"),
	passwordHash: text("password_hash"),
	emailVerified: boolean("email_verified").default(false).notNull(),
	dbId: serial("db_id").primaryKey(),
});

export const emailVerificationTokens = pgTable(
	"email_verification_tokens",
	{
		id: serial("id").primaryKey(),
		userDbId: integer("user_db_id")
			.notNull()
			.references(() => users.dbId, { onDelete: "cascade" }),
		email: text("email").notNull(),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at").notNull(),
		usedAt: timestamp("used_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("email_verification_tokens_token_idx").on(table.token)],
);

export const passwordResetTokens = pgTable(
	"password_reset_tokens",
	{
		id: serial("id").primaryKey(),
		userDbId: integer("user_db_id")
			.notNull()
			.references(() => users.dbId, { onDelete: "cascade" }),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at").notNull(),
		usedAt: timestamp("used_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("password_reset_tokens_token_idx").on(table.token)],
);

export const sessions = pgTable(
	"sessions",
	{
		id: serial("id").primaryKey(),
		userId: text("user_id").notNull(),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at").notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("sessions_token_idx").on(table.token),
		index("sessions_user_id_idx").on(table.userId),
	],
);

export type TeamRole = "admin" | "member";
export const teamMemberships = pgTable(
	"team_memberships",
	{
		id: serial("id").primaryKey(),
		userDbId: integer("user_db_id")
			.notNull()
			.references(() => users.dbId, { onDelete: "cascade" }),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		role: text("role").notNull().$type<TeamRole>(),
	},
	(teamMembership) => [
		unique().on(teamMembership.userDbId, teamMembership.teamDbId),
	],
);
export const teamMembershipRelations = relations(
	teamMemberships,
	({ one }) => ({
		team: one(teams, {
			fields: [teamMemberships.teamDbId],
			references: [teams.dbId],
		}),
	}),
);

/** @deprecated Use WorkspaceMetadata instead */
export type AgentMetadata = {
	sample: boolean;
};

/** @deprecated The agents table does not align with the application domain, so we are migrating to the workspaces table. We are keeping it for gradual migration due to the large scope of impact. */
export const agents = pgTable(
	"agents",
	{
		id: text("id").$type<AgentId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		name: text("name"),
		// TODO: DEPRECATED - graphUrl is legacy field, not used in new architecture, kept only for cleanup of existing data
		graphUrl: text("graph_url"),
		// TODO: add notNull constrain when new architecture released
		workspaceId: text("workspace_id").$type<WorkspaceId>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
		creatorDbId: integer("creator_db_id")
			.notNull()
			.references(() => users.dbId),
		metadata: jsonb("metadata")
			.$type<AgentMetadata>()
			.default({ sample: false })
			.notNull(),
		tags: text("tags").array().default([]).notNull(),
		isPublished: boolean("is_published").default(false).notNull(),
		publishedAt: timestamp("published_at"),
		folderId: text("folder_id").$type<WorkspaceFolderId>(),
	},
	(table) => [index().on(table.teamDbId)],
);
export const agentsRelations = relations(agents, ({ one }) => ({
	team: one(teams, {
		fields: [agents.teamDbId],
		references: [teams.dbId],
	}),
}));

export type WorkspaceMetadata = {
	sample: boolean;
};

export const workspaces = pgTable("workspaces", {
	id: text("id").$type<WorkspaceId>().notNull().unique(),
	dbId: serial("db_id").primaryKey(),
	name: text("name"),
	teamDbId: integer("team_db_id")
		.notNull()
		.references(() => teams.dbId, { onDelete: "cascade" }),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
	creatorDbId: integer("creator_db_id")
		.notNull()
		.references(() => users.dbId),
	metadata: jsonb("metadata")
		.$type<WorkspaceMetadata>()
		.default({ sample: false })
		.notNull(),
	errorWorkflowId: text("error_workflow_id").$type<WorkspaceId>(),
});

export const workspaceRelations = relations(workspaces, ({ one, many }) => ({
	creator: one(users, {
		fields: [workspaces.creatorDbId],
		references: [users.dbId],
	}),
	team: one(teams, {
		fields: [workspaces.teamDbId],
		references: [teams.dbId],
	}),
	app: one(apps, {
		fields: [workspaces.dbId],
		references: [apps.workspaceDbId],
	}),
	builderAppLinks: many(builderAppWorkflows),
}));

export const oauthCredentials = pgTable(
	"oauth_credentials",
	{
		id: serial("id").primaryKey(),
		userId: integer("user_id")
			.notNull()
			.references(() => users.dbId, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		providerAccountId: text("provider_account_id").notNull(),
		accessToken: text("access_token").notNull(),
		refreshToken: text("refresh_token"),
		expiresAt: timestamp("expires_at"),
		tokenType: text("token_type"),
		scope: text("scope"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		unique().on(table.userId, table.provider, table.providerAccountId),
	],
);

/** @deprecated */
export const githubIntegrationSettings = pgTable(
	"github_integration_settings",
	{
		id: text("id").notNull().unique(),
		agentDbId: integer("agent_db_id")
			.notNull()
			.references(() => agents.dbId),
		dbId: serial("db_id").primaryKey(),
		repositoryFullName: text("repository_full_name").notNull(),
		callSign: text("call_sign").notNull(),
		event: text("event").notNull(),
		flowId: text("flow_id").notNull(),
		eventNodeMappings: jsonb("event_node_mappings").notNull(),
		nextAction: text("next_action").notNull(),
	},
);

export const agentActivities = pgTable(
	"agent_activities",
	{
		dbId: serial("db_id").primaryKey(),
		agentDbId: integer("agent_db_id")
			.notNull()
			.references(() => agents.dbId, { onDelete: "cascade" }),
		startedAt: timestamp("started_at").notNull(),
		endedAt: timestamp("ended_at").notNull(),
		totalDurationMs: numeric("total_duration_ms").notNull(),
		usageReportDbId: integer("usage_report_db_id").references(
			() => agentTimeUsageReports.dbId,
		),
	},
	(table) => [index().on(table.agentDbId), index().on(table.endedAt)],
);

export const agentTimeUsageReports = pgTable(
	"agent_time_usage_reports",
	{
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		accumulatedDurationMs: numeric("accumulated_duration_ms").notNull(),
		minutesIncrement: integer("minutes_increment").notNull(),
		stripeMeterEventId: text("stripe_meter_event_id").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index().on(table.teamDbId),
		index().on(table.createdAt),
		index().on(table.stripeMeterEventId),
	],
);

export const userSeatUsageReports = pgTable(
	"user_seat_usage_reports",
	{
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		// Keep snapshot for audit purposes
		userDbIdList: integer("user_db_id_list").array().notNull(),
		stripeMeterEventId: text("stripe_meter_event_id").notNull(),
		value: integer("value").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index().on(table.teamDbId),
		index().on(table.createdAt),
		index().on(table.stripeMeterEventId),
	],
);

export const agentTimeRestrictions = pgTable(
	"agent_time_restrictions",
	{
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" })
			.primaryKey(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index().on(table.teamDbId)],
);

export const invitations = pgTable(
	"invitations",
	{
		token: text("token").notNull().unique(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: text("role").notNull().$type<TeamRole>(),
		inviterUserDbId: integer("inviter_user_db_id")
			.notNull()
			.references(() => users.dbId, { onDelete: "cascade" }),
		expiredAt: timestamp("expired_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		revokedAt: timestamp("revoked_at"),
	},
	(table) => [index().on(table.teamDbId, table.revokedAt)],
);

export type GitHubRepositoryIndexStatus =
	| "idle"
	| "running"
	| "completed"
	| "failed";
export const githubRepositoryIndex = pgTable(
	"github_repository_index",
	{
		id: text("id").$type<GitHubRepositoryIndexId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		owner: text("owner").notNull(),
		repo: text("repo").notNull(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		installationId: integer("installation_id").notNull(),
		/** @deprecated Use githubRepositoryContentStatus table instead */
		lastIngestedCommitSha: text("last_ingested_commit_sha"),
		/** @deprecated Use githubRepositoryContentStatus table instead */
		status: text("status")
			.notNull()
			.$type<GitHubRepositoryIndexStatus>()
			.default("idle"),
		/** @deprecated Use githubRepositoryContentStatus table instead */
		errorCode: text("error_code"),
		/** @deprecated Use githubRepositoryContentStatus table instead */
		retryAfter: timestamp("retry_after"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		unique().on(table.owner, table.repo, table.teamDbId),
		index().on(table.teamDbId),
		index().on(table.status),
	],
);

export const githubRepositoryEmbeddingProfiles = pgTable(
	"github_repository_embedding_profiles",
	{
		repositoryIndexDbId: integer("repository_index_db_id").notNull(),
		embeddingProfileId: integer("embedding_profile_id")
			.$type<EmbeddingProfileId>()
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.repositoryIndexDbId, table.embeddingProfileId],
			name: "gh_repo_emb_profiles_pk",
		}),
		foreignKey({
			columns: [table.repositoryIndexDbId],
			foreignColumns: [githubRepositoryIndex.dbId],
			name: "gh_repo_emb_profiles_repo_idx_fk",
		}).onDelete("cascade"),
	],
);

export const documentVectorStores = pgTable(
	"document_vector_stores",
	{
		id: text("id").$type<DocumentVectorStoreId>().notNull(),
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("doc_vs_team_db_id_idx").on(table.teamDbId),
		unique("doc_vs_id_unique").on(table.id),
	],
);

export type DocumentVectorStoreSourceUploadStatus =
	| "uploading"
	| "uploaded"
	| "failed";

export type DocumentVectorStoreSourceIngestStatus =
	| "idle"
	| "running"
	| "completed"
	| "failed";

export const documentVectorStoreSources = pgTable(
	"document_vector_store_sources",
	{
		id: text("id").$type<DocumentVectorStoreSourceId>().notNull(),
		dbId: serial("db_id").primaryKey(),
		documentVectorStoreDbId: integer("document_vector_store_db_id")
			.notNull()
			.references(() => documentVectorStores.dbId, { onDelete: "cascade" }),
		storageBucket: text("storage_bucket").notNull(),
		storageKey: text("storage_key").notNull(),
		fileName: text("file_name").notNull(),
		fileSizeBytes: integer("file_size_bytes").notNull(),
		fileChecksum: text("file_checksum"),
		uploadStatus: text("upload_status")
			.notNull()
			.$type<DocumentVectorStoreSourceUploadStatus>()
			.default("uploading"),
		uploadErrorCode: text("upload_error_code"),
		ingestStatus: text("ingest_status")
			.notNull()
			.$type<DocumentVectorStoreSourceIngestStatus>()
			.default("idle"),
		ingestErrorCode: text("ingest_error_code"),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
		ingestedAt: timestamp("ingested_at"),
	},
	(table) => [
		unique("doc_vs_src_id_unique").on(table.id),
		unique("doc_vs_src_storage_unique").on(
			table.documentVectorStoreDbId,
			table.storageKey,
		),
		index("doc_vs_src_upload_status_idx").on(table.uploadStatus),
		index("doc_vs_src_ingest_status_idx").on(table.ingestStatus),
	],
);

export const documentVectorStoreSourcesRelations = relations(
	documentVectorStoreSources,
	({ one }) => ({
		documentVectorStore: one(documentVectorStores, {
			fields: [documentVectorStoreSources.documentVectorStoreDbId],
			references: [documentVectorStores.dbId],
		}),
	}),
);

export const documentEmbeddingProfiles = pgTable(
	"document_embedding_profiles",
	{
		documentVectorStoreDbId: integer("document_vector_store_db_id").notNull(),
		embeddingProfileId: integer("embedding_profile_id")
			.$type<EmbeddingProfileId>()
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.documentVectorStoreDbId, table.embeddingProfileId],
			name: "doc_vs_emb_profiles_pk",
		}),
		foreignKey({
			columns: [table.documentVectorStoreDbId],
			foreignColumns: [documentVectorStores.dbId],
			name: "doc_vs_emb_profiles_store_fk",
		}).onDelete("cascade"),
	],
);

export const documentEmbeddings = pgTable(
	"document_embeddings",
	{
		dbId: serial("db_id").primaryKey(),
		documentVectorStoreDbId: integer("document_vector_store_db_id")
			.notNull()
			.references(() => documentVectorStores.dbId, {
				onDelete: "cascade",
			}),
		documentVectorStoreSourceDbId: integer("document_vector_store_source_db_id")
			.notNull()
			.references(() => documentVectorStoreSources.dbId, {
				onDelete: "cascade",
			}),
		embeddingProfileId: integer("embedding_profile_id")
			.$type<EmbeddingProfileId>()
			.notNull(),
		embeddingDimensions: integer("embedding_dimensions")
			.$type<EmbeddingDimensions>()
			.notNull(),
		documentKey: text("document_key").notNull(),
		chunkIndex: integer("chunk_index").notNull(),
		chunkContent: text("chunk_content").notNull(),
		embedding: vectorWithoutDimensions("embedding").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		unique("doc_embs_src_prof_doc_chunk_unique").on(
			table.documentVectorStoreSourceDbId,
			table.embeddingProfileId,
			table.documentKey,
			table.chunkIndex,
		),
		index("doc_embs_embedding_1536_idx")
			.using("hnsw", sql`(${table.embedding}::vector(1536)) vector_cosine_ops`)
			.where(sql`${table.embeddingDimensions} = 1536`),
		index("doc_embs_embedding_3072_idx")
			.using(
				"hnsw",
				sql`(${table.embedding}::halfvec(3072)) halfvec_cosine_ops`,
			)
			.where(sql`${table.embeddingDimensions} = 3072`),
		index("doc_embs_store_idx").on(table.documentVectorStoreDbId),
	],
);

export const documentEmbeddingsRelations = relations(
	documentEmbeddings,
	({ one }) => ({
		documentVectorStoreSource: one(documentVectorStoreSources, {
			fields: [documentEmbeddings.documentVectorStoreSourceDbId],
			references: [documentVectorStoreSources.dbId],
		}),
		documentVectorStore: one(documentVectorStores, {
			fields: [documentEmbeddings.documentVectorStoreDbId],
			references: [documentVectorStores.dbId],
		}),
	}),
);

export type GitHubRepositoryContentType = "blob" | "pull_request" | "issue";
export const githubRepositoryContentStatus = pgTable(
	"github_repository_content_status",
	{
		dbId: serial("db_id").primaryKey(),
		repositoryIndexDbId: integer("repository_index_db_id").notNull(),
		embeddingProfileId: integer("embedding_profile_id")
			.$type<EmbeddingProfileId>()
			.notNull(),
		contentType: text("content_type")
			.$type<GitHubRepositoryContentType>()
			.notNull(),
		enabled: boolean("enabled").notNull().default(true),
		status: text("status")
			.notNull()
			.$type<GitHubRepositoryIndexStatus>()
			.default("idle"),
		lastSyncedAt: timestamp("last_synced_at"),
		metadata: jsonb("metadata").$type<ContentStatusMetadata>(),
		errorCode: text("error_code"),
		retryAfter: timestamp("retry_after"),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		unique("gh_content_status_unique").on(
			table.repositoryIndexDbId,
			table.embeddingProfileId,
			table.contentType,
		),
		foreignKey({
			columns: [table.repositoryIndexDbId],
			foreignColumns: [githubRepositoryIndex.dbId],
			name: "gh_content_status_repo_idx_fk",
		}).onDelete("cascade"),
		index("gh_content_status_query_idx").on(
			table.enabled,
			table.status,
			table.updatedAt,
			table.retryAfter,
		),
	],
);

export const githubRepositoryEmbeddings = pgTable(
	"github_repository_embeddings",
	{
		dbId: serial("db_id").primaryKey(),
		repositoryIndexDbId: integer("repository_index_db_id")
			.notNull()
			.references(() => githubRepositoryIndex.dbId, { onDelete: "cascade" }),
		embeddingProfileId: integer("embedding_profile_id")
			.$type<EmbeddingProfileId>()
			.notNull(),
		embeddingDimensions: integer("embedding_dimensions")
			.$type<EmbeddingDimensions>()
			.notNull(),
		fileSha: text("file_sha").notNull(),
		path: text("path").notNull(),
		embedding: vectorWithoutDimensions("embedding").notNull(),
		chunkContent: text("chunk_content").notNull(),
		chunkIndex: integer("chunk_index").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("gh_repo_emb_unique").on(
			table.repositoryIndexDbId,
			table.embeddingProfileId,
			table.path,
			table.chunkIndex,
		),
		// Partial HNSW indexes for different dimensions with casting
		index("github_repository_embeddings_embedding_1536_idx")
			.using("hnsw", sql`${table.embedding}::vector(1536) vector_cosine_ops`)
			.where(sql`${table.embeddingDimensions} = 1536`),
		index("github_repository_embeddings_embedding_3072_idx")
			.using("hnsw", sql`${table.embedding}::halfvec(3072) halfvec_cosine_ops`)
			.where(sql`${table.embeddingDimensions} = 3072`),
	],
);

export const GitHubRepositoryPullRequestContentTypeValues = [
	"title_body",
	"comment",
	"diff",
] as const;
export type GitHubRepositoryPullRequestContentType =
	(typeof GitHubRepositoryPullRequestContentTypeValues)[number];
// Document key format for GitHub Pull Request embeddings (e.g., "123:title_body:", "123:comment:456", "123:diff:path/to/file.ts")
export type GitHubPullRequestDocumentKey =
	`${number}:${GitHubRepositoryPullRequestContentType}:${string}`;

export const githubRepositoryPullRequestEmbeddings = pgTable(
	"github_repository_pull_request_embeddings",
	{
		dbId: serial("db_id").primaryKey(),
		repositoryIndexDbId: integer("repository_index_db_id").notNull(),
		embeddingProfileId: integer("embedding_profile_id")
			.$type<EmbeddingProfileId>()
			.notNull(),
		embeddingDimensions: integer("embedding_dimensions")
			.$type<EmbeddingDimensions>()
			.notNull(),
		prNumber: integer("pr_number").notNull(),
		mergedAt: timestamp("merged_at").notNull(),
		contentType: text("content_type")
			.$type<GitHubRepositoryPullRequestContentType>()
			.notNull(),
		contentId: text("content_id").notNull(),
		documentKey: text("document_key")
			.$type<GitHubPullRequestDocumentKey>()
			.notNull(),
		embedding: vectorWithoutDimensions("embedding").notNull(),
		chunkContent: text("chunk_content").notNull(),
		chunkIndex: integer("chunk_index").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("gh_pr_emb_unique").on(
			table.repositoryIndexDbId,
			table.embeddingProfileId,
			table.prNumber,
			table.contentType,
			table.contentId,
			table.chunkIndex,
		),
		// Partial HNSW indexes for different dimensions with casting
		index("gh_pr_embeddings_embedding_1536_idx")
			.using("hnsw", sql`${table.embedding}::vector(1536) vector_cosine_ops`)
			.where(sql`${table.embeddingDimensions} = 1536`),
		index("gh_pr_embeddings_embedding_3072_idx")
			.using("hnsw", sql`${table.embedding}::halfvec(3072) halfvec_cosine_ops`)
			.where(sql`${table.embeddingDimensions} = 3072`),
		foreignKey({
			columns: [table.repositoryIndexDbId],
			foreignColumns: [githubRepositoryIndex.dbId],
			name: "gh_pr_embeddings_repo_idx_fk",
		}).onDelete("cascade"),
		index("gh_pr_emb_repo_doc_idx").on(
			table.repositoryIndexDbId,
			table.documentKey,
		),
	],
);

export const githubRepositoryIssueEmbeddings = pgTable(
	"github_repository_issue_embeddings",
	{
		dbId: serial("db_id").primaryKey(),
		repositoryIndexDbId: integer("repository_index_db_id").notNull(),
		embeddingProfileId: integer("embedding_profile_id")
			.$type<EmbeddingProfileId>()
			.notNull(),
		embeddingDimensions: integer("embedding_dimensions")
			.$type<EmbeddingDimensions>()
			.notNull(),
		issueNumber: integer("issue_number").notNull(),
		issueState: text("issue_state").$type<GitHubIssueState>().notNull(),
		issueStateReason: text(
			"issue_state_reason",
		).$type<GitHubIssueStateReason | null>(),
		issueUpdatedAt: timestamp("issue_updated_at").notNull(),
		issueClosedAt: timestamp("issue_closed_at"),
		contentType: text("content_type")
			.$type<GitHubRepositoryIssueContentType>()
			.notNull(),
		contentId: text("content_id").notNull(),
		documentKey: text("document_key").$type<GitHubIssueDocumentKey>().notNull(),
		contentCreatedAt: timestamp("content_created_at").notNull(),
		contentEditedAt: timestamp("content_edited_at").notNull(),
		metadataVersion: text("metadata_version"),
		embedding: vectorWithoutDimensions("embedding").notNull(),
		chunkContent: text("chunk_content").notNull(),
		chunkIndex: integer("chunk_index").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("gh_issue_emb_unique").on(
			table.repositoryIndexDbId,
			table.embeddingProfileId,
			table.issueNumber,
			table.contentType,
			table.contentId,
			table.chunkIndex,
		),
		index("gh_issue_embeddings_embedding_1536_idx")
			.using("hnsw", sql`(${table.embedding}::vector(1536)) vector_cosine_ops`)
			.where(sql`${table.embeddingDimensions} = 1536`),
		index("gh_issue_embeddings_embedding_3072_idx")
			.using(
				"hnsw",
				sql`(${table.embedding}::halfvec(3072)) halfvec_cosine_ops`,
			)
			.where(sql`${table.embeddingDimensions} = 3072`),
		foreignKey({
			columns: [table.repositoryIndexDbId],
			foreignColumns: [githubRepositoryIndex.dbId],
			name: "gh_issue_embeddings_repo_idx_fk",
		}).onDelete("cascade"),
		index("gh_issue_emb_repo_doc_idx").on(
			table.repositoryIndexDbId,
			table.documentKey,
		),
	],
);

export const dataStores = pgTable(
	"data_stores",
	{
		id: text("id").$type<DataStoreId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("data_stores_team_db_id_idx").on(table.teamDbId)],
);

export const dataStoreRelations = relations(dataStores, ({ one }) => ({
	team: one(teams, {
		fields: [dataStores.teamDbId],
		references: [teams.dbId],
	}),
}));

export const flowTriggers = pgTable(
	"flow_triggers",
	{
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		staged: boolean("staged").notNull().default(false),
		sdkWorkspaceId: text("workspace_id").$type<WorkspaceId>().notNull(),
		sdkFlowTriggerId: text("flow_trigger_id").$type<TriggerId>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex().on(table.sdkFlowTriggerId),
		index().on(table.teamDbId),
		index().on(table.staged),
	],
);

export const acts = pgTable(
	"acts",
	{
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		directorDbId: integer("director_db_id")
			.notNull()
			.references(() => users.dbId, { onDelete: "cascade" }),
		sdkWorkspaceId: text("sdk_workspace_id").$type<WorkspaceId>().notNull(),
		sdkFlowTriggerId: text("sdk_flow_trigger_id").$type<TriggerId>().notNull(),
		sdkActId: text("sdk_act_id").$type<TaskId>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index().on(table.teamDbId),
		index().on(table.sdkWorkspaceId),
		index().on(table.sdkFlowTriggerId),
		index().on(table.sdkActId),
	],
);

export const actRelations = relations(acts, ({ one }) => ({
	team: one(teams, {
		fields: [acts.teamDbId],
		references: [teams.dbId],
	}),
}));

export const apps = pgTable(
	"apps",
	{
		id: text("id").$type<AppId>().notNull().unique(),
		appEntryNodeId: text("app_entry_node_id").$type<NodeId>().notNull(),
		endNodeId: text("end_node_id").$type<NodeId | null>(),
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		workspaceDbId: integer("workspace_db_id")
			.notNull()
			.references(() => workspaces.dbId, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index().on(table.teamDbId),
		unique().on(table.workspaceDbId, table.appEntryNodeId),
	],
);

export const appRelations = relations(apps, ({ one, many }) => ({
	team: one(teams, {
		fields: [apps.teamDbId],
		references: [teams.dbId],
	}),
	workspace: one(workspaces, {
		fields: [apps.workspaceDbId],
		references: [workspaces.dbId],
	}),
	tasks: many(tasks),
}));

export const ApiKeyId = createIdGenerator("gsk");
export type ApiKeyId = z.infer<typeof ApiKeyId.schema>;

export type ApiSecretKdf = {
	type: "scrypt";
	salt: string;
	params: {
		n: number;
		r: number;
		p: number;
		keyLen: number;
	};
};

export const apiKeys = pgTable(
	"api_keys",
	{
		dbId: serial("db_id").primaryKey(),
		id: text("id").$type<ApiKeyId>().notNull(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		label: text("label"),
		createdByUserDbId: integer("created_by_user_db_id").references(
			() => users.dbId,
		),
		redactedValue: text("redacted_value").notNull(),
		kdfType: text("kdf_type").$type<ApiSecretKdf["type"]>().notNull(),
		kdfSalt: text("kdf_salt").notNull(),
		kdfN: integer("kdf_n").notNull(),
		kdfR: integer("kdf_r").notNull(),
		kdfP: integer("kdf_p").notNull(),
		kdfKeyLen: integer("kdf_key_len").notNull(),
		secretHash: text("secret_hash").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		lastUsedAt: timestamp("last_used_at"),
		revokedAt: timestamp("revoked_at"),
	},
	(table) => [
		uniqueIndex("api_keys_id_unique").on(table.id),
		index("api_keys_team_db_id_idx").on(table.teamDbId),
		index("api_keys_revoked_at_idx").on(table.revokedAt),
	],
);

export const apiSecretRecordRelations = relations(apiKeys, ({ one }) => ({
	team: one(teams, {
		fields: [apiKeys.teamDbId],
		references: [teams.dbId],
	}),
	creator: one(users, {
		fields: [apiKeys.createdByUserDbId],
		references: [users.dbId],
	}),
}));

export type ApiSecretRecord = typeof apiKeys.$inferSelect;

export const apiRateLimitCounters = pgTable(
	"api_rate_limit_counters",
	{
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		routeKey: text("route_key").notNull(),
		windowStart: timestamp("window_start").notNull(),
		count: integer("count").notNull().default(0),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		primaryKey({
			columns: [table.teamDbId, table.routeKey, table.windowStart],
			name: "api_rate_limit_counters_pk",
		}),
		index("api_rate_limit_counters_team_window_idx").on(
			table.teamDbId,
			table.windowStart,
		),
	],
);

export const tasks = pgTable(
	"tasks",
	{
		id: text("id").$type<TaskId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		appDbId: integer("app_db_id").references(() => apps.dbId, {
			onDelete: "cascade",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [index().on(table.teamDbId)],
);

export const taskRelations = relations(tasks, ({ one }) => ({
	team: one(teams, {
		fields: [tasks.teamDbId],
		references: [teams.dbId],
	}),
	app: one(apps, {
		fields: [tasks.appDbId],
		references: [apps.dbId],
	}),
}));

// ====================================================================
// APP BUILDER TABLES
// ====================================================================
// These tables support the Vibexe App Builder feature integration.
// Allows users to create apps via chat interface with AI assistance.

/**
 * Type definitions for App Builder IDs
 */
export type BuilderProjectId = `bprj_${string}`;
export type BuilderAppId = `bldr_${string}`;
export type BuilderFileId = `bldf_${string}`;
export type BuilderChatId = `bldc_${string}`;
export type BuilderVersionId = `bldv_${string}`;
export type BuilderAppWorkflowId = `bawf_${string}`;
export type BuilderDeploymentId = `bdep_${string}`;
export type BuilderAppTemplateId = `btpl_${string}`;

/**
 * Builder Projects - organizational containers for builder apps
 */
export const builderProjects = pgTable(
	"builder_projects",
	{
		id: text("id").$type<BuilderProjectId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		createdByUserDbId: integer("created_by_user_db_id").references(
			() => users.dbId,
		),
		name: text("name").notNull().default("Untitled Project"),
		description: text("description"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("builder_projects_team_db_id_idx").on(table.teamDbId),
	],
);

export const builderProjectRelations = relations(
	builderProjects,
	({ one, many }) => ({
		team: one(teams, {
			fields: [builderProjects.teamDbId],
			references: [teams.dbId],
		}),
		creator: one(users, {
			fields: [builderProjects.createdByUserDbId],
			references: [users.dbId],
		}),
		apps: many(builderApps),
	}),
);

export type BuilderProject = typeof builderProjects.$inferSelect;
export type NewBuilderProject = typeof builderProjects.$inferInsert;

/**
 * Builder Apps - the main app entity for chat-built applications
 */
export const builderApps = pgTable(
	"builder_apps",
	{
		id: text("id").$type<BuilderAppId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		createdByUserDbId: integer("created_by_user_db_id").references(
			() => users.dbId,
		),
		projectDbId: integer("project_db_id").references(
			() => builderProjects.dbId,
			{ onDelete: "set null" },
		),
		name: text("name").notNull(),
		description: text("description"),
		shareToken: text("share_token"),
		visibility: text("visibility").notNull().default("public"),
		requireLogin: boolean("require_login").notNull().default(false),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("builder_apps_team_db_id_idx").on(table.teamDbId),
		index("builder_apps_created_by_user_db_id_idx").on(table.createdByUserDbId),
		index("builder_apps_project_db_id_idx").on(table.projectDbId),
		uniqueIndex("builder_apps_share_token_idx").on(table.shareToken),
	],
);

export const builderAppRelations = relations(builderApps, ({ one, many }) => ({
	team: one(teams, {
		fields: [builderApps.teamDbId],
		references: [teams.dbId],
	}),
	creator: one(users, {
		fields: [builderApps.createdByUserDbId],
		references: [users.dbId],
	}),
	project: one(builderProjects, {
		fields: [builderApps.projectDbId],
		references: [builderProjects.dbId],
	}),
	files: many(builderFiles),
	chats: many(builderChats),
	versions: many(builderVersions),
	workflows: many(builderAppWorkflows),
	database: one(builderAppDatabases, {
		fields: [builderApps.dbId],
		references: [builderAppDatabases.appDbId],
	}),
	apiKeys: many(builderAppApiKeys),
	deployments: many(builderDeployments),
}));

export type BuilderApp = typeof builderApps.$inferSelect;
export type NewBuilderApp = typeof builderApps.$inferInsert;

/**
 * Builder Files - files within an app (source code, assets)
 */
export const builderFiles = pgTable(
	"builder_files",
	{
		id: text("id").$type<BuilderFileId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		path: text("path").notNull(), // e.g., "src/App.tsx"
		content: text("content"),
		language: text("language"), // e.g., "typescript", "css"
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("builder_files_app_db_id_idx").on(table.appDbId),
		index("builder_files_app_path_idx").on(table.appDbId, table.path),
	],
);

export const builderFileRelations = relations(builderFiles, ({ one }) => ({
	app: one(builderApps, {
		fields: [builderFiles.appDbId],
		references: [builderApps.dbId],
	}),
}));

export type BuilderFile = typeof builderFiles.$inferSelect;
export type NewBuilderFile = typeof builderFiles.$inferInsert;

/**
 * Builder Chats - chat history per app for AI conversation
 */
export const builderChats = pgTable(
	"builder_chats",
	{
		id: text("id").$type<BuilderChatId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		messages: jsonb("messages").default([]).notNull(), // Array of ChatMessage objects
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("builder_chats_app_db_id_idx").on(table.appDbId)],
);

export const builderChatRelations = relations(builderChats, ({ one }) => ({
	app: one(builderApps, {
		fields: [builderChats.appDbId],
		references: [builderApps.dbId],
	}),
}));

export type BuilderChat = typeof builderChats.$inferSelect;
export type NewBuilderChat = typeof builderChats.$inferInsert;

/**
 * Builder Versions - snapshots for version history
 */
export const builderVersions = pgTable(
	"builder_versions",
	{
		id: text("id").$type<BuilderVersionId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		versionNumber: text("version_number").notNull(), // e.g., "1.0.0"
		files: jsonb("files").notNull(), // Snapshot of all file contents
		message: text("message"), // Version commit message
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("builder_versions_app_db_id_idx").on(table.appDbId)],
);

export const builderVersionRelations = relations(
	builderVersions,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderVersions.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

export type BuilderVersion = typeof builderVersions.$inferSelect;
export type NewBuilderVersion = typeof builderVersions.$inferInsert;

/**
 * Builder App Workflows - links builder apps to Giselle workflows (workspaces)
 * Allows attaching one or more workflows to a builder app for automation.
 */
export const builderAppWorkflows = pgTable(
	"builder_app_workflows",
	{
		id: text("id").$type<BuilderAppWorkflowId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		workspaceId: text("workspace_id").$type<WorkspaceId>().notNull(),
		purpose: text("purpose"), // e.g., "testing", "content-pipeline", "ci-cd", "scheduled-refresh"
		label: text("label"), // user-friendly name for this link
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("builder_app_workflows_app_db_id_idx").on(table.appDbId),
		index("builder_app_workflows_workspace_id_idx").on(table.workspaceId),
	],
);

export const builderAppWorkflowRelations = relations(
	builderAppWorkflows,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppWorkflows.appDbId],
			references: [builderApps.dbId],
		}),
		workspace: one(workspaces, {
			fields: [builderAppWorkflows.workspaceId],
			references: [workspaces.id],
		}),
	}),
);

export type BuilderAppWorkflow = typeof builderAppWorkflows.$inferSelect;
export type NewBuilderAppWorkflow = typeof builderAppWorkflows.$inferInsert;

// ====================================================================
// BUILDER APP DATABASES (Per-App Isolated PostgreSQL)
// ====================================================================

/**
 * Builder App Databases — tracks per-app PostgreSQL databases.
 * Each app can have its own isolated database (vibexe_app_{shortId}).
 */
export const builderAppDatabases = pgTable(
	"builder_app_databases",
	{
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.unique()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		databaseName: text("database_name").notNull().unique(),
		status: text("status").notNull().default("pending"), // pending | provisioning | active | error | deleted
		schemaJson: jsonb("schema_json").default({}), // Entity definitions (AppSchema)
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("builder_app_databases_app_db_id_idx").on(table.appDbId),
	],
);

export const builderAppDatabaseRelations = relations(
	builderAppDatabases,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppDatabases.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

export type BuilderAppDatabase = typeof builderAppDatabases.$inferSelect;
export type NewBuilderAppDatabase = typeof builderAppDatabases.$inferInsert;

/**
 * Builder App API Keys — per-app API keys for external data access.
 * Keys are stored as SHA-256 hashes; the raw key is shown only once on creation.
 */
export const builderAppApiKeys = pgTable(
	"builder_app_api_keys",
	{
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		keyHash: text("key_hash").notNull(),
		keyPrefix: text("key_prefix").notNull(), // First 8 chars for display ("vbx_abc1...")
		label: text("label"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	},
	(table) => [
		index("builder_app_api_keys_app_db_id_idx").on(table.appDbId),
		index("builder_app_api_keys_lookup_idx").on(table.appDbId, table.keyHash),
	],
);

export const builderAppApiKeyRelations = relations(
	builderAppApiKeys,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppApiKeys.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

export type BuilderAppApiKey = typeof builderAppApiKeys.$inferSelect;
export type NewBuilderAppApiKey = typeof builderAppApiKeys.$inferInsert;

// ====================================================================
// BUILDER DEPLOYMENTS
// ====================================================================

/**
 * Builder Deployments — tracks deployed app builds.
 * Each deployment creates static files served via Apache VirtualHost.
 */
export const builderDeployments = pgTable(
	"builder_deployments",
	{
		id: text("id").$type<BuilderDeploymentId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		subdomain: text("subdomain").unique(), // "my-app" → my-app.vibexe.online
		customDomain: text("custom_domain").unique(), // "app.example.com"
		status: text("status").notNull().default("pending"), // pending | building | live | failed
		buildLog: text("build_log"),
		deployedAt: timestamp("deployed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("builder_deployments_app_db_id_idx").on(table.appDbId),
		uniqueIndex("builder_deployments_subdomain_idx").on(table.subdomain),
	],
);

export const builderDeploymentRelations = relations(
	builderDeployments,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderDeployments.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

export type BuilderDeployment = typeof builderDeployments.$inferSelect;
export type NewBuilderDeployment = typeof builderDeployments.$inferInsert;

// ── External Database Connections (Supabase Connect) ──

export type BuilderExternalDbId = `bext_${string}`;

export const builderAppExternalDbs = pgTable(
	"builder_app_external_dbs",
	{
		id: text("id").$type<BuilderExternalDbId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.unique()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		provider: text("provider").notNull().default("supabase"), // supabase | firebase | custom
		encryptedUrl: text("encrypted_url").notNull(), // Encrypted Supabase project URL
		encryptedAnonKey: text("encrypted_anon_key").notNull(), // Encrypted anon key
		status: text("status").notNull().default("pending"), // pending | connected | error
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("builder_app_external_dbs_app_db_id_idx").on(table.appDbId),
	],
);

export const builderAppExternalDbRelations = relations(
	builderAppExternalDbs,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppExternalDbs.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

// ====================================================================
// APP ENTITY ACCESS POLICIES
// ====================================================================

export const builderAppEntityPolicies = pgTable(
	"builder_app_entity_policies",
	{
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		entityName: text("entity_name").notNull(),
		readAccess: text("read_access").notNull().default("public"), // public | authenticated | owner | role | custom
		writeAccess: text("write_access").notNull().default("authenticated"),
		deleteAccess: text("delete_access").notNull().default("authenticated"),
		ownerField: text("owner_field").default("user_id"),
		allowedRoles: text("allowed_roles"), // JSON: '["admin", "editor"]'
		customExpression: text("custom_expression"), // WHERE template with $userId/$userRole placeholders
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("builder_app_entity_policies_app_entity_idx").on(
			table.appDbId,
			table.entityName,
		),
	],
);

export const builderAppEntityPolicyRelations = relations(
	builderAppEntityPolicies,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppEntityPolicies.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

// ====================================================================
// APP AUTH SETTINGS
// ====================================================================

export const builderAppAuthSettings = pgTable("builder_app_auth_settings", {
	dbId: serial("db_id").primaryKey(),
	appDbId: integer("app_db_id")
		.notNull()
		.unique()
		.references(() => builderApps.dbId, { onDelete: "cascade" }),
	emailPasswordEnabled: boolean("email_password_enabled").notNull().default(true),
	googleEnabled: boolean("google_enabled").notNull().default(false),
	githubEnabled: boolean("github_enabled").notNull().default(false),
	microsoftEnabled: boolean("microsoft_enabled").notNull().default(false),
	appleEnabled: boolean("apple_enabled").notNull().default(false),
	requireApproval: boolean("require_approval").notNull().default(false),
	googleClientId: text("google_client_id"),
	googleClientSecret: text("google_client_secret"),
	githubClientId: text("github_client_id"),
	githubClientSecret: text("github_client_secret"),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const builderAppAuthSettingsRelations = relations(
	builderAppAuthSettings,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppAuthSettings.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

// ====================================================================
// APP-LEVEL INTEGRATIONS (connected services per app)
// ====================================================================

export const builderAppIntegrations = pgTable(
	"builder_app_integrations",
	{
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		pieceName: text("piece_name").notNull(),
		displayName: text("display_name").notNull(),
		status: text("status").notNull().default("connected"),
		config: jsonb("config").default({}),
		encryptedCredentials: text("encrypted_credentials"),
		connectedAt: timestamp("connected_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("builder_app_integrations_app_piece_idx").on(
			table.appDbId,
			table.pieceName,
		),
	],
);

export const builderAppIntegrationRelations = relations(
	builderAppIntegrations,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppIntegrations.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

// ====================================================================
// APP-LEVEL AI AGENTS
// ====================================================================

export const builderAppAgents = pgTable("builder_app_agents", {
	dbId: serial("db_id").primaryKey(),
	appDbId: integer("app_db_id")
		.notNull()
		.references(() => builderApps.dbId, { onDelete: "cascade" }),
	name: text("name").notNull().default("AI Assistant"),
	enabled: boolean("enabled").notNull().default(false),
	systemPrompt: text("system_prompt"),
	model: text("model").notNull().default("gpt-4o-mini"),
	temperature: numeric("temperature").default("0.7"),
	toolsEnabled: jsonb("tools_enabled").default([]),
	uiConfig: jsonb("ui_config").default({}),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const builderAppAgentRelations = relations(
	builderAppAgents,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppAgents.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

// ====================================================================
// APP-LEVEL AUTOMATIONS
// ====================================================================

export const builderAppAutomations = pgTable("builder_app_automations", {
	dbId: serial("db_id").primaryKey(),
	appDbId: integer("app_db_id")
		.notNull()
		.references(() => builderApps.dbId, { onDelete: "cascade" }),
	name: text("name").notNull(),
	enabled: boolean("enabled").notNull().default(true),
	triggerType: text("trigger_type").notNull(),
	triggerConfig: jsonb("trigger_config").default({}),
	actionType: text("action_type").notNull(),
	actionConfig: jsonb("action_config").default({}),
	lastRunAt: timestamp("last_run_at", { withTimezone: true }),
	runCount: integer("run_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const builderAppAutomationRelations = relations(
	builderAppAutomations,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppAutomations.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

// ====================================================================
// APP WEBHOOKS
// ====================================================================

export const builderAppWebhooks = pgTable("builder_app_webhooks", {
	dbId: serial("db_id").primaryKey(),
	appDbId: integer("app_db_id")
		.notNull()
		.references(() => builderApps.dbId, { onDelete: "cascade" }),
	url: text("url").notNull(),
	description: text("description"),
	events: jsonb("events").notNull().$type<string[]>(),
	secret: text("secret"),
	headers: jsonb("headers").default({}).$type<Record<string, string>>(),
	enabled: boolean("enabled").notNull().default(true),
	lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
	lastDeliveryOk: boolean("last_delivery_ok"),
	deliverySuccessCount: integer("delivery_success_count").default(0),
	deliveryFailureCount: integer("delivery_failure_count").default(0),
	timeoutMs: integer("timeout_ms").default(10000),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
}, (table) => [
	index("builder_app_webhooks_app_enabled_idx").on(table.appDbId, table.enabled),
]);

export const builderAppWebhookRelations = relations(
	builderAppWebhooks,
	({ one, many }) => ({
		app: one(builderApps, {
			fields: [builderAppWebhooks.appDbId],
			references: [builderApps.dbId],
		}),
		logs: many(builderAppWebhookLogs),
	}),
);

export const builderAppWebhookLogs = pgTable("builder_app_webhook_logs", {
	dbId: serial("db_id").primaryKey(),
	webhookDbId: integer("webhook_db_id")
		.notNull()
		.references(() => builderAppWebhooks.dbId, { onDelete: "cascade" }),
	eventType: text("event_type").notNull(),
	payload: jsonb("payload"),
	responseStatus: integer("response_status"),
	responseBody: text("response_body"),
	attempt: integer("attempt").notNull(),
	success: boolean("success").notNull(),
	durationMs: integer("duration_ms"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
}, (table) => [
	index("builder_app_webhook_logs_webhook_idx").on(table.webhookDbId),
	index("builder_app_webhook_logs_created_idx").on(table.createdAt),
]);

export const builderAppWebhookLogRelations = relations(
	builderAppWebhookLogs,
	({ one }) => ({
		webhook: one(builderAppWebhooks, {
			fields: [builderAppWebhookLogs.webhookDbId],
			references: [builderAppWebhooks.dbId],
		}),
	}),
);

// ====================================================================
// AI PROVIDER KEY MANAGEMENT
// ====================================================================

export const aiProviderKeys = pgTable("ai_provider_keys", {
	dbId: serial("db_id").primaryKey(),
	provider: text("provider").notNull().unique(), // "openai" | "anthropic" | "google" | "perplexity"
	encryptedApiKey: text("encrypted_api_key").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const teamAiProviderKeys = pgTable(
	"team_ai_provider_keys",
	{
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		encryptedApiKey: text("encrypted_api_key").notNull(),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("team_ai_provider_keys_team_provider_idx").on(
			table.teamDbId,
			table.provider,
		),
	],
);

export const integrationCredentials = pgTable(
	"integration_credentials",
	{
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId),
		pieceName: text("piece_name").notNull(), // e.g. "slack", "google-sheets"
		displayName: text("display_name").notNull(), // User-facing label
		authType: text("auth_type").notNull(), // "oauth2" | "secret_text" | "basic" | "custom"
		encryptedConfig: text("encrypted_config").notNull(), // Encrypted JSON blob with tokens/keys
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("integration_credentials_team_piece_idx").on(table.teamDbId, table.pieceName),
	],
);

// OAuth App Configs - stores client_id + client_secret per provider group
// One Google config covers google-sheets, google-drive, gmail, etc.
// One Microsoft config covers microsoft-teams, microsoft-outlook, etc.
export const oauthAppConfigs = pgTable("oauth_app_configs", {
	dbId: serial("db_id").primaryKey(),
	provider: text("provider").notNull().unique(), // "google", "slack", "discord", "microsoft", etc.
	clientId: text("client_id").notNull(),
	encryptedClientSecret: text("encrypted_client_secret").notNull(),
	scopes: text("scopes"), // optional comma-separated scope override
	extraParams: text("extra_params").default("{}"), // JSON: e.g. {"access_type":"offline","prompt":"consent"}
	enabled: boolean("enabled").default(true).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

// Integration Store - persistent key-value store for Activepieces piece executions
// Scoped per team so pieces can persist state across runs
export const integrationStore = pgTable(
	"integration_store",
	{
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId),
		storeKey: text("store_key").notNull(),
		value: text("value"), // JSON-serialized value
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		unique("integration_store_team_key_idx").on(table.teamDbId, table.storeKey),
	],
);

// Scheduled Workflows - cron-based workflow execution
export const scheduledWorkflows = pgTable(
	"scheduled_workflows",
	{
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		sdkWorkspaceId: text("workspace_id").$type<WorkspaceId>().notNull(),
		agentNodeId: text("agent_node_id").notNull(),
		sdkFlowTriggerId: text("flow_trigger_id").$type<TriggerId>(),
		cronExpression: text("cron_expression").notNull(),
		timezone: text("timezone").notNull().default("UTC"),
		enabled: boolean("enabled").notNull().default(false),
		lastRunAt: timestamp("last_run_at"),
		nextRunAt: timestamp("next_run_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("scheduled_workflows_team_idx").on(table.teamDbId),
		index("scheduled_workflows_enabled_idx").on(table.enabled),
		index("scheduled_workflows_next_run_idx").on(table.nextRunAt),
	],
);

// Webhook Endpoints - HTTP-triggered workflow execution
export const webhookEndpoints = pgTable(
	"webhook_endpoints",
	{
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		sdkWorkspaceId: text("workspace_id").$type<WorkspaceId>().notNull(),
		agentNodeId: text("agent_node_id").notNull(),
		sdkFlowTriggerId: text("flow_trigger_id").$type<TriggerId>(),
		webhookPath: text("webhook_path").notNull(),
		method: text("method").notNull().default("POST"),
		enabled: boolean("enabled").notNull().default(true),
		lastTriggeredAt: timestamp("last_triggered_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("webhook_endpoints_path_unique").on(table.webhookPath),
		index("webhook_endpoints_team_idx").on(table.teamDbId),
		index("webhook_endpoints_enabled_idx").on(table.enabled),
	],
);

// Webhook Request Logs - logs of incoming webhook requests for debugging
export const webhookRequestLogs = pgTable(
	"webhook_request_logs",
	{
		dbId: serial("db_id").primaryKey(),
		webhookEndpointDbId: integer("webhook_endpoint_db_id")
			.notNull()
			.references(() => webhookEndpoints.dbId, { onDelete: "cascade" }),
		method: text("method").notNull(),
		path: text("path").notNull(),
		headers: jsonb("headers").default({}),
		body: jsonb("body"),
		statusCode: integer("status_code").default(200),
		responseBody: jsonb("response_body"),
		ipAddress: text("ip_address"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("webhook_request_logs_endpoint_idx").on(table.webhookEndpointDbId),
		index("webhook_request_logs_created_idx").on(table.createdAt),
	],
);

// Chat Sessions - persistent chat conversations
export const chatSessions = pgTable(
	"chat_sessions",
	{
		dbId: serial("db_id").primaryKey(),
		sessionId: text("session_id").notNull(),
		sdkWorkspaceId: text("workspace_id").$type<WorkspaceId>().notNull(),
		agentNodeId: text("agent_node_id").notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("chat_sessions_session_id_unique").on(table.sessionId),
		index("chat_sessions_workspace_idx").on(table.sdkWorkspaceId),
	],
);

// Chat Messages - individual messages in a chat session
export const chatMessages = pgTable(
	"chat_messages",
	{
		dbId: serial("db_id").primaryKey(),
		sessionDbId: integer("session_db_id")
			.notNull()
			.references(() => chatSessions.dbId, { onDelete: "cascade" }),
		role: text("role").notNull().$type<"user" | "assistant">(),
		content: text("content").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("chat_messages_session_idx").on(table.sessionDbId),
	],
);

// Workspace Versions - workflow versioning / change history
export const workspaceVersions = pgTable(
	"workspace_versions",
	{
		dbId: serial("db_id").primaryKey(),
		agentDbId: integer("agent_db_id")
			.notNull()
			.references(() => agents.dbId, { onDelete: "cascade" }),
		versionNumber: integer("version_number").notNull(),
		label: text("label"),
		snapshot: jsonb("snapshot").notNull(),
		createdByDbId: integer("created_by_db_id").references(() => users.dbId),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("workspace_versions_agent_idx").on(table.agentDbId),
	],
);

// Node Comments - per-node comment threads for collaboration
export const nodeComments = pgTable(
	"node_comments",
	{
		dbId: serial("db_id").primaryKey(),
		agentDbId: integer("agent_db_id")
			.notNull()
			.references(() => agents.dbId, { onDelete: "cascade" }),
		nodeId: text("node_id").notNull(),
		userDbId: integer("user_db_id").references(() => users.dbId),
		content: text("content").notNull(),
		resolved: boolean("resolved").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("node_comments_agent_node_idx").on(table.agentDbId, table.nodeId),
	],
);

// Workflow Templates - reusable workflow patterns / marketplace
export const workflowTemplates = pgTable(
	"workflow_templates",
	{
		dbId: serial("db_id").primaryKey(),
		name: text("name").notNull(),
		description: text("description"),
		category: text("category").notNull(),
		tags: text("tags").array().default([]).notNull(),
		snapshot: jsonb("snapshot").notNull(),
		thumbnailUrl: text("thumbnail_url"),
		authorDbId: integer("author_db_id").references(() => users.dbId),
		teamDbId: integer("team_db_id").references(() => teams.dbId),
		isPublic: boolean("is_public").default(true).notNull(),
		useCount: integer("use_count").default(0).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("workflow_templates_category_idx").on(table.category),
		index("workflow_templates_public_idx").on(table.isPublic),
	],
);

// Workspace Folders - hierarchical organization for workflows
export type WorkspaceFolderId = `wfld_${string}`;
export const workspaceFolders = pgTable(
	"workspace_folders",
	{
		id: text("id").$type<WorkspaceFolderId>().notNull().unique(),
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		name: text("name").notNull(),
		parentId: text("parent_id").$type<WorkspaceFolderId>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("workspace_folders_team_idx").on(table.teamDbId),
	],
);

export const workspaceFolderRelations = relations(
	workspaceFolders,
	({ one }) => ({
		team: one(teams, {
			fields: [workspaceFolders.teamDbId],
			references: [teams.dbId],
		}),
	}),
);

export const customNodes = pgTable(
	"custom_nodes",
	{
		dbId: serial("db_id").primaryKey(),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		name: text("name").notNull(),
		displayName: text("display_name").notNull(),
		description: text("description"),
		icon: text("icon").default("Box").notNull(),
		category: text("category").default("Custom").notNull(),
		version: text("version").default("1.0.0").notNull(),
		definition: jsonb("definition").notNull(),
		enabled: boolean("enabled").default(true).notNull(),
		createdByDbId: integer("created_by_db_id").references(() => users.dbId),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("custom_nodes_team_idx").on(table.teamDbId),
		index("custom_nodes_name_team_idx").on(table.name, table.teamDbId),
	],
);

// ====================================================================
// BUILDER APP HISTORY (Development session history)
// ====================================================================

export const builderAppHistory = pgTable(
	"builder_app_history",
	{
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		summary: text("summary").notNull(),
		details: jsonb("details").default({}),
		sessionType: text("session_type").default("generate"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("builder_app_history_app_idx").on(table.appDbId),
	],
);

export const builderAppHistoryRelations = relations(
	builderAppHistory,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppHistory.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

// ====================================================================
// BUILDER SUGGESTION TEMPLATES (Admin-managed smart suggestions)
// ====================================================================

export const builderSuggestionTemplates = pgTable(
	"builder_suggestion_templates",
	{
		dbId: serial("db_id").primaryKey(),
		label: text("label").notNull(),
		prompt: text("prompt").notNull(),
		icon: text("icon").default("sparkles"),
		category: text("category").default("general"),
		conditions: jsonb("conditions").default({}),
		priority: integer("priority").default(50),
		enabled: boolean("enabled").default(true).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
);

// ====================================================================
// BUILDER APP TEMPLATES (Publishable, cloneable app templates)
// ====================================================================

export const builderAppTemplates = pgTable(
	"builder_app_templates",
	{
		dbId: serial("db_id").primaryKey(),
		id: text("id").$type<BuilderAppTemplateId>().notNull().unique(),
		sourceAppDbId: integer("source_app_db_id").references(
			() => builderApps.dbId,
			{ onDelete: "set null" },
		),
		authorUserDbId: integer("author_user_db_id").references(
			() => users.dbId,
		),
		teamDbId: integer("team_db_id")
			.notNull()
			.references(() => teams.dbId, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		category: text("category").notNull().default("Other"),
		tags: text("tags")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		thumbnailUrl: text("thumbnail_url"),
		filesSnapshot: jsonb("files_snapshot").notNull(),
		schemaSnapshot: jsonb("schema_snapshot"),
		appConfig: jsonb("app_config").default({}),
		visibility: text("visibility").notNull().default("public"),
		featured: boolean("featured").notNull().default(false),
		status: text("status").notNull().default("active"),
		useCount: integer("use_count").notNull().default(0),
		fileCount: integer("file_count").notNull().default(0),
		entityCount: integer("entity_count").notNull().default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("builder_app_templates_team_db_id_idx").on(table.teamDbId),
		index("builder_app_templates_category_idx").on(table.category),
		index("builder_app_templates_visibility_idx").on(table.visibility),
		index("builder_app_templates_use_count_idx").on(table.useCount),
		index("builder_app_templates_status_idx").on(table.status),
	],
);

export const builderAppTemplateRelations = relations(
	builderAppTemplates,
	({ one }) => ({
		sourceApp: one(builderApps, {
			fields: [builderAppTemplates.sourceAppDbId],
			references: [builderApps.dbId],
		}),
		author: one(users, {
			fields: [builderAppTemplates.authorUserDbId],
			references: [users.dbId],
		}),
		team: one(teams, {
			fields: [builderAppTemplates.teamDbId],
			references: [teams.dbId],
		}),
	}),
);

export type BuilderAppTemplate = typeof builderAppTemplates.$inferSelect;
export type NewBuilderAppTemplate = typeof builderAppTemplates.$inferInsert;

// ====================================================================
// BUILDER APP FUNCTIONS (Serverless Backend Functions)
// ====================================================================

export const builderAppFunctions = pgTable(
	"builder_app_functions",
	{
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		name: text("name").notNull(),
		filePath: text("file_path").notNull(),
		triggerType: text("trigger_type").notNull(), // http | entity_hook | scheduled
		triggerConfig: jsonb("trigger_config").default({}),
		enabled: boolean("enabled").default(true).notNull(),
		timeoutMs: integer("timeout_ms").default(10000),
		lastRunAt: timestamp("last_run_at", { withTimezone: true }),
		runCount: integer("run_count").default(0).notNull(),
		errorCount: integer("error_count").default(0).notNull(),
		lastError: text("last_error"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		unique("builder_app_functions_app_name_idx").on(table.appDbId, table.name),
		index("builder_app_functions_app_db_id_idx").on(table.appDbId),
		index("builder_app_functions_trigger_type_idx").on(table.triggerType),
	],
);

export const builderAppFunctionRelations = relations(
	builderAppFunctions,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppFunctions.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

export type BuilderAppFunction = typeof builderAppFunctions.$inferSelect;

// ====================================================================
// BUILDER APP STORAGE SETTINGS (Per-app file storage configuration)
// ====================================================================

export const builderAppStorageSettings = pgTable("builder_app_storage_settings", {
	dbId: serial("db_id").primaryKey(),
	appDbId: integer("app_db_id")
		.notNull()
		.references(() => builderApps.dbId, { onDelete: "cascade" })
		.unique(),
	accessLevel: text("access_level").notNull().default("authenticated"),
	maxFileSizeMb: integer("max_file_size_mb").notNull().default(10),
	storageQuotaMb: integer("storage_quota_mb").notNull().default(500),
	usedStorageBytes: text("used_storage_bytes").notNull().default("0"),
	allowedTypes: text("allowed_types")
		.array()
		.default(["image/*", "application/pdf", "text/*"]),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const builderAppStorageSettingsRelations = relations(
	builderAppStorageSettings,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppStorageSettings.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);

// ====================================================================
// BUILDER APP SECRETS (Encrypted key-value store per app)
// ====================================================================

export const builderAppSecrets = pgTable(
	"builder_app_secrets",
	{
		dbId: serial("db_id").primaryKey(),
		appDbId: integer("app_db_id")
			.notNull()
			.references(() => builderApps.dbId, { onDelete: "cascade" }),
		key: text("key").notNull(),
		encryptedValue: text("encrypted_value").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		unique("builder_app_secrets_app_key_idx").on(table.appDbId, table.key),
	],
);

export const builderAppSecretRelations = relations(
	builderAppSecrets,
	({ one }) => ({
		app: one(builderApps, {
			fields: [builderAppSecrets.appDbId],
			references: [builderApps.dbId],
		}),
	}),
);
