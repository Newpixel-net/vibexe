/**
 * Game Compiler — Server-side esbuild compilation for lightweight runtime.
 *
 * Replaces sandpack's in-browser bundler with server-side esbuild.
 * Produces an optimized IIFE bundle from GameScene3D.ts + modules.
 *
 * Based on the virtual-plugin pattern from builder.ts (deployment pipeline).
 */

import * as esbuild from "esbuild";
import { ALL_MODULE_MANIFESTS } from "@vibexe-ai/vibexe-engine";
import { patchGameFiles } from "./code-patcher";
import { generateRuntimeBootstrap } from "./runtime-bootstrap";

// In-memory LRU cache for compiled bundles
const bundleCache = new Map<string, { bundle: string; timestamp: number }>();
const CACHE_MAX = 50;
const CACHE_TTL = 60_000; // 60s

function normalizePath(p: string): string {
	const parts = p.split("/");
	const out: string[] = [];
	for (const seg of parts) {
		if (seg === "." || seg === "") continue;
		if (seg === "..") {
			if (out.length > 0) out.pop();
		} else {
			out.push(seg);
		}
	}
	return out.join("/");
}

function createVirtualPlugin(files: Map<string, string>, enabledModuleIds?: string[]): esbuild.Plugin {
	// Shim modules: Three.js + CANNON.js + Rapier.js + React as window globals
	const shims: Record<string, string> = {
		three: "module.exports = window.THREE;",
		"cannon-es": "module.exports = window.CANNON;",
		"@dimforge/rapier3d-compat": "module.exports = window.RAPIER || {};",
		react: "module.exports = window.React || {};",
		"react-dom": "module.exports = window.ReactDOM || {};",
		"react-dom/client": "module.exports = { createRoot: (window.ReactDOM||{}).createRoot };",
		"react/jsx-runtime": "module.exports = { jsx: (window.React||{}).createElement, jsxs: (window.React||{}).createElement, Fragment: (window.React||{}).Fragment };",
		"react/jsx-dev-runtime": "module.exports = { jsxDEV: (window.React||{}).createElement, Fragment: (window.React||{}).Fragment };",
	};

	// Add @vibexe/* module shims — only shim enabled modules with full runtimeCode,
	// disabled modules get empty shims (saves memory: sky-weather alone is ~70KB)
	const enabledSet = new Set(enabledModuleIds || []);
	for (const mod of ALL_MODULE_MANIFESTS) {
		const pkgName = `@vibexe/${mod.id}`;
		if (!shims[pkgName]) {
			if (enabledSet.has(mod.id)) {
				if (!mod.runtimeCode) {
					console.warn(`[GameCompiler] Module "${mod.id}" is enabled but has no runtimeCode`);
				}
				shims[pkgName] = mod.runtimeCode || "module.exports = {};";
			} else {
				// Disabled module — empty shim prevents "not found" errors if AI code imports it
				shims[pkgName] = "module.exports = {};";
			}
		}
	}

	// Also add @vibexe/sdk shim
	shims["@vibexe/sdk"] = `
		var VibexeApp = window.VibexeApp || function(){};
		module.exports = { VibexeApp: VibexeApp, default: VibexeApp };
	`;

	return {
		name: "game-virtual-fs",
		setup(build) {
			// Resolve npm packages (bare imports)
			build.onResolve({ filter: /^[^./]/ }, (args) => {
				if (shims[args.path]) {
					return { path: args.path, namespace: "shim" };
				}
				// Check virtual files (bare paths like "components/Foo")
				for (const ext of ["", ".tsx", ".ts", ".jsx", ".js"]) {
					if (files.has(args.path + ext))
						return { path: args.path + ext, namespace: "virtual" };
				}
				// Unknown package → empty module
				return { path: args.path, namespace: "shim" };
			});

			// Resolve relative imports
			build.onResolve({ filter: /^\./ }, (args) => {
				const dir = args.importer ? args.importer.replace(/[^/]+$/, "") : "";
				const base = normalizePath(dir + args.path);
				const exts = [
					"", ".tsx", ".ts", ".jsx", ".js",
					"/index.tsx", "/index.ts", "/index.jsx", "/index.js",
				];
				for (const ext of exts) {
					if (files.has(base + ext))
						return { path: base + ext, namespace: "virtual" };
				}
				// Try without directory prefix
				const bare = args.path.replace(/^\.\//, "");
				for (const ext of exts) {
					if (files.has(bare + ext))
						return { path: bare + ext, namespace: "virtual" };
				}
				return { path: args.path, namespace: "shim" };
			});

			// Load shim modules
			build.onLoad({ filter: /.*/, namespace: "shim" }, (args) => ({
				contents: shims[args.path] || "module.exports = {};",
				loader: "js" as const,
			}));

			// Load virtual files
			build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
				const content = files.get(args.path);
				if (content === undefined)
					return { errors: [{ text: `Not found: ${args.path}` }] };
				const ext = args.path.split(".").pop() || "tsx";
				const loaders: Record<string, esbuild.Loader> = {
					tsx: "tsx", ts: "ts", jsx: "jsx", js: "js", css: "css", json: "json",
				};
				return { contents: content, loader: loaders[ext] || "tsx" };
			});
		},
	};
}

function hashContent(content: string): string {
	// Simple hash for cache key
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const chr = content.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0;
	}
	return hash.toString(36);
}

