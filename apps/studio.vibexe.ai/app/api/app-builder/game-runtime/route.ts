/**
 * GET /api/app-builder/game-runtime
 *
 * Serves a lightweight HTML page that:
 * 1. Loads Three.js r172 as UMD (sets window.THREE)
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
	const bridgeVersion = (url.searchParams.get("bv") || "89").replace(/\D/g, "") || "89";

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

<!-- Import map for ESM modules -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.172.0/examples/jsm/"
  }
}
</script>

<!-- Three.js r172 + addons + CANNON.js — loaded as ES modules, assigned to window globals -->
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { LuminosityHighPassShader } from 'three/addons/shaders/LuminosityHighPassShader.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

// ES module namespace is frozen — create a mutable copy with addons attached
var T = Object.assign({}, THREE, { GLTFLoader, OrbitControls, TransformControls, EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, CopyShader, LuminosityHighPassShader });
window.THREE = T;
window.CANNON = Object.assign({}, CANNON);

var loaded = ['GLTFLoader','OrbitControls','TransformControls','EffectComposer']
  .filter(function(n) { return !!T[n]; }).length;
console.log('[Runtime] Three.js r' + T.REVISION + ' loaded with ' + loaded + '/4 core addons');
console.log('[Runtime] CANNON.js loaded');

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

// Signal that libraries are ready (bridge and game code wait for this)
window.__vibexe_libs_ready__ = true;
window.dispatchEvent(new Event('vibexe-libs-ready'));
</script>

<!-- Global error handlers — catch bundle crashes and report to parent -->
<script>
window.onerror = function(msg, url, line, col, err) {
  console.error('[Runtime Error]', msg, 'at', url + ':' + line + ':' + col);
  try { window.parent.postMessage({ type: 'vibexe-runtime-error', error: String(msg), line: line, col: col }, '*'); } catch(e) {}
  return true;
};
window.addEventListener('unhandledrejection', function(e) {
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
        // Dispose Three.js resources
        var ren = window.__vibexe_renderer__;
        if (ren) { try { ren.dispose(); } catch(e) {} }
        var sc = window.__vibexe_scene__;
        if (sc) {
          sc.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach(function(m) { m.dispose(); });
              } else {
                obj.material.dispose();
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
        // Clear globals
        window.__vibexe_renderer__ = null;
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
        // Rapier cleanup — free WASM resources
        var _rpw = window.__vibexe_rapierWorld__;
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
        // Clear canvas
        var root = document.getElementById('root');
        if (root) root.innerHTML = '';
        // Remove FPS overlay
        var fpsEl = document.getElementById('__vibexe_fps__');
        if (fpsEl) fpsEl.remove();
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
