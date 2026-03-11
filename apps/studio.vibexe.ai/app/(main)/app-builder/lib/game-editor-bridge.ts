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
  var _gizmoProxy = null;  // Proxy Object3D for centering gizmo on animated characters
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
        // Skip editor helpers (BoxHelper, TransformControls, GridHelper, gizmo proxy, light helpers)
        if (child === boxHelper) continue;
        if (child === transformControls) continue;
        if (child === _gizmoProxy) continue;
        if (child.type === "BoxHelper" || child.type === "TransformControlsGizmo" || child.type === "TransformControlsPlane") continue;
        if (child.isTransformControls) continue;
        if (child.userData && child.userData.__isLightHelper) continue;
        if (child.type === "SpotLightHelper") continue;
        // Skip spot light targets (they show up as empty Object3D children)
        if (child.parent && child.parent.isSpotLight) continue;
        // Skip particles, trails, and Points objects (VFX internals)
        if (child.type === "Points") continue;
        if (child.name && (child.name.indexOf("__particle_") === 0 || child.name.indexOf("__trail_") === 0)) continue;
        // Skip stale character meshes - only keep the active player mesh
        if (child.name && child.name.indexOf("Character_") === 0) {
          var activePlayer = window.__vibexe_playerMesh__;
          if (activePlayer && child !== activePlayer && child.uuid !== activePlayer.uuid) {
            var isAncestor = false;
            var p = activePlayer.parent;
            while (p) {
              if (p === child) { isAncestor = true; break; }
              p = p.parent;
            }
            if (!isAncestor) continue;
          }
        }
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
    var msg = {
      type: "game-editor-object-selected",
      uuid: obj.uuid,
      name: obj.name || obj.type,
      objType: obj.userData?.vibexeType || obj.type,
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
    };
    // Include light-specific properties when selecting a light
    if (obj.isLight && obj.userData.__editorLight) {
      msg._isEditorLight = true;
      msg._lightType = obj.userData.__lightType;
      msg._lightColor = obj.userData.__lightColor || "#ffffff";
      msg._lightIntensity = obj.userData.__lightIntensity || 1;
      msg._lightDistance = obj.userData.__lightDistance || 20;
      msg._lightDecay = obj.userData.__lightDecay || 2;
      if (obj.isSpotLight) {
        msg._lightAngle = obj.userData.__lightAngle || 0.5;
        msg._lightPenumbra = obj.userData.__lightPenumbra || 0.5;
        msg._lightTarget = obj.userData.__lightTarget || { x: 0, y: 0, z: 0 };
      }
    }
    window.parent.postMessage(msg, "*");
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
      // For animated characters, place gizmo at visual center (not feet)
      var _isAnimChar = obj.userData && obj.userData.vibexeType === "AnimatedCharacter" && obj.userData.__characterBounds;
      var _charYOffset = _isAnimChar ? obj.userData.__characterBounds.height / 2 : 0;

      if (_isAnimChar) {
        // Create a proxy Object3D at the character's visual center
        _gizmoProxy = new THREE.Object3D();
        _gizmoProxy.name = "__editor_gizmo_proxy__";
        _gizmoProxy.position.copy(obj.position);
        _gizmoProxy.position.y += _charYOffset;
        _gizmoProxy.rotation.copy(obj.rotation);
        _gizmoProxy.scale.copy(obj.scale);
        editor.scene.add(_gizmoProxy);
        transformControls.attach(_gizmoProxy);
      } else {
        transformControls.attach(obj);
      }

      // Disable orbit when dragging gizmo
      transformControls.addEventListener("dragging-changed", function(e) {
        if (editor.orbitControls) {
          editor.orbitControls.enabled = !e.value;
        }
      });

      // Send transform updates while dragging
      transformControls.addEventListener("objectChange", function() {
        if (selectedObj) {
          // Sync proxy back to the real object for animated characters
          if (_gizmoProxy && _isAnimChar) {
            selectedObj.position.x = _gizmoProxy.position.x;
            selectedObj.position.y = _gizmoProxy.position.y - _charYOffset;
            selectedObj.position.z = _gizmoProxy.position.z;
            selectedObj.rotation.copy(_gizmoProxy.rotation);
            selectedObj.scale.copy(_gizmoProxy.scale);
          }
          sendSelectedObject(selectedObj);
          if (boxHelper) boxHelper.update();
          // Sync light helper position when light is dragged
          if (selectedObj.isLight && selectedObj.userData.__editorLight) {
            var _tcHelper = editor.scene.getObjectByName("__editor_light_helper_" + selectedObj.name);
            if (_tcHelper) _tcHelper.position.copy(selectedObj.position);
            // Update spot helper cone
            if (selectedObj.isSpotLight) {
              var _tcSpotHelper = editor.scene.getObjectByName("__editor_spot_helper_" + selectedObj.name);
              if (_tcSpotHelper && _tcSpotHelper.update) _tcSpotHelper.update();
            }
          }
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
    if (_gizmoProxy) {
      editor.scene.remove(_gizmoProxy);
      _gizmoProxy = null;
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

    // Get all meshes from scene (exclude editor helpers, but INCLUDE light helpers)
    var meshes = [];
    editor.scene.traverse(function(child) {
      if (child.isMesh && child !== boxHelper &&
          child.type !== "TransformControlsGizmo" &&
          child.type !== "TransformControlsPlane") {
        // Skip non-light editor helpers
        if (child.name.indexOf("__editor_") === 0 && !child.userData.__isLightHelper) return;
        // Skip terrain/weather/sky — non-selectable infrastructure meshes
        if (child.name === "__terrain__" || child.name === "__weather__" || child.name === "__sky__") return;
        meshes.push(child);
      }
    });

    var intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      var hit = intersects[0].object;
      // If we hit a light helper, select the actual light object
      if (hit.userData && hit.userData.__lightHelperFor) {
        var _lhLight = editor.scene.getObjectByName(hit.userData.__lightHelperFor);
        if (_lhLight) {
          selectObject(_lhLight);
          return;
        }
      }
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
    try {
      if (editor.orbitControls) editor.orbitControls.update();
      if (boxHelper && selectedObj) boxHelper.update();
      editor.renderer.render(editor.scene, editor.camera);
    } catch(e) {
      console.warn("[GameEditorBridge] editorLoop error (likely disposal race):", e.message);
    }
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

      // Reset character controller orbit yaw/pitch — prevents disorienting camera angle on return to game
      window.__charCtrl_orbitYaw = 0;
      window.__charCtrl_orbitPitch = 0.4; // Reset to default pitch
      // Signal charSystem that camera was moved externally (editor) — resets SmoothDamp velocities on resume
      window.__charCtrl_camActive = false;
      // Trigger blur to clear any stuck keys in charSystem input handlers
      try { window.dispatchEvent(new Event("blur")); } catch(e) {}

      // Attach listeners
      editor.renderer.domElement.addEventListener("click", onCanvasClick);
      window.addEventListener("keydown", onKeyDown, true);

      // Re-create light helper visuals for existing editor lights
      if (THREE && editor.scene) {
        editor.scene.traverse(function(child) {
          if (!child.isLight || !child.userData || !child.userData.__editorLight) return;
          // Check if helper already exists
          if (editor.scene.getObjectByName("__editor_light_helper_" + child.name)) return;
          var _actType = child.userData.__lightType || "point";
          var _actGeo = new THREE.SphereGeometry(0.3, 8, 8);
          var _actMat = new THREE.MeshBasicMaterial({
            color: _actType === "spot" ? 0xffaa00 : 0xffff00,
            wireframe: true,
            depthTest: false,
            transparent: true,
            opacity: 0.7
          });
          var _actHelper = new THREE.Mesh(_actGeo, _actMat);
          _actHelper.name = "__editor_light_helper_" + child.name;
          _actHelper.position.copy(child.position);
          _actHelper.userData.__lightHelperFor = child.name;
          _actHelper.userData.__isLightHelper = true;
          _actHelper.renderOrder = 999;
          editor.scene.add(_actHelper);
          if (child.isSpotLight) {
            var _actSpotHelper = new THREE.SpotLightHelper(child);
            _actSpotHelper.name = "__editor_spot_helper_" + child.name;
            _actSpotHelper.userData.__lightHelperFor = child.name;
            _actSpotHelper.userData.__isLightHelper = true;
            editor.scene.add(_actSpotHelper);
          }
        });
      }

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

    // Remove light helper visuals (editor-only) but keep the actual lights
    if (editor && editor.scene) {
      var _deactHelpers = [];
      editor.scene.traverse(function(child) {
        if (child.userData && child.userData.__isLightHelper) _deactHelpers.push(child);
        if (child.type === "SpotLightHelper") _deactHelpers.push(child);
      });
      for (var _dhi = 0; _dhi < _deactHelpers.length; _dhi++) {
        editor.scene.remove(_deactHelpers[_dhi]);
        if (_deactHelpers[_dhi].dispose) _deactHelpers[_dhi].dispose();
      }
    }

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
      // Light-specific properties
      case "intensity":
        if (obj.isLight) { obj.intensity = Number(value); obj.userData.__lightIntensity = Number(value); }
        break;
      case "color":
        if (obj.isLight) { obj.color.set(value); obj.userData.__lightColor = String(value); }
        break;
      case "distance":
        if (obj.isLight) { obj.distance = Number(value); obj.userData.__lightDistance = Number(value); }
        break;
      case "decay":
        if (obj.isLight) { obj.decay = Number(value); obj.userData.__lightDecay = Number(value); }
        break;
      case "angle":
        if (obj.isSpotLight) { obj.angle = Number(value); obj.userData.__lightAngle = Number(value); }
        break;
      case "penumbra":
        if (obj.isSpotLight) { obj.penumbra = Number(value); obj.userData.__lightPenumbra = Number(value); }
        break;
    }

    // Sync light helper position when position changes via property panel
    if (obj.isLight && obj.userData.__editorLight && (property === "position.x" || property === "position.y" || property === "position.z")) {
      var _upHelper = editor.scene.getObjectByName("__editor_light_helper_" + obj.name);
      if (_upHelper) _upHelper.position.copy(obj.position);
      if (obj.isSpotLight) {
        var _upSpotHelper = editor.scene.getObjectByName("__editor_spot_helper_" + obj.name);
        if (_upSpotHelper && _upSpotHelper.update) _upSpotHelper.update();
      }
    }

    if (boxHelper && selectedObj && selectedObj.uuid === uuid) {
      boxHelper.update();
    }
    sendSelectedObject(obj);
    sendSceneTree();
  }

  // ===== PostMessage Handler =====
  function _onBridgeMessage(e) {
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
        if (transformControls && d.mode && d.mode !== "pan") {
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
            // Clean up light helpers if deleting a light
            if (toDelete.isLight && toDelete.userData && toDelete.userData.__editorLight) {
              var _delName = toDelete.name;
              if (toDelete.isSpotLight && toDelete.target) editor.scene.remove(toDelete.target);
              var _delHelper = editor.scene.getObjectByName("__editor_light_helper_" + _delName);
              if (_delHelper) editor.scene.remove(_delHelper);
              var _delSpotHelper = editor.scene.getObjectByName("__editor_spot_helper_" + _delName);
              if (_delSpotHelper) editor.scene.remove(_delSpotHelper);
            }
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
            if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
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
                _atTarget.traverse(function(m) { if (m.isMesh && m.material && !Array.isArray(m.material)) { applier(m.material, t); m.material.needsUpdate = true; } });
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
          if (m.isMesh && m.material && !Array.isArray(m.material)) {
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
          if (m.isMesh && m.material && !Array.isArray(m.material) && m.material.map) {
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
          if (m.isMesh && m.material && !Array.isArray(m.material) && m.material.map) {
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
      case "game-editor-add-light": {
        if (!editor || !editor.scene) break;
        var THREE = window.THREE;
        if (!THREE) break;
        var _alType = d.lightType || "point";
        var _alColor = new THREE.Color(d.color || "#ffffff");
        var _alIntensity = d.intensity != null ? d.intensity : 1.0;
        var _alPos = d.position || { x: 0, y: 5, z: 0 };
        var _alDistance = d.distance != null ? d.distance : 20;
        var _alDecay = d.decay != null ? d.decay : 2;
        // Count existing lights of this type to generate unique name
        var _alCount = 0;
        editor.scene.traverse(function(c) {
          if (c.name && c.name.indexOf("Light_" + _alType + "_") === 0) _alCount++;
        });
        var _alName = "Light_" + _alType + "_" + _alCount;
        var _alLight;
        if (_alType === "spot") {
          var _alAngle = d.angle != null ? d.angle : 0.5;
          var _alPenumbra = d.penumbra != null ? d.penumbra : 0.5;
          _alLight = new THREE.SpotLight(_alColor, _alIntensity, _alDistance, _alAngle, _alPenumbra, _alDecay);
          // Set target position
          if (d.target) {
            _alLight.target.position.set(d.target.x || 0, d.target.y || 0, d.target.z || 0);
          }
          editor.scene.add(_alLight.target);
        } else {
          _alLight = new THREE.PointLight(_alColor, _alIntensity, _alDistance, _alDecay);
        }
        _alLight.name = _alName;
        _alLight.position.set(_alPos.x, _alPos.y, _alPos.z);
        _alLight.castShadow = true;
        _alLight.shadow.mapSize.width = 512;
        _alLight.shadow.mapSize.height = 512;
        // Store light metadata for persistence
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
        // Add visual helper (small sphere so user can see and click on it)
        var _alHelperGeo = new THREE.SphereGeometry(0.3, 8, 8);
        var _alHelperMat = new THREE.MeshBasicMaterial({
          color: _alType === "spot" ? 0xffaa00 : 0xffff00,
          wireframe: true,
          depthTest: false,
          transparent: true,
          opacity: 0.7
        });
        var _alHelper = new THREE.Mesh(_alHelperGeo, _alHelperMat);
        _alHelper.name = "__editor_light_helper_" + _alName;
        _alHelper.position.copy(_alLight.position);
        _alHelper.userData.__lightHelperFor = _alName;
        _alHelper.userData.__isLightHelper = true;
        _alHelper.renderOrder = 999;
        editor.scene.add(_alHelper);
        // For spot lights, add a cone helper line
        if (_alType === "spot") {
          var _alSpotHelper = new THREE.SpotLightHelper(_alLight);
          _alSpotHelper.name = "__editor_spot_helper_" + _alName;
          _alSpotHelper.userData.__lightHelperFor = _alName;
          _alSpotHelper.userData.__isLightHelper = true;
          editor.scene.add(_alSpotHelper);
        }
        console.log("[GameEditorBridge] Added light:", _alName, "type:", _alType);
        sendSceneTree();
        // Select the new light
        selectObject(_alLight);
        // Notify parent
        window.parent.postMessage({
          type: "game-editor-light-added",
          name: _alName,
          lightType: _alType,
          color: d.color || "#ffffff",
          intensity: _alIntensity,
          position: _alPos,
          distance: _alDistance,
          decay: _alDecay,
          angle: _alType === "spot" ? (d.angle != null ? d.angle : 0.5) : undefined,
          penumbra: _alType === "spot" ? (d.penumbra != null ? d.penumbra : 0.5) : undefined,
          target: _alType === "spot" ? (d.target || { x: _alPos.x, y: 0, z: _alPos.z }) : undefined,
        }, "*");
        break;
      }
      case "game-editor-update-light": {
        if (!editor || !editor.scene || !d.name) break;
        var THREE = window.THREE;
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
          // Update helper position
          var _ulHelper = editor.scene.getObjectByName("__editor_light_helper_" + d.name);
          if (_ulHelper) _ulHelper.position.copy(_ulLight.position);
        }
        if (_ulLight.isSpotLight) {
          if (d.angle !== undefined) {
            _ulLight.angle = Number(d.angle);
            _ulLight.userData.__lightAngle = Number(d.angle);
          }
          if (d.penumbra !== undefined) {
            _ulLight.penumbra = Number(d.penumbra);
            _ulLight.userData.__lightPenumbra = Number(d.penumbra);
          }
          if (d.target) {
            _ulLight.target.position.set(d.target.x, d.target.y, d.target.z);
            _ulLight.userData.__lightTarget = d.target;
          }
          // Update spot helper
          var _ulSpotHelper = editor.scene.getObjectByName("__editor_spot_helper_" + d.name);
          if (_ulSpotHelper && _ulSpotHelper.update) _ulSpotHelper.update();
        }
        console.log("[GameEditorBridge] Updated light:", d.name);
        if (selectedObj && selectedObj === _ulLight) sendSelectedObject(_ulLight);
        sendSceneTree();
        break;
      }
      case "game-editor-remove-light": {
        if (!editor || !editor.scene || !d.name) break;
        var _rlLight = editor.scene.getObjectByName(d.name);
        if (_rlLight) {
          if (selectedObj && selectedObj === _rlLight) deselectObject();
          // Remove spot target
          if (_rlLight.isSpotLight && _rlLight.target) {
            editor.scene.remove(_rlLight.target);
          }
          editor.scene.remove(_rlLight);
        }
        // Remove helpers
        var _rlHelper = editor.scene.getObjectByName("__editor_light_helper_" + d.name);
        if (_rlHelper) editor.scene.remove(_rlHelper);
        var _rlSpotHelper = editor.scene.getObjectByName("__editor_spot_helper_" + d.name);
        if (_rlSpotHelper) editor.scene.remove(_rlSpotHelper);
        console.log("[GameEditorBridge] Removed light:", d.name);
        sendSceneTree();
        window.parent.postMessage({ type: "game-editor-light-removed", name: d.name }, "*");
        break;
      }
      case "game-editor-collect-lights": {
        // Collect all editor-created lights for persistence
        if (!editor || !editor.scene) break;
        var _clLights = [];
        editor.scene.traverse(function(child) {
          if (!child.isLight || !child.userData || !child.userData.__editorLight) return;
          var _clData = {
            name: child.name,
            type: child.userData.__lightType,
            color: child.userData.__lightColor || "#ffffff",
            intensity: child.userData.__lightIntensity || 1,
            position: { x: +child.position.x.toFixed(3), y: +child.position.y.toFixed(3), z: +child.position.z.toFixed(3) },
            distance: child.userData.__lightDistance || 20,
            decay: child.userData.__lightDecay || 2,
          };
          if (child.isSpotLight) {
            _clData.angle = child.userData.__lightAngle || 0.5;
            _clData.penumbra = child.userData.__lightPenumbra || 0.5;
            _clData.target = child.userData.__lightTarget || { x: child.position.x, y: 0, z: child.position.z };
          }
          _clLights.push(_clData);
        });
        console.log("[GameEditorBridge] Collected", _clLights.length, "editor lights");
        window.parent.postMessage({ type: "game-editor-lights-collected", lights: _clLights }, "*");
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
  }
  window.addEventListener("message", _onBridgeMessage);
})();
`;
}
