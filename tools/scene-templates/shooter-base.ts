// Auto-composed base scene template: shooter
import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
import { createExplosionEffect, createAmbientEffect, onDeathExplosion, onCollectSparkle } from "../engine/effects";
import { PALETTES, lerpColor, setNoiseSeed, drawSkyGradient, drawStars, drawCoinToken, drawHeart, drawShipShape, drawVignette, drawAtmosphericFog, drawPointLight, createLightingLayer } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;

// ======================== SEEDED PRNG (Mulberry32) ========================
var _seed = __SEED__;
function _rng() { _seed |= 0; _seed = _seed + 0x6D2B79F5 | 0; var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function _rngRange(min: number, max: number) { return min + _rng() * (max - min); }
function _rngInt(min: number, max: number) { return Math.floor(_rngRange(min, max + 1)); }

// ======================== CONFIGURATION ========================
var THEME = '__THEME__';
var PAL = PALETTES[THEME] || PALETTES.space;
var CONFIG = {
  playerSpeed: __MOVE_SPEED__,
  bulletSpeed: 650,
  fireRate: __FIRE_RATE__,
  enemyBaseSpeed: __ENEMY_SPEED__,
  enemySpawnRate: __ENEMY_SPAWN_RATE__,
  lives: __LIVES__,
  playerSize: 48,
  enemySize: 44,
  bulletW: 6,
  bulletH: 18,
};

// ======================== FEATURE BANK INTEGRATION ========================
__FEATURE_FACTORIES__

// ======================== GAME SCENE ========================
export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private playerGfx: any;
  private score = 0; private lives = CONFIG.lives; private fireCooldown = 0; private spawnTimer = 0; private wave = 1;
  private bullets: { gfx: any; vy: number }[] = [];
  private enemies: { gfx: any; vx: number; vy: number; hp: number }[] = [];
  private stars: any;

  constructor() { this.container = new PIXI.Container(); }

  async enter(engine: Engine2D): Promise<void> {
    this.score = 0; this.lives = CONFIG.lives; this.fireCooldown = 0; this.spawnTimer = 0; this.wave = 1;
    this.bullets = []; this.enemies = [];
    await _loadSpriteLib(THEME);
    setNoiseSeed(_seed);
    var W = engine.config.width, H = engine.config.height;

    // ---- Feature Bank: init features ----
__FEATURE_REGISTRATIONS__
    try { engine.features.initAll(); } catch(e) {}

    // ---- VISUAL ATMOSPHERE ----
    var skyGfx = new PIXI.Graphics();
    if (PIXI.FillGradient) {
      var sg = new PIXI.FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
        colorStops: [{ offset: 0, color: '#0a0a2e' }, { offset: 0.5, color: '#1a1a4e' }, { offset: 1, color: '#2a1a3e' }] });
      skyGfx.rect(0, 0, W, H); skyGfx.fill(sg);
    } else { skyGfx.rect(0, 0, W, H); skyGfx.fill(0x0a0a2e); }
    this.container.addChild(skyGfx);
    this.stars = drawStars(W, H, 150); this.container.addChild(this.stars);
    try { if (PAL.ambient) { var af = createAmbientEffect(PAL.ambient as any, W, H); if (af && af.emitter) engine.addEmitter(af.emitter); } } catch(e) {}

    // ---- PLAYER SHIP ----
    this.playerGfx = drawShipShape(CONFIG.playerSize, PAL.player, PAL.playerLight);
    this.playerGfx.x = W / 2; this.playerGfx.y = H - 90;
    this.container.addChild(this.playerGfx);

    // ---- CONTROLS HINT ----
    var hint = engine.createText('Left/Right to move, auto-fire', { fontSize: 11, fill: 0x666666 });
    hint.anchor.set(0.5, 1); hint.x = W / 2; hint.y = H - 8; engine.ui.addChild(hint);

    // ---- VIGNETTE ----
    try { engine.ui.addChild(drawVignette(W, H)); } catch(e) {}

    // === AI ENHANCEMENT ZONE ===
