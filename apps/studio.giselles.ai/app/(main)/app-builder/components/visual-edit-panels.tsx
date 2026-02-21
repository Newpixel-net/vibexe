"use client";

/**
 * Visual Edit Sub-Panels
 *
 * Property editing panels for Text, Style, Colors, Opacity, Spacing, Radius, and Tailwind classes.
 * Each panel appears below the toolbar when its button is clicked.
 */

import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	getCategoryValues,
	getCurrentValue,
	replaceClass,
} from "../lib/tailwind-utils";

/** Panel wrapper with consistent styling */
function PanelWrapper({
	children,
	onClose,
}: { children: React.ReactNode; onClose: () => void }) {
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);

	return (
		<div className="mt-2 p-3 rounded-xl bg-[#1a1a2e]/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 min-w-[280px] max-w-[380px]">
			{children}
		</div>
	);
}

/** Label component */
function Label({ children }: { children: React.ReactNode }) {
	return (
		<span className="text-[10px] uppercase tracking-wider text-white/30 font-medium">
			{children}
		</span>
	);
}

/** Select dropdown */
function TwSelect({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string | null;
	options: string[];
	onChange: (val: string) => void;
}) {
	return (
		<div className="flex flex-col gap-1">
			<Label>{label}</Label>
			<select
				value={value || ""}
				onChange={(e) => onChange(e.target.value)}
				className="px-2 py-1.5 text-xs bg-white/[0.06] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
			>
				<option value="" className="bg-[#1a1a2e]">
					--
				</option>
				{options.map((opt) => (
					<option key={opt} value={opt} className="bg-[#1a1a2e]">
						{opt}
					</option>
				))}
			</select>
		</div>
	);
}

// ═══════════════════════════════════════════════
// 1. Text Content Panel
// ═══════════════════════════════════════════════

interface TextContentPanelProps {
	textContent: string;
	onUpdate: (newText: string) => void;
	onClose: () => void;
}

export function TextContentPanel({
	textContent,
	onUpdate,
	onClose,
}: TextContentPanelProps) {
	const [value, setValue] = useState(textContent.trim());

	const handleApply = useCallback(() => {
		onUpdate(value);
	}, [value, onUpdate]);

	return (
		<PanelWrapper onClose={onClose}>
			<Label>Text Content</Label>
			<textarea
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onBlur={handleApply}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						handleApply();
					}
				}}
				rows={3}
				className="mt-1.5 w-full px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.1] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
				autoFocus
			/>
		</PanelWrapper>
	);
}

// ═══════════════════════════════════════════════
// 2. Text Style Panel
// ═══════════════════════════════════════════════

interface TextStylePanelProps {
	className: string;
	onUpdate: (newClassName: string) => void;
	onClose: () => void;
}

export function TextStylePanel({
	className,
	onUpdate,
	onClose,
}: TextStylePanelProps) {
	const handleChange = useCallback(
		(category: string, value: string) => {
			onUpdate(replaceClass(className, category, value));
		},
		[className, onUpdate],
	);

	return (
		<PanelWrapper onClose={onClose}>
			<div className="grid grid-cols-2 gap-3">
				<TwSelect
					label="Font Size"
					value={getCurrentValue(className, "fontSize")}
					options={getCategoryValues("fontSize")}
					onChange={(v) => handleChange("fontSize", v)}
				/>
				<TwSelect
					label="Font Weight"
					value={getCurrentValue(className, "fontWeight")}
					options={getCategoryValues("fontWeight")}
					onChange={(v) => handleChange("fontWeight", v)}
				/>
				<TwSelect
					label="Alignment"
					value={getCurrentValue(className, "textAlign")}
					options={getCategoryValues("textAlign")}
					onChange={(v) => handleChange("textAlign", v)}
				/>
				<TwSelect
					label="Transform"
					value={getCurrentValue(className, "textTransform")}
					options={getCategoryValues("textTransform")}
					onChange={(v) => handleChange("textTransform", v)}
				/>
			</div>
			<div className="mt-3 flex gap-2">
				<Label>Decoration</Label>
				<div className="flex gap-1 ml-auto">
					{getCategoryValues("textDecoration").map((dec) => {
						const isActive =
							getCurrentValue(className, "textDecoration") === dec;
						return (
							<button
								key={dec}
								type="button"
								onClick={() => handleChange("textDecoration", dec)}
								className={`px-2 py-1 text-[10px] rounded ${
									isActive
										? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
										: "bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08]"
								} transition-all`}
							>
								{dec}
							</button>
						);
					})}
				</div>
			</div>
		</PanelWrapper>
	);
}

// ═══════════════════════════════════════════════
// 3. Colors Panel
// ═══════════════════════════════════════════════

const COLOR_PALETTE = [
	"slate",
	"gray",
	"zinc",
	"red",
	"orange",
	"amber",
	"yellow",
	"lime",
	"green",
	"emerald",
	"teal",
	"cyan",
	"sky",
	"blue",
	"indigo",
	"violet",
	"purple",
	"fuchsia",
	"pink",
	"rose",
];

