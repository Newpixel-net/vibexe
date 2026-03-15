/**
 * Terrain Painter Module — Manifest & Registration
 *
 * First Vibexe module: GPU-accelerated procedural terrain texturing.
 * Converted from Unity Asset Store "Procedural Terrain Painter" by Staggart Creations.
 *
 * Features:
 * - Height-based texturing (snow on peaks, sand in valleys)
 * - Slope-based texturing (rock on cliffs, grass on flat areas)
 * - Curvature-based texturing (dirt in crevices, moss on ridges)
 * - Noise-based organic variation
 * - Direction-based texturing (sun-facing vs shadow)
 * - Texture mask overlays
 * - Up to 8 texture layers with modifier stacks
 * - GPU-accelerated via WebGLRenderTarget pipeline
 */

import type { ModuleManifest } from "../module-types";

export const TERRAIN_PAINTER_MANIFEST: ModuleManifest = {
	id: "terrain-painter",
	name: "Procedural Terrain Painter",
	version: "1.0.0",
	category: "terrain",
	description:
		"GPU-accelerated terrain texturing based on height, slope, curvature, noise & direction",
	icon: "Mountain",
	assets: [
		"textures/terrain/grass.jpg",
		"textures/terrain/rock.jpg",
		"textures/terrain/sand.jpg",
		"textures/terrain/snow.jpg",
		"textures/terrain/dirt.jpg",
	],
	runtimeCode: `
// @vibexe/terrain-painter v1.0.0
// Procedural terrain generation, PBR painting, sculpting, physics
var THREE = require('three');
var CANNON = typeof window !== 'undefined' ? window.CANNON : null;

// ============================================================
// SimplexNoise — 2D simplex noise with fBm, ridged, warp
// ============================================================

var _grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
var _p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
var _perm = new Array(512);
for (var _i = 0; _i < 512; _i++) _perm[_i] = _p[_i & 255];

SimplexNoise.seed = function(s) {
  // Seed-based permutation shuffle (Fisher-Yates with seeded PRNG)
  var shuffled = _p.slice();
  var m = shuffled.length;
  while (m) {
    s = (s * 16807 + 0) % 2147483647;
    var i = s % m--;
    var tmp = shuffled[m];
    shuffled[m] = shuffled[i];
    shuffled[i] = tmp;
  }
  for (var j = 0; j < 512; j++) _perm[j] = shuffled[j & 255];
};

function SimplexNoise() {}

SimplexNoise.noise2D = function(xin, yin) {
  var F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  var G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
  var s = (xin + yin) * F2;
  var i = Math.floor(xin + s);
  var j = Math.floor(yin + s);
  var t = (i + j) * G2;
  var X0 = i - t, Y0 = j - t;
  var x0 = xin - X0, y0 = yin - Y0;
  var i1, j1;
  if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
  var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  var x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
  var ii = i & 255, jj = j & 255;
  var gi0 = _perm[ii + _perm[jj]] % 12;
  var gi1 = _perm[ii + i1 + _perm[jj + j1]] % 12;
  var gi2 = _perm[ii + 1 + _perm[jj + 1]] % 12;
  var n0 = 0, n1 = 0, n2 = 0;
  var t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * (_grad3[gi0][0] * x0 + _grad3[gi0][1] * y0); }
  var t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * (_grad3[gi1][0] * x1 + _grad3[gi1][1] * y1); }
  var t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * (_grad3[gi2][0] * x2 + _grad3[gi2][1] * y2); }
  return 70.0 * (n0 + n1 + n2);
};

SimplexNoise.fbm = function(x, y, octaves, lacunarity, gain) {
  var sum = 0, amp = 1, freq = 1, maxAmp = 0;
  for (var o = 0; o < octaves; o++) {
    sum += SimplexNoise.noise2D(x * freq, y * freq) * amp;
    maxAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / maxAmp;
};

SimplexNoise.ridgedMultifractal = function(x, y, octaves, lacunarity, gain, sharpness) {
  var sum = 0, amp = 1, freq = 1, prev = 1;
  for (var o = 0; o < octaves; o++) {
    var n = SimplexNoise.noise2D(x * freq, y * freq);
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

SimplexNoise.domainWarp = function(x, y, strength) {
  var wx = SimplexNoise.fbm(x + 5.2, y + 1.3, 3, 2.0, 0.5) * strength;
  var wy = SimplexNoise.fbm(x + 9.7, y + 6.8, 3, 2.0, 0.5) * strength;
  return [x + wx, y + wy];
};

SimplexNoise.smoothstep = function(edge0, edge1, x) {
  var t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

SimplexNoise.worley = function(x, y) {
  // Return distance to nearest cell center (creates ridge patterns when inverted)
  var ix = Math.floor(x), iy = Math.floor(y);
  var minDist = 999;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      var cx = ix + dx + (SimplexNoise.noise2D((ix+dx)*0.7, (iy+dy)*0.7) * 0.5 + 0.5);
      var cy = iy + dy + (SimplexNoise.noise2D((ix+dx)*1.3, (iy+dy)*1.3) * 0.5 + 0.5);
      var d = Math.sqrt((x-cx)*(x-cx) + (y-cy)*(y-cy));
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
};

SimplexNoise.plateauCurve = function(h, steepness) {
  // S-curve that flattens peaks and creates natural plateau shapes
  // steepness controls transition sharpness (2-6 typical)
  return h / (1.0 + Math.pow(Math.abs(h), steepness) * 0.5);
};


// ============================================================
// Biome Presets — terrain generation parameter sets
// ============================================================

var BIOME_PRESETS = {
  alpine: {
    name: "Alpine Mountains",
    heightScale: [50, 80], segments: 128,
    continental: { gamma: [1.2, 1.6], freq: 0.8 },
    ridgeNetwork: { freq: [2.5, 3.5], power: [1.5, 2.2] },
    ridgeFractal: { sharpness: [1.0, 1.5], plateau: [2.5, 3.5] },
    hills: { amp: [0.06, 0.10] }, detail: { amp: [0.02, 0.04] },
    erosion: { thermalIter: [150, 220], talus: [0.25, 0.35], hydroDrops: [20000, 35000], peakRounds: [4, 7] },
    warp: [0.45, 0.65]
  },
  rolling_hills: {
    name: "Rolling Hills",
    heightScale: [12, 22], segments: 128,
    continental: { gamma: [1.0, 1.3], freq: 0.6 },
    ridgeNetwork: { freq: [1.5, 2.5], power: [0.8, 1.2] },
    ridgeFractal: { sharpness: [0.6, 1.0], plateau: [1.5, 2.5] },
    hills: { amp: [0.10, 0.18] }, detail: { amp: [0.03, 0.06] },
    erosion: { thermalIter: [80, 130], talus: [0.4, 0.6], hydroDrops: [8000, 15000], peakRounds: [6, 10] },
    warp: [0.35, 0.55]
  },
  desert_mesa: {
    name: "Desert Mesa",
    heightScale: [25, 45], segments: 128,
    continental: { gamma: [2.0, 2.8], freq: 0.7 },
    ridgeNetwork: { freq: [2.0, 3.0], power: [0.5, 1.0] },
    ridgeFractal: { sharpness: [0.3, 0.8], plateau: [5.0, 8.0] },
    hills: { amp: [0.03, 0.06] }, detail: { amp: [0.01, 0.02] },
    erosion: { thermalIter: [200, 350], talus: [0.2, 0.3], hydroDrops: [5000, 10000], peakRounds: [8, 14] },
    warp: [0.25, 0.40]
  },
  volcanic: {
    name: "Volcanic",
    heightScale: [55, 90], segments: 128,
    continental: { gamma: [1.8, 2.5], freq: 0.5 },
    ridgeNetwork: { freq: [1.8, 2.8], power: [2.0, 3.0] },
    ridgeFractal: { sharpness: [1.5, 2.5], plateau: [2.0, 3.0] },
    hills: { amp: [0.04, 0.08] }, detail: { amp: [0.03, 0.06] },
    erosion: { thermalIter: [100, 160], talus: [0.3, 0.5], hydroDrops: [15000, 25000], peakRounds: [3, 5] },
    warp: [0.50, 0.70]
  },
  coastal: {
    name: "Coastal Islands",
    heightScale: [8, 16], segments: 128,
    continental: { gamma: [0.8, 1.2], freq: 1.0 },
    ridgeNetwork: { freq: [3.0, 4.5], power: [1.0, 1.5] },
    ridgeFractal: { sharpness: [0.8, 1.3], plateau: [2.0, 3.0] },
    hills: { amp: [0.12, 0.20] }, detail: { amp: [0.04, 0.08] },
    erosion: { thermalIter: [50, 90], talus: [0.5, 0.7], hydroDrops: [5000, 12000], peakRounds: [5, 8] },
    warp: [0.60, 0.80]
  },
  canyon: {
    name: "Canyon Lands",
    heightScale: [30, 55], segments: 128,
    continental: { gamma: [1.5, 2.0], freq: 0.9 },
    ridgeNetwork: { freq: [2.5, 4.0], power: [2.0, 3.5] },
    ridgeFractal: { sharpness: [2.0, 3.0], plateau: [2.0, 3.0] },
    hills: { amp: [0.04, 0.07] }, detail: { amp: [0.02, 0.04] },
    erosion: { thermalIter: [250, 400], talus: [0.15, 0.25], hydroDrops: [35000, 55000], peakRounds: [2, 4] },
    warp: [0.40, 0.60]
  },
  tundra: {
    name: "Tundra Flatlands",
    heightScale: [5, 12], segments: 128,
    continental: { gamma: [0.8, 1.1], freq: 0.5 },
    ridgeNetwork: { freq: [1.0, 2.0], power: [0.3, 0.8] },
    ridgeFractal: { sharpness: [0.4, 0.8], plateau: [1.0, 2.0] },
    hills: { amp: [0.15, 0.25] }, detail: { amp: [0.05, 0.10] },
    erosion: { thermalIter: [60, 100], talus: [0.5, 0.8], hydroDrops: [3000, 8000], peakRounds: [8, 15] },
    warp: [0.30, 0.50]
  },
  badlands: {
    name: "Badlands",
    heightScale: [20, 40], segments: 128,
    continental: { gamma: [1.5, 2.2], freq: 0.8 },
    ridgeNetwork: { freq: [3.0, 5.0], power: [1.5, 2.5] },
    ridgeFractal: { sharpness: [2.0, 3.5], plateau: [3.0, 5.0] },
    hills: { amp: [0.05, 0.08] }, detail: { amp: [0.03, 0.06] },
    erosion: { thermalIter: [300, 500], talus: [0.12, 0.22], hydroDrops: [40000, 65000], peakRounds: [2, 4] },
    warp: [0.50, 0.70]
  },
  // ── Genre-specific terrain shapes ──
  runner_flat: {
    name: "Runner (Flat Track)",
    heightScale: [3, 8], segments: 128,
    continental: { gamma: [0.6, 0.9], freq: 0.3 },
    ridgeNetwork: { freq: [1.0, 1.5], power: [0.2, 0.5] },
    ridgeFractal: { sharpness: [0.3, 0.6], plateau: [1.0, 1.5] },
    hills: { amp: [0.08, 0.15] }, detail: { amp: [0.02, 0.04] },
    erosion: { thermalIter: [60, 100], talus: [0.6, 0.9], hydroDrops: [3000, 6000], peakRounds: [10, 18] },
    warp: [0.15, 0.30]
  },
  racing_smooth: {
    name: "Racing (Smooth Curves)",
    heightScale: [8, 18], segments: 128,
    continental: { gamma: [0.9, 1.2], freq: 0.4 },
    ridgeNetwork: { freq: [1.2, 2.0], power: [0.3, 0.7] },
    ridgeFractal: { sharpness: [0.4, 0.7], plateau: [1.5, 2.5] },
    hills: { amp: [0.12, 0.20] }, detail: { amp: [0.01, 0.03] },
    erosion: { thermalIter: [100, 180], talus: [0.5, 0.8], hydroDrops: [8000, 15000], peakRounds: [8, 14] },
    warp: [0.20, 0.40]
  },
  platformer_varied: {
    name: "Platformer (Gentle Hills & Plateaus)",
    heightScale: [4, 10], segments: 128,
    continental: { gamma: [0.8, 1.2], freq: 0.6 },
    ridgeNetwork: { freq: [0.5, 1.2], power: [0.2, 0.5] },
    ridgeFractal: { sharpness: [0.3, 0.7], plateau: [3.0, 5.0] },
    hills: { amp: [0.12, 0.22] }, detail: { amp: [0.02, 0.04] },
    erosion: { thermalIter: [120, 200], talus: [0.5, 0.8], hydroDrops: [8000, 15000], peakRounds: [8, 14] },
    warp: [0.10, 0.25]
  },
  strategy_overview: {
    name: "Strategy (Overview Plains)",
    heightScale: [6, 14], segments: 128,
    continental: { gamma: [0.7, 1.0], freq: 0.5 },
    ridgeNetwork: { freq: [1.5, 2.5], power: [0.4, 0.8] },
    ridgeFractal: { sharpness: [0.5, 0.9], plateau: [1.5, 2.5] },
    hills: { amp: [0.12, 0.22] }, detail: { amp: [0.03, 0.06] },
    erosion: { thermalIter: [80, 130], talus: [0.5, 0.7], hydroDrops: [5000, 12000], peakRounds: [6, 12] },
    warp: [0.25, 0.45]
  },
  fps_tactical: {
    name: "FPS (Tactical Terrain)",
    heightScale: [15, 30], segments: 128,
    continental: { gamma: [1.2, 1.6], freq: 0.7 },
    ridgeNetwork: { freq: [2.0, 3.0], power: [1.0, 1.8] },
    ridgeFractal: { sharpness: [0.8, 1.3], plateau: [2.0, 3.5] },
    hills: { amp: [0.08, 0.14] }, detail: { amp: [0.03, 0.05] },
    erosion: { thermalIter: [120, 200], talus: [0.35, 0.5], hydroDrops: [12000, 22000], peakRounds: [5, 9] },
    warp: [0.35, 0.55]
  },
  survival_wilderness: {
    name: "Survival (Dense Wilderness)",
    heightScale: [18, 35], segments: 128,
    continental: { gamma: [1.1, 1.5], freq: 0.6 },
    ridgeNetwork: { freq: [2.0, 3.0], power: [1.0, 1.6] },
    ridgeFractal: { sharpness: [0.7, 1.2], plateau: [2.0, 3.0] },
    hills: { amp: [0.10, 0.16] }, detail: { amp: [0.04, 0.07] },
    erosion: { thermalIter: [100, 170], talus: [0.4, 0.6], hydroDrops: [10000, 20000], peakRounds: [5, 9] },
    warp: [0.40, 0.60]
  },
  arena_flat: {
    name: "Arena (Flat)",
    heightScale: [2, 5], segments: 128,
    continental: { gamma: [0.4, 0.7], freq: 0.3 },
    ridgeNetwork: { freq: [0.3, 0.6], power: [0.1, 0.2] },
    ridgeFractal: { sharpness: [0.2, 0.4], plateau: [0.5, 1.0] },
    hills: { amp: [0.03, 0.08] }, detail: { amp: [0.01, 0.02] },
    erosion: { thermalIter: [80, 120], talus: [0.6, 0.9], hydroDrops: [4000, 8000], peakRounds: [12, 18] },
    warp: [0.05, 0.15]
  }
};

function _randomInRange(min, max, rng) {
  return min + (rng ? rng() : Math.random()) * (max - min);
}

function _seededRandom(seed) {
  var s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getBiomeParams(biomeId, seed) {
  var preset = BIOME_PRESETS[biomeId];
  if (!preset) preset = BIOME_PRESETS.alpine;
  var rng = _seededRandom(seed || Math.floor(Math.random() * 999999));

  return {
    biome: biomeId,
    seed: seed,
    heightScale: _randomInRange(preset.heightScale[0], preset.heightScale[1], rng),
    segments: preset.segments,
    continentalGamma: _randomInRange(preset.continental.gamma[0], preset.continental.gamma[1], rng),
    continentalFreq: preset.continental.freq,
    ridgeFreq: _randomInRange(preset.ridgeNetwork.freq[0], preset.ridgeNetwork.freq[1], rng),
    ridgePower: _randomInRange(preset.ridgeNetwork.power[0], preset.ridgeNetwork.power[1], rng),
    ridgeSharpness: _randomInRange(preset.ridgeFractal.sharpness[0], preset.ridgeFractal.sharpness[1], rng),
    plateauSteepness: _randomInRange(preset.ridgeFractal.plateau[0], preset.ridgeFractal.plateau[1], rng),
    hillsAmp: _randomInRange(preset.hills.amp[0], preset.hills.amp[1], rng),
    detailAmp: _randomInRange(preset.detail.amp[0], preset.detail.amp[1], rng),
    thermalIterations: Math.round(_randomInRange(preset.erosion.thermalIter[0], preset.erosion.thermalIter[1], rng)),
    talusAngle: _randomInRange(preset.erosion.talus[0], preset.erosion.talus[1], rng),
    hydroDrops: Math.round(_randomInRange(preset.erosion.hydroDrops[0], preset.erosion.hydroDrops[1], rng)),
    peakRounds: Math.round(_randomInRange(preset.erosion.peakRounds[0], preset.erosion.peakRounds[1], rng)),
    warpStrength: _randomInRange(preset.warp[0], preset.warp[1], rng)
  };
}


// ============================================================
// TerrainGenerator
// ============================================================

function TerrainGenerator(scene, options) {
  this.scene = scene;
  this.width = (options && options.width) || 100;
  this.depth = (options && options.depth) || 100;
  this.heightScale = (options && options.heightScale != null) ? options.heightScale : 30;
  this.segments = Math.min((options && options.segments) || 128, 128);
  this.mesh = null;
  this.heightData = null;
  this.minY = 0;
  this.maxY = 0;
  this._segX = this.segments + 1;
  this._segZ = this.segments + 1;
  this.biomeParams = (options && options.biomeParams) || null;
}

TerrainGenerator.prototype.generate = function() {
  // Remove existing terrain
  var old = this.scene.getObjectByName("__terrain__");
  if (old) {
    this.scene.remove(old);
    if (old.geometry) old.geometry.dispose();
    if (old.material) {
      // T-L1 fix: dispose material textures before disposing material itself
      var _texKeys = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "bumpMap", "displacementMap"];
      for (var _ti = 0; _ti < _texKeys.length; _ti++) { if (old.material[_texKeys[_ti]]) { try { old.material[_texKeys[_ti]].dispose(); } catch(e) {} } }
      old.material.dispose();
    }
  }

  var W = this.width, D = this.depth, H = this.heightScale, seg = this.segments;
  var segX = this._segX, segZ = this._segZ;

  // Use biome params if available, else defaults
  var bp = this.biomeParams || {};
  var _contGamma = bp.continentalGamma || 1.4;
  var _contFreq = bp.continentalFreq || 0.8;
  var _ridgeFreq = bp.ridgeFreq || 3.0;
  var _ridgePower = bp.ridgePower || 1.8;
  var _ridgeSharp = bp.ridgeSharpness || 1.3;
  var _plateauSteep = bp.plateauSteepness || 3.0;
  var _hillsAmp = bp.hillsAmp || 0.08;
  var _detailAmp = bp.detailAmp || 0.025;
  var _warpStr = bp.warpStrength || 0.55;

  // Seed the noise if biome params include a seed
  if (bp.seed) SimplexNoise.seed(bp.seed);

  // Create geometry laid flat on XZ plane
  var geo = new THREE.PlaneGeometry(W, D, seg, seg);
  geo.rotateX(-Math.PI / 2);

  var pos = geo.attributes.position;
  var minY = Infinity, maxY = -Infinity;
  var halfW = W * 0.5, halfD = D * 0.5;
  var heightData = new Float32Array(segX * segZ);

  for (var vi = 0; vi < pos.count; vi++) {
    var vx = pos.getX(vi);
    var vz = pos.getZ(vi);
    var nx = vx / W;  // normalized -0.5 to 0.5
    var nz = vz / D;

    // Edge falloff: fade to a BASE ELEVATION (not zero!) near borders
    // Use smooth quartic falloff for natural look
    var edgeX = 1.0 - Math.pow(2.0 * Math.abs(nx), 4);
    var edgeZ = 1.0 - Math.pow(2.0 * Math.abs(nz), 4);
    var edgeFalloff = SimplexNoise.smoothstep(0, 0.3, Math.max(0, Math.min(edgeX, edgeZ)));
    // Base elevation so edges aren't at zero (creates natural foothill border)
    var baseElevation = H * 0.08;

    // Domain warp for organic shapes (increased strength for more natural flow)
    var warpPt = SimplexNoise.domainWarp(nx * 1.8, nz * 1.8, _warpStr);
    var wx = warpPt[0], wz = warpPt[1];

    // === Layer 1: Continental base (broad mountain masses) ===
    var continental = (SimplexNoise.fbm(wx * _contFreq, wz * _contFreq, 6, 2.0, 0.5) + 1) * 0.5;
    continental = Math.pow(continental, _contGamma);

    // === Layer 2: Ridge network (connected mountain ranges via Worley noise) ===
    // Inverted Worley creates continuous ridgelines instead of isolated peaks
    var worleyVal = SimplexNoise.worley(nx * _ridgeFreq + 2.1, nz * _ridgeFreq + 0.8);
    var ridgeNetwork = 1.0 - SimplexNoise.smoothstep(0.0, 0.6, worleyVal);
    ridgeNetwork = Math.pow(ridgeNetwork, _ridgePower);

    // === Layer 3: Ridged multifractal for mountain detail ===
    var ridges = SimplexNoise.ridgedMultifractal(nx * 2.0 + 3.7, nz * 2.0 + 1.2, 4, 2.0, 0.45, _ridgeSharp);
    // Apply plateau curve to prevent needle peaks
    ridges = SimplexNoise.plateauCurve(ridges, _plateauSteep);
    ridges *= 0.25;

    // === Layer 4: Rolling foothills ===
    var hills = SimplexNoise.fbm(nx * 4.0 + 7.3, nz * 4.0 + 2.8, 4, 2.0, 0.5) * _hillsAmp;

    // === Layer 5: Fine surface detail (altitude-dependent) ===
    var detail = SimplexNoise.fbm(nx * 10.0, nz * 10.0, 3, 2.0, 0.4) * _detailAmp;

    // === Compose height with connected ridges ===
    // Continental provides broad masses, ridge network creates mountain chains,
    // ridged multifractal adds peak variation along the chains
    var mountainMask = continental * 0.5 + ridgeNetwork * 0.3;
    var peakDetail = ridges * (0.5 + mountainMask * 0.5);
    var baseH = mountainMask + peakDetail;

    // Altitude-dependent roughness (more detail at higher elevations)
    var roughDetail = (hills + detail) * (0.4 + Math.min(1, baseH) * 0.6);

    // Final height with base elevation at edges
    var h = (baseH + roughDetail) * edgeFalloff * H + baseElevation * (1.0 - edgeFalloff * 0.7);
    pos.setY(vi, h);
    heightData[vi] = h;
    if (h < minY) minY = h;
    if (h > maxY) maxY = h;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // ========== STAGE 1: Peak Rounding (smooth sharp peaks FIRST) ==========
  // Unlike old code which preserved peaks, this TARGETS peaks for smoothing
  var PEAK_ROUNDS = bp.peakRounds || 5;
  var PEAK_FACTOR = 0.5;
  for (var pr = 0; pr < PEAK_ROUNDS; pr++) {
    var peakSmoothed = new Float32Array(heightData.length);
    for (var pz = 0; pz < segZ; pz++) {
      for (var px = 0; px < segX; px++) {
        var pidx = pz * segX + px;
        if (px <= 1 || px >= segX - 2 || pz <= 1 || pz >= segZ - 2) {
          peakSmoothed[pidx] = heightData[pidx];
          continue;
        }
        // 8-neighbor average
        var pavg = (
          heightData[pidx - 1] + heightData[pidx + 1] +
          heightData[pidx - segX] + heightData[pidx + segX] +
          heightData[pidx - segX - 1] + heightData[pidx - segX + 1] +
          heightData[pidx + segX - 1] + heightData[pidx + segX + 1]
        ) * 0.125;
        var pdiff = heightData[pidx] - pavg;
        // Only smooth CONVEX areas (peaks/ridges where center > neighbors)
        if (pdiff > 0) {
          var peakBlend = Math.min(1.0, pdiff * 4.0) * PEAK_FACTOR;
          peakSmoothed[pidx] = heightData[pidx] - pdiff * peakBlend;
        } else {
          peakSmoothed[pidx] = heightData[pidx];
        }
      }
    }
    heightData = peakSmoothed;
  }

  // ========== STAGE 2: Improved Thermal Erosion ==========
  // More iterations, lower talus angle for more material movement
  var THERMAL_ITERATIONS = bp.thermalIterations || 180;
  var TALUS_ANGLE = bp.talusAngle || 0.3;
  var THERMAL_RATE = 0.35;
  for (var ti = 0; ti < THERMAL_ITERATIONS; ti++) {
    for (var tz = 1; tz < seg; tz++) {
      for (var tx = 1; tx < seg; tx++) {
        var ci = tz * segX + tx;
        var ch = heightData[ci];
        var diffs = [
          { idx: ci - 1, d: ch - heightData[ci - 1] },
          { idx: ci + 1, d: ch - heightData[ci + 1] },
          { idx: ci - segX, d: ch - heightData[ci - segX] },
          { idx: ci + segX, d: ch - heightData[ci + segX] }
        ];
        var maxDiff = 0, totalDiff = 0;
        for (var di = 0; di < 4; di++) {
          if (diffs[di].d > TALUS_ANGLE) {
            totalDiff += diffs[di].d;
            if (diffs[di].d > maxDiff) maxDiff = diffs[di].d;
          }
        }
        if (totalDiff > 0) {
          var moved = maxDiff * THERMAL_RATE * 0.5;
          heightData[ci] -= moved;
          for (var di2 = 0; di2 < 4; di2++) {
            if (diffs[di2].d > TALUS_ANGLE) {
              heightData[diffs[di2].idx] += moved * (diffs[di2].d / totalDiff);
            }
          }
        }
      }
    }
  }

  // ========== STAGE 3: Hydraulic Erosion (water flow + sediment) ==========
  // Simulates raindrops flowing downhill, carving channels and depositing sediment
  var HYDRO_DROPS = bp.hydroDrops || 25000;
  var HYDRO_INERTIA = 0.3;
  var HYDRO_CAPACITY = 8.0;
  var HYDRO_DEPOSITION = 0.02;
  var HYDRO_EROSION = 0.5;
  var HYDRO_EVAPORATION = 0.01;
  var HYDRO_MIN_SLOPE = 0.01;
  var HYDRO_RADIUS = 3;
  var HYDRO_GRAVITY = 10.0;
  var HYDRO_MAX_LIFETIME = 80;

  for (var drop = 0; drop < HYDRO_DROPS; drop++) {
    // Random starting position
    var dpx = Math.random() * (segX - 3) + 1;
    var dpz = Math.random() * (segZ - 3) + 1;
    var ddx = 0, ddz = 0; // direction
    var dspeed = 0;
    var dwater = 1;
    var dsediment = 0;

    for (var dlife = 0; dlife < HYDRO_MAX_LIFETIME; dlife++) {
      var dix = Math.floor(dpx), diz = Math.floor(dpz);
      if (dix < 1 || dix >= segX - 2 || diz < 1 || diz >= segZ - 2) break;

      var didx = diz * segX + dix;
      var dfx = dpx - dix, dfz = dpz - diz;

      // Bilinear height sample
      var dh00 = heightData[didx];
      var dh10 = heightData[didx + 1];
      var dh01 = heightData[didx + segX];
      var dh11 = heightData[didx + segX + 1];

      // Gradient (steepest descent direction)
      var dgx = (dh10 - dh00) * (1 - dfz) + (dh11 - dh01) * dfz;
      var dgz = (dh01 - dh00) * (1 - dfx) + (dh11 - dh10) * dfx;

      // Update direction with inertia
      ddx = ddx * HYDRO_INERTIA - dgx * (1 - HYDRO_INERTIA);
      ddz = ddz * HYDRO_INERTIA - dgz * (1 - HYDRO_INERTIA);

      // Normalize direction
      var dlen = Math.sqrt(ddx * ddx + ddz * ddz);
      if (dlen < 0.0001) {
        ddx = Math.random() * 2 - 1;
        ddz = Math.random() * 2 - 1;
        dlen = Math.sqrt(ddx * ddx + ddz * ddz);
      }
      ddx /= dlen;
      ddz /= dlen;

      // Move droplet
      var npx = dpx + ddx;
      var npz = dpz + ddz;

      // Check bounds
      if (npx < 1 || npx >= segX - 2 || npz < 1 || npz >= segZ - 2) break;

      // Height at new position (bilinear)
      var nix = Math.floor(npx), niz = Math.floor(npz);
      var nfx = npx - nix, nfz = npz - niz;
      var nidx = niz * segX + nix;
      var nh00 = heightData[nidx];
      var nh10 = heightData[nidx + 1];
      var nh01 = heightData[nidx + segX];
      var nh11 = heightData[nidx + segX + 1];
      var newH = nh00*(1-nfx)*(1-nfz) + nh10*nfx*(1-nfz) + nh01*(1-nfx)*nfz + nh11*nfx*nfz;
      var oldH = dh00*(1-dfx)*(1-dfz) + dh10*dfx*(1-dfz) + dh01*(1-dfx)*dfz + dh11*dfx*dfz;
      var dhDiff = newH - oldH;

      // Sediment capacity based on speed and slope
      var dslope = Math.max(-dhDiff, HYDRO_MIN_SLOPE);
      var dcapacity = Math.max(dslope * dspeed * dwater * HYDRO_CAPACITY, 0.01);

      if (dsediment > dcapacity || dhDiff > 0) {
        // Deposit sediment
        var depositAmt = (dhDiff > 0)
          ? Math.min(dsediment, dhDiff)
          : (dsediment - dcapacity) * HYDRO_DEPOSITION;
        depositAmt = Math.max(0, depositAmt);
        dsediment -= depositAmt;

        // Deposit at old position (bilinear weights)
        heightData[didx] += depositAmt * (1-dfx) * (1-dfz);
        heightData[didx+1] += depositAmt * dfx * (1-dfz);
        heightData[didx+segX] += depositAmt * (1-dfx) * dfz;
        heightData[didx+segX+1] += depositAmt * dfx * dfz;
      } else {
        // Erode terrain
        var erodeAmt = Math.min((dcapacity - dsediment) * HYDRO_EROSION, -dhDiff);
        erodeAmt = Math.max(0, erodeAmt);

        // Erode in a small radius for wider valleys
        for (var erz = -HYDRO_RADIUS; erz <= HYDRO_RADIUS; erz++) {
          for (var erx = -HYDRO_RADIUS; erx <= HYDRO_RADIUS; erx++) {
            var eix = dix + erx, eiz = diz + erz;
            if (eix < 0 || eix >= segX || eiz < 0 || eiz >= segZ) continue;
            var edist = Math.sqrt(erx*erx + erz*erz);
            if (edist > HYDRO_RADIUS) continue;
            var eweight = Math.max(0, 1.0 - edist / HYDRO_RADIUS);
            eweight = eweight * eweight; // quadratic falloff
            var eidx = eiz * segX + eix;
            heightData[eidx] -= erodeAmt * eweight * 0.1;
          }
        }
        dsediment += erodeAmt;
      }

      // Update speed and water
      dspeed = Math.sqrt(Math.max(0, dspeed * dspeed - dhDiff * HYDRO_GRAVITY));
      dwater *= (1 - HYDRO_EVAPORATION);
      if (dwater < 0.001) break;

      dpx = npx;
      dpz = npz;
    }
  }

  // ========== STAGE 4: Post-erosion smoothing (gentle, preserve valleys) ==========
  var SMOOTH_ITERATIONS = 4;
  var SMOOTH_FACTOR = 0.3;
  for (var si = 0; si < SMOOTH_ITERATIONS; si++) {
    var smoothed = new Float32Array(heightData.length);
    for (var sz = 0; sz < segZ; sz++) {
      for (var sx = 0; sx < segX; sx++) {
        var sidx = sz * segX + sx;
        if (sx === 0 || sx === segX - 1 || sz === 0 || sz === segZ - 1) {
          smoothed[sidx] = heightData[sidx];
          continue;
        }
        var avg4 = (heightData[sidx-1] + heightData[sidx+1] + heightData[sidx-segX] + heightData[sidx+segX]) * 0.25;
        var sdiff = avg4 - heightData[sidx];
        // Gentle uniform smoothing (no feature preservation bias)
        smoothed[sidx] = heightData[sidx] + sdiff * SMOOTH_FACTOR;
      }
    }
    heightData = smoothed;
  }

  // Write eroded heights back to geometry
  minY = Infinity; maxY = -Infinity;
  for (var ei = 0; ei < pos.count; ei++) {
    pos.setY(ei, heightData[ei]);
    if (heightData[ei] < minY) minY = heightData[ei];
    if (heightData[ei] > maxY) maxY = heightData[ei];
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Normalize so minimum height = 0 (terrain IS the game floor)
  if (minY !== 0) {
    var shift = -minY;
    for (var nvi = 0; nvi < pos.count; nvi++) {
      var shiftedY = pos.getY(nvi) + shift;
      pos.setY(nvi, shiftedY);
      heightData[nvi] = shiftedY;
    }
    maxY += shift;
    minY = 0;
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // Per-vertex height (0-1) and slope (degrees) attributes
  var heightArr = new Float32Array(pos.count);
  var slopeArr = new Float32Array(pos.count);
  var normAttr = geo.attributes.normal;
  var range = maxY - minY || 1;
  for (var vi2 = 0; vi2 < pos.count; vi2++) {
    heightArr[vi2] = (pos.getY(vi2) - minY) / range;
    var ny = normAttr.getY(vi2);
    slopeArr[vi2] = Math.acos(Math.min(1, Math.abs(ny))) * (180 / Math.PI);
  }
  geo.setAttribute("terrainHeight", new THREE.BufferAttribute(heightArr, 1));
  geo.setAttribute("terrainSlope", new THREE.BufferAttribute(slopeArr, 1));

  // Vertex colors: mountain gradient (dirt/grass/rock/snow)
  var colors = new Float32Array(pos.count * 3);
  for (var vi3 = 0; vi3 < pos.count; vi3++) {
    var nh = heightArr[vi3];
    var slope = slopeArr[vi3];
    var r, g, b;
    // Snow on high peaks (soft transition)
    if (nh > 0.65 && slope < 40) {
      var sf = SimplexNoise.smoothstep(0.6, 0.75, nh);
      r = 0.75 + sf * 0.2; g = 0.78 + sf * 0.18; b = 0.82 + sf * 0.15;
    }
    // Rock on steep slopes (at any height)
    else if (slope > 35) {
      var rockVar = SimplexNoise.noise2D(pos.getX(vi3) * 0.1, pos.getZ(vi3) * 0.1) * 0.08;
      r = 0.42 + rockVar; g = 0.40 + rockVar; b = 0.38 + rockVar;
    }
    // Grass on mid-heights
    else if (nh > 0.15 && nh <= 0.65) {
      var grassVar = SimplexNoise.noise2D(pos.getX(vi3) * 0.15, pos.getZ(vi3) * 0.15) * 0.06;
      var heightBlend = SimplexNoise.smoothstep(0.15, 0.3, nh);
      r = 0.28 + grassVar; g = 0.42 + grassVar + heightBlend * 0.05; b = 0.18 + grassVar;
    }
    // Dirt/sand at low elevations
    else {
      var dirtVar = SimplexNoise.noise2D(pos.getX(vi3) * 0.12, pos.getZ(vi3) * 0.12) * 0.05;
      r = 0.48 + dirtVar; g = 0.38 + dirtVar; b = 0.25 + dirtVar;
    }
    colors[vi3 * 3] = r;
    colors[vi3 * 3 + 1] = g;
    colors[vi3 * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  var mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: false
  });

  var mesh = new THREE.Mesh(geo, mat);
  mesh.name = "__terrain__";
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.userData.vibexeType = "Terrain";
  mesh.userData.__isTerrain = true;
  mesh.userData.__terrainMinY = minY;
  mesh.userData.__terrainMaxY = maxY;
  mesh.userData.__terrainWidth = W;
  this.scene.add(mesh);

  this.mesh = mesh;
  this.heightData = heightData;
  this.minY = minY;
  this.maxY = maxY;

  // Store globally for physics and height queries
  window.__vibexe_terrainData = {
    heightData: heightData,
    width: W,
    depth: D,
    segX: segX,
    segZ: segZ,
    minY: minY,
    maxY: maxY
  };

  // Bilinear interpolation height query (O(1) per call)
  var self = this;
  window.__vibexe_getTerrainHeight = function(x, z) {
    return self.getHeightAt(x, z);
  };

  // X7 fix: publish terrain surface offset for character-system module interop
  // This offset accounts for PBR grass/vegetation visual height above geometric surface
  window.__vibexe_terrainSurfaceOffset = 0.15;

  // Hide ground plane and grid
  this.scene.traverse(function(child) {
    if (child === mesh) return;
    if (child.isMesh && !child.name) {
      var cGeo = child.geometry;
      if (cGeo && cGeo.type === "PlaneGeometry") {
        var cParams = cGeo.parameters;
        if (cParams && (cParams.width >= 50 || cParams.height >= 50)) {
          child.visible = false;
          child.userData.__hiddenByTerrain = true;
        }
      }
    }
    if (child.isGridHelper || child.type === "GridHelper") {
      child.visible = false;
      child.userData.__hiddenByTerrain = true;
    }
  });

  console.log("[TerrainGenerator] Generated:", pos.count, "vertices, height range:", minY.toFixed(1), "-", maxY.toFixed(1));
  return mesh;
};

TerrainGenerator.prototype.getHeightAt = function(x, z) {
  var td = window.__vibexe_terrainData;
  if (!td || !td.heightData) return null;
  // T3 fix: return null for positions outside terrain bounds
  var halfW = td.width * 0.5, halfD = td.depth * 0.5;
  if (x < -halfW || x > halfW || z < -halfD || z > halfD) return null;
  var gx = (x + halfW) / td.width * (td.segX - 1);
  var gz = (z + halfD) / td.depth * (td.segZ - 1);
  gx = Math.max(0, Math.min(td.segX - 2, gx));
  gz = Math.max(0, Math.min(td.segZ - 2, gz));
  var ix = Math.floor(gx), iz = Math.floor(gz);
  var fx = gx - ix, fz = gz - iz;
  var i00 = iz * td.segX + ix;
  // T2 fix: bounds check before array access
  var maxIdx = i00 + td.segX + 1;
  if (maxIdx >= td.heightData.length || i00 < 0) return null;
  var h00 = td.heightData[i00];
  var h10 = td.heightData[i00 + 1];
  var h01 = td.heightData[i00 + td.segX];
  var h11 = td.heightData[i00 + td.segX + 1];
  var result = h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
  return isNaN(result) ? null : result;
};

TerrainGenerator.prototype.getMesh = function() {
  return this.mesh;
};

TerrainGenerator.prototype.getHeightData = function() {
  return this.heightData;
};

TerrainGenerator.prototype.destroy = function() {
  if (this.mesh) {
    this.scene.remove(this.mesh);
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
    this.mesh = null;
  }
  this.heightData = null;
  window.__vibexe_terrainData = null;
  window.__vibexe_getTerrainHeight = null;
  // T-L2 fix: clear surface offset global on terrain destroy
  window.__vibexe_terrainSurfaceOffset = 0;
};


// ============================================================
// TerrainPhysics — CANNON.js Heightfield + Rapier Heightfield
// ============================================================

function TerrainPhysics(terrainGenerator) {
  this.terrainGen = terrainGenerator;
  this.body = null;
  this.shape = null;
  this.world = null;
  this._postStepFn = null;
  this._watcherInterval = null;
  // Rapier terrain collider (parallel physics world)
  this._rapierBody = null;
  this._rapierCollider = null;
}

// Helper: Build Rapier heightfield from terrain data
TerrainPhysics.prototype._setupRapierHeightfield = function(td) {
  var R = window.RAPIER;
  var rw = window.__vibexe_rapierWorld__;
  if (!R || !rw || !td) return;

  // Remove previous Rapier terrain
  if (this._rapierCollider) {
    try { rw.removeCollider(this._rapierCollider, true); } catch(e) {}
    this._rapierCollider = null;
  }
  if (this._rapierBody) {
    try { rw.removeRigidBody(this._rapierBody); } catch(e) {}
    this._rapierBody = null;
  }

  try {
    // Rapier heightfield: nrows (X) x ncols (Z), Float32Array in row-major order
    // Our heightData[z * segX + x] → rapier heights[x * segZ + z]
    var nrows = td.segX;
    var ncols = td.segZ;
    var heights = new Float32Array(nrows * ncols);
    for (var x = 0; x < nrows; x++) {
      for (var z = 0; z < ncols; z++) {
        heights[x * ncols + z] = td.heightData[z * nrows + x];
      }
    }

    // Scale: heightfield spans -scale/2 to +scale/2 on X and Z, heights scaled by Y
    var scale = { x: td.width, y: 1.0, z: td.depth };
    var colliderDesc = R.ColliderDesc.heightfield(nrows, ncols, heights, scale);

    // Fixed body at origin (Rapier centers the heightfield automatically)
    var bodyDesc = R.RigidBodyDesc.fixed();
    this._rapierBody = rw.createRigidBody(bodyDesc);
    this._rapierCollider = rw.createCollider(colliderDesc, this._rapierBody);

    window.__vibexe_rapierTerrainBody__ = this._rapierBody;
    window.__vibexe_rapierTerrainCollider__ = this._rapierCollider;
    console.log("[TerrainPhysics] Rapier heightfield created:", nrows, "x", ncols, "scale:", td.width + "x" + td.depth);
  } catch(err) {
    console.error("[TerrainPhysics] Rapier heightfield failed:", err);
  }
};

TerrainPhysics.prototype.setup = function(world) {
  // T15 fix: prefer module-level CANNON capture, fallback to window (protects against global overwrites)
  var C = CANNON || window.CANNON;
  if (!C || !world) {
    // World not ready — set up a watcher
    console.warn("[TerrainPhysics] World not ready — will create heightfield when physics starts");
    var self = this;
    // T4 fix: clear any prior watcher from previous terrain instance to prevent leaks
    if (window.__vibexe_terrainPhysicsWatcher) {
      clearInterval(window.__vibexe_terrainPhysicsWatcher);
      window.__vibexe_terrainPhysicsWatcher = null;
    }
    if (!this._watcherInterval) {
      this._watcherInterval = setInterval(function() {
        var dC = window.CANNON;
        var dW = window.__vibexe_world__;
        var dTD = window.__vibexe_terrainData;
        if (dC && dW && dTD && !window.__vibexe_terrainBody) {
          clearInterval(self._watcherInterval);
          self._watcherInterval = null;
          window.__vibexe_terrainPhysicsWatcher = null;
          self.setup(dW);
        }
      }, 200);
      window.__vibexe_terrainPhysicsWatcher = this._watcherInterval;
    }
    return;
  }

  this.world = world;

  // Remove previous terrain body
  if (window.__vibexe_terrainBody) {
    try { world.removeBody(window.__vibexe_terrainBody); } catch(e) {}
    window.__vibexe_terrainBody = null;
  }

  // Disable infinite ground plane (terrain replaces it)
  for (var bi = 0; bi < world.bodies.length; bi++) {
    var gpBody = world.bodies[bi];
    if (gpBody.mass === 0 && gpBody.shapes && gpBody.shapes.length === 1 && gpBody.shapes[0] instanceof C.Plane) {
      gpBody.position.set(0, -10000, 0);
      gpBody.updateMassProperties();
      window.__vibexe_groundPlaneBody = gpBody;
      console.log("[TerrainPhysics] Disabled ground plane (moved to Y=-10000)");
      break;
    }
  }

  var td = window.__vibexe_terrainData;
  if (!td) return;

  // Build column-major height matrix for CANNON Heightfield
  // CANNON grid: hz=0 → world Z=+D/2, hz=end → world Z=-D/2 (after rotation+offset)
  // HeightData: row 0 → world Z=-D/2, row end → world Z=+D/2
  // So we reverse Z: use (segZ - 1 - hz) to align CANNON grid with visual mesh
  var matrix = [];
  for (var hx = 0; hx < td.segX; hx++) {
    matrix.push([]);
    for (var hz = 0; hz < td.segZ; hz++) {
      matrix[hx].push(td.heightData[(td.segZ - 1 - hz) * td.segX + hx]);
    }
  }

  var elementSize = td.width / (td.segX - 1);
  try {
    this.shape = new C.Heightfield(matrix, { elementSize: elementSize });
    this.body = new C.Body({ mass: 0, type: C.Body.STATIC });
    this.body.addShape(this.shape);
    // CANNON Heightfield: height along local Z, rotate -90 X to align with world Y
    this.body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.body.position.set(-td.width / 2, 0, td.depth / 2);
    world.addBody(this.body);
    window.__vibexe_terrainBody = this.body;
    window.__vibexe_terrainHFShape = this.shape;
    console.log("[TerrainPhysics] Heightfield body created:", td.segX, "x", td.segZ, "elementSize:", elementSize.toFixed(3));
  } catch(err) {
    console.error("[TerrainPhysics] Failed to create heightfield:", err);
  }

  // PostStep terrain clamp + active ground-following
  // Runs after every physics step to ensure dynamic bodies stay ON terrain.
  // Two modes:
  //   1. Below terrain → snap up immediately (safety net)
  //   2. Within threshold above terrain & not jumping → snap to surface (ground-follow)
  // Mode 2 is critical because CANNON Heightfield collision is unreliable for Box shapes
  // (catches on edges, leaves gaps) and low-gravity settings cause slow floaty descent.
  // T14 fix: remove old PostStep listener before adding new one (prevents duplicate listeners on re-init)
  if (window.__vibexe_terrainPostStep) {
    try { world.removeEventListener("postStep", window.__vibexe_terrainPostStep); } catch(e) {}
    window.__vibexe_terrainPostStep = null;
  }
  {
    this._postStepFn = function() {
      var getH = window.__vibexe_getTerrainHeight;
      var w = window.__vibexe_world__;
      if (!getH || !w) return;
      for (var pi = 0; pi < w.bodies.length; pi++) {
        var pb = w.bodies[pi];
        if (pb.mass <= 0) continue;
        // Skip sleeping bodies (saves CPU — they're not moving)
        if (pb.sleepState === 2) continue;
        var th = getH(pb.position.x, pb.position.z);
        if (th == null) continue;
        // Compute half-height from body's shape bounds (not hardcoded)
        var halfH = 0.5;
        if (pb.shapes && pb.shapes.length > 0) {
          var s0 = pb.shapes[0];
          if (s0.halfExtents) halfH = s0.halfExtents.y;
          else if (s0.radius) halfH = s0.radius;
          else if (s0.height) halfH = s0.height * 0.5;
          else if (s0.boundingSphereRadius) halfH = s0.boundingSphereRadius;
        }
        var minY = th + halfH;
        if (pb.position.y < minY) {
          // Below terrain — snap up immediately
          pb.position.y = minY;
          if (pb.velocity.y < 0) pb.velocity.y = 0;
          pb.__canJump = true;
        } else if ((pb.position.y - minY) < 3.0 && pb.velocity.y <= 0) {
          // T7 fix: only snap when falling or at rest (was vy<=1.5, caught mid-jump)
          // Active ground-following: within 3 units of terrain and falling/stationary
          pb.position.y = minY;
          if (pb.velocity.y < 0) pb.velocity.y = 0;
          pb.__canJump = true;
        }
      }
    };
    window.__vibexe_terrainPostStep = this._postStepFn;
    world.addEventListener("postStep", this._postStepFn);
    console.log("[TerrainPhysics] PostStep terrain clamp + ground-following registered");
  }

  // Defer Rapier heightfield creation to next frame to avoid "recursive use" error
  // when Rapier world.step() is running in the current animation frame
  var self = this;
  setTimeout(function() { self._setupRapierHeightfield(td); }, 100);
};

TerrainPhysics.prototype.rebuild = function() {
  // T15 fix: prefer module-level CANNON capture
  var C = CANNON || window.CANNON;
  var world = this.world || window.__vibexe_world__;
  var td = window.__vibexe_terrainData;
  if (!C || !world || !td) return;

  // Remove old body
  if (window.__vibexe_terrainBody) {
    try { world.removeBody(window.__vibexe_terrainBody); } catch(e) {}
  }

  // Build new height matrix from updated heightData (Z-reversed to match CANNON grid)
  var matrix = [];
  for (var sx = 0; sx < td.segX; sx++) {
    matrix.push([]);
    for (var sz = 0; sz < td.segZ; sz++) {
      matrix[sx].push(td.heightData[(td.segZ - 1 - sz) * td.segX + sx]);
    }
  }

  var elementSize = td.width / (td.segX - 1);
  try {
    this.shape = new C.Heightfield(matrix, { elementSize: elementSize });
    this.body = new C.Body({ mass: 0, type: C.Body.STATIC });
    this.body.addShape(this.shape);
    this.body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.body.position.set(-td.width / 2, 0, td.depth / 2);
    world.addBody(this.body);
    window.__vibexe_terrainBody = this.body;
    window.__vibexe_terrainHFShape = this.shape;
  } catch(err) {
    console.error("[TerrainPhysics] Rebuild failed:", err);
  }

  // Defer Rapier heightfield rebuild to next frame to avoid "recursive use" error
  var self = this;
  setTimeout(function() { self._setupRapierHeightfield(td); }, 100);
};

TerrainPhysics.prototype.destroy = function() {
  if (this._watcherInterval) {
    clearInterval(this._watcherInterval);
    this._watcherInterval = null;
  }
  var world = this.world || window.__vibexe_world__;
  if (this.body && world) {
    try { world.removeBody(this.body); } catch(e) {}
  }
  if (this._postStepFn && world) {
    try { world.removeEventListener("postStep", this._postStepFn); } catch(e) {}
  }
  // Clean up Rapier terrain
  var rw = window.__vibexe_rapierWorld__;
  if (this._rapierCollider && rw) {
    try { rw.removeCollider(this._rapierCollider, true); } catch(e) {}
  }
  if (this._rapierBody && rw) {
    try { rw.removeRigidBody(this._rapierBody); } catch(e) {}
  }
  window.__vibexe_terrainBody = null;
  window.__vibexe_terrainHFShape = null;
  window.__vibexe_terrainPostStep = null;
  window.__vibexe_rapierTerrainBody__ = null;
  window.__vibexe_rapierTerrainCollider__ = null;
  this.body = null;
  this.shape = null;
  this.world = null;
  this._rapierBody = null;
  this._rapierCollider = null;
};


// ============================================================
// TerrainSculpt — Raise/Lower/Flatten/Smooth brushes
// ============================================================

function TerrainSculpt(terrainGenerator, terrainPhysics) {
  this.terrainGen = terrainGenerator;
  this.terrainPhysics = terrainPhysics;
  this._targetHeight = 0;
}

TerrainSculpt.prototype.setTargetHeight = function(h) {
  this._targetHeight = h;
};

TerrainSculpt.prototype.applyBrush = function(worldX, worldZ, type, size, strength, falloff) {
  var mesh = this.terrainGen.mesh;
  if (!mesh) return;
  var geo = mesh.geometry;
  var pos = geo.attributes.position;
  var td = window.__vibexe_terrainData;
  if (!td) return;

  var R = size;
  var str = strength;
  var R2 = R * R;
  var modified = false;

  for (var vi = 0; vi < pos.count; vi++) {
    var vx = pos.getX(vi);
    var vz = pos.getZ(vi);
    var dx = vx - worldX;
    var dz = vz - worldZ;
    var dist2 = dx * dx + dz * dz;
    if (dist2 > R2) continue;

    var dist = Math.sqrt(dist2);
    var alpha;
    if (falloff === "flat") {
      alpha = 1.0;
    } else if (falloff === "linear") {
      alpha = 1.0 - dist / R;
    } else {
      // gaussian
      var t = dist / R;
      alpha = Math.exp(-t * t * 3.0);
    }

    var curY = pos.getY(vi);

    switch (type) {
      case "raise":
        pos.setY(vi, curY + alpha * str);
        break;
      case "lower":
        pos.setY(vi, curY - alpha * str);
        break;
      case "flatten":
        pos.setY(vi, curY + (this._targetHeight - curY) * alpha * str);
        break;
      case "smooth": {
        var gx = vi % td.segX;
        var gz = Math.floor(vi / td.segX);
        var sum = 0, cnt = 0;
        for (var nz = -1; nz <= 1; nz++) {
          for (var nx = -1; nx <= 1; nx++) {
            var ngx = gx + nx, ngz = gz + nz;
            if (ngx >= 0 && ngx < td.segX && ngz >= 0 && ngz < td.segZ) {
              var ni = ngz * td.segX + ngx;
              if (ni < pos.count) {
                sum += pos.getY(ni);
                cnt++;
              }
            }
          }
        }
        var avg = cnt > 0 ? sum / cnt : curY;
        pos.setY(vi, curY + (avg - curY) * alpha * str);
        break;
      }
    }

    if (vi < td.heightData.length) {
      td.heightData[vi] = pos.getY(vi);
    }
    modified = true;
  }

  if (modified) {
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    // Recompute minY/maxY
    var newMinY = Infinity, newMaxY = -Infinity;
    for (var mi = 0; mi < pos.count; mi++) {
      var yy = pos.getY(mi);
      if (yy < newMinY) newMinY = yy;
      if (yy > newMaxY) newMaxY = yy;
    }
    td.minY = newMinY;
    td.maxY = newMaxY;

    // Update terrainHeight and terrainSlope attributes
    var hAttr = geo.attributes.terrainHeight;
    var sAttr = geo.attributes.terrainSlope;
    if (hAttr && sAttr) {
      var norms = geo.attributes.normal;
      var hRange = td.maxY - td.minY || 1;
      for (var ui = 0; ui < pos.count; ui++) {
        var nh = (pos.getY(ui) - td.minY) / hRange;
        hAttr.setX(ui, Math.max(0, Math.min(1, nh)));
        var ny = norms.getY(ui);
        sAttr.setX(ui, Math.acos(Math.abs(ny)) * (180 / Math.PI));
      }
      hAttr.needsUpdate = true;
      sAttr.needsUpdate = true;
    }

    // Rebuild physics heightfield after sculpt
    if (this.terrainPhysics) {
      this.terrainPhysics.rebuild();
    }
  }
};


// ============================================================
// TerrainPainter — Facade combining all subsystems
// ============================================================

function TerrainPainter(scene, options) {
  this.scene = scene;
  this.options = options || {};
  this.generator = new TerrainGenerator(scene, options);
  this.physics = new TerrainPhysics(this.generator);
  this.sculpt = new TerrainSculpt(this.generator, this.physics);
}

TerrainPainter.prototype.generate = function(options) {
  if (options) {
    if (options.width !== undefined) this.generator.width = options.width;
    if (options.depth !== undefined) this.generator.depth = options.depth;
    if (options.heightScale !== undefined) this.generator.heightScale = options.heightScale;
    if (options.segments !== undefined) {
      this.generator.segments = options.segments;
      this.generator._segX = options.segments + 1;
      this.generator._segZ = options.segments + 1;
    }
    if (options.biomeParams !== undefined) this.generator.biomeParams = options.biomeParams;
  }
  return this.generator.generate();
};

TerrainPainter.prototype.getHeightAt = function(x, z) {
  return this.generator.getHeightAt(x, z);
};

TerrainPainter.prototype.applyBrush = function(worldX, worldZ, type, size, strength, falloff) {
  this.sculpt.applyBrush(worldX, worldZ, type, size, strength, falloff);
};

TerrainPainter.prototype.setTargetHeight = function(h) {
  this.sculpt.setTargetHeight(h);
};

TerrainPainter.prototype.setupPhysics = function(world) {
  this.physics.setup(world || window.__vibexe_world__);
};

TerrainPainter.prototype.getMesh = function() {
  return this.generator.getMesh();
};

TerrainPainter.prototype.getHeightData = function() {
  return this.generator.getHeightData();
};

TerrainPainter.prototype.destroy = function() {
  this.physics.destroy();
  this.generator.destroy();
};


// ============================================================
// Auto-detect player mesh (for old saved projects that don't register it)
// ============================================================

if (typeof window !== 'undefined' && !window.__vibexe_playerMesh__) {
  // X3 fix: Reset retry counter on reload to prevent stale state
  window.__vibexe_playerDetectRetry = 0;
  // Poll for scene availability, then find the animated character mesh
  var _detectPlayer = function() {
    if (window.__vibexe_playerMesh__) return; // Already set by newer template
    var scene = window.__vibexe_scene__;
    if (!scene) { setTimeout(_detectPlayer, 500); return; }
    // Find the player mesh: animated character with a physicsBody (mass > 0)
    var found = null;
    scene.traverse(function(obj) {
      if (found) return;
      if (obj.userData && obj.userData.__physicsBody && obj.userData.__physicsBody.mass > 0) {
        // Check if this looks like a character (has animation mixer or specific name)
        if (obj.userData.__physicsBody.fixedRotation) {
          found = obj;
        }
      }
    });
    if (found) {
      window.__vibexe_playerMesh__ = found;
      console.log("[TerrainPainter] Auto-detected player mesh:", found.name || "unnamed");
    } else {
      // T-L4 fix: always increment counter (was re-initializing to 0 on each call due to falsy check)
      window.__vibexe_playerDetectRetry++;
      if (window.__vibexe_playerDetectRetry < 20) setTimeout(_detectPlayer, 1000);
    }
  };
  setTimeout(_detectPlayer, 2000); // Start detecting after initial load
}

// ============================================================
// Register module and exports
// ============================================================

if (typeof window !== 'undefined') {
  window.__vibexe_modules__ = window.__vibexe_modules__ || {};
  window.__vibexe_modules__["terrain-painter"] = {
    TerrainPainter: TerrainPainter,
    TerrainGenerator: TerrainGenerator,
    TerrainPhysics: TerrainPhysics,
    TerrainSculpt: TerrainSculpt,
    SimplexNoise: SimplexNoise,
    BIOME_PRESETS: BIOME_PRESETS,
    getBiomeParams: getBiomeParams
  };
}

module.exports = { TerrainPainter: TerrainPainter, TerrainGenerator: TerrainGenerator, TerrainPhysics: TerrainPhysics, TerrainSculpt: TerrainSculpt, SimplexNoise: SimplexNoise, BIOME_PRESETS: BIOME_PRESETS, getBiomeParams: getBiomeParams };
`,
	bridgeHandlers: {
		"terrain-painter-repaint": "handleRepaint",
		"terrain-painter-add-layer": "handleAddLayer",
		"terrain-painter-remove-layer": "handleRemoveLayer",
		"terrain-painter-add-modifier": "handleAddModifier",
		"terrain-painter-remove-modifier": "handleRemoveModifier",
		"terrain-painter-update-modifier": "handleUpdateModifier",
		"terrain-painter-update-layer": "handleUpdateLayer",
		"terrain-painter-set-resolution": "handleSetResolution",
		"terrain-painter-generate-terrain": "handleGenerateTerrain",
		"terrain-painter-load-heightmap": "handleLoadHeightmap",
	},
	defaultSettings: {
		splatmapResolution: 256,
		terrain: {
			width: 100,
			depth: 100,
			heightScale: 30,
			segments: 128,
		},
		layers: [],
	},
};

// Re-export runtime classes for direct import
export { TerrainPainter } from "./runtime/terrain-painter";
export { TerrainMesh } from "./runtime/terrain-mesh";
export { ModifierStack } from "./runtime/modifier-stack";
export { Modifier, BlendMode, FilterPass } from "./runtime/modifier";
export { LayerSettings } from "./runtime/layer-settings";
export {
	HeightModifier,
	SlopeModifier,
	CurvatureModifier,
	CurvatureSolver,
	NoiseModifier,
	NoiseType,
	DirectionModifier,
	TextureMaskModifier,
} from "./runtime/modifiers";
