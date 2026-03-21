"use client";

import { useEffect, useRef } from "react";
import { Play, Pause, StepForward, RotateCcw, X, Circle, Square, Download } from "lucide-react";

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
	onPlay: () => void;
	onPause: () => void;
	onStep: () => void;
	onReset: () => void;
	onTimeScaleChange: (scale: number) => void;
	onStartRecording: () => void;
	onStopRecording: () => void;
	onClose: () => void;
}

export function GameCommandCenter({
	simulationState,
	timeScale,
	gameStats,
	recordingState,
	recordingDuration,
	recordingBlobUrl,
	onPlay,
	onPause,
	onStep,
	onReset,
	onTimeScaleChange,
	onStartRecording,
	onStopRecording,
	onClose,
}: GameCommandCenterProps) {
	const panelRef = useRef<HTMLDivElement>(null);

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
			style={{ width: 380 }}
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

			{/* Playback + Record + Time Scale */}
			<div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.08]">
				{/* Play */}
				<button
					type="button"
					onClick={onPlay}
					className={`p-1.5 rounded-lg transition-all ${
						isRunning
							? "bg-emerald-500/20 text-emerald-400"
							: "text-white/50 hover:bg-white/[0.08] hover:text-white/80"
					}`}
					title="Play"
				>
					<Play className="w-3.5 h-3.5" />
				</button>
				{/* Pause */}
				<button
					type="button"
					onClick={onPause}
					className={`p-1.5 rounded-lg transition-all ${
						isPaused
							? "bg-amber-500/20 text-amber-400"
							: "text-white/50 hover:bg-white/[0.08] hover:text-white/80"
					}`}
					title="Pause"
				>
					<Pause className="w-3.5 h-3.5" />
				</button>
				{/* Step */}
				<button
					type="button"
					onClick={onStep}
					disabled={!isPaused}
					className={`p-1.5 rounded-lg transition-all ${
						isPaused
							? "text-white/50 hover:bg-white/[0.08] hover:text-white/80"
							: "text-white/15 cursor-not-allowed"
					}`}
					title="Step Frame"
				>
					<StepForward className="w-3.5 h-3.5" />
				</button>
				{/* Reset */}
				<button
					type="button"
					onClick={onReset}
					className="p-1.5 rounded-lg text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all"
					title="Reset"
				>
					<RotateCcw className="w-3.5 h-3.5" />
				</button>

				{/* Divider */}
				<div className="w-px h-4 bg-white/[0.08] mx-0.5" />

				{/* Record / Stop */}
				{isRecording ? (
					<button
						type="button"
						onClick={onStopRecording}
						className="p-1.5 rounded-lg bg-red-500/20 text-red-400 transition-all animate-pulse"
						title="Stop Recording"
					>
						<Square className="w-3.5 h-3.5" />
					</button>
				) : (
					<button
						type="button"
						onClick={onStartRecording}
						className="p-1.5 rounded-lg text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all"
						title="Record"
					>
						<Circle className="w-3.5 h-3.5" />
					</button>
				)}

				{/* Recording duration */}
				{isRecording && (
					<span className="text-[10px] text-red-400 font-mono">
						{formatDuration(recordingDuration)}
					</span>
				)}

				{/* Download (when recording ready) */}
				{hasRecording && (
					<a
						href={recordingBlobUrl}
						download={`vibexe-recording-${Date.now()}.webm`}
						className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all"
						title="Download Recording"
					>
						<Download className="w-3.5 h-3.5" />
					</a>
				)}

				{/* Spacer */}
				<div className="flex-1" />

				{/* Time Scale */}
				<span className="text-[10px] text-white/40 mr-1">Speed</span>
				<input
					type="range"
					min={0.1}
					max={2.0}
					step={0.1}
					value={timeScale}
					onChange={(e) => onTimeScaleChange(Number.parseFloat(e.target.value))}
					className="w-16 h-1 accent-cyan-500 cursor-pointer"
				/>
				<span className="text-[10px] text-white/60 font-mono w-7 text-right">
					{timeScale.toFixed(1)}x
				</span>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-3 gap-x-3 gap-y-1 px-3 py-2 text-[10px]">
				<div className="flex items-center justify-between">
					<span className="text-white/35">FPS</span>
					<span className={`font-mono font-medium ${gameStats ? fpsColor(gameStats.fps) : "text-white/20"}`}>
						{gameStats?.fps ?? "--"}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-white/35">Draws</span>
					<span className="font-mono text-white/60">
						{gameStats?.drawCalls ?? "--"}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-white/35">Tris</span>
					<span className="font-mono text-white/60">
						{gameStats ? (gameStats.triangles >= 1000 ? `${(gameStats.triangles / 1000).toFixed(0)}K` : gameStats.triangles) : "--"}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-white/35">Geo</span>
					<span className="font-mono text-white/60">
						{gameStats?.geometries ?? "--"}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-white/35">Tex</span>
					<span className="font-mono text-white/60">
						{gameStats?.textures ?? "--"}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-white/35">Mem</span>
					<span className="font-mono text-white/60">
						{gameStats?.memory != null ? `${gameStats.memory}MB` : "--"}
					</span>
				</div>
			</div>
		</div>
	);
}
