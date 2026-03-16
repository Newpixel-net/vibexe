/**
 * GET /api/app-builder/game-runtime
 *
 * Serves a lightweight HTML page that:
 * 1. Loads Three.js r183 WebGPU build (sets window.THREE) — auto-falls back to WebGL 2
 * 2. Loads Three.js addons (GLTFLoader, OrbitControls, TransformControls, post-processing)
 * 3. Loads CANNON.js (sets window.CANNON) + Rapier.js WASM (sets window.RAPIER)
 * 4. Loads the visual-edit-bridge for scene editing
 * 5. Receives compiled game bundle via postMessage
 *
 * Same-origin iframe — no cross-origin restrictions, no in-browser bundler.
 * This eliminates ~15-20 FPS overhead from sandpack.
 */

export function GET(request: Request) {
	const url = new URL(request.url);
	// Sanitize to digits only — prevents XSS via template interpolation
	const bridgeVersion = (url.searchParams.get("bv") || "91").replace(/\D/g, "") || "91";

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vibexe Game Runtime</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#root{width:100%;height:100%;overflow:hidden}
canvas{display:block;width:100%;height:100%}
</style>
</head>
<body>
<div id="root"></div>

<!-- Runtime bootstrap globals (injected dynamically) -->
<script id="vibexe-bootstrap"></script>

<!-- Import map for ESM modules (WebGPU build — auto-falls back to WebGL 2) -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.183.0/build/three.webgpu.js",
    "three/webgpu": "https://cdn.jsdelivr.net/npm/three@0.183.0/build/three.webgpu.js",
    "three/tsl": "https://cdn.jsdelivr.net/npm/three@0.183.0/build/three.tsl.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.183.0/examples/jsm/"
  }
}
</script>

<!-- Three.js r183 WebGPU + addons + CANNON.js — loaded as ES modules, assigned to window globals -->
<script type="module">
import * as THREE from 'three';
import * as TSL from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
// NOTE: Legacy postprocessing addons (EffectComposer, ShaderPass, UnrealBloomPass) import
// WebGL-specific internals (UniformsUtils, WebGLRenderTarget) that don't exist in three.webgpu.js.
// They MUST be loaded via dynamic import() so failures don't crash the entire module script.
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

// ES module namespace is frozen — create a mutable copy with core + TSL + addons
// TSL provides: pass, attribute, uniform, float, vec2, vec3, shapeCircle, instancedBufferAttribute, etc.
var T = Object.assign({}, THREE, TSL, { GLTFLoader, OrbitControls, TransformControls });
window.THREE = T;
window.CANNON = Object.assign({}, CANNON);

var hasWebGPU = !!navigator.gpu;
console.log('[Runtime] Three.js r' + T.REVISION + ' loaded' + (hasWebGPU ? ' [WebGPU]' : ' [WebGL fallback]'));
console.log('[Runtime] CANNON.js loaded');
window.__vibexe_hasWebGPU__ = hasWebGPU;

// Load Rapier.js physics (WASM — async init required)
// Using dynamic import so CANNON still works if Rapier fails to load
try {
  var _rapierMod = await import('https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.19.3/+esm');
  var _RAPIER = _rapierMod.default || _rapierMod;
  await _RAPIER.init();
  window.RAPIER = _RAPIER;
  console.log('[Runtime] Rapier.js WASM physics loaded');
} catch (_rapierErr) {
  console.warn('[Runtime] Rapier.js failed to load (CANNON.js only):', _rapierErr);
}

// Load WebGPU post-processing: bloom TSL node (works on both WebGPU and WebGL backends)
try {
  var _bloomMod = await import('three/addons/tsl/display/BloomNode.js');
  window.THREE.bloom = _bloomMod.bloom || _bloomMod.default;
  console.log('[Runtime] Bloom TSL node loaded');
} catch (_bloomErr) {
  console.log('[Runtime] Bloom TSL node unavailable');
}

