-- Feature Bank Gameplay Features — 6 new features for combat, boss, NPC, controls, progression
-- Extends the core 8 features to enable complex game modifications via AI
--
-- Run: PGPASSWORD=V1bexe2026Pg psql -h 127.0.0.1 -U vibexe -d vibexe -f /opt/vibexe/tools/seed-gameplay-features.sql
--
-- Uses ON CONFLICT to be idempotent (safe to re-run).


-- ============================================================================
-- 1. CHARACTER-ANIMATION-CONTROLS — Maps keys to character sprite animations
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'character-animation-controls',
  'Character Animation Controls',
  'Maps keyboard keys to character sprite animations (attack, kick, 360_kick, run). Auto-detects available animations from _sheetCache hero. Blocks player-platformer animation while acting.',
  'Core/Animation',
  'instruction',
  '2d',
  '1.0.0',
  '["animation","attack","kick","combat","sprite","controls","action"]',
  '[
    {"name":"attackKey","type":"string","default":"x","description":"Key for attack animation"},
    {"name":"kickKey","type":"string","default":"c","description":"Key for kick animation"},
    {"name":"spinKey","type":"string","default":"v","description":"Key for spin/360 kick animation"}
  ]',
  '["player-platformer"]',
  '["platformer","fighter","action"]',
$$function create(config) {
  var attackKey = config.attackKey || 'x';
  var kickKey = config.kickKey || 'c';
  var spinKey = config.spinKey || 'v';
  var _engine = null;
  var _isActing = false;
  var _heroSheet = null;
  var _availableAnims = {};

  // Map keys to animation names (try multiple naming conventions)
  var KEY_MAP = {};
  KEY_MAP[attackKey] = ['attack', 'punch', 'slash', 'hit'];
  KEY_MAP[kickKey] = ['kick', 'high_kick', 'highkick'];
  KEY_MAP[spinKey] = ['360_kick', '360kick', 'spin', 'special'];

  function findAnim(names) {
    if (!_heroSheet || !_heroSheet.animations) return null;
    for (var i = 0; i < names.length; i++) {
      if (_heroSheet.animations[names[i]]) return names[i];
    }
    return null;
  }

  function playAction(sprite, animName, actionType) {
    if (_isActing || !_heroSheet || !_heroSheet.animations[animName]) return;
    _isActing = true;
    sprite.textures = _heroSheet.animations[animName];
    sprite.loop = false;
    sprite.animationSpeed = 0.25;
    sprite.onComplete = function() {
      _isActing = false;
      // Return to idle
      var idleAnim = _heroSheet.animations['idle'];
      if (idleAnim) {
        sprite.textures = idleAnim;
        sprite.loop = true;
        sprite.animationSpeed = 0.10;
        sprite.play();
      }
      sprite.onComplete = null;
    };
    sprite.gotoAndPlay(0);

    // Emit attack event for combat system / boss to listen
    if (_engine) {
      var player = null;
      var pf = _engine.features.get('player-platformer');
      if (pf && pf.getPlayer) player = pf.getPlayer();
      _engine.features.emit('player.attack', {
        type: actionType,
        x: player ? player.sprite.x : 0,
        y: player ? player.sprite.y : 0,
        damage: 1
      });
    }
  }

  return {
    id: 'character-animation-controls',
    init: function(engine) {
      _engine = engine;
      _heroSheet = (typeof _sheetCache !== 'undefined' && _sheetCache) ? _sheetCache['hero'] : null;
      if (_heroSheet && _heroSheet.animations) {
        var keys = Object.keys(_heroSheet.animations);
        for (var i = 0; i < keys.length; i++) {
          _availableAnims[keys[i]] = true;
        }
        console.log('[anim-controls] Available animations: ' + keys.join(', '));
      }
    },
    update: function(engine, dt) {
      var pf = engine.features.get('player-platformer');
      if (!pf || !pf.getPlayer) return;
      var p = pf.getPlayer();
      if (!p || !p.sprite) return;
      var sprite = p.sprite;

      // Block platformer from overriding animation while acting
      if (_isActing) {
        if (pf._isActing !== undefined) pf._isActing = true;
        return;
      } else {
        if (pf._isActing !== undefined) pf._isActing = false;
      }

      // Check action keys
      var allKeys = Object.keys(KEY_MAP);
      for (var k = 0; k < allKeys.length; k++) {
        var key = allKeys[k];
        if (engine.input.wasPressed(key)) {
          var animName = findAnim(KEY_MAP[key]);
          if (animName) {
            playAction(sprite, animName, KEY_MAP[key][0]);
            return;
          }
        }
      }

      // Run animation: if shift held and moving horizontally
      if (!_isActing && _heroSheet && _heroSheet.animations['run']) {
        var moving = engine.input.left || engine.input.right;
        var sprinting = engine.input.isDown('shift');
        if (moving && sprinting && sprite.textures !== _heroSheet.animations['run']) {
          sprite.textures = _heroSheet.animations['run'];
          sprite.loop = true;
          sprite.animationSpeed = 0.18;
          sprite.play();
        }
      }
    },
    isActing: function() { return _isActing; },
    onEvent: function(event, data) {},
    destroy: function() {
      _engine = null;
      _heroSheet = null;
      _isActing = false;
    }
  };
}$$,
  true, true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  parameters = EXCLUDED.parameters,
  dependencies = EXCLUDED.dependencies,
  code = EXCLUDED.code,
  is_verified = EXCLUDED.is_verified,
  updated_at = NOW();


