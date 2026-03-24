// Auto-composed base scene template: puzzle (match-3)
import { Engine2D, GameScene, createGame2D, JuiceSystem } from "../engine/core";
import { onCollectSparkle, createAmbientEffect } from "../engine/effects";
import { PALETTES, lerpColor, setNoiseSeed, drawSkyGradient, drawStars, drawHeart, drawGemShape, drawVignette, drawAtmosphericFog, drawPointLight, createLightingLayer } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;

// ======================== SEEDED PRNG (Mulberry32) ========================
var _seed = __SEED__;
function _rng() { _seed |= 0; _seed = _seed + 0x6D2B79F5 | 0; var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function _rngRange(min: number, max: number) { return min + _rng() * (max - min); }
function _rngInt(min: number, max: number) { return Math.floor(_rngRange(min, max + 1)); }

// ======================== CONFIGURATION ========================
var THEME = '__THEME__';
var PAL = PALETTES[THEME] || PALETTES.candy;
var CONFIG = {
  cols: __GRID_COLS__,
  rows: __GRID_ROWS__,
  cellSize: __GRID_COLS__ > 7 ? 48 : 52,
  padding: 3,
  gemColors: __GEM_COLORS__,
  matchMin: 3,
  fallSpeed: 500,
  swapDur: 0.15,
};

// ======================== FEATURE BANK INTEGRATION ========================
__FEATURE_FACTORIES__

// ======================== GAME SCENE ========================
export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private board: any;
  private grid: { color: number; gfx: any; row: number; col: number }[][] = [];
  private score = 0;
  private selected: { r: number; c: number } | null = null;
  private animating = false;
  private boardX = 0; private boardY = 0;

  constructor() { this.container = new PIXI.Container(); }

  async enter(engine: Engine2D): Promise<void> {
    this.score = 0; this.selected = null; this.animating = false; this.grid = [];
    await _loadSpriteLib(THEME);
    setNoiseSeed(_seed);
    var W = engine.config.width, H = engine.config.height;

    // ---- Feature Bank: init features ----
__FEATURE_REGISTRATIONS__
    try { engine.features.initAll(); } catch(e) {}

    // ---- VISUAL ATMOSPHERE ----
    this.container.addChild(drawSkyGradient(W, H, PAL.skyTop, PAL.skyBottom));
    this.container.addChild(drawStars(W, H * 0.35, 35));
    try { var fl = drawAtmosphericFog(W, H * 0.85, THEME); for (var f = 0; f < fl.length; f++) this.container.addChild(fl[f]); } catch(e) {}
    try { this.container.addChild(createLightingLayer(THEME, W, H * 0.85, [])); } catch(e) {}
    try { if (PAL.ambient) { var af = createAmbientEffect(PAL.ambient as any, W, H); if (af && af.emitter) engine.addEmitter(af.emitter); } } catch(e) {}

    // ---- BOARD ----
    var bw = CONFIG.cols * (CONFIG.cellSize + CONFIG.padding);
    var bh = CONFIG.rows * (CONFIG.cellSize + CONFIG.padding);
    this.boardX = (W - bw) / 2; this.boardY = (H - bh) / 2 + 30;
    this.board = new PIXI.Container(); this.board.x = this.boardX; this.board.y = this.boardY;
    var bg = new PIXI.Graphics(); bg.roundRect(-10, -10, bw + 20, bh + 20, 12); bg.fill({ color: 0x000000, alpha: 0.3 });
    this.board.addChild(bg);
    this.container.addChild(this.board);

    // Fill grid (no initial matches)
    for (var r = 0; r < CONFIG.rows; r++) {
      this.grid[r] = [];
      for (var c = 0; c < CONFIG.cols; c++) {
        var ci2 = _rngInt(0, CONFIG.gemColors.length - 1);
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

    // ---- CONTROLS HINT ----
    var hint = engine.createText('Click gems to match 3+', { fontSize: 11, fill: 0x666666 });
    hint.anchor.set(0.5, 1); hint.x = W / 2; hint.y = H - 8; engine.ui.addChild(hint);

    // ---- VIGNETTE ----
    try { engine.ui.addChild(drawVignette(W, H)); } catch(e) {}

    // === AI ENHANCEMENT ZONE ===
__CUSTOM_CODE__
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
    this.grid[r1][c1] = b; this.grid[r2][c2] = a;
    b.row = r1; b.col = c1; a.row = r2; a.col = c2;
    var s = CONFIG.cellSize + CONFIG.padding;
    var self = this;
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
        if (matched[r4][c4]) {
          count++;
          this.grid[r4][c4].gfx.visible = false;
          try { onCollectSparkle(engine.proton, this.boardX + c4 * (CONFIG.cellSize + CONFIG.padding) + CONFIG.cellSize / 2, this.boardY + r4 * (CONFIG.cellSize + CONFIG.padding) + CONFIG.cellSize / 2); } catch(e) {}
        }
      }
    }
    if (count === 0) { this.animating = false; return; }
    this.score += count * 10;
    try { engine.events.emit('match-clear', { count: count, score: this.score }); } catch(e) {}
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
      for (var dr = writeRow; dr >= 0; dr--) {
        if (this.grid[dr][c] && this.grid[dr][c].gfx) { this.grid[dr][c].gfx.destroy(); }
      }
      for (var nr = writeRow; nr >= 0; nr--) {
        var ci = _rngInt(0, CONFIG.gemColors.length - 1);
        var newGem = this._createGem(c, nr, CONFIG.gemColors[ci]);
        newGem.gfx.y = -s;
        this.grid[nr][c] = newGem;
        if (gsap) gsap.to(newGem.gfx, { y: nr * s, duration: 0.2, delay: (writeRow - nr) * 0.03 }); else newGem.gfx.y = nr * s;
      }
    }
    var self = this;
    setTimeout(function() { self._checkMatches(engine); }, 300);
  }

  update(engine: Engine2D, dt: number): void {
    try { engine.features.updateAll(dt); } catch(e) {}
    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    try { engine.features.destroyAll(); } catch(e) {}
    this.container.removeChildren(); engine.ui.removeChildren();
  }
}
