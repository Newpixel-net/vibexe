/**
 * Game Assets Reference — Media stock catalog, sprite loading patterns, and mobile mastery guide.
 *
 * Injected into game-developer agent prompt. Edit HERE to update all game generation.
 * Asset files served from: /opt/vibexe/media-stock/games/ via /api/app-builder/media-stock/
 *
 * IMPORTANT: Every path below has been VERIFIED on the live server. Do NOT guess or invent paths.
 */

// Single combined export — this is the FIRST thing in the game developer's asset section
export const GAME_ASSETS_REFERENCE = `
## MANDATORY Asset System — READ BEFORE GENERATING ANY CODE

### RULES:
1. Copy the code blocks below VERBATIM. Do NOT simplify, shorten, or "clean up" any paths.
2. NEVER invent CDN domains or external URLs. The ASSET() function below is the ONLY way to load assets.
3. NEVER use URLs like "https://media.vibexe.com/...", "https://cdn.vibexe.com/...", or ANY external image service.
4. ALL assets are loaded through the ASSET() helper which reads window.__VIBEXE_API_ORIGIN__ (auto-injected at runtime).

---

### Step 1: Create src/assets/loader.ts — COPY EXACTLY
\`\`\`typescript
// src/assets/loader.ts — COPY THIS FILE EXACTLY
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
      console.warn("Asset failed to load:", path);
      const fallback = new Image(1, 1);
      fallback.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      resolve(fallback);
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
  update(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= 1 / this.fps) { this.elapsed -= 1 / this.fps; this.currentFrame = (this.currentFrame + 1) % this.frames.length; }
  }
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.frames.length > 0) ctx.drawImage(this.frames[this.currentFrame], x, y, w, h);
  }
  drawFlipped(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.frames.length > 0) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(this.frames[this.currentFrame], 0, 0, w, h); ctx.restore(); }
  }
  reset(): void { this.currentFrame = 0; this.elapsed = 0; }
}
\`\`\`

---

### Step 2: Create src/constants.ts asset paths — COPY EXACTLY

**WARNING: These paths are VERIFIED on the live server. Do NOT modify them. Do NOT add PNG/, HD/, PartsHD/, or ANY other subdirectory. The paths below are the EXACT directory structure.**

\`\`\`typescript
// src/constants.ts — ASSET PATHS — COPY VERBATIM, DO NOT MODIFY

// ===== PLAYER (Robot) =====
export const PLAYER_RUN_FRAMES = [
  "characters/arz-game-kit/ROBOTS/robot1/run/robot1-run0.png",
  "characters/arz-game-kit/ROBOTS/robot1/run/robot1-run7.png",
  "characters/arz-game-kit/ROBOTS/robot1/run/robot1-run14.png",
  "characters/arz-game-kit/ROBOTS/robot1/run/robot1-run21.png",
  "characters/arz-game-kit/ROBOTS/robot1/run/robot1-run28.png",
  "characters/arz-game-kit/ROBOTS/robot1/run/robot1-run35.png",
  "characters/arz-game-kit/ROBOTS/robot1/run/robot1-run42.png",
  "characters/arz-game-kit/ROBOTS/robot1/run/robot1-run49.png",
];
export const PLAYER_ATTACK_FRAMES = [
  "characters/arz-game-kit/ROBOTS/robot1/attack/robot1-attack0.png",
  "characters/arz-game-kit/ROBOTS/robot1/attack/robot1-attack5.png",
  "characters/arz-game-kit/ROBOTS/robot1/attack/robot1-attack10.png",
  "characters/arz-game-kit/ROBOTS/robot1/attack/robot1-attack15.png",
  "characters/arz-game-kit/ROBOTS/robot1/attack/robot1-attack20.png",
];
export const PLAYER_JUMP_FRAMES = [
  "characters/arz-game-kit/ROBOTS/robot1/jump/robot1-jump0.png",
  "characters/arz-game-kit/ROBOTS/robot1/jump/robot1-jump5.png",
  "characters/arz-game-kit/ROBOTS/robot1/jump/robot1-jump10.png",
  "characters/arz-game-kit/ROBOTS/robot1/jump/robot1-jump15.png",
];
export const PLAYER_DIE_FRAMES = [
  "characters/arz-game-kit/ROBOTS/robot1/die/robot1-die0.png",
  "characters/arz-game-kit/ROBOTS/robot1/die/robot1-die5.png",
  "characters/arz-game-kit/ROBOTS/robot1/die/robot1-die10.png",
];

// ===== ENEMIES =====
export const ZOMBIE_WALK_FRAMES = [
  "characters/arz-game-kit/ZOMBIES/zombie1/walk/zombie1-walk0.png",
  "characters/arz-game-kit/ZOMBIES/zombie1/walk/zombie1-walk7.png",
  "characters/arz-game-kit/ZOMBIES/zombie1/walk/zombie1-walk14.png",
  "characters/arz-game-kit/ZOMBIES/zombie1/walk/zombie1-walk21.png",
];
export const ZOMBIE_ATTACK_FRAMES = [
  "characters/arz-game-kit/ZOMBIES/zombie1/attack/zombie1-attack0.png",
  "characters/arz-game-kit/ZOMBIES/zombie1/attack/zombie1-attack5.png",
  "characters/arz-game-kit/ZOMBIES/zombie1/attack/zombie1-attack10.png",
  "characters/arz-game-kit/ZOMBIES/zombie1/attack/zombie1-attack15.png",
];
export const ZOMBIE_DIE_FRAMES = [
  "characters/arz-game-kit/ZOMBIES/zombie1/die/zombie1-die0.png",
  "characters/arz-game-kit/ZOMBIES/zombie1/die/zombie1-die5.png",
  "characters/arz-game-kit/ZOMBIES/zombie1/die/zombie1-die10.png",
];
export const ALIEN_RUN_FRAMES = [
  "characters/arz-game-kit/ALIENS/alien1/run/alien1-run0.png",
  "characters/arz-game-kit/ALIENS/alien1/run/alien1-run8.png",
  "characters/arz-game-kit/ALIENS/alien1/run/alien1-run16.png",
  "characters/arz-game-kit/ALIENS/alien1/run/alien1-run24.png",
  "characters/arz-game-kit/ALIENS/alien1/run/alien1-run32.png",
  "characters/arz-game-kit/ALIENS/alien1/run/alien1-run40.png",
];
export const ALIEN_ATTACK_FRAMES = [
  "characters/arz-game-kit/ALIENS/alien1/attack/alien1-attack0.png",
  "characters/arz-game-kit/ALIENS/alien1/attack/alien1-attack5.png",
  "characters/arz-game-kit/ALIENS/alien1/attack/alien1-attack10.png",
  "characters/arz-game-kit/ALIENS/alien1/attack/alien1-attack15.png",
];
export const ALIEN_DIE_FRAMES = [
  "characters/arz-game-kit/ALIENS/alien1/die/alien1-die0.png",
  "characters/arz-game-kit/ALIENS/alien1/die/alien1-die5.png",
  "characters/arz-game-kit/ALIENS/alien1/die/alien1-die10.png",
];

// ===== ENVIRONMENT =====
export const BACKGROUND = "environments/backgrounds/arz-backgrounds/1920x1080/BG alien 1.jpg";
export const BACKGROUND_2 = "environments/backgrounds/arz-backgrounds/1920x1080/BG space 1.jpg";
export const PLATFORM_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_1.png";
export const PLATFORM_SMALL = "environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_sml_1.png";
export const GROUND_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Grounds/Ground_Wall.png";
export const CLIFF_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Grounds/Cliff.png";
export const TREE_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Tree/Tree_1.png";
export const TREE_BIG_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Tree/Tree_Big_1.png";
export const GRASS_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Grass/Ground_Grass.png";
export const CLOUD_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Clouds/Cloud_1.png";

// ===== ITEMS =====
export const WEAPON_IMG = "items/weapons/arz-weapons/Weapon_1.png";
export const WEAPON_FIRE_IMG = "items/weapons/arz-weapons/Weapon_1-Fire.png";
export const CRYSTAL_IMG = "items/collectibles/treasure/crystal01.png";
export const CHEST_IMG = "items/collectibles/treasure/chest1_128.png";
export const CHEST_OPEN_IMG = "items/collectibles/treasure/openchest1_128.png";
\`\`\`

---

### Step 3: Use assets in GameCanvas — pattern
\`\`\`typescript
import { loadImage, loadFrames, SpriteAnimation } from "../assets/loader";
import * as C from "../constants";

// In useEffect async init:
const bgImg = await loadImage(C.BACKGROUND);
const platformImg = await loadImage(C.PLATFORM_IMG);
const groundImg = await loadImage(C.GROUND_IMG);
const weaponImg = await loadImage(C.WEAPON_IMG);
const crystalImg = await loadImage(C.CRYSTAL_IMG);

const playerRunFrames = await loadFrames(C.PLAYER_RUN_FRAMES);
const playerAttackFrames = await loadFrames(C.PLAYER_ATTACK_FRAMES);
const playerJumpFrames = await loadFrames(C.PLAYER_JUMP_FRAMES);
const zombieWalkFrames = await loadFrames(C.ZOMBIE_WALK_FRAMES);
const alienRunFrames = await loadFrames(C.ALIEN_RUN_FRAMES);

const playerRun = new SpriteAnimation(playerRunFrames, 16);
const playerAttack = new SpriteAnimation(playerAttackFrames, 12);
const zombieWalk = new SpriteAnimation(zombieWalkFrames, 10);
const alienRun = new SpriteAnimation(alienRunFrames, 12);

// In render loop:
ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);                  // background
ctx.drawImage(platformImg, platX - cameraX, platY, 200, 40);              // platform
playerRun.update(dt);
if (facingRight) playerRun.draw(ctx, px, py, 64, 64);                     // player
else playerRun.drawFlipped(ctx, px, py, 64, 64);
zombieWalk.update(dt);
zombieWalk.draw(ctx, ex - cameraX, ey, 64, 64);                           // enemy
ctx.drawImage(crystalImg, cx - cameraX, cy, 32, 32);                      // collectible
\`\`\`

---

### Additional Characters (for variety — change the number)
\`\`\`
robot2, robot3 ... robot12 → characters/arz-game-kit/ROBOTS/robot{N}/run/robot{N}-run0.png
alien2, alien3 ... alien10  → characters/arz-game-kit/ALIENS/alien{N}/run/alien{N}-run0.png
zombie2, zombie3 ... zombie11 → characters/arz-game-kit/ZOMBIES/zombie{N}/walk/zombie{N}-walk0.png
\`\`\`

### Additional Environments
- Desert parallax: \`environments/parallax/desert/9 Background.png\`, \`5 Mountains.png\`, \`1 Layer1.png\`
- More backgrounds: \`environments/backgrounds/arz-backgrounds/1920x1080/BG space 1.jpg\` through \`BG space 5.jpg\`
- More platforms: \`Platform_2.png\`, \`Platform_3.png\`, \`Platform_End.png\`, \`Platform_Slope.png\`
- More trees: \`Tree_2.png\`, \`Tree_3.png\`, \`Tree_Big_2.png\`
- Shrubs: \`environments/tilesets/forest-pack/300_DPI PNG/Shrubs/Shrub_1.png\` through \`Shrub_5.png\`

### When to Use Sprites vs Shapes
- **ALWAYS use sprites**: action games, platformers, shooters, RPGs, runners
- **Use shapes/emoji ONLY for**: abstract puzzles (2048, Tetris), card games, Pong/Breakout
- For action games: NEVER use emoji for characters. ALWAYS use the sprite paths above.
`;

