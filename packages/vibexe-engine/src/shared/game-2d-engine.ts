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
  uiLayer: any;           // PIXI.Container (UI layer — fixed on screen)
  input: InputManager;
  camera: Camera2D;
  audio: AudioManager;
  config: Engine2DConfig;

  // Namespace systems (engine.spawn.*, engine.effects.*, etc.)
  spawn: SpawnSystem;
  effects: EffectsSystem;
  physics: PhysicsSystem;
  scene: SceneSystem;
  ui: UISystem;
  assets: AssetsSystem;
  features: FeatureManager;

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

    // Initialize namespace systems
    this.spawn = new SpawnSystem(this);
    this.effects = new EffectsSystem(this);
    this.physics = new PhysicsSystem(this);
    this.scene = new SceneSystem(this);
    this.ui = new UISystem(this);
    this.assets = new AssetsSystem(this);
    this.features = new FeatureManager(this);
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
    this.uiLayer = new PIXI.Container();
    this.app.stage.addChild(this.uiLayer);

    // Proton particle engine
    this.proton = new Proton();
    this.protonRenderer = new Proton.PixiRenderer(this.world);
    this.proton.addRenderer(this.protonRenderer);

    // Store globals for runtime cleanup
    (window as any).__vibexe_pixiApp__ = this.app;
    (window as any).__vibexe_proton__ = this.proton;

    // Wire camera to world container
    this.camera._worldContainer = this.world;

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

      // Update feature snippets
      this.features.updateAll(dt);

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
      this.uiLayer.removeChildren();
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
    this.features.destroy();
    this.juice.killAll();
    this.effects.destroyAll();
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

  /** Shake the camera (uses GSAP if available) */
  shake(intensity = 8, duration = 0.3): void {
    var gsap = (window as any).gsap;
    if (!gsap || !this._worldContainer) return;
    var container = this._worldContainer;
    var origX = container.x, origY = container.y;
    var tl = gsap.timeline();
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

  /** Smoothly zoom to a level (1 = normal, 2 = double) */
  zoom(level: number, duration = 0.5): void {
    var gsap = (window as any).gsap;
    if (!this._worldContainer) return;
    if (gsap) {
      gsap.to(this._worldContainer.scale, {
        x: level, y: level, duration, ease: 'power2.inOut'
      });
    } else {
      this._worldContainer.scale.set(level);
    }
  }

  /** Smoothly pan camera to a world position */
  pan(x: number, y: number, duration = 1): void {
    var gsap = (window as any).gsap;
    var self = this;
    if (gsap) {
      gsap.to(this, { x, y, duration, ease: 'power2.inOut',
        onUpdate: function() { if (self._worldContainer) self.update(self._worldContainer); }
      });
    } else {
      this.x = x;
      this.y = y;
    }
  }

  /** Set camera bounds (clamp region) */
  bounds(x: number, y: number, width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
    this._boundsOffset = { x, y };
  }

  // Internal reference set during engine init
  _worldContainer: any = null;
  _boundsOffset: { x: number; y: number } = { x: 0, y: 0 };
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

  // --- Clean API aliases ---

  /** Alias: playSFX → play */
  play(id: string, volume = 1): void { this.playSFX(id, volume); }

  /** Alias: playMusic → music */
  music(id: string, loop = true, volume = 0.5): void { this.playMusic(id, loop, volume); }

  /** Set volume for a channel */
  volume(channel: 'master' | 'music' | 'sfx', level: number): void {
    this.ensureContext();
    var v = Math.max(0, Math.min(1, level));
    if (channel === 'master' && this.masterGain) this.masterGain.gain.value = v;
    else if (channel === 'music' && this.musicGain) this.musicGain.gain.value = v;
    else if (channel === 'sfx' && this.sfxGain) this.sfxGain.gain.value = v;
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
// SpawnSystem — engine.spawn.* namespace
// ---------------------------------------------------------------------------

export class SpawnSystem {
  private engine: Engine2D;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Create a sprite from a texture at (x, y) */
  sprite(texture: any, x = 0, y = 0, config: any = {}): any {
    const spr = new PIXI.Sprite(texture);
    spr.anchor.set(config.anchor?.x ?? 0.5, config.anchor?.y ?? 0.5);
    spr.x = x;
    spr.y = y;
    if (config.scale !== undefined) spr.scale.set(config.scale);
    if (config.tint !== undefined) spr.tint = config.tint;
    if (config.alpha !== undefined) spr.alpha = config.alpha;
    if (config.rotation !== undefined) spr.rotation = config.rotation;
    if (config.zIndex !== undefined) spr.zIndex = config.zIndex;
    return spr;
  }

  /** Create a text object */
  text(x: number, y: number, text: string, style?: any): any {
    const defaultStyle = {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 4 },
      ...style,
    };
    const t = new PIXI.Text({ text, style: defaultStyle });
    t.x = x;
    t.y = y;
    return t;
  }

  /** Create an animated sprite from an array of textures */
  animatedSprite(textures: any[], speed = 0.15): any {
    const anim = new PIXI.AnimatedSprite(textures);
    anim.anchor.set(0.5);
    anim.animationSpeed = speed;
    anim.play();
    return anim;
  }

  /** Create a tiling sprite */
  tilingSprite(texture: any, x: number, y: number, width: number, height: number): any {
    const ts = new PIXI.TilingSprite({ texture, width, height });
    ts.x = x;
    ts.y = y;
    return ts;
  }

  /** Spawn a player entity at (x, y) with config */
  player(x: number, y: number, config: any = {}): any {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.label = 'player';
    (container as any)._config = { speed: 200, jumpForce: 450, health: 3, lives: 3, ...config };
    return container;
  }

  /** Spawn an enemy entity at (x, y) */
  enemy(x: number, y: number, type?: string, config: any = {}): any {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.label = 'enemy';
    (container as any)._config = { type: type || 'patrol', health: 1, speed: 80, damage: 1, ...config };
    return container;
  }

  /** Spawn a platform at (x, y) with given dimensions */
  platform(x: number, y: number, width: number, height: number, config: any = {}): any {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.label = 'platform';
    (container as any)._config = { width, height, isOneWay: false, ...config };
    return container;
  }

  /** Spawn a coin/collectible at (x, y) */
  coin(x: number, y: number, config: any = {}): any {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.label = 'coin';
    (container as any)._config = { value: 10, bobSpeed: 2, ...config };
    return container;
  }

  /** Spawn a projectile at (x, y) moving in direction */
  projectile(x: number, y: number, direction: { x: number; y: number }, config: any = {}): any {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.label = 'projectile';
    (container as any)._config = { speed: 400, damage: 1, lifetime: 3, direction, ...config };
    return container;
  }
}

// ---------------------------------------------------------------------------
// EffectsSystem — engine.effects.* namespace (Proton particle presets)
// ---------------------------------------------------------------------------

export class EffectsSystem {
  private engine: Engine2D;
  private _activeEffects: any[] = [];

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  private _add(emitter: any): any {
    this.engine.proton.addEmitter(emitter);
    this._activeEffects.push(emitter);
    return emitter;
  }

  private _burst(emitter: any, ms = 800): void {
    this._add(emitter);
    setTimeout(() => {
      try { emitter.stop(); emitter.destroy(); this.engine.proton.removeEmitter(emitter); } catch(e) {}
      var idx = this._activeEffects.indexOf(emitter);
      if (idx >= 0) this._activeEffects.splice(idx, 1);
    }, ms);
  }

  /** Rain — diagonal falling drops */
  rain(intensity = 0.6): any {
    var w = this.engine.config.width, h = this.engine.config.height;
    var rate = Math.floor(10 + intensity * 40);
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(rate, rate + 10), new Proton.Span(0.01, 0.02));
    emitter.addInitialize(new Proton.Life(0.6, 1.2));
    emitter.addInitialize(new Proton.Radius(1, 2));
    emitter.addInitialize(new Proton.Position(new Proton.LineZone(0, -20, w, -20)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(4, 8), new Proton.Span(250, 280), 'polar'));
    emitter.addBehaviour(new Proton.Alpha(0.5, 0.1));
    emitter.addBehaviour(new Proton.Color('#aaccff'));
    emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(-50, -50, w + 100, h + 50), 'dead'));
    emitter.p.x = 0; emitter.p.y = 0;
    emitter.emit();
    return this._add(emitter);
  }

  /** Snow — soft fluttering snowflakes */
  snow(density = 0.5): any {
    var w = this.engine.config.width, h = this.engine.config.height;
    var rate = Math.floor(5 + density * 20);
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(rate, rate + 5), new Proton.Span(0.05, 0.1));
    emitter.addInitialize(new Proton.Life(3, 6));
    emitter.addInitialize(new Proton.Radius(2, 5));
    emitter.addInitialize(new Proton.Position(new Proton.LineZone(0, -20, w, -20)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(260, 280), 'polar'));
    emitter.addBehaviour(new Proton.Alpha(0.8, 0.2));
    emitter.addBehaviour(new Proton.Color('#ffffff'));
    emitter.addBehaviour(new Proton.RandomDrift(15, 5, 0.1));
    emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(-50, -50, w + 100, h + 50), 'dead'));
    emitter.p.x = 0; emitter.p.y = 0;
    emitter.emit();
    return this._add(emitter);
  }

  /** Fire — flickering flames at a point */
  fire(x: number, y: number, scale = 1): any {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(4, 8), new Proton.Span(0.03, 0.06));
    emitter.addInitialize(new Proton.Life(0.3, 0.8));
    emitter.addInitialize(new Proton.Radius(5 * scale, 15 * scale));
    emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, 10 * scale)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(2, 5), new Proton.Span(85, 95), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 0.2));
    emitter.addBehaviour(new Proton.Alpha(0.9, 0));
    emitter.addBehaviour(new Proton.Color('#ff6600', '#220000'));
    emitter.addBehaviour(new Proton.RandomDrift(3, 1, 0.05));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Smoke — rising expanding puffs */
  smoke(x: number, y: number): any {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(2, 4), new Proton.Span(0.1, 0.2));
    emitter.addInitialize(new Proton.Life(1.5, 3));
    emitter.addInitialize(new Proton.Radius(8, 20));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(80, 100), 'polar'));
    emitter.addBehaviour(new Proton.Scale(0.5, 2));
    emitter.addBehaviour(new Proton.Alpha(0.5, 0));
    emitter.addBehaviour(new Proton.Color('#666666', '#111111'));
    emitter.addBehaviour(new Proton.RandomDrift(8, 2, 0.1));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Explosion — radial burst (one-shot) */
  explosion(x: number, y: number, color = '#ff4400'): void {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(30, 60), 1);
    emitter.addInitialize(new Proton.Life(0.4, 1.0));
    emitter.addInitialize(new Proton.Radius(3, 12));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(4, 12), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1.2, 0.1));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Color(color, '#000000'));
    emitter.addBehaviour(new Proton.Rotate(new Proton.Span(0, 360), new Proton.Span(-4, 4), 'add'));
    emitter.addBehaviour(new Proton.Gravity(3));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 1000);
  }

  /** Sparkle — radial shimmer (collect item, powerup) */
  sparkle(x: number, y: number): void {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(15, 30), 1);
    emitter.addInitialize(new Proton.Life(0.4, 0.8));
    emitter.addInitialize(new Proton.Radius(2, 7));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(3, 8), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1.2, 0));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Color('#ffff00', '#ffffff'));
    emitter.addBehaviour(new Proton.Rotate(new Proton.Span(0, 360), 'add'));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 800);
  }

  /** Dust puff — small burst on jump/land */
  dust(x: number, y: number): void {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(5, 10), 1);
    emitter.addInitialize(new Proton.Life(0.15, 0.3));
    emitter.addInitialize(new Proton.Radius(3, 8));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 4), new Proton.Span(60, 120), 'polar'));
    emitter.addBehaviour(new Proton.Scale(0.8, 0.1));
    emitter.addBehaviour(new Proton.Alpha(0.6, 0));
    emitter.addBehaviour(new Proton.Color('#ccaa88'));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit('once');
    this._burst(emitter, 500);
  }

  /** Trail — follows a moving target */
  trail(target: any, color = '#44aaff'): any {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(3, 6), new Proton.Span(0.02, 0.04));
    emitter.addInitialize(new Proton.Life(0.2, 0.5));
    emitter.addInitialize(new Proton.Radius(3, 8));
    emitter.addBehaviour(new Proton.Scale(1, 0.1));
    emitter.addBehaviour(new Proton.Alpha(0.7, 0));
    emitter.addBehaviour(new Proton.Color(color, '#000000'));
    if (target) { emitter.p.x = target.x; emitter.p.y = target.y; }
    emitter.emit();
    // Store target reference for position updates
    (emitter as any)._trailTarget = target;
    return this._add(emitter);
  }

  /** Ambient particles — theme-appropriate background effects */
  ambient(type: 'fireflies' | 'embers' | 'dust' | 'leaves' | 'pollen'): any {
    var w = this.engine.config.width, h = this.engine.config.height;
    var emitter = new Proton.Emitter();

    switch (type) {
      case 'fireflies':
        emitter.rate = new Proton.Rate(new Proton.Span(1, 3), new Proton.Span(0.3, 0.8));
        emitter.addInitialize(new Proton.Life(3, 8));
        emitter.addInitialize(new Proton.Radius(2, 4));
        emitter.addInitialize(new Proton.Position(new Proton.RectZone(0, h * 0.3, w, h)));
        emitter.addBehaviour(new Proton.Alpha(0, 1, Infinity, Proton.easeInOutSine));
        emitter.addBehaviour(new Proton.Color('#ffff44'));
        emitter.addBehaviour(new Proton.RandomDrift(20, 15, 0.2));
        break;
      case 'embers':
        emitter.rate = new Proton.Rate(new Proton.Span(2, 4), new Proton.Span(0.1, 0.3));
        emitter.addInitialize(new Proton.Life(1, 3));
        emitter.addInitialize(new Proton.Radius(1, 3));
        emitter.addInitialize(new Proton.Position(new Proton.LineZone(0, h + 10, w, h + 10)));
        emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 4), new Proton.Span(80, 100), 'polar'));
        emitter.addBehaviour(new Proton.Alpha(0.9, 0));
        emitter.addBehaviour(new Proton.Color('#ff6600', '#ffaa00'));
        emitter.addBehaviour(new Proton.RandomDrift(10, 3, 0.1));
        break;
      case 'dust':
        emitter.rate = new Proton.Rate(new Proton.Span(1, 2), new Proton.Span(0.5, 1));
        emitter.addInitialize(new Proton.Life(4, 8));
        emitter.addInitialize(new Proton.Radius(1, 3));
        emitter.addInitialize(new Proton.Position(new Proton.RectZone(0, 0, w, h)));
        emitter.addBehaviour(new Proton.Alpha(0.2, 0.05));
        emitter.addBehaviour(new Proton.Color('#ddccaa'));
        emitter.addBehaviour(new Proton.RandomDrift(5, 3, 0.05));
        break;
      case 'leaves':
        emitter.rate = new Proton.Rate(new Proton.Span(1, 2), new Proton.Span(0.5, 1.5));
        emitter.addInitialize(new Proton.Life(4, 8));
        emitter.addInitialize(new Proton.Radius(4, 8));
        emitter.addInitialize(new Proton.Position(new Proton.LineZone(-20, -20, w + 20, -20)));
        emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(240, 280), 'polar'));
        emitter.addBehaviour(new Proton.Alpha(0.7, 0.1));
        emitter.addBehaviour(new Proton.Color('#66aa33', '#aa6622'));
        emitter.addBehaviour(new Proton.Rotate('random', 'random'));
        emitter.addBehaviour(new Proton.RandomDrift(15, 5, 0.1));
        emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(-50, -50, w + 100, h + 50), 'dead'));
        break;
      case 'pollen':
        emitter.rate = new Proton.Rate(new Proton.Span(1, 2), new Proton.Span(0.5, 1));
        emitter.addInitialize(new Proton.Life(5, 10));
        emitter.addInitialize(new Proton.Radius(1, 2));
        emitter.addInitialize(new Proton.Position(new Proton.RectZone(0, 0, w, h)));
        emitter.addBehaviour(new Proton.Alpha(0.4, 0.1));
        emitter.addBehaviour(new Proton.Color('#ffffcc'));
        emitter.addBehaviour(new Proton.RandomDrift(8, 4, 0.08));
        break;
    }

    emitter.p.x = 0; emitter.p.y = 0;
    emitter.emit();
    return this._add(emitter);
  }

  /** Magic vortex — swirling color-shifting particles */
  magic(x: number, y: number, color = '#aa44ff'): any {
    var emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(5, 10), new Proton.Span(0.05, 0.1));
    emitter.addInitialize(new Proton.Life(0.5, 1.5));
    emitter.addInitialize(new Proton.Radius(3, 8));
    emitter.addInitialize(new Proton.Position(new Proton.CircleZone(0, 0, 20)));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(1, 3), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(new Proton.Scale(1, 0));
    emitter.addBehaviour(new Proton.Alpha(0.8, 0));
    emitter.addBehaviour(new Proton.Color(color, '#ffffff'));
    emitter.addBehaviour(new Proton.Cyclone(new Proton.Span(2, 5)));
    emitter.p.x = x; emitter.p.y = y;
    emitter.emit();
    return this._add(emitter);
  }

  /** Shockwave — pixi-filters ShockwaveFilter + GSAP */
  shockwave(x: number, y: number): void {
    var gsap = (window as any).gsap;
    var container = this.engine.world;
    if (!PIXI.filters || !PIXI.filters.ShockwaveFilter || !gsap) return;
    var filter = new PIXI.filters.ShockwaveFilter({
      center: [x / (container.width || 800), y / (container.height || 600)],
      speed: 400, amplitude: 20, wavelength: 120, brightness: 1.2, radius: -1,
    });
    if (!container.filters) container.filters = [];
    container.filters.push(filter);
    gsap.to(filter, {
      time: 1.5, duration: 0.8, ease: 'power2.out',
      onComplete: function() {
        var idx = container.filters ? container.filters.indexOf(filter) : -1;
        if (idx >= 0) container.filters.splice(idx, 1);
      }
    });
  }

  /** Remove all active continuous effects */
  destroyAll(): void {
    for (var i = 0; i < this._activeEffects.length; i++) {
      try {
        this._activeEffects[i].stop();
        this._activeEffects[i].destroy();
        this.engine.proton.removeEmitter(this._activeEffects[i]);
      } catch(e) {}
    }
    this._activeEffects = [];
  }
}

