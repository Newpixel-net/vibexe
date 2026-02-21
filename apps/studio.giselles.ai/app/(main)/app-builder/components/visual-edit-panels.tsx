"use client";

/**
 * Visual Edit Sub-Panels
 *
 * Property editing panels for Text, Style, Colors, Opacity, Spacing, Radius, and Tailwind classes.
 * Each panel appears below the toolbar when its button is clicked.
 */

import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	ChevronDown,
	ChevronUp,
	Minus,
	RotateCcw,
	Strikethrough,
	Underline,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	COLOR_FAMILIES,
	COLOR_SHADES,
	SPACING_SCALE,
	getColorHex,
	getCategoryValues,
	getCurrentValue,
	parseSpacingValue,
	pxToRoundedClass,
	removeCategory,
	replaceClass,
	roundedClassToPx,
} from "../lib/tailwind-utils";

/** Panel wrapper with consistent styling */
function PanelWrapper({
	children,
	onClose,
	width,
}: { children: React.ReactNode; onClose: () => void; width?: string }) {
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);

	return (
		<div
			className="mt-2 p-3 rounded-xl bg-[#1a1a2e]/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150"
			style={{ minWidth: width || "280px", maxWidth: width || "380px" }}
		>
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

/** Numeric input with up/down steppers */
function NumericInput({
	value,
	onChange,
	min = 0,
	max = 999,
	step = 1,
	suffix,
}: {
	value: number;
	onChange: (val: number) => void;
	min?: number;
	max?: number;
	step?: number;
	suffix?: string;
}) {
	const handleStep = useCallback(
		(dir: 1 | -1) => {
			const next = Math.min(max, Math.max(min, value + dir * step));
			onChange(next);
		},
		[value, onChange, min, max, step],
	);

	return (
		<div className="flex items-center gap-0.5 bg-white/[0.06] border border-white/[0.1] rounded-lg overflow-hidden">
			<input
				type="number"
				value={value}
				onChange={(e) => {
					const v = Number.parseFloat(e.target.value);
					if (!Number.isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
				}}
				className="w-12 px-2 py-1 text-xs text-white bg-transparent text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
			/>
			{suffix && (
				<span className="text-[9px] text-white/30 pr-0.5">{suffix}</span>
			)}
			<div className="flex flex-col border-l border-white/[0.08]">
				<button
					type="button"
					onClick={() => handleStep(1)}
					className="px-1 py-0 hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
				>
					<ChevronUp className="w-2.5 h-2.5" />
				</button>
				<button
					type="button"
					onClick={() => handleStep(-1)}
					className="px-1 py-0 hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
				>
					<ChevronDown className="w-2.5 h-2.5" />
				</button>
			</div>
		</div>
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

/** Toggle button group */
function ButtonGroup({
	options,
	value,
	onChange,
}: {
	options: Array<{ value: string; label: React.ReactNode; title?: string }>;
	value: string | null;
	onChange: (val: string) => void;
}) {
	return (
		<div className="flex gap-0.5 bg-white/[0.04] rounded-lg p-0.5">
			{options.map((opt) => {
				const isActive = value === opt.value;
				return (
					<button
						key={opt.value}
						type="button"
						onClick={() => onChange(opt.value)}
						title={opt.title}
						className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all ${
							isActive
								? "bg-violet-500/20 text-violet-300"
								: "text-white/40 hover:bg-white/[0.06] hover:text-white/60"
						}`}
					>
						{opt.label}
					</button>
				);
			})}
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

	// Font size slider value (map text-xs=0 through text-9xl=12)
	const fontSizeOptions = getCategoryValues("fontSize");
	const currentFontSize = getCurrentValue(className, "fontSize");
	const fontSizeIdx = currentFontSize
		? fontSizeOptions.indexOf(currentFontSize)
		: 2; // default text-base

	return (
		<PanelWrapper onClose={onClose} width="340px">
			{/* Font Size: dropdown + slider */}
			<div className="mb-3">
				<Label>Font Size</Label>
				<div className="flex items-center gap-2 mt-1">
					<select
						value={currentFontSize || ""}
						onChange={(e) => handleChange("fontSize", e.target.value)}
						className="px-2 py-1.5 text-xs bg-white/[0.06] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer flex-shrink-0"
					>
						{fontSizeOptions.map((opt) => (
							<option key={opt} value={opt} className="bg-[#1a1a2e]">
								{opt}
							</option>
						))}
					</select>
					<input
						type="range"
						min={0}
						max={fontSizeOptions.length - 1}
						value={fontSizeIdx >= 0 ? fontSizeIdx : 2}
						onChange={(e) =>
							handleChange("fontSize", fontSizeOptions[Number(e.target.value)])
						}
						className="flex-1 accent-violet-500 h-1.5"
					/>
				</div>
			</div>

			{/* Font Weight */}
			<div className="mb-3">
				<TwSelect
					label="Font Weight"
					value={getCurrentValue(className, "fontWeight")}
					options={getCategoryValues("fontWeight")}
					onChange={(v) => handleChange("fontWeight", v)}
				/>
			</div>

			{/* Alignment: icon button group */}
			<div className="mb-3">
				<Label>Alignment</Label>
				<div className="mt-1">
					<ButtonGroup
						options={[
							{ value: "text-left", label: <AlignLeft className="w-3.5 h-3.5 mx-auto" />, title: "Left" },
							{ value: "text-center", label: <AlignCenter className="w-3.5 h-3.5 mx-auto" />, title: "Center" },
							{ value: "text-right", label: <AlignRight className="w-3.5 h-3.5 mx-auto" />, title: "Right" },
							{ value: "text-justify", label: <AlignJustify className="w-3.5 h-3.5 mx-auto" />, title: "Justify" },
						]}
						value={getCurrentValue(className, "textAlign")}
						onChange={(v) => handleChange("textAlign", v)}
					/>
				</div>
			</div>

			{/* Transform: button group */}
			<div className="mb-3">
				<Label>Transform</Label>
				<div className="mt-1">
					<ButtonGroup
						options={[
							{ value: "normal-case", label: "—", title: "Normal" },
							{ value: "uppercase", label: "AA", title: "Uppercase" },
							{ value: "lowercase", label: "aa", title: "Lowercase" },
							{ value: "capitalize", label: "Aa", title: "Capitalize" },
						]}
						value={getCurrentValue(className, "textTransform")}
						onChange={(v) => handleChange("textTransform", v)}
					/>
				</div>
			</div>

			{/* Decoration: icon buttons */}
			<div>
				<Label>Decoration</Label>
				<div className="flex gap-1.5 mt-1">
					{[
						{ value: "underline", icon: <Underline className="w-3.5 h-3.5" />, title: "Underline" },
						{ value: "line-through", icon: <Strikethrough className="w-3.5 h-3.5" />, title: "Strikethrough" },
						{ value: "no-underline", icon: <span className="text-[10px]">none</span>, title: "No decoration" },
					].map((dec) => {
						const isActive = getCurrentValue(className, "textDecoration") === dec.value;
						return (
							<button
								key={dec.value}
								type="button"
								onClick={() => handleChange("textDecoration", dec.value)}
								title={dec.title}
								className={`p-2 rounded-lg transition-all ${
									isActive
										? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
										: "bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08]"
								}`}
							>
								{dec.icon}
							</button>
						);
					})}
				</div>
			</div>
		</PanelWrapper>
	);
}

// ═══════════════════════════════════════════════
// 3. Colors Panel — Full Tailwind Palette
// ═══════════════════════════════════════════════

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
	const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

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

	const handleClear = useCallback(() => {
		const category = colorType === "text" ? "textColor" : "bgColor";
		onUpdate(removeCategory(className, category));
	}, [colorType, className, onUpdate]);

	return (
		<PanelWrapper onClose={onClose} width="360px">
			{/* Tab switcher */}
			<div className="flex gap-2 mb-3">
				<button
					type="button"
					onClick={() => setColorType("text")}
					className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
						colorType === "text"
							? "bg-white/[0.1] text-white"
							: "text-white/40 hover:text-white/60"
					}`}
				>
					Text Color
				</button>
				<button
					type="button"
					onClick={() => setColorType("bg")}
					className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
						colorType === "bg"
							? "bg-white/[0.1] text-white"
							: "text-white/40 hover:text-white/60"
					}`}
				>
					Background
				</button>
				{/* Special colors */}
				<div className="flex gap-1 ml-auto items-center">
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
							className="w-5 h-5 rounded border border-white/[0.15] hover:scale-110 transition-transform"
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

			{/* Full palette grid: 22 families x 11 shades */}
			<div className="max-h-[260px] overflow-y-auto pr-1 space-y-0.5">
				{COLOR_FAMILIES.map((family) => (
					<div key={family} className="flex items-center gap-0.5">
						<button
							type="button"
							onClick={() =>
								setExpandedFamily(expandedFamily === family ? null : family)
							}
							className="w-12 text-[9px] text-white/30 hover:text-white/50 text-right pr-1 flex-shrink-0 truncate transition-colors"
							title={family}
						>
							{family}
						</button>
						<div className="flex gap-px flex-1">
							{COLOR_SHADES.map((shade) => (
								<button
									key={shade}
									type="button"
									onClick={() => handleColorSelect(family, shade)}
									className="flex-1 h-5 rounded-sm hover:scale-y-150 hover:z-10 transition-transform border border-transparent hover:border-white/20"
									style={{ background: getColorHex(family, shade) }}
									title={`${family}-${shade}`}
								/>
							))}
						</div>
					</div>
				))}
			</div>

			{/* Clear color */}
			<button
				type="button"
				onClick={handleClear}
				className="mt-2 flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-white/30 hover:text-white/50 transition-colors"
			>
				<RotateCcw className="w-3 h-3" />
				Clear Color
			</button>
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
// 5. Spacing Panel — Numeric Inputs + 4-Side Toggle
// ═══════════════════════════════════════════════

interface SpacingPanelProps {
	className: string;
	onUpdate: (newClassName: string) => void;
	onClose: () => void;
}

function SpacingNumericControl({
	label,
	category,
	prefix,
	className: cls,
	onUpdate,
}: {
	label: string;
	category: string;
	prefix: string;
	className: string;
	onUpdate: (cls: string) => void;
}) {
	const current = getCurrentValue(cls, category);
	const val = parseSpacingValue(current);

	const handleStep = useCallback(
		(dir: 1 | -1) => {
			const idx = SPACING_SCALE.indexOf(val);
			let next: number;
			if (dir === 1) {
				next =
					idx >= 0 && idx < SPACING_SCALE.length - 1
						? SPACING_SCALE[idx + 1]
						: Math.min(96, val + 1);
			} else {
				next = idx > 0 ? SPACING_SCALE[idx - 1] : Math.max(0, val - 1);
			}
			onUpdate(replaceClass(cls, category, `${prefix}-${next}`));
		},
		[val, cls, category, prefix, onUpdate],
	);

	const handleDirect = useCallback(
		(v: number) => {
			onUpdate(replaceClass(cls, category, `${prefix}-${v}`));
		},
		[cls, category, prefix, onUpdate],
	);

	return (
		<div className="flex items-center gap-1.5">
			<span className="text-[10px] text-white/30 w-5 text-right font-mono">
				{label}
			</span>
			<div className="flex items-center gap-0.5 bg-white/[0.06] border border-white/[0.1] rounded-lg overflow-hidden">
				<button
					type="button"
					onClick={() => handleStep(-1)}
					className="px-1.5 py-1 hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
				>
					<Minus className="w-2.5 h-2.5" />
				</button>
				<input
					type="number"
					value={val}
					onChange={(e) => {
						const v = Number.parseFloat(e.target.value);
						if (!Number.isNaN(v) && v >= 0) handleDirect(v);
					}}
					className="w-8 text-xs text-white bg-transparent text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
				/>
				<button
					type="button"
					onClick={() => handleStep(1)}
					className="px-1.5 py-1 hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
				>
					<span className="text-xs">+</span>
				</button>
			</div>
		</div>
	);
}

export function SpacingPanel({
	className,
	onUpdate,
	onClose,
}: SpacingPanelProps) {
	const [expanded, setExpanded] = useState(false);

	return (
		<PanelWrapper onClose={onClose} width="320px">
			<div className="flex items-center justify-between mb-2">
				<Label>Spacing</Label>
				<button
					type="button"
					onClick={() => setExpanded(!expanded)}
					className="text-[10px] text-white/30 hover:text-white/50 transition-colors px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08]"
				>
					{expanded ? "2-axis" : "4-sides"}
				</button>
			</div>

			<div className="grid grid-cols-2 gap-4">
				{/* Margin */}
				<div>
					<span className="text-[10px] text-white/40 font-medium">Margin</span>
					<div className="flex flex-col gap-1.5 mt-1">
						{expanded ? (
							<>
								<SpacingNumericControl label="T" category="marginTop" prefix="mt" className={className} onUpdate={onUpdate} />
								<SpacingNumericControl label="R" category="marginRight" prefix="mr" className={className} onUpdate={onUpdate} />
								<SpacingNumericControl label="B" category="marginBottom" prefix="mb" className={className} onUpdate={onUpdate} />
								<SpacingNumericControl label="L" category="marginLeft" prefix="ml" className={className} onUpdate={onUpdate} />
							</>
						) : (
							<>
								<SpacingNumericControl label="H" category="marginX" prefix="mx" className={className} onUpdate={onUpdate} />
								<SpacingNumericControl label="V" category="marginY" prefix="my" className={className} onUpdate={onUpdate} />
							</>
						)}
					</div>
				</div>

				{/* Padding */}
				<div>
					<span className="text-[10px] text-white/40 font-medium">Padding</span>
					<div className="flex flex-col gap-1.5 mt-1">
						{expanded ? (
							<>
								<SpacingNumericControl label="T" category="paddingTop" prefix="pt" className={className} onUpdate={onUpdate} />
								<SpacingNumericControl label="R" category="paddingRight" prefix="pr" className={className} onUpdate={onUpdate} />
								<SpacingNumericControl label="B" category="paddingBottom" prefix="pb" className={className} onUpdate={onUpdate} />
								<SpacingNumericControl label="L" category="paddingLeft" prefix="pl" className={className} onUpdate={onUpdate} />
							</>
						) : (
							<>
								<SpacingNumericControl label="H" category="paddingX" prefix="px" className={className} onUpdate={onUpdate} />
								<SpacingNumericControl label="V" category="paddingY" prefix="py" className={className} onUpdate={onUpdate} />
							</>
						)}
					</div>
				</div>
			</div>
		</PanelWrapper>
	);
}

// ═══════════════════════════════════════════════
// 6. Corner Radius Panel — Numeric + Individual Corners
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
	const [showIndividual, setShowIndividual] = useState(false);

	const current = getCurrentValue(className, "borderRadius");
	const currentPx = roundedClassToPx(current);

	const handleAllCorners = useCallback(
		(px: number) => {
			const cls = pxToRoundedClass(px);
			onUpdate(replaceClass(className, "borderRadius", cls));
		},
		[className, onUpdate],
	);

	const handleCorner = useCallback(
		(corner: "roundedTL" | "roundedTR" | "roundedBL" | "roundedBR", px: number) => {
			const prefixMap = {
				roundedTL: "rounded-tl",
				roundedTR: "rounded-tr",
				roundedBL: "rounded-bl",
				roundedBR: "rounded-br",
			};
			const cls = pxToRoundedClass(px, prefixMap[corner]);
			onUpdate(replaceClass(className, corner, cls));
		},
		[className, onUpdate],
	);

	return (
		<PanelWrapper onClose={onClose}>
			<div className="flex items-center justify-between mb-2">
				<Label>Corner Radius</Label>
				<button
					type="button"
					onClick={() => setShowIndividual(!showIndividual)}
					className="text-[10px] text-white/30 hover:text-white/50 transition-colors px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08]"
				>
					{showIndividual ? "All corners" : "Individual"}
				</button>
			</div>

			{showIndividual ? (
				<div className="grid grid-cols-2 gap-2">
					{(
						[
							["roundedTL", "TL"],
							["roundedTR", "TR"],
							["roundedBL", "BL"],
							["roundedBR", "BR"],
						] as const
					).map(([corner, label]) => {
						const val = roundedClassToPx(getCurrentValue(className, corner));
						return (
							<div key={corner} className="flex items-center gap-1.5">
								<span className="text-[10px] text-white/30 w-5">{label}</span>
								<NumericInput
									value={val}
									onChange={(v) => handleCorner(corner, v)}
									suffix="px"
								/>
							</div>
						);
					})}
				</div>
			) : (
				<div className="flex items-center gap-3">
					<NumericInput
						value={currentPx}
						onChange={handleAllCorners}
						suffix="px"
					/>
					<input
						type="range"
						min={0}
						max={48}
						value={Math.min(48, currentPx)}
						onChange={(e) => handleAllCorners(Number(e.target.value))}
						className="flex-1 accent-violet-500 h-1.5"
					/>
					<button
						type="button"
						onClick={() => handleAllCorners(9999)}
						className={`px-2 py-1 text-[10px] rounded-lg transition-all ${
							currentPx >= 9999
								? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
								: "bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08]"
						}`}
					>
						Full
					</button>
				</div>
			)}
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
