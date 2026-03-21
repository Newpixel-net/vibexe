/**
 * Visual Edit Bridge Script
 *
 * Injected into the Sandpack iframe to enable element selection.
 * Communicates with parent via postMessage.
 * Starts dormant — only activates on "visual-edit-enable" message.
 */

export function getVisualEditBridgeScript(): string {
	return `
(function() {
  var enabled = false;
  var selected = null;
  var hoverOverlay = null;
  var selectOverlay = null;
  var hoverBadge = null;
  var selectBadge = null;
  var dropdownOpen = false;
  var repositionTimer = null;

  var SKIP_SELECTORS = ['html','head','body','#root','script','style','link','meta','title','[id^="ve-"]','noscript','svg path','svg circle','svg rect','svg line','svg polyline','svg polygon'];

  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return true;
    // Skip SVG child elements (path, circle, etc.)
    if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') return true;
    for (var i = 0; i < SKIP_SELECTORS.length; i++) {
      try { if (el.matches(SKIP_SELECTORS[i])) return true; } catch(e) {}
    }
    return false;
  }

  function createOverlay(id, style) {
    var div = document.createElement('div');
    div.id = id;
    div.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;transition:all 0.15s ease;display:none;' + (style || '');
    document.body.appendChild(div);
    return div;
  }

  function createBadge(id) {
    var div = document.createElement('div');
    div.id = id;
    div.style.cssText = 'position:fixed;pointer-events:none;z-index:100000;padding:2px 8px;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border-radius:3px;display:none;white-space:nowrap;line-height:1.4;';
    document.body.appendChild(div);
    return div;
  }

  function positionOverlay(overlay, rect) {
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }

  function positionBadge(badge, rect) {
    badge.style.top = (rect.top - 27) + 'px';
    badge.style.left = (rect.left - 2) + 'px';
  }

  function ensureOverlays() {
    if (!hoverOverlay) {
      hoverOverlay = createOverlay('ve-hover', 'border:2px solid #95a5fc;background:rgba(99,102,241,0.05);');
    }
    if (!selectOverlay) {
      selectOverlay = createOverlay('ve-select', 'border:2px solid #2563EB;background:rgba(37,99,235,0.04);');
    }
    if (!hoverBadge) {
      hoverBadge = createBadge('ve-hover-badge');
      hoverBadge.style.fontWeight = '400';
      hoverBadge.style.color = '#526cff';
      hoverBadge.style.background = '#DBEAFE';
    }
    if (!selectBadge) {
      selectBadge = createBadge('ve-select-badge');
      selectBadge.style.fontWeight = '500';
      selectBadge.style.color = '#ffffff';
      selectBadge.style.background = '#526cff';
    }
  }

  function getUniqueSelector(el) {
    if (el.id) return '#' + el.id;
    var path = [];
    var current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      var tag = current.tagName.toLowerCase();
      if (current.id) { path.unshift('#' + current.id); break; }
      var classes = Array.from(current.classList).filter(function(c) { return !/^(\\\\s)/.test(c); }).slice(0, 3);
      var sel = tag + (classes.length > 0 ? '.' + classes.join('.') : '');
      var parent = current.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(s) { return s.tagName === current.tagName; });
        if (siblings.length > 1) {
          var idx = siblings.indexOf(current) + 1;
          sel += ':nth-of-type(' + idx + ')';
        }
      }
      path.unshift(sel);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  function getComputedStyleMap(el) {
    var cs = window.getComputedStyle(el);
    return {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      opacity: cs.opacity,
      borderRadius: cs.borderRadius,
      padding: cs.padding,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      margin: cs.margin,
      marginTop: cs.marginTop,
      marginRight: cs.marginRight,
      marginBottom: cs.marginBottom,
      marginLeft: cs.marginLeft,
      textAlign: cs.textAlign,
      textDecoration: cs.textDecoration,
      textTransform: cs.textTransform,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      display: cs.display,
      width: cs.width,
      height: cs.height,
      borderWidth: cs.borderWidth,
      borderColor: cs.borderColor,
      boxShadow: cs.boxShadow
    };
  }

  // Detect if element is inside a dynamic list (map/forEach pattern)
  function isDynamicContent(el) {
    var parent = el.parentElement;
    if (!parent) return false;
    var siblings = Array.from(parent.children);
    if (siblings.length < 2) return false;
    // Check if multiple siblings share the same tag and similar class structure
    var tag = el.tagName;
    var cls = el.className;
    var matches = siblings.filter(function(s) { return s.tagName === tag && s.className === cls; });
    return matches.length >= 2;
  }

  // Reposition overlays inside iframe only — no parent notification
  function repositionOverlaysLocal() {
    if (selected) {
      ensureOverlays();
      var rect = selected.getBoundingClientRect();
      positionOverlay(selectOverlay, rect);
      positionBadge(selectBadge, rect);
    }
  }

  // Send position update to parent (for toolbar repositioning)
  var rafPending = false;
  function sendPositionToParent() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function() {
      rafPending = false;
      if (selected) {
        var rect = selected.getBoundingClientRect();
        positionOverlay(selectOverlay, rect);
        positionBadge(selectBadge, rect);
        window.parent.postMessage({
          type: 'visual-edit-position-update',
          boundingRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        }, '*');
      }
    });
  }

  function debouncedRepositionLocal() {
    if (repositionTimer) clearTimeout(repositionTimer);
    repositionTimer = setTimeout(repositionOverlaysLocal, 50);
  }

  function onMouseOver(e) {
    if (!enabled || dropdownOpen) return;
    var el = e.target;
    if (shouldSkip(el)) return;
    if (el === selected) return;
    ensureOverlays();
    var rect = el.getBoundingClientRect();
    positionOverlay(hoverOverlay, rect);
    hoverOverlay.style.display = 'block';
    hoverBadge.textContent = el.tagName.toLowerCase();
    positionBadge(hoverBadge, rect);
    // Only show badge if there's room above
    hoverBadge.style.display = rect.top > 30 ? 'block' : 'none';
  }

  function onMouseOut(e) {
    if (!enabled) return;
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    if (hoverBadge) hoverBadge.style.display = 'none';
  }

  function onClick(e) {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    if (shouldSkip(el)) return;
    selected = el;
    ensureOverlays();
    var rect = el.getBoundingClientRect();
    positionOverlay(selectOverlay, rect);
    selectOverlay.style.display = 'block';
    selectBadge.textContent = el.tagName.toLowerCase();
    positionBadge(selectBadge, rect);
    selectBadge.style.display = rect.top > 30 ? 'block' : 'none';
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    if (hoverBadge) hoverBadge.style.display = 'none';

    window.parent.postMessage({
      type: 'visual-edit-select',
      tagName: el.tagName.toLowerCase(),
      className: el.className || '',
      textContent: (el.textContent || '').slice(0, 200),
      innerHTML: (el.innerHTML || '').slice(0, 500),
      boundingRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      selector: getUniqueSelector(el),
      computedStyles: getComputedStyleMap(el),
      isDynamicContent: isDynamicContent(el)
    }, '*');
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && enabled) {
      if (selected) {
        selected = null;
        if (selectOverlay) selectOverlay.style.display = 'none';
        if (selectBadge) selectBadge.style.display = 'none';
        window.parent.postMessage({ type: 'visual-edit-deselect' }, '*');
      }
    }
  }

  // MutationObserver to reposition overlays when DOM changes
  var observer = null;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(debouncedRepositionLocal);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'width', 'height'],
      childList: true
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function activate() {
    enabled = true;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', sendPositionToParent, true);
    window.addEventListener('resize', sendPositionToParent);
    startObserver();
  }

  function deactivate() {
    enabled = false;
    selected = null;
    dropdownOpen = false;
    document.body.style.cursor = '';
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', sendPositionToParent, true);
    window.removeEventListener('resize', sendPositionToParent);
    stopObserver();
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    if (selectOverlay) selectOverlay.style.display = 'none';
    if (hoverBadge) hoverBadge.style.display = 'none';
    if (selectBadge) selectBadge.style.display = 'none';
  }

  function handleHighlight(selector) {
    try {
      var el = document.querySelector(selector);
      if (el) {
        ensureOverlays();
        var rect = el.getBoundingClientRect();
        positionOverlay(selectOverlay, rect);
        selectOverlay.style.display = 'block';
        selectBadge.textContent = el.tagName.toLowerCase();
        positionBadge(selectBadge, rect);
        selectBadge.style.display = rect.top > 30 ? 'block' : 'none';
        selected = el;
      }
    } catch(e) {}
  }

  function handleUpdateStyle(selector, property, value) {
    try {
      var el = document.querySelector(selector);
      if (!el) return;
      if (property === 'className') {
        el.className = value;
        return;
      }
      el.style[property] = value;
    } catch(e) {}
  }

  function handleUpdateContent(selector, content) {
    try {
      var el = document.querySelector(selector);
      if (el) el.textContent = content;
    } catch(e) {}
  }

  // App readiness observer — watches #root for content and notifies parent
  (function observeReady() {
    var notified = false;
    function checkRoot() {
      if (notified) return;
      var root = document.getElementById('root');
      if (root && root.children.length > 0 && root.innerHTML.length > 50) {
        notified = true;
        window.parent.postMessage({ type: 'vibexe-app-ready' }, '*');
      }
    }
    // Check immediately in case content already rendered
    checkRoot();
    // Observe DOM mutations on #root
    var readyObs = new MutationObserver(function() { checkRoot(); });
    var root = document.getElementById('root');
    if (root) {
      readyObs.observe(root, { childList: true, subtree: true });
    } else {
      // #root not yet in DOM, wait for it
      var bodyObs = new MutationObserver(function() {
        var r = document.getElementById('root');
        if (r) {
          bodyObs.disconnect();
          checkRoot();
          readyObs.observe(r, { childList: true, subtree: true });
        }
      });
      if (document.body) bodyObs.observe(document.body, { childList: true });
      else document.addEventListener('DOMContentLoaded', function() {
        var r = document.getElementById('root');
        if (r) { checkRoot(); readyObs.observe(r, { childList: true, subtree: true }); }
      });
    }
    // Hard fallback: notify after 10s regardless
    setTimeout(function() {
      if (!notified) { notified = true; window.parent.postMessage({ type: 'vibexe-app-ready' }, '*'); }
    }, 10000);
  })();

  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || !d.type) return;
    switch(d.type) {
      case 'visual-edit-enable': activate(); break;
      case 'visual-edit-disable': deactivate(); break;
      case 'visual-edit-highlight': handleHighlight(d.selector); break;
      case 'visual-edit-update-style': handleUpdateStyle(d.selector, d.property, d.value); break;
      case 'visual-edit-update-content': handleUpdateContent(d.selector, d.content); break;
      case 'visual-edit-deselect-cmd':
        selected = null;
        if (selectOverlay) selectOverlay.style.display = 'none';
        if (selectBadge) selectBadge.style.display = 'none';
        break;
      case 'visual-edit-dropdown-state':
        dropdownOpen = !!d.open;
        break;
      case 'vibexe-capture':
        (function() {
          // Check for Canvas game first — html2canvas cannot capture WebGL/Canvas2D content
          var gameCanvas = document.querySelector('canvas');
          if (gameCanvas && gameCanvas.width > 200 && gameCanvas.height > 200) {
            try {
              var canvasDataUrl = gameCanvas.toDataURL('image/png');
              window.parent.postMessage({
                type: 'vibexe-capture-result',
                dataUrl: canvasDataUrl,
                fullWidth: gameCanvas.width,
                fullHeight: gameCanvas.height
              }, '*');
              return;
            } catch (e) {
              // Canvas tainted (cross-origin) — fall through to html2canvas
            }
          }

          // Step 1: Force minimum dimensions on html/body/root BEFORE capture
          // This ensures content has proper layout even if Tailwind CDN hasn't processed
          var captureStyle = document.createElement('style');
          captureStyle.textContent = 'html, body { min-height: 720px !important; min-width: 1280px !important; } #root { min-height: 720px !important; }';
          document.head.appendChild(captureStyle);
          document.body.style.minHeight = '720px';
          document.documentElement.style.minHeight = '720px';
          var rootEl = document.getElementById('root');
          if (rootEl) rootEl.style.minHeight = '720px';

          // Step 2: Load html2canvas after a brief reflow delay
          setTimeout(function() {
            var script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = function() {
              // Wait for body to have real content height (Tailwind CDN needs time)
              var attempts = 0;
              var maxAttempts = 20; // 20 * 500ms = 10s max
              function waitForContent() {
                attempts++;
                var h = document.body.scrollHeight;
                if (h > 200 || attempts >= maxAttempts) {
                  doCapture();
                } else {
                  setTimeout(waitForContent, 500);
                }
              }
              function doCapture() {
                // Scroll to bottom then back to top to trigger lazy-loaded content
                window.scrollTo(0, document.body.scrollHeight);
                setTimeout(function() {
                  window.scrollTo(0, 0);
                  setTimeout(function() {
                    var fullHeight = Math.max(document.body.scrollHeight, 720);
                    fullHeight = Math.min(fullHeight, 5000);
                    html2canvas(document.body, {
                      useCORS: true,
                      scale: 1,
                      width: 1280,
                      windowWidth: 1280,
                      height: fullHeight,
                      windowHeight: fullHeight,
                      backgroundColor: '#ffffff'
                    }).then(function(canvas) {
                      // Ensure minimum 1280x720 output canvas
                      var finalCanvas = canvas;
                      if (canvas.width < 1280 || canvas.height < 720) {
                        finalCanvas = document.createElement('canvas');
                        finalCanvas.width = Math.max(canvas.width, 1280);
                        finalCanvas.height = Math.max(canvas.height, 720);
                        var ctx = finalCanvas.getContext('2d');
                        if (ctx) {
                          ctx.fillStyle = '#ffffff';
                          ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
                          ctx.drawImage(canvas, 0, 0);
                        }
                      }
                      var dataUrl = finalCanvas.toDataURL('image/png');
                      window.parent.postMessage({
                        type: 'vibexe-capture-result',
                        dataUrl: dataUrl,
                        fullWidth: finalCanvas.width,
                        fullHeight: finalCanvas.height
                      }, '*');
                    }).catch(function(err) {
                      window.parent.postMessage({ type: 'vibexe-capture-error', error: err.message || 'Capture failed' }, '*');
                    });
                  }, 500);
                }, 500);
              }
              waitForContent();
            };
            script.onerror = function() {
              window.parent.postMessage({ type: 'vibexe-capture-error', error: 'Failed to load html2canvas' }, '*');
            };
            document.head.appendChild(script);
          }, 300);
        })();
        break;
    }
  });
})();

// ===== Game Editor Bridge =====
// Second IIFE — handles 3D scene editing (raycaster, TransformControls, scene tree).
// Polls for THREE.js availability (handles async CDN loading order).
(function() {
  function initBridge() {
  var active = false;
  var raycaster = null;
  var mouse = null;
  var selectedObj = null;
  var selectedObjName = "";
  var boxHelper = null;
  var multiBoxHelpers = [];
  var transformControls = null;
  var tcHelperObj = null; // TC helper (from getHelper()) — must survive editor sweep
  var editor = null;
  var editorAnimId = 0;
  var lastClickTime = 0;
  var lastClickUuid = "";
  var isDragging = false;
  var dragPlane = null;
  var dragOffset = null;
  var dragStartPos = null;
  var undoStack = [];
  var redoStack = [];
  var gridSnap = false;
  var gridSnapIncrement = 0.5;
  var rotationSnapDeg = 15;
  var gizmoSpace = "world";
  var panToolActive = false;
  var _lastCamBroadcast = 0;
  var _lastCamQ = { x: 0, y: 0, z: 0, w: 1 };
  var _savedOrbitMouseButtons = null; // Save game's original orbit mouseButtons
  var _savedCameraPos = null;
  var _savedCameraQuat = null;
  var _savedOrbitTarget = null;
  // Saved renderer state (restored on deactivation to prevent Game mode degradation)
  var _savedPixelRatio = null;
  var _savedShadowMapType = null;
  var _savedShadowAutoUpdate = null;
  var _savedShadowEnabled = null;
  var _savedSkipComposer = null;
  // Persisted camera position/target from parent (survives reload / Scene↔Game transitions)
  var _restoreCameraPos = null;
  var _restoreCameraTarget = null;
  var _lastCamSave = 0;
  var gridHelper = null;
  // Camera Preview PIP
  var previewCamera = null;
  // pipFrameCounter removed — PIP now renders every frame
  // Camera Frustum Helper
  var cameraHelper = null;
  var cameraSelected = false;
  // Pivot mode
  var pivotMode = "center";
  // Projection mode
  var editorProjectionMode = "perspective";
  var canvasPointerDownHandler = null;
  var bodyMouseDownHandler = null;
  // Flythrough mode (right-click hold + WASD, Unity-style)
  var flyMode = false;
  var flyKeys = {};
  var flyRMBDown = false;
  var flyLastMouse = null;
  // Terrain sculpt state (persists across messages)
  var _sculptActive = false;
  var _sculptBrushType = "raise";
  var _sculptBrushSize = 10;
  var _sculptBrushStrength = 0.3;
  var _sculptBrushFalloff = "gaussian";
  var _sculptMouseDown = false;
  var _sculptBrushMesh = null;
  var _sculptTargetHeight = 0;
  var _sculptBrushHardness = 0.5; // 0=soft edge, 1=hard edge
  var _sculptBrushOpacity = 1.0;  // multiplier on paint strength
  var _sculptBrushSpacing = 0.25; // distance-based stamp spacing (fraction of brush size)
  var _sculptBrushJitter = 0.0;   // random offset as fraction of brush size
  var _sculptLastStampPos = null;  // {x,z} for distance-based stamping
  var _sculptBrushColor = null;   // hex color for brush ring in paint mode
  // Weight painting state — per-vertex painted weights override modifier-computed weights
  var _paintLayerIndex = 0; // which layer index to paint (0-7)
  var _paintedWeights = null; // Float32Array[vertexCount * 8] or null if no painting done

  function applySculptBrush(wx, wz) {
    var terrain = editor.scene.getObjectByName("__terrain__");
    if (!terrain) return;
    var geo = terrain.geometry;
    var pos = geo.attributes.position;
    var td = window.__vibexe_terrainData;
    if (!td) return;

    var R = _sculptBrushSize;
    var str = _sculptBrushStrength;
    var R2 = R * R;
    var modified = false;

    for (var vi = 0; vi < pos.count; vi++) {
      var vx = pos.getX(vi);
      var vz = pos.getZ(vi);
      var dx = vx - wx;
      var dz = vz - wz;
      var dist2 = dx * dx + dz * dz;
      if (dist2 > R2) continue;

      var dist = Math.sqrt(dist2);
      var alpha;
      if (_sculptBrushFalloff === "flat") {
        alpha = 1.0;
      } else if (_sculptBrushFalloff === "linear") {
        alpha = 1.0 - dist / R;
      } else {
        var t = dist / R;
        alpha = Math.exp(-t * t * 3.0);
      }
      // Apply hardness: lerp between soft falloff and hard (flat) edge
      alpha = alpha + (1.0 - alpha) * _sculptBrushHardness;
      // Apply opacity multiplier
      alpha *= _sculptBrushOpacity;

      var curY = pos.getY(vi);

      // Weight painting mode — paint directly to layer weights
      if (_sculptBrushType === "paint" || _sculptBrushType === "erase") {
        // Initialize painted weights array on first paint
        if (!_paintedWeights) {
          _paintedWeights = new Float32Array(pos.count * 8);
          for (var pw = 0; pw < _paintedWeights.length; pw++) _paintedWeights[pw] = -1;
        }
        var baseIdx = vi * 8;
        // If this vertex hasn't been painted yet, initialize from current weightsA/weightsB
        if (_paintedWeights[baseIdx] < 0) {
          var wAttrA = geo.attributes.weightsA;
          var wAttrB = geo.attributes.weightsB;
          _paintedWeights[baseIdx]     = wAttrA ? wAttrA.getX(vi) : 1;
          _paintedWeights[baseIdx + 1] = wAttrA ? wAttrA.getY(vi) : 0;
          _paintedWeights[baseIdx + 2] = wAttrA ? wAttrA.getZ(vi) : 0;
          _paintedWeights[baseIdx + 3] = wAttrA ? wAttrA.getW(vi) : 0;
          _paintedWeights[baseIdx + 4] = wAttrB ? wAttrB.getX(vi) : 0;
          _paintedWeights[baseIdx + 5] = wAttrB ? wAttrB.getY(vi) : 0;
          _paintedWeights[baseIdx + 6] = wAttrB ? wAttrB.getZ(vi) : 0;
          _paintedWeights[baseIdx + 7] = wAttrB ? wAttrB.getW(vi) : 0;
        }
        // Add to target layer, reduce others
        var paintDelta = alpha * str * (_sculptBrushType === "erase" ? -1 : 1);
        _paintedWeights[baseIdx + _paintLayerIndex] = Math.max(0, Math.min(1, _paintedWeights[baseIdx + _paintLayerIndex] + paintDelta));
        // Renormalize so all 8 weights sum to 1
        var wSum2 = 0;
        for (var ni2 = 0; ni2 < 8; ni2++) wSum2 += Math.max(0, _paintedWeights[baseIdx + ni2]);
        if (wSum2 > 0.001) {
          for (var ni3 = 0; ni3 < 8; ni3++) _paintedWeights[baseIdx + ni3] = Math.max(0, _paintedWeights[baseIdx + ni3]) / wSum2;
        }
        // Write directly to weightsA/weightsB vec4 attributes
        var wAttrAw = geo.attributes.weightsA;
        var wAttrBw = geo.attributes.weightsB;
        if (wAttrAw) wAttrAw.setXYZW(vi, _paintedWeights[baseIdx], _paintedWeights[baseIdx+1], _paintedWeights[baseIdx+2], _paintedWeights[baseIdx+3]);
        if (wAttrBw) wAttrBw.setXYZW(vi, _paintedWeights[baseIdx+4], _paintedWeights[baseIdx+5], _paintedWeights[baseIdx+6], _paintedWeights[baseIdx+7]);
        modified = true;
      } else {
        // Regular sculpt modes (raise/lower/flatten/smooth) — modify height
        switch (_sculptBrushType) {
          case "raise":
            pos.setY(vi, curY + alpha * str);
            break;
          case "lower":
            pos.setY(vi, curY - alpha * str);
            break;
          case "flatten":
            pos.setY(vi, curY + (_sculptTargetHeight - curY) * alpha * str);
            break;
          case "smooth": {
            var gx = vi % td.segX;
            var gz = Math.floor(vi / td.segX);
            var sum = 0, cnt = 0;
            for (var nz = -1; nz <= 1; nz++) {
              for (var nx = -1; nx <= 1; nx++) {
                var ngx = gx + nx, ngz = gz + nz;
                if (ngx >= 0 && ngx < td.segX && ngz >= 0 && ngz < td.segZ) {
                  var ni = ngz * td.segX + ngx;
                  if (ni < pos.count) {
                    sum += pos.getY(ni);
                    cnt++;
                  }
                }
              }
            }
            var avg = cnt > 0 ? sum / cnt : curY;
            pos.setY(vi, curY + (avg - curY) * alpha * str);
            break;
          }
        }

        if (vi < td.heightData.length) {
          td.heightData[vi] = pos.getY(vi);
        }
      }
      modified = true;
    }

    if (modified) {
      // For paint mode, only update weight attributes (no geometry/physics changes)
      if (_sculptBrushType === "paint" || _sculptBrushType === "erase") {
        if (geo.attributes.weightsA) geo.attributes.weightsA.needsUpdate = true;
        if (geo.attributes.weightsB) geo.attributes.weightsB.needsUpdate = true;
        return; // Skip height/normal/physics updates
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      // Recompute minY/maxY so height normalization stays correct after sculpting
      var newMinY = Infinity, newMaxY = -Infinity;
      for (var mi = 0; mi < pos.count; mi++) {
        var yy = pos.getY(mi);
        if (yy < newMinY) newMinY = yy;
        if (yy > newMaxY) newMaxY = yy;
      }
      td.minY = newMinY;
      td.maxY = newMaxY;
      var hAttr = geo.attributes.terrainHeight;
      var sAttr = geo.attributes.terrainSlope;
      if (hAttr && sAttr) {
        var norms = geo.attributes.normal;
        var hRange = td.maxY - td.minY || 1;
        for (var ui = 0; ui < pos.count; ui++) {
          var nh = (pos.getY(ui) - td.minY) / hRange;
          hAttr.setX(ui, Math.max(0, Math.min(1, nh)));
          var ny = norms.getY(ui);
          sAttr.setX(ui, Math.acos(Math.abs(ny)) * (180 / Math.PI));
        }
        hAttr.needsUpdate = true;
        sAttr.needsUpdate = true;
      }

      // === Update CANNON Heightfield after sculpt ===
      if (window.__vibexe_terrainBody && window.__vibexe_terrainHFShape && window.CANNON) {
        var _suWorld = window.__vibexe_world__;
        if (_suWorld) {
          try {
            // Rebuild the height matrix from updated heightData
            var _suMatrix = [];
            for (var sx = 0; sx < td.segX; sx++) {
              _suMatrix.push([]);
              for (var sz = 0; sz < td.segZ; sz++) {
                _suMatrix[sx].push(td.heightData[(td.segZ - 1 - sz) * td.segX + sx]);
              }
            }
            // Remove old body, create new heightfield with updated data
            _suWorld.removeBody(window.__vibexe_terrainBody);
            var _suElementSize = td.width / (td.segX - 1);
            var _suShape = new window.CANNON.Heightfield(_suMatrix, { elementSize: _suElementSize });
            var _suBody = new window.CANNON.Body({ mass: 0, type: window.CANNON.Body.STATIC });
            _suBody.addShape(_suShape);
            _suBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
            _suBody.position.set(-td.width / 2, 0, td.depth / 2);
            _suWorld.addBody(_suBody);
            window.__vibexe_terrainBody = _suBody;
            window.__vibexe_terrainHFShape = _suShape;
          } catch(suErr) {
            console.warn("[TerrainPhysics] Sculpt heightfield update failed:", suErr);
          }
        }
      }
      // Rebuild Rapier trimesh after sculpt (debounced — 500ms after last stroke)
      if (window.__vibexe_rebuildRapierTerrain) {
        if (window.__vibexe_rapierTerrainRebuildTimer) clearTimeout(window.__vibexe_rapierTerrainRebuildTimer);
        window.__vibexe_rapierTerrainRebuildTimer = setTimeout(function() {
          window.__vibexe_rapierTerrainRebuildTimer = null;
          window.__vibexe_rebuildRapierTerrain();
        }, 500);
      }
    }
  }

  // PBR environment state
  var _pbrEnvReady = false;
  var _toneMapReady = false;
  // Cheap: tone mapping + exposure + light floor + duplicate cleanup — safe to call always
  function _ensureToneMapping() {
    if (_toneMapReady) return;
    var T = window.THREE;
    if (!T || !editor || !editor.scene || !editor.renderer) return;
    _toneMapReady = true;
    // Ensure ACES tone mapping + correct exposure for r183 PBR
    editor.renderer.toneMapping = T.ACESFilmicToneMapping;
    editor.renderer.toneMappingExposure = 1.0;
    // PBR light floor for r183 physically-based rendering (/PI energy conservation)
    // MeshStandardMaterial divides light by PI (~3.14), so we need ~3x r172 values.
    // ACES tonemapping compresses the range, so total ~3.0 is a good target.
    var _al = editor.scene.getObjectByName('__default_ambient__') || editor.scene.getObjectByName('AmbientLight');
    if (_al) _al.intensity = Math.max(_al.intensity, 0.3);
    var _hl = editor.scene.getObjectByName('__default_hemi__') || editor.scene.getObjectByName('HemisphereLight');
    if (_hl) _hl.intensity = Math.max(_hl.intensity, 0.8);
    var _sl = editor.scene.getObjectByName('__default_sun__') || editor.scene.getObjectByName('DirectionalLight');
    if (_sl) _sl.intensity = Math.max(_sl.intensity, 2.5);
    // Remove duplicate lights — keep only one of each type
    var _seenHemi = false, _seenAmb = false, _seenSun = false;
    var _dupes = [];
    editor.scene.traverse(function(obj) {
      if (obj.isHemisphereLight) { if (_seenHemi) _dupes.push(obj); else _seenHemi = true; }
      if (obj.isAmbientLight && !obj.isHemisphereLight) { if (_seenAmb) _dupes.push(obj); else _seenAmb = true; }
      if (obj.isDirectionalLight) { if (_seenSun) _dupes.push(obj); else _seenSun = true; }
    });
    for (var _dhi = 0; _dhi < _dupes.length; _dhi++) {
      editor.scene.remove(_dupes[_dhi]);
      console.log("[Bridge] Removed duplicate light:", _dupes[_dhi].type, _dupes[_dhi].name);
    }
    console.log("[GameEditorBridge] Tone mapping + light floor applied");
  }

  function _ensurePBREnv() {
    _ensureToneMapping(); // Always apply tone mapping first
    if (_pbrEnvReady) return;
    var T = window.THREE;
    if (!T || !editor || !editor.scene || !editor.renderer) return;
    _pbrEnvReady = true;
    // Deferred env map — PMREMGenerator.fromScene() is extremely expensive on WebGPU
    // (compiles 6+ cube face shaders, blocks main thread). Defer to avoid FPS=1 on init.
    setTimeout(function() {
      if (!editor || !editor.scene || !editor.renderer) return;
      try {
        var pmrem = new T.PMREMGenerator(editor.renderer);
        pmrem.compileEquirectangularShader();
        var envScene = new T.Scene();
        var skyGeo = new T.SphereGeometry(50, 32, 16);
        envScene.add(new T.Mesh(skyGeo, new T.MeshBasicMaterial({ color: new T.Color(0.35, 0.4, 0.55), side: T.BackSide })));
        var gndGeo = new T.SphereGeometry(49, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        envScene.add(new T.Mesh(gndGeo, new T.MeshBasicMaterial({ color: new T.Color(0.15, 0.13, 0.1), side: T.BackSide })));
        var pGeo = new T.PlaneGeometry(8, 8);
        var _addP = function(x, y, z, r, g, b, sx, sy) {
          var p = new T.Mesh(pGeo, new T.MeshBasicMaterial({ color: new T.Color(r, g, b), side: T.DoubleSide }));
          p.position.set(x, y, z); p.lookAt(0, 0, 0); p.scale.set(sx, sy, 1);
          envScene.add(p);
        };
        _addP(0, 45, -10, 4, 3.5, 3, 2, 2);      // Key light (moderate)
        _addP(-15, 40, 25, 2, 2, 2.5, 1.5, 1.5);  // Rim light
        _addP(35, 20, -15, 1.5, 1.5, 2, 2, 2);    // Fill (subtle)
        editor.scene.environment = pmrem.fromScene(envScene, 0, 0.1, 100).texture;
        if (editor.scene.environmentIntensity !== undefined) editor.scene.environmentIntensity = 0.6;
        pmrem.dispose(); skyGeo.dispose(); gndGeo.dispose(); pGeo.dispose();
        console.log("[GameEditorBridge] Deferred env map applied");
      } catch (e) { console.warn("[GameEditorBridge] env map error:", e); }
    }, 1500);
    console.log("[GameEditorBridge] PBR env v47 (deferred)");
  }
  var flyMouseMoveHandler = null;
  var flyRMBDownHandler = null;
  var flyRMBUpHandler = null;
  var flyKeyUpHandler = null;
  var flyWheelHandler = null;
  var flyContextMenuHandler = null;

  // Signal that external bridge is loaded — embedded bridge (game-3d-templates.ts) defers to us
  window.__vibexeExternalBridge = true;
  // Enable flag: set to true only by explicit game-editor-enable message, cleared on disable
  var _enableRequested = false;

  // Notify parent that game editor bridge is ready
  try {
    window.parent.postMessage({ type: "game-editor-bridge-loaded" }, "*");
  } catch(e) {}

  // Wait for __vibexe_editor__ to appear (Game3D.tsx exposes it after menu dismiss)
  function waitForEditor(cb) {
    if (window.__vibexe_editor__) { cb(window.__vibexe_editor__); return; }
    var attempts = 0;
    var timer = setInterval(function() {
      if (window.__vibexe_editor__) {
        clearInterval(timer);
        cb(window.__vibexe_editor__);
      } else if (++attempts > 200) {
        clearInterval(timer);
        console.warn("[GameEditorBridge] Timed out waiting for __vibexe_editor__");
      }
    }, 50);
  }

  // ---- Ground plane detection ----
  // Game3D.tsx creates a large invisible-ish PlaneGeometry for physics. Skip it from raycasting + tree.
  function isGroundPlane(obj) {
    if (!obj || !obj.isMesh || obj.name) return false;
    var geo = obj.geometry;
    if (!geo || geo.type !== "PlaneGeometry") return false;
    var p = geo.parameters;
    return p && (p.width >= 50 || p.height >= 50);
  }

  // Strip non-serializable values from userData for postMessage
  function safeUserData(ud) {
    if (!ud || typeof ud !== "object") return {};
    var safe = {};
    var keys = Object.keys(ud);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = ud[k];
      if (typeof v === "function") continue;
      if (v && typeof v === "object") {
        if (v.isObject3D || v.isBufferGeometry || v.isMaterial || v.isTexture || v instanceof HTMLElement) continue;
        try { safe[k] = JSON.parse(JSON.stringify(v)); } catch(e) { continue; }
      } else {
        safe[k] = v;
      }
    }
    return safe;
  }

  // ---- Scene Serializer ----
  function serializeNode(obj) {
    if (!obj) return null;
    if (isGroundPlane(obj)) return null;
    var children = [];
    if (obj.children) {
      for (var i = 0; i < obj.children.length; i++) {
        var child = obj.children[i];
        if (child === boxHelper || child === transformControls || child === cameraHelper || child === previewCamera) continue;
        if (child.name === "__editor_preview_cam__") continue;
        if (child.type === "BoxHelper" || child.type === "TransformControlsGizmo" || child.type === "TransformControlsPlane" || child.type === "CameraHelper") continue;
        if (child.isTransformControls) continue;
        // Skip particles, trails, and Points objects (VFX internals)
        if (child.type === "Points") continue;
        if (child.name && (child.name.indexOf("__particle_") === 0 || child.name.indexOf("__trail_") === 0)) continue;
        // Skip population preview overlays and spawned population objects
        if (child.name && (child.name.indexOf("__pop_") === 0 || child.name.indexOf("pop_") === 0)) continue;
        // Skip cameras (view camera is not a scene object — selecting it draws
        // a confusing green BoxHelper around the viewport) and water meshes
        // (managed by the water panel, not the scene hierarchy)
        if (child.isCamera) continue;
        // Skip water internal helpers but show main water bodies in hierarchy
        if (child.name && child.name.indexOf("__water") === 0) continue;
        var s = serializeNode(child);
        if (s) children.push(s);
      }
    }
    var matColor = null;
    if (obj.material && obj.material.color) {
      try { matColor = "#" + obj.material.color.getHexString(); } catch(e) {}
    }
    if (!matColor && obj.isGroup && obj.children) {
      for (var j = 0; j < obj.children.length; j++) {
        var c = obj.children[j];
        if (c.material && c.material.color) {
          try { matColor = "#" + c.material.color.getHexString(); } catch(e) {}
          break;
        }
      }
    }
    return {
      uuid: obj.uuid, name: obj.name || obj.type, type: obj.type || "Object3D",
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: { x: obj.rotation.x*180/Math.PI, y: obj.rotation.y*180/Math.PI, z: obj.rotation.z*180/Math.PI },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      visible: obj.visible !== false, userData: safeUserData(obj.userData), children: children,
      _isMesh: !!obj.isMesh, _isLight: !!obj.isLight, _isGroup: !!obj.isGroup, _isLocked: !!(obj.userData && obj.userData.__editorLocked), _materialColor: matColor
    };
  }

  var _sceneTreeTimer = null;
  var _sceneTreeQueued = false;
  function sendSceneTreeThrottled() {
    if (_sceneTreeTimer) { _sceneTreeQueued = true; return; }
    sendSceneTree();
    _sceneTreeTimer = setTimeout(function() { _sceneTreeTimer = null; if (_sceneTreeQueued) { _sceneTreeQueued = false; sendSceneTree(); } }, 200);
  }
  function sendSceneTree() {
    if (!editor || !editor.scene) return;
    var tree = serializeNode(editor.scene);
    // Inject synthetic "Main Camera" node at top of hierarchy
    if (tree && tree.children && previewCamera) {
      if (!cameraSelected) updatePreviewCamera();
      tree.children.unshift({
        uuid: "__game_camera__",
        name: "Main Camera",
        type: "PerspectiveCamera",
        position: { x: +previewCamera.position.x.toFixed(2), y: +previewCamera.position.y.toFixed(2), z: +previewCamera.position.z.toFixed(2) },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        visible: true,
        userData: { _isSyntheticCameraNode: true },
        children: []
      });
    }
    window.parent.postMessage({ type: "game-editor-scene-tree", tree: tree }, "*");
  }

  function sendSelectedObject(obj) {
    if (!obj) { window.parent.postMessage({ type: "game-editor-object-deselected" }, "*"); return; }
    var matColor = null;
    if (obj.material && obj.material.color) {
      try { matColor = "#" + obj.material.color.getHexString(); } catch(e) {}
    }
    // Fallback: check child meshes for color (Groups like platforms/characters)
    if (!matColor && obj.isGroup && obj.children) {
      for (var ci = 0; ci < obj.children.length; ci++) {
        var cc = obj.children[ci];
        if (cc.material && cc.material.color) {
          try { matColor = "#" + cc.material.color.getHexString(); } catch(e) {}
          break;
        }
      }
    }
    var msg = {
      type: "game-editor-object-selected", uuid: obj.uuid, name: obj.name || obj.type,
      objType: obj.userData && obj.userData.vibexeType || obj.type,
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: { x: obj.rotation.x*180/Math.PI, y: obj.rotation.y*180/Math.PI, z: obj.rotation.z*180/Math.PI },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      visible: obj.visible !== false, castShadow: !!obj.castShadow,
      userData: safeUserData(obj.userData), _materialColor: matColor,
      _modelUrl: obj.userData && (obj.userData.__modelUrl || (obj.userData.vibexeArgs && obj.userData.vibexeArgs.modelUrl)) || null,
      _textureUrl: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureUrl || null,
      _textureTileX: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureTileX || 1,
      _textureTileY: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureTileY || 1,
      _textureRotation: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureRotation || 0,
      _textureOffsetX: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureOffsetX || 0,
      _textureOffsetY: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureOffsetY || 0,
      _hasPBR: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.hasPBR || false
    };
    // Include light properties for ANY light (not just editor-added ones)
    if (obj.isLight) {
      msg._isEditorLight = true;
      msg._lightType = obj.type === "SpotLight" ? "spot" : obj.type === "PointLight" ? "point" : obj.type === "DirectionalLight" ? "directional" : "hemi";
      try { msg._lightColor = "#" + obj.color.getHexString(); } catch(e) { msg._lightColor = "#ffffff"; }
      msg._lightIntensity = obj.intensity != null ? obj.intensity : 1;
      if (obj.distance != null) msg._lightDistance = obj.distance;
      if (obj.decay != null) msg._lightDecay = obj.decay;
      if (obj.angle != null) msg._lightAngle = obj.angle;
      if (obj.penumbra != null) msg._lightPenumbra = obj.penumbra;
    }
    window.parent.postMessage(msg, "*");

    // When a water mesh is selected, tell water panel to switch to that body
    if (obj.userData && obj.userData.__isWater && obj.userData.__waterBodyId) {
      window.parent.postMessage({
        type: "stylized-water-body-selected-from-scene",
        bodyId: obj.userData.__waterBodyId
      }, "*");
    }
  }

  // ---- Selection ----
  function deselectObject() {
    if (boxHelper && editor) { editor.scene.remove(boxHelper); if (boxHelper.dispose) boxHelper.dispose(); boxHelper = null; }
    // TC is reused across selections — only detach, don't dispose/remove/null
    if (transformControls) transformControls.detach();
    // Sweep: remove ALL stale __editor_ objects (handles duplicates from embedded bridge)
    if (editor && editor.scene) {
      var stale = [];
      for (var i = 0; i < editor.scene.children.length; i++) {
        var c = editor.scene.children[i];
        // Skip TC helper — it's reused across selections, not disposable here
        if (c.name === "__editor_transform_controls__") continue;
        if (c.name && c.name.indexOf("__editor_") === 0) stale.push(c);
      }
      for (var j = 0; j < stale.length; j++) {
        if (stale[j].detach) stale[j].detach();
        editor.scene.remove(stale[j]);
        if (stale[j].dispose) stale[j].dispose();
      }
    }
    selectedObj = null;
    selectedObjName = "";
    destroyCameraHelper();
    // Auto-revert pivot mode on deselect
    if (pivotMode !== "center") {
      pivotMode = "center";
      window.parent.postMessage({ type: "game-editor-pivot-mode-changed", mode: "center" }, "*");
    }
    window.parent.postMessage({ type: "game-editor-object-deselected" }, "*");
  }

  function clearMultiHighlight() {
    if (!editor) return;
    for (var i = 0; i < multiBoxHelpers.length; i++) {
      editor.scene.remove(multiBoxHelpers[i]);
      if (multiBoxHelpers[i].dispose) multiBoxHelpers[i].dispose();
    }
    multiBoxHelpers = [];
  }

  function setMultiHighlight(uuids) {
    clearMultiHighlight();
    if (!editor || !uuids || uuids.length === 0) return;
    var THREE = window.THREE;
    for (var i = 0; i < uuids.length; i++) {
      var obj = findByUuid(editor.scene, uuids[i]);
      if (!obj) continue;
      // Skip the currently selected object (it already has boxHelper)
      if (selectedObj && selectedObj.uuid === obj.uuid) continue;
      var bh = new THREE.BoxHelper(obj, 0x4488ff);
      bh.name = "__editor_multi_box_" + i + "__";
      editor.scene.add(bh);
      multiBoxHelpers.push(bh);
    }
  }

  function selectObject(obj, fromHierarchy) {
    if (!obj || !editor) return;
    // Don't select population (pop_xxx) objects
    var _n = obj.name || "";
    if (_n.indexOf("pop_") === 0) return;
    // Block infrastructure (__xxx) selection only from viewport clicks, not from hierarchy
    if (!fromHierarchy && _n.indexOf("__") === 0) return;
    // Skip water internal helpers but allow main water body selection
    if (_n.indexOf("__water") === 0) return;
    if (obj.isCamera) return;
    // Never attach TransformControls to the scene root — causes infinite recursion in updateMatrixWorld
    // Triple-check: reference equality, type check, AND parent check (scene root has no parent)
    if (obj === editor.scene || obj.type === "Scene" || !obj.parent) {
      showDebug("SKIP: cannot select scene root (type=" + obj.type + " parent=" + !!obj.parent + ")");
      return;
    }
    // Dedup: skip if already selected (prevents duplicate TC attach logs + unnecessary work)
    if (selectedObj && selectedObj.uuid === obj.uuid) {
      showDebug("DEDUP: already selected " + (obj.name || obj.uuid.slice(0,8)));
      return;
    }
    deselectObject();
    selectedObj = obj;
    selectedObjName = obj.name || "";
    var THREE = window.THREE;
    boxHelper = new THREE.BoxHelper(obj, 0x00ff88);
    boxHelper.name = "__editor_box_helper__";
    // Guard for lights: BoxHelper.setFromObject on geometry-less objects produces NaN/Infinity
    // which corrupts WebGL state and freezes the renderer. Use fixed-size box instead.
    if (obj.isLight) {
      boxHelper.update = function() {
        var _lo = selectedObj;
        if (!_lo || !_lo.parent) return;
        var wp = new THREE.Vector3();
        _lo.getWorldPosition(wp);
        var hs = 0.3; // small cube around light position
        var pos = this.geometry.attributes.position;
        if (!pos) return;
        var a = pos.array;
        a[0]=wp.x+hs; a[1]=wp.y+hs; a[2]=wp.z+hs;
        a[3]=wp.x-hs; a[4]=wp.y+hs; a[5]=wp.z+hs;
        a[6]=wp.x-hs; a[7]=wp.y-hs; a[8]=wp.z+hs;
        a[9]=wp.x+hs; a[10]=wp.y-hs; a[11]=wp.z+hs;
        a[12]=wp.x+hs; a[13]=wp.y+hs; a[14]=wp.z-hs;
        a[15]=wp.x-hs; a[16]=wp.y+hs; a[17]=wp.z-hs;
        a[18]=wp.x-hs; a[19]=wp.y-hs; a[20]=wp.z-hs;
        a[21]=wp.x+hs; a[22]=wp.y-hs; a[23]=wp.z-hs;
        pos.needsUpdate = true;
        this.geometry.computeBoundingSphere();
      };
      try { boxHelper.update(); } catch(e) {}
    }
    // Override for animated characters — SkinnedMesh bind-pose gives wrong Box3
    // Use character's world position + __characterBounds dimensions instead of setFromObject
    else if (obj.userData && obj.userData.vibexeType === "AnimatedCharacter") {
      boxHelper.userData.__isAnimCharBox = true;
      boxHelper.update = function() {
        // Read selectedObj directly (not closure capture) — stays current if character is swapped
        var _so = selectedObj;
        if (!_so || !_so.parent) return;
        var _cb2 = _so.userData.__characterBounds || { halfX: 0.45, halfZ: 0.45, height: 1.5 };
        // Get current world position of the character
        var wp = new THREE.Vector3();
        _so.getWorldPosition(wp);
        // Build box from world position + known character dimensions
        var hx = _cb2.halfX, hz = _cb2.halfZ, h = _cb2.height;
        var minX = wp.x - hx, maxX = wp.x + hx;
        var minY = wp.y, maxY = wp.y + h;
        var minZ = wp.z - hz, maxZ = wp.z + hz;
        var pos = this.geometry.attributes.position;
        if (!pos) return;
        var a = pos.array;
        // Front face (max Z)
        a[0]=maxX; a[1]=maxY; a[2]=maxZ;
        a[3]=minX; a[4]=maxY; a[5]=maxZ;
        a[6]=minX; a[7]=minY; a[8]=maxZ;
        a[9]=maxX; a[10]=minY; a[11]=maxZ;
        // Back face (min Z)
        a[12]=maxX; a[13]=maxY; a[14]=minZ;
        a[15]=minX; a[16]=maxY; a[17]=minZ;
        a[18]=minX; a[19]=minY; a[20]=minZ;
        a[21]=maxX; a[22]=minY; a[23]=minZ;
        pos.needsUpdate = true;
        this.geometry.computeBoundingSphere();
      };
      try { boxHelper.update(); } catch(e) {}
    }
    editor.scene.add(boxHelper);
    // Skip TransformControls for locked objects (still allow selection for inspect/unlock)
    if (obj.userData && obj.userData.__editorLocked) {
      sendSelectedObject(obj);
      showDebug("Object locked — select only (no transform)");
      return;
    }
    if (THREE.TransformControls) {
      // Final safety: never attach to scene root
      if (obj === editor.scene || obj.type === "Scene") { showDebug("ABORT: refusing to attach TC to scene"); return; }
      // Reuse single TransformControls instance — create only on first selection
      if (!transformControls) {
        console.log("[GameEditorBridge] Creating reusable TransformControls");
        transformControls = new THREE.TransformControls(editor.camera, editor.renderer.domElement);
        transformControls.name = "__editor_transform_controls__";
        transformControls.setSize(0.6);
        transformControls.addEventListener("dragging-changed", function(e) {
          if (editor.orbitControls) editor.orbitControls.enabled = !e.value;
          if (!selectedObj || !selectedObj.parent) return;
          if (e.value && selectedObj) {
            transformControls.__undoPos = { x: selectedObj.position.x, y: selectedObj.position.y, z: selectedObj.position.z };
            transformControls.__undoRot = { x: selectedObj.rotation.x, y: selectedObj.rotation.y, z: selectedObj.rotation.z };
            transformControls.__undoScl = { x: selectedObj.scale.x, y: selectedObj.scale.y, z: selectedObj.scale.z };
          } else if (!e.value && selectedObj && transformControls.__undoPos) {
            pushUndo({ type: "transform", uuid: selectedObj.uuid,
              oldPos: transformControls.__undoPos, oldRot: transformControls.__undoRot, oldScl: transformControls.__undoScl,
              newPos: { x: selectedObj.position.x, y: selectedObj.position.y, z: selectedObj.position.z },
              newRot: { x: selectedObj.rotation.x, y: selectedObj.rotation.y, z: selectedObj.rotation.z },
              newScl: { x: selectedObj.scale.x, y: selectedObj.scale.y, z: selectedObj.scale.z }
            });
            if (gridSnap) {
              selectedObj.position.x = snapToGrid(selectedObj.position.x);
              selectedObj.position.y = snapToGrid(selectedObj.position.y);
              selectedObj.position.z = snapToGrid(selectedObj.position.z);
              if (transformControls.getMode && transformControls.getMode() === "rotate") {
                selectedObj.rotation.x = snapRotation(selectedObj.rotation.x);
                selectedObj.rotation.y = snapRotation(selectedObj.rotation.y);
                selectedObj.rotation.z = snapRotation(selectedObj.rotation.z);
              }
              sendSelectedObject(selectedObj);
              if (boxHelper && boxHelper.object && boxHelper.object.parent) { try { boxHelper.update(); } catch(e) {} }
            }
            persistTransform(selectedObj);
          }
        });
        // Throttle postMessages during drag to prevent React re-render storms
        var _lastCamMovedTime = 0;
        var _camMovedTimer = null;
        var _lastObjChangeTime = 0;
        var _objChangeTimer = null;
        transformControls.addEventListener("objectChange", function() {
          // Camera mode: compute offsets and save to iframe settings (no position reset)
          if (cameraSelected && previewCamera) {
            var player = findPlayerMesh();
            var px = 0, py = 0, pz = 0;
            if (player) { px = player.position.x; py = player.position.y; pz = player.position.z; }
            var newOffsetY = previewCamera.position.y - py;
            var newOffsetZ = previewCamera.position.z - pz;
            // Persist to iframe game settings so updatePreviewCamera uses them after deselect
            var _gs = window.__vibexe_game_settings__;
            if (!_gs) { _gs = {}; window.__vibexe_game_settings__ = _gs; }
            if (!_gs.camera) _gs.camera = {};
            _gs.camera.offsetY = newOffsetY;
            _gs.camera.offsetZ = newOffsetZ;
            if (cameraHelper) { try { cameraHelper.update(); } catch(_e) {} }
            // Throttle postMessage to parent (200ms) to prevent React re-render storm
            var _camNow = Date.now();
            if (_camNow - _lastCamMovedTime >= 200) {
              _lastCamMovedTime = _camNow;
              if (_camMovedTimer) { clearTimeout(_camMovedTimer); _camMovedTimer = null; }
              window.parent.postMessage({
                type: "game-editor-camera-moved",
                position: { x: +previewCamera.position.x.toFixed(2), y: +previewCamera.position.y.toFixed(2), z: +previewCamera.position.z.toFixed(2) },
                offsetY: +newOffsetY.toFixed(2),
                offsetZ: +newOffsetZ.toFixed(2)
              }, "*");
            } else if (!_camMovedTimer) {
              _camMovedTimer = setTimeout(function() {
                _camMovedTimer = null;
                _lastCamMovedTime = Date.now();
                window.parent.postMessage({
                  type: "game-editor-camera-moved",
                  position: { x: +previewCamera.position.x.toFixed(2), y: +previewCamera.position.y.toFixed(2), z: +previewCamera.position.z.toFixed(2) },
                  offsetY: +newOffsetY.toFixed(2),
                  offsetZ: +newOffsetZ.toFixed(2)
                }, "*");
              }, 200 - (_camNow - _lastCamMovedTime));
            }
            return;
          }
          if (!selectedObj || !selectedObj.parent) return;
          if (selectedObj) {
            // boxHelper update is cheap — keep at full rate for visual feedback
            if (boxHelper && boxHelper.object && boxHelper.object.parent) { try { boxHelper.update(); } catch(e) {} }
            // Throttle expensive postMessages to parent (sendSelectedObject + sendPlayerPositionUpdate)
            var _objNow = Date.now();
            if (_objNow - _lastObjChangeTime >= 150) {
              _lastObjChangeTime = _objNow;
              if (_objChangeTimer) { clearTimeout(_objChangeTimer); _objChangeTimer = null; }
              sendSelectedObject(selectedObj);
              sendPlayerPositionUpdate(selectedObj);
            } else if (!_objChangeTimer) {
              var _capturedObj = selectedObj;
              _objChangeTimer = setTimeout(function() {
                _objChangeTimer = null;
                _lastObjChangeTime = Date.now();
                sendSelectedObject(_capturedObj);
                sendPlayerPositionUpdate(_capturedObj);
              }, 150 - (_objNow - _lastObjChangeTime));
            }
          }
        });
        var tcHelper = transformControls.getHelper ? transformControls.getHelper() : transformControls;
        tcHelper.name = "__editor_transform_controls__";
        tcHelperObj = tcHelper; // Store reference so editor sweep doesn't remove it
        // Recursion guard: r172 TransformControlsRoot.updateMatrixWorld calls
        // object.updateWorldMatrix(true,true) which traverses up to scene root,
        // re-triggering this same updateMatrixWorld — infinite stack overflow.
        var _tcUpdating = false;
        var _origUMW = tcHelper.updateMatrixWorld;
        tcHelper.updateMatrixWorld = function(force) {
          if (_tcUpdating) return;
          _tcUpdating = true;
          try { _origUMW.call(this, force); } finally { _tcUpdating = false; }
        };
        editor.scene.add(tcHelper);
      }
      console.log("[GameEditorBridge] Attaching TC to: " + (obj.name || obj.type));
      // Update snap properties
      if (gridSnap) {
        transformControls.translationSnap = gridSnapIncrement;
        transformControls.rotationSnap = rotationSnapDeg * Math.PI / 180;
        transformControls.scaleSnap = gridSnapIncrement;
      } else {
        transformControls.translationSnap = null;
        transformControls.rotationSnap = null;
        transformControls.scaleSnap = null;
      }
      transformControls.attach(obj);
      // If pan tool is active, hide gizmo but keep it attached (so toggling pan off restores it)
      if (panToolActive && tcHelperObj) tcHelperObj.visible = false;
      if (transformControls && transformControls.setSpace && typeof gizmoSpace === "string") {
        transformControls.setSpace(gizmoSpace);
      }
    } else {
      console.warn("[GameEditorBridge] TransformControls NOT available — gizmo disabled");
    }
    sendSelectedObject(obj);
    // Post-creation sweep: remove duplicate __editor_ objects from embedded bridge
    // Both bridges handle the same postMessage; embedded bridge may create duplicates.
    // setTimeout(0) runs after all synchronous message handlers have processed.
    var myBox = boxHelper;
    var myTCHelper = transformControls ? (transformControls.getHelper ? transformControls.getHelper() : transformControls) : null;
    setTimeout(function() {
      if (!editor || !editor.scene) return;
      var dupes = [];
      for (var si = 0; si < editor.scene.children.length; si++) {
        var sc = editor.scene.children[si];
        if (sc.name && sc.name.indexOf("__editor_") === 0 && sc !== myBox && sc !== myTCHelper && sc !== cameraHelper && sc !== previewCamera && sc.type !== "TransformControlsGizmo" && sc.type !== "TransformControlsPlane" && sc.type !== "TransformControlsRoot") dupes.push(sc);
      }
      for (var di = 0; di < dupes.length; di++) {
        if (dupes[di].detach) dupes[di].detach();
        editor.scene.remove(dupes[di]);
        if (dupes[di].dispose) dupes[di].dispose();
      }
    }, 0);
  }

  function findByUuid(obj, uuid) {
    if (!obj) return null;
    if (obj.uuid === uuid) return obj;
    if (obj.children) { for (var i = 0; i < obj.children.length; i++) { var f = findByUuid(obj.children[i], uuid); if (f) return f; } }
    return null;
  }

  function findSceneParent(obj) {
    if (!obj || !editor) return obj;
    var cur = obj;
    while (cur.parent && cur.parent !== editor.scene) cur = cur.parent;
    return cur;
  }

  // ---- Undo / Redo Stack ----
  function pushUndo(entry) {
    undoStack.push(entry);
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0; // New action clears redo history
  }

  function applyUndo() {
    if (undoStack.length === 0) return;
    var entry = undoStack.pop();
    if (!editor) return;
    if (entry.type === "transform") {
      var obj = findByUuid(editor.scene, entry.uuid);
      if (obj) {
        obj.position.set(entry.oldPos.x, entry.oldPos.y, entry.oldPos.z);
        obj.rotation.set(entry.oldRot.x, entry.oldRot.y, entry.oldRot.z);
        obj.scale.set(entry.oldScl.x, entry.oldScl.y, entry.oldScl.z);
        if (selectedObj && selectedObj.uuid === entry.uuid) { sendSelectedObject(obj); if (boxHelper && boxHelper.object && boxHelper.object.parent) { try { boxHelper.update(); } catch(e) {} } }
        persistTransform(obj);
        redoStack.push({ type: "transform", uuid: entry.uuid,
          oldPos: entry.newPos, oldRot: entry.newRot, oldScl: entry.newScl,
          newPos: entry.oldPos, newRot: entry.oldRot, newScl: entry.oldScl });
      }
    } else if (entry.type === "delete") {
      editor.scene.add(entry.object);
      sendSceneTreeThrottled();
      redoStack.push({ type: "delete-reverse", uuid: entry.uuid, object: entry.object });
    } else if (entry.type === "duplicate") {
      var dup = findByUuid(editor.scene, entry.uuid);
      if (dup) { editor.scene.remove(dup); deselectObject(); sendSceneTreeThrottled(); redoStack.push({ type: "duplicate-reverse", uuid: entry.uuid, object: dup }); }
    } else if (entry.type === "property") {
      var obj2 = findByUuid(editor.scene, entry.uuid);
      if (obj2) {
        var curVal = null;
        switch(entry.property) {
          case "name": curVal = obj2.name; break;
          case "visible": curVal = obj2.visible; break;
          default:
            if (entry.property.indexOf("position") === 0) curVal = entry.newValue;
            else if (entry.property.indexOf("rotation") === 0) curVal = entry.newValue;
            else if (entry.property.indexOf("scale") === 0) curVal = entry.newValue;
            else curVal = entry.newValue;
        }
        updateProperty(entry.uuid, entry.property, entry.oldValue, true);
        redoStack.push({ type: "property", uuid: entry.uuid, property: entry.property, oldValue: entry.oldValue, newValue: curVal });
      }
    }
    window.parent.postMessage({ type: "game-editor-undo-redo-state", canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }, "*");
  }

  function applyRedo() {
    if (redoStack.length === 0) return;
    var entry = redoStack.pop();
    if (!editor) return;
    if (entry.type === "transform") {
      var obj = findByUuid(editor.scene, entry.uuid);
      if (obj) {
        obj.position.set(entry.oldPos.x, entry.oldPos.y, entry.oldPos.z);
        obj.rotation.set(entry.oldRot.x, entry.oldRot.y, entry.oldRot.z);
        obj.scale.set(entry.oldScl.x, entry.oldScl.y, entry.oldScl.z);
        if (selectedObj && selectedObj.uuid === entry.uuid) { sendSelectedObject(obj); if (boxHelper && boxHelper.object && boxHelper.object.parent) { try { boxHelper.update(); } catch(e) {} } }
        persistTransform(obj);
        undoStack.push({ type: "transform", uuid: entry.uuid,
          oldPos: entry.newPos, oldRot: entry.newRot, oldScl: entry.newScl,
          newPos: entry.oldPos, newRot: entry.oldRot, newScl: entry.oldScl });
      }
    } else if (entry.type === "delete-reverse") {
      editor.scene.remove(entry.object);
      if (selectedObj && selectedObj.uuid === entry.uuid) deselectObject();
      sendSceneTreeThrottled();
      undoStack.push({ type: "delete", uuid: entry.uuid, object: entry.object });
    } else if (entry.type === "duplicate-reverse") {
      editor.scene.add(entry.object);
      sendSceneTreeThrottled();
      undoStack.push({ type: "duplicate", uuid: entry.uuid });
    } else if (entry.type === "property") {
      var obj2 = findByUuid(editor.scene, entry.uuid);
      if (obj2) {
        updateProperty(entry.uuid, entry.property, entry.newValue, true);
        undoStack.push({ type: "property", uuid: entry.uuid, property: entry.property, oldValue: entry.oldValue, newValue: entry.newValue });
      }
    }
    window.parent.postMessage({ type: "game-editor-undo-redo-state", canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }, "*");
  }

  // ---- Grid Snap ----
  function snapToGrid(v) { return Math.round(v / gridSnapIncrement) * gridSnapIncrement; }
  function snapRotation(rad) { var deg = rad * 180 / Math.PI; return Math.round(deg / rotationSnapDeg) * rotationSnapDeg * Math.PI / 180; }

  function toggleGridHelper() {
    gridSnap = !gridSnap;
    if (!editor) return;
    var THREE = window.THREE;
    if (gridSnap && !gridHelper) {
      gridHelper = new THREE.GridHelper(100, 200, 0x444466, 0x333344);
      gridHelper.name = "__editor_grid__";
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.3;
      editor.scene.add(gridHelper);
    } else if (!gridSnap && gridHelper) {
      editor.scene.remove(gridHelper);
      if (gridHelper.dispose) gridHelper.dispose();
      gridHelper = null;
    }
    // Sync TC snap properties so snapping happens DURING drag
    if (transformControls) {
      if (gridSnap) {
        transformControls.translationSnap = gridSnapIncrement;
        transformControls.rotationSnap = rotationSnapDeg * Math.PI / 180;
        transformControls.scaleSnap = gridSnapIncrement;
      } else {
        transformControls.translationSnap = null;
        transformControls.rotationSnap = null;
        transformControls.scaleSnap = null;
      }
    }
    window.parent.postMessage({ type: "game-editor-snap-changed", snap: gridSnap }, "*");
  }

  // ---- Focus Camera ----
  function focusSelected() {
    if (!selectedObj || !editor || !editor.orbitControls) return;
    var THREE = window.THREE;
    var box = new THREE.Box3().setFromObject(selectedObj);
    var center = new THREE.Vector3();
    box.getCenter(center);
    // Guard against NaN/Infinity (lights and other geometry-less objects produce empty Box3)
    if (!isFinite(center.x) || !isFinite(center.y) || !isFinite(center.z)) {
      selectedObj.getWorldPosition(center);
    }
    var size = new THREE.Vector3();
    box.getSize(size);
    if (!isFinite(size.x)) size.set(1, 1, 1);
    var maxDim = Math.max(size.x, size.y, size.z, 1);
    var dist = maxDim * 2.5;
    var cam = editor.camera;
    var dir = new THREE.Vector3().subVectors(cam.position, editor.orbitControls.target).normalize();
    var targetPos = center.clone().add(dir.multiplyScalar(dist));
    // Animate camera smoothly
    var startPos = cam.position.clone();
    var startTarget = editor.orbitControls.target.clone();
    var t = 0;
    function animFocus() {
      t += 0.08;
      if (t >= 1) t = 1;
      var ease = t * (2 - t); // ease-out
      cam.position.lerpVectors(startPos, targetPos, ease);
      editor.orbitControls.target.lerpVectors(startTarget, center, ease);
      editor.orbitControls.update();
      if (t < 1) requestAnimationFrame(animFocus);
    }
    animFocus();
  }

  // ---- Flythrough Mode (Unity-style: RMB hold + WASD) ----
  function enterFlyMode() {
    if (flyMode) return;
    flyMode = true;
    if (editor && editor.orbitControls) editor.orbitControls.enabled = false;
    showDebug("FLY MODE: ON");
  }

  function exitFlyMode() {
    if (!flyMode) return;
    flyMode = false;
    if (editor && editor.orbitControls) {
      editor.orbitControls.enabled = true;
      // Restore mouseButtons based on panToolActive state
      var THREE = window.THREE;
      if (panToolActive) {
        editor.orbitControls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
      } else {
        editor.orbitControls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
      }
      // Update orbit target to where camera is now looking
      var dir = new THREE.Vector3();
      editor.camera.getWorldDirection(dir);
      editor.orbitControls.target.copy(editor.camera.position).add(dir.multiplyScalar(10));
      editor.orbitControls.update();
    }
    showDebug("FLY MODE: OFF");
  }

  function updateFlyMovement() {
    if (!flyMode || !editor) return;
    var speed = 0.2;  // Units per frame (~12 units/sec at 60fps)
    if (flyKeys["ShiftLeft"] || flyKeys["ShiftRight"]) speed *= 3;
    // Scroll wheel adjusts speed in fly mode (tracked via flyKeys.__scrollSpeed)
    if (flyKeys.__scrollSpeed) speed *= flyKeys.__scrollSpeed;
    if (flyKeys["KeyW"]) editor.camera.translateZ(-speed);
    if (flyKeys["KeyS"]) editor.camera.translateZ(speed);
    if (flyKeys["KeyA"]) editor.camera.translateX(-speed);
    if (flyKeys["KeyD"]) editor.camera.translateX(speed);
    if (flyKeys["KeyQ"]) editor.camera.translateY(-speed);
    if (flyKeys["KeyE"]) editor.camera.translateY(speed);
  }

  // ---- Arrow Key Panning ----
  function panCamera(dx, dy, dz, fast) {
    if (!editor) return;
    var speed = fast ? 2 : 0.5;
    var THREE = window.THREE;
    var right = new THREE.Vector3();
    var forward = new THREE.Vector3();
    editor.camera.getWorldDirection(forward);
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    forward.y = 0; forward.normalize();
    var move = new THREE.Vector3();
    move.addScaledVector(right, dx * speed);
    move.y += dy * speed;
    move.addScaledVector(forward, -dz * speed);
    editor.camera.position.add(move);
    if (editor.orbitControls) {
      editor.orbitControls.target.add(move);
      editor.orbitControls.update();
    }
  }

  // ---- Animation Helpers (for AnimatedCharacter objects) ----
  function handleGetAnimations(uuid) {
    if (!editor) return;
    var obj = findByUuid(editor.scene, uuid);
    if (obj && obj.userData && obj.userData.__clipNames) {
      window.parent.postMessage({
        type: "game-editor-animation-clips",
        uuid: uuid,
        clips: obj.userData.__clipNames,
        currentClip: typeof obj.userData.__currentClip === "function" ? obj.userData.__currentClip() : (obj.userData.__currentClip || null),
        animMap: obj.userData.__animMap || null,
        clipDurations: obj.userData.__clipDurations || {},
      }, "*");
    }
  }

  var __animProgressInterval = null;
  function handlePlayAnimation(uuid, clipName) {
    if (!editor) return;
    var obj = findByUuid(editor.scene, uuid);
    if (obj && obj.userData && obj.userData.__play) {
      obj.userData.__play(clipName);
      if (__animProgressInterval) clearInterval(__animProgressInterval);
      __animProgressInterval = setInterval(function() {
        if (!obj || !obj.userData || !obj.userData.__getTime) { clearInterval(__animProgressInterval); __animProgressInterval = null; return; }
        var info = obj.userData.__getTime();
        try { window.parent.postMessage({ type: "game-editor-animation-progress", uuid: uuid, time: info.time, duration: info.duration, clipName: info.clipName, paused: info.paused }, "*"); } catch(e) {}
      }, 100);
    }
  }

  // ---- Duplicate ----
  function duplicateSelected() {
    if (!selectedObj || !editor) return;
    var clone = selectedObj.clone(true);
    clone.position.x += 1;
    clone.traverse(function(c) {
      c.uuid = window.THREE.MathUtils.generateUUID();
      // Clear physics body references so clone gets its own body via auto-physics
      if (c.userData) {
        delete c.userData.__physicsBody;
        delete c.userData.__autoPhysicsBody;
      }
    });
    // Give clone a unique name so persistTransform doesn't conflict with the original
    if (clone.name) { clone.name = clone.name + "_copy"; }
    editor.scene.add(clone);
    pushUndo({ type: "duplicate", uuid: clone.uuid });
    selectObject(clone);
    sendSceneTreeThrottled();
    window.parent.postMessage({ type: "game-editor-object-duplicated", uuid: clone.uuid }, "*");
  }

  // ---- Group / Ungroup ----
  function groupObjects(uuids) {
    if (!editor || !uuids || uuids.length < 2) return;
    var THREE = window.THREE;
    var objects = [];
    for (var i = 0; i < uuids.length; i++) {
      var obj = findByUuid(editor.scene, uuids[i]);
      if (obj && obj !== editor.scene) objects.push(obj);
    }
    if (objects.length < 2) return;
    // Compute center position
    var cx = 0, cy = 0, cz = 0;
    for (var j = 0; j < objects.length; j++) {
      cx += objects[j].position.x;
      cy += objects[j].position.y;
      cz += objects[j].position.z;
    }
    cx /= objects.length; cy /= objects.length; cz /= objects.length;
    // Create group at center
    var group = new THREE.Group();
    group.name = "Group";
    group.position.set(cx, cy, cz);
    group.userData.vibexeType = "Group";
    group.userData.vibexeFactory = "group";
    editor.scene.add(group);
    // Reparent objects — adjust position to be relative to group
    for (var k = 0; k < objects.length; k++) {
      var o = objects[k];
      var wp = new THREE.Vector3();
      o.getWorldPosition(wp);
      o.parent.remove(o);
      group.add(o);
      o.position.set(wp.x - cx, wp.y - cy, wp.z - cz);
    }
    pushUndo({ type: "group", uuid: group.uuid, childUuids: uuids });
    selectObject(group);
    sendSceneTreeThrottled();
    window.parent.postMessage({ type: "game-editor-objects-grouped", uuid: group.uuid, count: objects.length }, "*");
    window.parent.postMessage({ type: "game-editor-scene-dirty" }, "*");
  }

  function ungroupObject(uuid) {
    if (!editor || !uuid) return;
    var group = findByUuid(editor.scene, uuid);
    if (!group || !group.children || group.children.length === 0) return;
    var THREE = window.THREE;
    // Collect children (copy array since we'll modify it)
    var children = [];
    for (var i = 0; i < group.children.length; i++) {
      var c = group.children[i];
      if (c.name && c.name.indexOf("__editor_") === 0) continue;
      children.push(c);
    }
    var childUuids = [];
    for (var j = 0; j < children.length; j++) {
      var child = children[j];
      var wp = new THREE.Vector3();
      child.getWorldPosition(wp);
      group.remove(child);
      editor.scene.add(child);
      child.position.copy(wp);
      childUuids.push(child.uuid);
    }
    // Remove empty group
    deselectObject();
    editor.scene.remove(group);
    pushUndo({ type: "ungroup", uuid: uuid, childUuids: childUuids });
    sendSceneTreeThrottled();
    window.parent.postMessage({ type: "game-editor-objects-ungrouped", count: childUuids.length }, "*");
    window.parent.postMessage({ type: "game-editor-scene-dirty" }, "*");
  }

  // ---- XZ Plane Drag ----
  var _lastXZDragMsgTime = 0;
  var _xzDragMsgTimer = null;
  function startXZDrag(obj, clientX, clientY) {
    if (!editor) return;
    var THREE = window.THREE;
    isDragging = true;
    dragStartPos = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
    dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -obj.position.y);
    // Calculate offset so object doesn't jump to cursor
    var rect = editor.renderer.domElement.getBoundingClientRect();
    var mx = ((clientX - rect.left) / rect.width) * 2 - 1;
    var my = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(mx, my), editor.camera);
    var intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, intersection);
    if (intersection) {
      dragOffset = new THREE.Vector3().subVectors(obj.position, intersection);
    } else {
      dragOffset = new THREE.Vector3();
    }
    if (editor.orbitControls) editor.orbitControls.enabled = false;
  }

  function doXZDrag(clientX, clientY) {
    if (!isDragging || !selectedObj || !editor || !dragPlane) return;
    var THREE = window.THREE;
    var rect = editor.renderer.domElement.getBoundingClientRect();
    var mx = ((clientX - rect.left) / rect.width) * 2 - 1;
    var my = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(mx, my), editor.camera);
    var intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, intersection);
    if (intersection) {
      var newX = intersection.x + dragOffset.x;
      var newZ = intersection.z + dragOffset.z;
      if (gridSnap) { newX = snapToGrid(newX); newZ = snapToGrid(newZ); }
      selectedObj.position.x = newX;
      selectedObj.position.z = newZ;
      if (boxHelper && boxHelper.object && boxHelper.object.parent) { try { boxHelper.update(); } catch(e) {} }
      // Throttle postMessages during XZ drag (150ms)
      var _xzNow = Date.now();
      if (_xzNow - _lastXZDragMsgTime >= 150) {
        _lastXZDragMsgTime = _xzNow;
        if (_xzDragMsgTimer) { clearTimeout(_xzDragMsgTimer); _xzDragMsgTimer = null; }
        sendSelectedObject(selectedObj);
        sendPlayerPositionUpdate(selectedObj);
      } else if (!_xzDragMsgTimer) {
        var _xzObj = selectedObj;
        _xzDragMsgTimer = setTimeout(function() {
          _xzDragMsgTimer = null;
          _lastXZDragMsgTime = Date.now();
          sendSelectedObject(_xzObj);
          sendPlayerPositionUpdate(_xzObj);
        }, 150 - (_xzNow - _lastXZDragMsgTime));
      }
    }
  }

  function endXZDrag() {
    if (!isDragging || !selectedObj) { isDragging = false; return; }
    isDragging = false;
    if (editor && editor.orbitControls) editor.orbitControls.enabled = true;
    if (dragStartPos) {
      pushUndo({ type: "transform", uuid: selectedObj.uuid,
        oldPos: dragStartPos, oldRot: { x: selectedObj.rotation.x, y: selectedObj.rotation.y, z: selectedObj.rotation.z }, oldScl: { x: selectedObj.scale.x, y: selectedObj.scale.y, z: selectedObj.scale.z },
        newPos: { x: selectedObj.position.x, y: selectedObj.position.y, z: selectedObj.position.z },
        newRot: { x: selectedObj.rotation.x, y: selectedObj.rotation.y, z: selectedObj.rotation.z },
        newScl: { x: selectedObj.scale.x, y: selectedObj.scale.y, z: selectedObj.scale.z }
      });
    }
    dragPlane = null; dragOffset = null; dragStartPos = null;
    persistTransform(selectedObj);
    sendSceneTreeThrottled();
  }

  // ---- Raycast helper ----
  function raycastMeshes(clientX, clientY) {
    if (!editor) return null;
    var THREE = window.THREE;
    var rect = editor.renderer.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, editor.camera);
    // Pass 1: standard mesh raycasting (works for static Mesh objects)
    var meshes = [];
    editor.scene.traverse(function(child) {
      if (child.isMesh && child !== boxHelper && child.type !== "TransformControlsGizmo" && child.type !== "TransformControlsPlane" && child.type !== "SpotLightHelper" && child.type !== "PointLightHelper" && (child.name||"").indexOf("__") !== 0 && (child.name||"").indexOf("pop_") !== 0 && (child.name||"").indexOf("StylizedWater") !== 0 && !isGroundPlane(child)) {
        meshes.push(child);
      }
    });
    var intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      return findSceneParent(intersects[0].object);
    }
    // Pass 2: bounding box fallback (catches SkinnedMesh, animated characters, Groups)
    var bestDist = Infinity;
    var bestObj = null;
    for (var i = 0; i < editor.scene.children.length; i++) {
      var child = editor.scene.children[i];
      if (!child.visible) continue;
      if ((child.name || "").indexOf("__") === 0) continue;
      if (child === boxHelper || child === transformControls || child === cameraHelper) continue;
      if (child.isLight || child.type === "HemisphereLight" || child.type === "AmbientLight" || child.type === "DirectionalLight" || child.type === "SpotLight" || child.type === "PointLight") continue;
      if (child.type === "GridHelper" || child.type === "CameraHelper") continue;
      if (isGroundPlane(child)) continue;
      if ((child.name || "").indexOf("pop_") === 0) continue;
      var box = new THREE.Box3().setFromObject(child);
      if (box.isEmpty()) continue;
      // Expand tiny boxes (SkinnedMesh bind-pose) to a minimum clickable size
      var sz = new THREE.Vector3(); box.getSize(sz);
      if (sz.x < 0.5 || sz.y < 0.5 || sz.z < 0.5) {
        var ctr = new THREE.Vector3(); box.getCenter(ctr);
        box.setFromCenterAndSize(ctr, new THREE.Vector3(Math.max(sz.x, 1.5), Math.max(sz.y, 1.5), Math.max(sz.z, 1.5)));
      }
      var pt = new THREE.Vector3();
      if (raycaster.ray.intersectBox(box, pt)) {
        var dist = pt.distanceTo(raycaster.ray.origin);
        if (dist < bestDist) { bestDist = dist; bestObj = child; }
      }
    }
    return bestObj;
  }

  // ---- Persist transforms to source code ----
  var persistTimer = null;
  function persistTransform(obj) {
    if (!obj) return;
    // Auto-name unnamed objects (fixes existing games generated before name-fix)
    if (!obj.name) {
      if (obj.userData && obj.userData.vibexeFactory) {
        obj.name = (obj.userData.vibexeFactory === "animatedCharacter" ? "Character_" : "Object_") + obj.uuid.slice(0, 8);
      } else if (obj.type === "Group" && obj.children && obj.children.length > 0 && editor && obj.parent === editor.scene) {
        // Count unnamed Groups before this one (stable even if children order varies)
        var _ugCount = 0;
        for (var _i = 0; _i < editor.scene.children.length; _i++) {
          var _ch = editor.scene.children[_i];
          if (_ch === obj) break;
          if (!_ch.name && _ch.type === "Group" && _ch.children && _ch.children.length > 0) _ugCount++;
        }
        obj.name = "UnnamedGroup_" + _ugCount;
      }
      if (obj.name) console.log("[GameEditorBridge] Auto-named:", obj.name);
    }
    if (!obj.name) return;
    // Notify parent that scene has unsaved changes
    window.parent.postMessage({ type: "game-editor-scene-dirty" }, "*");
    // Debounce: batch rapid changes (e.g. during drag) into one update
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function() {
      // Guard: object may have been deleted during debounce
      if (!obj || !obj.parent || !obj.position) return;
      // Resolve duplicate names: if multiple scene objects share the same name,
      // append #N (0-based index) so the override system can distinguish them
      var persistName = obj.name;
      if (editor && editor.scene) {
        var _dupeCount = 0, _dupeIdx = -1;
        editor.scene.traverse(function(c) {
          if (c.name === obj.name && c !== obj && c.parent) _dupeCount++;
        });
        if (_dupeCount > 0) {
          // Find this object's index among all objects with same name
          var _idx = 0;
          editor.scene.traverse(function(c) {
            if (c.name === obj.name && c.parent) {
              if (c === obj) _dupeIdx = _idx;
              _idx++;
            }
          });
          if (_dupeIdx >= 0) persistName = obj.name + "#" + _dupeIdx;
        }
      }
      // Un-redistribute AnimatedCharacter position for persistence.
      // Editor moves group to mesh render center for gizmo alignment;
      // subtract that offset so the persisted position is the logical spawn position.
      var _ro = obj.__editorRedistOffset;
      var msg = {
        type: "game-editor-persist-transform",
        name: persistName,
        position: { x: +(obj.position.x - (_ro ? _ro.x : 0)).toFixed(3), y: +(obj.position.y - (_ro ? _ro.y : 0)).toFixed(3), z: +(obj.position.z - (_ro ? _ro.z : 0)).toFixed(3) },
        rotation: { x: +(obj.rotation.x * 180 / Math.PI).toFixed(1), y: +(obj.rotation.y * 180 / Math.PI).toFixed(1), z: +(obj.rotation.z * 180 / Math.PI).toFixed(1) },
        scale: { x: +obj.scale.x.toFixed(3), y: +obj.scale.y.toFixed(3), z: +obj.scale.z.toFixed(3) }
      };
      console.log("[GameEditorBridge] persistTransform:", persistName, "pos:", msg.position);
      window.parent.postMessage(msg, "*");
    }, 300);
  }

  // ---- Player character detection ----
  function isPlayerCharacter(obj) {
    if (!obj) return false;
    var ud = obj.userData || {};
    return ud.__isPlayerCharacter
      || ud.vibexeType === "player"
      || (ud.vibexeType === "AnimatedCharacter" && obj.name && (obj.name.indexOf("Character_") === 0 || obj.name.indexOf("Player_") === 0));
  }

  // Send live player position to parent (for "pick from scene" in Game Settings panel)
  // Throttled to max once per 200ms to prevent 60fps React re-renders during gizmo drag
  var _lastPlayerPosTime = 0;
  var _playerPosTimer = null;
  function sendPlayerPositionUpdate(obj) {
    if (!obj || !isPlayerCharacter(obj)) return;
    var now = Date.now();
    if (now - _lastPlayerPosTime < 200) {
      // Schedule a trailing update so final position is always sent
      if (!_playerPosTimer) {
        _playerPosTimer = setTimeout(function() {
          _playerPosTimer = null;
          sendPlayerPositionUpdate(obj);
        }, 200 - (now - _lastPlayerPosTime));
      }
      return;
    }
    _lastPlayerPosTime = now;
    var bounds = obj.userData && obj.userData.__characterBounds;
    // Un-redistribute for spawn position (same logic as persistTransform)
    var _ro2 = obj.__editorRedistOffset;
    window.parent.postMessage({
      type: "game-editor-player-position-update",
      position: { x: +(obj.position.x - (_ro2 ? _ro2.x : 0)).toFixed(3), y: +(obj.position.y - (_ro2 ? _ro2.y : 0)).toFixed(3), z: +(obj.position.z - (_ro2 ? _ro2.z : 0)).toFixed(3) },
      characterHeight: bounds ? bounds.height : 1.5
    }, "*");
  }

  // ---- Debug overlay ----
  // debugEl removed — showDebug now console-only
  function showDebug(msg) {
    console.log("[GameEditorBridge] " + msg);
  }

  // ---- Camera Preview PIP ----
  function findPlayerMesh() {
    if (!editor || !editor.scene) return null;
    var found = null;
    editor.scene.traverse(function(c) {
      if (found) return;
      var ud = c.userData || {};
      if (ud.vibexeType === "AnimatedCharacter" && c.name && (c.name.indexOf("Character_") === 0 || c.name.indexOf("Player_") === 0)) found = c;
      else if (ud.__isPlayerCharacter) found = c;
    });
    return found;
  }

  function createPreviewCamera() {
    if (previewCamera) return;
    var THREE = window.THREE;
    if (!THREE || !editor) return;
    var gs = window.__vibexe_game_settings__ || {};
    var cam = gs.camera || {};
    previewCamera = new THREE.PerspectiveCamera(cam.fov || 60, 200 / 120, 0.1, 1000);
    previewCamera.name = "__editor_preview_cam__";
    console.log("[GameEditorBridge] Preview camera created");
  }

  function destroyPreviewCamera() {
    previewCamera = null;
  }

  function updatePreviewCamera() {
    if (!previewCamera || !editor) return;
    var gs = window.__vibexe_game_settings__ || {};
    var cam = gs.camera || {};
    var offsetY = cam.offsetY || 8;
    var offsetZ = cam.offsetZ || 12;
    var lookY = cam.lookY || 1;
    var player = findPlayerMesh();
    var px = 0, py = 0, pz = 0;
    if (player) { px = player.position.x; py = player.position.y; pz = player.position.z; }
    previewCamera.position.set(px, py + offsetY, pz + offsetZ);
    previewCamera.lookAt(px, py + lookY, pz);
    previewCamera.updateMatrixWorld(true);
  }

  // ---- Camera Frustum Helper ----
  function createCameraHelper() {
    if (cameraHelper || !previewCamera || !editor) return;
    var THREE = window.THREE;
    if (!THREE || !THREE.CameraHelper) return;
    // Use a display-only camera clone with short far for small frustum visualization
    var _displayCam = previewCamera.clone();
    _displayCam.far = 10; // Short frustum for visual clarity (actual far is 500+)
    _displayCam.updateProjectionMatrix();
    cameraHelper = new THREE.CameraHelper(_displayCam);
    cameraHelper.name = "__editor_camera_helper__";
    cameraHelper.__displayCam = _displayCam;
    editor.scene.add(cameraHelper);
    console.log("[GameEditorBridge] CameraHelper created (display far=10)");
  }

  function destroyCameraHelper() {
    if (cameraHelper) {
      if (editor && editor.scene) editor.scene.remove(cameraHelper);
      if (cameraHelper.__displayCam) cameraHelper.__displayCam = null;
      if (cameraHelper.dispose) cameraHelper.dispose();
      cameraHelper = null;
    }
    if (previewCamera && editor && editor.scene) editor.scene.remove(previewCamera);
    cameraSelected = false;
  }

  // ---- Click + Drag + Keyboard ----
  var lastHandleClickTime = 0;
  function handleClick(clientX, clientY, source) {
    // Skip selection clicks while terrain sculpt is active
    if (_sculptActive) return;
    // Dedup: multiple listeners fire for same physical click — ignore if < 50ms apart
    var now = Date.now();
    if (now - lastHandleClickTime < 50) return;
    lastHandleClickTime = now;
    showDebug("Click from " + source + " at (" + Math.round(clientX) + ", " + Math.round(clientY) + ")");
    if (!active || !editor) { showDebug("SKIP: active=" + active + " editor=" + !!editor); return; }
    if (panToolActive) { showDebug("SKIP: pan tool active"); return; }
    if (transformControls && (transformControls.dragging || transformControls.axis)) { showDebug("SKIP: gizmo active (dragging/hover)"); return; }
    var rect = editor.renderer.domElement.getBoundingClientRect();
    showDebug("Canvas rect: " + Math.round(rect.left) + "," + Math.round(rect.top) + " " + Math.round(rect.width) + "x" + Math.round(rect.height) + " | Click: " + Math.round(clientX) + "," + Math.round(clientY));
    var target = raycastMeshes(clientX, clientY);
    // Skip editor objects (gizmo, box helper, grid)
    if (target && (target.name || "").indexOf("__editor_") === 0) target = null;
    if (target === boxHelper || target === transformControls) target = null;
    // Also skip unnamed infrastructure meshes (e.g. ground plane remnants)
    if (target && !target.name && target.isMesh && !target.userData?.vibexeType && !target.userData?.vibexeFactory) target = null;
    if (target && target !== editor.scene) {
      showDebug("HIT: " + (target.name || target.type) + " (uuid=" + target.uuid.slice(0,8) + ")");
      var now = Date.now();
      var isDoubleClick = (now - lastClickTime < 300) && (lastClickUuid === target.uuid);
      lastClickTime = now;
      lastClickUuid = target.uuid;
      // If clicking the already-selected object, don't destroy and recreate gizmo
      if (selectedObj && target.uuid === selectedObj.uuid) {
        if (isDoubleClick) {
          startXZDrag(target, clientX, clientY);
        }
        showDebug("SAME: already selected, keeping gizmo");
        return;
      }
      if (isDoubleClick) {
        selectObject(target);
        startXZDrag(target, clientX, clientY);
      } else {
        selectObject(target);
      }
    } else {
      var gameObjCount = 0;
      if (editor.scene) { for (var ci = 0; ci < editor.scene.children.length; ci++) { var cc = editor.scene.children[ci]; if (cc.name && cc.name.indexOf("__editor_") !== 0 && !isGroundPlane(cc)) gameObjCount++; } }
      showDebug("MISS: no object at (" + Math.round(clientX) + "," + Math.round(clientY) + ") gameObjects=" + gameObjCount);
      lastClickTime = 0;
      lastClickUuid = "";
      deselectObject();
      // Send ground intersection point to parent for pick-spawn/pick-respawn
      try {
        var _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        // If terrain exists, try raycasting against it first
        var _terrain = editor.scene.getObjectByName("__terrain__");
        var _groundPt = null;
        if (_terrain) {
          var _tHits = raycaster.intersectObject(_terrain, false);
          if (_tHits.length > 0) _groundPt = _tHits[0].point;
        }
        if (!_groundPt) {
          _groundPt = new THREE.Vector3();
          if (!raycaster.ray.intersectPlane(_groundPlane, _groundPt)) _groundPt = null;
        }
        if (_groundPt) {
          window.parent.postMessage({
            type: "game-editor-ground-click",
            position: { x: +_groundPt.x.toFixed(3), y: +_groundPt.y.toFixed(3), z: +_groundPt.z.toFixed(3) }
          }, "*");
        }
      } catch(e) { console.warn("[GameEditorBridge] ground-click error:", e); }
    }
  }

  function onCanvasMouseDown(e) {
    if (!active || !editor) return;
    if (e.button !== 0) return;
    // Yield to World Builder when it's active — WB handles its own clicks
    if (window.__wb_active__) return;
    handleClick(e.clientX, e.clientY, "mousedown-capture");
  }

  function onCanvasMouseMove(e) {
    if (!active || !isDragging) return;
    doXZDrag(e.clientX, e.clientY);
  }

  function onCanvasMouseUp(e) {
    if (!active) return;
    if (isDragging) endXZDrag();
  }

  function onKeyDown(e) {
    if (!active) return;
    var tag = (e.target || {}).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    // Track key state for flythrough
    flyKeys[e.code] = true;
    // If RMB is held and a movement key is pressed, enter fly mode
    // Note: KeyQ is excluded from isMoveKey to avoid conflict with Pan tool shortcut
    var isMoveKey = e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD" || e.code === "KeyE";
    if (flyRMBDown && isMoveKey && !panToolActive) {
      enterFlyMode();
      e.preventDefault();
      return;
    }
    // In fly mode, skip gizmo switching (WASD used for movement) — also block Q/E fly keys
    var isFlyMoveKey = isMoveKey || e.code === "KeyQ" || e.code === "KeyE";
    if (flyMode && isFlyMoveKey) {
      e.preventDefault();
      return;
    }
    // Ctrl+Shift+Z or Ctrl+Y — Redo
    var keyLower = (e.key || "").toLowerCase();
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && keyLower === "z") {
      applyRedo(); e.preventDefault(); return;
    }
    if ((e.ctrlKey || e.metaKey) && keyLower === "y") {
      applyRedo(); e.preventDefault(); return;
    }
    // Ctrl+Z — Undo
    if ((e.ctrlKey || e.metaKey) && keyLower === "z") {
      applyUndo(); e.preventDefault(); return;
    }
    // Ctrl+D — Duplicate
    if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
      duplicateSelected(); e.preventDefault(); return;
    }
    // Ctrl+G — Group (forward to parent for multi-select grouping)
    if ((e.ctrlKey || e.metaKey) && (e.key === "g" || e.key === "G")) {
      window.parent.postMessage({ type: "game-editor-request-group" }, "*");
      e.preventDefault(); return;
    }
    switch (e.key) {
      case "q": case "Q":
        panToolActive = true;
        if (transformControls) transformControls.detach();
        if (editor.orbitControls) {
          editor.orbitControls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
        }
        window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "pan" }, "*");
        e.preventDefault(); break;
      case "w": case "W":
        panToolActive = false;
        if (editor && editor.orbitControls) editor.orbitControls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
        if (transformControls) transformControls.setMode("translate");
        if (transformControls && selectedObj) transformControls.attach(selectedObj);
        window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "translate" }, "*");
        e.preventDefault(); break;
      case "e": case "E":
        panToolActive = false;
        if (editor && editor.orbitControls) editor.orbitControls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
        if (transformControls) transformControls.setMode("rotate");
        if (transformControls && selectedObj) transformControls.attach(selectedObj);
        window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "rotate" }, "*");
        e.preventDefault(); break;
      case "r": case "R":
        panToolActive = false;
        if (editor && editor.orbitControls) editor.orbitControls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
        if (transformControls) transformControls.setMode("scale");
        if (transformControls && selectedObj) transformControls.attach(selectedObj);
        window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "scale" }, "*");
        e.preventDefault(); break;
      case "x": case "X":
        // Toggle local/world gizmo space (Unity-style)
        gizmoSpace = gizmoSpace === "world" ? "local" : "world";
        if (transformControls && transformControls.setSpace) transformControls.setSpace(gizmoSpace);
        window.parent.postMessage({ type: "game-editor-gizmo-space", space: gizmoSpace }, "*");
        e.preventDefault(); break;
      case "f": case "F":
        focusSelected(); e.preventDefault(); break;
      case "g": case "G":
        toggleGridHelper(); e.preventDefault(); break;
      case "Escape":
        if (flyMode) { exitFlyMode(); }
        else if (panToolActive) {
          // Cancel pan mode, return to translate
          panToolActive = false;
          if (editor && editor.orbitControls) editor.orbitControls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
          if (transformControls) transformControls.setMode("translate");
          if (transformControls && selectedObj) transformControls.attach(selectedObj);
          window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "translate" }, "*");
        }
        else if (transformControls && transformControls.dragging) {
          // Cancel active gizmo drag — restore to pre-drag position
          if (selectedObj && transformControls.__undoPos) {
            selectedObj.position.set(transformControls.__undoPos.x, transformControls.__undoPos.y, transformControls.__undoPos.z);
            selectedObj.rotation.set(transformControls.__undoRot.x, transformControls.__undoRot.y, transformControls.__undoRot.z);
            selectedObj.scale.set(transformControls.__undoScl.x, transformControls.__undoScl.y, transformControls.__undoScl.z);
            sendSelectedObject(selectedObj);
            if (boxHelper && boxHelper.object && boxHelper.object.parent) { try { boxHelper.update(); } catch(e) {} }
          }
        }
        else if (isDragging) { endXZDrag(); }
        else { deselectObject(); }
        e.preventDefault(); break;
      case "Delete": case "Backspace":
        if (selectedObj && editor) {
          var delObj = selectedObj;
          var uuid = delObj.uuid;
          var _kbDelName = delObj.name || "";
          pushUndo({ type: "delete", uuid: uuid, object: delObj });
          editor.scene.remove(delObj);
          deselectObject(); sendSceneTreeThrottled();
          window.parent.postMessage({ type: "game-editor-object-deleted", uuid: uuid, name: _kbDelName }, "*");
          window.parent.postMessage({ type: "game-editor-scene-dirty" }, "*");
        }
        e.preventDefault(); break;
      // Arrow keys — pan camera (Shift = faster)
      case "ArrowUp": panCamera(0, 0, -1, e.shiftKey); e.preventDefault(); break;
      case "ArrowDown": panCamera(0, 0, 1, e.shiftKey); e.preventDefault(); break;
      case "ArrowLeft": panCamera(-1, 0, 0, e.shiftKey); e.preventDefault(); break;
      case "ArrowRight": panCamera(1, 0, 0, e.shiftKey); e.preventDefault(); break;
    }
  }

  function onKeyUp(e) {
    delete flyKeys[e.code];
    // Exit fly mode if no movement keys held and RMB released
    if (flyMode) {
      var anyMoveKey = flyKeys["KeyW"] || flyKeys["KeyA"] || flyKeys["KeyS"] || flyKeys["KeyD"] || flyKeys["KeyQ"] || flyKeys["KeyE"];
      if (!anyMoveKey) exitFlyMode();
    }
  }

  // ---- Editor Loop ----
  // Hoisted reusable objects — avoid per-frame allocations
  var _hoistedWP = null; // Vector3 for pivot mode
  var _hoistedPipSize = null; // Vector2 for PIP
  var _hoistedClearColor = null; // Color for PIP
  function editorLoop() {
    if (!active || !editor) return;
    editorAnimId = requestAnimationFrame(editorLoop);
    updateFlyMovement();
    // Pivot mode: lock orbit target to selected object
    if (pivotMode === "pivot" && selectedObj && editor.orbitControls && !flyMode) {
      if (!_hoistedWP) _hoistedWP = new (window.THREE.Vector3)();
      selectedObj.getWorldPosition(_hoistedWP);
      editor.orbitControls.target.copy(_hoistedWP);
    }
    if (editor.orbitControls && !flyMode) editor.orbitControls.update();
    // Guard: if selectedObj was swapped out of scene by character module, re-find by name
    if (selectedObj && !selectedObj.parent && selectedObjName) {
      var refound = editor.scene.getObjectByName(selectedObjName);
      if (refound && refound !== selectedObj) {
        console.log("[GameEditorBridge] Re-found stale selectedObj: " + selectedObjName);
        selectedObj = refound;
        if (transformControls) { transformControls.attach(refound); }
      }
    }
    if (transformControls && transformControls.update) transformControls.update();
    if (boxHelper && selectedObj) {
      // For animated characters, our update reads selectedObj directly (no stale closure)
      if (boxHelper.userData.__isAnimCharBox || (boxHelper.object && boxHelper.object.parent)) { try { boxHelper.update(); } catch(e) {} }
    }
    if (multiBoxHelpers && multiBoxHelpers.length > 0) {
      for (var mbi = 0; mbi < multiBoxHelpers.length; mbi++) {
        if (multiBoxHelpers[mbi] && multiBoxHelpers[mbi].object && multiBoxHelpers[mbi].object.parent) { try { multiBoxHelpers[mbi].update(); } catch(e) {} }
      }
    }
    // SkinnedMesh skeleton sync handled by bindMode switch in activateBridge/deactivate
    // Update preview camera position (follows player character) — skip when user-dragging
    if (previewCamera && !cameraSelected) updatePreviewCamera();
    // Update camera frustum helper — sync display camera with preview camera position/rotation
    if (cameraHelper && cameraHelper.__displayCam && previewCamera) {
      try {
        cameraHelper.__displayCam.position.copy(previewCamera.position);
        cameraHelper.__displayCam.rotation.copy(previewCamera.rotation);
        cameraHelper.__displayCam.updateProjectionMatrix();
        cameraHelper.update();
      } catch (_chErr) {
        // WebGPU "Texture already initialized" — CameraHelper uses LineBasicMaterial internally
        if (_chErr && _chErr.message && _chErr.message.includes("already initialized")) { /* swallow */ }
        else { console.warn("[GameEditorBridge] CameraHelper update error:", _chErr.message); }
      }
    }
    // Throttled camera orientation broadcast (~10Hz wall-clock)
    var _camNow = Date.now();
    if (!_lastCamBroadcast) _lastCamBroadcast = 0;
    if (_camNow - _lastCamBroadcast >= 100) {
      _lastCamBroadcast = _camNow;
      var q = editor.camera.quaternion;
      if (Math.abs(q.x - _lastCamQ.x) > 0.005 || Math.abs(q.y - _lastCamQ.y) > 0.005 ||
          Math.abs(q.z - _lastCamQ.z) > 0.005 || Math.abs(q.w - _lastCamQ.w) > 0.005) {
        _lastCamQ = { x: +q.x.toFixed(4), y: +q.y.toFixed(4), z: +q.z.toFixed(4), w: +q.w.toFixed(4) };
        window.parent.postMessage({ type: "game-editor-camera-orientation", quaternion: _lastCamQ }, "*");
      }
    }
    // Camera state is saved on deactivation + OrbitControls "end" event (not periodic — periodic causes flashing)
    // Throttled sweep: remove duplicate __editor_ objects every 60 frames (old Game3D.tsx templates lack _hasExt guard)
    if (!editorLoop._sweepCount) editorLoop._sweepCount = 0;
    if (++editorLoop._sweepCount >= 60 && editor.scene) {
      editorLoop._sweepCount = 0;
      var dupes = [];
      for (var ei = 0; ei < editor.scene.children.length; ei++) {
        var ec = editor.scene.children[ei];
        if (ec.name && ec.name.indexOf("__editor_") === 0 && ec !== boxHelper && ec !== transformControls && ec !== tcHelperObj && ec !== gridHelper && ec !== cameraHelper && ec !== previewCamera && ec.type !== "TransformControlsGizmo" && ec.type !== "TransformControlsPlane" && ec.type !== "TransformControlsRoot") dupes.push(ec);
      }
      for (var di = 0; di < dupes.length; di++) { if (dupes[di].detach) dupes[di].detach(); editor.scene.remove(dupes[di]); if (dupes[di].dispose) dupes[di].dispose(); }
    }
    try {
      // Signal to game loop that bridge is rendering — prevents redundant __safeRender calls
      window.__vibexe_bridge_rendering__ = true;
      // Temporarily restore real render methods for our frame (JS is single-threaded — safe)
      var _noop = function() {};
      var _realRender = editor.renderer.__origRender || editor.renderer.render;
      if (editor.renderer.__bridgeWrapped) editor.renderer.render = _realRender;
      // Re-wrap composer if recreated (e.g., FX preset change)
      var composer = window.__vibexe_composer__;
      if (composer && !composer.__bridgeWrapped) {
        composer.__origRender = composer.render.bind(composer);
        composer.render = _noop;
        composer.__bridgeWrapped = true;
      }
      var _realComposer = composer && composer.__origRender;
      if (_realComposer) composer.render = _realComposer;
      // Render scene via composer or direct renderer
      try {
        if (composer && composer.render) {
          composer.render();
        } else {
          editor.renderer.render(editor.scene, editor.camera);
        }
      } catch (__re) { if (__re && __re.message && !__re.message.includes("already initialized") && !__re.message.includes("usedTimes") && !__re.message.includes("is not a function")) throw __re; }
      // Camera Preview PIP — only render when camera is selected
      if (previewCamera && editor.renderer && editor.scene && cameraSelected) {
        var _dpr = editor.renderer.getPixelRatio();
        if (!_hoistedPipSize) _hoistedPipSize = new (window.THREE.Vector2)();
        var _fullSize = editor.renderer.getSize(_hoistedPipSize);
        var _pipW = Math.floor(200 * _dpr);
        var _pipH = Math.floor(120 * _dpr);
        var _pipX = Math.floor(4 * _dpr);
        var _pipY = Math.floor(4 * _dpr);
        if (!_hoistedClearColor) _hoistedClearColor = new (window.THREE.Color)();
        var _prevClearAlpha = editor.renderer.getClearAlpha();
        editor.renderer.getClearColor(_hoistedClearColor);
        try {
          var _border = Math.floor(2 * _dpr);
          editor.renderer.setViewport(_pipX - _border, _pipY - _border, _pipW + _border * 2, _pipH + _border * 2);
          editor.renderer.setScissor(_pipX - _border, _pipY - _border, _pipW + _border * 2, _pipH + _border * 2);
          editor.renderer.setScissorTest(true);
          editor.renderer.setClearColor(0x111111, 0.9);
          editor.renderer.clear();
          editor.renderer.setViewport(_pipX, _pipY, _pipW, _pipH);
          editor.renderer.setScissor(_pipX, _pipY, _pipW, _pipH);
          previewCamera.aspect = 200 / 120;
          previewCamera.updateProjectionMatrix();
          try { editor.renderer.render(editor.scene, previewCamera); } catch (__re2) { if (__re2 && __re2.message && !__re2.message.includes("already initialized")) throw __re2; }
        } finally {
          editor.renderer.setScissorTest(false);
          editor.renderer.setViewport(0, 0, _fullSize.x, _fullSize.y);
          editor.renderer.setClearColor(_hoistedClearColor, _prevClearAlpha);
        }
      }
      // Re-noop for game loop (blocks until next editorLoop frame)
      if (editor.renderer.__bridgeWrapped) editor.renderer.render = _noop;
      if (composer && composer.__bridgeWrapped) composer.render = _noop;
    } catch (e) {
      // WebGPU "Texture already initialized" is non-fatal — do NOT deselect/disrupt editor
      if (e && e.message && (e.message.includes("already initialized") || e.message.includes("usedTimes"))) {
        // Swallow WebGPU texture lifecycle errors — they self-resolve on next frame
      } else {
        // Prevent cascading crashes (e.g., TransformControls infinite recursion)
        console.error("[GameEditorBridge] Render error — cleaning up:", e.message);
        deselectObject();
      }
    }
  }

  // ---- Activate / Deactivate ----
  var pendingActivate = false;
  function activateBridge() {
    if (active || pendingActivate) return;
    // Safety: only activate if parent explicitly sent game-editor-enable
    if (!_enableRequested) { showDebug("activateBridge BLOCKED — no enable requested"); return; }
    pendingActivate = true;
    waitForEditor(function(ed) {
      editor = ed;
      active = true;
      pendingActivate = false;
      window.__vibexe_editor_active__ = true;
      var THREE = window.THREE;
      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();
      // Save camera state before entering editor mode so we can restore on exit
      if (editor && editor.camera) {
        _savedCameraPos = editor.camera.position.clone();
        _savedCameraQuat = editor.camera.quaternion.clone();
      }
      if (editor && editor.orbitControls && editor.orbitControls.target) {
        _savedOrbitTarget = editor.orbitControls.target.clone();
      }
      editor.pause();
      // Prevent game loop double-render by no-opping renderer.render + composer.render
      // The game loop still runs in __editorMode and calls these every frame, fighting our editorLoop.
      // JS is single-threaded so we temporarily restore originals during our own render (safe).
      if (editor.renderer && !editor.renderer.__bridgeWrapped) {
        editor.renderer.__origRender = editor.renderer.render.bind(editor.renderer);
        editor.renderer.render = function() {}; // no-op for game loop
        editor.renderer.__bridgeWrapped = true;
      }
      var _c = window.__vibexe_composer__;
      if (_c && !_c.__bridgeWrapped) {
        _c.__origRender = _c.render.bind(_c);
        _c.render = function() {}; // no-op for game loop
        _c.__bridgeWrapped = true;
      }
      // === Runtime renderer optimizations (patches old saved IIFE code) ===
      // SAVE all renderer state before modifying — restored in deactivateBridge()
      if (editor.renderer) {
        var _r = editor.renderer;
        _savedPixelRatio = _r.getPixelRatio();
        _savedShadowMapType = _r.shadowMap ? _r.shadowMap.type : null;
        _savedShadowAutoUpdate = _r.shadowMap ? _r.shadowMap.autoUpdate : null;
        _savedShadowEnabled = _r.shadowMap ? _r.shadowMap.enabled : null;
        showDebug("Saved renderer state: PR=" + _savedPixelRatio + " shadowType=" + _savedShadowMapType + " shadowAuto=" + _savedShadowAutoUpdate + " shadowOn=" + _savedShadowEnabled);
        // Cap pixelRatio at 1.0 for max FPS
        if (_r.getPixelRatio() > 1.0) {
          _r.setPixelRatio(1.0);
          showDebug("PerfPatch: pixelRatio capped to 1.0 (was " + _savedPixelRatio + ")");
        }
        // Switch to faster shadow filtering
        if (THREE.PCFShadowMap !== undefined && _r.shadowMap.type !== THREE.PCFShadowMap) {
          _r.shadowMap.type = THREE.PCFShadowMap;
          _r.shadowMap.needsUpdate = true;
          showDebug("PerfPatch: PCFShadowMap (was PCFSoft)");
        }
        // Disable shadow autoUpdate (manual control for perf)
        if (_r.shadowMap.autoUpdate !== false) {
          _r.shadowMap.autoUpdate = false;
          _r.shadowMap.needsUpdate = true;
          showDebug("PerfPatch: shadow autoUpdate disabled");
        }
        // Reduce shadow map resolution on directional lights
        if (editor.scene) {
          editor.scene.traverse(function(obj) {
            if (obj.isDirectionalLight && obj.shadow && obj.shadow.mapSize) {
              if (obj.shadow.mapSize.width > 1024) {
                obj.shadow.mapSize.width = 1024;
                obj.shadow.mapSize.height = 1024;
                if (obj.shadow.map) { obj.shadow.map.dispose(); obj.shadow.map = null; }
                _r.shadowMap.needsUpdate = true;
                showDebug("PerfPatch: shadow map 1024 for " + obj.name);
              }
            }
          });
        }
        // Disable bloom and bypass EffectComposer for editor perf
        // Save skipComposer state — PerfGuard may have intentionally enabled/disabled it
        _savedSkipComposer = !!window.__vibexe_skipComposer__;
        var _comp = window.__vibexe_composer__;
        if (_comp && _comp.passes) {
          for (var _bi = 0; _bi < _comp.passes.length; _bi++) {
            if (_comp.passes[_bi].constructor && _comp.passes[_bi].constructor.name === 'UnrealBloomPass') {
              _comp.passes[_bi].enabled = false;
            }
          }
          window.__vibexe_skipComposer__ = true;
          showDebug("PerfPatch: bloom disabled + composer bypass (was skipComposer=" + _savedSkipComposer + ")");
        }
      }
      // Fix OrbitControls for editor mode — must use deferred override because
      // the embedded bridge in Game3D.tsx also handles game-editor-activate and
      // calls pause() which creates OrbitControls with default mouseButtons.
      // Unity-style: LEFT=select/gizmo, MIDDLE=pan, RIGHT=orbit, scroll=zoom
      function fixOrbitControls() {
        if (!editor || !editor.orbitControls) return;
        var oc = editor.orbitControls;
        // Save original mouseButtons on first call (for non-editor-created controls)
        if (!_savedOrbitMouseButtons && !oc._vibexeEditorCreated && oc.mouseButtons) {
          _savedOrbitMouseButtons = { LEFT: oc.mouseButtons.LEFT, MIDDLE: oc.mouseButtons.MIDDLE, RIGHT: oc.mouseButtons.RIGHT };
        }
        oc.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
        oc.screenSpacePanning = true;
        // No distance limits — allow infinite zoom for long maps
        oc.minDistance = 0.1;
        oc.maxDistance = 100000;
        // Faster default zoom speed
        oc.zoomSpeed = 2.0;
        // Target at scene center ground level — stable orbit point for any scene type
        oc.target.set(0, 1, 0);
        oc.update();
      }
      // Immediate fix attempt
      if (THREE.OrbitControls) {
        if (!editor.orbitControls) {
          editor.orbitControls = new THREE.OrbitControls(editor.camera, editor.renderer.domElement);
          editor.orbitControls._vibexeEditorCreated = true;
          editor.orbitControls.enableDamping = true;
          editor.orbitControls.dampingFactor = 0.12;
          // Save camera state when user finishes orbiting/panning/zooming
          editor.orbitControls.addEventListener("end", function() {
            if (!active || !editor || !editor.camera || !editor.orbitControls) return;
            var _cp = editor.camera.position;
            var _ct = editor.orbitControls.target;
            window.parent.postMessage({
              type: "game-editor-camera-state",
              position: [_cp.x, _cp.y, _cp.z],
              target: [_ct.x, _ct.y, _ct.z]
            }, "*");
          });
        }
        fixOrbitControls();
      }
      // Deferred fix — catches embedded bridge's pause() overwriting our settings
      setTimeout(fixOrbitControls, 50);
      setTimeout(fixOrbitControls, 200);
      // Restore persisted camera position/target AFTER fixOrbitControls finishes
      // (fixOrbitControls resets oc.target to (0,1,0), so restore must come later)
      if (_restoreCameraPos) {
        setTimeout(function() {
          if (editor && editor.camera && editor.orbitControls && _restoreCameraPos) {
            editor.camera.position.set(_restoreCameraPos[0], _restoreCameraPos[1], _restoreCameraPos[2]);
            if (_restoreCameraTarget) {
              editor.orbitControls.target.set(_restoreCameraTarget[0], _restoreCameraTarget[1], _restoreCameraTarget[2]);
            }
            editor.orbitControls.update();
            showDebug("Restored persisted camera pos=[" + _restoreCameraPos.join(",") + "] target=[" + (_restoreCameraTarget || []).join(",") + "]");
            _restoreCameraPos = null;
            _restoreCameraTarget = null;
          }
        }, 250);
      }
      showDebug("Bridge ACTIVATED. Canvas: " + editor.renderer.domElement.tagName + " " + editor.renderer.domElement.width + "x" + editor.renderer.domElement.height);
      // Signal editor mode to character controller (stops position/camera sync)
      window.__vibexe_editor_active = true;
      // On activation, ensure texture colorSpace is correct and env maps are applied
      setTimeout(function() {
        var _hasPBR = false;
        var _srgb = THREE.SRGBColorSpace || 'srgb';
        editor.scene.traverse(function(c) {
          if (!c.isMesh || !c.material) return;
          var _va = c.parent && c.parent.userData && c.parent.userData.vibexeArgs;
          if (_va && _va.hasPBR) _hasPBR = true;
          var _m = c.material;
          // Ensure color maps use sRGB colorSpace
          if (_m.map && _m.map.colorSpace !== _srgb) { _m.map.colorSpace = _srgb; _m.map.needsUpdate = true; _m.needsUpdate = true; }
          // Add env map for metals
          if (_m.isMeshStandardMaterial && _m.metalnessMap) {
            if (editor.scene.environment && !_m.envMap) _m.envMap = editor.scene.environment;
            _m.envMapIntensity = 1.0;
            _m.needsUpdate = true;
          }
        });
        // Always ensure tone mapping + exposure for r183 PBR (even terrain-only scenes)
        _ensureToneMapping();
        if (_hasPBR) _ensurePBREnv();
        showDebug("PBR textures colorSpace verified, env applied");
        // Suspend character system controllers so they don't overwrite positions during editor mode
        if (window._activeControllers3D) {
          window.__savedCharControllers3D = [];
          for (var _sci = window._activeControllers3D.length - 1; _sci >= 0; _sci--) {
            if (window._activeControllers3D[_sci] && window._activeControllers3D[_sci].__charSystem) {
              window.__savedCharControllers3D.push(window._activeControllers3D[_sci]);
              window._activeControllers3D.splice(_sci, 1);
            }
          }
          if (window.__savedCharControllers3D.length) showDebug("Suspended " + window.__savedCharControllers3D.length + " charSystem controllers");
        }
        // Fix AnimatedCharacter gizmo-mesh alignment in editor mode.
        // The GLB "Scene" root node can accumulate position drift from animation tracks
        // (e.g. "Scene.position"). This makes the rendered mesh appear far from the Group
        // origin where the gizmo attaches. Fix: zero all intermediate node positions and
        // use BBox-center measurement as authoritative fallback.
        editor.scene.traverse(function(_acNode) {
          if (!_acNode.userData || _acNode.userData.vibexeType !== "AnimatedCharacter") return;
          var _acSkm = null;
          _acNode.traverse(function(_c) { if (!_acSkm && _c.isSkinnedMesh) _acSkm = _c; });
          if (!_acSkm) return;
          // Ensure attached bindMode
          if (_acSkm.bindMode !== "attached") {
            _acNode.__savedBindMode = _acSkm.bindMode;
            _acSkm.bindMode = "attached";
          }
          // STEP 1: Zero out ALL intermediate group positions (pivot, GLB root "Scene" node).
          // These can accumulate drift from animation playback or GLB baked offsets.
          // Save them for restoration on deactivation.
          var _savedChildPositions = [];
          _acNode.traverse(function(_ch) {
            if (_ch === _acNode) return; // skip the root group itself
            if (_ch.isSkinnedMesh || _ch.isBone) return; // don't touch mesh/bone positions
            if (_ch.position.lengthSq() > 0.0001) {
              _savedChildPositions.push({ node: _ch, pos: _ch.position.clone() });
              showDebug("AnimChar zeroing child '" + (_ch.name || _ch.type) + "' pos=(" + _ch.position.x.toFixed(3) + "," + _ch.position.y.toFixed(3) + "," + _ch.position.z.toFixed(3) + ")");
              _ch.position.set(0, 0, 0);
            }
          });
          _acNode.__savedChildPositions = _savedChildPositions;
          // STEP 2: Measure BBox center vs group position for remaining offset
          _acNode.updateMatrixWorld(true);
          try {
            var _bbox = new THREE.Box3().setFromObject(_acNode);
            var _bboxCenter = new THREE.Vector3();
            _bbox.getCenter(_bboxCenter);
            var _dx = _bboxCenter.x - _acNode.position.x;
            var _dy = _bboxCenter.y - _acNode.position.y;
            var _dz = _bboxCenter.z - _acNode.position.z;
            if (Math.abs(_dx) > 0.3 || Math.abs(_dy) > 0.3 || Math.abs(_dz) > 0.3) {
              _acNode.__savedGroupPos = _acNode.position.clone();
              _acNode.__editorRedistOffset = { x: _dx, y: _dy, z: _dz };
              _acNode.position.x += _dx;
              _acNode.position.y += _dy;
              _acNode.position.z += _dz;
              _acNode.updateWorldMatrix(false, true);
              showDebug("AnimChar '" + _acNode.name + "': bbox-aligned (" + _dx.toFixed(2) + "," + _dy.toFixed(2) + "," + _dz.toFixed(2) + ")");
            } else {
              showDebug("AnimChar '" + _acNode.name + "': aligned (offset < 0.3)");
            }
          } catch(_bboxErr) {
            showDebug("AnimChar '" + _acNode.name + "': BBox measurement failed");
          }
          if (selectedObj === _acNode) {
            sendSelectedObject(_acNode);
            if (boxHelper && boxHelper.update) try { boxHelper.update(); } catch(_e) {}
          }
        });
      }, 300);
      // FX auto-apply happens via applySettings message (sent 200ms after bridge loads)
      // Prevent right-click context menu on canvas (for flythrough mode)
      flyContextMenuHandler = function(e) { if (active) e.preventDefault(); };
      editor.renderer.domElement.addEventListener("contextmenu", flyContextMenuHandler);
      // Flythrough: track right mouse button
      flyRMBDownHandler = function(e) {
        if (!active || !editor || e.button !== 2) return;
        if (panToolActive) return; // Don't enter fly mode from pan mode
        flyRMBDown = true;
        flyLastMouse = { x: e.clientX, y: e.clientY };
      };
      flyRMBUpHandler = function(e) {
        if (e.button !== 2) return;
        flyRMBDown = false;
        flyLastMouse = null;
        if (flyMode) exitFlyMode();
      };
      flyMouseMoveHandler = function(e) {
        if (!flyMode || !flyLastMouse || !editor) return;
        var dx = e.clientX - flyLastMouse.x;
        var dy = e.clientY - flyLastMouse.y;
        flyLastMouse = { x: e.clientX, y: e.clientY };
        // Rotate camera (look around) — yaw+pitch with Euler YXZ order
        editor.camera.rotation.order = "YXZ";
        editor.camera.rotation.y -= dx * 0.003;
        editor.camera.rotation.x -= dy * 0.003;
        editor.camera.rotation.x = Math.max(-1.5, Math.min(1.5, editor.camera.rotation.x));
      };
      window.addEventListener("mousedown", flyRMBDownHandler, true);
      window.addEventListener("mouseup", flyRMBUpHandler, true);
      window.addEventListener("mousemove", flyMouseMoveHandler, true);
      // Ctrl/Shift + Scroll = faster zoom (5x speed boost)
      flyWheelHandler = function(e) {
        if (!active || !editor || !editor.orbitControls) return;
        if (flyMode) {
          // In fly mode, scroll adjusts movement speed
          flyKeys.__scrollSpeed = Math.max(0.2, Math.min(10, (flyKeys.__scrollSpeed || 1) + (e.deltaY > 0 ? -0.3 : 0.3)));
          e.preventDefault();
          return;
        }
        if (e.ctrlKey || e.shiftKey) {
          // Speed boost: directly move camera along view direction
          e.preventDefault();
          e.stopPropagation();
          var THREE = window.THREE;
          var dir = new THREE.Vector3();
          editor.camera.getWorldDirection(dir);
          var boost = e.deltaY > 0 ? -3 : 3;
          editor.camera.position.addScaledVector(dir, boost);
          if (editor.orbitControls) {
            editor.orbitControls.target.addScaledVector(dir, boost);
            editor.orbitControls.update();
          }
        }
      };
      editor.renderer.domElement.addEventListener("wheel", flyWheelHandler, { capture: true, passive: false });
      // Key up handler (for flythrough key release)
      flyKeyUpHandler = function(e) { if (active) onKeyUp(e); };
      window.addEventListener("keyup", flyKeyUpHandler, true);
      // Register click handlers: window capture + canvas direct + pointerdown backup
      window.addEventListener("mousedown", onCanvasMouseDown, true);
      window.addEventListener("mousemove", onCanvasMouseMove, true);
      window.addEventListener("mouseup", onCanvasMouseUp, true);
      window.addEventListener("keydown", onKeyDown, true);
      // NOTE: canvasPointerDownHandler REMOVED — it fired before TC's own pointerdown,
      // causing handleClick→raycast miss→deselectObject→TC.detach BEFORE TC could start drag.
      // Window capture mousedown handler (onCanvasMouseDown) is sufficient for selection.
      // Also listen on document.body for clicks (catches clicks on HUD overlays)
      bodyMouseDownHandler = function(e) {
        if (!active || !editor) return;
        if (e.button !== 0) return;
        showDebug("body-mousedown: " + e.clientX + "," + e.clientY + " target=" + (e.target||{}).tagName + " class=" + ((e.target||{}).className||"").toString().slice(0,30));
        // Only forward to handleClick if not already handled (check if target is canvas or its parent)
        if (e.target !== editor.renderer.domElement) {
          handleClick(e.clientX, e.clientY, "body-mousedown");
        }
      };
      document.body.addEventListener("mousedown", bodyMouseDownHandler, true);
      // Hide game HUD elements so they don't intercept pointer events
      // Match both inline styles AND common CSS class patterns
      var allEls = document.querySelectorAll("div, span, p, h1, h2, h3, button");
      for (var hi = 0; hi < allEls.length; hi++) {
        var hel = allEls[hi];
        if (hel === editor.renderer.domElement || hel === editor.renderer.domElement.parentElement) continue;
        // (debugEl check removed — no visual overlay)
        var cs = window.getComputedStyle(hel);
        if (cs.position === "absolute" || cs.position === "fixed") {
          hel.dataset.editorOrigDisplay = hel.style.display || "";
          hel.style.display = "none";
          hel.style.pointerEvents = "none";
          hel.setAttribute("data-editor-hidden", "1");
        }
      }
      createPreviewCamera();
      editorLoop();
      setTimeout(function() {
        sendSceneTreeThrottled();
        window.parent.postMessage({ type: "game-editor-ready" }, "*");
      }, 100);
    });
  }

  // ---- Auto-Physics System ----
  // Scans all scene meshes and creates CANNON bodies for objects that need them.
  // Uses vibexeType or name prefix to determine physics behavior:
  //   platform/barrier → static box body (solid)
  //   collectible → no body (trigger via distance)
  //   decoration → no body (visual only)
  //   character/player → skip (has own dynamic body)
  function rebuildAutoPhysics(scene) {
    var w = window.__vibexe_world__;
    if (!w) { console.log("[AutoPhysics] No physics world, skipping"); return; }
    var C = window.CANNON;
    if (!C) { console.log("[AutoPhysics] CANNON not loaded, skipping"); return; }
    var T = window.THREE || (typeof THREE !== "undefined" ? THREE : null);
    if (!T) return;

    var solidTypes = { platform: 1, barrier: 1 };
    var skipTypes = { collectible: 1, decoration: 1, player: 1, AnimatedCharacter: 1 };
    var created = 0, synced = 0, skipped = 0;

    scene.traverse(function(obj) {
      if (!obj.isMesh && !(obj.isGroup && obj.children && obj.children.length > 0)) return;
      if (!obj.userData) return;

      // Determine vibexeType from userData or name prefix
      var vType = obj.userData.vibexeType;
      if (!vType && obj.name) {
        if (obj.name.indexOf("Platform_") === 0 || obj.name.indexOf("platform_") === 0) vType = "platform";
        else if (obj.name.indexOf("Barrier_") === 0 || obj.name.indexOf("barrier_") === 0) vType = "barrier";
        else if (obj.name.indexOf("Collectible_") === 0) vType = "collectible";
        else if (obj.name.indexOf("Decoration_") === 0) vType = "decoration";
        else if (obj.name.indexOf("Character_") === 0 || obj.name.indexOf("Player_") === 0) vType = "player";
      }
      if (!vType) return;
      if (skipTypes[vType]) return;
      if (!solidTypes[vType]) return;

      // If already has a body, sync position and check for scale changes
      var existingBody = obj.userData.__physicsBody;
      if (existingBody && existingBody.position) {
        // Bug #9: Check if scale changed — if so, remove old body and recreate
        var ls = existingBody.__lastScale;
        if (ls && (Math.abs(ls.x - obj.scale.x) > 0.001 || Math.abs(ls.y - obj.scale.y) > 0.001 || Math.abs(ls.z - obj.scale.z) > 0.001)) {
          // Scale changed — remove old body so a new one is created below
          w.removeBody(existingBody);
          obj.userData.__physicsBody = null;
          // Also remove Rapier body if exists (Phase 3)
          var _scRW = window.__vibexe_rapierWorld__;
          if (_scRW && obj.userData.__rapierBody) {
            try { _scRW.removeRigidBody(obj.userData.__rapierBody); } catch(e) {}
            obj.userData.__rapierBody = null;
          }
          // Fall through to create a new body with updated dimensions
        } else {
          // Bug #8: Account for pivot offset when syncing position
          var pOff = existingBody.__pivotOffset || { x: 0, y: 0, z: 0 };
          existingBody.position.set(obj.position.x + pOff.x, obj.position.y + pOff.y, obj.position.z + pOff.z);
          if (existingBody.velocity) existingBody.velocity.set(0, 0, 0);
          synced++;
          return;
        }
      }

      // Check if there's already a body in world near this mesh position
      var found = false;
      for (var bi = 0; bi < w.bodies.length; bi++) {
        var b = w.bodies[bi];
        if (b.__meshName === obj.name || b.__meshRef === obj) { obj.userData.__physicsBody = b; found = true; break; }
        if (Math.abs(b.position.x - obj.position.x) < 0.3 &&
            Math.abs(b.position.y - obj.position.y) < 0.3 &&
            Math.abs(b.position.z - obj.position.z) < 0.3) {
          obj.userData.__physicsBody = b; b.__meshRef = obj; b.__meshName = obj.name; found = true; break;
        }
      }
      if (found) { synced++; return; }

      // Compute bounding box from mesh/group
      var box3 = new T.Box3();
      try {
        box3.expandByObject(obj);
      } catch(e) { return; }
      if (box3.isEmpty()) return;

      var sz = new T.Vector3();
      box3.getSize(sz);
      var ctr = new T.Vector3();
      box3.getCenter(ctr);

      // Half-extents (minimum 0.05 to avoid degenerate shapes)
      var hx = Math.max(sz.x * 0.5, 0.05);
      var hy = Math.max(sz.y * 0.5, 0.05);
      var hz = Math.max(sz.z * 0.5, 0.05);

      var shape = new C.Box(new C.Vec3(hx, hy, hz));
      shape.__origHE = { x: hx, y: hy, z: hz };
      var body = new C.Body({ mass: 0, shape: shape });
      body.position.set(ctr.x, ctr.y, ctr.z);
      body.type = C.Body.STATIC;
      body.__meshRef = obj;
      body.__meshName = obj.name || "";
      body.__autoPhysics = true;
      // Store offset from mesh origin to bbox center (Bug #8: GLTF offset pivots)
      body.__pivotOffset = { x: ctr.x - obj.position.x, y: ctr.y - obj.position.y, z: ctr.z - obj.position.z };
      // Store scale at creation time so we can detect changes (Bug #9)
      body.__lastScale = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };
      w.addBody(body);
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
      created++;
    });

    if (created > 0 || synced > 0) {
      console.log("[AutoPhysics] Created " + created + " bodies, synced " + synced + ", skipped " + skipped + (window.__vibexe_rapierWorld__ ? " (+ Rapier)" : ""));
    }
  }

  function deactivateBridge() {
    if (!active) return;
    // Send camera state to parent BEFORE cleanup (so it can be persisted and restored later)
    // Validate: skip if position is extreme (corruption guard)
    if (editor && editor.camera && editor.orbitControls) {
      var cp = editor.camera.position;
      var ct = editor.orbitControls.target;
      var _cpSaveMax = Math.max(Math.abs(cp.x), Math.abs(cp.y), Math.abs(cp.z));
      if (_cpSaveMax <= 2000) {
        window.parent.postMessage({
          type: "game-editor-camera-state",
          position: [cp.x, cp.y, cp.z],
          target: [ct.x, ct.y, ct.z]
        }, "*");
      } else {
        console.warn("[GameEditorBridge] Skipping camera save — extreme position (max=" + _cpSaveMax.toFixed(0) + ")");
      }
    }
    active = false;
    window.__vibexe_editor_active__ = false;
    window.__vibexe_bridge_rendering__ = false;
    // Restore composer bypass to pre-bridge state (PerfGuard may have set it true for perf)
    window.__vibexe_skipComposer__ = _savedSkipComposer != null ? _savedSkipComposer : false;
    _savedSkipComposer = null;
    // Re-enable bloom passes that editor disabled (legacy EffectComposer path)
    var _rstComp = window.__vibexe_composer__;
    if (_rstComp && _rstComp.passes) {
      for (var _ri = 0; _ri < _rstComp.passes.length; _ri++) {
        if (_rstComp.passes[_ri].constructor && _rstComp.passes[_ri].constructor.name === 'UnrealBloomPass') {
          _rstComp.passes[_ri].enabled = true;
        }
      }
    }
    // Restore original render methods so game loop renders normally in Game mode
    if (editor && editor.renderer && editor.renderer.__bridgeWrapped) {
      editor.renderer.render = editor.renderer.__origRender;
      delete editor.renderer.__origRender;
      delete editor.renderer.__bridgeWrapped;
    }
    var _dc = window.__vibexe_composer__;
    if (_dc && _dc.__bridgeWrapped) {
      _dc.render = _dc.__origRender;
      delete _dc.__origRender;
      delete _dc.__bridgeWrapped;
    }
    // Restore ALL saved renderer state (prevents Game mode quality degradation after Scene editing)
    if (editor && editor.renderer) {
      var _rr = editor.renderer;
      if (_savedPixelRatio != null) {
        _rr.setPixelRatio(_savedPixelRatio);
        showDebug("Restored pixelRatio: " + _savedPixelRatio);
      }
      if (_rr.shadowMap) {
        if (_savedShadowMapType != null) { _rr.shadowMap.type = _savedShadowMapType; }
        if (_savedShadowAutoUpdate != null) { _rr.shadowMap.autoUpdate = _savedShadowAutoUpdate; }
        if (_savedShadowEnabled != null) { _rr.shadowMap.enabled = _savedShadowEnabled; }
        _rr.shadowMap.needsUpdate = true;
        showDebug("Restored shadows: type=" + _savedShadowMapType + " auto=" + _savedShadowAutoUpdate + " enabled=" + _savedShadowEnabled);
      }
      _savedPixelRatio = null;
      _savedShadowMapType = null;
      _savedShadowAutoUpdate = null;
      _savedShadowEnabled = null;
    }
    // Reset AdaptiveQuality counters so it doesn't fight restored state
    var _aqState = window.__vibexe_adaptive_quality__;
    if (_aqState) { _aqState.reductions = 0; }
    cancelAnimationFrame(editorAnimId);
    // Clear pending persistTransform timer to prevent stale messages after deactivation
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    // Exit fly mode if active
    if (flyMode) exitFlyMode();
    flyMode = false; flyKeys = {}; flyRMBDown = false; flyLastMouse = null;
    // Clean up animation progress interval
    if (__animProgressInterval) { clearInterval(__animProgressInterval); __animProgressInterval = null; }
    // Clean up terrain physics watcher interval (created when world not ready yet)
    if (window.__vibexe_terrainPhysicsWatcher) { clearInterval(window.__vibexe_terrainPhysicsWatcher); window.__vibexe_terrainPhysicsWatcher = null; }
    // Clear scene tree throttle timer
    if (_sceneTreeTimer) { clearTimeout(_sceneTreeTimer); _sceneTreeTimer = null; _sceneTreeQueued = false; }
    // Deactivate terrain sculpting if active (prevents leaked event listeners + stale _sculptActive flag)
    if (_sculptActive) {
      _sculptActive = false;
      _sculptMouseDown = false;
      if (_sculptBrushMesh && editor && editor.scene) { editor.scene.remove(_sculptBrushMesh); _sculptBrushMesh.geometry.dispose(); _sculptBrushMesh.material.dispose(); _sculptBrushMesh = null; }
      if (window.__sculptMouseMove) window.removeEventListener("mousemove", window.__sculptMouseMove, true);
      if (window.__sculptMouseDown) window.removeEventListener("mousedown", window.__sculptMouseDown, true);
      if (window.__sculptMouseUp) window.removeEventListener("mouseup", window.__sculptMouseUp, true);
      if (window.__sculptPointerDown) window.removeEventListener("pointerdown", window.__sculptPointerDown, true);
    }
    // Clear editor-active flag so character controller resumes position sync
    window.__vibexe_editor_active = false;
    // Restore AnimatedCharacter: bindMode + positions (were adjusted for editor alignment)
    if (editor && editor.scene) {
      editor.scene.traverse(function(_dn) {
        if (_dn.userData && _dn.userData.vibexeType === "AnimatedCharacter") {
          // Restore bindMode if it was changed (old saves might still use detached)
          if (_dn.__savedBindMode) {
            var _restoreSkm = null;
            _dn.traverse(function(_rc) { if (!_restoreSkm && _rc.isSkinnedMesh) _restoreSkm = _rc; });
            if (_restoreSkm) {
              _restoreSkm.bindMode = _dn.__savedBindMode;
              _restoreSkm.updateMatrixWorld(true);
            }
            delete _dn.__savedBindMode;
          }
          if (_dn.__savedGroupPos) {
            _dn.position.copy(_dn.__savedGroupPos);
            delete _dn.__savedGroupPos;
          }
          // Restore all saved child positions (pivot, GLB root, etc.)
          if (_dn.__savedChildPositions) {
            for (var _rpi = 0; _rpi < _dn.__savedChildPositions.length; _rpi++) {
              var _rp = _dn.__savedChildPositions[_rpi];
              _rp.node.position.copy(_rp.pos);
            }
            delete _dn.__savedChildPositions;
          }
          if (_dn.__savedGroupPos || _dn.__editorRedistOffset) {
            _dn.updateWorldMatrix(false, true);
          }
          delete _dn.__editorRedistOffset;
        }
      });
    }
    // Restore suspended character system controllers
    if (window.__savedCharControllers3D && window._activeControllers3D) {
      for (var _rci = 0; _rci < window.__savedCharControllers3D.length; _rci++) {
        window._activeControllers3D.push(window.__savedCharControllers3D[_rci]);
      }
      delete window.__savedCharControllers3D;
    }
    deselectObject();
    clearMultiHighlight();
    // Dispose reusable TransformControls on bridge deactivation
    if (transformControls && editor) {
      transformControls.detach();
      var tcH = transformControls.getHelper ? transformControls.getHelper() : transformControls;
      editor.scene.remove(tcH);
      if (transformControls.dispose) transformControls.dispose();
      transformControls = null;
    }
    if (isDragging) endXZDrag();
    if (gridHelper && editor) { editor.scene.remove(gridHelper); if (gridHelper.dispose) gridHelper.dispose(); gridHelper = null; }
    // Clean up camera preview + frustum
    destroyCameraHelper();
    destroyPreviewCamera();
    cameraSelected = false;
    pivotMode = "center";
    // Restore game camera if ortho was active
    if (editorProjectionMode !== "perspective" && window.__vibexe_camera__ && editor) {
      editor.camera = window.__vibexe_camera__;
    }
    editorProjectionMode = "perspective";
    // Dispose editor-created OrbitControls, or restore original mouseButtons for game's own controls
    if (editor && editor.orbitControls) {
      if (editor.orbitControls._vibexeEditorCreated) {
        editor.orbitControls.dispose();
        editor.orbitControls = null;
      } else if (_savedOrbitMouseButtons) {
        editor.orbitControls.mouseButtons = _savedOrbitMouseButtons;
      }
    }
    _savedOrbitMouseButtons = null;
    gridSnap = false;
    panToolActive = false;
    gizmoSpace = "world";
    undoStack = [];
    redoStack = [];
    // Restore game HUD visibility and pointer events
    var hiddenEls = document.querySelectorAll("[data-editor-hidden]");
    for (var ri = 0; ri < hiddenEls.length; ri++) {
      hiddenEls[ri].style.pointerEvents = "";
      hiddenEls[ri].style.display = hiddenEls[ri].dataset.editorOrigDisplay || "";
      delete hiddenEls[ri].dataset.editorOrigDisplay;
      hiddenEls[ri].removeAttribute("data-editor-hidden");
    }
    if (editor) {
      editor.resume();
      // Restore camera position/rotation from before editor mode was entered
      if (_savedCameraPos && editor.camera) {
        editor.camera.position.copy(_savedCameraPos);
        editor.camera.quaternion.copy(_savedCameraQuat);
        if (editor.orbitControls && _savedOrbitTarget) {
          editor.orbitControls.target.copy(_savedOrbitTarget);
          editor.orbitControls.update();
        }
        _savedCameraPos = null;
        _savedCameraQuat = null;
        _savedOrbitTarget = null;
      }
      // Auto-physics: ensure all scene objects have appropriate CANNON bodies
      rebuildAutoPhysics(editor.scene);
    }
    window.removeEventListener("mousedown", onCanvasMouseDown, true);
    window.removeEventListener("mousemove", onCanvasMouseMove, true);
    window.removeEventListener("mouseup", onCanvasMouseUp, true);
    window.removeEventListener("keydown", onKeyDown, true);
    // Remove flythrough handlers
    if (flyRMBDownHandler) window.removeEventListener("mousedown", flyRMBDownHandler, true);
    if (flyRMBUpHandler) window.removeEventListener("mouseup", flyRMBUpHandler, true);
    if (flyMouseMoveHandler) window.removeEventListener("mousemove", flyMouseMoveHandler, true);
    if (flyKeyUpHandler) window.removeEventListener("keyup", flyKeyUpHandler, true);
    if (flyContextMenuHandler && editor) editor.renderer.domElement.removeEventListener("contextmenu", flyContextMenuHandler);
    if (flyWheelHandler && editor) editor.renderer.domElement.removeEventListener("wheel", flyWheelHandler, { capture: true });
    flyRMBDownHandler = null; flyRMBUpHandler = null; flyMouseMoveHandler = null;
    flyKeyUpHandler = null; flyWheelHandler = null; flyContextMenuHandler = null;
    // Remove stored anonymous handlers (prevents accumulation on toggle)
    if (canvasPointerDownHandler && editor) {
      editor.renderer.domElement.removeEventListener("pointerdown", canvasPointerDownHandler, false);
    }
    if (bodyMouseDownHandler) {
      document.body.removeEventListener("mousedown", bodyMouseDownHandler, true);
    }
    canvasPointerDownHandler = null;
    bodyMouseDownHandler = null;
    raycaster = null; mouse = null; editor = null;
  }

  // ---- Property Updates ----
  function updateProperty(uuid, property, value, skipUndo) {
    if (!editor) return;
    var obj = findByUuid(editor.scene, uuid);
    if (!obj) return;
    if (!skipUndo) {
      var oldVal = null;
      switch (property) {
        case "position.x": oldVal = obj.position.x; break;
        case "position.y": oldVal = obj.position.y; break;
        case "position.z": oldVal = obj.position.z; break;
        case "rotation.x": oldVal = obj.rotation.x * 180 / Math.PI; break;
        case "rotation.y": oldVal = obj.rotation.y * 180 / Math.PI; break;
        case "rotation.z": oldVal = obj.rotation.z * 180 / Math.PI; break;
        case "scale.x": oldVal = obj.scale.x; break;
        case "scale.y": oldVal = obj.scale.y; break;
        case "scale.z": oldVal = obj.scale.z; break;
        case "visible": oldVal = obj.visible; break;
      }
      if (oldVal !== null) pushUndo({ type: "property", uuid: uuid, property: property, oldValue: oldVal, newValue: value });
    }
    switch (property) {
      case "position.x": obj.position.x = Number(value); break;
      case "position.y": obj.position.y = Number(value); break;
      case "position.z": obj.position.z = Number(value); break;
      case "rotation.x": obj.rotation.x = Number(value) * Math.PI / 180; break;
      case "rotation.y": obj.rotation.y = Number(value) * Math.PI / 180; break;
      case "rotation.z": obj.rotation.z = Number(value) * Math.PI / 180; break;
      case "scale.x": obj.scale.x = Number(value); break;
      case "scale.y": obj.scale.y = Number(value); break;
      case "scale.z": obj.scale.z = Number(value); break;
      case "visible": obj.visible = !!value; break;
      case "name": obj.name = String(value); break;
    }
    if (boxHelper && selectedObj && selectedObj.uuid === uuid && boxHelper.object && boxHelper.object.parent) { try { boxHelper.update(); } catch(e) {} }
    sendSelectedObject(obj); sendSceneTreeThrottled();
    window.parent.postMessage({ type: "game-editor-scene-dirty" }, "*");
    // Persist transform/property changes to source code
    if (property.indexOf("position") === 0 || property.indexOf("rotation") === 0 || property.indexOf("scale") === 0) {
      persistTransform(obj);
    }
  }

  // ---- PostMessage Handler ----
  window.addEventListener("message", function(e) {
    if (e.origin !== window.location.origin) return;
    var d = e.data;
    if (!d || !d.type) return;
    switch (d.type) {
      case "game-editor-enable":
        _enableRequested = true;
        if (d.cameraPosition) {
          // Validate camera position — reject extreme values from corrupted terrain eras
          var _cpMax = Math.max(Math.abs(d.cameraPosition[0]), Math.abs(d.cameraPosition[1]), Math.abs(d.cameraPosition[2]));
          if (_cpMax > 2000) {
            console.warn("[GameEditorBridge] Rejected extreme persisted camera pos (max=" + _cpMax.toFixed(0) + ") — using default");
            _restoreCameraPos = [0, 30, 150];
            _restoreCameraTarget = [0, 10, 0];
          } else {
            _restoreCameraPos = d.cameraPosition;
            _restoreCameraTarget = d.cameraTarget || null;
          }
        }
        activateBridge();
        break;
      case "game-editor-disable": _enableRequested = false; deactivateBridge(); break;
      case "game-editor-set-mode":
        if (d.mode === "pan") {
          panToolActive = true;
          if (transformControls) transformControls.detach();
          if (editor && editor.orbitControls) {
            editor.orbitControls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
          }
        } else {
          panToolActive = false;
          if (editor && editor.orbitControls) {
            editor.orbitControls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
          }
          if (transformControls && d.mode) transformControls.setMode(d.mode);
          if (cameraSelected && previewCamera && transformControls) transformControls.attach(previewCamera);
          else if (transformControls && selectedObj) transformControls.attach(selectedObj);
        }
        break;
      case "game-editor-select-by-uuid":
        if (editor && d.uuid) {
          var obj = findByUuid(editor.scene, d.uuid);
          // Fallback: if UUID not found (object was regenerated with new UUID), try by name
          if (!obj && d.name) {
            obj = editor.scene.getObjectByName(d.name);
          }
          // Skip scene root at handler level too (defense in depth)
          if (obj && obj !== editor.scene && obj.type !== "Scene") selectObject(obj, true);
        } break;
      case "game-editor-deselect": deselectObject(); break;
      case "game-editor-update-property":
        if (d.uuid && d.property !== undefined) updateProperty(d.uuid, d.property, d.value); break;
      case "game-editor-delete-object":
        if (editor && d.uuid) {
          var toDelete = findByUuid(editor.scene, d.uuid);
          if (toDelete) {
            var _delName = toDelete.name || "";
            pushUndo({ type: "delete", uuid: d.uuid, object: toDelete });
            if (selectedObj && selectedObj.uuid === d.uuid) deselectObject();
            editor.scene.remove(toDelete); sendSceneTreeThrottled();
            window.parent.postMessage({ type: "game-editor-object-deleted", uuid: d.uuid, name: _delName }, "*");
            window.parent.postMessage({ type: "game-editor-scene-dirty" }, "*");
          }
        } break;
      case "game-editor-request-tree": sendSceneTree(); break;
      case "game-editor-focus": focusSelected(); break;
      case "game-editor-duplicate": duplicateSelected(); break;
      case "game-editor-undo": applyUndo(); break;
      case "game-editor-redo": applyRedo(); break;
      case "game-editor-register-spawn-undo":
        if (d.uuid && editor) {
          // Push spawn undo — on undo, removes the spawned object; on redo, re-adds it
          pushUndo({ type: "duplicate", uuid: d.uuid });
          window.parent.postMessage({ type: "game-editor-undo-redo-state", canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }, "*");
        }
        break;
      case "game-editor-toggle-snap": toggleGridHelper(); break;
      case "game-editor-select-camera":
        // Guard: skip if already selected (prevents flicker from repeated messages)
        if (cameraSelected && previewCamera) break;
        deselectObject();
        cameraSelected = true;
        if (previewCamera) {
          updatePreviewCamera();
          // Add previewCamera to scene (required for TC attachment)
          editor.scene.add(previewCamera);
          createCameraHelper();
          // Reuse existing TC (same as regular object selection) — camera-specific
          // objectChange logic is in the shared handler via cameraSelected flag
          if (THREE.TransformControls) {
            if (!transformControls) {
              // TC not yet created (camera selected before any object) — trigger creation
              // via the same path as selectObject to keep single TC instance
              console.log("[GameEditorBridge] Creating reusable TC (via camera select)");
              transformControls = new THREE.TransformControls(editor.camera, editor.renderer.domElement);
              transformControls.name = "__editor_transform_controls__";
              transformControls.setSize(0.6);
              transformControls.addEventListener("dragging-changed", function(e) {
                if (editor.orbitControls) editor.orbitControls.enabled = !e.value;
                if (!cameraSelected && (!selectedObj || !selectedObj.parent)) return;
                if (!cameraSelected && e.value && selectedObj) {
                  transformControls.__undoPos = { x: selectedObj.position.x, y: selectedObj.position.y, z: selectedObj.position.z };
                  transformControls.__undoRot = { x: selectedObj.rotation.x, y: selectedObj.rotation.y, z: selectedObj.rotation.z };
                  transformControls.__undoScl = { x: selectedObj.scale.x, y: selectedObj.scale.y, z: selectedObj.scale.z };
                } else if (!cameraSelected && !e.value && selectedObj && transformControls.__undoPos) {
                  pushUndo({ type: "transform", uuid: selectedObj.uuid,
                    oldPos: transformControls.__undoPos, oldRot: transformControls.__undoRot, oldScl: transformControls.__undoScl,
                    newPos: { x: selectedObj.position.x, y: selectedObj.position.y, z: selectedObj.position.z },
                    newRot: { x: selectedObj.rotation.x, y: selectedObj.rotation.y, z: selectedObj.rotation.z },
                    newScl: { x: selectedObj.scale.x, y: selectedObj.scale.y, z: selectedObj.scale.z }
                  });
                  persistTransform(selectedObj);
                }
              });
              // Throttle postMessages during drag (same as primary TC)
              var _lastCamMovedTime2 = 0;
              var _camMovedTimer2 = null;
              var _lastObjChangeTime2 = 0;
              var _objChangeTimer2 = null;
              transformControls.addEventListener("objectChange", function() {
                if (cameraSelected && previewCamera) {
                  var player = findPlayerMesh();
                  var px = 0, py = 0, pz = 0;
                  if (player) { px = player.position.x; py = player.position.y; pz = player.position.z; }
                  var newOffsetY = previewCamera.position.y - py;
                  var newOffsetZ = previewCamera.position.z - pz;
                  // Persist to iframe game settings so updatePreviewCamera uses them after deselect
                  var _gs = window.__vibexe_game_settings__;
                  if (!_gs) { _gs = {}; window.__vibexe_game_settings__ = _gs; }
                  if (!_gs.camera) _gs.camera = {};
                  _gs.camera.offsetY = newOffsetY;
                  _gs.camera.offsetZ = newOffsetZ;
                  if (cameraHelper) { try { cameraHelper.update(); } catch(_e) {} }
                  // Throttle postMessage to parent (200ms)
                  var _camNow2 = Date.now();
                  if (_camNow2 - _lastCamMovedTime2 >= 200) {
                    _lastCamMovedTime2 = _camNow2;
                    if (_camMovedTimer2) { clearTimeout(_camMovedTimer2); _camMovedTimer2 = null; }
                    window.parent.postMessage({
                      type: "game-editor-camera-moved",
                      position: { x: +previewCamera.position.x.toFixed(2), y: +previewCamera.position.y.toFixed(2), z: +previewCamera.position.z.toFixed(2) },
                      offsetY: +newOffsetY.toFixed(2),
                      offsetZ: +newOffsetZ.toFixed(2)
                    }, "*");
                  } else if (!_camMovedTimer2) {
                    _camMovedTimer2 = setTimeout(function() {
                      _camMovedTimer2 = null;
                      _lastCamMovedTime2 = Date.now();
                      window.parent.postMessage({
                        type: "game-editor-camera-moved",
                        position: { x: +previewCamera.position.x.toFixed(2), y: +previewCamera.position.y.toFixed(2), z: +previewCamera.position.z.toFixed(2) },
                        offsetY: +newOffsetY.toFixed(2),
                        offsetZ: +newOffsetZ.toFixed(2)
                      }, "*");
                    }, 200 - (_camNow2 - _lastCamMovedTime2));
                  }
                  return;
                }
                if (!selectedObj || !selectedObj.parent) return;
                if (selectedObj) {
                  if (boxHelper && boxHelper.object && boxHelper.object.parent) { try { boxHelper.update(); } catch(e) {} }
                  // Throttle expensive postMessages (150ms) — same as primary TC
                  var _objNow2 = Date.now();
                  if (_objNow2 - _lastObjChangeTime2 >= 150) {
                    _lastObjChangeTime2 = _objNow2;
                    if (_objChangeTimer2) { clearTimeout(_objChangeTimer2); _objChangeTimer2 = null; }
                    sendSelectedObject(selectedObj);
                    sendPlayerPositionUpdate(selectedObj);
                  } else if (!_objChangeTimer2) {
                    var _capturedObj2 = selectedObj;
                    _objChangeTimer2 = setTimeout(function() {
                      _objChangeTimer2 = null;
                      _lastObjChangeTime2 = Date.now();
                      sendSelectedObject(_capturedObj2);
                      sendPlayerPositionUpdate(_capturedObj2);
                    }, 150 - (_objNow2 - _lastObjChangeTime2));
                  }
                }
              });
              var tcHelper = transformControls.getHelper ? transformControls.getHelper() : transformControls;
              tcHelper.name = "__editor_transform_controls__";
              tcHelperObj = tcHelper; // Store reference so editor sweep doesn't remove it
              var _tcUpdating2 = false;
              var _origUMW2 = tcHelper.updateMatrixWorld;
              tcHelper.updateMatrixWorld = function(force) {
                if (_tcUpdating2) return;
                _tcUpdating2 = true;
                try { _origUMW2.call(this, force); } finally { _tcUpdating2 = false; }
              };
              editor.scene.add(tcHelper);
            }
            // Set translate mode for camera dragging
            if (transformControls.setMode) transformControls.setMode("translate");
            if (gridSnap) transformControls.translationSnap = gridSnapIncrement;
            transformControls.attach(previewCamera);
          }
        }
        // Post synthetic selection back to parent
        window.parent.postMessage({
          type: "game-editor-object-selected",
          uuid: "__game_camera__",
          name: "Main Camera",
          objType: "PerspectiveCamera",
          position: previewCamera ? { x: +previewCamera.position.x.toFixed(2), y: +previewCamera.position.y.toFixed(2), z: +previewCamera.position.z.toFixed(2) } : { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          visible: true,
          castShadow: false,
          userData: { _isSyntheticCameraNode: true },
          _materialColor: null
        }, "*");
        break;
      case "game-editor-update-camera-property":
        if (previewCamera && d.property) {
          var _cpVal = d.value;
          switch (d.property) {
            case "fov":
              previewCamera.fov = _cpVal;
              previewCamera.updateProjectionMatrix();
              break;
            case "near":
              previewCamera.near = _cpVal;
              previewCamera.updateProjectionMatrix();
              break;
            case "far":
              previewCamera.far = _cpVal;
              previewCamera.updateProjectionMatrix();
              break;
            case "offsetY":
            case "offsetZ":
            case "lookY":
              // Reposition camera based on new offset/lookY
              var _gs2 = window.__vibexe_game_settings__ || {};
              var _cam2 = _gs2.camera || {};
              var _oY = d.property === "offsetY" ? _cpVal : (_cam2.offsetY || 8);
              var _oZ = d.property === "offsetZ" ? _cpVal : (_cam2.offsetZ || 12);
              var _lY = d.property === "lookY" ? _cpVal : (_cam2.lookY || 1);
              var _pl = findPlayerMesh();
              var _ppx = 0, _ppy = 0, _ppz = 0;
              if (_pl) { _ppx = _pl.position.x; _ppy = _pl.position.y; _ppz = _pl.position.z; }
              previewCamera.position.set(_ppx, _ppy + _oY, _ppz + _oZ);
              previewCamera.lookAt(_ppx, _ppy + _lY, _ppz);
              previewCamera.updateMatrixWorld(true);
              break;
          }
          if (cameraHelper) { try { cameraHelper.update(); } catch(_e) {} }
        }
        break;
      case "game-editor-set-pivot-mode":
        pivotMode = d.mode || "center";
        break;
      case "game-editor-toggle-projection":
        if (!editor) break;
        (function() {
          var THREE = window.THREE;
          var oldCam = editor.camera;
          var newMode = d.projection || (editorProjectionMode === "perspective" ? "orthographic" : "perspective");
          deselectObject();
          if (newMode === "orthographic") {
            // Create orthographic camera
            var dist = oldCam.position.distanceTo(editor.orbitControls ? editor.orbitControls.target : new THREE.Vector3());
            var frustumSize = dist * 0.9;
            var aspect = oldCam.aspect || (editor.renderer.domElement.width / editor.renderer.domElement.height);
            var ortho = new THREE.OrthographicCamera(
              -frustumSize * aspect, frustumSize * aspect,
              frustumSize, -frustumSize,
              0.1, 10000
            );
            ortho.position.copy(oldCam.position);
            ortho.quaternion.copy(oldCam.quaternion);
            ortho.zoom = 1;
            ortho.updateProjectionMatrix();
            editor.camera = ortho;
            if (editor.orbitControls) editor.orbitControls.object = ortho;
          } else {
            // Restore perspective camera
            var gameCam = window.__vibexe_camera__;
            if (gameCam) {
              gameCam.position.copy(oldCam.position);
              gameCam.quaternion.copy(oldCam.quaternion);
              gameCam.updateProjectionMatrix();
              editor.camera = gameCam;
              if (editor.orbitControls) editor.orbitControls.object = gameCam;
            }
          }
          if (editor.orbitControls) editor.orbitControls.update();
          // Update EffectComposer pass cameras if present
          var composer = window.__vibexe_composer__;
          if (composer && composer.passes) {
            for (var pi = 0; pi < composer.passes.length; pi++) {
              if (composer.passes[pi].camera) composer.passes[pi].camera = editor.camera;
            }
          }
          editorProjectionMode = newMode;
          window.parent.postMessage({ type: "game-editor-projection-changed", projection: newMode }, "*");
        })();
        break;
      case "game-editor-toggle-space":
        gizmoSpace = gizmoSpace === "world" ? "local" : "world";
        if (transformControls && transformControls.setSpace) transformControls.setSpace(gizmoSpace);
        window.parent.postMessage({ type: "game-editor-gizmo-space", space: gizmoSpace }, "*");
        break;
      case "game-editor-snap-camera":
        if (!editor || !editor.camera || !editor.orbitControls) break;
        // Cancel any previous snap animation
        if (window.__snapAnimId) { cancelAnimationFrame(window.__snapAnimId); window.__snapAnimId = null; }
        (function() {
          var _cam = editor.camera;
          var _orbit = editor.orbitControls;
          var _target = _orbit.target.clone();
          var _dist = _cam.position.distanceTo(_target);
          var _snapPos = _target.clone();
          switch (d.direction) {
            case "front": _snapPos.z += _dist; break;
            case "back": _snapPos.z -= _dist; break;
            case "right": _snapPos.x += _dist; break;
            case "left": _snapPos.x -= _dist; break;
            case "top": _snapPos.y += _dist; _snapPos.z += 0.01; break;
            case "bottom": _snapPos.y -= _dist; _snapPos.z += 0.01; break;
          }
          var _snapStart = _cam.position.clone();
          var _snapT = 0;
          function _doSnap() {
            if (!active || !editor) { window.__snapAnimId = null; return; }
            _snapT += 0.08;
            if (_snapT >= 1) _snapT = 1;
            var _ease = _snapT * (2 - _snapT);
            _cam.position.lerpVectors(_snapStart, _snapPos, _ease);
            _orbit.update();
            if (_snapT < 1) {
              window.__snapAnimId = requestAnimationFrame(_doSnap);
            } else {
              window.__snapAnimId = null;
            }
          }
          _doSnap();
        })();
        break;
      case "game-editor-rename-object":
        if (editor && d.uuid && d.name !== undefined) {
          var rnObj = findByUuid(editor.scene, d.uuid);
          if (rnObj) { updateProperty(d.uuid, "name", d.name); }
        } break;
      case "game-editor-toggle-visibility":
        if (editor && d.uuid) {
          var visObj = findByUuid(editor.scene, d.uuid);
          if (visObj) { updateProperty(d.uuid, "visible", !visObj.visible); }
        } break;
      case "game-editor-toggle-lock":
        if (editor && d.uuid) {
          var lockObj = findByUuid(editor.scene, d.uuid);
          if (lockObj) {
            var isLocked = !lockObj.userData.__editorLocked;
            lockObj.userData.__editorLocked = isLocked;
            // If locking the currently selected object, detach transform controls
            if (isLocked && selectedObj && selectedObj.uuid === d.uuid && transformControls) {
              transformControls.detach();
            }
            sendSceneTreeThrottled();
          }
        } break;
      case "game-editor-multi-highlight":
        if (editor && d.uuids) setMultiHighlight(d.uuids);
        break;
      case "game-editor-clear-multi-highlight":
        clearMultiHighlight();
        break;
      case "game-editor-group-objects":
        if (editor && d.uuids) groupObjects(d.uuids);
        break;
      case "game-editor-ungroup-object":
        if (editor && d.uuid) ungroupObject(d.uuid);
        break;
      case "game-editor-set-snap-settings":
        if (typeof d.gridIncrement === "number") gridSnapIncrement = d.gridIncrement;
        if (typeof d.rotationDeg === "number") rotationSnapDeg = d.rotationDeg;
        // Sync TC snap properties if snap is active
        if (gridSnap && transformControls) {
          transformControls.translationSnap = gridSnapIncrement;
          transformControls.rotationSnap = rotationSnapDeg * Math.PI / 180;
          transformControls.scaleSnap = gridSnapIncrement;
        }
        break;
      case "game-editor-set-spawn-mode":
        window.__vibexe_spawn_mode__ = !!d.active;
        window.__vibexe_spawn_factory__ = d.factory || null;
        window.__vibexe_spawn_args__ = d.args || null;
        break;
      case "game-editor-show-spawn-marker":
        if (editor && editor.scene) {
          var _spawnMarker = editor.scene.getObjectByName("__editor_spawn_marker__");
          if (!_spawnMarker) {
            var _spGeo = new THREE.SphereGeometry(0.3, 16, 16);
            var _spMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.7 });
            _spawnMarker = new THREE.Mesh(_spGeo, _spMat);
            _spawnMarker.name = "__editor_spawn_marker__";
            _spawnMarker.raycast = function() {};
            editor.scene.add(_spawnMarker);
          }
          _spawnMarker.position.set(d.x || 0, d.y || 3, d.z || 0);
          _spawnMarker.visible = !!d.visible;
        }
        break;
      case "game-editor-move-player":
        // Live-sync: teleport player character to new spawn position
        if (editor && editor.scene) {
          editor.scene.traverse(function(obj) {
            var ud = obj.userData || {};
            var isPlayer = ud.__isPlayerCharacter
              || ud.vibexeType === "player"
              || ud.vibexeType === "AnimatedCharacter"
              || (obj.name && (obj.name.indexOf("Character_") === 0 || obj.name.indexOf("Player_") === 0));
            if (isPlayer) {
              if (d.x !== undefined) obj.position.x = Number(d.x);
              if (d.y !== undefined) obj.position.y = Number(d.y);
              if (d.z !== undefined) obj.position.z = Number(d.z);
              var body = obj.userData.__physicsBody;
              if (body) {
                if (d.x !== undefined) body.position.x = Number(d.x);
                if (d.y !== undefined) body.position.y = Number(d.y);
                if (d.z !== undefined) body.position.z = Number(d.z);
                body.velocity.set(0, 0, 0);
                if (body.angularVelocity) body.angularVelocity.set(0, 0, 0);
              }
              if (selectedObj && selectedObj.uuid === obj.uuid) {
                if (boxHelper && boxHelper.object && boxHelper.object.parent) { try { boxHelper.update(); } catch(e) {} }
                // Don't sendSelectedObject here — parent already knows the position
                // (it sent this message). Calling it would create a feedback loop.
              }
            }
          });
        }
        break;
      // Get camera position (for "reset spawn/respawn to camera" feature)
      case "game-editor-get-camera-position":
        if (editor && editor.camera) {
          var _cam2 = editor.camera;
          var _cx2 = _cam2.position.x;
          var _cy2 = _cam2.position.y;
          var _cz2 = _cam2.position.z;
          // Try terrain height at camera XZ for ground-aware Y
          var _terrainH = window.__vibexe_getVisualTerrainHeight
            ? window.__vibexe_getVisualTerrainHeight(_cx2, _cz2) : null;
          var _spawnY = (_terrainH != null && _terrainH > -100) ? _terrainH + 1 : _cy2;
          window.parent.postMessage({
            type: "game-editor-camera-position",
            position: { x: Math.round(_cx2 * 10) / 10, y: Math.round(_spawnY * 10) / 10, z: Math.round(_cz2 * 10) / 10 },
            _purpose: d._purpose || "spawn"
          }, "*");
        }
        break;
      // Select + Focus (hierarchy double-click)
      case "game-editor-select-and-focus":
        if (editor && d.uuid) {
          var focusObj = findByUuid(editor.scene, d.uuid);
          if (focusObj && focusObj !== editor.scene && focusObj.type !== "Scene") {
            selectObject(focusObj);
            // Small delay to let selection propagate before focus animation
            setTimeout(function() { focusSelected(); }, 50);
          }
        } break;
      // Animation handlers (redundant with embedded bridge for reliability)
      case "game-editor-get-animations":
        if (d.uuid) handleGetAnimations(d.uuid); break;
      case "game-editor-play-animation":
        if (d.uuid && d.clipName) handlePlayAnimation(d.uuid, d.clipName); break;
      case "game-editor-pause-animation":
        if (editor && d.uuid) {
          var pauseObj = findByUuid(editor.scene, d.uuid);
          if (pauseObj && pauseObj.userData && pauseObj.userData.__pause) pauseObj.userData.__pause();
        } break;
      case "game-editor-resume-animation":
        if (editor && d.uuid) {
          var resumeObj = findByUuid(editor.scene, d.uuid);
          if (resumeObj && resumeObj.userData && resumeObj.userData.__resume) resumeObj.userData.__resume();
        } break;
      case "game-editor-stop-animation":
        if (editor && d.uuid) {
          var stopObj = findByUuid(editor.scene, d.uuid);
          if (stopObj && stopObj.userData && stopObj.userData.__stop) stopObj.userData.__stop();
          if (__animProgressInterval) { clearInterval(__animProgressInterval); __animProgressInterval = null; }
          try { window.parent.postMessage({ type: "game-editor-animation-progress", uuid: d.uuid, time: 0, duration: 0, clipName: null, paused: false }, "*"); } catch(e) {}
        } break;
      case "game-editor-seek-animation":
        if (editor && d.uuid && typeof d.time === "number") {
          var seekObj = findByUuid(editor.scene, d.uuid);
          if (seekObj && seekObj.userData && seekObj.userData.__setTime) seekObj.userData.__setTime(d.time);
        } break;
      case "game-editor-viewport-click":
        // Click forwarded from parent page — handles cross-origin iframe event routing
        // REMOVED auto-activation: bridge should only activate via explicit game-editor-enable
        if (!active) { return; }
        // Wait a tick for activation, then process click
        setTimeout(function() {
          if (!active || !editor) return;
          if (panToolActive) return; // Pan mode: don't select objects
          // If spawn mode is active, spawn object at click position instead of selecting
          if (window.__vibexe_spawn_mode__ && window.__vibexe_spawn_factory__) {
            var THREE2 = window.THREE;
            var rect2 = editor.renderer.domElement.getBoundingClientRect();
            var mx2 = ((d.clientX - rect2.left) / rect2.width) * 2 - 1;
            var my2 = -((d.clientY - rect2.top) / rect2.height) * 2 + 1;
            raycaster.setFromCamera(new THREE2.Vector2(mx2, my2), editor.camera);
            var hits2 = raycaster.intersectObjects(editor.scene.children, true);
            var spawnPos = { x: 0, y: 2, z: 0 };
            for (var hi = 0; hi < hits2.length; hi++) {
              var ho = hits2[hi].object;
              if (ho.name && ho.name.indexOf("__editor_") === 0) continue;
              if (ho.isTransformControls) continue;
              spawnPos = { x: +hits2[hi].point.x.toFixed(2), y: +(hits2[hi].point.y + 0.5).toFixed(2), z: +hits2[hi].point.z.toFixed(2) };
              break;
            }
            window.parent.postMessage({ type: "game-editor-do-spawn", factory: window.__vibexe_spawn_factory__, args: window.__vibexe_spawn_args__ || {}, position: spawnPos }, "*");
            return;
          }
          var cx = d.clientX, cy = d.clientY;
          if (transformControls && transformControls.dragging) return;
          var target = raycastMeshes(cx, cy);
          if (target && target !== editor.scene) {
            if (selectedObj && target.uuid === selectedObj.uuid) {
              if (d.isDoubleClick) startXZDrag(selectedObj, cx, cy);
              return; // Already selected — keep gizmo
            }
            if (d.isDoubleClick) {
              selectObject(target);
              startXZDrag(target, cx, cy);
            } else {
              selectObject(target);
            }
          } else {
            deselectObject();
            // Send ground intersection point to parent for pick-spawn/pick-respawn
            try {
              var _gp2 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
              var _terrain2 = editor.scene.getObjectByName("__terrain__");
              var _gPt2 = null;
              if (_terrain2) {
                var _tH2 = raycaster.intersectObject(_terrain2, false);
                if (_tH2.length > 0) _gPt2 = _tH2[0].point;
              }
              if (!_gPt2) {
                _gPt2 = new THREE.Vector3();
                if (!raycaster.ray.intersectPlane(_gp2, _gPt2)) _gPt2 = null;
              }
              if (_gPt2) {
                window.parent.postMessage({
                  type: "game-editor-ground-click",
                  position: { x: +_gPt2.x.toFixed(3), y: +_gPt2.y.toFixed(3), z: +_gPt2.z.toFixed(3) }
                }, "*");
              }
            } catch(e2) {}
          }
        }, active ? 0 : 500);
        break;
      case "game-editor-viewport-mousemove":
        if (active && isDragging) { doXZDrag(d.clientX, d.clientY); }
        break;
      case "game-editor-viewport-mouseup":
        if (active && isDragging) { endXZDrag(); }
        break;
      case "game-editor-viewport-keydown":
        if (!active) break;
        // Simulate keydown event for the bridge's onKeyDown handler
        var _fkKey = d.key || "";
        var _fkCode = "Key" + _fkKey.toUpperCase();
        if (_fkKey === "Escape") _fkCode = "Escape";
        else if (_fkKey === "Delete") _fkCode = "Delete";
        else if (_fkKey === "Backspace") _fkCode = "Backspace";
        var fakeEvent = { key: d.key, code: _fkCode, ctrlKey: !!d.ctrlKey, metaKey: !!d.metaKey, shiftKey: !!d.shiftKey, target: { tagName: "BODY" }, preventDefault: function() {} };
        onKeyDown(fakeEvent);
        break;
      case "game-editor-apply-texture": {
        if (!editor || !editor.scene || !d.uuid || !d.textureUrl) break;
        var _atObj = findByUuid(editor.scene, d.uuid);
        if (!_atObj) break;
        var _THREE = window.THREE;
        if (!_THREE) break;
        var _atUrl = d.textureUrl;
        var _atTileX = d.tileX || 1;
        var _atTileY = d.tileY || 1;
        var _atPBR = !!d.hasPBR;
        var _atResolved = _atUrl;
        if (_atUrl.charAt(0) === '/') {
          _atResolved = (window.__VIBEXE_API_ORIGIN__ || '') + _atUrl;
        }
        // Store in userData immediately so collect picks it up
        if (!_atObj.userData) _atObj.userData = {};
        if (!_atObj.userData.vibexeArgs) _atObj.userData.vibexeArgs = {};
        _atObj.userData.vibexeArgs.textureUrl = _atUrl;
        _atObj.userData.vibexeArgs.textureTileX = _atTileX;
        _atObj.userData.vibexeArgs.textureTileY = _atTileY;
        _atObj.userData.vibexeArgs.textureRotation = 0;
        _atObj.userData.vibexeArgs.textureOffsetX = 0;
        _atObj.userData.vibexeArgs.textureOffsetY = 0;
        if (_atPBR) _atObj.userData.vibexeArgs.hasPBR = true;
        else delete _atObj.userData.vibexeArgs.hasPBR;
        // Load and apply texture
        var _atLoader = new _THREE.TextureLoader();
        var _atCfg = function(tex, isSRGB) {
          tex.wrapS = _THREE.RepeatWrapping;
          tex.wrapT = _THREE.RepeatWrapping;
          tex.repeat.set(_atTileX, _atTileY);
          tex.anisotropy = (editor && editor.renderer && editor.renderer.capabilities) ? editor.renderer.capabilities.getMaxAnisotropy() : 8;
          tex.generateMipmaps = true;
          tex.minFilter = _THREE.LinearMipmapLinearFilter;
          tex.colorSpace = isSRGB ? (_THREE.SRGBColorSpace || 'srgb') : (_THREE.LinearSRGBColorSpace || 'srgb-linear');
          return tex;
        };
        var _atLoadTex = function(url, cb) {
          if (!url) { cb(null); return; }
          _atLoader.load(url, cb, undefined, function() { cb(null); });
        };
        if (_atPBR) {
          _ensurePBREnv();
          var _bne = _atResolved.replace(/\.[^.]+$/, '');
          var _ext = (_atResolved.match(/\.[^.]+$/) || ['.jpg'])[0];
          // Category-based metalness + normalScale from filename
          var _fname = _atResolved.split('/').pop() || '';
          var _isMetal = /^Metal|^CorrugatedSteel|^DiamondPlate|^PaintedMetal/i.test(_fname);
          var _nScale = 1.0;
          if (_isMetal) _nScale = 0.8;
          else if (/^Brick/i.test(_fname)) _nScale = 1.5;
          else if (/^Rock|^Paving/i.test(_fname)) _nScale = 1.2;
          else if (/^Wood|^WoodFloor|^Planks/i.test(_fname)) _nScale = 0.6;
          else if (/^Concrete|^Plaster/i.test(_fname)) _nScale = 0.8;
          else if (/^Fabric|^Leather|^Carpet/i.test(_fname)) _nScale = 0.5;
          else if (/^Marble|^Granite|^Onyx|^Travertine/i.test(_fname)) _nScale = 0.7;
          // Promise.all for PBR maps (skip metalness for non-metals to avoid mirror effect)
          var _pbrLoaded = 0, _pbrTotal = 5, _pbrResults = [null,null,null,null,null];
          // Skip AO map — no _AO files exist in the texture library (avoids 404 console noise)
          var _pbrUrls = [_atResolved, _bne+'_Normal'+_ext, _bne+'_Roughness'+_ext, _isMetal ? _bne+'_Metalness'+_ext : '', ''];
          var _pbrApply = function() {
            var colorTex = _pbrResults[0], normalTex = _pbrResults[1], roughnessTex = _pbrResults[2], metalnessTex = _pbrResults[3], aoTex = _pbrResults[4];
            if (!colorTex) return;
            // Category-based metalness: only Metal* textures are truly metallic
            var _metalVal = _isMetal ? 0.95 : 0.0;
            var _envIntensity = _isMetal ? 1.0 : 0.3;
            _atObj.traverse(function(m) {
              if (!m.isMesh || !m.material) return;
              var _matOpts = {
                map: _atCfg(colorTex.clone(), true),
                roughness: roughnessTex ? 1.0 : 0.7,
                metalness: _isMetal ? 0.95 : 0.0,
                envMapIntensity: _isMetal ? 1.0 : 0.3,
                side: _THREE.DoubleSide
              };
              if (editor && editor.scene && editor.scene.environment) _matOpts.envMap = editor.scene.environment;
              if (normalTex) {
                _matOpts.normalMap = _atCfg(normalTex.clone(), false);
                _matOpts.normalScale = new _THREE.Vector2(_nScale, _nScale);
              }
              if (roughnessTex) _matOpts.roughnessMap = _atCfg(roughnessTex.clone(), false);
              if (metalnessTex) _matOpts.metalnessMap = _atCfg(metalnessTex.clone(), false);
              if (aoTex) { _matOpts.aoMap = _atCfg(aoTex.clone(), false); _matOpts.aoMapIntensity = 1.0; }
              m.material = new _THREE.MeshStandardMaterial(_matOpts);
              m.material.needsUpdate = true;
              // Three.js requires uv2 for AO maps
              if (aoTex && m.geometry && m.geometry.attributes.uv && !m.geometry.attributes.uv2) {
                m.geometry.setAttribute('uv2', m.geometry.attributes.uv);
              }
            });
            console.log("[GameEditorBridge] PBR texture applied:", _atUrl, "isMetal:", _isMetal, "metalness:", _metalVal, "envMapIntensity:", _envIntensity, "normalScale:", _nScale);
            sendSelectedObject(_atObj);
          };
          for (var _pi = 0; _pi < _pbrTotal; _pi++) {
            (function(idx) {
              _atLoadTex(_pbrUrls[idx], function(tex) {
                _pbrResults[idx] = tex;
                _pbrLoaded++;
                if (_pbrLoaded === _pbrTotal) _pbrApply();
              });
            })(_pi);
          }
        } else {
          _atLoadTex(_atResolved, function(colorTex) {
            if (!colorTex) { console.warn("[GameEditorBridge] Texture load failed:", _atUrl); return; }
            _atCfg(colorTex, true);
            _atObj.traverse(function(m) {
              if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
              m.material.map = colorTex;
              m.material.needsUpdate = true;
            });
            console.log("[GameEditorBridge] Texture applied:", _atUrl);
            sendSelectedObject(_atObj);
          });
        }
        sendSelectedObject(_atObj);
        break;
      }
      case "game-editor-remove-texture": {
        if (!editor || !editor.scene || !d.uuid) break;
        var _rtObj = findByUuid(editor.scene, d.uuid);
        if (!_rtObj) break;
        var _RT = window.THREE;
        if (!_RT) break;
        if (_rtObj.userData && _rtObj.userData.vibexeArgs) {
          delete _rtObj.userData.vibexeArgs.textureUrl;
          delete _rtObj.userData.vibexeArgs.textureTileX;
          delete _rtObj.userData.vibexeArgs.textureTileY;
          delete _rtObj.userData.vibexeArgs.textureRotation;
          delete _rtObj.userData.vibexeArgs.textureOffsetX;
          delete _rtObj.userData.vibexeArgs.textureOffsetY;
          delete _rtObj.userData.vibexeArgs.hasPBR;
        }
        _rtObj.traverse(function(m) {
          if (!m.isMesh) return;
          var mat = Array.isArray(m.material) ? m.material[0] : m.material;
          var c = mat && mat.color ? mat.color.getHex() : 0xffffff;
          m.material = new _RT.MeshPhongMaterial({ color: c });
          m.material.needsUpdate = true;
        });
        console.log("[GameEditorBridge] Texture removed from:", _rtObj.name);
        sendSelectedObject(_rtObj);
        break;
      }
      case "game-editor-update-texture-params": {
        if (!editor || !editor.scene || !d.uuid) break;
        var _utObj = findByUuid(editor.scene, d.uuid);
        if (!_utObj) break;
        var _utX = d.tileX || 1;
        var _utY = d.tileY || 1;
        var _utRot = (d.rotation || 0) * Math.PI / 180;
        var _utOX = d.offsetX || 0;
        var _utOY = d.offsetY || 0;
        if (_utObj.userData && _utObj.userData.vibexeArgs) {
          _utObj.userData.vibexeArgs.textureTileX = _utX;
          _utObj.userData.vibexeArgs.textureTileY = _utY;
          _utObj.userData.vibexeArgs.textureRotation = d.rotation || 0;
          _utObj.userData.vibexeArgs.textureOffsetX = d.offsetX || 0;
          _utObj.userData.vibexeArgs.textureOffsetY = d.offsetY || 0;
        }
        _utObj.traverse(function(m) {
          if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
          var maps = [m.material.map, m.material.normalMap, m.material.roughnessMap, m.material.metalnessMap];
          for (var mi = 0; mi < maps.length; mi++) {
            if (maps[mi]) {
              maps[mi].repeat.set(_utX, _utY);
              maps[mi].rotation = _utRot;
              maps[mi].offset.set(_utOX, _utOY);
              maps[mi].center.set(0.5, 0.5);
            }
          }
          m.material.needsUpdate = true;
        });
        sendSelectedObject(_utObj);
        break;
      }
      case "game-editor-collect-all-transforms":
        // Collect transforms of ONLY factory-created game objects for batch save
        // CRITICAL: Must NOT collect bones, GLTF internals, gizmo parts, or generic "Scene" objects
        if (!editor || !editor.scene) break;
        var allTransforms = {};
        var _nameCounts = {};
        var _factoryPrefixes = ["Platform_", "Collectible_", "Barrier_", "Decoration_", "Player_", "Character_", "UnnamedGroup_", "Object_"];
        editor.scene.traverse(function(child) {
          // Auto-name unnamed objects (supports pre-fix games without vibexeFactory metadata)
          if (!child.name) {
            if (child.userData && child.userData.vibexeFactory) {
              child.name = (child.userData.vibexeFactory === "animatedCharacter" ? "Character_" : "Object_") + child.uuid.slice(0, 8);
            } else if (child.type === "Group" && child.children && child.children.length > 0 && child.parent === editor.scene) {
              // Count unnamed Groups before this one (stable even if children order varies)
              var _ugCount2 = 0;
              for (var _i2 = 0; _i2 < editor.scene.children.length; _i2++) {
                var _ch2 = editor.scene.children[_i2];
                if (_ch2 === child) break;
                if (!_ch2.name && _ch2.type === "Group" && _ch2.children && _ch2.children.length > 0) _ugCount2++;
              }
              child.name = "UnnamedGroup_" + _ugCount2;
            }
          }
          if (!child.name) return;
          if (child.name.indexOf("__editor_") === 0) return;
          if (child.type === "GridHelper") return;
          if (isGroundPlane(child)) return;
          // Skip infrastructure: lights, cameras, helpers
          if (child.isLight || child.isCamera || child.type === "BoxHelper") return;
          // WHITELIST: Only collect objects with factory-created name prefixes
          var isFactory = false;
          for (var pi = 0; pi < _factoryPrefixes.length; pi++) {
            if (child.name.indexOf(_factoryPrefixes[pi]) === 0) { isFactory = true; break; }
          }
          if (!isFactory) return;
          // Stable index-based dedup: Name, Name#1, Name#2 (not UUID — must match on reload)
          if (!_nameCounts[child.name]) _nameCounts[child.name] = 0;
          var _idx = _nameCounts[child.name]++;
          var saveName = _idx === 0 ? child.name : child.name + "#" + _idx;
          var _tfData = {
            position: { x: +child.position.x.toFixed(3), y: +child.position.y.toFixed(3), z: +child.position.z.toFixed(3) },
            rotation: { x: +(child.rotation.x * 180 / Math.PI).toFixed(1), y: +(child.rotation.y * 180 / Math.PI).toFixed(1), z: +(child.rotation.z * 180 / Math.PI).toFixed(1) },
            scale: { x: +child.scale.x.toFixed(3), y: +child.scale.y.toFixed(3), z: +child.scale.z.toFixed(3) }
          };
          if (child.visible === false) _tfData._visible = false;
          var _txUrl = child.userData && child.userData.vibexeArgs && child.userData.vibexeArgs.textureUrl;
          if (_txUrl) {
            _tfData._textureUrl = _txUrl;
            _tfData._textureTileX = child.userData.vibexeArgs.textureTileX || 1;
            _tfData._textureTileY = child.userData.vibexeArgs.textureTileY || 1;
            _tfData._hasPBR = !!child.userData.vibexeArgs.hasPBR;
          }
          allTransforms[saveName] = _tfData;
        });
        console.log("[GameEditorBridge] Collected transforms:", Object.keys(allTransforms).length, "objects");
        window.parent.postMessage({ type: "game-editor-all-transforms", transforms: allTransforms }, "*");
        break;
      case "game-editor-apply-fx":
      case "applySettings":
      case "updateGameSettings": {
        // Merge settings into global so _autoTerrain and other consumers see the latest
        var _gsSettings = d.settings || {};
        if (_gsSettings && typeof _gsSettings === "object") {
          if (!window.__VIBEXE_GAME_SETTINGS__) window.__VIBEXE_GAME_SETTINGS__ = {};
          var _gsKeys = Object.keys(_gsSettings);
          for (var _gsi = 0; _gsi < _gsKeys.length; _gsi++) {
            window.__VIBEXE_GAME_SETTINGS__[_gsKeys[_gsi]] = _gsSettings[_gsKeys[_gsi]];
          }
        }

        // === Apply audio settings (Bug #15) ===
        var _audioS = _gsSettings.audio || d.audio;
        if (_audioS) {
          // Set global audio volume via AudioListener if available
          var _audioListener = window.__vibexe_audioListener__;
          if (_audioListener && _audioListener.gain) {
            var _masterVol = _audioS.masterVolume != null ? _audioS.masterVolume : 0.8;
            _audioListener.gain.gain.value = _audioS.enabled === false ? 0 : _masterVol;
          }
          // Store audio settings globally for any audio code to reference
          window.__vibexe_audio_settings__ = _audioS;
          console.log("[GameEditorBridge] Audio settings applied:", _audioS.enabled, "vol:", _audioS.masterVolume);
        }

        // === Apply performance settings (Bug #16) ===
        var _perfS = _gsSettings.performance || d.performance;
        if (_perfS) {
          var _perfRenderer = window.__vibexe_renderer__ || (editor && editor.renderer);
          if (_perfRenderer) {
            // Pixel ratio — use devicePixelRatio for sharp HiDPI rendering (cap at 2.0)
            if (_perfS.pixelRatio != null) {
              var _dpr = (typeof devicePixelRatio !== "undefined") ? devicePixelRatio : 1;
              // If saved value is 1 but device has higher DPR, use DPR (legacy migration)
              var _targetPR = (_perfS.pixelRatio <= 1 && _dpr > 1) ? _dpr : _perfS.pixelRatio;
              _perfRenderer.setPixelRatio(Math.max(0.5, Math.min(2.0, _targetPR)));
            }
            // Shadow quality based on preset
            if (_perfS.qualityPreset === "low") {
              _perfRenderer.shadowMap.enabled = false;
            } else {
              _perfRenderer.shadowMap.enabled = true;
            }
          }
          // FPS cap — store globally for game loop to reference
          if (_perfS.maxFPS != null) {
            window.__vibexe_maxFPS__ = _perfS.maxFPS;
          }
          // Store globally
          window.__vibexe_performance_settings__ = _perfS;
          console.log("[GameEditorBridge] Performance settings applied:", _perfS.qualityPreset, "px:", _perfS.pixelRatio);
        }

        // === Sync scene.fog when environment settings change ===
        // MeshStandardMaterial uses scene.fog automatically (no custom uniforms needed)
        var _envS = _gsSettings.environment;
        if (_envS) {
          var _fogScene = window.__vibexe_scene__ || (editor && editor.scene);
          if (_fogScene) {
            var _T = window.THREE || THREE;
            if (_envS.fogEnabled === false) {
              _fogScene.fog = null;
            } else if (_envS.fogEnabled) {
              var _fogColor = _envS.fogColor ? new _T.Color(_envS.fogColor) : new _T.Color(0x9EADCC);
              var _fogFar = _envS.fogFar || 300;
              if (_envS.fogDensity) _fogFar = 3.0 / _envS.fogDensity;
              _fogScene.fog = new _T.Fog(_fogColor.getHex(), 1, _fogFar);
            }
          }
        }

        // Extract FX preset — from dedicated message or from updateGameSettings payload
        var _fxPreset = d.preset || (_gsSettings.postProcessing && _gsSettings.postProcessing.preset) || null;
        // Only process FX if we have a preset value
        if (_fxPreset === null || _fxPreset === undefined) break;
        // Build a cache key to avoid re-creating composer on every settings update
        var _fxBloomI = d.bloomIntensity != null ? d.bloomIntensity : (_gsSettings.postProcessing ? _gsSettings.postProcessing.bloomIntensity : 0);
        var _fxBloomT = d.bloomThreshold != null ? d.bloomThreshold : (_gsSettings.postProcessing ? _gsSettings.postProcessing.bloomThreshold : 0);
        var _fxKey = _fxPreset + "|" + String(_fxBloomI) + "|" + String(_fxBloomT);
        if (window.__lastFxKey === _fxKey) break;
        window.__lastFxKey = _fxKey;
        var _fxCreatePP = window.createPostProcessing;
        var _fxRenderer = window.__vibexe_renderer__ || (editor && editor.renderer);
        var _fxScene = window.__vibexe_scene__ || (editor && editor.scene);
        var _fxCamera = window.__vibexe_camera__ || (editor && editor.camera);
        console.log("[GameEditorBridge] Apply FX:", _fxPreset, "key:", _fxKey);
        // Destroy existing composer
        var _fxOld = window.__vibexe_composer__;
        if (_fxOld) { window.__vibexe_composer__ = null; try { _fxOld.dispose(); } catch(e) {} }
        if (_fxPreset && _fxPreset !== "none" && _fxCreatePP && _fxRenderer && _fxScene && _fxCamera) {
          var _fxPP = _fxCreatePP(_fxRenderer, _fxScene, _fxCamera, _fxPreset);
          console.log("[GameEditorBridge] FX composer created:", !!_fxPP);
        }
        break;
      }

      // ===== SPAWNED OBJECTS & TEXTURE OVERRIDES (Bug #5, #6) =====

      case "game-editor-get-spawned-objects": {
        var _gsScene = (editor && editor.scene) ? editor.scene : window.__vibexe_scene__;
        if (!_gsScene) break;
        var _spawnedList = [];
        var _texOverrides = [];
        _gsScene.traverse(function(child) {
          if (!child.name) return;
          // Collect spawned objects
          if (child.userData && child.userData.__spawned) {
            var _spData = {
              name: child.name,
              type: child.userData.vibexeType || "decoration",
              modelUrl: child.userData.__modelUrl || child.userData.vibexeArgs && child.userData.vibexeArgs.modelUrl || "",
              position: { x: child.position.x, y: child.position.y, z: child.position.z },
              rotation: { x: child.rotation.x * 180 / Math.PI, y: child.rotation.y * 180 / Math.PI, z: child.rotation.z * 180 / Math.PI },
              scale: { x: child.scale.x, y: child.scale.y, z: child.scale.z },
            };
            // Include texture info if applied
            if (child.userData.vibexeArgs && child.userData.vibexeArgs.textureUrl) {
              _spData.textureUrl = child.userData.vibexeArgs.textureUrl;
              _spData.textureTileX = child.userData.vibexeArgs.textureTileX || 1;
              _spData.textureTileY = child.userData.vibexeArgs.textureTileY || 1;
              _spData.hasPBR = !!child.userData.vibexeArgs.hasPBR;
            }
            _spawnedList.push(_spData);
          }
          // Collect texture overrides for scene-original (non-spawned) objects
          if (child.__hasTextureOverride && child.userData && child.userData.vibexeArgs && child.userData.vibexeArgs.textureUrl) {
            _texOverrides.push({
              name: child.name,
              textureUrl: child.userData.vibexeArgs.textureUrl,
              tileX: child.userData.vibexeArgs.textureTileX || 1,
              tileY: child.userData.vibexeArgs.textureTileY || 1,
              hasPBR: !!child.userData.vibexeArgs.hasPBR,
            });
          }
        });
        console.log("[GameEditorBridge] Collected", _spawnedList.length, "spawned objects,", _texOverrides.length, "texture overrides");
        window.parent.postMessage({ type: "game-editor-spawned-objects", objects: _spawnedList, textureOverrides: _texOverrides }, "*");
        break;
      }

      case "game-editor-restore-spawned-objects": {
        var _rsScene = (editor && editor.scene) ? editor.scene : window.__vibexe_scene__;
        var _rsTHREE = window.THREE;
        if (!_rsScene || !_rsTHREE || !d.objects) break;
        var _rsLoader = new _rsTHREE.TextureLoader();
        var _rsTotal = d.objects.length;
        var _rsPending = 0;
        console.log("[GameEditorBridge] Restoring", _rsTotal, "spawned objects");

        // Called after each async GLTF load completes (success or error).
        // When all pending loads finish, notify the parent so it can trigger auto-physics.
        function _rsCheckDone() {
          _rsPending--;
          if (_rsPending <= 0) {
            console.log("[GameEditorBridge] All spawned objects restored, notifying parent");
            window.parent.postMessage({ type: "game-editor-spawned-restored", count: _rsTotal }, "*");
          }
        }

        // First pass: count how many objects need async GLTF loading
        for (var _rsi = 0; _rsi < _rsTotal; _rsi++) {
          var _rsObj = d.objects[_rsi];
          if (!_rsScene.getObjectByName(_rsObj.name) && _rsObj.modelUrl) {
            var _rsChkLoader = window.__vibexe_gltfLoader__;
            if (!_rsChkLoader && window.GLTFLoader) _rsChkLoader = new window.GLTFLoader();
            if (_rsChkLoader) _rsPending++;
          }
        }

        // If nothing needs async loading, signal completion immediately
        if (_rsPending === 0) {
          console.log("[GameEditorBridge] No async GLTF loads needed, notifying parent");
          window.parent.postMessage({ type: "game-editor-spawned-restored", count: _rsTotal }, "*");
        }

        // Second pass: actually load/create the objects
        for (var _rsi2 = 0; _rsi2 < _rsTotal; _rsi2++) {
          (function(obj) {
            // Skip if object with same name already exists
            if (_rsScene.getObjectByName(obj.name)) return;
            if (obj.modelUrl) {
              // Load GLTF model
              var _gltfLoader = window.__vibexe_gltfLoader__;
              if (!_gltfLoader && window.GLTFLoader) _gltfLoader = new window.GLTFLoader();
              if (!_gltfLoader) { console.warn("[Restore] No GLTFLoader for:", obj.name); return; }
              var _rsUrl = obj.modelUrl;
              if (_rsUrl.charAt(0) === '/') _rsUrl = (window.__VIBEXE_API_ORIGIN__ || '') + _rsUrl;
              _gltfLoader.load(_rsUrl, function(gltf) {
                var model = gltf.scene || gltf.scenes[0];
                model.name = obj.name;
                model.position.set(obj.position.x, obj.position.y, obj.position.z);
                model.rotation.set(obj.rotation.x * Math.PI / 180, obj.rotation.y * Math.PI / 180, obj.rotation.z * Math.PI / 180);
                model.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
                model.userData.__spawned = true;
                model.userData.vibexeType = obj.type;
                model.userData.__modelUrl = obj.modelUrl;
                if (!model.userData.vibexeArgs) model.userData.vibexeArgs = {};
                model.userData.vibexeArgs.modelUrl = obj.modelUrl;
                _rsScene.add(model);
                // Apply texture if saved
                if (obj.textureUrl) {
                  var _txUrl = obj.textureUrl;
                  if (_txUrl.charAt(0) === '/') _txUrl = (window.__VIBEXE_API_ORIGIN__ || '') + _txUrl;
                  _rsLoader.load(_txUrl, function(tex) {
                    tex.wrapS = _rsTHREE.RepeatWrapping;
                    tex.wrapT = _rsTHREE.RepeatWrapping;
                    tex.colorSpace = _rsTHREE.SRGBColorSpace || 'srgb';
                    tex.repeat.set(obj.textureTileX || 1, obj.textureTileY || 1);
                    model.traverse(function(m) {
                      if (m.isMesh && m.material && !Array.isArray(m.material)) {
                        m.material.map = tex;
                        m.material.needsUpdate = true;
                      }
                    });
                    model.userData.vibexeArgs.textureUrl = obj.textureUrl;
                    model.userData.vibexeArgs.textureTileX = obj.textureTileX;
                    model.userData.vibexeArgs.textureTileY = obj.textureTileY;
                  });
                }
                console.log("[GameEditorBridge] Restored spawned:", obj.name);
                _rsCheckDone();
              }, undefined, function(err) {
                console.warn("[Restore] GLTF load failed:", obj.name, err);
                _rsCheckDone();
              });
            } else {
              // Simple geometry fallback (box/sphere)
              var _rsGeo = new _rsTHREE.BoxGeometry(1, 1, 1);
              var _rsMat = new _rsTHREE.MeshStandardMaterial({ color: 0x888888 });
              var _rsMesh = new _rsTHREE.Mesh(_rsGeo, _rsMat);
              _rsMesh.name = obj.name;
              _rsMesh.position.set(obj.position.x, obj.position.y, obj.position.z);
              _rsMesh.rotation.set(obj.rotation.x * Math.PI / 180, obj.rotation.y * Math.PI / 180, obj.rotation.z * Math.PI / 180);
              _rsMesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
              _rsMesh.userData.__spawned = true;
              _rsMesh.userData.vibexeType = obj.type;
              _rsScene.add(_rsMesh);
            }
          })(d.objects[_rsi2]);
        }
        break;
      }

      case "game-editor-apply-texture-overrides": {
        var _toScene = (editor && editor.scene) ? editor.scene : window.__vibexe_scene__;
        var _toTHREE = window.THREE;
        if (!_toScene || !_toTHREE || !d.overrides) break;
        var _toLoader = new _toTHREE.TextureLoader();
        console.log("[GameEditorBridge] Applying", d.overrides.length, "texture overrides");
        for (var _toi = 0; _toi < d.overrides.length; _toi++) {
          (function(ov) {
            var target = _toScene.getObjectByName(ov.name);
            if (!target) { console.warn("[TextureOverride] Object not found:", ov.name); return; }
            var _ovUrl = ov.textureUrl;
            if (_ovUrl.charAt(0) === '/') _ovUrl = (window.__VIBEXE_API_ORIGIN__ || '') + _ovUrl;
            _toLoader.load(_ovUrl, function(tex) {
              tex.wrapS = _toTHREE.RepeatWrapping;
              tex.wrapT = _toTHREE.RepeatWrapping;
              tex.colorSpace = _toTHREE.SRGBColorSpace || 'srgb';
              tex.repeat.set(ov.tileX || 1, ov.tileY || 1);
              target.traverse(function(m) {
                if (m.isMesh && m.material && !Array.isArray(m.material)) {
                  m.material.map = tex;
                  m.material.needsUpdate = true;
                }
              });
              if (!target.userData.vibexeArgs) target.userData.vibexeArgs = {};
              target.userData.vibexeArgs.textureUrl = ov.textureUrl;
              target.userData.vibexeArgs.textureTileX = ov.tileX;
              target.userData.vibexeArgs.textureTileY = ov.tileY;
              target.__hasTextureOverride = true;
              console.log("[TextureOverride] Applied:", ov.name, ov.textureUrl);
            }, undefined, function() { console.warn("[TextureOverride] Load failed:", ov.name, ov.textureUrl); });
          })(d.overrides[_toi]);
        }
        break;
      }

      // ===== LIGHT RESTORATION (Game mode — recreate editor lights from saved config) =====

      case "game-editor-restore-lights": {
        var _rlScene = (editor && editor.scene) ? editor.scene : window.__vibexe_scene__;
        var _rlTHREE = window.THREE;
        if (!_rlScene || !_rlTHREE || !d.lights) break;
        console.log("[GameEditorBridge] Restoring", d.lights.length, "lights");
        for (var _rli = 0; _rli < d.lights.length; _rli++) {
          (function(cfg) {
            // Skip if light already exists
            if (_rlScene.getObjectByName(cfg.name)) return;
            var _light;
            var _color = new _rlTHREE.Color(cfg.color || "#ffffff");
            var _intensity = cfg.intensity != null ? cfg.intensity : 1;
            var _distance = cfg.distance != null ? cfg.distance : 20;
            var _decay = cfg.decay != null ? cfg.decay : 2;
            if (cfg.type === "spot") {
              var _angle = cfg.angle != null ? cfg.angle : 0.5;
              var _penumbra = cfg.penumbra != null ? cfg.penumbra : 0.5;
              _light = new _rlTHREE.SpotLight(_color, _intensity, _distance, _angle, _penumbra, _decay);
              if (cfg.target) {
                _light.target.position.set(cfg.target.x || 0, cfg.target.y || 0, cfg.target.z || 0);
              }
              _rlScene.add(_light.target);
            } else {
              _light = new _rlTHREE.PointLight(_color, _intensity, _distance, _decay);
            }
            _light.name = cfg.name;
            _light.position.set(cfg.position.x || 0, cfg.position.y || 5, cfg.position.z || 0);
            _light.castShadow = true;
            _light.shadow.mapSize.width = 512;
            _light.shadow.mapSize.height = 512;
            _light.userData.__editorLight = true;
            _light.userData.__lightType = cfg.type;
            _light.userData.__lightColor = cfg.color || "#ffffff";
            _light.userData.__lightIntensity = _intensity;
            _light.userData.__lightDistance = _distance;
            _light.userData.__lightDecay = _decay;
            if (cfg.type === "spot") {
              _light.userData.__lightAngle = cfg.angle != null ? cfg.angle : 0.5;
              _light.userData.__lightPenumbra = cfg.penumbra != null ? cfg.penumbra : 0.5;
              _light.userData.__lightTarget = cfg.target || { x: 0, y: 0, z: 0 };
            }
            _rlScene.add(_light);
            console.log("[GameEditorBridge] Restored light:", cfg.name, cfg.type);
          })(d.lights[_rli]);
        }
        window.parent.postMessage({ type: "game-editor-lights-restored", count: d.lights.length }, "*");
        break;
      }

      case "game-editor-add-light": {
        if (!editor || !editor.scene) break;
        var _alTHREE = window.THREE;
        var _alType = d.lightType || "point";
        var _alColor = new _alTHREE.Color(d.color || "#ffffff");
        var _alIntensity = d.intensity != null ? d.intensity : 1;
        // Position in front of camera
        var _alPos = d.position || { x: 0, y: 5, z: 0 };
        if (!d.position && editor.camera) {
          var _alDir = new _alTHREE.Vector3(0, 0, -5).applyQuaternion(editor.camera.quaternion);
          _alPos = { x: +(editor.camera.position.x + _alDir.x).toFixed(1), y: +(editor.camera.position.y + _alDir.y).toFixed(1), z: +(editor.camera.position.z + _alDir.z).toFixed(1) };
        }
        var _alDistance = d.distance != null ? d.distance : 20;
        var _alDecay = d.decay != null ? d.decay : 2;
        var _alCount = 0;
        editor.scene.traverse(function(c) { if (c.name && c.name.indexOf("Light_" + _alType + "_") === 0) _alCount++; });
        var _alName = "Light_" + _alType + "_" + _alCount;
        var _alLight;
        if (_alType === "spot") {
          var _alAngle = d.angle != null ? d.angle : 0.5;
          var _alPenumbra = d.penumbra != null ? d.penumbra : 0.5;
          _alLight = new _alTHREE.SpotLight(_alColor, _alIntensity, _alDistance, _alAngle, _alPenumbra, _alDecay);
          if (d.target) _alLight.target.position.set(d.target.x || 0, d.target.y || 0, d.target.z || 0);
          editor.scene.add(_alLight.target);
        } else {
          _alLight = new _alTHREE.PointLight(_alColor, _alIntensity, _alDistance, _alDecay);
        }
        _alLight.name = _alName;
        _alLight.position.set(_alPos.x, _alPos.y, _alPos.z);
        _alLight.castShadow = true;
        _alLight.shadow.mapSize.width = 512;
        _alLight.shadow.mapSize.height = 512;
        _alLight.userData.__editorLight = true;
        _alLight.userData.__lightType = _alType;
        _alLight.userData.__lightColor = d.color || "#ffffff";
        _alLight.userData.__lightIntensity = _alIntensity;
        _alLight.userData.__lightDistance = _alDistance;
        _alLight.userData.__lightDecay = _alDecay;
        if (_alType === "spot") {
          _alLight.userData.__lightAngle = d.angle != null ? d.angle : 0.5;
          _alLight.userData.__lightPenumbra = d.penumbra != null ? d.penumbra : 0.5;
          _alLight.userData.__lightTarget = d.target || { x: _alPos.x, y: 0, z: _alPos.z };
        }
        editor.scene.add(_alLight);
        // Visual helper sphere
        var _alHelperGeo = new _alTHREE.SphereGeometry(0.3, 8, 8);
        var _alHelperMat = new _alTHREE.MeshBasicMaterial({ color: _alType === "spot" ? 0xffaa00 : 0xffff00, wireframe: true, depthTest: false, transparent: true, opacity: 0.7 });
        var _alHelper = new _alTHREE.Mesh(_alHelperGeo, _alHelperMat);
        _alHelper.name = "__editor_light_helper_" + _alName;
        _alHelper.position.copy(_alLight.position);
        _alHelper.userData.__lightHelperFor = _alName;
        _alHelper.userData.__isLightHelper = true;
        _alHelper.renderOrder = 999;
        editor.scene.add(_alHelper);
        if (_alType === "spot") {
          var _alSpotHelper = new _alTHREE.SpotLightHelper(_alLight);
          _alSpotHelper.name = "__editor_spot_helper_" + _alName;
          _alSpotHelper.userData.__lightHelperFor = _alName;
          _alSpotHelper.userData.__isLightHelper = true;
          editor.scene.add(_alSpotHelper);
        }
        console.log("[GameEditorBridge] Added light:", _alName, "type:", _alType);
        sendSceneTreeThrottled();
        selectObject(_alLight);
        window.parent.postMessage({
          type: "game-editor-light-added", name: _alName, lightType: _alType,
          color: d.color || "#ffffff", intensity: _alIntensity, position: _alPos,
          distance: _alDistance, decay: _alDecay,
          angle: _alType === "spot" ? (d.angle != null ? d.angle : 0.5) : undefined,
          penumbra: _alType === "spot" ? (d.penumbra != null ? d.penumbra : 0.5) : undefined,
          target: _alType === "spot" ? (d.target || { x: _alPos.x, y: 0, z: _alPos.z }) : undefined,
        }, "*");
        break;
      }

      case "game-editor-update-light": {
        if (!editor || !editor.scene || !d.name) break;
        var _ulLight = editor.scene.getObjectByName(d.name);
        if (!_ulLight || !_ulLight.isLight) break;
        if (d.color !== undefined) {
          _ulLight.color.set(d.color);
          _ulLight.userData.__lightColor = d.color;
        }
        if (d.intensity !== undefined) {
          _ulLight.intensity = Number(d.intensity);
          _ulLight.userData.__lightIntensity = Number(d.intensity);
        }
        if (d.distance !== undefined) {
          _ulLight.distance = Number(d.distance);
          _ulLight.userData.__lightDistance = Number(d.distance);
        }
        if (d.decay !== undefined) {
          _ulLight.decay = Number(d.decay);
          _ulLight.userData.__lightDecay = Number(d.decay);
        }
        if (d.position) {
          _ulLight.position.set(d.position.x, d.position.y, d.position.z);
          var _ulHelper = editor.scene.getObjectByName("__editor_light_helper_" + d.name);
          if (_ulHelper) _ulHelper.position.copy(_ulLight.position);
        }
        if (_ulLight.isSpotLight) {
          if (d.angle !== undefined) { _ulLight.angle = Number(d.angle); _ulLight.userData.__lightAngle = Number(d.angle); }
          if (d.penumbra !== undefined) { _ulLight.penumbra = Number(d.penumbra); _ulLight.userData.__lightPenumbra = Number(d.penumbra); }
          if (d.target) { _ulLight.target.position.set(d.target.x, d.target.y, d.target.z); _ulLight.userData.__lightTarget = d.target; }
          var _ulSpotHelper = editor.scene.getObjectByName("__editor_spot_helper_" + d.name);
          if (_ulSpotHelper && _ulSpotHelper.update) _ulSpotHelper.update();
        }
        console.log("[GameEditorBridge] Updated light:", d.name);
        if (selectedObj && selectedObj === _ulLight) sendSelectedObject(_ulLight);
        sendSceneTreeThrottled();
        break;
      }

      case "game-editor-remove-light": {
        if (!editor || !editor.scene || !d.name) break;
        var _rmLight = editor.scene.getObjectByName(d.name);
        if (_rmLight) {
          if (selectedObj && selectedObj === _rmLight) deselectObject();
          if (_rmLight.isSpotLight && _rmLight.target) editor.scene.remove(_rmLight.target);
          editor.scene.remove(_rmLight);
        }
        var _rmHelper = editor.scene.getObjectByName("__editor_light_helper_" + d.name);
        if (_rmHelper) editor.scene.remove(_rmHelper);
        var _rmSpotHelper = editor.scene.getObjectByName("__editor_spot_helper_" + d.name);
        if (_rmSpotHelper) editor.scene.remove(_rmSpotHelper);
        console.log("[GameEditorBridge] Removed light:", d.name);
        sendSceneTreeThrottled();
        window.parent.postMessage({ type: "game-editor-light-removed", name: d.name }, "*");
        break;
      }

      // ===== TERRAIN PAINTER HANDLERS =====

      case "terrain-painter-generate-terrain": {
        // Use editor.scene in scene-editor mode, or __vibexe_scene__ in game mode (for terrain persistence)
        var _tpScene = (editor && editor.scene) ? editor.scene : window.__vibexe_scene__;
        console.log("[TerrainPainter] CASE HIT. editor=", !!editor, "scene=", !!_tpScene, "THREE=", !!window.THREE);
        var _tpTHREE = window.THREE;
        if (!_tpTHREE) { console.log("[TerrainPainter] ABORT: no THREE"); break; }
        if (!_tpScene) { console.log("[TerrainPainter] ABORT: no scene"); break; }
        var _tpS = d.settings || {};
        var _tpW = _tpS.terrainWidth || 200;
        var _tpD = _tpS.terrainDepth || 200;
        var _tpH = _tpS.terrainHeightScale || 40;
        var _tpSeg = Math.min(_tpS.terrainSegments || 128, 128);

        // Biome support — use resolved params from panel (preferred), or module fallback
        // IMPORTANT: Only override _tpH with biome heightScale if resolvedBiomeParams is explicit.
        // On reload, the saved terrainHeightScale IS the correct value from the original generation.
        // Recalculating from getBiomeParams() may produce a DIFFERENT heightScale (non-deterministic
        // between panel's resolveBiomeParams and module's getBiomeParams implementations).
        var _tpBP = d.resolvedBiomeParams || null;
        if (_tpBP) {
          _tpH = _tpBP.heightScale;
        } else if (d.biome) {
          var _tpMod = window.__vibexe_modules__ && window.__vibexe_modules__["terrain-painter"];
          if (_tpMod && _tpMod.getBiomeParams) {
            _tpBP = _tpMod.getBiomeParams(d.biome, d.seed || Math.floor(Math.random() * 999999));
            // DO NOT override _tpH here — the saved terrainHeightScale is authoritative.
            // Only use biome params for noise shape (gamma, freq, etc.), not height.
          }
        }

        // Biome param variables (defaults match existing hardcoded values)
        var _bpContGamma = _tpBP ? _tpBP.continentalGamma : 2.5;
        var _bpContFreq = _tpBP ? _tpBP.continentalFreq : 1.5;
        var _bpRidgeFreq = _tpBP ? _tpBP.ridgeFreq : 3.0;
        var _bpRidgeSharp = _tpBP ? _tpBP.ridgeSharpness : 3.0;
        var _bpHillsAmp = _tpBP ? _tpBP.hillsAmp : 0.12;
        var _bpDetailAmp = _tpBP ? _tpBP.detailAmp : 0.05;
        var _bpWarpStr = _tpBP ? _tpBP.warpStrength : 0.45;

        console.log("[TerrainPainter] Generating terrain:", _tpW, "x", _tpD, "h=", _tpH, "seg=", _tpSeg, "biome=", d.biome || "default");

        // Remove existing terrain
        var _tpOld = _tpScene.getObjectByName("__terrain__");
        if (_tpOld) { _tpScene.remove(_tpOld); if (_tpOld.geometry) _tpOld.geometry.dispose(); if (_tpOld.material) _tpOld.material.dispose(); }

        // Remove default ground plane + grid (terrain replaces them — fixes double-terrain issue)
        var _removeByName2 = function(sc, n) {
          var obj = sc.getObjectByName(n);
          if (obj) { sc.remove(obj); if (obj.geometry) obj.geometry.dispose(); if (obj.material) obj.material.dispose(); }
        };
        _removeByName2(_tpScene, "__default_ground__");
        _removeByName2(_tpScene, "__default_grid__");

        // Delegate to module's TerrainGenerator when biome is set (has 4-stage erosion pipeline)
        var _tpBiomeGenerated = false;
        if (d.biome || _tpBP) {
          var _tpModGen = window.__vibexe_modules__ && window.__vibexe_modules__["terrain-painter"];
          if (_tpModGen && _tpModGen.TerrainGenerator) {
            console.log("[TerrainPainter] Using module TerrainGenerator with erosion for biome:", d.biome);
            // Use resolved params from panel if available, else try module lookup
            var _bpGen = _tpBP || (_tpModGen.getBiomeParams ? _tpModGen.getBiomeParams(d.biome, d.seed || Math.floor(Math.random() * 999999)) : null);
            if (_bpGen) {
              var _genInst = new _tpModGen.TerrainGenerator(_tpScene, {
                width: _tpW,
                depth: _tpD,
                heightScale: _bpGen.heightScale || _tpH,
                segments: _tpSeg,
                biomeParams: _bpGen
              });
            _genInst.generate();

            // Module's generate() removes default ground — also clean up any remaining ground planes
            var _tpCleanup = [];
            _tpScene.traverse(function(child) {
              if (child.name === "__terrain__" || child.name === "__terrain_boundary_grid__") return;
              if (child.name === "__default_ground__" || child.name === "__default_grid__") { _tpCleanup.push(child); return; }
              if (child.isMesh && !child.name) {
                var cGeo = child.geometry;
                if (cGeo && cGeo.type === "PlaneGeometry") {
                  var cParams = cGeo.parameters;
                  if (cParams && (cParams.width >= 50 || cParams.height >= 50)) {
                    _tpCleanup.push(child);
                  }
                }
              }
              if (child.isGridHelper || child.type === "GridHelper") {
                _tpCleanup.push(child);
              }
            });
            for (var _tpci = 0; _tpci < _tpCleanup.length; _tpci++) {
              _tpScene.remove(_tpCleanup[_tpci]);
              if (_tpCleanup[_tpci].geometry) _tpCleanup[_tpci].geometry.dispose();
              if (_tpCleanup[_tpci].material) _tpCleanup[_tpci].material.dispose();
            }

            _tpBiomeGenerated = true;
            }
          }
        }

        // ---- Inline simplex noise (2D) ----
        var _tpGrad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
        var _tpPerm = new Array(512);
        var _tpP = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
        for (var _tpI = 0; _tpI < 512; _tpI++) _tpPerm[_tpI] = _tpP[_tpI & 255];

        // Seed-based permutation shuffle (deterministic terrain from seed)
        if (d.seed) {
          var _tpSeedVal = d.seed;
          var _tpShuffled = _tpP.slice();
          var _tpM = _tpShuffled.length;
          while (_tpM) {
            _tpSeedVal = (_tpSeedVal * 16807 + 0) % 2147483647;
            var _tpIdx = _tpSeedVal % _tpM--;
            var _tpTmp = _tpShuffled[_tpM];
            _tpShuffled[_tpM] = _tpShuffled[_tpIdx];
            _tpShuffled[_tpIdx] = _tpTmp;
          }
          for (var _tpJ = 0; _tpJ < 512; _tpJ++) _tpPerm[_tpJ] = _tpShuffled[_tpJ & 255];
        }

        function _tpDot2(g, x, y) { return g[0]*x + g[1]*y; }

        function _tpNoise2D(xin, yin) {
          var F2 = 0.5*(Math.sqrt(3.0)-1.0);
          var G2 = (3.0-Math.sqrt(3.0))/6.0;
          var s = (xin+yin)*F2;
          var i = Math.floor(xin+s);
          var j = Math.floor(yin+s);
          var t = (i+j)*G2;
          var X0 = i-t; var Y0 = j-t;
          var x0 = xin-X0; var y0 = yin-Y0;
          var i1, j1;
          if (x0>y0) { i1=1; j1=0; } else { i1=0; j1=1; }
          var x1 = x0-i1+G2; var y1 = y0-j1+G2;
          var x2 = x0-1.0+2.0*G2; var y2 = y0-1.0+2.0*G2;
          var ii = i & 255; var jj = j & 255;
          var gi0 = _tpPerm[ii+_tpPerm[jj]] % 12;
          var gi1 = _tpPerm[ii+i1+_tpPerm[jj+j1]] % 12;
          var gi2 = _tpPerm[ii+1+_tpPerm[jj+1]] % 12;
          var n0 = 0, n1 = 0, n2 = 0;
          var t0 = 0.5 - x0*x0 - y0*y0;
          if (t0 >= 0) { t0 *= t0; n0 = t0*t0*_tpDot2(_tpGrad3[gi0], x0, y0); }
          var t1 = 0.5 - x1*x1 - y1*y1;
          if (t1 >= 0) { t1 *= t1; n1 = t1*t1*_tpDot2(_tpGrad3[gi1], x1, y1); }
          var t2 = 0.5 - x2*x2 - y2*y2;
          if (t2 >= 0) { t2 *= t2; n2 = t2*t2*_tpDot2(_tpGrad3[gi2], x2, y2); }
          return 70.0 * (n0 + n1 + n2); // -1..1
        }

        function _tpFbm(x, y, octaves, lac, gain) {
          var sum = 0, amp = 1, freq = 1, maxAmp = 0;
          for (var o = 0; o < octaves; o++) {
            sum += _tpNoise2D(x*freq, y*freq) * amp;
            maxAmp += amp;
            amp *= gain;
            freq *= lac;
          }
          return sum / maxAmp;
        }

        // Ridged multifractal (Musgrave algorithm) — signal-dependent amplitude creates sharp peaks
        function _tpRidgedMF(x, y, octaves, lacunarity, gain, sharpness) {
          var sum = 0, amp = 1, freq = 1, prev = 1;
          for (var o = 0; o < octaves; o++) {
            var n = _tpNoise2D(x * freq, y * freq);
            n = 1.0 - Math.abs(n);
            n = Math.pow(n, sharpness);
            n *= prev;
            prev = Math.max(0.01, n);
            sum += n * amp;
            amp *= gain;
            freq *= lacunarity;
          }
          return sum;
        }

        // Domain warp — distorts coordinates with another noise for organic mountain shapes
        function _tpDomainWarp(x, y, strength) {
          var wx = _tpFbm(x + 5.2, y + 1.3, 3, 2.0, 0.5) * strength;
          var wy = _tpFbm(x + 9.7, y + 6.8, 3, 2.0, 0.5) * strength;
          return [x + wx, y + wy];
        }

        function _tpSmoothstep(edge0, edge1, x) {
          var t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
          return t * t * (3 - 2 * t);
        }

        // Segment counts needed by both paths (inline noise + module delegation)
        var _tpSegX = _tpSeg + 1;
        var _tpSegZ = _tpSeg + 1;
        var _tpGeo, _tpPos, _tpMinY, _tpMaxY, _tpHeightData, _tpMesh;

        if (!_tpBiomeGenerated) {
        // Create plane geometry
        _tpGeo = new _tpTHREE.PlaneGeometry(_tpW, _tpD, _tpSeg, _tpSeg);
        _tpGeo.rotateX(-Math.PI / 2); // lay flat on XZ plane

        // Displace vertices with multi-scale noise composition
        _tpPos = _tpGeo.attributes.position;
        _tpMinY = Infinity; _tpMaxY = -Infinity;
        var _tpHalfW = _tpW * 0.5;
        var _tpHalfD = _tpD * 0.5;
        _tpHeightData = new Float32Array(_tpSegX * _tpSegZ);

        for (var vi = 0; vi < _tpPos.count; vi++) {
          var vx = _tpPos.getX(vi);
          var vz = _tpPos.getZ(vi);
          var nx = vx / _tpW; // -0.5..0.5
          var nz = vz / _tpD;

          // T11 fix: edge falloff exponent aligned with module (was 10, module uses 6)
          var edgeX = 1.0 - Math.pow(2.0 * Math.abs(nx), 6);
          var edgeZ = 1.0 - Math.pow(2.0 * Math.abs(nz), 6);
          var edgeFalloff = _tpSmoothstep(0, 0.15, Math.max(0, Math.min(edgeX, edgeZ)));

          // Domain warp for organic mountain shapes (parameterized by biome)
          var warpPt = _tpDomainWarp(nx * 1.5, nz * 1.5, _bpWarpStr);
          var wx = warpPt[0];
          var wz = warpPt[1];

          // Scale 1: Continental — large mountain range shape (domain-warped fBm)
          var continental = (_tpFbm(wx * _bpContFreq, wz * _bpContFreq, 6, 2.0, 0.5) + 1) * 0.5;
          continental = Math.pow(continental, _bpContGamma);

          // Scale 2: Mountain ridges (ridged multifractal — sharp peaks at zero crossings)
          var ridges = _tpRidgedMF(nx * _bpRidgeFreq + 3.7, nz * _bpRidgeFreq + 1.2, 7, 2.2, 0.5, _bpRidgeSharp);
          ridges *= 0.5;

          // Scale 3: Rolling foothills
          var hills = _tpFbm(nx * 6.0 + 7.3, nz * 6.0 + 2.8, 5, 2.0, 0.5) * _bpHillsAmp;

          // Scale 4: Fine surface detail (altitude-dependent — more detail on peaks)
          var detail = _tpFbm(nx * 20.0, nz * 20.0, 4, 2.0, 0.4) * _bpDetailAmp;

          // Altitude-dependent roughness composition
          var baseH = continental * 0.4 + ridges;
          var roughDetail = (hills + detail) * (0.3 + Math.min(1, baseH) * 0.7);

          var h = (baseH + roughDetail) * edgeFalloff * _tpH;
          _tpPos.setY(vi, h);
          _tpHeightData[vi] = h;
          if (h < _tpMinY) _tpMinY = h;
          if (h > _tpMaxY) _tpMaxY = h;
        }
        _tpPos.needsUpdate = true;
        _tpGeo.computeVertexNormals();

        // If sculpt heightmap data was saved, overlay it on the generated terrain
        // T5 fix: validate Base64 sculpt data — check length, NaN, and reasonable range
        // Also check window.__VIBEXE_GAME_SETTINGS__.terrain as fallback (IIFE may not pass it)
        var _tpSculptRestored = false;
        var _tpSculptSrc = _tpS.sculptHeightData;
        if (!_tpSculptSrc && window.__VIBEXE_GAME_SETTINGS__ && window.__VIBEXE_GAME_SETTINGS__.terrain) {
          _tpSculptSrc = window.__VIBEXE_GAME_SETTINGS__.terrain.sculptHeightData;
        }
        if (_tpSculptSrc && typeof _tpSculptSrc === "string" && _tpSculptSrc.length > 0) {
          try {
            var _sData = atob(_tpSculptSrc);
            if (_sData.length % 4 !== 0) throw new Error("Invalid heightmap byte length: " + _sData.length + " (not multiple of 4)");
            var _sBytes = new Uint8Array(_sData.length);
            for (var si = 0; si < _sData.length; si++) _sBytes[si] = _sData.charCodeAt(si);
            var _sFloats = new Float32Array(_sBytes.buffer);
            // Validate: check for NaN values (corrupted data)
            var _hasNaN = false;
            for (var _ni = 0; _ni < Math.min(_sFloats.length, 100); _ni++) {
              if (isNaN(_sFloats[_ni])) { _hasNaN = true; break; }
            }
            if (_hasNaN) { console.warn("[TerrainPainter] Sculpt data contains NaN — skipping restore"); }
            else if (_sFloats.length === _tpPos.count) {
              // Sanity check: reject sculpt data with unreasonable heights
              // Heights should be within heightScale * 10 (generous margin for sculpted terrain)
              var _sculptSampleMax = -Infinity;
              for (var _sci = 0; _sci < _sFloats.length; _sci++) {
                if (_sFloats[_sci] > _sculptSampleMax) _sculptSampleMax = _sFloats[_sci];
              }
              var _sculptMaxAllowed = _tpH * 10;
              if (_sculptSampleMax > _sculptMaxAllowed) {
                console.warn("[TerrainPainter] Sculpt data heights corrupted (max=" + _sculptSampleMax.toFixed(0) + " expected<" + _sculptMaxAllowed + ") — skipping restore");
              } else {
              _tpMinY = Infinity; _tpMaxY = -Infinity;
              for (var svi = 0; svi < _sFloats.length; svi++) {
                _tpPos.setY(svi, _sFloats[svi]);
                _tpHeightData[svi] = _sFloats[svi];
                if (_sFloats[svi] < _tpMinY) _tpMinY = _sFloats[svi];
                if (_sFloats[svi] > _tpMaxY) _tpMaxY = _sFloats[svi];
              }
              _tpPos.needsUpdate = true;
              _tpGeo.computeVertexNormals();
              _tpSculptRestored = true;
              console.log("[TerrainPainter] Restored sculpt heightmap (" + _sFloats.length + " vertices)");
              }
            }
          } catch(e) { console.warn("[TerrainPainter] Failed to restore sculpt data:", e); }
        }

        // TERRAIN-AS-FLOOR: Normalize height range to [0, heightScale]
        // SKIP when sculpted data was restored — sculpt heights are already in correct space.
        // Normalizing after sculpt restore destroys the sculpted detail.
        if (!_tpSculptRestored) {
        var _tpPostRange = _tpMaxY - _tpMinY;
        if (_tpPostRange > 0.001) {
          for (var nvi = 0; nvi < _tpPos.count; nvi++) {
            var _normH = ((_tpPos.getY(nvi) - _tpMinY) / _tpPostRange) * _tpH;
            _tpPos.setY(nvi, _normH);
            _tpHeightData[nvi] = _normH;
          }
          _tpMaxY = _tpH;
          _tpMinY = 0;
          _tpPos.needsUpdate = true;
          _tpGeo.computeVertexNormals();
        }
        }

        // Store per-vertex height (0-1 normalized) and slope (degrees) as attributes
        var _tpHeightArr = new Float32Array(_tpPos.count);
        var _tpSlopeArr = new Float32Array(_tpPos.count);
        var _tpNormAttr = _tpGeo.attributes.normal;
        var _tpRange = _tpMaxY - _tpMinY || 1;
        for (var vi2 = 0; vi2 < _tpPos.count; vi2++) {
          _tpHeightArr[vi2] = (_tpPos.getY(vi2) - _tpMinY) / _tpRange;
          var ny = _tpNormAttr.getY(vi2);
          _tpSlopeArr[vi2] = Math.acos(Math.min(1, Math.abs(ny))) * (180 / Math.PI);
        }
        _tpGeo.setAttribute("terrainHeight", new _tpTHREE.BufferAttribute(_tpHeightArr, 1));
        _tpGeo.setAttribute("terrainSlope", new _tpTHREE.BufferAttribute(_tpSlopeArr, 1));

        // Initial vertex-color material — adaptive gradient based on height distribution
        // Detect plateaus with carved canyons (badlands): >60% of vertices in top 30%
        var _tpHighCount = 0;
        for (var _hci = 0; _hci < _tpPos.count; _hci++) {
          if (_tpHeightArr[_hci] > 0.7) _tpHighCount++;
        }
        var _tpIsSkewed = (_tpHighCount / _tpPos.count) > 0.6;

        var _tpColors = new Float32Array(_tpPos.count * 3);
        for (var vi3 = 0; vi3 < _tpPos.count; vi3++) {
          var nh = _tpHeightArr[vi3];
          var slope = _tpSlopeArr[vi3];
          var r, g, b;
          if (_tpIsSkewed) {
            // Slope-dominant coloring for plateau/canyon terrain
            var _nv = _tpNoise2D(_tpPos.getX(vi3) * 0.08, _tpPos.getZ(vi3) * 0.08) * 0.06;
            if (slope > 45) {
              r = 0.38 + _nv; g = 0.32 + _nv; b = 0.26 + _nv;
            } else if (slope > 25) {
              var _sb = _tpSmoothstep(25, 45, slope);
              r = 0.52 + _nv - _sb * 0.14; g = 0.38 + _nv - _sb * 0.06; b = 0.28 + _nv - _sb * 0.02;
            } else if (nh < 0.15) {
              r = 0.35 + _nv; g = 0.30 + _nv; b = 0.22 + _nv;
            } else {
              r = 0.58 + _nv; g = 0.45 + _nv; b = 0.32 + _nv;
            }
          } else if (nh > 0.7) { // snow
            var sf = _tpSmoothstep(0.65, 0.8, nh);
            r = 0.35 + sf * 0.6; g = 0.45 + sf * 0.5; b = 0.35 + sf * 0.6;
          } else if (slope > 35) { // rock on steep slopes
            r = 0.45; g = 0.42; b = 0.38;
          } else if (nh > 0.3) { // grass
            r = 0.25; g = 0.45; b = 0.15;
          } else { // dirt
            r = 0.45; g = 0.35; b = 0.2;
          }
          _tpColors[vi3*3] = r;
          _tpColors[vi3*3+1] = g;
          _tpColors[vi3*3+2] = b;
        }
        _tpGeo.setAttribute("color", new _tpTHREE.BufferAttribute(_tpColors, 3));

        var _tpMat = new _tpTHREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.85,
          metalness: 0.05,
          flatShading: false
        });

        _tpMesh = new _tpTHREE.Mesh(_tpGeo, _tpMat);
        _tpMesh.name = "__terrain__";
        _tpMesh.receiveShadow = true;
        _tpMesh.castShadow = true;
        _tpMesh.userData.vibexeType = "Terrain";
        _tpMesh.userData.__isTerrain = true;
        _tpMesh.userData.__terrainMinY = _tpMinY;
        _tpMesh.userData.__terrainMaxY = _tpMaxY;
        _tpMesh.userData.__terrainWidth = _tpW;
        _tpScene.add(_tpMesh);
        // Set dark gray background matching Unity Terrain Painter references
        _tpScene.background = new _tpTHREE.Color(0x3a3a42);

        // === TERRAIN-AS-FLOOR: Hide existing ground plane and grid ===
        _tpScene.traverse(function(child) {
          if (child === _tpMesh) return;
          // Hide ground plane mesh (large unnamed PlaneGeometry)
          if (child.isMesh && !child.name) {
            var cGeo = child.geometry;
            if (cGeo && cGeo.type === "PlaneGeometry") {
              var cParams = cGeo.parameters;
              if (cParams && (cParams.width >= 50 || cParams.height >= 50)) {
                child.visible = false;
                child.userData.__hiddenByTerrain = true;
              }
            }
          }
          // Hide grid helper
          if (child.isGridHelper || child.type === "GridHelper") {
            child.visible = false;
            child.userData.__hiddenByTerrain = true;
          }
        });
        } // end if (!_tpBiomeGenerated)

        // Re-extract mesh data after module's TerrainGenerator so post-processing has the variables it needs
        if (_tpBiomeGenerated) {
          var _tpMesh2 = _tpScene.getObjectByName("__terrain__");
          if (!_tpMesh2) { console.warn("[TerrainPainter] Module generated no __terrain__ mesh"); break; }
          _tpGeo = _tpMesh2.geometry;
          _tpPos = _tpGeo.attributes.position;
          _tpHeightData = new Float32Array(_tpPos.count);
          _tpMinY = Infinity;
          _tpMaxY = -Infinity;
          for (var _re = 0; _re < _tpPos.count; _re++) {
            var _ry = _tpPos.getY(_re);
            _tpHeightData[_re] = _ry;
            if (_ry < _tpMinY) _tpMinY = _ry;
            if (_ry > _tpMaxY) _tpMaxY = _ry;
          }
          _tpMesh = _tpMesh2;
          // Fix: recalculate segX/segZ from actual geometry vertex count
          // Module may cap segments differently than bridge's initial _tpSeg
          _tpSegX = Math.round(Math.sqrt(_tpPos.count));
          _tpSegZ = _tpSegX;

          // CRITICAL: Restore sculpt heightmap AFTER module terrain replacement.
          // The earlier restore at line ~4571 applies to the bridge's inline geometry
          // which gets discarded when the module creates its own __terrain__ mesh.
          // This second restore applies to the FINAL geometry that actually renders.
          var _tpSculptSrc2 = _tpS.sculptHeightData;
          if (!_tpSculptSrc2 && window.__VIBEXE_GAME_SETTINGS__ && window.__VIBEXE_GAME_SETTINGS__.terrain) {
            _tpSculptSrc2 = window.__VIBEXE_GAME_SETTINGS__.terrain.sculptHeightData;
          }
          if (_tpSculptSrc2 && typeof _tpSculptSrc2 === "string" && _tpSculptSrc2.length > 0) {
            try {
              var _s2Data = atob(_tpSculptSrc2);
              var _s2Bytes = new Uint8Array(_s2Data.length);
              for (var _s2i = 0; _s2i < _s2Data.length; _s2i++) _s2Bytes[_s2i] = _s2Data.charCodeAt(_s2i);
              var _s2Floats = new Float32Array(_s2Bytes.buffer);
              if (_s2Floats.length === _tpPos.count) {
                _tpMinY = Infinity; _tpMaxY = -Infinity;
                for (var _s2v = 0; _s2v < _s2Floats.length; _s2v++) {
                  _tpPos.setY(_s2v, _s2Floats[_s2v]);
                  _tpHeightData[_s2v] = _s2Floats[_s2v];
                  if (_s2Floats[_s2v] < _tpMinY) _tpMinY = _s2Floats[_s2v];
                  if (_s2Floats[_s2v] > _tpMaxY) _tpMaxY = _s2Floats[_s2v];
                }
                _tpPos.needsUpdate = true;
                _tpGeo.computeVertexNormals();
                _tpSculptRestored = true;
                console.log("[TerrainPainter] Restored sculpt heightmap on module terrain (" + _s2Floats.length + " vertices)");
              }
            } catch(e) { console.warn("[TerrainPainter] Module terrain sculpt restore failed:", e); }
          }
        }

        // Store heightmap data for CPU-side getHeightAt() queries
        window.__vibexe_terrainData = {
          heightData: _tpHeightData,
          width: _tpW,
          depth: _tpD,
          segX: _tpSegX,
          segZ: _tpSegZ,
          minY: _tpMinY,
          maxY: _tpMaxY
        };

        // Bilinear interpolation height query — O(1) per call, no raycasting needed
        window.__vibexe_getTerrainHeight = function(x, z) {
          var td = window.__vibexe_terrainData;
          if (!td || !td.heightData) return null;
          // T12 fix: return null outside terrain bounds + bounds check on array access
          var halfW = td.width * 0.5, halfD = td.depth * 0.5;
          if (x < -halfW || x > halfW || z < -halfD || z > halfD) return null;
          var gx = (x + halfW) / td.width * (td.segX - 1);
          var gz = (z + halfD) / td.depth * (td.segZ - 1);
          gx = Math.max(0, Math.min(td.segX - 2, gx));
          gz = Math.max(0, Math.min(td.segZ - 2, gz));
          var ix = Math.floor(gx), iz = Math.floor(gz);
          var fx = gx - ix, fz = gz - iz;
          var i00 = iz * td.segX + ix;
          if (i00 + td.segX + 1 >= td.heightData.length || i00 < 0) return null;
          var h00 = td.heightData[i00];
          var h10 = td.heightData[i00 + 1];
          var h01 = td.heightData[i00 + td.segX];
          var h11 = td.heightData[i00 + td.segX + 1];
          var r = h00*(1-fx)*(1-fz) + h10*fx*(1-fz) + h01*(1-fx)*fz + h11*fx*fz;
          return isNaN(r) ? null : r;
        };

        // === MODULE API REGISTRY ===
        // Formal module discovery protocol. Each module registers its public API here.
        // Other modules query capabilities without hardcoded knowledge of each other.
        if (!window.__vibexe_moduleAPI) window.__vibexe_moduleAPI = {};

        // === MODULE INTEROP: Terrain Surface API ===
        // PBR grass/vegetation textures extend visually above the geometric surface.
        // Physics heightfields stay at geometric level (KCC doesn't depenetrate).
        // Consumers that position visual meshes read surfaceOffset to lift above grass.
        // Default 0.35 — updated by repaint handler when layer textures are known.
        window.__vibexe_terrainSurfaceOffset = 0.35;

        // getTerrainHeight stays as geometric height (used by physics postStep, KCC safety nets)
        // getVisualTerrainHeight = geometric + surfaceOffset (for mesh positioning, spawn markers)
        window.__vibexe_getVisualTerrainHeight = function(x, z) {
          var h = window.__vibexe_getTerrainHeight ? window.__vibexe_getTerrainHeight(x, z) : 0;
          return h + (window.__vibexe_terrainSurfaceOffset || 0);
        };
        // Alias for code that explicitly wants geometric (no offset)
        window.__vibexe_getGeometricTerrainHeight = window.__vibexe_getTerrainHeight;

        // Register terrain module API
        window.__vibexe_moduleAPI['terrain-painter'] = {
          version: '1.0',
          getHeight: window.__vibexe_getTerrainHeight,
          getVisualHeight: window.__vibexe_getVisualTerrainHeight,
          surfaceOffset: window.__vibexe_terrainSurfaceOffset,
          terrainData: window.__vibexe_terrainData,
          has: { heightfield: true, sculpting: true, pbr: true }
        };

        // === CANNON.js Heightfield Physics ===
        // Creates a physics collider matching the terrain mesh so characters walk on it
        var _tpCANNON = window.CANNON;
        var _tpWorld = window.__vibexe_world__;
        if (_tpCANNON && _tpWorld) {
          // Remove previous terrain heightfield body if it exists
          if (window.__vibexe_terrainBody) {
            try { _tpWorld.removeBody(window.__vibexe_terrainBody); } catch(e) {}
            window.__vibexe_terrainBody = null;
          }

          // Disable the infinite ground plane body — terrain replaces it
          // The ground plane sits at Y=0 which blocks the character below terrain
          for (var bi = 0; bi < _tpWorld.bodies.length; bi++) {
            var _gpBody = _tpWorld.bodies[bi];
            if (_gpBody.mass === 0 && _gpBody.shapes && _gpBody.shapes.length === 1 && _gpBody.shapes[0] instanceof _tpCANNON.Plane) {
              _gpBody.position.set(0, -10000, 0); // Move far below so it never collides
              _gpBody.updateMassProperties();
              window.__vibexe_groundPlaneBody = _gpBody;
              console.log("[TerrainPhysics] Disabled ground plane (moved to Y=-10000)");
              break;
            }
          }

          // Build column-major height matrix for CANNON Heightfield
          // CANNON Heightfield expects matrix[col][row] (X-major), origin at corner
          var _hfMatrix = [];
          for (var hx = 0; hx < _tpSegX; hx++) {
            _hfMatrix.push([]);
            for (var hz = 0; hz < _tpSegZ; hz++) {
              // Terrain data is row-major (Z * segX + X), need to transpose for CANNON
              _hfMatrix[hx].push(_tpHeightData[(_tpSegZ - 1 - hz) * _tpSegX + hx]);
            }
          }

          var _hfElementSize = _tpW / (_tpSegX - 1);
          try {
            var _hfShape = new _tpCANNON.Heightfield(_hfMatrix, { elementSize: _hfElementSize });
            var _hfBody = new _tpCANNON.Body({ mass: 0, type: _tpCANNON.Body.STATIC });
            _hfBody.addShape(_hfShape);
            // CANNON Heightfield: height along local Z, grid in local XY
            // Rotate -90° on X to map local Z → world Y (up)
            _hfBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
            // After rotation: local X → world X, local Y → world Z, local Z → world Y
            // Origin at corner — offset to center terrain on world XZ
            _hfBody.position.set(-_tpW / 2, 0, _tpD / 2);
            _tpWorld.addBody(_hfBody);
            window.__vibexe_terrainBody = _hfBody;
            window.__vibexe_terrainHFShape = _hfShape;
            console.log("[TerrainPhysics] Heightfield body created:", _tpSegX, "x", _tpSegZ, "elementSize:", _hfElementSize.toFixed(3));
          } catch(hfErr) {
            console.error("[TerrainPhysics] Failed to create heightfield:", hfErr);
          }

          // === Rapier heightfield (for KCC terrain collision — solid, volumetric) ===
          // Heightfield is preferred over trimesh because:
          // 1. Semi-infinite solid below surface — objects can't pass through
          // 2. Proper depenetration — pushes objects out if they clip below surface
          // 3. More efficient for terrain-like shapes than trimesh
          // Uses CPU heightmap data (same source as getTerrainHeight) for guaranteed sync.
          window.__vibexe_rebuildRapierTerrain = function() {
            var _tpRAPIER = window.RAPIER;
            var _tpRapierWorld = window.__vibexe_rapierWorld__;
            if (!_tpRAPIER || !_tpRapierWorld) return;
            // Defer to next tick — prevents "recursive use" WASM error when
            // Rapier world is currently borrowed (e.g., during physics step or bundle re-injection)
            setTimeout(function() {
            var _tpRAPIER = window.RAPIER;
            var _tpRapierWorld = window.__vibexe_rapierWorld__;
            if (!_tpRAPIER || !_tpRapierWorld) return;
            // Remove previous Rapier terrain collider
            if (window.__vibexe_rapierTerrainCollider__) {
              try { _tpRapierWorld.removeCollider(window.__vibexe_rapierTerrainCollider__, true); } catch(e) {}
              window.__vibexe_rapierTerrainCollider__ = null;
            }
            if (window.__vibexe_rapierTerrainBody__) {
              try { _tpRapierWorld.removeRigidBody(window.__vibexe_rapierTerrainBody__); } catch(e) {}
              window.__vibexe_rapierTerrainBody__ = null;
            }
            var td = window.__vibexe_terrainData;
            if (!td || !td.heightData || !td.segX || !td.segZ) {
              console.warn("[TerrainPhysics] No terrain data for Rapier heightfield");
              return;
            }
            try {
              // Rapier heightfield: nrows/ncols = cell count (vertices - 1)
              // heights[(nrows+1)*(ncols+1)] indexed as heights[ix + iz*(nrows+1)]
              // Our heightData[iz * segX + ix] is the same order since nrows+1 = segX
              var _rhNrows = td.segX - 1;
              var _rhNcols = td.segZ - 1;
              var _rhHeights = new Float32Array(td.heightData);
              // Scale maps unit cells to world size; heightfield centered at body origin
              var _rhScale = { x: td.width / _rhNrows, y: 1.0, z: td.depth / _rhNcols };
              var _rhColDesc = _tpRAPIER.ColliderDesc.heightfield(_rhNrows, _rhNcols, _rhHeights, _rhScale);
              _rhColDesc.setFriction(0.8);
              var _rhBodyDesc = _tpRAPIER.RigidBodyDesc.fixed();
              var _rhBody = _tpRapierWorld.createRigidBody(_rhBodyDesc);
              var _rhCollider = _tpRapierWorld.createCollider(_rhColDesc, _rhBody);
              window.__vibexe_rapierTerrainBody__ = _rhBody;
              window.__vibexe_rapierTerrainCollider__ = _rhCollider;
              console.log("[TerrainPhysics] Rapier heightfield created:", td.segX, "x", td.segZ,
                "cells:", _rhNrows, "x", _rhNcols,
                "scale:", _rhScale.x.toFixed(3), "/", _rhScale.z.toFixed(3),
                "h-range:", (td.minY || 0).toFixed(1), "-", (td.maxY || 0).toFixed(1));
            } catch(_rhErr) {
              console.warn("[TerrainPhysics] Rapier heightfield failed, trying trimesh fallback:", _rhErr);
              // Fallback: trimesh from mesh geometry (one-sided, less robust)
              try {
                var _rtScene = window.__vibexe_scene__ || (_tpScene);
                var _rtMesh = _rtScene ? _rtScene.getObjectByName("__terrain__") : null;
                if (_rtMesh && _rtMesh.geometry) {
                  var _rtGeo = _rtMesh.geometry;
                  var _rtPos = _rtGeo.attributes.position;
                  var _rtVerts = new Float32Array(_rtPos.count * 3);
                  for (var _vi = 0; _vi < _rtPos.count; _vi++) {
                    _rtVerts[_vi * 3] = _rtPos.getX(_vi);
                    _rtVerts[_vi * 3 + 1] = _rtPos.getY(_vi);
                    _rtVerts[_vi * 3 + 2] = _rtPos.getZ(_vi);
                  }
                  var _rtIdx = _rtGeo.index ? new Uint32Array(_rtGeo.index.array) :
                    new Uint32Array(Array.from({length: _rtPos.count}, function(_, i) { return i; }));
                  var _rtColDesc = _tpRAPIER.ColliderDesc.trimesh(_rtVerts, _rtIdx);
                  _rtColDesc.setFriction(0.8);
                  var _rtBody = _tpRapierWorld.createRigidBody(_tpRAPIER.RigidBodyDesc.fixed());
                  var _rtCollider = _tpRapierWorld.createCollider(_rtColDesc, _rtBody);
                  window.__vibexe_rapierTerrainBody__ = _rtBody;
                  window.__vibexe_rapierTerrainCollider__ = _rtCollider;
                  console.log("[TerrainPhysics] Rapier trimesh fallback:", _rtPos.count, "verts");
                }
              } catch(_tmErr) {
                console.warn("[TerrainPhysics] Both heightfield and trimesh failed:", _tmErr);
              }
            }
            }, 0); // end setTimeout — deferred Rapier operations
          };
          window.__vibexe_rebuildRapierTerrain();

          // === Terrain boundary grid — visual wireframe showing play area edges ===
          // Creates a colored wireframe at terrain boundaries so players/designers can see the play zone.
          // Controlled via window.__vibexe_terrainBoundaryGrid (toggle with game-editor-toggle-boundary-grid)
          (function() {
            var _bgTHREE = window.THREE;
            if (!_bgTHREE) return;
            var _bgScene = (editor && editor.scene) ? editor.scene : window.__vibexe_scene__;
            if (!_bgScene) return;
            // Remove existing boundary grid
            var _oldGrid = _bgScene.getObjectByName("__terrain_boundary_grid__");
            if (_oldGrid) _bgScene.remove(_oldGrid);
            var _bgW = _tpW, _bgD = _tpD;
            var _bgHW = _bgW / 2, _bgHD = _bgD / 2;
            var _bgGroup = new _bgTHREE.Group();
            _bgGroup.name = "__terrain_boundary_grid__";
            // Edge walls — vertical planes at terrain boundaries (cyan, semi-transparent)
            var _wallH = (_tpMaxY || 20) + 5; // Extend above highest terrain point
            var _wallMat = new _bgTHREE.MeshBasicMaterial({
              color: 0x00ffcc, transparent: true, opacity: 0.08,
              side: _bgTHREE.DoubleSide, depthWrite: false
            });
            var _wallLineMat = new _bgTHREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.4 });
            // Four edge walls
            var _walls = [
              { px: 0, pz: -_bgHD, sx: _bgW, sz: 0, ry: 0 },       // -Z edge
              { px: 0, pz: _bgHD, sx: _bgW, sz: 0, ry: 0 },        // +Z edge
              { px: -_bgHW, pz: 0, sx: 0, sz: _bgD, ry: Math.PI/2 }, // -X edge
              { px: _bgHW, pz: 0, sx: 0, sz: _bgD, ry: Math.PI/2 }   // +X edge
            ];
            for (var _wi = 0; _wi < _walls.length; _wi++) {
              var _wDef = _walls[_wi];
              var _wWidth = _wDef.sx || _wDef.sz;
              var _wGeo = new _bgTHREE.PlaneGeometry(_wWidth, _wallH);
              var _wMesh = new _bgTHREE.Mesh(_wGeo, _wallMat);
              _wMesh.position.set(_wDef.px, _wallH / 2, _wDef.pz);
              _wMesh.rotation.y = _wDef.ry;
              _bgGroup.add(_wMesh);
              // Edge line at top of wall
              var _lineGeo = new _bgTHREE.BufferGeometry();
              var _half = _wWidth / 2;
              if (_wDef.ry === 0) {
                // Along X axis
                _lineGeo.setFromPoints([
                  new _bgTHREE.Vector3(_wDef.px - _half, _wallH, _wDef.pz),
                  new _bgTHREE.Vector3(_wDef.px + _half, _wallH, _wDef.pz)
                ]);
              } else {
                // Along Z axis
                _lineGeo.setFromPoints([
                  new _bgTHREE.Vector3(_wDef.px, _wallH, _wDef.pz - _half),
                  new _bgTHREE.Vector3(_wDef.px, _wallH, _wDef.pz + _half)
                ]);
              }
              _bgGroup.add(new _bgTHREE.Line(_lineGeo, _wallLineMat));
            }
            // Ground outline — bright line at terrain edge on the surface
            var _outlineGeo = new _bgTHREE.BufferGeometry();
            var _getH = window.__vibexe_getTerrainHeight;
            // Sample points along each edge to follow terrain contour
            var _outlinePts = [];
            var _edgeSamples = 80;
            // -Z edge (x from -HW to +HW)
            for (var _ei = 0; _ei <= _edgeSamples; _ei++) {
              var _ex = -_bgHW + (_ei / _edgeSamples) * _bgW;
              var _eh = _getH ? (_getH(_ex, -_bgHD) || 0) : 0;
              _outlinePts.push(new _bgTHREE.Vector3(_ex, _eh + 0.3, -_bgHD));
            }
            // +X edge (z from -HD to +HD)
            for (var _ei2 = 0; _ei2 <= _edgeSamples; _ei2++) {
              var _ez = -_bgHD + (_ei2 / _edgeSamples) * _bgD;
              var _eh2 = _getH ? (_getH(_bgHW, _ez) || 0) : 0;
              _outlinePts.push(new _bgTHREE.Vector3(_bgHW, _eh2 + 0.3, _ez));
            }
            // +Z edge (x from +HW to -HW)
            for (var _ei3 = _edgeSamples; _ei3 >= 0; _ei3--) {
              var _ex3 = -_bgHW + (_ei3 / _edgeSamples) * _bgW;
              var _eh3 = _getH ? (_getH(_ex3, _bgHD) || 0) : 0;
              _outlinePts.push(new _bgTHREE.Vector3(_ex3, _eh3 + 0.3, _bgHD));
            }
            // -X edge (z from +HD to -HD)
            for (var _ei4 = _edgeSamples; _ei4 >= 0; _ei4--) {
              var _ez4 = -_bgHD + (_ei4 / _edgeSamples) * _bgD;
              var _eh4 = _getH ? (_getH(-_bgHW, _ez4) || 0) : 0;
              _outlinePts.push(new _bgTHREE.Vector3(-_bgHW, _eh4 + 0.3, _ez4));
            }
            _outlineGeo.setFromPoints(_outlinePts);
            var _outlineMat = new _bgTHREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
            _bgGroup.add(new _bgTHREE.LineLoop(_outlineGeo, _outlineMat));
            // Ground grid lines inside terrain (subtle, shows terrain subdivisions at boundary)
            var _gridLineMat = new _bgTHREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.15 });
            var _gridSpacing = Math.max(_bgW, _bgD) / 10; // 10 grid lines
            // X-parallel lines
            for (var _gx = -_bgHW; _gx <= _bgHW + 0.01; _gx += _gridSpacing) {
              var _gPts = [];
              for (var _gs = 0; _gs <= 20; _gs++) {
                var _gz = -_bgHD + (_gs / 20) * _bgD;
                var _gh = _getH ? (_getH(_gx, _gz) || 0) : 0;
                _gPts.push(new _bgTHREE.Vector3(_gx, _gh + 0.2, _gz));
              }
              var _gGeo = new _bgTHREE.BufferGeometry().setFromPoints(_gPts);
              _bgGroup.add(new _bgTHREE.Line(_gGeo, _gridLineMat));
            }
            // Z-parallel lines
            for (var _gz2 = -_bgHD; _gz2 <= _bgHD + 0.01; _gz2 += _gridSpacing) {
              var _gPts2 = [];
              for (var _gs2 = 0; _gs2 <= 20; _gs2++) {
                var _gx2 = -_bgHW + (_gs2 / 20) * _bgW;
                var _gh2 = _getH ? (_getH(_gx2, _gz2) || 0) : 0;
                _gPts2.push(new _bgTHREE.Vector3(_gx2, _gh2 + 0.2, _gz2));
              }
              var _gGeo2 = new _bgTHREE.BufferGeometry().setFromPoints(_gPts2);
              _bgGroup.add(new _bgTHREE.Line(_gGeo2, _gridLineMat));
            }
            _bgGroup.visible = false; // Hidden by default, toggled via message
            _bgScene.add(_bgGroup);
            window.__vibexe_terrainBoundaryGrid = _bgGroup;
          })();

          // === PostStep terrain clamp — belt-and-suspenders safety net ===
          // Ensures all dynamic bodies stay above terrain even if Heightfield collision fails
          if (!window.__vibexe_terrainPostStep) {
            window.__vibexe_terrainPostStep = function() {
              var getH = window.__vibexe_getTerrainHeight;
              var w = window.__vibexe_world__;
              if (!getH || !w) return;
              for (var pi = 0; pi < w.bodies.length; pi++) {
                var pb = w.bodies[pi];
                if (pb.mass <= 0) continue; // Skip static bodies
                var th = getH(pb.position.x, pb.position.z);
                if (th == null) continue;
                // Use body's shape half-height if available, else default 0.75
                var halfH = 0.75;
                if (pb.shapes && pb.shapes[0]) {
                  var _sh = pb.shapes[0];
                  if (_sh.halfExtents) halfH = _sh.halfExtents.y;
                  else if (_sh.radius) halfH = _sh.radius;
                }
                var minY = th + halfH;
                if (pb.position.y < minY) {
                  pb.position.y = minY;
                  if (pb.velocity.y < 0) pb.velocity.y = 0;
                  pb.__canJump = true;
                }
              }
            };
            _tpWorld.addEventListener("postStep", window.__vibexe_terrainPostStep);
            console.log("[TerrainPhysics] PostStep terrain clamp registered");
          }
        } else {
          // World not ready yet — set up a watcher to create heightfield when world appears
          console.warn("[TerrainPhysics] World not ready — will create heightfield when physics starts");
          if (!window.__vibexe_terrainPhysicsWatcher) {
            window.__vibexe_terrainPhysicsWatcher = setInterval(function() {
              var dCANNON = window.CANNON;
              var dWorld = window.__vibexe_world__;
              var dTD = window.__vibexe_terrainData;
              if (dCANNON && dWorld && dTD && !window.__vibexe_terrainBody) {
                clearInterval(window.__vibexe_terrainPhysicsWatcher);
                window.__vibexe_terrainPhysicsWatcher = null;
                // Disable ground plane
                for (var dbi = 0; dbi < dWorld.bodies.length; dbi++) {
                  var dgp = dWorld.bodies[dbi];
                  if (dgp.mass === 0 && dgp.shapes && dgp.shapes[0] instanceof dCANNON.Plane) {
                    dgp.position.set(0, -10000, 0);
                    dgp.updateMassProperties();
                    window.__vibexe_groundPlaneBody = dgp;
                    console.log("[TerrainPhysics] Deferred: disabled ground plane");
                    break;
                  }
                }
                // Build heightfield
                var dm = [];
                for (var dx = 0; dx < dTD.segX; dx++) {
                  dm.push([]);
                  for (var dz = 0; dz < dTD.segZ; dz++) {
                    dm[dx].push(dTD.heightData[(dTD.segZ - 1 - dz) * dTD.segX + dx]);
                  }
                }
                var dES = dTD.width / (dTD.segX - 1);
                try {
                  var dShape = new dCANNON.Heightfield(dm, { elementSize: dES });
                  var dBody = new dCANNON.Body({ mass: 0, type: dCANNON.Body.STATIC });
                  dBody.addShape(dShape);
                  dBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
                  dBody.position.set(-dTD.width / 2, 0, dTD.depth / 2);
                  dWorld.addBody(dBody);
                  window.__vibexe_terrainBody = dBody;
                  window.__vibexe_terrainHFShape = dShape;
                  console.log("[TerrainPhysics] Deferred heightfield created successfully");
                } catch(de) {
                  console.error("[TerrainPhysics] Deferred heightfield creation failed:", de);
                }
                // Deferred postStep clamp
                if (!window.__vibexe_terrainPostStep) {
                  window.__vibexe_terrainPostStep = function() {
                    var getH = window.__vibexe_getTerrainHeight;
                    var w2 = window.__vibexe_world__;
                    if (!getH || !w2) return;
                    for (var pi2 = 0; pi2 < w2.bodies.length; pi2++) {
                      var pb2 = w2.bodies[pi2];
                      if (pb2.mass <= 0) continue;
                      var th2 = getH(pb2.position.x, pb2.position.z);
                      if (th2 == null) continue;
                      var hH2 = 0.75;
                      if (pb2.shapes && pb2.shapes[0]) {
                        var _sh2 = pb2.shapes[0];
                        if (_sh2.halfExtents) hH2 = _sh2.halfExtents.y;
                        else if (_sh2.radius) hH2 = _sh2.radius;
                      }
                      if (pb2.position.y < th2 + hH2) {
                        pb2.position.y = th2 + hH2;
                        if (pb2.velocity.y < 0) pb2.velocity.y = 0;
                        pb2.__canJump = true;
                      }
                    }
                  };
                  dWorld.addEventListener("postStep", window.__vibexe_terrainPostStep);
                  console.log("[TerrainPhysics] Deferred postStep clamp registered");
                }
              }
            }, 200);
          }
        }

        if (editor) sendSceneTreeThrottled();

        console.log("[TerrainPainter] Terrain generated:", _tpPos.count, "vertices, height range:", _tpMinY.toFixed(1), "-", _tpMaxY.toFixed(1));

          // Create boundary grid for terrain visualization — sized to actual terrain bounds
          try {
            var _bgOld = window.__vibexe_terrainBoundaryGrid;
            if (_bgOld && _bgOld.parent) _bgOld.parent.remove(_bgOld);
            // Also remove by name in case reference was lost
            var _bgByName = _tpScene.getObjectByName("__terrain_boundary_grid__");
            if (_bgByName) { _tpScene.remove(_bgByName); }
            var _bgBoxH = Math.max((_tpMaxY - _tpMinY) + 2, 2); // Height of boundary box = terrain height range + margin
            var _bgEdges = new _tpTHREE.EdgesGeometry(new _tpTHREE.BoxGeometry(_tpW, _bgBoxH, _tpD));
            var _bgMat = new _tpTHREE.LineBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.5 });
            var _bgMesh = new _tpTHREE.LineSegments(_bgEdges, _bgMat);
            _bgMesh.position.set(0, _tpMinY + _bgBoxH / 2, 0); // Center vertically around terrain height range
            _bgMesh.name = "__terrain_boundary_grid__";
            _bgMesh.visible = false;
            _tpScene.add(_bgMesh);
            window.__vibexe_terrainBoundaryGrid = _bgMesh;
          } catch(e) { console.warn("[TerrainPainter] Boundary grid failed:", e); }

        window.parent.postMessage({ type: "terrain-painter-terrain-generated", vertexCount: _tpPos.count, minY: _tpMinY, maxY: _tpMaxY }, "*");

        // Auto-export heightmap to parent for DB persistence — ensures terrain shape
        // survives page reload without requiring Scene→Game transition.
        // ONLY export if no sculptHeightData was already provided (fresh generation).
        // If sculptHeightData was provided, the restore code already applied it and
        // we must NOT overwrite it with the regenerated terrain data.
        var _aeHasSculpt = _tpS.sculptHeightData && typeof _tpS.sculptHeightData === "string" && _tpS.sculptHeightData.length > 0;
        if (!_aeHasSculpt) {
        setTimeout(function() {
          try {
            var _aeData = window.__vibexe_terrainData;
            if (_aeData && _aeData.heightData && _aeData.heightData.length > 0) {
              var _aeBytes = new Uint8Array(_aeData.heightData.buffer);
              var _aeStr = "";
              for (var _aei = 0; _aei < _aeBytes.length; _aei++) _aeStr += String.fromCharCode(_aeBytes[_aei]);
              var _aeB64 = btoa(_aeStr);
              window.parent.postMessage({
                type: "terrain-heightmap-data",
                data: _aeB64,
                vertexCount: _aeData.heightData.length
              }, "*");
              console.log("[TerrainPainter] Auto-exported heightmap:", _aeData.heightData.length, "vertices");
            }
          } catch(e) { console.warn("[TerrainPainter] Auto-export failed:", e); }
        }, 1500);
        }
        break;
      }

      case "terrain-painter-repaint": {
        // BUG 7 fix: prevent double repaint
        if (window.__vibexe_terrainRepaintInProgress) {
          console.log("[TerrainPainter] REPAINT SKIPPED — already in progress");
          break;
        }
        window.__vibexe_terrainRepaintInProgress = true;
        var _rpScene = (editor && editor.scene) ? editor.scene : window.__vibexe_scene__;
        console.log("[TerrainPainter] REPAINT CASE HIT. editor=", !!editor, "scene=", !!_rpScene);
        var _rpTHREE = window.THREE;
        if (!_rpTHREE || !_rpScene) { console.log("[TerrainPainter] REPAINT ABORT: missing deps"); break; }
        var _rpTerrain = _rpScene.getObjectByName("__terrain__");
        if (!_rpTerrain || !_rpTerrain.geometry) { console.warn("[TerrainPainter] No terrain found for repaint"); break; }

        var _rpLayers = d.layers || [];
        var _rpGeo = _rpTerrain.geometry;
        var _rpHAttr = _rpGeo.attributes.terrainHeight;
        var _rpSAttr = _rpGeo.attributes.terrainSlope;
        if (!_rpHAttr || !_rpSAttr) { console.warn("[TerrainPainter] Terrain missing height/slope attributes"); break; }

        var _rpCount = _rpHAttr.count;
        var _rpEnabledLayers = _rpLayers.filter(function(l) { return l.enabled; });
        var _rpNumLayers = Math.min(_rpEnabledLayers.length, 8); // max 8 with vec4 weight packing

        console.log("[TerrainPainter] Repainting with", _rpNumLayers, "enabled layers");

        // Smoothstep helper
        function _rpSmoothstep(e0, e1, x) {
          var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 0.001)));
          return t * t * (3 - 2 * t);
        }

        // Compute per-vertex weights for each layer
        var _rpWeights = [];
        for (var li = 0; li < _rpNumLayers; li++) _rpWeights.push(new Float32Array(_rpCount));

        var _rpPos = _rpGeo.attributes.position;
        var _rpMinY = _rpTerrain.userData.__terrainMinY || 0;
        var _rpMaxY = _rpTerrain.userData.__terrainMaxY || 1;
        var _rpRange = _rpMaxY - _rpMinY || 1;

        for (var vi = 0; vi < _rpCount; vi++) {
          var vHeight = _rpHAttr.getX(vi); // 0-1 normalized
          var vSlope = _rpSAttr.getX(vi);  // 0-90 degrees
          var vx = _rpPos.getX(vi);
          var vz = _rpPos.getZ(vi);

          for (var li2 = 0; li2 < _rpNumLayers; li2++) {
            var layer = _rpEnabledLayers[li2];
            var weight = 1.0;

            for (var mi = 0; mi < layer.modifiers.length; mi++) {
              var mod = layer.modifiers[mi];
              if (!mod.enabled) continue;
              var mask = 1.0;
              var p = mod.params || {};
              var opacity = (mod.opacity != null ? mod.opacity : 100) / 100;

              if (mod.type === "Height") {
                // Height modifier — min/max are in normalized 0-1 range, vHeight is also 0-1
                var hMin = p.min != null ? p.min : 0;
                var hMax = p.max != null ? p.max : 1;
                var hMinF = p.minFalloff != null ? p.minFalloff : 0.05;
                var hMaxF = p.maxFalloff != null ? p.maxFalloff : 0.05;
                mask = _rpSmoothstep(hMin - hMinF, hMin, vHeight) * (1.0 - _rpSmoothstep(hMax, hMax + hMaxF, vHeight));
              } else if (mod.type === "Slope") {
                var sMin = p.minAngle || 0;
                var sMax = p.maxAngle || 90;
                var sMinF = p.minFalloff || 10;
                var sMaxF = p.maxFalloff || 10;
                mask = _rpSmoothstep(sMin - sMinF, sMin, vSlope) * (1.0 - _rpSmoothstep(sMax, sMax + sMaxF, vSlope));
              } else if (mod.type === "Noise") {
                var nScale = (p.noiseScale || 50) * 0.01;
                var nOx = p.noiseOffsetX || 0;
                var nOy = p.noiseOffsetY || 0;
                var nVal = (_tpNoise2D((vx + nOx) * nScale, (vz + nOy) * nScale) + 1) * 0.5; // 0-1
                var nMin = p.levelMin != null ? p.levelMin : 0;
                var nMax = p.levelMax != null ? p.levelMax : 1;
                mask = _rpSmoothstep(nMin, nMax, nVal);
              } else if (mod.type === "Curvature") {
                // Compute discrete Laplacian curvature from neighbors
                var _segX3 = Math.sqrt(_rpGeo.attributes.position.count);
                var col3 = vi % _segX3;
                var row3 = Math.floor(vi / _segX3);
                var cH = _rpGeo.attributes.position.getY(vi);
                var cSum = 0, cCount = 0;
                var neighbors = [
                  [col3-1, row3], [col3+1, row3], [col3, row3-1], [col3, row3+1],
                  [col3-1, row3-1], [col3+1, row3-1], [col3-1, row3+1], [col3+1, row3+1]
                ];
                for (var ni = 0; ni < neighbors.length; ni++) {
                  var nc = neighbors[ni][0], nr = neighbors[ni][1];
                  if (nc >= 0 && nc < _segX3 && nr >= 0 && nr < _segX3) {
                    cSum += _rpGeo.attributes.position.getY(nr * _segX3 + nc);
                    cCount++;
                  }
                }
                if (cCount > 0) {
                  var avgNeighbor = cSum / cCount;
                  var curvature = (cH - avgNeighbor) / (p.radius || 1.0);
                  // Normalize to 0-1 range
                  var cMin = p.minCurvature != null ? p.minCurvature : -0.5;
                  var cMax = p.maxCurvature != null ? p.maxCurvature : 0.5;
                  var cMinF = p.minFalloff || 0.1;
                  var cMaxF = p.maxFalloff || 0.1;
                  // Soft mode: use signed curvature (positive=convex/peaks, negative=concave/valleys)
                  mask = _rpSmoothstep(cMin - cMinF, cMin, curvature) * (1.0 - _rpSmoothstep(cMax, cMax + cMaxF, curvature));
                } else {
                  mask = 0.5;
                }
              } else if (mod.type === "Direction") {
                var nx2 = _rpGeo.attributes.normal ? _rpGeo.attributes.normal.getX(vi) : 0;
                var nz2 = _rpGeo.attributes.normal ? _rpGeo.attributes.normal.getZ(vi) : 0;
                var dirAngle = Math.atan2(nz2, nx2) * (180 / Math.PI);
                var targetAngle = p.xAngle || 45;
                var diff = Math.abs(((dirAngle - targetAngle + 180) % 360) - 180);
                var dMin = p.levelMin || 0;
                var dMax = p.levelMax || 1;
                mask = 1.0 - _rpSmoothstep(0, 90, diff);
                mask = dMin + mask * (dMax - dMin);
              }

              mask *= opacity;

              // Apply blend mode
              if (mod.blendMode === "Multiply") { weight *= mask; }
              else if (mod.blendMode === "Add") { weight = Math.min(1, weight + mask); }
              else if (mod.blendMode === "Subtract") { weight = Math.max(0, weight - mask); }
              else if (mod.blendMode === "Min") { weight = Math.min(weight, mask); }
              else if (mod.blendMode === "Max") { weight = Math.max(weight, mask); }
            }

            // Layers with no active modifiers AND index > 0 are paint-only (weight=0)
            // Layer 0 always keeps weight=1 as the base layer
            var _hasActiveMod = false;
            for (var _ami = 0; _ami < layer.modifiers.length; _ami++) {
              if (layer.modifiers[_ami].enabled) { _hasActiveMod = true; break; }
            }
            if (!_hasActiveMod && li2 > 0) weight = 0;
            _rpWeights[li2][vi] = Math.max(0, Math.min(1, weight));
          }
        }

        // Normalize weights per vertex so they sum to 1
        // When ALL weights are zero (unpainted vertex), default to layer 0 (base layer).
        // Without this, the height-depth blending degrades to an equal mix of all
        // textures — creating a washed-out averaged appearance on 60%+ of the terrain.
        for (var vi3 = 0; vi3 < _rpCount; vi3++) {
          var wSum = 0;
          for (var li3 = 0; li3 < _rpNumLayers; li3++) wSum += _rpWeights[li3][vi3];
          if (wSum > 0.001) {
            for (var li4 = 0; li4 < _rpNumLayers; li4++) _rpWeights[li4][vi3] /= wSum;
          } else if (_rpNumLayers > 0) {
            // Unpainted vertex — assign 100% to base layer (layer 0)
            _rpWeights[0][vi3] = 1.0;
          }
        }

        // Collect texture URLs from enabled layers
        var _rpTexUrls = [];
        var _rpNormalUrls = [];
        var _rpRoughnessUrls = [];
        var _rpAOUrls = [];
        for (var li5 = 0; li5 < _rpNumLayers; li5++) {
          var _diffUrl = _rpEnabledLayers[li5].diffuseUrl || "";
          // If diffuse is same as emission (e.g. Lava), skip diffuse — use preview color as base
          var _emUrl5 = _rpEnabledLayers[li5].emissionUrl || "";
          if (_emUrl5 && _diffUrl && _diffUrl === _emUrl5) _diffUrl = "";
          _rpTexUrls.push(_diffUrl);
          // Auto-derive normal map URL: Ground037.jpg → Ground037_Normal.jpg
          var _normUrl = _rpEnabledLayers[li5].normalUrl || "";
          if (!_normUrl && _diffUrl) {
            _normUrl = _diffUrl.replace(/\\.jpg$/i, "_Normal.jpg");
          }
          _rpNormalUrls.push(_normUrl);
          // Auto-derive roughness map URL: Ground037.jpg → Ground037_Roughness.jpg
          var _roughUrl = _rpEnabledLayers[li5].roughnessUrl || "";
          if (!_roughUrl && _diffUrl) {
            _roughUrl = _diffUrl.replace(/\\.jpg$/i, "_Roughness.jpg");
          }
          _rpRoughnessUrls.push(_roughUrl);
          // AO map URL — OR emission map URL for emissive layers (reuses AO slot)
          var _layerEmissionUrl = _rpEnabledLayers[li5].emissionUrl || "";
          var _layerEmissionIntensity = _rpEnabledLayers[li5].emissionIntensity || 0;
          var _aoUrl;
          if (_layerEmissionUrl && _layerEmissionIntensity > 0) {
            // Emissive layer: load emission texture into AO slot
            _aoUrl = _layerEmissionUrl;
          } else {
            _aoUrl = _rpEnabledLayers[li5].aoUrl || "";
            // Don't auto-derive AO URLs — no _AO files exist in the texture library
          }
          _rpAOUrls.push(_aoUrl);
        }

        // Layer preview colors (fallback when no texture)
        var _rpColors = [];
        for (var li6 = 0; li6 < _rpNumLayers; li6++) {
          var pc = _rpEnabledLayers[li6].previewColor || "#808080";
          var cr = parseInt(pc.slice(1,3), 16)/255;
          var cg = parseInt(pc.slice(3,5), 16)/255;
          var cb = parseInt(pc.slice(5,7), 16)/255;
          _rpColors.push([cr, cg, cb]);
        }

        // Check if any layers have real texture URLs
        var _rpHasTextures = _rpTexUrls.some(function(u) { return u && u.length > 5; });

        if (_rpHasTextures) {
          // Load textures (diffuse + normal maps) and create PBR ShaderMaterial
          var _rpLoader = new _rpTHREE.TextureLoader();
          var _rpTextures = new Array(_rpNumLayers);
          var _rpNormalTextures = new Array(_rpNumLayers);
          var _rpRoughnessTextures = new Array(_rpNumLayers);
          var _rpAOTextures = new Array(_rpNumLayers);
          var _rpLoaded = 0;
          // Count ALL entries (4 types × N layers) so empty URLs don't cause early trigger
          var _rpTotal = _rpNumLayers * 4; // diffuse + normal + roughness + AO per layer
          if (_rpTotal === 0) _rpTotal = 1; // avoid /0
          // Debounce: batch multiple texture completions into single TSL material rebuild
          // (each rebuild triggers WGSL shader compilation on WebGPU — VERY expensive)
          var _rpApplyScheduled = false;
          function _rpScheduleApply() {
            if (_rpApplyScheduled) return;
            _rpApplyScheduled = true;
            requestAnimationFrame(function() {
              _rpApplyScheduled = false;
              _rpApplyShaderMaterial();
            });
          }

          function _rpApplyShaderMaterial() {
            // Pack weights into vertex attributes
            // Pack weights into 2 vec4 attributes (weightsA = layers 0-3, weightsB = layers 4-7)
            // Using vec4 instead of 4+ separate float attributes avoids WebGPU buffer limit
            var _wA = new Float32Array(_rpCount * 4);
            var _wB = new Float32Array(_rpCount * 4);
            for (var v = 0; v < _rpCount; v++) {
              _wA[v * 4]     = _rpNumLayers > 0 ? _rpWeights[0][v] : 0;
              _wA[v * 4 + 1] = _rpNumLayers > 1 ? _rpWeights[1][v] : 0;
              _wA[v * 4 + 2] = _rpNumLayers > 2 ? _rpWeights[2][v] : 0;
              _wA[v * 4 + 3] = _rpNumLayers > 3 ? _rpWeights[3][v] : 0;
              _wB[v * 4]     = _rpNumLayers > 4 ? _rpWeights[4][v] : 0;
              _wB[v * 4 + 1] = _rpNumLayers > 5 ? _rpWeights[5][v] : 0;
              _wB[v * 4 + 2] = _rpNumLayers > 6 ? _rpWeights[6][v] : 0;
              _wB[v * 4 + 3] = _rpNumLayers > 7 ? _rpWeights[7][v] : 0;
            }
            _rpGeo.setAttribute("weightsA", new _rpTHREE.BufferAttribute(_wA, 4));
            _rpGeo.setAttribute("weightsB", new _rpTHREE.BufferAttribute(_wB, 4));

            // Generate per-layer uniforms dynamically (supports up to 8 layers)
            var _rpUniforms = {
              uNumLayers: { value: _rpNumLayers },
              uFogColor: { value: new _rpTHREE.Vector3(0.62, 0.68, 0.80) },
              uFogFar: { value: 300.0 },
              uFogMaxAmt: { value: 0.5 }
            };
            for (var _ui = 0; _ui < 8; _ui++) {
              _rpUniforms["uTex" + _ui] = { value: _rpTextures[_ui] || null };
              _rpUniforms["uNormal" + _ui] = { value: _rpNormalTextures[_ui] || null };
              _rpUniforms["uHasTex" + _ui] = { value: _rpTextures[_ui] ? 1.0 : 0.0 };
              _rpUniforms["uHasNormal" + _ui] = { value: _rpNormalTextures[_ui] ? 1.0 : 0.0 };
              _rpUniforms["uRoughMap" + _ui] = { value: _rpRoughnessTextures[_ui] || null };
              _rpUniforms["uHasRoughMap" + _ui] = { value: _rpRoughnessTextures[_ui] ? 1.0 : 0.0 };
              _rpUniforms["uAOMap" + _ui] = { value: _rpAOTextures[_ui] || null };
              _rpUniforms["uHasAOMap" + _ui] = { value: _rpAOTextures[_ui] ? 1.0 : 0.0 };
              _rpUniforms["uIsEmissive" + _ui] = { value: 0.0 };
              _rpUniforms["uEmissionIntensity" + _ui] = { value: 0.0 };
              var _cc = _rpColors[_ui];
              _rpUniforms["uColor" + _ui] = { value: new _rpTHREE.Vector3(_cc ? _cc[0] : 0.5, _cc ? _cc[1] : 0.5, _cc ? _cc[2] : 0.5) };
              _rpUniforms["uTexScale" + _ui] = { value: 50.0 };
              _rpUniforms["uRoughness" + _ui] = { value: 0.8 };
              _rpUniforms["uNormalIntensity" + _ui] = { value: 1.0 };
              _rpUniforms["uMetallic" + _ui] = { value: 0.0 };
              _rpUniforms["uOpacity" + _ui] = { value: 1.0 };
            }

            // Compute per-layer texture scales and read PBR params from layer data
            var _rpTerrainW = _rpTerrain.userData.__terrainWidth || 200;
            for (var tsi = 0; tsi < _rpNumLayers; tsi++) {
              var tileSize = _rpEnabledLayers[tsi].tileSize || 4;
              var scale = _rpTerrainW / tileSize;
              _rpUniforms["uTexScale" + tsi].value = scale;
              if (_rpEnabledLayers[tsi].roughness != null) _rpUniforms["uRoughness" + tsi].value = _rpEnabledLayers[tsi].roughness;
              if (_rpEnabledLayers[tsi].normalIntensity != null) _rpUniforms["uNormalIntensity" + tsi].value = _rpEnabledLayers[tsi].normalIntensity;
              if (_rpEnabledLayers[tsi].metallic) _rpUniforms["uMetallic" + tsi].value = 1.0;
              var layerOpacity = _rpEnabledLayers[tsi].opacity != null ? _rpEnabledLayers[tsi].opacity / 100 : 1.0;
              _rpUniforms["uOpacity" + tsi].value = layerOpacity;
              // Emission support — reuses AO texture slot for emissive layers
              if (_rpEnabledLayers[tsi].emissionUrl && _rpEnabledLayers[tsi].emissionIntensity > 0) {
                _rpUniforms["uIsEmissive" + tsi].value = 1.0;
                _rpUniforms["uEmissionIntensity" + tsi].value = _rpEnabledLayers[tsi].emissionIntensity || 1.0;
              }
            }

            var _rpVertShader = [
              "attribute vec4 weightsA;",
              "attribute float terrainHeight;",
              "varying vec2 vUv;",
              "varying vec3 vNormal;",
              "varying vec3 vWorldPos;",
              "varying float vW0;",
              "varying float vW1;",
              "varying float vW2;",
              "varying float vW3;",
              "varying float vHeight;",
              "void main() {",
              "  vUv = uv;",
              "  vNormal = normalize(mat3(modelMatrix) * normal);",
              "  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;",
              "  vHeight = terrainHeight;",
              "  vW0 = weightsA.x; vW1 = weightsA.y; vW2 = weightsA.z; vW3 = weightsA.w;",
              "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
              "}"
            ].join("\\n");

            var _rpFragShader = [
              "precision highp float;",
              "",
              "uniform sampler2D uTex0, uTex1, uTex2, uTex3;",
              "uniform sampler2D uNormal0, uNormal1, uNormal2, uNormal3;",
              "uniform sampler2D uRoughMap0, uRoughMap1, uRoughMap2, uRoughMap3;",
              "uniform sampler2D uAOMap0, uAOMap1, uAOMap2, uAOMap3;",
              "uniform vec3 uColor0, uColor1, uColor2, uColor3;",
              "uniform int uNumLayers;",
              "uniform float uHasTex0, uHasTex1, uHasTex2, uHasTex3;",
              "uniform float uHasNormal0, uHasNormal1, uHasNormal2, uHasNormal3;",
              "uniform float uHasRoughMap0, uHasRoughMap1, uHasRoughMap2, uHasRoughMap3;",
              "uniform float uHasAOMap0, uHasAOMap1, uHasAOMap2, uHasAOMap3;",
              "uniform float uIsEmissive0, uIsEmissive1, uIsEmissive2, uIsEmissive3;",
              "uniform float uEmissionIntensity0, uEmissionIntensity1, uEmissionIntensity2, uEmissionIntensity3;",
              "uniform float uTexScale0, uTexScale1, uTexScale2, uTexScale3;",
              "uniform float uRoughness0, uRoughness1, uRoughness2, uRoughness3;",
              "uniform float uNormalIntensity0, uNormalIntensity1, uNormalIntensity2, uNormalIntensity3;",
              "uniform float uMetallic0, uMetallic1, uMetallic2, uMetallic3;",
              "uniform float uOpacity0, uOpacity1, uOpacity2, uOpacity3;",
              "uniform vec3 uFogColor;",
              "uniform float uFogFar, uFogMaxAmt;",
              "",
              "varying vec2 vUv;",
              "varying vec3 vNormal;",
              "varying vec3 vWorldPos;",
              "varying float vW0, vW1, vW2, vW3;",
              "varying float vHeight;",
              "",
              "// Hash for anti-tiling (Inigo Quilez technique)",
              "float hash21(vec2 p) {",
              "  p = fract(p * vec2(123.34, 456.21));",
              "  p += dot(p, p + 45.32);",
              "  return fract(p.x * p.y);",
              "}",
              "",
              "// Procedural detail noise — adds micro variation at close range",
              "float detailNoise(vec2 p) {",
              "  vec2 i = floor(p);",
              "  vec2 f = fract(p);",
              "  f = f * f * (3.0 - 2.0 * f);",
              "  float a = hash21(i);",
              "  float b = hash21(i + vec2(1.0, 0.0));",
              "  float c = hash21(i + vec2(0.0, 1.0));",
              "  float d = hash21(i + vec2(1.0, 1.0));",
              "  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);",
              "}",
              "",
              "// Triplanar blend weights from world-space normal",
              "vec3 triplanarBlend(vec3 n) {",
              "  vec3 b = abs(n);",
              "  b = max(b - 0.2, 0.0);",
              "  b = pow(b, vec3(4.0));",
              "  return b / (b.x + b.y + b.z + 0.001);",
              "}",
              "",
              "// Sample texture with triplanar + anti-tiling",
              "vec3 sampleTerrain(sampler2D tex, vec3 wp, vec2 uv, vec3 N, float scale, float hasTex, vec3 fallbackColor) {",
              "  if (hasTex < 0.5) return fallbackColor;",
              "  float steepness = 1.0 - abs(N.y);",
              "  if (steepness > 0.85) {",
              "    vec3 bl = triplanarBlend(N);",
              "    vec3 xSamp = texture2D(tex, wp.yz * scale * 0.01).rgb;",
              "    vec3 ySamp = texture2D(tex, wp.xz * scale * 0.01).rgb;",
              "    vec3 zSamp = texture2D(tex, wp.xy * scale * 0.01).rgb;",
              "    return xSamp * bl.x + ySamp * bl.y + zSamp * bl.z;",
              "  }",
              "  // Single-sample UV mapping (anti-tiling removed for perf — saves 1 texture fetch per layer)",
              "  vec2 suv = uv * scale;",
              "  return texture2D(tex, suv).rgb;",
              "}",
              "",
              "// Sample single-channel map (for roughness)",
              "float sampleTerrainR(sampler2D tex, vec3 wp, vec2 uv, vec3 N, float scale, float hasMap, float fallback) {",
              "  if (hasMap < 0.5) return fallback;",
              "  float steepness = 1.0 - abs(N.y);",
              "  if (steepness > 0.85) {",
              "    vec3 bl = triplanarBlend(N);",
              "    float xS = texture2D(tex, wp.yz * scale * 0.01).r;",
              "    float yS = texture2D(tex, wp.xz * scale * 0.01).r;",
              "    float zS = texture2D(tex, wp.xy * scale * 0.01).r;",
              "    return xS * bl.x + yS * bl.y + zS * bl.z;",
              "  }",
              "  return texture2D(tex, uv * scale).r;",
              "}",
              "",
              "// Sample normal map (returns tangent-space normal)",
              "vec3 sampleNormalMap(sampler2D nmap, vec2 uv, float scale, float hasNorm, float intensity) {",
              "  if (hasNorm < 0.5) return vec3(0.0, 0.0, 1.0);",
              "  vec3 n = texture2D(nmap, uv * scale).rgb * 2.0 - 1.0;",
              "  n.xy *= intensity;",
              "  return normalize(n);",
              "}",
              "",
              "// Perturb normal using screen-space derivatives (no tangent attribute needed)",
              "vec3 perturbNormal(vec3 N, vec3 wp, vec2 uv, vec3 mapN) {",
              "  vec3 q0 = dFdx(wp);",
              "  vec3 q1 = dFdy(wp);",
              "  vec2 st0 = dFdx(uv);",
              "  vec2 st1 = dFdy(uv);",
              "  float det = st0.x * st1.y - st0.y * st1.x;",
              "  if (abs(det) < 0.0001) return N;",
              "  vec3 T = normalize(q0 * st1.y - q1 * st0.y);",
              "  vec3 B = normalize(cross(N, T));",
              "  return normalize(T * mapN.x + B * mapN.y + N * mapN.z);",
              "}",
              "",
              "// GGX/Trowbridge-Reitz normal distribution",
              "float distributionGGX(float NdotH, float roughness) {",
              "  float a = roughness * roughness;",
              "  float a2 = a * a;",
              "  float d = NdotH * NdotH * (a2 - 1.0) + 1.0;",
              "  return a2 / (3.14159 * d * d + 0.0001);",
              "}",
              "",
              "// Smith's Schlick-GGX geometry function",
              "float geometrySmith(float NdotV, float NdotL, float roughness) {",
              "  float r = roughness + 1.0;",
              "  float k = r * r / 8.0;",
              "  float g1 = NdotV / (NdotV * (1.0 - k) + k);",
              "  float g2 = NdotL / (NdotL * (1.0 - k) + k);",
              "  return g1 * g2;",
              "}",
              "",
              "// Fresnel-Schlick approximation",
              "vec3 fresnelSchlick(float cosTheta, vec3 F0) {",
              "  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);",
              "}",
              "",
              "void main() {",
              "  vec3 N = normalize(vNormal);",
              "  vec3 V = normalize(cameraPosition - vWorldPos);",
              "  vec2 baseUv = vUv;",
              "  float camDist = length(vWorldPos - cameraPosition);",
              "",
              "  // === SHADER LOD: distance-based quality reduction ===",
              "  // Near (<40): full PBR with all maps",
              "  // Mid (40-80): skip AO maps, simplified roughness",
              "  // Far (>80): skip normals, use uniform roughness, simplified lighting",
              "  float lodNear = smoothstep(20.0, 35.0, camDist);",
              "  float lodFar = smoothstep(40.0, 60.0, camDist);",
              "",
              "  // Sample each layer diffuse (always needed)",
              "  vec3 c0 = (uNumLayers > 0) ? sampleTerrain(uTex0, vWorldPos, baseUv, N, uTexScale0, uHasTex0, uColor0) : vec3(0.5);",
              "  vec3 c1 = (uNumLayers > 1) ? sampleTerrain(uTex1, vWorldPos, baseUv, N, uTexScale1, uHasTex1, uColor1) : vec3(0.5);",
              "  vec3 c2 = (uNumLayers > 2) ? sampleTerrain(uTex2, vWorldPos, baseUv, N, uTexScale2, uHasTex2, uColor2) : vec3(0.5);",
              "  vec3 c3 = (uNumLayers > 3) ? sampleTerrain(uTex3, vWorldPos, baseUv, N, uTexScale3, uHasTex3, uColor3) : vec3(0.5);",
              "",
              "  // Roughness: skip map sampling beyond 55 units (saves 4 texture fetches)",
              "  float r0, r1, r2, r3;",
              "  if (lodNear < 0.5) {",
              "    r0 = sampleTerrainR(uRoughMap0, vWorldPos, baseUv, N, uTexScale0, uHasRoughMap0, uRoughness0);",
              "    r1 = sampleTerrainR(uRoughMap1, vWorldPos, baseUv, N, uTexScale1, uHasRoughMap1, uRoughness1);",
              "    r2 = sampleTerrainR(uRoughMap2, vWorldPos, baseUv, N, uTexScale2, uHasRoughMap2, uRoughness2);",
              "    r3 = sampleTerrainR(uRoughMap3, vWorldPos, baseUv, N, uTexScale3, uHasRoughMap3, uRoughness3);",
              "  } else {",
              "    r0 = uRoughness0; r1 = uRoughness1; r2 = uRoughness2; r3 = uRoughness3;",
              "  }",
              "",
              "  // AO: disabled for performance — saves 16 texture fetches per near fragment",
              "  float ao0 = 1.0, ao1 = 1.0, ao2 = 1.0, ao3 = 1.0;",
              "",
              "  // Height-depth blending using roughness as height proxy (not luminance)",
              "  // Roughness correlates with surface depth better than brightness",
              "  float depth = 0.15;",
              "  float hProxy0 = r0 * 0.08;",
              "  float hProxy1 = r1 * 0.08;",
              "  float hProxy2 = r2 * 0.08;",
              "  float hProxy3 = r3 * 0.08;",
              "  float hb0 = hProxy0 + vW0;",
              "  float hb1 = hProxy1 + vW1;",
              "  float hb2 = hProxy2 + vW2;",
              "  float hb3 = hProxy3 + vW3;",
              "  float hbMax = max(max(hb0, hb1), max(hb2, hb3));",
              "  hb0 = max(hb0 - hbMax + depth, 0.0);",
              "  hb1 = max(hb1 - hbMax + depth, 0.0);",
              "  hb2 = max(hb2 - hbMax + depth, 0.0);",
              "  hb3 = max(hb3 - hbMax + depth, 0.0);",
              "  float hbSum = hb0 + hb1 + hb2 + hb3 + 0.001;",
              "  hb0 /= hbSum; hb1 /= hbSum; hb2 /= hbSum; hb3 /= hbSum;",
              "",
              "  vec3 albedo = c0 * hb0 + c1 * hb1 + c2 * hb2 + c3 * hb3;",
              "",
              "  // Detail noise: adds micro variation at close range to break flat look",
              "  float detailFade = 1.0 - smoothstep(5.0, 40.0, camDist);",
              "  if (detailFade > 0.01) {",
              "    float dn = detailNoise(vWorldPos.xz * 2.0) * 2.0 - 1.0;",
              "    albedo += albedo * dn * 0.08 * detailFade;",
              "  }",
              "",
              "  // Blend normal maps — skip for far LOD (saves 4 texture fetches + TBN math)",
              "  vec3 pertN = N;",
              "  if (lodFar < 0.99) {",
              "    vec3 blendedNormalTS = vec3(0.0, 0.0, 0.0);",
              "    if (uNumLayers > 0) blendedNormalTS += sampleNormalMap(uNormal0, baseUv, uTexScale0, uHasNormal0, uNormalIntensity0) * hb0;",
              "    if (uNumLayers > 1) blendedNormalTS += sampleNormalMap(uNormal1, baseUv, uTexScale1, uHasNormal1, uNormalIntensity1) * hb1;",
              "    if (uNumLayers > 2) blendedNormalTS += sampleNormalMap(uNormal2, baseUv, uTexScale2, uHasNormal2, uNormalIntensity2) * hb2;",
              "    if (uNumLayers > 3) blendedNormalTS += sampleNormalMap(uNormal3, baseUv, uTexScale3, uHasNormal3, uNormalIntensity3) * hb3;",
              "    blendedNormalTS = normalize(blendedNormalTS);",
              "    pertN = perturbNormal(N, vWorldPos, baseUv, blendedNormalTS);",
              "    pertN = mix(pertN, N, lodNear);",
              "  }",
              "",
              "  // Per-layer roughness blend (from maps or uniform fallback)",
              "  float roughness = r0 * hb0 + r1 * hb1 + r2 * hb2 + r3 * hb3;",
              "  roughness = clamp(roughness, 0.05, 1.0);",
              "",
              "  // Per-layer AO blend",
              "  float ao = ao0 * hb0 + ao1 * hb1 + ao2 * hb2 + ao3 * hb3;",
              "",
              "  float metallic = uMetallic0 * hb0 + uMetallic1 * hb1 + uMetallic2 * hb2 + uMetallic3 * hb3;",
              "  vec3 F0 = mix(vec3(0.04), albedo, metallic);",
              "",
              "  // === PBR Cook-Torrance Lighting ===",
              "  vec3 totalLight = vec3(0.0);",
              "",
              "  // Sun light (primary)",
              "  vec3 sunDir = normalize(vec3(0.5, 0.75, 0.35));",
              "  float NdotL = max(dot(pertN, sunDir), 0.0);",
              "",
              "  // Far LOD: simplified Lambert-only lighting (skip GGX/Smith/Fresnel)",
              "  if (lodFar > 0.01) {",
              "    vec3 sunColor = vec3(1.0, 0.95, 0.85) * 2.5;",
              "    vec3 simpleLit = albedo * sunColor * NdotL;",
              "    vec3 simpleAmb = albedo * vec3(0.4, 0.45, 0.55) * 0.6;",
              "    vec3 farLight = simpleLit + simpleAmb;",
              "    if (lodFar > 0.99) {",
              "      totalLight = farLight;",
              "    } else {",
              "      // Blend: near PBR path still runs below, mixed with farLight",
              "      totalLight = farLight * lodFar;",
              "    }",
              "  }",
              "",
              "  // Near PBR path (skipped when fully far LOD)",
              "  if (lodFar < 0.99) {",
              "    vec3 sunColor = vec3(1.0, 0.95, 0.85) * 3.0;",
              "    vec3 H = normalize(V + sunDir);",
              "    float NdotV = max(dot(pertN, V), 0.001);",
              "    float NdotH = max(dot(pertN, H), 0.0);",
              "    float HdotV = max(dot(H, V), 0.0);",
              "    float D = distributionGGX(NdotH, roughness);",
              "    float G = geometrySmith(NdotV, NdotL, roughness);",
              "    vec3 F = fresnelSchlick(HdotV, F0);",
              "    vec3 kD = (1.0 - F) * (1.0 - metallic);",
              "    vec3 spec = (D * G * F) / (4.0 * NdotV * NdotL + 0.001);",
              "    vec3 nearPBR = (kD * albedo / 3.14159 + spec) * sunColor * NdotL;",
              "",
              "    // Fill light (secondary, cooler)",
              "    vec3 fillDir = normalize(vec3(-0.4, 0.5, -0.7));",
              "    vec3 fillColor = vec3(0.4, 0.5, 0.7) * 1.2;",
              "    float fillNdotL = max(dot(pertN, fillDir), 0.0);",
              "    nearPBR += albedo * fillColor * fillNdotL * ao;",
              "",
              "    // Back/rim light",
              "    vec3 backDir = normalize(vec3(-0.2, 0.6, -0.3));",
              "    vec3 backColor = vec3(0.2, 0.22, 0.3) * 0.5;",
              "    float backNdotL = max(dot(pertN, backDir), 0.0);",
              "    nearPBR += albedo * backColor * backNdotL;",
              "",
              "    // Hemisphere ambient (sky + ground bounce) — modulated by AO",
              "    vec3 skyAmb = vec3(0.55, 0.6, 0.75);",
              "    vec3 gndAmb = vec3(0.25, 0.2, 0.15);",
              "    float upFactor = pertN.y * 0.5 + 0.5;",
              "    vec3 ambient = mix(gndAmb, skyAmb, upFactor) * albedo * 0.6 * ao;",
              "    nearPBR += ambient;",
              "",
              "    totalLight += nearPBR * (1.0 - lodFar);",
              "  }",
              "",
              "  // Minimum brightness floor",
              "  totalLight = max(totalLight, albedo * 0.08);",
              "",
              "  // Emission from emissive layers (Lava/Burnt) — reuses AO texture slot",
              "  vec3 emission = vec3(0.0);",
              "  if (uIsEmissive0 > 0.5 && uHasAOMap0 > 0.5) emission += texture2D(uAOMap0, baseUv * uTexScale0).rgb * uEmissionIntensity0 * hb0;",
              "  if (uIsEmissive1 > 0.5 && uHasAOMap1 > 0.5) emission += texture2D(uAOMap1, baseUv * uTexScale1).rgb * uEmissionIntensity1 * hb1;",
              "  if (uIsEmissive2 > 0.5 && uHasAOMap2 > 0.5) emission += texture2D(uAOMap2, baseUv * uTexScale2).rgb * uEmissionIntensity2 * hb2;",
              "  if (uIsEmissive3 > 0.5 && uHasAOMap3 > 0.5) emission += texture2D(uAOMap3, baseUv * uTexScale3).rgb * uEmissionIntensity3 * hb3;",
              "  totalLight += emission;",
              "",
              "  // Atmospheric haze",
              "  float fogDist = camDist / uFogFar;",
              "  float fogAmt = clamp(fogDist * fogDist, 0.0, uFogMaxAmt);",
              "  totalLight = mix(totalLight, uFogColor, fogAmt);",
              "",
              "  gl_FragColor = vec4(totalLight, 1.0);",
              "}"
            ].join("\\n");

            // Dispose old material
            if (_rpTerrain.material) { try { _rpTerrain.material.dispose(); } catch(e) {} }

            // TSL terrain material — compiles to both WGSL (WebGPU) and GLSL (WebGL) automatically
            // MeshStandardMaterial handles PBR lighting, fog, and shadows internally
            var _rpFn = _rpTHREE.Fn || _rpTHREE.tslFn;
            var _rpMat = new _rpTHREE.MeshStandardMaterial({
              side: _rpTHREE.DoubleSide,
              roughness: 0.8,
              metalness: 0.0
            });

            if (_rpFn) {
              // Read splatmap weights from vec4 vertex attributes
              var _a_wA = _rpTHREE.attribute("weightsA", "vec4");
              var _a_wB = _rpTHREE.attribute("weightsB", "vec4");
              var _a_uv = _rpTHREE.uv();
              var _tWeights = [_a_wA.x, _a_wA.y, _a_wA.z, _a_wA.w, _a_wB.x, _a_wB.y, _a_wB.z, _a_wB.w];

              // Read per-layer parameters from computed uniforms
              var _tScale = [];
              var _tRough = [];
              var _tMetal = [];
              for (var _pli = 0; _pli < _rpNumLayers; _pli++) {
                _tScale[_pli] = _rpUniforms["uTexScale" + _pli].value;
                _tRough[_pli] = _rpUniforms["uRoughness" + _pli].value;
                _tMetal[_pli] = _rpUniforms["uMetallic" + _pli].value;
              }

              // Sample diffuse textures (or fallback colors) for each layer
              var _tDiffuse = [];
              for (var _pli = 0; _pli < _rpNumLayers; _pli++) {
                if (_rpTextures[_pli]) {
                  _tDiffuse[_pli] = _rpTHREE.texture(_rpTextures[_pli], _a_uv.mul(_tScale[_pli])).rgb;
                } else {
                  var _fc = _rpUniforms["uColor" + _pli].value;
                  _tDiffuse[_pli] = _rpTHREE.vec3(_fc.x, _fc.y, _fc.z);
                }
              }

              // Height-depth blending (same algorithm as original GLSL shader)
              // Uses roughness as height proxy — roughness correlates with surface depth
              var _hDepth = _rpTHREE.float(0.15);
              var _hScale = _rpTHREE.float(0.08);

              // hb[i] = roughness[i] * 0.08 + weight[i]
              var _hb = [];
              for (var _pli = 0; _pli < _rpNumLayers; _pli++) {
                _hb[_pli] = _rpTHREE.float(_tRough[_pli]).mul(_hScale).add(_tWeights[_pli]);
              }

              // hbMax = max(all active layers)
              var _hbMax = _hb[0];
              for (var _pli = 1; _pli < _rpNumLayers; _pli++) {
                _hbMax = _rpTHREE.max(_hbMax, _hb[_pli]);
              }

              // Normalize: hb = max(hb - hbMax + depth, 0) / sum
              var _hn = [];
              for (var _pli = 0; _pli < _rpNumLayers; _pli++) {
                _hn[_pli] = _rpTHREE.max(_hb[_pli].sub(_hbMax).add(_hDepth), _rpTHREE.float(0));
              }
              var _hSum = _rpTHREE.float(0.001);
              for (var _pli = 0; _pli < _rpNumLayers; _pli++) {
                _hSum = _hSum.add(_hn[_pli]);
              }
              var _hFinal = [];
              for (var _pli = 0; _pli < _rpNumLayers; _pli++) {
                _hFinal[_pli] = _hn[_pli].div(_hSum);
              }

              // Blend diffuse colors with height-depth weights
              var _blendColor = _tDiffuse[0].mul(_hFinal[0]);
              for (var _pli = 1; _pli < _rpNumLayers; _pli++) {
                _blendColor = _blendColor.add(_tDiffuse[_pli].mul(_hFinal[_pli]));
              }
              _rpMat.colorNode = _blendColor;

              // Blend roughness
              var _blendRough = _rpTHREE.float(_tRough[0]).mul(_hFinal[0]);
              for (var _pli = 1; _pli < _rpNumLayers; _pli++) {
                _blendRough = _blendRough.add(_rpTHREE.float(_tRough[_pli]).mul(_hFinal[_pli]));
              }
              _rpMat.roughnessNode = _rpTHREE.clamp(_blendRough, 0.05, 1.0);

              // Blend metalness
              var _blendMetal = _rpTHREE.float(_tMetal[0]).mul(_hFinal[0]);
              for (var _pli = 1; _pli < _rpNumLayers; _pli++) {
                _blendMetal = _blendMetal.add(_rpTHREE.float(_tMetal[_pli]).mul(_hFinal[_pli]));
              }
              _rpMat.metalnessNode = _blendMetal;

              // Normal map blending (if any normals loaded)
              var _hasAnyNormal = false;
              for (var _pli = 0; _pli < _rpNumLayers; _pli++) {
                if (_rpNormalTextures[_pli]) { _hasAnyNormal = true; break; }
              }
              if (_hasAnyNormal) {
                var _blendNorm = null;
                for (var _pli = 0; _pli < _rpNumLayers; _pli++) {
                  if (_rpNormalTextures[_pli]) {
                    var _nSamp = _rpTHREE.texture(_rpNormalTextures[_pli], _a_uv.mul(_tScale[_pli]));
                    // Decode tangent-space normal: rgb * 2 - 1, scale xy by intensity
                    var _nInt = _rpUniforms["uNormalIntensity" + _pli].value;
                    var _nDecoded = _nSamp.rgb.mul(2.0).sub(1.0);
                    var _nScaled = _rpTHREE.vec3(_nDecoded.x.mul(_nInt), _nDecoded.y.mul(_nInt), _nDecoded.z);
                    var _nWeighted = _nScaled.mul(_hFinal[_pli]);
                    _blendNorm = _blendNorm ? _blendNorm.add(_nWeighted) : _nWeighted;
                  }
                }
                if (_blendNorm) {
                  _rpMat.normalNode = _rpTHREE.normalize(_blendNorm);
                }
              }

              // Emission (uses AO texture slot for emissive layers like Lava/Burnt)
              var _emNode = null;
              for (var _pli = 0; _pli < _rpNumLayers; _pli++) {
                if (_rpUniforms["uIsEmissive" + _pli].value > 0.5 && _rpAOTextures[_pli]) {
                  var _eTex = _rpTHREE.texture(_rpAOTextures[_pli], _a_uv.mul(_tScale[_pli])).rgb;
                  var _eInt = _rpTHREE.float(_rpUniforms["uEmissionIntensity" + _pli].value);
                  var _eContrib = _eTex.mul(_eInt).mul(_hFinal[_pli]);
                  _emNode = _emNode ? _emNode.add(_eContrib) : _eContrib;
                }
              }
              if (_emNode) {
                _rpMat.emissiveNode = _emNode;
              }

              console.log("[TerrainPainter] TSL material applied with", _rpNumLayers, "layers, height-depth blending, normals:", _hasAnyNormal);
            } else {
              // Fallback: TSL not available — apply dominant texture only (max 4 layers on WebGL)
              if (_rpNumLayers > 4) console.warn("[TerrainPainter] WebGL fallback limited to 4 layers — enable WebGPU for 8-layer support");
              var _rpDomTex = _rpTextures[0] || _rpTextures[1] || _rpTextures[2] || _rpTextures[3];
              if (_rpDomTex) _rpMat.map = _rpDomTex;
              var _rpDomNorm = _rpNormalTextures[0] || _rpNormalTextures[1] || _rpNormalTextures[2] || _rpNormalTextures[3];
              if (_rpDomNorm) _rpMat.normalMap = _rpDomNorm;
              console.log("[TerrainPainter] Fallback material (no TSL) with dominant texture");
            }

            _rpTerrain.material = _rpMat;

            // Set scene.fog if not present (MeshStandardMaterial uses it automatically)
            var _sc2 = window.__vibexe_scene__;
            if (_sc2 && !_sc2.fog) {
              _sc2.fog = new _rpTHREE.Fog(0x9EADCC, 1, 300);
            }

            // === MODULE INTEROP: Update terrain surface offset from active layers ===
            // Each texture type has a visual height — how far the texture appears to
            // extend above the geometric surface (e.g., grass blades ~0.35 units tall).
            // Modules like character-system read this to position entities on the
            // visual surface, not inside the grass/vegetation.
            var _soLookup = { grass: 0.35, ground: 0.15, dirt: 0.15, rock: 0.05, snow: 0.10 };
            var _soMax = 0.15; // minimum baseline
            for (var _soi = 0; _soi < _rpNumLayers; _soi++) {
              var _soUrl = (_rpEnabledLayers[_soi].diffuseUrl || "").toLowerCase();
              for (var _soKey in _soLookup) {
                if (_soUrl.indexOf(_soKey) >= 0 && _soLookup[_soKey] > _soMax) {
                  _soMax = _soLookup[_soKey];
                }
              }
            }
            window.__vibexe_terrainSurfaceOffset = _soMax;
            console.log("[TerrainModule] Surface offset:", _soMax, "from", _rpNumLayers, "active layers");

            window.__vibexe_terrainRepaintInProgress = false;
            window.parent.postMessage({ type: "terrain-painter-repainted" }, "*");
          }

          console.log("[TerrainPainter] Loading", _rpTotal, "textures. Diffuse:", _rpTexUrls, "Normal:", _rpNormalUrls, "Roughness:", _rpRoughnessUrls, "AO:", _rpAOUrls);

          // Load diffuse textures
          for (var ti2 = 0; ti2 < _rpNumLayers; ti2++) {
            (function(idx) {
              var url = _rpTexUrls[idx];
              if (url && url.charAt(0) === '/') {
                url = (window.__VIBEXE_API_ORIGIN__ || '') + url;
              }
              if (!url || url.length < 5) {
                _rpTextures[idx] = null;
                _rpLoaded++;
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
                return;
              }
              console.log("[TerrainPainter] Loading diffuse[" + idx + "]:", url);
              _rpLoader.load(url, function(tex) {
                tex.wrapS = _rpTHREE.RepeatWrapping;
                tex.wrapT = _rpTHREE.RepeatWrapping;
                tex.minFilter = _rpTHREE.LinearMipmapLinearFilter;
                tex.anisotropy = 4;
                tex.colorSpace = _rpTHREE.SRGBColorSpace;
                // Dispose previous texture to prevent GPU memory leak
                if (_rpTextures[idx] && _rpTextures[idx].dispose) _rpTextures[idx].dispose();
                _rpTextures[idx] = tex;
                _rpLoaded++;
                console.log("[TerrainPainter] Diffuse[" + idx + "] loaded OK (" + _rpLoaded + "/" + _rpTotal + ")");
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
              }, undefined, function() {
                console.warn("[TerrainPainter] Failed to load diffuse[" + idx + "]:", url);
                _rpTextures[idx] = null;
                _rpLoaded++;
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
              });
            })(ti2);
          }

          // Load normal map textures (auto-derived from diffuse URLs)
          for (var ni2 = 0; ni2 < _rpNumLayers; ni2++) {
            (function(idx) {
              var nurl = _rpNormalUrls[idx];
              if (nurl && nurl.charAt(0) === '/') {
                nurl = (window.__VIBEXE_API_ORIGIN__ || '') + nurl;
              }
              if (!nurl || nurl.length < 5) {
                _rpNormalTextures[idx] = null;
                _rpLoaded++;
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
                return;
              }
              console.log("[TerrainPainter] Loading normal[" + idx + "]:", nurl);
              _rpLoader.load(nurl, function(ntex) {
                ntex.wrapS = _rpTHREE.RepeatWrapping;
                ntex.wrapT = _rpTHREE.RepeatWrapping;
                ntex.minFilter = _rpTHREE.LinearMipmapLinearFilter;
                ntex.anisotropy = 4;
                ntex.colorSpace = _rpTHREE.NoColorSpace;
                if (_rpNormalTextures[idx] && _rpNormalTextures[idx].dispose) _rpNormalTextures[idx].dispose();
                _rpNormalTextures[idx] = ntex;
                _rpLoaded++;
                console.log("[TerrainPainter] Normal[" + idx + "] loaded OK (" + _rpLoaded + "/" + _rpTotal + ")");
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
              }, undefined, function() {
                console.warn("[TerrainPainter] Failed to load normal[" + idx + "]:", nurl);
                _rpNormalTextures[idx] = null;
                _rpLoaded++;
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
              });
            })(ni2);
          }

          // Load roughness map textures
          for (var ri2 = 0; ri2 < _rpNumLayers; ri2++) {
            (function(idx) {
              var rurl = _rpRoughnessUrls[idx];
              if (rurl && rurl.charAt(0) === '/') {
                rurl = (window.__VIBEXE_API_ORIGIN__ || '') + rurl;
              }
              if (!rurl || rurl.length < 5) {
                _rpRoughnessTextures[idx] = null;
                _rpLoaded++;
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
                return;
              }
              _rpLoader.load(rurl, function(rtex) {
                rtex.wrapS = _rpTHREE.RepeatWrapping;
                rtex.wrapT = _rpTHREE.RepeatWrapping;
                rtex.minFilter = _rpTHREE.LinearMipmapLinearFilter;
                rtex.anisotropy = 4;
                rtex.colorSpace = _rpTHREE.NoColorSpace;
                if (_rpRoughnessTextures[idx] && _rpRoughnessTextures[idx].dispose) _rpRoughnessTextures[idx].dispose();
                _rpRoughnessTextures[idx] = rtex;
                _rpLoaded++;
                console.log("[TerrainPainter] Roughness[" + idx + "] loaded OK (" + _rpLoaded + "/" + _rpTotal + ")");
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
              }, undefined, function() {
                _rpRoughnessTextures[idx] = null;
                _rpLoaded++;
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
              });
            })(ri2);
          }

          // Load AO map textures
          for (var ai2 = 0; ai2 < _rpNumLayers; ai2++) {
            (function(idx) {
              var aurl = _rpAOUrls[idx];
              if (aurl && aurl.charAt(0) === '/') {
                aurl = (window.__VIBEXE_API_ORIGIN__ || '') + aurl;
              }
              if (!aurl || aurl.length < 5) {
                _rpAOTextures[idx] = null;
                _rpLoaded++;
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
                return;
              }
              _rpLoader.load(aurl, function(atex) {
                atex.wrapS = _rpTHREE.RepeatWrapping;
                atex.wrapT = _rpTHREE.RepeatWrapping;
                atex.minFilter = _rpTHREE.LinearMipmapLinearFilter;
                atex.anisotropy = 4;
                atex.colorSpace = _rpTHREE.NoColorSpace;
                if (_rpAOTextures[idx] && _rpAOTextures[idx].dispose) _rpAOTextures[idx].dispose();
                _rpAOTextures[idx] = atex;
                _rpLoaded++;
                console.log("[TerrainPainter] AO[" + idx + "] loaded OK (" + _rpLoaded + "/" + _rpTotal + ")");
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
              }, undefined, function() {
                _rpAOTextures[idx] = null;
                _rpLoaded++;
                if (_rpLoaded >= _rpTotal) _rpScheduleApply();
              });
            })(ai2);
          }
        } else {
          // No textures — check if all layer colors are default gray (#808080)
          // If so, preserve the original height-gradient vertex colors from terrain generation
          var _rpAllDefaultGray = true;
          for (var _dgi = 0; _dgi < _rpColors.length; _dgi++) {
            var _dgc = _rpColors[_dgi];
            if (Math.abs(_dgc[0] - 0.502) > 0.01 || Math.abs(_dgc[1] - 0.502) > 0.01 || Math.abs(_dgc[2] - 0.502) > 0.01) {
              _rpAllDefaultGray = false;
              break;
            }
          }
          if (_rpAllDefaultGray && (_rpGeo.attributes.color || (_rpTerrain.material && _rpTerrain.material.colorNode))) {
            console.log("[TerrainPainter] No textures + all default gray — preserving existing material");
            // If terrain already has a TSL material (from a prior textured repaint), keep it entirely
            if (_rpTerrain.material && _rpTerrain.material.colorNode) {
              console.log("[TerrainPainter] Keeping TSL material from prior repaint (has colorNode)");
              window.__vibexe_terrainRepaintInProgress = false;
            window.parent.postMessage({ type: "terrain-painter-repainted" }, "*");
              break;
            }
          } else {
            // Apply vertex colors from layer preview colors
            var _rpVCols = new Float32Array(_rpCount * 3);
            var _rpBaseColor = _rpColors[0] || [0.33, 0.47, 0.2];
            for (var vi4 = 0; vi4 < _rpCount; vi4++) {
              var r = 0, g = 0, b = 0;
              var wTotal = 0;
              for (var li7 = 0; li7 < _rpNumLayers; li7++) {
                var w = _rpWeights[li7][vi4];
                var c = _rpColors[li7] || [0.5, 0.5, 0.5];
                r += c[0] * w;
                g += c[1] * w;
                b += c[2] * w;
                wTotal += w;
              }
              if (wTotal < 0.001) {
                r = _rpBaseColor[0];
                g = _rpBaseColor[1];
                b = _rpBaseColor[2];
              }
              _rpVCols[vi4*3] = r;
              _rpVCols[vi4*3+1] = g;
              _rpVCols[vi4*3+2] = b;
            }
            _rpGeo.setAttribute("color", new _rpTHREE.BufferAttribute(_rpVCols, 3));
            _rpGeo.attributes.color.needsUpdate = true;
          }

          // Use vertex color material (keep existing if already vertex-colored or has TSL colorNode)
          if (_rpTerrain.material && (_rpTerrain.material.vertexColors || _rpTerrain.material.colorNode)) {
            // Already has appropriate material — keep it
          } else {
            if (_rpTerrain.material) { try { _rpTerrain.material.dispose(); } catch(e) {} }
            _rpTerrain.material = new _rpTHREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: 0.85,
              metalness: 0.05,
              flatShading: false
            });
          }
          console.log("[TerrainPainter] Vertex colors applied with", _rpNumLayers, "layers (preserved:", _rpAllDefaultGray, ")");
          window.parent.postMessage({ type: "terrain-painter-repainted" }, "*");
        }
        break;
      }

      case "terrain-painter-toggle-heatmap": {
        var _hmScene = (editor && editor.scene) ? editor.scene : window.__vibexe_scene__;
        var _hmTerrain = _hmScene ? _hmScene.getObjectByName("__terrain__") : null;
        if (!_hmTerrain || !_hmTerrain.geometry) break;
        var _hmTHREE = window.THREE;
        if (!_hmTHREE) break;
        var _hmEnabled = !!d.enabled;
        var _hmGeo = _hmTerrain.geometry;
        var _hmHAttr = _hmGeo.attributes.terrainHeight;
        if (!_hmHAttr) break;

        if (_hmEnabled) {
          // Show height heatmap (blue=low → green=mid → red=high)
          var _hmCols = new Float32Array(_hmHAttr.count * 3);
          for (var hvi = 0; hvi < _hmHAttr.count; hvi++) {
            var h = _hmHAttr.getX(hvi);
            if (h < 0.5) {
              _hmCols[hvi*3] = 0; _hmCols[hvi*3+1] = h*2; _hmCols[hvi*3+2] = 1-h*2;
            } else {
              _hmCols[hvi*3] = (h-0.5)*2; _hmCols[hvi*3+1] = 1-(h-0.5)*2; _hmCols[hvi*3+2] = 0;
            }
          }
          _hmGeo.setAttribute("color", new _hmTHREE.BufferAttribute(_hmCols, 3));
          if (_hmTerrain.material) { try { _hmTerrain.material.dispose(); } catch(e) {} }
          _hmTerrain.material = new _hmTHREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
        } else {
          // Heatmap disabled — auto-repaint to restore PBR material
          console.log("[TerrainPainter] Heatmap OFF — requesting repaint");
          window.parent.postMessage({ type: "terrain-painter-request-repaint" }, "*");
        }
        break;
      }

      case "terrain-painter-toggle-boundary-grid": {
        var _bgGrid = window.__vibexe_terrainBoundaryGrid;
        if (_bgGrid) {
          _bgGrid.visible = !_bgGrid.visible;
          console.log("[TerrainPainter] Boundary grid:", _bgGrid.visible ? "ON" : "OFF");
          window.parent.postMessage({
            type: "game-editor-boundary-grid-state",
            visible: _bgGrid.visible
          }, "*");
        }
        break;
      }

      // ===== TERRAIN SCULPT HANDLERS =====

      case "terrain-painter-sculpt-activate": {
        _sculptActive = true;
        _sculptBrushType = d.brushType || "raise";
        _sculptBrushSize = d.brushSize || 10;
        _sculptBrushStrength = d.brushStrength || 0.3;
        _sculptBrushFalloff = d.brushFalloff || "gaussian";
        if (d.paintLayerIndex != null) _paintLayerIndex = d.paintLayerIndex;
        if (d.brushHardness !== undefined) _sculptBrushHardness = d.brushHardness;
        if (d.brushOpacity !== undefined) _sculptBrushOpacity = d.brushOpacity;
        if (d.brushSpacing !== undefined) _sculptBrushSpacing = d.brushSpacing;
        if (d.brushJitter !== undefined) _sculptBrushJitter = d.brushJitter;
        if (d.paintLayerColor !== undefined) _sculptBrushColor = d.paintLayerColor;

        // Deselect any currently selected object to avoid gizmo interference
        deselectObject();

        if (!_sculptBrushMesh) {
          var _sTHREE = window.THREE;
          var ringGeo = new _sTHREE.RingGeometry(_sculptBrushSize * 0.9, _sculptBrushSize, 64);
          ringGeo.rotateX(-Math.PI / 2);
          // Use paint layer color for brush ring in paint/erase mode
          var _ringColor = 0x00ff88;
          if ((_sculptBrushType === "paint" || _sculptBrushType === "erase") && _sculptBrushColor) {
            _ringColor = parseInt(_sculptBrushColor.replace("#", ""), 16) || 0x4488ff;
          } else if (_sculptBrushType === "erase") {
            _ringColor = 0xff4444;
          }
          var ringMat = new _sTHREE.MeshBasicMaterial({
            color: _ringColor, side: _sTHREE.DoubleSide,
            transparent: true, opacity: 0.6, depthTest: false
          });
          _sculptBrushMesh = new _sTHREE.Mesh(ringGeo, ringMat);
          _sculptBrushMesh.name = "__sculptBrush__";
          _sculptBrushMesh.renderOrder = 999;
          editor.scene.add(_sculptBrushMesh);
        }

        // Reusable raycaster + mouse vector (avoid allocation per frame)
        var _sculptRC = new (window.THREE).Raycaster();
        var _sculptMV = new (window.THREE).Vector2();

        window.__sculptMouseMove = function(ev) {
          if (!_sculptActive || !editor) return;
          var terrain = editor.scene.getObjectByName("__terrain__");
          if (!terrain) return;
          var rect = editor.renderer.domElement.getBoundingClientRect();
          _sculptMV.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
          _sculptMV.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
          _sculptRC.setFromCamera(_sculptMV, editor.camera);
          var hits = _sculptRC.intersectObject(terrain);
          if (hits.length > 0) {
            var pt = hits[0].point;
            if (_sculptBrushMesh) {
              _sculptBrushMesh.visible = true;
              _sculptBrushMesh.position.set(pt.x, pt.y + 0.3, pt.z);
            }
            if (_sculptMouseDown) {
              // Distance-based stamp spacing (replaces time-throttle)
              var stampDist = _sculptBrushSize * Math.max(0.05, _sculptBrushSpacing);
              var shouldStamp = true;
              if (_sculptLastStampPos) {
                var sdx = pt.x - _sculptLastStampPos.x;
                var sdz = pt.z - _sculptLastStampPos.z;
                if (sdx * sdx + sdz * sdz < stampDist * stampDist) shouldStamp = false;
              }
              if (shouldStamp) {
                // Apply jitter offset
                var jx = pt.x, jz = pt.z;
                if (_sculptBrushJitter > 0) {
                  var jAmt = _sculptBrushSize * _sculptBrushJitter;
                  jx += (Math.random() - 0.5) * 2 * jAmt;
                  jz += (Math.random() - 0.5) * 2 * jAmt;
                }
                _sculptLastStampPos = { x: pt.x, z: pt.z };
                applySculptBrush(jx, jz);
              }
            }
          } else {
            // Hide brush when not over terrain
            if (_sculptBrushMesh) _sculptBrushMesh.visible = false;
          }
        };

        window.__sculptMouseDown = function(ev) {
          if (!_sculptActive || ev.button !== 0) return;
          var terrain = editor.scene.getObjectByName("__terrain__");
          if (!terrain) return;
          var rect = editor.renderer.domElement.getBoundingClientRect();
          _sculptMV.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
          _sculptMV.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
          _sculptRC.setFromCamera(_sculptMV, editor.camera);
          var hits = _sculptRC.intersectObject(terrain);
          if (hits.length > 0) {
            _sculptMouseDown = true;
            _sculptTargetHeight = hits[0].point.y;
            _sculptLastStampPos = { x: hits[0].point.x, z: hits[0].point.z };
            applySculptBrush(hits[0].point.x, hits[0].point.z);
            ev.stopPropagation();
            ev.preventDefault();
          }
        };

        // Block ALL pointerdown during sculpt to prevent selection handler from firing
        // NOTE: Do NOT call preventDefault() on pointerdown — it suppresses mousedown per Pointer Events spec
        window.__sculptPointerDown = function(ev) {
          if (!_sculptActive || ev.button !== 0) return;
          ev.stopPropagation();
          ev.stopImmediatePropagation();
        };

        window.__sculptMouseUp = function() { _sculptMouseDown = false; _sculptLastStampPos = null; };

        window.addEventListener("mousemove", window.__sculptMouseMove, true);
        window.addEventListener("mousedown", window.__sculptMouseDown, true);
        window.addEventListener("mouseup", window.__sculptMouseUp, true);
        window.addEventListener("pointerdown", window.__sculptPointerDown, true);

        console.log("[TerrainSculpt] Activated:", _sculptBrushType, "size:", _sculptBrushSize);
        break;
      }

      case "terrain-painter-sculpt-deactivate": {
        _sculptActive = false;
        _sculptMouseDown = false;

        if (_sculptBrushMesh) {
          editor.scene.remove(_sculptBrushMesh);
          _sculptBrushMesh.geometry.dispose();
          _sculptBrushMesh.material.dispose();
          _sculptBrushMesh = null;
        }

        if (window.__sculptMouseMove) window.removeEventListener("mousemove", window.__sculptMouseMove, true);
        if (window.__sculptMouseDown) window.removeEventListener("mousedown", window.__sculptMouseDown, true);
        if (window.__sculptMouseUp) window.removeEventListener("mouseup", window.__sculptMouseUp, true);
        if (window.__sculptPointerDown) window.removeEventListener("pointerdown", window.__sculptPointerDown, true);

        console.log("[TerrainSculpt] Deactivated");
        break;
      }

      case "terrain-get-heightmap": {
        // Export current heightmap as base64 Float32Array for persistence
        var td = window.__vibexe_terrainData;
        if (td && td.heightData) {
          // Sanity check: don't export corrupted height data (max should be < 500 for any reasonable terrain)
          var _expMaxH = -Infinity;
          for (var _ehi = 0; _ehi < td.heightData.length; _ehi++) {
            if (td.heightData[_ehi] > _expMaxH) _expMaxH = td.heightData[_ehi];
          }
          if (_expMaxH > 500) {
            console.warn("[TerrainPainter] Heightmap export BLOCKED — max height " + _expMaxH.toFixed(0) + " is corrupted (expected < 500)");
            break;
          }
          var bytes = new Uint8Array(td.heightData.buffer);
          var b64 = "";
          for (var bi = 0; bi < bytes.length; bi++) b64 += String.fromCharCode(bytes[bi]);
          var encoded = btoa(b64);
          window.parent.postMessage({ type: "terrain-heightmap-data", data: encoded, vertexCount: td.heightData.length }, "*");
          console.log("[TerrainPainter] Exported heightmap:", td.heightData.length, "vertices,", encoded.length, "bytes base64");
        }
        break;
      }

      case "terrain-painter-sculpt-update": {
        if (d.brushType !== undefined) _sculptBrushType = d.brushType;
        if (d.brushSize !== undefined) {
          _sculptBrushSize = d.brushSize;
          if (_sculptBrushMesh) {
            _sculptBrushMesh.geometry.dispose();
            var newRingGeo = new (window.THREE).RingGeometry(_sculptBrushSize * 0.95, _sculptBrushSize, 64);
            newRingGeo.rotateX(-Math.PI / 2);
            _sculptBrushMesh.geometry = newRingGeo;
          }
        }
        if (d.brushStrength !== undefined) _sculptBrushStrength = d.brushStrength;
        if (d.brushFalloff !== undefined) _sculptBrushFalloff = d.brushFalloff;
        if (d.paintLayerIndex != null) _paintLayerIndex = d.paintLayerIndex;
        if (d.brushHardness !== undefined) _sculptBrushHardness = d.brushHardness;
        if (d.brushOpacity !== undefined) _sculptBrushOpacity = d.brushOpacity;
        if (d.brushSpacing !== undefined) _sculptBrushSpacing = d.brushSpacing;
        if (d.brushJitter !== undefined) _sculptBrushJitter = d.brushJitter;
        if (d.paintLayerColor !== undefined) {
          _sculptBrushColor = d.paintLayerColor;
          // Update brush ring color live
          if (_sculptBrushMesh && _sculptBrushMesh.material) {
            var _newBrushColor = 0x00ff88;
            if ((_sculptBrushType === "paint" || _sculptBrushType === "erase") && _sculptBrushColor) {
              _newBrushColor = parseInt(_sculptBrushColor.replace("#", ""), 16) || 0x4488ff;
            } else if (_sculptBrushType === "erase") {
              _newBrushColor = 0xff4444;
            }
            _sculptBrushMesh.material.color.setHex(_newBrushColor);
          }
        }
        break;
      }

    }
  });
  } // end initBridge

  // Poll for THREE.js availability — handles async CDN loading order
  if (window.THREE) {
    initBridge();
  } else {
    var threeAttempts = 0;
    var threeTimer = setInterval(function() {
      if (window.THREE) {
        clearInterval(threeTimer);
        initBridge();
      } else if (++threeAttempts > 100) {
        clearInterval(threeTimer);
        // Not a 3D game — skip
      }
    }, 50);
  }
})();

// ===== FPS-Adaptive Quality System =====
// Third IIFE — monitors frame rate and auto-adjusts pixel ratio + shadows
// to maintain playable FPS. Restores quality when performance recovers.
(function() {
  var AQ_SAMPLE_SIZE = 60;
  var AQ_CHECK_INTERVAL = 3000;
  var AQ_LOW_FPS = 12;
  var AQ_HIGH_FPS = 25;
  var AQ_RECOVER_HOLD = 5000;
  var AQ_PR_STEP = 0.1;
  var AQ_PR_MIN = 0.9;
  var AQ_GRACE_MS = 35000; // Skip quality checks for first 35s (WebGPU TSL shader compilation)

  var frameTimes = [];
  var lastCheckTime = 0;
  var aqStartTime = performance.now();
  var highFpsSince = 0;
  var originalPixelRatio = null;
  var currentPixelRatio = null;
  var shadowsDisabled = false;
  var bloomDisabled = false;
  var started = false;

  var state = {
    fps: 0,
    currentPixelRatio: null,
    originalPixelRatio: null,
    shadowsDisabled: false,
    bloomDisabled: false,
    reductions: 0
  };
  window.__vibexe_adaptive_quality__ = state;

  function getRenderer() {
    return window.__vibexe_renderer__ || null;
  }

  function getMaxPixelRatio() {
    var dpr = (typeof devicePixelRatio !== "undefined") ? devicePixelRatio : 1;
    return Math.min(dpr, 1.5);
  }

  function init() {
    var renderer = getRenderer();
    if (!renderer) return false;
    originalPixelRatio = renderer.getPixelRatio();
    currentPixelRatio = originalPixelRatio;
    state.originalPixelRatio = originalPixelRatio;
    state.currentPixelRatio = currentPixelRatio;
    return true;
  }

  function reduceQuality() {
    var renderer = getRenderer();
    if (!renderer) return;

    // First: disable bloom (biggest win — eliminates 7 render passes)
    if (!bloomDisabled) {
      var comp = window.__vibexe_composer__;
      if (comp && comp.passes) {
        for (var i = 0; i < comp.passes.length; i++) {
          if (comp.passes[i].constructor && comp.passes[i].constructor.name === 'UnrealBloomPass') {
            comp.passes[i].enabled = false;
          }
        }
      }
      window.__vibexe_skipComposer__ = true;
      bloomDisabled = true;
      state.reductions++;
      console.log("[AdaptiveQuality] Disabled bloom + composer bypass");
      return;
    }

    // Second: reduce pixel ratio
    if (currentPixelRatio > AQ_PR_MIN + 0.01) {
      currentPixelRatio = Math.max(AQ_PR_MIN, currentPixelRatio - AQ_PR_STEP);
      renderer.setPixelRatio(currentPixelRatio);
      state.currentPixelRatio = currentPixelRatio;
      state.reductions++;
      console.log("[AdaptiveQuality] Reduced pixelRatio to", currentPixelRatio);
      return;
    }

    // Third: disable shadows
    if (!shadowsDisabled && renderer.shadowMap) {
      renderer.shadowMap.enabled = false;
      shadowsDisabled = true;
      state.shadowsDisabled = true;
      state.reductions++;
      console.log("[AdaptiveQuality] Disabled shadows");
    }
  }

  function restoreQuality() {
    var renderer = getRenderer();
    if (!renderer) return;

    // First: re-enable shadows
    if (shadowsDisabled && renderer.shadowMap) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.needsUpdate = true;
      shadowsDisabled = false;
      state.shadowsDisabled = false;
      console.log("[AdaptiveQuality] Re-enabled shadows");
      highFpsSince = performance.now();
      return;
    }

    // Second: increase pixel ratio
    var maxPR = getMaxPixelRatio();
    if (currentPixelRatio < maxPR - 0.01) {
      currentPixelRatio = Math.min(maxPR, currentPixelRatio + AQ_PR_STEP);
      renderer.setPixelRatio(currentPixelRatio);
      state.currentPixelRatio = currentPixelRatio;
      console.log("[AdaptiveQuality] Increased pixelRatio to", currentPixelRatio);
      highFpsSince = performance.now();
      return;
    }

    // Third: re-enable bloom (last restore step — only if FPS is consistently high)
    if (bloomDisabled) {
      var comp = window.__vibexe_composer__;
      if (comp && comp.passes) {
        for (var i = 0; i < comp.passes.length; i++) {
          if (comp.passes[i].constructor && comp.passes[i].constructor.name === 'UnrealBloomPass') {
            comp.passes[i].enabled = true;
          }
        }
      }
      window.__vibexe_skipComposer__ = false;
      bloomDisabled = false;
      console.log("[AdaptiveQuality] Re-enabled bloom");
      highFpsSince = performance.now();
    }
  }

  function onFrame() {
    var now = performance.now();

    frameTimes.push(now);
    if (frameTimes.length > AQ_SAMPLE_SIZE) {
      frameTimes.shift();
    }

    if (now - lastCheckTime < AQ_CHECK_INTERVAL) return;
    lastCheckTime = now;

    if (frameTimes.length < 10) return;

    var oldest = frameTimes[0];
    var newest = frameTimes[frameTimes.length - 1];
    var elapsed = newest - oldest;
    if (elapsed < 1) return;

    var avgFps = ((frameTimes.length - 1) / elapsed) * 1000;
    state.fps = Math.round(avgFps);

    // Skip during scene editor — don't fight the editor's own rendering
    if (window.__vibexe_editor_active__) {
      highFpsSince = 0;
      return;
    }

    // Skip when game IIFE PerfGuard is active — let it handle quality management
    if (window.__vibexe_perfguard__ || window.__vibexe_quality_authority__ === 'perfguard') {
      return;
    }

    // Skip during grace period (WebGPU TSL shader compilation causes initial low FPS)
    if (performance.now() - aqStartTime < AQ_GRACE_MS) return;

    if (avgFps < AQ_LOW_FPS) {
      reduceQuality();
      highFpsSince = 0;
    } else if (avgFps > AQ_HIGH_FPS) {
      if (highFpsSince === 0) {
        highFpsSince = now;
      } else if (now - highFpsSince > AQ_RECOVER_HOLD) {
        var maxPR = getMaxPixelRatio();
        if (bloomDisabled || shadowsDisabled || currentPixelRatio < maxPR - 0.01) {
          restoreQuality();
        }
      }
    } else {
      highFpsSince = 0;
    }
  }

  // Hook into requestAnimationFrame to piggyback on the game loop
  // Guard: only wrap once — prevent RAF wrapper stacking on bridge reload
  if (!window.__vibexe_aq_wrapped__) {
    window.__vibexe_aq_wrapped__ = true;
    var _origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function(cb) {
      return _origRAF.call(window, function(ts) {
        try {
          var aq = window.__vibexe_adaptive_quality__;
          if (aq && aq._onFrame) aq._onFrame();
        } catch(e) {}
        cb(ts);
      });
    };
  }
  // Expose onFrame via the state object so the RAF wrapper can call it
  // even after bridge reload replaces the IIFE closure
  state._onFrame = function() {
    if (!started) {
      if (init()) {
        started = true;
        lastCheckTime = performance.now();
        console.log("[AdaptiveQuality] Started monitoring (pixelRatio:", originalPixelRatio + ")");
      }
    }
    if (started) {
      onFrame();
    }
  };
})();
`;
}
