"use client";

import { useCallback, useEffect, useState } from "react";

interface DataField {
  name: string;
  type: string;
}

interface DataTableProps {
  appId: string;
  entity: string;
  fields: DataField[];
  onAddRow: () => void;
  onEditRow: (row: Record<string, unknown>) => void;
  refreshTrigger?: number;
}

export function DataTable({ appId, entity, fields, onAddRow, onEditRow, refreshTrigger }: DataTableProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/apps/${appId}/data/${entity}?page=${page}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotal(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [appId, entity, page]);

  useEffect(() => { fetchData(); }, [fetchData, refreshTrigger]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this row?")) return;
    try {
      await fetch(`/api/apps/${appId}/data/${entity}/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const allColumns = ["id", ...fields.map(f => f.name), "created_at"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-400">{total} row{total !== 1 ? "s" : ""}</p>
        <button
          type="button"
          onClick={onAddRow}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-500 transition-colors"
        >
          + Add Row
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-lg mb-2">No data yet</p>
          <p className="text-sm">Click &quot;Add Row&quot; to create your first entry.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.04]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                {allColumns.map(col => (
                  <th key={col} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    {col}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((row) => (
                <tr key={String(row.id)} className="hover:bg-white/[0.03] transition-colors">
                  {allColumns.map(col => (
                    <td key={col} className="px-4 py-2.5 text-zinc-300 max-w-[200px] truncate">
                      {formatCellValue(row[col])}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => onEditRow(row)}
                      className="text-blue-400 hover:text-blue-300 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id as number)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 text-sm rounded bg-zinc-700 text-zinc-300 disabled:opacity-40 hover:bg-zinc-600"
          >
            Prev
          </button>
          <span className="text-sm text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm rounded bg-zinc-700 text-zinc-300 disabled:opacity-40 hover:bg-zinc-600"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "\u2014";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object") return JSON.stringify(value);
  const str = String(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString();
  }
  return str;
}
