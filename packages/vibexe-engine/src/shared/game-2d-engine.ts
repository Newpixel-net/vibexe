/**
 * 2D Game Engine Core — Pixi.js + Proton
 *
 * This file contains the engine code that gets injected into 2D game projects
 * as template files. The AI agent imports from these pre-created files.
 *
 * Architecture:
 * - Scene manager: boot → menu → game → gameover (state machine)
 * - Game loop: PIXI.Ticker + Proton.update() each frame
 * - Input handler: keyboard (WASD/arrows/space), touch, pointer events
 * - Asset loader: PIXI.Assets.load() with progress tracking
 * - Camera: Container offset-based scrolling (follows player, bounded to world)
 * - Sprite factory: createSprite, createAnimatedSprite, createTilingSprite
 * - Text/UI layer: fixed container above game world (score, lives, HUD)
 * - Audio: basic Web Audio API
 */

// ============================================================================
// ENGINE CORE (src/engine/core.ts template content)
// ============================================================================

export const ENGINE_CORE_CONTENT = `
const PIXI = (window as any).PIXI;
const Proton = (window as any).Proton;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SceneName = 'boot' | 'menu' | 'game' | 'gameover' | string;

export interface GameScene {
  name: SceneName;
  container: any; // PIXI.Container
  enter(engine: Engine2D, data?: any): void;
  update(engine: Engine2D, dt: number): void;
  exit(engine: Engine2D): void;
}

export interface Engine2DConfig {
  width: number;
  height: number;
  backgroundColor: number;
  worldWidth?: number;
  worldHeight?: number;
  gravity?: number;
  pixelRatio?: number;
  antialias?: boolean;
}

// ---------------------------------------------------------------------------
// Engine2D — main orchestrator
// ---------------------------------------------------------------------------

export class Engine2D {
  app: any;               // PIXI.Application
  proton: any;            // Proton instance
  protonRenderer: any;    // Proton.PixiRenderer
  world: any;             // PIXI.Container (game world — moves with camera)
  ui: any;                // PIXI.Container (UI layer — fixed on screen)
  input: InputManager;
  camera: Camera2D;
  audio: AudioManager;
  config: Engine2DConfig;

  private scenes: Map<SceneName, GameScene> = new Map();
  private currentScene: GameScene | null = null;
  private _elapsed = 0;
  private _paused = false;
  private _fpsFrames = 0;
  private _fpsTime = 0;
  private _fpsDisplay: any = null;

  constructor(config: Engine2DConfig) {
    this.config = {
      worldWidth: config.width * 3,
      worldHeight: config.height * 2,
      gravity: 980,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      antialias: true,
      ...config,
    };

    this.input = new InputManager();
    this.camera = new Camera2D(this.config.width, this.config.height,
      this.config.worldWidth!, this.config.worldHeight!);
    this.audio = new AudioManager();
  }

  async init(rootEl?: HTMLElement): Promise<void> {
    // Create PIXI Application
    this.app = new PIXI.Application();
    await this.app.init({
      width: this.config.width,
      height: this.config.height,
      backgroundColor: this.config.backgroundColor,
      resolution: this.config.pixelRatio,
      autoDensity: true,
      antialias: this.config.antialias,
    });

    const root = rootEl || document.getElementById('root');
    if (root) root.appendChild(this.app.canvas);

    // World container (moves with camera)
    this.world = new PIXI.Container();
    this.app.stage.addChild(this.world);

    // UI container (fixed above world)
    this.ui = new PIXI.Container();
    this.app.stage.addChild(this.ui);

    // Proton particle engine
    this.proton = new Proton();
    this.protonRenderer = new Proton.PixiRenderer(this.world);
    this.proton.addRenderer(this.protonRenderer);

    // Store globals for runtime cleanup
    (window as any).__vibexe_pixiApp__ = this.app;
    (window as any).__vibexe_proton__ = this.proton;

    // Input
    this.input.init(this.app.canvas);

    // Game loop
    this.app.ticker.add((ticker: any) => {
      if (this._paused) return;
      const dt = ticker.deltaMS / 1000; // seconds
      this._elapsed += dt;

      // Update Proton particles
      this.proton.update();

      // Update camera
      this.camera.update(this.world);

      // Update current scene
      if (this.currentScene) {
        this.currentScene.update(this, dt);
      }

      // FPS counter
      this._updateFPS(dt);
    });

    // Tab visibility — pause proton when backgrounded
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._paused = true;
        this.app.ticker.stop();
      } else {
        this._paused = false;
        this.app.ticker.start();
      }
    });

    // Resize handler
    window.addEventListener('resize', () => this._onResize());

    console.log('[Engine2D] Initialized — ' + this.config.width + 'x' + this.config.height);
  }

  // Scene management
  addScene(scene: GameScene): void {
    this.scenes.set(scene.name, scene);
  }

  switchScene(name: SceneName, data?: any): void {
    if (this.currentScene) {
      this.juice.killAll();
      this.currentScene.exit(this);
      this.world.removeChild(this.currentScene.container);
      this.ui.removeChildren();
    }
    const next = this.scenes.get(name);
    if (!next) {
      console.error('[Engine2D] Scene not found:', name);
      return;
    }
    this.currentScene = next;
    this.world.addChild(next.container);
    next.enter(this, data);
    console.log('[Engine2D] Scene:', name);
  }

  get elapsed(): number { return this._elapsed; }
  get paused(): boolean { return this._paused; }
  set paused(v: boolean) {
    this._paused = v;
    if (v) this.app.ticker.stop();
    else this.app.ticker.start();
  }

  // Sprite factories
  createSprite(texture: any, x = 0, y = 0, scale = 1): any {
    const spr = new PIXI.Sprite(texture);
    spr.anchor.set(0.5);
    spr.x = x;
    spr.y = y;
    spr.scale.set(scale);
    return spr;
  }

  createAnimatedSprite(textures: any[], speed = 0.15): any {
    const anim = new PIXI.AnimatedSprite(textures);
    anim.anchor.set(0.5);
    anim.animationSpeed = speed;
    anim.play();
    return anim;
  }

  createTilingSprite(texture: any, width: number, height: number): any {
    const ts = new PIXI.TilingSprite({ texture, width, height });
    return ts;
  }

  createText(text: string, style?: any): any {
    const defaultStyle = {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 4 },
      ...style,
    };
    return new PIXI.Text({ text, style: defaultStyle });
  }

  // Proton emitter helper
  addEmitter(emitter: any): void {
    this.proton.addEmitter(emitter);
  }

  removeEmitter(emitter: any): void {
    this.proton.removeEmitter(emitter);
    emitter.destroy();
  }

  // Juice system for professional game feel
  juice: JuiceSystem = new JuiceSystem();

  destroy(): void {
    this.juice.killAll();
    this.input.destroy();
    if (this.proton) this.proton.destroy();
    if (this.app) this.app.destroy(true, { children: true, texture: true });
    console.log('[Engine2D] Destroyed');
  }

  private _onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.app.renderer.resize(w, h);
    this.camera.viewWidth = w;
    this.camera.viewHeight = h;
  }

  private _updateFPS(dt: number): void {
    this._fpsFrames++;
    this._fpsTime += dt;
    if (this._fpsTime >= 1) {
      const fps = Math.round(this._fpsFrames / this._fpsTime);
      if (!this._fpsDisplay) {
        this._fpsDisplay = document.createElement('div');
        this._fpsDisplay.id = '__vibexe_fps__';
        this._fpsDisplay.style.cssText = 'position:fixed;top:4px;right:4px;color:#0f0;font:bold 14px monospace;z-index:9999;pointer-events:none;text-shadow:1px 1px #000';
        document.body.appendChild(this._fpsDisplay);
      }
      this._fpsDisplay.textContent = fps + ' FPS';
      // Report to parent
      try { window.parent.postMessage({ type: 'vibexe-fps', fps }, '*'); } catch(e) {}
      this._fpsFrames = 0;
      this._fpsTime = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// InputManager
// ---------------------------------------------------------------------------

export class InputManager {
  keys: Set<string> = new Set();
  justPressed: Set<string> = new Set();
  justReleased: Set<string> = new Set();
  pointer = { x: 0, y: 0, down: false, justDown: false, justUp: false };

  private _keydownFn: any;
  private _keyupFn: any;
  private _pointermoveFn: any;
  private _pointerdownFn: any;
  private _pointerupFn: any;
  private _canvas: HTMLCanvasElement | null = null;

  init(canvas: HTMLCanvasElement): void {
    this._canvas = canvas;

    this._keydownFn = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.justPressed.add(k);
      this.keys.add(k);
      // Prevent scroll on arrow/space
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    this._keyupFn = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      this.justReleased.add(k);
    };
    this._pointermoveFn = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - rect.left;
      this.pointer.y = e.clientY - rect.top;
    };
    this._pointerdownFn = () => {
      this.pointer.down = true;
      this.pointer.justDown = true;
    };
    this._pointerupFn = () => {
      this.pointer.down = false;
      this.pointer.justUp = true;
    };

    window.addEventListener('keydown', this._keydownFn);
    window.addEventListener('keyup', this._keyupFn);
    canvas.addEventListener('pointermove', this._pointermoveFn);
    canvas.addEventListener('pointerdown', this._pointerdownFn);
    canvas.addEventListener('pointerup', this._pointerupFn);
  }

  // Call at end of each frame to clear one-shot states
  endFrame(): void {
    this.justPressed.clear();
    this.justReleased.clear();
    this.pointer.justDown = false;
    this.pointer.justUp = false;
  }

  isDown(key: string): boolean { return this.keys.has(key.toLowerCase()); }
  wasPressed(key: string): boolean { return this.justPressed.has(key.toLowerCase()); }
  wasReleased(key: string): boolean { return this.justReleased.has(key.toLowerCase()); }

  // Directional helpers
  get left(): boolean { return this.isDown('a') || this.isDown('arrowleft'); }
  get right(): boolean { return this.isDown('d') || this.isDown('arrowright'); }
  get up(): boolean { return this.isDown('w') || this.isDown('arrowup'); }
  get down(): boolean { return this.isDown('s') || this.isDown('arrowdown'); }
  get jump(): boolean { return this.wasPressed(' ') || this.wasPressed('arrowup') || this.wasPressed('w'); }

  destroy(): void {
    if (this._keydownFn) window.removeEventListener('keydown', this._keydownFn);
    if (this._keyupFn) window.removeEventListener('keyup', this._keyupFn);
    if (this._canvas) {
      this._canvas.removeEventListener('pointermove', this._pointermoveFn);
      this._canvas.removeEventListener('pointerdown', this._pointerdownFn);
      this._canvas.removeEventListener('pointerup', this._pointerupFn);
    }
  }
}

// ---------------------------------------------------------------------------
// Camera2D
// ---------------------------------------------------------------------------

export class Camera2D {
  x = 0;
  y = 0;
  viewWidth: number;
  viewHeight: number;
  worldWidth: number;
  worldHeight: number;
  target: { x: number; y: number } | null = null;
  smoothing = 0.1;
  deadZoneX = 50;
  deadZoneY = 30;

  constructor(vw: number, vh: number, ww: number, wh: number) {
    this.viewWidth = vw;
    this.viewHeight = vh;
    this.worldWidth = ww;
    this.worldHeight = wh;
  }

  follow(target: { x: number; y: number }): void {
    this.target = target;
  }

  update(worldContainer: any): void {
    if (this.target) {
      const targetX = this.target.x - this.viewWidth / 2;
      const targetY = this.target.y - this.viewHeight / 2;

      // Smooth follow with dead zone
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      if (Math.abs(dx) > this.deadZoneX) {
        this.x += (dx - Math.sign(dx) * this.deadZoneX) * this.smoothing;
      }
      if (Math.abs(dy) > this.deadZoneY) {
        this.y += (dy - Math.sign(dy) * this.deadZoneY) * this.smoothing;
      }
    }

    // Clamp to world bounds
    this.x = Math.max(0, Math.min(this.x, this.worldWidth - this.viewWidth));
    this.y = Math.max(0, Math.min(this.y, this.worldHeight - this.viewHeight));

    // Apply to world container (negative = world moves opposite to camera)
    worldContainer.x = -Math.round(this.x);
    worldContainer.y = -Math.round(this.y);
  }

  // Convert screen coords to world coords
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx + this.x, y: sy + this.y };
  }
}

// ---------------------------------------------------------------------------
// AudioManager
// ---------------------------------------------------------------------------

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private currentMusic: AudioBufferSourceNode | null = null;

  private ensureContext(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    (window as any).__vibexe_audioCtx__ = this.ctx;
  }

  async loadSound(id: string, url: string): Promise<void> {
    this.ensureContext();
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx!.decodeAudioData(buffer);
      this.sounds.set(id, audioBuffer);
    } catch (e) {
      console.warn('[Audio] Failed to load:', id, e);
    }
  }

  playSFX(id: string, volume = 1): void {
    this.ensureContext();
    const buffer = this.sounds.get(id);
    if (!buffer || !this.ctx) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.sfxGain!);
    source.start();
  }

  playMusic(id: string, loop = true, volume = 0.5): void {
    this.stopMusic();
    this.ensureContext();
    const buffer = this.sounds.get(id);
    if (!buffer || !this.ctx) return;
    this.currentMusic = this.ctx.createBufferSource();
    this.currentMusic.buffer = buffer;
    this.currentMusic.loop = loop;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    this.currentMusic.connect(gain);
    gain.connect(this.musicGain!);
    this.currentMusic.start();
  }

  stopMusic(): void {
    if (this.currentMusic) {
      try { this.currentMusic.stop(); } catch(e) {}
      this.currentMusic = null;
    }
  }

  setMasterVolume(v: number): void {
    this.ensureContext();
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }
}

// ---------------------------------------------------------------------------
// Asset loading helper
// ---------------------------------------------------------------------------

export async function loadAssets(manifest: Record<string, string>,
  onProgress?: (pct: number) => void): Promise<Record<string, any>> {
  const entries = Object.entries(manifest);
  const results: Record<string, any> = {};
  let loaded = 0;

  for (const [key, url] of entries) {
    try {
      results[key] = await PIXI.Assets.load(url);
    } catch (e) {
      console.warn('[Assets] Failed to load:', key, url, e);
    }
    loaded++;
    if (onProgress) onProgress(loaded / entries.length);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Quick-start helper
// ---------------------------------------------------------------------------

export async function createGame2D(config: Partial<Engine2DConfig> = {}): Promise<Engine2D> {
  const engine = new Engine2D({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1a1a2e,
    ...config,
  });
  await engine.init();
  return engine;
}

// ---------------------------------------------------------------------------
// JuiceSystem — GSAP-powered game feel effects
// ---------------------------------------------------------------------------

export class JuiceSystem {
  private gsap: any = (window as any).gsap || null;
  private activeKillFns: (() => void)[] = [];

  /** Bounce scale up then back (e.g. coin collect, score change) */
  scalePop(obj: any, scale = 1.3, duration = 0.2): void {
    if (!this.gsap || !obj) return;
    this.gsap.to(obj.scale, {
      x: scale, y: scale, duration: duration * 0.4,
      ease: 'back.out(3)',
      onComplete: () => {
        this.gsap.to(obj.scale, { x: 1, y: 1, duration: duration * 0.6, ease: 'elastic.out(1, 0.4)' });
      }
    });
  }

  /** GSAP-powered camera shake — smooth decaying random offsets */
  screenShake(container: any, intensity = 8, duration = 0.3): void {
    if (!this.gsap || !container) return;
    var origX = container.x, origY = container.y;
    var tl = this.gsap.timeline();
    var steps = Math.ceil(duration / 0.03);
    for (var i = 0; i < steps; i++) {
      var t = i / steps;
      var decay = 1 - t;
      tl.to(container, {
        x: origX + (Math.random() - 0.5) * intensity * decay * 2,
        y: origY + (Math.random() - 0.5) * intensity * decay * 2,
        duration: 0.03, ease: 'none',
      });
    }
    tl.to(container, { x: origX, y: origY, duration: 0.05 });
  }

  /** Freeze the ticker briefly for impact feel */
  hitPause(app: any, ms = 80): void {
    if (!app || !app.ticker) return;
    app.ticker.stop();
    setTimeout(function() { app.ticker.start(); }, ms);
  }

  /** Flash a tint color then restore original */
  colorFlash(obj: any, color = 0xffffff, duration = 0.15): void {
    if (!obj) return;
    var origTint = obj.tint !== undefined ? obj.tint : 0xffffff;
    obj.tint = color;
    if (this.gsap) {
      this.gsap.delayedCall(duration, function() { obj.tint = origTint; });
    } else {
      setTimeout(function() { obj.tint = origTint; }, duration * 1000);
    }
  }

  /** Sine-wave bobbing (returns kill function). Use for floating coins, powerups. */
  float(obj: any, amplitude = 6, speed = 2): () => void {
    if (!this.gsap || !obj) return function(){};
    var baseY = obj.y;
    var tween = this.gsap.to(obj, {
      y: baseY - amplitude, duration: 1 / speed,
      ease: 'sine.inOut', yoyo: true, repeat: -1,
    });
    var kill = function() { tween.kill(); obj.y = baseY; };
    this.activeKillFns.push(kill);
    return kill;
  }

  /** Idle breathing pulse (returns kill function). */
  breathe(obj: any, scale = 1.05, speed = 1.5): () => void {
    if (!this.gsap || !obj) return function(){};
    var tween = this.gsap.to(obj.scale, {
      x: scale, y: scale, duration: 1 / speed,
      ease: 'sine.inOut', yoyo: true, repeat: -1,
    });
    var kill = function() { tween.kill(); obj.scale.set(1); };
    this.activeKillFns.push(kill);
    return kill;
  }

  /** Spring squash & stretch on landing */
  squashStretch(obj: any, squashY = 0.7, stretchY = 1.15): void {
    if (!this.gsap || !obj) return;
    this.gsap.timeline()
      .set(obj.scale, { y: squashY, x: 1 / squashY })
      .to(obj.scale, { y: stretchY, x: 1 / stretchY, duration: 0.1, ease: 'power2.out' })
      .to(obj.scale, { y: 1, x: 1, duration: 0.3, ease: 'elastic.out(1, 0.3)' });
  }

  /** Character-by-character text reveal */
  typewriter(textObj: any, text: string, speed = 0.04): void {
    if (!textObj) return;
    textObj.text = '';
    var idx = 0;
    var interval = setInterval(function() {
      if (idx >= text.length) { clearInterval(interval); return; }
      textObj.text += text[idx];
      idx++;
    }, speed * 1000);
  }

  /** Cleanup all active looping tweens */
  killAll(): void {
    for (var i = 0; i < this.activeKillFns.length; i++) {
      try { this.activeKillFns[i](); } catch(e) {}
    }
    this.activeKillFns = [];
    if (this.gsap) {
      try { this.gsap.killTweensOf('*'); } catch(e) {}
    }
  }
}
`;

