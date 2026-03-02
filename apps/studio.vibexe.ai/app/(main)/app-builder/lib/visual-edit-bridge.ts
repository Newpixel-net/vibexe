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
  var gridSnap = false;
  var gridHelper = null;

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
      visible: obj.visible !== false, userData: obj.userData || {}, children: children,
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
    window.parent.postMessage({
      type: "game-editor-object-selected", uuid: obj.uuid, name: obj.name || obj.type,
      objType: obj.userData && obj.userData.vibexeType || obj.type,
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: { x: obj.rotation.x*180/Math.PI, y: obj.rotation.y*180/Math.PI, z: obj.rotation.z*180/Math.PI },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      visible: obj.visible !== false, castShadow: !!obj.castShadow,
      userData: obj.userData || {}, _materialColor: matColor
    }, "*");
  }

  // ---- Selection ----
  function deselectObject() {
    if (boxHelper && editor) { editor.scene.remove(boxHelper); if (boxHelper.dispose) boxHelper.dispose(); boxHelper = null; }
    if (transformControls && editor) { transformControls.detach(); editor.scene.remove(transformControls); transformControls.dispose(); transformControls = null; }
    selectedObj = null;
    window.parent.postMessage({ type: "game-editor-object-deselected" }, "*");
  }

  function selectObject(obj) {
    deselectObject();
    if (!obj || !editor) return;
    selectedObj = obj;
    var THREE = window.THREE;
    boxHelper = new THREE.BoxHelper(obj, 0x00ff88);
    boxHelper.name = "__editor_box_helper__";
    editor.scene.add(boxHelper);
    if (THREE.TransformControls) {
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
            selectedObj.position.z = snapToGrid(selectedObj.position.z);
            sendSelectedObject(selectedObj);
            if (boxHelper) boxHelper.update();
          }
          persistTransform(selectedObj);
        }
      });
      transformControls.addEventListener("objectChange", function() {
        if (selectedObj) { sendSelectedObject(selectedObj); if (boxHelper) boxHelper.update(); }
      });
      editor.scene.add(transformControls);
    }
    sendSelectedObject(obj);
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

  // ---- Undo Stack ----
  function pushUndo(entry) {
    undoStack.push(entry);
    if (undoStack.length > 50) undoStack.shift();
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
      }
    } else if (entry.type === "delete") {
      editor.scene.add(entry.object);
      sendSceneTree();
    } else if (entry.type === "duplicate") {
      var dup = findByUuid(editor.scene, entry.uuid);
      if (dup) { editor.scene.remove(dup); deselectObject(); sendSceneTree(); }
    } else if (entry.type === "property") {
      var obj2 = findByUuid(editor.scene, entry.uuid);
      if (obj2) { updateProperty(entry.uuid, entry.property, entry.oldValue); undoStack.pop(); }
    }
  }

  // ---- Grid Snap ----
  function snapToGrid(v) { return Math.round(v * 2) / 2; }

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

  // ---- Duplicate ----
  function duplicateSelected() {
    if (!selectedObj || !editor) return;
    var clone = selectedObj.clone(true);
    clone.position.x += 1;
    clone.traverse(function(c) { c.uuid = window.THREE.MathUtils.generateUUID(); });
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
      if (child.isMesh && child !== boxHelper && child.type !== "TransformControlsGizmo" && child.type !== "TransformControlsPlane" && (child.name||"").indexOf("__editor_") !== 0 && !isGroundPlane(child)) {
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
    if (!obj || !obj.name) return;
    // Debounce: batch rapid changes (e.g. during drag) into one update
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function() {
      window.parent.postMessage({
        type: "game-editor-persist-transform",
        name: obj.name,
        position: { x: +obj.position.x.toFixed(3), y: +obj.position.y.toFixed(3), z: +obj.position.z.toFixed(3) },
        rotation: { x: +(obj.rotation.x * 180 / Math.PI).toFixed(1), y: +(obj.rotation.y * 180 / Math.PI).toFixed(1), z: +(obj.rotation.z * 180 / Math.PI).toFixed(1) },
        scale: { x: +obj.scale.x.toFixed(3), y: +obj.scale.y.toFixed(3), z: +obj.scale.z.toFixed(3) }
      }, "*");
    }, 300);
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
      case "f": case "F":
        focusSelected(); e.preventDefault(); break;
      case "g": case "G":
        toggleGridHelper(); e.preventDefault(); break;
      case "Escape":
        if (isDragging) { endXZDrag(); } else { deselectObject(); }
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
    }
  }

  // ---- Editor Loop ----
  function editorLoop() {
    if (!active || !editor) return;
    editorAnimId = requestAnimationFrame(editorLoop);
    if (editor.orbitControls) editor.orbitControls.update();
    if (boxHelper && selectedObj) boxHelper.update();
    editor.renderer.render(editor.scene, editor.camera);
  }

  // ---- Activate / Deactivate ----
  function activateBridge() {
    if (active) return;
    waitForEditor(function(ed) {
      editor = ed;
      active = true;
      var THREE = window.THREE;
      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();
      editor.pause();
      // Create OrbitControls for camera movement in editor mode
      if (THREE.OrbitControls && !editor.orbitControls) {
        editor.orbitControls = new THREE.OrbitControls(editor.camera, editor.renderer.domElement);
        editor.orbitControls._vibexeEditorCreated = true;
        editor.orbitControls.enableDamping = true;
        editor.orbitControls.dampingFactor = 0.12;
        editor.orbitControls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
        // Look at center of scene initially
        editor.orbitControls.target.set(0, 2, 0);
        editor.orbitControls.update();
      }
      showDebug("Bridge ACTIVATED. Canvas: " + editor.renderer.domElement.tagName + " " + editor.renderer.domElement.width + "x" + editor.renderer.domElement.height);
      // Register click handlers: window capture + canvas direct + pointerdown backup
      window.addEventListener("mousedown", onCanvasMouseDown, true);
      window.addEventListener("mousemove", onCanvasMouseMove, true);
      window.addEventListener("mouseup", onCanvasMouseUp, true);
      window.addEventListener("keydown", onKeyDown, true);
      // Also listen directly on the canvas element (belt and suspenders)
      editor.renderer.domElement.addEventListener("pointerdown", function(e) {
        if (!active || !editor) return;
        if (e.button !== 0) return;
        showDebug("pointerdown on canvas: " + e.clientX + "," + e.clientY);
        handleClick(e.clientX, e.clientY, "canvas-pointerdown");
      }, false);
      // Also listen on document.body for clicks (catches clicks on HUD overlays)
      document.body.addEventListener("mousedown", function(e) {
        if (!active || !editor) return;
        if (e.button !== 0) return;
        showDebug("body-mousedown: " + e.clientX + "," + e.clientY + " target=" + (e.target||{}).tagName + " class=" + ((e.target||{}).className||"").toString().slice(0,30));
        // Only forward to handleClick if not already handled (check if target is canvas or its parent)
        if (e.target !== editor.renderer.domElement) {
          handleClick(e.clientX, e.clientY, "body-mousedown");
        }
      }, true);
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
    cancelAnimationFrame(editorAnimId);
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
        if (editor && d.uuid) { var obj = findByUuid(editor.scene, d.uuid); if (obj) selectObject(obj); } break;
      case "game-editor-deselect": deselectObject(); break;
      case "game-editor-update-property":
        if (d.uuid && d.property !== undefined) updateProperty(d.uuid, d.property, d.value); break;
      case "game-editor-delete-object":
        if (editor && d.uuid) {
          var toDelete = findByUuid(editor.scene, d.uuid);
          if (toDelete) { if (selectedObj && selectedObj.uuid === d.uuid) deselectObject(); editor.scene.remove(toDelete); sendSceneTree(); }
        } break;
      case "game-editor-request-tree": sendSceneTree(); break;
      case "game-editor-focus": focusSelected(); break;
      case "game-editor-duplicate": duplicateSelected(); break;
      case "game-editor-undo": applyUndo(); break;
      case "game-editor-toggle-snap": toggleGridHelper(); break;
      case "game-editor-viewport-click":
        // Click forwarded from parent page — handles cross-origin iframe event routing
        if (!active) { activateBridge(); }
        // Wait a tick for activation, then process click
        setTimeout(function() {
          if (!active || !editor) return;
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
