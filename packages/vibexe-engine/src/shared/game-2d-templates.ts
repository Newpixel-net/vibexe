/**
 * 2D Game Template Files — Pre-created infrastructure injected into projects
 * BEFORE the AI agent starts generating code.
 *
 * Mirrors game-3d-templates.ts pattern exactly.
 * The agent finds these files already existing and imports from them.
 */

import type { TemplateFile } from "./game-3d-templates";
import type { CreativeBrief } from "./game-2d-seed";
import { ENGINE_CORE_CONTENT } from "./game-2d-engine";
import { ENGINE_INPUT_CONTENT, MEDIA_STOCK_2D_CONTENT } from "./game-2d-engine";
import { ENGINE_PHYSICS_CONTENT } from "./game-2d-physics";
import { ENGINE_EFFECTS_CONTENT } from "./game-2d-effects";
// Level Painter removed — sprite-based drawing functions are the primary rendering system

export { type TemplateFile };

// ============================================================================
// VISUAL HELPERS — Programmatic drawing functions for professional graphics
// ============================================================================

const VISUAL_HELPERS_CONTENT = `
const PIXI = (window as any).PIXI;

// Promote pixi-filters to top-level PIXI namespace (AI writes PIXI.GlowFilter not PIXI.filters.GlowFilter)
if (PIXI.filters) {
  var _fNames = ['GlowFilter','DropShadowFilter','OutlineFilter','BloomFilter','BlurFilter','ColorMatrixFilter','AdjustmentFilter','AdvancedBloomFilter','GodrayFilter','MotionBlurFilter'];
  for (var _fi = 0; _fi < _fNames.length; _fi++) { if (PIXI.filters[_fNames[_fi]] && !PIXI[_fNames[_fi]]) PIXI[_fNames[_fi]] = PIXI.filters[_fNames[_fi]]; }
}

// ============================================================================
// RUNTIME FEATURE DETECTION
// ============================================================================

function hasFilters(): boolean {
  return !!(PIXI.filters && PIXI.filters.DropShadowFilter);
}

function hasGsap(): boolean {
  return !!(window as any).gsap;
}

function hasFillGradient(): boolean {
  return !!PIXI.FillGradient;
}

function hasCanvas(): boolean {
  return typeof document !== 'undefined' && !!document.createElement;
}

// ============================================================================
// SPRITE LIBRARY IMPORTS (from media-stock.ts)
// ============================================================================

import { _getSprite, _getAnimatedSprite, _getTilingSprite, _loadSpriteLib, _sheetCache, _themeGroundMap, _themePlatformMap } from '../utils/media-stock';
import { createAmbientEffect, createSnowEffect, createRainEffect, onJumpDust, onLandImpact, onCollectSparkle, onDeathExplosion } from '../engine/effects';
import { PhysicsWorld, createBody, createStaticBody, createOneWayPlatform, CharacterController } from '../engine/physics';

/** Check if sprite lib imports are available */
function _hasSpriteLib(): boolean {
  return typeof _getSprite === 'function';
}

// ============================================================================
// CANVAS 2D HELPERS — High-quality programmatic fallback using HTML Canvas
// ============================================================================

/** Create an offscreen canvas and return [canvas, ctx] */
function _makeCanvas(w: number, h: number): [any, any] {
  var c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  var ctx = c.getContext('2d')!;
  return [c, ctx];
}

/** Convert a hex number (0xRRGGBB) to CSS color string */
function _hexCss(color: number, alpha?: number): string {
  var r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  if (alpha !== undefined && alpha < 1) return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  return '#' + ('000000' + color.toString(16)).slice(-6);
}

/** Create a PIXI.Sprite from an HTML Canvas element */
function _canvasToSprite(canvas: any): any {
  return PIXI.Sprite.from(canvas);
}

/** Draw a volumetric 3D-shaded circle on canvas (offset radial gradient + specular) */
function _drawShadedCircle(ctx: any, cx: number, cy: number, r: number, color: number, lightAngle?: number): void {
  var la = lightAngle || -0.7;
  var offX = Math.cos(la) * r * 0.25;
  var offY = Math.sin(la) * r * 0.25;
  var grad = ctx.createRadialGradient(cx + offX, cy + offY, r * 0.05, cx, cy, r);
  grad.addColorStop(0, _hexCss(lighten(color, 40)));
  grad.addColorStop(0.6, _hexCss(color));
  grad.addColorStop(1, _hexCss(darken(color, 40)));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Specular highlight
  ctx.globalCompositeOperation = 'screen';
  var spec = ctx.createRadialGradient(cx + offX * 1.5, cy + offY * 1.5, 0, cx + offX, cy + offY, r * 0.45);
  spec.addColorStop(0, 'rgba(255,255,255,0.5)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

/** Draw a puffy soft-edged shape on canvas using shadowBlur */
function _drawPuffyEllipse(ctx: any, cx: number, cy: number, rx: number, ry: number, color: string, blur: number): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Canvas 2D drawing functions (Tier 2 fallback — better than PIXI.Graphics)
// ---------------------------------------------------------------------------

/** Canvas 2D player character — volumetric 3D-shaded body with face details */
function _drawPlayerCanvas(size: number, bodyColor: number, lightColor: number): any {
  var s = size;
  var w = s * 1.2, h = s * 1.6;
  var pad = 8;
  var cw = w + pad * 2, ch = h + pad * 2;
  var [canvas, ctx] = _makeCanvas(cw, ch);
  var ox = cw / 2, oy = ch * 0.65;

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(ox, oy + s * 0.48, s * 0.3, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feet
  _drawShadedCircle(ctx, ox - s * 0.16, oy + s * 0.4, s * 0.1, darken(bodyColor, 30));
  _drawShadedCircle(ctx, ox + s * 0.16, oy + s * 0.4, s * 0.1, darken(bodyColor, 30));

  // Body — rounded rect with vertical gradient
  var bodyTop = oy - s * 0.2, bodyH = s * 0.62, bodyW = s * 0.58;
  var bodyGrad = ctx.createLinearGradient(0, bodyTop, 0, bodyTop + bodyH);
  bodyGrad.addColorStop(0, _hexCss(lightColor));
  bodyGrad.addColorStop(1, _hexCss(darken(bodyColor, 20)));
  ctx.fillStyle = bodyGrad;
  _roundRect(ctx, ox - bodyW / 2, bodyTop, bodyW, bodyH, s * 0.18);
  ctx.fill();
  // Body specular
  ctx.globalCompositeOperation = 'screen';
  var bodySpec = ctx.createRadialGradient(ox - s * 0.08, bodyTop + bodyH * 0.2, 0, ox, bodyTop + bodyH * 0.4, bodyW * 0.5);
  bodySpec.addColorStop(0, 'rgba(255,255,255,0.2)');
  bodySpec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = bodySpec;
  _roundRect(ctx, ox - bodyW / 2, bodyTop, bodyW, bodyH, s * 0.18);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Head — 3D shaded sphere
  _drawShadedCircle(ctx, ox, oy - s * 0.35, s * 0.26, bodyColor);

  // Hat
  var hatGrad = ctx.createLinearGradient(0, oy - s * 0.63, 0, oy - s * 0.49);
  hatGrad.addColorStop(0, _hexCss(darken(bodyColor, 20)));
  hatGrad.addColorStop(1, _hexCss(darken(bodyColor, 40)));
  ctx.fillStyle = hatGrad;
  _roundRect(ctx, ox - s * 0.22, oy - s * 0.63, s * 0.44, s * 0.14, 5);
  ctx.fill();
  ctx.fillStyle = _hexCss(darken(bodyColor, 30));
  _roundRect(ctx, ox - s * 0.3, oy - s * 0.54, s * 0.6, s * 0.07, 4);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ox - s * 0.1, oy - s * 0.36, s * 0.08, 0, Math.PI * 2);
  ctx.arc(ox + s * 0.1, oy - s * 0.36, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // Pupils
  ctx.fillStyle = '#111122';
  ctx.beginPath();
  ctx.arc(ox - s * 0.07, oy - s * 0.36, s * 0.04, 0, Math.PI * 2);
  ctx.arc(ox + s * 0.13, oy - s * 0.36, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
  // Eye shine
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(ox - s * 0.09, oy - s * 0.39, s * 0.022, 0, Math.PI * 2);
  ctx.arc(ox + s * 0.11, oy - s * 0.39, s * 0.022, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = _hexCss(darken(bodyColor, 55));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox - s * 0.06, oy - s * 0.24);
  ctx.quadraticCurveTo(ox, oy - s * 0.18, ox + s * 0.06, oy - s * 0.24);
  ctx.stroke();

  // Rosy cheeks
  ctx.fillStyle = 'rgba(255,102,136,0.15)';
  ctx.beginPath();
  ctx.ellipse(ox - s * 0.15, oy - s * 0.27, s * 0.04, s * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ox + s * 0.15, oy - s * 0.27, s * 0.04, s * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thick outline (sticker look)
  ctx.globalCompositeOperation = 'destination-over';
  ctx.strokeStyle = _hexCss(darken(bodyColor, 80));
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  // Trace full silhouette
  ctx.arc(ox, oy - s * 0.35, s * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  _roundRect(ctx, ox - bodyW / 2 - 1, bodyTop - 1, bodyW + 2, bodyH + 2, s * 0.18);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';

  var spr = _canvasToSprite(canvas);
  spr.anchor.set(0.5, 0.65);
  return spr;
}

/** Canvas 2D coin — radial gradient with golden 3D shading */
function _drawCoinCanvas(radius: number, color: number, glowColor: number): any {
  var r = radius;
  var pad = r * 2.5;
  var sz = (r + pad) * 2;
  var [canvas, ctx] = _makeCanvas(sz, sz);
  var cx = sz / 2, cy = sz / 2;

  // Outer glow
  ctx.save();
  ctx.shadowColor = _hexCss(glowColor, 0.6);
  ctx.shadowBlur = r * 2;
  ctx.fillStyle = _hexCss(glowColor, 0.15);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Coin body with 3D shading
  _drawShadedCircle(ctx, cx, cy, r, color, -0.8);

  // Inner ring
  ctx.strokeStyle = _hexCss(darken(color, 15), 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
  ctx.stroke();

  // Star symbol in center
  ctx.fillStyle = _hexCss(darken(color, 20), 0.3);
  ctx.font = (r * 0.8) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', cx, cy + 1);

  var spr = _canvasToSprite(canvas);
  spr.anchor.set(0.5, 0.5);
  return spr;
}

/** Canvas 2D enemy slime — organic blob with volumetric shading */
function _drawSlimeCanvas(size: number, color: number, lightColor: number): any {
  var s = size;
  var pad = 8;
  var cw = s * 1.2 + pad * 2, ch = s * 1.1 + pad * 2;
  var [canvas, ctx] = _makeCanvas(cw, ch);
  var ox = cw / 2, oy = ch * 0.6;

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(ox, oy + s * 0.42, s * 0.35, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body blob with offset radial gradient
  var grad = ctx.createRadialGradient(ox - s * 0.08, oy - s * 0.12, s * 0.05, ox, oy + s * 0.05, s * 0.42);
  grad.addColorStop(0, _hexCss(lightColor));
  grad.addColorStop(0.6, _hexCss(color));
  grad.addColorStop(1, _hexCss(darken(color, 30)));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(ox, oy + s * 0.08, s * 0.4, s * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  // Top bump
  ctx.beginPath();
  ctx.arc(ox, oy - s * 0.15, s * 0.27, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight
  ctx.globalCompositeOperation = 'screen';
  var spec = ctx.createRadialGradient(ox - s * 0.1, oy - s * 0.2, 0, ox - s * 0.05, oy - s * 0.1, s * 0.2);
  spec.addColorStop(0, 'rgba(255,255,255,0.3)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(ox, oy - s * 0.1, s * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ox - s * 0.11, oy - s * 0.1, s * 0.09, 0, Math.PI * 2);
  ctx.arc(ox + s * 0.11, oy - s * 0.1, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // Angry pupils
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(ox - s * 0.09, oy - s * 0.09, s * 0.045, 0, Math.PI * 2);
  ctx.arc(ox + s * 0.13, oy - s * 0.09, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  // Eye shine
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(ox - s * 0.11, oy - s * 0.13, s * 0.02, 0, Math.PI * 2);
  ctx.arc(ox + s * 0.11, oy - s * 0.13, s * 0.02, 0, Math.PI * 2);
  ctx.fill();
  // Angry brows
  ctx.strokeStyle = _hexCss(darken(color, 65));
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ox - s * 0.2, oy - s * 0.24);
  ctx.lineTo(ox - s * 0.04, oy - s * 0.17);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ox + s * 0.2, oy - s * 0.24);
  ctx.lineTo(ox + s * 0.04, oy - s * 0.17);
  ctx.stroke();
  // Mouth
  ctx.fillStyle = _hexCss(darken(color, 50));
  ctx.beginPath();
  ctx.moveTo(ox - s * 0.08, oy + s * 0.02);
  ctx.quadraticCurveTo(ox, oy + s * 0.1, ox + s * 0.08, oy + s * 0.02);
  ctx.fill();

  // Thick outline
  ctx.globalCompositeOperation = 'destination-over';
  ctx.strokeStyle = _hexCss(darken(color, 70));
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(ox, oy + s * 0.08, s * 0.42, s * 0.36, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';

  var spr = _canvasToSprite(canvas);
  spr.anchor.set(0.5, 0.6);
  return spr;
}

/** Canvas 2D platform block — gradient fill with thick border and grass */
function _drawPlatformCanvas(w: number, h: number, mainColor: number, topColor: number): any {
  var pad = 12;
  var cw = w + pad * 2, ch = h + pad * 2 + 16;
  var [canvas, ctx] = _makeCanvas(cw, ch);
  var bx = pad, by = pad + 12;

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = _hexCss(darken(mainColor, 35));
  _roundRect(ctx, bx - 3, by - 3, w + 6, h + 6, 8);
  ctx.fill();
  ctx.restore();

  // Main body gradient
  var grad = ctx.createLinearGradient(0, by, 0, by + h);
  grad.addColorStop(0, _hexCss(lighten(mainColor, 20)));
  grad.addColorStop(1, _hexCss(darken(mainColor, 10)));
  ctx.fillStyle = grad;
  _roundRect(ctx, bx, by, w, h, 6);
  ctx.fill();

  // Top highlight band
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  _roundRect(ctx, bx + 2, by + 1, w - 4, h * 0.25, 4);
  ctx.fill();

  // Top grass lip
  ctx.fillStyle = _hexCss(topColor);
  _roundRect(ctx, bx - 2, by - 4, w + 4, 8, 4);
  ctx.fill();
  ctx.fillStyle = _hexCss(lighten(topColor, 20));
  _roundRect(ctx, bx - 1, by - 4, w + 2, 3, 3);
  ctx.fill();

  // Grass tufts
  for (var gx = bx + 5; gx < bx + w - 5; gx += 6 + Math.random() * 4) {
    var gh = 4 + Math.random() * 8;
    ctx.fillStyle = Math.random() > 0.4 ? _hexCss(topColor) : _hexCss(lighten(topColor, 12));
    ctx.beginPath();
    ctx.moveTo(gx, by - 4);
    ctx.quadraticCurveTo(gx + 1, by - gh * 0.7, gx + 0.5, by - gh - 4);
    ctx.quadraticCurveTo(gx + 2, by - gh * 0.3 - 4, gx + 3, by - 4);
    ctx.closePath();
    ctx.fill();
  }

  var container = new PIXI.Container();
  var spr = _canvasToSprite(canvas);
  spr.anchor.set((pad + w / 2) / cw, (pad + 12 + h / 2) / ch);
  container.addChild(spr);
  return container;
}

/** Helper: draw a rounded rectangle path on canvas context */
function _roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

export function lerpColor(a: number, b: number, t: number): number {
  var ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  var br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  var r = Math.round(ar + (br - ar) * t);
  var g = Math.round(ag + (bg - ag) * t);
  var bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function darken(color: number, amount: number): number {
  var r = Math.max(0, ((color >> 16) & 0xff) - amount);
  var g = Math.max(0, ((color >> 8) & 0xff) - amount);
  var b = Math.max(0, (color & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

function lighten(color: number, amount: number): number {
  var r = Math.min(255, ((color >> 16) & 0xff) + amount);
  var g = Math.min(255, ((color >> 8) & 0xff) + amount);
  var b = Math.min(255, (color & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}

function hexToStr(color: number): string {
  return '#' + ('000000' + color.toString(16)).slice(-6);
}

/** Create a linear FillGradient (top→bottom). Falls back to topColor if FillGradient unavailable. */
function makeLinearGradient(topColor: number, bottomColor: number, height: number): any {
  if (!hasFillGradient()) return topColor;
  var grad = new PIXI.FillGradient({
    type: 'linear',
    colorStops: [
      { offset: 0, color: hexToStr(topColor) },
      { offset: 1, color: hexToStr(bottomColor) },
    ],
    x0: 0, y0: 0, x1: 0, y1: height,
  });
  return grad;
}

/** Create a radial FillGradient (inner→outer). Falls back to innerColor if FillGradient unavailable. */
function makeRadialGradient(innerColor: number, outerColor: number, radius: number): any {
  if (!hasFillGradient()) return innerColor;
  var grad = new PIXI.FillGradient({
    type: 'radial',
    colorStops: [
      { offset: 0, color: hexToStr(innerColor) },
      { offset: 1, color: hexToStr(outerColor) },
    ],
    x0: 0, y0: 0, r0: 0, x1: 0, y1: 0, r1: radius,
  });
  return grad;
}

// ============================================================================
// COLOR PALETTES
// ============================================================================

export const PALETTES: Record<string, any> = {
  forest: {
    skyTop: 0x0a0a2e, skyBottom: 0x1a4a3a,
    mountains: [0x0d1a0d, 0x1a2d1a, 0x2a3d2a],
    ground: 0x2d5a27, groundTop: 0x4a8a3a,
    platform: 0x5a3a1a, platformTop: 0x7a5a3a,
    player: 0x44aaff, playerLight: 0x77ccff,
    coin: 0xffdd00, coinGlow: 0xffaa00,
    enemy: 0xcc3333, enemyLight: 0xff5555,
    foliage: 0x339933, foliageLight: 0x55cc55,
    ambient: 'fireflies', weather: null,
  },
  sunset: {
    skyTop: 0x1a0533, skyBottom: 0xff6633,
    mountains: [0x1a1133, 0x2d1a44, 0x442d55],
    ground: 0x3a5a2a, groundTop: 0x5a8a3a,
    platform: 0x6a4a2a, platformTop: 0x8a6a4a,
    player: 0x44ccaa, playerLight: 0x66eebb,
    coin: 0xffdd00, coinGlow: 0xff8800,
    enemy: 0xaa2244, enemyLight: 0xdd4466,
    foliage: 0x447733, foliageLight: 0x66aa55,
    ambient: 'fireflies', weather: null,
  },
  space: {
    skyTop: 0x000011, skyBottom: 0x0a0a33,
    mountains: [0x111133, 0x1a1a44, 0x222255],
    ground: 0x333355, groundTop: 0x444477,
    platform: 0x555577, platformTop: 0x6666aa,
    player: 0x44ffaa, playerLight: 0x77ffcc,
    coin: 0xffaa33, coinGlow: 0xff6600,
    enemy: 0xff44aa, enemyLight: 0xff77cc,
    foliage: 0x4466aa, foliageLight: 0x6688cc,
    ambient: 'dust', weather: null,
  },
  volcanic: {
    skyTop: 0x1a0000, skyBottom: 0x4a1500,
    mountains: [0x1a0505, 0x2d0a0a, 0x3d1515],
    ground: 0x2a1a0a, groundTop: 0x4a2a1a,
    platform: 0x3a2a1a, platformTop: 0x5a3a2a,
    player: 0x44aaff, playerLight: 0x77ccff,
    coin: 0xffdd00, coinGlow: 0xff4400,
    enemy: 0xff6600, enemyLight: 0xff8833,
    foliage: 0x553322, foliageLight: 0x774433,
    ambient: 'embers', weather: null,
  },
  candy: {
    skyTop: 0xffaacc, skyBottom: 0xaaccff,
    mountains: [0xddaacc, 0xccbbdd, 0xbbccee],
    ground: 0x88cc77, groundTop: 0xaaee99,
    platform: 0xcc88aa, platformTop: 0xeeaacc,
    player: 0xff6699, playerLight: 0xff99bb,
    coin: 0xffdd00, coinGlow: 0xff88ff,
    enemy: 0x9944cc, enemyLight: 0xbb66ee,
    foliage: 0x77cc55, foliageLight: 0x99ee77,
    ambient: 'pollen', weather: null,
  },
  arctic: {
    skyTop: 0x1a2a4a, skyBottom: 0x7799bb,
    mountains: [0x334455, 0x445566, 0x556677],
    ground: 0x889999, groundTop: 0xaabbcc,
    platform: 0x778899, platformTop: 0x99aabb,
    player: 0xff6644, playerLight: 0xff8866,
    coin: 0xffdd00, coinGlow: 0xffaa00,
    enemy: 0x4488cc, enemyLight: 0x66aaee,
    foliage: 0x446666, foliageLight: 0x668888,
    ambient: 'dust', weather: 'snow',
  },
  dark: {
    skyTop: 0x050510, skyBottom: 0x0a0a20,
    mountains: [0x0a0a15, 0x10101d, 0x151525],
    ground: 0x1a1a2a, groundTop: 0x2a2a3a,
    platform: 0x222233, platformTop: 0x333344,
    player: 0x00ccff, playerLight: 0x44eeff,
    coin: 0xffdd00, coinGlow: 0x00ff88,
    enemy: 0xff2244, enemyLight: 0xff4466,
    foliage: 0x1a2a1a, foliageLight: 0x2a3a2a,
    ambient: 'embers', weather: null,
  },
  ocean: {
    skyTop: 0x001133, skyBottom: 0x0055aa,
    mountains: [0x002244, 0x003355, 0x004466],
    ground: 0x224455, groundTop: 0x336677,
    platform: 0x335566, platformTop: 0x447788,
    player: 0xffaa33, playerLight: 0xffcc66,
    coin: 0xffdd00, coinGlow: 0x44ffaa,
    enemy: 0xcc44aa, enemyLight: 0xee66cc,
    foliage: 0x228855, foliageLight: 0x33aa77,
    ambient: 'dust', weather: null,
  },
};

// ============================================================================
// SEEDED NOISE (for procedural terrain variety)
// ============================================================================

var _noiseSeed = 42;
export function setNoiseSeed(s: number) { _noiseSeed = s; }
function _nhash(n: number): number { var s = Math.sin(n + _noiseSeed) * 43758.5453; return s - Math.floor(s); }
function _smoothstep(t: number): number { return t * t * (3 - 2 * t); }
function noise1D(x: number): number { var i = Math.floor(x), f = x - i; return _nhash(i) * (1 - _smoothstep(f)) + _nhash(i + 1) * _smoothstep(f); }
function fbm(x: number, octaves: number, persistence: number, lacunarity: number, exponent?: number): number {
  var total = 0, amplitude = 1, frequency = 1, maxVal = 0;
  for (var i = 0; i < octaves; i++) { total += noise1D(x * frequency) * amplitude; maxVal += amplitude; amplitude *= persistence; frequency *= lacunarity; }
  var v = total / maxVal;
  return exponent ? Math.pow(Math.max(v, 0), exponent) : v;
}

// Theme-specific noise profiles for mountain silhouettes
var MOUNTAIN_PROFILES: Record<string, { octaves: number; persistence: number; lacunarity: number; exponent: number; freq: number }> = {
  forest:   { octaves: 3, persistence: 0.45, lacunarity: 2.0, exponent: 0.8, freq: 0.008 },
  sunset:   { octaves: 3, persistence: 0.5,  lacunarity: 2.0, exponent: 0.9, freq: 0.006 },
  space:    { octaves: 5, persistence: 0.6,  lacunarity: 2.5, exponent: 1.8, freq: 0.012 },
  volcanic: { octaves: 5, persistence: 0.7,  lacunarity: 2.2, exponent: 2.0, freq: 0.010 },
  candy:    { octaves: 2, persistence: 0.3,  lacunarity: 2.0, exponent: 0.5, freq: 0.004 },
  arctic:   { octaves: 2, persistence: 0.25, lacunarity: 2.0, exponent: 0.6, freq: 0.005 },
  dark:     { octaves: 6, persistence: 0.75, lacunarity: 2.8, exponent: 2.5, freq: 0.015 },
  ocean:    { octaves: 3, persistence: 0.4,  lacunarity: 2.0, exponent: 0.7, freq: 0.007 },
};

// ============================================================================
// SKY & ATMOSPHERE
// ============================================================================

/** Smooth gradient sky with subtle light rays from horizon */
export function drawSkyGradient(worldW: number, worldH: number, topColor: number, bottomColor: number): any {
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  if (hasFillGradient()) {
    var grad = makeLinearGradient(topColor, bottomColor, worldH);
    g.rect(0, 0, worldW, worldH);
    g.fill(grad);
  } else {
    var strips = 48;
    var stripH = Math.ceil(worldH / strips);
    for (var i = 0; i < strips; i++) {
      var t = i / (strips - 1);
      var color = lerpColor(topColor, bottomColor, t);
      g.rect(0, i * stripH, worldW, stripH + 1);
      g.fill(color);
    }
  }
  container.addChild(g);
  // Subtle light rays from bottom-center
  var rays = new PIXI.Graphics();
  for (var ri = 0; ri < 8; ri++) {
    var angle = -0.6 + ri * 0.15;
    var rx = worldW * 0.5 + Math.sin(angle) * worldH * 1.2;
    var rw = 40 + ri * 15;
    rays.moveTo(worldW * 0.5, worldH);
    rays.lineTo(rx - rw, 0);
    rays.lineTo(rx + rw, 0);
    rays.closePath();
    rays.fill({ color: 0xffffff, alpha: 0.015 + Math.random() * 0.01 });
  }
  container.addChild(rays);
  return container;
}

/** Scattered star dots with varied sizes, alpha, and cross-sparkle on bright ones */
export function drawStars(worldW: number, skyH: number, count: number): any {
  var g = new PIXI.Graphics();
  for (var i = 0; i < count; i++) {
    var sx = Math.random() * worldW;
    var sy = Math.random() * skyH * 0.7;
    var sr = 0.5 + Math.random() * 1.5;
    var sa = 0.3 + Math.random() * 0.7;
    g.circle(sx, sy, sr);
    g.fill({ color: 0xffffff, alpha: sa });
    // Cross sparkle on brighter stars
    if (sa > 0.7 && sr > 1) {
      g.moveTo(sx - sr * 2, sy); g.lineTo(sx + sr * 2, sy);
      g.stroke({ color: 0xffffff, alpha: sa * 0.3, width: 0.5 });
      g.moveTo(sx, sy - sr * 2); g.lineTo(sx, sy + sr * 2);
      g.stroke({ color: 0xffffff, alpha: sa * 0.3, width: 0.5 });
    }
  }
  return g;
}

/** Noise-based mountain silhouettes — unique shapes per theme and layer.
 *  theme param drives the noise profile: rolling hills (forest), jagged peaks (volcanic), crystal spires (dark), etc. */
export function drawMountainRange(
  worldW: number, baseY: number, color: number, alpha: number,
  minH: number, maxH: number, spacing: number, theme?: string, layerIdx?: number
): any {
  var container = new PIXI.Container();
  var prof = MOUNTAIN_PROFILES[theme || 'forest'] || MOUNTAIN_PROFILES.forest;
  var seedOffset = (layerIdx || 0) * 1000; // different seed per parallax layer
  var step = 4; // sample every 4px for smooth curves

  // Generate height points from noise
  function _genProfile(yOff: number): number[] {
    var pts: number[] = [];
    for (var x = -20; x <= worldW + 20; x += step) {
      var h = fbm((x + seedOffset) * prof.freq, prof.octaves, prof.persistence, prof.lacunarity, prof.exponent);
      pts.push(baseY - minH - h * (maxH - minH) + yOff);
    }
    return pts;
  }

  // Draw a filled silhouette from height points
  function _drawSilhouette(g: any, pts: number[], fillStyle: any) {
    g.moveTo(-20, pts[0]);
    for (var i = 1; i < pts.length; i++) {
      var px = -20 + i * step;
      // Smooth with quadratic curves every other point
      if (i < pts.length - 1 && i % 2 === 0) {
        var nx = -20 + (i + 1) * step;
        g.quadraticCurveTo(px, pts[i], (px + nx) / 2, (pts[i] + pts[i + 1]) / 2);
      } else {
        g.lineTo(px, pts[i]);
      }
    }
    g.lineTo(worldW + 40, baseY + 60);
    g.lineTo(-20, baseY + 60);
    g.closePath();
    g.fill(fillStyle);
  }

  // Shadow layer
  var shadow = new PIXI.Graphics();
  var shadowPts = _genProfile(10);
  _drawSilhouette(shadow, shadowPts, { color: darken(color, 30), alpha: alpha * 0.35 });
  container.addChild(shadow);

  // Main silhouette
  var g = new PIXI.Graphics();
  var mainPts = _genProfile(0);
  var hillGrad = makeLinearGradient(lighten(color, 15), darken(color, 10), maxH);
  _drawSilhouette(g, mainPts, typeof hillGrad === 'number' ? { color: color, alpha: alpha } : hillGrad);
  container.addChild(g);

  // Highlight edge
  var hl = new PIXI.Graphics();
  hl.moveTo(-20, mainPts[0]);
  for (var hi = 1; hi < mainPts.length; hi++) {
    hl.lineTo(-20 + hi * step, mainPts[hi] + 2);
  }
  for (var hj = mainPts.length - 1; hj >= 0; hj--) {
    hl.lineTo(-20 + hj * step, mainPts[hj] - 1);
  }
  hl.closePath();
  hl.fill({ color: lighten(color, 30), alpha: alpha * 0.25 });
  container.addChild(hl);

  return container;
}

/** Puffy volumetric cloud with 3D shading — light top, shadowed bottom.
 *  Fallback chain: sprite → PIXI.Graphics */
export function drawCloud(w: number, h: number): any {
  // Tier 1: Pre-made sprite
  if (_hasSpriteLib()) {
    var spr = _getSprite('clouds', 'cloud_puffy');
    if (spr) { spr.width = w; spr.height = h; spr.anchor.set(0.5); return spr; }
  }
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  // Shadow base (darker, offset down)
  g.ellipse(0, h * 0.15, w * 0.48, h * 0.38);
  g.fill({ color: 0x8899aa, alpha: 0.08 });
  // Main cloud body — multiple overlapping puffy circles
  var puffs = [
    { x: 0, y: 0, rx: w * 0.42, ry: h * 0.4, a: 0.7 },
    { x: -w * 0.22, y: h * 0.05, rx: w * 0.3, ry: h * 0.32, a: 0.6 },
    { x: w * 0.22, y: h * 0.03, rx: w * 0.32, ry: h * 0.35, a: 0.6 },
    { x: -w * 0.1, y: -h * 0.12, rx: w * 0.25, ry: h * 0.25, a: 0.5 },
    { x: w * 0.12, y: -h * 0.1, rx: w * 0.22, ry: h * 0.22, a: 0.5 },
  ];
  for (var pi = 0; pi < puffs.length; pi++) {
    var p = puffs[pi];
    // Bottom shadow of each puff
    g.ellipse(p.x, p.y + h * 0.06, p.rx * 0.95, p.ry * 0.9);
    g.fill({ color: 0xaabbcc, alpha: p.a * 0.15 });
    // Main puff
    g.ellipse(p.x, p.y, p.rx, p.ry);
    g.fill({ color: 0xffffff, alpha: p.a * 0.25 });
    // Top highlight
    g.ellipse(p.x - p.rx * 0.1, p.y - p.ry * 0.2, p.rx * 0.5, p.ry * 0.4);
    g.fill({ color: 0xffffff, alpha: p.a * 0.12 });
  }
  container.addChild(g);
  if (PIXI.BlurFilter) {
    container.filters = [new PIXI.BlurFilter(4)];
  }
  return container;
}

// ============================================================================
// TERRAIN & PLATFORMS
// ============================================================================

/** Tree with 3D-shaded spherical canopy and textured trunk.
 *  Fallback chain: sprite → PIXI.Graphics */
export function drawTree(trunkH: number, leafR: number, trunkColor: number, leafColor: number): any {
  // Tier 1: Pre-made sprite
  if (_hasSpriteLib()) {
    var spr = _getSprite('trees', 'round_tree');
    if (spr) { spr.width = leafR * 2.5; spr.height = trunkH + leafR * 1.5; spr.anchor.set(0.5, 1); return spr; }
  }
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  // Trunk shadow
  g.roundRect(-4, -trunkH + 2, 12, trunkH, 3);
  g.fill({ color: 0x000000, alpha: 0.15 });
  // Trunk with gradient
  g.roundRect(-6, -trunkH, 12, trunkH, 3);
  var trunkGrad = makeLinearGradient(lighten(trunkColor, 25), darken(trunkColor, 25), trunkH);
  g.fill(trunkGrad);
  // Trunk highlight (left side light)
  g.roundRect(-5, -trunkH + 2, 4, trunkH - 4, 2);
  g.fill({ color: 0xffffff, alpha: 0.1 });
  // Bark texture lines
  for (var bi = 0; bi < trunkH; bi += 8 + Math.random() * 6) {
    g.moveTo(-4, -trunkH + bi);
    g.lineTo(4, -trunkH + bi + 2);
    g.stroke({ color: darken(trunkColor, 20), alpha: 0.2, width: 0.8 });
  }
  // Branch stubs
  g.moveTo(6, -trunkH * 0.4);
  g.lineTo(12, -trunkH * 0.5);
  g.stroke({ color: trunkColor, width: 3 });
  g.moveTo(-6, -trunkH * 0.6);
  g.lineTo(-10, -trunkH * 0.68);
  g.stroke({ color: trunkColor, width: 2.5 });
  // Canopy — 3D shaded spheres (dark bottom, bright top)
  // Back canopy (darker, larger)
  g.circle(0, -trunkH - leafR * 0.1, leafR * 1.05);
  g.fill(darken(leafColor, 25));
  // Main canopy sphere
  g.circle(0, -trunkH, leafR);
  var canopyGrad = makeRadialGradient(lighten(leafColor, 20), darken(leafColor, 20), leafR);
  g.fill(canopyGrad);
  // Left sub-sphere
  g.circle(-leafR * 0.5, -trunkH + leafR * 0.1, leafR * 0.6);
  var subGrad1 = makeRadialGradient(lighten(leafColor, 10), darken(leafColor, 15), leafR * 0.6);
  g.fill(subGrad1);
  // Right sub-sphere
  g.circle(leafR * 0.4, -trunkH - leafR * 0.15, leafR * 0.55);
  var subGrad2 = makeRadialGradient(lighten(leafColor, 15), darken(leafColor, 10), leafR * 0.55);
  g.fill(subGrad2);
  // Top puff
  g.circle(leafR * 0.1, -trunkH - leafR * 0.6, leafR * 0.45);
  var topGrad = makeRadialGradient(lighten(leafColor, 30), leafColor, leafR * 0.45);
  g.fill(topGrad);
  // Specular highlight (top-left)
  g.ellipse(-leafR * 0.2, -trunkH - leafR * 0.35, leafR * 0.25, leafR * 0.18);
  g.fill({ color: 0xffffff, alpha: 0.15 });
  // Bottom shadow on canopy
  g.ellipse(0, -trunkH + leafR * 0.7, leafR * 0.7, leafR * 0.15);
  g.fill({ color: 0x000000, alpha: 0.08 });
  container.addChild(g);
  return container;
}

/** Ground strip with organic curved top, rich gradient, thick grass */
/** Multi-layer terrain with wavy top edge and theme-specific surface details.
 *  theme param drives surface style: grass tufts, snow drifts, lava cracks, sprinkles, etc. */
export function drawGroundStrip(
  worldW: number, groundY: number, floorH: number, color: number, topColor: number, theme?: string
): any {
  var th = theme || 'forest';

  // Tier 1: Sprite-based tiled ground
  if (_hasSpriteLib()) {
    var groundPrefix = _themeGroundMap[th] || 'grass';
    var topTile = _getTilingSprite('ground', groundPrefix + '_top', worldW, 64);
    var fillTile = _getTilingSprite('ground', 'dirt_fill', worldW, Math.max(floorH - 64, 0));
    if (topTile && fillTile) {
      var sprContainer = new PIXI.Container();
      topTile.x = 0;
      topTile.y = groundY - 8;
      sprContainer.addChild(topTile);
      fillTile.x = 0;
      fillTile.y = groundY + 56;
      sprContainer.addChild(fillTile);
      // Dark bottom gradient overlay
      var darkOverlay = new PIXI.Graphics();
      darkOverlay.rect(0, groundY + floorH * 0.6, worldW, floorH * 0.4);
      darkOverlay.fill({ color: 0x000000, alpha: 0.15 });
      sprContainer.addChild(darkOverlay);
      return sprContainer;
    }
  }

  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  var step = 6;
  // Generate wavy top edge with noise
  var edgeFreq = th === 'candy' ? 0.003 : th === 'arctic' ? 0.004 : th === 'volcanic' ? 0.012 : 0.008;
  var edgeAmp = th === 'candy' ? 3 : th === 'arctic' ? 5 : th === 'volcanic' ? 6 : 8;

  // Wavy top surface
  g.moveTo(0, groundY + edgeAmp);
  for (var x = 0; x <= worldW; x += step) {
    var ey = groundY + noise1D(x * edgeFreq + 100) * edgeAmp;
    g.lineTo(x, ey);
  }
  g.lineTo(worldW, groundY + floorH);
  g.lineTo(0, groundY + floorH);
  g.closePath();
  var groundGrad = makeLinearGradient(color, darken(color, 50), floorH);
  g.fill(groundGrad);

  // Second layer — subsurface stripe with different wave
  var g2 = new PIXI.Graphics();
  var subY = groundY + 12;
  g2.moveTo(0, subY);
  for (var x2 = 0; x2 <= worldW; x2 += step) {
    g2.lineTo(x2, subY + noise1D(x2 * 0.006 + 500) * 4);
  }
  g2.lineTo(worldW, groundY + floorH);
  g2.lineTo(0, groundY + floorH);
  g2.closePath();
  g2.fill({ color: darken(color, 15), alpha: 0.5 });
  container.addChild(g);
  container.addChild(g2);

  // Third layer — deep bedrock
  var g3 = new PIXI.Graphics();
  g3.rect(0, groundY + floorH * 0.5, worldW, floorH * 0.5);
  g3.fill({ color: darken(color, 40), alpha: 0.4 });
  container.addChild(g3);

  // Top surface strip
  var gs = new PIXI.Graphics();
  gs.moveTo(0, groundY - 2 + noise1D(100) * edgeAmp * 0.3);
  for (var xs = 0; xs <= worldW; xs += step) {
    gs.lineTo(xs, groundY - 2 + noise1D(xs * edgeFreq + 100) * edgeAmp * 0.3);
  }
  for (var xr = worldW; xr >= 0; xr -= step) {
    gs.lineTo(xr, groundY + 8 + noise1D(xr * edgeFreq + 100) * edgeAmp * 0.3);
  }
  gs.closePath();
  gs.fill(topColor);
  container.addChild(gs);

  // Theme-specific surface details
  var detail = new PIXI.Graphics();
  switch (th) {
    case 'volcanic':
      // Lava cracks in ground
      for (var lx = 20; lx < worldW; lx += 40 + noise1D(lx * 0.1) * 60) {
        detail.moveTo(lx, groundY + 2);
        detail.lineTo(lx + 10 + noise1D(lx * 0.05) * 15, groundY + 6);
        detail.lineTo(lx + 25 + noise1D(lx * 0.07) * 20, groundY + 3);
        detail.stroke({ color: 0xff4400, alpha: 0.5 + noise1D(lx * 0.02) * 0.3, width: 2 });
        // Glow dots at crack intersections
        detail.circle(lx + 10, groundY + 5, 2);
        detail.fill({ color: 0xff6600, alpha: 0.4 });
      }
      break;
    case 'arctic':
      // Snow drifts — soft overlapping ellipses
      for (var sx = 0; sx < worldW; sx += 30 + noise1D(sx * 0.05) * 40) {
        var sw = 20 + noise1D(sx * 0.03) * 30;
        detail.ellipse(sx, groundY - 1, sw, 4 + noise1D(sx * 0.04) * 3);
        detail.fill({ color: 0xeef4ff, alpha: 0.5 + noise1D(sx * 0.06) * 0.3 });
      }
      break;
    case 'candy':
      // Frosting drips + sprinkles
      for (var cx = 5; cx < worldW; cx += 15 + noise1D(cx * 0.1) * 10) {
        var ch = 4 + noise1D(cx * 0.08) * 8;
        detail.moveTo(cx, groundY - 2);
        detail.quadraticCurveTo(cx + 2, groundY + ch, cx + 4, groundY - 2);
        detail.fill({ color: 0xffffff, alpha: 0.6 });
      }
      var sprColors = [0xff6699, 0x66ccff, 0xffcc33, 0x66ff99, 0xff66ff];
      for (var sp = 0; sp < worldW; sp += 12 + noise1D(sp * 0.15) * 8) {
        detail.circle(sp, groundY - 3 + noise1D(sp * 0.1) * 2, 1.5);
        detail.fill(sprColors[Math.floor(noise1D(sp * 0.2) * sprColors.length)]);
      }
      break;
    case 'space':
      // Glowing circuit lines
      for (var slx = 30; slx < worldW; slx += 50 + noise1D(slx * 0.05) * 60) {
        detail.moveTo(slx, groundY + 3);
        detail.lineTo(slx + 15, groundY + 3);
        detail.lineTo(slx + 15, groundY + 10);
        detail.lineTo(slx + 30, groundY + 10);
        detail.stroke({ color: 0x4488ff, alpha: 0.35, width: 1.5 });
        detail.circle(slx + 15, groundY + 3, 2);
        detail.fill({ color: 0x4488ff, alpha: 0.5 });
      }
      break;
    case 'dark':
      // Purple mist wisps
      for (var dmx = 0; dmx < worldW; dmx += 25 + noise1D(dmx * 0.04) * 35) {
        detail.ellipse(dmx, groundY - 2, 18 + noise1D(dmx * 0.03) * 12, 5);
        detail.fill({ color: 0x6633aa, alpha: 0.1 + noise1D(dmx * 0.05) * 0.08 });
      }
      break;
    case 'ocean':
      // Seafoam bubbles along shore
      for (var ox = 0; ox < worldW; ox += 8 + noise1D(ox * 0.1) * 12) {
        var or = 1.5 + noise1D(ox * 0.08) * 3;
        detail.circle(ox, groundY - 1 + noise1D(ox * 0.12) * 3, or);
        detail.fill({ color: 0xaaddff, alpha: 0.2 + noise1D(ox * 0.06) * 0.15 });
      }
      break;
    default: // forest, sunset
      // Grass tufts
      for (var gx = 0; gx < worldW; gx += 6 + noise1D(gx * 0.15) * 5) {
        var gh = 5 + noise1D(gx * 0.1) * 12;
        var gw = 2 + noise1D(gx * 0.2) * 2;
        detail.moveTo(gx, groundY - 2);
        detail.quadraticCurveTo(gx + gw * 0.5, groundY - gh * 0.6, gx + gw * 0.3, groundY - gh);
        detail.quadraticCurveTo(gx + gw, groundY - gh * 0.4, gx + gw + 1, groundY - 2);
        detail.closePath();
        detail.fill(noise1D(gx * 0.3) > 0.3 ? topColor : lighten(topColor, 15));
      }
      break;
  }
  container.addChild(detail);

  // Strata lines (subtle geological layers)
  var strata = new PIXI.Graphics();
  for (var sty = groundY + 20; sty < groundY + floorH - 10; sty += 12 + noise1D(sty * 0.1) * 10) {
    strata.moveTo(0, sty);
    for (var stx = 0; stx <= worldW; stx += 20) {
      strata.lineTo(stx, sty + noise1D(stx * 0.01 + sty) * 3);
    }
    strata.stroke({ color: darken(color, 15), alpha: 0.1, width: 1 });
  }
  container.addChild(strata);

  return container;
}

/** Theme-dispatched platform shapes — each theme gets a unique visual style.
 *  Fallback chain: sprite → theme-specific PIXI.Graphics */
export function drawPlatformBlock(w: number, h: number, mainColor: number, topColor: number, theme?: string): any {
  // Tier 1: Theme-aware sprite platform
  if (_hasSpriteLib()) {
    var th = theme || 'forest';
    var platName = _themePlatformMap[th] || 'grass_block';
    var spr = _getSprite('platforms', platName);
    if (spr) { spr.width = w; spr.height = h; spr.anchor.set(0.5); return spr; }
  }
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  var th = theme || 'forest';

  // Base platform body (all themes share this foundation)
  var bw = 3;
  g.roundRect(-w / 2 - bw, -h / 2 - bw, w + bw * 2, h + bw * 2, 8);
  g.fill(darken(mainColor, 35));
  g.roundRect(-w / 2, -h / 2, w, h, 6);
  var platGrad = makeLinearGradient(lighten(mainColor, 20), darken(mainColor, 10), h);
  g.fill(platGrad);

  // Theme-specific decorations on top of base
  switch (th) {
    case 'volcanic': {
      // Jagged rock top + ember glow cracks
      g.moveTo(-w / 2 - 2, -h / 2);
      for (var vx = -w / 2; vx < w / 2; vx += 8 + Math.random() * 6) {
        g.lineTo(vx, -h / 2 - 2 - Math.random() * 6);
        g.lineTo(vx + 4, -h / 2);
      }
      g.lineTo(w / 2 + 2, -h / 2);
      g.lineTo(-w / 2 - 2, -h / 2);
      g.closePath();
      g.fill(darken(mainColor, 15));
      // Lava cracks
      for (var vlx = -w / 2 + 10; vlx < w / 2 - 10; vlx += 20 + Math.random() * 25) {
        g.moveTo(vlx, -h / 2 + 3);
        g.lineTo(vlx + 5 + Math.random() * 8, h / 2 - 3);
        g.stroke({ color: 0xff4400, alpha: 0.4, width: 1.5 });
      }
      break;
    }
    case 'arctic': {
      // Ice surface + icicle drips below
      g.roundRect(-w / 2 - 1, -h / 2 - 3, w + 2, 6, 3);
      g.fill({ color: 0xeef4ff, alpha: 0.7 });
      g.roundRect(-w / 2, -h / 2 - 3, w, 2, 2);
      g.fill({ color: 0xffffff, alpha: 0.5 });
      // Icicles
      var icicleCount = Math.floor(w / 18);
      for (var ic = 0; ic < icicleCount; ic++) {
        var ix = -w / 2 + (ic + 0.5) * (w / icicleCount) + (Math.random() - 0.5) * 5;
        var iLen = 6 + Math.random() * 16;
        var iW = 1.5 + Math.random() * 2;
        g.moveTo(ix - iW, h / 2);
        g.quadraticCurveTo(ix - iW * 0.3, h / 2 + iLen * 0.6, ix, h / 2 + iLen);
        g.quadraticCurveTo(ix + iW * 0.3, h / 2 + iLen * 0.6, ix + iW, h / 2);
        g.closePath();
        g.fill({ color: 0xccddff, alpha: 0.6 });
      }
      break;
    }
    case 'candy': {
      // Frosted wafer with sprinkle dots
      g.roundRect(-w / 2 - 2, -h / 2 - 5, w + 4, 8, 4);
      g.fill(0xffffff); // white frosting
      // Wavy frosting drips
      for (var cdx = -w / 2 + 5; cdx < w / 2 - 5; cdx += 10 + Math.random() * 8) {
        var cdh = 3 + Math.random() * 6;
        g.moveTo(cdx, -h / 2 + 2);
        g.quadraticCurveTo(cdx + 3, -h / 2 + cdh + 2, cdx + 6, -h / 2 + 2);
        g.fill({ color: 0xffffff, alpha: 0.8 });
      }
      // Sprinkle dots on top
      var sprC = [0xff6699, 0x66ccff, 0xffcc33, 0x66ff99, 0xff66ff];
      for (var spx = -w / 2 + 8; spx < w / 2 - 8; spx += 6 + Math.random() * 5) {
        g.circle(spx, -h / 2 - 2 + Math.random() * 3, 1.2);
        g.fill(sprC[Math.floor(Math.random() * sprC.length)]);
      }
      break;
    }
    case 'space': {
      // Holographic energy platform
      g.roundRect(-w / 2, -h / 2 - 2, w, 3, 1);
      g.fill({ color: 0x4488ff, alpha: 0.6 });
      g.roundRect(-w / 2, h / 2 - 1, w, 3, 1);
      g.fill({ color: 0x4488ff, alpha: 0.4 });
      // Scan lines
      for (var sly = -h / 2 + 4; sly < h / 2; sly += 4) {
        g.rect(-w / 2 + 2, sly, w - 4, 1);
        g.fill({ color: 0x6699ff, alpha: 0.08 });
      }
      // Corner dots
      g.circle(-w / 2 + 4, -h / 2 + 4, 2); g.fill({ color: 0x44aaff, alpha: 0.7 });
      g.circle(w / 2 - 4, -h / 2 + 4, 2); g.fill({ color: 0x44aaff, alpha: 0.7 });
      break;
    }
    case 'dark': {
      // Crystal slab — faceted edges + purple glow
      g.moveTo(-w / 2, -h / 2 + 3);
      g.lineTo(-w / 2 + 6, -h / 2 - 4);
      g.lineTo(w / 2 - 6, -h / 2 - 4);
      g.lineTo(w / 2, -h / 2 + 3);
      g.lineTo(w / 2, -h / 2);
      g.lineTo(-w / 2, -h / 2);
      g.closePath();
      g.fill({ color: lighten(mainColor, 30), alpha: 0.5 });
      // Glowing veins
      for (var dvx = -w / 2 + 15; dvx < w / 2 - 15; dvx += 25 + Math.random() * 20) {
        g.moveTo(dvx, -h / 2 + 2);
        g.lineTo(dvx + 3, h / 2 - 2);
        g.stroke({ color: 0x8844cc, alpha: 0.35, width: 1 });
      }
      break;
    }
    case 'ocean': {
      // Coral shelf with barnacle bumps
      g.roundRect(-w / 2 - 2, -h / 2 - 3, w + 4, 6, 3);
      g.fill(lighten(mainColor, 15));
      // Barnacle bumps along bottom
      for (var bx = -w / 2 + 6; bx < w / 2 - 6; bx += 8 + Math.random() * 6) {
        var br = 2 + Math.random() * 3;
        g.circle(bx, h / 2, br);
        g.fill(darken(mainColor, 20));
        g.circle(bx, h / 2, br * 0.4);
        g.fill({ color: lighten(mainColor, 10), alpha: 0.5 });
      }
      // Seaweed strand hanging
      if (Math.random() > 0.4) {
        var swx = -w / 4 + Math.random() * w / 2;
        g.moveTo(swx, h / 2);
        g.quadraticCurveTo(swx + 8, h / 2 + 15, swx - 2, h / 2 + 25);
        g.stroke({ color: 0x228855, alpha: 0.5, width: 2 });
      }
      break;
    }
    default: { // forest, sunset
      // Classic grass lip + tufts
      g.roundRect(-w / 2 - 2, -h / 2 - 4, w + 4, 8, 4);
      g.fill(topColor);
      g.roundRect(-w / 2 - 1, -h / 2 - 4, w + 2, 3, 3);
      g.fill(lighten(topColor, 20));
      for (var gx = -w / 2 + 5; gx < w / 2 - 5; gx += 6 + Math.random() * 4) {
        var gh = 4 + Math.random() * 8;
        g.moveTo(gx, -h / 2 - 4);
        g.quadraticCurveTo(gx + 1, -h / 2 - gh * 0.7, gx + 0.5, -h / 2 - gh);
        g.quadraticCurveTo(gx + 2, -h / 2 - gh * 0.3, gx + 3, -h / 2 - 4);
        g.closePath();
        g.fill(Math.random() > 0.4 ? topColor : lighten(topColor, 12));
      }
      break;
    }
  }

  // Specular dot
  g.circle(-w / 4, -h / 4, 2);
  g.fill({ color: 0xffffff, alpha: 0.2 });
  container.addChild(g);
  if (hasFilters()) {
    container.filters = [new PIXI.filters.DropShadowFilter({
      offset: { x: 4, y: 6 }, blur: 8, alpha: 0.45, color: 0x000000,
    })];
  }
  return container;
}

// ============================================================================
// CHARACTERS & ENTITIES
// ============================================================================

/** Professional character with round body, 3D shading, expressive face.
 *  Fallback chain: AnimatedSprite → static sprite → Canvas 2D → PIXI.Graphics */
export function drawPlayerCharacter(size: number, bodyColor: number, lightColor: number): any {
  // Tier 1: 3D-rendered animated sprite sheet
  if (_hasSpriteLib()) {
    var anim = _getAnimatedSprite('hero', 'idle');
    if (anim) { anim.width = size; anim.height = size * 1.2; return anim; }
  }
  // Tier 2: Static pre-made sprite
  if (_hasSpriteLib()) {
    var spr2 = _getSprite('characters', 'player_idle');
    if (spr2) { spr2.width = size; spr2.height = size * 1.2; return spr2; }
  }
  // Tier 3: Canvas 2D (volumetric 3D shading)
  if (hasCanvas()) {
    try { return _drawPlayerCanvas(size, bodyColor, lightColor); } catch(e) {}
  }
  // Tier 4: PIXI.Graphics fallback (original code below)
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  var s = size;
  // Ground shadow
  g.ellipse(0, s * 0.48, s * 0.28, s * 0.06);
  g.fill({ color: 0x000000, alpha: 0.2 });
  // Feet (round, behind body)
  g.ellipse(-s * 0.16, s * 0.42, s * 0.12, s * 0.07);
  g.fill(darken(bodyColor, 45));
  g.ellipse(-s * 0.16, s * 0.40, s * 0.10, s * 0.04);
  g.fill({ color: 0xffffff, alpha: 0.08 });
  g.ellipse(s * 0.16, s * 0.42, s * 0.12, s * 0.07);
  g.fill(darken(bodyColor, 45));
  g.ellipse(s * 0.16, s * 0.40, s * 0.10, s * 0.04);
  g.fill({ color: 0xffffff, alpha: 0.08 });
  // Body — round blob with 3D gradient
  g.roundRect(-s * 0.3, -s * 0.18, s * 0.6, s * 0.62, s * 0.2);
  var bodyGrad = makeLinearGradient(lightColor, darken(bodyColor, 20), s * 0.62);
  g.fill(bodyGrad);
  // Body inner shadow (bottom)
  g.ellipse(0, s * 0.28, s * 0.25, s * 0.1);
  g.fill({ color: darken(bodyColor, 30), alpha: 0.2 });
  // Body specular highlight (top-left)
  g.ellipse(-s * 0.1, -s * 0.05, s * 0.12, s * 0.18);
  g.fill({ color: 0xffffff, alpha: 0.15 });
  // Head — sphere with gradient
  g.circle(0, -s * 0.35, s * 0.26);
  var headGrad = makeRadialGradient(lighten(bodyColor, 15), darken(bodyColor, 10), s * 0.26);
  g.fill(headGrad);
  // Head specular highlight
  g.ellipse(-s * 0.07, -s * 0.44, s * 0.1, s * 0.07);
  g.fill({ color: 0xffffff, alpha: 0.18 });
  // Hat/cap with shading
  g.roundRect(-s * 0.22, -s * 0.63, s * 0.44, s * 0.14, 5);
  var hatGrad = makeLinearGradient(darken(bodyColor, 20), darken(bodyColor, 40), s * 0.14);
  g.fill(hatGrad);
  g.roundRect(-s * 0.3, -s * 0.54, s * 0.6, s * 0.07, 4);
  g.fill(darken(bodyColor, 30));
  // Hat highlight
  g.roundRect(-s * 0.18, -s * 0.62, s * 0.2, s * 0.04, 2);
  g.fill({ color: 0xffffff, alpha: 0.12 });
  // Eyes — larger, more expressive
  g.circle(-s * 0.1, -s * 0.36, s * 0.08);
  g.fill(0xffffff);
  g.circle(s * 0.1, -s * 0.36, s * 0.08);
  g.fill(0xffffff);
  // Eye inner shadow
  g.ellipse(-s * 0.1, -s * 0.33, s * 0.07, s * 0.04);
  g.fill({ color: 0xddddee, alpha: 0.3 });
  g.ellipse(s * 0.1, -s * 0.33, s * 0.07, s * 0.04);
  g.fill({ color: 0xddddee, alpha: 0.3 });
  // Pupils — with direction
  g.circle(-s * 0.07, -s * 0.36, s * 0.04);
  g.fill(0x111122);
  g.circle(s * 0.13, -s * 0.36, s * 0.04);
  g.fill(0x111122);
  // Eye shine — dual highlights per eye
  g.circle(-s * 0.09, -s * 0.39, s * 0.022);
  g.fill({ color: 0xffffff, alpha: 0.9 });
  g.circle(-s * 0.05, -s * 0.37, s * 0.012);
  g.fill({ color: 0xffffff, alpha: 0.6 });
  g.circle(s * 0.11, -s * 0.39, s * 0.022);
  g.fill({ color: 0xffffff, alpha: 0.9 });
  g.circle(s * 0.15, -s * 0.37, s * 0.012);
  g.fill({ color: 0xffffff, alpha: 0.6 });
  // Smile
  g.moveTo(-s * 0.06, -s * 0.24);
  g.quadraticCurveTo(0, -s * 0.18, s * 0.06, -s * 0.24);
  g.stroke({ color: darken(bodyColor, 55), width: 2 });
  // Rosy cheeks
  g.ellipse(-s * 0.15, -s * 0.27, s * 0.04, s * 0.025);
  g.fill({ color: 0xff6688, alpha: 0.15 });
  g.ellipse(s * 0.15, -s * 0.27, s * 0.04, s * 0.025);
  g.fill({ color: 0xff6688, alpha: 0.15 });
  container.addChild(g);
  if (hasFilters()) {
    container.filters = [new PIXI.filters.OutlineFilter({
      thickness: 3, color: darken(bodyColor, 80),
    })];
  }
  return container;
}

/** Coin with 3D depth, strong radial gradient, and real glow.
 *  Fallback chain: sprite → Canvas 2D → PIXI.Graphics */
export function drawCoinToken(radius: number, color: number, glowColor: number): any {
  // Tier 1: Pre-made sprite
  if (_hasSpriteLib()) {
    var spr = _getSprite('collectibles', 'coin_gold');
    if (spr) { spr.width = radius * 2; spr.height = radius * 2; spr.anchor.set(0.5); return spr; }
  }
  // Tier 2: Canvas 2D (golden 3D shading + glow)
  if (hasCanvas()) {
    try { return _drawCoinCanvas(radius, color, glowColor); } catch(e) {}
  }
  // Tier 3: PIXI.Graphics fallback
  var container = new PIXI.Container();
  var coin = new PIXI.Graphics();
  // Outer ring (darker edge)
  coin.circle(0, 0, radius);
  coin.fill(darken(color, 20));
  // Inner coin face with radial gradient
  coin.circle(0, 0, radius * 0.88);
  var coinGrad = makeRadialGradient(lighten(color, 50), color, radius * 0.88);
  coin.fill(coinGrad);
  // Inner ring detail
  coin.circle(0, 0, radius * 0.65);
  coin.stroke({ color: darken(color, 15), alpha: 0.3, width: 1 });
  // Dollar/star symbol in center
  coin.moveTo(0, -radius * 0.25);
  coin.lineTo(0, radius * 0.25);
  coin.stroke({ color: darken(color, 20), alpha: 0.3, width: 1.5 });
  coin.moveTo(-radius * 0.15, -radius * 0.15);
  coin.lineTo(radius * 0.15, radius * 0.15);
  coin.stroke({ color: darken(color, 20), alpha: 0.2, width: 1 });
  // Specular highlight (bright spot top-left)
  coin.ellipse(-radius * 0.2, -radius * 0.22, radius * 0.22, radius * 0.15);
  coin.fill({ color: 0xffffff, alpha: 0.4 });
  // Small sparkle
  coin.circle(radius * 0.15, -radius * 0.3, radius * 0.08);
  coin.fill({ color: 0xffffff, alpha: 0.6 });
  container.addChild(coin);
  if (hasFilters()) {
    container.filters = [new PIXI.filters.GlowFilter({
      distance: radius * 1.5, outerStrength: 3.5, innerStrength: 0.5,
      color: glowColor,
    })];
  } else {
    var glow = new PIXI.Graphics();
    glow.circle(0, 0, radius * 2.0);
    glow.fill({ color: glowColor, alpha: 0.2 });
    glow.circle(0, 0, radius * 1.5);
    glow.fill({ color: glowColor, alpha: 0.15 });
    container.addChildAt(glow, 0);
  }
  return container;
}

/** Slime enemy — organic blob with 3D shading, expressive angry face.
 *  Fallback chain: AnimatedSprite → sprite → Canvas 2D → PIXI.Graphics */
export function drawEnemySlime(size: number, color: number, lightColor: number): any {
  // Tier 1: 3D-rendered animated sprite
  if (_hasSpriteLib()) {
    var anim = _getAnimatedSprite('slime', 'idle');
    if (anim) { anim.width = size; anim.height = size; return anim; }
  }
  // Tier 2: Static sprite
  if (_hasSpriteLib()) {
    var spr = _getSprite('characters', 'slime_idle');
    if (spr) { spr.width = size; spr.height = size; spr.anchor.set(0.5); return spr; }
  }
  // Tier 3: Canvas 2D (volumetric blob shading)
  if (hasCanvas()) {
    try { return _drawSlimeCanvas(size, color, lightColor); } catch(e) {}
  }
  // Tier 4: PIXI.Graphics fallback
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  var s = size;
  // Ground shadow
  g.ellipse(0, s * 0.42, s * 0.35, s * 0.06);
  g.fill({ color: 0x000000, alpha: 0.2 });
  // Body blob with organic curves — dark underside
  g.ellipse(0, s * 0.15, s * 0.42, s * 0.3);
  g.fill(darken(color, 20));
  // Main body with radial gradient (3D sphere look)
  g.ellipse(0, s * 0.08, s * 0.4, s * 0.34);
  var bodyGrad = makeRadialGradient(lightColor, darken(color, 10), s * 0.4);
  g.fill(bodyGrad);
  // Top bump — creates rounded top
  g.circle(0, -s * 0.15, s * 0.27);
  var topGrad = makeRadialGradient(lighten(color, 10), color, s * 0.27);
  g.fill(topGrad);
  // Body specular highlight (top-left)
  g.ellipse(-s * 0.1, -s * 0.2, s * 0.13, s * 0.09);
  g.fill({ color: 0xffffff, alpha: 0.2 });
  // Small secondary highlight
  g.circle(-s * 0.18, -s * 0.08, s * 0.05);
  g.fill({ color: 0xffffff, alpha: 0.12 });
  // Eyes — larger, angrier
  g.circle(-s * 0.11, -s * 0.1, s * 0.09);
  g.fill(0xffffff);
  g.circle(s * 0.11, -s * 0.1, s * 0.09);
  g.fill(0xffffff);
  // Eye shadows
  g.ellipse(-s * 0.11, -s * 0.07, s * 0.08, s * 0.04);
  g.fill({ color: 0xddddee, alpha: 0.25 });
  g.ellipse(s * 0.11, -s * 0.07, s * 0.08, s * 0.04);
  g.fill({ color: 0xddddee, alpha: 0.25 });
  // Angry pupils
  g.circle(-s * 0.09, -s * 0.09, s * 0.045);
  g.fill(0x111111);
  g.circle(s * 0.13, -s * 0.09, s * 0.045);
  g.fill(0x111111);
  // Eye shine
  g.circle(-s * 0.11, -s * 0.13, s * 0.02);
  g.fill({ color: 0xffffff, alpha: 0.85 });
  g.circle(s * 0.11, -s * 0.13, s * 0.02);
  g.fill({ color: 0xffffff, alpha: 0.85 });
  // Angry brows — thicker
  g.moveTo(-s * 0.2, -s * 0.24);
  g.lineTo(-s * 0.04, -s * 0.17);
  g.stroke({ color: darken(color, 65), width: 2.5 });
  g.moveTo(s * 0.2, -s * 0.24);
  g.lineTo(s * 0.04, -s * 0.17);
  g.stroke({ color: darken(color, 65), width: 2.5 });
  // Mouth — open angry
  g.moveTo(-s * 0.08, s * 0.02);
  g.quadraticCurveTo(0, s * 0.1, s * 0.08, s * 0.02);
  g.fill(darken(color, 50));
  // Teeth
  g.moveTo(-s * 0.04, s * 0.02);
  g.lineTo(-s * 0.02, s * 0.06);
  g.lineTo(0, s * 0.02);
  g.fill(0xffffff);
  g.moveTo(0, s * 0.02);
  g.lineTo(s * 0.02, s * 0.06);
  g.lineTo(s * 0.04, s * 0.02);
  g.fill(0xffffff);
  container.addChild(g);
  if (hasFilters()) {
    container.filters = [new PIXI.filters.OutlineFilter({
      thickness: 2.5, color: darken(color, 70),
    })];
  }
  return container;
}

/** Heart shape with 3D shading for lives display.
 *  Fallback chain: sprite → PIXI.Graphics */
export function drawHeart(size: number, color: number): any {
  // Tier 1: Pre-made sprite
  if (_hasSpriteLib()) {
    var spr = _getSprite('collectibles', 'heart');
    if (spr) { spr.width = size; spr.height = size; spr.anchor.set(0.5); return spr; }
  }
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  var s = size;
  // Shadow
  g.moveTo(1, s * 0.32);
  g.bezierCurveTo(-s * 0.48, -s * 0.08, -s * 0.48, -s * 0.48, 1, -s * 0.18);
  g.bezierCurveTo(s * 0.52, -s * 0.48, s * 0.52, -s * 0.08, 1, s * 0.32);
  g.fill({ color: 0x000000, alpha: 0.2 });
  // Main heart
  g.moveTo(0, s * 0.3);
  g.bezierCurveTo(-s * 0.5, -s * 0.1, -s * 0.5, -s * 0.5, 0, -s * 0.2);
  g.bezierCurveTo(s * 0.5, -s * 0.5, s * 0.5, -s * 0.1, 0, s * 0.3);
  var heartGrad = makeLinearGradient(lighten(color, 25), darken(color, 15), s * 0.8);
  g.fill(heartGrad);
  // Specular highlight
  g.ellipse(-s * 0.12, -s * 0.22, s * 0.1, s * 0.08);
  g.fill({ color: 0xffffff, alpha: 0.35 });
  g.circle(-s * 0.08, -s * 0.28, s * 0.04);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  container.addChild(g);
  return container;
}

/** Hexagonal gem with 3D faceted look and strong glow.
 *  Fallback chain: sprite → PIXI.Graphics */
export function drawGemShape(radius: number, color: number): any {
  // Tier 1: Pre-made sprite
  if (_hasSpriteLib()) {
    var gemName = color === 0xff3333 ? 'gem_red' : color === 0x3333ff ? 'gem_blue' : 'gem_red';
    var spr = _getSprite('collectibles', gemName);
    if (spr) { spr.width = radius * 2; spr.height = radius * 2; spr.anchor.set(0.5); return spr; }
  }
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  // Shadow
  g.regularPoly(2, 2, radius, 6);
  g.fill({ color: 0x000000, alpha: 0.2 });
  // Dark base
  g.regularPoly(0, 0, radius, 6);
  g.fill(darken(color, 20));
  // Inner facet with gradient
  g.regularPoly(0, 0, radius * 0.85, 6);
  var gemGrad = makeRadialGradient(lighten(color, 50), darken(color, 5), radius * 0.85);
  g.fill(gemGrad);
  // Inner facet highlight ring
  g.regularPoly(0, -radius * 0.05, radius * 0.55, 6);
  g.fill({ color: 0xffffff, alpha: 0.12 });
  // Top facet shine
  g.ellipse(-radius * 0.15, -radius * 0.25, radius * 0.2, radius * 0.12);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  // Small sparkle
  g.circle(radius * 0.12, -radius * 0.32, radius * 0.06);
  g.fill({ color: 0xffffff, alpha: 0.7 });
  container.addChild(g);
  if (hasFilters()) {
    container.filters = [new PIXI.filters.GlowFilter({
      distance: radius * 1.2, outerStrength: 3.0, innerStrength: 0.5, color: color,
    })];
  }
  return container;
}

/** Ship with gradient body, engine glow, and wing detail */
export function drawShipShape(size: number, color: number, lightColor: number): any {
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  var s = size;
  // Engine glow (behind ship)
  g.ellipse(0, s * 0.42, s * 0.12, s * 0.2);
  g.fill({ color: 0xff6600, alpha: 0.35 });
  g.ellipse(0, s * 0.38, s * 0.08, s * 0.12);
  g.fill({ color: 0xffaa00, alpha: 0.5 });
  // Wing shadows
  g.moveTo(-s * 0.47, s * 0.32);
  g.lineTo(-s * 0.15, -s * 0.08);
  g.lineTo(-s * 0.15, s * 0.32);
  g.closePath();
  g.fill(darken(color, 25));
  g.moveTo(s * 0.47, s * 0.32);
  g.lineTo(s * 0.15, -s * 0.08);
  g.lineTo(s * 0.15, s * 0.32);
  g.closePath();
  g.fill(darken(color, 25));
  // Wings with gradient
  g.moveTo(-s * 0.45, s * 0.3);
  g.lineTo(-s * 0.15, -s * 0.1);
  g.lineTo(-s * 0.15, s * 0.3);
  g.closePath();
  g.fill(color);
  g.moveTo(s * 0.45, s * 0.3);
  g.lineTo(s * 0.15, -s * 0.1);
  g.lineTo(s * 0.15, s * 0.3);
  g.closePath();
  g.fill(color);
  // Wing highlights
  g.moveTo(-s * 0.35, s * 0.25);
  g.lineTo(-s * 0.18, s * 0.0);
  g.lineTo(-s * 0.18, s * 0.25);
  g.closePath();
  g.fill({ color: 0xffffff, alpha: 0.1 });
  // Body with gradient
  g.moveTo(0, -s * 0.5);
  g.lineTo(-s * 0.15, s * 0.3);
  g.lineTo(s * 0.15, s * 0.3);
  g.closePath();
  var shipGrad = makeLinearGradient(lighten(lightColor, 15), darken(color, 15), s * 0.8);
  g.fill(shipGrad);
  // Body highlight stripe
  g.moveTo(0, -s * 0.45);
  g.lineTo(-s * 0.06, s * 0.25);
  g.lineTo(s * 0.02, s * 0.25);
  g.closePath();
  g.fill({ color: 0xffffff, alpha: 0.1 });
  // Cockpit with glass effect
  g.circle(0, -s * 0.1, s * 0.09);
  g.fill(0x88ddff);
  g.ellipse(-s * 0.02, -s * 0.13, s * 0.04, s * 0.03);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  container.addChild(g);
  if (hasFilters()) {
    container.filters = [new PIXI.filters.GlowFilter({
      distance: 12, outerStrength: 2.5, color: 0xff6600,
    })];
  }
  return container;
}

// ============================================================================
// POST-PROCESSING & ATMOSPHERE
// ============================================================================

/** Per-biome color grading applied to the world container via ColorMatrixFilter */
export function applyBiomePostProcessing(theme: string, worldContainer: any): any {
  if (!PIXI.ColorMatrixFilter) return null;
  var cm = new PIXI.ColorMatrixFilter();
  // IMPORTANT: Never use cm.tint() — it multiplies ALL pixels by one color,
  // destroying color variety and making the entire scene monochrome.
  // Use only saturate/contrast/brightness/hue for subtle mood shifts.
  switch (theme) {
    case 'forest':
      cm.saturate(0.12, false);
      cm.contrast(0.06, true);
      cm.brightness(1.02, true);
      break;
    case 'sunset':
      cm.saturate(0.1, false);
      cm.contrast(0.08, true);
      cm.brightness(1.03, true);
      cm.hue(8, true); // slight warm shift
      break;
    case 'space':
      cm.night(0.08, false);
      cm.contrast(0.1, true);
      cm.saturate(0.12, true);
      break;
    case 'volcanic':
      cm.saturate(0.15, false);
      cm.contrast(0.1, true);
      cm.brightness(0.97, true);
      cm.hue(-5, true); // slight warm shift
      break;
    case 'candy':
      cm.saturate(0.18, false);
      cm.brightness(1.05, true);
      break;
    case 'arctic':
      cm.contrast(0.06, false);
      cm.brightness(1.03, true);
      cm.saturate(-0.08, true);
      cm.hue(-10, true); // slight cool shift
      break;
    case 'dark':
      cm.brightness(0.75, false);
      cm.contrast(0.15, true);
      cm.saturate(-0.12, true);
      break;
    case 'ocean':
      cm.saturate(0.08, false);
      cm.contrast(0.05, true);
      cm.hue(-8, true); // slight cool shift
      break;
  }
  var existing = worldContainer.filters || [];
  worldContainer.filters = existing.concat([cm]);
  return cm;
}

/** Vignette overlay — darkens edges, cinematic framing. Add to UI layer (fixed position). */
export function drawVignette(w: number, h: number): any {
  var g = new PIXI.Graphics();
  if (hasFillGradient()) {
    var grad = new PIXI.FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0.25,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.7,
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 0.6, color: 'rgba(0,0,0,0)' },
        { offset: 1, color: 'rgba(0,0,0,0.35)' },
      ],
    });
    g.rect(0, 0, w, h);
    g.fill(grad);
  } else {
    // Fallback: 4 gradient edge strips
    g.rect(0, 0, w, h);
    g.fill({ color: 0x000000, alpha: 0 });
    // Top edge
    g.rect(0, 0, w, h * 0.12);
    g.fill({ color: 0x000000, alpha: 0.18 });
    // Bottom edge
    g.rect(0, h * 0.88, w, h * 0.12);
    g.fill({ color: 0x000000, alpha: 0.22 });
    // Left edge
    g.rect(0, 0, w * 0.08, h);
    g.fill({ color: 0x000000, alpha: 0.12 });
    // Right edge
    g.rect(w * 0.92, 0, w * 0.08, h);
    g.fill({ color: 0x000000, alpha: 0.12 });
  }
  return g;
}

/** Atmospheric fog layers — blurred semi-transparent ellipses at different depths.
 *  Returns array of containers for parallax scrolling in update(). */
export function drawAtmosphericFog(worldW: number, groundY: number, theme: string): any[] {
  var layers: any[] = [];
  var fogColors: Record<string, number> = {
    forest: 0x88aa66, sunset: 0xdd9955, space: 0x222244, volcanic: 0x553322,
    candy: 0xffaacc, arctic: 0xbbccdd, dark: 0x221133, ocean: 0x446688,
  };
  var fogColor = fogColors[theme] || 0x888888;
  var layerCount = 3;
  for (var i = 0; i < layerCount; i++) {
    var g = new PIXI.Graphics();
    var depth = (i + 1) / layerCount;
    var fogY = groundY * (0.55 + depth * 0.35);
    var fogAlpha = 0.04 + depth * 0.06;
    // Draw overlapping ellipses for soft cloud-like fog
    for (var x = -200; x < worldW + 200; x += 60 + Math.random() * 80) {
      var fw = 120 + Math.random() * 220;
      var fh = 18 + Math.random() * 35;
      g.ellipse(x, fogY + (Math.random() - 0.5) * 30, fw, fh);
      g.fill({ color: fogColor, alpha: fogAlpha });
    }
    // Soft edges via low alpha (no BlurFilter — saves ~1.5ms GPU per layer)
    g.alpha = 0.6 - i * 0.12;
    layers.push(g);
  }
  return layers;
}

/** L-system procedural tree — generates unique trees from simple rules.
 *  Special presets: candy = lollipop shape, palm = curved trunk + fronds.
 *  Other presets use L-system branching. Cached as sprite via generateTexture(). */
export function drawLSystemTree(x: number, y: number, preset: string, theme: string, seed: number): any {
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  var pal = PALETTES[theme] || PALETTES.forest;
  var trunkColor = pal.foliage ? darken(pal.foliage, 40) : 0x5a3a1a;
  var leafColor = pal.foliage || 0x44aa44;
  var leafLight = pal.foliageLight || lighten(leafColor, 20);

  // Simple seeded RNG local to this tree
  var ts = seed;
  function tr() { ts = (ts * 16807 + 0) % 2147483647; return (ts & 0x7fffffff) / 2147483647; }

  // ---- CANDY: Lollipop shape (straight stick + spiral candy top) ----
  if (preset === 'candy') {
    var stickH = 50 + tr() * 30;
    var headR = 16 + tr() * 10;
    var candyColors2 = [0xff6699, 0x66ccff, 0xffcc33, 0x66ff99, 0xff66ff];
    var cColor = candyColors2[Math.floor(tr() * candyColors2.length)];
    // Stick
    g.roundRect(-2, -stickH, 4, stickH, 2);
    g.fill(0xddccaa);
    // Candy head
    g.circle(0, -stickH - headR, headR);
    g.fill(cColor);
    // Spiral pattern
    for (var sp = 0; sp < 3; sp++) {
      var sa = sp * Math.PI * 0.66 + tr() * 0.5;
      g.arc(0, -stickH - headR, headR * 0.7, sa, sa + Math.PI * 0.5);
      g.stroke({ color: 0xffffff, alpha: 0.6, width: 3 });
    }
    // Shine highlight
    g.circle(-headR * 0.3, -stickH - headR - headR * 0.3, headR * 0.2);
    g.fill({ color: 0xffffff, alpha: 0.5 });
    container.addChild(g);
    container.x = x; container.y = y;
    return container;
  }

  // ---- PALM: Curved trunk + fan fronds at top ----
  if (preset === 'palm') {
    var palmH = 70 + tr() * 40;
    var curve = 15 + tr() * 20;
    var curveDir = tr() > 0.5 ? 1 : -1;
    // Curved trunk via bezier
    g.moveTo(0, 0);
    g.bezierCurveTo(curveDir * curve * 0.3, -palmH * 0.3, curveDir * curve, -palmH * 0.7, curveDir * curve * 0.5, -palmH);
    g.stroke({ color: trunkColor, width: 7 });
    g.moveTo(0, 0);
    g.bezierCurveTo(curveDir * curve * 0.3, -palmH * 0.3, curveDir * curve, -palmH * 0.7, curveDir * curve * 0.5, -palmH);
    g.stroke({ color: lighten(trunkColor, 15), width: 3 });
    // Bark rings
    for (var br = 0; br < 5; br++) {
      var bt = (br + 1) / 6;
      var bx = curveDir * curve * 0.5 * bt * bt;
      var by = -palmH * bt;
      g.ellipse(bx, by, 5, 1.5);
      g.stroke({ color: darken(trunkColor, 15), width: 1, alpha: 0.4 });
    }
    // Fan fronds
    var topX = curveDir * curve * 0.5;
    var topY = -palmH;
    var frondCount = 5 + Math.floor(tr() * 3);
    for (var fr = 0; fr < frondCount; fr++) {
      var fa = (fr / frondCount) * Math.PI * 1.6 - Math.PI * 0.8;
      var fLen = 30 + tr() * 20;
      var fx = topX + Math.cos(fa) * fLen;
      var fy = topY + Math.sin(fa) * fLen * 0.7;
      g.moveTo(topX, topY);
      g.quadraticCurveTo(topX + Math.cos(fa) * fLen * 0.6, topY + Math.sin(fa) * fLen * 0.3 - 8, fx, fy);
      g.stroke({ color: leafColor, width: 2.5, alpha: 0.8 });
      // Leaf blade
      g.moveTo(topX, topY);
      g.quadraticCurveTo(topX + Math.cos(fa) * fLen * 0.5, topY + Math.sin(fa) * fLen * 0.25 - 10, fx, fy);
      g.quadraticCurveTo(topX + Math.cos(fa) * fLen * 0.5, topY + Math.sin(fa) * fLen * 0.25 + 5, topX, topY);
      g.fill({ color: leafColor, alpha: 0.35 });
    }
    // Coconuts
    for (var co = 0; co < 2 + Math.floor(tr() * 2); co++) {
      g.circle(topX + (tr() - 0.5) * 10, topY + 3 + tr() * 6, 3);
      g.fill(0x886633);
    }
    container.addChild(g);
    container.x = x; container.y = y;
    return container;
  }

  // ---- L-SYSTEM TREES (oak, pine, dead, willow) ----
  var PRESETS: Record<string, { axiom: string; rule: string; angle: number; gen: number; lenScale: number; thickScale: number }> = {
    oak:    { axiom: 'F', rule: 'FF+[+F-F-F]-[-F+F+F]', angle: 25, gen: 3, lenScale: 0.68, thickScale: 0.6 },
    pine:   { axiom: 'F', rule: 'F[+F][-F]F', angle: 22, gen: 4, lenScale: 0.72, thickScale: 0.55 },
    dead:   { axiom: 'F', rule: 'F[-F]F[+F]', angle: 28, gen: 3, lenScale: 0.7, thickScale: 0.6 },
    willow: { axiom: 'F', rule: 'FF-[-F+F+F]+[+F-F-F]', angle: 20, gen: 3, lenScale: 0.72, thickScale: 0.58 },
  };
  var p = PRESETS[preset] || PRESETS.oak;

  // Expand L-system string
  var str = p.axiom;
  for (var gen = 0; gen < p.gen; gen++) {
    var next = '';
    for (var ci = 0; ci < str.length; ci++) {
      next += str[ci] === 'F' ? p.rule : str[ci];
    }
    str = next;
  }

  // Turtle graphics interpretation
  var stack: { cx: number; cy: number; ca: number; len: number; thick: number }[] = [];
  var cx = 0, cy = 0, ca = -90;
  var len = 18 + tr() * 8;
  var thick = 5 + tr() * 2;
  var leaves: { x: number; y: number; r: number }[] = [];

  for (var si = 0; si < str.length; si++) {
    var ch = str[si];
    if (ch === 'F') {
      var nx = cx + Math.cos(ca * Math.PI / 180) * len;
      var ny = cy + Math.sin(ca * Math.PI / 180) * len;
      g.moveTo(cx, cy);
      g.lineTo(nx, ny);
      g.stroke({ color: thick > 2 ? trunkColor : lighten(trunkColor, 15), width: Math.max(thick, 1), alpha: 0.9 });
      cx = nx; cy = ny;
    } else if (ch === '+') {
      ca += p.angle + (tr() - 0.5) * 12;
    } else if (ch === '-') {
      ca -= p.angle + (tr() - 0.5) * 12;
    } else if (ch === '[') {
      stack.push({ cx: cx, cy: cy, ca: ca, len: len, thick: thick });
      len *= p.lenScale; thick *= p.thickScale;
    } else if (ch === ']') {
      if (preset !== 'dead') {
        leaves.push({ x: cx, y: cy, r: 4 + tr() * 6 });
      }
      var s = stack.pop();
      if (s) { cx = s.cx; cy = s.cy; ca = s.ca; len = s.len; thick = s.thick; }
    }
  }

  // Draw leaves for non-dead trees
  for (var li2 = 0; li2 < leaves.length; li2++) {
    var lf2 = leaves[li2];
    g.circle(lf2.x, lf2.y, lf2.r);
    g.fill({ color: lerpColor(leafColor, leafLight, tr()), alpha: 0.65 + tr() * 0.3 });
  }

  container.addChild(g);

  // Cache as sprite texture for performance
  try {
    if (PIXI.Application && PIXI.Application._instance && PIXI.Application._instance.renderer) {
      var tex = PIXI.Application._instance.renderer.generateTexture({ target: container, resolution: 1 });
      var cached = new PIXI.Sprite(tex);
      cached.anchor.set(0.5, 1);
      cached.x = x; cached.y = y;
      return cached;
    }
  } catch(e) { /* fallback to raw graphics */ }

  container.x = x; container.y = y;
  return container;
}

/** Theme-to-tree-preset mapping */
export var TREE_PRESETS: Record<string, string[]> = {
  forest: ['oak', 'oak'],
  sunset: ['oak', 'willow'],
  space: [],
  volcanic: ['dead'],
  candy: ['candy', 'candy'],
  arctic: ['pine', 'dead'],
  dark: ['willow', 'dead'],
  ocean: ['palm', 'palm'],
};

/** Draw a point light — radial gradient circle with additive blending */
export function drawPointLight(x: number, y: number, radius: number, color: number, intensity: number): any {
  var g = new PIXI.Graphics();
  if (hasFillGradient()) {
    var r = ((color >> 16) & 0xff), gn = ((color >> 8) & 0xff), b = (color & 0xff);
    var centerCSS = 'rgba(' + r + ',' + gn + ',' + b + ',' + (intensity * 0.6) + ')';
    var edgeCSS = 'rgba(' + r + ',' + gn + ',' + b + ',0)';
    var grad = new PIXI.FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: centerCSS },
        { offset: 0.4, color: centerCSS },
        { offset: 1, color: edgeCSS },
      ],
    });
    g.circle(0, 0, radius);
    g.fill(grad);
  } else {
    g.circle(0, 0, radius);
    g.fill({ color: color, alpha: intensity * 0.3 });
    g.circle(0, 0, radius * 0.5);
    g.fill({ color: color, alpha: intensity * 0.15 });
  }
  g.x = x;
  g.y = y;
  g.blendMode = 'add';
  return g;
}

/** Create a lighting layer with theme-specific light sources.
 *  Places radial additive lights at decoration positions and ambient spots. */
export function createLightingLayer(theme: string, worldW: number, groundY: number, decorPositions: { x: number; y: number }[]): any {
  var layer = new PIXI.Container();
  layer.blendMode = 'add';
  var lightDefs: Record<string, { color: number; radius: number; intensity: number; ambientColor: number; ambientR: number }> = {
    forest:   { color: 0xffdd66, radius: 80, intensity: 0.4, ambientColor: 0x88aa44, ambientR: 200 },
    sunset:   { color: 0xff8833, radius: 90, intensity: 0.35, ambientColor: 0xff6622, ambientR: 250 },
    space:    { color: 0x4488ff, radius: 70, intensity: 0.5, ambientColor: 0x3366cc, ambientR: 180 },
    volcanic: { color: 0xff4400, radius: 85, intensity: 0.6, ambientColor: 0xff2200, ambientR: 200 },
    candy:    { color: 0xff88cc, radius: 70, intensity: 0.35, ambientColor: 0xffaaee, ambientR: 160 },
    arctic:   { color: 0x88ccff, radius: 75, intensity: 0.3, ambientColor: 0x66aadd, ambientR: 200 },
    dark:     { color: 0x8844cc, radius: 90, intensity: 0.55, ambientColor: 0x6633aa, ambientR: 220 },
    ocean:    { color: 0x44ddaa, radius: 65, intensity: 0.4, ambientColor: 0x2288aa, ambientR: 180 },
  };
  var ld = lightDefs[theme] || lightDefs.forest;

  // Lights at decoration positions
  for (var i = 0; i < decorPositions.length; i++) {
    var dp = decorPositions[i];
    var light = drawPointLight(dp.x, dp.y - 20, ld.radius, ld.color, ld.intensity * (0.6 + Math.random() * 0.4));
    layer.addChild(light);
  }

  // Theme-specific special lights
  if (theme === 'dark') {
    // Moonlight from above — wide soft white-blue light at top center
    var moon = drawPointLight(worldW * 0.4, -80, 400, 0x6677aa, 0.2);
    layer.addChild(moon);
  } else if (theme === 'arctic') {
    // Aurora shimmer — 3 wide colored bands across the sky
    var auroraColors = [0x44ff88, 0x4488ff, 0xaa44ff];
    for (var au = 0; au < 3; au++) {
      var auroraLight = drawPointLight(worldW * (0.2 + au * 0.3), groundY * 0.2, 300, auroraColors[au], 0.12);
      layer.addChild(auroraLight);
    }
  } else if (theme === 'volcanic') {
    // Extra red glow along the ground line
    for (var vg = 0; vg < 5; vg++) {
      var vgx = worldW * (vg + 0.5) / 5;
      var volcGlow = drawPointLight(vgx, groundY + 10, 120, 0xff2200, 0.25);
      layer.addChild(volcGlow);
    }
  } else if (theme === 'sunset') {
    // Warm horizon glow — wide orange light at horizon
    var horizonGlow = drawPointLight(worldW * 0.5, groundY * 0.7, 500, 0xff6622, 0.15);
    layer.addChild(horizonGlow);
  }

  // Ambient glow zones along the ground
  var ambientCount = Math.floor(worldW / 600);
  for (var a = 0; a < ambientCount; a++) {
    var ax = (a + 0.5) * (worldW / ambientCount) + (Math.random() - 0.5) * 200;
    var amb = drawPointLight(ax, groundY - 40, ld.ambientR, ld.ambientColor, ld.intensity * 0.3);
    layer.addChild(amb);
  }

  // Additive blendMode is sufficient for glow — no AdvancedBloomFilter (saves ~1ms GPU)
  return layer;
}

// ============================================================================
// DYNAMIC WATER & LAVA SURFACES
// ============================================================================

/** Animated water surface — multi-sine waves redrawn each frame.
 *  Returns { container, gfx, update(time) } — call update() every frame. */
export function createWaterSurface(worldW: number, waterY: number, waterH: number, waterColor: number): any {
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  container.addChild(g);

  // Cache gradient and colors ONCE — never allocate per frame
  var cachedGrad = hasFillGradient() ? makeLinearGradient(waterColor, darken(waterColor, 40), waterH) : null;
  var fallbackFill = { color: waterColor, alpha: 0.7 };
  var highlightColor = lighten(waterColor, 50);
  var highlightStroke = { color: highlightColor, alpha: 0.3, width: 2 };
  var sparkleFill = { color: 0xffffff, alpha: 0.5 };

  function waveHeight(x: number, time: number): number {
    return Math.sin(x * 0.02 + time * 1.5) * 4
         + Math.sin(x * 0.035 + time * 2.3) * 2.5
         + Math.sin(x * 0.008 + time * 0.7) * 8;
  }

  function updateWater(time: number) {
    g.clear();
    var step = 6;
    // Water body
    g.moveTo(0, waterY + waveHeight(0, time));
    for (var x = step; x <= worldW; x += step) {
      g.lineTo(x, waterY + waveHeight(x, time));
    }
    g.lineTo(worldW, waterY + waterH);
    g.lineTo(0, waterY + waterH);
    g.closePath();
    g.fill(cachedGrad || fallbackFill);

    // Surface highlight line
    g.moveTo(0, waterY + waveHeight(0, time) - 1);
    for (var x2 = step; x2 <= worldW; x2 += step) {
      g.lineTo(x2, waterY + waveHeight(x2, time) - 1);
    }
    g.stroke(highlightStroke);

    // Specular sparkles
    for (var sx = 0; sx < worldW; sx += 50 + Math.random() * 70) {
      var sparkleAlpha = Math.max(0, Math.sin(time * 3 + sx * 0.1)) * 0.5;
      if (sparkleAlpha > 0.1) {
        g.circle(sx, waterY + waveHeight(sx, time) - 2, 1.5);
        sparkleFill.alpha = sparkleAlpha;
        g.fill(sparkleFill);
      }
    }
  }

  return { container: container, update: updateWater };
}

/** Animated lava surface — slow undulating waves with noise-driven cracks and bubbles.
 *  Returns { container, update(time) } */
export function createLavaSurface(worldW: number, lavaY: number, lavaH: number): any {
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  container.addChild(g);

  // Cache gradient and style objects ONCE — never allocate per frame
  var cachedGrad = hasFillGradient() ? makeLinearGradient(0xcc2200, 0x660000, lavaH) : null;
  var glowStroke = { color: 0xff8800, alpha: 0.35, width: 2 };
  var crackStroke = { color: 0xff6600, alpha: 0.4, width: 2 };
  var bubbleFill = { color: 0xff4400, alpha: 0.35 };

  function lavaWave(x: number, time: number): number {
    return Math.sin(x * 0.015 + time * 0.5) * 6
         + Math.sin(x * 0.04 + time * 0.8) * 3;
  }

  function updateLava(time: number) {
    g.clear();
    var step = 6;

    // Lava body
    g.moveTo(0, lavaY + lavaWave(0, time));
    for (var x = step; x <= worldW; x += step) {
      g.lineTo(x, lavaY + lavaWave(x, time));
    }
    g.lineTo(worldW, lavaY + lavaH);
    g.lineTo(0, lavaY + lavaH);
    g.closePath();
    g.fill(cachedGrad || 0x880000);

    // Bright crust cracks
    for (var cx = 0; cx < worldW; cx += 30 + noise1D(cx * 0.05 + time * 0.3) * 50) {
      var crackY = lavaY + lavaWave(cx, time) + 3;
      g.moveTo(cx, crackY);
      g.lineTo(cx + 10 + noise1D(cx * 0.1) * 15, crackY + 2);
      g.lineTo(cx + 22 + noise1D(cx * 0.07) * 12, crackY - 1);
      crackStroke.alpha = 0.4 + noise1D(cx * 0.02 + time * 0.5) * 0.4;
      g.stroke(crackStroke);
    }

    // Animated bubbles
    for (var bx = 0; bx < worldW; bx += 60 + noise1D(bx * 0.03) * 90) {
      var bubblePhase = (time * 0.4 + noise1D(bx * 0.1)) % 1;
      if (bubblePhase < 0.25) {
        var br = bubblePhase * 18;
        var by = lavaY + lavaWave(bx, time) + 5 - bubblePhase * 12;
        g.circle(bx, by, br);
        bubbleFill.alpha = 0.35 * (1 - bubblePhase / 0.25);
        g.fill(bubbleFill);
      }
    }

    // Surface glow line
    g.moveTo(0, lavaY + lavaWave(0, time) - 1);
    for (var x3 = step; x3 <= worldW; x3 += step) {
      g.lineTo(x3, lavaY + lavaWave(x3, time) - 1);
    }
    g.stroke(glowStroke);
  }

  return { container: container, update: updateLava };
}

/** GodrayFilter application for forest/sunset themes */
export function applyGodrayFilter(container: any, theme: string): any {
  if (!PIXI.filters || !PIXI.filters.GodrayFilter) return null;
  if (theme !== 'forest' && theme !== 'sunset') return null;
  try {
    var godray = new PIXI.filters.GodrayFilter({
      gain: theme === 'forest' ? 0.35 : 0.45,
      lacunarity: 2.5,
      parallel: true,
      angle: theme === 'forest' ? 25 : 35,
      time: 0,
    });
    var existing = container.filters || [];
    container.filters = existing.concat([godray]);
    return godray;
  } catch(e) { return null; }
}

// Re-export so AI can import from config/assets regardless of actual source file
export { _loadSpriteLib, _sheetCache, _getTilingSprite, _themeGroundMap, _themePlatformMap };
export { createAmbientEffect, createSnowEffect, createRainEffect, onJumpDust, onLandImpact, onCollectSparkle, onDeathExplosion };
export { PhysicsWorld, createBody, createStaticBody, createOneWayPlatform, CharacterController };
`;

