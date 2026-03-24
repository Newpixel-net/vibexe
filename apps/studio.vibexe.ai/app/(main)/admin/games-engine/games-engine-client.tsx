"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
	ChevronDown,
	ChevronRight,
	Gamepad2,
	Box,
	Puzzle,
	FolderOpen,
	Clapperboard,
	FileCode,
	Copy,
	Check,
	Save,
	Plus,
	Trash2,
	Library,
	Search,
	X,
	Tag,
	Code,
	Loader2,
} from "lucide-react";
import {
	GAME_3D_TEMPLATE_FILES,
	GAME_3D_SCENE_STARTER,
	GAME_3D_SCENE_STARTER_CHARACTER,
	GAME_3D_SCENE_STARTER_RUNNER,
	GAME_2D_TEMPLATE_FILES,
	PACKS_3D,
	PACKS_2D,
	GAME_3D_ASSETS_REFERENCE,
	ALL_MODULE_MANIFESTS,
	type TemplateFile,
	type AssetPack3D,
	type AssetPack2D,
	type ModuleManifest,
} from "@vibexe-ai/vibexe-engine";

// =============================================================================
// STATIC DATA — Add new genres/engines/factories here
// =============================================================================

type EngineDef = {
	id: string;
	name: string;
	version: string;
	description: string;
	icon: "Box" | "Gamepad2";
	agentId: string;
	agentName: string;
	modelTier: "opus" | "sonnet" | "haiku";
	templateFiles: TemplateFile[];
};

const ENGINES: EngineDef[] = [
	{
		id: "three-js",
		name: "Three.js 3D",
		version: "r128",
		description:
			"3D game engine using Three.js + cannon-es physics. GLTF model loading, skeletal animations, post-processing, particles, spatial audio.",
		icon: "Box",
		agentId: "game-3d-developer",
		agentName: "3D Game Developer",
		modelTier: "opus",
		templateFiles: GAME_3D_TEMPLATE_FILES,
	},
	{
		id: "pixi-js",
		name: "Pixi.js 2D",
		version: "v8.9",
		description:
			"2D game engine using Pixi.js + Proton particle effects. Sprite animations, AABB physics, parallax backgrounds, mobile touch input.",
		icon: "Gamepad2",
		agentId: "game-2d-developer",
		agentName: "2D Game Developer",
		modelTier: "opus",
		templateFiles: GAME_2D_TEMPLATE_FILES,
	},
];

type GenreDef = {
	id: string;
	name: string;
	engine: string;
	isDefault: boolean;
	description: string;
	detectionKeywords: string[];
	factoryIds: string[];
	starterCode?: string;
	agentId: string;
};

const GENRES: GenreDef[] = [
	{
		id: "3d-platformer",
		name: "3D Platformer",
		engine: "three-js",
		isDefault: true,
		description:
			"Third-person platformer with jump, collect, avoid. Uses GLTF models for platforms, collectibles, barriers, decorations.",
		detectionKeywords: [
			"3d game",
			"three.js",
			"3d platformer",
			"isometric",
			"first person",
			"gltf",
			"kaykit",
			"3d world",
			"3d survival",
			"3d environment",
			"low-poly 3d",
			"3d builder",
			"3d exploration",
		],
		factoryIds: [
			"createPlatform3D",
			"createCollectible3D",
			"createPlayer3D",
			"createBarrier3D",
			"createDecoration3D",
			"createText3D",
		],
		starterCode: "GAME_3D_SCENE_STARTER",
		agentId: "game-3d-developer",
	},
	{
		id: "3d-character",
		name: "3D Character Action",
		engine: "three-js",
		isDefault: false,
		description:
			"Animated character platformer with skeletal animations, attack combos, controller-based movement. Auto-detected via character keywords.",
		detectionKeywords: [
			"warrior",
			"fighter",
			"knight",
			"soldier",
			"hero character",
			"animated character",
			"animated player",
			"3d character",
			"skeleton warrior",
			"character animation",
			"humanoid",
		],
		factoryIds: [
			"createAnimatedCharacter3D",
			"createCharacterController3D",
			"createPlatform3D",
			"createCollectible3D",
			"createBarrier3D",
			"createDecoration3D",
			"createText3D",
		],
		starterCode: "GAME_3D_SCENE_STARTER_CHARACTER",
		agentId: "game-3d-developer",
	},
	{
		id: "3d-runner",
		name: "3D Endless Runner",
		engine: "three-js",
		isDefault: false,
		description:
			"Temple Run / Subway Surfers style. Auto-forward, 3-lane switching, segment recycling, animated character, audio, particles. Touch swipe + keyboard.",
		detectionKeywords: [
			"3d runner",
			"endless runner 3d",
			"temple run 3d",
			"subway surfers 3d",
			"3d lane",
			"runner 3d",
			"3d endless",
			"3d dodge runner",
			"auto-run 3d",
			"3d endless runner",
			"subway surfers",
		],
		factoryIds: [
			"createAnimatedCharacter3D",
			"createCharacterController3D",
			"createPlatform3D",
			"createCollectible3D",
			"createBarrier3D",
			"createDecoration3D",
			"createText3D",
		],
		starterCode: "GAME_3D_SCENE_STARTER_RUNNER",
		agentId: "game-3d-developer",
	},
	{
		id: "3d-shooter",
		name: "3D Top-Down Shooter",
		engine: "three-js",
		isDefault: false,
		description:
			"Squad Shooter / Archero style. Top-down camera, FSM enemies, wave spawning, weapon system, bullet pooling, hit feedback stack, dynamic difficulty. 96 GLB models + 24 audio files.",
		detectionKeywords: [
			"3d shooter",
			"top down shooter",
			"top-down shooter",
			"squad shooter",
			"archero",
			"brawl stars",
			"3d shoot",
			"shoot em up 3d",
			"bullet hell 3d",
			"wave shooter",
			"arena shooter",
			"twin stick",
			"twin-stick",
			"zombie shooter",
			"survival shooter",
			"horde shooter",
		],
		factoryIds: [
			"createPlatform3D",
			"createCollectible3D",
			"createPlayer3D",
			"createBarrier3D",
			"createDecoration3D",
			"createText3D",
			"createAnimatedCharacter3D",
		],
		starterCode: "GAME_3D_SCENE_STARTER",
		agentId: "game-3d-developer",
	},
	// ---- 2D GENRES (Pixi.js + Proton) ----
	{
		id: "2d-platformer",
		name: "2D Platformer",
		engine: "pixi-js",
		isDefault: true,
		description:
			"Side-scrolling platformer with jump, collect, avoid. Sprite animations, parallax backgrounds, Proton particle effects.",
		detectionKeywords: [
			"2d game", "2d platformer", "side scroller", "sidescroller",
			"platformer game", "jumping game", "metroidvania",
		],
		factoryIds: [
			"createGameSprite",
			"createAnimatedGameSprite",
			"createParallaxBackground",
		],
		starterCode: "GAME_2D_SCENE_STARTER",
		agentId: "game-2d-developer",
	},
	{
		id: "2d-runner",
		name: "2D Endless Runner",
		engine: "pixi-js",
		isDefault: false,
		description:
			"Auto-scrolling runner with lane switching, obstacles, speed ramp. Distance-based scoring.",
		detectionKeywords: [
			"runner game", "endless runner", "2d runner", "auto-run",
			"temple run", "subway surfers",
		],
		factoryIds: [
			"createGameSprite",
			"createParallaxBackground",
		],
		starterCode: "GAME_2D_SCENE_STARTER_RUNNER",
		agentId: "game-2d-developer",
	},
	{
		id: "2d-puzzle",
		name: "2D Puzzle",
		engine: "pixi-js",
		isDefault: false,
		description:
			"Grid-based puzzle (match-3, block puzzle, etc.). Drag-drop, click-to-select, sparkle effects on matches.",
		detectionKeywords: [
			"puzzle", "match-3", "match 3", "tetris", "block puzzle",
			"word game", "memory game",
		],
		factoryIds: [
			"createGameSprite",
		],
		starterCode: "GAME_2D_SCENE_STARTER_PUZZLE",
		agentId: "game-2d-developer",
	},
	{
		id: "2d-shooter",
		name: "2D Shooter",
		engine: "pixi-js",
		isDefault: false,
		description:
			"Space shooter, shmup, bullet hell. Projectiles, enemy waves, explosion effects.",
		detectionKeywords: [
			"2d shooter", "shoot em up", "shmup", "bullet hell",
			"space shooter",
		],
		factoryIds: [
			"createGameSprite",
			"createParallaxBackground",
		],
		starterCode: "GAME_2D_SCENE_STARTER_SHOOTER",
		agentId: "game-2d-developer",
	},
];

