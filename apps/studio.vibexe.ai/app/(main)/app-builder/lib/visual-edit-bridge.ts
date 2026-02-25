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
`;
}
