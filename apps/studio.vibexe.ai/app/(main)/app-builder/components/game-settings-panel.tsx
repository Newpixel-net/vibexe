"use client";

/**
 * GameSettingsPanel — Configure 3D game parameters (player, physics, camera, environment).
 * Shares the 260px right sidebar with the scene editor panel.
 */

import { Camera, Gauge, Puzzle, RotateCcw, Sparkles, Sun, User, Volume2, X, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_MODULE_MANIFESTS, type ModuleManifest } from "@vibexe-ai/vibexe-engine";
import { DragNumberInput } from "./drag-number-input";
import { ControllerConfigPanel } from "./controller-config-panel";
import { DEFAULT_GAME_SETTINGS, type GameSettings, type QualityPreset } from "../lib/game-editor-context";

type SettingsTab = "player" | "physics" | "camera" | "environment" | "audio" | "effects" | "performance" | "modules";

interface GameSettingsPanelProps {
	settings: GameSettings;
	onChange: (settings: GameSettings) => void;
	onSave: (settings: GameSettings) => void;
	onClose: () => void;
}

function deepMerge(target: any, patch: any): any {
	const result = { ...target };
	for (const [key, val] of Object.entries(patch)) {
		if (val && typeof val === "object" && !Array.isArray(val) && target[key] && typeof target[key] === "object") {
			result[key] = deepMerge(target[key], val);
		} else {
			result[key] = val;
		}
	}
	return result;
}

/* ------------------------------------------------------------------ */
/*  Tooltip — hover info icon that shows a description                */
/* ------------------------------------------------------------------ */

