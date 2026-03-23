/**
 * 2D Game Template Files — Pre-created infrastructure injected into projects
 * BEFORE the AI agent starts generating code.
 *
 * Mirrors game-3d-templates.ts pattern exactly.
 * The agent finds these files already existing and imports from them.
 */

import type { TemplateFile } from "./game-3d-templates";
import { ENGINE_CORE_CONTENT } from "./game-2d-engine";
import { ENGINE_INPUT_CONTENT, MEDIA_STOCK_2D_CONTENT } from "./game-2d-engine";
import { ENGINE_PHYSICS_CONTENT } from "./game-2d-physics";
import { ENGINE_EFFECTS_CONTENT } from "./game-2d-effects";

export { type TemplateFile };

export const GAME_2D_TEMPLATE_FILES: TemplateFile[] = [
	// ---------- Template 1: Engine Core ----------
	{
		path: "src/engine/core.ts",
		language: "typescript",
		content: ENGINE_CORE_CONTENT,
	},

	// ---------- Template 2: Input Handling ----------
	{
		path: "src/engine/input.ts",
		language: "typescript",
		content: ENGINE_INPUT_CONTENT,
	},

	// ---------- Template 3: Physics Engine ----------
	{
		path: "src/engine/physics.ts",
		language: "typescript",
		content: ENGINE_PHYSICS_CONTENT,
	},

	// ---------- Template 4: Particle Effects ----------
	{
		path: "src/engine/effects.ts",
		language: "typescript",
		content: ENGINE_EFFECTS_CONTENT,
	},

	// ---------- Template 5: Media-stock URL helper ----------
	{
		path: "src/utils/media-stock.ts",
		language: "typescript",
		content: MEDIA_STOCK_2D_CONTENT,
	},

	// ---------- Template 6: Asset Config ----------
	{
		path: "src/config/assets.ts",
		language: "typescript",
		content: `import { spriteUrl } from "../utils/media-stock";
export { spriteUrl };

const PIXI = (window as any).PIXI;

// ===== SCALE PRESETS =====
// Raw 2D sprites are 800-3000px. ALWAYS apply these scales.
export const SCALES = {
  player: 0.15,
  enemy: 0.12,
  npc: 0.12,
  boss: 0.2,
  platform: 0.2,
  tile: 0.125,
  collectible: 0.08,
  powerup: 0.1,
  coin: 0.06,
  projectile: 0.05,
  decoration: 0.15,
  background: 1.0,
};

// ===== SPRITE FACTORIES =====

/**
 * Load a sprite from media-stock and apply correct scale.
 */
export async function createGameSprite(path: string, scaleKey: keyof typeof SCALES, x = 0, y = 0): Promise<any> {
  const texture = await PIXI.Assets.load(spriteUrl(path));
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.scale.set(SCALES[scaleKey]);
  sprite.x = x;
  sprite.y = y;
  return sprite;
}

/**
 * Load animation frames from media-stock and create AnimatedSprite.
 */
export async function createAnimatedGameSprite(
  basePath: string,
  frames: string[],
  scaleKey: keyof typeof SCALES,
  speed = 0.15
): Promise<any> {
  const textures = [];
  for (const frame of frames) {
    const tex = await PIXI.Assets.load(spriteUrl(basePath + "/" + frame));
    textures.push(tex);
  }
  const anim = new PIXI.AnimatedSprite(textures);
  anim.anchor.set(0.5);
  anim.scale.set(SCALES[scaleKey]);
  anim.animationSpeed = speed;
  anim.play();
  return anim;
}

/**
 * Load parallax background layers. Returns array of TilingSprites.
 */
export async function createParallaxBackground(
  envName: string,
  layerCount: number,
  width: number,
  height: number
): Promise<{ sprites: any[]; factors: number[] }> {
  const sprites = [];
  const factors = [];
  for (let i = 1; i <= layerCount; i++) {
    const texture = await PIXI.Assets.load(spriteUrl("environments/" + envName + "/" + i + ".png"));
    const tiling = new PIXI.TilingSprite({ texture, width, height });
    sprites.push(tiling);
    factors.push(i / (layerCount + 1)); // Auto-calculate parallax factor
  }
  return { sprites, factors };
}

// ===== CHARACTER ANIMATION SETS =====
// Pre-defined frame lists for known character packs

export const CHARACTER_FRAMES = {
  robot: {
    idle: Array.from({ length: 10 }, (_, i) => "idle_" + String(i + 1).padStart(2, "0") + ".png"),
    walk: Array.from({ length: 8 }, (_, i) => "walk_" + String(i + 1).padStart(2, "0") + ".png"),
    run: Array.from({ length: 8 }, (_, i) => "run_" + String(i + 1).padStart(2, "0") + ".png"),
    jump: Array.from({ length: 4 }, (_, i) => "jump_" + String(i + 1).padStart(2, "0") + ".png"),
    attack: Array.from({ length: 6 }, (_, i) => "attack_" + String(i + 1).padStart(2, "0") + ".png"),
    hurt: ["hurt_01.png", "hurt_02.png"],
    death: Array.from({ length: 8 }, (_, i) => "death_" + String(i + 1).padStart(2, "0") + ".png"),
  },
  zombie: {
    walk: Array.from({ length: 8 }, (_, i) => "walk_" + String(i + 1).padStart(2, "0") + ".png"),
    attack: Array.from({ length: 6 }, (_, i) => "attack_" + String(i + 1).padStart(2, "0") + ".png"),
    hurt: ["hurt_01.png", "hurt_02.png"],
    death: Array.from({ length: 6 }, (_, i) => "death_" + String(i + 1).padStart(2, "0") + ".png"),
  },
  alien: {
    idle: Array.from({ length: 4 }, (_, i) => "idle_" + String(i + 1).padStart(2, "0") + ".png"),
    walk: Array.from({ length: 6 }, (_, i) => "walk_" + String(i + 1).padStart(2, "0") + ".png"),
    jump: Array.from({ length: 3 }, (_, i) => "jump_" + String(i + 1).padStart(2, "0") + ".png"),
    attack: Array.from({ length: 4 }, (_, i) => "attack_" + String(i + 1).padStart(2, "0") + ".png"),
  },
} as Record<string, Record<string, string[]>>;

// ===== ENVIRONMENT CONFIG =====
export const ENVIRONMENTS = {
  nature: { layers: 11, theme: "nature" as const },
  forest: { layers: 8, theme: "forest" as const },
  dark: { layers: 7, theme: "dark" as const },
  mountains: { layers: 6, theme: "mountain" as const },
  simple: { layers: 4, theme: "nature" as const },
  space: { layers: 5, theme: "space" as const },
};
`,
	},

	// ---------- Template 7: GameOver Scene ----------
	{
		path: "src/scenes/GameOverScene.ts",
		language: "typescript",
		content: `import { Engine2D, GameScene } from "../engine/core";
import { createExplosionEffect } from "../engine/effects";

const PIXI = (window as any).PIXI;

export class GameOverScene implements GameScene {
  name = 'gameover';
  container: any;
  private restartText: any;

  constructor() {
    this.container = new PIXI.Container();
  }

  enter(engine: Engine2D, data?: { score?: number }): void {
    const score = data?.score || 0;

    // Dark overlay
    const overlay = new PIXI.Graphics();
    overlay.rect(0, 0, engine.config.width, engine.config.height);
    overlay.fill({ color: 0x000000, alpha: 0.7 });
    this.container.addChild(overlay);

    // Game Over text
    const title = engine.createText('GAME OVER', {
      fontSize: 64,
      fill: 0xff4444,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5);
    title.x = engine.config.width / 2;
    title.y = engine.config.height / 3;
    this.container.addChild(title);

    // Score
    const scoreText = engine.createText('Score: ' + score, {
      fontSize: 36,
      fill: 0xffffff,
    });
    scoreText.anchor.set(0.5);
    scoreText.x = engine.config.width / 2;
    scoreText.y = engine.config.height / 2;
    this.container.addChild(scoreText);

    // Restart hint
    this.restartText = engine.createText('Press SPACE to restart', {
      fontSize: 24,
      fill: 0xaaaaaa,
    });
    this.restartText.anchor.set(0.5);
    this.restartText.x = engine.config.width / 2;
    this.restartText.y = engine.config.height * 0.65;
    this.container.addChild(this.restartText);

    // Explosion particles
    const fx = createExplosionEffect(engine.config.width / 2, engine.config.height / 3, '#ff4444');
    engine.addEmitter(fx.emitter);
  }

  update(engine: Engine2D, dt: number): void {
    // Blink restart text
    if (this.restartText) {
      this.restartText.alpha = 0.5 + 0.5 * Math.sin(engine.elapsed * 4);
    }

    // Restart on space
    if (engine.input.wasPressed(' ')) {
      engine.switchScene('game');
    }

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    this.container.removeChildren();
  }
}
`,
	},

	// ---------- Template 8: React Game Component ----------
	{
		path: "src/components/Game2D.tsx",
		language: "typescript",
		content: `import { useEffect, useRef } from "react";

/**
 * React wrapper for the 2D game canvas.
 * Initializes the engine and starts the game loop.
 */
export default function Game2D({ onReady }: { onReady?: (engine: any) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<any>(null);

  useEffect(() => {
    let destroyed = false;

    async function startGame() {
      // Dynamic import to avoid SSR issues
      const { createGame2D } = await import("../engine/core");

      if (destroyed) return;

      const engine = await createGame2D({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x1a1a2e,
      });

      if (destroyed) {
        engine.destroy();
        return;
      }

      engineRef.current = engine;
      if (onReady) onReady(engine);
    }

    startGame();

    return () => {
      destroyed = true;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  return <div ref={rootRef} style={{ width: "100%", height: "100%" }} />;
}
`,
	},
];