-- ============================================================================
-- 2. COMBAT-SYSTEM — Player health, invincibility, damage, death
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'combat-system',
  'Combat System',
  'Manages player health, invincibility frames after damage, damage flash effect, and death sequence. Provides health bar UI and emits player.died event.',
  'Core/Combat',
  'instruction',
  '2d',
  '1.0.0',
  '["health","damage","combat","invincibility","death","hp","hearts"]',
  '[
    {"name":"maxHealth","type":"number","default":3,"min":1,"max":20,"description":"Maximum player health"},
    {"name":"invDuration","type":"number","default":1.5,"min":0.5,"max":5,"description":"Invincibility duration after hit (seconds)"},
    {"name":"flashRate","type":"number","default":0.1,"min":0.05,"max":0.5,"description":"Flash rate during invincibility (seconds)"}
  ]',
  '["player-platformer"]',
  '["platformer","action","fighter","shooter"]',
$$function create(config) {
  var maxHP = config.maxHealth || 3;
  var invDuration = config.invDuration || 1.5;
  var flashRate = config.flashRate || 0.1;
  var hp = maxHP;
  var invTimer = 0;
  var flashTimer = 0;
  var dead = false;
  var _engine = null;
  var healthBar = null;

  return {
    id: 'combat-system',
    init: function(engine) {
      _engine = engine;
      hp = maxHP;
      dead = false;
      invTimer = 0;
      // Create health bar UI in top-left
      if (engine.ui && engine.ui.healthBar) {
        healthBar = engine.ui.healthBar(20, 20, {
          maxHealth: maxHP,
          width: 120,
          height: 16,
          color: 0xFF3333
        });
      }
    },
    update: function(engine, dt) {
      if (dead) return;

      // Handle invincibility timer and flash
      if (invTimer > 0) {
        invTimer -= dt;
        flashTimer -= dt;
        var pf = engine.features.get('player-platformer');
        var p = pf && pf.getPlayer ? pf.getPlayer() : null;
        if (p && p.sprite) {
          if (flashTimer <= 0) {
            p.sprite.alpha = p.sprite.alpha < 0.5 ? 1.0 : 0.3;
            flashTimer = flashRate;
          }
        }
        // End invincibility
        if (invTimer <= 0) {
          invTimer = 0;
          if (p && p.sprite) p.sprite.alpha = 1.0;
        }
      }
    },
    onEvent: function(event, data) {
      if (event === 'player.take-damage' && !dead && invTimer <= 0) {
        var dmg = (data && data.damage) || 1;
        hp -= dmg;
        if (hp < 0) hp = 0;
        if (healthBar && healthBar.setHealth) healthBar.setHealth(hp);

        // Start invincibility
        invTimer = invDuration;
        flashTimer = 0;

        // Camera shake and juice
        if (_engine) {
          if (_engine.camera && _engine.camera.shake) _engine.camera.shake(6, 0.3);
          if (_engine.juice && _engine.juice.hitPause) _engine.juice.hitPause(_engine.app, 80);
        }

        // Check for death
        if (hp <= 0) {
          dead = true;
          var pf = _engine && _engine.features.get('player-platformer');
          var p = pf && pf.getPlayer ? pf.getPlayer() : null;
          if (p && p.sprite) {
            p.sprite.alpha = 1.0;
            // Try die animation
            var heroSheet = (typeof _sheetCache !== 'undefined' && _sheetCache) ? _sheetCache['hero'] : null;
            if (heroSheet && heroSheet.animations && heroSheet.animations['die']) {
              p.sprite.textures = heroSheet.animations['die'];
              p.sprite.loop = false;
              p.sprite.animationSpeed = 0.15;
              p.sprite.gotoAndPlay(0);
            }
          }
          if (_engine) _engine.features.emit('player.died', { hp: 0 });
        }
      }
      if (event === 'health.restore' && !dead) {
        var heal = (data && data.amount) || 1;
        hp = Math.min(hp + heal, maxHP);
        if (healthBar && healthBar.setHealth) healthBar.setHealth(hp);
        if (_engine && _engine.effects && _engine.effects.sparkle) {
          var pf = _engine.features.get('player-platformer');
          var p = pf && pf.getPlayer ? pf.getPlayer() : null;
          if (p && p.sprite) _engine.effects.sparkle(p.sprite.x, p.sprite.y);
        }
      }
    },
    getHP: function() { return hp; },
    getMaxHP: function() { return maxHP; },
    isDead: function() { return dead; },
    destroy: function() {
      _engine = null;
      healthBar = null;
    }
  };
}$$,
  true, true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  parameters = EXCLUDED.parameters,
  dependencies = EXCLUDED.dependencies,
  code = EXCLUDED.code,
  is_verified = EXCLUDED.is_verified,
  updated_at = NOW();


