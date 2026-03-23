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

export { type TemplateFile };

// ============================================================================
// VISUAL HELPERS — Programmatic drawing functions for professional graphics
// ============================================================================

const VISUAL_HELPERS_CONTENT = `
const PIXI = (window as any).PIXI;

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

import { _getSprite, _getAnimatedSprite } from '../utils/media-stock';

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

/** Rolling hills with smooth bezier curves and gradient shading */
export function drawMountainRange(
  worldW: number, baseY: number, color: number, alpha: number,
  minH: number, maxH: number, spacing: number
): any {
  var container = new PIXI.Container();
  // Shadow layer (darker, offset down)
  var shadow = new PIXI.Graphics();
  shadow.moveTo(-spacing, baseY + 8);
  var cx = -spacing;
  while (cx < worldW + spacing * 2) {
    var peakH = minH + Math.random() * (maxH - minH);
    var cw = spacing * (0.5 + Math.random() * 0.5);
    shadow.bezierCurveTo(cx + cw * 0.3, baseY - peakH + 8, cx + cw * 0.7, baseY - peakH * 0.6 + 8, cx + cw, baseY + 8);
    cx += cw;
  }
  shadow.lineTo(worldW + spacing, baseY + 50);
  shadow.lineTo(-spacing, baseY + 50);
  shadow.closePath();
  shadow.fill({ color: darken(color, 30), alpha: alpha * 0.4 });
  container.addChild(shadow);
  // Main hills with gradient
  var g = new PIXI.Graphics();
  g.moveTo(-spacing, baseY);
  cx = -spacing;
  while (cx < worldW + spacing * 2) {
    var peakH2 = minH + Math.random() * (maxH - minH);
    var cw2 = spacing * (0.5 + Math.random() * 0.5);
    g.bezierCurveTo(cx + cw2 * 0.3, baseY - peakH2, cx + cw2 * 0.7, baseY - peakH2 * 0.6, cx + cw2, baseY);
    cx += cw2;
  }
  g.lineTo(worldW + spacing, baseY + 50);
  g.lineTo(-spacing, baseY + 50);
  g.closePath();
  var hillGrad = makeLinearGradient(lighten(color, 15), darken(color, 10), maxH);
  g.fill(typeof hillGrad === 'number' ? { color: color, alpha: alpha } : hillGrad);
  if (typeof hillGrad === 'number') g.fill({ color: color, alpha: alpha });
  container.addChild(g);
  // Highlight strip along the top edge (simulates light catching hilltops)
  var highlight = new PIXI.Graphics();
  highlight.moveTo(-spacing, baseY);
  cx = -spacing;
  while (cx < worldW + spacing * 2) {
    var peakH3 = minH + Math.random() * (maxH - minH);
    var cw3 = spacing * (0.5 + Math.random() * 0.5);
    highlight.bezierCurveTo(cx + cw3 * 0.3, baseY - peakH3, cx + cw3 * 0.7, baseY - peakH3 * 0.6, cx + cw3, baseY);
    cx += cw3;
  }
  highlight.lineTo(worldW + spacing, baseY - 3);
  highlight.lineTo(-spacing, baseY - 3);
  highlight.closePath();
  highlight.fill({ color: lighten(color, 30), alpha: alpha * 0.3 });
  container.addChild(highlight);
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
export function drawGroundStrip(
  worldW: number, groundY: number, floorH: number, color: number, topColor: number
): any {
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  // Main ground fill with gradient
  g.rect(0, groundY, worldW, floorH);
  var groundGrad = makeLinearGradient(color, darken(color, 50), floorH);
  g.fill(groundGrad);
  // Top grass strip — thick and vibrant
  g.rect(0, groundY - 2, worldW, 10);
  g.fill(topColor);
  // Highlight on grass top edge
  g.rect(0, groundY - 2, worldW, 3);
  g.fill(lighten(topColor, 20));
  // Darker strip below grass (shadow under grass layer)
  g.rect(0, groundY + 8, worldW, 4);
  g.fill({ color: darken(color, 20), alpha: 0.4 });
  // Thick grass tufts — varied sizes
  for (var gx = 0; gx < worldW; gx += 8 + Math.random() * 6) {
    var gh = 5 + Math.random() * 12;
    var gw = 2 + Math.random() * 2;
    // Main blade
    g.moveTo(gx, groundY - 2);
    g.quadraticCurveTo(gx + gw * 0.5, groundY - gh * 0.6, gx + gw * 0.3, groundY - gh);
    g.quadraticCurveTo(gx + gw, groundY - gh * 0.4, gx + gw + 1, groundY - 2);
    g.closePath();
    g.fill(Math.random() > 0.3 ? topColor : lighten(topColor, 15));
  }
  // Scattered dirt/pebble dots
  for (var dx = 0; dx < worldW; dx += 20 + Math.random() * 30) {
    var dy = groundY + 12 + Math.random() * (floorH - 20);
    var dr = 1 + Math.random() * 2.5;
    g.circle(dx, dy, dr);
    g.fill({ color: darken(color, 30), alpha: 0.2 });
    // Tiny highlight on pebble
    g.circle(dx - dr * 0.3, dy - dr * 0.3, dr * 0.3);
    g.fill({ color: 0xffffff, alpha: 0.06 });
  }
  // Subtle horizontal strata lines
  for (var sy = groundY + 20; sy < groundY + floorH - 10; sy += 15 + Math.random() * 10) {
    g.moveTo(0, sy);
    g.lineTo(worldW, sy + 1);
    g.stroke({ color: darken(color, 15), alpha: 0.12, width: 1 });
  }
  container.addChild(g);
  return container;
}

/** Platform block with thick colored border, inner gradient, grass lip.
 *  Fallback chain: sprite → Canvas 2D → PIXI.Graphics */
export function drawPlatformBlock(w: number, h: number, mainColor: number, topColor: number): any {
  // Tier 1: Pre-made sprite (only for standard sizes ~120x30)
  if (_hasSpriteLib() && w >= 80 && w <= 200 && h >= 20 && h <= 60) {
    var spr = _getSprite('platforms', 'grass_block');
    if (spr) { spr.width = w; spr.height = h; spr.anchor.set(0.5); return spr; }
  }
  // Tier 2: Canvas 2D (gradient fill + shadow + grass tufts)
  if (hasCanvas()) {
    try { return _drawPlatformCanvas(w, h, mainColor, topColor); } catch(e) {}
  }
  // Tier 3: PIXI.Graphics fallback
  var container = new PIXI.Container();
  var g = new PIXI.Graphics();
  var bw = 3; // border width
  // Thick colored border (outline)
  g.roundRect(-w / 2 - bw, -h / 2 - bw, w + bw * 2, h + bw * 2, 8);
  g.fill(darken(mainColor, 35));
  // Main body with gradient
  g.roundRect(-w / 2, -h / 2, w, h, 6);
  var platGrad = makeLinearGradient(lighten(mainColor, 20), darken(mainColor, 10), h);
  g.fill(platGrad);
  // Inner shadow at bottom
  g.roundRect(-w / 2 + 3, h / 2 - h * 0.35, w - 6, h * 0.35, 3);
  g.fill({ color: 0x000000, alpha: 0.08 });
  // Top highlight band
  g.roundRect(-w / 2 + 2, -h / 2 + 1, w - 4, h * 0.25, 4);
  g.fill({ color: 0xffffff, alpha: 0.15 });
  // Top grass/color lip — thick and vibrant
  g.roundRect(-w / 2 - 2, -h / 2 - 4, w + 4, 8, 4);
  g.fill(topColor);
  // Grass lip highlight
  g.roundRect(-w / 2 - 1, -h / 2 - 4, w + 2, 3, 3);
  g.fill(lighten(topColor, 20));
  // Grass tufts on top — thick curved blades
  for (var gx = -w / 2 + 5; gx < w / 2 - 5; gx += 6 + Math.random() * 4) {
    var gh = 4 + Math.random() * 8;
    g.moveTo(gx, -h / 2 - 4);
    g.quadraticCurveTo(gx + 1, -h / 2 - gh * 0.7, gx + 0.5, -h / 2 - gh);
    g.quadraticCurveTo(gx + 2, -h / 2 - gh * 0.3, gx + 3, -h / 2 - 4);
    g.closePath();
    g.fill(Math.random() > 0.4 ? topColor : lighten(topColor, 12));
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

	// ---------- Template 7: GameOver Scene ----------
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
      engine.switchScene('game');
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
import { PALETTES, lerpColor, drawSkyGradient, drawStars, drawMountainRange, drawCloud, drawTree, drawGroundStrip, drawPlatformBlock, drawPlayerCharacter, drawCoinToken, drawEnemySlime, drawHeart } from "../config/assets";
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

function _generateTrees() {
  var count = _rngInt(6, 12);
  var trees: { x: number; h: number; lr: number }[] = [];
  var spacing = CONFIG.worldWidth / count;
  for (var i = 0; i < count; i++) {
    trees.push({
      x: i * spacing + _rngRange(20, spacing - 20),
      h: _rngRange(40, 90),
      lr: _rngRange(20, 40),
    });
  }
  return trees;
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

    // ---- 4. CLOUDS (PRNG count + position) ----
    var cloudCount = _rngInt(5, 10);
    for (var ci = 0; ci < cloudCount; ci++) {
      var cw = _rngRange(80, 200);
      var ch = _rngRange(25, 45);
      var cloud = drawCloud(cw, ch);
      cloud.x = _rngRange(0, WW);
      cloud.y = _rngRange(50, CONFIG.groundY * 0.4);
      this.container.addChild(cloud);
      this.clouds.push({ gfx: cloud, speed: _rngRange(5, 15) });
    }

    // ---- 5. DECORATIVE TREES (PRNG) ----
    var treeData = _generateTrees();
    for (var ti = 0; ti < treeData.length; ti++) {
      var td = treeData[ti];
      var tree = drawTree(td.h, td.lr, 0x4a3020, PAL.foliage);
      tree.x = td.x;
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

    // ---- 7. PLATFORMS (PRNG layout based on levelShape) ----
    var platforms = _generatePlatforms();
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
          engine.juice.scalePop(self.scoreText, 1.4, 0.25);
        }
      }
      if (enemy && player && enemy.enabled !== false && self.invincibleTimer <= 0) {
        self.lives--;
        self.invincibleTimer = 1.5;
        engine.juice.screenShake(engine.world, 10, 0.3);
        engine.juice.hitPause(engine.app, 80);
        engine.juice.colorFlash(self.playerGfx, 0xff0000, 0.15);
        onDeathExplosion(engine.proton, enemy.x, enemy.y, '#ff4444');
        self.playerBody.vy = -350;
        self.updateLivesDisplay(engine);
        if (self.lives <= 0) {
          engine.switchScene('gameover', { score: self.score });
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
    if (_PIXI.filters && _PIXI.filters.DropShadowFilter && !this.playerGfx.filters) {
      this.playerGfx.filters = [new _PIXI.filters.DropShadowFilter({
        offset: { x: 3, y: 5 }, blur: 5, alpha: 0.5, color: 0x000000,
      })];
    }

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
        engine.juice.squashStretch(this.playerGfx, 0.7, 1.15);
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
      engine.switchScene('gameover', { score: this.score });
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

/** Runner skeleton — AI generates all gameplay in enter()/update() */
export const GAME_2D_SCENE_STARTER_RUNNER = `import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
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

