"use client";

/**
 * CharacterSystemPanel — UI for the Character System module
 *
 * Controls: Character selection, ground offset, animation preview.
 * Communicates with the sandpack iframe via postMessage bridge.
 */

import {
	PersonStanding,
	Play,
	RotateCcw,
	Square,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSettings } from "../lib/game-editor-context";
import { DragNumberInput } from "./drag-number-input";

interface CharacterDef {
	id: string;
	name: string;
	description: string;
	pack: string;
	model: string;
	animations?: Record<string, string>;
}

const CHARACTERS: CharacterDef[] = [
	{
		id: "warrior",
		name: "Warrior",
		description: "Battle-ready warrior with combat animations",
		pack: "meshy-characters",
		model: "Warrior_figure_Animations.glb",
		animations: { idle: "idle", walk: "walk", run: "run", jump: "jump", attack: "kick", die: "dead", hit: "hit", special: "spin" },
	},
];

interface CharacterSystemPanelProps {
	sendToIframe: (msg: Record<string, unknown>) => void;
	onClose: () => void;
	settings: GameSettings;
	onChange: (config: CharacterConfig) => void;
	onSave: (config: CharacterConfig) => void;
}

interface CharacterConfig {
	id?: string;
	pack?: string;
	model?: string;
	groundOffset?: number;
	scale?: number;
}

