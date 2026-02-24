import type { NextRequest } from "next/server";
import type { WorkspaceId } from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";
import { db, agents, workspaceVersions, users } from "@/db";
import { eq, and, desc, max, lt, sql } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";
import { getCurrentUser } from "@/lib/get-current-user";

export const dynamic = "force-dynamic";

const MAX_VERSIONS = 50;

interface SnapshotLike {
	nodes?: unknown[];
	connections?: unknown[];
	stickyNotes?: unknown[];
}

function extractSnapshotMeta(snapshot: unknown) {
	const s = snapshot as SnapshotLike | null;
	const nodes = Array.isArray(s?.nodes) ? s.nodes : [];
	const connections = Array.isArray(s?.connections) ? s.connections : [];
	const stickyNotes = Array.isArray(s?.stickyNotes) ? s.stickyNotes : [];

	// Build a summary of node types for diff
	const nodeTypes: Record<string, number> = {};
	const nodeNames: string[] = [];
	for (const node of nodes) {
		const n = node as { content?: { type?: string }; name?: string };
		const type = n?.content?.type ?? "unknown";
		nodeTypes[type] = (nodeTypes[type] ?? 0) + 1;
		if (n?.name) nodeNames.push(n.name);
	}

	return {
		nodeCount: nodes.length,
		connectionCount: connections.length,
		stickyNoteCount: stickyNotes.length,
		nodeTypes,
		nodeNames: nodeNames.slice(0, 20), // Limit to 20 for response size
	};
}

/**
 * GET /api/workspaces/[workspaceId]/versions
 *
 * List all saved versions for this workspace, including node/connection counts.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();

		// Find the agent for this workspace
		const [agent] = await db
			.select({ dbId: agents.dbId })
			.from(agents)
			.where(
				and(
					eq(agents.workspaceId, workspaceId as WorkspaceId),
					eq(agents.teamDbId, currentTeam.dbId),
				),
			)
			.limit(1);

		if (!agent) {
			return Response.json({ error: "Workspace not found" }, { status: 404 });
		}

		const rows = await db
			.select({
				dbId: workspaceVersions.dbId,
				versionNumber: workspaceVersions.versionNumber,
				label: workspaceVersions.label,
				snapshot: workspaceVersions.snapshot,
				createdAt: workspaceVersions.createdAt,
				createdByName: users.displayName,
				createdByAvatar: users.avatarUrl,
			})
			.from(workspaceVersions)
			.leftJoin(users, eq(workspaceVersions.createdByDbId, users.dbId))
			.where(eq(workspaceVersions.agentDbId, agent.dbId))
			.orderBy(desc(workspaceVersions.versionNumber));

		// Extract metadata from snapshots, don't send full snapshots in list
		const versions = rows.map((row) => {
			const meta = extractSnapshotMeta(row.snapshot);
			return {
				dbId: row.dbId,
				versionNumber: row.versionNumber,
				label: row.label,
				createdAt: row.createdAt,
				createdByName: row.createdByName,
				createdByAvatar: row.createdByAvatar,
				nodeCount: meta.nodeCount,
				connectionCount: meta.connectionCount,
				stickyNoteCount: meta.stickyNoteCount,
				nodeTypes: meta.nodeTypes,
				nodeNames: meta.nodeNames,
			};
		});

		return Response.json({ versions });
	} catch (err) {
		console.error("[Versions] Error listing versions:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/workspaces/[workspaceId]/versions
 * Body: { label?: string, auto?: boolean }
 *
 * Create a new version snapshot of the current workspace.
 * - Deduplicates: skips if node/connection counts match latest version
 * - Retention: keeps only the last 50 versions, pruning older ones
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();
		const user = await getCurrentUser();
		const body = await request.json().catch(() => ({}));
		const label = typeof body.label === "string" ? body.label : null;
		const isAuto = body.auto === true;

		// Find the agent for this workspace
		const [agent] = await db
			.select({ dbId: agents.dbId, name: agents.name })
			.from(agents)
			.where(
				and(
					eq(agents.workspaceId, workspaceId as WorkspaceId),
					eq(agents.teamDbId, currentTeam.dbId),
				),
			)
			.limit(1);

		if (!agent) {
			return Response.json({ error: "Workspace not found" }, { status: 404 });
		}

		// Get current workspace state as snapshot
		const workspace = await vibexe.getWorkspace(workspaceId as WorkspaceId);
		if (!workspace) {
			return Response.json({ error: "Workspace data not found" }, { status: 404 });
		}

		// Deduplication: compare with latest version
		if (isAuto) {
			const [latestVersion] = await db
				.select({ snapshot: workspaceVersions.snapshot })
				.from(workspaceVersions)
				.where(eq(workspaceVersions.agentDbId, agent.dbId))
				.orderBy(desc(workspaceVersions.versionNumber))
				.limit(1);

			if (latestVersion) {
				const currentMeta = extractSnapshotMeta(workspace);
				const latestMeta = extractSnapshotMeta(latestVersion.snapshot);

				// Skip if no structural changes (same node + connection counts)
				if (
					currentMeta.nodeCount === latestMeta.nodeCount &&
					currentMeta.connectionCount === latestMeta.connectionCount &&
					currentMeta.stickyNoteCount === latestMeta.stickyNoteCount
				) {
					return Response.json(
						{ skipped: true, reason: "No structural changes" },
						{ status: 200 },
					);
				}
			}
		}

		// Get next version number
		const [maxVersion] = await db
			.select({ maxNum: max(workspaceVersions.versionNumber) })
			.from(workspaceVersions)
			.where(eq(workspaceVersions.agentDbId, agent.dbId));

		const nextVersionNumber = (maxVersion?.maxNum ?? 0) + 1;

		const versionLabel = label
			? label
			: isAuto
				? `Auto-save #${nextVersionNumber}`
				: `Version ${nextVersionNumber}`;

		const [created] = await db
			.insert(workspaceVersions)
			.values({
				agentDbId: agent.dbId,
				versionNumber: nextVersionNumber,
				label: versionLabel,
				snapshot: workspace,
				createdByDbId: user?.dbId ?? null,
			})
			.returning({
				dbId: workspaceVersions.dbId,
				versionNumber: workspaceVersions.versionNumber,
				label: workspaceVersions.label,
				createdAt: workspaceVersions.createdAt,
			});

		// Retention policy: keep only the last MAX_VERSIONS versions
		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(workspaceVersions)
			.where(eq(workspaceVersions.agentDbId, agent.dbId));

		const totalCount = Number(countResult?.count ?? 0);
		if (totalCount > MAX_VERSIONS) {
			// Find the version number threshold (keep top MAX_VERSIONS)
			const [threshold] = await db
				.select({ versionNumber: workspaceVersions.versionNumber })
				.from(workspaceVersions)
				.where(eq(workspaceVersions.agentDbId, agent.dbId))
				.orderBy(desc(workspaceVersions.versionNumber))
				.limit(1)
				.offset(MAX_VERSIONS - 1);

			if (threshold) {
				await db
					.delete(workspaceVersions)
					.where(
						and(
							eq(workspaceVersions.agentDbId, agent.dbId),
							lt(workspaceVersions.versionNumber, threshold.versionNumber),
						),
					);
			}
		}

		return Response.json({ version: created }, { status: 201 });
	} catch (err) {
		console.error("[Versions] Error creating version:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
