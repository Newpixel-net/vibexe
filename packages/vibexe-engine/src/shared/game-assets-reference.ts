/**
 * Game Assets Reference — Media stock catalog, sprite loading patterns, and mobile mastery guide.
 *
 * Injected into game-developer agent prompt. Edit HERE to update all game generation.
 * Asset files served from: /opt/vibexe/media-stock/games/ via /api/app-builder/media-stock/
 */

export const GAME_ASSETS_CATALOG = `
## Game Asset Library (20,454 sprites, tiles, backgrounds, UI, audio)

The platform ships a built-in media-stock asset library. Assets are served at:
\`\`\`
\${window.__VIBEXE_API_ORIGIN__}/api/app-builder/media-stock/{path}
\`\`\`

### URL Helper (put in src/assets/loader.ts)
\`\`\`typescript
export function ASSET(path: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || "";
  return \`\${origin}/api/app-builder/media-stock/\${path}\`;
}
\`\`\`

---

### Characters (14,064 files)

**ARZ Game Kit** — 33 animated characters (10 aliens, 12 robots, 11 zombies).
Each has 8 actions: attack, climb, crouch, die, hit, jump, run, walk (20-55 frames per action).
- Path: \`characters/arz-game-kit/{FACTION}/{name}/{action}/{name}-{action}{frame}.png\`
- Factions: \`ALIENS/alien{1-10}\`, \`ROBOTS/robot{1-12}\`, \`ZOMBIES/zombie{1-11}\`
- Example: \`ASSET("characters/arz-game-kit/ALIENS/alien1/run/alien1-run0.png")\` → frame 0 of alien1 running
- Frame range: \`alien1-run0.png\` through \`alien1-run54.png\` (55 frames)
- Each frame is ~200x200px PNG with transparent background
- Best for: action platformers, fighting games, side-scrollers

**Carecter Collection** — 8,564 files (PIPOYA RPG monsters, Golems, Reapers, Woman Warriors)
- Path: \`characters/carecter-collection/{subfolder}/\`
- Best for: RPG, turn-based, dungeon crawlers

**Kenney Platformer Characters** — clean cartoon characters with walk/jump/idle
- Path: \`characters/heroes/kenney-platformer-characters/\`
- Best for: friendly platformers, kid-friendly games

**Kenney Pixel Platformer** — retro pixel art characters + tiles
- Path: \`characters/heroes/kenney-pixel-platformer/\`
- Best for: retro/pixel-art games

**Other Heroes** (individual sprite sheets):
- \`characters/heroes/red-bot/\` — Robot character
- \`characters/heroes/girl-boy/\` — Male/female pair
- \`characters/heroes/boy-scout/\` — Scout character
- \`characters/heroes/burly-man/\` — Strong character
- \`characters/heroes/ninja/\` — Ninja character
- \`characters/heroes/unnamed-hero/\` — Generic hero

**Enemies**:
- \`characters/enemies/zombie-sprite/\` — Zombie enemy sprites
- \`characters/enemies/cockroach/\` — Bug enemy
- \`characters/enemies/octopus/\` — Sea creature enemy

**Animals**:
- \`characters/animals/mouse/\` — Mouse sprites

---

### Environments (4,520 files)

**Kenney Abstract Platformer** — clean abstract tiles + backgrounds
- Path: \`environments/tilesets/kenney-abstract-platformer/\`

**Kenney Platformer Art Deluxe** — high-res platformer tiles
- Path: \`environments/tilesets/kenney-platformer-art-deluxe/\`

**Kenney Platformer Pack Redux** — mixed platformer tiles + items
- Path: \`environments/tilesets/kenney-platformer-pack-redux/\`

**CraftPix Tilesets** — 1,158 files of varied game tiles
- Path: \`environments/tilesets/craftpix/\`

**Forest Pack** — 50 files (clouds, dead trees, grass, grounds, platforms, shrubs, trees)
- Path: \`environments/tilesets/forest-pack/300_DPI PNG/{subfolder}/{name}.png\`
- Subfolders: Cloud, Dead_Tree, Grass, Ground, Platform, Shrub, Tree

**Parallax Backgrounds** — layered scrolling backgrounds:
- \`environments/parallax/fairy-tale/\` — Fantasy forest layers
- \`environments/parallax/desert/\` — Desert landscape layers
- \`environments/parallax/scrolling-backgrounds/\` — Generic scrolling layers
- Files named by layer: \`sky.png\`, \`mountains.png\`, \`trees.png\`, \`ground.png\`

**ARZ Backgrounds** — 13 complete game backgrounds
- Path: \`environments/backgrounds/arz-backgrounds/\`
- Each is a full-screen game background image

**Platformer Kit** — 879 platform pieces
- Path: \`environments/platforms/platformer-kit/\`

**Other Tilesets**: \`nature/\`, \`graveyard/\`, \`winter-forest/\`, \`simple-world/\`, \`game-world/\`

---

### Items (227 files)

**ARZ Weapons** — swords, guns, with fire-effect variants
- Path: \`items/weapons/arz-weapons/\`

**Other Weapons**: \`items/weapons/sword/\`, \`axe/\`, \`gadha/\`, \`weapon4/\`

**Collectibles**:
- \`items/collectibles/arz-extras/\` — Coins, mines, tombstones, chests
- \`items/collectibles/treasure/\` — Boards, crystals, chests

**Powerups**: \`items/powerups/game-tools/\` — Bonus pads, props

---

### UI (1,318 files)

**Kenney UI Pack** — buttons, panels, icons, sliders (all game UI elements)
- Path: \`ui/kenney-ui-pack/\`

**Mobile GUI** — mobile-optimized UI elements
- Path: \`ui/panels/mobile-gui/\`

---

### Audio (325 files)

**Impact SFX**: \`audio/sfx/kenney-impact-sounds/\` — Hit, crash, thud sounds (.ogg/.wav)
**Interface SFX**: \`audio/sfx/kenney-interface-sounds/\` — Click, hover, confirm sounds (.ogg/.wav)
**Music Jingles**: \`audio/music/kenney-music-jingles/\` — Short music loops (.ogg)

---

### Asset Selection Guide
| Game Type | Characters | Environment | Items |
|-----------|-----------|-------------|-------|
| Platformer | kenney-platformer-characters or ARZ robots | kenney-platformer-art-deluxe + forest-pack | arz-extras |
| Pixel Retro | kenney-pixel-platformer | kenney-abstract-platformer | treasure |
| Action/Fighter | ARZ aliens/zombies (animated) | arz-backgrounds + parallax | arz-weapons |
| RPG/Dungeon | carecter-collection (PIPOYA) | craftpix + graveyard | arz-weapons + treasure |
| Endless Runner | kenney-platformer-characters | parallax + platformer-kit | arz-extras |
| Mobile Casual | kenney-pixel-platformer (lightweight) | kenney-abstract-platformer | game-tools |
`;