export interface CompileInput {
	files: Array<{ path: string; content: string }>;
	settings?: Record<string, unknown>;
	enabledModuleIds?: string[];
	apiOrigin?: string;
	appId?: string;
}

export interface CompileOutput {
	bundle: string;
	bootstrap: string;
	hash: string;
	errors?: string[];
	compiledMs: number;
}

export async function compileGameBundle(input: CompileInput): Promise<CompileOutput> {
	const startMs = Date.now();

	// Build the virtual filesystem
	const files = new Map<string, string>();
	for (const f of input.files) {
		// Normalize path: strip leading slash and src/ prefix (matching sandpack-adapter behavior)
		let key = f.path.startsWith("/") ? f.path.slice(1) : f.path;
		if (key.startsWith("src/")) key = key.slice(4);
		files.set(key, f.content);
	}

	// Parse settings
	const settings = input.settings || {};

	// Apply code patches (inline physics constants, spawn positions, etc.)
	patchGameFiles(files, settings as Parameters<typeof patchGameFiles>[1]);

	// Find entry point
	let entryContent = "";
	let entryPath = "";
	for (const candidate of ["index.tsx", "index.ts", "index.jsx", "index.js"]) {
		if (files.has(candidate)) {
			entryPath = candidate;
			entryContent = files.get(candidate)!;
			break;
		}
	}

	// If no index entry found, detect game project and generate a synthetic non-React entry.
	// Game projects have GameScene3D.ts + assets-3d.ts but no index.tsx (sandpack-adapter creates it).
	// The lightweight runtime doesn't use React — generate a direct bootstrap entry instead.
	if (!entryContent) {
		const gameScenePath = findFileByName(files, "GameScene3D.ts") || findFileByName(files, "GameScene3D.tsx");
		const assetsPath = findFileByName(files, "assets-3d.ts");

		if (gameScenePath) {
			entryPath = "__runtime_entry__.ts";
			entryContent = generateGameEntry(gameScenePath, assetsPath, input.enabledModuleIds);
			files.set(entryPath, entryContent);
		}
	}

	if (!entryContent) {
		return {
			bundle: "",
			bootstrap: "",
			hash: "",
			errors: ["No entry point found (index.tsx/ts/jsx/js or GameScene3D.ts)"],
			compiledMs: Date.now() - startMs,
		};
	}

	// Generate cache key from all file contents + settings + module versions
	// P6 fix: include module versions so cache busts when modules are updated
	const moduleVersions = ALL_MODULE_MANIFESTS
		.filter((m) => (input.enabledModuleIds || []).includes(m.id))
		.map((m) => `${m.id}@${m.version}`)
		.join(",");
	const cacheKey = hashContent(
		JSON.stringify(input.files.map((f) => f.content)) +
		JSON.stringify(settings) +
		JSON.stringify(input.enabledModuleIds || []) +
		moduleVersions,
	);

	// Check cache
	const cached = bundleCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		const bootstrap = generateRuntimeBootstrap({
			apiOrigin: input.apiOrigin,
			appId: input.appId,
			enabledModuleIds: input.enabledModuleIds || [],
			gameSettings: settings,
		});
		return {
			bundle: cached.bundle,
			bootstrap,
			hash: cacheKey,
			compiledMs: Date.now() - startMs,
		};
	}

	// Compile with esbuild (30s timeout to prevent hangs from circular imports)
	const COMPILE_TIMEOUT = 30_000;
	try {
		const buildPromise = esbuild.build({
			stdin: {
				contents: entryContent,
				loader: entryPath.endsWith(".tsx") ? "tsx" :
					entryPath.endsWith(".ts") ? "ts" :
					entryPath.endsWith(".jsx") ? "jsx" : "js",
				resolveDir: "/",
				sourcefile: entryPath,
			},
			bundle: true,
			format: "iife",
			target: ["es2022"],
			jsx: "transform",
			jsxFactory: "React.createElement",
			jsxFragment: "React.Fragment",
			minify: true,
			write: false,
			plugins: [createVirtualPlugin(files, input.enabledModuleIds)],
			define: {
				"process.env.NODE_ENV": '"production"',
			},
			logLevel: "silent",
		});
		const result = await Promise.race([
			buildPromise,
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("Compilation timed out")), COMPILE_TIMEOUT),
			),
		]);

		const bundle = result.outputFiles?.[0]?.text || "";
		const errors = result.errors.map((e) => e.text);

		// Cache the bundle
		if (bundleCache.size >= CACHE_MAX) {
			// Evict oldest entry
			const firstKey = bundleCache.keys().next().value;
			if (firstKey) bundleCache.delete(firstKey);
		}
		bundleCache.set(cacheKey, { bundle, timestamp: Date.now() });

		// Generate bootstrap
		const bootstrap = generateRuntimeBootstrap({
			apiOrigin: input.apiOrigin,
			appId: input.appId,
			enabledModuleIds: input.enabledModuleIds || [],
			gameSettings: settings,
		});

		return {
			bundle,
			bootstrap,
			hash: cacheKey,
			errors: errors.length > 0 ? errors : undefined,
			compiledMs: Date.now() - startMs,
		};
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			bundle: "",
			bootstrap: "",
			hash: "",
			errors: [`Compilation failed: ${msg}`],
			compiledMs: Date.now() - startMs,
		};
	}
}

/**
 * Find a file in the virtual filesystem by its basename (e.g., "GameScene3D.ts").
 * Returns the full path key if found, or null.
 */
