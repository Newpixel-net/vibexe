/**
 * Game Assets Reference — Media stock catalog, sprite loading patterns, and mobile mastery guide.
 *
 * Injected into game-developer agent prompt. Edit HERE to update all game generation.
 * Asset files served from: /opt/vibexe/media-stock/games/ via /api/app-builder/media-stock/
 *
 * IMPORTANT: Every path below has been VERIFIED on the live server. Do NOT guess or invent paths.
 */

export const GAME_ASSETS_REFERENCE = `
## MANDATORY: Sprite-Based Asset Loading for Action Games

### FORBIDDEN — NEVER generate these in action/platformer/shooter/runner games:
\`\`\`
NEVER: data:image/svg+xml;base64,...         (inline SVG data URIs for sprites)
NEVER: data:image/png;base64,...             (inline base64 images for characters)
NEVER: ctx.fillRect() for player/enemy       (colored rectangles for characters)
NEVER: ctx.fillText("emoji", x, y)           (emoji for characters in action games)
NEVER: "https://cdn.example.com/sprite.png"  (external CDN URLs)
\`\`\`
If you catch yourself writing ANY of these for a character, enemy, or background — STOP. Delete it. Use the ASSET() + loadImage() pattern below instead.

### REQUIRED — Every action game MUST have these 3 files:
1. \`src/assets/loader.ts\` — ASSET() helper + loadImage + SpriteAnimation (Step 1)
2. \`src/constants.ts\` — Sprite paths as exported string arrays (Step 2)
3. \`src/components/GameCanvas.tsx\` — Calls loadFrames() in useEffect, renders with ctx.drawImage (Step 3)

### CHARACTER SELECTION — Pick the BEST match for the user's request:
- "robot" / "sci-fi" / "red robot" → Use DEFAULT SET (ARZ robot1)
- "shooter" / "run and gun" / "red-bot" → Use RED-BOT SET
- "platformer" / "adventure" → Use KENNEY SET
- "boy" / "scout" / "explorer" → Use BOY-SCOUT SET
- "ninja" → Use NINJA SET (static single-frame)
- "zombie" → DEFAULT SET zombie enemies
- "alien" / "space" → DEFAULT SET alien enemies
- "pixel art" → characters/heroes/kenney-pixel-platformer/Tiles/Characters/
- "girl" / "boy and girl" → characters/heroes/girl-boy/
- "swordsman" / "warrior" → characters/heroes/burly-man/BURLY-MAN_1_swordsman/
- "RPG" / "fantasy" / "golem" → characters/carecter-collection/Golem_2/PNG/
- "reaper" / "dark" → characters/carecter-collection/Reaper_Man_3/PNG/
ONLY use default robot1 if NO pack matches. NEVER use emoji/shapes when sprites exist.

### RULES:
1. Copy code blocks below VERBATIM. Do NOT simplify or modify paths.
2. ASSET() is the ONLY way to load images. It reads window.__VIBEXE_API_ORIGIN__ (auto-injected).
3. NEVER invent CDN domains or external URLs.
4. Use CONSISTENT export names (PLAYER_RUN_FRAMES, PLAYER_JUMP_FRAMES, etc.) regardless of character set.

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
      console.warn("Asset failed:", path);
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

### Step 2: Add asset paths to src/constants.ts

Pick ONE character set matching the user's game, then ALSO copy the environment + items block.

**ENVIRONMENT + ITEMS (always include these):**
\`\`\`typescript
// ===== ENVIRONMENT =====
export const BACKGROUND = "environments/backgrounds/arz-backgrounds/1920x1080/BG alien 1.jpg";
export const BACKGROUND_FOREST = "environments/backgrounds/arz-backgrounds/1920x1080/BG forest 1.jpg";
export const BACKGROUND_SPACE = "environments/backgrounds/arz-backgrounds/1920x1080/BG space 1.jpg";
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

**DEFAULT CHARACTER SET — Robot hero + Zombie/Alien enemies:**
\`\`\`typescript
// ===== PLAYER (ARZ Robot) =====
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
\`\`\`

**RED-BOT CHARACTER SET — Use for "red bot", "shooter", "run and gun", "red robot":**
\`\`\`typescript
// ===== PLAYER (Red-Bot — shooter hero, 16-frame run) =====
export const PLAYER_RUN_FRAMES = [
  "characters/heroes/red-bot/PNG's/r_run_1.png",
  "characters/heroes/red-bot/PNG's/r_run_2.png",
  "characters/heroes/red-bot/PNG's/r_run_3.png",
  "characters/heroes/red-bot/PNG's/r_run_4.png",
  "characters/heroes/red-bot/PNG's/r_run_5.png",
  "characters/heroes/red-bot/PNG's/r_run_6.png",
  "characters/heroes/red-bot/PNG's/r_run_7.png",
  "characters/heroes/red-bot/PNG's/r_run_8.png",
];
export const PLAYER_JUMP_FRAMES = [
  "characters/heroes/red-bot/PNG's/r_jump_1.png",
  "characters/heroes/red-bot/PNG's/r_jump_4.png",
  "characters/heroes/red-bot/PNG's/r_jump_8.png",
  "characters/heroes/red-bot/PNG's/r_jump_12.png",
  "characters/heroes/red-bot/PNG's/r_jump_16.png",
  "characters/heroes/red-bot/PNG's/r_jump_20.png",
];
export const PLAYER_DIE_FRAMES = [
  "characters/heroes/red-bot/PNG's/r_death_1.png",
  "characters/heroes/red-bot/PNG's/r_death_4.png",
  "characters/heroes/red-bot/PNG's/r_death_8.png",
  "characters/heroes/red-bot/PNG's/r_death_12.png",
  "characters/heroes/red-bot/PNG's/r_death_16.png",
];
export const PLAYER_IDLE_FRAMES = [
  "characters/heroes/red-bot/PNG's/r_idle_1.png",
  "characters/heroes/red-bot/PNG's/r_idle_5.png",
  "characters/heroes/red-bot/PNG's/r_idle_10.png",
  "characters/heroes/red-bot/PNG's/r_idle_15.png",
  "characters/heroes/red-bot/PNG's/r_idle_20.png",
];
export const PLAYER_SLIDE_FRAMES = [
  "characters/heroes/red-bot/PNG's/r_slide_1.png",
  "characters/heroes/red-bot/PNG's/r_slide_3.png",
  "characters/heroes/red-bot/PNG's/r_slide_5.png",
  "characters/heroes/red-bot/PNG's/r_slide_7.png",
  "characters/heroes/red-bot/PNG's/r_slide_10.png",
];
export const PLAYER_SHOOT_IMG = "characters/heroes/red-bot/PNG's/r_stand_shoot.png";
export const PLAYER_RUN_SHOOT_FRAMES = [
  "characters/heroes/red-bot/PNG's/r_run_shoot_1.png",
  "characters/heroes/red-bot/PNG's/r_run_shoot_4.png",
  "characters/heroes/red-bot/PNG's/r_run_shoot_8.png",
  "characters/heroes/red-bot/PNG's/r_run_shoot_12.png",
  "characters/heroes/red-bot/PNG's/r_run_shoot_16.png",
];
\`\`\`

**BOY-SCOUT CHARACTER SET — Use for "boy", "scout", "explorer":**
\`\`\`typescript
// ===== PLAYER (Boy-Scout — explorer, 8-frame run) =====
export const PLAYER_RUN_FRAMES = [
  "characters/heroes/boy-scout/png/run-0001.png",
  "characters/heroes/boy-scout/png/run-0002.png",
  "characters/heroes/boy-scout/png/run-0003.png",
  "characters/heroes/boy-scout/png/run-0004.png",
  "characters/heroes/boy-scout/png/run-0005.png",
  "characters/heroes/boy-scout/png/run-0006.png",
  "characters/heroes/boy-scout/png/run-0007.png",
  "characters/heroes/boy-scout/png/run-0008.png",
];
export const PLAYER_ATTACK_FRAMES = [
  "characters/heroes/boy-scout/png/attack-0001.png",
  "characters/heroes/boy-scout/png/attack-0002.png",
  "characters/heroes/boy-scout/png/attack-0003.png",
  "characters/heroes/boy-scout/png/attack-0004.png",
];
export const PLAYER_DIE_FRAMES = [
  "characters/heroes/boy-scout/png/die-0001.png",
  "characters/heroes/boy-scout/png/die-0002.png",
  "characters/heroes/boy-scout/png/die-0003.png",
  "characters/heroes/boy-scout/png/die-0004.png",
];
export const PLAYER_IDLE_IMG = "characters/heroes/boy-scout/png/idle.png";
export const PLAYER_JUMP_IMG = "characters/heroes/boy-scout/png/jump.png";
\`\`\`

**KENNEY CHARACTER SET — Use for "platformer", generic adventure:**
\`\`\`typescript
// ===== PLAYER (Kenney — classic platformer, alternate walk1/walk2 for animation) =====
export const PLAYER_IDLE_IMG = "characters/heroes/kenney-platformer-characters/PNG/Player/Poses/player_idle.png";
export const PLAYER_RUN_FRAMES = [
  "characters/heroes/kenney-platformer-characters/PNG/Player/Poses/player_walk1.png",
  "characters/heroes/kenney-platformer-characters/PNG/Player/Poses/player_walk2.png",
];
export const PLAYER_JUMP_IMG = "characters/heroes/kenney-platformer-characters/PNG/Player/Poses/player_jump.png";
export const PLAYER_DUCK_IMG = "characters/heroes/kenney-platformer-characters/PNG/Player/Poses/player_duck.png";
export const ZOMBIE_WALK_FRAMES = [
  "characters/heroes/kenney-platformer-characters/PNG/Zombie/Poses/zombie_walk1.png",
  "characters/heroes/kenney-platformer-characters/PNG/Zombie/Poses/zombie_walk2.png",
];
\`\`\`

**NINJA CHARACTER SET — Static single frame:**
\`\`\`typescript
export const PLAYER_IMG = "characters/heroes/ninja/Ninja Postac.png";
\`\`\`

---

### Step 3: Wire up asset loading in GameCanvas.tsx — COMPLETE PATTERN

This is the EXACT pattern your GameCanvas.tsx must follow. Adapt the specific constants to match the character set you chose above.

\`\`\`typescript
import React, { useRef, useEffect } from "react";
import { loadImage, loadFrames, SpriteAnimation } from "../assets/loader";
import * as C from "../constants";

interface GameAssets {
  bg: HTMLImageElement;
  platform: HTMLImageElement;
  ground: HTMLImageElement;
  crystal: HTMLImageElement;
  playerRun: SpriteAnimation;
  playerJump: SpriteAnimation;
  zombieWalk: SpriteAnimation;
}

async function preloadAllAssets(): Promise<GameAssets> {
  const [bg, platform, ground, crystal, runImgs, jumpImgs, zombieImgs] =
    await Promise.all([
      loadImage(C.BACKGROUND),
      loadImage(C.PLATFORM_IMG),
      loadImage(C.GROUND_IMG),
      loadImage(C.CRYSTAL_IMG),
      loadFrames(C.PLAYER_RUN_FRAMES),
      loadFrames(C.PLAYER_JUMP_FRAMES),
      loadFrames(C.ZOMBIE_WALK_FRAMES),
    ]);
  return {
    bg, platform, ground, crystal,
    playerRun: new SpriteAnimation(runImgs, 16),
    playerJump: new SpriteAnimation(jumpImgs, 12),
    zombieWalk: new SpriteAnimation(zombieImgs, 10),
  };
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<any>({ state: "loading", assets: null });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let lastTime = 0;

    // Show loading screen, then preload all sprites
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Loading assets...", canvas.width / 2, canvas.height / 2);

    preloadAllAssets().then((assets) => {
      const g = gameRef.current;
      g.assets = assets;
      g.state = "menu"; // assets loaded, show menu

      function loop(timestamp: number) {
        const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;
        update(g, dt);
        render(ctx, g, canvas.width, canvas.height);
        g.frameId = requestAnimationFrame(loop);
      }
      g.frameId = requestAnimationFrame(loop);
    });

    return () => cancelAnimationFrame(gameRef.current.frameId);
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block", touchAction: "none" }} />;
}

// In your render function — use ctx.drawImage, NEVER ctx.fillRect for characters:
function render(ctx: CanvasRenderingContext2D, g: any, w: number, h: number) {
  const a = g.assets as GameAssets;
  if (!a) return;
  ctx.drawImage(a.bg, 0, 0, w, h);                                    // background
  ctx.drawImage(a.platform, platX - camX, platY, 200, 40);            // platform tile
  a.playerRun.update(g.dt);
  if (g.player.facingRight) a.playerRun.draw(ctx, g.player.x, g.player.y, 64, 64);
  else a.playerRun.drawFlipped(ctx, g.player.x, g.player.y, 64, 64); // flipped sprite
  a.zombieWalk.update(g.dt);
  a.zombieWalk.draw(ctx, enemy.x - camX, enemy.y, 64, 64);           // enemy sprite
  ctx.drawImage(a.crystal, coinX - camX, coinY, 32, 32);              // collectible
}
\`\`\`

---

### FULL CHARACTER CATALOG

| Pack | Base Path | Type | Animations |
|------|-----------|------|------------|
| ARZ Robots (12) | characters/arz-game-kit/ROBOTS/robot{1-12}/ | Frame seq | attack, climb, crouch, die, hit, jump, run, walk |
| ARZ Aliens (10) | characters/arz-game-kit/ALIENS/alien{1-10}/ | Frame seq | attack, die, run |
| ARZ Zombies (11) | characters/arz-game-kit/ZOMBIES/zombie{1-11}/ | Frame seq | attack, die, walk |
| Red-Bot | characters/heroes/red-bot/PNG's/ | Frame seq | run(16), jump(20), idle(20), death(16), slide(10), shoot, run_shoot(16) |
| Boy-Scout | characters/heroes/boy-scout/png/ | Frame seq | run(8), walk(8), attack(4), die(4), climb(6), idle, jump |
| Ninja | characters/heroes/ninja/ | Static | Single PNG |
| Kenney Player | characters/heroes/kenney-platformer-characters/PNG/Player/Poses/ | Poses | idle, walk1/2, jump, fall, duck, stand, hurt |
| Kenney Zombie | characters/heroes/kenney-platformer-characters/PNG/Zombie/Poses/ | Poses | Same set |
| Girl-Boy | characters/heroes/girl-boy/ | Subdirs | Boy-Character/, Girl-Character/ |
| Burly-Man | characters/heroes/burly-man/BURLY-MAN_1_swordsman/ | Sprite | Swordsman |
| Golem | characters/carecter-collection/Golem_2/PNG/ | Sheet | Fantasy golem |
| Reaper Man | characters/carecter-collection/Reaper_Man_3/PNG/ | Sheet | Dark reaper |

### Additional Environment Assets
- Desert parallax: \`environments/parallax/desert/9 Background.png\`, \`5 Mountains.png\`, \`1 Layer1.png\`
- More backgrounds: \`environments/backgrounds/arz-backgrounds/1920x1080/BG space 1.jpg\` through \`BG space 5.jpg\`
- More platforms: \`Platform_2.png\`, \`Platform_3.png\`, \`Platform_End.png\`, \`Platform_Slope.png\`
- Shrubs: \`environments/tilesets/forest-pack/300_DPI PNG/Shrubs/Shrub_1.png\` through \`Shrub_5.png\`

### When to Use Sprites vs Shapes
- **ALWAYS use sprites**: action games, platformers, shooters, RPGs, runners — use ASSET() + loadImage()
- **Shapes/emoji ONLY for**: abstract puzzles (2048, Tetris), card games, Pong/Breakout
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