// ---------------------------------------------------------------------------
// PhysicsSystem — engine.physics.* namespace
// ---------------------------------------------------------------------------

export class PhysicsSystem {
  private engine: Engine2D;
  bodies: any[] = [];
  private _colliders: Array<{ a: string; b: string; callback?: Function }> = [];
  private _overlaps: Array<{ a: string; b: string; callback?: Function }> = [];

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Set world gravity */
  gravity(value: number): void {
    this.engine.config.gravity = value;
  }

  /** Add a physics body to an object */
  addBody(obj: any, config: any = {}): any {
    var body = {
      x: obj.x || 0, y: obj.y || 0,
      vx: 0, vy: 0, ax: 0, ay: 0,
      hw: (config.width || 32) / 2,
      hh: (config.height || 32) / 2,
      mass: config.mass ?? 1,
      friction: config.friction ?? 0.2,
      bounce: config.bounce ?? 0,
      isStatic: config.isStatic ?? false,
      isOneWay: config.isOneWay ?? false,
      isSensor: config.isSensor ?? false,
      enabled: true,
      onGround: false,
      onWall: null,
      onCeiling: false,
      tag: config.tag || '',
      sprite: obj,
      userData: config.userData || null,
    };
    obj.body = body;
    this.bodies.push(body);
    return body;
  }

