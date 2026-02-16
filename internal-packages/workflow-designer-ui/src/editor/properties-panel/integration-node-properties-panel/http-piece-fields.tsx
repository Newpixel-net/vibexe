"use client";

import { Toggle } from "@giselle-internal/ui/toggle";
import type { NodeId } from "@giselles-ai/protocol";
import { ChevronRightIcon, InfoIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { FieldWrapper } from "../ui/field-wrapper";
import { InlineCodeEditor } from "../ui/inline-code-editor";
import { KeyValueEditor, type KeyValuePair } from "../ui/key-value-editor";
import { SearchableSelect } from "../ui/searchable-select";

const METHOD_OPTIONS = [
	{ label: "GET", value: "GET" },
	{ label: "POST", value: "POST" },
	{ label: "PUT", value: "PUT" },
	{ label: "PATCH", value: "PATCH" },
	{ label: "DELETE", value: "DELETE" },
	{ label: "HEAD", value: "HEAD" },
	{ label: "OPTIONS", value: "OPTIONS" },
];

const BODY_TYPE_OPTIONS = [
	{ label: "JSON", value: "json" },
	{ label: "Form Data", value: "form_data" },
	{ label: "Raw", value: "raw" },
	{ label: "None", value: "none" },
];

/** Convert Record<string,string> to KeyValuePair array */
function recordToPairs(record: unknown): KeyValuePair[] {
	if (!record || typeof record !== "object") return [];
	return Object.entries(record as Record<string, string>).map(
		([key, value]) => ({ key, value: String(value ?? "") }),
	);
}

/** Convert KeyValuePair array to Record<string,string> */
function pairsToRecord(pairs: KeyValuePair[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const pair of pairs) {
		if (pair.key.trim()) {
			result[pair.key] = pair.value;
		}
	}
	return result;
}

interface HttpPieceFieldsProps {
	configuration: Record<string, unknown>;
	updateConfig: (key: string, value: unknown) => void;
	nodeId: NodeId;
}

export function HttpPieceFields({
	configuration,
	updateConfig,
	nodeId,
}: HttpPieceFieldsProps) {
	const [showOptions, setShowOptions] = useState(false);

	// Derive toggle states from config presence
	const method = (configuration.method as string) || "GET";
	const url = (configuration.url as string) || "";

	const headerPairs = useMemo(
		() => recordToPairs(configuration.headers),
		[configuration.headers],
	);
	const queryPairs = useMemo(
		() => recordToPairs(configuration.queryParameters),
		[configuration.queryParameters],
	);

	const sendHeaders = headerPairs.length > 0 || Boolean(configuration._sendHeaders);
	const sendQuery = queryPairs.length > 0 || Boolean(configuration._sendQuery);
	const sendBody = Boolean(configuration.body) || Boolean(configuration._sendBody);

	const bodyType = (configuration.body_type as string) || "json";
	const bodyValue = useMemo(() => {
		const body = configuration.body;
		if (body == null) return "";
		if (typeof body === "object") return JSON.stringify(body, null, 2);
		return String(body);
	}, [configuration.body]);

	// Handlers
	const handleHeadersToggle = useCallback(
		(checked: boolean) => {
			if (!checked) {
				updateConfig("headers", undefined);
				updateConfig("_sendHeaders", undefined);
			} else {
				updateConfig("_sendHeaders", true);
			}
		},
		[updateConfig],
	);

	const handleQueryToggle = useCallback(
		(checked: boolean) => {
			if (!checked) {
				updateConfig("queryParameters", undefined);
				updateConfig("_sendQuery", undefined);
			} else {
				updateConfig("_sendQuery", true);
			}
		},
		[updateConfig],
	);

	const handleBodyToggle = useCallback(
		(checked: boolean) => {
			if (!checked) {
				updateConfig("body", undefined);
				updateConfig("body_type", undefined);
				updateConfig("_sendBody", undefined);
			} else {
				updateConfig("_sendBody", true);
				if (!configuration.body_type) {
					updateConfig("body_type", "json");
				}
			}
		},
		[updateConfig, configuration.body_type],
	);

	const handleHeadersChange = useCallback(
		(pairs: KeyValuePair[]) => {
			updateConfig("headers", pairsToRecord(pairs));
		},
		[updateConfig],
	);

	const handleQueryChange = useCallback(
		(pairs: KeyValuePair[]) => {
			updateConfig("queryParameters", pairsToRecord(pairs));
		},
		[updateConfig],
	);

	const handleBodyChange = useCallback(
		(val: string) => {
			if (bodyType === "json") {
				try {
					updateConfig("body", JSON.parse(val));
				} catch {
					updateConfig("body", val);
				}
			} else {
				updateConfig("body", val);
			}
		},
		[updateConfig, bodyType],
	);

	return (
		<div className="flex flex-col gap-[12px]">
			{/* Method */}
			<FieldWrapper
				value={method}
				onChange={(v) => updateConfig("method", v)}
				nodeId={nodeId}
				label="Method"
				required
			>
				<SearchableSelect
					options={METHOD_OPTIONS}
					value={method}
					onChange={(v) => updateConfig("method", v)}
					className="flex-1"
				/>
			</FieldWrapper>

			{/* URL */}
			<FieldWrapper
				value={url}
				onChange={(v) => updateConfig("url", v)}
				nodeId={nodeId}
				label="URL"
				required
			>
				<input
					type="text"
					className="w-full rounded-r-[6px] border border-l-0 border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
					value={url}
					onChange={(e) => updateConfig("url", e.target.value)}
					placeholder="https://api.example.com/endpoint"
				/>
			</FieldWrapper>

			{/* ── Send Query Parameters ── */}
			<div className="flex flex-col gap-[6px]">
				<Toggle
					name="send-query"
					checked={sendQuery}
					onCheckedChange={handleQueryToggle}
				>
					<span className="text-[12px] text-inverse">
						Send Query Parameters
					</span>
				</Toggle>
				{sendQuery && (
					<div className="pl-[4px]">
						<KeyValueEditor
							pairs={queryPairs.length > 0 ? queryPairs : [{ key: "", value: "" }]}
							onChange={handleQueryChange}
							nodeId={nodeId}
							keyPlaceholder="Parameter name"
							valuePlaceholder="Value"
							keyLabel="Name"
							valueLabel="Value"
							addLabel="+ Add parameter"
						/>
					</div>
				)}
			</div>

			{/* ── Send Headers ── */}
			<div className="flex flex-col gap-[6px]">
				<Toggle
					name="send-headers"
					checked={sendHeaders}
					onCheckedChange={handleHeadersToggle}
				>
					<span className="text-[12px] text-inverse">
						Send Headers
					</span>
				</Toggle>
				{sendHeaders && (
					<div className="pl-[4px]">
						<KeyValueEditor
							pairs={headerPairs.length > 0 ? headerPairs : [{ key: "", value: "" }]}
							onChange={handleHeadersChange}
							nodeId={nodeId}
							keyPlaceholder="Header name"
							valuePlaceholder="Value"
							keyLabel="Name"
							valueLabel="Value"
							addLabel="+ Add header"
						/>
					</div>
				)}
			</div>

			{/* ── Send Body ── */}
			<div className="flex flex-col gap-[6px]">
				<Toggle
					name="send-body"
					checked={sendBody}
					onCheckedChange={handleBodyToggle}
				>
					<span className="text-[12px] text-inverse">Send Body</span>
				</Toggle>
				{sendBody && (
					<div className="flex flex-col gap-[8px] pl-[4px]">
						<div className="flex flex-col gap-[4px]">
							<label className="text-[11px] text-text-muted">
								Body Content Type
							</label>
							<SearchableSelect
								options={BODY_TYPE_OPTIONS}
								value={bodyType}
								onChange={(v) => updateConfig("body_type", v)}
								className="w-full"
							/>
						</div>
						{bodyType === "json" ? (
							<InlineCodeEditor
								value={bodyValue}
								onChange={handleBodyChange}
								language="json"
								minHeight={80}
								maxHeight={300}
								placeholder='{"key": "value"}'
							/>
						) : bodyType === "form_data" ? (
							<KeyValueEditor
								pairs={
									typeof configuration.body === "object" &&
									configuration.body !== null
										? recordToPairs(configuration.body)
										: [{ key: "", value: "" }]
								}
								onChange={(pairs) =>
									updateConfig("body", pairsToRecord(pairs))
								}
								nodeId={nodeId}
								keyPlaceholder="Field name"
								valuePlaceholder="Value"
								keyLabel="Field"
								valueLabel="Value"
								addLabel="+ Add field"
							/>
						) : (
							<textarea
								className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-y min-h-[60px] font-mono"
								value={bodyValue}
								onChange={(e) => updateConfig("body", e.target.value)}
								placeholder="Raw body content..."
							/>
						)}
					</div>
				)}
			</div>

			{/* ── Options (collapsible) ── */}
			<div className="border-t border-inverse/5 pt-[8px]">
				<button
					type="button"
					className="flex items-center gap-[4px] text-[12px] text-text-muted hover:text-inverse/70 transition-colors"
					onClick={() => setShowOptions(!showOptions)}
				>
					<ChevronRightIcon
						className={`size-[12px] transition-transform ${showOptions ? "rotate-90" : ""}`}
					/>
					Options
				</button>
				{showOptions && (
					<div className="flex flex-col gap-[8px] mt-[8px] pl-[4px]">
						<Toggle
							name="follow-redirects"
							checked={configuration.followRedirects !== false}
							onCheckedChange={(checked) =>
								updateConfig("followRedirects", checked)
							}
						>
							<div className="flex items-center gap-[4px]">
								<span className="text-[12px] text-inverse">
									Follow Redirects
								</span>
								<span
									className="cursor-help"
									title="Automatically follow HTTP redirects"
								>
									<InfoIcon className="size-[11px] text-text-muted/40" />
								</span>
							</div>
						</Toggle>
						<Toggle
							name="response-binary"
							checked={Boolean(configuration.responseBinary)}
							onCheckedChange={(checked) =>
								updateConfig("responseBinary", checked)
							}
						>
							<span className="text-[12px] text-inverse">
								Response is Binary
							</span>
						</Toggle>
						<FieldWrapper
							value={String(configuration.timeout ?? "")}
							onChange={(v) => {
								const num = Number.parseInt(v, 10);
								updateConfig(
									"timeout",
									Number.isNaN(num) ? undefined : num,
								);
							}}
							nodeId={nodeId}
							label="Timeout (ms)"
							showContextMenu={false}
						>
							<input
								type="number"
								className="w-full rounded-r-[6px] border border-l-0 border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
								value={String(configuration.timeout ?? "")}
								onChange={(e) => {
									const num = Number.parseInt(
										e.target.value,
										10,
									);
									updateConfig(
										"timeout",
										Number.isNaN(num) ? undefined : num,
									);
								}}
								placeholder="10000"
							/>
						</FieldWrapper>
					</div>
				)}
			</div>
		</div>
	);
}
