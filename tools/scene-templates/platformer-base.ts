// Auto-composed base scene template: platformer
// Placeholder tokens are replaced at generation time by scene-generator.ts
import { Engine2D, GameScene, createGame2D, loadAssets, JuiceSystem } from "../engine/core";
import { createBody, createStaticBody, createOneWayPlatform, PhysicsWorld, CharacterController } from "../engine/physics";
import { createAmbientEffect, createSnowEffect, createRainEffect, getThemeEffects, onJumpDust, onLandImpact, onCollectSparkle, onDeathExplosion } from "../engine/effects";
import { PALETTES, lerpColor, setNoiseSeed, drawSkyGradient, drawStars, drawMountainRange, drawCloud, drawTree, drawGroundStrip, drawPlatformBlock, drawPlayerCharacter, drawCoinToken, drawEnemySlime, drawHeart, drawVignette, drawAtmosphericFog, drawLSystemTree, TREE_PRESETS, drawPointLight, createLightingLayer, createWaterSurface, createLavaSurface } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;

// ======================== SEEDED PRNG (Mulberry32) ========================
var _seed = __SEED__;
function _rng() { _seed |= 0; _seed = _seed + 0x6D2B79F5 | 0; var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function _rngRange(min: number, max: number) { return min + _rng() * (max - min); }
function _rngInt(min: number, max: number) { return Math.floor(_rngRange(min, max + 1)); }
function _rngPick<T>(arr: T[]): T { return arr[_rngInt(0, arr.length - 1)]; }

// ======================== CONFIGURATION ========================
var THEME = '__THEME__';
var PAL = PALETTES[THEME] || PALETTES.forest;

var CONFIG = {
  gravity: __GRAVITY__,
  worldWidth: __WORLD_WIDTH__,
  worldHeight: 900,
  groundY: 680,
  playerSize: 48,
  playerStartX: 250,
  moveSpeed: __MOVE_SPEED__,
  jumpForce: __JUMP_FORCE__,
  coinRadius: 10,
  enemySize: 44,
  enemySpeed: __ENEMY_SPEED__,
  lives: __LIVES__,
  platformCount: __PLATFORM_COUNT__,
  enemyCount: __ENEMY_COUNT__,
  coinCount: __COIN_COUNT__,
  levelShape: '__LEVEL_SHAPE__' as 'flat-wide' | 'staircase-ascending' | 'valley-bowl' | 'hilly-undulating',
  doubleJump: __DOUBLE_JUMP__,
  wallSlide: __WALL_SLIDE__,
};

// ======================== LEVEL GENERATORS ========================
function _generatePlatformY(index: number, total: number): number {
  var t = index / Math.max(total - 1, 1);
  var minY = CONFIG.groundY - 360;
  var maxY = CONFIG.groundY - 80;
  switch (CONFIG.levelShape) {
    case 'staircase-ascending':
      return maxY - t * (maxY - minY) + _rngRange(-20, 20);
    case 'valley-bowl':
      var bowl = Math.abs(t - 0.5) * 2;
      return minY + bowl * (maxY - minY) * 0.6 + _rngRange(-15, 15);
    case 'hilly-undulating':
      return minY + (maxY - minY) * (0.5 + 0.4 * Math.sin(t * Math.PI * 3)) + _rngRange(-20, 20);
    default:
      return _rngRange(minY, maxY);
  }
}

function _generatePlatforms() {
  var plats = [];
  var spacing = (CONFIG.worldWidth - 600) / CONFIG.platformCount;
  for (var i = 0; i < CONFIG.platformCount; i++) {
    plats.push({
      x: 350 + i * spacing + _rngRange(-spacing * 0.2, spacing * 0.2),
      y: _generatePlatformY(i, CONFIG.platformCount),
      w: _rngInt(120, 200),
    });
  }
  return plats;
}

function _generateCoins(platforms: { x: number; y: number; w: number }[]) {
  var coins: { x: number; y: number }[] = [];
  var onPlatCount = Math.floor(CONFIG.coinCount * 0.6);
  var groundCount = CONFIG.coinCount - onPlatCount;
  for (var i = 0; i < onPlatCount; i++) {
    var p = platforms[_rngInt(0, platforms.length - 1)];
    coins.push({ x: p.x + _rngRange(-p.w * 0.3, p.w * 0.3), y: p.y - _rngRange(25, 45) });
  }
  for (var j = 0; j < groundCount; j++) {
    coins.push({ x: _rngRange(300, CONFIG.worldWidth - 200), y: CONFIG.groundY - 40 });
  }
  return coins;
}

function _generateEnemies() {
  var enemies: { x: number; range: number }[] = [];
  var spacing = (CONFIG.worldWidth - 400) / CONFIG.enemyCount;
  for (var i = 0; i < CONFIG.enemyCount; i++) {
    enemies.push({
      x: 500 + i * spacing + _rngRange(-spacing * 0.2, spacing * 0.2),
      range: _rngInt(80, 180),
    });
  }
  return enemies;
}

function _generateDecorations() {
  var count = _rngInt(10, 18);
  var decs: { x: number; type: number; size: number; flip: boolean }[] = [];
  var spacing = CONFIG.worldWidth / count;
  for (var i = 0; i < count; i++) {
    decs.push({
      x: i * spacing + _rngRange(20, spacing - 20),
      type: _rngInt(0, 3),
      size: _rngRange(1.8, 3.2),
      flip: _rng() > 0.5,
    });
  }
  return decs;
}

// ======================== THEME-SPECIFIC DRAWING ========================
function _drawDecoration(type: number, size: number): any {
  var g = new PIXI.Graphics();
  var s = size;
  switch (THEME) {
    case 'volcanic':
      if (type === 0) { g.beginFill(0xff3300, 0.8); g.drawEllipse(0, 0, 30 * s, 8 * s); g.endFill(); g.beginFill(0xff6600, 0.6); g.drawEllipse(0, -2, 20 * s, 5 * s); g.endFill(); g.beginFill(0xffaa00, 0.4); g.drawEllipse(0, -3, 10 * s, 3 * s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x3a2a1a); g.moveTo(-8*s, 0); g.lineTo(8*s, 0); g.lineTo(4*s, -20*s); g.lineTo(-4*s, -20*s); g.endFill(); g.beginFill(0x554433); g.drawCircle(0, -20*s, 6*s); g.endFill(); g.beginFill(0xff4400, 0.5); g.drawCircle(0, -20*s, 3*s); g.endFill(); }
      else if (type === 2) { g.beginFill(0x1a1a2a); g.moveTo(0, -35*s); g.lineTo(8*s, 0); g.lineTo(-8*s, 0); g.endFill(); g.beginFill(0x2a2a4a); g.moveTo(6*s, -25*s); g.lineTo(12*s, 0); g.lineTo(2*s, 0); g.endFill(); g.beginFill(0xff4400, 0.3); g.moveTo(0, -30*s); g.lineTo(3*s, -10*s); g.lineTo(-3*s, -10*s); g.endFill(); }
      else { g.beginFill(0x4a3a2a); g.drawRoundedRect(-15*s, -12*s, 30*s, 12*s, 4); g.endFill(); g.beginFill(0x5a4a3a); g.drawRoundedRect(-10*s, -18*s, 20*s, 8*s, 3); g.endFill(); g.lineStyle(1, 0xff4400, 0.6); g.moveTo(-5*s, -2*s); g.lineTo(0, -10*s); g.lineTo(5*s, -4*s); }
      break;
    case 'arctic':
      if (type === 0) { g.beginFill(0x99ddff, 0.8); g.moveTo(0, -40*s); g.lineTo(6*s, -10*s); g.lineTo(0, 0); g.lineTo(-6*s, -10*s); g.endFill(); g.beginFill(0xbbeeFF, 0.5); g.moveTo(0, -35*s); g.lineTo(3*s, -12*s); g.lineTo(-3*s, -12*s); g.endFill(); g.beginFill(0xccffff, 0.6); g.moveTo(10*s, -25*s); g.lineTo(14*s, -10*s); g.lineTo(8*s, -10*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0xddeeff, 0.9); g.drawEllipse(0, 0, 25*s, 10*s); g.endFill(); g.beginFill(0xeef4ff, 0.7); g.drawEllipse(5*s, -3*s, 15*s, 6*s); g.endFill(); }
      else if (type === 2) { g.beginFill(0x88bbdd); g.drawRoundedRect(-6*s, -45*s, 12*s, 45*s, 3); g.endFill(); g.beginFill(0xaaddee, 0.6); g.drawRoundedRect(-3*s, -42*s, 6*s, 38*s, 2); g.endFill(); g.beginFill(0x99ccee); g.drawCircle(0, -48*s, 8*s); g.endFill(); }
      else { for (var ic = 0; ic < 3; ic++) { var ix = (ic-1)*10*s; var ih = (20+ic*8)*s; g.beginFill(0xaaddff, 0.8); g.moveTo(ix-3*s, 0); g.lineTo(ix, -ih); g.lineTo(ix+3*s, 0); g.endFill(); } }
      break;
    case 'candy':
      if (type === 0) { g.beginFill(0x886644); g.drawRect(-2*s, -40*s, 4*s, 40*s); g.endFill(); g.beginFill(0xff6699); g.drawCircle(0, -48*s, 12*s); g.endFill(); g.beginFill(0xffaacc, 0.6); g.drawCircle(-3*s, -50*s, 5*s); g.endFill(); g.lineStyle(2, 0xffffff, 0.5); g.arc(0, -48*s, 8*s, 0, Math.PI); g.lineStyle(0); }
      else if (type === 1) { g.beginFill(0xff3344); g.drawRoundedRect(-4*s, -35*s, 8*s, 35*s, 3); g.endFill(); for (var st = 0; st < 5; st++) { g.beginFill(0xffffff, 0.8); g.drawRect(-4*s, -35*s+st*14*s, 8*s, 4*s); g.endFill(); } g.beginFill(0xff3344); g.drawCircle(6*s, -35*s, 5*s); g.endFill(); }
      else if (type === 2) { g.beginFill(0x44cc88); g.drawEllipse(0, -12*s, 10*s, 14*s); g.endFill(); g.beginFill(0x44cc88); g.drawCircle(-6*s, -26*s, 5*s); g.drawCircle(6*s, -26*s, 5*s); g.endFill(); g.beginFill(0xffffff); g.drawCircle(-3*s, -14*s, 2*s); g.drawCircle(3*s, -14*s, 2*s); g.endFill(); g.beginFill(0x111111); g.drawCircle(-3*s, -14*s, 1); g.drawCircle(3*s, -14*s, 1); g.endFill(); }
      else { var sprColors = [0xff6699, 0x66ccff, 0xffcc33, 0x66ff99, 0xff66ff]; for (var sp = 0; sp < 8; sp++) { g.beginFill(sprColors[sp % sprColors.length]); g.drawRoundedRect(_rngRange(-15,15)*s, _rngRange(-8,0)*s, 6*s, 2*s, 1); g.endFill(); } }
      break;
    case 'space':
      if (type === 0) { g.beginFill(0x555566); g.drawCircle(0, -15*s, 14*s); g.endFill(); g.beginFill(0x444455); g.drawCircle(-5*s, -18*s, 5*s); g.endFill(); g.beginFill(0x333344); g.drawCircle(6*s, -12*s, 4*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x44ff88, 0.8); g.moveTo(0,0); g.quadraticCurveTo(15*s,-20*s,5*s,-35*s); g.quadraticCurveTo(0,-25*s,0,0); g.endFill(); g.beginFill(0x88ffbb, 0.6); g.moveTo(0,0); g.quadraticCurveTo(-12*s,-18*s,-3*s,-30*s); g.quadraticCurveTo(0,-20*s,0,0); g.endFill(); g.beginFill(0xaaffdd); g.drawCircle(4*s,-34*s,3*s); g.drawCircle(-2*s,-29*s,2*s); g.endFill(); }
      else if (type === 2) { g.beginFill(0x333355); g.drawRect(-4*s, -40*s, 8*s, 40*s); g.endFill(); g.beginFill(0x6666ff, 0.7); g.drawCircle(0, -42*s, 6*s); g.endFill(); g.beginFill(0x9999ff, 0.4); g.drawCircle(0, -42*s, 10*s); g.endFill(); }
      else { g.beginFill(0x555577); g.drawRect(-2*s, -30*s, 4*s, 30*s); g.endFill(); g.beginFill(0x777799); g.drawEllipse(0, -32*s, 14*s, 6*s); g.endFill(); g.beginFill(0x4488ff, 0.5); g.drawCircle(0, -32*s, 3*s); g.endFill(); }
      break;
    case 'dark':
      if (type === 0) { g.beginFill(0x333344); g.drawRect(-2*s, -30*s, 4*s, 30*s); g.endFill(); g.beginFill(0xccccbb); g.drawCircle(0, -35*s, 8*s); g.endFill(); g.beginFill(0x1a1a2a); g.drawEllipse(-3*s, -36*s, 2.5*s, 3*s); g.drawEllipse(3*s, -36*s, 2.5*s, 3*s); g.endFill(); g.beginFill(0x1a1a2a); g.moveTo(-2*s, -31*s); g.lineTo(0, -29*s); g.lineTo(2*s, -31*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x333344); g.drawRect(-3*s, -15*s, 6*s, 15*s); g.endFill(); g.beginFill(0x6633aa); g.drawEllipse(0, -18*s, 14*s, 8*s); g.endFill(); g.beginFill(0xaa55ff, 0.4); g.drawEllipse(0, -18*s, 18*s, 10*s); g.endFill(); g.beginFill(0xddaaff, 0.5); g.drawCircle(-4*s, -20*s, 2*s); g.drawCircle(5*s, -17*s, 1.5*s); g.endFill(); }
      else if (type === 2) { g.beginFill(0x444455); g.drawRoundedRect(-10*s, -30*s, 20*s, 30*s, 5*s); g.endFill(); g.beginFill(0x333344); g.drawRect(-1*s, -22*s, 2*s, 10*s); g.drawRect(-5*s, -18*s, 10*s, 2*s); g.endFill(); }
      else { g.beginFill(0x444455); g.drawRect(-2*s, -25*s, 4*s, 25*s); g.endFill(); g.beginFill(0x555566); g.drawRect(-6*s, -30*s, 12*s, 8*s); g.endFill(); g.beginFill(0x00ff88, 0.4); g.drawCircle(0, -26*s, 4*s); g.endFill(); g.beginFill(0x00ff88, 0.15); g.drawCircle(0, -26*s, 10*s); g.endFill(); }
      break;
    case 'ocean':
      if (type === 0) { g.beginFill(0xff6688); g.moveTo(0,0); g.quadraticCurveTo(10*s,-20*s,5*s,-30*s); g.quadraticCurveTo(2*s,-20*s,0,0); g.endFill(); g.beginFill(0xff88aa); g.moveTo(0,0); g.quadraticCurveTo(-8*s,-18*s,-4*s,-25*s); g.quadraticCurveTo(-1*s,-15*s,0,0); g.endFill(); g.beginFill(0xffaacc); g.drawCircle(4*s,-29*s,3*s); g.drawCircle(-3*s,-24*s,2.5*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x228855, 0.8); for (var sw2 = 0; sw2 < 3; sw2++) { var sx = (sw2-1)*6*s; g.moveTo(sx,0); g.quadraticCurveTo(sx+8*s,-15*s,sx+2*s,-30*s-sw2*5*s); g.quadraticCurveTo(sx-2*s,-15*s,sx,0); } g.endFill(); }
      else if (type === 2) { g.beginFill(0xffcc88); g.drawEllipse(0, -5*s, 12*s, 8*s); g.endFill(); g.beginFill(0xffddaa); g.drawEllipse(0, -7*s, 8*s, 5*s); g.endFill(); g.lineStyle(1, 0xddaa77); for (var sl = 0; sl < 5; sl++) { g.moveTo(0, -5*s); g.lineTo((sl*5-10)*s, 3*s); } g.lineStyle(0); }
      else { g.beginFill(0x556677); g.drawRect(-2*s, -30*s, 4*s, 30*s); g.endFill(); g.beginFill(0x556677); g.drawRect(-12*s, -8*s, 24*s, 4*s); g.endFill(); g.beginFill(0x667788); g.drawCircle(0, -32*s, 5*s); g.endFill(); g.beginFill(0x445566); g.drawCircle(0, -32*s, 3*s); g.endFill(); }
      break;
    case 'sunset':
      if (type === 0) { g.beginFill(0x447733); g.drawRect(-2*s, -35*s, 4*s, 35*s); g.endFill(); for (var pet = 0; pet < 8; pet++) { var pa = pet*Math.PI/4; g.beginFill(0xffcc00); g.drawEllipse(Math.cos(pa)*8*s, -40*s+Math.sin(pa)*8*s, 5*s, 3*s); g.endFill(); } g.beginFill(0x885500); g.drawCircle(0, -40*s, 5*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x558833, 0.7); for (var tg = 0; tg < 5; tg++) { var tx2 = (tg-2)*5*s; g.moveTo(tx2,0); g.quadraticCurveTo(tx2+4*s,-15*s,tx2+2*s,-25*s-_rng()*10*s); g.lineTo(tx2-1*s,-25*s-_rng()*10*s); g.quadraticCurveTo(tx2-4*s,-15*s,tx2,0); } g.endFill(); }
      else if (type === 2) { g.beginFill(0x447733); g.drawRect(-2*s, -20*s, 4*s, 20*s); g.endFill(); var flColors = [0xff6688, 0xffaa44, 0xff88cc, 0xffcc66]; for (var fl = 0; fl < 6; fl++) { g.beginFill(flColors[fl % flColors.length], 0.8); g.drawCircle(_rngRange(-8,8)*s, (-22-_rng()*10)*s, (3+_rng()*2)*s); g.endFill(); } }
      else { g.beginFill(0x558844); g.drawRect(-1.5*s, -40*s, 3*s, 40*s); g.endFill(); g.beginFill(0x885533); g.drawEllipse(0, -42*s, 3.5*s, 8*s); g.endFill(); }
      break;
    default:
      if (type === 0) { g.beginFill(0x886644); g.drawRect(-3*s, -12*s, 6*s, 12*s); g.endFill(); g.beginFill(0xcc3333); g.drawEllipse(0, -15*s, 12*s, 8*s); g.endFill(); g.beginFill(0xffffff, 0.7); g.drawCircle(-4*s, -17*s, 2*s); g.drawCircle(3*s, -14*s, 1.5*s); g.drawCircle(6*s, -16*s, 1*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x447733); g.drawRect(-1*s, -15*s, 2*s, 15*s); g.endFill(); g.beginFill(0xff6688); g.drawCircle(0, -17*s, 5*s); g.endFill(); g.beginFill(0xffdd44); g.drawCircle(0, -17*s, 2*s); g.endFill(); g.beginFill(0x447733); g.drawRect(3*s, -10*s, 2*s, 10*s); g.endFill(); g.beginFill(0xffaa44); g.drawCircle(4*s, -12*s, 4*s); g.endFill(); }
      else if (type === 2) { g.beginFill(0x338833, 0.8); for (var fn = 0; fn < 4; fn++) { var fa = (fn-1.5)*0.5; g.moveTo(0,0); g.quadraticCurveTo(Math.sin(fa)*20*s,-15*s,Math.sin(fa)*15*s,-25*s); g.lineTo(Math.sin(fa)*12*s,-23*s); g.quadraticCurveTo(Math.sin(fa)*15*s,-12*s,0,0); } g.endFill(); }
      else { g.beginFill(0x5a3a1a); g.drawEllipse(0, -5*s, 20*s, 7*s); g.endFill(); g.beginFill(0x7a5a3a); g.drawCircle(-18*s, -5*s, 7*s); g.endFill(); g.beginFill(0x4a2a0a); g.drawCircle(-18*s, -5*s, 4*s); g.endFill(); }
      break;
  }
  return g;
}

function _drawGroundDetail(x: number, groundY: number): any {
  var g = new PIXI.Graphics();
  g.x = x; g.y = groundY;
  var ds = 2.5;
  switch (THEME) {
    case 'volcanic': g.lineStyle(3, 0xff4400, 0.7); g.moveTo(-20*ds, 4); g.lineTo(0, -6); g.lineTo(20*ds, 2); g.lineTo(28*ds, 8); g.lineStyle(2, 0xff6600, 0.4); g.moveTo(-12*ds, 8); g.lineTo(6*ds, -2); g.lineTo(22*ds, 10); g.beginFill(0xff3300, 0.2); g.drawEllipse(0, 2, 16*ds, 4); g.endFill(); break;
    case 'arctic': g.beginFill(0xddeeff, 0.7); g.drawEllipse(0, 0, 35, 10); g.endFill(); g.beginFill(0xeef4ff, 0.5); g.drawEllipse(5, -3, 22, 6); g.endFill(); break;
    case 'candy': var sc = [0xff6699, 0x66ccff, 0xffcc33, 0x66ff99, 0xff66ff]; for (var j = 0; j < 8; j++) { g.beginFill(sc[j%sc.length]); g.drawRoundedRect(_rngRange(-20,20), _rngRange(-4,4), 8, 3, 1); g.endFill(); } break;
    case 'space': g.lineStyle(2, 0x4488ff, 0.6); g.moveTo(-15, 4); g.lineTo(0, -4); g.lineTo(18, 6); g.beginFill(0x4488ff, 0.2); g.drawCircle(0, 0, 16); g.endFill(); g.beginFill(0x88aaff, 0.1); g.drawCircle(0, 0, 25); g.endFill(); break;
    case 'dark': g.beginFill(0x6633aa, 0.15); g.drawEllipse(0, -5, 40, 14); g.endFill(); g.beginFill(0x8844cc, 0.08); g.drawEllipse(0, -8, 55, 18); g.endFill(); break;
    case 'ocean': g.beginFill(0x66aadd, 0.35); g.drawCircle(-6, -8, 6); g.drawCircle(8, -14, 4.5); g.drawCircle(0, -22, 3); g.drawCircle(-10, -18, 2.5); g.endFill(); break;
    default: g.beginFill(0x55aa33, 0.6); g.moveTo(-10, 0); g.lineTo(-6, -16); g.lineTo(-2, 0); g.moveTo(4, 0); g.lineTo(8, -12); g.lineTo(12, 0); g.moveTo(-3, 0); g.lineTo(1, -10); g.lineTo(5, 0); g.endFill(); break;
  }
  return g;
}

// ======================== FEATURE BANK INTEGRATION ========================
__FEATURE_FACTORIES__

// ======================== GAME SCENE ========================
export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private physics!: PhysicsWorld;
  private playerGfx: any;
  private playerBody: any;
  private playerCtrl!: CharacterController;
  private score = 0;
  private lives = CONFIG.lives;
  private coins: { gfx: any; body: any; baseY: number }[] = [];
  private enemies: { gfx: any; body: any; startX: number; range: number; dir: number }[] = [];
  private clouds: { gfx: any; speed: number }[] = [];
  private bgLayers: { gfx: any; factor: number }[] = [];
  private stars: any;
  private decorTrees: any[] = [];
  private fogLayers: any[] = [];
  private treeSway: any[] = [];
  private waterSurface: any = null;
  private lavaSurface: any = null;
  private invincibleTimer = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private lastPlayerFacing = 1;
  private _lastAnim = '';

  constructor() {
    this.container = new PIXI.Container();
  }

  async enter(engine: Engine2D): Promise<void> {
    this.physics = new PhysicsWorld(CONFIG.gravity);
    this.score = 0;
    this.lives = CONFIG.lives;
    this.coins = [];
    this.enemies = [];
    this.clouds = [];
    this.bgLayers = [];
    this.decorTrees = [];
    this.fogLayers = [];
    this.treeSway = [];
    this.invincibleTimer = 0;
    this.shakeTimer = 0;

    await _loadSpriteLib(THEME);
    setNoiseSeed(_seed);

    var W = engine.config.width;
    var H = engine.config.height;
    var WW = CONFIG.worldWidth;
    var WH = CONFIG.worldHeight;

    // ---- Feature Bank: init features ----
__FEATURE_REGISTRATIONS__
    try { engine.features.initAll(); } catch(e) {}

    // ---- 1. GRADIENT SKY ----
    var sky = drawSkyGradient(WW, WH, PAL.skyTop, PAL.skyBottom);
    this.container.addChild(sky);

    // ---- 2. STARS ----
    this.stars = drawStars(WW, WH * 0.5, 80);
    this.container.addChild(this.stars);

    // ---- 3. PARALLAX MOUNTAINS (3 layers) ----
    for (var mi = 0; mi < 3; mi++) {
      var mColor = PAL.mountains[mi] || PAL.mountains[0];
      var mBaseY = CONFIG.groundY - 30 - mi * 60;
      var mMinH = 60 + mi * 30;
      var mMaxH = 120 + mi * 50;
      var mSpacing = 250 - mi * 30;
      var mAlpha = 0.4 + mi * 0.2;
      var mGfx = drawMountainRange(WW, mBaseY, mColor, mAlpha, mMinH, mMaxH, mSpacing, THEME, mi);
      this.container.addChild(mGfx);
      this.bgLayers.push({ gfx: mGfx, factor: 0.1 + mi * 0.15 });
    }

    // ---- 3b. ATMOSPHERIC FOG LAYERS ----
    try {
      this.fogLayers = drawAtmosphericFog(WW, CONFIG.groundY, THEME);
      for (var fi2 = 0; fi2 < this.fogLayers.length; fi2++) {
        this.container.addChild(this.fogLayers[fi2]);
        this.bgLayers.push({ gfx: this.fogLayers[fi2], factor: 0.05 + fi2 * 0.08 });
      }
    } catch(e) {}

    // ---- 4. CLOUDS ----
    if (THEME !== 'space' && THEME !== 'dark') {
      var cloudCount = _rngInt(5, 10);
      for (var ci = 0; ci < cloudCount; ci++) {
        var cw = _rngRange(80, 200);
        var ch = _rngRange(25, 45);
        var cloud = drawCloud(cw, ch);
        cloud.x = _rngRange(0, WW);
        cloud.y = _rngRange(50, CONFIG.groundY * 0.4);
        if (THEME === 'volcanic') { cloud.tint = 0x997766; cloud.alpha = 0.5; }
        this.container.addChild(cloud);
        this.clouds.push({ gfx: cloud, speed: _rngRange(5, 15) });
      }
    }

    // ---- 5. THEME-SPECIFIC DECORATIONS ----
    var decData = _generateDecorations();
    for (var di = 0; di < decData.length; di++) {
      var dd = decData[di];
      var dec = _drawDecoration(dd.type, dd.size);
      dec.x = dd.x;
      dec.y = CONFIG.groundY;
      if (dd.flip) dec.scale.x = -1;
      this.container.addChild(dec);
      this.decorTrees.push(dec);
    }

    // ---- 6. GROUND ----
    var floorH = WH - CONFIG.groundY;
    var ground = drawGroundStrip(WW, CONFIG.groundY, floorH, PAL.ground, PAL.groundTop, THEME);
    this.container.addChild(ground);
    var groundBody = createStaticBody(WW / 2, CONFIG.groundY + 4, WW, 8);
    this.physics.addBody(groundBody);

    // ---- 6b. L-SYSTEM TREES ----
    var treePresetList = TREE_PRESETS[THEME] || [];
    if (treePresetList.length > 0) {
      var treeCount = _rngInt(4, 8);
      var treeSpacing = CONFIG.worldWidth / treeCount;
      for (var ti = 0; ti < treeCount; ti++) {
        var treePreset = treePresetList[_rngInt(0, treePresetList.length - 1)];
        var treeX = ti * treeSpacing + _rngRange(50, treeSpacing - 50);
        var treeSeed = _seed + ti * 137;
        var tree = drawLSystemTree(treeX, CONFIG.groundY, treePreset, THEME, treeSeed);
        this.container.addChild(tree);
        this.treeSway.push(tree);
      }
    }

    // ---- 6c. GROUND DETAILS ----
    var groundDetailCount = _rngInt(12, 24);
    var gdSpacing = CONFIG.worldWidth / groundDetailCount;
    for (var gdi = 0; gdi < groundDetailCount; gdi++) {
      var gdx = gdi * gdSpacing + _rngRange(10, gdSpacing - 10);
      var gd = _drawGroundDetail(gdx, CONFIG.groundY);
      this.container.addChild(gd);
    }

    // ---- 7. PLATFORMS ----
    var platforms = _generatePlatforms();
    for (var pi = 0; pi < platforms.length; pi++) {
      var p = platforms[pi];
      var platGfx = drawPlatformBlock(p.w, 24, PAL.platform, PAL.platformTop, THEME);
      platGfx.x = p.x;
      platGfx.y = p.y;
      this.container.addChild(platGfx);
      var platBody = createOneWayPlatform(p.x, p.y, p.w, 24);
      this.physics.addBody(platBody);
    }

    // ---- 8. PLAYER ----
    this.playerGfx = drawPlayerCharacter(CONFIG.playerSize, PAL.player, PAL.playerLight);
    this.playerGfx.x = CONFIG.playerStartX;
    this.playerGfx.y = CONFIG.groundY - 30;
    this.container.addChild(this.playerGfx);

    this.playerBody = createBody(CONFIG.playerStartX, CONFIG.groundY - 30, 28, 44);
    this.playerBody.sprite = this.playerGfx;
    this.playerBody.tag = 'player';
    this.physics.addBody(this.playerBody);
    this.playerCtrl = new CharacterController(this.playerBody, {
      moveSpeed: CONFIG.moveSpeed,
      jumpForce: CONFIG.jumpForce,
      doubleJump: CONFIG.doubleJump,
      wallSlide: CONFIG.wallSlide,
    });

    // ---- 9. COINS ----
    var coinData = _generateCoins(platforms);
    for (var coi = 0; coi < coinData.length; coi++) {
      var cp = coinData[coi];
      var coinGfx = drawCoinToken(CONFIG.coinRadius, PAL.coin, PAL.coinGlow);
      coinGfx.x = cp.x;
      coinGfx.y = cp.y;
      this.container.addChild(coinGfx);
      var coinBody = createBody(cp.x, cp.y, 18, 18, { isStatic: true, isSensor: true, tag: 'coin' });
      coinBody.sprite = coinGfx;
      this.physics.addBody(coinBody);
      this.coins.push({ gfx: coinGfx, body: coinBody, baseY: cp.y });
    }

    // ---- 10. ENEMIES ----
    var enemyData = _generateEnemies();
    for (var ei = 0; ei < enemyData.length; ei++) {
      var ed = enemyData[ei];
      var enemyGfx = drawEnemySlime(CONFIG.enemySize, PAL.enemy, PAL.enemyLight);
      enemyGfx.x = ed.x;
      enemyGfx.y = CONFIG.groundY - 18;
      this.container.addChild(enemyGfx);
      var enemyBody = createBody(ed.x, CONFIG.groundY - 18, 32, 28, { isStatic: true, isSensor: true, tag: 'enemy' });
      enemyBody.sprite = enemyGfx;
      this.physics.addBody(enemyBody);
      this.enemies.push({ gfx: enemyGfx, body: enemyBody, startX: ed.x, range: ed.range, dir: 1 });
    }

    // ---- 11. COLLISION HANDLER (emits events for Feature Bank) ----
    var self = this;
    this.physics.onSensorOverlap(function(a: any, b: any) {
      var coin = a.tag === 'coin' ? a : b.tag === 'coin' ? b : null;
      var enemy = a.tag === 'enemy' ? a : b.tag === 'enemy' ? b : null;
      var player = a.tag === 'player' ? a : b.tag === 'player' ? b : null;
      if (coin && player && coin.enabled !== false) {
        onCollectSparkle(engine.proton, coin.x, coin.y);
        if (coin.sprite) coin.sprite.visible = false;
        coin.enabled = false;
        self.score += 10;
        try { engine.events.emit('coin-collect', { score: self.score, x: coin.x, y: coin.y }); } catch(e) {}
      }
      if (enemy && player && enemy.enabled !== false && self.invincibleTimer <= 0) {
        self.lives--;
        self.invincibleTimer = 1.5;
        engine.juice.shake(engine.world, 10, 0.3);
        engine.juice.hitPause(engine.app, 80);
        engine.juice.flash(self.playerGfx, 0xff0000, 0.15);
        onDeathExplosion(engine.proton, enemy.x, enemy.y, '#ff4444');
        self.playerBody.vy = -350;
        try { engine.events.emit('player-hit', { lives: self.lives, x: enemy.x, y: enemy.y }); } catch(e) {}
        if (self.lives <= 0) {
          try { engine.events.emit('player-death', { score: self.score }); } catch(e) {}
          engine.scene.switch('gameover', { score: self.score });
        }
      }
    });

    // ---- 12. AMBIENT PARTICLES ----
    try {
      if (PAL.weather === 'snow') {
        var snowFx = createSnowEffect(W, H, 0.5);
        if (snowFx && snowFx.emitter) engine.addEmitter(snowFx.emitter);
        for (var spi = 0; spi < platforms.length; spi++) {
          var sp2 = platforms[spi];
          for (var sd = 0; sd < sp2.w / 8; sd++) {
            var snowDot = new PIXI.Graphics();
            snowDot.circle(0, 0, 1 + Math.random() * 1.5);
            snowDot.fill({ color: 0xeef4ff, alpha: 0.6 + Math.random() * 0.3 });
            snowDot.x = sp2.x - sp2.w / 2 + sd * 8 + Math.random() * 6;
            snowDot.y = sp2.y - 2 - Math.random() * 3;
            this.container.addChild(snowDot);
          }
        }
      } else if (PAL.weather === 'rain') {
        var rainFx = createRainEffect(W, H, 0.5);
        if (rainFx && rainFx.emitter) engine.addEmitter(rainFx.emitter);
      }
      if (PAL.ambient) {
        var ambientFx = createAmbientEffect(PAL.ambient as any, W, H);
        if (ambientFx && ambientFx.emitter) engine.addEmitter(ambientFx.emitter);
      }
      if (THEME === 'forest' || THEME === 'dark') {
        var fireflyCount = _rngInt(6, 14);
        for (var ffi = 0; ffi < fireflyCount; ffi++) {
          var ffGlow = new PIXI.Graphics();
          var ffColor = THEME === 'forest' ? 0xddff44 : 0xaa55ff;
          ffGlow.circle(0, 0, 3);
          ffGlow.fill({ color: ffColor, alpha: 0.6 });
          ffGlow.circle(0, 0, 8);
          ffGlow.fill({ color: ffColor, alpha: 0.15 });
          ffGlow.x = _rngRange(100, WW - 100);
          ffGlow.y = _rngRange(CONFIG.groundY * 0.3, CONFIG.groundY - 50);
          ffGlow.blendMode = 'add';
          this.container.addChild(ffGlow);
          this.decorTrees.push(ffGlow);
        }
      }
    } catch(e) {}

    // ---- 13. CONTROLS HINT ----
    var hint = engine.createText('WASD / Arrows + Space', { fontSize: 11, fill: 0x666666 });
    hint.anchor.set(0.5, 1);
    hint.x = W / 2;
    hint.y = H - 8;
    engine.ui.addChild(hint);

    // ---- 14. CAMERA ----
    engine.camera.follow(this.playerBody);
    engine.camera.worldWidth = CONFIG.worldWidth;
    engine.camera.worldHeight = CONFIG.worldHeight;
    engine.camera.smoothing = 0.08;

    // ---- 15. JUICE EFFECTS ----
    for (var ji = 0; ji < this.coins.length; ji++) {
      engine.juice.float(this.coins[ji].gfx, 5, 2 + _rng() * 0.5);
    }
    engine.juice.breathe(this.playerGfx, 1.03, 1.2);

    var _PIXI = (window as any).PIXI;
    if (_PIXI.filters && _PIXI.filters.DropShadowFilter && !this.playerGfx.filters) {
      this.playerGfx.filters = [new _PIXI.filters.DropShadowFilter({
        offset: { x: 3, y: 5 }, blur: 5, alpha: 0.5, color: 0x000000,
      })];
    }

    // ---- 15b. DYNAMIC WATER/LAVA SURFACE ----
    try {
      if (THEME === 'ocean') {
        var waterY2 = CONFIG.groundY - 15;
        var waterH2 = CONFIG.worldHeight - waterY2;
        this.waterSurface = createWaterSurface(WW, waterY2, waterH2, 0x1a5276);
        this.container.addChild(this.waterSurface.container);
      } else if (THEME === 'forest') {
        var pondX = _rngRange(WW * 0.3, WW * 0.6);
        var pondW = _rngRange(300, 600);
        var pondY = CONFIG.groundY - 5;
        var pondH = CONFIG.worldHeight - pondY;
        this.waterSurface = createWaterSurface(pondW, pondY, pondH, 0x2d6a4f);
        this.waterSurface.container.x = pondX;
        this.container.addChild(this.waterSurface.container);
      } else if (THEME === 'volcanic') {
        var lavaY2 = CONFIG.groundY - 10;
        var lavaH2 = CONFIG.worldHeight - lavaY2;
        this.lavaSurface = createLavaSurface(WW, lavaY2, lavaH2);
        this.container.addChild(this.lavaSurface.container);
      }
    } catch(e) {}

    // ---- 16. LIGHTING LAYER ----
    try {
      var decorPositions = decData.map(function(d: any) { return { x: d.x, y: CONFIG.groundY }; });
      var lightLayer = createLightingLayer(THEME, WW, CONFIG.groundY, decorPositions);
      this.container.addChild(lightLayer);
    } catch(e) {}

    // ---- 17. VIGNETTE ----
    try {
      var vig = drawVignette(W, H);
      engine.ui.addChild(vig);
    } catch(e) {}

    // === AI ENHANCEMENT ZONE ===
    // This game is fully playable. ENHANCE it based on the Creative Brief:
    // - Add themed decorations (torches, mushrooms, crystals, coral, etc.)
    // - Implement specialMechanic if not already active (dash, gravity-flip, etc.)
    // - Add unique enemy types or a boss fight
    // - Add moving/breakable/disappearing platforms
    // - Add themed particle effects beyond ambient
    // - DO NOT delete or rewrite existing code — ADD to it
__CUSTOM_CODE__
  }

  update(engine: Engine2D, dt: number): void {
    this.physics.update(dt);

    // ---- Player movement ----
    if (this.playerCtrl) {
      var wasOnGround = this.playerCtrl.body.onGround;
      this.playerCtrl.update({
        left: engine.input.left,
        right: engine.input.right,
        jump: engine.input.jump,
      }, dt);

      if (engine.input.left) this.lastPlayerFacing = -1;
      if (engine.input.right) this.lastPlayerFacing = 1;
      this.playerGfx.scale.x = this.lastPlayerFacing;

      // AnimatedSprite animation switching
      if (this.playerGfx.textures && this.playerGfx.play) {
        var _sheet = _sheetCache && _sheetCache['hero'];
        if (_sheet && _sheet.animations) {
          var _anim = 'idle';
          if (!this.playerCtrl.body.onGround) {
            _anim = 'jump';
          } else if (engine.input.left || engine.input.right) {
            _anim = 'walk';
          }
          if (this._lastAnim !== _anim && _sheet.animations[_anim]) {
            this.playerGfx.textures = _sheet.animations[_anim];
            this.playerGfx.animationSpeed = _anim === 'walk' ? 0.12 : 0.08;
            this.playerGfx.play();
            this._lastAnim = _anim;
          }
        }
      }

      // Squash & stretch
      if (!this.playerCtrl.body.onGround) {
        var vy = this.playerCtrl.body.vy;
        if (vy < -100) this.playerGfx.scale.y = 1.15;
        else if (vy > 100) this.playerGfx.scale.y = 0.9;
      } else {
        this.playerGfx.scale.y += (1 - this.playerGfx.scale.y) * 0.2;
      }

      // Jump dust
      if (!this.playerCtrl.body.onGround && wasOnGround && this.playerCtrl.body.vy < 0) {
        onJumpDust(engine.proton, this.playerCtrl.body.x, this.playerCtrl.body.y + 22);
      }
      // Land impact
      if (this.playerCtrl.body.onGround && !wasOnGround) {
        onLandImpact(engine.proton, this.playerCtrl.body.x, this.playerCtrl.body.y + 22);
        engine.juice.squash(this.playerGfx, 0.7, 1.15);
      }
    }

    // ---- Invincibility blink ----
    if (this.playerGfx) {
      if (this.invincibleTimer > 0) {
        this.invincibleTimer -= dt;
        this.playerGfx.alpha = Math.sin(this.invincibleTimer * 20) > 0 ? 1 : 0.3;
      } else {
        this.playerGfx.alpha = 1;
      }
    }

    // ---- Animate coins ----
    for (var c = 0; c < this.coins.length; c++) {
      var coin = this.coins[c];
      if (coin.gfx.visible) {
        coin.gfx.y = coin.baseY + Math.sin(engine.elapsed * 3 + coin.body.x * 0.01) * 5;
        coin.gfx.rotation = Math.sin(engine.elapsed * 2 + coin.body.x * 0.02) * 0.15;
        if (coin.gfx.children && coin.gfx.children[0]) {
          coin.gfx.children[0].alpha = 0.5 + 0.5 * Math.sin(engine.elapsed * 4 + coin.body.x * 0.03);
        }
        coin.body.y = coin.gfx.y;
      }
    }

    // ---- Animate enemies ----
    for (var e = 0; e < this.enemies.length; e++) {
      var en = this.enemies[e];
      if (en.body.enabled === false) continue;
      en.gfx.x += en.dir * CONFIG.enemySpeed * dt;
      en.body.x = en.gfx.x;
      if (en.gfx.x > en.startX + en.range) en.dir = -1;
      if (en.gfx.x < en.startX - en.range) en.dir = 1;
      en.gfx.scale.x = en.dir;
      en.gfx.scale.y = 1 + Math.sin(engine.elapsed * 5 + e) * 0.08;
    }

    // ---- Star twinkle ----
    if (this.stars) {
      this.stars.alpha = 0.6 + 0.4 * Math.sin(engine.elapsed * 0.5);
    }

    // ---- Fall death ----
    if (this.playerCtrl && this.playerCtrl.body.y > CONFIG.worldHeight + 100) {
      try { engine.events.emit('player-death', { score: this.score }); } catch(e) {}
      engine.scene.switch('gameover', { score: this.score });
    }

    // ---- Fog drift ----
    for (var fg = 0; fg < this.fogLayers.length; fg++) {
      this.fogLayers[fg].x += (0.3 + fg * 0.2) * dt;
      if (this.fogLayers[fg].x > CONFIG.worldWidth * 0.1) this.fogLayers[fg].x = 0;
    }

    // ---- Wind system ----
    var _windStr = 0.5 + 0.5 * Math.sin(engine.elapsed * 0.15);
    var _windDir = Math.sin(engine.elapsed * 0.07) > 0 ? 1 : -1;

    // ---- Vegetation sway ----
    for (var sw = 0; sw < this.treeSway.length; sw++) {
      var treeObj = this.treeSway[sw];
      var swayA = Math.sin(engine.elapsed * 1.2 + treeObj.x * 0.008) * 0.018 * (0.5 + _windStr);
      var swayB = Math.sin(engine.elapsed * 2.1 + treeObj.x * 0.015) * 0.008;
      treeObj.skew.x = (swayA + swayB) * _windDir;
    }
    for (var dw = 0; dw < this.decorTrees.length; dw++) {
      var decObj = this.decorTrees[dw];
      decObj.skew.x = Math.sin(engine.elapsed * 1.5 + decObj.x * 0.01) * 0.012 * (0.5 + _windStr) * _windDir;
    }

    // ---- Animate clouds ----
    for (var cl = 0; cl < this.clouds.length; cl++) {
      var cloud2 = this.clouds[cl];
      cloud2.gfx.x += (cloud2.speed * (0.6 + _windStr * 0.8)) * dt;
      if (cloud2.gfx.x > CONFIG.worldWidth + 150) {
        cloud2.gfx.x = -150;
      }
    }

    // ---- Animate water/lava surfaces ----
    if (this.waterSurface) { try { this.waterSurface.update(engine.elapsed); } catch(e) {} }
    if (this.lavaSurface) { try { this.lavaSurface.update(engine.elapsed); } catch(e) {} }

    // ---- Feature Bank: update features ----
    try { engine.features.updateAll(dt); } catch(e) {}

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    try { engine.features.destroyAll(); } catch(e) {}
    engine.juice.killAll();
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
}
