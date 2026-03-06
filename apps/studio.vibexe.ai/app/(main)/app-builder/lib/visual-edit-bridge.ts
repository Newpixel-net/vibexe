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
  var boxHelper = null;
  var transformControls = null;
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
  var gridHelper = null;
  var canvasPointerDownHandler = null;
  var bodyMouseDownHandler = null;
  // Flythrough mode (right-click hold + WASD, Unity-style)
  var flyMode = false;
  var flyKeys = {};
  var flyRMBDown = false;
  var flyLastMouse = null;
  // PBR environment state
  var _pbrEnvReady = false;
  function _ensurePBREnv() {
    if (_pbrEnvReady) return;
    var T = window.THREE;
    if (!T || !editor || !editor.scene || !editor.renderer) return;
    _pbrEnvReady = true;
    var pmrem = new T.PMREMGenerator(editor.renderer);
    pmrem.compileEquirectangularShader();
    // Studio env — high contrast for realistic metal reflections
    // Dark sky/ground + concentrated bright lights = metals show dark body + bright highlights
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
    _addP(0, 45, -10, 10, 9, 8, 2, 2);       // Key light (bright, small)
    _addP(-15, 40, 25, 4, 4, 5, 1.5, 1.5);   // Rim light
    _addP(35, 20, -15, 2, 2, 2.5, 2, 2);      // Fill (subtle)
    _addP(-35, 12, 8, 1, 1, 1.2, 2, 2);       // Fill (subtle)
    _addP(0, -30, 0, 0.5, 0.5, 0.6, 4, 4);   // Bottom fill (dim)
    editor.scene.environment = pmrem.fromScene(envScene, 0, 0.1, 100).texture;
    editor.renderer.toneMapping = 4; // ACESFilmicToneMapping
    editor.renderer.toneMappingExposure = 1.0;
    pmrem.dispose(); skyGeo.dispose(); gndGeo.dispose(); pGeo.dispose();
    // Moderate light boost for PBR (Standard material /PI factor)
    var _al = editor.scene.getObjectByName('__default_ambient__');
    if (_al) _al.intensity = Math.max(_al.intensity, 0.3);
    var _hl = editor.scene.getObjectByName('__default_hemi__');
    if (_hl) _hl.intensity = Math.max(_hl.intensity, 0.5);
    // PBR key light for specular highlights
    if (!editor.scene.getObjectByName('__pbr_key__')) {
      var pbrKey = new T.DirectionalLight(0xFFFBF0, 1.2);
      pbrKey.name = '__pbr_key__';
      pbrKey.position.set(15, 30, -10);
      pbrKey.castShadow = false;
      editor.scene.add(pbrKey);
    }
    console.log("[GameEditorBridge] PBR env v44 (high-contrast studio)");
  }
  var flyMouseMoveHandler = null;
  var flyRMBDownHandler = null;
  var flyRMBUpHandler = null;
  var flyKeyUpHandler = null;
  var flyWheelHandler = null;
  var flyContextMenuHandler = null;

  // Signal that external bridge is loaded — embedded bridge (game-3d-templates.ts) defers to us
  window.__vibexeExternalBridge = true;

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
        if (v.isObject3D || v.isBufferGeometry || v.isMaterial || v instanceof HTMLElement) continue;
        try { JSON.stringify(v); safe[k] = v; } catch(e) { continue; }
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
        if (child === boxHelper || child === transformControls) continue;
        if (child.type === "BoxHelper" || child.type === "TransformControlsGizmo" || child.type === "TransformControlsPlane") continue;
        if (child.isTransformControls) continue;
        // Skip particles, trails, and Points objects (VFX internals)
        if (child.type === "Points") continue;
        if (child.name && (child.name.indexOf("__particle_") === 0 || child.name.indexOf("__trail_") === 0)) continue;
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
      _isMesh: !!obj.isMesh, _isLight: !!obj.isLight, _isGroup: !!obj.isGroup, _materialColor: matColor
    };
  }

  function sendSceneTree() {
    if (!editor || !editor.scene) return;
    window.parent.postMessage({ type: "game-editor-scene-tree", tree: serializeNode(editor.scene) }, "*");
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
    window.parent.postMessage({
      type: "game-editor-object-selected", uuid: obj.uuid, name: obj.name || obj.type,
      objType: obj.userData && obj.userData.vibexeType || obj.type,
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: { x: obj.rotation.x*180/Math.PI, y: obj.rotation.y*180/Math.PI, z: obj.rotation.z*180/Math.PI },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      visible: obj.visible !== false, castShadow: !!obj.castShadow,
      userData: safeUserData(obj.userData), _materialColor: matColor,
      _textureUrl: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureUrl || null,
      _textureTileX: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureTileX || 1,
      _textureTileY: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureTileY || 1,
      _textureRotation: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureRotation || 0,
      _textureOffsetX: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureOffsetX || 0,
      _textureOffsetY: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.textureOffsetY || 0,
      _hasPBR: obj.userData && obj.userData.vibexeArgs && obj.userData.vibexeArgs.hasPBR || false
    }, "*");
  }

  // ---- Selection ----
  function deselectObject() {
    if (boxHelper && editor) { editor.scene.remove(boxHelper); if (boxHelper.dispose) boxHelper.dispose(); boxHelper = null; }
    if (transformControls && editor) { transformControls.detach(); editor.scene.remove(transformControls); transformControls.dispose(); transformControls = null; }
    // Sweep: remove ALL stale __editor_ objects (handles duplicates from embedded bridge)
    if (editor && editor.scene) {
      var stale = [];
      for (var i = 0; i < editor.scene.children.length; i++) {
        var c = editor.scene.children[i];
        if (c.name && c.name.indexOf("__editor_") === 0) stale.push(c);
      }
      for (var j = 0; j < stale.length; j++) {
        if (stale[j].detach) stale[j].detach();
        editor.scene.remove(stale[j]);
        if (stale[j].dispose) stale[j].dispose();
      }
    }
    selectedObj = null;
    window.parent.postMessage({ type: "game-editor-object-deselected" }, "*");
  }

  function selectObject(obj) {
    if (!obj || !editor) return;
    // Never attach TransformControls to the scene root — causes infinite recursion in updateMatrixWorld
    // Triple-check: reference equality, type check, AND parent check (scene root has no parent)
    if (obj === editor.scene || obj.type === "Scene" || !obj.parent) {
      showDebug("SKIP: cannot select scene root (type=" + obj.type + " parent=" + !!obj.parent + ")");
      return;
    }
    deselectObject();
    selectedObj = obj;
    var THREE = window.THREE;
    boxHelper = new THREE.BoxHelper(obj, 0x00ff88);
    boxHelper.name = "__editor_box_helper__";
    // Override for animated characters — SkinnedMesh bind-pose gives wrong Box3
    // Use __characterBounds if available; otherwise fall back to default character dimensions
    if (obj.userData && obj.userData.vibexeType === "AnimatedCharacter") {
      var _cb = obj.userData.__characterBounds || { halfX: 0.45, halfZ: 0.45, height: 1.5 };
      var _bObj = obj;
      boxHelper.update = function() {
        var wp = new THREE.Vector3();
        _bObj.getWorldPosition(wp);
        var hx = _cb.halfX, hz = _cb.halfZ, h = _cb.height;
        var pos = this.geometry.attributes.position;
        if (!pos) return;
        var a = pos.array;
        a[0]=wp.x+hx; a[1]=wp.y+h; a[2]=wp.z+hz;
        a[3]=wp.x-hx; a[4]=wp.y+h; a[5]=wp.z+hz;
        a[6]=wp.x-hx; a[7]=wp.y;   a[8]=wp.z+hz;
        a[9]=wp.x+hx; a[10]=wp.y;  a[11]=wp.z+hz;
        a[12]=wp.x+hx;a[13]=wp.y+h;a[14]=wp.z-hz;
        a[15]=wp.x-hx;a[16]=wp.y+h;a[17]=wp.z-hz;
        a[18]=wp.x-hx;a[19]=wp.y;  a[20]=wp.z-hz;
        a[21]=wp.x+hx;a[22]=wp.y;  a[23]=wp.z-hz;
        pos.needsUpdate = true;
        this.geometry.computeBoundingSphere();
      };
      boxHelper.update();
    }
    editor.scene.add(boxHelper);
    if (THREE.TransformControls) {
      // Final safety: never attach to scene root
      if (obj === editor.scene || obj.type === "Scene") { showDebug("ABORT: refusing to attach TC to scene"); return; }
      console.log("[GameEditorBridge] TransformControls available, creating gizmo for: " + (obj.name || obj.type));
      transformControls = new THREE.TransformControls(editor.camera, editor.renderer.domElement);
      transformControls.name = "__editor_transform_controls__";
      transformControls.attach(obj);
      transformControls.addEventListener("dragging-changed", function(e) {
        if (editor.orbitControls) editor.orbitControls.enabled = !e.value;
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
            if (boxHelper) boxHelper.update();
          }
          persistTransform(selectedObj);
        }
      });
      transformControls.addEventListener("objectChange", function() {
        if (selectedObj) {
          sendSelectedObject(selectedObj);
          if (boxHelper) boxHelper.update();
          // Live-sync player position to Game Settings panel
          sendPlayerPositionUpdate(selectedObj);
        }
      });
      editor.scene.add(transformControls);
    } else {
      console.warn("[GameEditorBridge] TransformControls NOT available — gizmo disabled");
    }
    sendSelectedObject(obj);
    // Post-creation sweep: remove duplicate __editor_ objects from embedded bridge
    // Both bridges handle the same postMessage; embedded bridge may create duplicates.
    // setTimeout(0) runs after all synchronous message handlers have processed.
    var myBox = boxHelper;
    var myTC = transformControls;
    setTimeout(function() {
      if (!editor || !editor.scene) return;
      var dupes = [];
      for (var si = 0; si < editor.scene.children.length; si++) {
        var sc = editor.scene.children[si];
        if (sc.name && sc.name.indexOf("__editor_") === 0 && sc !== myBox && sc !== myTC) dupes.push(sc);
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
        if (selectedObj && selectedObj.uuid === entry.uuid) { sendSelectedObject(obj); if (boxHelper) boxHelper.update(); }
        redoStack.push({ type: "transform", uuid: entry.uuid,
          oldPos: entry.newPos, oldRot: entry.newRot, oldScl: entry.newScl,
          newPos: entry.oldPos, newRot: entry.oldRot, newScl: entry.oldScl });
      }
    } else if (entry.type === "delete") {
      editor.scene.add(entry.object);
      sendSceneTree();
      redoStack.push({ type: "delete-reverse", uuid: entry.uuid, object: entry.object });
    } else if (entry.type === "duplicate") {
      var dup = findByUuid(editor.scene, entry.uuid);
      if (dup) { editor.scene.remove(dup); deselectObject(); sendSceneTree(); redoStack.push({ type: "duplicate-reverse", uuid: entry.uuid, object: dup }); }
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
        if (selectedObj && selectedObj.uuid === entry.uuid) { sendSelectedObject(obj); if (boxHelper) boxHelper.update(); }
        undoStack.push({ type: "transform", uuid: entry.uuid,
          oldPos: entry.newPos, oldRot: entry.newRot, oldScl: entry.newScl,
          newPos: entry.oldPos, newRot: entry.oldRot, newScl: entry.oldScl });
      }
    } else if (entry.type === "delete-reverse") {
      editor.scene.remove(entry.object);
      if (selectedObj && selectedObj.uuid === entry.uuid) deselectObject();
      sendSceneTree();
      undoStack.push({ type: "delete", uuid: entry.uuid, object: entry.object });
    } else if (entry.type === "duplicate-reverse") {
      editor.scene.add(entry.object);
      sendSceneTree();
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
    window.parent.postMessage({ type: "game-editor-snap-changed", snap: gridSnap }, "*");
  }

  // ---- Focus Camera ----
  function focusSelected() {
    if (!selectedObj || !editor || !editor.orbitControls) return;
    var THREE = window.THREE;
    var box = new THREE.Box3().setFromObject(selectedObj);
    var center = new THREE.Vector3();
    box.getCenter(center);
    var size = new THREE.Vector3();
    box.getSize(size);
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
      // Update orbit target to where camera is now looking
      var THREE = window.THREE;
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
    clone.traverse(function(c) { c.uuid = window.THREE.MathUtils.generateUUID(); });
    // Give clone a unique name so persistTransform doesn't conflict with the original
    if (clone.name) { clone.name = clone.name + "_copy"; }
    editor.scene.add(clone);
    pushUndo({ type: "duplicate", uuid: clone.uuid });
    selectObject(clone);
    sendSceneTree();
    window.parent.postMessage({ type: "game-editor-object-duplicated", uuid: clone.uuid }, "*");
  }

  // ---- XZ Plane Drag ----
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
      sendSelectedObject(selectedObj);
      if (boxHelper) boxHelper.update();
      // Live-sync player position during XZ drag
      sendPlayerPositionUpdate(selectedObj);
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
    sendSceneTree();
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
      if (child.isMesh && child !== boxHelper && child.type !== "TransformControlsGizmo" && child.type !== "TransformControlsPlane" && (child.name||"").indexOf("__editor_") !== 0 && (child.name||"").indexOf("__particle_") !== 0 && (child.name||"").indexOf("__trail_") !== 0 && !isGroundPlane(child)) {
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
      if ((child.name || "").indexOf("__editor_") === 0) continue;
      if (child === boxHelper || child === transformControls) continue;
      if (child.isLight || child.type === "HemisphereLight" || child.type === "AmbientLight" || child.type === "DirectionalLight") continue;
      if (child.type === "GridHelper") continue;
      if (isGroundPlane(child)) continue;
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
      var msg = {
        type: "game-editor-persist-transform",
        name: obj.name,
        position: { x: +obj.position.x.toFixed(3), y: +obj.position.y.toFixed(3), z: +obj.position.z.toFixed(3) },
        rotation: { x: +(obj.rotation.x * 180 / Math.PI).toFixed(1), y: +(obj.rotation.y * 180 / Math.PI).toFixed(1), z: +(obj.rotation.z * 180 / Math.PI).toFixed(1) },
        scale: { x: +obj.scale.x.toFixed(3), y: +obj.scale.y.toFixed(3), z: +obj.scale.z.toFixed(3) }
      };
      console.log("[GameEditorBridge] persistTransform:", obj.name, "pos:", msg.position);
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
  function sendPlayerPositionUpdate(obj) {
    if (!obj || !isPlayerCharacter(obj)) return;
    var bounds = obj.userData && obj.userData.__characterBounds;
    window.parent.postMessage({
      type: "game-editor-player-position-update",
      position: { x: +obj.position.x.toFixed(3), y: +obj.position.y.toFixed(3), z: +obj.position.z.toFixed(3) },
      characterHeight: bounds ? bounds.height : 1.5
    }, "*");
  }

  // ---- Debug overlay ----
  // debugEl removed — showDebug now console-only
  function showDebug(msg) {
    console.log("[GameEditorBridge] " + msg);
  }

  // ---- Click + Drag + Keyboard ----
  var lastHandleClickTime = 0;
  function handleClick(clientX, clientY, source) {
    // Dedup: multiple listeners fire for same physical click — ignore if < 50ms apart
    var now = Date.now();
    if (now - lastHandleClickTime < 50) return;
    lastHandleClickTime = now;
    showDebug("Click from " + source + " at (" + Math.round(clientX) + ", " + Math.round(clientY) + ")");
    if (!active || !editor) { showDebug("SKIP: active=" + active + " editor=" + !!editor); return; }
    if (transformControls && (transformControls.dragging || transformControls.axis)) { showDebug("SKIP: gizmo active (dragging=" + transformControls.dragging + " axis=" + transformControls.axis + ")"); return; }
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
    }
  }

  function onCanvasMouseDown(e) {
    if (!active || !editor) return;
    if (e.button !== 0) return;
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
    var isMoveKey = e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD" || e.code === "KeyQ" || e.code === "KeyE";
    if (flyRMBDown && isMoveKey) {
      enterFlyMode();
      e.preventDefault();
      return;
    }
    // In fly mode, skip gizmo switching (WASD used for movement)
    if (flyMode && isMoveKey) {
      e.preventDefault();
      return;
    }
    // Ctrl+Shift+Z or Ctrl+Y — Redo
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
      applyRedo(); e.preventDefault(); return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
      applyRedo(); e.preventDefault(); return;
    }
    // Ctrl+Z — Undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      applyUndo(); e.preventDefault(); return;
    }
    // Ctrl+D — Duplicate
    if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
      duplicateSelected(); e.preventDefault(); return;
    }
    switch (e.key) {
      case "w": case "W":
        if (transformControls) transformControls.setMode("translate");
        window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "translate" }, "*");
        e.preventDefault(); break;
      case "e": case "E":
        if (transformControls) transformControls.setMode("rotate");
        window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "rotate" }, "*");
        e.preventDefault(); break;
      case "r": case "R":
        if (transformControls) transformControls.setMode("scale");
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
        else if (transformControls && transformControls.dragging) {
          // Cancel active gizmo drag — restore to pre-drag position
          if (selectedObj && transformControls.__undoPos) {
            selectedObj.position.set(transformControls.__undoPos.x, transformControls.__undoPos.y, transformControls.__undoPos.z);
            selectedObj.rotation.set(transformControls.__undoRot.x, transformControls.__undoRot.y, transformControls.__undoRot.z);
            selectedObj.scale.set(transformControls.__undoScl.x, transformControls.__undoScl.y, transformControls.__undoScl.z);
            sendSelectedObject(selectedObj);
            if (boxHelper) boxHelper.update();
          }
        }
        else if (isDragging) { endXZDrag(); }
        else { deselectObject(); }
        e.preventDefault(); break;
      case "Delete": case "Backspace":
        if (selectedObj && editor) {
          var delObj = selectedObj;
          var uuid = delObj.uuid;
          pushUndo({ type: "delete", uuid: uuid, object: delObj });
          editor.scene.remove(delObj);
          deselectObject(); sendSceneTree();
          window.parent.postMessage({ type: "game-editor-object-deleted", uuid: uuid }, "*");
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
  function editorLoop() {
    if (!active || !editor) return;
    editorAnimId = requestAnimationFrame(editorLoop);
    updateFlyMovement();
    if (editor.orbitControls && !flyMode) editor.orbitControls.update();
    if (boxHelper && selectedObj) boxHelper.update();
    // Per-frame sweep: remove duplicate __editor_ objects (old Game3D.tsx templates lack _hasExt guard)
    if (editor.scene) {
      var dupes = [];
      for (var ei = 0; ei < editor.scene.children.length; ei++) {
        var ec = editor.scene.children[ei];
        if (ec.name && ec.name.indexOf("__editor_") === 0 && ec !== boxHelper && ec !== transformControls && ec !== gridHelper) dupes.push(ec);
      }
      for (var di = 0; di < dupes.length; di++) { if (dupes[di].detach) dupes[di].detach(); editor.scene.remove(dupes[di]); if (dupes[di].dispose) dupes[di].dispose(); }
    }
    try {
      // Use EffectComposer when available (preserves post-processing in editor mode)
      var composer = window.__vibexe_composer__;
      if (composer && composer.render) {
        composer.render();
      } else {
        editor.renderer.render(editor.scene, editor.camera);
      }
    } catch (e) {
      // Prevent cascading crashes (e.g., TransformControls infinite recursion)
      console.error("[GameEditorBridge] Render error — cleaning up:", e.message);
      deselectObject();
    }
  }

  // ---- Activate / Deactivate ----
  var pendingActivate = false;
  function activateBridge() {
    if (active || pendingActivate) return;
    pendingActivate = true;
    waitForEditor(function(ed) {
      editor = ed;
      active = true;
      pendingActivate = false;
      window.__vibexe_editor_active__ = true;
      var THREE = window.THREE;
      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();
      editor.pause();
      // Fix OrbitControls for editor mode — must use deferred override because
      // the embedded bridge in Game3D.tsx also handles game-editor-activate and
      // calls pause() which creates OrbitControls with default mouseButtons.
      // Unity-style: LEFT=select/gizmo, MIDDLE=pan, RIGHT=orbit, scroll=zoom
      function fixOrbitControls() {
        if (!editor || !editor.orbitControls) return;
        var oc = editor.orbitControls;
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
        }
        fixOrbitControls();
      }
      // Deferred fix — catches embedded bridge's pause() overwriting our settings
      setTimeout(fixOrbitControls, 50);
      setTimeout(fixOrbitControls, 200);
      showDebug("Bridge ACTIVATED. Canvas: " + editor.renderer.domElement.tagName + " " + editor.renderer.domElement.width + "x" + editor.renderer.domElement.height);
      // On activation, fix any PBR materials created by the override (which lacks env setup)
      setTimeout(function() {
        var _hasPBR = false;
        editor.scene.traverse(function(c) {
          if (c.isMesh && c.material && c.material.isMeshStandardMaterial) _hasPBR = true;
        });
        if (_hasPBR) {
          _ensurePBREnv();
          // Cap ambient light — override leaves it at 2.0 which floods StandardMaterial
          var _al2 = editor.scene.getObjectByName('__default_ambient__');
          if (_al2 && _al2.intensity > 0.5) { _al2.intensity = 0.3; }
          if (editor.scene.environment) {
            editor.scene.traverse(function(c) {
              if (c.isMesh && c.material && c.material.isMeshStandardMaterial) {
                if (!c.material.envMap) c.material.envMap = editor.scene.environment;
                // Fix override values: envMapIntensity and metalness
                if (c.material.metalnessMap) {
                  // PBR metal texture — use bridge values
                  c.material.envMapIntensity = 1.0;
                  c.material.metalness = 0.95;
                } else {
                  c.material.envMapIntensity = 0.3;
                }
                c.material.needsUpdate = true;
              }
            });
            showDebug("PBR env patched for override materials");
          }
        }
      }, 300);
      // Prevent right-click context menu on canvas (for flythrough mode)
      flyContextMenuHandler = function(e) { if (active) e.preventDefault(); };
      editor.renderer.domElement.addEventListener("contextmenu", flyContextMenuHandler);
      // Flythrough: track right mouse button
      flyRMBDownHandler = function(e) {
        if (!active || !editor || e.button !== 2) return;
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
      // Also listen directly on the canvas element (belt and suspenders)
      // Store reference so we can remove on deactivate (prevents handler accumulation)
      canvasPointerDownHandler = function(e) {
        if (!active || !editor) return;
        if (e.button !== 0) return;
        showDebug("pointerdown on canvas: " + e.clientX + "," + e.clientY);
        handleClick(e.clientX, e.clientY, "canvas-pointerdown");
      };
      editor.renderer.domElement.addEventListener("pointerdown", canvasPointerDownHandler, false);
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
          hel.style.pointerEvents = "none";
          hel.setAttribute("data-editor-hidden", "1");
        }
      }
      editorLoop();
      setTimeout(function() {
        sendSceneTree();
        window.parent.postMessage({ type: "game-editor-ready" }, "*");
      }, 100);
    });
  }

  function deactivateBridge() {
    if (!active) return;
    active = false;
    window.__vibexe_editor_active__ = false;
    cancelAnimationFrame(editorAnimId);
    // Clear pending persistTransform timer to prevent stale messages after deactivation
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    // Exit fly mode if active
    if (flyMode) exitFlyMode();
    flyMode = false; flyKeys = {}; flyRMBDown = false; flyLastMouse = null;
    // Clean up animation progress interval
    if (__animProgressInterval) { clearInterval(__animProgressInterval); __animProgressInterval = null; }
    deselectObject();
    if (isDragging) endXZDrag();
    if (gridHelper && editor) { editor.scene.remove(gridHelper); if (gridHelper.dispose) gridHelper.dispose(); gridHelper = null; }
    // Dispose editor-created OrbitControls
    if (editor && editor.orbitControls && editor.orbitControls._vibexeEditorCreated) {
      editor.orbitControls.dispose();
      editor.orbitControls = null;
    }
    gridSnap = false;
    undoStack = [];
    // Restore game HUD pointer events
    var hiddenEls = document.querySelectorAll("[data-editor-hidden]");
    for (var ri = 0; ri < hiddenEls.length; ri++) {
      hiddenEls[ri].style.pointerEvents = "";
      hiddenEls[ri].removeAttribute("data-editor-hidden");
    }
    if (editor) {
      editor.resume();
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
    if (boxHelper && selectedObj && selectedObj.uuid === uuid) boxHelper.update();
    sendSelectedObject(obj); sendSceneTree();
    // Persist transform/property changes to source code
    if (property.indexOf("position") === 0 || property.indexOf("rotation") === 0 || property.indexOf("scale") === 0) {
      persistTransform(obj);
    }
  }

  // ---- PostMessage Handler ----
  window.addEventListener("message", function(e) {
    var d = e.data;
    if (!d || !d.type) return;
    switch (d.type) {
      case "game-editor-enable": activateBridge(); break;
      case "game-editor-disable": deactivateBridge(); break;
      case "game-editor-set-mode":
        if (transformControls && d.mode) transformControls.setMode(d.mode); break;
      case "game-editor-select-by-uuid":
        if (editor && d.uuid) {
          var obj = findByUuid(editor.scene, d.uuid);
          // Skip scene root at handler level too (defense in depth)
          if (obj && obj !== editor.scene && obj.type !== "Scene") selectObject(obj);
        } break;
      case "game-editor-deselect": deselectObject(); break;
      case "game-editor-update-property":
        if (d.uuid && d.property !== undefined) updateProperty(d.uuid, d.property, d.value); break;
      case "game-editor-delete-object":
        if (editor && d.uuid) {
          var toDelete = findByUuid(editor.scene, d.uuid);
          if (toDelete) {
            pushUndo({ type: "delete", uuid: d.uuid, object: toDelete });
            if (selectedObj && selectedObj.uuid === d.uuid) deselectObject();
            editor.scene.remove(toDelete); sendSceneTree();
          }
        } break;
      case "game-editor-request-tree": sendSceneTree(); break;
      case "game-editor-focus": focusSelected(); break;
      case "game-editor-duplicate": duplicateSelected(); break;
      case "game-editor-undo": applyUndo(); break;
      case "game-editor-redo": applyRedo(); break;
      case "game-editor-toggle-snap": toggleGridHelper(); break;
      case "game-editor-toggle-space":
        gizmoSpace = gizmoSpace === "world" ? "local" : "world";
        if (transformControls && transformControls.setSpace) transformControls.setSpace(gizmoSpace);
        window.parent.postMessage({ type: "game-editor-gizmo-space", space: gizmoSpace }, "*");
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
      case "game-editor-set-snap-settings":
        if (typeof d.gridIncrement === "number") gridSnapIncrement = d.gridIncrement;
        if (typeof d.rotationDeg === "number") rotationSnapDeg = d.rotationDeg;
        break;
      case "game-editor-set-spawn-mode":
        window.__vibexe_spawn_mode__ = !!d.active;
        window.__vibexe_spawn_factory__ = d.factory || null;
        window.__vibexe_spawn_args__ = d.args || null;
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
                if (boxHelper) boxHelper.update();
                // Don't sendSelectedObject here — parent already knows the position
                // (it sent this message). Calling it would create a feedback loop.
              }
            }
          });
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
        if (!active) { activateBridge(); }
        // Wait a tick for activation, then process click
        setTimeout(function() {
          if (!active || !editor) return;
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
          if (transformControls && (transformControls.dragging || transformControls.axis)) return;
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
        var fakeEvent = { key: d.key, ctrlKey: !!d.ctrlKey, metaKey: !!d.metaKey, target: { tagName: "BODY" }, preventDefault: function() {} };
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
          if (isSRGB) {
            if (_THREE.SRGBColorSpace) tex.colorSpace = _THREE.SRGBColorSpace;
            else if (_THREE.sRGBEncoding) tex.encoding = _THREE.sRGBEncoding;
          } else {
            if (_THREE.LinearSRGBColorSpace) tex.colorSpace = _THREE.LinearSRGBColorSpace;
            else if (_THREE.LinearEncoding) tex.encoding = _THREE.LinearEncoding;
          }
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
          var _pbrUrls = [_atResolved, _bne+'_Normal'+_ext, _bne+'_Roughness'+_ext, _isMetal ? _bne+'_Metalness'+_ext : '', _bne+'_AO'+_ext];
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
                roughness: roughnessTex ? 1.0 : (_isMetal ? 0.3 : 0.7),
                metalness: _metalVal,
                envMapIntensity: _envIntensity,
                side: _THREE.DoubleSide
              };
              if (editor && editor.scene && editor.scene.environment) _matOpts.envMap = editor.scene.environment;
              if (normalTex) {
                _matOpts.normalMap = _atCfg(normalTex.clone(), false);
                _matOpts.normalScale = new _THREE.Vector2(_nScale, _nScale);
              }
              if (roughnessTex) _matOpts.roughnessMap = _atCfg(roughnessTex.clone(), false);
              if (metalnessTex && _isMetal) _matOpts.metalnessMap = _atCfg(metalnessTex.clone(), false);
              if (aoTex) {
                _matOpts.aoMap = _atCfg(aoTex.clone(), false);
                _matOpts.aoMapIntensity = 1.0;
                if (m.geometry && m.geometry.attributes.uv && !m.geometry.attributes.uv2) {
                  m.geometry.setAttribute('uv2', m.geometry.attributes.uv);
                }
              }
              m.material = new _THREE.MeshStandardMaterial(_matOpts);
              m.material.needsUpdate = true;
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
              if (!m.isMesh || !m.material) return;
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
          var c = m.material && m.material.color ? m.material.color.getHex() : 0xffffff;
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
          if (!m.isMesh || !m.material) return;
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
`;
}
