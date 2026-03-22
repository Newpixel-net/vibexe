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

<!-- Pixi.js v8 + Proton particle engine -->
<script src="https://cdn.jsdelivr.net/npm/pixi.js@8.9.2/dist/pixi.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/proton-engine@7.1.5/build/proton.min.js"></script>

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
  window.Proton = Proton;
  window.__VIBEXE_API_ORIGIN__ = '${apiOrigin}';

  console.log('[2D Runtime] Pixi.js v' + PIXI.VERSION + ' loaded');
  console.log('[2D Runtime] Proton particle engine v' + (Proton.VERSION || '7.x') + ' loaded');

  // Signal libraries ready
  window.__vibexe_2d_libs_ready__ = true;
  window.dispatchEvent(new Event('vibexe-2d-libs-ready'));
})();
</script>

<!-- Global error handlers -->
<script>
window.onerror = function(msg, url, line, col, err) {
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
