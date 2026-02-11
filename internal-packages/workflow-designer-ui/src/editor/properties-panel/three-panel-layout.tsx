"use client";

import clsx from "clsx/lite";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ReactNode } from "react";

function PanelLabel({ children }: { children: ReactNode }) {
	return (
		<div className="px-[12px] py-[6px] border-b border-inverse/10">
			<span className="text-[11px] font-semibold text-inverse/50 uppercase tracking-wider">
				{children}
			</span>
		</div>
	);
}

function ResizeGrip() {
	return (
		<PanelResizeHandle className="w-[1px] bg-inverse/10 hover:bg-inverse/30 transition-colors cursor-col-resize relative group">
			<div
				className={clsx(
					"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
					"w-[3px] h-[24px] rounded-full",
					"bg-inverse/20 group-hover:bg-inverse/40 transition-colors",
				)}
			/>
		</PanelResizeHandle>
	);
}

export function ThreePanelLayout({
	inputPanel,
	parametersPanel,
	outputPanel,
}: {
	inputPanel: ReactNode;
	parametersPanel: ReactNode;
	outputPanel: ReactNode;
}) {
	return (
		<div className="h-full w-full flex flex-col overflow-hidden">
			<PanelGroup direction="horizontal" className="flex-1 min-h-0">
				{/* Input Panel */}
				<Panel defaultSize={25} minSize={15} maxSize={40} order={1}>
					<div className="h-full flex flex-col overflow-hidden">
						<PanelLabel>Input</PanelLabel>
						<div className="flex-1 overflow-y-auto">{inputPanel}</div>
					</div>
				</Panel>

				<ResizeGrip />

				{/* Parameters Panel */}
				<Panel defaultSize={50} minSize={30} order={2}>
					<div className="h-full flex flex-col overflow-hidden">
						<PanelLabel>Parameters</PanelLabel>
						<div className="flex-1 overflow-y-auto overflow-x-hidden">
							{parametersPanel}
						</div>
					</div>
				</Panel>

				<ResizeGrip />

				{/* Output Panel */}
				<Panel defaultSize={25} minSize={15} maxSize={40} order={3}>
					<div className="h-full flex flex-col overflow-hidden">
						<PanelLabel>Output</PanelLabel>
						<div className="flex-1 overflow-y-auto">{outputPanel}</div>
					</div>
				</Panel>
			</PanelGroup>
		</div>
	);
}
