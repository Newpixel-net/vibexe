import clsx from "clsx/lite";
import type { SVGProps } from "react";

export function NvidiaIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
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
			<path d="M8.948 8.798V7.168C9.099 7.155 9.252 7.145 9.406 7.14C12.307 7.028 14.252 9.134 14.252 9.134L11.47 12.354C11.47 12.354 10.074 10.778 8.948 10.938V14.938C11.96 14.513 14.252 12.354 14.252 12.354L18.4 16.09C18.4 16.09 15.494 19.556 9.966 19.556C9.61 19.556 9.271 19.538 8.948 19.502V21.502H20V3H8.948V8.798ZM8.948 19.502C5.832 19.123 4 16.09 4 16.09C4 16.09 6.426 13.658 8.948 13.212V14.938C7.756 14.754 6.87 16.09 6.87 16.09C6.87 16.09 7.624 18.218 8.948 19.502ZM8.948 10.938C6.228 11.29 4 13.658 4 13.658L2 11.414C2 11.414 5.19 8.192 8.948 7.86V8.798C8.948 8.798 8.948 7.86 8.948 7.86V10.938Z" />
		</svg>
	);
}
