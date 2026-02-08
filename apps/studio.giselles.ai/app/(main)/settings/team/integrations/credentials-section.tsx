"use client";

import {
	ChevronDownIcon,
	KeyRoundIcon,
	PlusIcon,
	SearchIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PieceCatalogEntry {
	name: string;
	displayName: string;
	category: string;
	authType: string;
}

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
	const [pieces, setPieces] = useState<PieceCatalogEntry[]>([]);
	const [categories, setCategories] = useState<string[]>([]);

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

	// Map piece names to display names for credential cards
	const pieceDisplayNames = useMemo(() => {
		const map = new Map<string, string>();
		for (const piece of pieces) {
			map.set(piece.name, piece.displayName);
		}
		return map;
	}, [pieces]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-lg font-medium text-inverse">
						Third-Party Credentials
					</h2>
					{pieces.length > 0 && (
						<span className="px-2 py-0.5 text-xs rounded-full bg-primary-900/50 text-primary-300 border border-primary-800/30">
							{pieces.length} integrations
						</span>
					)}
				</div>
				<button
					type="button"
					className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-primary-900 text-inverse hover:bg-primary-800 transition-colors"
					onClick={() => setShowAddForm(!showAddForm)}
				>
					{showAddForm ? (
						<>
							<XIcon className="size-4" />
							Close
						</>
					) : (
						<>
							<PlusIcon className="size-4" />
							Add Credential
						</>
					)}
				</button>
			</div>

			{showAddForm && (
				<AddCredentialForm
					pieces={pieces}
					categories={categories}
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
						Add API keys for Slack, Google Sheets, and 600+ other integrations
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
										{pieceDisplayNames.get(cred.pieceName) || cred.pieceName}{" "}
										&middot; {cred.authType}
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

// ─── Searchable Piece Selector ──────────────────────────

function PieceSelector({
	pieces,
	categories,
	value,
	onChange,
}: {
	pieces: PieceCatalogEntry[];
	categories: string[];
	value: string;
	onChange: (pieceName: string, piece: PieceCatalogEntry | null) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);

	// Close dropdown on outside click
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Focus search when opened
	useEffect(() => {
		if (isOpen && searchRef.current) {
			searchRef.current.focus();
		}
	}, [isOpen]);

	const filteredPieces = useMemo(() => {
		let result = pieces;

		if (selectedCategory) {
			result = result.filter((p) => p.category === selectedCategory);
		}

		if (search) {
			const q = search.toLowerCase();
			result = result.filter(
				(p) =>
					p.displayName.toLowerCase().includes(q) ||
					p.name.includes(q) ||
					p.category.toLowerCase().includes(q),
			);
		}

		return result;
	}, [pieces, search, selectedCategory]);

	// Group filtered pieces by category
	const groupedPieces = useMemo(() => {
		const groups = new Map<string, PieceCatalogEntry[]>();
		for (const piece of filteredPieces) {
			const list = groups.get(piece.category) || [];
			list.push(piece);
			groups.set(piece.category, list);
		}
		return groups;
	}, [filteredPieces]);

	const selectedPiece = pieces.find((p) => p.name === value);

	return (
		<div ref={containerRef} className="relative">
			{/* Trigger button */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg bg-bg-900 border border-white/10 text-inverse hover:border-white/20 transition-colors"
			>
				<span className={selectedPiece ? "text-inverse" : "text-text-muted"}>
					{selectedPiece
						? `${selectedPiece.displayName} (${selectedPiece.category})`
						: "Search 600+ integrations..."}
				</span>
				<ChevronDownIcon
					className={`size-4 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{/* Dropdown */}
			{isOpen && (
				<div className="absolute z-50 mt-1 w-full max-h-[400px] rounded-lg bg-bg-900 border border-white/10 shadow-xl overflow-hidden flex flex-col">
					{/* Search */}
					<div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
						<SearchIcon className="size-4 text-text-muted shrink-0" />
						<input
							ref={searchRef}
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search integrations..."
							className="w-full bg-transparent text-sm text-inverse placeholder:text-text-muted outline-none"
						/>
						{search && (
							<button
								type="button"
								onClick={() => setSearch("")}
								className="text-text-muted hover:text-inverse"
							>
								<XIcon className="size-3" />
							</button>
						)}
					</div>

					{/* Category filter chips */}
					<div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-white/5">
						<button
							type="button"
							onClick={() => setSelectedCategory(null)}
							className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
								!selectedCategory
									? "bg-primary-900 text-inverse"
									: "bg-white/5 text-text-muted hover:text-inverse"
							}`}
						>
							All ({pieces.length})
						</button>
						{categories.map((cat) => {
							const count = pieces.filter((p) => p.category === cat).length;
							return (
								<button
									key={cat}
									type="button"
									onClick={() =>
										setSelectedCategory(selectedCategory === cat ? null : cat)
									}
									className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
										selectedCategory === cat
											? "bg-primary-900 text-inverse"
											: "bg-white/5 text-text-muted hover:text-inverse"
									}`}
								>
									{cat} ({count})
								</button>
							);
						})}
					</div>

					{/* Results */}
					<div className="overflow-y-auto max-h-[280px]">
						{filteredPieces.length === 0 ? (
							<div className="px-3 py-4 text-sm text-text-muted text-center">
								No integrations found for &quot;{search}&quot;
							</div>
						) : (
							Array.from(groupedPieces.entries()).map(
								([category, categoryPieces]) => (
									<div key={category}>
										<div className="px-3 py-1.5 text-xs font-medium text-text-muted bg-white/[0.02] sticky top-0">
											{category} ({categoryPieces.length})
										</div>
										{categoryPieces.map((piece) => (
											<button
												key={piece.name}
												type="button"
												onClick={() => {
													onChange(piece.name, piece);
													setIsOpen(false);
													setSearch("");
												}}
												className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors ${
													value === piece.name ? "bg-primary-900/20" : ""
												}`}
											>
												<div className="size-7 rounded-md bg-white/5 flex items-center justify-center text-xs font-medium text-text-muted shrink-0">
													{piece.displayName.charAt(0).toUpperCase()}
												</div>
												<div className="min-w-0 flex-1">
													<div className="text-sm text-inverse truncate">
														{piece.displayName}
													</div>
													<div className="text-xs text-text-muted">
														{piece.authType === "none"
															? "No auth required"
															: piece.authType === "oauth2"
																? "OAuth2"
																: piece.authType === "api_key"
																	? "API Key"
																	: piece.authType === "basic"
																		? "Basic Auth"
																		: "Custom Auth"}
													</div>
												</div>
											</button>
										))}
									</div>
								),
							)
						)}
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Add Credential Form ───────────────────────────────

function AddCredentialForm({
	pieces,
	categories,
	onSuccess,
	onCancel,
	error,
	setError,
}: {
	pieces: PieceCatalogEntry[];
	categories: string[];
	onSuccess: () => void;
	onCancel: () => void;
	error: string | null;
	setError: (error: string | null) => void;
}) {
	const [pieceName, setPieceName] = useState("");
	const [selectedPiece, setSelectedPiece] = useState<PieceCatalogEntry | null>(
		null,
	);
	const [displayName, setDisplayName] = useState("");
	const [authType, setAuthType] = useState("secret_text");
	const [apiKey, setApiKey] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handlePieceChange = (name: string, piece: PieceCatalogEntry | null) => {
		setPieceName(name);
		setSelectedPiece(piece);
		if (piece) {
			// Auto-set auth type based on piece catalog
			const typeMap: Record<string, string> = {
				api_key: "secret_text",
				secret_text: "secret_text",
				oauth2: "oauth2",
				basic: "basic",
				custom: "custom",
				none: "secret_text",
			};
			setAuthType(typeMap[piece.authType] || "secret_text");
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
					displayName:
						displayName || selectedPiece?.displayName || pieceName,
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
				<label htmlFor="piece-selector" className="text-xs text-text-muted">
					Integration
				</label>
				<PieceSelector
					pieces={pieces}
					categories={categories}
					value={pieceName}
					onChange={handlePieceChange}
				/>
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
					placeholder={
						selectedPiece
							? `My ${selectedPiece.displayName} Token`
							: "My API Token"
					}
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
					disabled={isSubmitting || !pieceName}
				>
					{isSubmitting ? "Saving..." : "Save Credential"}
				</button>
			</div>
		</form>
	);
}
