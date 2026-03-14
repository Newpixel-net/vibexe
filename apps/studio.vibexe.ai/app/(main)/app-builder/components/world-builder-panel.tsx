"use client";

/**
 * WorldBuilderPanel — Unity PWB-style object placement tool panel.
 *
 * 12 tools, each with dedicated settings section.
 * Communicates with iframe via postMessage (wb-* messages).
 */

import {
	ChevronDown,
	ChevronRight,
	Crosshair,
	Eraser,
	Grid3X3,
	Layers,
	MousePointer2,
	Paintbrush,
	RotateCcw,
	Undo2,
	Redo2,
	X,
	Trash2,
	Check,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	WB_TOOLS,
	type WBTool,
	type WBSnapSettings,
	type WBPinSettings,
	type WBBrushToolSettings,
	type WBBrushSettings,
	type WBEraserSettings,
	type WBLineSettings,
	type WBShapeSettings,
	type WBTilingSettings,
	type WBGravitySettings,
	type WBReplacerSettings,
	type WBExtrudeSettings,
	type WBMirrorSettings,
	DEFAULT_SNAP_SETTINGS,
	DEFAULT_PIN_SETTINGS,
	DEFAULT_BRUSH_TOOL_SETTINGS,
	DEFAULT_BRUSH_SETTINGS,
	DEFAULT_ERASER_SETTINGS,
	DEFAULT_LINE_SETTINGS,
	DEFAULT_SHAPE_SETTINGS,
	DEFAULT_TILING_SETTINGS,
	DEFAULT_GRAVITY_SETTINGS,
	DEFAULT_REPLACER_SETTINGS,
	DEFAULT_EXTRUDE_SETTINGS,
	DEFAULT_MIRROR_SETTINGS,
} from "../lib/world-builder-types";
import { SharedAssetBrowser, toWBItem } from "./shared-asset-browser";
import type { AssetLibraryItem } from "../lib/asset-library-data";

interface WorldBuilderPanelProps {
	sendToIframe: (msg: any) => void;
	onClose: () => void;
}

const TOOL_ICONS: Partial<Record<WBTool, React.ComponentType<{ className?: string }>>> = {
	pin: Crosshair,
	brush: Paintbrush,
	eraser: Eraser,
	select: MousePointer2,
};

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-[9px] text-white/30 w-[54px] shrink-0">{label}</span>
			<div className="flex-1 flex items-center gap-1">{children}</div>
		</div>
	);
}

function NumInput({
	value, onChange, min, max, step = 0.1, className = "",
}: {
	value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string;
}) {
	return (
		<input
			type="number" value={value}
			onChange={(e) => onChange(Number(e.target.value) || 0)}
			min={min} max={max} step={step}
			className={`w-14 bg-[#1a1a22] text-[10px] text-white/60 rounded px-1.5 py-0.5 border border-white/[0.08] ${className}`}
		/>
	);
}

function SmallSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
	return (
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="flex-1 bg-[#1a1a22] text-[10px] text-white/60 rounded px-1.5 py-0.5 border border-white/[0.08]"
		>
			{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
		</select>
	);
}

function ConfirmButton({ onClick, label }: { onClick: () => void; label: string }) {
	return (
		<button
			type="button" onClick={onClick}
			className="w-full flex items-center justify-center gap-1 px-2 py-1 mt-1 bg-green-500/15 text-green-400 text-[10px] rounded hover:bg-green-500/25 transition-colors"
		>
			<Check className="w-3 h-3" /> {label}
		</button>
	);
}

function Hint({ text }: { text: string }) {
	return <div className="text-[8px] text-white/20 mt-1">{text}</div>;
}