// ============================================================================
// TEMPLATE FILES
// ============================================================================

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

	// ---------- Template 5: Media-stock URL helper (for future sprite assets) ----------
	{
		path: "src/utils/media-stock.ts",
		language: "typescript",
		content: MEDIA_STOCK_2D_CONTENT,
	},

	// ---------- Template 6: Visual Helpers & Palettes ----------
	{
		path: "src/config/assets.ts",
		language: "typescript",
		content: VISUAL_HELPERS_CONTENT,
	},

	// ---------- Template 7: Level Painter STUB (backward compatibility for existing games) ----------
	{
		path: "src/engine/level-painter.ts",
		language: "typescript",
		content: `var PIXI = (window as any).PIXI;
export class LevelSystem {
  private engine: any;
  private _groundY: number;
  constructor(engine: any) { this.engine = engine; this._groundY = 840; }
  setHelpers(h: any) {}
  update(dt: number) {}
  getHeightAt(x: number) { return this._groundY; }
  getCollisionMask() { return null; }
  async generate(config: any) {
    this._groundY = config.groundY || (config.height ? config.height - 60 : 840);
    return { container: new PIXI.Container(), bodies: [], mask: null, width: config.width || 3000, height: config.height || 900 };
  }
}
`,
	},

	// ---------- Template 8: GameOver Scene ----------
	{
		path: "src/scenes/GameOverScene.ts",
		language: "typescript",
		content: `import { Engine2D, GameScene } from "../engine/core";
import { createExplosionEffect } from "../engine/effects";
import { drawHeart, lerpColor, PALETTES } from "../config/assets";

const PIXI = (window as any).PIXI;

export class GameOverScene implements GameScene {
  name = 'gameover';
  container: any;
  private restartText: any;
  private particles: any[] = [];

  constructor() {
    this.container = new PIXI.Container();
  }

  enter(engine: Engine2D, data?: { score?: number; palette?: string }): void {
    var score = data?.score || 0;
    var W = engine.config.width;
    var H = engine.config.height;

    // Dark overlay with gradient
    var overlay = new PIXI.Graphics();
    var strips = 16;
    var stripH = Math.ceil(H / strips);
    for (var i = 0; i < strips; i++) {
      overlay.rect(0, i * stripH, W, stripH + 1);
      overlay.fill({ color: lerpColor(0x110000, 0x000000, i / strips), alpha: 0.85 });
    }
    this.container.addChild(overlay);

    // Floating particles in background
    for (var p = 0; p < 30; p++) {
      var dot = new PIXI.Graphics();
      dot.circle(0, 0, 1 + Math.random() * 2);
      dot.fill({ color: 0xff4444, alpha: 0.2 + Math.random() * 0.3 });
      dot.x = Math.random() * W;
      dot.y = Math.random() * H;
      (dot as any)._vy = -10 - Math.random() * 20;
      (dot as any)._vx = (Math.random() - 0.5) * 10;
      this.container.addChild(dot);
      this.particles.push(dot);
    }

    // GAME OVER text with shadow
    var shadowText = engine.createText('GAME OVER', {
      fontSize: 72, fill: 0x440000, fontWeight: 'bold',
    });
    shadowText.anchor.set(0.5);
    shadowText.x = W / 2 + 3;
    shadowText.y = H / 3 + 3;
    this.container.addChild(shadowText);

    var title = engine.createText('GAME OVER', {
      fontSize: 72, fill: 0xff4444, fontWeight: 'bold',
      stroke: { color: 0x220000, width: 6 },
    });
    title.anchor.set(0.5);
    title.x = W / 2;
    title.y = H / 3;
    this.container.addChild(title);

    // Score display
    var scoreLabel = engine.createText('SCORE', {
      fontSize: 20, fill: 0x888888,
    });
    scoreLabel.anchor.set(0.5);
    scoreLabel.x = W / 2;
    scoreLabel.y = H / 2 - 25;
    this.container.addChild(scoreLabel);

    var scoreText = engine.createText(String(score), {
      fontSize: 48, fill: 0xffffff, fontWeight: 'bold',
      stroke: { color: 0x000000, width: 4 },
    });
    scoreText.anchor.set(0.5);
    scoreText.x = W / 2;
    scoreText.y = H / 2 + 15;
    this.container.addChild(scoreText);

    // Restart hint
    this.restartText = engine.createText('Press SPACE to restart', {
      fontSize: 18, fill: 0x888888,
    });
    this.restartText.anchor.set(0.5);
    this.restartText.x = W / 2;
    this.restartText.y = H * 0.72;
    this.container.addChild(this.restartText);

    // Explosion burst
    try { var fx = createExplosionEffect(W / 2, H / 3, '#ff4444'); if (fx && fx.emitter) engine.addEmitter(fx.emitter); } catch(e) {}
  }

  update(engine: Engine2D, dt: number): void {
    // Blink restart text
    if (this.restartText) {
      this.restartText.alpha = 0.4 + 0.6 * Math.abs(Math.sin(engine.elapsed * 2.5));
    }
    // Float particles
    for (var p of this.particles) {
      p.y += (p as any)._vy * dt;
      p.x += (p as any)._vx * dt;
      if (p.y < -10) p.y = engine.config.height + 10;
    }
    // Restart
    if (engine.input.wasPressed(' ')) {
      engine.scene.switch('game');
    }
    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    this.container.removeChildren();
    this.particles = [];
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
// GAME SCENE SKELETONS — Injected as starter files, AI generates the content
// ============================================================================

/** Hybrid platformer starter — fully playable, seed-driven dynamic game. AI ENHANCES it. */
export const GAME_2D_SCENE_STARTER = `import { Engine2D, GameScene, createGame2D, loadAssets, JuiceSystem } from "../engine/core";
import { createBody, createStaticBody, createOneWayPlatform, PhysicsWorld, CharacterController } from "../engine/physics";
import { createAmbientEffect, createSnowEffect, createRainEffect, getThemeEffects, onJumpDust, onLandImpact, onCollectSparkle, onDeathExplosion } from "../engine/effects";
import { PALETTES, lerpColor, setNoiseSeed, drawSkyGradient, drawStars, drawMountainRange, drawCloud, drawTree, drawGroundStrip, drawPlatformBlock, drawPlayerCharacter, drawCoinToken, drawEnemySlime, drawHeart, applyBiomePostProcessing, drawVignette, drawAtmosphericFog, drawLSystemTree, TREE_PRESETS, drawPointLight, createLightingLayer, createWaterSurface, createLavaSurface } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;

// ======================== SEEDED PRNG (Mulberry32) ========================
var _seed = 1234;
function _rng() { _seed |= 0; _seed = _seed + 0x6D2B79F5 | 0; var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function _rngRange(min: number, max: number) { return min + _rng() * (max - min); }
function _rngInt(min: number, max: number) { return Math.floor(_rngRange(min, max + 1)); }
function _rngPick<T>(arr: T[]): T { return arr[_rngInt(0, arr.length - 1)]; }

// ======================== CONFIGURATION ========================
var THEME = 'sunset'; // Change to: forest, sunset, space, volcanic, candy, arctic, dark, ocean
var PAL = PALETTES[THEME] || PALETTES.forest;

var CONFIG = {
  gravity: 980,
  worldWidth: 4000,
  worldHeight: 900,
  groundY: 680,
  playerSize: 48,
  playerStartX: 250,
  moveSpeed: 280,
  jumpForce: 520,
  coinRadius: 10,
  enemySize: 44,
  enemySpeed: 60,
  lives: 3,
  platformCount: 11,
  enemyCount: 6,
  coinCount: 27,
  levelShape: 'flat-wide' as 'flat-wide' | 'staircase-ascending' | 'valley-bowl' | 'hilly-undulating',
  doubleJump: true,
  wallSlide: false,
};

// ======================== LEVEL GENERATORS ========================
function _generatePlatformY(index: number, total: number): number {
  var t = index / Math.max(total - 1, 1); // 0..1
  var minY = CONFIG.groundY - 360;
  var maxY = CONFIG.groundY - 80;
  switch (CONFIG.levelShape) {
    case 'staircase-ascending':
      return maxY - t * (maxY - minY) + _rngRange(-20, 20);
    case 'valley-bowl':
      var bowl = Math.abs(t - 0.5) * 2; // 0 at center, 1 at edges
      return minY + bowl * (maxY - minY) * 0.6 + _rngRange(-15, 15);
    case 'hilly-undulating':
      return minY + (maxY - minY) * (0.5 + 0.4 * Math.sin(t * Math.PI * 3)) + _rngRange(-20, 20);
    default: // flat-wide
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
  // Coins on/near platforms
  for (var i = 0; i < onPlatCount; i++) {
    var p = platforms[_rngInt(0, platforms.length - 1)];
    coins.push({ x: p.x + _rngRange(-p.w * 0.3, p.w * 0.3), y: p.y - _rngRange(25, 45) });
  }
  // Ground coins
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
      type: _rngInt(0, 3), // 4 variants per theme
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
      if (type === 0) { // Lava pool
        g.beginFill(0xff3300, 0.8); g.drawEllipse(0, 0, 30 * s, 8 * s); g.endFill();
        g.beginFill(0xff6600, 0.6); g.drawEllipse(0, -2, 20 * s, 5 * s); g.endFill();
        g.beginFill(0xffaa00, 0.4); g.drawEllipse(0, -3, 10 * s, 3 * s); g.endFill();
      } else if (type === 1) { // Smoking vent
        g.beginFill(0x3a2a1a); g.moveTo(-8 * s, 0); g.lineTo(8 * s, 0); g.lineTo(4 * s, -20 * s); g.lineTo(-4 * s, -20 * s); g.endFill();
        g.beginFill(0x554433); g.drawCircle(0, -20 * s, 6 * s); g.endFill();
        g.beginFill(0xff4400, 0.5); g.drawCircle(0, -20 * s, 3 * s); g.endFill();
      } else if (type === 2) { // Obsidian crystal
        g.beginFill(0x1a1a2a); g.moveTo(0, -35 * s); g.lineTo(8 * s, 0); g.lineTo(-8 * s, 0); g.endFill();
        g.beginFill(0x2a2a4a); g.moveTo(6 * s, -25 * s); g.lineTo(12 * s, 0); g.lineTo(2 * s, 0); g.endFill();
        g.beginFill(0xff4400, 0.3); g.moveTo(0, -30 * s); g.lineTo(3 * s, -10 * s); g.lineTo(-3 * s, -10 * s); g.endFill();
      } else { // Cracked rock
        g.beginFill(0x4a3a2a); g.drawRoundedRect(-15 * s, -12 * s, 30 * s, 12 * s, 4); g.endFill();
        g.beginFill(0x5a4a3a); g.drawRoundedRect(-10 * s, -18 * s, 20 * s, 8 * s, 3); g.endFill();
        g.lineStyle(1, 0xff4400, 0.6); g.moveTo(-5 * s, -2 * s); g.lineTo(0, -10 * s); g.lineTo(5 * s, -4 * s);
      }
      break;
    case 'arctic':
      if (type === 0) { // Ice crystal
        g.beginFill(0x99ddff, 0.8); g.moveTo(0, -40 * s); g.lineTo(6 * s, -10 * s); g.lineTo(0, 0); g.lineTo(-6 * s, -10 * s); g.endFill();
        g.beginFill(0xbbeeFF, 0.5); g.moveTo(0, -35 * s); g.lineTo(3 * s, -12 * s); g.lineTo(-3 * s, -12 * s); g.endFill();
        g.beginFill(0xccffff, 0.6); g.moveTo(10 * s, -25 * s); g.lineTo(14 * s, -10 * s); g.lineTo(8 * s, -10 * s); g.endFill();
      } else if (type === 1) { // Snowdrift
        g.beginFill(0xddeeff, 0.9); g.drawEllipse(0, 0, 25 * s, 10 * s); g.endFill();
        g.beginFill(0xeef4ff, 0.7); g.drawEllipse(5 * s, -3 * s, 15 * s, 6 * s); g.endFill();
      } else if (type === 2) { // Frozen pillar
        g.beginFill(0x88bbdd); g.drawRoundedRect(-6 * s, -45 * s, 12 * s, 45 * s, 3); g.endFill();
        g.beginFill(0xaaddee, 0.6); g.drawRoundedRect(-3 * s, -42 * s, 6 * s, 38 * s, 2); g.endFill();
        g.beginFill(0x99ccee); g.drawCircle(0, -48 * s, 8 * s); g.endFill();
      } else { // Icicles
        for (var ic = 0; ic < 3; ic++) {
          var ix = (ic - 1) * 10 * s;
          var ih = (20 + ic * 8) * s;
          g.beginFill(0xaaddff, 0.8); g.moveTo(ix - 3 * s, 0); g.lineTo(ix, -ih); g.lineTo(ix + 3 * s, 0); g.endFill();
        }
      }
      break;
    case 'candy':
      if (type === 0) { // Lollipop
        g.beginFill(0x886644); g.drawRect(-2 * s, -40 * s, 4 * s, 40 * s); g.endFill();
        g.beginFill(0xff6699); g.drawCircle(0, -48 * s, 12 * s); g.endFill();
        g.beginFill(0xffaacc, 0.6); g.drawCircle(-3 * s, -50 * s, 5 * s); g.endFill();
        g.lineStyle(2, 0xffffff, 0.5); g.arc(0, -48 * s, 8 * s, 0, Math.PI); g.lineStyle(0);
      } else if (type === 1) { // Candy cane
        g.beginFill(0xff3344); g.drawRoundedRect(-4 * s, -35 * s, 8 * s, 35 * s, 3); g.endFill();
        for (var st = 0; st < 5; st++) {
          g.beginFill(0xffffff, 0.8); g.drawRect(-4 * s, -35 * s + st * 14 * s, 8 * s, 4 * s); g.endFill();
        }
        g.beginFill(0xff3344); g.drawCircle(6 * s, -35 * s, 5 * s); g.endFill();
      } else if (type === 2) { // Gummy bear
        g.beginFill(0x44cc88); g.drawEllipse(0, -12 * s, 10 * s, 14 * s); g.endFill();
        g.beginFill(0x44cc88); g.drawCircle(-6 * s, -26 * s, 5 * s); g.drawCircle(6 * s, -26 * s, 5 * s); g.endFill();
        g.beginFill(0xffffff); g.drawCircle(-3 * s, -14 * s, 2 * s); g.drawCircle(3 * s, -14 * s, 2 * s); g.endFill();
        g.beginFill(0x111111); g.drawCircle(-3 * s, -14 * s, 1); g.drawCircle(3 * s, -14 * s, 1); g.endFill();
      } else { // Sprinkle pile
        var sprColors = [0xff6699, 0x66ccff, 0xffcc33, 0x66ff99, 0xff66ff];
        for (var sp = 0; sp < 8; sp++) {
          g.beginFill(sprColors[sp % sprColors.length]);
          g.drawRoundedRect(_rngRange(-15, 15) * s, _rngRange(-8, 0) * s, 6 * s, 2 * s, 1);
          g.endFill();
        }
      }
      break;
    case 'space':
      if (type === 0) { // Floating asteroid
        g.beginFill(0x555566); g.drawCircle(0, -15 * s, 14 * s); g.endFill();
        g.beginFill(0x444455); g.drawCircle(-5 * s, -18 * s, 5 * s); g.endFill();
        g.beginFill(0x333344); g.drawCircle(6 * s, -12 * s, 4 * s); g.endFill();
      } else if (type === 1) { // Alien plant
        g.beginFill(0x44ff88, 0.8); g.moveTo(0, 0); g.quadraticCurveTo(15 * s, -20 * s, 5 * s, -35 * s); g.quadraticCurveTo(0, -25 * s, 0, 0); g.endFill();
        g.beginFill(0x88ffbb, 0.6); g.moveTo(0, 0); g.quadraticCurveTo(-12 * s, -18 * s, -3 * s, -30 * s); g.quadraticCurveTo(0, -20 * s, 0, 0); g.endFill();
        g.beginFill(0xaaffdd); g.drawCircle(4 * s, -34 * s, 3 * s); g.drawCircle(-2 * s, -29 * s, 2 * s); g.endFill();
      } else if (type === 2) { // Energy pylon
        g.beginFill(0x333355); g.drawRect(-4 * s, -40 * s, 8 * s, 40 * s); g.endFill();
        g.beginFill(0x6666ff, 0.7); g.drawCircle(0, -42 * s, 6 * s); g.endFill();
        g.beginFill(0x9999ff, 0.4); g.drawCircle(0, -42 * s, 10 * s); g.endFill();
      } else { // Antenna dish
        g.beginFill(0x555577); g.drawRect(-2 * s, -30 * s, 4 * s, 30 * s); g.endFill();
        g.beginFill(0x777799); g.drawEllipse(0, -32 * s, 14 * s, 6 * s); g.endFill();
        g.beginFill(0x4488ff, 0.5); g.drawCircle(0, -32 * s, 3 * s); g.endFill();
      }
      break;
    case 'dark':
      if (type === 0) { // Skull on stick
        g.beginFill(0x333344); g.drawRect(-2 * s, -30 * s, 4 * s, 30 * s); g.endFill();
        g.beginFill(0xccccbb); g.drawCircle(0, -35 * s, 8 * s); g.endFill();
        g.beginFill(0x1a1a2a); g.drawEllipse(-3 * s, -36 * s, 2.5 * s, 3 * s); g.drawEllipse(3 * s, -36 * s, 2.5 * s, 3 * s); g.endFill();
        g.beginFill(0x1a1a2a); g.moveTo(-2 * s, -31 * s); g.lineTo(0, -29 * s); g.lineTo(2 * s, -31 * s); g.endFill();
      } else if (type === 1) { // Glowing mushroom
        g.beginFill(0x333344); g.drawRect(-3 * s, -15 * s, 6 * s, 15 * s); g.endFill();
        g.beginFill(0x6633aa); g.drawEllipse(0, -18 * s, 14 * s, 8 * s); g.endFill();
        g.beginFill(0xaa55ff, 0.4); g.drawEllipse(0, -18 * s, 18 * s, 10 * s); g.endFill();
        g.beginFill(0xddaaff, 0.5); g.drawCircle(-4 * s, -20 * s, 2 * s); g.drawCircle(5 * s, -17 * s, 1.5 * s); g.endFill();
      } else if (type === 2) { // Tombstone
        g.beginFill(0x444455); g.drawRoundedRect(-10 * s, -30 * s, 20 * s, 30 * s, 5 * s); g.endFill();
        g.beginFill(0x333344); g.drawRect(-1 * s, -22 * s, 2 * s, 10 * s); g.drawRect(-5 * s, -18 * s, 10 * s, 2 * s); g.endFill();
      } else { // Broken lantern
        g.beginFill(0x444455); g.drawRect(-2 * s, -25 * s, 4 * s, 25 * s); g.endFill();
        g.beginFill(0x555566); g.drawRect(-6 * s, -30 * s, 12 * s, 8 * s); g.endFill();
        g.beginFill(0x00ff88, 0.4); g.drawCircle(0, -26 * s, 4 * s); g.endFill();
        g.beginFill(0x00ff88, 0.15); g.drawCircle(0, -26 * s, 10 * s); g.endFill();
      }
      break;
    case 'ocean':
      if (type === 0) { // Coral
        g.beginFill(0xff6688); g.moveTo(0, 0); g.quadraticCurveTo(10 * s, -20 * s, 5 * s, -30 * s); g.quadraticCurveTo(2 * s, -20 * s, 0, 0); g.endFill();
        g.beginFill(0xff88aa); g.moveTo(0, 0); g.quadraticCurveTo(-8 * s, -18 * s, -4 * s, -25 * s); g.quadraticCurveTo(-1 * s, -15 * s, 0, 0); g.endFill();
        g.beginFill(0xffaacc); g.drawCircle(4 * s, -29 * s, 3 * s); g.drawCircle(-3 * s, -24 * s, 2.5 * s); g.endFill();
      } else if (type === 1) { // Seaweed
        g.beginFill(0x228855, 0.8);
        for (var sw = 0; sw < 3; sw++) {
          var sx = (sw - 1) * 6 * s;
          g.moveTo(sx, 0); g.quadraticCurveTo(sx + 8 * s, -15 * s, sx + 2 * s, -30 * s - sw * 5 * s);
          g.quadraticCurveTo(sx - 2 * s, -15 * s, sx, 0);
        }
        g.endFill();
      } else if (type === 2) { // Shell
        g.beginFill(0xffcc88); g.drawEllipse(0, -5 * s, 12 * s, 8 * s); g.endFill();
        g.beginFill(0xffddaa); g.drawEllipse(0, -7 * s, 8 * s, 5 * s); g.endFill();
        g.lineStyle(1, 0xddaa77); for (var sl = 0; sl < 5; sl++) { g.moveTo(0, -5 * s); g.lineTo((sl * 5 - 10) * s, 3 * s); } g.lineStyle(0);
      } else { // Anchor
        g.beginFill(0x556677); g.drawRect(-2 * s, -30 * s, 4 * s, 30 * s); g.endFill();
        g.beginFill(0x556677); g.drawRect(-12 * s, -8 * s, 24 * s, 4 * s); g.endFill();
        g.beginFill(0x667788); g.drawCircle(0, -32 * s, 5 * s); g.endFill();
        g.beginFill(0x445566); g.drawCircle(0, -32 * s, 3 * s); g.endFill();
      }
      break;
    case 'sunset':
      if (type === 0) { // Sunflower
        g.beginFill(0x447733); g.drawRect(-2 * s, -35 * s, 4 * s, 35 * s); g.endFill();
        for (var pet = 0; pet < 8; pet++) {
          var pa = pet * Math.PI / 4;
          g.beginFill(0xffcc00); g.drawEllipse(Math.cos(pa) * 8 * s, -40 * s + Math.sin(pa) * 8 * s, 5 * s, 3 * s); g.endFill();
        }
        g.beginFill(0x885500); g.drawCircle(0, -40 * s, 5 * s); g.endFill();
      } else if (type === 1) { // Tall grass
        g.beginFill(0x558833, 0.7);
        for (var tg = 0; tg < 5; tg++) {
          var tx2 = (tg - 2) * 5 * s;
          g.moveTo(tx2, 0); g.quadraticCurveTo(tx2 + 4 * s, -15 * s, tx2 + 2 * s, -25 * s - _rng() * 10 * s);
          g.lineTo(tx2 - 1 * s, -25 * s - _rng() * 10 * s); g.quadraticCurveTo(tx2 - 4 * s, -15 * s, tx2, 0);
        }
        g.endFill();
      } else if (type === 2) { // Butterfly bush (flower cluster)
        g.beginFill(0x447733); g.drawRect(-2 * s, -20 * s, 4 * s, 20 * s); g.endFill();
        var flColors = [0xff6688, 0xffaa44, 0xff88cc, 0xffcc66];
        for (var fl = 0; fl < 6; fl++) {
          g.beginFill(flColors[fl % flColors.length], 0.8);
          g.drawCircle(_rngRange(-8, 8) * s, (-22 - _rng() * 10) * s, (3 + _rng() * 2) * s);
          g.endFill();
        }
      } else { // Cattail
        g.beginFill(0x558844); g.drawRect(-1.5 * s, -40 * s, 3 * s, 40 * s); g.endFill();
        g.beginFill(0x885533); g.drawEllipse(0, -42 * s, 3.5 * s, 8 * s); g.endFill();
      }
      break;
    default: // forest
      if (type === 0) { // Mushroom
        g.beginFill(0x886644); g.drawRect(-3 * s, -12 * s, 6 * s, 12 * s); g.endFill();
        g.beginFill(0xcc3333); g.drawEllipse(0, -15 * s, 12 * s, 8 * s); g.endFill();
        g.beginFill(0xffffff, 0.7); g.drawCircle(-4 * s, -17 * s, 2 * s); g.drawCircle(3 * s, -14 * s, 1.5 * s); g.drawCircle(6 * s, -16 * s, 1 * s); g.endFill();
      } else if (type === 1) { // Flower patch
        g.beginFill(0x447733); g.drawRect(-1 * s, -15 * s, 2 * s, 15 * s); g.endFill();
        g.beginFill(0xff6688); g.drawCircle(0, -17 * s, 5 * s); g.endFill();
        g.beginFill(0xffdd44); g.drawCircle(0, -17 * s, 2 * s); g.endFill();
        g.beginFill(0x447733); g.drawRect(3 * s, -10 * s, 2 * s, 10 * s); g.endFill();
        g.beginFill(0xffaa44); g.drawCircle(4 * s, -12 * s, 4 * s); g.endFill();
      } else if (type === 2) { // Fern bush
        g.beginFill(0x338833, 0.8);
        for (var fn = 0; fn < 4; fn++) {
          var fa = (fn - 1.5) * 0.5;
          g.moveTo(0, 0); g.quadraticCurveTo(Math.sin(fa) * 20 * s, -15 * s, Math.sin(fa) * 15 * s, -25 * s);
          g.lineTo(Math.sin(fa) * 12 * s, -23 * s); g.quadraticCurveTo(Math.sin(fa) * 15 * s, -12 * s, 0, 0);
        }
        g.endFill();
      } else { // Log
        g.beginFill(0x5a3a1a); g.drawEllipse(0, -5 * s, 20 * s, 7 * s); g.endFill();
        g.beginFill(0x7a5a3a); g.drawCircle(-18 * s, -5 * s, 7 * s); g.endFill();
        g.beginFill(0x4a2a0a); g.drawCircle(-18 * s, -5 * s, 4 * s); g.endFill();
      }
      break;
  }
  return g;
}

function _drawGroundDetail(x: number, groundY: number): any {
  var g = new PIXI.Graphics();
  g.x = x;
  g.y = groundY;
  var ds = 2.5; // ground detail scale
  switch (THEME) {
    case 'volcanic':
      // Lava cracks
      g.lineStyle(3, 0xff4400, 0.7); g.moveTo(-20 * ds, 4); g.lineTo(0, -6); g.lineTo(20 * ds, 2); g.lineTo(28 * ds, 8);
      g.lineStyle(2, 0xff6600, 0.4); g.moveTo(-12 * ds, 8); g.lineTo(6 * ds, -2); g.lineTo(22 * ds, 10);
      g.beginFill(0xff3300, 0.2); g.drawEllipse(0, 2, 16 * ds, 4); g.endFill();
      break;
    case 'arctic':
      // Snow mound
      g.beginFill(0xddeeff, 0.7); g.drawEllipse(0, 0, 35, 10); g.endFill();
      g.beginFill(0xeef4ff, 0.5); g.drawEllipse(5, -3, 22, 6); g.endFill();
      break;
    case 'candy':
      // Sprinkles on ground
      var sc = [0xff6699, 0x66ccff, 0xffcc33, 0x66ff99, 0xff66ff];
      for (var j = 0; j < 8; j++) { g.beginFill(sc[j % sc.length]); g.drawRoundedRect(_rngRange(-20, 20), _rngRange(-4, 4), 8, 3, 1); g.endFill(); }
      break;
    case 'space':
      // Glowing crack
      g.lineStyle(2, 0x4488ff, 0.6); g.moveTo(-15, 4); g.lineTo(0, -4); g.lineTo(18, 6);
      g.beginFill(0x4488ff, 0.2); g.drawCircle(0, 0, 16); g.endFill();
      g.beginFill(0x88aaff, 0.1); g.drawCircle(0, 0, 25); g.endFill();
      break;
    case 'dark':
      // Purple mist
      g.beginFill(0x6633aa, 0.15); g.drawEllipse(0, -5, 40, 14); g.endFill();
      g.beginFill(0x8844cc, 0.08); g.drawEllipse(0, -8, 55, 18); g.endFill();
      break;
    case 'ocean':
      // Bubbles
      g.beginFill(0x66aadd, 0.35); g.drawCircle(-6, -8, 6); g.drawCircle(8, -14, 4.5); g.drawCircle(0, -22, 3); g.drawCircle(-10, -18, 2.5); g.endFill();
      break;
    default:
      // Grass tufts
      g.beginFill(0x55aa33, 0.6);
      g.moveTo(-10, 0); g.lineTo(-6, -16); g.lineTo(-2, 0);
      g.moveTo(4, 0); g.lineTo(8, -12); g.lineTo(12, 0);
      g.moveTo(-3, 0); g.lineTo(1, -10); g.lineTo(5, 0);
      g.endFill();
      break;
  }
  return g;
}

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
  private scoreText: any;
  private livesContainer: any;
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
    setNoiseSeed(_seed); // Sync noise with game seed for reproducible terrain

    var W = engine.config.width;
    var H = engine.config.height;
    var WW = CONFIG.worldWidth;
    var WH = CONFIG.worldHeight;

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
    } catch(e) { /* fog optional */ }

    // ---- 4. CLOUDS / SKY OBJECTS (theme-aware) ----
    if (THEME !== 'space' && THEME !== 'dark') {
      var cloudCount = _rngInt(5, 10);
      for (var ci = 0; ci < cloudCount; ci++) {
        var cw = _rngRange(80, 200);
        var ch = _rngRange(25, 45);
        var cloud = drawCloud(cw, ch);
        cloud.x = _rngRange(0, WW);
        cloud.y = _rngRange(50, CONFIG.groundY * 0.4);
        if (THEME === 'volcanic') { cloud.tint = 0x997766; cloud.alpha = 0.5; } // smoke
        this.container.addChild(cloud);
        this.clouds.push({ gfx: cloud, speed: _rngRange(5, 15) });
      }
    }

    // ---- 5. THEME-SPECIFIC DECORATIONS (PRNG) ----
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

    // ---- 6. GROUND (drawn before trees so trees appear in front) ----
    var floorH = WH - CONFIG.groundY;
    var ground = drawGroundStrip(WW, CONFIG.groundY, floorH, PAL.ground, PAL.groundTop, THEME);
    this.container.addChild(ground);
    var groundBody = createStaticBody(WW / 2, CONFIG.groundY + 4, WW, 8);
    this.physics.addBody(groundBody);

    // ---- 6b. L-SYSTEM TREES (drawn after ground so they're visible) ----
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

    // ---- 6c. GROUND DETAILS (theme-specific texture) ----
    var groundDetailCount = _rngInt(12, 24);
    var gdSpacing = CONFIG.worldWidth / groundDetailCount;
    for (var gdi = 0; gdi < groundDetailCount; gdi++) {
      var gdx = gdi * gdSpacing + _rngRange(10, gdSpacing - 10);
      var gd = _drawGroundDetail(gdx, CONFIG.groundY);
      this.container.addChild(gd);
    }

    // ---- 7. PLATFORMS (PRNG layout based on levelShape) ----
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

    // ---- 9. COINS (PRNG placement: 60% on platforms, 40% ground) ----
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

    // ---- 10. ENEMIES (PRNG positions + patrol ranges) ----
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

    // ---- 11. COLLISION HANDLER ----
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
        if (self.scoreText) {
          self.scoreText.text = String(self.score);
          engine.juice.pop(self.scoreText, 1.4, 0.25);
        }
      }
      if (enemy && player && enemy.enabled !== false && self.invincibleTimer <= 0) {
        self.lives--;
        self.invincibleTimer = 1.5;
        engine.juice.shake(engine.world, 10, 0.3);
        engine.juice.hitPause(engine.app, 80);
        engine.juice.flash(self.playerGfx, 0xff0000, 0.15);
        onDeathExplosion(engine.proton, enemy.x, enemy.y, '#ff4444');
        self.playerBody.vy = -350;
        self.updateLivesDisplay(engine);
        if (self.lives <= 0) {
          engine.scene.switch('gameover', { score: self.score });
        }
      }
    });

    // ---- 12. AMBIENT PARTICLES (enhanced) ----
    try {
      if (PAL.weather === 'snow') {
        var snowFx = createSnowEffect(W, H, 0.5);
        if (snowFx && snowFx.emitter) engine.addEmitter(snowFx.emitter);
        // Snow accumulation dots on platforms
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
      // Extra firefly glow for forest/dark
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
          this.decorTrees.push(ffGlow); // reuse sway for gentle float
        }
      }
    } catch(e) { /* particle effects optional */ }

    // ---- 13. UI LAYER ----
    var scoreLbl = engine.createText('SCORE', { fontSize: 12, fill: 0x888888 });
    scoreLbl.x = 20;
    scoreLbl.y = 12;
    engine.ui.addChild(scoreLbl);

    this.scoreText = engine.createText('0', {
      fontSize: 32, fill: 0xffffff, fontWeight: 'bold',
      stroke: { color: 0x000000, width: 5 },
    });
    this.scoreText.x = 20;
    this.scoreText.y = 26;
    engine.ui.addChild(this.scoreText);

    this.livesContainer = new PIXI.Container();
    this.livesContainer.x = W - 20;
    this.livesContainer.y = 24;
    engine.ui.addChild(this.livesContainer);
    this.updateLivesDisplay(engine);

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

    // Per-object filters: only player shadow (coins use built-in glow circle, no filter)
    var _PIXI = (window as any).PIXI;
    if (_PIXI.filters && _PIXI.filters.DropShadowFilter && !this.playerGfx.filters) {
      this.playerGfx.filters = [new _PIXI.filters.DropShadowFilter({
        offset: { x: 3, y: 5 }, blur: 5, alpha: 0.5, color: 0x000000,
      })];
    }

    // ---- 15b. DYNAMIC WATER/LAVA SURFACE (above ground so visible) ----
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
    } catch(e) { /* water/lava optional */ }

    // ---- 16. LIGHTING LAYER (additive blend) ----
    try {
      var decorPositions = decData.map(function(d: any) { return { x: d.x, y: CONFIG.groundY }; });
      var lightLayer = createLightingLayer(THEME, WW, CONFIG.groundY, decorPositions);
      this.container.addChild(lightLayer);
    } catch(e) { /* lighting optional */ }

    // ---- 17. POST-PROCESSING (biome color grading on world) ----
    try { applyBiomePostProcessing(THEME, this.container); } catch(e) {}

    // ---- 18. VIGNETTE (on UI layer, fixed position) ----
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
  }

  private updateLivesDisplay(engine: Engine2D): void {
    this.livesContainer.removeChildren();
    for (var i = 0; i < this.lives; i++) {
      var heart = drawHeart(14, 0xff3355);
      heart.x = -(i * 28) - 14;
      heart.y = 0;
      this.livesContainer.addChild(heart);
    }
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
        if (vy < -100) {
          this.playerGfx.scale.y = 1.15;
        } else if (vy > 100) {
          this.playerGfx.scale.y = 0.9;
        }
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

    // ---- Vegetation sway (wind-driven) ----
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

    // ---- Animate clouds (wind-affected) ----
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

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    engine.juice.killAll();
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
}
`;

/** Runner skeleton — AI generates all gameplay in enter()/update() */
export const GAME_2D_SCENE_STARTER_RUNNER = `import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
import { createBody, createStaticBody, PhysicsWorld, CharacterController } from "../engine/physics";
import { createAmbientEffect, createSnowEffect, createRainEffect, onJumpDust, onLandImpact, onDeathExplosion, onCollectSparkle } from "../engine/effects";
import { PALETTES, lerpColor, setNoiseSeed, drawSkyGradient, drawStars, drawMountainRange, drawCloud, drawGroundStrip, drawPlatformBlock, drawPlayerCharacter, drawCoinToken, drawEnemySlime, drawHeart, applyBiomePostProcessing, drawVignette, drawAtmosphericFog, drawLSystemTree, TREE_PRESETS, drawPointLight, createLightingLayer } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;
var THEME = 'sunset';
var PAL = PALETTES[THEME] || PALETTES.forest;
var CONFIG = {
  gravity: 1400, jumpForce: 620, groundY: 600, playerX: 150, playerSize: 44,
  startSpeed: 220, maxSpeed: 550, speedRamp: 0.4, gapChance: 0.25,
  coinChance: 0.6, platformMinW: 120, platformMaxW: 280, lives: 1,
};

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private physics!: PhysicsWorld;
  private playerGfx: any; private playerBody: any; private playerCtrl!: CharacterController;
  private score = 0; private distance = 0; private speed = CONFIG.startSpeed;
  private scoreText: any; private distText: any;
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
    setNoiseSeed(Date.now() % 10000);
    var W = engine.config.width, H = engine.config.height, WW = W * 4;

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
      var pw = CONFIG.platformMinW + Math.random() * (CONFIG.platformMaxW - CONFIG.platformMinW);
      var platGfx = drawPlatformBlock(pw, 30, PAL.ground, PAL.groundTop, THEME);
      platGfx.x = px; platGfx.y = CONFIG.groundY;
      this.container.addChild(platGfx);
      var platBody = createStaticBody(px + pw / 2, CONFIG.groundY + 4, pw, 8);
      this.physics.addBody(platBody);
      this.platforms.push({ gfx: platGfx, body: platBody, w: pw });
      // Coin above platform
      if (Math.random() < CONFIG.coinChance) {
        var coinGfx = drawCoinToken(8, PAL.coin, PAL.coinGlow);
        coinGfx.x = px + pw / 2; coinGfx.y = CONFIG.groundY - 50;
        this.container.addChild(coinGfx);
        var coinBody = createBody(coinGfx.x, coinGfx.y, 14, 14, { isStatic: true, isSensor: true, tag: 'coin' });
        coinBody.sprite = coinGfx; this.physics.addBody(coinBody);
        this.coins.push({ gfx: coinGfx, body: coinBody });
      }
      px += pw + (Math.random() < CONFIG.gapChance ? 60 + Math.random() * 80 : 0);
    }

    // ---- TREES ----
    var tp = TREE_PRESETS[THEME] || [];
    if (tp.length > 0) { for (var ti = 0; ti < 5; ti++) {
      var tree = drawLSystemTree(ti * (WW / 5) + Math.random() * 150, CONFIG.groundY, tp[ti % tp.length], THEME, Date.now() + ti);
      this.container.addChild(tree); this.treeSway.push(tree);
    }}

    // ---- LIGHTING + POST-PROCESSING ----
    try { this.container.addChild(createLightingLayer(THEME, WW, CONFIG.groundY, [])); } catch(e) {}
    try { applyBiomePostProcessing(THEME, this.container); } catch(e) {}

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
      if (coin && coin.enabled !== false) { onCollectSparkle(engine.proton, coin.x, coin.y); coin.sprite.visible = false; coin.enabled = false; self.score += 10; }
    });

    // ---- UI ----
    this.scoreText = engine.createText('0', { fontSize: 28, fill: 0xffffff, fontWeight: 'bold', stroke: { color: 0x000000, width: 4 } });
    this.scoreText.x = 20; this.scoreText.y = 20; engine.ui.addChild(this.scoreText);
    var lbl = engine.createText('DISTANCE', { fontSize: 11, fill: 0x888888 }); lbl.x = 20; lbl.y = 52; engine.ui.addChild(lbl);
    this.distText = engine.createText('0m', { fontSize: 18, fill: 0xffdd44 }); this.distText.x = 20; this.distText.y = 64; engine.ui.addChild(this.distText);
    try { engine.ui.addChild(drawVignette(W, H)); } catch(e) {}

    // ---- CAMERA ----
    engine.camera.follow(this.playerBody); engine.camera.worldWidth = WW; engine.camera.worldHeight = H; engine.camera.smoothing = 0.06;
    engine.juice.breathe(this.playerGfx, 1.03, 1.5);
    try { if (PAL.ambient) { var af = createAmbientEffect(PAL.ambient as any, W, H); if (af && af.emitter) engine.addEmitter(af.emitter); } } catch(e) {}
  }

  update(engine: Engine2D, dt: number): void {
    if (this.gameOver || !this.playerGfx) { engine.input.endFrame(); return; }
    this.physics.update(dt);

    // Auto-run: move player right at current speed
    if (this.playerBody) {
      this.playerBody.vx = this.speed;
      this.playerGfx.x = this.playerBody.x; this.playerGfx.y = this.playerBody.y;
    }
    // Jump on input
    if (this.playerCtrl) { this.playerCtrl.update({ left: false, right: false, jump: engine.input.jump }, dt); }
    // Speed ramp
    this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.speedRamp * dt);
    this.distance += this.speed * dt * 0.01;
    if (this.distText) this.distText.text = Math.floor(this.distance) + 'm';
    if (this.scoreText) this.scoreText.text = String(this.score + Math.floor(this.distance));

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
      engine.scene.switch('gameover', { score: this.score + Math.floor(this.distance) });
    }
    engine.input.endFrame();
  }

  exit(engine: Engine2D): void { engine.juice.killAll(); this.container.removeChildren(); engine.ui.removeChildren(); }
}
`;

/** Puzzle hybrid starter — fully playable match-3 gem game */
export const GAME_2D_SCENE_STARTER_PUZZLE = `import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
import { onCollectSparkle, createAmbientEffect } from "../engine/effects";
import { PALETTES, lerpColor, setNoiseSeed, drawSkyGradient, drawStars, drawHeart, drawGemShape, applyBiomePostProcessing, drawVignette, drawAtmosphericFog, drawPointLight, createLightingLayer } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;
var THEME = 'candy';
var PAL = PALETTES[THEME] || PALETTES.candy;
var CONFIG = {
  cols: 7, rows: 7, cellSize: 52, padding: 3,
  gemColors: [0xff4466, 0x44aaff, 0x44dd44, 0xffaa22, 0xcc44ff, 0x44ffdd],
  matchMin: 3, fallSpeed: 500, swapDur: 0.15,
};

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private board: any; private grid: { color: number; gfx: any; row: number; col: number }[][] = [];
  private score = 0; private scoreText: any;
  private selected: { r: number; c: number } | null = null;
  private animating = false;
  private boardX = 0; private boardY = 0;

  constructor() { this.container = new PIXI.Container(); }

  async enter(engine: Engine2D): Promise<void> {
    this.score = 0; this.selected = null; this.animating = false; this.grid = [];
    await _loadSpriteLib(THEME);
    setNoiseSeed(Date.now() % 10000);
    var W = engine.config.width, H = engine.config.height;

    // ---- VISUAL ATMOSPHERE ----
    this.container.addChild(drawSkyGradient(W, H, PAL.skyTop, PAL.skyBottom));
    this.container.addChild(drawStars(W, H * 0.35, 35));
    try { var fl = drawAtmosphericFog(W, H * 0.85, THEME); for (var f = 0; f < fl.length; f++) this.container.addChild(fl[f]); } catch(e) {}
    try { this.container.addChild(createLightingLayer(THEME, W, H * 0.85, [])); } catch(e) {}
    try { applyBiomePostProcessing(THEME, this.container); } catch(e) {}
    try { if (PAL.ambient) { var af = createAmbientEffect(PAL.ambient as any, W, H); if (af && af.emitter) engine.addEmitter(af.emitter); } } catch(e) {}

    // ---- BOARD ----
    var bw = CONFIG.cols * (CONFIG.cellSize + CONFIG.padding);
    var bh = CONFIG.rows * (CONFIG.cellSize + CONFIG.padding);
    this.boardX = (W - bw) / 2; this.boardY = (H - bh) / 2 + 30;
    this.board = new PIXI.Container(); this.board.x = this.boardX; this.board.y = this.boardY;
    // Board background
    var bg = new PIXI.Graphics(); bg.roundRect(-10, -10, bw + 20, bh + 20, 12); bg.fill({ color: 0x000000, alpha: 0.3 });
    this.board.addChild(bg);
    this.container.addChild(this.board);

    // Fill grid (no initial matches)
    for (var r = 0; r < CONFIG.rows; r++) {
      this.grid[r] = [];
      for (var c = 0; c < CONFIG.cols; c++) {
        var ci2 = Math.floor(Math.random() * CONFIG.gemColors.length);
        // Prevent 3-in-a-row on creation
        while ((c >= 2 && this.grid[r][c-1] && this.grid[r][c-2] && CONFIG.gemColors[ci2] === this.grid[r][c-1].color && CONFIG.gemColors[ci2] === this.grid[r][c-2].color) ||
               (r >= 2 && this.grid[r-1] && this.grid[r-2] && this.grid[r-1][c] && this.grid[r-2][c] && CONFIG.gemColors[ci2] === this.grid[r-1][c].color && CONFIG.gemColors[ci2] === this.grid[r-2][c].color)) {
          ci2 = (ci2 + 1) % CONFIG.gemColors.length;
        }
        var gem = this._createGem(c, r, CONFIG.gemColors[ci2]);
        this.grid[r][c] = gem;
      }
    }

    // ---- INPUT (click to select/swap) ----
    var self = this;
    this.board.eventMode = 'static';
    this.board.on('pointerdown', function(e: any) {
      if (self.animating) return;
      var lp = self.board.toLocal(e.global);
      var col = Math.floor(lp.x / (CONFIG.cellSize + CONFIG.padding));
      var row = Math.floor(lp.y / (CONFIG.cellSize + CONFIG.padding));
      if (col < 0 || col >= CONFIG.cols || row < 0 || row >= CONFIG.rows) return;
      if (!self.selected) { self.selected = { r: row, c: col }; self.grid[row][col].gfx.alpha = 0.6; return; }
      var dr = Math.abs(self.selected.r - row), dc = Math.abs(self.selected.c - col);
      self.grid[self.selected.r][self.selected.c].gfx.alpha = 1;
      if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) { self._swap(self.selected.r, self.selected.c, row, col, engine); }
      self.selected = null;
    });

    // ---- UI ----
    var lbl = engine.createText('SCORE', { fontSize: 13, fill: 0xaaaaaa }); lbl.x = W / 2; lbl.y = 12; lbl.anchor.set(0.5, 0); engine.ui.addChild(lbl);
    this.scoreText = engine.createText('0', { fontSize: 32, fill: 0xffffff, fontWeight: 'bold', stroke: { color: 0x000000, width: 4 } });
    this.scoreText.x = W / 2; this.scoreText.y = 28; this.scoreText.anchor.set(0.5, 0); engine.ui.addChild(this.scoreText);
    try { engine.ui.addChild(drawVignette(W, H)); } catch(e) {}
  }

  private _createGem(col: number, row: number, color: number): any {
    var s = CONFIG.cellSize;
    var g = new PIXI.Graphics();
    g.roundRect(0, 0, s, s, 8); g.fill(color);
    g.roundRect(3, 3, s * 0.4, s * 0.3, 4); g.fill({ color: 0xffffff, alpha: 0.25 });
    g.x = col * (s + CONFIG.padding); g.y = row * (s + CONFIG.padding);
    this.board.addChild(g);
    return { color: color, gfx: g, row: row, col: col };
  }

  private _swap(r1: number, c1: number, r2: number, c2: number, engine: Engine2D): void {
    this.animating = true;
    var a = this.grid[r1][c1], b = this.grid[r2][c2];
    // Swap in grid
    this.grid[r1][c1] = b; this.grid[r2][c2] = a;
    b.row = r1; b.col = c1; a.row = r2; a.col = c2;
    var s = CONFIG.cellSize + CONFIG.padding;
    var self = this;
    // Animate positions
    var gsap = (window as any).gsap;
    if (gsap) {
      gsap.to(a.gfx, { x: c2 * s, y: r2 * s, duration: CONFIG.swapDur });
      gsap.to(b.gfx, { x: c1 * s, y: r1 * s, duration: CONFIG.swapDur, onComplete: function() { self._checkMatches(engine); } });
    } else { a.gfx.x = c2 * s; a.gfx.y = r2 * s; b.gfx.x = c1 * s; b.gfx.y = r1 * s; self._checkMatches(engine); }
  }

  private _checkMatches(engine: Engine2D): void {
    var matched: boolean[][] = [];
    for (var r = 0; r < CONFIG.rows; r++) { matched[r] = []; for (var c = 0; c < CONFIG.cols; c++) matched[r][c] = false; }
    // Horizontal
    for (var r2 = 0; r2 < CONFIG.rows; r2++) {
      for (var c2 = 0; c2 < CONFIG.cols - 2; c2++) {
        if (this.grid[r2][c2].color === this.grid[r2][c2+1].color && this.grid[r2][c2].color === this.grid[r2][c2+2].color) {
          matched[r2][c2] = matched[r2][c2+1] = matched[r2][c2+2] = true;
        }
      }
    }
    // Vertical
    for (var c3 = 0; c3 < CONFIG.cols; c3++) {
      for (var r3 = 0; r3 < CONFIG.rows - 2; r3++) {
        if (this.grid[r3][c3].color === this.grid[r3+1][c3].color && this.grid[r3][c3].color === this.grid[r3+2][c3].color) {
          matched[r3][c3] = matched[r3+1][c3] = matched[r3+2][c3] = true;
        }
      }
    }
    // Remove matched
    var count = 0;
    for (var r4 = 0; r4 < CONFIG.rows; r4++) {
      for (var c4 = 0; c4 < CONFIG.cols; c4++) {
        if (matched[r4][c4]) { count++; this.grid[r4][c4].gfx.visible = false; try { onCollectSparkle(engine.proton, this.boardX + c4 * (CONFIG.cellSize + CONFIG.padding) + CONFIG.cellSize / 2, this.boardY + r4 * (CONFIG.cellSize + CONFIG.padding) + CONFIG.cellSize / 2); } catch(e) {} }
      }
    }
    if (count === 0) { this.animating = false; return; }
    this.score += count * 10;
    if (this.scoreText) { this.scoreText.text = String(this.score); engine.juice.pop(this.scoreText, 1.3, 0.2); }
    // Cascade: drop gems down, fill top
    var self = this;
    setTimeout(function() { self._cascade(engine); }, 200);
  }

  private _cascade(engine: Engine2D): void {
    var s = CONFIG.cellSize + CONFIG.padding;
    var gsap = (window as any).gsap;
    for (var c = 0; c < CONFIG.cols; c++) {
      var writeRow = CONFIG.rows - 1;
      for (var r = CONFIG.rows - 1; r >= 0; r--) {
        if (this.grid[r][c].gfx.visible) {
          if (r !== writeRow) {
            var gem = this.grid[r][c];
            this.grid[writeRow][c] = gem; gem.row = writeRow; gem.col = c;
            if (gsap) gsap.to(gem.gfx, { y: writeRow * s, duration: 0.15 }); else gem.gfx.y = writeRow * s;
          }
          writeRow--;
        }
      }
      // Destroy invisible gems to prevent memory leak
      for (var dr = writeRow; dr >= 0; dr--) {
        if (this.grid[dr][c] && this.grid[dr][c].gfx) { this.grid[dr][c].gfx.destroy(); }
      }
      // Fill empty top rows
      for (var nr = writeRow; nr >= 0; nr--) {
        var ci = Math.floor(Math.random() * CONFIG.gemColors.length);
        var newGem = this._createGem(c, nr, CONFIG.gemColors[ci]);
        newGem.gfx.y = -s; // start above board
        this.grid[nr][c] = newGem;
        if (gsap) gsap.to(newGem.gfx, { y: nr * s, duration: 0.2, delay: (writeRow - nr) * 0.03 }); else newGem.gfx.y = nr * s;
      }
    }
    var self = this;
    setTimeout(function() { self._checkMatches(engine); }, 300);
  }

  update(engine: Engine2D, dt: number): void { engine.input.endFrame(); }
  exit(engine: Engine2D): void { this.container.removeChildren(); engine.ui.removeChildren(); }
}
`;

/** Shooter hybrid starter — fully playable space shooter */
export const GAME_2D_SCENE_STARTER_SHOOTER = `import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
import { createExplosionEffect, createAmbientEffect, onDeathExplosion, onCollectSparkle } from "../engine/effects";
import { PALETTES, lerpColor, setNoiseSeed, drawSkyGradient, drawStars, drawCoinToken, drawHeart, drawShipShape, applyBiomePostProcessing, drawVignette, drawAtmosphericFog, drawPointLight, createLightingLayer } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;
var THEME = 'space';
var PAL = PALETTES[THEME] || PALETTES.space;
var CONFIG = {
  playerSpeed: 320, bulletSpeed: 650, fireRate: 0.14,
  enemyBaseSpeed: 100, enemySpawnRate: 1.4, lives: 3, playerSize: 48,
  enemySize: 44, bulletW: 6, bulletH: 18,
};

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private playerGfx: any;
  private score = 0; private lives = CONFIG.lives; private fireCooldown = 0; private spawnTimer = 0; private wave = 1;
  private scoreText: any; private livesContainer: any;
  private bullets: { gfx: any; vy: number }[] = [];
  private enemies: { gfx: any; vx: number; vy: number; hp: number }[] = [];
  private stars: any;

  constructor() { this.container = new PIXI.Container(); }

  async enter(engine: Engine2D): Promise<void> {
    this.score = 0; this.lives = CONFIG.lives; this.fireCooldown = 0; this.spawnTimer = 0; this.wave = 1;
    this.bullets = []; this.enemies = [];
    await _loadSpriteLib(THEME);
    setNoiseSeed(Date.now() % 10000);
    var W = engine.config.width, H = engine.config.height;

    // ---- VISUAL ATMOSPHERE (brighter for shooter visibility) ----
    // Use a slightly lighter sky gradient for shooters
    var skyT = PAL.skyTop, skyB = PAL.skyBottom;
    var skyGfx = new PIXI.Graphics();
    if (PIXI.FillGradient) {
      var sg = new PIXI.FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
        colorStops: [{ offset: 0, color: '#0a0a2e' }, { offset: 0.5, color: '#1a1a4e' }, { offset: 1, color: '#2a1a3e' }] });
      skyGfx.rect(0, 0, W, H); skyGfx.fill(sg);
    } else { skyGfx.rect(0, 0, W, H); skyGfx.fill(0x0a0a2e); }
    this.container.addChild(skyGfx);
    this.stars = drawStars(W, H, 150); this.container.addChild(this.stars);
    // Skip heavy fog/lighting/color grading — shooter needs bright, clear visuals
    try { if (PAL.ambient) { var af = createAmbientEffect(PAL.ambient as any, W, H); if (af && af.emitter) engine.addEmitter(af.emitter); } } catch(e) {}

    // ---- PLAYER SHIP (larger, with glow) ----
    this.playerGfx = drawShipShape(CONFIG.playerSize, PAL.player, PAL.playerLight);
    this.playerGfx.x = W / 2; this.playerGfx.y = H - 90;
    this.container.addChild(this.playerGfx);

    // ---- UI ----
    this.scoreText = engine.createText('0', { fontSize: 28, fill: 0xffffff, fontWeight: 'bold', stroke: { color: 0x000000, width: 4 } });
    this.scoreText.x = 20; this.scoreText.y = 16; engine.ui.addChild(this.scoreText);
    var lbl = engine.createText('WAVE 1', { fontSize: 13, fill: 0x888888 }); lbl.x = 20; lbl.y = 48; engine.ui.addChild(lbl);
    this.livesContainer = new PIXI.Container(); this.livesContainer.x = W - 20; this.livesContainer.y = 24;
    engine.ui.addChild(this.livesContainer); this._updateLives(engine);
    try { engine.ui.addChild(drawVignette(W, H)); } catch(e) {}
  }

  private _updateLives(engine: Engine2D): void {
    this.livesContainer.removeChildren();
    for (var i = 0; i < this.lives; i++) { var h = drawHeart(12, 0xff3355); h.x = -(i * 24) - 12; this.livesContainer.addChild(h); }
  }

  private _spawnEnemy(W: number): void {
    var container = new PIXI.Container();
    var g = new PIXI.Graphics();
    var sz = CONFIG.enemySize;
    var eColor = [0xff4444, 0xff8844, 0xffaa00, 0xcc44ff, 0x44ffaa][Math.floor(Math.random() * 5)];
    // Body — angular alien ship shape
    g.moveTo(0, sz * 0.5); g.lineTo(-sz * 0.45, -sz * 0.2); g.lineTo(-sz * 0.2, -sz * 0.15);
    g.lineTo(0, -sz * 0.5); g.lineTo(sz * 0.2, -sz * 0.15); g.lineTo(sz * 0.45, -sz * 0.2); g.closePath();
    g.fill(eColor);
    // Bright cockpit
    g.circle(0, -sz * 0.05, sz * 0.12); g.fill(0xffffff);
    g.circle(0, -sz * 0.05, sz * 0.08); g.fill(eColor);
    // Wing accents
    g.moveTo(-sz * 0.35, -sz * 0.1); g.lineTo(-sz * 0.2, sz * 0.1); g.lineTo(-sz * 0.15, -sz * 0.05); g.closePath();
    g.fill({ color: 0xffffff, alpha: 0.2 });
    g.moveTo(sz * 0.35, -sz * 0.1); g.lineTo(sz * 0.2, sz * 0.1); g.lineTo(sz * 0.15, -sz * 0.05); g.closePath();
    g.fill({ color: 0xffffff, alpha: 0.2 });
    container.addChild(g);
    // Glow for visibility
    if (PIXI.filters && PIXI.filters.GlowFilter) {
      try { container.filters = [new PIXI.filters.GlowFilter({ distance: 8, outerStrength: 1.5, color: eColor })]; } catch(e) {}
    }
    container.x = 40 + Math.random() * (W - 80); container.y = -40;
    this.container.addChild(container);
    var vx = (Math.random() - 0.5) * 80;
    var vy = CONFIG.enemyBaseSpeed * (0.8 + Math.random() * 0.4 + this.wave * 0.08);
    this.enemies.push({ gfx: container, vx: vx, vy: vy, hp: 1 });
  }

  private _fireBullet(): void {
    var g = new PIXI.Graphics();
    var bw = CONFIG.bulletW, bh = CONFIG.bulletH;
    // Outer glow
    g.roundRect(-bw, -bh - 2, bw * 2, bh + 4, 3);
    g.fill({ color: 0x44ddff, alpha: 0.3 });
    // Core bullet
    g.roundRect(-bw / 2, -bh, bw, bh, 2);
    g.fill(0x44ddff);
    // Hot center
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

    // Auto-fire (guard: playerGfx must exist — enter() is async)
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
      // Off screen
      if (en.gfx.y > H + 40) { en.gfx.destroy(); this.enemies.splice(ei, 1); continue; }
      // Hit player
      if (this.playerGfx && Math.abs(en.gfx.x - this.playerGfx.x) < 28 && Math.abs(en.gfx.y - this.playerGfx.y) < 28) {
        try { onDeathExplosion(engine.proton, en.gfx.x, en.gfx.y, '#ff4444'); } catch(e) {}
        en.gfx.destroy(); this.enemies.splice(ei, 1);
        this.lives--; this._updateLives(engine);
        engine.juice.shake(engine.world, 8, 0.25);
        if (this.lives <= 0) { engine.scene.switch('gameover', { score: this.score }); }
        continue;
      }
      // Bullet-enemy collision
      for (var bj = this.bullets.length - 1; bj >= 0; bj--) {
        var bl = this.bullets[bj];
        if (Math.abs(bl.gfx.x - en.gfx.x) < 20 && Math.abs(bl.gfx.y - en.gfx.y) < 22) {
          try { onCollectSparkle(engine.proton, en.gfx.x, en.gfx.y); } catch(e) {}
          en.gfx.destroy(); this.enemies.splice(ei, 1);
          bl.gfx.destroy(); this.bullets.splice(bj, 1);
          this.score += 100; if (this.scoreText) { this.scoreText.text = String(this.score); engine.juice.pop(this.scoreText, 1.3, 0.15); }
          // Wave progression
          if (this.score > 0 && this.score % 1000 === 0) { this.wave++; }
          break;
        }
      }
    }

    // Star scroll
    if (this.stars) this.stars.y += 15 * dt;

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void { this.container.removeChildren(); engine.ui.removeChildren(); }
}
`;

// ============================================================================
// REFERENCE GAMES — Complete examples used in AI prompt for pattern learning
// ============================================================================

/** Reference platformer — complete example used in AI prompt for pattern learning */
export const GAME_2D_REFERENCE_PLATFORMER = `import { Engine2D, GameScene, createGame2D, loadAssets, JuiceSystem } from "../engine/core";
import { createBody, createStaticBody, createOneWayPlatform, PhysicsWorld, CharacterController } from "../engine/physics";
import { createAmbientEffect, createSnowEffect, createRainEffect, getThemeEffects, onJumpDust, onLandImpact, onCollectSparkle, onDeathExplosion } from "../engine/effects";
import { PALETTES, lerpColor, drawSkyGradient, drawStars, drawMountainRange, drawCloud, drawTree, drawGroundStrip, drawPlatformBlock, drawPlayerCharacter, drawCoinToken, drawEnemySlime, drawHeart } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;

