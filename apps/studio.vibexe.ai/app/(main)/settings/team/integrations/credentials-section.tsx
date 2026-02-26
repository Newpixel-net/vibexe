"use client";

import {
	CheckCircle2Icon,
	ChevronDownIcon,
	ChevronUpIcon,
	ExternalLinkIcon,
	KeyRoundIcon,
	LinkIcon,
	LogOutIcon,
	RefreshCwIcon,
	SearchIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Types ─────────────────────────────────────────────

interface PieceCatalogEntry {
	name: string;
	displayName: string;
	category: string;
	authType: string;
	description: string;
	pieceType: string;
	logoUrl?: string;
}

interface CredentialDisplay {
	dbId: number;
	pieceName: string;
	displayName: string;
	authType: string;
	createdAt: string;
}

type PieceTypeFilter = "all" | "regular" | "trigger" | "core";

const ITEMS_PER_PAGE = 48;

// ─── API Key Setup Links ────────────────────────────────
// Direct links to where users can create API keys/credentials
// for pieces that don't use OAuth2. Extensible - add more as needed.

const API_KEY_LINKS: Record<string, { url: string; label: string; description: string }> = {
	// Google
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
		description: "Create a service account key or API key in Google Cloud Console",
	},
	// OpenAI
	openai: {
		url: "https://platform.openai.com/api-keys",
		label: "Get API key from OpenAI",
		description: "Create an API key in your OpenAI dashboard",
	},
	// Anthropic
	anthropic: {
		url: "https://console.anthropic.com/settings/keys",
		label: "Get API key from Anthropic",
		description: "Create an API key in the Anthropic Console",
	},
	// Discord
	discord: {
		url: "https://discord.com/developers/applications",
		label: "Get Bot Token from Discord",
		description: "Create a bot and copy the token from Developer Portal",
	},
	// Telegram
	"telegram-bot": {
		url: "https://t.me/BotFather",
		label: "Get Bot Token from BotFather",
		description: "Message @BotFather on Telegram to create a bot token",
	},
	// Twilio
	twilio: {
		url: "https://console.twilio.com/",
		label: "Get credentials from Twilio",
		description: "Find your Account SID and Auth Token in the Twilio Console",
	},
	// SendGrid
	sendgrid: {
		url: "https://app.sendgrid.com/settings/api_keys",
		label: "Get API key from SendGrid",
		description: "Create an API key in SendGrid Settings",
	},
	// Stripe
	stripe: {
		url: "https://dashboard.stripe.com/apikeys",
		label: "Get API key from Stripe",
		description: "Copy your secret key from the Stripe Dashboard",
	},
};

// ─── Piece Icon Component ──────────────────────────────

function PieceIcon({
	piece,
	size = 40,
}: {
	piece: PieceCatalogEntry;
	size?: number;
}) {
	const [imgError, setImgError] = useState(false);

	if (piece.logoUrl && !imgError) {
		return (
			/* eslint-disable-next-line @next/next/no-img-element */
			<img
				src={piece.logoUrl}
				alt={piece.displayName}
				width={size}
				height={size}
				className="object-contain"
				onError={() => setImgError(true)}
			/>
		);
	}

	// Letter fallback with category-based colors
	const colors: Record<string, string> = {
		"AI & ML": "bg-violet-500/20 text-violet-300",
		Communication: "bg-blue-500/20 text-blue-300",
		"CRM & Sales": "bg-orange-500/20 text-orange-300",
		"Project Management": "bg-green-500/20 text-green-300",
		"Email & Marketing": "bg-pink-500/20 text-pink-300",
		"Google Workspace": "bg-red-500/20 text-red-300",
		"Microsoft 365": "bg-sky-500/20 text-sky-300",
		"Social Media": "bg-rose-500/20 text-rose-300",
		"E-Commerce": "bg-amber-500/20 text-amber-300",
		"Developer Tools": "bg-emerald-500/20 text-emerald-300",
		Productivity: "bg-teal-500/20 text-teal-300",
		"Finance & Accounting": "bg-yellow-500/20 text-yellow-300",
		"Cloud Storage": "bg-cyan-500/20 text-cyan-300",
		"HR & Recruitment": "bg-indigo-500/20 text-indigo-300",
		"Forms & Surveys": "bg-lime-500/20 text-lime-300",
		"CMS & Website": "bg-fuchsia-500/20 text-fuchsia-300",
		"Documents & Signatures": "bg-purple-500/20 text-purple-300",
		"Automation & Utilities": "bg-slate-500/20 text-slate-300",
	};

	const colorClass = colors[piece.category] || "bg-white/10 text-white/60";

	return (
		<div
			className={`rounded-lg flex items-center justify-center font-semibold ${colorClass}`}
			style={{ width: size, height: size, fontSize: size * 0.4 }}
		>
			{piece.displayName.charAt(0).toUpperCase()}
		</div>
	);
}

