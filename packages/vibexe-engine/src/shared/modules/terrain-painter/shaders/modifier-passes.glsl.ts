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

/** Terrain material shader — renders terrain mesh using splatmap-blended textures */
export const TERRAIN_MATERIAL_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

uniform sampler2D u_heightmap;
uniform float u_heightScale;
uniform float u_terrainWidth;
uniform float u_terrainDepth;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  // Displace vertex by heightmap
  float height = texture2D(u_heightmap, uv).r * u_heightScale;
  vec3 displaced = position + vec3(0.0, height, 0.0);

  vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

export const TERRAIN_MATERIAL_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

// Splatmaps (up to 2 = 8 layers)
uniform sampler2D u_splatmap0;
uniform sampler2D u_splatmap1;

// Layer textures (up to 8)
uniform sampler2D u_layer0;
uniform sampler2D u_layer1;
uniform sampler2D u_layer2;
uniform sampler2D u_layer3;
uniform sampler2D u_layer4;
uniform sampler2D u_layer5;
uniform sampler2D u_layer6;
uniform sampler2D u_layer7;

uniform int u_layerCount;
uniform float u_textureTiling;

// Lighting
uniform vec3 u_lightDir;
uniform vec3 u_lightColor;
uniform vec3 u_ambientColor;

void main() {
  vec4 splat0 = texture2D(u_splatmap0, vUv);
  vec4 splat1 = texture2D(u_splatmap1, vUv);

  vec2 tiledUV = vUv * u_textureTiling;

  // Sample all layer textures
  vec3 color = vec3(0.0);
  float totalWeight = 0.0;

  // Layer 0-3 from splatmap0 RGBA
  if (u_layerCount > 0) { color += texture2D(u_layer0, tiledUV).rgb * splat0.r; totalWeight += splat0.r; }
  if (u_layerCount > 1) { color += texture2D(u_layer1, tiledUV).rgb * splat0.g; totalWeight += splat0.g; }
  if (u_layerCount > 2) { color += texture2D(u_layer2, tiledUV).rgb * splat0.b; totalWeight += splat0.b; }
  if (u_layerCount > 3) { color += texture2D(u_layer3, tiledUV).rgb * splat0.a; totalWeight += splat0.a; }

  // Layer 4-7 from splatmap1 RGBA
  if (u_layerCount > 4) { color += texture2D(u_layer4, tiledUV).rgb * splat1.r; totalWeight += splat1.r; }
  if (u_layerCount > 5) { color += texture2D(u_layer5, tiledUV).rgb * splat1.g; totalWeight += splat1.g; }
  if (u_layerCount > 6) { color += texture2D(u_layer6, tiledUV).rgb * splat1.b; totalWeight += splat1.b; }
  if (u_layerCount > 7) { color += texture2D(u_layer7, tiledUV).rgb * splat1.a; totalWeight += splat1.a; }

  // Normalize weights (total should be ~1.0, but clamp for safety)
  if (totalWeight > 0.0) color /= totalWeight;

  // Simple directional lighting
  float ndotl = max(dot(vNormal, normalize(u_lightDir)), 0.0);
  vec3 lit = color * (u_ambientColor + u_lightColor * ndotl);

  gl_FragColor = vec4(lit, 1.0);
}
`;
