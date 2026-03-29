/**
 * 2D Game Engine Core — Pixi.js + Proton
 *
 * This file contains the engine code that gets injected into 2D game projects
 * as template files. The AI agent imports from these pre-created files.
 *
 * Architecture:
 * - Scene manager: boot → menu → game → gameover (state machine)
 * - Game loop: PIXI.Ticker + Proton.update() each frame
 * - Input handler: keyboard (WASD/arrows/space), touch, pointer events
 * - Asset loader: PIXI.Assets.load() with progress tracking
 * - Camera: Container offset-based scrolling (follows player, bounded to world)
 * - Sprite factory: createSprite, createAnimatedSprite, createTilingSprite
 * - Text/UI layer: fixed container above game world (score, lives, HUD)
 * - Audio: basic Web Audio API
 */

// ============================================================================
// ENGINE CORE (src/engine/core.ts template content)
// ============================================================================

export const ENGINE_CORE_CONTENT = `
const PIXI = (window as any).PIXI;
const Proton = (window as any).Proton;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SceneName = 'boot' | 'menu' | 'game' | 'gameover' | string;

export interface GameScene {
  name: SceneName;
  container: any; // PIXI.Container
  enter(engine: Engine2D, data?: any): void;
  update(engine: Engine2D, dt: number): void;
  exit(engine: Engine2D): void;
}

export interface Engine2DConfig {
  width: number;
  height: number;
  backgroundColor: number;
  worldWidth?: number;
  worldHeight?: number;
  gravity?: number;
  pixelRatio?: number;
  antialias?: boolean;
}

// ---------------------------------------------------------------------------
// WorldBuilderSystem — Dynamic sprite-based world generation
// ---------------------------------------------------------------------------

interface WorldBuilderConfig {
  blueprint: string;
  theme: string;
  width: number;
  height: number;
  groundY: number;
  platformCount: number;
  levelShape: 'flat-wide' | 'staircase-ascending' | 'valley-bowl' | 'hilly-undulating';
  decorationDensity: number;
  cloudCount: number;
  seed: number;
  density: string;
  direction: string;
  hasGround: boolean;
  hasCeiling: boolean;
  liquidType: string;
  liquidLevel: number;
  platformStyle: string;
}

interface WorldBuilderResult {
  container: any;
  groundY: number;
  platforms: { x: number; y: number; w: number; body: any }[];
  bodies: any[];
  getHeightAt(x: number): number;
  updateParallax(camera: any): void;
}

class WorldBuilderSystem {
  private engine: Engine2D;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  build(config: Partial<WorldBuilderConfig> = {}): WorldBuilderResult {
    var PIXI = (window as any).PIXI;
    var cfg: WorldBuilderConfig = {
      blueprint: config.blueprint || 'outdoor-scroll',
      theme: config.theme || 'forest',
      width: config.width || 4000,
      height: config.height || 900,
      groundY: config.groundY || 680,
      platformCount: config.platformCount || 11,
      levelShape: config.levelShape || 'flat-wide',
      decorationDensity: config.decorationDensity ?? 1.0,
      cloudCount: config.cloudCount ?? 7,
      seed: config.seed || Date.now(),
      density: config.density || 'medium',
      direction: config.direction || 'horizontal',
      hasGround: config.hasGround !== false,
      hasCeiling: config.hasCeiling || false,
      liquidType: config.liquidType || 'none',
      liquidLevel: config.liquidLevel || 0,
      platformStyle: config.platformStyle || 'spread',
    };

    // Seeded PRNG (Mulberry32)
    var _s = cfg.seed | 0;
    function rng() { _s = _s + 0x6D2B79F5 | 0; var t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    function rngRange(min: number, max: number) { return min + rng() * (max - min); }
    function rngInt(min: number, max: number) { return Math.floor(rngRange(min, max + 1)); }

    // Sprite helpers — read from global sprite cache (populated by media-stock.ts)
    var _cache = (window as any).__vibexeSpriteCache || {};
    function _getSprite(category: string, name: string): any {
      var key = '2d/sprites/' + category + '/' + name + '.png';
      var tex = _cache[key];
      if (!tex) { key = '2d/sprites/' + category + '/' + name + '.svg'; tex = _cache[key]; }
      if (!tex) return null;
      return new PIXI.Sprite(tex);
    }
    function _getTilingSprite(category: string, name: string, width: number, height: number): any {
      var key = '2d/sprites/' + category + '/' + name + '.png';
      var tex = _cache[key];
      if (!tex) { key = '2d/sprites/' + category + '/' + name + '.svg'; tex = _cache[key]; }
      if (!tex || !PIXI.TilingSprite) return null;
      return new PIXI.TilingSprite({ texture: tex, width: width, height: height });
    }
    var _spriteCount = Object.keys(_cache).length;
    if (_spriteCount > 0) console.log('[WorldBuilder] Sprite cache: ' + _spriteCount + ' textures available');

    var container = new PIXI.Container();
    var bodies: any[] = [];
    var platforms: { x: number; y: number; w: number; body: any }[] = [];
    var parallaxLayers: { gfx: any; factor: number }[] = [];
    var clouds: { gfx: any; speed: number }[] = [];

    var W = cfg.width;
    var H = cfg.height;
    var GY = cfg.groundY;
    var theme = cfg.theme;

    // Theme palettes (inline for independence from template imports)
    var palettes: Record<string, any> = {
      forest:   { skyTop: 0x0a0a2e, skyBottom: 0x1a4a3a, mountains: [0x0d1a0d, 0x1a2d1a, 0x2a3d2a], ground: 0x2d5a27, groundTop: 0x4a8a3a, platform: 0x5a3a1a, platformTop: 0x7a5a3a, foliage: 0x339933, wall: 0x444433, ceiling: 0x333322 },
      sunset:   { skyTop: 0x1a0533, skyBottom: 0xff6633, mountains: [0x1a1133, 0x2d1a44, 0x442d55], ground: 0x3a5a2a, groundTop: 0x5a8a3a, platform: 0x6a4a2a, platformTop: 0x8a6a4a, foliage: 0x447733, wall: 0x553344, ceiling: 0x442233 },
      space:    { skyTop: 0x000011, skyBottom: 0x0a0a33, mountains: [0x111133, 0x1a1a44, 0x222255], ground: 0x333355, groundTop: 0x444477, platform: 0x555577, platformTop: 0x6666aa, foliage: 0x4466aa, wall: 0x333355, ceiling: 0x222244 },
      volcanic: { skyTop: 0x1a0000, skyBottom: 0x4a1500, mountains: [0x1a0505, 0x2d0a0a, 0x3d1515], ground: 0x2a1a0a, groundTop: 0x4a2a1a, platform: 0x3a2a1a, platformTop: 0x5a3a2a, foliage: 0x553322, wall: 0x3a2020, ceiling: 0x2a1515 },
      candy:    { skyTop: 0xffaacc, skyBottom: 0xaaccff, mountains: [0xddaacc, 0xccbbdd, 0xbbccee], ground: 0x88cc77, groundTop: 0xaaee99, platform: 0xcc88aa, platformTop: 0xeeaacc, foliage: 0x77cc55, wall: 0xddaacc, ceiling: 0xccbbdd },
      arctic:   { skyTop: 0x1a2a4a, skyBottom: 0x7799bb, mountains: [0x334455, 0x445566, 0x556677], ground: 0x889999, groundTop: 0xaabbcc, platform: 0x778899, platformTop: 0x99aabb, foliage: 0x446666, wall: 0x556677, ceiling: 0x445566 },
      dark:     { skyTop: 0x050510, skyBottom: 0x0a0a20, mountains: [0x0a0a15, 0x10101d, 0x151525], ground: 0x1a1a2a, groundTop: 0x2a2a3a, platform: 0x222233, platformTop: 0x333344, foliage: 0x1a2a1a, wall: 0x151520, ceiling: 0x0a0a15 },
      ocean:    { skyTop: 0x001133, skyBottom: 0x0055aa, mountains: [0x002244, 0x003355, 0x004466], ground: 0x224455, groundTop: 0x336677, platform: 0x335566, platformTop: 0x447788, foliage: 0x228855, wall: 0x003355, ceiling: 0x002244 },
    };
    var pal = palettes[theme] || palettes.forest;

    // Theme -> sprite name mappings
    var groundMap: Record<string, string> = { forest: 'grass', sunset: 'grass', candy: 'grass', volcanic: 'stone', dark: 'stone', space: 'stone', arctic: 'ice', ocean: 'sand' };
    var platMap: Record<string, string> = { forest: 'grass_block', sunset: 'grass_block', candy: 'grass_block', volcanic: 'stone_block', dark: 'dark_block', space: 'dark_block', arctic: 'ice_block', ocean: 'sand_block' };
    var treeMap: Record<string, string[]> = {
      forest: ['round_tree', 'pine_tree'], sunset: ['round_tree', 'palm_tree'], candy: ['round_tree'],
      volcanic: ['dead_tree'], dark: ['dead_tree', 'pine_tree'], space: [],
      arctic: ['pine_tree'], ocean: ['palm_tree'],
    };

    // Helper: hex number to CSS
    function hexCss(c: number): string { return '#' + ('000000' + c.toString(16)).slice(-6); }

    // Build context for blueprint dispatch
    var ctx = { PIXI: PIXI, cfg: cfg, rng: rng, rngRange: rngRange, rngInt: rngInt, _getSprite: _getSprite, _getTilingSprite: _getTilingSprite, pal: pal, hexCss: hexCss, container: container, bodies: bodies, platforms: platforms, parallaxLayers: parallaxLayers, clouds: clouds, W: W, H: H, GY: GY, groundMap: groundMap, platMap: platMap, treeMap: treeMap };

    var _bpDone = false;
    var _bp = cfg.blueprint;
    if (_bp === 'cave-system') { this._buildCaveSystem(ctx); _bpDone = true; }
    else if (_bp === 'vertical-tower') { this._buildVerticalTower(ctx); _bpDone = true; }
    else if (_bp === 'floating-islands') { this._buildFloatingIslands(ctx); _bpDone = true; }
    else if (_bp === 'arena') { this._buildArena(ctx); _bpDone = true; }
    else if (_bp === 'dungeon-rooms') { this._buildDungeonRooms(ctx); _bpDone = true; }
    else if (_bp === 'city-rooftops') { this._buildCityRooftops(ctx); _bpDone = true; }
    else if (_bp === 'forest-canopy') { this._buildForestCanopy(ctx); _bpDone = true; }
    else if (_bp === 'underwater') { this._buildUnderwater(ctx); _bpDone = true; }
    else if (_bp === 'endless-runner') { this._buildEndlessRunner(ctx); _bpDone = true; }

    if (!_bpDone) {
    // ==== Default: OUTDOOR SCROLL blueprint ====

    // =======================================================================
    // 1. SKY GRADIENT
    // =======================================================================
    try {
      if (PIXI.FillGradient) {
        var skyGrad = new PIXI.FillGradient({ type: 'linear', colorStops: [
          { offset: 0, color: hexCss(pal.skyTop) },
          { offset: 1, color: hexCss(pal.skyBottom) },
        ], x0: 0, y0: 0, x1: 0, y1: H });
        var skyRect = new PIXI.Graphics();
        skyRect.rect(0, 0, W, H);
        skyRect.fill(skyGrad);
        container.addChild(skyRect);
      } else {
        var skyG = new PIXI.Graphics();
        skyG.rect(0, 0, W, H);
        skyG.fill({ color: pal.skyBottom });
        container.addChild(skyG);
      }
    } catch(e) {
      var skyFb = new PIXI.Graphics();
      skyFb.rect(0, 0, W, H);
      skyFb.fill({ color: pal.skyBottom });
      container.addChild(skyFb);
    }

    // =======================================================================
    // 2. STARS (for space/dark themes)
    // =======================================================================
    if (theme === 'space' || theme === 'dark') {
      var starG = new PIXI.Graphics();
      var starCount = rngInt(60, 120);
      for (var si = 0; si < starCount; si++) {
        var sx = rngRange(0, W);
        var sy = rngRange(0, GY * 0.5);
        var sr = rngRange(0.5, 2);
        starG.circle(sx, sy, sr);
        starG.fill({ color: 0xffffff, alpha: rngRange(0.3, 0.9) });
      }
      container.addChild(starG);
    }

    // =======================================================================
    // 3. PARALLAX HILLS (3 layers — purely procedural smooth bezier curves)
    // =======================================================================
    for (var mi = 0; mi < 3; mi++) {
      var mColor = pal.mountains[mi] || pal.mountains[0];
      var mBaseY = GY - 10 - mi * 55;
      var mAlpha = 0.35 + mi * 0.15;
      var mG = new PIXI.Graphics();

      // Generate smooth rolling hills using bezier curves (NO sharp peaks)
      var hillW = 300 + mi * 120 + rngRange(-40, 40);
      var x = 0;
      mG.moveTo(0, mBaseY + rngRange(-10, 10));
      while (x < W + hillW) {
        var rise = rngRange(40 + mi * 20, 90 + mi * 35);
        var cp1x = x + hillW * 0.25;
        var cp1y = mBaseY - rise;
        var cp2x = x + hillW * 0.75;
        var cp2y = mBaseY - rise * rngRange(0.4, 0.9);
        var endx = x + hillW;
        var endy = mBaseY + rngRange(-8, 8);
        mG.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endx, endy);
        x = endx;
        hillW = 250 + mi * 100 + rngRange(-60, 60);
      }
      mG.lineTo(W + 50, mBaseY);
      mG.lineTo(W + 50, H + 20);
      mG.lineTo(-50, H + 20);
      mG.closePath();
      mG.fill({ color: mColor, alpha: mAlpha });

      container.addChild(mG);
      parallaxLayers.push({ gfx: mG, factor: 0.08 + mi * 0.12 });
    }

    // =======================================================================
    // 4. CLOUDS (skip for space/dark)
    // =======================================================================
    if (theme !== 'space' && theme !== 'dark') {
      var cCount = cfg.cloudCount;
      for (var ci = 0; ci < cCount; ci++) {
        var cloudSpr = _getSprite('clouds', rng() > 0.5 ? 'cloud_puffy' : 'cloud_small');
        if (cloudSpr) {
          cloudSpr.anchor.set(0.5, 0.5);
          cloudSpr.x = rngRange(0, W);
          cloudSpr.y = rngRange(40, GY * 0.35);
          cloudSpr.scale.set(rngRange(0.8, 2.0));
          cloudSpr.alpha = rngRange(0.4, 0.8);
          if (theme === 'volcanic') { cloudSpr.tint = 0x997766; cloudSpr.alpha = 0.5; }
          container.addChild(cloudSpr);
          clouds.push({ gfx: cloudSpr, speed: rngRange(5, 15) });
        } else {
          // Fallback: ellipse cloud
          var cG = new PIXI.Graphics();
          var cw2 = rngRange(80, 180);
          var ch2 = rngRange(20, 40);
          cG.ellipse(0, 0, cw2 / 2, ch2 / 2);
          cG.fill({ color: 0xffffff, alpha: rngRange(0.3, 0.6) });
          cG.x = rngRange(0, W);
          cG.y = rngRange(40, GY * 0.35);
          container.addChild(cG);
          clouds.push({ gfx: cG, speed: rngRange(5, 15) });
        }
      }
    }

    // =======================================================================
    // 5-6. GROUND + PLATFORMS (auto-tiled terrain)
    // =======================================================================
    // Calculate platform positions first
    var spacing = (W - 600) / Math.max(cfg.platformCount, 1);
    var _platPositions: { x: number; y: number; w: number }[] = [];
    for (var pi = 0; pi < cfg.platformCount; pi++) {
      var px = 350 + pi * spacing + rngRange(-spacing * 0.2, spacing * 0.2);
      var pw = rngInt(120, 200);
      var t = pi / Math.max(cfg.platformCount - 1, 1);
      var minPY = GY - 360, maxPY = GY - 80;
      var py: number;
      switch (cfg.levelShape) {
        case 'staircase-ascending': py = maxPY - t * (maxPY - minPY) + rngRange(-20, 20); break;
        case 'valley-bowl': var bowl = Math.abs(t - 0.5) * 2; py = minPY + bowl * (maxPY - minPY) * 0.6 + rngRange(-15, 15); break;
        case 'hilly-undulating': py = minPY + (maxPY - minPY) * (0.5 + 0.4 * Math.sin(t * Math.PI * 3)) + rngRange(-20, 20); break;
        default: py = rngRange(minPY, maxPY);
      }
      if (pi > 0 && _platPositions.length > 0) {
        var lastP2 = _platPositions[_platPositions.length - 1];
        if (Math.abs(py - lastP2.y) < 80) py = lastP2.y + (py > lastP2.y ? 80 : -80);
      }
      _platPositions.push({ x: px, y: py, w: pw });
      var pBody = { x: px, y: py, w: pw, h: 24, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(pBody);
      platforms.push({ x: px, y: py, w: pw, body: pBody });
    }

    // Ground physics body
    bodies.push({ x: W / 2, y: GY + 4, w: W, h: 8, isStatic: true, tag: 'ground' });

    // Render auto-tiled terrain (ground + platforms)
    var _gy = GY;
    var _pp = _platPositions;
    this._renderTerrainTiles(ctx, function(grid, gridW, gridH, ts) {
      // Ground: fill from groundY to bottom
      var groundRow = Math.floor(_gy / ts);
      for (var y = groundRow; y < gridH; y++)
        for (var x = 0; x < gridW; x++) grid[y * gridW + x] = 1;
      // Platforms: fill thin rectangles
      for (var i = 0; i < _pp.length; i++) {
        var p = _pp[i];
        var px1 = Math.max(0, Math.floor((p.x - p.w / 2) / ts));
        var px2 = Math.min(gridW, Math.ceil((p.x + p.w / 2) / ts));
        var py2 = Math.floor(p.y / ts);
        for (var x = px1; x < px2; x++) grid[py2 * gridW + x] = 1;
      }
    });

    // =======================================================================
    // 7. TREES/BUSHES on ground surface
    // =======================================================================
    var themeTreeNames = treeMap[theme] || ['round_tree'];
    if (themeTreeNames.length > 0) {
      var treeCount = Math.round(rngInt(4, 8) * cfg.decorationDensity);
      var treeSpacing = W / Math.max(treeCount, 1);
      for (var ti = 0; ti < treeCount; ti++) {
        var treeName = themeTreeNames[rngInt(0, themeTreeNames.length - 1)];
        var treeSpr = _getSprite('trees', treeName);
        if (treeSpr) {
          treeSpr.anchor.set(0.5, 1); // bottom-center anchor
          treeSpr.x = ti * treeSpacing + rngRange(40, treeSpacing - 40);
          treeSpr.y = GY; // anchored at ground level
          treeSpr.scale.set(rngRange(1.5, 3.0));
          container.addChild(treeSpr);
        }
      }
    }

    // Bushes between trees
    var bushCount = Math.round(rngInt(3, 6) * cfg.decorationDensity);
    for (var bi = 0; bi < bushCount; bi++) {
      var bushName = rng() > 0.5 ? 'bush_green' : 'bush_flower';
      var bushSpr = _getSprite('bushes', bushName);
      if (bushSpr) {
        bushSpr.anchor.set(0.5, 1);
        bushSpr.x = rngRange(100, W - 100);
        bushSpr.y = GY;
        bushSpr.scale.set(rngRange(1.0, 2.0));
        container.addChild(bushSpr);
      }
    }

    // =======================================================================
    // 8. PROPS (crates, barrels, rocks scattered on ground)
    // =======================================================================
    var propCount = Math.round(rngInt(3, 7) * cfg.decorationDensity);
    var propNames = ['crate', 'barrel', 'rock', 'fence', 'sign_post'];
    for (var pri = 0; pri < propCount; pri++) {
      var propName = propNames[rngInt(0, propNames.length - 1)];
      var propSpr = _getSprite('props', propName);
      if (propSpr) {
        propSpr.anchor.set(0.5, 1);
        propSpr.x = rngRange(200, W - 200);
        propSpr.y = GY;
        propSpr.scale.set(rngRange(1.0, 1.8));
        if (rng() > 0.5) propSpr.scale.x *= -1; // random flip
        container.addChild(propSpr);
      }
    }

    // =======================================================================
    // 9. VIGNETTE + FOG overlay
    // =======================================================================
    try {
      // Atmospheric fog (semi-transparent strip at ground level)
      var fogG = new PIXI.Graphics();
      fogG.rect(0, GY - 60, W, 80);
      fogG.fill({ color: pal.skyBottom, alpha: 0.08 });
      container.addChild(fogG);

      // Screen vignette
      var vigG = new PIXI.Graphics();
      vigG.rect(0, 0, W, H);
      vigG.fill({ color: 0x000000, alpha: 0 });
      // Top/bottom darkening strips
      var vigTop = new PIXI.Graphics();
      vigTop.rect(0, 0, W, 80);
      vigTop.fill({ color: 0x000000, alpha: 0.25 });
      var vigBot = new PIXI.Graphics();
      vigBot.rect(0, H - 40, W, 40);
      vigBot.fill({ color: 0x000000, alpha: 0.15 });
      container.addChild(vigTop);
      container.addChild(vigBot);
    } catch(e) { /* vignette optional */ }
    } // end if (!_bpDone) outdoor-scroll block

    // Liquid overlay (applies to any blueprint)
    if (cfg.liquidType !== 'none' && cfg.liquidLevel > 0) {
      var liqColors: Record<string,number> = { water: 0x0066cc, lava: 0xff3300, acid: 0x33ff00 };
      var liqY = H - (H * cfg.liquidLevel);
      var liqG = new PIXI.Graphics();
      liqG.rect(0, liqY, W, H - liqY);
      liqG.fill({ color: liqColors[cfg.liquidType] || 0x0066cc, alpha: cfg.liquidType === 'lava' ? 0.5 : 0.35 });
      container.addChild(liqG);
    }

    console.log('[WorldBuilder] Built ' + (cfg.blueprint || 'outdoor-scroll') + '/' + cfg.theme + ' world (' + W + 'x' + H + ', ' + platforms.length + ' platforms, seed=' + cfg.seed + ')');

    // Build result
    var result: WorldBuilderResult = {
      container: container,
      groundY: GY,
      platforms: platforms,
      bodies: bodies,
      getHeightAt: function(x: number): number {
        // Check if x is over a platform, otherwise return groundY
        for (var i = 0; i < platforms.length; i++) {
          var p = platforms[i];
          if (x >= p.x - p.w / 2 && x <= p.x + p.w / 2) {
            return p.y;
          }
        }
        return GY;
      },
      updateParallax: function(camera: any): void {
        if (!camera) return;
        var cx = camera.x || 0;
        for (var i = 0; i < parallaxLayers.length; i++) {
          var layer = parallaxLayers[i];
          if (layer.gfx) {
            layer.gfx.x = -cx * layer.factor;
          }
        }
        // Drift clouds
        for (var j = 0; j < clouds.length; j++) {
          var cl = clouds[j];
          cl.gfx.x += cl.speed * 0.016; // ~60fps
          if (cl.gfx.x > W + 200) cl.gfx.x = -200;
        }
      },
    };

    return result;
  }

  // ===================================================================
  // TILESET GENERATOR — Programmatic 47-tile auto-tile spritesheet
  // ===================================================================

  // Biome color definitions: body fill, surface top, edge tint, corner accent
  private static BIOME_COLORS: Record<string, { body: string; top: string; edge: string; accent: string }> = {
    grass:  { body: '#6B4226', top: '#4CAF50', edge: '#5D3A1A', accent: '#3E8E41' },
    stone:  { body: '#666666', top: '#888888', edge: '#505050', accent: '#777777' },
    ice:    { body: '#A8CCE0', top: '#E0F0FF', edge: '#8AB8D4', accent: '#C8E4F4' },
    sand:   { body: '#C2A060', top: '#D4B878', edge: '#A89050', accent: '#CCB068' },
    cave:   { body: '#3A3A2A', top: '#4A4A3A', edge: '#282818', accent: '#505040' },
    castle: { body: '#707070', top: '#909090', edge: '#505050', accent: '#808080' },
    candy:  { body: '#E090B0', top: '#F0A8C8', edge: '#C87898', accent: '#E8A0C0' },
    lava:   { body: '#2A1A0A', top: '#4A2A15', edge: '#1A0A00', accent: '#803010' },
  };

  // Theme → biome mapping
  private static THEME_BIOME: Record<string, string> = {
    forest: 'grass', sunset: 'grass', candy: 'candy', volcanic: 'lava',
    dark: 'cave', space: 'stone', arctic: 'ice', ocean: 'sand',
  };

  // 47 unique reduced bitmasks (same as TilemapSystem)
  private static TILE47_MASKS: number[] = [
    0,1,4,5,7,16,17,20,21,23,28,29,31,64,65,68,69,71,80,81,84,85,87,92,93,95,
    193,197,199,209,213,215,221,223,112,113,116,117,119,124,125,127,241,245,247,253,255
  ];

  // Reduce 8-bit neighbor mask to effective mask (strip irrelevant diagonals)
  private static _reduceMask(mask: number): number {
    var N = (mask & 1) ? 1 : 0, NE = (mask & 2) ? 1 : 0, E = (mask & 4) ? 1 : 0, SE = (mask & 8) ? 1 : 0;
    var S = (mask & 16) ? 1 : 0, SW = (mask & 32) ? 1 : 0, W = (mask & 64) ? 1 : 0, NW = (mask & 128) ? 1 : 0;
    if (!(N && E)) NE = 0; if (!(E && S)) SE = 0; if (!(S && W)) SW = 0; if (!(W && N)) NW = 0;
    return N | (NE << 1) | (E << 2) | (SE << 3) | (S << 4) | (SW << 5) | (W << 6) | (NW << 7);
  }

  // Build 256→47 lookup
  private static _bitmask256to47: number[] = (() => {
    var map: number[] = new Array(256);
    var rev: Record<number, number> = {};
    for (var i = 0; i < WorldBuilderSystem.TILE47_MASKS.length; i++) rev[WorldBuilderSystem.TILE47_MASKS[i]] = i;
    for (var m = 0; m < 256; m++) {
      var r = WorldBuilderSystem._reduceMask(m);
      map[m] = (rev[r] !== undefined) ? rev[r] : 0;
    }
    return map;
  })();

  /**
   * Generate a 47-tile auto-tile spritesheet for a biome.
   * Returns a PIXI.Texture (256×192px: 8 cols × 6 rows of 32×32 tiles).
   */
  private _generateTileset(biome: string, tileSize: number): any {
    var PIXI = (window as any).PIXI;
    var colors = WorldBuilderSystem.BIOME_COLORS[biome] || WorldBuilderSystem.BIOME_COLORS.grass;
    var cols = 8, rows = 6;
    var cw = cols * tileSize, ch = rows * tileSize;

    var canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    var g = canvas.getContext('2d')!;

    var masks = WorldBuilderSystem.TILE47_MASKS;
    var edge = Math.max(2, tileSize >> 4); // edge width (2-4px)
    var topH = Math.max(3, tileSize >> 3); // surface strip height (3-4px)

    for (var ti = 0; ti < 47; ti++) {
      var mask = masks[ti];
      var tx = (ti % cols) * tileSize;
      var ty = (ti / cols | 0) * tileSize;

      var hasN = !!(mask & 1), hasNE = !!(mask & 2), hasE = !!(mask & 4), hasSE = !!(mask & 8);
      var hasS = !!(mask & 16), hasSW = !!(mask & 32), hasW = !!(mask & 64), hasNW = !!(mask & 128);

      // 1. Base fill
      g.fillStyle = colors.body;
      g.fillRect(tx, ty, tileSize, tileSize);

      // 2. Surface strip on exposed top
      if (!hasN) {
        g.fillStyle = colors.top;
        g.fillRect(tx, ty, tileSize, topH);
      }

      // 3. Edge shading on exposed sides
      g.fillStyle = colors.edge;
      if (!hasS) g.fillRect(tx, ty + tileSize - edge, tileSize, edge);
      if (!hasW) g.fillRect(tx, ty, edge, tileSize);
      if (!hasE) g.fillRect(tx + tileSize - edge, ty, edge, tileSize);
      if (!hasN) { g.fillRect(tx, ty + topH, tileSize, 1); } // subtle line below surface

      // 4. Outer corners (both adjacent cardinals missing)
      g.fillStyle = colors.edge;
      var cr = edge + 1;
      if (!hasN && !hasW) { g.fillRect(tx, ty, cr, cr); g.fillStyle = colors.top; g.fillRect(tx, ty, cr, Math.min(cr, topH)); g.fillStyle = colors.edge; }
      if (!hasN && !hasE) { g.fillRect(tx + tileSize - cr, ty, cr, cr); g.fillStyle = colors.top; g.fillRect(tx + tileSize - cr, ty, cr, Math.min(cr, topH)); g.fillStyle = colors.edge; }
      if (!hasS && !hasW) g.fillRect(tx, ty + tileSize - cr, cr, cr);
      if (!hasS && !hasE) g.fillRect(tx + tileSize - cr, ty + tileSize - cr, cr, cr);

      // 5. Inner corners (diagonal missing but both cardinals present)
      g.fillStyle = colors.accent;
      var ic = edge;
      if (hasN && hasW && !hasNW) g.fillRect(tx, ty, ic, ic);
      if (hasN && hasE && !hasNE) g.fillRect(tx + tileSize - ic, ty, ic, ic);
      if (hasS && hasW && !hasSW) g.fillRect(tx, ty + tileSize - ic, ic, ic);
      if (hasS && hasE && !hasSE) g.fillRect(tx + tileSize - ic, ty + tileSize - ic, ic, ic);

      // 6. Noise variation (subtle 1px dots for texture)
      g.fillStyle = colors.accent;
      g.globalAlpha = 0.15;
      for (var ni = 0; ni < 3; ni++) {
        var nx = tx + ((ti * 7 + ni * 13) % (tileSize - 4)) + 2;
        var ny = ty + ((ti * 11 + ni * 17) % (tileSize - 4)) + 2;
        g.fillRect(nx, ny, 1, 1);
      }
      g.globalAlpha = 1.0;
    }

    // Create PIXI texture from canvas
    return PIXI.Texture.from(canvas);
  }

  /**
   * Render a terrain grid using auto-tiled sprites.
   * grid: Uint8Array (1=solid, 0=empty), gridW×gridH
   * Returns PIXI.Container with all tile sprites.
   */
  private _renderAutoTiles(ctx: any, grid: Uint8Array, gridW: number, gridH: number, tileSize: number, tileset: any, offsetX?: number, offsetY?: number): any {
    var PIXI = ctx.PIXI;
    var container = new PIXI.Container();
    container.label = 'autotiles';
    var cols = 8;
    var lookup = WorldBuilderSystem._bitmask256to47;
    var ox = offsetX || 0, oy = offsetY || 0;

    for (var gy = 0; gy < gridH; gy++) {
      for (var gx = 0; gx < gridW; gx++) {
        if (!grid[gy * gridW + gx]) continue;

        // Compute 8-bit neighbor mask
        var mask = 0;
        if (gy > 0 && grid[(gy - 1) * gridW + gx]) mask |= 1;          // N
        if (gy > 0 && gx < gridW - 1 && grid[(gy - 1) * gridW + gx + 1]) mask |= 2; // NE
        if (gx < gridW - 1 && grid[gy * gridW + gx + 1]) mask |= 4;    // E
        if (gy < gridH - 1 && gx < gridW - 1 && grid[(gy + 1) * gridW + gx + 1]) mask |= 8; // SE
        if (gy < gridH - 1 && grid[(gy + 1) * gridW + gx]) mask |= 16;  // S
        if (gy < gridH - 1 && gx > 0 && grid[(gy + 1) * gridW + gx - 1]) mask |= 32; // SW
        if (gx > 0 && grid[gy * gridW + gx - 1]) mask |= 64;            // W
        if (gy > 0 && gx > 0 && grid[(gy - 1) * gridW + gx - 1]) mask |= 128; // NW

        var tileIdx = lookup[mask];
        var stx = (tileIdx % cols) * tileSize;
        var sty = (tileIdx / cols | 0) * tileSize;

        var frame = new PIXI.Rectangle(stx, sty, tileSize, tileSize);
        var tex = new PIXI.Texture({ source: tileset.source || tileset, frame: frame });
        var spr = new PIXI.Sprite(tex);
        spr.x = ox + gx * tileSize;
        spr.y = oy + gy * tileSize;
        container.addChild(spr);
      }
    }

    return container;
  }

  /**
   * Fill a terrain grid rect. Used by blueprints.
   */
  private _fillGridRect(grid: Uint8Array, gridW: number, gx: number, gy: number, w: number, h: number): void {
    for (var y = gy; y < gy + h; y++) {
      for (var x = gx; x < gx + w; x++) {
        if (x >= 0 && x < gridW && y >= 0) grid[y * gridW + x] = 1;
      }
    }
  }

  /**
   * Get biome name for a theme.
   */
  private _getBiome(theme: string): string {
    return WorldBuilderSystem.THEME_BIOME[theme] || 'grass';
  }

  /**
   * Render auto-tiled terrain from a grid fill function.
   * fillFn receives (grid, gridW, gridH, tileSize) and fills grid cells with 1 for solid.
   */
  private _renderTerrainTiles(ctx: any, fillFn: (grid: Uint8Array, gridW: number, gridH: number, ts: number) => void): void {
    var tileSize = 32;
    var gridW = Math.ceil(ctx.W / tileSize);
    var gridH = Math.ceil(ctx.H / tileSize);
    var grid = new Uint8Array(gridW * gridH);

    fillFn(grid, gridW, gridH, tileSize);

    var biome = this._getBiome(ctx.cfg.theme);
    var tileset = this._generateTileset(biome, tileSize);
    var tileContainer = this._renderAutoTiles(ctx, grid, gridW, gridH, tileSize, tileset);
    ctx.container.addChild(tileContainer);
  }

  // ===================================================================
  // BLUEPRINT: cave-system — enclosed dark caves with ceiling + floor
  // ===================================================================
  private _buildCaveSystem(ctx: any): void {
    var PIXI = ctx.PIXI, rng = ctx.rng, rngRange = ctx.rngRange, rngInt = ctx.rngInt;
    var _getSprite = ctx._getSprite, pal = ctx.pal;
    var container = ctx.container, bodies = ctx.bodies, platforms = ctx.platforms;
    var W = ctx.W, H = ctx.H, GY = ctx.GY, cfg = ctx.cfg;

    // Dark solid background
    var bg = new PIXI.Graphics(); bg.rect(0, 0, W, H); bg.fill({ color: 0x0a0a0f }); container.addChild(bg);

    // Irregular ceiling + floor heights for grid
    var ceilH = 60 + rngInt(0, 40);
    var _ceilHeights: number[] = [];
    var _ceilSeed = rng();
    for (var cx = 0; cx <= W; cx += 32) {
      _ceilHeights.push(ceilH + Math.sin(cx * 0.01 + _ceilSeed * 2) * 25 + rng() * 15);
    }
    var _floorHeights: number[] = [];
    var _floorSeed = rng();
    for (var fx2 = 0; fx2 <= W; fx2 += 32) {
      _floorHeights.push(GY + Math.sin(fx2 * 0.008 + _floorSeed * 3) * 40 + rng() * 20 - 20);
    }
    bodies.push({ x: W / 2, y: ceilH / 2, w: W, h: ceilH, isStatic: true, tag: 'ceiling' });
    bodies.push({ x: W / 2, y: GY + 4, w: W, h: 8, isStatic: true, tag: 'ground' });

    // Auto-tiled cave terrain (ceiling + floor)
    var _ch = _ceilHeights, _fh = _floorHeights;
    this._renderTerrainTiles(ctx, function(grid, gridW, gridH, ts) {
      for (var gx = 0; gx < gridW; gx++) {
        var ceilRow = Math.floor((_ch[Math.min(gx, _ch.length - 1)] || ceilH) / ts);
        var floorRow = Math.floor((_fh[Math.min(gx, _fh.length - 1)] || GY) / ts);
        // Ceiling tiles
        for (var y = 0; y <= ceilRow; y++) grid[y * gridW + gx] = 1;
        // Floor tiles
        for (var y2 = floorRow; y2 < gridH; y2++) grid[y2 * gridW + gx] = 1;
      }
    });

    // Stalactites from ceiling
    for (var si = 0; si < rngInt(6, 14); si++) {
      var sx = rngRange(100, W - 100), sh = rngRange(30, 80), sw = rngRange(8, 20);
      var stalG = new PIXI.Graphics();
      stalG.moveTo(sx - sw, ceilH); stalG.lineTo(sx, ceilH + sh); stalG.lineTo(sx + sw, ceilH);
      stalG.closePath(); stalG.fill({ color: pal.wall || 0x333322 }); container.addChild(stalG);
    }

    // Stalagmites from floor
    for (var gi = 0; gi < rngInt(4, 10); gi++) {
      var gx = rngRange(100, W - 100), gh = rngRange(20, 60), gw = rngRange(8, 18);
      var stagG = new PIXI.Graphics();
      stagG.moveTo(gx - gw, GY); stagG.lineTo(gx, GY - gh); stagG.lineTo(gx + gw, GY);
      stagG.closePath(); stagG.fill({ color: pal.ground || 0x2a2a1a }); container.addChild(stagG);
    }

    // Platforms — clustered in cave space
    var pCount = cfg.platformCount || 8;
    var minY = ceilH + 60, maxY = GY - 60;
    for (var pi = 0; pi < pCount; pi++) {
      var px = rngRange(200, W - 200), py = rngRange(minY, maxY), pw = rngInt(80, 160);
      var pG = new PIXI.Graphics(); pG.roundRect(-pw / 2, -8, pw, 16, 3); pG.fill({ color: pal.platform || 0x444433 });
      pG.x = px; pG.y = py; container.addChild(pG);
      var pBody = { x: px, y: py, w: pw, h: 16, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(pBody); platforms.push({ x: px, y: py, w: pw, body: pBody });
    }

    // Glowing crystals
    for (var ci = 0; ci < rngInt(3, 8); ci++) {
      var crG = new PIXI.Graphics(); crG.circle(0, 0, rngRange(3, 8));
      crG.fill({ color: 0x66ccff, alpha: rngRange(0.4, 0.8) });
      crG.x = rngRange(50, W - 50); crG.y = rng() > 0.5 ? ceilH + rngRange(5, 30) : GY - rngRange(5, 30);
      container.addChild(crG);
    }

    // Cave darkness overlay
    var darkTop = new PIXI.Graphics(); darkTop.rect(0, 0, W, 100); darkTop.fill({ color: 0x000000, alpha: 0.4 });
    var darkBot = new PIXI.Graphics(); darkBot.rect(0, H - 60, W, 60); darkBot.fill({ color: 0x000000, alpha: 0.3 });
    container.addChild(darkTop); container.addChild(darkBot);
  }

  // ===================================================================
  // BLUEPRINT: vertical-tower — tall walled tower, platforms spiral up
  // ===================================================================
  private _buildVerticalTower(ctx: any): void {
    var PIXI = ctx.PIXI, rng = ctx.rng, rngRange = ctx.rngRange, rngInt = ctx.rngInt;
    var pal = ctx.pal, hexCss = ctx.hexCss;
    var container = ctx.container, bodies = ctx.bodies, platforms = ctx.platforms;
    var W = ctx.W, H = ctx.H, GY = ctx.GY, cfg = ctx.cfg;

    // Sky gradient
    try {
      if (PIXI.FillGradient) {
        var sg = new PIXI.FillGradient({ type: 'linear', colorStops: [
          { offset: 0, color: hexCss(pal.skyTop) }, { offset: 1, color: hexCss(pal.skyBottom) }
        ], x0: 0, y0: 0, x1: 0, y1: H });
        var sr = new PIXI.Graphics(); sr.rect(0, 0, W, H); sr.fill(sg); container.addChild(sr);
      } else { var s2 = new PIXI.Graphics(); s2.rect(0, 0, W, H); s2.fill({ color: pal.skyBottom }); container.addChild(s2); }
    } catch(e) { var sf = new PIXI.Graphics(); sf.rect(0, 0, W, H); sf.fill({ color: pal.skyBottom }); container.addChild(sf); }

    // Walls + ground physics
    var wallW = 40;
    bodies.push({ x: wallW / 2, y: H / 2, w: wallW, h: H, isStatic: true, tag: 'wall-left' });
    bodies.push({ x: W - wallW / 2, y: H / 2, w: wallW, h: H, isStatic: true, tag: 'wall-right' });
    bodies.push({ x: W / 2, y: GY + 4, w: W, h: 8, isStatic: true, tag: 'ground' });

    // Auto-tiled walls + ground
    var _ww = wallW, _gy2 = GY;
    this._renderTerrainTiles(ctx, function(grid, gridW, gridH, ts) {
      var wallCols = Math.ceil(_ww / ts);
      for (var y = 0; y < gridH; y++) {
        for (var x = 0; x < wallCols; x++) grid[y * gridW + x] = 1;
        for (var x2 = gridW - wallCols; x2 < gridW; x2++) grid[y * gridW + x2] = 1;
      }
      var groundRow = Math.floor(_gy2 / ts);
      for (var y2 = groundRow; y2 < gridH; y2++)
        for (var x3 = 0; x3 < gridW; x3++) grid[y2 * gridW + x3] = 1;
    });

    // Platforms spiraling upward (alternating left/right)
    var pCount = cfg.platformCount || 15;
    var vertSpacing = (GY - 100) / pCount;
    var side = 0;
    for (var pi = 0; pi < pCount; pi++) {
      var py = GY - 80 - pi * vertSpacing + rngRange(-10, 10);
      var pw = rngInt(100, 180);
      var px: number;
      if (side === 0) { px = wallW + 40 + rngRange(0, W * 0.3); side = 1; }
      else { px = W - wallW - 40 - rngRange(0, W * 0.3); side = 0; }
      var pG = new PIXI.Graphics(); pG.roundRect(-pw / 2, -8, pw, 16, 3); pG.fill({ color: pal.platform });
      pG.rect(-pw / 2, -8, pw, 3); pG.fill({ color: pal.platformTop }); pG.x = px; pG.y = py;
      container.addChild(pG);
      var pBody = { x: px, y: py, w: pw, h: 16, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(pBody); platforms.push({ x: px, y: py, w: pw, body: pBody });
    }

    // Wall texture details (brick lines)
    var brickG = new PIXI.Graphics();
    for (var by = 0; by < H; by += 32) {
      brickG.rect(0, by, wallW, 1); brickG.fill({ color: 0x000000, alpha: 0.15 });
      brickG.rect(W - wallW, by, wallW, 1); brickG.fill({ color: 0x000000, alpha: 0.15 });
    }
    container.addChild(brickG);
  }

  // ===================================================================
  // BLUEPRINT: floating-islands — no ground, islands in open sky
  // ===================================================================
  private _buildFloatingIslands(ctx: any): void {
    var PIXI = ctx.PIXI, rng = ctx.rng, rngRange = ctx.rngRange, rngInt = ctx.rngInt;
    var pal = ctx.pal, hexCss = ctx.hexCss, _getSprite = ctx._getSprite;
    var container = ctx.container, bodies = ctx.bodies, platforms = ctx.platforms;
    var clouds = ctx.clouds; var W = ctx.W, H = ctx.H, cfg = ctx.cfg;

    // Deep sky gradient
    try {
      if (PIXI.FillGradient) {
        var sg = new PIXI.FillGradient({ type: 'linear', colorStops: [
          { offset: 0, color: hexCss(0x0a0a2e) }, { offset: 0.6, color: hexCss(pal.skyBottom) }, { offset: 1, color: hexCss(0xddeeff) }
        ], x0: 0, y0: 0, x1: 0, y1: H });
        var sr = new PIXI.Graphics(); sr.rect(0, 0, W, H); sr.fill(sg); container.addChild(sr);
      } else { var s2 = new PIXI.Graphics(); s2.rect(0, 0, W, H); s2.fill({ color: pal.skyBottom }); container.addChild(s2); }
    } catch(e) { var sf = new PIXI.Graphics(); sf.rect(0, 0, W, H); sf.fill({ color: pal.skyBottom }); container.addChild(sf); }

    // Cloud layer below (bottom 30%)
    var cloudBaseY = H * 0.7;
    for (var ci = 0; ci < 12; ci++) {
      var cG = new PIXI.Graphics(); var cw = rngRange(150, 400), ch = rngRange(30, 60);
      cG.ellipse(0, 0, cw / 2, ch / 2); cG.fill({ color: 0xffffff, alpha: rngRange(0.15, 0.4) });
      cG.x = rngRange(-100, W + 100); cG.y = cloudBaseY + rngRange(-40, 80);
      container.addChild(cG); clouds.push({ gfx: cG, speed: rngRange(3, 10) });
    }

    // NO ground body — floating islands

    // Island masses (large platforms with decoration)
    var islandCount = rngInt(4, 6);
    var islandSpacing = W / islandCount;
    for (var ii = 0; ii < islandCount; ii++) {
      var ix = islandSpacing * (ii + 0.5) + rngRange(-80, 80);
      var iy = rngRange(H * 0.2, H * 0.55);
      var iw = rngInt(180, 350);
      var iG = new PIXI.Graphics();
      // Top surface
      iG.roundRect(-iw / 2, -12, iw, 24, 6); iG.fill({ color: pal.groundTop || 0x4a8a3a });
      // Bottom mass
      iG.moveTo(-iw / 2 + 10, 12); iG.lineTo(0, 12 + rngRange(30, 70)); iG.lineTo(iw / 2 - 10, 12);
      iG.fill({ color: pal.ground || 0x5a4a2a }); iG.x = ix; iG.y = iy; container.addChild(iG);
      var iBody = { x: ix, y: iy, w: iw, h: 24, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(iBody); platforms.push({ x: ix, y: iy, w: iw, body: iBody });

      // Tree on island
      var treeSpr = _getSprite('trees', rng() > 0.5 ? 'round_tree' : 'pine_tree');
      if (treeSpr) {
        treeSpr.anchor.set(0.5, 1); treeSpr.x = ix + rngRange(-iw * 0.3, iw * 0.3);
        treeSpr.y = iy - 12; treeSpr.scale.set(rngRange(1.2, 2.0)); container.addChild(treeSpr);
      }
    }

    // Stepping-stone platforms between islands
    for (var si = 0; si < rngInt(4, 8); si++) {
      var sx = rngRange(100, W - 100), sy = rngRange(H * 0.15, H * 0.6), sw = rngInt(60, 100);
      var sG = new PIXI.Graphics(); sG.roundRect(-sw / 2, -6, sw, 12, 3); sG.fill({ color: pal.platform });
      sG.x = sx; sG.y = sy; container.addChild(sG);
      var sBody = { x: sx, y: sy, w: sw, h: 12, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(sBody); platforms.push({ x: sx, y: sy, w: sw, body: sBody });
    }

    // Death pit at very bottom
    bodies.push({ x: W / 2, y: H + 20, w: W, h: 40, isStatic: true, tag: 'death' });
  }

  // ===================================================================
  // BLUEPRINT: arena — single-screen walled room
  // ===================================================================
  private _buildArena(ctx: any): void {
    var PIXI = ctx.PIXI, rng = ctx.rng, rngRange = ctx.rngRange, rngInt = ctx.rngInt;
    var pal = ctx.pal, container = ctx.container, bodies = ctx.bodies, platforms = ctx.platforms;
    var W = ctx.W, H = ctx.H, GY = ctx.GY;

    // Solid background
    var bg = new PIXI.Graphics(); bg.rect(0, 0, W, H); bg.fill({ color: pal.skyBottom }); container.addChild(bg);

    var wallW = 30;
    // Physics bodies
    bodies.push({ x: W / 2, y: GY + 4, w: W, h: 8, isStatic: true, tag: 'ground' });
    bodies.push({ x: W / 2, y: wallW / 2, w: W, h: wallW, isStatic: true, tag: 'ceiling' });
    bodies.push({ x: wallW / 2, y: H / 2, w: wallW, h: H, isStatic: true, tag: 'wall-left' });
    bodies.push({ x: W - wallW / 2, y: H / 2, w: wallW, h: H, isStatic: true, tag: 'wall-right' });

    // Auto-tiled arena box
    var _ww2 = wallW, _gy3 = GY;
    this._renderTerrainTiles(ctx, function(grid, gridW, gridH, ts) {
      var wc = Math.ceil(_ww2 / ts), gr = Math.floor(_gy3 / ts), cr = Math.ceil(_ww2 / ts);
      // Floor
      for (var y = gr; y < gridH; y++) for (var x = 0; x < gridW; x++) grid[y * gridW + x] = 1;
      // Ceiling
      for (var y2 = 0; y2 < cr; y2++) for (var x2 = 0; x2 < gridW; x2++) grid[y2 * gridW + x2] = 1;
      // Walls
      for (var y3 = 0; y3 < gridH; y3++) {
        for (var x3 = 0; x3 < wc; x3++) grid[y3 * gridW + x3] = 1;
        for (var x4 = gridW - wc; x4 < gridW; x4++) grid[y3 * gridW + x4] = 1;
      }
    });

    // 1-2 center platforms
    var centerCount = rngInt(1, 2);
    for (var pi = 0; pi < centerCount; pi++) {
      var pw = rngInt(120, 200), px = W / 2 + (pi === 0 ? -80 : 80), py = GY - rngRange(120, 200);
      var pG = new PIXI.Graphics(); pG.roundRect(-pw / 2, -8, pw, 16, 3); pG.fill({ color: pal.platform });
      pG.x = px; pG.y = py; container.addChild(pG);
      var pBody = { x: px, y: py, w: pw, h: 16, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(pBody); platforms.push({ x: px, y: py, w: pw, body: pBody });
    }
  }

  // ===================================================================
  // BLUEPRINT: dungeon-rooms — connected rooms with corridors
  // ===================================================================
  private _buildDungeonRooms(ctx: any): void {
    var PIXI = ctx.PIXI, rng = ctx.rng, rngRange = ctx.rngRange, rngInt = ctx.rngInt;
    var pal = ctx.pal, container = ctx.container, bodies = ctx.bodies, platforms = ctx.platforms;
    var W = ctx.W, H = ctx.H, GY = ctx.GY, cfg = ctx.cfg;

    // Dark background
    var bg = new PIXI.Graphics(); bg.rect(0, 0, W, H); bg.fill({ color: 0x0d0d15 }); container.addChild(bg);

    // Generate 4-6 rooms
    var roomCount = rngInt(4, 6);
    var rooms: { x: number; y: number; w: number; h: number }[] = [];
    var roomW = W / (roomCount + 1);
    for (var ri = 0; ri < roomCount; ri++) {
      var rw = rngRange(roomW * 0.6, roomW * 0.9), rh = rngRange(200, 350);
      var rx = roomW * (ri + 0.5) + rngRange(-30, 30) - rw / 2;
      var ry = rngRange(H * 0.15, H - rh - 80);
      rooms.push({ x: rx, y: ry, w: rw, h: rh });

      // Room background
      var roomBg = new PIXI.Graphics(); roomBg.rect(rx, ry, rw, rh); roomBg.fill({ color: 0x1a1a25 }); container.addChild(roomBg);

      // Room floor + ceiling physics
      var wt = 12;
      bodies.push({ x: rx + rw / 2, y: ry + rh - wt / 2, w: rw, h: wt, isStatic: true, tag: 'ground' });
      bodies.push({ x: rx + rw / 2, y: ry + wt / 2, w: rw, h: wt, isStatic: true, tag: 'ceiling' });

      // Platforms inside room
      var rpCount = rngInt(1, 3);
      for (var pi = 0; pi < rpCount; pi++) {
        var pw = rngInt(60, 120), px = rx + rngRange(30, rw - 30), py = ry + rngRange(rh * 0.3, rh * 0.7);
        var pG = new PIXI.Graphics(); pG.roundRect(-pw / 2, -6, pw, 12, 2); pG.fill({ color: pal.platform }); pG.x = px; pG.y = py;
        container.addChild(pG);
        var pBody = { x: px, y: py, w: pw, h: 12, isStatic: true, oneWay: true, tag: 'platform' };
        bodies.push(pBody); platforms.push({ x: px, y: py, w: pw, body: pBody });
      }
    }

    // Corridors connecting adjacent rooms
    for (var ci = 0; ci < rooms.length - 1; ci++) {
      var r1 = rooms[ci], r2 = rooms[ci + 1];
      var corY = Math.max(r1.y + r1.h * 0.4, r2.y + r2.h * 0.4);
      var corX1 = r1.x + r1.w, corX2 = r2.x, corH = 50;
      var corBg = new PIXI.Graphics(); corBg.rect(corX1, corY - corH / 2, corX2 - corX1, corH);
      corBg.fill({ color: 0x151520 }); container.addChild(corBg);
      bodies.push({ x: (corX1 + corX2) / 2, y: corY + corH / 2 - 4, w: Math.abs(corX2 - corX1), h: 8, isStatic: true, tag: 'ground' });
    }

    // Auto-tiled dungeon terrain (room walls + floors + corridors)
    var _rooms = rooms, _wt = wt;
    this._renderTerrainTiles(ctx, function(grid, gridW, gridH, ts) {
      for (var ri2 = 0; ri2 < _rooms.length; ri2++) {
        var rm = _rooms[ri2];
        var rx1 = Math.floor(rm.x / ts), ry1 = Math.floor(rm.y / ts);
        var rx2 = Math.ceil((rm.x + rm.w) / ts), ry2 = Math.ceil((rm.y + rm.h) / ts);
        // Floor + ceiling tiles
        for (var x = rx1; x < rx2; x++) {
          for (var y = ry1; y < ry1 + Math.ceil(_wt / ts); y++) if (y >= 0 && y < gridH && x >= 0 && x < gridW) grid[y * gridW + x] = 1;
          for (var y2 = ry2 - Math.ceil(_wt / ts); y2 < ry2; y2++) if (y2 >= 0 && y2 < gridH && x >= 0 && x < gridW) grid[y2 * gridW + x] = 1;
        }
      }
    });

    // Torches (glow dots)
    for (var ti = 0; ti < rooms.length * 2; ti++) {
      var tr = rooms[rngInt(0, rooms.length - 1)];
      var tG = new PIXI.Graphics(); tG.circle(0, 0, 4); tG.fill({ color: 0xff9933, alpha: 0.7 });
      tG.x = tr.x + rngRange(15, tr.w - 15); tG.y = tr.y + 20; container.addChild(tG);
    }
  }

  // ===================================================================
  // BLUEPRINT: city-rooftops — building tops at varying heights
  // ===================================================================
  private _buildCityRooftops(ctx: any): void {
    var PIXI = ctx.PIXI, rng = ctx.rng, rngRange = ctx.rngRange, rngInt = ctx.rngInt;
    var pal = ctx.pal, container = ctx.container, bodies = ctx.bodies, platforms = ctx.platforms;
    var parallaxLayers = ctx.parallaxLayers; var W = ctx.W, H = ctx.H, GY = ctx.GY;

    // Night sky
    try {
      if (PIXI.FillGradient) {
        var sg = new PIXI.FillGradient({ type: 'linear', colorStops: [
          { offset: 0, color: '#05051a' }, { offset: 1, color: '#1a1a3a' }
        ], x0: 0, y0: 0, x1: 0, y1: H });
        var sr = new PIXI.Graphics(); sr.rect(0, 0, W, H); sr.fill(sg); container.addChild(sr);
      } else { var s2 = new PIXI.Graphics(); s2.rect(0, 0, W, H); s2.fill({ color: 0x1a1a3a }); container.addChild(s2); }
    } catch(e) { var sf = new PIXI.Graphics(); sf.rect(0, 0, W, H); sf.fill({ color: 0x1a1a3a }); container.addChild(sf); }

    // Stars
    var stG = new PIXI.Graphics();
    for (var si = 0; si < 80; si++) {
      stG.circle(rngRange(0, W), rngRange(0, H * 0.4), rngRange(0.5, 1.5));
      stG.fill({ color: 0xffffff, alpha: rngRange(0.3, 0.8) });
    }
    container.addChild(stG);

    // Distant building silhouettes (parallax)
    for (var layer = 0; layer < 2; layer++) {
      var silG = new PIXI.Graphics(); var bx = 0;
      while (bx < W + 100) {
        var bw = rngRange(60, 140), bh = rngRange(100, 250 - layer * 60);
        silG.rect(bx, GY - bh - layer * 30, bw, bh + 200);
        silG.fill({ color: layer === 0 ? 0x111122 : 0x0a0a18, alpha: 0.6 }); bx += bw + rngRange(5, 30);
      }
      container.addChild(silG); parallaxLayers.push({ gfx: silG, factor: 0.05 + layer * 0.08 });
    }

    // Building tops (the "ground" segments) — calculate positions
    var buildingCount = rngInt(6, 10);
    var buildSpacing = W / buildingCount;
    var _buildings: { x: number; y: number; w: number }[] = [];
    for (var bi = 0; bi < buildingCount; bi++) {
      var bx2 = bi * buildSpacing, bw2 = buildSpacing - rngRange(20, 40);
      var bTopY = GY - rngRange(0, 180);
      _buildings.push({ x: bx2, y: bTopY, w: bw2 });
      var bBody = { x: bx2 + bw2 / 2, y: bTopY + 3, w: bw2, h: 6, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(bBody); platforms.push({ x: bx2 + bw2 / 2, y: bTopY + 3, w: bw2, body: bBody });

      // Windows
      for (var wi = 0; wi < rngInt(3, 10); wi++) {
        var wG2 = new PIXI.Graphics(); wG2.rect(0, 0, 6, 8);
        wG2.fill({ color: rng() > 0.3 ? 0xffdd66 : 0x334455, alpha: 0.7 });
        wG2.x = bx2 + rngRange(8, bw2 - 8); wG2.y = bTopY + rngRange(20, Math.min(H - bTopY - 20, 200));
        container.addChild(wG2);
      }
    }

    // Auto-tiled buildings
    var _blds = _buildings;
    this._renderTerrainTiles(ctx, function(grid, gridW, gridH, ts) {
      for (var bi2 = 0; bi2 < _blds.length; bi2++) {
        var b = _blds[bi2];
        var bx1 = Math.max(0, Math.floor(b.x / ts));
        var bx2t = Math.min(gridW, Math.ceil((b.x + b.w) / ts));
        var by1 = Math.floor(b.y / ts);
        for (var y = by1; y < gridH; y++)
          for (var x = bx1; x < bx2t; x++) grid[y * gridW + x] = 1;
      }
    });

    // Death pit at very bottom
    bodies.push({ x: W / 2, y: H + 20, w: W, h: 40, isStatic: true, tag: 'death' });
  }

  // ===================================================================
  // BLUEPRINT: forest-canopy — ground + mid branch + canopy tiers
  // ===================================================================
  private _buildForestCanopy(ctx: any): void {
    var PIXI = ctx.PIXI, rng = ctx.rng, rngRange = ctx.rngRange, rngInt = ctx.rngInt;
    var pal = ctx.pal, hexCss = ctx.hexCss;
    var container = ctx.container, bodies = ctx.bodies, platforms = ctx.platforms;
    var W = ctx.W, H = ctx.H, GY = ctx.GY;

    // Green-tinted sky
    try {
      if (PIXI.FillGradient) {
        var sg = new PIXI.FillGradient({ type: 'linear', colorStops: [
          { offset: 0, color: hexCss(0x1a3a1a) }, { offset: 1, color: hexCss(0x2a5a2a) }
        ], x0: 0, y0: 0, x1: 0, y1: H });
        var sr = new PIXI.Graphics(); sr.rect(0, 0, W, H); sr.fill(sg); container.addChild(sr);
      } else { var s2 = new PIXI.Graphics(); s2.rect(0, 0, W, H); s2.fill({ color: 0x2a5a2a }); container.addChild(s2); }
    } catch(e) { var sf = new PIXI.Graphics(); sf.rect(0, 0, W, H); sf.fill({ color: 0x2a5a2a }); container.addChild(sf); }

    // Ground physics + auto-tiles
    bodies.push({ x: W / 2, y: GY + 4, w: W, h: 8, isStatic: true, tag: 'ground' });
    var _gy4 = GY;
    this._renderTerrainTiles(ctx, function(grid, gridW, gridH, ts) {
      var gr = Math.floor(_gy4 / ts);
      for (var y = gr; y < gridH; y++) for (var x = 0; x < gridW; x++) grid[y * gridW + x] = 1;
    });

    // Tree trunks (vertical brown bars)
    var trunkCount = rngInt(8, 14), trunkSpacing = W / trunkCount;
    for (var ti = 0; ti < trunkCount; ti++) {
      var tx = ti * trunkSpacing + rngRange(10, trunkSpacing - 10), tw = rngRange(16, 30);
      var trG = new PIXI.Graphics(); trG.rect(tx - tw / 2, 0, tw, GY); trG.fill({ color: 0x4a3020, alpha: 0.7 }); container.addChild(trG);
    }

    // Mid-level branch platforms (50% height)
    var midY = GY * 0.5;
    for (var mi = 0; mi < rngInt(5, 10); mi++) {
      var mx = rngRange(100, W - 100), my = midY + rngRange(-60, 60), mw = rngInt(80, 160);
      var mG = new PIXI.Graphics(); mG.roundRect(-mw / 2, -6, mw, 12, 3); mG.fill({ color: 0x5a4020 }); mG.x = mx; mG.y = my;
      container.addChild(mG);
      var mBody = { x: mx, y: my, w: mw, h: 12, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(mBody); platforms.push({ x: mx, y: my, w: mw, body: mBody });
    }

    // Canopy level (20% height)
    var canY = GY * 0.2;
    for (var ci = 0; ci < rngInt(4, 8); ci++) {
      var cx2 = rngRange(80, W - 80), cy2 = canY + rngRange(-40, 40), cw2 = rngInt(100, 200);
      var cG = new PIXI.Graphics(); cG.roundRect(-cw2 / 2, -8, cw2, 16, 4); cG.fill({ color: 0x339933 }); cG.x = cx2; cG.y = cy2;
      container.addChild(cG);
      var cBody = { x: cx2, y: cy2, w: cw2, h: 16, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(cBody); platforms.push({ x: cx2, y: cy2, w: cw2, body: cBody });
    }

    // Lower platforms near ground
    for (var li = 0; li < rngInt(4, 7); li++) {
      var lx = rngRange(100, W - 100), ly = GY - rngRange(60, 140), lw = rngInt(80, 150);
      var lG = new PIXI.Graphics(); lG.roundRect(-lw / 2, -6, lw, 12, 3); lG.fill({ color: pal.platform }); lG.x = lx; lG.y = ly;
      container.addChild(lG);
      var lBody = { x: lx, y: ly, w: lw, h: 12, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(lBody); platforms.push({ x: lx, y: ly, w: lw, body: lBody });
    }

    // Canopy overlay (foreground tint)
    var canOverlay = new PIXI.Graphics(); canOverlay.rect(0, 0, W, GY * 0.15); canOverlay.fill({ color: 0x1a5a1a, alpha: 0.15 });
    container.addChild(canOverlay);

    // Vines
    for (var vi = 0; vi < rngInt(5, 12); vi++) {
      var vx = rngRange(50, W - 50), vh = rngRange(80, 200), vy = rngRange(0, GY * 0.4);
      var vG = new PIXI.Graphics(); vG.rect(vx - 1, vy, 3, vh); vG.fill({ color: 0x227722, alpha: 0.5 }); container.addChild(vG);
    }
  }

  // ===================================================================
  // BLUEPRINT: underwater — deep blue, coral, no gravity feel
  // ===================================================================
  private _buildUnderwater(ctx: any): void {
    var PIXI = ctx.PIXI, rng = ctx.rng, rngRange = ctx.rngRange, rngInt = ctx.rngInt;
    var pal = ctx.pal, container = ctx.container, bodies = ctx.bodies, platforms = ctx.platforms;
    var W = ctx.W, H = ctx.H, GY = ctx.GY, cfg = ctx.cfg;

    // Deep blue gradient
    try {
      if (PIXI.FillGradient) {
        var sg = new PIXI.FillGradient({ type: 'linear', colorStops: [
          { offset: 0, color: '#1188aa' }, { offset: 0.5, color: '#0055aa' }, { offset: 1, color: '#001133' }
        ], x0: 0, y0: 0, x1: 0, y1: H });
        var sr = new PIXI.Graphics(); sr.rect(0, 0, W, H); sr.fill(sg); container.addChild(sr);
      } else { var s2 = new PIXI.Graphics(); s2.rect(0, 0, W, H); s2.fill({ color: 0x003377 }); container.addChild(s2); }
    } catch(e) { var sf = new PIXI.Graphics(); sf.rect(0, 0, W, H); sf.fill({ color: 0x003377 }); container.addChild(sf); }

    // Sandy bottom (irregular auto-tiled)
    bodies.push({ x: W / 2, y: GY + 4, w: W, h: 8, isStatic: true, tag: 'ground' });
    var _sandHeights: number[] = [];
    for (var fx = 0; fx <= W; fx += 32) {
      _sandHeights.push(GY + Math.sin(fx * 0.006) * 15 + rng() * 10);
    }
    var _sh = _sandHeights;
    this._renderTerrainTiles(ctx, function(grid, gridW, gridH, ts) {
      for (var gx = 0; gx < gridW; gx++) {
        var floorRow = Math.floor((_sh[Math.min(gx, _sh.length - 1)] || GY) / ts);
        for (var y = floorRow; y < gridH; y++) grid[y * gridW + gx] = 1;
      }
    });

    // Coral formations as platforms
    var coralColors = [0xff6666, 0xff9933, 0xcc66cc, 0x66cccc, 0xffcc33];
    var coralCount = cfg.platformCount || 10;
    for (var ci = 0; ci < coralCount; ci++) {
      var cx = rngRange(150, W - 150), cy = rngRange(H * 0.25, GY - 40), cw2 = rngInt(70, 150);
      var cc = coralColors[rngInt(0, coralColors.length - 1)];
      var cG = new PIXI.Graphics(); cG.roundRect(-cw2 / 2, -8, cw2, 16, 6); cG.fill({ color: cc }); cG.x = cx; cG.y = cy;
      container.addChild(cG);
      var cBody = { x: cx, y: cy, w: cw2, h: 16, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(cBody); platforms.push({ x: cx, y: cy, w: cw2, body: cBody });
    }

    // Seaweed / kelp
    for (var ki = 0; ki < rngInt(8, 16); ki++) {
      var kx = rngRange(50, W - 50), kh = rngRange(60, 180);
      var kG = new PIXI.Graphics(); kG.moveTo(kx, GY);
      for (var ky = GY; ky > GY - kh; ky -= 10) { kG.lineTo(kx + Math.sin((GY - ky) * 0.05) * 12, ky); }
      kG.stroke({ color: 0x22aa44, alpha: 0.6, width: 3 }); container.addChild(kG);
    }

    // Bubbles
    for (var bi = 0; bi < rngInt(15, 30); bi++) {
      var bG = new PIXI.Graphics(); bG.circle(0, 0, rngRange(2, 6)); bG.fill({ color: 0xaaddff, alpha: rngRange(0.2, 0.5) });
      bG.x = rngRange(0, W); bG.y = rngRange(50, GY - 20); container.addChild(bG);
    }

    // Water tint overlay
    var tintG = new PIXI.Graphics(); tintG.rect(0, 0, W, H); tintG.fill({ color: 0x0033aa, alpha: 0.08 }); container.addChild(tintG);
  }

  // ===================================================================
  // BLUEPRINT: endless-runner — segmented ground with gaps + platforms
  // ===================================================================
  private _buildEndlessRunner(ctx: any): void {
    var PIXI = ctx.PIXI, rng = ctx.rng, rngRange = ctx.rngRange, rngInt = ctx.rngInt;
    var pal = ctx.pal, hexCss = ctx.hexCss;
    var container = ctx.container, bodies = ctx.bodies, platforms = ctx.platforms;
    var parallaxLayers = ctx.parallaxLayers; var W = ctx.W, H = ctx.H, GY = ctx.GY, cfg = ctx.cfg;

    // Sky gradient
    try {
      if (PIXI.FillGradient) {
        var sg = new PIXI.FillGradient({ type: 'linear', colorStops: [
          { offset: 0, color: hexCss(pal.skyTop) }, { offset: 1, color: hexCss(pal.skyBottom) }
        ], x0: 0, y0: 0, x1: 0, y1: H });
        var sr = new PIXI.Graphics(); sr.rect(0, 0, W, H); sr.fill(sg); container.addChild(sr);
      } else { var s2 = new PIXI.Graphics(); s2.rect(0, 0, W, H); s2.fill({ color: pal.skyBottom }); container.addChild(s2); }
    } catch(e) { var sf = new PIXI.Graphics(); sf.rect(0, 0, W, H); sf.fill({ color: pal.skyBottom }); container.addChild(sf); }

    // 2-layer parallax hills
    for (var mi = 0; mi < 2; mi++) {
      var mColor = pal.mountains[mi] || pal.mountains[0];
      var mBaseY = GY - 10 - mi * 50;
      var mG = new PIXI.Graphics(); var hillW = 250 + mi * 100; var x = 0;
      mG.moveTo(0, mBaseY);
      while (x < W + hillW) {
        var rise = rngRange(30 + mi * 15, 70 + mi * 25);
        mG.bezierCurveTo(x + hillW * 0.25, mBaseY - rise, x + hillW * 0.75, mBaseY - rise * 0.6, x + hillW, mBaseY + rngRange(-5, 5));
        x += hillW; hillW = 200 + mi * 80 + rngRange(-40, 40);
      }
      mG.lineTo(W + 50, H + 20); mG.lineTo(-50, H + 20); mG.closePath();
      mG.fill({ color: mColor, alpha: 0.35 + mi * 0.15 }); container.addChild(mG);
      parallaxLayers.push({ gfx: mG, factor: 0.08 + mi * 0.12 });
    }

    // Ground segments with gaps — calculate positions
    var segCount = rngInt(6, 10), segSpacing = W / segCount;
    var _segs: { x: number; w: number }[] = [];
    for (var si = 0; si < segCount; si++) {
      if (si > 0 && rng() > 0.4) continue;
      var sx = si * segSpacing, sw = segSpacing - rngRange(10, 40);
      _segs.push({ x: sx, w: sw });
      bodies.push({ x: sx + sw / 2, y: GY + 4, w: sw, h: 8, isStatic: true, tag: 'ground' });
      platforms.push({ x: sx + sw / 2, y: GY + 4, w: sw, body: bodies[bodies.length - 1] });
    }

    // Auto-tiled ground segments
    var _segsRef = _segs, _gy5 = GY;
    this._renderTerrainTiles(ctx, function(grid, gridW, gridH, ts) {
      var gr = Math.floor(_gy5 / ts);
      for (var i = 0; i < _segsRef.length; i++) {
        var s = _segsRef[i];
        var sx1 = Math.max(0, Math.floor(s.x / ts));
        var sx2 = Math.min(gridW, Math.ceil((s.x + s.w) / ts));
        for (var y = gr; y < gridH; y++)
          for (var x = sx1; x < sx2; x++) grid[y * gridW + x] = 1;
      }
    });

    // Overhead platforms
    for (var pi = 0; pi < rngInt(4, 8); pi++) {
      var px = rngRange(200, W - 100), py = GY - rngRange(100, 250), pw = rngInt(80, 140);
      var pG = new PIXI.Graphics(); pG.roundRect(-pw / 2, -8, pw, 16, 3); pG.fill({ color: pal.platform }); pG.x = px; pG.y = py;
      container.addChild(pG);
      var pBody = { x: px, y: py, w: pw, h: 16, isStatic: true, oneWay: true, tag: 'platform' };
      bodies.push(pBody); platforms.push({ x: px, y: py, w: pw, body: pBody });
    }

    // Death pit
    bodies.push({ x: W / 2, y: H + 20, w: W, h: 40, isStatic: true, tag: 'death' });
  }
}

// ---------------------------------------------------------------------------
// LayerSystem — Plan 3: Proper Layer System (GameMaker-style)
// ---------------------------------------------------------------------------

type LayerType = 'background' | 'instance' | 'tile' | 'asset' | 'effect';

interface LayerConfig {
  name: string;
  type: LayerType;
  depth?: number;        // Lower depth = renders behind (default: auto-assigned)
  visible?: boolean;
  locked?: boolean;
  // Background layer options
  parallaxX?: number;    // 0 = fixed, 1 = moves with camera (default 1)
  parallaxY?: number;
  tileX?: boolean;       // Repeat horizontally
  tileY?: boolean;       // Repeat vertically
  scrollSpeedX?: number; // Auto-scroll speed (px/s)
  scrollSpeedY?: number;
  color?: number;        // Background fill color
  sprite?: any;          // Background image texture
}

interface LayerEntry {
  name: string;
  type: LayerType;
  depth: number;
  container: any;        // PIXI.Container
  visible: boolean;
  locked: boolean;
  config: LayerConfig;
  // Background-specific
  _bgSprite?: any;       // Tiling sprite for background
  _scrollOffset: { x: number; y: number };
}

class LayerSystem {
  private engine: Engine2D;
  private layers: Map<string, LayerEntry> = new Map();
  private _nextDepth = 0;
  private _sorted = false;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /**
   * Add a new layer to the world.
   * Returns the PIXI.Container for the layer (add children to it).
   */
  add(name: string, config: Partial<LayerConfig> = {}): any {
    var PIXI = (window as any).PIXI;
    if (this.layers.has(name)) {
      console.warn('[Layers] Layer already exists:', name);
      return this.layers.get(name)!.container;
    }

    var type: LayerType = config.type || 'instance';
    var depth = config.depth ?? this._autoDepth(type);
    var container = new PIXI.Container();
    container.label = 'layer:' + name;
    container.sortableChildren = (type === 'instance'); // Instance layers auto-sort by depth

    var entry: LayerEntry = {
      name: name,
      type: type,
      depth: depth,
      container: container,
      visible: config.visible !== false,
      locked: config.locked || false,
      config: config as LayerConfig,
      _scrollOffset: { x: 0, y: 0 },
    };

    // Background layer: create tiling sprite if sprite texture provided
    if (type === 'background' && config.sprite) {
      try {
        var ts = new PIXI.TilingSprite({
          texture: config.sprite,
          width: this.engine.config.worldWidth || this.engine.config.width * 3,
          height: this.engine.config.worldHeight || this.engine.config.height * 2,
        });
        container.addChild(ts);
        entry._bgSprite = ts;
      } catch(e) {
        console.warn('[Layers] Failed to create tiling sprite for', name, e);
      }
    }

    // Background layer: fill color
    if (type === 'background' && config.color !== undefined) {
      var bg = new PIXI.Graphics();
      bg.rect(0, 0,
        this.engine.config.worldWidth || this.engine.config.width * 3,
        this.engine.config.worldHeight || this.engine.config.height * 2);
      bg.fill({ color: config.color });
      container.addChildAt(bg, 0);
    }

    this.layers.set(name, entry);
    this.engine.world.addChild(container);
    this._sorted = false;
    this._sortLayers();

    console.log('[Layers] Added:', name, '(' + type + ', depth=' + depth + ')');
    return container;
  }

  /** Get a layer's container by name */
  get(name: string): any {
    var entry = this.layers.get(name);
    return entry ? entry.container : null;
  }

  /** Get the full layer entry (for advanced use) */
  getEntry(name: string): LayerEntry | undefined {
    return this.layers.get(name);
  }

  /** Remove a layer and all its children */
  remove(name: string): void {
    var entry = this.layers.get(name);
    if (!entry) return;
    try { this.engine.world.removeChild(entry.container); } catch(e) {}
    entry.container.destroy({ children: true });
    this.layers.delete(name);
  }

  /** Show/hide a layer */
  setVisible(name: string, visible: boolean): void {
    var entry = this.layers.get(name);
    if (entry) { entry.visible = visible; entry.container.visible = visible; }
  }

  /** Lock/unlock a layer (prevents adding children when locked) */
  setLocked(name: string, locked: boolean): void {
    var entry = this.layers.get(name);
    if (entry) entry.locked = locked;
  }

  /** Change a layer's depth (re-sorts all layers) */
  setDepth(name: string, depth: number): void {
    var entry = this.layers.get(name);
    if (!entry) return;
    entry.depth = depth;
    entry.container.zIndex = -depth; // Lower depth = behind = higher zIndex magnitude
    this._sorted = false;
    this._sortLayers();
  }

  /** List all layers sorted by depth */
  list(): { name: string; type: LayerType; depth: number; visible: boolean; childCount: number }[] {
    var result: any[] = [];
    this.layers.forEach(function(entry) {
      result.push({
        name: entry.name,
        type: entry.type,
        depth: entry.depth,
        visible: entry.visible,
        childCount: entry.container.children.length,
      });
    });
    result.sort(function(a: any, b: any) { return a.depth - b.depth; });
    return result;
  }

  /** Update all layers (called from game loop) — handles parallax, scroll, instance depth sort */
  update(dt: number): void {
    var cam = this.engine.camera;
    this.layers.forEach(function(entry) {
      if (!entry.visible) return;

      if (entry.type === 'background') {
        // Parallax
        var px = entry.config.parallaxX ?? 0;
        var py = entry.config.parallaxY ?? 0;
        if (px !== 1 || py !== 1) {
          entry.container.x = cam.x * (1 - px);
          entry.container.y = cam.y * (1 - py);
        }

        // Auto-scroll
        if (entry.config.scrollSpeedX || entry.config.scrollSpeedY) {
          entry._scrollOffset.x += (entry.config.scrollSpeedX || 0) * dt;
          entry._scrollOffset.y += (entry.config.scrollSpeedY || 0) * dt;
          if (entry._bgSprite) {
            entry._bgSprite.tilePosition.x = entry._scrollOffset.x;
            entry._bgSprite.tilePosition.y = entry._scrollOffset.y;
          }
        }
      }

      // Instance layer: depth sort children by y (bbox_bottom)
      if (entry.type === 'instance' && entry.container.children.length > 1) {
        var children = entry.container.children;
        for (var i = 0; i < children.length; i++) {
          var c = children[i];
          var h = c.height || 0;
          var anchorY = c.anchor ? c.anchor.y : 0;
          c.zIndex = -(c.y + h * (1 - anchorY));
        }
      }
    });
  }

  /** Remove all layers */
  clear(): void {
    var self = this;
    this.layers.forEach(function(entry) {
      try { self.engine.world.removeChild(entry.container); } catch(e) {}
      entry.container.destroy({ children: true });
    });
    this.layers.clear();
    this._nextDepth = 0;
  }

  /** Auto-assign depth based on layer type (GameMaker convention) */
  private _autoDepth(type: LayerType): number {
    // Background layers go way behind, instance in middle, effect on top
    var base: Record<LayerType, number> = {
      background: -10000,
      tile:       -5000,
      asset:      -1000,
      instance:   0,
      effect:     10000,
    };
    this._nextDepth++;
    return (base[type] || 0) + this._nextDepth;
  }

  /** Sort world children by layer depth */
  private _sortLayers(): void {
    if (this._sorted) return;
    this.layers.forEach(function(entry) {
      entry.container.zIndex = -entry.depth; // Lower depth renders behind (negative zIndex = back)
    });
    this._sorted = true;
  }
}

// ---------------------------------------------------------------------------
// TilemapSystem — Plan 4: Auto-Tiling Engine (47-tile bitmask)
// ---------------------------------------------------------------------------

interface TilemapConfig {
  tileSize?: number;     // Default 32
  width: number;         // Grid width (in tiles)
  height: number;        // Grid height (in tiles)
  tileset?: any;         // PIXI.Texture (spritesheet)
  tilesetCols?: number;  // Columns in tileset image
}

interface AnimatedTileDef {
  frames: number[];      // Array of tile indices to cycle through
  speed: number;         // Frames per second
}

class TilemapSystem {
  private engine: Engine2D;
  private grid: Int16Array;    // -1 = empty, 0+ = tile type
  private tileSize: number;
  private gridW: number;
  private gridH: number;
  private container: any;      // PIXI.Container for tile sprites
  private tileset: any;        // Base tileset texture
  private tilesetCols: number;
  private sprites: Map<number, any> = new Map(); // key = y*W+x → sprite
  private _dirty: Set<number> = new Set();       // Tiles needing redraw
  private _bitmaskCache: Map<number, number> = new Map(); // 8bit→47tile index
  private _animDefs: Map<number, AnimatedTileDef> = new Map(); // tileType → animation def
  private _animTiles: Map<number, { def: AnimatedTileDef; frameIdx: number }> = new Map(); // gridIdx → anim state
  private _animElapsed = 0;

  // 47-tile bitmask lookup: maps 8-bit neighbor mask to tile index (0-46)
  // GameMaker standard: neighbors are N,NE,E,SE,S,SW,W,NW (bits 0-7)
  private static BITMASK_47: Record<number, number> = (() => {
    // Build the full 256→47 map. The 47-tile set uses cardinal+diagonal masking.
    // Cardinal bits: N=1, E=2, S=4, W=8. Diagonals only matter when both adjacent cardinals are set.
    var map: Record<number, number> = {};

    // Reduce 8-bit mask to effective 4+4 bit (strip irrelevant diagonals)
    function reduce(mask: number): number {
      var N  = (mask & 1)   ? 1 : 0;
      var NE = (mask & 2)   ? 1 : 0;
      var E  = (mask & 4)   ? 1 : 0;
      var SE = (mask & 8)   ? 1 : 0;
      var S  = (mask & 16)  ? 1 : 0;
      var SW = (mask & 32)  ? 1 : 0;
      var W  = (mask & 64)  ? 1 : 0;
      var NW = (mask & 128) ? 1 : 0;
      // Diagonals only relevant when both adjacent cardinals are filled
      if (!(N && E)) NE = 0;
      if (!(E && S)) SE = 0;
      if (!(S && W)) SW = 0;
      if (!(W && N)) NW = 0;
      return N | (NE << 1) | (E << 2) | (SE << 3) | (S << 4) | (SW << 5) | (W << 6) | (NW << 7);
    }

    // 47 unique reduced masks → tile indices
    var uniques: number[] = [
      0,    // 0: isolated
      1,    // 1: N only
      4,    // 2: E only
      5,    // 3: N+E
      7,    // 4: N+NE+E
      16,   // 5: S only
      17,   // 6: N+S
      20,   // 7: E+S
      21,   // 8: N+E+S
      23,   // 9: N+NE+E+S
      28,   // 10: E+SE+S
      29,   // 11: N+E+SE+S
      31,   // 12: N+NE+E+SE+S
      64,   // 13: W only
      65,   // 14: N+W
      68,   // 15: E+W
      69,   // 16: N+E+W
      71,   // 17: N+NE+E+W
      80,   // 18: S+W
      81,   // 19: N+S+W
      84,   // 20: E+S+W
      85,   // 21: N+E+S+W (all cardinal, no diag)
      87,   // 22: N+NE+E+S+W
      92,   // 23: E+SE+S+W
      93,   // 24: N+E+SE+S+W
      95,   // 25: N+NE+E+SE+S+W
      193,  // 26: N+W+NW
      197,  // 27: N+E+W+NW
      199,  // 28: N+NE+E+W+NW
      209,  // 29: N+S+W+NW
      213,  // 30: N+E+S+W+NW
      215,  // 31: N+NE+E+S+W+NW
      221,  // 32: N+E+SE+S+W+NW
      223,  // 33: N+NE+E+SE+S+W+NW
      112,  // 34: S+SW+W
      113,  // 35: N+S+SW+W
      116,  // 36: E+S+SW+W
      117,  // 37: N+E+S+SW+W
      119,  // 38: N+NE+E+S+SW+W
      124,  // 39: E+SE+S+SW+W
      125,  // 40: N+E+SE+S+SW+W
      127,  // 41: N+NE+E+SE+S+SW+W
      241,  // 42: N+S+SW+W+NW
      245,  // 43: N+E+S+SW+W+NW
      247,  // 44: N+NE+E+S+SW+W+NW
      253,  // 45: N+E+SE+S+SW+W+NW
      255,  // 46: all neighbors (center piece)
    ];
    // Build reverse map: for each of 256 possible masks, find the matching tile
    var uniqueToIdx: Record<number, number> = {};
    for (var i = 0; i < uniques.length; i++) uniqueToIdx[uniques[i]] = i;

    for (var m = 0; m < 256; m++) {
      var r = reduce(m);
      map[m] = (uniqueToIdx[r] !== undefined) ? uniqueToIdx[r] : 0;
    }
    return map;
  })();

  constructor(engine: Engine2D) {
    this.engine = engine;
    this.tileSize = 32;
    this.gridW = 0;
    this.gridH = 0;
    this.grid = new Int16Array(0);
    this.tilesetCols = 8;
    this.container = null;
  }

  /**
   * Initialize the tilemap grid.
   */
  init(config: TilemapConfig): any {
    var PIXI = (window as any).PIXI;
    this.tileSize = config.tileSize || 32;
    this.gridW = config.width;
    this.gridH = config.height;
    this.grid = new Int16Array(this.gridW * this.gridH).fill(-1);
    this.tileset = config.tileset || null;
    this.tilesetCols = config.tilesetCols || 8;

    if (this.container) {
      try { this.engine.world.removeChild(this.container); } catch(e) {}
      this.container.destroy({ children: true });
    }
    this.container = new PIXI.Container();
    this.container.label = 'tilemap';
    this.engine.world.addChild(this.container);
    this.sprites.clear();
    this._dirty.clear();

    console.log('[Tilemap] Init ' + this.gridW + 'x' + this.gridH + ' (tile=' + this.tileSize + 'px)');
    return this.container;
  }

  /**
   * Set a tile at grid position (gx, gy). tileType: 0+ = filled, -1 = empty.
   * Auto-updates neighboring tiles for bitmask edges.
   */
  setTile(gx: number, gy: number, tileType = 0): void {
    if (gx < 0 || gy < 0 || gx >= this.gridW || gy >= this.gridH) return;
    var idx = gy * this.gridW + gx;
    this.grid[idx] = tileType;

    // Mark this tile + all 8 neighbors as dirty
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var nx = gx + dx;
        var ny = gy + dy;
        if (nx >= 0 && ny >= 0 && nx < this.gridW && ny < this.gridH) {
          this._dirty.add(ny * this.gridW + nx);
        }
      }
    }
  }

  /** Remove a tile at grid position */
  clearTile(gx: number, gy: number): void {
    this.setTile(gx, gy, -1);
  }

  /** Get tile type at grid position (-1 = empty) */
  getTile(gx: number, gy: number): number {
    if (gx < 0 || gy < 0 || gx >= this.gridW || gy >= this.gridH) return -1;
    return this.grid[gy * this.gridW + gx];
  }

  /** Fill a rectangular region with tiles */
  fillRect(gx: number, gy: number, w: number, h: number, tileType = 0): void {
    for (var y = gy; y < gy + h; y++) {
      for (var x = gx; x < gx + w; x++) {
        this.setTile(x, y, tileType);
      }
    }
  }

  /** Fill a line of tiles from (x1,y1) to (x2,y2) — Bresenham */
  fillLine(gx1: number, gy1: number, gx2: number, gy2: number, tileType = 0): void {
    var dx = Math.abs(gx2 - gx1);
    var dy = Math.abs(gy2 - gy1);
    var sx = gx1 < gx2 ? 1 : -1;
    var sy = gy1 < gy2 ? 1 : -1;
    var err = dx - dy;
    while (true) {
      this.setTile(gx1, gy1, tileType);
      if (gx1 === gx2 && gy1 === gy2) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; gx1 += sx; }
      if (e2 < dx) { err += dx; gy1 += sy; }
    }
  }

  /**
   * Flush dirty tiles — recalculate bitmask and update sprites.
   * Call this after batch setTile() calls, or it auto-flushes each frame.
   */
  flush(): void {
    var PIXI = (window as any).PIXI;
    if (this._dirty.size === 0 || !this.container) return;

    var self = this;
    this._dirty.forEach(function(idx) {
      var gx = idx % self.gridW;
      var gy = (idx / self.gridW) | 0;
      var tile = self.grid[idx];

      // Remove existing sprite
      var existing = self.sprites.get(idx);
      if (existing) {
        self.container.removeChild(existing);
        existing.destroy();
        self.sprites.delete(idx);
      }

      if (tile < 0) return; // Empty tile

      // Calculate 8-neighbor bitmask
      var mask = 0;
      if (self._isFilled(gx, gy - 1)) mask |= 1;   // N
      if (self._isFilled(gx + 1, gy - 1)) mask |= 2;  // NE
      if (self._isFilled(gx + 1, gy)) mask |= 4;    // E
      if (self._isFilled(gx + 1, gy + 1)) mask |= 8;  // SE
      if (self._isFilled(gx, gy + 1)) mask |= 16;   // S
      if (self._isFilled(gx - 1, gy + 1)) mask |= 32; // SW
      if (self._isFilled(gx - 1, gy)) mask |= 64;   // W
      if (self._isFilled(gx - 1, gy - 1)) mask |= 128;// NW

      var tileIdx = TilemapSystem.BITMASK_47[mask] || 0;

      var spr: any;
      if (self.tileset) {
        // Cut tile from tileset spritesheet
        var cols = self.tilesetCols;
        var tx = (tileIdx % cols) * self.tileSize;
        var ty = ((tileIdx / cols) | 0) * self.tileSize;
        try {
          var frame = new PIXI.Rectangle(tx, ty, self.tileSize, self.tileSize);
          var tex = new PIXI.Texture({ source: self.tileset.source || self.tileset, frame: frame });
          spr = new PIXI.Sprite(tex);
        } catch(e) {
          // Fallback: colored square
          spr = new PIXI.Graphics();
          spr.rect(0, 0, self.tileSize, self.tileSize);
          spr.fill({ color: 0x556644 });
          spr.stroke({ color: 0x334422, width: 1 });
        }
      } else {
        // No tileset: colored squares with edge indicators
        spr = new PIXI.Graphics();
        spr.rect(0, 0, self.tileSize, self.tileSize);
        spr.fill({ color: 0x556644 });
        // Draw edge lines where there's no neighbor
        var ts = self.tileSize;
        if (!(mask & 1))  { spr.rect(0, 0, ts, 2); spr.fill({ color: 0x88aa66 }); }  // top edge
        if (!(mask & 16)) { spr.rect(0, ts - 2, ts, 2); spr.fill({ color: 0x334422 }); } // bottom edge
        if (!(mask & 64)) { spr.rect(0, 0, 2, ts); spr.fill({ color: 0x667744 }); }  // left edge
        if (!(mask & 4))  { spr.rect(ts - 2, 0, 2, ts); spr.fill({ color: 0x667744 }); } // right edge
      }

      spr.x = gx * self.tileSize;
      spr.y = gy * self.tileSize;
      self.container.addChild(spr);
      self.sprites.set(idx, spr);

      // Register animated tile if this tile type has an animation definition
      var animDef = self._animDefs.get(tile);
      if (animDef) {
        self._animTiles.set(idx, { def: animDef, frameIdx: 0 });
      } else {
        self._animTiles.delete(idx);
      }
    });

    this._dirty.clear();
  }

  /** Convert world position to grid position */
  worldToGrid(wx: number, wy: number): { gx: number; gy: number } {
    return {
      gx: Math.floor(wx / this.tileSize),
      gy: Math.floor(wy / this.tileSize),
    };
  }

  /** Convert grid position to world position (top-left of tile) */
  gridToWorld(gx: number, gy: number): { x: number; y: number } {
    return {
      x: gx * this.tileSize,
      y: gy * this.tileSize,
    };
  }

  /** Check if a world position has a solid tile */
  isSolidAt(wx: number, wy: number): boolean {
    var g = this.worldToGrid(wx, wy);
    return this.getTile(g.gx, g.gy) >= 0;
  }

  // ---- Animated Tiles ----

  /**
   * Register an animated tile definition.
   * When a tile of this type is placed, it cycles through the given frame indices.
   * @param tileType - The tile type number used in setTile()
   * @param frames - Array of tileset indices to cycle (2-16 frames)
   * @param speed - Animation speed in frames per second (default 4)
   */
  defineAnimatedTile(tileType: number, frames: number[], speed = 4): void {
    this._animDefs.set(tileType, { frames: frames, speed: speed });
  }

  /** Remove an animated tile definition */
  removeAnimatedTile(tileType: number): void {
    this._animDefs.delete(tileType);
  }

  /**
   * Update animated tiles — called from game loop.
   * Cycles through animation frames for all tiles with animated definitions.
   */
  update(dt: number): void {
    if (this._animDefs.size === 0 || this._animTiles.size === 0) return;
    var PIXI = (window as any).PIXI;
    var self = this;

    this._animTiles.forEach(function(anim, gridIdx) {
      var prevFrame = Math.floor(anim.frameIdx);
      anim.frameIdx += anim.def.speed * dt;
      if (anim.frameIdx >= anim.def.frames.length) {
        anim.frameIdx = anim.frameIdx % anim.def.frames.length;
      }
      var curFrame = Math.floor(anim.frameIdx);

      // Only update sprite texture when frame changes
      if (curFrame !== prevFrame) {
        var spr = self.sprites.get(gridIdx);
        if (spr && self.tileset) {
          var tileIdx = anim.def.frames[curFrame];
          var cols = self.tilesetCols;
          var tx = (tileIdx % cols) * self.tileSize;
          var ty = ((tileIdx / cols) | 0) * self.tileSize;
          try {
            var frame = new PIXI.Rectangle(tx, ty, self.tileSize, self.tileSize);
            spr.texture = new PIXI.Texture({ source: self.tileset.source || self.tileset, frame: frame });
          } catch(e) {}
        }
      }
    });
  }

  /** Clear all tiles */
  clear(): void {
    this.grid.fill(-1);
    if (this.container) this.container.removeChildren();
    this.sprites.clear();
    this._dirty.clear();
    this._animTiles.clear();
  }

  /** Destroy the tilemap */
  destroy(): void {
    this.clear();
    this._animDefs.clear();
    if (this.container) {
      try { this.engine.world.removeChild(this.container); } catch(e) {}
      this.container.destroy({ children: true });
      this.container = null;
    }
  }

  private _isFilled(gx: number, gy: number): boolean {
    if (gx < 0 || gy < 0 || gx >= this.gridW || gy >= this.gridH) return false;
    return this.grid[gy * this.gridW + gx] >= 0;
  }
}

// ---------------------------------------------------------------------------
// Engine2D — main orchestrator
// ---------------------------------------------------------------------------

export class Engine2D {
  app: any;               // PIXI.Application
  proton: any;            // Proton instance
  protonRenderer: any;    // Proton.PixiRenderer
  world: any;             // PIXI.Container (game world — moves with camera)
  uiLayer: any;           // PIXI.Container (UI layer — fixed on screen)
  input: InputManager;
  camera: Camera2D;
  audio: AudioManager;
  config: Engine2DConfig;

  // Namespace systems (engine.spawn.*, engine.effects.*, etc.)
  spawn: SpawnSystem;
  effects: EffectsSystem;
  physics: PhysicsSystem;
  scene: SceneSystem;
  ui: UISystem;
  assets: AssetsSystem;
  features: FeatureManager;
  pixi: PixiAdvancedSystem;
  level: any;  // LevelSystem (set by GameScene2D via level-painter.ts)
  worldBuilder: WorldBuilderSystem;
  particles: ParticleSystem;
  filters: FilterSystem;
  ease: EasingSystem;
  layers: LayerSystem;
  tilemap: TilemapSystem;
  anim: AnimationSystem;
  instances: InstanceSystem;
  surface: SurfaceSystem;
  collision: CollisionMaskSystem;
  objectEvents: ObjectEventSystem;
  spriteImport: SpriteImportSystem;
  _worldData: any;  // WorldBuilder result — used by Feature Bank features

  // Simple event bus — AI uses engine.events.emit(name, data)
  events = {
    _handlers: new Map<string, Array<(data: any) => void>>(),
    on(name: string, fn: (data: any) => void) { if (!this._handlers.has(name)) this._handlers.set(name, []); this._handlers.get(name)!.push(fn); },
    off(name: string, fn: (data: any) => void) { const h = this._handlers.get(name); if (h) { const i = h.indexOf(fn); if (i >= 0) h.splice(i, 1); } },
    emit(name: string, data?: any) { const h = this._handlers.get(name); if (h) for (const fn of h) try { fn(data); } catch(e) { console.warn('[Events]', name, e); } },
    clear() { this._handlers.clear(); },
  };

  private scenes: Map<SceneName, GameScene> = new Map();
  private currentScene: GameScene | null = null;
  private _elapsed = 0;
  private _paused = false;
  private _updateErrorLogged = false;
  private _depthSortEnabled = false;
  private _depthSortLabels: Set<string> | null = null;
  private _fpsFrames = 0;
  private _fpsTime = 0;
  private _fpsDisplay: any = null;

  constructor(config: Engine2DConfig) {
    this.config = {
      worldWidth: config.width * 3,
      worldHeight: config.height * 2,
      gravity: 980,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      antialias: true,
      ...config,
    };

    this.input = new InputManager();
    this.camera = new Camera2D(this.config.width, this.config.height,
      this.config.worldWidth!, this.config.worldHeight!);
    this.audio = new AudioManager();

    // Initialize namespace systems
    this.spawn = new SpawnSystem(this);
    this.effects = new EffectsSystem(this);
    this.physics = new PhysicsSystem(this);
    this.scene = new SceneSystem(this);
    this.ui = new UISystem(this);
    this.assets = new AssetsSystem(this);
    this.features = new FeatureManager(this);
    this.pixi = new PixiAdvancedSystem(this);
    this.worldBuilder = new WorldBuilderSystem(this);
    this.particles = new ParticleSystem(this);
    this.filters = new FilterSystem(this);
    this.ease = new EasingSystem();
    this.layers = new LayerSystem(this);
    this.tilemap = new TilemapSystem(this);
    this.anim = new AnimationSystem(this);
    this.instances = new InstanceSystem(this);
    this.surface = new SurfaceSystem(this);
    this.collision = new CollisionMaskSystem(this);
    this.objectEvents = new ObjectEventSystem(this);
    this.spriteImport = new SpriteImportSystem(this);
  }

  /**
   * Convenience helper for Feature Bank features.
   * Returns the player sprite with .body attached for backward compat.
   * Features should prefer engine.features.get('player-platformer').getPlayer() for { sprite, body }.
   */
  getPlayer(): any {
    var pf = this.features.get('player-platformer');
    if (!pf || !pf.getPlayer) return null;
    var p = pf.getPlayer();
    if (!p || !p.sprite) return null;
    // Attach body to sprite so feature code can access player.body, player.x, player.scale etc.
    var sprite = p.sprite;
    if (p.body) (sprite as any).body = p.body;
    return sprite;
  }

  async init(rootEl?: HTMLElement): Promise<void> {
    // Create PIXI Application
    this.app = new PIXI.Application();
    await this.app.init({
      width: this.config.width,
      height: this.config.height,
      backgroundColor: this.config.backgroundColor,
      resolution: this.config.pixelRatio,
      autoDensity: true,
      antialias: this.config.antialias,
    });

    const root = rootEl || document.getElementById('root');
    if (root) root.appendChild(this.app.canvas);

    // World container (moves with camera) — sortableChildren for depth sorting
    this.world = new PIXI.Container();
    this.world.sortableChildren = true;
    this.app.stage.addChild(this.world);

    // UI container (fixed above world)
    this.uiLayer = new PIXI.Container();
    this.app.stage.addChild(this.uiLayer);

    // Proton particle engine
    this.proton = new Proton();
    this.protonRenderer = new Proton.PixiRenderer(this.world);
    this.proton.addRenderer(this.protonRenderer);

    // Store globals for runtime cleanup and feature access
    (window as any).__vibexe_pixiApp__ = this.app;
    (window as any).__vibexe_proton__ = this.proton;
    (window as any).__vibexe_engine__ = this;

    // Wire camera to world container
    this.camera._worldContainer = this.world;

    // Input
    this.input.init(this.app.canvas);

    // Game loop
    this.app.ticker.add((ticker: any) => {
      if (this._paused) return;
      const dt = ticker.deltaMS / 1000; // seconds
      this._elapsed += dt;

      // Update Proton particles (skip when no active emitters to save CPU)
      if (this.proton.emitters && this.proton.emitters.length > 0) {
        this.proton.update();
      }

      // Update camera
      this.camera.update(this.world);

      // Update current scene
      if (this.currentScene) {
        try {
          this.currentScene.update(this, dt);
        } catch(e: any) {
          if (!this._updateErrorLogged) {
            console.error('[Engine2D] Scene update() error:', e?.message || e);
            this._updateErrorLogged = true;
          }
        }
      }

      // Update feature snippets
      this.features.updateAll(dt);

      // Update GM-style instance variables (motion, gravity, friction, alarms)
      this.instances.update(dt);

      // Update object events (step phases, mouse events, collision pairs)
      this.objectEvents.update(dt);

      // Update animation state machines
      this.anim.update(dt);

      // Update layers (parallax, auto-scroll, instance depth sort)
      this.layers.update(dt);

      // Auto-flush dirty tilemap tiles + update animated tiles
      this.tilemap.flush();
      this.tilemap.update(dt);

      // Depth sort — auto-sort world children by y position (depth = -bbox_bottom)
      if (this._depthSortEnabled) this._depthSort();

      // FPS counter
      this._updateFPS(dt);
    });

    // Tab visibility — pause proton when backgrounded
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._paused = true;
        try { this.app?.ticker?.stop(); } catch(e) {}
      } else {
        this._paused = false;
        this.app.ticker.start();
      }
    });

    // Resize handler
    window.addEventListener('resize', () => this._onResize());

    console.log('[Engine2D] Initialized — ' + this.config.width + 'x' + this.config.height);
  }

  // Scene management
  addScene(scene: GameScene): void {
    this.scenes.set(scene.name, scene);
  }

  switchScene(name: SceneName, data?: any): void {
    if (this.currentScene) {
      try { this.objectEvents.fireRoomEnd(); } catch(e) {}
      try { this.juice.killAll(); } catch(e) {}
      try { this.currentScene.exit(this); } catch(e) {}
      try { this.world.removeChild(this.currentScene.container); } catch(e) {}
      try { this.uiLayer.removeChildren(); } catch(e) {}
    }
    const next = this.scenes.get(name);
    if (!next) {
      console.error('[Engine2D] Scene not found:', name);
      return;
    }
    this.currentScene = next;
    this._updateErrorLogged = false;
    if (next.container) this.world.addChild(next.container);
    try {
      var result = next.enter(this, data);
      // Handle async enter() — catch promise rejections
      if (result && typeof result.catch === 'function') {
        result.catch((e: any) => console.error('[Engine2D] Scene enter() async error:', e?.message || e));
      }
    } catch(e) {
      console.error('[Engine2D] Scene enter() error:', e);
    }
    try { this.objectEvents.fireRoomStart(); } catch(e) {}
    console.log('[Engine2D] Scene:', name);
  }

  get elapsed(): number { return this._elapsed; }
  get paused(): boolean { return this._paused; }
  set paused(v: boolean) {
    this._paused = v;
    try { if (v) this.app?.ticker?.stop(); else this.app?.ticker?.start(); } catch(e) {}
  }

  // Sprite factories
  createSprite(texture: any, x = 0, y = 0, scale = 1): any {
    const spr = new PIXI.Sprite(texture);
    spr.anchor.set(0.5);
    spr.x = x;
    spr.y = y;
    spr.scale.set(scale);
    return spr;
  }

  createAnimatedSprite(textures: any[], speed = 0.15): any {
    const anim = new PIXI.AnimatedSprite(textures);
    anim.anchor.set(0.5);
    anim.animationSpeed = speed;
    anim.play();
    return anim;
  }

  createTilingSprite(texture: any, width: number, height: number): any {
    const ts = new PIXI.TilingSprite({ texture, width, height });
    return ts;
  }

  createText(text: string, style?: any): any {
    const defaultStyle = {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 4 },
      ...style,
    };
    return new PIXI.Text({ text, style: defaultStyle });
  }

  // Proton emitter helper
  addEmitter(emitter: any): void {
    this.proton.addEmitter(emitter);
  }

  removeEmitter(emitter: any): void {
    this.proton.removeEmitter(emitter);
    emitter.destroy();
  }

  // Juice system for professional game feel
  juice: JuiceSystem = new JuiceSystem();

  // ---------------------------------------------------------------------------
  // Depth sorting — QW7 (GameMaker: depth = -bbox_bottom)
  // ---------------------------------------------------------------------------

  /**
   * Enable automatic depth sorting on the world container.
   * Children are sorted by y position each frame so objects lower on screen render in front.
   * @param labels — optional array of labels to sort (e.g. ['player','enemy','npc']). If omitted, sorts ALL world children.
   */
  enableDepthSort(labels?: string[]): void {
    this._depthSortEnabled = true;
    this._depthSortLabels = labels ? new Set(labels) : null;
  }

  /** Disable automatic depth sorting */
  disableDepthSort(): void {
    this._depthSortEnabled = false;
  }

  /** Internal: set zIndex = -(y + height/2) on sortable children */
  private _depthSort(): void {
    var children = this.world.children;
    var labels = this._depthSortLabels;
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (labels && !labels.has(c.label)) continue;
      // bbox_bottom ≈ y + half-height (anchor center) or y (anchor top)
      var h = c.height || 0;
      var anchorY = c.anchor ? c.anchor.y : 0;
      var bboxBottom = c.y + h * (1 - anchorY);
      c.zIndex = -bboxBottom;
    }
  }

  destroy(): void {
    this.features.destroy();
    this.juice.killAll();
    this.effects.destroyAll();
    this.particles.clear();
    this.filters.removeAll();
    this.layers.clear();
    this.tilemap.destroy();
    this.anim.clear();
    this.instances.clear();
    this.surface.clear();
    this.collision.clear();
    this.objectEvents.clear();
    this.input.destroy();
    if (this.proton) this.proton.destroy();
    if (this.app) this.app.destroy(true, { children: true, texture: true });
    console.log('[Engine2D] Destroyed');
  }

  private _onResize(): void {
    if (!this.app?.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.app.renderer.resize(w, h);
    this.camera.viewWidth = w;
    this.camera.viewHeight = h;
  }

  private _updateFPS(dt: number): void {
    this._fpsFrames++;
    this._fpsTime += dt;
    if (this._fpsTime >= 1) {
      const fps = Math.round(this._fpsFrames / this._fpsTime);
      if (!this._fpsDisplay) {
        this._fpsDisplay = document.createElement('div');
        this._fpsDisplay.id = '__vibexe_fps__';
        this._fpsDisplay.style.cssText = 'position:fixed;top:4px;right:4px;color:#0f0;font:bold 14px monospace;z-index:9999;pointer-events:none;text-shadow:1px 1px #000';
        document.body.appendChild(this._fpsDisplay);
      }
      this._fpsDisplay.textContent = fps + ' FPS';
      // Report to parent
      try { window.parent.postMessage({ type: 'vibexe-fps', fps }, '*'); } catch(e) {}
      this._fpsFrames = 0;
      this._fpsTime = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// InputManager
// ---------------------------------------------------------------------------

export class InputManager {
  keys: Set<string> = new Set();
  justPressed: Set<string> = new Set();
  justReleased: Set<string> = new Set();
  pointer = { x: 0, y: 0, down: false, justDown: false, justUp: false };

  private _keydownFn: any;
  private _keyupFn: any;
  private _pointermoveFn: any;
  private _pointerdownFn: any;
  private _pointerupFn: any;
  private _canvas: HTMLCanvasElement | null = null;

  init(canvas: HTMLCanvasElement): void {
    this._canvas = canvas;

    this._keydownFn = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.justPressed.add(k);
      this.keys.add(k);
      // Language-independent: map physical key codes to ASCII equivalents
      // so WASD/XC work regardless of active keyboard layout (Hebrew, Russian, Arabic, etc.)
      const code = e.code;
      if (code && code.startsWith('Key')) {
        const ascii = code.charAt(3).toLowerCase(); // 'KeyA' → 'a', 'KeyX' → 'x'
        if (!this.keys.has(ascii)) this.justPressed.add(ascii);
        this.keys.add(ascii);
      }
      if (code === 'Space' && !this.keys.has(' ')) {
        this.justPressed.add(' ');
        this.keys.add(' ');
      }
      // Prevent scroll/browser shortcuts on game keys
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key) ||
          ['KeyW','KeyA','KeyS','KeyD','KeyX','KeyC','Space'].includes(code)) {
        e.preventDefault();
      }
    };
    this._keyupFn = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      this.justReleased.add(k);
      // Also release physical key code mapping
      const code = e.code;
      if (code && code.startsWith('Key')) {
        const ascii = code.charAt(3).toLowerCase();
        this.keys.delete(ascii);
        this.justReleased.add(ascii);
      }
      if (code === 'Space') {
        this.keys.delete(' ');
        this.justReleased.add(' ');
      }
    };
    this._pointermoveFn = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - rect.left;
      this.pointer.y = e.clientY - rect.top;
    };
    this._pointerdownFn = () => {
      this.pointer.down = true;
      this.pointer.justDown = true;
    };
    this._pointerupFn = () => {
      this.pointer.down = false;
      this.pointer.justUp = true;
    };

    window.addEventListener('keydown', this._keydownFn);
    window.addEventListener('keyup', this._keyupFn);
    canvas.addEventListener('pointermove', this._pointermoveFn);
    canvas.addEventListener('pointerdown', this._pointerdownFn);
    canvas.addEventListener('pointerup', this._pointerupFn);
  }

  // Call at end of each frame to clear one-shot states
  endFrame(): void {
    this.justPressed.clear();
    this.justReleased.clear();
    this.pointer.justDown = false;
    this.pointer.justUp = false;
  }

  isDown(key: string): boolean { return this.keys.has(key.toLowerCase()); }
  wasPressed(key: string): boolean { return this.justPressed.has(key.toLowerCase()); }
  wasReleased(key: string): boolean { return this.justReleased.has(key.toLowerCase()); }

  // Aliases — AI commonly guesses these names
  isPressed(key: string): boolean { return this.isDown(key); }
  keyDown(key: string): boolean { return this.isDown(key); }
  keyPressed(key: string): boolean { return this.wasPressed(key); }
  pressed(key: string): boolean { return this.wasPressed(key); }
  held(key: string): boolean { return this.isDown(key); }

  // Directional helpers
  get left(): boolean { return this.isDown('a') || this.isDown('arrowleft'); }
  get right(): boolean { return this.isDown('d') || this.isDown('arrowright'); }
  get up(): boolean { return this.isDown('w') || this.isDown('arrowup'); }
  get down(): boolean { return this.isDown('s') || this.isDown('arrowdown'); }
  get jump(): boolean { return this.wasPressed(' ') || this.wasPressed('arrowup') || this.wasPressed('w'); }

  destroy(): void {
    if (this._keydownFn) window.removeEventListener('keydown', this._keydownFn);
    if (this._keyupFn) window.removeEventListener('keyup', this._keyupFn);
    if (this._canvas) {
      this._canvas.removeEventListener('pointermove', this._pointermoveFn);
      this._canvas.removeEventListener('pointerdown', this._pointerdownFn);
      this._canvas.removeEventListener('pointerup', this._pointerupFn);
    }
  }
}

// ---------------------------------------------------------------------------
// Camera2D
// ---------------------------------------------------------------------------

export class Camera2D {
  x = 0;
  y = 0;
  viewWidth: number;
  viewHeight: number;
  worldWidth: number;
  worldHeight: number;
  target: { x: number; y: number } | null = null;
  smoothing = 0.1;
  deadZoneX = 50;
  deadZoneY = 30;

  constructor(vw: number, vh: number, ww: number, wh: number) {
    this.viewWidth = vw;
    this.viewHeight = vh;
    this.worldWidth = ww;
    this.worldHeight = wh;
  }

  follow(target: { x: number; y: number }): void {
    this.target = target;
  }

  update(worldContainer: any): void {
    if (this.target) {
      const targetX = this.target.x - this.viewWidth / 2;
      const targetY = this.target.y - this.viewHeight / 2;

      // Smooth follow with dead zone
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      if (Math.abs(dx) > this.deadZoneX) {
        this.x += (dx - Math.sign(dx) * this.deadZoneX) * this.smoothing;
      }
      if (Math.abs(dy) > this.deadZoneY) {
        this.y += (dy - Math.sign(dy) * this.deadZoneY) * this.smoothing;
      }
    }

    // Clamp to world bounds
    this.x = Math.max(0, Math.min(this.x, this.worldWidth - this.viewWidth));
    this.y = Math.max(0, Math.min(this.y, this.worldHeight - this.viewHeight));

    // Apply to world container (negative = world moves opposite to camera)
    worldContainer.x = -Math.round(this.x);
    worldContainer.y = -Math.round(this.y);
  }

  // Alias — AI commonly writes camera.applyTo(container)
  applyTo(worldContainer: any): void {
    this.update(worldContainer);
  }

  // Convert screen coords to world coords
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx + this.x, y: sy + this.y };
  }

  /** Shake the camera (uses GSAP if available) */
  shake(intensity = 8, duration = 0.3): void {
    var gsap = (window as any).gsap;
    if (!gsap || !this._worldContainer) return;
    var container = this._worldContainer;
    var origX = container.x, origY = container.y;
    var tl = gsap.timeline();
    var steps = Math.ceil(duration / 0.03);
    for (var i = 0; i < steps; i++) {
      var t = i / steps;
      var decay = 1 - t;
      tl.to(container, {
        x: origX + (Math.random() - 0.5) * intensity * decay * 2,
        y: origY + (Math.random() - 0.5) * intensity * decay * 2,
        duration: 0.03, ease: 'none',
      });
    }
    tl.to(container, { x: origX, y: origY, duration: 0.05 });
  }

  /** Smoothly zoom to a level (1 = normal, 2 = double) */
  zoom(level: number, duration = 0.5): void {
    var gsap = (window as any).gsap;
    if (!this._worldContainer) return;
    if (gsap) {
      gsap.to(this._worldContainer.scale, {
        x: level, y: level, duration, ease: 'power2.inOut'
      });
    } else {
      this._worldContainer.scale.set(level);
    }
  }

  /** Smoothly pan camera to a world position */
  pan(x: number, y: number, duration = 1): void {
    var gsap = (window as any).gsap;
    var self = this;
    if (gsap) {
      gsap.to(this, { x, y, duration, ease: 'power2.inOut',
        onUpdate: function() { if (self._worldContainer) self.update(self._worldContainer); }
      });
    } else {
      this.x = x;
      this.y = y;
    }
  }

  /** Set camera bounds (clamp region) */
  bounds(x: number, y: number, width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
    this._boundsOffset = { x, y };
  }

  // Internal reference set during engine init
  _worldContainer: any = null;
  _boundsOffset: { x: number; y: number } = { x: 0, y: 0 };
}

// ---------------------------------------------------------------------------
// AudioManager
// ---------------------------------------------------------------------------

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private currentMusic: AudioBufferSourceNode | null = null;

  private ensureContext(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    (window as any).__vibexe_audioCtx__ = this.ctx;
  }

  async loadSound(id: string, url: string): Promise<void> {
    this.ensureContext();
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx!.decodeAudioData(buffer);
      this.sounds.set(id, audioBuffer);
    } catch (e) {
      console.warn('[Audio] Failed to load:', id, e);
    }
  }

  playSFX(id: string, volume = 1): void {
    this.ensureContext();
    const buffer = this.sounds.get(id);
    if (!buffer || !this.ctx) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.sfxGain!);
    source.start();
  }

  playMusic(id: string, loop = true, volume = 0.5): void {
    this.stopMusic();
    this.ensureContext();
    const buffer = this.sounds.get(id);
    if (!buffer || !this.ctx) return;
    this.currentMusic = this.ctx.createBufferSource();
    this.currentMusic.buffer = buffer;
    this.currentMusic.loop = loop;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    this.currentMusic.connect(gain);
    gain.connect(this.musicGain!);
    this.currentMusic.start();
  }

  stopMusic(): void {
    if (this.currentMusic) {
      try { this.currentMusic.stop(); } catch(e) {}
      this.currentMusic = null;
    }
  }

  setMasterVolume(v: number): void {
    this.ensureContext();
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  // --- Clean API aliases ---

  /** Alias: playSFX → play */
  play(id: string, volume = 1): void { this.playSFX(id, volume); }

  /** Alias: playMusic → music */
  music(id: string, loop = true, volume = 0.5): void { this.playMusic(id, loop, volume); }

  /** Set volume for a channel */
  volume(channel: 'master' | 'music' | 'sfx', level: number): void {
    this.ensureContext();
    var v = Math.max(0, Math.min(1, level));
    if (channel === 'master' && this.masterGain) this.masterGain.gain.value = v;
    else if (channel === 'music' && this.musicGain) this.musicGain.gain.value = v;
    else if (channel === 'sfx' && this.sfxGain) this.sfxGain.gain.value = v;
  }

  // -------------------------------------------------------------------------
  // Distance-based audio — QW8 (GameMaker: volume = min(falloff/distance, 1))
  // -------------------------------------------------------------------------

  /**
   * Play a sound effect with volume based on distance from the listener (camera center).
   * @param id - Sound ID (previously loaded)
   * @param x - World x position of the sound source
   * @param y - World y position of the sound source
   * @param config - { falloff?: number (default 300), minVolume?: number (default 0), maxVolume?: number (default 1) }
   */
  playAt(id: string, x: number, y: number, config?: { falloff?: number; minVolume?: number; maxVolume?: number }): void {
    var engine = (window as any).__vibexe_engine__;
    if (!engine || !engine.camera) { this.playSFX(id, 1); return; }
    var cam = engine.camera;
    var cx = cam.x + cam.viewWidth * 0.5;
    var cy = cam.y + cam.viewHeight * 0.5;
    var dx = x - cx;
    var dy = y - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var falloff = (config && config.falloff) || 300;
    var minVol = (config && config.minVolume) || 0;
    var maxVol = (config && config.maxVolume) || 1;
    var vol = Math.min(falloff / Math.max(dist, 1), maxVol);
    if (vol < minVol) return; // Too far — don't play at all
    this.playSFX(id, vol);
  }

  /**
   * Utility: calculate volume from distance (for manual use).
   * Returns a 0-1 value: min(falloff/distance, 1)
   */
  static volumeFromDistance(listenerX: number, listenerY: number, sourceX: number, sourceY: number, falloff = 300): number {
    var dx = sourceX - listenerX;
    var dy = sourceY - listenerY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    return Math.min(falloff / Math.max(dist, 1), 1);
  }
}

// ---------------------------------------------------------------------------
// Asset loading helper
// ---------------------------------------------------------------------------

export async function loadAssets(manifest: Record<string, string>,
  onProgress?: (pct: number) => void): Promise<Record<string, any>> {
  const entries = Object.entries(manifest);
  const results: Record<string, any> = {};
  let loaded = 0;

  for (const [key, url] of entries) {
    try {
      results[key] = await PIXI.Assets.load(url);
    } catch (e) {
      console.warn('[Assets] Failed to load:', key, url, e);
    }
    loaded++;
    if (onProgress) onProgress(loaded / entries.length);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Quick-start helper
// ---------------------------------------------------------------------------

export async function createGame2D(config: Partial<Engine2DConfig> = {}): Promise<Engine2D> {
  const engine = new Engine2D({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1a1a2e,
    ...config,
  });
  await engine.init();
  return engine;
}

// ---------------------------------------------------------------------------
// SpawnSystem — engine.spawn.* namespace
// ---------------------------------------------------------------------------

export class SpawnSystem {
  private engine: Engine2D;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Create a sprite from a texture at (x, y) */
  sprite(texture: any, x = 0, y = 0, config: any = {}): any {
    const spr = new PIXI.Sprite(texture);
    spr.anchor.set(config.anchor?.x ?? 0.5, config.anchor?.y ?? 0.5);
    spr.x = x;
    spr.y = y;
    if (config.scale !== undefined) spr.scale.set(config.scale);
    if (config.tint !== undefined) spr.tint = config.tint;
    if (config.alpha !== undefined) spr.alpha = config.alpha;
    if (config.rotation !== undefined) spr.rotation = config.rotation;
    if (config.zIndex !== undefined) spr.zIndex = config.zIndex;
    return spr;
  }

  /** Create a text object */
  text(x: number, y: number, text: string, style?: any): any {
    const defaultStyle = {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 4 },
      ...style,
    };
    const t = new PIXI.Text({ text, style: defaultStyle });
    t.x = x;
    t.y = y;
    return t;
  }

  /** Create an animated sprite from an array of textures */
  animatedSprite(textures: any[], speed = 0.15): any {
    const anim = new PIXI.AnimatedSprite(textures);
    anim.anchor.set(0.5);
    anim.animationSpeed = speed;
    anim.play();
    return anim;
  }

  /** Create a tiling sprite */
  tilingSprite(texture: any, x: number, y: number, width: number, height: number): any {
    const ts = new PIXI.TilingSprite({ texture, width, height });
    ts.x = x;
    ts.y = y;
    return ts;
  }

  /** Spawn a player entity at (x, y) with config */
  player(x: number, y: number, config: any = {}): any {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.label = 'player';
    (container as any)._config = { speed: 200, jumpForce: 450, health: 3, lives: 3, ...config };
    return container;
  }

  /** Spawn an enemy entity at (x, y) */
  enemy(x: number, y: number, type?: string, config: any = {}): any {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.label = 'enemy';
    (container as any)._config = { type: type || 'patrol', health: 1, speed: 80, damage: 1, ...config };
    return container;
  }

  /** Spawn a platform at (x, y) with given dimensions */
  platform(x: number, y: number, width: number, height: number, config: any = {}): any {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.label = 'platform';
    (container as any)._config = { width, height, isOneWay: false, ...config };
    return container;
  }

  /** Spawn a coin/collectible at (x, y) */
  coin(x: number, y: number, config: any = {}): any {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.label = 'coin';
    (container as any)._config = { value: 10, bobSpeed: 2, ...config };
    return container;
  }

  /** Spawn a projectile at (x, y) moving in direction */
  projectile(x: number, y: number, direction: { x: number; y: number }, config: any = {}): any {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.label = 'projectile';
    (container as any)._config = { speed: 400, damage: 1, lifetime: 3, direction, ...config };
    return container;
  }
}

// ---------------------------------------------------------------------------
// EffectsSystem — engine.effects.* namespace (Proton particle presets)
// ---------------------------------------------------------------------------

export class EffectsSystem {
  private engine: Engine2D;
  private _activeEffects: any[] = [];

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  private _add(emitter: any): any {
    this.engine.proton.addEmitter(emitter);
    this._activeEffects.push(emitter);
    return emitter;
  }

  private _burst(emitter: any, ms = 800): void {
    this._add(emitter);
    setTimeout(() => {
      try { emitter.stop(); emitter.destroy(); this.engine.proton.removeEmitter(emitter); } catch(e) {}
      var idx = this._activeEffects.indexOf(emitter);
      if (idx >= 0) this._activeEffects.splice(idx, 1);
    }, ms);
  }

  /** Rain — diagonal falling drops */
  rain(intensity = 0.6): any {
    var w = this.engine.config.width, h = this.engine.config.height;
    var rate = Math.floor(10 + intensity * 40);
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(rate, rate + 10), new Proton.Span(0.01, 0.02));
    emitter.addInitialize(new Proton.Life(0.6, 1.2));
    emitter.addInitialize(new Proton.Radius(1, 2));
    emitter.addInitialize(new Proton.Position(new Proton.LineZone(0, -20, w, -20)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(4, 8), new Proton.Span(250, 280), 'polar'));
    emitter.addBehaviour(new Proton.Alpha(0.5, 0.1));
    emitter.addBehaviour(new Proton.Color('#aaccff'));
    emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(-50, -50, w + 100, h + 50), 'dead'));
    emitter.p.x = 0; emitter.p.y = 0;
    emitter.emit();
    return this._add(emitter);
  }

  /** Snow — soft fluttering snowflakes */
  snow(density = 0.5): any {
    var w = this.engine.config.width, h = this.engine.config.height;
    var rate = Math.floor(5 + density * 20);
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(rate, rate + 5), new Proton.Span(0.05, 0.1));
    emitter.addInitialize(new Proton.Life(3, 6));
    emitter.addInitialize(new Proton.Radius(2, 5));
    emitter.addInitialize(new Proton.Position(new Proton.LineZone(0, -20, w, -20)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(260, 280), 'polar'));
    emitter.addBehaviour(new Proton.Alpha(0.8, 0.2));
    emitter.addBehaviour(new Proton.Color('#ffffff'));
    emitter.addBehaviour(new Proton.RandomDrift(15, 5, 0.1));
    emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(-50, -50, w + 100, h + 50), 'dead'));
    emitter.p.x = 0; emitter.p.y = 0;
    emitter.emit();
    return this._add(emitter);
  }

  /** Fire — flickering flames at a point */
  fire(x: number, y: number, scale = 1): any {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(4, 8), new Proton.Span(0.03, 0.06));
    emitter.addInitialize(new Proton.Life(0.3, 0.8));
    emitter.addInitialize(new Proton.Radius(5 * scale, 15 * scale));
    emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, 10 * scale)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(2, 5), new Proton.Span(85, 95), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 0.2));
    emitter.addBehaviour(new Proton.Alpha(0.9, 0));
    emitter.addBehaviour(new Proton.Color('#ff6600', '#220000'));
    emitter.addBehaviour(new Proton.RandomDrift(3, 1, 0.05));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Smoke — rising expanding puffs */
  smoke(x: number, y: number): any {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(2, 4), new Proton.Span(0.1, 0.2));
    emitter.addInitialize(new Proton.Life(1.5, 3));
    emitter.addInitialize(new Proton.Radius(8, 20));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(80, 100), 'polar'));
    emitter.addBehaviour(new Proton.Scale(0.5, 2));
    emitter.addBehaviour(new Proton.Alpha(0.5, 0));
    emitter.addBehaviour(new Proton.Color('#666666', '#111111'));
    emitter.addBehaviour(new Proton.RandomDrift(8, 2, 0.1));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Explosion — radial burst (one-shot) */
  explosion(x: number, y: number, color = '#ff4400'): void {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(30, 60), 1);
    emitter.addInitialize(new Proton.Life(0.4, 1.0));
    emitter.addInitialize(new Proton.Radius(3, 12));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(4, 12), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1.2, 0.1));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Color(color, '#000000'));
    emitter.addBehaviour(new Proton.Rotate(new Proton.Span(0, 360), new Proton.Span(-4, 4), 'add'));
    emitter.addBehaviour(new Proton.Gravity(3));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 1000);
  }

  /** Sparkle — radial shimmer (collect item, powerup) */
  sparkle(x: number, y: number): void {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(15, 30), 1);
    emitter.addInitialize(new Proton.Life(0.4, 0.8));
    emitter.addInitialize(new Proton.Radius(2, 7));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(3, 8), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1.2, 0));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Color('#ffff00', '#ffffff'));
    emitter.addBehaviour(new Proton.Rotate(new Proton.Span(0, 360), 'add'));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 800);
  }

  /** Dust puff — small burst on jump/land */
  dust(x: number, y: number): void {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(5, 10), 1);
    emitter.addInitialize(new Proton.Life(0.15, 0.3));
    emitter.addInitialize(new Proton.Radius(3, 8));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 4), new Proton.Span(60, 120), 'polar'));
    emitter.addBehaviour(new Proton.Scale(0.8, 0.1));
    emitter.addBehaviour(new Proton.Alpha(0.6, 0));
    emitter.addBehaviour(new Proton.Color('#ccaa88'));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 500);
  }

  /** Trail — follows a moving target */
  trail(target: any, color = '#44aaff'): any {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(3, 6), new Proton.Span(0.02, 0.04));
    emitter.addInitialize(new Proton.Life(0.2, 0.5));
    emitter.addInitialize(new Proton.Radius(3, 8));
    emitter.addBehaviour(new Proton.Scale(1, 0.1));
    emitter.addBehaviour(new Proton.Alpha(0.7, 0));
    emitter.addBehaviour(new Proton.Color(color, '#000000'));
    if (target) { emitter.p.x = target.x; emitter.p.y = target.y; }
    emitter.emit();
    // Store target reference for position updates
    (emitter as any)._trailTarget = target;
    return this._add(emitter);
  }

  /** Ambient particles — theme-appropriate background effects */
  ambient(type: 'fireflies' | 'embers' | 'dust' | 'leaves' | 'pollen'): any {
    var w = this.engine.config.width, h = this.engine.config.height;
    var emitter = new Proton.Emitter();

    switch (type) {
      case 'fireflies':
        emitter.rate = new Proton.Rate(new Proton.Span(1, 3), new Proton.Span(0.3, 0.8));
        emitter.addInitialize(new Proton.Life(3, 8));
        emitter.addInitialize(new Proton.Radius(2, 4));
        emitter.addInitialize(new Proton.Position(new Proton.RectZone(0, h * 0.3, w, h)));
        emitter.addBehaviour(new Proton.Alpha(0, 1, Infinity, Proton.easeInOutSine));
        emitter.addBehaviour(new Proton.Color('#ffff44'));
        emitter.addBehaviour(new Proton.RandomDrift(20, 15, 0.2));
        break;
      case 'embers':
        emitter.rate = new Proton.Rate(new Proton.Span(2, 4), new Proton.Span(0.1, 0.3));
        emitter.addInitialize(new Proton.Life(1, 3));
        emitter.addInitialize(new Proton.Radius(1, 3));
        emitter.addInitialize(new Proton.Position(new Proton.LineZone(0, h + 10, w, h + 10)));
        emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 4), new Proton.Span(80, 100), 'polar'));
        emitter.addBehaviour(new Proton.Alpha(0.9, 0));
        emitter.addBehaviour(new Proton.Color('#ff6600', '#ffaa00'));
        emitter.addBehaviour(new Proton.RandomDrift(10, 3, 0.1));
        break;
      case 'dust':
        emitter.rate = new Proton.Rate(new Proton.Span(1, 2), new Proton.Span(0.5, 1));
        emitter.addInitialize(new Proton.Life(4, 8));
        emitter.addInitialize(new Proton.Radius(1, 3));
        emitter.addInitialize(new Proton.Position(new Proton.RectZone(0, 0, w, h)));
        emitter.addBehaviour(new Proton.Alpha(0.2, 0.05));
        emitter.addBehaviour(new Proton.Color('#ddccaa'));
        emitter.addBehaviour(new Proton.RandomDrift(5, 3, 0.05));
        break;
      case 'leaves':
        emitter.rate = new Proton.Rate(new Proton.Span(1, 2), new Proton.Span(0.5, 1.5));
        emitter.addInitialize(new Proton.Life(4, 8));
        emitter.addInitialize(new Proton.Radius(4, 8));
        emitter.addInitialize(new Proton.Position(new Proton.LineZone(-20, -20, w + 20, -20)));
        emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(240, 280), 'polar'));
        emitter.addBehaviour(new Proton.Alpha(0.7, 0.1));
        emitter.addBehaviour(new Proton.Color('#66aa33', '#aa6622'));
        emitter.addBehaviour(new Proton.Rotate('random', 'random'));
        emitter.addBehaviour(new Proton.RandomDrift(15, 5, 0.1));
        emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(-50, -50, w + 100, h + 50), 'dead'));
        break;
      case 'pollen':
        emitter.rate = new Proton.Rate(new Proton.Span(1, 2), new Proton.Span(0.5, 1));
        emitter.addInitialize(new Proton.Life(5, 10));
        emitter.addInitialize(new Proton.Radius(1, 2));
        emitter.addInitialize(new Proton.Position(new Proton.RectZone(0, 0, w, h)));
        emitter.addBehaviour(new Proton.Alpha(0.4, 0.1));
        emitter.addBehaviour(new Proton.Color('#ffffcc'));
        emitter.addBehaviour(new Proton.RandomDrift(8, 4, 0.08));
        break;
    }

    emitter.p.x = 0; emitter.p.y = 0;
    emitter.emit();
    return this._add(emitter);
  }

  /** Magic vortex — swirling color-shifting particles */
  magic(x: number, y: number, color = '#aa44ff'): any {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(5, 10), new Proton.Span(0.05, 0.1));
    emitter.addInitialize(new Proton.Life(0.5, 1.5));
    emitter.addInitialize(new Proton.Radius(3, 8));
    emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, 20)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 0));
    emitter.addBehaviour(new Proton.Alpha(0.8, 0));
    emitter.addBehaviour(new Proton.Color(color, '#ffffff'));
    emitter.addBehaviour(new Proton.Cyclone(new Proton.Span(2, 5)));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Shockwave — pixi-filters ShockwaveFilter + GSAP */
  shockwave(x: number, y: number): void {
    var gsap = (window as any).gsap;
    var container = this.engine.world;
    if (!PIXI.filters || !PIXI.filters.ShockwaveFilter || !gsap) return;
    var filter = new PIXI.filters.ShockwaveFilter({
      center: [x / (container.width || 800), y / (container.height || 600)],
      speed: 400, amplitude: 20, wavelength: 120, brightness: 1.2, radius: -1,
    });
    var existing = container.filters ? Array.from(container.filters) : [];
    existing.push(filter);
    container.filters = existing;
    gsap.to(filter, {
      time: 1.5, duration: 0.8, ease: 'power2.out',
      onComplete: function() {
        var cur = container.filters ? Array.from(container.filters) : [];
        var idx = cur.indexOf(filter);
        if (idx >= 0) { cur.splice(idx, 1); container.filters = cur; }
      }
    });
  }

  /** Remove all active continuous effects */
  destroyAll(): void {
    for (var i = 0; i < this._activeEffects.length; i++) {
      try {
        this._activeEffects[i].stop();
        this._activeEffects[i].destroy();
        this.engine.proton.removeEmitter(this._activeEffects[i]);
      } catch(e) {}
    }
    this._activeEffects = [];
  }
}

// ---------------------------------------------------------------------------
// PhysicsSystem — engine.physics.* namespace
// ---------------------------------------------------------------------------

export class PhysicsSystem {
  private engine: Engine2D;
  bodies: any[] = [];
  private _colliders: Array<{ a: string; b: string; callback?: Function }> = [];
  private _overlaps: Array<{ a: string; b: string; callback?: Function }> = [];

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Set world gravity */
  gravity(value: number): void {
    this.engine.config.gravity = value;
  }

  /** Add a physics body to an object */
  addBody(obj: any, config: any = {}): any {
    var body = {
      x: obj.x || 0, y: obj.y || 0,
      vx: 0, vy: 0, ax: 0, ay: 0,
      hw: (config.width || 32) / 2,
      hh: (config.height || 32) / 2,
      mass: config.mass ?? 1,
      friction: config.friction ?? 0.2,
      bounce: config.bounce ?? 0,
      isStatic: config.isStatic ?? false,
      isOneWay: config.isOneWay ?? false,
      isSensor: config.isSensor ?? false,
      enabled: true,
      onGround: false,
      onWall: null,
      onCeiling: false,
      tag: config.tag || '',
      sprite: obj,
      userData: config.userData || null,
    };
    obj.body = body;
    this.bodies.push(body);
    return body;
  }

  /** Register collision handler between two tags */
  collider(tagA: string, tagB: string, callback?: Function): void {
    this._colliders.push({ a: tagA, b: tagB, callback });
  }

  /** Register overlap (sensor) handler between two tags */
  overlap(tagA: string, tagB: string, callback?: Function): void {
    this._overlaps.push({ a: tagA, b: tagB, callback });
  }

  /** Remove a body */
  removeBody(body: any): void {
    var idx = this.bodies.indexOf(body);
    if (idx >= 0) this.bodies.splice(idx, 1);
  }
}

// ---------------------------------------------------------------------------
// SceneSystem — engine.scene.* namespace
// ---------------------------------------------------------------------------

export class SceneSystem {
  private engine: Engine2D;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Switch to a named scene */
  switch(name: string, data?: any): void {
    this.engine.switchScene(name, data);
  }

  /** Add a scene to the engine */
  add(scene: GameScene): void {
    this.engine.addScene(scene);
  }
}

// ---------------------------------------------------------------------------
// UISystem — engine.ui.* namespace
// ---------------------------------------------------------------------------

export class UISystem {
  private engine: Engine2D;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  // --- Backward compat: proxy PIXI.Container methods to uiLayer ---
  addChild(child: any): any { return this.engine.uiLayer.addChild(child); }
  removeChild(child: any): void { this.engine.uiLayer.removeChild(child); }
  removeChildren(): void { this.engine.uiLayer.removeChildren(); }

  /** Create a health bar UI element */
  healthBar(x: number, y: number, config: any = {}): any {
    var maxHp = config.maxHealth || 3;
    var w = config.width || 200;
    var h = config.height || 20;
    var container = new PIXI.Container();
    container.x = x; container.y = y;

    // Background
    var bg = new PIXI.Graphics();
    bg.roundRect(0, 0, w, h, 4);
    bg.fill({ color: config.bgColor || 0x333333 });
    container.addChild(bg);

    // Fill bar
    var fill = new PIXI.Graphics();
    fill.roundRect(0, 0, w, h, 4);
    fill.fill({ color: config.color || 0x44cc44 });
    container.addChild(fill);

    // Border
    var border = new PIXI.Graphics();
    border.roundRect(0, 0, w, h, 4);
    border.stroke({ color: config.borderColor || 0xffffff, width: 2 });
    container.addChild(border);

    container._hp = maxHp;
    container._maxHp = maxHp;
    container._fill = fill;
    container._barWidth = w;
    container.setHealth = function(hp: number) {
      this._hp = Math.max(0, Math.min(hp, this._maxHp));
      var pct = this._hp / this._maxHp;
      this._fill.scale.x = pct;
    };

    this.engine.uiLayer.addChild(container);
    return container;
  }

  /** Create an animated score counter */
  score(x: number, y: number, config: any = {}): any {
    var prefix = config.prefix || 'Score: ';
    var textObj = new PIXI.Text({
      text: prefix + '0',
      style: {
        fontFamily: 'Arial', fontSize: config.fontSize || 28,
        fill: config.color || 0xffffff,
        stroke: { color: 0x000000, width: 4 },
      }
    });
    textObj.x = x; textObj.y = y;
    textObj._score = 0;
    textObj._prefix = prefix;
    textObj.setScore = function(v: number) {
      this._score = v;
      this.text = this._prefix + v;
      if (config.juiceOnChange !== false) {
        var eng = (this as any)._engine;
        if (eng) eng.juice.pop(this);
      }
    };
    textObj.addScore = function(v: number) { this.setScore(this._score + v); };
    textObj._engine = this.engine;

    this.engine.uiLayer.addChild(textObj);
    return textObj;
  }

  /** Create a countdown/count-up timer */
  timer(x: number, y: number, config: any = {}): any {
    var textObj = new PIXI.Text({
      text: '0:00',
      style: {
        fontFamily: 'Arial', fontSize: config.fontSize || 28,
        fill: config.color || 0xffffff,
        stroke: { color: 0x000000, width: 4 },
      }
    });
    textObj.x = x; textObj.y = y;
    textObj._seconds = config.seconds || 0;
    textObj._countDown = config.countDown || false;
    textObj._elapsed = 0;
    textObj._urgencyColor = config.urgencyColor || 0xff4444;
    textObj._urgencyThreshold = config.urgencyThreshold || 10;
    textObj._normalColor = config.color || 0xffffff;
    textObj._running = false;

    textObj.start = function() { this._running = true; };
    textObj.stop = function() { this._running = false; };
    textObj.tick = function(dt: number) {
      if (!this._running) return;
      if (this._countDown) {
        this._seconds = Math.max(0, this._seconds - dt);
      } else {
        this._seconds += dt;
      }
      var m = Math.floor(this._seconds / 60);
      var s = Math.floor(this._seconds % 60);
      this.text = m + ':' + (s < 10 ? '0' : '') + s;
      // Urgency coloring
      if (this._countDown && this._seconds <= this._urgencyThreshold) {
        this.style.fill = this._urgencyColor;
      } else {
        this.style.fill = this._normalColor;
      }
    };

    this.engine.uiLayer.addChild(textObj);
    return textObj;
  }

  /** Create a text UI element */
  text(x: number, y: number, text: string, style?: any): any {
    var t = this.engine.spawn.text(x, y, text, style);
    this.engine.uiLayer.addChild(t);
    return t;
  }
}

// ---------------------------------------------------------------------------
// AssetsSystem — engine.assets.* namespace
// ---------------------------------------------------------------------------

export class AssetsSystem {
  private engine: Engine2D;
  private _cache: Map<string, any> = new Map();

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Load and return a sprite from a texture key/URL */
  async load(key: string, url: string): Promise<any> {
    try {
      var tex = await PIXI.Assets.load(url);
      this._cache.set(key, tex);
      return tex;
    } catch(e) {
      console.warn('[Assets] Failed to load:', key, url, e);
      return null;
    }
  }

  /** Get a loaded texture as a new Sprite */
  sprite(key: string): any {
    var tex = this._cache.get(key);
    if (!tex) { console.warn('[Assets] Not loaded:', key); return null; }
    var spr = new PIXI.Sprite(tex);
    spr.anchor.set(0.5);
    return spr;
  }

  /** Get a loaded spritesheet animation as AnimatedSprite */
  animation(key: string, animName?: string): any {
    var sheet = this._cache.get(key);
    if (!sheet || !sheet.animations) { console.warn('[Assets] No animation:', key); return null; }
    var frames = animName ? sheet.animations[animName] : Object.values(sheet.animations)[0];
    if (!frames) return null;
    var anim = new PIXI.AnimatedSprite(frames as any);
    anim.anchor.set(0.5);
    anim.animationSpeed = 0.15;
    anim.play();
    return anim;
  }

  /** Get a raw texture by key */
  texture(key: string): any {
    return this._cache.get(key) || null;
  }

  /** Check if a key is loaded */
  has(key: string): boolean {
    return this._cache.has(key);
  }

  /** Load a PIXI.Spritesheet from atlas URL + JSON metadata URL.
   *  After loading, use engine.assets.animation(name, 'animName') to get AnimatedSprite. */
  async loadSpritesheet(name: string, atlasUrl: string, jsonUrl: string): Promise<any> {
    try {
      var [jsonData, atlasTex] = await Promise.all([
        fetch(jsonUrl).then(r => r.json()),
        PIXI.Assets.load(atlasUrl),
      ]);
      // Override meta.image — atlas is already loaded as texture
      var sheet = new PIXI.Spritesheet(atlasTex, jsonData);
      await sheet.parse();
      this._cache.set(name, sheet);
      console.log('[Assets] Spritesheet loaded:', name, 'animations:', Object.keys(sheet.animations || {}));
      return sheet;
    } catch(e) {
      console.warn('[Assets] Failed to load spritesheet:', name, e);
      return null;
    }
  }

  /** List animation names from a loaded spritesheet */
  animationNames(key: string): string[] {
    var sheet = this._cache.get(key);
    if (!sheet || !sheet.animations) return [];
    return Object.keys(sheet.animations);
  }

  /** Replace the player character with custom spritesheet animations.
   *  Maps loaded spritesheets to _sheetCache['hero'] and swaps the player visual.
   *  @param mapping - { idle: "sheet_name", walk: "sheet_name", jump: "sheet_name" }
   *  At minimum 'idle' is required. 'walk' defaults to idle, 'jump' defaults to idle. */
  setPlayerSprites(mapping: Record<string, string>): void {
    try {
      // Preserve existing hero sheet animations — merge new on top, skip failures
      var existingHero = (window as any).__vibexeSheetCache?.['hero'];
      var mergedAnimations: Record<string, any[]> = {};
      if (existingHero && existingHero.animations) {
        for (var ek of Object.keys(existingHero.animations)) {
          mergedAnimations[ek] = existingHero.animations[ek];
        }
      }
      var newMappings = 0;
      for (var key of Object.keys(mapping)) {
        var sheetName = mapping[key];
        var sheet = this._cache.get(sheetName);
        if (!sheet || !sheet.animations) { console.warn('[Assets] setPlayerSprites: sheet not loaded:', sheetName); continue; }
        var animKeys = Object.keys(sheet.animations);
        if (animKeys.length > 0) {
          mergedAnimations[key] = sheet.animations[animKeys[0]];
          newMappings++;
          console.log('[Assets] setPlayerSprites: mapped', key, '←', sheetName, '(' + animKeys[0] + ',', mergedAnimations[key].length, 'frames)');
        }
      }
      if (newMappings === 0 && Object.keys(mergedAnimations).length > 0) {
        console.log('[Assets] setPlayerSprites: no new sheets loaded, keeping existing hero animations');
        return;
      }
      if (!mergedAnimations['idle']) { console.warn('[Assets] setPlayerSprites: no idle animation mapped'); return; }
      if (!mergedAnimations['walk']) mergedAnimations['walk'] = mergedAnimations['idle'];
      if (!mergedAnimations['jump']) mergedAnimations['jump'] = mergedAnimations['idle'];
      if (!mergedAnimations['fall']) mergedAnimations['fall'] = mergedAnimations['jump'];
      if (!mergedAnimations['run']) mergedAnimations['run'] = mergedAnimations['walk'];

      // Read frame dimensions from first texture for smart sizing
      var frameW = 128, frameH = 128;
      var firstAnim = mergedAnimations['idle'] || mergedAnimations['walk'];
      if (firstAnim && firstAnim[0]) {
        frameW = firstAnim[0].width || 128;
        frameH = firstAnim[0].height || 128;
      }

      // Use globally-registered setter (avoids esbuild module scope issue)
      var setter = (window as any).__vibexeSetHeroSheet;
      if (setter) { setter(mergedAnimations, frameW, frameH); }
      console.log('[Assets] setPlayerSprites: _sheetCache.hero set with', Object.keys(mergedAnimations).join(', '), 'frame:', frameW + 'x' + frameH);

      // Replace the player visual with an AnimatedSprite showing idle
      var playerFeature = this.engine.features.get('player-platformer');
      if (playerFeature && playerFeature.playerGfx) {
        var idleTextures = mergedAnimations['idle'];
        var newSprite = new PIXI.AnimatedSprite(idleTextures);
        newSprite.anchor.set(0.5, 1);
        newSprite.animationSpeed = 0.08;
        newSprite.play();
        var old = playerFeature.playerGfx;
        newSprite.x = old.x; newSprite.y = old.y;
        newSprite.width = old.width; newSprite.height = old.height;
        if (old.parent) {
          var idx = old.parent.getChildIndex(old);
          old.parent.addChildAt(newSprite, idx);
          old.parent.removeChild(old);
        }
        playerFeature.playerGfx = newSprite;
        console.log('[Assets] setPlayerSprites: player visual replaced with AnimatedSprite');
      } else {
        console.log('[Assets] setPlayerSprites: _sheetCache mapped (feature will use on next animation switch)');
      }
    } catch(e) {
      console.warn('[Assets] setPlayerSprites failed:', e);
    }
  }
}

// ---------------------------------------------------------------------------
// SpriteImportSystem — Plan 10: Bitmap Import + Sprite Sheet Workflow (engine.spriteImport.*)
// ---------------------------------------------------------------------------

type OriginPreset = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

class SpriteImportSystem {
  private engine: Engine2D;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /**
   * Import a sprite strip — split a single image into animation frames.
   * @param texture - PIXI.Texture (loaded image)
   * @param cols - Number of columns in the strip
   * @param rows - Number of rows (default 1 for horizontal strips)
   * @returns Array of PIXI.Texture frames
   */
  stripImport(texture: any, cols: number, rows = 1): any[] {
    var PIXI = (window as any).PIXI;
    var baseW = texture.width;
    var baseH = texture.height;
    var frameW = Math.floor(baseW / cols);
    var frameH = Math.floor(baseH / rows);
    var frames: any[] = [];

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        try {
          var rect = new PIXI.Rectangle(c * frameW, r * frameH, frameW, frameH);
          frames.push(new PIXI.Texture({ source: texture.source || texture, frame: rect }));
        } catch(e) {
          console.warn('[SpriteImport] Failed to cut frame at', c, r, e);
        }
      }
    }
    console.log('[SpriteImport] Strip import: ' + frames.length + ' frames (' + frameW + 'x' + frameH + ')');
    return frames;
  }

  /**
   * Auto-detect frame count from image dimensions.
   * Assumes square frames — returns { cols, rows, frameSize }.
   */
  autoDetect(texture: any): { cols: number; rows: number; frameSize: number } {
    var w = texture.width;
    var h = texture.height;

    // If wider than tall, assume horizontal strip with square frames
    if (w > h) {
      var frameSize = h;
      var cols = Math.round(w / frameSize);
      return { cols: cols, rows: 1, frameSize: frameSize };
    }
    // If taller than wide, vertical strip
    if (h > w) {
      var frameSize2 = w;
      var rows = Math.round(h / frameSize2);
      return { cols: 1, rows: rows, frameSize: frameSize2 };
    }
    // Square — single frame
    return { cols: 1, rows: 1, frameSize: w };
  }

  /**
   * Create an AnimatedSprite from a strip import.
   */
  createAnimated(texture: any, cols: number, rows = 1, speed = 0.15): any {
    var PIXI = (window as any).PIXI;
    var frames = this.stripImport(texture, cols, rows);
    if (frames.length === 0) return null;
    var anim = new PIXI.AnimatedSprite(frames);
    anim.anchor.set(0.5);
    anim.animationSpeed = speed;
    anim.play();
    return anim;
  }

  /**
   * Set sprite origin (anchor) from a preset name.
   */
  setOrigin(sprite: any, preset: OriginPreset): void {
    var origins: Record<string, [number, number]> = {
      'top-left':      [0, 0],
      'top-center':    [0.5, 0],
      'top-right':     [1, 0],
      'center-left':   [0, 0.5],
      'center':        [0.5, 0.5],
      'center-right':  [1, 0.5],
      'bottom-left':   [0, 1],
      'bottom-center': [0.5, 1],
      'bottom-right':  [1, 1],
    };
    var o = origins[preset] || origins['center'];
    if (sprite.anchor) sprite.anchor.set(o[0], o[1]);
  }

  /**
   * Auto-generate collision mask from sprite alpha channel.
   * Scans the texture to find the tight bounding box of non-transparent pixels.
   * @param texture - PIXI.Texture
   * @param tolerance - Alpha threshold 0-255 (default 128)
   * @returns CollisionMask with trimmed bounds
   */
  autoMask(texture: any, tolerance = 128): { offsetX: number; offsetY: number; width: number; height: number } {
    try {
      // Render texture to canvas and scan pixels
      var canvas = document.createElement('canvas');
      var w = texture.width;
      var h = texture.height;
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      if (!ctx) return { offsetX: 0, offsetY: 0, width: w, height: h };

      // Draw texture source to canvas
      var source = texture.source?.resource || texture.baseTexture?.resource?.source;
      if (!source) return { offsetX: 0, offsetY: 0, width: w, height: h };

      var frame = texture.frame || { x: 0, y: 0, width: w, height: h };
      ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, w, h);

      var imageData = ctx.getImageData(0, 0, w, h);
      var data = imageData.data;

      var minX = w, minY = h, maxX = 0, maxY = 0;
      for (var py = 0; py < h; py++) {
        for (var px = 0; px < w; px++) {
          var alpha = data[(py * w + px) * 4 + 3];
          if (alpha >= tolerance) {
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        }
      }

      if (maxX < minX) return { offsetX: 0, offsetY: 0, width: w, height: h }; // Fully transparent

      var maskW = maxX - minX + 1;
      var maskH = maxY - minY + 1;
      // Offset from center (assuming anchor 0.5, 0.5)
      var offsetX = minX + maskW / 2 - w / 2;
      var offsetY = minY + maskH / 2 - h / 2;

      return { offsetX: offsetX, offsetY: offsetY, width: maskW, height: maskH };
    } catch(e) {
      console.warn('[SpriteImport] autoMask failed:', e);
      return { offsetX: 0, offsetY: 0, width: texture.width || 32, height: texture.height || 32 };
    }
  }

  /**
   * Pack multiple textures into a single atlas (2048x2048 max).
   * Returns { atlas: PIXI.Texture, regions: Map<name, Rectangle> }
   */
  packAtlas(textures: Record<string, any>, maxSize = 2048): { canvas: HTMLCanvasElement; regions: Record<string, { x: number; y: number; w: number; h: number }> } {
    var entries = Object.entries(textures);
    // Sort by height descending for better packing
    entries.sort(function(a, b) { return (b[1].height || 0) - (a[1].height || 0); });

    var canvas = document.createElement('canvas');
    canvas.width = maxSize;
    canvas.height = maxSize;
    var ctx = canvas.getContext('2d')!;
    var regions: Record<string, { x: number; y: number; w: number; h: number }> = {};

    // Simple shelf packing algorithm
    var shelfY = 0;
    var shelfH = 0;
    var cursorX = 0;
    var padding = 2;

    for (var i = 0; i < entries.length; i++) {
      var name = entries[i][0];
      var tex = entries[i][1];
      var tw = tex.width || 32;
      var th = tex.height || 32;

      // New shelf if doesn't fit
      if (cursorX + tw + padding > maxSize) {
        shelfY += shelfH + padding;
        shelfH = 0;
        cursorX = 0;
      }

      // Overflow check
      if (shelfY + th > maxSize) {
        console.warn('[SpriteImport] Atlas overflow, skipping:', name);
        continue;
      }

      // Draw texture source to atlas canvas
      try {
        var source = tex.source?.resource || tex.baseTexture?.resource?.source;
        if (source) {
          var frame = tex.frame || { x: 0, y: 0, width: tw, height: th };
          ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, cursorX, shelfY, tw, th);
        }
      } catch(e) {}

      regions[name] = { x: cursorX, y: shelfY, w: tw, h: th };
      cursorX += tw + padding;
      if (th > shelfH) shelfH = th;
    }

    // Trim canvas height
    var usedH = shelfY + shelfH;
    if (usedH < maxSize) {
      var trimmed = document.createElement('canvas');
      trimmed.width = maxSize;
      trimmed.height = usedH;
      trimmed.getContext('2d')!.drawImage(canvas, 0, 0);
      canvas = trimmed;
    }

    console.log('[SpriteImport] Packed atlas: ' + entries.length + ' textures (' + maxSize + 'x' + usedH + ')');
    return { canvas: canvas, regions: regions };
  }
}

// ---------------------------------------------------------------------------
// FeatureManager — composable feature snippet runtime
// ---------------------------------------------------------------------------

interface FeatureEntry {
  runtime: any;       // FeatureRuntime instance
  config: Record<string, any>;
  dependencies: string[];
}

export class FeatureManager {
  private engine: Engine2D;
  private _features: Map<string, FeatureEntry> = new Map();
  private _initOrder: string[] = [];   // topologically sorted init order
  private _initialized = false;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /**
   * Register a feature snippet.
   * @param id        unique feature id (e.g. "double-jump")
   * @param factory   function(config) => FeatureRuntime
   * @param config    parameter values for this feature instance
   * @param deps      IDs of features this one depends on
   */
  register(id: string, factory: (config: Record<string, any>) => any, config: Record<string, any> = {}, deps: string[] = []): void {
    if (this._features.has(id)) {
      console.warn('[FeatureManager] Already registered:', id);
      return;
    }
    var runtime = factory(config);
    runtime.id = id;
    this._features.set(id, { runtime: runtime, config: config, dependencies: deps });

    // Late registration: if already initialized, init this feature immediately
    if (this._initialized) {
      var depsOk = true;
      for (var j = 0; j < deps.length; j++) {
        if (!this._features.has(deps[j])) {
          console.warn('[FeatureManager] Late register: missing dep', deps[j], 'for', id);
          depsOk = false;
        }
      }
      if (depsOk && runtime.init) {
        try {
          runtime.init(this.engine, config);
          this._initOrder.push(id);
          console.log('[FeatureManager] Late-initialized:', id);
        } catch(e) {
          console.warn('[FeatureManager] Late init error:', id, e);
        }
      }
    } else {
      this._initOrder = [];  // invalidate cached order
    }
  }

  /**
   * Initialize all registered features in dependency order.
   * Call once after all features are registered.
   */
  initAll(): void {
    if (this._initialized) return;
    this._resolveOrder();
    for (var i = 0; i < this._initOrder.length; i++) {
      var entry = this._features.get(this._initOrder[i]);
      if (entry && entry.runtime.init) {
        try {
          entry.runtime.init(this.engine, entry.config);
        } catch(e) {
          console.warn('[FeatureManager] init failed:', this._initOrder[i], e);
          entry.runtime.update = null;  // disable update for features that fail init
        }
      }
    }
    this._initialized = true;
    console.log('[FeatureManager] Initialized', this._initOrder.length, 'features:', this._initOrder.join(', '));
  }

  /** Called every frame by the engine game loop */
  updateAll(dt: number): void {
    if (!this._initialized) return;
    for (var i = 0; i < this._initOrder.length; i++) {
      var entry = this._features.get(this._initOrder[i]);
      if (entry && entry.runtime.update) {
        try {
          entry.runtime.update(this.engine, dt);
        } catch(e) {
          // Don't spam — log once then silence
          console.warn('[FeatureManager] update error:', this._initOrder[i], e);
          entry.runtime.update = null;  // disable broken updater
        }
      }
    }
  }

  /** Broadcast an event to all features */
  emit(event: string, data?: any): void {
    this._features.forEach(function(entry) {
      if (entry.runtime.onEvent) {
        try {
          entry.runtime.onEvent(event, data);
        } catch(e) {
          console.warn('[FeatureManager] event error:', entry.runtime.id, event, e);
        }
      }
    });
  }

  /** Check if a feature is registered */
  has(id: string): boolean {
    return this._features.has(id);
  }

  /** Get a feature runtime by id (for inter-feature communication) */
  get(id: string): any {
    var entry = this._features.get(id);
    return entry ? entry.runtime : null;
  }

  /** Number of registered features */
  get count(): number {
    return this._features.size;
  }

  /** Destroy all features in reverse init order */
  destroy(): void {
    for (var i = this._initOrder.length - 1; i >= 0; i--) {
      var entry = this._features.get(this._initOrder[i]);
      if (entry && entry.runtime.destroy) {
        try {
          entry.runtime.destroy();
        } catch(e) {
          console.warn('[FeatureManager] destroy error:', this._initOrder[i], e);
        }
      }
    }
    this._features.clear();
    this._initOrder = [];
    this._initialized = false;
  }

  /**
   * Topological sort — ensures dependencies init before dependents.
   * Detects circular dependencies and warns.
   */
  private _resolveOrder(): void {
    var visited: Set<string> = new Set();
    var visiting: Set<string> = new Set();  // cycle detection
    var order: string[] = [];
    var features = this._features;

    function visit(id: string): void {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        console.warn('[FeatureManager] Circular dependency detected at:', id);
        return;
      }
      visiting.add(id);
      var entry = features.get(id);
      if (entry) {
        for (var j = 0; j < entry.dependencies.length; j++) {
          var dep = entry.dependencies[j];
          if (features.has(dep)) {
            visit(dep);
          } else {
            console.warn('[FeatureManager] Missing dependency:', dep, 'required by', id);
          }
        }
      }
      visiting.delete(id);
      visited.add(id);
      order.push(id);
    }

    features.forEach(function(_entry, id) {
      visit(id);
    });

    this._initOrder = order;
  }
}

// ---------------------------------------------------------------------------
// PixiAdvancedSystem — engine.pixi.* namespace (PixiJS 8.x advanced features)
// ---------------------------------------------------------------------------

export class PixiAdvancedSystem {
  private engine: Engine2D;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  // --- Mesh ---

  /** Create a rope mesh from an array of points — chains, vines, tentacles */
  rope(points: {x: number; y: number}[], texture: any, config?: any): any {
    var pts = points.map(function(p) { return new PIXI.Point(p.x, p.y); });
    var mesh = new PIXI.MeshRope({ texture: texture, points: pts });
    if (config && config.textureScale) mesh.textureScale = config.textureScale;
    return mesh;
  }

  /** Create a plane mesh for deformation — water surfaces, flags, cloth */
  plane(texture: any, verticesX?: number, verticesY?: number): any {
    return new PIXI.MeshPlane({ texture: texture, verticesX: verticesX || 10, verticesY: verticesY || 10 });
  }

  // --- DisplacementFilter ---

  /** Apply displacement filter — heat shimmer, underwater distortion, portals */
  displacement(sprite: any, scaleX?: number, scaleY?: number, container?: any): any {
    var filter = new PIXI.DisplacementFilter({ sprite: sprite, scale: { x: scaleX || 20, y: scaleY || 20 } });
    var target = container || this.engine.world;
    var existing = target.filters ? Array.from(target.filters) : [];
    existing.push(filter);
    target.filters = existing;
    return { filter: filter, sprite: sprite };
  }

  /** Remove a displacement filter from a container */
  removeDisplacement(result: any, container?: any): void {
    var target = container || this.engine.world;
    if (target.filters) {
      var cur = Array.from(target.filters);
      var idx = cur.indexOf(result.filter);
      if (idx >= 0) { cur.splice(idx, 1); target.filters = cur; }
    }
  }

  // --- RenderTexture ---

  /** Create a render texture for offscreen rendering — minimaps, reflections, trails */
  renderTexture(width?: number, height?: number): any {
    var w = width || this.engine.config.width;
    var h = height || this.engine.config.height;
    return PIXI.RenderTexture.create({ width: w, height: h });
  }

  /** Render a display object into a render texture */
  renderTo(renderTexture: any, displayObject: any): void {
    this.engine.app.renderer.render({ container: displayObject, target: renderTexture });
  }

  // --- ParticleContainer ---

  /** Create a high-performance particle container — bullet hell, star fields (10-100x faster than Proton for simple sprites) */
  particleContainer(options?: any): any {
    return new PIXI.ParticleContainer({
      dynamicProperties: {
        position: true,
        scale: true,
        rotation: true,
        tint: true,
        ...(options || {})
      }
    });
  }

  // --- Masking ---

  /** Apply a sprite as a mask — fog of war, spotlight, reveal effects */
  spriteMask(target: any, maskSprite: any): void {
    target.mask = maskSprite;
  }

  /** Apply a graphics shape as a mask — circular viewport, terrain cutouts */
  graphicsMask(target: any, maskGraphics: any): void {
    target.mask = maskGraphics;
  }

  /** Remove mask from a display object */
  removeMask(target: any): void {
    target.mask = null;
  }

  // --- NineSliceSprite ---

  /** Create a nine-slice sprite — scalable UI panels, dialogue boxes, health bars */
  nineSlice(texture: any, left: number, top: number, right: number, bottom: number): any {
    return new PIXI.NineSliceSprite({
      texture: texture, leftWidth: left, topHeight: top, rightWidth: right, bottomHeight: bottom
    });
  }

  // --- BitmapText ---

  /** Create bitmap text — fast pre-rendered text for HUD/score (faster than PIXI.Text) */
  bitmapText(text: string, style?: any): any {
    var defaultStyle = {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xffffff,
      ...(style || {})
    };
    return new PIXI.BitmapText({ text: text, style: defaultStyle });
  }

  // --- Blend Modes ---

  /** Set blend mode — add (glow), multiply (shadow), screen (light) */
  blendMode(sprite: any, mode: string): void {
    var modes: Record<string, string> = {
      normal: 'normal', add: 'add', multiply: 'multiply',
      screen: 'screen', overlay: 'overlay', erase: 'erase',
    };
    sprite.blendMode = modes[mode] || mode;
  }

  // --- Video Texture ---

  /** Create a video texture — animated backgrounds, cutscenes, TV screen props */
  videoTexture(url: string, config?: any): any {
    var video = document.createElement('video');
    video.src = url;
    video.loop = (config && config.loop !== undefined) ? config.loop : true;
    video.muted = true;
    video.playsInline = true;
    if (!config || config.autoPlay !== false) video.play().catch(function() {});
    var texture = PIXI.Texture.from(video);
    return { texture: texture, video: video };
  }
}

// ---------------------------------------------------------------------------
// JuiceSystem — GSAP-powered game feel effects
// ---------------------------------------------------------------------------

export class JuiceSystem {
  private gsap: any = (window as any).gsap || null;
  private activeKillFns: (() => void)[] = [];

  /** Bounce scale up then back (e.g. coin collect, score change) */
  scalePop(obj: any, scale = 1.3, duration = 0.2): void {
    if (!this.gsap || !obj) return;
    this.gsap.to(obj.scale, {
      x: scale, y: scale, duration: duration * 0.4,
      ease: 'back.out(3)',
      onComplete: () => {
        this.gsap.to(obj.scale, { x: 1, y: 1, duration: duration * 0.6, ease: 'elastic.out(1, 0.4)' });
      }
    });
  }

  /** GSAP-powered camera shake — smooth decaying random offsets */
  screenShake(container: any, intensity = 8, duration = 0.3): void {
    if (!this.gsap || !container) return;
    var origX = container.x, origY = container.y;
    var tl = this.gsap.timeline();
    var steps = Math.ceil(duration / 0.03);
    for (var i = 0; i < steps; i++) {
      var t = i / steps;
      var decay = 1 - t;
      tl.to(container, {
        x: origX + (Math.random() - 0.5) * intensity * decay * 2,
        y: origY + (Math.random() - 0.5) * intensity * decay * 2,
        duration: 0.03, ease: 'none',
      });
    }
    tl.to(container, { x: origX, y: origY, duration: 0.05 });
  }

  /** Freeze the ticker briefly for impact feel */
  hitPause(app: any, ms = 80): void {
    if (!app || !app.ticker) return;
    app.ticker.stop();
    setTimeout(function() { app.ticker.start(); }, ms);
  }

  /** Flash a tint color then restore original */
  colorFlash(obj: any, color = 0xffffff, duration = 0.15): void {
    if (!obj) return;
    var origTint = obj.tint !== undefined ? obj.tint : 0xffffff;
    obj.tint = color;
    if (this.gsap) {
      this.gsap.delayedCall(duration, function() { obj.tint = origTint; });
    } else {
      setTimeout(function() { obj.tint = origTint; }, duration * 1000);
    }
  }

  /** Sine-wave bobbing (returns kill function). Use for floating coins, powerups. */
  float(obj: any, amplitude = 6, speed = 2): () => void {
    if (!this.gsap || !obj) return function(){};
    var baseY = obj.y;
    var tween = this.gsap.to(obj, {
      y: baseY - amplitude, duration: 1 / speed,
      ease: 'sine.inOut', yoyo: true, repeat: -1,
    });
    var kill = function() { tween.kill(); obj.y = baseY; };
    this.activeKillFns.push(kill);
    return kill;
  }

  /** Idle breathing pulse (returns kill function). */
  breathe(obj: any, scale = 1.05, speed = 1.5): () => void {
    if (!this.gsap || !obj) return function(){};
    var tween = this.gsap.to(obj.scale, {
      x: scale, y: scale, duration: 1 / speed,
      ease: 'sine.inOut', yoyo: true, repeat: -1,
    });
    var kill = function() { tween.kill(); obj.scale.set(1); };
    this.activeKillFns.push(kill);
    return kill;
  }

  /** Spring squash & stretch on landing */
  squashStretch(obj: any, squashY = 0.7, stretchY = 1.15): void {
    if (!this.gsap || !obj) return;
    this.gsap.timeline()
      .set(obj.scale, { y: squashY, x: 1 / squashY })
      .to(obj.scale, { y: stretchY, x: 1 / stretchY, duration: 0.1, ease: 'power2.out' })
      .to(obj.scale, { y: 1, x: 1, duration: 0.3, ease: 'elastic.out(1, 0.3)' });
  }

  /** Character-by-character text reveal */
  typewriter(textObj: any, text: string, speed = 0.04): void {
    if (!textObj) return;
    textObj.text = '';
    var idx = 0;
    var interval = setInterval(function() {
      if (idx >= text.length) { clearInterval(interval); return; }
      textObj.text += text[idx];
      idx++;
    }, speed * 1000);
  }

  // --- Clean API aliases (engine.juice.pop, engine.juice.shake, etc.) ---

  /** Alias: scalePop → pop */
  pop(obj: any, scale = 1.3, duration = 0.2): void { this.scalePop(obj, scale, duration); }

  /** Alias: screenShake → shake (takes container) */
  shake(container: any, intensity = 8, duration = 0.3): void { this.screenShake(container, intensity, duration); }

  /** Alias: colorFlash → flash */
  flash(obj: any, color = 0xffffff, duration = 0.15): void { this.colorFlash(obj, color, duration); }

  /** Alias: squashStretch → squash */
  squash(obj: any, squashY = 0.7, stretchY = 1.15): void { this.squashStretch(obj, squashY, stretchY); }

  /** Cleanup all active looping tweens */
  killAll(): void {
    for (var i = 0; i < this.activeKillFns.length; i++) {
      try { this.activeKillFns[i](); } catch(e) {}
    }
    this.activeKillFns = [];
    if (this.gsap) {
      try { this.gsap.killTweensOf('*'); } catch(e) {}
    }
  }
}

// ---------------------------------------------------------------------------
// AnimationSystem — Plan 5: Enhanced Animation (engine.anim.*)
// ---------------------------------------------------------------------------

type AnimLoopMode = 'once' | 'loop' | 'pingpong';

interface AnimState {
  name: string;
  frames: number[];           // Frame indices in the spritesheet
  speed: number;              // Frames per second
  loop: AnimLoopMode;
  next?: string;              // Auto-transition to this state on complete
  onEnter?: (sprite: any) => void;
  onExit?: (sprite: any) => void;
}

interface AnimInstance {
  sprite: any;
  states: Map<string, AnimState>;
  current: string;
  frameIndex: number;          // Fractional frame index (GM: image_index)
  speed: number;               // Current playback speed multiplier (GM: image_speed)
  direction: 1 | -1;           // 1 = forward, -1 = reverse (for pingpong)
  paused: boolean;
  onComplete?: (stateName: string) => void;
  onFrame?: (frameNumber: number) => void;
  _frameEvents: Map<number, () => void>; // Callbacks on specific frames
}

class AnimationSystem {
  private engine: Engine2D;
  private _instances: Map<any, AnimInstance> = new Map(); // keyed by sprite

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /**
   * Create a sprite state machine with named animation states.
   * @param sprite - PIXI.AnimatedSprite (must have textures array)
   * @param states - Map of state name → AnimState config
   * @param initial - Starting state name
   */
  create(sprite: any, states: Record<string, Partial<AnimState>>, initial?: string): AnimInstance {
    var stateMap = new Map<string, AnimState>();
    var firstState = '';

    for (var name in states) {
      if (!firstState) firstState = name;
      var s = states[name];
      stateMap.set(name, {
        name: name,
        frames: s.frames || [],
        speed: s.speed || 10,
        loop: s.loop || 'loop',
        next: s.next,
        onEnter: s.onEnter,
        onExit: s.onExit,
      });
    }

    var inst: AnimInstance = {
      sprite: sprite,
      states: stateMap,
      current: initial || firstState,
      frameIndex: 0,
      speed: 1,
      direction: 1,
      paused: false,
      _frameEvents: new Map(),
    };

    this._instances.set(sprite, inst);

    // Enter initial state
    var initState = stateMap.get(inst.current);
    if (initState && initState.onEnter) {
      try { initState.onEnter(sprite); } catch(e) {}
    }
    this._applyFrame(inst);

    return inst;
  }

  /**
   * Play a named animation state on a sprite.
   * If already playing, restarts from frame 0.
   */
  play(sprite: any, stateName: string, config?: { speed?: number; onComplete?: (s: string) => void }): void {
    var inst = this._instances.get(sprite);
    if (!inst) return;

    var state = inst.states.get(stateName);
    if (!state) {
      console.warn('[Anim] State not found:', stateName);
      return;
    }

    // Exit current state
    var current = inst.states.get(inst.current);
    if (current && current.onExit) {
      try { current.onExit(sprite); } catch(e) {}
    }

    inst.current = stateName;
    inst.frameIndex = 0;
    inst.direction = 1;
    inst.paused = false;
    if (config?.speed !== undefined) inst.speed = config.speed;
    if (config?.onComplete) inst.onComplete = config.onComplete;

    // Enter new state
    if (state.onEnter) {
      try { state.onEnter(sprite); } catch(e) {}
    }
    this._applyFrame(inst);
  }

  /** Pause/resume animation */
  pause(sprite: any): void {
    var inst = this._instances.get(sprite);
    if (inst) inst.paused = true;
  }

  resume(sprite: any): void {
    var inst = this._instances.get(sprite);
    if (inst) inst.paused = false;
  }

  /** Set playback speed multiplier */
  setSpeed(sprite: any, speed: number): void {
    var inst = this._instances.get(sprite);
    if (inst) inst.speed = speed;
  }

  /** Get current state name */
  getState(sprite: any): string | null {
    var inst = this._instances.get(sprite);
    return inst ? inst.current : null;
  }

  /** Get current frame index */
  getFrame(sprite: any): number {
    var inst = this._instances.get(sprite);
    return inst ? Math.floor(inst.frameIndex) : 0;
  }

  /** Register callback on specific frame number */
  onFrame(sprite: any, frameNumber: number, callback: () => void): void {
    var inst = this._instances.get(sprite);
    if (inst) inst._frameEvents.set(frameNumber, callback);
  }

  /** Remove animation tracking from a sprite */
  remove(sprite: any): void {
    this._instances.delete(sprite);
  }

  /** Update all animation instances — called from game loop */
  update(dt: number): void {
    this._instances.forEach(function(inst) {
      if (inst.paused) return;

      var state = inst.states.get(inst.current);
      if (!state || state.frames.length === 0) return;

      var prevFrame = Math.floor(inst.frameIndex);
      var frameCount = state.frames.length;

      // Advance frame index
      inst.frameIndex += state.speed * inst.speed * dt * inst.direction;

      var currentFrame = Math.floor(inst.frameIndex);

      // Check frame events
      if (currentFrame !== prevFrame && inst._frameEvents.has(currentFrame)) {
        try { inst._frameEvents.get(currentFrame)!(); } catch(e) {}
      }
      if (inst.onFrame && currentFrame !== prevFrame) {
        try { inst.onFrame(currentFrame); } catch(e) {}
      }

      // Handle end of animation
      if (inst.frameIndex >= frameCount || inst.frameIndex < 0) {
        switch (state.loop) {
          case 'loop':
            inst.frameIndex = inst.frameIndex % frameCount;
            if (inst.frameIndex < 0) inst.frameIndex += frameCount;
            break;

          case 'pingpong':
            inst.direction *= -1;
            if (inst.frameIndex >= frameCount) {
              inst.frameIndex = frameCount - 1;
            } else {
              inst.frameIndex = 0;
            }
            break;

          case 'once':
          default:
            inst.frameIndex = Math.max(0, frameCount - 1);
            inst.paused = true;

            // Fire completion callback
            if (inst.onComplete) {
              try { inst.onComplete(inst.current); } catch(e) {}
            }

            // Auto-transition to next state
            if (state.next && inst.states.has(state.next)) {
              var exitState = inst.states.get(inst.current);
              if (exitState && exitState.onExit) {
                try { exitState.onExit(inst.sprite); } catch(e) {}
              }
              inst.current = state.next;
              inst.frameIndex = 0;
              inst.direction = 1;
              inst.paused = false;
              var nextState = inst.states.get(state.next);
              if (nextState && nextState.onEnter) {
                try { nextState.onEnter(inst.sprite); } catch(e) {}
              }
            }
            break;
        }
      }

      // Apply frame to sprite
      try {
        var frameIdx = state.frames[Math.floor(Math.max(0, Math.min(inst.frameIndex, frameCount - 1)))];
        if (inst.sprite.textures && inst.sprite.textures[frameIdx]) {
          inst.sprite.texture = inst.sprite.textures[frameIdx];
        } else if (typeof inst.sprite.gotoAndStop === 'function') {
          inst.sprite.gotoAndStop(frameIdx);
        }
      } catch(e) {}
    });
  }

  /** Clear all animation instances */
  clear(): void {
    this._instances.clear();
  }

  private _applyFrame(inst: AnimInstance): void {
    var state = inst.states.get(inst.current);
    if (!state || state.frames.length === 0) return;
    try {
      var frameIdx = state.frames[0];
      if (inst.sprite.textures && inst.sprite.textures[frameIdx]) {
        inst.sprite.texture = inst.sprite.textures[frameIdx];
      } else if (typeof inst.sprite.gotoAndStop === 'function') {
        inst.sprite.gotoAndStop(frameIdx);
      }
    } catch(e) {}
  }
}

// ---------------------------------------------------------------------------
// InstanceSystem — Plan 6: GameMaker-style instance variables (engine.instances.*)
// ---------------------------------------------------------------------------

interface InstanceVars {
  sprite: any;
  // Position
  x: number; y: number;
  xprevious: number; yprevious: number;
  xstart: number; ystart: number;
  // Velocity (GM: speed/direction → hspeed/vspeed)
  speed: number; direction: number;
  hspeed: number; vspeed: number;
  // Physics
  gravity: number; gravity_direction: number; friction: number;
  // Image
  image_index: number; image_speed: number;
  image_alpha: number; image_blend: number;
  image_xscale: number; image_yscale: number; image_angle: number;
  // Alarms (12 countdown timers)
  alarm: number[];
  _alarmCallbacks: ((() => void) | null)[];
  // Tags
  tag: string;
  // Built-in
  score: number; lives: number; health: number;
}

class InstanceSystem {
  private engine: Engine2D;
  private _instances: Map<any, InstanceVars> = new Map();

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /**
   * Register a sprite as a managed instance with GM-style variables.
   * Returns the instance vars object (modify directly).
   */
  create(sprite: any, config: Partial<InstanceVars> = {}): InstanceVars {
    var vars: InstanceVars = {
      sprite: sprite,
      x: sprite.x || 0, y: sprite.y || 0,
      xprevious: sprite.x || 0, yprevious: sprite.y || 0,
      xstart: sprite.x || 0, ystart: sprite.y || 0,
      speed: config.speed || 0,
      direction: config.direction || 0,
      hspeed: config.hspeed || 0,
      vspeed: config.vspeed || 0,
      gravity: config.gravity || 0,
      gravity_direction: config.gravity_direction || 270, // Down
      friction: config.friction || 0,
      image_index: 0, image_speed: config.image_speed || 1,
      image_alpha: config.image_alpha ?? 1,
      image_blend: config.image_blend ?? 0xffffff,
      image_xscale: config.image_xscale ?? 1,
      image_yscale: config.image_yscale ?? 1,
      image_angle: config.image_angle || 0,
      alarm: new Array(12).fill(-1),
      _alarmCallbacks: new Array(12).fill(null),
      tag: config.tag || '',
      score: 0, lives: config.lives ?? 3, health: config.health ?? 100,
    };

    // Sync speed/direction to hspeed/vspeed
    if (config.speed && config.direction !== undefined) {
      var rad = config.direction * Math.PI / 180;
      vars.hspeed = config.speed * Math.cos(rad);
      vars.vspeed = -config.speed * Math.sin(rad);
    }

    this._instances.set(sprite, vars);
    return vars;
  }

  /** Get instance vars for a sprite */
  get(sprite: any): InstanceVars | undefined {
    return this._instances.get(sprite);
  }

  /** Set an alarm timer. Counts down each frame, fires callback at 0. */
  setAlarm(sprite: any, index: number, frames: number, callback: () => void): void {
    var inst = this._instances.get(sprite);
    if (!inst || index < 0 || index >= 12) return;
    inst.alarm[index] = frames;
    inst._alarmCallbacks[index] = callback;
  }

  /** Cancel an alarm */
  clearAlarm(sprite: any, index: number): void {
    var inst = this._instances.get(sprite);
    if (!inst || index < 0 || index >= 12) return;
    inst.alarm[index] = -1;
    inst._alarmCallbacks[index] = null;
  }

  /** Remove an instance from tracking */
  remove(sprite: any): void {
    this._instances.delete(sprite);
  }

  /** Get all instances with a given tag */
  findByTag(tag: string): InstanceVars[] {
    var result: InstanceVars[] = [];
    this._instances.forEach(function(inst) {
      if (inst.tag === tag) result.push(inst);
    });
    return result;
  }

  /** Update all instances — GM automatic motion + alarm countdown */
  update(dt: number): void {
    var fps60dt = dt * 60; // Normalize to ~60fps steps like GM
    this._instances.forEach(function(inst) {
      // Store previous position
      inst.xprevious = inst.x;
      inst.yprevious = inst.y;

      // Apply gravity
      if (inst.gravity !== 0) {
        var grad = inst.gravity_direction * Math.PI / 180;
        inst.hspeed += inst.gravity * Math.cos(grad) * fps60dt;
        inst.vspeed += -inst.gravity * Math.sin(grad) * fps60dt;
      }

      // Apply friction
      if (inst.friction > 0) {
        var spd = Math.sqrt(inst.hspeed * inst.hspeed + inst.vspeed * inst.vspeed);
        if (spd > 0) {
          var newSpd = Math.max(0, spd * (1 - inst.friction * fps60dt));
          var ratio = newSpd / spd;
          inst.hspeed *= ratio;
          inst.vspeed *= ratio;
        }
      }

      // Apply velocity
      inst.x += inst.hspeed * fps60dt;
      inst.y += inst.vspeed * fps60dt;

      // Sync speed/direction from hspeed/vspeed
      inst.speed = Math.sqrt(inst.hspeed * inst.hspeed + inst.vspeed * inst.vspeed);
      if (inst.speed > 0.001) {
        inst.direction = Math.atan2(-inst.vspeed, inst.hspeed) * 180 / Math.PI;
        if (inst.direction < 0) inst.direction += 360;
      }

      // Apply image properties to sprite
      var spr = inst.sprite;
      if (spr) {
        spr.x = inst.x;
        spr.y = inst.y;
        spr.alpha = inst.image_alpha;
        spr.rotation = inst.image_angle * Math.PI / 180;
        if (spr.scale) {
          spr.scale.x = inst.image_xscale;
          spr.scale.y = inst.image_yscale;
        }
        if (inst.image_blend !== 0xffffff) spr.tint = inst.image_blend;
      }

      // Update alarms
      for (var a = 0; a < 12; a++) {
        if (inst.alarm[a] > 0) {
          inst.alarm[a] -= fps60dt;
          if (inst.alarm[a] <= 0) {
            inst.alarm[a] = -1;
            if (inst._alarmCallbacks[a]) {
              try { inst._alarmCallbacks[a]!(); } catch(e) {}
            }
          }
        }
      }
    });
  }

  /** Clear all instances */
  clear(): void {
    this._instances.clear();
  }

  /** Count of tracked instances */
  count(): number {
    return this._instances.size;
  }
}

// ---------------------------------------------------------------------------
// SurfaceSystem — Plan 7: Off-screen render targets (engine.surface.*)
// ---------------------------------------------------------------------------

class SurfaceSystem {
  private engine: Engine2D;
  private _surfaces: Map<string, any> = new Map();

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Create an off-screen render texture surface */
  create(name: string, width: number, height: number): any {
    var PIXI = (window as any).PIXI;
    var renderTexture = PIXI.RenderTexture.create({ width: width, height: height });
    var sprite = new PIXI.Sprite(renderTexture);
    this._surfaces.set(name, { texture: renderTexture, sprite: sprite, width: width, height: height });
    return { texture: renderTexture, sprite: sprite };
  }

  /** Render a container/sprite onto a surface */
  drawTo(name: string, displayObject: any, clear = true): void {
    var surf = this._surfaces.get(name);
    if (!surf || !this.engine.app?.renderer) return;
    if (clear) this.engine.app.renderer.render({ container: displayObject, target: surf.texture, clear: true });
    else this.engine.app.renderer.render({ container: displayObject, target: surf.texture, clear: false });
  }

  /** Get the surface's sprite (to add to stage) */
  getSprite(name: string): any {
    var surf = this._surfaces.get(name);
    return surf ? surf.sprite : null;
  }

  /** Get the surface's render texture (for filters, masking) */
  getTexture(name: string): any {
    var surf = this._surfaces.get(name);
    return surf ? surf.texture : null;
  }

  /** Resize a surface */
  resize(name: string, width: number, height: number): void {
    var surf = this._surfaces.get(name);
    if (surf) surf.texture.resize(width, height);
  }

  /** Destroy a surface */
  remove(name: string): void {
    var surf = this._surfaces.get(name);
    if (!surf) return;
    surf.texture.destroy(true);
    this._surfaces.delete(name);
  }

  /** Clear all surfaces */
  clear(): void {
    var self = this;
    this._surfaces.forEach(function(surf) {
      try { surf.texture.destroy(true); } catch(e) {}
    });
    this._surfaces.clear();
  }

  /** List surface names */
  list(): string[] {
    return Array.from(this._surfaces.keys());
  }
}

// ---------------------------------------------------------------------------
// CollisionMaskSystem — Plan 8: Collision shapes (engine.collision.*)
// ---------------------------------------------------------------------------

type MaskType = 'rectangle' | 'ellipse' | 'diamond' | 'precise';

interface CollisionMask {
  type: MaskType;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  tolerance?: number;  // Alpha threshold for precise mode (0-255)
}

class CollisionMaskSystem {
  private engine: Engine2D;
  private _masks: Map<any, CollisionMask> = new Map();

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Set collision mask for a sprite */
  setMask(sprite: any, type: MaskType, config: Partial<CollisionMask> = {}): void {
    this._masks.set(sprite, {
      type: type,
      offsetX: config.offsetX || 0,
      offsetY: config.offsetY || 0,
      width: config.width || (sprite.width || 32),
      height: config.height || (sprite.height || 32),
      tolerance: config.tolerance ?? 128,
    });
  }

  /** Get collision mask for a sprite */
  getMask(sprite: any): CollisionMask | undefined {
    return this._masks.get(sprite);
  }

  /** Remove collision mask */
  removeMask(sprite: any): void {
    this._masks.delete(sprite);
  }

  /** Check if two sprites overlap based on their collision masks */
  check(a: any, b: any): boolean {
    var maskA = this._masks.get(a) || this._defaultMask(a);
    var maskB = this._masks.get(b) || this._defaultMask(b);
    var ax = a.x + maskA.offsetX;
    var ay = a.y + maskA.offsetY;
    var bx = b.x + maskB.offsetX;
    var by = b.y + maskB.offsetY;

    // Both rectangle → AABB
    if (maskA.type === 'rectangle' && maskB.type === 'rectangle') {
      return this._aabb(ax, ay, maskA.width, maskA.height, bx, by, maskB.width, maskB.height);
    }

    // Both ellipse → ellipse-ellipse
    if (maskA.type === 'ellipse' && maskB.type === 'ellipse') {
      return this._ellipseOverlap(ax, ay, maskA.width / 2, maskA.height / 2, bx, by, maskB.width / 2, maskB.height / 2);
    }

    // Diamond → rotated AABB (simplified as center distance check)
    if (maskA.type === 'diamond' || maskB.type === 'diamond') {
      return this._diamondCheck(ax, ay, maskA, bx, by, maskB);
    }

    // Fallback: AABB
    return this._aabb(ax, ay, maskA.width, maskA.height, bx, by, maskB.width, maskB.height);
  }

  /**
   * Check collision at a specific position (sliding collision pattern).
   * Tests if placing sprite at (testX, testY) would collide with any tagged bodies.
   */
  collisionAt(sprite: any, testX: number, testY: number, targetTag: string): boolean {
    var mask = this._masks.get(sprite) || this._defaultMask(sprite);
    var hw = mask.width / 2;
    var hh = mask.height / 2;
    var ax = testX + mask.offsetX;
    var ay = testY + mask.offsetY;

    // Check against all physics bodies with matching tag
    var bodies = this.engine.physics.bodies;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (!b.enabled || b.tag !== targetTag) continue;
      if (this._aabb(ax, ay, mask.width, mask.height, b.x, b.y, b.hw * 2, b.hh * 2)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Sliding collision resolve — Hero's Trail pattern.
   * Tries X first, then Y, then both. Returns resolved {x, y}.
   */
  slideResolve(sprite: any, newX: number, newY: number, targetTag: string): { x: number; y: number } {
    var inst = this.engine.instances.get(sprite);
    var prevX = inst ? inst.xprevious : sprite.x;
    var prevY = inst ? inst.yprevious : sprite.y;

    // Try new position
    if (!this.collisionAt(sprite, newX, newY, targetTag)) {
      return { x: newX, y: newY };
    }
    // Try X only
    if (!this.collisionAt(sprite, newX, prevY, targetTag)) {
      return { x: newX, y: prevY };
    }
    // Try Y only
    if (!this.collisionAt(sprite, prevX, newY, targetTag)) {
      return { x: prevX, y: newY };
    }
    // Both blocked — stay at previous
    return { x: prevX, y: prevY };
  }

  /** Clear all masks */
  clear(): void {
    this._masks.clear();
  }

  private _defaultMask(sprite: any): CollisionMask {
    return { type: 'rectangle', offsetX: 0, offsetY: 0, width: sprite.width || 32, height: sprite.height || 32 };
  }

  private _aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
    return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
  }

  private _ellipseOverlap(ax: number, ay: number, arx: number, ary: number, bx: number, by: number, brx: number, bry: number): boolean {
    var dx = (ax - bx) / (arx + brx);
    var dy = (ay - by) / (ary + bry);
    return dx * dx + dy * dy <= 1;
  }

  private _diamondCheck(ax: number, ay: number, maskA: CollisionMask, bx: number, by: number, maskB: CollisionMask): boolean {
    // Diamond = 45° rotated rectangle → Manhattan distance check
    var dx = Math.abs(ax - bx);
    var dy = Math.abs(ay - by);
    var sizeA = (maskA.type === 'diamond') ? (maskA.width + maskA.height) / 4 : (maskA.width + maskA.height) / 4;
    var sizeB = (maskB.type === 'diamond') ? (maskB.width + maskB.height) / 4 : (maskB.width + maskB.height) / 4;
    return dx + dy < sizeA + sizeB;
  }
}

// ---------------------------------------------------------------------------
// ObjectEventSystem — Plan 9: Enhanced object events (engine.objectEvents.*)
// ---------------------------------------------------------------------------

class ObjectEventSystem {
  private engine: Engine2D;
  private _objects: Map<any, ObjectEventEntry> = new Map();
  private _collisionPairs: Array<{ tagA: string; tagB: string; callback: (a: any, b: any) => void }> = [];
  private _roomCallbacks: { start: Array<() => void>; end: Array<() => void> } = { start: [], end: [] };

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /**
   * Register an object with lifecycle events.
   */
  register(sprite: any, events: {
    create?: (spr: any) => void;
    stepBegin?: (spr: any, dt: number) => void;
    step?: (spr: any, dt: number) => void;
    stepEnd?: (spr: any, dt: number) => void;
    draw?: (spr: any) => void;
    drawGUI?: (spr: any) => void;
    animationEnd?: (spr: any) => void;
    mouseEnter?: (spr: any) => void;
    mouseLeave?: (spr: any) => void;
    mouseClick?: (spr: any) => void;
    destroy?: (spr: any) => void;
  }): void {
    var entry: ObjectEventEntry = {
      sprite: sprite,
      events: events,
      _mouseOver: false,
    };
    this._objects.set(sprite, entry);

    // Fire create event immediately
    if (events.create) {
      try { events.create(sprite); } catch(e) {}
    }

    // Set up mouse tracking if needed
    if (events.mouseEnter || events.mouseLeave || events.mouseClick) {
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      if (events.mouseClick) {
        sprite.on('pointerdown', function() {
          try { events.mouseClick!(sprite); } catch(e) {}
        });
      }
    }
  }

  /** Register collision event between two tags */
  onCollision(tagA: string, tagB: string, callback: (a: any, b: any) => void): void {
    this._collisionPairs.push({ tagA: tagA, tagB: tagB, callback: callback });
  }

  /** Register room start/end events */
  onRoomStart(callback: () => void): void { this._roomCallbacks.start.push(callback); }
  onRoomEnd(callback: () => void): void { this._roomCallbacks.end.push(callback); }

  /** Fire room start events (call when switching scenes) */
  fireRoomStart(): void {
    for (var i = 0; i < this._roomCallbacks.start.length; i++) {
      try { this._roomCallbacks.start[i](); } catch(e) {}
    }
  }

  /** Fire room end events */
  fireRoomEnd(): void {
    for (var i = 0; i < this._roomCallbacks.end.length; i++) {
      try { this._roomCallbacks.end[i](); } catch(e) {}
    }
  }

  /** Unregister an object */
  remove(sprite: any): void {
    var entry = this._objects.get(sprite);
    if (entry && entry.events.destroy) {
      try { entry.events.destroy(sprite); } catch(e) {}
    }
    this._objects.delete(sprite);
  }

  /** Update all object events — called from game loop */
  update(dt: number): void {
    var self = this;
    var pointer = this.engine.input;
    var camX = this.engine.camera.x;
    var camY = this.engine.camera.y;

    this._objects.forEach(function(entry) {
      var spr = entry.sprite;
      var ev = entry.events;

      // Step Begin
      if (ev.stepBegin) { try { ev.stepBegin(spr, dt); } catch(e) {} }

      // Step
      if (ev.step) { try { ev.step(spr, dt); } catch(e) {} }

      // Mouse Enter/Leave (check pointer against sprite bounds)
      if (ev.mouseEnter || ev.mouseLeave) {
        var mx = (pointer as any)._pointerX;
        var my = (pointer as any)._pointerY;
        if (mx !== undefined && my !== undefined) {
          var wx = mx + camX;
          var wy = my + camY;
          var hw = (spr.width || 32) / 2;
          var hh = (spr.height || 32) / 2;
          var inside = wx >= spr.x - hw && wx <= spr.x + hw && wy >= spr.y - hh && wy <= spr.y + hh;
          if (inside && !entry._mouseOver) {
            entry._mouseOver = true;
            if (ev.mouseEnter) { try { ev.mouseEnter(spr); } catch(e) {} }
          } else if (!inside && entry._mouseOver) {
            entry._mouseOver = false;
            if (ev.mouseLeave) { try { ev.mouseLeave(spr); } catch(e) {} }
          }
        }
      }

      // Step End
      if (ev.stepEnd) { try { ev.stepEnd(spr, dt); } catch(e) {} }
    });

    // Check collision pairs
    if (this._collisionPairs.length > 0) {
      var instances = this.engine.instances;
      for (var cp = 0; cp < this._collisionPairs.length; cp++) {
        var pair = this._collisionPairs[cp];
        var groupA = instances.findByTag(pair.tagA);
        var groupB = instances.findByTag(pair.tagB);
        for (var ai = 0; ai < groupA.length; ai++) {
          for (var bi = 0; bi < groupB.length; bi++) {
            if (this.engine.collision.check(groupA[ai].sprite, groupB[bi].sprite)) {
              try { pair.callback(groupA[ai].sprite, groupB[bi].sprite); } catch(e) {}
            }
          }
        }
      }
    }
  }

  /** Clear all registered objects and events */
  clear(): void {
    this._objects.clear();
    this._collisionPairs = [];
    this._roomCallbacks = { start: [], end: [] };
  }
}

interface ObjectEventEntry {
  sprite: any;
  events: any;
  _mouseOver: boolean;
}

// ---------------------------------------------------------------------------
// EasingSystem — 30 GameMaker-ported easing curves (engine.ease.*)
// ---------------------------------------------------------------------------

export class EasingSystem {
  /** Linear (no easing) */
  linear(t: number): number { return t; }

  // --- Quadratic ---
  easeIn(t: number): number { return t * t; }
  easeOut(t: number): number { return t * (2 - t); }
  easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  // --- Cubic ---
  easeCubicIn(t: number): number { return t * t * t; }
  easeCubicOut(t: number): number { var u = t - 1; return u * u * u + 1; }
  easeCubicInOut(t: number): number { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; }

  // --- Quartic ---
  easeQuartIn(t: number): number { return t * t * t * t; }
  easeQuartOut(t: number): number { var u = t - 1; return 1 - u * u * u * u; }
  easeQuartInOut(t: number): number { var u = t - 1; return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * u * u * u * u; }

  // --- Exponential ---
  easeExpoIn(t: number): number { return t === 0 ? 0 : Math.pow(2, 10 * (t - 1)); }
  easeExpoOut(t: number): number { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  easeExpoInOut(t: number): number { if (t === 0 || t === 1) return t; return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2; }

  // --- Circular ---
  easeCircIn(t: number): number { return 1 - Math.sqrt(1 - t * t); }
  easeCircOut(t: number): number { return Math.sqrt(1 - (t - 1) * (t - 1)); }
  easeCircInOut(t: number): number { return t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - (2 * t - 2) * (2 * t - 2)) + 1) / 2; }

  // --- Back (overshoot) ---
  easeBackIn(t: number): number { var s = 1.70158; return t * t * ((s + 1) * t - s); }
  easeBackOut(t: number): number { var s = 1.70158; t -= 1; return t * t * ((s + 1) * t + s) + 1; }
  easeBackInOut(t: number): number { var s = 1.70158 * 1.525; t *= 2; if (t < 1) return (t * t * ((s + 1) * t - s)) / 2; t -= 2; return (t * t * ((s + 1) * t + s) + 2) / 2; }

  // --- Elastic ---
  elasticIn(t: number): number { if (t === 0 || t === 1) return t; return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI); }
  elasticOut(t: number): number { if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1; }
  elasticInOut(t: number): number { if (t === 0 || t === 1) return t; t *= 2; if (t < 1) return -0.5 * Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI); return Math.pow(2, -10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI) * 0.5 + 1; }

  // --- Bounce ---
  bounceOut(t: number): number { if (t < 1 / 2.75) return 7.5625 * t * t; if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; } if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; } t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375; }
  bounceIn(t: number): number { return 1 - this.bounceOut(1 - t); }
  bounceInOut(t: number): number { return t < 0.5 ? this.bounceIn(t * 2) * 0.5 : this.bounceOut(t * 2 - 1) * 0.5 + 0.5; }

  // --- Special (GM-specific) ---
  fastOutSlowIn(t: number): number { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; }
  slowMiddle(t: number): number { return 3 * t * t - 2 * t * t * t; }

  /** Get easing function by name string. Returns linear if not found. */
  get(name: string): (t: number) => number {
    var fn = (this as any)[name];
    return fn ? fn.bind(this) : this.linear;
  }

  /** Interpolate between two values: engine.ease.lerp(0, 100, t, 'easeOutCubic') */
  lerp(from: number, to: number, t: number, easeFn?: string | ((t: number) => number)): number {
    var fn = typeof easeFn === 'string' ? this.get(easeFn) : (easeFn || this.linear);
    return from + (to - from) * fn(Math.max(0, Math.min(1, t)));
  }

  /** Tween helper: animate a property over time using requestAnimationFrame.
   *  Returns a cancel function. */
  tween(obj: any, prop: string, from: number, to: number, duration: number, easeFn?: string, onDone?: () => void): () => void {
    var fn = typeof easeFn === 'string' ? this.get(easeFn) : (easeFn ? easeFn as any : this.linear);
    var start = performance.now();
    var cancelled = false;
    var step = function() {
      if (cancelled) return;
      var elapsed = (performance.now() - start) / 1000;
      var t = Math.min(elapsed / duration, 1);
      try { obj[prop] = from + (to - from) * fn(t); } catch(e) {}
      if (t < 1) requestAnimationFrame(step);
      else if (onDone) try { onDone(); } catch(e) {}
    };
    requestAnimationFrame(step);
    return function() { cancelled = true; };
  }
}

// ---------------------------------------------------------------------------
// ParticleSystem — GameMaker-style preset + custom particle emitters (engine.particles.*)
// ---------------------------------------------------------------------------

export class ParticleSystem {
  private engine: Engine2D;
  private _emitters: any[] = [];
  private _pool: any[] = [];         // Emitter object pool (recycled emitters)
  private _textures: Map<string, any> = new Map();  // Generated particle textures

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  // ---- Particle Texture System (14 GM built-in shapes) ----

  /** Get or generate a particle texture by name. All 14 GM built-in shapes available. */
  getTexture(name: string): any {
    if (this._textures.has(name)) return this._textures.get(name);
    var tex = this._generateTexture(name);
    if (tex) this._textures.set(name, tex);
    return tex;
  }

  /** Generate all 14 particle textures (call once at init if desired) */
  generateAllTextures(): void {
    var names = ['circle', 'cloud', 'disk', 'explosion', 'flare', 'line', 'pixel', 'ring', 'smoke', 'snow', 'spark', 'sphere', 'square', 'star'];
    for (var i = 0; i < names.length; i++) this.getTexture(names[i]);
  }

  /** List available texture names */
  textureNames(): string[] {
    return ['circle', 'cloud', 'disk', 'explosion', 'flare', 'line', 'pixel', 'ring', 'smoke', 'snow', 'spark', 'sphere', 'square', 'star'];
  }

  private _generateTexture(name: string): any {
    var size = 32;
    var canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var cx = size / 2, cy = size / 2, r = size / 2 - 1;

    switch (name) {
      case 'circle': {
        var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
        break;
      }
      case 'cloud': {
        ctx.globalAlpha = 0.7;
        var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        cg.addColorStop(0, 'rgba(255,255,255,0.8)');
        cg.addColorStop(0.4, 'rgba(255,255,255,0.4)');
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.ellipse(cx, cy * 0.9, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx * 0.7, cy, r * 0.6, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx * 1.3, cy * 0.8, r * 0.5, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'disk': {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'explosion': {
        var eg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        eg.addColorStop(0, 'rgba(255,255,200,1)');
        eg.addColorStop(0.3, 'rgba(255,180,50,0.8)');
        eg.addColorStop(0.6, 'rgba(255,80,0,0.4)');
        eg.addColorStop(1, 'rgba(100,0,0,0)');
        ctx.fillStyle = eg; ctx.fillRect(0, 0, size, size);
        break;
      }
      case 'flare': {
        var fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        fg.addColorStop(0, 'rgba(255,255,255,1)');
        fg.addColorStop(0.15, 'rgba(255,255,200,0.8)');
        fg.addColorStop(0.4, 'rgba(255,200,100,0.3)');
        fg.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = fg; ctx.fillRect(0, 0, size, size);
        // Cross flare lines
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(size, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, size); ctx.stroke();
        break;
      }
      case 'line': {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, 2); ctx.lineTo(cx, size - 2); ctx.stroke();
        break;
      }
      case 'pixel': {
        canvas.width = 4; canvas.height = 4;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 4, 4);
        break;
      }
      case 'ring': {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'smoke': {
        var sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        sg.addColorStop(0, 'rgba(200,200,200,0.6)');
        sg.addColorStop(0.5, 'rgba(150,150,150,0.3)');
        sg.addColorStop(1, 'rgba(100,100,100,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, size, size);
        break;
      }
      case 'snow': {
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        for (var a = 0; a < 6; a++) {
          var ang = a * Math.PI / 3;
          ctx.beginPath(); ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(ang) * r * 0.8, cy + Math.sin(ang) * r * 0.8); ctx.stroke();
        }
        break;
      }
      case 'spark': {
        var spg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.3);
        spg.addColorStop(0, 'rgba(255,255,255,1)');
        spg.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = spg; ctx.fillRect(0, 0, size, size);
        break;
      }
      case 'sphere': {
        var shg = ctx.createRadialGradient(cx * 0.7, cy * 0.7, r * 0.1, cx, cy, r);
        shg.addColorStop(0, 'rgba(255,255,255,1)');
        shg.addColorStop(0.5, 'rgba(200,200,255,0.7)');
        shg.addColorStop(1, 'rgba(100,100,200,0)');
        ctx.fillStyle = shg;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'square': {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2, 2, size - 4, size - 4);
        break;
      }
      case 'star': {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (var si = 0; si < 5; si++) {
          var outerA = (si * 2 * Math.PI / 5) - Math.PI / 2;
          var innerA = outerA + Math.PI / 5;
          if (si === 0) ctx.moveTo(cx + Math.cos(outerA) * r, cy + Math.sin(outerA) * r);
          else ctx.lineTo(cx + Math.cos(outerA) * r, cy + Math.sin(outerA) * r);
          ctx.lineTo(cx + Math.cos(innerA) * r * 0.4, cy + Math.sin(innerA) * r * 0.4);
        }
        ctx.closePath(); ctx.fill();
        break;
      }
      default: return null;
    }
    // Convert canvas to PIXI texture
    return PIXI.Texture.from(canvas);
  }

  /** Emit a named preset at position. Returns the emitter (continuous) or void (burst). */
  emit(preset: string, x: number, y: number, config?: any): any {
    var fn = (this as any)['_p_' + preset];
    if (fn) return fn.call(this, x, y, config || {});
    console.warn('[Particles] Unknown preset: ' + preset + '. Available: fire, rain, smoke, sparks, electricity, embers, embers2, flameIntensity, smoke2, warpCenter, warpLines, confetti, blood, hearts');
    return null;
  }

  /** Stop and remove an emitter */
  stop(emitter: any): void {
    if (!emitter) return;
    try { emitter.stop(); } catch(e) {}
    try { this.engine.proton.removeEmitter(emitter); } catch(e) {}
    var idx = this._emitters.indexOf(emitter);
    if (idx >= 0) this._emitters.splice(idx, 1);
    // Recycle to pool instead of destroying (object pooling)
    try {
      emitter.removeAllBehaviours(); emitter.removeAllInitializers();
      emitter.rate = new Proton.Rate(0);
      this._pool.push(emitter);
    } catch(e) {
      try { emitter.destroy(); } catch(e2) {}
    }
  }

  /** Get all active emitters */
  list(): any[] { return this._emitters.slice(); }

  /** Clear all particle emitters */
  clear(): void {
    for (var i = this._emitters.length - 1; i >= 0; i--) {
      try { this._emitters[i].stop(); this.engine.proton.removeEmitter(this._emitters[i]); } catch(e) {}
      // Pool recycling
      try {
        this._emitters[i].removeAllBehaviours(); this._emitters[i].removeAllInitializers();
        this._pool.push(this._emitters[i]);
      } catch(e) {
        try { this._emitters[i].destroy(); } catch(e2) {}
      }
    }
    this._emitters = [];
  }

  /** Get a recycled emitter from pool, or create new */
  private _getEmitter(): any {
    if (this._pool.length > 0) {
      var em = this._pool.pop();
      em.removeAllBehaviours(); em.removeAllInitializers();
      return em;
    }
    return new Proton.Emitter();
  }

  private _add(emitter: any): any {
    this.engine.proton.addEmitter(emitter);
    this._emitters.push(emitter);
    return emitter;
  }

  private _burst(emitter: any, ms = 800): void {
    this._add(emitter);
    var self = this;
    setTimeout(function() { self.stop(emitter); }, ms);
  }

  /** Apply additive blend mode to particles in an emitter */
  private _setBlend(emitter: any, additive: boolean): void {
    if (!additive) return;
    // Hook into Proton's particle create event to set blend mode on each sprite
    emitter.addEventListener('PARTICLE_CREATED', function(p: any) {
      try {
        if (p && p.body) p.body.blendMode = 'add';
        if (p && p.sprite) p.sprite.blendMode = 'add';
      } catch(e) {}
    });
    // Also set on the renderer's particle creation
    (emitter as any)._vibexeAdditive = true;
  }

  /** Create custom particle emitter with full GM parameter model */
  create(config: {
    x?: number; y?: number;
    rate?: { min?: number; max?: number; interval?: number };
    life?: { min?: number; max?: number };
    speed?: { min?: number; max?: number; increase?: number; wiggle?: number };
    direction?: { min?: number; max?: number; increase?: number; wiggle?: number };
    size?: { min?: number; max?: number; end?: number; increase?: number; wiggle?: number };
    color?: { start?: string; mid?: string; end?: string };
    alpha?: { start?: number; end?: number };
    gravity?: { force?: number; direction?: number };
    rotation?: { min?: number; max?: number; speed?: number; wiggle?: number; relative?: boolean };
    emitterShape?: 'point' | 'circle' | 'rectangle' | 'ring' | 'line' | 'ellipse' | 'diamond';
    emitterSize?: number;
    emitterWidth?: number;   // For ellipse/rectangle width
    emitterHeight?: number;  // For ellipse/rectangle height
    wiggle?: number;
    additive?: boolean;
    texture?: string;        // Particle texture name (circle, cloud, disk, etc.)
    distribution?: 'linear' | 'gaussian';
    burst?: boolean;
    burstCount?: number;
  }): any {
    var c = config;
    var emitter = this._getEmitter();

    // Rate
    var rMin = (c.rate && c.rate.min) || 3;
    var rMax = (c.rate && c.rate.max) || 8;
    var rInt = (c.rate && c.rate.interval) || 0.05;
    emitter.rate = new Proton.Rate(new Proton.Span(rMin, rMax), rInt);

    // Life
    emitter.addInitialize(new Proton.Life((c.life && c.life.min) || 0.5, (c.life && c.life.max) || 1.5));

    // Size
    emitter.addInitialize(new Proton.Radius((c.size && c.size.min) || 3, (c.size && c.size.max) || 10));

    // Speed + Direction
    var sMin = (c.speed && c.speed.min) || 2;
    var sMax = (c.speed && c.speed.max) || 6;
    var dMin = (c.direction && c.direction.min) || 0;
    var dMax = (c.direction && c.direction.max) || 360;
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(sMin, sMax), new Proton.Span(dMin, dMax), 'polar'));

    // Particle texture
    if (c.texture) {
      var tex = this.getTexture(c.texture);
      if (tex) {
        try { emitter.addInitialize(new Proton.Body(tex)); } catch(e) {}
      }
    }

    // Emitter shape (all 7 types: point, circle, ring, rectangle, line, ellipse, diamond)
    var shape = c.emitterShape || 'point';
    var sz = c.emitterSize || 20;
    var ew = c.emitterWidth || sz * 2;
    var eh = c.emitterHeight || sz * 2;
    if (shape === 'circle') emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, sz)));
    else if (shape === 'rectangle') emitter.addInitialize(new Proton.Position(new Proton.RectZone(-ew / 2, -eh / 2, ew, eh)));
    else if (shape === 'ring') emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, sz)));
    else if (shape === 'line') emitter.addInitialize(new Proton.Position(new Proton.LineZone(-sz, 0, sz, 0)));
    else if (shape === 'ellipse') {
      // Approximate ellipse with rejection sampling via CircleZone + scale
      var maxR = Math.max(ew, eh) / 2;
      emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, maxR)));
    }
    else if (shape === 'diamond') {
      // Diamond: rotated square zone — use rect and particles will spread in square, creating diamond-like pattern
      emitter.addInitialize(new Proton.Position(new Proton.RectZone(-sz / 2, -sz / 2, sz, sz)));
    }

    // Size end (scale over lifetime)
    if (c.size && c.size.end !== undefined) {
      emitter.addBehaviour(new Proton.Scale(1, c.size.end / ((c.size.max || 10) || 1)));
    } else {
      emitter.addBehaviour(new Proton.Scale(1, 0.2));
    }

    // Alpha
    emitter.addBehaviour(new Proton.Alpha((c.alpha && c.alpha.start) || 1, (c.alpha && c.alpha.end) || 0));

    // Color lifecycle (start → mid → end)
    if (c.color) {
      if (c.color.mid) {
        emitter.addBehaviour(new Proton.Color(c.color.start || '#ffffff', c.color.mid));
      } else {
        emitter.addBehaviour(new Proton.Color(c.color.start || '#ffffff', c.color.end || '#000000'));
      }
    }

    // Gravity with direction support
    if (c.gravity && c.gravity.force) {
      if (c.gravity.direction !== undefined) {
        // Convert angle to x/y gravity components
        var gRad = (c.gravity.direction * Math.PI) / 180;
        var gx = c.gravity.force * Math.cos(gRad);
        var gy = c.gravity.force * Math.sin(gRad);
        emitter.addBehaviour(new Proton.Gravity(gy));
        if (Math.abs(gx) > 0.01) {
          emitter.addBehaviour(new Proton.RandomDrift(Math.abs(gx), 0, 0.02));
        }
      } else {
        emitter.addBehaviour(new Proton.Gravity(c.gravity.force));
      }
    }

    // Rotation with wiggle support
    if (c.rotation) {
      emitter.addBehaviour(new Proton.Rotate(
        new Proton.Span(c.rotation.min || 0, c.rotation.max || 360),
        c.rotation.speed || 'add'
      ));
    }

    // Direction wiggle (random angular drift)
    if (c.direction && c.direction.wiggle) {
      emitter.addBehaviour(new Proton.RandomDrift(c.direction.wiggle, c.direction.wiggle, 0.05));
    }

    // Speed wiggle / size wiggle (combined drift effect)
    var driftX = (c.wiggle || 0) + ((c.speed && c.speed.wiggle) || 0);
    var driftY = ((c.size && c.size.wiggle) || 0);
    if (driftX > 0 || driftY > 0) {
      emitter.addBehaviour(new Proton.RandomDrift(driftX || 1, driftY || driftX || 1, 0.1));
    }

    // Position
    emitter.p.x = c.x || 0;
    emitter.p.y = c.y || 0;

    // Additive blend mode
    if (c.additive) {
      this._setBlend(emitter, true);
    }

    // Burst or continuous
    if (c.burst) {
      emitter.rate = new Proton.Rate(new Proton.Span(c.burstCount || 30, (c.burstCount || 30) + 10), 1);
      emitter.emit('once');
      this._burst(emitter, ((c.life && c.life.max) || 1.5) * 1000 + 200);
    } else {
      emitter.emit();
      this._add(emitter);
    }

    return emitter;
  }

  // ---- GM Presets ----

  /** Fire — continuous flames (GM: fire) */
  private _p_fire(x: number, y: number, cfg: any): any {
    var scale = cfg.scale || 1;
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(6, 12), new Proton.Span(0.02, 0.05));
    emitter.addInitialize(new Proton.Life(0.2, 0.7));
    emitter.addInitialize(new Proton.Radius(4 * scale, 18 * scale));
    emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, 12 * scale)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(2, 6), new Proton.Span(80, 100), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 0.1));
    emitter.addBehaviour(new Proton.Alpha(0.9, 0));
    emitter.addBehaviour(new Proton.Color('#ffcc00', '#ff2200'));
    emitter.addBehaviour(new Proton.RandomDrift(4, 1, 0.05));
    this._setBlend(emitter, true);
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Rain — diagonal weather particles (GM: rain) */
  private _p_rain(x: number, y: number, cfg: any): any {
    var w = cfg.width || this.engine.config.width;
    var h = cfg.height || this.engine.config.height;
    var intensity = cfg.intensity || 0.7;
    var rate = Math.floor(15 + intensity * 50);
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(rate, rate + 15), new Proton.Span(0.01, 0.02));
    emitter.addInitialize(new Proton.Life(0.5, 1.0));
    emitter.addInitialize(new Proton.Radius(1, 2));
    emitter.addInitialize(new Proton.Position(new Proton.LineZone(0, -30, w, -30)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(6, 10), new Proton.Span(250, 275), 'polar'));
    emitter.addBehaviour(new Proton.Alpha(0.6, 0.1));
    emitter.addBehaviour(new Proton.Color('#aaddff'));
    emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(-50, -50, w + 100, h + 50), 'dead'));
    emitter.p.x = 0; emitter.p.y = 0;
    emitter.emit();
    return this._add(emitter);
  }

  /** Smoke — thick rising puffs (GM: smoke) */
  private _p_smoke(x: number, y: number, cfg: any): any {
    var scale = cfg.scale || 1;
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(3, 6), new Proton.Span(0.08, 0.15));
    emitter.addInitialize(new Proton.Life(1.5, 3.5));
    emitter.addInitialize(new Proton.Radius(10 * scale, 25 * scale));
    emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, 8 * scale)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(75, 105), 'polar'));
    emitter.addBehaviour(new Proton.Scale(0.4, 2.5));
    emitter.addBehaviour(new Proton.Alpha(0.6, 0));
    emitter.addBehaviour(new Proton.Color('#888888', '#222222'));
    emitter.addBehaviour(new Proton.RandomDrift(10, 3, 0.08));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Sparks — bright short-lived scattered (GM: sparks) — additive blend */
  private _p_sparks(x: number, y: number, cfg: any): void {
    var count = cfg.count || 25;
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(count, count + 15), 1);
    emitter.addInitialize(new Proton.Life(0.15, 0.5));
    emitter.addInitialize(new Proton.Radius(1, 4));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(5, 15), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 0));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Color(cfg.color || '#ffee44', '#ff6600'));
    emitter.addBehaviour(new Proton.Gravity(4));
    this._setBlend(emitter, true);
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 600);
  }

  /** Electricity — chaotic blue-white bolts (GM: electricity) — additive blend */
  private _p_electricity(x: number, y: number, cfg: any): any {
    var scale = cfg.scale || 1;
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(8, 15), new Proton.Span(0.02, 0.04));
    emitter.addInitialize(new Proton.Life(0.05, 0.2));
    emitter.addInitialize(new Proton.Radius(1, 3 * scale));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(8, 20), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 0.5));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Color('#ffffff', '#4488ff'));
    emitter.addBehaviour(new Proton.RandomDrift(30, 30, 0.02));
    this._setBlend(emitter, true);
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Embers — slowly rising hot particles (GM: embers) — additive blend */
  private _p_embers(x: number, y: number, cfg: any): any {
    var w = cfg.width || 200;
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(2, 5), new Proton.Span(0.1, 0.3));
    emitter.addInitialize(new Proton.Life(2, 5));
    emitter.addInitialize(new Proton.Radius(1, 3));
    emitter.addInitialize(new Proton.Position(new Proton.LineZone(x - w / 2, y, x + w / 2, y)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(0.5, 2), new Proton.Span(80, 100), 'polar'));
    emitter.addBehaviour(new Proton.Alpha(0.9, 0));
    emitter.addBehaviour(new Proton.Color('#ff8800', '#ff4400'));
    emitter.addBehaviour(new Proton.RandomDrift(8, 3, 0.08));
    this._setBlend(emitter, true);
    emitter.p.x = 0; emitter.p.y = 0;
    emitter.emit();
    return this._add(emitter);
  }

  /** Embers variant — wider spread, more glow (GM: embers2) — additive blend */
  private _p_embers2(x: number, y: number, cfg: any): any {
    var w = cfg.width || 400;
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(3, 7), new Proton.Span(0.08, 0.2));
    emitter.addInitialize(new Proton.Life(3, 7));
    emitter.addInitialize(new Proton.Radius(2, 5));
    emitter.addInitialize(new Proton.Position(new Proton.RectZone(x - w / 2, y - 20, w, 40)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(0.3, 1.5), new Proton.Span(75, 105), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 0.3));
    emitter.addBehaviour(new Proton.Alpha(0.8, 0));
    emitter.addBehaviour(new Proton.Color('#ffcc44', '#ff2200'));
    emitter.addBehaviour(new Proton.RandomDrift(12, 5, 0.06));
    this._setBlend(emitter, true);
    emitter.p.x = 0; emitter.p.y = 0;
    emitter.emit();
    return this._add(emitter);
  }

  /** Intense fire burst (GM: flameIntensity) — additive blend */
  private _p_flameIntensity(x: number, y: number, cfg: any): void {
    var scale = cfg.scale || 1;
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(40, 70), 1);
    emitter.addInitialize(new Proton.Life(0.3, 0.8));
    emitter.addInitialize(new Proton.Radius(6 * scale, 22 * scale));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(4, 12), new Proton.Span(50, 130), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1.3, 0));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Color('#ffffff', '#ff0000'));
    emitter.addBehaviour(new Proton.RandomDrift(6, 2, 0.04));
    this._setBlend(emitter, true);
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 1000);
  }

  /** Heavy dark smoke (GM: smoke2) */
  private _p_smoke2(x: number, y: number, cfg: any): any {
    var scale = cfg.scale || 1;
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(4, 8), new Proton.Span(0.06, 0.12));
    emitter.addInitialize(new Proton.Life(2, 5));
    emitter.addInitialize(new Proton.Radius(15 * scale, 35 * scale));
    emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, 15 * scale)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(0.5, 2.5), new Proton.Span(70, 110), 'polar'));
    emitter.addBehaviour(new Proton.Scale(0.3, 3));
    emitter.addBehaviour(new Proton.Alpha(0.5, 0));
    emitter.addBehaviour(new Proton.Color('#555555', '#111111'));
    emitter.addBehaviour(new Proton.RandomDrift(12, 4, 0.06));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Radial warp from center (GM: warp_center) — additive blend */
  private _p_warpCenter(x: number, y: number, cfg: any): any {
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(5, 10), new Proton.Span(0.03, 0.06));
    emitter.addInitialize(new Proton.Life(0.8, 2));
    emitter.addInitialize(new Proton.Radius(2, 6));
    emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, 5)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(3, 10), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(new Proton.Scale(0.5, 2));
    emitter.addBehaviour(new Proton.Alpha(0.8, 0));
    emitter.addBehaviour(new Proton.Color(cfg.color || '#aa66ff', '#220044'));
    emitter.addBehaviour(new Proton.Cyclone(new Proton.Span(3, 8)));
    this._setBlend(emitter, true);
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Directional warp lines (GM: warp_lines) */
  private _p_warpLines(x: number, y: number, cfg: any): any {
    var angle = cfg.angle || 90;
    var spread = cfg.spread || 20;
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(8, 15), new Proton.Span(0.02, 0.04));
    emitter.addInitialize(new Proton.Life(0.5, 1.5));
    emitter.addInitialize(new Proton.Radius(1, 3));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(6, 14), new Proton.Span(angle - spread, angle + spread), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 2));
    emitter.addBehaviour(new Proton.Alpha(0.7, 0));
    emitter.addBehaviour(new Proton.Color(cfg.color || '#66aaff', '#000044'));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Confetti burst — celebration effect (bonus preset) */
  private _p_confetti(x: number, y: number, cfg: any): void {
    var colors = cfg.colors || ['#ff0044', '#44ff00', '#0044ff', '#ffff00', '#ff00ff', '#00ffff'];
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(40, 80), 1);
    emitter.addInitialize(new Proton.Life(1, 3));
    emitter.addInitialize(new Proton.Radius(3, 8));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(6, 16), new Proton.Span(40, 140), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 0.3));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Color(colors[Math.floor(Math.random() * colors.length)], colors[Math.floor(Math.random() * colors.length)]));
    emitter.addBehaviour(new Proton.Rotate(new Proton.Span(0, 360), new Proton.Span(-5, 5), 'add'));
    emitter.addBehaviour(new Proton.Gravity(3));
    emitter.addBehaviour(new Proton.RandomDrift(5, 2, 0.1));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 3000);
  }

  /** Blood splatter — impact effect (bonus preset) */
  private _p_blood(x: number, y: number, cfg: any): void {
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(15, 30), 1);
    emitter.addInitialize(new Proton.Life(0.3, 0.8));
    emitter.addInitialize(new Proton.Radius(2, 8));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(4, 10), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 0.5));
    emitter.addBehaviour(new Proton.Alpha(1, 0.3));
    emitter.addBehaviour(new Proton.Color(cfg.color || '#cc0000', '#440000'));
    emitter.addBehaviour(new Proton.Gravity(6));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 900);
  }

  /** Floating hearts — love/health pickup effect (bonus preset) */
  private _p_hearts(x: number, y: number, cfg: any): void {
    var emitter = this._getEmitter();
    emitter.rate = new Proton.Rate(new Proton.Span(8, 15), 1);
    emitter.addInitialize(new Proton.Life(0.8, 1.8));
    emitter.addInitialize(new Proton.Radius(4, 10));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(2, 5), new Proton.Span(60, 120), 'polar'));
    emitter.addBehaviour(new Proton.Scale(0.5, 1.2));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Color('#ff4488', '#ff88aa'));
    emitter.addBehaviour(new Proton.RandomDrift(10, 3, 0.1));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 2000);
  }
}

// ---------------------------------------------------------------------------
// FilterSystem — Post-processing filter presets (engine.filters.*)
// Wraps pixi-filters + built-in PIXI filters with safe apply/remove.
// PIXI v8 rule: NEVER mutate container.filters — always reassign.
// ---------------------------------------------------------------------------

export class FilterSystem {
  private engine: Engine2D;
  private _active: Map<string, { filter: any; container: any }> = new Map();
  private _idCounter: number = 0;
  private _overlays: Map<string, any> = new Map();

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Apply a filter to a container. Returns a filter ID for removal. */
  private _apply(filter: any, container?: any, id?: string): string {
    var target = container || this.engine.world;
    var existing = target.filters ? Array.from(target.filters) : [];
    existing.push(filter);
    target.filters = existing;
    var fId = id || ('filter_' + (++this._idCounter));
    this._active.set(fId, { filter: filter, container: target });
    return fId;
  }

  /** Remove a filter by its ID */
  remove(id: string): void {
    var entry = this._active.get(id);
    if (!entry) return;
    var target = entry.container;
    if (target && target.filters) {
      var cur = Array.from(target.filters);
      var idx = cur.indexOf(entry.filter);
      if (idx >= 0) { cur.splice(idx, 1); target.filters = cur.length > 0 ? cur : null; }
    }
    this._active.delete(id);
    // Remove overlay if any
    var overlay = this._overlays.get(id);
    if (overlay && overlay.parent) { overlay.parent.removeChild(overlay); }
    this._overlays.delete(id);
  }

  /** Remove all active filters */
  removeAll(container?: any): void {
    if (container) {
      // Remove only filters on this container
      var toRemove: string[] = [];
      this._active.forEach(function(entry, id) { if (entry.container === container) toRemove.push(id); });
      for (var i = 0; i < toRemove.length; i++) this.remove(toRemove[i]);
    } else {
      var ids = Array.from(this._active.keys());
      for (var j = 0; j < ids.length; j++) this.remove(ids[j]);
    }
  }

  /** Get a filter by ID (to update uniforms at runtime) */
  get(id: string): any {
    var entry = this._active.get(id);
    return entry ? entry.filter : null;
  }

  /** List all active filter IDs */
  list(): string[] { return Array.from(this._active.keys()); }

  // ---- Preset Filters ----

  /** Vignette — dark edge overlay (GM: Vignette) */
  vignette(config?: { intensity?: number; color?: number; container?: any }): string {
    var cfg = config || {};
    var intensity = cfg.intensity ?? 0.5;
    var w = this.engine.config.width;
    var h = this.engine.config.height;
    // Create vignette via canvas radial gradient: transparent center → dark edges
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (ctx) {
      var cx = w / 2, cy = h / 2;
      var r = Math.max(w, h) * 0.55;
      var grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,' + (intensity * 0.3) + ')');
      grad.addColorStop(1, 'rgba(0,0,0,' + (intensity * 0.9) + ')');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    var sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
    sprite.width = w; sprite.height = h;
    if (this.engine.uiLayer) this.engine.uiLayer.addChild(sprite);
    var fId = 'vignette_' + (++this._idCounter);
    this._overlays.set(fId, sprite);
    this._active.set(fId, { filter: sprite, container: this.engine.uiLayer || this.engine.world });
    return fId;
  }

  /** Blur — gaussian blur (built-in PIXI.BlurFilter) */
  blur(config?: { strength?: number; quality?: number; container?: any }): string {
    var cfg = config || {};
    var filter = new PIXI.BlurFilter({ strength: cfg.strength || 4, quality: cfg.quality || 4 });
    return this._apply(filter, cfg.container);
  }

  /** Glow — outer glow (pixi-filters GlowFilter) */
  glow(config?: { color?: number; distance?: number; outerStrength?: number; innerStrength?: number; container?: any }): string {
    var cfg = config || {};
    if (!PIXI.GlowFilter && !(PIXI.filters && PIXI.filters.GlowFilter)) {
      console.warn('[Filters] GlowFilter not available');
      return '';
    }
    var GF = PIXI.GlowFilter || PIXI.filters.GlowFilter;
    var filter = new GF({
      color: cfg.color || 0xffffff,
      distance: cfg.distance || 15,
      outerStrength: cfg.outerStrength || 2,
      innerStrength: cfg.innerStrength || 0,
    });
    return this._apply(filter, cfg.container);
  }

  /** Outline — alpha-based outline detection (GM: Outline, pixi-filters OutlineFilter) */
  outline(config?: { color?: number; thickness?: number; container?: any }): string {
    var cfg = config || {};
    var OF = PIXI.OutlineFilter || (PIXI.filters && PIXI.filters.OutlineFilter);
    if (!OF) { console.warn('[Filters] OutlineFilter not available'); return ''; }
    var filter = new OF({ color: cfg.color || 0x000000, thickness: cfg.thickness || 2 });
    return this._apply(filter, cfg.container);
  }

  /** Bloom — bright area bleed (GM: glow/bloom, pixi-filters BloomFilter) */
  bloom(config?: { strength?: number; threshold?: number; container?: any }): string {
    var cfg = config || {};
    var BF = PIXI.AdvancedBloomFilter || PIXI.BloomFilter || (PIXI.filters && (PIXI.filters.AdvancedBloomFilter || PIXI.filters.BloomFilter));
    if (!BF) { console.warn('[Filters] BloomFilter not available'); return ''; }
    var filter = new BF({ threshold: cfg.threshold || 0.5, bloomScale: cfg.strength || 1.5, brightness: 1 });
    return this._apply(filter, cfg.container);
  }

  /** Godray — volumetric light shafts (pixi-filters GodrayFilter) */
  godray(config?: { angle?: number; gain?: number; lacunarity?: number; speed?: number; container?: any }): string {
    var cfg = config || {};
    var GR = PIXI.GodrayFilter || (PIXI.filters && PIXI.filters.GodrayFilter);
    if (!GR) { console.warn('[Filters] GodrayFilter not available'); return ''; }
    var filter = new GR({
      angle: cfg.angle || 30,
      gain: cfg.gain || 0.5,
      lacunarity: cfg.lacunarity || 2.5,
      parallel: true,
    });
    // Animate if speed specified
    if (cfg.speed) {
      var time = 0;
      var ticker = this.engine.app.ticker;
      var update = function() { time += 0.01 * (cfg.speed || 1); filter.time = time; };
      ticker.add(update);
      (filter as any)._tickerUpdate = update;
      (filter as any)._ticker = ticker;
    }
    return this._apply(filter, cfg.container);
  }

  /** Adjustment — brightness/contrast/saturation/gamma (pixi-filters AdjustmentFilter) */
  adjustment(config?: { brightness?: number; contrast?: number; saturation?: number; gamma?: number; container?: any }): string {
    var cfg = config || {};
    var AF = PIXI.AdjustmentFilter || (PIXI.filters && PIXI.filters.AdjustmentFilter);
    if (!AF) { console.warn('[Filters] AdjustmentFilter not available'); return ''; }
    var filter = new AF({
      brightness: cfg.brightness ?? 1,
      contrast: cfg.contrast ?? 1,
      saturation: cfg.saturation ?? 1,
      gamma: cfg.gamma ?? 1,
    });
    return this._apply(filter, cfg.container);
  }

  /** Drop Shadow — cast shadow behind sprites (pixi-filters DropShadowFilter) */
  dropShadow(config?: { color?: number; alpha?: number; blur?: number; offset?: { x?: number; y?: number }; container?: any }): string {
    var cfg = config || {};
    var DS = PIXI.DropShadowFilter || (PIXI.filters && PIXI.filters.DropShadowFilter);
    if (!DS) { console.warn('[Filters] DropShadowFilter not available'); return ''; }
    var filter = new DS({
      color: cfg.color || 0x000000,
      alpha: cfg.alpha ?? 0.5,
      blur: cfg.blur || 4,
      offset: { x: (cfg.offset && cfg.offset.x) || 4, y: (cfg.offset && cfg.offset.y) || 4 },
    });
    return this._apply(filter, cfg.container);
  }

  /** Motion Blur — directional blur (pixi-filters MotionBlurFilter) */
  motionBlur(config?: { velocity?: { x?: number; y?: number }; kernelSize?: number; container?: any }): string {
    var cfg = config || {};
    var MB = PIXI.MotionBlurFilter || (PIXI.filters && PIXI.filters.MotionBlurFilter);
    if (!MB) { console.warn('[Filters] MotionBlurFilter not available'); return ''; }
    var filter = new MB({
      velocity: { x: (cfg.velocity && cfg.velocity.x) || 10, y: (cfg.velocity && cfg.velocity.y) || 0 },
      kernelSize: cfg.kernelSize || 9,
    });
    return this._apply(filter, cfg.container);
  }

  /** Color Matrix — hue/saturation/brightness via matrix (built-in PIXI.ColorMatrixFilter) */
  colorMatrix(config?: { container?: any }): { id: string; filter: any } {
    var filter = new PIXI.ColorMatrixFilter();
    var fId = this._apply(filter, (config && config.container));
    return { id: fId, filter: filter };
  }

  /** Pixelate — retro low-res effect (GM: Pixelate) — uses pixi-filters PixelateFilter */
  pixelate(config?: { cellSize?: number; container?: any }): string {
    var cfg = config || {};
    var PF = PIXI.PixelateFilter || (PIXI.filters && PIXI.filters.PixelateFilter);
    if (PF) {
      var sz = cfg.cellSize || 4;
      var filter = new PF(sz);
      return this._apply(filter, cfg.container);
    }
    // Fallback: blur approximation
    var filter2 = new PIXI.BlurFilter({ strength: (cfg.cellSize || 4) * 0.5, quality: 1 });
    return this._apply(filter2, cfg.container);
  }

  /** Underwater — blue tint + displacement distortion + chromatic aberration (GM: Underwater) */
  underwater(config?: { tint?: number; distortion?: number; speed?: number; container?: any }): string {
    var cfg = config || {};
    var target = cfg.container || this.engine.world;
    var fId = 'underwater_' + (++this._idCounter);

    // 1) Blue-green color tint
    var cmf = new PIXI.ColorMatrixFilter();
    cmf.tint(cfg.tint || 0x4488cc, true);
    this._apply(cmf, target, fId + '_tint');

    // 2) Displacement distortion (wave effect)
    var distStr = cfg.distortion ?? 15;
    var canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    var ctx = canvas.getContext('2d');
    if (ctx) {
      // Generate noise displacement map
      for (var py = 0; py < 512; py++) {
        for (var px = 0; px < 512; px++) {
          var v = 128 + Math.sin(px * 0.05) * 40 + Math.cos(py * 0.03) * 40;
          ctx.fillStyle = 'rgb(' + Math.floor(v) + ',' + Math.floor(v) + ',128)';
          ctx.fillRect(px, py, 1, 1);
        }
      }
      var dispTex = PIXI.Texture.from(canvas);
      var dispSprite = new PIXI.Sprite(dispTex);
      dispSprite.texture.source.addressMode = 'repeat';
      var dispFilter = new PIXI.DisplacementFilter({ sprite: dispSprite, scale: { x: distStr, y: distStr } });
      this._apply(dispFilter, target, fId + '_disp');
      // Animate displacement
      var spd = cfg.speed || 1;
      var update = function() { dispSprite.x += 0.3 * spd; dispSprite.y += 0.2 * spd; };
      this.engine.app.ticker.add(update);
      (dispFilter as any)._tickerUpdate = update;
      (dispFilter as any)._ticker = this.engine.app.ticker;
    }

    this._active.set(fId, { filter: cmf, container: target });
    return fId;
  }

  /** Heat Haze — animated distortion with chromatic aberration (GM: Heathaze) */
  heathaze(config?: { distortion?: number; speed?: number; container?: any }): string {
    var cfg = config || {};
    var target = cfg.container || this.engine.world;
    var fId = 'heathaze_' + (++this._idCounter);
    var distStr = cfg.distortion ?? 12;

    // Generate animated displacement map
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    var ctx = canvas.getContext('2d');
    if (ctx) {
      for (var py = 0; py < 256; py++) {
        for (var px = 0; px < 256; px++) {
          var v = 128 + Math.sin(px * 0.08 + py * 0.04) * 60;
          ctx.fillStyle = 'rgb(' + Math.floor(v) + ',128,128)';
          ctx.fillRect(px, py, 1, 1);
        }
      }
      var dispTex = PIXI.Texture.from(canvas);
      var dispSprite = new PIXI.Sprite(dispTex);
      dispSprite.texture.source.addressMode = 'repeat';
      var dispFilter = new PIXI.DisplacementFilter({ sprite: dispSprite, scale: { x: distStr, y: distStr * 0.5 } });
      this._apply(dispFilter, target, fId);
      var spd = cfg.speed || 1;
      var time = 0;
      var update = function() {
        time += 0.016 * spd;
        dispSprite.x = Math.sin(time * 1.5) * 20;
        dispSprite.y = time * 30;
      };
      this.engine.app.ticker.add(update);
      (dispFilter as any)._tickerUpdate = update;
      (dispFilter as any)._ticker = this.engine.app.ticker;
    }

    return fId;
  }

  /** Ripples — radial sine wave from center point (GM: Ripples) */
  ripples(config?: { x?: number; y?: number; speed?: number; amplitude?: number; wavelength?: number; duration?: number; container?: any }): string {
    var cfg = config || {};
    var target = cfg.container || this.engine.world;
    var fId = 'ripples_' + (++this._idCounter);

    // Use ShockwaveFilter from pixi-filters
    var SW = PIXI.ShockwaveFilter || (PIXI.filters && PIXI.filters.ShockwaveFilter);
    if (SW) {
      var cx = (cfg.x ?? this.engine.config.width / 2) / this.engine.config.width;
      var cy = (cfg.y ?? this.engine.config.height / 2) / this.engine.config.height;
      var filter = new SW({ center: [cx, cy], amplitude: cfg.amplitude || 15, wavelength: cfg.wavelength || 80, speed: cfg.speed || 200, radius: -1 });
      this._apply(filter, target, fId);
      // Animate time
      var time = 0;
      var dur = cfg.duration || 2;
      var self = this;
      var ticker = this.engine.app.ticker;
      var update = function() {
        time += 0.016;
        filter.time = time;
        if (time > dur) { ticker.remove(update); self.remove(fId); }
      };
      ticker.add(update);
      (filter as any)._tickerUpdate = update;
      (filter as any)._ticker = ticker;
    } else {
      console.warn('[Filters] ShockwaveFilter not available for ripples');
    }

    return fId;
  }

  /** Clouds — animated cloud overlay using noise (GM: Clouds) */
  clouds(config?: { scale?: number; density?: number; speed?: number; color?: number; alpha?: number; container?: any }): string {
    var cfg = config || {};
    var w = this.engine.config.width;
    var h = this.engine.config.height;
    var fId = 'clouds_' + (++this._idCounter);

    // Generate cloud texture via Perlin-like noise
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    var ctx = canvas.getContext('2d');
    if (ctx) {
      var scale = cfg.scale || 40;
      for (var py = 0; py < 256; py++) {
        for (var px = 0; px < 256; px++) {
          // Simple value noise with octaves
          var nx = px / scale, ny = py / scale;
          var v = Math.sin(nx * 2.1 + ny * 1.7) * 0.5 + Math.sin(nx * 0.7 - ny * 2.3) * 0.3 + Math.sin(nx * 3.1 + ny * 0.5) * 0.2;
          v = (v + 1) * 0.5; // 0-1
          var density = cfg.density ?? 0.5;
          v = Math.max(0, v - (1 - density)) / density;
          var alpha_v = v * (cfg.alpha ?? 0.4);
          ctx.fillStyle = 'rgba(255,255,255,' + alpha_v + ')';
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }
    var cloudSprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
    cloudSprite.width = w * 2; cloudSprite.height = h;
    cloudSprite.alpha = cfg.alpha ?? 0.4;
    if (cfg.color) cloudSprite.tint = cfg.color;
    if (this.engine.uiLayer) this.engine.uiLayer.addChild(cloudSprite);
    this._overlays.set(fId, cloudSprite);
    this._active.set(fId, { filter: cloudSprite, container: this.engine.uiLayer || this.engine.world });

    // Animate drift
    var spd = cfg.speed || 0.5;
    var update = function() { cloudSprite.x -= spd; if (cloudSprite.x < -w) cloudSprite.x = 0; };
    this.engine.app.ticker.add(update);
    (cloudSprite as any)._tickerUpdate = update;
    (cloudSprite as any)._ticker = this.engine.app.ticker;

    return fId;
  }

  /** Old Film — sepia + noise grain + flicker + scanlines (GM: Old Film) */
  oldFilm(config?: { sepia?: number; noise?: number; flicker?: number; scanlines?: boolean; container?: any }): string {
    var cfg = config || {};
    var target = cfg.container || this.engine.world;
    var fId = 'oldfilm_' + (++this._idCounter);

    // Try pixi-filters CRTFilter for scanlines + noise
    var CRT = PIXI.CRTFilter || (PIXI.filters && PIXI.filters.CRTFilter);
    if (CRT && cfg.scanlines !== false) {
      var crtFilter = new CRT({
        curvature: 0,
        lineWidth: 1,
        lineContrast: 0.15,
        noise: cfg.noise ?? 0.3,
        noiseSize: 1.5,
        vignetting: 0.2,
        seed: Math.random(),
      });
      this._apply(crtFilter, target, fId + '_crt');
      // Animate noise seed
      var ticker = this.engine.app.ticker;
      var update = function() { crtFilter.seed = Math.random(); crtFilter.time += 0.5; };
      ticker.add(update);
      (crtFilter as any)._tickerUpdate = update;
      (crtFilter as any)._ticker = ticker;
    }

    // Sepia tint
    var cmf = new PIXI.ColorMatrixFilter();
    cmf.sepia(true);
    cmf.contrast(cfg.sepia ?? 0.3, true);
    cmf.brightness(0.9 + Math.random() * 0.1, true);
    this._apply(cmf, target, fId + '_sepia');

    // Flicker effect via brightness animation
    if (cfg.flicker !== 0) {
      var flickerStr = cfg.flicker ?? 0.05;
      var flickUpdate = function() {
        cmf.brightness(0.9 + Math.random() * flickerStr * 2, true);
      };
      this.engine.app.ticker.add(flickUpdate);
      (cmf as any)._tickerUpdate = flickUpdate;
      (cmf as any)._ticker = this.engine.app.ticker;
    }

    this._active.set(fId, { filter: cmf, container: target });
    return fId;
  }

  /** Gradient overlay — screen-space color gradient (GM: Gradient, 6 modes) */
  gradient(config?: { color1?: number; color2?: number; alpha?: number; mode?: 'linear' | 'radial' | 'rect' | 'diamond' | 'conic' | 'horizontal'; container?: any }): string {
    var cfg = config || {};
    var w = this.engine.config.width;
    var h = this.engine.config.height;
    var alpha = cfg.alpha ?? 0.3;
    var mode = cfg.mode || 'linear';

    var g = new PIXI.Graphics();
    g.rect(0, 0, w, h);

    try {
      if (mode === 'radial') {
        // Radial gradient using FillGradient
        var grad = new PIXI.FillGradient({
          type: 'radial',
          colorStops: [
            { offset: 0, color: cfg.color1 || 0x000044 },
            { offset: 1, color: cfg.color2 || 0x000000 },
          ],
          center: { x: 0.5, y: 0.5 },
          radius: 0.5,
        });
        g.fill(grad);
      } else if (mode === 'horizontal') {
        var hgrad = new PIXI.FillGradient({
          type: 'linear',
          colorStops: [
            { offset: 0, color: cfg.color1 || 0x000044 },
            { offset: 1, color: cfg.color2 || 0x000000 },
          ],
          end: { x: 1, y: 0 },
        });
        g.fill(hgrad);
      } else {
        // linear (vertical), rect, diamond, conic — use linear as base
        var vgrad = new PIXI.FillGradient({
          type: 'linear',
          colorStops: [
            { offset: 0, color: cfg.color1 || 0x000044 },
            { offset: 1, color: cfg.color2 || 0x000000 },
          ],
          end: { x: 0, y: 1 },
        });
        g.fill(vgrad);
      }
    } catch(e) {
      g.fill({ color: cfg.color1 || 0x000044, alpha: alpha });
    }

    g.alpha = alpha;
    if (this.engine.uiLayer) this.engine.uiLayer.addChild(g);
    var fId = 'gradient_' + (++this._idCounter);
    this._overlays.set(fId, g);
    this._active.set(fId, { filter: g, container: this.engine.uiLayer || this.engine.world });
    return fId;
  }

  /** Screen shake as a filter effect (GM: Screenshake) — shortcut to engine.juice.shake */
  screenshake(config?: { intensity?: number; duration?: number }): void {
    var cfg = config || {};
    this.engine.juice.screenShake(this.engine.world, cfg.intensity || 8, cfg.duration || 0.3);
  }

  /** Glitch — digital glitch distortion (pixi-filters GlitchFilter) */
  glitch(config?: { slices?: number; offset?: number; direction?: number; container?: any }): string {
    var cfg = config || {};
    var GF = PIXI.GlitchFilter || (PIXI.filters && PIXI.filters.GlitchFilter);
    if (!GF) { console.warn('[Filters] GlitchFilter not available'); return ''; }
    var filter = new GF({
      slices: cfg.slices || 10,
      offset: cfg.offset || 10,
      direction: cfg.direction || 0,
    });
    var fId = this._apply(filter, cfg.container);
    // Animate seed for glitch effect
    var ticker = this.engine.app.ticker;
    var update = function() { filter.seed = Math.random(); };
    ticker.add(update);
    (filter as any)._tickerUpdate = update;
    (filter as any)._ticker = ticker;
    return fId;
  }

  /** CRT — cathode ray tube effect with scanlines + curvature (pixi-filters CRTFilter) */
  crt(config?: { curvature?: number; lineWidth?: number; lineContrast?: number; noise?: number; container?: any }): string {
    var cfg = config || {};
    var CRT = PIXI.CRTFilter || (PIXI.filters && PIXI.filters.CRTFilter);
    if (!CRT) { console.warn('[Filters] CRTFilter not available'); return ''; }
    var filter = new CRT({
      curvature: cfg.curvature ?? 1,
      lineWidth: cfg.lineWidth ?? 1,
      lineContrast: cfg.lineContrast ?? 0.25,
      noise: cfg.noise ?? 0.2,
    });
    var fId = this._apply(filter, cfg.container);
    var ticker = this.engine.app.ticker;
    var update = function() { filter.seed = Math.random(); filter.time += 0.5; };
    ticker.add(update);
    (filter as any)._tickerUpdate = update;
    (filter as any)._ticker = ticker;
    return fId;
  }

  // ---- Convenience API: engine.effects.add() ----

  /** Add a filter by name (convenience wrapper matching GM's effect API) */
  add(name: string, config?: any): string {
    var fn = (this as any)[name];
    if (typeof fn === 'function') return fn.call(this, config || {});
    console.warn('[Filters] Unknown filter: ' + name + '. Available: vignette, blur, glow, outline, bloom, godray, adjustment, dropShadow, motionBlur, pixelate, underwater, heathaze, ripples, clouds, oldFilm, gradient, screenshake, glitch, crt');
    return '';
  }
}
`;

