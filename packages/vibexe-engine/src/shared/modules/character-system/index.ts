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

const runtimeCode = `// @vibexe/character-system v4.0.0
// Pure GLB loader & model swapper — no physics, no camera, no input
console.log('[CharacterSystem] Module v4 loaded');

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
function swapCharacter(scene, characterId) {
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

  return loadCharacterGLB(scene, modelUrl, spawnPos, charDef.name, charDef.model)
    .then(function(result) {
      if (!result) return false;

      // Remove old mesh from scene and dispose
      if (oldMesh) {
        // Remove old mixer from _activeMixers3D
        if (oldMesh.userData && oldMesh.userData.__mixer && window._activeMixers3D) {
          var mi = window._activeMixers3D.indexOf(oldMesh.userData.__mixer);
          if (mi !== -1) window._activeMixers3D.splice(mi, 1);
        }
        scene.remove(oldMesh);
        oldMesh.traverse(function(child) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(function(m) { if (m.map) m.map.dispose(); m.dispose(); });
            } else {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        });
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
        scene.remove(m);
        m.traverse(function(c) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
      });

      // Add new mesh to scene
      scene.add(result.mesh);

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

      // Set global reference — game template will detect this change on next frame
      window.__vibexe_playerMesh__ = result.mesh;

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
      return true;
    })
    .catch(function(err) {
      console.error("[CharacterSystem] Swap failed:", err);
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
        // Update bounds for physics
        if (mesh.userData.__characterBounds) {
          mesh.userData.__characterBounds.halfX *= s;
          mesh.userData.__characterBounds.halfZ *= s;
          mesh.userData.__characterBounds.height *= s;
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
	version: "4.0.0",
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
