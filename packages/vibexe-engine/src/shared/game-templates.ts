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
	{
		path: "src/assets/loader.ts",
		language: "typescript",
		content: `export function ASSET(path: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || "";
  return \`\${origin}/api/app-builder/media-stock/\${encodeURI(path)}\`;
}

export function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn("Asset failed:", path);
      const fb = new Image(1, 1);
      fb.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      resolve(fb);
    };
    img.src = ASSET(path);
  });
}

export async function loadFrames(paths: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(paths.map(p => loadImage(p)));
}

export class SpriteAnimation {
  frames: HTMLImageElement[];
  fps: number;
  currentFrame = 0;
  elapsed = 0;
  constructor(frames: HTMLImageElement[], fps = 12) { this.frames = frames; this.fps = fps; }
  update(dt: number) {
    this.elapsed += dt;
    if (this.elapsed >= 1 / this.fps) { this.elapsed -= 1 / this.fps; this.currentFrame = (this.currentFrame + 1) % this.frames.length; }
  }
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    if (this.frames.length > 0) ctx.drawImage(this.frames[this.currentFrame], x, y, w, h);
  }
  drawFlipped(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    if (this.frames.length > 0) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(this.frames[this.currentFrame], 0, 0, w, h); ctx.restore(); }
  }
}
`,
	},
	{
		path: "src/constants.ts",
		language: "typescript",
		content: `// ===== ASSET HELPER (generates frame path arrays) =====
const frames = (base: string, prefix: string, nums: number[]) =>
  nums.map(n => \`\${base}/\${prefix}\${n}.png\`);

// ===== PLAYER (Robot — default character) =====
const R1 = "characters/arz-game-kit/ROBOTS/robot1";
export const PLAYER_RUN_FRAMES = frames(R1, "run/robot1-run", [0,7,14,21,28,35,42,49]);
export const PLAYER_ATTACK_FRAMES = frames(R1, "attack/robot1-attack", [0,5,10,15,20]);
export const PLAYER_JUMP_FRAMES = frames(R1, "jump/robot1-jump", [0,5,10,15]);
export const PLAYER_DIE_FRAMES = frames(R1, "die/robot1-die", [0,5,10]);

// ===== ENEMIES =====
const Z1 = "characters/arz-game-kit/ZOMBIES/zombie1";
export const ZOMBIE_WALK_FRAMES = frames(Z1, "walk/zombie1-walk", [0,7,14,21]);
export const ZOMBIE_ATTACK_FRAMES = frames(Z1, "attack/zombie1-attack", [0,5,10,15]);
export const ZOMBIE_DIE_FRAMES = frames(Z1, "die/zombie1-die", [0,5,10]);

const A1 = "characters/arz-game-kit/ALIENS/alien1";
export const ALIEN_RUN_FRAMES = frames(A1, "run/alien1-run", [0,8,16,24,32,40]);
export const ALIEN_ATTACK_FRAMES = frames(A1, "attack/alien1-attack", [0,5,10,15]);
export const ALIEN_DIE_FRAMES = frames(A1, "die/alien1-die", [0,5,10]);

// ===== ENVIRONMENT =====
export const BACKGROUND_FOREST = "environments/backgrounds/arz-backgrounds/1920x1080/BG forest 1.jpg";
export const BACKGROUND_SPACE = "environments/backgrounds/arz-backgrounds/1920x1080/BG space 1.jpg";
export const BACKGROUND_ALIEN = "environments/backgrounds/arz-backgrounds/1920x1080/BG alien 1.jpg";
export const PLATFORM_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_1.png";
export const PLATFORM_SMALL = "environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_sml_1.png";
export const GROUND_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Grounds/Ground_Wall.png";
export const TREE_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Tree/Tree_1.png";
export const GRASS_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Grass/Ground_Grass.png";
export const CLOUD_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Clouds/Cloud_1.png";

// ===== ITEMS =====
export const CRYSTAL_IMG = "items/collectibles/treasure/crystal01.png";
export const CHEST_IMG = "items/collectibles/treasure/chest1_128.png";
export const WEAPON_IMG = "items/weapons/arz-weapons/Weapon_1.png";

// ===== GAME CONSTANTS (modify these for your game) =====
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const GRAVITY = 1800;
export const PLAYER_SPEED = 300;
export const JUMP_FORCE = -650;
export const PLAYER_SIZE = 64;
export const ENEMY_SIZE = 64;
export const GROUND_Y = 520;
`,
	},
];
