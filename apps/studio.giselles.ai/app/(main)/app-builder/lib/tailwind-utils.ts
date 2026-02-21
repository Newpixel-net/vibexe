/**
 * Tailwind Utility Engine
 *
 * Parse and manipulate Tailwind CSS classes for visual editing.
 */

/** Category prefixes for common Tailwind utilities */
const CATEGORY_PREFIXES: Record<string, string[]> = {
	fontSize: ["text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl", "text-7xl", "text-8xl", "text-9xl"],
	fontWeight: ["font-thin", "font-extralight", "font-light", "font-normal", "font-medium", "font-semibold", "font-bold", "font-extrabold", "font-black"],
	textAlign: ["text-left", "text-center", "text-right", "text-justify"],
	textDecoration: ["underline", "overline", "line-through", "no-underline"],
	textTransform: ["uppercase", "lowercase", "capitalize", "normal-case"],
	opacity: ["opacity-0", "opacity-5", "opacity-10", "opacity-15", "opacity-20", "opacity-25", "opacity-30", "opacity-35", "opacity-40", "opacity-45", "opacity-50", "opacity-55", "opacity-60", "opacity-65", "opacity-70", "opacity-75", "opacity-80", "opacity-85", "opacity-90", "opacity-95", "opacity-100"],
	borderRadius: ["rounded-none", "rounded-sm", "rounded", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl", "rounded-full"],
	display: ["block", "inline-block", "inline", "flex", "inline-flex", "grid", "inline-grid", "hidden", "table", "table-row", "table-cell"],
	shadow: ["shadow-none", "shadow-sm", "shadow", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl", "shadow-inner"],
	borderWidth: ["border-0", "border", "border-2", "border-4", "border-8"],
};

/** Prefix patterns for category detection */
const CATEGORY_PATTERNS: Record<string, RegExp> = {
	fontSize: /^text-(xs|sm|base|lg|xl|[2-9]xl)$/,
	fontWeight: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
	textColor: /^text-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent|current)-?\d*\/??\d*$/,
	bgColor: /^bg-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent|current)-?\d*\/??\d*$/,
	textAlign: /^text-(left|center|right|justify)$/,
	textDecoration: /^(underline|overline|line-through|no-underline)$/,
	textTransform: /^(uppercase|lowercase|capitalize|normal-case)$/,
	opacity: /^opacity-\d+$/,
	borderRadius: /^rounded(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?$/,
	roundedTL: /^rounded-tl(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?$/,
	roundedTR: /^rounded-tr(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?$/,
	roundedBL: /^rounded-bl(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?$/,
	roundedBR: /^rounded-br(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?$/,
	marginX: /^mx-\d+$/,
	marginY: /^my-\d+$/,
	marginTop: /^mt-\d+$/,
	marginRight: /^mr-\d+$/,
	marginBottom: /^mb-\d+$/,
	marginLeft: /^ml-\d+$/,
	paddingX: /^px-\d+$/,
	paddingY: /^py-\d+$/,
	paddingTop: /^pt-\d+$/,
	paddingRight: /^pr-\d+$/,
	paddingBottom: /^pb-\d+$/,
	paddingLeft: /^pl-\d+$/,
	display: /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|table|table-row|table-cell)$/,
	shadow: /^shadow(-none|-sm|-md|-lg|-xl|-2xl|-inner)?$/,
	borderWidth: /^border(-0|-2|-4|-8)?$/,
	borderColor: /^border-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent)-?\d*$/,
	width: /^w-(\d+|auto|full|screen|fit|min|max|px|0\.5|1\.5|2\.5|3\.5|1\/[2-6]|[2-5]\/[3-6])$/,
	height: /^h-(\d+|auto|full|screen|fit|min|max|px|0\.5|1\.5|2\.5|3\.5)$/,
};

export interface ParsedClasses {
	[category: string]: string;
}

/**
 * Parse a className string into a structured map of category -> class.
 */
export function parseClasses(className: string): ParsedClasses {
	const result: ParsedClasses = {};
	const classes = className.split(/\s+/).filter(Boolean);

	for (const cls of classes) {
		for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
			if (pattern.test(cls)) {
				result[category] = cls;
				break;
			}
		}
	}

	return result;
}

/**
 * Replace a class in a specific category, keeping all other classes.
 */
export function replaceClass(
	className: string,
	category: string,
	newValue: string,
): string {
	const pattern = CATEGORY_PATTERNS[category];
	if (!pattern) return addClass(className, newValue);

	const classes = className.split(/\s+/).filter(Boolean);
	let replaced = false;

	const result = classes.map((cls) => {
		if (pattern.test(cls)) {
			replaced = true;
			return newValue;
		}
		return cls;
	});

	if (!replaced) {
		result.push(newValue);
	}

	return result.join(" ");
}

/**
 * Remove a class matching a specific category.
 */
export function removeCategory(className: string, category: string): string {
	const pattern = CATEGORY_PATTERNS[category];
	if (!pattern) return className;

	return className
		.split(/\s+/)
		.filter((cls) => !pattern.test(cls))
		.join(" ");
}

/**
 * Add a class if not already present.
 */
export function addClass(className: string, newClass: string): string {
	const classes = className.split(/\s+/).filter(Boolean);
	if (!classes.includes(newClass)) {
		classes.push(newClass);
	}
	return classes.join(" ");
}

/**
 * Remove a class if present.
 */
export function removeClass(className: string, classToRemove: string): string {
	return className
		.split(/\s+/)
		.filter((cls) => cls !== classToRemove)
		.join(" ");
}

/**
 * Get available values for a category.
 */
export function getCategoryValues(category: string): string[] {
	return CATEGORY_PREFIXES[category] || [];
}

/**
 * Detect the current value for a category from a className string.
 */
export function getCurrentValue(
	className: string,
	category: string,
): string | null {
	const parsed = parseClasses(className);
	return parsed[category] || null;
}

/** Spacing scale for margin/padding */
export const SPACING_SCALE = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];

/**
 * Get the next spacing value up or down.
 */
export function stepSpacing(current: string, direction: "up" | "down"): string {
	const prefix = current.replace(/-[\d.]+$/, "-");
	const match = current.match(/-(\d+\.?\d*)$/);
	const val = match ? Number.parseFloat(match[1]) : 0;
	const idx = SPACING_SCALE.indexOf(val);

	if (direction === "up") {
		const next = idx >= 0 && idx < SPACING_SCALE.length - 1 ? SPACING_SCALE[idx + 1] : val + 1;
		return `${prefix}${next}`;
	}
	const next = idx > 0 ? SPACING_SCALE[idx - 1] : Math.max(0, val - 1);
	return `${prefix}${next}`;
}

/**
 * Parse a spacing value from a Tailwind class string.
 * e.g., "mx-4" -> 4, "pt-0.5" -> 0.5, "mb-12" -> 12
 */
export function parseSpacingValue(cls: string | null): number {
	if (!cls) return 0;
	const match = cls.match(/-(\d+\.?\d*)$/);
	return match ? Number.parseFloat(match[1]) : 0;
}

/**
 * Map a rounded pixel value to the closest Tailwind border-radius class.
 */
const RADIUS_PX_MAP: Array<[number, string]> = [
	[0, "rounded-none"],
	[2, "rounded-sm"],
	[4, "rounded"],
	[6, "rounded-md"],
	[8, "rounded-lg"],
	[12, "rounded-xl"],
	[16, "rounded-2xl"],
	[24, "rounded-3xl"],
	[9999, "rounded-full"],
];

export function pxToRoundedClass(px: number, prefix = "rounded"): string {
	if (px >= 9999) return `${prefix}-full`;
	// Find the closest standard value
	let closest = RADIUS_PX_MAP[0];
	let minDiff = Math.abs(px - closest[0]);
	for (const entry of RADIUS_PX_MAP) {
		const diff = Math.abs(px - entry[0]);
		if (diff < minDiff) {
			minDiff = diff;
			closest = entry;
		}
	}
	// If close to a standard value, use it; otherwise use arbitrary
	if (minDiff <= 1) {
		return prefix === "rounded" ? closest[1] : closest[1].replace("rounded", prefix);
	}
	return `${prefix}-[${px}px]`;
}

export function roundedClassToPx(cls: string | null): number {
	if (!cls) return 4; // default 'rounded'
	for (const [px, name] of RADIUS_PX_MAP) {
		if (cls === name || cls.endsWith(name.replace("rounded", ""))) return px;
	}
	// Check for arbitrary value
	const match = cls.match(/\[(\d+)px\]/);
	if (match) return Number.parseInt(match[1], 10);
	return 4;
}

/** Full Tailwind v3 color palette hex values */
export const TAILWIND_COLORS: Record<string, Record<number, string>> = {
	slate: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a", 950: "#020617" },
	gray: { 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db", 400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151", 800: "#1f2937", 900: "#111827", 950: "#030712" },
	zinc: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#09090b" },
	neutral: { 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373", 600: "#525252", 700: "#404040", 800: "#262626", 900: "#171717", 950: "#0a0a0a" },
	stone: { 50: "#fafaf9", 100: "#f5f5f4", 200: "#e7e5e4", 300: "#d6d3d1", 400: "#a8a29e", 500: "#78716c", 600: "#57534e", 700: "#44403c", 800: "#292524", 900: "#1c1917", 950: "#0c0a09" },
	red: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5", 400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b", 900: "#7f1d1d", 950: "#450a0a" },
	orange: { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74", 400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412", 900: "#7c2d12", 950: "#431407" },
	amber: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f", 950: "#451a03" },
	yellow: { 50: "#fefce8", 100: "#fef9c3", 200: "#fef08a", 300: "#fde047", 400: "#facc15", 500: "#eab308", 600: "#ca8a04", 700: "#a16207", 800: "#854d0e", 900: "#713f12", 950: "#422006" },
	lime: { 50: "#f7fee7", 100: "#ecfccb", 200: "#d9f99d", 300: "#bef264", 400: "#a3e635", 500: "#84cc16", 600: "#65a30d", 700: "#4d7c0f", 800: "#3f6212", 900: "#365314", 950: "#1a2e05" },
	green: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d", 800: "#166534", 900: "#14532d", 950: "#052e16" },
	emerald: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b", 950: "#022c22" },
	teal: { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 900: "#134e4a", 950: "#042f2e" },
	cyan: { 50: "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 300: "#67e8f9", 400: "#22d3ee", 500: "#06b6d4", 600: "#0891b2", 700: "#0e7490", 800: "#155e75", 900: "#164e63", 950: "#083344" },
	sky: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e", 950: "#082f49" },
	blue: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a", 950: "#172554" },
	indigo: { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81", 950: "#1e1b4b" },
	violet: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95", 950: "#2e1065" },
	purple: { 50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8b4fe", 400: "#c084fc", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce", 800: "#6b21a8", 900: "#581c87", 950: "#3b0764" },
	fuchsia: { 50: "#fdf4ff", 100: "#fae8ff", 200: "#f5d0fe", 300: "#f0abfc", 400: "#e879f9", 500: "#d946ef", 600: "#c026d3", 700: "#a21caf", 800: "#86198f", 900: "#701a75", 950: "#4a044e" },
	pink: { 50: "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d", 800: "#9d174d", 900: "#831843", 950: "#500724" },
	rose: { 50: "#fff1f2", 100: "#ffe4e8", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337", 950: "#4c0519" },
};

export const COLOR_FAMILIES = Object.keys(TAILWIND_COLORS);
export const COLOR_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export function getColorHex(family: string, shade: number): string {
	return TAILWIND_COLORS[family]?.[shade] || "#888";
}
