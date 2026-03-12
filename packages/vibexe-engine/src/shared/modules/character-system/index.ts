/**
 * Character System Module — Pure GLB Loader & Model Swapper
 *
 * Loads player character GLB models with production-quality processing
 * and swaps the visible mesh. Does NOT manage physics, camera, keyboard
 * input, or animation state — the game template owns all of those.
 *
 * Features:
 * - Character registry (built-in + extensible)
 * - Production-quality GLTFLoader (bone measurement, pivot correction, scale cap)
 * - Scored animation matching with alias fallbacks
 * - Root motion stripping (locks XZ on root bones, keeps Y hip-bob)
 * - Scene hierarchy integration (Character_ prefix, userData)
 * - Mesh swap with old mesh disposal and stale mesh cleanup
 */

import type { ModuleManifest } from "../module-types";

/**
 * Built-in character registry.
 * Format: { id, name, pack, model, animations, groundOffset, thumbnail }
 */
const BUILT_IN_CHARACTERS = JSON.stringify([
	{
		id: "warrior",
		name: "Warrior",
		pack: "meshy-characters",
		model: "Warrior_figure_Animations.glb",
		thumbnail: "",
		groundOffset: 0,
		animations: {
			idle: "idle",
			walk: "walk",
			run: "run",
			jump: "jump",
			attack: "kick",
			die: "dead",
			hit: "hit",
			special: "spin",
		},
	},
]);

