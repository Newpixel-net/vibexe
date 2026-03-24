/**
 * Reference Games — 4 diverse examples showing different creative approaches.
 * These are injected into the AI system prompt as INSPIRATION, not templates to copy.
 * Each demonstrates different visual style, gameplay focus, level structure, and custom entities.
 */

// ============================================================================
// REFERENCE GAME 1: "Forest Explorer" — collect-focused, warm, wide exploration
// ============================================================================
const REF_FOREST_EXPLORER = `
// --- REFERENCE: Forest Explorer ---
// STYLE: Warm, firefly atmosphere with golden lighting
// FOCUS: Collect-focused — many coins in trail patterns, few enemies
// LAYOUT: Spread-exploration with wide platforms and multiple paths
// CUSTOM: Treasure chests, glowing mushrooms, vine bridges
// This is INSPIRATION — do NOT copy this code directly

import { Engine2D, GameScene, createGame2D, loadAssets } from "../engine/core";
import { PhysicsWorld, createBody, createStaticBody, createOneWayPlatform, CharacterController } from "../engine/physics";
import { createAmbientEffect, onJumpDust, onLandImpact, onCollectSparkle } from "../engine/effects";
import { PALETTES, drawSkyGradient, drawStars, drawMountainRange, drawCloud, drawGroundStrip, drawPlatformBlock, drawPlayerCharacter, drawCoinToken, drawHeart, drawLSystemTree, TREE_PRESETS, createLightingLayer, drawVignette, drawAtmosphericFog } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

// --- Custom entity: Treasure chest drawn with Canvas 2D ---
function drawTreasureChest(size: number, color: number): PIXI.Sprite {
  var w = size * 1.2, h = size;
  var canvas = document.createElement("canvas");
  canvas.width = w * 2; canvas.height = h * 2;
  var ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  // Body
  ctx.fillStyle = "#8B4513";
  ctx.beginPath(); ctx.roundRect(2, h * 0.35, w - 4, h * 0.62, 4); ctx.fill();
  // Lid
  ctx.fillStyle = "#A0522D";
  ctx.beginPath(); ctx.ellipse(w / 2, h * 0.38, w / 2 - 2, h * 0.22, 0, Math.PI, 0); ctx.fill();
  // Gold clasp
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(w / 2 - 6, h * 0.3, 12, 14);
  // Glow
  ctx.shadowColor = "rgba(255, 215, 0, 0.6)"; ctx.shadowBlur = 15;
  ctx.fillStyle = "#FFD700"; ctx.fillRect(w / 2 - 3, h * 0.35, 6, 8);
  var tex = PIXI.Texture.from(canvas);
  var s = new PIXI.Sprite(tex); s.anchor.set(0.5, 1); return s;
}

// --- Custom entity: Glowing mushroom ---
function drawGlowMushroom(size: number, glowColor: number): PIXI.Container {
  var c = new PIXI.Container();
  var g = new PIXI.Graphics();
  g.circle(0, -size * 0.4, size * 0.5).fill({ color: glowColor, alpha: 0.8 });
  g.rect(-size * 0.12, -size * 0.1, size * 0.24, size * 0.4).fill({ color: 0xEEDDCC });
  c.addChild(g);
  // Apply glow filter
  try { c.filters = [new PIXI.BlurFilter({ strength: 2 })]; } catch(e) {}
  return c;
}

export default class GameScene2D implements GameScene {
  name = 'game';
  container = new PIXI.Container();
  enter(engine: Engine2D) {
    var PAL = PALETTES["forest"];
    var W = 5000, H = 900, GROUND_Y = H - 60;
    var app = engine.app, world = this.container;
    var physics = new PhysicsWorld(0, 980);

    // === VISUAL LAYERS ===
    // 1. Sky gradient
    var sky = drawSkyGradient(W, H, PAL.skyTop, PAL.skyBottom);
    world.addChildAt(sky, 0);

    // 2. Stars (subtle, warm-toned)
    var stars = drawStars(W, H * 0.4, 40);
    stars.alpha = 0.3; world.addChild(stars);

    // 3. Parallax mountains — warm forest tones
    for (var i = 0; i < 3; i++) {
      var mt = drawMountainRange(W, GROUND_Y - 80 + i * 30, PAL.mountains[i], 0.5 - i * 0.12, 60, 160, 200);
      world.addChild(mt);
    }

    // 4. Atmospheric fog
    var fog = drawAtmosphericFog(W, H, PAL.skyBottom, 0.15);
    world.addChild(fog);

    // 5. Trees — multiple types for variety
    for (var t = 0; t < 15; t++) {
      var tx = 200 + Math.random() * (W - 400);
      var tree = drawLSystemTree(TREE_PRESETS.oak, PAL.foliage, PAL.foliageLight);
      tree.x = tx; tree.y = GROUND_Y; world.addChild(tree);
    }

    // 6. Glowing mushrooms as ground decoration
    for (var m = 0; m < 12; m++) {
      var mush = drawGlowMushroom(16, 0x88FF44);
      mush.x = 300 + Math.random() * (W - 600); mush.y = GROUND_Y;
      world.addChild(mush);
      engine.juice.float(mush, 3, 2 + Math.random());
    }

    // 7. Ground
    var ground = drawGroundStrip(W, GROUND_Y, 60, PAL.ground, PAL.groundTop);
    world.addChild(ground);
    createStaticBody(physics, 0, GROUND_Y, W, 60);

    // === PLATFORMS — wide and exploratory ===
    var platforms: Array<{x: number, y: number, w: number}> = [];
    // Multiple paths: lower easy route, upper reward route
    var lowerY = GROUND_Y - 120, upperY = GROUND_Y - 280;
    for (var p = 0; p < 8; p++) {
      var px = 400 + p * 500 + (Math.random() - 0.5) * 100;
      var py = p % 2 === 0 ? lowerY : lowerY - 60;
      var pw = 140 + Math.random() * 80; // Wide platforms
      platforms.push({ x: px, y: py, w: pw });
      var plat = drawPlatformBlock(pw, 28, PAL.platform, PAL.platformTop);
      plat.x = px; plat.y = py; world.addChild(plat);
      createOneWayPlatform(physics, px, py, pw, 28);
    }
    // Upper route — harder to reach, more treasure
    for (var u = 0; u < 5; u++) {
      var ux = 600 + u * 700;
      var uw = 100 + Math.random() * 60;
      platforms.push({ x: ux, y: upperY, w: uw });
      var uplat = drawPlatformBlock(uw, 28, PAL.platform, PAL.platformTop);
      uplat.x = ux; uplat.y = upperY; world.addChild(uplat);
      createOneWayPlatform(physics, ux, upperY, uw, 28);
    }

    // === PLAYER ===
    await _loadSpriteLib("forest");
    var playerGfx = drawPlayerCharacter(48, PAL.player, PAL.playerLight);
    playerGfx.x = 100; playerGfx.y = GROUND_Y - 48; world.addChild(playerGfx);
    var playerBody = createBody(physics, 100, GROUND_Y - 48, 36, 48, { tag: "player" });
    playerBody.sprite = playerGfx;
    var controller = new CharacterController(playerBody, { moveSpeed: 260, jumpForce: 500, gravity: 980 });

    // === COINS — trail patterns along paths ===
    var coins: PIXI.DisplayObject[] = [];
    // Trail along lower path
    for (var c = 0; c < 35; c++) {
      var cx = 200 + c * 120 + Math.sin(c * 0.5) * 40;
      var cy = GROUND_Y - 90 - Math.abs(Math.sin(c * 0.3)) * 60;
      var coin = drawCoinToken(10, PAL.coin, PAL.coinGlow);
      coin.x = cx; coin.y = cy; world.addChild(coin);
      coins.push(coin);
      engine.juice.float(coin, 4, 1.5 + Math.random());
      createBody(physics, cx, cy, 20, 20, { tag: "coin", sensor: true });
    }

    // === TREASURE CHESTS on upper route ===
    var chests: PIXI.DisplayObject[] = [];
    for (var ch = 0; ch < 4; ch++) {
      var chest = drawTreasureChest(32, 0x8B4513);
      chest.x = 700 + ch * 700; chest.y = upperY;
      world.addChild(chest); chests.push(chest);
      engine.juice.breathe(chest, 1.05, 2);
      createBody(physics, chest.x, chest.y - 16, 38, 32, { tag: "chest", sensor: true });
    }

    // === FEW ENEMIES — patrol slowly ===
    for (var e = 0; e < 3; e++) {
      var ex = 800 + e * 1200;
      var enemy = drawEnemySlime(36, PAL.enemy, PAL.enemyLight);
      enemy.x = ex; enemy.y = GROUND_Y - 36; world.addChild(enemy);
      createBody(physics, ex, GROUND_Y - 36, 32, 36, { tag: "enemy" });
    }

    // === PARTICLES — warm fireflies ===
    createAmbientEffect(engine, world, "fireflies", W, H);

    // === LIGHTING + VIGNETTE ===
    var lighting = createLightingLayer(W, H, 0xFFEE88, 0.08);
    world.addChild(lighting);
    var vig = drawVignette(app.screen.width, app.screen.height, 0.4);
    app.stage.addChild(vig);

    // === UI ===
    var score = 0, lives = 3;
    var scoreTxt = new PIXI.Text({ text: "Score: 0", style: { fill: 0xFFFFFF, fontSize: 22, fontWeight: "bold", stroke: { color: 0x000000, width: 3 } } });
    scoreTxt.x = 16; scoreTxt.y = 16; app.stage.addChild(scoreTxt);

    // === CAMERA ===
    engine.camera.follow(playerBody);
    engine.camera.worldWidth = W; engine.camera.worldHeight = H; engine.camera.smoothing = 0.08;

    // === UPDATE LOOP ===
    this._update = (dt: number) => {
      controller.update(engine.input, dt);
      physics.update(dt);
      physics.onSensorOverlap((a, b) => {
        if (a.tag === "coin" || b.tag === "coin") {
          score += 10; scoreTxt.text = "Score: " + score;
          engine.juice.pop(scoreTxt, 1.3, 0.15);
          onCollectSparkle(engine, a.sprite || b.sprite);
        }
        if (a.tag === "chest" || b.tag === "chest") {
          score += 100; scoreTxt.text = "Score: " + score;
          engine.juice.shake(world, 6, 0.2);
        }
      });
      engine.camera.update(dt);
      engine.input.endFrame();
    };
  }
  private _update: ((dt: number) => void) | null = null;
  update(engine: Engine2D, dt: number) { this._update?.(dt); }
  exit(engine: Engine2D) { engine.juice.killAll(); engine.features.destroy(); }
}
`;