// ======================== CONFIGURATION ========================
var THEME = 'sunset'; // Change to: forest, sunset, space, volcanic, candy, arctic, dark, ocean
var PAL = PALETTES[THEME] || PALETTES.forest;

var CONFIG = {
  gravity: 980,
  worldWidth: 4000,
  worldHeight: 900,
  groundY: 680,
  playerSize: 48,
  playerStartX: 250,
  moveSpeed: 280,
  jumpForce: 520,
  coinRadius: 10,
  enemySize: 44,
  enemySpeed: 60,
  lives: 3,
};

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
  private scoreText: any;
  private livesContainer: any;
  private coins: { gfx: any; body: any; baseY: number }[] = [];
  private enemies: { gfx: any; body: any; startX: number; range: number; dir: number }[] = [];
  private clouds: { gfx: any; speed: number }[] = [];
  private bgLayers: { gfx: any; factor: number }[] = [];
  private stars: any;
  private decorTrees: any[] = [];
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
    this.invincibleTimer = 0;
    this.shakeTimer = 0;

    // Preload sprite library (silently falls back if no sprites available)
    await _loadSpriteLib(THEME);

    var W = engine.config.width;
    var H = engine.config.height;
    var WW = CONFIG.worldWidth;
    var WH = CONFIG.worldHeight;

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
      var mGfx = drawMountainRange(WW, mBaseY, mColor, mAlpha, mMinH, mMaxH, mSpacing);
      this.container.addChild(mGfx);
      this.bgLayers.push({ gfx: mGfx, factor: 0.1 + mi * 0.15 });
    }

    // ---- 4. CLOUDS ----
    for (var ci = 0; ci < 8; ci++) {
      var cw = 80 + Math.random() * 120;
      var ch = 25 + Math.random() * 20;
      var cloud = drawCloud(cw, ch);
      cloud.x = Math.random() * WW;
      cloud.y = 50 + Math.random() * (CONFIG.groundY * 0.4);
      this.container.addChild(cloud);
      this.clouds.push({ gfx: cloud, speed: 5 + Math.random() * 15 });
    }

    // ---- 5. DECORATIVE TREES ----
    var treePositions = [150, 500, 900, 1400, 1900, 2300, 2800, 3200, 3600];
    for (var ti = 0; ti < treePositions.length; ti++) {
      var tx = treePositions[ti] + Math.random() * 80 - 40;
      var th = 50 + Math.random() * 40;
      var tlr = 25 + Math.random() * 15;
      var tree = drawTree(th, tlr, 0x4a3020, PAL.foliage);
      tree.x = tx;
      tree.y = CONFIG.groundY;
      this.container.addChild(tree);
      this.decorTrees.push(tree);
    }

    // ---- 6. GROUND ----
    var floorH = WH - CONFIG.groundY;
    var ground = drawGroundStrip(WW, CONFIG.groundY, floorH, PAL.ground, PAL.groundTop);
    this.container.addChild(ground);
    var groundBody = createStaticBody(WW / 2, CONFIG.groundY + 4, WW, 8);
    this.physics.addBody(groundBody);

    // ---- 7. PLATFORMS ----
    var platforms = [
      { x: 400, y: 540, w: 160 },
      { x: 700, y: 460, w: 140 },
      { x: 1000, y: 520, w: 180 },
      { x: 1350, y: 420, w: 150 },
      { x: 1650, y: 500, w: 200 },
      { x: 2000, y: 380, w: 160 },
      { x: 2300, y: 460, w: 140 },
      { x: 2600, y: 540, w: 180 },
      { x: 2900, y: 400, w: 160 },
      { x: 3200, y: 480, w: 200 },
      { x: 3500, y: 360, w: 150 },
    ];
    for (var pi = 0; pi < platforms.length; pi++) {
      var p = platforms[pi];
      var platGfx = drawPlatformBlock(p.w, 24, PAL.platform, PAL.platformTop);
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
      doubleJump: true,
      wallSlide: false,
    });

    // ---- 9. COINS ----
    var coinPositions = [
      { x: 400, y: 500 }, { x: 440, y: 500 },
      { x: 700, y: 420 }, { x: 740, y: 420 },
      { x: 1000, y: 480 }, { x: 1050, y: 480 },
      { x: 1350, y: 380 }, { x: 1400, y: 380 },
      { x: 1650, y: 460 }, { x: 1700, y: 460 },
      { x: 2000, y: 340 }, { x: 2050, y: 340 },
      { x: 2300, y: 420 }, { x: 2600, y: 500 },
      { x: 2900, y: 360 }, { x: 3200, y: 440 },
      { x: 3500, y: 320 },
      // Ground coins
      { x: 550, y: 640 }, { x: 850, y: 640 },
      { x: 1200, y: 640 }, { x: 1500, y: 640 },
      { x: 1800, y: 640 }, { x: 2150, y: 640 },
      { x: 2450, y: 640 }, { x: 2750, y: 640 },
      { x: 3050, y: 640 }, { x: 3350, y: 640 },
    ];
    for (var coi = 0; coi < coinPositions.length; coi++) {
      var cp = coinPositions[coi];
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
    var enemyDefs = [
      { x: 600, range: 120 },
      { x: 1100, range: 100 },
      { x: 1700, range: 150 },
      { x: 2200, range: 100 },
      { x: 2800, range: 130 },
      { x: 3300, range: 120 },
    ];
    for (var ei = 0; ei < enemyDefs.length; ei++) {
      var ed = enemyDefs[ei];
      var enemyGfx = drawEnemySlime(CONFIG.enemySize, PAL.enemy, PAL.enemyLight);
      enemyGfx.x = ed.x;
      enemyGfx.y = CONFIG.groundY - 18;
      this.container.addChild(enemyGfx);
      var enemyBody = createBody(ed.x, CONFIG.groundY - 18, 32, 28, { isStatic: true, isSensor: true, tag: 'enemy' });
      enemyBody.sprite = enemyGfx;
      this.physics.addBody(enemyBody);
      this.enemies.push({ gfx: enemyGfx, body: enemyBody, startX: ed.x, range: ed.range, dir: 1 });
    }

    // ---- 11. COLLISION HANDLER ----
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
        if (self.scoreText) {
          self.scoreText.text = String(self.score);
          engine.juice.pop(self.scoreText, 1.4, 0.25);
        }
      }
      if (enemy && player && enemy.enabled !== false && self.invincibleTimer <= 0) {
        // Player hit by enemy — juice feedback
        self.lives--;
        self.invincibleTimer = 1.5;
        engine.juice.shake(engine.world, 10, 0.3);
        engine.juice.hitPause(engine.app, 80);
        engine.juice.flash(self.playerGfx, 0xff0000, 0.15);
        onDeathExplosion(engine.proton, enemy.x, enemy.y, '#ff4444');
        // Bounce player up
        self.playerBody.vy = -350;
        self.updateLivesDisplay(engine);
        if (self.lives <= 0) {
          engine.scene.switch('gameover', { score: self.score });
        }
      }
    });

    // ---- 12. AMBIENT PARTICLES ----
    try {
      if (PAL.weather === 'snow') {
        var snowFx = createSnowEffect(W, H, 0.4);
        if (snowFx && snowFx.emitter) engine.addEmitter(snowFx.emitter);
      } else if (PAL.weather === 'rain') {
        var rainFx = createRainEffect(W, H, 0.5);
        if (rainFx && rainFx.emitter) engine.addEmitter(rainFx.emitter);
      }
      if (PAL.ambient) {
        var ambientFx = createAmbientEffect(PAL.ambient as any, W, H);
        if (ambientFx && ambientFx.emitter) engine.addEmitter(ambientFx.emitter);
      }
    } catch(e) { /* particle effects optional */ }

    // ---- 13. UI LAYER ----
    // Score
    var scoreLbl = engine.createText('SCORE', { fontSize: 12, fill: 0x888888 });
    scoreLbl.x = 20;
    scoreLbl.y = 12;
    engine.ui.addChild(scoreLbl);

    this.scoreText = engine.createText('0', {
      fontSize: 32, fill: 0xffffff, fontWeight: 'bold',
      stroke: { color: 0x000000, width: 5 },
    });
    this.scoreText.x = 20;
    this.scoreText.y = 26;
    engine.ui.addChild(this.scoreText);

    // Lives
    this.livesContainer = new PIXI.Container();
    this.livesContainer.x = W - 20;
    this.livesContainer.y = 24;
    engine.ui.addChild(this.livesContainer);
    this.updateLivesDisplay(engine);

    // Controls hint
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
    // Float coins with GSAP bobbing
    for (var ji = 0; ji < this.coins.length; ji++) {
      engine.juice.float(this.coins[ji].gfx, 5, 2 + Math.random() * 0.5);
    }
    // Breathe player idle
    engine.juice.breathe(this.playerGfx, 1.03, 1.2);

    // Add GlowFilter on all coins
    var _PIXI = (window as any).PIXI;
    if (_PIXI.filters && _PIXI.filters.GlowFilter) {
      for (var fi = 0; fi < this.coins.length; fi++) {
        if (this.coins[fi].gfx && !this.coins[fi].gfx.filters) {
          this.coins[fi].gfx.filters = [new _PIXI.filters.GlowFilter({
            distance: 12, outerStrength: 2.5, innerStrength: 0.4, color: PAL.coinGlow,
          })];
        }
      }
    }

    // Add DropShadow to player if filters available
    if (_PIXI.filters && _PIXI.filters.DropShadowFilter && !this.playerGfx.filters) {
      this.playerGfx.filters = [new _PIXI.filters.DropShadowFilter({
        offset: { x: 3, y: 5 }, blur: 5, alpha: 0.5, color: 0x000000,
      })];
    }
  }

  private updateLivesDisplay(engine: Engine2D): void {
    this.livesContainer.removeChildren();
    for (var i = 0; i < this.lives; i++) {
      var heart = drawHeart(14, 0xff3355);
      heart.x = -(i * 28) - 14;
      heart.y = 0;
      this.livesContainer.addChild(heart);
    }
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

      // Face direction
      if (engine.input.left) this.lastPlayerFacing = -1;
      if (engine.input.right) this.lastPlayerFacing = 1;
      this.playerGfx.scale.x = this.lastPlayerFacing;

      // AnimatedSprite animation switching (when sprite sheets are loaded)
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
        if (vy < -100) {
          this.playerGfx.scale.y = 1.15; // Stretch on rise
        } else if (vy > 100) {
          this.playerGfx.scale.y = 0.9; // Squash on fall
        }
      } else {
        // Smoothly return to normal
        this.playerGfx.scale.y += (1 - this.playerGfx.scale.y) * 0.2;
      }

      // Jump dust
      if (!this.playerCtrl.body.onGround && wasOnGround && this.playerCtrl.body.vy < 0) {
        onJumpDust(engine.proton, this.playerCtrl.body.x, this.playerCtrl.body.y + 22);
      }
      // Land impact + squash & stretch via juice system
      if (this.playerCtrl.body.onGround && !wasOnGround) {
        onLandImpact(engine.proton, this.playerCtrl.body.x, this.playerCtrl.body.y + 22);
        engine.juice.squash(this.playerGfx, 0.7, 1.15);
      }
    }

    // ---- Invincibility timer + blink ----
    if (this.playerGfx) {
      if (this.invincibleTimer > 0) {
        this.invincibleTimer -= dt;
        this.playerGfx.alpha = Math.sin(this.invincibleTimer * 20) > 0 ? 1 : 0.3;
      } else {
        this.playerGfx.alpha = 1;
      }
    }

    // ---- Animate coins (bob + glow pulse) ----
    for (var c = 0; c < this.coins.length; c++) {
      var coin = this.coins[c];
      if (coin.gfx.visible) {
        coin.gfx.y = coin.baseY + Math.sin(engine.elapsed * 3 + coin.body.x * 0.01) * 5;
        coin.gfx.rotation = Math.sin(engine.elapsed * 2 + coin.body.x * 0.02) * 0.15;
        // Pulse the glow (first child is the glow ring)
        if (coin.gfx.children && coin.gfx.children[0]) {
          coin.gfx.children[0].alpha = 0.5 + 0.5 * Math.sin(engine.elapsed * 4 + coin.body.x * 0.03);
        }
        coin.body.y = coin.gfx.y;
      }
    }

    // ---- Animate enemies (patrol + squish) ----
    for (var e = 0; e < this.enemies.length; e++) {
      var en = this.enemies[e];
      if (en.body.enabled === false) continue;
      en.gfx.x += en.dir * CONFIG.enemySpeed * dt;
      en.body.x = en.gfx.x;
      if (en.gfx.x > en.startX + en.range) en.dir = -1;
      if (en.gfx.x < en.startX - en.range) en.dir = 1;
      en.gfx.scale.x = en.dir;
      // Squish animation
      en.gfx.scale.y = 1 + Math.sin(engine.elapsed * 5 + e) * 0.08;
    }

    // ---- Animate clouds ----
    for (var cl = 0; cl < this.clouds.length; cl++) {
      var cloud = this.clouds[cl];
      cloud.gfx.x += cloud.speed * dt;
      if (cloud.gfx.x > CONFIG.worldWidth + 150) {
        cloud.gfx.x = -150;
      }
    }

    // ---- Star twinkle ----
    if (this.stars) {
      this.stars.alpha = 0.6 + 0.4 * Math.sin(engine.elapsed * 0.5);
    }

    // ---- Fall death ----
    if (this.playerCtrl && this.playerCtrl.body.y > CONFIG.worldHeight + 100) {
      engine.scene.switch('gameover', { score: this.score });
    }

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    engine.juice.killAll();
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
}
`;

/** Reference runner — complete example used in AI prompt for pattern learning */
export const GAME_2D_REFERENCE_RUNNER = `import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
import { createBody, createStaticBody, PhysicsWorld } from "../engine/physics";
import { createAmbientEffect, onJumpDust, onLandImpact, onDeathExplosion, onCollectSparkle } from "../engine/effects";
import { PALETTES, lerpColor, drawSkyGradient, drawStars, drawMountainRange, drawCloud, drawGroundStrip, drawPlayerCharacter, drawCoinToken, drawEnemySlime, drawHeart } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;