__CUSTOM_CODE__
  }

  private _spawnEnemy(W: number): void {
    var container = new PIXI.Container();
    var g = new PIXI.Graphics();
    var sz = CONFIG.enemySize;
    var eColor = [0xff4444, 0xff8844, 0xffaa00, 0xcc44ff, 0x44ffaa][_rngInt(0, 4)];
    g.moveTo(0, sz * 0.5); g.lineTo(-sz * 0.45, -sz * 0.2); g.lineTo(-sz * 0.2, -sz * 0.15);
    g.lineTo(0, -sz * 0.5); g.lineTo(sz * 0.2, -sz * 0.15); g.lineTo(sz * 0.45, -sz * 0.2); g.closePath();
    g.fill(eColor);
    g.circle(0, -sz * 0.05, sz * 0.12); g.fill(0xffffff);
    g.circle(0, -sz * 0.05, sz * 0.08); g.fill(eColor);
    g.moveTo(-sz * 0.35, -sz * 0.1); g.lineTo(-sz * 0.2, sz * 0.1); g.lineTo(-sz * 0.15, -sz * 0.05); g.closePath();
    g.fill({ color: 0xffffff, alpha: 0.2 });
    g.moveTo(sz * 0.35, -sz * 0.1); g.lineTo(sz * 0.2, sz * 0.1); g.lineTo(sz * 0.15, -sz * 0.05); g.closePath();
    g.fill({ color: 0xffffff, alpha: 0.2 });
    container.addChild(g);
    if (PIXI.filters && PIXI.filters.GlowFilter) {
      try { container.filters = [new PIXI.filters.GlowFilter({ distance: 8, outerStrength: 1.5, color: eColor })]; } catch(e) {}
    }
    container.x = 40 + _rng() * (W - 80); container.y = -40;
    this.container.addChild(container);
    var vx = (_rng() - 0.5) * 80;
    var vy = CONFIG.enemyBaseSpeed * (0.8 + _rng() * 0.4 + this.wave * 0.08);
    this.enemies.push({ gfx: container, vx: vx, vy: vy, hp: 1 });
  }

  private _fireBullet(): void {
    var g = new PIXI.Graphics();
    var bw = CONFIG.bulletW, bh = CONFIG.bulletH;
    g.roundRect(-bw, -bh - 2, bw * 2, bh + 4, 3);
    g.fill({ color: 0x44ddff, alpha: 0.3 });
    g.roundRect(-bw / 2, -bh, bw, bh, 2);
    g.fill(0x44ddff);
    g.roundRect(-bw / 2 + 1, -bh + 2, bw - 2, bh * 0.5, 1);
    g.fill({ color: 0xffffff, alpha: 0.8 });
    g.blendMode = 'add';
    g.x = this.playerGfx.x; g.y = this.playerGfx.y - 25;
    this.container.addChild(g);
    this.bullets.push({ gfx: g, vy: -CONFIG.bulletSpeed });
  }

  update(engine: Engine2D, dt: number): void {
    var W = engine.config.width, H = engine.config.height;

    // Player movement
    if (this.playerGfx) {
      if (engine.input.left) this.playerGfx.x -= CONFIG.playerSpeed * dt;
      if (engine.input.right) this.playerGfx.x += CONFIG.playerSpeed * dt;
      this.playerGfx.x = Math.max(30, Math.min(W - 30, this.playerGfx.x));
    }

    // Auto-fire
    if (!this.playerGfx) { engine.input.endFrame(); return; }
    this.fireCooldown -= dt;
    if (this.fireCooldown <= 0) { this._fireBullet(); this.fireCooldown = CONFIG.fireRate; }

    // Move bullets
    for (var bi = this.bullets.length - 1; bi >= 0; bi--) {
      var b = this.bullets[bi];
      b.gfx.y += b.vy * dt;
      if (b.gfx.y < -20) { b.gfx.destroy(); this.bullets.splice(bi, 1); }
    }

    // Spawn enemies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this._spawnEnemy(W); this.spawnTimer = CONFIG.enemySpawnRate * Math.max(0.3, 1 - this.wave * 0.05); }

    // Move enemies
    for (var ei = this.enemies.length - 1; ei >= 0; ei--) {
      var en = this.enemies[ei];
      en.gfx.x += en.vx * dt; en.gfx.y += en.vy * dt;
      en.gfx.rotation = Math.sin(engine.elapsed * 3 + ei) * 0.1;
      if (en.gfx.y > H + 40) { en.gfx.destroy(); this.enemies.splice(ei, 1); continue; }
      // Hit player
      if (this.playerGfx && Math.abs(en.gfx.x - this.playerGfx.x) < 28 && Math.abs(en.gfx.y - this.playerGfx.y) < 28) {
        try { onDeathExplosion(engine.proton, en.gfx.x, en.gfx.y, '#ff4444'); } catch(e) {}
        en.gfx.destroy(); this.enemies.splice(ei, 1);
        this.lives--;
        try { engine.events.emit('player-hit', { lives: this.lives, x: en.gfx.x, y: en.gfx.y }); } catch(e) {}
        engine.juice.shake(engine.world, 8, 0.25);
        if (this.lives <= 0) {
          try { engine.events.emit('player-death', { score: this.score }); } catch(e) {}
          engine.scene.switch('gameover', { score: this.score });
        }
        continue;
      }
      // Bullet-enemy collision
      for (var bj = this.bullets.length - 1; bj >= 0; bj--) {
        var bl = this.bullets[bj];
        if (Math.abs(bl.gfx.x - en.gfx.x) < 20 && Math.abs(bl.gfx.y - en.gfx.y) < 22) {
          try { onCollectSparkle(engine.proton, en.gfx.x, en.gfx.y); } catch(e) {}
          en.gfx.destroy(); this.enemies.splice(ei, 1);
          bl.gfx.destroy(); this.bullets.splice(bj, 1);
          this.score += 100;
          try { engine.events.emit('enemy-kill', { score: this.score, x: en.gfx.x, y: en.gfx.y }); } catch(e) {}
          if (this.score > 0 && this.score % 1000 === 0) { this.wave++; }
          break;
        }
      }
    }

    // Star scroll
    if (this.stars) this.stars.y += 15 * dt;

    // ---- Feature Bank: update features ----
    try { engine.features.updateAll(dt); } catch(e) {}

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    try { engine.features.destroyAll(); } catch(e) {}
    this.container.removeChildren(); engine.ui.removeChildren();
  }
}
