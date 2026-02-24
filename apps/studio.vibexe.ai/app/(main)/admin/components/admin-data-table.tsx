"use client";

import { useMemo, useState } from "react";

type Column<T> = {
	key: string;
	label: string;
	render: (row: T) => React.ReactNode;
};

type AdminDataTableProps<T> = {
	data: T[];
	columns: Column<T>[];
	searchPlaceholder?: string;
	searchKeys?: (keyof T)[];
	pageSize?: number;
};

export function AdminDataTable<T extends Record<string, unknown>>({
	data,
	columns,
	searchPlaceholder = "Search...",
	searchKeys = [],
	pageSize = 20,
}: AdminDataTableProps<T>) {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(0);

	const filtered = useMemo(() => {
		if (!search.trim() || searchKeys.length === 0) return data;
		const q = search.toLowerCase();
		return data.filter((row) =>
			searchKeys.some((key) => {
				const val = row[key];
				return val != null && String(val).toLowerCase().includes(q);
			}),
		);
	}, [data, search, searchKeys]);

	const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
	const safeePage = Math.min(page, totalPages - 1);
	const paged = filtered.slice(
		safeePage * pageSize,
		safeePage * pageSize + pageSize,
	);

	return (
		<div className="flex flex-col gap-4">
			{searchKeys.length > 0 && (
				<input
					type="text"
					placeholder={searchPlaceholder}
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(0);
					}}
					className="w-full max-w-[320px] rounded-[6px] border border-black-400 bg-black-850 px-3 py-2 text-[13px] text-white-900 placeholder:text-black-400 outline-none focus:border-white-900"
				/>
			)}
			<div className="overflow-x-auto rounded-[8px] border border-black-400">
				<table className="w-full text-[13px]">
					<thead>
						<tr className="border-b border-black-400 bg-black-900">
							{columns.map((col) => (
								<th
									key={col.key}
									className="px-4 py-3 text-left font-medium text-black-400"
								>
									{col.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{paged.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length}
									className="px-4 py-8 text-center text-black-400"
								>
									No results found
								</td>
							</tr>
						) : (
							paged.map((row, i) => (
								<tr
									key={i}
									className="border-b border-black-400/50 last:border-b-0 hover:bg-black-900/50"
								>
									{columns.map((col) => (
										<td key={col.key} className="px-4 py-3 text-white-900">
											{col.render(row)}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			{totalPages > 1 && (
				<div className="flex items-center justify-between text-[13px] text-black-400">
					<span>
						{filtered.length} total &middot; Page {safeePage + 1} of{" "}
						{totalPages}
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							disabled={safeePage === 0}
							onClick={() => setPage(safeePage - 1)}
							className="px-3 py-1 rounded border border-black-400 disabled:opacity-30 hover:bg-black-900"
						>
							Prev
						</button>
						<button
							type="button"
							disabled={safeePage >= totalPages - 1}
							onClick={() => setPage(safeePage + 1)}
							className="px-3 py-1 rounded border border-black-400 disabled:opacity-30 hover:bg-black-900"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