export function CharacterSystemPanel({ sendToIframe, onClose, settings, onChange, onSave }: CharacterSystemPanelProps) {
	const charConfig = settings.character;
	const [config, setConfig] = useState<CharacterConfig>(() => ({
		id: charConfig?.id ?? undefined,
		pack: charConfig?.pack ?? undefined,
		model: charConfig?.model ?? undefined,
		groundOffset: charConfig?.groundOffset ?? 0,
		scale: charConfig?.scale ?? 1.0,
	}));

	const [animClips, setAnimClips] = useState<string[]>([]);
	const [currentClip, setCurrentClip] = useState<string | null>(null);

	const dirtyRef = useRef(false);
	const latestConfigRef = useRef(config);

	// Listen for character-swapped and animation info messages from iframe
	useEffect(() => {
		function handleMessage(ev: MessageEvent) {
			if (!ev.data) return;
			if (ev.data.type === "vibexe-character-swapped") {
				// Character was swapped in the iframe, request animation info
				sendToIframe({ type: "character-system-get-registry" });
			}
			if (ev.data.type === "vibexe-character-registry") {
				// Update character list from iframe registry (future expansion)
			}
		}
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [sendToIframe]);

	// Request animation clips for the active character on mount
	useEffect(() => {
		// The character module stores clip names on the mesh userData
		// We read them from gameSettings or request from iframe
		const charDef = CHARACTERS.find((c) => c.id === config.id);
		if (charDef?.animations) {
			setAnimClips(Object.values(charDef.animations));
		}
	}, [config.id]);

	const updateConfig = useCallback((patch: Partial<CharacterConfig>) => {
		const merged = { ...config, ...patch };
		setConfig(merged);
		latestConfigRef.current = merged;
		dirtyRef.current = true;
		onChange(merged);
	}, [config, onChange]);

	const handleSelectCharacter = useCallback((charDef: CharacterDef) => {
		const newConfig: CharacterConfig = {
			id: charDef.id,
			pack: charDef.pack,
			model: charDef.model,
			groundOffset: config.groundOffset ?? 0,
			scale: config.scale ?? 1.0,
		};
		setConfig(newConfig);
		latestConfigRef.current = newConfig;
		dirtyRef.current = true;

		// Send swap command to iframe
		sendToIframe({
			type: "character-system-swap",
			characterId: charDef.id,
			origin: window.location.origin,
		});

		// Update animation clips
		if (charDef.animations) {
			setAnimClips(Object.values(charDef.animations));
		}

		onChange(newConfig);
	}, [config.groundOffset, config.scale, sendToIframe, onChange]);

	const handlePlayAnimation = useCallback((clipName: string) => {
		setCurrentClip(clipName);
		// The character system module handles animation via the mesh userData
		// We send a generic play command
		sendToIframe({
			type: "character-system-play-animation",
			clipName,
		});
	}, [sendToIframe]);

	const handleStopAnimation = useCallback(() => {
		setCurrentClip(null);
		sendToIframe({ type: "character-system-stop-animation" });
	}, [sendToIframe]);

	const activeChar = CHARACTERS.find((c) => c.id === config.id);

	return (
		<div className="absolute top-0 right-0 bottom-0 w-[260px] bg-[#0d0d0f]/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-30 select-none">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.08]">
				<div className="flex items-center gap-2">
					<PersonStanding className="w-4 h-4 text-violet-400" />
					<span className="text-xs font-semibold text-white/90">Character System</span>
				</div>
				<button
					type="button"
					onClick={() => {
						if (dirtyRef.current) onSave(latestConfigRef.current);
						onClose();
					}}
					className="p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
				{/* Character Picker */}
				<div>
					<label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Select Character</label>
					<div className="space-y-1">
						{CHARACTERS.map((charDef) => {
							const isActive = config.id === charDef.id;
							return (
								<button
									key={charDef.id}
									type="button"
									onClick={() => handleSelectCharacter(charDef)}
									className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
										isActive
											? "bg-violet-500/[0.15] text-violet-300 border border-violet-500/[0.25]"
											: "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70 border border-transparent"
									}`}
								>
									<PersonStanding className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-violet-400" : "text-white/30"}`} />
									<div className="flex-1 min-w-0">
										<div className="text-[11px] font-medium truncate">{charDef.name}</div>
										<div className="text-[9px] text-white/30 mt-0.5 truncate">{charDef.description}</div>
									</div>
									{isActive && <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />}
								</button>
							);
						})}
					</div>
				</div>

				{/* Active Character Info */}
				{activeChar && (
					<div className="border-t border-white/[0.06] pt-3">
						<div className="flex items-center gap-1.5 mb-2">
							<PersonStanding className="w-3 h-3 text-violet-400" />
							<span className="text-[10px] text-white/50 uppercase tracking-wider">Active: {activeChar.name}</span>
						</div>

						{/* Ground Offset */}
						<div className="mb-3">
							<label className="text-[10px] text-white/40 mb-1 block">Ground Offset</label>
							<DragNumberInput
								label="Y"
								value={config.groundOffset ?? 0}
								step={0.05}
								precision={2}
								color="#8b5cf6"
								onChange={(v) => {
									updateConfig({ groundOffset: v });
									sendToIframe({ type: "character-system-set-ground-offset", groundOffset: v });
								}}
							/>
						</div>

						{/* Scale */}
						<div className="mb-3">
							<label className="text-[10px] text-white/40 mb-1 block">Scale</label>
							<DragNumberInput
								label="S"
								value={config.scale ?? 1.0}
								step={0.05}
								precision={2}
								color="#8b5cf6"
								onChange={(v) => {
									const clamped = Math.max(0.1, Math.min(5.0, v));
									updateConfig({ scale: clamped });
									sendToIframe({ type: "character-system-set-scale", scale: clamped });
								}}
							/>
						</div>
					</div>
				)}

				{/* Animation Clips */}
				{activeChar && animClips.length > 0 && (
					<div className="border-t border-white/[0.06] pt-3">
						<div className="flex items-center justify-between mb-2">
							<span className="text-[10px] text-white/40 uppercase tracking-wider">Animations</span>
							{currentClip && (
								<button
									type="button"
									onClick={handleStopAnimation}
									className="p-0.5 rounded hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors"
									title="Stop animation"
								>
									<Square className="w-3 h-3" />
								</button>
							)}
						</div>
						<div className="grid grid-cols-2 gap-1">
							{animClips.map((clipName) => {
								const isPlaying = currentClip === clipName;
								return (
									<button
										key={clipName}
										type="button"
										onClick={() => handlePlayAnimation(clipName)}
										className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg transition-all ${
											isPlaying
												? "bg-violet-500/[0.15] text-violet-300 border border-violet-500/[0.25]"
												: "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70"
										}`}
									>
										<Play className={`w-2.5 h-2.5 flex-shrink-0 ${isPlaying ? "text-violet-400" : "text-white/30"}`} />
										<span className="truncate capitalize">{clipName}</span>
									</button>
								);
							})}
						</div>
					</div>
				)}

				{/* No Character Selected */}
				{!activeChar && (
					<div className="text-center py-6">
						<PersonStanding className="w-8 h-8 text-white/15 mx-auto mb-2" />
						<p className="text-[10px] text-white/30">Select a character above to get started</p>
					</div>
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
							? "bg-violet-600 hover:bg-violet-500 text-white"
							: "bg-white/[0.06] text-white/30 cursor-default"
					}`}
				>
					Save & Apply
				</button>
				<button
					type="button"
					onClick={() => {
						const defaults: CharacterConfig = {
							id: undefined,
							pack: undefined,
							model: undefined,
							groundOffset: 0,
							scale: 1.0,
						};
						setConfig(defaults);
						latestConfigRef.current = defaults;
						dirtyRef.current = true;
						setCurrentClip(null);
						setAnimClips([]);
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
