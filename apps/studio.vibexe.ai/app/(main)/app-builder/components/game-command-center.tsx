"use client";

import { useEffect, useRef, useState } from "react";
import {
	Play, Pause, StepForward, RotateCcw, X,
	Circle, Square, Download, Camera, Maximize2, Minimize2,
} from "lucide-react";
import type { QualityPreset } from "../lib/game-editor-context";

interface GameStats {
	fps: number;
	drawCalls: number;
	triangles: number;
	geometries: number;
	textures: number;
	memory: number;
}

interface GameCommandCenterProps {
	simulationState: "running" | "paused" | "stopped";
	timeScale: number;
	gameStats: GameStats | null;
	recordingState: "idle" | "recording" | "ready";
	recordingDuration: number;
	recordingBlobUrl: string | null;
	qualityPreset: QualityPreset;
	maximizeOnPlay: boolean;
	is2D?: boolean;
	onPlay: () => void;
	onPause: () => void;
	onStep: () => void;
	onReset: () => void;
	onTimeScaleChange: (scale: number) => void;
	onStartRecording: () => void;
	onStopRecording: () => void;
	onScreenshot: () => void;
	onQualityChange: (preset: QualityPreset) => void;
	onToggleMaximize: () => void;
	onClose: () => void;
}

const QUALITY_OPTIONS: { value: QualityPreset; label: string }[] = [
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Med" },
	{ value: "high", label: "High" },
	{ value: "ultra", label: "Ultra" },
];