export const SPRITE_LOADING_PATTERNS = `
## Sprite Loading Patterns (src/assets/loader.ts)

### 1. ASSET() URL Helper
\`\`\`typescript
export function ASSET(path: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || "";
  return \`\${origin}/api/app-builder/media-stock/\${path}\`;
}
\`\`\`

### 2. loadImage() — Single Image with CORS
\`\`\`typescript
export function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(\`Failed to load: \${path}\`));
    img.src = ASSET(path);
  });
}
\`\`\`

### 3. preloadAssets() — Batch Preload
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

// Usage:
const assets = await preloadAssets({
  playerRun0: "characters/heroes/kenney-platformer-characters/run0.png",
  playerRun1: "characters/heroes/kenney-platformer-characters/run1.png",
  ground: "environments/tilesets/forest-pack/300_DPI PNG/Ground/Ground_1.png",
  coin: "items/collectibles/arz-extras/coin.png",
});
const playerImg = assets.get("playerRun0")!;
\`\`\`

### 4. SpriteAnimation Class — Frame Cycling
\`\`\`typescript
export class SpriteAnimation {
  private frames: HTMLImageElement[];
  private fps: number;
  private currentFrame = 0;
  private elapsed = 0;

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
    ctx.drawImage(this.frames[this.currentFrame], x, y, w, h);
  }

  reset(): void {
    this.currentFrame = 0;
    this.elapsed = 0;
  }
}

// Usage — load ARZ alien run animation:
const runFrames: HTMLImageElement[] = [];
for (let i = 0; i <= 54; i++) {
  runFrames.push(await loadImage(
    \`characters/arz-game-kit/ALIENS/alien1/run/alien1-run\${i}.png\`
  ));
}
const alienRun = new SpriteAnimation(runFrames, 24);
// In game loop: alienRun.update(dt); alienRun.draw(ctx, x, y, 64, 64);
\`\`\`

### 5. Game Startup Pattern — Preload then Play
\`\`\`typescript
// In GameCanvas useEffect([]):
const [loaded, setLoaded] = useState(false);
const assetsRef = useRef<Map<string, HTMLImageElement>>(new Map());

useEffect(() => {
  let cancelled = false;

  async function init() {
    const assets = await preloadAssets({
      player: "characters/heroes/kenney-platformer-characters/idle.png",
      ground: "environments/tilesets/kenney-abstract-platformer/ground.png",
      bg: "environments/backgrounds/arz-backgrounds/bg1.png",
    });
    if (cancelled) return;
    assetsRef.current = assets;
    setLoaded(true);
    // Start game loop here
  }

  init();
  return () => { cancelled = true; };
}, []);

// Show loading bar while !loaded
\`\`\`

### 6. Canvas drawImage Cheat Sheet
\`\`\`typescript
// Full image at position:
ctx.drawImage(img, x, y);

// Scaled to size:
ctx.drawImage(img, x, y, width, height);

// Crop from spritesheet (sx, sy, sw, sh) -> draw at (dx, dy, dw, dh):
ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

// Flip horizontally (for facing left):
ctx.save();
ctx.translate(x + width, y);
ctx.scale(-1, 1);
ctx.drawImage(img, 0, 0, width, height);
ctx.restore();
\`\`\`

### When to Use Sprites vs Geometric Shapes
- **Use sprites**: platformers, action games, RPGs, any game with characters/environments
- **Use geometric shapes + emoji**: abstract puzzles (2048, Tetris), card games, minimal arcade (Pong, Breakout), math/word games
- **Mix both**: sprites for player/enemies, geometric shapes for UI elements, particles, hitboxes
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
- **Characters**: 40-80px logical size (scales up via dpr)
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
- **AVOID for mobile**: ARZ Game Kit full animations (50+ frames per action = heavy). Use only 3-5 key frames if needed.
- **Tip**: For mobile, load 4-8 frames per animation (not 50). Pick frames 0, 7, 14, 21... to get smooth motion with fewer images.

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
For simple SFX, use short Audio objects (not AudioContext) with \`.play()\` after user gesture.

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
