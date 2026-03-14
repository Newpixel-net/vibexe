/**
 * World Builder Bridge Script — Phase 2-13 Complete
 *
 * Full PWB-style object placement system running in the Sandpack iframe.
 * 12 tools: Pin, Brush, Gravity, Line, Shape, Floor, Wall, Eraser,
 * Replacer, Select, Extrude, Mirror.
 *
 * Includes: BoundsOctree, surface alignment, brush density/spacing,
 * bezier curves, shape placement, tiling grid, physics gravity,
 * selection management, extrude/mirror operations, pattern machine.
 *
 * Depends on window.THREE (r128) and window.__vibexe_editor__.
 */

export function getWorldBuilderBridgeScript(): string {
	return `
(function() {
  console.log("[WorldBuilder] Bridge v3 loaded");

  // ===== State =====
  var _active = false;
  var _tool = "pin";
  var _scene = null;
  var _camera = null;
  var _renderer = null;
  var _currentCanvas = null;
  var _raycaster = null;
  var _mouse = new THREE.Vector2(-999, -999);
  var _mouseDown = false;
  var _mouseButton = -1;
  var _lastBrushPos = null;

  // Preview mesh
  var _previewMesh = null;
  var _previewVisible = false;
  var _previewValid = true;

  // Placed objects registry
  var _placedObjects = {};
  var _nextPlacedId = 1;

  // Undo/redo
  var _undoStack = [];
  var _redoStack = [];
  var MAX_UNDO = 50;

  // Grid
  var _gridHelper = null;

  // Eraser/Replacer circle visualization
  var _eraserCircle = null;

  // Snap settings
  var _snap = {
    enabled: false, gridType: "rectangular",
    step: { x: 1, y: 1, z: 1 }, origin: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    snappingOn: { x: true, y: false, z: true },
    showGrid: true, gridAxes: { x: false, y: true, z: false },
    radialStep: 1, radialSectors: 8, midpointSnapping: false,
  };

  // Brush settings (per-object transforms)
  var _brush = {
    surfaceDistance: 0, randomSurfaceDistance: false,
    randomSurfaceDistanceRange: { min: -0.005, max: 0.005 },
    embedInSurface: false, embedAtPivotHeight: true,
    localPositionOffset: { x: 0, y: 0, z: 0 },
    rotateToSurface: true, eulerOffset: { x: 0, y: 0, z: 0 },
    addRandomRotation: false, rotationFactor: 90, rotateInMultiples: false,
    randomEulerOffset: { x: { min: -180, max: 180 }, y: { min: -180, max: 180 }, z: { min: -180, max: 180 } },
    alwaysOrientUp: false, separateScaleAxes: false,
    scaleMultiplier: { x: 1, y: 1, z: 1 }, randomScaleMultiplier: false,
    randomScaleMultiplierRange: { x: { min: 0.8, max: 1.2 }, y: { min: 0.8, max: 1.2 }, z: { min: 0.8, max: 1.2 } },
    flipX: "none", flipY: "none",
  };

  // Per-tool settings
  var _pin = { repeat: false, avoidOverlapping: false, flattenTerrain: false };
  var _brushTool = {
    brushShape: "circle", radius: 5, density: 50, minSpacing: 0.5,
    randomizePositions: true, orientAlongBrushstroke: false,
    avoidOverlapping: "all", slopeFilter: { min: 0, max: 60 },
    paintMode: "auto",
  };
  var _eraser = { radius: 3, onlyClosest: false };
  var _line = {
    spacingType: "bounds", gapSize: 0, spacing: 1,
    objectsOrientedAlongLine: true, axisOrientedAlongLine: "z", closed: false,
  };
  var _shape = {
    shapeType: "circle", sidesCount: 6, axisNormalToSurface: true,
    spacingType: "bounds", gapSize: 0, spacing: 1,
    objectsOrientedAlongLine: true, axisOrientedAlongLine: "z",
  };
  var _tiling = {
    cellSizeType: "biggest", cellSize: { w: 1, h: 1 },
    spacing: { w: 0, h: 0 }, axisAlignedWithNormal: "y",
  };
  var _gravity = { height: 10, mass: 1, drag: 0, maxIterations: 200 };
  var _replacer = { radius: 3, keepTargetSize: true, maintainProportions: true, positionMode: "center" };
  var _extrude = {
    spacingType: "box-size", spacing: { x: 1, y: 1, z: 1 },
    multiplier: { x: 1, y: 1, z: 1 }, addRandomRotation: false,
    eulerOffset: { x: 0, y: 0, z: 0 },
    randomEulerOffset: { x: { min: 0, max: 0 }, y: { min: 0, max: 0 }, z: { min: 0, max: 0 } },
  };
  var _mirror = { reflectRotation: true, action: "create", invertScale: false };

  // Active palette item
  var _activeItem = null;

  // Model cache
  var _modelCache = {};

  // Raycast targets
  var _raycastTargets = [];

  // ===== Line Tool State =====
  var _linePoints = []; // control points [{x,y,z}]
  var _lineVisuals = null; // THREE.Group for line visualization
  var _linePreviewObjects = []; // preview meshes along line

  // ===== Shape Tool State =====
  var _shapeCenter = null;
  var _shapeRadius = 0;
  var _shapeVisual = null;
  var _shapePreviewObjects = [];
  var _shapeDragging = false;

  // ===== Tiling Tool State =====
  var _tilingCorner1 = null;
  var _tilingCorner2 = null;
  var _tilingVisual = null;
  var _tilingPreviewObjects = [];
  var _tilingDragging = false;

  // ===== Selection State =====
  var _selectedIds = [];
  var _selectionBox = null;

  // ===== Extrude State =====
  var _extrudeDragging = false;
  var _extrudeAxis = null;
  var _extrudeStartPos = null;
  var _extrudePreviewObjects = [];

  // ===== Mirror State =====
  var _mirrorPlane = null;
  var _mirrorNormal = null;
  var _mirrorPreviewObjects = [];

  // ===== Pattern Machine =====
  var _patternMode = "random"; // random, sequential, pattern
  var _patternString = "";
  var _patternIndex = 0;

  // ===== BoundsOctree =====
  var _octree = null;

  function OctreeNode(center, halfSize, minSize) {
    this.center = center;
    this.halfSize = halfSize;
    this.minSize = minSize;
    this.objects = [];
    this.children = null;
  }
  OctreeNode.prototype.bestChild = function(p) {
    return (p.x > this.center.x ? 1 : 0)
         + (p.z > this.center.z ? 2 : 0)
         + (p.y > this.center.y ? 4 : 0);
  };
  OctreeNode.prototype.split = function() {
    var q = this.halfSize / 2;
    var c = this.center;
    this.children = [];
    for (var i = 0; i < 8; i++) {
      var ox = (i & 1) ? q : -q;
      var oz = (i & 2) ? q : -q;
      var oy = (i & 4) ? q : -q;
      this.children.push(new OctreeNode(
        { x: c.x + ox, y: c.y + oy, z: c.z + oz }, q, this.minSize
      ));
    }
  };
  OctreeNode.prototype.insert = function(id, mn, mx) {
    if (this.objects.length < 8 || this.halfSize <= this.minSize) {
      this.objects.push({ id: id, min: mn, max: mx });
      return;
    }
    if (!this.children) this.split();
    var cx = (mn.x + mx.x) / 2, cy = (mn.y + mx.y) / 2, cz = (mn.z + mx.z) / 2;
    var idx = this.bestChild({ x: cx, y: cy, z: cz });
    var child = this.children[idx];
    var loose = child.halfSize * 1.2;
    var fits = mn.x >= child.center.x - loose && mx.x <= child.center.x + loose
           && mn.y >= child.center.y - loose && mx.y <= child.center.y + loose
           && mn.z >= child.center.z - loose && mx.z <= child.center.z + loose;
    if (fits) child.insert(id, mn, mx);
    else this.objects.push({ id: id, min: mn, max: mx });
  };
  OctreeNode.prototype.remove = function(id) {
    for (var i = this.objects.length - 1; i >= 0; i--) {
      if (this.objects[i].id === id) { this.objects.splice(i, 1); return true; }
    }
    if (this.children) {
      for (var i = 0; i < 8; i++) {
        if (this.children[i].remove(id)) return true;
      }
    }
    return false;
  };
  OctreeNode.prototype.query = function(mn, mx, results) {
    var loose = this.halfSize * 1.2;
    if (mn.x > this.center.x + loose || mx.x < this.center.x - loose) return;
    if (mn.y > this.center.y + loose || mx.y < this.center.y - loose) return;
    if (mn.z > this.center.z + loose || mx.z < this.center.z - loose) return;
    for (var i = 0; i < this.objects.length; i++) {
      var o = this.objects[i];
      if (mn.x <= o.max.x && mx.x >= o.min.x &&
          mn.y <= o.max.y && mx.y >= o.min.y &&
          mn.z <= o.max.z && mx.z >= o.min.z) {
        results.push(o.id);
      }
    }
    if (this.children) {
      for (var i = 0; i < 8; i++) this.children[i].query(mn, mx, results);
    }
  };
  OctreeNode.prototype.nearby = function(px, py, pz, radius, results) {
    var r = radius;
    this.query(
      { x: px - r, y: py - r, z: pz - r },
      { x: px + r, y: py + r, z: pz + r },
      results
    );
  };

  function createOctree() {
    return new OctreeNode({ x: 0, y: 0, z: 0 }, 100, 1);
  }

  function getBounds(mesh) {
    var box = new THREE.Box3().setFromObject(mesh);
    return { min: { x: box.min.x, y: box.min.y, z: box.min.z },
             max: { x: box.max.x, y: box.max.y, z: box.max.z } };
  }

  // ===== Notify parent =====
  try { window.parent.postMessage({ type: "wb-bridge-loaded" }, "*"); } catch(e) {}

  // ===== Wait for scene =====
  function waitForScene(cb) {
    if (window.__vibexe_editor__) { cb(window.__vibexe_editor__); return; }
    var attempts = 0;
    var timer = setInterval(function() {
      if (window.__vibexe_editor__) { clearInterval(timer); cb(window.__vibexe_editor__); }
      else if (++attempts > 200) { clearInterval(timer); console.warn("[WB] Timeout"); }
    }, 50);
  }

  // ===== Snap =====
  function snapPos(pos) {
    if (!_snap.enabled) return pos;
    var s = _snap;
    var r = { x: pos.x, y: pos.y, z: pos.z };
    if (s.gridType === "rectangular") {
      if (s.snappingOn.x && s.step.x > 0) r.x = Math.round((pos.x - s.origin.x) / s.step.x) * s.step.x + s.origin.x;
      if (s.snappingOn.y && s.step.y > 0) r.y = Math.round((pos.y - s.origin.y) / s.step.y) * s.step.y + s.origin.y;
      if (s.snappingOn.z && s.step.z > 0) r.z = Math.round((pos.z - s.origin.z) / s.step.z) * s.step.z + s.origin.z;
      if (s.midpointSnapping) {
        var hx = s.step.x / 2, hz = s.step.z / 2;
        if (Math.abs(r.x + hx - pos.x) < Math.abs(r.x - pos.x)) r.x += hx;
        if (Math.abs(r.z + hz - pos.z) < Math.abs(r.z - pos.z)) r.z += hz;
      }
    } else {
      var dx = pos.x - s.origin.x, dz = pos.z - s.origin.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var angle = Math.atan2(dz, dx);
      if (s.radialStep > 0) dist = Math.round(dist / s.radialStep) * s.radialStep;
      if (s.radialSectors > 0) {
        var sa = (Math.PI * 2) / s.radialSectors;
        angle = Math.round(angle / sa) * sa;
      }
      r.x = s.origin.x + Math.cos(angle) * dist;
      r.z = s.origin.z + Math.sin(angle) * dist;
    }
    return r;
  }

  // ===== Grid Visualization =====
  function updateGrid() {
    if (_gridHelper && _scene) {
      _scene.remove(_gridHelper);
      if (_gridHelper.geometry) _gridHelper.geometry.dispose();
      if (_gridHelper.material) {
        if (Array.isArray(_gridHelper.material)) _gridHelper.material.forEach(function(m){m.dispose();});
        else _gridHelper.material.dispose();
      }
      _gridHelper = null;
    }
    if (!_active || !_snap.showGrid || !_snap.enabled) return;
    var s = _snap;
    if (s.gridType === "rectangular") {
      var size = 40;
      var divs = Math.min(Math.round(size / Math.max(s.step.x, s.step.z, 0.1)), 200);
      _gridHelper = new THREE.GridHelper(size, divs, 0x444466, 0x222244);
      _gridHelper.position.set(s.origin.x, s.origin.y + 0.01, s.origin.z);
      _gridHelper.material.opacity = 0.4;
      _gridHelper.material.transparent = true;
    } else {
      var verts = [];
      var maxR = 20;
      var rings = Math.ceil(maxR / Math.max(s.radialStep, 0.5));
      for (var r = 1; r <= rings; r++) {
        var radius = r * s.radialStep;
        for (var i = 0; i < 64; i++) {
          var a1 = (i / 64) * Math.PI * 2, a2 = ((i + 1) / 64) * Math.PI * 2;
          verts.push(Math.cos(a1) * radius, 0, Math.sin(a1) * radius);
          verts.push(Math.cos(a2) * radius, 0, Math.sin(a2) * radius);
        }
      }
      for (var i = 0; i < s.radialSectors; i++) {
        var a = (i / s.radialSectors) * Math.PI * 2;
        verts.push(0, 0, 0); verts.push(Math.cos(a) * maxR, 0, Math.sin(a) * maxR);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      _gridHelper = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x444466, transparent: true, opacity: 0.4 }));
      _gridHelper.position.set(s.origin.x, s.origin.y + 0.01, s.origin.z);
    }
    _gridHelper.name = "__wb_grid__";
    _gridHelper.userData.__wb_grid = true;
    if (_scene) _scene.add(_gridHelper);
  }

  // ===== Circle Visualization (shared by Eraser, Replacer, Brush) =====
  function updateCircleVis(pos, radius, color) {
    if (!_eraserCircle) {
      var segs = 48;
      var verts = [];
      for (var i = 0; i <= segs; i++) {
        var a = (i / segs) * Math.PI * 2;
        verts.push(Math.cos(a), 0, Math.sin(a));
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      _eraserCircle = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: color || 0xff4444, transparent: true, opacity: 0.7
      }));
      _eraserCircle.name = "__wb_eraser_circle__";
      _eraserCircle.userData.__wb_grid = true;
      if (_scene) _scene.add(_eraserCircle);
    }
    _eraserCircle.material.color.setHex(color || 0xff4444);
    _eraserCircle.scale.setScalar(radius);
    _eraserCircle.position.set(pos.x, pos.y + 0.05, pos.z);
    _eraserCircle.visible = true;
  }
  function hideCircleVis() {
    if (_eraserCircle) _eraserCircle.visible = false;
  }

  // ===== Undo/Redo =====
  function pushUndo(action) {
    _undoStack.push(action);
    if (_undoStack.length > MAX_UNDO) _undoStack.shift();
    _redoStack = [];
    notifyUndoState();
  }
  function undo() {
    if (!_undoStack.length) return;
    var a = _undoStack.pop(); _redoStack.push(a);
    if (a.type === "place") removeObjectById(a.id, true);
    else if (a.type === "delete") restoreObject(a.data, true);
    else if (a.type === "move") { var o = _placedObjects[a.id]; if (o) o.mesh.position.set(a.oldPos.x, a.oldPos.y, a.oldPos.z); }
    else if (a.type === "batch-place") { for (var i = 0; i < a.ids.length; i++) removeObjectById(a.ids[i], true); }
    else if (a.type === "batch-delete") { for (var i = 0; i < a.datas.length; i++) restoreObject(a.datas[i], true); }
    notifyUndoState();
  }
  function redo() {
    if (!_redoStack.length) return;
    var a = _redoStack.pop(); _undoStack.push(a);
    if (a.type === "place") restoreObject(a.data, true);
    else if (a.type === "delete") removeObjectById(a.id, true);
    else if (a.type === "move") { var o = _placedObjects[a.id]; if (o) o.mesh.position.set(a.newPos.x, a.newPos.y, a.newPos.z); }
    else if (a.type === "batch-place") { for (var i = 0; i < a.datas.length; i++) restoreObject(a.datas[i], true); }
    else if (a.type === "batch-delete") { for (var i = 0; i < a.ids.length; i++) removeObjectById(a.ids[i], true); }
    notifyUndoState();
  }
  function notifyUndoState() {
    try { window.parent.postMessage({ type: "wb-undo-state", canUndo: _undoStack.length > 0, canRedo: _redoStack.length > 0 }, "*"); } catch(e) {}
  }

  // ===== Safe Merge (prototype-pollution guard) =====
  function safeMerge(target, src) {
    if (!src || typeof src !== "object" || Array.isArray(src)) return;
    var keys = Object.keys(src);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      if (Object.prototype.hasOwnProperty.call(target, k)) target[k] = src[k];
    }
  }

  // ===== Object Management =====
  function genId() { return "wb_" + (_nextPlacedId++); }

  function removeObjectById(id, silent) {
    var e = _placedObjects[id];
    if (!e) return;
    if (!_scene) return;
    if (e.mesh) {
      e.mesh.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            for (var m = 0; m < child.material.length; m++) child.material[m].dispose();
          } else {
            child.material.dispose();
          }
        }
      });
    }
    _scene.remove(e.mesh);
    _octree.remove(id);
    delete _placedObjects[id];
    updateRaycastTargets();
    if (!silent) try { window.parent.postMessage({ type: "wb-object-removed", id: id }, "*"); } catch(ex) {}
  }

  function restoreObject(data, silent) {
    loadModel(data.modelPath, data.pack, function(mesh) {
      mesh.position.set(data.position.x, data.position.y, data.position.z);
      if (data.rotation) mesh.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
      if (data.scale) mesh.scale.set(data.scale.x, data.scale.y, data.scale.z);
      mesh.name = data.name || "wb_object";
      mesh.userData.__wb_id = data.id;
      mesh.userData.__wb_item = data.itemId;
      mesh.userData.__wb_tool = data.toolSource;
      _scene.add(mesh);
      _placedObjects[data.id] = { mesh: mesh, data: data };
      var b = getBounds(mesh);
      _octree.insert(data.id, b.min, b.max);
      updateRaycastTargets();
      if (!silent) try { window.parent.postMessage({ type: "wb-object-placed", id: data.id, data: data }, "*"); } catch(ex) {}
    });
  }

  // ===== Model Loading =====
  function modelUrl(pack, path) {
    var o = window.__VIBEXE_API_ORIGIN__ || window.location.origin;
    return o + "/api/app-builder/media-stock-3d/" + pack + "/" + path;
  }
  var _pendingLoads = {}; // URL → Array<callback> for deduplication
  function loadModel(modelPath, pack, cb) {
    var url = modelUrl(pack, modelPath);
    if (_modelCache[url]) { cb(_modelCache[url].clone()); return; }
    // Deduplicate concurrent loads for the same URL (population batches)
    if (_pendingLoads[url]) { _pendingLoads[url].push(cb); return; }
    _pendingLoads[url] = [cb];
    var L = window.GLTFLoader || (window.THREE && window.THREE.GLTFLoader);
    if (!L) {
      var cbs = _pendingLoads[url]; delete _pendingLoads[url];
      for (var pi = 0; pi < cbs.length; pi++) cbs[pi](new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color:0xff00ff})));
      return;
    }
    new L().load(url, function(g) {
      var m = g.scene || g.scenes[0];
      _modelCache[url] = m;
      var cbs = _pendingLoads[url] || []; delete _pendingLoads[url];
      for (var pi = 0; pi < cbs.length; pi++) cbs[pi](m.clone());
    }, undefined, function(err) {
      console.warn("[WB] Load fail:", url);
      var cbs = _pendingLoads[url] || []; delete _pendingLoads[url];
      for (var pi = 0; pi < cbs.length; pi++) cbs[pi](new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color:0xff00ff})));
    });
  }

  // ===== Preview Mesh =====
  function showPreview(pos, hit) {
    if (!_previewMesh || !_previewVisible) return;
    var snapped = snapPos(pos);
    _previewMesh.position.set(snapped.x, snapped.y, snapped.z);
    applyBrushToMesh(_previewMesh, hit, true);
    _previewMesh.visible = true;
    if (_pin.avoidOverlapping || _brushTool.avoidOverlapping !== "disabled") {
      var b = getBounds(_previewMesh);
      var collisions = [];
      _octree.query(b.min, b.max, collisions);
      _previewValid = collisions.length === 0;
      setPreviewTint(_previewValid ? 0x44aaff : 0xff4444);
    } else {
      _previewValid = true;
      setPreviewTint(0x44aaff);
    }
  }
  function hidePreview() { if (_previewMesh) _previewMesh.visible = false; }
  function setPreviewTint(color) {
    if (!_previewMesh) return;
    _previewMesh.traverse(function(c) {
      if (c.isMesh && c.material && c.material.color) c.material.color.setHex(color);
    });
  }
  function setPreviewItem(item) {
    if (_previewMesh && _scene) { _scene.remove(_previewMesh); _previewMesh = null; }
    if (!item) { _previewVisible = false; return; }
    _activeItem = item;
    _previewVisible = true;
    loadModel(item.modelPath, item.pack, function(mesh) {
      mesh.traverse(function(c) {
        if (c.isMesh && c.material) {
          c.material = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.45 });
        }
      });
      mesh.name = "__wb_preview__";
      mesh.userData.__wb_preview = true;
      mesh.visible = false;
      _previewMesh = mesh;
      if (_scene) _scene.add(mesh);
    });
  }

  // ===== Raycasting =====
  function updateRaycastTargets() {
    _raycastTargets = [];
    if (!_scene) return;
    _scene.traverse(function(obj) {
      if (obj.userData.__wb_preview || obj.userData.__wb_grid) return;
      if (obj.name === "__wb_preview__" || obj.name === "__wb_grid__" || obj.name === "__wb_eraser_circle__") return;
      if (obj.name && obj.name.startsWith("__wb_vis_")) return;
      if (obj.isMesh && !obj.name.startsWith("__editor_")) _raycastTargets.push(obj);
    });
  }
  function raycast() {
    if (!_raycaster || !_camera || !_raycastTargets.length) return null;
    _raycaster.setFromCamera(_mouse, _camera);
    var hits = _raycaster.intersectObjects(_raycastTargets, true);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], o = h.object;
      while (o.parent && o.parent !== _scene) {
        if (o.userData.__wb_preview || o.userData.__wb_grid) break;
        o = o.parent;
      }
      if (!o.userData.__wb_preview && !o.userData.__wb_grid) return h;
    }
    return null;
  }

  // ===== Surface Alignment + Brush Settings =====
  function randR(min, max) { return min + Math.random() * (max - min); }

  function applyBrushToMesh(mesh, hit, isPreview) {
    var bs = _brush;
    if (bs.rotateToSurface && hit && hit.face) {
      var normal = hit.face.normal.clone();
      if (hit.object && hit.object.matrixWorld) normal.transformDirection(hit.object.matrixWorld);
      if (bs.alwaysOrientUp) normal.set(0, 1, 0);
      var up = new THREE.Vector3(0, 1, 0);
      var tangent = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(1, 0, 0));
      if (tangent.lengthSq() < 0.001) tangent.crossVectors(normal, new THREE.Vector3(0, 0, 1));
      tangent.normalize();
      var bitangent = new THREE.Vector3().crossVectors(normal, tangent);
      var quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
      mesh.quaternion.copy(quat);
    }
    if (bs.eulerOffset && (bs.eulerOffset.x || bs.eulerOffset.y || bs.eulerOffset.z)) {
      mesh.rotateX(bs.eulerOffset.x * Math.PI / 180);
      mesh.rotateY(bs.eulerOffset.y * Math.PI / 180);
      mesh.rotateZ(bs.eulerOffset.z * Math.PI / 180);
    }
    if (!isPreview && bs.addRandomRotation) {
      if (bs.rotateInMultiples && bs.rotationFactor > 0) {
        var stepsY = Math.round(Math.random() * 360 / bs.rotationFactor);
        mesh.rotateY(stepsY * bs.rotationFactor * Math.PI / 180);
      } else {
        mesh.rotateX(randR(bs.randomEulerOffset.x.min, bs.randomEulerOffset.x.max) * Math.PI / 180);
        mesh.rotateY(randR(bs.randomEulerOffset.y.min, bs.randomEulerOffset.y.max) * Math.PI / 180);
        mesh.rotateZ(randR(bs.randomEulerOffset.z.min, bs.randomEulerOffset.z.max) * Math.PI / 180);
      }
    }
    var sx = bs.scaleMultiplier.x, sy = bs.scaleMultiplier.y, sz = bs.scaleMultiplier.z;
    if (!isPreview && bs.randomScaleMultiplier) {
      if (bs.separateScaleAxes) {
        sx *= randR(bs.randomScaleMultiplierRange.x.min, bs.randomScaleMultiplierRange.x.max);
        sy *= randR(bs.randomScaleMultiplierRange.y.min, bs.randomScaleMultiplierRange.y.max);
        sz *= randR(bs.randomScaleMultiplierRange.z.min, bs.randomScaleMultiplierRange.z.max);
      } else {
        var u = randR(bs.randomScaleMultiplierRange.x.min, bs.randomScaleMultiplierRange.x.max);
        sx *= u; sy *= u; sz *= u;
      }
    }
    mesh.scale.set(sx, sy, sz);
    if (!isPreview) {
      if (bs.flipX === "flip") mesh.scale.x *= -1;
      else if (bs.flipX === "random" && Math.random() > 0.5) mesh.scale.x *= -1;
      if (bs.flipY === "flip") mesh.scale.y *= -1;
      else if (bs.flipY === "random" && Math.random() > 0.5) mesh.scale.y *= -1;
    }
    if (bs.surfaceDistance !== 0 && hit && hit.face) {
      var n = hit.face.normal.clone();
      if (hit.object && hit.object.matrixWorld) n.transformDirection(hit.object.matrixWorld);
      var dist = bs.surfaceDistance;
      if (!isPreview && bs.randomSurfaceDistance) dist *= randR(bs.randomSurfaceDistanceRange.min, bs.randomSurfaceDistanceRange.max);
      mesh.position.addScaledVector(n, dist);
    }
    if (bs.localPositionOffset && (bs.localPositionOffset.x || bs.localPositionOffset.y || bs.localPositionOffset.z)) {
      var off = new THREE.Vector3(bs.localPositionOffset.x, bs.localPositionOffset.y, bs.localPositionOffset.z);
      off.applyQuaternion(mesh.quaternion);
      mesh.position.add(off);
    }
    if (!isPreview && bs.embedInSurface) embedInSurface(mesh);
  }

  function embedInSurface(mesh) {
    var box = new THREE.Box3().setFromObject(mesh);
    var bottomY = box.min.y;
    var rc = new THREE.Raycaster(
      new THREE.Vector3(mesh.position.x, bottomY + 0.1, mesh.position.z),
      new THREE.Vector3(0, -1, 0), 0, 10
    );
    var hits = rc.intersectObjects(_raycastTargets, true);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      if (h.object.userData.__wb_preview || h.object.userData.__wb_grid) continue;
      mesh.position.y -= (bottomY - h.point.y);
      return;
    }
  }

  // ===== Place Object (shared) =====
  function placeObject(hit, toolSource, posOverride) {
    if (!_activeItem || (!hit && !posOverride)) return null;
    var rawPos = posOverride || { x: hit.point.x, y: hit.point.y, z: hit.point.z };
    var pos = snapPos(rawPos);
    var id = genId();
    var itemRef = _activeItem;
    loadModel(itemRef.modelPath, itemRef.pack, function(mesh) {
      mesh.position.set(pos.x, pos.y, pos.z);
      applyBrushToMesh(mesh, hit, false);
      mesh.name = itemRef.name || "wb_object";
      mesh.userData.__wb_id = id;
      mesh.userData.__wb_item = itemRef.id;
      mesh.userData.__wb_tool = toolSource;
      _scene.add(mesh);
      var data = {
        id: id, itemId: itemRef.id, name: itemRef.name,
        modelPath: itemRef.modelPath, pack: itemRef.pack,
        position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
        rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
        scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
        toolSource: toolSource,
      };
      _placedObjects[id] = { mesh: mesh, data: data };
      var b = getBounds(mesh);
      _octree.insert(id, b.min, b.max);
      updateRaycastTargets();
      try { window.parent.postMessage({ type: "wb-object-placed", id: id, data: data }, "*"); } catch(ex) {}
    });
    return id;
  }

  // ===== Place at exact position (for line/shape/tiling, no brush randomization) =====
  function placeObjectAt(pos, rotY, toolSource) {
    if (!_activeItem) return null;
    var id = genId();
    var itemRef = _activeItem;
    loadModel(itemRef.modelPath, itemRef.pack, function(mesh) {
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.rotation.y = rotY || 0;
      var sx = _brush.scaleMultiplier.x, sy = _brush.scaleMultiplier.y, sz = _brush.scaleMultiplier.z;
      mesh.scale.set(sx, sy, sz);
      mesh.name = itemRef.name || "wb_object";
      mesh.userData.__wb_id = id;
      mesh.userData.__wb_item = itemRef.id;
      mesh.userData.__wb_tool = toolSource;
      _scene.add(mesh);
      var data = {
        id: id, itemId: itemRef.id, name: itemRef.name,
        modelPath: itemRef.modelPath, pack: itemRef.pack,
        position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
        rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
        scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
        toolSource: toolSource,
      };
      _placedObjects[id] = { mesh: mesh, data: data };
      var b = getBounds(mesh);
      _octree.insert(id, b.min, b.max);
      updateRaycastTargets();
    });
    return id;
  }

  // ===== Get model bounds (approximate from cache or default) =====
  function getModelBoundsSize() {
    if (!_activeItem) return { x: 1, y: 1, z: 1 };
    var url = modelUrl(_activeItem.pack, _activeItem.modelPath);
    if (_modelCache[url]) {
      var box = new THREE.Box3().setFromObject(_modelCache[url]);
      var size = new THREE.Vector3();
      box.getSize(size);
      return { x: Math.max(size.x, 0.1), y: Math.max(size.y, 0.1), z: Math.max(size.z, 0.1) };
    }
    return { x: 1, y: 1, z: 1 };
  }

  // ===== Pin Tool =====
  function pinAction(hit) {
    if (!_previewValid && _pin.avoidOverlapping) return;
    var id = placeObject(hit, "pin");
    if (id) pushUndo({ type: "place", id: id, data: _placedObjects[id] ? _placedObjects[id].data : { id: id } });
  }

  // ===== Brush Tool =====
  var _brushStrokeIds = [];

  function brushAction(hit) {
    if (!hit || !_activeItem) return;
    var center = hit.point;
    var radius = _brushTool.radius;
    var density = _brushTool.density / 100;
    var minSpacing = _brushTool.minSpacing;
    if (_lastBrushPos) {
      var dx = center.x - _lastBrushPos.x, dz = center.z - _lastBrushPos.z;
      if (Math.sqrt(dx * dx + dz * dz) < minSpacing) return;
    }
    _lastBrushPos = { x: center.x, y: center.y, z: center.z };
    var count = Math.max(1, Math.round(density * radius * radius * 0.5));
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var dist = Math.random() * radius;
      var px, pz;
      if (_brushTool.brushShape === "square") {
        px = center.x + (Math.random() * 2 - 1) * radius;
        pz = center.z + (Math.random() * 2 - 1) * radius;
      } else {
        px = center.x + Math.cos(angle) * dist;
        pz = center.z + Math.sin(angle) * dist;
      }
      var rc = new THREE.Raycaster(
        new THREE.Vector3(px, center.y + 5, pz),
        new THREE.Vector3(0, -1, 0), 0, 20
      );
      var sHits = rc.intersectObjects(_raycastTargets, true);
      var sHit = null;
      for (var j = 0; j < sHits.length; j++) {
        if (!sHits[j].object.userData.__wb_preview && !sHits[j].object.userData.__wb_grid) {
          sHit = sHits[j]; break;
        }
      }
      if (!sHit) continue;
      if (_brushTool.slopeFilter) {
        var normal = sHit.face ? sHit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
        if (sHit.object && sHit.object.matrixWorld) normal.transformDirection(sHit.object.matrixWorld);
        var slopeAngle = Math.acos(Math.min(1, normal.dot(new THREE.Vector3(0, 1, 0)))) * 180 / Math.PI;
        if (slopeAngle < _brushTool.slopeFilter.min || slopeAngle > _brushTool.slopeFilter.max) continue;
      }
      if (_brushTool.avoidOverlapping !== "disabled") {
        var testMin = { x: px - 0.3, y: sHit.point.y - 0.3, z: pz - 0.3 };
        var testMax = { x: px + 0.3, y: sHit.point.y + 0.3, z: pz + 0.3 };
        var collisions = [];
        _octree.query(testMin, testMax, collisions);
        if (collisions.length > 0) continue;
      }
      var id = placeObject(sHit, "brush");
      if (id) _brushStrokeIds.push(id);
    }
  }

  // ===== Eraser Tool =====
  function eraserAction(hit) {
    if (!hit) return;
    var cx = hit.point.x, cy = hit.point.y, cz = hit.point.z;
    var nearby = [];
    _octree.nearby(cx, cy, cz, _eraser.radius, nearby);
    if (nearby.length === 0) return;
    if (_eraser.onlyClosest) {
      var bestId = null, bestDist = Infinity;
      for (var i = 0; i < nearby.length; i++) {
        var entry = _placedObjects[nearby[i]];
        if (!entry) continue;
        var d = _camera.position.distanceTo(entry.mesh.position);
        if (d < bestDist) { bestDist = d; bestId = nearby[i]; }
      }
      if (bestId) {
        var e = _placedObjects[bestId];
        pushUndo({ type: "delete", id: bestId, data: e.data });
        removeObjectById(bestId, false);
      }
    } else {
      var deletedDatas = [];
      var deletedIds = [];
      for (var i = 0; i < nearby.length; i++) {
        var entry = _placedObjects[nearby[i]];
        if (!entry) continue;
        var dx = entry.mesh.position.x - cx, dy = entry.mesh.position.y - cy, dz = entry.mesh.position.z - cz;
        if (Math.sqrt(dx*dx + dy*dy + dz*dz) <= _eraser.radius) {
          deletedDatas.push(entry.data);
          deletedIds.push(nearby[i]);
        }
      }
      if (deletedIds.length > 0) {
        pushUndo({ type: "batch-delete", ids: deletedIds, datas: deletedDatas });
        for (var i = 0; i < deletedIds.length; i++) removeObjectById(deletedIds[i], false);
      }
    }
  }

  // ===== Replacer Tool =====
  function replacerAction(hit) {
    if (!hit || !_activeItem) return;
    var cx = hit.point.x, cy = hit.point.y, cz = hit.point.z;
    var nearby = [];
    _octree.nearby(cx, cy, cz, _replacer.radius, nearby);
    if (nearby.length === 0) return;
    var replacedDatas = [];
    var replacedIds = [];
    var newIds = [];
    for (var i = 0; i < nearby.length; i++) {
      var entry = _placedObjects[nearby[i]];
      if (!entry) continue;
      var dx = entry.mesh.position.x - cx, dz = entry.mesh.position.z - cz;
      if (Math.sqrt(dx*dx + dz*dz) > _replacer.radius) continue;
      replacedDatas.push(entry.data);
      replacedIds.push(nearby[i]);
      // Place replacement at same position
      var pos = { x: entry.mesh.position.x, y: entry.mesh.position.y, z: entry.mesh.position.z };
      var rotY = entry.mesh.rotation.y;
      var newId = placeObjectAt(pos, rotY, "replacer");
      if (newId) newIds.push(newId);
    }
    // Remove originals
    if (replacedIds.length > 0) {
      pushUndo({ type: "batch-delete", ids: replacedIds, datas: replacedDatas });
      for (var i = 0; i < replacedIds.length; i++) removeObjectById(replacedIds[i], false);
    }
  }

  // ===== Line Tool =====
  function clearLineVisuals() {
    if (_lineVisuals && _scene) {
      _scene.remove(_lineVisuals);
      _lineVisuals.traverse(function(c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      _lineVisuals = null;
    }
    for (var i = 0; i < _linePreviewObjects.length; i++) {
      if (_scene) _scene.remove(_linePreviewObjects[i]);
    }
    _linePreviewObjects = [];
  }

  function updateLineVisuals() {
    clearLineVisuals();
    if (_linePoints.length < 1) return;
    _lineVisuals = new THREE.Group();
    _lineVisuals.name = "__wb_vis_line__";
    _lineVisuals.userData.__wb_grid = true;

    // Draw spheres at control points
    for (var i = 0; i < _linePoints.length; i++) {
      var p = _linePoints[i];
      var sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffcc00 })
      );
      sphere.position.set(p.x, p.y + 0.1, p.z);
      _lineVisuals.add(sphere);
    }

    // Draw line connecting points (Catmull-Rom for smooth curve)
    if (_linePoints.length >= 2) {
      var curvePoints = getCurvePoints(_linePoints, _line.closed);
      var verts = [];
      for (var i = 0; i < curvePoints.length; i++) {
        verts.push(curvePoints[i].x, curvePoints[i].y + 0.05, curvePoints[i].z);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
      _lineVisuals.add(line);

      // Show preview objects along curve
      if (_activeItem) {
        var placementPositions = getLinePlacementPositions(curvePoints);
        // Show faded previews (max 50 to avoid lag)
        var maxPreviews = Math.min(placementPositions.length, 50);
        for (var i = 0; i < maxPreviews; i++) {
          var pp = placementPositions[i];
          var box = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.3),
            new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.3 })
          );
          box.position.set(pp.pos.x, pp.pos.y + 0.15, pp.pos.z);
          box.rotation.y = pp.rotY;
          _lineVisuals.add(box);
        }
      }
    }

    if (_scene) _scene.add(_lineVisuals);
  }

  // Catmull-Rom curve interpolation
  function getCurvePoints(points, closed) {
    if (points.length < 2) return points.slice();
    var result = [];
    var n = points.length;
    var segsPerSpan = 10;
    var count = closed ? n : n - 1;
    for (var i = 0; i < count; i++) {
      var p0 = points[(i - 1 + n) % n];
      var p1 = points[i];
      var p2 = points[(i + 1) % n];
      var p3 = points[(i + 2) % n];
      if (!closed) {
        if (i === 0) p0 = p1;
        if (i === n - 2) p3 = p2;
      }
      for (var j = 0; j < segsPerSpan; j++) {
        var t = j / segsPerSpan;
        var t2 = t * t, t3 = t2 * t;
        result.push({
          x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
          y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
          z: 0.5 * ((2*p1.z) + (-p0.z+p2.z)*t + (2*p0.z-5*p1.z+4*p2.z-p3.z)*t2 + (-p0.z+3*p1.z-3*p2.z+p3.z)*t3),
        });
      }
    }
    if (!closed && points.length >= 2) result.push(points[points.length - 1]);
    return result;
  }

  // Calculate placement positions along curve
  function getLinePlacementPositions(curvePoints) {
    if (curvePoints.length < 2) return [];
    // Calculate cumulative distances
    var cumDist = [0];
    for (var i = 1; i < curvePoints.length; i++) {
      var dx = curvePoints[i].x - curvePoints[i-1].x;
      var dy = curvePoints[i].y - curvePoints[i-1].y;
      var dz = curvePoints[i].z - curvePoints[i-1].z;
      cumDist.push(cumDist[i-1] + Math.sqrt(dx*dx + dy*dy + dz*dz));
    }
    var totalLen = cumDist[cumDist.length - 1];
    if (totalLen < 0.01) return [];

    var spacing;
    if (_line.spacingType === "bounds") {
      var size = getModelBoundsSize();
      spacing = Math.max(size.x, size.z) + _line.gapSize;
    } else {
      spacing = _line.spacing;
    }
    if (spacing < 0.1) spacing = 0.1;

    var positions = [];
    var d = 0;
    while (d <= totalLen + 0.001) {
      // Find segment for this distance
      var segIdx = 0;
      for (var i = 1; i < cumDist.length; i++) {
        if (cumDist[i] >= d) { segIdx = i - 1; break; }
        segIdx = i - 1;
      }
      var segLen = cumDist[segIdx + 1] - cumDist[segIdx];
      var t = segLen > 0 ? (d - cumDist[segIdx]) / segLen : 0;
      var p0 = curvePoints[segIdx], p1 = curvePoints[Math.min(segIdx + 1, curvePoints.length - 1)];
      var pos = {
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
        z: p0.z + (p1.z - p0.z) * t,
      };
      var rotY = 0;
      if (_line.objectsOrientedAlongLine) {
        rotY = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      }
      positions.push({ pos: pos, rotY: rotY });
      d += spacing;
    }
    return positions;
  }

  function confirmLine() {
    if (_linePoints.length < 2 || !_activeItem) return;
    var curvePoints = getCurvePoints(_linePoints, _line.closed);
    var placements = getLinePlacementPositions(curvePoints);
    var ids = [];
    for (var i = 0; i < placements.length; i++) {
      var pp = placements[i];
      var id = placeObjectAt(pp.pos, pp.rotY, "line");
      if (id) ids.push(id);
    }
    if (ids.length > 0) {
      pushUndo({ type: "batch-place", ids: ids, datas: ids.map(function(id) { return _placedObjects[id] ? _placedObjects[id].data : { id: id }; }) });
    }
    _linePoints = [];
    clearLineVisuals();
    try { window.parent.postMessage({ type: "wb-line-confirmed", count: ids.length }, "*"); } catch(ex) {}
  }

  // ===== Shape Tool =====
  function clearShapeVisuals() {
    if (_shapeVisual && _scene) {
      _scene.remove(_shapeVisual);
      _shapeVisual.traverse(function(c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      _shapeVisual = null;
    }
  }

  function updateShapeVisuals() {
    clearShapeVisuals();
    if (!_shapeCenter || _shapeRadius < 0.1) return;
    _shapeVisual = new THREE.Group();
    _shapeVisual.name = "__wb_vis_shape__";
    _shapeVisual.userData.__wb_grid = true;

    var verts = getShapeVertices(_shapeCenter, _shapeRadius);
    var lineVerts = [];
    for (var i = 0; i < verts.length; i++) {
      lineVerts.push(verts[i].x, verts[i].y + 0.05, verts[i].z);
    }
    // Close shape
    lineVerts.push(verts[0].x, verts[0].y + 0.05, verts[0].z);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(lineVerts, 3));
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.8 }));
    _shapeVisual.add(line);

    // Center marker
    var center = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ffaa })
    );
    center.position.set(_shapeCenter.x, _shapeCenter.y + 0.1, _shapeCenter.z);
    _shapeVisual.add(center);

    // Preview placement positions
    if (_activeItem) {
      var positions = getShapePlacementPositions(verts);
      var maxPreviews = Math.min(positions.length, 80);
      for (var i = 0; i < maxPreviews; i++) {
        var pp = positions[i];
        var box = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.25, 0.25),
          new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.3 })
        );
        box.position.set(pp.pos.x, pp.pos.y + 0.12, pp.pos.z);
        _shapeVisual.add(box);
      }
    }

    if (_scene) _scene.add(_shapeVisual);
  }

  function getShapeVertices(center, radius) {
    var sides;
    if (_shape.shapeType === "circle") {
      sides = Math.max(8, Math.min(64, Math.round(radius * 4)));
    } else {
      sides = Math.max(3, _shape.sidesCount);
    }
    var verts = [];
    for (var i = 0; i < sides; i++) {
      var angle = (i / sides) * Math.PI * 2;
      verts.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y,
        z: center.z + Math.sin(angle) * radius,
      });
    }
    return verts;
  }

  function getShapePlacementPositions(verts) {
    // Place objects along perimeter, same spacing logic as line
    var positions = [];
    var spacing;
    if (_shape.spacingType === "bounds") {
      var size = getModelBoundsSize();
      spacing = Math.max(size.x, size.z) + _shape.gapSize;
    } else {
      spacing = _shape.spacing;
    }
    if (spacing < 0.1) spacing = 0.1;

    // Walk edges
    var n = verts.length;
    var cumDist = 0;
    var nextPlaceAt = 0;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var dx = verts[j].x - verts[i].x, dy = verts[j].y - verts[i].y, dz = verts[j].z - verts[i].z;
      var edgeLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
      var edgeStart = cumDist;
      cumDist += edgeLen;
      while (nextPlaceAt <= cumDist && edgeLen > 0.001) {
        var t = (nextPlaceAt - edgeStart) / edgeLen;
        var pos = {
          x: verts[i].x + dx * t,
          y: verts[i].y + dy * t,
          z: verts[i].z + dz * t,
        };
        var rotY = _shape.objectsOrientedAlongLine ? Math.atan2(dx, dz) : 0;
        positions.push({ pos: pos, rotY: rotY });
        nextPlaceAt += spacing;
      }
    }
    return positions;
  }

  function confirmShape() {
    if (!_shapeCenter || _shapeRadius < 0.1 || !_activeItem) return;
    var verts = getShapeVertices(_shapeCenter, _shapeRadius);
    var placements = getShapePlacementPositions(verts);
    var ids = [];
    for (var i = 0; i < placements.length; i++) {
      var pp = placements[i];
      var id = placeObjectAt(pp.pos, pp.rotY, "shape");
      if (id) ids.push(id);
    }
    if (ids.length > 0) {
      pushUndo({ type: "batch-place", ids: ids, datas: ids.map(function(id) { return _placedObjects[id] ? _placedObjects[id].data : { id: id }; }) });
    }
    _shapeCenter = null;
    _shapeRadius = 0;
    _shapeDragging = false;
    clearShapeVisuals();
    try { window.parent.postMessage({ type: "wb-shape-confirmed", count: ids.length }, "*"); } catch(ex) {}
  }

  // ===== Tiling Tool (Floor/Wall) =====
  function clearTilingVisuals() {
    if (_tilingVisual && _scene) {
      _scene.remove(_tilingVisual);
      _tilingVisual.traverse(function(c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      _tilingVisual = null;
    }
  }

  function updateTilingVisuals() {
    clearTilingVisuals();
    if (!_tilingCorner1 || !_tilingCorner2) return;
    _tilingVisual = new THREE.Group();
    _tilingVisual.name = "__wb_vis_tiling__";
    _tilingVisual.userData.__wb_grid = true;

    var c1 = _tilingCorner1, c2 = _tilingCorner2;
    var minX = Math.min(c1.x, c2.x), maxX = Math.max(c1.x, c2.x);
    var minZ = Math.min(c1.z, c2.z), maxZ = Math.max(c1.z, c2.z);
    var y = (c1.y + c2.y) / 2;

    // Rectangle outline
    var v = [minX,y+0.05,minZ, maxX,y+0.05,minZ, maxX,y+0.05,maxZ, minX,y+0.05,maxZ, minX,y+0.05,minZ];
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.7 }));
    _tilingVisual.add(line);

    // Preview grid cells
    if (_activeItem) {
      var cells = getTilingCells(c1, c2);
      var maxPreviews = Math.min(cells.length, 200);
      for (var i = 0; i < maxPreviews; i++) {
        var cell = cells[i];
        var box = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.2, 0.2),
          new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.25 })
        );
        box.position.set(cell.x, cell.y + 0.1, cell.z);
        _tilingVisual.add(box);
      }
    }

    if (_scene) _scene.add(_tilingVisual);
  }

  function getTilingCells(c1, c2) {
    var size = getModelBoundsSize();
    var cellW, cellH;
    if (_tiling.cellSizeType === "custom") {
      cellW = _tiling.cellSize.w;
      cellH = _tiling.cellSize.h;
    } else {
      cellW = size.x;
      cellH = size.z;
    }
    cellW = Math.max(cellW, 0.1);
    cellH = Math.max(cellH, 0.1);
    var spacingW = _tiling.spacing.w;
    var spacingH = _tiling.spacing.h;
    var stepW = cellW + spacingW;
    var stepH = cellH + spacingH;

    var minX = Math.min(c1.x, c2.x), maxX = Math.max(c1.x, c2.x);
    var minZ = Math.min(c1.z, c2.z), maxZ = Math.max(c1.z, c2.z);
    var y = (c1.y + c2.y) / 2;

    var cells = [];
    for (var x = minX + cellW / 2; x <= maxX; x += stepW) {
      for (var z = minZ + cellH / 2; z <= maxZ; z += stepH) {
        // Raycast down to find surface height
        var rc = new THREE.Raycaster(
          new THREE.Vector3(x, y + 10, z),
          new THREE.Vector3(0, -1, 0), 0, 30
        );
        var hits = rc.intersectObjects(_raycastTargets, true);
        var hy = y;
        for (var i = 0; i < hits.length; i++) {
          if (!hits[i].object.userData.__wb_preview && !hits[i].object.userData.__wb_grid) {
            hy = hits[i].point.y;
            break;
          }
        }
        cells.push({ x: x, y: hy, z: z });
      }
    }
    return cells;
  }

  function confirmTiling() {
    if (!_tilingCorner1 || !_tilingCorner2 || !_activeItem) return;
    var cells = getTilingCells(_tilingCorner1, _tilingCorner2);
    var ids = [];
    for (var i = 0; i < cells.length; i++) {
      var id = placeObjectAt(cells[i], 0, _tool);
      if (id) ids.push(id);
    }
    if (ids.length > 0) {
      pushUndo({ type: "batch-place", ids: ids, datas: ids.map(function(id) { return _placedObjects[id] ? _placedObjects[id].data : { id: id }; }) });
    }
    _tilingCorner1 = null;
    _tilingCorner2 = null;
    _tilingDragging = false;
    clearTilingVisuals();
    try { window.parent.postMessage({ type: "wb-tiling-confirmed", count: ids.length }, "*"); } catch(ex) {}
  }

  // ===== Gravity Tool =====
  function gravityAction(hit) {
    if (!hit || !_activeItem) return;
    var pos = snapPos({ x: hit.point.x, y: hit.point.y + _gravity.height, z: hit.point.z });
    // Simple drop: raycast straight down to find surface
    var rc = new THREE.Raycaster(
      new THREE.Vector3(pos.x, pos.y, pos.z),
      new THREE.Vector3(0, -1, 0), 0, _gravity.height + 20
    );
    var hits = rc.intersectObjects(_raycastTargets, true);
    var landY = hit.point.y;
    for (var i = 0; i < hits.length; i++) {
      if (!hits[i].object.userData.__wb_preview && !hits[i].object.userData.__wb_grid) {
        landY = hits[i].point.y;
        break;
      }
    }
    // If cannon-es available, simulate physics drop
    if (window.CANNON) {
      try {
        var world = new CANNON.World();
        world.gravity.set(0, -9.82, 0);
        var groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(new CANNON.Plane());
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        groundBody.position.set(0, landY, 0);
        world.addBody(groundBody);

        var dropBody = new CANNON.Body({ mass: _gravity.mass });
        var size = getModelBoundsSize();
        dropBody.addShape(new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2)));
        dropBody.position.set(pos.x, pos.y, pos.z);
        dropBody.linearDamping = _gravity.drag;
        world.addBody(dropBody);

        var dt = 1/60;
        for (var step = 0; step < _gravity.maxIterations; step++) {
          world.step(dt);
          if (dropBody.velocity.length() < 0.01 && step > 10) break;
        }
        landY = dropBody.position.y;
        pos.x = dropBody.position.x;
        pos.z = dropBody.position.z;
      } catch(e) {
        console.warn("[WB] Gravity physics error:", e);
      }
    }
    pos.y = landY;
    var id = placeObjectAt(pos, 0, "gravity");
    if (id) pushUndo({ type: "place", id: id, data: _placedObjects[id] ? _placedObjects[id].data : { id: id } });
  }

  // ===== Select Tool =====
  function selectAction(hit) {
    if (!hit) { deselectAll(); return; }
    // Find wb_id on clicked mesh or parent
    var obj = hit.object;
    var wbId = null;
    while (obj) {
      if (obj.userData.__wb_id) { wbId = obj.userData.__wb_id; break; }
      obj = obj.parent;
    }
    if (!wbId) { deselectAll(); return; }
    var ctrlKey = window.__wb_ctrl_down || false;
    if (ctrlKey) {
      // Toggle selection
      var idx = _selectedIds.indexOf(wbId);
      if (idx >= 0) {
        _selectedIds.splice(idx, 1);
        unhighlightObject(wbId);
      } else {
        _selectedIds.push(wbId);
        highlightObject(wbId);
      }
    } else {
      deselectAll();
      _selectedIds = [wbId];
      highlightObject(wbId);
    }
    notifySelection();
  }

  function deselectAll() {
    for (var i = 0; i < _selectedIds.length; i++) unhighlightObject(_selectedIds[i]);
    _selectedIds = [];
    notifySelection();
  }

  function highlightObject(id) {
    var entry = _placedObjects[id];
    if (!entry) return;
    entry.mesh.traverse(function(c) {
      if (c.isMesh && c.material) {
        c.userData.__wb_origColor = c.material.color ? c.material.color.getHex() : 0xffffff;
        if (c.material.emissive) c.material.emissive.setHex(0x333366);
      }
    });
  }
  function unhighlightObject(id) {
    var entry = _placedObjects[id];
    if (!entry) return;
    entry.mesh.traverse(function(c) {
      if (c.isMesh && c.material && c.material.emissive) {
        c.material.emissive.setHex(0x000000);
      }
    });
  }

  function notifySelection() {
    try {
      window.parent.postMessage({
        type: "wb-selection-changed",
        ids: _selectedIds.slice(),
        count: _selectedIds.length,
      }, "*");
    } catch(ex) {}
  }

  // ===== Extrude Tool =====
  function extrudeAction() {
    if (_selectedIds.length === 0 || !_extrudeAxis) return;
    var axis = _extrudeAxis; // "x", "y", or "z"
    var spacing;
    if (_extrude.spacingType === "box-size") {
      var size = { x: 1, y: 1, z: 1 };
      // Get bounds of first selected
      if (_selectedIds.length > 0 && _placedObjects[_selectedIds[0]]) {
        var b = getBounds(_placedObjects[_selectedIds[0]].mesh);
        size = { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
      }
      spacing = size[axis] * _extrude.multiplier[axis];
    } else {
      spacing = _extrude.spacing[axis];
    }
    if (Math.abs(spacing) < 0.01) spacing = 1;

    var ids = [];
    for (var s = 0; s < _selectedIds.length; s++) {
      var entry = _placedObjects[_selectedIds[s]];
      if (!entry) continue;
      var newPos = { x: entry.mesh.position.x, y: entry.mesh.position.y, z: entry.mesh.position.z };
      newPos[axis] += spacing;
      var id = genId();
      var itemRef = entry.data;
      // Clone the model
      loadModel(itemRef.modelPath, itemRef.pack, (function(id, newPos, itemRef, entry) {
        return function(mesh) {
          mesh.position.set(newPos.x, newPos.y, newPos.z);
          mesh.rotation.copy(entry.mesh.rotation);
          mesh.scale.copy(entry.mesh.scale);
          if (_extrude.addRandomRotation) {
            mesh.rotateX(randR(_extrude.randomEulerOffset.x.min, _extrude.randomEulerOffset.x.max) * Math.PI / 180);
            mesh.rotateY(randR(_extrude.randomEulerOffset.y.min, _extrude.randomEulerOffset.y.max) * Math.PI / 180);
            mesh.rotateZ(randR(_extrude.randomEulerOffset.z.min, _extrude.randomEulerOffset.z.max) * Math.PI / 180);
          }
          mesh.name = itemRef.name || "wb_object";
          mesh.userData.__wb_id = id;
          mesh.userData.__wb_item = itemRef.itemId;
          mesh.userData.__wb_tool = "extrude";
          _scene.add(mesh);
          var data = {
            id: id, itemId: itemRef.itemId, name: itemRef.name,
            modelPath: itemRef.modelPath, pack: itemRef.pack,
            position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
            rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
            scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
            toolSource: "extrude",
          };
          _placedObjects[id] = { mesh: mesh, data: data };
          var b = getBounds(mesh);
          _octree.insert(id, b.min, b.max);
          updateRaycastTargets();
        };
      })(id, newPos, itemRef, entry));
      ids.push(id);
    }
    if (ids.length > 0) {
      pushUndo({ type: "batch-place", ids: ids, datas: ids.map(function(id) { return { id: id }; }) });
    }
  }

  // ===== Mirror Tool =====
  function clearMirrorVisuals() {
    if (_mirrorPlane && _scene) {
      _scene.remove(_mirrorPlane);
      if (_mirrorPlane.geometry) _mirrorPlane.geometry.dispose();
      if (_mirrorPlane.material) _mirrorPlane.material.dispose();
      _mirrorPlane = null;
    }
  }

  function showMirrorPlane(hit) {
    clearMirrorVisuals();
    if (!hit) return;
    var geo = new THREE.PlaneGeometry(20, 20);
    var mat = new THREE.MeshBasicMaterial({
      color: 0x4488ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide
    });
    _mirrorPlane = new THREE.Mesh(geo, mat);
    _mirrorPlane.name = "__wb_vis_mirror__";
    _mirrorPlane.userData.__wb_grid = true;
    _mirrorPlane.position.set(hit.point.x, hit.point.y, hit.point.z);
    // Default mirror on XZ plane (vertical, facing X)
    _mirrorNormal = { x: 1, y: 0, z: 0 };
    _mirrorPlane.rotation.y = Math.PI / 2;
    if (_scene) _scene.add(_mirrorPlane);
  }

  function confirmMirror() {
    if (_selectedIds.length === 0 || !_mirrorPlane) return;
    var planePos = _mirrorPlane.position;
    var normal = _mirrorNormal || { x: 1, y: 0, z: 0 };
    var ids = [];
    for (var s = 0; s < _selectedIds.length; s++) {
      var entry = _placedObjects[_selectedIds[s]];
      if (!entry) continue;
      var pos = entry.mesh.position;
      // Reflect position: p' = p - 2*dot(p-plane, n)*n
      var dx = pos.x - planePos.x, dy = pos.y - planePos.y, dz = pos.z - planePos.z;
      var dot = dx * normal.x + dy * normal.y + dz * normal.z;
      var newPos = {
        x: pos.x - 2 * dot * normal.x,
        y: pos.y - 2 * dot * normal.y,
        z: pos.z - 2 * dot * normal.z,
      };
      if (_mirror.action === "create") {
        var id = genId();
        var itemRef = entry.data;
        loadModel(itemRef.modelPath, itemRef.pack, (function(id, newPos, itemRef, entry) {
          return function(mesh) {
            mesh.position.set(newPos.x, newPos.y, newPos.z);
            mesh.rotation.copy(entry.mesh.rotation);
            if (_mirror.reflectRotation) {
              mesh.rotation.y = -mesh.rotation.y;
            }
            mesh.scale.copy(entry.mesh.scale);
            if (_mirror.invertScale) {
              mesh.scale.x *= -1;
            }
            mesh.name = itemRef.name || "wb_object";
            mesh.userData.__wb_id = id;
            mesh.userData.__wb_item = itemRef.itemId;
            mesh.userData.__wb_tool = "mirror";
            _scene.add(mesh);
            var data = {
              id: id, itemId: itemRef.itemId, name: itemRef.name,
              modelPath: itemRef.modelPath, pack: itemRef.pack,
              position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
              rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
              scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
              toolSource: "mirror",
            };
            _placedObjects[id] = { mesh: mesh, data: data };
            var b = getBounds(mesh);
            _octree.insert(id, b.min, b.max);
            updateRaycastTargets();
          };
        })(id, newPos, itemRef, entry));
        ids.push(id);
      } else {
        // Transform mode: move the original
        var oldPos = { x: pos.x, y: pos.y, z: pos.z };
        entry.mesh.position.set(newPos.x, newPos.y, newPos.z);
        if (_mirror.reflectRotation) entry.mesh.rotation.y = -entry.mesh.rotation.y;
        pushUndo({ type: "move", id: _selectedIds[s], oldPos: oldPos, newPos: newPos });
      }
    }
    if (ids.length > 0) {
      pushUndo({ type: "batch-place", ids: ids, datas: ids.map(function(id) { return { id: id }; }) });
    }
    clearMirrorVisuals();
  }

  // ===== Event Handlers =====
  window.__wb_ctrl_down = false;

  function onMouseMove(e) {
    if (!_active || !_renderer) return;
    var rect = _renderer.domElement.getBoundingClientRect();
    _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    var hit = raycast();

    if (_tool === "pin" || _tool === "gravity") {
      if (hit) showPreview(hit.point, hit);
      else hidePreview();
    }
    if (_tool === "brush") {
      if (hit) {
        showPreview(hit.point, hit);
        updateCircleVis(hit.point, _brushTool.radius, 0x44ff44);
      } else {
        hidePreview();
        hideCircleVis();
      }
      if (_mouseDown && _mouseButton === 0 && hit) brushAction(hit);
    }
    if (_tool === "eraser") {
      hidePreview();
      if (hit) updateCircleVis(hit.point, _eraser.radius, 0xff4444);
      else hideCircleVis();
      if (_mouseDown && _mouseButton === 0 && hit) eraserAction(hit);
    }
    if (_tool === "replacer") {
      hidePreview();
      if (hit) updateCircleVis(hit.point, _replacer.radius, 0xffaa00);
      else hideCircleVis();
    }
    if (_tool === "shape" && _shapeDragging && hit) {
      var dx = hit.point.x - _shapeCenter.x, dz = hit.point.z - _shapeCenter.z;
      _shapeRadius = Math.sqrt(dx * dx + dz * dz);
      updateShapeVisuals();
    }
    if ((_tool === "tiling-floor" || _tool === "tiling-wall") && _tilingDragging && hit) {
      _tilingCorner2 = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
      updateTilingVisuals();
    }
    if (_tool === "line" && hit) {
      // Show cursor position for next click
      showPreview(hit.point, hit);
    }
    if (_tool === "mirror" && _mirrorPlane && hit) {
      _mirrorPlane.position.set(hit.point.x, hit.point.y, hit.point.z);
    }
  }

  function onMouseDown(e) {
    if (!_active) return;
    _mouseDown = true;
    _mouseButton = e.button;
    if (e.button !== 0) return;
    var hit = raycast();
    if (!hit) return;

    if (_tool === "pin") {
      pinAction(hit);
    } else if (_tool === "brush") {
      _brushStrokeIds = [];
      _lastBrushPos = null;
      brushAction(hit);
    } else if (_tool === "eraser") {
      eraserAction(hit);
    } else if (_tool === "replacer") {
      replacerAction(hit);
    } else if (_tool === "gravity") {
      gravityAction(hit);
    } else if (_tool === "select") {
      selectAction(hit);
    } else if (_tool === "line") {
      var pos = snapPos({ x: hit.point.x, y: hit.point.y, z: hit.point.z });
      _linePoints.push(pos);
      updateLineVisuals();
    } else if (_tool === "shape") {
      if (!_shapeDragging) {
        _shapeCenter = snapPos({ x: hit.point.x, y: hit.point.y, z: hit.point.z });
        _shapeRadius = 0;
        _shapeDragging = true;
      }
    } else if (_tool === "tiling-floor" || _tool === "tiling-wall") {
      if (!_tilingDragging) {
        _tilingCorner1 = snapPos({ x: hit.point.x, y: hit.point.y, z: hit.point.z });
        _tilingCorner2 = _tilingCorner1;
        _tilingDragging = true;
      }
    } else if (_tool === "mirror") {
      if (_selectedIds.length > 0) {
        showMirrorPlane(hit);
      }
    }
  }

  function onMouseUp(e) {
    _mouseDown = false;
    _mouseButton = -1;
    // Brush stroke end
    if (_tool === "brush" && _brushStrokeIds.length > 0) {
      var batchDatas = [];
      for (var i = 0; i < _brushStrokeIds.length; i++) {
        var entry = _placedObjects[_brushStrokeIds[i]];
        if (entry) batchDatas.push(entry.data);
      }
      var removeCount = _brushStrokeIds.length;
      while (removeCount > 0 && _undoStack.length > 0) {
        var top = _undoStack[_undoStack.length - 1];
        if (top.type === "place" && _brushStrokeIds.indexOf(top.id) >= 0) {
          _undoStack.pop();
          removeCount--;
        } else break;
      }
      pushUndo({ type: "batch-place", ids: _brushStrokeIds.slice(), datas: batchDatas });
      _brushStrokeIds = [];
    }
    _lastBrushPos = null;
    // Shape drag end
    if (_tool === "shape" && _shapeDragging) {
      _shapeDragging = false;
      // Shape stays visible until Enter confirms
    }
    // Tiling drag end
    if ((_tool === "tiling-floor" || _tool === "tiling-wall") && _tilingDragging) {
      _tilingDragging = false;
      // Tiling stays visible until Enter confirms
    }
  }

  function onWheel(e) {
    if (!_active) return;
    var delta = e.deltaY > 0 ? -1 : 1;
    if (_tool === "pin" || _tool === "gravity") {
      if (e.shiftKey) {
        _brush.scaleMultiplier.x = Math.max(0.1, _brush.scaleMultiplier.x + delta * 0.05);
        _brush.scaleMultiplier.y = _brush.scaleMultiplier.x;
        _brush.scaleMultiplier.z = _brush.scaleMultiplier.x;
        try { window.parent.postMessage({ type: "wb-brush-settings-changed", settings: _brush }, "*"); } catch(ex) {}
      } else {
        _brush.surfaceDistance = Math.round((_brush.surfaceDistance + delta * 0.1) * 100) / 100;
        try { window.parent.postMessage({ type: "wb-brush-settings-changed", settings: _brush }, "*"); } catch(ex) {}
      }
    } else if (_tool === "eraser") {
      _eraser.radius = Math.max(0.5, _eraser.radius + delta * 0.5);
      try { window.parent.postMessage({ type: "wb-eraser-settings-changed", settings: _eraser }, "*"); } catch(ex) {}
    } else if (_tool === "replacer") {
      _replacer.radius = Math.max(0.5, _replacer.radius + delta * 0.5);
      try { window.parent.postMessage({ type: "wb-replacer-settings-changed", settings: _replacer }, "*"); } catch(ex) {}
    } else if (_tool === "brush") {
      if (e.shiftKey) {
        _brushTool.density = Math.max(1, Math.min(100, _brushTool.density + delta * 5));
      } else {
        _brushTool.radius = Math.max(0.5, _brushTool.radius + delta * 0.5);
      }
      try { window.parent.postMessage({ type: "wb-brush-tool-settings-changed", settings: _brushTool }, "*"); } catch(ex) {}
    } else if (_tool === "shape" && _shapeCenter) {
      if (e.shiftKey && _shape.shapeType === "polygon") {
        _shape.sidesCount = Math.max(3, _shape.sidesCount + delta);
        try { window.parent.postMessage({ type: "wb-shape-settings-changed", settings: _shape }, "*"); } catch(ex) {}
      } else {
        _shapeRadius = Math.max(0.5, _shapeRadius + delta * 0.5);
      }
      updateShapeVisuals();
    }
    e.preventDefault();
  }

  function onKeyDown(e) {
    if (!_active) return;
    if (e.ctrlKey || e.metaKey) window.__wb_ctrl_down = true;
    if (e.ctrlKey && e.key === "z" && !e.shiftKey) { undo(); e.preventDefault(); }
    else if (e.ctrlKey && (e.key === "y" || (e.key === "z" && e.shiftKey))) { redo(); e.preventDefault(); }
    else if (e.key === "r" || e.key === "R") {
      if (_tool === "pin") {
        _brush.eulerOffset.y = (_brush.eulerOffset.y + 90) % 360;
        try { window.parent.postMessage({ type: "wb-brush-settings-changed", settings: _brush }, "*"); } catch(ex) {}
      }
      if (_tool === "mirror" && _mirrorPlane) {
        // Rotate mirror plane 90 degrees
        _mirrorPlane.rotation.y += Math.PI / 2;
        if (_mirrorNormal.x !== 0) _mirrorNormal = { x: 0, y: 0, z: 1 };
        else _mirrorNormal = { x: 1, y: 0, z: 0 };
      }
    }
    else if (e.key === "Enter") {
      if (_tool === "line") { confirmLine(); e.preventDefault(); }
      else if (_tool === "shape") { confirmShape(); e.preventDefault(); }
      else if (_tool === "tiling-floor" || _tool === "tiling-wall") { confirmTiling(); e.preventDefault(); }
      else if (_tool === "extrude" && _selectedIds.length > 0) { extrudeAction(); e.preventDefault(); }
      else if (_tool === "mirror" && _selectedIds.length > 0) { confirmMirror(); e.preventDefault(); }
    }
    else if (e.key === "Escape") {
      hidePreview();
      hideCircleVis();
      if (_tool === "line") { _linePoints = []; clearLineVisuals(); }
      if (_tool === "shape") { _shapeCenter = null; _shapeRadius = 0; _shapeDragging = false; clearShapeVisuals(); }
      if (_tool === "tiling-floor" || _tool === "tiling-wall") { _tilingCorner1 = null; _tilingCorner2 = null; _tilingDragging = false; clearTilingVisuals(); }
      if (_tool === "mirror") clearMirrorVisuals();
      if (_tool === "select") deselectAll();
    }
    else if (e.key === "Backspace" || e.key === "Delete") {
      if (_tool === "line" && _linePoints.length > 0) {
        _linePoints.pop();
        updateLineVisuals();
        e.preventDefault();
      }
      if (_tool === "select" && _selectedIds.length > 0) {
        var datas = [];
        for (var i = 0; i < _selectedIds.length; i++) {
          var entry = _placedObjects[_selectedIds[i]];
          if (entry) datas.push(entry.data);
        }
        pushUndo({ type: "batch-delete", ids: _selectedIds.slice(), datas: datas });
        for (var i = 0; i < _selectedIds.length; i++) removeObjectById(_selectedIds[i], false);
        _selectedIds = [];
        notifySelection();
        e.preventDefault();
      }
    }
    // Extrude axis shortcuts
    else if (_tool === "extrude") {
      if (e.key === "x" || e.key === "X") _extrudeAxis = "x";
      else if (e.key === "y" || e.key === "Y") _extrudeAxis = "y";
      else if (e.key === "z" || e.key === "Z") _extrudeAxis = "z";
    }
    // Select all with Ctrl+A
    else if (e.ctrlKey && e.key === "a") {
      if (_tool === "select") {
        deselectAll();
        var ids = Object.keys(_placedObjects);
        for (var i = 0; i < ids.length; i++) {
          _selectedIds.push(ids[i]);
          highlightObject(ids[i]);
        }
        notifySelection();
        e.preventDefault();
      }
    }
  }

  function onKeyUp(e) {
    if (!e.ctrlKey && !e.metaKey) window.__wb_ctrl_down = false;
  }

  // ===== postMessage Handler =====
  window.addEventListener("message", function(e) {
    if (e.origin !== window.location.origin) return;
    var msg = e.data;
    if (!msg || typeof msg !== "object" || !msg.type || !msg.type.startsWith("wb-")) return;

    // Auto-capture scene for any wb- message if not yet captured
    // (Population tab and terrain-data requests don't send wb-enable)
    if (!_scene && window.__vibexe_scene__) {
      _scene = window.__vibexe_scene__;
      if (window.__vibexe_camera__) _camera = window.__vibexe_camera__;
      if (!_raycaster && window.THREE) _raycaster = new window.THREE.Raycaster();
      console.log("[WB] Auto-captured scene for " + msg.type);
    }

    if (msg.type === "wb-enable") {
      _active = true;
      window.__wb_active__ = true;
      // Re-capture scene/camera/renderer in case bundle was re-injected
      if (window.__vibexe_scene__) _scene = window.__vibexe_scene__;
      if (window.__vibexe_camera__) _camera = window.__vibexe_camera__;
      if (window.__vibexe_renderer__) {
        _renderer = window.__vibexe_renderer__;
        var canvas = _renderer.domElement;
        if (canvas !== _currentCanvas) {
          if (_currentCanvas) {
            _currentCanvas.removeEventListener("mousemove", onMouseMove);
            _currentCanvas.removeEventListener("mousedown", onMouseDown);
            _currentCanvas.removeEventListener("mouseup", onMouseUp);
            _currentCanvas.removeEventListener("wheel", onWheel);
          }
          canvas.addEventListener("mousemove", onMouseMove);
          canvas.addEventListener("mousedown", onMouseDown);
          canvas.addEventListener("mouseup", onMouseUp);
          canvas.addEventListener("wheel", onWheel, { passive: false });
          _currentCanvas = canvas;
          console.log("[WB] Re-attached to new canvas", canvas.width + "x" + canvas.height);
        }
      }
      if (!_raycaster && window.THREE) _raycaster = new window.THREE.Raycaster();
      updateRaycastTargets();
      updateGrid();
      console.log("[WB] Enabled");
    }
    else if (msg.type === "wb-disable") {
      _active = false;
      window.__wb_active__ = false;
      hidePreview(); hideCircleVis();
      clearLineVisuals(); clearShapeVisuals(); clearTilingVisuals(); clearMirrorVisuals();
      if (_gridHelper && _scene) { _scene.remove(_gridHelper); _gridHelper = null; }
      console.log("[WB] Disabled");
    }
    else if (msg.type === "wb-set-tool") {
      _tool = msg.tool || "pin";
      hideCircleVis();
      clearLineVisuals(); clearShapeVisuals(); clearTilingVisuals(); clearMirrorVisuals();
      _linePoints = [];
      _shapeCenter = null; _shapeRadius = 0; _shapeDragging = false;
      _tilingCorner1 = null; _tilingCorner2 = null; _tilingDragging = false;
      if (_tool !== "pin" && _tool !== "brush" && _tool !== "gravity" && _tool !== "line") hidePreview();
      console.log("[WB] Tool:", _tool);
    }
    else if (msg.type === "wb-set-active-item") { setPreviewItem(msg.item); }
    else if (msg.type === "wb-update-snap") { if (msg.settings) { safeMerge(_snap, msg.settings); updateGrid(); } }
    else if (msg.type === "wb-update-brush-settings") { if (msg.settings) safeMerge(_brush, msg.settings); }
    else if (msg.type === "wb-update-pin-settings") { if (msg.settings) safeMerge(_pin, msg.settings); }
    else if (msg.type === "wb-update-brush-tool-settings") { if (msg.settings) safeMerge(_brushTool, msg.settings); }
    else if (msg.type === "wb-update-eraser-settings") { if (msg.settings) safeMerge(_eraser, msg.settings); }
    else if (msg.type === "wb-update-line-settings") { if (msg.settings) safeMerge(_line, msg.settings); }
    else if (msg.type === "wb-update-shape-settings") { if (msg.settings) safeMerge(_shape, msg.settings); }
    else if (msg.type === "wb-update-tiling-settings") { if (msg.settings) safeMerge(_tiling, msg.settings); }
    else if (msg.type === "wb-update-gravity-settings") { if (msg.settings) safeMerge(_gravity, msg.settings); }
    else if (msg.type === "wb-update-replacer-settings") { if (msg.settings) safeMerge(_replacer, msg.settings); }
    else if (msg.type === "wb-update-extrude-settings") { if (msg.settings) safeMerge(_extrude, msg.settings); }
    else if (msg.type === "wb-update-mirror-settings") { if (msg.settings) safeMerge(_mirror, msg.settings); }
    else if (msg.type === "wb-extrude-axis") { _extrudeAxis = msg.axis || "x"; }
    else if (msg.type === "wb-confirm-line") { confirmLine(); }
    else if (msg.type === "wb-confirm-shape") { confirmShape(); }
    else if (msg.type === "wb-confirm-tiling") { confirmTiling(); }
    else if (msg.type === "wb-confirm-extrude") { extrudeAction(); }
    else if (msg.type === "wb-confirm-mirror") { confirmMirror(); }
    else if (msg.type === "wb-delete-selected") {
      if (_selectedIds.length > 0) {
        var datas = [];
        for (var i = 0; i < _selectedIds.length; i++) {
          var entry = _placedObjects[_selectedIds[i]];
          if (entry) datas.push(entry.data);
        }
        pushUndo({ type: "batch-delete", ids: _selectedIds.slice(), datas: datas });
        for (var i = 0; i < _selectedIds.length; i++) removeObjectById(_selectedIds[i], false);
        _selectedIds = [];
        notifySelection();
      }
    }
    else if (msg.type === "wb-select-all") {
      deselectAll();
      var ids = Object.keys(_placedObjects);
      for (var i = 0; i < ids.length; i++) {
        _selectedIds.push(ids[i]);
        highlightObject(ids[i]);
      }
      notifySelection();
    }
    else if (msg.type === "wb-undo") { undo(); }
    else if (msg.type === "wb-redo") { redo(); }
    else if (msg.type === "wb-clear-all") {
      var ids = Object.keys(_placedObjects);
      for (var i = 0; i < ids.length; i++) removeObjectById(ids[i], true);
      _undoStack = []; _redoStack = [];
      _octree = createOctree();
      _selectedIds = [];
      notifyUndoState();
      notifySelection();
      try { window.parent.postMessage({ type: "wb-cleared" }, "*"); } catch(ex) {}
    }
    else if (msg.type === "wb-get-placed-objects") {
      var objs = [];
      var ids = Object.keys(_placedObjects);
      for (var i = 0; i < ids.length; i++) {
        var entry = _placedObjects[ids[i]];
        if (entry && entry.data) {
          entry.data.position = { x: entry.mesh.position.x, y: entry.mesh.position.y, z: entry.mesh.position.z };
          entry.data.rotation = { x: entry.mesh.rotation.x, y: entry.mesh.rotation.y, z: entry.mesh.rotation.z };
          entry.data.scale = { x: entry.mesh.scale.x, y: entry.mesh.scale.y, z: entry.mesh.scale.z };
          objs.push(entry.data);
        }
      }
      try { window.parent.postMessage({ type: "wb-placed-objects", objects: objs }, "*"); } catch(ex) {}
    }
    else if (msg.type === "wb-restore-objects") {
      var arr = msg.objects || [];
      for (var i = 0; i < arr.length; i++) restoreObject(arr[i], true);
      console.log("[WB] Restored " + arr.length + " objects");
    }
    // ===== Population System Handlers =====
    else if (msg.type === "wb-populate-spawn") {
      if (!_scene) return;
      // Batch spawn objects from population engine
      // msg.objects: Array<{ id, modelPath, packId, position, rotation, scale }>
      var popObjs = msg.objects || [];
      var layerId = msg.layerId || "unknown";
      var spawned = 0;
      var batchSize = 10; // Load 10 at a time to avoid overwhelming GLTFLoader
      var queue = popObjs.slice();
      function spawnBatch() {
        var batch = queue.splice(0, batchSize);
        if (batch.length === 0) {
          console.log("[WB:Pop] Spawned " + spawned + " objects for layer " + layerId);
          try { window.parent.postMessage({ type: "wb-populate-complete", layerId: layerId, count: spawned }, "*"); } catch(ex) {}
          return;
        }
        var pending = batch.length;
        for (var i = 0; i < batch.length; i++) {
          (function(obj) {
            var data = {
              id: obj.id || genId(),
              modelPath: obj.modelPath,
              pack: obj.packId,
              position: obj.position,
              rotation: obj.rotation || { x: 0, y: 0, z: 0 },
              scale: typeof obj.scale === "object" ? obj.scale : { x: obj.scale || 1, y: obj.scale || 1, z: obj.scale || 1 },
              name: "pop_" + layerId,
              itemId: obj.entryId || "",
              toolSource: "population",
              populationLayerId: layerId,
            };
            restoreObject(data, true);
            spawned++;
            pending--;
            if (pending === 0) {
              try { window.parent.postMessage({ type: "wb-populate-progress", layerId: layerId, spawned: spawned, total: popObjs.length }, "*"); } catch(ex) {}
              setTimeout(spawnBatch, 16); // Yield to render loop
            }
          })(batch[i]);
        }
      }
      spawnBatch();
    }
    else if (msg.type === "wb-populate-clear") {
      if (!_scene) return;
      // Clear all objects belonging to a population layer
      var clearLayerId = msg.layerId;
      var cleared = 0;
      var ids = Object.keys(_placedObjects);
      for (var i = 0; i < ids.length; i++) {
        var entry = _placedObjects[ids[i]];
        if (entry && entry.data && entry.data.populationLayerId === clearLayerId) {
          removeObjectById(ids[i], true);
          cleared++;
        }
      }
      console.log("[WB:Pop] Cleared " + cleared + " objects from layer " + clearLayerId);
      try { window.parent.postMessage({ type: "wb-populate-cleared", layerId: clearLayerId, count: cleared }, "*"); } catch(ex) {}
    }
    else if (msg.type === "wb-populate-clear-all") {
      if (!_scene) return;
      // Clear ALL population objects (all layers)
      var cleared = 0;
      var ids = Object.keys(_placedObjects);
      for (var i = 0; i < ids.length; i++) {
        var entry = _placedObjects[ids[i]];
        if (entry && entry.data && entry.data.toolSource === "population") {
          removeObjectById(ids[i], true);
          cleared++;
        }
      }
      console.log("[WB:Pop] Cleared all " + cleared + " population objects");
      try { window.parent.postMessage({ type: "wb-populate-cleared-all", count: cleared }, "*"); } catch(ex) {}
    }
    // ===== Population Preview Handlers =====
    else if (msg.type === "wb-populate-heatmap-preview") {
      // Render heatmap as semi-transparent overlay on terrain
      // msg: { heatmapData: number[], width, height, bounds: {minX,maxX,minZ,maxZ,minY,maxY} }
      // Remove existing overlay (dispose GPU resources)
      if (_scene) {
        var oldOverlay = _scene.getObjectByName("__pop_heatmap_overlay__");
        if (oldOverlay) {
          _scene.remove(oldOverlay);
          if (oldOverlay.geometry) oldOverlay.geometry.dispose();
          if (oldOverlay.material) {
            if (oldOverlay.material.map) oldOverlay.material.map.dispose();
            oldOverlay.material.dispose();
          }
        }
      }
      if (!_scene || !msg.heatmapData || !msg.bounds) return;

      var hmW = msg.width || 128;
      var hmH = msg.height || 128;
      var hmData = msg.heatmapData;
      var hmBounds = msg.bounds;
      if (hmData.length < hmW * hmH) return;

      // Create RGBA DataTexture: green = high density, transparent = low density
      var rgba = new Uint8Array(hmW * hmH * 4);
      for (var i = 0; i < hmW * hmH; i++) {
        var v = hmData[i] || 0; // 0-1 float
        // Color ramp: transparent black → green → bright green
        rgba[i * 4 + 0] = Math.floor(v * 30);       // R (hint of color)
        rgba[i * 4 + 1] = Math.floor(50 + v * 205);  // G (50-255)
        rgba[i * 4 + 2] = Math.floor(v * 30);        // B
        rgba[i * 4 + 3] = Math.floor(v * 180);       // A (0-180, never fully opaque)
      }

      var tex = new THREE.DataTexture(rgba, hmW, hmH, THREE.RGBAFormat);
      tex.needsUpdate = true;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;

      var planeW = hmBounds.maxX - hmBounds.minX;
      var planeD = hmBounds.maxZ - hmBounds.minZ;
      var geo = new THREE.PlaneGeometry(planeW, planeD);
      var mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      var overlay = new THREE.Mesh(geo, mat);
      overlay.name = "__pop_heatmap_overlay__";
      // Position: center of terrain, slightly above max height
      overlay.position.set(
        (hmBounds.minX + hmBounds.maxX) / 2,
        hmBounds.maxY + 0.5,
        (hmBounds.minZ + hmBounds.maxZ) / 2
      );
      overlay.rotation.x = -Math.PI / 2; // Lay flat (PlaneGeometry is XY)
      overlay.renderOrder = 999;
      _scene.add(overlay);
      console.log("[WB:Pop] Heatmap overlay added (" + hmW + "x" + hmH + ")");
    }
    else if (msg.type === "wb-populate-heatmap-hide") {
      // Remove heatmap overlay + dispose GPU resources
      if (_scene) {
        var hmOverlay = _scene.getObjectByName("__pop_heatmap_overlay__");
        if (hmOverlay) {
          _scene.remove(hmOverlay);
          if (hmOverlay.geometry) hmOverlay.geometry.dispose();
          if (hmOverlay.material) {
            if (hmOverlay.material.map) hmOverlay.material.map.dispose();
            hmOverlay.material.dispose();
          }
          console.log("[WB:Pop] Heatmap overlay removed");
        }
      }
    }
    else if (msg.type === "wb-populate-preview-points") {
      // Render preview dots at computed spawn positions
      // msg: { points: Array<{x,y,z}>, color?: string, layerId: string }
      if (_scene) {
        var oldPts = _scene.getObjectByName("__pop_preview_points__");
        if (oldPts) {
          _scene.remove(oldPts);
          if (oldPts.geometry) oldPts.geometry.dispose();
          if (oldPts.material) oldPts.material.dispose();
        }
      }
      if (!_scene || !msg.points || msg.points.length === 0) return;

      var pts = msg.points;
      var positions = new Float32Array(pts.length * 3);
      var validCount = 0;
      for (var i = 0; i < pts.length; i++) {
        if (!isFinite(pts[i].x) || !isFinite(pts[i].y) || !isFinite(pts[i].z)) continue;
        positions[validCount * 3 + 0] = pts[i].x;
        positions[validCount * 3 + 1] = pts[i].y + 0.3; // Lift slightly above terrain
        positions[validCount * 3 + 2] = pts[i].z;
        validCount++;
      }

      var ptGeo = new THREE.BufferGeometry();
      ptGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      ptGeo.setDrawRange(0, validCount);
      var ptColor = msg.color || "#00ff88";
      var ptMat = new THREE.PointsMaterial({
        color: new THREE.Color(ptColor),
        size: 0.4,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      var pointCloud = new THREE.Points(ptGeo, ptMat);
      pointCloud.name = "__pop_preview_points__";
      pointCloud.renderOrder = 998;
      _scene.add(pointCloud);
      console.log("[WB:Pop] Preview points: " + pts.length + " markers");
      try { window.parent.postMessage({ type: "wb-populate-preview-ready", count: pts.length }, "*"); } catch(ex) {}
    }
    else if (msg.type === "wb-populate-preview-clear") {
      // Remove both heatmap overlay and point preview + dispose GPU resources
      if (_scene) {
        var hmOv = _scene.getObjectByName("__pop_heatmap_overlay__");
        if (hmOv) {
          _scene.remove(hmOv);
          if (hmOv.geometry) hmOv.geometry.dispose();
          if (hmOv.material) { if (hmOv.material.map) hmOv.material.map.dispose(); hmOv.material.dispose(); }
        }
        var ptOv = _scene.getObjectByName("__pop_preview_points__");
        if (ptOv) {
          _scene.remove(ptOv);
          if (ptOv.geometry) ptOv.geometry.dispose();
          if (ptOv.material) ptOv.material.dispose();
        }
        console.log("[WB:Pop] Preview cleared");
      }
    }
    else if (msg.type === "wb-get-terrain-data") {
      // Extract terrain heightmap data for population engine
      var terrainMesh = null;
      // Primary path: read from __vibexe_terrainData (set by visual-edit-bridge terrain painter)
      // NOTE: td.heightData stores WORLD-SPACE heights. Population engine expects NORMALIZED 0-1.
      var td = window.__vibexe_terrainData;
      if (td && td.heightData) {
        var tdRes = td.segX || td.segZ || Math.floor(Math.sqrt(td.heightData.length));
        var tdHW = td.width / 2, tdHD = td.depth / 2;
        if (!isFinite(tdHW) || !isFinite(tdHD)) {
          try { window.parent.postMessage({ type: "wb-terrain-data", error: "invalid-bounds" }, "*"); } catch(ex) {}
          return;
        }
        var tdMinY = td.minY !== undefined ? td.minY : 0;
        var tdMaxY = td.maxY !== undefined ? td.maxY : 40;
        var tdRange = tdMaxY - tdMinY || 1;
        // Normalize heightData to 0-1 range
        var normalized = new Float32Array(td.heightData.length);
        for (var ni = 0; ni < td.heightData.length; ni++) {
          normalized[ni] = (td.heightData[ni] - tdMinY) / tdRange;
        }
        try {
          window.parent.postMessage({
            type: "wb-terrain-data",
            heightData: Array.from(normalized),
            resolution: tdRes,
            bounds: {
              minX: -tdHW, maxX: tdHW,
              minZ: -tdHD, maxZ: tdHD,
              minY: tdMinY, maxY: tdMaxY,
            },
          }, "*");
        } catch(ex) { console.warn("[WB:Pop] Failed to send terrain data:", ex); }
        return;
      }
      // Fallback: find __terrain__ mesh in scene
      if (_scene) {
        _scene.traverse(function(obj) {
          if (obj.name === "__terrain__" && obj.geometry) terrainMesh = obj;
        });
      }
      if (terrainMesh) {
        var positions = terrainMesh.geometry.attributes.position.array;
        var vertexCount = positions.length / 3;
        var res = Math.round(Math.sqrt(vertexCount));
        if (Math.abs(res * res - vertexCount) <= res) {
          var hd2 = new Float32Array(vertexCount);
          var minY2 = Infinity, maxY2 = -Infinity;
          var minX2 = Infinity, maxX2 = -Infinity;
          var minZ2 = Infinity, maxZ2 = -Infinity;
          for (var i = 0; i < vertexCount; i++) {
            var vx = positions[i*3], vy = positions[i*3+1], vz = positions[i*3+2];
            minX2 = Math.min(minX2, vx); maxX2 = Math.max(maxX2, vx);
            minY2 = Math.min(minY2, vy); maxY2 = Math.max(maxY2, vy);
            minZ2 = Math.min(minZ2, vz); maxZ2 = Math.max(maxZ2, vz);
          }
          var range = maxY2 - minY2 || 1;
          for (var i = 0; i < vertexCount; i++) hd2[i] = (positions[i*3+1] - minY2) / range;
          var wp = terrainMesh.position || { x: 0, y: 0, z: 0 };
          try {
            window.parent.postMessage({
              type: "wb-terrain-data",
              heightData: Array.from(hd2),
              resolution: res,
              bounds: {
                minX: minX2 + wp.x, maxX: maxX2 + wp.x,
                minZ: minZ2 + wp.z, maxZ: maxZ2 + wp.z,
                minY: minY2 + wp.y, maxY: maxY2 + wp.y,
              },
            }, "*");
          } catch(ex) { console.warn("[WB:Pop] Failed to send terrain data:", ex); }
        }
      } else {
        try { window.parent.postMessage({ type: "wb-terrain-data", error: "no-terrain" }, "*"); } catch(ex) {}
      }
    }
  });

  // ===== Init =====
  waitForScene(function(editor) {
    _scene = editor.scene;
    _camera = editor.camera;
    _renderer = editor.renderer;
    _raycaster = new THREE.Raycaster();
    _octree = createOctree();

    var canvas = _renderer.domElement;
    _currentCanvas = canvas;
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    updateRaycastTargets();
    console.log("[WB] Init complete — 12 tools ready");

    try { window.parent.postMessage({ type: "wb-ready" }, "*"); } catch(ex) {}
  });

})();
`;
}
