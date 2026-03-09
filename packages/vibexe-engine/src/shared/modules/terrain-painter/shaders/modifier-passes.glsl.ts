/**
 * Modifier Shader Passes — Converted from Unity Modifier.shader
 *
 * 6 GPU passes that generate alpha masks for terrain layer painting:
 * 0: Height — paint based on terrain height
 * 1: Slope — paint based on terrain slope angle
 * 2: Curvature — paint based on surface curvature (concave/convex)
 * 3: TextureMask — paint using an external texture as mask
 * 4: Noise — paint using procedural noise patterns
 * 5: Direction — paint based on surface facing direction
 *
 * Each pass outputs a single-channel mask to a WebGLRenderTarget.
 * The ModifierStack composites these masks using blend modes.
 */

import { FILTERS_GLSL } from "./filters.glsl";
import { NOISE_GLSL } from "./noise.glsl";

/** Common vertex shader — fullscreen quad UV pass-through */
export const COMMON_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Common uniforms shared by all passes */
export const COMMON_UNIFORMS_DECLARATION = /* glsl */ `
uniform sampler2D u_heightmap;
uniform sampler2D u_normalMap;
uniform float u_heightmapScale;
uniform float u_texelSize;
uniform float u_normalTexelSize;
uniform vec4 u_terrainPosScale;
uniform vec4 u_terrainBounds;
uniform float u_opacity;
uniform float u_blendOp;
`;

/** Base value for blend operations (what the mask lerps FROM) */
const BLEND_BASE = /* glsl */ `
// BlendOp: 0=Add, 2=RevSub, 3=Min, 4=Max, 21=Multiply
// For Add/Sub/Max the base is 0; for Min/Mul the base is 1
float getBase() {
  return (u_blendOp == 0.0 || u_blendOp == 2.0 || u_blendOp == 4.0) ? 0.0 : 1.0;
}
`;

/** Pass 0: Height mask */
export const HEIGHT_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
${COMMON_UNIFORMS_DECLARATION}
uniform vec4 u_minMaxHeight;

${FILTERS_GLSL}
${BLEND_BASE}

void main() {
  float heightmap = texture2D(u_heightmap, vUv).r * u_heightmapScale * 4.0;
  float mask = heightMask(heightmap, vUv, u_minMaxHeight);
  float base = getBase();
  gl_FragColor = vec4(vec3(mix(base, mask, u_opacity)), 1.0);
}
`;

/** Pass 1: Slope mask */
export const SLOPE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
${COMMON_UNIFORMS_DECLARATION}
uniform vec4 u_minMaxSlope;

${FILTERS_GLSL}
${BLEND_BASE}

void main() {
  float mask = slopeMask(u_heightmap, vUv, u_minMaxSlope, u_texelSize);
  float base = getBase();
  gl_FragColor = vec4(vec3(mix(base, mask, u_opacity)), 1.0);
}
`;

/** Pass 2: Curvature mask */
export const CURVATURE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
${COMMON_UNIFORMS_DECLARATION}
uniform vec4 u_minMaxCurvature;
uniform float u_curvatureRadius;
uniform int u_curvatureSolver;

${FILTERS_GLSL}
${BLEND_BASE}

void main() {
  float mask = curvatureMask(u_normalMap, u_heightmap, vUv, u_minMaxCurvature, u_normalTexelSize * u_curvatureRadius, u_curvatureSolver);
  float base = getBase();
  gl_FragColor = vec4(vec3(mix(base, mask, u_opacity)), 1.0);
}
`;

/** Pass 3: Texture mask */
export const TEXTURE_MASK_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
${COMMON_UNIFORMS_DECLARATION}
uniform sampler2D u_maskTexture;
uniform int u_channel;
uniform vec2 u_tilingParams; // x=tiling, y=spanTerrains(0/1)

${BLEND_BASE}

void main() {
  vec2 boundsUV = u_terrainPosScale.zw * vUv + u_terrainPosScale.xy;
  vec2 texUV = mix(vUv * u_tilingParams.x, boundsUV, u_tilingParams.y);

  vec4 texSample = texture2D(u_maskTexture, texUV);
  float channelVal = 0.0;
  if (u_channel == 0) channelVal = texSample.r;
  else if (u_channel == 1) channelVal = texSample.g;
  else if (u_channel == 2) channelVal = texSample.b;
  else channelVal = texSample.a;

  float base = getBase();
  gl_FragColor = vec4(vec3(mix(base, channelVal, u_opacity)), 1.0);
}
`;

