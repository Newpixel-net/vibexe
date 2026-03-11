/**
 * GET /api/app-builder/game-runtime
 *
 * Serves a lightweight HTML page that:
 * 1. Loads Three.js r172 as UMD (sets window.THREE)
 * 2. Loads Three.js addons (GLTFLoader, OrbitControls, TransformControls, post-processing)
 * 3. Loads CANNON.js (sets window.CANNON)
 * 4. Loads the visual-edit-bridge for scene editing
 * 5. Receives compiled game bundle via postMessage
 *
 * Same-origin iframe — no cross-origin restrictions, no in-browser bundler.
 * This eliminates ~15-20 FPS overhead from sandpack.
 */

export function GET(request: Request) {
	const url = new URL(request.url);
	const bridgeVersion = url.searchParams.get("bv") || "89";

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

<!-- Three.js r172 UMD core — sets window.THREE -->
<script src="https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.min.js"></script>

<!-- Three.js addons — loads and attaches to window.THREE -->
<script>
(function(){
  var T = window.THREE;
  if (!T) { console.error('[Runtime] THREE not loaded'); return; }

  // Addon URLs from jsdelivr ESM
  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.172.0/examples/jsm/';
  var addons = [
    { url: CDN + 'loaders/GLTFLoader.js', names: ['GLTFLoader'] },
    { url: CDN + 'controls/OrbitControls.js', names: ['OrbitControls'] },
    { url: CDN + 'controls/TransformControls.js', names: ['TransformControls'] },
    { url: CDN + 'postprocessing/EffectComposer.js', names: ['EffectComposer','Pass','FullScreenQuad'] },
    { url: CDN + 'postprocessing/RenderPass.js', names: ['RenderPass'] },
    { url: CDN + 'postprocessing/UnrealBloomPass.js', names: ['UnrealBloomPass'] },
    { url: CDN + 'postprocessing/ShaderPass.js', names: ['ShaderPass'] },
    { url: CDN + 'shaders/CopyShader.js', names: ['CopyShader'] },
    { url: CDN + 'shaders/LuminosityHighPassShader.js', names: ['LuminosityHighPassShader'] },
  ];

  // Load each addon via sync XHR + transform (same pattern as sandpack-adapter, but cleaner)
  function loadAddon(url, names) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send();
      if (xhr.status !== 200) return;
      var src = xhr.responseText;

      // Transform ESM → plain JS
      // Replace: import { X, Y } from 'three' → var {X, Y} = THREE;
      src = src.replace(/import\\s*\\{([^}]+)\\}\\s*from\\s*['"]three['"]/g,
        function(_, imports) { return 'var {' + imports + '} = THREE'; });
      // Replace: import * as X from 'three' → var X = THREE;
      src = src.replace(/import\\s*\\*\\s*as\\s+(\\w+)\\s+from\\s*['"]three['"]/g,
        function(_, name) { return 'var ' + name + ' = THREE'; });
      // Replace: import { X } from './OtherAddon.js' → var {X} = THREE;
      src = src.replace(/import\\s*\\{([^}]+)\\}\\s*from\\s*['"]\\.\\//g,
        function(_, imports) { return 'var {' + imports + '} = THREE'; });
      // Replace: export { X, Y } → (remove)
      src = src.replace(/export\\s*\\{[^}]*\\}\\s*;?/g, '');
      // Replace: export class X → var X = class X
      src = src.replace(/export\\s+class\\s+(\\w+)/g, 'var $1 = class $1');
      // Replace: export const X → var X
      src = src.replace(/export\\s+const\\s+/g, 'var ');
      // Replace: export let/var X → var X
      src = src.replace(/export\\s+(?:let|var)\\s+/g, 'var ');
      // Replace: export function X → function X
      src = src.replace(/export\\s+function\\s+/g, 'function ');

      // Build return for named exports
      var ret = 'return {' + names.map(function(n) {
        return n + ':typeof ' + n + '!=="undefined"?' + n + ':undefined';
      }).join(',') + '};';

      var fn = new Function('THREE', src + '\\n' + ret);
      var result = fn(T);
      for (var k in result) {
        if (result[k] !== undefined) T[k] = result[k];
      }
    } catch(e) {
      console.warn('[Runtime] Failed to load addon:', url, e.message);
    }
  }

  for (var i = 0; i < addons.length; i++) {
    loadAddon(addons[i].url, addons[i].names);
  }

  var loaded = ['GLTFLoader','OrbitControls','TransformControls','EffectComposer']
    .filter(function(n) { return !!T[n]; }).length;
  console.log('[Runtime] Three.js r' + T.REVISION + ' loaded with ' + loaded + '/4 core addons');
})();
</script>

<!-- CANNON.js — sets window.CANNON -->
<script src="https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.cjs.js"></script>

<!-- Visual Edit Bridge (scene editor) -->
<script src="/api/app-builder/bridge?v=${bridgeVersion}"></script>

<!-- Message handler — receives bootstrap + bundle from parent -->
<script>
(function(){
  var bundleLoaded = false;

  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.type) return;

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
        old.remove();
        // Clear globals
        window.__vibexe_renderer__ = null;
        window.__vibexe_scene__ = null;
        window.__vibexe_camera__ = null;
        window.__vibexe_world__ = null;
        window.__vibexe_composer__ = null;
        window.__vibexe_playerMesh__ = null;
        window.__vibexe_editor__ = null;
        // Clear canvas
        var root = document.getElementById('root');
        if (root) root.innerHTML = '';
      }

      var script = document.createElement('script');
      script.id = 'vibexe-game-bundle';
      script.textContent = ev.data.code;
      document.body.appendChild(script);
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
})();
</script>
</body>
</html>`;

	return new Response(html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-cache",
		},
	});
}