type FactoryDef = {
	id: string;
	name: string;
	engine: string;
	signature: string;
	returnType: string;
	description: string;
	params: { name: string; type: string; required: boolean; description: string }[];
};

const FACTORIES: FactoryDef[] = [
	// 3D factories
	{
		id: "createPlatform3D",
		name: "createPlatform3D",
		engine: "three-js",
		signature: "createPlatform3D(scene, x, y, z, opts?)",
		returnType: "{mesh, size}",
		description: "Creates a platform from KayKit GLTF models. 16 size variants × 4 colors. size = half-extents for physics.",
		params: [
			{ name: "scene", type: "THREE.Scene", required: true, description: "Three.js scene to add mesh to" },
			{ name: "x, y, z", type: "number", required: true, description: "World position" },
			{ name: "opts.variant", type: "string", required: false, description: '16 sizes: "1x1x1" to "6x6x4". Default "4x4x1"' },
			{ name: "opts.color", type: "string", required: false, description: '"blue"|"green"|"red"|"yellow". Default "blue"' },
			{ name: "opts.scale", type: "number", required: false, description: "Extra scale multiplier" },
		],
	},
	{
		id: "createCollectible3D",
		name: "createCollectible3D",
		engine: "three-js",
		signature: "createCollectible3D(scene, x, y, z, opts?)",
		returnType: "{mesh, size}",
		description: "Creates a collectible item (diamond, star, heart, ball) from KayKit GLTF models with Y-axis spin animation.",
		params: [
			{ name: "scene", type: "THREE.Scene", required: true, description: "Three.js scene" },
			{ name: "x, y, z", type: "number", required: true, description: "World position" },
			{ name: "opts.type", type: "string", required: false, description: '"diamond"|"star"|"heart"|"ball". Default "diamond"' },
			{ name: "opts.color", type: "string", required: false, description: "Color variant. Default \"blue\"" },
		],
	},
	{
		id: "createPlayer3D",
		name: "createPlayer3D",
		engine: "three-js",
		signature: "createPlayer3D(scene, x, y, z, opts?)",
		returnType: "{mesh, size}",
		description: "Creates a player mesh from KayKit model. Simple non-animated player for standard platformers.",
		params: [
			{ name: "scene", type: "THREE.Scene", required: true, description: "Three.js scene" },
			{ name: "x, y, z", type: "number", required: true, description: "World position" },
			{ name: "opts.model", type: "string", required: false, description: '"ball"|"diamond"|"heart"|"star". Default "ball"' },
			{ name: "opts.color", type: "string", required: false, description: "Color variant" },
		],
	},
	{
		id: "createBarrier3D",
		name: "createBarrier3D",
		engine: "three-js",
		signature: "createBarrier3D(scene, x, y, z, opts?)",
		returnType: "{mesh, size}",
		description: "Creates obstacle/wall barriers. 12 size variants × 4 colors. size = half-extents for physics collision.",
		params: [
			{ name: "scene", type: "THREE.Scene", required: true, description: "Three.js scene" },
			{ name: "x, y, z", type: "number", required: true, description: "World position" },
			{ name: "opts.variant", type: "string", required: false, description: '12 sizes: "1x1x1" to "4x1x4". Default "2x1x2"' },
			{ name: "opts.color", type: "string", required: false, description: "Color variant" },
		],
	},
	{
		id: "createDecoration3D",
		name: "createDecoration3D",
		engine: "three-js",
		signature: "createDecoration3D(scene, x, y, z, opts?)",
		returnType: "{mesh, size}",
		description: "Creates environmental decorations (pillars, signs, structures). Also supports cross-pack loading via _pack/_path.",
		params: [
			{ name: "scene", type: "THREE.Scene", required: true, description: "Three.js scene" },
			{ name: "x, y, z", type: "number", required: true, description: "World position" },
			{ name: "opts.type", type: "string", required: false, description: '"pillar_2x2x4"|"structure_A"|"floor_wood_4x4"|"sign"' },
			{ name: "opts._pack", type: "string", required: false, description: "Cross-pack ID (e.g. kaykit-city-builder)" },
			{ name: "opts._path", type: "string", required: false, description: "Cross-pack GLTF path" },
		],
	},
	{
		id: "createAnimatedCharacter3D",
		name: "createAnimatedCharacter3D",
		engine: "three-js",
		signature: "createAnimatedCharacter3D(scene, x, y, z, {url, targetHeight?, rotation?})",
		returnType: "{mesh, mixer, clips, play, stop, size}",
		description:
			"Loads GLB with skeletal animations. Auto-normalizes orientation (Z-up to Y-up), auto-scales to targetHeight, centers pivot at feet. Fuzzy clip matching.",
		params: [
			{ name: "scene", type: "THREE.Scene", required: true, description: "Three.js scene" },
			{ name: "x, y, z", type: "number", required: true, description: "World position" },
			{ name: "opts.url", type: "string", required: true, description: "URL to .glb model file" },
			{ name: "opts.targetHeight", type: "number", required: false, description: "Desired height in world units. Default SCALES_3D.animatedCharacter" },
		],
	},
	{
		id: "createCharacterController3D",
		name: "createCharacterController3D",
		engine: "three-js",
		signature: "createCharacterController3D(character, physicsBody, opts?)",
		returnType: "{update, jump, attack, setSpeed, ...}",
		description:
			"Auto-manages animation states (idle/walk/run/jump/attack) based on physics velocity. Syncs mesh position, smooth facing direction.",
		params: [
			{ name: "character", type: "{mesh, play, stop}", required: true, description: "Result from createAnimatedCharacter3D" },
			{ name: "physicsBody", type: "CANNON.Body", required: true, description: "Physics body to sync" },
			{ name: "opts.walkSpeed", type: "number", required: false, description: "Walk threshold. Default 1" },
			{ name: "opts.runSpeed", type: "number", required: false, description: "Run threshold. Default 5" },
		],
	},
	{
		id: "createText3D",
		name: "createText3D",
		engine: "three-js",
		signature: 'createText3D("Score: 0", {x,y,z}, {size, color, stroke})',
		returnType: "{sprite, update}",
		description: "Canvas-rendered sprite for 3D text labels/HUD. Call update(newText) to change.",
		params: [
			{ name: "text", type: "string", required: true, description: "Initial text content" },
			{ name: "position", type: "{x,y,z}", required: true, description: "World position" },
			{ name: "opts.size", type: "number", required: false, description: "Font size. Default 48" },
			{ name: "opts.color", type: "string", required: false, description: "Text color. Default white" },
		],
	},
];