// ─── Main Section ──────────────────────────────────────

export function CredentialsSection() {
	const [credentials, setCredentials] = useState<CredentialDisplay[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [pieces, setPieces] = useState<PieceCatalogEntry[]>([]);
	const [categories, setCategories] = useState<string[]>([]);

	// Catalog state
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState<PieceTypeFilter>("all");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

	// Credential form state
	const [addingPiece, setAddingPiece] = useState<PieceCatalogEntry | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [showCredentials, setShowCredentials] = useState(false);

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

	const fetchPieces = useCallback(async () => {
		try {
			const response = await fetch("/api/integrations/pieces");
			if (response.ok) {
				const data = (await response.json()) as {
					pieces: PieceCatalogEntry[];
					categories: string[];
					total: number;
				};
				setPieces(data.pieces);
				setCategories(data.categories);
			}
		} catch {
			console.error("Failed to fetch pieces catalog");
		}
	}, []);

	useEffect(() => {
		fetchCredentials();
		fetchPieces();
	}, [fetchCredentials, fetchPieces]);

	const handleDelete = useCallback(
		async (credentialId: number) => {
			try {
				const response = await fetch(
					`/api/integrations/credentials/${credentialId}`,
					{ method: "DELETE" },
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

	// Filter pieces
	const filteredPieces = useMemo(() => {
		let result = pieces;

		if (typeFilter !== "all") {
			result = result.filter((p) => p.pieceType === typeFilter);
		}

		if (selectedCategory) {
			result = result.filter((p) => p.category === selectedCategory);
		}

		if (search) {
			const q = search.toLowerCase();
			result = result.filter(
				(p) =>
					p.displayName.toLowerCase().includes(q) ||
					p.name.includes(q) ||
					p.description.toLowerCase().includes(q) ||
					p.category.toLowerCase().includes(q),
			);
		}

		return result;
	}, [pieces, search, typeFilter, selectedCategory]);

	// Reset visible count when filters change
	useEffect(() => {
		setVisibleCount(ITEMS_PER_PAGE);
	}, [search, typeFilter, selectedCategory]);

	const visiblePieces = filteredPieces.slice(0, visibleCount);
	const hasMore = visibleCount < filteredPieces.length;

	// Type counts
	const typeCounts = useMemo(() => {
		const counts = { all: pieces.length, regular: 0, trigger: 0, core: 0 };
		for (const p of pieces) {
			if (p.pieceType === "regular") counts.regular++;
			else if (p.pieceType === "trigger") counts.trigger++;
			else if (p.pieceType === "core") counts.core++;
		}
		return counts;
	}, [pieces]);

	// Piece lookup for credentials
	const pieceMap = useMemo(() => {
		const map = new Map<string, PieceCatalogEntry>();
		for (const p of pieces) map.set(p.name, p);
		return map;
	}, [pieces]);

	// Set of piece names that have stored credentials
	const connectedPieces = useMemo(() => {
		const set = new Set<string>();
		for (const c of credentials) set.add(c.pieceName);
		return set;
	}, [credentials]);

	return (
		<div className="flex flex-col gap-6">
			{/* ─── Integration Catalog ────────────────────────── */}
			<div className="flex flex-col gap-4">
				{/* Search + Type Filters */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="relative flex-1 max-w-md">
						<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search integrations..."
							className="w-full pl-9 pr-8 py-2 text-sm rounded-lg bg-[rgb(27,23,40)] border border-white/10 text-white placeholder:text-white/40 outline-none focus:border-white/25 transition-colors"
						/>
						{search && (
							<button
								type="button"
								onClick={() => setSearch("")}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
							>
								<XIcon className="size-3.5" />
							</button>
						)}
					</div>

					<div className="flex items-center gap-1">
						{(
							[
								["all", "All Types"],
								["regular", "Regular"],
								["trigger", "Trigger"],
								["core", "Core"],
							] as const
						).map(([type, label]) => (
							<button
								key={type}
								type="button"
								onClick={() => setTypeFilter(type)}
								className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
									typeFilter === type
										? "bg-white/10 border-white/20 text-white"
										: "bg-transparent border-white/10 text-white/50 hover:text-white/70 hover:border-white/15"
								}`}
							>
								{label}
								<span className="ml-1 opacity-60">{typeCounts[type]}</span>
							</button>
						))}
					</div>
				</div>

				{/* Category chips */}
				<div className="flex flex-wrap gap-1.5">
					<button
						type="button"
						onClick={() => setSelectedCategory(null)}
						className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
							!selectedCategory
								? "bg-primary-900 text-white"
								: "bg-white/5 text-white/50 hover:text-white/70"
						}`}
					>
						All Categories
					</button>
					{categories.map((cat) => {
						const count = filteredPieces.filter(
							(p) => p.category === cat,
						).length;
						if (count === 0 && selectedCategory !== cat) return null;
						return (
							<button
								key={cat}
								type="button"
								onClick={() =>
									setSelectedCategory(selectedCategory === cat ? null : cat)
								}
								className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
									selectedCategory === cat
										? "bg-primary-900 text-white"
										: "bg-white/5 text-white/50 hover:text-white/70"
								}`}
							>
								{cat}{" "}
								<span className="opacity-60">{count}</span>
							</button>
						);
					})}
				</div>

				{/* Results count */}
				<div className="text-xs text-white/40">
					{filteredPieces.length} integration
					{filteredPieces.length !== 1 ? "s" : ""}
					{search && ` matching "${search}"`}
				</div>

				{/* Card Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{visiblePieces.map((piece) => {
						const isConnected = connectedPieces.has(piece.name);
						return (
						<button
							key={piece.name}
							type="button"
							onClick={() => setAddingPiece(piece)}
							className={`relative flex items-start gap-3 p-4 rounded-xl bg-[rgb(27,23,40)] border transition-all text-left group ${
								isConnected
									? "border-emerald-500/30 hover:border-emerald-500/50"
									: "border-white/[0.08] hover:border-white/20"
							}`}
						>
							{isConnected && (
								<div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15">
									<CheckCircle2Icon className="size-3 text-emerald-400" />
									<span className="text-[10px] font-medium text-emerald-400">Connected</span>
								</div>
							)}
							<div className="shrink-0 mt-0.5">
								<PieceIcon piece={piece} size={40} />
							</div>
							<div className="min-w-0 flex-1">
								<div className="text-sm font-medium text-white group-hover:text-white/90 truncate pr-16">
									{piece.displayName}
								</div>
								<div className="text-xs text-white/40 mt-0.5 line-clamp-2 leading-relaxed">
									{piece.description}
								</div>
								{piece.pieceType !== "regular" && (
									<span
										className={`inline-block mt-1.5 px-1.5 py-0.5 text-[10px] rounded ${
											piece.pieceType === "trigger"
												? "bg-amber-500/15 text-amber-300/80"
												: "bg-blue-500/15 text-blue-300/80"
										}`}
									>
										{piece.pieceType}
									</span>
								)}
							</div>
						</button>
						);
					})}
				</div>

				{/* Load More */}
				{hasMore && (
					<div className="flex justify-center">
						<button
							type="button"
							onClick={() =>
								setVisibleCount((c) => c + ITEMS_PER_PAGE)
							}
							className="px-6 py-2 text-sm rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors"
						>
							Load more ({filteredPieces.length - visibleCount} remaining)
						</button>
					</div>
				)}

				{filteredPieces.length === 0 && (
					<div className="flex flex-col items-center gap-2 py-12 text-white/40">
						<SearchIcon className="size-8 opacity-50" />
						<p className="text-sm">No integrations found</p>
						{search && (
							<p className="text-xs">
								Try a different search term or clear filters
							</p>
						)}
					</div>
				)}
			</div>

			{/* ─── Add Credential Modal ───────────────────────── */}
			{addingPiece && (
				<AddCredentialModal
					piece={addingPiece}
					existingCredential={credentials.find(c => c.pieceName === addingPiece.name) ?? null}
					onClose={() => {
						setAddingPiece(null);
						setError(null);
					}}
					onSuccess={() => {
						setAddingPiece(null);
						setError(null);
						fetchCredentials();
					}}
					onDisconnect={async (credId: number) => {
						await handleDelete(credId);
					}}
					error={error}
					setError={setError}
				/>
			)}

			{/* ─── Stored Credentials ─────────────────────────── */}
			<div className="flex flex-col gap-3">
				<button
					type="button"
					onClick={() => setShowCredentials(!showCredentials)}
					className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
				>
					<KeyRoundIcon className="size-4" />
					<span>
						Stored Credentials{" "}
						{!isLoading && `(${credentials.length})`}
					</span>
					{showCredentials ? (
						<ChevronUpIcon className="size-3.5" />
					) : (
						<ChevronDownIcon className="size-3.5" />
					)}
				</button>

				{showCredentials && (
					<div className="flex flex-col gap-2">
						{isLoading ? (
							<div className="text-sm text-white/40 py-4 text-center">
								Loading credentials...
							</div>
						) : credentials.length === 0 ? (
							<div className="flex flex-col items-center gap-2 py-6 text-white/40">
								<p className="text-sm">No credentials configured yet</p>
								<p className="text-xs">
									Click any integration above to add credentials
								</p>
							</div>
						) : (
							credentials.map((cred) => {
								const piece = pieceMap.get(cred.pieceName);
								return (
									<div
										key={cred.dbId}
										className="flex items-center justify-between p-3 rounded-lg bg-[rgb(27,23,40)] border border-white/[0.08]"
									>
										<div className="flex items-center gap-3">
											{piece ? (
												<PieceIcon piece={piece} size={28} />
											) : (
												<KeyRoundIcon className="size-4 text-white/40" />
											)}
											<div>
												<div className="text-sm font-medium text-white">
													{cred.displayName}
												</div>
												<div className="text-xs text-white/40">
													{piece?.displayName || cred.pieceName} &middot;{" "}
													{cred.authType}
												</div>
											</div>
										</div>
										<button
											type="button"
											className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
											onClick={() => handleDelete(cred.dbId)}
										>
											<Trash2Icon className="size-4" />
										</button>
									</div>
								);
							})
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// ─── Add Credential Modal ──────────────────────────────

function AddCredentialModal({
	piece,
	existingCredential,
	onClose,
	onSuccess,
	onDisconnect,
	error,
	setError,
}: {
	piece: PieceCatalogEntry;
	existingCredential: CredentialDisplay | null;
	onClose: () => void;
	onSuccess: () => void;
	onDisconnect: (credId: number) => Promise<void>;
	error: string | null;
	setError: (error: string | null) => void;
}) {
	const isOAuth2Piece = piece.authType === "oauth2";
	const isNoneAuth = piece.authType === "none";
	const isConnected = existingCredential !== null;

	const [displayName, setDisplayName] = useState("");
	const authType = (() => {
		const typeMap: Record<string, string> = {
			api_key: "secret_text",
			secret_text: "secret_text",
			oauth2: "oauth2",
			basic: "basic",
			custom: "custom",
			none: "none",
		};
		return typeMap[piece.authType] || "secret_text";
	})();
	const [apiKey, setApiKey] = useState("");
	const [username, setUsername] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showManualEntry, setShowManualEntry] = useState(!isOAuth2Piece && !isNoneAuth && !isConnected);
	const [showReconnect, setShowReconnect] = useState(false);
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const [confirmDisconnect, setConfirmDisconnect] = useState(false);
	const modalRef = useRef<HTMLDivElement>(null);

	// Custom auth dynamic fields
	const [customFields, setCustomFields] = useState<Record<string, string>>({});
	const [authSchema, setAuthSchema] = useState<{ props: Record<string, { name: string; displayName: string; description: string; type: string; required: boolean; defaultValue?: unknown; options?: { label: string; value: unknown }[] }> } | null>(null);
	const [schemaLoading, setSchemaLoading] = useState(false);

	// OAuth2 status
	const [oauthStatus, setOauthStatus] = useState<{
		available: boolean;
		provider?: string;
		reason?: string;
	} | null>(null);
	const [oauthChecking, setOauthChecking] = useState(isOAuth2Piece);
	const [oauthConnecting, setOauthConnecting] = useState(false);

	// Fetch auth schema for custom auth pieces
	useEffect(() => {
		if (authType !== "custom") return;
		let cancelled = false;
		setSchemaLoading(true);

		(async () => {
			try {
				const res = await fetch(`/api/integrations/pieces/${encodeURIComponent(piece.name)}`);
				if (!cancelled && res.ok) {
					const data = await res.json() as { auth?: { props?: Record<string, { name: string; displayName: string; description: string; type: string; required: boolean; defaultValue?: unknown; options?: { label: string; value: unknown }[] }> } };
					if (data.auth?.props && Object.keys(data.auth.props).length > 0) {
						setAuthSchema({ props: data.auth.props });
						// Initialize default values
						const defaults: Record<string, string> = {};
						for (const [key, prop] of Object.entries(data.auth.props)) {
							if (prop.defaultValue !== undefined && prop.defaultValue !== null) {
								defaults[key] = String(prop.defaultValue);
							}
						}
						if (Object.keys(defaults).length > 0) {
							setCustomFields(defaults);
						}
					}
				}
			} catch {
				// Fall through to generic form
			} finally {
				if (!cancelled) setSchemaLoading(false);
			}
		})();

		return () => { cancelled = true; };
	}, [authType, piece.name]);

	// Check OAuth2 availability for this piece
	useEffect(() => {
		if (!isOAuth2Piece) return;
		let cancelled = false;

		(async () => {
			try {
				const res = await fetch(
					`/api/integrations/oauth2/status?pieceName=${encodeURIComponent(piece.name)}`,
				);
				if (!cancelled && res.ok) {
					const data = (await res.json()) as {
						available: boolean;
						provider?: string;
						reason?: string;
					};
					setOauthStatus(data);
					if (!data.available && !isConnected) setShowManualEntry(true);
				}
			} catch {
				if (!cancelled) {
					setOauthStatus({ available: false, reason: "Failed to check OAuth status" });
					if (!isConnected) setShowManualEntry(true);
				}
			} finally {
				if (!cancelled) setOauthChecking(false);
			}
		})();

		return () => { cancelled = true; };
	}, [isOAuth2Piece, piece.name, isConnected]);

	// Close on outside click
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
				onClose();
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onClose]);

	// Close on Escape
	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [onClose]);

	const handleOAuthConnect = () => {
		setOauthConnecting(true);
		setError(null);

		const popup = window.open(
			`/api/integrations/oauth2/authorize?pieceName=${encodeURIComponent(piece.name)}`,
			"oauth2-connect",
			"width=600,height=700,left=200,top=100,popup=yes",
		);

		if (!popup) {
			setError("Popup was blocked. Please allow popups for this site.");
			setOauthConnecting(false);
			return;
		}

		// Poll for popup close
		const timer = setInterval(() => {
			if (popup.closed) {
				clearInterval(timer);
				setOauthConnecting(false);
				// Credential was saved by callback - refresh and close modal
				onSuccess();
			}
		}, 500);
	};

	const handleDisconnect = async () => {
		if (!existingCredential) return;
		setIsDisconnecting(true);
		setError(null);
		try {
			await onDisconnect(existingCredential.dbId);
			onSuccess();
		} catch {
			setError("Failed to disconnect. Please try again.");
		} finally {
			setIsDisconnecting(false);
			setConfirmDisconnect(false);
		}
	};

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
					config.username = username;
					config.password = apiKey;
					break;
				case "custom":
					if (authSchema) {
						Object.assign(config, customFields);
					} else {
						config.apiKey = apiKey;
					}
					break;
				default:
					config.apiKey = apiKey;
			}

			const response = await fetch("/api/integrations/credentials", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pieceName: piece.name,
					displayName: displayName || `My ${piece.displayName} Token`,
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

	// Format relative time
	const connectedAgo = existingCredential?.createdAt
		? (() => {
				const diff = Date.now() - new Date(existingCredential.createdAt).getTime();
				const mins = Math.floor(diff / 60000);
				if (mins < 1) return "just now";
				if (mins < 60) return `${mins}m ago`;
				const hours = Math.floor(mins / 60);
				if (hours < 24) return `${hours}h ago`;
				const days = Math.floor(hours / 24);
				return `${days}d ago`;
			})()
		: null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div
				ref={modalRef}
				className="w-full max-w-md mx-4 rounded-xl bg-[rgb(20,17,32)] border border-white/10 shadow-2xl"
			>
				{/* Header */}
				<div className="flex items-center gap-3 p-5 border-b border-white/[0.06]">
					<PieceIcon piece={piece} size={40} />
					<div className="flex-1 min-w-0">
						<div className="text-base font-medium text-white truncate">
							{piece.displayName}
						</div>
						<div className="text-xs text-white/40 mt-0.5">
							{piece.description}
						</div>
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
					{/* ─── Connected State ────────────────────────── */}
					{isConnected && !showReconnect && (
						<div className="flex flex-col gap-4">
							{/* Connected badge */}
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
												<span className="text-white/25"> &middot; {connectedAgo}</span>
											)}
										</p>
									</div>
									<span className="px-2 py-0.5 text-[10px] rounded-full bg-white/5 text-white/40 border border-white/[0.06]">
										{existingCredential.authType}
									</span>
								</div>
							</div>

							{/* Actions */}
							<div className="flex flex-col gap-2">
								{/* Reconnect option */}
								{isOAuth2Piece && (
									<button
										type="button"
										onClick={() => setShowReconnect(true)}
										className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-lg bg-white/5 border border-white/[0.08] text-white/60 hover:text-white hover:border-white/15 transition-colors"
									>
										<RefreshCwIcon className="size-3.5" />
										Reconnect with different account
									</button>
								)}

								{/* Disconnect */}
								{confirmDisconnect ? (
									<div className="flex flex-col gap-2 p-3 rounded-lg bg-red-500/[0.08] border border-red-500/20">
										<p className="text-xs text-red-300">
											This will remove your {piece.displayName} credentials. Workflows using this integration will stop working.
										</p>
										<div className="flex gap-2 justify-end">
											<button
												type="button"
												onClick={() => setConfirmDisconnect(false)}
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
												{isDisconnecting ? "Disconnecting..." : "Yes, disconnect"}
											</button>
										</div>
									</div>
								) : (
									<button
										type="button"
										onClick={() => setConfirmDisconnect(true)}
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
					{(!isConnected || showReconnect) && (
						<>
							{/* Back button when reconnecting */}
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

							{/* ─── No Auth Needed ──────────────────────── */}
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
													{piece.displayName} works without any API keys or authentication. You can use it directly in your workflows.
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

							{/* ─── OAuth2 Connect Section ─────────────── */}
							{isOAuth2Piece && (
								<>
									{oauthChecking ? (
										<div className="flex items-center justify-center gap-2 py-6 text-white/40">
											<div className="size-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
											<span className="text-sm">Checking OAuth availability...</span>
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
														{showReconnect ? "Reconnect" : "Connect"} with {piece.displayName}
													</>
												)}
											</button>

											{oauthConnecting && (
												<p className="text-xs text-white/40 text-center">
													Complete the sign-in in the popup window...
												</p>
											)}

											{!showReconnect && (
												<>
													{/* Separator */}
													<div className="flex items-center gap-3 py-1">
														<div className="flex-1 h-px bg-white/[0.08]" />
														<span className="text-[11px] text-white/30 uppercase tracking-wider">or paste token manually</span>
														<div className="flex-1 h-px bg-white/[0.08]" />
													</div>

													<button
														type="button"
														onClick={() => setShowManualEntry(!showManualEntry)}
														className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
													>
														<KeyRoundIcon className="size-3" />
														{showManualEntry ? "Hide" : "Show"} manual token entry
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
															`An admin needs to configure an OAuth app for "${oauthStatus?.provider || piece.name}" in Settings > OAuth Apps.`}
													</p>
												</div>
											</div>
											<p className="text-xs text-white/30 mt-1">
												You can still add a token manually below.
											</p>
										</div>
									)}
								</>
							)}

							{/* ─── Manual Token Form ─────────────────── */}
							{showManualEntry && (
								<form onSubmit={handleSubmit} className="flex flex-col gap-4">
									{/* API Key creation link */}
									{API_KEY_LINKS[piece.name] && (
										<a
											href={API_KEY_LINKS[piece.name].url}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/[0.08] border border-blue-500/20 hover:border-blue-500/35 transition-colors group"
										>
											<div className="shrink-0 p-1.5 rounded-md bg-blue-500/15">
												<ExternalLinkIcon className="size-4 text-blue-400" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium text-blue-300 group-hover:text-blue-200 transition-colors">
													{API_KEY_LINKS[piece.name].label}
												</p>
												<p className="text-xs text-white/40 mt-0.5">
													{API_KEY_LINKS[piece.name].description}
												</p>
											</div>
											<ExternalLinkIcon className="size-3.5 text-white/20 group-hover:text-white/40 shrink-0 transition-colors" />
										</a>
									)}

									<div className="flex flex-col gap-1.5">
										<label
											htmlFor="cred-name"
											className="text-xs text-white/50"
										>
											Credential Name
										</label>
										<input
											id="cred-name"
											type="text"
											value={displayName}
											onChange={(e) => setDisplayName(e.target.value)}
											placeholder={`My ${piece.displayName} Token`}
											className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
										/>
									</div>

									{/* Auth type badge (read-only) */}
									{!isOAuth2Piece && (
										<div className="flex items-center gap-2">
											<span className="text-xs text-white/40">Auth type:</span>
											<span className="px-2 py-0.5 text-[11px] rounded-full bg-white/5 text-white/50 border border-white/[0.06]">
												{authType === "basic" ? "Basic Auth (Username + Password)" : authType === "custom" ? "Custom" : "API Key / Token"}
											</span>
										</div>
									)}

									{/* Username field for basic auth */}
									{authType === "basic" && (
										<div className="flex flex-col gap-1.5">
											<label
												htmlFor="cred-username"
												className="text-xs text-white/50"
											>
												Username
											</label>
											<input
												id="cred-username"
												type="text"
												value={username}
												onChange={(e) => setUsername(e.target.value)}
												placeholder="Enter your username"
												className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
												autoFocus={!isOAuth2Piece}
											/>
										</div>
									)}

									{/* Dynamic fields for custom auth */}
									{authType === "custom" && schemaLoading && (
										<div className="flex items-center gap-2 py-3 text-white/40 text-sm">
											<div className="size-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
											Loading fields...
										</div>
									)}
									{authType === "custom" && authSchema && !schemaLoading && (
										<div className="flex flex-col gap-3">
											{Object.entries(authSchema.props).map(([key, prop]) => {
												const isSensitive = /secret|password|token|key/i.test(key) || /secret|password|token|key/i.test(prop.displayName);

												if (prop.type === "CHECKBOX") {
													return (
														<div key={key} className="flex items-center gap-2">
															<input
																id={`custom-${key}`}
																type="checkbox"
																checked={customFields[key] === "true"}
																onChange={(e) => setCustomFields((prev) => ({ ...prev, [key]: e.target.checked ? "true" : "false" }))}
																className="size-4 rounded border border-white/20 bg-white/5 accent-violet-500"
															/>
															<label htmlFor={`custom-${key}`} className="text-xs text-white/50">
																{prop.displayName}
																{prop.required && <span className="text-red-400 ml-0.5">*</span>}
															</label>
															{prop.description && (
																<span className="text-[10px] text-white/25 ml-1">{prop.description}</span>
															)}
														</div>
													);
												}

												if (prop.type === "STATIC_DROPDOWN" && prop.options) {
													return (
														<div key={key} className="flex flex-col gap-1.5">
															<label htmlFor={`custom-${key}`} className="text-xs text-white/50">
																{prop.displayName}
																{prop.required && <span className="text-red-400 ml-0.5">*</span>}
															</label>
															{prop.description && (
																<p className="text-[10px] text-white/25 -mt-0.5">{prop.description}</p>
															)}
															<select
																id={`custom-${key}`}
																value={customFields[key] ?? ""}
																onChange={(e) => setCustomFields((prev) => ({ ...prev, [key]: e.target.value }))}
																className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-white/25"
															>
																<option value="">Select...</option>
																{prop.options.map((opt) => (
																	<option key={String(opt.value)} value={String(opt.value)}>
																		{opt.label}
																	</option>
																))}
															</select>
														</div>
													);
												}

												if (prop.type === "NUMBER") {
													return (
														<div key={key} className="flex flex-col gap-1.5">
															<label htmlFor={`custom-${key}`} className="text-xs text-white/50">
																{prop.displayName}
																{prop.required && <span className="text-red-400 ml-0.5">*</span>}
															</label>
															{prop.description && (
																<p className="text-[10px] text-white/25 -mt-0.5">{prop.description}</p>
															)}
															<input
																id={`custom-${key}`}
																type="number"
																value={customFields[key] ?? ""}
																onChange={(e) => setCustomFields((prev) => ({ ...prev, [key]: e.target.value }))}
																placeholder={prop.displayName}
																className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
															/>
														</div>
													);
												}

												// Default: text/password field
												return (
													<div key={key} className="flex flex-col gap-1.5">
														<label htmlFor={`custom-${key}`} className="text-xs text-white/50">
															{prop.displayName}
															{prop.required && <span className="text-red-400 ml-0.5">*</span>}
														</label>
														{prop.description && (
															<p className="text-[10px] text-white/25 -mt-0.5">{prop.description}</p>
														)}
														<input
															id={`custom-${key}`}
															type={isSensitive ? "password" : "text"}
															value={customFields[key] ?? ""}
															onChange={(e) => setCustomFields((prev) => ({ ...prev, [key]: e.target.value }))}
															placeholder={`Enter ${prop.displayName.toLowerCase()}`}
															className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
														/>
													</div>
												);
											})}
										</div>
									)}

									{/* Generic API Key / Password field (hidden for custom auth with schema) */}
									{!(authType === "custom" && authSchema) && (
									<div className="flex flex-col gap-1.5">
										<label
											htmlFor="cred-key"
											className="text-xs text-white/50"
										>
											{authType === "basic" ? "Password" : "API Key / Token"}
										</label>
										<input
											id="cred-key"
											type="password"
											value={apiKey}
											onChange={(e) => setApiKey(e.target.value)}
											placeholder={authType === "basic" ? "Enter your password" : "Enter your API key or token"}
											className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
											required
											autoFocus={!isOAuth2Piece && authType !== "basic"}
										/>
									</div>
									)}

									{error && (
										<p className="text-sm text-red-400" role="alert">
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
											disabled={isSubmitting || (authType === "custom" && authSchema
												? Object.entries(authSchema.props).some(([k, p]) => p.required && !customFields[k])
												: !apiKey)}
											className="px-4 py-2 text-sm rounded-lg bg-primary-900 text-white hover:bg-primary-800 transition-colors disabled:opacity-40"
										>
											{isSubmitting ? "Saving..." : "Save Credential"}
										</button>
									</div>
								</form>
							)}

							{/* Error shown outside form (for OAuth errors) */}
							{!showManualEntry && error && (
								<p className="text-sm text-red-400" role="alert">
									{error}
								</p>
							)}

							{/* Cancel for non-manual view */}
							{!showManualEntry && !showReconnect && (
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

							{/* Cancel for reconnect oauth-only view */}
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