// ============================================================================
// INPUT HANDLER (src/engine/input.ts template content)
// ============================================================================

export const ENGINE_INPUT_CONTENT = `
// Input handling is built into Engine2D core (InputManager class).
// This file provides additional touch/mobile input utilities.

const PIXI = (window as any).PIXI;

export interface VirtualJoystick {
  container: any; // PIXI.Container
  direction: { x: number; y: number };
  active: boolean;
  destroy(): void;
}

/**
 * Creates a virtual joystick for mobile touch input.
 * Returns direction vector (normalized -1..1) updated each frame.
 */
export function createVirtualJoystick(stage: any, x: number, y: number, radius = 60): VirtualJoystick {
  const container = new PIXI.Container();
  container.x = x;
  container.y = y;

  // Base circle
  const base = new PIXI.Graphics();
  base.circle(0, 0, radius);
  base.fill({ color: 0xffffff, alpha: 0.2 });
  base.stroke({ color: 0xffffff, alpha: 0.4, width: 2 });
  container.addChild(base);

  // Thumb
  const thumb = new PIXI.Graphics();
  thumb.circle(0, 0, radius * 0.4);
  thumb.fill({ color: 0xffffff, alpha: 0.5 });
  container.addChild(thumb);

  const joystick: VirtualJoystick = {
    container,
    direction: { x: 0, y: 0 },
    active: false,
    destroy() {
      stage.removeChild(container);
    }
  };

  let pointerId: number | null = null;

  container.eventMode = 'static';
  container.on('pointerdown', (e: any) => {
    pointerId = e.pointerId;
    joystick.active = true;
  });

  const onMove = (e: any) => {
    if (e.pointerId !== pointerId || !joystick.active) return;
    const local = container.toLocal(e.global);
    const dist = Math.sqrt(local.x * local.x + local.y * local.y);
    const clampDist = Math.min(dist, radius);
    const angle = Math.atan2(local.y, local.x);
    thumb.x = Math.cos(angle) * clampDist;
    thumb.y = Math.sin(angle) * clampDist;
    joystick.direction.x = thumb.x / radius;
    joystick.direction.y = thumb.y / radius;
  };

  const onUp = (e: any) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    joystick.active = false;
    thumb.x = 0;
    thumb.y = 0;
    joystick.direction.x = 0;
    joystick.direction.y = 0;
  };

  stage.on('pointermove', onMove);
  stage.on('pointerup', onUp);
  stage.on('pointerupoutside', onUp);

  stage.addChild(container);
  return joystick;
}

/**
 * Simple tap-to-action for mobile (e.g., tap right half to jump).
 */
export function onTapZone(canvas: HTMLCanvasElement, zone: 'left' | 'right' | 'full',
  callback: () => void): () => void {
  const handler = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const mid = rect.width / 2;
    if (zone === 'left' && x < mid) callback();
    else if (zone === 'right' && x >= mid) callback();
    else if (zone === 'full') callback();
  };
  canvas.addEventListener('pointerdown', handler);
  return () => canvas.removeEventListener('pointerdown', handler);
}
`;

