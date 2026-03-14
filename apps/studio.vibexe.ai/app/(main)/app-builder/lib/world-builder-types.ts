// ─── World Builder Types ───
// Converted from Unity Prefab World Builder v4.10.0

export type WBTool =
	| "pin"
	| "brush"
	| "gravity"
	| "line"
	| "shape"
	| "tiling-floor"
	| "tiling-wall"
	| "replacer"
	| "eraser"
	| "select"
	| "extrude"
	| "mirror";

export type BrushShape = "point" | "circle" | "square";
export type FlipAction = "none" | "flip" | "random";
export type AvoidOverlapping = "disabled" | "palette" | "brush" | "same" | "all";
export type PaintMode = "auto" | "on-surface" | "on-grid";
export type PositionMode = "center" | "pivot" | "on-surface";
export type CellSizeType = "smallest" | "biggest" | "custom";
export type ShapeType = "circle" | "polygon";
export type LineSpacingType = "bounds" | "constant";
export type Axis = "x" | "y" | "z";
export type FrequencyMode = "random" | "sequential" | "pattern";

export interface WBRange {
	min: number;
	max: number;
}
export interface WBRange3 {
	x: WBRange;
	y: WBRange;
	z: WBRange;
}
export interface WBVec3 {
	x: number;
	y: number;
	z: number;
}

// ─── Brush Settings (shared per-brush properties) ───
export interface WBBrushSettings {
	surfaceDistance: number;
	randomSurfaceDistance: boolean;
	randomSurfaceDistanceRange: WBRange;
	embedInSurface: boolean;
	embedAtPivotHeight: boolean;
	localPositionOffset: WBVec3;
	rotateToSurface: boolean;
	eulerOffset: WBVec3;
	addRandomRotation: boolean;
	rotationFactor: number;
	rotateInMultiples: boolean;
	randomEulerOffset: WBRange3;
	alwaysOrientUp: boolean;
	separateScaleAxes: boolean;
	scaleMultiplier: WBVec3;
	randomScaleMultiplier: boolean;
	randomScaleMultiplierRange: WBRange3;
	flipX: FlipAction;
	flipY: FlipAction;
}

// ─── Per-tool settings ───
export interface WBBrushToolSettings {
	brushShape: BrushShape;
	radius: number;
	density: number;
	minSpacing: number;
	randomizePositions: boolean;
	orientAlongBrushstroke: boolean;
	avoidOverlapping: AvoidOverlapping;
	slopeFilter: WBRange;
	paintMode: PaintMode;
}

export interface WBPinSettings {
	repeat: boolean;
	flattenTerrain: boolean;
	avoidOverlapping: boolean;
}

export interface WBLineSettings {
	spacingType: LineSpacingType;
	gapSize: number;
	spacing: number;
	objectsOrientedAlongLine: boolean;
	axisOrientedAlongLine: Axis;
	closed: boolean;
}

export interface WBShapeSettings {
	shapeType: ShapeType;
	sidesCount: number;
	axisNormalToSurface: boolean;
	spacingType: LineSpacingType;
	gapSize: number;
	spacing: number;
	objectsOrientedAlongLine: boolean;
	axisOrientedAlongLine: Axis;
}

export interface WBTilingSettings {
	cellSizeType: CellSizeType;
	cellSize: { w: number; h: number };
	spacing: { w: number; h: number };
	axisAlignedWithNormal: Axis;
}

export interface WBExtrudeSettings {
	spacingType: "box-size" | "custom";
	spacing: WBVec3;
	multiplier: WBVec3;
	addRandomRotation: boolean;
	eulerOffset: WBVec3;
	randomEulerOffset: WBRange3;
}

export interface WBMirrorSettings {
	reflectRotation: boolean;
	action: "transform" | "create";
	invertScale: boolean;
}

export interface WBGravitySettings {
	height: number;
	mass: number;
	drag: number;
	maxIterations: number;
}

export interface WBEraserSettings {
	radius: number;
	onlyClosest: boolean;
}

export interface WBReplacerSettings {
	radius: number;
	keepTargetSize: boolean;
	maintainProportions: boolean;
	positionMode: PositionMode;
}

// ─── Grid / Snap ───
export interface WBSnapSettings {
	enabled: boolean;
	gridType: "rectangular" | "radial";
	step: WBVec3;
	origin: WBVec3;
	rotation: WBVec3;
	snappingOn: { x: boolean; y: boolean; z: boolean };
	showGrid: boolean;
	gridAxes: { x: boolean; y: boolean; z: boolean };
	radialStep: number;
	radialSectors: number;
	midpointSnapping: boolean;
}

// ─── Palette ───
export interface WBPaletteItem {
	id: string;
	name: string;
	modelPath: string;
	pack: string;
	category: string;
	thumbnailColor?: string;
	boundingBox?: WBVec3;
}

export interface WBBrush {
	id: string;
	name: string;
	items: WBPaletteItem[];
	settings: Partial<WBBrushSettings>;
	frequencyMode?: FrequencyMode;
	frequencyPattern?: string;
}

// ─── Placed Object (serialized) ───
export interface WBPlacedObject {
	id: string;
	brushItemId: string;
	modelPath: string;
	position: WBVec3;
	rotation: WBVec3;
	scale: WBVec3;
	parentGroup?: string;
	toolSource?: WBTool;
}

// ─── Scene extension ───
export interface WorldBuilderSceneData {
	placedObjects: WBPlacedObject[];
	gridSettings: WBSnapSettings;
	activePalette?: string;
	customBrushes?: WBBrush[];
}

