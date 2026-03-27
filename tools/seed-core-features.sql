-- Feature Bank Core Features — 8 pre-tested gameplay subsystems
-- These replace AI writing game logic from scratch. AI composes features + adds custom visuals.
--
-- Run: PGPASSWORD=V1bexe2026Pg psql -h 127.0.0.1 -U vibexe -d vibexe -f /opt/vibexe/tools/seed-core-features.sql
--
-- Uses ON CONFLICT to be idempotent (safe to re-run).

-- ============================================================================
-- 1. VISUAL-LAYERS — Background visual stack (standalone, run first)
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'visual-layers',
  'Visual Layers',
  'Complete background visual stack: sky gradient, stars, mountains, clouds, ground, decorative trees. Configurable per theme.',
  'Core/Visuals',
  'instruction',
  '2d',
  '1.0.0',
  '["background","sky","mountains","clouds","ground","trees","visuals","scenery"]',
  '[
    {"name":"theme","type":"select","default":"forest","options":["forest","sunset","space","volcanic","candy","arctic","dark","ocean"],"description":"Color palette theme"},
    {"name":"worldWidth","type":"number","default":4000,"min":800,"max":10000,"description":"World width in pixels"},
    {"name":"worldHeight","type":"number","default":900,"min":400,"max":2000,"description":"World height in pixels"},
    {"name":"groundY","type":"number","default":840,"min":200,"max":1800,"description":"Ground Y position"},
    {"name":"treeCount","type":"number","default":8,"min":0,"max":30,"description":"Number of decorative trees"},
    {"name":"cloudCount","type":"number","default":6,"min":0,"max":20,"description":"Number of clouds"}
  ]',
  '[]',
  '["platformer","runner","shooter","puzzle"]',