function Tooltip({ text }: { text: string }) {
	return (
		<div className="group relative inline-flex ml-1">
			<svg className="w-3.5 h-3.5 text-zinc-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
				<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
			</svg>
			<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-[11px] text-zinc-300 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
				{text}
				<div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-700" />
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  ValidationHint — amber warning when value is outside range        */
/* ------------------------------------------------------------------ */

function ValidationHint({ value, min, max, unit = "" }: { value: number; min: number; max: number; unit?: string }) {
	if (value < min || value > max) {
		return (
			<span className="text-[10px] text-amber-400 ml-2">
				Recommended: {min}{unit} – {max}{unit}
			</span>
		);
	}
	return null;
}

/* ------------------------------------------------------------------ */
/*  SectionLabel — section header with optional tooltip               */
/* ------------------------------------------------------------------ */

function SectionLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
	return (
		<div className="text-xs font-medium text-white/30 uppercase tracking-wider pt-1 flex items-center">
			{children}
			{tooltip && <Tooltip text={tooltip} />}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  SettingRow — wraps a DragNumberInput with optional validation      */
/* ------------------------------------------------------------------ */

function SettingRow({ children, tooltip, validation }: {
	children: React.ReactNode;
	tooltip?: string;
	validation?: React.ReactNode;
}) {
	return (
		<div>
			<div className="flex items-center">
				{children}
				{tooltip && <Tooltip text={tooltip} />}
			</div>
			{validation}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  ColorInput — larger swatch + editable hex input                    */
/* ------------------------------------------------------------------ */

function ColorInput({ label, value, onChange }: {
	label: string;
	value: string;
	onChange: (hex: string) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);

	return (
		<div className="flex items-center gap-2">
			<span className="text-xs text-white/50 w-[60px]">{label}</span>
			<label className="relative w-7 h-7 rounded-md border border-white/15 cursor-pointer overflow-hidden shrink-0"
				style={{ backgroundColor: value }}>
				<input type="color" value={value} onChange={(e) => { onChange(e.target.value); setDraft(e.target.value); }}
					className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
			</label>
			{editing ? (
				<input className="w-[72px] text-xs font-mono bg-white/5 text-white/80 rounded px-1.5 py-0.5 border border-white/15 outline-none focus:border-violet-400"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={() => { if (/^#[0-9a-f]{6}$/i.test(draft)) onChange(draft); setEditing(false); }}
					onKeyDown={(e) => { if (e.key === "Enter") { if (/^#[0-9a-f]{6}$/i.test(draft)) onChange(draft); setEditing(false); } if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
					autoFocus />
			) : (
				<span className="text-xs text-white/40 font-mono cursor-text hover:text-white/60"
					onClick={() => { setDraft(value); setEditing(true); }}>
					{value}
				</span>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  CharacterPicker — character selection sub-section in Player tab    */
/* ------------------------------------------------------------------ */

// Built-in character registry (mirrors the module's registry)
const AVAILABLE_CHARACTERS = [
	{
		id: "warrior",
		name: "Warrior",
		pack: "meshy-characters",
		model: "Warrior_figure_Animations.glb",
	},
];

function CharacterPicker({
	characterId,
	groundOffset,
	onSelect,
	onGroundOffsetChange,
}: {
	characterId: string;
	groundOffset: number;
	onSelect: (id: string, pack: string, model: string) => void;
	onGroundOffsetChange: (v: number) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const current = AVAILABLE_CHARACTERS.find((c) => c.id === characterId) ?? AVAILABLE_CHARACTERS[0];

	return (
		<div className="space-y-1.5">
			{/* Current character display */}
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
			>
				<div className="w-7 h-7 rounded bg-gradient-to-br from-violet-500/30 to-indigo-500/30 flex items-center justify-center text-xs shrink-0">
					<User className="w-3.5 h-3.5 text-violet-400" />
				</div>
				<div className="flex-1 text-left">
					<div className="text-[11px] text-white/80 font-medium">{current.name}</div>
					<div className="text-[9px] text-white/30">{current.pack}</div>
				</div>
				<svg
					className={`w-3 h-3 text-white/30 transition-transform ${expanded ? "rotate-180" : ""}`}
					fill="none" stroke="currentColor" viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{/* Character grid (expanded) */}
			{expanded && (
				<div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-white/[0.02] border border-white/[0.06]">
					{AVAILABLE_CHARACTERS.map((char) => (
						<button
							key={char.id}
							type="button"
							onClick={() => {
								onSelect(char.id, char.pack, char.model);
								setExpanded(false);
							}}
							className={`flex flex-col items-center gap-0.5 p-1.5 rounded transition-colors ${
								char.id === characterId
									? "bg-violet-500/20 border border-violet-500/40"
									: "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]"
							}`}
						>
							<div className="w-8 h-8 rounded bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
								<User className="w-4 h-4 text-violet-300" />
							</div>
							<span className="text-[9px] text-white/60 truncate w-full text-center">{char.name}</span>
						</button>
					))}
					{/* Placeholder for future characters */}
					<div className="flex flex-col items-center gap-0.5 p-1.5 rounded bg-white/[0.02] border border-dashed border-white/[0.08]">
						<div className="w-8 h-8 rounded bg-white/[0.03] flex items-center justify-center">
							<span className="text-white/20 text-sm">+</span>
						</div>
						<span className="text-[9px] text-white/20">More soon</span>
					</div>
				</div>
			)}

			{/* Ground offset fine-tuning */}
			<DragNumberInput
				label="Ground"
				value={groundOffset}
				step={0.05}
				precision={2}
				onChange={onGroundOffsetChange}
				labelClassName="w-[60px] text-left"
			/>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Content-only variant (used inside game-editor-panel tabs)          */
/* ------------------------------------------------------------------ */

export interface GameSettingsContentProps {
	settings: GameSettings;
	onChange: (settings: GameSettings) => void;
	onSave: (settings: GameSettings) => void;
	pickSpawnActive?: boolean;
	pickRespawnActive?: boolean;
	onTogglePickSpawn?: () => void;
	onTogglePickRespawn?: () => void;
	characterHalfHeight?: number;
}

export function GameSettingsContent({ settings, onChange, onSave, pickSpawnActive, pickRespawnActive, onTogglePickSpawn, onTogglePickRespawn, characterHalfHeight }: GameSettingsContentProps) {
	const [activeTab, setActiveTab] = useState<SettingsTab>("player");
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleSave = useCallback(() => {
		setSaveStatus("saving");
		onSave(settings);
		// Show "Saved!" after a brief delay (matches debounce timing)
		if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			setSaveStatus("saved");
			saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
		}, 600);
	}, [onSave, settings]);

	useEffect(() => {
		return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
	}, []);

	const update = useCallback((section: string, field: string, value: any) => {
		const patched = deepMerge(settings, { [section]: { [field]: value } });
		onChange(patched);
	}, [settings, onChange]);

	const QUALITY_PRESETS: Record<string, { antialias: boolean; pixelRatio: number; maxFPS: number }> = {
		low: { antialias: false, pixelRatio: 0.5, maxFPS: 30 },
		medium: { antialias: true, pixelRatio: 0.75, maxFPS: 60 },
		high: { antialias: true, pixelRatio: 1, maxFPS: 60 },
		ultra: { antialias: true, pixelRatio: 2, maxFPS: 120 },
	};

	const applyPreset = (preset: QualityPreset) => {
		const p = QUALITY_PRESETS[preset];
		onChange(deepMerge(settings, { performance: { qualityPreset: preset, ...p } }));
	};

	const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
		{ id: "player", label: "Player", icon: User },
		{ id: "physics", label: "Physics", icon: Zap },
		{ id: "camera", label: "Camera", icon: Camera },
		{ id: "environment", label: "Env", icon: Sun },
		{ id: "audio", label: "Audio", icon: Volume2 },
		{ id: "effects", label: "FX", icon: Sparkles },
		{ id: "performance", label: "Perf", icon: Gauge },
		{ id: "modules", label: "Modules", icon: Puzzle },
	];

	return (
		<>
			{/* Tab Bar */}
			<div className="flex border-b border-white/[0.08]">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[9px] transition-colors ${
								isActive
									? "text-violet-400 border-b-2 border-violet-400 bg-violet-500/10"
									: "text-white/30 hover:text-white/50 hover:bg-white/[0.04]"
							}`}
						>
							<Icon className="w-3.5 h-3.5" />
							{tab.label}
						</button>
					);
				})}
			</div>

			{/* Tab Content */}
			<div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
				{activeTab === "player" && (
					<>
						{/* Character Selection sub-section */}
						<SectionLabel tooltip="Select the player character model and adjust fit">Character</SectionLabel>
						<CharacterPicker
							characterId={settings.character?.id ?? "warrior"}
							groundOffset={settings.character?.groundOffset ?? 0}
							onSelect={(id: string, pack: string, model: string) => {
								onChange(deepMerge(settings, { character: { id, pack, model } }));
							}}
							onGroundOffsetChange={(v: number) => {
								onChange(deepMerge(settings, { character: { ...settings.character, groundOffset: v } }));
							}}
						/>

						<SectionLabel tooltip="Starting position coordinates for the player character">Spawn Position</SectionLabel>
						<DragNumberInput label="X" value={settings.player?.spawnX ?? 0} step={0.5} precision={1} onChange={(v) => update("player", "spawnX", v)} color="#e74c4c" />
						<DragNumberInput label="Y" value={settings.player?.spawnY ?? 3} step={0.5} precision={1} onChange={(v) => update("player", "spawnY", v)} color="#4ce74c" />
						<DragNumberInput label="Z" value={settings.player?.spawnZ ?? 0} step={0.5} precision={1} onChange={(v) => update("player", "spawnZ", v)} color="#4c7ce7" />
						{onTogglePickSpawn && (
							<button
								type="button"
								onClick={onTogglePickSpawn}
								className={`w-full text-[10px] py-1 rounded transition-colors ${
									pickSpawnActive
										? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
										: "text-white/40 bg-white/[0.04] hover:bg-white/[0.08]"
								}`}
							>
								{pickSpawnActive ? "Click in viewport to set spawn..." : "Pick spawn in viewport"}
							</button>
						)}

						<SectionLabel tooltip="Where the player reappears after falling off the map">Respawn Position</SectionLabel>
						<DragNumberInput label="X" value={settings.player?.respawnX ?? 0} step={0.5} precision={1} onChange={(v) => update("player", "respawnX", v)} color="#e74c4c" />
						<SettingRow tooltip="Y position threshold — falling below this triggers respawn">
							<DragNumberInput label="Y" value={settings.player?.respawnY ?? 5} step={0.5} precision={1} onChange={(v) => update("player", "respawnY", v)} color="#4ce74c" />
						</SettingRow>
						<DragNumberInput label="Z" value={settings.player?.respawnZ ?? 0} step={0.5} precision={1} onChange={(v) => update("player", "respawnZ", v)} color="#4c7ce7" />
						{onTogglePickRespawn && (
							<button
								type="button"
								onClick={onTogglePickRespawn}
								className={`w-full text-[10px] py-1 rounded transition-colors ${
									pickRespawnActive
										? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
										: "text-white/40 bg-white/[0.04] hover:bg-white/[0.08]"
								}`}
							>
								{pickRespawnActive ? "Click in viewport to set respawn..." : "Pick respawn in viewport"}
							</button>
						)}

						<SectionLabel tooltip="Number of lives before game over (1-99)">Lives</SectionLabel>
						<SettingRow
							validation={<ValidationHint value={settings.player?.startingLives ?? 3} min={1} max={99} />}
						>
							<DragNumberInput label="Lives" value={settings.player?.startingLives ?? 3} step={1} precision={0} onChange={(v) => update("player", "startingLives", Math.max(1, Math.round(v)))} labelClassName="w-[60px] text-left" />
						</SettingRow>

						{/* ── Controller Settings (full config panel) ── */}
						<ControllerConfigPanel settings={settings} onChange={onChange} />
					</>
				)}

				{activeTab === "physics" && (
					<>
						<SectionLabel tooltip="Downward force strength. Earth = -9.8, Moon = -1.6">Gravity</SectionLabel>
						<SettingRow
							tooltip="Main gravity pull. More negative = heavier"
							validation={<ValidationHint value={settings.physics?.gravity ?? -38} min={-80} max={-5} />}
						>
							<DragNumberInput label="Down" value={settings.physics?.gravity ?? -38} step={1} precision={0} onChange={(v) => update("physics", "gravity", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<SettingRow
							tooltip="Extra gravity when falling (makes jumps feel snappier)"
							validation={<ValidationHint value={settings.physics?.fallGravity ?? -65} min={-120} max={-10} />}
						>
							<DragNumberInput label="Fall" value={settings.physics?.fallGravity ?? -65} step={1} precision={0} onChange={(v) => update("physics", "fallGravity", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>

						<SectionLabel tooltip="Player movement and jump parameters">Movement</SectionLabel>
						<SettingRow
							tooltip="How high the player jumps. Higher = bigger jumps"
							validation={<ValidationHint value={settings.physics?.jumpForce ?? 17} min={5} max={50} />}
						>
							<DragNumberInput label="Jump" value={settings.physics?.jumpForce ?? 17} step={0.5} precision={1} onChange={(v) => update("physics", "jumpForce", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<SettingRow
							tooltip="Movement speed when walking (units/second)"
							validation={<ValidationHint value={settings.physics?.moveSpeed ?? 6} min={1} max={20} unit=" u/s" />}
						>
							<DragNumberInput label="Walk" value={settings.physics?.moveSpeed ?? 6} step={0.5} precision={1} onChange={(v) => update("physics", "moveSpeed", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<SettingRow
							tooltip="Movement speed when running (units/second)"
							validation={<ValidationHint value={settings.physics?.runSpeed ?? 7.5} min={2} max={30} unit=" u/s" />}
						>
							<DragNumberInput label="Run" value={settings.physics?.runSpeed ?? 7.5} step={0.5} precision={1} onChange={(v) => update("physics", "runSpeed", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<SettingRow
							tooltip="Ground friction. Lower = slippery (ice), higher = grippy"
							validation={<ValidationHint value={settings.physics?.friction ?? 28} min={1} max={60} />}
						>
							<DragNumberInput label="Friction" value={settings.physics?.friction ?? 28} step={1} precision={0} onChange={(v) => update("physics", "friction", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<SettingRow
							tooltip="Grace period (seconds) to jump after leaving a platform edge"
							validation={<ValidationHint value={settings.physics?.coyoteTime ?? 0.15} min={0} max={0.5} unit="s" />}
						>
							<DragNumberInput label="Coyote" value={settings.physics?.coyoteTime ?? 0.15} step={0.01} precision={2} onChange={(v) => update("physics", "coyoteTime", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>
					</>
				)}

				{activeTab === "camera" && (
					<>
						<SectionLabel tooltip="Camera offset relative to the player">Position</SectionLabel>
						<SettingRow
							tooltip="Camera height above the player"
							validation={<ValidationHint value={settings.camera?.offsetY ?? 8} min={1} max={30} />}
						>
							<DragNumberInput label="Offset Y" value={settings.camera?.offsetY ?? 8} step={0.5} precision={1} onChange={(v) => update("camera", "offsetY", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<SettingRow
							tooltip="Camera distance behind the player"
							validation={<ValidationHint value={settings.camera?.offsetZ ?? 12} min={2} max={40} />}
						>
							<DragNumberInput label="Offset Z" value={settings.camera?.offsetZ ?? 12} step={0.5} precision={1} onChange={(v) => update("camera", "offsetZ", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>

						<SectionLabel tooltip="Field of View in degrees. 60 = normal, 90 = wide, 45 = zoom">Lens</SectionLabel>
						<SettingRow
							tooltip="Field of View angle (20-120 degrees)"
							validation={<ValidationHint value={settings.camera?.fov ?? 60} min={20} max={120} unit="deg" />}
						>
							<DragNumberInput label="FOV" value={settings.camera?.fov ?? 60} step={1} precision={0} onChange={(v) => update("camera", "fov", Math.max(20, Math.min(120, v)))} labelClassName="w-[60px] text-left" />
						</SettingRow>

						<SectionLabel tooltip="How the camera follows the player">Follow</SectionLabel>
						<SettingRow tooltip="Camera smoothness. Lower = smoother, higher = snappier">
							<DragNumberInput label="Lerp" value={settings.camera?.lerp ?? 3} step={0.5} precision={1} onChange={(v) => update("camera", "lerp", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<SettingRow tooltip="How far ahead the camera looks in movement direction">
							<DragNumberInput label="Ahead" value={settings.camera?.lookAhead ?? 5} step={0.5} precision={1} onChange={(v) => update("camera", "lookAhead", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<SettingRow tooltip="Vertical look offset — shifts the camera target up or down">
							<DragNumberInput label="Look Y" value={settings.camera?.lookY ?? 1} step={0.5} precision={1} onChange={(v) => update("camera", "lookY", v)} labelClassName="w-[60px] text-left" />
						</SettingRow>
					</>
				)}

				{activeTab === "environment" && (
					<>
						<SectionLabel tooltip="Sky/background color when no skybox is used">Background</SectionLabel>
						<ColorInput label="Color" value={settings.environment?.backgroundColor ?? "#87CEEB"} onChange={(v) => update("environment", "backgroundColor", v)} />

						<SectionLabel tooltip="Light sources that illuminate the scene">Lighting</SectionLabel>
						<SettingRow
							tooltip="Base light that illuminates everything equally"
							validation={<ValidationHint value={settings.environment?.ambientLightIntensity ?? 0.15} min={0} max={2} />}
						>
							<DragNumberInput label="Ambient" value={settings.environment?.ambientLightIntensity ?? 0.15} step={0.05} precision={2} onChange={(v) => update("environment", "ambientLightIntensity", Math.max(0, Math.min(2, v)))} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<ColorInput label="Color" value={settings.environment?.ambientLightColor ?? "#ffffff"} onChange={(v) => update("environment", "ambientLightColor", v)} />
						<SettingRow
							tooltip="Directional sunlight strength"
							validation={<ValidationHint value={settings.environment?.sunLightIntensity ?? 0.55} min={0} max={2} />}
						>
							<DragNumberInput label="Sun" value={settings.environment?.sunLightIntensity ?? 0.55} step={0.05} precision={2} onChange={(v) => update("environment", "sunLightIntensity", Math.max(0, Math.min(2, v)))} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<ColorInput label="Color" value={settings.environment?.sunLightColor ?? "#fff8ee"} onChange={(v) => update("environment", "sunLightColor", v)} />
						<SettingRow
							tooltip="Sky-to-ground gradient light strength"
							validation={<ValidationHint value={settings.environment?.hemisphereIntensity ?? 0.35} min={0} max={2} />}
						>
							<DragNumberInput label="Hemi" value={settings.environment?.hemisphereIntensity ?? 0.35} step={0.05} precision={2} onChange={(v) => update("environment", "hemisphereIntensity", Math.max(0, Math.min(2, v)))} labelClassName="w-[60px] text-left" />
						</SettingRow>
						<ColorInput label="Sky" value={settings.environment?.hemisphereSkyColor ?? "#eef4ff"} onChange={(v) => update("environment", "hemisphereSkyColor", v)} />
						<ColorInput label="Ground" value={settings.environment?.hemisphereGroundColor ?? "#886644"} onChange={(v) => update("environment", "hemisphereGroundColor", v)} />

						<SectionLabel tooltip="Adds distance fog that fades objects in the background">Fog</SectionLabel>
						<div className="flex items-center gap-2">
							<span className="text-xs text-white/50 w-[60px]">Enabled</span>
							<button
								type="button"
								onClick={() => {
									const wasEnabled = settings.environment?.fogEnabled ?? false;
									if (!wasEnabled && (settings.environment?.fogColor ?? "#88aacc") === "#88aacc") {
										onChange(deepMerge(settings, { environment: { fogEnabled: true, fogColor: settings.environment?.backgroundColor ?? "#87CEEB" } }));
									} else {
										update("environment", "fogEnabled", !wasEnabled);
									}
								}}
								className={`w-8 h-4 rounded-full transition-colors relative ${
									settings.environment?.fogEnabled ? "bg-violet-500" : "bg-white/10"
								}`}
							>
								<div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
									settings.environment?.fogEnabled ? "translate-x-4" : "translate-x-0.5"
								}`} />
							</button>
							<Tooltip text="Toggle distance fog on/off" />
						</div>
						{settings.environment?.fogEnabled && (
							<>
								<div className="flex items-center gap-2">
									<ColorInput label="Color" value={settings.environment?.fogColor ?? "#88aacc"} onChange={(v) => update("environment", "fogColor", v)} />
									<button onClick={() => update("environment", "fogColor", settings.environment?.backgroundColor ?? "#87CEEB")}
										className="text-[10px] text-white/30 hover:text-white/60 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 shrink-0"
										title="Set fog color to match background">
										Match Sky
									</button>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-xs text-white/50 w-[60px]">Type</span>
									<select value={settings.environment?.fogType ?? "linear"}
										onChange={(e) => update("environment", "fogType", e.target.value)}
										className="bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 border border-zinc-700 focus:ring-1 focus:ring-violet-500 outline-none">
										<option value="linear">Linear (Near/Far)</option>
										<option value="exponential">Exponential (Density)</option>
									</select>
								</div>
								{(settings.environment?.fogType ?? "linear") === "linear" ? (
									<>
										<SettingRow
											tooltip="Distance where fog begins (closer = more fog)"
											validation={<ValidationHint value={settings.environment?.fogNear ?? 30} min={1} max={200} />}
										>
											<DragNumberInput label="Near" value={settings.environment?.fogNear ?? 30} step={1} precision={0} onChange={(v) => update("environment", "fogNear", Math.max(1, v))} labelClassName="w-[60px] text-left" />
										</SettingRow>
										<SettingRow
											tooltip="Distance where fog fully obscures objects"
											validation={<ValidationHint value={settings.environment?.fogFar ?? 100} min={10} max={500} />}
										>
											<DragNumberInput label="Far" value={settings.environment?.fogFar ?? 100} step={1} precision={0} onChange={(v) => update("environment", "fogFar", Math.max(1, v))} labelClassName="w-[60px] text-left" />
										</SettingRow>
									</>
								) : (
									<SettingRow
										tooltip="Fog density — higher values create thicker fog"
										validation={<ValidationHint value={settings.environment?.fogDensity ?? 0.02} min={0.001} max={0.5} />}
									>
										<DragNumberInput label="Density" value={settings.environment?.fogDensity ?? 0.02} step={0.005} precision={3} onChange={(v) => update("environment", "fogDensity", Math.max(0.001, Math.min(0.5, v)))} labelClassName="w-[60px] text-left" />
									</SettingRow>
								)}
							</>
						)}

						<SectionLabel tooltip="Shadow rendering quality — higher = sharper but slower">Shadows</SectionLabel>
						<div className="flex items-center gap-2">
							<span className="text-xs text-white/50 w-[60px]">Quality</span>
							<select
								value={settings.environment?.shadowQuality ?? "medium"}
								onChange={(e) => update("environment", "shadowQuality", e.target.value)}
								className="bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 border border-zinc-700 focus:ring-1 focus:ring-violet-500 outline-none"
							>
								<option value="low">Low (512)</option>
								<option value="medium">Medium (1024)</option>
								<option value="high">High (2048)</option>
							</select>
						</div>
					</>
				)}

				{activeTab === "audio" && (
					<>
						<SectionLabel tooltip="Master audio controls for the game">Audio</SectionLabel>
						<p className="text-xs text-white/30 mb-3">Audio settings apply when your game code uses the audio system. Add sound effects or music in your game code to enable these controls.</p>
						<div className="flex items-center gap-2">
							<span className="text-xs text-white/50 w-[60px]">Enabled</span>
							<button
								type="button"
								onClick={() => update("audio", "enabled", !(settings.audio?.enabled ?? true))}
								className={`w-8 h-4 rounded-full transition-colors relative ${
									settings.audio?.enabled !== false ? "bg-violet-500" : "bg-white/10"
								}`}
							>
								<div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
									settings.audio?.enabled !== false ? "translate-x-4" : "translate-x-0.5"
								}`} />
							</button>
						</div>
						<DragNumberInput label="Master" value={Math.round((settings.audio?.masterVolume ?? 0.8) * 100)} step={1} precision={0} onChange={(v) => update("audio", "masterVolume", Math.max(0, Math.min(100, Math.round(v))) / 100)} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Music" value={Math.round((settings.audio?.musicVolume ?? 0.5) * 100)} step={1} precision={0} onChange={(v) => update("audio", "musicVolume", Math.max(0, Math.min(100, Math.round(v))) / 100)} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="SFX" value={Math.round((settings.audio?.sfxVolume ?? 0.7) * 100)} step={1} precision={0} onChange={(v) => update("audio", "sfxVolume", Math.max(0, Math.min(100, Math.round(v))) / 100)} labelClassName="w-[60px] text-left" />
					</>
				)}

				{activeTab === "effects" && (
					<>
						<SectionLabel tooltip="Visual style presets with bloom and color grading">Post-Processing</SectionLabel>
						<div className="space-y-1">
							{(["none", "cinematic", "vibrant", "dark", "neon", "natural"] as const).map((preset) => {
								const labels: Record<string, string> = {
									none: "None — No effects",
									cinematic: "Cinematic — Warm, subtle bloom",
									vibrant: "Vibrant — Saturated, bright",
									dark: "Dark — Moody, high contrast",
									neon: "Neon — Glowing highlights",
									natural: "Natural — Soft, realistic",
								};
								const isActive = (settings.postProcessing?.preset ?? "none") === preset;
								return (
									<button
										key={preset}
										type="button"
										onClick={() => update("postProcessing", "preset", preset)}
										className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
											isActive ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "text-white/50 hover:bg-white/5 border border-transparent"
										}`}
									>
										{labels[preset]}
									</button>
								);
							})}
						</div>
						{(settings.postProcessing?.preset ?? "none") !== "none" && (
							<>
								<SectionLabel tooltip="Fine-tune bloom effect intensity and threshold">Bloom</SectionLabel>
								<DragNumberInput label="Intensity" value={settings.postProcessing?.bloomIntensity ?? 0.5} step={0.1} precision={1} onChange={(v) => update("postProcessing", "bloomIntensity", Math.max(0, Math.min(3, v)))} labelClassName="w-[60px] text-left" />
								<DragNumberInput label="Threshold" value={settings.postProcessing?.bloomThreshold ?? 0.8} step={0.05} precision={2} onChange={(v) => update("postProcessing", "bloomThreshold", Math.max(0, Math.min(1, v)))} labelClassName="w-[60px] text-left" />
							</>
						)}
					</>
				)}

				{activeTab === "performance" && (
					<>
						<SectionLabel tooltip="Overall rendering quality — affects shadows, resolution, and anti-aliasing">Quality Preset</SectionLabel>
						<div className="flex items-center gap-2">
							<span className="text-xs text-white/50 w-[60px]">Preset</span>
							<select
								value={settings.performance?.qualityPreset ?? "high"}
								onChange={(e) => applyPreset(e.target.value as QualityPreset)}
								className="bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 border border-zinc-700 focus:ring-1 focus:ring-violet-500 outline-none"
							>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
								<option value="ultra">Ultra</option>
							</select>
						</div>

						<SectionLabel tooltip="Toggle the FPS counter overlay">Debug</SectionLabel>
						<div className="flex items-center gap-2">
							<span className="text-xs text-white/50 w-[60px]">Show FPS</span>
							<button
								type="button"
								onClick={() => update("performance", "showFPS", !(settings.performance?.showFPS ?? false))}
								className={`w-8 h-4 rounded-full transition-colors relative ${
									settings.performance?.showFPS ? "bg-violet-500" : "bg-white/10"
								}`}
							>
								<div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
									settings.performance?.showFPS ? "translate-x-4" : "translate-x-0.5"
								}`} />
							</button>
						</div>

						<SectionLabel tooltip="Advanced rendering options">Rendering</SectionLabel>
						<div className="flex items-center gap-2">
							<span className="text-xs text-white/50 w-[60px]">Antialias</span>
							<button
								type="button"
								onClick={() => update("performance", "antialias", !(settings.performance?.antialias ?? true))}
								className={`w-8 h-4 rounded-full transition-colors relative ${
									settings.performance?.antialias !== false ? "bg-violet-500" : "bg-white/10"
								}`}
							>
								<div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
									settings.performance?.antialias !== false ? "translate-x-4" : "translate-x-0.5"
								}`} />
							</button>
						</div>
						<p className="text-xs text-white/30 -mt-1 mb-1 ml-[68px]">Applied on next game reload</p>
						<DragNumberInput label="Pixel Ratio" value={settings.performance?.pixelRatio ?? 1} step={0.25} precision={2} onChange={(v) => update("performance", "pixelRatio", Math.max(0.5, Math.min(2, v)))} labelClassName="w-[60px] text-left" />
						<div className="flex items-center gap-2">
							<span className="text-xs text-white/50 w-[60px]">Max FPS</span>
							<select
								value={settings.performance?.maxFPS ?? 60}
								onChange={(e) => update("performance", "maxFPS", Number(e.target.value))}
								className="bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 border border-zinc-700 focus:ring-1 focus:ring-violet-500 outline-none"
							>
								<option value={30}>30</option>
								<option value={60}>60</option>
								<option value={120}>120</option>
								<option value={0}>Unlimited</option>
							</select>
						</div>
					</>
				)}

				{activeTab === "modules" && (
					<div className="space-y-3">
						<div className="text-[10px] text-zinc-500 px-1 mb-2">
							Install modules to add features to your game. Modules provide terrain painting, weather effects, and more.
						</div>
						{ALL_MODULE_MANIFESTS.map((mod: ModuleManifest) => {
							const isInstalled = settings.modules?.installed?.[mod.id]?.enabled ?? false;
							return (
								<div key={mod.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
									<div className="flex items-center justify-between mb-1.5">
										<div className="flex items-center gap-2">
											<Puzzle className="w-3.5 h-3.5 text-purple-400" />
											<span className="text-xs font-medium text-zinc-200">{mod.name}</span>
										</div>
										<button
											type="button"
											onClick={() => {
												const current = settings.modules?.installed || {};
												const updated = {
													...current,
													[mod.id]: {
														...current[mod.id],
														enabled: !isInstalled,
														version: mod.version,
													},
												};
												onChange(deepMerge(settings, { modules: { installed: updated } }));
											}}
											className={`w-8 h-4 rounded-full transition-colors relative ${
												isInstalled ? "bg-purple-600" : "bg-zinc-700"
											}`}
										>
											<div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
												isInstalled ? "translate-x-4" : "translate-x-0.5"
											}`} />
										</button>
									</div>
									<p className="text-[10px] text-zinc-500 mb-1">{mod.description}</p>
									<div className="flex items-center gap-2">
										<span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{mod.category}</span>
										<span className="text-[9px] text-zinc-600">v{mod.version}</span>
										<span className="text-[9px] text-zinc-600 font-mono">@vibexe/{mod.id}</span>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Save Button */}
			<div className="p-3 border-t border-white/[0.08]">
				<button
					type="button"
					onClick={handleSave}
					disabled={saveStatus === "saving"}
					className={`w-full py-2 rounded-lg text-white text-[11px] font-medium transition-colors ${
						saveStatus === "saved"
							? "bg-emerald-600"
							: saveStatus === "saving"
								? "bg-violet-600/60 cursor-wait"
								: "bg-violet-600 hover:bg-violet-500"
					}`}
				>
					{saveStatus === "saved" ? "Saved & Applied!" : saveStatus === "saving" ? "Saving..." : "Save & Apply"}
				</button>
			</div>
		</>
	);
}

/* ------------------------------------------------------------------ */
/*  Main Panel (standalone with header + close)                        */
/* ------------------------------------------------------------------ */

export function GameSettingsPanel({ settings, onChange, onSave, onClose }: GameSettingsPanelProps) {
	const handleReset = useCallback(() => {
		onChange({ ...DEFAULT_GAME_SETTINGS });
	}, [onChange]);

	return (
		<div data-game-editor-panel className="absolute top-0 right-0 bottom-0 w-[260px] bg-[#0f0f1a]/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-30 overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08]">
				<span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
					Game Settings
				</span>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={handleReset}
						className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
						title="Reset to Defaults"
					>
						<RotateCcw className="w-3.5 h-3.5" />
					</button>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
						title="Close Settings"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>
			<GameSettingsContent settings={settings} onChange={onChange} onSave={onSave} />
		</div>
	);
}
