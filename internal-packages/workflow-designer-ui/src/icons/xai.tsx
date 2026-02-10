import clsx from "clsx/lite";
import type { SVGProps } from "react";

export function XaiIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="graphics-symbol"
			className={clsx("fill-current", className)}
			{...props}
		>
			<path d="M3 4L10.5 12L3 20H6L12 13.5L18 20H21L13.5 12L21 4H18L12 10.5L6 4H3Z" />
		</svg>
	);
}
