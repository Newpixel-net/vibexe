"use client";

/**
 * IntegrationsPanel Component
 *
 * Browse and connect real integrations from the Activepieces catalog.
 * Loads 600+ connectors from /api/integrations/pieces with search and category filtering.
 */

import {
	Check,
	CheckCircle2,
	ChevronDown,
	ExternalLink,
	KeyRound,
	Link,
	LinkIcon,
	Loader2,
	Puzzle,
	Search,
	Trash2,
	Webhook,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface IntegrationsPanelProps {
	appId: string;
}

interface PieceEntry {
	name: string;
	displayName: string;
	category: string;
	authType: string;
	description: string;
	pieceType: string;
	logoUrl?: string;
}

interface ConnectedIntegration {
	pieceName: string;
	displayName: string;
	status: string;
	connectedAt: string;
	hasCredentials: boolean;
}

const ITEMS_PER_PAGE = 30;

export function IntegrationsPanel({ appId }: IntegrationsPanelProps) {
	const [pieces, setPieces] = useState<PieceEntry[]>([]);
	const [categories, setCategories] = useState<string[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [activeCategory, setActiveCategory] = useState("all");
	const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
	const [activeTab, setActiveTab] = useState<"browse" | "connected">(
		"browse",
	);
	const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
	const [connectedLoading, setConnectedLoading] = useState(true);
	const [connectingPiece, setConnectingPiece] = useState<string | null>(null);
	const [modalPiece, setModalPiece] = useState<PieceEntry | null>(null);

	// Fetch piece catalog
	useEffect(() => {
		async function fetchPieces() {
			try {
				const res = await fetch("/api/integrations/pieces");
				if (res.ok) {
					const data = await res.json();
					setPieces(data.pieces || []);
					setCategories(data.categories || []);
					setTotal(data.total || 0);
				}
			} catch {
				// Ignore
			}
			setLoading(false);
		}
		fetchPieces();
	}, []);

	// Fetch connected integrations
	const fetchConnected = useCallback(async () => {
		try {
			const res = await fetch(`/api/apps/${appId}/integrations`);
			if (res.ok) {
				const data = await res.json();
				setConnected(data.integrations || []);
			}
		} catch {
			// Ignore
		}
		setConnectedLoading(false);
	}, [appId]);

	useEffect(() => {
		fetchConnected();
	}, [fetchConnected]);

	const connectedSet = useMemo(
		() => new Set(connected.map((c) => c.pieceName)),
		[connected],
	);

	const handleConnect = useCallback(
		async (piece: PieceEntry) => {
			// No auth — instant add without modal
			if (piece.authType === "none") {
				setConnectingPiece(piece.name);
				try {
					await fetch(`/api/apps/${appId}/integrations`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							pieceName: piece.name,
							displayName: piece.displayName,
						}),
					});
					fetchConnected();
				} catch {
					// Ignore
				}
				setConnectingPiece(null);
				return;
			}
			// Auth required — open modal
			setModalPiece(piece);
		},
		[appId, fetchConnected],
	);

	const handleDisconnect = useCallback(
		async (pieceName: string) => {
			if (!window.confirm("Disconnect this integration?")) return;
			try {
				await fetch(`/api/apps/${appId}/integrations`, {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pieceName }),
				});
				fetchConnected();
			} catch {
				// Ignore
			}
		},
		[appId, fetchConnected],
	);

	// Filter pieces
	const filtered = useMemo(() => {
		let result = pieces;

		if (activeCategory !== "all") {
			result = result.filter((p) => p.category === activeCategory);
		}

		if (search.trim()) {
			const q = search.toLowerCase().trim();
			result = result.filter(
				(p) =>
					p.displayName.toLowerCase().includes(q) ||
					p.name.toLowerCase().includes(q) ||
					p.description.toLowerCase().includes(q),
			);
		}

		return result;
	}, [pieces, activeCategory, search]);

	// Reset visible count when filter changes
	useEffect(() => {
		setVisibleCount(ITEMS_PER_PAGE);
	}, [activeCategory, search]);

	const visiblePieces = filtered.slice(0, visibleCount);
	const hasMore = visibleCount < filtered.length;

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-white/40" />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-white/90">
							Integrations
						</h1>
						<p className="text-sm text-white/40 mt-1">
							{total} connectors available — connect services to
							your app
						</p>
					</div>
				</div>

				{/* Tabs */}
				<div className="flex gap-1 border-b border-white/[0.06]">
					<button
						type="button"
						onClick={() => setActiveTab("browse")}
						className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
							activeTab === "browse"
								? "border-violet-400 text-white/90"
								: "border-transparent text-white/40 hover:text-white/90"
						}`}
					>
						Browse
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("connected")}
						className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
							activeTab === "connected"
								? "border-violet-400 text-white/90"
								: "border-transparent text-white/40 hover:text-white/90"
						}`}
					>
						My Integrations
					</button>
				</div>

				{activeTab === "connected" ? (
					connectedLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-5 w-5 animate-spin text-white/40" />
						</div>
					) : connected.length === 0 ? (
						<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-8 text-center">
							<Link className="h-8 w-8 text-white/20 mx-auto mb-3" />
							<h3 className="text-sm font-medium text-white/90 mb-1">
								No integrations connected yet
							</h3>
							<p className="text-xs text-white/40 max-w-sm mx-auto">
								Browse available integrations and connect them to
								start using external services in your app.
							</p>
							<button
								type="button"
								onClick={() => setActiveTab("browse")}
								className="mt-4 px-4 py-2 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white hover:from-violet-500 hover:to-cyan-500 text-sm font-medium transition-colors"
							>
								Browse Integrations
							</button>
						</div>
					) : (
						<div className="space-y-2">
							{connected.map((integration) => {
								const piece = pieces.find((p) => p.name === integration.pieceName);
								return (
									<div
										key={integration.pieceName}
										className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3"
									>
										<div className="h-9 w-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
											{piece?.logoUrl ? (
												<img
													src={piece.logoUrl}
													alt=""
													className="h-5 w-5 object-contain"
												/>
											) : (
												<Puzzle className="h-4 w-4 text-white/40" />
											)}
										</div>
										<div className="min-w-0 flex-1">
											<h3 className="text-sm font-medium text-white/90">
												{integration.displayName}
											</h3>
											<p className="text-[11px] text-white/40">
												Connected {new Date(integration.connectedAt).toLocaleDateString()}
												{integration.hasCredentials && (
													<>
														{" "}&middot;{" "}
														<span className="text-green-600">Credentials saved</span>
													</>
												)}
											</p>
										</div>
										<span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
											{integration.status}
										</span>
										<button
											type="button"
											onClick={() => handleDisconnect(integration.pieceName)}
											className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-500 transition-colors"
											title="Disconnect"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									</div>
								);
							})}
						</div>
					)
				) : (
					<>
						{/* Search + Category */}
						<div className="flex flex-col sm:flex-row gap-3">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
								<input
									type="text"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Search integrations..."
									className="w-full pl-9 pr-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
								/>
							</div>
							<select
								value={activeCategory}
								onChange={(e) =>
									setActiveCategory(e.target.value)
								}
								className="px-3 py-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30"
							>
								<option value="all">
									All Categories ({pieces.length})
								</option>
								{categories.map((cat) => (
									<option key={cat} value={cat}>
										{cat} (
										{
											pieces.filter(
												(p) => p.category === cat,
											).length
										}
										)
									</option>
								))}
							</select>
						</div>

						{/* Results count */}
						<p className="text-xs text-white/40">
							Showing {visiblePieces.length} of{" "}
							{filtered.length} integrations
							{search && ` matching "${search}"`}
						</p>

						{/* Grid */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{visiblePieces.map((piece) => (
								<div
									key={piece.name}
									className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3 hover:border-white/[0.12] transition-colors group"
								>
									<div className="h-9 w-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
										{piece.logoUrl ? (
											<img
												src={piece.logoUrl}
												alt=""
												className="h-5 w-5 object-contain"
												onError={(e) => {
													(
														e.target as HTMLImageElement
													).style.display = "none";
													(
														e.target as HTMLImageElement
													).parentElement!.innerHTML =
														'<svg class="h-5 w-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
												}}
											/>
										) : (
											<Puzzle className="h-4 w-4 text-white/40" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<h3 className="text-sm font-medium text-white/90 truncate">
											{piece.displayName}
										</h3>
										<p className="text-[11px] text-white/40 truncate">
											{piece.category}
											{piece.authType !== "none" && (
												<>
													{" "}
													&middot;{" "}
													{piece.authType ===
													"oauth2"
														? "OAuth"
														: piece.authType ===
															  "api_key"
															? "API Key"
															: piece.authType}
												</>
											)}
										</p>
									</div>
									{connectedSet.has(piece.name) ? (
										<span className="px-2.5 py-1 rounded-md text-xs font-medium text-green-600 flex items-center gap-1 flex-shrink-0">
											<Check className="h-3 w-3" />
											Added
										</span>
									) : (
										<button
											type="button"
											onClick={() => handleConnect(piece)}
											disabled={connectingPiece === piece.name}
											className="px-2.5 py-1 rounded-md border border-white/[0.08] text-xs font-medium text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 disabled:opacity-50"
										>
											{connectingPiece === piece.name ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												"Add"
											)}
										</button>
									)}
								</div>
							))}
						</div>

						{/* Load more */}
						{hasMore && (
							<div className="flex justify-center pt-2">
								<button
									type="button"
									onClick={() =>
										setVisibleCount(
											(v) => v + ITEMS_PER_PAGE,
										)
									}
									className="px-6 py-2 rounded-md border border-white/[0.08] text-sm font-medium text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
								>
									Load More ({filtered.length - visibleCount}{" "}
									remaining)
								</button>
							</div>
						)}

						{/* Empty state */}
						{filtered.length === 0 && (
							<div className="text-center py-8">
								<Puzzle className="h-8 w-8 text-white/20 mx-auto mb-2" />
								<p className="text-sm text-white/40">
									No integrations found
									{search && ` for "${search}"`}
								</p>
							</div>
						)}

						{/* Webhooks */}
						<div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
							<div className="flex items-start gap-3">
								<Webhook className="h-5 w-5 text-white/40 flex-shrink-0 mt-0.5" />
								<div>
									<h3 className="text-sm font-medium text-white/90">
										Webhooks
									</h3>
									<p className="text-xs text-white/40 mt-1">
										Configure webhooks to receive real-time
										notifications when data changes in your
										app. Webhooks will be available once
										your app has entities defined.
									</p>
								</div>
							</div>
						</div>
					</>
				)}
			</div>

			{/* Connect Modal */}
			{modalPiece && (
				<ConnectModal
					piece={modalPiece}
					appId={appId}
					onClose={() => setModalPiece(null)}
					onSuccess={() => {
						setModalPiece(null);
						fetchConnected();
					}}
				/>
			)}
		</div>
	);
}