  /** Register collision handler between two tags */
  collider(tagA: string, tagB: string, callback?: Function): void {
    this._colliders.push({ a: tagA, b: tagB, callback });
  }

  /** Register overlap (sensor) handler between two tags */
  overlap(tagA: string, tagB: string, callback?: Function): void {
    this._overlaps.push({ a: tagA, b: tagB, callback });
  }

  /** Remove a body */
  removeBody(body: any): void {
    var idx = this.bodies.indexOf(body);
    if (idx >= 0) this.bodies.splice(idx, 1);
  }
}

// ---------------------------------------------------------------------------
// SceneSystem — engine.scene.* namespace
// ---------------------------------------------------------------------------

export class SceneSystem {
  private engine: Engine2D;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Switch to a named scene */
  switch(name: string, data?: any): void {
    this.engine.switchScene(name, data);
  }

  /** Add a scene to the engine */
  add(scene: GameScene): void {
    this.engine.addScene(scene);
  }
}

// ---------------------------------------------------------------------------
// UISystem — engine.ui.* namespace
// ---------------------------------------------------------------------------

export class UISystem {
  private engine: Engine2D;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  // --- Backward compat: proxy PIXI.Container methods to uiLayer ---
  addChild(child: any): any { return this.engine.uiLayer.addChild(child); }
  removeChild(child: any): void { this.engine.uiLayer.removeChild(child); }
  removeChildren(): void { this.engine.uiLayer.removeChildren(); }

