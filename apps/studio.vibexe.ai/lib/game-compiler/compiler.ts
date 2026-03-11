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

function createVirtualPlugin(files: Map<string, string>): esbuild.Plugin {
	// Shim modules: Three.js + CANNON.js + React as window globals
	const shims: Record<string, string> = {
		three: "module.exports = window.THREE;",
		"cannon-es": "module.exports = window.CANNON;",
		react: "module.exports = window.React || {};",
		"react-dom": "module.exports = window.ReactDOM || {};",
		"react-dom/client": "module.exports = { createRoot: (window.ReactDOM||{}).createRoot };",
		"react/jsx-runtime": "module.exports = { jsx: (window.React||{}).createElement, jsxs: (window.React||{}).createElement, Fragment: (window.React||{}).Fragment };",
		"react/jsx-dev-runtime": "module.exports = { jsxDEV: (window.React||{}).createElement, Fragment: (window.React||{}).Fragment };",
	};

	// Add @vibexe/* module shims from module registry
	for (const mod of ALL_MODULE_MANIFESTS) {
		const pkgName = `@vibexe/${mod.id}`;
		if (!shims[pkgName]) {
			shims[pkgName] = mod.runtimeCode || "module.exports = {};";
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
					tsx: "tsx", ts: "ts", jsx: "jsx", js: "js", css: "css",
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
			entryContent = generateGameEntry(gameScenePath, assetsPath);
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

	// Generate cache key from all file contents + settings
	const cacheKey = hashContent(
		JSON.stringify(input.files.map((f) => f.content)) +
		JSON.stringify(settings) +
		JSON.stringify(input.enabledModuleIds || []),
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

	// Compile with esbuild
	try {
		const result = await esbuild.build({
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
			target: ["es2020"],
			jsx: "transform",
			jsxFactory: "React.createElement",
			jsxFragment: "React.Fragment",
			minify: false, // Keep readable for debugging; enable in production
			write: false,
			plugins: [createVirtualPlugin(files)],
			define: {
				"process.env.NODE_ENV": '"production"',
			},
			logLevel: "silent",
		});

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
 * - The runtime page already loads Three.js + CANNON.js as ES modules
 * - The bridge is loaded as a separate script (/api/app-builder/bridge)
 */
function generateGameEntry(gameScenePath: string, assetsPath: string | null): string {
	const assetsImport = assetsPath
		? `import "./${assetsPath}";`
		: '// No assets-3d.ts found — factory functions may not be available';

	const sceneImport = `import * as GameSceneModule from "./${gameScenePath}";`;

	return `// Synthetic entry — bootstraps game without React (lightweight runtime)
${assetsImport}
${sceneImport}

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
  const container = document.getElementById('root')!;
  const __gs = W.__VIBEXE_GAME_SETTINGS__ || {};
  const __perf = __gs.performance || {};

  // ===== Renderer =====
  const renderer = new THREE.WebGLRenderer({
    antialias: __perf.antialias !== false,
    alpha: false, stencil: false, powerPreference: 'high-performance'
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(__perf.pixelRatio || window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);
  W.__vibexe_renderer__ = renderer;

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
    __gs.environment?.hemisphereIntensity ?? 0.35
  );
  hemi.name = '__default_hemi__';
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(
    __gs.environment?.ambientLightColor || '#ffffff',
    __gs.environment?.ambientLightIntensity ?? 0.15
  );
  ambient.name = '__default_ambient__';
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(
    __gs.environment?.sunLightColor || '#fff8ee',
    __gs.environment?.sunLightIntensity ?? 0.55
  );
  sun.name = '__default_sun__';
  sun.position.set(8, 20, 10);
  sun.castShadow = true;
  const __shSizes: Record<string, number> = { low: 512, medium: 1024, high: 2048 };
  const __shSize = __shSizes[__gs.environment?.shadowQuality || 'medium'] || 1024;
  sun.shadow.mapSize.set(__shSize, __shSize);
  const __hasTerrain = !!__gs.terrain?.enabled;
  const __tHalf = __hasTerrain ? Math.max((__gs.terrain?.width || 200) / 2, (__gs.terrain?.depth || 200) / 2) : 20;
  const __shExt = Math.min(__tHalf, 100);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = __hasTerrain ? 200 : 50;
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

  // ===== Resize =====
  window.addEventListener('resize', () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    const comp = W.__vibexe_composer__;
    if (comp) comp.setSize(w, h);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clock.stop(); else clock.start();
  });

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
      if (W.muteMusic) W.muteMusic();
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
      if (W.unmuteMusic) W.unmuteMusic();
      clock.start();
    },
  };

  // ===== Initialize & Run =====
  (async () => {
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

    // Initial render
    renderer.render(scene, camera);

    // Show TAP TO START overlay then start game loop
    const _startLoop = () => {
      try { W._audioCtx?.resume(); W._getAudioContext?.(); } catch {}
      function animate() {
        W.__vibexe_animFrameId__ = requestAnimationFrame(animate);
        if (__editorMode) {
          if (__editorOrbitControls) __editorOrbitControls.update();
          renderer.shadowMap.needsUpdate = true;
          const comp = W.__vibexe_composer__;
          if (comp && !W.__vibexe_skipComposer__) comp.render(); else renderer.render(scene, camera);
          return;
        }
        const delta = clock.getDelta();
        try { if (gameScene.update) gameScene.update(delta); } catch (e) { console.error('[Runtime] update error:', e); }
        renderer.shadowMap.needsUpdate = true;
        const comp = W.__vibexe_composer__;
        if (comp && !W.__vibexe_skipComposer__) comp.render(); else renderer.render(scene, camera);
      }
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
