"use client";

/**
 * WaterPanel — UI for Stylized Water 2 module
 *
 * 6 tabs: Color, Waves, Foam, Underwater, Lighting, Presets
 * Sends config updates to iframe via postMessage bridge.
 */

import {
	Droplets,
	Palette,
	Waves,
	Wind,
	Sun,
	Sparkles,
	RotateCcw,
	X,
	Plus,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSettings } from "../lib/game-editor-context";

interface WaterConfig {
	waterLevel?: number;
	scale?: number;
	resolution?: number;
	followCamera?: boolean;
	visible?: boolean;
	shallowColor?: { r: number; g: number; b: number; a: number };
	deepColor?: { r: number; g: number; b: number; a: number };
	horizonColor?: { r: number; g: number; b: number; a: number };
	horizonDistance?: number;
	depthVertical?: number;
	depthHorizontal?: number;
	edgeFade?: number;
	waveTint?: number;
	waveHeight?: number;
	waveSpeed?: number;
	waveSteepness?: number;
	waveCount?: number;
	waveDistance?: number;
	normalMapIndex?: number;
	normalStrength?: number;
	foamEnabled?: boolean;
	foamColor?: { r: number; g: number; b: number; a: number };
	foamWaveAmount?: number;
	foamBaseAmount?: number;
	foamClipping?: number;
	foamTextureIndex?: number;
	intersectionEnabled?: boolean;
	intersectionColor?: { r: number; g: number; b: number; a: number };
	intersectionLength?: number;
	intersectionStyle?: number;
	causticsEnabled?: boolean;
	causticsBrightness?: number;
	causticsChromance?: number;
	causticsTiling?: number;
	causticsSpeed?: number;
	colorAbsorption?: number;
	roughness?: number;
	metalness?: number;
	envMapIntensity?: number;
	sunReflectionSize?: number;
	sunReflectionStrength?: number;
	translucencyStrength?: number;
	translucencyExp?: number;
	sparkleIntensity?: number;
	sparkleSize?: number;
	refractionEnabled?: boolean;
	refractionStrength?: number;
	refractionThickness?: number;
	riverMode?: boolean;
	riverDirection?: number;
	riverSpeed?: number;
	buoyancyEnabled?: boolean;
}

interface WaterPanelProps {
	sendToIframe: (msg: Record<string, unknown>) => void;
	onClose: () => void;
	settings: GameSettings;
	onChange: (config: WaterConfig) => void;
	onSave: (config: WaterConfig) => void;
}

type WaterTab = "color" | "waves" | "foam" | "under" | "lighting" | "presets";

const DEFAULTS: WaterConfig = {
	waterLevel: 0,
	scale: 200,
	resolution: 0.5,
	followCamera: true,
	visible: true,
	shallowColor: { r: 0.4, g: 0.8, b: 0.9, a: 0.8 },
	deepColor: { r: 0.05, g: 0.15, b: 0.4, a: 0.95 },
	horizonColor: { r: 0.6, g: 0.8, b: 1.0, a: 0.5 },
	horizonDistance: 3.0,
	depthVertical: 1.0,
	depthHorizontal: 1.0,
	edgeFade: 1.0,
	waveTint: 0.1,
	waveHeight: 0.5,
	waveSpeed: 1.0,
	waveSteepness: 0.5,
	waveCount: 2,
	waveDistance: 0.5,
	normalMapIndex: 0,
	normalStrength: 0.5,
	foamEnabled: true,
	foamColor: { r: 1, g: 1, b: 1, a: 0.8 },
	foamWaveAmount: 0.3,
	foamBaseAmount: 0,
	foamClipping: 0,
	foamTextureIndex: 0,
	intersectionEnabled: true,
	intersectionColor: { r: 1, g: 1, b: 1, a: 1 },
	intersectionLength: 2,
	intersectionStyle: 1,
	sunReflectionSize: 0.5,
	sunReflectionStrength: 1.0,
	translucencyStrength: 0.5,
	translucencyExp: 6.0,
	buoyancyEnabled: true,
};

