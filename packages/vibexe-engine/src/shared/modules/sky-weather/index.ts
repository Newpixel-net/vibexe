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
  // S10 fix: handle exact midnight (1.0 → 0.0 wrap) by clamping to just below 1.0
  var st = solarTime % 1;
  if (st <= 0 && solarTime > 0) st = 0.999;
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
  "uniform float uGodRayInt;",
  "uniform float uAuroraInt;",
  "uniform float uRainbowInt;",
  "uniform float uShootStarInt;",
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
  "  sky += uSunColor * (disk * 4.0 + corona * 0.15) * sunVis;",
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
  "  // Shooting stars (meteors)",
  "  if (uShootStarInt > 0.01 && dir.y > 0.05) {",
  "    float ssNight = 1.0 - smoothstep(-0.05, 0.1, uSunDir.y);",
  "    if (ssNight > 0.1) {",
  "      for (int mi = 0; mi < 3; mi++) {",
  "        float rate = 0.18 + float(mi) * 0.11;",
  "        float cyc = floor(uTime * rate);",
  "        float ph = fract(uTime * rate);",
  "        float s1 = fract(sin(cyc * 127.1 + float(mi) * 311.7) * 43758.5);",
  "        float s2 = fract(sin(cyc * 269.5 + float(mi) * 113.3) * 43758.5);",
  "        float s3 = fract(sin(cyc * 419.2 + float(mi) * 227.1) * 43758.5);",
  "        float mShow = step(s3, 0.35);",
  "        float mVis = smoothstep(0.0, 0.04, ph) * smoothstep(0.28, 0.12, ph) * mShow;",
  "        if (mVis > 0.01) {",
  "          float az = s1 * 6.283;",
  "          float el = 0.25 + s2 * 0.45;",
  "          vec3 mStart = normalize(vec3(sin(az), el, cos(az)));",
  "          vec3 mVel = normalize(vec3(s2 - 0.5, -0.45, s1 - 0.3));",
  "          float prog = ph / 0.28;",
  "          vec3 mHead = normalize(mStart + mVel * prog * 0.25);",
  "          float mDist = acos(clamp(dot(dir, mHead), -1.0, 1.0));",
  "          float glow = exp(-mDist * mDist * 40000.0);",
  "          vec3 mTail = normalize(mStart + mVel * max(0.0, prog - 0.35) * 0.25);",
  "          float tDist = acos(clamp(dot(dir, mTail), -1.0, 1.0));",
  "          float tGlow = exp(-tDist * tDist * 60000.0) * 0.4;",
  "          sky += vec3(1.0, 0.95, 0.85) * (glow + tGlow) * mVis * uShootStarInt * ssNight;",
  "        }",
  "      }",
  "    }",
  "  }",
  "",
  "  // Aurora borealis",
  "  if (uAuroraInt > 0.01 && dir.y > 0.08) {",
  "    float aNight = 1.0 - smoothstep(-0.12, 0.08, uSunDir.y);",
  "    if (aNight > 0.1) {",
  "      float aX = dir.x * 3.0 + uTime * 0.03;",
  "      float curtain = cfbm(vec2(aX, dir.y * 2.5)) * 0.6 + cfbm(vec2(aX * 2.0 + 1.7, dir.y * 4.0)) * 0.4;",
  "      float band = smoothstep(0.15, 0.4, dir.y) * smoothstep(0.85, 0.55, dir.y);",
  "      float wave = sin(dir.x * 8.0 + uTime * 0.5) * 0.15 + 0.85;",
  "      float aMask = smoothstep(0.3, 0.5, curtain) * band * wave;",
  "      vec3 aCol = mix(vec3(0.1, 0.9, 0.3), vec3(0.15, 0.3, 0.9), smoothstep(0.3, 0.7, dir.y));",
  "      aCol = mix(aCol, vec3(0.7, 0.1, 0.5), smoothstep(0.6, 0.85, dir.y) * 0.5);",
  "      sky += aCol * aMask * uAuroraInt * aNight * 0.5;",
  "    }",
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
  "  // God rays (crepuscular)",
  "  if (uGodRayInt > 0.01 && uSunDir.y > -0.02) {",
  "    float grDot = max(0.0, dot(dir, uSunDir));",
  "    float grAngle = atan(dir.x - uSunDir.x, dir.z - uSunDir.z);",
  "    float grNoise = cnoise(vec2(grAngle * 6.0, grDot * 3.0)) * 0.5 + 0.5;",
  "    float grRays = pow(grDot, 4.0) * grNoise * pow(grDot, 6.0);",
  "    float grCloud = 1.0 - uCloudCover * 0.6;",
  "    float grSunUp = smoothstep(-0.02, 0.1, uSunDir.y);",
  "    sky += uSunColor * grRays * uGodRayInt * grCloud * grSunUp * 1.5;",
  "  }",
  "",
  "  // Rainbow arc",
  "  if (uRainbowInt > 0.01 && dir.y > 0.0 && uSunDir.y > 0.05) {",
  "    vec3 antiSun = normalize(vec3(-uSunDir.x, abs(uSunDir.y) * 0.3, -uSunDir.z));",
  "    float rbAng = acos(clamp(dot(dir, antiSun), -1.0, 1.0));",
  "    float rbW = 0.025;",
  "    float rbCtr = 0.72;",
  "    float rbMask = smoothstep(rbW, rbW * 0.3, abs(rbAng - rbCtr));",
  "    if (rbMask > 0.01) {",
  "      float t = clamp((rbAng - (rbCtr - rbW)) / (rbW * 2.0), 0.0, 1.0);",
  "      float hue = (1.0 - t) * 0.8;",
  "      vec3 rbCol = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);",
  "      sky += rbCol * rbMask * uRainbowInt * smoothstep(0.0, 0.12, dir.y) * 0.35;",
  "    }",
  "  }",
  "",
  "  // Reinhard tonemap (prevents HDR blow-out from additive effects)",
  "  sky = sky / (1.0 + sky);",
  "  // Exposure (post-tonemap — clean range)",
  "  sky *= uExposure;",
  "  sky = clamp(sky, 0.0, 1.0);",
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
    uExposure:  { value: 1.2 },
    uTime:      { value: 0 },
    uCloudCover: { value: 0 },
    uCloudDens:  { value: 0.85 },
    uCloudScale: { value: 3.0 },
    uCloudOff:   { value: new THREE.Vector2(0, 0) },
    uCloudBright:{ value: 1.0 },
    uGodRayInt:  { value: 0 },
    uAuroraInt:  { value: 0 },
    uRainbowInt: { value: 0 },
    uShootStarInt: { value: 0 }
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
  if (Math.abs(st - this._lastST) > 0.003) {
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
  // S5 fix: guard against texture not properly initialized
  if (!this._gradTex || !this._gradTex.image || !this._gradTex.image.data) return;
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
  // X5 fix: prefer __default_sun__ to avoid creating a second sun that conflicts with shadow-follow
  this.scene.traverse(function(obj) {
    if (obj.isDirectionalLight) {
      if (!self.sunLight || obj.name === "__default_sun__") {
        self.sunLight = obj;
        self._origSunInt = obj.intensity;
      }
    }
    if (!self.ambientLight && (obj.isAmbientLight || obj.isHemisphereLight)) {
      self.ambientLight = obj;
      self._origAmbInt = obj.intensity;
      // S6 fix: store original colors for restore on dispose
      if (obj.color) self._origAmbColor = obj.color.clone();
      if (obj.groundColor) self._origAmbGround = obj.groundColor.clone();
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

  // ---- Sun direction (reuse temp vector to avoid per-frame allocation) ----
  if (!this._tmpSp) this._tmpSp = new THREE.Vector3();
  var sp = this._tmpSp.copy(sunDir).multiplyScalar(100);
  var player = window.__vibexe_playerMesh__;
  if (player) {
    this.sunLight.position.set(player.position.x + sp.x, sp.y, player.position.z + sp.z);
    if (this.sunLight.target) {
      this.sunLight.target.position.set(player.position.x, 0, player.position.z);
      this.sunLight.target.updateMatrixWorld();
    }
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
  if (this._origAmbInt !== null && this.ambientLight) {
    this.ambientLight.intensity = this._origAmbInt;
    // S6 fix: restore original light colors (not just intensity)
    if (this._origAmbColor && this.ambientLight.color) this.ambientLight.color.copy(this._origAmbColor);
    if (this._origAmbGround && this.ambientLight.groundColor) this.ambientLight.groundColor.copy(this._origAmbGround);
  }
  if (this._ownSun && this.sunLight) { this.scene.remove(this.sunLight); this.scene.remove(this.sunLight.target); }
  if (this._ownAmbient && this.ambientLight) this.scene.remove(this.ambientLight);
};


// ============================================================
// WeatherParticles — Rain & Snow GPU particle system
// ============================================================

function WeatherParticles(scene) {
  this.scene = scene;
  this._points = null;
  this._positions = null;
  this._velocities = null;
  this._count = 0;
  this._type = "none";
  this._area = 80;
  this._height = 60;
}

WeatherParticles.prototype.update = function(dt, config) {
  var type = (config && config.type) || "none";
  var intensity = (config && config.intensity) || 0;

  var targetCount = 0;
  if (type === "rain") targetCount = Math.floor(intensity * 8000);
  else if (type === "snow") targetCount = Math.floor(intensity * 3000);

  if (type !== this._type || Math.abs(targetCount - this._count) > 500) {
    this._rebuild(type, targetCount);
  }

  if (!this._points || this._count === 0) return;
  // S2 fix: guard against positions/velocities not initialized (rebuild not called yet)
  if (!this._positions || !this._velocities) return;

  var windDir = (config && config.windDirection !== undefined) ? config.windDirection : 0;
  var windStr = (config && config.windStrength !== undefined) ? config.windStrength : 0.3;
  var windRad = windDir * Math.PI / 180;
  // S8 fix: scale wind by particle type — rain is heavy (less wind effect), snow is light (more)
  var windScale = (this._type === "snow") ? 3 : 8;
  var windX = Math.sin(windRad) * windStr * windScale;
  var windZ = Math.cos(windRad) * windStr * windScale;

  var pos = this._positions;
  var vel = this._velocities;
  var area = this._area;
  var height = this._height;

  var cx = 0, cz = 0;
  var player = window.__vibexe_playerMesh__;
  if (player) { cx = player.position.x; cz = player.position.z; }

  var now = performance.now() * 0.001;

  for (var i = 0; i < this._count; i++) {
    var i3 = i * 3;
    pos[i3]     += (vel[i3] + windX) * dt;
    pos[i3 + 1] += vel[i3 + 1] * dt;
    pos[i3 + 2] += (vel[i3 + 2] + windZ) * dt;

    if (this._type === "snow") {
      pos[i3]     += Math.sin(now * 1.2 + i * 0.37) * 0.6 * dt;
      pos[i3 + 2] += Math.cos(now * 0.9 + i * 0.53) * 0.4 * dt;
    }

    if (pos[i3 + 1] < -2 ||
        Math.abs(pos[i3] - cx) > area ||
        Math.abs(pos[i3 + 2] - cz) > area) {
      pos[i3]     = cx + (Math.random() - 0.5) * area * 2;
      pos[i3 + 1] = height * (0.5 + Math.random() * 0.5);
      pos[i3 + 2] = cz + (Math.random() - 0.5) * area * 2;
    }
  }

  this._points.geometry.attributes.position.needsUpdate = true;
};

WeatherParticles.prototype._rebuild = function(type, count) {
  if (this._points) {
    this.scene.remove(this._points);
    this._points.geometry.dispose();
    this._points.material.dispose();
    this._points = null;
  }

  this._type = type;
  this._count = count;
  if (count === 0 || type === "none") return;

  var geo = new THREE.BufferGeometry();
  this._positions = new Float32Array(count * 3);
  this._velocities = new Float32Array(count * 3);

  var area = this._area;
  var height = this._height;

  for (var i = 0; i < count; i++) {
    var i3 = i * 3;
    this._positions[i3]     = (Math.random() - 0.5) * area * 2;
    this._positions[i3 + 1] = Math.random() * height;
    this._positions[i3 + 2] = (Math.random() - 0.5) * area * 2;

    if (type === "rain") {
      this._velocities[i3]     = 0;
      this._velocities[i3 + 1] = -(15 + Math.random() * 10);
      this._velocities[i3 + 2] = 0;
    } else {
      this._velocities[i3]     = 0;
      this._velocities[i3 + 1] = -(1.5 + Math.random() * 1.5);
      this._velocities[i3 + 2] = 0;
    }
  }

  geo.setAttribute("position", new THREE.BufferAttribute(this._positions, 3));

  var mat;
  if (type === "rain") {
    mat = new THREE.PointsMaterial({
      color: 0xaaccee, size: 0.15, transparent: true,
      opacity: 0.4, sizeAttenuation: true, depthWrite: false
    });
  } else {
    mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.35, transparent: true,
      opacity: 0.7, sizeAttenuation: true, depthWrite: false
    });
  }

  this._points = new THREE.Points(geo, mat);
  this._points.name = "__weatherParticles__";
  this._points.frustumCulled = false;
  this._points.renderOrder = 100;
  this.scene.add(this._points);
};

WeatherParticles.prototype.dispose = function() {
  if (this._points) {
    this.scene.remove(this._points);
    this._points.geometry.dispose();
    this._points.material.dispose();
    this._points = null;
  }
};


// ============================================================
// LightningEffect — Random lightning flashes during storms
// ============================================================

function LightningEffect(scene) {
  this.scene = scene;
  this._flashLight = null;
  this._timer = 0;
  this._nextFlash = 3 + Math.random() * 8;
  this._flashing = false;
  this._flashDur = 0;
}

LightningEffect.prototype.update = function(dt, config) {
  // S4 fix: also treat frequency=0 as disabled, and reset flash state on disable
  if (!config || !config.enabled || config.frequency === 0) {
    if (this._flashLight) {
      this.scene.remove(this._flashLight);
      this._flashLight = null;
    }
    this._flashing = false;
    this._flashDur = 0;
    this._nextFlash = 0;
    this._timer = 0;
    return;
  }

  // S11 fix: clamp dt to prevent rapid-fire flashes during frame drops (large dt jumps)
  var clampedDt = Math.min(dt, 0.1);
  this._timer += clampedDt;
  var freq = config.frequency || 0.1;
  var interval = 1 / Math.max(0.01, freq);

  if (!this._flashing && this._timer >= this._nextFlash) {
    this._flashing = true;
    this._flashDur = 0.08 + Math.random() * 0.12;

    if (!this._flashLight) {
      this._flashLight = new THREE.AmbientLight(0xccddff, 0);
      this._flashLight.name = "__lightningFlash__";
      this.scene.add(this._flashLight);
    }
    this._flashLight.intensity = 2.0 + Math.random() * 3.0;

    try { window.parent.postMessage({ type: "sky-weather-lightning-flash" }, "*"); } catch(e) {}
  }

  if (this._flashing) {
    this._flashDur -= dt;
    if (this._flashDur <= 0) {
      this._flashing = false;
      if (this._flashLight) this._flashLight.intensity = 0;
      this._nextFlash = this._timer + interval * (0.5 + Math.random());
    }
  }
};

LightningEffect.prototype.dispose = function() {
  if (this._flashLight) {
    this.scene.remove(this._flashLight);
    this._flashLight = null;
  }
};


// ============================================================
// WeatherAudio — Procedural ambient weather sounds
// ============================================================

function WeatherAudio() {
  this._ctx = null;
  this._masterGain = null;
  this._rainGain = null;
  this._windGain = null;
  this._rainSource = null;
  this._windSource = null;
  this._thunderOsc = null;
  this._thunderGain = null;
  this._noiseBuf = null;
}

WeatherAudio.prototype._init = function() {
  // S-L1 fix: guard against double-init (prevents creating multiple AudioContexts)
  if (this._ctx) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this._ctx = new AC();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 0.5;
    this._masterGain.connect(this._ctx.destination);

    // Shared noise buffer (2 seconds)
    var sr = this._ctx.sampleRate;
    var bufLen = sr * 2;
    this._noiseBuf = this._ctx.createBuffer(1, bufLen, sr);
    var d = this._noiseBuf.getChannelData(0);
    for (var i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

    // Rain: high-pass filtered noise (patter)
    this._rainGain = this._ctx.createGain();
    this._rainGain.gain.value = 0;
    var rainHP = this._ctx.createBiquadFilter();
    rainHP.type = "highpass";
    rainHP.frequency.value = 3000;
    var rainLP = this._ctx.createBiquadFilter();
    rainLP.type = "lowpass";
    rainLP.frequency.value = 8000;
    this._rainSource = this._ctx.createBufferSource();
    this._rainSource.buffer = this._noiseBuf;
    this._rainSource.loop = true;
    this._rainSource.connect(rainHP);
    rainHP.connect(rainLP);
    rainLP.connect(this._rainGain);
    this._rainGain.connect(this._masterGain);
    this._rainSource.start();

    // Wind: band-pass filtered noise
    this._windGain = this._ctx.createGain();
    this._windGain.gain.value = 0;
    var windBP = this._ctx.createBiquadFilter();
    windBP.type = "bandpass";
    windBP.frequency.value = 250;
    windBP.Q.value = 0.5;
    this._windSource = this._ctx.createBufferSource();
    this._windSource.buffer = this._noiseBuf;
    this._windSource.loop = true;
    this._windSource.connect(windBP);
    windBP.connect(this._windGain);
    this._windGain.connect(this._masterGain);
    this._windSource.start();

    // Thunder: low oscillator for rumble
    this._thunderGain = this._ctx.createGain();
    this._thunderGain.gain.value = 0;
    this._thunderOsc = this._ctx.createOscillator();
    this._thunderOsc.type = "sawtooth";
    this._thunderOsc.frequency.value = 40;
    var tLP = this._ctx.createBiquadFilter();
    tLP.type = "lowpass";
    tLP.frequency.value = 80;
    this._thunderOsc.connect(tLP);
    tLP.connect(this._thunderGain);
    this._thunderGain.connect(this._masterGain);
    this._thunderOsc.start();

    console.log("[SkyWeather] Audio initialized");
  } catch(e) {
    console.warn("[SkyWeather] Audio init failed:", e.message);
  }
};

WeatherAudio.prototype.update = function(config, precipConfig, lightningFlashing) {
  if (!config || !config.enabled) {
    if (this._ctx && this._masterGain) this._masterGain.gain.value = 0;
    return;
  }
  if (!this._ctx) this._init();
  if (!this._ctx) return;

  var vol = config.volume !== undefined ? config.volume : 0.5;
  this._masterGain.gain.value = vol;

  var pType = (precipConfig && precipConfig.type) || "none";
  var pInt = (precipConfig && precipConfig.intensity) || 0;
  var wStr = (precipConfig && precipConfig.windStrength) || 0;

  // Rain
  if (this._rainGain) {
    var rTarget = pType === "rain" ? pInt * 0.35 : (pType === "snow" ? pInt * 0.05 : 0);
    this._rainGain.gain.value += (rTarget - this._rainGain.gain.value) * 0.05;
  }

  // Wind
  if (this._windGain) {
    var wTarget = (pType !== "none" ? wStr * 0.2 : 0) + (pType === "snow" ? 0.05 : 0);
    this._windGain.gain.value += (wTarget - this._windGain.gain.value) * 0.05;
  }

  // Thunder
  // S13 fix: scale thunder by precipitation intensity (louder during heavy storms)
  if (this._thunderGain) {
    var stormScale = pInt > 0 ? (0.5 + pInt * 0.5) : 1.0;
    var tTarget = lightningFlashing ? (0.6 + Math.random() * 0.3) * stormScale : 0;
    this._thunderGain.gain.value += (tTarget - this._thunderGain.gain.value) * 0.15;
  }
};

WeatherAudio.prototype.dispose = function() {
  try {
    if (this._rainSource) this._rainSource.stop();
    if (this._windSource) this._windSource.stop();
    if (this._thunderOsc) this._thunderOsc.stop();
    if (this._ctx) this._ctx.close();
  } catch(e) {}
  this._ctx = null;
};


// ============================================================
// SkyWeatherSystem — Facade combining all subsystems
// ============================================================

function SkyWeatherSystem(scene, config) {
  this.scene = scene;
  this.config = {
    time: { solarTime: 0.45, cycleLengthMinutes: 10, autoAdvance: false, latitude: 45 },
    sky:  { sunDiskSize: 0.028, moonDiskSize: 0.022, mieCoefficient: 0.005, mieDirectionalG: 0.80, starIntensity: 1.0, exposure: 1.2 },
    lighting: { autoSunLight: true, autoAmbient: true, sunIntensity: 1.5, ambientIntensity: 0.4, shadowsEnabled: true },
    fog: { enabled: false, autoColor: true, density: 0.003, heightFalloff: 0 },
    clouds: { coverage: 0, density: 0.85, speed: 1.0, scale: 3.0, brightness: 1.0 },
    precipitation: { type: "none", intensity: 0, windDirection: 0, windStrength: 0.3 },
    lightning: { enabled: false, frequency: 0.1 },
    effects: { godRays: 0, aurora: 0, rainbow: 0, shootingStars: 0, ambientAudio: false, audioVolume: 0.5 }
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
  this.particles = new WeatherParticles(scene);
  this.lightning = new LightningEffect(scene);
  this.audio = new WeatherAudio();

  // Initial update
  this.solar.update(this.solarTime, this.config.time.latitude);
  this.skyDome.update(this.solarTime, this.solar.sunDirection, this.solar.moonDirection, this.solar.moonPhase, this.config.sky);
  this.lighting.update(this.solarTime, this.solar.sunDirection, this.config.lighting);

  // Override scene background (sky dome replaces it)
  this._origBg = scene.background;
  scene.background = new THREE.Color(0x000000);

  // Set global active flag so other systems (bootstrap, updateGameSettings) skip bg/fog/lighting
  window.__skyWeather_active = true;

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
  // Sync the running solarTime if time config was updated
  if (src.time && src.time.solarTime !== undefined) {
    this.solarTime = src.time.solarTime;
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
  // X8 fix: skip heavy updates in editor mode (particles, lightning, audio waste CPU)
  var _inEditor = !!(window.__vibexe_editor_active || (window.__vibexe_editor__ && window.__vibexe_editor__.isEditing));
  // Advance time
  if (this.config.time.autoAdvance && !_inEditor) {
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

  // Effects uniforms (god rays, aurora, rainbow)
  var fx = this.config.effects || {};
  if (this.skyDome && this.skyDome._u) {
    this.skyDome._u.uGodRayInt.value = fx.godRays || 0;
    this.skyDome._u.uAuroraInt.value = fx.aurora || 0;
    this.skyDome._u.uRainbowInt.value = fx.rainbow || 0;
    this.skyDome._u.uShootStarInt.value = fx.shootingStars || 0;
  }

  // X8 fix: skip particles, lightning, and audio in editor mode
  // Precipitation particles
  if (this.particles && !_inEditor) this.particles.update(dt, this.config.precipitation);

  // Lightning
  if (this.lightning && !_inEditor) this.lightning.update(dt, this.config.lightning);

  // Ambient audio
  if (this.audio && !_inEditor) {
    this.audio.update(
      { enabled: fx.ambientAudio, volume: fx.audioVolume },
      this.config.precipitation,
      this.lightning && this.lightning._flashing
    );
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
  // S12 fix: always sample fresh horizon color from palette (skyDome cache may be stale between gradient rebuilds)
  var hz = this.skyDome.palette ? this.skyDome.palette.getColor(0, this.solarTime).front : this.skyDome.getHorizonColor();
  if (!this.scene.fog || !this.scene.fog.__skyWeather) {
    // S3 fix: initialize fog with gamma-corrected horizon color (was 0xffffff causing flicker)
    var initR = Math.pow(hz[0], 2.2), initG = Math.pow(hz[1], 2.2), initB = Math.pow(hz[2], 2.2);
    this.scene.fog = new THREE.FogExp2(0x000000, this.config.fog.density);
    this.scene.fog.color.setRGB(initR, initG, initB);
    this.scene.fog.__skyWeather = true;
  }
  var baseDensity = this.config.fog.density;
  // Height-based fog: thicker at low elevations
  var hFalloff = this.config.fog.heightFalloff || 0;
  if (hFalloff > 0) {
    // S-L2 fix: re-lookup camera every ~120 frames (camera can change on mode switch)
    this._camLookupCount = (this._camLookupCount || 0) + 1;
    if (!this._cachedCam || this._camLookupCount % 120 === 0) {
      this._cachedCam = null;
      var ed = window.__vibexe_editor__; if (ed && ed.camera) { this._cachedCam = ed.camera; }
      if (!this._cachedCam) { var _self = this; this.scene.traverse(function(o) { if (!_self._cachedCam && o.isCamera) _self._cachedCam = o; }); }
    }
    var camY = this._cachedCam ? this._cachedCam.position.y : 5;
    var hFactor = Math.exp(-Math.max(0, camY) * hFalloff * 0.05);
    baseDensity *= (1.0 + hFactor * 2.0);
  }
  // S7 fix: clamp fog density to prevent opaque/invisible extremes
  this.scene.fog.density = _clamp(baseDensity, 0.0001, 0.1);
  if (this.config.fog.autoColor) {
    // Convert sRGB horizon color to linear space for correct fog rendering
    var lr = Math.pow(hz[0], 2.2), lg = Math.pow(hz[1], 2.2), lb = Math.pow(hz[2], 2.2);
    this.scene.fog.color.setRGB(lr, lg, lb);
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
    if (d.type === "sky-weather-set-preset" && d.preset) {
      var _presets = {
        clear:    { clouds: { coverage: 0 }, precipitation: { type: "none", intensity: 0 }, fog: { enabled: false }, lightning: { enabled: false } },
        fair:     { clouds: { coverage: 0.15 }, precipitation: { type: "none", intensity: 0 }, fog: { enabled: false }, lightning: { enabled: false } },
        partlyCloudy: { clouds: { coverage: 0.35 }, precipitation: { type: "none", intensity: 0 }, fog: { enabled: false }, lightning: { enabled: false } },
        cloudy:   { clouds: { coverage: 0.6 }, precipitation: { type: "none", intensity: 0 }, fog: { enabled: false }, lightning: { enabled: false } },
        overcast: { clouds: { coverage: 0.85 }, precipitation: { type: "none", intensity: 0 }, fog: { enabled: true, density: 0.002 }, lightning: { enabled: false } },
        rainy:    { clouds: { coverage: 0.75 }, precipitation: { type: "rain", intensity: 0.5, windStrength: 0.4 }, fog: { enabled: true, density: 0.004 }, lightning: { enabled: false } },
        snowy:    { clouds: { coverage: 0.65 }, precipitation: { type: "snow", intensity: 0.4, windStrength: 0.2 }, fog: { enabled: true, density: 0.003 }, lightning: { enabled: false } },
        foggy:    { clouds: { coverage: 0.3 }, precipitation: { type: "none", intensity: 0 }, fog: { enabled: true, density: 0.012, autoColor: true }, lightning: { enabled: false } },
        stormy:   { clouds: { coverage: 0.9 }, precipitation: { type: "rain", intensity: 0.8, windStrength: 0.7 }, fog: { enabled: true, density: 0.006 }, lightning: { enabled: true, frequency: 0.15 } }
      };
      var _pc = _presets[d.preset];
      if (_pc) {
        self._merge(_pc);
        console.log("[SkyWeather] Applied preset:", d.preset);
      } else {
        console.warn("[SkyWeather] Unknown preset:", d.preset);
      }
    }
    // Debug overlay health query
    if (d.type === "vibexe-debug-query-systems") {
      try {
        window.parent.postMessage({
          type: "vibexe-debug-system-report",
          system: "sky-weather",
          status: self._active ? "ok" : "inactive",
          details: {
            solarTime: self.solarTime ? self.solarTime.toFixed(3) : "N/A",
            isDay: self.solar ? self.solar.sunDirection.y > 0 : false,
            autoAdvance: self.config.time.autoAdvance,
            cycleLenMin: self.config.time.cycleLengthMinutes,
            fog: self.config.fog.enabled ? "on" : "off",
            clouds: (self.config.clouds.coverage || 0) > 0 ? "on" : "off",
            precipitation: self.config.precipitation.type !== "none" ? self.config.precipitation.type : "off",
            lightning: self.config.lightning.enabled ? "on" : "off",
            exposure: self.config.sky.exposure,
            godRays: self.config.effects.godRays > 0 ? "on" : "off",
            aurora: self.config.effects.aurora > 0 ? "on" : "off",
            shootingStars: self.config.effects.shootingStars > 0 ? "on" : "off"
          }
        }, "*");
      } catch(e) {}
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
  if (this.particles) this.particles.dispose();
  if (this.lightning) this.lightning.dispose();
  if (this.audio) this.audio.dispose();

  if (this._origBg !== null) this.scene.background = this._origBg;
  if (this.scene.fog && this.scene.fog.__skyWeather) this.scene.fog = null;

  // S-L3 fix: clear auto-init interval on destroy (prevents re-init after destroy)
  if (window.__skyWeather_autoInitInterval) {
    clearInterval(window.__skyWeather_autoInitInterval);
    window.__skyWeather_autoInitInterval = null;
  }
  // Clear global active flag so bootstrap/updateGameSettings can manage bg/fog/lighting again
  window.__skyWeather_active = false;
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
    SkyColorPalette: SkyColorPalette,
    WeatherParticles: WeatherParticles,
    LightningEffect: LightningEffect,
    WeatherAudio: WeatherAudio
  };

  // Auto-init when scene becomes available
  // X3 fix: Clear any previous auto-init interval from prior bundle loads
  if (window.__skyWeather_autoInitInterval) {
    clearInterval(window.__skyWeather_autoInitInterval);
    window.__skyWeather_autoInitInterval = null;
  }
  (function() {
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      var scene = window.__vibexe_scene__;
      // S9 fix: also check THREE is available before constructing sky dome
      if (scene && typeof THREE !== 'undefined' && !window.__vibexe_skyWeather) {
        clearInterval(timer);
        window.__skyWeather_autoInitInterval = null;
        var settings = {};
        try {
          var gs = window.__VIBEXE_GAME_SETTINGS__;
          if (gs) {
            // Primary: top-level skyWeather config (saved by SkyWeatherPanel)
            if (gs.skyWeather && typeof gs.skyWeather === "object") {
              settings = gs.skyWeather;
            }
            // Fallback: module config (for legacy compatibility)
            else if (gs.modules && gs.modules.installed && gs.modules.installed["sky-weather"]) {
              settings = gs.modules.installed["sky-weather"].config || {};
            }
          }
        } catch(e) {}
        window.__vibexe_skyWeather = new SkyWeatherSystem(scene, settings);
      }
      if (attempts >= 100) {
        clearInterval(timer);
        window.__skyWeather_autoInitInterval = null;
        console.warn("[SkyWeather] Scene not found after 10s");
      }
    }, 100);
    window.__skyWeather_autoInitInterval = timer;
  })();
}

module.exports = {
  SkyWeatherSystem: SkyWeatherSystem,
  SolarCalculator: SolarCalculator,
  ProceduralSkyDome: ProceduralSkyDome,
  SkyLighting: SkyLighting,
  SkyColorPalette: SkyColorPalette,
  WeatherParticles: WeatherParticles,
  LightningEffect: LightningEffect,
  WeatherAudio: WeatherAudio
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
			exposure: 1.2,
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
			heightFalloff: 0,
		},
		clouds: {
			coverage: 0,
			density: 0.85,
			speed: 1.0,
			scale: 3.0,
			brightness: 1.0,
		},
		precipitation: {
			type: "none",
			intensity: 0,
			windDirection: 0,
			windStrength: 0.3,
		},
		lightning: {
			enabled: false,
			frequency: 0.1,
		},
		effects: {
			godRays: 0,
			aurora: 0,
			rainbow: 0,
			shootingStars: 0,
			ambientAudio: false,
			audioVolume: 0.5,
		},
	},
};