-- ============================================================================
-- 3. BOSS-ENCOUNTER — Boss enemy with health bar, AI, attack patterns
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'boss-encounter',
  'Boss Encounter',
  'Spawns a boss enemy with health bar, simple charge AI, and defeat sequence. Responds to player.attack events and emits boss.defeated on death.',
  'Enemies/Boss',
  'instruction',
  '2d',
  '1.0.0',
  '["boss","enemy","fight","battle","health","ai","encounter"]',
  '[
    {"name":"health","type":"number","default":10,"min":3,"max":50,"description":"Boss total health"},
    {"name":"speed","type":"number","default":80,"min":30,"max":200,"description":"Boss movement speed"},
    {"name":"damage","type":"number","default":2,"min":1,"max":10,"description":"Damage dealt to player"},
    {"name":"bossX","type":"number","default":3000,"min":500,"max":8000,"description":"Boss X spawn position"},
    {"name":"bossY","type":"number","default":700,"min":200,"max":1600,"description":"Boss Y spawn position"},
    {"name":"rewardScore","type":"number","default":1000,"min":100,"max":10000,"description":"Score awarded on defeat"}
  ]',
  '["player-platformer"]',
  '["platformer","action","fighter"]',
$$function create(config) {
  var bossHP = config.health || 10;
  var maxHP = bossHP;
  var speed = config.speed || 80;
  var damage = config.damage || 2;
  var bossX = config.bossX || 3000;
  var bossY = config.bossY || 700;
  var rewardScore = config.rewardScore || 1000;
  var _engine = null;
  var bossSprite = null;
  var bossBar = null;
  var defeated = false;
  var chargeTimer = 3;
  var isCharging = false;
  var chargeDir = 0;
  var chargeDuration = 0;
  var hitCooldown = 0;
  var ATTACK_RANGE = 150;
  var AGGRO_RANGE = 400;

  function createBossGraphics() {
    var g = new PIXI.Graphics();
    // Body (large red rectangle)
    g.beginFill(0xCC2222);
    g.drawRoundedRect(-40, -100, 80, 100, 6);
    g.endFill();
    // Eyes
    g.beginFill(0xFFFF00);
    g.drawCircle(-14, -75, 8);
    g.drawCircle(14, -75, 8);
    g.endFill();
    // Pupils
    g.beginFill(0x000000);
    g.drawCircle(-14, -75, 4);
    g.drawCircle(14, -75, 4);
    g.endFill();
    // Mouth
    g.beginFill(0x000000);
    g.drawRect(-18, -52, 36, 6);
    g.endFill();
    return g;
  }

  return {
    id: 'boss-encounter',
    init: function(engine) {
      _engine = engine;
      defeated = false;
      bossHP = maxHP;

      // Create boss sprite (use _sheetCache if available, otherwise graphics)
      var bossSheet = (typeof _sheetCache !== 'undefined' && _sheetCache) ? _sheetCache['boss'] : null;
      if (bossSheet && bossSheet.animations && bossSheet.animations['idle']) {
        bossSprite = new PIXI.AnimatedSprite(bossSheet.animations['idle']);
        bossSprite.anchor.set(0.5, 1);
        bossSprite.animationSpeed = 0.12;
        bossSprite.play();
      } else {
        bossSprite = createBossGraphics();
      }
      bossSprite.x = bossX;
      bossSprite.y = bossY;
      engine.world.addChild(bossSprite);

      // Boss health bar at top center of screen
      if (engine.ui && engine.ui.healthBar) {
        var screenW = 800; try { screenW = engine.app.screen.width; } catch(e) {}
        bossBar = engine.ui.healthBar(screenW / 2 - 100, 10, {
          maxHealth: maxHP,
          width: 200,
          height: 12,
          color: 0xFF0000
        });
      }
    },
    update: function(engine, dt) {
      if (defeated || !bossSprite) return;

      // Get player position
      var pf = engine.features.get('player-platformer');
      var p = pf && pf.getPlayer ? pf.getPlayer() : null;
      if (!p || !p.sprite) return;
      var px = p.sprite.x;
      var py = p.sprite.y;
      var dist = Math.abs(px - bossSprite.x);

      // Hit cooldown (prevent rapid damage)
      if (hitCooldown > 0) hitCooldown -= dt;

      // Charge attack pattern
      if (isCharging) {
        bossSprite.x += chargeDir * speed * 2.5 * dt;
        chargeDuration -= dt;
        if (chargeDuration <= 0) isCharging = false;
        // Check collision with player during charge
        if (dist < 60 && hitCooldown <= 0) {
          engine.features.emit('player.take-damage', { damage: damage, source: 'boss' });
          hitCooldown = 1.0;
        }
        return;
      }

      // AI: move toward player when in aggro range
      if (dist < AGGRO_RANGE && dist > 60) {
        var dir = px < bossSprite.x ? -1 : 1;
        bossSprite.x += dir * speed * dt;
        // Flip sprite to face player
        if (bossSprite.scale) {
          bossSprite.scale.x = dir < 0 ? -Math.abs(bossSprite.scale.x || 1) : Math.abs(bossSprite.scale.x || 1);
        }
      }

      // Charge timer
      chargeTimer -= dt;
      if (chargeTimer <= 0 && dist < AGGRO_RANGE) {
        isCharging = true;
        chargeDir = px < bossSprite.x ? -1 : 1;
        chargeDuration = 0.6;
        chargeTimer = 3 + Math.random() * 2;
      }

      // Proximity damage
      if (dist < 50 && hitCooldown <= 0) {
        engine.features.emit('player.take-damage', { damage: 1, source: 'boss' });
        hitCooldown = 1.0;
      }
    },
    onEvent: function(event, data) {
      if (event === 'player.attack' && !defeated && bossSprite) {
        // Check if attack is within range of boss
        var ax = (data && data.x) || 0;
        var dist = Math.abs(ax - bossSprite.x);
        if (dist < ATTACK_RANGE) {
          var dmg = (data && data.damage) || 1;
          bossHP -= dmg;
          if (bossBar && bossBar.setHealth) bossBar.setHealth(Math.max(0, bossHP));

          // Flash boss on hit
          if (_engine && _engine.juice) {
            if (_engine.juice.flash) _engine.juice.flash(bossSprite, 0xFFFFFF, 0.15);
            if (_engine.juice.pop) _engine.juice.pop(bossSprite);
          }
          if (_engine && _engine.camera && _engine.camera.shake) _engine.camera.shake(3, 0.15);

          // Check defeat
          if (bossHP <= 0) {
            defeated = true;
            if (_engine && _engine.effects) {
              if (_engine.effects.explosion) _engine.effects.explosion(bossSprite.x, bossSprite.y);
              if (_engine.effects.sparkle) _engine.effects.sparkle(bossSprite.x, bossSprite.y);
            }
            bossSprite.visible = false;
            if (_engine) {
              _engine.features.emit('boss.defeated', { score: rewardScore });
              _engine.features.emit('score.add', { amount: rewardScore });
            }
          }
        }
      }
    },
    getHealth: function() { return bossHP; },
    isDefeated: function() { return defeated; },
    destroy: function() {
      if (bossSprite && bossSprite.parent) bossSprite.parent.removeChild(bossSprite);
      bossSprite = null;
      bossBar = null;
      _engine = null;
    }
  };
}$$,
  true, true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  parameters = EXCLUDED.parameters,
  dependencies = EXCLUDED.dependencies,
  code = EXCLUDED.code,
  is_verified = EXCLUDED.is_verified,
  updated_at = NOW();