// ─── API Key Setup Links ────────────────────────────────

const API_KEY_LINKS: Record<string, { url: string; label: string }> = {
	openai: { url: "https://platform.openai.com/api-keys", label: "Get API key from OpenAI" },
	anthropic: { url: "https://console.anthropic.com/settings/keys", label: "Get API key from Anthropic" },
	"google-gemini": { url: "https://aistudio.google.com/apikey", label: "Get API key from Google AI Studio" },
	stripe: { url: "https://dashboard.stripe.com/apikeys", label: "Get API key from Stripe" },
	sendgrid: { url: "https://app.sendgrid.com/settings/api_keys", label: "Get API key from SendGrid" },
	discord: { url: "https://discord.com/developers/applications", label: "Get Bot Token from Discord" },
	twilio: { url: "https://console.twilio.com/", label: "Get credentials from Twilio" },
	"telegram-bot": { url: "https://t.me/BotFather", label: "Get Bot Token from BotFather" },
};

// ─── Auth Schema Types ──────────────────────────────────

interface AuthPropInfo {
	name: string;
	displayName: string;
	description: string;
	type: string;
	required: boolean;
	defaultValue?: unknown;
	options?: { label: string; value: unknown }[];
}

interface AccountCredential {
	dbId: number;
	pieceName: string;
	displayName: string;
	authType: string;
	createdAt: string;
}

