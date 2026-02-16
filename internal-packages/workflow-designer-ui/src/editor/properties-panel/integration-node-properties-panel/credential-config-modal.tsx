import {
	CheckCircle2Icon,
	ChevronDownIcon,
	ChevronUpIcon,
	ExternalLinkIcon,
	KeyRoundIcon,
	LinkIcon,
	LogOutIcon,
	RefreshCwIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PieceAuthInfo } from "./use-piece-action-props";

// ─── Types ─────────────────────────────────────────────

interface CredentialOption {
	dbId: number;
	pieceName: string;
	displayName: string;
	authType: string;
	createdAt?: string;
}

interface OAuthStatus {
	available: boolean;
	provider?: string;
	displayName?: string;
	reason?: string;
}

export interface CredentialConfigModalProps {
	pieceName: string;
	pieceDisplayName: string;
	pieceDescription?: string;
	authInfo: PieceAuthInfo;
	existingCredentialId?: string;
	onClose: () => void;
	onCredentialSelected: (credentialId: string) => void;
}

// ─── API Key Setup Links ────────────────────────────────

const API_KEY_LINKS: Record<
	string,
	{ url: string; label: string; description: string }
> = {
	"google-gemini": {
		url: "https://aistudio.google.com/apikey",
		label: "Get API key from Google AI Studio",
		description: "Create a free Gemini API key in Google AI Studio",
	},
	"google-search": {
		url: "https://developers.google.com/custom-search/v1/overview",
		label: "Get Custom Search API key",
		description: "Create a Custom Search JSON API key + Search Engine ID",
	},
	"gcloud-pubsub": {
		url: "https://console.cloud.google.com/apis/credentials",
		label: "Get credentials from Google Cloud",
		description:
			"Create a service account key or API key in Google Cloud Console",
	},
	openai: {
		url: "https://platform.openai.com/api-keys",
		label: "Get API key from OpenAI",
		description: "Create an API key in your OpenAI dashboard",
	},
	anthropic: {
		url: "https://console.anthropic.com/settings/keys",
		label: "Get API key from Anthropic",
		description: "Create an API key in the Anthropic Console",
	},
	discord: {
		url: "https://discord.com/developers/applications",
		label: "Get Bot Token from Discord",
		description: "Create a bot and copy the token from Developer Portal",
	},
	"telegram-bot": {
		url: "https://t.me/BotFather",
		label: "Get Bot Token from BotFather",
		description: "Message @BotFather on Telegram to create a bot token",
	},
	twilio: {
		url: "https://console.twilio.com/",
		label: "Get credentials from Twilio",
		description:
			"Find your Account SID and Auth Token in the Twilio Console",
	},
	sendgrid: {
		url: "https://app.sendgrid.com/settings/api_keys",
		label: "Get API key from SendGrid",
		description: "Create an API key in SendGrid Settings",
	},
	stripe: {
		url: "https://dashboard.stripe.com/apikeys",
		label: "Get API key from Stripe",
		description: "Copy your secret key from the Stripe Dashboard",
	},
};

// ─── Piece Icon ─────────────────────────────────────────

function PieceLetterIcon({
	displayName,
	size = 40,
}: { displayName: string; size?: number }) {
	return (
		<div
			className="rounded-lg flex items-center justify-center font-semibold bg-white/10 text-white/60"
			style={{ width: size, height: size, fontSize: size * 0.4 }}
		>
			{displayName.charAt(0).toUpperCase()}
		</div>
	);
}

// ─── Relative Time ──────────────────────────────────────