-- ============================================================================
-- 4. NPC-SPAWN — Interactive NPC character with idle animation and dialog
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'npc-spawn',
  'NPC Spawn',
  'Spawns an NPC character with idle animation and an interaction prompt. Shows "Press E" when player is nearby, emits npc.interact event on keypress.',
  'Characters/NPC',
  'instruction',
  '2d',
  '1.0.0',
  '["npc","character","interact","dialog","quest","talk","friendly"]',
  '[
    {"name":"npcX","type":"number","default":400,"min":0,"max":8000,"description":"NPC X position in world"},
    {"name":"npcY","type":"number","default":700,"min":200,"max":1600,"description":"NPC Y position in world"},
    {"name":"interactKey","type":"string","default":"e","description":"Key to interact with NPC"},
    {"name":"interactRange","type":"number","default":100,"min":40,"max":300,"description":"Distance for interaction prompt to appear"}
  ]',
  '["player-platformer"]',
  '["platformer","rpg","adventure","puzzle"]',
$$function create(config) {
  var npcX = config.npcX || 400;
  var npcY = config.npcY || 700;
  var interactKey = config.interactKey || 'e';
  var interactRange = config.interactRange || 100;
  var npcSprite = null;
  var hintText = null;
  var _engine = null;
  var _interacted = false;

  function createNpcGraphics() {
    var g = new PIXI.Graphics();
    // Body (friendly blue character)
    g.beginFill(0x3388CC);
    g.drawRoundedRect(-18, -60, 36, 55, 8);
    g.endFill();
    // Head
    g.beginFill(0xFFDDAA);
    g.drawCircle(0, -70, 16);
    g.endFill();
    // Eyes
    g.beginFill(0x222222);
    g.drawCircle(-5, -73, 3);
    g.drawCircle(5, -73, 3);
    g.endFill();
    // Smile
    g.lineStyle(2, 0x222222);
    g.arc(0, -66, 6, 0.2, Math.PI - 0.2);
    g.lineStyle(0);
    // Hat
    g.beginFill(0x44AA44);
    g.drawRoundedRect(-14, -88, 28, 10, 3);
    g.drawRoundedRect(-20, -80, 40, 6, 2);
    g.endFill();
    return g;
  }

  return {
    id: 'npc-spawn',
    init: function(engine) {
      _engine = engine;
      _interacted = false;

      // Create NPC sprite (use _sheetCache if available)
      var npcSheet = (typeof _sheetCache !== 'undefined' && _sheetCache) ? _sheetCache['npc'] : null;
      if (npcSheet && npcSheet.animations && npcSheet.animations['idle']) {
        npcSprite = new PIXI.AnimatedSprite(npcSheet.animations['idle']);
        npcSprite.anchor.set(0.5, 1);
        npcSprite.animationSpeed = 0.08;
        npcSprite.play();
      } else {
        npcSprite = createNpcGraphics();
      }
      npcSprite.x = npcX;
      npcSprite.y = npcY;
      engine.world.addChild(npcSprite);

      // Interaction hint text (hidden initially)
      hintText = new PIXI.Text('Press ' + interactKey.toUpperCase(), {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0xFFFFFF,
        stroke: 0x000000,
        strokeThickness: 3,
        align: 'center'
      });
      hintText.anchor.set(0.5, 1);
      hintText.x = npcX;
      hintText.y = npcY - 100;
      hintText.visible = false;
      engine.world.addChild(hintText);
    },
    update: function(engine, dt) {
      if (!npcSprite) return;

      // Get player position
      var pf = engine.features.get('player-platformer');
      var p = pf && pf.getPlayer ? pf.getPlayer() : null;
      if (!p || !p.sprite) return;

      var dx = p.sprite.x - npcSprite.x;
      var dy = p.sprite.y - npcSprite.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      // Show/hide hint based on distance
      if (hintText) {
        hintText.visible = dist < interactRange;
        // Gentle bob animation for hint
        if (hintText.visible) {
          hintText.y = npcY - 100 + Math.sin(Date.now() * 0.004) * 4;
        }
      }

      // Check interaction
      if (dist < interactRange && engine.input.wasPressed(interactKey)) {
        _interacted = true;
        if (_engine) {
          _engine.features.emit('npc.interact', {
            npcX: npcSprite.x,
            npcY: npcSprite.y
          });
        }
        // Visual feedback
        if (_engine && _engine.juice && _engine.juice.pop) {
          _engine.juice.pop(npcSprite);
        }
        if (_engine && _engine.effects && _engine.effects.sparkle) {
          _engine.effects.sparkle(npcSprite.x, npcSprite.y - 40);
        }
      }

      // NPC faces player when nearby
      if (dist < interactRange * 1.5 && npcSprite.scale) {
        var faceDir = dx < 0 ? -1 : 1;
        npcSprite.scale.x = faceDir * Math.abs(npcSprite.scale.x || 1);
      }
    },
    hasInteracted: function() { return _interacted; },
    onEvent: function(event, data) {},
    destroy: function() {
      if (npcSprite && npcSprite.parent) npcSprite.parent.removeChild(npcSprite);
      if (hintText && hintText.parent) hintText.parent.removeChild(hintText);
      npcSprite = null;
      hintText = null;
      _engine = null;
    }
  };
}$$,
  true, true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  parameters = EXCLUDED.parameters,
  dependencies = EXCLUDED.dependencies,
  code = EXCLUDED.code,
  is_verified = EXCLUDED.is_verified,
  updated_at = NOW();


