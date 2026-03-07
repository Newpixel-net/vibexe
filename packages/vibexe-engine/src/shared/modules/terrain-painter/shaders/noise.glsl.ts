/**
 * Noise GLSL — Converted from Unity Procedural Terrain Painter Noise.hlsl
 *
 * Two noise algorithms:
 * - GradientNoise: Grid-based gradient noise with cubic interpolation
 * - SimplexNoise: 3-octave fBm value noise
 */
export const NOISE_GLSL = /* glsl */ `

vec2 gradientNoiseDir(vec2 x) {
  const vec2 k = vec2(0.3183099, 0.3678794);
  x = x * k + k.yx;
  return -1.0 + 2.0 * fract(16.0 * k * fract(x.x * x.y * (x.x + x.y)));
}

float gradientNoise(vec2 uv) {
  vec2 p = uv;
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(gradientNoiseDir(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(gradientNoiseDir(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(gradientNoiseDir(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(gradientNoiseDir(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float simpleNoiseRandom(vec2 uv) {
  return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
}

float simpleNoiseInterpolate(float a, float b, float t) {
  return (1.0 - t) * a + t * b;
}

float simpleNoiseValue(vec2 uv) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  f = f * f * (3.0 - 2.0 * f);

  float r0 = simpleNoiseRandom(i + vec2(0.0, 0.0));
  float r1 = simpleNoiseRandom(i + vec2(1.0, 0.0));
  float r2 = simpleNoiseRandom(i + vec2(0.0, 1.0));
  float r3 = simpleNoiseRandom(i + vec2(1.0, 1.0));

  float bottom = simpleNoiseInterpolate(r0, r1, f.x);
  float top = simpleNoiseInterpolate(r2, r3, f.x);
  return simpleNoiseInterpolate(bottom, top, f.y);
}

float simplexNoise(vec2 uv) {
  float t = 0.0;
  uv *= 2.0;

  // 3 octaves of value noise (fBm)
  float freq = 1.0;
  float amp = 0.125; // pow(0.5, 3)
  t += simpleNoiseValue(uv / freq) * amp;

  freq = 2.0;
  amp = 0.25; // pow(0.5, 2)
  t += simpleNoiseValue(uv / freq) * amp;

  freq = 4.0;
  amp = 0.5; // pow(0.5, 1)
  t += simpleNoiseValue(uv / freq) * amp;

  return t;
}
`;