// =============================================================================
// TAB TYPES
// =============================================================================

type Tab = "overview" | "genres" | "factories" | "assets" | "overrides" | "starters" | "modules" | "feature-bank";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
	{ id: "overview", label: "Overview", icon: <Gamepad2 className="size-4" /> },
	{ id: "genres", label: "Genres", icon: <Puzzle className="size-4" /> },
	{ id: "factories", label: "Factories", icon: <Box className="size-4" /> },
	{ id: "assets", label: "Assets", icon: <FolderOpen className="size-4" /> },
	{ id: "overrides", label: "Overrides", icon: <Clapperboard className="size-4" /> },
	{ id: "starters", label: "Starters", icon: <FileCode className="size-4" /> },
	{ id: "modules", label: "Modules", icon: <Puzzle className="size-4" /> },
	{ id: "feature-bank", label: "Feature Bank", icon: <Library className="size-4" /> },
];

// =============================================================================
// BADGE COLORS
// =============================================================================

const ENGINE_COLORS: Record<string, string> = {
	"three-js": "text-blue-400 bg-blue-500/10",
};

const TIER_COLORS: Record<string, string> = {
	opus: "text-purple-400 bg-purple-500/10",
	sonnet: "text-blue-400 bg-blue-500/10",
	haiku: "text-green-400 bg-green-500/10",
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap", className)}>
			{children}
		</span>
	);
}