export function GameCommandCenter({
	simulationState,
	timeScale,
	gameStats,
	recordingState,
	recordingDuration,
	recordingBlobUrl,
	qualityPreset,
	maximizeOnPlay,
	onPlay,
	onPause,
	onStep,
	onReset,
	onTimeScaleChange,
	onStartRecording,
	onStopRecording,
	onScreenshot,
	onQualityChange,
	onToggleMaximize,
	onClose,
	is2D = false,
}: GameCommandCenterProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const [qualityOpen, setQualityOpen] = useState(false);

	// Close on Escape
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	// Close on click outside
	useEffect(() => {
		const onClick = (e: MouseEvent) => {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		const timer = setTimeout(() => {
			window.addEventListener("mousedown", onClick);
		}, 100);
		return () => {
			clearTimeout(timer);
			window.removeEventListener("mousedown", onClick);
		};
	}, [onClose]);

	const isPaused = simulationState === "paused";
	const isRunning = simulationState === "running";
	const isRecording = recordingState === "recording";
	const hasRecording = recordingState === "ready" && !!recordingBlobUrl;

	const fpsColor = (fps: number) => {
		if (fps >= 60) return "text-emerald-400";
		if (fps >= 30) return "text-yellow-400";
		return "text-red-400";
	};

	const formatDuration = (ms: number) => {
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, "0")}`;
	};

	return (
		<div
			ref={panelRef}
			className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#0a0a14]/95 backdrop-blur-xl border border-white/[0.10] rounded-2xl shadow-2xl"
			style={{ width: 400 }}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08]">
				<span className="text-[11px] font-medium text-white/60 tracking-wide uppercase">
					Command Center
				</span>
				<button
					type="button"
					onClick={onClose}
					className="text-white/30 hover:text-white/70 transition-colors"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			{/* Row 1: Playback + Record + Time Scale */}
			<div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.08]">
				<button type="button" onClick={onPlay} className={`p-1.5 rounded-lg transition-all ${isRunning ? "bg-emerald-500/20 text-emerald-400" : "text-white/50 hover:bg-white/[0.08] hover:text-white/80"}`} title="Play">
					<Play className="w-3.5 h-3.5" />
				</button>
				<button type="button" onClick={onPause} className={`p-1.5 rounded-lg transition-all ${isPaused ? "bg-amber-500/20 text-amber-400" : "text-white/50 hover:bg-white/[0.08] hover:text-white/80"}`} title="Pause">
					<Pause className="w-3.5 h-3.5" />
				</button>
				<button type="button" onClick={onStep} disabled={!isPaused} className={`p-1.5 rounded-lg transition-all ${isPaused ? "text-white/50 hover:bg-white/[0.08] hover:text-white/80" : "text-white/15 cursor-not-allowed"}`} title="Step Frame">
					<StepForward className="w-3.5 h-3.5" />
				</button>
				<button type="button" onClick={onReset} className="p-1.5 rounded-lg text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all" title="Reset">
					<RotateCcw className="w-3.5 h-3.5" />
				</button>

				<div className="w-px h-4 bg-white/[0.08] mx-0.5" />

				{/* Record / Stop */}
				{isRecording ? (
					<button type="button" onClick={onStopRecording} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 transition-all animate-pulse" title="Stop Recording">
						<Square className="w-3.5 h-3.5" />
					</button>
				) : (
					<button type="button" onClick={onStartRecording} className="p-1.5 rounded-lg text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all" title="Record">
						<Circle className="w-3.5 h-3.5" />
					</button>
				)}
				{isRecording && <span className="text-[10px] text-red-400 font-mono">{formatDuration(recordingDuration)}</span>}
				{hasRecording && (
					<a href={recordingBlobUrl} download={`vibexe-recording-${Date.now()}.webm`} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all" title="Download Recording">
						<Download className="w-3.5 h-3.5" />
					</a>
				)}

				{/* Screenshot */}
				<button type="button" onClick={onScreenshot} className="p-1.5 rounded-lg text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all" title="Screenshot (PNG)">
					<Camera className="w-3.5 h-3.5" />
				</button>

				<div className="flex-1" />

				{/* Speed */}
				<span className="text-[10px] text-white/40 mr-1">Speed</span>
				<input type="range" min={0.1} max={2.0} step={0.1} value={timeScale} onChange={(e) => onTimeScaleChange(Number.parseFloat(e.target.value))} className="w-14 h-1 accent-cyan-500 cursor-pointer" />
				<span className="text-[10px] text-white/60 font-mono w-7 text-right">{timeScale.toFixed(1)}x</span>
			</div>

			{/* Row 2: Quality + Maximize + Stats */}
			<div className="flex items-center gap-2 px-3 py-2 text-[10px]">
				{/* Quality Preset — 3D only (shadow quality, texture resolution) */}
				{!is2D && (
					<div className="relative">
						<button
							type="button"
							onClick={() => setQualityOpen(!qualityOpen)}
							className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60 hover:text-white/80 hover:bg-white/[0.08] transition-all"
						>
							<span className="text-[10px]">{QUALITY_OPTIONS.find((q) => q.value === qualityPreset)?.label || "High"}</span>
							<svg className="w-2.5 h-2.5 opacity-50" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
						</button>
						{qualityOpen && (
							<div className="absolute bottom-full left-0 mb-1 bg-[#0a0a14] border border-white/[0.12] rounded-lg shadow-xl z-50 min-w-[70px] py-0.5">
								{QUALITY_OPTIONS.map((q) => (
									<button
										key={q.value}
										type="button"
										onClick={() => { onQualityChange(q.value); setQualityOpen(false); }}
										className={`w-full text-left px-2.5 py-1 text-[10px] transition-colors ${
											q.value === qualityPreset
												? "text-cyan-400 bg-cyan-500/10"
												: "text-white/60 hover:bg-white/[0.06] hover:text-white/80"
										}`}
									>
										{q.label}
									</button>
								))}
							</div>
						)}
					</div>
				)}

				{/* Maximize toggle */}
				<button
					type="button"
					onClick={onToggleMaximize}
					className={`p-1 rounded-md transition-all ${
						maximizeOnPlay
							? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
							: "text-white/40 hover:bg-white/[0.06] hover:text-white/70"
					}`}
					title={maximizeOnPlay ? "Restore preview size" : "Maximize on Play"}
				>
					{maximizeOnPlay ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
				</button>

				{/* Stats Grid — 2D shows FPS + Mem only, 3D shows full renderer stats */}
				{is2D ? (
					<div className="flex-1 flex items-center gap-4">
						<div className="flex items-center gap-1.5">
							<span className="text-white/35">FPS</span>
							<span className={`font-mono font-medium ${gameStats ? fpsColor(gameStats.fps) : "text-white/20"}`}>{gameStats?.fps ?? "--"}</span>
						</div>
						<div className="flex items-center gap-1.5">
							<span className="text-white/35">Mem</span>
							<span className="font-mono text-white/60">{gameStats?.memory != null ? `${gameStats.memory}MB` : "--"}</span>
						</div>
					</div>
				) : (
					<div className="flex-1 grid grid-cols-3 gap-x-3 gap-y-0.5">
						<div className="flex items-center justify-between">
							<span className="text-white/35">FPS</span>
							<span className={`font-mono font-medium ${gameStats ? fpsColor(gameStats.fps) : "text-white/20"}`}>{gameStats?.fps ?? "--"}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-white/35">Draws</span>
							<span className="font-mono text-white/60">{gameStats?.drawCalls ?? "--"}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-white/35">Tris</span>
							<span className="font-mono text-white/60">{gameStats ? (gameStats.triangles >= 1000 ? `${(gameStats.triangles / 1000).toFixed(0)}K` : gameStats.triangles) : "--"}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-white/35">Geo</span>
							<span className="font-mono text-white/60">{gameStats?.geometries ?? "--"}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-white/35">Tex</span>
							<span className="font-mono text-white/60">{gameStats?.textures ?? "--"}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-white/35">Mem</span>
							<span className="font-mono text-white/60">{gameStats?.memory != null ? `${gameStats.memory}MB` : "--"}</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
