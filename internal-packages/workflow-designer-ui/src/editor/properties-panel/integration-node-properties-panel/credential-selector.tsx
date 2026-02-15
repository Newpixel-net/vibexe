import type { IntegrationNode } from "@giselles-ai/protocol";
import { KeyIcon, LinkIcon, LoaderIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdateNodeDataContent } from "../../../app-designer";
import type { PieceAuthInfo } from "./use-piece-action-props";
import { CredentialForm } from "./credential-form";

interface CredentialOption {
	dbId: number;
	pieceName: string;
	displayName: string;
	authType: string;
}

interface OAuthStatus {
	available: boolean;
	provider?: string;
	displayName?: string;
	reason?: string;
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
	const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
	const [oauthConnecting, setOauthConnecting] = useState(false);
	const popupRef = useRef<Window | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

	// Check if one-click OAuth connect is available
	useEffect(() => {
		if (authInfo.type !== "OAUTH2") return;
		fetch(
			`/api/integrations/oauth2/status?pieceName=${encodeURIComponent(pieceName)}`,
		)
			.then(async (res) => {
				if (!res.ok) return;
				const data = (await res.json()) as OAuthStatus;
				setOauthStatus(data);
			})
			.catch(() => {});
	}, [pieceName, authInfo.type]);

	useEffect(() => {
		fetchCredentials();
	}, [fetchCredentials]);

	// Clean up popup poll on unmount
	useEffect(() => {
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

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

	const handleOAuthConnect = useCallback(() => {
		setOauthConnecting(true);

		// Open popup for OAuth flow
		const width = 600;
		const height = 700;
		const left = window.screenX + (window.outerWidth - width) / 2;
		const top = window.screenY + (window.outerHeight - height) / 2;

		const popup = window.open(
			`/api/integrations/oauth2/authorize?pieceName=${encodeURIComponent(pieceName)}`,
			"oauth2-connect",
			`width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
		);
		popupRef.current = popup;

		// Poll for popup close — use ref to avoid stale closure
		pollRef.current = setInterval(() => {
			const p = popupRef.current;
			if (!p || p.closed) {
				if (pollRef.current) clearInterval(pollRef.current);
				pollRef.current = null;
				popupRef.current = null;
				setOauthConnecting(false);
				// Refresh credentials - the callback should have created one
				fetchCredentials();
			}
		}, 500);
	}, [pieceName, fetchCredentials]);

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
						className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-inverse focus:outline-none focus:ring-1 focus:ring-integration-node-1 cursor-pointer [&>option]:bg-[#141120] [&>option]:text-white"
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

					{/* One-click OAuth connect button */}
					{oauthStatus?.available && (
						<button
							type="button"
							className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-integration-node-1/20 border border-integration-node-1/30 text-sm text-inverse hover:bg-integration-node-1/30 transition-colors disabled:opacity-50"
							onClick={handleOAuthConnect}
							disabled={oauthConnecting}
						>
							{oauthConnecting ? (
								<LoaderIcon className="size-3.5 animate-spin" />
							) : (
								<LinkIcon className="size-3.5" />
							)}
							{oauthConnecting
								? "Connecting..."
								: `Connect ${oauthStatus.displayName ?? pieceName}`}
						</button>
					)}

					<button
						type="button"
						className="flex items-center gap-1.5 text-xs text-text-muted hover:text-inverse transition-colors py-1"
						onClick={() => setShowForm(!showForm)}
					>
						<PlusIcon className="size-3" />
						{showForm ? "Cancel" : "Add credential manually"}
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