// ============================================================================
// REFERENCE GAME 2: "Neon Combat Arena" — combat-focused, neon glow, tight platforms
// ============================================================================
const REF_NEON_ARENA = `
// --- REFERENCE: Neon Combat Arena ---
// STYLE: Neon glow with additive blending, dark background
// FOCUS: Combat-focused — many aggressive enemies, combo counter
// LAYOUT: Tight-platforming with small precise platforms
// CUSTOM: Laser projectiles, neon trail particles, combo system
// This is INSPIRATION — do NOT copy this code directly

import { Engine2D, GameScene, createGame2D, loadAssets } from "../engine/core";
import { PhysicsWorld, createBody, createStaticBody, createOneWayPlatform, CharacterController } from "../engine/physics";
import { onJumpDust, onDeathExplosion } from "../engine/effects";
import { PALETTES, drawSkyGradient, drawPlayerCharacter, drawHeart, drawVignette } from "../config/assets";
import { _loadSpriteLib } from "../utils/media-stock";

// --- Custom: Neon platform drawn with glow ---
function drawNeonPlatform(w: number, h: number, color: number): PIXI.Graphics {
  var g = new PIXI.Graphics();
  g.roundRect(0, 0, w, h, 4).fill({ color: 0x111122 }).stroke({ color: color, width: 2 });
  // Top glow line
  g.rect(2, 0, w - 4, 2).fill({ color: color, alpha: 0.9 });
  g.pivot.set(w / 2, h);
  return g;
}

// --- Custom: Chaser enemy that pursues player ---
function drawChaserEnemy(size: number): PIXI.Graphics {
  var g = new PIXI.Graphics();
  // Angular shape — aggressive look
  g.moveTo(0, -size).lineTo(size * 0.6, size * 0.3).lineTo(-size * 0.6, size * 0.3).closePath();
  g.fill({ color: 0xFF1144 });
  g.stroke({ color: 0xFF4466, width: 2 });
  return g;
}

// --- Custom: Ranged enemy that shoots ---
function drawRangedEnemy(size: number): PIXI.Graphics {
  var g = new PIXI.Graphics();
  g.circle(0, 0, size * 0.5).fill({ color: 0x8844FF });
  g.rect(-size * 0.4, size * 0.2, size * 0.8, size * 0.15).fill({ color: 0xAA66FF }); // "gun"
  g.stroke({ color: 0xBB88FF, width: 1.5 });
  return g;
}

// --- Custom: Laser projectile ---
function createLaser(x: number, y: number, vx: number, color: number): { gfx: PIXI.Graphics, vx: number, vy: number } {
  var g = new PIXI.Graphics();
  g.rect(-8, -2, 16, 4).fill({ color: color, alpha: 0.9 });
  g.x = x; g.y = y;
  return { gfx: g, vx: vx, vy: 0 };
}

export default class GameScene2D implements GameScene {
  name = 'game';
  container = new PIXI.Container();
  enter(engine: Engine2D) {
    var PAL = PALETTES["dark"];
    var W = 3500, H = 900, GROUND_Y = H - 50;
    var app = engine.app, world = this.container;
    var physics = new PhysicsWorld(0, 1100); // High gravity — snappy feel

    // === DARK NEON BACKGROUND ===
    var sky = drawSkyGradient(W, H, 0x050510, 0x0A0A20);
    world.addChildAt(sky, 0);

    // Neon grid lines on background
    var gridGfx = new PIXI.Graphics();
    for (var gx = 0; gx < W; gx += 120) {
      gridGfx.moveTo(gx, 0).lineTo(gx, H).stroke({ color: 0x1122AA, width: 0.5, alpha: 0.15 });
    }
    for (var gy = 0; gy < H; gy += 120) {
      gridGfx.moveTo(0, gy).lineTo(W, gy).stroke({ color: 0x1122AA, width: 0.5, alpha: 0.15 });
    }
    world.addChild(gridGfx);

    // Ground — neon strip
    var groundGfx = new PIXI.Graphics();
    groundGfx.rect(0, GROUND_Y, W, 50).fill({ color: 0x0A0A20 });
    groundGfx.rect(0, GROUND_Y, W, 3).fill({ color: 0x00FFAA, alpha: 0.7 });
    world.addChild(groundGfx);
    createStaticBody(physics, 0, GROUND_Y, W, 50);

    // === TIGHT PLATFORMS — precision jumping ===
    var platColors = [0x00FFAA, 0xFF00AA, 0x00AAFF, 0xFFAA00];
    var platData = [
      { x: 300, y: 700, w: 80 }, { x: 520, y: 600, w: 70 }, { x: 750, y: 500, w: 60 },
      { x: 1000, y: 650, w: 90 }, { x: 1250, y: 550, w: 70 }, { x: 1500, y: 450, w: 65 },
      { x: 1800, y: 600, w: 85 }, { x: 2100, y: 500, w: 75 }, { x: 2400, y: 650, w: 80 },
      { x: 2700, y: 550, w: 70 }, { x: 3000, y: 700, w: 90 },
    ];
    for (var p = 0; p < platData.length; p++) {
      var pd = platData[p];
      var neonPlat = drawNeonPlatform(pd.w, 12, platColors[p % platColors.length]);
      neonPlat.x = pd.x; neonPlat.y = pd.y; world.addChild(neonPlat);
      createOneWayPlatform(physics, pd.x, pd.y, pd.w, 12);
    }

    // === PLAYER ===
    await _loadSpriteLib("dark");
    var playerGfx = drawPlayerCharacter(44, 0x00FFAA, 0x44FFCC);
    playerGfx.x = 100; playerGfx.y = GROUND_Y - 44; world.addChild(playerGfx);
    var playerBody = createBody(physics, 100, GROUND_Y - 44, 32, 44, { tag: "player" });
    playerBody.sprite = playerGfx;
    var controller = new CharacterController(playerBody, { moveSpeed: 340, jumpForce: 580, gravity: 1100 });

    // === ENEMIES — chasers and ranged ===
    var enemies: Array<{ gfx: PIXI.DisplayObject, body: any, type: string, shootTimer: number }> = [];
    // Chasers
    for (var e = 0; e < 6; e++) {
      var ex = 500 + e * 450;
      var chaser = drawChaserEnemy(20);
      chaser.x = ex; chaser.y = GROUND_Y - 24; world.addChild(chaser);
      var ebody = createBody(physics, ex, GROUND_Y - 24, 24, 24, { tag: "enemy" });
      ebody.sprite = chaser;
      enemies.push({ gfx: chaser, body: ebody, type: "chaser", shootTimer: 0 });
    }
    // Ranged — on platforms
    for (var r = 0; r < 3; r++) {
      var rp = platData[r * 3 + 1];
      var ranged = drawRangedEnemy(18);
      ranged.x = rp.x; ranged.y = rp.y - 22; world.addChild(ranged);
      var rbody = createBody(physics, rp.x, rp.y - 22, 22, 22, { tag: "enemy" });
      rbody.sprite = ranged;
      enemies.push({ gfx: ranged, body: rbody, type: "ranged", shootTimer: 2 });
    }

    // === LASERS ===
    var lasers: Array<{ gfx: PIXI.Graphics, vx: number, vy: number }> = [];

    // === COMBO SYSTEM ===
    var combo = 0, comboTimer = 0, score = 0, lives = 3;
    var comboTxt = new PIXI.Text({ text: "", style: { fill: 0xFF00AA, fontSize: 28, fontWeight: "bold" } });
    comboTxt.x = app.screen.width / 2; comboTxt.y = 60; comboTxt.anchor.set(0.5);
    app.stage.addChild(comboTxt);

    var scoreTxt = new PIXI.Text({ text: "0", style: { fill: 0x00FFAA, fontSize: 24, stroke: { color: 0x003322, width: 2 } } });
    scoreTxt.x = 16; scoreTxt.y = 16; app.stage.addChild(scoreTxt);

    // Vignette
    var vig = drawVignette(app.screen.width, app.screen.height, 0.6);
    app.stage.addChild(vig);

    engine.camera.follow(playerBody);
    engine.camera.worldWidth = W; engine.camera.worldHeight = H;

    this._update = (dt: number) => {
      controller.update(engine.input, dt);
      physics.update(dt);

      // Chasers pursue player
      for (var en of enemies) {
        if (en.type === "chaser") {
          var dx = playerBody.x - en.body.x;
          var chaseSpeed = 120;
          if (Math.abs(dx) < 400) en.body.vx += (dx > 0 ? chaseSpeed : -chaseSpeed) * dt;
        }
        if (en.type === "ranged") {
          en.shootTimer -= dt;
          if (en.shootTimer <= 0) {
            en.shootTimer = 2.5;
            var dir = playerBody.x > en.body.x ? 1 : -1;
            var laser = createLaser(en.body.x, en.body.y, dir * 300, 0x8844FF);
            world.addChild(laser.gfx); lasers.push(laser);
          }
        }
      }

      // Update lasers
      for (var l = lasers.length - 1; l >= 0; l--) {
        lasers[l].gfx.x += lasers[l].vx * dt;
        if (lasers[l].gfx.x < -50 || lasers[l].gfx.x > W + 50) {
          world.removeChild(lasers[l].gfx); lasers.splice(l, 1);
        }
      }

      // Combo timer
      comboTimer -= dt;
      if (comboTimer <= 0) { combo = 0; comboTxt.text = ""; }
      else { comboTxt.text = "COMBO x" + combo; }

      // Collision
      physics.onSensorOverlap((a, b) => {
        if ((a.tag === "player" && b.tag === "enemy") || (a.tag === "enemy" && b.tag === "player")) {
          // Jump kill check
          if (playerBody.vy > 0 && playerBody.y < (a.tag === "enemy" ? a : b).y - 10) {
            combo++; comboTimer = 3;
            score += 50 * combo;
            scoreTxt.text = String(score);
            engine.juice.pop(scoreTxt, 1.4, 0.2);
            engine.juice.hitPause(app, 80);
            engine.juice.shake(world, 8, 0.2);
          } else {
            lives--; combo = 0;
          }
        }
      });

      engine.camera.update(dt);
      engine.input.endFrame();
    };
  }
  private _update: ((dt: number) => void) | null = null;
  update(engine: Engine2D, dt: number) { this._update?.(dt); }
  exit(engine: Engine2D) { engine.juice.killAll(); engine.features.destroy(); }
}
`;

