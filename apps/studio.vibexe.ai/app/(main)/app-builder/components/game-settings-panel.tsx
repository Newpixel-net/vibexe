"use client";

/**
 * GameSettingsPanel — Configure 3D game parameters (player, physics, camera, environment).
 * Shares the 260px right sidebar with the scene editor panel.
 */

import { Camera, Crosshair, RotateCcw, Sun, User, X, Zap } from "lucide-react";
import { useCallback, useState } from "react";
import { DragNumberInput } from "./drag-number-input";
import { DEFAULT_GAME_SETTINGS, type GameSettings } from "../lib/game-editor-context";

type SettingsTab = "player" | "physics" | "camera" | "environment";

interface GameSettingsPanelProps {
	settings: GameSettings;
	onChange: (settings: GameSettings) => void;
	onSave: (settings: GameSettings) => void;
	onClose: () => void;
	pickSpawnActive?: boolean;
	pickRespawnActive?: boolean;
	onTogglePickSpawn?: () => void;
	onTogglePickRespawn?: () => void;
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

// Half-height of the player capsule — used to convert between body-center (stored) and feet (displayed)
const PLAYER_HALF_HEIGHT = 0.75;

export function GameSettingsPanel({ settings, onChange, onSave, onClose, pickSpawnActive, pickRespawnActive, onTogglePickSpawn, onTogglePickRespawn }: GameSettingsPanelProps) {
	const [activeTab, setActiveTab] = useState<SettingsTab>("player");

	const update = useCallback((section: string, field: string, value: any) => {
		const patched = deepMerge(settings, { [section]: { [field]: value } });
		onChange(patched);
	}, [settings, onChange]);

	const handleReset = useCallback(() => {
		onChange({ ...DEFAULT_GAME_SETTINGS });
	}, [onChange]);

	const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
		{ id: "player", label: "Player", icon: User },
		{ id: "physics", label: "Physics", icon: Zap },
		{ id: "camera", label: "Camera", icon: Camera },
		{ id: "environment", label: "Env", icon: Sun },
	];

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
						<div className="flex items-center justify-between">
							<SectionLabel>Spawn Position</SectionLabel>
							{onTogglePickSpawn && (
								<button
									type="button"
									onClick={onTogglePickSpawn}
									className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
										pickSpawnActive
											? "bg-violet-500/20 text-violet-300 border border-violet-400/40"
											: "text-white/30 hover:text-white/50 hover:bg-white/[0.06] border border-transparent"
									}`}
									title={pickSpawnActive ? "Stop picking — click to disable" : "Pick from scene — drag player to set spawn"}
								>
									<Crosshair className="w-3 h-3" />
									{pickSpawnActive ? "Picking..." : "Pick"}
								</button>
							)}
						</div>
						{pickSpawnActive && (
							<div className="text-[9px] text-violet-300/70 -mt-1 mb-1">
								Drag the player character to set spawn position
							</div>
						)}
						<DragNumberInput label="X" value={settings.player?.spawnX ?? 0} step={0.5} precision={1} onChange={(v) => update("player", "spawnX", v)} color="#e74c4c" />
						<DragNumberInput label="Y" value={(settings.player?.spawnY ?? 3) - PLAYER_HALF_HEIGHT} step={0.5} precision={1} onChange={(v) => update("player", "spawnY", v + PLAYER_HALF_HEIGHT)} color="#4ce74c" />
						<DragNumberInput label="Z" value={settings.player?.spawnZ ?? 0} step={0.5} precision={1} onChange={(v) => update("player", "spawnZ", v)} color="#4c7ce7" />

						<div className="flex items-center justify-between">
							<SectionLabel>Respawn Position</SectionLabel>
							{onTogglePickRespawn && (
								<button
									type="button"
									onClick={onTogglePickRespawn}
									className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
										pickRespawnActive
											? "bg-violet-500/20 text-violet-300 border border-violet-400/40"
											: "text-white/30 hover:text-white/50 hover:bg-white/[0.06] border border-transparent"
									}`}
									title={pickRespawnActive ? "Stop picking — click to disable" : "Pick from scene — drag player to set respawn"}
								>
									<Crosshair className="w-3 h-3" />
									{pickRespawnActive ? "Picking..." : "Pick"}
								</button>
							)}
						</div>
						{pickRespawnActive && (
							<div className="text-[9px] text-violet-300/70 -mt-1 mb-1">
								Drag the player character to set respawn position
							</div>
						)}
						<DragNumberInput label="X" value={settings.player?.respawnX ?? 0} step={0.5} precision={1} onChange={(v) => update("player", "respawnX", v)} color="#e74c4c" />
						<DragNumberInput label="Y" value={(settings.player?.respawnY ?? 5) - PLAYER_HALF_HEIGHT} step={0.5} precision={1} onChange={(v) => update("player", "respawnY", v + PLAYER_HALF_HEIGHT)} color="#4ce74c" />
						<DragNumberInput label="Z" value={settings.player?.respawnZ ?? 0} step={0.5} precision={1} onChange={(v) => update("player", "respawnZ", v)} color="#4c7ce7" />

						<SectionLabel>Lives</SectionLabel>
						<DragNumberInput label="Lives" value={settings.player?.startingLives ?? 3} step={1} precision={0} onChange={(v) => update("player", "startingLives", Math.max(1, Math.round(v)))} labelClassName="w-[60px] text-left" />
					</>
				)}

				{activeTab === "physics" && (
					<>
						<SectionLabel>Gravity</SectionLabel>
						<DragNumberInput label="Down" value={settings.physics?.gravity ?? -38} step={1} precision={0} onChange={(v) => update("physics", "gravity", v)} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Fall" value={settings.physics?.fallGravity ?? -65} step={1} precision={0} onChange={(v) => update("physics", "fallGravity", v)} labelClassName="w-[60px] text-left" />

						<SectionLabel>Movement</SectionLabel>
						<DragNumberInput label="Jump" value={settings.physics?.jumpForce ?? 17} step={0.5} precision={1} onChange={(v) => update("physics", "jumpForce", v)} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Walk" value={settings.physics?.moveSpeed ?? 6} step={0.5} precision={1} onChange={(v) => update("physics", "moveSpeed", v)} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Run" value={settings.physics?.runSpeed ?? 7.5} step={0.5} precision={1} onChange={(v) => update("physics", "runSpeed", v)} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Friction" value={settings.physics?.friction ?? 28} step={1} precision={0} onChange={(v) => update("physics", "friction", v)} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Coyote" value={settings.physics?.coyoteTime ?? 0.15} step={0.01} precision={2} onChange={(v) => update("physics", "coyoteTime", v)} labelClassName="w-[60px] text-left" />
					</>
				)}

				{activeTab === "camera" && (
					<>
						<SectionLabel>Position</SectionLabel>
						<DragNumberInput label="Offset Y" value={settings.camera?.offsetY ?? 8} step={0.5} precision={1} onChange={(v) => update("camera", "offsetY", v)} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Offset Z" value={settings.camera?.offsetZ ?? 12} step={0.5} precision={1} onChange={(v) => update("camera", "offsetZ", v)} labelClassName="w-[60px] text-left" />

						<SectionLabel>Lens</SectionLabel>
						<DragNumberInput label="FOV" value={settings.camera?.fov ?? 60} step={1} precision={0} onChange={(v) => update("camera", "fov", Math.max(20, Math.min(120, v)))} labelClassName="w-[60px] text-left" />

						<SectionLabel>Follow</SectionLabel>
						<DragNumberInput label="Lerp" value={settings.camera?.lerp ?? 3} step={0.5} precision={1} onChange={(v) => update("camera", "lerp", v)} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Ahead" value={settings.camera?.lookAhead ?? 5} step={0.5} precision={1} onChange={(v) => update("camera", "lookAhead", v)} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Look Y" value={settings.camera?.lookY ?? 1} step={0.5} precision={1} onChange={(v) => update("camera", "lookY", v)} labelClassName="w-[60px] text-left" />
					</>
				)}

				{activeTab === "environment" && (
					<>
						<SectionLabel>Background</SectionLabel>
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-white/50 w-[60px]">Color</span>
							<input
								type="color"
								value={settings.environment?.backgroundColor ?? "#87CEEB"}
								onChange={(e) => update("environment", "backgroundColor", e.target.value)}
								className="w-8 h-6 rounded border border-white/10 bg-transparent cursor-pointer"
							/>
							<span className="text-[10px] text-white/40 font-mono">
								{settings.environment?.backgroundColor ?? "#87CEEB"}
							</span>
						</div>

						<SectionLabel>Lighting</SectionLabel>
						<DragNumberInput label="Ambient" value={settings.environment?.ambientLightIntensity ?? 0.15} step={0.05} precision={2} onChange={(v) => update("environment", "ambientLightIntensity", Math.max(0, Math.min(2, v)))} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Sun" value={settings.environment?.sunLightIntensity ?? 0.55} step={0.05} precision={2} onChange={(v) => update("environment", "sunLightIntensity", Math.max(0, Math.min(2, v)))} labelClassName="w-[60px] text-left" />
						<DragNumberInput label="Hemi" value={settings.environment?.hemisphereIntensity ?? 0.35} step={0.05} precision={2} onChange={(v) => update("environment", "hemisphereIntensity", Math.max(0, Math.min(2, v)))} labelClassName="w-[60px] text-left" />

						<SectionLabel>Fog</SectionLabel>
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-white/50 w-[60px]">Enabled</span>
							<button
								type="button"
								onClick={() => update("environment", "fogEnabled", !(settings.environment?.fogEnabled ?? false))}
								className={`w-8 h-4 rounded-full transition-colors relative ${
									settings.environment?.fogEnabled ? "bg-violet-500" : "bg-white/10"
								}`}
							>
								<div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
									settings.environment?.fogEnabled ? "translate-x-4" : "translate-x-0.5"
								}`} />
							</button>
						</div>
						{settings.environment?.fogEnabled && (
							<>
								<DragNumberInput label="Near" value={settings.environment?.fogNear ?? 30} step={1} precision={0} onChange={(v) => update("environment", "fogNear", Math.max(1, v))} labelClassName="w-[60px] text-left" />
								<DragNumberInput label="Far" value={settings.environment?.fogFar ?? 100} step={1} precision={0} onChange={(v) => update("environment", "fogFar", Math.max(1, v))} labelClassName="w-[60px] text-left" />
							</>
						)}
					</>
				)}
			</div>

			{/* Save Button */}
			<div className="p-3 border-t border-white/[0.08]">
				<button
					type="button"
					onClick={() => onSave(settings)}
					className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-medium transition-colors"
				>
					Save & Apply
				</button>
			</div>
		</div>
	);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<div className="text-[10px] font-medium text-white/30 uppercase tracking-wider pt-1">
			{children}
		</div>
	);
}
