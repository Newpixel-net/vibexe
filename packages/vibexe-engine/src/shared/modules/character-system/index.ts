/**
 * Character System Module — Manifest & Registration
 *
 * Manages player character selection, loading, and runtime swapping.
 * Characters are AI-generated 3D models (GLB) with skeletal animations.
 *
 * Features:
 * - Character registry (built-in + future database categories)
 * - Runtime character swapping (dispose old, load new, rebind physics)
 * - Production-quality GLTFLoader character loading (bone measurement, pivot correction, scale cap)
 * - Scored animation matching (partial keyword with priority ranking)
 * - Root motion stripping (locks XZ on root bones)
 * - Camera follow override (replaces stale game loop reference)
 * - Terrain ground-following
 * - Per-frame animation state machine with hysteresis
 * - Scene hierarchy integration (Character_ prefix, userData)
 * - Physics body reuse on swap
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

const runtimeCode = `// @vibexe/character-system v3.1.0
// Production-quality character management — bone measurement, pivot correction, camera override
console.log('[CharacterSystem] Module v3 loaded');

var THREE = require('three');

// ===== CONSTANTS =====
var TARGET_HEIGHT = 1.5;     // World units — matches SCALES_3D.animatedCharacter
var MAX_AUTO_SCALE = 1;      // Cap to prevent over-scaling skinned meshes
var CAMERA_OFFSET_Y = 8;     // Camera height above player
var CAMERA_OFFSET_Z = 12;    // Camera distance behind player
var CAMERA_LERP = 3;         // Camera smoothing speed
var CAMERA_LOOK_Y = 1;       // Camera look-at Y offset
var WALK_SPEED = 0.5;        // Horizontal speed threshold for walk
var RUN_SPEED = 5;           // Horizontal speed threshold for run
var MIN_STATE_HOLD = 0.15;   // Min seconds before animation state change

// Root bone names for root motion stripping
var _ROOT_BONE_NAMES = {
  "hips": true, "root": true, "mixamorig:hips": true, "mixamorigHips": true,
  "mixamorig_hips": true, "pelvis": true, "rootnode": true, "root_bone": true,
  "bip001": true, "bip01": true, "hip": true
};

// ===== CHARACTER REGISTRY =====
var _builtInCharacters = ${BUILT_IN_CHARACTERS};

function CharacterRegistry() {
  this._characters = {};
  for (var i = 0; i < _builtInCharacters.length; i++) {
    var c = _builtInCharacters[i];
    this._characters[c.id] = c;
  }
}

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

CharacterRegistry.prototype.register = function(charDef) {
  if (!charDef || !charDef.id) return;
  this._characters[charDef.id] = charDef;
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

      // Fix materials for proper lighting
      inner.traverse(function(child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
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

      // Play first animation frame so bones are in a real pose
      var tempClips = gltf.animations || [];
      if (tempClips.length > 0) {
        var tempMixer = new THREE.AnimationMixer(inner);
        tempMixer.clipAction(tempClips[0]).play();
        tempMixer.update(0);
      }

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

      // Physics half-extents based on target height
      var halfExtents = { x: TARGET_HEIGHT * 0.3, y: TARGET_HEIGHT / 2, z: TARGET_HEIGHT * 0.3 };

      // Store character bounds for editor BoxHelper override
      mesh.userData.__characterBounds = {
        halfX: halfExtents.x,
        halfZ: halfExtents.z,
        height: TARGET_HEIGHT
      };

      scene.add(mesh);

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

      // Register with framework mixer array for global updates
      if (window._activeMixers3D && Array.isArray(window._activeMixers3D)) {
        window._activeMixers3D.push(mixer);
      }

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

// ===== CHARACTER MANAGER =====
function CharacterManager(scene) {
  this._scene = scene;
  this._registry = new CharacterRegistry();
  this._activeId = null;
  this._activeMesh = null;
  this._activeResult = null;
  this._physicsBody = null;
  this._swapping = false;
  this._controllerObj = null;
  this._controllerRegistered = false;
  this._cachedCamera = null;
  this._cameraOverride = false;
  // Animation state machine
  this._animState = "idle";
  this._animStateTimer = 0;
  this._isAttacking = false;
  this._attackTimer = 0;
  console.log("[CharacterSystem] Manager created, registry:", this._registry.getAll().length, "characters");
}

CharacterManager.prototype.getRegistry = function() { return this._registry; };
CharacterManager.prototype.getActiveId = function() { return this._activeId; };
CharacterManager.prototype.getActiveMesh = function() { return this._activeMesh; };

// Register controller in _activeControllers3D (runs AFTER gameScene.update each frame)
// This replaces the separate RAF loop — no double mixer update, camera override wins naturally,
// and controller is automatically skipped in editor mode by the framework.
CharacterManager.prototype._startUpdateLoop = function() {
  var self = this;
  if (this._controllerRegistered) return;
  this._controllerRegistered = true;
  this._cachedCamera = null;

  var controllerObj = {
    update: function(delta) {
      if (delta <= 0 || delta > 0.1) return;

      var result = self._activeResult;
      var body = self._physicsBody;
      var mesh = self._activeMesh;
      if (!result || !mesh) return;

      // NOTE: Mixer update handled by framework via _activeMixers3D — NOT here.
      // This prevents the double-update bug (2x animation speed).

      // 1. Sync mesh position to physics body with Y offset
      if (body) {
        mesh.position.x = body.position.x;
        mesh.position.z = body.position.z;
        var cb = mesh.userData && mesh.userData.__characterBounds;
        if (cb) {
          mesh.position.y = body.position.y - cb.height / 2;
        } else {
          mesh.position.y = body.position.y - TARGET_HEIGHT / 2;
        }
      }

      // 2. Facing direction (smooth rotation toward movement)
      if (body) {
        var vx = body.velocity.x;
        var vz = body.velocity.z;
        var hSpeed = Math.sqrt(vx * vx + vz * vz);
        if (hSpeed > 0.3) {
          if (Math.abs(vx) > 0.01 || Math.abs(vz) > 0.01) {
            var targetAngle = Math.atan2(vx, vz);
            var current = mesh.rotation.y;
            var diff = targetAngle - current;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            mesh.rotation.y += diff * Math.min(1, delta * 10);
          }
        }
      }

      // 3. Camera follow override (runs AFTER gameScene.update, so naturally wins)
      if (self._cameraOverride) {
        if (!self._cachedCamera) {
          self._cachedCamera = window.__vibexe_camera__;
          if (!self._cachedCamera && window.__vibexe_scene__) {
            var sc = window.__vibexe_scene__;
            if (sc.userData && sc.userData.__camera) {
              self._cachedCamera = sc.userData.__camera;
            }
            if (!self._cachedCamera) {
              sc.traverse(function(child) {
                if (!self._cachedCamera && child.isCamera) self._cachedCamera = child;
              });
            }
          }
        }
        var cam = self._cachedCamera;
        if (cam) {
          cam.position.x += (mesh.position.x - cam.position.x) * CAMERA_LERP * delta;
          cam.position.y += (mesh.position.y + CAMERA_OFFSET_Y - cam.position.y) * CAMERA_LERP * delta;
          cam.position.z += (mesh.position.z + CAMERA_OFFSET_Z - cam.position.z) * CAMERA_LERP * delta;
          cam.lookAt(mesh.position.x, mesh.position.y + CAMERA_LOOK_Y, mesh.position.z);
        }
      }

      // 4. Per-frame animation state machine
      if (body && result.play) {
        var pvx = body.velocity.x;
        var pvz = body.velocity.z;
        var pSpeed = Math.sqrt(pvx * pvx + pvz * pvz);
        var isGrounded = body.__canJump !== false;
        var isRising = body.velocity.y > 2;

        if (self._isAttacking) {
          self._attackTimer -= delta;
          if (self._attackTimer <= 0) self._isAttacking = false;
          else return;
        }

        self._animStateTimer += delta;
        var newState = self._animState;
        if (!isGrounded && isRising) {
          newState = "jump";
        } else if (self._animState === "run" ? pSpeed > RUN_SPEED * 0.6 : pSpeed > RUN_SPEED) {
          newState = "run";
        } else if (self._animState === "walk" ? pSpeed > WALK_SPEED * 0.3 : pSpeed > WALK_SPEED) {
          newState = "walk";
        } else {
          newState = "idle";
        }

        if (newState !== self._animState && (self._animStateTimer >= MIN_STATE_HOLD || newState === "jump")) {
          self._animState = newState;
          self._animStateTimer = 0;
          if (newState === "jump") {
            result.play("jump", { loop: false, crossfade: 0.15 });
          } else if (newState === "run") {
            result.play("run", { crossfade: 0.2 });
          } else if (newState === "walk") {
            result.play("walk", { crossfade: 0.2 });
          } else {
            result.play("idle", { crossfade: 0.3 });
          }
        }
      }
    },
    __charSystem: true
  };
  self._controllerObj = controllerObj;

  if (window._activeControllers3D && Array.isArray(window._activeControllers3D)) {
    window._activeControllers3D.push(controllerObj);
  }
};

CharacterManager.prototype._stopUpdateLoop = function() {
  if (this._controllerObj && window._activeControllers3D) {
    var idx = window._activeControllers3D.indexOf(this._controllerObj);
    if (idx !== -1) window._activeControllers3D.splice(idx, 1);
  }
  this._controllerObj = null;
  this._controllerRegistered = false;
  this._cachedCamera = null;
};

// Swap to a new character by ID
CharacterManager.prototype.swap = function(characterId, options) {
  if (this._swapping) {
    console.warn("[CharacterSystem] Swap already in progress, ignoring");
    return Promise.resolve(false);
  }
  var charDef = this._registry.get(characterId);
  if (!charDef) {
    console.error("[CharacterSystem] Character not found:", characterId);
    return Promise.resolve(false);
  }

  this._swapping = true;
  // Signal EARLY that character-system is taking over camera + position sync
  // This prevents game template from fighting with us during async load
  window.__vibexe_charSystem_active__ = true;
  var self = this;
  var opts = options || {};
  var scene = this._scene;
  var spawnPos = opts.position || { x: 0, y: 5, z: 0 };

  console.log("[CharacterSystem] Swapping to:", charDef.name, "(" + characterId + ")");

  // 1. Capture old position from physics body or current mesh
  var existingBody = null;
  if (this._physicsBody) {
    spawnPos = {
      x: this._physicsBody.position.x,
      y: this._physicsBody.position.y,
      z: this._physicsBody.position.z
    };
    existingBody = this._physicsBody;
  } else if (window.__vibexe_playerMesh__) {
    var oldMesh = window.__vibexe_playerMesh__;
    spawnPos = {
      x: oldMesh.position.x,
      y: oldMesh.position.y,
      z: oldMesh.position.z
    };
    if (oldMesh.userData && oldMesh.userData.__physicsBody) {
      existingBody = oldMesh.userData.__physicsBody;
    }
  }

  // 2. Dispose old character (our own, if any)
  this._disposeActive();

  // 2b. Remove stale controllers from _activeControllers3D (e.g. old lilyController)
  if (window._activeControllers3D && Array.isArray(window._activeControllers3D)) {
    for (var ci = window._activeControllers3D.length - 1; ci >= 0; ci--) {
      if (!window._activeControllers3D[ci].__charSystem) {
        window._activeControllers3D.splice(ci, 1);
      }
    }
  }

  // 3. Also remove the legacy player mesh (Lily) if it exists and isn't ours
  var legacyMesh = window.__vibexe_playerMesh__;
  if (legacyMesh && legacyMesh !== this._activeMesh) {
    console.log("[CharacterSystem] Removing legacy player mesh:", legacyMesh.name || "unnamed");
    // Remove legacy mixer from _activeMixers3D
    if (legacyMesh.userData && legacyMesh.userData.__mixer && window._activeMixers3D) {
      var mi = window._activeMixers3D.indexOf(legacyMesh.userData.__mixer);
      if (mi !== -1) window._activeMixers3D.splice(mi, 1);
    }
    // Remove legacy physics body from CANNON world
    if (legacyMesh.userData && legacyMesh.userData.__physicsBody && window.__vibexe_world__) {
      var legacyBody = legacyMesh.userData.__physicsBody;
      // Only remove if we're NOT reusing it
      if (legacyBody !== self._physicsBody) {
        try { window.__vibexe_world__.removeBody(legacyBody); } catch(e) {}
      }
    }
    scene.remove(legacyMesh);
    legacyMesh.traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
    });
    window.__vibexe_playerMesh__ = null;
  }

  // 3b. Sweep ALL stale Character_ meshes from scene (persistence may have re-added them)
  var toRemove = [];
  for (var si = 0; si < scene.children.length; si++) {
    var sc = scene.children[si];
    if (sc.name && sc.name.indexOf("Character_") === 0 && sc !== self._activeMesh) {
      toRemove.push(sc);
    }
  }
  for (var ri = 0; ri < toRemove.length; ri++) {
    console.log("[CharacterSystem] Removing stale character:", toRemove[ri].name);
    scene.remove(toRemove[ri]);
    toRemove[ri].traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { m.dispose(); });
        } else if (child.material.dispose) {
          child.material.dispose();
        }
      }
    });
  }

  // 4. Build model URL (use parent origin, not iframe's codesandbox origin)
  var baseUrl = _getVibexeOrigin();
  var modelUrl = baseUrl + "/api/app-builder/media-stock-3d/" + charDef.pack + "/" + charDef.model;

  // 5. Load new character
  return loadCharacterGLB(scene, modelUrl, spawnPos, charDef.name, charDef.model)
    .then(function(charResult) {
      if (!charResult) {
        self._swapping = false;
        return false;
      }

      self._activeResult = charResult;
      self._activeMesh = charResult.mesh;
      self._activeId = characterId;

      // Merge explicit animation overrides from character definition into autoAnimMap
      if (charDef.animations && charResult.mesh.userData.__animMap) {
        var animMap = charResult.mesh.userData.__animMap;
        for (var ak in charDef.animations) {
          if (charDef.animations.hasOwnProperty(ak)) {
            animMap[ak] = charDef.animations[ak];
          }
        }
        charResult.mesh.userData.__animMap = animMap;
      }

      // Register player mesh globally
      window.__vibexe_playerMesh__ = charResult.mesh;

      // 6. Reuse existing physics body or create new one
      if (existingBody) {
        self._physicsBody = existingBody;
        charResult.mesh.userData.__physicsBody = existingBody;
        // Reshape body to match new character dimensions
        var CANNON_R = window.CANNON;
        if (CANNON_R && existingBody.shapes && existingBody.shapes.length > 0) {
          existingBody.removeShape(existingBody.shapes[0]);
          var newHalfX = Math.max(charResult.size.x, 0.2);
          var newHalfY = Math.max(charResult.size.y, 0.3);
          var newHalfZ = Math.max(charResult.size.z, 0.2);
          var newShape = new CANNON_R.Box(new CANNON_R.Vec3(newHalfX, newHalfY, newHalfZ));
          existingBody.addShape(newShape);
          console.log("[CharacterSystem] Reshaped physics body:", newHalfX.toFixed(2), newHalfY.toFixed(2), newHalfZ.toFixed(2));
        }
        console.log("[CharacterSystem] Reusing existing physics body");
      } else {
        var CANNON = window.CANNON;
        var world = window.__vibexe_world__;
        if (CANNON && world) {
          var halfX = Math.max(charResult.size.x, 0.2);
          var halfY = Math.max(charResult.size.y, 0.3);
          var halfZ = Math.max(charResult.size.z, 0.2);
          var shape = new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ));
          var body = new CANNON.Body({ mass: 5, shape: shape });
          body.position.set(spawnPos.x, spawnPos.y + halfY, spawnPos.z);
          body.linearDamping = 0.9;
          body.angularDamping = 1.0;
          body.fixedRotation = true;
          world.addBody(body);
          self._physicsBody = body;
          charResult.mesh.userData.__physicsBody = body;
          console.log("[CharacterSystem] Created new physics body");
        }
      }

      // 7. Enable camera override (our loop takes over camera follow + mesh sync)
      self._cameraOverride = true;
      // Signal to game template that character-system owns camera + position sync
      window.__vibexe_charSystem_active__ = true;

      // 8. Start unified update loop
      self._startUpdateLoop();

      // 9. Reset animation state
      self._animState = "idle";
      self._animStateTimer = 0;

      // 10. Store config for persistence
      var gs = window.__VIBEXE_GAME_SETTINGS__ || {};
      gs.character = {
        id: characterId,
        pack: charDef.pack,
        model: charDef.model,
        groundOffset: charDef.groundOffset || 0
      };
      window.__VIBEXE_GAME_SETTINGS__ = gs;

      // Post-swap cleanup: remove any stale Character_ meshes added by persistence
      var postClean = [];
      for (var pci = 0; pci < scene.children.length; pci++) {
        var pcc = scene.children[pci];
        if (pcc.name && pcc.name.indexOf("Character_") === 0 && pcc !== charResult.mesh) {
          postClean.push(pcc);
        }
      }
      for (var pcj = 0; pcj < postClean.length; pcj++) {
        console.log("[CharacterSystem] Post-swap cleanup:", postClean[pcj].name);
        scene.remove(postClean[pcj]);
      }

      console.log("[CharacterSystem] Swap complete:", charDef.name,
        "| animations:", charResult.clips ? charResult.clips.length : 0,
        "| pivot-corrected, bone-measured");

      self._swapping = false;

      // Notify parent frame
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "vibexe-character-swapped",
          characterId: characterId,
          characterName: charDef.name
        }, "*");
        // Request scene tree refresh so new character appears in hierarchy
        window.parent.postMessage({
          type: "game-editor-scene-changed"
        }, "*");
      }

      return true;
    })
    .catch(function(err) {
      console.error("[CharacterSystem] Failed to load character:", err);
      self._swapping = false;
      return false;
    });
};

CharacterManager.prototype._disposeActive = function() {
  // Stop update loop
  this._stopUpdateLoop();

  // Stop animations
  if (this._activeResult && this._activeResult.stop) {
    try { this._activeResult.stop(); } catch(e) {}
  }

  // Remove mixer from framework array
  if (this._activeResult && this._activeResult.mixer && window._activeMixers3D) {
    var idx = window._activeMixers3D.indexOf(this._activeResult.mixer);
    if (idx !== -1) window._activeMixers3D.splice(idx, 1);
  }

  // Remove mesh from scene
  if (this._activeMesh && this._scene) {
    this._scene.remove(this._activeMesh);
    this._activeMesh.traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
    });
  }

  // Clean up animation mixer
  if (this._activeResult && this._activeResult.mixer) {
    try { this._activeResult.mixer.stopAllAction(); } catch(e) {}
  }

  // Clear globals
  if (window.__vibexe_playerMesh__ === this._activeMesh) {
    window.__vibexe_playerMesh__ = null;
  }

  this._activeMesh = null;
  this._activeResult = null;
  this._activeId = null;
  this._cameraOverride = false;
  // Release camera+position ownership back to game template
  window.__vibexe_charSystem_active__ = false;
};

// ===== MODULE INITIALIZATION =====

// Listen for character swap messages from parent frame
if (typeof window !== "undefined") {
  window.addEventListener("message", function(ev) {
    if (!ev.data) return;

    // Capture parent origin from ANY message
    if (!_vibexeOrigin && ev.origin && ev.origin !== "null" && ev.origin.indexOf("codesandbox") === -1 && ev.origin.indexOf("localhost") === -1) {
      _vibexeOrigin = ev.origin;
    }

    if (ev.data.type === "character-system-swap") {
      if (ev.data.origin) _vibexeOrigin = ev.data.origin;
      var mgr = window.__vibexe_modules__ && window.__vibexe_modules__["character-system"];
      if (mgr && mgr.manager) {
        mgr.manager.swap(ev.data.characterId, ev.data.options || {});
      }
    }

    if (ev.data.type === "character-system-get-registry") {
      var mgr2 = window.__vibexe_modules__ && window.__vibexe_modules__["character-system"];
      if (mgr2 && mgr2.manager) {
        var chars = mgr2.manager.getRegistry().getAll();
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: "vibexe-character-registry",
            characters: chars
          }, "*");
        }
      }
    }
  });
}

// ===== AUTO-INIT =====
(function() {
  if (typeof window === "undefined") return;

  var _initAttempts = 0;
  var _initInterval = setInterval(function() {
    _initAttempts++;
    if (_initAttempts > 150) { clearInterval(_initInterval); return; }

    var scene = window.__vibexe_scene__;
    if (_initAttempts <= 3 || _initAttempts % 25 === 0) {
      console.log('[CharacterSystem] Poll #' + _initAttempts + ' scene:', !!scene);
    }
    if (!scene) return;

    clearInterval(_initInterval);

    var manager = new CharacterManager(scene);

    if (!window.__vibexe_modules__) window.__vibexe_modules__ = {};
    window.__vibexe_modules__["character-system"] = {
      CharacterRegistry: CharacterRegistry,
      CharacterManager: CharacterManager,
      manager: manager
    };

    var gs = window.__VIBEXE_GAME_SETTINGS__ || {};
    var charConfig = gs.character;

    console.log("[CharacterSystem] Auto-init. charConfig:", charConfig ? charConfig.id : "none");

    if (charConfig && charConfig.id) {
      // Wait for BOTH parent origin AND existing player mesh before swapping.
      // This ensures the swap reuses the existing physics body (no split-brain).
      var _originWaitCount = 0;
      var _originWait = setInterval(function() {
        _originWaitCount++;
        var hasOrigin = !!_vibexeOrigin || _originWaitCount > 30;
        var hasPlayer = !!window.__vibexe_playerMesh__;
        if (_originWaitCount % 10 === 0) {
          console.log("[CharacterSystem] Auto-init poll #" + _originWaitCount + " origin:" + hasOrigin + " player:" + hasPlayer);
        }
        if (hasOrigin && hasPlayer) {
          clearInterval(_originWait);
          if (!_vibexeOrigin) {
            console.warn("[CharacterSystem] Origin not received from parent, swap may fail");
          }
          console.log("[CharacterSystem] Auto-init: origin + player ready, swapping to", charConfig.id);
          manager.swap(charConfig.id);
        } else if (_originWaitCount > 150) {
          // 15s hard timeout — swap anyway (better than never loading)
          clearInterval(_originWait);
          console.warn("[CharacterSystem] Auto-init timeout. origin:" + hasOrigin + " player:" + hasPlayer + " — swapping anyway");
          manager.swap(charConfig.id);
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
  CharacterManager: CharacterManager
};
`;

export const CHARACTER_SYSTEM_MANIFEST: ModuleManifest = {
	id: "character-system",
	name: "Character System",
	version: "3.0.0",
	category: "tools",
	description:
		"Player character selection, swapping, and animation management",
	icon: "PersonStanding",
	assets: [],
	runtimeCode,
	bridgeHandlers: {
		"character-system-swap": "handleSwap",
		"character-system-get-registry": "handleGetRegistry",
	},
	defaultSettings: {
		characterId: "warrior",
		groundOffset: 0,
		scale: 1.0,
	},
};