// ============================================================================
// REFERENCE GAME 3: "Ice Gauntlet" — speed-focused, cold, vertical ascent
// ============================================================================
const REF_ICE_GAUNTLET = `
// --- REFERENCE: Ice Gauntlet ---
// STYLE: Snow-cold atmosphere, ice blue palette, blizzard particles
// FOCUS: Speed-focused — time pressure, slippery ice physics
// LAYOUT: Vertical-challenge with ascending stacked platforms
// CUSTOM: Falling icicles, ice platforms with reduced friction, timer system
// This is INSPIRATION — do NOT copy this code directly

import { Engine2D, GameScene, createGame2D, loadAssets } from "../engine/core";
import { PhysicsWorld, createBody, createStaticBody, createOneWayPlatform, CharacterController } from "../engine/physics";
import { createSnowEffect, onJumpDust, onLandImpact, onCollectSparkle } from "../engine/effects";
import { PALETTES, drawSkyGradient, drawMountainRange, drawPlatformBlock, drawPlayerCharacter, drawCoinToken, drawHeart, drawVignette, drawAtmosphericFog } from "../config/assets";
import { _loadSpriteLib } from "../utils/media-stock";

// --- Custom: Ice platform with shimmer effect ---
function drawIcePlatform(w: number, h: number): PIXI.Container {
  var c = new PIXI.Container();
  var g = new PIXI.Graphics();
  g.roundRect(0, 0, w, h, 3).fill({ color: 0x88CCEE, alpha: 0.7 });
  // Ice shine streak
  g.rect(4, 2, w * 0.3, 2).fill({ color: 0xCCEEFF, alpha: 0.6 });
  g.rect(w * 0.5, 2, w * 0.2, 2).fill({ color: 0xCCEEFF, alpha: 0.4 });
  g.pivot.set(w / 2, h);
  c.addChild(g);
  return c;
}

// --- Custom: Falling icicle hazard ---
function drawIcicle(length: number): PIXI.Graphics {
  var g = new PIXI.Graphics();
  g.moveTo(-6, 0).lineTo(6, 0).lineTo(0, length).closePath();
  g.fill({ color: 0xAADDFF, alpha: 0.8 });
  g.stroke({ color: 0xCCEEFF, width: 1 });
  return g;
}

export default class GameScene2D implements GameScene {
  name = 'game';
  container = new PIXI.Container();
  enter(engine: Engine2D) {
    var PAL = PALETTES["arctic"];
    var W = 2500, H = 2000, GROUND_Y = H - 50; // Tall vertical world
    var app = engine.app, world = this.container;
    var physics = new PhysicsWorld(0, 900);

    // === ICY BACKGROUND ===
    var sky = drawSkyGradient(W, H, 0x1a2a4a, 0x4a6a8a);
    world.addChildAt(sky, 0);

    // Distant ice mountains
    drawMountainRange(W, H - 200, 0x3355770, 0.4, 100, 300, 250);

    // Snow fog
    var fog = drawAtmosphericFog(W, H, 0xAABBCC, 0.2);
    world.addChild(fog);

    // Ground
    var groundGfx = new PIXI.Graphics();
    groundGfx.rect(0, GROUND_Y, W, 50).fill({ color: 0xDDEEFF });
    world.addChild(groundGfx);
    createStaticBody(physics, 0, GROUND_Y, W, 50);

    // === ASCENDING PLATFORMS — vertical gauntlet ===
    var platSpecs: Array<{x: number, y: number, w: number, ice: boolean}> = [];
    var curY = GROUND_Y - 100;
    for (var p = 0; p < 22; p++) {
      var px = 200 + Math.sin(p * 0.7) * 400 + W / 2 - 400;
      curY -= 70 + Math.random() * 30;
      var isIce = Math.random() < 0.4;
      var pw = isIce ? 70 : 100;
      platSpecs.push({ x: px, y: curY, w: pw, ice: isIce });
      var platGfx = isIce
        ? drawIcePlatform(pw, 16)
        : drawPlatformBlock(pw, 20, PAL.platform, PAL.platformTop);
      platGfx.x = px; platGfx.y = curY; world.addChild(platGfx);
      createOneWayPlatform(physics, px, curY, pw, 16);
    }

    // === FALLING ICICLES — triggered hazards ===
    var icicles: Array<{ gfx: PIXI.Graphics, x: number, triggerY: number, falling: boolean, vy: number }> = [];
    for (var ic = 0; ic < 8; ic++) {
      var spec = platSpecs[ic * 2 + 2];
      if (!spec) continue;
      var icicle = drawIcicle(30);
      icicle.x = spec.x + Math.random() * spec.w; icicle.y = spec.y - 200;
      world.addChild(icicle);
      icicles.push({ gfx: icicle, x: icicle.x, triggerY: spec.y - 50, falling: false, vy: 0 });
    }

    // === PLAYER ===
    await _loadSpriteLib("arctic");
    var playerGfx = drawPlayerCharacter(44, PAL.player, PAL.playerLight);
    playerGfx.x = W / 2; playerGfx.y = GROUND_Y - 44; world.addChild(playerGfx);
    var playerBody = createBody(physics, W / 2, GROUND_Y - 44, 32, 44, { tag: "player" });
    playerBody.sprite = playerGfx;
    var controller = new CharacterController(playerBody, { moveSpeed: 300, jumpForce: 560, gravity: 900 });

    // === COINS on platforms ===
    for (var c = 0; c < 18; c++) {
      var cp = platSpecs[c % platSpecs.length];
      var coin = drawCoinToken(9, PAL.coin, PAL.coinGlow);
      coin.x = cp.x + cp.w / 2; coin.y = cp.y - 30; world.addChild(coin);
      engine.juice.float(coin, 4, 1.5);
      createBody(physics, coin.x, coin.y, 18, 18, { tag: "coin", sensor: true });
    }

    // === TIMER SYSTEM — time pressure ===
    var timeLeft = 90, score = 0, lives = 2;
    var timerTxt = new PIXI.Text({ text: "90", style: { fill: 0xFF4444, fontSize: 30, fontWeight: "bold", stroke: { color: 0x000000, width: 3 } } });
    timerTxt.anchor.set(0.5, 0); timerTxt.x = app.screen.width / 2; timerTxt.y = 12;
    app.stage.addChild(timerTxt);

    var scoreTxt = new PIXI.Text({ text: "0", style: { fill: 0xCCEEFF, fontSize: 22, stroke: { color: 0x112233, width: 2 } } });
    scoreTxt.x = 16; scoreTxt.y = 16; app.stage.addChild(scoreTxt);

    // === SNOW WEATHER ===
    createSnowEffect(engine, world, W, H);

    // Vignette
    var vig = drawVignette(app.screen.width, app.screen.height, 0.5);
    app.stage.addChild(vig);

    engine.camera.follow(playerBody);
    engine.camera.worldWidth = W; engine.camera.worldHeight = H; engine.camera.smoothing = 0.06;

    this._update = (dt: number) => {
      // Ice friction: if on ice platform, reduce movement damping
      controller.update(engine.input, dt);
      physics.update(dt);

      // Timer countdown
      timeLeft -= dt;
      timerTxt.text = Math.ceil(Math.max(0, timeLeft)).toString();
      if (timeLeft < 10) timerTxt.style.fill = 0xFF0000;

      // Icicle triggers
      for (var ic of icicles) {
        if (!ic.falling && playerBody.y < ic.triggerY && Math.abs(playerBody.x - ic.x) < 80) {
          ic.falling = true; ic.vy = 0;
        }
        if (ic.falling) {
          ic.vy += 600 * dt;
          ic.gfx.y += ic.vy * dt;
        }
      }

      physics.onSensorOverlap((a, b) => {
        if (a.tag === "coin" || b.tag === "coin") {
          score += 15; scoreTxt.text = String(score);
          engine.juice.pop(scoreTxt, 1.2, 0.15);
          onCollectSparkle(engine, a.sprite || b.sprite);
          timeLeft += 3; // Bonus time
        }
      });

      engine.camera.update(dt);
      engine.input.endFrame();
    };
  }
  private _update: ((dt: number) => void) | null = null;
  update(engine: Engine2D, dt: number) { this._update?.(dt); }
  exit(engine: Engine2D) { engine.juice.killAll(); engine.features.destroy(); }
}
`;

