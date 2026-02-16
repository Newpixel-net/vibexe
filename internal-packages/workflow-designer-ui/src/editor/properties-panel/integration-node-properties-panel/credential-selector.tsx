import type { IntegrationNode } from "@giselles-ai/protocol";
import {
	CheckCircle2Icon,
	KeyIcon,
	LoaderIcon,
	PencilIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useUpdateNodeDataContent } from "../../../app-designer";
import { CredentialConfigModal } from "./credential-config-modal";
import type { PieceAuthInfo } from "./use-piece-action-props";

interface CredentialOption {
	dbId: number;
	pieceName: string;
	displayName: string;
	authType: string;
}

export function CredentialSelector({
	node,
	pieceName,
	pieceDisplayName,
	pieceDescription,
	authInfo,
}: {
	node: IntegrationNode;
	pieceName: string;
	pieceDisplayName?: string;
	pieceDescription?: string;
	authInfo: PieceAuthInfo;
}) {
	const updateNodeDataContent = useUpdateNodeDataContent();
	const [credentials, setCredentials] = useState<CredentialOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [showModal, setShowModal] = useState(false);

	const fetchCredentials = useCallback(
		(signal?: AbortSignal) => {
			setLoading(true);
			fetch(
				`/api/integrations/credentials?pieceName=${encodeURIComponent(pieceName)}`,
				{ signal },
			)
				.then(async (res) => {
					if (!res.ok) return;
					const data = (await res.json()) as {
						credentials: CredentialOption[];
					};
					if (!signal?.aborted) setCredentials(data.credentials);
				})
				.catch((err) => {
					if (signal?.aborted) return;
					console.error("Failed to fetch credentials:", err);
				})
				.finally(() => {
					if (!signal?.aborted) setLoading(false);
				});
		},
		[pieceName],
	);

	useEffect(() => {
		const controller = new AbortController();
		fetchCredentials(controller.signal);
		return () => controller.abort();
	}, [fetchCredentials]);

	const selectedCredential = credentials.find(
		(c) => String(c.dbId) === node.content.credentialId,
	);

	const handleCredentialSelected = useCallback(
		(credentialId: string) => {
			updateNodeDataContent(node, {
				credentialId: credentialId || undefined,
			});
			// Refresh credential list
			fetchCredentials();
			setShowModal(false);
		},
		[node, updateNodeDataContent, fetchCredentials],
	);

	const handleRemove = useCallback(() => {
		updateNodeDataContent(node, {
			credentialId: undefined,
		});
	}, [node, updateNodeDataContent]);

	const resolvedDisplayName = pieceDisplayName || pieceName;

	return (
		<>
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-1.5">
					<KeyIcon className="size-3 text-text-muted" />
					<span className="text-xs text-text-muted">
						Authentication (
						{authInfo.type.replace(/_/g, " ").toLowerCase()})
					</span>
				</div>

				{loading ? (
					<div className="flex items-center gap-2 text-xs text-text-muted py-1">
						<LoaderIcon className="size-3 animate-spin" />
						Loading credentials...
					</div>
				) : selectedCredential ? (
					/* ── Connected state ── */
					<div className="flex flex-col gap-2 p-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20">
						<div className="flex items-center gap-2">
							<CheckCircle2Icon className="size-4 text-emerald-400 shrink-0" />
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-emerald-300 truncate">
									{selectedCredential.displayName}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setShowModal(true)}
								className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors"
							>
								<PencilIcon className="size-3" />
								Change
							</button>
							<button
								type="button"
								onClick={handleRemove}
								className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
							>
								<XIcon className="size-3" />
								Remove
							</button>
						</div>
					</div>
				) : (
					/* ── Not connected state ── */
					<div className="flex flex-col gap-2">
						<button
							type="button"
							onClick={() => setShowModal(true)}
							className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-lg bg-integration-node-1/20 border border-integration-node-1/30 text-sm text-inverse hover:bg-integration-node-1/30 transition-colors"
						>
							<KeyIcon className="size-3.5" />
							Set up {resolvedDisplayName} credential
						</button>
					</div>
				)}
			</div>

			{showModal && (
				<CredentialConfigModal
					pieceName={pieceName}
					pieceDisplayName={resolvedDisplayName}
					pieceDescription={pieceDescription}
					authInfo={authInfo}
					existingCredentialId={node.content.credentialId}
					onClose={() => setShowModal(false)}
					onCredentialSelected={handleCredentialSelected}
				/>
			)}
		</>
	);
}