$$function create(config) {
  var theme = config.theme || 'forest';
  var worldW = config.worldWidth || 4000;
  var worldH = config.worldHeight || 900;
  var groundY = config.groundY || (worldH - 60);
  var treeCount = config.treeCount || 8;
  var cloudCount = config.cloudCount || 6;
  var layerContainer = null;
  var cloudList = [];

  return {
    id: 'visual-layers',
    init: function(engine) {
      var PAL = PALETTES[theme] || PALETTES.forest;
      layerContainer = new PIXI.Container();

      // Sky gradient
      var sky = drawSkyGradient(worldW, worldH, PAL.skyTop, PAL.skyBottom);
      layerContainer.addChild(sky);

      // Stars for night/space themes
      if (theme === 'space' || theme === 'dark' || theme === 'arctic') {
        var stars = drawStars(worldW, worldH * 0.6, 200);
        layerContainer.addChild(stars);
      }

      // Mountain ranges (back to front, using palette mountain colors)
      var mtns = PAL.mountains || [];
      for (var i = 0; i < mtns.length; i++) {
        var mtn = drawMountainRange(worldW, groundY, mtns[i], 0.4 + i * 0.2,
          60 - i * 10, 160 - i * 30, 120 + i * 40, theme, i);
        layerContainer.addChild(mtn);
      }

      // Clouds
      for (var c = 0; c < cloudCount; c++) {
        var cloud = drawCloud(60 + Math.random() * 80, 30 + Math.random() * 30);
        cloud.x = Math.random() * worldW;
        cloud.y = 30 + Math.random() * (groundY * 0.3);
        cloud.alpha = 0.4 + Math.random() * 0.4;
        layerContainer.addChild(cloud);
        cloudList.push({ sprite: cloud, speed: 8 + Math.random() * 15 });
      }

      // Ground strip
      var ground = drawGroundStrip(worldW, groundY, 60, PAL.ground, PAL.groundTop, theme);
      layerContainer.addChild(ground);

      // Decorative trees
      var presets = TREE_PRESETS[theme] || ['oak'];
      if (presets.length > 0) {
        for (var t = 0; t < treeCount; t++) {
          var preset = presets[Math.floor(Math.random() * presets.length)];
          var tx = 100 + (worldW - 200) * (t / treeCount) + (Math.random() - 0.5) * 100;
          var tree = drawLSystemTree(tx, groundY, preset, theme, Math.floor(Math.random() * 9999));
          layerContainer.addChild(tree);
        }
      }

      // Insert behind scene content
      engine.world.addChildAt(layerContainer, 0);
    },
    update: function(engine, dt) {
      for (var i = 0; i < cloudList.length; i++) {
        cloudList[i].sprite.x += cloudList[i].speed * dt;
        if (cloudList[i].sprite.x > worldW + 100) cloudList[i].sprite.x = -100;
      }
    },
    getGroundY: function() { return groundY; },
    getPalette: function() { return PALETTES[theme] || PALETTES.forest; },
    destroy: function() {
      if (layerContainer && layerContainer.parent) layerContainer.parent.removeChild(layerContainer);
      layerContainer = null;
      cloudList = [];
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
-- 2. PLAYER-PLATFORMER — Complete player with physics, input, movement
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'player-platformer',
  'Player Platformer',
  'Complete player character: physics world, body, sprite, CharacterController with movement/jumping. Exposes getPlayer(), getPhysics(), getController() for other features.',
  'Core/Player',
  'instruction',
  '2d',
  '1.0.0',
  '["player","movement","jump","physics","controller","character","platformer"]',
  '[
    {"name":"moveSpeed","type":"number","default":280,"min":100,"max":600,"description":"Horizontal move speed"},
    {"name":"jumpForce","type":"number","default":520,"min":200,"max":900,"description":"Jump force"},
    {"name":"gravity","type":"number","default":980,"min":200,"max":2000,"description":"Gravity strength"},
    {"name":"groundY","type":"number","default":840,"min":200,"max":1800,"description":"Ground Y position"},
    {"name":"theme","type":"select","default":"forest","options":["forest","sunset","space","volcanic","candy","arctic","dark","ocean"],"description":"Color palette for player sprite"},
    {"name":"worldWidth","type":"number","default":4000,"min":800,"max":10000,"description":"World width"},
    {"name":"worldHeight","type":"number","default":900,"min":400,"max":2000,"description":"World height"},
    {"name":"startX","type":"number","default":120,"min":0,"max":1000,"description":"Player start X position"},
    {"name":"doubleJump","type":"boolean","default":true,"description":"Allow double jump"},
    {"name":"wallSlide","type":"boolean","default":true,"description":"Allow wall slide and wall jump"}
  ]',
  '[]',
  '["platformer","runner","shooter","puzzle"]',
$$function create(config) {
  var moveSpeed = config.moveSpeed || 280;
  var jumpForce = config.jumpForce || 520;
  var gravity = config.gravity || 980;
  var groundY = config.groundY || 840;
  var theme = config.theme || 'forest';
  var worldW = config.worldWidth || 4000;
  var worldH = config.worldHeight || 900;
  var startX = config.startX || 120;
  var physics = null;
  var playerBody = null;
  var playerSprite = null;
  var controller = null;
  var _lastAnim = '';
  var _isAnimated = false;
  var _frameW = 128;
  var _scaleFactor = 1;

  /** Analyze root motion drift between first and last frames of an animation.
   *  Returns drift in normalized units (0 = no drift, 0.15 = 15% of frame width rightward).
   *  Uses a small offscreen canvas to find center-of-mass of non-transparent pixels. */
  function _analyzeRootMotion(frames) {
    if (!frames || frames.length < 2) return 0;
    try {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var sz = 64; // downsample for speed
      canvas.width = sz; canvas.height = sz;
      function getCenterX(tex) {
        ctx.clearRect(0, 0, sz, sz);
        var src = tex.source ? tex.source.resource : (tex.baseTexture ? tex.baseTexture.resource.source : null);
        if (!src) return sz / 2;
        var fr = tex.frame || tex._frame;
        if (fr) { ctx.drawImage(src, fr.x, fr.y, fr.width, fr.height, 0, 0, sz, sz); }
        else { ctx.drawImage(src, 0, 0, sz, sz); }
        var data = ctx.getImageData(0, 0, sz, sz).data;
        var totalA = 0, wX = 0;
        for (var i = 0; i < data.length; i += 4) {
          var a = data[i + 3];
          if (a > 20) { var x = (i / 4) % sz; totalA += a; wX += x * a; }
        }
        return totalA > 0 ? wX / totalA : sz / 2;
      }
      var first = getCenterX(frames[0]);
      var last = getCenterX(frames[frames.length - 1]);
      canvas = null;
      return (last - first) / sz;
    } catch(e) { return 0; }
  }

  return {
    id: 'player-platformer',
    init: function(engine) {
      var PAL = PALETTES[theme] || PALETTES.forest;

      // Create physics world
      physics = new PhysicsWorld(gravity);

      // Ground body (full width)
      var groundBody = createStaticBody(worldW / 2, groundY + 30, worldW, 60);
      physics.addBody(groundBody);

      // Player sprite — use custom spritesheet if available, otherwise draw helper
      var heroSheet = _sheetCache && _sheetCache['hero'];
      var _bodyW = 36, _bodyH = 48;
      if (heroSheet && heroSheet.animations && heroSheet.animations['idle']) {
        playerSprite = new PIXI.AnimatedSprite(heroSheet.animations['idle']);
        playerSprite.anchor.set(0.5, 1);

        // Smart sizing: read actual frame dimensions, scale uniformly to target height
        var firstTex = heroSheet.animations['idle'][0];
        var frameW = (firstTex && firstTex.width) || (heroSheet.frameWidth || 128);
        var frameH = (firstTex && firstTex.height) || (heroSheet.frameHeight || 128);
        var TARGET_H = 256;
        var scaleFactor = TARGET_H / frameH;
        _frameW = frameW; _scaleFactor = scaleFactor; // expose for playOneShot root motion
        playerSprite.scale.set(scaleFactor, scaleFactor);
        var displayW = frameW * scaleFactor;
        var displayH = TARGET_H;

        // Physics body proportional to visual size
        _bodyW = Math.round(displayW * 0.5);
        _bodyH = Math.round(displayH * 0.85);

        playerSprite.animationSpeed = 0.10;
        playerSprite.play();
        _isAnimated = true;
        _lastAnim = 'idle';
        console.log('[player-platformer] Custom hero: frame ' + frameW + 'x' + frameH + ' → display ' + Math.round(displayW) + 'x' + displayH + ', body ' + _bodyW + 'x' + _bodyH);
      } else {
        playerSprite = drawPlayerCharacter(48, PAL.player, PAL.playerLight);
      }
      playerSprite.x = startX;
      playerSprite.y = groundY;
      engine.world.addChild(playerSprite);

      // Player physics body — center positioned so bottom edge rests on ground
      playerBody = createBody(startX, groundY - _bodyH / 2, _bodyW, _bodyH, { tag: 'player' });
      physics.addBody(playerBody);

      // Character controller
      controller = new CharacterController(playerBody, {
        moveSpeed: moveSpeed,
        jumpForce: jumpForce,
        doubleJump: config.doubleJump !== false,
        wallSlide: config.wallSlide !== false,
      });
    },
    update: function(engine, dt) {
      if (!controller || !physics) return;

      // Read input and update controller
      controller.update(engine.input, dt);

      // Step physics
      physics.update(dt);

      // Sync sprite to physics body — feet at body bottom (ground level)
      if (playerSprite && playerBody) {
        playerSprite.x = playerBody.x;
        playerSprite.y = playerBody.y + playerBody.hh;
        var sf = Math.abs(playerSprite.scale.x) || 1;
        playerSprite.scale.x = controller.facingRight ? sf : -sf;
      }

      // Velocity-synchronized animation state machine
      // Skip if animation is locked by combat/other features (window.__vibexeAnimLock)
      if (_isAnimated && playerSprite.textures && playerSprite.play && !window.__vibexeAnimLock) {
        var heroSheet = _sheetCache && _sheetCache['hero'];
        if (heroSheet && heroSheet.animations) {
          var _anim = 'idle';
          var _speed = 0.10;

          if (!playerBody.onGround && playerBody.vy < 0) {
            _anim = 'jump';
            _speed = 0.35;
          } else if (!playerBody.onGround && playerBody.vy >= 0) {
            _anim = heroSheet.animations['fall'] ? 'fall' : 'jump';
            _speed = 0.15;
          } else if (Math.abs(playerBody.vx) > 15) {
            _anim = 'walk';
            var speedRatio = Math.min(1.0, Math.abs(playerBody.vx) / moveSpeed);
            _speed = 0.40 * Math.max(0.15, speedRatio);
          }

          if (_lastAnim !== _anim && heroSheet.animations[_anim]) {
            playerSprite.textures = heroSheet.animations[_anim];
            playerSprite.animationSpeed = _speed;
            playerSprite.loop = (_anim !== 'jump');
            playerSprite.gotoAndPlay(0);
            _lastAnim = _anim;
          } else if (_anim === 'walk') {
            var speedRatio = Math.min(1.0, Math.abs(playerBody.vx) / moveSpeed);
            playerSprite.animationSpeed = 0.40 * Math.max(0.15, speedRatio);
          }
        }
      }

      // Jump/land effects
      if (controller.justLanded) {
        try { onLandImpact(playerSprite.x, playerSprite.y + 20); } catch(e) {}
      }
    },
    getPlayer: function() { return { sprite: playerSprite, body: playerBody }; },
    getPhysics: function() { return physics; },
    getController: function() { return controller; },
    /** Play a one-shot animation with lock and root motion compensation.
     *  Analyzes first/last frames to detect visual drift, then adjusts physics
     *  body position on completion so the character doesn't snap back. */
    playOneShot: function(animName, speed, onDone) {
      var heroSheet = _sheetCache && _sheetCache['hero'];
      if (!_isAnimated || !heroSheet || !heroSheet.animations[animName]) return false;
      if (window.__vibexeAnimLock) return false; // already playing a one-shot
      window.__vibexeAnimLock = true;

      // Analyze root motion drift for this animation
      var frames = heroSheet.animations[animName];
      var driftNorm = _analyzeRootMotion(frames);
      var driftPx = driftNorm * _frameW * _scaleFactor;

      playerSprite.textures = frames;
      playerSprite.loop = false;
      playerSprite.animationSpeed = speed || 0.25;
      playerSprite.onComplete = function() {
        // Root motion compensation: move physics body to where character visually ended
        // This prevents the "snap back" when returning to idle
        if (Math.abs(driftPx) > 2 && playerBody) {
          var facingSign = (playerSprite.scale.x >= 0) ? 1 : -1;
          playerBody.x += driftPx * facingSign;
        }

        window.__vibexeAnimLock = false;
        _lastAnim = '';
        var idleFrames = heroSheet.animations['idle'];
        if (idleFrames) {
          playerSprite.textures = idleFrames;
          playerSprite.loop = true;
          playerSprite.animationSpeed = 0.10;
          playerSprite.play();
        }
        playerSprite.onComplete = null;
        if (onDone) onDone();
      };
      playerSprite.gotoAndPlay(0);
      return true;
    },
    destroy: function() {
      window.__vibexeAnimLock = false;
      if (playerSprite && playerSprite.parent) playerSprite.parent.removeChild(playerSprite);
      physics = null; playerBody = null; playerSprite = null; controller = null;
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
-- 3. LEVEL-PLATFORMS — Platform layout generation
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'level-platforms',
  'Level Platforms',
  'Platform layout: auto-generates or uses explicit positions. Creates physics bodies and themed visuals. Depends on player-platformer for physics world.',
  'Core/Level',
  'instruction',
  '2d',
  '1.0.0',
  '["platforms","level","layout","terrain","blocks"]',
  '[
    {"name":"theme","type":"select","default":"forest","options":["forest","sunset","space","volcanic","candy","arctic","dark","ocean"],"description":"Platform visual theme"},
    {"name":"groundY","type":"number","default":840,"min":200,"max":1800,"description":"Ground Y position"},
    {"name":"worldWidth","type":"number","default":4000,"min":800,"max":10000,"description":"World width"},
    {"name":"platformCount","type":"number","default":8,"min":1,"max":30,"description":"Number of platforms to generate (if no explicit layout)"},
    {"name":"minWidth","type":"number","default":100,"min":40,"max":400,"description":"Minimum platform width"},
    {"name":"maxWidth","type":"number","default":220,"min":60,"max":600,"description":"Maximum platform width"}
  ]',
  '["player-platformer"]',
  '["platformer","runner","puzzle"]',
$$function create(config) {
  var theme = config.theme || 'forest';
  var groundY = config.groundY || 840;
  var worldW = config.worldWidth || 4000;
  var platformCount = config.platformCount || 8;
  var minW = config.minWidth || 100;
  var maxW = config.maxWidth || 220;
  var sprites = [];

  return {
    id: 'level-platforms',
    init: function(engine) {
      var PAL = PALETTES[theme] || PALETTES.forest;
      var playerFeature = engine.features.get('player-platformer');
      var physics = playerFeature ? playerFeature.getPhysics() : null;
      if (!physics) { console.warn('[level-platforms] No physics world found'); return; }

      // Use explicit platforms or generate random layout
      var plats = config.platforms || null;
      if (!plats) {
        plats = [];
        for (var i = 0; i < platformCount; i++) {
          var pw = minW + Math.random() * (maxW - minW);
          var px = 200 + (worldW - 400) * (i / platformCount) + (Math.random() - 0.5) * 80;
          var py = groundY - 80 - Math.random() * 280;
          plats.push({ x: px, y: py, width: pw, height: 20 });
        }
      }

      for (var i = 0; i < plats.length; i++) {
        var p = plats[i];
        var pw = p.width || 120;
        var ph = p.height || 20;

        // Visual
        var sprite = drawPlatformBlock(pw, ph, PAL.platform, PAL.platformTop, theme);
        sprite.x = p.x;
        sprite.y = p.y;
        engine.world.addChild(sprite);
        sprites.push(sprite);

        // Physics body (center-based positioning)
        var body = p.oneWay
          ? createOneWayPlatform(p.x + pw / 2, p.y + ph / 2, pw, ph)
          : createStaticBody(p.x + pw / 2, p.y + ph / 2, pw, ph, { tag: 'platform' });
        physics.addBody(body);
      }
    },
    destroy: function() {
      for (var i = 0; i < sprites.length; i++) {
        if (sprites[i] && sprites[i].parent) sprites[i].parent.removeChild(sprites[i]);
      }
      sprites = [];
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
-- 4. COLLECTIBLE-COINS — Coin spawning, collection, score tracking
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'collectible-coins',
  'Collectible Coins',
  'Spawns coins at positions (or randomly), detects collection via proximity, tracks score, emits events. Depends on player-platformer for player position.',
  'Core/Collectibles',
  'instruction',
  '2d',
  '1.0.0',
  '["coins","collectible","score","pickup","collect"]',
  '[
    {"name":"theme","type":"select","default":"forest","options":["forest","sunset","space","volcanic","candy","arctic","dark","ocean"],"description":"Coin visual theme"},
    {"name":"count","type":"number","default":15,"min":1,"max":100,"description":"Number of coins to spawn (if no explicit positions)"},
    {"name":"coinValue","type":"number","default":10,"min":1,"max":100,"description":"Score per coin"},
    {"name":"collectRadius","type":"number","default":40,"min":15,"max":80,"description":"Collection proximity radius"},
    {"name":"groundY","type":"number","default":840,"min":200,"max":1800,"description":"Ground Y for random placement"},
    {"name":"worldWidth","type":"number","default":4000,"min":800,"max":10000,"description":"World width for random placement"}
  ]',
  '["player-platformer"]',
  '["platformer","runner","puzzle"]',
$$function create(config) {
  var theme = config.theme || 'forest';
  var coinCount = config.count || 15;
  var coinValue = config.coinValue || 10;
  var collectRadius = config.collectRadius || 40;
  var groundY = config.groundY || 840;
  var worldW = config.worldWidth || 4000;
  var coinList = [];
  var score = 0;
  var totalCollected = 0;

  return {
    id: 'collectible-coins',
    init: function(engine) {
      var PAL = PALETTES[theme] || PALETTES.forest;
      var positions = config.coins || null;

      if (!positions) {
        positions = [];
        for (var i = 0; i < coinCount; i++) {
          positions.push({
            x: 200 + (worldW - 400) * (i / coinCount) + (Math.random() - 0.5) * 60,
            y: groundY - 40 - Math.random() * 280
          });
        }
      }

      for (var i = 0; i < positions.length; i++) {
        var sprite = drawCoinToken(12, PAL.coin, PAL.coinGlow);
        sprite.x = positions[i].x;
        sprite.y = positions[i].y;
        engine.world.addChild(sprite);
        coinList.push({ sprite: sprite, baseY: positions[i].y, collected: false });
      }
    },
    update: function(engine, dt) {
      var playerFeature = engine.features.get('player-platformer');
      if (!playerFeature) return;
      var player = playerFeature.getPlayer();
      if (!player || !player.body) return;
      var px = player.body.x;
      var py = player.body.y;
      var now = Date.now();

      for (var i = 0; i < coinList.length; i++) {
        var c = coinList[i];
        if (c.collected) continue;

        // Bobbing animation
        c.sprite.y = c.baseY + Math.sin(now * 0.003 + i) * 4;

        // Proximity check
        var dx = c.sprite.x - px;
        var dy = c.sprite.y - py;
        if (dx * dx + dy * dy < collectRadius * collectRadius) {
          c.collected = true;
          score += coinValue;
          totalCollected++;
          try { onCollectSparkle(c.sprite.x, c.sprite.y); } catch(e) {}
          if (c.sprite.parent) c.sprite.parent.removeChild(c.sprite);
          engine.features.emit('coin.collected', { score: score, value: coinValue, total: totalCollected });
        }
      }
    },
    getScore: function() { return score; },
    getTotalCollected: function() { return totalCollected; },
    destroy: function() {
      for (var i = 0; i < coinList.length; i++) {
        if (coinList[i].sprite && coinList[i].sprite.parent) coinList[i].sprite.parent.removeChild(coinList[i].sprite);
      }
      coinList = [];
      score = 0;
      totalCollected = 0;
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
-- 5. ENEMY-PATROL — Patrol enemies with player collision
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'enemy-patrol',
  'Enemy Patrol',
  'Patrol enemies that walk back and forth. Stomp to kill (bounce), touch sides to take damage. Emits events for kills and damage. Depends on player-platformer.',
  'Core/Enemies',
  'instruction',
  '2d',
  '1.0.0',
  '["enemy","patrol","slime","damage","stomp","combat"]',
  '[
    {"name":"theme","type":"select","default":"forest","options":["forest","sunset","space","volcanic","candy","arctic","dark","ocean"],"description":"Enemy visual theme"},
    {"name":"count","type":"number","default":5,"min":1,"max":20,"description":"Number of enemies (if no explicit layout)"},
    {"name":"damage","type":"number","default":1,"min":1,"max":5,"description":"Damage dealt to player on contact"},
    {"name":"groundY","type":"number","default":840,"min":200,"max":1800,"description":"Ground Y for placement"},
    {"name":"worldWidth","type":"number","default":4000,"min":800,"max":10000,"description":"World width for placement"},
    {"name":"hitCooldownTime","type":"number","default":1.0,"min":0.3,"max":3.0,"description":"Seconds of invulnerability after taking damage"}
  ]',
  '["player-platformer"]',
  '["platformer","runner"]',
$$function create(config) {
  var theme = config.theme || 'forest';
  var dmg = config.damage || 1;
  var groundY = config.groundY || 840;
  var worldW = config.worldWidth || 4000;
  var enemyCount = config.count || 5;
  var cooldownTime = config.hitCooldownTime || 1.0;
  var enemyList = [];
  var hitCooldown = 0;

  return {
    id: 'enemy-patrol',
    init: function(engine) {
      var PAL = PALETTES[theme] || PALETTES.forest;
      var defs = config.enemies || null;

      if (!defs) {
        defs = [];
        for (var i = 0; i < enemyCount; i++) {
          var ex = 400 + (worldW - 600) * (i / enemyCount);
          var patrolRange = 60 + Math.random() * 80;
          defs.push({
            x: ex, y: groundY - 24,
            patrolMin: ex - patrolRange, patrolMax: ex + patrolRange,
            speed: 40 + Math.random() * 40
          });
        }
      }

      for (var i = 0; i < defs.length; i++) {
        var d = defs[i];
        var sprite = drawEnemySlime(32, PAL.enemy, PAL.enemyLight);
        sprite.x = d.x;
        sprite.y = d.y;
        engine.world.addChild(sprite);
        enemyList.push({
          sprite: sprite,
          patrolMin: d.patrolMin || d.x - 80,
          patrolMax: d.patrolMax || d.x + 80,
          speed: d.speed || 50,
          dir: 1, alive: true
        });
      }
    },
    update: function(engine, dt) {
      hitCooldown -= dt;
      var playerFeature = engine.features.get('player-platformer');
      if (!playerFeature) return;
      var player = playerFeature.getPlayer();

      for (var i = 0; i < enemyList.length; i++) {
        var e = enemyList[i];
        if (!e.alive) continue;

        // Patrol movement
        e.sprite.x += e.speed * e.dir * dt;
        if (e.sprite.x >= e.patrolMax) e.dir = -1;
        if (e.sprite.x <= e.patrolMin) e.dir = 1;

        // Flip sprite
        if (e.sprite.scale) {
          var absScale = Math.abs(e.sprite.scale.x) || 1;
          e.sprite.scale.x = e.dir > 0 ? absScale : -absScale;
        }

        // Player collision
        if (player && player.body && hitCooldown <= 0) {
          var dx = e.sprite.x - player.body.x;
          var dy = e.sprite.y - player.body.y;
          if (Math.abs(dx) < 36 && Math.abs(dy) < 36) {
            if (player.body.vy > 0 && dy > 10) {
              // Stomp kill — player was falling and above enemy
              e.alive = false;
              try { onDeathExplosion(e.sprite.x, e.sprite.y); } catch(ex) {}
              if (e.sprite.parent) e.sprite.parent.removeChild(e.sprite);
              player.body.vy = -300;
              engine.features.emit('enemy.killed', { index: i });
            } else {
              // Player takes damage
              hitCooldown = cooldownTime;
              engine.features.emit('player.damaged', { damage: dmg });
              player.body.vx = dx > 0 ? -200 : 200;
              player.body.vy = -150;
            }
          }
        }
      }
    },
    destroy: function() {
      for (var i = 0; i < enemyList.length; i++) {
        if (enemyList[i].sprite && enemyList[i].sprite.parent) enemyList[i].sprite.parent.removeChild(enemyList[i].sprite);
      }
      enemyList = [];
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
-- 6. CAMERA-FOLLOW — Smooth camera tracking player
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'camera-follow',
  'Camera Follow',
  'Smooth camera that follows the player with configurable smoothing and dead zones. Depends on player-platformer for follow target.',
  'Core/Camera',
  'instruction',
  '2d',
  '1.0.0',
  '["camera","follow","scroll","smooth","tracking"]',
  '[
    {"name":"smoothing","type":"number","default":0.08,"min":0.01,"max":0.5,"description":"Camera smoothing (lower = smoother)"},
    {"name":"deadZoneX","type":"number","default":50,"min":0,"max":200,"description":"Horizontal dead zone before camera moves"},
    {"name":"deadZoneY","type":"number","default":30,"min":0,"max":150,"description":"Vertical dead zone before camera moves"},
    {"name":"worldWidth","type":"number","default":4000,"min":800,"max":10000,"description":"World width for camera bounds"},
    {"name":"worldHeight","type":"number","default":900,"min":400,"max":2000,"description":"World height for camera bounds"}
  ]',
  '["player-platformer"]',
  '["platformer","runner","shooter","puzzle"]',
$$function create(config) {
  var smoothing = config.smoothing || 0.08;
  var worldW = config.worldWidth || 4000;
  var worldH = config.worldHeight || 900;
  var deadZoneX = config.deadZoneX || 50;
  var deadZoneY = config.deadZoneY || 30;

  return {
    id: 'camera-follow',
    init: function(engine) {
      var playerFeature = engine.features.get('player-platformer');
      if (!playerFeature) { console.warn('[camera-follow] No player feature'); return; }
      var player = playerFeature.getPlayer();
      if (!player || !player.body) return;

      engine.camera.worldWidth = worldW;
      engine.camera.worldHeight = worldH;
      engine.camera.smoothing = smoothing;
      engine.camera.deadZoneX = deadZoneX;
      engine.camera.deadZoneY = deadZoneY;
      engine.camera.follow(player.body);
    },
    update: function(engine, dt) {
      // Engine game loop already calls camera.update(engine.world) every frame.
      // Nothing to do here — camera config and follow target set in init().
    },
    destroy: function() {}
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
-- 7. HUD-BASIC — Score display, lives/hearts, coin counter
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'hud-basic',
  'Basic HUD',
  'Heads-up display with score counter and heart-based lives. Listens for coin.collected and player.damaged events. Standalone — no dependencies required.',
  'Core/UI',
  'instruction',
  '2d',
  '1.0.0',
  '["hud","score","lives","hearts","ui","display","health"]',
  '[
    {"name":"showScore","type":"boolean","default":true,"description":"Show score counter"},
    {"name":"showLives","type":"boolean","default":true,"description":"Show lives as hearts"},
    {"name":"initialLives","type":"number","default":3,"min":1,"max":10,"description":"Starting number of lives"},
    {"name":"fontSize","type":"number","default":20,"min":12,"max":40,"description":"Score text size"}
  ]',
  '[]',
  '["platformer","runner","shooter","puzzle"]',
$$function create(config) {
  var showScore = config.showScore !== false;
  var showLives = config.showLives !== false;
  var initialLives = config.initialLives || 3;
  var fontSize = config.fontSize || 20;
  var lives = initialLives;
  var scoreText = null;
  var heartSprites = [];
  var hudContainer = null;
  var _engine = null;

  return {
    id: 'hud-basic',
    init: function(engine) {
      _engine = engine;
      hudContainer = new PIXI.Container();

      // Score text — use PIXI.Text with positional args for v8 compat
      if (showScore) {
        try {
          scoreText = new PIXI.Text({ text: 'Score: 0', style: {
            fontFamily: 'Arial, sans-serif',
            fontSize: fontSize,
            fill: 0xFFFFFF,
            stroke: { color: 0x000000, width: 3 },
          }});
        } catch(e) {
          // Fallback for different PIXI.Text signatures
          scoreText = new PIXI.Text('Score: 0', {
            fontFamily: 'Arial, sans-serif',
            fontSize: fontSize,
            fill: 0xFFFFFF,
          });
        }
        scoreText.x = 16;
        scoreText.y = 16;
        hudContainer.addChild(scoreText);
      }

      // Heart sprites for lives
      if (showLives) {
        var screenW = 800; try { screenW = engine.app.screen.width; } catch(e) {}
        for (var i = 0; i < initialLives; i++) {
          var heart = drawHeart(18, 0xFF4444);
          heart.x = screenW - 30 - i * 28;
          heart.y = 22;
          hudContainer.addChild(heart);
          heartSprites.push(heart);
        }
      }

      if (engine.uiLayer) {
        engine.uiLayer.addChild(hudContainer);
      } else {
        engine.world.addChild(hudContainer);
      }
    },
    update: function(engine, dt) {
      if (scoreText) {
        var coinsFeature = engine.features.get('collectible-coins');
        if (coinsFeature) {
          scoreText.text = 'Score: ' + coinsFeature.getScore();
        }
      }
    },
    onEvent: function(event, data) {
      if (event === 'coin.collected' && scoreText) {
        scoreText.text = 'Score: ' + (data && data.score || 0);
      }
      if (event === 'player.damaged') {
        lives = Math.max(0, lives - (data && data.damage || 1));
        for (var i = 0; i < heartSprites.length; i++) {
          heartSprites[i].visible = i < lives;
        }
        if (lives <= 0 && _engine) {
          _engine.features.emit('player.died', {});
        }
      }
    },
    getLives: function() { return lives; },
    destroy: function() {
      if (hudContainer && hudContainer.parent) hudContainer.parent.removeChild(hudContainer);
      hudContainer = null;
      scoreText = null;
      heartSprites = [];
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
-- 8. AMBIENT-ATMOSPHERE — Theme particles, lighting, vignette
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'ambient-atmosphere',
  'Ambient Atmosphere',
  'Theme-based ambient effects: particle systems (fireflies/snow/rain/embers), lighting layers, and vignette overlay. Standalone.',
  'Core/Effects',
  'instruction',
  '2d',
  '1.0.0',
  '["ambient","particles","lighting","vignette","atmosphere","effects","weather"]',
  '[
    {"name":"theme","type":"select","default":"forest","options":["forest","sunset","space","volcanic","candy","arctic","dark","ocean"],"description":"Theme for ambient effects"},
    {"name":"intensity","type":"number","default":1.0,"min":0.1,"max":2.0,"description":"Effect intensity multiplier"},
    {"name":"lightingAlpha","type":"number","default":0.6,"min":0,"max":1.0,"description":"Lighting layer opacity"},
    {"name":"showVignette","type":"boolean","default":true,"description":"Show vignette overlay"},
    {"name":"worldWidth","type":"number","default":4000,"min":800,"max":10000,"description":"World width"},
    {"name":"worldHeight","type":"number","default":900,"min":400,"max":2000,"description":"World height"},
    {"name":"groundY","type":"number","default":840,"min":200,"max":1800,"description":"Ground Y for lighting placement"}
  ]',
  '[]',
  '["platformer","runner","shooter","puzzle"]',
$$function create(config) {
  var theme = config.theme || 'forest';
  var intensity = config.intensity || 1.0;
  var lightingAlpha = config.lightingAlpha || 0.6;
  var showVignette = config.showVignette !== false;
  var worldW = config.worldWidth || 4000;
  var worldH = config.worldHeight || 900;
  var groundY = config.groundY || 840;
  var ambientEffect = null;
  var lightingLayer = null;
  var vignetteSprite = null;

  return {
    id: 'ambient-atmosphere',
    init: function(engine) {
      var PAL = PALETTES[theme] || PALETTES.forest;

      // Ambient particles (fireflies, dust, leaves, embers, pollen)
      if (PAL.ambient) {
        try {
          ambientEffect = createAmbientEffect(PAL.ambient, worldW, worldH);
        } catch(e) { console.warn('[ambient] particles failed:', e); }
      }

      // Lighting layer
      try {
        lightingLayer = createLightingLayer(theme, worldW, groundY, []);
        if (lightingLayer) {
          lightingLayer.alpha = lightingAlpha * intensity;
          engine.world.addChild(lightingLayer);
        }
      } catch(e) { console.warn('[ambient] lighting failed:', e); }

      // Vignette overlay (fixed on screen)
      if (showVignette) {
        try {
          var screenW = 800; try { screenW = engine.app.screen.width; } catch(e) {}
          var screenH = 600; try { screenH = engine.app.screen.height; } catch(e) {}
          vignetteSprite = drawVignette(screenW, screenH);
          vignetteSprite.alpha = 0.4 * intensity;
          if (engine.uiLayer) {
            engine.uiLayer.addChild(vignetteSprite);
          }
        } catch(e) { console.warn('[ambient] vignette failed:', e); }
      }
    },
    update: function(engine, dt) {
      if (ambientEffect && ambientEffect.update) {
        try { ambientEffect.update(dt); } catch(e) {}
      }
    },
    destroy: function() {
      if (ambientEffect && ambientEffect.destroy) try { ambientEffect.destroy(); } catch(e) {}
      if (lightingLayer && lightingLayer.parent) lightingLayer.parent.removeChild(lightingLayer);
      if (vignetteSprite && vignetteSprite.parent) vignetteSprite.parent.removeChild(vignetteSprite);
      ambientEffect = null; lightingLayer = null; vignetteSprite = null;
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
