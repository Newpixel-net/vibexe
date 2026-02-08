import { useEffect, useRef, useState } from "react";

export interface PieceActionInfo {
	name: string;
	displayName: string;
	description: string;
	requireAuth: boolean;
}

interface PieceInspectResult {
	name: string;
	displayName: string;
	version: string;
	actions: PieceActionInfo[];
}

// Module-level cache
const cache = new Map<string, PieceInspectResult>();

export function usePieceActions(pieceName: string | null) {
	const [data, setData] = useState<PieceInspectResult | null>(
		pieceName ? (cache.get(pieceName) ?? null) : null,
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		if (!pieceName) {
			setData(null);
			setLoading(false);
			setError(null);
			return;
		}

		if (cache.has(pieceName)) {
			setData(cache.get(pieceName)!);
			setLoading(false);
			setError(null);
			return;
		}

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setLoading(true);
		setError(null);

		fetch(`/api/integrations/pieces/${encodeURIComponent(pieceName)}`, {
			signal: controller.signal,
		})
			.then(async (res) => {
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(
						(body as { error?: string }).error ?? `HTTP ${res.status}`,
					);
				}
				return res.json() as Promise<PieceInspectResult>;
			})
			.then((result) => {
				cache.set(pieceName, result);
				setData(result);
				setLoading(false);
			})
			.catch((err) => {
				if (err instanceof DOMException && err.name === "AbortError") return;
				setError(err instanceof Error ? err.message : String(err));
				setLoading(false);
			});

		return () => {
			controller.abort();
		};
	}, [pieceName]);

	return {
		actions: data?.actions ?? [],
		version: data?.version ?? null,
		loading,
		error,
	};
}
