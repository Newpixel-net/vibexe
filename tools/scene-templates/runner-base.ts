// Auto-composed base scene template: runner
import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
import { createBody, createStaticBody, PhysicsWorld, CharacterController } from "../engine/physics";
import { createAmbientEffect, createSnowEffect, createRainEffect, onJumpDust, onLandImpact, onDeathExplosion, onCollectSparkle } from "../engine/effects";
import { PALETTES, lerpColor, setNoiseSeed, drawSkyGradient, drawStars, drawMountainRange, drawCloud, drawGroundStrip, drawPlatformBlock, drawPlayerCharacter, drawCoinToken, drawEnemySlime, drawHeart, drawVignette, drawAtmosphericFog, drawLSystemTree, TREE_PRESETS, drawPointLight, createLightingLayer } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;

// ======================== SEEDED PRNG (Mulberry32) ========================
var _seed = __SEED__;
function _rng() { _seed |= 0; _seed = _seed + 0x6D2B79F5 | 0; var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function _rngRange(min: number, max: number) { return min + _rng() * (max - min); }
function _rngInt(min: number, max: number) { return Math.floor(_rngRange(min, max + 1)); }

// ======================== CONFIGURATION ========================
var THEME = '__THEME__';
var PAL = PALETTES[THEME] || PALETTES.forest;
var CONFIG = {
  gravity: __GRAVITY__,
  jumpForce: __JUMP_FORCE__,
  groundY: 600,
  playerX: 150,
  playerSize: 44,
  startSpeed: __START_SPEED__,
  maxSpeed: __MAX_SPEED__,
  speedRamp: 0.4,
  gapChance: 0.25,
  coinChance: 0.6,
  platformMinW: 120,
  platformMaxW: 280,
  lives: __LIVES__,
};

// ======================== FEATURE BANK INTEGRATION ========================
__FEATURE_FACTORIES__

// ======================== GAME SCENE ========================
export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private physics!: PhysicsWorld;
  private playerGfx: any; private playerBody: any; private playerCtrl!: CharacterController;
  private score = 0; private distance = 0; private speed = CONFIG.startSpeed;
  private platforms: { gfx: any; body: any; w: number }[] = [];
  private coins: { gfx: any; body: any }[] = [];
  private obstacles: { gfx: any; body: any }[] = [];
  private bgLayers: { gfx: any; factor: number }[] = [];
  private treeSway: any[] = [];
  private gameOver = false;

  constructor() { this.container = new PIXI.Container(); }

  async enter(engine: Engine2D): Promise<void> {
    this.physics = new PhysicsWorld(CONFIG.gravity);
    this.speed = CONFIG.startSpeed; this.score = 0; this.distance = 0; this.gameOver = false;
    this.platforms = []; this.coins = []; this.obstacles = []; this.bgLayers = []; this.treeSway = [];
    await _loadSpriteLib(THEME);
    setNoiseSeed(_seed);
    var W = engine.config.width, H = engine.config.height, WW = W * 4;

    // ---- Feature Bank: init features ----
__FEATURE_REGISTRATIONS__
    try { engine.features.initAll(); } catch(e) {}

    // ---- VISUAL ATMOSPHERE ----
    this.container.addChild(drawSkyGradient(WW, H, PAL.skyTop, PAL.skyBottom));
    this.container.addChild(drawStars(WW, H * 0.4, 50));
    for (var mi = 0; mi < 3; mi++) {
      var mGfx = drawMountainRange(WW, CONFIG.groundY - 20 - mi * 40, PAL.mountains[mi] || PAL.mountains[0], 0.4 + mi * 0.2, 40 + mi * 20, 80 + mi * 35, 220 - mi * 25, THEME, mi);
      this.container.addChild(mGfx); this.bgLayers.push({ gfx: mGfx, factor: 0.1 + mi * 0.12 });
    }
    try { var fl = drawAtmosphericFog(WW, CONFIG.groundY, THEME); for (var f = 0; f < fl.length; f++) this.container.addChild(fl[f]); } catch(e) {}

    // ---- INITIAL GROUND PLATFORMS ----
    var px = 0;
    while (px < WW) {
      var pw = CONFIG.platformMinW + _rng() * (CONFIG.platformMaxW - CONFIG.platformMinW);
      var platGfx = drawPlatformBlock(pw, 30, PAL.ground, PAL.groundTop, THEME);
      platGfx.x = px; platGfx.y = CONFIG.groundY;
      this.container.addChild(platGfx);
      var platBody = createStaticBody(px + pw / 2, CONFIG.groundY + 4, pw, 8);
      this.physics.addBody(platBody);
      this.platforms.push({ gfx: platGfx, body: platBody, w: pw });
      if (_rng() < CONFIG.coinChance) {
        var coinGfx = drawCoinToken(8, PAL.coin, PAL.coinGlow);
        coinGfx.x = px + pw / 2; coinGfx.y = CONFIG.groundY - 50;
        this.container.addChild(coinGfx);
        var coinBody = createBody(coinGfx.x, coinGfx.y, 14, 14, { isStatic: true, isSensor: true, tag: 'coin' });
        coinBody.sprite = coinGfx; this.physics.addBody(coinBody);
        this.coins.push({ gfx: coinGfx, body: coinBody });
      }
      px += pw + (_rng() < CONFIG.gapChance ? 60 + _rng() * 80 : 0);
    }

    // ---- TREES ----
    var tp = TREE_PRESETS[THEME] || [];
    if (tp.length > 0) { for (var ti = 0; ti < 5; ti++) {
      var tree = drawLSystemTree(ti * (WW / 5) + _rngRange(0, 150), CONFIG.groundY, tp[ti % tp.length], THEME, _seed + ti);
      this.container.addChild(tree); this.treeSway.push(tree);
    }}

    // ---- LIGHTING ----
    try { this.container.addChild(createLightingLayer(THEME, WW, CONFIG.groundY, [])); } catch(e) {}

    // ---- PLAYER ----
    this.playerGfx = drawPlayerCharacter(CONFIG.playerSize, PAL.player, PAL.playerLight);
    this.playerGfx.x = CONFIG.playerX; this.playerGfx.y = CONFIG.groundY - 30;
    this.container.addChild(this.playerGfx);
    this.playerBody = createBody(CONFIG.playerX, CONFIG.groundY - 30, 26, 40);
    this.playerBody.sprite = this.playerGfx; this.playerBody.tag = 'player';
    this.physics.addBody(this.playerBody);
    this.playerCtrl = new CharacterController(this.playerBody, { moveSpeed: 0, jumpForce: CONFIG.jumpForce, doubleJump: true, wallSlide: false });

    // ---- COLLISION ----
    var self = this;
    this.physics.onSensorOverlap(function(a: any, b: any) {
      var coin = a.tag === 'coin' ? a : b.tag === 'coin' ? b : null;
      if (coin && coin.enabled !== false) {
        onCollectSparkle(engine.proton, coin.x, coin.y);
        coin.sprite.visible = false; coin.enabled = false; self.score += 10;
        try { engine.events.emit('coin-collect', { score: self.score, x: coin.x, y: coin.y }); } catch(e) {}
      }
    });

    // ---- CONTROLS HINT ----
    var hint = engine.createText('Space / Up to Jump', { fontSize: 11, fill: 0x666666 });
    hint.anchor.set(0.5, 1); hint.x = W / 2; hint.y = H - 8; engine.ui.addChild(hint);

    // ---- VIGNETTE ----
    try { engine.ui.addChild(drawVignette(W, H)); } catch(e) {}

    // ---- CAMERA ----
    engine.camera.follow(this.playerBody); engine.camera.worldWidth = WW; engine.camera.worldHeight = H; engine.camera.smoothing = 0.06;
    engine.juice.breathe(this.playerGfx, 1.03, 1.5);
    try { if (PAL.ambient) { var af = createAmbientEffect(PAL.ambient as any, W, H); if (af && af.emitter) engine.addEmitter(af.emitter); } } catch(e) {}

    // === AI ENHANCEMENT ZONE ===
__CUSTOM_CODE__
  }

  update(engine: Engine2D, dt: number): void {
    if (this.gameOver || !this.playerGfx) { engine.input.endFrame(); return; }
    this.physics.update(dt);

    // Auto-run
    if (this.playerBody) {
      this.playerBody.vx = this.speed;
      this.playerGfx.x = this.playerBody.x; this.playerGfx.y = this.playerBody.y;
    }
    // Jump
    if (this.playerCtrl) { this.playerCtrl.update({ left: false, right: false, jump: engine.input.jump }, dt); }
    // Speed ramp
    this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.speedRamp * dt);
    this.distance += this.speed * dt * 0.01;
    try { engine.events.emit('distance-update', { distance: Math.floor(this.distance), score: this.score + Math.floor(this.distance) }); } catch(e) {}

    // Coin bob
    for (var c = 0; c < this.coins.length; c++) {
      if (this.coins[c].gfx.visible) this.coins[c].gfx.y += Math.sin(engine.elapsed * 3 + c) * 0.3;
    }
    // Tree sway
    for (var sw = 0; sw < this.treeSway.length; sw++) {
      this.treeSway[sw].skew.x = Math.sin(engine.elapsed * 1.2 + this.treeSway[sw].x * 0.008) * 0.015;
    }
    // Fall death
    if (this.playerBody && this.playerBody.y > CONFIG.groundY + 200) {
      this.gameOver = true;
      var finalScore = this.score + Math.floor(this.distance);
      try { engine.events.emit('player-death', { score: finalScore }); } catch(e) {}
      engine.scene.switch('gameover', { score: finalScore });
    }

    // ---- Feature Bank: update features ----
    try { engine.features.updateAll(dt); } catch(e) {}

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    try { engine.features.destroyAll(); } catch(e) {}
    engine.juice.killAll(); this.container.removeChildren(); engine.ui.removeChildren();
  }
}