// ============================================================================
// GAME SCENE STARTERS — Injected based on detected game type
// ============================================================================

/** Default platformer starter */
export const GAME_2D_SCENE_STARTER = `import { Engine2D, GameScene, createGame2D, loadAssets } from "../engine/core";
import { createBody, createStaticBody, createOneWayPlatform, PhysicsWorld, CharacterController } from "../engine/physics";
import { createRainEffect, createAmbientEffect, onJumpDust, onLandImpact, onCollectSparkle } from "../engine/effects";
import { createGameSprite, createAnimatedGameSprite, createParallaxBackground, SCALES, CHARACTER_FRAMES, ENVIRONMENTS } from "../config/assets";

const PIXI = (window as any).PIXI;
const Proton = (window as any).Proton;

const CONFIG = {
  gravity: 980,
  worldWidth: 3000,
  worldHeight: 800,
  platformColor: 0x44aa44,
  playerColor: 0x4488ff,
  coinColor: 0xffdd00,
  bgColor: 0x1a1a2e,
  groundY: 550,
};

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private physics!: PhysicsWorld;
  private playerSprite: any;
  private playerCtrl!: CharacterController;
  private score = 0;
  private scoreText: any;
  private coins: { sprite: any; body: any }[] = [];
  private bgLayers: any[] = [];
  private bgFactors: number[] = [];

  constructor() {
    this.container = new PIXI.Container();
  }

  async enter(engine: Engine2D): Promise<void> {
    this.physics = new PhysicsWorld(CONFIG.gravity);
    this.score = 0;
    this.coins = [];

    const W = engine.config.width;
    const H = engine.config.height;

    // Sky gradient background
    const sky = new PIXI.Graphics();
    sky.rect(0, 0, CONFIG.worldWidth, CONFIG.worldHeight);
    sky.fill(0x2c3e6b);
    this.container.addChild(sky);

    // Parallax mountains (simple shapes)
    for (let layer = 0; layer < 3; layer++) {
      const mountains = new PIXI.Graphics();
      const baseY = CONFIG.groundY - 50 - layer * 80;
      const alpha = 0.15 + layer * 0.1;
      const color = [0x334466, 0x445577, 0x556688][layer];
      for (let x = 0; x < CONFIG.worldWidth; x += 200 + layer * 100) {
        const peakH = 80 + Math.random() * 120 + layer * 40;
        const peakW = 150 + Math.random() * 100 + layer * 50;
        mountains.moveTo(x, baseY);
        mountains.lineTo(x + peakW / 2, baseY - peakH);
        mountains.lineTo(x + peakW, baseY);
        mountains.closePath();
        mountains.fill({ color, alpha });
      }
      this.container.addChild(mountains);
      this.bgLayers.push(mountains);
      this.bgFactors.push(0.1 + layer * 0.15);
    }

    // Ground
    const ground = new PIXI.Graphics();
    ground.rect(0, CONFIG.groundY, CONFIG.worldWidth, CONFIG.worldHeight - CONFIG.groundY);
    ground.fill(0x3a5a2a);
    ground.rect(0, CONFIG.groundY, CONFIG.worldWidth, 8);
    ground.fill(0x5a8a3a);
    this.container.addChild(ground);
    const groundBody = createStaticBody(CONFIG.worldWidth / 2, CONFIG.groundY + 4, CONFIG.worldWidth, 8);
    this.physics.addBody(groundBody);

    // Platforms
    const platforms = [
      { x: 350, y: 430, w: 180 },
      { x: 650, y: 350, w: 150 },
      { x: 950, y: 400, w: 200 },
      { x: 1250, y: 320, w: 160 },
      { x: 1550, y: 380, w: 180 },
      { x: 1850, y: 300, w: 200 },
      { x: 2150, y: 430, w: 150 },
      { x: 2450, y: 350, w: 180 },
    ];
    for (const p of platforms) {
      const plat = new PIXI.Graphics();
      plat.roundRect(-p.w / 2, -12, p.w, 24, 6);
      plat.fill(CONFIG.platformColor);
      plat.roundRect(-p.w / 2, -12, p.w, 6, 3);
      plat.fill(0x66cc66);
      plat.x = p.x;
      plat.y = p.y;
      this.container.addChild(plat);
      const body = createOneWayPlatform(p.x, p.y, p.w, 24);
      this.physics.addBody(body);
    }

    // Player
    this.playerSprite = new PIXI.Graphics();
    this.playerSprite.roundRect(-16, -24, 32, 48, 4);
    this.playerSprite.fill(CONFIG.playerColor);
    this.playerSprite.circle(0, -14, 10);
    this.playerSprite.fill(0x66aaff);
    this.playerSprite.rect(-4, -4, 3, 6);
    this.playerSprite.rect(1, -4, 3, 6);
    this.playerSprite.fill(0xffffff);
    this.playerSprite.x = 200;
    this.playerSprite.y = CONFIG.groundY - 30;
    this.container.addChild(this.playerSprite);

    const playerBody = createBody(200, CONFIG.groundY - 30, 28, 44);
    playerBody.sprite = this.playerSprite;
    playerBody.tag = 'player';
    this.physics.addBody(playerBody);
    this.playerCtrl = new CharacterController(playerBody, {
      moveSpeed: 300, jumpForce: 520, doubleJump: true, wallSlide: false,
    });

    // Coins
    const coinPositions = [
      { x: 350, y: 390 }, { x: 400, y: 390 },
      { x: 650, y: 310 }, { x: 700, y: 310 },
      { x: 950, y: 360 }, { x: 1000, y: 360 },
      { x: 1250, y: 280 }, { x: 1300, y: 280 },
      { x: 1550, y: 340 }, { x: 1850, y: 260 },
      { x: 2150, y: 390 }, { x: 2450, y: 310 },
      { x: 300, y: 510 }, { x: 500, y: 510 },
      { x: 800, y: 510 }, { x: 1100, y: 510 },
    ];
    for (const cp of coinPositions) {
      const coin = new PIXI.Graphics();
      coin.circle(0, 0, 10);
      coin.fill(CONFIG.coinColor);
      coin.circle(0, 0, 6);
      coin.fill(0xffee66);
      coin.x = cp.x;
      coin.y = cp.y;
      this.container.addChild(coin);
      const coinBody = createBody(cp.x, cp.y, 18, 18, { isStatic: true, isSensor: true, tag: 'coin' });
      coinBody.sprite = coin;
      this.physics.addBody(coinBody);
      this.coins.push({ sprite: coin, body: coinBody });
    }

    // Collision handler
    this.physics.onSensorOverlap((a, b) => {
      const coin = a.tag === 'coin' ? a : b.tag === 'coin' ? b : null;
      const player = a.tag === 'player' ? a : b.tag === 'player' ? b : null;
      if (coin && player) {
        onCollectSparkle(engine.proton, coin.x, coin.y);
        if (coin.sprite) { coin.sprite.visible = false; }
        coin.enabled = false;
        this.score += 10;
        if (this.scoreText) this.scoreText.text = 'Score: ' + this.score;
      }
    });

    // Ambient particle effects
    const ambient = createAmbientEffect('fireflies', W, H);
    engine.addEmitter(ambient.emitter);

    // Score display (UI layer — fixed on screen)
    this.scoreText = engine.createText('Score: 0', { fontSize: 28, fill: 0xffffff });
    this.scoreText.x = 16;
    this.scoreText.y = 16;
    engine.ui.addChild(this.scoreText);

    // Controls hint
    const hint = engine.createText('WASD / Arrows to move, Space to jump', { fontSize: 14, fill: 0xaaaaaa });
    hint.x = 16;
    hint.y = H - 30;
    engine.ui.addChild(hint);

    // Camera follow
    engine.camera.follow(playerBody);
    engine.camera.worldWidth = CONFIG.worldWidth;
    engine.camera.worldHeight = CONFIG.worldHeight;
    engine.camera.smoothing = 0.08;
  }

  update(engine: Engine2D, dt: number): void {
    this.physics.update(dt);

    if (this.playerCtrl) {
      const wasOnGround = this.playerCtrl.body.onGround;
      this.playerCtrl.update({
        left: engine.input.left,
        right: engine.input.right,
        jump: engine.input.jump,
      }, dt);
      // Jump dust
      if (!this.playerCtrl.body.onGround && wasOnGround && this.playerCtrl.body.vy < 0) {
        onJumpDust(engine.proton, this.playerCtrl.body.x, this.playerCtrl.body.y + 22);
      }
      // Land impact
      if (this.playerCtrl.body.onGround && !wasOnGround) {
        onLandImpact(engine.proton, this.playerCtrl.body.x, this.playerCtrl.body.y + 22);
      }
    }

    // Fall death
    if (this.playerCtrl && this.playerCtrl.body.y > CONFIG.worldHeight + 100) {
      engine.switchScene('gameover', { score: this.score });
    }

    // Animate coins (bob up and down)
    for (const c of this.coins) {
      if (c.sprite.visible) {
        c.sprite.y = c.body.y + Math.sin(engine.elapsed * 3 + c.body.x) * 4;
      }
    }

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
}
`;

