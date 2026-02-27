/**
 * Game Assets Reference — Media stock catalog, sprite loading patterns, and mobile mastery guide.
 *
 * Injected into game-developer agent prompt. Edit HERE to update all game generation.
 * Asset files served from: /opt/vibexe/media-stock/games/ via /api/app-builder/media-stock/
 *
 * IMPORTANT: Every path below has been VERIFIED on the live server. Do NOT guess or invent paths.
 */

export const GAME_ASSETS_CATALOG = `
## Game Asset Library (20,454 sprites, tiles, backgrounds, UI, audio)

The platform ships a built-in media-stock asset library. Assets are served at:
\`\`\`
\${window.__VIBEXE_API_ORIGIN__}/api/app-builder/media-stock/{path}
\`\`\`

**CRITICAL**: Use ONLY the exact paths listed below. Do NOT invent filenames. Copy paths character-by-character.
Some paths contain spaces (e.g. "300_DPI PNG", "BG alien 1.jpg") — this is fine, browsers auto-encode them.

### URL Helper (put in src/assets/loader.ts)
\`\`\`typescript
export function ASSET(path: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || "";
  return \`\${origin}/api/app-builder/media-stock/\${encodeURI(path)}\`;
}
\`\`\`

---

### Characters (14,064 files)

**ARZ Game Kit** — 33 animated characters (10 aliens, 12 robots, 11 zombies).
Each has 8 actions: attack, climb, crouch, die, hit, jump, run, walk (20-55 frames per action).
- Path pattern: \`characters/arz-game-kit/{FACTION}/{name}/{action}/{name}-{action}{frame}.png\`
- Factions: \`ALIENS/alien{1-10}\`, \`ROBOTS/robot{1-12}\`, \`ZOMBIES/zombie{1-11}\`
- Each frame is ~800-1100px PNG with transparent background (draw scaled down to 64-80px)
- **VERIFIED exact paths** (copy these):
  - \`characters/arz-game-kit/ROBOTS/robot1/run/robot1-run0.png\` (frame 0 of 55)
  - \`characters/arz-game-kit/ROBOTS/robot1/attack/robot1-attack0.png\`
  - \`characters/arz-game-kit/ROBOTS/robot1/jump/robot1-jump0.png\`
  - \`characters/arz-game-kit/ROBOTS/robot1/die/robot1-die0.png\`
  - \`characters/arz-game-kit/ZOMBIES/zombie1/walk/zombie1-walk0.png\`
  - \`characters/arz-game-kit/ZOMBIES/zombie1/attack/zombie1-attack0.png\`
  - \`characters/arz-game-kit/ALIENS/alien1/run/alien1-run0.png\`
  - \`characters/arz-game-kit/ALIENS/alien1/attack/alien1-attack0.png\`
  - \`characters/arz-game-kit/ALIENS/alien1/die/alien1-die0.png\`
- **Frame sampling for performance**: Load every 7th frame for 8 total: frames 0, 7, 14, 21, 28, 35, 42, 49
- Best for: action platformers, fighting games, side-scrollers, shooters

**Kenney Platformer Characters** — cartoon characters with poses
- Path: \`characters/heroes/kenney-platformer-characters/PNG/Player/\`
- Verified files: \`player_tilesheet.png\` (spritesheet), \`Limbs/head.png\`, \`Limbs/arm.png\`, \`Limbs/leg.png\`
- Poses: \`Poses/player_kick.png\`, \`player_hang.png\`, \`player_climb2.png\`, \`player_swim1.png\`, \`player_hold1.png\`
- Best for: friendly platformers, kid-friendly games

**Kenney Pixel Platformer** — retro pixel art characters + tiles
- Path: \`characters/heroes/kenney-pixel-platformer/\`

**Other Heroes**: \`characters/heroes/{red-bot, ninja, burly-man, unnamed-hero, boy-scout, girl-boy}/\`
**Enemies**: \`characters/enemies/{zombie-sprite, cockroach, octopus}/\`

---

### Environments (4,520 files)

**ARZ Backgrounds** — 13 complete full-screen game backgrounds (JPG, 1920x1080)
- Path: \`environments/backgrounds/arz-backgrounds/1920x1080/{name}.jpg\`
- **VERIFIED exact files** (names have spaces):
  - \`environments/backgrounds/arz-backgrounds/1920x1080/BG alien 1.jpg\` through \`BG alien 5.jpg\`
  - \`environments/backgrounds/arz-backgrounds/1920x1080/BG apocalyptic 1.jpg\` through \`BG apocalyptic 3.jpg\`
  - \`environments/backgrounds/arz-backgrounds/1920x1080/BG space 1.jpg\` through \`BG space 5.jpg\`
- Also available at 2048x1536 resolution in \`2048x1536/\` subfolder

**Forest Pack** — 50 high-quality PNG assets (300 DPI, transparent backgrounds)
- Base path: \`environments/tilesets/forest-pack/300_DPI PNG/\` (note: folder name has a space)
- **VERIFIED exact files**:
  - Trees: \`Tree/Tree_1.png\`, \`Tree_2.png\`, \`Tree_3.png\`, \`Tree_Big_1.png\`, \`Tree_Big_2.png\`, \`TreeLines.png\`
  - Platforms: \`Platform/Platform_1.png\`, \`Platform_2.png\`, \`Platform_3.png\`, \`Platform_sml_1.png\`, \`Platform_sml_3.png\`, \`Platform_End.png\`, \`Platform_Slope.png\`, \`Rocktower_Platform.png\`
  - Grounds: \`Grounds/Cliff.png\`, \`Ground_Wall.png\`, \`Mountain.png\`
  - Grass: \`Grass/Grass_1.png\`, \`Grass_2.png\`, \`Ground_Grass.png\`
  - Clouds: \`Clouds/Cloud_1.png\` through \`Cloud_4.png\`
  - Dead Trees: \`Dead Trees/Dead_Tree_1.png\` through \`Dead_Tree_7.png\`
  - Shrubs: \`Shrubs/Shrub_1.png\` through \`Shrub_5.png\`
  - Rock Towers: \`Rock Tower/Rocktower_1.png\` through \`Rocktower_4.png\`
  - Shadows: \`Shadowed Area/Shadowed_Area_1.png\` through \`Shadowed_Area_3.png\`

**Desert Parallax** — layered scrolling desert background
- Path: \`environments/parallax/desert/\` (filenames have spaces)
- **VERIFIED files**: \`1 Layer1.png\`, \`2 Layer2.png\`, \`3 Layer3.png\`, \`4 Layer4.png\`, \`5 Mountains.png\`, \`6 Sun.png\`, \`7 Clouds.png\`, \`7 Clouds2.png\`, \`8 Stars.png\`, \`8 Stars2.png\`, \`9 Background.png\`, \`Desert.png\`
- Layer order (back to front): 9 Background → 8 Stars → 7 Clouds → 6 Sun → 5 Mountains → 4-1 Layers

**Kenney Abstract Platformer** — clean abstract tiles + backgrounds
- Path: \`environments/tilesets/kenney-abstract-platformer/\`

**Kenney Platformer Art Deluxe** — 1,021 high-res platformer tiles
- Path: \`environments/tilesets/kenney-platformer-art-deluxe/\`

**Kenney Platformer Pack Redux** — 453 mixed platformer assets
- Path: \`environments/tilesets/kenney-platformer-pack-redux/\`

**Other**: \`environments/tilesets/{craftpix, simple-world, graveyard, game-world}/\`, \`environments/backgrounds/{my-back, cyberpunk-street}/\`

---

### Items (227 files)

**ARZ Weapons** — 10 sci-fi weapons with fire-effect variants
- Path: \`items/weapons/arz-weapons/\`
- **VERIFIED exact files**: \`Weapon_1.png\` through \`Weapon_10.png\`, \`Weapon_1-Fire.png\`, \`Weapon_2-Fire.png\`

**Treasure Collectibles** — boards, crystals, chests
- Path: \`items/collectibles/treasure/\`
- **VERIFIED exact files**: \`crystal01.png\` through \`crystal04.png\`, \`chest1_128.png\`, \`chest2_128.png\`, \`openchest1_128.png\`, \`openchest2_128.png\`, \`treasurechest1_128.png\`, \`treasurechest2_128.png\`, \`board01.png\` through \`board09.png\`

**Other Weapons**: \`items/weapons/{sword, axe, gadha, weapon4}/\`

---

### UI (1,318 files)

**Kenney UI Pack** — buttons, panels, icons, sliders
- Path: \`ui/kenney-ui-pack/\`

---

### Audio (325 files)

**Impact SFX**: \`audio/sfx/kenney-impact-sounds/\` (.ogg/.wav)
**Interface SFX**: \`audio/sfx/kenney-interface-sounds/\` (.ogg/.wav)
**Music Jingles**: \`audio/music/kenney-music-jingles/\` (.ogg)

---

### Asset Selection Guide
| Game Type | Characters | Environment | Items |
|-----------|-----------|-------------|-------|
| Action Platformer | ARZ robots (animated run/attack/jump) | forest-pack platforms + arz-backgrounds | arz-weapons + treasure crystals |
| Side-Scroller Shooter | ARZ aliens + zombies (animated) | desert parallax layers + forest-pack | arz-weapons (with fire variants) |
| Pixel Retro | kenney-pixel-platformer | kenney-abstract-platformer | treasure |
| Endless Runner | kenney-platformer-characters | desert parallax + forest-pack platforms | treasure crystals |
| RPG/Dungeon | carecter-collection (PIPOYA) | craftpix + graveyard | arz-weapons + treasure |
`;

