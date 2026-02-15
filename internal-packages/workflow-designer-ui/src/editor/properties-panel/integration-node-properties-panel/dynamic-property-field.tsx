import type { NodeId } from "@giselles-ai/protocol";
import { LoaderIcon } from "lucide-react";
import { FieldWrapper } from "../ui/field-wrapper";
import { InlineCodeEditor } from "../ui/inline-code-editor";
import { SearchableSelect, type SelectOption } from "../ui/searchable-select";
import { useDynamicOptions } from "./use-dynamic-options";
import type { PropertyInfo } from "./use-piece-action-props";

interface DynamicPropertyFieldProps {
	prop: PropertyInfo;
	value: unknown;
	onChange: (value: unknown) => void;
	nodeId?: NodeId;
	/** Piece name for dynamic option resolution */
	pieceName?: string;
	/** Action name for dynamic option resolution */
	actionName?: string;
	/** All current configuration values (for dependent dropdowns) */
	allValues?: Record<string, unknown>;
}

export function DynamicPropertyField({
	prop,
	value,
	onChange,
	nodeId,
	pieceName,
	actionName,
	allValues,
}: DynamicPropertyFieldProps) {
	const stringValue = value != null ? String(value) : "";

	// For DROPDOWN/DYNAMIC_DROPDOWN types, use the dynamic options hook
	if (
		(prop.type === "DROPDOWN" || prop.type === "DYNAMIC_DROPDOWN") &&
		pieceName &&
		actionName
	) {
		return (
			<DynamicDropdownField
				prop={prop}
				value={value}
				onChange={onChange}
				nodeId={nodeId}
				pieceName={pieceName}
				actionName={actionName}
				allValues={allValues}
			/>
		);
	}

	return (
		<FieldWrapper
			value={stringValue}
			onChange={(v) => onChange(v)}
			nodeId={nodeId}
			label={prop.displayName}
			description={prop.description}
			required={prop.required}
			defaultValue={prop.defaultValue != null ? String(prop.defaultValue) : ""}
		>
			{renderFixedField(prop, value, stringValue, onChange)}
		</FieldWrapper>
	);
}

/** Dynamic dropdown that fetches options from the API */
function DynamicDropdownField({
	prop,
	value,
	onChange,
	nodeId,
	pieceName,
	actionName,
	allValues,
}: {
	prop: PropertyInfo;
	value: unknown;
	onChange: (value: unknown) => void;
	nodeId?: NodeId;
	pieceName: string;
	actionName: string;
	allValues?: Record<string, unknown>;
}) {
	const stringValue = value != null ? String(value) : "";
	const { options, loading } = useDynamicOptions(
		pieceName,
		actionName,
		prop.name,
		undefined,
		allValues,
	);

	const selectOptions: SelectOption[] = options.map((opt) => ({
		label: opt.label,
		value: String(opt.value),
	}));

	return (
		<FieldWrapper
			value={stringValue}
			onChange={(v) => onChange(v)}
			nodeId={nodeId}
			label={prop.displayName}
			description={prop.description}
			required={prop.required}
			defaultValue={prop.defaultValue != null ? String(prop.defaultValue) : ""}
		>
			{selectOptions.length > 0 ? (
				<SearchableSelect
					options={selectOptions}
					value={stringValue}
					onChange={(v) => onChange(v)}
					placeholder="Select..."
					loading={loading}
					className="flex-1"
				/>
			) : loading ? (
				<div className="flex items-center gap-[6px] rounded-r-[6px] border border-l-0 border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text-muted">
					<LoaderIcon className="size-[11px] animate-spin" />
					Loading options...
				</div>
			) : (
				<input
					type="text"
					className="w-full rounded-r-[6px] border border-l-0 border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
					placeholder={`${prop.displayName} (enter value)`}
					value={stringValue}
					onChange={(e) => onChange(e.target.value)}
				/>
			)}
		</FieldWrapper>
	);
}