// SKELETON — The AI agent MUST generate the full runner game.

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private physics!: PhysicsWorld;

  constructor() {
    this.container = new PIXI.Container();
  }

  async enter(engine: Engine2D): Promise<void> {
    this.physics = new PhysicsWorld(CONFIG.gravity);
    await _loadSpriteLib(THEME);
    var W = engine.config.width;
    var H = engine.config.height;

    // TODO: AI agent generates the full runner game based on Creative Brief
    // 1. Scrolling background + parallax layers
    // 2. Ground tiles that scroll and recycle
    // 3. Player character with jump mechanic
    // 4. Obstacle spawning system (procedural, speed-based)
    // 5. Coin spawning with collect effects
    // 6. Speed ramp over time
    // 7. Collision detection (obstacle = death, coin = score)
    // 8. Score + distance UI in engine.ui
    // 9. Ambient particle effects
  }

  update(engine: Engine2D, dt: number): void {
    this.physics.update(dt);
    // TODO: AI agent generates update logic (scrolling, spawning, collisions)
    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    engine.juice.killAll();
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
}
`;

/** Puzzle skeleton — AI generates all gameplay in enter()/update() */
export const GAME_2D_SCENE_STARTER_PUZZLE = `import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
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

// SKELETON — The AI agent MUST generate the full puzzle game.

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;

  constructor() {
    this.container = new PIXI.Container();
  }

  async enter(engine: Engine2D): Promise<void> {
    await _loadSpriteLib(THEME);
    var W = engine.config.width;
    var H = engine.config.height;

    // TODO: AI agent generates the full puzzle game based on Creative Brief
    // 1. Background (gradient or themed)
    // 2. Board container with grid
    // 3. Gem/tile creation with CONFIG.gemColors
    // 4. Selection highlight
    // 5. Swap mechanic (click two adjacent gems)
    // 6. Match detection (CONFIG.matchMin in a row)
    // 7. Cascade/fall animation
    // 8. Score display in engine.ui
    // 9. Sparkle effects on matches
  }

  update(engine: Engine2D, dt: number): void {
    // TODO: AI agent generates update logic (animations, input, cascades)
    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
}
`;

/** Shooter skeleton — AI generates all gameplay in enter()/update() */
export const GAME_2D_SCENE_STARTER_SHOOTER = `import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
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