  /** Create a health bar UI element */
  healthBar(x: number, y: number, config: any = {}): any {
    var maxHp = config.maxHealth || 3;
    var w = config.width || 200;
    var h = config.height || 20;
    var container = new PIXI.Container();
    container.x = x; container.y = y;

    // Background
    var bg = new PIXI.Graphics();
    bg.roundRect(0, 0, w, h, 4);
    bg.fill({ color: config.bgColor || 0x333333 });
    container.addChild(bg);

    // Fill bar
    var fill = new PIXI.Graphics();
    fill.roundRect(0, 0, w, h, 4);
    fill.fill({ color: config.color || 0x44cc44 });
    container.addChild(fill);

    // Border
    var border = new PIXI.Graphics();
    border.roundRect(0, 0, w, h, 4);
    border.stroke({ color: config.borderColor || 0xffffff, width: 2 });
    container.addChild(border);

    container._hp = maxHp;
    container._maxHp = maxHp;
    container._fill = fill;
    container._barWidth = w;
    container.setHealth = function(hp: number) {
      this._hp = Math.max(0, Math.min(hp, this._maxHp));
      var pct = this._hp / this._maxHp;
      this._fill.scale.x = pct;
    };

    this.engine.uiLayer.addChild(container);
    return container;
  }

  /** Create an animated score counter */
  score(x: number, y: number, config: any = {}): any {
    var prefix = config.prefix || 'Score: ';
    var textObj = new PIXI.Text({
      text: prefix + '0',
      style: {
        fontFamily: 'Arial', fontSize: config.fontSize || 28,
        fill: config.color || 0xffffff,
        stroke: { color: 0x000000, width: 4 },
      }
    });
    textObj.x = x; textObj.y = y;
    textObj._score = 0;
    textObj._prefix = prefix;
    textObj.setScore = function(v: number) {
      this._score = v;
      this.text = this._prefix + v;
      if (config.juiceOnChange !== false) {
        var eng = (this as any)._engine;
        if (eng) eng.juice.pop(this);
      }
    };
    textObj.addScore = function(v: number) { this.setScore(this._score + v); };
    textObj._engine = this.engine;

    this.engine.uiLayer.addChild(textObj);
    return textObj;
  }

