"use client";

import clsx from "clsx/lite";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export interface SelectOption {
	label: string;
	value: string;
	group?: string;
}

interface SearchableSelectProps {
	options: SelectOption[];
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
	loading?: boolean;
	disabled?: boolean;
	/** Allow multiple values (comma-separated) */
	multi?: boolean;
}

export function SearchableSelect({
	options,
	value,
	onChange,
	placeholder = "Select...",
	className,
	loading,
	disabled,
	multi,
}: SearchableSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const selectedValues = useMemo(
		() =>
			multi && value
				? value.split(",").map((v) => v.trim())
				: [value],
		[value, multi],
	);

	const filtered = useMemo(() => {
		if (!search) return options;
		const lower = search.toLowerCase();
		return options.filter(
			(o) =>
				o.label.toLowerCase().includes(lower) ||
				o.value.toLowerCase().includes(lower),
		);
	}, [options, search]);

	// Group options
	const grouped = useMemo(() => {
		const groups: Record<string, SelectOption[]> = {};
		const ungrouped: SelectOption[] = [];
		for (const opt of filtered) {
			if (opt.group) {
				if (!groups[opt.group]) groups[opt.group] = [];
				groups[opt.group].push(opt);
			} else {
				ungrouped.push(opt);
			}
		}
		return { groups, ungrouped };
	}, [filtered]);

	const flatList = useMemo(() => {
		const result: SelectOption[] = [...grouped.ungrouped];
		for (const groupOpts of Object.values(grouped.groups)) {
			result.push(...groupOpts);
		}
		return result;
	}, [grouped]);

	const selectedLabel = useMemo(() => {
		if (multi) {
			const labels = selectedValues
				.map((v) => options.find((o) => o.value === v)?.label)
				.filter(Boolean);
			return labels.length > 0 ? labels.join(", ") : "";
		}
		return options.find((o) => o.value === value)?.label ?? "";
	}, [value, options, multi, selectedValues]);

	const handleSelect = useCallback(
		(optValue: string) => {
			if (multi) {
				const current = new Set(selectedValues.filter(Boolean));
				if (current.has(optValue)) {
					current.delete(optValue);
				} else {
					current.add(optValue);
				}
				onChange(Array.from(current).join(", "));
			} else {
				onChange(optValue);
				setIsOpen(false);
			}
			setSearch("");
		},
		[onChange, multi, selectedValues],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!isOpen) {
				if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
					e.preventDefault();
					setIsOpen(true);
				}
				return;
			}

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setHighlightedIndex((prev) =>
						Math.min(prev + 1, flatList.length - 1),
					);
					break;
				case "ArrowUp":
					e.preventDefault();
					setHighlightedIndex((prev) => Math.max(prev - 1, 0));
					break;
				case "Enter":
					e.preventDefault();
					if (flatList[highlightedIndex]) {
						handleSelect(flatList[highlightedIndex].value);
					}
					break;
				case "Escape":
					e.preventDefault();
					setIsOpen(false);
					setSearch("");
					break;
			}
		},
		[isOpen, flatList, highlightedIndex, handleSelect],
	);

	// Close on outside click
	useEffect(() => {
		if (!isOpen) return;
		const handler = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
				setSearch("");
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [isOpen]);

	// Auto-focus search input when opening
	useEffect(() => {
		if (isOpen && searchInputRef.current) {
			searchInputRef.current.focus();
		}
	}, [isOpen]);

	// Scroll highlighted item into view
	useEffect(() => {
		if (!isOpen || !listRef.current) return;
		const el = listRef.current.children[highlightedIndex] as HTMLElement;
		if (el) {
			el.scrollIntoView({ block: "nearest" });
		}
	}, [highlightedIndex, isOpen]);

	// Reset highlight when search changes
	useEffect(() => {
		setHighlightedIndex(0);
	}, [search]);

	return (
		<div
			ref={containerRef}
			className={clsx("relative", className)}
			onKeyDown={handleKeyDown}
		>
			{/* Trigger button */}
			<button
				type="button"
				className={clsx(
					"w-full flex items-center justify-between rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-left transition-colors",
					disabled
						? "opacity-50 cursor-not-allowed text-text-muted"
						: "text-text hover:border-inverse/20 cursor-pointer",
					isOpen && "ring-1 ring-blue-500/30 border-blue-500/40",
				)}
				onClick={() => {
					if (!disabled) setIsOpen(!isOpen);
				}}
				disabled={disabled}
			>
				<span
					className={clsx(
						"truncate flex-1",
						!selectedLabel && "text-text-muted/50",
					)}
				>
					{loading ? "Loading..." : selectedLabel || placeholder}
				</span>
				<ChevronDownIcon
					className={clsx(
						"size-[12px] shrink-0 ml-[4px] text-inverse/30 transition-transform",
						isOpen && "rotate-180",
					)}
				/>
			</button>

			{/* Dropdown */}
			{isOpen && (
				<div className="absolute z-50 top-full left-0 right-0 mt-[2px] rounded-[6px] border border-border-muted bg-[#1a1a2e] shadow-lg">
					{/* Search input */}
					{options.length > 5 && (
						<div className="flex items-center gap-[6px] px-[8px] py-[6px] border-b border-inverse/5">
							<SearchIcon className="size-[11px] text-inverse/30 shrink-0" />
							<input
								ref={searchInputRef}
								type="text"
								className="flex-1 bg-transparent text-[11px] text-inverse outline-none placeholder:text-inverse/30"
								placeholder="Search..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>
					)}

					{/* Options list */}
					<div
						ref={listRef}
						className="max-h-[200px] overflow-y-auto py-[2px]"
					>
						{flatList.length === 0 ? (
							<div className="px-[10px] py-[8px] text-[11px] text-inverse/30 text-center">
								{loading ? "Loading..." : "No results"}
							</div>
						) : (
							<>
								{/* Ungrouped options */}
								{grouped.ungrouped.map((opt, idx) => {
									const isSelected = selectedValues.includes(
										opt.value,
									);
									const isHighlighted =
										idx === highlightedIndex;
									return (
										<button
											key={opt.value}
											type="button"
											className={clsx(
												"w-full flex items-center gap-[6px] px-[10px] py-[5px] text-left text-[11px] transition-colors",
												isHighlighted
													? "bg-inverse/10"
													: "hover:bg-inverse/5",
												isSelected
													? "text-blue-400"
													: "text-inverse/70",
											)}
											onMouseDown={(e) => {
												e.preventDefault();
												handleSelect(opt.value);
											}}
											onMouseEnter={() =>
												setHighlightedIndex(idx)
											}
										>
											{multi && (
												<span
													className={clsx(
														"size-[12px] rounded-[2px] border flex items-center justify-center shrink-0",
														isSelected
															? "border-blue-400 bg-blue-500/20"
															: "border-inverse/20",
													)}
												>
													{isSelected && (
														<CheckIcon className="size-[8px]" />
													)}
												</span>
											)}
											<span className="truncate flex-1">
												{opt.label}
											</span>
											{!multi && isSelected && (
												<CheckIcon className="size-[10px] text-blue-400 shrink-0" />
											)}
										</button>
									);
								})}

								{/* Grouped options */}
								{Object.entries(grouped.groups).map(
									([groupName, groupOpts]) => (
										<div key={groupName}>
											<div className="px-[10px] py-[3px] text-[9px] text-inverse/30 uppercase tracking-wider font-medium">
												{groupName}
											</div>
											{groupOpts.map((opt) => {
												const flatIdx = flatList.indexOf(opt);
												const isSelected =
													selectedValues.includes(
														opt.value,
													);
												const isHighlighted =
													flatIdx === highlightedIndex;
												return (
													<button
														key={opt.value}
														type="button"
														className={clsx(
															"w-full flex items-center gap-[6px] px-[10px] py-[5px] text-left text-[11px] transition-colors",
															isHighlighted
																? "bg-inverse/10"
																: "hover:bg-inverse/5",
															isSelected
																? "text-blue-400"
																: "text-inverse/70",
														)}
														onMouseDown={(e) => {
															e.preventDefault();
															handleSelect(
																opt.value,
															);
														}}
														onMouseEnter={() =>
															setHighlightedIndex(
																flatIdx,
															)
														}
													>
														{multi && (
															<span
																className={clsx(
																	"size-[12px] rounded-[2px] border flex items-center justify-center shrink-0",
																	isSelected
																		? "border-blue-400 bg-blue-500/20"
																		: "border-inverse/20",
																)}
															>
																{isSelected && (
																	<CheckIcon className="size-[8px]" />
																)}
															</span>
														)}
														<span className="truncate flex-1">
															{opt.label}
														</span>
														{!multi &&
															isSelected && (
																<CheckIcon className="size-[10px] text-blue-400 shrink-0" />
															)}
													</button>
												);
											})}
										</div>
									),
								)}
							</>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
