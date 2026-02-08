import type { IntegrationNode } from "@giselles-ai/protocol";
import { KeyIcon, LoaderIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useUpdateNodeDataContent } from "../../../app-designer";
import type { PieceAuthInfo } from "./use-piece-action-props";
import { CredentialForm } from "./credential-form";

interface CredentialOption {
	dbId: number;
	pieceName: string;
	displayName: string;
	authType: string;
}

export function CredentialSelector({
	node,
	pieceName,
	authInfo,
}: {
	node: IntegrationNode;
	pieceName: string;
	authInfo: PieceAuthInfo;
}) {
	const updateNodeDataContent = useUpdateNodeDataContent();
	const [credentials, setCredentials] = useState<CredentialOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);

	const fetchCredentials = useCallback(() => {
		setLoading(true);
		fetch(
			`/api/integrations/credentials?pieceName=${encodeURIComponent(pieceName)}`,
		)
			.then(async (res) => {
				if (!res.ok) return;
				const data = (await res.json()) as {
					credentials: CredentialOption[];
				};
				setCredentials(data.credentials);
			})
			.catch((err) => {
				console.error("Failed to fetch credentials:", err);
			})
			.finally(() => setLoading(false));
	}, [pieceName]);

	useEffect(() => {
		fetchCredentials();
	}, [fetchCredentials]);

	const handleSelect = useCallback(
		(credentialId: string) => {
			updateNodeDataContent(node, {
				credentialId: credentialId || undefined,
			});
		},
		[node, updateNodeDataContent],
	);

	const handleCredentialCreated = useCallback(
		(newCredential: CredentialOption) => {
			setCredentials((prev) => [...prev, newCredential]);
			updateNodeDataContent(node, {
				credentialId: String(newCredential.dbId),
			});
			setShowForm(false);
		},
		[node, updateNodeDataContent],
	);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-1.5">
				<KeyIcon className="size-3 text-text-muted" />
				<span className="text-xs text-text-muted">
					Authentication ({authInfo.type.replace(/_/g, " ").toLowerCase()})
				</span>
			</div>

			{loading ? (
				<div className="flex items-center gap-2 text-xs text-text-muted py-1">
					<LoaderIcon className="size-3 animate-spin" />
					Loading credentials...
				</div>
			) : (
				<div className="flex flex-col gap-2">
					<select
						className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-1 focus:ring-integration-node-1 cursor-pointer"
						value={node.content.credentialId ?? ""}
						onChange={(e) => handleSelect(e.target.value)}
					>
						<option value="">No credential selected</option>
						{credentials.map((cred) => (
							<option key={cred.dbId} value={String(cred.dbId)}>
								{cred.displayName}
							</option>
						))}
					</select>

					<button
						type="button"
						className="flex items-center gap-1.5 text-xs text-text-muted hover:text-inverse transition-colors py-1"
						onClick={() => setShowForm(!showForm)}
					>
						<PlusIcon className="size-3" />
						{showForm ? "Cancel" : "Add new credential"}
					</button>

					{showForm && (
						<CredentialForm
							pieceName={pieceName}
							authInfo={authInfo}
							onCreated={handleCredentialCreated}
							onCancel={() => setShowForm(false)}
						/>
					)}
				</div>
			)}
		</div>
	);
}
