/**
 * Filters GLSL — Converted from Unity Procedural Terrain Painter Filters.hlsl
 *
 * Core filter functions for terrain painting:
 * - heightMask: Min/max height with falloff
 * - slopeMask: Cross-kernel heightmap slope detection
 * - curvatureMask: Normal-based curvature (soft/hard modes)
 * - remapNormals: Unpack normals from 0-1 to -1..1 range
 */
export const FILTERS_GLSL = /* glsl */ `

#define RAD2DEGREE 57.29578

// Height filter
// params: x=minHeight, y=maxHeight, z=minFalloff, w=maxFalloff
float heightMask(float heightmap, vec2 uv, vec4 params) {
  float minHeight = params.x;
  float maxHeight = params.y;
  float minFalloff = params.z;
  float maxFalloff = params.w;

  float minEnd = minHeight - minFalloff;
  float minWeight = clamp((minEnd - (heightmap - minHeight)) / (minEnd - minHeight), 0.0, 1.0);
  float maxEnd = maxHeight + maxFalloff;
  float maxWeight = clamp((maxEnd - (heightmap - maxHeight)) / (maxEnd - maxHeight), 0.0, 1.0);

  return clamp(maxWeight * minWeight, 0.0, 1.0);
}

vec3 remapNormals(vec3 normals) {
  return normals * 2.0 - 1.0;
}

// Generate normals from heightmap using cross-kernel sampling
vec4 normalFromHeight(sampler2D heightmap, vec2 uv, float texelSize, float heightScale) {
  float strength = heightScale;
  float radius = texelSize;

  float xLeft = texture2D(heightmap, uv - vec2(radius, 0.0)).r * strength;
  float xRight = texture2D(heightmap, uv + vec2(radius, 0.0)).r * strength;
  float yUp = texture2D(heightmap, uv - vec2(0.0, radius)).r * strength;
  float yDown = texture2D(heightmap, uv + vec2(0.0, radius)).r * strength;

  float xDelta = ((xLeft - xRight) + 1.0) * 0.5;
  float yDelta = ((yUp - yDown) + 1.0) * 0.5;

  return vec4(xDelta, yDelta, 1.0, yDelta);
}

// Curvature from normal map — two modes: soft (overlay blend) and hard (cross product)
float curvatureFromNormal(sampler2D normals, sampler2D heightmap, vec2 uv, vec2 texelSize, int mode) {
  float curvature = 0.0;

  if (mode == 1) {
    // Hard mode — cross product of normal neighbors
    vec3 normal = texture2D(normals, uv).rgb;
    normal = normalize(normal);

    vec3 right = texture2D(normals, uv + vec2(texelSize.x, 0.0)).xyz;
    vec3 left = texture2D(normals, uv - vec2(texelSize.x, 0.0)).xyz;
    vec3 up = texture2D(normals, uv + vec2(0.0, texelSize.x)).xyz;
    vec3 down = texture2D(normals, uv - vec2(0.0, texelSize.x)).xyz;

    vec3 xpos = normal + right;
    vec3 xneg = normal - left;
    vec3 ypos = normal + up;
    vec3 yneg = normal - down;

    curvature = (cross(xneg, xpos).x - cross(yneg, ypos).y) * 4.0;
    curvature = 1.0 - (curvature * 0.5 + 0.5);
  } else {
    // Soft mode — overlay blend of normal deltas
    float rightX = remapNormals(texture2D(normals, uv + vec2(texelSize.x, 0.0)).rgb).x;
    float leftX = remapNormals(texture2D(normals, uv - vec2(texelSize.x, 0.0)).rgb).x;
    float x = (rightX - leftX) + 0.5;

    float upY = remapNormals(texture2D(normals, uv + vec2(0.0, texelSize.x)).rgb).y;
    float downY = remapNormals(texture2D(normals, uv - vec2(0.0, texelSize.x)).rgb).y;
    float y = (upY - downY) + 0.5;

    // Overlay blending
    curvature = (y < 0.5) ? 2.0 * x * y : 1.0 - 2.0 * (1.0 - x) * (1.0 - y);
  }

  return curvature;
}

// Slope from normal — returns 0-90 degrees
float slopeFromNormal(vec3 normal) {
  return acos(dot(normal, vec3(0.0, 0.0, 1.0))) * RAD2DEGREE;
}

// Slope mask from heightmap — cross-kernel derivative
// params: x=minSlope, y=maxSlope, z=minFalloff, w=maxFalloff (all in degrees)
float slopeMask(sampler2D heightmap, vec2 uv, vec4 params, float texelSize) {
  float width = texelSize;

  float centerHeight = texture2D(heightmap, uv).r * 0.5; // UnpackHeightmap equivalent
  float posX = texture2D(heightmap, uv + vec2(width, 0.0)).r * 0.5 - centerHeight;
  float negX = texture2D(heightmap, uv - vec2(width, 0.0)).r * 0.5 - centerHeight;
  float posY = texture2D(heightmap, uv + vec2(0.0, width)).r * 0.5 - centerHeight;
  float negY = texture2D(heightmap, uv - vec2(0.0, width)).r * 0.5 - centerHeight;

  float slope = sqrt(posX * posX + posY * posY + negX * negX + negY * negY) * 90.0;

  float minSlope = params.x / 90.0;
  float minFalloff = params.z / 90.0;
  float maxSlope = params.y / 90.0;
  float maxFalloff = params.w / 90.0;

  float minEnd = minSlope - minFalloff;
  float minWeight = clamp((minEnd - (slope - minSlope)) / (minEnd - minSlope), 0.0, 1.0);
  float maxEnd = maxSlope + maxFalloff;
  float maxWeight = clamp((maxEnd - (slope - maxSlope)) / (maxEnd - maxSlope), 0.0, 1.0);

  return clamp(maxWeight * minWeight, 0.0, 1.0);
}

// Curvature mask with min/max range
// params: x=minCurv, y=maxCurv, z=minFalloff, w=maxFalloff
float curvatureMask(sampler2D normalMap, sampler2D heightmap, vec2 uv, vec4 params, float texelSize, int mode) {
  float convexity = curvatureFromNormal(normalMap, heightmap, uv, vec2(texelSize), mode);
  float curvature = (convexity - (1.0 - convexity)) * 0.5 + 0.5;

  float minCurv = params.x;
  float minFalloff = params.z;
  float maxCurv = params.y;
  float maxFalloff = params.w;

  float minEnd = minCurv - minFalloff;
  float minWeight = clamp((minEnd - (curvature - minCurv)) / (minEnd - minCurv), 0.0, 1.0);
  float maxEnd = maxCurv + maxFalloff;
  float maxWeight = clamp((maxEnd - (curvature - maxCurv)) / (maxEnd - maxCurv), 0.0, 1.0);

  return clamp(maxWeight * minWeight, 0.0, 1.0);
}
`;
