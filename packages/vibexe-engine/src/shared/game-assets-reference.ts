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

**CRITICAL FACT**: The Vibexe platform hosts 20,454 real game sprite files (PNG/JPG) on the server. They are served via \`/api/app-builder/media-stock/{path}\`. The \`assetUrl()\` helper in the pre-created \`src/utils/media-stock.ts\` constructs full URLs using \`window.__VIBEXE_API_ORIGIN__\` (injected at runtime by the platform). The pre-created \`src/config/assets.ts\` provides \`preloadAssets(scene)\`, \`createAnimations(scene)\`, \`setupBackground(scene)\`, and \`SCALES\` that handle all standard asset loading and sizing automatically.

**You NEVER need base64 data URIs, DiceBear avatars, external CDN URLs, or placeholder shapes for characters/environments/items.** Real sprites always load correctly via the pre-created helpers.

### 🎨 ART THEMES — Pick ONE, Use ALL Its Assets (MANDATORY)

**CRITICAL: Every game MUST use ONE art theme. ALL assets MUST come from the same theme.
Mixing assets from different themes creates ugly, incoherent visuals and is FORBIDDEN.**

**THEME 1: Nature Adventure (DEFAULT — for robots, general platformers, runners)**
- Background: \`"bg-nature"\` (beautiful green hills/mountains landscape) or \`"bg-jungle"\` (bright jungle)
- Character: robot1 (animated: player-run, player-attack, player-jump, player-die)
- Platforms: \`"platform"\`, \`"platform-small"\`, \`"ground"\`, \`"grass"\` (forest-pack green tiles)
- Decoration: \`"tree"\`, \`"cloud"\` (forest-pack nature elements)
- Collectibles: \`"crystal"\`, \`"chest"\`
- Mood: Bright, colorful, adventurous. Green platforms on nature background.
- Use when: user says "robot", "platformer", "runner", "adventure", or gives no specific theme

**THEME 2: Dark Forest (for zombies, horror, survival)**
- Background: \`"bg-dark-forest"\` (dark magical forest with glowing blue trees)
- Character: zombie1 (animated: zombie-walk, zombie-attack, zombie-die) as ENEMY. For player, use robot1.
- Platforms: \`"platform"\`, \`"ground"\` (forest-pack tiles — they work in dark themes too)
- Decoration: \`"tree"\` (silhouette against dark BG). NO \`"cloud"\` (dark forest = no sky visible).
- Collectibles: \`"chest"\`
- Mood: Dark, mysterious, tense. Muted colors.
- Use when: user says "zombie", "horror", "dark", "survival", "spooky"

**THEME 3: Space Mission (for aliens, sci-fi, shooters)**
- Background: \`"bg-space"\` (deep space with asteroids)
- Character: alien1 (animated: alien-run, alien-attack, alien-die) as ENEMY. For player, use robot1.
- Platforms: DO NOT use forest tiles in space! Create colored rectangles: \`this.add.rectangle(x, y, w, h, 0x4444aa)\` as platforms
- Decoration: NO trees, NO grass, NO clouds in space. Use small colored circles as stars.
- Collectibles: \`"crystal"\` (looks like energy crystals in space)
- Mood: Dark background, glowing elements, sci-fi. Blues and purples.
- Use when: user says "space", "alien", "sci-fi", "shooter", "galaxy"

**THEME 4: Cartoon World (for kids, casual, cute games)**
- Background: \`"bg-cartoon"\` (bright sky, green bushes, cheerful colors)
- Character: robot1 or any character
- Platforms: \`"platform"\`, \`"grass"\` (bright green tiles match cartoon BG perfectly)
- Decoration: \`"tree"\`, \`"cloud"\` (cheerful nature)
- Collectibles: \`"crystal"\`, \`"chest"\`
- Mood: Bright, clean, kid-friendly. Maximum color saturation.
- Use when: user says "kids", "casual", "cute", "cartoon", "simple", "colorful"

**FORBIDDEN cross-theme combinations:**
- Forest/grass tiles on space background
- Trees/clouds in space scenes
- Dark horror background with bright cartoon character
- \`"bg-nature"\` with zombies as main character (use \`"bg-dark-forest"\` instead)

### ⚠️ MANDATORY: Asset Scaling — ALL assets are HIGH-RESOLUTION

All media-stock assets are high-resolution (300 DPI, HD quality). A mobile game viewport is ~500×700px.
**If you load ANY sprite without scaling, it will FILL THE ENTIRE SCREEN and break the game.**

**Actual pixel dimensions of raw assets (BEFORE scaling):**
| Asset | Raw Pixels | After SCALES.xxx | Scale Value |
|-------|-----------|-----------------|-------------|
| Robot character frames | 995×677 | ~90×61 | SCALES.player = 0.09 |
| Zombie character frames | 861×886 | ~69×71 | SCALES.zombie = 0.08 |
| Alien character frames | 819×630 | ~74×57 | SCALES.alien = 0.09 |
| Background images | 1920×1080 | cover-fit viewport (no distortion) | setupBackground() |
| Platform tile | 2100×550 | ~210×55 | SCALES.platform = 0.1 |
| Small platform | 1200×500 | ~120×50 | SCALES.platformSmall = 0.1 |
| Ground wall | 2050×1200 | ~164×96 | SCALES.ground = 0.08 |
| Tree | 800×1750 | ~64×140 | SCALES.tree = 0.08 |
| Grass | 2150×450 | ~215×45 | SCALES.grass = 0.1 |
| Cloud | 3000×400 | ~180×24 | SCALES.cloud = 0.06 |
| Crystal | 128×128 | ~38×38 | SCALES.crystal = 0.3 |
| Chest | 128×128 | ~38×38 | SCALES.chest = 0.3 |
| Weapon | 921×305 | ~55×18 | SCALES.weapon = 0.06 |

**The pre-created \`assets.ts\` exports \`SCALES\` and \`setupBackground()\` — you MUST use them.**

ABSOLUTELY FORBIDDEN in action/platformer/shooter/runner games:
- \`data:image/svg+xml\` or \`data:image/png;base64,...\` for ANY game asset
- \`https://api.dicebear.com\` or ANY external URL
- Colored rectangles / \`fillRect()\` for characters/enemies (OK for platforms in Space theme ONLY)
- Emoji for characters (e.g. \`"🤖"\` as a sprite)
- Custom asset loader classes — ALWAYS use the pre-created \`assetUrl()\` + \`preloadAssets()\`
- GIF files (none exist — ALL assets are PNG or JPG)
- Comments like "using placeholders since..." — sprites ARE accessible, USE THEM
- **Loading ANY sprite without \`.setScale(SCALES.xxx)\` — raw assets are 800-3000px wide!**
- **\`.setScale(2)\` or any scale > 1 on environment tiles** — they are already 2000+px, scaling UP is catastrophic

### CHARACTER SELECTION — Match user request to character pack FIRST
Before writing scenes, determine which character pack to use:
- User says "ninja" → use \`characters/heroes/ninja/Ninja Postac.png\` (single image)
- User says "robot" → use \`characters/arz-game-kit/ROBOTS/robot1/\` (animated frames — DEFAULT)
- User says "zombie" → use \`characters/arz-game-kit/ZOMBIES/zombie1/\` (animated frames)
- User says "alien" → use \`characters/arz-game-kit/ALIENS/alien1/\` (animated frames)
- User says "platformer" → use \`characters/heroes/kenney-platformer-characters/PNG/Player/Poses/\`
- User says "pixel" → use \`characters/heroes/kenney-pixel-platformer/\`
- User says "shooter" → use \`characters/heroes/red-bot/PNG's/\`
- No specific request → default to robot1 (has the most animation frames)
For single-image characters, load in BootScene: \`this.load.image('player', assetUrl('characters/heroes/ninja/Ninja Postac.png'))\`
For multi-frame characters, use the pre-created \`preloadAssets()\` + \`createAnimations()\`.

### PRE-CREATED FILE 1: src/utils/media-stock.ts (do NOT recreate or modify)
Exports:
- \`assetUrl(path)\` — Builds full URL using \`window.__VIBEXE_API_ORIGIN__\` + \`/api/app-builder/media-stock/\` + encoded path

### PRE-CREATED FILE 2: src/config/assets.ts (do NOT recreate or modify)
Exports:
- \`SCALES\` — Scale factors for every asset category. Use: \`sprite.setScale(SCALES.player)\`
- \`setupBackground(scene, key?, scrollFactor?)\` — Creates background image with cover-fit (no distortion, crops excess). Auto-resizes on viewport change. Default key is \`"bg-nature"\`. Call in create() BEFORE other objects.
- \`preloadAssets(scene: Phaser.Scene)\` — Loads ALL standard assets into Phaser's texture cache. Call in BootScene \`preload()\`.
- \`createAnimations(scene: Phaser.Scene)\` — Creates all standard animations: \`player-run\`, \`player-attack\`, \`player-jump\`, \`player-die\`, \`zombie-walk\`, \`zombie-attack\`, \`zombie-die\`, \`alien-run\`, \`alien-attack\`, \`alien-die\`. Call in BootScene \`create()\`.
- Available backgrounds: \`"bg-nature"\` (green landscape, DEFAULT), \`"bg-jungle"\` (bright jungle), \`"bg-cartoon"\` (cheerful), \`"bg-dark-forest"\` (dark magical), \`"bg-space"\` (deep space)

### PRE-CREATED FILE 3: package.json (do NOT recreate or modify)
Contains \`"phaser": "^3.90.0"\` — Sandpack installs it automatically via extractDependencies().

### PRE-CREATED FILE 4: src/components/Game.tsx (do NOT recreate or modify)
React wrapper that creates and manages the Phaser.Game instance. Handles:
- Game creation in useEffect with double-init guard
- Proper cleanup on unmount (game.destroy)
- Visibility change pause/resume (mobile tab switching)
- Touch action prevention on container

**Usage in App.tsx (the ONLY correct pattern):**
\`\`\`typescript
import Game from "./components/Game";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { GameOverScene } from "./scenes/GameOverScene";

export default function App() {
  return <Game scenes={[BootScene, MenuScene, GameScene, GameOverScene]} />;
}
\`\`\`

**CRITICAL: Do NOT create your own Game.tsx or GameCanvas.tsx or PhaserGame.tsx.**
**Do NOT add onStateChange, handleVisibilityChange, or any custom React callbacks.**
**The pre-created Game.tsx handles everything. Just pass your scenes array.**

### Usage in BootScene (the CORRECT pattern):
\`\`\`typescript
import Phaser from "phaser";
import { preloadAssets, createAnimations } from "../config/assets";

export class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }

  preload() {
    // Show loading bar
    const bar = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 300, 30, 0x444444);
    const fill = this.add.rectangle(this.scale.width / 2 - 148, this.scale.height / 2, 4, 26, 0x00ff00).setOrigin(0, 0.5);
    this.load.on("progress", (v: number) => { fill.width = 296 * v; });

    preloadAssets(this); // Loads ALL standard assets in one call
  }

  create() {
    createAnimations(this); // Registers all standard animations
    this.scene.start("Menu");
  }
}
\`\`\`

### Usage in GameScene — CORRECT scaling pattern (MANDATORY):
\`\`\`typescript
import { SCALES, setupBackground } from "../config/assets";

// In create():

// 1. Background — pick from your art theme, NEVER raw this.add.image() for BG
setupBackground(this, "bg-nature"); // Fills viewport, depth -10, fixed to camera

// 2. Player — ALWAYS apply SCALES.player
this.player = this.physics.add.sprite(100, this.scale.height - 150, "run/robot1-run0");
this.player.setScale(SCALES.player); // 995x677 -> ~90x61 px
this.player.play("player-run");
this.player.setCollideWorldBounds(true);

// 3. Platforms — ALWAYS apply SCALES.platform + refreshBody()
const platforms = this.physics.add.staticGroup();
const ground = platforms.create(this.scale.width / 2, this.scale.height - 30, "ground");
ground.setScale(SCALES.ground).refreshBody(); // 2050x1200 -> ~164x96

const plat1 = platforms.create(200, this.scale.height - 200, "platform");
plat1.setScale(SCALES.platform).refreshBody(); // 2100x550 -> ~210x55

// 4. Enemies — ALWAYS apply SCALES.zombie or SCALES.alien
const zombie = this.physics.add.sprite(400, 300, "walk/zombie1-walk0");
zombie.setScale(SCALES.zombie); // 861x886 -> ~69x71
zombie.play("zombie-walk");

// 5. Collectibles — ALWAYS apply SCALES.crystal
const crystal = this.physics.add.sprite(300, 350, "crystal");
crystal.setScale(SCALES.crystal); // 128x128 -> ~38x38

// 6. Decoration — ALWAYS apply SCALES for trees, clouds, grass
const tree = this.add.image(150, this.scale.height - 200, "tree").setScale(SCALES.tree);
const cloud = this.add.image(200, 80, "cloud").setScale(SCALES.cloud);

// 7. Colliders — MANDATORY or player falls through floor!
this.physics.add.collider(this.player, platforms);
\`\`\`

### Loading CUSTOM assets beyond the standard set:
\`\`\`typescript
import { assetUrl } from "../utils/media-stock";
import { SCALES } from "../config/assets";

// In preload():
this.load.image("ninja", assetUrl("characters/heroes/ninja/Ninja Postac.png"));

// In create() — ALWAYS scale custom assets too:
const ninja = this.add.sprite(x, y, "ninja");
ninja.setDisplaySize(80, 80); // Or setScale() — NEVER use at raw size
\`\`\`

### All available character packs (with exact file paths):

**Multi-frame animated characters** (pre-registered via preloadAssets + createAnimations):
- Robot (default): \`characters/arz-game-kit/ROBOTS/robot1/\` — run (13 frames), attack (11), jump (13), die (9). Raw: 995×677 px/frame.
- Zombie: \`characters/arz-game-kit/ZOMBIES/zombie1/\` — walk (9 frames), attack (9), die (7). Raw: 861×886 px/frame.
- Alien: \`characters/arz-game-kit/ALIENS/alien1/\` — run (8 frames), attack (7), die (7). Raw: 819×630 px/frame.

**Single-image characters** (load manually with assetUrl in BootScene preload):
- Red Bot: \`characters/heroes/red-bot/PNG's/r_run_1.png\` through r_run_8.png, r_jump_1.png through r_jump_20.png
- Boy Scout: \`characters/heroes/boy-scout/png/run-0001.png\` through run-0008.png
- Ninja: \`characters/heroes/ninja/Ninja Postac.png\` — single high-res sprite
- Kenney Platformer: \`characters/heroes/kenney-platformer-characters/PNG/Player/Poses/player_walk1.png\`, player_walk2.png, player_jump.png, player_idle.png

**Backgrounds** (pre-loaded, use with setupBackground()):
- \`"bg-nature"\` — Beautiful green hills, mountains, sunset sky. **DEFAULT for most games.**
- \`"bg-jungle"\` — Bright colorful jungle with platform-style scenery. Great for platformers.
- \`"bg-cartoon"\` — Cheerful sky with green bushes, clean vector art. Great for kids/casual.
- \`"bg-dark-forest"\` — Dark magical forest with glowing blue trees. Great for horror/zombie.
- \`"bg-space"\` — Deep space with asteroids. For sci-fi/space games only.

**Environment tiles** (pre-loaded as platform, ground, tree, cloud, grass). Raw: 800-3000px wide.
- Platform: \`environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_1.png\` (2100×550)
- Ground: \`environments/tilesets/forest-pack/300_DPI PNG/Grounds/Ground_Wall.png\` (2050×1200)
- Tree: \`environments/tilesets/forest-pack/300_DPI PNG/Tree/Tree_1.png\` (800×1750)
- Cloud: \`environments/tilesets/forest-pack/300_DPI PNG/Clouds/Cloud_1.png\` (3000×400)

**Items** (pre-loaded as crystal, chest, weapon):
- Crystal: \`items/collectibles/treasure/crystal01.png\` (128×128)
- Chest: \`items/collectibles/treasure/chest1_128.png\` (128×128)
- Weapon: \`items/weapons/arz-weapons/Weapon_1.png\` (921×305)

### Sprites vs Shapes rule:
- Action/platformer/shooter/runner → ALWAYS use preloadAssets() + createAnimations() + SCALES with real sprites
- Abstract puzzles (2048, Tetris, Minesweeper, Pong) → shapes/emoji OK
`;
