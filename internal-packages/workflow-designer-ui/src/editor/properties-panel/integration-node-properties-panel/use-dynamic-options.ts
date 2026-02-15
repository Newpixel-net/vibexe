import { useCallback, useEffect, useRef, useState } from "react";

interface DynamicOption {
	label: string;
	value: unknown;
}

interface UseDynamicOptionsResult {
	options: DynamicOption[];
	loading: boolean;
	error: string | null;
	refetch: () => void;
}

// Module-level cache: pieceName/actionName/propertyName -> options
const optionsCache = new Map<string, DynamicOption[]>();

/**
 * Hook to fetch dynamic dropdown options from the properties resolution API.
 * Caches results per piece/action/property combination.
 * Refetches when dependencies (other field values) change.
 */
export function useDynamicOptions(
	pieceName: string,
	actionName: string,
	propertyName: string,
	credentialId?: string,
	/** Other field values that this dropdown depends on */
	deps?: Record<string, unknown>,
): UseDynamicOptionsResult {
	const cacheKey = `${pieceName}/${actionName}/${propertyName}`;
	const [options, setOptions] = useState<DynamicOption[]>(
		optionsCache.get(cacheKey) ?? [],
	);
	const [loading, setLoading] = useState(!optionsCache.has(cacheKey));
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	// Serialize deps for dependency tracking
	const depsKey = deps ? JSON.stringify(deps) : "";

	const fetchOptions = useCallback(() => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setLoading(true);
		setError(null);

		fetch(
			`/api/integrations/pieces/${encodeURIComponent(pieceName)}/properties`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					actionName,
					propertyName,
					credentialId,
					currentValues: deps ?? {},
				}),
				signal: controller.signal,
			},
		)
			.then(async (res) => {
				const data = await res.json();
				if (data.options && Array.isArray(data.options)) {
					const resolvedOptions = data.options as DynamicOption[];
					optionsCache.set(cacheKey, resolvedOptions);
					setOptions(resolvedOptions);
				} else {
					setOptions([]);
				}
				if (data.error) {
					setError(data.error);
				}
				setLoading(false);
			})
			.catch((err) => {
				if (err instanceof DOMException && err.name === "AbortError")
					return;
				setError(
					err instanceof Error ? err.message : String(err),
				);
				setLoading(false);
			});
	}, [pieceName, actionName, propertyName, credentialId, cacheKey, deps]);

	useEffect(() => {
		if (optionsCache.has(cacheKey)) {
			setOptions(optionsCache.get(cacheKey)!);
			setLoading(false);
			return;
		}
		fetchOptions();
		return () => {
			abortRef.current?.abort();
		};
	}, [cacheKey, fetchOptions]);

	// Refetch when deps change (clear cache for this key)
	useEffect(() => {
		if (depsKey) {
			optionsCache.delete(cacheKey);
			fetchOptions();
		}
	}, [depsKey, cacheKey, fetchOptions]);

	return { options, loading, error, refetch: fetchOptions };
}
