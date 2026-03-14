"use client";

/**
 * ControllerConfigPanel — Full controller configuration UI.
 *
 * Replaces the inline controller section in game-settings-panel.tsx (lines 368-447)
 * with a comprehensive panel: preset management, per-platform input bindings,
 * abilities with tunable params, animation mapping, runner config, and camera tuning.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSettings } from "../lib/game-editor-context";
import { DragNumberInput } from "./drag-number-input";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ControllerMode = "orbit" | "runner" | "sidescroll" | "topdown" | "fps";
type CameraProfile = "orbit" | "chase" | "side" | "overhead" | "firstPerson";
type PlatformTab = "pc" | "mobile" | "console";

interface ControllerConfigPanelProps {
	settings: GameSettings;
	onChange: (settings: GameSettings) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Full preset defaults — mirrors GENRE_PRESETS from character-system runtime */
const PRESET_DEFAULTS: Record<string, Record<string, unknown>> = {
	rpg_adventure: { controllerMode: "orbit", cameraProfile: "orbit", walkSpeed: 4, runSpeed: 8, jumpForce: 8 },
	platformer: { controllerMode: "orbit", cameraProfile: "orbit", walkSpeed: 5, runSpeed: 10, jumpForce: 14, airControl: 0.5, abilities: { doubleJump: { enabled: true } } },
	endless_runner: { controllerMode: "runner", cameraProfile: "chase", walkSpeed: 5, runSpeed: 5, runner: { initialSpeed: 5, maxSpeed: 25, acceleration: 0.15, laneWidth: 3, laneCount: 3, laneSwitchSpeed: 5, smoothMovementTime: 0.1, roadConstraintMin: -2, roadConstraintMax: 2, touchDragEnabled: true, touchSensitivity: 1.0 } },
	sidescroller: { controllerMode: "sidescroll", cameraProfile: "side", walkSpeed: 5, jumpForce: 12, abilities: { wallSlide: { enabled: true, slideSpeed: 2, jumpForce: 10 } } },
	topdown_shooter: { controllerMode: "topdown", cameraProfile: "overhead", walkSpeed: 8, runSpeed: 12, abilities: { dash: { enabled: true, speed: 20, duration: 0.2, cooldown: 1.5 } } },
	parkour: { controllerMode: "orbit", cameraProfile: "orbit", runSpeed: 12, jumpForce: 16, stepHeight: 1.2, abilities: { doubleJump: { enabled: true }, wallSlide: { enabled: true, slideSpeed: 2, jumpForce: 12 }, dash: { enabled: true, speed: 25, duration: 0.15, cooldown: 1 } } },
	arena_fighter: { controllerMode: "orbit", cameraProfile: "orbit", walkSpeed: 6, abilities: { dash: { enabled: true, speed: 18, duration: 0.2, cooldown: 1.5 }, groundPound: { enabled: true, force: 30 } } },
	walking_sim: { controllerMode: "orbit", cameraProfile: "orbit", walkSpeed: 2, runSpeed: 4, jumpForce: 0 },
};

/** Compare current CC values against preset defaults, returns list of modified field names */
function getModifiedFields(cc: Record<string, unknown>, defaults: Record<string, unknown>): string[] {
	const modified: string[] = [];
	for (const key of Object.keys(defaults)) {
		if (key === "preset") continue;
		const defVal = defaults[key];
		const curVal = cc[key];
		if (defVal && typeof defVal === "object" && !Array.isArray(defVal)) {
			if (JSON.stringify(curVal || {}) !== JSON.stringify(defVal)) modified.push(key);
		} else if (curVal !== undefined && curVal !== defVal) {
			modified.push(key);
		}
	}
	return modified;
}

const PRESET_LABELS: Record<string, string> = {
	rpg_adventure: "RPG / Adventure",
	platformer: "Platformer",
	endless_runner: "Endless Runner",
	sidescroller: "Sidescroller",
	topdown_shooter: "Top-Down Shooter",
	parkour: "Parkour",
	arena_fighter: "Arena Fighter",
	walking_sim: "Walking Sim",
};

const MODE_LABELS: Record<ControllerMode, string> = {
	orbit: "Orbit (3rd Person)",
	runner: "Runner (Auto-Forward)",
	sidescroll: "Sidescroll (2D-style)",
	topdown: "Top-Down",
	fps: "First Person",
};

const CAMERA_LABELS: Record<CameraProfile, string> = {
	orbit: "Orbit",
	chase: "Chase (Behind)",
	side: "Side View",
	overhead: "Overhead",
	firstPerson: "First Person",
};