function renderFixedField(
	prop: PropertyInfo,
	value: unknown,
	stringValue: string,
	onChange: (value: unknown) => void,
) {
	const baseInputClass =
		"w-full rounded-r-[6px] border border-l-0 border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30";

	switch (prop.type) {
		case "LONG_TEXT":
		case "MARKDOWN":
			return (
				<textarea
					className={`${baseInputClass} resize-y min-h-[60px]`}
					placeholder={prop.displayName}
					value={stringValue}
					onChange={(e) => onChange(e.target.value)}
				/>
			);

		case "NUMBER":
			return (
				<input
					type="number"
					className={baseInputClass}
					placeholder={prop.displayName}
					value={stringValue}
					onChange={(e) => {
						const num = Number.parseFloat(e.target.value);
						onChange(Number.isNaN(num) ? e.target.value : num);
					}}
				/>
			);

		case "CHECKBOX":
			return (
				<label className="flex items-center gap-[6px] rounded-r-[6px] border border-l-0 border-border-muted bg-transparent px-[8px] py-[6px] cursor-pointer">
					<input
						type="checkbox"
						className="rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500/30"
						checked={Boolean(value)}
						onChange={(e) => onChange(e.target.checked)}
					/>
					<span className="text-[12px] text-inverse">
						{Boolean(value) ? "Yes" : "No"}
					</span>
				</label>
			);

		case "STATIC_DROPDOWN":
			if (prop.options && prop.options.length > 0) {
				const selectOptions: SelectOption[] = prop.options.map(
					(opt) => ({
						label: opt.label,
						value: String(opt.value),
					}),
				);
				return (
					<SearchableSelect
						options={selectOptions}
						value={stringValue}
						onChange={(v) => onChange(v)}
						placeholder="Select..."
						className="flex-1"
					/>
				);
			}
			return (
				<input
					type="text"
					className={baseInputClass}
					placeholder={prop.displayName}
					value={stringValue}
					onChange={(e) => onChange(e.target.value)}
				/>
			);

		case "DROPDOWN":
		case "DYNAMIC_DROPDOWN":
			// Fallback for when dynamic resolution isn't available
			return (
				<input
					type="text"
					className={baseInputClass}
					placeholder={`${prop.displayName} (enter value)`}
					value={stringValue}
					onChange={(e) => onChange(e.target.value)}
				/>
			);

		case "MULTI_SELECT_DROPDOWN":
			if (prop.options && prop.options.length > 0) {
				const selectOptions: SelectOption[] = prop.options.map(
					(opt) => ({
						label: opt.label,
						value: String(opt.value),
					}),
				);
				return (
					<SearchableSelect
						options={selectOptions}
						value={stringValue}
						onChange={(v) => onChange(v)}
						placeholder="Select..."
						multi
						className="flex-1"
					/>
				);
			}
			return (
				<input
					type="text"
					className={baseInputClass}
					placeholder={`${prop.displayName} (comma-separated)`}
					value={stringValue}
					onChange={(e) => onChange(e.target.value)}
				/>
			);

		case "JSON":
		case "OBJECT":
			return (
				<InlineCodeEditor
					value={
						typeof value === "object" && value !== null
							? JSON.stringify(value, null, 2)
							: stringValue
					}
					onChange={(v) => {
						try {
							onChange(JSON.parse(v));
						} catch {
							onChange(v);
						}
					}}
					language="json"
					minHeight={80}
					maxHeight={300}
					placeholder='{"key": "value"}'
				/>
			);

		case "ARRAY":
			return (
				<InlineCodeEditor
					value={
						Array.isArray(value)
							? JSON.stringify(value, null, 2)
							: stringValue
					}
					onChange={(v) => {
						try {
							onChange(JSON.parse(v));
						} catch {
							onChange(v);
						}
					}}
					language="json"
					minHeight={60}
					maxHeight={200}
					placeholder='["item1", "item2"]'
				/>
			);

		case "SECRET_TEXT":
			return (
				<input
					type="password"
					className={baseInputClass}
					placeholder={prop.displayName}
					value={stringValue}
					onChange={(e) => onChange(e.target.value)}
				/>
			);

		case "DATE_TIME":
			return (
				<input
					type="datetime-local"
					className={baseInputClass}
					value={stringValue}
					onChange={(e) => onChange(e.target.value)}
				/>
			);

		case "FILE":
			return (
				<input
					type="text"
					className={baseInputClass}
					placeholder="File URL or path"
					value={stringValue}
					onChange={(e) => onChange(e.target.value)}
				/>
			);

		case "SHORT_TEXT":
		default:
			return (
				<input
					type="text"
					className={baseInputClass}
					placeholder={prop.displayName}
					value={stringValue}
					onChange={(e) => onChange(e.target.value)}
				/>
			);
	}
}
