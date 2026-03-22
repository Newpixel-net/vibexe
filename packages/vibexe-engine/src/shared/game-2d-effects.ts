/**
 * 2D Effects System — Proton particle presets for Pixi.js games
 *
 * Pre-built effect factory functions returning configured Proton emitters.
 * Each function returns { emitter, start(), stop(), destroy(), moveTo(x,y) }
 *
 * Injected as src/engine/effects.ts template.
 */

export const ENGINE_EFFECTS_CONTENT = `
const Proton = (window as any).Proton;

// ---------------------------------------------------------------------------
// Effect wrapper type
// ---------------------------------------------------------------------------

export interface ParticleEffect {
  emitter: any;
  start(): void;
  stop(): void;
  destroy(): void;
  moveTo(x: number, y: number): void;
}

function wrapEmitter(emitter: any): ParticleEffect {
  return {
    emitter,
    start() { emitter.emit(); },
    stop() { emitter.stop(); },
    destroy() { emitter.stop(); emitter.destroy(); },
    moveTo(x: number, y: number) { emitter.p.x = x; emitter.p.y = y; },
  };
}

// ---------------------------------------------------------------------------
// Weather Effects
// ---------------------------------------------------------------------------

/**
 * Rain — diagonal falling drops across the screen.
 */
export function createRainEffect(width: number, height: number, intensity = 0.6): ParticleEffect {
  const rate = Math.floor(10 + intensity * 40);
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(rate, rate + 10), new Proton.Span(0.01, 0.02));
  emitter.addInitialize(new Proton.Life(0.6, 1.2));
  emitter.addInitialize(new Proton.Radius(1, 2));
  emitter.addInitialize(new Proton.Position(new Proton.LineZone(0, -20, width, -20)));
  emitter.addInitialize(new Proton.Velocity(new Proton.Span(4, 8), new Proton.Span(250, 280), 'polar'));
  emitter.addBehaviour(new Proton.Alpha(0.5, 0.1));
  emitter.addBehaviour(new Proton.Color('#aaccff'));
  emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(-50, -50, width + 100, height + 50), 'dead'));
  emitter.p.x = 0;
  emitter.p.y = 0;
  emitter.emit();
  return wrapEmitter(emitter);
}

/**
 * Snow — soft, fluttering snowflakes.
 */
export function createSnowEffect(width: number, height: number, density = 0.5): ParticleEffect {
  const rate = Math.floor(5 + density * 20);
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(rate, rate + 5), new Proton.Span(0.05, 0.1));
  emitter.addInitialize(new Proton.Life(3, 6));
  emitter.addInitialize(new Proton.Radius(2, 5));
  emitter.addInitialize(new Proton.Position(new Proton.LineZone(0, -20, width, -20)));
  emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(260, 280), 'polar'));
  emitter.addBehaviour(new Proton.Alpha(0.8, 0.2));
  emitter.addBehaviour(new Proton.Color('#ffffff'));
  emitter.addBehaviour(new Proton.RandomDrift(15, 5, 0.1));
  emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(-50, -50, width + 100, height + 50), 'dead'));
  emitter.p.x = 0;
  emitter.p.y = 0;
  emitter.emit();
  return wrapEmitter(emitter);
}

// ---------------------------------------------------------------------------
// Fire & Heat Effects
// ---------------------------------------------------------------------------

/**
 * Fire — flickering flames at a point.
 */
export function createFireEffect(x: number, y: number, scale = 1): ParticleEffect {
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(4, 8), new Proton.Span(0.03, 0.06));
  emitter.addInitialize(new Proton.Life(0.3, 0.8));
  emitter.addInitialize(new Proton.Radius(5 * scale, 15 * scale));
  emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, 10 * scale)));
  emitter.addInitialize(new Proton.Velocity(new Proton.Span(2, 5), new Proton.Span(85, 95), 'polar'));
  emitter.addBehaviour(new Proton.Scale(1, 0.2));
  emitter.addBehaviour(new Proton.Alpha(0.9, 0));
  emitter.addBehaviour(new Proton.Color('#ff6600', '#220000'));
  emitter.addBehaviour(new Proton.RandomDrift(3, 1, 0.05));
  emitter.p.x = x;
  emitter.p.y = y;
  emitter.emit();
  return wrapEmitter(emitter);
}

/**
 * Smoke — rising, expanding puffs.
 */
export function createSmokeEffect(x: number, y: number): ParticleEffect {
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(2, 4), new Proton.Span(0.1, 0.2));
  emitter.addInitialize(new Proton.Life(1.5, 3));
  emitter.addInitialize(new Proton.Radius(8, 20));
  emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(80, 100), 'polar'));
  emitter.addBehaviour(new Proton.Scale(0.5, 2));
  emitter.addBehaviour(new Proton.Alpha(0.5, 0));
  emitter.addBehaviour(new Proton.Color('#666666', '#111111'));
  emitter.addBehaviour(new Proton.RandomDrift(8, 2, 0.1));
  emitter.p.x = x;
  emitter.p.y = y;
  emitter.emit();
  return wrapEmitter(emitter);
}

// ---------------------------------------------------------------------------
// Burst Effects
// ---------------------------------------------------------------------------

/**
 * Explosion — radial burst at a point.
 */
export function createExplosionEffect(x: number, y: number, color = '#ff4400'): ParticleEffect {
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(20, 40), 1);
  emitter.addInitialize(new Proton.Life(0.3, 0.8));
  emitter.addInitialize(new Proton.Radius(3, 10));
  emitter.addInitialize(new Proton.Velocity(new Proton.Span(3, 10), new Proton.Span(0, 360), 'polar'));
  emitter.addBehaviour(new Proton.Scale(1, 0.1));
  emitter.addBehaviour(new Proton.Alpha(1, 0));
  emitter.addBehaviour(new Proton.Color(color, '#000000'));
  emitter.addBehaviour(new Proton.Gravity(3));
  emitter.p.x = x;
  emitter.p.y = y;
  emitter.emit('once');
  return wrapEmitter(emitter);
}

/**
 * Sparkle — radial shimmer burst (collect item, powerup).
 */
export function createSparkleEffect(x: number, y: number): ParticleEffect {
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(10, 20), 1);
  emitter.addInitialize(new Proton.Life(0.3, 0.6));
  emitter.addInitialize(new Proton.Radius(2, 5));
  emitter.addInitialize(new Proton.Velocity(new Proton.Span(2, 6), new Proton.Span(0, 360), 'polar'));
  emitter.addBehaviour(new Proton.Scale(1, 0));
  emitter.addBehaviour(new Proton.Alpha(1, 0));
  emitter.addBehaviour(new Proton.Color('#ffff00', '#ffffff'));
  emitter.p.x = x;
  emitter.p.y = y;
  emitter.emit('once');
  return wrapEmitter(emitter);
}

/**
 * Dust puff — small burst on jump/land.
 */
export function createDustEffect(x: number, y: number): ParticleEffect {
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(5, 10), 1);
  emitter.addInitialize(new Proton.Life(0.15, 0.3));
  emitter.addInitialize(new Proton.Radius(3, 8));
  emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 4), new Proton.Span(60, 120), 'polar'));
  emitter.addBehaviour(new Proton.Scale(0.8, 0.1));
  emitter.addBehaviour(new Proton.Alpha(0.6, 0));
  emitter.addBehaviour(new Proton.Color('#ccaa88'));
  emitter.p.x = x;
  emitter.p.y = y;
  emitter.emit('once');
  return wrapEmitter(emitter);
}

/**
 * Blood/damage — red burst on hit.
 */
export function createBloodEffect(x: number, y: number): ParticleEffect {
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(8, 15), 1);
  emitter.addInitialize(new Proton.Life(0.2, 0.5));
  emitter.addInitialize(new Proton.Radius(2, 6));
  emitter.addInitialize(new Proton.Velocity(new Proton.Span(2, 7), new Proton.Span(0, 360), 'polar'));
  emitter.addBehaviour(new Proton.Scale(1, 0.3));
  emitter.addBehaviour(new Proton.Alpha(0.9, 0));
  emitter.addBehaviour(new Proton.Color('#cc0000', '#330000'));
  emitter.addBehaviour(new Proton.Gravity(4));
  emitter.p.x = x;
  emitter.p.y = y;
  emitter.emit('once');
  return wrapEmitter(emitter);
}

// ---------------------------------------------------------------------------
// Trail & Continuous Effects
// ---------------------------------------------------------------------------

/**
 * Trail — follows a target, fading behind it.
 */
export function createTrailEffect(color = '#44aaff'): ParticleEffect {
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(3, 6), new Proton.Span(0.02, 0.04));
  emitter.addInitialize(new Proton.Life(0.2, 0.5));
  emitter.addInitialize(new Proton.Radius(3, 8));
  emitter.addBehaviour(new Proton.Scale(1, 0.1));
  emitter.addBehaviour(new Proton.Alpha(0.7, 0));
  emitter.addBehaviour(new Proton.Color(color, '#000000'));
  emitter.emit();
  return wrapEmitter(emitter);
}

/**
 * Bubble — rising bubbles for underwater/aquatic themes.
 */
export function createBubbleEffect(x: number, y: number): ParticleEffect {
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(2, 4), new Proton.Span(0.1, 0.3));
  emitter.addInitialize(new Proton.Life(2, 4));
  emitter.addInitialize(new Proton.Radius(3, 10));
  emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 2), new Proton.Span(85, 95), 'polar'));
  emitter.addBehaviour(new Proton.Scale(new Proton.Span(0.5, 1.2)));
  emitter.addBehaviour(new Proton.Alpha(0.6, 0.1));
  emitter.addBehaviour(new Proton.Color('#88ccff'));
  emitter.addBehaviour(new Proton.RandomDrift(10, 3, 0.1));
  emitter.p.x = x;
  emitter.p.y = y;
  emitter.emit();
  return wrapEmitter(emitter);
}

/**
 * Magic vortex — swirling, color-shifting particles.
 */
export function createMagicEffect(x: number, y: number, color = '#aa44ff'): ParticleEffect {
  const emitter = new Proton.Emitter();
  emitter.rate = new Proton.Rate(new Proton.Span(5, 10), new Proton.Span(0.05, 0.1));
  emitter.addInitialize(new Proton.Life(0.5, 1.5));
  emitter.addInitialize(new Proton.Radius(3, 8));
  emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, 20)));
  emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(0, 360), 'polar'));
  emitter.addBehaviour(new Proton.Scale(1, 0));
  emitter.addBehaviour(new Proton.Alpha(0.8, 0));
  emitter.addBehaviour(new Proton.Color(color, '#ffffff'));
  emitter.addBehaviour(new Proton.Cyclone(new Proton.Span(2, 5)));
  emitter.p.x = x;
  emitter.p.y = y;
  emitter.emit();
  return wrapEmitter(emitter);
}

// ---------------------------------------------------------------------------
// Ambient Effects
// ---------------------------------------------------------------------------

/**
 * Ambient particles (fireflies, dust motes, falling leaves, etc.)
 */
export function createAmbientEffect(type: 'fireflies' | 'dust' | 'leaves' | 'embers' | 'pollen',
  width: number, height: number): ParticleEffect {
  const emitter = new Proton.Emitter();

  switch (type) {
    case 'fireflies':
      emitter.rate = new Proton.Rate(new Proton.Span(1, 3), new Proton.Span(0.3, 0.8));
      emitter.addInitialize(new Proton.Life(3, 8));
      emitter.addInitialize(new Proton.Radius(2, 4));
      emitter.addInitialize(new Proton.Position(new Proton.RectZone(0, height * 0.3, width, height)));
      emitter.addBehaviour(new Proton.Alpha(0, 1, Infinity, Proton.easeInOutSine));
      emitter.addBehaviour(new Proton.Color('#ffff44'));
      emitter.addBehaviour(new Proton.RandomDrift(20, 15, 0.2));
      break;

    case 'dust':
      emitter.rate = new Proton.Rate(new Proton.Span(1, 2), new Proton.Span(0.5, 1));
      emitter.addInitialize(new Proton.Life(4, 8));
      emitter.addInitialize(new Proton.Radius(1, 3));
      emitter.addInitialize(new Proton.Position(new Proton.RectZone(0, 0, width, height)));
      emitter.addBehaviour(new Proton.Alpha(0.2, 0.05));
      emitter.addBehaviour(new Proton.Color('#ddccaa'));
      emitter.addBehaviour(new Proton.RandomDrift(5, 3, 0.05));
      break;

    case 'leaves':
      emitter.rate = new Proton.Rate(new Proton.Span(1, 2), new Proton.Span(0.5, 1.5));
      emitter.addInitialize(new Proton.Life(4, 8));
      emitter.addInitialize(new Proton.Radius(4, 8));
      emitter.addInitialize(new Proton.Position(new Proton.LineZone(-20, -20, width + 20, -20)));
      emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(240, 280), 'polar'));
      emitter.addBehaviour(new Proton.Alpha(0.7, 0.1));
      emitter.addBehaviour(new Proton.Color('#66aa33', '#aa6622'));
      emitter.addBehaviour(new Proton.Rotate('random', 'random'));
      emitter.addBehaviour(new Proton.RandomDrift(15, 5, 0.1));
      emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(-50, -50, width + 100, height + 50), 'dead'));
      break;

    case 'embers':
      emitter.rate = new Proton.Rate(new Proton.Span(2, 4), new Proton.Span(0.1, 0.3));
      emitter.addInitialize(new Proton.Life(1, 3));
      emitter.addInitialize(new Proton.Radius(1, 3));
      emitter.addInitialize(new Proton.Position(new Proton.LineZone(0, height + 10, width, height + 10)));
      emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 4), new Proton.Span(80, 100), 'polar'));
      emitter.addBehaviour(new Proton.Alpha(0.9, 0));
      emitter.addBehaviour(new Proton.Color('#ff6600', '#ffaa00'));
      emitter.addBehaviour(new Proton.RandomDrift(10, 3, 0.1));
      break;

    case 'pollen':
      emitter.rate = new Proton.Rate(new Proton.Span(1, 2), new Proton.Span(0.5, 1));
      emitter.addInitialize(new Proton.Life(5, 10));
      emitter.addInitialize(new Proton.Radius(1, 2));
      emitter.addInitialize(new Proton.Position(new Proton.RectZone(0, 0, width, height)));
      emitter.addBehaviour(new Proton.Alpha(0.4, 0.1));
      emitter.addBehaviour(new Proton.Color('#ffffcc'));
      emitter.addBehaviour(new Proton.RandomDrift(8, 4, 0.08));
      break;
  }

  emitter.p.x = 0;
  emitter.p.y = 0;
  emitter.emit();
  return wrapEmitter(emitter);
}

// ---------------------------------------------------------------------------
// Theme → Effect Mapping
// ---------------------------------------------------------------------------

export type GameTheme = 'nature' | 'dark' | 'space' | 'cartoon' | 'mountain' | 'forest'
  | 'underwater' | 'volcanic' | 'desert' | 'urban';

export function getThemeEffects(theme: GameTheme, width: number, height: number): ParticleEffect[] {
  const effects: ParticleEffect[] = [];

  switch (theme) {
    case 'nature':
      effects.push(createAmbientEffect('leaves', width, height));
      effects.push(createAmbientEffect('dust', width, height));
      break;
    case 'dark':
      effects.push(createAmbientEffect('embers', width, height));
      effects.push(createSmokeEffect(width * 0.3, height * 0.8));
      break;
    case 'space':
      effects.push(createAmbientEffect('dust', width, height)); // star-like particles
      break;
    case 'cartoon':
      effects.push(createAmbientEffect('pollen', width, height));
      break;
    case 'mountain':
      effects.push(createSnowEffect(width, height, 0.3));
      break;
    case 'forest':
      effects.push(createAmbientEffect('fireflies', width, height));
      effects.push(createAmbientEffect('pollen', width, height));
      break;
    case 'underwater':
      effects.push(createBubbleEffect(width * 0.5, height));
      break;
    case 'volcanic':
      effects.push(createAmbientEffect('embers', width, height));
      effects.push(createFireEffect(width * 0.7, height * 0.9, 0.5));
      break;
    case 'desert':
      effects.push(createAmbientEffect('dust', width, height));
      break;
    case 'urban':
      effects.push(createAmbientEffect('dust', width, height));
      break;
  }

  return effects;
}

// ---------------------------------------------------------------------------
// Gameplay Trigger Helpers
// ---------------------------------------------------------------------------

export function onJumpDust(proton: any, x: number, y: number): void {
  const e = createDustEffect(x, y);
  proton.addEmitter(e.emitter);
  setTimeout(() => { e.destroy(); proton.removeEmitter(e.emitter); }, 500);
}

export function onLandImpact(proton: any, x: number, y: number): void {
  const e = createDustEffect(x, y);
  proton.addEmitter(e.emitter);
  setTimeout(() => { e.destroy(); proton.removeEmitter(e.emitter); }, 600);
}

export function onCollectSparkle(proton: any, x: number, y: number): void {
  const e = createSparkleEffect(x, y);
  proton.addEmitter(e.emitter);
  setTimeout(() => { e.destroy(); proton.removeEmitter(e.emitter); }, 800);
}

export function onDamageHit(proton: any, x: number, y: number, theme: string = 'cartoon'): void {
  const e = theme === 'cartoon' ? createSparkleEffect(x, y) : createBloodEffect(x, y);
  proton.addEmitter(e.emitter);
  setTimeout(() => { e.destroy(); proton.removeEmitter(e.emitter); }, 800);
}

export function onDeathExplosion(proton: any, x: number, y: number, color?: string): void {
  const e = createExplosionEffect(x, y, color);
  proton.addEmitter(e.emitter);
  setTimeout(() => { e.destroy(); proton.removeEmitter(e.emitter); }, 1000);
}

export function onRunTrail(proton: any, x: number, y: number): void {
  const e = createDustEffect(x, y);
  proton.addEmitter(e.emitter);
  setTimeout(() => { e.destroy(); proton.removeEmitter(e.emitter); }, 300);
}
`;