// ============================================================================
// INPUT HANDLER (src/engine/input.ts template content)
// ============================================================================

export const ENGINE_INPUT_CONTENT = `
// Input handling is built into Engine2D core (InputManager class).
// This file provides additional touch/mobile input utilities.

const PIXI = (window as any).PIXI;

export interface VirtualJoystick {
  container: any; // PIXI.Container
  direction: { x: number; y: number };
  active: boolean;
  destroy(): void;
}

/**
 * Creates a virtual joystick for mobile touch input.
 * Returns direction vector (normalized -1..1) updated each frame.
 */
export function createVirtualJoystick(stage: any, x: number, y: number, radius = 60): VirtualJoystick {
  const container = new PIXI.Container();
  container.x = x;
  container.y = y;

  // Base circle
  const base = new PIXI.Graphics();
  base.circle(0, 0, radius);
  base.fill({ color: 0xffffff, alpha: 0.2 });
  base.stroke({ color: 0xffffff, alpha: 0.4, width: 2 });
  container.addChild(base);

  // Thumb
  const thumb = new PIXI.Graphics();
  thumb.circle(0, 0, radius * 0.4);
  thumb.fill({ color: 0xffffff, alpha: 0.5 });
  container.addChild(thumb);

  const joystick: VirtualJoystick = {
    container,
    direction: { x: 0, y: 0 },
    active: false,
    destroy() {
      stage.removeChild(container);
    }
  };

  let pointerId: number | null = null;

  container.eventMode = 'static';
  container.on('pointerdown', (e: any) => {
    pointerId = e.pointerId;
    joystick.active = true;
  });

  const onMove = (e: any) => {
    if (e.pointerId !== pointerId || !joystick.active) return;
    const local = container.toLocal(e.global);
    const dist = Math.sqrt(local.x * local.x + local.y * local.y);
    const clampDist = Math.min(dist, radius);
    const angle = Math.atan2(local.y, local.x);
    thumb.x = Math.cos(angle) * clampDist;
    thumb.y = Math.sin(angle) * clampDist;
    joystick.direction.x = thumb.x / radius;
    joystick.direction.y = thumb.y / radius;
  };

  const onUp = (e: any) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    joystick.active = false;
    thumb.x = 0;
    thumb.y = 0;
    joystick.direction.x = 0;
    joystick.direction.y = 0;
  };

  stage.on('pointermove', onMove);
  stage.on('pointerup', onUp);
  stage.on('pointerupoutside', onUp);

  stage.addChild(container);
  return joystick;
}

/**
 * Simple tap-to-action for mobile (e.g., tap right half to jump).
 */
export function onTapZone(canvas: HTMLCanvasElement, zone: 'left' | 'right' | 'full',
  callback: () => void): () => void {
  const handler = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const mid = rect.width / 2;
    if (zone === 'left' && x < mid) callback();
    else if (zone === 'right' && x >= mid) callback();
    else if (zone === 'full') callback();
  };
  canvas.addEventListener('pointerdown', handler);
  return () => canvas.removeEventListener('pointerdown', handler);
}
`;

