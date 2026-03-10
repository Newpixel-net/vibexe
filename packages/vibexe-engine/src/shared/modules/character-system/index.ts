/**
 * Character System Module — Manifest & Registration
 *
 * Manages player character selection, loading, and runtime swapping.
 * Characters are AI-generated 3D models (GLB) with skeletal animations.
 *
 * Features:
 * - Character registry (built-in + future database categories)
 * - Runtime character swapping (dispose old, load new, rebind physics)
 * - Self-contained GLTFLoader-based character loading (no dependency on game internals)
 * - Animation normalization (maps arbitrary clip names to standard slots)
 * - Auto-scaling to consistent height (1.5 world units)
 * - Ground offset correction (feet alignment with terrain/floor)
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
		thumbnail: "/api/app-builder/media-stock-3d/meshy-characters/Warrior_figure_Animations.glb",
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

const runtimeCode = `// @vibexe/character-system v2.0.0
// Self-contained character management — loads GLB via THREE.GLTFLoader directly
console.log('[CharacterSystem] Module v2 loaded');

var THREE = require('three');

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

// ===== ANIMATION CLASSIFIER =====
// Fuzzy match clip names to standard animation slots
function classifyAnimations(clips) {
  var map = {};
  var slotPatterns = {
    idle: ["idle", "stand", "breathing", "rest"],
    walk: ["walk", "locomotion", "step"],
    run: ["run", "sprint", "jog", "fast"],
    jump: ["jump", "leap", "hop"],
    attack: ["attack", "kick", "punch", "slash", "hit", "strike", "swing"],
    die: ["die", "death", "dead", "fall"],
    hit: ["hit", "hurt", "damage", "flinch", "react"],
    special: ["spin", "dance", "wave", "taunt", "emote", "special"]
  };

  for (var slot in slotPatterns) {
    if (!slotPatterns.hasOwnProperty(slot)) continue;
    var patterns = slotPatterns[slot];
    for (var p = 0; p < patterns.length; p++) {
      if (map[slot]) break;
      var pat = patterns[p].toLowerCase();
      for (var c = 0; c < clips.length; c++) {
        var name = clips[c].name.toLowerCase();
        if (name.indexOf(pat) !== -1) {
          map[slot] = clips[c];
          break;
        }
      }
    }
  }
  return map;
}

// ===== SELF-CONTAINED CHARACTER LOADER =====
// Uses THREE.GLTFLoader directly — no dependency on game internal functions
function loadCharacterGLB(scene, url, position) {
  var GLTFLoader = THREE.GLTFLoader;
  if (!GLTFLoader) {
    console.error("[CharacterSystem] GLTFLoader not available on THREE");
    return Promise.resolve(null);
  }

  var loader = new GLTFLoader();
  return new Promise(function(resolve, reject) {
    console.log("[CharacterSystem] Loading GLB:", url);
    loader.load(url, function(gltf) {
      var model = gltf.scene;

      // Measure raw size
      var rawBox = new THREE.Box3().setFromObject(model);
      var rawSize = rawBox.getSize(new THREE.Vector3());
      console.log("[CharacterSystem] Raw model size:", rawSize.x.toFixed(2), rawSize.y.toFixed(2), rawSize.z.toFixed(2));

      // Auto-upright: if Z is tallest dimension, model is Z-up — rotate -90 on X
      if (rawSize.z > rawSize.y * 1.2 && rawSize.z > rawSize.x) {
        model.rotation.x = -Math.PI / 2;
        console.log("[CharacterSystem] Auto-upright: rotated -90 on X (Z-up model)");
        // Recalculate after rotation
        model.updateMatrixWorld(true);
        rawBox.setFromObject(model);
        rawSize = rawBox.getSize(new THREE.Vector3());
      }

      // Auto-scale to 1.5 world units height
      var targetHeight = 1.5;
      var currentHeight = rawSize.y;
      if (currentHeight > 0) {
        var scaleFactor = targetHeight / currentHeight;
        model.scale.multiplyScalar(scaleFactor);
        console.log("[CharacterSystem] Auto-scale:", scaleFactor.toFixed(3), "(" + currentHeight.toFixed(2) + " -> " + targetHeight + " units)");
      }

      // Position
      model.position.set(position.x, position.y, position.z);

      // Fix materials for proper lighting
      model.traverse(function(child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.needsUpdate = true;
          }
        }
      });

      // Add to scene
      scene.add(model);

      // Animation mixer
      var mixer = new THREE.AnimationMixer(model);
      var clips = gltf.animations || [];

      // Classify animations
      var animMap = classifyAnimations(clips);
      console.log("[CharacterSystem] Animations:", clips.length, "clips. Mapped:", Object.keys(animMap).join(", "));

      // Play idle if available
      var currentAction = null;
      if (animMap.idle) {
        currentAction = mixer.clipAction(animMap.idle);
        currentAction.play();
      } else if (clips.length > 0) {
        currentAction = mixer.clipAction(clips[0]);
        currentAction.play();
      }

      // Final bounding box for physics
      model.updateMatrixWorld(true);
      var finalBox = new THREE.Box3().setFromObject(model);
      var finalSize = finalBox.getSize(new THREE.Vector3());

      // Animation playback helpers
      var result = {
        mesh: model,
        mixer: mixer,
        clips: clips,
        animMap: animMap,
        size: finalSize,
        currentAction: currentAction,
        play: function(slotName) {
          var clip = animMap[slotName];
          if (!clip) return;
          var newAction = mixer.clipAction(clip);
          if (newAction === result.currentAction) return;
          if (result.currentAction) {
            result.currentAction.fadeOut(0.2);
          }
          newAction.reset().fadeIn(0.2).play();
          result.currentAction = newAction;
        },
        stop: function() {
          mixer.stopAllAction();
          result.currentAction = null;
        }
      };

      console.log("[CharacterSystem] Character loaded. Size:", finalSize.x.toFixed(2) + "x" + finalSize.y.toFixed(2) + "x" + finalSize.z.toFixed(2));
      resolve(result);
    }, function(progress) {
      // Progress callback — silent
    }, function(err) {
      console.error("[CharacterSystem] GLB load failed:", err);
      reject(err);
    });
  });
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
  this._mixerRAF = null; // requestAnimationFrame ID for mixer updates
  this._lastTime = 0;
  console.log("[CharacterSystem] Manager created, registry:", this._registry.getAll().length, "characters");
}

CharacterManager.prototype.getRegistry = function() {
  return this._registry;
};

CharacterManager.prototype.getActiveId = function() {
  return this._activeId;
};

CharacterManager.prototype.getActiveMesh = function() {
  return this._activeMesh;
};

// Start animation mixer update loop
CharacterManager.prototype._startMixerLoop = function() {
  var self = this;
  if (this._mixerRAF) return; // already running

  this._lastTime = performance.now();
  function tick() {
    self._mixerRAF = requestAnimationFrame(tick);
    var now = performance.now();
    var dt = (now - self._lastTime) / 1000;
    self._lastTime = now;
    if (dt > 0.1) dt = 0.1; // clamp

    if (self._activeResult && self._activeResult.mixer) {
      self._activeResult.mixer.update(dt);
    }

    // Sync mesh position to physics body
    if (self._physicsBody && self._activeMesh) {
      self._activeMesh.position.x = self._physicsBody.position.x;
      self._activeMesh.position.y = self._physicsBody.position.y;
      self._activeMesh.position.z = self._physicsBody.position.z;
    }
  }
  tick();
};

CharacterManager.prototype._stopMixerLoop = function() {
  if (this._mixerRAF) {
    cancelAnimationFrame(this._mixerRAF);
    this._mixerRAF = null;
  }
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
    // First swap — grab position and physics from the existing player (Lily)
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

  // 3. Also remove the legacy player mesh (Lily) if it exists and isn't ours
  var legacyMesh = window.__vibexe_playerMesh__;
  if (legacyMesh && legacyMesh !== this._activeMesh) {
    console.log("[CharacterSystem] Removing legacy player mesh:", legacyMesh.name || "unnamed");
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

  // 4. Build model URL
  var baseUrl = "";
  if (typeof window !== "undefined" && window.location) {
    baseUrl = window.location.origin;
  }
  var modelUrl = baseUrl + "/api/app-builder/media-stock-3d/" + charDef.pack + "/" + charDef.model;

  // 5. Load new character using self-contained GLTFLoader
  return loadCharacterGLB(scene, modelUrl, spawnPos)
    .then(function(charResult) {
      if (!charResult) {
        self._swapping = false;
        return false;
      }

      self._activeResult = charResult;
      self._activeMesh = charResult.mesh;
      self._activeId = characterId;

      // Apply ground offset
      if (charDef.groundOffset && charResult.mesh) {
        charResult.mesh.position.y += charDef.groundOffset;
      }

      // Register player mesh globally (game loop reads this for physics sync)
      window.__vibexe_playerMesh__ = charResult.mesh;

      // 6. Reuse existing physics body or create new one
      if (existingBody) {
        // Reuse the existing body — just link it to the new mesh
        self._physicsBody = existingBody;
        charResult.mesh.userData.__physicsBody = existingBody;
        console.log("[CharacterSystem] Reusing existing physics body");
      } else {
        // Create new physics body using CANNON if available
        var CANNON = window.CANNON;
        var world = window.__vibexe_world__;
        if (CANNON && world) {
          var halfX = Math.max(charResult.size.x / 2, 0.2);
          var halfY = Math.max(charResult.size.y / 2, 0.3);
          var halfZ = Math.max(charResult.size.z / 2, 0.2);
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

      // 7. Start animation mixer update loop
      self._startMixerLoop();

      // 8. Hook into keyboard for animation state
      self._setupAnimationSync(charResult);

      // 9. Store config for persistence
      var gs = window.__VIBEXE_GAME_SETTINGS__ || {};
      gs.character = {
        id: characterId,
        pack: charDef.pack,
        model: charDef.model,
        groundOffset: charDef.groundOffset || 0
      };
      window.__VIBEXE_GAME_SETTINGS__ = gs;

      console.log("[CharacterSystem] Swap complete:", charDef.name,
        "| animations:", charResult.clips ? charResult.clips.length : 0,
        "| size:", charResult.size ? (charResult.size.x.toFixed(2) + "x" + charResult.size.y.toFixed(2) + "x" + charResult.size.z.toFixed(2)) : "unknown");

      self._swapping = false;

      // Notify parent frame
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "vibexe-character-swapped",
          characterId: characterId,
          characterName: charDef.name
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

// Sync animation state with keyboard input (walk/idle/jump)
CharacterManager.prototype._setupAnimationSync = function(charResult) {
  if (this._animSyncInterval) clearInterval(this._animSyncInterval);

  var self = this;
  var lastAnim = "idle";
  this._animSyncInterval = setInterval(function() {
    if (!self._physicsBody || !charResult) return;

    var vx = self._physicsBody.velocity.x;
    var vy = self._physicsBody.velocity.y;
    var vz = self._physicsBody.velocity.z;
    var speed = Math.sqrt(vx * vx + vz * vz);
    var vertSpeed = vy;

    var newAnim = "idle";
    if (vertSpeed > 2) {
      newAnim = "jump";
    } else if (speed > 1.5) {
      newAnim = speed > 5 ? "run" : "walk";
    }

    if (newAnim !== lastAnim) {
      charResult.play(newAnim);
      lastAnim = newAnim;
    }
  }, 100);
};

CharacterManager.prototype._disposeActive = function() {
  // Stop mixer loop
  this._stopMixerLoop();

  // Stop animation sync
  if (this._animSyncInterval) {
    clearInterval(this._animSyncInterval);
    this._animSyncInterval = null;
  }

  // Stop animations
  if (this._activeResult && this._activeResult.stop) {
    try { this._activeResult.stop(); } catch(e) {}
  }

  // Remove mesh from scene (but DON'T remove physics body — we might reuse it)
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
};

// ===== MODULE INITIALIZATION =====

// Listen for character swap messages from parent frame
if (typeof window !== "undefined") {
  window.addEventListener("message", function(ev) {
    if (!ev.data) return;

    if (ev.data.type === "character-system-swap") {
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
// Wait for scene to be available (no longer needs factory functions)
(function() {
  if (typeof window === "undefined") return;

  var _initAttempts = 0;
  var _initInterval = setInterval(function() {
    _initAttempts++;
    if (_initAttempts > 30) { clearInterval(_initInterval); return; }

    var scene = window.__vibexe_scene__;
    if (_initAttempts <= 3 || _initAttempts % 5 === 0) {
      console.log('[CharacterSystem] Poll #' + _initAttempts + ' scene:', !!scene);
    }
    if (!scene) return;

    clearInterval(_initInterval);

    // Create the manager
    var manager = new CharacterManager(scene);

    // Register on window
    if (!window.__vibexe_modules__) window.__vibexe_modules__ = {};
    window.__vibexe_modules__["character-system"] = {
      CharacterRegistry: CharacterRegistry,
      CharacterManager: CharacterManager,
      manager: manager
    };

    // Check if there's a character config to auto-load
    var gs = window.__VIBEXE_GAME_SETTINGS__ || {};
    var charConfig = gs.character;

    console.log("[CharacterSystem] Auto-init. charConfig:", charConfig ? charConfig.id : "none");

    // Only auto-swap if there's an explicit character config saved
    // (user previously selected a character via the UI)
    if (charConfig && charConfig.id) {
      setTimeout(function() {
        manager.swap(charConfig.id);
      }, 1000);
    } else {
      console.log("[CharacterSystem] No character config — standing by for user selection");
    }

  }, 2000);
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
	version: "2.0.0",
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
