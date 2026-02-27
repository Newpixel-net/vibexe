/**
 * Game Assets Reference — Compact asset catalog for game-developer agent.
 *
 * Injected into game-developer agent prompt. Edit HERE to update all game generation.
 * Assets served from: /opt/vibexe/media-stock/games/ via /api/app-builder/media-stock/
 *
 * VERIFIED on live server. All paths are real PNG/JPG files. NO GIF files exist.
 */

export const GAME_ASSETS_REFERENCE = `
## Asset Loading — MANDATORY for action/platformer/shooter/runner games

FORBIDDEN in action games:
- data:image/svg+xml or data:image/png base64 URIs for characters
- ctx.fillRect() colored rectangles for characters/enemies
- Emoji for characters: ctx.fillText("🤖", x, y)
- External CDN URLs
- GIF files (none exist in database — ALL assets are PNG or JPG)

### FILE 1: src/assets/loader.ts — Create this EXACTLY as shown
\`\`\`typescript
export function ASSET(path: string): string {
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
\`\`\`

### FILE 2: src/constants.ts — Asset paths (add your game constants too)

Use .map() to generate frame arrays from base paths. Frame numbers are EXACT — do not change them.

\`\`\`typescript
// ===== ASSET HELPER (generates frame path arrays) =====
const frames = (base: string, prefix: string, nums: number[]) =>
  nums.map(n => \`\${base}/\${prefix}\${n}.png\`);

// ===== PLAYER (Robot) =====
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

// ===== YOUR GAME CONSTANTS GO HERE =====
// export const GRAVITY = 1800;
// export const PLAYER_SPEED = 300;
// etc.
\`\`\`

### FILE 3: GameCanvas.tsx — Asset preloading pattern

In your GameCanvas useEffect, preload ALL assets before starting the game loop:

\`\`\`typescript
import { loadImage, loadFrames, SpriteAnimation } from "../assets/loader";
import * as C from "../constants";

interface GameAssets {
  bg: HTMLImageElement;
  platform: HTMLImageElement;
  ground: HTMLImageElement;
  crystal: HTMLImageElement;
  playerRun: SpriteAnimation;
  playerJump: SpriteAnimation;
  playerAttack: SpriteAnimation;
  zombieWalk: SpriteAnimation;
  alienRun: SpriteAnimation;
}

async function preloadAllAssets(): Promise<GameAssets> {
  const [bg, platform, ground, crystal, pRun, pJump, pAtk, zWalk, aRun] = await Promise.all([
    loadImage(C.BACKGROUND_FOREST),
    loadImage(C.PLATFORM_IMG),
    loadImage(C.GROUND_IMG),
    loadImage(C.CRYSTAL_IMG),
    loadFrames(C.PLAYER_RUN_FRAMES),
    loadFrames(C.PLAYER_JUMP_FRAMES),
    loadFrames(C.PLAYER_ATTACK_FRAMES),
    loadFrames(C.ZOMBIE_WALK_FRAMES),
    loadFrames(C.ALIEN_RUN_FRAMES),
  ]);
  return {
    bg, platform, ground, crystal,
    playerRun: new SpriteAnimation(pRun, 16),
    playerJump: new SpriteAnimation(pJump, 12),
    playerAttack: new SpriteAnimation(pAtk, 12),
    zombieWalk: new SpriteAnimation(zWalk, 10),
    alienRun: new SpriteAnimation(aRun, 12),
  };
}

// In useEffect:
// 1. Show "Loading..." text on canvas
// 2. Call preloadAllAssets().then(assets => { ... start game loop ... })
// 3. In render(): use assets.playerRun.draw(ctx, x, y, 64, 64) — NEVER ctx.fillRect for characters
// 4. Call animation.update(dt) each frame before drawing
\`\`\`

### Alternative character packs (use ONLY when user explicitly asks):
- "ninja" → single image: "characters/heroes/ninja/Ninja Postac.png"
- "kenney platformer" → "characters/heroes/kenney-platformer-characters/PNG/Player/Poses/player_walk1.png", player_walk2.png, player_jump.png, player_idle.png
- "red-bot shooter" → "characters/heroes/red-bot/PNG's/r_run_1.png" through r_run_8.png, r_jump_1.png through r_jump_20.png
- "boy scout" → "characters/heroes/boy-scout/png/run-0001.png" through run-0008.png

### Sprites vs Shapes rule:
- Action/platformer/shooter/runner → ALWAYS use sprites via ASSET() + loadImage()
- Abstract puzzles (2048, Tetris, Minesweeper, Pong) → shapes/emoji OK
`;
