"use client";

/**
 * ApiDocsPanel Component
 *
 * Auto-generated REST API documentation from entity schema.
 * Shows endpoints, request/response examples, cURL commands, and SDK usage.
 */

import { Check, Copy, Key, Server } from "lucide-react";
import { useCallback, useState } from "react";

interface ApiDocsPanelProps {
	appId: string;
	schema: {
		entities: Array<{
			name: string;
			tableName: string;
			fields: Array<{ name: string; type: string; required?: boolean }>;
		}>;
	} | null;
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard may fail
		}
	}, [text]);

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
			title={copied ? "Copied!" : "Copy"}
		>
			{copied ? (
				<Check className="h-3 w-3 text-green-500" />
			) : (
				<Copy className="h-3 w-3" />
			)}
		</button>
	);
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
	return (
		<div className="relative group">
			<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
				<CopyButton text={code} />
			</div>
			<pre className="px-4 py-3 rounded-md bg-muted/70 text-xs font-mono text-foreground overflow-x-auto">
				{code}
			</pre>
		</div>
	);
}

function EndpointRow({
	method,
	path,
	description,
}: {
	method: string;
	path: string;
	description: string;
}) {
	const methodColors: Record<string, string> = {
		GET: "bg-green-500/10 text-green-600",
		POST: "bg-blue-500/10 text-blue-600",
		PUT: "bg-yellow-500/10 text-yellow-600",
		DELETE: "bg-red-500/10 text-red-600",
	};

	return (
		<div className="flex items-center gap-3 px-4 py-2.5">
			<span
				className={`px-2 py-0.5 rounded text-xs font-bold ${methodColors[method] || "bg-muted text-foreground"}`}
			>
				{method}
			</span>
			<code className="text-sm font-mono text-foreground flex-1">{path}</code>
			<span className="text-xs text-muted-foreground">{description}</span>
		</div>
	);
}