/** Runner game starter */
export const GAME_2D_SCENE_STARTER_RUNNER = `import { Engine2D, GameScene, createGame2D } from "../engine/core";
import { createBody, createStaticBody, PhysicsWorld } from "../engine/physics";
import { createAmbientEffect, onJumpDust, onLandImpact } from "../engine/effects";
import { createGameSprite, createParallaxBackground, SCALES, ENVIRONMENTS } from "../config/assets";

const PIXI = (window as any).PIXI;

const CONFIG = {
  scrollSpeed: 300,
  lanes: 3,
  laneHeight: 120,
  gravity: 1200,
  jumpForce: 600,
  environment: 'nature',
  theme: 'nature' as const,
};

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private physics!: PhysicsWorld;
  private scrollSpeed: number;
  private score = 0;
  private distance = 0;

  constructor() {
    this.container = new PIXI.Container();
    this.scrollSpeed = CONFIG.scrollSpeed;
  }

  async enter(engine: Engine2D): Promise<void> {
    this.physics = new PhysicsWorld(CONFIG.gravity);
    this.score = 0;
    this.distance = 0;

    // TODO: Set up runner game
    // 1. Parallax background (auto-scrolling)
    // 2. Ground platform (infinite via respawning)
    // 3. Player in left third of screen
    // 4. Obstacle spawner (timer-based, increasing difficulty)
    // 5. Lane-switching or jump mechanics
    // 6. Score counter (distance or time)
  }

  update(engine: Engine2D, dt: number): void {
    this.physics.update(dt);
    this.distance += this.scrollSpeed * dt;
    this.score = Math.floor(this.distance / 10);

    // Speed ramp
    this.scrollSpeed = CONFIG.scrollSpeed + this.distance * 0.01;

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    this.container.removeChildren();
  }
}
`;

