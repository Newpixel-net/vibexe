/**
 * Game Assets Reference — Compact asset catalog for game-developer agent.
 *
 * Injected into game-developer agent prompt. Edit HERE to update all game generation.
 * Assets served from: /opt/vibexe/media-stock/games/ via /api/app-builder/media-stock/
 *
 * VERIFIED on live server. All paths are real PNG/JPG files. NO GIF files exist.
 */

export const GAME_ASSETS_REFERENCE = `
## Asset Catalog — 20,000+ REAL Sprites Available via API

**CRITICAL FACT**: The Vibexe platform hosts 20,454 real game sprite files (PNG/JPG) on the server. They are served via the API endpoint \`/api/app-builder/media-stock/{path}\`. This API IS accessible from Sandpack previews because \`window.__VIBEXE_API_ORIGIN__\` is injected at runtime by the platform, resolving to the correct server origin (e.g. \`https://vibexe.online\`). The ASSET() function below constructs the full URL automatically.

**You NEVER need base64 data URIs, DiceBear avatars, external CDN URLs, or placeholder shapes for characters/environments/items.** Real sprites always load correctly via the ASSET() helper.

ABSOLUTELY FORBIDDEN in action/platformer/shooter/runner games:
- \`data:image/svg+xml\` or \`data:image/png;base64,...\` for ANY game asset
- \`https://api.dicebear.com\` or ANY external URL
- \`ctx.fillRect()\` colored rectangles for characters/enemies
- Emoji via \`ctx.fillText("🤖", x, y)\` for characters
- Custom \`class AssetLoader\` or any loader that doesn't use ASSET()
- GIF files (none exist — ALL assets are PNG or JPG)
- Comments like "using placeholders since..." — sprites ARE accessible, USE THEM

### CHARACTER SELECTION — Match user request to database FIRST
Before writing constants.ts, determine which character pack to use:
- User says "ninja" → use \`characters/heroes/ninja/Ninja Postac.png\`
- User says "robot" → use \`characters/arz-game-kit/ROBOTS/robot1/\` (animated frames)
- User says "zombie" → use \`characters/arz-game-kit/ZOMBIES/zombie1/\` (animated frames)
- User says "alien" → use \`characters/arz-game-kit/ALIENS/alien1/\` (animated frames)
- User says "platformer" → use \`characters/heroes/kenney-platformer-characters/PNG/Player/Poses/\`
- User says "pixel" → use \`characters/heroes/kenney-pixel-platformer/\`
- User says "shooter" → use \`characters/heroes/red-bot/PNG's/\`
- No specific request → default to robot1 (has the most animation frames)
For single-image characters (ninja, kenney), use \`loadImage()\` and \`ctx.drawImage()\` directly.
For multi-frame characters (robot, zombie, alien, red-bot), use \`loadFrames()\` + \`SpriteAnimation\`.

### FILE 1: src/assets/loader.ts — PRE-CREATED by the platform (do NOT recreate or modify)

This file is automatically injected into the project before you start generating code. It already exists — just import from it.

**Exports:**
- \`ASSET(path)\` — Builds full URL using \`window.__VIBEXE_API_ORIGIN__\` + \`/api/app-builder/media-stock/\` + encoded path
- \`loadImage(path)\` — Returns \`Promise<HTMLImageElement>\`, falls back to 1x1 transparent pixel on error
- \`loadFrames(paths)\` — Returns \`Promise<HTMLImageElement[]>\`, loads multiple frames in parallel
- \`class SpriteAnimation\` — Manages frame-based animation with \`update(dt)\`, \`draw(ctx,x,y,w,h)\`, \`drawFlipped(ctx,x,y,w,h)\`

**Usage:**
\`\`\`typescript
import { loadImage, loadFrames, SpriteAnimation } from "../assets/loader";
import * as C from "../constants";

const bg = await loadImage(C.BACKGROUND_FOREST);
const runFrames = await loadFrames(C.PLAYER_RUN_FRAMES);
const playerRun = new SpriteAnimation(runFrames, 16);
// In game loop: playerRun.update(dt); playerRun.draw(ctx, x, y, 64, 64);
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

### All available character packs (with exact file paths):

**Multi-frame animated characters** (use loadFrames + SpriteAnimation):
- Robot (default): \`characters/arz-game-kit/ROBOTS/robot1/\` — run, attack, jump, die frames (see FILE 2 above)
- Zombie: \`characters/arz-game-kit/ZOMBIES/zombie1/\` — walk, attack, die frames (see FILE 2 above)
- Alien: \`characters/arz-game-kit/ALIENS/alien1/\` — run, attack, die frames (see FILE 2 above)
- Red Bot: \`characters/heroes/red-bot/PNG's/r_run_1.png\` through r_run_8.png, r_jump_1.png through r_jump_20.png
- Boy Scout: \`characters/heroes/boy-scout/png/run-0001.png\` through run-0008.png

**Single-image characters** (use loadImage + ctx.drawImage directly):
- Ninja: \`characters/heroes/ninja/Ninja Postac.png\` — single high-res sprite
- Kenney Platformer: \`characters/heroes/kenney-platformer-characters/PNG/Player/Poses/player_walk1.png\`, player_walk2.png, player_jump.png, player_idle.png

**Backgrounds** (use loadImage):
- Forest: \`environments/backgrounds/arz-backgrounds/1920x1080/BG forest 1.jpg\`
- Space: \`environments/backgrounds/arz-backgrounds/1920x1080/BG space 1.jpg\`
- Alien world: \`environments/backgrounds/arz-backgrounds/1920x1080/BG alien 1.jpg\`

**Environment tiles** (use loadImage):
- Platform: \`environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_1.png\`
- Ground: \`environments/tilesets/forest-pack/300_DPI PNG/Grounds/Ground_Wall.png\`
- Tree: \`environments/tilesets/forest-pack/300_DPI PNG/Tree/Tree_1.png\`
- Cloud: \`environments/tilesets/forest-pack/300_DPI PNG/Clouds/Cloud_1.png\`

**Items** (use loadImage):
- Crystal: \`items/collectibles/treasure/crystal01.png\`
- Chest: \`items/collectibles/treasure/chest1_128.png\`
- Weapon: \`items/weapons/arz-weapons/Weapon_1.png\`

### Sprites vs Shapes rule:
- Action/platformer/shooter/runner → ALWAYS use ASSET() + loadImage() with real paths above
- Abstract puzzles (2048, Tetris, Minesweeper, Pong) → shapes/emoji OK
`;