-- ============================================================================
-- 5. ADVANCED-CONTROLS — Action event emitter with key bindings and overlay
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'advanced-controls',
  'Advanced Controls',
  'Emits named action events from key presses. Creates a controls reference overlay on screen. Detects combos like down+attack for special moves.',
  'Core/Input',
  'instruction',
  '2d',
  '1.0.0',
  '["controls","input","keybindings","keys","actions","combo","overlay"]',
  '[]',
  '[]',
  '["platformer","fighter","action","shooter","rpg"]',
$$function create(config) {
  var bindings = {
    attack: 'x',
    kick: 'c',
    special: 'v',
    interact: 'e',
    block: 'q',
    dash: 'shift'
  };
  var overlayText = null;
  var _engine = null;
  var comboWindow = 0.15;
  var recentKeys = [];

  function buildOverlayString() {
    var lines = ['-- Controls --'];
    var keys = Object.keys(bindings);
    for (var i = 0; i < keys.length; i++) {
      var action = keys[i];
      var key = bindings[action].toUpperCase();
      lines.push(key + ' : ' + action);
    }
    lines.push('ARROWS : move/jump');
    return lines.join('\n');
  }

  return {
    id: 'advanced-controls',
    init: function(engine) {
      _engine = engine;

      // Create controls overlay in bottom-right of UI layer
      overlayText = new PIXI.Text(buildOverlayString(), {
        fontFamily: 'Courier New, monospace',
        fontSize: 11,
        fill: 0xCCCCCC,
        stroke: 0x000000,
        strokeThickness: 2,
        align: 'left',
        lineHeight: 15
      });
      overlayText.alpha = 0.6;

      // Position in bottom-right corner
      var screenW = 800; try { screenW = engine.app.screen.width; } catch(e) {}
      var screenH = 600; try { screenH = engine.app.screen.height; } catch(e) {}
      overlayText.x = screenW - overlayText.width - 10;
      overlayText.y = screenH - overlayText.height - 10;

      // Add to UI layer (fixed on screen, not scrolling)
      if (engine.uiLayer) {
        engine.uiLayer.addChild(overlayText);
      } else {
        engine.world.addChild(overlayText);
      }
    },
    update: function(engine, dt) {
      // Clean old keys from recent list
      var now = Date.now() / 1000;
      while (recentKeys.length > 0 && now - recentKeys[0].time > comboWindow) {
        recentKeys.shift();
      }

      // Check each binding for wasPressed
      var keys = Object.keys(bindings);
      for (var i = 0; i < keys.length; i++) {
        var action = keys[i];
        var key = bindings[action];
        if (engine.input.wasPressed(key)) {
          engine.features.emit('action.' + action, { key: key, action: action });
          recentKeys.push({ action: action, time: now });
        }
      }

      // Combo detection: down + attack = special-down
      if (recentKeys.length >= 2) {
        var last = recentKeys[recentKeys.length - 1];
        var prev = recentKeys[recentKeys.length - 2];
        if (last.action === 'attack' && engine.input.down) {
          engine.features.emit('action.special-down', { combo: true });
        }
        if (last.action === 'kick' && engine.input.down) {
          engine.features.emit('action.sweep', { combo: true });
        }
      }

      // Dash detection (hold direction + shift)
      if (engine.input.wasPressed('shift')) {
        var dir = engine.input.right ? 1 : (engine.input.left ? -1 : 0);
        if (dir !== 0) {
          engine.features.emit('action.dash', { direction: dir });
        }
      }
    },
    getBindings: function() { return bindings; },
    onEvent: function(event, data) {},
    destroy: function() {
      if (overlayText && overlayText.parent) overlayText.parent.removeChild(overlayText);
      overlayText = null;
      _engine = null;
      recentKeys = [];
    }
  };
}$$,
  true, true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  parameters = EXCLUDED.parameters,
  dependencies = EXCLUDED.dependencies,
  code = EXCLUDED.code,
  is_verified = EXCLUDED.is_verified,
  updated_at = NOW();


