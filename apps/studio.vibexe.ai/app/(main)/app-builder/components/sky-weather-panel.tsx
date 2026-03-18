"use client";

/**
 * SkyWeatherPanel — UI for Sky & Weather / Sky & Weather Advanced modules
 *
 * Advanced mode (Tenkoku conversion) exposes all 39 config properties:
 * Time & Position, Celestial Settings, Atmospherics, Weather, Fog, Effects.
 * Basic mode shows simplified controls.
 */

import {
	Calendar,
	Clock,
	Cloud,
	CloudSun,
	Droplets,
	Globe,
	Lightbulb,
	Moon,
	CloudFog,
	RotateCcw,
	Sparkles,
	Star,
	Sun,
	X,
	Zap,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { GameSettings } from "../lib/game-editor-context";

interface SkyWeatherConfig {
	time?: {
		solarTime?: number;
		cycleLengthMinutes?: number;
		autoAdvance?: boolean;
		latitude?: number;
		longitude?: number;
		timezone?: number;
		year?: number;
		month?: number;
		day?: number;
	};
	sky?: {
		sunDiskSize?: number;
		moonDiskSize?: number;
		mieCoefficient?: number;
		mieDirectionalG?: number;
		starIntensity?: number;
		exposure?: number;
		rayleighScale?: number;
		sunIntensity?: number;
		galaxyIntensity?: number;
		planetIntensity?: number;
		moonBrightness?: number;
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
	weather?: {
		autoForecast?: boolean;
		forecastInterval?: number;
	};
	effects?: {
		godRays?: number;
		aurora?: number;
		rainbow?: number;
		shootingStars?: number;
		ambientAudio?: boolean;
		audioVolume?: number;
	};
}

interface SkyWeatherPanelProps {
	sendToIframe: (msg: Record<string, unknown>) => void;
	onClose: () => void;
	settings: GameSettings;
	onChange: (config: SkyWeatherConfig) => void;
	onSave: (config: SkyWeatherConfig) => void;
	moduleId?: string;
}

type SkyTab = "time" | "celestial" | "atmos" | "weather" | "fog" | "fx";

const WEATHER_PRESETS = [
	{ label: "Clear", icon: "☀️", clouds: { coverage: 0.05, brightness: 1.1 }, fog: { enabled: true, density: 0.001, autoColor: true }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false }, sky: { exposure: 1.3, sunIntensity: 24 } },
	{ label: "Fair", icon: "🌤", clouds: { coverage: 0.2, brightness: 1.0 }, fog: { enabled: true, density: 0.0015, autoColor: true }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false }, sky: { exposure: 1.2, sunIntensity: 22 } },
	{ label: "Partly Cloudy", icon: "⛅", clouds: { coverage: 0.45, brightness: 1.0 }, fog: { enabled: true, density: 0.002, autoColor: true }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false }, sky: { exposure: 1.15, sunIntensity: 20 } },
	{ label: "Cloudy", icon: "☁️", clouds: { coverage: 0.75, brightness: 0.85 }, fog: { enabled: true, density: 0.003, autoColor: true }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false }, sky: { exposure: 1.0, sunIntensity: 18 } },
	{ label: "Overcast", icon: "🌥", clouds: { coverage: 0.95, brightness: 0.6 }, fog: { enabled: true, density: 0.005, autoColor: true }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false }, sky: { exposure: 0.8, sunIntensity: 14 } },
	{ label: "Rainy", icon: "🌧", clouds: { coverage: 0.85, brightness: 0.5 }, fog: { enabled: true, density: 0.005, autoColor: true }, precipitation: { type: "rain", intensity: 0.6, windStrength: 0.4 }, lightning: { enabled: false }, sky: { exposure: 0.7, sunIntensity: 12 } },
	{ label: "Snowy", icon: "🌨", clouds: { coverage: 0.9, brightness: 0.7 }, fog: { enabled: true, density: 0.006, autoColor: true }, precipitation: { type: "snow", intensity: 0.7, windStrength: 0.3 }, lightning: { enabled: false }, sky: { exposure: 0.85, sunIntensity: 16 } },
	{ label: "Foggy", icon: "🌫", clouds: { coverage: 0.6, brightness: 0.6 }, fog: { enabled: true, density: 0.015, autoColor: true }, precipitation: { type: "none", intensity: 0 }, lightning: { enabled: false }, sky: { exposure: 0.9, sunIntensity: 18 } },
	{ label: "Stormy", icon: "⛈", clouds: { coverage: 0.95, brightness: 0.35, density: 1.0 }, fog: { enabled: true, density: 0.008, autoColor: true }, precipitation: { type: "rain", intensity: 0.9, windStrength: 0.7 }, lightning: { enabled: true, frequency: 0.15 }, sky: { exposure: 0.6, sunIntensity: 10 } },
] as const;

