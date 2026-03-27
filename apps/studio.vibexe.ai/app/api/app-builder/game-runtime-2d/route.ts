/**
 * GET /api/app-builder/game-runtime-2d
 *
 * Serves a lightweight HTML page that:
 * 1. Loads Pixi.js v8 (sets window.PIXI)
 * 2. Loads Proton particle engine (sets window.Proton)
 * 3. Provides a ticker-driven game loop with Proton.update() each frame
 * 4. Receives compiled game bundle via postMessage
 *
 * Same-origin iframe — no cross-origin restrictions, no in-browser bundler.
 * Mirrors the 3D runtime pattern (game-runtime/route.ts).
 */

export function GET(request: Request) {
	const url = new URL(request.url);
	const cacheBust = (url.searchParams.get("v") || "1").replace(/\D/g, "") || "1";
	// Allow parent to pass API origin for asset loading
	const apiOrigin = url.origin;

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vibexe 2D Game Runtime</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#root{width:100%;height:100%;overflow:hidden;background:#111}
canvas{display:block;width:100%;height:100%}
</style>
</head>
<body>
<div id="root"></div>

<!-- Runtime bootstrap globals (injected dynamically) -->
<script id="vibexe-bootstrap"></script>

<!-- Pixi.js v8 + Proton particle engine + pixi-filters + GSAP -->
<script src="https://cdn.jsdelivr.net/npm/pixi.js@8.9.2/dist/pixi.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/proton-engine@7.1.5/build/proton.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-filters@6.1.5/dist/pixi-filters.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/PixiPlugin.min.js"></script>

<script>
(function() {
  // Verify libraries loaded
  if (typeof PIXI === 'undefined') {
    console.error('[2D Runtime] FATAL: Pixi.js failed to load');
    return;
  }
  if (typeof Proton === 'undefined') {
    console.error('[2D Runtime] FATAL: Proton engine failed to load');
    return;
  }

  window.PIXI = PIXI;
  // Proton CDN exports an ES module object, normalize to the actual constructor
  var _ProtonCtor = (typeof Proton === 'function') ? Proton : (Proton.default || Proton);
  // Merge static members onto the constructor (Emitter, Rate, etc.)
  if (_ProtonCtor !== Proton) {
    for (var _pk in Proton) {
      if (Proton.hasOwnProperty(_pk) && _pk !== 'default') {
        _ProtonCtor[_pk] = Proton[_pk];
      }
    }
  }
  window.Proton = _ProtonCtor;
  window.__VIBEXE_API_ORIGIN__ = '${apiOrigin}';

  console.log('[2D Runtime] Pixi.js v' + PIXI.VERSION + ' loaded');
  console.log('[2D Runtime] Proton particle engine loaded (constructor: ' + (typeof _ProtonCtor === 'function') + ')');

  // Register GSAP PixiPlugin if available
  if (typeof gsap !== 'undefined' && typeof PixiPlugin !== 'undefined') {
    gsap.registerPlugin(PixiPlugin);
    PixiPlugin.registerPIXI(PIXI);
    console.log('[2D Runtime] GSAP + PixiPlugin registered');
  } else {
    console.warn('[2D Runtime] GSAP or PixiPlugin not available — juice effects disabled');
  }

  // Verify pixi-filters and promote to top-level PIXI.* aliases
  if (PIXI.filters && PIXI.filters.DropShadowFilter) {
    // AI often writes PIXI.GlowFilter instead of PIXI.filters.GlowFilter — alias both
    var _filterNames = ['GlowFilter', 'DropShadowFilter', 'OutlineFilter', 'BloomFilter', 'BlurFilter', 'ColorMatrixFilter'];
    for (var _fi = 0; _fi < _filterNames.length; _fi++) {
      var _fn = _filterNames[_fi];
      if (PIXI.filters[_fn] && !PIXI[_fn]) PIXI[_fn] = PIXI.filters[_fn];
    }
    console.log('[2D Runtime] pixi-filters loaded (DropShadow, Glow, Outline, Bloom available)');
  } else {
    console.warn('[2D Runtime] pixi-filters not available — filter effects disabled');
  }

  // Verify FillGradient
  if (PIXI.FillGradient) {
    console.log('[2D Runtime] PIXI.FillGradient available');
  } else {
    console.warn('[2D Runtime] PIXI.FillGradient not available — gradient fills use strip fallback');
  }

  // Signal libraries ready (both 2D-specific and generic flag for GameRuntimeIframe fallback)
  window.__vibexe_2d_libs_ready__ = true;
  window.__vibexe_libs_ready__ = true;
  window.dispatchEvent(new Event('vibexe-2d-libs-ready'));
  window.dispatchEvent(new Event('vibexe-libs-ready'));
})();
</script>

<!-- Keyboard debug overlay (temporary) -->
<script>
(function(){
  var dbg = document.createElement('div');
  dbg.id = 'kb-dbg';
  dbg.style.cssText = 'position:fixed;top:40px;left:4px;background:rgba(0,0,0,0.7);color:#0f0;font:11px monospace;z-index:999999;padding:3px 6px;border-radius:3px;pointer-events:none;';
  dbg.textContent = 'keys: waiting...';
  document.body.appendChild(dbg);
  var log = [];
  window.addEventListener('keydown', function(e) {
    log.push(e.key);
    if (log.length > 6) log.shift();
    dbg.textContent = 'keys: ' + log.join(', ');
  });
})();
</script>

<!-- Global error handlers -->
<script>
window.onerror = function(msg, url, line, col, err) {
  // Ignore cross-origin "Script error" noise from CDN libs (GSAP, pixi-filters)
  if (msg === 'Script error.' && !url) return true;
  console.error('[2D Runtime Error]', msg, 'at', url + ':' + line + ':' + col);
  try { window.parent.postMessage({ type: 'vibexe-runtime-error', error: String(msg), line: line, col: col }, '*'); } catch(e) {}
  return true;
};
window.addEventListener('unhandledrejection', function(e) {
  console.error('[2D Runtime Unhandled Rejection]', e.reason);
  try { window.parent.postMessage({ type: 'vibexe-runtime-error', error: String(e.reason) }, '*'); } catch(e2) {}
});
</script>

<!-- Message handler — loaded after libs are ready -->
<script>
(function(){
  function initRuntime() {
    var bundleLoaded = false;

    window.addEventListener('message', function(ev) {
      if (!ev.data || !ev.data.type) return;
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
          // Cancel animation frames
          if (window.__vibexe_animFrameId__) {
            cancelAnimationFrame(window.__vibexe_animFrameId__);
            window.__vibexe_animFrameId__ = null;
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
          // Remove accumulated event listeners
          if (window.__vibexe_eventCleanup__) {
            try { window.__vibexe_eventCleanup__(); } catch(e) {}
            window.__vibexe_eventCleanup__ = null;
          }
          // Kill all GSAP tweens
          if (window.gsap) {
            try { window.gsap.killTweensOf('*'); } catch(e) {}
          }
          // Destroy Proton instance
          if (window.__vibexe_proton__) {
            try { window.__vibexe_proton__.destroy(); } catch(e) {}
            window.__vibexe_proton__ = null;
          }
          // Destroy PIXI application
          if (window.__vibexe_pixiApp__) {
            try { window.__vibexe_pixiApp__.destroy(true, { children: true, texture: true }); } catch(e) {}
            window.__vibexe_pixiApp__ = null;
          }
          // Clear module timers
          if (window.__vibexe_moduleTimers__) {
            for (var i = 0; i < window.__vibexe_moduleTimers__.length; i++) {
              try { clearInterval(window.__vibexe_moduleTimers__[i]); } catch(e) {}
            }
            window.__vibexe_moduleTimers__ = [];
          }
          old.remove();
          // Clear root
          var root = document.getElementById('root');
          if (root) { root.innerHTML = ''; }
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
          console.error('[2D Runtime] Bundle execution error:', e);
          window.parent.postMessage({ type: 'vibexe-runtime-error', error: String(e) }, '*');
        }
        bundleLoaded = true;

        // Notify parent that bundle is loaded
        window.parent.postMessage({ type: 'vibexe-runtime-bundle-loaded' }, '*');
      }

      // ===== Command Center commands =====
      if (ev.data.type && ev.data.type.indexOf('game-cmd-') === 0) {
        switch (ev.data.type) {
          case 'game-cmd-play':
            window.__vibexe_game_paused__ = false;
            break;
          case 'game-cmd-pause':
            window.__vibexe_game_paused__ = true;
            break;
          case 'game-cmd-step':
            window.__vibexe_step_frame__ = true;
            break;
          case 'game-cmd-reset':
            window.location.reload();
            break;
          case 'game-cmd-time-scale':
            window.__vibexe_time_scale__ = ev.data.scale;
            break;
          case 'game-cmd-request-stats': {
            var s = { fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0, memory: 0 };
            var fpsEl = document.getElementById('__vibexe_fps__');
            if (fpsEl) { var parsed = parseInt(fpsEl.textContent); if (!isNaN(parsed)) s.fps = parsed; }
            if (performance && performance.memory) s.memory = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
            window.parent.postMessage({ type: 'game-cmd-stats-report', stats: s }, '*');
            break;
          }
          case 'game-cmd-start-record': {
            try {
              var canvas = null;
              var app = window.__vibexe_pixiApp__;
              if (app && app.canvas) canvas = app.canvas;
              if (!canvas) canvas = document.querySelector('canvas');
              if (!canvas) { console.error('[2D CommandCenter] No canvas found'); break; }
              var stream = canvas.captureStream(30);
              var mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
              var mr = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 5000000 });
              var chunks = [];
              mr.ondataavailable = function(e) { if (e.data.size > 0) chunks.push(e.data); };
              mr.onstop = function() {
                var blob = new Blob(chunks, { type: 'video/webm' });
                blob.arrayBuffer().then(function(buf) {
                  window.parent.postMessage({ type: 'game-cmd-recording-ready', buffer: buf }, '*', [buf]);
                });
              };
              mr.start(100);
              window.__vibexe_mediaRecorder__ = mr;
            } catch (e) { console.error('[2D CommandCenter] Record start failed:', e.message); }
            break;
          }
          case 'game-cmd-stop-record': {
            var mr2 = window.__vibexe_mediaRecorder__;
            if (mr2 && mr2.state !== 'inactive') mr2.stop();
            window.__vibexe_mediaRecorder__ = null;
            break;
          }
          case 'game-cmd-screenshot': {
            try {
              var cvs = null;
              var pixiApp = window.__vibexe_pixiApp__;
              if (pixiApp && pixiApp.canvas) cvs = pixiApp.canvas;
              if (!cvs) cvs = document.querySelector('canvas');
              if (!cvs) break;
              cvs.toBlob(function(blob) {
                if (!blob) return;
                blob.arrayBuffer().then(function(buf) {
                  window.parent.postMessage({ type: 'game-cmd-screenshot-ready', buffer: buf }, '*', [buf]);
                });
              }, 'image/png');
            } catch (e) { console.error('[2D CommandCenter] Screenshot failed:', e.message); }
            break;
          }
        }
      }

      // Full reload
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

  // Wait for libs to load
  if (window.__vibexe_2d_libs_ready__) {
    initRuntime();
  } else {
    window.addEventListener('vibexe-2d-libs-ready', initRuntime, { once: true });
  }
})();
</script>
</body>
</html>`;

	return new Response(html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-cache",
			"X-Frame-Options": "SAMEORIGIN",
			"Content-Security-Policy": "frame-ancestors 'self'",
		},
	});
}