export const ACTION_GAME_BLUEPRINT = `
## Action Game Blueprint — COPY THIS for action/platformer/shooter games

When building action games, use these EXACT verified paths. This is a complete working example.

### constants.ts — Asset Path Definitions
\`\`\`typescript
// ===== PLAYER (Robot) — sample every 7th frame for 8 frames =====
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

// ===== ENVIRONMENT =====
export const BACKGROUND = "environments/backgrounds/arz-backgrounds/1920x1080/BG alien 1.jpg";
export const PLATFORM_IMG = "environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_1.png";
export const PLATFORM_SMALL = "environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_sml_1.png";
export const GROUND_WALL = "environments/tilesets/forest-pack/300_DPI PNG/Grounds/Ground_Wall.png";
export const CLIFF = "environments/tilesets/forest-pack/300_DPI PNG/Grounds/Cliff.png";
export const TREE_1 = "environments/tilesets/forest-pack/300_DPI PNG/Tree/Tree_1.png";
export const TREE_BIG = "environments/tilesets/forest-pack/300_DPI PNG/Tree/Tree_Big_1.png";
export const GRASS = "environments/tilesets/forest-pack/300_DPI PNG/Grass/Ground_Grass.png";
export const SHRUB = "environments/tilesets/forest-pack/300_DPI PNG/Shrubs/Shrub_1.png";
export const CLOUD = "environments/tilesets/forest-pack/300_DPI PNG/Clouds/Cloud_1.png";

// ===== ITEMS =====
export const WEAPON = "items/weapons/arz-weapons/Weapon_1.png";
export const WEAPON_FIRE = "items/weapons/arz-weapons/Weapon_1-Fire.png";
export const CRYSTAL = "items/collectibles/treasure/crystal01.png";
export const CHEST = "items/collectibles/treasure/chest1_128.png";
export const CHEST_OPEN = "items/collectibles/treasure/openchest1_128.png";
\`\`\`

### assets/loader.ts — Complete Preloader
\`\`\`typescript
export function ASSET(path: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || "";
  return \`\${origin}/api/app-builder/media-stock/\${encodeURI(path)}\`;
}

export function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn("Asset not found, using fallback:", path);
      // Return a 1x1 transparent pixel as fallback
      const fallback = new Image();
      fallback.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      resolve(fallback);
    };
    img.src = ASSET(path);
  });
}

export async function loadFrames(paths: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(paths.map(p => loadImage(p)));
}

export async function preloadAssets(
  paths: Record<string, string>
): Promise<Map<string, HTMLImageElement>> {
  const entries = Object.entries(paths);
  const images = await Promise.all(
    entries.map(([key, path]) =>
      loadImage(path).then((img) => [key, img] as const)
    )
  );
  return new Map(images);
}

export class SpriteAnimation {
  frames: HTMLImageElement[];
  fps: number;
  currentFrame = 0;
  elapsed = 0;

  constructor(frames: HTMLImageElement[], fps = 12) {
    this.frames = frames;
    this.fps = fps;
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= 1 / this.fps) {
      this.elapsed -= 1 / this.fps;
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.frames.length > 0) {
      ctx.drawImage(this.frames[this.currentFrame], x, y, w, h);
    }
  }

  drawFlipped(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.frames.length > 0) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(this.frames[this.currentFrame], 0, 0, w, h);
      ctx.restore();
    }
  }

  reset(): void { this.currentFrame = 0; this.elapsed = 0; }
}
\`\`\`

### How to Use in Game
\`\`\`typescript
// In GameCanvas useEffect:
import { loadFrames, preloadAssets, SpriteAnimation } from "./assets/loader";
import * as C from "./constants";

// 1. Load all assets
const [bgImg, platformImg, ...] = await Promise.all([
  loadImage(C.BACKGROUND),
  loadImage(C.PLATFORM_IMG),
]);
const playerRunFrames = await loadFrames(C.PLAYER_RUN_FRAMES);
const playerAttackFrames = await loadFrames(C.PLAYER_ATTACK_FRAMES);
const zombieWalkFrames = await loadFrames(C.ZOMBIE_WALK_FRAMES);

// 2. Create animations
const playerRun = new SpriteAnimation(playerRunFrames, 16);
const playerAttack = new SpriteAnimation(playerAttackFrames, 12);
const zombieWalk = new SpriteAnimation(zombieWalkFrames, 10);

// 3. In game loop — update + draw
playerRun.update(dt);
if (player.facingRight) {
  playerRun.draw(ctx, player.x - cameraX, player.y, 64, 64);
} else {
  playerRun.drawFlipped(ctx, player.x - cameraX, player.y, 64, 64);
}

// 4. Draw background (stretched to canvas)
ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

// 5. Draw platforms
ctx.drawImage(platformImg, platX - cameraX, platY, platW, platH);
\`\`\`

### Varying Characters (use different numbers for variety)
\`\`\`typescript
// robot1 through robot12, alien1 through alien10, zombie1 through zombie11
// Just change the number in the path:
"characters/arz-game-kit/ROBOTS/robot3/run/robot3-run0.png"  // robot3
"characters/arz-game-kit/ALIENS/alien5/attack/alien5-attack0.png"  // alien5
"characters/arz-game-kit/ZOMBIES/zombie8/walk/zombie8-walk0.png"  // zombie8
\`\`\`
`;

