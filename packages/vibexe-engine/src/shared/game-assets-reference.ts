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

**CRITICAL FACT**: The Vibexe platform hosts 20,454 real game sprite files (PNG/JPG) on the server. They are served via \`/api/app-builder/media-stock/{path}\`. The \`assetUrl()\` helper in the pre-created \`src/utils/media-stock.ts\` constructs full URLs using \`window.__VIBEXE_API_ORIGIN__\` (injected at runtime by the platform). The pre-created \`src/config/assets.ts\` provides \`preloadAssets(scene)\` and \`createAnimations(scene)\` that handle all standard asset loading automatically.

**You NEVER need base64 data URIs, DiceBear avatars, external CDN URLs, or placeholder shapes for characters/environments/items.** Real sprites always load correctly via the pre-created helpers.

ABSOLUTELY FORBIDDEN in action/platformer/shooter/runner games:
- \`data:image/svg+xml\` or \`data:image/png;base64,...\` for ANY game asset
- \`https://api.dicebear.com\` or ANY external URL
- Colored rectangles / \`fillRect()\` for characters/enemies
- Emoji for characters (e.g. \`"🤖"\` as a sprite)
- Custom asset loader classes — ALWAYS use the pre-created \`assetUrl()\` + \`preloadAssets()\`
- GIF files (none exist — ALL assets are PNG or JPG)
- Comments like "using placeholders since..." — sprites ARE accessible, USE THEM

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
- \`preloadAssets(scene: Phaser.Scene)\` — Loads ALL standard assets (backgrounds, platforms, character frames, items) into Phaser's texture cache. Call in BootScene \`preload()\`.
- \`createAnimations(scene: Phaser.Scene)\` — Creates all standard animations: \`player-run\`, \`player-attack\`, \`player-jump\`, \`player-die\`, \`zombie-walk\`, \`zombie-attack\`, \`zombie-die\`, \`alien-run\`, \`alien-attack\`, \`alien-die\`. Call in BootScene \`create()\`.
- Frame constants: \`ROBOT_RUN\`, \`ROBOT_ATTACK\`, \`ROBOT_JUMP\`, \`ROBOT_DIE\`, \`ZOMBIE_WALK\`, \`ZOMBIE_ATTACK\`, \`ZOMBIE_DIE\`, \`ALIEN_RUN\`, \`ALIEN_ATTACK\`, \`ALIEN_DIE\`
- \`STATIC_ASSETS\` array: \`bg-forest\`, \`bg-space\`, \`bg-alien\`, \`platform\`, \`platform-small\`, \`ground\`, \`tree\`, \`grass\`, \`cloud\`, \`crystal\`, \`chest\`, \`weapon\`

### PRE-CREATED FILE 3: package.json (do NOT recreate or modify)
Contains \`"phaser": "^3.90.0"\` — Sandpack installs it automatically via extractDependencies().

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

### Usage in GameScene (sprites + physics):
\`\`\`typescript
// In create():
const player = this.physics.add.sprite(100, 400, "run/robot1-run0");
player.play("player-run"); // Animation registered by createAnimations()
player.setCollideWorldBounds(true);

const bg = this.add.image(0, 0, "bg-forest").setOrigin(0, 0);

const platforms = this.physics.add.staticGroup();
platforms.create(400, 568, "ground").setScale(2).refreshBody();
platforms.create(300, 400, "platform");

this.physics.add.collider(player, platforms);

const crystals = this.physics.add.group();
crystals.create(250, 300, "crystal");
this.physics.add.overlap(player, crystals, (_, c) => {
  (c as Phaser.GameObjects.Sprite).destroy();
  this.score++;
});
\`\`\`

### Loading CUSTOM assets beyond the standard set:
\`\`\`typescript
import { assetUrl } from "../utils/media-stock";

// In preload():
this.load.image("ninja", assetUrl("characters/heroes/ninja/Ninja Postac.png"));
this.load.image("red-bot-run1", assetUrl("characters/heroes/red-bot/PNG's/r_run_1.png"));
// ... then use: this.add.sprite(x, y, "ninja")
\`\`\`

### All available character packs (with exact file paths):

**Multi-frame animated characters** (pre-registered via preloadAssets + createAnimations):
- Robot (default): \`characters/arz-game-kit/ROBOTS/robot1/\` — run (13 frames), attack (11), jump (13), die (9)
- Zombie: \`characters/arz-game-kit/ZOMBIES/zombie1/\` — walk (9 frames subsampled), attack (9), die (7 subsampled)
- Alien: \`characters/arz-game-kit/ALIENS/alien1/\` — run (8 frames subsampled), attack (7 subsampled), die (7 subsampled)

**Single-image characters** (load manually with assetUrl in BootScene preload):
- Red Bot: \`characters/heroes/red-bot/PNG's/r_run_1.png\` through r_run_8.png, r_jump_1.png through r_jump_20.png
- Boy Scout: \`characters/heroes/boy-scout/png/run-0001.png\` through run-0008.png
- Ninja: \`characters/heroes/ninja/Ninja Postac.png\` — single high-res sprite
- Kenney Platformer: \`characters/heroes/kenney-platformer-characters/PNG/Player/Poses/player_walk1.png\`, player_walk2.png, player_jump.png, player_idle.png

**Backgrounds** (pre-loaded as bg-forest, bg-space, bg-alien):
- Forest/Apocalyptic: \`environments/backgrounds/arz-backgrounds/1920x1080/BG apocalyptic 1.jpg\`
- Space: \`environments/backgrounds/arz-backgrounds/1920x1080/BG space 1.jpg\`
- Alien world: \`environments/backgrounds/arz-backgrounds/1920x1080/BG alien 1.jpg\`

**Environment tiles** (pre-loaded as platform, ground, tree, cloud, grass):
- Platform: \`environments/tilesets/forest-pack/300_DPI PNG/Platform/Platform_1.png\`
- Ground: \`environments/tilesets/forest-pack/300_DPI PNG/Grounds/Ground_Wall.png\`
- Tree: \`environments/tilesets/forest-pack/300_DPI PNG/Tree/Tree_1.png\`
- Cloud: \`environments/tilesets/forest-pack/300_DPI PNG/Clouds/Cloud_1.png\`

**Items** (pre-loaded as crystal, chest, weapon):
- Crystal: \`items/collectibles/treasure/crystal01.png\`
- Chest: \`items/collectibles/treasure/chest1_128.png\`
- Weapon: \`items/weapons/arz-weapons/Weapon_1.png\`

### Sprites vs Shapes rule:
- Action/platformer/shooter/runner → ALWAYS use preloadAssets() + createAnimations() with real sprites
- Abstract puzzles (2048, Tetris, Minesweeper, Pong) → shapes/emoji OK
`;