// ─── Defaults ───
export const DEFAULT_BRUSH_SETTINGS: WBBrushSettings = {
	surfaceDistance: 0,
	randomSurfaceDistance: false,
	randomSurfaceDistanceRange: { min: -0.005, max: 0.005 },
	embedInSurface: false,
	embedAtPivotHeight: true,
	localPositionOffset: { x: 0, y: 0, z: 0 },
	rotateToSurface: true,
	eulerOffset: { x: 0, y: 0, z: 0 },
	addRandomRotation: false,
	rotationFactor: 90,
	rotateInMultiples: false,
	randomEulerOffset: {
		x: { min: -180, max: 180 },
		y: { min: -180, max: 180 },
		z: { min: -180, max: 180 },
	},
	alwaysOrientUp: false,
	separateScaleAxes: false,
	scaleMultiplier: { x: 1, y: 1, z: 1 },
	randomScaleMultiplier: false,
	randomScaleMultiplierRange: {
		x: { min: 0.8, max: 1.2 },
		y: { min: 0.8, max: 1.2 },
		z: { min: 0.8, max: 1.2 },
	},
	flipX: "none",
	flipY: "none",
};

export const DEFAULT_SNAP_SETTINGS: WBSnapSettings = {
	enabled: false,
	gridType: "rectangular",
	step: { x: 1, y: 1, z: 1 },
	origin: { x: 0, y: 0, z: 0 },
	rotation: { x: 0, y: 0, z: 0 },
	snappingOn: { x: true, y: false, z: true },
	showGrid: true,
	gridAxes: { x: false, y: true, z: false },
	radialStep: 1,
	radialSectors: 8,
	midpointSnapping: false,
};

export const DEFAULT_PIN_SETTINGS: WBPinSettings = {
	repeat: false,
	flattenTerrain: false,
	avoidOverlapping: false,
};

export const DEFAULT_BRUSH_TOOL_SETTINGS: WBBrushToolSettings = {
	brushShape: "circle",
	radius: 5,
	density: 50,
	minSpacing: 0.5,
	randomizePositions: true,
	orientAlongBrushstroke: false,
	avoidOverlapping: "all",
	slopeFilter: { min: 0, max: 60 },
	paintMode: "auto",
};

export const DEFAULT_LINE_SETTINGS: WBLineSettings = {
	spacingType: "bounds",
	gapSize: 0,
	spacing: 1,
	objectsOrientedAlongLine: true,
	axisOrientedAlongLine: "z",
	closed: false,
};

export const DEFAULT_SHAPE_SETTINGS: WBShapeSettings = {
	shapeType: "circle",
	sidesCount: 6,
	axisNormalToSurface: true,
	spacingType: "bounds",
	gapSize: 0,
	spacing: 1,
	objectsOrientedAlongLine: true,
	axisOrientedAlongLine: "z",
};

export const DEFAULT_TILING_SETTINGS: WBTilingSettings = {
	cellSizeType: "biggest",
	cellSize: { w: 1, h: 1 },
	spacing: { w: 0, h: 0 },
	axisAlignedWithNormal: "y",
};

export const DEFAULT_EXTRUDE_SETTINGS: WBExtrudeSettings = {
	spacingType: "box-size",
	spacing: { x: 1, y: 1, z: 1 },
	multiplier: { x: 1, y: 1, z: 1 },
	addRandomRotation: false,
	eulerOffset: { x: 0, y: 0, z: 0 },
	randomEulerOffset: {
		x: { min: 0, max: 0 },
		y: { min: 0, max: 0 },
		z: { min: 0, max: 0 },
	},
};

export const DEFAULT_MIRROR_SETTINGS: WBMirrorSettings = {
	reflectRotation: true,
	action: "create",
	invertScale: false,
};

export const DEFAULT_GRAVITY_SETTINGS: WBGravitySettings = {
	height: 10,
	mass: 1,
	drag: 0,
	maxIterations: 200,
};

export const DEFAULT_ERASER_SETTINGS: WBEraserSettings = {
	radius: 3,
	onlyClosest: false,
};

export const DEFAULT_REPLACER_SETTINGS: WBReplacerSettings = {
	radius: 3,
	keepTargetSize: true,
	maintainProportions: true,
	positionMode: "center",
};

export const DEFAULT_WORLD_BUILDER_SCENE_DATA: WorldBuilderSceneData = {
	placedObjects: [],
	gridSettings: DEFAULT_SNAP_SETTINGS,
	activePalette: "platformer-project",
	customBrushes: [],
};

// ─── Tool display metadata ───
export const WB_TOOLS: { id: WBTool; label: string; group: "place" | "edit" | "modify" }[] = [
	{ id: "pin", label: "Pin", group: "place" },
	{ id: "brush", label: "Brush", group: "place" },
	{ id: "gravity", label: "Gravity", group: "place" },
	{ id: "line", label: "Line", group: "place" },
	{ id: "shape", label: "Shape", group: "place" },
	{ id: "tiling-floor", label: "Floor", group: "place" },
	{ id: "tiling-wall", label: "Wall", group: "place" },
	{ id: "eraser", label: "Eraser", group: "modify" },
	{ id: "replacer", label: "Replace", group: "modify" },
	{ id: "select", label: "Select", group: "edit" },
	{ id: "extrude", label: "Extrude", group: "edit" },
	{ id: "mirror", label: "Mirror", group: "edit" },
];
