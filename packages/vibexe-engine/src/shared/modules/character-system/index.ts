/**
 * Character System Module — Manifest & Registration
 *
 * Manages player character selection, loading, and runtime swapping.
 * Characters are AI-generated 3D models (GLB) with skeletal animations.
 *
 * Features:
 * - Character registry (built-in + future database categories)
 * - Runtime character swapping (dispose old, load new, rebind physics)
 * - Animation normalization (maps arbitrary clip names to standard slots)
 * - Auto-scaling to consistent height (1.5 world units)
 * - Ground offset correction (feet alignment with terrain/floor)
 * - Physics body recreation on swap
 */

import type { ModuleManifest } from "../module-types";

/**
 * Built-in character registry.
 * Format: { id, name, pack, model, animations, groundOffset, thumbnail }
 *
 * `animations` maps standard slots to fuzzy search terms.
 * The runtime uses the existing fuzzy matcher in createAnimatedCharacter3D.
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

const runtimeCode = `// @vibexe/character-system v1.0.0
// Player character management — selection, loading, swapping, animation normalization

var THREE = require('three');

// ===== CHARACTER REGISTRY =====
var _builtInCharacters = ${BUILT_IN_CHARACTERS};
var _customCharacters = []; // Future: loaded from database

function CharacterRegistry() {
  this._characters = {};
  // Load built-in characters
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

// ===== CHARACTER MANAGER =====
// Handles the active character: loading, swapping, physics, animation

function CharacterManager(scene) {
  this._scene = scene;
  this._registry = new CharacterRegistry();
  this._activeId = null;
  this._activeMesh = null;
  this._activeController = null;
  this._activeResult = null; // { mesh, mixer, clips, play, stop, size }
  this._physicsBody = null;
  this._swapping = false;
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

CharacterManager.prototype.getActiveController = function() {
  return this._activeController;
};

// Swap to a new character by ID
// Returns a Promise that resolves when the swap is complete
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

  // 1. Capture old position if we have an active character
  if (this._physicsBody) {
    spawnPos = {
      x: this._physicsBody.position.x,
      y: this._physicsBody.position.y + 1,
      z: this._physicsBody.position.z
    };
  }

  // 2. Dispose old character
  this._disposeActive();

  // 3. Build model URL
  var baseUrl = "";
  if (typeof window !== "undefined" && window.location) {
    baseUrl = window.location.origin;
  }
  var modelUrl = baseUrl + "/api/app-builder/media-stock-3d/" + charDef.pack + "/" + charDef.model;

  // 4. Load new character using the existing createAnimatedCharacter3D
  var createChar = null;
  var createCtrl = null;
  var createPhys = null;

  // Access the game's factory functions from window globals
  if (typeof window !== "undefined") {
    createChar = window.__vibexe_createAnimatedCharacter3D;
    createCtrl = window.__vibexe_createCharacterController3D;
    createPhys = window.__vibexe_createPhysicsBody;
  }

  if (!createChar) {
    console.error("[CharacterSystem] createAnimatedCharacter3D not available on window");
    self._swapping = false;
    return Promise.resolve(false);
  }

  return createChar(scene, spawnPos.x, spawnPos.y, spawnPos.z, { url: modelUrl })
    .then(function(charResult) {
      self._activeResult = charResult;
      self._activeMesh = charResult.mesh;
      self._activeId = characterId;

      // Apply ground offset
      if (charDef.groundOffset && charResult.mesh) {
        charResult.mesh.position.y += charDef.groundOffset;
      }

      // Register player mesh globally
      window.__vibexe_playerMesh__ = charResult.mesh;

      // 5. Create physics body
      var world = window.__vibexe_world__;
      if (createPhys && world) {
        var body = createPhys("box", 5, spawnPos, charResult.size);
        if (body) {
          body.linearDamping = 0.9;
          body.angularDamping = 1.0;
          body.fixedRotation = true;
          world.addBody(body);
          self._physicsBody = body;

          // Link to mesh
          if (charResult.mesh) {
            charResult.mesh.userData.__physicsBody = body;
          }
        }
      }

      // 6. Create animation controller
      if (createCtrl && self._physicsBody) {
        self._activeController = createCtrl(charResult, self._physicsBody);
      }

      // 7. Store config for persistence
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

CharacterManager.prototype._disposeActive = function() {
  // Stop animations
  if (this._activeResult && this._activeResult.stop) {
    try { this._activeResult.stop(); } catch(e) {}
  }

  // Remove physics body from world
  if (this._physicsBody) {
    var world = window.__vibexe_world__;
    if (world) {
      try { world.removeBody(this._physicsBody); } catch(e) {}
    }
    this._physicsBody = null;
  }

  // Remove mesh from scene
  if (this._activeMesh && this._scene) {
    this._scene.remove(this._activeMesh);

    // Dispose geometries and materials
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
  this._activeController = null;
  this._activeId = null;
};

// Update controller each frame (called from game loop)
CharacterManager.prototype.update = function(dt) {
  if (this._activeController && this._activeController.update) {
    this._activeController.update(dt);
  }
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
// If character config exists in game settings, load it on startup
(function() {
  if (typeof window === "undefined") return;

  // Wait for scene and factories to be available
  var _initAttempts = 0;
  var _initInterval = setInterval(function() {
    _initAttempts++;
    if (_initAttempts > 30) { clearInterval(_initInterval); return; } // 60s max

    var scene = window.__vibexe_scene__;
    var createChar = window.__vibexe_createAnimatedCharacter3D;
    if (!scene || !createChar) return;

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
    var charId = charConfig && charConfig.id ? charConfig.id : "warrior";

    console.log("[CharacterSystem] Auto-init with character:", charId);

    // Don't auto-swap if a player mesh already exists (Lily from old template)
    // The character system will take over once explicitly activated
    if (!window.__vibexe_playerMesh__ || (charConfig && charConfig.id)) {
      // Small delay to let the scene finish loading
      setTimeout(function() {
        // Check if player mesh was already loaded by old code
        if (window.__vibexe_playerMesh__ && !charConfig) {
          console.log("[CharacterSystem] Player already loaded by legacy code, standing by");
          return;
        }
        manager.swap(charId);
      }, 500);
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
	version: "1.0.0",
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
