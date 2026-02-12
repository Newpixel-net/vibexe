import type { NodeId } from "@giselles-ai/protocol";
import { ExpressionInput } from "../ui/expression-input";
import type { PropertyInfo } from "./use-piece-action-props";

interface DynamicPropertyFieldProps {
	prop: PropertyInfo;
	value: unknown;
	onChange: (value: unknown) => void;
	nodeId?: NodeId;
}

export function DynamicPropertyField({
	prop,
	value,
	onChange,
	nodeId,
}: DynamicPropertyFieldProps) {
	const id = `prop-${prop.name}`;
	const stringValue = value != null ? String(value) : "";

	return (
		<div className="flex flex-col gap-1">
			<label htmlFor={id} className="text-xs text-text-muted">
				{prop.displayName}
				{prop.required && <span className="text-red-400 ml-0.5">*</span>}
			</label>
			{prop.description && (
				<p className="text-[10px] text-text-muted/60 leading-tight">
					{prop.description}
				</p>
			)}
			{renderField(prop, id, value, stringValue, onChange, nodeId)}
		</div>
	);
}

function renderField(
	prop: PropertyInfo,
	id: string,
	value: unknown,
	stringValue: string,
	onChange: (value: unknown) => void,
	nodeId?: NodeId,
) {
	const baseInputClass =
		"w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-integration-node-1";

	switch (prop.type) {
		case "LONG_TEXT":
		case "MARKDOWN":
			return (
				<ExpressionInput
					value={stringValue}
					onChange={(val) => onChange(val)}
					placeholder={prop.displayName}
					nodeId={nodeId}
				/>
			);

		case "NUMBER":
			return (
				<input
					id={id}
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
				<label
					htmlFor={id}
					className="flex items-center gap-2 cursor-pointer"
				>
					<input
						id={id}
						type="checkbox"
						className="rounded border-white/10 bg-white/5 text-integration-node-1 focus:ring-integration-node-1"
						checked={Boolean(value)}
						onChange={(e) => onChange(e.target.checked)}
					/>
					<span className="text-xs text-inverse">{prop.displayName}</span>
				</label>
			);

		case "STATIC_DROPDOWN":
			if (prop.options && prop.options.length > 0) {
				return (
					<select
						id={id}
						className={`${baseInputClass} cursor-pointer [&>option]:bg-[#141120] [&>option]:text-white`}
						value={stringValue}
						onChange={(e) => onChange(e.target.value)}
					>
						<option value="">Select...</option>
						{prop.options.map((opt) => (
							<option key={String(opt.value)} value={String(opt.value)}>
								{opt.label}
							</option>
						))}
					</select>
				);
			}
			return (
				<ExpressionInput
					value={stringValue}
					onChange={(val) => onChange(val)}
					placeholder={prop.displayName}
					nodeId={nodeId}
				/>
			);

		case "DROPDOWN":
		case "DYNAMIC_DROPDOWN":
		case "MULTI_SELECT_DROPDOWN":
			return (
				<ExpressionInput
					value={stringValue}
					onChange={(val) => onChange(val)}
					placeholder={`${prop.displayName} (enter value)`}
					nodeId={nodeId}
				/>
			);

		case "JSON":
		case "OBJECT":
			return (
				<textarea
					id={id}
					className={`${baseInputClass} resize-y min-h-[80px] font-mono text-xs`}
					placeholder='{"key": "value"}'
					value={
						typeof value === "object" && value !== null
							? JSON.stringify(value, null, 2)
							: stringValue
					}
					onChange={(e) => {
						try {
							onChange(JSON.parse(e.target.value));
						} catch {
							onChange(e.target.value);
						}
					}}
				/>
			);

		case "ARRAY":
			return (
				<textarea
					id={id}
					className={`${baseInputClass} resize-y min-h-[60px] font-mono text-xs`}
					placeholder='["item1", "item2"]'
					value={
						Array.isArray(value)
							? JSON.stringify(value, null, 2)
							: stringValue
					}
					onChange={(e) => {
						try {
							onChange(JSON.parse(e.target.value));
						} catch {
							onChange(e.target.value);
						}
					}}
				/>
			);

		case "SECRET_TEXT":
			return (
				<input
					id={id}
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
					id={id}
					type="datetime-local"
					className={baseInputClass}
					value={stringValue}
					onChange={(e) => onChange(e.target.value)}
				/>
			);

		case "FILE":
			return (
				<ExpressionInput
					value={stringValue}
					onChange={(val) => onChange(val)}
					placeholder="File URL or path"
					nodeId={nodeId}
				/>
			);

		case "SHORT_TEXT":
		default:
			return (
				<ExpressionInput
					value={stringValue}
					onChange={(val) => onChange(val)}
					placeholder={prop.displayName}
					nodeId={nodeId}
				/>
			);
	}
}
