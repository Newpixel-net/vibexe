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
      _materialColor: matColor
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

      editor.scene.add(transformControls);
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
      editor.scene.remove(transformControls);
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
      case "game-editor-request-tree":
        sendSceneTree();
        break;
    }
  });
})();
`;
}
