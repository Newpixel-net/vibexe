/**
 * Stylized Water 2 — Vibexe WebGPU Module
 *
 * Converted from Unity Asset Store "Stylized Water 2" by Staggart Creations.
 * AAA-quality stylized water with Gerstner waves, foam, caustics, refraction,
 * translucency, specular, fresnel, and buoyancy.
 *
 * Phase 1: Foundation — Mesh, Gerstner Waves, Depth-Based Coloring, Edge Fade
 * Phase 2: Surface Detail — Dual Normal Maps, Foam Textures, Intersection Noise
 * Phase 3: Underwater — Caustics (dual-layer min), Color Absorption
 * Phase 4: Lighting — PBR via MeshStandardMaterial, Translucency, Sparkles
 * Phase 5: Buoyancy — CPU wave sampling, Global API, River Mode basics
 */

import type { ModuleManifest } from "../module-types";

export const STYLIZED_WATER_MANIFEST: ModuleManifest = {
	id: "stylized-water",
	name: "Stylized Water 2",
	version: "2.0.0",
	category: "level-design",
	description:
		"AAA-quality stylized water with Gerstner waves, foam, caustics, refraction, translucency, and buoyancy",
	icon: "Waves",
	assets: [],
	runtimeCode: `
// @vibexe/stylized-water v2.0.0
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
var STEEPNESS_SCALE = 0.01;

var WAVE_DIRS = [
  { x: 0.866, y: 0.5 },
  { x: -0.5,  y: 0.866 },
  { x: 0.259, y: -0.966 },
  { x: -0.707, y: -0.707 },
  { x: 0.966, y: -0.259 }
];

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
    var omega = TWO_PI / Math.max(wl, 0.01);
    var dotDP = dir.x * worldX + dir.y * worldZ;
    var cosP = Math.cos(omega * dotDP + spd * omega * time);
    nx -= dir.x * omega * amp * cosP;
    nz -= dir.y * omega * amp * cosP;
    freqMul *= 1.18 + dist * 0.4;
    ampMul *= 0.82 - dist * 0.15;
    speedMul *= 1.07;
  }

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
  waterLevel: -3,
  scale: 200,
  resolution: 1.0, // 1 vert per meter — smooth enough to avoid sharp facets
  followCamera: true,
  visible: true,
  volumeDepth: 8, // depth of underwater volume floor below surface

  // Colors — high alpha for realistic water volume (not glass-like)
  shallowColor: { r: 0.4, g: 0.8, b: 0.9, a: 0.92 },
  deepColor: { r: 0.05, g: 0.15, b: 0.4, a: 0.98 },
  horizonColor: { r: 0.6, g: 0.8, b: 1.0, a: 0.5 },
  horizonDistance: 3.0,
  depthVertical: 1.0,
  depthHorizontal: 1.0,
  edgeFade: 1.0,
  waveTint: 0.1,

  // Waves — lower steepness to avoid sharp peaks
  waveHeight: 0.5,
  waveSpeed: 1.0,
  waveSteepness: 0.3,
  waveCount: 2,
  waveDistance: 0.5,

  // Normal Maps (Phase 2)
  normalMapIndex: 0,
  normalTilingX: 0.5,
  normalTilingY: 0.5,
  normalSubTiling: 0.5,
  normalSpeed: 0.1,
  normalSubSpeed: -0.25,
  normalStrength: 0.5,

  // Foam (Phase 2)
  foamEnabled: true,
  foamColor: { r: 1, g: 1, b: 1, a: 0.8 },
  foamTilingX: 0.1,
  foamTilingY: 0.1,
  foamSpeed: 0.1,
  foamBaseAmount: 0,
  foamWaveAmount: 0.3,
  foamClipping: 0,
  foamTextureIndex: 0,

  // Intersection (Phase 2)
  intersectionEnabled: true,
  intersectionColor: { r: 1, g: 1, b: 1, a: 1 },
  intersectionLength: 2,
  intersectionStyle: 1,

  // Caustics (Phase 3)
  causticsEnabled: true,
  causticsBrightness: 1.0,
  causticsChromance: 0.5,
  causticsTiling: 0.5,
  causticsSpeed: 0.5,
  causticsDistortion: 0.3,

  // Color absorption (Phase 3)
  colorAbsorption: 0.5,

  // Lighting (Phase 4)
  roughness: 0.25,
  metalness: 0.15,
  envMapIntensity: 0.8,
  sunReflectionSize: 0.5,
  sunReflectionStrength: 1.0,
  translucencyStrength: 0.5,
  translucencyExp: 6.0,
  sparkleIntensity: 0,
  sparkleSize: 0.9,

  // Refraction (Phase 3)
  refractionEnabled: false,
  refractionStrength: 0.3,
  refractionThickness: 2.0,

  // River mode (Phase 5)
  riverMode: false,
  riverDirection: 0,
  riverSpeed: 1.0,

  // Buoyancy (Phase 5)
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
    roughness: 0.1, metalness: 0.4,
    causticsEnabled: true, causticsBrightness: 0.8,
    translucencyStrength: 0.7,
    normalStrength: 0.6, normalSpeed: 0.08,
  },
  'clear-pool': {
    shallowColor: { r: 0.5, g: 0.9, b: 0.95, a: 0.6 },
    deepColor: { r: 0.1, g: 0.3, b: 0.5, a: 0.8 },
    horizonColor: { r: 0.7, g: 0.9, b: 1.0, a: 0.3 },
    waveHeight: 0.05, waveSpeed: 0.3, waveSteepness: 0.1, waveCount: 2,
    depthVertical: 0.5, edgeFade: 0.5, horizonDistance: 2.0,
    foamWaveAmount: 0, foamBaseAmount: 0,
    roughness: 0.05, metalness: 0.5,
    causticsEnabled: true, causticsBrightness: 2.0, causticsTiling: 0.8,
    normalStrength: 0.3, normalSpeed: 0.05,
    translucencyStrength: 0.3,
    refractionEnabled: false, refractionStrength: 0.4, refractionThickness: 3.0,
  },
  river: {
    shallowColor: { r: 0.35, g: 0.7, b: 0.65, a: 0.75 },
    deepColor: { r: 0.05, g: 0.2, b: 0.3, a: 0.9 },
    horizonColor: { r: 0.5, g: 0.7, b: 0.8, a: 0.3 },
    waveHeight: 0.15, waveSpeed: 1.5, waveSteepness: 0.2, waveCount: 3,
    depthVertical: 0.8, foamWaveAmount: 0.15, foamBaseAmount: 0.1,
    intersectionLength: 1.5,
    normalSpeed: 0.15, normalStrength: 0.6, normalMapIndex: 3,
    causticsEnabled: true, causticsBrightness: 1.2,
    riverMode: true, riverDirection: 90, riverSpeed: 1.5,
  },
  cartoon: {
    shallowColor: { r: 0.2, g: 0.7, b: 0.95, a: 0.85 },
    deepColor: { r: 0.05, g: 0.3, b: 0.7, a: 0.95 },
    horizonColor: { r: 0.3, g: 0.6, b: 1.0, a: 0.4 },
    waveHeight: 0.8, waveSpeed: 1.0, waveSteepness: 0.7, waveCount: 2,
    depthVertical: 0.8, foamWaveAmount: 0.4, foamBaseAmount: 0.05,
    intersectionLength: 3.0, intersectionStyle: 0,
    roughness: 0.3, metalness: 0.1,
    causticsEnabled: false,
    normalStrength: 0.4,
  },
  swamp: {
    shallowColor: { r: 0.25, g: 0.35, b: 0.15, a: 0.92 },
    deepColor: { r: 0.08, g: 0.12, b: 0.05, a: 0.98 },
    horizonColor: { r: 0.2, g: 0.25, b: 0.1, a: 0.3 },
    waveHeight: 0.05, waveSpeed: 0.1, waveSteepness: 0.05, waveCount: 1,
    depthVertical: 3.0, foamEnabled: false,
    roughness: 0.6, metalness: 0.05,
    causticsEnabled: false,
    translucencyStrength: 0.1,
    normalStrength: 0.2, normalSpeed: 0.02,
  },
  frozen: {
    shallowColor: { r: 0.7, g: 0.85, b: 0.95, a: 0.95 },
    deepColor: { r: 0.3, g: 0.5, b: 0.7, a: 0.98 },
    horizonColor: { r: 0.8, g: 0.9, b: 1.0, a: 0.6 },
    waveHeight: 0.0, waveSpeed: 0, waveSteepness: 0, waveCount: 1,
    foamEnabled: false,
    roughness: 0.02, metalness: 0.6,
    causticsEnabled: false,
    normalStrength: 0.1, normalSpeed: 0,
  },
  lava: {
    shallowColor: { r: 1.0, g: 0.4, b: 0.0, a: 0.95 },
    deepColor: { r: 0.6, g: 0.1, b: 0.0, a: 1.0 },
    horizonColor: { r: 1.0, g: 0.2, b: 0.0, a: 0.5 },
    waveHeight: 0.3, waveSpeed: 0.2, waveSteepness: 0.2, waveCount: 3,
    depthVertical: 2.0, foamEnabled: false,
    roughness: 0.8, metalness: 0.0,
    causticsEnabled: false,
    translucencyStrength: 1.5, translucencyExp: 3.0,
    normalStrength: 0.8, normalSpeed: 0.03,
  },
  realistic: {
    shallowColor: { r: 0.25, g: 0.55, b: 0.55, a: 0.82 },
    deepColor: { r: 0.03, g: 0.1, b: 0.2, a: 0.95 },
    horizonColor: { r: 0.5, g: 0.65, b: 0.8, a: 0.7 },
    waveHeight: 0.6, waveSpeed: 1.0, waveSteepness: 0.5, waveCount: 4,
    depthVertical: 1.2, depthHorizontal: 1.0, horizonDistance: 5.0,
    foamWaveAmount: 0.3, foamBaseAmount: 0.02,
    roughness: 0.08, metalness: 0.5,
    causticsEnabled: true, causticsBrightness: 1.5, causticsDistortion: 0.5,
    translucencyStrength: 0.6,
    normalStrength: 0.7, normalSpeed: 0.1,
    sparkleIntensity: 0.3,
    refractionEnabled: false, refractionStrength: 0.25, refractionThickness: 2.5,
  },
  murky: {
    shallowColor: { r: 0.3, g: 0.3, b: 0.2, a: 0.92 },
    deepColor: { r: 0.1, g: 0.1, b: 0.05, a: 0.99 },
    horizonColor: { r: 0.3, g: 0.3, b: 0.2, a: 0.4 },
    waveHeight: 0.2, waveSpeed: 0.4, waveSteepness: 0.15, waveCount: 2,
    depthVertical: 4.0, foamEnabled: false,
    roughness: 0.5, metalness: 0.1,
    causticsEnabled: false,
    translucencyStrength: 0.1,
    normalStrength: 0.3,
  },
  'low-poly': {
    shallowColor: { r: 0.3, g: 0.75, b: 0.85, a: 0.85 },
    deepColor: { r: 0.1, g: 0.3, b: 0.55, a: 0.95 },
    horizonColor: { r: 0.5, g: 0.75, b: 0.9, a: 0.4 },
    waveHeight: 0.6, waveSpeed: 0.8, waveSteepness: 0.8, waveCount: 1,
    resolution: 0.15, foamWaveAmount: 0.5,
    roughness: 0.3, metalness: 0.2,
    causticsEnabled: false,
    normalStrength: 0.0,
  },
};

// ============================================================
// Section 5: Texture Loading + CPU Sampling
// ============================================================

var TEXTURE_BASE = '/api/app-builder/media-stock-3d/water-textures/';
var NORMAL_MAP_NAMES = ['SmoothWaves', 'RoughWaves', 'SharpWaves', 'StreamWaves'];
var FOAM_TEX_NAMES = ['Foam1', 'Foam2', 'FoamSea'];
var CAUSTIC_TEX_NAMES = ['Caustics_1', 'Caustics_2'];
var _textureCache = {};

/** Load a Three.js texture (for material properties like normalMap) */
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
    function(err) { console.warn('[StylizedWater] Failed to load texture:', name); }
  );
  return null;
}

/**
 * Load a texture into a canvas for per-vertex CPU sampling.
 * Returns ImageData.data (Uint8ClampedArray) via callback.
 */
var _canvasCache = {};
function _loadTextureCanvas(name, size, callback) {
  var key = name + '_' + size;
  if (_canvasCache[key]) {
    callback(_canvasCache[key].data, size);
    return;
  }
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    var imageData = ctx.getImageData(0, 0, size, size);
    _canvasCache[key] = imageData;
    callback(imageData.data, size);
  };
  img.onerror = function() {
    console.warn('[StylizedWater] Failed to load canvas texture:', name);
  };
  img.src = TEXTURE_BASE + name + '.webp';
}

/** Sample a pixel from ImageData at tiled UV coordinates */
function _sampleImageData(data, size, u, v) {
  u = ((u % 1) + 1) % 1;
  v = ((v % 1) + 1) % 1;
  var px = Math.floor(u * size) % size;
  var py = Math.floor(v * size) % size;
  var idx = (py * size + px) * 4;
  return {
    r: data[idx] / 255,
    g: data[idx + 1] / 255,
    b: data[idx + 2] / 255,
    a: data[idx + 3] / 255
  };
}

// ============================================================
// Section 6: StylizedWaterSystem — Main Class
// ============================================================

function StylizedWaterSystem(scene, camera, settings, bodyId, displayName) {
  this.scene = scene;
  this.camera = camera;
  this.settings = _deepMerge(DEFAULT_SETTINGS, settings);
  this._bodyId = bodyId || '';
  this._displayName = displayName || 'Water 1';

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

  // Texture data for CPU sampling
  this._foamData = null;
  this._foamDataSize = 0;
  this._intFoamData = null;  // Intersection_Foam texture
  this._intFoamDataSize = 0;
  this._causticsData = null;
  this._causticsDataSize = 0;
  this._noiseData = null;
  this._noiseDataSize = 0;

  // Performance: stagger color updates
  this._colorCounter = 0;
  this._colorInterval = 2;

  // FPS tracking (Phase 7)
  this._fpsFrames = 0;
  this._fpsTime = Date.now();
  this._currentFPS = 0;
  this._avgFoam = 0; // average foam for normal flattening
  this._paintData = null; // vertex color painting (Phase 5)

  // Build water
  this._build();
  this._loadTextures();
  this._registerBuoyancyAPI();

  // Apply saved position for non-followCamera bodies
  if (!this.settings.followCamera && this.settings.position) {
    if (this._mesh) {
      this._mesh.position.x = this.settings.position.x || 0;
      this._mesh.position.z = this.settings.position.z || 0;
    }
    if (this._underwaterMesh) {
      this._underwaterMesh.position.x = this.settings.position.x || 0;
      this._underwaterMesh.position.z = this.settings.position.z || 0;
    }
  }

  // Start animation
  this._animLoop = this._animLoop.bind(this);
  this._animFrameId = requestAnimationFrame(this._animLoop);

  console.log('[StylizedWater] v2.0.0 initialized — scale:' + this.settings.scale +
    ' level:' + this.settings.waterLevel + ' verts:' + (this._origPositions ? this._origPositions.length / 3 : 0));
}

// ── Build: Geometry + Material ─────────────────────────

StylizedWaterSystem.prototype._build = function() {
  var s = this.settings;

  // Create plane geometry lying flat on XZ
  var segX = Math.round(s.scale * s.resolution);
  var segZ = Math.round(s.scale * s.resolution);
  segX = _clamp(segX, 8, 400);
  segZ = _clamp(segZ, 8, 400);

  this._geometry = new THREE.PlaneGeometry(s.scale, s.scale, segX, segZ);
  this._geometry.rotateX(-Math.PI / 2);

  // Store original positions for wave displacement
  var pos = this._geometry.attributes.position.array;
  this._origPositions = new Float32Array(pos.length);
  this._origPositions.set(pos);

  // Vertex colors (RGBA) for depth/foam/caustics coloring
  var vertCount = pos.length / 3;
  this._vertexColors = new Float32Array(vertCount * 4);
  this._geometry.setAttribute('color', new THREE.BufferAttribute(this._vertexColors, 4));

  // ── Material: MeshPhysicalMaterial for PBR + refraction ──
  // PBR handles: specular, fresnel, environment reflections, shadow receiving
  // Physical adds: transmission (refraction), IOR, attenuation (color absorption)
  // We compute: base color (shallow/deep), foam, caustics, alpha → vertex colors
  var ns = s.normalStrength || 0.5;
  var deep = s.deepColor || DEFAULT_SETTINGS.deepColor;

  this._usePBR = true;
  this._usePhysical = false;

  try {
    // Try MeshPhysicalMaterial first (refraction support)
    if (THREE.MeshPhysicalMaterial) {
      var physOpts = {
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: _clamp(s.roughness || 0.15, 0, 1),
        metalness: _clamp(s.metalness || 0.3, 0, 1),
        envMapIntensity: s.envMapIntensity || 0.8,
        normalMap: null,
        normalScale: new THREE.Vector2(ns, -ns),
        fog: true,
        // Phase 3: Refraction via transmission
        transmission: s.refractionEnabled ? _clamp(s.refractionStrength || 0.3, 0, 1) : 0,
        ior: 1.33, // Water index of refraction
        thickness: _clamp(s.refractionThickness || 2.0, 0.1, 10),
        attenuationColor: new THREE.Color(deep.r, deep.g, deep.b),
        attenuationDistance: 5.0,
      };
      this._material = new THREE.MeshPhysicalMaterial(physOpts);
      this._usePhysical = true;
    } else {
      throw new Error('No MeshPhysicalMaterial');
    }
  } catch(e) {
    try {
      this._material = new THREE.MeshStandardMaterial({
        color: 0xffffff, vertexColors: true, transparent: true, opacity: 1.0,
        side: THREE.DoubleSide, depthWrite: false,
        roughness: _clamp(s.roughness || 0.15, 0, 1),
        metalness: _clamp(s.metalness || 0.3, 0, 1),
        envMapIntensity: s.envMapIntensity || 0.8,
        normalMap: null, normalScale: new THREE.Vector2(ns, -ns), fog: true,
      });
    } catch(e2) {
      console.warn('[StylizedWater] PBR failed, falling back to Basic');
      this._usePBR = false;
      this._material = new THREE.MeshBasicMaterial({
        color: 0xffffff, vertexColors: true, transparent: true, opacity: 1.0,
        side: THREE.DoubleSide, depthWrite: false, fog: true,
      });
    }
  }

  if (this._usePhysical) {
    console.log('[StylizedWater] Using MeshPhysicalMaterial (refraction: ' + (s.refractionEnabled ? 'ON' : 'OFF') + ')');
  }

  // Create mesh — use non-__ name so editor gizmo can select it
  this._mesh = new THREE.Mesh(this._geometry, this._material);
  this._mesh.name = this._bodyId ? ('StylizedWater_' + this._bodyId) : 'StylizedWater';
  this._mesh.userData.__isWater = true;
  this._mesh.userData.__waterBodyId = this._bodyId || '';
  this._mesh.userData.__waterSystem = this;
  this._mesh.position.y = s.waterLevel;
  this._mesh.renderOrder = 100;
  this._mesh.frustumCulled = false;
  this._mesh.receiveShadow = true;

  this.scene.add(this._mesh);

  // Underwater solid — opaque dark plane just below surface, blocks view from ALL angles
  // DoubleSide + opaque + depthWrite = water looks solid from side, below, and edge-on
  var uwGeo = new THREE.PlaneGeometry(s.scale, s.scale);
  uwGeo.rotateX(-Math.PI / 2);
  this._underwaterMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(deep.r * 0.12, deep.g * 0.15, deep.b * 0.35),
    transparent: false,
    side: THREE.DoubleSide,
    depthWrite: true,
    fog: true,
  });
  this._underwaterMesh = new THREE.Mesh(uwGeo, this._underwaterMat);
  this._underwaterMesh.name = '__water_underside__';
  this._underwaterMesh.position.y = s.waterLevel - 0.15;
  this._underwaterMesh.renderOrder = 98;
  this._underwaterMesh.frustumCulled = false;
  this.scene.add(this._underwaterMesh);

  // Volume floor — visible from ABOVE through the water, gives depth/volume illusion
  var vfDepth = s.volumeDepth || 8;
  var vfGeo = new THREE.PlaneGeometry(s.scale * 1.2, s.scale * 1.2);
  vfGeo.rotateX(-Math.PI / 2); // face upward (visible from above looking through water)
  this._volumeFloorMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(deep.r * 0.15, deep.g * 0.15, deep.b * 0.3),
    transparent: true,
    opacity: 0.95,
    side: THREE.FrontSide,
    depthWrite: false,
    fog: true,
  });
  this._volumeFloorMesh = new THREE.Mesh(vfGeo, this._volumeFloorMat);
  this._volumeFloorMesh.name = '__water_volume_floor__';
  this._volumeFloorMesh.position.y = s.waterLevel - vfDepth;
  this._volumeFloorMesh.renderOrder = 97;
  this._volumeFloorMesh.frustumCulled = false;
  this.scene.add(this._volumeFloorMesh);
};

// ── Texture Loading ────────────────────────────────────

StylizedWaterSystem.prototype._loadTextures = function() {
  var self = this;
  var s = this.settings;

  // 1. Dual normal map with RNM blending (Phase 2: true dual-layer)
  // Loads TWO normal maps and blends them per-pixel using Reoriented Normal Mapping
  var idx1 = _clamp(s.normalMapIndex || 0, 0, NORMAL_MAP_NAMES.length - 1);
  var idx2 = (idx1 + 1) % NORMAL_MAP_NAMES.length; // next normal map for blending
  var normalName1 = NORMAL_MAP_NAMES[idx1];
  var normalName2 = NORMAL_MAP_NAMES[idx2];

  // Also load the primary as a fallback (immediate display before RNM completes)
  _loadTexture(normalName1, function(tex) {
    if (self._material && self._usePBR && !self._rnmApplied) {
      self._material.normalMap = tex;
      self._material.normalScale.set(s.normalStrength || 0.5, -(s.normalStrength || 0.5));
      self._material.needsUpdate = true;
    }
  });

  // Load both normal maps for RNM blend
  self._rnmApplied = false;
  var rnmSize = 256;
  var rnmData1 = null, rnmData2 = null;
  var rnmLoaded = 0;

  function onRNMReady() {
    // Reoriented Normal Mapping blend on canvas
    var canvas = document.createElement('canvas');
    canvas.width = rnmSize;
    canvas.height = rnmSize;
    var ctx = canvas.getContext('2d');
    var output = ctx.createImageData(rnmSize, rnmSize);
    var out = output.data;

    for (var p = 0; p < rnmSize * rnmSize; p++) {
      var pi = p * 4;
      // Decode normals from [0,1] to [-1,1]
      var n1x = (rnmData1[pi] / 255) * 2 - 1;
      var n1y = (rnmData1[pi+1] / 255) * 2 - 1;
      var n1z = Math.max((rnmData1[pi+2] / 255) * 2 - 1, 0.01);
      var n2x = (rnmData2[pi] / 255) * 2 - 1;
      var n2y = (rnmData2[pi+1] / 255) * 2 - 1;
      var n2z = Math.max((rnmData2[pi+2] / 255) * 2 - 1, 0.01);

      // RNM formula: t = n1.xyz + vec3(0,0,1), u = n2.xyz * vec3(-1,-1,1)
      // result = normalize(t * dot(t,u) - u * t.z)
      var tx = n1x, ty = n1y, tz = n1z + 1;
      var ux = -n2x, uy = -n2y, uz = n2z;
      var d = tx * ux + ty * uy + tz * uz;
      var rx = tx * d - ux * tz;
      var ry = ty * d - uy * tz;
      var rz = tz * d - uz * tz;

      var len = Math.sqrt(rx*rx + ry*ry + rz*rz);
      if (len > 0.001) { rx /= len; ry /= len; rz /= len; }

      // Encode back to [0,1]
      out[pi]   = Math.round(_clamp(rx * 0.5 + 0.5, 0, 1) * 255);
      out[pi+1] = Math.round(_clamp(ry * 0.5 + 0.5, 0, 1) * 255);
      out[pi+2] = Math.round(_clamp(rz * 0.5 + 0.5, 0, 1) * 255);
      out[pi+3] = 255;
    }

    ctx.putImageData(output, 0, 0);
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true;

    if (self._material && self._usePBR) {
      self._material.normalMap = tex;
      self._material.needsUpdate = true;
      self._rnmApplied = true;
      console.log('[StylizedWater] RNM-blended normal map: ' + normalName1 + ' + ' + normalName2);
    }
  }

  _loadTextureCanvas(normalName1, rnmSize, function(d) {
    rnmData1 = d; rnmLoaded++;
    if (rnmLoaded === 2) onRNMReady();
  });
  _loadTextureCanvas(normalName2, rnmSize, function(d) {
    rnmData2 = d; rnmLoaded++;
    if (rnmLoaded === 2) onRNMReady();
  });

  // 2. Foam texture → CPU canvas for per-vertex sampling
  var foamName = FOAM_TEX_NAMES[_clamp(s.foamTextureIndex || 0, 0, FOAM_TEX_NAMES.length - 1)];
  _loadTextureCanvas(foamName, 128, function(data, size) {
    self._foamData = data;
    self._foamDataSize = size;
    console.log('[StylizedWater] Foam texture loaded for CPU sampling: ' + foamName);
  });

  // 3. Caustics texture → CPU canvas for dual-layer min() sampling
  _loadTextureCanvas('Caustics_1', 128, function(data, size) {
    self._causticsData = data;
    self._causticsDataSize = size;
    console.log('[StylizedWater] Caustics texture loaded for CPU sampling');
  });

  // 4. Intersection noise → CPU canvas
  _loadTextureCanvas('IntersectionNoise', 64, function(data, size) {
    self._noiseData = data;
    self._noiseDataSize = size;
    console.log('[StylizedWater] Intersection noise loaded for CPU sampling');
  });

  // 5. Intersection foam texture → CPU canvas (shore foam pattern)
  _loadTextureCanvas('Intersection_Foam', 128, function(data, size) {
    self._intFoamData = data;
    self._intFoamDataSize = size;
    console.log('[StylizedWater] Intersection foam texture loaded for CPU sampling');
  });
};

// ── Animation Loop ─────────────────────────────────────

StylizedWaterSystem.prototype._animLoop = function() {
  if (this._disposed) return;

  var now = Date.now();
  var dt = Math.min((now - this._lastTime) / 1000, 0.1);
  this._lastTime = now;
  this._time += dt;

  // FPS tracking (Phase 7) + auto-quality adjustment
  this._fpsFrames++;
  var fpsElapsed = now - this._fpsTime;
  if (fpsElapsed >= 5000) {
    this._currentFPS = Math.round(this._fpsFrames / (fpsElapsed / 1000));
    this._fpsFrames = 0;
    this._fpsTime = now;
    if (this._currentFPS < 90) {
      console.warn('[StylizedWater] FPS: ' + this._currentFPS + ' (target: 90+)');
    }
    // Auto-disable refraction if FPS drops too low (it doubles render cost)
    if (this._currentFPS > 0 && this._currentFPS < 40 && this._usePhysical && this.settings.refractionEnabled) {
      this.settings.refractionEnabled = false;
      this._material.transmission = 0;
      this._material.needsUpdate = true;
      console.warn('[StylizedWater] Auto-disabled refraction (FPS was ' + this._currentFPS + ')');
    }
  }

  // Wave vertex displacement every frame
  this._updateWaves();

  // Normal map UV scrolling every frame (GPU-side, cheap)
  this._updateNormalMapUV();

  // Vertex colors every N frames (CPU-heavy)
  this._colorCounter++;
  if (this._colorCounter >= this._colorInterval) {
    this._colorCounter = 0;
    this._updateColors();
  }

  // Camera follow every frame
  this._updateCameraFollow();

  // Underwater camera fog (check every frame)
  this._updateUnderwaterFog();

  // Physics buoyancy every 3 frames (Phase 5)
  if (this._colorCounter === 0) {
    this._updateBuoyancy();
  }

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

  // Camera position for wave distance fade
  var camX = this.camera ? this.camera.position.x : meshX;
  var camZ = this.camera ? this.camera.position.z : meshZ;
  var fadeRange = s.scale * 0.45; // fade starts at 45% of scale

  for (var i = 0; i < count; i++) {
    var i3 = i * 3;
    var wx = orig[i3] + meshX;
    var wz = orig[i3 + 2] + meshZ;

    // Wave distance fade: reduce amplitude far from camera (Phase 1 + perf)
    var wdx = wx - camX;
    var wdz = wz - camZ;
    var wDist = Math.sqrt(wdx * wdx + wdz * wdz);
    var waveFade = _saturate(1 - wDist / fadeRange);

    var wave = _sampleWaves(wx, wz, this._time, s);

    // Phase 5: vertex color B channel = wave flattening
    var wf = waveFade;
    if (this._paintData) {
      wf *= (1.0 - this._paintData[i * 4 + 2]); // B=1 → flat
    }

    // Cap maximum displacement to prevent extreme peaks/sharp edges
    var maxDisp = s.waveHeight * 1.5;
    var offX = _clamp(wave.offset.x * wf, -maxDisp, maxDisp);
    var offY = wave.offset.y * wf; // Y not clamped (height is natural)
    var offZ = _clamp(wave.offset.z * wf, -maxDisp, maxDisp);

    pos[i3]     = orig[i3]     + offX;
    pos[i3 + 1] = orig[i3 + 1] + offY;
    pos[i3 + 2] = orig[i3 + 2] + offZ;
  }

  this._geometry.attributes.position.needsUpdate = true;
  this._geometry.computeVertexNormals();
};

// ── Normal Map UV Animation ────────────────────────────
// Scrolls the normal map UVs each frame for moving water surface
// Compensates for mesh world position so normals stay fixed in world space

StylizedWaterSystem.prototype._updateNormalMapUV = function() {
  if (!this._usePBR || !this._material.normalMap) return;

  var s = this.settings;
  var tiling = (s.normalTilingX || 0.5) * 10;
  var speed = s.normalSpeed || 0.1;
  var subTiling = s.normalSubTiling || 0.5;
  var subSpeed = s.normalSubSpeed || -0.25;

  // World-space UV compensation for camera-following mesh
  var meshU = this._mesh.position.x / Math.max(s.scale, 1);
  var meshV = this._mesh.position.z / Math.max(s.scale, 1);

  // River mode: bias UV scroll in flow direction (Phase 5)
  var flowDirX = 1.0;
  var flowDirZ = 0.7;
  if (s.riverMode) {
    var rad = (s.riverDirection || 0) * Math.PI / 180;
    flowDirX = Math.cos(rad) * (s.riverSpeed || 1.0);
    flowDirZ = Math.sin(rad) * (s.riverSpeed || 1.0);
  }

  // Primary layer UV scroll
  var u1 = meshU * tiling + this._time * speed * flowDirX;
  var v1 = meshV * tiling + this._time * speed * flowDirZ;

  // Secondary layer cross-pan (simulates dual normal map RNM blend)
  var u2 = meshU * tiling * subTiling + this._time * speed * subSpeed * flowDirX;
  var v2 = meshV * tiling * subTiling + this._time * speed * subSpeed * flowDirZ;

  // Blend primary + secondary via sinusoidal perturbation
  var blendU = u1 + Math.sin(u2 * TWO_PI) * 0.04;
  var blendV = v1 + Math.cos(v2 * TWO_PI) * 0.04;

  this._material.normalMap.repeat.set(tiling, tiling);
  this._material.normalMap.offset.set(blendU, blendV);

  // Distance-based normal strength reduction (Phase 5: distance normals)
  // + foam-based normal flattening (Phase 2: foam flattens tangent normals)
  if (this.camera) {
    var cam = this.camera.position;
    var dx = cam.x - this._mesh.position.x;
    var dz = cam.z - this._mesh.position.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var distFactor = _saturate(1 - dist / (s.scale * 0.4));
    var foamFlatten = 1.0 - _saturate(this._avgFoam * 2.0); // flatten when lots of foam
    var ns = (s.normalStrength || 0.5) * (0.2 + 0.8 * distFactor) * foamFlatten;
    this._material.normalScale.set(ns, -ns);

    // Phase 4: Reflection mask — foam reduces environment reflections
    if (this._usePhysical) {
      this._material.envMapIntensity = (s.envMapIntensity || 0.8) * (1.0 - _saturate(this._avgFoam * 3));
    }
  }
};

// ── Vertex Color Computation ───────────────────────────
// Computes per-vertex: depth color, foam (textured), intersection (noise),
// caustics (dual-layer min), wave tint, translucency glow, edge fade.
// PBR material handles specular/fresnel/shadows automatically.

StylizedWaterSystem.prototype._updateColors = function() {
  var s = this.settings;
  var colors = this._vertexColors;
  var pos = this._geometry.attributes.position.array;
  var count = pos.length / 3;
  var meshPos = this._mesh.position;

  var cam = this.camera;
  var camX = cam ? cam.position.x : 0;
  var camY = cam ? cam.position.y : 20;
  var camZ = cam ? cam.position.z : 0;
  var getTerrainH = window.__vibexe_getVisualTerrainHeight || null;

  var sun = this._getSunDirection();
  var sunCol = this._getSunColor();

  var shallow = s.shallowColor;
  var deep = s.deepColor;
  var horizon = s.horizonColor;
  var foamCol = s.foamColor;
  var intCol = s.intersectionColor;

  var foamEnabled = s.foamEnabled;
  var intEnabled = s.intersectionEnabled;
  var causticsEnabled = s.causticsEnabled;
  var hasFoamTex = !!this._foamData;
  var hasCausticsTex = !!this._causticsData;
  var hasNoiseTex = !!this._noiseData;
  var totalFoam = 0;

  for (var i = 0; i < count; i++) {
    var i3 = i * 3;
    var i4 = i * 4;

    var wx = pos[i3] + meshPos.x;
    var wy = pos[i3 + 1] + meshPos.y;
    var wz = pos[i3 + 2] + meshPos.z;

    // ── Depth ──
    var depth = 5.0;
    if (getTerrainH) {
      var terrainH = getTerrainH(wx, wz);
      depth = Math.max(0, wy - terrainH);
    }

    // ── Depth density (stronger attenuation for realistic water volume) ──
    var depthAtten = 1 - Math.exp(-depth * s.depthVertical * 0.25);
    var heightAtten = 1 - Math.exp(-depth * s.depthHorizontal * 1.5);
    var density = _saturate(Math.max(depthAtten, heightAtten));

    // ── Color absorption (Phase 3): Beer's law ──
    if (s.colorAbsorption > 0.01) {
      density = _saturate(density + (1 - Math.exp(-depth * s.colorAbsorption * 0.2)));
    }

    // ── Base color: shallow → deep ──
    var r = _lerp(shallow.r, deep.r, density);
    var g = _lerp(shallow.g, deep.g, density);
    var b = _lerp(shallow.b, deep.b, density);
    var a = _lerp(shallow.a, deep.a, density);

    var waveY = pos[i3 + 1]; // wave displacement height

    // ── Phase 5: Vertex paint modulation ──
    var paintR = 0, paintG = 0, paintA = 0;
    if (this._paintData) {
      paintR = this._paintData[i * 4];     // R = intersection boost
      paintG = this._paintData[i * 4 + 1]; // G = depth mask (force deep)
      paintA = this._paintData[i * 4 + 3]; // A = foam painting
      density = _saturate(density + paintG * 0.5); // G pushes toward deep color
    }

    // ── Wave tint (darken troughs, lighten crests) ──
    if (s.waveTint > 0.001) {
      var tint = _saturate(waveY * s.waveTint * 2.0);
      r += tint * 0.08 * sunCol.r;
      g += tint * 0.12 * sunCol.g;
      b += tint * 0.08 * sunCol.b;
    }

    // ── Foam (Phase 2): texture-sampled ──
    var foam = 0;
    if (foamEnabled) {
      // Wave crest foam + paint channel A
      var crest = _saturate(waveY * 2.0) * s.foamWaveAmount;
      foam = crest + s.foamBaseAmount + paintA;

      // Dual-layer foam texture sampling (Phase 2: proper dissolve)
      if (hasFoamTex && foam > 0.001) {
        // Layer 1: primary foam pattern
        var foamU1 = wx * s.foamTilingX + this._time * s.foamSpeed;
        var foamV1 = wz * s.foamTilingY + this._time * s.foamSpeed * 0.7;
        var fs1 = _sampleImageData(this._foamData, this._foamDataSize, foamU1, foamV1);

        // Layer 2: secondary at different scale + reversed scroll
        var foamU2 = wx * s.foamTilingX * 1.4 - this._time * s.foamSpeed * 0.3;
        var foamV2 = wz * s.foamTilingY * 1.4 + this._time * s.foamSpeed * 0.5;
        var fs2 = _sampleImageData(this._foamData, this._foamDataSize, foamU2, foamV2);

        // Combine: saturate(sample1.r + sample2.r) → rich dissolve pattern
        var foamTex = _saturate(fs1.r + fs2.r);

        // Dissolve clipping
        if (s.foamClipping > 0.001) {
          foamTex = _smoothstep(s.foamClipping, 1.0, foamTex);
        }

        // Smoothstep dissolve edge (Unity: smoothstep(invertedMask, invertedMask+1, foamTex))
        var invertedMask = 1.0 - foam;
        foam = _smoothstep(invertedMask, invertedMask + 0.8, foamTex) * foamCol.a;
      }

      foam = _saturate(foam);

      // Blend foam color
      if (foam > 0.001) {
        var fA = foam * foamCol.a;
        r = _lerp(r, foamCol.r, fA);
        g = _lerp(g, foamCol.g, fA);
        b = _lerp(b, foamCol.b, fA);
      }
    }

    // ── Intersection foam (Phase 2): texture + noise sampled ──
    var intersection = 0;
    if (intEnabled && getTerrainH && depth < s.intersectionLength) {
      var intDist = _saturate(depth / Math.max(s.intersectionLength, 0.01));

      // Sample intersection noise for pattern variation
      var noise = 1.0;
      if (hasNoiseTex) {
        var noiseU = wx * 0.3 + this._time * 0.05;
        var noiseV = wz * 0.3 + this._time * 0.03;
        noise = _sampleImageData(this._noiseData, this._noiseDataSize, noiseU, noiseV).r;
      }

      // Sample intersection foam texture for shore foam pattern
      var intFoamTex = 1.0;
      if (this._intFoamData) {
        var ifU = wx * 0.15 + this._time * 0.02;
        var ifV = wz * 0.15 - this._time * 0.015;
        intFoamTex = _sampleImageData(this._intFoamData, this._intFoamDataSize, ifU, ifV).r;
      }

      if (s.intersectionStyle === 0) {
        // Sharp step: step(clipping, saturate((noise + sineRipple) * dist + dist))
        var sineRipple = Math.sin(intDist * 12.566 + this._time * 2.0) * 0.5 + 0.5;
        intersection = 1.0 - _smoothstep(0.0, 0.3, _saturate((noise + sineRipple) * intDist + intDist));
        intersection *= intFoamTex;
      } else if (s.intersectionStyle === 1) {
        // Smooth: saturate(noise1 + noise2 + dist) * dist
        intersection = _saturate(noise * intFoamTex + (1.0 - intDist)) * (1.0 - intDist);
        intersection *= intersection;
      } else {
        // Ripple: animated sine waves with foam texture
        var ripple = Math.sin(intDist * 18.85 + this._time * 3.0) * 0.5 + 0.5;
        intersection = (1.0 - intDist) * ripple * noise * intFoamTex;
      }

      intersection = _saturate(intersection + paintR) * intCol.a; // R boosts intersection

      if (intersection > 0.001) {
        r = _lerp(r, intCol.r, intersection);
        g = _lerp(g, intCol.g, intersection);
        b = _lerp(b, intCol.b, intersection);
      }
    }

    // ── Caustics (Phase 3): dual-layer min() blend ──
    if (causticsEnabled && hasCausticsTex && depth > 0.1 && depth < 20) {
      var ct = this._time * s.causticsSpeed;
      var cTile = s.causticsTiling;

      // Layer 1
      var cu1 = wx * cTile + ct;
      var cv1 = wz * cTile + ct * 0.5;
      var c1 = _sampleImageData(this._causticsData, this._causticsDataSize, cu1, cv1);

      // Layer 2 (different scale + reversed direction)
      var cu2 = wx * cTile * 0.8 - ct;
      var cv2 = wz * cTile * 0.8 - ct * 0.3;
      var c2 = _sampleImageData(this._causticsData, this._causticsDataSize, cu2, cv2);

      // Key visual trick: min of two layers → "swimming light network"
      var causticG = Math.min(c1.g, c2.g) * 2.0;

      // Chromatic aberration: shift R and B channels by UV offset
      var causticR, causticB;
      if (s.causticsDistortion > 0.01) {
        var caOff = s.causticsDistortion * 0.015;
        var c1r = _sampleImageData(this._causticsData, this._causticsDataSize, cu1 + caOff, cv1 + caOff * 0.5);
        var c1b = _sampleImageData(this._causticsData, this._causticsDataSize, cu1 - caOff, cv1 - caOff * 0.5);
        causticR = Math.min(c1r.r, c2.r) * 2.0;
        causticB = Math.min(c1b.b, c2.b) * 2.0;
      } else {
        causticR = Math.min(c1.r, c2.r) * 2.0;
        causticB = Math.min(c1.b, c2.b) * 2.0;
      }

      // Chromance control: mono vs color
      if (s.causticsChromance < 0.99) {
        var causticMono = (causticR + causticG + causticB) / 3;
        causticR = _lerp(causticMono, causticR, s.causticsChromance);
        causticG = _lerp(causticMono, causticG, s.causticsChromance);
        causticB = _lerp(causticMono, causticB, s.causticsChromance);
      }

      // Mask: fade out near foam/intersection/deep water
      var caustMask = _saturate((1 - density * 0.5) - foam * 0.5 - intersection * 0.5);
      var caustDepthMask = _saturate(1 - depth / 20);
      caustMask *= caustDepthMask;

      var cBright = s.causticsBrightness;
      r += causticR * caustMask * cBright * 0.3;
      g += causticG * caustMask * cBright * 0.3;
      b += causticB * caustMask * cBright * 0.25;
    }

    // ── Horizon color (distance-based + SWA fog integration) ──
    // Phase 7: auto-match horizon to SWA atmospheric fog color
    var hCol = horizon;
    var swa = window.__vibexe_skyWeatherAdvanced;
    if (swa && swa._fogColor && this.scene && this.scene.fog) {
      var fc = this.scene.fog.color;
      if (fc) {
        hCol = { r: _lerp(horizon.r, fc.r, 0.5), g: _lerp(horizon.g, fc.g, 0.5),
                 b: _lerp(horizon.b, fc.b, 0.5), a: horizon.a };
      }
    }

    if (hCol.a > 0.001) {
      var dx = wx - camX;
      var dz = wz - camZ;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var horizonFactor = _saturate(dist / (s.horizonDistance * 100));
      horizonFactor = horizonFactor * horizonFactor;
      r = _lerp(r, hCol.r, horizonFactor * hCol.a);
      g = _lerp(g, hCol.g, horizonFactor * hCol.a);
      b = _lerp(b, hCol.b, horizonFactor * hCol.a);
    }

    // ── Translucency / SSS (Phase 4) ──
    // Adds subsurface glow when looking towards light through water
    if (s.translucencyStrength > 0.001 && cam) {
      var tvx = -(camX - wx);
      var tvy = -(camY - wy);
      var tvz = -(camZ - wz);
      var tvLen = Math.sqrt(tvx * tvx + tvy * tvy + tvz * tvz);
      if (tvLen > 0.01) {
        tvx /= tvLen; tvy /= tvLen; tvz /= tvLen;
        var transmit = _saturate(tvx * sun.x + tvy * sun.y + tvz * sun.z);
        transmit = Math.pow(transmit, s.translucencyExp) * s.translucencyStrength;
        r += transmit * 0.1 * sunCol.r;
        g += transmit * 0.3 * sunCol.g;
        b += transmit * 0.2 * sunCol.b;
      }
    }

    // ── Sparkles (Phase 5) ──
    if (s.sparkleIntensity > 0.001) {
      var sparkHash = Math.sin(wx * 127.1 + wz * 311.7 + this._time * 5.0) * 43758.5453;
      sparkHash = sparkHash - Math.floor(sparkHash);
      if (sparkHash > s.sparkleSize) {
        var sparkle = (sparkHash - s.sparkleSize) / (1 - s.sparkleSize);
        sparkle *= s.sparkleIntensity;
        // Only sparkle where lit by sun
        var wNorm = _sampleWaves(wx, wz, this._time, s).normal;
        var NdotL = _saturate(wNorm.x * sun.x + wNorm.y * sun.y + wNorm.z * sun.z);
        sparkle *= NdotL;
        r += sparkle * sunCol.r;
        g += sparkle * sunCol.g;
        b += sparkle * sunCol.b;
      }
    }

    // ── Edge fade (alpha near shore) ──
    if (s.edgeFade > 0.001 && getTerrainH) {
      var edgeAlpha = _saturate(depth / (s.edgeFade * 0.5));
      a *= edgeAlpha;
    }

    // ── Minimum alpha floor (prevent fully transparent water) ──
    // Deeper water = more opaque; shallow shore keeps edge fade
    var depthAlphaBoost = _saturate(depth * 0.4);
    a = Math.max(a, 0.5 + depthAlphaBoost * 0.42);

    // ── Final output ──
    colors[i4]     = _saturate(r);
    colors[i4 + 1] = _saturate(g);
    colors[i4 + 2] = _saturate(b);
    colors[i4 + 3] = _saturate(a);

    // Track foam for normal flattening
    totalFoam += foam + intersection;
  }

  // Store average foam for normal flattening in _updateNormalMapUV
  this._avgFoam = totalFoam / Math.max(count, 1);

  this._geometry.attributes.color.needsUpdate = true;
};

// ── Camera Following ───────────────────────────────────

StylizedWaterSystem.prototype._updateCameraFollow = function() {
  if (!this.settings.followCamera || !this.camera) return;

  // Disable camera follow when editor is active (so gizmo can move the water)
  var editor = window.__vibexe_editor__;
  if (editor && editor.isEditing) return;

  var camX = this.camera.position.x;
  var camZ = this.camera.position.z;
  var cellSize = 1.0 / Math.max(this.settings.resolution, 0.01);
  cellSize = Math.max(cellSize, 2);

  this._mesh.position.x = Math.round(camX / cellSize) * cellSize;
  this._mesh.position.z = Math.round(camZ / cellSize) * cellSize;

  // Sync underwater solid + volume floor
  if (this._underwaterMesh) {
    this._underwaterMesh.position.x = this._mesh.position.x;
    this._underwaterMesh.position.y = this._mesh.position.y - 0.15;
    this._underwaterMesh.position.z = this._mesh.position.z;
  }
  if (this._volumeFloorMesh) {
    this._volumeFloorMesh.position.x = this._mesh.position.x;
    this._volumeFloorMesh.position.z = this._mesh.position.z;
  }
};

// ── Underwater Camera Fog ──────────────────────────────

StylizedWaterSystem.prototype._updateUnderwaterFog = function() {
  if (!this.camera || !this.scene) return;
  var camY = this.camera.position.y;
  var waterSurface = this._mesh ? this._mesh.position.y : this.settings.waterLevel;

  if (camY < waterSurface) {
    // Camera is underwater — apply underwater fog + tint
    if (!this._underwaterFogActive) {
      this._underwaterFogActive = true;
      this._savedFog = this.scene.fog || null;
      this._savedBgColor = this.scene.background;
      var deep = this.settings.deepColor;
      var fogColor = new THREE.Color(deep.r * 0.3, deep.g * 0.3, deep.b * 0.5);
      this.scene.fog = new THREE.FogExp2(fogColor, 0.06);
      this.scene.background = fogColor;
    }
    // Dynamically adjust fog density based on depth below surface
    if (this.scene.fog && this.scene.fog.density !== undefined) {
      var depthBelow = waterSurface - camY;
      this.scene.fog.density = _clamp(0.03 + depthBelow * 0.008, 0.03, 0.15);
    }
  } else {
    // Camera is above water — restore original fog
    if (this._underwaterFogActive) {
      this._underwaterFogActive = false;
      this.scene.fog = this._savedFog || null;
      if (this._savedBgColor !== undefined) this.scene.background = this._savedBgColor;
    }
  }
};

// ── Sun Direction / Color ──────────────────────────────

StylizedWaterSystem.prototype._getSunDirection = function() {
  var swa = window.__vibexe_skyWeatherAdvanced;
  if (swa && swa._sunDirection) {
    var sd = swa._sunDirection;
    return _normalize3(sd.x || sd[0] || 0, sd.y || sd[1] || 0.707, sd.z || sd[2] || 0.707);
  }
  var scene = this.scene;
  if (scene) {
    for (var j = 0; j < scene.children.length; j++) {
      var child = scene.children[j];
      if (child.isDirectionalLight && child.visible) {
        return _normalize3(child.position.x, child.position.y, child.position.z);
      }
    }
  }
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
        return { r: child.color.r, g: child.color.g, b: child.color.b };
      }
    }
  }
  return { r: 1.0, g: 0.95, b: 0.9 };
};

// ── FPS Query (Phase 7) ────────────────────────────────

StylizedWaterSystem.prototype.getFPS = function() {
  return this._currentFPS;
};

StylizedWaterSystem.prototype.getStats = function() {
  return {
    fps: this._currentFPS,
    vertices: this._origPositions ? this._origPositions.length / 3 : 0,
    material: this._usePhysical ? 'MeshPhysicalMaterial' : (this._usePBR ? 'MeshStandardMaterial' : 'MeshBasicMaterial'),
    refraction: this._usePhysical && this.settings.refractionEnabled ? 'ON' : 'OFF',
    textures: {
      normalMap: this._rnmApplied ? 'RNM-blended' : (this._material && this._material.normalMap ? 'loaded' : 'none'),
      foam: this._foamData ? 'loaded' : 'none',
      caustics: this._causticsData ? 'loaded' : 'none',
      noise: this._noiseData ? 'loaded' : 'none',
      intFoam: this._intFoamData ? 'loaded' : 'none',
    },
    waterBodies: (window.__vibexe_waterBodies || []).length,
    riverMode: !!this.settings.riverMode,
    avgFoam: Math.round(this._avgFoam * 1000) / 1000,
  };
};

// ── Vertex Color Painting API (Phase 5) ────────────────
// R = intersection intensity boost
// G = depth mask override (0 = use computed, 1 = force deep)
// B = wave flattening (0 = full waves, 1 = flat)
// A = foam painting (0 = computed, 1 = force foam)

StylizedWaterSystem.prototype.setVertexPaint = function(data) {
  // data: Float32Array with 4 values per vertex (RGBA)
  if (data && data.length === (this._origPositions.length / 3) * 4) {
    this._paintData = data;
    console.log('[StylizedWater] Vertex paint data applied: ' + (data.length / 4) + ' vertices');
  } else {
    console.warn('[StylizedWater] Invalid paint data length');
  }
};

// ── Physics Buoyancy Force (Phase 5) ───────────────────
// Applies upward force + drag to Rapier rigid bodies submerged in water

StylizedWaterSystem.prototype._updateBuoyancy = function() {
  if (!this.settings.buoyancyEnabled) return;

  // Find Rapier world
  var rapierWorld = window.__vibexe_rapierWorld__ || null;
  if (!rapierWorld || !rapierWorld.forEachRigidBody) return;

  var self = this;
  var s = this.settings;

  try {
    rapierWorld.forEachRigidBody(function(body) {
      if (body.isFixed() || body.isKinematic()) return;

      var pos = body.translation();

      // Bounds check: skip bodies outside non-followCamera water extent
      if (!s.followCamera && self._mesh) {
        var mx = self._mesh.position.x, mz = self._mesh.position.z;
        var hs = (s.scale || 200) / 2;
        if (pos.x < mx - hs || pos.x > mx + hs || pos.z < mz - hs || pos.z > mz + hs) return;
      }

      var waterH = _sampleWaves(pos.x, pos.z, self._time, s).height;
      var submerged = waterH - pos.y;

      if (submerged > 0) {
        // Buoyancy force proportional to submersion depth
        var force = Math.min(submerged * 12, 40);
        body.applyImpulse({ x: 0, y: force * 0.016, z: 0 }, true);

        // Water drag (resistance)
        var vel = body.linvel();
        body.applyImpulse({
          x: -vel.x * 0.04,
          y: -vel.y * 0.015,
          z: -vel.z * 0.04
        }, true);

        // Angular drag (dampen spinning)
        var angVel = body.angvel();
        body.applyTorqueImpulse({
          x: -angVel.x * 0.02,
          y: -angVel.y * 0.02,
          z: -angVel.z * 0.02
        }, true);
      }
    });
  } catch(e) {
    // Rapier iteration may fail if world is being stepped
  }
};

// ── Buoyancy API (Phase 5) ─────────────────────────────

StylizedWaterSystem.prototype._registerBuoyancyAPI = function() {
  var self = this;

  // Phase 7: Multiple water bodies support
  window.__vibexe_waterBodies = window.__vibexe_waterBodies || [];
  window.__vibexe_waterBodies.push(self);

  // Height query checks ALL water bodies, returns highest (with spatial bounds)
  window.__vibexe_getWaterHeight = function(x, z) {
    var bodies = window.__vibexe_waterBodies || [];
    var maxH = -Infinity;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (b && !b._disposed && b.settings.buoyancyEnabled) {
        // Skip if query point outside non-followCamera body bounds
        if (!b.settings.followCamera && b._mesh) {
          var mx = b._mesh.position.x, mz = b._mesh.position.z;
          var hs = (b.settings.scale || 200) / 2;
          if (x < mx - hs || x > mx + hs || z < mz - hs || z > mz + hs) continue;
        }
        var h = _sampleWaves(x, z, b._time, b.settings).height;
        if (h > maxH) maxH = h;
      }
    }
    return maxH > -Infinity ? maxH : 0;
  };

  // Normal query from the highest water body at this position (with spatial bounds)
  window.__vibexe_getWaterNormal = function(x, z) {
    var bodies = window.__vibexe_waterBodies || [];
    var maxH = -Infinity;
    var bestNormal = { x: 0, y: 1, z: 0 };
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (b && !b._disposed && b.settings.buoyancyEnabled) {
        if (!b.settings.followCamera && b._mesh) {
          var mx = b._mesh.position.x, mz = b._mesh.position.z;
          var hs = (b.settings.scale || 200) / 2;
          if (x < mx - hs || x > mx + hs || z < mz - hs || z > mz + hs) continue;
        }
        var wave = _sampleWaves(x, z, b._time, b.settings);
        if (wave.height > maxH) {
          maxH = wave.height;
          bestNormal = wave.normal;
        }
      }
    }
    return bestNormal;
  };

  window.__vibexe_isUnderwater = function(x, y, z) {
    var wh = window.__vibexe_getWaterHeight(x, z);
    return y < wh;
  };

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
    if (this._underwaterMesh) this._underwaterMesh.position.y = this.settings.waterLevel - 0.15;
    if (this._volumeFloorMesh) this._volumeFloorMesh.position.y = this.settings.waterLevel - (this.settings.volumeDepth || 8);
    window.__vibexe_waterLevel = this.settings.waterLevel;
  }

  // Update PBR material properties
  if (this._usePBR && this._material) {
    this._material.roughness = _clamp(this.settings.roughness || 0.15, 0, 1);
    this._material.metalness = _clamp(this.settings.metalness || 0.3, 0, 1);
    this._material.envMapIntensity = this.settings.envMapIntensity || 0.8;
    var ns = this.settings.normalStrength || 0.5;
    this._material.normalScale.set(ns, -ns);

    // Phase 3: Update refraction (MeshPhysicalMaterial only)
    if (this._usePhysical) {
      this._material.transmission = this.settings.refractionEnabled
        ? _clamp(this.settings.refractionStrength || 0.3, 0, 1) : 0;
      this._material.thickness = _clamp(this.settings.refractionThickness || 2.0, 0.1, 10);
      var dp = this.settings.deepColor || DEFAULT_SETTINGS.deepColor;
      if (this._material.attenuationColor) {
        this._material.attenuationColor.setRGB(dp.r, dp.g, dp.b);
      }
      this._material.needsUpdate = true;
    }
  }

  // Reload textures if indices changed
  if (this.settings.normalMapIndex !== oldNormalIdx || this.settings.foamTextureIndex !== oldFoamIdx) {
    this._loadTextures();
  }

  // Visibility
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

  var segX = _clamp(Math.round(s.scale * s.resolution), 8, 400);
  var segZ = _clamp(Math.round(s.scale * s.resolution), 8, 400);

  this._geometry = new THREE.PlaneGeometry(s.scale, s.scale, segX, segZ);
  this._geometry.rotateX(-Math.PI / 2);

  var pos = this._geometry.attributes.position.array;
  this._origPositions = new Float32Array(pos.length);
  this._origPositions.set(pos);

  var vertCount = pos.length / 3;
  this._vertexColors = new Float32Array(vertCount * 4);
  this._geometry.setAttribute('color', new THREE.BufferAttribute(this._vertexColors, 4));

  this._mesh.geometry = this._geometry;
  // Rebuild underwater plane to match new scale
  if (this._underwaterMesh) {
    var uwGeo2 = new THREE.PlaneGeometry(s.scale, s.scale);
    uwGeo2.rotateX(-Math.PI / 2);
    if (this._underwaterMesh.geometry) this._underwaterMesh.geometry.dispose();
    this._underwaterMesh.geometry = uwGeo2;
  }
  console.log('[StylizedWater] Rebuilt geometry — verts:' + vertCount);
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
      if (this._mesh) this._mesh.position.y = this.settings.waterLevel;
      if (this._usePBR && this._material) {
        this._material.roughness = 0.15;
        this._material.metalness = 0.3;
      }
      break;
    default: break;
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

  if (this._mesh && this.scene) this.scene.remove(this._mesh);
  if (this._underwaterMesh && this.scene) this.scene.remove(this._underwaterMesh);
  if (this._volumeFloorMesh && this.scene) this.scene.remove(this._volumeFloorMesh);
  if (this._geometry) this._geometry.dispose();
  if (this._material) this._material.dispose();
  if (this._underwaterMat) this._underwaterMat.dispose();
  if (this._volumeFloorMat) this._volumeFloorMat.dispose();

  // Restore fog if underwater fog was active
  if (this._underwaterFogActive && this.scene) {
    this.scene.fog = this._savedFog || null;
    if (this._savedBgColor !== undefined) this.scene.background = this._savedBgColor;
  }

  // Remove from water bodies array
  var bodies = window.__vibexe_waterBodies || [];
  var idx = bodies.indexOf(this);
  if (idx >= 0) bodies.splice(idx, 1);

  // Only clean up globals if no water bodies remain
  if (bodies.length === 0) {
    delete window.__vibexe_getWaterHeight;
    delete window.__vibexe_getWaterNormal;
    delete window.__vibexe_isUnderwater;
    delete window.__vibexe_waterLevel;
  }
  delete window.__vibexe_stylizedWater;

  this._mesh = null;
  this._geometry = null;
  this._material = null;
  this._origPositions = null;
  this._vertexColors = null;
  this._foamData = null;
  this._causticsData = null;
  this._noiseData = null;

  console.log('[StylizedWater] Disposed');
};

// ============================================================
// Section 6b: WaterBodyManager — Multi-Body System
// ============================================================

function WaterBodyManager(scene, camera) {
  this.scene = scene;
  this.camera = camera;
  this._bodies = {};
  this._bodyOrder = [];
  this._activeBodyId = null;
  this._maxBodies = 4;
}

WaterBodyManager.prototype.createBody = function(config, id, name) {
  if (this._bodyOrder.length >= this._maxBodies) {
    console.warn('[WaterBodyManager] Max bodies (' + this._maxBodies + ') reached');
    return null;
  }
  var bodyId = id || ('water_' + Date.now().toString(36));
  var displayName = name || ('Water ' + (this._bodyOrder.length + 1));
  var system = new StylizedWaterSystem(this.scene, this.camera, config, bodyId, displayName);

  // Stagger color updates across bodies
  var total = this._bodyOrder.length + 1;
  system._colorInterval = Math.max(2, total);

  this._bodies[bodyId] = system;
  this._bodyOrder.push(bodyId);

  if (!this._activeBodyId) this._activeBodyId = bodyId;

  // Update stagger for all existing bodies
  for (var i = 0; i < this._bodyOrder.length; i++) {
    var b = this._bodies[this._bodyOrder[i]];
    if (b) b._colorInterval = Math.max(2, total);
  }

  return system;
};

WaterBodyManager.prototype.removeBody = function(id) {
  var system = this._bodies[id];
  if (!system) return;

  system.dispose();
  delete this._bodies[id];
  var idx = this._bodyOrder.indexOf(id);
  if (idx >= 0) this._bodyOrder.splice(idx, 1);

  if (this._activeBodyId === id) {
    this._activeBodyId = this._bodyOrder.length > 0 ? this._bodyOrder[0] : null;
  }

  var total = this._bodyOrder.length;
  for (var i = 0; i < this._bodyOrder.length; i++) {
    var b = this._bodies[this._bodyOrder[i]];
    if (b) b._colorInterval = Math.max(2, total);
  }

  this._sendBodyList();
};

WaterBodyManager.prototype.getActiveBody = function() {
  return this._activeBodyId ? this._bodies[this._activeBodyId] : null;
};

WaterBodyManager.prototype._sendBodyList = function() {
  var bodies = [];
  for (var i = 0; i < this._bodyOrder.length; i++) {
    var id = this._bodyOrder[i];
    var sys = this._bodies[id];
    if (sys) {
      bodies.push({
        id: id,
        name: sys._displayName,
        followCamera: sys.settings.followCamera,
        scale: sys.settings.scale,
        waterLevel: sys.settings.waterLevel,
      });
    }
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'stylized-water-body-list',
      bodies: bodies,
      activeId: this._activeBodyId,
    }, '*');
  }
};

// Request parent to persist full body state to DB
WaterBodyManager.prototype._requestSave = function() {
  var bodies = [];
  for (var i = 0; i < this._bodyOrder.length; i++) {
    var id = this._bodyOrder[i];
    var sys = this._bodies[id];
    if (sys) {
      var cfg = _deepMerge({}, sys.settings);
      cfg.id = id;
      cfg.name = sys._displayName;
      bodies.push(cfg);
    }
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'stylized-water-save-all',
      bodies: bodies,
      selectedBodyId: this._activeBodyId,
    }, '*');
  }
};

WaterBodyManager.prototype._sendBodyConfig = function(id) {
  var sys = id ? this._bodies[id] : this.getActiveBody();
  if (!sys) return;
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'stylized-water-body-config',
      bodyId: sys._bodyId,
      config: sys.settings,
      name: sys._displayName,
    }, '*');
  }
};

WaterBodyManager.prototype.handleBridgeMessage = function(type, payload) {
  var t = type.replace('stylized-water-', '');

  switch (t) {
    case 'get-body-list':
      this._sendBodyList();
      return;
    case 'get-body-config':
      this._sendBodyConfig(payload.bodyId || this._activeBodyId);
      return;
    case 'add-body': {
      var newConfig = _deepMerge({}, DEFAULT_SETTINGS);
      if (payload.config) newConfig = _deepMerge(newConfig, payload.config);
      newConfig.followCamera = false;
      newConfig.scale = (payload.config && payload.config.scale) || 50;
      if (payload.position) {
        newConfig.position = { x: payload.position.x || 0, y: payload.position.y || 0, z: payload.position.z || 0 };
      }
      var sys = this.createBody(newConfig, null, payload.name);
      if (sys) {
        this._activeBodyId = sys._bodyId;
        this._sendBodyList();
        this._sendBodyConfig(sys._bodyId);
        this._requestSave();
      }
      return;
    }
    case 'remove-body': {
      var rid = payload.bodyId || this._activeBodyId;
      if (this._bodyOrder.length <= 1) return;
      this.removeBody(rid);
      this._requestSave();
      return;
    }
    case 'select-body': {
      var sid = payload.bodyId;
      if (sid && this._bodies[sid]) {
        this._activeBodyId = sid;
        this._sendBodyList();
        this._sendBodyConfig(sid);
      }
      return;
    }
    case 'rename-body': {
      var rsys = this._bodies[payload.bodyId || this._activeBodyId];
      if (rsys && payload.name) {
        rsys._displayName = payload.name;
        this._sendBodyList();
        this._requestSave();
      }
      return;
    }
    case 'sync-position': {
      var psys = this._bodies[payload.bodyId || this._activeBodyId];
      if (psys && payload.position) {
        psys.settings.followCamera = false;
        psys.settings.position = { x: payload.position.x || 0, y: payload.position.y || 0, z: payload.position.z || 0 };
        if (psys._mesh) {
          psys._mesh.position.x = payload.position.x || 0;
          psys._mesh.position.z = payload.position.z || 0;
        }
        if (psys._underwaterMesh) {
          psys._underwaterMesh.position.x = payload.position.x || 0;
          psys._underwaterMesh.position.z = payload.position.z || 0;
        }
        if (psys._volumeFloorMesh) {
          psys._volumeFloorMesh.position.x = payload.position.x || 0;
          psys._volumeFloorMesh.position.z = payload.position.z || 0;
        }
        this._requestSave();
      }
      return;
    }
    default: break;
  }

  // Route config updates to specific body or active body
  var targetId = (payload && payload.bodyId) || this._activeBodyId;
  var target = targetId ? this._bodies[targetId] : null;
  if (target) {
    target.handleBridgeMessage(type, payload);
  }
};

// ============================================================
// Section 7: Auto-Init & Bridge Listener
// ============================================================

if (typeof window !== 'undefined') {
  window.__vibexe_modules__ = window.__vibexe_modules__ || {};
  window.__vibexe_modules__['stylized-water'] = {
    StylizedWaterSystem: StylizedWaterSystem,
    WaterBodyManager: WaterBodyManager,
  };

  (function() {
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      var scene = window.__vibexe_scene__;

      // Re-init if scene changed
      if (scene && window.__vibexe_waterManager &&
          window.__vibexe_waterManager.scene !== scene) {
        console.log('[StylizedWater] Scene changed, re-initializing');
        try {
          var oldMgr = window.__vibexe_waterManager;
          for (var oi = oldMgr._bodyOrder.length - 1; oi >= 0; oi--) {
            try { oldMgr._bodies[oldMgr._bodyOrder[oi]].dispose(); } catch(e) {}
          }
        } catch(e) {}
        window.__vibexe_waterManager = null;
        window.__vibexe_stylizedWater = null;
      }

      if (scene && typeof THREE !== 'undefined' && !window.__vibexe_waterManager) {
        clearInterval(timer);

        var camera = window.__vibexe_camera__ || null;
        if (!camera) {
          scene.traverse(function(obj) {
            if (obj.isCamera && !camera) camera = obj;
          });
        }

        // Load saved settings
        var rawSettings = {};
        try {
          var gs = window.__VIBEXE_GAME_SETTINGS__;
          if (gs) {
            if (gs.stylizedWater && typeof gs.stylizedWater === 'object') {
              rawSettings = gs.stylizedWater;
            } else if (gs.modules && gs.modules.installed && gs.modules.installed['stylized-water']) {
              rawSettings = gs.modules.installed['stylized-water'].config || {};
            }
          }
        } catch(e) {}

        // Create manager
        var manager = new WaterBodyManager(scene, camera);

        // Migrate: old flat config → bodies[] array
        var bodiesArr;
        if (rawSettings.bodies && Array.isArray(rawSettings.bodies)) {
          bodiesArr = rawSettings.bodies;
          console.log('[StylizedWater] Multi-body config — ' + bodiesArr.length + ' bodies');
        } else {
          // Old flat format → wrap as single body
          bodiesArr = [{ id: 'water_0', name: 'Water 1', ...rawSettings }];
          console.log('[StylizedWater] Migrated flat config to single body');
        }

        // Create each body
        for (var bi = 0; bi < bodiesArr.length; bi++) {
          var bc = bodiesArr[bi];
          var bid = bc.id || ('water_' + bi);
          var bname = bc.name || ('Water ' + (bi + 1));
          manager.createBody(bc, bid, bname);
        }

        // Select saved active body
        if (rawSettings.selectedBodyId && manager._bodies[rawSettings.selectedBodyId]) {
          manager._activeBodyId = rawSettings.selectedBodyId;
        }

        window.__vibexe_waterManager = manager;
        // Backwards compat: point singleton at first body
        window.__vibexe_stylizedWater = manager.getActiveBody();

        // Bridge message listener — route through manager
        window.addEventListener('message', function(ev) {
          if (!ev.data || !ev.data.type) return;
          var mgr = window.__vibexe_waterManager;
          if (!mgr) return;
          if (ev.data.type.indexOf('stylized-water-') === 0) {
            mgr.handleBridgeMessage(ev.data.type, ev.data.payload || ev.data);
            // Keep singleton ref in sync with active body
            window.__vibexe_stylizedWater = mgr.getActiveBody();
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
  WaterBodyManager: WaterBodyManager,
};
`,
	bridgeHandlers: {
		"stylized-water-update-config": "handleUpdateConfig",
		"stylized-water-set-height": "handleSetHeight",
		"stylized-water-set-preset": "handleSetPreset",
		"stylized-water-set-visible": "handleSetVisible",
		"stylized-water-add-body": "handleAddBody",
		"stylized-water-remove-body": "handleRemoveBody",
		"stylized-water-select-body": "handleSelectBody",
		"stylized-water-rename-body": "handleRenameBody",
		"stylized-water-get-body-list": "handleGetBodyList",
		"stylized-water-get-body-config": "handleGetBodyConfig",
		"stylized-water-sync-position": "handleSyncPosition",
	},
	defaultSettings: {
		waterLevel: -3,
		scale: 200,
		resolution: 1.0,
		followCamera: true,
		visible: true,
		volumeDepth: 8,
		shallowColor: { r: 0.4, g: 0.8, b: 0.9, a: 0.92 },
		deepColor: { r: 0.05, g: 0.15, b: 0.4, a: 0.98 },
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
		normalSpeed: 0.1,
		foamEnabled: true,
		foamColor: { r: 1, g: 1, b: 1, a: 0.8 },
		foamTilingX: 0.1,
		foamTilingY: 0.1,
		foamSpeed: 0.1,
		foamWaveAmount: 0.3,
		foamBaseAmount: 0,
		foamClipping: 0,
		foamTextureIndex: 0,
		intersectionEnabled: true,
		intersectionColor: { r: 1, g: 1, b: 1, a: 1 },
		intersectionLength: 2,
		intersectionStyle: 1,
		causticsEnabled: true,
		causticsBrightness: 1.0,
		causticsChromance: 0.5,
		causticsTiling: 0.5,
		causticsSpeed: 0.5,
		colorAbsorption: 0.5,
		roughness: 0.15,
		metalness: 0.3,
		sunReflectionSize: 0.5,
		sunReflectionStrength: 1.0,
		translucencyStrength: 0.5,
		translucencyExp: 6.0,
		sparkleIntensity: 0,
		sparkleSize: 0.9,
		refractionEnabled: false,
		refractionStrength: 0.3,
		refractionThickness: 2.0,
		riverMode: false,
		riverDirection: 0,
		riverSpeed: 1.0,
		buoyancyEnabled: true,
	},
};
