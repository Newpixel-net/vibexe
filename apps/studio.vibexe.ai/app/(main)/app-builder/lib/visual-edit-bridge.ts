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
// Only activates when THREE.js is available and game-editor-enable is received.
(function() {
  if (!window.THREE) return; // Not a 3D game — skip entirely

  var active = false;
  var raycaster = null;
  var mouse = null;
  var selectedObj = null;
  var boxHelper = null;
  var transformControls = null;
  var editor = null;
  var editorAnimId = 0;

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

  // ---- Scene Serializer ----
  function serializeNode(obj) {
    if (!obj) return null;
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

  // ---- Click + Keyboard ----
  function onCanvasClick(e) {
    if (!active || !editor) return;
    if (transformControls && transformControls.dragging) return;
    var THREE = window.THREE;
    var rect = editor.renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, editor.camera);
    var meshes = [];
    editor.scene.traverse(function(child) {
      if (child.isMesh && child !== boxHelper && child.type !== "TransformControlsGizmo" && child.type !== "TransformControlsPlane" && !(child.name||"").indexOf("__editor_") === 0) {
        meshes.push(child);
      }
    });
    var intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      var target = findSceneParent(intersects[0].object);
      if (target && target !== editor.scene) selectObject(target);
    } else {
      deselectObject();
    }
  }

  function onKeyDown(e) {
    if (!active) return;
    var tag = (e.target || {}).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
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
      case "Escape": deselectObject(); e.preventDefault(); break;
      case "Delete": case "Backspace":
        if (selectedObj && editor) {
          var uuid = selectedObj.uuid;
          editor.scene.remove(selectedObj);
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
      editor.renderer.domElement.addEventListener("click", onCanvasClick);
      window.addEventListener("keydown", onKeyDown, true);
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
    if (editor) {
      editor.renderer.domElement.removeEventListener("click", onCanvasClick);
      editor.resume();
    }
    window.removeEventListener("keydown", onKeyDown, true);
    raycaster = null; mouse = null; editor = null;
  }

  // ---- Property Updates ----
  function updateProperty(uuid, property, value) {
    if (!editor) return;
    var obj = findByUuid(editor.scene, uuid);
    if (!obj) return;
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
    }
  });
})();
`;
}
