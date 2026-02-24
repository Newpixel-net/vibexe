"use client";

/**
 * Markdown Viewer
 *
 * Enhanced markdown renderer that generates heading IDs for TOC linking
 * and provides syntax highlighting for code blocks.
 */

import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export interface Heading {
	id: string;
	text: string;
	level: number;
}

interface MarkdownViewerProps {
	content: string;
	onHeadingsExtracted?: (headings: Heading[]) => void;
}

/**
 * Creates a URL-friendly slug from text.
 * Used to generate heading IDs for TOC navigation.
 */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/--+/g, "-")
		.trim();
}

/**
 * Markdown viewer with heading ID generation and syntax highlighting.
 * Extracts headings after render for TOC synchronization.
 */
export function MarkdownViewer({
	content,
	onHeadingsExtracted,
}: MarkdownViewerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const extractedRef = useRef<boolean>(false);

	// Extract headings from rendered content
	const extractHeadings = useCallback(() => {
		if (!containerRef.current || !onHeadingsExtracted) return;

		const headingElements =
			containerRef.current.querySelectorAll("h1, h2, h3, h4");
		const headings: Heading[] = [];

		headingElements.forEach((el) => {
			const id = el.id;
			const text = el.textContent || "";
			const level = parseInt(el.tagName.charAt(1), 10);

			if (id && text) {
				headings.push({ id, text, level });
			}
		});

		onHeadingsExtracted(headings);
	}, [onHeadingsExtracted]);

	// Extract headings after content renders
	useEffect(() => {
		// Reset extraction flag when content changes
		extractedRef.current = false;
	}, [content]);

	useEffect(() => {
		if (!extractedRef.current && content) {
			// Small delay to ensure DOM is updated
			const timer = setTimeout(() => {
				extractHeadings();
				extractedRef.current = true;
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [content, extractHeadings]);

	// Custom heading component factory
	const createHeading = (level: number) => {
		const HeadingComponent = ({ children }: { children?: React.ReactNode }) => {
			const text = String(children || "");
			const id = slugify(text);
			const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;

			const sizeClasses: Record<number, string> = {
				1: "text-2xl font-bold mt-6 mb-4",
				2: "text-xl font-semibold mt-5 mb-3",
				3: "text-lg font-medium mt-4 mb-2",
				4: "text-base font-medium mt-3 mb-2",
			};

			return (
				<Tag id={id} className={cn("scroll-mt-4", sizeClasses[level])}>
					{children}
				</Tag>
			);
		};
		HeadingComponent.displayName = `Heading${level}`;
		return HeadingComponent;
	};

	return (
		<div
			ref={containerRef}
			className="p-6 prose prose-sm dark:prose-invert max-w-none"
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[
					[
						rehypeExternalLinks,
						{ target: "_blank", rel: ["noopener", "noreferrer"] },
					],
				]}
				components={{
					// Custom heading components with IDs
					h1: createHeading(1),
					h2: createHeading(2),
					h3: createHeading(3),
					h4: createHeading(4),

					// Custom code block rendering
					code({ className, children, ...props }) {
						const isInline = !className;
						if (isInline) {
							return (
								<code
									className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm"
									{...props}
								>
									{children}
								</code>
							);
						}
						// Block code
						const language = className?.replace("language-", "") || "";
						return (
							<div className="relative group my-3">
								{language && (
									<div className="absolute top-0 right-0 px-2 py-1 text-xs text-muted-foreground bg-muted rounded-bl">
										{language}
									</div>
								)}
								<pre className="p-4 rounded-lg bg-muted overflow-x-auto">
									<code
										className={cn("font-mono text-sm", className)}
										{...props}
									>
										{children}
									</code>
								</pre>
							</div>
						);
					},

					// Custom link styling
					a({ children, href, ...props }) {
						return (
							<a
								href={href}
								className="text-primary hover:underline"
								{...props}
							>
								{children}
							</a>
						);
					},

					// Custom list styling
					ul: ({ children }) => (
						<ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
					),
					ol: ({ children }) => (
						<ol className="list-decimal list-inside my-2 space-y-1">
							{children}
						</ol>
					),
					li: ({ children }) => <li className="text-foreground">{children}</li>,

					// Custom paragraph
					p: ({ children }) => (
						<p className="my-2 leading-relaxed">{children}</p>
					),

					// Custom blockquote
					blockquote: ({ children }) => (
						<blockquote className="border-l-2 border-primary pl-4 my-2 italic text-muted-foreground">
							{children}
						</blockquote>
					),

					// Custom table styling
					table: ({ children }) => (
						<div className="overflow-x-auto my-4">
							<table className="w-full border-collapse">{children}</table>
						</div>
					),
					th: ({ children }) => (
						<th className="border border-border bg-muted px-3 py-2 text-left font-medium">
							{children}
						</th>
					),
					td: ({ children }) => (
						<td className="border border-border px-3 py-2">{children}</td>
					),

					// Custom horizontal rule
					hr: () => <hr className="my-6 border-border" />,
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