const PRESETS = [
	{ id: "ocean", label: "Ocean", icon: "🌊" },
	{ id: "clear-pool", label: "Clear Pool", icon: "💧" },
	{ id: "river", label: "River", icon: "🏞" },
	{ id: "cartoon", label: "Cartoon", icon: "🎨" },
	{ id: "swamp", label: "Swamp", icon: "🌿" },
	{ id: "frozen", label: "Frozen", icon: "❄" },
	{ id: "lava", label: "Lava", icon: "🌋" },
	{ id: "realistic", label: "Realistic", icon: "🏖" },
	{ id: "murky", label: "Murky", icon: "🌑" },
	{ id: "low-poly", label: "Low-Poly", icon: "🔷" },
] as const;

const NORMAL_MAPS = ["Smooth Waves", "Rough Waves", "Sharp Waves", "Stream Waves"];
const NORMAL_MAP_FILES = ["SmoothWaves", "RoughWaves", "SharpWaves", "StreamWaves"];
const FOAM_TEXTURES = ["Foam 1", "Foam 2", "Foam Sea"];
const FOAM_TEX_FILES = ["Foam1", "Foam2", "FoamSea"];
const INTERSECTION_STYLES = ["Sharp", "Smooth", "Ripple"];
const TEX_THUMB_BASE = "/api/app-builder/media-stock-3d/water-textures/";

function colorToHex(c: { r: number; g: number; b: number }): string {
	const r = Math.round(c.r * 255).toString(16).padStart(2, "0");
	const g = Math.round(c.g * 255).toString(16).padStart(2, "0");
	const b = Math.round(c.b * 255).toString(16).padStart(2, "0");
	return `#${r}${g}${b}`;
}

function hexToColor(hex: string): { r: number; g: number; b: number } {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	return { r, g, b };
}

interface WaterBodyInfo {
	id: string;
	name: string;
	followCamera?: boolean;
	scale?: number;
	waterLevel?: number;
}