var THEME = 'space';
var PAL = PALETTES[THEME] || PALETTES.forest;

var CONFIG = {
  gravity: 1400,
  jumpForce: 650,
  startSpeed: 280,
  maxSpeed: 600,
  speedRamp: 0.003,
  groundY: 520,
  playerX: 180,
  playerSize: 42,
  spawnInterval: 1.8,
  coinInterval: 0.8,
  lives: 1,
};

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private physics!: PhysicsWorld;
  private speed: number = CONFIG.startSpeed;
  private score = 0;
  private distance = 0;
  private scoreText: any;
  private playerGfx: any;
  private playerBody: any;
  private isJumping = false;
  private obstacles: { gfx: any; body: any }[] = [];
  private coins: { gfx: any; body: any; baseY: number }[] = [];
  private groundTiles: any[] = [];
  private bgLayers: { gfx: any; factor: number }[] = [];
  private clouds: { gfx: any; speed: number }[] = [];
  private spawnTimer = 2;
  private coinTimer = 0.5;
  private gameOver = false;

  constructor() {
    this.container = new PIXI.Container();
  }

  async enter(engine: Engine2D): Promise<void> {
    this.physics = new PhysicsWorld(CONFIG.gravity);
    this.speed = CONFIG.startSpeed;
    this.score = 0;
    this.distance = 0;
    this.obstacles = [];
    this.coins = [];
    this.groundTiles = [];
    this.bgLayers = [];
    this.clouds = [];
    this.spawnTimer = 2;
    this.coinTimer = 0.5;
    this.gameOver = false;

    await _loadSpriteLib(THEME);

    var W = engine.config.width;
    var H = engine.config.height;

    // Sky
    var sky = drawSkyGradient(W * 2, H, PAL.skyTop, PAL.skyBottom);
    this.container.addChild(sky);

    // Stars
    var stars = drawStars(W * 2, H * 0.5, 60);
    this.container.addChild(stars);

    // Mountains (2 layers, repeating)
    for (var mi = 0; mi < 2; mi++) {
      var mGfx = drawMountainRange(W * 3, CONFIG.groundY - mi * 40, PAL.mountains[mi] || 0x222233, 0.5 + mi * 0.2, 40 + mi * 20, 100 + mi * 30, 200);
      this.container.addChild(mGfx);
      this.bgLayers.push({ gfx: mGfx, factor: 0.1 + mi * 0.1 });
    }

    // Clouds
    for (var ci = 0; ci < 5; ci++) {
      var cloud = drawCloud(60 + Math.random() * 80, 20 + Math.random() * 15);
      cloud.x = Math.random() * W * 2;
      cloud.y = 40 + Math.random() * (CONFIG.groundY * 0.3);
      this.container.addChild(cloud);
      this.clouds.push({ gfx: cloud, speed: 8 + Math.random() * 12 });
    }

    // Ground (two tiles for seamless scrolling)
    for (var gi = 0; gi < 3; gi++) {
      var groundTile = drawGroundStrip(W, CONFIG.groundY, H - CONFIG.groundY, PAL.ground, PAL.groundTop);
      groundTile.x = gi * W;
      this.container.addChild(groundTile);
      this.groundTiles.push(groundTile);
    }
    var groundBody = createStaticBody(W * 1.5, CONFIG.groundY + 4, W * 3, 8);
    this.physics.addBody(groundBody);

    // Player
    this.playerGfx = drawPlayerCharacter(CONFIG.playerSize, PAL.player, PAL.playerLight);
    this.playerGfx.x = CONFIG.playerX;
    this.playerGfx.y = CONFIG.groundY - 25;
    this.container.addChild(this.playerGfx);

    this.playerBody = createBody(CONFIG.playerX, CONFIG.groundY - 25, 26, 40);
    this.playerBody.sprite = this.playerGfx;
    this.playerBody.tag = 'player';
    this.physics.addBody(this.playerBody);

    // Collision
    var self = this;
    this.physics.onSensorOverlap(function(a: any, b: any) {
      var coin = a.tag === 'coin' ? a : b.tag === 'coin' ? b : null;
      var obs = a.tag === 'obstacle' ? a : b.tag === 'obstacle' ? b : null;
      var player = a.tag === 'player' ? a : b.tag === 'player' ? b : null;
      if (coin && player && coin.enabled !== false) {
        onCollectSparkle(engine.proton, coin.x, coin.y);
        if (coin.sprite) coin.sprite.visible = false;
        coin.enabled = false;
        self.score += 50;
        if (self.scoreText) engine.juice.pop(self.scoreText, 1.3, 0.2);
      }
      if (obs && player && !self.gameOver) {
        self.gameOver = true;
        engine.juice.shake(engine.world, 12, 0.4);
        engine.juice.hitPause(engine.app, 100);
        engine.juice.flash(self.playerGfx, 0xff0000, 0.15);
        onDeathExplosion(engine.proton, self.playerBody.x, self.playerBody.y);
        setTimeout(function() { engine.scene.switch('gameover', { score: self.score }); }, 800);
      }
    });

    // Ambient effects
    if (PAL.ambient) { try { var ambientFx = createAmbientEffect(PAL.ambient as any, W, H); if (ambientFx && ambientFx.emitter) engine.addEmitter(ambientFx.emitter); } catch(e) {} }

    // UI
    this.scoreText = engine.createText('0', {
      fontSize: 36, fill: 0xffffff, fontWeight: 'bold',
      stroke: { color: 0x000000, width: 5 },
    });
    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.x = W / 2;
    this.scoreText.y = 16;
    engine.ui.addChild(this.scoreText);

    var hint = engine.createText('SPACE / TAP to jump', { fontSize: 12, fill: 0x666666 });
    hint.anchor.set(0.5, 1);
    hint.x = W / 2;
    hint.y = H - 8;
    engine.ui.addChild(hint);
  }

  update(engine: Engine2D, dt: number): void {
    if (this.gameOver) { engine.input.endFrame(); return; }

    this.physics.update(dt);
    this.distance += this.speed * dt;
    this.score = Math.max(this.score, Math.floor(this.distance / 8));
    this.speed = Math.min(CONFIG.maxSpeed, CONFIG.startSpeed + this.distance * CONFIG.speedRamp);
    if (this.scoreText) this.scoreText.text = String(this.score);

    // Keep player at fixed X
    this.playerBody.x = CONFIG.playerX;
    this.playerGfx.x = CONFIG.playerX;

    // Jump
    var wantsJump = engine.input.jump || engine.input.pointer.justDown;
    if (wantsJump && this.playerBody.onGround) {
      this.playerBody.vy = -CONFIG.jumpForce;
      onJumpDust(engine.proton, this.playerBody.x, this.playerBody.y + 20);
      this.isJumping = true;
    }
    if (this.playerBody.onGround && this.isJumping) {
      onLandImpact(engine.proton, this.playerBody.x, this.playerBody.y + 20);
      engine.juice.squash(this.playerGfx, 0.75, 1.12);
      this.isJumping = false;
    }

    // Squash & stretch (airborne only — landing handled by juice)
    if (!this.playerBody.onGround) {
      this.playerGfx.scale.y = this.playerBody.vy < 0 ? 1.12 : 0.92;
    }

    // Scroll ground tiles
    for (var gi = 0; gi < this.groundTiles.length; gi++) {
      this.groundTiles[gi].x -= this.speed * dt;
      if (this.groundTiles[gi].x < -engine.config.width) {
        this.groundTiles[gi].x += engine.config.width * this.groundTiles.length;
      }
    }

    // Scroll backgrounds
    for (var bi = 0; bi < this.bgLayers.length; bi++) {
      this.bgLayers[bi].gfx.x -= this.speed * this.bgLayers[bi].factor * dt;
    }

    // Scroll clouds
    for (var cli = 0; cli < this.clouds.length; cli++) {
      this.clouds[cli].gfx.x -= (this.speed * 0.05 + this.clouds[cli].speed) * dt;
      if (this.clouds[cli].gfx.x < -200) this.clouds[cli].gfx.x = engine.config.width + 200;
    }

    // Spawn obstacles
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.8 + Math.random() * 1.2 * (CONFIG.startSpeed / this.speed);
      var obsGfx = drawEnemySlime(30 + Math.random() * 20, PAL.enemy, PAL.enemyLight);
      obsGfx.x = engine.config.width + 50;
      obsGfx.y = CONFIG.groundY - 15;
      this.container.addChild(obsGfx);
      var obsBody = createBody(obsGfx.x, obsGfx.y, 28, 24, { isStatic: true, isSensor: true, tag: 'obstacle' });
      obsBody.sprite = obsGfx;
      this.physics.addBody(obsBody);
      this.obstacles.push({ gfx: obsGfx, body: obsBody });
    }

    // Move obstacles
    for (var oi = this.obstacles.length - 1; oi >= 0; oi--) {
      this.obstacles[oi].gfx.x -= this.speed * dt;
      this.obstacles[oi].body.x = this.obstacles[oi].gfx.x;
      this.obstacles[oi].gfx.scale.y = 1 + Math.sin(engine.elapsed * 6 + oi) * 0.06;
      if (this.obstacles[oi].gfx.x < -80) {
        this.container.removeChild(this.obstacles[oi].gfx);
        this.obstacles.splice(oi, 1);
      }
    }

    // Spawn coins
    this.coinTimer -= dt;
    if (this.coinTimer <= 0) {
      this.coinTimer = 0.4 + Math.random() * 0.6;
      var cy = CONFIG.groundY - 60 - Math.random() * 120;
      var coinGfx = drawCoinToken(8, PAL.coin, PAL.coinGlow);
      coinGfx.x = engine.config.width + 50;
      coinGfx.y = cy;
      this.container.addChild(coinGfx);
      var coinBody = createBody(coinGfx.x, cy, 14, 14, { isStatic: true, isSensor: true, tag: 'coin' });
      coinBody.sprite = coinGfx;
      this.physics.addBody(coinBody);
      this.coins.push({ gfx: coinGfx, body: coinBody, baseY: cy });
    }

    // Move coins
    for (var ci = this.coins.length - 1; ci >= 0; ci--) {
      var c = this.coins[ci];
      c.gfx.x -= this.speed * dt;
      c.body.x = c.gfx.x;
      c.gfx.y = c.baseY + Math.sin(engine.elapsed * 4 + ci) * 4;
      if (c.gfx.x < -50 || !c.gfx.visible) {
        this.container.removeChild(c.gfx);
        this.coins.splice(ci, 1);
      }
    }

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    engine.juice.killAll();
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
}
`;

/** Reference puzzle — complete example used in AI prompt for pattern learning */
export const GAME_2D_REFERENCE_PUZZLE = `import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
import { createSparkleEffect, onCollectSparkle } from "../engine/effects";
import { PALETTES, lerpColor, drawSkyGradient, drawHeart, drawGemShape } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;