export const SPRITE_LOADING_PATTERNS = `
## Sprite Loading Patterns (src/assets/loader.ts)

### 1. ASSET() URL Helper — with encodeURI for paths with spaces
\`\`\`typescript
export function ASSET(path: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || "";
  return \`\${origin}/api/app-builder/media-stock/\${encodeURI(path)}\`;
}
\`\`\`

### 2. loadImage() — Single Image with CORS + Fallback
\`\`\`typescript
export function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn("Asset not found:", path);
      const fallback = new Image(1, 1);
      fallback.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      resolve(fallback); // never reject — game keeps running
    };
    img.src = ASSET(path);
  });
}
\`\`\`

### 3. loadFrames() — Load Animation Frame Array
\`\`\`typescript
export async function loadFrames(paths: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(paths.map(p => loadImage(p)));
}
\`\`\`

### 4. preloadAssets() — Batch Preload Named Assets
\`\`\`typescript
export async function preloadAssets(
  paths: Record<string, string>
): Promise<Map<string, HTMLImageElement>> {
  const entries = Object.entries(paths);
  const images = await Promise.all(
    entries.map(([key, path]) =>
      loadImage(path).then((img) => [key, img] as const)
    )
  );
  return new Map(images);
}
\`\`\`

### 5. SpriteAnimation Class — Frame Cycling with Flip
\`\`\`typescript
export class SpriteAnimation {
  frames: HTMLImageElement[];
  fps: number;
  currentFrame = 0;
  elapsed = 0;

  constructor(frames: HTMLImageElement[], fps = 12) {
    this.frames = frames;
    this.fps = fps;
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= 1 / this.fps) {
      this.elapsed -= 1 / this.fps;
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.frames.length > 0) ctx.drawImage(this.frames[this.currentFrame], x, y, w, h);
  }

  drawFlipped(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.frames.length > 0) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(this.frames[this.currentFrame], 0, 0, w, h);
      ctx.restore();
    }
  }

  reset(): void { this.currentFrame = 0; this.elapsed = 0; }
}
\`\`\`

### 6. Canvas drawImage Cheat Sheet
\`\`\`typescript
ctx.drawImage(img, x, y);                              // Full image at position
ctx.drawImage(img, x, y, width, height);               // Scaled to size
ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);   // Crop from spritesheet
\`\`\`

### When to Use Sprites vs Geometric Shapes
- **ALWAYS use sprites**: action games, platformers, shooters, RPGs, runners — any game with characters/enemies/environments
- **Use geometric shapes + emoji**: ONLY for abstract puzzles (2048, Tetris), card games, minimal arcade (Pong, Breakout)
- For action/platformer games, NEVER fall back to emoji for characters — always use real sprites
`;

