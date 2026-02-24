"use client";

/**
 * ApiDocsPanel Component
 *
 * Auto-generated REST API documentation from entity schema.
 * Shows endpoints, query parameters, error codes, cURL commands, SDK usage, and OpenAPI export.
 */

import { Check, Copy, Download, Key, Server } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

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
			className="p-1 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/90 transition-colors"
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

function CodeBlock({ code }: { code: string }) {
	return (
		<div className="relative group">
			<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
				<CopyButton text={code} />
			</div>
			<pre className="px-4 py-3 rounded-md bg-white/[0.06] border border-white/[0.08] text-xs font-mono text-white/90 overflow-x-auto whitespace-pre-wrap">
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
				className={`px-2 py-0.5 rounded text-xs font-bold ${methodColors[method] || "bg-white/[0.06] text-white/90"}`}
			>
				{method}
			</span>
			<code className="text-sm font-mono text-white/90 flex-1">{path}</code>
			<span className="text-xs text-white/40">{description}</span>
		</div>
	);
}

export function ApiDocsPanel({ appId, schema }: ApiDocsPanelProps) {
	const [selectedEntity, setSelectedEntity] = useState<string | null>(
		schema?.entities?.[0]?.tableName || null,
	);
	const [activeTab, setActiveTab] = useState<"endpoints" | "params" | "errors" | "sdk">(
		"endpoints",
	);

	const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
	const entity = schema?.entities.find((e) => e.tableName === selectedEntity);

	// Generate OpenAPI JSON
	const generateOpenApi = useCallback(() => {
		if (!schema) return;
		const paths: Record<string, unknown> = {};
		for (const e of schema.entities) {
			const listPath = `/api/apps/${appId}/data/${e.tableName}`;
			const itemPath = `${listPath}/{id}`;

			const fieldProperties: Record<string, unknown> = {};
			for (const f of e.fields) {
				fieldProperties[f.name] = {
					type:
						f.type === "number"
							? "number"
							: f.type === "boolean"
								? "boolean"
								: "string",
					...(f.required ? {} : { nullable: true }),
				};
			}

			paths[listPath] = {
				get: {
					summary: `List ${e.name}`,
					parameters: [
						{ name: "page", in: "query", schema: { type: "integer", default: 1 } },
						{ name: "limit", in: "query", schema: { type: "integer", default: 20 } },
						{ name: "sort", in: "query", schema: { type: "string", default: "created_at" } },
						{ name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
					],
					responses: { "200": { description: "List of records" } },
				},
				post: {
					summary: `Create ${e.name}`,
					requestBody: {
						content: {
							"application/json": {
								schema: { type: "object", properties: fieldProperties },
							},
						},
					},
					responses: { "201": { description: "Created record" } },
				},
			};

			paths[itemPath] = {
				get: {
					summary: `Get ${e.name} by ID`,
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
					responses: { "200": { description: "Single record" } },
				},
				put: {
					summary: `Update ${e.name}`,
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
					requestBody: {
						content: {
							"application/json": {
								schema: { type: "object", properties: fieldProperties },
							},
						},
					},
					responses: { "200": { description: "Updated record" } },
				},
				delete: {
					summary: `Delete ${e.name}`,
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
					responses: { "200": { description: "Deleted" } },
				},
			};
		}

		const openapi = {
			openapi: "3.0.3",
			info: {
				title: `App ${appId} API`,
				version: "1.0.0",
				description: "Auto-generated REST API by Vibexe",
			},
			servers: [{ url: baseUrl }],
			security: [{ apiKey: [] }],
			components: {
				securitySchemes: {
					apiKey: {
						type: "apiKey",
						in: "header",
						name: "X-Vibexe-Api-Key",
					},
				},
			},
			paths,
		};

		const blob = new Blob([JSON.stringify(openapi, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `openapi-${appId}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}, [appId, schema, baseUrl]);

	if (!schema || schema.entities.length === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
				<Server className="h-12 w-12 text-white/20 mb-4" />
				<h2 className="text-xl font-semibold text-white/90 mb-2">
					No API Endpoints Yet
				</h2>
				<p className="text-white/40 max-w-md text-sm">
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
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-white/90">
							API Reference
						</h1>
						<p className="text-sm text-white/40 mt-1">
							Auto-generated REST API for your app&apos;s data entities
						</p>
					</div>
					<button
						type="button"
						onClick={generateOpenApi}
						className="px-3 py-1.5 rounded-md border border-white/[0.08] text-sm font-medium text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-colors flex items-center gap-1.5"
					>
						<Download className="h-3.5 w-3.5" />
						OpenAPI JSON
					</button>
				</div>

				{/* Base URL */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-sm font-medium text-white/90">
								Base URL
							</h3>
							<code className="text-xs font-mono text-white/40">
								{baseUrl}/api/apps/{appId}/data
							</code>
						</div>
						<CopyButton text={`${baseUrl}/api/apps/${appId}/data`} />
					</div>
				</div>

				{/* Authentication */}
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
					<h3 className="text-sm font-medium text-white/90 mb-2">
						Authentication
					</h3>
					<p className="text-xs text-white/40 mb-3">
						Include your API key in the request header:
					</p>
					<CodeBlock code={"X-Vibexe-Api-Key: vbx_your_api_key_here"} />
				</div>

				{/* Entity Tabs */}
				<div className="flex gap-2 border-b border-white/[0.06] pb-0">
					{schema.entities.map((e) => (
						<button
							type="button"
							key={e.tableName}
							onClick={() => setSelectedEntity(e.tableName)}
							className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
								selectedEntity === e.tableName
									? "border-violet-400 text-white/90"
									: "border-transparent text-white/40 hover:text-white/90"
							}`}
						>
							{e.name}
						</button>
					))}
				</div>

				{entity && (
					<div className="space-y-6">
						{/* Sub-tabs: Endpoints | Params | Errors | SDK */}
						<div className="flex gap-1">
							{(
								[
									{ key: "endpoints", label: "Endpoints" },
									{ key: "params", label: "Query Params" },
									{ key: "errors", label: "Error Codes" },
									{ key: "sdk", label: "SDK & cURL" },
								] as const
							).map((tab) => (
								<button
									type="button"
									key={tab.key}
									onClick={() => setActiveTab(tab.key)}
									className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
										activeTab === tab.key
											? "bg-white/[0.08] border border-white/[0.12] text-white/90"
											: "text-white/40 hover:text-white/90 hover:bg-white/[0.06]"
									}`}
								>
									{tab.label}
								</button>
							))}
						</div>

						{/* Endpoints */}
						{activeTab === "endpoints" && (
							<>
								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden">
									<div className="p-4 border-b border-white/[0.06]">
										<h3 className="text-sm font-medium text-white/90">
											Endpoints for {entity.name}
										</h3>
									</div>
									<div className="divide-y divide-white/[0.06]">
										<EndpointRow
											method="GET"
											path={`/data/${entity.tableName}`}
											description="List all records (paginated)"
										/>
										<EndpointRow
											method="GET"
											path={`/data/${entity.tableName}/:id`}
											description="Get single record by ID"
										/>
										<EndpointRow
											method="POST"
											path={`/data/${entity.tableName}`}
											description="Create a new record"
										/>
										<EndpointRow
											method="PUT"
											path={`/data/${entity.tableName}/:id`}
											description="Update record by ID"
										/>
										<EndpointRow
											method="DELETE"
											path={`/data/${entity.tableName}/:id`}
											description="Delete record by ID"
										/>
									</div>
								</div>

								{/* Schema Table */}
								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
									<h3 className="text-sm font-medium text-white/90 mb-3">
										Schema
									</h3>
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-white/[0.06]">
													<th className="text-left py-2 pr-4 text-white/40 font-medium">
														Field
													</th>
													<th className="text-left py-2 pr-4 text-white/40 font-medium">
														Type
													</th>
													<th className="text-left py-2 text-white/40 font-medium">
														Required
													</th>
												</tr>
											</thead>
											<tbody>
												<tr className="border-b border-white/[0.06]/50">
													<td className="py-2 pr-4 font-mono text-xs">
														id
													</td>
													<td className="py-2 pr-4 text-white/40">
														integer
													</td>
													<td className="py-2 text-white/40">
														auto
													</td>
												</tr>
												{entity.fields.map((field) => (
													<tr
														key={field.name}
														className="border-b border-white/[0.06]/50"
													>
														<td className="py-2 pr-4 font-mono text-xs">
															{field.name}
														</td>
														<td className="py-2 pr-4 text-white/40">
															{field.type}
														</td>
														<td className="py-2 text-white/40">
															{field.required ? "yes" : "no"}
														</td>
													</tr>
												))}
												<tr className="border-b border-white/[0.06]/50">
													<td className="py-2 pr-4 font-mono text-xs">
														created_at
													</td>
													<td className="py-2 pr-4 text-white/40">
														timestamp
													</td>
													<td className="py-2 text-white/40">
														auto
													</td>
												</tr>
												<tr>
													<td className="py-2 pr-4 font-mono text-xs">
														updated_at
													</td>
													<td className="py-2 pr-4 text-white/40">
														timestamp
													</td>
													<td className="py-2 text-white/40">
														auto
													</td>
												</tr>
											</tbody>
										</table>
									</div>
								</div>
							</>
						)}

						{/* Query Parameters */}
						{activeTab === "params" && (
							<div className="space-y-4">
								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
									<h3 className="text-sm font-medium text-white/90 mb-3">
										Pagination
									</h3>
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-white/[0.06]">
													<th className="text-left py-2 pr-4 text-white/40 font-medium">
														Param
													</th>
													<th className="text-left py-2 pr-4 text-white/40 font-medium">
														Type
													</th>
													<th className="text-left py-2 pr-4 text-white/40 font-medium">
														Default
													</th>
													<th className="text-left py-2 text-white/40 font-medium">
														Description
													</th>
												</tr>
											</thead>
											<tbody className="text-xs">
												<tr className="border-b border-white/[0.06]/50">
													<td className="py-2 pr-4 font-mono">
														page
													</td>
													<td className="py-2 pr-4 text-white/40">
														integer
													</td>
													<td className="py-2 pr-4 text-white/40">
														1
													</td>
													<td className="py-2 text-white/40">
														Page number (starts at 1)
													</td>
												</tr>
												<tr className="border-b border-white/[0.06]/50">
													<td className="py-2 pr-4 font-mono">
														limit
													</td>
													<td className="py-2 pr-4 text-white/40">
														integer
													</td>
													<td className="py-2 pr-4 text-white/40">
														20
													</td>
													<td className="py-2 text-white/40">
														Records per page (max 100)
													</td>
												</tr>
											</tbody>
										</table>
									</div>
								</div>

								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
									<h3 className="text-sm font-medium text-white/90 mb-3">
										Sorting
									</h3>
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b border-white/[0.06]">
													<th className="text-left py-2 pr-4 text-white/40 font-medium">
														Param
													</th>
													<th className="text-left py-2 pr-4 text-white/40 font-medium">
														Type
													</th>
													<th className="text-left py-2 pr-4 text-white/40 font-medium">
														Default
													</th>
													<th className="text-left py-2 text-white/40 font-medium">
														Description
													</th>
												</tr>
											</thead>
											<tbody className="text-xs">
												<tr className="border-b border-white/[0.06]/50">
													<td className="py-2 pr-4 font-mono">
														sort
													</td>
													<td className="py-2 pr-4 text-white/40">
														string
													</td>
													<td className="py-2 pr-4 text-white/40">
														created_at
													</td>
													<td className="py-2 text-white/40">
														Field to sort by. Valid:{" "}
														<code className="text-white/90">
															id, created_at, updated_at
															{entity.fields.length > 0 &&
																`, ${entity.fields.map((f) => f.name).join(", ")}`}
														</code>
													</td>
												</tr>
												<tr className="border-b border-white/[0.06]/50">
													<td className="py-2 pr-4 font-mono">
														order
													</td>
													<td className="py-2 pr-4 text-white/40">
														string
													</td>
													<td className="py-2 pr-4 text-white/40">
														desc
													</td>
													<td className="py-2 text-white/40">
														Sort direction:{" "}
														<code className="text-white/90">
															asc
														</code>{" "}
														or{" "}
														<code className="text-white/90">
															desc
														</code>
													</td>
												</tr>
											</tbody>
										</table>
									</div>
								</div>

								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
									<h3 className="text-sm font-medium text-white/90 mb-3">
										Filtering
									</h3>
									<p className="text-xs text-white/40 mb-3">
										Filter records by field values using bracket
										notation:
									</p>
									<CodeBlock
										code={`GET /data/${entity.tableName}?filter[${entity.fields[0]?.name || "field"}]=value`}
									/>
									<p className="text-xs text-white/40 mt-3">
										Multiple filters can be combined (AND logic):
									</p>
									<CodeBlock
										code={`GET /data/${entity.tableName}?filter[${entity.fields[0]?.name || "field"}]=value&filter[${entity.fields[1]?.name || "field2"}]=value2`}
									/>
									<div className="mt-3">
										<p className="text-xs text-white/40 mb-2">
											Filterable fields for {entity.name}:
										</p>
										<div className="flex flex-wrap gap-1.5">
											{[
												"id",
												...entity.fields.map((f) => f.name),
												"created_at",
												"updated_at",
											].map((f) => (
												<code
													key={f}
													className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono text-white/90"
												>
													{f}
												</code>
											))}
										</div>
									</div>
								</div>

								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
									<h3 className="text-sm font-medium text-white/90 mb-2">
										Response Format
									</h3>
									<CodeBlock
										code={`{
  "data": [...],            // Array of records (list) or single record
  "pagination": {           // Only on list endpoints
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}`}
									/>
								</div>
							</div>
						)}

						{/* Error Codes */}
						{activeTab === "errors" && (
							<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden">
								<div className="p-4 border-b border-white/[0.06]">
									<h3 className="text-sm font-medium text-white/90">
										Error Codes
									</h3>
								</div>
								<table className="w-full text-sm">
									<thead>
										<tr className="bg-white/[0.03]">
											<th className="px-4 py-2.5 text-left text-xs font-medium text-white/40">
												Status
											</th>
											<th className="px-4 py-2.5 text-left text-xs font-medium text-white/40">
												Meaning
											</th>
											<th className="px-4 py-2.5 text-left text-xs font-medium text-white/40">
												Response
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-white/[0.06] text-xs">
										<tr>
											<td className="px-4 py-2.5">
												<span className="px-2 py-0.5 rounded bg-green-500/10 text-green-600 font-bold">
													200
												</span>
											</td>
											<td className="px-4 py-2.5 text-white/90">
												Success
											</td>
											<td className="px-4 py-2.5 text-white/40 font-mono">
												{'{ "data": ... }'}
											</td>
										</tr>
										<tr>
											<td className="px-4 py-2.5">
												<span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 font-bold">
													201
												</span>
											</td>
											<td className="px-4 py-2.5 text-white/90">
												Created (POST success)
											</td>
											<td className="px-4 py-2.5 text-white/40 font-mono">
												{'{ "data": { ... } }'}
											</td>
										</tr>
										<tr>
											<td className="px-4 py-2.5">
												<span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-600 font-bold">
													400
												</span>
											</td>
											<td className="px-4 py-2.5 text-white/90">
												Bad Request — invalid body or no valid
												fields
											</td>
											<td className="px-4 py-2.5 text-white/40 font-mono">
												{'{ "error": "No valid fields provided" }'}
											</td>
										</tr>
										<tr>
											<td className="px-4 py-2.5">
												<span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-bold">
													401
												</span>
											</td>
											<td className="px-4 py-2.5 text-white/90">
												Unauthorized — missing or invalid API key
											</td>
											<td className="px-4 py-2.5 text-white/40 font-mono">
												{'{ "error": "Invalid API key" }'}
											</td>
										</tr>
										<tr>
											<td className="px-4 py-2.5">
												<span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-bold">
													404
												</span>
											</td>
											<td className="px-4 py-2.5 text-white/90">
												Not Found — entity or record doesn&apos;t
												exist
											</td>
											<td className="px-4 py-2.5 text-white/40 font-mono">
												{'{ "error": "Not found" }'}
											</td>
										</tr>
										<tr>
											<td className="px-4 py-2.5">
												<span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-bold">
													500
												</span>
											</td>
											<td className="px-4 py-2.5 text-white/90">
												Internal Server Error
											</td>
											<td className="px-4 py-2.5 text-white/40 font-mono">
												{
													'{ "error": "Internal server error" }'
												}
											</td>
										</tr>
										<tr>
											<td className="px-4 py-2.5">
												<span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-600 font-bold">
													503
												</span>
											</td>
											<td className="px-4 py-2.5 text-white/90">
												Service Unavailable — app database not
												provisioned
											</td>
											<td className="px-4 py-2.5 text-white/40 font-mono">
												{
													'{ "error": "App database not available" }'
												}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						)}

						{/* SDK & cURL */}
						{activeTab === "sdk" && (
							<div className="space-y-4">
								{/* cURL Examples */}
								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-4">
									<h3 className="text-sm font-medium text-white/90">
										cURL Examples
									</h3>

									<div>
										<p className="text-xs text-white/40 mb-2">
											List records (with pagination and sorting):
										</p>
										<CodeBlock
											code={`curl -H "X-Vibexe-Api-Key: YOUR_KEY" \\\n  "${baseUrl}/api/apps/${appId}/data/${entity.tableName}?page=1&limit=20&sort=created_at&order=desc"`}
										/>
									</div>

									<div>
										<p className="text-xs text-white/40 mb-2">
											Get single record:
										</p>
										<CodeBlock
											code={`curl -H "X-Vibexe-Api-Key: YOUR_KEY" \\\n  "${baseUrl}/api/apps/${appId}/data/${entity.tableName}/1"`}
										/>
									</div>

									<div>
										<p className="text-xs text-white/40 mb-2">
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
											)}' \\\n  "${baseUrl}/api/apps/${appId}/data/${entity.tableName}"`}
										/>
									</div>

									<div>
										<p className="text-xs text-white/40 mb-2">
											Update record:
										</p>
										<CodeBlock
											code={`curl -X PUT \\\n  -H "X-Vibexe-Api-Key: YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(
												Object.fromEntries(
													entity.fields
														.slice(0, 2)
														.map((f) => [
															f.name,
															f.type === "number"
																? 99
																: `updated_${f.name}`,
														]),
												),
											)}' \\\n  "${baseUrl}/api/apps/${appId}/data/${entity.tableName}/1"`}
										/>
									</div>

									<div>
										<p className="text-xs text-white/40 mb-2">
											Delete record:
										</p>
										<CodeBlock
											code={`curl -X DELETE \\\n  -H "X-Vibexe-Api-Key: YOUR_KEY" \\\n  "${baseUrl}/api/apps/${appId}/data/${entity.tableName}/1"`}
										/>
									</div>

									<div>
										<p className="text-xs text-white/40 mb-2">
											Filter records:
										</p>
										<CodeBlock
											code={`curl -H "X-Vibexe-Api-Key: YOUR_KEY" \\\n  "${baseUrl}/api/apps/${appId}/data/${entity.tableName}?filter[${entity.fields[0]?.name || "field"}]=value"`}
										/>
									</div>
								</div>

								{/* SDK Example */}
								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-3">
									<h3 className="text-sm font-medium text-white/90">
										Vibexe SDK (JavaScript/TypeScript)
									</h3>
									<CodeBlock
										code={`import { VibexeApp } from "@vibexe/sdk";

const app = new VibexeApp({ appId: "${appId}" });

// List ${entity.name} (with pagination)
const { data, pagination } = await app.data.list("${entity.tableName}", {
  page: 1,
  limit: 20,
  sort: "created_at",
  order: "desc",
});

// Get single ${entity.name}
const item = await app.data.get("${entity.tableName}", 1);

// Create ${entity.name}
const newItem = await app.data.create("${entity.tableName}", {
${entity.fields
	.slice(0, 3)
	.map(
		(f) =>
			`  ${f.name}: ${f.type === "number" ? "42" : f.type === "boolean" ? "true" : `"value"`}`,
	)
	.join(",\n")}
});

// Update ${entity.name}
await app.data.update("${entity.tableName}", newItem.id, {
  ${entity.fields[0]?.name || "field"}: ${entity.fields[0]?.type === "number" ? "99" : '"updated"'}
});

// Delete ${entity.name}
await app.data.delete("${entity.tableName}", newItem.id);

// Filter ${entity.name}
const filtered = await app.data.list("${entity.tableName}", {
  filter: { ${entity.fields[0]?.name || "field"}: "value" }
});`}
									/>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