// ============================================================================
// REFERENCE GAME 4: "Candy Puzzle Climb" — exploration-focused, soft, branching
// ============================================================================
const REF_CANDY_CLIMB = `
// --- REFERENCE: Candy Puzzle Climb ---
// STYLE: Painterly-soft with blur effects, candy colors
// FOCUS: Exploration-focused — hidden areas, keys unlock gates
// LAYOUT: Multi-path with branching routes, secrets
// CUSTOM: Key/gate system, hidden walls, candy-themed collectibles
// This is INSPIRATION — do NOT copy this code directly

import { Engine2D, GameScene, createGame2D, loadAssets } from "../engine/core";
import { PhysicsWorld, createBody, createStaticBody, createOneWayPlatform, CharacterController } from "../engine/physics";
import { createAmbientEffect, onCollectSparkle } from "../engine/effects";
import { PALETTES, drawSkyGradient, drawMountainRange, drawCloud, drawGroundStrip, drawPlatformBlock, drawPlayerCharacter, drawCoinToken, drawHeart, drawVignette } from "../config/assets";
import { _loadSpriteLib } from "../utils/media-stock";

// --- Custom: Key collectible ---
function drawKey(size: number, color: number): PIXI.Graphics {
  var g = new PIXI.Graphics();
  var c = ((color >> 16) & 0xFF).toString(16).padStart(2, "0") + ((color >> 8) & 0xFF).toString(16).padStart(2, "0") + (color & 0xFF).toString(16).padStart(2, "0");
  g.circle(0, -size * 0.5, size * 0.35).stroke({ color: color, width: 3 });
  g.rect(-1.5, -size * 0.15, 3, size * 0.6).fill({ color: color });
  g.rect(-1.5, size * 0.3, size * 0.3, 3).fill({ color: color });
  g.rect(-1.5, size * 0.15, size * 0.2, 3).fill({ color: color });
  return g;
}

// --- Custom: Gate that blocks passage ---
function drawGate(w: number, h: number, color: number): PIXI.Graphics {
  var g = new PIXI.Graphics();
  for (var bar = 0; bar < 5; bar++) {
    var bx = (bar / 4) * w;
    g.rect(bx - 2, 0, 4, h).fill({ color: color, alpha: 0.8 });
  }
  g.rect(0, 0, w, 4).fill({ color: color });
  g.rect(0, h - 4, w, 4).fill({ color: color });
  g.pivot.set(w / 2, h);
  return g;
}

// --- Custom: Hidden wall that disappears when touched ---
function drawHiddenWall(w: number, h: number): PIXI.Graphics {
  var g = new PIXI.Graphics();
  g.rect(0, 0, w, h).fill({ color: 0x887766, alpha: 0.85 });
  // Crack hints
  g.moveTo(w * 0.3, 0).lineTo(w * 0.35, h * 0.4).lineTo(w * 0.5, h).stroke({ color: 0x665544, width: 1 });
  g.pivot.set(w / 2, h);
  return g;
}

// --- Custom: Candy collectible (lollipop) ---
function drawLollipop(size: number, color: number): PIXI.Container {
  var c = new PIXI.Container();
  var g = new PIXI.Graphics();
  g.rect(-1.5, 0, 3, size * 0.6).fill({ color: 0xEEDDCC });
  g.circle(0, -size * 0.15, size * 0.4).fill({ color: color });
  // Swirl
  g.arc(0, -size * 0.15, size * 0.25, 0, Math.PI).stroke({ color: 0xFFFFFF, width: 2, alpha: 0.5 });
  c.addChild(g); return c;
}

export default class GameScene2D implements GameScene {
  name = 'game';
  container = new PIXI.Container();
  enter(engine: Engine2D) {
    var PAL = PALETTES["candy"];
    var W = 4500, H = 1200, GROUND_Y = H - 60;
    var app = engine.app, world = this.container;
    var physics = new PhysicsWorld(0, 850);

    // === SOFT PAINTERLY BACKGROUND ===
    var sky = drawSkyGradient(W, H, 0xFFBBCC, 0xFFDDEE);
    world.addChildAt(sky, 0);

    // Soft mountains with blur
    for (var i = 0; i < 3; i++) {
      var mt = drawMountainRange(W, GROUND_Y - 60 + i * 25, PAL.mountains[i], 0.4 - i * 0.1, 50, 140, 180);
      try { mt.filters = [new PIXI.BlurFilter({ strength: 2 + i })]; } catch(e) {}
      world.addChild(mt);
    }

    // Puffy clouds
    for (var cl = 0; cl < 8; cl++) {
      var cloud = drawCloud(60 + Math.random() * 40, 30);
      cloud.x = Math.random() * W; cloud.y = 50 + Math.random() * 200;
      cloud.alpha = 0.6;
      try { cloud.filters = [new PIXI.BlurFilter({ strength: 1.5 })]; } catch(e) {}
      world.addChild(cloud);
    }

    // Ground
    var ground = drawGroundStrip(W, GROUND_Y, 60, PAL.ground, PAL.groundTop);
    world.addChild(ground);
    createStaticBody(physics, 0, GROUND_Y, W, 60);

    // === BRANCHING PLATFORMS — upper route has secrets ===
    // Main path (lower)
    var mainPath = [
      { x: 350, y: GROUND_Y - 100, w: 130 }, { x: 650, y: GROUND_Y - 150, w: 120 },
      { x: 950, y: GROUND_Y - 100, w: 140 }, { x: 1300, y: GROUND_Y - 160, w: 110 },
      { x: 1650, y: GROUND_Y - 120, w: 130 }, { x: 2000, y: GROUND_Y - 100, w: 150 },
      { x: 2400, y: GROUND_Y - 140, w: 120 }, { x: 2800, y: GROUND_Y - 100, w: 130 },
      { x: 3200, y: GROUND_Y - 160, w: 110 }, { x: 3600, y: GROUND_Y - 120, w: 140 },
    ];
    // Secret upper path
    var upperPath = [
      { x: 800, y: GROUND_Y - 320, w: 100 }, { x: 1100, y: GROUND_Y - 380, w: 90 },
      { x: 1400, y: GROUND_Y - 340, w: 100 }, { x: 1700, y: GROUND_Y - 400, w: 90 },
      { x: 2200, y: GROUND_Y - 360, w: 100 }, { x: 2600, y: GROUND_Y - 320, w: 110 },
    ];

    var allPlats = [...mainPath, ...upperPath];
    for (var pp of allPlats) {
      var platGfx = drawPlatformBlock(pp.w, 24, PAL.platform, PAL.platformTop);
      platGfx.x = pp.x; platGfx.y = pp.y; world.addChild(platGfx);
      createOneWayPlatform(physics, pp.x, pp.y, pp.w, 24);
    }

    // === KEY / GATE SYSTEM ===
    var keyColors = [0xFF4488, 0x44AAFF, 0xAAFF44];
    var gates: Array<{ gfx: PIXI.Graphics, body: any, colorIdx: number, open: boolean }> = [];
    var keysCollected = [false, false, false];

    // Keys placed in tricky spots
    var keyPositions = [
      { x: 950, y: GROUND_Y - 130 },  // Red key — main path
      { x: 1700, y: GROUND_Y - 430 }, // Blue key — upper path
      { x: 3000, y: GROUND_Y - 130 }, // Green key — late game
    ];
    for (var k = 0; k < 3; k++) {
      var keyGfx = drawKey(22, keyColors[k]);
      keyGfx.x = keyPositions[k].x; keyGfx.y = keyPositions[k].y;
      world.addChild(keyGfx);
      engine.juice.float(keyGfx, 5, 1.8);
      createBody(physics, keyGfx.x, keyGfx.y, 20, 28, { tag: "key-" + k, sensor: true });
    }

    // Gates blocking passages
    var gateSpecs = [
      { x: 1500, y: GROUND_Y, colorIdx: 0, w: 50, h: 120 },  // Red gate
      { x: 2500, y: GROUND_Y, colorIdx: 1, w: 50, h: 120 },  // Blue gate
      { x: 3800, y: GROUND_Y, colorIdx: 2, w: 50, h: 120 },  // Green gate (before exit)
    ];
    for (var gs of gateSpecs) {
      var gateGfx = drawGate(gs.w, gs.h, keyColors[gs.colorIdx]);
      gateGfx.x = gs.x; gateGfx.y = gs.y; world.addChild(gateGfx);
      var gateBody = createStaticBody(physics, gs.x, gs.y - gs.h, gs.w, gs.h);
      gates.push({ gfx: gateGfx, body: gateBody, colorIdx: gs.colorIdx, open: false });
    }

    // === HIDDEN WALL (reveals secret area) ===
    var hiddenWall = drawHiddenWall(80, 200);
    hiddenWall.x = 2100; hiddenWall.y = GROUND_Y; world.addChild(hiddenWall);
    var hiddenWallBody = createStaticBody(physics, 2100 - 40, GROUND_Y - 200, 80, 200);
    var wallRevealed = false;

    // === LOLLIPOP COLLECTIBLES ===
    var score = 0, lives = 3;
    for (var lp = 0; lp < 20; lp++) {
      var plat = allPlats[lp % allPlats.length];
      var lollipop = drawLollipop(18, keyColors[lp % 3]);
      lollipop.x = plat.x + plat.w / 2; lollipop.y = plat.y - 35;
      world.addChild(lollipop);
      engine.juice.float(lollipop, 3, 1.5 + Math.random());
      createBody(physics, lollipop.x, lollipop.y, 16, 22, { tag: "candy", sensor: true });
    }

    // === PLAYER ===
    await _loadSpriteLib("candy");
    var playerGfx = drawPlayerCharacter(46, PAL.player, PAL.playerLight);
    playerGfx.x = 100; playerGfx.y = GROUND_Y - 46; world.addChild(playerGfx);
    var playerBody = createBody(physics, 100, GROUND_Y - 46, 34, 46, { tag: "player" });
    playerBody.sprite = playerGfx;
    var controller = new CharacterController(playerBody, {
      moveSpeed: 240, jumpForce: 500, gravity: 850,
      doubleJump: true, wallSlide: true, // Both enabled for exploration
    });

    // === PARTICLES ===
    createAmbientEffect(engine, world, "pollen", W, H);

    // === UI ===
    var scoreTxt = new PIXI.Text({ text: "0", style: { fill: 0xFF88AA, fontSize: 24, fontWeight: "bold", stroke: { color: 0xFFFFFF, width: 2 } } });
    scoreTxt.x = 16; scoreTxt.y = 16; app.stage.addChild(scoreTxt);

    // Key indicators
    var keyIndicators: PIXI.Graphics[] = [];
    for (var ki = 0; ki < 3; ki++) {
      var ind = drawKey(16, keyColors[ki]);
      ind.x = app.screen.width - 80 + ki * 28; ind.y = 24; ind.alpha = 0.3;
      app.stage.addChild(ind); keyIndicators.push(ind);
    }

    var vig = drawVignette(app.screen.width, app.screen.height, 0.3);
    app.stage.addChild(vig);

    engine.camera.follow(playerBody);
    engine.camera.worldWidth = W; engine.camera.worldHeight = H; engine.camera.smoothing = 0.07;

    this._update = (dt: number) => {
      controller.update(engine.input, dt);
      physics.update(dt);

      // Hidden wall reveal
      if (!wallRevealed && Math.abs(playerBody.x - 2100) < 50 && playerBody.y < GROUND_Y - 10) {
        wallRevealed = true;
        hiddenWall.alpha = 0; // gsap can animate this
        physics.removeBody(hiddenWallBody);
      }

      physics.onSensorOverlap((a, b) => {
        var tag = a.tag?.startsWith("key-") ? a.tag : b.tag?.startsWith("key-") ? b.tag : null;
        if (tag) {
          var idx = parseInt(tag.split("-")[1]);
          keysCollected[idx] = true;
          keyIndicators[idx].alpha = 1;
          engine.juice.pop(keyIndicators[idx], 1.5, 0.2);
          onCollectSparkle(engine, a.sprite || b.sprite);
          // Open matching gate
          for (var gate of gates) {
            if (gate.colorIdx === idx && !gate.open) {
              gate.open = true; gate.gfx.alpha = 0;
              physics.removeBody(gate.body);
            }
          }
        }
        if (a.tag === "candy" || b.tag === "candy") {
          score += 25; scoreTxt.text = String(score);
          engine.juice.pop(scoreTxt, 1.2, 0.15);
          onCollectSparkle(engine, a.sprite || b.sprite);
        }
      });

      engine.camera.update(dt);
      engine.input.endFrame();
    };
  }
  private _update: ((dt: number) => void) | null = null;
  update(engine: Engine2D, dt: number) { this._update?.(dt); }
  exit(engine: Engine2D) { engine.juice.killAll(); engine.features.destroy(); }
}
`;