const DEFAULT_PC_BINDINGS = {
	forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD",
	jump: "Space", run: "ShiftLeft", crouch: "KeyC", dash: "KeyQ",
};

const DEFAULT_CONSOLE_BINDINGS = {
	forward: "LeftStickUp", back: "LeftStickDown", left: "LeftStickLeft", right: "LeftStickRight",
	jump: "A / Cross", run: "LT", crouch: "B / Circle", dash: "LB",
	camera: "RightStick",
};

const PC_ACTION_LABELS: Record<string, string> = {
	forward: "Forward", back: "Back", left: "Left", right: "Right",
	jump: "Jump", run: "Run", crouch: "Crouch", dash: "Dash",
};

const ANIM_STATES = ["idle", "walk", "run", "jump", "fall", "land", "dash", "wallSlide", "crouch", "groundPound"];

/** Human-readable key name from event.code */
function humanKey(code: string): string {
	if (code.startsWith("Key")) return code.slice(3);
	if (code === "Space") return "Space";
	if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
	if (code === "ControlLeft" || code === "ControlRight") return "Ctrl";
	if (code === "AltLeft" || code === "AltRight") return "Alt";
	if (code.startsWith("Arrow")) return code.slice(5);
	if (code.startsWith("Digit")) return code.slice(5);
	return code;
}

/* ------------------------------------------------------------------ */
/*  Utility: deepMerge (matches game-settings-panel pattern)           */
/* ------------------------------------------------------------------ */

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
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
	return (
		<div className="text-xs font-medium text-white/30 uppercase tracking-wider pt-1 flex items-center">
			{children}
			{tooltip && (
				<div className="group relative inline-flex ml-1">
					<svg className="w-3.5 h-3.5 text-zinc-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
						<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
					</svg>
					<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-[11px] text-zinc-300 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
						{tooltip}
						<div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-700" />
					</div>
				</div>
			)}
		</div>
	);
}

/** Collapsible section with toggle arrow */
function CollapsibleSection({ title, tooltip, defaultOpen = false, children }: {
	title: string; tooltip?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="w-full flex items-center gap-1 pt-1"
			>
				<svg
					className={`w-3 h-3 text-white/30 transition-transform ${open ? "rotate-90" : ""}`}
					fill="none" stroke="currentColor" viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
				</svg>
				<span className="text-xs font-medium text-white/30 uppercase tracking-wider">{title}</span>
				{tooltip && (
					<div className="group relative inline-flex ml-1">
						<svg className="w-3 h-3 text-zinc-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
						</svg>
						<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-[11px] text-zinc-300 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
							{tooltip}
						</div>
					</div>
				)}
			</button>
			{open && <div className="space-y-1.5 mt-1.5">{children}</div>}
		</div>
	);
}

/** Toggle card for abilities */
function AbilityCard({ label, enabled, onToggle, children }: {
	label: string; enabled: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode;
}) {
	const [expanded, setExpanded] = useState(false);
	return (
		<div className="rounded-md border border-white/[0.06] bg-white/[0.02] overflow-hidden">
			<div className="flex items-center gap-2 px-2 py-1.5">
				<button
					type="button"
					onClick={() => onToggle(!enabled)}
					className={`w-3.5 h-3.5 rounded border transition-colors flex items-center justify-center ${
						enabled
							? "bg-violet-500 border-violet-400"
							: "bg-transparent border-white/20"
					}`}
				>
					{enabled && (
						<svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
						</svg>
					)}
				</button>
				<span className="text-[11px] text-white/70 flex-1">{label}</span>
				{enabled && children && (
					<button type="button" onClick={() => setExpanded(!expanded)} className="p-0.5 text-white/30 hover:text-white/50">
						<svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
						</svg>
					</button>
				)}
			</div>
			{enabled && expanded && children && (
				<div className="px-2 pb-2 space-y-1 border-t border-white/[0.04]">{children}</div>
			)}
		</div>
	);
}

/** Select dropdown matching existing style */
function StyledSelect({ value, onChange, options, label }: {
	value: string; onChange: (v: string) => void;
	options: { value: string; label: string }[];
	label?: string;
}) {
	return (
		<div className="flex items-center gap-2">
			{label && <span className="text-xs text-white/50 w-[60px]">{label}</span>}
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 border border-zinc-700 focus:ring-1 focus:ring-violet-500 outline-none flex-1"
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>{o.label}</option>
				))}
			</select>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  PC Input Grid — Click-to-Rebind                                    */
