"use client";

import { useGameEditor } from "../lib/game-editor-context";

type ViewDirection = "front" | "back" | "left" | "right" | "top" | "bottom";

interface FaceDef {
	label: string;
	direction: ViewDirection;
	transform: string;
	color: string;
	hoverColor: string;
}

const FACES: FaceDef[] = [
	{ label: "F", direction: "front", transform: "translateZ(25px)", color: "rgba(88,130,235,0.85)", hoverColor: "rgba(88,130,235,1)" },
	{ label: "B", direction: "back", transform: "rotateY(180deg) translateZ(25px)", color: "rgba(88,130,235,0.5)", hoverColor: "rgba(88,130,235,0.8)" },
	{ label: "R", direction: "right", transform: "rotateY(90deg) translateZ(25px)", color: "rgba(235,88,88,0.85)", hoverColor: "rgba(235,88,88,1)" },
	{ label: "L", direction: "left", transform: "rotateY(-90deg) translateZ(25px)", color: "rgba(235,88,88,0.5)", hoverColor: "rgba(235,88,88,0.8)" },
	{ label: "T", direction: "top", transform: "rotateX(90deg) translateZ(25px)", color: "rgba(88,200,88,0.85)", hoverColor: "rgba(88,200,88,1)" },
	{ label: "Bo", direction: "bottom", transform: "rotateX(-90deg) translateZ(25px)", color: "rgba(88,200,88,0.5)", hoverColor: "rgba(88,200,88,0.8)" },
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
	const { cameraQuaternion, snapCameraToView } = useGameEditor();
	const cubeTransform = quaternionToMatrix3d(cameraQuaternion);

	return (
		<div
			className="absolute top-3 right-[276px] z-50 select-none"
			style={{ width: 80, height: 80, perspective: 300 }}
		>
			{/* Cube container */}
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
			</div>

			{/* Axis lines */}
			<svg
				width={80}
				height={80}
				className="absolute top-0 left-0 pointer-events-none"
				style={{ opacity: 0.6 }}
			>
				{/* X axis (red) */}
				<line x1={40} y1={40} x2={68} y2={40} stroke="#ef4444" strokeWidth={1.5} />
				<text x={70} y={43} fill="#ef4444" fontSize={9} fontWeight={600} fontFamily="ui-monospace, monospace">X</text>
				{/* Y axis (green) */}
				<line x1={40} y1={40} x2={40} y2={12} stroke="#22c55e" strokeWidth={1.5} />
				<text x={37} y={10} fill="#22c55e" fontSize={9} fontWeight={600} fontFamily="ui-monospace, monospace">Y</text>
				{/* Z axis (blue) */}
				<line x1={40} y1={40} x2={20} y2={56} stroke="#3b82f6" strokeWidth={1.5} />
				<text x={12} y={62} fill="#3b82f6" fontSize={9} fontWeight={600} fontFamily="ui-monospace, monospace">Z</text>
			</svg>
		</div>
	);
}
