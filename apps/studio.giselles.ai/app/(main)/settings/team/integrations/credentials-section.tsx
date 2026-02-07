"use client";

import { KeyRoundIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface CredentialDisplay {
	dbId: number;
	pieceName: string;
	displayName: string;
	authType: string;
	createdAt: string;
}

export function CredentialsSection() {
	const [credentials, setCredentials] = useState<CredentialDisplay[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showAddForm, setShowAddForm] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchCredentials = useCallback(async () => {
		try {
			const response = await fetch("/api/integrations/credentials");
			if (response.ok) {
				const data = (await response.json()) as {
					credentials: CredentialDisplay[];
				};
				setCredentials(data.credentials);
			}
		} catch {
			console.error("Failed to fetch credentials");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchCredentials();
	}, [fetchCredentials]);

	const handleDelete = useCallback(
		async (credentialId: number) => {
			try {
				const response = await fetch(
					`/api/integrations/credentials/${credentialId}`,
					{
						method: "DELETE",
					},
				);
				if (response.ok) {
					await fetchCredentials();
				}
			} catch {
				console.error("Failed to delete credential");
			}
		},
		[fetchCredentials],
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-medium text-inverse">
					Third-Party Credentials
				</h2>
				<button
					type="button"
					className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-primary-900 text-inverse hover:bg-primary-800 transition-colors"
					onClick={() => setShowAddForm(!showAddForm)}
				>
					<PlusIcon className="size-4" />
					Add Credential
				</button>
			</div>

			{showAddForm && (
				<AddCredentialForm
					onSuccess={() => {
						setShowAddForm(false);
						fetchCredentials();
					}}
					onCancel={() => setShowAddForm(false)}
					error={error}
					setError={setError}
				/>
			)}

			{isLoading ? (
				<div className="text-sm text-text-muted">Loading credentials...</div>
			) : credentials.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-8 text-text-muted">
					<KeyRoundIcon className="size-8 opacity-50" />
					<p className="text-sm">No credentials configured yet</p>
					<p className="text-xs">
						Add API keys for Slack, Google Sheets, and other integrations
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{credentials.map((cred) => (
						<div
							key={cred.dbId}
							className="flex items-center justify-between p-3 rounded-lg bg-bg-900/50 border border-white/5"
						>
							<div className="flex items-center gap-3">
								<KeyRoundIcon className="size-4 text-text-muted" />
								<div>
									<div className="text-sm font-medium text-inverse">
										{cred.displayName}
									</div>
									<div className="text-xs text-text-muted">
										{cred.pieceName} &middot; {cred.authType}
									</div>
								</div>
							</div>
							<button
								type="button"
								className="p-1.5 text-text-muted hover:text-error-500 transition-colors"
								onClick={() => handleDelete(cred.dbId)}
							>
								<Trash2Icon className="size-4" />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function AddCredentialForm({
	onSuccess,
	onCancel,
	error,
	setError,
}: {
	onSuccess: () => void;
	onCancel: () => void;
	error: string | null;
	setError: (error: string | null) => void;
}) {
	const [pieceName, setPieceName] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [authType, setAuthType] = useState("secret_text");
	const [apiKey, setApiKey] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			const config: Record<string, unknown> = {};
			switch (authType) {
				case "secret_text":
					config.apiKey = apiKey;
					break;
				case "oauth2":
					config.accessToken = apiKey;
					break;
				case "basic":
					config.password = apiKey;
					break;
				default:
					config.apiKey = apiKey;
			}

			const response = await fetch("/api/integrations/credentials", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pieceName,
					displayName: displayName || pieceName,
					authType,
					config,
				}),
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? "Failed to create credential");
			}

			onSuccess();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create credential",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col gap-3 p-4 rounded-lg bg-bg-900/50 border border-white/5"
		>
			<div className="flex flex-col gap-1.5">
				<label htmlFor="piece-name" className="text-xs text-text-muted">
					Piece Name
				</label>
				<select
					id="piece-name"
					value={pieceName}
					onChange={(e) => setPieceName(e.target.value)}
					className="px-3 py-1.5 text-sm rounded-lg bg-bg-900 border border-white/10 text-inverse"
					required
				>
					<option value="">Select a piece...</option>
					<option value="slack">Slack</option>
					<option value="google-sheets">Google Sheets</option>
					<option value="gmail">Gmail</option>
					<option value="discord">Discord</option>
					<option value="telegram-bot">Telegram</option>
					<option value="notion">Notion</option>
					<option value="airtable">Airtable</option>
					<option value="stripe">Stripe</option>
					<option value="hubspot">HubSpot</option>
					<option value="http">HTTP (Generic)</option>
					<option value="openai">OpenAI</option>
					<option value="google-drive">Google Drive</option>
					<option value="google-calendar">Google Calendar</option>
					<option value="dropbox">Dropbox</option>
					<option value="mailchimp">Mailchimp</option>
					<option value="twitter">Twitter/X</option>
					<option value="linkedin">LinkedIn</option>
					<option value="zoom">Zoom</option>
				</select>
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor="display-name" className="text-xs text-text-muted">
					Display Name (optional)
				</label>
				<input
					id="display-name"
					type="text"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
					placeholder="My Slack Token"
					className="px-3 py-1.5 text-sm rounded-lg bg-bg-900 border border-white/10 text-inverse placeholder:text-text-muted"
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor="auth-type" className="text-xs text-text-muted">
					Auth Type
				</label>
				<select
					id="auth-type"
					value={authType}
					onChange={(e) => setAuthType(e.target.value)}
					className="px-3 py-1.5 text-sm rounded-lg bg-bg-900 border border-white/10 text-inverse"
				>
					<option value="secret_text">API Key / Token</option>
					<option value="oauth2">OAuth2 Access Token</option>
					<option value="basic">Basic Auth</option>
					<option value="custom">Custom</option>
				</select>
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor="api-key" className="text-xs text-text-muted">
					{authType === "basic" ? "Password" : "API Key / Token"}
				</label>
				<input
					id="api-key"
					type="password"
					value={apiKey}
					onChange={(e) => setApiKey(e.target.value)}
					placeholder="Enter your API key or token"
					className="px-3 py-1.5 text-sm rounded-lg bg-bg-900 border border-white/10 text-inverse placeholder:text-text-muted"
					required
				/>
			</div>

			{error && (
				<p className="text-sm text-error-500" role="alert">
					{error}
				</p>
			)}

			<div className="flex gap-2 justify-end">
				<button
					type="button"
					className="px-3 py-1.5 text-sm rounded-lg text-text-muted hover:text-inverse transition-colors"
					onClick={onCancel}
				>
					Cancel
				</button>
				<button
					type="submit"
					className="px-3 py-1.5 text-sm rounded-lg bg-primary-900 text-inverse hover:bg-primary-800 transition-colors disabled:opacity-50"
					disabled={isSubmitting}
				>
					{isSubmitting ? "Saving..." : "Save Credential"}
				</button>
			</div>
		</form>
	);
}