// Load legacy postprocessing addons (WebGL-only — may fail with WebGPU build, that's OK)
// createPostProcessing() will use THREE.PostProcessing + TSL nodes as primary path
try {
  var [_ec, _rp, _ubp, _sp, _cs, _lhps] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/ShaderPass.js'),
    import('three/addons/shaders/CopyShader.js'),
    import('three/addons/shaders/LuminosityHighPassShader.js'),
  ]);
  Object.assign(window.THREE, {
    EffectComposer: _ec.EffectComposer,
    RenderPass: _rp.RenderPass,
    UnrealBloomPass: _ubp.UnrealBloomPass,
    ShaderPass: _sp.ShaderPass,
    CopyShader: _cs.CopyShader,
    LuminosityHighPassShader: _lhps.LuminosityHighPassShader,
  });
  console.log('[Runtime] Legacy postprocessing loaded (EffectComposer available)');
} catch (_ppErr) {
  console.log('[Runtime] Legacy postprocessing unavailable (WebGPU PostProcessing will be used)');
}

// Log final addon count
var _addonCount = ['GLTFLoader','OrbitControls','TransformControls','PostProcessing','bloom']
  .filter(function(n) { return !!window.THREE[n]; }).length;
console.log('[Runtime] ' + _addonCount + '/5 core addons loaded');

// Signal that libraries are ready (bridge and game code wait for this)
window.__vibexe_libs_ready__ = true;
window.dispatchEvent(new Event('vibexe-libs-ready'));
</script>

<!-- Global error handlers — catch bundle crashes and report to parent -->
<script>
window.onerror = function(msg, url, line, col, err) {
  var m = String(msg || '');
  // Suppress known WebGPU transient errors — they self-resolve and spam the console
  if (m.indexOf('already initialized') >= 0 || m.indexOf('usedTimes') >= 0
    || (m.indexOf('Cannot read properties of') >= 0 && String(url||'').indexOf('three') >= 0)
    || (m.indexOf('Cannot set properties of') >= 0 && String(url||'').indexOf('three') >= 0)) {
    return true;
  }
  console.error('[Runtime Error]', msg, 'at', url + ':' + line + ':' + col);
  try { window.parent.postMessage({ type: 'vibexe-runtime-error', error: String(msg), line: line, col: col }, '*'); } catch(e) {}
  return true;
};
window.addEventListener('unhandledrejection', function(e) {
  var m = String(e.reason && e.reason.message || e.reason || '');
  if (m.indexOf('already initialized') >= 0 || m.indexOf('usedTimes') >= 0 || m.indexOf('Cannot read properties of') >= 0) return;
  console.error('[Runtime Unhandled Rejection]', e.reason);
  try { window.parent.postMessage({ type: 'vibexe-runtime-error', error: String(e.reason) }, '*'); } catch(e2) {}
});
</script>

