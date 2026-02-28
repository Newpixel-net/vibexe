/**
 * Game Template Files — Pre-created infrastructure injected into projects
 * BEFORE the AI agent starts generating code.
 *
 * The agent finds these files already existing and imports from them,
 * rather than trying to copy verbatim code (which models do unreliably).
 *
 * To add more template files, just add entries to GAME_TEMPLATE_FILES.
 */

export interface TemplateFile {
	path: string;
	content: string;
	language: string;
}

export const GAME_TEMPLATE_FILES: TemplateFile[] = [
	// ---------- Template 1: Media-stock URL builder ----------
	{
		path: "src/utils/media-stock.ts",
		language: "typescript",
		content: `/**
 * Builds a full URL for a media-stock game asset.
 * Uses the platform-injected origin so it works inside Sandpack previews.
 */
export function assetUrl(path: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || "";
  return \`\${origin}/api/app-builder/media-stock/\${encodeURI(path)}\`;
}
`,
	},

	// ---------- Template 2: Asset registry + preload/animation helpers ----------
	{
		path: "src/config/assets.ts",
		language: "typescript",
		content: `import { assetUrl } from "../utils/media-stock";

// ===== Frame path helper =====
const fr = (base: string, prefix: string, nums: number[]) =>
  nums.map(n => ({ key: \`\${prefix}\${n}\`, path: \`\${base}/\${prefix}\${n}.png\` }));

// ===== CHARACTER FRAMES (verified against actual server files) =====
const R1 = "characters/arz-game-kit/ROBOTS/robot1";
export const ROBOT_RUN    = fr(R1, "run/robot1-run",       [0,1,2,3,4,5,6,7,8,9,10,11,12]);
export const ROBOT_ATTACK = fr(R1, "attack/robot1-attack", [0,1,2,3,4,5,6,7,8,9,10]);
export const ROBOT_JUMP   = fr(R1, "jump/robot1-jump",     [0,1,2,3,4,5,6,7,8,9,10,11,12]);
export const ROBOT_DIE    = fr(R1, "die/robot1-die",       [0,1,2,3,4,5,6,7,8]);

const Z1 = "characters/arz-game-kit/ZOMBIES/zombie1";
export const ZOMBIE_WALK   = fr(Z1, "walk/zombie1-walk",     [0,2,4,6,8,10,12,14,16]);
export const ZOMBIE_ATTACK = fr(Z1, "attack/zombie1-attack", [0,1,2,3,4,5,6,7,8]);
export const ZOMBIE_DIE    = fr(Z1, "die/zombie1-die",       [0,2,4,6,8,10,12]);

const A1 = "characters/arz-game-kit/ALIENS/alien1";
export const ALIEN_RUN    = fr(A1, "run/alien1-run",       [0,7,14,21,28,35,42,49]);
export const ALIEN_ATTACK = fr(A1, "attack/alien1-attack", [0,5,10,15,20,25,30]);
export const ALIEN_DIE    = fr(A1, "die/alien1-die",       [0,3,6,9,12,15,18]);

// ===== MENU BACKGROUNDS (for menu/UI scenes only — NOT gameplay) =====
export const MENU_BACKGROUNDS: { key: string; path: string }[] = [
  { key: "bg-nature",      path: "environments/backgrounds/my-back/multiple-level-game-background-8001_imgs_8001_1.png" },
  { key: "bg-jungle",      path: "environments/backgrounds/my-back/feat_jungle3.jpg" },
  { key: "bg-cartoon",     path: "environments/backgrounds/my-back/game-background-png-6.png" },
  { key: "bg-dark-forest", path: "environments/backgrounds/my-back/forest-game-background-8298_imgs_8298.jpg" },
  { key: "bg-space",       path: "environments/backgrounds/arz-backgrounds/1920x1080/BG space 1.jpg" },
];

// ===== STATIC IMAGE KEYS (tiles, items) =====
export const STATIC_ASSETS: { key: string; path: string }[] = [
  { key: "platform",       path: "environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_1.png" },
  { key: "platform-small", path: "environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_sml_1.png" },
  { key: "ground",         path: "environments/tilesets/forest-pack/300_DPI PNG/Grounds/Ground_Wall.png" },
  { key: "tree",           path: "environments/tilesets/forest-pack/300_DPI PNG/Tree/Tree_1.png" },
  { key: "grass",          path: "environments/tilesets/forest-pack/300_DPI PNG/Grass/Ground_Grass.png" },
  { key: "cloud",          path: "environments/tilesets/forest-pack/300_DPI PNG/Clouds/Cloud_1.png" },
  { key: "crystal",        path: "items/collectibles/treasure/crystal01.png" },
  { key: "chest",          path: "items/collectibles/treasure/chest1_128.png" },
  { key: "weapon",         path: "items/weapons/arz-weapons/Weapon_1.png" },
];

// ===== ALL FRAME SETS (for bulk loading) =====
const ALL_FRAME_SETS = [
  ROBOT_RUN, ROBOT_ATTACK, ROBOT_JUMP, ROBOT_DIE,
  ZOMBIE_WALK, ZOMBIE_ATTACK, ZOMBIE_DIE,
  ALIEN_RUN, ALIEN_ATTACK, ALIEN_DIE,
];

/**
 * Call in your BootScene.preload() to load every standard asset.
 * Each frame becomes a separate texture key in the Phaser cache.
 */
export function preloadAssets(scene: Phaser.Scene): void {
  // Menu backgrounds
  for (const { key, path } of MENU_BACKGROUNDS) {
    scene.load.image(key, assetUrl(path));
  }
  // Static images (tiles, items)
  for (const { key, path } of STATIC_ASSETS) {
    scene.load.image(key, assetUrl(path));
  }
  // Character frames (each frame is its own image key)
  for (const frameSet of ALL_FRAME_SETS) {
    for (const { key, path } of frameSet) {
      scene.load.image(key, assetUrl(path));
    }
  }
}

// ===== SCALE FACTORS (MANDATORY — all assets are high-res 300 DPI) =====
// A mobile game viewport is ~500x700px. Raw assets are 800-3000px wide.
// EVERY sprite MUST use setScale(SCALES.xxx) or setDisplaySize(w, h).
// Without scaling, a single sprite fills the entire screen.
export const SCALES = {
  // Characters (~70-90px tall after scaling)
  player: 0.09,        // Robot frames: 995x677 -> ~90x61
  zombie: 0.08,        // Zombie frames: 861x886 -> ~69x71
  alien: 0.09,         // Alien frames: 819x630 -> ~74x57
  // Environment
  platform: 0.1,       // Platform: 2100x550 -> ~210x55
  platformSmall: 0.1,  // Small platform: 1200x500 -> ~120x50
  ground: 0.08,        // Ground wall: 2050x1200 -> ~164x96
  tree: 0.08,          // Tree: 800x1750 -> ~64x140
  grass: 0.1,          // Grass: 2150x450 -> ~215x45
  cloud: 0.06,         // Cloud: 3000x400 -> ~180x24
  // Items (128x128 originals — only moderate scaling needed)
  crystal: 0.3,        // Crystal: 128x128 -> ~38x38
  chest: 0.3,          // Chest: 128x128 -> ~38x38
  weapon: 0.06,        // Weapon: 921x305 -> ~55x18
};

// ===== PARALLAX ENVIRONMENT PACKS =====
// Each pack has multiple layers that stack to create depth.
// Layers scroll at different speeds — furthest layers slowest.
interface EnvLayer { key: string; path: string; speed: number; }
interface EnvPack { name: string; layers: EnvLayer[]; }

export const ENVIRONMENTS: Record<string, EnvPack> = {
  "nature": {
    name: "Green Valley",
    layers: [
      { key: "env-n-bg",      path: "environments/parallax/scrolling-backgrounds/4/_11_background.png", speed: 0 },
      { key: "env-n-dclouds", path: "environments/parallax/scrolling-backgrounds/4/_10_distant_clouds.png", speed: 0.03 },
      { key: "env-n-dclouds1",path: "environments/parallax/scrolling-backgrounds/4/_09_distant_clouds1.png", speed: 0.06 },
      { key: "env-n-clouds",  path: "environments/parallax/scrolling-backgrounds/4/_08_clouds.png", speed: 0.1 },
      { key: "env-n-hclouds", path: "environments/parallax/scrolling-backgrounds/4/_07_huge_clouds.png", speed: 0.15 },
      { key: "env-n-hill2",   path: "environments/parallax/scrolling-backgrounds/4/_06_hill2.png", speed: 0.25 },
      { key: "env-n-hill1",   path: "environments/parallax/scrolling-backgrounds/4/_05_hill1.png", speed: 0.35 },
      { key: "env-n-bushes",  path: "environments/parallax/scrolling-backgrounds/4/_04_bushes.png", speed: 0.45 },
      { key: "env-n-dtrees",  path: "environments/parallax/scrolling-backgrounds/4/_03_distant_trees.png", speed: 0.55 },
      { key: "env-n-trees",   path: "environments/parallax/scrolling-backgrounds/4/_02_trees and bushes.png", speed: 0.7 },
      { key: "env-n-ground",  path: "environments/parallax/scrolling-backgrounds/4/_01_ground.png", speed: 0.85 },
    ],
  },
  "forest": {
    name: "Deep Forest",
    layers: [
      { key: "env-f-8", path: "environments/parallax/scrolling-backgrounds/1/PNG/1_game_background/layers/8.png", speed: 0 },
      { key: "env-f-7", path: "environments/parallax/scrolling-backgrounds/1/PNG/1_game_background/layers/7.png", speed: 0.07 },
      { key: "env-f-6", path: "environments/parallax/scrolling-backgrounds/1/PNG/1_game_background/layers/6.png", speed: 0.15 },
      { key: "env-f-5", path: "environments/parallax/scrolling-backgrounds/1/PNG/1_game_background/layers/5.png", speed: 0.25 },
      { key: "env-f-4", path: "environments/parallax/scrolling-backgrounds/1/PNG/1_game_background/layers/4.png", speed: 0.38 },
      { key: "env-f-3", path: "environments/parallax/scrolling-backgrounds/1/PNG/1_game_background/layers/3.png", speed: 0.52 },
      { key: "env-f-2", path: "environments/parallax/scrolling-backgrounds/1/PNG/1_game_background/layers/2.png", speed: 0.68 },
      { key: "env-f-1", path: "environments/parallax/scrolling-backgrounds/1/PNG/1_game_background/layers/1.png", speed: 0.82 },
    ],
  },
  "dark": {
    name: "Dark World",
    layers: [
      { key: "env-d-6", path: "environments/parallax/scrolling-backgrounds/1/PNG/3_game_background/layers/6.png", speed: 0 },
      { key: "env-d-5", path: "environments/parallax/scrolling-backgrounds/1/PNG/3_game_background/layers/5.png", speed: 0.12 },
      { key: "env-d-4", path: "environments/parallax/scrolling-backgrounds/1/PNG/3_game_background/layers/4.png", speed: 0.28 },
      { key: "env-d-3", path: "environments/parallax/scrolling-backgrounds/1/PNG/3_game_background/layers/3.png", speed: 0.45 },
      { key: "env-d-2", path: "environments/parallax/scrolling-backgrounds/1/PNG/3_game_background/layers/2.png", speed: 0.65 },
      { key: "env-d-1", path: "environments/parallax/scrolling-backgrounds/1/PNG/3_game_background/layers/1.png", speed: 0.82 },
    ],
  },
  "mountains": {
    name: "Mountain Range",
    layers: [
      { key: "env-m-9", path: "environments/parallax/scrolling-backgrounds/2/PNG/3_game_background/layers/9.png", speed: 0 },
      { key: "env-m-8", path: "environments/parallax/scrolling-backgrounds/2/PNG/3_game_background/layers/8.png", speed: 0.06 },
      { key: "env-m-7", path: "environments/parallax/scrolling-backgrounds/2/PNG/3_game_background/layers/7.png", speed: 0.12 },
      { key: "env-m-6", path: "environments/parallax/scrolling-backgrounds/2/PNG/3_game_background/layers/6.png", speed: 0.2 },
      { key: "env-m-5", path: "environments/parallax/scrolling-backgrounds/2/PNG/3_game_background/layers/5.png", speed: 0.3 },
      { key: "env-m-4", path: "environments/parallax/scrolling-backgrounds/2/PNG/3_game_background/layers/4.png", speed: 0.42 },
      { key: "env-m-3", path: "environments/parallax/scrolling-backgrounds/2/PNG/3_game_background/layers/3.png", speed: 0.55 },
      { key: "env-m-2", path: "environments/parallax/scrolling-backgrounds/2/PNG/3_game_background/layers/2.png", speed: 0.7 },
      { key: "env-m-1", path: "environments/parallax/scrolling-backgrounds/2/PNG/3_game_background/layers/1.png", speed: 0.85 },
    ],
  },
  "simple": {
    name: "Simple Landscape",
    layers: [
      { key: "env-s-4", path: "environments/parallax/scrolling-backgrounds/3/png/4.png", speed: 0 },
      { key: "env-s-3", path: "environments/parallax/scrolling-backgrounds/3/png/3.png", speed: 0.2 },
      { key: "env-s-2", path: "environments/parallax/scrolling-backgrounds/3/png/2.png", speed: 0.5 },
      { key: "env-s-1", path: "environments/parallax/scrolling-backgrounds/3/png/1.png", speed: 0.8 },
    ],
  },
};

/**
 * Loads all layers for a parallax environment.
 * Call in BootScene.preload() BEFORE setupParallaxEnvironment() in create().
 */
export function preloadEnvironment(scene: Phaser.Scene, envId: string): void {
  const pack = ENVIRONMENTS[envId];
  if (!pack) return;
  for (const layer of pack.layers) {
    scene.load.image(layer.key, assetUrl(layer.path));
  }
}

/**
 * Set up an infinite-scrolling parallax background using tileSprite.
 * The background tiles horizontally and scrolls automatically as the
 * camera follows the player — no update() code needed by the caller.
 *
 * - Scaled to fill viewport height (no distortion, no gaps)
 * - Tiles infinitely in X direction (loops seamlessly)
 * - Auto-parallax: scrolls at parallaxSpeed relative to camera movement
 * - For menu/static scenes: pass parallaxSpeed=0 (static, no scrolling)
 * - Handles viewport resize (device rotation) automatically
 *
 * Call in create() BEFORE adding other game objects.
 */
export function setupBackground(
  scene: Phaser.Scene,
  key = "bg-nature",
  parallaxSpeed = 0.3,
): Phaser.GameObjects.TileSprite {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const bg = scene.add.tileSprite(w / 2, h / 2, w, h, key);
  bg.setDepth(-10);
  bg.setScrollFactor(0); // Fixed to camera — we scroll tilePosition instead

  // Scale texture to fill viewport height, maintain aspect ratio
  const tex = scene.textures.get(key).getSourceImage();
  const s = h / tex.height;
  bg.tileScaleX = s;
  bg.tileScaleY = s;

  // Auto-parallax: scroll background with camera movement
  if (parallaxSpeed > 0) {
    let prevCamX = scene.cameras.main.scrollX;
    scene.events.on("update", () => {
      const camX = scene.cameras.main.scrollX;
      const delta = camX - prevCamX;
      if (delta !== 0) {
        bg.tilePositionX += (delta * parallaxSpeed) / s;
        prevCamX = camX;
      }
    });
  }

  // Re-fit on viewport resize
  scene.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
    bg.setPosition(gameSize.width / 2, gameSize.height / 2);
    bg.setSize(gameSize.width, gameSize.height);
    const newS = gameSize.height / tex.height;
    bg.tileScaleX = newS;
    bg.tileScaleY = newS;
  });

  return bg;
}

/**
 * Creates a multi-layer parallax environment in GameScene.
 * Each layer is a tileSprite that scrolls at a different speed relative
 * to the camera, creating professional depth/parallax effect.
 *
 * Call in GameScene.create() BEFORE adding game objects.
 * Requires preloadEnvironment() to have been called in BootScene.preload().
 */
export function setupParallaxEnvironment(
  scene: Phaser.Scene,
  envId: string,
): Phaser.GameObjects.TileSprite[] {
  const pack = ENVIRONMENTS[envId];
  if (!pack) return [];

  const w = scene.scale.width;
  const h = scene.scale.height;
  const sprites: Phaser.GameObjects.TileSprite[] = [];

  for (let i = 0; i < pack.layers.length; i++) {
    const layer = pack.layers[i];
    const bg = scene.add.tileSprite(w / 2, h / 2, w, h, layer.key);
    bg.setDepth(-100 + i);
    bg.setScrollFactor(0);

    const tex = scene.textures.get(layer.key).getSourceImage();
    const s = h / tex.height;
    bg.tileScaleX = s;
    bg.tileScaleY = s;

    if (layer.speed > 0) {
      let prevCamX = scene.cameras.main.scrollX;
      scene.events.on("update", () => {
        const camX = scene.cameras.main.scrollX;
        const delta = camX - prevCamX;
        if (delta !== 0) {
          bg.tilePositionX += (delta * layer.speed) / s;
          prevCamX = camX;
        }
      });
    }

    sprites.push(bg);
  }

  scene.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
    for (const bg of sprites) {
      bg.setPosition(gameSize.width / 2, gameSize.height / 2);
      bg.setSize(gameSize.width, gameSize.height);
      const tex = scene.textures.get(bg.texture.key).getSourceImage();
      const newS = gameSize.height / tex.height;
      bg.tileScaleX = newS;
      bg.tileScaleY = newS;
    }
  });

  return sprites;
}

/**
 * Call in your BootScene.create() (after preload completes) to register
 * all standard animations. Then use sprite.play('player-run') anywhere.
 */
export function createAnimations(scene: Phaser.Scene): void {
  const anim = (key: string, frames: { key: string }[], rate: number, repeat = -1) => {
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: frames.map(f => ({ key: f.key })),
        frameRate: rate,
        repeat,
      });
    }
  };

  // Player (Robot)
  anim("player-run",    ROBOT_RUN,    16);
  anim("player-attack", ROBOT_ATTACK, 12, 0);
  anim("player-jump",   ROBOT_JUMP,   12, 0);
  anim("player-die",    ROBOT_DIE,    10, 0);

  // Zombie
  anim("zombie-walk",   ZOMBIE_WALK,   10);
  anim("zombie-attack", ZOMBIE_ATTACK, 12, 0);
  anim("zombie-die",    ZOMBIE_DIE,    10, 0);

  // Alien
  anim("alien-run",    ALIEN_RUN,    12);
  anim("alien-attack", ALIEN_ATTACK, 12, 0);
  anim("alien-die",    ALIEN_DIE,    10, 0);
}
`,
	},

	// ---------- Template 3: package.json with Phaser dependency ----------
	{
		path: "package.json",
		language: "json",
		content: `{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "phaser": "^3.90.0"
  }
}
`,
	},

	// ---------- Template 4: React wrapper for Phaser (eliminates AI-generated bugs) ----------
	{
		path: "src/components/Game.tsx",
		language: "typescript",
		content: `import { useEffect, useRef } from "react";
import Phaser from "phaser";

interface GameProps {
  scenes: (typeof Phaser.Scene | Phaser.Types.Scenes.SettingsConfig | Phaser.Types.Scenes.CreateSceneFromObjectConfig | Function)[];
  gravityY?: number;
  bgColor?: string;
}

/**
 * React wrapper for Phaser 3. Creates and destroys the game instance.
 * The AI should NOT modify this file — import and use it in App.tsx.
 *
 * Usage in App.tsx:
 *   import Game from "./components/Game";
 *   import { BootScene } from "./scenes/BootScene";
 *   import { MenuScene } from "./scenes/MenuScene";
 *   import { GameScene } from "./scenes/GameScene";
 *   import { GameOverScene } from "./scenes/GameOverScene";
 *   export default function App() {
 *     return <Game scenes={[BootScene, MenuScene, GameScene, GameOverScene]} />;
 *   }
 */
export default function Game({ scenes, gravityY = 800, bgColor = "#1a1a2e" }: GameProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: Math.min(window.innerWidth, 500),
      height: window.innerHeight,
      parent: containerRef.current,
      backgroundColor: bgColor,
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: gravityY }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: scenes,
    };

    gameRef.current = new Phaser.Game(config);

    // Pause/resume on visibility change (mobile tab switch)
    const onVisChange = () => {
      if (!gameRef.current) return;
      if (document.hidden) gameRef.current.scene.scenes.forEach(s => { if (s.scene.isActive()) s.scene.pause(); });
      else gameRef.current.scene.scenes.forEach(s => { if (s.scene.isPaused()) s.scene.resume(); });
    };
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisChange);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", touchAction: "none", overflow: "hidden" }}
    />
  );
}
`,
	},
];
