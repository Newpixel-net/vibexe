"use client";

/**
 * SkyWeatherPanel — UI for the Sky & Weather module
 *
 * Controls: Time of day, day/night cycle, sky appearance, lighting, fog.
 * Communicates with the sandpack iframe via postMessage bridge.
 */

import {
	Clock,
	Cloud,
	CloudSun,
	Droplets,
	Eye,
	Lightbulb,
	Moon,
	CloudFog,
	RotateCcw,
	Sparkles,
	Sun,
	X,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSettings } from "../lib/game-editor-context";

interface SkyWeatherConfig {
	time?: {
		solarTime?: number;
		cycleLengthMinutes?: number;
		autoAdvance?: boolean;
		latitude?: number;
	};
	sky?: {
		sunDiskSize?: number;
		moonDiskSize?: number;
		mieCoefficient?: number;
		mieDirectionalG?: number;
		starIntensity?: number;
		exposure?: number;
	};
	lighting?: {
		autoSunLight?: boolean;
		autoAmbient?: boolean;
		sunIntensity?: number;
		ambientIntensity?: number;
		shadowsEnabled?: boolean;
	};
	fog?: {
		enabled?: boolean;
		autoColor?: boolean;
		density?: number;
		heightFalloff?: number;
	};
	clouds?: {
		coverage?: number;
		density?: number;
		speed?: number;
		scale?: number;
		brightness?: number;
	};
	precipitation?: {
		type?: string;
		intensity?: number;
		windDirection?: number;
		windStrength?: number;
	};
	lightning?: {
		enabled?: boolean;
		frequency?: number;
	};
	effects?: {
		godRays?: number;
		aurora?: number;
		rainbow?: number;
		ambientAudio?: boolean;
		audioVolume?: number;
	};
}

interface SkyWeatherPanelProps {
	sendToIframe: (msg: Record<string, unknown>) => void;
	onClose: () => void;
	settings: GameSettings;
	/** Live preview — updates React state + sends postMessage (no file write, no refresh) */
	onChange: (config: SkyWeatherConfig) => void;
	/** Persist to DB — only called on explicit save or panel close */
	onSave: (config: SkyWeatherConfig) => void;
}

type SkyTab = "time" | "sky" | "clouds" | "lighting" | "fog" | "fx";

const WEATHER_PRESETS = [
	{ label: "Clear", icon: "☀️", clouds: { coverage: 0 }, fog: { enabled: false }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false } },
	{ label: "Fair", icon: "🌤", clouds: { coverage: 0.2, brightness: 1.0 }, fog: { enabled: false }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false } },
	{ label: "Partly Cloudy", icon: "⛅", clouds: { coverage: 0.5, brightness: 1.0 }, fog: { enabled: false }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false } },
	{ label: "Cloudy", icon: "☁️", clouds: { coverage: 0.8, brightness: 0.9 }, fog: { enabled: true, density: 0.002 }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false } },
	{ label: "Overcast", icon: "🌥", clouds: { coverage: 1.0, brightness: 0.65 }, fog: { enabled: true, density: 0.004 }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false } },
	{ label: "Rainy", icon: "🌧", clouds: { coverage: 0.85, brightness: 0.5 }, fog: { enabled: true, density: 0.004, autoColor: true }, precipitation: { type: "rain", intensity: 0.6 }, lightning: { enabled: false } },
	{ label: "Snowy", icon: "🌨", clouds: { coverage: 0.9, brightness: 0.7 }, fog: { enabled: true, density: 0.006, autoColor: true }, precipitation: { type: "snow", intensity: 0.7 }, lightning: { enabled: false } },
	{ label: "Foggy", icon: "🌫", clouds: { coverage: 0.6, brightness: 0.6 }, fog: { enabled: true, density: 0.02, autoColor: true }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false } },
	{ label: "Stormy", icon: "⛈", clouds: { coverage: 0.95, brightness: 0.35, density: 1.0 }, fog: { enabled: true, density: 0.008, autoColor: true }, precipitation: { type: "rain", intensity: 0.9, windStrength: 0.7 }, lightning: { enabled: true, frequency: 0.15 } },
] as const;