function StatCard({
	icon,
	label,
	value,
	sub,
	onClick,
}: {
	icon: string;
	label: string;
	value: string | number;
	sub?: string;
	onClick?: () => void;
}) {
	return (
		<div
			className={cn(
				"rounded-lg border border-border bg-card p-4",
				onClick && "cursor-pointer hover:border-primary/50 transition-colors",
			)}
			onClick={onClick}
		>
			<div className="flex items-center gap-2 mb-2">
				<span className="text-muted-foreground">{icon}</span>
				<span className="text-sm text-muted-foreground">{label}</span>
			</div>
			<div className="text-2xl font-bold text-foreground">{value}</div>
			{sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
		</div>
	);
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	const handleCopy = () => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};
	return (
		<button
			onClick={handleCopy}
			className="text-muted-foreground hover:text-foreground transition-colors p-1"
			title="Copy to clipboard"
		>
			{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
		</button>
	);
}

function ExpandableSection({
	title,
	defaultOpen = false,
	children,
	badge,
}: {
	title: React.ReactNode;
	defaultOpen?: boolean;
	children: React.ReactNode;
	badge?: React.ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div>
			<button
				className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors w-full text-left"
				onClick={() => setOpen(!open)}
			>
				{open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
				<span className="font-medium">{title}</span>
				{badge}
			</button>
			{open && <div className="mt-2 ml-5">{children}</div>}
		</div>
	);
}

function CodeBlock({ code, maxH = "max-h-64" }: { code: string; maxH?: string }) {
	return (
		<div className="relative group">
			<div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
				<CopyButton text={code} />
			</div>
			<pre
				className={cn(
					"p-3 rounded-md bg-muted/50 text-[11px] text-muted-foreground overflow-x-auto overflow-y-auto whitespace-pre-wrap font-mono",
					maxH,
				)}
			>
				{code}
			</pre>
		</div>
	);
}

// =============================================================================
// TAB: OVERVIEW
// =============================================================================

function OverviewTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
	const total3DModels = PACKS_3D.reduce((sum, p) => sum + p.fileCount, 0);

	const stats = [
		{ icon: "🎮", label: "Engines", value: ENGINES.length, sub: "Three.js 3D", tab: "genres" as Tab },
		{ icon: "🎯", label: "Genres", value: GENRES.length, sub: "3D genres", tab: "genres" as Tab },
		{ icon: "🏭", label: "Factory Helpers", value: FACTORIES.length, sub: "3D factories", tab: "factories" as Tab },
		{ icon: "📦", label: "3D Models", value: total3DModels.toLocaleString(), sub: `${PACKS_3D.length} packs`, tab: "assets" as Tab },
		{ icon: "🎨", label: "2D Sprites", value: "20,454", sub: "6 themes", tab: "assets" as Tab },
		{ icon: "🔊", label: "Audio Files", value: 39, sub: "35 SFX + 4 BGM", tab: "starters" as Tab },
	];

	return (
		<div className="space-y-6">
			{/* Stats Grid */}
			<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
				{stats.map((s) => (
					<StatCard
						key={s.label}
						icon={s.icon}
						label={s.label}
						value={s.value}
						sub={s.sub}
						onClick={() => onNavigate(s.tab)}
					/>
				))}
			</div>

			{/* Engine Summary Cards */}
			<div>
				<h3 className="text-sm font-medium text-foreground mb-3">Engines</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{ENGINES.map((eng) => {
						const engineGenres = GENRES.filter((g) => g.engine === eng.id);
						const engineFactories = FACTORIES.filter((f) => f.engine === eng.id);
						return (
							<div key={eng.id} className="rounded-lg border border-border bg-card p-4">
								<div className="flex items-center gap-2 mb-2">
									{eng.icon === "Box" ? <Box className="size-4 text-blue-400" /> : <Gamepad2 className="size-4 text-green-400" />}
									<span className="font-medium text-foreground">{eng.name}</span>
									<Badge className="text-orange-400 bg-orange-500/10">v{eng.version}</Badge>
									<Badge className={TIER_COLORS[eng.modelTier]}>{eng.modelTier}</Badge>
								</div>
								<p className="text-xs text-muted-foreground mb-3">{eng.description}</p>
								<div className="grid grid-cols-2 gap-2 text-xs">
									<div className="text-muted-foreground">
										Agent: <span className="text-foreground">{eng.agentName}</span>
									</div>
									<div className="text-muted-foreground">
										Templates: <span className="text-foreground">{eng.templateFiles.length} files</span>
									</div>
									<div className="text-muted-foreground">
										Genres: <span className="text-foreground">{engineGenres.length}</span>
									</div>
									<div className="text-muted-foreground">
										Factories: <span className="text-foreground">{engineFactories.length}</span>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Genre Quick List */}
			<div>
				<h3 className="text-sm font-medium text-foreground mb-3">Genre Quick List</h3>
				<div className="space-y-1.5">
					{GENRES.map((g) => (
						<div
							key={g.id}
							className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border border-border text-sm"
						>
							<Badge className={ENGINE_COLORS[g.engine]}>
								{g.engine === "three-js" ? "3D" : "2D"}
							</Badge>
							<span className="text-foreground font-medium">{g.name}</span>
							{g.isDefault && <Badge className="text-emerald-400 bg-emerald-500/10">default</Badge>}
							<span className="text-xs text-muted-foreground ml-auto">
								{g.detectionKeywords.length} keywords · {g.factoryIds.length} factories
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// TAB: GENRES
// =============================================================================

function GenresTab() {
	const [expanded, setExpanded] = useState<string | null>(null);

	return (
		<div className="space-y-3">
			{GENRES.map((genre) => {
				const engine = ENGINES.find((e) => e.id === genre.engine);
				const isOpen = expanded === genre.id;
				const starterCode =
					genre.starterCode === "GAME_3D_SCENE_STARTER"
						? GAME_3D_SCENE_STARTER
						: genre.starterCode === "GAME_3D_SCENE_STARTER_CHARACTER"
							? GAME_3D_SCENE_STARTER_CHARACTER
							: null;

				return (
					<div key={genre.id} className="rounded-lg border border-border bg-card">
						<button
							className="flex items-center gap-2 w-full text-left p-4"
							onClick={() => setExpanded(isOpen ? null : genre.id)}
						>
							{isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
							<Badge className={ENGINE_COLORS[genre.engine]}>
								{genre.engine === "three-js" ? "3D" : "2D"}
							</Badge>
							<span className="font-medium text-foreground">{genre.name}</span>
							{genre.isDefault && <Badge className="text-emerald-400 bg-emerald-500/10">default</Badge>}
							<span className="text-xs text-muted-foreground ml-auto">
								{genre.factoryIds.length} factories
							</span>
						</button>

						{isOpen && (
							<div className="px-4 pb-4 pt-0 space-y-4 border-t border-border">
								{/* Description */}
								<p className="text-xs text-muted-foreground pt-3">{genre.description}</p>

								{/* Agent */}
								<div className="text-xs">
									<span className="text-muted-foreground">Agent: </span>
									<span className="text-foreground font-medium">{genre.agentId}</span>
									{engine && (
										<Badge className={cn("ml-2", TIER_COLORS[engine.modelTier])}>{engine.modelTier}</Badge>
									)}
								</div>

								{/* Keywords */}
								<div>
									<span className="text-xs text-muted-foreground block mb-1.5">Detection Keywords</span>
									<div className="flex flex-wrap gap-1">
										{genre.detectionKeywords.map((kw) => (
											<Badge key={kw} className="text-yellow-400 bg-yellow-500/10">{kw}</Badge>
										))}
									</div>
								</div>

								{/* Factories */}
								<div>
									<span className="text-xs text-muted-foreground block mb-1.5">Factory Helpers</span>
									<div className="flex flex-wrap gap-1">
										{genre.factoryIds.map((fid) => (
											<Badge key={fid} className="text-cyan-400 bg-cyan-500/10 font-mono">{fid}</Badge>
										))}
									</div>
								</div>

								{/* Starter Code */}
								{starterCode && (
									<ExpandableSection title="Starter Scene Code" badge={<Badge className="text-muted-foreground bg-muted/50">{starterCode.length.toLocaleString()} chars</Badge>}>
										<CodeBlock code={starterCode} maxH="max-h-96" />
									</ExpandableSection>
								)}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

// =============================================================================
// TAB: FACTORIES
// =============================================================================

function FactoriesTab() {
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const grouped: { engine: EngineDef; factories: FactoryDef[] }[] = ENGINES.map((eng) => ({
		engine: eng,
		factories: FACTORIES.filter((f) => f.engine === eng.id),
	}));

	return (
		<div className="space-y-6">
			{grouped.map(({ engine, factories }) => (
				<div key={engine.id}>
					<div className="flex items-center gap-2 mb-3">
						{engine.icon === "Box" ? <Box className="size-4 text-blue-400" /> : <Gamepad2 className="size-4 text-green-400" />}
						<h3 className="text-sm font-medium text-foreground">{engine.name}</h3>
						<Badge className="text-muted-foreground bg-muted/50">{factories.length}</Badge>
					</div>

					<div className="space-y-2">
						{factories.map((factory) => {
							const isOpen = expandedId === factory.id;
							const usedByGenres = GENRES.filter((g) => g.factoryIds.includes(factory.id));
							return (
								<div key={factory.id} className="rounded-lg border border-border bg-card">
									<button
										className="flex items-center gap-2 w-full text-left p-3"
										onClick={() => setExpandedId(isOpen ? null : factory.id)}
									>
										{isOpen ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
										<code className="text-xs font-mono text-foreground">{factory.signature}</code>
										<span className="text-[10px] text-muted-foreground ml-1">→ {factory.returnType}</span>
										<div className="flex gap-1 ml-auto">
											{usedByGenres.map((g) => (
												<Badge key={g.id} className={ENGINE_COLORS[g.engine]}>{g.name}</Badge>
											))}
										</div>
									</button>

									{isOpen && (
										<div className="px-3 pb-3 pt-0 space-y-3 border-t border-border">
											<p className="text-xs text-muted-foreground pt-2">{factory.description}</p>

											{factory.params.length > 0 && (
												<div className="overflow-x-auto">
													<table className="w-full text-xs">
														<thead>
															<tr className="text-muted-foreground border-b border-border">
																<th className="text-left py-1.5 pr-3 font-medium">Param</th>
																<th className="text-left py-1.5 pr-3 font-medium">Type</th>
																<th className="text-left py-1.5 pr-3 font-medium">Req</th>
																<th className="text-left py-1.5 font-medium">Description</th>
															</tr>
														</thead>
														<tbody>
															{factory.params.map((p) => (
																<tr key={p.name} className="border-b border-border/50">
																	<td className="py-1.5 pr-3 font-mono text-foreground">{p.name}</td>
																	<td className="py-1.5 pr-3 font-mono text-cyan-400">{p.type}</td>
																	<td className="py-1.5 pr-3">
																		{p.required ? (
																			<span className="text-emerald-400">yes</span>
																		) : (
																			<span className="text-muted-foreground">no</span>
																		)}
																	</td>
																	<td className="py-1.5 text-muted-foreground">{p.description}</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}

// =============================================================================
// TAB: ASSETS
// =============================================================================

function AssetsTab() {
	return (
		<div className="space-y-6">
			{/* 3D Packs */}
			<div>
				<h3 className="text-sm font-medium text-foreground mb-3">3D Model Packs</h3>
				<div className="space-y-2">
					{PACKS_3D.map((pack: AssetPack3D) => (
						<div key={pack.id} className="rounded-lg border border-border bg-card p-4">
							<div className="flex items-center gap-2 mb-2">
								<span className="font-medium text-foreground text-sm">{pack.name}</span>
								<Badge className="text-blue-400 bg-blue-500/10">{pack.family}</Badge>
								<Badge className="text-orange-400 bg-orange-500/10">{pack.format.toUpperCase()}</Badge>
								<span className="text-xs text-muted-foreground ml-auto">
									{pack.fileCount} files · {pack.sizeMB} MB
								</span>
							</div>
							<p className="text-xs text-muted-foreground mb-3">{pack.description}</p>

							{/* Category breakdown */}
							<ExpandableSection
								title="Categories"
								badge={<Badge className="text-muted-foreground bg-muted/50">{Object.keys(pack.categories).length}</Badge>}
							>
								<div className="space-y-2">
									{Object.entries(pack.categories).map(([cat, models]) => (
										<div key={cat}>
											<div className="flex items-center gap-2 mb-1">
												<span className="text-xs font-medium text-foreground">{cat.replace(/_/g, " ")}</span>
												<Badge className="text-muted-foreground bg-muted/50">{models.length}</Badge>
											</div>
											<div className="flex flex-wrap gap-1">
												{models.map((m) => (
													<span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">
														{m}
													</span>
												))}
											</div>
										</div>
									))}
								</div>
							</ExpandableSection>
						</div>
					))}
				</div>
			</div>

		</div>
	);
}

// =============================================================================
// TAB: ANIMATION OVERRIDES
// =============================================================================

type OverridesData = Record<string, Record<string, string>>;

function OverridesTab() {
	const [overrides, setOverrides] = useState<OverridesData>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState<string | null>(null);
	const [newModel, setNewModel] = useState("");

	const fetchOverrides = useCallback(async () => {
		try {
			const res = await fetch("/api/app-builder/animation-overrides");
			const data = await res.json();
			setOverrides(data);
		} catch {
			// empty overrides on error
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchOverrides();
	}, [fetchOverrides]);

	const handleSave = async (model: string) => {
		setSaving(model);
		try {
			await fetch("/api/app-builder/animation-overrides", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ model, overrides: overrides[model] }),
			});
		} finally {
			setSaving(null);
		}
	};

	const handleOverrideChange = (model: string, original: string, display: string) => {
		setOverrides((prev) => ({
			...prev,
			[model]: { ...prev[model], [original]: display },
		}));
	};

	const handleAddOverride = (model: string) => {
		setOverrides((prev) => ({
			...prev,
			[model]: { ...prev[model], "": "" },
		}));
	};

	const handleRemoveOverride = (model: string, original: string) => {
		setOverrides((prev) => {
			const copy = { ...prev[model] };
			delete copy[original];
			return { ...prev, [model]: copy };
		});
	};

	const handleAddModel = () => {
		if (!newModel.trim()) return;
		setOverrides((prev) => ({ ...prev, [newModel.trim()]: {} }));
		setNewModel("");
	};

	if (loading) {
		return <div className="text-sm text-muted-foreground py-8 text-center">Loading animation overrides...</div>;
	}

	const models = Object.keys(overrides);

	return (
		<div className="space-y-4">
			<div className="rounded-md bg-muted/30 border border-border p-3 text-xs text-muted-foreground">
				<p className="mb-1">Animation name overrides map raw clip names (e.g. &quot;Idle_5&quot;) to display-friendly names (e.g. &quot;Idle&quot;).</p>
				<p>Storage: <code className="font-mono">/opt/vibexe/data/animation-overrides.json</code></p>
				<p>API: <code className="font-mono">GET/POST /api/app-builder/animation-overrides</code></p>
			</div>

			{models.length === 0 && (
				<div className="text-sm text-muted-foreground text-center py-4">No animation overrides configured yet.</div>
			)}

			{models.map((model) => {
				const entries = Object.entries(overrides[model]);
				return (
					<div key={model} className="rounded-lg border border-border bg-card p-4">
						<div className="flex items-center gap-2 mb-3">
							<span className="font-medium text-foreground text-sm">{model}</span>
							<Badge className="text-muted-foreground bg-muted/50">{entries.length} overrides</Badge>
							<div className="ml-auto flex gap-1.5">
								<button
									onClick={() => handleAddOverride(model)}
									className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
								>
									<Plus className="size-3" /> Add
								</button>
								<button
									onClick={() => handleSave(model)}
									disabled={saving === model}
									className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
								>
									<Save className="size-3" /> {saving === model ? "Saving..." : "Save"}
								</button>
							</div>
						</div>

						{entries.length > 0 && (
							<div className="space-y-1.5">
								{entries.map(([original, display]) => (
									<div key={original} className="flex items-center gap-2">
										<input
											type="text"
											value={original}
											onChange={(e) => {
												const newOverrides = { ...overrides[model] };
												delete newOverrides[original];
												newOverrides[e.target.value] = display;
												setOverrides((prev) => ({ ...prev, [model]: newOverrides }));
											}}
											className="flex-1 text-xs font-mono bg-muted/30 border border-border rounded px-2 py-1 text-foreground"
											placeholder="Original clip name"
										/>
										<span className="text-muted-foreground text-xs">→</span>
										<input
											type="text"
											value={display}
											onChange={(e) => handleOverrideChange(model, original, e.target.value)}
											className="flex-1 text-xs font-mono bg-muted/30 border border-border rounded px-2 py-1 text-foreground"
											placeholder="Display name"
										/>
										<button
											onClick={() => handleRemoveOverride(model, original)}
											className="text-muted-foreground hover:text-red-400 transition-colors p-1"
										>
											<Trash2 className="size-3" />
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				);
			})}

			{/* Add Model */}
			<div className="flex items-center gap-2">
				<input
					type="text"
					value={newModel}
					onChange={(e) => setNewModel(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleAddModel()}
					className="text-xs font-mono bg-muted/30 border border-border rounded px-2 py-1.5 text-foreground flex-1"
					placeholder="Model filename (e.g. Warrior_figure_Animations)"
				/>
				<button
					onClick={handleAddModel}
					className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
				>
					<Plus className="size-3.5" /> Add Model
				</button>
			</div>
		</div>
	);
}

// =============================================================================
// TAB: STARTERS
// =============================================================================

function StartersTab() {
	const starters = [
		{ name: "GAME_3D_SCENE_STARTER", label: "3D Standard Platformer", code: GAME_3D_SCENE_STARTER },
		{ name: "GAME_3D_SCENE_STARTER_CHARACTER", label: "3D Animated Character", code: GAME_3D_SCENE_STARTER_CHARACTER },
	];

	return (
		<div className="space-y-6">
			{/* Starters */}
			<div>
				<h3 className="text-sm font-medium text-foreground mb-3">Scene Starters</h3>
				<div className="space-y-3">
					{starters.map((s) => (
						<div key={s.name} className="rounded-lg border border-border bg-card p-4">
							<ExpandableSection
								title={
									<span className="flex items-center gap-2">
										<code className="font-mono text-xs">{s.name}</code>
										<span className="text-xs text-muted-foreground font-normal">{s.label}</span>
									</span>
								}
								badge={<Badge className="text-muted-foreground bg-muted/50">{s.code.length.toLocaleString()} chars</Badge>}
							>
								<CodeBlock code={s.code} maxH="max-h-[500px]" />
							</ExpandableSection>
						</div>
					))}
				</div>
			</div>

			{/* Template Files */}
			{ENGINES.map((eng) => (
				<div key={eng.id}>
					<h3 className="text-sm font-medium text-foreground mb-3">{eng.name} Template Files</h3>
					<div className="space-y-2">
						{eng.templateFiles.map((tf: TemplateFile) => (
							<div key={tf.path} className="rounded-lg border border-border bg-card p-4">
								<ExpandableSection
									title={
										<span className="flex items-center gap-2">
											<code className="font-mono text-xs">{tf.path}</code>
											<Badge className="text-muted-foreground bg-muted/50">{tf.language}</Badge>
										</span>
									}
									badge={<Badge className="text-muted-foreground bg-muted/50">{tf.content.length.toLocaleString()} chars</Badge>}
								>
									<CodeBlock code={tf.content} maxH="max-h-96" />
								</ExpandableSection>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

// =============================================================================
// MODULES TAB
// =============================================================================

function ModulesTab() {
	return (
		<div className="space-y-6">
			<div className="rounded-md bg-muted/30 border border-border p-3 text-xs text-muted-foreground">
				<p className="mb-1">Vibexe Modules are self-contained feature packages injected into the game runtime.</p>
				<p>Modules are installed per-app via <code className="font-mono">__vibexe-modules.json</code> and injected as <code className="font-mono">/node_modules/@vibexe/&#123;id&#125;/</code> shims in the sandpack iframe.</p>
				<p className="mt-1">Each module provides: runtime code (Three.js), bridge handlers (editor integration), default settings, and required assets.</p>
			</div>

			<div>
				<h3 className="text-sm font-medium text-foreground mb-3">
					Available Modules
					<span className="ml-2 text-xs text-muted-foreground font-normal">({ALL_MODULE_MANIFESTS.length} total)</span>
				</h3>
				<div className="space-y-3">
					{ALL_MODULE_MANIFESTS.map((mod: ModuleManifest) => (
						<div key={mod.id} className="rounded-lg border border-border bg-card p-4">
							<div className="flex items-center gap-2 mb-2">
								<Puzzle className="w-4 h-4 text-purple-400" />
								<span className="font-medium text-foreground text-sm">{mod.name}</span>
								<Badge className="text-purple-400 bg-purple-500/10">{mod.category}</Badge>
								<Badge className="text-blue-400 bg-blue-500/10">v{mod.version}</Badge>
								<span className="text-xs text-muted-foreground ml-auto font-mono">@vibexe/{mod.id}</span>
							</div>
							<p className="text-xs text-muted-foreground mb-3">{mod.description}</p>

							<div className="grid grid-cols-2 gap-4 text-xs">
								{/* Bridge Handlers */}
								<div>
									<span className="text-muted-foreground font-medium">Bridge Handlers</span>
									<div className="mt-1 space-y-0.5">
										{Object.entries(mod.bridgeHandlers).length > 0 ? (
											Object.entries(mod.bridgeHandlers).map(([msg, handler]) => (
												<div key={msg} className="flex items-center gap-1.5">
													<span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">{msg}</span>
													<span className="text-zinc-500">&rarr;</span>
													<span className="text-cyan-400 font-mono text-[10px]">{handler}</span>
												</div>
											))
										) : (
											<span className="text-zinc-500">None</span>
										)}
									</div>
								</div>

								{/* Assets */}
								<div>
									<span className="text-muted-foreground font-medium">Required Assets</span>
									<div className="mt-1 flex flex-wrap gap-1">
										{mod.assets.length > 0 ? (
											mod.assets.map((asset) => (
												<span key={asset} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">{asset}</span>
											))
										) : (
											<span className="text-zinc-500">None</span>
										)}
									</div>
								</div>
							</div>

							{/* Default Settings */}
							{Object.keys(mod.defaultSettings).length > 0 && (
								<div className="mt-3">
									<ExpandableSection
										title="Default Settings"
										badge={<Badge className="text-muted-foreground bg-muted/50">{Object.keys(mod.defaultSettings).length} keys</Badge>}
									>
										<pre className="text-[10px] font-mono text-muted-foreground bg-muted/30 rounded p-2 overflow-x-auto">
											{JSON.stringify(mod.defaultSettings, null, 2)}
										</pre>
									</ExpandableSection>
								</div>
							)}

							{/* Runtime Code Status */}
							<div className="mt-3 flex items-center gap-2 text-[10px]">
								<span className="text-muted-foreground">Runtime Code:</span>
								{mod.runtimeCode ? (
									<span className="text-emerald-400">{mod.runtimeCode.length} bytes</span>
								) : (
									<span className="text-amber-400">Stub (module will log load message)</span>
								)}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Module System Architecture */}
			<div>
				<h3 className="text-sm font-medium text-foreground mb-3">Module System Architecture</h3>
				<div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
					<div className="flex items-center gap-2">
						<span className="font-medium text-foreground">Detection:</span>
						<span>Auto-detect from imports <code className="font-mono bg-muted/50 px-1 rounded">@vibexe/&#123;id&#125;</code> or explicit <code className="font-mono bg-muted/50 px-1 rounded">__vibexe-modules.json</code></span>
					</div>
					<div className="flex items-center gap-2">
						<span className="font-medium text-foreground">Injection:</span>
						<span>Sandpack <code className="font-mono bg-muted/50 px-1 rounded">/node_modules/@vibexe/&#123;id&#125;/index.js</code> shim (same as THREE/CANNON pattern)</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="font-medium text-foreground">Production:</span>
						<span>esbuild virtual plugin resolves <code className="font-mono bg-muted/50 px-1 rounded">@vibexe/*</code> to runtime code or window globals</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="font-medium text-foreground">Runtime Global:</span>
						<span><code className="font-mono bg-muted/50 px-1 rounded">window.__VIBEXE_INSTALLED_MODULES__</code> &mdash; array of enabled module IDs</span>
					</div>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// FEATURE BANK TAB
// =============================================================================

type Snippet = {
	id: string;
	dbId: number;
	name: string;
	description: string;
	category: string;
	type: string;
	engine: string;
	version: string;
	keywords: string[];
	parameters: any[];
	dependencies: string[];
	genres: string[];
	code: string;
	isBuiltIn: boolean;
	isVerified: boolean;
	createdAt: string;
	updatedAt: string;
};

const TYPE_COLORS: Record<string, string> = {
	instruction: "text-blue-400 bg-blue-500/10",
	condition: "text-amber-400 bg-amber-500/10",
	event: "text-green-400 bg-green-500/10",
};

const ENGINE_BADGE: Record<string, string> = {
	"2d": "text-emerald-400 bg-emerald-500/10",
	"3d": "text-blue-400 bg-blue-500/10",
	shared: "text-purple-400 bg-purple-500/10",
};

const EMPTY_SNIPPET: Partial<Snippet> = {
	id: "",
	name: "",
	description: "",
	category: "",
	type: "instruction",
	engine: "2d",
	version: "1.0.0",
	keywords: [],
	parameters: [],
	dependencies: [],
	genres: [],
	code: "export default function create(config: Record<string, any>) {\n  return {\n    id: '',\n    init(engine: any, cfg: Record<string, any>) {},\n    update(engine: any, dt: number) {},\n    destroy() {},\n  };\n}\n",
	isBuiltIn: false,
	isVerified: false,
};

function FeatureBankTab() {
	const [snippets, setSnippets] = useState<Snippet[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [filterEngine, setFilterEngine] = useState<string>("");
	const [filterType, setFilterType] = useState<string>("");
	const [filterCategory, setFilterCategory] = useState<string>("");
	const [selected, setSelected] = useState<Snippet | null>(null);
	const [editing, setEditing] = useState<Partial<Snippet> | null>(null);
	const [saving, setSaving] = useState(false);

	const fetchSnippets = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (filterEngine) params.set("engine", filterEngine);
			if (filterType) params.set("type", filterType);
			if (filterCategory) params.set("category", filterCategory);
			if (search) params.set("search", search);
			const res = await fetch(`/api/admin/feature-bank/snippets?${params}`);
			const data = await res.json();
			setSnippets(data.snippets || []);
		} catch (e) {
			console.error("Failed to fetch snippets:", e);
		} finally {
			setLoading(false);
		}
	}, [filterEngine, filterType, filterCategory, search]);

	useEffect(() => {
		fetchSnippets();
	}, [fetchSnippets]);

	const categories = Array.from(new Set(snippets.map((s) => s.category))).sort();

	const handleSave = async () => {
		if (!editing) return;
		setSaving(true);
		try {
			const isNew = !editing.dbId;
			const url = isNew
				? "/api/admin/feature-bank/snippets"
				: `/api/admin/feature-bank/snippets/${editing.id}`;
			const method = isNew ? "POST" : "PUT";
			const res = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(editing),
			});
			if (!res.ok) {
				const err = await res.json();
				alert(err.error || "Save failed");
				return;
			}
			setEditing(null);
			setSelected(null);
			fetchSnippets();
		} catch (e) {
			console.error("Save error:", e);
			alert("Save failed");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm(`Delete snippet "${id}"?`)) return;
		try {
			await fetch(`/api/admin/feature-bank/snippets/${id}`, { method: "DELETE" });
			setSelected(null);
			setEditing(null);
			fetchSnippets();
		} catch (e) {
			console.error("Delete error:", e);
		}
	};

	// Edit/detail view
	if (editing) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">
						{editing.dbId ? `Edit: ${editing.name}` : "New Snippet"}
					</h2>
					<div className="flex gap-2">
						<button
							onClick={() => setEditing(null)}
							className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted/50"
						>
							Cancel
						</button>
						<button
							onClick={handleSave}
							disabled={saving}
							className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
							Save
						</button>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-3">
						<div>
							<label className="text-xs text-muted-foreground">ID (slug)</label>
							<input
								value={editing.id || ""}
								onChange={(e) => setEditing({ ...editing, id: e.target.value })}
								className="w-full mt-1 px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
								placeholder="double-jump"
								disabled={!!editing.dbId}
							/>
						</div>
						<div>
							<label className="text-xs text-muted-foreground">Name</label>
							<input
								value={editing.name || ""}
								onChange={(e) => setEditing({ ...editing, name: e.target.value })}
								className="w-full mt-1 px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
								placeholder="Double Jump"
							/>
						</div>
						<div>
							<label className="text-xs text-muted-foreground">Description</label>
							<textarea
								value={editing.description || ""}
								onChange={(e) => setEditing({ ...editing, description: e.target.value })}
								className="w-full mt-1 px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
								rows={2}
								placeholder="Allows player to jump again mid-air"
							/>
						</div>
						<div className="grid grid-cols-3 gap-2">
							<div>
								<label className="text-xs text-muted-foreground">Category</label>
								<input
									value={editing.category || ""}
									onChange={(e) => setEditing({ ...editing, category: e.target.value })}
									className="w-full mt-1 px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
									placeholder="Mechanics/Movement"
								/>
							</div>
							<div>
								<label className="text-xs text-muted-foreground">Type</label>
								<select
									value={editing.type || "instruction"}
									onChange={(e) => setEditing({ ...editing, type: e.target.value })}
									className="w-full mt-1 px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
								>
									<option value="instruction">Instruction</option>
									<option value="condition">Condition</option>
									<option value="event">Event</option>
								</select>
							</div>
							<div>
								<label className="text-xs text-muted-foreground">Engine</label>
								<select
									value={editing.engine || "2d"}
									onChange={(e) => setEditing({ ...editing, engine: e.target.value })}
									className="w-full mt-1 px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
								>
									<option value="2d">2D</option>
									<option value="3d">3D</option>
									<option value="shared">Shared</option>
								</select>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label className="text-xs text-muted-foreground">Version</label>
								<input
									value={editing.version || "1.0.0"}
									onChange={(e) => setEditing({ ...editing, version: e.target.value })}
									className="w-full mt-1 px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
								/>
							</div>
							<div>
								<label className="text-xs text-muted-foreground">Keywords (comma-separated)</label>
								<input
									value={(editing.keywords || []).join(", ")}
									onChange={(e) =>
										setEditing({
											...editing,
											keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
										})
									}
									className="w-full mt-1 px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
									placeholder="jump, air, movement"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label className="text-xs text-muted-foreground">Genres (comma-separated)</label>
								<input
									value={(editing.genres || []).join(", ")}
									onChange={(e) =>
										setEditing({
											...editing,
											genres: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
										})
									}
									className="w-full mt-1 px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
									placeholder="platformer, runner"
								/>
							</div>
							<div>
								<label className="text-xs text-muted-foreground">Dependencies (comma-separated IDs)</label>
								<input
									value={(editing.dependencies || []).join(", ")}
									onChange={(e) =>
										setEditing({
											...editing,
											dependencies: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
										})
									}
									className="w-full mt-1 px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
									placeholder="physics-body"
								/>
							</div>
						</div>
						<div className="flex gap-4">
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={editing.isBuiltIn ?? false}
									onChange={(e) => setEditing({ ...editing, isBuiltIn: e.target.checked })}
								/>
								Built-in
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={editing.isVerified ?? false}
									onChange={(e) => setEditing({ ...editing, isVerified: e.target.checked })}
								/>
								Verified
							</label>
						</div>
					</div>

					<div className="space-y-2">
						<label className="text-xs text-muted-foreground flex items-center gap-1">
							<Code className="size-3" /> Code
						</label>
						<textarea
							value={editing.code || ""}
							onChange={(e) => setEditing({ ...editing, code: e.target.value })}
							className="w-full h-[460px] px-3 py-2 text-xs font-mono rounded-md bg-muted/50 border border-border resize-none"
							spellCheck={false}
						/>
					</div>
				</div>
			</div>
		);
	}

	// List view
	return (
		<div className="space-y-4">
			{/* Header + Actions */}
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					{loading ? "Loading..." : `${snippets.length} snippets`}
				</p>
				<button
					onClick={() => setEditing({ ...EMPTY_SNIPPET })}
					className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
				>
					<Plus className="size-4" /> New Snippet
				</button>
			</div>

			{/* Filters */}
			<div className="flex gap-2 flex-wrap">
				<div className="relative flex-1 min-w-[200px]">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
						placeholder="Search snippets..."
					/>
					{search && (
						<button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
							<X className="size-4 text-muted-foreground" />
						</button>
					)}
				</div>
				<select
					value={filterEngine}
					onChange={(e) => setFilterEngine(e.target.value)}
					className="px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
				>
					<option value="">All Engines</option>
					<option value="2d">2D</option>
					<option value="3d">3D</option>
					<option value="shared">Shared</option>
				</select>
				<select
					value={filterType}
					onChange={(e) => setFilterType(e.target.value)}
					className="px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
				>
					<option value="">All Types</option>
					<option value="instruction">Instructions</option>
					<option value="condition">Conditions</option>
					<option value="event">Events</option>
				</select>
				{categories.length > 0 && (
					<select
						value={filterCategory}
						onChange={(e) => setFilterCategory(e.target.value)}
						className="px-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border"
					>
						<option value="">All Categories</option>
						{categories.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				)}
			</div>

			{/* Snippet Grid */}
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
				</div>
			) : snippets.length === 0 ? (
				<div className="text-center py-12 text-muted-foreground">
					<Library className="size-12 mx-auto mb-3 opacity-30" />
					<p className="text-sm">No snippets yet. Create your first feature snippet.</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
					{snippets.map((s) => (
						<div
							key={s.id}
							onClick={() => setSelected(selected?.id === s.id ? null : s)}
							className={cn(
								"p-3 rounded-lg border cursor-pointer transition-colors",
								selected?.id === s.id
									? "border-primary bg-primary/5"
									: "border-border hover:border-muted-foreground/30 hover:bg-muted/30",
							)}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex-1 min-w-0">
									<h3 className="text-sm font-medium truncate">{s.name}</h3>
									<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
								</div>
								<div className="flex gap-1 shrink-0">
									<span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", TYPE_COLORS[s.type] || "")}>
										{s.type}
									</span>
									<span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", ENGINE_BADGE[s.engine] || "")}>
										{s.engine}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-2 mt-2">
								<span className="text-[10px] text-muted-foreground">{s.category}</span>
								<span className="text-[10px] text-muted-foreground">v{s.version}</span>
								{s.isVerified && <span className="text-[10px] text-green-400">verified</span>}
								{s.isBuiltIn && <span className="text-[10px] text-purple-400">built-in</span>}
							</div>
							{s.keywords.length > 0 && (
								<div className="flex gap-1 mt-2 flex-wrap">
									{s.keywords.slice(0, 5).map((k) => (
										<span key={k} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/50 text-[10px] text-muted-foreground">
											<Tag className="size-2.5" />
											{k}
										</span>
									))}
									{s.keywords.length > 5 && (
										<span className="text-[10px] text-muted-foreground">+{s.keywords.length - 5}</span>
									)}
								</div>
							)}

							{/* Expanded detail */}
							{selected?.id === s.id && (
								<div className="mt-3 pt-3 border-t border-border space-y-2">
									{s.genres.length > 0 && (
										<p className="text-[10px] text-muted-foreground">
											Genres: {s.genres.join(", ")}
										</p>
									)}
									{s.dependencies.length > 0 && (
										<p className="text-[10px] text-muted-foreground">
											Depends on: {s.dependencies.join(", ")}
										</p>
									)}
									<div className="flex gap-2 mt-2">
										<button
											onClick={(e) => {
												e.stopPropagation();
												setEditing(s);
											}}
											className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-muted/50"
										>
											<FileCode className="size-3" /> Edit
										</button>
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleDelete(s.id);
											}}
											className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
										>
											<Trash2 className="size-3" /> Delete
										</button>
									</div>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GamesEngineClient() {
	const [activeTab, setActiveTab] = useState<Tab>("overview");

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="text-2xl font-bold text-foreground">Games Engine</h1>
				<p className="text-sm text-muted-foreground mt-1">
					{ENGINES.length} engines · {GENRES.length} genres · {FACTORIES.length} factories · {PACKS_3D.length} asset packs
				</p>
			</div>

			{/* Tab Navigation */}
			<div className="flex gap-1 mb-2 border-b border-border pb-2 overflow-x-auto">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						className={cn(
							"flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap",
							activeTab === tab.id
								? "bg-primary/10 text-primary font-medium"
								: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
						)}
						onClick={() => setActiveTab(tab.id)}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>

			{/* Tab Content */}
			{activeTab === "overview" && <OverviewTab onNavigate={setActiveTab} />}
			{activeTab === "genres" && <GenresTab />}
			{activeTab === "factories" && <FactoriesTab />}
			{activeTab === "assets" && <AssetsTab />}
			{activeTab === "overrides" && <OverridesTab />}
			{activeTab === "starters" && <StartersTab />}
			{activeTab === "modules" && <ModulesTab />}
			{activeTab === "feature-bank" && <FeatureBankTab />}
		</div>
	);
}