export const MOBILE_GAME_MASTERY = `
## Mobile Game Mastery — Touch-ONLY Design

### Touch-ONLY Mandate
For mobile games (game-mobile intent): **NO keyboard event listeners at all.** Touch is the ONLY input method.
Do NOT add \`window.addEventListener("keydown", ...)\` or any keyboard handling.
Do NOT add desktop fallback controls. Mobile games are ONLY for touch devices.

### Gesture Vocabulary by Genre
| Genre | Primary Gesture | Implementation |
|-------|----------------|----------------|
| Flappy / Tap-to-Fly | Tap anywhere | \`touchstart\` → apply upward impulse |
| Endless Runner | Swipe left/right/up | \`touchstart\`+\`touchend\` → calculate dx/dy |
| Puzzle (2048) | Swipe 4 directions | \`touchstart\`+\`touchend\` → direction from delta |
| Tower Defense | Tap to place, drag to aim | \`touchstart\` → place, \`touchmove\` → aim |
| Idle/Clicker | Tap center | \`touchstart\` on large central target |
| Rhythm | Tap targets | \`touchstart\` on hit zones with timing |
| Drawing/Tracing | Continuous drag | \`touchmove\` → collect point array |
| Aim & Shoot | Pull back + release | \`touchstart\`→\`touchmove\`→\`touchend\` (slingshot) |
| Side-Scroller | Left/right touch zones + tap | Left half = move left, right half = move right, tap = jump/shoot |

### Mobile Canvas Setup with devicePixelRatio
\`\`\`typescript
function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.min(window.innerWidth, 500);
  const h = window.innerHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  return ctx;
}
// Call in useEffect, re-call on resize. All drawing uses logical pixels (w x h).
\`\`\`
This ensures crisp rendering on Retina/high-DPI mobile screens.

### Sprite Sizing Rules for Mobile
- **Characters**: 48-80px logical size (scales up via dpr)
- **Tiles/blocks**: 32-48px logical size
- **Tap targets**: minimum 48px (Apple/Google HIG)
- **HUD text**: minimum 16px font size
- **Particles**: 4-12px (keep < 50 active particles)

### Loading Screen Pattern
\`\`\`typescript
function drawLoadingScreen(ctx: CanvasRenderingContext2D, progress: number, w: number, h: number) {
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, w, h);

  // Progress bar
  const barW = w * 0.6;
  const barH = 8;
  const barX = (w - barW) / 2;
  const barY = h / 2;

  ctx.fillStyle = "#333";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(barX, barY, barW * progress, barH);

  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#888";
  ctx.textAlign = "center";
  ctx.fillText("Loading...", w / 2, barY + 30);
}
\`\`\`
Target: < 3 seconds total load. Preload only assets for the current level.

### Asset Selection for Mobile
Prefer **lightweight** asset packs on mobile for fast loading:
- **BEST**: Kenney packs (small PNGs, clean art, few frames)
- **OK**: Forest Pack, simple-world (moderate size)
- **ARZ on mobile**: Use 4-8 sampled frames (not all 50+). Pick every 7th frame for smooth motion.

### Audio on Mobile
Mobile browsers require user interaction before playing audio:
\`\`\`typescript
let audioCtx: AudioContext | null = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// Call initAudio() inside the FIRST touchstart handler (e.g., "Tap to Start")
\`\`\`

### Prevent Default Behaviors
\`\`\`typescript
// On the canvas element:
canvas.style.touchAction = "none";      // prevents scroll/zoom
canvas.style.userSelect = "none";       // prevents text selection
canvas.style.webkitUserSelect = "none"; // Safari

// In touch handlers:
e.preventDefault(); // ALWAYS — prevents pull-to-refresh, back-swipe, etc.
\`\`\`
`;