const COLOR_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** Rough hex approximation for Tailwind colors (subset) */
const COLOR_HEX: Record<string, Record<number, string>> = {
	slate: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a", 950: "#020617" },
	red: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5", 400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b", 900: "#7f1d1d", 950: "#450a0a" },
	blue: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a", 950: "#172554" },
	green: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d", 800: "#166534", 900: "#14532d", 950: "#052e16" },
	violet: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95", 950: "#2e1065" },
	amber: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f", 950: "#451a03" },
	pink: { 50: "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d", 800: "#9d174d", 900: "#831843", 950: "#500724" },
	cyan: { 50: "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 300: "#67e8f9", 400: "#22d3ee", 500: "#06b6d4", 600: "#0891b2", 700: "#0e7490", 800: "#155e75", 900: "#164e63", 950: "#083344" },
	teal: { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 900: "#134e4a", 950: "#042f2e" },
};

function getColorHex(name: string, shade: number): string {
	return COLOR_HEX[name]?.[shade] || "#888";
}

interface ColorsPanelProps {
	className: string;
	onUpdate: (newClassName: string) => void;
	onClose: () => void;
}

export function ColorsPanel({
	className,
	onUpdate,
	onClose,
}: ColorsPanelProps) {
	const [colorType, setColorType] = useState<"text" | "bg">("text");

	const handleColorSelect = useCallback(
		(color: string, shade: number) => {
			const category = colorType === "text" ? "textColor" : "bgColor";
			const twClass =
				colorType === "text"
					? `text-${color}-${shade}`
					: `bg-${color}-${shade}`;
			onUpdate(replaceClass(className, category, twClass));
		},
		[colorType, className, onUpdate],
	);

	return (
		<PanelWrapper onClose={onClose}>
			<div className="flex gap-2 mb-3">
				<button
					type="button"
					onClick={() => setColorType("text")}
					className={`px-3 py-1 text-xs rounded-lg transition-all ${
						colorType === "text"
							? "bg-white/[0.1] text-white"
							: "text-white/40 hover:text-white/60"
					}`}
				>
					Text
				</button>
				<button
					type="button"
					onClick={() => setColorType("bg")}
					className={`px-3 py-1 text-xs rounded-lg transition-all ${
						colorType === "bg"
							? "bg-white/[0.1] text-white"
							: "text-white/40 hover:text-white/60"
					}`}
				>
					Background
				</button>
				{/* Special: white/black/transparent */}
				<div className="flex gap-1 ml-auto">
					{["white", "black", "transparent"].map((c) => (
						<button
							key={c}
							type="button"
							onClick={() =>
								onUpdate(
									replaceClass(
										className,
										colorType === "text" ? "textColor" : "bgColor",
										`${colorType === "text" ? "text" : "bg"}-${c}`,
									),
								)
							}
							className="w-5 h-5 rounded border border-white/[0.15]"
							style={{
								background:
									c === "white"
										? "#fff"
										: c === "black"
											? "#000"
											: "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50%/8px 8px",
							}}
							title={c}
						/>
					))}
				</div>
			</div>
			<div className="grid grid-cols-10 gap-0.5 max-h-[200px] overflow-y-auto">
				{COLOR_PALETTE.map((color) =>
					[400, 500, 600].map((shade) => (
						<button
							key={`${color}-${shade}`}
							type="button"
							onClick={() => handleColorSelect(color, shade)}
							className="w-5 h-5 rounded-sm border border-white/[0.06] hover:scale-125 transition-transform"
							style={{ background: getColorHex(color, shade) }}
							title={`${color}-${shade}`}
						/>
					)),
				)}
			</div>
		</PanelWrapper>
	);
}

// ═══════════════════════════════════════════════
// 4. Opacity Panel
// ═══════════════════════════════════════════════

interface OpacityPanelProps {
	className: string;
	onUpdate: (newClassName: string) => void;
	onClose: () => void;
}

export function OpacityPanel({
	className,
	onUpdate,
	onClose,
}: OpacityPanelProps) {
	const current = getCurrentValue(className, "opacity");
	const currentNum = current
		? Number.parseInt(current.replace("opacity-", ""), 10)
		: 100;

	const handleChange = useCallback(
		(val: number) => {
			onUpdate(replaceClass(className, "opacity", `opacity-${val}`));
		},
		[className, onUpdate],
	);

	return (
		<PanelWrapper onClose={onClose}>
			<Label>Opacity</Label>
			<div className="flex items-center gap-3 mt-2">
				<input
					type="range"
					min={0}
					max={100}
					step={5}
					value={currentNum}
					onChange={(e) => handleChange(Number(e.target.value))}
					className="flex-1 accent-violet-500"
				/>
				<span className="text-xs text-white/60 w-8 text-right">
					{currentNum}%
				</span>
			</div>
		</PanelWrapper>
	);
}

