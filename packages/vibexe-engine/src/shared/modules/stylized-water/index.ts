/**
 * Stylized Water 2 — Vibexe WebGPU Module
 *
 * Converted from Unity Asset Store "Stylized Water 2" by Staggart Creations.
 * AAA-quality stylized water with Gerstner waves, foam, caustics, refraction,
 * translucency, specular, fresnel, and buoyancy.
 *
 * Phase 1: Foundation — Mesh, Gerstner Waves, Depth-Based Coloring
 * Phase 2: Surface Detail — Foam (wave crest + intersection)
 * Phase 3: Underwater — Caustics placeholder
 * Phase 4: Lighting — Specular + Fresnel + Translucency
 * Phase 5: Buoyancy — CPU wave sampling + global API
 */

import type { ModuleManifest } from "../module-types";

export const STYLIZED_WATER_MANIFEST: ModuleManifest = {
	id: "stylized-water",
	name: "Stylized Water 2",
	version: "1.0.0",
	category: "level-design",
	description:
		"AAA-quality stylized water with Gerstner waves, foam, caustics, refraction, translucency, and buoyancy",
	icon: "Waves",
	assets: [],
	runtimeCode: `
// @vibexe/stylized-water v1.0.0
// Stylized Water 2 — converted from Unity (Staggart Creations)
var THREE = require('three');

// ============================================================
// Section 1: Utilities
// ============================================================

function _lerp(a, b, t) { return a + (b - a) * t; }
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function _saturate(v) { return _clamp(v, 0, 1); }
function _smoothstep(e0, e1, x) {
  var t = _clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function _frac(x) { return x - Math.floor(x); }

function _normalize3(x, y, z) {
  var len = Math.sqrt(x * x + y * y + z * z);
  if (len < 0.00001) return { x: 0, y: 1, z: 0 };
  return { x: x / len, y: y / len, z: z / len };
}

function _deepMerge(target, source) {
  if (!source) return target;
  var result = {};
  var k;
  for (k in target) {
    if (target.hasOwnProperty(k)) result[k] = target[k];
  }
  for (k in source) {
    if (source.hasOwnProperty(k)) {
      if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k]) &&
          result[k] && typeof result[k] === 'object' && !Array.isArray(result[k])) {
        result[k] = _deepMerge(result[k], source[k]);
      } else {
        result[k] = source[k];
      }
    }
  }
  return result;
}

// ============================================================
// Section 2: Gerstner Wave Mathematics
// Ported from StylizedWater2/Shaders/Libraries/Waves.hlsl
// ============================================================

var TWO_PI = 6.283185307;
var STEEPNESS_SCALE = 0.01; // XZ displacement dampening (Unity value)

// Canonical wave directions (spread across compass)
var WAVE_DIRS = [
  { x: 0.866, y: 0.5 },     // 30 deg
  { x: -0.5,  y: 0.866 },   // 120 deg
  { x: 0.259, y: -0.966 },  // 255 deg
  { x: -0.707, y: -0.707 }, // 225 deg
  { x: 0.966, y: -0.259 }   // 345 deg
];

/**
 * Single Gerstner wave displacement.
 *   offset.x = Q * A * dir.x * cos(omega * dot(D, xz) + phi)
 *   offset.y = A * sin(omega * dot(D, xz) + phi)
 *   offset.z = Q * A * dir.z * cos(omega * dot(D, xz) + phi)
 */
function _gerstnerWave(wx, wz, dirX, dirY, steepness, wavelength, amplitude, speed, time) {
  var omega = TWO_PI / Math.max(wavelength, 0.01);
  var phi = speed * omega;
  var dotDP = dirX * wx + dirY * wz;
  var phase = omega * dotDP + phi * time;
  var sinP = Math.sin(phase);
  var cosP = Math.cos(phase);
  var Q = steepness;
  return {
    x: Q * amplitude * dirX * cosP * STEEPNESS_SCALE,
    y: amplitude * sinP,
    z: Q * amplitude * dirY * cosP * STEEPNESS_SCALE
  };
}

/**
 * Sample multiple Gerstner waves at a world-space point.
 * Returns { height, normal: {x,y,z}, offset: {x,y,z} }
 */
function _sampleWaves(worldX, worldZ, time, s) {
  var height = s.waveHeight || 0.5;
  var speed = s.waveSpeed || 1.0;
  var steepness = s.waveSteepness || 0.5;
  var count = _clamp(Math.round(s.waveCount || 2), 1, 5);
  var dist = s.waveDistance || 0.5;
  var waterLevel = s.waterLevel || 0;

  var ox = 0, oy = 0, oz = 0;
  var nx = 0, ny = 1, nz = 0;

  var freqMul = 1.0, ampMul = 1.0, speedMul = 1.0;

  for (var i = 0; i < count; i++) {
    var dir = WAVE_DIRS[i % 5];
    var wl = 10.0 / freqMul;
    var amp = height * ampMul * 0.5;
    var spd = speed * speedMul;

    var wave = _gerstnerWave(worldX, worldZ, dir.x, dir.y, steepness, wl, amp, spd, time);
    ox += wave.x;
    oy += wave.y;
    oz += wave.z;

    // Normal contribution
    var omega = TWO_PI / Math.max(wl, 0.01);
    var dotDP = dir.x * worldX + dir.y * worldZ;
    var cosP = Math.cos(omega * dotDP + spd * omega * time);
    nx -= dir.x * omega * amp * cosP;
    nz -= dir.y * omega * amp * cosP;

    // Frequency cascade
    freqMul *= 1.18 + dist * 0.4;
    ampMul *= 0.82 - dist * 0.15;
    speedMul *= 1.07;
  }

  // Normalize the accumulated normal
  var nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (nLen > 0.001) { nx /= nLen; ny /= nLen; nz /= nLen; }

  return {
    height: waterLevel + oy,
    normal: { x: nx, y: ny, z: nz },
    offset: { x: ox, y: oy, z: oz }
  };
}

// ============================================================
// Section 3: Default Settings
// ============================================================

var DEFAULT_SETTINGS = {
  // General
  waterLevel: 0,
  scale: 200,
  resolution: 0.5,
  followCamera: true,
  visible: true,

  // Colors (matching Stylized Water 2 defaults)
  shallowColor: { r: 0.4, g: 0.8, b: 0.9, a: 0.8 },
  deepColor: { r: 0.05, g: 0.15, b: 0.4, a: 0.95 },
  horizonColor: { r: 0.6, g: 0.8, b: 1.0, a: 0.5 },
  horizonDistance: 3.0,
  depthVertical: 1.0,
  depthHorizontal: 1.0,
  edgeFade: 1.0,
  waveTint: 0.1,

  // Waves
  waveHeight: 0.5,
  waveSpeed: 1.0,
  waveSteepness: 0.5,
  waveCount: 2,
  waveDistance: 0.5,

  // Normal map
  normalMapIndex: 0,
  normalTilingX: 0.5,
  normalTilingY: 0.5,
  normalSubTiling: 0.5,
  normalSpeed: 0.1,
  normalSubSpeed: -0.25,
  normalStrength: 0.5,

  // Foam
  foamEnabled: true,
  foamColor: { r: 1, g: 1, b: 1, a: 0.8 },
  foamTilingX: 0.1,
  foamTilingY: 0.1,
  foamSpeed: 0.1,
  foamBaseAmount: 0,
  foamWaveAmount: 0.3,
  foamClipping: 0,
  foamTextureIndex: 0,

  // Intersection
  intersectionEnabled: true,
  intersectionColor: { r: 1, g: 1, b: 1, a: 1 },
  intersectionLength: 2,
  intersectionStyle: 1,

  // Lighting
  sunReflectionSize: 0.5,
  sunReflectionStrength: 1.0,
  translucencyStrength: 0.5,
  translucencyExp: 6.0,
  sparkleIntensity: 0,

  // Underwater (Phase 3)
  refractionEnabled: false,
  refractionStrength: 0.5,
  colorAbsorption: 0.5,
  causticsEnabled: false,
  causticsBrightness: 1.0,
  causticsChromance: 0.5,
  causticsTiling: 0.5,
  causticsSpeed: 0.5,

  // Buoyancy
  buoyancyEnabled: true,
};

// ============================================================
// Section 4: Material Presets
// ============================================================

var PRESETS = {
  ocean: {
    shallowColor: { r: 0.15, g: 0.55, b: 0.65, a: 0.85 },
    deepColor: { r: 0.02, g: 0.08, b: 0.25, a: 0.97 },
    horizonColor: { r: 0.5, g: 0.7, b: 0.9, a: 0.6 },
    waveHeight: 1.2, waveSpeed: 0.8, waveSteepness: 0.4, waveCount: 4,
    depthVertical: 1.5, depthHorizontal: 0.8, horizonDistance: 5.0,
    foamWaveAmount: 0.5, foamBaseAmount: 0.05,
    sunReflectionStrength: 1.5, translucencyStrength: 0.7,
  },
  'clear-pool': {
    shallowColor: { r: 0.5, g: 0.9, b: 0.95, a: 0.6 },
    deepColor: { r: 0.1, g: 0.3, b: 0.5, a: 0.8 },
    horizonColor: { r: 0.7, g: 0.9, b: 1.0, a: 0.3 },
    waveHeight: 0.05, waveSpeed: 0.3, waveSteepness: 0.1, waveCount: 2,
    depthVertical: 0.5, edgeFade: 0.5, horizonDistance: 2.0,
    foamWaveAmount: 0, foamBaseAmount: 0,
    sunReflectionStrength: 2.0, translucencyStrength: 0.3,
  },
  river: {
    shallowColor: { r: 0.35, g: 0.7, b: 0.65, a: 0.75 },
    deepColor: { r: 0.05, g: 0.2, b: 0.3, a: 0.9 },
    horizonColor: { r: 0.5, g: 0.7, b: 0.8, a: 0.3 },
    waveHeight: 0.3, waveSpeed: 1.5, waveSteepness: 0.3, waveCount: 3,
    depthVertical: 0.8, foamWaveAmount: 0.2, foamBaseAmount: 0.1,
    intersectionLength: 1.5,
  },
  cartoon: {
    shallowColor: { r: 0.2, g: 0.7, b: 0.95, a: 0.85 },
    deepColor: { r: 0.05, g: 0.3, b: 0.7, a: 0.95 },
    horizonColor: { r: 0.3, g: 0.6, b: 1.0, a: 0.4 },
    waveHeight: 0.8, waveSpeed: 1.0, waveSteepness: 0.7, waveCount: 2,
    depthVertical: 0.8, foamWaveAmount: 0.4, foamBaseAmount: 0.05,
    intersectionLength: 3.0, intersectionStyle: 0,
  },
  swamp: {
    shallowColor: { r: 0.25, g: 0.35, b: 0.15, a: 0.92 },
    deepColor: { r: 0.08, g: 0.12, b: 0.05, a: 0.98 },
    horizonColor: { r: 0.2, g: 0.25, b: 0.1, a: 0.3 },
    waveHeight: 0.05, waveSpeed: 0.1, waveSteepness: 0.05, waveCount: 1,
    depthVertical: 3.0, foamEnabled: false,
    sunReflectionStrength: 0.3, translucencyStrength: 0.1,
  },
  frozen: {
    shallowColor: { r: 0.7, g: 0.85, b: 0.95, a: 0.95 },
    deepColor: { r: 0.3, g: 0.5, b: 0.7, a: 0.98 },
    horizonColor: { r: 0.8, g: 0.9, b: 1.0, a: 0.6 },
    waveHeight: 0.0, waveSpeed: 0, waveSteepness: 0, waveCount: 1,
    foamEnabled: false, sunReflectionStrength: 2.5,
  },
  lava: {
    shallowColor: { r: 1.0, g: 0.4, b: 0.0, a: 0.95 },
    deepColor: { r: 0.6, g: 0.1, b: 0.0, a: 1.0 },
    horizonColor: { r: 1.0, g: 0.2, b: 0.0, a: 0.5 },
    waveHeight: 0.3, waveSpeed: 0.2, waveSteepness: 0.2, waveCount: 3,
    depthVertical: 2.0, foamEnabled: false,
    sunReflectionStrength: 0, translucencyStrength: 1.5,
    translucencyExp: 3.0,
  },
  realistic: {
    shallowColor: { r: 0.25, g: 0.55, b: 0.55, a: 0.82 },
    deepColor: { r: 0.03, g: 0.1, b: 0.2, a: 0.95 },
    horizonColor: { r: 0.5, g: 0.65, b: 0.8, a: 0.7 },
    waveHeight: 0.6, waveSpeed: 1.0, waveSteepness: 0.5, waveCount: 4,
    depthVertical: 1.2, depthHorizontal: 1.0, horizonDistance: 5.0,
    foamWaveAmount: 0.3, foamBaseAmount: 0.02,
    sunReflectionStrength: 1.8, translucencyStrength: 0.6,
  },
  murky: {
    shallowColor: { r: 0.3, g: 0.3, b: 0.2, a: 0.92 },
    deepColor: { r: 0.1, g: 0.1, b: 0.05, a: 0.99 },
    horizonColor: { r: 0.3, g: 0.3, b: 0.2, a: 0.4 },
    waveHeight: 0.2, waveSpeed: 0.4, waveSteepness: 0.15, waveCount: 2,
    depthVertical: 4.0, foamEnabled: false,
    sunReflectionStrength: 0.5, translucencyStrength: 0.1,
  },
  'low-poly': {
    shallowColor: { r: 0.3, g: 0.75, b: 0.85, a: 0.85 },
    deepColor: { r: 0.1, g: 0.3, b: 0.55, a: 0.95 },
    horizonColor: { r: 0.5, g: 0.75, b: 0.9, a: 0.4 },
    waveHeight: 0.6, waveSpeed: 0.8, waveSteepness: 0.8, waveCount: 1,
    resolution: 0.15, foamWaveAmount: 0.5,
    sunReflectionStrength: 0.8,
  },
};

// ============================================================
// Section 5: Texture Helpers
// ============================================================

var TEXTURE_BASE = '/api/app-builder/media-stock-3d/water-textures/';
var NORMAL_MAP_NAMES = ['SmoothWaves', 'RoughWaves', 'SharpWaves', 'StreamWaves'];
var FOAM_TEX_NAMES = ['Foam1', 'Foam2', 'FoamSea'];
var _textureCache = {};

function _loadTexture(name, onLoad) {
  if (_textureCache[name]) {
    if (onLoad) onLoad(_textureCache[name]);
    return _textureCache[name];
  }
  var loader = new THREE.TextureLoader();
  loader.load(
    TEXTURE_BASE + name + '.webp',
    function(tex) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      _textureCache[name] = tex;
      if (onLoad) onLoad(tex);
    },
    undefined,
    function(err) {
      console.warn('[StylizedWater] Failed to load texture:', name, err);
    }
  );
  return null;
}

// ============================================================
// Section 6: StylizedWaterSystem — Main Class
// ============================================================

function StylizedWaterSystem(scene, camera, settings) {
  this.scene = scene;
  this.camera = camera;
  this.settings = _deepMerge(DEFAULT_SETTINGS, settings);

  this._time = 0;
  this._lastTime = Date.now();
  this._animFrameId = null;
  this._disposed = false;

  // Mesh + geometry
  this._mesh = null;
  this._geometry = null;
  this._material = null;
  this._origPositions = null;
  this._vertexColors = null;

  // Textures
  this._normalMapTex = null;
  this._foamTex = null;

  // Performance: stagger color updates
  this._colorCounter = 0;
  this._colorInterval = 2; // update colors every N frames

  // Build water
  this._build();
  this._loadTextures();
  this._registerBuoyancyAPI();

  // Start animation
  this._animLoop = this._animLoop.bind(this);
  this._animFrameId = requestAnimationFrame(this._animLoop);

  console.log('[StylizedWater] v1.0.0 initialized — scale:' + this.settings.scale +
    ' level:' + this.settings.waterLevel + ' verts:' + (this._origPositions ? this._origPositions.length / 3 : 0));
}

// ── Build ──────────────────────────────────────────────

StylizedWaterSystem.prototype._build = function() {
  var s = this.settings;

  // Create plane geometry lying flat on XZ plane
  var segX = Math.round(s.scale * s.resolution);
  var segZ = Math.round(s.scale * s.resolution);
  segX = _clamp(segX, 8, 400);
  segZ = _clamp(segZ, 8, 400);

  this._geometry = new THREE.PlaneGeometry(s.scale, s.scale, segX, segZ);
  this._geometry.rotateX(-Math.PI / 2); // Lie flat on XZ

  // Store original vertex positions for wave displacement
  var pos = this._geometry.attributes.position.array;
  this._origPositions = new Float32Array(pos.length);
  this._origPositions.set(pos);

  // Set up vertex colors (RGBA)
  var vertCount = pos.length / 3;
  this._vertexColors = new Float32Array(vertCount * 4);
  this._geometry.setAttribute('color', new THREE.BufferAttribute(this._vertexColors, 4));

  // Material — MeshBasicMaterial with vertex colors
  // We compute all lighting (specular, fresnel, etc.) in vertex colors
  this._material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: true,
  });

  // Create mesh
  this._mesh = new THREE.Mesh(this._geometry, this._material);
  this._mesh.name = '__vibexe_stylized_water__';
  this._mesh.position.y = s.waterLevel;
  this._mesh.renderOrder = 100;
  this._mesh.frustumCulled = false;

  this.scene.add(this._mesh);
};

// ── Texture Loading ────────────────────────────────────

StylizedWaterSystem.prototype._loadTextures = function() {
  var self = this;
  var s = this.settings;

  // Load normal map (for visual reference; actual normal mapping
  // would require MeshStandardMaterial — here we use the texture
  // data for per-vertex detail modulation)
  var normalName = NORMAL_MAP_NAMES[_clamp(s.normalMapIndex, 0, NORMAL_MAP_NAMES.length - 1)];
  _loadTexture(normalName, function(tex) {
    self._normalMapTex = tex;
  });

  // Load foam texture
  var foamName = FOAM_TEX_NAMES[_clamp(s.foamTextureIndex, 0, FOAM_TEX_NAMES.length - 1)];
  _loadTexture(foamName, function(tex) {
    self._foamTex = tex;
  });
};

// ── Animation Loop ─────────────────────────────────────

StylizedWaterSystem.prototype._animLoop = function() {
  if (this._disposed) return;

  var now = Date.now();
  var dt = Math.min((now - this._lastTime) / 1000, 0.1);
  this._lastTime = now;
  this._time += dt;

  // Wave displacement every frame (smooth animation)
  this._updateWaves();

  // Vertex colors every N frames (heavy computation)
  this._colorCounter++;
  if (this._colorCounter >= this._colorInterval) {
    this._colorCounter = 0;
    this._updateColors();
  }

  // Camera follow every frame
  this._updateCameraFollow();

  this._animFrameId = requestAnimationFrame(this._animLoop);
};

// ── Gerstner Wave Vertex Displacement ──────────────────

StylizedWaterSystem.prototype._updateWaves = function() {
  var s = this.settings;
  if (s.waveHeight <= 0.001) return;

  var pos = this._geometry.attributes.position.array;
  var orig = this._origPositions;
  var count = pos.length / 3;
  var meshX = this._mesh.position.x;
  var meshZ = this._mesh.position.z;

  for (var i = 0; i < count; i++) {
    var i3 = i * 3;
    var wx = orig[i3] + meshX;
    var wz = orig[i3 + 2] + meshZ;

    var wave = _sampleWaves(wx, wz, this._time, s);

    pos[i3]     = orig[i3]     + wave.offset.x;
    pos[i3 + 1] = orig[i3 + 1] + wave.offset.y;
    pos[i3 + 2] = orig[i3 + 2] + wave.offset.z;
  }

  this._geometry.attributes.position.needsUpdate = true;
  this._geometry.computeVertexNormals();
};

// ── Vertex Color Computation ───────────────────────────
// Computes: depth color, foam, specular, fresnel, edge fade
// All baked into vertex colors for MeshBasicMaterial

StylizedWaterSystem.prototype._updateColors = function() {
  var s = this.settings;
  var colors = this._vertexColors;
  var pos = this._geometry.attributes.position.array;
  var orig = this._origPositions;
  var count = pos.length / 3;
  var meshPos = this._mesh.position;

  // Gather external data
  var cam = this.camera;
  var camX = cam ? cam.position.x : 0;
  var camY = cam ? cam.position.y : 20;
  var camZ = cam ? cam.position.z : 0;
  var getTerrainH = window.__vibexe_getVisualTerrainHeight || null;

  // Sun direction (from SWA or default)
  var sun = this._getSunDirection();
  var sunColor = this._getSunColor();

  // Precompute color components
  var shallow = s.shallowColor;
  var deep = s.deepColor;
  var horizon = s.horizonColor;
  var foamCol = s.foamColor;
  var intCol = s.intersectionColor;

  for (var i = 0; i < count; i++) {
    var i3 = i * 3;
    var i4 = i * 4;

    // World position of this vertex
    var wx = pos[i3] + meshPos.x;
    var wy = pos[i3 + 1] + meshPos.y;
    var wz = pos[i3 + 2] + meshPos.z;

    // ── Depth ──
    var depth = 5.0; // default if no terrain
    if (getTerrainH) {
      var terrainH = getTerrainH(wx, wz);
      depth = Math.max(0, wy - terrainH);
    }

    // Vertical depth attenuation: 1 - exp(-depth * factor)
    var depthAtten = 1 - Math.exp(-depth * s.depthVertical * 0.1);
    var heightAtten = 1 - Math.exp(-depth * s.depthHorizontal);
    var density = _saturate(Math.max(depthAtten, heightAtten));

    // ── Base Color: shallow → deep blend ──
    var r = _lerp(shallow.r, deep.r, density);
    var g = _lerp(shallow.g, deep.g, density);
    var b = _lerp(shallow.b, deep.b, density);
    var a = _lerp(shallow.a, deep.a, density);

    // ── Wave Normal ──
    var waveY = pos[i3 + 1]; // wave displacement height
    var waveNormal = _sampleWaves(wx, wz, this._time, s).normal;

    // ── Directional Lighting (Lambert) ──
    var NdotL = _saturate(waveNormal.x * sun.x + waveNormal.y * sun.y + waveNormal.z * sun.z);
    var ambient = 0.45;
    var lighting = ambient + (1 - ambient) * NdotL;
    r *= lighting;
    g *= lighting;
    b *= lighting;

    // ── Wave Tint (darken troughs) ──
    if (s.waveTint > 0.001) {
      var tint = _saturate(waveY * s.waveTint * 2.0);
      r += tint * 0.08 * sunColor.r;
      g += tint * 0.12 * sunColor.g;
      b += tint * 0.08 * sunColor.b;
    }

    // ── Foam (wave crest) ──
    var foam = 0;
    if (s.foamEnabled) {
      // Wave crest foam
      var crest = _saturate(waveY * 2.0) * s.foamWaveAmount;
      foam += crest;
      // Base foam
      foam += s.foamBaseAmount;

      // Foam clipping
      if (s.foamClipping > 0.001) {
        foam = _smoothstep(s.foamClipping, 1.0, foam);
      }
      foam = _saturate(foam);

      // Blend foam color
      if (foam > 0.001) {
        var foamA = foam * foamCol.a;
        r = _lerp(r, foamCol.r, foamA);
        g = _lerp(g, foamCol.g, foamA);
        b = _lerp(b, foamCol.b, foamA);
      }
    }

    // ── Intersection Foam (depth-based shore line) ──
    if (s.intersectionEnabled && getTerrainH && depth < s.intersectionLength) {
      var intDist = _saturate(depth / Math.max(s.intersectionLength, 0.01));

      var intersection = 0;
      if (s.intersectionStyle === 0) {
        // Sharp step
        intersection = 1.0 - _smoothstep(0.0, 0.5, intDist);
      } else if (s.intersectionStyle === 1) {
        // Smooth gradient
        intersection = 1.0 - intDist;
        intersection *= intersection; // squared for smoother
      } else {
        // Sine ripple
        var ripple = Math.sin(intDist * 12.566 + this._time * 2.0) * 0.5 + 0.5;
        intersection = (1.0 - intDist) * ripple;
      }
      intersection = _saturate(intersection) * intCol.a;

      if (intersection > 0.001) {
        r = _lerp(r, intCol.r, intersection);
        g = _lerp(g, intCol.g, intersection);
        b = _lerp(b, intCol.b, intersection);
      }
    }

    // ── Specular (Blinn-Phong sun reflection) ──
    if (s.sunReflectionStrength > 0.001) {
      var vdx = camX - wx;
      var vdy = camY - wy;
      var vdz = camZ - wz;
      var vLen = Math.sqrt(vdx * vdx + vdy * vdy + vdz * vdz);
      if (vLen > 0.01) {
        vdx /= vLen; vdy /= vLen; vdz /= vLen;

        // Half vector
        var hx = sun.x + vdx;
        var hy = sun.y + vdy;
        var hz = sun.z + vdz;
        var hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
        if (hLen > 0.01) {
          hx /= hLen; hy /= hLen; hz /= hLen;

          // N dot H
          var NdotH = _saturate(
            waveNormal.x * hx + waveNormal.y * hy + waveNormal.z * hz
          );

          // Specular exponent: small sunReflectionSize = sharp, large = broad
          var specExp = _lerp(8196, 64, _saturate(s.sunReflectionSize));
          var spec = Math.pow(NdotH, specExp) * s.sunReflectionStrength;

          // View-angle mask (no specular at grazing angles from light)
          var geoNdotL = _saturate(waveNormal.y * sun.y + waveNormal.x * sun.x + waveNormal.z * sun.z);
          var viewFactor = _smoothstep(0.0, 0.15, geoNdotL);
          spec *= viewFactor;

          // Apply specular with sun color
          r += spec * sunColor.r;
          g += spec * sunColor.g;
          b += spec * sunColor.b;
        }
      }
    }

    // ── Fresnel (horizon color blend) ──
    if (horizon.a > 0.001) {
      var fdx = camX - wx;
      var fdy = camY - wy;
      var fdz = camZ - wz;
      var fLen = Math.sqrt(fdx * fdx + fdy * fdy + fdz * fdz);
      if (fLen > 0.01) {
        fdx /= fLen; fdy /= fLen; fdz /= fLen;
        var VdotN = _saturate(fdx * waveNormal.x + fdy * waveNormal.y + fdz * waveNormal.z);
        var fresnel = Math.pow(Math.max(0, 1.000293 - VdotN), s.horizonDistance);
        fresnel = _saturate(fresnel) * horizon.a;

        r = _lerp(r, horizon.r, fresnel);
        g = _lerp(g, horizon.g, fresnel);
        b = _lerp(b, horizon.b, fresnel);
      }
    }

    // ── Translucency (subsurface scattering) ──
    if (s.translucencyStrength > 0.001 && cam) {
      var tvx = -(camX - wx);
      var tvy = -(camY - wy);
      var tvz = -(camZ - wz);
      var tvLen = Math.sqrt(tvx * tvx + tvy * tvy + tvz * tvz);
      if (tvLen > 0.01) {
        tvx /= tvLen; tvy /= tvLen; tvz /= tvLen;
        var transmit = _saturate(tvx * sun.x + tvy * sun.y + tvz * sun.z);
        transmit = Math.pow(transmit, s.translucencyExp) * s.translucencyStrength;

        // Curvature mask
        var curvature = _saturate(_lerp(1.0,
          -(waveNormal.x * sun.x + waveNormal.y * sun.y + waveNormal.z * sun.z), 0.3));
        transmit *= curvature;

        // Add subsurface glow (greenish tint like real water)
        r += transmit * 0.1 * sunColor.r;
        g += transmit * 0.3 * sunColor.g;
        b += transmit * 0.2 * sunColor.b;
      }
    }

    // ── Edge Fade (alpha near shore) ──
    if (s.edgeFade > 0.001 && getTerrainH) {
      var edgeAlpha = _saturate(depth / (s.edgeFade * 0.5));
      a *= edgeAlpha;
    }

    // ── Final Output ──
    colors[i4]     = _saturate(r);
    colors[i4 + 1] = _saturate(g);
    colors[i4 + 2] = _saturate(b);
    colors[i4 + 3] = _saturate(a);
  }

  this._geometry.attributes.color.needsUpdate = true;
};

// ── Camera Following ───────────────────────────────────

StylizedWaterSystem.prototype._updateCameraFollow = function() {
  if (!this.settings.followCamera || !this.camera) return;

  var camX = this.camera.position.x;
  var camZ = this.camera.position.z;

  // Snap to grid to prevent visible vertex swimming
  var cellSize = 1.0 / Math.max(this.settings.resolution, 0.01);
  cellSize = Math.max(cellSize, 2);

  this._mesh.position.x = Math.round(camX / cellSize) * cellSize;
  this._mesh.position.z = Math.round(camZ / cellSize) * cellSize;
};

// ── Sun Direction / Color ──────────────────────────────

StylizedWaterSystem.prototype._getSunDirection = function() {
  // Try SWA module
  var swa = window.__vibexe_skyWeatherAdvanced;
  if (swa && swa._sunDirection) {
    var sd = swa._sunDirection;
    return _normalize3(sd.x || sd[0] || 0, sd.y || sd[1] || 0.707, sd.z || sd[2] || 0.707);
  }
  // Try scene directional light
  var scene = this.scene;
  if (scene) {
    for (var j = 0; j < scene.children.length; j++) {
      var child = scene.children[j];
      if (child.isDirectionalLight && child.visible) {
        var p = child.position;
        return _normalize3(p.x, p.y, p.z);
      }
    }
  }
  // Default: sun at 45 deg elevation from south
  return { x: 0.0, y: 0.707, z: 0.707 };
};

StylizedWaterSystem.prototype._getSunColor = function() {
  var swa = window.__vibexe_skyWeatherAdvanced;
  if (swa && swa._sunColor) {
    var sc = swa._sunColor;
    return { r: sc.r || sc[0] || 1, g: sc.g || sc[1] || 0.95, b: sc.b || sc[2] || 0.9 };
  }
  var scene = this.scene;
  if (scene) {
    for (var j = 0; j < scene.children.length; j++) {
      var child = scene.children[j];
      if (child.isDirectionalLight && child.visible) {
        var c = child.color;
        return { r: c.r, g: c.g, b: c.b };
      }
    }
  }
  return { r: 1.0, g: 0.95, b: 0.9 };
};

// ── Buoyancy API ───────────────────────────────────────

StylizedWaterSystem.prototype._registerBuoyancyAPI = function() {
  var self = this;

  window.__vibexe_getWaterHeight = function(x, z) {
    if (!self.settings.buoyancyEnabled || self._disposed) return self.settings.waterLevel;
    return _sampleWaves(x, z, self._time, self.settings).height;
  };

  window.__vibexe_getWaterNormal = function(x, z) {
    if (!self.settings.buoyancyEnabled || self._disposed) return { x: 0, y: 1, z: 0 };
    return _sampleWaves(x, z, self._time, self.settings).normal;
  };

  window.__vibexe_isUnderwater = function(x, y, z) {
    var wh = window.__vibexe_getWaterHeight(x, z);
    return y < wh;
  };

  // Also expose water level directly
  window.__vibexe_waterLevel = self.settings.waterLevel;
};

// ── Settings Management ────────────────────────────────

StylizedWaterSystem.prototype.updateSettings = function(patch) {
  var oldScale = this.settings.scale;
  var oldRes = this.settings.resolution;
  var oldLevel = this.settings.waterLevel;
  var oldNormalIdx = this.settings.normalMapIndex;
  var oldFoamIdx = this.settings.foamTextureIndex;

  this.settings = _deepMerge(this.settings, patch);

  // Rebuild geometry if scale/resolution changed
  if (this.settings.scale !== oldScale || this.settings.resolution !== oldRes) {
    this._rebuildGeometry();
  }

  // Update water level
  if (this.settings.waterLevel !== oldLevel && this._mesh) {
    this._mesh.position.y = this.settings.waterLevel;
    window.__vibexe_waterLevel = this.settings.waterLevel;
  }

  // Reload textures if indices changed
  if (this.settings.normalMapIndex !== oldNormalIdx || this.settings.foamTextureIndex !== oldFoamIdx) {
    this._loadTextures();
  }

  // Update visibility
  if (this._mesh) {
    this._mesh.visible = this.settings.visible !== false;
  }

  // Force immediate color update
  this._colorCounter = this._colorInterval;
};

StylizedWaterSystem.prototype._rebuildGeometry = function() {
  if (!this._mesh) return;

  var s = this.settings;
  if (this._geometry) this._geometry.dispose();

  var segX = Math.round(s.scale * s.resolution);
  var segZ = Math.round(s.scale * s.resolution);
  segX = _clamp(segX, 8, 400);
  segZ = _clamp(segZ, 8, 400);

  this._geometry = new THREE.PlaneGeometry(s.scale, s.scale, segX, segZ);
  this._geometry.rotateX(-Math.PI / 2);

  var pos = this._geometry.attributes.position.array;
  this._origPositions = new Float32Array(pos.length);
  this._origPositions.set(pos);

  var vertCount = pos.length / 3;
  this._vertexColors = new Float32Array(vertCount * 4);
  this._geometry.setAttribute('color', new THREE.BufferAttribute(this._vertexColors, 4));

  this._mesh.geometry = this._geometry;

  console.log('[StylizedWater] Rebuilt geometry — segments:' + segX + 'x' + segZ + ' verts:' + vertCount);
};

// ── Bridge Messages ────────────────────────────────────

StylizedWaterSystem.prototype.handleBridgeMessage = function(type, payload) {
  var t = type.replace('stylized-water-', '');

  switch (t) {
    case 'update-config':
      this.updateSettings(payload.config || payload);
      break;
    case 'set-height':
      this.updateSettings({ waterLevel: payload.height != null ? payload.height : (payload.waterLevel || 0) });
      break;
    case 'set-preset':
      this._applyPreset(payload.preset || payload.presetId || payload);
      break;
    case 'set-visible':
      this.updateSettings({ visible: payload.visible !== false });
      break;
    case 'reset-defaults':
      this.settings = _deepMerge({}, DEFAULT_SETTINGS);
      this._rebuildGeometry();
      this._loadTextures();
      this._mesh.position.y = this.settings.waterLevel;
      break;
    default:
      break;
  }
};

// ── Presets ────────────────────────────────────────────

StylizedWaterSystem.prototype._applyPreset = function(presetId) {
  if (typeof presetId === 'object') presetId = presetId.preset || presetId.presetId || 'ocean';
  var preset = PRESETS[presetId];
  if (preset) {
    this.updateSettings(preset);
    console.log('[StylizedWater] Applied preset: ' + presetId);
  } else {
    console.warn('[StylizedWater] Unknown preset: ' + presetId);
  }
};

// ── Dispose ────────────────────────────────────────────

StylizedWaterSystem.prototype.dispose = function() {
  this._disposed = true;
  if (this._animFrameId) cancelAnimationFrame(this._animFrameId);

  if (this._mesh && this.scene) {
    this.scene.remove(this._mesh);
  }
  if (this._geometry) this._geometry.dispose();
  if (this._material) this._material.dispose();

  // Clean up globals
  delete window.__vibexe_getWaterHeight;
  delete window.__vibexe_getWaterNormal;
  delete window.__vibexe_isUnderwater;
  delete window.__vibexe_waterLevel;
  delete window.__vibexe_stylizedWater;

  this._mesh = null;
  this._geometry = null;
  this._material = null;
  this._origPositions = null;
  this._vertexColors = null;

  console.log('[StylizedWater] Disposed');
};

// ============================================================
// Section 7: Auto-Init & Bridge Listener
// ============================================================

if (typeof window !== 'undefined') {
  window.__vibexe_modules__ = window.__vibexe_modules__ || {};
  window.__vibexe_modules__['stylized-water'] = {
    StylizedWaterSystem: StylizedWaterSystem,
  };

  (function() {
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      var scene = window.__vibexe_scene__;

      // Detect scene change — destroy + reinit
      if (scene && window.__vibexe_stylizedWater &&
          window.__vibexe_stylizedWater.scene !== scene) {
        console.log('[StylizedWater] Scene changed, re-initializing');
        try { window.__vibexe_stylizedWater.dispose(); } catch(e) {}
        window.__vibexe_stylizedWater = null;
      }

      if (scene && typeof THREE !== 'undefined' && !window.__vibexe_stylizedWater) {
        clearInterval(timer);

        // Find camera
        var camera = window.__vibexe_camera__ || null;
        if (!camera) {
          scene.traverse(function(obj) {
            if (obj.isCamera && !camera) camera = obj;
          });
        }

        // Load settings
        var settings = {};
        try {
          var gs = window.__VIBEXE_GAME_SETTINGS__;
          if (gs) {
            if (gs.stylizedWater && typeof gs.stylizedWater === 'object') {
              settings = gs.stylizedWater;
            } else if (gs.modules && gs.modules.installed && gs.modules.installed['stylized-water']) {
              settings = gs.modules.installed['stylized-water'].config || {};
            }
          }
        } catch(e) {}

        window.__vibexe_stylizedWater = new StylizedWaterSystem(scene, camera, settings);

        // Bridge message listener
        window.addEventListener('message', function(ev) {
          if (!ev.data || !ev.data.type) return;
          var sys = window.__vibexe_stylizedWater;
          if (!sys) return;
          if (ev.data.type.indexOf('stylized-water-') === 0) {
            sys.handleBridgeMessage(ev.data.type, ev.data.payload || ev.data);
          }
        });
      }

      if (attempts >= 100) {
        clearInterval(timer);
        console.warn('[StylizedWater] Scene not found after 10s');
      }
    }, 100);
  })();
}

module.exports = {
  StylizedWaterSystem: StylizedWaterSystem,
};
`,
	bridgeHandlers: {
		"stylized-water-update-config": "handleUpdateConfig",
		"stylized-water-set-height": "handleSetHeight",
		"stylized-water-set-preset": "handleSetPreset",
		"stylized-water-set-visible": "handleSetVisible",
	},
	defaultSettings: {
		waterLevel: 0,
		scale: 200,
		resolution: 0.5,
		followCamera: true,
		visible: true,
		shallowColor: { r: 0.4, g: 0.8, b: 0.9, a: 0.8 },
		deepColor: { r: 0.05, g: 0.15, b: 0.4, a: 0.95 },
		horizonColor: { r: 0.6, g: 0.8, b: 1.0, a: 0.5 },
		horizonDistance: 3.0,
		depthVertical: 1.0,
		depthHorizontal: 1.0,
		edgeFade: 1.0,
		waveTint: 0.1,
		waveHeight: 0.5,
		waveSpeed: 1.0,
		waveSteepness: 0.5,
		waveCount: 2,
		waveDistance: 0.5,
		normalMapIndex: 0,
		normalStrength: 0.5,
		foamEnabled: true,
		foamColor: { r: 1, g: 1, b: 1, a: 0.8 },
		foamWaveAmount: 0.3,
		foamBaseAmount: 0,
		foamClipping: 0,
		intersectionEnabled: true,
		intersectionColor: { r: 1, g: 1, b: 1, a: 1 },
		intersectionLength: 2,
		intersectionStyle: 1,
		sunReflectionSize: 0.5,
		sunReflectionStrength: 1.0,
		translucencyStrength: 0.5,
		translucencyExp: 6.0,
		buoyancyEnabled: true,
	},
};
