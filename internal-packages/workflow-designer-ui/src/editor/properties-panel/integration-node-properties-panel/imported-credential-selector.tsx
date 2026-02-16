import type { IntegrationNode } from "@giselles-ai/protocol";
import { AlertTriangleIcon } from "lucide-react";
import { CredentialSelector } from "./credential-selector";
import { usePieceInspect } from "./use-piece-action-props";

interface CredentialHint {
	n8nCredentialType: string;
	n8nCredentialName: string;
	suggestedPiece: string | null;
}

/**
 * Credential selector for imported N8N nodes where the current piece (e.g. HTTP)
 * doesn't declare auth requirements, but the N8N workflow specified a credential type
 * (e.g. openAiApi). Shows a credential selector for the suggested piece's auth type.
 */
export function ImportedCredentialSelector({
	node,
	credentialHint,
}: {
	node: IntegrationNode;
	credentialHint: CredentialHint;
}) {
	const suggestedPiece = credentialHint.suggestedPiece;

	// Fetch the suggested piece's metadata to get its auth info
	const { data: suggestedPieceData, loading } = usePieceInspect(
		suggestedPiece ?? "",
	);

	if (!suggestedPiece) {
		return (
			<div className="flex items-center gap-2 text-xs text-yellow-400/70 py-1">
				<AlertTriangleIcon className="size-3 shrink-0" />
				<span>
					Requires {credentialHint.n8nCredentialName || credentialHint.n8nCredentialType} credential (no matching piece found)
				</span>
			</div>
		);
	}

	if (loading) return null;

	if (!suggestedPieceData?.auth) {
		return (
			<div className="flex items-center gap-2 text-xs text-yellow-400/70 py-1">
				<AlertTriangleIcon className="size-3 shrink-0" />
				<span>
					Requires {credentialHint.n8nCredentialName || suggestedPiece} credential
				</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 text-xs text-yellow-400/70">
				<AlertTriangleIcon className="size-3 shrink-0" />
				<span>
					Requires {suggestedPieceData.displayName || suggestedPiece} credential
				</span>
			</div>
			<CredentialSelector
				node={node}
				pieceName={suggestedPiece}
				authInfo={suggestedPieceData.auth}
			/>
		</div>
	);
}