  /** Create a countdown/count-up timer */
  timer(x: number, y: number, config: any = {}): any {
    var textObj = new PIXI.Text({
      text: '0:00',
      style: {
        fontFamily: 'Arial', fontSize: config.fontSize || 28,
        fill: config.color || 0xffffff,
        stroke: { color: 0x000000, width: 4 },
      }
    });
    textObj.x = x; textObj.y = y;
    textObj._seconds = config.seconds || 0;
    textObj._countDown = config.countDown || false;
    textObj._elapsed = 0;
    textObj._urgencyColor = config.urgencyColor || 0xff4444;
    textObj._urgencyThreshold = config.urgencyThreshold || 10;
    textObj._normalColor = config.color || 0xffffff;
    textObj._running = false;

    textObj.start = function() { this._running = true; };
    textObj.stop = function() { this._running = false; };
    textObj.tick = function(dt: number) {
      if (!this._running) return;
      if (this._countDown) {
        this._seconds = Math.max(0, this._seconds - dt);
      } else {
        this._seconds += dt;
      }
      var m = Math.floor(this._seconds / 60);
      var s = Math.floor(this._seconds % 60);
      this.text = m + ':' + (s < 10 ? '0' : '') + s;
      // Urgency coloring
      if (this._countDown && this._seconds <= this._urgencyThreshold) {
        this.style.fill = this._urgencyColor;
      } else {
        this.style.fill = this._normalColor;
      }
    };

    this.engine.uiLayer.addChild(textObj);
    return textObj;
  }

