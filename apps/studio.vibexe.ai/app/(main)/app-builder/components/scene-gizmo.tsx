"use client";

import { useGameEditor } from "../lib/game-editor-context";

type ViewDirection = "front" | "back" | "left" | "right" | "top" | "bottom";

interface FaceDef {
	label: string;
	direction: ViewDirection;
	transform: string;
	color: string;
}

const FACES: FaceDef[] = [
	{ label: "F", direction: "front", transform: "translateZ(25px)", color: "rgba(88,130,235,0.85)" },
	{ label: "B", direction: "back", transform: "rotateY(180deg) translateZ(25px)", color: "rgba(88,130,235,0.5)" },
	{ label: "R", direction: "right", transform: "rotateY(90deg) translateZ(25px)", color: "rgba(235,88,88,0.85)" },
	{ label: "L", direction: "left", transform: "rotateY(-90deg) translateZ(25px)", color: "rgba(235,88,88,0.5)" },
	{ label: "T", direction: "top", transform: "rotateX(90deg) translateZ(25px)", color: "rgba(88,200,88,0.85)" },
	{ label: "Bo", direction: "bottom", transform: "rotateX(-90deg) translateZ(25px)", color: "rgba(88,200,88,0.5)" },
];

// 3D axis tips — small colored spheres at the end of each axis
const AXIS_TIPS = [
	{ label: "X", color: "#ef4444", transform: "translateX(32px)" },
	{ label: "Y", color: "#22c55e", transform: "translateY(-32px)" },
	{ label: "Z", color: "#3b82f6", transform: "translateZ(32px)" },
];

function quaternionToMatrix3d(q: { x: number; y: number; z: number; w: number }): string {
	// Inverse quaternion (conjugate): negate x, y, z
	const ix = -q.x, iy = -q.y, iz = -q.z, iw = q.w;
	const m11 = 1 - 2 * (iy * iy + iz * iz), m12 = 2 * (ix * iy - iz * iw), m13 = 2 * (ix * iz + iy * iw);
	const m21 = 2 * (ix * iy + iz * iw), m22 = 1 - 2 * (ix * ix + iz * iz), m23 = 2 * (iy * iz - ix * iw);
	const m31 = 2 * (ix * iz - iy * iw), m32 = 2 * (iy * iz + ix * iw), m33 = 1 - 2 * (ix * ix + iy * iy);
	return `matrix3d(${m11},${m21},${m31},0, ${m12},${m22},${m32},0, ${m13},${m23},${m33},0, 0,0,0,1)`;
}

export function SceneGizmo() {
	const { cameraQuaternion, snapCameraToView, editorProjection, toggleEditorProjection } = useGameEditor();
	const isOrtho = editorProjection === "orthographic";
	const cubeTransform = quaternionToMatrix3d(cameraQuaternion);

	return (
		<div
			className="absolute top-3 right-[276px] z-50 select-none"
			style={{ width: 80, height: 100, perspective: 300 }}
		>
			{/* Cube + axis container — all 3D elements rotate together */}
			<div
				style={{
					width: 50,
					height: 50,
					position: "relative",
					margin: "15px auto 0",
					transformStyle: "preserve-3d",
					transform: cubeTransform,
					transition: "transform 0.1s ease-out",
				}}
			>
				{/* Cube faces */}
				{FACES.map((face) => (
					<button
						key={face.direction}
						type="button"
						onClick={() => snapCameraToView(face.direction)}
						title={face.direction.charAt(0).toUpperCase() + face.direction.slice(1)}
						className="absolute flex items-center justify-center transition-colors duration-100 hover:brightness-125"
						style={{
							width: 50,
							height: 50,
							transform: face.transform,
							backfaceVisibility: "hidden",
							background: face.color,
							border: "1px solid rgba(255,255,255,0.15)",
							borderRadius: 4,
							color: "white",
							fontSize: 11,
							fontWeight: 600,
							fontFamily: "ui-monospace, monospace",
							cursor: "pointer",
							padding: 0,
						}}
					>
						{face.label}
					</button>
				))}

				{/* 3D axis tip labels — rotate with the cube */}
				{AXIS_TIPS.map((axis) => (
					<div
						key={axis.label}
						className="absolute pointer-events-none"
						style={{
							width: 14,
							height: 14,
							top: "50%",
							left: "50%",
							marginTop: -7,
							marginLeft: -7,
							transform: axis.transform,
							background: axis.color,
							borderRadius: "50%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "white",
							fontSize: 8,
							fontWeight: 700,
							fontFamily: "ui-monospace, monospace",
						}}
					>
						{axis.label}
					</div>
				))}
			</div>
			{/* Persp/Ortho toggle label */}
			<button
				type="button"
				onClick={toggleEditorProjection}
				className="w-full mt-1 text-center cursor-pointer border-0 bg-transparent"
				style={{
					fontSize: 10,
					fontFamily: "ui-monospace, monospace",
					color: isOrtho ? "#fbbf24" : "rgba(255,255,255,0.5)",
					padding: 0,
					lineHeight: "14px",
				}}
				title={isOrtho ? "Switch to Perspective" : "Switch to Orthographic"}
			>
				{isOrtho ? "Ortho" : "Persp"}
			</button>
		</div>
	);
}