function relativeTime(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

// ─── Modal Component ────────────────────────────────────

export function CredentialConfigModal({
	pieceName,
	pieceDisplayName,
	pieceDescription,
	authInfo,
	existingCredentialId,
	onClose,
	onCredentialSelected,
}: CredentialConfigModalProps) {
	const isOAuth2 = authInfo.type === "OAUTH2" || authInfo.type === "oauth2";
	const isNoneAuth = authInfo.type === "NONE" || authInfo.type === "none";

	// Credential list
	const [credentials, setCredentials] = useState<CredentialOption[]>([]);
	const [loadingCreds, setLoadingCreds] = useState(true);

	// Find existing credential
	const existingCredential = credentials.find(
		(c) => String(c.dbId) === existingCredentialId,
	);
	const isConnected = !!existingCredential;

	// Form state
	const [displayName, setDisplayName] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [username, setUsername] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// UI state
	const [showManualEntry, setShowManualEntry] = useState(
		!isOAuth2 && !isNoneAuth && !isConnected,
	);
	const [showReconnect, setShowReconnect] = useState(false);
	const [confirmDisconnect, setConfirmDisconnect] = useState(false);
	const [isDisconnecting, setIsDisconnecting] = useState(false);

	// OAuth state
	const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
	const [oauthChecking, setOauthChecking] = useState(isOAuth2);
	const [oauthConnecting, setOauthConnecting] = useState(false);
	const popupRef = useRef<Window | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const modalRef = useRef<HTMLDivElement>(null);

	// Resolve auth type for API
	const resolvedAuthType = (() => {
		const typeMap: Record<string, string> = {
			SECRET_TEXT: "secret_text",
			secret_text: "secret_text",
			api_key: "secret_text",
			OAUTH2: "oauth2",
			oauth2: "oauth2",
			BASIC_AUTH: "basic",
			basic: "basic",
			CUSTOM_AUTH: "custom",
			custom: "custom",
			NONE: "none",
			none: "none",
		};
		return typeMap[authInfo.type] || "secret_text";
	})();

	// ─── Fetch credentials ──────────────────────────────

	const fetchCredentials = useCallback(
		(signal?: AbortSignal) => {
			setLoadingCreds(true);
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
					if (!signal?.aborted) setLoadingCreds(false);
				});
		},
		[pieceName],
	);

	useEffect(() => {
		const controller = new AbortController();
		fetchCredentials(controller.signal);
		return () => controller.abort();
	}, [fetchCredentials]);

	// ─── Check OAuth2 availability ──────────────────────

	useEffect(() => {
		if (!isOAuth2) return;
		let cancelled = false;

		(async () => {
			try {
				const res = await fetch(
					`/api/integrations/oauth2/status?pieceName=${encodeURIComponent(pieceName)}`,
				);
				if (!cancelled && res.ok) {
					const data = (await res.json()) as OAuthStatus;
					setOauthStatus(data);
					if (!data.available && !isConnected) setShowManualEntry(true);
				}
			} catch {
				if (!cancelled) {
					setOauthStatus({
						available: false,
						reason: "Failed to check OAuth status",
					});
					if (!isConnected) setShowManualEntry(true);
				}
			} finally {
				if (!cancelled) setOauthChecking(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [isOAuth2, pieceName, isConnected]);

	// ─── Close handlers ─────────────────────────────────

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (
				modalRef.current &&
				!modalRef.current.contains(e.target as Node)
			) {
				onClose();
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onClose]);

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [onClose]);

	// Clean up popup poll on unmount
	useEffect(() => {
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	// Update showManualEntry when connection state changes
	useEffect(() => {
		if (!isOAuth2 && !isNoneAuth && !isConnected) {
			setShowManualEntry(true);
		}
	}, [isOAuth2, isNoneAuth, isConnected]);

	// ─── OAuth connect ──────────────────────────────────

	const handleOAuthConnect = useCallback(() => {
		setOauthConnecting(true);
		setError(null);

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

		if (!popup) {
			setError("Popup was blocked. Please allow popups for this site.");
			setOauthConnecting(false);
			return;
		}

		pollRef.current = setInterval(() => {
			const p = popupRef.current;
			if (!p || p.closed) {
				if (pollRef.current) clearInterval(pollRef.current);
				pollRef.current = null;
				popupRef.current = null;
				setOauthConnecting(false);
				// Refresh credentials and auto-select the newest one
				fetch(
					`/api/integrations/credentials?pieceName=${encodeURIComponent(pieceName)}`,
				)
					.then(async (res) => {
						if (!res.ok) return;
						const data = (await res.json()) as {
							credentials: CredentialOption[];
						};
						setCredentials(data.credentials);
						// Auto-select the newest credential (highest dbId)
						if (data.credentials.length > 0) {
							const newest = data.credentials.reduce((a, b) =>
								a.dbId > b.dbId ? a : b,
							);
							onCredentialSelected(String(newest.dbId));
						}
					})
					.catch(() => {});
			}
		}, 500);
	}, [pieceName, onCredentialSelected]);

	// ─── Disconnect ─────────────────────────────────────

	const handleDisconnect = useCallback(async () => {
		if (!existingCredential) return;
		setIsDisconnecting(true);
		setError(null);
		try {
			const res = await fetch(
				`/api/integrations/credentials/${existingCredential.dbId}`,
				{ method: "DELETE" },
			);
			if (!res.ok) throw new Error("Failed to disconnect");
			onCredentialSelected("");
		} catch {
			setError("Failed to disconnect. Please try again.");
		} finally {
			setIsDisconnecting(false);
			setConfirmDisconnect(false);
		}
	}, [existingCredential, onCredentialSelected]);

	// ─── Save credential ────────────────────────────────

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setIsSubmitting(true);
			setError(null);

			try {
				const config: Record<string, unknown> = {};

				if (
					authInfo.type === "CUSTOM_AUTH" ||
					authInfo.type === "custom"
				) {
					// Use dynamic fields
					Object.assign(config, fields);
				} else {
					switch (resolvedAuthType) {
						case "secret_text":
							config.apiKey = apiKey;
							break;
						case "oauth2":
							config.accessToken = apiKey;
							break;
						case "basic":
							config.username = username;
							config.password = apiKey;
							break;
						default:
							config.apiKey = apiKey;
					}
				}

				const response = await fetch("/api/integrations/credentials", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						pieceName,
						displayName:
							displayName || `My ${pieceDisplayName} Token`,
						authType: resolvedAuthType,
						config,
					}),
				});

				if (!response.ok) {
					const data = (await response.json()) as {
						error?: string;
					};
					throw new Error(
						data.error ?? "Failed to create credential",
					);
				}

				const data = (await response.json()) as { dbId: number };
				onCredentialSelected(String(data.dbId));
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: "Failed to create credential",
				);
			} finally {
				setIsSubmitting(false);
			}
		},
		[
			pieceName,
			pieceDisplayName,
			displayName,
			apiKey,
			username,
			fields,
			authInfo.type,
			resolvedAuthType,
			onCredentialSelected,
		],
	);

	// ─── Render ─────────────────────────────────────────

	const connectedAgo =
		existingCredential?.createdAt
			? relativeTime(existingCredential.createdAt)
			: null;

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div
				ref={modalRef}
				className="w-full max-w-md mx-4 rounded-xl bg-[rgb(20,17,32)] border border-white/10 shadow-2xl"
			>
				{/* Header */}
				<div className="flex items-center gap-3 p-5 border-b border-white/[0.06]">
					<PieceLetterIcon displayName={pieceDisplayName} size={40} />
					<div className="flex-1 min-w-0">
						<div className="text-base font-medium text-white truncate">
							{pieceDisplayName}
						</div>
						{pieceDescription && (
							<div className="text-xs text-white/40 mt-0.5 line-clamp-1">
								{pieceDescription}
							</div>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1 text-white/40 hover:text-white transition-colors"
					>
						<XIcon className="size-4" />
					</button>
				</div>

				<div className="p-5 flex flex-col gap-4">
					{/* Loading state */}
					{loadingCreds && (
						<div className="flex items-center justify-center gap-2 py-6 text-white/40">
							<div className="size-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
							<span className="text-sm">
								Loading credentials...
							</span>
						</div>
					)}

					{/* ─── Connected State ────────────────────────── */}
					{!loadingCreds && isConnected && !showReconnect && (
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-3 p-4 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20">
								<div className="flex items-center gap-2.5">
									<CheckCircle2Icon className="size-5 text-emerald-400 shrink-0" />
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-emerald-300">
											Connected
										</p>
										<p className="text-xs text-white/40 mt-0.5">
											{existingCredential.displayName}
											{connectedAgo && (
												<span className="text-white/25">
													{" "}
													&middot; {connectedAgo}
												</span>
											)}
										</p>
									</div>
									<span className="px-2 py-0.5 text-[10px] rounded-full bg-white/5 text-white/40 border border-white/[0.06]">
										{existingCredential.authType}
									</span>
								</div>
							</div>

							<div className="flex flex-col gap-2">
								{isOAuth2 && (
									<button
										type="button"
										onClick={() => setShowReconnect(true)}
										className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-lg bg-white/5 border border-white/[0.08] text-white/60 hover:text-white hover:border-white/15 transition-colors"
									>
										<RefreshCwIcon className="size-3.5" />
										Reconnect with different account
									</button>
								)}

								{confirmDisconnect ? (
									<div className="flex flex-col gap-2 p-3 rounded-lg bg-red-500/[0.08] border border-red-500/20">
										<p className="text-xs text-red-300">
											This will remove your{" "}
											{pieceDisplayName} credentials.
											Workflows using this integration
											will stop working.
										</p>
										<div className="flex gap-2 justify-end">
											<button
												type="button"
												onClick={() =>
													setConfirmDisconnect(false)
												}
												className="px-3 py-1.5 text-xs rounded-lg text-white/50 hover:text-white transition-colors"
											>
												Cancel
											</button>
											<button
												type="button"
												onClick={handleDisconnect}
												disabled={isDisconnecting}
												className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
											>
												{isDisconnecting
													? "Disconnecting..."
													: "Yes, disconnect"}
											</button>
										</div>
									</div>
								) : (
									<button
										type="button"
										onClick={() =>
											setConfirmDisconnect(true)
										}
										className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
									>
										<LogOutIcon className="size-3.5" />
										Disconnect
									</button>
								)}
							</div>

							{error && (
								<p className="text-sm text-red-400" role="alert">
									{error}
								</p>
							)}

							<div className="flex justify-end pt-1">
								<button
									type="button"
									onClick={onClose}
									className="px-4 py-2 text-sm rounded-lg text-white/50 hover:text-white transition-colors"
								>
									Done
								</button>
							</div>
						</div>
					)}

					{/* ─── Not Connected / Reconnect Flow ────────── */}
					{!loadingCreds && (!isConnected || showReconnect) && (
						<>
							{showReconnect && (
								<button
									type="button"
									onClick={() => setShowReconnect(false)}
									className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors -mt-1 mb-1"
								>
									<ChevronDownIcon className="size-3 rotate-90" />
									Back to connection status
								</button>
							)}

							{/* Existing credentials dropdown (quick switch) */}
							{!showReconnect && credentials.length > 0 && (
								<div className="flex flex-col gap-1.5">
									<label className="text-xs text-white/50">
										Existing credentials
									</label>
									<select
										className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25 cursor-pointer [&>option]:bg-[#141120] [&>option]:text-white"
										value={existingCredentialId ?? ""}
										onChange={(e) => {
											if (e.target.value) {
												onCredentialSelected(
													e.target.value,
												);
											}
										}}
									>
										<option value="">
											Select existing credential...
										</option>
										{credentials.map((cred) => (
											<option
												key={cred.dbId}
												value={String(cred.dbId)}
											>
												{cred.displayName}
											</option>
										))}
									</select>
									<div className="flex items-center gap-3 py-1">
										<div className="flex-1 h-px bg-white/[0.08]" />
										<span className="text-[11px] text-white/30 uppercase tracking-wider">
											or create new
										</span>
										<div className="flex-1 h-px bg-white/[0.08]" />
									</div>
								</div>
							)}

							{/* No Auth Needed */}
							{isNoneAuth && (
								<div className="flex flex-col gap-4">
									<div className="flex flex-col gap-2 p-4 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20">
										<div className="flex items-start gap-2.5">
											<CheckCircle2Icon className="size-5 text-emerald-400 shrink-0 mt-0.5" />
											<div>
												<p className="text-sm font-medium text-emerald-300">
													No credentials required
												</p>
												<p className="text-xs text-white/40 mt-1">
													{pieceDisplayName} works
													without any API keys or
													authentication.
												</p>
											</div>
										</div>
									</div>
									<div className="flex justify-end">
										<button
											type="button"
											onClick={onClose}
											className="px-4 py-2 text-sm rounded-lg text-white/50 hover:text-white transition-colors"
										>
											Close
										</button>
									</div>
								</div>
							)}

							{/* OAuth2 Connect */}
							{isOAuth2 && (
								<>
									{oauthChecking ? (
										<div className="flex items-center justify-center gap-2 py-6 text-white/40">
											<div className="size-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
											<span className="text-sm">
												Checking OAuth availability...
											</span>
										</div>
									) : oauthStatus?.available ? (
										<div className="flex flex-col gap-3">
											<button
												type="button"
												onClick={handleOAuthConnect}
												disabled={oauthConnecting}
												className="flex items-center justify-center gap-2.5 w-full px-4 py-3 text-sm font-medium rounded-lg bg-primary-900 text-white hover:bg-primary-800 transition-colors disabled:opacity-60"
											>
												{oauthConnecting ? (
													<>
														<div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
														Connecting...
													</>
												) : (
													<>
														<LinkIcon className="size-4" />
														{showReconnect
															? "Reconnect"
															: "Connect"}{" "}
														with {pieceDisplayName}
													</>
												)}
											</button>

											{oauthConnecting && (
												<p className="text-xs text-white/40 text-center">
													Complete the sign-in in the
													popup window...
												</p>
											)}

											{!showReconnect && (
												<>
													<div className="flex items-center gap-3 py-1">
														<div className="flex-1 h-px bg-white/[0.08]" />
														<span className="text-[11px] text-white/30 uppercase tracking-wider">
															or paste token
															manually
														</span>
														<div className="flex-1 h-px bg-white/[0.08]" />
													</div>
													<button
														type="button"
														onClick={() =>
															setShowManualEntry(
																!showManualEntry,
															)
														}
														className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
													>
														<KeyRoundIcon className="size-3" />
														{showManualEntry
															? "Hide"
															: "Show"}{" "}
														manual token entry
														{showManualEntry ? (
															<ChevronUpIcon className="size-3" />
														) : (
															<ChevronDownIcon className="size-3" />
														)}
													</button>
												</>
											)}
										</div>
									) : (
										<div className="flex flex-col gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
											<div className="flex items-start gap-2">
												<ExternalLinkIcon className="size-4 text-amber-400 shrink-0 mt-0.5" />
												<div>
													<p className="text-sm text-amber-300">
														OAuth not configured
													</p>
													<p className="text-xs text-white/40 mt-1">
														{oauthStatus?.reason ||
															`An admin needs to configure an OAuth app for "${oauthStatus?.provider || pieceName}" in Settings > OAuth Apps.`}
													</p>
												</div>
											</div>
											<p className="text-xs text-white/30 mt-1">
												You can still add a token
												manually below.
											</p>
										</div>
									)}
								</>
							)}

							{/* Manual Token Form */}
							{showManualEntry && (
								<form
									onSubmit={handleSubmit}
									className="flex flex-col gap-4"
								>
									{/* API Key help link */}
									{API_KEY_LINKS[pieceName] && (
										<a
											href={
												API_KEY_LINKS[pieceName].url
											}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/[0.08] border border-blue-500/20 hover:border-blue-500/35 transition-colors group"
										>
											<div className="shrink-0 p-1.5 rounded-md bg-blue-500/15">
												<ExternalLinkIcon className="size-4 text-blue-400" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium text-blue-300 group-hover:text-blue-200 transition-colors">
													{
														API_KEY_LINKS[
															pieceName
														].label
													}
												</p>
												<p className="text-xs text-white/40 mt-0.5">
													{
														API_KEY_LINKS[
															pieceName
														].description
													}
												</p>
											</div>
											<ExternalLinkIcon className="size-3.5 text-white/20 group-hover:text-white/40 shrink-0 transition-colors" />
										</a>
									)}

									<div className="flex flex-col gap-1.5">
										<label
											htmlFor="modal-cred-name"
											className="text-xs text-white/50"
										>
											Credential Name
										</label>
										<input
											id="modal-cred-name"
											type="text"
											value={displayName}
											onChange={(e) =>
												setDisplayName(e.target.value)
											}
											placeholder={`My ${pieceDisplayName} Token`}
											className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
										/>
									</div>

									{/* Auth type badge */}
									{!isOAuth2 && (
										<div className="flex items-center gap-2">
											<span className="text-xs text-white/40">
												Auth type:
											</span>
											<span className="px-2 py-0.5 text-[11px] rounded-full bg-white/5 text-white/50 border border-white/[0.06]">
												{resolvedAuthType === "basic"
													? "Basic Auth"
													: resolvedAuthType ===
														  "custom"
														? "Custom"
														: "API Key / Token"}
											</span>
										</div>
									)}

									{/* Custom auth fields */}
									{(authInfo.type === "CUSTOM_AUTH" ||
										authInfo.type === "custom") &&
									authInfo.props &&
									Object.keys(authInfo.props).length > 0 ? (
										<>
											{Object.entries(authInfo.props).map(
												([key, prop]) => (
													<div
														key={key}
														className="flex flex-col gap-1.5"
													>
														<label
															htmlFor={`modal-cred-${key}`}
															className="text-xs text-white/50"
														>
															{prop.displayName}
															{prop.required && (
																<span className="text-red-400 ml-0.5">
																	*
																</span>
															)}
														</label>
														<input
															id={`modal-cred-${key}`}
															type={
																prop.type ===
																"SECRET_TEXT"
																	? "password"
																	: "text"
															}
															value={
																fields[key] ??
																""
															}
															onChange={(e) =>
																setFields(
																	(prev) => ({
																		...prev,
																		[key]: e
																			.target
																			.value,
																	}),
																)
															}
															placeholder={
																prop.description ||
																prop.displayName
															}
															className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
														/>
													</div>
												),
											)}
										</>
									) : (
										<>
											{/* Username for basic auth */}
											{resolvedAuthType === "basic" && (
												<div className="flex flex-col gap-1.5">
													<label
														htmlFor="modal-cred-username"
														className="text-xs text-white/50"
													>
														Username
													</label>
													<input
														id="modal-cred-username"
														type="text"
														value={username}
														onChange={(e) =>
															setUsername(
																e.target.value,
															)
														}
														placeholder="Enter your username"
														className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
														autoFocus={!isOAuth2}
													/>
												</div>
											)}

											{/* API Key / Password */}
											<div className="flex flex-col gap-1.5">
												<label
													htmlFor="modal-cred-key"
													className="text-xs text-white/50"
												>
													{resolvedAuthType ===
													"basic"
														? "Password"
														: "API Key / Token"}
												</label>
												<input
													id="modal-cred-key"
													type="password"
													value={apiKey}
													onChange={(e) =>
														setApiKey(
															e.target.value,
														)
													}
													placeholder={
														resolvedAuthType ===
														"basic"
															? "Enter your password"
															: "Enter your API key or token"
													}
													className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
													required
													autoFocus={
														!isOAuth2 &&
														resolvedAuthType !==
															"basic"
													}
												/>
											</div>
										</>
									)}

									{error && (
										<p
											className="text-sm text-red-400"
											role="alert"
										>
											{error}
										</p>
									)}

									<div className="flex gap-2 justify-end pt-1">
										<button
											type="button"
											onClick={onClose}
											className="px-4 py-2 text-sm rounded-lg text-white/50 hover:text-white transition-colors"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={
												isSubmitting ||
												(!(
													authInfo.type ===
														"CUSTOM_AUTH" ||
													authInfo.type === "custom"
												) &&
													!apiKey)
											}
											className="px-4 py-2 text-sm rounded-lg bg-primary-900 text-white hover:bg-primary-800 transition-colors disabled:opacity-40"
										>
											{isSubmitting
												? "Saving..."
												: "Save Credential"}
										</button>
									</div>
								</form>
							)}

							{/* Error outside form */}
							{!showManualEntry && error && (
								<p
									className="text-sm text-red-400"
									role="alert"
								>
									{error}
								</p>
							)}

							{/* Cancel buttons for non-form views */}
							{!showManualEntry &&
								!showReconnect &&
								!isNoneAuth && (
									<div className="flex justify-end pt-1">
										<button
											type="button"
											onClick={onClose}
											className="px-4 py-2 text-sm rounded-lg text-white/50 hover:text-white transition-colors"
										>
											Cancel
										</button>
									</div>
								)}

							{showReconnect && !oauthConnecting && (
								<div className="flex justify-end pt-1">
									<button
										type="button"
										onClick={() => setShowReconnect(false)}
										className="px-4 py-2 text-sm rounded-lg text-white/50 hover:text-white transition-colors"
									>
										Cancel
									</button>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