  /** Create a text UI element */
  text(x: number, y: number, text: string, style?: any): any {
    var t = this.engine.spawn.text(x, y, text, style);
    this.engine.uiLayer.addChild(t);
    return t;
  }
}

// ---------------------------------------------------------------------------
// AssetsSystem — engine.assets.* namespace
// ---------------------------------------------------------------------------

export class AssetsSystem {
  private engine: Engine2D;
  private _cache: Map<string, any> = new Map();

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /** Load and return a sprite from a texture key/URL */
  async load(key: string, url: string): Promise<any> {
    try {
      var tex = await PIXI.Assets.load(url);
      this._cache.set(key, tex);
      return tex;
    } catch(e) {
      console.warn('[Assets] Failed to load:', key, url, e);
      return null;
    }
  }

  /** Get a loaded texture as a new Sprite */
  sprite(key: string): any {
    var tex = this._cache.get(key);
    if (!tex) { console.warn('[Assets] Not loaded:', key); return null; }
    var spr = new PIXI.Sprite(tex);
    spr.anchor.set(0.5);
    return spr;
  }

  /** Get a loaded spritesheet animation as AnimatedSprite */
  animation(key: string, animName?: string): any {
    var sheet = this._cache.get(key);
    if (!sheet || !sheet.animations) { console.warn('[Assets] No animation:', key); return null; }
    var frames = animName ? sheet.animations[animName] : Object.values(sheet.animations)[0];
    if (!frames) return null;
    var anim = new PIXI.AnimatedSprite(frames as any);
    anim.anchor.set(0.5);
    anim.animationSpeed = 0.15;
    anim.play();
    return anim;
  }

