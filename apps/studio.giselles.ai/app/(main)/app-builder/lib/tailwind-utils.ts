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
	marginX: /^mx-\d+$/,
	marginY: /^my-\d+$/,
	paddingX: /^px-\d+$/,
	paddingY: /^py-\d+$/,
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
