/**
 * Sky & Weather Module — Manifest & Registration
 *
 * Vibexe module: Dynamic procedural sky with day/night cycle,
 * astronomical sun/moon positioning, atmospheric Mie scattering,
 * gradient sky rendering, automated lighting, and weather foundation.
 *
 * Converted from Unity Asset Store "Enviro 3 - Sky and Weather" by Hendrik Haupt.
 *
 * Phase 1 Features:
 * - Procedural 6-band gradient sky dome (front/back asymmetry)
 * - Astronomical sun/moon positioning (horizontal coordinate system)
 * - Mie scattering (Henyey-Greenstein phase function)
 * - Sun disk with corona glow
 * - Moon disk with phase rendering
 * - Procedural star field with twinkle
 * - Directional light automation (color temperature + intensity curves)
 * - Hemisphere ambient light automation (sky/ground/twilight)
 * - Shadow follow player
 * - Fog with auto sky-horizon color matching
 * - Day/night cycle with configurable cycle length
 * - Bridge message handling for editor integration
 */

import type { ModuleManifest } from "../module-types";

export const SKY_WEATHER_MANIFEST: ModuleManifest = {
	id: "sky-weather",
	name: "Sky & Weather",
	version: "1.0.0",
	category: "lighting",
	description:
		"Dynamic procedural sky with day/night cycle, atmospheric scattering, weather presets, and automated lighting",
	icon: "CloudSun",
	assets: [],
	runtimeCode: `
// @vibexe/sky-weather v1.0.0
// Dynamic sky, day/night cycle, astronomical sun/moon, atmospheric scattering
var THREE = require('three');

// ============================================================
// Utility functions
// ============================================================

function _lerp(a, b, t) { return a + (b - a) * t; }
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function _smoothstep(e0, e1, x) {
  var t = _clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function _lerpRGB(a, b, t) {
  return [_lerp(a[0], b[0], t), _lerp(a[1], b[1], t), _lerp(a[2], b[2], t)];
}


// ============================================================
// SolarCalculator — Astronomical sun/moon positioning
// ============================================================

function SolarCalculator() {
  this.sunDirection = new THREE.Vector3(0, 1, 0);
  this.moonDirection = new THREE.Vector3(0, -1, 0);
  this.sunAltitude = 0;
  this.sunAzimuth = 0;
  this.moonPhase = 0;
}

SolarCalculator.prototype.update = function(solarTime, latitude) {
  // solarTime 0-1 = 24h (0=midnight, 0.25=6AM, 0.5=noon, 0.75=6PM)
  var latRad = (latitude || 45) * Math.PI / 180;

  // Hour angle: 0.5 (noon) = 0 degrees, wraps -180 to +180
  var hourAngle = (solarTime - 0.5) * 360;
  var haRad = hourAngle * Math.PI / 180;

  // Solar declination: fixed 15 deg for visually pleasant day/night cycle
  var decl = 15.0 * Math.PI / 180;

  // Sun altitude (elevation above horizon)
  var sinAlt = Math.sin(latRad) * Math.sin(decl) +
               Math.cos(latRad) * Math.cos(decl) * Math.cos(haRad);
  this.sunAltitude = Math.asin(_clamp(sinAlt, -1, 1));

  // Sun azimuth
  var cosAlt = Math.cos(this.sunAltitude);
  var cosAz = cosAlt > 0.001
    ? _clamp((Math.sin(decl) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * cosAlt), -1, 1)
    : 0;
  this.sunAzimuth = Math.acos(cosAz);
  if (Math.sin(haRad) > 0) this.sunAzimuth = 2 * Math.PI - this.sunAzimuth;

  // Direction vector (Y-up)
  var alt = this.sunAltitude;
  var az = this.sunAzimuth;
  this.sunDirection.set(
    -Math.sin(az) * Math.cos(alt),
    Math.sin(alt),
    -Math.cos(az) * Math.cos(alt)
  ).normalize();

  // Moon: roughly opposite sun with slight orbital offset
  this.moonDirection.set(
    -this.sunDirection.x + 0.08,
    -this.sunDirection.y + 0.05,
    -this.sunDirection.z - 0.06
  ).normalize();

  // Moon phase (0=new, 0.5=full, 1=new)
  this.moonPhase = (1 - this.sunDirection.dot(this.moonDirection)) * 0.5;
};


// ============================================================
// Sky Color Palette — Time-of-day gradient definitions
// ============================================================
// Each key time has front (toward sun) and back (away) gradient strips.
// Each strip = 4 colors [horizon, low, mid, zenith] in sRGB (0-1).

var SKY_COLORS = {
  night: {
    front: [[0.01,0.01,0.04],[0.01,0.01,0.05],[0.01,0.01,0.04],[0.00,0.00,0.02]],
    back:  [[0.01,0.01,0.03],[0.01,0.01,0.04],[0.01,0.01,0.03],[0.00,0.00,0.02]]
  },
  predawn: {
    front: [[0.18,0.06,0.03],[0.10,0.04,0.08],[0.04,0.03,0.10],[0.02,0.01,0.05]],
    back:  [[0.03,0.02,0.05],[0.02,0.02,0.05],[0.01,0.01,0.04],[0.00,0.00,0.02]]
  },
  dawn: {
    front: [[0.88,0.42,0.10],[0.55,0.22,0.28],[0.20,0.12,0.30],[0.08,0.06,0.18]],
    back:  [[0.15,0.12,0.18],[0.10,0.08,0.15],[0.06,0.05,0.12],[0.03,0.02,0.07]]
  },
  morning: {
    front: [[0.82,0.78,0.62],[0.50,0.65,0.82],[0.32,0.52,0.80],[0.22,0.40,0.72]],
    back:  [[0.60,0.68,0.78],[0.42,0.58,0.78],[0.28,0.48,0.76],[0.20,0.38,0.70]]
  },
  noon: {
    front: [[0.55,0.76,0.92],[0.38,0.62,0.88],[0.25,0.50,0.84],[0.18,0.38,0.78]],
    back:  [[0.55,0.76,0.92],[0.38,0.62,0.88],[0.25,0.50,0.84],[0.18,0.38,0.78]]
  },
  afternoon: {
    front: [[0.78,0.75,0.65],[0.48,0.62,0.80],[0.30,0.50,0.78],[0.20,0.38,0.70]],
    back:  [[0.58,0.66,0.76],[0.40,0.56,0.76],[0.26,0.46,0.74],[0.18,0.36,0.68]]
  },
  dusk: {
    front: [[0.92,0.38,0.08],[0.58,0.18,0.25],[0.22,0.10,0.28],[0.08,0.05,0.16]],
    back:  [[0.12,0.14,0.22],[0.08,0.10,0.18],[0.05,0.05,0.12],[0.02,0.02,0.06]]
  },
  postdusk: {
    front: [[0.22,0.06,0.03],[0.12,0.04,0.08],[0.05,0.03,0.08],[0.02,0.01,0.04]],
    back:  [[0.04,0.03,0.06],[0.03,0.02,0.05],[0.02,0.01,0.04],[0.01,0.01,0.02]]
  }
};

// solarTime stops for interpolation
var SKY_STOPS = [
  { t: 0.00, key: "night" },
  { t: 0.20, key: "predawn" },
  { t: 0.26, key: "dawn" },
  { t: 0.34, key: "morning" },
  { t: 0.50, key: "noon" },
  { t: 0.66, key: "afternoon" },
  { t: 0.74, key: "dusk" },
  { t: 0.80, key: "postdusk" },
  { t: 1.00, key: "night" }
];

function SkyColorPalette() {}

// Returns { front: [r,g,b], back: [r,g,b] } for given height (0-1) and solarTime (0-1)
SkyColorPalette.prototype.getColor = function(height, solarTime) {
  var st = solarTime % 1;
  var stopA = SKY_STOPS[0], stopB = SKY_STOPS[1], blendT = 0;
  for (var i = 0; i < SKY_STOPS.length - 1; i++) {
    if (st >= SKY_STOPS[i].t && st <= SKY_STOPS[i + 1].t) {
      stopA = SKY_STOPS[i];
      stopB = SKY_STOPS[i + 1];
      blendT = (st - stopA.t) / (stopB.t - stopA.t);
      break;
    }
  }
  blendT = _smoothstep(0, 1, blendT);
  var cA = SKY_COLORS[stopA.key], cB = SKY_COLORS[stopB.key];

  var h = _clamp(height, 0, 1);
  return {
    front: _lerpRGB(this._sampleStrip(cA.front, h), this._sampleStrip(cB.front, h), blendT),
    back:  _lerpRGB(this._sampleStrip(cA.back, h),  this._sampleStrip(cB.back, h),  blendT)
  };
};

// Sample 4-stop gradient strip at normalized height
SkyColorPalette.prototype._sampleStrip = function(strip, h) {
  var idx = h * 3;
  var lo = Math.min(Math.floor(idx), 2);
  var frac = idx - lo;
  return _lerpRGB(strip[lo], strip[lo + 1], frac);
};


// ============================================================
// GLSL Shaders — Procedural sky dome
// ============================================================

var SKY_VERTEX = [
  "varying vec3 vDirection;",
  "void main() {",
  "  vDirection = position;",
  "  mat4 rotOnly = mat4(mat3(viewMatrix));",
  "  gl_Position = projectionMatrix * rotOnly * vec4(position, 1.0);",
  "}"
].join("\\n");

var SKY_FRAGMENT = [
  "varying vec3 vDirection;",
  "uniform sampler2D uGrad;",
  "uniform vec3 uSunDir;",
  "uniform vec3 uMoonDir;",
  "uniform float uSunSize;",
  "uniform float uMoonSize;",
  "uniform float uMoonPhase;",
  "uniform float uMieCoeff;",
  "uniform float uMieG;",
  "uniform vec3 uSunColor;",
  "uniform vec3 uMoonColor;",
  "uniform float uStarBright;",
  "uniform float uExposure;",
  "uniform float uTime;",
  "uniform float uCloudCover;",
  "uniform float uCloudDens;",
  "uniform float uCloudScale;",
  "uniform vec2 uCloudOff;",
  "uniform float uCloudBright;",
  "",
  "float miePhase(float c, float g) {",
  "  float g2 = g * g;",
  "  return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * c, 1.5));",
  "}",
  "",
  "float starHash(vec2 p) {",
  "  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);",
  "}",
  "",
  "float cnoise(vec2 p) {",
  "  vec2 i = floor(p); vec2 f = fract(p);",
  "  f = f * f * (3.0 - 2.0 * f);",
  "  float a = fract(sin(dot(i, vec2(127.1,311.7))) * 43758.5453);",
  "  float b = fract(sin(dot(i + vec2(1.0,0.0), vec2(127.1,311.7))) * 43758.5453);",
  "  float c = fract(sin(dot(i + vec2(0.0,1.0), vec2(127.1,311.7))) * 43758.5453);",
  "  float d = fract(sin(dot(i + vec2(1.0,1.0), vec2(127.1,311.7))) * 43758.5453);",
  "  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);",
  "}",
  "",
  "float cfbm(vec2 p) {",
  "  float v = 0.0;",
  "  v += 0.5000 * cnoise(p); p *= 2.02;",
  "  v += 0.2500 * cnoise(p); p *= 2.03;",
  "  v += 0.1250 * cnoise(p); p *= 2.01;",
  "  v += 0.0625 * cnoise(p); p *= 2.04;",
  "  v += 0.0312 * cnoise(p);",
  "  return v;",
  "}",
  "",
  "void main() {",
  "  vec3 dir = normalize(vDirection);",
  "",
  "  // Height: 0 at horizon, 1 at zenith (sqrt for more horizon detail)",
  "  float h = sqrt(max(0.0, dir.y));",
  "",
  "  // Sun-facing factor in horizontal plane",
  "  vec3 sunH = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(0.0001));",
  "  vec3 viewH = normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0001));",
  "  float facing = dot(viewH, sunH) * 0.5 + 0.5;",
  "",
  "  // Sample gradient (row 0 = front, row 1 = back) and decode sRGB to linear",
  "  vec3 fc = pow(texture2D(uGrad, vec2(h, 0.25)).rgb, vec3(2.2));",
  "  vec3 bc = pow(texture2D(uGrad, vec2(h, 0.75)).rgb, vec3(2.2));",
  "  vec3 sky = mix(bc, fc, facing);",
  "",
  "  // Below horizon: darken toward ground",
  "  if (dir.y < 0.0) {",
  "    float below = min(1.0, abs(dir.y) * 4.0);",
  "    vec3 hzF = pow(texture2D(uGrad, vec2(0.0, 0.25)).rgb, vec3(2.2));",
  "    vec3 hzB = pow(texture2D(uGrad, vec2(0.0, 0.75)).rgb, vec3(2.2));",
  "    vec3 hz = mix(hzB, hzF, facing);",
  "    sky = mix(hz, hz * 0.12, below);",
  "  }",
  "",
  "  // Mie scattering (sun glow)",
  "  float cosT = dot(dir, uSunDir);",
  "  float sunVis = smoothstep(-0.08, 0.05, uSunDir.y);",
  "  sky += uSunColor * miePhase(cosT, uMieG) * uMieCoeff * sunVis;",
  "",
  "  // Sun disk + corona",
  "  float sunA = acos(clamp(cosT, -1.0, 1.0));",
  "  float disk = 1.0 - smoothstep(uSunSize * 0.85, uSunSize, sunA);",
  "  float corona = 1.0 - smoothstep(uSunSize, uSunSize * 4.0, sunA);",
  "  sky += uSunColor * (disk * 8.0 + corona * 0.15) * sunVis;",
  "",
  "  // Moon disk with phase shadow",
  "  float moonCos = dot(dir, uMoonDir);",
  "  float moonA = acos(clamp(moonCos, -1.0, 1.0));",
  "  float mDisk = 1.0 - smoothstep(uMoonSize * 0.92, uMoonSize, moonA);",
  "  if (mDisk > 0.001 && uMoonDir.y > -0.05) {",
  "    vec3 mRight = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));",
  "    vec3 toPx = normalize(dir - uMoonDir * moonCos);",
  "    float phX = dot(toPx, mRight);",
  "    float pMask = smoothstep(-0.15, 0.15, phX - (uMoonPhase * 2.0 - 1.0));",
  "    float mVis = smoothstep(-0.05, 0.05, uMoonDir.y);",
  "    sky += uMoonColor * mDisk * pMask * mVis * 0.5;",
  "  }",
  "",
  "  // Procedural stars",
  "  float nightF = 1.0 - smoothstep(-0.12, 0.08, uSunDir.y);",
  "  float starV = uStarBright * nightF;",
  "  if (starV > 0.01 && dir.y > 0.02) {",
  "    vec2 sUV = vec2(atan(dir.z, dir.x), asin(dir.y)) * 180.0;",
  "    vec2 cell = floor(sUV);",
  "    float sh = starHash(cell);",
  "    float bright = step(0.987, sh);",
  "    float twinkle = sin(sh * 6283.0 + uTime * 1.5) * 0.25 + 0.75;",
  "    float fade = smoothstep(0.02, 0.15, dir.y);",
  "    sky += vec3(0.85, 0.9, 1.0) * bright * twinkle * starV * fade * 0.8;",
  "  }",
  "",
  "  // Procedural clouds",
  "  if (uCloudCover > 0.01 && dir.y > 0.01) {",
  "    vec2 cUV = dir.xz / (dir.y + 0.08) * uCloudScale + uCloudOff;",
  "    float cn = cfbm(cUV);",
  "    float thresh = 1.0 - uCloudCover;",
  "    float cMask = smoothstep(thresh, thresh + 0.15, cn) * uCloudDens;",
  "    float cFade = smoothstep(0.01, 0.18, dir.y);",
  "    vec2 dxzSafe = normalize(dir.xz + vec2(0.001));",
  "    vec2 sxzSafe = normalize(uSunDir.xz + vec2(0.001));",
  "    float sunFace = dot(dxzSafe, sxzSafe) * 0.5 + 0.5;",
  "    float daylight = smoothstep(-0.1, 0.2, uSunDir.y);",
  "    float cLight = mix(0.12, 1.0, daylight) * mix(0.7, 1.3, sunFace);",
  "    vec3 cCol = vec3(cLight * uCloudBright);",
  "    float nightTint = 1.0 - daylight;",
  "    cCol = mix(cCol, cCol * vec3(0.4, 0.45, 0.65), nightTint);",
  "    float edgeGlow = smoothstep(thresh + 0.1, thresh + 0.02, cn) * 0.35 * daylight * sunFace;",
  "    cCol += vec3(1.0, 0.92, 0.75) * edgeGlow;",
  "    sky = mix(sky, cCol, cMask * cFade);",
  "  }",
  "",
  "  // Exposure (linear scale — renderer handles sRGB output)",
  "  sky *= uExposure;",
  "",
  "  gl_FragColor = vec4(sky, 1.0);",
  "}"
].join("\\n");


// ============================================================
// ProceduralSkyDome — Three.js mesh with gradient texture
// ============================================================

function ProceduralSkyDome(scene) {
  this.scene = scene;
  this.palette = new SkyColorPalette();
  this._lastST = -1;
  this._horizonColor = [0.5, 0.7, 0.9];

  // Gradient texture: 128 x 2 (front/back), RGBA Uint8
  var texData = new Uint8Array(128 * 2 * 4);
  this._gradTex = new THREE.DataTexture(texData, 128, 2, THREE.RGBAFormat);
  this._gradTex.magFilter = THREE.LinearFilter;
  this._gradTex.minFilter = THREE.LinearFilter;
  this._gradTex.wrapS = THREE.ClampToEdgeWrapping;
  this._gradTex.wrapT = THREE.ClampToEdgeWrapping;

  this._u = {
    uGrad:      { value: this._gradTex },
    uSunDir:    { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir:   { value: new THREE.Vector3(0, -1, 0) },
    uSunSize:   { value: 0.028 },
    uMoonSize:  { value: 0.022 },
    uMoonPhase: { value: 0.5 },
    uMieCoeff:  { value: 0.005 },
    uMieG:      { value: 0.80 },
    uSunColor:  { value: new THREE.Vector3(1.0, 0.95, 0.85) },
    uMoonColor: { value: new THREE.Vector3(0.7, 0.75, 0.85) },
    uStarBright:{ value: 1.0 },
    uExposure:  { value: 2.0 },
    uTime:      { value: 0 },
    uCloudCover: { value: 0 },
    uCloudDens:  { value: 0.85 },
    uCloudScale: { value: 3.0 },
    uCloudOff:   { value: new THREE.Vector2(0, 0) },
    uCloudBright:{ value: 1.0 }
  };

  var geo = new THREE.SphereGeometry(1, 32, 16);
  // Invert winding order so inside faces become FrontSide
  // (BackSide doesn't render in some EffectComposer pipelines)
  var idx = geo.index.array;
  for (var fi = 0; fi < idx.length; fi += 3) {
    var tmp = idx[fi]; idx[fi] = idx[fi + 2]; idx[fi + 2] = tmp;
  }
  geo.index.needsUpdate = true;
  var mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: this._u,
    side: THREE.FrontSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: false
  });

  this.mesh = new THREE.Mesh(geo, mat);
  this.mesh.name = "__skyDome__";
  this.mesh.renderOrder = -1000;
  this.mesh.frustumCulled = false;
  this.scene.add(this.mesh);
}

ProceduralSkyDome.prototype.update = function(st, sunDir, moonDir, moonPhase, cfg) {
  // Rebuild gradient when solarTime changes visibly
  if (Math.abs(st - this._lastST) > 0.0005) {
    this._buildGradient(st);
    this._lastST = st;
  }
  this._u.uSunDir.value.copy(sunDir);
  this._u.uMoonDir.value.copy(moonDir);
  this._u.uMoonPhase.value = moonPhase;
  this._u.uTime.value = performance.now() * 0.001;

  if (cfg) {
    if (cfg.sunDiskSize !== undefined)     this._u.uSunSize.value = cfg.sunDiskSize;
    if (cfg.moonDiskSize !== undefined)    this._u.uMoonSize.value = cfg.moonDiskSize;
    if (cfg.mieCoefficient !== undefined)  this._u.uMieCoeff.value = cfg.mieCoefficient;
    if (cfg.mieDirectionalG !== undefined) this._u.uMieG.value = cfg.mieDirectionalG;
    if (cfg.starIntensity !== undefined)   this._u.uStarBright.value = cfg.starIntensity;
    if (cfg.exposure !== undefined)        this._u.uExposure.value = cfg.exposure;
  }
};

ProceduralSkyDome.prototype._buildGradient = function(solarTime) {
  var data = this._gradTex.image.data;
  var W = 128;
  for (var x = 0; x < W; x++) {
    var h = x / (W - 1);
    var c = this.palette.getColor(h, solarTime);

    // Row 0 = front (store sRGB directly; shader decodes to linear)
    var i0 = x * 4;
    data[i0]     = Math.round(c.front[0] * 255);
    data[i0 + 1] = Math.round(c.front[1] * 255);
    data[i0 + 2] = Math.round(c.front[2] * 255);
    data[i0 + 3] = 255;

    // Row 1 = back
    var i1 = (W + x) * 4;
    data[i1]     = Math.round(c.back[0] * 255);
    data[i1 + 1] = Math.round(c.back[1] * 255);
    data[i1 + 2] = Math.round(c.back[2] * 255);
    data[i1 + 3] = 255;

    // Cache horizon for fog (x=0)
    if (x === 0) {
      this._horizonColor = [
        (c.front[0] + c.back[0]) * 0.5,
        (c.front[1] + c.back[1]) * 0.5,
        (c.front[2] + c.back[2]) * 0.5
      ];
    }
  }
  this._gradTex.needsUpdate = true;
};

ProceduralSkyDome.prototype.getHorizonColor = function() {
  return this._horizonColor;
};

ProceduralSkyDome.prototype.dispose = function() {
  if (this.mesh) {
    this.scene.remove(this.mesh);
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
    this.mesh = null;
  }
  if (this._gradTex) {
    this._gradTex.dispose();
    this._gradTex = null;
  }
};


// ============================================================
// SkyLighting — Automated directional + ambient lights
// ============================================================

function SkyLighting(scene) {
  this.scene = scene;
  this.sunLight = null;
  this.ambientLight = null;
  this._ownSun = false;
  this._ownAmbient = false;
  this._origSunInt = null;
  this._origAmbInt = null;
  this._findLights();
}

SkyLighting.prototype._findLights = function() {
  var self = this;
  this.scene.traverse(function(obj) {
    if (!self.sunLight && obj.isDirectionalLight) {
      self.sunLight = obj;
      self._origSunInt = obj.intensity;
    }
    if (!self.ambientLight && (obj.isAmbientLight || obj.isHemisphereLight)) {
      self.ambientLight = obj;
      self._origAmbInt = obj.intensity;
    }
  });

  if (!this.sunLight) {
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sunLight.name = "__skyWeatherSun__";
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 200;
    var s = 40;
    this.sunLight.shadow.camera.left = -s;
    this.sunLight.shadow.camera.right = s;
    this.sunLight.shadow.camera.top = s;
    this.sunLight.shadow.camera.bottom = -s;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this._ownSun = true;
  }

  if (!this.ambientLight) {
    this.ambientLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.4);
    this.ambientLight.name = "__skyWeatherAmbient__";
    this.scene.add(this.ambientLight);
    this._ownAmbient = true;
  }
};

SkyLighting.prototype.update = function(solarTime, sunDir, cfg) {
  if (!cfg || !cfg.autoSunLight) return;
  var alt = sunDir.y;

  // ---- Sun direction ----
  var sp = sunDir.clone().multiplyScalar(100);
  var player = window.__vibexe_playerMesh__;
  if (player) {
    this.sunLight.position.set(player.position.x + sp.x, sp.y, player.position.z + sp.z);
    this.sunLight.target.position.set(player.position.x, 0, player.position.z);
    this.sunLight.target.updateMatrixWorld();
  } else {
    this.sunLight.position.copy(sp);
    this.sunLight.target.position.set(0, 0, 0);
  }

  // ---- Sun intensity curve ----
  var baseInt = cfg.sunIntensity || 1.5;
  if (alt <= -0.05) {
    this.sunLight.intensity = 0;
  } else if (alt <= 0.12) {
    this.sunLight.intensity = _smoothstep(-0.05, 0.12, alt) * baseInt * 0.8;
  } else {
    this.sunLight.intensity = baseInt;
  }

  // ---- Sun color temperature ----
  var warmth = 1.0 - _clamp(alt * 4, 0, 1);
  warmth *= warmth;
  this.sunLight.color.setRGB(1.0, 1.0 - warmth * 0.35, 1.0 - warmth * 0.65);

  // ---- Shadows ----
  if (cfg.shadowsEnabled !== false) {
    this.sunLight.castShadow = alt > 0;
  }

  // ---- Ambient ----
  if (!cfg.autoAmbient || !this.ambientLight) return;
  var ambBase = cfg.ambientIntensity || 0.4;

  if (alt <= -0.12) {
    // Full night
    this.ambientLight.intensity = ambBase * 0.12;
    if (this.ambientLight.isHemisphereLight) {
      this.ambientLight.color.setRGB(0.04, 0.04, 0.12);
      this.ambientLight.groundColor.setRGB(0.02, 0.02, 0.04);
    } else {
      this.ambientLight.color.setRGB(0.04, 0.04, 0.10);
    }
  } else if (alt <= 0.15) {
    // Twilight
    var tw = _smoothstep(-0.12, 0.15, alt);
    this.ambientLight.intensity = ambBase * (0.12 + tw * 0.88);
    if (this.ambientLight.isHemisphereLight) {
      this.ambientLight.color.setRGB(0.04 + tw * 0.50, 0.04 + tw * 0.55, 0.12 + tw * 0.52);
      this.ambientLight.groundColor.setRGB(0.02 + tw * 0.23, 0.02 + tw * 0.18, 0.04 + tw * 0.11);
    }
  } else {
    // Full daylight
    this.ambientLight.intensity = ambBase;
    if (this.ambientLight.isHemisphereLight) {
      this.ambientLight.color.setRGB(0.54, 0.59, 0.64);
      this.ambientLight.groundColor.setRGB(0.25, 0.20, 0.15);
    } else {
      this.ambientLight.color.setRGB(0.54, 0.59, 0.64);
    }
  }
};

SkyLighting.prototype.dispose = function() {
  if (this._origSunInt !== null && this.sunLight) this.sunLight.intensity = this._origSunInt;
  if (this._origAmbInt !== null && this.ambientLight) this.ambientLight.intensity = this._origAmbInt;
  if (this._ownSun && this.sunLight) { this.scene.remove(this.sunLight); this.scene.remove(this.sunLight.target); }
  if (this._ownAmbient && this.ambientLight) this.scene.remove(this.ambientLight);
};


// ============================================================
// SkyWeatherSystem — Facade combining all subsystems
// ============================================================

function SkyWeatherSystem(scene, config) {
  this.scene = scene;
  this.config = {
    time: { solarTime: 0.45, cycleLengthMinutes: 10, autoAdvance: false, latitude: 45 },
    sky:  { sunDiskSize: 0.028, moonDiskSize: 0.022, mieCoefficient: 0.005, mieDirectionalG: 0.80, starIntensity: 1.0, exposure: 2.0 },
    lighting: { autoSunLight: true, autoAmbient: true, sunIntensity: 1.5, ambientIntensity: 0.4, shadowsEnabled: true },
    fog: { enabled: false, autoColor: true, density: 0.003 },
    clouds: { coverage: 0, density: 0.85, speed: 1.0, scale: 3.0, brightness: 1.0 }
  };
  if (config) this._merge(config);

  this.solarTime = this.config.time.solarTime;
  this._active = false;
  this._rafId = null;
  this._lastTs = 0;
  this._origBg = null;
  this._msgHandler = null;

  // Subsystems
  this.solar = new SolarCalculator();
  this.skyDome = new ProceduralSkyDome(scene);
  this.lighting = new SkyLighting(scene);

  // Initial update
  this.solar.update(this.solarTime, this.config.time.latitude);
  this.skyDome.update(this.solarTime, this.solar.sunDirection, this.solar.moonDirection, this.solar.moonPhase, this.config.sky);
  this.lighting.update(this.solarTime, this.solar.sunDirection, this.config.lighting);

  // Override scene background (sky dome replaces it)
  this._origBg = scene.background;
  scene.background = new THREE.Color(0x000000);

  this._startLoop();
  this._listen();

  console.log("[SkyWeather] Initialized, solarTime:", this.solarTime.toFixed(3));
}

SkyWeatherSystem.prototype._merge = function(src) {
  for (var section in src) {
    if (typeof src[section] === "object" && this.config[section]) {
      for (var key in src[section]) {
        this.config[section][key] = src[section][key];
      }
    }
  }
};

SkyWeatherSystem.prototype._startLoop = function() {
  this._active = true;
  this._lastTs = performance.now();
  var self = this;
  function tick() {
    if (!self._active) return;
    var now = performance.now();
    var dt = (now - self._lastTs) * 0.001;
    self._lastTs = now;
    if (dt > 0 && dt < 1) self._tick(dt);
    self._rafId = requestAnimationFrame(tick);
  }
  self._rafId = requestAnimationFrame(tick);
};

SkyWeatherSystem.prototype._tick = function(dt) {
  // Advance time
  if (this.config.time.autoAdvance) {
    var cycleSec = this.config.time.cycleLengthMinutes * 60;
    this.solarTime += dt / cycleSec;
    if (this.solarTime >= 1.0) this.solarTime -= 1.0;
  }

  this.solar.update(this.solarTime, this.config.time.latitude);
  this.skyDome.update(this.solarTime, this.solar.sunDirection, this.solar.moonDirection, this.solar.moonPhase, this.config.sky);
  this.lighting.update(this.solarTime, this.solar.sunDirection, this.config.lighting);

  // Cloud animation
  var cs = this.config.clouds || {};
  if (this.skyDome && this.skyDome._u) {
    this.skyDome._u.uCloudCover.value = cs.coverage || 0;
    this.skyDome._u.uCloudDens.value = cs.density !== undefined ? cs.density : 0.85;
    this.skyDome._u.uCloudScale.value = cs.scale || 3.0;
    this.skyDome._u.uCloudBright.value = cs.brightness !== undefined ? cs.brightness : 1.0;
    var cSpeed = (cs.speed || 1.0) * 0.008;
    this.skyDome._u.uCloudOff.value.x += dt * cSpeed * 0.7;
    this.skyDome._u.uCloudOff.value.y += dt * cSpeed * 0.3;
  }

  // Fog
  if (this.config.fog.enabled) {
    this._updateFog();
  } else if (this.scene.fog && this.scene.fog.__skyWeather) {
    this.scene.fog = null;
  }

  // Global state
  window.__vibexe_skyState = {
    solarTime: this.solarTime,
    sunDirection: { x: this.solar.sunDirection.x, y: this.solar.sunDirection.y, z: this.solar.sunDirection.z },
    sunAltitude: this.solar.sunAltitude,
    moonPhase: this.solar.moonPhase,
    isDay: this.solar.sunDirection.y > 0
  };
};

SkyWeatherSystem.prototype._updateFog = function() {
  var hz = this.skyDome.getHorizonColor();
  if (!this.scene.fog || !this.scene.fog.__skyWeather) {
    this.scene.fog = new THREE.FogExp2(0xffffff, this.config.fog.density);
    this.scene.fog.__skyWeather = true;
  }
  this.scene.fog.density = this.config.fog.density;
  if (this.config.fog.autoColor) {
    this.scene.fog.color.setRGB(hz[0], hz[1], hz[2]);
  }
};

SkyWeatherSystem.prototype._listen = function() {
  var self = this;
  this._msgHandler = function(event) {
    if (!event.data || !event.data.type) return;
    var d = event.data;

    if (d.type === "sky-weather-set-time") {
      if (d.solarTime !== undefined) self.solarTime = _clamp(d.solarTime, 0, 1);
      if (d.autoAdvance !== undefined) self.config.time.autoAdvance = !!d.autoAdvance;
      if (d.cycleLengthMinutes !== undefined) self.config.time.cycleLengthMinutes = d.cycleLengthMinutes;
    }
    if (d.type === "sky-weather-update-config" && d.config) {
      self._merge(d.config);
    }
    if (d.type === "sky-weather-set-preset") {
      console.log("[SkyWeather] Preset:", d.preset, "(weather presets available in Phase 3)");
    }
  };
  window.addEventListener("message", this._msgHandler);
};

SkyWeatherSystem.prototype.setTime = function(t) { this.solarTime = _clamp(t, 0, 1); };
SkyWeatherSystem.prototype.getTime = function() { return this.solarTime; };
SkyWeatherSystem.prototype.getSunDirection = function() { return this.solar.sunDirection.clone(); };
SkyWeatherSystem.prototype.getMoonPhase = function() { return this.solar.moonPhase; };
SkyWeatherSystem.prototype.isDay = function() { return this.solar.sunDirection.y > 0; };

SkyWeatherSystem.prototype.destroy = function() {
  this._active = false;
  if (this._rafId) cancelAnimationFrame(this._rafId);
  if (this._msgHandler) window.removeEventListener("message", this._msgHandler);

  this.skyDome.dispose();
  this.lighting.dispose();

  if (this._origBg !== null) this.scene.background = this._origBg;
  if (this.scene.fog && this.scene.fog.__skyWeather) this.scene.fog = null;

  window.__vibexe_skyWeather = null;
  window.__vibexe_skyState = null;
  console.log("[SkyWeather] Destroyed");
};


// ============================================================
// Auto-initialization & Module registration
// ============================================================

if (typeof window !== "undefined") {
  window.__vibexe_modules__ = window.__vibexe_modules__ || {};
  window.__vibexe_modules__["sky-weather"] = {
    SkyWeatherSystem: SkyWeatherSystem,
    SolarCalculator: SolarCalculator,
    ProceduralSkyDome: ProceduralSkyDome,
    SkyLighting: SkyLighting,
    SkyColorPalette: SkyColorPalette
  };

  // Auto-init when scene becomes available
  (function() {
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      var scene = window.__vibexe_scene__;
      if (scene && !window.__vibexe_skyWeather) {
        clearInterval(timer);
        var settings = {};
        try {
          var gs = window.__VIBEXE_GAME_SETTINGS__;
          if (gs && gs.modules && gs.modules.installed && gs.modules.installed["sky-weather"]) {
            settings = gs.modules.installed["sky-weather"].config || {};
          }
        } catch(e) {}
        window.__vibexe_skyWeather = new SkyWeatherSystem(scene, settings);
      }
      if (attempts >= 100) {
        clearInterval(timer);
        console.warn("[SkyWeather] Scene not found after 10s");
      }
    }, 100);
  })();
}

module.exports = {
  SkyWeatherSystem: SkyWeatherSystem,
  SolarCalculator: SolarCalculator,
  ProceduralSkyDome: ProceduralSkyDome,
  SkyLighting: SkyLighting,
  SkyColorPalette: SkyColorPalette
};
`,
	bridgeHandlers: {
		"sky-weather-set-time": "handleSetTime",
		"sky-weather-set-preset": "handleSetPreset",
		"sky-weather-update-config": "handleUpdateConfig",
	},
	defaultSettings: {
		time: {
			solarTime: 0.45,
			cycleLengthMinutes: 10,
			autoAdvance: false,
			latitude: 45,
		},
		sky: {
			sunDiskSize: 0.028,
			moonDiskSize: 0.022,
			mieCoefficient: 0.005,
			mieDirectionalG: 0.8,
			starIntensity: 1.0,
			exposure: 2.0,
		},
		lighting: {
			autoSunLight: true,
			autoAmbient: true,
			sunIntensity: 1.5,
			ambientIntensity: 0.4,
			shadowsEnabled: true,
		},
		fog: {
			enabled: false,
			autoColor: true,
			density: 0.003,
		},
		clouds: {
			coverage: 0,
			density: 0.85,
			speed: 1.0,
			scale: 3.0,
			brightness: 1.0,
		},
	},
};