// ============================================================================
// MEDIA STOCK URL BUILDER (src/utils/media-stock.ts template content)
// ============================================================================

export const MEDIA_STOCK_2D_CONTENT = `
/**
 * Builds a full URL for a 2D media-stock game asset.
 * Uses the platform-injected origin so it works inside the runtime iframe.
 *
 * Example: spriteUrl("robot/walk_01.png")
 * Example: spriteUrl("environments/nature/1.png")
 */
export function spriteUrl(path: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || '';
  return origin + '/api/app-builder/media-stock/' + encodeURI(path);
}

/**
 * Load a single sprite texture via PIXI.Assets
 */
export async function loadSprite(path: string): Promise<any> {
  const PIXI = (window as any).PIXI;
  const url = spriteUrl(path);
  return PIXI.Assets.load(url);
}

/**
 * Load multiple sprites in parallel
 */
export async function loadSprites(paths: string[]): Promise<Record<string, any>> {
  const PIXI = (window as any).PIXI;
  const manifest: Record<string, string> = {};
  for (const p of paths) {
    manifest[p] = spriteUrl(p);
  }
  return PIXI.Assets.load(Object.values(manifest)).then(() => {
    const result: Record<string, any> = {};
    for (const [key, url] of Object.entries(manifest)) {
      result[key] = PIXI.Assets.get(url);
    }
    return result;
  });
}

/**
 * Load a sprite sheet JSON + texture, returns animation frames.
 * The JSON file must follow the standard format:
 * { "frames": { "name": { "frame": { x, y, w, h } } }, "animations": { "idle": ["frame1","frame2",...] }, "meta": { "image": "sheet.png" } }
 *
 * Usage:
 *   const sheet = await loadSpriteSheet("2d/sprites/characters/hero/sheet.json");
 *   const anim = new PIXI.AnimatedSprite(sheet.animations['idle']);
 */
export async function loadSpriteSheet(jsonPath: string): Promise<any> {
  const PIXI = (window as any).PIXI;
  const url = spriteUrl(jsonPath);
  try {
    const sheet = await PIXI.Assets.load(url);
    return sheet;
  } catch (e) {
    console.warn('[media-stock] Failed to load sprite sheet:', jsonPath, e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sprite Library — preloaded texture cache for the drawing helper fallback chain
// ---------------------------------------------------------------------------

/** Internal cache of loaded sprite textures keyed by category/name */
const _spriteCache: Record<string, any> = {};

/** Internal cache of loaded animated sprite sheet data */
export const _sheetCache: Record<string, any> = {};
// Expose _sheetCache setter globally so AssetsSystem.setPlayerSprites can access it
// (esbuild module scope prevents direct access from class methods)
(window as any).__vibexeSetHeroSheet = function(animations: Record<string, any[]>, frameW?: number, frameH?: number) { _sheetCache['hero'] = { animations: animations, frameWidth: frameW || 128, frameHeight: frameH || 128 }; };
(window as any).__vibexeSheetCache = _sheetCache;
(window as any).__vibexeSpriteCache = _spriteCache;

/** Whether the sprite library has been loaded */
let _spriteLibLoaded = false;

/** Sprite catalog — maps style to available sprite paths */
const SPRITE_CATALOG: Record<string, Record<string, string[]>> = {
  default: {
    platforms: ['2d/sprites/platforms/grass_block.png', '2d/sprites/platforms/stone_block.png', '2d/sprites/platforms/ice_block.png', '2d/sprites/platforms/sand_block.png', '2d/sprites/platforms/dark_block.png'],
    ground: ['2d/sprites/ground/grass_top.png', '2d/sprites/ground/dirt_fill.png', '2d/sprites/ground/stone_top.png', '2d/sprites/ground/ice_top.png', '2d/sprites/ground/sand_top.png'],
    trees: ['2d/sprites/trees/round_tree.png', '2d/sprites/trees/pine_tree.png', '2d/sprites/trees/palm_tree.png', '2d/sprites/trees/dead_tree.png'],
    bushes: ['2d/sprites/bushes/bush_green.png', '2d/sprites/bushes/bush_flower.png'],
    clouds: ['2d/sprites/clouds/cloud_puffy.png', '2d/sprites/clouds/cloud_small.png'],
    collectibles: ['2d/sprites/collectibles/coin_gold.png', '2d/sprites/collectibles/gem_red.png', '2d/sprites/collectibles/gem_blue.png', '2d/sprites/collectibles/star.png', '2d/sprites/collectibles/heart.png'],
    props: ['2d/sprites/props/crate.png', '2d/sprites/props/barrel.png', '2d/sprites/props/rock.png', '2d/sprites/props/fence.png', '2d/sprites/props/sign_post.png'],
    backgrounds: ['2d/sprites/backgrounds/hill_green.png', '2d/sprites/backgrounds/hill_snow.png', '2d/sprites/backgrounds/mountain_rock.png'],
  },
};

/** Character sprite sheets — maps character name to sheet JSON path */
const CHARACTER_SHEETS: Record<string, string> = {
  hero: '2d/sprites/characters/hero/sheet.json',
  slime: '2d/sprites/characters/slime/sheet.json',
  bat: '2d/sprites/characters/bat/sheet.json',
  boss: '2d/sprites/characters/boss/sheet.json',
  npc: '2d/sprites/characters/npc/sheet.json',
};

/**
 * Preload all sprites for a given style. Call in scene enter().
 * Silently skips missing assets — fallback chain handles them.
 */
export async function _loadSpriteLib(style?: string): Promise<void> {
  if (_spriteLibLoaded) return;
  const PIXI = (window as any).PIXI;
  const catalog = SPRITE_CATALOG[style || 'default'] || SPRITE_CATALOG.default;
  const allPaths: string[] = [];
  for (const cat of Object.keys(catalog)) {
    for (const p of catalog[cat]) allPaths.push(p);
  }

  // Load environment sprites via Image element (reliable for both SVG and PNG)
  var loaded = 0;
  var loadPromises: Promise<void>[] = [];
  for (var i = 0; i < allPaths.length; i++) {
    (function(path) {
      var url = spriteUrl(path);
      loadPromises.push(new Promise(function(resolve) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          try {
            var tex = PIXI.Texture.from(img);
            if (tex) { _spriteCache[path] = tex; loaded++; }
          } catch(e) { /* texture creation failed */ }
          resolve();
        };
        img.onerror = function() { resolve(); };
        img.src = url;
      }));
    })(allPaths[i]);
  }
  await Promise.all(loadPromises);
  if (loaded > 0) console.log('[sprite-lib] Loaded ' + loaded + ' environment sprites');

  // Load character sprite sheets — manually parse for reliable AnimatedSprite support
  for (var charName of Object.keys(CHARACTER_SHEETS)) {
    try {
      var jsonUrl = spriteUrl(CHARACTER_SHEETS[charName]);
      var pngPath = CHARACTER_SHEETS[charName].replace('/sheet.json', '/sheet.png');
      var pngUrl = spriteUrl(pngPath);

      // Load JSON metadata + PNG texture in parallel
      var [jsonResp, baseTex] = await Promise.all([
        fetch(jsonUrl).then(r => r.ok ? r.json() : null),
        PIXI.Assets.load(pngUrl).catch(() => null)
      ]);
      if (!jsonResp || !baseTex) continue;

      // Create and parse PIXI.Spritesheet from texture + JSON data
      var spritesheet = new PIXI.Spritesheet(baseTex, jsonResp);
      await spritesheet.parse();
      if (spritesheet.animations && Object.keys(spritesheet.animations).length > 0) {
        _sheetCache[charName] = spritesheet;
        loaded++;
        console.log('[sprite-lib] Parsed sheet: ' + charName + ' (' + Object.keys(spritesheet.animations).join(', ') + ')');
      }
    } catch (e) { /* character sheet not available yet */ }
  }

  _spriteLibLoaded = true;
  if (loaded > 0) console.log('[sprite-lib] Loaded ' + loaded + ' assets');
}

/**
 * Get a cached static sprite as PIXI.Sprite, or null if not loaded.
 * Usage: var spr = _getSprite('platforms', 'grass_block');
 */
export function _getSprite(category: string, name: string): any {
  var PIXI = (window as any).PIXI;
  // Try .png first (Kenney raster art), then .svg fallback
  var key = '2d/sprites/' + category + '/' + name + '.png';
  var tex = _spriteCache[key];
  if (!tex) {
    key = '2d/sprites/' + category + '/' + name + '.svg';
    tex = _spriteCache[key];
  }
  if (!tex) return null;
  return new PIXI.Sprite(tex);
}

/**
 * Get a TilingSprite from a cached texture, or null.
 * Usage: var ts = _getTilingSprite('ground', 'grass_top', 800, 64);
 */
export function _getTilingSprite(category: string, name: string, width: number, height: number): any {
  var PIXI = (window as any).PIXI;
  var key = '2d/sprites/' + category + '/' + name + '.png';
  var tex = _spriteCache[key];
  if (!tex) {
    key = '2d/sprites/' + category + '/' + name + '.svg';
    tex = _spriteCache[key];
  }
  if (!tex || !PIXI.TilingSprite) return null;
  var ts = new PIXI.TilingSprite({ texture: tex, width: width, height: height });
  return ts;
}

/** Map game theme to ground sprite name prefix */
var _themeGroundMap: Record<string, string> = {
  forest: 'grass', sunset: 'grass', candy: 'grass',
  volcanic: 'stone', dark: 'stone', space: 'stone',
  arctic: 'ice', ocean: 'sand',
};

/** Map game theme to platform sprite name */
var _themePlatformMap: Record<string, string> = {
  forest: 'grass_block', sunset: 'grass_block', candy: 'grass_block',
  volcanic: 'stone_block', dark: 'dark_block', space: 'dark_block',
  arctic: 'ice_block', ocean: 'sand_block',
};

/**
 * Get an AnimatedSprite from a loaded character sheet, or null.
 * Usage: var anim = _getAnimatedSprite('hero', 'idle');
 */
export function _getAnimatedSprite(character: string, animation: string): any {
  var PIXI = (window as any).PIXI;
  var sheet = _sheetCache[character];
  if (!sheet || !sheet.animations || !sheet.animations[animation]) return null;
  var anim = new PIXI.AnimatedSprite(sheet.animations[animation]);
  anim.animationSpeed = 0.15;
  anim.play();
  return anim;
}
`;