/** Puzzle game starter */
export const GAME_2D_SCENE_STARTER_PUZZLE = `import { Engine2D, GameScene, createGame2D } from "../engine/core";
import { createSparkleEffect, onCollectSparkle } from "../engine/effects";
import { SCALES } from "../config/assets";

const PIXI = (window as any).PIXI;

const CONFIG = {
  gridCols: 8,
  gridRows: 6,
  cellSize: 64,
  theme: 'cartoon' as const,
};

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private grid: any[][] = [];
  private score = 0;
  private selectedCell: { row: number; col: number } | null = null;

  constructor() {
    this.container = new PIXI.Container();
  }

  async enter(engine: Engine2D): Promise<void> {
    this.score = 0;

    // TODO: Set up puzzle game
    // 1. Create grid container centered on screen
    // 2. Fill grid with colored tiles/gems
    // 3. Handle click/tap to select and swap
    // 4. Check for matches (3+ in row/column)
    // 5. Animate matches with sparkle effects
    // 6. Gravity fill for empty cells
    // 7. Score display in UI layer
  }

  update(engine: Engine2D, dt: number): void {
    // Handle pointer input for grid interaction
    if (engine.input.pointer.justDown) {
      const wx = engine.input.pointer.x + engine.camera.x;
      const wy = engine.input.pointer.y + engine.camera.y;
      // Convert to grid coords and handle selection/swap
    }

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    this.container.removeChildren();
  }
}
`;

