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
  var tagBadge = null;

  var SKIP_SELECTORS = ['html','head','body','#root','script','style','link','meta','title','[id="visual-edit-bridge"]'];

  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return true;
    for (var i = 0; i < SKIP_SELECTORS.length; i++) {
      try { if (el.matches(SKIP_SELECTORS[i])) return true; } catch(e) {}
    }
    return false;
  }

  function createOverlay(id, style) {
    var div = document.createElement('div');
    div.id = id;
    div.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;transition:all 0.1s ease;' + (style || '');
    document.body.appendChild(div);
    return div;
  }

  function positionOverlay(overlay, rect) {
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }

  function ensureOverlays() {
    if (!hoverOverlay) {
      hoverOverlay = createOverlay('ve-hover', 'border:2px dashed #3b82f6;background:rgba(59,130,246,0.05);');
      hoverOverlay.style.display = 'none';
    }
    if (!selectOverlay) {
      selectOverlay = createOverlay('ve-select', 'border:2px solid #7c3aed;background:rgba(124,58,237,0.06);box-shadow:0 0 0 1px rgba(124,58,237,0.3);');
      selectOverlay.style.display = 'none';
    }
    if (!tagBadge) {
      tagBadge = document.createElement('div');
      tagBadge.id = 've-tag';
      tagBadge.style.cssText = 'position:fixed;pointer-events:none;z-index:100000;padding:1px 6px;font-size:10px;font-family:monospace;background:#3b82f6;color:white;border-radius:3px;display:none;white-space:nowrap;';
      document.body.appendChild(tagBadge);
    }
  }

  function getUniqueSelector(el) {
    if (el.id) return '#' + el.id;
    var path = [];
    var current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      var tag = current.tagName.toLowerCase();
      if (current.id) { path.unshift('#' + current.id); break; }
      var classes = Array.from(current.classList).filter(function(c) { return !/^(\\s)/.test(c); }).slice(0, 3);
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
      margin: cs.margin,
      textAlign: cs.textAlign,
      textDecoration: cs.textDecoration,
      textTransform: cs.textTransform,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      display: cs.display,
      width: cs.width,
      height: cs.height
    };
  }

  function onMouseOver(e) {
    if (!enabled) return;
    var el = e.target;
    if (shouldSkip(el)) return;
    if (el === selected) return;
    ensureOverlays();
    var rect = el.getBoundingClientRect();
    positionOverlay(hoverOverlay, rect);
    hoverOverlay.style.display = 'block';
    tagBadge.textContent = el.tagName.toLowerCase();
    tagBadge.style.top = (rect.top - 18) + 'px';
    tagBadge.style.left = rect.left + 'px';
    tagBadge.style.display = 'block';
  }

  function onMouseOut(e) {
    if (!enabled) return;
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    if (tagBadge) tagBadge.style.display = 'none';
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
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    if (tagBadge) tagBadge.style.display = 'none';

    window.parent.postMessage({
      type: 'visual-edit-select',
      tagName: el.tagName.toLowerCase(),
      className: el.className || '',
      textContent: (el.textContent || '').slice(0, 200),
      innerHTML: (el.innerHTML || '').slice(0, 500),
      boundingRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      selector: getUniqueSelector(el),
      computedStyles: getComputedStyleMap(el)
    }, '*');
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && enabled) {
      if (selected) {
        selected = null;
        if (selectOverlay) selectOverlay.style.display = 'none';
        window.parent.postMessage({ type: 'visual-edit-deselect' }, '*');
      }
    }
  }

  function activate() {
    enabled = true;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function deactivate() {
    enabled = false;
    selected = null;
    document.body.style.cursor = '';
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    if (selectOverlay) selectOverlay.style.display = 'none';
    if (tagBadge) tagBadge.style.display = 'none';
  }

  function handleHighlight(selector) {
    try {
      var el = document.querySelector(selector);
      if (el) {
        ensureOverlays();
        var rect = el.getBoundingClientRect();
        positionOverlay(selectOverlay, rect);
        selectOverlay.style.display = 'block';
        selected = el;
      }
    } catch(e) {}
  }

  function handleUpdateStyle(selector, property, value) {
    try {
      var el = document.querySelector(selector);
      if (!el) return;
      // For className updates
      if (property === 'className') {
        el.className = value;
        return;
      }
      // For direct style property
      el.style[property] = value;
    } catch(e) {}
  }

  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || !d.type) return;
    switch(d.type) {
      case 'visual-edit-enable': activate(); break;
      case 'visual-edit-disable': deactivate(); break;
      case 'visual-edit-highlight': handleHighlight(d.selector); break;
      case 'visual-edit-update-style': handleUpdateStyle(d.selector, d.property, d.value); break;
      case 'visual-edit-deselect-cmd':
        selected = null;
        if (selectOverlay) selectOverlay.style.display = 'none';
        break;
    }
  });
})();
`;
}