const TIME_PRESETS = [
	{ label: "Dawn", time: 0.25, icon: "🌅" },
	{ label: "Morning", time: 0.35, icon: "🌤" },
	{ label: "Noon", time: 0.5, icon: "☀️" },
	{ label: "Afternoon", time: 0.65, icon: "🌤" },
	{ label: "Dusk", time: 0.75, icon: "🌇" },
	{ label: "Night", time: 0.0, icon: "🌙" },
];

function getTimeLabel(t: number): string {
	const hours = Math.floor(t * 24);
	const mins = Math.floor((t * 24 - hours) * 60);
	const h12 = hours % 12 || 12;
	const ampm = hours < 12 ? "AM" : "PM";
	return `${h12}:${mins.toString().padStart(2, "0")} ${ampm}`;
}

export function SkyWeatherPanel({ sendToIframe, onClose, settings, onChange, onSave }: SkyWeatherPanelProps) {
	const [activeTab, setActiveTab] = useState<SkyTab>("time");

	// Extract existing sky config from game settings
	const skyWeather = settings.skyWeather;
	const [config, setConfig] = useState<SkyWeatherConfig>(() => ({
		time: { solarTime: 0.45, cycleLengthMinutes: 10, autoAdvance: false, latitude: 45, ...skyWeather?.time },
		sky: { sunDiskSize: 0.028, moonDiskSize: 0.022, mieCoefficient: 0.005, mieDirectionalG: 0.80, starIntensity: 1.0, exposure: 2.0, ...skyWeather?.sky },
		lighting: { autoSunLight: true, autoAmbient: true, sunIntensity: 1.5, ambientIntensity: 0.4, shadowsEnabled: true, ...skyWeather?.lighting },
		fog: { enabled: false, autoColor: true, density: 0.003, ...skyWeather?.fog },
		clouds: { coverage: 0, density: 0.85, speed: 1.0, scale: 3.0, brightness: 1.0, ...skyWeather?.clouds },
		precipitation: { type: "none", intensity: 0, windDirection: 0, windStrength: 0.3, ...skyWeather?.precipitation },
		lightning: { enabled: false, frequency: 0.1, ...skyWeather?.lightning },
		effects: { godRays: 0, aurora: 0, rainbow: 0, ambientAudio: false, audioVolume: 0.5, ...skyWeather?.effects },
	}));

	// Track whether user made changes (for auto-save on close)
	const dirtyRef = useRef(false);
	const latestConfigRef = useRef(config);

	const sendConfig = useCallback((patch: Partial<SkyWeatherConfig>) => {
		const merged = {
			time: { ...config.time, ...patch.time },
			sky: { ...config.sky, ...patch.sky },
			lighting: { ...config.lighting, ...patch.lighting },
			fog: { ...config.fog, ...patch.fog },
			clouds: { ...config.clouds, ...patch.clouds },
			precipitation: { ...config.precipitation, ...patch.precipitation },
			lightning: { ...config.lightning, ...patch.lightning },
			effects: { ...config.effects, ...patch.effects },
		};
		setConfig(merged);
		latestConfigRef.current = merged;
		dirtyRef.current = true;
		// Live preview — postMessage only, no file write, no refresh
		sendToIframe({ type: "sky-weather-update-config", config: merged });
		onChange(merged);
	}, [config, sendToIframe, onChange]);

	const setTime = useCallback((t: number) => {
		sendToIframe({ type: "sky-weather-set-time", solarTime: t });
		sendConfig({ time: { ...config.time, solarTime: t } });
	}, [config.time, sendToIframe, sendConfig]);

	const tabs: { id: SkyTab; label: string; icon: typeof Sun }[] = [
		{ id: "time", label: "Time", icon: Clock },
		{ id: "sky", label: "Sky", icon: CloudSun },
		{ id: "clouds", label: "Clouds", icon: Cloud },
		{ id: "lighting", label: "Light", icon: Lightbulb },
		{ id: "fog", label: "Fog", icon: CloudFog },
		{ id: "fx", label: "FX", icon: Sparkles },
	];

	return (
		<div className="absolute top-0 right-0 bottom-0 w-[260px] bg-[#0d0d0f]/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-30 select-none">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.08]">
				<div className="flex items-center gap-2">
					<CloudSun className="w-4 h-4 text-amber-400" />
					<span className="text-xs font-semibold text-white/90">Sky & Weather</span>
				</div>
				<button type="button" onClick={() => { if (dirtyRef.current) onSave(latestConfigRef.current); onClose(); }} className="p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors">
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			{/* Tabs */}
			<div className="flex border-b border-white/[0.06] px-1 pt-1">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] rounded-t-lg transition-all ${
								activeTab === tab.id
									? "bg-white/[0.06] text-amber-300 border-b-2 border-amber-400"
									: "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
							}`}
						>
							<Icon className="w-3 h-3" />
							{tab.label}
						</button>
					);
				})}
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
				{activeTab === "time" && (
					<>
						{/* Solar Time Slider */}
						<div>
							<div className="flex items-center justify-between mb-1.5">
								<label className="text-[10px] text-white/40 uppercase tracking-wider">Time of Day</label>
								<span className="text-[11px] text-amber-300 font-mono">{getTimeLabel(config.time?.solarTime ?? 0.45)}</span>
							</div>
							<div className="relative">
								<div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full overflow-hidden">
									<div className="w-full h-full" style={{
										background: "linear-gradient(to right, #0a0a2e 0%, #1a0a30 15%, #cc5522 25%, #88bbdd 35%, #55aaee 50%, #88bbdd 65%, #cc5522 75%, #1a0a30 85%, #0a0a2e 100%)"
									}} />
								</div>
								<input
									type="range"
									min="0"
									max="1"
									step="0.005"
									value={config.time?.solarTime ?? 0.45}
									onChange={(e) => setTime(Number.parseFloat(e.target.value))}
									className="w-full relative z-10 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-400 [&::-webkit-slider-thumb]:shadow-lg"
								/>
							</div>
						</div>

						{/* Time Presets */}
						<div>
							<label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Presets</label>
							<div className="grid grid-cols-3 gap-1">
								{TIME_PRESETS.map((preset) => (
									<button
										key={preset.label}
										type="button"
										onClick={() => setTime(preset.time)}
										className={`px-2 py-1.5 text-[10px] rounded-lg transition-all ${
											Math.abs((config.time?.solarTime ?? 0) - preset.time) < 0.02
												? "bg-amber-500/[0.15] text-amber-300 border border-amber-500/[0.25]"
												: "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70"
										}`}
									>
										<span className="block text-sm mb-0.5">{preset.icon}</span>
										{preset.label}
									</button>
								))}
							</div>
						</div>

						{/* Day/Night Cycle */}
						<div className="border-t border-white/[0.06] pt-3">
							<div className="flex items-center justify-between mb-2">
								<label className="text-[10px] text-white/40 uppercase tracking-wider">Day/Night Cycle</label>
								<button
									type="button"
									onClick={() => sendConfig({ time: { ...config.time, autoAdvance: !config.time?.autoAdvance } })}
									className={`w-8 h-4 rounded-full transition-colors relative ${
										config.time?.autoAdvance ? "bg-amber-600" : "bg-zinc-700"
									}`}
								>
									<div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
										config.time?.autoAdvance ? "translate-x-4" : "translate-x-0.5"
									}`} />
								</button>
							</div>
							{config.time?.autoAdvance && (
								<div>
									<div className="flex items-center justify-between mb-1">
										<span className="text-[10px] text-white/40">Cycle Length</span>
										<span className="text-[10px] text-white/60 font-mono">{config.time?.cycleLengthMinutes ?? 10} min</span>
									</div>
									<input
										type="range"
										min="1"
										max="60"
										step="1"
										value={config.time?.cycleLengthMinutes ?? 10}
										onChange={(e) => sendConfig({ time: { ...config.time, cycleLengthMinutes: Number.parseInt(e.target.value) } })}
										className="w-full accent-amber-500"
									/>
								</div>
							)}
						</div>

						{/* Latitude */}
						<div>
							<div className="flex items-center justify-between mb-1">
								<span className="text-[10px] text-white/40">Latitude</span>
								<span className="text-[10px] text-white/60 font-mono">{config.time?.latitude ?? 45}°</span>
							</div>
							<input
								type="range"
								min="-90"
								max="90"
								step="1"
								value={config.time?.latitude ?? 45}
								onChange={(e) => sendConfig({ time: { ...config.time, latitude: Number.parseInt(e.target.value) } })}
								className="w-full accent-amber-500"
							/>
						</div>
					</>
				)}

				{activeTab === "sky" && (
					<>
						<SliderRow
							label="Sun Size"
							value={config.sky?.sunDiskSize ?? 0.028}
							min={0.005} max={0.1} step={0.001}
							format={(v) => v.toFixed(3)}
							onChange={(v) => sendConfig({ sky: { ...config.sky, sunDiskSize: v } })}
						/>
						<SliderRow
							label="Moon Size"
							value={config.sky?.moonDiskSize ?? 0.022}
							min={0.005} max={0.08} step={0.001}
							format={(v) => v.toFixed(3)}
							onChange={(v) => sendConfig({ sky: { ...config.sky, moonDiskSize: v } })}
						/>
						<SliderRow
							label="Mie Scattering"
							value={config.sky?.mieCoefficient ?? 0.005}
							min={0} max={0.05} step={0.001}
							format={(v) => v.toFixed(3)}
							onChange={(v) => sendConfig({ sky: { ...config.sky, mieCoefficient: v } })}
						/>
						<SliderRow
							label="Mie G (Directionality)"
							value={config.sky?.mieDirectionalG ?? 0.80}
							min={0} max={0.99} step={0.01}
							format={(v) => v.toFixed(2)}
							onChange={(v) => sendConfig({ sky: { ...config.sky, mieDirectionalG: v } })}
						/>
						<SliderRow
							label="Star Intensity"
							value={config.sky?.starIntensity ?? 1.0}
							min={0} max={3.0} step={0.1}
							format={(v) => v.toFixed(1)}
							onChange={(v) => sendConfig({ sky: { ...config.sky, starIntensity: v } })}
						/>
						<SliderRow
							label="Exposure"
							value={config.sky?.exposure ?? 2.0}
							min={0.5} max={5.0} step={0.1}
							format={(v) => v.toFixed(1)}
							onChange={(v) => sendConfig({ sky: { ...config.sky, exposure: v } })}
						/>
					</>
				)}

				{activeTab === "clouds" && (
					<>
						{/* Weather Presets */}
						<div>
							<label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Weather Presets</label>
							<div className="grid grid-cols-2 gap-1">
								{WEATHER_PRESETS.map((preset) => (
									<button
										key={preset.label}
										type="button"
										onClick={() => {
											sendConfig({
												clouds: { ...config.clouds, ...preset.clouds },
												fog: { ...config.fog, ...preset.fog },
												precipitation: { ...config.precipitation, ...preset.precipitation },
												lightning: { ...config.lightning, ...preset.lightning },
											});
										}}
										className="px-2 py-1.5 text-[10px] rounded-lg bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-all text-left"
									>
										<span className="text-sm mr-1">{preset.icon}</span>
										{preset.label}
									</button>
								))}
							</div>
						</div>

						<div className="border-t border-white/[0.06] pt-3">
							<SliderRow
								label="Cloud Coverage"
								value={config.clouds?.coverage ?? 0}
								min={0} max={1} step={0.05}
								format={(v) => `${Math.round(v * 100)}%`}
								onChange={(v) => sendConfig({ clouds: { ...config.clouds, coverage: v } })}
							/>
							<SliderRow
								label="Cloud Density"
								value={config.clouds?.density ?? 0.85}
								min={0.1} max={1} step={0.05}
								format={(v) => v.toFixed(2)}
								onChange={(v) => sendConfig({ clouds: { ...config.clouds, density: v } })}
							/>
							<SliderRow
								label="Wind Speed"
								value={config.clouds?.speed ?? 1.0}
								min={0} max={5} step={0.1}
								format={(v) => v.toFixed(1)}
								onChange={(v) => sendConfig({ clouds: { ...config.clouds, speed: v } })}
							/>
							<SliderRow
								label="Cloud Scale"
								value={config.clouds?.scale ?? 3.0}
								min={1} max={8} step={0.5}
								format={(v) => v.toFixed(1)}
								onChange={(v) => sendConfig({ clouds: { ...config.clouds, scale: v } })}
							/>
							<SliderRow
								label="Brightness"
								value={config.clouds?.brightness ?? 1.0}
								min={0.1} max={2} step={0.05}
								format={(v) => v.toFixed(2)}
								onChange={(v) => sendConfig({ clouds: { ...config.clouds, brightness: v } })}
							/>
						</div>

						{/* Precipitation */}
						<div className="border-t border-white/[0.06] pt-3">
							<div className="flex items-center gap-1.5 mb-2">
								<Droplets className="w-3 h-3 text-blue-400" />
								<span className="text-[10px] text-white/50 uppercase tracking-wider">Precipitation</span>
							</div>

							{/* Type selector */}
							<div className="grid grid-cols-3 gap-1 mb-2">
								{(["none", "rain", "snow"] as const).map((pType) => (
									<button
										key={pType}
										type="button"
										onClick={() => sendConfig({ precipitation: { ...config.precipitation, type: pType, intensity: pType === "none" ? 0 : (config.precipitation?.intensity || 0.5) } })}
										className={`px-2 py-1.5 text-[10px] rounded-lg transition-all capitalize ${
											(config.precipitation?.type ?? "none") === pType
												? "bg-blue-500/[0.15] text-blue-300 border border-blue-500/[0.25]"
												: "bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
										}`}
									>
										{pType === "none" ? "Off" : pType === "rain" ? "🌧 Rain" : "🌨 Snow"}
									</button>
								))}
							</div>

							{config.precipitation?.type && config.precipitation.type !== "none" && (
								<>
									<SliderRow
										label="Intensity"
										value={config.precipitation?.intensity ?? 0.5}
										min={0.1} max={1} step={0.05}
										format={(v) => `${Math.round(v * 100)}%`}
										onChange={(v) => sendConfig({ precipitation: { ...config.precipitation, intensity: v } })}
									/>
									<SliderRow
										label="Wind Direction"
										value={config.precipitation?.windDirection ?? 0}
										min={0} max={360} step={5}
										format={(v) => `${Math.round(v)}°`}
										onChange={(v) => sendConfig({ precipitation: { ...config.precipitation, windDirection: v } })}
									/>
									<SliderRow
										label="Wind Strength"
										value={config.precipitation?.windStrength ?? 0.3}
										min={0} max={1} step={0.05}
										format={(v) => v.toFixed(2)}
										onChange={(v) => sendConfig({ precipitation: { ...config.precipitation, windStrength: v } })}
									/>
								</>
							)}
						</div>

						{/* Lightning */}
						<div className="border-t border-white/[0.06] pt-3">
							<div className="flex items-center gap-1.5 mb-2">
								<Zap className="w-3 h-3 text-yellow-400" />
								<span className="text-[10px] text-white/50 uppercase tracking-wider">Lightning</span>
							</div>
							<ToggleRow
								label="Enable Lightning"
								value={config.lightning?.enabled ?? false}
								onChange={(v) => sendConfig({ lightning: { ...config.lightning, enabled: v } })}
							/>
							{config.lightning?.enabled && (
								<SliderRow
									label="Frequency"
									value={config.lightning?.frequency ?? 0.1}
									min={0.02} max={0.5} step={0.01}
									format={(v) => `${v.toFixed(2)}/s`}
									onChange={(v) => sendConfig({ lightning: { ...config.lightning, frequency: v } })}
								/>
							)}
						</div>
					</>
				)}

				{activeTab === "lighting" && (
					<>
						<ToggleRow
							label="Auto Sun Light"
							value={config.lighting?.autoSunLight ?? true}
							onChange={(v) => sendConfig({ lighting: { ...config.lighting, autoSunLight: v } })}
						/>
						<ToggleRow
							label="Auto Ambient"
							value={config.lighting?.autoAmbient ?? true}
							onChange={(v) => sendConfig({ lighting: { ...config.lighting, autoAmbient: v } })}
						/>
						<ToggleRow
							label="Shadows"
							value={config.lighting?.shadowsEnabled ?? true}
							onChange={(v) => sendConfig({ lighting: { ...config.lighting, shadowsEnabled: v } })}
						/>
						<SliderRow
							label="Sun Intensity"
							value={config.lighting?.sunIntensity ?? 1.5}
							min={0} max={5.0} step={0.1}
							format={(v) => v.toFixed(1)}
							onChange={(v) => sendConfig({ lighting: { ...config.lighting, sunIntensity: v } })}
						/>
						<SliderRow
							label="Ambient Intensity"
							value={config.lighting?.ambientIntensity ?? 0.4}
							min={0} max={2.0} step={0.05}
							format={(v) => v.toFixed(2)}
							onChange={(v) => sendConfig({ lighting: { ...config.lighting, ambientIntensity: v } })}
						/>
					</>
				)}

				{activeTab === "fog" && (
					<>
						<ToggleRow
							label="Enable Fog"
							value={config.fog?.enabled ?? false}
							onChange={(v) => sendConfig({ fog: { ...config.fog, enabled: v } })}
						/>
						{config.fog?.enabled && (
							<>
								<ToggleRow
									label="Auto Color (match sky)"
									value={config.fog?.autoColor ?? true}
									onChange={(v) => sendConfig({ fog: { ...config.fog, autoColor: v } })}
								/>
								<SliderRow
									label="Density"
									value={config.fog?.density ?? 0.003}
									min={0.0005} max={0.05} step={0.0005}
									format={(v) => v.toFixed(4)}
									onChange={(v) => sendConfig({ fog: { ...config.fog, density: v } })}
								/>
								<SliderRow
									label="Height Falloff"
									value={config.fog?.heightFalloff ?? 0}
									min={0} max={1} step={0.05}
									format={(v) => v.toFixed(2)}
									onChange={(v) => sendConfig({ fog: { ...config.fog, heightFalloff: v } })}
								/>
							</>
						)}
					</>
				)}

				{activeTab === "fx" && (
					<>
						<SliderRow
							label="God Rays"
							value={config.effects?.godRays ?? 0}
							min={0} max={2} step={0.1}
							format={(v) => v.toFixed(1)}
							onChange={(v) => sendConfig({ effects: { ...config.effects, godRays: v } })}
						/>
						<SliderRow
							label="Aurora Borealis"
							value={config.effects?.aurora ?? 0}
							min={0} max={2} step={0.1}
							format={(v) => v.toFixed(1)}
							onChange={(v) => sendConfig({ effects: { ...config.effects, aurora: v } })}
						/>
						<SliderRow
							label="Rainbow"
							value={config.effects?.rainbow ?? 0}
							min={0} max={2} step={0.1}
							format={(v) => v.toFixed(1)}
							onChange={(v) => sendConfig({ effects: { ...config.effects, rainbow: v } })}
						/>
						<div className="border-t border-white/[0.06] pt-3">
							<ToggleRow
								label="Ambient Audio"
								value={config.effects?.ambientAudio ?? false}
								onChange={(v) => sendConfig({ effects: { ...config.effects, ambientAudio: v } })}
							/>
							{config.effects?.ambientAudio && (
								<SliderRow
									label="Volume"
									value={config.effects?.audioVolume ?? 0.5}
									min={0} max={1} step={0.05}
									format={(v) => `${Math.round(v * 100)}%`}
									onChange={(v) => sendConfig({ effects: { ...config.effects, audioVolume: v } })}
								/>
							)}
						</div>
					</>
				)}
			</div>

			{/* Footer — Save & Reset */}
			<div className="p-3 border-t border-white/[0.08] space-y-1.5">
				<button
					type="button"
					onClick={() => {
						onSave(latestConfigRef.current);
						dirtyRef.current = false;
					}}
					className={`w-full py-2 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 ${
						dirtyRef.current
							? "bg-amber-600 hover:bg-amber-500 text-white"
							: "bg-white/[0.06] text-white/30 cursor-default"
					}`}
				>
					Save & Apply
				</button>
				<button
					type="button"
					onClick={() => {
						const defaults: SkyWeatherConfig = {
							time: { solarTime: 0.45, cycleLengthMinutes: 10, autoAdvance: false, latitude: 45 },
							sky: { sunDiskSize: 0.028, moonDiskSize: 0.022, mieCoefficient: 0.005, mieDirectionalG: 0.80, starIntensity: 1.0, exposure: 2.0 },
							lighting: { autoSunLight: true, autoAmbient: true, sunIntensity: 1.5, ambientIntensity: 0.4, shadowsEnabled: true },
							fog: { enabled: false, autoColor: true, density: 0.003 },
							clouds: { coverage: 0, density: 0.85, speed: 1.0, scale: 3.0, brightness: 1.0 },
							precipitation: { type: "none", intensity: 0, windDirection: 0, windStrength: 0.3 },
							lightning: { enabled: false, frequency: 0.1 },
							effects: { godRays: 0, aurora: 0, rainbow: 0, ambientAudio: false, audioVolume: 0.5 },
						};
						setConfig(defaults);
						latestConfigRef.current = defaults;
						dirtyRef.current = true;
						sendToIframe({ type: "sky-weather-update-config", config: defaults });
						sendToIframe({ type: "sky-weather-set-time", solarTime: 0.45 });
						onChange(defaults);
					}}
					className="w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/60 text-[10px] transition-colors flex items-center justify-center gap-1.5"
				>
					<RotateCcw className="w-3 h-3" />
					Reset to Defaults
				</button>
			</div>
		</div>
	);
}

// ===== Reusable Components =====

function SliderRow({ label, value, min, max, step, format, onChange }: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	format: (v: number) => string;
	onChange: (v: number) => void;
}) {
	return (
		<div>
			<div className="flex items-center justify-between mb-1">
				<span className="text-[10px] text-white/40">{label}</span>
				<span className="text-[10px] text-white/60 font-mono">{format(value)}</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number.parseFloat(e.target.value))}
				className="w-full accent-amber-500"
			/>
		</div>
	);
}

function ToggleRow({ label, value, onChange }: {
	label: string;
	value: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between py-1">
			<span className="text-[10px] text-white/50">{label}</span>
			<button
				type="button"
				onClick={() => onChange(!value)}
				className={`w-8 h-4 rounded-full transition-colors relative ${
					value ? "bg-amber-600" : "bg-zinc-700"
				}`}
			>
				<div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
					value ? "translate-x-4" : "translate-x-0.5"
				}`} />
			</button>
		</div>
	);
}
