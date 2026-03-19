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
	version: "3.0.0",
	category: "level-design",
	description:
		"AAA-quality stylized water with Gerstner waves, foam, caustics, refraction, translucency, and buoyancy",
	icon: "Waves",
	assets: [],
	runtimeCode: `
// @vibexe/stylized-water v3.0.0
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
// Section 2b: GPU TSL Shader — Gerstner Waves + Per-Pixel Coloring
// v3.0.0: Replaces CPU _updateWaves() + _updateColors() with GPU shader
// ============================================================

/** Create a placeholder THREE.Texture with RepeatWrapping (for TSL texture() sampling) */
function _createPlaceholderTex() {
  var canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 4, 4);
  var tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

/** Create TSL uniform nodes for all water shader parameters */
function _createWaterTSLUniforms(s) {
  var sh = s.shallowColor || { r: 0.2, g: 0.6, b: 0.7, a: 0.88 };
  var dp = s.deepColor || { r: 0.03, g: 0.1, b: 0.3, a: 0.96 };
  var hz = s.horizonColor || { r: 0.4, g: 0.65, b: 0.85, a: 0.4 };
  var fc = s.foamColor || { r: 1, g: 1, b: 1, a: 0.8 };
  var ic = s.intersectionColor || { r: 1, g: 1, b: 1, a: 1 };
  return {
    uTime: THREE.uniform(0.0),
    uMeshPosX: THREE.uniform(0.0),
    uMeshPosZ: THREE.uniform(0.0),
    uCamPosX: THREE.uniform(0.0),
    uCamPosZ: THREE.uniform(0.0),
    uIsWebGPU: THREE.uniform(0.0),
    uWaveHeight: THREE.uniform(s.waveHeight || 0.5),
    uWaveSpeed: THREE.uniform(s.waveSpeed || 1.0),
    uWaveSteepness: THREE.uniform(s.waveSteepness || 0.3),
    uWaveCount: THREE.uniform(s.waveCount || 2),
    uWaveDistance: THREE.uniform(s.waveDistance || 0.5),
    uScale: THREE.uniform(s.scale || 200),
    uWaterLevel: THREE.uniform(s.waterLevel || -3),
    uShallowColor: THREE.uniform(new THREE.Color(sh.r, sh.g, sh.b)),
    uDeepColor: THREE.uniform(new THREE.Color(dp.r, dp.g, dp.b)),
    uHorizonColor: THREE.uniform(new THREE.Color(hz.r, hz.g, hz.b)),
    uShallowAlpha: THREE.uniform(sh.a != null ? sh.a : 0.92),
    uDeepAlpha: THREE.uniform(dp.a != null ? dp.a : 0.98),
    uHorizonAlpha: THREE.uniform(hz.a != null ? hz.a : 0.5),
    uDepthVert: THREE.uniform(s.depthVertical || 1.0),
    uColorAbsorption: THREE.uniform(s.colorAbsorption || 0.5),
    uEdgeFade: THREE.uniform(s.edgeFade || 1.0),
    uWaveTint: THREE.uniform(s.waveTint || 0.1),
    uHorizonDist: THREE.uniform(s.horizonDistance || 3.0),
    uSunDir: THREE.uniform(new THREE.Vector3(0, 0.707, 0.707)),
    uSunColor: THREE.uniform(new THREE.Color(1.0, 0.95, 0.9)),
    uSunSpecSize: THREE.uniform(s.sunReflectionSize || 0.5),
    uSunSpecStr: THREE.uniform(s.sunReflectionStrength || 1.0),
    uTranslucencyStr: THREE.uniform(s.translucencyStrength || 0.5),
    uTranslucencyExp: THREE.uniform(s.translucencyExp || 6.0),
    // Phase 3: Normal map uniforms
    uNormalTiling: THREE.uniform((s.normalTilingX || 0.5) * 10),
    uNormalSubTiling: THREE.uniform(s.normalSubTiling || 0.5),
    uNormalSpeed: THREE.uniform(s.normalSpeed || 0.1),
    uNormalSubSpeed: THREE.uniform(s.normalSubSpeed || -0.25),
    uNormalStrength: THREE.uniform(s.normalStrength || 0.5),
    // Phase 3: Foam uniforms
    uFoamEnabled: THREE.uniform(s.foamEnabled !== false ? 1.0 : 0.0),
    uFoamColor: THREE.uniform(new THREE.Color(fc.r, fc.g, fc.b)),
    uFoamAlpha: THREE.uniform(fc.a != null ? fc.a : 0.8),
    uFoamTilingX: THREE.uniform(s.foamTilingX || 0.1),
    uFoamTilingY: THREE.uniform(s.foamTilingY || 0.1),
    uFoamSpeed: THREE.uniform(s.foamSpeed || 0.1),
    uFoamWaveAmount: THREE.uniform(s.foamWaveAmount || 0.3),
    uFoamBaseAmount: THREE.uniform(s.foamBaseAmount || 0),
    uFoamClipping: THREE.uniform(s.foamClipping || 0),
    // Phase 4: Intersection foam uniforms
    uIntEnabled: THREE.uniform(s.intersectionEnabled !== false ? 1.0 : 0.0),
    uIntColor: THREE.uniform(new THREE.Color(ic.r, ic.g, ic.b)),
    uIntLength: THREE.uniform(s.intersectionLength || 2),
    // Phase 4: Caustics uniforms
    uCausticsEnabled: THREE.uniform(s.causticsEnabled !== false ? 1.0 : 0.0),
    uCausticsBrightness: THREE.uniform(s.causticsBrightness || 1.0),
    uCausticsChromance: THREE.uniform(s.causticsChromance || 0.5),
    uCausticsTiling: THREE.uniform(s.causticsTiling || 0.5),
    uCausticsSpeed: THREE.uniform(s.causticsSpeed || 0.5),
    uCausticsDistortion: THREE.uniform(s.causticsDistortion || 0.3),
    // Phase 4: Sparkle uniforms
    uSparkleIntensity: THREE.uniform(s.sparkleIntensity || 0),
    uSparkleSize: THREE.uniform(s.sparkleSize || 0.9),
  };
}

/** Build MeshBasicMaterial with GPU TSL positionNode + colorNode */
function _buildWaterTSLMaterial(u, tex) {
  var _Fn = THREE.Fn || THREE.tslFn;

  var mat = new THREE.MeshBasicMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: true,
  });

  // Shared varyings: vertex shader → fragment shader data transfer
  var _vWN, _vWH;

  // ── positionNode: GPU Gerstner wave vertex displacement ──
  mat.positionNode = _Fn(function() {
    var pos = THREE.positionLocal.toVar();
    var worldX = pos.x.add(u.uMeshPosX);
    var worldZ = pos.z.add(u.uMeshPosZ);

    // Wave distance fade (reduce amplitude far from camera)
    var wdx = worldX.sub(u.uCamPosX);
    var wdz = worldZ.sub(u.uCamPosZ);
    var wDist = THREE.sqrt(wdx.mul(wdx).add(wdz.mul(wdz)));
    var waveFade = THREE.float(1.0).sub(wDist.div(u.uScale.mul(0.45))).clamp(0, 1);

    var ox = THREE.float(0).toVar();
    var oy = THREE.float(0).toVar();
    var oz = THREE.float(0).toVar();
    var wnx = THREE.float(0).toVar();
    var wnz = THREE.float(0).toVar();
    var freqMul = THREE.float(1.0).toVar();
    var ampMul = THREE.float(1.0).toVar();
    var speedMul = THREE.float(1.0).toVar();

    // Wave directions (matches CPU WAVE_DIRS)
    var WDX = [0.866, -0.5, 0.259, -0.707, 0.966];
    var WDY = [0.5, 0.866, -0.966, -0.707, -0.259];

    // Unrolled 5-wave Gerstner sum (inactive waves masked by step function)
    for (var i = 0; i < 5; i++) {
      var wl = THREE.float(10.0).div(freqMul);
      var amp = u.uWaveHeight.mul(ampMul).mul(0.5);
      var sp = u.uWaveSpeed.mul(speedMul);
      var omega = THREE.float(6.283185).div(THREE.max(wl, THREE.float(0.01)));
      var dX = THREE.float(WDX[i]);
      var dY = THREE.float(WDY[i]);
      var dotDP = dX.mul(worldX).add(dY.mul(worldZ));
      var phase = omega.mul(dotDP).add(sp.mul(omega).mul(u.uTime));
      var sinP = THREE.sin(phase);
      var cosP = THREE.cos(phase);
      var Q = u.uWaveSteepness.mul(0.01);
      var active = THREE.step(THREE.float(i + 1), u.uWaveCount);
      // LOD: fade out higher-frequency waves (index 2,3,4) at distance
      if (i >= 2) {
        active = active.mul(waveFade);
      }

      ox.addAssign(Q.mul(amp).mul(dX).mul(cosP).mul(active));
      oy.addAssign(amp.mul(sinP).mul(active));
      oz.addAssign(Q.mul(amp).mul(dY).mul(cosP).mul(active));

      // Analytical wave normal derivative
      wnx.addAssign(dX.mul(omega).mul(amp).mul(cosP).mul(active).negate());
      wnz.addAssign(dY.mul(omega).mul(amp).mul(cosP).mul(active).negate());

      freqMul.assign(freqMul.mul(THREE.float(1.18).add(u.uWaveDistance.mul(0.4))));
      ampMul.assign(ampMul.mul(THREE.float(0.82).sub(u.uWaveDistance.mul(0.15))));
      speedMul.assign(speedMul.mul(1.07));
    }

    // Apply wave offset with fade + clamping
    var maxDisp = u.uWaveHeight.mul(1.5);
    pos.x.addAssign(ox.mul(waveFade).clamp(maxDisp.negate(), maxDisp));
    pos.y.addAssign(oy.mul(waveFade));
    pos.z.addAssign(oz.mul(waveFade).clamp(maxDisp.negate(), maxDisp));

    // Pass wave normal + height to fragment shader via varyings
    _vWN = THREE.varying(THREE.normalize(THREE.vec3(wnx.mul(waveFade), THREE.float(1.0), wnz.mul(waveFade))), 'v_wn');
    _vWH = THREE.varying(oy.mul(waveFade), 'v_wh');

    return pos;
  })();

  // Shared alpha node (set in colorNode, used by opacityNode)
  var _alphaOut;

  // ── colorNode: per-pixel depth, normal maps, foam, caustics, Fresnel, specular, translucency ──
  mat.colorNode = _Fn(function() {
    var worldPos = THREE.positionWorld;
    var viewDir = THREE.normalize(THREE.cameraPosition.sub(worldPos));

    // --- Depth via viewport depth texture ---
    // Three.js viewportDepthTexture returns perspective depth in [0,1] on BOTH
    // WebGL and WebGPU (neither uses reversed depth in Three.js r170+).
    // Standard linearization: viewZ = near*far / (far - depth*(far-near))
    var rawDepth = THREE.viewportDepthTexture(THREE.screenUV);
    var near = THREE.cameraNear;
    var far = THREE.cameraFar;
    var diff = far.sub(near);
    // Prevent division by zero when rawDepth=1.0 (far plane / no geometry behind)
    var denom = THREE.max(far.sub(rawDepth.mul(diff)), THREE.float(0.001));
    var sceneLinZ = near.mul(far).div(denom);
    // Clamp to valid range to handle edge cases (sky, no geometry behind water)
    sceneLinZ = sceneLinZ.clamp(near, far);
    var fragLinZ = THREE.positionView.z.negate();
    var rawWaterDepth = THREE.max(sceneLinZ.sub(fragLinZ), THREE.float(0.0));
    rawWaterDepth = THREE.min(rawWaterDepth, THREE.float(50.0));
    // Small floor prevents depth instability at exact shore edge
    var waterDepth = THREE.max(rawWaterDepth, THREE.float(0.05));

    // --- Depth-based color ---
    var depthAtten = THREE.float(1.0).sub(THREE.exp(waterDepth.negate().mul(u.uDepthVert).mul(0.25)));
    var density = depthAtten.clamp(0, 1).toVar();
    var absorb = THREE.float(1.0).sub(THREE.exp(waterDepth.negate().mul(u.uColorAbsorption).mul(0.2)));
    density.assign(THREE.max(density, absorb).clamp(0, 1));

    // Shallow -> Deep blend
    var cr = THREE.mix(u.uShallowColor.x, u.uDeepColor.x, density).toVar();
    var cg = THREE.mix(u.uShallowColor.y, u.uDeepColor.y, density).toVar();
    var cb = THREE.mix(u.uShallowColor.z, u.uDeepColor.z, density).toVar();
    var ca = THREE.mix(u.uShallowAlpha, u.uDeepAlpha, density).toVar();

    // =================================================================
    // Phase 3: Dual scrolling normal maps with RNM blend
    // =================================================================
    // World-space UV: geometry UV + mesh position offset (tiles continuously)
    var baseUV = THREE.uv();
    var meshOff = THREE.vec2(u.uMeshPosX.div(u.uScale), u.uMeshPosZ.div(u.uScale));
    var worldUV = baseUV.add(meshOff);

    // Primary normal map UV — scroll in one direction
    var nScroll1 = THREE.vec2(u.uTime.mul(u.uNormalSpeed), u.uTime.mul(u.uNormalSpeed).mul(0.7));
    var nUV1 = worldUV.mul(u.uNormalTiling).add(nScroll1);

    // Secondary normal map UV — cross-scroll at different scale
    var nScroll2 = THREE.vec2(
      u.uTime.mul(u.uNormalSpeed).mul(u.uNormalSubSpeed),
      u.uTime.mul(u.uNormalSpeed).mul(u.uNormalSubSpeed).mul(-0.6)
    );
    var nUV2 = worldUV.mul(u.uNormalTiling).mul(u.uNormalSubTiling).add(nScroll2);

    // Sample both normal maps (returns vec4, .xyz is normal in [0,1])
    var nSamp1 = THREE.texture(tex.normal1, nUV1);
    var nSamp2 = THREE.texture(tex.normal2, nUV2);

    // Decode from [0,1] to [-1,1]
    var n1 = THREE.vec3(
      nSamp1.x.mul(2.0).sub(1.0),
      nSamp1.y.mul(2.0).sub(1.0),
      nSamp1.z.mul(2.0).sub(1.0)
    );
    var n2 = THREE.vec3(
      nSamp2.x.mul(2.0).sub(1.0),
      nSamp2.y.mul(2.0).sub(1.0),
      nSamp2.z.mul(2.0).sub(1.0)
    );

    // Reoriented Normal Mapping (RNM) blend
    // t = vec3(n1.x, n1.y, n1.z + 1)
    // r = vec3(-n2.x, -n2.y, n2.z)
    // result = normalize(t * dot(t,r) - r * t.z)
    var rnmT = THREE.vec3(n1.x, n1.y, n1.z.add(1.0));
    var rnmR = THREE.vec3(n2.x.negate(), n2.y.negate(), n2.z);
    var rnmDot = THREE.dot(rnmT, rnmR);
    var rnmResult = THREE.normalize(
      rnmT.mul(rnmDot).sub(rnmR.mul(rnmT.z))
    );

    // Perturb wave normal with blended normal map
    // N = normalize(waveNormal + vec3(rnm.x * strength, 0, rnm.y * strength))
    var waveN = _vWN;
    var N = THREE.normalize(THREE.vec3(
      waveN.x.add(rnmResult.x.mul(u.uNormalStrength)),
      waveN.y,
      waveN.z.add(rnmResult.y.mul(u.uNormalStrength))
    )).toVar();

    // Clamp normal Y to be positive — water surface normal should always point upward
    N.assign(THREE.normalize(THREE.vec3(N.x, THREE.max(N.y, THREE.float(0.1)), N.z)));

    // --- Fresnel (Schlick) using perturbed normal ---
    var NdotV = THREE.dot(N, viewDir).clamp(0, 1);
    var gF = THREE.float(1.0).sub(NdotV);
    var fresnel = THREE.float(0.02).add(THREE.float(0.98).mul(gF.mul(gF).mul(gF).mul(gF).mul(gF))).clamp(0, 1);
    // Cap Fresnel at 35% to keep shallow/deep colors dominant (50% was still too bright)
    var fresnelMix = fresnel.mul(0.35);
    cr.assign(THREE.mix(cr, u.uHorizonColor.x, fresnelMix));
    cg.assign(THREE.mix(cg, u.uHorizonColor.y, fresnelMix));
    cb.assign(THREE.mix(cb, u.uHorizonColor.z, fresnelMix));

    // --- Wave tint (darken troughs, lighten crests) ---
    var wH = _vWH;
    var tint = wH.mul(u.uWaveTint).mul(2.0).clamp(0, 1);
    cr.addAssign(tint.mul(0.08).mul(u.uSunColor.x));
    cg.addAssign(tint.mul(0.12).mul(u.uSunColor.y));
    cb.addAssign(tint.mul(0.08).mul(u.uSunColor.z));

    // =================================================================
    // Phase 3: Wave crest foam with dual-layer texture sampling + dissolve
    // =================================================================
    var foamAmount = THREE.float(0.0).toVar();

    // Only compute foam when enabled (uFoamEnabled > 0.5)
    // Wave crest foam: height-based + base amount
    var crest = wH.mul(2.0).clamp(0, 1).mul(u.uFoamWaveAmount);
    var rawFoam = crest.add(u.uFoamBaseAmount);

    // Dual-layer foam texture sampling
    var fUV1 = THREE.vec2(
      worldUV.x.mul(u.uFoamTilingX.mul(10.0)).add(u.uTime.mul(u.uFoamSpeed)),
      worldUV.y.mul(u.uFoamTilingY.mul(10.0)).add(u.uTime.mul(u.uFoamSpeed).mul(0.7))
    );
    var fUV2 = THREE.vec2(
      worldUV.x.mul(u.uFoamTilingX.mul(14.0)).sub(u.uTime.mul(u.uFoamSpeed).mul(0.3)),
      worldUV.y.mul(u.uFoamTilingY.mul(14.0)).add(u.uTime.mul(u.uFoamSpeed).mul(0.5))
    );
    var fSamp1 = THREE.texture(tex.foam, fUV1);
    var fSamp2 = THREE.texture(tex.foam, fUV2);

    // Combine: saturate(layer1 + layer2) for rich dissolve
    var foamTex = fSamp1.r.add(fSamp2.r).clamp(0, 1).toVar();

    // Dissolve clipping
    var clipStep = THREE.smoothstep(u.uFoamClipping, THREE.float(1.0), foamTex);
    foamTex.assign(clipStep);

    // Smoothstep dissolve edge
    var invertedMask = THREE.float(1.0).sub(rawFoam);
    var dissolvedFoam = THREE.smoothstep(invertedMask, invertedMask.add(0.8), foamTex).mul(u.uFoamAlpha);
    foamAmount.assign(dissolvedFoam.clamp(0, 1).mul(u.uFoamEnabled));

    // Blend foam color into water
    cr.assign(THREE.mix(cr, u.uFoamColor.x, foamAmount));
    cg.assign(THREE.mix(cg, u.uFoamColor.y, foamAmount));
    cb.assign(THREE.mix(cb, u.uFoamColor.z, foamAmount));

    // =================================================================
    // Phase 4: Shore intersection foam using waterDepth + texture
    // =================================================================
    var intAmount = THREE.float(0.0).toVar();

    // Detect real geometry behind water (works with both standard AND reverse depth buffers)
    // rawWaterDepth is linearized: 0 = no depth / sky, 0.01-40 = actual geometry, 50 = capped far
    // hasGeometry = 1 when depth is in valid range (0.02..40), 0 when sky/no geometry
    var geoMin = THREE.step(THREE.float(0.02), rawWaterDepth);
    var geoMax = THREE.float(1.0).sub(THREE.step(THREE.float(40.0), rawWaterDepth));
    var hasGeometry = geoMin.mul(geoMax);
    // Intersection distance: 0 at shore, 1 at intersectionLength
    var intDist = waterDepth.div(THREE.max(u.uIntLength, THREE.float(0.01))).clamp(0, 1);
    var intMask = THREE.float(1.0).sub(intDist).mul(hasGeometry);

    // Sample intersection foam texture
    var ifUV = THREE.vec2(
      worldUV.x.mul(1.5).add(u.uTime.mul(0.02)),
      worldUV.y.mul(1.5).sub(u.uTime.mul(0.015))
    );
    var intFoamSamp = THREE.texture(tex.intFoam, ifUV);

    // Sample noise texture for variation
    var noiseUV = THREE.vec2(
      worldUV.x.mul(3.0).add(u.uTime.mul(0.05)),
      worldUV.y.mul(3.0).add(u.uTime.mul(0.03))
    );
    var noiseSamp = THREE.texture(tex.noise, noiseUV);

    // Smooth intersection: noise * foamTex * (1-dist)^2
    var intVal = noiseSamp.r.mul(intFoamSamp.r).add(intMask).clamp(0, 1).mul(intMask).mul(intMask);
    // Reduce intersection foam dominance (was making shallow areas look beige/tan)
    intAmount.assign(intVal.clamp(0, 1).mul(0.6).mul(u.uIntEnabled));

    // Blend intersection color
    cr.assign(THREE.mix(cr, u.uIntColor.x, intAmount));
    cg.assign(THREE.mix(cg, u.uIntColor.y, intAmount));
    cb.assign(THREE.mix(cb, u.uIntColor.z, intAmount));

    // =================================================================
    // Phase 4: Caustics (dual-layer min blend + chromatic aberration)
    // =================================================================
    // Only where depth > 0.1 and < 20, caustics enabled, and actual geometry behind
    var caustMask = waterDepth.sub(0.1).clamp(0, 1).mul(
      THREE.float(1.0).sub(waterDepth.div(20.0)).clamp(0, 1)
    ).mul(u.uCausticsEnabled).mul(hasGeometry);

    // Reduce caustics under foam/intersection
    caustMask = caustMask.mul(THREE.float(1.0).sub(foamAmount.mul(0.5)).sub(intAmount.mul(0.5)).clamp(0, 1));
    caustMask = caustMask.mul(THREE.float(1.0).sub(density.mul(0.5)));

    var cTime = u.uTime.mul(u.uCausticsSpeed);
    var cTile = u.uCausticsTiling;

    // Layer 1 UVs
    var cUV1 = THREE.vec2(
      worldUV.x.mul(cTile.mul(10.0)).add(cTime),
      worldUV.y.mul(cTile.mul(10.0)).add(cTime.mul(0.5))
    );
    // Layer 2 UVs (different scale + reversed)
    var cUV2 = THREE.vec2(
      worldUV.x.mul(cTile.mul(8.0)).sub(cTime),
      worldUV.y.mul(cTile.mul(8.0)).sub(cTime.mul(0.3))
    );

    // Chromatic aberration offset
    var caOff = u.uCausticsDistortion.mul(0.015);

    // Sample caustics: R channel offset, G center, B offset opposite
    var cSamp1 = THREE.texture(tex.caustics, cUV1);
    var cSamp2 = THREE.texture(tex.caustics, cUV2);
    var cSamp1R = THREE.texture(tex.caustics, cUV1.add(THREE.vec2(caOff, caOff.mul(0.5))));
    var cSamp1B = THREE.texture(tex.caustics, cUV1.sub(THREE.vec2(caOff, caOff.mul(0.5))));

    // Min of two layers = "swimming light network"
    var causticR = THREE.min(cSamp1R.r, cSamp2.r).mul(2.0).toVar();
    var causticG = THREE.min(cSamp1.g, cSamp2.g).mul(2.0).toVar();
    var causticB = THREE.min(cSamp1B.b, cSamp2.b).mul(2.0).toVar();

    // Chromance control: mono vs color
    var causticMono = causticR.add(causticG).add(causticB).div(3.0);
    causticR.assign(THREE.mix(causticMono, causticR, u.uCausticsChromance));
    causticG.assign(THREE.mix(causticMono, causticG, u.uCausticsChromance));
    causticB.assign(THREE.mix(causticMono, causticB, u.uCausticsChromance));

    var cBright = u.uCausticsBrightness.mul(caustMask);
    cr.addAssign(causticR.mul(cBright).mul(0.3));
    cg.addAssign(causticG.mul(cBright).mul(0.3));
    cb.addAssign(causticB.mul(cBright).mul(0.25));

    // =================================================================
    // Phase 4: Sparkle effect (hash-based per-pixel)
    // =================================================================
    // Hash function: fract(sin(dot(pos, constants)) * 43758.5453)
    var sparkInput = worldPos.x.mul(127.1).add(worldPos.z.mul(311.7)).add(u.uTime.mul(5.0));
    var sparkHash = THREE.fract(THREE.sin(sparkInput).mul(43758.5453));

    // sparkle fires when hash > sparkleSize threshold
    var sparkleThresh = THREE.step(u.uSparkleSize, sparkHash);
    var sparkleVal = sparkHash.sub(u.uSparkleSize).div(THREE.float(1.0).sub(u.uSparkleSize).add(0.001)).clamp(0, 1);
    sparkleVal = sparkleVal.mul(sparkleThresh).mul(u.uSparkleIntensity);

    // Only sparkle where lit by sun (NdotL > 0)
    var sparkNdotL = THREE.dot(N, u.uSunDir).clamp(0, 1);
    sparkleVal = sparkleVal.mul(sparkNdotL);

    cr.addAssign(sparkleVal.mul(u.uSunColor.x));
    cg.addAssign(sparkleVal.mul(u.uSunColor.y));
    cb.addAssign(sparkleVal.mul(u.uSunColor.z));

    // --- Horizon distance blend ---
    var dCam = THREE.length(worldPos.sub(THREE.cameraPosition));
    var hT = THREE.smoothstep(THREE.float(0), u.uHorizonDist.mul(100.0), dCam);
    hT = hT.mul(hT);
    cr.assign(THREE.mix(cr, u.uHorizonColor.x, hT.mul(u.uHorizonAlpha)));
    cg.assign(THREE.mix(cg, u.uHorizonColor.y, hT.mul(u.uHorizonAlpha)));
    cb.assign(THREE.mix(cb, u.uHorizonColor.z, hT.mul(u.uHorizonAlpha)));

    // --- Edge fade (alpha near shore via depth buffer) ---
    // Use rawWaterDepth (pre-floor) so edges still fade properly at depth < 0.3
    var edgeA = rawWaterDepth.div(u.uEdgeFade.mul(0.5).add(0.001)).clamp(0, 1);
    ca.mulAssign(edgeA);
    var dABoost = rawWaterDepth.mul(0.3).clamp(0, 1);
    ca.assign(THREE.max(ca, THREE.float(0.15).add(dABoost.mul(0.45))));

    // --- Sky transparency: water with only sky behind it becomes invisible ---
    // Prevents large water planes from acting as dark overlays on the sky dome
    ca.mulAssign(hasGeometry);

    // --- Sun specular (Blinn-Phong) using perturbed normal ---
    var H = THREE.normalize(u.uSunDir.add(viewDir));
    var NdotH = THREE.max(THREE.dot(N, H), THREE.float(0));
    var specPow = THREE.float(128.0).mul(u.uSunSpecSize);
    var spec = THREE.pow(NdotH, specPow).mul(u.uSunSpecStr);
    cr.addAssign(spec.mul(u.uSunColor.x).mul(fresnel));
    cg.addAssign(spec.mul(u.uSunColor.y).mul(fresnel));
    cb.addAssign(spec.mul(u.uSunColor.z).mul(fresnel));

    // --- Translucency / SSS ---
    var tDir = worldPos.sub(THREE.cameraPosition).normalize();
    var tNdotL = THREE.dot(tDir, u.uSunDir).clamp(0, 1);
    var trans = THREE.pow(tNdotL, u.uTranslucencyExp).mul(u.uTranslucencyStr);
    cr.addAssign(trans.mul(0.1).mul(u.uSunColor.x));
    cg.addAssign(trans.mul(0.3).mul(u.uSunColor.y));
    cb.addAssign(trans.mul(0.2).mul(u.uSunColor.z));

    // Clamp final output
    cr.assign(cr.clamp(0, 1));
    cg.assign(cg.clamp(0, 1));
    cb.assign(cb.clamp(0, 1));
    ca.assign(ca.clamp(0, 1));

    _alphaOut = ca;
    return THREE.vec3(cr, cg, cb);
  })();

  mat.opacityNode = _alphaOut;

  return mat;
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
  // Colors — rich teal defaults (closer to Unity Stylized Water 2 reference)
  shallowColor: { r: 0.2, g: 0.6, b: 0.7, a: 0.88 },
  deepColor: { r: 0.03, g: 0.1, b: 0.3, a: 0.96 },
  horizonColor: { r: 0.4, g: 0.65, b: 0.85, a: 0.4 },
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
    translucencyStrength: 0.8,
    normalStrength: 0.7, normalSpeed: 0.08,
    sparkleIntensity: 0.2, intersectionLength: 3.0,
  },
  'clear-pool': {
    shallowColor: { r: 0.5, g: 0.9, b: 0.95, a: 0.6 },
    deepColor: { r: 0.1, g: 0.3, b: 0.5, a: 0.8 },
    horizonColor: { r: 0.7, g: 0.9, b: 1.0, a: 0.3 },
    waveHeight: 0.05, waveSpeed: 0.3, waveSteepness: 0.1, waveCount: 2,
    depthVertical: 0.5, edgeFade: 0.5, horizonDistance: 2.0,
    foamWaveAmount: 0, foamBaseAmount: 0,
    roughness: 0.05, metalness: 0.5,
    causticsEnabled: true, causticsBrightness: 2.5, causticsTiling: 0.8,
    normalStrength: 0.4, normalSpeed: 0.05,
    translucencyStrength: 0.3,
    sparkleIntensity: 0.1, intersectionLength: 1.5,
    refractionEnabled: false, refractionStrength: 0.4, refractionThickness: 3.0,
  },
  river: {
    shallowColor: { r: 0.35, g: 0.7, b: 0.65, a: 0.75 },
    deepColor: { r: 0.05, g: 0.2, b: 0.3, a: 0.9 },
    horizonColor: { r: 0.5, g: 0.7, b: 0.8, a: 0.3 },
    waveHeight: 0.15, waveSpeed: 1.5, waveSteepness: 0.2, waveCount: 3,
    depthVertical: 0.8, foamWaveAmount: 0.2, foamBaseAmount: 0.1,
    intersectionLength: 2.0,
    normalSpeed: 0.15, normalStrength: 0.7, normalMapIndex: 3,
    causticsEnabled: true, causticsBrightness: 1.2,
    riverMode: true, riverDirection: 90, riverSpeed: 1.5,
  },
  cartoon: {
    shallowColor: { r: 0.2, g: 0.7, b: 0.95, a: 0.85 },
    deepColor: { r: 0.05, g: 0.3, b: 0.7, a: 0.95 },
    horizonColor: { r: 0.3, g: 0.6, b: 1.0, a: 0.4 },
    waveHeight: 0.8, waveSpeed: 1.0, waveSteepness: 0.7, waveCount: 2,
    depthVertical: 0.8, foamWaveAmount: 0.4, foamBaseAmount: 0.05,
    intersectionLength: 4.0, intersectionStyle: 0,
    roughness: 0.3, metalness: 0.1,
    causticsEnabled: false,
    normalStrength: 0.5,
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
    causticsEnabled: true, causticsBrightness: 2.0, causticsDistortion: 0.5,
    translucencyStrength: 0.7,
    normalStrength: 0.8, normalSpeed: 0.1,
    sparkleIntensity: 0.4,
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
var FOAM_TEX_NAMES = ['Foam1', 'Foam2', 'FoamSea', 'FoamBubbles', 'FoamFine', 'FoamHeavy', 'FoamRipple'];
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

  // TSL GPU shader state
  this._tslU = null;
  this._tslTex = null;
  this._useTSL = false;
  this._buoyancyCounter = 0;

  // FPS tracking (Phase 7)
  this._fpsFrames = 0;
  this._fpsTime = Date.now();
  this._currentFPS = 0;
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

  var _vertCount = this._geometry ? this._geometry.attributes.position.count : 0;
  console.log('[StylizedWater] v3.0.0 initialized — scale:' + this.settings.scale +
    ' level:' + this.settings.waterLevel + ' verts:' + _vertCount + ' GPU:TSL');
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

  var deep = s.deepColor || DEFAULT_SETTINGS.deepColor;
  var _hasTSL = !!(THREE.Fn || THREE.tslFn);

  if (_hasTSL) {
    // ── v3.0.0 GPU TSL path: positionNode + colorNode ──
    this._tslU = _createWaterTSLUniforms(s);
    this._tslU.uIsWebGPU.value = (window.__vibexe_webgpu__ || window.__vibexe_hasWebGPU__) ? 1.0 : 0.0;
    this._tslTex = {
      normal1: _createPlaceholderTex(),
      normal2: _createPlaceholderTex(),
      foam: _createPlaceholderTex(),
      caustics: _createPlaceholderTex(),
      noise: _createPlaceholderTex(),
      intFoam: _createPlaceholderTex(),
    };
    this._material = _buildWaterTSLMaterial(this._tslU, this._tslTex);
    this._usePBR = false;
    this._usePhysical = false;
    this._useTSL = true;
    console.log('[StylizedWater] GPU TSL material (WebGPU: ' + (this._tslU.uIsWebGPU.value > 0 ? 'YES' : 'WebGL2') + ')');
  } else {
    console.error('[StylizedWater] TSL required but not available');
    return;
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

  // Underwater solid — matches deep water color, blocks view from below/edges
  // Uses deep color directly (not darkened) so it blends seamlessly with GPU water
  var uwGeo = new THREE.PlaneGeometry(s.scale, s.scale);
  uwGeo.rotateX(-Math.PI / 2);
  this._underwaterMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(deep.r * 0.5, deep.g * 0.5, deep.b * 0.6),
    transparent: false,
    side: THREE.BackSide,
    depthWrite: false,
    fog: true,
  });
  this._underwaterMesh = new THREE.Mesh(uwGeo, this._underwaterMat);
  this._underwaterMesh.name = '__water_underside__';
  this._underwaterMesh.position.y = s.waterLevel - 0.5;
  this._underwaterMesh.renderOrder = 98;
  this._underwaterMesh.frustumCulled = false;
  // TSL path: disable depthWrite so viewportDepthTexture sees real scene geometry,
  // not the artificial underwater plane (prevents depth oscillation → color flashing)
  if (this._useTSL) {
    this._underwaterMat.depthWrite = false;
  }
  this.scene.add(this._underwaterMesh);

  // Volume floor removed — opaque underwater solid plane provides sufficient depth
};

// ── Texture Loading ────────────────────────────────────

StylizedWaterSystem.prototype._loadTextures = function() {
  var self = this;
  var s = this.settings;

  // Texture name lookups
  var idx1 = _clamp(s.normalMapIndex || 0, 0, NORMAL_MAP_NAMES.length - 1);
  var idx2 = (idx1 + 1) % NORMAL_MAP_NAMES.length;
  var normalName1 = NORMAL_MAP_NAMES[idx1];
  var normalName2 = NORMAL_MAP_NAMES[idx2];
  var foamName = FOAM_TEX_NAMES[_clamp(s.foamTextureIndex || 0, 0, FOAM_TEX_NAMES.length - 1)];

  // Helper: update a TSL placeholder texture with loaded image data
  function _updatePlaceholder(placeholder, loadedTex) {
    if (!placeholder) return;
    placeholder.image = loadedTex.image;
    placeholder.wrapS = THREE.RepeatWrapping;
    placeholder.wrapT = THREE.RepeatWrapping;
    placeholder.magFilter = THREE.LinearFilter;
    placeholder.minFilter = THREE.LinearMipmapLinearFilter;
    placeholder.generateMipmaps = true;
    placeholder.needsUpdate = true;
  }

  if (!self._tslTex) return;

  // ── GPU TSL path: load textures into placeholder objects for shader sampling ──
  _loadTexture(normalName1, function(tex) {
    _updatePlaceholder(self._tslTex.normal1, tex);
    console.log('[StylizedWater] TSL normal1 loaded: ' + normalName1);
  });
  _loadTexture(normalName2, function(tex) {
    _updatePlaceholder(self._tslTex.normal2, tex);
    console.log('[StylizedWater] TSL normal2 loaded: ' + normalName2);
  });
  _loadTexture(foamName, function(tex) {
    _updatePlaceholder(self._tslTex.foam, tex);
    console.log('[StylizedWater] TSL foam loaded: ' + foamName);
  });
  _loadTexture('Caustics_1', function(tex) {
    _updatePlaceholder(self._tslTex.caustics, tex);
    console.log('[StylizedWater] TSL caustics loaded');
  });
  _loadTexture('IntersectionNoise', function(tex) {
    _updatePlaceholder(self._tslTex.noise, tex);
    console.log('[StylizedWater] TSL intersection noise loaded');
  });
  _loadTexture('Intersection_Foam', function(tex) {
    _updatePlaceholder(self._tslTex.intFoam, tex);
    console.log('[StylizedWater] TSL intersection foam loaded');
  });
};

// ── Animation Loop ─────────────────────────────────────

StylizedWaterSystem.prototype._animLoop = function() {
  if (this._disposed) return;

  var now = Date.now();
  var dt = Math.min((now - this._lastTime) / 1000, 0.1);
  this._lastTime = now;
  this._time += dt;

  // FPS tracking — 120s interval, only log once per threshold crossing
  this._fpsFrames++;
  var fpsElapsed = now - this._fpsTime;
  if (fpsElapsed >= 120000) {
    this._currentFPS = Math.round(this._fpsFrames / (fpsElapsed / 1000));
    this._fpsFrames = 0;
    this._fpsTime = now;
    if (this._currentFPS < 90 && !this._fpsWarnLogged) {
      this._fpsWarnLogged = true;
      console.warn('[StylizedWater] FPS: ' + this._currentFPS + ' (target: 90+)');
    } else if (this._currentFPS >= 90 && !this._fpsOkLogged) {
      this._fpsOkLogged = true;
      console.log('[StylizedWater] FPS: ' + this._currentFPS + ' — target met');
    }
  }

  // Sync waterLevel FROM mesh position (gizmo is the source of truth, not saved settings)
  if (this._mesh && Math.abs(this._mesh.position.y - this.settings.waterLevel) > 0.01) {
    this.settings.waterLevel = this._mesh.position.y;
    window.__vibexe_waterLevel = this._mesh.position.y;
    if (this._tslU) this._tslU.uWaterLevel.value = this._mesh.position.y;
  }

  if (this._tslU) {
    // ── GPU TSL path: update uniforms only (shader does all visual work) ──
    this._tslU.uTime.value = this._time;
    if (this._mesh) {
      this._tslU.uMeshPosX.value = this._mesh.position.x;
      this._tslU.uMeshPosZ.value = this._mesh.position.z;
    }
    if (this.camera) {
      this._tslU.uCamPosX.value = this.camera.position.x;
      this._tslU.uCamPosZ.value = this.camera.position.z;
    }
    // Update sun direction/color from SWA module
    var sun = this._getSunDirection();
    var sunCol = this._getSunColor();
    this._tslU.uSunDir.value.set(sun.x, sun.y, sun.z);
    this._tslU.uSunColor.value.setRGB(sunCol.r, sunCol.g, sunCol.b);
  }

  // Camera follow every frame
  this._updateCameraFollow();

  // Underwater camera fog (check every frame)
  this._updateUnderwaterFog();

  // Physics buoyancy every 3 frames (CPU _sampleWaves for API)
  this._buoyancyCounter = (this._buoyancyCounter || 0) + 1;
  if (this._buoyancyCounter >= 3) {
    this._buoyancyCounter = 0;
    this._updateBuoyancy();
  }

  this._animFrameId = requestAnimationFrame(this._animLoop);
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
    this._underwaterMesh.position.y = this._mesh.position.y - 0.5;
    this._underwaterMesh.position.z = this._mesh.position.z;
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
    vertices: this._geometry ? this._geometry.attributes.position.count : 0,
    material: 'GPU TSL (MeshBasicMaterial + positionNode + colorNode)',
    rendering: 'per-pixel fragment shader',
    webgpu: this._tslU && this._tslU.uIsWebGPU ? (this._tslU.uIsWebGPU.value > 0 ? 'YES' : 'WebGL2 fallback') : 'N/A',
    textures: {
      foam: this._tslTex && this._tslTex.foam ? 'GPU sampled' : 'none',
      caustics: this._tslTex && this._tslTex.caustics ? 'GPU sampled' : 'none',
      noise: this._tslTex && this._tslTex.noise ? 'GPU sampled' : 'none',
      intFoam: this._tslTex && this._tslTex.intFoam ? 'GPU sampled' : 'none',
    },
    waterBodies: (window.__vibexe_waterBodies || []).length,
    riverMode: !!this.settings.riverMode,
  };
};

// ── Vertex Color Painting API (Phase 5) ────────────────
// R = intersection intensity boost
// G = depth mask override (0 = use computed, 1 = force deep)
// B = wave flattening (0 = full waves, 1 = flat)
// A = foam painting (0 = computed, 1 = force foam)

StylizedWaterSystem.prototype.setVertexPaint = function(data) {
  // data: Float32Array with 4 values per vertex (RGBA)
  var vertCount = this._geometry ? this._geometry.attributes.position.count : 0;
  if (data && data.length === vertCount * 4) {
    this._paintData = data;
    console.log('[StylizedWater] Vertex paint data applied: ' + vertCount + ' vertices');
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

  this.settings = _deepMerge(this.settings, patch);

  // Rebuild geometry if scale/resolution changed
  if (this.settings.scale !== oldScale || this.settings.resolution !== oldRes) {
    this._rebuildGeometry();
  }

  // Update water level
  if (this.settings.waterLevel !== oldLevel && this._mesh) {
    this._mesh.position.y = this.settings.waterLevel;
    if (this._underwaterMesh) this._underwaterMesh.position.y = this.settings.waterLevel - 0.5;
    window.__vibexe_waterLevel = this.settings.waterLevel;
  }

  // Update underwater plane color to match current deep color (preset changes)
  if (this._underwaterMat) {
    var uwDp = this.settings.deepColor || { r: 0.05, g: 0.15, b: 0.4 };
    this._underwaterMat.color.setRGB(uwDp.r * 0.5, uwDp.g * 0.5, uwDp.b * 0.6);
  }

  // ── Update TSL uniforms (GPU path) ──
  if (this._useTSL && this._tslU) {
    var s = this.settings;
    var sh = s.shallowColor || DEFAULT_SETTINGS.shallowColor;
    var dp = s.deepColor || DEFAULT_SETTINGS.deepColor;
    var hz = s.horizonColor || DEFAULT_SETTINGS.horizonColor;

    this._tslU.uWaveHeight.value = s.waveHeight || 0.5;
    this._tslU.uWaveSpeed.value = s.waveSpeed || 1.0;
    this._tslU.uWaveSteepness.value = s.waveSteepness || 0.3;
    this._tslU.uWaveCount.value = s.waveCount || 2;
    this._tslU.uWaveDistance.value = s.waveDistance || 0.5;
    this._tslU.uScale.value = s.scale || 200;
    this._tslU.uWaterLevel.value = s.waterLevel || -3;

    this._tslU.uShallowColor.value.setRGB(sh.r, sh.g, sh.b);
    this._tslU.uDeepColor.value.setRGB(dp.r, dp.g, dp.b);
    this._tslU.uHorizonColor.value.setRGB(hz.r, hz.g, hz.b);
    this._tslU.uShallowAlpha.value = sh.a != null ? sh.a : 0.92;
    this._tslU.uDeepAlpha.value = dp.a != null ? dp.a : 0.98;
    this._tslU.uHorizonAlpha.value = hz.a != null ? hz.a : 0.5;

    this._tslU.uDepthVert.value = s.depthVertical || 1.0;
    this._tslU.uColorAbsorption.value = s.colorAbsorption || 0.5;
    this._tslU.uEdgeFade.value = s.edgeFade || 1.0;
    this._tslU.uWaveTint.value = s.waveTint || 0.1;
    this._tslU.uHorizonDist.value = s.horizonDistance || 3.0;

    this._tslU.uSunSpecSize.value = s.sunReflectionSize || 0.5;
    this._tslU.uSunSpecStr.value = s.sunReflectionStrength || 1.0;
    this._tslU.uTranslucencyStr.value = s.translucencyStrength || 0.5;
    this._tslU.uTranslucencyExp.value = s.translucencyExp || 6.0;

    // Phase 3: Normal map uniforms
    this._tslU.uNormalTiling.value = (s.normalTilingX || 0.5) * 10;
    this._tslU.uNormalSubTiling.value = s.normalSubTiling || 0.5;
    this._tslU.uNormalSpeed.value = s.normalSpeed || 0.1;
    this._tslU.uNormalSubSpeed.value = s.normalSubSpeed || -0.25;
    this._tslU.uNormalStrength.value = s.normalStrength || 0.5;

    // Phase 3: Foam uniforms
    var fc = s.foamColor || { r: 1, g: 1, b: 1, a: 0.8 };
    this._tslU.uFoamEnabled.value = s.foamEnabled !== false ? 1.0 : 0.0;
    this._tslU.uFoamColor.value.setRGB(fc.r, fc.g, fc.b);
    this._tslU.uFoamAlpha.value = fc.a != null ? fc.a : 0.8;
    this._tslU.uFoamTilingX.value = s.foamTilingX || 0.1;
    this._tslU.uFoamTilingY.value = s.foamTilingY || 0.1;
    this._tslU.uFoamSpeed.value = s.foamSpeed || 0.1;
    this._tslU.uFoamWaveAmount.value = s.foamWaveAmount || 0.3;
    this._tslU.uFoamBaseAmount.value = s.foamBaseAmount || 0;
    this._tslU.uFoamClipping.value = s.foamClipping || 0;

    // Phase 4: Intersection foam uniforms
    var ic = s.intersectionColor || { r: 1, g: 1, b: 1, a: 1 };
    this._tslU.uIntEnabled.value = s.intersectionEnabled !== false ? 1.0 : 0.0;
    this._tslU.uIntColor.value.setRGB(ic.r, ic.g, ic.b);
    this._tslU.uIntLength.value = s.intersectionLength || 2;

    // Phase 4: Caustics uniforms
    this._tslU.uCausticsEnabled.value = s.causticsEnabled !== false ? 1.0 : 0.0;
    this._tslU.uCausticsBrightness.value = s.causticsBrightness || 1.0;
    this._tslU.uCausticsChromance.value = s.causticsChromance || 0.5;
    this._tslU.uCausticsTiling.value = s.causticsTiling || 0.5;
    this._tslU.uCausticsSpeed.value = s.causticsSpeed || 0.5;
    this._tslU.uCausticsDistortion.value = s.causticsDistortion || 0.3;

    // Phase 4: Sparkle uniforms
    this._tslU.uSparkleIntensity.value = s.sparkleIntensity || 0;
    this._tslU.uSparkleSize.value = s.sparkleSize || 0.9;
  }

  // Visibility
  if (this._mesh) {
    this._mesh.visible = this.settings.visible !== false;
  }
};

StylizedWaterSystem.prototype._rebuildGeometry = function() {
  if (!this._mesh) return;

  var s = this.settings;
  if (this._geometry) this._geometry.dispose();

  var segX = _clamp(Math.round(s.scale * s.resolution), 8, 400);
  var segZ = _clamp(Math.round(s.scale * s.resolution), 8, 400);

  this._geometry = new THREE.PlaneGeometry(s.scale, s.scale, segX, segZ);
  this._geometry.rotateX(-Math.PI / 2);

  var vertCount = this._geometry.attributes.position.count;

  // TSL material: rebuild with new uniforms for updated scale
  if (this._material) this._material.dispose();
  this._tslU = _createWaterTSLUniforms(s);
  this._tslU.uIsWebGPU.value = (window.__vibexe_webgpu__ || window.__vibexe_hasWebGPU__) ? 1.0 : 0.0;
  if (!this._tslTex) {
    this._tslTex = {
      normal1: _createPlaceholderTex(),
      normal2: _createPlaceholderTex(),
      foam: _createPlaceholderTex(),
      caustics: _createPlaceholderTex(),
      noise: _createPlaceholderTex(),
      intFoam: _createPlaceholderTex(),
    };
  }
  this._material = _buildWaterTSLMaterial(this._tslU, this._tslTex);
  this._mesh.material = this._material;

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
  if (this._underwaterMesh && this.scene) {
    this.scene.remove(this._underwaterMesh);
    if (this._underwaterMesh.geometry) this._underwaterMesh.geometry.dispose();
  }
  if (this._geometry) this._geometry.dispose();
  if (this._material) this._material.dispose();
  if (this._underwaterMat) this._underwaterMat.dispose();

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
  this._tslU = null;
  // Dispose TSL placeholder textures
  if (this._tslTex) {
    var texKeys = ['normal1', 'normal2', 'foam', 'caustics', 'noise', 'intFoam'];
    for (var ti = 0; ti < texKeys.length; ti++) {
      if (this._tslTex[texKeys[ti]]) {
        this._tslTex[texKeys[ti]].dispose();
      }
    }
    this._tslTex = null;
  }
  this._useTSL = false;

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

  this._bodies[bodyId] = system;
  this._bodyOrder.push(bodyId);

  if (!this._activeBodyId) this._activeBodyId = bodyId;

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
        // Sync Y: update waterLevel when gizmo moves water vertically
        if (payload.position.y != null) {
          psys.settings.waterLevel = payload.position.y;
          psys.updateSettings({ waterLevel: payload.position.y });
        }
        if (psys._mesh) {
          psys._mesh.position.x = payload.position.x || 0;
          psys._mesh.position.z = payload.position.z || 0;
        }
        if (psys._underwaterMesh) {
          psys._underwaterMesh.position.x = payload.position.x || 0;
          psys._underwaterMesh.position.z = payload.position.z || 0;
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
		shallowColor: { r: 0.2, g: 0.6, b: 0.7, a: 0.88 },
		deepColor: { r: 0.03, g: 0.1, b: 0.3, a: 0.96 },
		horizonColor: { r: 0.4, g: 0.65, b: 0.85, a: 0.4 },
		horizonDistance: 3.0,
		depthVertical: 1.0,
		depthHorizontal: 1.0,
		edgeFade: 1.0,
		waveTint: 0.1,
		waveHeight: 0.5,
		waveSpeed: 1.0,
		waveSteepness: 0.3,
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
