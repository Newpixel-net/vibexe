"use client";

import {
	ChevronDownIcon,
	ChevronUpIcon,
	KeyRoundIcon,
	PlusIcon,
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
				className="object-contain brightness-0 invert opacity-80"
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
					{visiblePieces.map((piece) => (
						<button
							key={piece.name}
							type="button"
							onClick={() => setAddingPiece(piece)}
							className="flex items-start gap-3 p-4 rounded-xl bg-[rgb(27,23,40)] border border-white/[0.08] hover:border-white/20 transition-all text-left group"
						>
							<div className="shrink-0 mt-0.5">
								<PieceIcon piece={piece} size={40} />
							</div>
							<div className="min-w-0 flex-1">
								<div className="text-sm font-medium text-white group-hover:text-white/90 truncate">
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
					))}
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
					onClose={() => {
						setAddingPiece(null);
						setError(null);
					}}
					onSuccess={() => {
						setAddingPiece(null);
						setError(null);
						fetchCredentials();
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
	onClose,
	onSuccess,
	error,
	setError,
}: {
	piece: PieceCatalogEntry;
	onClose: () => void;
	onSuccess: () => void;
	error: string | null;
	setError: (error: string | null) => void;
}) {
	const [displayName, setDisplayName] = useState("");
	const [authType, setAuthType] = useState(() => {
		const typeMap: Record<string, string> = {
			api_key: "secret_text",
			secret_text: "secret_text",
			oauth2: "oauth2",
			basic: "basic",
			custom: "custom",
			none: "secret_text",
		};
		return typeMap[piece.authType] || "secret_text";
	});
	const [apiKey, setApiKey] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const modalRef = useRef<HTMLDivElement>(null);

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

				{/* Form */}
				<form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
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

					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="cred-auth"
							className="text-xs text-white/50"
						>
							Auth Type
						</label>
						<select
							id="cred-auth"
							value={authType}
							onChange={(e) => setAuthType(e.target.value)}
							className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-white/25"
						>
							<option value="secret_text">API Key / Token</option>
							<option value="oauth2">OAuth2 Access Token</option>
							<option value="basic">Basic Auth</option>
							<option value="custom">Custom</option>
						</select>
					</div>

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
							placeholder="Enter your API key or token"
							className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
							required
							autoFocus
						/>
					</div>

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
							disabled={isSubmitting || !apiKey}
							className="px-4 py-2 text-sm rounded-lg bg-primary-900 text-white hover:bg-primary-800 transition-colors disabled:opacity-40"
						>
							{isSubmitting ? "Saving..." : "Save Credential"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