export function ApiDocsPanel({ appId, schema }: ApiDocsPanelProps) {
	const [selectedEntity, setSelectedEntity] = useState<string | null>(
		schema?.entities?.[0]?.tableName || null,
	);

	const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
	const entity = schema?.entities.find((e) => e.tableName === selectedEntity);

	if (!schema || schema.entities.length === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
				<Server className="h-12 w-12 text-muted-foreground/30 mb-4" />
				<h2 className="text-xl font-semibold text-foreground mb-2">
					No API Endpoints Yet
				</h2>
				<p className="text-muted-foreground max-w-md text-sm">
					Ask the AI to build an app with data entities. Once entities are
					defined, REST API endpoints are automatically generated.
				</p>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-4xl mx-auto space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-foreground">API Reference</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Auto-generated REST API for your app&apos;s data entities
					</p>
				</div>

				{/* Base URL */}
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-sm font-medium text-foreground">Base URL</h3>
							<code className="text-xs font-mono text-muted-foreground">
								{baseUrl}/api/apps/{appId}/data
							</code>
						</div>
						<CopyButton text={`${baseUrl}/api/apps/${appId}/data`} />
					</div>
				</div>

				{/* Authentication */}
				<div className="rounded-lg border border-border bg-card p-4">
					<h3 className="text-sm font-medium text-foreground mb-2">
						Authentication
					</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Include your API key in the request header:
					</p>
					<CodeBlock code={'X-Vibexe-Api-Key: vbx_your_api_key_here'} />
				</div>

				{/* Entity Tabs */}
				<div className="flex gap-2 border-b border-border pb-0">
					{schema.entities.map((e) => (
						<button
							type="button"
							key={e.tableName}
							onClick={() => setSelectedEntity(e.tableName)}
							className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
								selectedEntity === e.tableName
									? "border-foreground text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground"
							}`}
						>
							{e.name}
						</button>
					))}
				</div>

				{entity && (
					<div className="space-y-6">
						{/* Endpoints */}
						<div className="rounded-lg border border-border bg-card overflow-hidden">
							<div className="p-4 border-b border-border">
								<h3 className="text-sm font-medium text-foreground">
									Endpoints for {entity.name}
								</h3>
							</div>
							<div className="divide-y divide-border">
								<EndpointRow
									method="GET"
									path={`/data/${entity.tableName}`}
									description="List all records"
								/>
								<EndpointRow
									method="GET"
									path={`/data/${entity.tableName}/:id`}
									description="Get single record"
								/>
								<EndpointRow
									method="POST"
									path={`/data/${entity.tableName}`}
									description="Create record"
								/>
								<EndpointRow
									method="PUT"
									path={`/data/${entity.tableName}/:id`}
									description="Update record"
								/>
								<EndpointRow
									method="DELETE"
									path={`/data/${entity.tableName}/:id`}
									description="Delete record"
								/>
							</div>
						</div>

						{/* Schema */}
						<div className="rounded-lg border border-border bg-card p-4">
							<h3 className="text-sm font-medium text-foreground mb-3">
								Schema
							</h3>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-border">
											<th className="text-left py-2 pr-4 text-muted-foreground font-medium">
												Field
											</th>
											<th className="text-left py-2 pr-4 text-muted-foreground font-medium">
												Type
											</th>
											<th className="text-left py-2 text-muted-foreground font-medium">
												Required
											</th>
										</tr>
									</thead>
									<tbody>
										<tr className="border-b border-border/50">
											<td className="py-2 pr-4 font-mono text-xs">id</td>
											<td className="py-2 pr-4 text-muted-foreground">
												integer
											</td>
											<td className="py-2 text-muted-foreground">auto</td>
										</tr>
										{entity.fields.map((field) => (
											<tr
												key={field.name}
												className="border-b border-border/50"
											>
												<td className="py-2 pr-4 font-mono text-xs">
													{field.name}
												</td>
												<td className="py-2 pr-4 text-muted-foreground">
													{field.type}
												</td>
												<td className="py-2 text-muted-foreground">
													{field.required ? "yes" : "no"}
												</td>
											</tr>
										))}
										<tr className="border-b border-border/50">
											<td className="py-2 pr-4 font-mono text-xs">
												created_at
											</td>
											<td className="py-2 pr-4 text-muted-foreground">
												timestamp
											</td>
											<td className="py-2 text-muted-foreground">auto</td>
										</tr>
										<tr>
											<td className="py-2 pr-4 font-mono text-xs">
												updated_at
											</td>
											<td className="py-2 pr-4 text-muted-foreground">
												timestamp
											</td>
											<td className="py-2 text-muted-foreground">auto</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>

						{/* cURL Examples */}
						<div className="rounded-lg border border-border bg-card p-4 space-y-4">
							<h3 className="text-sm font-medium text-foreground">
								cURL Examples
							</h3>

							<div>
								<p className="text-xs text-muted-foreground mb-2">
									List records:
								</p>
								<CodeBlock
									code={`curl -H "X-Vibexe-Api-Key: YOUR_KEY" \\\n  ${baseUrl}/api/apps/${appId}/data/${entity.tableName}`}
								/>
							</div>

							<div>
								<p className="text-xs text-muted-foreground mb-2">
									Create record:
								</p>
								<CodeBlock
									code={`curl -X POST \\\n  -H "X-Vibexe-Api-Key: YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(
										Object.fromEntries(
											entity.fields
												.slice(0, 3)
												.map((f) => [
													f.name,
													f.type === "number"
														? 42
														: f.type === "boolean"
															? true
															: `example_${f.name}`,
												]),
										),
									)}' \\\n  ${baseUrl}/api/apps/${appId}/data/${entity.tableName}`}
								/>
							</div>
						</div>

						{/* SDK Example */}
						<div className="rounded-lg border border-border bg-card p-4 space-y-3">
							<h3 className="text-sm font-medium text-foreground">
								Vibexe SDK
							</h3>
							<CodeBlock
								code={`import { VibexeApp } from "@vibexe/sdk";

const app = new VibexeApp({ appId: "${appId}" });

// List ${entity.name}
const items = await app.data.list("${entity.tableName}");

// Create ${entity.name}
const item = await app.data.create("${entity.tableName}", {
${entity.fields
	.slice(0, 3)
	.map(
		(f) =>
			`  ${f.name}: ${f.type === "number" ? "42" : f.type === "boolean" ? "true" : `"value"`}`,
	)
	.join(",\n")}
});

// Update ${entity.name}
await app.data.update("${entity.tableName}", item.id, { ... });

// Delete ${entity.name}
await app.data.delete("${entity.tableName}", item.id);`}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