/** Pass 4: Noise mask */
export const NOISE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
${COMMON_UNIFORMS_DECLARATION}
uniform vec4 u_noiseScaleOffset;
uniform vec4 u_levels;
uniform int u_noiseType;

${NOISE_GLSL}
${BLEND_BASE}

void main() {
  vec2 boundsUV = u_terrainPosScale.zw * vUv + u_terrainPosScale.xy;
  vec2 coords = (boundsUV + u_noiseScaleOffset.zw) * u_noiseScaleOffset.xy * u_terrainBounds.zw;

  float mask = 0.0;
  if (u_noiseType == 1) {
    mask = gradientNoise(coords) * 0.5 + 0.5;
  } else {
    mask = simplexNoise(coords);
  }

  mask = smoothstep(u_levels.x, u_levels.y, mask);
  float base = getBase();
  gl_FragColor = vec4(vec3(mix(base, mask, u_opacity)), 1.0);
}
`;

/** Pass 5: Direction mask */
export const DIRECTION_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
${COMMON_UNIFORMS_DECLARATION}
uniform vec3 u_direction;
uniform vec4 u_directionLevels;

${FILTERS_GLSL}
${BLEND_BASE}

void main() {
  vec3 normal = remapNormals(texture2D(u_normalMap, vUv).xyz);
  float aspect = dot(u_direction, -normal);
  float dirMask = smoothstep(u_directionLevels.x, u_directionLevels.y, aspect);

  float base = getBase();
  gl_FragColor = vec4(vec3(mix(base, dirMask, u_opacity)), 1.0);
}
`;

/** Splatmap compositing shader — blends all layer masks into final RGBA splatmap */
export const SPLATMAP_COMPOSITE_VERTEX = COMMON_VERTEX;

export const SPLATMAP_COMPOSITE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D u_existingSplatmap;
uniform sampler2D u_layerMask;
uniform int u_channelIndex; // 0=R, 1=G, 2=B, 3=A
uniform float u_layerEnabled; // 0.0 or 1.0