const runtimeCode = `// @vibexe/character-system v6.0.0
// Blink-style top-down WASD controller + camera-relative movement + orbit camera
console.log('[CharacterSystem] Module v6.0.0 loaded');

var THREE = require('three');

// ===== CONSTANTS =====
var TARGET_HEIGHT = 1.5;     // World units — matches SCALES_3D.animatedCharacter
var MAX_AUTO_SCALE = 1;      // Cap to prevent over-scaling skinned meshes

// Root bone names for root motion stripping
var _ROOT_BONE_NAMES = {
  "hips": true, "root": true, "mixamorig:hips": true, "mixamorigHips": true,
  "mixamorig_hips": true, "pelvis": true, "rootnode": true, "root_bone": true,
  "bip001": true, "bip01": true, "hip": true
};

// ===== INPUT STATE (Module-level, shared by all controllers) =====
// Keyboard input tracking — camera-relative WASD movement (Blink-style)
var _inputState = { w: false, a: false, s: false, d: false, shift: false, space: false };
var _mouseState = { midDown: false, lastX: 0, lastY: 0, scrollDelta: 0 };
var _inputListenersAttached = false;
var _activeSnapTimer = null;

function _attachInputListeners() {
  if (_inputListenersAttached) return;
  _inputListenersAttached = true;

  // Find the iframe's document (we're running inside the iframe)
  var doc = typeof document !== "undefined" ? document : null;
  if (!doc) return;

  doc.addEventListener("keydown", function(e) {
    if ((window.__vibexe_editor__ || {}).isEditing) return;
    var k = e.key.toLowerCase();
    if (k === "w" || k === "arrowup") _inputState.w = true;
    if (k === "a" || k === "arrowleft") _inputState.a = true;
    if (k === "s" || k === "arrowdown") _inputState.s = true;
    if (k === "d" || k === "arrowright") _inputState.d = true;
    if (k === "shift") _inputState.shift = true;
    if (k === " ") _inputState.space = true;
  });

  doc.addEventListener("keyup", function(e) {
    var k = e.key.toLowerCase();
    if (k === "w" || k === "arrowup") _inputState.w = false;
    if (k === "a" || k === "arrowleft") _inputState.a = false;
    if (k === "s" || k === "arrowdown") _inputState.s = false;
    if (k === "d" || k === "arrowright") _inputState.d = false;
    if (k === "shift") _inputState.shift = false;
    if (k === " ") _inputState.space = false;
  });

  // Clear all keys on blur (prevents stuck keys when tabbing away)
  window.addEventListener("blur", function() {
    _inputState.w = _inputState.a = _inputState.s = _inputState.d = false;
    _inputState.shift = _inputState.space = false;
    _mouseState.midDown = false;
  });

  // Mouse: middle button for orbit, scroll for zoom
  doc.addEventListener("mousedown", function(e) {
    if ((window.__vibexe_editor__ || {}).isEditing) return;
    if (e.button === 1) { // middle mouse
      _mouseState.midDown = true;
      _mouseState.lastX = e.clientX;
      _mouseState.lastY = e.clientY;
      e.preventDefault();
    }
  });

  doc.addEventListener("mouseup", function(e) {
    if (e.button === 1) _mouseState.midDown = false;
  });

  doc.addEventListener("mousemove", function(e) {
    if ((window.__vibexe_editor__ || {}).isEditing) return;
    if (_mouseState.midDown) {
      var dx = e.clientX - _mouseState.lastX;
      var dy = e.clientY - _mouseState.lastY;
      _mouseState.lastX = e.clientX;
      _mouseState.lastY = e.clientY;
      // Accumulate yaw rotation from mouse drag
      if (window.__charCtrl_orbitYaw !== undefined) {
        window.__charCtrl_orbitYaw += dx * 0.005; // radians per pixel
      }
      // Accumulate pitch from vertical mouse drag
      if (window.__charCtrl_orbitPitch !== undefined) {
        window.__charCtrl_orbitPitch -= dy * 0.005;
        // Clamp pitch: 0.05 (nearly horizontal) to 1.2 (~70 degrees looking down)
        window.__charCtrl_orbitPitch = Math.max(0.05, Math.min(1.2, window.__charCtrl_orbitPitch));
      }
    }
  });

  doc.addEventListener("wheel", function(e) {
    if ((window.__vibexe_editor__ || {}).isEditing) return;
    // Accumulate scroll for zoom (consumed each frame)
    _mouseState.scrollDelta += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  console.log("[CharacterSystem] Input listeners attached (WASD + mouse orbit/zoom)");
}

// ===== SMOOTH DAMP ANGLE (Unity's SmoothDampAngle port) =====
// Critically-damped spring for angle interpolation — eliminates wrapping artifacts
// Returns { value, velocity }
function _smoothDampAngle(current, target, currentVelocity, smoothTime, dt) {
  // Normalize delta to [-PI, PI]
  var delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  target = current + delta;

  // Critically-damped spring (same as Unity's Mathf.SmoothDamp)
  smoothTime = Math.max(0.0001, smoothTime);
  var omega = 2.0 / smoothTime;
  var x = omega * dt;
  var exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
  var change = current - target;
  var temp = (currentVelocity + omega * change) * dt;
  var newVel = (currentVelocity - omega * temp) * exp;
  var result = target + (change + temp) * exp;

  // Prevent overshooting
  if ((target - current > 0) === (result > target)) {
    result = target;
    newVel = 0;
  }

  return { value: result, velocity: newVel };
}

// ===== SMOOTH DAMP (Vector component — Unity's Vector3.SmoothDamp per axis) =====
function _smoothDamp(current, target, currentVelocity, smoothTime, dt) {
  smoothTime = Math.max(0.0001, smoothTime);
  var omega = 2.0 / smoothTime;
  var x = omega * dt;
  var exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
  var change = current - target;
  var temp = (currentVelocity + omega * change) * dt;
  var newVel = (currentVelocity - omega * temp) * exp;
  var result = target + (change + temp) * exp;
  if ((target - current > 0) === (result > target)) {
    result = target;
    newVel = 0;
  }
  return { value: result, velocity: newVel };
}

// ===== CHARACTER REGISTRY =====
var BUILTIN_CHARACTERS = ${BUILT_IN_CHARACTERS};

var _registry = null;

function CharacterRegistry() {
  this._characters = {};
}

CharacterRegistry.prototype.register = function(charDef) {
  if (!charDef || !charDef.id) return;
  this._characters[charDef.id] = charDef;
};

CharacterRegistry.prototype.get = function(id) {
  return this._characters[id] || null;
};

CharacterRegistry.prototype.getAll = function() {
  var result = [];
  for (var k in this._characters) {
    if (this._characters.hasOwnProperty(k)) result.push(this._characters[k]);
  }
  return result;
};

CharacterRegistry.prototype.getDefault = function() {
  return this._characters["warrior"] || this.getAll()[0] || null;
};

// ===== SCORED ANIMATION MATCHING =====
// Priority: 3=starts with keyword, 2=word boundary, 1=anywhere. Shortest name wins ties.
function _bestPartial(keyword, clipNames, clipMap) {
  var best = null;
  var bestPri = 0;
  var bestLen = Infinity;
  for (var i = 0; i < clipNames.length; i++) {
    var cn = clipNames[i];
    var cl = cn.toLowerCase();
    if (cl.indexOf(keyword) === -1) continue;
    var pri;
    if (cl.indexOf(keyword) === 0) {
      pri = 3;
    } else if (cl.indexOf("_" + keyword) !== -1 || cl.indexOf(" " + keyword) !== -1) {
      pri = 2;
    } else {
      pri = 1;
    }
    if (pri > bestPri || (pri === bestPri && cn.length < bestLen)) {
      best = cn; bestPri = pri; bestLen = cn.length;
    }
  }
  return best ? clipMap[best] : null;
}

function findClip(name, clipNames, clipMap) {
  // 1. Exact match
  if (clipMap[name]) return clipMap[name];
  // 2. Case-insensitive exact
  var lower = name.toLowerCase();
  for (var i = 0; i < clipNames.length; i++) {
    if (clipNames[i].toLowerCase() === lower) return clipMap[clipNames[i]];
  }
  // 3. Scored partial match
  var partial = _bestPartial(lower, clipNames, clipMap);
  if (partial) return partial;
  // 4. Common aliases
  var aliases = {
    idle: ["idle"],
    run: ["running", "run"],
    walk: ["walking", "walk"],
    jump: ["jump", "leap"],
    attack: ["slash", "attack", "kick", "hook", "punch", "spin"],
    die: ["dead", "death", "die"],
    hit: ["hit", "reaction", "damage"]
  };
  var aliasKeys = aliases[lower];
  if (aliasKeys) {
    for (var a = 0; a < aliasKeys.length; a++) {
      var m = _bestPartial(aliasKeys[a], clipNames, clipMap);
      if (m) return m;
    }
  }
  return null;
}

// ===== PRODUCTION CHARACTER LOADER =====
// Matches createAnimatedCharacter3D quality: bone measurement, pivot, scale cap, root motion
function loadCharacterGLB(scene, url, position, charName, modelFileName) {
  var GLTFLoader = THREE.GLTFLoader;
  if (!GLTFLoader) {
    console.error("[CharacterSystem] GLTFLoader not available on THREE");
    return Promise.resolve(null);
  }

  var loader = new GLTFLoader();
  return new Promise(function(resolve, reject) {
    console.log("[CharacterSystem] Loading GLB:", url);
    loader.load(url, function(gltf) {
      var inner = gltf.scene;

      // Fix materials for proper lighting + disable frustum culling on skinned meshes
      // Use DetachedBindMode so parent Group transform actually moves the visible mesh
      inner.traverse(function(child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
        if (child.isSkinnedMesh) {
          child.frustumCulled = false;
          // AttachedBindMode = bindMatrixInverse auto-updates to inv(meshWorldMatrix) each frame.
          // This eliminates the double-offset problem: moving the Group moves the render 1:1
          // because mesh.matrixWorld cancels out in the bone transform chain.
          // Three.js r172 uses string constants: "attached" or "detached"
          child.bindMode = "attached";
        }
      });

      // --- Auto-upright detection ---
      var rawBox = new THREE.Box3().setFromObject(inner);
      var rawSize = new THREE.Vector3();
      rawBox.getSize(rawSize);
      console.log("[CharacterSystem] Raw model size:", rawSize.x.toFixed(2), rawSize.y.toFixed(2), rawSize.z.toFixed(2));

      var maxHoriz = Math.max(rawSize.x, rawSize.z);
      if (rawSize.y < maxHoriz * 0.5) {
        inner.rotation.x = -Math.PI / 2;
        console.log("[CharacterSystem] Auto-upright: rotated -90 on X (Z-up model)");
      }

      // --- Unity Root bone fix detection ---
      var needsUnityRootFix = false;
      if (inner.rotation.x === 0) {
        var unityRootBone = null;
        inner.traverse(function(child) {
          if (child.isBone && !unityRootBone && child.name.toLowerCase() === "root") {
            unityRootBone = child;
          }
        });
        if (unityRootBone) {
          var qz = Math.abs(unityRootBone.quaternion.z);
          var qw = Math.abs(unityRootBone.quaternion.w);
          if (qz > 0.95 && qw < 0.1) {
            needsUnityRootFix = true;
            console.log("[CharacterSystem] Unity Root bone fix detected");
          }
        }
      }

      // --- Measure ACTUAL rendered size using boneTransform (SkinnedMesh) ---
      // Box3.setFromObject only measures bind-pose geometry (can be 0.02 units for a
      // model whose bones expand it to 2+ units at render time)
      inner.updateMatrixWorld(true);
      var measuredHeight = 0;
      var measuredMinY = Infinity;
      var usedBoneTransform = false;

      // Play first animation frame so bones are in a real pose for measurement
      var tempClips = gltf.animations || [];
      if (tempClips.length > 0) {
        var tempMixer = new THREE.AnimationMixer(inner);
        tempMixer.clipAction(tempClips[0]).play();
        tempMixer.update(0);
        tempMixer.stopAllAction();
      }

      // After measurement is done below, we will reset bones to bind pose.
      // This is critical: hierarchy changes (pivot, scale, position) happen after
      // measurement, and boneInverses must be recalculated with bones in bind pose.

      inner.traverse(function(child) {
        if (usedBoneTransform) return;
        if (child.isSkinnedMesh && child.skeleton && typeof child.boneTransform === "function") {
          try {
            child.skeleton.update();
            var posCount = child.geometry.attributes.position.count;
            var step = Math.max(1, Math.floor(posCount / 200));
            var v4 = new THREE.Vector4();
            var minY = Infinity, maxY = -Infinity;
            var minX = Infinity, maxX = -Infinity;
            var minZ = Infinity, maxZ = -Infinity;
            for (var i = 0; i < posCount; i += step) {
              child.boneTransform(i, v4);
              if (v4.y < minY) minY = v4.y;
              if (v4.y > maxY) maxY = v4.y;
              if (v4.x < minX) minX = v4.x;
              if (v4.x > maxX) maxX = v4.x;
              if (v4.z < minZ) minZ = v4.z;
              if (v4.z > maxZ) maxZ = v4.z;
            }
            var boneH = maxY - minY;
            if (boneH > 0.001) {
              measuredHeight = boneH;
              measuredMinY = minY;
              usedBoneTransform = true;
              console.log("[CharacterSystem] Bone-deformed size:", (maxX-minX).toFixed(3), boneH.toFixed(3), (maxZ-minZ).toFixed(3));
            }
          } catch (e) { /* boneTransform not available */ }
        }
      });

      // Fallback: use geometry bounding box (for non-skinned models)
      if (!usedBoneTransform) {
        var corrBox = new THREE.Box3().setFromObject(inner);
        var corrSize = new THREE.Vector3();
        corrBox.getSize(corrSize);
        measuredHeight = corrSize.y || 1;
        measuredMinY = corrBox.min.y;
        console.log("[CharacterSystem] Geometry size (no bones):", corrSize.x.toFixed(3), corrSize.y.toFixed(3), corrSize.z.toFixed(3));
      }

      // --- Reset bones to bind pose after measurement ---
      // tempMixer.update(0) moved bones out of bind pose for measurement.
      // We must reset them BEFORE hierarchy changes (pivot, scale, position)
      // so that calculateInverses() later captures the correct bind-pose transforms.
      inner.traverse(function(child) {
        if (child.isSkinnedMesh && child.skeleton) {
          child.skeleton.pose();
        }
      });

      // --- Auto-scale with cap ---
      var rawAutoScale = TARGET_HEIGHT / measuredHeight;
      var autoScale = Math.min(rawAutoScale, MAX_AUTO_SCALE);
      inner.scale.setScalar(autoScale);
      if (rawAutoScale > MAX_AUTO_SCALE) {
        console.log("[CharacterSystem] Auto-scale CAPPED:", autoScale.toFixed(3), "(raw was " + rawAutoScale.toFixed(1) + ")");
      } else {
        console.log("[CharacterSystem] Auto-scale:", autoScale.toFixed(3));
      }

      // --- Pivot correction AFTER scaling ---
      // Re-measure bounding box after rotation + scale for accurate foot position
      inner.updateMatrixWorld(true);
      var pivotBox = new THREE.Box3().setFromObject(inner);
      var pivotCenter = new THREE.Vector3();
      pivotBox.getCenter(pivotCenter);
      var pivot = new THREE.Group();
      pivot.add(inner);
      // Use post-transform bounding box min.y for feet, center for XZ
      pivot.position.set(-pivotCenter.x, -pivotBox.min.y, -pivotCenter.z);

      // --- Apply deferred Unity Root bone fix ---
      if (needsUnityRootFix) {
        inner.rotation.x = -Math.PI / 2;
        inner.updateMatrixWorld(true);
        pivot.updateMatrixWorld(true);
        // Find lowest foot bone for grounding
        var footNames = { "foot_l": true, "foot_r": true, "toes_l": true, "toes_r": true, "leftfoot": true, "rightfoot": true, "lefttoebase": true, "righttoebase": true };
        var lowestFootY = Infinity;
        var wp = new THREE.Vector3();
        inner.traverse(function(child) {
          if (child.isBone && footNames[child.name.toLowerCase()]) {
            child.getWorldPosition(wp);
            if (wp.y < lowestFootY) lowestFootY = wp.y;
          }
        });
        if (lowestFootY !== Infinity) {
          var feetOffset = lowestFootY;
          if (Math.abs(feetOffset) > 0.01) {
            pivot.position.y -= feetOffset;
          }
        }
        var soleRaise = TARGET_HEIGHT * 0.07;
        pivot.position.y += soleRaise;
        console.log("[CharacterSystem] Unity Root bone fix applied");
      }

      // --- Wrapper Group: world position, scale 1 ---
      var mesh = new THREE.Group();
      var meshName = "Character_" + (charName || "Unknown");
      mesh.name = meshName;
      // Extract model ID from filename (strip .glb extension) for animation overrides API
      var cleanModelId = modelFileName ? modelFileName.replace(/\\.glb$/i, "") : charName;
      mesh.userData = {
        vibexeType: "AnimatedCharacter",
        vibexeFactory: "createAnimatedCharacter3D",
        __isPlayerCharacter: true,
        __characterModel: cleanModelId,
        __characterId: charName
      };
      mesh.add(pivot);
      mesh.position.set(position.x, position.y, position.z);

      // Store pivot offset for editor gizmo correction
      mesh.userData.__pivotOffset = { x: pivot.position.x, y: pivot.position.y, z: pivot.position.z };

      // Physics half-extents based on target height
      var halfExtents = { x: TARGET_HEIGHT * 0.3, y: TARGET_HEIGHT / 2, z: TARGET_HEIGHT * 0.3 };

      // Store character bounds for editor BoxHelper override
      mesh.userData.__characterBounds = {
        halfX: halfExtents.x,
        halfZ: halfExtents.z,
        height: TARGET_HEIGHT
      };

      // --- Recalculate skeleton for new hierarchy ---
      // At this point the full hierarchy is: mesh → pivot → inner (with SkinnedMeshes)
      // The bones are in bind pose (reset via skeleton.pose() earlier).
      // We recalculate boneInverses to match the CURRENT world transforms (after
      // pivot correction, auto-scale, and spawn position), then re-bind so that
      // bindMatrix = current matrixWorld. This ensures the shader starts at zero
      // delta (boneMatrix * bindMatrix in bind pose = identity transform).
      mesh.updateMatrixWorld(true);
      inner.traverse(function(child) {
        if (child.isSkinnedMesh && child.skeleton) {
          child.skeleton.calculateInverses();
          child.bind(child.skeleton, child.matrixWorld);
        }
      });

      // --- Root motion stripping ---
      var allClips = gltf.animations || [];
      for (var ci = 0; ci < allClips.length; ci++) {
        var clip = allClips[ci];
        for (var ti = clip.tracks.length - 1; ti >= 0; ti--) {
          var track = clip.tracks[ti];
          var isPos = track.name.indexOf(".position") === track.name.length - 9;
          var isScale = track.name.indexOf(".scale") === track.name.length - 6;
          if (!isPos && !isScale) continue;
          var suffix = isPos ? ".position" : ".scale";
          var nodePath = track.name.replace(suffix, "");
          if (nodePath === "") {
            // Scene root — remove entirely
            clip.tracks.splice(ti, 1);
          } else if (isPos && _ROOT_BONE_NAMES[nodePath.toLowerCase()]) {
            // Root bone position: lock XZ, keep Y for hip bobbing
            if (track.values && track.values.length >= 3) {
              var firstX = track.values[0];
              var firstZ = track.values[2];
              for (var j = 0; j < track.values.length; j += 3) {
                track.values[j] = firstX;
                track.values[j + 2] = firstZ;
              }
            }
          }
        }
      }

      // --- Animation setup ---
      var mixer = new THREE.AnimationMixer(inner);

      var clipMap = {};
      var clipNames = [];
      for (var ci2 = 0; ci2 < allClips.length; ci2++) {
        var c = allClips[ci2];
        clipMap[c.name] = c;
        clipNames.push(c.name);
      }
      console.log("[CharacterSystem] Animation clips:", clipNames.join(", "));

      var currentAction = null;

      function play(name, playOpts) {
        var clip = findClip(name, clipNames, clipMap);
        if (!clip) return;
        var action = mixer.clipAction(clip);

        // IDEMPOTENT: If same animation is already playing, do nothing
        if (currentAction === action && action.isRunning()) return;

        var loop = !playOpts || playOpts.loop !== false;
        action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
        if (!loop) action.clampWhenFinished = true;

        var fade = (playOpts && playOpts.crossfade !== undefined) ? playOpts.crossfade : 0.25;
        if (currentAction && currentAction !== action) {
          action.reset().fadeIn(fade).play();
          currentAction.fadeOut(fade);
        } else {
          action.reset().play();
        }
        currentAction = action;
      }

      function stop() {
        mixer.stopAllAction();
        currentAction = null;
      }

      // Auto-play idle
      play("idle");

      // Store mixer on userData for cleanup
      mesh.userData.__mixer = mixer;

      // Store animation data on mesh.userData for editor access
      mesh.userData.__clipNames = clipNames;
      mesh.userData.__play = play;
      mesh.userData.__stop = stop;
      mesh.userData.__currentClip = function() { return currentAction && currentAction.getClip ? currentAction.getClip().name : null; };
      mesh.userData.__pause = function() { if (currentAction) currentAction.paused = true; };
      mesh.userData.__resume = function() { if (currentAction) currentAction.paused = false; };

      // Clip durations and time control
      mesh.userData.__clipDurations = {};
      for (var cdi = 0; cdi < allClips.length; cdi++) {
        mesh.userData.__clipDurations[allClips[cdi].name] = allClips[cdi].duration;
      }
      mesh.userData.__getTime = function() {
        if (!currentAction) return null;
        var clip = currentAction.getClip();
        return { time: currentAction.time, duration: clip ? clip.duration : 0, clipName: clip ? clip.name : null, paused: currentAction.paused };
      };
      mesh.userData.__setTime = function(t) {
        if (currentAction) { currentAction.time = t; }
      };

      // Auto-classify clips for animMap
      var autoAnimMap = {};
      for (var aci = 0; aci < allClips.length; aci++) {
        var acn = allClips[aci].name.toLowerCase();
        var acdur = allClips[aci].duration;
        if (acn.indexOf("idle") !== -1 || (acdur > 2 && acn.indexOf("walk") === -1 && acn.indexOf("run") === -1)) {
          if (!autoAnimMap.idle) autoAnimMap.idle = allClips[aci].name;
        }
        if (acn.indexOf("walk") !== -1) { if (!autoAnimMap.walk) autoAnimMap.walk = allClips[aci].name; }
        if (acn.indexOf("run") !== -1 || acn.indexOf("sprint") !== -1) { if (!autoAnimMap.run) autoAnimMap.run = allClips[aci].name; }
        if (acn.indexOf("jump") !== -1) { if (!autoAnimMap.jump) autoAnimMap.jump = allClips[aci].name; }
        if (acn.indexOf("fall") !== -1 || acn.indexOf("falling") !== -1 || acn.indexOf("air") !== -1 || acn.indexOf("airborne") !== -1 || acn.indexOf("freefall") !== -1) { if (!autoAnimMap.fall) autoAnimMap.fall = allClips[aci].name; }
        if (acn.indexOf("land") !== -1 || acn.indexOf("landing") !== -1 || acn.indexOf("touchdown") !== -1 || acn.indexOf("groundhit") !== -1) { if (!autoAnimMap.land) autoAnimMap.land = allClips[aci].name; }
        if (acn.indexOf("attack") !== -1 || acn.indexOf("kick") !== -1 || acn.indexOf("punch") !== -1 || acn.indexOf("slash") !== -1) { if (!autoAnimMap.attack) autoAnimMap.attack = allClips[aci].name; }
        if (acn.indexOf("dead") !== -1 || acn.indexOf("death") !== -1 || acn.indexOf("die") !== -1) { if (!autoAnimMap.die) autoAnimMap.die = allClips[aci].name; }
        if (acn.indexOf("hit") !== -1 || acn.indexOf("damage") !== -1) { if (!autoAnimMap.hit) autoAnimMap.hit = allClips[aci].name; }
      }
      // Prefer exact name matches
      for (var exi = 0; exi < allClips.length; exi++) {
        var exn = allClips[exi].name.toLowerCase();
        if (exn === "idle" && autoAnimMap.idle && autoAnimMap.idle.toLowerCase() !== "idle") autoAnimMap.idle = allClips[exi].name;
        if (exn === "walk" && autoAnimMap.walk && autoAnimMap.walk.toLowerCase() !== "walk") autoAnimMap.walk = allClips[exi].name;
        if (exn === "run" && autoAnimMap.run && autoAnimMap.run.toLowerCase() !== "run") autoAnimMap.run = allClips[exi].name;
        if (exn === "jump" && autoAnimMap.jump && autoAnimMap.jump.toLowerCase() !== "jump") autoAnimMap.jump = allClips[exi].name;
      }

      // Fallback: assign idle to longest clip, walk to second-longest
      if (!autoAnimMap.idle && allClips.length > 0) {
        var sorted = allClips.slice().sort(function(a, b) { return b.duration - a.duration; });
        autoAnimMap.idle = sorted[0].name;
        if (sorted.length > 1 && !autoAnimMap.walk) autoAnimMap.walk = sorted[1].name;
      }
      mesh.userData.__animMap = autoAnimMap;

      // Set __charHalfY for old saved game code's mesh sync Y-offset
      mesh.userData.__charHalfY = halfExtents.y;

      // Store full result on mesh for game template access
      mesh.userData.__charResult = {
        mesh: mesh,
        mixer: mixer,
        clips: clipNames,
        play: play,
        stop: stop,
        size: halfExtents
      };

      var result = {
        mesh: mesh,
        inner: inner,
        pivot: pivot,
        mixer: mixer,
        clips: clipNames,
        clipMap: clipMap,
        play: play,
        stop: stop,
        size: halfExtents,
        currentAction: function() { return currentAction; }
      };

      console.log("[CharacterSystem] Character loaded:", meshName, "| clips:", clipNames.length,
        "| boneDeformed:", usedBoneTransform, "| scale:", autoScale.toFixed(3));
      resolve(result);
    }, function() {
      // Progress callback — silent
    }, function(err) {
      console.error("[CharacterSystem] GLB load failed:", err);
      reject(err);
    });
  });
}

// ===== ORIGIN DETECTION =====
var _vibexeOrigin = "";

function _getVibexeOrigin() {
  if (_vibexeOrigin) return _vibexeOrigin;
  if (typeof document !== "undefined" && document.referrer) {
    try {
      var u = new URL(document.referrer);
      _vibexeOrigin = u.origin;
      return _vibexeOrigin;
    } catch(e) {}
  }
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  return "";
}

// ===== SWAP FUNCTION =====
var _isSwapping = false;

function swapCharacter(scene, characterId) {
  if (_isSwapping) { console.log("[CharacterSystem] Swap already in progress, skipping"); return Promise.resolve(false); }
  var charDef = _registry.get(characterId);
  if (!charDef) { console.warn("[CharacterSystem] Unknown character:", characterId); return Promise.resolve(false); }

  var baseUrl = _getVibexeOrigin();
  if (!baseUrl) { console.warn("[CharacterSystem] No origin available"); return Promise.resolve(false); }

  var modelUrl = baseUrl + "/api/app-builder/media-stock-3d/" + charDef.pack + "/" + charDef.model;

  // Capture old position from current player mesh
  var oldMesh = window.__vibexe_playerMesh__;
  var spawnPos = { x: 0, y: 3, z: 0 };
  if (oldMesh) {
    spawnPos = { x: oldMesh.position.x, y: oldMesh.position.y, z: oldMesh.position.z };
  }

  console.log("[CharacterSystem] Loading", charDef.name, "from", modelUrl);
  _isSwapping = true;

  return loadCharacterGLB(scene, modelUrl, spawnPos, charDef.name, charDef.model)
    .then(function(result) {
      if (!result) { _isSwapping = false; return false; }

      // Remove old mesh from scene and dispose
      if (oldMesh) {
        // Remove old mixer from _activeMixers3D (with stopAllAction + uncacheRoot)
        if (oldMesh.userData && oldMesh.userData.__mixer) {
          try {
            oldMesh.userData.__mixer.stopAllAction();
            oldMesh.userData.__mixer.uncacheRoot(oldMesh);
          } catch(e) {}
          if (window._activeMixers3D) {
            var mi = window._activeMixers3D.indexOf(oldMesh.userData.__mixer);
            if (mi !== -1) window._activeMixers3D.splice(mi, 1);
            // Fallback: also search for any mixer pointing to this mesh
            for (var _mxi = window._activeMixers3D.length - 1; _mxi >= 0; _mxi--) {
              try {
                if (window._activeMixers3D[_mxi]._root === oldMesh || window._activeMixers3D[_mxi]._root === oldMesh.children[0]) {
                  window._activeMixers3D.splice(_mxi, 1);
                }
              } catch(e) {}
            }
          }
          oldMesh.userData.__mixer = null;
        }
        scene.remove(oldMesh);
        try {
          oldMesh.traverse(function(child) {
            try {
              if (child.geometry) child.geometry.dispose();
              if (child.material) {
                var mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(function(m) {
                  try {
                    var texKeys = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "bumpMap"];
                    texKeys.forEach(function(k) { if (m[k]) { try { m[k].dispose(); } catch(e) {} } });
                    m.dispose();
                  } catch(e) {}
                });
              }
            } catch(e) {}
          });
        } catch(e) { console.warn("[CharacterSystem] Error disposing old mesh:", e); }
      }

      // Also sweep any stale Character_ meshes from scene
      var toRemove = [];
      for (var i = 0; i < scene.children.length; i++) {
        var sc = scene.children[i];
        if (sc.name && sc.name.indexOf("Character_") === 0 && sc !== result.mesh) {
          toRemove.push(sc);
        }
      }
      toRemove.forEach(function(m) {
        console.log("[CharacterSystem] Removing stale character:", m.name);
        if (m.userData && m.userData.__mixer) {
          try {
            m.userData.__mixer.stopAllAction();
            m.userData.__mixer.uncacheRoot(m);
          } catch(e) {}
          if (window._activeMixers3D) {
            var mi = window._activeMixers3D.indexOf(m.userData.__mixer);
            if (mi !== -1) window._activeMixers3D.splice(mi, 1);
            for (var _mxi2 = window._activeMixers3D.length - 1; _mxi2 >= 0; _mxi2--) {
              try {
                if (window._activeMixers3D[_mxi2]._root === m || window._activeMixers3D[_mxi2]._root === m.children[0]) {
                  window._activeMixers3D.splice(_mxi2, 1);
                }
              } catch(e) {}
            }
          }
          m.userData.__mixer = null;
        }
        scene.remove(m);
        try {
          m.traverse(function(c) {
            try {
              if (c.geometry) c.geometry.dispose();
              if (c.material) {
                var mats = Array.isArray(c.material) ? c.material : [c.material];
                mats.forEach(function(mat) {
                  try {
                    var texKeys = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "bumpMap"];
                    texKeys.forEach(function(k) { if (mat[k]) { try { mat[k].dispose(); } catch(e) {} } });
                    mat.dispose();
                  } catch(e) {}
                });
              }
            } catch(e) {}
          });
        } catch(e) { console.warn("[CharacterSystem] Error disposing stale mesh:", m.name, e); }
      });

      // Add new mesh to scene
      scene.add(result.mesh);

      // No re-bind needed here — loadCharacterGLB already called calculateInverses()
      // and bind() after all hierarchy changes (pivot, scale, position) with bones
      // in bind pose. In attached mode, bindMatrixInverse auto-updates to inv(meshWorldMatrix)
      // each frame, so moving the Group moves the render 1:1 (no double-offset).

      // Register mixer in framework
      if (result.mixer && window._activeMixers3D) {
        window._activeMixers3D.push(result.mixer);
      }

      // Merge explicit animation overrides from character definition into autoAnimMap
      if (charDef.animations && result.mesh.userData.__animMap) {
        var animMap = result.mesh.userData.__animMap;
        for (var ak in charDef.animations) {
          if (charDef.animations.hasOwnProperty(ak)) {
            animMap[ak] = charDef.animations[ak];
          }
        }
        result.mesh.userData.__animMap = animMap;
      }

      // === Transfer physics body from old mesh to new mesh ===
      var physBody = oldMesh && oldMesh.userData ? oldMesh.userData.__physicsBody : null;
      if (physBody) {
        // Validate physics body is still in the world
        if (physBody.world) {
          result.mesh.userData.__physicsBody = physBody;
        } else {
          // Body exists but lost its world reference — still transfer it
          result.mesh.userData.__physicsBody = physBody;
          console.warn("[CharacterSystem] Physics body transferred but may not be in world");
        }
        // Reshape physics body to match new character dimensions
        var cb = result.mesh.userData.__characterBounds;
        if (cb && physBody.shapes && physBody.shapes.length > 0) {
          var CANNON = window.CANNON;
          if (CANNON) {
            var newHalf = new CANNON.Vec3(
              Math.max(0.05, cb.halfX),
              Math.max(0.05, cb.height / 2),
              Math.max(0.05, cb.halfZ)
            );
            var newBox = new CANNON.Box(newHalf);
            if (physBody.removeShape && physBody.addShape) {
              physBody.removeShape(physBody.shapes[0]);
              physBody.addShape(newBox);
            } else {
              physBody.shapes[0] = newBox;
              if (physBody.updateBoundingRadius) physBody.updateBoundingRadius();
              if (physBody.updateMassProperties) physBody.updateMassProperties();
            }
            console.log("[CharacterSystem] Reshaped physics body:", cb);
          }
        }
        // Snap physics body AND mesh to terrain height at current position
        var getH = window.__vibexe_getTerrainHeight;
        if (getH) {
          var th = getH(physBody.position.x, physBody.position.z);
          if (th != null) {
            var halfH = cb ? cb.height / 2 : 0.75;
            var minY = th + halfH + 0.5;
            if (physBody.position.y < minY) {
              physBody.position.y = minY;
              // Mesh Y = body center Y minus halfH (feet at ground level)
              result.mesh.position.y = minY - halfH;
              if (physBody.velocity) physBody.velocity.set(0, 0, 0);
            }
          }
        }
      }

      // Set global reference EARLY (before controller init) so other systems can find the new mesh
      window.__vibexe_playerMesh__ = result.mesh;

      // === Blink-style WASD Controller (v6.0.0) ===
      // Camera-relative movement, smooth rotation, orbit camera, scroll zoom
      // Port of Unity "Blink Top Down WASD Character Controller" to Three.js + CANNON.js

      // Attach input listeners (idempotent — only runs once)
      _attachInputListeners();

      // Tell the game template's IIFE to stop handling WASD input
      // (charSystem controller now owns movement, animation, and camera)
      window.__charCtrl_active = true;

      // Remove only old charSystem controllers, preserve others (e.g. trigger/spring controllers)
      if (window._activeControllers3D) {
        for (var _ci = window._activeControllers3D.length - 1; _ci >= 0; _ci--) {
          if (window._activeControllers3D[_ci] && window._activeControllers3D[_ci].__charSystem) {
            window._activeControllers3D.splice(_ci, 1);
          }
        }
        console.log("[CharacterSystem] Removed old charSystem controllers, remaining:", window._activeControllers3D.length);
      }

      var animMap = result.mesh.userData.__animMap || {};
      var _csLastAnim = "idle";
      var _csMesh = result.mesh;
      var _csBody = result.mesh.userData.__physicsBody || physBody;
      var _csPlay = result.mesh.userData.__play;

      if (_csPlay && _csBody) {
        // === Controller configuration from game settings ===
        var _gsCamera = (window.__VIBEXE_GAME_SETTINGS__ || {}).camera || {};
        var _gsChar = (window.__VIBEXE_GAME_SETTINGS__ || {}).characterController || {};
        var _csHalfH = result.mesh.userData.__characterBounds ? result.mesh.userData.__characterBounds.height / 2 : 0.75;

        // Movement speeds (matches Blink: walkSpeed=2, runSpeed=5)
        var _walkSpeed = _gsChar.walkSpeed || 4;
        var _runSpeed = _gsChar.runSpeed || 8;
        var _jumpForce = _gsChar.jumpForce || 8;

        // Rotation smoothing (Blink: smoothTime=0.25s)
        var _rotSmoothTime = _gsChar.rotationSmoothTime || 0.15;
        var _rotVelocity = 0;

        // Camera orbit state (Blink: middle mouse drag rotates camera)
        // Initialize orbit yaw from current camera settings offset direction
        var _initCamOffZ = Math.max(1, _gsCamera.offsetZ || 12);
        var _initCamOffY = Math.max(1, _gsCamera.offsetY || 8);
        window.__charCtrl_orbitYaw = window.__charCtrl_orbitYaw || 0;
        window.__charCtrl_orbitPitch = window.__charCtrl_orbitPitch || 0.4; // Default ~23 degrees down

        // Camera zoom state (Blink: scroll wheel, min 2 max 15, lerp speed 15)
        var _camDistTarget = _gsChar.camDist || _initCamOffZ;
        var _camHeightTarget = _gsChar.camHeight || _initCamOffY;
        var _camDist = _camDistTarget;
        var _camHeight = _camHeightTarget;
        var _camMinDist = _gsChar.camMinDist || 3;
        var _camMaxDist = _gsChar.camMaxDist || 25;
        var _camMinHeight = _gsChar.camMinHeight || 2;
        var _camMaxHeight = _gsChar.camMaxHeight || 20;
        var _camZoomSpeed = 15;
        var _camLookYOffset = _gsChar.camLookY || 1.2;

        // Camera smooth follow (Blink: Vector3.SmoothDamp, dampTime 0.1s)
        var _camFollowSmoothTime = _gsChar.camSmoothTime || 0.12;
        var _camVelX = 0, _camVelY = 0, _camVelZ = 0;

        // Jump state
        var _wasGrounded = true;
        var _jumpCooldown = 0;
        var _landTimer = 0;

        // Coyote time + jump buffer (Blink-style)
        var _coyoteTimer = 0;
        var _coyoteTime = 0.15; // 150ms grace period
        var _jumpBufferTimer = 0;
        var _jumpBuffer = 0.1; // 100ms buffer

        var newCtrl = {
          __charSystem: true,
          update: function(dt) {
            if (!_csBody || !_csPlay) return;
            // Skip position/camera/input sync while scene editor is active
            if (window.__vibexe_editor_active) return;
            dt = Math.min(dt, 0.05); // Cap dt to prevent huge jumps on lag spikes

            // === 1. READ INPUT — Camera-relative WASD (Blink-style) ===
            var inputX = 0, inputZ = 0;
            if (_inputState.w) inputZ -= 1;
            if (_inputState.s) inputZ += 1;
            if (_inputState.a) inputX -= 1;
            if (_inputState.d) inputX += 1;

            // Normalize diagonal input
            var inputLen = Math.sqrt(inputX * inputX + inputZ * inputZ);
            if (inputLen > 1) { inputX /= inputLen; inputZ /= inputLen; }
            var hasInput = inputLen > 0.01;

            // === 2. CAMERA ORBIT — Middle mouse drag (Blink-style) ===
            var orbitYaw = window.__charCtrl_orbitYaw || 0;

            // === 3. CAMERA ZOOM — Scroll wheel (Blink-style) ===
            if (_mouseState.scrollDelta !== 0) {
              var zoomDelta = _mouseState.scrollDelta * 0.01;
              _camDistTarget += zoomDelta;
              _camHeightTarget += zoomDelta * 0.6; // Height scales proportionally
              _camDistTarget = Math.max(_camMinDist, Math.min(_camMaxDist, _camDistTarget));
              _camHeightTarget = Math.max(_camMinHeight, Math.min(_camMaxHeight, _camHeightTarget));
              _mouseState.scrollDelta = 0;
            }
            // Smooth zoom lerp (Blink: zoomSpeed=15)
            _camDist += (_camDistTarget - _camDist) * Math.min(_camZoomSpeed * dt, 1);
            _camHeight += (_camHeightTarget - _camHeight) * Math.min(_camZoomSpeed * dt, 1);

            // === 4. ROTATE INPUT BY CAMERA YAW (Blink core feature) ===
            // This makes W always move "away from camera" regardless of orbit angle
            var cosY = Math.cos(orbitYaw);
            var sinY = Math.sin(orbitYaw);
            var worldX = inputX * cosY + inputZ * sinY;
            var worldZ = -inputX * sinY + inputZ * cosY;

            // === 5. APPLY MOVEMENT TO PHYSICS BODY ===
            var isRunning = _inputState.shift && hasInput;
            var moveSpeed = isRunning ? _runSpeed : _walkSpeed;

            // Only override X/Z velocity — preserve Y for jump/gravity
            if (_csBody.velocity) {
              _csBody.velocity.x = worldX * moveSpeed;
              _csBody.velocity.z = worldZ * moveSpeed;
            }

            // Coyote time + jump buffer (Blink-style)
            _jumpCooldown = Math.max(0, _jumpCooldown - dt);
            var isGrounded = !!(_csBody.__canJump);
            if (isGrounded) {
              _coyoteTimer = 0;
            } else {
              _coyoteTimer += dt;
            }
            var canJump = isGrounded || _coyoteTimer < _coyoteTime;

            // Jump buffer — remember jump press for a few frames
            if (_inputState.space) {
              _jumpBufferTimer = _jumpBuffer;
            }
            if (_jumpBufferTimer > 0) _jumpBufferTimer -= dt;

            if (_jumpBufferTimer > 0 && canJump && _jumpCooldown <= 0) {
              if (_csBody.velocity) _csBody.velocity.y = _jumpForce;
              _csBody.__canJump = false;
              _coyoteTimer = _coyoteTime; // Consume coyote
              _jumpCooldown = 0.3;
              _jumpBufferTimer = 0;
            }

            // === 6. PHYSICS → MESH POSITION SYNC ===
            if (_csBody.position) {
              _csMesh.position.x = _csBody.position.x;
              _csMesh.position.y = _csBody.position.y - _csHalfH;
              _csMesh.position.z = _csBody.position.z;
              if (_csMesh.userData && _csMesh.userData.__groundOffset) {
                _csMesh.position.y += _csMesh.userData.__groundOffset;
              }
            }

            // === 7. SMOOTH CHARACTER ROTATION (Blink: SmoothDampAngle 0.25s) ===
            if (hasInput) {
              var targetAngle = Math.atan2(worldX, worldZ);
              var dampResult = _smoothDampAngle(_csMesh.rotation.y, targetAngle, _rotVelocity, _rotSmoothTime, dt);
              _csMesh.rotation.y = dampResult.value;
              _rotVelocity = dampResult.velocity;
            } else {
              _rotVelocity = 0;
            }

            // === 8. ANIMATION STATE MACHINE (with hysteresis + fall/land) ===
            var vx = _csBody.velocity ? _csBody.velocity.x : 0;
            var vy = _csBody.velocity ? _csBody.velocity.y : 0;
            var vz = _csBody.velocity ? _csBody.velocity.z : 0;
            var speed = Math.sqrt(vx * vx + vz * vz);
            var _isOnGround = !!(_csBody.__canJump);

            // Land timer countdown
            if (_landTimer > 0) _landTimer -= dt;
            // Detect landing moment
            if (_csLastAnim === "fall" && _isOnGround && _landTimer <= 0) {
              _landTimer = 0.3; // Stay in land state for 0.3s
            }

            var targetAnim;
            if (!_isOnGround && vy < -2) {
              targetAnim = "fall";
            } else if (vy > 2) {
              targetAnim = "jump";
            } else if (_csLastAnim === "fall" && _isOnGround) {
              targetAnim = "land";
            } else if (_csLastAnim === "land") {
              // Stay in land for minimum time (handled by _landTimer)
              if (_landTimer > 0) {
                targetAnim = "land";
              } else if (speed > 0.5) {
                targetAnim = "walk";
              } else {
                targetAnim = "idle";
              }
            } else if (_csLastAnim === "run" ? speed > 3.2 : speed > 4) {
              targetAnim = "run";
            } else if (_csLastAnim === "idle" ? speed > 0.5 : speed > 0.3) {
              targetAnim = "walk";
            } else {
              targetAnim = "idle";
            }

            if (targetAnim !== _csLastAnim) {
              var clipName = animMap[targetAnim] || targetAnim;
              _csPlay(clipName, { crossfade: 0.15 });
              _csLastAnim = targetAnim;
            }

            // === 9. CAMERA FOLLOW (Blink: SmoothDamp with orbit) ===
            var cam = window.__vibexe_camera__ || (window.__vibexe_editor__ || {}).camera;
            if (cam && cam.position && _csMesh.visible && !(window.__vibexe_editor__ || {}).isEditing) {
              // Reset smooth velocities if camera was moved externally (editor moved it)
              if (!window.__charCtrl_camActive) {
                window.__charCtrl_camActive = true;
                _camVelX = 0; _camVelY = 0; _camVelZ = 0;
              }
              // Camera position = player + rotateY(orbitYaw) * (0, height, dist)
              var orbitPitch = window.__charCtrl_orbitPitch || 0.4;
              var camHorizDist = _camDist * Math.cos(orbitPitch);
              var camVertDist = _camDist * Math.sin(orbitPitch);
              var camTargetX = _csMesh.position.x + Math.sin(orbitYaw) * camHorizDist;
              var camTargetY = _csMesh.position.y + camVertDist + 1.0;
              var camTargetZ = _csMesh.position.z + Math.cos(orbitYaw) * camHorizDist;

              // SmoothDamp per axis (Blink: dampTime 0.1s)
              var sdX = _smoothDamp(cam.position.x, camTargetX, _camVelX, _camFollowSmoothTime, dt);
              var sdY = _smoothDamp(cam.position.y, camTargetY, _camVelY, _camFollowSmoothTime, dt);
              var sdZ = _smoothDamp(cam.position.z, camTargetZ, _camVelZ, _camFollowSmoothTime, dt);
              cam.position.x = sdX.value; _camVelX = sdX.velocity;
              cam.position.y = sdY.value; _camVelY = sdY.velocity;
              cam.position.z = sdZ.value; _camVelZ = sdZ.velocity;

              // Terrain-height correction — smooth lerp to prevent camera going underground
              var _getH = window.__vibexe_getTerrainHeight;
              if (_getH) {
                var _camTH = _getH(cam.position.x, cam.position.z);
                if (_camTH != null) {
                  var _camMinY = _camTH + _csHalfH + 2.0;
                  if (cam.position.y < _camMinY) {
                    cam.position.y += (_camMinY - cam.position.y) * Math.min(8 * dt, 1);
                  }
                }
              }

              // === Camera collision avoidance (improved multi-ray) ===
              var _playerCenter = new THREE.Vector3(_csMesh.position.x, _csMesh.position.y + _csHalfH, _csMesh.position.z);
              var _camPos = new THREE.Vector3(cam.position.x, cam.position.y, cam.position.z);
              var _toCamera = new THREE.Vector3().subVectors(_camPos, _playerCenter);
              var _toCamLen = _toCamera.length();
              if (_toCamLen > 0.1) {
                _toCamera.normalize();
                // Build collision targets once per frame
                var _ccTargets = [];
                var _ccScene = window.__vibexe_scene__;
                if (_ccScene) {
                  _ccScene.traverse(function(child) {
                    if (!child.isMesh) return;
                    if (child === _csMesh || child.name.indexOf("Character_") === 0) return;
                    if (child.name.indexOf("__editor_") === 0) return;
                    if (child.userData && child.userData.vibexeType === "AnimatedCharacter") return;
                    if (!child.visible) return;
                    _ccTargets.push(child);
                  });
                }
                if (_ccTargets.length > 0) {
                  // Cast 3 rays: center, +0.3 up, -0.3 down
                  var _closestHit = _toCamLen;
                  var _upOffset = new THREE.Vector3(0, 0.3, 0);
                  var _downOffset = new THREE.Vector3(0, -0.3, 0);
                  var _origins = [_playerCenter, _playerCenter.clone().add(_upOffset), _playerCenter.clone().add(_downOffset)];
                  for (var _ri = 0; _ri < _origins.length; _ri++) {
                    var _ccRay = new THREE.Raycaster(_origins[_ri], _toCamera, 0.3, _toCamLen);
                    var _ccHits = _ccRay.intersectObjects(_ccTargets, false);
                    if (_ccHits.length > 0 && _ccHits[0].distance < _closestHit) {
                      _closestHit = _ccHits[0].distance;
                    }
                  }
                  if (_closestHit < _toCamLen) {
                    var _safeDist = Math.max(1.0, _closestHit - 0.5);
                    // Smooth pull-in (don't pop instantly)
                    var _pullPos = _playerCenter.clone().addScaledVector(_toCamera, _safeDist);
                    cam.position.x += (_pullPos.x - cam.position.x) * Math.min(12 * dt, 1);
                    cam.position.y += (_pullPos.y - cam.position.y) * Math.min(12 * dt, 1);
                    cam.position.z += (_pullPos.z - cam.position.z) * Math.min(12 * dt, 1);
                  }
                }
              }

              // Look at player + Y offset
              cam.lookAt(_csMesh.position.x, _csMesh.position.y + _camLookYOffset, _csMesh.position.z);
            }
          }
        };

        if (window._activeControllers3D) {
          window._activeControllers3D.push(newCtrl);
        }
        console.log("[CharacterSystem] Blink controller v6.0 created | animMap:", Object.keys(animMap).join(","),
          "| speeds:", _walkSpeed + "/" + _runSpeed, "| camDist:", _camDist.toFixed(1), "| orbit/zoom enabled");
      }

      // === Post-terrain snap: poll for terrain height, snap character when available ===
      var _snapDone = false;
      var _snapCount = 0;
      if (_activeSnapTimer) { clearInterval(_activeSnapTimer); _activeSnapTimer = null; }
      var _snapTimer = setInterval(function() {
        _snapCount++;
        if (_snapDone || _snapCount > 60) { clearInterval(_snapTimer); return; }
        // Skip during editor mode — prevents fighting with gizmo drag
        if ((window.__vibexe_editor__ || {}).isEditing) return;
        var getH = window.__vibexe_getTerrainHeight;
        var body = result.mesh.userData.__physicsBody;
        if (!getH || !body) return;
        var th = getH(body.position.x, body.position.z);
        if (th == null) return;
        var halfH = result.mesh.userData.__characterBounds ? result.mesh.userData.__characterBounds.height / 2 : 0.75;
        var targetY = th + halfH + 0.5;
        if (body.position.y < targetY) {
          body.position.y = targetY;
          // Mesh Y = body center Y minus halfH (feet at ground level)
          result.mesh.position.y = targetY - halfH;
          if (body.velocity) body.velocity.set(0, 0, 0);
          console.log("[CharacterSystem] Snapped to terrain: Y=" + targetY.toFixed(1) + " (terrain=" + th.toFixed(1) + ")");
        }
        _snapDone = true;
        clearInterval(_snapTimer);
        _activeSnapTimer = null;
      }, 500);
      _activeSnapTimer = _snapTimer;

      // Save character config
      var gs = window.__VIBEXE_GAME_SETTINGS__ || {};
      gs.character = { id: characterId, pack: charDef.pack, model: charDef.model };
      window.__VIBEXE_GAME_SETTINGS__ = gs;

      // Notify parent frame
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "vibexe-character-swapped", characterId: characterId, characterName: charDef.name }, "*");
        window.parent.postMessage({ type: "game-editor-scene-changed" }, "*");
      }

      console.log("[CharacterSystem] Swapped to", charDef.name, "| animations:", result.clips ? result.clips.length : 0);
      _isSwapping = false;
      return true;
    })
    .catch(function(err) {
      console.error("[CharacterSystem] Swap failed:", err);
      _isSwapping = false;
      return false;
    });
}

// ===== MESSAGE HANDLERS =====
if (typeof window !== "undefined") {
  window.addEventListener("message", function(ev) {
    if (!ev.data) return;

    // Capture parent origin from ANY message
    if (!_vibexeOrigin && ev.origin && ev.origin !== "null" && ev.origin.indexOf("codesandbox") === -1 && ev.origin.indexOf("localhost") === -1) {
      _vibexeOrigin = ev.origin;
    }

    var type = ev.data.type;

    if (type === "character-system-swap") {
      if (ev.data.origin) _vibexeOrigin = ev.data.origin;
      swapCharacter(window.__vibexe_scene__, ev.data.characterId);
    }

    if (type === "character-system-get-registry") {
      if (window.parent && window.parent !== window && _registry) {
        window.parent.postMessage({ type: "vibexe-character-registry", characters: _registry.getAll() }, "*");
      }
    }

    if (type === "character-system-play-animation") {
      var mesh = window.__vibexe_playerMesh__;
      if (mesh && mesh.userData && mesh.userData.__play) {
        mesh.userData.__play(ev.data.clipName, { crossfade: 0.2 });
      }
    }

    if (type === "character-system-stop-animation") {
      var mesh = window.__vibexe_playerMesh__;
      if (mesh && mesh.userData && mesh.userData.__play) {
        mesh.userData.__play("idle", { crossfade: 0.3 });
      }
    }

    if (type === "character-system-set-scale") {
      var mesh = window.__vibexe_playerMesh__;
      if (mesh) {
        var s = Math.max(0.1, Math.min(5.0, ev.data.scale || 1));
        mesh.scale.set(s, s, s);
        // Update bounds for physics (multiply from original, not current — prevents accumulation)
        var bounds = mesh.userData.__characterBounds;
        if (bounds) {
          if (!bounds._origHalfX) { bounds._origHalfX = bounds.halfX; bounds._origHalfZ = bounds.halfZ; bounds._origHeight = bounds.height; }
          bounds.halfX = bounds._origHalfX * s;
          bounds.halfZ = bounds._origHalfZ * s;
          bounds.height = bounds._origHeight * s;
        }
      }
    }

    if (type === "character-system-set-ground-offset") {
      var mesh = window.__vibexe_playerMesh__;
      if (mesh) {
        var offset = ev.data.groundOffset || 0;
        mesh.userData.__groundOffset = offset;
        // Also adjust the pivot group Y for immediate visual feedback
        if (mesh.children.length > 0 && mesh.children[0]) {
          mesh.children[0].position.y = offset;
        }
      }
    }
  });
}

// ===== AUTO-INIT =====
(function() {
  if (typeof window === "undefined") return;

  var _attempts = 0;
  var _interval = setInterval(function() {
    _attempts++;
    if (_attempts > 150) { clearInterval(_interval); return; }

    var scene = window.__vibexe_scene__;
    if (_attempts <= 3 || _attempts % 25 === 0) {
      console.log('[CharacterSystem] Poll #' + _attempts + ' scene:', !!scene);
    }
    if (!scene) return;
    clearInterval(_interval);

    // Create and register module
    _registry = new CharacterRegistry();
    BUILTIN_CHARACTERS.forEach(function(c) { _registry.register(c); });

    if (!window.__vibexe_modules__) window.__vibexe_modules__ = {};
    window.__vibexe_modules__["character-system"] = {
      registry: _registry,
      swap: function(id) { return swapCharacter(scene, id); }
    };

    console.log("[CharacterSystem] Module ready, registry:", _registry.getAll().length, "characters");

    // Auto-swap if character config saved
    var gs = window.__VIBEXE_GAME_SETTINGS__ || {};
    var charConfig = gs.character;
    if (charConfig && charConfig.id) {
      console.log("[CharacterSystem] Auto-init: will swap to", charConfig.id);
      // Wait for Lily mesh + physics body to exist (game template creates these)
      var _waitCount = 0;
      var _wait = setInterval(function() {
        _waitCount++;
        var pm = window.__vibexe_playerMesh__;
        if (pm && pm.userData && pm.userData.__physicsBody) {
          clearInterval(_wait);
          // Small delay to let game template fully initialize
          setTimeout(function() { swapCharacter(scene, charConfig.id); }, 500);
        } else if (_waitCount > 150) {
          clearInterval(_wait);
          console.warn("[CharacterSystem] Auto-init timeout, swapping anyway");
          swapCharacter(scene, charConfig.id);
        }
      }, 100);
    } else {
      console.log("[CharacterSystem] No character config — standing by for user selection");
    }
  }, 200);
})();

// CommonJS export
module.exports = {
  CharacterRegistry: CharacterRegistry,
  swapCharacter: swapCharacter,
  loadCharacterGLB: loadCharacterGLB
};
`;

export const CHARACTER_SYSTEM_MANIFEST: ModuleManifest = {
	id: "character-system",
	name: "Character System",
	version: "6.0.0",
	category: "tools",
	description: "Player character selection and model swapping",
	icon: "PersonStanding",
	assets: [],
	runtimeCode,
	bridgeHandlers: {
		"character-system-swap": "handleSwap",
		"character-system-get-registry": "handleGetRegistry",
		"character-system-play-animation": "handlePlayAnimation",
		"character-system-stop-animation": "handleStopAnimation",
		"character-system-set-scale": "handleSetScale",
		"character-system-set-ground-offset": "handleSetGroundOffset",
	},
	defaultSettings: {
		characterId: "warrior",
		groundOffset: 0,
		scale: 1.0,
	},
};