export function WorldBuilderPanel({ sendToIframe, onClose }: WorldBuilderPanelProps) {
	const [activeTool, setActiveTool] = useState<WBTool>("pin");
	const [activeItem, setActiveItem] = useState<{ id: string; name: string; modelPath: string; pack: string; category: string } | null>(null);
	const [snapSettings, setSnapSettings] = useState<WBSnapSettings>({ ...DEFAULT_SNAP_SETTINGS });
	const [pinSettings, setPinSettings] = useState<WBPinSettings>({ ...DEFAULT_PIN_SETTINGS });
	const [brushToolSettings, setBrushToolSettings] = useState<WBBrushToolSettings>({ ...DEFAULT_BRUSH_TOOL_SETTINGS });
	const [brushSettings, setBrushSettings] = useState<WBBrushSettings>({ ...DEFAULT_BRUSH_SETTINGS });
	const [eraserSettings, setEraserSettings] = useState<WBEraserSettings>({ ...DEFAULT_ERASER_SETTINGS });
	const [lineSettings, setLineSettings] = useState<WBLineSettings>({ ...DEFAULT_LINE_SETTINGS });
	const [shapeSettings, setShapeSettings] = useState<WBShapeSettings>({ ...DEFAULT_SHAPE_SETTINGS });
	const [tilingSettings, setTilingSettings] = useState<WBTilingSettings>({ ...DEFAULT_TILING_SETTINGS });
	const [gravitySettings, setGravitySettings] = useState<WBGravitySettings>({ ...DEFAULT_GRAVITY_SETTINGS });
	const [replacerSettings, setReplacerSettings] = useState<WBReplacerSettings>({ ...DEFAULT_REPLACER_SETTINGS });
	const [extrudeSettings, setExtrudeSettings] = useState<WBExtrudeSettings>({ ...DEFAULT_EXTRUDE_SETTINGS });
	const [mirrorSettings, setMirrorSettings] = useState<WBMirrorSettings>({ ...DEFAULT_MIRROR_SETTINGS });
	const [gridOpen, setGridOpen] = useState(false);
	const [brushPropsOpen, setBrushPropsOpen] = useState(false);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	const [selectionCount, setSelectionCount] = useState(0);

	// Stabilize sendToIframe — ref always points to latest function, never triggers re-renders
	const sendRef = useRef(sendToIframe);
	sendRef.current = sendToIframe;
	const stableSend = useCallback((msg: any) => sendRef.current(msg), []);

	// Listen for bridge messages
	useEffect(() => {
		const handler = (e: MessageEvent) => {
			const data = e.data;
			if (!data || typeof data !== "object") return;
			if (data.type === "wb-undo-state") { setCanUndo(!!data.canUndo); setCanRedo(!!data.canRedo); }
			else if (data.type === "wb-brush-settings-changed" && data.settings) setBrushSettings((p) => ({ ...p, ...data.settings }));
			else if (data.type === "wb-eraser-settings-changed" && data.settings) setEraserSettings((p) => ({ ...p, ...data.settings }));
			else if (data.type === "wb-brush-tool-settings-changed" && data.settings) setBrushToolSettings((p) => ({ ...p, ...data.settings }));
			else if (data.type === "wb-replacer-settings-changed" && data.settings) setReplacerSettings((p) => ({ ...p, ...data.settings }));
			else if (data.type === "wb-shape-settings-changed" && data.settings) setShapeSettings((p) => ({ ...p, ...data.settings }));
			else if (data.type === "wb-selection-changed") setSelectionCount(data.count || 0);
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, []);

	useEffect(() => { stableSend({ type: "wb-enable" }); return () => { stableSend({ type: "wb-disable" }); }; }, [stableSend]);

	const handleToolChange = useCallback((tool: WBTool) => { setActiveTool(tool); stableSend({ type: "wb-set-tool", tool }); }, [stableSend]);

	const handleItemSelect = useCallback((item: AssetLibraryItem, color: string) => {
		const wbItem = toWBItem(item, color);
		if (activeItem?.id === wbItem.id) { setActiveItem(null); stableSend({ type: "wb-set-active-item", item: null }); }
		else {
			setActiveItem(wbItem); stableSend({ type: "wb-set-active-item", item: wbItem });
			if (activeTool === "eraser" || activeTool === "select" || activeTool === "replacer") { setActiveTool("pin"); stableSend({ type: "wb-set-tool", tool: "pin" }); }
		}
	}, [activeItem, activeTool, stableSend]);

	// Generic settings updater factory
	const makeUpdater = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, msgType: string) =>
		useCallback((patch: Partial<T>) => {
			setter((prev) => { const next = { ...prev, ...patch } as T; stableSend({ type: msgType, settings: next }); return next; });
		}, [stableSend]);

	const updateSnap = makeUpdater(setSnapSettings, "wb-update-snap");
	const updatePin = makeUpdater(setPinSettings, "wb-update-pin-settings");
	const updateBrushTool = makeUpdater(setBrushToolSettings, "wb-update-brush-tool-settings");
	const updateBrush = makeUpdater(setBrushSettings, "wb-update-brush-settings");
	const updateEraser = makeUpdater(setEraserSettings, "wb-update-eraser-settings");
	const updateLine = makeUpdater(setLineSettings, "wb-update-line-settings");
	const updateShape = makeUpdater(setShapeSettings, "wb-update-shape-settings");
	const updateTiling = makeUpdater(setTilingSettings, "wb-update-tiling-settings");
	const updateGravity = makeUpdater(setGravitySettings, "wb-update-gravity-settings");
	const updateReplacer = makeUpdater(setReplacerSettings, "wb-update-replacer-settings");
	const updateExtrude = makeUpdater(setExtrudeSettings, "wb-update-extrude-settings");
	const updateMirror = makeUpdater(setMirrorSettings, "wb-update-mirror-settings");

	const handleUndo = useCallback(() => stableSend({ type: "wb-undo" }), [stableSend]);
	const handleRedo = useCallback(() => stableSend({ type: "wb-redo" }), [stableSend]);
	const handleClear = useCallback(() => { if (confirm("Remove all placed objects?")) stableSend({ type: "wb-clear-all" }); }, [stableSend]);

	// Which tools show brush properties
	const showBrushProps = activeTool === "pin" || activeTool === "brush" || activeTool === "line" || activeTool === "shape" || activeTool === "gravity" || activeTool === "tiling-floor" || activeTool === "tiling-wall";

	return (
		<div className="absolute top-0 right-0 bottom-0 w-[280px] bg-[#0e0e12]/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-40 text-white">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08]">
				<div className="flex items-center gap-2">
					<Layers className="w-4 h-4 text-amber-400" />
					<span className="text-[12px] font-medium text-white/80">World Builder</span>
				</div>
				<button type="button" onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors"><X className="w-4 h-4" /></button>
			</div>

			{/* Tool Bar */}
			<div className="px-2 py-1.5 border-b border-white/[0.06]">
				<div className="flex flex-wrap gap-0.5">
					{WB_TOOLS.map((tool) => {
						const isActive = activeTool === tool.id;
						const Icon = TOOL_ICONS[tool.id];
						const gc: Record<string, string> = { place: "text-green-400", modify: "text-orange-400", edit: "text-blue-400" };
						return (
							<button key={tool.id} type="button" onClick={() => handleToolChange(tool.id)}
								className={`px-1.5 py-1 text-[9px] rounded transition-all ${isActive ? "bg-white/[0.12] text-white/90 ring-1 ring-white/20" : "text-white/35 hover:bg-white/[0.06] hover:text-white/60"}`}
								title={`${tool.label} (${tool.group})`}
							>
								{Icon ? <Icon className={`w-3 h-3 ${isActive ? gc[tool.group] : ""}`} /> : tool.label}
							</button>
						);
					})}
				</div>
				<div className="flex items-center gap-1 mt-1">
					<button type="button" onClick={handleUndo} disabled={!canUndo} className={`p-1 rounded ${canUndo ? "text-white/40 hover:text-white/70" : "text-white/15"}`} title="Undo (Ctrl+Z)"><Undo2 className="w-3 h-3" /></button>
					<button type="button" onClick={handleRedo} disabled={!canRedo} className={`p-1 rounded ${canRedo ? "text-white/40 hover:text-white/70" : "text-white/15"}`} title="Redo (Ctrl+Y)"><Redo2 className="w-3 h-3" /></button>
					<div className="flex-1" />
					<button type="button" onClick={handleClear} className="p-1 rounded text-white/25 hover:text-red-400 transition-colors" title="Clear all"><Trash2 className="w-3 h-3" /></button>
				</div>
			</div>

			{/* ═══ Tool-Specific Settings ═══ */}

			{activeTool === "pin" && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">Pin Tool</div>
					<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
						<input type="checkbox" checked={pinSettings.repeat} onChange={(e) => updatePin({ repeat: e.target.checked })} className="w-3 h-3 rounded accent-green-500" />
						Repeat (keep placing)
					</label>
					<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
						<input type="checkbox" checked={pinSettings.avoidOverlapping} onChange={(e) => updatePin({ avoidOverlapping: e.target.checked })} className="w-3 h-3 rounded accent-green-500" />
						Avoid overlapping
					</label>
					<Hint text="Scroll: surface distance | Shift+Scroll: scale | R: rotate 90°" />
				</div>
			)}

			{activeTool === "brush" && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">Brush Tool</div>
					<SettingRow label="Shape">
						<SmallSelect value={brushToolSettings.brushShape} onChange={(v) => updateBrushTool({ brushShape: v as any })}
							options={[{ value: "point", label: "Point" }, { value: "circle", label: "Circle" }, { value: "square", label: "Square" }]} />
					</SettingRow>
					<SettingRow label="Radius">
						<input type="range" min={0.5} max={20} step={0.5} value={brushToolSettings.radius} onChange={(e) => updateBrushTool({ radius: Number(e.target.value) })} className="flex-1 accent-green-500 h-1" />
						<span className="text-[9px] text-white/40 w-6 text-right">{brushToolSettings.radius}</span>
					</SettingRow>
					<SettingRow label="Density">
						<input type="range" min={1} max={100} step={1} value={brushToolSettings.density} onChange={(e) => updateBrushTool({ density: Number(e.target.value) })} className="flex-1 accent-green-500 h-1" />
						<span className="text-[9px] text-white/40 w-6 text-right">{brushToolSettings.density}%</span>
					</SettingRow>
					<SettingRow label="Spacing">
						<NumInput value={brushToolSettings.minSpacing} onChange={(v) => updateBrushTool({ minSpacing: Math.max(0, v) })} min={0} step={0.1} />
					</SettingRow>
					<SettingRow label="Slope">
						<NumInput value={brushToolSettings.slopeFilter.min} onChange={(v) => updateBrushTool({ slopeFilter: { ...brushToolSettings.slopeFilter, min: v } })} min={0} max={90} step={1} className="w-10" />
						<span className="text-[8px] text-white/20">-</span>
						<NumInput value={brushToolSettings.slopeFilter.max} onChange={(v) => updateBrushTool({ slopeFilter: { ...brushToolSettings.slopeFilter, max: v } })} min={0} max={90} step={1} className="w-10" />
						<span className="text-[8px] text-white/20">°</span>
					</SettingRow>
					<SettingRow label="Overlap">
						<SmallSelect value={brushToolSettings.avoidOverlapping} onChange={(v) => updateBrushTool({ avoidOverlapping: v as any })}
							options={[{ value: "disabled", label: "Off" }, { value: "all", label: "All" }, { value: "same", label: "Same type" }, { value: "brush", label: "Brush only" }, { value: "palette", label: "Palette" }]} />
					</SettingRow>
					<Hint text="Scroll: radius | Shift+Scroll: density" />
				</div>
			)}

			{activeTool === "eraser" && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">Eraser Tool</div>
					<SettingRow label="Radius">
						<input type="range" min={0.5} max={20} step={0.5} value={eraserSettings.radius} onChange={(e) => updateEraser({ radius: Number(e.target.value) })} className="flex-1 accent-orange-500 h-1" />
						<span className="text-[9px] text-white/40 w-6 text-right">{eraserSettings.radius}</span>
					</SettingRow>
					<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
						<input type="checkbox" checked={eraserSettings.onlyClosest} onChange={(e) => updateEraser({ onlyClosest: e.target.checked })} className="w-3 h-3 rounded accent-orange-500" />
						Only closest to camera
					</label>
					<Hint text="Scroll: radius | Click or drag to erase" />
				</div>
			)}

			{activeTool === "line" && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">Line Tool</div>
					<SettingRow label="Spacing">
						<SmallSelect value={lineSettings.spacingType} onChange={(v) => updateLine({ spacingType: v as any })}
							options={[{ value: "bounds", label: "Bounds" }, { value: "constant", label: "Constant" }]} />
					</SettingRow>
					{lineSettings.spacingType === "constant" && (
						<SettingRow label="Distance"><NumInput value={lineSettings.spacing} onChange={(v) => updateLine({ spacing: Math.max(0.1, v) })} min={0.1} step={0.1} /></SettingRow>
					)}
					<SettingRow label="Gap"><NumInput value={lineSettings.gapSize} onChange={(v) => updateLine({ gapSize: v })} min={0} step={0.1} /></SettingRow>
					<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
						<input type="checkbox" checked={lineSettings.objectsOrientedAlongLine} onChange={(e) => updateLine({ objectsOrientedAlongLine: e.target.checked })} className="w-3 h-3 rounded accent-green-500" />
						Orient along line
					</label>
					<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
						<input type="checkbox" checked={lineSettings.closed} onChange={(e) => updateLine({ closed: e.target.checked })} className="w-3 h-3 rounded accent-green-500" />
						Closed path
					</label>
					<ConfirmButton onClick={() => stableSend({ type: "wb-confirm-line" })} label="Place Along Line (Enter)" />
					<Hint text="Click: add point | Backspace: remove last | Esc: cancel" />
				</div>
			)}

			{activeTool === "shape" && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">Shape Tool</div>
					<SettingRow label="Type">
						<SmallSelect value={shapeSettings.shapeType} onChange={(v) => updateShape({ shapeType: v as any })}
							options={[{ value: "circle", label: "Circle" }, { value: "polygon", label: "Polygon" }]} />
					</SettingRow>
					{shapeSettings.shapeType === "polygon" && (
						<SettingRow label="Sides"><NumInput value={shapeSettings.sidesCount} onChange={(v) => updateShape({ sidesCount: Math.max(3, v) })} min={3} step={1} /></SettingRow>
					)}
					<SettingRow label="Spacing">
						<SmallSelect value={shapeSettings.spacingType} onChange={(v) => updateShape({ spacingType: v as any })}
							options={[{ value: "bounds", label: "Bounds" }, { value: "constant", label: "Constant" }]} />
					</SettingRow>
					{shapeSettings.spacingType === "constant" && (
						<SettingRow label="Distance"><NumInput value={shapeSettings.spacing} onChange={(v) => updateShape({ spacing: Math.max(0.1, v) })} min={0.1} step={0.1} /></SettingRow>
					)}
					<SettingRow label="Gap"><NumInput value={shapeSettings.gapSize} onChange={(v) => updateShape({ gapSize: v })} min={0} step={0.1} /></SettingRow>
					<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
						<input type="checkbox" checked={shapeSettings.objectsOrientedAlongLine} onChange={(e) => updateShape({ objectsOrientedAlongLine: e.target.checked })} className="w-3 h-3 rounded accent-green-500" />
						Orient along shape
					</label>
					<ConfirmButton onClick={() => stableSend({ type: "wb-confirm-shape" })} label="Place Shape (Enter)" />
					<Hint text="Click+drag: set center & radius | Scroll: radius | Shift+Scroll: sides" />
				</div>
			)}

			{(activeTool === "tiling-floor" || activeTool === "tiling-wall") && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">{activeTool === "tiling-floor" ? "Floor" : "Wall"} Tiling</div>
					<SettingRow label="Cell Size">
						<SmallSelect value={tilingSettings.cellSizeType} onChange={(v) => updateTiling({ cellSizeType: v as any })}
							options={[{ value: "smallest", label: "Smallest" }, { value: "biggest", label: "Biggest" }, { value: "custom", label: "Custom" }]} />
					</SettingRow>
					{tilingSettings.cellSizeType === "custom" && (
						<SettingRow label="Size">
							<span className="text-[8px] text-white/20">W</span>
							<NumInput value={tilingSettings.cellSize.w} onChange={(v) => updateTiling({ cellSize: { ...tilingSettings.cellSize, w: Math.max(0.1, v) } })} min={0.1} step={0.1} className="w-10" />
							<span className="text-[8px] text-white/20">H</span>
							<NumInput value={tilingSettings.cellSize.h} onChange={(v) => updateTiling({ cellSize: { ...tilingSettings.cellSize, h: Math.max(0.1, v) } })} min={0.1} step={0.1} className="w-10" />
						</SettingRow>
					)}
					<SettingRow label="Spacing">
						<span className="text-[8px] text-white/20">W</span>
						<NumInput value={tilingSettings.spacing.w} onChange={(v) => updateTiling({ spacing: { ...tilingSettings.spacing, w: v } })} min={0} step={0.1} className="w-10" />
						<span className="text-[8px] text-white/20">H</span>
						<NumInput value={tilingSettings.spacing.h} onChange={(v) => updateTiling({ spacing: { ...tilingSettings.spacing, h: v } })} min={0} step={0.1} className="w-10" />
					</SettingRow>
					<ConfirmButton onClick={() => stableSend({ type: "wb-confirm-tiling" })} label="Fill Area (Enter)" />
					<Hint text="Click+drag: define area | Enter: place tiles | Esc: cancel" />
				</div>
			)}

			{activeTool === "gravity" && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">Gravity Tool</div>
					<SettingRow label="Height"><NumInput value={gravitySettings.height} onChange={(v) => updateGravity({ height: Math.max(0.5, v) })} min={0.5} step={1} /></SettingRow>
					<SettingRow label="Mass"><NumInput value={gravitySettings.mass} onChange={(v) => updateGravity({ mass: Math.max(0.1, v) })} min={0.1} step={0.5} /></SettingRow>
					<SettingRow label="Drag"><NumInput value={gravitySettings.drag} onChange={(v) => updateGravity({ drag: Math.max(0, v) })} min={0} step={0.1} /></SettingRow>
					<SettingRow label="Steps"><NumInput value={gravitySettings.maxIterations} onChange={(v) => updateGravity({ maxIterations: Math.max(10, v) })} min={10} step={10} /></SettingRow>
					<Hint text="Click: drop object from height" />
				</div>
			)}

			{activeTool === "replacer" && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">Replacer Tool</div>
					<SettingRow label="Radius">
						<input type="range" min={0.5} max={20} step={0.5} value={replacerSettings.radius} onChange={(e) => updateReplacer({ radius: Number(e.target.value) })} className="flex-1 accent-orange-500 h-1" />
						<span className="text-[9px] text-white/40 w-6 text-right">{replacerSettings.radius}</span>
					</SettingRow>
					<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
						<input type="checkbox" checked={replacerSettings.keepTargetSize} onChange={(e) => updateReplacer({ keepTargetSize: e.target.checked })} className="w-3 h-3 rounded accent-orange-500" />
						Keep target size
					</label>
					<Hint text="Scroll: radius | Click to replace in area" />
				</div>
			)}

			{activeTool === "select" && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">Select Tool</div>
					<div className="text-[10px] text-white/40">{selectionCount > 0 ? `${selectionCount} selected` : "No selection"}</div>
					{selectionCount > 0 && (
						<>
							<button type="button" onClick={() => stableSend({ type: "wb-delete-selected" })}
								className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-red-500/15 text-red-400 text-[10px] rounded hover:bg-red-500/25 transition-colors">
								<Trash2 className="w-3 h-3" /> Delete Selected
							</button>
							<button type="button" onClick={() => stableSend({ type: "wb-select-all" })}
								className="w-full px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] rounded hover:bg-blue-500/20 transition-colors">
								Select All (Ctrl+A)
							</button>
						</>
					)}
					<Hint text="Click: select | Ctrl+Click: multi-select | Del: delete" />
				</div>
			)}

			{activeTool === "extrude" && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">Extrude Tool</div>
					{selectionCount === 0 && <div className="text-[9px] text-orange-400/60">Select objects first (Select tool)</div>}
					<SettingRow label="Spacing">
						<SmallSelect value={extrudeSettings.spacingType} onChange={(v) => updateExtrude({ spacingType: v as any })}
							options={[{ value: "box-size", label: "Box Size" }, { value: "custom", label: "Custom" }]} />
					</SettingRow>
					{extrudeSettings.spacingType === "custom" && (
						<SettingRow label="Distance">
							{(["x", "y", "z"] as const).map((a) => (
								<label key={a} className="flex items-center gap-0.5">
									<span className="text-[8px] text-white/20 uppercase">{a}</span>
									<NumInput value={extrudeSettings.spacing[a]} onChange={(v) => updateExtrude({ spacing: { ...extrudeSettings.spacing, [a]: v } })} step={0.5} className="w-10" />
								</label>
							))}
						</SettingRow>
					)}
					<div className="flex items-center gap-1">
						<span className="text-[9px] text-white/30 w-[54px]">Axis</span>
						{(["x", "y", "z"] as const).map((a) => (
							<button key={a} type="button"
								onClick={() => stableSend({ type: "wb-extrude-axis", axis: a })}
								className="px-2 py-0.5 text-[9px] bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors uppercase">{a}
							</button>
						))}
					</div>
					<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
						<input type="checkbox" checked={extrudeSettings.addRandomRotation} onChange={(e) => updateExtrude({ addRandomRotation: e.target.checked })} className="w-3 h-3 rounded accent-blue-500" />
						Random rotation
					</label>
					<ConfirmButton onClick={() => stableSend({ type: "wb-confirm-extrude" })} label="Extrude (Enter)" />
					<Hint text="Select objects, pick axis, Enter to extrude" />
				</div>
			)}

			{activeTool === "mirror" && (
				<div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
					<div className="text-[9px] text-white/50 font-medium mb-1">Mirror Tool</div>
					{selectionCount === 0 && <div className="text-[9px] text-orange-400/60">Select objects first (Select tool)</div>}
					<SettingRow label="Action">
						<SmallSelect value={mirrorSettings.action} onChange={(v) => updateMirror({ action: v as any })}
							options={[{ value: "create", label: "Create Copy" }, { value: "transform", label: "Move Original" }]} />
					</SettingRow>
					<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
						<input type="checkbox" checked={mirrorSettings.reflectRotation} onChange={(e) => updateMirror({ reflectRotation: e.target.checked })} className="w-3 h-3 rounded accent-blue-500" />
						Reflect rotation
					</label>
					<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
						<input type="checkbox" checked={mirrorSettings.invertScale} onChange={(e) => updateMirror({ invertScale: e.target.checked })} className="w-3 h-3 rounded accent-blue-500" />
						Invert scale
					</label>
					<ConfirmButton onClick={() => stableSend({ type: "wb-confirm-mirror" })} label="Mirror (Enter)" />
					<Hint text="Click: place mirror plane | R: rotate plane | Enter: confirm" />
				</div>
			)}

			{/* Brush Properties (shared) */}
			{showBrushProps && (
				<div className="border-b border-white/[0.06]">
					<button type="button" onClick={() => setBrushPropsOpen(!brushPropsOpen)}
						className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors">
						{brushPropsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
						<RotateCcw className="w-3 h-3" /><span>Brush Properties</span>
					</button>
					{brushPropsOpen && (
						<div className="px-3 pb-2 space-y-1.5">
							<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
								<input type="checkbox" checked={brushSettings.rotateToSurface} onChange={(e) => updateBrush({ rotateToSurface: e.target.checked })} className="w-3 h-3 rounded accent-amber-500" />
								Rotate to surface
							</label>
							<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
								<input type="checkbox" checked={brushSettings.alwaysOrientUp} onChange={(e) => updateBrush({ alwaysOrientUp: e.target.checked })} className="w-3 h-3 rounded accent-amber-500" />
								Always orient up
							</label>
							<SettingRow label="Euler Off.">
								{(["x", "y", "z"] as const).map((a) => (
									<label key={a} className="flex items-center gap-0.5">
										<span className="text-[8px] text-white/20 uppercase">{a}</span>
										<NumInput value={brushSettings.eulerOffset[a]} onChange={(v) => updateBrush({ eulerOffset: { ...brushSettings.eulerOffset, [a]: v } })} step={5} className="w-10" />
									</label>
								))}
							</SettingRow>
							<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
								<input type="checkbox" checked={brushSettings.addRandomRotation} onChange={(e) => updateBrush({ addRandomRotation: e.target.checked })} className="w-3 h-3 rounded accent-amber-500" />
								Random rotation
							</label>
							{brushSettings.addRandomRotation && (
								<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer pl-4">
									<input type="checkbox" checked={brushSettings.rotateInMultiples} onChange={(e) => updateBrush({ rotateInMultiples: e.target.checked })} className="w-3 h-3 rounded accent-amber-500" />
									In multiples of
									<NumInput value={brushSettings.rotationFactor} onChange={(v) => updateBrush({ rotationFactor: v })} min={1} step={5} className="w-10" />
									<span className="text-[8px] text-white/20">°</span>
								</label>
							)}
							<SettingRow label="Surf. Dist"><NumInput value={brushSettings.surfaceDistance} onChange={(v) => updateBrush({ surfaceDistance: v })} step={0.05} /></SettingRow>
							<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
								<input type="checkbox" checked={brushSettings.embedInSurface} onChange={(e) => updateBrush({ embedInSurface: e.target.checked })} className="w-3 h-3 rounded accent-amber-500" />
								Embed in surface
							</label>
							<SettingRow label="Scale">
								<label className="flex items-center gap-1 text-[8px] text-white/20">
									<input type="checkbox" checked={brushSettings.separateScaleAxes} onChange={(e) => updateBrush({ separateScaleAxes: e.target.checked })} className="w-2.5 h-2.5 rounded accent-amber-500" />
									Sep
								</label>
								{brushSettings.separateScaleAxes ? (
									(["x", "y", "z"] as const).map((a) => (
										<label key={a} className="flex items-center gap-0.5">
											<span className="text-[8px] text-white/20 uppercase">{a}</span>
											<NumInput value={brushSettings.scaleMultiplier[a]} onChange={(v) => updateBrush({ scaleMultiplier: { ...brushSettings.scaleMultiplier, [a]: v } })} min={0.01} step={0.05} className="w-10" />
										</label>
									))
								) : (
									<NumInput value={brushSettings.scaleMultiplier.x} onChange={(v) => updateBrush({ scaleMultiplier: { x: v, y: v, z: v } })} min={0.01} step={0.05} />
								)}
							</SettingRow>
							<label className="flex items-center gap-2 text-[9px] text-white/40 cursor-pointer">
								<input type="checkbox" checked={brushSettings.randomScaleMultiplier} onChange={(e) => updateBrush({ randomScaleMultiplier: e.target.checked })} className="w-3 h-3 rounded accent-amber-500" />
								Random scale
							</label>
							{brushSettings.randomScaleMultiplier && (
								<SettingRow label="Range">
									<NumInput value={brushSettings.randomScaleMultiplierRange.x.min} onChange={(v) => updateBrush({ randomScaleMultiplierRange: { x: { ...brushSettings.randomScaleMultiplierRange.x, min: v }, y: { ...brushSettings.randomScaleMultiplierRange.y, min: v }, z: { ...brushSettings.randomScaleMultiplierRange.z, min: v } } })} min={0.01} step={0.05} className="w-10" />
									<span className="text-[8px] text-white/20">-</span>
									<NumInput value={brushSettings.randomScaleMultiplierRange.x.max} onChange={(v) => updateBrush({ randomScaleMultiplierRange: { x: { ...brushSettings.randomScaleMultiplierRange.x, max: v }, y: { ...brushSettings.randomScaleMultiplierRange.y, max: v }, z: { ...brushSettings.randomScaleMultiplierRange.z, max: v } } })} min={0.01} step={0.05} className="w-10" />
								</SettingRow>
							)}
							<SettingRow label="Flip X">
								<SmallSelect value={brushSettings.flipX} onChange={(v) => updateBrush({ flipX: v as any })}
									options={[{ value: "none", label: "None" }, { value: "flip", label: "Always" }, { value: "random", label: "Random" }]} />
							</SettingRow>
							<SettingRow label="Flip Y">
								<SmallSelect value={brushSettings.flipY} onChange={(v) => updateBrush({ flipY: v as any })}
									options={[{ value: "none", label: "None" }, { value: "flip", label: "Always" }, { value: "random", label: "Random" }]} />
							</SettingRow>
							<SettingRow label="Pos Offset">
								{(["x", "y", "z"] as const).map((a) => (
									<label key={a} className="flex items-center gap-0.5">
										<span className="text-[8px] text-white/20 uppercase">{a}</span>
										<NumInput value={brushSettings.localPositionOffset[a]} onChange={(v) => updateBrush({ localPositionOffset: { ...brushSettings.localPositionOffset, [a]: v } })} step={0.1} className="w-10" />
									</label>
								))}
							</SettingRow>
						</div>
					)}
				</div>
			)}

			{/* Asset Browser (shared single source of truth) */}
			<SharedAssetBrowser
				onSelect={handleItemSelect}
				selectedItemId={activeItem?.id ?? null}
				columns={3}
				highlightColor="amber"
				showPackFilter
			/>

			{/* Active item status bar */}
			{activeItem && (
				<div className="flex-shrink-0 px-2 py-1 bg-amber-500/10 border-t border-amber-500/20 text-[10px] text-amber-400 text-center">
					{activeTool === "pin" ? "Click to place" : activeTool === "brush" ? "Paint to scatter" : activeTool === "line" ? "Click points, Enter to place" : activeTool === "shape" ? "Drag to set shape" : activeTool === "gravity" ? "Click to drop" : activeTool === "replacer" ? "Click to replace" : ""}: {activeItem.name}
				</div>
			)}

			{/* Grid Settings */}
			<div className="border-t border-white/[0.06]">
				<button type="button" onClick={() => setGridOpen(!gridOpen)}
					className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors">
					{gridOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
					<Grid3X3 className="w-3 h-3" /><span>Grid & Snap</span>
					<div className="flex-1" />
					<label className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
						<input type="checkbox" checked={snapSettings.enabled} onChange={(e) => updateSnap({ enabled: e.target.checked })} className="w-3 h-3 rounded accent-amber-500" />
						<span className="text-[9px]">{snapSettings.enabled ? "ON" : "OFF"}</span>
					</label>
				</button>
				{gridOpen && (
					<div className="px-3 pb-2 space-y-1.5">
						<SettingRow label="Type">
							<SmallSelect value={snapSettings.gridType} onChange={(v) => updateSnap({ gridType: v as any })}
								options={[{ value: "rectangular", label: "Rectangular" }, { value: "radial", label: "Radial" }]} />
						</SettingRow>
						{snapSettings.gridType === "rectangular" ? (
							<SettingRow label="Step">
								{(["x", "z"] as const).map((a) => (
									<label key={a} className="flex items-center gap-0.5">
										<span className="text-[8px] text-white/20 uppercase">{a}</span>
										<NumInput value={snapSettings.step[a]} onChange={(v) => updateSnap({ step: { ...snapSettings.step, [a]: v || 1 } })} min={0.1} step={0.1} className="w-12" />
									</label>
								))}
							</SettingRow>
						) : (
							<>
								<SettingRow label="Radius"><NumInput value={snapSettings.radialStep} onChange={(v) => updateSnap({ radialStep: v || 1 })} min={0.1} step={0.1} /></SettingRow>
								<SettingRow label="Sectors"><NumInput value={snapSettings.radialSectors} onChange={(v) => updateSnap({ radialSectors: v || 8 })} min={2} step={1} /></SettingRow>
							</>
						)}
						<label className="flex items-center gap-2 text-[9px] text-white/40">
							<input type="checkbox" checked={snapSettings.showGrid} onChange={(e) => updateSnap({ showGrid: e.target.checked })} className="w-3 h-3 rounded accent-amber-500" />
							Show Grid
						</label>
						{snapSettings.gridType === "rectangular" && (
							<label className="flex items-center gap-2 text-[9px] text-white/40">
								<input type="checkbox" checked={snapSettings.midpointSnapping} onChange={(e) => updateSnap({ midpointSnapping: e.target.checked })} className="w-3 h-3 rounded accent-amber-500" />
								Midpoint Snapping
							</label>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