  /** Get a raw texture by key */
  texture(key: string): any {
    return this._cache.get(key) || null;
  }

  /** Check if a key is loaded */
  has(key: string): boolean {
    return this._cache.has(key);
  }
}

// ---------------------------------------------------------------------------
// FeatureManager — composable feature snippet runtime
// ---------------------------------------------------------------------------

interface FeatureEntry {
  runtime: any;       // FeatureRuntime instance
  config: Record<string, any>;
  dependencies: string[];
}

export class FeatureManager {
  private engine: Engine2D;
  private _features: Map<string, FeatureEntry> = new Map();
  private _initOrder: string[] = [];   // topologically sorted init order
  private _initialized = false;

  constructor(engine: Engine2D) {
    this.engine = engine;
  }

  /**
   * Register a feature snippet.
   * @param id        unique feature id (e.g. "double-jump")
   * @param factory   function(config) => FeatureRuntime
   * @param config    parameter values for this feature instance
   * @param deps      IDs of features this one depends on
   */
  register(id: string, factory: (config: Record<string, any>) => any, config: Record<string, any> = {}, deps: string[] = []): void {
    if (this._features.has(id)) {
      console.warn('[FeatureManager] Already registered:', id);
      return;
    }
    var runtime = factory(config);
    runtime.id = id;
    this._features.set(id, { runtime: runtime, config: config, dependencies: deps });
    this._initOrder = [];  // invalidate cached order
  }