var THEME = 'candy';
var PAL = PALETTES[THEME] || PALETTES.candy;

var CONFIG = {
  cols: 7,
  rows: 6,
  cellSize: 56,
  padding: 4,
  gemColors: [0xff4466, 0x44aaff, 0x44dd44, 0xffaa22, 0xcc44ff, 0x44ffdd],
  matchMin: 3,
  fallSpeed: 400,
  swapSpeed: 0.15,
};

// Use drawGemShape from assets for professional hexagonal gems with glow

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private grid: (any | null)[][] = [];
  private gridColors: (number | -1)[][] = [];
  private score = 0;
  private scoreText: any;
  private boardContainer: any;
  private selectedCell: { row: number; col: number } | null = null;
  private selectedHighlight: any;
  private isAnimating = false;
  private boardX = 0;
  private boardY = 0;

  constructor() {
    this.container = new PIXI.Container();
  }

  async enter(engine: Engine2D): Promise<void> {
    this.score = 0;
    this.grid = [];
    this.gridColors = [];
    this.selectedCell = null;
    this.isAnimating = false;

    await _loadSpriteLib(THEME);

    var W = engine.config.width;
    var H = engine.config.height;

    // Background
    var sky = drawSkyGradient(W, H, PAL.skyTop, PAL.skyBottom);
    this.container.addChild(sky);

    // Board dimensions
    var boardW = CONFIG.cols * CONFIG.cellSize;
    var boardH = CONFIG.rows * CONFIG.cellSize;
    this.boardX = (W - boardW) / 2;
    this.boardY = (H - boardH) / 2 + 20;

    // Board background
    var boardBg = new PIXI.Graphics();
    boardBg.roundRect(this.boardX - 8, this.boardY - 8, boardW + 16, boardH + 16, 12);
    boardBg.fill({ color: 0x000000, alpha: 0.3 });
    boardBg.roundRect(this.boardX - 4, this.boardY - 4, boardW + 8, boardH + 8, 10);
    boardBg.fill({ color: 0xffffff, alpha: 0.08 });
    this.container.addChild(boardBg);

    // Grid cells background
    var cellsBg = new PIXI.Graphics();
    for (var r = 0; r < CONFIG.rows; r++) {
      for (var c = 0; c < CONFIG.cols; c++) {
        var cx = this.boardX + c * CONFIG.cellSize + CONFIG.cellSize / 2;
        var cy = this.boardY + r * CONFIG.cellSize + CONFIG.cellSize / 2;
        cellsBg.roundRect(cx - CONFIG.cellSize / 2 + 2, cy - CONFIG.cellSize / 2 + 2, CONFIG.cellSize - 4, CONFIG.cellSize - 4, 6);
        cellsBg.fill({ color: (r + c) % 2 === 0 ? 0xffffff : 0x000000, alpha: 0.05 });
      }
    }
    this.container.addChild(cellsBg);

    // Board container
    this.boardContainer = new PIXI.Container();
    this.container.addChild(this.boardContainer);

    // Selection highlight
    this.selectedHighlight = new PIXI.Graphics();
    this.selectedHighlight.roundRect(-CONFIG.cellSize / 2 + 1, -CONFIG.cellSize / 2 + 1, CONFIG.cellSize - 2, CONFIG.cellSize - 2, 6);
    this.selectedHighlight.stroke({ color: 0xffffff, width: 3, alpha: 0.8 });
    this.selectedHighlight.visible = false;
    this.boardContainer.addChild(this.selectedHighlight);

    // Fill board (ensure no initial matches)
    for (var r = 0; r < CONFIG.rows; r++) {
      this.grid[r] = [];
      this.gridColors[r] = [];
      for (var c = 0; c < CONFIG.cols; c++) {
        this.spawnGem(r, c, true);
      }
    }

    // UI
    var titleText = engine.createText('MATCH 3', { fontSize: 14, fill: 0xaaaaaa });
    titleText.anchor.set(0.5, 0);
    titleText.x = W / 2;
    titleText.y = 10;
    engine.ui.addChild(titleText);

    this.scoreText = engine.createText('0', {
      fontSize: 40, fill: 0xffffff, fontWeight: 'bold',
      stroke: { color: 0x000000, width: 5 },
    });
    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.x = W / 2;
    this.scoreText.y = 28;
    engine.ui.addChild(this.scoreText);
  }

  private spawnGem(row: number, col: number, avoidMatch: boolean): void {
    var attempts = 0;
    var colorIdx: number;
    do {
      colorIdx = Math.floor(Math.random() * CONFIG.gemColors.length);
      attempts++;
    } while (avoidMatch && attempts < 20 && this.wouldMatch(row, col, colorIdx));

    var radius = (CONFIG.cellSize - CONFIG.padding * 2) / 2 - 2;
    var gem = drawGemShape(radius, CONFIG.gemColors[colorIdx]);
    gem.x = this.boardX + col * CONFIG.cellSize + CONFIG.cellSize / 2;
    gem.y = this.boardY + row * CONFIG.cellSize + CONFIG.cellSize / 2;
    gem.eventMode = 'static';
    gem.cursor = 'pointer';
    this.boardContainer.addChild(gem);

    this.grid[row][col] = gem;
    this.gridColors[row][col] = colorIdx;
  }

  private wouldMatch(row: number, col: number, colorIdx: number): boolean {
    // Check horizontal
    if (col >= 2 && this.gridColors[row][col - 1] === colorIdx && this.gridColors[row][col - 2] === colorIdx) return true;
    // Check vertical
    if (row >= 2 && this.gridColors[row - 1] && this.gridColors[row - 1][col] === colorIdx && this.gridColors[row - 2] && this.gridColors[row - 2][col] === colorIdx) return true;
    return false;
  }

  private getCellAt(px: number, py: number): { row: number; col: number } | null {
    var col = Math.floor((px - this.boardX) / CONFIG.cellSize);
    var row = Math.floor((py - this.boardY) / CONFIG.cellSize);
    if (row >= 0 && row < CONFIG.rows && col >= 0 && col < CONFIG.cols) return { row: row, col: col };
    return null;
  }

  private areAdjacent(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  private swapAndCheck(a: { row: number; col: number }, b: { row: number; col: number }, engine: Engine2D): void {
    // Swap colors
    var tmpC = this.gridColors[a.row][a.col];
    this.gridColors[a.row][a.col] = this.gridColors[b.row][b.col];
    this.gridColors[b.row][b.col] = tmpC;

    // Check if valid
    var matches = this.findMatches();
    if (matches.length > 0) {
      // Swap visuals
      var tmpG = this.grid[a.row][a.col];
      this.grid[a.row][a.col] = this.grid[b.row][b.col];
      this.grid[b.row][b.col] = tmpG;
      // Move sprites to new positions
      if (this.grid[a.row][a.col]) {
        this.grid[a.row][a.col].x = this.boardX + a.col * CONFIG.cellSize + CONFIG.cellSize / 2;
        this.grid[a.row][a.col].y = this.boardY + a.row * CONFIG.cellSize + CONFIG.cellSize / 2;
      }
      if (this.grid[b.row][b.col]) {
        this.grid[b.row][b.col].x = this.boardX + b.col * CONFIG.cellSize + CONFIG.cellSize / 2;
        this.grid[b.row][b.col].y = this.boardY + b.row * CONFIG.cellSize + CONFIG.cellSize / 2;
      }
      this.resolveMatches(matches, engine);
    } else {
      // Swap back
      this.gridColors[a.row][a.col] = this.gridColors[b.row][b.col];
      this.gridColors[b.row][b.col] = tmpC;
    }
  }

  private findMatches(): { row: number; col: number }[] {
    var matched: Set<string> = new Set();
    // Horizontal
    for (var r = 0; r < CONFIG.rows; r++) {
      for (var c = 0; c < CONFIG.cols - 2; c++) {
        var cc = this.gridColors[r][c];
        if (cc >= 0 && cc === this.gridColors[r][c + 1] && cc === this.gridColors[r][c + 2]) {
          matched.add(r + ',' + c);
          matched.add(r + ',' + (c + 1));
          matched.add(r + ',' + (c + 2));
        }
      }
    }
    // Vertical
    for (var c = 0; c < CONFIG.cols; c++) {
      for (var r = 0; r < CONFIG.rows - 2; r++) {
        var cc = this.gridColors[r][c];
        if (cc >= 0 && this.gridColors[r + 1] && cc === this.gridColors[r + 1][c] && this.gridColors[r + 2] && cc === this.gridColors[r + 2][c]) {
          matched.add(r + ',' + c);
          matched.add((r + 1) + ',' + c);
          matched.add((r + 2) + ',' + c);
        }
      }
    }
    return Array.from(matched).map(function(s) {
      var parts = s.split(',');
      return { row: parseInt(parts[0]), col: parseInt(parts[1]) };
    });
  }

  private resolveMatches(matches: { row: number; col: number }[], engine: Engine2D): void {
    this.isAnimating = true;
    var self = this;

    // Scale pop matched gems before removing
    for (var m = 0; m < matches.length; m++) {
      var pos = matches[m];
      var gem = this.grid[pos.row][pos.col];
      if (gem) {
        engine.juice.pop(gem, 1.4, 0.15);
        onCollectSparkle(engine.proton, gem.x, gem.y);
      }
    }

    // Remove after brief delay for pop animation
    var gsap = (window as any).gsap;
    var removeDelay = gsap ? 0.15 : 0;
    var doRemove = function() {
      for (var m = 0; m < matches.length; m++) {
        var pos = matches[m];
        var gem = self.grid[pos.row][pos.col];
        if (gem) {
          self.boardContainer.removeChild(gem);
        }
        self.grid[pos.row][pos.col] = null;
        self.gridColors[pos.row][pos.col] = -1;
        self.score += 10;
      }
      if (self.scoreText) {
        self.scoreText.text = String(self.score);
        engine.juice.pop(self.scoreText, 1.3, 0.2);
      }
      // Screen shake on big combos (4+ gems)
      if (matches.length >= 4) {
        engine.juice.shake(engine.world, 5 + matches.length, 0.2);
      }

      // Gravity fill after delay
      setTimeout(function() {
        self.gravityFill();
        // Check for chain matches
        setTimeout(function() {
          var newMatches = self.findMatches();
          if (newMatches.length > 0) {
            self.resolveMatches(newMatches, engine);
          } else {
            self.isAnimating = false;
          }
        }, 200);
      }, 150);
    };
    if (gsap) { gsap.delayedCall(removeDelay, doRemove); } else { doRemove(); }
  }

  private gravityFill(): void {
    // Drop existing gems down
    for (var c = 0; c < CONFIG.cols; c++) {
      var writeRow = CONFIG.rows - 1;
      for (var r = CONFIG.rows - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          if (r !== writeRow) {
            this.grid[writeRow][c] = this.grid[r][c];
            this.gridColors[writeRow][c] = this.gridColors[r][c];
            this.grid[r][c] = null;
            this.gridColors[r][c] = -1;
            // Move sprite
            if (this.grid[writeRow][c]) {
              this.grid[writeRow][c].y = this.boardY + writeRow * CONFIG.cellSize + CONFIG.cellSize / 2;
            }
          }
          writeRow--;
        }
      }
      // Fill empty spots at top
      for (var fr = writeRow; fr >= 0; fr--) {
        this.spawnGem(fr, c, false);
      }
    }
  }

  update(engine: Engine2D, dt: number): void {
    // Handle click/tap
    if (engine.input.pointer.justDown && !this.isAnimating) {
      var cell = this.getCellAt(engine.input.pointer.x, engine.input.pointer.y);
      if (cell) {
        if (!this.selectedCell) {
          this.selectedCell = cell;
          this.selectedHighlight.visible = true;
          this.selectedHighlight.x = this.boardX + cell.col * CONFIG.cellSize + CONFIG.cellSize / 2;
          this.selectedHighlight.y = this.boardY + cell.row * CONFIG.cellSize + CONFIG.cellSize / 2;
        } else {
          if (this.areAdjacent(this.selectedCell, cell)) {
            this.swapAndCheck(this.selectedCell, cell, engine);
          }
          this.selectedCell = null;
          this.selectedHighlight.visible = false;
        }
      }
    }

    // Animate gem hover/pulse
    for (var r = 0; r < CONFIG.rows; r++) {
      for (var c = 0; c < CONFIG.cols; c++) {
        var gem = this.grid[r] && this.grid[r][c];
        if (gem) {
          gem.scale.set(1 + Math.sin(engine.elapsed * 2 + r * 0.3 + c * 0.5) * 0.03);
        }
      }
    }

    // Selection highlight pulse
    if (this.selectedHighlight.visible) {
      this.selectedHighlight.alpha = 0.5 + 0.5 * Math.sin(engine.elapsed * 6);
    }

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    engine.juice.killAll();
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
}
`;

/** Reference shooter — complete example used in AI prompt for pattern learning */
export const GAME_2D_REFERENCE_SHOOTER = `import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
import { createBody, createStaticBody, PhysicsWorld } from "../engine/physics";
import { createExplosionEffect, createTrailEffect, createAmbientEffect, onDeathExplosion, onCollectSparkle } from "../engine/effects";
import { PALETTES, lerpColor, drawSkyGradient, drawStars, drawCoinToken, drawHeart, drawShipShape } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;