export function WaterPanel({ sendToIframe, onClose, settings, onChange, onSave }: WaterPanelProps) {
	const [activeTab, setActiveTab] = useState<WaterTab>("color");

	// Multi-body state
	const [bodies, setBodies] = useState<WaterBodyInfo[]>([]);
	const [activeBodyId, setActiveBodyId] = useState<string>("");

	const saved = (settings as Record<string, unknown>).stylizedWater as WaterConfig | undefined;
	const [config, setConfig] = useState<WaterConfig>(() => ({ ...DEFAULTS, ...saved }));

	const dirtyRef = useRef(false);
	const configRef = useRef(config);
	configRef.current = config;
	const latestRef = useRef(config);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Listen for body-list and body-config messages from iframe
	useEffect(() => {
		const handler = (ev: MessageEvent) => {
			if (!ev.data?.type) return;
			if (ev.data.type === "stylized-water-body-list") {
				setBodies(ev.data.bodies || []);
				if (ev.data.activeId) setActiveBodyId(ev.data.activeId);
			} else if (ev.data.type === "stylized-water-body-config") {
				const incoming = ev.data.config || {};
				const merged = { ...DEFAULTS, ...incoming };
				setConfig(merged);
				configRef.current = merged;
				latestRef.current = merged;
				if (ev.data.name) {
					setBodies((prev) => prev.map((b) =>
						b.id === ev.data.bodyId ? { ...b, name: ev.data.name } : b
					));
				}
			}
		};
		window.addEventListener("message", handler);
		// Request initial body list
		sendToIframe({ type: "stylized-water-get-body-list" });
		return () => window.removeEventListener("message", handler);
	}, [sendToIframe]);

	const sendConfig = useCallback(
		(patch: Partial<WaterConfig>) => {
			const merged = { ...configRef.current, ...patch };
			setConfig(merged);
			configRef.current = merged;
			latestRef.current = merged;
			dirtyRef.current = true;

			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				sendToIframe({ type: "stylized-water-update-config", config: merged, bodyId: activeBodyId });
				onChange(merged);
			}, 80);
		},
		[sendToIframe, onChange, activeBodyId],
	);

	const applyPreset = useCallback(
		(presetId: string) => {
			sendToIframe({ type: "stylized-water-set-preset", preset: presetId, bodyId: activeBodyId });
			dirtyRef.current = true;
		},
		[sendToIframe, activeBodyId],
	);

	const resetDefaults = useCallback(() => {
		setConfig({ ...DEFAULTS });
		configRef.current = { ...DEFAULTS };
		latestRef.current = { ...DEFAULTS };
		dirtyRef.current = true;
		sendToIframe({ type: "stylized-water-update-config", config: DEFAULTS, bodyId: activeBodyId });
		onChange(DEFAULTS);
	}, [sendToIframe, onChange, activeBodyId]);

	const addBody = useCallback(() => {
		sendToIframe({ type: "stylized-water-add-body", config: { followCamera: false, scale: 50 } });
	}, [sendToIframe]);

	const removeBody = useCallback(() => {
		if (bodies.length <= 1) return;
		sendToIframe({ type: "stylized-water-remove-body", bodyId: activeBodyId });
	}, [sendToIframe, activeBodyId, bodies.length]);

	const selectBody = useCallback((id: string) => {
		setActiveBodyId(id);
		sendToIframe({ type: "stylized-water-select-body", bodyId: id });
		sendToIframe({ type: "stylized-water-get-body-config", bodyId: id });
	}, [sendToIframe]);

	const renameBody = useCallback((name: string) => {
		sendToIframe({ type: "stylized-water-rename-body", bodyId: activeBodyId, name });
		setBodies((prev) => prev.map((b) => b.id === activeBodyId ? { ...b, name } : b));
	}, [sendToIframe, activeBodyId]);

	const tabs: { id: WaterTab; label: string; icon: typeof Sun }[] = [
		{ id: "color", label: "Color", icon: Palette },
		{ id: "waves", label: "Waves", icon: Waves },
		{ id: "foam", label: "Foam", icon: Droplets },
		{ id: "under", label: "Under", icon: Wind },
		{ id: "lighting", label: "Light", icon: Sun },
		{ id: "presets", label: "Presets", icon: Sparkles },
	];

	// Helper for slider rows
	const Slider = ({ label, value, min, max, step, onChange: onSliderChange }: {
		label: string; value: number; min: number; max: number; step: number;
		onChange: (v: number) => void;
	}) => (
		<div className="flex items-center gap-2">
			<span className="text-[10px] text-white/50 w-[72px] shrink-0 truncate">{label}</span>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onSliderChange(parseFloat(e.target.value))}
				className="flex-1 h-1 accent-cyan-400"
			/>
			<span className="text-[10px] text-white/40 w-8 text-right tabular-nums">
				{value < 10 ? value.toFixed(step < 0.1 ? 2 : 1) : Math.round(value)}
			</span>
		</div>
	);

	// Color picker row
	const ColorRow = ({ label, color, alpha, onColorChange, onAlphaChange }: {
		label: string;
		color: { r: number; g: number; b: number };
		alpha?: number;
		onColorChange: (c: { r: number; g: number; b: number }) => void;
		onAlphaChange?: (a: number) => void;
	}) => (
		<div className="flex items-center gap-2">
			<span className="text-[10px] text-white/50 w-[72px] shrink-0 truncate">{label}</span>
			<input
				type="color"
				value={colorToHex(color)}
				onChange={(e) => onColorChange(hexToColor(e.target.value))}
				className="w-6 h-5 rounded border border-white/10 cursor-pointer bg-transparent"
			/>
			{alpha !== undefined && onAlphaChange && (
				<input
					type="range"
					min={0}
					max={1}
					step={0.05}
					value={alpha}
					onChange={(e) => onAlphaChange(parseFloat(e.target.value))}
					className="flex-1 h-1 accent-cyan-400"
				/>
			)}
		</div>
	);

	return (
		<div className="absolute top-0 right-0 bottom-0 w-[260px] bg-[#0d0d0f]/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-30 select-none">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.08]">
				<div className="flex items-center gap-2">
					<Waves className="w-4 h-4 text-cyan-400" />
					<span className="text-xs font-semibold text-white/90">Stylized Water 2</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={resetDefaults}
						className="p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
						title="Reset to defaults"
					>
						<RotateCcw className="w-3.5 h-3.5" />
					</button>
					<button
						type="button"
						onClick={() => {
							if (dirtyRef.current) {
								const saveConfig = { ...latestRef.current } as WaterConfig & { bodyId?: string };
								if (activeBodyId) saveConfig.bodyId = activeBodyId;
								onSave(saveConfig);
							}
							onClose();
						}}
						className="p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>

			{/* Body Selector */}
			{bodies.length > 0 && (
				<div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.08]">
					<select
						value={activeBodyId}
						onChange={(e) => selectBody(e.target.value)}
						className="flex-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/70 px-1.5 py-1 truncate"
					>
						{bodies.map((b) => (
							<option key={b.id} value={b.id}>{b.name}</option>
						))}
					</select>
					<button
						type="button"
						onClick={addBody}
						disabled={bodies.length >= 4}
						className="p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-cyan-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						title="Add water body"
					>
						<Plus className="w-3.5 h-3.5" />
					</button>
					<button
						type="button"
						onClick={removeBody}
						disabled={bodies.length <= 1}
						className="p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-red-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						title="Remove water body"
					>
						<Trash2 className="w-3.5 h-3.5" />
					</button>
				</div>
			)}

			{/* Tabs */}
			<div className="grid grid-cols-6 gap-0.5 border-b border-white/[0.06] px-1.5 py-1.5">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`flex items-center justify-center gap-0.5 py-1.5 text-[9px] rounded-md transition-all ${
								isActive
									? "bg-cyan-500/[0.15] text-cyan-300 ring-1 ring-cyan-500/30"
									: "text-white/35 hover:text-white/55 hover:bg-white/[0.05]"
							}`}
						>
							<Icon className="w-3 h-3 shrink-0" />
							{tab.label}
						</button>
					);
				})}
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
				{/* ── Color Tab ── */}
				{activeTab === "color" && (
					<>
						{bodies.length > 0 && (
							<div className="flex items-center gap-2 mb-2">
								<span className="text-[10px] text-white/50 w-[72px] shrink-0">Name</span>
								<input
									type="text"
									value={bodies.find((b) => b.id === activeBodyId)?.name || ""}
									onChange={(e) => renameBody(e.target.value)}
									className="flex-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/70 px-1.5 py-0.5"
								/>
							</div>
						)}
						<div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Water Colors</div>
						<ColorRow
							label="Shallow"
							color={config.shallowColor ?? DEFAULTS.shallowColor!}
							alpha={config.shallowColor?.a ?? 0.8}
							onColorChange={(c) => sendConfig({ shallowColor: { ...c, a: config.shallowColor?.a ?? 0.8 } })}
							onAlphaChange={(a) => sendConfig({ shallowColor: { ...(config.shallowColor ?? DEFAULTS.shallowColor!), a } })}
						/>
						<ColorRow
							label="Deep"
							color={config.deepColor ?? DEFAULTS.deepColor!}
							alpha={config.deepColor?.a ?? 0.95}
							onColorChange={(c) => sendConfig({ deepColor: { ...c, a: config.deepColor?.a ?? 0.95 } })}
							onAlphaChange={(a) => sendConfig({ deepColor: { ...(config.deepColor ?? DEFAULTS.deepColor!), a } })}
						/>
						<ColorRow
							label="Horizon"
							color={config.horizonColor ?? DEFAULTS.horizonColor!}
							alpha={config.horizonColor?.a ?? 0.5}
							onColorChange={(c) => sendConfig({ horizonColor: { ...c, a: config.horizonColor?.a ?? 0.5 } })}
							onAlphaChange={(a) => sendConfig({ horizonColor: { ...(config.horizonColor ?? DEFAULTS.horizonColor!), a } })}
						/>

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-3 mb-1">Depth</div>
						<Slider label="Vertical" value={config.depthVertical ?? 1} min={0.01} max={10} step={0.1} onChange={(v) => sendConfig({ depthVertical: v })} />
						<Slider label="Horizontal" value={config.depthHorizontal ?? 1} min={0.01} max={10} step={0.1} onChange={(v) => sendConfig({ depthHorizontal: v })} />
						<Slider label="Horizon Dist" value={config.horizonDistance ?? 3} min={0.1} max={10} step={0.1} onChange={(v) => sendConfig({ horizonDistance: v })} />
						<Slider label="Edge Fade" value={config.edgeFade ?? 1} min={0} max={5} step={0.1} onChange={(v) => sendConfig({ edgeFade: v })} />
						<Slider label="Wave Tint" value={config.waveTint ?? 0.1} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ waveTint: v })} />

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-3 mb-1">General</div>
						<Slider label="Water Level" value={config.waterLevel ?? 0} min={-50} max={50} step={0.5} onChange={(v) => sendConfig({ waterLevel: v })} />
						<Slider label="Scale" value={config.scale ?? 200} min={10} max={2000} step={10} onChange={(v) => sendConfig({ scale: v })} />
						<Slider label="Resolution" value={config.resolution ?? 0.5} min={0.1} max={3} step={0.1} onChange={(v) => sendConfig({ resolution: v })} />

						<div className="flex items-center gap-2 mt-1">
							<span className="text-[10px] text-white/50 w-[72px]">Follow Cam</span>
							<button
								type="button"
								onClick={() => sendConfig({ followCamera: !config.followCamera })}
								className={`w-8 h-4 rounded-full transition-colors ${config.followCamera ? "bg-cyan-500/60" : "bg-white/10"}`}
							>
								<div className={`w-3 h-3 rounded-full bg-white transition-transform ${config.followCamera ? "translate-x-4" : "translate-x-0.5"}`} />
							</button>
						</div>
					</>
				)}

				{/* ── Waves Tab ── */}
				{activeTab === "waves" && (
					<>
						<div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Gerstner Waves</div>
						<Slider label="Height" value={config.waveHeight ?? 0.5} min={0} max={5} step={0.05} onChange={(v) => sendConfig({ waveHeight: v })} />
						<Slider label="Speed" value={config.waveSpeed ?? 1} min={0} max={5} step={0.05} onChange={(v) => sendConfig({ waveSpeed: v })} />
						<Slider label="Steepness" value={config.waveSteepness ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ waveSteepness: v })} />
						<Slider label="Wave Count" value={config.waveCount ?? 2} min={1} max={5} step={1} onChange={(v) => sendConfig({ waveCount: v })} />
						<Slider label="Distance" value={config.waveDistance ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ waveDistance: v })} />

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-3 mb-1">Normal Map</div>
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-white/50 w-[72px]">Map</span>
							<img
								src={`${TEX_THUMB_BASE}${NORMAL_MAP_FILES[config.normalMapIndex ?? 0]}-thumb.webp`}
								className="w-6 h-6 rounded border border-white/10 object-cover"
								alt=""
							/>
							<select
								value={config.normalMapIndex ?? 0}
								onChange={(e) => sendConfig({ normalMapIndex: parseInt(e.target.value) })}
								className="flex-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/70 px-1.5 py-0.5"
							>
								{NORMAL_MAPS.map((name, i) => (
									<option key={name} value={i}>{name}</option>
								))}
							</select>
						</div>
						<Slider label="Strength" value={config.normalStrength ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ normalStrength: v })} />

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-3 mb-1">River Mode</div>
						<div className="flex items-center gap-2 mb-1">
							<span className="text-[10px] text-white/50 w-[72px]">Enabled</span>
							<button
								type="button"
								onClick={() => sendConfig({ riverMode: !config.riverMode })}
								className={`w-8 h-4 rounded-full transition-colors ${config.riverMode ? "bg-cyan-500/60" : "bg-white/10"}`}
							>
								<div className={`w-3 h-3 rounded-full bg-white transition-transform ${config.riverMode ? "translate-x-4" : "translate-x-0.5"}`} />
							</button>
						</div>
						<Slider label="Direction" value={config.riverDirection ?? 0} min={0} max={360} step={5} onChange={(v) => sendConfig({ riverDirection: v })} />
						<Slider label="Flow Speed" value={config.riverSpeed ?? 1} min={0.1} max={5} step={0.1} onChange={(v) => sendConfig({ riverSpeed: v })} />

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-3 mb-1">Buoyancy</div>
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-white/50 w-[72px]">Enabled</span>
							<button
								type="button"
								onClick={() => sendConfig({ buoyancyEnabled: !config.buoyancyEnabled })}
								className={`w-8 h-4 rounded-full transition-colors ${config.buoyancyEnabled ? "bg-cyan-500/60" : "bg-white/10"}`}
							>
								<div className={`w-3 h-3 rounded-full bg-white transition-transform ${config.buoyancyEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
							</button>
						</div>
					</>
				)}

				{/* ── Foam Tab ── */}
				{activeTab === "foam" && (
					<>
						<div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Surface Foam</div>
						<div className="flex items-center gap-2 mb-1">
							<span className="text-[10px] text-white/50 w-[72px]">Enabled</span>
							<button
								type="button"
								onClick={() => sendConfig({ foamEnabled: !config.foamEnabled })}
								className={`w-8 h-4 rounded-full transition-colors ${config.foamEnabled ? "bg-cyan-500/60" : "bg-white/10"}`}
							>
								<div className={`w-3 h-3 rounded-full bg-white transition-transform ${config.foamEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
							</button>
						</div>
						<ColorRow
							label="Foam Color"
							color={config.foamColor ?? DEFAULTS.foamColor!}
							alpha={config.foamColor?.a ?? 0.8}
							onColorChange={(c) => sendConfig({ foamColor: { ...c, a: config.foamColor?.a ?? 0.8 } })}
							onAlphaChange={(a) => sendConfig({ foamColor: { ...(config.foamColor ?? DEFAULTS.foamColor!), a } })}
						/>
						<Slider label="Wave Amount" value={config.foamWaveAmount ?? 0.3} min={0} max={2} step={0.01} onChange={(v) => sendConfig({ foamWaveAmount: v })} />
						<Slider label="Base Amount" value={config.foamBaseAmount ?? 0} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ foamBaseAmount: v })} />
						<Slider label="Clipping" value={config.foamClipping ?? 0} min={0} max={0.999} step={0.01} onChange={(v) => sendConfig({ foamClipping: v })} />

						<div className="flex items-center gap-2 mt-1">
							<span className="text-[10px] text-white/50 w-[72px]">Texture</span>
							<img
								src={`${TEX_THUMB_BASE}${FOAM_TEX_FILES[config.foamTextureIndex ?? 0]}-thumb.webp`}
								className="w-6 h-6 rounded border border-white/10 object-cover"
								alt=""
							/>
							<select
								value={config.foamTextureIndex ?? 0}
								onChange={(e) => sendConfig({ foamTextureIndex: parseInt(e.target.value) })}
								className="flex-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/70 px-1.5 py-0.5"
							>
								{FOAM_TEXTURES.map((name, i) => (
									<option key={name} value={i}>{name}</option>
								))}
							</select>
						</div>

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-3 mb-1">Intersection (Shore)</div>
						<div className="flex items-center gap-2 mb-1">
							<span className="text-[10px] text-white/50 w-[72px]">Enabled</span>
							<button
								type="button"
								onClick={() => sendConfig({ intersectionEnabled: !config.intersectionEnabled })}
								className={`w-8 h-4 rounded-full transition-colors ${config.intersectionEnabled ? "bg-cyan-500/60" : "bg-white/10"}`}
							>
								<div className={`w-3 h-3 rounded-full bg-white transition-transform ${config.intersectionEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
							</button>
						</div>
						<ColorRow
							label="Shore Color"
							color={config.intersectionColor ?? DEFAULTS.intersectionColor!}
							alpha={config.intersectionColor?.a ?? 1}
							onColorChange={(c) => sendConfig({ intersectionColor: { ...c, a: config.intersectionColor?.a ?? 1 } })}
							onAlphaChange={(a) => sendConfig({ intersectionColor: { ...(config.intersectionColor ?? DEFAULTS.intersectionColor!), a } })}
						/>
						<Slider label="Length" value={config.intersectionLength ?? 2} min={0.01} max={5} step={0.1} onChange={(v) => sendConfig({ intersectionLength: v })} />
						<div className="flex items-center gap-2 mt-1">
							<span className="text-[10px] text-white/50 w-[72px]">Style</span>
							<select
								value={config.intersectionStyle ?? 1}
								onChange={(e) => sendConfig({ intersectionStyle: parseInt(e.target.value) })}
								className="flex-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/70 px-1.5 py-0.5"
							>
								{INTERSECTION_STYLES.map((name, i) => (
									<option key={name} value={i}>{name}</option>
								))}
							</select>
						</div>
					</>
				)}

				{/* ── Underwater Tab ── */}
				{activeTab === "under" && (
					<>
						<div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Caustics</div>
						<div className="flex items-center gap-2 mb-1">
							<span className="text-[10px] text-white/50 w-[72px]">Enabled</span>
							<button
								type="button"
								onClick={() => sendConfig({ causticsEnabled: !config.causticsEnabled })}
								className={`w-8 h-4 rounded-full transition-colors ${config.causticsEnabled ? "bg-cyan-500/60" : "bg-white/10"}`}
							>
								<div className={`w-3 h-3 rounded-full bg-white transition-transform ${config.causticsEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
							</button>
						</div>
						<Slider label="Brightness" value={config.causticsBrightness ?? 1} min={0} max={3} step={0.05} onChange={(v) => sendConfig({ causticsBrightness: v })} />
						<Slider label="Chromance" value={config.causticsChromance ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ causticsChromance: v })} />
						<Slider label="Tiling" value={config.causticsTiling ?? 0.5} min={0.01} max={5} step={0.05} onChange={(v) => sendConfig({ causticsTiling: v })} />
						<Slider label="Speed" value={config.causticsSpeed ?? 0.5} min={0} max={2} step={0.05} onChange={(v) => sendConfig({ causticsSpeed: v })} />

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-3 mb-1">Refraction</div>
						<div className="flex items-center gap-2 mb-1">
							<span className="text-[10px] text-white/50 w-[72px]">Enabled</span>
							<button
								type="button"
								onClick={() => sendConfig({ refractionEnabled: !config.refractionEnabled })}
								className={`w-8 h-4 rounded-full transition-colors ${config.refractionEnabled ? "bg-cyan-500/60" : "bg-white/10"}`}
							>
								<div className={`w-3 h-3 rounded-full bg-white transition-transform ${config.refractionEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
							</button>
						</div>
						<Slider label="Strength" value={config.refractionStrength ?? 0.3} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ refractionStrength: v })} />
						<Slider label="Thickness" value={config.refractionThickness ?? 2} min={0.1} max={10} step={0.1} onChange={(v) => sendConfig({ refractionThickness: v })} />

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-3 mb-1">Absorption</div>
						<Slider label="Color Abs." value={config.colorAbsorption ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ colorAbsorption: v })} />
					</>
				)}

				{/* ── Lighting Tab ── */}
				{activeTab === "lighting" && (
					<>
						<div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">PBR Material</div>
						<Slider label="Roughness" value={config.roughness ?? 0.15} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ roughness: v })} />
						<Slider label="Metalness" value={config.metalness ?? 0.3} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ metalness: v })} />
						<Slider label="Env Reflect" value={config.envMapIntensity ?? 0.8} min={0} max={2} step={0.05} onChange={(v) => sendConfig({ envMapIntensity: v })} />

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-3 mb-1">Translucency</div>
						<Slider label="Strength" value={config.translucencyStrength ?? 0.5} min={0} max={2} step={0.05} onChange={(v) => sendConfig({ translucencyStrength: v })} />
						<Slider label="Exponent" value={config.translucencyExp ?? 6} min={1} max={20} step={0.5} onChange={(v) => sendConfig({ translucencyExp: v })} />

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-3 mb-1">Sparkles</div>
						<Slider label="Intensity" value={config.sparkleIntensity ?? 0} min={0} max={1} step={0.01} onChange={(v) => sendConfig({ sparkleIntensity: v })} />
						<Slider label="Size" value={config.sparkleSize ?? 0.9} min={0.5} max={0.999} step={0.01} onChange={(v) => sendConfig({ sparkleSize: v })} />
					</>
				)}

				{/* ── Presets Tab ── */}
				{activeTab === "presets" && (
					<>
						<div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Material Presets</div>
						<div className="grid grid-cols-2 gap-1.5">
							{PRESETS.map((preset) => (
								<button
									key={preset.id}
									type="button"
									onClick={() => applyPreset(preset.id)}
									className="flex items-center gap-1.5 px-2 py-2 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-cyan-500/30 transition-all text-left"
								>
									<span className="text-sm">{preset.icon}</span>
									<span className="text-[10px] text-white/70">{preset.label}</span>
								</button>
							))}
						</div>

						<div className="text-[10px] text-white/30 uppercase tracking-wider mt-4 mb-2">Actions</div>
						<button
							type="button"
							onClick={resetDefaults}
							className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-md bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/30 transition-all"
						>
							<RotateCcw className="w-3 h-3 text-white/50" />
							<span className="text-[10px] text-white/60">Reset to Defaults</span>
						</button>
					</>
				)}
			</div>
		</div>
	);
}