// ============================================================================
// Combined export for system prompt injection
// ============================================================================

export const GAME_2D_REFERENCE_GAMES = `
## Reference Games — Creative Approaches (INSPIRATION ONLY)

Below are 4 reference games showing DIFFERENT creative approaches to building 2D games.
Study them to understand how to use the engine APIs creatively, then create something ORIGINAL.
DO NOT copy these games — use them to learn patterns and techniques.

### Reference 1: "Forest Explorer" (collect-focused, warm atmosphere, wide exploration)
- Custom: drawTreasureChest(), drawGlowMushroom() drawn with Canvas 2D / PIXI.Graphics
- Layout: Wide platforms with upper/lower paths for exploration
- Atmosphere: Fireflies, golden lighting, warm colors
- Gameplay: Lots of coins in trails, treasure chests on harder-to-reach upper route

\`\`\`typescript
${REF_FOREST_EXPLORER}
\`\`\`

### Reference 2: "Neon Combat Arena" (combat-focused, neon glow, tight platforms)
- Custom: drawNeonPlatform(), drawChaserEnemy(), drawRangedEnemy(), createLaser()
- Layout: Small precise platforms, neon grid background
- Atmosphere: Dark with neon glow effects, additive blending
- Gameplay: Combo kill system, chaser enemies + ranged enemies with lasers

\`\`\`typescript
${REF_NEON_ARENA}
\`\`\`

### Reference 3: "Ice Gauntlet" (speed-focused, cold atmosphere, vertical ascent)
- Custom: drawIcePlatform(), drawIcicle() with triggered falling
- Layout: Vertical ascending platforms, ice platforms with reduced friction
- Atmosphere: Snow particles, blizzard, ice blue palette
- Gameplay: Countdown timer, coins give bonus time, icicle hazards

\`\`\`typescript
${REF_ICE_GAUNTLET}
\`\`\`

### Reference 4: "Candy Puzzle Climb" (exploration-focused, soft/painterly, branching paths)
- Custom: drawKey(), drawGate(), drawHiddenWall(), drawLollipop()
- Layout: Branching main/upper paths, hidden areas behind cracked walls
- Atmosphere: Pollen particles, blur on mountains, soft candy colors
- Gameplay: Colored keys unlock matching gates, hidden walls reveal secrets, double-jump + wall-slide

\`\`\`typescript
${REF_CANDY_CLIMB}
\`\`\`

### Key Takeaways for YOUR game:
1. **Draw custom entities** — every game has unique drawXXX() functions using PIXI.Graphics or Canvas 2D
2. **Different layouts** — wide exploration vs tight precision vs vertical vs branching
3. **Different gameplay loops** — collecting vs combat vs speed vs puzzle exploration
4. **Different atmospheres** — warm fireflies vs neon glow vs cold blizzard vs soft painterly
5. **Custom mechanics** — treasure chests, combo system, falling icicles, key/gate puzzles
6. **Use engine juice** — shake, pop, float, breathe, hitPause for game feel
`;
