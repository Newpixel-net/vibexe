/**
 * Game Editor Bridge Script — Unity/Godot-style scene editor
 *
 * Injected into Sandpack iframe to enable 3D scene editing.
 * Pauses game loop, enables OrbitControls + TransformControls + Raycaster.
 * Communicates with parent via postMessage.
 * Mirrors the pattern of visual-edit-bridge.ts.
 */

export function getGameEditorBridgeScript(): string {
	return `
(function() {
  console.log("[GameEditorBridge] Script loaded");

  var active = false;
  var raycaster = null;
  var mouse = null;
  var selectedObj = null;
  var boxHelper = null;
  var transformControls = null;
  var editor = null;
  var pendingEnable = false;

  // Notify parent that bridge is ready
  try {
    window.parent.postMessage({ type: "game-editor-bridge-loaded" }, "*");
  } catch(e) {
    console.warn("[GameEditorBridge] Failed to notify parent:", e);
  }

  // Wait for __vibexe_editor__ to appear (Game3D.tsx exposes it after init)
  function waitForEditor(cb) {
    // Check immediately first
    if (window.__vibexe_editor__) {
      console.log("[GameEditorBridge] __vibexe_editor__ found immediately");
      cb(window.__vibexe_editor__);
      return;
    }
    console.log("[GameEditorBridge] Polling for __vibexe_editor__...");
    var attempts = 0;
    var timer = setInterval(function() {
      if (window.__vibexe_editor__) {
        clearInterval(timer);
        console.log("[GameEditorBridge] __vibexe_editor__ found after " + attempts + " attempts");
        cb(window.__vibexe_editor__);
      } else if (++attempts > 200) { // 10s timeout
        clearInterval(timer);
        console.warn("[GameEditorBridge] Timed out waiting for __vibexe_editor__");
      }
    }, 50);
  }

  // Strip non-serializable values (functions, Three.js objects) from userData for postMessage
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

  // ===== Scene Serializer =====
  function serializeNode(obj) {
    if (!obj) return null;
    var children = [];
    if (obj.children) {
      for (var i = 0; i < obj.children.length; i++) {
        var child = obj.children[i];
        // Skip editor helpers (BoxHelper, TransformControls, GridHelper)
        if (child === boxHelper) continue;
        if (child === transformControls) continue;
        if (child.type === "BoxHelper" || child.type === "TransformControlsGizmo" || child.type === "TransformControlsPlane") continue;
        if (child.isTransformControls) continue;
        // Skip particles, trails, and Points objects (VFX internals)
        if (child.type === "Points") continue;
        if (child.name && (child.name.indexOf("__particle_") === 0 || child.name.indexOf("__trail_") === 0)) continue;
        var serialized = serializeNode(child);
        if (serialized) children.push(serialized);
      }
    }

    var matColor = null;
    if (obj.material && obj.material.color) {
      try { matColor = "#" + obj.material.color.getHexString(); } catch(e) {}
    }
    // For groups, check first mesh child color
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
      uuid: obj.uuid,
      name: obj.name || obj.type,
      type: obj.type || "Object3D",
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: {
        x: (obj.rotation.x * 180 / Math.PI),
        y: (obj.rotation.y * 180 / Math.PI),
        z: (obj.rotation.z * 180 / Math.PI)
      },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      visible: obj.visible !== false,
      userData: safeUserData(obj.userData),
      children: children,
      _isMesh: !!obj.isMesh,
      _isLight: !!obj.isLight,
      _isGroup: !!obj.isGroup,
      _materialColor: matColor
    };
  }

  function sendSceneTree() {
    if (!editor || !editor.scene) return;
    var tree = serializeNode(editor.scene);
    window.parent.postMessage({ type: "game-editor-scene-tree", tree: tree }, "*");
  }

  function sendSelectedObject(obj) {
    if (!obj) {
      window.parent.postMessage({ type: "game-editor-object-deselected" }, "*");
      return;
    }
    var matColor = null;
    if (obj.material && obj.material.color) {
      try { matColor = "#" + obj.material.color.getHexString(); } catch(e) {}
    }
    window.parent.postMessage({
      type: "game-editor-object-selected",
      uuid: obj.uuid,
      name: obj.name || obj.type,
      type: obj.userData?.vibexeType || obj.type,
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: {
        x: (obj.rotation.x * 180 / Math.PI),
        y: (obj.rotation.y * 180 / Math.PI),
        z: (obj.rotation.z * 180 / Math.PI)
      },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      visible: obj.visible !== false,
      castShadow: !!obj.castShadow,
      userData: safeUserData(obj.userData),
      _materialColor: matColor,
      _textureUrl: obj.userData?.vibexeArgs?.textureUrl || null,
      _textureTileX: obj.userData?.vibexeArgs?.textureTileX || 1,
      _textureTileY: obj.userData?.vibexeArgs?.textureTileY || 1,
      _textureRotation: obj.userData?.vibexeArgs?.textureRotation || 0,
      _textureOffsetX: obj.userData?.vibexeArgs?.textureOffsetX || 0,
      _textureOffsetY: obj.userData?.vibexeArgs?.textureOffsetY || 0,
      _hasPBR: obj.userData?.vibexeArgs?.hasPBR || false
    }, "*");
  }

  // ===== Selection =====
  function selectObject(obj) {
    deselectObject();
    if (!obj || !editor) return;
    selectedObj = obj;

    var THREE = window.THREE;

    // BoxHelper highlight
    boxHelper = new THREE.BoxHelper(obj, 0x00ff88);
    boxHelper.name = "__editor_box_helper__";
    // Override for animated characters — SkinnedMesh bind-pose gives wrong Box3
    if (obj.userData && obj.userData.vibexeType === "AnimatedCharacter" && obj.userData.__characterBounds) {
      var _cb = obj.userData.__characterBounds;
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

    // TransformControls gizmo
    if (THREE.TransformControls) {
      transformControls = new THREE.TransformControls(editor.camera, editor.renderer.domElement);
      transformControls.name = "__editor_transform_controls__";
      transformControls.attach(obj);

      // Disable orbit when dragging gizmo
      transformControls.addEventListener("dragging-changed", function(e) {
        if (editor.orbitControls) {
          editor.orbitControls.enabled = !e.value;
        }
      });

      // Send transform updates while dragging
      transformControls.addEventListener("objectChange", function() {
        if (selectedObj) {
          sendSelectedObject(selectedObj);
          if (boxHelper) boxHelper.update();
        }
      });

      editor.scene.add(transformControls.getHelper ? transformControls.getHelper() : transformControls);
    }

    sendSelectedObject(obj);
  }

  function deselectObject() {
    if (!editor) return;
    if (boxHelper) {
      editor.scene.remove(boxHelper);
      boxHelper.dispose ? boxHelper.dispose() : null;
      boxHelper = null;
    }
    if (transformControls) {
      transformControls.detach();
      editor.scene.remove(transformControls.getHelper ? transformControls.getHelper() : transformControls);
      transformControls.dispose();
      transformControls = null;
    }
    selectedObj = null;
    window.parent.postMessage({ type: "game-editor-object-deselected" }, "*");
  }

  function findObjectByUuid(obj, uuid) {
    if (!obj) return null;
    if (obj.uuid === uuid) return obj;
    if (obj.children) {
      for (var i = 0; i < obj.children.length; i++) {
        var found = findObjectByUuid(obj.children[i], uuid);
        if (found) return found;
      }
    }
    return null;
  }

  // Find the scene-level (depth-1) parent of a deeply nested mesh
  function findSceneLevelParent(obj) {
    if (!obj || !editor) return obj;
    var current = obj;
    while (current.parent && current.parent !== editor.scene) {
      current = current.parent;
    }
    return current;
  }

  // ===== Click Handler =====
  function onCanvasClick(e) {
    if (!active || !editor) return;
    // Don't intercept if TransformControls is dragging
    if (transformControls && transformControls.dragging) return;

    var THREE = window.THREE;
    var rect = editor.renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, editor.camera);

    // Get all meshes from scene (exclude helpers)
    var meshes = [];
    editor.scene.traverse(function(child) {
      if (child.isMesh && child !== boxHelper &&
          child.type !== "TransformControlsGizmo" &&
          child.type !== "TransformControlsPlane" &&
          !child.name.startsWith("__editor_")) {
        meshes.push(child);
      }
    });

    var intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      var hit = intersects[0].object;
      // Walk up to scene-level parent (Group from factory helpers)
      var target = findSceneLevelParent(hit);
      if (target && target !== editor.scene) {
        selectObject(target);
      }
    } else {
      deselectObject();
    }
  }

  // ===== Keyboard Shortcuts =====
  function onKeyDown(e) {
    if (!active) return;
    var tag = (e.target || {}).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    switch (e.key) {
      case "w":
      case "W":
        if (transformControls) transformControls.setMode("translate");
        window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "translate" }, "*");
        e.preventDefault();
        break;
      case "e":
      case "E":
        if (transformControls) transformControls.setMode("rotate");
        window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "rotate" }, "*");
        e.preventDefault();
        break;
      case "r":
      case "R":
        if (transformControls) transformControls.setMode("scale");
        window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "scale" }, "*");
        e.preventDefault();
        break;
      case "Escape":
        deselectObject();
        e.preventDefault();
        break;
      case "Delete":
      case "Backspace":
        if (selectedObj) {
          var uuid = selectedObj.uuid;
          editor.scene.remove(selectedObj);
          deselectObject();
          sendSceneTree();
          window.parent.postMessage({ type: "game-editor-object-deleted", uuid: uuid }, "*");
        }
        e.preventDefault();
        break;
    }
  }

  // ===== Editor Animation Loop =====
  var editorAnimId = 0;
  function editorLoop() {
    if (!active || !editor) return;
    editorAnimId = requestAnimationFrame(editorLoop);
    if (editor.orbitControls) editor.orbitControls.update();
    if (boxHelper && selectedObj) boxHelper.update();
    editor.renderer.render(editor.scene, editor.camera);
  }

  // ===== Activate / Deactivate =====
  function activate() {
    if (active) {
      console.log("[GameEditorBridge] Already active, skipping activate");
      return;
    }
    console.log("[GameEditorBridge] activate() called");
    waitForEditor(function(ed) {
      editor = ed;
      active = true;
      pendingEnable = false;

      var THREE = window.THREE;
      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();

      // Pause game loop
      console.log("[GameEditorBridge] Pausing game...");
      editor.pause();

      // Attach listeners
      editor.renderer.domElement.addEventListener("click", onCanvasClick);
      window.addEventListener("keydown", onKeyDown, true);

      // Start editor render loop
      editorLoop();

      // Send scene tree to parent
      setTimeout(function() {
        console.log("[GameEditorBridge] Sending scene tree to parent");
        sendSceneTree();
        window.parent.postMessage({ type: "game-editor-ready" }, "*");
      }, 100);
    });
  }

  function deactivate() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(editorAnimId);

    deselectObject();

    if (editor) {
      editor.renderer.domElement.removeEventListener("click", onCanvasClick);
      editor.resume();
    }

    window.removeEventListener("keydown", onKeyDown, true);
    raycaster = null;
    mouse = null;
    editor = null;
  }

  // ===== Property Updates =====
  function updateProperty(uuid, property, value) {
    if (!editor) return;
    var obj = findObjectByUuid(editor.scene, uuid);
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

    if (boxHelper && selectedObj && selectedObj.uuid === uuid) {
      boxHelper.update();
    }
    sendSelectedObject(obj);
    sendSceneTree();
  }

  // ===== PostMessage Handler =====
  window.addEventListener("message", function(e) {
    var d = e.data;
    if (!d || !d.type) return;

    // Log game-editor messages for debugging
    if (typeof d.type === "string" && d.type.indexOf("game-editor") === 0) {
      console.log("[GameEditorBridge] Received message:", d.type);
    }

    switch (d.type) {
      case "game-editor-enable":
        activate();
        break;
      case "game-editor-disable":
        deactivate();
        break;
      case "game-editor-set-mode":
        if (transformControls && d.mode) {
          transformControls.setMode(d.mode);
        }
        break;
      case "game-editor-select-by-uuid":
        if (editor && d.uuid) {
          var obj = findObjectByUuid(editor.scene, d.uuid);
          if (obj) selectObject(obj);
        }
        break;
      case "game-editor-deselect":
        deselectObject();
        break;
      case "game-editor-update-property":
        if (d.uuid && d.property !== undefined) {
          updateProperty(d.uuid, d.property, d.value);
        }
        break;
      case "game-editor-delete-object":
        if (editor && d.uuid) {
          var toDelete = findObjectByUuid(editor.scene, d.uuid);
          if (toDelete) {
            if (selectedObj && selectedObj.uuid === d.uuid) deselectObject();
            editor.scene.remove(toDelete);
            sendSceneTree();
          }
        }
        break;
      case "game-editor-apply-texture": {
        // Apply texture to object — handles both PBR and basic textures
        if (!editor || !editor.scene || !d.uuid || !d.textureUrl) break;
        var _atTarget = findObjectByUuid(editor.scene, d.uuid);
        if (!_atTarget) break;
        var THREE = window.THREE;
        if (!THREE) break;
        var _atUrl = d.textureUrl;
        var _atTileX = d.tileX || 1;
        var _atTileY = d.tileY || 1;
        var _atPBR = !!d.hasPBR;
        // Resolve relative URLs
        var _atResolvedUrl = _atUrl;
        if (_atUrl.charAt(0) === '/') {
          _atResolvedUrl = (window.__VIBEXE_API_ORIGIN__ || '') + _atUrl;
        }
        // Store in userData immediately
        if (!_atTarget.userData) _atTarget.userData = {};
        if (!_atTarget.userData.vibexeArgs) _atTarget.userData.vibexeArgs = {};
        _atTarget.userData.vibexeArgs.textureUrl = _atUrl;
        _atTarget.userData.vibexeArgs.textureTileX = _atTileX;
        _atTarget.userData.vibexeArgs.textureTileY = _atTileY;
        _atTarget.userData.vibexeArgs.textureRotation = 0;
        _atTarget.userData.vibexeArgs.textureOffsetX = 0;
        _atTarget.userData.vibexeArgs.textureOffsetY = 0;
        if (_atPBR) _atTarget.userData.vibexeArgs.hasPBR = true;
        else delete _atTarget.userData.vibexeArgs.hasPBR;
        if (!_atTarget.userData.__spawned) _atTarget.__hasTextureOverride = true;
        // Load and apply texture
        var _atLoader = new THREE.TextureLoader();
        var _atCfg = function(tex) {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(_atTileX, _atTileY);
          tex.anisotropy = 4;
          tex.colorSpace = THREE.SRGBColorSpace || 'srgb';
          return tex;
        };
        _atLoader.load(_atResolvedUrl, function(colorTex) {
          _atCfg(colorTex);
          _atTarget.traverse(function(m) {
            if (!m.isMesh || !m.material) return;
            if (_atPBR) {
              m.material = new THREE.MeshStandardMaterial({ map: colorTex, roughness: 0.7, metalness: 0.0 });
            } else {
              m.material.map = colorTex;
            }
            m.material.needsUpdate = true;
          });
          // Load PBR maps
          if (_atPBR) {
            var _bne = _atResolvedUrl.replace(/\.[^.]+$/, '');
            var _ext = (_atResolvedUrl.match(/\.[^.]+$/) || ['.jpg'])[0];
            var _loadPBR = function(suffix, applier) {
              _atLoader.load(_bne + suffix + _ext, function(t) {
                t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
                t.repeat.set(_atTileX, _atTileY); t.anisotropy = 4;
                _atTarget.traverse(function(m) { if (m.isMesh && m.material) { applier(m.material, t); m.material.needsUpdate = true; } });
              }, undefined, function() {});
            };
            _loadPBR('_Normal', function(mat, t) { mat.normalMap = t; });
            _loadPBR('_Roughness', function(mat, t) { mat.roughnessMap = t; });
            _loadPBR('_Metalness', function(mat, t) { mat.metalnessMap = t; });
          }
          console.log("[GameEditorBridge] Texture applied:", _atUrl, "PBR:", _atPBR);
          sendSelectedObject(_atTarget);
        }, undefined, function(err) {
          console.warn("[GameEditorBridge] Texture load failed:", _atUrl);
        });
        // Send updated object info immediately (before texture loads)
        sendSelectedObject(_atTarget);
        break;
      }
      case "game-editor-remove-texture": {
        if (!editor || !editor.scene || !d.uuid) break;
        var _rtTarget = findObjectByUuid(editor.scene, d.uuid);
        if (!_rtTarget) break;
        var THREE = window.THREE;
        // Clear userData
        if (_rtTarget.userData && _rtTarget.userData.vibexeArgs) {
          delete _rtTarget.userData.vibexeArgs.textureUrl;
          delete _rtTarget.userData.vibexeArgs.textureTileX;
          delete _rtTarget.userData.vibexeArgs.textureTileY;
          delete _rtTarget.userData.vibexeArgs.textureRotation;
          delete _rtTarget.userData.vibexeArgs.textureOffsetX;
          delete _rtTarget.userData.vibexeArgs.textureOffsetY;
          delete _rtTarget.userData.vibexeArgs.hasPBR;
        }
        // Restore default material
        _rtTarget.traverse(function(m) {
          if (m.isMesh && m.material) {
            if (m.material.map) { m.material.map.dispose(); m.material.map = null; }
            if (m.material.normalMap) { m.material.normalMap.dispose(); m.material.normalMap = null; }
            if (m.material.roughnessMap) { m.material.roughnessMap.dispose(); m.material.roughnessMap = null; }
            if (m.material.metalnessMap) { m.material.metalnessMap.dispose(); m.material.metalnessMap = null; }
            m.material.needsUpdate = true;
          }
        });
        sendSelectedObject(_rtTarget);
        break;
      }
      case "game-editor-update-texture-params": {
        if (!editor || !editor.scene || !d.uuid) break;
        var _tpTarget = findObjectByUuid(editor.scene, d.uuid);
        if (!_tpTarget || !_tpTarget.userData?.vibexeArgs?.textureUrl) break;
        var _tpArgs = _tpTarget.userData.vibexeArgs;
        _tpArgs.textureTileX = d.tileX || 1;
        _tpArgs.textureTileY = d.tileY || 1;
        _tpArgs.textureRotation = d.rotation || 0;
        _tpArgs.textureOffsetX = d.offsetX || 0;
        _tpArgs.textureOffsetY = d.offsetY || 0;
        var _rot = (_tpArgs.textureRotation || 0) * Math.PI / 180;
        _tpTarget.traverse(function(m) {
          if (m.isMesh && m.material && m.material.map) {
            m.material.map.repeat.set(d.tileX || 1, d.tileY || 1);
            m.material.map.rotation = _rot;
            m.material.map.offset.set(d.offsetX || 0, d.offsetY || 0);
            m.material.map.center.set(0.5, 0.5);
            m.material.map.needsUpdate = true;
            if (m.material.normalMap) { m.material.normalMap.repeat.set(d.tileX || 1, d.tileY || 1); m.material.normalMap.rotation = _rot; m.material.normalMap.offset.set(d.offsetX || 0, d.offsetY || 0); m.material.normalMap.center.set(0.5, 0.5); }
            if (m.material.roughnessMap) { m.material.roughnessMap.repeat.set(d.tileX || 1, d.tileY || 1); m.material.roughnessMap.rotation = _rot; m.material.roughnessMap.offset.set(d.offsetX || 0, d.offsetY || 0); m.material.roughnessMap.center.set(0.5, 0.5); }
            if (m.material.metalnessMap) { m.material.metalnessMap.repeat.set(d.tileX || 1, d.tileY || 1); m.material.metalnessMap.rotation = _rot; m.material.metalnessMap.offset.set(d.offsetX || 0, d.offsetY || 0); m.material.metalnessMap.center.set(0.5, 0.5); }
          }
        });
        if (!_tpTarget.userData.__spawned) _tpTarget.__hasTextureOverride = true;
        sendSelectedObject(_tpTarget);
        break;
      }
      case "game-editor-update-tiling": {
        if (!editor || !editor.scene || !d.uuid) break;
        var _utTarget = findObjectByUuid(editor.scene, d.uuid);
        if (!_utTarget || !_utTarget.userData?.vibexeArgs?.textureUrl) break;
        _utTarget.userData.vibexeArgs.textureTileX = d.tileX || 1;
        _utTarget.userData.vibexeArgs.textureTileY = d.tileY || 1;
        _utTarget.traverse(function(m) {
          if (m.isMesh && m.material && m.material.map) {
            m.material.map.repeat.set(d.tileX || 1, d.tileY || 1);
            m.material.map.needsUpdate = true;
            if (m.material.normalMap) m.material.normalMap.repeat.set(d.tileX || 1, d.tileY || 1);
            if (m.material.roughnessMap) m.material.roughnessMap.repeat.set(d.tileX || 1, d.tileY || 1);
            if (m.material.metalnessMap) m.material.metalnessMap.repeat.set(d.tileX || 1, d.tileY || 1);
          }
        });
        sendSelectedObject(_utTarget);
        break;
      }
      case "game-editor-request-tree":
        sendSceneTree();
        break;
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
              var _ugCount = 0;
              for (var _i = 0; _i < editor.scene.children.length; _i++) {
                var _ch = editor.scene.children[_i];
                if (_ch === child) break;
                if (!_ch.name && _ch.type === "Group" && _ch.children && _ch.children.length > 0) _ugCount++;
              }
              child.name = "UnnamedGroup_" + _ugCount;
            }
          }
          if (!child.name) return;
          if (child.name.indexOf("__editor_") === 0) return;
          if (child.type === "GridHelper") return;
          // Skip ground planes (large unnamed PlaneGeometry)
          if (child.isMesh && !child.name && child.geometry && child.geometry.type === "PlaneGeometry") {
            var gp = child.geometry.parameters;
            if (gp && (gp.width >= 50 || gp.height >= 50)) return;
          }
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
})();
`;
}
