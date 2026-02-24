"use client";

import type { ReactNode } from "react";

type StatCardProps = {
	label: string;
	value: string | number;
	subtitle?: string;
	icon?: ReactNode;
};

export function StatCard({ label, value, subtitle, icon }: StatCardProps) {
	return (
		<div className="rounded-[8px] border border-black-400 bg-black-850 p-5 flex flex-col gap-2">
			<div className="flex items-center gap-2 text-black-400 text-[13px]">
				{icon && <span className="text-black-400">{icon}</span>}
				<span>{label}</span>
			</div>
			<div className="text-[28px] font-semibold text-white-900 leading-tight">
				{value}
			</div>
			{subtitle && (
				<div className="text-[12px] text-black-400">{subtitle}</div>
			)}
		</div>
	);
}