var THEME = 'space';
var PAL = PALETTES[THEME] || PALETTES.space;

var CONFIG = {
  playerSpeed: 320,
  bulletSpeed: 700,
  fireRate: 0.12,
  enemyBaseSpeed: 120,
  enemySpawnRate: 1.2,
  lives: 3,
  playerSize: 36,
};

// Player ship now uses drawShipShape from assets (gradient body + engine glow filter)

function drawEnemyShip(size: number, color: number): any {
  var PIXI = (window as any).PIXI;
  var g = new PIXI.Graphics();
  var s = size;
  g.moveTo(0, s * 0.4);
  g.lineTo(-s * 0.35, -s * 0.2);
  g.lineTo(-s * 0.15, -s * 0.35);
  g.lineTo(0, -s * 0.2);
  g.lineTo(s * 0.15, -s * 0.35);
  g.lineTo(s * 0.35, -s * 0.2);
  g.closePath();
  g.fill(color);
  // Eyes
  g.circle(-s * 0.1, 0, s * 0.05);
  g.fill(0xff0000);
  g.circle(s * 0.1, 0, s * 0.05);
  g.fill(0xff0000);
  return g;
}

function drawBullet(color: number): any {
  var PIXI = (window as any).PIXI;
  var g = new PIXI.Graphics();
  g.roundRect(-2, -6, 4, 12, 2);
  g.fill(color);
  g.circle(0, -4, 3);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  return g;
}

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private playerGfx: any;
  private playerX = 0;
  private playerY = 0;
  private bullets: { gfx: any; y: number }[] = [];
  private enemies: { gfx: any; x: number; y: number; speed: number; hp: number }[] = [];
  private powerups: { gfx: any; x: number; y: number }[] = [];
  private score = 0;
  private lives = CONFIG.lives;
  private fireCooldown = 0;
  private spawnTimer = 1;
  private scoreText: any;
  private livesContainer: any;
  private stars: any;
  private wave = 1;
  private enemiesKilled = 0;

  constructor() {
    this.container = new PIXI.Container();
  }

  async enter(engine: Engine2D): Promise<void> {
    this.score = 0;
    this.lives = CONFIG.lives;
    this.bullets = [];
    this.enemies = [];
    this.powerups = [];
    this.fireCooldown = 0;
    this.spawnTimer = 1;
    this.wave = 1;
    this.enemiesKilled = 0;

    await _loadSpriteLib(THEME);

    var W = engine.config.width;
    var H = engine.config.height;

    // Background
    var sky = drawSkyGradient(W, H, PAL.skyTop, PAL.skyBottom);
    this.container.addChild(sky);

    // Stars (scrolling)
    this.stars = drawStars(W, H * 2, 120);
    this.container.addChild(this.stars);

    // Player
    this.playerGfx = drawShipShape(CONFIG.playerSize, PAL.player, PAL.playerLight);
    this.playerX = W / 2;
    this.playerY = H - 80;
    this.playerGfx.x = this.playerX;
    this.playerGfx.y = this.playerY;
    this.container.addChild(this.playerGfx);

    // Ambient
    try {
      if (PAL.ambient) {
        var ambientFx = createAmbientEffect(PAL.ambient as any, W, H);
        if (ambientFx && ambientFx.emitter) engine.addEmitter(ambientFx.emitter);
      } else {
        var dustFx = createAmbientEffect('dust', W, H);
        if (dustFx && dustFx.emitter) engine.addEmitter(dustFx.emitter);
      }
    } catch(e) { /* particle effects optional */ }

    // UI
    this.scoreText = engine.createText('0', {
      fontSize: 28, fill: 0xffffff, fontWeight: 'bold',
      stroke: { color: 0x000000, width: 4 },
    });
    this.scoreText.x = 16;
    this.scoreText.y = 16;
    engine.ui.addChild(this.scoreText);

    this.livesContainer = new PIXI.Container();
    this.livesContainer.x = W - 16;
    this.livesContainer.y = 20;
    engine.ui.addChild(this.livesContainer);
    this.updateLives();

    var waveText = engine.createText('WAVE 1', { fontSize: 12, fill: 0x888888 });
    waveText.anchor.set(0.5, 0);
    waveText.x = W / 2;
    waveText.y = 8;
    engine.ui.addChild(waveText);
    (this as any)._waveText = waveText;

    var hint = engine.createText('WASD / Arrows to move, SPACE to shoot', { fontSize: 11, fill: 0x555555 });
    hint.anchor.set(0.5, 1);
    hint.x = W / 2;
    hint.y = H - 6;
    engine.ui.addChild(hint);
  }

  private updateLives(): void {
    this.livesContainer.removeChildren();
    for (var i = 0; i < this.lives; i++) {
      var heart = drawHeart(12, 0xff3355);
      heart.x = -(i * 24) - 12;
      this.livesContainer.addChild(heart);
    }
  }

  update(engine: Engine2D, dt: number): void {
    var W = engine.config.width;
    var H = engine.config.height;

    // Move player
    if (engine.input.left) this.playerX -= CONFIG.playerSpeed * dt;
    if (engine.input.right) this.playerX += CONFIG.playerSpeed * dt;
    if (engine.input.up) this.playerY -= CONFIG.playerSpeed * dt;
    if (engine.input.down) this.playerY += CONFIG.playerSpeed * dt;
    this.playerX = Math.max(20, Math.min(W - 20, this.playerX));
    this.playerY = Math.max(40, Math.min(H - 40, this.playerY));
    this.playerGfx.x = this.playerX;
    this.playerGfx.y = this.playerY;
    // Smooth tilt on strafe via GSAP
    var targetRot = engine.input.left ? -0.2 : engine.input.right ? 0.2 : 0;
    var gsap = (window as any).gsap;
    if (gsap) {
      gsap.to(this.playerGfx, { rotation: targetRot, duration: 0.15, ease: 'power2.out', overwrite: true });
    } else {
      this.playerGfx.rotation = targetRot;
    }

    // Fire
    this.fireCooldown -= dt;
    if ((engine.input.isDown(' ') || engine.input.pointer.down) && this.fireCooldown <= 0) {
      this.fireCooldown = CONFIG.fireRate;
      var bullet = drawBullet(0x44ffaa);
      bullet.x = this.playerX;
      bullet.y = this.playerY - 20;
      this.container.addChild(bullet);
      this.bullets.push({ gfx: bullet, y: this.playerY - 20 });
    }

    // Move bullets
    for (var bi = this.bullets.length - 1; bi >= 0; bi--) {
      this.bullets[bi].y -= CONFIG.bulletSpeed * dt;
      this.bullets[bi].gfx.y = this.bullets[bi].y;
      if (this.bullets[bi].y < -20) {
        this.container.removeChild(this.bullets[bi].gfx);
        this.bullets.splice(bi, 1);
      }
    }

    // Spawn enemies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = CONFIG.enemySpawnRate / (1 + this.wave * 0.15);
      var ex = 30 + Math.random() * (W - 60);
      var eSize = 28 + Math.random() * 12;
      var eGfx = drawEnemyShip(eSize, PAL.enemy);
      eGfx.x = ex;
      eGfx.y = -30;
      eGfx.rotation = Math.PI;
      this.container.addChild(eGfx);
      this.enemies.push({
        gfx: eGfx, x: ex, y: -30,
        speed: CONFIG.enemyBaseSpeed + Math.random() * 50 + this.wave * 10,
        hp: 1 + Math.floor(this.wave / 3),
      });
    }

    // Move enemies + collision
    for (var ei = this.enemies.length - 1; ei >= 0; ei--) {
      var en = this.enemies[ei];
      en.y += en.speed * dt;
      en.x += Math.sin(engine.elapsed * 2 + ei * 1.5) * 40 * dt;
      en.gfx.x = en.x;
      en.gfx.y = en.y;

      // Bullet-enemy collision
      var hit = false;
      for (var bj = this.bullets.length - 1; bj >= 0; bj--) {
        var bul = this.bullets[bj];
        if (Math.abs(bul.gfx.x - en.x) < 20 && Math.abs(bul.y - en.y) < 20) {
          this.container.removeChild(bul.gfx);
          this.bullets.splice(bj, 1);
          en.hp--;
          if (en.hp <= 0) {
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        onDeathExplosion(engine.proton, en.x, en.y, '#ff6600');
        engine.juice.shake(engine.world, 4, 0.15);
        this.container.removeChild(en.gfx);
        this.enemies.splice(ei, 1);
        this.score += 100 * this.wave;
        this.enemiesKilled++;
        if (this.enemiesKilled % 10 === 0) {
          this.wave++;
          if ((this as any)._waveText) (this as any)._waveText.text = 'WAVE ' + this.wave;
        }
        if (this.scoreText) {
          this.scoreText.text = String(this.score);
          engine.juice.pop(this.scoreText, 1.2, 0.15);
        }
        continue;
      }

      // Enemy-player collision
      if (Math.abs(en.x - this.playerX) < 25 && Math.abs(en.y - this.playerY) < 25) {
        onDeathExplosion(engine.proton, en.x, en.y);
        engine.juice.shake(engine.world, 10, 0.3);
        engine.juice.hitPause(engine.app, 60);
        engine.juice.flash(this.playerGfx, 0xff0000, 0.15);
        this.container.removeChild(en.gfx);
        this.enemies.splice(ei, 1);
        this.lives--;
        this.updateLives();
        if (this.lives <= 0) {
          engine.scene.switch('gameover', { score: this.score });
          return;
        }
        continue;
      }

      // Off screen
      if (en.y > H + 40) {
        this.container.removeChild(en.gfx);
        this.enemies.splice(ei, 1);
      }
    }

    // Scroll stars
    if (this.stars) {
      this.stars.y = (this.stars.y + 30 * dt) % (H * 0.5);
    }

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    engine.juice.killAll();
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
}
`;

// ============================================================================
// BUILDER FUNCTIONS — Parameterized scene starters driven by CreativeBrief
// ============================================================================

/**
 * Build a platformer scene starter with CreativeBrief-derived values.
 */
export function buildGame2dSceneStarter(brief: CreativeBrief): string {
	let code = GAME_2D_SCENE_STARTER;

	// Replace seed
	code = code.replace("var _seed = 1234;", `var _seed = ${brief.seed};`);

	// Replace THEME
	code = code.replace(
		"var THEME = 'sunset'; // Change to: forest, sunset, space, volcanic, candy, arctic, dark, ocean",
		`var THEME = '${brief.theme}'; // Seed ${brief.seed} -- ${brief.difficultyProfile}, ${brief.mechanicEmphasis}`,
	);

	// Replace CONFIG values (including new hybrid fields)
	code = code.replace(
		[
			"var CONFIG = {",
			"  gravity: 980,",
			"  worldWidth: 4000,",
			"  worldHeight: 900,",
			"  groundY: 680,",
			"  playerSize: 48,",
			"  playerStartX: 250,",
			"  moveSpeed: 280,",
			"  jumpForce: 520,",
			"  coinRadius: 10,",
			"  enemySize: 44,",
			"  enemySpeed: 60,",
			"  lives: 3,",
			"  platformCount: 11,",
			"  enemyCount: 6,",
			"  coinCount: 27,",
			"  levelShape: 'flat-wide' as 'flat-wide' | 'staircase-ascending' | 'valley-bowl' | 'hilly-undulating',",
			"  doubleJump: true,",
			"  wallSlide: false,",
			"};",
		].join("\n"),
		[
			"var CONFIG = {",
			`  gravity: ${brief.gravity},`,
			`  worldWidth: ${brief.worldWidth},`,
			"  worldHeight: 900,",
			"  groundY: 680,",
			"  playerSize: 48,",
			"  playerStartX: 250,",
			`  moveSpeed: ${brief.moveSpeed},`,
			`  jumpForce: ${brief.jumpForce},`,
			"  coinRadius: 10,",
			"  enemySize: 44,",
			`  enemySpeed: ${brief.difficultyProfile === "hard-intense" ? 100 : brief.difficultyProfile === "casual-easy" ? 40 : 60},`,
			`  lives: ${brief.difficultyProfile === "casual-easy" ? 5 : brief.difficultyProfile === "hard-intense" ? 2 : 3},`,
			`  platformCount: ${brief.platformCount},`,
			`  enemyCount: ${brief.enemyCount},`,
			`  coinCount: ${brief.coinCount},`,
			`  levelShape: '${brief.levelShape}' as 'flat-wide' | 'staircase-ascending' | 'valley-bowl' | 'hilly-undulating',`,
			`  doubleJump: ${brief.specialMechanic === "double-jump" || brief.specialMechanic === "dash"},`,
			`  wallSlide: ${brief.specialMechanic === "wall-slide"},`,
			"};",
		].join("\n"),
	);

	return code;
}