export const MOBILE_GAME_MASTERY = `
## Mobile Game Mastery — Touch-ONLY Design

### Touch-ONLY Mandate
For mobile games: **NO keyboard event listeners at all.** Touch is the ONLY input.
Do NOT add \`window.addEventListener("keydown", ...)\`.

### Gesture Vocabulary
| Genre | Gesture | Implementation |
|-------|---------|----------------|
| Platformer | On-screen buttons | Fixed position touch zones for left/right/jump/shoot |
| Flappy | Tap anywhere | \`touchstart\` → upward impulse |
| Runner | Swipe/tap | \`touchstart\`+\`touchend\` → direction |
| Shooter | On-screen D-pad + fire | Touch zones at bottom corners |

### Mobile Canvas Setup
\`\`\`typescript
const dpr = window.devicePixelRatio || 1;
const w = Math.min(window.innerWidth, 500);
const h = window.innerHeight;
canvas.width = w * dpr;
canvas.height = h * dpr;
canvas.style.width = w + "px";
canvas.style.height = h + "px";
ctx.scale(dpr, dpr);
canvas.style.touchAction = "none";
canvas.style.userSelect = "none";
\`\`\`

### Sprite Sizing for Mobile
- Characters: 48-80px, Tiles: 32-48px, Tap targets: min 48px, HUD text: min 16px

### Loading Screen
Show a progress bar while assets preload. Target < 3s total load.

### Audio on Mobile
\`\`\`typescript
let audioCtx: AudioContext | null = null;
function initAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
// Call initAudio() inside first touchstart handler
\`\`\`
`;