-- ============================================================================
-- 6. GAME-PROGRESSION — Win/lose tracking, lives, score, game over screen
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'game-progression',
  'Game Progression',
  'Tracks win/lose conditions, score, and lives. Shows victory or game over screens. Supports score-based and boss-based win conditions with restart on R key.',
  'Systems/Progression',
  'instruction',
  '2d',
  '1.0.0',
  '["progression","score","lives","gameover","victory","win","lose","restart"]',
  '[
    {"name":"winCondition","type":"select","default":"score","options":["score","boss"],"description":"What triggers a win"},
    {"name":"winThreshold","type":"number","default":1000,"min":100,"max":100000,"description":"Score needed to win (if winCondition is score)"},
    {"name":"maxLives","type":"number","default":3,"min":1,"max":10,"description":"Starting number of lives"}
  ]',
  '[]',
  '["platformer","action","shooter","runner","puzzle","rpg"]',
$$function create(config) {
  var winCondition = config.winCondition || 'score';
  var winThreshold = config.winThreshold || 1000;
  var maxLives = config.maxLives || 3;
  var lives = maxLives;
  var score = 0;
  var gameState = 'playing';
  var _engine = null;
  var scoreUI = null;
  var livesText = null;
  var endScreen = null;

  function updateLivesText() {
    if (livesText) {
      var hearts = '';
      for (var i = 0; i < lives; i++) hearts += '\u2764 ';
      for (var j = lives; j < maxLives; j++) hearts += '\u2661 ';
      livesText.text = hearts;
    }
  }

  function showEndScreen(engine, won) {
    if (endScreen) return;
    endScreen = new PIXI.Container();

    // Semi-transparent overlay
    var overlay = new PIXI.Graphics();
    var sw = 800; try { sw = engine.app.screen.width; } catch(e) {}
    var sh = 600; try { sh = engine.app.screen.height; } catch(e) {}
    overlay.beginFill(0x000000, 0.7);
    overlay.drawRect(0, 0, sw, sh);
    overlay.endFill();
    endScreen.addChild(overlay);

    // Title text
    var titleStr = won ? 'VICTORY!' : 'GAME OVER';
    var titleColor = won ? 0xFFDD00 : 0xFF3333;
    var title = new PIXI.Text(titleStr, {
      fontFamily: 'Arial',
      fontSize: 48,
      fontWeight: 'bold',
      fill: titleColor,
      stroke: 0x000000,
      strokeThickness: 4,
      align: 'center'
    });
    title.anchor.set(0.5, 0.5);
    title.x = sw / 2;
    title.y = sh / 2 - 40;
    endScreen.addChild(title);

    // Score text
    var scoreText = new PIXI.Text('Score: ' + score, {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xFFFFFF,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });
    scoreText.anchor.set(0.5, 0.5);
    scoreText.x = sw / 2;
    scoreText.y = sh / 2 + 20;
    endScreen.addChild(scoreText);

    // Restart hint (only on game over)
    if (!won) {
      var restart = new PIXI.Text('Press R to restart', {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0xAAAAAA,
        align: 'center'
      });
      restart.anchor.set(0.5, 0.5);
      restart.x = sw / 2;
      restart.y = sh / 2 + 60;
      endScreen.addChild(restart);
    }

    // Add to UI layer so it stays fixed
    if (engine.uiLayer) {
      engine.uiLayer.addChild(endScreen);
    } else {
      engine.world.addChild(endScreen);
    }
  }

  return {
    id: 'game-progression',
    init: function(engine) {
      _engine = engine;
      lives = maxLives;
      score = 0;
      gameState = 'playing';

      // Score display (top-right area)
      if (engine.ui && engine.ui.score) {
        var sw = 800; try { sw = engine.app.screen.width; } catch(e) {}
        scoreUI = engine.ui.score(sw - 160, 20, { prefix: 'Score: ', fontSize: 18 });
      }

      // Lives display (top-left, below health bar if present)
      livesText = new PIXI.Text('', {
        fontFamily: 'Arial',
        fontSize: 20,
        fill: 0xFF4444,
        stroke: 0x000000,
        strokeThickness: 2
      });
      livesText.x = 20;
      livesText.y = 44;
      updateLivesText();
      if (engine.uiLayer) {
        engine.uiLayer.addChild(livesText);
      }
    },
    update: function(engine, dt) {
      if (gameState !== 'playing') {
        // Listen for restart key on game over
        if (gameState === 'lost' && engine.input.wasPressed('r')) {
          // Reload the page to restart
          if (typeof window !== 'undefined' && window.location) {
            window.location.reload();
          }
        }
        return;
      }
    },
    onEvent: function(event, data) {
      if (gameState !== 'playing' && event !== 'game.restart') return;

      if (event === 'score.add' || event === 'coin.collected') {
        var amount = (data && data.amount) || (data && data.score) || 10;
        score += amount;
        if (scoreUI && scoreUI.setScore) scoreUI.setScore(score);

        // Check score-based win
        if (winCondition === 'score' && score >= winThreshold) {
          gameState = 'won';
          if (_engine) {
            _engine.features.emit('game.won', { score: score });
            showEndScreen(_engine, true);
          }
        }
      }

      if (event === 'boss.defeated' && winCondition === 'boss') {
        gameState = 'won';
        var bossScore = (data && data.score) || 0;
        score += bossScore;
        if (scoreUI && scoreUI.setScore) scoreUI.setScore(score);
        if (_engine) {
          _engine.features.emit('game.won', { score: score });
          showEndScreen(_engine, true);
        }
      }

      if (event === 'player.died') {
        lives -= 1;
        updateLivesText();
        if (lives <= 0) {
          gameState = 'lost';
          if (_engine) {
            _engine.features.emit('game.lost', { score: score, lives: 0 });
            showEndScreen(_engine, false);
          }
        } else {
          // Respawn (emit event for other features to handle)
          if (_engine) {
            _engine.features.emit('player.respawn', { livesRemaining: lives });
          }
        }
      }
    },
    getScore: function() { return score; },
    getLives: function() { return lives; },
    getState: function() { return gameState; },
    destroy: function() {
      if (livesText && livesText.parent) livesText.parent.removeChild(livesText);
      if (endScreen && endScreen.parent) endScreen.parent.removeChild(endScreen);
      livesText = null;
      endScreen = null;
      scoreUI = null;
      _engine = null;
    }
  };
}$$,
  true, true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  parameters = EXCLUDED.parameters,
  dependencies = EXCLUDED.dependencies,
  code = EXCLUDED.code,
  is_verified = EXCLUDED.is_verified,
  updated_at = NOW();