const TIME_PRESETS = [
	{ label: "Dawn", time: 0.25, icon: "🌅", sky: { exposure: 1.0, rayleighScale: 1.2 } },
	{ label: "Morning", time: 0.35, icon: "🌤", sky: { exposure: 1.15, rayleighScale: 1.1 } },
	{ label: "Noon", time: 0.5, icon: "☀️", sky: { exposure: 1.2, rayleighScale: 1.0 } },
	{ label: "Afternoon", time: 0.65, icon: "🌤", sky: { exposure: 1.15, rayleighScale: 1.0 } },
	{ label: "Dusk", time: 0.75, icon: "🌇", sky: { exposure: 0.95, rayleighScale: 1.3 } },
	{ label: "Night", time: 0.0, icon: "🌙", sky: { exposure: 0.8, rayleighScale: 1.0 } },
];

const ADVANCED_DEFAULTS: SkyWeatherConfig = {
	time: { solarTime: 0.65, cycleLengthMinutes: 10, autoAdvance: true, latitude: 35, longitude: 136, timezone: 9, year: 2024, month: 6, day: 21 },
	sky: { sunDiskSize: 0.028, moonDiskSize: 0.022, mieCoefficient: 0.005, mieDirectionalG: 0.82, starIntensity: 1.0, exposure: 1.2, rayleighScale: 1.0, sunIntensity: 22.0, galaxyIntensity: 0, planetIntensity: 0, moonBrightness: 1.0 },
	lighting: { autoSunLight: true, autoAmbient: true, sunIntensity: 1.5, ambientIntensity: 0.4, shadowsEnabled: true },
	fog: { enabled: true, autoColor: true, density: 0.0015, heightFalloff: 0.3 },
	clouds: { coverage: 0.35, density: 0.85, speed: 1.0, scale: 3.0, brightness: 1.0 },
	precipitation: { type: "none", intensity: 0, windDirection: 0, windStrength: 0.3 },
	lightning: { enabled: false, frequency: 0.1 },
	weather: { autoForecast: false, forecastInterval: 60 },
	effects: { godRays: 0.5, aurora: 0, rainbow: 0, shootingStars: 0, ambientAudio: false, audioVolume: 0.5 },
};

const BASIC_DEFAULTS: SkyWeatherConfig = {
	time: { solarTime: 0.45, cycleLengthMinutes: 10, autoAdvance: false, latitude: 45 },
	sky: { sunDiskSize: 0.028, moonDiskSize: 0.022, mieCoefficient: 0.005, mieDirectionalG: 0.80, starIntensity: 1.0, exposure: 1.2 },
	lighting: { autoSunLight: true, autoAmbient: true, sunIntensity: 1.5, ambientIntensity: 0.4, shadowsEnabled: true },
	fog: { enabled: false, autoColor: true, density: 0.003 },
	clouds: { coverage: 0, density: 0.85, speed: 1.0, scale: 3.0, brightness: 1.0 },
	precipitation: { type: "none", intensity: 0, windDirection: 0, windStrength: 0.3 },
	lightning: { enabled: false, frequency: 0.1 },
	effects: { godRays: 0, aurora: 0, rainbow: 0, shootingStars: 0, ambientAudio: false, audioVolume: 0.5 },
};

function getTimeLabel(t: number): string {
	const hours = Math.floor(t * 24);
	const mins = Math.floor((t * 24 - hours) * 60);
	const h12 = hours % 12 || 12;
	const ampm = hours < 12 ? "AM" : "PM";
	return `${h12}:${mins.toString().padStart(2, "0")} ${ampm}`;
}

