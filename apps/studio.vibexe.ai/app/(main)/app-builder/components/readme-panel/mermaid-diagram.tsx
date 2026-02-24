"use client";

/**
 * Mermaid Diagram Renderer
 *
 * Renders Mermaid diagram source into SVG using the mermaid library.
 * Loads mermaid dynamically from CDN to avoid bundling it.
 * Falls back to showing raw source if rendering fails.
 */

import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
	source: string;
}

let mermaidLoaded = false;
let mermaidLoadPromise: Promise<void> | null = null;

/**
 * Load the mermaid library from CDN (once).
 */
function loadMermaid(): Promise<void> {
	if (mermaidLoaded) return Promise.resolve();
	if (mermaidLoadPromise) return mermaidLoadPromise;

	mermaidLoadPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
		script.onload = () => {
			mermaidLoaded = true;
			// Initialize with dark theme support
			const win = window as unknown as { mermaid?: { initialize: (config: Record<string, unknown>) => void } };
			if (win.mermaid) {
				const isDark = document.documentElement.classList.contains("dark");
				win.mermaid.initialize({
					startOnLoad: false,
					theme: isDark ? "dark" : "default",
					securityLevel: "loose",
				});
			}
			resolve();
		};
		script.onerror = () => {
			mermaidLoadPromise = null;
			reject(new Error("Failed to load mermaid from CDN"));
		};
		document.head.appendChild(script);
	});

	return mermaidLoadPromise;
}

/**
 * Render a Mermaid diagram to SVG.
 */
export function MermaidDiagram({ source }: MermaidDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`);

	useEffect(() => {
		let cancelled = false;

		async function render() {
			setLoading(true);
			setError(null);

			try {
				await loadMermaid();
				if (cancelled || !containerRef.current) return;

				const win = window as unknown as {
					mermaid?: {
						render: (id: string, source: string) => Promise<{ svg: string }>;
					};
				};

				if (!win.mermaid) {
					throw new Error("Mermaid not available");
				}

				const { svg } = await win.mermaid.render(
					idRef.current,
					source.trim(),
				);

				if (!cancelled && containerRef.current) {
					containerRef.current.innerHTML = svg;
					setLoading(false);
				}
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Render failed");
					setLoading(false);
				}
			}
		}

		render();

		return () => {
			cancelled = true;
		};
	}, [source]);

	if (error) {
		// Fallback: show raw mermaid source
		return (
			<div className="relative group my-3">
				<div className="absolute top-0 right-0 px-2 py-1 text-xs text-muted-foreground bg-muted rounded-bl">
					mermaid
				</div>
				<pre className="p-4 rounded-lg bg-muted overflow-x-auto">
					<code className="font-mono text-sm">{source}</code>
				</pre>
			</div>
		);
	}

	return (
		<div className="my-3 overflow-x-auto">
			{loading && (
				<div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					Rendering diagram...
				</div>
			)}
			<div
				ref={containerRef}
				className={loading ? "hidden" : "flex justify-center"}
			/>
		</div>
	);
}
