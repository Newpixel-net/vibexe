import { LoaderIcon, SaveIcon } from "lucide-react";
import { useCallback, useState } from "react";
import type { PieceAuthInfo } from "./use-piece-action-props";

interface CredentialFormProps {
	pieceName: string;
	authInfo: PieceAuthInfo;
	onCreated: (credential: {
		dbId: number;
		pieceName: string;
		displayName: string;
		authType: string;
	}) => void;
	onCancel: () => void;
}

export function CredentialForm({
	pieceName,
	authInfo,
	onCreated,
	onCancel,
}: CredentialFormProps) {
	const [displayName, setDisplayName] = useState(
		`${pieceName} credential`,
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Dynamic fields based on auth type
	const [fields, setFields] = useState<Record<string, string>>({});

	const updateField = useCallback((key: string, value: string) => {
		setFields((prev) => ({ ...prev, [key]: value }));
	}, []);

	const handleSave = useCallback(async () => {
		setSaving(true);
		setError(null);

		try {
			// Build config based on auth type
			let authType: string;
			let config: Record<string, unknown>;

			switch (authInfo.type) {
				case "SECRET_TEXT":
					authType = "secret_text";
					config = {
						apiKey: fields.apiKey || fields.token || "",
					};
					break;
				case "BASIC_AUTH":
					authType = "basic";
					config = {
						username: fields.username || "",
						password: fields.password || "",
					};
					break;
				case "OAUTH2":
					authType = "oauth2";
					config = {
						accessToken: fields.accessToken || "",
						refreshToken: fields.refreshToken || "",
						tokenType: "Bearer",
					};
					break;
				case "CUSTOM_AUTH":
				default:
					authType = "custom";
					config = { ...fields };
					break;
			}

			const res = await fetch("/api/integrations/credentials", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pieceName,
					displayName,
					authType,
					config,
				}),
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(body.error ?? `HTTP ${res.status}`);
			}

			const data = (await res.json()) as {
				dbId: number;
				pieceName: string;
				displayName: string;
				authType: string;
			};
			onCreated(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	}, [pieceName, displayName, authInfo, fields, onCreated]);

	return (
		<div className="flex flex-col gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.02]">
			<div className="text-xs font-medium text-text-muted uppercase tracking-wider">
				New Credential
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="cred-name" className="text-xs text-text-muted">
					Display Name
				</label>
				<input
					id="cred-name"
					type="text"
					className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-action-node-1"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
				/>
			</div>

			{renderAuthFields(authInfo, fields, updateField)}

			{error && (
				<p className="text-xs text-red-400">{error}</p>
			)}

			<div className="flex gap-2 mt-1">
				<button
					type="button"
					className="flex-1 py-1.5 px-3 rounded-md bg-action-node-1 text-inverse text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
					onClick={handleSave}
					disabled={saving}
				>
					{saving ? (
						<LoaderIcon className="size-3 animate-spin" />
					) : (
						<SaveIcon className="size-3" />
					)}
					{saving ? "Saving..." : "Save"}
				</button>
				<button
					type="button"
					className="py-1.5 px-3 rounded-md border border-white/10 text-text-muted text-xs hover:text-inverse transition-colors"
					onClick={onCancel}
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

function renderAuthFields(
	authInfo: PieceAuthInfo,
	fields: Record<string, string>,
	updateField: (key: string, value: string) => void,
) {
	const inputClass =
		"w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-action-node-1";

	switch (authInfo.type) {
		case "SECRET_TEXT":
			return (
				<div className="flex flex-col gap-1">
					<label htmlFor="cred-api-key" className="text-xs text-text-muted">
						API Key / Token
					</label>
					<input
						id="cred-api-key"
						type="password"
						className={inputClass}
						placeholder="Enter API key or token"
						value={fields.apiKey ?? ""}
						onChange={(e) => updateField("apiKey", e.target.value)}
					/>
				</div>
			);

		case "BASIC_AUTH":
			return (
				<>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="cred-username"
							className="text-xs text-text-muted"
						>
							Username
						</label>
						<input
							id="cred-username"
							type="text"
							className={inputClass}
							placeholder="Username"
							value={fields.username ?? ""}
							onChange={(e) => updateField("username", e.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="cred-password"
							className="text-xs text-text-muted"
						>
							Password
						</label>
						<input
							id="cred-password"
							type="password"
							className={inputClass}
							placeholder="Password"
							value={fields.password ?? ""}
							onChange={(e) => updateField("password", e.target.value)}
						/>
					</div>
				</>
			);

		case "OAUTH2":
			return (
				<>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="cred-access-token"
							className="text-xs text-text-muted"
						>
							Access Token
						</label>
						<input
							id="cred-access-token"
							type="password"
							className={inputClass}
							placeholder="Enter access token"
							value={fields.accessToken ?? ""}
							onChange={(e) => updateField("accessToken", e.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="cred-refresh-token"
							className="text-xs text-text-muted"
						>
							Refresh Token (optional)
						</label>
						<input
							id="cred-refresh-token"
							type="password"
							className={inputClass}
							placeholder="Enter refresh token"
							value={fields.refreshToken ?? ""}
							onChange={(e) => updateField("refreshToken", e.target.value)}
						/>
					</div>
				</>
			);

		case "CUSTOM_AUTH":
		default:
			// Render fields based on auth schema props
			if (authInfo.props && Object.keys(authInfo.props).length > 0) {
				return (
					<>
						{Object.entries(authInfo.props).map(([key, prop]) => (
							<div key={key} className="flex flex-col gap-1">
								<label
									htmlFor={`cred-${key}`}
									className="text-xs text-text-muted"
								>
									{prop.displayName}
									{prop.required && (
										<span className="text-red-400 ml-0.5">*</span>
									)}
								</label>
								<input
									id={`cred-${key}`}
									type={
										prop.type === "SECRET_TEXT" ? "password" : "text"
									}
									className={inputClass}
									placeholder={prop.description || prop.displayName}
									value={fields[key] ?? ""}
									onChange={(e) => updateField(key, e.target.value)}
								/>
							</div>
						))}
					</>
				);
			}
			// Generic key-value for unknown auth types
			return (
				<div className="flex flex-col gap-1">
					<label htmlFor="cred-token" className="text-xs text-text-muted">
						Token / API Key
					</label>
					<input
						id="cred-token"
						type="password"
						className={inputClass}
						placeholder="Enter token or API key"
						value={fields.token ?? ""}
						onChange={(e) => updateField("token", e.target.value)}
					/>
				</div>
			);
	}
}