export function SkyWeatherPanel({ sendToIframe, onClose, settings, onChange, onSave, moduleId }: SkyWeatherPanelProps) {
	const isAdvanced = moduleId === "sky-weather-advanced";
	const [activeTab, setActiveTab] = useState<SkyTab>("time");

	const skyWeather = isAdvanced
		? (settings as Record<string, unknown>).skyWeatherAdvanced as SkyWeatherConfig | undefined ?? settings.skyWeather
		: settings.skyWeather;
	const defaults = isAdvanced ? ADVANCED_DEFAULTS : BASIC_DEFAULTS;

	const [config, setConfig] = useState<SkyWeatherConfig>(() => {
		const d = defaults;
		return {
			time: { ...d.time, ...skyWeather?.time },
			sky: { ...d.sky, ...skyWeather?.sky },
			lighting: { ...d.lighting, ...skyWeather?.lighting },
			fog: { ...d.fog, ...skyWeather?.fog },
			clouds: { ...d.clouds, ...skyWeather?.clouds },
			precipitation: { ...d.precipitation, ...skyWeather?.precipitation },
			lightning: { ...d.lightning, ...skyWeather?.lightning },
			weather: { ...d.weather, ...skyWeather?.weather },
			effects: { ...d.effects, ...skyWeather?.effects },
		};
	});

	const dirtyRef = useRef(false);
	const latestConfigRef = useRef(config);
	const configRef = useRef(config);
	configRef.current = config;

	// Debounce sendToIframe to prevent message spam
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const sendConfig = useCallback((patch: Partial<SkyWeatherConfig>) => {
		const cur = configRef.current;
		const merged = {
			time: { ...cur.time, ...patch.time },
			sky: { ...cur.sky, ...patch.sky },
			lighting: { ...cur.lighting, ...patch.lighting },
			fog: { ...cur.fog, ...patch.fog },
			clouds: { ...cur.clouds, ...patch.clouds },
			precipitation: { ...cur.precipitation, ...patch.precipitation },
			lightning: { ...cur.lightning, ...patch.lightning },
			weather: { ...cur.weather, ...patch.weather },
			effects: { ...cur.effects, ...patch.effects },
		};
		setConfig(merged);
		latestConfigRef.current = merged;
		configRef.current = merged;
		dirtyRef.current = true;

		// Debounce iframe messages (100ms) to prevent flooding
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			sendToIframe({ type: "sky-weather-update-config", config: merged });
			onChange(merged);
		}, 100);
	}, [sendToIframe, onChange]);

	const setTime = useCallback((t: number, skyParams?: Record<string, number>) => {
		sendToIframe({ type: "sky-weather-set-time", solarTime: t });
		const update: Partial<SkyWeatherConfig> = { time: { solarTime: t } };
		if (skyParams) update.sky = { ...config.sky, ...skyParams };
		sendConfig(update);
	}, [sendToIframe, sendConfig, config.sky]);

	const tabs: { id: SkyTab; label: string; icon: typeof Sun }[] = isAdvanced
		? [
			{ id: "time", label: "Time", icon: Clock },
			{ id: "celestial", label: "Celestial", icon: Star },
			{ id: "atmos", label: "Atmos", icon: CloudSun },
			{ id: "weather", label: "Weather", icon: Cloud },
			{ id: "fog", label: "Fog", icon: CloudFog },
			{ id: "fx", label: "FX", icon: Sparkles },
		]
		: [
			{ id: "time", label: "Time", icon: Clock },
			{ id: "celestial", label: "Sky", icon: CloudSun },
			{ id: "weather", label: "Clouds", icon: Cloud },
			{ id: "atmos", label: "Light", icon: Lightbulb },
			{ id: "fog", label: "Fog", icon: CloudFog },
			{ id: "fx", label: "FX", icon: Sparkles },
		];

	return (
		<div className="absolute top-0 right-0 bottom-0 w-[260px] bg-[#0d0d0f]/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-30 select-none">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.08]">
				<div className="flex items-center gap-2">
					<CloudSun className="w-4 h-4 text-amber-400" />
					<span className="text-xs font-semibold text-white/90">
						{isAdvanced ? "Tenkoku Dynamic Sky" : "Sky & Weather"}
					</span>
				</div>
				<button type="button" onClick={() => { if (dirtyRef.current) onSave(latestConfigRef.current); onClose(); }} className="p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors">
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			{/* Tabs — 3×2 grid */}
			<div className="grid grid-cols-3 gap-0.5 border-b border-white/[0.06] px-1.5 py-1.5">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`flex items-center justify-center gap-1 py-1.5 text-[10px] rounded-md transition-all ${
								isActive
									? "bg-amber-500/[0.15] text-amber-300 ring-1 ring-amber-500/30"
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
			<div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
				{/* ══════════════════════ TIME & POSITION ══════════════════════ */}
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
									type="range" min="0" max="1" step="0.005"
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
										key={preset.label} type="button"
										onClick={() => setTime(preset.time, preset.sky)}
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
							<ToggleRow label="Day/Night Cycle" value={config.time?.autoAdvance ?? false}
								onChange={(v) => sendConfig({ time: { ...config.time, autoAdvance: v } })} />
							{config.time?.autoAdvance && (
								<SliderRow label="Cycle Length (min)" value={config.time?.cycleLengthMinutes ?? 10}
									min={1} max={60} step={1} format={(v) => `${v}`}
									onChange={(v) => sendConfig({ time: { ...config.time, cycleLengthMinutes: v } })} />
							)}
						</div>

						{/* Date (Advanced only) */}
						{isAdvanced && (
							<div className="border-t border-white/[0.06] pt-3">
								<SectionLabel icon={Calendar} label="Date (Orbital Calc)" />
								<div className="grid grid-cols-3 gap-1.5 mt-1.5">
									<NumberInput label="Year" value={config.time?.year ?? 2024} min={1900} max={2100}
										onChange={(v) => sendConfig({ time: { ...config.time, year: v } })} />
									<NumberInput label="Month" value={config.time?.month ?? 6} min={1} max={12}
										onChange={(v) => sendConfig({ time: { ...config.time, month: v } })} />
									<NumberInput label="Day" value={config.time?.day ?? 21} min={1} max={31}
										onChange={(v) => sendConfig({ time: { ...config.time, day: v } })} />
								</div>
							</div>
						)}

						{/* Geographic Position */}
						<div className="border-t border-white/[0.06] pt-3">
							<SectionLabel icon={Globe} label="Position" />
							<SliderRow label="Latitude" value={config.time?.latitude ?? 45}
								min={-90} max={90} step={1} format={(v) => `${v}°`}
								onChange={(v) => sendConfig({ time: { ...config.time, latitude: v } })} />
							{isAdvanced && (
								<>
									<SliderRow label="Longitude" value={config.time?.longitude ?? 0}
										min={-180} max={180} step={1} format={(v) => `${v}°`}
										onChange={(v) => sendConfig({ time: { ...config.time, longitude: v } })} />
									<SliderRow label="Timezone (UTC)" value={config.time?.timezone ?? 0}
										min={-12} max={14} step={1} format={(v) => v >= 0 ? `+${v}` : `${v}`}
										onChange={(v) => sendConfig({ time: { ...config.time, timezone: v } })} />
								</>
							)}
						</div>
					</>
				)}

				{/* ══════════════════════ CELESTIAL SETTINGS ══════════════════════ */}
				{activeTab === "celestial" && (
					<>
						{isAdvanced ? (
							<>
								{/* Sun Rendering */}
								<SectionLabel icon={Sun} label="Sun Rendering" />
								<SliderRow label="Disk Size" value={config.sky?.sunDiskSize ?? 0.028}
									min={0.005} max={0.1} step={0.001} format={(v) => v.toFixed(3)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, sunDiskSize: v } })} />
								<SliderRow label="Atmospheric Intensity" value={config.sky?.sunIntensity ?? 22}
									min={5} max={50} step={1} format={(v) => v.toFixed(0)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, sunIntensity: v } })} />

								{/* Moon Rendering */}
								<div className="border-t border-white/[0.06] pt-3">
									<SectionLabel icon={Moon} label="Moon Rendering" />
									<SliderRow label="Disk Size" value={config.sky?.moonDiskSize ?? 0.022}
										min={0.005} max={0.08} step={0.001} format={(v) => v.toFixed(3)}
										onChange={(v) => sendConfig({ sky: { ...config.sky, moonDiskSize: v } })} />
									<SliderRow label="Brightness" value={config.sky?.moonBrightness ?? 1.0}
										min={0} max={3} step={0.1} format={(v) => v.toFixed(1)}
										onChange={(v) => sendConfig({ sky: { ...config.sky, moonBrightness: v } })} />
								</div>

								{/* Star Rendering */}
								<div className="border-t border-white/[0.06] pt-3">
									<SectionLabel icon={Star} label="Star Rendering" />
									<SliderRow label="Star Brightness" value={config.sky?.starIntensity ?? 1.0}
										min={0} max={3} step={0.1} format={(v) => v.toFixed(1)}
										onChange={(v) => sendConfig({ sky: { ...config.sky, starIntensity: v } })} />
									<SliderRow label="Planet Brightness" value={config.sky?.planetIntensity ?? 1.0}
										min={0} max={3} step={0.1} format={(v) => v.toFixed(1)}
										onChange={(v) => sendConfig({ sky: { ...config.sky, planetIntensity: v } })} />
								</div>

								{/* Galaxy / Milky Way */}
								<div className="border-t border-white/[0.06] pt-3">
									<SectionLabel icon={Sparkles} label="Galaxy / Milky Way" />
									<SliderRow label="Brightness" value={config.sky?.galaxyIntensity ?? 1.0}
										min={0} max={3} step={0.1} format={(v) => v.toFixed(1)}
										onChange={(v) => sendConfig({ sky: { ...config.sky, galaxyIntensity: v } })} />
								</div>

								{/* Aurora Rendering */}
								<div className="border-t border-white/[0.06] pt-3">
									<SectionLabel icon={Sparkles} label="Aurora Rendering" />
									<SliderRow label="Intensity" value={config.effects?.aurora ?? 0}
										min={0} max={2} step={0.1} format={(v) => v.toFixed(1)}
										onChange={(v) => sendConfig({ effects: { ...config.effects, aurora: v } })} />
								</div>
							</>
						) : (
							<>
								{/* Basic sky controls */}
								<SliderRow label="Sun Size" value={config.sky?.sunDiskSize ?? 0.028}
									min={0.005} max={0.1} step={0.001} format={(v) => v.toFixed(3)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, sunDiskSize: v } })} />
								<SliderRow label="Moon Size" value={config.sky?.moonDiskSize ?? 0.022}
									min={0.005} max={0.08} step={0.001} format={(v) => v.toFixed(3)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, moonDiskSize: v } })} />
								<SliderRow label="Mie Scattering" value={config.sky?.mieCoefficient ?? 0.005}
									min={0} max={0.05} step={0.001} format={(v) => v.toFixed(3)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, mieCoefficient: v } })} />
								<SliderRow label="Mie G" value={config.sky?.mieDirectionalG ?? 0.80}
									min={0} max={0.99} step={0.01} format={(v) => v.toFixed(2)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, mieDirectionalG: v } })} />
								<SliderRow label="Star Intensity" value={config.sky?.starIntensity ?? 1.0}
									min={0} max={3} step={0.1} format={(v) => v.toFixed(1)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, starIntensity: v } })} />
								<SliderRow label="Exposure" value={config.sky?.exposure ?? 1.2}
									min={0.5} max={5} step={0.1} format={(v) => v.toFixed(1)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, exposure: v } })} />
							</>
						)}
					</>
				)}

				{/* ══════════════════════ ATMOSPHERICS / LIGHTING ══════════════════════ */}
				{activeTab === "atmos" && (
					<>
						{isAdvanced ? (
							<>
								<SectionLabel icon={CloudSun} label="Atmospherics" />
								<SliderRow label="Rayleigh Scale" value={config.sky?.rayleighScale ?? 1.0}
									min={0.1} max={3} step={0.05} format={(v) => v.toFixed(2)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, rayleighScale: v } })} />
								<SliderRow label="Mie Coefficient" value={config.sky?.mieCoefficient ?? 0.005}
									min={0} max={0.05} step={0.001} format={(v) => v.toFixed(3)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, mieCoefficient: v } })} />
								<SliderRow label="Mie G (Directionality)" value={config.sky?.mieDirectionalG ?? 0.76}
									min={0} max={0.99} step={0.01} format={(v) => v.toFixed(2)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, mieDirectionalG: v } })} />
								<SliderRow label="Exposure" value={config.sky?.exposure ?? 1.2}
									min={0.5} max={5} step={0.1} format={(v) => v.toFixed(1)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, exposure: v } })} />
								<SliderRow label="Sun Scatter Intensity" value={config.sky?.sunIntensity ?? 22}
									min={5} max={50} step={1} format={(v) => v.toFixed(0)}
									onChange={(v) => sendConfig({ sky: { ...config.sky, sunIntensity: v } })} />

								{/* Lighting */}
								<div className="border-t border-white/[0.06] pt-3">
									<SectionLabel icon={Lightbulb} label="Scene Lighting" />
									<ToggleRow label="Auto Sun Light" value={config.lighting?.autoSunLight ?? true}
										onChange={(v) => sendConfig({ lighting: { ...config.lighting, autoSunLight: v } })} />
									<ToggleRow label="Auto Ambient" value={config.lighting?.autoAmbient ?? true}
										onChange={(v) => sendConfig({ lighting: { ...config.lighting, autoAmbient: v } })} />
									<ToggleRow label="Shadows" value={config.lighting?.shadowsEnabled ?? true}
										onChange={(v) => sendConfig({ lighting: { ...config.lighting, shadowsEnabled: v } })} />
									<SliderRow label="Sun Light Intensity" value={config.lighting?.sunIntensity ?? 1.5}
										min={0} max={5} step={0.1} format={(v) => v.toFixed(1)}
										onChange={(v) => sendConfig({ lighting: { ...config.lighting, sunIntensity: v } })} />
									<SliderRow label="Ambient Intensity" value={config.lighting?.ambientIntensity ?? 0.4}
										min={0} max={2} step={0.05} format={(v) => v.toFixed(2)}
										onChange={(v) => sendConfig({ lighting: { ...config.lighting, ambientIntensity: v } })} />
								</div>
							</>
						) : (
							<>
								{/* Basic lighting controls */}
								<ToggleRow label="Auto Sun Light" value={config.lighting?.autoSunLight ?? true}
									onChange={(v) => sendConfig({ lighting: { ...config.lighting, autoSunLight: v } })} />
								<ToggleRow label="Auto Ambient" value={config.lighting?.autoAmbient ?? true}
									onChange={(v) => sendConfig({ lighting: { ...config.lighting, autoAmbient: v } })} />
								<ToggleRow label="Shadows" value={config.lighting?.shadowsEnabled ?? true}
									onChange={(v) => sendConfig({ lighting: { ...config.lighting, shadowsEnabled: v } })} />
								<SliderRow label="Sun Intensity" value={config.lighting?.sunIntensity ?? 1.5}
									min={0} max={5} step={0.1} format={(v) => v.toFixed(1)}
									onChange={(v) => sendConfig({ lighting: { ...config.lighting, sunIntensity: v } })} />
								<SliderRow label="Ambient Intensity" value={config.lighting?.ambientIntensity ?? 0.4}
									min={0} max={2} step={0.05} format={(v) => v.toFixed(2)}
									onChange={(v) => sendConfig({ lighting: { ...config.lighting, ambientIntensity: v } })} />
							</>
						)}
					</>
				)}

				{/* ══════════════════════ WEATHER / CLOUDS ══════════════════════ */}
				{activeTab === "weather" && (
					<>
						{/* Weather Presets */}
						<div>
							<label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Weather Presets</label>
							<div className="grid grid-cols-2 gap-1">
								{WEATHER_PRESETS.map((preset) => (
									<button key={preset.label} type="button"
										onClick={() => sendConfig({
											clouds: { ...config.clouds, ...preset.clouds },
											fog: { ...config.fog, ...preset.fog },
											precipitation: { ...config.precipitation, ...preset.precipitation },
											lightning: { ...config.lightning, ...preset.lightning },
											sky: { ...config.sky, ...preset.sky },
										})}
										className="px-2 py-1.5 text-[10px] rounded-lg bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-all text-left"
									>
										<span className="text-sm mr-1">{preset.icon}</span>
										{preset.label}
									</button>
								))}
							</div>
						</div>

						{/* Auto Forecast (Advanced) */}
						{isAdvanced && (
							<div className="border-t border-white/[0.06] pt-3">
								<ToggleRow label="Auto Weather Forecast" value={config.weather?.autoForecast ?? false}
									onChange={(v) => sendConfig({ weather: { ...config.weather, autoForecast: v } })} />
								{config.weather?.autoForecast && (
									<SliderRow label="Forecast Interval (s)" value={config.weather?.forecastInterval ?? 60}
										min={10} max={300} step={10} format={(v) => `${v}s`}
										onChange={(v) => sendConfig({ weather: { ...config.weather, forecastInterval: v } })} />
								)}
							</div>
						)}

						{/* Cloud Settings */}
						<div className="border-t border-white/[0.06] pt-3">
							<SectionLabel icon={Cloud} label="Cloud Settings" />
							<SliderRow label="Coverage" value={config.clouds?.coverage ?? 0}
								min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`}
								onChange={(v) => sendConfig({ clouds: { ...config.clouds, coverage: v } })} />
							<SliderRow label="Density" value={config.clouds?.density ?? 0.85}
								min={0.1} max={1} step={0.05} format={(v) => v.toFixed(2)}
								onChange={(v) => sendConfig({ clouds: { ...config.clouds, density: v } })} />
							<SliderRow label="Wind Speed" value={config.clouds?.speed ?? 1.0}
								min={0} max={5} step={0.1} format={(v) => v.toFixed(1)}
								onChange={(v) => sendConfig({ clouds: { ...config.clouds, speed: v } })} />
							<SliderRow label="Cloud Scale" value={config.clouds?.scale ?? 3.0}
								min={1} max={8} step={0.5} format={(v) => v.toFixed(1)}
								onChange={(v) => sendConfig({ clouds: { ...config.clouds, scale: v } })} />
							<SliderRow label="Brightness" value={config.clouds?.brightness ?? 1.0}
								min={0.1} max={2} step={0.05} format={(v) => v.toFixed(2)}
								onChange={(v) => sendConfig({ clouds: { ...config.clouds, brightness: v } })} />
						</div>

						{/* Precipitation */}
						<div className="border-t border-white/[0.06] pt-3">
							<SectionLabel icon={Droplets} label="Precipitation" />
							<div className="grid grid-cols-3 gap-1 mb-2">
								{(["none", "rain", "snow"] as const).map((pType) => (
									<button key={pType} type="button"
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
									<SliderRow label="Intensity" value={config.precipitation?.intensity ?? 0.5}
										min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`}
										onChange={(v) => sendConfig({ precipitation: { ...config.precipitation, intensity: v } })} />
									<SliderRow label="Wind Direction" value={config.precipitation?.windDirection ?? 0}
										min={0} max={360} step={5} format={(v) => `${Math.round(v)}°`}
										onChange={(v) => sendConfig({ precipitation: { ...config.precipitation, windDirection: v } })} />
									<SliderRow label="Wind Strength" value={config.precipitation?.windStrength ?? 0.3}
										min={0} max={1} step={0.05} format={(v) => v.toFixed(2)}
										onChange={(v) => sendConfig({ precipitation: { ...config.precipitation, windStrength: v } })} />
								</>
							)}
						</div>

						{/* Lightning */}
						<div className="border-t border-white/[0.06] pt-3">
							<SectionLabel icon={Zap} label="Lightning" />
							<ToggleRow label="Enable Lightning" value={config.lightning?.enabled ?? false}
								onChange={(v) => sendConfig({ lightning: { ...config.lightning, enabled: v } })} />
							{config.lightning?.enabled && (
								<SliderRow label="Frequency" value={config.lightning?.frequency ?? 0.1}
									min={0.02} max={0.5} step={0.01} format={(v) => `${v.toFixed(2)}/s`}
									onChange={(v) => sendConfig({ lightning: { ...config.lightning, frequency: v } })} />
							)}
						</div>
					</>
				)}

				{/* ══════════════════════ FOG ══════════════════════ */}
				{activeTab === "fog" && (
					<>
						<ToggleRow label="Enable Fog" value={config.fog?.enabled ?? false}
							onChange={(v) => sendConfig({ fog: { ...config.fog, enabled: v } })} />
						{config.fog?.enabled && (
							<>
								<ToggleRow label="Auto Color (match sky)" value={config.fog?.autoColor ?? true}
									onChange={(v) => sendConfig({ fog: { ...config.fog, autoColor: v } })} />
								<SliderRow label="Density" value={config.fog?.density ?? 0.003}
									min={0.0005} max={0.05} step={0.0005} format={(v) => v.toFixed(4)}
									onChange={(v) => sendConfig({ fog: { ...config.fog, density: v } })} />
								<SliderRow label="Height Falloff" value={config.fog?.heightFalloff ?? 0}
									min={0} max={1} step={0.05} format={(v) => v.toFixed(2)}
									onChange={(v) => sendConfig({ fog: { ...config.fog, heightFalloff: v } })} />
							</>
						)}
					</>
				)}

				{/* ══════════════════════ EFFECTS ══════════════════════ */}
				{activeTab === "fx" && (
					<>
						<SliderRow label="God Rays / Sun Shafts" value={config.effects?.godRays ?? 0}
							min={0} max={2} step={0.1} format={(v) => v.toFixed(1)}
							onChange={(v) => sendConfig({ effects: { ...config.effects, godRays: v } })} />
						{!isAdvanced && (
							<SliderRow label="Aurora Borealis" value={config.effects?.aurora ?? 0}
								min={0} max={2} step={0.1} format={(v) => v.toFixed(1)}
								onChange={(v) => sendConfig({ effects: { ...config.effects, aurora: v } })} />
						)}
						<SliderRow label="Rainbow" value={config.effects?.rainbow ?? 0}
							min={0} max={2} step={0.1} format={(v) => v.toFixed(1)}
							onChange={(v) => sendConfig({ effects: { ...config.effects, rainbow: v } })} />
						<SliderRow label="Shooting Stars" value={config.effects?.shootingStars ?? 0}
							min={0} max={2} step={0.1} format={(v) => v.toFixed(1)}
							onChange={(v) => sendConfig({ effects: { ...config.effects, shootingStars: v } })} />
						<div className="border-t border-white/[0.06] pt-3">
							<SectionLabel icon={Sparkles} label="Ambient Audio" />
							<ToggleRow label="Enable Audio" value={config.effects?.ambientAudio ?? false}
								onChange={(v) => sendConfig({ effects: { ...config.effects, ambientAudio: v } })} />
							{config.effects?.ambientAudio && (
								<SliderRow label="Volume" value={config.effects?.audioVolume ?? 0.5}
									min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`}
									onChange={(v) => sendConfig({ effects: { ...config.effects, audioVolume: v } })} />
							)}
						</div>
					</>
				)}
			</div>

			{/* Footer */}
			<div className="p-3 border-t border-white/[0.08] space-y-1.5">
				<button type="button"
					onClick={() => { onSave(latestConfigRef.current); dirtyRef.current = false; }}
					className={`w-full py-2 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 ${
						dirtyRef.current
							? "bg-amber-600 hover:bg-amber-500 text-white"
							: "bg-white/[0.06] text-white/30 cursor-default"
					}`}
				>
					Save & Apply
				</button>
				<button type="button"
					onClick={() => {
						setConfig(defaults);
						latestConfigRef.current = defaults;
						dirtyRef.current = true;
						sendToIframe({ type: "sky-weather-update-config", config: defaults });
						sendToIframe({ type: "sky-weather-set-time", solarTime: defaults.time?.solarTime ?? 0.45 });
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

function SectionLabel({ icon: Icon, label }: { icon: typeof Sun; label: string }) {
	return (
		<div className="flex items-center gap-1.5 mb-2">
			<Icon className="w-3 h-3 text-amber-400/70" />
			<span className="text-[10px] text-white/50 uppercase tracking-wider font-medium">{label}</span>
		</div>
	);
}

function SliderRow({ label, value, min, max, step, format, onChange }: {
	label: string; value: number; min: number; max: number; step: number;
	format: (v: number) => string; onChange: (v: number) => void;
}) {
	return (
		<div>
			<div className="flex items-center justify-between mb-1">
				<span className="text-[10px] text-white/40">{label}</span>
				<span className="text-[10px] text-white/60 font-mono">{format(value)}</span>
			</div>
			<input type="range" min={min} max={max} step={step} value={value}
				onChange={(e) => onChange(Number.parseFloat(e.target.value))}
				className="w-full accent-amber-500" />
		</div>
	);
}

function ToggleRow({ label, value, onChange }: {
	label: string; value: boolean; onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between py-1">
			<span className="text-[10px] text-white/50">{label}</span>
			<button type="button" onClick={() => onChange(!value)}
				className={`w-8 h-4 rounded-full transition-colors relative ${value ? "bg-amber-600" : "bg-zinc-700"}`}>
				<div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
			</button>
		</div>
	);
}

function NumberInput({ label, value, min, max, onChange }: {
	label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
	return (
		<div>
			<label className="text-[9px] text-white/30 block mb-0.5">{label}</label>
			<input type="number" min={min} max={max} value={value}
				onChange={(e) => { const v = Number.parseInt(e.target.value); if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v))); }}
				className="w-full bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-1 text-[10px] text-white/70 font-mono outline-none focus:border-amber-500/50"
			/>
		</div>
	);
}
