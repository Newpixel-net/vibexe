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

// Bump this when generateGameEntry() or the compiler wrapper changes
// so esbuild cache busts without waiting for CACHE_TTL expiry
const COMPILER_VERSION = "39";

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
	// Shim modules: Three.js + CANNON.js + Rapier.js + Pixi.js + Proton + React as window globals
	const shims: Record<string, string> = {
		three: "module.exports = window.THREE;",
		"cannon-es": "module.exports = window.CANNON;",
		"@dimforge/rapier3d-compat": "module.exports = window.RAPIER || {};",
		"pixi.js": "module.exports = window.PIXI || {};",
		"proton-engine": "module.exports = window.Proton || {};",
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
			build.onLoad({ filter: /.*/, namespace: "virtual" }, async (args) => {
				let content = files.get(args.path);
				if (content === undefined)
					return { errors: [{ text: `Not found: ${args.path}` }] };

				// Auto-append re-exports to config/assets.ts so AI can import from anywhere
				if (args.path.endsWith("config/assets.ts") || args.path === "config/assets.ts") {
					const reExports: string[] = [];
					const effectsPath = findFileByName(files, "effects.ts") || findFileByName(files, "engine/effects.ts");
					const physicsPath = findFileByName(files, "physics.ts") || findFileByName(files, "engine/physics.ts");
					const mediaPath = findFileByName(files, "media-stock.ts") || findFileByName(files, "utils/media-stock.ts");
					if (effectsPath && !content.includes("createAmbientEffect"))
						reExports.push(`export { createAmbientEffect, createSnowEffect, createRainEffect, onJumpDust, onLandImpact, onCollectSparkle, onDeathExplosion } from "../${effectsPath}";`);
					if (physicsPath && !content.includes("PhysicsWorld"))
						reExports.push(`export { PhysicsWorld, createBody, createStaticBody, createOneWayPlatform, CharacterController } from "../${physicsPath}";`);
					if (mediaPath && !content.includes("_loadSpriteLib"))
						reExports.push(`export { _loadSpriteLib, _sheetCache } from "../${mediaPath}";`);
					if (reExports.length > 0)
						content = content + "\n// Auto-injected re-exports\n" + reExports.join("\n") + "\n";
				}

				// Pre-strip TypeScript from GameScene2D.ts — Feature Bank scaffold
				// uses plain JS IIFEs, but AI (Kimi K2.5) adds type annotations.
				// Regex strip first (handles broken code esbuild.transform can't parse),
				// then esbuild.transform as second pass for anything regex missed.
				if (args.path.includes("GameScene2D")) {
					// Pass 1: regex — strip `: Type` annotations from function params only
					// Only targets patterns inside parentheses: (param: Type) or (a: Type, b: Type)
					// Safe because `: number` etc. never appear as valid JS inside parens
					content = content
						.replace(/(\(\s*\w+)\s*:\s*(?:number|string|boolean|any|void|object|unknown|never|undefined|null)(\s*[,)])/g, "$1$2")
						.replace(/(,\s*\w+)\s*:\s*(?:number|string|boolean|any|void|object|unknown|never|undefined|null)(\s*[,)])/g, "$1$2");
					// Pass 2: esbuild.transform — strip any remaining TS cleanly
					try {
						const stripped = await esbuild.transform(content, { loader: "tsx", target: "es2020" });
						content = stripped.code;
					} catch {
						// If transform also fails, regex-stripped content is the best we have
					}
				}

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
	// Check 2D FIRST (Engine2D in core.ts is a strong signal), then fall back to 3D.
	let is2DGame = false;
	if (!entryContent) {
		// 2D game detection: engine/core.ts with Engine2D class
		const coreEnginePath = findFileByName(files, "core.ts") || findFileByName(files, "engine/core.ts");
		is2DGame = !!coreEnginePath && !!files.get(coreEnginePath)?.includes("Engine2D");

		if (is2DGame) {
			// Find ANY scene file — AI may name it GameScene2D, GameScene, PlatformerGameScene, etc.
			const gameScene2DPath = findFileByName(files, "GameScene2D.ts") || findFileByName(files, "GameScene2D.tsx")
				|| findFileByName(files, "GameScene.ts") || findFileByName(files, "GameScene.tsx")
				|| findFileByName(files, "GameScene3D.ts") || findFileByName(files, "GameScene3D.tsx");
			// Also search for any .ts file in scenes/ directory
			const anyScenePath = gameScene2DPath || [...files.keys()].find(k => k.startsWith("scenes/") && k.endsWith(".ts") && !k.includes("GameOver"));

			if (anyScenePath) {
				entryPath = "__runtime_entry__.ts";
				entryContent = generateGame2DEntry(anyScenePath, coreEnginePath);
				files.set(entryPath, entryContent);
			}
		}
	}

	// 3D game detection (fallback): GameScene3D.ts + assets-3d.ts
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
			errors: ["No entry point found (index.tsx/ts/jsx/js, GameScene3D.ts, or 2D engine/core.ts)"],
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
		COMPILER_VERSION +
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
			is2DGame,
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
			is2DGame,
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
/**
 * Generate a synthetic entry point for 2D game projects (Pixi.js + Proton).
 *
 * Bootstraps the Engine2D from engine/core.ts and runs the game scene.
 * The 2D runtime page already loads Pixi.js + Proton via CDN.
 */
function generateGame2DEntry(gameScenePath: string, corePath: string | null): string {
	const coreImport = corePath
		? `import { createGame2D, Engine2D } from "./${corePath}";`
		: '// No engine/core.ts found';

	return `// Synthetic 2D entry — bootstraps Pixi.js game without React
${coreImport}
import * as GameSceneModule from "./${gameScenePath}";

// Resolve game scene from any export pattern (AI may use any name)
const _m = GameSceneModule as any;
const _SceneClass = _m.GameScene2D || _m.GameScene || _m.PlatformerGameScene
  || _m.RunnerGameScene || _m.ShooterGameScene || _m.PuzzleGameScene
  || _m.default
  || Object.values(_m).find((v: any) => v && typeof v === 'function' && v.prototype && (v.prototype.enter || v.prototype.update))
  || Object.values(_m).find((v: any) => v && typeof v === 'function')
  || null;

(async function boot2D() {
  try {
    const PIXI = (window as any).PIXI;
    const Proton = (window as any).Proton;
    if (!PIXI) { console.error('[2D Boot] PIXI not found on window'); return; }

    // Defensive: promote pixi-filters to top-level PIXI namespace
    if (PIXI.filters) {
      var _fns = ['GlowFilter','DropShadowFilter','OutlineFilter','BloomFilter','BlurFilter','ColorMatrixFilter','AdjustmentFilter','AdvancedBloomFilter','GodrayFilter','MotionBlurFilter'];
      for (var _i = 0; _i < _fns.length; _i++) { if (PIXI.filters[_fns[_i]] && !PIXI[_fns[_i]]) PIXI[_fns[_i]] = PIXI.filters[_fns[_i]]; }
    }

    // Defensive: patch CanvasGradient.addColorStop to accept hex numbers
    const _origAddColorStop = CanvasGradient.prototype.addColorStop;
    CanvasGradient.prototype.addColorStop = function(offset: number, color: any) {
      if (typeof color === 'number') color = '#' + color.toString(16).padStart(6, '0');
      try { _origAddColorStop.call(this, offset, color); } catch(e) { /* skip invalid color */ }
    };

    // Defensive: patch addChild to skip invalid objects (common AI mistake)
    const _isValidChild = (c: any) => c != null && typeof c === 'object' && ('children' in c || 'texture' in c || c instanceof PIXI.Container);
    const _origAddChild = PIXI.Container.prototype.addChild;
    PIXI.Container.prototype.addChild = function(...children: any[]) {
      const safe = children.filter(_isValidChild);
      if (safe.length < children.length) console.warn('[Engine2D] addChild: filtered', children.length - safe.length, 'invalid children');
      if (safe.length === 0) return this;
      try { return _origAddChild.apply(this, safe); } catch(e) { console.warn('[Engine2D] addChild error:', e); return this; }
    };
    const _origAddChildAt = PIXI.Container.prototype.addChildAt;
    if (_origAddChildAt) {
      PIXI.Container.prototype.addChildAt = function(child: any, index: number) {
        if (!_isValidChild(child)) { console.warn('[Engine2D] addChildAt: invalid child skipped'); return this; }
        try { return _origAddChildAt.call(this, child, index); } catch(e) { console.warn('[Engine2D] addChildAt error:', e); return this; }
      };
    }

    // Defensive: patch Proton.Emitter.addTo so both API patterns work
    if (Proton && Proton.Emitter && Proton.Emitter.prototype && !Proton.Emitter.prototype.addTo) {
      Proton.Emitter.prototype.addTo = function(protonInstance: any) {
        if (protonInstance && typeof protonInstance.addEmitter === 'function') {
          protonInstance.addEmitter(this);
        }
        return this;
      };
    }

    // Import additional template files if they exist
    try { await import("./config/assets"); } catch(e) {}
    try { await import("./engine/effects"); } catch(e) {}
    try { await import("./engine/physics"); } catch(e) {}
    try { await import("./engine/input"); } catch(e) {}
    try { await import("./utils/media-stock"); } catch(e) {}

    // Create engine
    let engine: any;
    if (typeof createGame2D === 'function') {
      engine = await createGame2D({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x1a1a2e,
      });
    } else {
      // Fallback: create PIXI app directly
      const app = new PIXI.Application();
      await app.init({ width: window.innerWidth, height: window.innerHeight, backgroundColor: 0x1a1a2e });
      document.getElementById('root')!.appendChild(app.canvas);
      engine = { app, proton: new Proton() };
    }

    // Patch camera.applyTo alias (old engine templates don't have it)
    if (engine.camera && !engine.camera.applyTo) {
      engine.camera.applyTo = function(container: any) { engine.camera.update(container); };
    }
    // Patch camera.follow to accept (x,y) in addition to (sprite)
    if (engine.camera && engine.camera.follow) {
      const _origFollow = engine.camera.follow.bind(engine.camera);
      engine.camera.follow = function(a: any, b?: any) {
        if (typeof a === 'number' && typeof b === 'number') { engine.camera.target = { x: a, y: b }; }
        else { _origFollow(a); }
      };
    }

    // Create and start game scene
    if (_SceneClass) {
      const scene = typeof _SceneClass === 'function' ? new _SceneClass() : _SceneClass;
      // Ensure scene has required properties
      if (!scene.name) scene.name = 'game';
      if (!scene.container) scene.container = new PIXI.Container();

      // Track enter() success — disable update() if enter() fails
      let _enterOk = false;
      let _updateErrCount = 0;

      // Wrap update() — skip if enter failed, catch errors, disable after 5 failures
      if (scene.update) {
        const _origUpdate = scene.update.bind(scene);
        scene.update = function(eng: any, dt: number) {
          if (!_enterOk || _updateErrCount >= 5) return;
          try { _origUpdate(eng, dt); } catch(e: any) {
            _updateErrCount++;
            if (_updateErrCount === 1) console.error('[Engine2D] Scene update() error:', e?.message || e);
            if (_updateErrCount >= 5) console.warn('[Engine2D] update() disabled after 5 errors');
          }
        };
      }

      // Wrap enter() — track async errors, show overlay on failure
      const _origEnter = scene.enter ? scene.enter.bind(scene) : null;
      if (_origEnter) {
        scene.enter = function(eng: any, data?: any) {
          try {
            const result = _origEnter(eng, data);
            if (result && typeof result.then === 'function') {
              result.then(() => { _enterOk = true; }).catch((e: any) => {
                console.error('[Engine2D] Scene enter() async error:', e?.message || e);
                _showError(e?.message || String(e));
              });
            } else {
              _enterOk = true;
            }
            return result;
          } catch(e: any) {
            console.error('[Engine2D] Scene enter() error:', e);
            _showError(e?.message || String(e));
          }
        };
      }

      function _showError(msg: string) {
        const root = document.getElementById('root');
        if (!root) return;
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;bottom:8px;left:8px;right:8px;padding:10px 14px;background:rgba(255,60,60,0.85);color:#fff;font:12px/1.4 monospace;border-radius:6px;z-index:9999;max-height:80px;overflow:auto;backdrop-filter:blur(4px)';
        el.textContent = 'Game Error: ' + msg;
        root.appendChild(el);
      }

      if (engine.addScene) {
        engine.addScene(scene);
        // Also try to add GameOverScene
        try {
          const gom = await import("./scenes/GameOverScene");
          const GoScene = (gom as any).GameOverScene || (gom as any).default;
          if (GoScene) {
            const goScene = typeof GoScene === 'function' ? new GoScene() : GoScene;
            if (!goScene.container) goScene.container = new PIXI.Container();
            engine.addScene(goScene);
          }
        } catch(e) {}
        engine.switchScene(scene.name || 'game');
      } else if (_origEnter) {
        scene.enter(engine);
      }
    } else {
      console.error('[2D Boot] No game scene found. Exports:', Object.keys(_m));
      const errEl = document.createElement('div');
      errEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ff6b6b;font:16px/1.4 sans-serif;text-align:center;padding:20px;background:#111';
      errEl.textContent = 'Error: GameScene2D not found. Check console.';
      document.getElementById('root')!.appendChild(errEl);
    }

    // Report FPS to parent
    (window as any).__vibexe_animFrameId__ = 1; // Signal that game is running
    console.log('[2D Boot] Game started');
  } catch (err) {
    console.error('[2D Boot] Fatal:', err);
    const errEl = document.createElement('div');
    errEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ff6b6b;font:16px/1.4 sans-serif;text-align:center;padding:20px;background:#111';
    errEl.textContent = 'Error: ' + String(err);
    document.getElementById('root')!.appendChild(errEl);
  }
})();
`;
}

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
      antialias: __perf.antialias !== false, // Honor user's antialias setting (default: on)
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
  // HiDPI: use devicePixelRatio (capped at 2) for sharp rendering.
  // Only respect saved pixelRatio if it's > 1 (legacy setting of 1 on 2x displays looks bad).
  const __initPR = (__perf.pixelRatio && __perf.pixelRatio > 1) ? __perf.pixelRatio : window.devicePixelRatio;
  renderer.setPixelRatio(Math.min(__initPR, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  W.__vibexe_renderer__ = renderer;
  W.__vibexe_webgpu__ = !!THREE.WebGPURenderer && renderer.constructor === THREE.WebGPURenderer;

  // ===== Global WebGPU error suppression =====
  if (!W.__vibexe_webgpu_error_handler__) {
    W.__vibexe_webgpu_error_handler__ = true;
    window.addEventListener('error', (evt: ErrorEvent) => {
      const m = evt?.message || '';
      if (m.includes('usedTimes') || m.includes('already initialized') || m.includes('is not a function') || m.includes('Cannot read properties')) {
        evt.preventDefault();
        return true;
      }
    });
    window.addEventListener('unhandledrejection', (evt: PromiseRejectionEvent) => {
      const m = String(evt?.reason?.message || evt?.reason || '');
      if (m.includes('usedTimes') || m.includes('already initialized') || m.includes('Cannot read properties')) {
        evt.preventDefault();
      }
    });
  }

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

  // ===== Lighting (r183 PBR: MeshStandardMaterial divides by PI, need ~3x r172 values) =====
  // Defaults calibrated for balanced PBR: hemi 1.0, ambient 0.4, sun 1.8 (effective ~1.0 after /PI)
  const hemi = new THREE.HemisphereLight(
    __gs.environment?.hemisphereSkyColor || '#eef4ff',
    __gs.environment?.hemisphereGroundColor || '#886644',
    __gs.environment?.hemisphereIntensity ?? 1.0
  );
  hemi.name = '__default_hemi__';
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(
    __gs.environment?.ambientLightColor || '#ffffff',
    __gs.environment?.ambientLightIntensity ?? 0.4
  );
  ambient.name = '__default_ambient__';
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(
    __gs.environment?.sunLightColor || '#fff8ee',
    __gs.environment?.sunLightIntensity ?? 1.8
  );
  sun.name = '__default_sun__';
  sun.position.set(8, 20, 10);
  sun.castShadow = true;
  const __shSizes: Record<string, number> = { low: 512, medium: 1024, high: 2048 };
  const __shSize = __shSizes[__gs.environment?.shadowQuality || 'medium'] || 1024;
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

  // ===== Deferred Procedural Environment Map =====
  // PMREMGenerator.fromScene() creates a procedural env map for PBR reflections.
  // Skip if bridge (Scene mode) will handle it. 500ms delay for renderer init.
  setTimeout(() => {
    try {
      if (!scene || !THREE.PMREMGenerator) return;
      if (W.__vibexe_editor_active__) return; // bridge handles env map in Scene mode
      if (scene.environment) return; // already set
      const __pmrem = new THREE.PMREMGenerator(renderer);
      __pmrem.compileEquirectangularShader?.();
      const __envScene = new THREE.Scene();
      const __skyGeo = new THREE.SphereGeometry(50, 32, 16);
      __envScene.add(new THREE.Mesh(__skyGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.35, 0.4, 0.55), side: THREE.BackSide
      })));
      const __gndGeo = new THREE.SphereGeometry(49, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      __envScene.add(new THREE.Mesh(__gndGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.15, 0.13, 0.1), side: THREE.BackSide
      })));
      const __pGeo = new THREE.PlaneGeometry(8, 8);
      const __addP = (x: number, y: number, z: number, r: number, g: number, b: number, sx: number, sy: number) => {
        const p = new THREE.Mesh(__pGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide }));
        p.position.set(x, y, z); p.lookAt(0, 0, 0); p.scale.set(sx, sy, 1);
        __envScene.add(p);
      };
      __addP(0, 45, -10, 4, 3.5, 3, 2, 2);
      __addP(-15, 40, 25, 2, 2, 2.5, 1.5, 1.5);
      __addP(35, 20, -15, 1.5, 1.5, 2, 2, 2);
      const __envRT = __pmrem.fromScene(__envScene, 0, 0.1, 100);
      scene.environment = __envRT.texture;
      if ((scene as any).environmentIntensity !== undefined) (scene as any).environmentIntensity = 0.8;
      // Defer disposal to next frame — WebGPU backend needs one render pass to process textures
      requestAnimationFrame(() => {
        try { __pmrem.dispose(); } catch (_) {}
        __skyGeo.dispose(); __gndGeo.dispose(); __pGeo.dispose();
        for (const c of __envScene.children) {
          if ((c as any).geometry) (c as any).geometry.dispose();
          if ((c as any).material) (c as any).material.dispose();
        }
      });
      console.log("[Game3D] Deferred env map applied");
    } catch (__e) { console.warn("[Game3D] env map error:", __e); }
  }, 500);

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
        const __fbPR = (__perf.pixelRatio && __perf.pixelRatio > 1) ? __perf.pixelRatio : window.devicePixelRatio;
        renderer.setPixelRatio(Math.min(__fbPR, 2.0));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
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

    // Post-processing — always enable at least subtle bloom for atmospheric depth
    const __createPP = W.createPostProcessing;
    const __ppSettings = __gs.postProcessing;
    if (__createPP) {
      if (__ppSettings?.preset && __ppSettings.preset !== 'none') {
        __createPP(renderer, scene, camera, __ppSettings.preset);
      } else {
        // Default subtle bloom when no preset selected — adds atmospheric glow
        __createPP(renderer, scene, camera, 'subtle');
      }
    }

    // Run auto-physics after init with retries (objects may still be loading GLBs)
    _autoPhysics();
    setTimeout(() => _autoPhysics(), 5000);
    setTimeout(() => _autoPhysics(), 10000);
    setTimeout(() => _autoPhysics(), 15000);

    // Initial render
    if (renderer.info?.reset) renderer.info.reset();
    try { renderer.render(scene, camera); } catch(__re) { var __rm=__re?.message||""; if (!__rm.includes("already initialized")&&!__rm.includes("usedTimes")&&!__rm.includes("is not a function")) throw __re; }

    // Bundle generation counter — each bundle gets a unique ID.
    // Old animate loops detect they're orphaned by checking their gen vs the global.
    const __bundleGen = (W.__vibexe_bundleGen__ = (W.__vibexe_bundleGen__ || 0) + 1);

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
      // Default 60fps cap to prevent unnecessary GPU work (user can override via settings)
      const __defaultFPS = __perf.maxFPS && __perf.maxFPS > 0 ? __perf.maxFPS : 60;
      const __initFI = 1000 / __defaultFPS;
      W.__vibexe_frameInterval__ = __initFI; W.__vibexe_targetFPS__ = __defaultFPS;

      // Signal PerfGuard is active — single quality authority in Game mode
      // Bridge AdaptiveQuality + route.ts safety net both check this flag and back off
      W.__vibexe_perfguard__ = true;
      W.__vibexe_quality_authority__ = 'perfguard';

      // Skip composer only if no post-processing was configured by the user
      // If a preset was selected (cinematic, vibrant, etc.), respect it and keep bloom active
      W.__vibexe_skipComposer__ = !W.__vibexe_composer__;

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
        // Guard: stop orphaned game loops from previous bundles.
        // Each bundle captures __bundleGen at creation. If the global incremented (new bundle),
        // this loop is stale — return without scheduling next frame to let it die.
        if (W.__vibexe_bundleGen__ !== __bundleGen) return;
        if (!scene || !renderer || !camera) return;
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
          W.__vibexe_lastFps__ = __avgFps;
          const __perfAge = __perfNow - __perfStartTime;
          // Two-tier PerfGuard: emergency at FPS<8 after 15s, normal at FPS<15 after 35s
          // Extended grace period for WebGPU TSL shader compilation (multiple materials compile on first use)
          if (__avgFps < 15 && !__perfDowngraded && (__perfAge > 35000 || (__avgFps < 8 && __perfAge > 15000))) {
            __perfDowngraded = true;
            __perfDowngradeTime = __perfNow;
            W.__vibexe_perfguard_degraded__ = true;
            console.log('[PerfGuard] FPS=' + Math.round(__avgFps) + ' — reducing quality');
            // On HiDPI: degrade to 75% of device ratio (not fixed 1.0) — keeps sharpness
            renderer.setPixelRatio(Math.min(window.devicePixelRatio * 0.75, 1.5));
            renderer.shadowMap.enabled = false;
            W.__vibexe_cullDistance__ = 80;
            // Reduce FPS target to 30 to give GPU breathing room
            W.__vibexe_frameInterval__ = 1000 / 30;
            W.__vibexe_targetFPS__ = 30;
            const comp = W.__vibexe_composer__;
            if (comp?.passes) { for (let pi = 0; pi < comp.passes.length; pi++) { if (comp.passes[pi].constructor?.name === 'UnrealBloomPass') comp.passes[pi].enabled = false; } }
          } else if (__avgFps > 35 && __perfDowngraded && (__perfNow - __perfDowngradeTime > 20000)) {
            // Restore after 20s cooldown
            __perfDowngraded = false;
            W.__vibexe_perfguard_degraded__ = false;
            console.log('[PerfGuard] FPS=' + Math.round(__avgFps) + ' — restoring quality');
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.needsUpdate = true;
            W.__vibexe_cullDistance__ = 150;
            W.__vibexe_frameInterval__ = __initFI;
            W.__vibexe_targetFPS__ = __defaultFPS;
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
          if (__shadowFrame >= 4) { __shadowFrame = 0; renderer.shadowMap.needsUpdate = true; }
          if (!W.__vibexe_bridge_rendering__) {
            if (renderer.info?.reset) renderer.info.reset();
            try {
              const comp = W.__vibexe_composer__;
              if (comp && !W.__vibexe_skipComposer__) comp.render(); else renderer.render(scene, camera);
            } catch(__re) { var __rm=__re?.message||""; if (!__rm.includes("already initialized")&&!__rm.includes("usedTimes")&&!__rm.includes("is not a function")) throw __re; }
          }
          return;
        }

        // Command Center: pause / step support
        if (W.__vibexe_game_paused__ && !W.__vibexe_step_frame__) return;
        if (W.__vibexe_step_frame__) W.__vibexe_step_frame__ = false;

        const delta = clock.getDelta() * (W.__vibexe_time_scale__ != null ? W.__vibexe_time_scale__ : 1);
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
            if (__shadowFrame >= 4 || __sdx * __sdx + __sdz * __sdz > 4) {
              __shadowFrame = 0; __shadowLastPX = __px; __shadowLastPZ = __pz;
              renderer.shadowMap.needsUpdate = true;
            }
          }
        } else {
          __shadowFrame++;
          if (__shadowFrame >= 4) { __shadowFrame = 0; renderer.shadowMap.needsUpdate = true; }
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
        if (renderer.info?.reset) renderer.info.reset();
        const comp = W.__vibexe_composer__;
        try {
          if (comp && !W.__vibexe_skipComposer__) comp.render(delta); else renderer.render(scene, camera);
        } catch(__re) { var __rm=__re?.message||""; if (!__rm.includes("already initialized")&&!__rm.includes("usedTimes")&&!__rm.includes("is not a function")) throw __re; }
        } catch (__frameErr: any) { if (W.__vibexe_bundleGen__ === __bundleGen) console.error('[GameLoop] Frame error:', __frameErr?.message || __frameErr?.name || String(__frameErr)); }
      }
      // Force initial shadow render
      renderer.shadowMap.needsUpdate = true;
      animate();

      // Command Center message handler — always active (not editor-bridge dependent)
      W.addEventListener('message', function(ev: any) {
        const d = ev.data;
        if (!d || !d.type || typeof d.type !== 'string' || d.type.indexOf('game-cmd-') !== 0) return;
        switch (d.type) {
          case 'game-cmd-play': W.__vibexe_game_paused__ = false; break;
          case 'game-cmd-pause': W.__vibexe_game_paused__ = true; break;
          case 'game-cmd-step': W.__vibexe_step_frame__ = true; break;
          case 'game-cmd-reset': W.location.reload(); break;
          case 'game-cmd-time-scale': W.__vibexe_time_scale__ = d.scale; break;
          case 'game-cmd-request-stats': {
            const s: any = { fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0, memory: 0 };
            // FPS priority: 1) AdaptiveQuality (most accurate, RAF-wrapped)
            //               2) FPS DOM counter  3) PerfGuard (stale in editor mode)
            const aq = W.__vibexe_adaptive_quality__;
            if (aq && aq.fps > 0) { s.fps = Math.round(aq.fps); }
            else { const fpsEl = document.getElementById('__vibexe_fps__'); if (fpsEl) s.fps = parseInt(fpsEl.textContent?.replace(/[^0-9]/g, '') || '0', 10) || 0; }
            if (!s.fps && W.__vibexe_lastFps__) s.fps = Math.round(W.__vibexe_lastFps__);
            if (renderer?.info) {
              // WebGPURenderer.info values are per-frame when reset() works,
              // cumulative when it doesn't. Read values, then try reset for next poll.
              s.drawCalls = renderer.info.render?.calls || 0;
              s.triangles = renderer.info.render?.triangles || 0;
              s.geometries = renderer.info.memory?.geometries || 0;
              s.textures = renderer.info.memory?.textures || 0;
              // Try reset — if it works, next poll gets per-frame values.
              // If not, values are still reasonable (per-frame from last render).
              try { if (renderer.info.reset) renderer.info.reset(); } catch(_e) {}
            }
            if ((performance as any)?.memory) s.memory = Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024));
            W.parent.postMessage({ type: 'game-cmd-stats-report', stats: s }, '*');
            break;
          }
          case 'game-cmd-start-record': {
            try {
              const canvas = renderer.domElement as HTMLCanvasElement;
              const stream = canvas.captureStream(30);
              const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 5_000_000 });
              const chunks: BlobPart[] = [];
              mr.ondataavailable = (e: any) => { if (e.data.size > 0) chunks.push(e.data); };
              mr.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                blob.arrayBuffer().then((buf) => {
                  W.parent.postMessage({ type: 'game-cmd-recording-ready', buffer: buf }, '*', [buf]);
                });
              };
              mr.start(100);
              W.__vibexe_mediaRecorder__ = mr;
            } catch (recErr: any) { console.error('[CommandCenter] Record start failed:', recErr.message); }
            break;
          }
          case 'game-cmd-stop-record': {
            const mr2 = W.__vibexe_mediaRecorder__;
            if (mr2 && mr2.state !== 'inactive') mr2.stop();
            W.__vibexe_mediaRecorder__ = null;
            break;
          }
          case 'game-cmd-screenshot': {
            try {
              const canvas = renderer.domElement as HTMLCanvasElement;
              canvas.toBlob((blob: Blob | null) => {
                if (!blob) return;
                blob.arrayBuffer().then((buf) => {
                  W.parent.postMessage({ type: 'game-cmd-screenshot-ready', buffer: buf }, '*', [buf]);
                });
              }, 'image/png');
            } catch (ssErr: any) { console.error('[CommandCenter] Screenshot failed:', ssErr.message); }
            break;
          }
        }
      });
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
