import { useCallback, useEffect, useRef, useState } from "react";

export interface PropertyInfo {
	name: string;
	displayName: string;
	description: string;
	type: string;
	required: boolean;
	defaultValue?: unknown;
	options?: { label: string; value: unknown }[];
}

export interface PieceAuthInfo {
	type: string;
	displayName: string;
	description: string;
	props?: Record<string, PropertyInfo>;
}

export interface PieceActionInfo {
	name: string;
	displayName: string;
	description: string;
	requireAuth: boolean;
	props: Record<string, PropertyInfo>;
}

interface PieceInspectResult {
	name: string;
	displayName: string;
	description: string;
	version: string;
	auth: PieceAuthInfo | null;
	actions: PieceActionInfo[];
}

// Module-level cache to avoid refetching across renders/remounts
const cache = new Map<string, PieceInspectResult>();

export function usePieceInspect(pieceName: string) {
	const [data, setData] = useState<PieceInspectResult | null>(
		cache.get(pieceName) ?? null,
	);
	const [loading, setLoading] = useState(!cache.has(pieceName));
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
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
						(body as { error?: string }).error ??
							`HTTP ${res.status}`,
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

	return { data, loading, error };
}

export function usePieceActionProps(pieceName: string, actionName: string) {
	const { data, loading, error } = usePieceInspect(pieceName);

	const action = data?.actions.find((a) => a.name === actionName);
	const props = action?.props ?? null;
	const auth = data?.auth ?? null;
	const version = data?.version ?? null;

	return { props, auth, version, loading, error };
}