// SKELETON — The AI agent MUST generate the full shooter game.

export class GameScene2D implements GameScene {
  name = 'game';
  container: any;

  constructor() {
    this.container = new PIXI.Container();
  }

  async enter(engine: Engine2D): Promise<void> {
    await _loadSpriteLib(THEME);
    var W = engine.config.width;
    var H = engine.config.height;

    // TODO: AI agent generates the full shooter game based on Creative Brief
    // 1. Space background with stars + parallax
    // 2. Player ship at bottom (drawShipShape or sprite)
    // 3. Bullet firing system (CONFIG.fireRate)
    // 4. Enemy wave spawning (CONFIG.enemySpawnRate)
    // 5. Enemy movement patterns (straight, zigzag, dive)
    // 6. Collision detection (bullet-enemy, enemy-player)
    // 7. Explosion effects on hits
    // 8. Score + lives UI in engine.ui
    // 9. Wave progression (harder over time)
  }

  update(engine: Engine2D, dt: number): void {
    // TODO: AI agent generates update logic (movement, bullets, enemies, collisions)
    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
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
          engine.juice.scalePop(self.scoreText, 1.4, 0.25);
        }
      }
      if (enemy && player && enemy.enabled !== false && self.invincibleTimer <= 0) {
        // Player hit by enemy — juice feedback
        self.lives--;
        self.invincibleTimer = 1.5;
        engine.juice.screenShake(engine.world, 10, 0.3);
        engine.juice.hitPause(engine.app, 80);
        engine.juice.colorFlash(self.playerGfx, 0xff0000, 0.15);
        onDeathExplosion(engine.proton, enemy.x, enemy.y, '#ff4444');
        // Bounce player up
        self.playerBody.vy = -350;
        self.updateLivesDisplay(engine);
        if (self.lives <= 0) {
          engine.switchScene('gameover', { score: self.score });
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
        engine.juice.squashStretch(this.playerGfx, 0.7, 1.15);
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
      engine.switchScene('gameover', { score: this.score });
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
        if (self.scoreText) engine.juice.scalePop(self.scoreText, 1.3, 0.2);
      }
      if (obs && player && !self.gameOver) {
        self.gameOver = true;
        engine.juice.screenShake(engine.world, 12, 0.4);
        engine.juice.hitPause(engine.app, 100);
        engine.juice.colorFlash(self.playerGfx, 0xff0000, 0.15);
        onDeathExplosion(engine.proton, self.playerBody.x, self.playerBody.y);
        setTimeout(function() { engine.switchScene('gameover', { score: self.score }); }, 800);
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
      engine.juice.squashStretch(this.playerGfx, 0.75, 1.12);
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
        engine.juice.scalePop(gem, 1.4, 0.15);
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
        engine.juice.scalePop(self.scoreText, 1.3, 0.2);
      }
      // Screen shake on big combos (4+ gems)
      if (matches.length >= 4) {
        engine.juice.screenShake(engine.world, 5 + matches.length, 0.2);
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
        engine.juice.screenShake(engine.world, 4, 0.15);
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
          engine.juice.scalePop(this.scoreText, 1.2, 0.15);
        }
        continue;
      }

      // Enemy-player collision
      if (Math.abs(en.x - this.playerX) < 25 && Math.abs(en.y - this.playerY) < 25) {
        onDeathExplosion(engine.proton, en.x, en.y);
        engine.juice.screenShake(engine.world, 10, 0.3);
        engine.juice.hitPause(engine.app, 60);
        engine.juice.colorFlash(this.playerGfx, 0xff0000, 0.15);
        this.container.removeChild(en.gfx);
        this.enemies.splice(ei, 1);
        this.lives--;
        this.updateLives();
        if (this.lives <= 0) {
          engine.switchScene('gameover', { score: this.score });
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

