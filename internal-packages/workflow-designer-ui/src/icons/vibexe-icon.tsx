import type { FC, SVGProps } from "react";

export const VibexeIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 48 48"
		xmlns="http://www.w3.org/2000/svg"
		className="fill-current"
		{...props}
	>
		<title>Vibexe</title>
		<path d="M 3 5 L 14 5 L 24 35 L 34 5 L 45 5 L 24 46 Z" fill="currentColor" />
		<circle cx="3" cy="3" r="2" fill="currentColor" />
		<circle cx="45" cy="3" r="2" fill="currentColor" />
		<circle cx="24" cy="46" r="1.5" fill="currentColor" />
	</svg>
);