/**
 * Build a runner scene starter with CreativeBrief-derived values.
 */
export function buildGame2dSceneStarterRunner(brief: CreativeBrief): string {
	let code = GAME_2D_SCENE_STARTER_RUNNER;

	code = code.replace(
		"var THEME = 'space';",
		`var THEME = '${brief.theme}'; // Seed ${brief.seed}`,
	);

	code = code.replace(
		[
			"var CONFIG = {",
			"  gravity: 1400,",
			"  jumpForce: 650,",
			"  startSpeed: 280,",
			"  maxSpeed: 600,",
			"  speedRamp: 0.003,",
			"  groundY: 520,",
			"  playerX: 180,",
			"  playerSize: 42,",
			"  spawnInterval: 1.8,",
			"  coinInterval: 0.8,",
			"  lives: 1,",
			"};",
		].join("\n"),
		[
			"var CONFIG = {",
			`  gravity: ${brief.gravity},`,
			`  jumpForce: ${brief.jumpForce},`,
			`  startSpeed: ${brief.startSpeed},`,
			`  maxSpeed: ${brief.maxSpeed},`,
			`  speedRamp: ${brief.difficultyProfile === "hard-intense" ? 0.005 : brief.difficultyProfile === "casual-easy" ? 0.002 : 0.003},`,
			"  groundY: 520,",
			"  playerX: 180,",
			"  playerSize: 42,",
			`  spawnInterval: ${brief.spawnInterval},`,
			`  coinInterval: ${brief.difficultyProfile === "casual-easy" ? 0.6 : 0.8},`,
			`  lives: ${brief.difficultyProfile === "casual-easy" ? 3 : 1},`,
			"};",
		].join("\n"),
	);

	return code;
}