// ============================================================================
// MEDIA STOCK URL BUILDER (src/utils/media-stock.ts template content)
// ============================================================================

export const MEDIA_STOCK_2D_CONTENT = `
/**
 * Builds a full URL for a 2D media-stock game asset.
 * Uses the platform-injected origin so it works inside the runtime iframe.
 *
 * Example: spriteUrl("robot/walk_01.png")
 * Example: spriteUrl("environments/nature/1.png")
 */
export function spriteUrl(path: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || '';
  return origin + '/api/app-builder/media-stock/' + encodeURI(path);
}

/**
 * Load a single sprite texture via PIXI.Assets
 */
export async function loadSprite(path: string): Promise<any> {
  const PIXI = (window as any).PIXI;
  const url = spriteUrl(path);
  return PIXI.Assets.load(url);
}

/**
 * Load multiple sprites in parallel
 */
export async function loadSprites(paths: string[]): Promise<Record<string, any>> {
  const PIXI = (window as any).PIXI;
  const manifest: Record<string, string> = {};
  for (const p of paths) {
    manifest[p] = spriteUrl(p);
  }
  return PIXI.Assets.load(Object.values(manifest)).then(() => {
    const result: Record<string, any> = {};
    for (const [key, url] of Object.entries(manifest)) {
      result[key] = PIXI.Assets.get(url);
    }
    return result;
  });
}

/**
 * Load a sprite sheet JSON + texture, returns animation frames.
 * The JSON file must follow the standard format:
 * { "frames": { "name": { "frame": { x, y, w, h } } }, "animations": { "idle": ["frame1","frame2",...] }, "meta": { "image": "sheet.png" } }
 *
 * Usage:
 *   const sheet = await loadSpriteSheet("2d/sprites/characters/hero/sheet.json");
 *   const anim = new PIXI.AnimatedSprite(sheet.animations['idle']);
 */
export async function loadSpriteSheet(jsonPath: string): Promise<any> {
  const PIXI = (window as any).PIXI;
  const url = spriteUrl(jsonPath);
  try {
    const sheet = await PIXI.Assets.load(url);
    return sheet;
  } catch (e) {
    console.warn('[media-stock] Failed to load sprite sheet:', jsonPath, e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sprite Library — preloaded texture cache for the drawing helper fallback chain
// ---------------------------------------------------------------------------

/** Internal cache of loaded sprite textures keyed by category/name */
const _spriteCache: Record<string, any> = {};

/** Internal cache of loaded animated sprite sheet data */
export const _sheetCache: Record<string, any> = {};

/** Whether the sprite library has been loaded */
let _spriteLibLoaded = false;

/** Sprite catalog — maps style to available sprite paths */
const SPRITE_CATALOG: Record<string, Record<string, string[]>> = {
  default: {
    platforms: ['2d/sprites/platforms/grass_block.png', '2d/sprites/platforms/stone_block.png', '2d/sprites/platforms/ice_block.png', '2d/sprites/platforms/sand_block.png', '2d/sprites/platforms/dark_block.png'],
    trees: ['2d/sprites/trees/round_tree.png', '2d/sprites/trees/pine_tree.png', '2d/sprites/trees/palm_tree.png', '2d/sprites/trees/dead_tree.png'],
    bushes: ['2d/sprites/bushes/bush_green.png', '2d/sprites/bushes/bush_flower.png'],
    clouds: ['2d/sprites/clouds/cloud_puffy.png', '2d/sprites/clouds/cloud_small.png'],
    collectibles: ['2d/sprites/collectibles/coin_gold.png', '2d/sprites/collectibles/gem_red.png', '2d/sprites/collectibles/gem_blue.png', '2d/sprites/collectibles/star.png', '2d/sprites/collectibles/heart.png'],
    props: ['2d/sprites/props/crate.png', '2d/sprites/props/barrel.png', '2d/sprites/props/rock.png', '2d/sprites/props/fence.png', '2d/sprites/props/sign_post.png'],
    backgrounds: ['2d/sprites/backgrounds/hill_green.png', '2d/sprites/backgrounds/hill_snow.png', '2d/sprites/backgrounds/mountain_rock.png'],
  },
};

/** Character sprite sheets — maps character name to sheet JSON path */
const CHARACTER_SHEETS: Record<string, string> = {
  hero: '2d/sprites/characters/hero/sheet.json',
  slime: '2d/sprites/characters/slime/sheet.json',
  bat: '2d/sprites/characters/bat/sheet.json',
  boss: '2d/sprites/characters/boss/sheet.json',
  npc: '2d/sprites/characters/npc/sheet.json',
};

/**
 * Preload all sprites for a given style. Call in scene enter().
 * Silently skips missing assets — fallback chain handles them.
 */
export async function _loadSpriteLib(style?: string): Promise<void> {
  if (_spriteLibLoaded) return;
  const PIXI = (window as any).PIXI;
  const catalog = SPRITE_CATALOG[style || 'default'] || SPRITE_CATALOG.default;
  const allPaths: string[] = [];
  for (const cat of Object.keys(catalog)) {
    for (const p of catalog[cat]) allPaths.push(p);
  }

  // Load environment sprites (silently skip failures)
  var loaded = 0;
  for (var i = 0; i < allPaths.length; i++) {
    try {
      var url = spriteUrl(allPaths[i]);
      var tex = await PIXI.Assets.load(url);
      if (tex) { _spriteCache[allPaths[i]] = tex; loaded++; }
    } catch (e) { /* sprite not available yet — fallback chain handles it */ }
  }

  // Load character sprite sheets — manually parse for reliable AnimatedSprite support
  for (var charName of Object.keys(CHARACTER_SHEETS)) {
    try {
      var jsonUrl = spriteUrl(CHARACTER_SHEETS[charName]);
      var pngPath = CHARACTER_SHEETS[charName].replace('/sheet.json', '/sheet.png');
      var pngUrl = spriteUrl(pngPath);

      // Load JSON metadata + PNG texture in parallel
      var [jsonResp, baseTex] = await Promise.all([
        fetch(jsonUrl).then(r => r.ok ? r.json() : null),
        PIXI.Assets.load(pngUrl).catch(() => null)
      ]);
      if (!jsonResp || !baseTex) continue;

      // Create and parse PIXI.Spritesheet from texture + JSON data
      var spritesheet = new PIXI.Spritesheet(baseTex, jsonResp);
      await spritesheet.parse();
      if (spritesheet.animations && Object.keys(spritesheet.animations).length > 0) {
        _sheetCache[charName] = spritesheet;
        loaded++;
        console.log('[sprite-lib] Parsed sheet: ' + charName + ' (' + Object.keys(spritesheet.animations).join(', ') + ')');
      }
    } catch (e) { /* character sheet not available yet */ }
  }

  _spriteLibLoaded = true;
  if (loaded > 0) console.log('[sprite-lib] Loaded ' + loaded + ' assets');
}

/**
 * Get a cached static sprite as PIXI.Sprite, or null if not loaded.
 * Usage: var spr = _getSprite('platforms', 'grass_block');
 */
export function _getSprite(category: string, name: string): any {
  var PIXI = (window as any).PIXI;
  var key = '2d/sprites/' + category + '/' + name + '.png';
  var tex = _spriteCache[key];
  if (!tex) return null;
  return new PIXI.Sprite(tex);
}

/**
 * Get an AnimatedSprite from a loaded character sheet, or null.
 * Usage: var anim = _getAnimatedSprite('hero', 'idle');
 */
export function _getAnimatedSprite(character: string, animation: string): any {
  var PIXI = (window as any).PIXI;
  var sheet = _sheetCache[character];
  if (!sheet || !sheet.animations || !sheet.animations[animation]) return null;
  var anim = new PIXI.AnimatedSprite(sheet.animations[animation]);
  anim.animationSpeed = 0.15;
  anim.play();
  return anim;
}
`;
