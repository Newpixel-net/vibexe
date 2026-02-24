import type { FC, SVGProps } from "react";

export const VibexeLogo: FC<SVGProps<SVGSVGElement>> = (props) => {
	return (
		<svg
			viewBox="0 0 220 48"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<title>Vibexe Logo</title>
			{/* V Mark — bold geometric V with tapered arms */}
			<path d="M 3 5 L 14 5 L 24 35 L 34 5 L 45 5 L 24 46 Z" />
			{/* Three accent nodes at the V vertices */}
			<circle cx="3" cy="3" r="2" />
			<circle cx="45" cy="3" r="2" />
			<circle cx="24" cy="46" r="1.5" />
			{/* Wordmark */}
			<text
				x="58"
				y="36"
				fontFamily="'DM Sans', system-ui, -apple-system, sans-serif"
				fontWeight="600"
				fontSize="30"
				letterSpacing="2.5"
			>
				vibexe
			</text>
		</svg>
	);
};

/**
 * Standalone V mark icon — used for compact branding (e.g. mobile, loading states).
 * Responds to `fill-*` Tailwind classes just like VibexeLogo.
 */
export const VibexeIcon: FC<SVGProps<SVGSVGElement>> = (props) => {
	return (
		<svg
			viewBox="0 0 48 48"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<title>Vibexe</title>
			<path d="M 3 5 L 14 5 L 24 35 L 34 5 L 45 5 L 24 46 Z" />
			<circle cx="3" cy="3" r="2" />
			<circle cx="45" cy="3" r="2" />
			<circle cx="24" cy="46" r="1.5" />
		</svg>
	);
};
