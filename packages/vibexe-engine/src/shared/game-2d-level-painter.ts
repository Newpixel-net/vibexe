/**
 * Level Painter — Procedural terrain generation for 2D games
 *
 * Replaces manual drawGroundStrip/drawPlatformBlock calls with a single
 * engine.level.generate() call that produces beautiful Worms-style terrain
 * with caves, overhangs, textured surfaces, parallax backgrounds, and decorations.
 *
 * Architecture: bitmap-based terrain (NOT tiles).
 * - Collision mask: Uint8Array (1=solid, 0=air) per pixel
 * - Visual: offscreen canvas rendered as PIXI.Sprite
 * - Physics: column-based AABB bodies extracted from mask
 */

export const LEVEL_PAINTER_CONTENT = `
var PIXI = (window as any).PIXI;

// ============================================================
// SimplexNoise2D — 2D simplex noise with fBm, ridged, warp
// Ported from vibexe terrain-painter module
// ============================================================

var _lpGrad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
var _lpBaseP = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
var _lpPerm = new Array(512);
for (var _lpi = 0; _lpi < 512; _lpi++) _lpPerm[_lpi] = _lpBaseP[_lpi & 255];

var SimplexNoise2D: any = {};

SimplexNoise2D.seed = function(s: number) {
  var shuffled = _lpBaseP.slice();
  var m = shuffled.length;
  while (m) {
    s = (s * 16807 + 0) % 2147483647;
    var i = s % m--;
    var tmp = shuffled[m];
    shuffled[m] = shuffled[i];
    shuffled[i] = tmp;
  }
  for (var j = 0; j < 512; j++) _lpPerm[j] = shuffled[j & 255];
};

SimplexNoise2D.noise2D = function(xin: number, yin: number): number {
  var F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  var G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
  var s = (xin + yin) * F2;
  var i = Math.floor(xin + s);
  var j = Math.floor(yin + s);
  var t = (i + j) * G2;
  var X0 = i - t, Y0 = j - t;
  var x0 = xin - X0, y0 = yin - Y0;
  var i1: number, j1: number;
  if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
  var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  var x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
  var ii = i & 255, jj = j & 255;
  var gi0 = _lpPerm[ii + _lpPerm[jj]] % 12;
  var gi1 = _lpPerm[ii + i1 + _lpPerm[jj + j1]] % 12;
  var gi2 = _lpPerm[ii + 1 + _lpPerm[jj + 1]] % 12;
  var n0 = 0, n1 = 0, n2 = 0;
  var t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * (_lpGrad3[gi0][0] * x0 + _lpGrad3[gi0][1] * y0); }
  var t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * (_lpGrad3[gi1][0] * x1 + _lpGrad3[gi1][1] * y1); }
  var t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * (_lpGrad3[gi2][0] * x2 + _lpGrad3[gi2][1] * y2); }
  return 70.0 * (n0 + n1 + n2);
};

SimplexNoise2D.fbm = function(x: number, y: number, octaves: number, lacunarity: number, gain: number): number {
  var sum = 0, amp = 1, freq = 1, maxAmp = 0;
  for (var o = 0; o < octaves; o++) {
    sum += SimplexNoise2D.noise2D(x * freq, y * freq) * amp;
    maxAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / maxAmp;
};

SimplexNoise2D.ridgedMultifractal = function(x: number, y: number, octaves: number, lacunarity: number, gain: number, sharpness: number): number {
  var sum = 0, amp = 1, freq = 1, prev = 1;
  for (var o = 0; o < octaves; o++) {
    var n = SimplexNoise2D.noise2D(x * freq, y * freq);
    n = 1.0 - Math.abs(n);
    n = Math.pow(n, sharpness);
    n *= prev;
    prev = Math.max(0.01, n);
    sum += n * amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum;
};

SimplexNoise2D.domainWarp = function(x: number, y: number, strength: number): number[] {
  var wx = SimplexNoise2D.fbm(x + 5.2, y + 1.3, 3, 2.0, 0.5) * strength;
  var wy = SimplexNoise2D.fbm(x + 9.7, y + 6.8, 3, 2.0, 0.5) * strength;
  return [x + wx, y + wy];
};

SimplexNoise2D.worley = function(x: number, y: number): number {
  var ix = Math.floor(x), iy = Math.floor(y);
  var minDist = 999;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      var cx = ix + dx + (SimplexNoise2D.noise2D((ix+dx)*0.7, (iy+dy)*0.7) * 0.5 + 0.5);
      var cy = iy + dy + (SimplexNoise2D.noise2D((ix+dx)*1.3, (iy+dy)*1.3) * 0.5 + 0.5);
      var d = Math.sqrt((x-cx)*(x-cx) + (y-cy)*(y-cy));
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
};

SimplexNoise2D.smoothstep = function(edge0: number, edge1: number, x: number): number {
  var t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};


// ============================================================
// TERRAIN PROFILES — noise parameters per theme
// ============================================================

var TERRAIN_PROFILES: Record<string, any> = {
  forest: {
    baseFreq: 0.0018, caveFreq: 0.004, detailFreq: 0.012,
    groundLevel: 0.62, caveThreshold: 0.28, overhangStrength: 0.2,
    warpStrength: 50, ridgeSharpness: 1.0, ridgeMix: 0.08,
    octaves: 4, lacunarity: 2.0, gain: 0.42,
    minGround: 0.45, smoothPasses: 4
  },
  sunset: {
    baseFreq: 0.0015, caveFreq: 0.003, detailFreq: 0.01,
    groundLevel: 0.65, caveThreshold: 0.22, overhangStrength: 0.15,
    warpStrength: 40, ridgeSharpness: 0.8, ridgeMix: 0.05,
    octaves: 3, lacunarity: 2.0, gain: 0.4,
    minGround: 0.5, smoothPasses: 5
  },
  space: {
    baseFreq: 0.003, caveFreq: 0.006, detailFreq: 0.018,
    groundLevel: 0.55, caveThreshold: 0.35, overhangStrength: 0.4,
    warpStrength: 60, ridgeSharpness: 1.5, ridgeMix: 0.2,
    octaves: 4, lacunarity: 2.2, gain: 0.45,
    minGround: 0.3, smoothPasses: 3
  },
  volcanic: {
    baseFreq: 0.002, caveFreq: 0.005, detailFreq: 0.015,
    groundLevel: 0.58, caveThreshold: 0.3, overhangStrength: 0.35,
    warpStrength: 55, ridgeSharpness: 1.5, ridgeMix: 0.2,
    octaves: 4, lacunarity: 2.0, gain: 0.45,
    minGround: 0.38, smoothPasses: 3
  },
  candy: {
    baseFreq: 0.0012, caveFreq: 0.003, detailFreq: 0.008,
    groundLevel: 0.68, caveThreshold: 0.18, overhangStrength: 0.1,
    warpStrength: 55, ridgeSharpness: 0.6, ridgeMix: 0.03,
    octaves: 3, lacunarity: 1.8, gain: 0.35,
    minGround: 0.55, smoothPasses: 6
  },
  arctic: {
    baseFreq: 0.0015, caveFreq: 0.004, detailFreq: 0.01,
    groundLevel: 0.65, caveThreshold: 0.25, overhangStrength: 0.15,
    warpStrength: 35, ridgeSharpness: 0.8, ridgeMix: 0.06,
    octaves: 3, lacunarity: 2.0, gain: 0.38,
    minGround: 0.5, smoothPasses: 5
  },
  dark: {
    baseFreq: 0.0025, caveFreq: 0.006, detailFreq: 0.016,
    groundLevel: 0.55, caveThreshold: 0.32, overhangStrength: 0.4,
    warpStrength: 50, ridgeSharpness: 1.3, ridgeMix: 0.18,
    octaves: 4, lacunarity: 2.0, gain: 0.45,
    minGround: 0.32, smoothPasses: 3
  },
  ocean: {
    baseFreq: 0.0018, caveFreq: 0.004, detailFreq: 0.012,
    groundLevel: 0.58, caveThreshold: 0.28, overhangStrength: 0.25,
    warpStrength: 45, ridgeSharpness: 1.0, ridgeMix: 0.1,
    octaves: 4, lacunarity: 2.0, gain: 0.4,
    minGround: 0.4, smoothPasses: 4
  }
};


// ============================================================
// Phase 1: generateTerrainMask — noise to collision mask
// ============================================================

function generateTerrainMask(width: number, height: number, config: any): Uint8Array {
  var prof = TERRAIN_PROFILES[config.theme] || TERRAIN_PROFILES.forest;
  var complexity = config.complexity != null ? config.complexity : 0.5;
  var caves = config.caves !== false;
  var floatingIslands = config.floatingIslands === true;

  SimplexNoise2D.seed(config.seed || 42);
  var mask = new Uint8Array(width * height);

  // Adjust profile by complexity
  var caveT = prof.caveThreshold * (0.5 + complexity * 0.8);
  var overhang = prof.overhangStrength * complexity;
  var warp = prof.warpStrength * (0.8 + complexity * 0.4);

  for (var py = 0; py < height; py++) {
    for (var px = 0; px < width; px++) {
      var nx = px / width;
      var ny = py / height;

      // Domain warp for organic shapes
      var warped = SimplexNoise2D.domainWarp(nx * 8, ny * 8, warp / 100);
      var wx = warped[0];
      var wy = warped[1];

      // Layer 1: Continental shape (broad terrain form)
      var continental = SimplexNoise2D.fbm(wx * prof.baseFreq * 300, wy * prof.baseFreq * 300, prof.octaves, prof.lacunarity, prof.gain);
      continental = (continental + 1) * 0.5; // normalize 0-1

      // Layer 2: Ridge detail for cliff faces
      var ridge = SimplexNoise2D.ridgedMultifractal(wx * prof.baseFreq * 200, wy * prof.baseFreq * 200, 3, prof.lacunarity, 0.5, prof.ridgeSharpness);
      ridge = Math.min(1, ridge * 0.5);

      // Layer 3: Fine detail
      var detail = SimplexNoise2D.fbm(wx * prof.detailFreq * 100, wy * prof.detailFreq * 100, 3, 2.5, 0.4);
      detail = (detail + 1) * 0.5;

      // Combine layers
      var combined = continental * (1 - prof.ridgeMix) + ridge * prof.ridgeMix;
      combined += detail * 0.08;

      // Vertical gradient: denser at bottom, sparser at top
      // groundLevel defines where terrain transitions from mostly-solid to mostly-air
      var verticalFade = SimplexNoise2D.smoothstep(prof.groundLevel - 0.3, prof.groundLevel + 0.15, ny);
      // Below groundLevel: encourage solid. Above: encourage air.
      var terrainValue = combined - verticalFade * 0.8;

      // Add overhang bias at mid-heights
      if (ny > prof.groundLevel - 0.2 && ny < prof.groundLevel + 0.1) {
        var overhangNoise = SimplexNoise2D.fbm(wx * 5, wy * 5, 3, 2.0, 0.5);
        terrainValue += overhangNoise * overhang * 0.15;
      }

      // Cave carving
      if (caves && ny > 0.3) {
        var caveNoise = SimplexNoise2D.fbm(nx * prof.caveFreq * 500 + 100, ny * prof.caveFreq * 500 + 100, 4, 2.0, 0.5);
        caveNoise = (caveNoise + 1) * 0.5;
        if (caveNoise > (1 - caveT)) {
          terrainValue -= 0.5; // carve cave
        }
      }

      // Ensure solid floor at very bottom
      if (ny > 0.92) {
        terrainValue += (ny - 0.92) * 5;
      }

      // Floating islands (upper region)
      if (floatingIslands && ny < 0.4) {
        var islandNoise = SimplexNoise2D.fbm(nx * 4 + 200, ny * 4 + 200, 3, 2.0, 0.5);
        islandNoise = (islandNoise + 1) * 0.5;
        if (islandNoise > 0.72) {
          var islandStrength = (islandNoise - 0.72) / 0.28;
          terrainValue = Math.max(terrainValue, islandStrength * 0.6);
        }
      }

      // Threshold
      mask[py * width + px] = terrainValue > 0.42 ? 1 : 0;
    }
  }

  // Post-process: smooth edges (remove isolated pixels)
  for (var pass = 0; pass < prof.smoothPasses; pass++) {
    var tmp = new Uint8Array(mask);
    for (var sy = 1; sy < height - 1; sy++) {
      for (var sx = 1; sx < width - 1; sx++) {
        var idx = sy * width + sx;
        var neighbors = 0;
        neighbors += tmp[idx - 1] + tmp[idx + 1];
        neighbors += tmp[idx - width] + tmp[idx + width];
        neighbors += tmp[idx - width - 1] + tmp[idx - width + 1];
        neighbors += tmp[idx + width - 1] + tmp[idx + width + 1];
        // Cellular automata: need 5+ neighbors to survive, 6+ to be born
        if (tmp[idx] === 1) {
          mask[idx] = neighbors >= 4 ? 1 : 0;
        } else {
          mask[idx] = neighbors >= 6 ? 1 : 0;
        }
      }
    }
  }

  // Ensure left/right edges have ground for player entry/exit
  for (var ey = Math.floor(height * 0.5); ey < height; ey++) {
    for (var ex = 0; ex < 30; ex++) mask[ey * width + ex] = 1;
    for (var ex2 = width - 30; ex2 < width; ex2++) mask[ey * width + ex2] = 1;
  }

  return mask;
}


// ============================================================
// Phase 2: Real Texture Engine — PNG assets + Worms rendering pipeline
// ============================================================

// --- Terrain texture paths (served from media-stock CDN) ---
var TERRAIN_TEXTURE_PATHS: Record<string, any> = {
  forest:   { fill: '2d/textures/terrain/forest-fill.png',   surface: '2d/textures/terrain/forest-surface.png',   grass: '2d/textures/terrain/forest-grass.png' },
  sunset:   { fill: '2d/textures/terrain/sunset-fill.png',   surface: '2d/textures/terrain/sunset-surface.png',   grass: '2d/textures/terrain/sunset-grass.png' },
  volcanic: { fill: '2d/textures/terrain/volcanic-fill.png', surface: '2d/textures/terrain/volcanic-surface.png', grass: '2d/textures/terrain/volcanic-grass.png' },
  arctic:   { fill: '2d/textures/terrain/arctic-fill.png',   surface: '2d/textures/terrain/arctic-surface.png',   grass: '2d/textures/terrain/arctic-grass.png' },
  candy:    { fill: '2d/textures/terrain/candy-fill.png',    surface: '2d/textures/terrain/candy-surface.png',    grass: '2d/textures/terrain/candy-grass.png' },
  space:    { fill: '2d/textures/terrain/space-fill.png',    surface: '2d/textures/terrain/space-surface.png',    grass: '2d/textures/terrain/space-grass.png' },
  dark:     { fill: '2d/textures/terrain/dark-fill.png',     surface: '2d/textures/terrain/dark-surface.png',     grass: '2d/textures/terrain/dark-grass.png' },
  ocean:    { fill: '2d/textures/terrain/ocean-fill.png',    surface: '2d/textures/terrain/ocean-surface.png',    grass: '2d/textures/terrain/ocean-grass.png' },
};

// --- Water colors per theme ---
var TERRAIN_WATER_COLORS: Record<string, string> = {
  forest: '#2288bb', sunset: '#cc6644', volcanic: '#cc3300', arctic: '#5588aa',
  candy: '#ff66aa', space: '#2200aa', dark: '#332255', ocean: '#2277aa',
};

// --- Grass strip color configs (for procedural fallback) ---
var TERRAIN_GRASS_COLORS: Record<string, any> = {
  forest:   { tip: '#1a5510', dark: '#2a7518', main: '#3da025', light: '#60c840' },
  sunset:   { tip: '#305a10', dark: '#408020', main: '#5aaa30', light: '#7ad050' },
  volcanic: { tip: '#1a0a05', dark: '#332211', main: '#553322', light: '#664433' },
  arctic:   { tip: '#90b0c8', dark: '#a0c0d8', main: '#c8dde8', light: '#e8f5ff' },
  candy:    { tip: '#cc4488', dark: '#dd5599', main: '#ff88bb', light: '#ffaadd' },
  space:    { tip: '#3322aa', dark: '#5533bb', main: '#7755dd', light: '#9977ff' },
  dark:     { tip: '#151010', dark: '#2a2020', main: '#3a3030', light: '#4a4040' },
  ocean:    { tip: '#1a5530', dark: '#2a7540', main: '#3a9550', light: '#55bb77' },
};

// --- Fallback fill/surface colors when PNGs are not available ---
var TERRAIN_FALLBACK_COLORS: Record<string, any> = {
  forest:   { fill: { base: '#8b6340', light: '#a07850', dark: '#5c3d20' }, surface: { base: '#4a8c2a', light: '#6ab845', dark: '#2d6618' } },
  sunset:   { fill: { base: '#907050', light: '#a88565', dark: '#604530' }, surface: { base: '#5a9030', light: '#78b848', dark: '#3a6a18' } },
  volcanic: { fill: { base: '#5a4540', light: '#705a50', dark: '#3a2520' }, surface: { base: '#4a3a35', light: '#605048', dark: '#2a1a15' } },
  arctic:   { fill: { base: '#8899a5', light: '#a0b0bb', dark: '#607080' }, surface: { base: '#c8dde8', light: '#e0eef5', dark: '#90b0c8' } },
  candy:    { fill: { base: '#cc88bb', light: '#dda0cc', dark: '#aa6699' }, surface: { base: '#e87aaf', light: '#ff99cc', dark: '#c05588' } },
  space:    { fill: { base: '#2a2040', light: '#3a3055', dark: '#1a1028' }, surface: { base: '#5533aa', light: '#7755cc', dark: '#331188' } },
  dark:     { fill: { base: '#454040', light: '#5a5555', dark: '#252020' }, surface: { base: '#3a3535', light: '#504a4a', dark: '#1a1818' } },
  ocean:    { fill: { base: '#c8b080', light: '#ddc898', dark: '#a08858' }, surface: { base: '#cc7755', light: '#ee9977', dark: '#994433' } },
};


// --- Load a single image from URL ---
function _loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() { resolve(img); };
    img.onerror = function() { reject(new Error('Failed to load: ' + url)); };
    img.src = url;
  });
}

// --- Load terrain textures for a theme (fill+surface required, grass optional) ---
async function _loadTerrainTextures(theme: string): Promise<any> {
  var paths = TERRAIN_TEXTURE_PATHS[theme] || TERRAIN_TEXTURE_PATHS.forest;
  var origin = (window as any).__VIBEXE_API_ORIGIN__ || '';
  var baseUrl = origin + '/api/app-builder/media-stock/';

  var fillImg: HTMLImageElement | null = null;
  var surfaceImg: HTMLImageElement | null = null;
  var grassImg: HTMLImageElement | null = null;

  // Load fill + surface (the CC0 photogrammetry textures)
  try {
    var results = await Promise.all([
      _loadImage(baseUrl + paths.fill),
      _loadImage(baseUrl + paths.surface),
    ]);
    fillImg = results[0];
    surfaceImg = results[1];
  } catch(e) {
    console.warn('[LevelPainter] Fill/surface texture load failed:', e);
    return null;
  }

  // Load grass separately (optional — usually generated procedurally)
  try {
    grassImg = await _loadImage(baseUrl + paths.grass);
  } catch(e) { /* expected — grass is generated */ }

  return { fillImg: fillImg, surfaceImg: surfaceImg, grassImg: grassImg };
}

// --- Generate a fallback tiling pattern canvas (128x128) ---
function _createFallbackTexture(colors: any, seed: number): HTMLCanvasElement {
  var size = 128;
  var c = document.createElement('canvas');
  c.width = size; c.height = size;
  var fctx = c.getContext('2d')!;

  // Solid base fill
  fctx.fillStyle = colors.base;
  fctx.fillRect(0, 0, size, size);

  // Soft radial blobs for material variation (NOT per-pixel noise)
  SimplexNoise2D.seed(seed);
  for (var i = 0; i < 10; i++) {
    var bx = (SimplexNoise2D.noise2D(i * 3.7, seed * 0.1) * 0.5 + 0.5) * size;
    var by = (SimplexNoise2D.noise2D(seed * 0.1, i * 3.7) * 0.5 + 0.5) * size;
    var rad = 12 + Math.abs(SimplexNoise2D.noise2D(i * 2, seed)) * 28;
    var grad = fctx.createRadialGradient(bx, by, 0, bx, by, rad);
    grad.addColorStop(0, i % 2 === 0 ? colors.light : colors.dark);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.globalAlpha = 0.18 + Math.abs(SimplexNoise2D.noise2D(i, 0)) * 0.12;
    fctx.fillStyle = grad;
    fctx.beginPath();
    fctx.arc(bx, by, rad, 0, Math.PI * 2);
    fctx.fill();
  }

  // Subtle horizontal strata lines for earth-like look
  fctx.globalAlpha = 1;
  for (var sy = 4; sy < size; sy += 5 + Math.floor(Math.abs(SimplexNoise2D.noise2D(sy * 0.3, seed)) * 4)) {
    fctx.strokeStyle = colors.dark;
    fctx.globalAlpha = 0.06 + Math.abs(SimplexNoise2D.noise2D(sy * 0.2, seed * 0.5)) * 0.06;
    fctx.lineWidth = 0.5 + Math.abs(SimplexNoise2D.noise2D(sy * 0.1, 0));
    fctx.beginPath();
    fctx.moveTo(0, sy);
    for (var sx = 0; sx < size; sx += 8) {
      fctx.lineTo(sx, sy + SimplexNoise2D.noise2D(sx * 0.04, sy * 0.04) * 2);
    }
    fctx.stroke();
  }
  fctx.globalAlpha = 1;

  return c;
}

// --- Generate a blade-shaped grass strip canvas (256x24) ---
function _generateGrassStrip(theme: string, seed: number): HTMLCanvasElement {
  var w = 256, h = 24;
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var gctx = c.getContext('2d')!;

  var gc = TERRAIN_GRASS_COLORS[theme] || TERRAIN_GRASS_COLORS.forest;
  SimplexNoise2D.seed(seed + 888);

  // Step 1: Compute per-column blade top (irregular silhouette)
  var bladeTop = new Array(w);
  for (var bx = 0; bx < w; bx++) {
    // Multi-frequency noise for natural blade-like irregularity
    var n1 = SimplexNoise2D.noise2D(bx * 0.12, seed * 0.1);   // broad undulation
    var n2 = SimplexNoise2D.noise2D(bx * 0.4, seed * 0.3);    // medium variation
    var n3 = SimplexNoise2D.noise2D(bx * 1.0, seed * 0.7);    // fine blade tips
    var combined = n1 * 0.25 + n2 * 0.4 + n3 * 0.35;
    // Map to top pixel offset: 0 = tallest blade, 12 = shortest
    var topOff = Math.floor(2 + (1.0 - (combined * 0.5 + 0.5)) * 11);
    bladeTop[bx] = Math.max(0, Math.min(14, topOff));
  }

  // Step 2: Paint each column from bladeTop[x] down to h
  var imgData = gctx.createImageData(w, h);
  var px = imgData.data;

  // Parse hex colors to RGB
  function hexRgb(hex: string): number[] {
    var v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  var cTip = hexRgb(gc.tip);
  var cDark = hexRgb(gc.dark);
  var cMain = hexRgb(gc.main);
  var cLight = hexRgb(gc.light);

  for (var x = 0; x < w; x++) {
    var top = bladeTop[x];
    var bladeH = h - top;
    if (bladeH <= 0) continue;

    for (var y = top; y < h; y++) {
      var t = (y - top) / bladeH; // 0 at tip, 1 at base
      var idx = (y * w + x) * 4;

      // Pick color band based on position within blade
      var r: number, g: number, b: number;
      if (t < 0.12) {
        r = cTip[0]; g = cTip[1]; b = cTip[2];
      } else if (t < 0.28) {
        r = cDark[0]; g = cDark[1]; b = cDark[2];
      } else if (t < 0.65) {
        r = cMain[0]; g = cMain[1]; b = cMain[2];
      } else {
        r = cLight[0]; g = cLight[1]; b = cLight[2];
      }

      // Horizontal color jitter for variety
      var jn = SimplexNoise2D.noise2D(x * 0.35, y * 0.2 + seed);
      if (jn > 0.3) {
        r = Math.min(255, r + 15); g = Math.min(255, g + 15); b = Math.min(255, b + 10);
      } else if (jn < -0.3) {
        r = Math.max(0, r - 12); g = Math.max(0, g - 12); b = Math.max(0, b - 8);
      }

      // Alpha: full except tip pixel (soft) and bottom 5px (fade into fill)
      var a = 255;
      if (y === top) { a = 140; } // soft tip
      else if (y === top + 1) { a = 200; }
      else if (y >= h - 5) {
        a = Math.round(255 * (1.0 - (y - (h - 5)) / 5));
      }

      px[idx] = r; px[idx + 1] = g; px[idx + 2] = b; px[idx + 3] = a;
    }
  }

  gctx.putImageData(imgData, 0, 0);
  return c;
}


// --- Main terrain rendering: Worms-style multi-pass pipeline ---
async function renderTerrainCanvas(
  mask: Uint8Array, width: number, height: number,
  theme: string, seed: number
): Promise<HTMLCanvasElement> {
  var canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  var ctx = canvas.getContext('2d')!;

  // --- Load real PNG textures (or fall back to procedural) ---
  var textures = await _loadTerrainTextures(theme);

  var fillPat: CanvasPattern;
  var surfacePat: CanvasPattern;
  var grassCanvas: HTMLCanvasElement;

  if (textures) {
    fillPat = ctx.createPattern(textures.fillImg, 'repeat')!;
    surfacePat = ctx.createPattern(textures.surfaceImg, 'repeat')!;
    // Grass: use loaded PNG if available, otherwise generate blade-shaped strip
    if (textures.grassImg) {
      grassCanvas = document.createElement('canvas');
      grassCanvas.width = textures.grassImg.width;
      grassCanvas.height = textures.grassImg.height;
      var grassTmpCtx = grassCanvas.getContext('2d')!;
      grassTmpCtx.drawImage(textures.grassImg, 0, 0);
    } else {
      grassCanvas = _generateGrassStrip(theme, seed);
    }
  } else {
    // Fallback: generate decent pattern textures
    var fb = TERRAIN_FALLBACK_COLORS[theme] || TERRAIN_FALLBACK_COLORS.forest;
    var fillCanvas = _createFallbackTexture(fb.fill, seed);
    var surfCanvas = _createFallbackTexture(fb.surface, seed + 100);
    fillPat = ctx.createPattern(fillCanvas, 'repeat')!;
    surfacePat = ctx.createPattern(surfCanvas, 'repeat')!;
    grassCanvas = _generateGrassStrip(theme, seed);
  }

  // --- Compute per-column top surface Y ---
  var topSurface = new Int16Array(width);
  for (var tx = 0; tx < width; tx++) {
    topSurface[tx] = -1;
    for (var ty = 0; ty < height; ty++) {
      if (mask[ty * width + tx] === 1) { topSurface[tx] = ty; break; }
    }
  }

  // ===== PASS 1: Fill entire terrain shape with fill pattern =====
  ctx.save();
  ctx.beginPath();
  var inSolid = false;
  for (var px = 0; px < width; px++) {
    if (topSurface[px] >= 0) {
      if (!inSolid) { ctx.moveTo(px, topSurface[px]); inSolid = true; }
      else { ctx.lineTo(px, topSurface[px]); }
    } else if (inSolid) {
      ctx.lineTo(px, height);
      inSolid = false;
    }
  }
  if (inSolid) ctx.lineTo(width, height);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = fillPat;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // ===== PASS 2: Surface texture with gradient blend into fill =====
  // Band 1: Full-opacity surface (top 12px from surface)
  ctx.save();
  ctx.beginPath();
  for (var sx = 0; sx < width; sx++) {
    if (topSurface[sx] >= 0) {
      ctx.rect(sx, topSurface[sx], 1, Math.min(12, height - topSurface[sx]));
    }
  }
  ctx.clip();
  ctx.fillStyle = surfacePat;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Band 2: 4-step alpha gradient (12-24px, fading surface over fill)
  var blendSteps = [
    { startOff: 12, rows: 3, alpha: 0.85 },
    { startOff: 15, rows: 3, alpha: 0.60 },
    { startOff: 18, rows: 3, alpha: 0.35 },
    { startOff: 21, rows: 3, alpha: 0.12 },
  ];
  for (var bi = 0; bi < blendSteps.length; bi++) {
    var bs = blendSteps[bi];
    ctx.save();
    ctx.globalAlpha = bs.alpha;
    ctx.beginPath();
    for (var bsx = 0; bsx < width; bsx++) {
      if (topSurface[bsx] >= 0) {
        var bsy = topSurface[bsx] + bs.startOff;
        if (bsy + bs.rows <= height) {
          ctx.rect(bsx, bsy, 1, bs.rows);
        }
      }
    }
    ctx.clip();
    ctx.fillStyle = surfacePat;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // ===== PASS 3: Per-column grass strip painting (Worms edge texture) =====
  var grassW = grassCanvas.width;
  var grassH = grassCanvas.height;
  SimplexNoise2D.seed(seed + 888);

  for (var gx = 0; gx < width; gx++) {
    var gTopY = topSurface[gx];
    if (gTopY < 0 || gTopY > height - 3) continue;

    // 0-1px random jitter for natural contour
    var jitter = Math.round(SimplexNoise2D.noise2D(gx * 0.08, seed * 0.1) * 1.5);

    // Draw a 1px-wide slice of the grass strip texture at the surface
    ctx.drawImage(
      grassCanvas,
      gx % grassW, 0, 1, grassH,
      gx, gTopY + jitter, 1, grassH
    );
  }

  // ===== PASS 4: Bottom edge shadow (darken 5px upward from solid→air) =====
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (var shx = 0; shx < width; shx += 2) {
    for (var shy = 1; shy < height - 1; shy++) {
      var shIdx = shy * width + shx;
      if (mask[shIdx] === 1 && mask[shIdx + width] === 0) {
        var shadowH = Math.min(6, shy);
        ctx.fillRect(shx, shy - shadowH, 2, shadowH);
        break;
      }
    }
  }

  // ===== PASS 5: Surface highlight line (subtle edge light) =====
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  var hlStarted = false;
  for (var hx = 0; hx < width; hx++) {
    if (topSurface[hx] >= 0) {
      if (!hlStarted) { ctx.moveTo(hx, topSurface[hx]); hlStarted = true; }
      else ctx.lineTo(hx, topSurface[hx]);
    } else { hlStarted = false; }
  }
  ctx.stroke();

  // ===== PASS 6: Clear air pixels + soften edges =====
  var edgeData = ctx.getImageData(0, 0, width, height);
  var ed = edgeData.data;
  for (var ey = 0; ey < height; ey++) {
    for (var ex = 0; ex < width; ex++) {
      var eIdx = ey * width + ex;
      if (mask[eIdx] === 0) {
        ed[eIdx * 4 + 3] = 0;
      } else if (ey > 0 && ey < height - 1 && ex > 0 && ex < width - 1) {
        var air = 0;
        if (mask[eIdx - 1] === 0) air++;
        if (mask[eIdx + 1] === 0) air++;
        if (mask[eIdx - width] === 0) air++;
        if (mask[eIdx + width] === 0) air++;
        if (air > 0) {
          ed[eIdx * 4 + 3] = Math.max(80, 255 - air * 40);
        }
      }
    }
  }
  ctx.putImageData(edgeData, 0, 0);

  // ===== PASS 7: Theme-specific decorations =====
  _drawThemeDecorations(ctx, mask, topSurface, width, height, theme, seed);

  // ===== PASS 8: Water layer =====
  var waterColor = TERRAIN_WATER_COLORS[theme] || '#2288bb';
  _drawWaterLayer(ctx, width, height, waterColor, seed);

  return canvas;
}


// --- Theme-specific terrain decorations (no generic grass — handled by grass strip) ---
function _drawThemeDecorations(
  ctx: CanvasRenderingContext2D, mask: Uint8Array, topSurface: Int16Array,
  width: number, height: number, theme: string, seed: number
) {
  SimplexNoise2D.seed(seed + 999);

  // --- Top surface: theme-specific decorations only ---
  for (var x = 0; x < width; x++) {
    var topY = topSurface[x];
    if (topY < 0 || topY > height - 5) continue;

    var rng = SimplexNoise2D.noise2D(x * 0.15 + seed, topY * 0.05) * 0.5 + 0.5;

    if (theme === 'arctic') {
      // Snow mound bumps
      if (rng > 0.4 && x % 3 === 0) {
        ctx.fillStyle = 'rgba(220,235,250,0.8)';
        ctx.beginPath();
        ctx.ellipse(x, topY, 3 + rng * 4, 2 + rng * 2, 0, Math.PI, 0);
        ctx.fill();
      }
    } else if (theme === 'volcanic') {
      // Ember particles above surface
      if (rng > 0.88) {
        ctx.fillStyle = '#ff6622';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(x, topY - 2 - rng * 6, 1 + rng, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Ash/soot edge
      if (rng > 0.3 && x % 2 === 0) {
        ctx.fillStyle = 'rgba(30,20,15,0.3)';
        ctx.fillRect(x, topY, 1, 2);
      }
    } else if (theme === 'candy') {
      // Frosting drips
      if (rng > 0.3) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        var frostH = 2 + rng * 5;
        ctx.fillRect(x, topY - 1, 1, frostH);
        ctx.globalAlpha = 1;
      }
      // Sprinkles
      if (rng > 0.7 && x % 4 === 0) {
        var spColors = ['#ff4488', '#44ddff', '#ffdd22', '#44ff88', '#ff8844'];
        ctx.fillStyle = spColors[Math.floor(rng * 100) % spColors.length];
        ctx.fillRect(x, topY - 2, 2, 2);
      }
    } else if (theme === 'space') {
      // Glowing crystal spikes
      if (rng > 0.75 && x % 5 === 0) {
        var spikeH = 4 + rng * 10;
        ctx.fillStyle = '#9966ff';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - 2, topY);
        ctx.lineTo(x, topY - spikeH);
        ctx.lineTo(x + 2, topY);
        ctx.fill();
        ctx.fillStyle = '#ccaaff';
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(x - 1, topY);
        ctx.lineTo(x, topY - spikeH * 0.7);
        ctx.lineTo(x + 1, topY);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (theme === 'dark') {
      // Purple glowing veins
      if (rng > 0.8 && x % 3 === 0) {
        ctx.strokeStyle = '#8844cc';
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x + SimplexNoise2D.noise2D(x, seed) * 4, topY + 5 + rng * 8);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // --- Bottom surface decorations (cave ceilings) ---
  for (var bx = 0; bx < width; bx += 3) {
    for (var by = 0; by < height - 2; by++) {
      var bIdx = by * width + bx;
      if (mask[bIdx] === 1 && mask[bIdx + width] === 0) {
        var brng = SimplexNoise2D.noise2D(bx * 0.12 + 50, by * 0.12) * 0.5 + 0.5;

        if (theme === 'arctic' && brng > 0.5) {
          // Icicles
          var icicleH = 6 + brng * 18;
          ctx.fillStyle = 'rgba(180,215,245,0.7)';
          ctx.beginPath();
          ctx.moveTo(bx - 2, by + 1);
          ctx.lineTo(bx + 2, by + 1);
          ctx.lineTo(bx, by + 1 + icicleH);
          ctx.fill();
          ctx.fillStyle = 'rgba(220,240,255,0.4)';
          ctx.beginPath();
          ctx.moveTo(bx - 1, by + 1);
          ctx.lineTo(bx + 1, by + 1);
          ctx.lineTo(bx, by + 1 + icicleH * 0.6);
          ctx.fill();
        } else if ((theme === 'forest' || theme === 'ocean') && brng > 0.4) {
          // Hanging vines
          var vineH = 8 + brng * 15;
          ctx.strokeStyle = theme === 'ocean' ? 'rgba(40,100,60,0.5)' : 'rgba(50,110,40,0.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx, by + 1);
          ctx.quadraticCurveTo(bx + Math.sin(bx * 0.2) * 5, by + 1 + vineH * 0.5, bx + Math.sin(bx * 0.1) * 3, by + 1 + vineH);
          ctx.stroke();
        } else if (theme === 'volcanic' && brng > 0.6) {
          // Lava drips
          var dripH = 3 + brng * 8;
          ctx.fillStyle = 'rgba(255,100,20,0.7)';
          ctx.beginPath();
          ctx.moveTo(bx, by + 1);
          ctx.lineTo(bx + 1, by + 1);
          ctx.lineTo(bx + 0.5, by + 1 + dripH);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,200,50,0.3)';
          ctx.beginPath();
          ctx.arc(bx + 0.5, by + 1 + dripH, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (theme === 'dark' && brng > 0.55) {
          // Stalactites
          var stalH = 5 + brng * 12;
          ctx.fillStyle = 'rgba(60,55,55,0.8)';
          ctx.beginPath();
          ctx.moveTo(bx - 2, by + 1);
          ctx.lineTo(bx + 2, by + 1);
          ctx.lineTo(bx, by + 1 + stalH);
          ctx.fill();
        }
        break;
      }
    }
  }
}


// --- Water layer at the bottom ---
function _drawWaterLayer(ctx: CanvasRenderingContext2D, width: number, height: number, waterColor: string, seed: number) {
  var waterTop = Math.floor(height * 0.88);
  var waterH = height - waterTop;

  // Parse water color
  var wc = waterColor;

  // Water body gradient
  for (var wy = waterTop; wy < height; wy++) {
    var t = (wy - waterTop) / waterH;
    ctx.fillStyle = wc;
    ctx.globalAlpha = 0.3 + t * 0.4;
    ctx.fillRect(0, wy, width, 1);
  }
  ctx.globalAlpha = 1;

  // Wave surface line
  ctx.strokeStyle = wc;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, waterTop);
  for (var wx = 0; wx < width; wx += 4) {
    var waveY = waterTop + Math.sin(wx * 0.015 + seed * 0.1) * 3 + Math.sin(wx * 0.04) * 1.5;
    ctx.lineTo(wx, waveY);
  }
  ctx.stroke();

  // Surface highlights
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, waterTop + 1);
  for (var whx = 0; whx < width; whx += 4) {
    var whY = waterTop + 1 + Math.sin(whx * 0.02 + seed * 0.2) * 2;
    ctx.lineTo(whx, whY);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}


// ============================================================
// Phase 3: Collision Integration
// ============================================================

function extractColumnHeightmap(mask: Uint8Array, width: number, height: number): Int16Array {
  var heightmap = new Int16Array(width);
  for (var x = 0; x < width; x++) {
    heightmap[x] = -1; // no ground
    for (var y = 0; y < height; y++) {
      if (mask[y * width + x] === 1) {
        heightmap[x] = y;
        break;
      }
    }
  }
  return heightmap;
}

function generateTerrainBodies(
  mask: Uint8Array, width: number, height: number,
  createStaticBodyFn: any, createOneWayFn: any, physicsFns: any,
  resolution: number
): any[] {
  var bodies: any[] = [];
  var heightmap = extractColumnHeightmap(mask, width, height);

  // --- Top surface bodies (merged) ---
  var segStart = -1;
  var segY = -1;
  for (var x = 0; x < width; x += resolution) {
    // Sample the column at center
    var colX = Math.min(x + Math.floor(resolution / 2), width - 1);
    var topY = heightmap[colX];

    if (topY >= 0) {
      // Quantize Y to reduce unique heights
      var qY = Math.round(topY / 4) * 4;
      if (segStart < 0) {
        segStart = x;
        segY = qY;
      } else if (Math.abs(qY - segY) > 8) {
        // Height changed significantly, emit previous segment
        var segW = x - segStart;
        if (segW > 0) {
          var body = createStaticBodyFn(segStart + segW / 2, segY, segW, 12);
          bodies.push(body);
        }
        segStart = x;
        segY = qY;
      }
    } else {
      // Gap in terrain
      if (segStart >= 0) {
        var segW2 = x - segStart;
        if (segW2 > 0) {
          var body2 = createStaticBodyFn(segStart + segW2 / 2, segY, segW2, 12);
          bodies.push(body2);
        }
        segStart = -1;
      }
    }
  }
  // Emit last segment
  if (segStart >= 0) {
    var lastW = width - segStart;
    if (lastW > 0) {
      var lastBody = createStaticBodyFn(segStart + lastW / 2, segY, lastW, 12);
      bodies.push(lastBody);
    }
  }

  // --- Sub-surface terrain segments for slopes ---
  // Scan at multiple Y levels for better coverage of varied terrain
  var scanLevels = [0.25, 0.4, 0.55, 0.7, 0.85];
  for (var li = 0; li < scanLevels.length; li++) {
    var scanY = Math.floor(height * scanLevels[li]);
    var inSolid = false;
    var solidStart = 0;
    for (var sx = 0; sx < width; sx += resolution) {
      var cx = Math.min(sx + Math.floor(resolution / 2), width - 1);
      var isSolid = mask[scanY * width + cx] === 1;
      // Check if it's a top surface at this depth
      var isTopHere = isSolid && (scanY === 0 || mask[(scanY - 1) * width + cx] === 0);

      if (isTopHere && !inSolid) {
        solidStart = sx;
        inSolid = true;
      } else if (!isTopHere && inSolid) {
        var bw = sx - solidStart;
        if (bw >= resolution * 2) {
          var existing = false;
          for (var bi = 0; bi < bodies.length; bi++) {
            if (Math.abs(bodies[bi].y - scanY) < 16 && Math.abs(bodies[bi].x - (solidStart + bw/2)) < bw) {
              existing = true; break;
            }
          }
          if (!existing) {
            var sBody = createStaticBodyFn(solidStart + bw / 2, scanY, bw, 10);
            bodies.push(sBody);
          }
        }
        inSolid = false;
      }
    }
    if (inSolid) {
      var fbw = width - solidStart;
      if (fbw >= resolution * 2) {
        var fBody = createStaticBodyFn(solidStart + fbw / 2, scanY, fbw, 10);
        bodies.push(fBody);
      }
    }
  }

  // --- Cave ceiling bodies ---
  for (var cy = Math.floor(height * 0.2); cy < height - 10; cy += resolution * 2) {
    for (var cx2 = 0; cx2 < width; cx2 += resolution) {
      var cIdx = cy * width + cx2;
      if (mask[cIdx] === 1 && cy + 1 < height && mask[(cy + 1) * width + cx2] === 0) {
        // Found ceiling pixel: solid above, air below
        // Extend to find ceiling width
        var cStart = cx2;
        while (cStart > 0 && mask[cy * width + (cStart - resolution)] === 1 &&
               mask[(cy + 1) * width + (cStart - resolution)] === 0) cStart -= resolution;
        var cEnd = cx2;
        while (cEnd < width - resolution && mask[cy * width + (cEnd + resolution)] === 1 &&
               mask[(cy + 1) * width + (cEnd + resolution)] === 0) cEnd += resolution;
        var cw = cEnd - cStart + resolution;
        if (cw >= resolution * 3) {
          var cBody = createStaticBodyFn(cStart + cw / 2, cy + 6, cw, 12);
          bodies.push(cBody);
          cx2 = cEnd + resolution; // skip past this ceiling
        }
      }
    }
  }

  return bodies;
}


// ============================================================
// Phase 4: Background & Parallax
// ============================================================

function createParallaxBackground(
  worldW: number, worldH: number, theme: string, seed: number,
  drawSkyFn: any, drawStarsFn: any, drawMountainFn: any, drawFogFn: any, drawCloudFn: any,
  PAL: any
): any {
  var container = new PIXI.Container();
  var layers: any[] = [];

  // Layer 0: Sky gradient (fixed)
  try {
    var sky = drawSkyFn(worldW, worldH, PAL.skyTop, PAL.skyBottom);
    container.addChild(sky);
    layers.push({ gfx: sky, factor: 0 });
  } catch(e) {}

  // Layer 1: Stars (fixed)
  try {
    if (theme === 'space' || theme === 'dark' || theme === 'sunset') {
      var stars = drawStarsFn(worldW, worldH * 0.5, theme === 'space' ? 150 : 80);
      container.addChild(stars);
      layers.push({ gfx: stars, factor: 0 });
    }
  } catch(e) {}

  // Layers 2-4: Parallax mountains
  var mountainColors = PAL.mountains || [0x334455, 0x445566, 0x556677];
  for (var mi = 0; mi < 3; mi++) {
    try {
      var mColor = mountainColors[mi] || mountainColors[0];
      var mBaseY = worldH * 0.7 - mi * 60;
      var mMinH = 60 + mi * 30;
      var mMaxH = 120 + mi * 50;
      var mSpacing = 250 - mi * 30;
      var mAlpha = 0.4 + mi * 0.2;
      var mGfx = drawMountainFn(worldW, mBaseY, mColor, mAlpha, mMinH, mMaxH, mSpacing, theme, mi);
      container.addChild(mGfx);
      layers.push({ gfx: mGfx, factor: 0.05 + mi * 0.1 });
    } catch(e) {}
  }

  // Layer 5: Atmospheric fog
  try {
    var fogLayers = drawFogFn(worldW, worldH * 0.7, theme);
    if (fogLayers && fogLayers.length) {
      for (var fi = 0; fi < fogLayers.length; fi++) {
        container.addChild(fogLayers[fi]);
        layers.push({ gfx: fogLayers[fi], factor: 0.05 + fi * 0.08 });
      }
    }
  } catch(e) {}

  // Layer 6: Theme silhouettes (mid-ground decorative elements)
  try {
    var silhouettes = _createThemeSilhouettes(worldW, worldH * 0.65, theme, seed);
    if (silhouettes) {
      container.addChild(silhouettes);
      layers.push({ gfx: silhouettes, factor: 0.35 });
    }
  } catch(e) {}

  // Clouds
  try {
    if (theme !== 'space' && theme !== 'dark') {
      SimplexNoise2D.seed(seed + 777);
      var cloudCount = 5 + Math.floor(SimplexNoise2D.noise2D(seed, 0) * 3 + 3);
      for (var ci = 0; ci < cloudCount; ci++) {
        var cw = 80 + SimplexNoise2D.noise2D(ci * 7, seed) * 60 + 60;
        var ch = 25 + SimplexNoise2D.noise2D(ci * 13, seed) * 10 + 10;
        var cloud = drawCloudFn(cw, ch);
        cloud.x = (ci / cloudCount) * worldW + SimplexNoise2D.noise2D(ci, 0) * 100;
        cloud.y = 50 + SimplexNoise2D.noise2D(0, ci) * worldH * 0.25;
        if (theme === 'volcanic') { cloud.tint = 0x997766; cloud.alpha = 0.5; }
        container.addChild(cloud);
        layers.push({ gfx: cloud, factor: 0.02 + ci * 0.005, isCloud: true, speed: 5 + ci * 2 });
      }
    }
  } catch(e) {}

  return { layers: layers, container: container };
}

function _createThemeSilhouettes(worldW: number, baseY: number, theme: string, seed: number): any {
  var g = new PIXI.Graphics();
  SimplexNoise2D.seed(seed + 555);

  var count = 8 + Math.floor(Math.abs(SimplexNoise2D.noise2D(seed, 0)) * 6);
  var spacing = worldW / count;

  for (var i = 0; i < count; i++) {
    var x = i * spacing + SimplexNoise2D.noise2D(i * 3, seed) * spacing * 0.3;
    var rng = SimplexNoise2D.noise2D(i * 7 + seed, i * 3) * 0.5 + 0.5;
    var h = 30 + rng * 80;
    var w = 15 + rng * 40;
    var alpha = 0.15 + rng * 0.15;

    if (theme === 'forest' || theme === 'sunset') {
      // Tree silhouettes
      g.rect(x - 3, baseY - h * 0.4, 6, h * 0.4); g.fill({ color: 0x1a2a1a, alpha: alpha });
      g.circle(x, baseY - h * 0.5, w * 0.4); g.fill({ color: 0x1a2a1a, alpha: alpha });
      if (rng > 0.5) {
        g.circle(x - w * 0.2, baseY - h * 0.4, w * 0.3); g.fill({ color: 0x1a2a1a, alpha: alpha * 0.8 });
      }
    } else if (theme === 'volcanic') {
      // Jagged spires
      g.moveTo(x - w * 0.3, baseY); g.lineTo(x + rng * 5, baseY - h);
      g.lineTo(x + w * 0.3, baseY); g.fill({ color: 0x1a0a0a, alpha: alpha });
    } else if (theme === 'arctic') {
      // Ice pillars
      g.roundRect(x - w * 0.15, baseY - h * 0.6, w * 0.3, h * 0.6, 4);
      g.fill({ color: 0x8ab4c8, alpha: alpha * 0.6 });
    } else if (theme === 'candy') {
      // Lollipops
      g.rect(x - 2, baseY - h * 0.5, 4, h * 0.5); g.fill({ color: 0x8a5a3a, alpha: alpha });
      g.circle(x, baseY - h * 0.6, w * 0.25); g.fill({ color: rng > 0.5 ? 0xff6b9d : 0x6bcb77, alpha: alpha });
    } else if (theme === 'space') {
      // Alien structures
      g.moveTo(x - w * 0.2, baseY); g.lineTo(x - w * 0.1, baseY - h * 0.8);
      g.lineTo(x + w * 0.1, baseY - h * 0.8); g.lineTo(x + w * 0.2, baseY);
      g.fill({ color: 0x2a1a3a, alpha: alpha });
    } else if (theme === 'dark') {
      // Twisted trees
      g.rect(x - 3, baseY - h * 0.5, 5, h * 0.5); g.fill({ color: 0x0a0a0a, alpha: alpha });
      for (var bi = 0; bi < 3; bi++) {
        var bAngle = -0.5 + bi * 0.5 + rng * 0.3;
        var bLen = h * 0.2 + rng * 15;
        g.moveTo(x, baseY - h * (0.3 + bi * 0.08));
        g.lineTo(x + Math.cos(bAngle) * bLen, baseY - h * (0.3 + bi * 0.08) + Math.sin(bAngle) * bLen);
        g.stroke({ color: 0x0a0a0a, alpha: alpha, width: 2 });
      }
    } else if (theme === 'ocean') {
      // Kelp
      for (var ki = 0; ki < 3; ki++) {
        var kx = x + (ki - 1) * 8;
        var kh = h * (0.5 + rng * 0.3);
        g.moveTo(kx, baseY);
        g.quadraticCurveTo(kx + Math.sin(ki + seed) * 10, baseY - kh * 0.5, kx + Math.sin(ki) * 5, baseY - kh);
        g.stroke({ color: 0x1a4a2a, alpha: alpha * 0.7, width: 2 });
      }
    }
  }
  return g;
}

function updateParallax(layers: any[], cameraX: number, cameraY: number, dt: number, worldW: number) {
  for (var i = 0; i < layers.length; i++) {
    var layer = layers[i];
    if (layer.factor > 0) {
      layer.gfx.x = -cameraX * layer.factor;
      layer.gfx.y = -cameraY * layer.factor * 0.3;
    }
    // Animate clouds
    if (layer.isCloud && layer.speed) {
      layer.gfx.x += layer.speed * dt;
      if (layer.gfx.x > worldW + 200) layer.gfx.x = -200;
    }
  }
}


// ============================================================
// Phase 5: Object Population
// ============================================================

var THEME_DECORATIONS: Record<string, any[]> = {
  forest: [
    { type: 'tree', density: 0.8, minSpacing: 60, scale: [0.6, 1.2] },
    { type: 'bush', density: 1.5, minSpacing: 30, scale: [0.5, 0.9] },
    { type: 'flower', density: 2, minSpacing: 15, scale: [0.3, 0.6] },
    { type: 'rock', density: 0.6, minSpacing: 50, scale: [0.4, 1.0] },
    { type: 'mushroom', density: 0.4, minSpacing: 40, scale: [0.3, 0.7] },
  ],
  sunset: [
    { type: 'tree', density: 0.5, minSpacing: 80, scale: [0.7, 1.3] },
    { type: 'wheat', density: 3, minSpacing: 8, scale: [0.4, 0.8] },
    { type: 'flower', density: 1.5, minSpacing: 15, scale: [0.3, 0.5] },
    { type: 'rock', density: 0.3, minSpacing: 60, scale: [0.5, 0.8] },
  ],
  space: [
    { type: 'crystal', density: 1.0, minSpacing: 40, scale: [0.4, 1.0] },
    { type: 'alien-plant', density: 0.6, minSpacing: 50, scale: [0.5, 0.9] },
    { type: 'orb', density: 0.3, minSpacing: 80, scale: [0.3, 0.6] },
  ],
  volcanic: [
    { type: 'obsidian', density: 0.8, minSpacing: 40, scale: [0.4, 0.9] },
    { type: 'fire-crystal', density: 0.4, minSpacing: 60, scale: [0.5, 1.0] },
    { type: 'scorched-bush', density: 0.3, minSpacing: 50, scale: [0.4, 0.7] },
  ],
  candy: [
    { type: 'lollipop', density: 0.6, minSpacing: 60, scale: [0.5, 1.0] },
    { type: 'candy-cane', density: 0.4, minSpacing: 70, scale: [0.6, 1.0] },
    { type: 'gummy-plant', density: 1.0, minSpacing: 30, scale: [0.3, 0.7] },
  ],
  arctic: [
    { type: 'ice-crystal', density: 0.6, minSpacing: 50, scale: [0.4, 0.9] },
    { type: 'snow-rock', density: 0.5, minSpacing: 60, scale: [0.5, 1.0] },
    { type: 'frozen-bush', density: 0.3, minSpacing: 70, scale: [0.4, 0.8] },
  ],
  dark: [
    { type: 'dead-tree', density: 0.5, minSpacing: 70, scale: [0.6, 1.1] },
    { type: 'glow-mushroom', density: 0.8, minSpacing: 35, scale: [0.3, 0.7] },
    { type: 'thorn', density: 1.0, minSpacing: 25, scale: [0.3, 0.6] },
  ],
  ocean: [
    { type: 'coral', density: 0.8, minSpacing: 40, scale: [0.4, 0.9] },
    { type: 'seaweed', density: 1.2, minSpacing: 20, scale: [0.5, 1.0] },
    { type: 'starfish', density: 0.3, minSpacing: 60, scale: [0.3, 0.5] },
  ],
};


function _drawDecorationGraphic(type: string, theme: string, scale: number, seed: number): any {
  var g = new PIXI.Graphics();
  var s = scale;
  var rng = Math.abs(SimplexNoise2D.noise2D(seed * 0.1, type.charCodeAt(0))) * 0.5 + 0.5;

  if (type === 'tree') {
    // Trunk
    g.rect(-3 * s, -20 * s, 6 * s, 20 * s); g.fill({ color: 0x5a3a1a });
    // Canopy (layered circles for fullness)
    g.circle(0, -28 * s, 14 * s); g.fill({ color: 0x2a7a2a });
    g.circle(-5 * s, -25 * s, 10 * s); g.fill({ color: 0x3a8a3a });
    g.circle(5 * s, -26 * s, 11 * s); g.fill({ color: 0x2a7020 });
    // Highlight
    g.circle(-2 * s, -30 * s, 6 * s); g.fill({ color: 0x4aaa4a, alpha: 0.5 });
  } else if (type === 'bush') {
    g.ellipse(0, -6 * s, 12 * s, 8 * s); g.fill({ color: 0x2a6a2a });
    g.ellipse(-3 * s, -8 * s, 8 * s, 6 * s); g.fill({ color: 0x3a8a3a, alpha: 0.8 });
  } else if (type === 'flower') {
    // Stem
    g.rect(-0.5 * s, -8 * s, 1 * s, 8 * s); g.fill({ color: 0x3a7a3a });
    // Petals
    var petalColor = [0xff6b6b, 0xffd93d, 0xff9ff3, 0x54a0ff, 0xff6348][Math.floor(rng * 5)];
    g.circle(0, -10 * s, 3 * s); g.fill({ color: petalColor });
    g.circle(0, -10 * s, 1.5 * s); g.fill({ color: 0xffdd59 });
  } else if (type === 'rock') {
    g.moveTo(-8 * s, 0); g.lineTo(-6 * s, -10 * s); g.lineTo(2 * s, -12 * s);
    g.lineTo(8 * s, -6 * s); g.lineTo(7 * s, 0);
    g.fill({ color: 0x777777 });
    // Highlight
    g.moveTo(-4 * s, -8 * s); g.lineTo(0, -11 * s); g.lineTo(4 * s, -7 * s);
    g.fill({ color: 0x999999, alpha: 0.5 });
  } else if (type === 'mushroom') {
    g.rect(-1.5 * s, -4 * s, 3 * s, 4 * s); g.fill({ color: 0xccaa88 });
    g.ellipse(0, -5 * s, 6 * s, 4 * s); g.fill({ color: 0xcc3333 });
    g.circle(-2 * s, -6 * s, 1.5 * s); g.fill({ color: 0xffffff, alpha: 0.6 });
    g.circle(2 * s, -4.5 * s, 1 * s); g.fill({ color: 0xffffff, alpha: 0.5 });
  } else if (type === 'crystal' || type === 'ice-crystal' || type === 'fire-crystal') {
    var cColor = type === 'fire-crystal' ? 0xff5500 : type === 'ice-crystal' ? 0x88ccee : 0x9966ff;
    g.moveTo(0, -16 * s); g.lineTo(4 * s, -4 * s); g.lineTo(3 * s, 0);
    g.lineTo(-3 * s, 0); g.lineTo(-4 * s, -4 * s);
    g.fill({ color: cColor, alpha: 0.8 });
    g.moveTo(0, -16 * s); g.lineTo(1 * s, -4 * s); g.lineTo(-1 * s, -4 * s);
    g.fill({ color: 0xffffff, alpha: 0.3 });
  } else if (type === 'wheat') {
    g.rect(-0.5 * s, -12 * s, 1 * s, 12 * s); g.fill({ color: 0xccaa44 });
    g.ellipse(0, -14 * s, 2 * s, 3 * s); g.fill({ color: 0xddbb55 });
  } else if (type === 'lollipop') {
    g.rect(-1.5 * s, -20 * s, 3 * s, 20 * s); g.fill({ color: 0xffffff });
    g.circle(0, -24 * s, 6 * s); g.fill({ color: rng > 0.5 ? 0xff6b9d : 0x6bcb77 });
    g.circle(0, -24 * s, 3 * s); g.fill({ color: 0xffffff, alpha: 0.4 });
  } else if (type === 'candy-cane') {
    g.rect(-1.5 * s, -18 * s, 3 * s, 18 * s); g.fill({ color: 0xffffff });
    for (var si = 0; si < 6; si++) {
      g.rect(-1.5 * s, -18 * s + si * 6 * s, 3 * s, 3 * s); g.fill({ color: 0xff3333 });
    }
  } else if (type === 'gummy-plant') {
    g.ellipse(0, -5 * s, 6 * s, 6 * s);
    g.fill({ color: rng > 0.5 ? 0x44dd77 : 0xffaa33, alpha: 0.7 });
  } else if (type === 'obsidian') {
    g.moveTo(0, -10 * s); g.lineTo(5 * s, -2 * s); g.lineTo(4 * s, 0);
    g.lineTo(-4 * s, 0); g.lineTo(-5 * s, -3 * s);
    g.fill({ color: 0x222222 });
    g.moveTo(0, -10 * s); g.lineTo(2 * s, -3 * s); g.lineTo(-1 * s, -2 * s);
    g.fill({ color: 0x444444, alpha: 0.4 });
  } else if (type === 'scorched-bush') {
    g.ellipse(0, -4 * s, 8 * s, 5 * s); g.fill({ color: 0x3a2a1a });
    g.ellipse(-2 * s, -6 * s, 5 * s, 4 * s); g.fill({ color: 0x4a3a2a, alpha: 0.7 });
  } else if (type === 'snow-rock') {
    g.moveTo(-7 * s, 0); g.lineTo(-5 * s, -8 * s); g.lineTo(3 * s, -10 * s);
    g.lineTo(7 * s, -5 * s); g.lineTo(6 * s, 0);
    g.fill({ color: 0x888888 });
    // Snow cap
    g.moveTo(-5 * s, -8 * s); g.lineTo(3 * s, -10 * s); g.lineTo(5 * s, -7 * s);
    g.lineTo(-3 * s, -6 * s);
    g.fill({ color: 0xeeeeff });
  } else if (type === 'frozen-bush') {
    g.ellipse(0, -5 * s, 10 * s, 7 * s); g.fill({ color: 0x7799aa });
    g.ellipse(-3 * s, -7 * s, 6 * s, 5 * s); g.fill({ color: 0x99bbcc, alpha: 0.7 });
  } else if (type === 'dead-tree') {
    g.rect(-3 * s, -25 * s, 5 * s, 25 * s); g.fill({ color: 0x2a1a0a });
    // Branches
    g.moveTo(0, -20 * s); g.lineTo(-12 * s, -28 * s); g.stroke({ color: 0x2a1a0a, width: 2 });
    g.moveTo(0, -16 * s); g.lineTo(10 * s, -24 * s); g.stroke({ color: 0x2a1a0a, width: 2 });
    g.moveTo(0, -22 * s); g.lineTo(6 * s, -30 * s); g.stroke({ color: 0x2a1a0a, width: 1.5 });
  } else if (type === 'glow-mushroom') {
    g.rect(-1 * s, -3 * s, 2 * s, 3 * s); g.fill({ color: 0x554433 });
    g.ellipse(0, -4 * s, 5 * s, 3.5 * s); g.fill({ color: 0x6644aa });
    g.ellipse(0, -4 * s, 3 * s, 2 * s); g.fill({ color: 0xaa88ff, alpha: 0.5 });
  } else if (type === 'thorn') {
    g.moveTo(0, 0); g.lineTo(-1 * s, -8 * s); g.lineTo(1 * s, -8 * s);
    g.fill({ color: 0x3a1a3a });
  } else if (type === 'coral') {
    g.ellipse(0, -6 * s, 8 * s, 7 * s); g.fill({ color: 0xcc6655 });
    g.circle(-3 * s, -8 * s, 4 * s); g.fill({ color: 0xdd7766, alpha: 0.7 });
    g.circle(4 * s, -5 * s, 3 * s); g.fill({ color: 0xbb5544, alpha: 0.6 });
  } else if (type === 'seaweed') {
    for (var sw = 0; sw < 3; sw++) {
      var sx = (sw - 1) * 3 * s;
      g.moveTo(sx, 0);
      g.quadraticCurveTo(sx + Math.sin(sw + rng * 5) * 4 * s, -6 * s, sx + Math.sin(sw) * 3 * s, -12 * s);
      g.stroke({ color: 0x2a6a3a, width: 2, alpha: 0.7 });
    }
  } else if (type === 'starfish') {
    for (var si2 = 0; si2 < 5; si2++) {
      var angle = (si2 / 5) * Math.PI * 2 - Math.PI / 2;
      g.moveTo(0, -3 * s);
      g.lineTo(Math.cos(angle) * 5 * s, -3 * s + Math.sin(angle) * 5 * s);
    }
    g.fill({ color: 0xff8844 });
  } else if (type === 'alien-plant') {
    g.rect(-1 * s, -10 * s, 2 * s, 10 * s); g.fill({ color: 0x3a2a5a });
    g.circle(0, -12 * s, 4 * s); g.fill({ color: 0x66aaff, alpha: 0.7 });
  } else if (type === 'orb') {
    g.circle(0, -6 * s, 4 * s); g.fill({ color: 0x88ddff, alpha: 0.5 });
    g.circle(-1 * s, -7 * s, 1.5 * s); g.fill({ color: 0xffffff, alpha: 0.4 });
  }

  return g;
}

function populateTerrain(
  heightmap: Int16Array, width: number, height: number,
  theme: string, seed: number, container: any
): any[] {
  var decorRules = THEME_DECORATIONS[theme] || THEME_DECORATIONS.forest;
  var instances: any[] = [];

  SimplexNoise2D.seed(seed + 333);

  for (var ri = 0; ri < decorRules.length; ri++) {
    var rule = decorRules[ri];
    // Poisson-like spacing along terrain surface
    var spacing = Math.max(rule.minSpacing, 100 / Math.max(0.1, rule.density));
    var x = spacing * 0.5 + Math.abs(SimplexNoise2D.noise2D(ri * 17, seed)) * spacing * 0.5;

    while (x < width - 20) {
      var topY = heightmap[Math.min(Math.floor(x), width - 1)];
      if (topY >= 0 && topY < height - 10) {
        // Check slope (height difference between adjacent columns)
        var leftY = heightmap[Math.max(0, Math.floor(x) - 4)];
        var rightY = heightmap[Math.min(width - 1, Math.floor(x) + 4)];
        var slope = Math.abs((rightY - leftY) / 8);

        if (slope < 0.8) { // Not too steep
          var scale = rule.scale[0] + (rule.scale[1] - rule.scale[0]) *
            (SimplexNoise2D.noise2D(x * 0.02, ri * 10) * 0.5 + 0.5);

          var dec = _drawDecorationGraphic(rule.type, theme, scale, Math.floor(x * 13 + ri * 7));
          dec.x = x;
          dec.y = topY;
          container.addChild(dec);
          instances.push({ gfx: dec, type: rule.type, x: x, y: topY });
        }
      }

      // Advance with jitter
      var jitter = SimplexNoise2D.noise2D(x * 0.05, ri * 5) * spacing * 0.4;
      x += spacing + jitter;
    }
  }

  return instances;
}


// --- Spawn point generation ---
function generateSpawnPoints(heightmap: Int16Array, width: number, height: number, seed: number): any[] {
  var points: any[] = [];
  SimplexNoise2D.seed(seed + 111);

  // Player start: flat area near left edge
  var bestStartX = 50;
  var bestStartFlat = 999;
  for (var x = 30; x < Math.min(200, width * 0.15); x += 4) {
    var y = heightmap[x];
    if (y < 0 || y > height - 20) continue;
    var flatness = 0;
    for (var dx = -10; dx <= 10; dx++) {
      var nx = Math.max(0, Math.min(width - 1, x + dx));
      flatness += Math.abs(heightmap[nx] - y);
    }
    if (flatness < bestStartFlat) {
      bestStartFlat = flatness;
      bestStartX = x;
    }
  }
  points.push({ tag: 'player-start', x: bestStartX, y: heightmap[bestStartX] - 30 });

  // Enemy positions: flat areas distributed across level
  var enemyCount = Math.max(3, Math.floor(width / 500));
  for (var ei = 0; ei < enemyCount; ei++) {
    var targetX = (width * 0.2) + (width * 0.6) * (ei / Math.max(1, enemyCount - 1));
    var bestEX = Math.floor(targetX);
    var bestEFlat = 999;
    for (var ex = Math.floor(targetX - 80); ex < Math.min(width, targetX + 80); ex += 4) {
      if (ex < 0) continue;
      var ey = heightmap[ex];
      if (ey < 0 || ey > height - 20) continue;
      var ef = 0;
      for (var edx = -15; edx <= 15; edx++) {
        var enx = Math.max(0, Math.min(width - 1, ex + edx));
        ef += Math.abs(heightmap[enx] - ey);
      }
      if (ef < bestEFlat) { bestEFlat = ef; bestEX = ex; }
    }
    if (heightmap[bestEX] >= 0) {
      points.push({ tag: 'enemy-' + ei, x: bestEX, y: heightmap[bestEX] - 20 });
    }
  }

  // Coin positions: interesting locations
  var coinCount = Math.max(5, Math.floor(width / 150));
  for (var ci = 0; ci < coinCount; ci++) {
    var cx = Math.floor(width * 0.05 + (width * 0.9) * (ci / Math.max(1, coinCount - 1)));
    cx += Math.floor(SimplexNoise2D.noise2D(ci * 11, seed) * 40);
    cx = Math.max(10, Math.min(width - 10, cx));
    var cy = heightmap[cx];
    if (cy >= 0) {
      points.push({ tag: 'coin-' + ci, x: cx, y: cy - 25 - Math.abs(SimplexNoise2D.noise2D(ci * 3, 0)) * 30 });
    }
  }

  return points;
}


// ============================================================
// Phase 6: LevelSystem — engine.level namespace
// ============================================================

export class LevelSystem {
  private _engine: any;
  private _result: any = null;
  private _heightmap: Int16Array | null = null;
  private _mask: Uint8Array | null = null;
  private _width: number = 0;
  private _height: number = 0;
  private _helpers: any = null;

  constructor(engine: any) {
    this._engine = engine;
  }

  /** Call once before generate() to provide references to physics + drawing functions */
  setHelpers(helpers: any): void {
    this._helpers = helpers;
  }

  async generate(config: any): Promise<any> {
    var theme = config.theme || 'forest';
    var seed = config.seed || Math.floor(Math.random() * 999999);
    var complexity = config.complexity != null ? config.complexity : 0.5;
    var levelW = config.width || 3000;
    var levelH = config.height || 900;
    var h = this._helpers || {};

    var t0 = performance.now();

    // --- 1. Generate terrain mask ---
    var mask = generateTerrainMask(levelW, levelH, {
      theme: theme, seed: seed, complexity: complexity,
      caves: config.caves !== false,
      floatingIslands: config.floatingIslands === true
    });
    this._mask = mask;
    this._width = levelW;
    this._height = levelH;

    // --- 2. Render terrain visual ---
    var terrainCanvas = await renderTerrainCanvas(mask, levelW, levelH, theme, seed);
    var terrainSprite = PIXI.Sprite.from(terrainCanvas);
    terrainSprite.label = 'level-terrain';

    // --- 3. Extract heightmap and generate physics bodies ---
    var heightmap = extractColumnHeightmap(mask, levelW, levelH);
    this._heightmap = heightmap;

    var physBodies: any[] = [];
    try {
      if (h.createStaticBody) {
        physBodies = generateTerrainBodies(mask, levelW, levelH,
          h.createStaticBody, h.createOneWayPlatform, null, 8);
      }
    } catch(e) {
      console.warn('[LevelPainter] Physics body generation failed:', e);
    }

    // --- 4. Create parallax background ---
    var bgResult = { layers: [] as any[], container: new PIXI.Container() };
    if (config.parallax !== false) {
      try {
        if (h.drawSkyGradient && h.PAL) {
          bgResult = createParallaxBackground(levelW, levelH, theme, seed,
            h.drawSkyGradient, h.drawStars, h.drawMountainRange,
            h.drawAtmosphericFog, h.drawCloud, h.PAL);
        }
      } catch(e) {
        console.warn('[LevelPainter] Parallax generation failed:', e);
      }
    }

    // --- 5. Populate with decorations ---
    var decoContainer = new PIXI.Container();
    decoContainer.label = 'level-decorations';
    var decorations: any[] = [];
    if (config.population !== false) {
      decorations = populateTerrain(heightmap, levelW, levelH, theme, seed, decoContainer);
    }

    // --- 6. Generate spawn points ---
    var spawnPoints = generateSpawnPoints(heightmap, levelW, levelH, seed);

    // --- 7. Assemble final container ---
    var container = new PIXI.Container();
    container.label = 'level-painter';
    container.addChild(bgResult.container);
    container.addChild(terrainSprite);
    container.addChild(decoContainer);

    var elapsed = performance.now() - t0;
    console.log('[LevelPainter] Generated ' + theme + ' level (' + levelW + 'x' + levelH + ') in ' + Math.round(elapsed) + 'ms');

    this._result = {
      container: container,
      terrainSprite: terrainSprite,
      collisionMask: mask,
      heightmap: heightmap,
      bodies: physBodies,
      spawnPoints: spawnPoints,
      parallaxLayers: bgResult.layers,
      decorations: decorations,
      bounds: { x: 0, y: 0, width: levelW, height: levelH },
      theme: theme,
      seed: seed,
    };

    return this._result;
  }

  getSpawnPoint(tag: string): any {
    if (!this._result) return null;
    for (var i = 0; i < this._result.spawnPoints.length; i++) {
      if (this._result.spawnPoints[i].tag === tag) return this._result.spawnPoints[i];
    }
    return null;
  }

  getHeightAt(x: number): number {
    if (!this._heightmap || x < 0 || x >= this._width) return -1;
    return this._heightmap[Math.floor(x)];
  }

  isInsideTerrain(x: number, y: number): boolean {
    if (!this._mask || x < 0 || y < 0 || x >= this._width || y >= this._height) return false;
    return this._mask[Math.floor(y) * this._width + Math.floor(x)] === 1;
  }

  update(dt: number): void {
    if (!this._result) return;
    // Update parallax
    try {
      var cam = this._engine.camera;
      if (cam && this._result.parallaxLayers.length > 0) {
        updateParallax(this._result.parallaxLayers,
          cam._offsetX || 0, cam._offsetY || 0, dt, this._width);
      }
    } catch(e) {}
  }

  destroy(): void {
    if (this._result) {
      try { this._result.container.destroy({ children: true }); } catch(e) {}
      this._result = null;
    }
    this._heightmap = null;
    this._mask = null;
  }
}
`;
