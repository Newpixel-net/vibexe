import type { IntegrationNode } from "@giselles-ai/protocol";
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	KeyIcon,
	LoaderIcon,
	PencilIcon,
	PlusIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUpdateNodeDataContent } from "../../../app-designer";
import { SearchableSelect, type SelectOption } from "../ui/searchable-select";
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

	const selectedCredentialId = node.content.credentialId ?? "";

	const selectOptions: SelectOption[] = useMemo(
		() =>
			credentials.map((c) => ({
				label: c.displayName,
				value: String(c.dbId),
			})),
		[credentials],
	);

	const selectedCredential = credentials.find(
		(c) => String(c.dbId) === selectedCredentialId,
	);

	const handleDropdownChange = useCallback(
		(value: string) => {
			updateNodeDataContent(node, {
				credentialId: value || undefined,
			});
		},
		[node, updateNodeDataContent],
	);

	const handleCredentialSelected = useCallback(
		(credentialId: string) => {
			updateNodeDataContent(node, {
				credentialId: credentialId || undefined,
			});
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
			<div className="flex flex-col gap-[4px]">
				<div className="flex items-center justify-between">
					<label className="text-[12px] text-text-muted flex items-center gap-[4px]">
						<KeyIcon className="size-[11px]" />
						Credential
					</label>
					{selectedCredential && (
						<div className="flex items-center gap-[2px]">
							<button
								type="button"
								onClick={() => setShowModal(true)}
								className="p-[3px] text-text-muted/50 hover:text-inverse/70 transition-colors rounded-[3px] hover:bg-inverse/10"
								title="Edit credential"
							>
								<PencilIcon className="size-[11px]" />
							</button>
							<button
								type="button"
								onClick={handleRemove}
								className="p-[3px] text-text-muted/50 hover:text-red-400 transition-colors rounded-[3px] hover:bg-red-500/10"
								title="Remove credential"
							>
								<XIcon className="size-[11px]" />
							</button>
						</div>
					)}
				</div>

				<div className="flex items-center gap-[4px]">
					<div className="flex-1 min-w-0">
						{loading ? (
							<div className="flex items-center gap-[6px] rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text-muted">
								<LoaderIcon className="size-[11px] animate-spin" />
								Loading...
							</div>
						) : (
							<SearchableSelect
								options={selectOptions}
								value={selectedCredentialId}
								onChange={handleDropdownChange}
								placeholder="Select credential..."
								className="w-full"
							/>
						)}
					</div>
					<button
						type="button"
						onClick={() => setShowModal(true)}
						className="shrink-0 flex items-center justify-center size-[30px] rounded-[6px] border border-border-muted text-text-muted/60 hover:text-inverse hover:border-inverse/20 transition-colors"
						title={`Create new ${resolvedDisplayName} credential`}
					>
						<PlusIcon className="size-[14px]" />
					</button>
				</div>

				{/* Warning when no credential selected and piece requires auth */}
				{!selectedCredential && !loading && (
					<div className="flex items-center gap-[4px] text-[10px] text-yellow-400/70">
						<AlertTriangleIcon className="size-[10px] shrink-0" />
						<span>Required — select or create a credential</span>
					</div>
				)}

				{/* Connected indicator */}
				{selectedCredential && (
					<div className="flex items-center gap-[4px] text-[10px] text-emerald-400/70">
						<CheckCircle2Icon className="size-[10px] shrink-0" />
						<span>Connected</span>
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
