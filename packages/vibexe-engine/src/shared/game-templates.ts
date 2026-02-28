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

// ===== CHARACTER FRAMES =====
const R1 = "characters/arz-game-kit/ROBOTS/robot1";
export const ROBOT_RUN    = fr(R1, "run/robot1-run",       [0,7,14,21,28,35,42,49]);
export const ROBOT_ATTACK = fr(R1, "attack/robot1-attack", [0,5,10,15,20]);
export const ROBOT_JUMP   = fr(R1, "jump/robot1-jump",     [0,5,10,15]);
export const ROBOT_DIE    = fr(R1, "die/robot1-die",       [0,5,10]);

const Z1 = "characters/arz-game-kit/ZOMBIES/zombie1";
export const ZOMBIE_WALK   = fr(Z1, "walk/zombie1-walk",     [0,7,14,21]);
export const ZOMBIE_ATTACK = fr(Z1, "attack/zombie1-attack", [0,5,10,15]);
export const ZOMBIE_DIE    = fr(Z1, "die/zombie1-die",       [0,5,10]);

const A1 = "characters/arz-game-kit/ALIENS/alien1";
export const ALIEN_RUN    = fr(A1, "run/alien1-run",       [0,8,16,24,32,40]);
export const ALIEN_ATTACK = fr(A1, "attack/alien1-attack", [0,5,10,15]);
export const ALIEN_DIE    = fr(A1, "die/alien1-die",       [0,5,10]);

// ===== STATIC IMAGE KEYS =====
export const STATIC_ASSETS: { key: string; path: string }[] = [
  { key: "bg-forest",      path: "environments/backgrounds/arz-backgrounds/1920x1080/BG forest 1.jpg" },
  { key: "bg-space",       path: "environments/backgrounds/arz-backgrounds/1920x1080/BG space 1.jpg" },
  { key: "bg-alien",       path: "environments/backgrounds/arz-backgrounds/1920x1080/BG alien 1.jpg" },
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
  // Static images
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
];