/** Shooter game starter */
export const GAME_2D_SCENE_STARTER_SHOOTER = `import { Engine2D, GameScene, createGame2D } from "../engine/core";
import { createBody, createStaticBody, PhysicsWorld } from "../engine/physics";
import { createExplosionEffect, createTrailEffect, onDamageHit, onDeathExplosion } from "../engine/effects";
import { createGameSprite, SCALES } from "../config/assets";

const PIXI = (window as any).PIXI;

const CONFIG = {
  playerSpeed: 300,
  bulletSpeed: 600,
  fireRate: 0.2, // seconds between shots
  enemySpawnRate: 1.5,
  theme: 'space' as const,
};

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private physics!: PhysicsWorld;
  private bullets: any[] = [];
  private enemies: any[] = [];
  private score = 0;
  private fireCooldown = 0;
  private spawnTimer = 0;

  constructor() {
    this.container = new PIXI.Container();
  }

  async enter(engine: Engine2D): Promise<void> {
    this.physics = new PhysicsWorld(0); // No gravity for top-down shooter
    this.score = 0;

    // TODO: Set up shooter game
    // 1. Background (scrolling starfield or static environment)
    // 2. Player ship/character
    // 3. Bullet system (fire on space/click)
    // 4. Enemy spawner (waves, patterns)
    // 5. Collision: bullet↔enemy, enemy↔player
    // 6. Explosions on destruction
    // 7. Score & lives display
  }

  update(engine: Engine2D, dt: number): void {
    this.physics.update(dt);

    // Fire cooldown
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    // Enemy spawn timer
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = CONFIG.enemySpawnRate;
      // Spawn enemy
    }

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    this.container.removeChildren();
  }
}
`;