  /**
   * Initialize all registered features in dependency order.
   * Call once after all features are registered.
   */
  initAll(): void {
    if (this._initialized) return;
    this._resolveOrder();
    for (var i = 0; i < this._initOrder.length; i++) {
      var entry = this._features.get(this._initOrder[i]);
      if (entry && entry.runtime.init) {
        try {
          entry.runtime.init(this.engine, entry.config);
        } catch(e) {
          console.error('[FeatureManager] init failed:', this._initOrder[i], e);
        }
      }
    }
    this._initialized = true;
    console.log('[FeatureManager] Initialized', this._initOrder.length, 'features:', this._initOrder.join(', '));
  }

  /** Called every frame by the engine game loop */
  updateAll(dt: number): void {
    if (!this._initialized) return;
    for (var i = 0; i < this._initOrder.length; i++) {
      var entry = this._features.get(this._initOrder[i]);
      if (entry && entry.runtime.update) {
        try {
          entry.runtime.update(this.engine, dt);
        } catch(e) {
          // Don't spam — log once then silence
          console.error('[FeatureManager] update error:', this._initOrder[i], e);
          entry.runtime.update = null;  // disable broken updater
        }
      }
    }
  }

  /** Broadcast an event to all features */
  emit(event: string, data?: any): void {
    this._features.forEach(function(entry) {
      if (entry.runtime.onEvent) {
        try {
          entry.runtime.onEvent(event, data);
        } catch(e) {
          console.error('[FeatureManager] event error:', entry.runtime.id, event, e);
        }
      }
    });
  }

  /** Check if a feature is registered */
  has(id: string): boolean {
    return this._features.has(id);
  }

  /** Get a feature runtime by id (for inter-feature communication) */
  get(id: string): any {
    var entry = this._features.get(id);
    return entry ? entry.runtime : null;
  }

  /** Number of registered features */
  get count(): number {
    return this._features.size;
  }

  /** Destroy all features in reverse init order */
  destroy(): void {
    for (var i = this._initOrder.length - 1; i >= 0; i--) {
      var entry = this._features.get(this._initOrder[i]);
      if (entry && entry.runtime.destroy) {
        try {
          entry.runtime.destroy();
        } catch(e) {
          console.error('[FeatureManager] destroy error:', this._initOrder[i], e);
        }
      }
    }
    this._features.clear();
    this._initOrder = [];
    this._initialized = false;
  }

  /**
   * Topological sort — ensures dependencies init before dependents.
   * Detects circular dependencies and warns.
   */
  private _resolveOrder(): void {
    var visited: Set<string> = new Set();
    var visiting: Set<string> = new Set();  // cycle detection
    var order: string[] = [];
    var features = this._features;

    function visit(id: string): void {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        console.warn('[FeatureManager] Circular dependency detected at:', id);
        return;
      }
      visiting.add(id);
      var entry = features.get(id);
      if (entry) {
        for (var j = 0; j < entry.dependencies.length; j++) {
          var dep = entry.dependencies[j];
          if (features.has(dep)) {
            visit(dep);
          } else {
            console.warn('[FeatureManager] Missing dependency:', dep, 'required by', id);
          }
        }
      }
      visiting.delete(id);
      visited.add(id);
      order.push(id);
    }

    features.forEach(function(_entry, id) {
      visit(id);
    });

    this._initOrder = order;
  }
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

  // --- Clean API aliases (engine.juice.pop, engine.juice.shake, etc.) ---

  /** Alias: scalePop → pop */
  pop(obj: any, scale = 1.3, duration = 0.2): void { this.scalePop(obj, scale, duration); }

  /** Alias: screenShake → shake (takes container) */
  shake(container: any, intensity = 8, duration = 0.3): void { this.screenShake(container, intensity, duration); }

  /** Alias: colorFlash → flash */
  flash(obj: any, color = 0xffffff, duration = 0.15): void { this.colorFlash(obj, color, duration); }

  /** Alias: squashStretch → squash */
  squash(obj: any, squashY = 0.7, stretchY = 1.15): void { this.squashStretch(obj, squashY, stretchY); }

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