function findFileByName(files: Map<string, string>, name: string): string | null {
	// Exact match first
	if (files.has(name)) return name;
	// Search in subdirectories
	for (const key of files.keys()) {
		if (key.endsWith(`/${name}`)) return key;
	}
	return null;
}

/**
 * Generate a synthetic non-React entry point for 3D game projects.
 *
 * Replaces the React-based Game3D.tsx + App.tsx + index.tsx pipeline with a direct
 * bootstrap that initializes Three.js, CANNON.js, and the game scene without React.
 * This works because:
 * - assets-3d.ts sets ALL factory functions on window via Object.assign(window, {...})
 * - GameScene3D.ts uses those globals directly
 * - The runtime page already loads Three.js + CANNON.js + Rapier.js as ES modules
 * - The bridge is loaded as a separate script (/api/app-builder/bridge)
 */
function generateGameEntry(gameScenePath: string, assetsPath: string | null, enabledModuleIds?: string[]): string {
	const assetsImport = assetsPath
		? `import "./${assetsPath}";`
		: '// No assets-3d.ts found — factory functions may not be available';

	const sceneImport = `import * as GameSceneModule from "./${gameScenePath}";`;

	// Generate module imports — these trigger module registration on window.__vibexe_modules__
	const moduleImports = (enabledModuleIds || [])
		.map((id) => `import "@vibexe/${id}";`)
		.join("\n");

	return `// Synthetic entry — bootstraps game without React (lightweight runtime)
${assetsImport}
${sceneImport}
${moduleImports ? `\n// Auto-import enabled modules\n${moduleImports}` : ""}

// Resolve game scene from any export pattern the AI might use
const _m = GameSceneModule as any;
const _rawScene = _m.GameScene || _m.GameScene3D || _m.gameScene || _m.default
  || Object.values(_m).find((v: any) => v && typeof v === 'object' && typeof v.init === 'function')
  || null;
const gameScene: any = typeof _rawScene === 'function' ? new (_rawScene as any)() : _rawScene;

if (!gameScene || typeof gameScene.init !== 'function') {
  console.error('[Runtime] GameScene failed to load. Exports:', Object.keys(_m));
  const errEl = document.createElement('div');
  errEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ff6b6b;font:16px/1.4 sans-serif;text-align:center;padding:20px;background:#111';
  errEl.textContent = 'Error: GameScene failed to load. Check console.';
  document.getElementById('root')!.appendChild(errEl);
} else {
  const W = window as any;
  const THREE = W.THREE;
  const CANNON = W.CANNON;
  const container = document.getElementById('root')!;
  const __gs = W.__VIBEXE_GAME_SETTINGS__ || {};
  const __perf = __gs.performance || {};

  // ===== Audio Singleton =====
  let _audioCtx: AudioContext | null = null;
  let _masterGain: GainNode | null = null;
  let _musicGain: GainNode | null = null;
  let _sfxGain: GainNode | null = null;
  let _currentMusic: { el: HTMLAudioElement; fadeTimer?: any } | null = null;
  let _musicMutedVol = 0;

  function _getAudioContext(): AudioContext {
    if (!_audioCtx) {
      const __gsAudio = (__gs.audio) || {};
      const audioEnabled = __gsAudio.enabled !== false;
      _audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      _masterGain = _audioCtx!.createGain();
      _masterGain!.gain.value = audioEnabled ? (__gsAudio.masterVolume ?? 0.8) : 0;
      _masterGain!.connect(_audioCtx!.destination);
      _musicGain = _audioCtx!.createGain();
      _musicGain!.gain.value = __gsAudio.musicVolume ?? 0.5;
      _musicGain!.connect(_masterGain!);
      _sfxGain = _audioCtx!.createGain();
      _sfxGain!.gain.value = __gsAudio.sfxVolume ?? 1.0;
      _sfxGain!.connect(_masterGain!);
      try {
        const L = _audioCtx!.listener;
        if ((L as any).forwardX) {
          (L as any).forwardX.value = 0; (L as any).forwardY.value = 0; (L as any).forwardZ.value = -1;
          (L as any).upX.value = 0; (L as any).upY.value = 1; (L as any).upZ.value = 0;
        } else if ((L as any).setOrientation) {
          (L as any).setOrientation(0, 0, -1, 0, 1, 0);
        }
      } catch {}
    }
    if (_audioCtx!.state === 'suspended') _audioCtx!.resume();
    return _audioCtx!;
  }
  W._getAudioContext = _getAudioContext;
  W._audioCtx = null;

  function muteMusic(): void {
    if (_currentMusic) { _musicMutedVol = _currentMusic.el.volume; _currentMusic.el.volume = 0; }
  }
  function unmuteMusic(): void {
    if (_currentMusic) { _currentMusic.el.volume = _musicMutedVol || 0.5; }
  }
  W.muteMusic = muteMusic;
  W.unmuteMusic = unmuteMusic;

  // Store audio config for debug handler
  const __gsAudio = __gs.audio || {};
  W.__vibexe_audio__ = {
    enabled: __gsAudio.enabled !== false,
    masterVolume: __gsAudio.masterVolume ?? 0.8,
    musicVolume: __gsAudio.musicVolume ?? 0.5,
    sfxVolume: __gsAudio.sfxVolume ?? 0.7,
  };

  // ===== Renderer (WebGPU with auto-fallback to WebGL 2) =====
  // NOTE: renderer.init() is async (WebGPU) — deferred to the async IIFE below
  // so esbuild can use IIFE output format (top-level await not supported in IIFE)
  let renderer: any;
  let __rendererNeedsInit = false;
  if (THREE.WebGPURenderer) {
    renderer = new THREE.WebGPURenderer({
      antialias: __perf.antialias === true,
      powerPreference: 'high-performance'
    });
    __rendererNeedsInit = true;
  } else {
    renderer = new THREE.WebGLRenderer({
      antialias: __perf.antialias === true,
      alpha: false, stencil: false, powerPreference: 'high-performance'
    });
    console.log('[Runtime] WebGLRenderer fallback');
  }
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(__perf.pixelRatio || window.devicePixelRatio, 1.0));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);
  W.__vibexe_renderer__ = renderer;
  W.__vibexe_webgpu__ = !!THREE.WebGPURenderer && renderer.constructor === THREE.WebGPURenderer;

  // ===== Camera =====
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(__gs.camera?.fov ?? 60, aspect, 0.1, 1000);
  camera.position.set(0, 8, 15);
  camera.lookAt(0, 2, 0);
  W.__vibexe_camera__ = camera;

  const clock = new THREE.Clock();

  // ===== Scene =====
  const scene = new THREE.Scene();
  const __envBg = __gs.environment?.backgroundColor;
  scene.background = new THREE.Color(__envBg || '#87CEEB');
  W.__vibexe_scene__ = scene;

  // ===== Lighting =====
  const hemi = new THREE.HemisphereLight(
    __gs.environment?.hemisphereSkyColor || '#eef4ff',
    __gs.environment?.hemisphereGroundColor || '#886644',
    __gs.environment?.hemisphereIntensity ?? 0.5
  );
  hemi.name = '__default_hemi__';
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(
    __gs.environment?.ambientLightColor || '#ffffff',
    __gs.environment?.ambientLightIntensity ?? 0.25
  );
  ambient.name = '__default_ambient__';
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(
    __gs.environment?.sunLightColor || '#fff8ee',
    __gs.environment?.sunLightIntensity ?? 0.7
  );
  sun.name = '__default_sun__';
  sun.position.set(8, 20, 10);
  sun.castShadow = true;
  const __shSizes: Record<string, number> = { low: 256, medium: 512, high: 1024 };
  const __shSize = __shSizes[__gs.environment?.shadowQuality || 'medium'] || 512;
  sun.shadow.mapSize.set(__shSize, __shSize);
  const __hasTerrain = !!__gs.terrain?.enabled;
  // Shadow frustum follows player — only need ~40 unit radius (not full terrain)
  const __shExt = __hasTerrain ? 40 : 20;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = __hasTerrain ? 150 : 50;
  sun.shadow.camera.left = -__shExt;
  sun.shadow.camera.right = __shExt;
  sun.shadow.camera.top = __shExt;
  sun.shadow.camera.bottom = -__shExt;
  if (__hasTerrain) sun.position.set(40, 80, 40);
  sun.shadow.bias = -0.001;
  scene.add(sun);

  // ===== Fog =====
  if (__gs.environment?.fogEnabled) {
    const fogColor = __gs.environment?.fogColor || __envBg || '#87CEEB';
    if (__gs.environment?.fogType === 'exponential') {
      scene.fog = new THREE.FogExp2(fogColor, __gs.environment?.fogDensity ?? 0.02);
    } else {
      scene.fog = new THREE.Fog(fogColor, __gs.environment?.fogNear ?? 30, __gs.environment?.fogFar ?? 100);
    }
  }

  // ===== Physics World =====
  const _createPhysicsWorld = W.createPhysicsWorld;
  const _createPhysicsGround = W.createPhysicsGround;
  const _GRAVITY = W.GRAVITY_3D ?? __gs.physics?.gravity ?? -38;
  if (_createPhysicsWorld) {
    const world = _createPhysicsWorld(_GRAVITY);
    if (world && _createPhysicsGround) _createPhysicsGround(world);
    W.__vibexe_world__ = world;
    let __pw = world;
    try {
      Object.defineProperty(gameScene, 'world', {
        get() { return __pw; },
        set(val: any) { if (val && typeof val.step === 'function') __pw = val; },
        configurable: true, enumerable: true,
      });
    } catch { (gameScene as any).world = world; }
  }

  // ===== Rapier Physics World (parallel — migration from CANNON) =====
  const _RAPIER = W.RAPIER;
  if (_RAPIER) {
    try {
      const rapierWorld = new _RAPIER.World({ x: 0.0, y: _GRAVITY, z: 0.0 });
      W.__vibexe_rapierWorld__ = rapierWorld;
      // Map of Rapier rigid body handles → Three.js meshes (for sync loop)
      W.__vibexe_rapierBodyMap__ = new Map();
      console.log('[Runtime] Rapier world created, gravity:', _GRAVITY);
    } catch (_rapierWorldErr: any) {
      console.warn('[Runtime] Rapier world creation failed:', _rapierWorldErr);
    }
  }

  // ===== Expose Factories =====
  W.__vibexeFactories = {
    createPlatform3D: W.createPlatform3D,
    createCollectible3D: W.createCollectible3D,
    createPlayer3D: W.createPlayer3D,
    createBarrier3D: W.createBarrier3D,
    createDecoration3D: W.createDecoration3D,
    createAnimatedCharacter3D: W.createAnimatedCharacter3D,
  };
  W.__vibexe_createAnimatedCharacter3D = W.createAnimatedCharacter3D;
  W.__vibexe_createCharacterController3D = W.createCharacterController3D;
  W.__vibexe_createPhysicsBody = W.createPhysicsBody;

  // Inject scene/camera/renderer on gameScene
  (gameScene as any).scene = scene;
  (gameScene as any).camera = camera;
  (gameScene as any).renderer = renderer;
  (gameScene as any).container = container;

  // ===== Auto-Physics =====
  // Creates CANNON static Box bodies for platforms/barriers that don't have explicit physics
  function _autoPhysics() {
    const _apW = W.__vibexe_world__;
    if (!_apW || !CANNON || !THREE || !scene) return;
    const _apSolid: Record<string, boolean> = { platform: true, barrier: true };
    const _apSkip: Record<string, boolean> = { collectible: true, decoration: true, player: true, AnimatedCharacter: true, character: true };
    let _apCreated = 0;
    scene.traverse((obj: any) => {
      if (!obj.isMesh && !(obj.isGroup && obj.children?.length > 0)) return;
      if (obj.userData?.__physicsBody) return;
      let vType = obj.userData?.vibexeType;
      if (!vType && obj.name) {
        if (obj.name.startsWith('Platform_') || obj.name.startsWith('platform_')) vType = 'platform';
        else if (obj.name.startsWith('Barrier_') || obj.name.startsWith('barrier_') || obj.name.indexOf('Block') >= 0) vType = 'barrier';
        else if (obj.name.startsWith('Collectible_')) vType = 'collectible';
        else if (obj.name.startsWith('Decoration_')) vType = 'decoration';
        else if (obj.name.startsWith('Character_') || obj.name.startsWith('Player_')) vType = 'player';
      }
      if (!vType || _apSkip[vType] || !_apSolid[vType]) return;
      // Check if a body already exists near this position
      for (let bi = 0; bi < _apW.bodies.length; bi++) {
        const b = _apW.bodies[bi];
        if (b.__meshName === obj.name || b.__meshRef === obj) { obj.userData.__physicsBody = b; return; }
        if (Math.abs(b.position.x - obj.position.x) < 0.3 && Math.abs(b.position.y - obj.position.y) < 0.3 && Math.abs(b.position.z - obj.position.z) < 0.3) {
          obj.userData.__physicsBody = b; b.__meshRef = obj; b.__meshName = obj.name; return;
        }
      }
      const box3 = new THREE.Box3();
      try { box3.expandByObject(obj); } catch { return; }
      if (box3.isEmpty()) return;
      const sz = new THREE.Vector3(); box3.getSize(sz);
      const ctr = new THREE.Vector3(); box3.getCenter(ctr);
      const hx = Math.max(sz.x * 0.5, 0.05);
      const hy = Math.max(sz.y * 0.5, 0.05);
      const hz = Math.max(sz.z * 0.5, 0.05);
      const shape = new CANNON.Box(new CANNON.Vec3(hx, hy, hz));
      const body = new CANNON.Body({ mass: 0, shape });
      body.position.set(ctr.x, ctr.y, ctr.z);
      body.type = CANNON.Body.STATIC;
      body.__meshRef = obj;
      body.__meshName = obj.name || '';
      body.__autoPhysics = true;
      _apW.addBody(body);
      obj.userData.__physicsBody = body;
      // === Rapier parallel collider (Phase 3) ===
      var _apR = window.RAPIER;
      var _apRW = window.__vibexe_rapierWorld__;
      if (_apR && _apRW) {
        try {
          var _rbd = _apR.RigidBodyDesc.fixed().setTranslation(ctr.x, ctr.y, ctr.z);
          var _rb = _apRW.createRigidBody(_rbd);
          var _rcd = _apR.ColliderDesc.cuboid(hx, hy, hz);
          _apRW.createCollider(_rcd, _rb);
          obj.userData.__rapierBody = _rb;
        } catch(e) {}
      }
      _apCreated++;
    });
    if (_apCreated > 0) console.log('[AutoPhysics] Created ' + _apCreated + ' bodies' + (window.__vibexe_rapierWorld__ ? ' (+ Rapier)' : ''));
  }

  // Also handle run-auto-physics message from sandpack-preview
  const _autoPhysicsHandler = (ev: any) => {
    if (ev.data?.type === 'run-auto-physics') _autoPhysics();
  };
  window.addEventListener('message', _autoPhysicsHandler);

  // ===== Resize =====
  const _resizeHandler = () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    const comp = W.__vibexe_composer__;
    if (comp?.setSize) comp.setSize(w, h);
  };
  window.addEventListener('resize', _resizeHandler);

  const _visibilityHandler = () => {
    if (document.hidden) clock.stop(); else clock.start();
  };
  document.addEventListener('visibilitychange', _visibilityHandler);

  // Store cleanup function so bundle reload can remove these listeners
  W.__vibexe_eventCleanup__ = () => {
    window.removeEventListener('message', _autoPhysicsHandler);
    window.removeEventListener('resize', _resizeHandler);
    document.removeEventListener('visibilitychange', _visibilityHandler);
  };

  // ===== Editor Integration =====
  let __editorMode = false;
  let __editorOrbitControls: any = null;
  let __menuOverlay: any = null;
  let __menuResolve: (() => void) | null = null;

  W.__vibexe_editor__ = {
    scene, camera, renderer,
    get world() { return (gameScene as any).world; },
    gameScene,
    get isEditing() { return __editorMode; },
    orbitControls: null as any,
    pause() {
      __editorMode = true;
      clock.stop();
      muteMusic();
      if (__menuOverlay) { __menuOverlay.remove(); __menuOverlay = null; if (__menuResolve) { __menuResolve(); __menuResolve = null; } }
      if (THREE.OrbitControls) {
        __editorOrbitControls = new THREE.OrbitControls(camera, renderer.domElement);
        __editorOrbitControls.enableDamping = true;
        __editorOrbitControls.dampingFactor = 0.08;
        __editorOrbitControls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
        __editorOrbitControls.screenSpacePanning = true;
        __editorOrbitControls.target.set(0, 1, 0);
        __editorOrbitControls.update();
        W.__vibexe_editor__.orbitControls = __editorOrbitControls;
      }
    },
    resume() {
      __editorMode = false;
      if (__editorOrbitControls) { __editorOrbitControls.dispose(); __editorOrbitControls = null; W.__vibexe_editor__.orbitControls = null; }
      unmuteMusic();
      clock.start();
    },
  };

  // ===== Initialize & Run =====
  (async () => {
    // WebGPU renderer requires async init before first render
    if (__rendererNeedsInit) {
      try {
        await renderer.init();
        console.log('[Runtime] WebGPURenderer initialized (backend: ' + (renderer.backend?.constructor?.name || 'unknown') + ')');
      } catch (initRendererErr: any) {
        console.warn('[Runtime] WebGPURenderer init failed, falling back to WebGL:', initRendererErr);
        renderer = new THREE.WebGLRenderer({ antialias: __perf.antialias === true, alpha: false, stencil: false, powerPreference: 'high-performance' });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(__perf.pixelRatio || window.devicePixelRatio, 1.0));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);
        W.__vibexe_renderer__ = renderer;
        W.__vibexe_webgpu__ = false;
      }
    }

    try {
      await gameScene.init(scene, camera, renderer, container, () => {});
    } catch (initErr) {
      console.error('[Runtime] gameScene.init() failed:', initErr);
    }

    // Apply scene editor transform overrides
    const __scOv = W.__SCENE_OVERRIDES__;
    if (__scOv && typeof __scOv === 'object') {
      const __tryApply = () => {
        let remaining = 0;
        for (const [name, o] of Object.entries(__scOv as Record<string, any>)) {
          let t: any = null;
          scene.traverse((c: any) => { if (!t && c.name === name) t = c; });
          if (t) {
            if (o.p) t.position.set(o.p[0], o.p[1], o.p[2]);
            if (o.r) t.rotation.set(o.r[0], o.r[1], o.r[2]);
            if (o.s) t.scale.set(o.s[0], o.s[1], o.s[2]);
          } else { remaining++; }
        }
        return remaining === 0;
      };
      if (!__tryApply()) {
        let att = 0;
        const iv = setInterval(() => { att++; if (__tryApply() || att > 50) clearInterval(iv); }, 300);
      }
    }

    // Post-processing
    const __createPP = W.createPostProcessing;
    const __ppSettings = __gs.postProcessing;
    if (__ppSettings?.preset && __ppSettings.preset !== 'none' && __createPP) {
      __createPP(renderer, scene, camera, __ppSettings.preset);
    }

    // Run auto-physics after init with retries (objects may still be loading GLBs)
    _autoPhysics();
    setTimeout(() => _autoPhysics(), 5000);
    setTimeout(() => _autoPhysics(), 10000);
    setTimeout(() => _autoPhysics(), 15000);

    // Initial render
    try { renderer.render(scene, camera); } catch(__re) { if (!__re?.message?.includes("already initialized")) throw __re; }

    // Show TAP TO START overlay then start game loop
    const _startLoop = () => {
      try { _getAudioContext(); } catch {}

      // Performance state
      let __lastFrameTime = 0;
      let __perfFrames = 0, __perfLastCheck = performance.now(), __perfDowngraded = false;
      let __perfDowngradeTime = 0; // Timestamp when quality was last reduced (cooldown)
      const __perfStartTime = performance.now(); // Grace period: skip PerfGuard during initial loading
      // Shadow follow state
      let __shadowFrame = 0, __shadowLastPX = 0, __shadowLastPZ = 0;
      // LOD culling frame counter
      let __lodFrame = 0;
      // Cached sun reference
      let __cachedSun: any = null, __sunSearched = false;
      // Audio listener vectors (reuse to avoid per-frame allocation)
      const __audioFwd = new THREE.Vector3();
      const __audioUp = new THREE.Vector3();
      // FPS cap from settings
      const __initFI = __perf.maxFPS && __perf.maxFPS > 0 ? 1000 / __perf.maxFPS : 0;
      if (__initFI > 0) { W.__vibexe_frameInterval__ = __initFI; W.__vibexe_targetFPS__ = __perf.maxFPS; }

      // Signal PerfGuard is active (bridge AdaptiveQuality should back off)
      W.__vibexe_perfguard__ = true;

      // Disable bloom by default for performance — skip composer entirely and render direct
      W.__vibexe_skipComposer__ = true;

      // Reset PerfGuard counters on tab-switch to prevent false FPS trigger
      const _perfVisHandler = () => {
        if (!document.hidden) {
          __perfFrames = 0;
          __perfLastCheck = performance.now();
        }
      };
      document.addEventListener('visibilitychange', _perfVisHandler);
      // Append to cleanup so bundle reload removes this listener too
      const _prevCleanup = W.__vibexe_eventCleanup__;
      W.__vibexe_eventCleanup__ = () => {
        if (_prevCleanup) _prevCleanup();
        document.removeEventListener('visibilitychange', _perfVisHandler);
      };

      function animate(time?: number) {
        W.__vibexe_animFrameId__ = requestAnimationFrame(animate);
        try {
        // Skip when tab hidden
        if (document.hidden) return;
        // FPS capping
        const __frameInterval = W.__vibexe_frameInterval__ || 0;
        if (__frameInterval > 0 && time) {
          const __elapsed = time - __lastFrameTime;
          if (__elapsed < __frameInterval) return;
          __lastFrameTime = time - (__elapsed % __frameInterval);
        }

        // ===== PerfGuard (skip in editor mode + 10s grace period) =====
        __perfFrames++;
        const __perfNow = performance.now();
        if (__perfNow - __perfLastCheck >= 2000 && !__editorMode) {
          const __avgFps = __perfFrames / ((__perfNow - __perfLastCheck) / 1000);
          const __perfAge = __perfNow - __perfStartTime;
          if (__avgFps < 40 && !__perfDowngraded && __perfAge > 8000) {
            __perfDowngraded = true;
            __perfDowngradeTime = __perfNow;
            console.log('[PerfGuard] FPS=' + Math.round(__avgFps) + ' — reducing quality');
            renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 0.75));
            renderer.shadowMap.enabled = false;
            W.__vibexe_cullDistance__ = 80;
            const comp = W.__vibexe_composer__;
            if (comp?.passes) { for (let pi = 0; pi < comp.passes.length; pi++) { if (comp.passes[pi].constructor?.name === 'UnrealBloomPass') comp.passes[pi].enabled = false; } }
          } else if (__avgFps > 55 && __perfDowngraded && (__perfNow - __perfDowngradeTime > 30000)) {
            // Only restore after 30s cooldown to prevent oscillation (reduce→restore→reduce flicker)
            __perfDowngraded = false;
            console.log('[PerfGuard] FPS=' + Math.round(__avgFps) + ' — restoring quality (after 30s cooldown)');
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.needsUpdate = true;
            W.__vibexe_cullDistance__ = 150;
            const comp = W.__vibexe_composer__;
            if (comp?.passes) { for (let pi = 0; pi < comp.passes.length; pi++) { if (comp.passes[pi].constructor?.name === 'UnrealBloomPass') comp.passes[pi].enabled = true; } }
          }
          __perfFrames = 0;
          __perfLastCheck = __perfNow;
        }

        // ===== Editor mode =====
        if (__editorMode) {
          if (__editorOrbitControls) __editorOrbitControls.update();
          W._updateAllMixers3D?.(0.016);
          // Pin GLB root position to zero (animation root drift prevention)
          if (W.__vibexe_playerMesh__?.userData?.__innerGLBRoot) {
            const _ir = W.__vibexe_playerMesh__.userData.__innerGLBRoot;
            if (_ir.position.x !== 0 || _ir.position.y !== 0 || _ir.position.z !== 0) _ir.position.set(0, 0, 0);
          }
          __shadowFrame++;
          if (__shadowFrame >= 30) { __shadowFrame = 0; renderer.shadowMap.needsUpdate = true; }
          if (!W.__vibexe_bridge_rendering__) {
            try {
              const comp = W.__vibexe_composer__;
              if (comp && !W.__vibexe_skipComposer__) comp.render(); else renderer.render(scene, camera);
            } catch(__re) { if (!__re?.message?.includes("already initialized")) throw __re; }
          }
          return;
        }

        const delta = clock.getDelta();
        // Auto-update animation mixers
        W._updateAllMixers3D?.(delta);
        // Pin GLB root node position to zero after mixer update.
        // Some GLB animations have "Scene.position" tracks that drift the root node,
        // causing gizmo misalignment in scene editor. This clamps it every frame.
        if (W.__vibexe_playerMesh__?.userData?.__innerGLBRoot) {
          const _ir = W.__vibexe_playerMesh__.userData.__innerGLBRoot;
          if (_ir.position.x !== 0 || _ir.position.y !== 0 || _ir.position.z !== 0) _ir.position.set(0, 0, 0);
        }
        // Step Rapier world (parallel physics — terrain heightfield + KCC)
        const _rw = W.__vibexe_rapierWorld__;
        if (_rw) {
          try {
            _rw.step();
            // Sync Rapier dynamic bodies → Three.js meshes
            const _rbm = W.__vibexe_rapierBodyMap__;
            if (_rbm && _rbm.size > 0) {
              _rbm.forEach((mesh: any, body: any) => {
                if (!body.isValid() || body.isSleeping()) return;
                const p = body.translation();
                const r = body.rotation();
                mesh.position.set(p.x, p.y, p.z);
                mesh.quaternion.set(r.x, r.y, r.z, r.w);
              });
            }
          } catch (_rapierErr: any) {
            // Rapier WASM can throw "recursive use" if world state is corrupted
            // Log once and disable to prevent flooding console every frame
            if (!W.__rapierErrorLogged) {
              W.__rapierErrorLogged = true;
              console.warn('[Rapier] Physics step error (disabling Rapier):', _rapierErr?.message || _rapierErr);
            }
            W.__vibexe_rapierWorld__ = null;
          }
        }

        try { if (gameScene.update) gameScene.update(delta); } catch (e) { console.error('[Runtime] update error:', e); }
        // Auto-update character controllers, particles, triggers, springs
        W._updateAllControllers3D?.(delta);
        W._updateAllParticles3D?.(delta);
        W._updateAllTriggers3D?.();
        W._updateAllSprings3D?.();
        // Spatial audio: attached sounds follow meshes
        W._updateAllSpatial3D?.();

        // ===== Audio listener position/orientation from camera =====
        try {
          if (_audioCtx?.listener && camera) {
            const L = _audioCtx.listener as any;
            if (L.positionX) {
              L.positionX.value = camera.position.x;
              L.positionY.value = camera.position.y;
              L.positionZ.value = camera.position.z;
            } else if (L.setPosition) {
              L.setPosition(camera.position.x, camera.position.y, camera.position.z);
            }
            __audioFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
            __audioUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
            if (L.forwardX) {
              L.forwardX.value = __audioFwd.x; L.forwardY.value = __audioFwd.y; L.forwardZ.value = __audioFwd.z;
              L.upX.value = __audioUp.x; L.upY.value = __audioUp.y; L.upZ.value = __audioUp.z;
            } else if (L.setOrientation) {
              L.setOrientation(__audioFwd.x, __audioFwd.y, __audioFwd.z, __audioUp.x, __audioUp.y, __audioUp.z);
            }
          }
        } catch {}

        // ===== Shadow follow player =====
        const __playerMesh = W.__vibexe_playerMesh__;
        if (__playerMesh?.position) {
          if (!__sunSearched) { __cachedSun = scene.getObjectByName('__default_sun__'); __sunSearched = true; }
          if (__cachedSun?.isDirectionalLight) {
            const __px = __playerMesh.position.x, __pz = __playerMesh.position.z;
            __cachedSun.position.set(__px + 30, 80, __pz + 30);
            if (__cachedSun.target) { __cachedSun.target.position.set(__px, 0, __pz); __cachedSun.target.updateMatrixWorld(); }
            __shadowFrame++;
            const __sdx = __px - __shadowLastPX, __sdz = __pz - __shadowLastPZ;
            if (__shadowFrame >= 30 || __sdx * __sdx + __sdz * __sdz > 25) {
              __shadowFrame = 0; __shadowLastPX = __px; __shadowLastPZ = __pz;
              renderer.shadowMap.needsUpdate = true;
            }
          }
        } else {
          __shadowFrame++;
          if (__shadowFrame >= 30) { __shadowFrame = 0; renderer.shadowMap.needsUpdate = true; }
        }

        // ===== LOD culling (every 4th frame) =====
        __lodFrame++;
        if (__lodFrame >= 4) {
          __lodFrame = 0;
          const __cullDist = W.__vibexe_cullDistance__ || 120;
          const __camPos = camera.position;
          for (let ci = 0; ci < scene.children.length; ci++) {
            const ch = scene.children[ci];
            if (!ch.userData || ch.userData.__editorOnly || ch.name?.startsWith('__')) continue;
            if (!ch.userData.vibexeType) continue;
            const dx = ch.position.x - __camPos.x, dz = ch.position.z - __camPos.z;
            const d2 = dx * dx + dz * dz;
            const shouldVis = d2 < __cullDist * __cullDist;
            if (ch.visible !== shouldVis && !ch.userData.__editorForceVisible) ch.visible = shouldVis;
          }
        }

        // ===== Render =====
        const comp = W.__vibexe_composer__;
        try {
          if (comp && !W.__vibexe_skipComposer__) comp.render(delta); else renderer.render(scene, camera);
        } catch(__re) { if (!__re?.message?.includes("already initialized")) throw __re; }
        } catch (__frameErr) { console.error('[GameLoop] Frame error:', __frameErr); }
      }
      // Force initial shadow render
      renderer.shadowMap.needsUpdate = true;
      animate();
    };

    // Menu overlay — TAP TO START
    const menuOv = document.createElement('div');
    menuOv.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:150;font-family:sans-serif;color:#fff;cursor:pointer';
    const tapLabel = document.createElement('div');
    tapLabel.style.cssText = 'font-size:22px;font-weight:bold;color:#00ff88;animation:pulse3d 1.2s ease-in-out infinite;pointer-events:none';
    tapLabel.textContent = 'TAP TO START';
    const pulseStyle = document.createElement('style');
    pulseStyle.textContent = '@keyframes pulse3d{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.05)}}';
    menuOv.appendChild(pulseStyle);
    menuOv.appendChild(tapLabel);
    container.appendChild(menuOv);
    __menuOverlay = menuOv;

    await new Promise<void>((resolve) => {
      __menuResolve = resolve;
      setTimeout(() => {
        menuOv.addEventListener('click', function handler() {
          menuOv.removeEventListener('click', handler);
          menuOv.style.opacity = '0';
          menuOv.style.transition = 'opacity 0.3s';
          setTimeout(() => { menuOv.remove(); __menuOverlay = null; __menuResolve = null; resolve(); }, 300);
        });
      }, 400);
    });

    _startLoop();
  })();
}
`;
}