void main() {
  vec4 existing = texture2D(u_existingSplatmap, vUv);
  float mask = texture2D(u_layerMask, vUv).r * u_layerEnabled;

  // Write mask to the appropriate channel
  if (u_channelIndex == 0) existing.r = mask;
  else if (u_channelIndex == 1) existing.g = mask;
  else if (u_channelIndex == 2) existing.b = mask;
  else existing.a = mask;

  gl_FragColor = existing;
}
`;

/** Terrain material shader — renders terrain mesh using splatmap-blended PBR textures */
export const TERRAIN_MATERIAL_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

uniform sampler2D u_heightmap;
uniform float u_heightScale;
uniform float u_terrainWidth;
uniform float u_terrainDepth;

void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);

  // Displace vertex by heightmap
  float height = texture2D(u_heightmap, uv).r * u_heightScale;
  vec3 displaced = position + vec3(0.0, height, 0.0);

  vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

export const TERRAIN_MATERIAL_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

// Splatmaps (up to 2 = 8 layers)
uniform sampler2D u_splatmap0;
uniform sampler2D u_splatmap1;

// Layer diffuse textures (up to 8)
uniform sampler2D u_layer0;
uniform sampler2D u_layer1;
uniform sampler2D u_layer2;
uniform sampler2D u_layer3;
uniform sampler2D u_layer4;
uniform sampler2D u_layer5;
uniform sampler2D u_layer6;
uniform sampler2D u_layer7;

// Layer normal maps (layers 0-3, within WebGL texture unit budget)
uniform sampler2D u_normal0;
uniform sampler2D u_normal1;
uniform sampler2D u_normal2;
uniform sampler2D u_normal3;
uniform float u_hasNormal0;
uniform float u_hasNormal1;
uniform float u_hasNormal2;
uniform float u_hasNormal3;

// Roughness maps (layers 0-3)
uniform sampler2D u_roughMap0;
uniform sampler2D u_roughMap1;
uniform sampler2D u_roughMap2;
uniform sampler2D u_roughMap3;
uniform float u_hasRoughMap0;
uniform float u_hasRoughMap1;
uniform float u_hasRoughMap2;
uniform float u_hasRoughMap3;

// AO maps (layers 0-3) — also used for emission textures when uIsEmissive > 0.5
uniform sampler2D u_aoMap0;
uniform sampler2D u_aoMap1;
uniform sampler2D u_aoMap2;
uniform sampler2D u_aoMap3;
uniform float u_hasAOMap0;
uniform float u_hasAOMap1;
uniform float u_hasAOMap2;
uniform float u_hasAOMap3;

// Emission flags — reuse AO slot as emission sampler when > 0.5
uniform float u_isEmissive0;
uniform float u_isEmissive1;
uniform float u_isEmissive2;
uniform float u_isEmissive3;
uniform float u_emissionIntensity0;
uniform float u_emissionIntensity1;
uniform float u_emissionIntensity2;
uniform float u_emissionIntensity3;

// Per-layer texture scale and roughness
uniform float u_texScale0;
uniform float u_texScale1;
uniform float u_texScale2;
uniform float u_texScale3;
uniform float u_texScale4;
uniform float u_texScale5;
uniform float u_texScale6;
uniform float u_texScale7;
uniform float u_roughness0;
uniform float u_roughness1;
uniform float u_roughness2;
uniform float u_roughness3;
uniform float u_roughness4;
uniform float u_roughness5;
uniform float u_roughness6;
uniform float u_roughness7;

uniform int u_layerCount;

// Fog uniforms (configurable from game settings)
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFogEnabled;

// --- Anti-tiling hash (Inigo Quilez) ---
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// --- Procedural detail noise for close-range micro variation ---
float detailNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// --- Triplanar blend weights from world-space normal ---
vec3 triplanarBlend(vec3 n) {
  vec3 b = abs(n);
  b = max(b - 0.2, 0.0);
  b = pow(b, vec3(4.0));
  return b / (b.x + b.y + b.z + 0.001);
}

// --- Sample texture with triplanar + anti-tiling ---
vec3 sampleTerrain(sampler2D tex, vec3 wp, vec2 uv, vec3 N, float scale) {
  float steepness = 1.0 - abs(N.y);
  if (steepness > 0.5) {
    vec3 bl = triplanarBlend(N);
    vec3 xS = texture2D(tex, wp.yz * scale * 0.01).rgb;
    vec3 yS = texture2D(tex, wp.xz * scale * 0.01).rgb;
    vec3 zS = texture2D(tex, wp.xy * scale * 0.01).rgb;
    return xS * bl.x + yS * bl.y + zS * bl.z;
  }
  // Anti-tiling: dual-scale mixing with spatially-varying blend
  vec2 suv = uv * scale;
  vec3 c1 = texture2D(tex, suv).rgb;
  vec3 c2 = texture2D(tex, suv * 0.3713 + vec2(17.3, 13.7)).rgb;
  float nb = smoothstep(0.35, 0.65, fract(sin(dot(floor(suv * 0.5), vec2(127.1, 311.7))) * 43758.5453));
  return mix(c1, c2, nb * 0.3);
}

// --- Sample single-channel map with anti-tiling (roughness/AO) ---
float sampleTerrainR(sampler2D tex, vec3 wp, vec2 uv, vec3 N, float scale, float hasMap, float fallback) {
  if (hasMap < 0.5) return fallback;
  float steepness = 1.0 - abs(N.y);
  if (steepness > 0.5) {
    vec3 bl = triplanarBlend(N);
    float xS = texture2D(tex, wp.yz * scale * 0.01).r;
    float yS = texture2D(tex, wp.xz * scale * 0.01).r;
    float zS = texture2D(tex, wp.xy * scale * 0.01).r;
    return xS * bl.x + yS * bl.y + zS * bl.z;
  }
  vec2 suv = uv * scale;
  float c1 = texture2D(tex, suv).r;
  float c2 = texture2D(tex, suv * 0.3713 + vec2(17.3, 13.7)).r;
  float nb = smoothstep(0.35, 0.65, hash21(floor(suv * 0.5)));
  return mix(c1, c2, nb * 0.3);
}

// --- Sample normal map (returns tangent-space normal) ---
vec3 sampleNormalMap(sampler2D nmap, vec2 uv, float scale, float hasNorm) {
  if (hasNorm < 0.5) return vec3(0.0, 0.0, 1.0);
  vec3 n = texture2D(nmap, uv * scale).rgb * 2.0 - 1.0;
  return normalize(n);
}

// --- Perturb normal using screen-space derivatives (no tangent attribute needed) ---
vec3 perturbNormal(vec3 N, vec3 wp, vec2 uv, vec3 mapN) {
  vec3 q0 = dFdx(wp);
  vec3 q1 = dFdy(wp);
  vec2 st0 = dFdx(uv);
  vec2 st1 = dFdy(uv);
  float det = st0.x * st1.y - st0.y * st1.x;
  if (abs(det) < 0.0001) return N;
  vec3 T = normalize(q0 * st1.y - q1 * st0.y);
  vec3 B = normalize(cross(N, T));
  return normalize(T * mapN.x + B * mapN.y + N * mapN.z);
}

// --- GGX/Trowbridge-Reitz normal distribution ---
float distributionGGX(float NdotH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * d * d + 0.0001);
}

// --- Smith's Schlick-GGX geometry function ---
float geometrySmith(float NdotV, float NdotL, float roughness) {
  float r = roughness + 1.0;
  float k = r * r / 8.0;
  float g1 = NdotV / (NdotV * (1.0 - k) + k);
  float g2 = NdotL / (NdotL * (1.0 - k) + k);
  return g1 * g2;
}

// --- Fresnel-Schlick approximation ---
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec2 baseUv = vUv;

  // Read splatmap weights
  vec4 splat0 = texture2D(u_splatmap0, vUv);
  vec4 splat1 = texture2D(u_splatmap1, vUv);
  float w0 = splat0.r, w1 = splat0.g, w2 = splat0.b, w3 = splat0.a;
  float w4 = splat1.r, w5 = splat1.g, w6 = splat1.b, w7 = splat1.a;

  // --- Sample each layer with triplanar + anti-tiling ---
  vec3 c0 = (u_layerCount > 0) ? sampleTerrain(u_layer0, vWorldPos, baseUv, N, u_texScale0) : vec3(0.5);
  vec3 c1 = (u_layerCount > 1) ? sampleTerrain(u_layer1, vWorldPos, baseUv, N, u_texScale1) : vec3(0.5);
  vec3 c2 = (u_layerCount > 2) ? sampleTerrain(u_layer2, vWorldPos, baseUv, N, u_texScale2) : vec3(0.5);
  vec3 c3 = (u_layerCount > 3) ? sampleTerrain(u_layer3, vWorldPos, baseUv, N, u_texScale3) : vec3(0.5);
  vec3 c4 = (u_layerCount > 4) ? sampleTerrain(u_layer4, vWorldPos, baseUv, N, u_texScale4) : vec3(0.5);
  vec3 c5 = (u_layerCount > 5) ? sampleTerrain(u_layer5, vWorldPos, baseUv, N, u_texScale5) : vec3(0.5);
  vec3 c6 = (u_layerCount > 6) ? sampleTerrain(u_layer6, vWorldPos, baseUv, N, u_texScale6) : vec3(0.5);
  vec3 c7 = (u_layerCount > 7) ? sampleTerrain(u_layer7, vWorldPos, baseUv, N, u_texScale7) : vec3(0.5);

  // --- Sample per-layer roughness from maps (fallback to uniform) ---
  float r0 = sampleTerrainR(u_roughMap0, vWorldPos, baseUv, N, u_texScale0, u_hasRoughMap0, u_roughness0);
  float r1 = sampleTerrainR(u_roughMap1, vWorldPos, baseUv, N, u_texScale1, u_hasRoughMap1, u_roughness1);
  float r2 = sampleTerrainR(u_roughMap2, vWorldPos, baseUv, N, u_texScale2, u_hasRoughMap2, u_roughness2);
  float r3 = sampleTerrainR(u_roughMap3, vWorldPos, baseUv, N, u_texScale3, u_hasRoughMap3, u_roughness3);

  // --- Sample per-layer AO from maps (fallback to 1.0 = no occlusion) ---
  float ao0 = sampleTerrainR(u_aoMap0, vWorldPos, baseUv, N, u_texScale0, u_hasAOMap0, 1.0);
  float ao1 = sampleTerrainR(u_aoMap1, vWorldPos, baseUv, N, u_texScale1, u_hasAOMap1, 1.0);
  float ao2 = sampleTerrainR(u_aoMap2, vWorldPos, baseUv, N, u_texScale2, u_hasAOMap2, 1.0);
  float ao3 = sampleTerrainR(u_aoMap3, vWorldPos, baseUv, N, u_texScale3, u_hasAOMap3, 1.0);

  // --- Height-depth blending with reduced luminance influence ---
  // Luminance scaled to 10% to prevent bright textures overriding splatmap weights
  float depth = 0.15;
  float lumScale = 0.1;
  float lum0 = dot(c0, vec3(0.299, 0.587, 0.114)) * lumScale;
  float lum1 = dot(c1, vec3(0.299, 0.587, 0.114)) * lumScale;
  float lum2 = dot(c2, vec3(0.299, 0.587, 0.114)) * lumScale;
  float lum3 = dot(c3, vec3(0.299, 0.587, 0.114)) * lumScale;
  float hb0 = lum0 + w0; float hb1 = lum1 + w1;
  float hb2 = lum2 + w2; float hb3 = lum3 + w3;

  float lum4 = dot(c4, vec3(0.299, 0.587, 0.114)) * lumScale;
  float lum5 = dot(c5, vec3(0.299, 0.587, 0.114)) * lumScale;
  float lum6 = dot(c6, vec3(0.299, 0.587, 0.114)) * lumScale;
  float lum7 = dot(c7, vec3(0.299, 0.587, 0.114)) * lumScale;
  float hb4 = lum4 + w4; float hb5 = lum5 + w5;
  float hb6 = lum6 + w6; float hb7 = lum7 + w7;

  float maxH = max(max(max(hb0, hb1), max(hb2, hb3)), max(max(hb4, hb5), max(hb6, hb7)));
  float bw0 = max(hb0 - maxH + depth, 0.0);
  float bw1 = max(hb1 - maxH + depth, 0.0);
  float bw2 = max(hb2 - maxH + depth, 0.0);
  float bw3 = max(hb3 - maxH + depth, 0.0);
  float bw4 = max(hb4 - maxH + depth, 0.0);
  float bw5 = max(hb5 - maxH + depth, 0.0);
  float bw6 = max(hb6 - maxH + depth, 0.0);
  float bw7 = max(hb7 - maxH + depth, 0.0);
  float bwSum = bw0 + bw1 + bw2 + bw3 + bw4 + bw5 + bw6 + bw7 + 0.001;

  vec3 albedo = (c0*bw0 + c1*bw1 + c2*bw2 + c3*bw3 + c4*bw4 + c5*bw5 + c6*bw6 + c7*bw7) / bwSum;

  // Detail noise: adds micro variation at close range
  float camDist = length(vWorldPos - cameraPosition);
  float detailFade = 1.0 - smoothstep(5.0, 40.0, camDist);
  if (detailFade > 0.01) {
    float dn = detailNoise(vWorldPos.xz * 2.0) * 2.0 - 1.0;
    albedo += albedo * dn * 0.08 * detailFade;
  }

  // --- Blend normal maps by splatmap weights (layers 0-3) ---
  vec3 blendedNormalTS = vec3(0.0, 0.0, 0.0);
  float normalWeightSum = 0.0;
  if (u_layerCount > 0) { blendedNormalTS += sampleNormalMap(u_normal0, baseUv, u_texScale0, u_hasNormal0) * bw0; normalWeightSum += bw0; }
  if (u_layerCount > 1) { blendedNormalTS += sampleNormalMap(u_normal1, baseUv, u_texScale1, u_hasNormal1) * bw1; normalWeightSum += bw1; }
  if (u_layerCount > 2) { blendedNormalTS += sampleNormalMap(u_normal2, baseUv, u_texScale2, u_hasNormal2) * bw2; normalWeightSum += bw2; }
  if (u_layerCount > 3) { blendedNormalTS += sampleNormalMap(u_normal3, baseUv, u_texScale3, u_hasNormal3) * bw3; normalWeightSum += bw3; }
  // Layers 4-7 contribute flat normal (no normal map samplers to save texture units)
  blendedNormalTS += vec3(0.0, 0.0, 1.0) * (bw4 + bw5 + bw6 + bw7);
  blendedNormalTS = normalize(blendedNormalTS);

  // Perturb surface normal with blended normal map
  vec3 pertN = perturbNormal(N, vWorldPos, baseUv, blendedNormalTS);

  // --- Per-layer roughness blend (from maps or uniform fallback) ---
  float roughness = r0*bw0 + r1*bw1 + r2*bw2 + r3*bw3
                  + u_roughness4*bw4 + u_roughness5*bw5 + u_roughness6*bw6 + u_roughness7*bw7;
  float bwTotalNorm = bw0+bw1+bw2+bw3+bw4+bw5+bw6+bw7;
  if (bwTotalNorm > 0.0) roughness /= bwTotalNorm;
  roughness = clamp(roughness, 0.05, 1.0);

  // Per-layer AO blend
  float ao = (ao0*bw0 + ao1*bw1 + ao2*bw2 + ao3*bw3 + bw4 + bw5 + bw6 + bw7) / bwSum;

  float metallic = 0.0; // terrain is dielectric
  vec3 F0 = vec3(0.04);

  // === PBR Cook-Torrance Lighting ===
  vec3 totalLight = vec3(0.0);

  // Sun light (primary)
  vec3 sunDir = normalize(vec3(0.5, 0.75, 0.35));
  vec3 sunColor = vec3(1.0, 0.95, 0.85) * 3.0;
  vec3 H = normalize(V + sunDir);
  float NdotL = max(dot(pertN, sunDir), 0.0);
  float NdotV = max(dot(pertN, V), 0.001);
  float NdotH = max(dot(pertN, H), 0.0);
  float HdotV = max(dot(H, V), 0.0);
  float D = distributionGGX(NdotH, roughness);
  float G = geometrySmith(NdotV, NdotL, roughness);
  vec3 F = fresnelSchlick(HdotV, F0);
  vec3 kD = (1.0 - F) * (1.0 - metallic);
  vec3 spec = (D * G * F) / (4.0 * NdotV * NdotL + 0.001);
  totalLight += (kD * albedo / 3.14159 + spec) * sunColor * NdotL;

  // Fill light (secondary, cooler) — modulated by AO
  vec3 fillDir = normalize(vec3(-0.4, 0.5, -0.7));
  vec3 fillColor = vec3(0.4, 0.5, 0.7) * 1.2;
  float fillNdotL = max(dot(pertN, fillDir), 0.0);
  totalLight += albedo * fillColor * fillNdotL * ao;

  // Back/rim light
  vec3 backDir = normalize(vec3(-0.2, 0.6, -0.3));
  vec3 backColor = vec3(0.2, 0.22, 0.3) * 0.5;
  float backNdotL = max(dot(pertN, backDir), 0.0);
  totalLight += albedo * backColor * backNdotL;

  // Hemisphere ambient (sky + ground bounce) — modulated by AO
  vec3 skyAmb = vec3(0.55, 0.6, 0.75);
  vec3 gndAmb = vec3(0.25, 0.2, 0.15);
  float upFactor = pertN.y * 0.5 + 0.5;
  vec3 ambient = mix(gndAmb, skyAmb, upFactor) * albedo * 0.6 * ao;
  totalLight += ambient;

  // Minimum brightness floor
  totalLight = max(totalLight, albedo * 0.08);

  // Emission — layers with uIsEmissive > 0.5 sample AO slot as emission texture
  vec3 emission = vec3(0.0);
  if (u_isEmissive0 > 0.5 && u_hasAOMap0 > 0.5) emission += texture2D(u_aoMap0, baseUv * u_texScale0).rgb * u_emissionIntensity0 * bw0 / bwSum;
  if (u_isEmissive1 > 0.5 && u_hasAOMap1 > 0.5) emission += texture2D(u_aoMap1, baseUv * u_texScale1).rgb * u_emissionIntensity1 * bw1 / bwSum;
  if (u_isEmissive2 > 0.5 && u_hasAOMap2 > 0.5) emission += texture2D(u_aoMap2, baseUv * u_texScale2).rgb * u_emissionIntensity2 * bw2 / bwSum;
  if (u_isEmissive3 > 0.5 && u_hasAOMap3 > 0.5) emission += texture2D(u_aoMap3, baseUv * u_texScale3).rgb * u_emissionIntensity3 * bw3 / bwSum;
  totalLight += emission;

  // Atmospheric fog (configurable via uniforms)
  if (uFogEnabled > 0.5) {
    float fogRange = max(uFogFar - uFogNear, 1.0);
    float fogFactor = clamp((camDist - uFogNear) / fogRange, 0.0, 0.6);
    totalLight = mix(totalLight, uFogColor, fogFactor * fogFactor);
  }

  gl_FragColor = vec4(totalLight, 1.0);
}
`;