<!-- Visual Edit Bridge + Message handler — loaded after libs are ready -->
<script>
(function(){
  function initRuntime() {
    // Load bridge script dynamically
    var bridgeScript = document.createElement('script');
    bridgeScript.src = '/api/app-builder/bridge?v=${bridgeVersion}';
    document.body.appendChild(bridgeScript);

    // World Builder bridge — loaded after main bridge
    var wbBridgeScript = document.createElement('script');
    wbBridgeScript.src = '/api/app-builder/world-builder-bridge?v=${bridgeVersion}';
    document.body.appendChild(wbBridgeScript);

    var bundleLoaded = false;

    window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.type) return;
    // Only accept messages from same origin (prevents cross-origin injection)
    if (ev.origin && ev.origin !== window.location.origin) return;

    // Inject bootstrap globals
    if (ev.data.type === 'vibexe-inject-bootstrap') {
      var el = document.getElementById('vibexe-bootstrap');
      if (el) {
        var script = document.createElement('script');
        script.textContent = ev.data.code;
        el.parentNode.replaceChild(script, el);
      } else {
        var s = document.createElement('script');
        s.textContent = ev.data.code;
        document.head.appendChild(s);
      }
    }

    // Inject compiled game bundle
    if (ev.data.type === 'vibexe-inject-bundle') {
      // Clean up previous bundle if reloading
      var old = document.getElementById('vibexe-game-bundle');
      if (old) {
        // KEEP renderer alive across bundle reloads — WebGPU device.destroy() is fatal
        // and re-creating a WebGPURenderer is expensive + causes flicker.
        // The renderer will be REUSED by the next bundle's Game3D IIFE.
        var ren = window.__vibexe_renderer__;
        // Just clear the render target, don't dispose
        if (ren) { try { ren.clear(); } catch(e) {} }
        var sc = window.__vibexe_scene__;
        if (sc) {
          sc.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              for (var mi = 0; mi < mats.length; mi++) {
                var mt = mats[mi];
                // Dispose all textures to prevent GPU memory leak on hot-reload
                if (mt.map) mt.map.dispose();
                if (mt.normalMap) mt.normalMap.dispose();
                if (mt.roughnessMap) mt.roughnessMap.dispose();
                if (mt.metalnessMap) mt.metalnessMap.dispose();
                if (mt.aoMap) mt.aoMap.dispose();
                if (mt.emissiveMap) mt.emissiveMap.dispose();
                if (mt.alphaMap) mt.alphaMap.dispose();
                if (mt.envMap) mt.envMap.dispose();
                mt.dispose();
              }
            }
          });
        }
        // Cancel animation frames
        if (window.__vibexe_animFrameId__) {
          cancelAnimationFrame(window.__vibexe_animFrameId__);
        }
        // Cancel FPS counter loop
        if (window.__vibexe_fpsLoopId__) {
          cancelAnimationFrame(window.__vibexe_fpsLoopId__);
          window.__vibexe_fpsLoopId__ = null;
        }
        // Close AudioContext
        var audioCtx = window.__vibexe_audioCtx__ || window._audioCtx;
        if (audioCtx && audioCtx.close) { try { audioCtx.close(); } catch(e) {} }
        window.__vibexe_audioCtx__ = null;
        window._audioCtx = null;
        window._masterGain = null;
        window._musicGain = null;
        window._sfxGain = null;
        // Remove accumulated event listeners
        if (window.__vibexe_eventCleanup__) {
          try { window.__vibexe_eventCleanup__(); } catch(e) {}
          window.__vibexe_eventCleanup__ = null;
        }
        // Restore original requestAnimationFrame if wrapped
        if (window.requestAnimationFrame.__vibexe_original) {
          window.requestAnimationFrame = window.requestAnimationFrame.__vibexe_original;
        }
        old.remove();
        // Clear globals (keep renderer alive for reuse!)
        // window.__vibexe_renderer__ is NOT cleared — reused by next bundle
        window.__vibexe_skipComposer__ = false;
        window.__vibexe_scene__ = null;
        window.__vibexe_camera__ = null;
        window.__vibexe_world__ = null;
        window.__vibexe_composer__ = null;
        window.__vibexe_playerMesh__ = null;
        window.__vibexe_editor__ = null;
        window.__vibexe_bootstrap_applied__ = null;
        window.__vibexe_perfguard__ = null;
        window.__vibexe_terrainBody = null;
        window.__vibexe_terrainPostStep = null;
        window.__vibexe_terrainData = null;
        // Rapier cleanup — free KCC + WASM resources BEFORE freeing world
        var _rpw = window.__vibexe_rapierWorld__;
        // Free character KCC/body/collider BEFORE world.free() — prevents stale ref crash
        if (window.__charCtrl_rapier) {
          var _ckr = window.__charCtrl_rapier;
          try { if (_ckr.kcc && _ckr.kcc.free) _ckr.kcc.free(); } catch(e) {}
          try { if (_ckr.collider && _rpw) _rpw.removeCollider(_ckr.collider, true); } catch(e) {}
          try { if (_ckr.body && _rpw) _rpw.removeRigidBody(_ckr.body); } catch(e) {}
          window.__charCtrl_rapier = null;
        }
        if (_rpw && _rpw.free) { try { _rpw.free(); } catch(e) {} }
        window.__vibexe_rapierWorld__ = null;
        window.__vibexe_rapierBodyMap__ = null;
        window.__vibexe_rapierTerrainCollider__ = null;
        window.__vibexe_rapierTerrainBody__ = null;
        window.__rapierErrorLogged = null;
        // Clean up module globals to prevent stale handlers/timers on reload
        window.__vibexe_modules__ = {};
        // Sky-weather cleanup: destroy instance + clear init timer
        if (window.__vibexe_skyWeather) {
          try { window.__vibexe_skyWeather.destroy(); } catch(e) {}
        }
        window.__vibexe_skyWeather = null;
        window.__skyWeather_active = null;
        if (window.__skyWeather_autoInitInterval) {
          clearInterval(window.__skyWeather_autoInitInterval);
          window.__skyWeather_autoInitInterval = null;
        }
        // Character system cleanup
        window.__vibexe_characterSystem = null;
        if (window.__charCtrl_autoInitInterval) {
          clearInterval(window.__charCtrl_autoInitInterval);
          window.__charCtrl_autoInitInterval = null;
        }
        window.__charCtrl_active = false;
        // Cancel any module-owned intervals/timers
        if (window.__vibexe_moduleTimers__) {
          for (var _mt = 0; _mt < window.__vibexe_moduleTimers__.length; _mt++) {
            try { clearInterval(window.__vibexe_moduleTimers__[_mt]); } catch(e) {}
          }
          window.__vibexe_moduleTimers__ = [];
        }
        // Clear canvas — but KEEP the renderer's canvas element if reusing
        var root = document.getElementById('root');
        if (root) {
          var keepCanvas = ren ? ren.domElement : null;
          while (root.firstChild) {
            if (root.firstChild === keepCanvas) { break; }
            root.removeChild(root.firstChild);
          }
          // Remove any children AFTER the canvas too
          while (keepCanvas && keepCanvas.nextSibling) {
            root.removeChild(keepCanvas.nextSibling);
          }
        }
        // Remove FPS overlay
        var fpsEl = document.getElementById('__vibexe_fps__');
        if (fpsEl) fpsEl.remove();
      }

      // CRITICAL: Intercept WebGPURenderer constructor so OLD game bundles
      // (stored in DB without reuse logic) automatically get the cached renderer
      // instead of creating a new one (which causes 2 canvases + device leak).
      var _cachedRen = window.__vibexe_renderer__;
      if (_cachedRen && _cachedRen.domElement && window.THREE && window.THREE.WebGPURenderer) {
        var _OrigWGPU = window.THREE.WebGPURenderer;
        window.THREE.__OrigWebGPURenderer = _OrigWGPU;
        // Store original init for restoration
        var _origInit = _cachedRen.init ? _cachedRen.init.bind(_cachedRen) : null;
        // Make init() a no-op on the cached renderer (it's already initialized)
        _cachedRen.init = function() { return Promise.resolve(); };
        window.THREE.WebGPURenderer = function() {
          console.log('[Runtime] Returning cached WebGPURenderer (intercept)');
          return _cachedRen;
        };
        window.THREE.WebGPURenderer.prototype = _OrigWGPU.prototype;
        // Restore original constructor + init after bundle executes (runs sync)
        setTimeout(function() {
          if (window.THREE.__OrigWebGPURenderer) {
            window.THREE.WebGPURenderer = window.THREE.__OrigWebGPURenderer;
            delete window.THREE.__OrigWebGPURenderer;
          }
          if (_origInit && _cachedRen) {
            _cachedRen.init = _origInit;
          }
        }, 50);
      }

      try {
        var script = document.createElement('script');
        script.id = 'vibexe-game-bundle';
        script.textContent = ev.data.code;
        document.body.appendChild(script);
      } catch(e) {
        console.error('[Runtime] Bundle execution error:', e);
        window.parent.postMessage({ type: 'vibexe-runtime-error', error: String(e) }, '*');
      }
      bundleLoaded = true;

      // Override createPostProcessing with WebGPU-aware version
      // (old game bundles only have the legacy EffectComposer path)
      (function() {
        var T = window.THREE;
        if (!T) return;
        var _PP_PRESETS = {
          cinematic: { bloom: { strength: 0.4, radius: 0.4, threshold: 0.85 }, fog: { color: 0x88aacc, near: 20, far: 80 }, toneMapping: "ACESFilmic", exposure: 1.0 },
          vibrant: { bloom: { strength: 0.6, radius: 0.4, threshold: 0.8 }, toneMapping: "ACESFilmic", exposure: 1.0 },
          dark: { bloom: { strength: 0.3, radius: 0.3, threshold: 0.9 }, fog: { color: 0x111122, near: 5, far: 40 }, toneMapping: "Cineon", exposure: 0.7 },
          neon: { bloom: { strength: 1.5, radius: 0.6, threshold: 0.4 }, fog: { color: 0x050510, near: 10, far: 60 }, toneMapping: "ACESFilmic", exposure: 0.9 },
          natural: { bloom: { strength: 0.2, radius: 0.3, threshold: 0.9 }, fog: { color: 0xccddee, near: 30, far: 100 }, toneMapping: "Linear", exposure: 1.0 }
        };
        window.POST_PROCESSING_PRESETS = _PP_PRESETS;

        window.createPostProcessing = function(renderer, scene, camera, preset) {
          function addFog(opts) {
            scene.fog = new T.Fog((opts && opts.color != null) ? opts.color : 0x88aacc, (opts && opts.near != null) ? opts.near : 20, (opts && opts.far != null) ? opts.far : 80);
          }
          function setTM(type, exp) {
            var m = { Linear: 1, Reinhard: 2, Cineon: 3, ACESFilmic: 4 };
            renderer.toneMapping = m[type] || 1;
            renderer.toneMappingExposure = exp || 1;
          }

          // WebGPU path: THREE.PostProcessing + TSL nodes
          if (T.PostProcessing && T.pass) {
            var pp = new T.PostProcessing(renderer);
            var scenePass = T.pass(scene, camera);
            var colorNode = scenePass.getTextureNode("output");
            pp.outputNode = colorNode;
            window.__vibexe_composer__ = pp;

            function addBloom(opts) {
              if (!T.bloom) { console.warn("[PostFX] bloom TSL node not loaded"); return; }
              var s = (opts && opts.strength != null) ? opts.strength : 0.5;
              var r = (opts && opts.radius != null) ? opts.radius : 0.4;
              var th = (opts && opts.threshold != null) ? opts.threshold : 0.85;
              var bloomNode = T.bloom(colorNode, s, r, th);
              pp.outputNode = colorNode.add(bloomNode);
              console.log("[PostFX] WebGPU bloom enabled — strength:", s);
            }
            function setPreset(name) {
              var p = _PP_PRESETS[name];
              if (!p) { console.warn("[PostFX] Unknown preset:", name); return; }
              if (p.bloom) addBloom(p.bloom);
              if (p.fog) addFog(p.fog); else scene.fog = null;
              if (p.toneMapping) setTM(p.toneMapping, p.exposure || 1);
            }
            if (preset) setPreset(preset);
            console.log("[PostFX] WebGPU PostProcessing pipeline created");
            return { composer: pp, addBloom: addBloom, addFog: addFog, setPreset: setPreset, destroy: function() { window.__vibexe_composer__ = null; if (pp.dispose) pp.dispose(); } };
          }

          // WebGL fallback: legacy EffectComposer
          if (!T.EffectComposer) {
            console.warn("[PostFX] Neither PostProcessing nor EffectComposer available");
            return null;
          }
          var composer = new T.EffectComposer(renderer);
          composer.addPass(new T.RenderPass(scene, camera));
          window.__vibexe_composer__ = composer;
          var _bloomPass = null;
          function addBloomLegacy(opts) {
            if (!T.UnrealBloomPass) return;
            if (_bloomPass) composer.removePass(_bloomPass);
            var w = renderer.domElement.width / 4;
            var h = renderer.domElement.height / 4;
            _bloomPass = new T.UnrealBloomPass(new T.Vector2(w, h), (opts && opts.strength != null) ? opts.strength : 0.5, (opts && opts.radius != null) ? opts.radius : 0.4, (opts && opts.threshold != null) ? opts.threshold : 0.85);
            composer.addPass(_bloomPass);
          }
          function setPresetLegacy(name) {
            var p = _PP_PRESETS[name];
            if (!p) return;
            if (p.bloom) addBloomLegacy(p.bloom);
            if (p.fog) addFog(p.fog); else scene.fog = null;
            if (p.toneMapping) setTM(p.toneMapping, p.exposure || 1);
          }
          if (preset) setPresetLegacy(preset);
          return { composer: composer, addBloom: addBloomLegacy, addFog: addFog, setPreset: setPresetLegacy, destroy: function() { window.__vibexe_composer__ = null; composer.dispose && composer.dispose(); } };
        };
        console.log("[Runtime] createPostProcessing override applied (WebGPU-aware)");
      })();

      // PerfGuard safety net: old game bundles have aggressive thresholds (8s grace, FPS<30)
      // that permanently degrade quality during WebGPU TSL shader compilation.
      // Only reset quality during initial 30s grace period, then let game PerfGuard manage.
      (function() {
        var _pgCount = 0;
        var _pgMax = 2; // 2 * 15s = 30s initial protection (was 8 = 2min, caused oscillation)
        var _pgInterval = setInterval(function() {
          _pgCount++;
          // Skip reset if game's own PerfGuard already activated — it has proper thresholds
          if (window.__vibexe_perfguard__) {
            clearInterval(_pgInterval);
            console.log("[Runtime] PerfGuard safety net deferred to game PerfGuard");
            return;
          }
          var didReset = false;
          if (window.__vibexe_skipComposer__) {
            window.__vibexe_skipComposer__ = false;
            didReset = true;
          }
          // Restore pixel ratio if it was reduced
          var r = window.__vibexe_renderer__;
          if (r && typeof r.getPixelRatio === 'function' && r.getPixelRatio() < 1.0) {
            r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            didReset = true;
          }
          if (didReset) {
            console.log("[Runtime] PerfGuard safety: reset quality (" + _pgCount + "/" + _pgMax + ")");
          }
          if (_pgCount >= _pgMax) {
            clearInterval(_pgInterval);
            console.log("[Runtime] PerfGuard safety net expired after 30s");
          }
        }, 15000);
        // Clear interval on page unload
        window.addEventListener('beforeunload', function() { clearInterval(_pgInterval); });
        console.log("[Runtime] PerfGuard safety net armed (15s interval, 30s)");
      })();

      // Notify parent that bundle is loaded
      window.parent.postMessage({ type: 'vibexe-runtime-bundle-loaded' }, '*');
    }

    // Full reload (new compile)
    if (ev.data.type === 'vibexe-reload') {
      if (ev.data.bootstrap) {
        var bs = document.createElement('script');
        bs.textContent = ev.data.bootstrap;
        document.head.appendChild(bs);
      }
      if (ev.data.bundle) {
        window.postMessage({ type: 'vibexe-inject-bundle', code: ev.data.bundle }, '*');
      }
    }
  });

    // Notify parent that runtime page is ready
    window.parent.postMessage({ type: 'vibexe-runtime-ready' }, '*');
  }

  // Wait for ES module libs to load before initializing
  if (window.__vibexe_libs_ready__) {
    initRuntime();
  } else {
    window.addEventListener('vibexe-libs-ready', initRuntime, { once: true });
  }
})();
</script>
</body>
</html>`;

	return new Response(html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-cache",
			// Allow same-origin iframe embedding (overrides global X-Frame-Options: DENY)
			"X-Frame-Options": "SAMEORIGIN",
			"Content-Security-Policy": "frame-ancestors 'self'",
		},
	});
}