/**
 * Build a puzzle scene starter with CreativeBrief-derived values.
 */
export function buildGame2dSceneStarterPuzzle(brief: CreativeBrief): string {
	let code = GAME_2D_SCENE_STARTER_PUZZLE;

	code = code.replace(
		"var THEME = 'candy';",
		`var THEME = '${brief.theme}'; // Seed ${brief.seed}`,
	);

	const allGemColors = [
		"0xff4466",
		"0x44aaff",
		"0x44dd44",
		"0xffaa22",
		"0xcc44ff",
		"0x44ffdd",
		"0xff8844",
	];
	const gemColors = allGemColors.slice(0, brief.gemColorCount).join(", ");

	code = code.replace(
		[
			"var CONFIG = {",
			"  cols: 7,",
			"  rows: 6,",
			"  cellSize: 56,",
			"  padding: 4,",
			"  gemColors: [0xff4466, 0x44aaff, 0x44dd44, 0xffaa22, 0xcc44ff, 0x44ffdd],",
			"  matchMin: 3,",
			"  fallSpeed: 400,",
			"  swapSpeed: 0.15,",
			"};",
		].join("\n"),
		[
			"var CONFIG = {",
			`  cols: ${brief.gridCols},`,
			`  rows: ${brief.gridRows},`,
			`  cellSize: ${brief.gridCols > 7 ? 48 : 56},`,
			"  padding: 4,",
			`  gemColors: [${gemColors}],`,
			"  matchMin: 3,",
			`  fallSpeed: ${brief.difficultyProfile === "hard-intense" ? 500 : 400},`,
			`  swapSpeed: ${brief.difficultyProfile === "hard-intense" ? 0.1 : 0.15},`,
			"};",
		].join("\n"),
	);

	return code;
}

/**
 * Build a shooter scene starter with CreativeBrief-derived values.
 */
export function buildGame2dSceneStarterShooter(brief: CreativeBrief): string {
	let code = GAME_2D_SCENE_STARTER_SHOOTER;

	code = code.replace(
		"var THEME = 'space';",
		`var THEME = '${brief.theme}'; // Seed ${brief.seed}`,
	);

	code = code.replace(
		[
			"var CONFIG = {",
			"  playerSpeed: 320,",
			"  bulletSpeed: 700,",
			"  fireRate: 0.12,",
			"  enemyBaseSpeed: 120,",
			"  enemySpawnRate: 1.2,",
			"  lives: 3,",
			"  playerSize: 36,",
			"};",
		].join("\n"),
		[
			"var CONFIG = {",
			`  playerSpeed: ${brief.moveSpeed},`,
			`  bulletSpeed: ${brief.difficultyProfile === "hard-intense" ? 800 : 700},`,
			`  fireRate: ${brief.fireRate},`,
			`  enemyBaseSpeed: ${brief.difficultyProfile === "hard-intense" ? 180 : brief.difficultyProfile === "casual-easy" ? 80 : 120},`,
			`  enemySpawnRate: ${brief.enemySpawnRate},`,
			`  lives: ${brief.difficultyProfile === "casual-easy" ? 5 : brief.difficultyProfile === "hard-intense" ? 2 : 3},`,
			"  playerSize: 36,",
			"};",
		].join("\n"),
	);

	return code;
}

