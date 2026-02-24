"use client";

import { Toggle } from "@vibexe-internal/ui/toggle";
import type { ErrorConfig, OperationNode } from "@vibexe-ai/protocol";
import { useState } from "react";
import { useUpdateNodeData } from "../../../app-designer";
import { SearchableSelect } from "./searchable-select";
import { SettingDetail, SettingLabel } from "./setting-label";

interface NodeSettingsTabProps {
	node: OperationNode;
}

export function NodeSettingsTab({ node }: NodeSettingsTabProps) {
	const updateNodeData = useUpdateNodeData();

	// Compute node version info for display
	const nodeContent = node.content as Record<string, unknown>;
	const nodeVersionInfo = nodeContent.pieceName
		? `${nodeContent.pieceName} v${nodeContent.pieceVersion ?? "latest"}`
		: null;

	const config: ErrorConfig = node.errorConfig ?? {
		retryOnFail: false,
		maxRetries: 3,
		retryDelay: 1000,
		onError: "stopWorkflow",
		timeoutEnabled: false,
		timeoutMs: 30000,
	};

	const updateErrorConfig = (partial: Partial<ErrorConfig>) => {
		updateNodeData(node, {
			errorConfig: { ...config, ...partial },
		} as Partial<typeof node>);
	};

	const updateNodeField = (partial: Partial<OperationNode>) => {
		updateNodeData(node, partial as Partial<typeof node>);
	};

	return (
		<div className="flex flex-col gap-[16px] p-[12px]">
			<SettingLabel size="md" colorClassName="text-inverse">
				Execution
			</SettingLabel>

			<Toggle
				name="node-disabled"
				checked={node.disabled ?? false}
				onCheckedChange={(checked) => {
					updateNodeField({ disabled: checked as boolean });
				}}
			>
				<label htmlFor="node-disabled" className="text-[14px] text-inverse">
					Disabled
				</label>
			</Toggle>

			{node.disabled && (
				<p className="text-[12px] text-[hsla(0,0%,100%,0.4)] px-[4px]">
					Disabled nodes pass input data through to downstream nodes without
					executing.
				</p>
			)}

			<Toggle
				name="always-output-data"
				checked={node.alwaysOutputData ?? false}
				onCheckedChange={(checked) => {
					updateNodeField({ alwaysOutputData: checked as boolean });
				}}
			>
				<label htmlFor="always-output-data" className="text-[14px] text-inverse">
					Always Output Data
				</label>
			</Toggle>

			{node.alwaysOutputData && (
				<p className="text-[12px] text-[hsla(0,0%,100%,0.4)] px-[4px]">
					When enabled, the node outputs an empty item if no data is produced.
					Prevents downstream nodes from failing due to missing input.
				</p>
			)}

			<Toggle
				name="execute-once"
				checked={node.executeOnce ?? false}
				onCheckedChange={(checked) => {
					updateNodeField({ executeOnce: checked as boolean });
				}}
			>
				<label htmlFor="execute-once" className="text-[14px] text-inverse">
					Execute Once
				</label>
			</Toggle>

			{node.executeOnce && (
				<p className="text-[12px] text-[hsla(0,0%,100%,0.4)] px-[4px]">
					When enabled, the node executes only once regardless of how many input
					items it receives. Useful for API calls that should run once.
				</p>
			)}

			<Toggle
				name="timeout-enabled"
				checked={config.timeoutEnabled ?? false}
				onCheckedChange={(checked) => {
					updateErrorConfig({ timeoutEnabled: checked as boolean });
				}}
			>
				<label htmlFor="timeout-enabled" className="text-[14px] text-inverse">
					Timeout
				</label>
			</Toggle>

			{config.timeoutEnabled && (
				<div className="flex items-center justify-between gap-[12px]">
					<SettingDetail size="md">Timeout (ms)</SettingDetail>
					<input
						type="number"
						min={1000}
						max={600000}
						step={1000}
						value={config.timeoutMs ?? 30000}
						onChange={(e) => {
							const value = Number.parseInt(e.target.value, 10);
							if (!Number.isNaN(value) && value >= 1000 && value <= 600000) {
								updateErrorConfig({ timeoutMs: value });
							}
						}}
						className="w-[80px] bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] text-inverse text-[14px] rounded-[6px] px-[8px] py-[4px] border border-white-400/20 text-center outline-none"
					/>
				</div>
			)}

			<div className="mt-[8px] border-t border-white-400/10 pt-[12px]" />

			<SettingLabel size="md" colorClassName="text-inverse">
				Error Handling
			</SettingLabel>

			<Toggle
				name="retry-on-fail"
				checked={config.retryOnFail}
				onCheckedChange={(checked) => {
					updateErrorConfig({ retryOnFail: checked as boolean });
				}}
			>
				<label htmlFor="retry-on-fail" className="text-[14px] text-inverse">
					Retry On Fail
				</label>
			</Toggle>

			{config.retryOnFail && (
				<>
					<div className="flex items-center justify-between gap-[12px]">
						<SettingDetail size="md">Max Retries</SettingDetail>
						<input
							type="number"
							min={0}
							max={10}
							value={config.maxRetries}
							onChange={(e) => {
								const value = Number.parseInt(e.target.value, 10);
								if (!Number.isNaN(value) && value >= 0 && value <= 10) {
									updateErrorConfig({ maxRetries: value });
								}
							}}
							className="w-[60px] bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] text-inverse text-[14px] rounded-[6px] px-[8px] py-[4px] border border-white-400/20 text-center outline-none"
						/>
					</div>

					<div className="flex items-center justify-between gap-[12px]">
						<SettingDetail size="md">Retry Delay (ms)</SettingDetail>
						<input
							type="number"
							min={0}
							max={60000}
							step={500}
							value={config.retryDelay}
							onChange={(e) => {
								const value = Number.parseInt(e.target.value, 10);
								if (!Number.isNaN(value) && value >= 0) {
									updateErrorConfig({ retryDelay: value });
								}
							}}
							className="w-[80px] bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] text-inverse text-[14px] rounded-[6px] px-[8px] py-[4px] border border-white-400/20 text-center outline-none"
						/>
					</div>
				</>
			)}

			<div className="flex items-center justify-between gap-[12px]">
				<SettingDetail size="md">On Error</SettingDetail>
				<div className="min-w-[160px]">
					<SearchableSelect
						options={[
							{ label: "Stop Workflow", value: "stopWorkflow" },
							{ label: "Continue On Fail", value: "continueOnFail" },
							{ label: "Route To Error Handler", value: "routeToError" },
						]}
						value={config.onError}
						onChange={(v) => {
							updateErrorConfig({
								onError: v as ErrorConfig["onError"],
							});
						}}
					/>
				</div>
			</div>

			{config.onError === "continueOnFail" && (
				<p className="text-[12px] text-[hsla(0,0%,100%,0.4)] px-[4px]">
					Downstream nodes will receive an error output instead of the expected
					data.
				</p>
			)}

			{config.onError === "routeToError" && (
				<p className="text-[12px] text-[hsla(0,0%,100%,0.4)] px-[4px]">
					Connect an Error Trigger node to handle the error. The error message,
					failed node ID, and timestamp will be passed to it.
				</p>
			)}

			<div className="mt-[8px] border-t border-white-400/10 pt-[12px]" />

			<SettingLabel size="md" colorClassName="text-inverse">
				Notes
			</SettingLabel>
			<textarea
				className="w-full min-h-[80px] p-[8px] rounded-[6px] bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_5%,transparent)] border border-white-400/10 text-[13px] text-inverse placeholder:text-inverse/30 resize-y outline-none focus:border-blue-500/30"
				value={(node as any).notes ?? ""}
				onChange={(e) => {
					updateNodeField({ notes: e.target.value || undefined } as any);
				}}
				placeholder="Add notes about this node..."
			/>

			{(node as any).notes && (
				<Toggle
					name="display-note-in-flow"
					checked={(node as any).displayNoteInFlow ?? false}
					onCheckedChange={(checked) => {
						updateNodeField({ displayNoteInFlow: checked as boolean } as any);
					}}
				>
					<label htmlFor="display-note-in-flow" className="text-[14px] text-inverse">
						Display Note in Flow?
					</label>
				</Toggle>
			)}

			{/* Node version info */}
			{nodeVersionInfo && (
				<>
					<div className="mt-[8px] border-t border-white-400/10 pt-[12px]" />
					<div className="text-[12px] text-[hsla(0,0%,100%,0.25)]">
						{nodeVersionInfo}
					</div>
				</>
			)}
		</div>
	);
}