// ─── ConnectModal Component ─────────────────────────────

function ConnectModal({
	piece,
	appId,
	onClose,
	onSuccess,
}: {
	piece: PieceEntry;
	appId: string;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const modalRef = useRef<HTMLDivElement>(null);
	const [mode, setMode] = useState<"select" | "new">("select");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Account credentials for this piece
	const [accountCreds, setAccountCreds] = useState<AccountCredential[]>([]);
	const [credsLoading, setCredsLoading] = useState(true);
	const [selectedCredId, setSelectedCredId] = useState<number | null>(null);

	// Auth schema for new credential form
	const [authSchema, setAuthSchema] = useState<Record<string, AuthPropInfo> | null>(null);
	const [schemaLoading, setSchemaLoading] = useState(false);
	const [fields, setFields] = useState<Record<string, string>>({});

	// OAuth status
	const isOAuth2 = piece.authType === "oauth2";
	const [oauthStatus, setOauthStatus] = useState<{ available: boolean; provider?: string; reason?: string } | null>(null);
	const [oauthChecking, setOauthChecking] = useState(isOAuth2);
	const [oauthConnecting, setOauthConnecting] = useState(false);

	// Fetch account credentials for this piece
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`/api/integrations/credentials?pieceName=${encodeURIComponent(piece.name)}`);
				if (!cancelled && res.ok) {
					const data = await res.json() as { credentials: AccountCredential[] };
					setAccountCreds(data.credentials || []);
					if (data.credentials?.length > 0) {
						setSelectedCredId(data.credentials[0].dbId);
					} else {
						setMode("new");
					}
				}
			} catch {
				if (!cancelled) setMode("new");
			} finally {
				if (!cancelled) setCredsLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, [piece.name]);

	// Fetch auth schema for new credential form
	useEffect(() => {
		if (mode !== "new") return;
		let cancelled = false;
		setSchemaLoading(true);

		(async () => {
			try {
				const res = await fetch(`/api/integrations/pieces/${encodeURIComponent(piece.name)}`);
				if (!cancelled && res.ok) {
					const data = await res.json() as { auth?: { props?: Record<string, AuthPropInfo> } };
					if (data.auth?.props && Object.keys(data.auth.props).length > 0) {
						setAuthSchema(data.auth.props);
						const defaults: Record<string, string> = {};
						for (const [key, prop] of Object.entries(data.auth.props)) {
							if (prop.defaultValue !== undefined && prop.defaultValue !== null) {
								defaults[key] = String(prop.defaultValue);
							}
						}
						if (Object.keys(defaults).length > 0) setFields(defaults);
					}
				}
			} catch {
				// Fall through to generic form
			} finally {
				if (!cancelled) setSchemaLoading(false);
			}
		})();

		return () => { cancelled = true; };
	}, [mode, piece.name]);

	// Check OAuth2 availability
	useEffect(() => {
		if (!isOAuth2) return;
		let cancelled = false;

		(async () => {
			try {
				const res = await fetch(`/api/integrations/oauth2/status?pieceName=${encodeURIComponent(piece.name)}`);
				if (!cancelled && res.ok) {
					const data = await res.json() as { available: boolean; provider?: string; reason?: string };
					setOauthStatus(data);
				}
			} catch {
				if (!cancelled) setOauthStatus({ available: false, reason: "Failed to check OAuth status" });
			} finally {
				if (!cancelled) setOauthChecking(false);
			}
		})();

		return () => { cancelled = true; };
	}, [isOAuth2, piece.name]);

	// Close on outside click / Escape
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKey);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKey);
		};
	}, [onClose]);

	// Submit: use account credential
	const handleUseAccountCred = async () => {
		if (!selectedCredId) return;
		setIsSubmitting(true);
		setError(null);
		try {
			await fetch(`/api/apps/${appId}/integrations`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pieceName: piece.name,
					displayName: piece.displayName,
				}),
			});
			onSuccess();
		} catch {
			setError("Failed to connect integration");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Submit: new per-app credential
	const handleSubmitNewCred = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			const config: Record<string, unknown> = {};
			const authType = piece.authType;

			if (authSchema && Object.keys(authSchema).length > 0) {
				Object.assign(config, fields);
			} else if (authType === "basic") {
				config.username = fields.username || "";
				config.password = fields.password || "";
			} else {
				config.apiKey = fields.apiKey || "";
			}

			await fetch(`/api/apps/${appId}/integrations`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pieceName: piece.name,
					displayName: piece.displayName,
					credentials: JSON.stringify(config),
				}),
			});
			onSuccess();
		} catch {
			setError("Failed to save credentials");
		} finally {
			setIsSubmitting(false);
		}
	};

	// OAuth connect
	const handleOAuthConnect = () => {
		setOauthConnecting(true);
		setError(null);
		const popup = window.open(
			`/api/integrations/oauth2/authorize?pieceName=${encodeURIComponent(piece.name)}`,
			"oauth2-connect",
			"width=600,height=700,left=200,top=100,popup=yes",
		);
		if (!popup) {
			setError("Popup blocked. Please allow popups.");
			setOauthConnecting(false);
			return;
		}
		const timer = setInterval(() => {
			if (popup.closed) {
				clearInterval(timer);
				setOauthConnecting(false);
				// After OAuth, also connect to this app
				fetch(`/api/apps/${appId}/integrations`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pieceName: piece.name, displayName: piece.displayName }),
				}).then(() => onSuccess()).catch(() => onSuccess());
			}
		}, 500);
	};

	const isCustomOrMultiField = piece.authType === "custom" || piece.authType === "basic";
	const hasRequiredFieldsMissing = authSchema
		? Object.entries(authSchema).some(([k, p]) => p.required && !fields[k])
		: !isCustomOrMultiField
			? !fields.apiKey
			: piece.authType === "basic"
				? !fields.username || !fields.password
				: !fields.apiKey;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div ref={modalRef} className="w-full max-w-md mx-4 rounded-xl bg-[rgb(20,17,32)] border border-white/10 shadow-2xl">
				{/* Header */}
				<div className="flex items-center gap-3 p-5 border-b border-white/[0.06]">
					<div className="h-10 w-10 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden">
						{piece.logoUrl ? (
							<img src={piece.logoUrl} alt="" className="h-6 w-6 object-contain" />
						) : (
							<Puzzle className="h-5 w-5 text-white/40" />
						)}
					</div>
					<div className="flex-1 min-w-0">
						<div className="text-base font-medium text-white truncate">
							Connect {piece.displayName}
						</div>
						<div className="text-xs text-white/40 mt-0.5">
							{piece.authType === "oauth2" ? "OAuth" : piece.authType === "api_key" ? "API Key" : piece.authType} authentication
						</div>
					</div>
					<button type="button" onClick={onClose} className="p-1 text-white/40 hover:text-white transition-colors">
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
					{credsLoading ? (
						<div className="flex items-center justify-center gap-2 py-6 text-white/40">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="text-sm">Checking credentials...</span>
						</div>
					) : (
						<>
							{/* Account credential option */}
							{accountCreds.length > 0 && (
								<div className="flex flex-col gap-3">
									<p className="text-xs font-medium text-white/50 uppercase tracking-wider">Use account credential</p>
									{accountCreds.map((cred) => (
										<button
											key={cred.dbId}
											type="button"
											onClick={() => { setSelectedCredId(cred.dbId); setMode("select"); }}
											className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
												mode === "select" && selectedCredId === cred.dbId
													? "border-emerald-500/30 bg-emerald-500/[0.06]"
													: "border-white/[0.08] bg-white/[0.02] hover:border-white/15"
											}`}
										>
											<CheckCircle2 className={`h-4 w-4 shrink-0 ${
												mode === "select" && selectedCredId === cred.dbId ? "text-emerald-400" : "text-white/20"
											}`} />
											<div className="flex-1 min-w-0">
												<p className="text-sm text-white/90">{cred.displayName}</p>
												<p className="text-[10px] text-white/40">{cred.authType} &middot; Added {new Date(cred.createdAt).toLocaleDateString()}</p>
											</div>
										</button>
									))}

									{mode === "select" && (
										<button
											type="button"
											onClick={handleUseAccountCred}
											disabled={isSubmitting || !selectedCredId}
											className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-40"
										>
											{isSubmitting ? "Connecting..." : "Connect with account credential"}
										</button>
									)}

									{/* Separator */}
									<div className="flex items-center gap-3 py-1">
										<div className="flex-1 h-px bg-white/[0.08]" />
										<span className="text-[11px] text-white/30 uppercase tracking-wider">or enter new</span>
										<div className="flex-1 h-px bg-white/[0.08]" />
									</div>
								</div>
							)}

							{/* New credential toggle */}
							{accountCreds.length > 0 && mode !== "new" && (
								<button
									type="button"
									onClick={() => setMode("new")}
									className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
								>
									<KeyRound className="h-3 w-3" />
									Enter new credentials for this app
									<ChevronDown className="h-3 w-3" />
								</button>
							)}

							{/* New credential form */}
							{mode === "new" && (
								<>
									{/* OAuth2 option */}
									{isOAuth2 && (
										<>
											{oauthChecking ? (
												<div className="flex items-center gap-2 py-3 text-white/40 text-sm">
													<Loader2 className="h-4 w-4 animate-spin" />
													Checking OAuth...
												</div>
											) : oauthStatus?.available ? (
												<div className="flex flex-col gap-2">
													<button
														type="button"
														onClick={handleOAuthConnect}
														disabled={oauthConnecting}
														className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-60"
													>
														{oauthConnecting ? (
															<><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</>
														) : (
															<><LinkIcon className="h-4 w-4" /> Connect with {piece.displayName}</>
														)}
													</button>
													<div className="flex items-center gap-3 py-1">
														<div className="flex-1 h-px bg-white/[0.08]" />
														<span className="text-[10px] text-white/25">or paste token</span>
														<div className="flex-1 h-px bg-white/[0.08]" />
													</div>
												</div>
											) : (
												<div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
													<p className="text-xs text-amber-300">OAuth not configured</p>
													<p className="text-[10px] text-white/40 mt-1">{oauthStatus?.reason || "Enter a token manually below."}</p>
												</div>
											)}
										</>
									)}

									{/* API key help link */}
									{API_KEY_LINKS[piece.name] && (
										<a
											href={API_KEY_LINKS[piece.name].url}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/[0.06] border border-blue-500/15 hover:border-blue-500/30 transition-colors text-xs text-blue-300"
										>
											<ExternalLink className="h-3.5 w-3.5 shrink-0" />
											{API_KEY_LINKS[piece.name].label}
										</a>
									)}

									{schemaLoading ? (
										<div className="flex items-center gap-2 py-3 text-white/40 text-sm">
											<Loader2 className="h-4 w-4 animate-spin" />
											Loading fields...
										</div>
									) : (
										<form onSubmit={handleSubmitNewCred} className="flex flex-col gap-3">
											{/* Dynamic auth schema fields */}
											{authSchema && Object.keys(authSchema).length > 0 ? (
												Object.entries(authSchema).map(([key, prop]) => {
													const isSensitive = /secret|password|token|key/i.test(key) || /secret|password|token|key/i.test(prop.displayName);

													if (prop.type === "CHECKBOX") {
														return (
															<div key={key} className="flex items-center gap-2">
																<input
																	id={`field-${key}`}
																	type="checkbox"
																	checked={fields[key] === "true"}
																	onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.checked ? "true" : "false" }))}
																	className="size-4 rounded border border-white/20 bg-white/5 accent-violet-500"
																/>
																<label htmlFor={`field-${key}`} className="text-xs text-white/50">
																	{prop.displayName}
																	{prop.required && <span className="text-red-400 ml-0.5">*</span>}
																</label>
															</div>
														);
													}

													if (prop.type === "STATIC_DROPDOWN" && prop.options) {
														return (
															<div key={key} className="flex flex-col gap-1.5">
																<label htmlFor={`field-${key}`} className="text-xs text-white/50">
																	{prop.displayName}
																	{prop.required && <span className="text-red-400 ml-0.5">*</span>}
																</label>
																<select
																	id={`field-${key}`}
																	value={fields[key] ?? ""}
																	onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
																	className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-white/25"
																>
																	<option value="">Select...</option>
																	{prop.options.map((opt) => (
																		<option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
																	))}
																</select>
															</div>
														);
													}

													return (
														<div key={key} className="flex flex-col gap-1.5">
															<label htmlFor={`field-${key}`} className="text-xs text-white/50">
																{prop.displayName}
																{prop.required && <span className="text-red-400 ml-0.5">*</span>}
															</label>
															{prop.description && (
																<p className="text-[10px] text-white/25 -mt-0.5">{prop.description}</p>
															)}
															<input
																id={`field-${key}`}
																type={isSensitive ? "password" : prop.type === "NUMBER" ? "number" : "text"}
																value={fields[key] ?? ""}
																onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
																placeholder={`Enter ${prop.displayName.toLowerCase()}`}
																className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
															/>
														</div>
													);
												})
											) : piece.authType === "basic" ? (
												<>
													<div className="flex flex-col gap-1.5">
														<label htmlFor="field-username" className="text-xs text-white/50">Username<span className="text-red-400 ml-0.5">*</span></label>
														<input
															id="field-username"
															type="text"
															value={fields.username ?? ""}
															onChange={(e) => setFields((prev) => ({ ...prev, username: e.target.value }))}
															placeholder="Enter username"
															className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
															autoFocus
														/>
													</div>
													<div className="flex flex-col gap-1.5">
														<label htmlFor="field-password" className="text-xs text-white/50">Password<span className="text-red-400 ml-0.5">*</span></label>
														<input
															id="field-password"
															type="password"
															value={fields.password ?? ""}
															onChange={(e) => setFields((prev) => ({ ...prev, password: e.target.value }))}
															placeholder="Enter password"
															className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
														/>
													</div>
												</>
											) : (
												<div className="flex flex-col gap-1.5">
													<label htmlFor="field-apiKey" className="text-xs text-white/50">API Key / Token<span className="text-red-400 ml-0.5">*</span></label>
													<input
														id="field-apiKey"
														type="password"
														value={fields.apiKey ?? ""}
														onChange={(e) => setFields((prev) => ({ ...prev, apiKey: e.target.value }))}
														placeholder="Enter your API key or token"
														className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
														autoFocus
													/>
												</div>
											)}

											{error && (
												<p className="text-sm text-red-400">{error}</p>
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
													disabled={isSubmitting || hasRequiredFieldsMissing}
													className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-40"
												>
													{isSubmitting ? "Saving..." : "Connect & Save"}
												</button>
											</div>
										</form>
									)}
								</>
							)}

							{/* Error for account credential flow */}
							{mode === "select" && error && (
								<p className="text-sm text-red-400">{error}</p>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