/* ------------------------------------------------------------------ */

function PCInputGrid({ bindings, onChange }: {
	bindings: Record<string, string>;
	onChange: (bindings: Record<string, string>) => void;
}) {
	const [rebinding, setRebinding] = useState<string | null>(null);
	const listenerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

	// Clean up listener on unmount
	useEffect(() => {
		return () => {
			if (listenerRef.current) {
				document.removeEventListener("keydown", listenerRef.current);
			}
		};
	}, []);

	const startRebind = useCallback((action: string) => {
		// Remove previous listener
		if (listenerRef.current) {
			document.removeEventListener("keydown", listenerRef.current);
		}
		setRebinding(action);
		const handler = (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.code === "Escape") {
				setRebinding(null);
				document.removeEventListener("keydown", handler);
				listenerRef.current = null;
				return;
			}
			onChange({ ...bindings, [action]: e.code });
			setRebinding(null);
			document.removeEventListener("keydown", handler);
			listenerRef.current = null;
		};
		listenerRef.current = handler;
		document.addEventListener("keydown", handler);
	}, [bindings, onChange]);

	return (
		<div className="space-y-0.5">
			{Object.entries(PC_ACTION_LABELS).map(([action, label]) => (
				<div key={action} className="flex items-center gap-1">
					<span className="text-[10px] text-white/40 w-[50px]">{label}</span>
					<button
						type="button"
						onClick={() => startRebind(action)}
						className={`flex-1 text-[10px] px-2 py-0.5 rounded text-left transition-all ${
							rebinding === action
								? "bg-violet-500/20 border border-violet-400/50 text-violet-300 animate-pulse"
								: "bg-white/[0.04] border border-white/[0.06] text-white/60 hover:bg-white/[0.08]"
						}`}
					>
						{rebinding === action ? "Press a key..." : humanKey(bindings[action] || DEFAULT_PC_BINDINGS[action as keyof typeof DEFAULT_PC_BINDINGS] || "")}
					</button>
					{bindings[action] && bindings[action] !== DEFAULT_PC_BINDINGS[action as keyof typeof DEFAULT_PC_BINDINGS] && (
						<button
							type="button"
							onClick={() => {
								const updated = { ...bindings };
								delete updated[action];
								onChange(updated);
							}}
							className="text-white/20 hover:text-white/50 text-[9px] px-1"
							title="Reset to default"
						>
							x
						</button>
					)}
				</div>
			))}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Mobile Input Grid                                                  */
/* ------------------------------------------------------------------ */

function MobileInputGrid({ config, onChange }: {
	config: NonNullable<NonNullable<GameSettings["characterController"]>["platformInputs"]>["mobile"];
	onChange: (config: NonNullable<NonNullable<GameSettings["characterController"]>["platformInputs"]>["mobile"]) => void;
}) {
	const c = config || { moveMode: "joystick" as const, jumpGesture: "tap-right" as const, dashGesture: "swipe-right" as const, crouchGesture: "swipe-down" as const };

	const upd = (patch: Partial<typeof c>) => onChange({ ...c, ...patch } as typeof c);

	return (
		<div className="space-y-1.5">
			<StyledSelect
				label="Move"
				value={c.moveMode || "joystick"}
				onChange={(v) => upd({ moveMode: v as "joystick" | "dpad" })}
				options={[{ value: "joystick", label: "Joystick" }, { value: "dpad", label: "D-Pad" }]}
			/>
			<StyledSelect
				label="Jump"
				value={c.jumpGesture || "tap-right"}
				onChange={(v) => upd({ jumpGesture: v as any })}
				options={[
					{ value: "tap-right", label: "Tap Right" },
					{ value: "swipe-up", label: "Swipe Up" },
					{ value: "button", label: "Button" },
				]}
			/>
			<StyledSelect
				label="Dash"
				value={c.dashGesture || "swipe-right"}
				onChange={(v) => upd({ dashGesture: v as any })}
				options={[
					{ value: "swipe-right", label: "Swipe Right" },
					{ value: "double-tap", label: "Double-Tap" },
					{ value: "button", label: "Button" },
				]}
			/>
			<StyledSelect
				label="Crouch"
				value={c.crouchGesture || "swipe-down"}
				onChange={(v) => upd({ crouchGesture: v as any })}
				options={[
					{ value: "swipe-down", label: "Swipe Down" },
					{ value: "button", label: "Button" },
				]}
			/>
			<DragNumberInput
				label="Joy Size"
				value={c.joystickSize ?? 120}
				step={10}
				precision={0}
				onChange={(v) => upd({ joystickSize: Math.max(80, Math.min(160, Math.round(v))) })}
				labelClassName="w-[60px] text-left"
			/>
			<DragNumberInput
				label="Sens."
				value={c.touchSensitivity ?? 1.0}
				step={0.1}
				precision={1}
				onChange={(v) => upd({ touchSensitivity: Math.max(0.1, Math.min(3.0, v)) })}
				labelClassName="w-[60px] text-left"
			/>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Console Input Grid                                                 */
/* ------------------------------------------------------------------ */

function ConsoleInputGrid({ config, onChange }: {
	config: NonNullable<NonNullable<GameSettings["characterController"]>["platformInputs"]>["console"];
	onChange: (config: NonNullable<NonNullable<GameSettings["characterController"]>["platformInputs"]>["console"]) => void;
}) {
	const c = config || { ...DEFAULT_CONSOLE_BINDINGS, deadzone: 0.15 };
	const entries: [string, string][] = [
		["forward", "Forward"], ["back", "Back"], ["left", "Left"], ["right", "Right"],
		["jump", "Jump"], ["run", "Run"], ["crouch", "Crouch"], ["dash", "Dash"], ["camera", "Camera"],
	];

	return (
		<div className="space-y-1">
			{entries.map(([key, label]) => (
				<div key={key} className="flex items-center gap-1">
					<span className="text-[10px] text-white/40 w-[50px]">{label}</span>
					<span className="flex-1 text-[10px] text-white/50 bg-white/[0.04] rounded px-2 py-0.5 border border-white/[0.06]">
						{(c as any)[key] || DEFAULT_CONSOLE_BINDINGS[key as keyof typeof DEFAULT_CONSOLE_BINDINGS] || "—"}
					</span>
				</div>
			))}
			<DragNumberInput
				label="Deadzone"
				value={c?.deadzone ?? 0.15}
				step={0.01}
				precision={2}
				onChange={(v) => onChange({ ...c, deadzone: Math.max(0.05, Math.min(0.3, v)) } as any)}
				labelClassName="w-[60px] text-left"
			/>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Animation Map Grid                                                 */
/* ------------------------------------------------------------------ */

function AnimationMapGrid({ animMap, animClips, onChange }: {
	animMap: Record<string, string>;
	animClips: string[];
	onChange: (map: Record<string, string>) => void;
}) {
	return (
		<div className="space-y-0.5">
			{ANIM_STATES.map((state) => (
				<div key={state} className="flex items-center gap-1">
					<span className="text-[10px] text-white/40 w-[65px] capitalize">{state}</span>
					<select
						value={animMap[state] || ""}
						onChange={(e) => onChange({ ...animMap, [state]: e.target.value })}
						className="flex-1 bg-zinc-800 text-[10px] text-zinc-300 rounded px-1.5 py-0.5 border border-zinc-700 focus:ring-1 focus:ring-violet-500 outline-none"
					>
						<option value="">— auto —</option>
						{animClips.map((clip) => (
							<option key={clip} value={clip}>{clip}</option>
						))}
					</select>
				</div>
			))}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Main: ControllerConfigPanel                                        */
/* ------------------------------------------------------------------ */

export function ControllerConfigPanel({ settings, onChange }: ControllerConfigPanelProps) {
	const cc = settings.characterController || {};
	const [platformTab, setPlatformTab] = useState<PlatformTab>("pc");
	const [animClips, setAnimClips] = useState<string[]>([]);
	const [savingPreset, setSavingPreset] = useState(false);
	const [presetName, setPresetName] = useState("");

	// Listen for animation clips from iframe
	useEffect(() => {
		function handleMsg(ev: MessageEvent) {
			if (ev.data?.type === "vibexe-character-swapped" && ev.data.animClips) {
				setAnimClips(ev.data.animClips);
			}
		}
		window.addEventListener("message", handleMsg);
		return () => window.removeEventListener("message", handleMsg);
	}, []);

	const patchCC = useCallback((patch: Record<string, unknown>) => {
		// Pass ONLY { characterController: merged } to updateGameSettings.
		// Previously passed full settings via deepMerge which triggered unintended
		// side effects (character-system-swap on every change) and stale-closure overwrites.
		const currentCC = settings.characterController || {};
		const mergedCC = deepMerge(currentCC, patch);
		onChange({ characterController: mergedCC } as any);
	}, [settings, onChange]);

	const mode = cc.controllerMode || "orbit";
	const camera = cc.cameraProfile || "orbit";
	const preset = cc.preset || "";

	// Check if any values differ from base preset (compares all fields)
	const presetDefaults = preset ? PRESET_DEFAULTS[preset] : null;
	const modifiedFields = presetDefaults ? getModifiedFields(cc as Record<string, unknown>, presetDefaults) : [];
	const isModified = modifiedFields.length > 0;

	// Custom presets
	const customPresets = cc.customPresets || {};

	return (
		<div className="space-y-2">
			{/* ── Preset ── */}
			<SectionLabel tooltip="Genre preset auto-fills mode, camera, and movement values">Controller</SectionLabel>
			<div className="flex items-center gap-2">
				<span className="text-xs text-white/50 w-[60px]">Preset</span>
				<div className="flex-1 flex items-center gap-1">
					<select
						value={preset}
						onChange={(e) => {
							const p = e.target.value;
							if (!p) {
								patchCC({ preset: undefined });
							} else {
								const fill = PRESET_DEFAULTS[p] || {};
								patchCC({ preset: p, ...fill });
							}
						}}
						className="bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 border border-zinc-700 focus:ring-1 focus:ring-violet-500 outline-none flex-1"
					>
						<option value="">Custom</option>
						{Object.entries(PRESET_LABELS).map(([k, label]) => (
							<option key={k} value={k}>{label}</option>
						))}
						{Object.keys(customPresets).length > 0 && (
							<>
								<option disabled>──────────</option>
								{Object.entries(customPresets).map(([id, cp]) => (
									<option key={id} value={id}>{cp.name}</option>
								))}
							</>
						)}
					</select>
					{isModified && (
						<div className="group relative inline-flex">
							<span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 whitespace-nowrap cursor-help">
								Modified
							</span>
							<div className="absolute bottom-full right-0 mb-1.5 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-[10px] text-zinc-300 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
								Changed: {modifiedFields.join(", ")}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Save Custom Preset */}
			{savingPreset ? (
				<div className="flex items-center gap-1">
					<input
						type="text"
						value={presetName}
						onChange={(e) => setPresetName(e.target.value)}
						placeholder="Preset name..."
						className="flex-1 bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 border border-zinc-700 outline-none focus:border-violet-500"
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Escape") { setSavingPreset(false); setPresetName(""); }
							if (e.key === "Enter" && presetName.trim()) {
								const id = presetName.trim().toLowerCase().replace(/\s+/g, "_");
								const { customPresets: _cp, preset: _p, ...configSnapshot } = cc;
								patchCC({
									customPresets: {
										...customPresets,
										[id]: { name: presetName.trim(), basePreset: preset || undefined, config: configSnapshot },
									},
									preset: id,
								});
								setSavingPreset(false);
								setPresetName("");
							}
						}}
					/>
					<button
						type="button"
						onClick={() => {
							if (presetName.trim()) {
								const id = presetName.trim().toLowerCase().replace(/\s+/g, "_");
								const { customPresets: _cp, preset: _p, ...configSnapshot } = cc;
								patchCC({
									customPresets: {
										...customPresets,
										[id]: { name: presetName.trim(), basePreset: preset || undefined, config: configSnapshot },
									},
									preset: id,
								});
							}
							setSavingPreset(false);
							setPresetName("");
						}}
						className="text-[10px] px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors"
					>
						Save
					</button>
					<button
						type="button"
						onClick={() => { setSavingPreset(false); setPresetName(""); }}
						className="text-[10px] px-1.5 py-1 text-white/40 hover:text-white/60"
					>
						x
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setSavingPreset(true)}
					className="w-full text-[10px] py-1 rounded bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60 transition-colors"
				>
					Save as Custom Preset
				</button>
			)}

			{/* Reset to Defaults */}
			{preset && presetDefaults && isModified && (
				<button
					type="button"
					onClick={() => patchCC({ ...presetDefaults })}
					className="w-full text-[10px] py-1 rounded bg-white/[0.03] text-white/30 hover:bg-white/[0.06] hover:text-white/50 transition-colors"
				>
					Reset to Preset Defaults
				</button>
			)}

			{/* ── Mode + Camera ── */}
			<StyledSelect
				label="Mode"
				value={mode}
				onChange={(v) => patchCC({ controllerMode: v })}
				options={Object.entries(MODE_LABELS).map(([k, label]) => ({ value: k, label }))}
			/>
			<StyledSelect
				label="Camera"
				value={camera}
				onChange={(v) => patchCC({ cameraProfile: v })}
				options={Object.entries(CAMERA_LABELS).map(([k, label]) => ({ value: k, label }))}
			/>

			{/* ── Movement ── */}
			<SectionLabel tooltip="Movement speed and jump parameters">Movement</SectionLabel>
			<DragNumberInput label="Walk" value={cc.walkSpeed ?? 4} step={0.5} precision={1} onChange={(v) => patchCC({ walkSpeed: v })} labelClassName="w-[60px] text-left" />
			<DragNumberInput label="Run" value={cc.runSpeed ?? 8} step={0.5} precision={1} onChange={(v) => patchCC({ runSpeed: v })} labelClassName="w-[60px] text-left" />
			<DragNumberInput label="Jump" value={cc.jumpForce ?? 8} step={0.5} precision={1} onChange={(v) => patchCC({ jumpForce: v })} labelClassName="w-[60px] text-left" />
			<DragNumberInput label="Jumps" value={cc.jumpCount ?? 1} step={1} precision={0} onChange={(v) => patchCC({ jumpCount: Math.max(1, Math.round(v)) })} labelClassName="w-[60px] text-left" />

			{/* ── Physics Feel ── */}
			<SectionLabel tooltip="Physics-feel tuning (acceleration, air control, slopes)">Physics Feel</SectionLabel>
			<DragNumberInput label="Accel" value={cc.accelGround ?? 20} step={1} precision={0} onChange={(v) => patchCC({ accelGround: v })} labelClassName="w-[60px] text-left" />
			<DragNumberInput label="Decel" value={cc.decelGround ?? 15} step={1} precision={0} onChange={(v) => patchCC({ decelGround: v })} labelClassName="w-[60px] text-left" />
			<DragNumberInput label="Air Ctrl" value={cc.airControl ?? 0.3} step={0.05} precision={2} onChange={(v) => patchCC({ airControl: Math.max(0, Math.min(1, v)) })} labelClassName="w-[60px] text-left" />
			<DragNumberInput label="Max Slope" value={cc.slopeMaxAngle ?? 45} step={1} precision={0} onChange={(v) => patchCC({ slopeMaxAngle: Math.max(10, Math.min(80, v)) })} labelClassName="w-[60px] text-left" />
			<DragNumberInput label="Gravity" value={cc.gravityScale ?? 1} step={0.1} precision={1} onChange={(v) => patchCC({ gravityScale: v })} labelClassName="w-[60px] text-left" />

			{/* ── Platform Input Bindings (Collapsible) ── */}
			<CollapsibleSection title="Input Bindings" tooltip="Per-platform control bindings">
				<div className="flex border-b border-white/[0.06] mb-1.5">
					{(["pc", "mobile", "console"] as PlatformTab[]).map((tab) => (
						<button
							key={tab}
							type="button"
							onClick={() => setPlatformTab(tab)}
							className={`flex-1 text-[10px] py-1 uppercase tracking-wider transition-colors ${
								platformTab === tab
									? "text-violet-400 border-b border-violet-400"
									: "text-white/30 hover:text-white/50"
							}`}
						>
							{tab}
						</button>
					))}
				</div>

				{platformTab === "pc" && (
					<PCInputGrid
						bindings={cc.platformInputs?.pc || { ...DEFAULT_PC_BINDINGS }}
						onChange={(bindings) => patchCC({ platformInputs: { ...cc.platformInputs, pc: bindings } })}
					/>
				)}
				{platformTab === "mobile" && (
					<MobileInputGrid
						config={cc.platformInputs?.mobile}
						onChange={(config) => patchCC({ platformInputs: { ...cc.platformInputs, mobile: config } })}
					/>
				)}
				{platformTab === "console" && (
					<ConsoleInputGrid
						config={cc.platformInputs?.console}
						onChange={(config) => patchCC({ platformInputs: { ...cc.platformInputs, console: config } })}
					/>
				)}
			</CollapsibleSection>

			{/* ── Abilities (Collapsible) ── */}
			<CollapsibleSection title="Abilities" tooltip="Enable special movement abilities with tunable parameters">
				<AbilityCard
					label="Double Jump"
					enabled={cc.abilities?.doubleJump?.enabled ?? false}
					onToggle={(v) => patchCC({ abilities: { ...cc.abilities, doubleJump: { ...cc.abilities?.doubleJump, enabled: v } } })}
				>
					<DragNumberInput label="Max Jumps" value={cc.abilities?.doubleJump?.maxJumps ?? 2} step={1} precision={0} onChange={(v) => patchCC({ abilities: { ...cc.abilities, doubleJump: { ...cc.abilities?.doubleJump, enabled: true, maxJumps: Math.max(2, Math.round(v)) } } })} labelClassName="w-[65px] text-left" />
				</AbilityCard>

				<AbilityCard
					label="Dash"
					enabled={cc.abilities?.dash?.enabled ?? false}
					onToggle={(v) => patchCC({ abilities: { ...cc.abilities, dash: { ...cc.abilities?.dash, enabled: v } } })}
				>
					<DragNumberInput label="Speed" value={cc.abilities?.dash?.speed ?? 20} step={1} precision={0} onChange={(v) => patchCC({ abilities: { ...cc.abilities, dash: { ...cc.abilities?.dash, enabled: true, speed: v } } })} labelClassName="w-[65px] text-left" />
					<DragNumberInput label="Duration" value={cc.abilities?.dash?.duration ?? 0.2} step={0.05} precision={2} onChange={(v) => patchCC({ abilities: { ...cc.abilities, dash: { ...cc.abilities?.dash, enabled: true, duration: Math.max(0.05, v) } } })} labelClassName="w-[65px] text-left" />
					<DragNumberInput label="Cooldown" value={cc.abilities?.dash?.cooldown ?? 1.5} step={0.1} precision={1} onChange={(v) => patchCC({ abilities: { ...cc.abilities, dash: { ...cc.abilities?.dash, enabled: true, cooldown: Math.max(0.1, v) } } })} labelClassName="w-[65px] text-left" />
				</AbilityCard>

				<AbilityCard
					label="Wall Slide"
					enabled={cc.abilities?.wallSlide?.enabled ?? false}
					onToggle={(v) => patchCC({ abilities: { ...cc.abilities, wallSlide: { ...cc.abilities?.wallSlide, enabled: v } } })}
				>
					<DragNumberInput label="Slide Spd" value={cc.abilities?.wallSlide?.slideSpeed ?? 2} step={0.5} precision={1} onChange={(v) => patchCC({ abilities: { ...cc.abilities, wallSlide: { ...cc.abilities?.wallSlide, enabled: true, slideSpeed: v } } })} labelClassName="w-[65px] text-left" />
					<DragNumberInput label="Jump Frc" value={cc.abilities?.wallSlide?.jumpForce ?? 10} step={1} precision={0} onChange={(v) => patchCC({ abilities: { ...cc.abilities, wallSlide: { ...cc.abilities?.wallSlide, enabled: true, jumpForce: v } } })} labelClassName="w-[65px] text-left" />
				</AbilityCard>

				<AbilityCard
					label="Crouch"
					enabled={cc.abilities?.crouch?.enabled ?? false}
					onToggle={(v) => patchCC({ abilities: { ...cc.abilities, crouch: { ...cc.abilities?.crouch, enabled: v } } })}
				>
					<DragNumberInput label="Speed Mult" value={cc.abilities?.crouch?.speedMultiplier ?? 0.4} step={0.05} precision={2} onChange={(v) => patchCC({ abilities: { ...cc.abilities, crouch: { ...cc.abilities?.crouch, enabled: true, speedMultiplier: Math.max(0.1, Math.min(1.0, v)) } } })} labelClassName="w-[65px] text-left" />
				</AbilityCard>

				<AbilityCard
					label="Ground Pound"
					enabled={cc.abilities?.groundPound?.enabled ?? false}
					onToggle={(v) => patchCC({ abilities: { ...cc.abilities, groundPound: { ...cc.abilities?.groundPound, enabled: v } } })}
				>
					<DragNumberInput label="Force" value={cc.abilities?.groundPound?.force ?? 30} step={5} precision={0} onChange={(v) => patchCC({ abilities: { ...cc.abilities, groundPound: { ...cc.abilities?.groundPound, enabled: true, force: Math.max(5, v) } } })} labelClassName="w-[65px] text-left" />
				</AbilityCard>
			</CollapsibleSection>

			{/* ── Camera (Collapsible) ── */}
			<CollapsibleSection title="Camera" tooltip="Camera distance, height, and smoothing">
				<DragNumberInput label="Distance" value={cc.camDist ?? 12} step={0.5} precision={1} onChange={(v) => patchCC({ camDist: Math.max(2, Math.min(30, v)) })} labelClassName="w-[60px] text-left" />
				<DragNumberInput label="Height" value={cc.camHeight ?? 8} step={0.5} precision={1} onChange={(v) => patchCC({ camHeight: Math.max(1, Math.min(25, v)) })} labelClassName="w-[60px] text-left" />
				<DragNumberInput label="Smooth" value={cc.camSmoothTime ?? 0.12} step={0.02} precision={2} onChange={(v) => patchCC({ camSmoothTime: Math.max(0.01, Math.min(1, v)) })} labelClassName="w-[60px] text-left" />
				<DragNumberInput label="Look Y" value={cc.camLookY ?? 1.2} step={0.1} precision={1} onChange={(v) => patchCC({ camLookY: v })} labelClassName="w-[60px] text-left" />
			</CollapsibleSection>

			{/* ── Animation Map (Collapsible) ── */}
			<CollapsibleSection title="Animation Map" tooltip="Map animation states to clip names">
				<AnimationMapGrid
					animMap={cc.animationMap || {}}
					animClips={animClips}
					onChange={(map) => patchCC({ animationMap: map })}
				/>
			</CollapsibleSection>

			{/* ── Runner Config (only in runner mode) ── */}
			{mode === "runner" && (
				<CollapsibleSection title="Runner" tooltip="Runner-specific settings: speed, lanes, constraints" defaultOpen={true}>
					<DragNumberInput label="Start Spd" value={cc.runner?.initialSpeed ?? 5} step={0.5} precision={1} onChange={(v) => patchCC({ runner: { ...cc.runner, initialSpeed: Math.max(1, v) } })} labelClassName="w-[60px] text-left" />
					<DragNumberInput label="Max Spd" value={cc.runner?.maxSpeed ?? 25} step={1} precision={0} onChange={(v) => patchCC({ runner: { ...cc.runner, maxSpeed: Math.max(5, v) } })} labelClassName="w-[60px] text-left" />
					<DragNumberInput label="Accel" value={cc.runner?.acceleration ?? 0.15} step={0.01} precision={2} onChange={(v) => patchCC({ runner: { ...cc.runner, acceleration: Math.max(0.01, v) } })} labelClassName="w-[60px] text-left" />
					<DragNumberInput label="Lanes" value={cc.runner?.laneCount ?? 3} step={2} precision={0} onChange={(v) => patchCC({ runner: { ...cc.runner, laneCount: Math.max(1, Math.min(7, Math.round(v))) } })} labelClassName="w-[60px] text-left" />
					<DragNumberInput label="Lane W" value={cc.runner?.laneWidth ?? 3} step={0.5} precision={1} onChange={(v) => patchCC({ runner: { ...cc.runner, laneWidth: Math.max(1, v) } })} labelClassName="w-[60px] text-left" />
					<DragNumberInput label="Smooth" value={cc.runner?.smoothMovementTime ?? 0.1} step={0.01} precision={2} onChange={(v) => patchCC({ runner: { ...cc.runner, smoothMovementTime: Math.max(0.01, Math.min(1, v)) } })} labelClassName="w-[60px] text-left" />
					<DragNumberInput label="Road Min" value={cc.runner?.roadConstraintMin ?? -2} step={0.5} precision={1} onChange={(v) => patchCC({ runner: { ...cc.runner, roadConstraintMin: v } })} labelClassName="w-[60px] text-left" />
					<DragNumberInput label="Road Max" value={cc.runner?.roadConstraintMax ?? 2} step={0.5} precision={1} onChange={(v) => patchCC({ runner: { ...cc.runner, roadConstraintMax: v } })} labelClassName="w-[60px] text-left" />
					<div className="flex items-center gap-2">
						<span className="text-xs text-white/50 w-[60px]">Touch Drag</span>
						<button
							type="button"
							onClick={() => patchCC({ runner: { ...cc.runner, touchDragEnabled: !(cc.runner?.touchDragEnabled ?? true) } })}
							className={`w-3.5 h-3.5 rounded border transition-colors flex items-center justify-center ${
								(cc.runner?.touchDragEnabled ?? true)
									? "bg-violet-500 border-violet-400"
									: "bg-transparent border-white/20"
							}`}
						>
							{(cc.runner?.touchDragEnabled ?? true) && (
								<svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
								</svg>
							)}
						</button>
					</div>
					<DragNumberInput label="Touch Sns" value={cc.runner?.touchSensitivity ?? 1.0} step={0.1} precision={1} onChange={(v) => patchCC({ runner: { ...cc.runner, touchSensitivity: Math.max(0.1, Math.min(3.0, v)) } })} labelClassName="w-[60px] text-left" />
				</CollapsibleSection>
			)}
		</div>
	);
}