// ═══════════════════════════════════════════════
// 5. Spacing Panel
// ═══════════════════════════════════════════════

interface SpacingPanelProps {
	className: string;
	onUpdate: (newClassName: string) => void;
	onClose: () => void;
}

function SpacingControl({
	label,
	category,
	prefix,
	className,
	onUpdate,
}: {
	label: string;
	category: string;
	prefix: string;
	className: string;
	onUpdate: (cls: string) => void;
}) {
	const current = getCurrentValue(className, category);
	const match = current?.match(/-(\d+)$/);
	const val = match ? Number.parseInt(match[1], 10) : 0;

	return (
		<div className="flex items-center gap-2">
			<span className="text-[10px] text-white/30 w-6">{label}</span>
			<button
				type="button"
				onClick={() =>
					onUpdate(
						replaceClass(
							className,
							category,
							`${prefix}-${Math.max(0, val - 1)}`,
						),
					)
				}
				className="w-6 h-6 rounded bg-white/[0.06] flex items-center justify-center text-white/40 hover:bg-white/[0.1] hover:text-white/70 transition-colors"
			>
				<Minus className="w-3 h-3" />
			</button>
			<span className="text-xs text-white/60 w-6 text-center">{val}</span>
			<button
				type="button"
				onClick={() =>
					onUpdate(
						replaceClass(className, category, `${prefix}-${val + 1}`),
					)
				}
				className="w-6 h-6 rounded bg-white/[0.06] flex items-center justify-center text-white/40 hover:bg-white/[0.1] hover:text-white/70 transition-colors"
			>
				<Plus className="w-3 h-3" />
			</button>
		</div>
	);
}

export function SpacingPanel({
	className,
	onUpdate,
	onClose,
}: SpacingPanelProps) {
	return (
		<PanelWrapper onClose={onClose}>
			<div className="grid grid-cols-2 gap-3">
				<div>
					<Label>Margin</Label>
					<div className="flex flex-col gap-1.5 mt-1.5">
						<SpacingControl
							label="H"
							category="marginX"
							prefix="mx"
							className={className}
							onUpdate={onUpdate}
						/>
						<SpacingControl
							label="V"
							category="marginY"
							prefix="my"
							className={className}
							onUpdate={onUpdate}
						/>
					</div>
				</div>
				<div>
					<Label>Padding</Label>
					<div className="flex flex-col gap-1.5 mt-1.5">
						<SpacingControl
							label="H"
							category="paddingX"
							prefix="px"
							className={className}
							onUpdate={onUpdate}
						/>
						<SpacingControl
							label="V"
							category="paddingY"
							prefix="py"
							className={className}
							onUpdate={onUpdate}
						/>
					</div>
				</div>
			</div>
		</PanelWrapper>
	);
}

// ═══════════════════════════════════════════════
// 6. Corner Radius Panel
// ═══════════════════════════════════════════════

interface CornerRadiusPanelProps {
	className: string;
	onUpdate: (newClassName: string) => void;
	onClose: () => void;
}

export function CornerRadiusPanel({
	className,
	onUpdate,
	onClose,
}: CornerRadiusPanelProps) {
	const options = getCategoryValues("borderRadius");
	const current = getCurrentValue(className, "borderRadius");

	return (
		<PanelWrapper onClose={onClose}>
			<Label>Corner Radius</Label>
			<div className="flex flex-wrap gap-1.5 mt-2">
				{options.map((opt) => {
					const isActive = current === opt;
					return (
						<button
							key={opt}
							type="button"
							onClick={() =>
								onUpdate(replaceClass(className, "borderRadius", opt))
							}
							className={`px-2.5 py-1 text-[11px] rounded-lg transition-all ${
								isActive
									? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
									: "bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60"
							}`}
						>
							{opt.replace("rounded-", "").replace("rounded", "default") || "default"}
						</button>
					);
				})}
			</div>
		</PanelWrapper>
	);
}

// ═══════════════════════════════════════════════
// 7. Tailwind Classes Panel (raw editor)
// ═══════════════════════════════════════════════

interface TailwindClassesPanelProps {
	className: string;
	onUpdate: (newClassName: string) => void;
	onClose: () => void;
}

export function TailwindClassesPanel({
	className,
	onUpdate,
	onClose,
}: TailwindClassesPanelProps) {
	const [value, setValue] = useState(className);

	const handleApply = useCallback(() => {
		onUpdate(value);
	}, [value, onUpdate]);

	return (
		<PanelWrapper onClose={onClose}>
			<Label>Tailwind Classes</Label>
			<textarea
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onBlur={handleApply}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						handleApply();
					}
				}}
				rows={3}
				className="mt-1.5 w-full px-3 py-2 text-xs font-mono bg-white/[0.06] border border-white/[0.1] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
				autoFocus
			/>
			<button
				type="button"
				onClick={handleApply}
				className="mt-2 w-full py-1.5 text-xs rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white transition-all"
			>
				Apply
			</button>
		</PanelWrapper>
	);
}
