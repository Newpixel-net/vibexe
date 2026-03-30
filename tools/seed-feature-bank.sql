-- Feature Bank Seed — 44 core features for 2D game engine
-- Run: PGPASSWORD=V1bexe2026Pg psql -h 127.0.0.1 -U vibexe -d vibexe -f /opt/vibexe/tools/seed-feature-bank.sql

-- Upsert: use ON CONFLICT to update existing entries without nuking other seed files

-- ============================================================================
-- MECHANICS / MOVEMENT (8)
-- ============================================================================

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified) VALUES

('basic-movement', 'Basic Movement', 'Left/right walk and jump with ground detection', 'Mechanics/Movement', 'instruction', '2d', '1.0.0',
 '["walk","run","jump","movement","controls"]',
 '[{"name":"speed","type":"number","default":200,"min":50,"max":600,"description":"Walk speed"},{"name":"jumpForce","type":"number","default":450,"min":200,"max":800,"description":"Jump force"}]',
 '[]', '["platformer","runner","shooter","puzzle"]',
 E'function create(config) {\n  var speed = config.speed || 200;\n  var jumpForce = config.jumpForce || 450;\n  var player = null;\n  var body = null;\n  var facing = 1;\n  return {\n    id: ''basic-movement'',\n    init: function(engine) {\n      player = engine.getPlayer ? engine.getPlayer() : null;\n      body = player ? player.body : null;\n    },\n    update: function(engine, dt) {\n      if (!body) return;\n      if (engine.input.left) { body.vx = -speed; facing = -1; }\n      else if (engine.input.right) { body.vx = speed; facing = 1; }\n      else { body.vx *= 0.85; }\n      if (engine.input.jump && body.onGround) {\n        body.vy = -jumpForce;\n      }\n      if (player && player.scale) player.scale.x = facing;\n    },\n    destroy: function() { player = null; body = null; }\n  };\n}', true, true),

('double-jump', 'Double Jump', 'Allows extra mid-air jumps with dust effect', 'Mechanics/Movement', 'instruction', '2d', '1.0.0',
 '["jump","air","double","movement","platformer"]',
 '[{"name":"maxJumps","type":"number","default":2,"min":1,"max":5,"description":"Maximum number of jumps (including ground jump)"},{"name":"airJumpForce","type":"number","default":400,"min":200,"max":700,"description":"Force of air jumps"}]',
 '[]', '["platformer","runner"]',
 E'function create(config) {\n  var maxJumps = config.maxJumps || 2;\n  var airJumpForce = config.airJumpForce || 400;\n  var jumpsLeft = maxJumps;\n  return {\n    id: ''double-jump'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (!player || !player.body) return;\n      if (player.body.onGround) jumpsLeft = maxJumps;\n      if (engine.input.jump && jumpsLeft > 0) {\n        player.body.vy = -airJumpForce;\n        jumpsLeft--;\n        if (!player.body.onGround) {\n          engine.effects.dust(player.x, player.y + 20);\n          engine.juice.squash(player);\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('wall-slide', 'Wall Slide', 'Slide down walls and wall jump', 'Mechanics/Movement', 'instruction', '2d', '1.0.0',
 '["wall","slide","walljump","movement"]',
 '[{"name":"slideSpeed","type":"number","default":60,"min":20,"max":150,"description":"Wall slide fall speed"},{"name":"wallJumpForceX","type":"number","default":250,"min":100,"max":500,"description":"Horizontal wall jump force"},{"name":"wallJumpForceY","type":"number","default":400,"min":200,"max":600,"description":"Vertical wall jump force"}]',
 '[]', '["platformer"]',
 E'function create(config) {\n  var slideSpeed = config.slideSpeed || 60;\n  var wjx = config.wallJumpForceX || 250;\n  var wjy = config.wallJumpForceY || 400;\n  var onWall = 0;\n  return {\n    id: ''wall-slide'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (!player || !player.body) return;\n      var b = player.body;\n      onWall = 0;\n      if (!b.onGround && b.onWall === ''left'') onWall = -1;\n      if (!b.onGround && b.onWall === ''right'') onWall = 1;\n      if (onWall !== 0) {\n        if (b.vy > slideSpeed) b.vy = slideSpeed;\n        if (engine.input.jump) {\n          b.vx = -onWall * wjx;\n          b.vy = -wjy;\n          engine.juice.pop(player);\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('dash', 'Dash', 'Horizontal dash with cooldown and afterimage effect', 'Mechanics/Movement', 'instruction', '2d', '1.0.0',
 '["dash","speed","burst","movement"]',
 '[{"name":"dashSpeed","type":"number","default":600,"min":300,"max":1000,"description":"Dash velocity"},{"name":"dashDuration","type":"number","default":0.15,"min":0.05,"max":0.4,"description":"Dash duration in seconds"},{"name":"cooldown","type":"number","default":1.0,"min":0.3,"max":3.0,"description":"Cooldown between dashes"}]',
 '[]', '["platformer","runner","shooter"]',
 E'function create(config) {\n  var dashSpeed = config.dashSpeed || 600;\n  var dashDur = config.dashDuration || 0.15;\n  var cooldown = config.cooldown || 1.0;\n  var timer = 0;\n  var cdTimer = 0;\n  var dashing = false;\n  var dir = 1;\n  return {\n    id: ''dash'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (!player || !player.body) return;\n      cdTimer -= dt;\n      if (engine.input.wasPressed && engine.input.wasPressed(''e'') && cdTimer <= 0 && !dashing) {\n        dashing = true;\n        timer = dashDur;\n        cdTimer = cooldown;\n        dir = player.scale ? (player.scale.x > 0 ? 1 : -1) : 1;\n        engine.juice.shake(engine.world, 4, 0.1);\n      }\n      if (dashing) {\n        player.body.vx = dir * dashSpeed;\n        player.body.vy = 0;\n        timer -= dt;\n        engine.effects.trail(player, 0x4488ff);\n        if (timer <= 0) dashing = false;\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('crouch', 'Crouch', 'Crouch to reduce hitbox and crawl through tight spaces', 'Mechanics/Movement', 'instruction', '2d', '1.0.0',
 '["crouch","duck","crawl","movement"]',
 '[{"name":"crouchScale","type":"number","default":0.6,"min":0.4,"max":0.8,"description":"Height scale when crouching"},{"name":"crouchSpeed","type":"number","default":80,"min":30,"max":150,"description":"Movement speed while crouching"}]',
 '[]', '["platformer"]',
 E'function create(config) {\n  var crouchScale = config.crouchScale || 0.6;\n  var crouchSpeed = config.crouchSpeed || 80;\n  var isCrouching = false;\n  var origScaleY = 1;\n  return {\n    id: ''crouch'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (!player || !player.body) return;\n      var wantCrouch = engine.input.down;\n      if (wantCrouch && player.body.onGround && !isCrouching) {\n        isCrouching = true;\n        origScaleY = player.scale ? player.scale.y : 1;\n        if (player.scale) player.scale.y = origScaleY * crouchScale;\n      } else if (!wantCrouch && isCrouching) {\n        isCrouching = false;\n        if (player.scale) player.scale.y = origScaleY;\n      }\n      if (isCrouching) {\n        if (Math.abs(player.body.vx) > crouchSpeed) {\n          player.body.vx = crouchSpeed * (player.body.vx > 0 ? 1 : -1);\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('ladder-climb', 'Ladder Climb', 'Climb vertical ladders with up/down controls', 'Mechanics/Movement', 'instruction', '2d', '1.0.0',
 '["ladder","climb","vertical","movement"]',
 '[{"name":"climbSpeed","type":"number","default":150,"min":50,"max":300,"description":"Climbing speed"}]',
 '[]', '["platformer","puzzle"]',
 E'function create(config) {\n  var climbSpeed = config.climbSpeed || 150;\n  var onLadder = false;\n  return {\n    id: ''ladder-climb'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (!player || !player.body) return;\n      if (onLadder) {\n        player.body.vy = 0;\n        player.body.ay = 0;\n        if (engine.input.up) player.body.vy = -climbSpeed;\n        if (engine.input.down) player.body.vy = climbSpeed;\n        if (engine.input.jump) {\n          onLadder = false;\n          player.body.vy = -300;\n        }\n      }\n    },\n    onEvent: function(event, data) {\n      if (event === ''ladder.enter'') onLadder = true;\n      if (event === ''ladder.exit'') { onLadder = false; }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('swimming', 'Swimming', 'Buoyancy and swim controls in water zones', 'Mechanics/Movement', 'instruction', '2d', '1.0.0',
 '["swim","water","buoyancy","movement"]',
 '[{"name":"swimSpeed","type":"number","default":120,"min":50,"max":250,"description":"Swimming speed"},{"name":"buoyancy","type":"number","default":0.3,"min":0.1,"max":0.8,"description":"Upward buoyancy force multiplier"}]',
 '[]', '["platformer","puzzle"]',
 E'function create(config) {\n  var swimSpeed = config.swimSpeed || 120;\n  var buoyancy = config.buoyancy || 0.3;\n  var inWater = false;\n  return {\n    id: ''swimming'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (!player || !player.body) return;\n      if (inWater) {\n        player.body.vy -= buoyancy * 980 * dt;\n        player.body.vx *= 0.95;\n        player.body.vy *= 0.95;\n        if (engine.input.up) player.body.vy -= swimSpeed * dt * 10;\n        if (engine.input.down) player.body.vy += swimSpeed * dt * 5;\n        if (engine.input.left) player.body.vx -= swimSpeed * dt * 8;\n        if (engine.input.right) player.body.vx += swimSpeed * dt * 8;\n        if (Math.random() < 0.05) engine.effects.dust(player.x, player.y - 10);\n      }\n    },\n    onEvent: function(event) {\n      if (event === ''water.enter'') inWater = true;\n      if (event === ''water.exit'') inWater = false;\n    },\n    destroy: function() {}\n  };\n}', true, true),

('grapple-hook', 'Grapple Hook', 'Swing from attach points using a grapple hook', 'Mechanics/Movement', 'instruction', '2d', '1.0.0',
 '["grapple","hook","swing","rope","movement"]',
 '[{"name":"ropeLength","type":"number","default":200,"min":80,"max":400,"description":"Maximum rope length"},{"name":"swingForce","type":"number","default":300,"min":100,"max":600,"description":"Swing acceleration"}]',
 '[]', '["platformer"]',
 E'function create(config) {\n  var ropeLen = config.ropeLength || 200;\n  var swingForce = config.swingForce || 300;\n  var attached = false;\n  var anchorX = 0, anchorY = 0;\n  return {\n    id: ''grapple-hook'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (!player || !player.body) return;\n      if (attached) {\n        var dx = player.x - anchorX;\n        var dy = player.y - anchorY;\n        var dist = Math.sqrt(dx*dx + dy*dy);\n        if (dist > ropeLen) {\n          var nx = dx/dist; var ny = dy/dist;\n          player.body.x = anchorX + nx * ropeLen;\n          player.body.y = anchorY + ny * ropeLen;\n          var dot = player.body.vx * nx + player.body.vy * ny;\n          if (dot > 0) { player.body.vx -= dot * nx; player.body.vy -= dot * ny; }\n        }\n        if (engine.input.left) player.body.vx -= swingForce * dt;\n        if (engine.input.right) player.body.vx += swingForce * dt;\n        if (engine.input.jump) attached = false;\n      }\n    },\n    onEvent: function(event, data) {\n      if (event === ''grapple.attach'' && data) { attached = true; anchorX = data.x; anchorY = data.y; }\n      if (event === ''grapple.detach'') attached = false;\n    },\n    destroy: function() {}\n  };\n}', true, true),

-- ============================================================================
-- MECHANICS / COMBAT (6)
-- ============================================================================

('melee-attack', 'Melee Attack', 'Close-range swing attack with hitbox and cooldown', 'Mechanics/Combat', 'instruction', '2d', '1.0.0',
 '["melee","attack","sword","swing","combat"]',
 '[{"name":"damage","type":"number","default":1,"min":1,"max":10,"description":"Damage per hit"},{"name":"range","type":"number","default":50,"min":20,"max":120,"description":"Attack range in pixels"},{"name":"cooldown","type":"number","default":0.4,"min":0.1,"max":2.0,"description":"Attack cooldown"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var damage = config.damage || 1;\n  var range = config.range || 50;\n  var cooldown = config.cooldown || 0.4;\n  var cdTimer = 0;\n  var attacking = false;\n  return {\n    id: ''melee-attack'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      cdTimer -= dt;\n      if (engine.input.wasPressed && engine.input.wasPressed(''x'') && cdTimer <= 0) {\n        attacking = true;\n        cdTimer = cooldown;\n        var player = engine.getPlayer ? engine.getPlayer() : null;\n        if (player) {\n          var dir = player.scale ? (player.scale.x > 0 ? 1 : -1) : 1;\n          engine.juice.shake(engine.world, 3, 0.08);\n          engine.features.emit(''melee.hit'', { x: player.x + dir * range, y: player.y, damage: damage, range: range });\n        }\n        setTimeout(function() { attacking = false; }, cooldown * 500);\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('projectile-shoot', 'Projectile Shoot', 'Fire bullets or arrows with cooldown', 'Mechanics/Combat', 'instruction', '2d', '1.0.0',
 '["shoot","projectile","bullet","arrow","ranged","combat"]',
 '[{"name":"speed","type":"number","default":400,"min":200,"max":800,"description":"Projectile speed"},{"name":"damage","type":"number","default":1,"min":1,"max":5,"description":"Damage per projectile"},{"name":"cooldown","type":"number","default":0.3,"min":0.1,"max":2.0,"description":"Fire rate cooldown"},{"name":"lifetime","type":"number","default":2.0,"min":0.5,"max":5.0,"description":"Projectile lifetime in seconds"}]',
 '[]', '["shooter","platformer"]',
 E'function create(config) {\n  var speed = config.speed || 400;\n  var damage = config.damage || 1;\n  var cooldown = config.cooldown || 0.3;\n  var lifetime = config.lifetime || 2.0;\n  var cdTimer = 0;\n  var bullets = [];\n  return {\n    id: ''projectile-shoot'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      cdTimer -= dt;\n      if (engine.input.wasPressed && engine.input.wasPressed(''z'') && cdTimer <= 0) {\n        cdTimer = cooldown;\n        var player = engine.getPlayer ? engine.getPlayer() : null;\n        if (player) {\n          var dir = player.scale ? (player.scale.x > 0 ? 1 : -1) : 1;\n          bullets.push({ x: player.x + dir * 20, y: player.y - 10, vx: dir * speed, life: lifetime });\n          engine.features.emit(''projectile.fired'', { x: player.x, y: player.y, dir: dir });\n        }\n      }\n      for (var i = bullets.length - 1; i >= 0; i--) {\n        var b = bullets[i];\n        b.x += b.vx * dt;\n        b.life -= dt;\n        if (b.life <= 0) { bullets.splice(i, 1); continue; }\n        engine.features.emit(''projectile.check'', { x: b.x, y: b.y, damage: damage, index: i });\n      }\n    },\n    destroy: function() { bullets = []; }\n  };\n}', true, true),

('enemy-stomp', 'Enemy Stomp', 'Bounce on enemies to defeat them (Mario-style)', 'Mechanics/Combat', 'instruction', '2d', '1.0.0',
 '["stomp","bounce","mario","enemy","combat"]',
 '[{"name":"bounceForce","type":"number","default":350,"min":200,"max":600,"description":"Upward bounce force after stomp"},{"name":"scorePerKill","type":"number","default":100,"min":10,"max":1000,"description":"Score awarded per stomp kill"}]',
 '[]', '["platformer"]',
 E'function create(config) {\n  var bounceForce = config.bounceForce || 350;\n  var scorePerKill = config.scorePerKill || 100;\n  return {\n    id: ''enemy-stomp'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''player.collide.enemy'' && data) {\n        var player = data.player;\n        var enemy = data.enemy;\n        if (player && player.body && player.body.vy > 0 && player.y < enemy.y - 10) {\n          player.body.vy = -bounceForce;\n          data.engine.juice.pop(enemy);\n          data.engine.effects.explosion(enemy.x, enemy.y);\n          data.engine.features.emit(''enemy.killed'', { enemy: enemy, score: scorePerKill });\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('knockback', 'Knockback', 'Push entities back on damage with screen shake', 'Mechanics/Combat', 'instruction', '2d', '1.0.0',
 '["knockback","push","damage","impact","combat"]',
 '[{"name":"force","type":"number","default":300,"min":100,"max":800,"description":"Knockback force"},{"name":"duration","type":"number","default":0.2,"min":0.05,"max":0.5,"description":"Stun duration after knockback"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var force = config.force || 300;\n  var stunDur = config.duration || 0.2;\n  return {\n    id: ''knockback'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''entity.damaged'' && data && data.target && data.target.body) {\n        var dir = data.fromX < data.target.x ? 1 : -1;\n        data.target.body.vx = dir * force;\n        data.target.body.vy = -force * 0.5;\n        if (data.engine) {\n          data.engine.juice.shake(data.engine.world, 6, 0.15);\n          data.engine.juice.flash(data.target, 0xff0000, 0.1);\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('invincibility-frames', 'Invincibility Frames', 'Brief invulnerability after taking damage with flashing effect', 'Mechanics/Combat', 'instruction', '2d', '1.0.0',
 '["iframes","invincible","invulnerable","damage","combat"]',
 '[{"name":"duration","type":"number","default":1.5,"min":0.5,"max":3.0,"description":"Invincibility duration in seconds"},{"name":"flashRate","type":"number","default":0.1,"min":0.05,"max":0.3,"description":"Flash toggle rate"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var duration = config.duration || 1.5;\n  var flashRate = config.flashRate || 0.1;\n  var timer = 0;\n  var flashTimer = 0;\n  var invincible = false;\n  return {\n    id: ''invincibility-frames'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      if (!invincible) return;\n      timer -= dt;\n      flashTimer -= dt;\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (flashTimer <= 0) {\n        flashTimer = flashRate;\n        if (player) player.alpha = player.alpha > 0.5 ? 0.3 : 1.0;\n      }\n      if (timer <= 0) {\n        invincible = false;\n        if (player) player.alpha = 1.0;\n      }\n    },\n    onEvent: function(event) {\n      if (event === ''player.damaged'' && !invincible) {\n        invincible = true;\n        timer = duration;\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('shield-block', 'Shield Block', 'Block incoming damage while holding shield button', 'Mechanics/Combat', 'instruction', '2d', '1.0.0',
 '["shield","block","defend","guard","combat"]',
 '[{"name":"damageReduction","type":"number","default":1.0,"min":0.5,"max":1.0,"description":"Damage reduction (1.0 = full block)"},{"name":"moveSpeedMult","type":"number","default":0.3,"min":0.0,"max":0.8,"description":"Movement speed multiplier while blocking"}]',
 '[]', '["platformer"]',
 E'function create(config) {\n  var reduction = config.damageReduction || 1.0;\n  var speedMult = config.moveSpeedMult || 0.3;\n  var blocking = false;\n  return {\n    id: ''shield-block'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      blocking = engine.input.wasPressed ? engine.input.wasPressed(''c'') : false;\n      if (blocking) {\n        var player = engine.getPlayer ? engine.getPlayer() : null;\n        if (player && player.body) {\n          player.body.vx *= speedMult;\n        }\n      }\n    },\n    onEvent: function(event, data) {\n      if (event === ''damage.incoming'' && blocking && data) {\n        data.damage = Math.max(0, data.damage - data.damage * reduction);\n        data.blocked = true;\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

-- ============================================================================
-- ENEMIES / AI (5)
-- ============================================================================

('enemy-patrol', 'Enemy Patrol', 'Walk back and forth between two points', 'Enemies/AI', 'instruction', '2d', '1.0.0',
 '["enemy","patrol","walk","ai"]',
 '[{"name":"speed","type":"number","default":80,"min":20,"max":200,"description":"Patrol walk speed"},{"name":"range","type":"number","default":150,"min":50,"max":500,"description":"Patrol range from start position"}]',
 '[]', '["platformer","runner"]',
 E'function create(config) {\n  var speed = config.speed || 80;\n  var range = config.range || 150;\n  return {\n    id: ''enemy-patrol'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''enemy.spawn'' && data && data.enemy) {\n        var e = data.enemy;\n        e._patrolStart = e.x;\n        e._patrolDir = 1;\n      }\n      if (event === ''enemy.update'' && data && data.enemy) {\n        var e = data.enemy;\n        if (e._patrolStart === undefined) return;\n        e.x += e._patrolDir * speed * data.dt;\n        if (e.x > e._patrolStart + range) e._patrolDir = -1;\n        if (e.x < e._patrolStart - range) e._patrolDir = 1;\n        if (e.scale) e.scale.x = e._patrolDir;\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('enemy-chase', 'Enemy Chase', 'Follow player when within detection range', 'Enemies/AI', 'instruction', '2d', '1.0.0',
 '["enemy","chase","follow","ai","pursuit"]',
 '[{"name":"speed","type":"number","default":120,"min":40,"max":300,"description":"Chase speed"},{"name":"detectRange","type":"number","default":250,"min":100,"max":600,"description":"Detection range"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var speed = config.speed || 120;\n  var detectRange = config.detectRange || 250;\n  return {\n    id: ''enemy-chase'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''enemy.update'' && data && data.enemy && data.player) {\n        var e = data.enemy;\n        var p = data.player;\n        var dx = p.x - e.x;\n        var dy = p.y - e.y;\n        var dist = Math.sqrt(dx*dx + dy*dy);\n        if (dist < detectRange && dist > 5) {\n          e.x += (dx / dist) * speed * data.dt;\n          if (e.scale) e.scale.x = dx > 0 ? 1 : -1;\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('enemy-fly', 'Flying Enemy', 'Flying enemy with sine-wave movement pattern', 'Enemies/AI', 'instruction', '2d', '1.0.0',
 '["enemy","fly","flying","sine","ai"]',
 '[{"name":"speed","type":"number","default":60,"min":20,"max":200,"description":"Horizontal fly speed"},{"name":"amplitude","type":"number","default":80,"min":20,"max":200,"description":"Vertical wave amplitude"},{"name":"frequency","type":"number","default":2,"min":0.5,"max":5,"description":"Wave frequency"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var speed = config.speed || 60;\n  var amp = config.amplitude || 80;\n  var freq = config.frequency || 2;\n  return {\n    id: ''enemy-fly'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''enemy.spawn'' && data && data.enemy) {\n        data.enemy._flyBaseY = data.enemy.y;\n        data.enemy._flyTime = Math.random() * 6;\n        data.enemy._flyDir = Math.random() > 0.5 ? 1 : -1;\n      }\n      if (event === ''enemy.update'' && data && data.enemy) {\n        var e = data.enemy;\n        if (e._flyBaseY === undefined) return;\n        e._flyTime += data.dt;\n        e.x += e._flyDir * speed * data.dt;\n        e.y = e._flyBaseY + Math.sin(e._flyTime * freq) * amp;\n        if (e.scale) e.scale.x = e._flyDir;\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('enemy-shoot', 'Ranged Enemy', 'Enemy that fires projectiles at the player', 'Enemies/AI', 'instruction', '2d', '1.0.0',
 '["enemy","shoot","ranged","projectile","ai"]',
 '[{"name":"fireRate","type":"number","default":2.0,"min":0.5,"max":5.0,"description":"Seconds between shots"},{"name":"bulletSpeed","type":"number","default":200,"min":100,"max":500,"description":"Projectile speed"},{"name":"detectRange","type":"number","default":350,"min":150,"max":600,"description":"Range to detect and fire at player"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var fireRate = config.fireRate || 2.0;\n  var bulletSpeed = config.bulletSpeed || 200;\n  var detectRange = config.detectRange || 350;\n  return {\n    id: ''enemy-shoot'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''enemy.spawn'' && data && data.enemy) {\n        data.enemy._shootTimer = fireRate * Math.random();\n      }\n      if (event === ''enemy.update'' && data && data.enemy && data.player) {\n        var e = data.enemy;\n        var p = data.player;\n        var dx = p.x - e.x;\n        var dist = Math.abs(dx);\n        if (e._shootTimer === undefined) e._shootTimer = 0;\n        e._shootTimer -= data.dt;\n        if (dist < detectRange && e._shootTimer <= 0) {\n          e._shootTimer = fireRate;\n          var dir = dx > 0 ? 1 : -1;\n          data.engine.features.emit(''enemy.projectile'', { x: e.x + dir * 15, y: e.y, vx: dir * bulletSpeed });\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('enemy-boss', 'Boss Enemy', 'Large enemy with multiple attack phases and health bar', 'Enemies/AI', 'instruction', '2d', '1.0.0',
 '["enemy","boss","phases","ai","miniboss"]',
 '[{"name":"health","type":"number","default":10,"min":3,"max":50,"description":"Boss health points"},{"name":"phaseThresholds","type":"string","default":"0.6,0.3","description":"Health % thresholds for phase changes (comma-separated)"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var maxHP = config.health || 10;\n  var thresholds = (config.phaseThresholds || ''0.6,0.3'').split('','').map(Number);\n  var hp = maxHP;\n  var phase = 0;\n  return {\n    id: ''enemy-boss'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''boss.hit'' && data) {\n        hp -= data.damage || 1;\n        var ratio = hp / maxHP;\n        var newPhase = 0;\n        for (var i = 0; i < thresholds.length; i++) {\n          if (ratio <= thresholds[i]) newPhase = i + 1;\n        }\n        if (newPhase !== phase) {\n          phase = newPhase;\n          if (data.engine) {\n            data.engine.juice.shake(data.engine.world, 10, 0.3);\n            data.engine.features.emit(''boss.phase'', { phase: phase, hp: hp, maxHP: maxHP });\n          }\n        }\n        if (hp <= 0) {\n          if (data.engine) {\n            data.engine.effects.explosion(data.x || 0, data.y || 0);\n            data.engine.features.emit(''boss.defeated'', {});\n          }\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

-- ============================================================================
-- COLLECTIBLES / ITEMS (5)
-- ============================================================================

('coin-collect', 'Coin Collect', 'Pickup coins with score increment and sparkle effect', 'Collectibles/Items', 'instruction', '2d', '1.0.0',
 '["coin","collect","score","pickup","item"]',
 '[{"name":"value","type":"number","default":10,"min":1,"max":100,"description":"Score value per coin"}]',
 '[]', '["platformer","runner","puzzle"]',
 E'function create(config) {\n  var value = config.value || 10;\n  return {\n    id: ''coin-collect'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''player.collect.coin'' && data) {\n        data.engine.effects.sparkle(data.x, data.y);\n        data.engine.juice.pop(data.coin);\n        data.engine.features.emit(''score.add'', { amount: value });\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('coin-magnet', 'Coin Magnet', 'Attract nearby coins toward the player', 'Collectibles/Items', 'instruction', '2d', '1.0.0',
 '["coin","magnet","attract","pull","item"]',
 '[{"name":"range","type":"number","default":150,"min":50,"max":400,"description":"Magnet attraction range"},{"name":"pullSpeed","type":"number","default":300,"min":100,"max":600,"description":"Pull speed toward player"}]',
 '[]', '["platformer","runner"]',
 E'function create(config) {\n  var range = config.range || 150;\n  var pullSpeed = config.pullSpeed || 300;\n  return {\n    id: ''coin-magnet'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''coins.update'' && data && data.coins && data.player) {\n        for (var i = 0; i < data.coins.length; i++) {\n          var c = data.coins[i];\n          var dx = data.player.x - c.x;\n          var dy = data.player.y - c.y;\n          var dist = Math.sqrt(dx*dx + dy*dy);\n          if (dist < range && dist > 5) {\n            c.x += (dx / dist) * pullSpeed * data.dt;\n            c.y += (dy / dist) * pullSpeed * data.dt;\n          }\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('power-up-speed', 'Speed Boost', 'Temporary speed boost power-up with trail effect', 'Collectibles/Items', 'instruction', '2d', '1.0.0',
 '["powerup","speed","boost","fast","item"]',
 '[{"name":"multiplier","type":"number","default":1.8,"min":1.2,"max":3.0,"description":"Speed multiplier"},{"name":"duration","type":"number","default":5.0,"min":2.0,"max":15.0,"description":"Duration in seconds"}]',
 '[]', '["platformer","runner"]',
 E'function create(config) {\n  var mult = config.multiplier || 1.8;\n  var duration = config.duration || 5.0;\n  var timer = 0;\n  var active = false;\n  return {\n    id: ''power-up-speed'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      if (!active) return;\n      timer -= dt;\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (player && player.body) {\n        player.body.vx *= mult;\n        if (Math.random() < 0.3) engine.effects.trail(player, 0xffaa00);\n      }\n      if (timer <= 0) {\n        active = false;\n        if (player) player.tint = 0xffffff;\n      }\n    },\n    onEvent: function(event) {\n      if (event === ''powerup.speed'') { active = true; timer = duration; }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('power-up-invincible', 'Invincibility Star', 'Temporary invincibility with glow and particles', 'Collectibles/Items', 'instruction', '2d', '1.0.0',
 '["powerup","invincible","star","shield","item"]',
 '[{"name":"duration","type":"number","default":8.0,"min":3.0,"max":20.0,"description":"Invincibility duration"}]',
 '[]', '["platformer","runner"]',
 E'function create(config) {\n  var duration = config.duration || 8.0;\n  var timer = 0;\n  var active = false;\n  return {\n    id: ''power-up-invincible'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      if (!active) return;\n      timer -= dt;\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (player) {\n        player.tint = Math.random() > 0.5 ? 0xffff00 : 0xff00ff;\n        if (Math.random() < 0.1) engine.effects.sparkle(player.x, player.y - 20);\n      }\n      if (timer <= 0) {\n        active = false;\n        if (player) player.tint = 0xffffff;\n      }\n    },\n    onEvent: function(event, data) {\n      if (event === ''powerup.invincible'') { active = true; timer = duration; }\n      if (event === ''damage.incoming'' && active && data) { data.damage = 0; data.blocked = true; }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('health-pickup', 'Health Pickup', 'Restore health or lives on pickup', 'Collectibles/Items', 'instruction', '2d', '1.0.0',
 '["health","heal","restore","heart","item"]',
 '[{"name":"healAmount","type":"number","default":1,"min":1,"max":5,"description":"Health points restored"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var healAmount = config.healAmount || 1;\n  return {\n    id: ''health-pickup'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''player.collect.health'' && data) {\n        data.engine.effects.sparkle(data.x, data.y);\n        data.engine.juice.pop(data.item);\n        data.engine.features.emit(''health.restore'', { amount: healAmount });\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

-- ============================================================================
-- LEVEL / WORLD (6)
-- ============================================================================

('moving-platform', 'Moving Platform', 'Platform that moves along a defined path', 'Level/World', 'instruction', '2d', '1.0.0',
 '["platform","moving","path","level"]',
 '[{"name":"speed","type":"number","default":60,"min":20,"max":200,"description":"Movement speed"},{"name":"range","type":"number","default":150,"min":50,"max":500,"description":"Movement range"}]',
 '[]', '["platformer"]',
 E'function create(config) {\n  var speed = config.speed || 60;\n  var range = config.range || 150;\n  return {\n    id: ''moving-platform'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''platform.spawn.moving'' && data) {\n        data.platform._moveStart = data.platform.y;\n        data.platform._moveDir = 1;\n        data.platform._moveAxis = data.axis || ''y'';\n      }\n      if (event === ''platforms.update'' && data && data.platforms) {\n        for (var i = 0; i < data.platforms.length; i++) {\n          var p = data.platforms[i];\n          if (p._moveStart === undefined) continue;\n          var axis = p._moveAxis || ''y'';\n          p[axis] += p._moveDir * speed * data.dt;\n          if (p[axis] > p._moveStart + range) p._moveDir = -1;\n          if (p[axis] < p._moveStart - range) p._moveDir = 1;\n          if (p.body) p.body[axis] = p[axis];\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('breakable-block', 'Breakable Block', 'Block that shatters when hit with particle debris', 'Level/World', 'instruction', '2d', '1.0.0',
 '["breakable","block","shatter","destroy","level"]',
 '[{"name":"hitsToBreak","type":"number","default":1,"min":1,"max":5,"description":"Hits required to break"},{"name":"debrisCount","type":"number","default":6,"min":3,"max":15,"description":"Number of debris particles"}]',
 '[]', '["platformer","puzzle"]',
 E'function create(config) {\n  var hitsToBreak = config.hitsToBreak || 1;\n  return {\n    id: ''breakable-block'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''block.hit'' && data && data.block) {\n        if (!data.block._hits) data.block._hits = 0;\n        data.block._hits++;\n        data.engine.juice.shake(data.block, 3, 0.1);\n        if (data.block._hits >= hitsToBreak) {\n          data.engine.effects.explosion(data.block.x, data.block.y);\n          data.engine.features.emit(''block.destroyed'', { block: data.block });\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('spike-trap', 'Spike Trap', 'Stationary hazard that damages player on contact', 'Level/World', 'instruction', '2d', '1.0.0',
 '["spike","trap","hazard","damage","level"]',
 '[{"name":"damage","type":"number","default":1,"min":1,"max":5,"description":"Damage on contact"},{"name":"knockbackForce","type":"number","default":200,"min":50,"max":500,"description":"Knockback force"}]',
 '[]', '["platformer","runner"]',
 E'function create(config) {\n  var damage = config.damage || 1;\n  var knockback = config.knockbackForce || 200;\n  return {\n    id: ''spike-trap'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''player.collide.spike'' && data) {\n        data.engine.features.emit(''player.damaged'', { damage: damage });\n        data.engine.features.emit(''entity.damaged'', { target: data.player, fromX: data.spike.x, engine: data.engine });\n        data.engine.juice.shake(data.engine.world, 8, 0.2);\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('spring-pad', 'Spring Pad', 'Bounces player high with satisfying squash effect', 'Level/World', 'instruction', '2d', '1.0.0',
 '["spring","bounce","jump","pad","level"]',
 '[{"name":"bounceForce","type":"number","default":700,"min":400,"max":1200,"description":"Upward bounce force"}]',
 '[]', '["platformer"]',
 E'function create(config) {\n  var bounceForce = config.bounceForce || 700;\n  return {\n    id: ''spring-pad'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''player.collide.spring'' && data && data.player) {\n        data.player.body.vy = -bounceForce;\n        data.engine.juice.squash(data.player);\n        data.engine.juice.squash(data.spring, 0.5, 1.4);\n        data.engine.effects.dust(data.spring.x, data.spring.y);\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('checkpoint', 'Checkpoint', 'Save respawn position with flag animation', 'Level/World', 'instruction', '2d', '1.0.0',
 '["checkpoint","save","respawn","flag","level"]',
 '[]',
 '[]', '["platformer","runner"]',
 E'function create(config) {\n  var spawnX = 0;\n  var spawnY = 0;\n  var activated = new Set();\n  return {\n    id: ''checkpoint'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''player.collide.checkpoint'' && data) {\n        var id = data.checkpointId || (data.checkpoint.x + ''-'' + data.checkpoint.y);\n        if (!activated.has(id)) {\n          activated.add(id);\n          spawnX = data.checkpoint.x;\n          spawnY = data.checkpoint.y;\n          data.engine.juice.pop(data.checkpoint);\n          data.engine.effects.sparkle(data.checkpoint.x, data.checkpoint.y - 20);\n        }\n      }\n      if (event === ''player.respawn'' && data && data.player) {\n        if (spawnX || spawnY) {\n          data.player.x = spawnX;\n          data.player.y = spawnY;\n          if (data.player.body) { data.player.body.x = spawnX; data.player.body.y = spawnY; data.player.body.vx = 0; data.player.body.vy = 0; }\n        }\n      }\n    },\n    destroy: function() { activated.clear(); }\n  };\n}', true, true),

('portal-teleport', 'Portal Teleport', 'Teleport between two linked portal points', 'Level/World', 'instruction', '2d', '1.0.0',
 '["portal","teleport","warp","transport","level"]',
 '[{"name":"cooldown","type":"number","default":1.0,"min":0.3,"max":3.0,"description":"Cooldown between teleports"}]',
 '[]', '["platformer","puzzle"]',
 E'function create(config) {\n  var cooldown = config.cooldown || 1.0;\n  var cdTimer = 0;\n  return {\n    id: ''portal-teleport'',\n    init: function(engine) {},\n    update: function(engine, dt) { cdTimer -= dt; },\n    onEvent: function(event, data) {\n      if (event === ''player.collide.portal'' && data && cdTimer <= 0) {\n        cdTimer = cooldown;\n        var dest = data.destination;\n        if (dest && data.player) {\n          data.engine.effects.magic(data.player.x, data.player.y);\n          data.player.x = dest.x;\n          data.player.y = dest.y;\n          if (data.player.body) { data.player.body.x = dest.x; data.player.body.y = dest.y; }\n          data.engine.effects.magic(dest.x, dest.y);\n          data.engine.juice.flash(data.player, 0x8800ff, 0.2);\n        }\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

-- ============================================================================
-- EFFECTS / VISUAL (5)
-- ============================================================================

('rain-weather', 'Rain Weather', 'Rain particles with puddle splashes on ground', 'Effects/Visual', 'instruction', '2d', '1.0.0',
 '["rain","weather","particles","water","effect"]',
 '[{"name":"intensity","type":"number","default":0.5,"min":0.1,"max":1.0,"description":"Rain intensity (0-1)"}]',
 '[]', '["platformer","runner","puzzle"]',
 E'function create(config) {\n  var intensity = config.intensity || 0.5;\n  return {\n    id: ''rain-weather'',\n    init: function(engine) {\n      engine.effects.rain(intensity);\n    },\n    update: function(engine, dt) {},\n    destroy: function() {}\n  };\n}', true, true),

('snow-weather', 'Snow Weather', 'Gentle snowfall with accumulation effect', 'Effects/Visual', 'instruction', '2d', '1.0.0',
 '["snow","weather","particles","winter","effect"]',
 '[{"name":"intensity","type":"number","default":0.4,"min":0.1,"max":1.0,"description":"Snow intensity (0-1)"}]',
 '[]', '["platformer","runner","puzzle"]',
 E'function create(config) {\n  var intensity = config.intensity || 0.4;\n  return {\n    id: ''snow-weather'',\n    init: function(engine) {\n      engine.effects.snow(intensity);\n    },\n    update: function(engine, dt) {},\n    destroy: function() {}\n  };\n}', true, true),

('ambient-particles', 'Ambient Particles', 'Theme-based ambient particles (fireflies, embers, dust, leaves, pollen)', 'Effects/Visual', 'instruction', '2d', '1.0.0',
 '["ambient","particles","atmosphere","effect"]',
 '[{"name":"type","type":"select","default":"fireflies","options":["fireflies","embers","dust","leaves","pollen"],"description":"Ambient particle type"}]',
 '[]', '["platformer","runner","puzzle","shooter"]',
 E'function create(config) {\n  var type = config.type || ''fireflies'';\n  return {\n    id: ''ambient-particles'',\n    init: function(engine) {\n      engine.effects.ambient(type);\n    },\n    update: function(engine, dt) {},\n    destroy: function() {}\n  };\n}', true, true),

('parallax-background', 'Parallax Background', 'Multi-layer scrolling background with depth', 'Effects/Visual', 'instruction', '2d', '1.0.0',
 '["parallax","background","scroll","depth","effect"]',
 '[{"name":"layers","type":"number","default":3,"min":2,"max":5,"description":"Number of parallax layers"}]',
 '[]', '["platformer","runner","shooter"]',
 E'function create(config) {\n  var layerCount = config.layers || 3;\n  var layers = [];\n  return {\n    id: ''parallax-background'',\n    init: function(engine) {\n      for (var i = 0; i < layerCount; i++) {\n        var speed = 0.1 + i * 0.15;\n        layers.push({ speed: speed, offset: 0 });\n      }\n    },\n    update: function(engine, dt) {\n      var camX = engine.camera ? engine.camera.x || 0 : 0;\n      for (var i = 0; i < layers.length; i++) {\n        layers[i].offset = -camX * layers[i].speed;\n      }\n    },\n    destroy: function() { layers = []; }\n  };\n}', true, true),

('day-night-cycle', 'Day Night Cycle', 'Gradual sky color transition simulating time of day', 'Effects/Visual', 'instruction', '2d', '1.0.0',
 '["day","night","cycle","sky","time","effect"]',
 '[{"name":"cycleDuration","type":"number","default":120,"min":30,"max":600,"description":"Full cycle duration in seconds"},{"name":"nightTint","type":"color","default":"0x1a1a3e","description":"Night sky tint color"}]',
 '[]', '["platformer","runner"]',
 E'function create(config) {\n  var cycleDur = config.cycleDuration || 120;\n  var nightTint = parseInt(config.nightTint) || 0x1a1a3e;\n  var time = 0;\n  var overlay = null;\n  return {\n    id: ''day-night-cycle'',\n    init: function(engine) {\n      var PIXI = (window as any).PIXI;\n      overlay = new PIXI.Graphics();\n      overlay.rect(0, 0, engine.config.width * 3, engine.config.height * 2).fill({color: nightTint});\n      overlay.alpha = 0;\n      overlay.zIndex = 9000;\n      engine.world.addChild(overlay);\n    },\n    update: function(engine, dt) {\n      time += dt;\n      var progress = (time % cycleDur) / cycleDur;\n      var nightAmount = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;\n      if (overlay) overlay.alpha = nightAmount * 0.6;\n    },\n    destroy: function() { if (overlay && overlay.parent) overlay.parent.removeChild(overlay); }\n  };\n}', true, true),

-- ============================================================================
-- UI / HUD (4)
-- ============================================================================

('health-display', 'Health Display', 'Hearts or health bar HUD element', 'UI/HUD', 'instruction', '2d', '1.0.0',
 '["health","hearts","hud","ui","display"]',
 '[{"name":"maxHealth","type":"number","default":3,"min":1,"max":10,"description":"Maximum health/hearts"},{"name":"style","type":"select","default":"hearts","options":["hearts","bar"],"description":"Display style"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var maxHP = config.maxHealth || 3;\n  var hp = maxHP;\n  return {\n    id: ''health-display'',\n    init: function(engine) {\n      engine.ui.healthBar(10, 10, { maxHealth: maxHP, style: config.style || ''hearts'' });\n    },\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''health.change'' && data) { hp = data.health; }\n      if (event === ''health.restore'' && data) { hp = Math.min(maxHP, hp + (data.amount || 1)); }\n      if (event === ''player.damaged'' && data) { hp = Math.max(0, hp - (data.damage || 1)); }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('score-counter', 'Score Counter', 'Animated score display with juice on change', 'UI/HUD', 'instruction', '2d', '1.0.0',
 '["score","counter","points","hud","ui"]',
 '[{"name":"prefix","type":"string","default":"Score: ","description":"Text prefix before score"},{"name":"fontSize","type":"number","default":24,"min":16,"max":48,"description":"Font size"}]',
 '[]', '["platformer","runner","shooter","puzzle"]',
 E'function create(config) {\n  var score = 0;\n  var scoreText = null;\n  return {\n    id: ''score-counter'',\n    init: function(engine) {\n      scoreText = engine.ui.score(engine.config.width - 150, 10, { prefix: config.prefix || ''Score: '', fontSize: config.fontSize || 24 });\n    },\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''score.add'' && data) {\n        score += data.amount || 0;\n        if (scoreText) { scoreText.text = (config.prefix || ''Score: '') + score; engine.juice.pop(scoreText); }\n      }\n      if (event === ''score.set'' && data) {\n        score = data.score || 0;\n        if (scoreText) scoreText.text = (config.prefix || ''Score: '') + score;\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('timer-countdown', 'Timer Countdown', 'Countdown timer with urgency effects when low', 'UI/HUD', 'instruction', '2d', '1.0.0',
 '["timer","countdown","time","clock","hud","ui"]',
 '[{"name":"seconds","type":"number","default":120,"min":10,"max":600,"description":"Starting time in seconds"},{"name":"urgencyThreshold","type":"number","default":30,"min":5,"max":60,"description":"Seconds remaining to trigger urgency effect"}]',
 '[]', '["platformer","runner","puzzle"]',
 E'function create(config) {\n  var timeLeft = config.seconds || 120;\n  var urgency = config.urgencyThreshold || 30;\n  var timerText = null;\n  return {\n    id: ''timer-countdown'',\n    init: function(engine) {\n      timerText = engine.ui.timer(engine.config.width / 2 - 40, 10, { seconds: timeLeft, countDown: true, urgencyThreshold: urgency });\n    },\n    update: function(engine, dt) {\n      timeLeft -= dt;\n      if (timeLeft <= 0) {\n        timeLeft = 0;\n        engine.features.emit(''timer.expired'', {});\n      }\n      if (timerText) {\n        var m = Math.floor(timeLeft / 60);\n        var s = Math.floor(timeLeft % 60);\n        timerText.text = m + '':'' + (s < 10 ? ''0'' : '''') + s;\n        if (timeLeft <= urgency) timerText.style.fill = 0xff4444;\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('minimap', 'Minimap', 'Small overview map showing player and key objects', 'UI/HUD', 'instruction', '2d', '1.0.0',
 '["minimap","map","overview","radar","hud","ui"]',
 '[{"name":"width","type":"number","default":150,"min":80,"max":250,"description":"Minimap width"},{"name":"height","type":"number","default":100,"min":60,"max":180,"description":"Minimap height"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var w = config.width || 150;\n  var h = config.height || 100;\n  var container = null;\n  var dot = null;\n  return {\n    id: ''minimap'',\n    init: function(engine) {\n      var PIXI = (window as any).PIXI;\n      container = new PIXI.Graphics();\n      container.roundRect(0, 0, w, h, 6).fill({color: 0x000000, alpha: 0.4});\n      container.x = engine.config.width - w - 10;\n      container.y = engine.config.height - h - 10;\n      engine.uiLayer.addChild(container);\n      dot = new PIXI.Graphics();\n      dot.circle(0, 0, 3).fill({color: 0x00ff00});\n      container.addChild(dot);\n    },\n    update: function(engine, dt) {\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (player && dot) {\n        var scaleX = w / (engine.config.worldWidth || 4000);\n        var scaleY = h / (engine.config.worldHeight || 800);\n        dot.x = player.x * scaleX;\n        dot.y = player.y * scaleY;\n      }\n    },\n    destroy: function() { if (container && container.parent) container.parent.removeChild(container); }\n  };\n}', true, true),

-- ============================================================================
-- SYSTEMS (5)
-- ============================================================================

('lives-system', 'Lives System', 'Life count with game over flow and respawn', 'Systems', 'instruction', '2d', '1.0.0',
 '["lives","death","gameover","respawn","system"]',
 '[{"name":"startingLives","type":"number","default":3,"min":1,"max":9,"description":"Starting number of lives"}]',
 '[]', '["platformer","shooter"]',
 E'function create(config) {\n  var lives = config.startingLives || 3;\n  return {\n    id: ''lives-system'',\n    init: function(engine) {},\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''player.damaged'') {\n        lives--;\n        if (lives <= 0) {\n          engine.features.emit(''game.over'', { reason: ''no-lives'' });\n        } else {\n          engine.features.emit(''player.respawn'', {});\n          engine.features.emit(''lives.changed'', { lives: lives });\n        }\n      }\n      if (event === ''lives.add'') {\n        lives += (data && data.amount) || 1;\n        engine.features.emit(''lives.changed'', { lives: lives });\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('combo-system', 'Combo System', 'Chain kills or collects for score multiplier', 'Systems', 'instruction', '2d', '1.0.0',
 '["combo","chain","multiplier","streak","system"]',
 '[{"name":"comboWindow","type":"number","default":2.0,"min":0.5,"max":5.0,"description":"Seconds to chain next action"},{"name":"maxMultiplier","type":"number","default":10,"min":2,"max":50,"description":"Maximum combo multiplier"}]',
 '[]', '["platformer","runner","shooter"]',
 E'function create(config) {\n  var window = config.comboWindow || 2.0;\n  var maxMult = config.maxMultiplier || 10;\n  var combo = 0;\n  var timer = 0;\n  return {\n    id: ''combo-system'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      if (combo > 0) {\n        timer -= dt;\n        if (timer <= 0) {\n          combo = 0;\n          engine.features.emit(''combo.reset'', {});\n        }\n      }\n    },\n    onEvent: function(event, data) {\n      if (event === ''combo.hit'' || event === ''enemy.killed'' || event === ''score.add'') {\n        combo++;\n        timer = window;\n        var mult = Math.min(combo, maxMult);\n        engine.features.emit(''combo.changed'', { combo: combo, multiplier: mult });\n        if (data && data.amount) data.amount *= mult;\n      }\n    },\n    destroy: function() {}\n  };\n}', true, true),

('difficulty-scaling', 'Difficulty Scaling', 'Enemies get harder over time (speed, count, damage)', 'Systems', 'instruction', '2d', '1.0.0',
 '["difficulty","scaling","harder","progression","system"]',
 '[{"name":"scalingRate","type":"number","default":0.05,"min":0.01,"max":0.2,"description":"Difficulty increase per minute"},{"name":"maxScale","type":"number","default":3.0,"min":1.5,"max":5.0,"description":"Maximum difficulty multiplier"}]',
 '[]', '["runner","shooter"]',
 E'function create(config) {\n  var rate = config.scalingRate || 0.05;\n  var maxScale = config.maxScale || 3.0;\n  var elapsed = 0;\n  return {\n    id: ''difficulty-scaling'',\n    init: function(engine) {},\n    update: function(engine, dt) {\n      elapsed += dt;\n      var scale = Math.min(1 + elapsed / 60 * rate * 10, maxScale);\n      engine.features.emit(''difficulty.scale'', { scale: scale, elapsed: elapsed });\n    },\n    destroy: function() {}\n  };\n}', true, true),

('camera-follow', 'Camera Follow', 'Smooth camera following with dead zones and world bounds', 'Systems', 'instruction', '2d', '1.0.0',
 '["camera","follow","smooth","scroll","system"]',
 '[{"name":"smoothing","type":"number","default":0.08,"min":0.01,"max":0.3,"description":"Camera smoothing (lower = smoother)"},{"name":"deadZoneX","type":"number","default":50,"min":0,"max":200,"description":"Horizontal dead zone"},{"name":"deadZoneY","type":"number","default":30,"min":0,"max":150,"description":"Vertical dead zone"}]',
 '[]', '["platformer","runner","shooter"]',
 E'function create(config) {\n  var smoothing = config.smoothing || 0.08;\n  return {\n    id: ''camera-follow'',\n    init: function(engine) {\n      var player = engine.getPlayer ? engine.getPlayer() : null;\n      if (player) {\n        engine.camera.follow(player);\n        engine.camera.smoothing = smoothing;\n        engine.camera.deadZoneX = config.deadZoneX || 50;\n        engine.camera.deadZoneY = config.deadZoneY || 30;\n      }\n    },\n    update: function(engine, dt) {},\n    destroy: function() {}\n  };\n}', true, true),

('screen-transition', 'Screen Transition', 'Fade or wipe transition between scenes', 'Systems', 'instruction', '2d', '1.0.0',
 '["transition","fade","wipe","scene","system"]',
 '[{"name":"duration","type":"number","default":0.5,"min":0.1,"max":2.0,"description":"Transition duration"},{"name":"color","type":"color","default":"0x000000","description":"Transition overlay color"}]',
 '[]', '["platformer","runner","shooter","puzzle"]',
 E'function create(config) {\n  var duration = config.duration || 0.5;\n  var color = parseInt(config.color) || 0x000000;\n  var overlay = null;\n  return {\n    id: ''screen-transition'',\n    init: function(engine) {\n      var PIXI = (window as any).PIXI;\n      overlay = new PIXI.Graphics();\n      overlay.rect(0, 0, engine.config.width, engine.config.height).fill({color: color});\n      overlay.alpha = 0;\n      overlay.zIndex = 99999;\n      engine.uiLayer.addChild(overlay);\n    },\n    update: function(engine, dt) {},\n    onEvent: function(event, data) {\n      if (event === ''transition.start'' && overlay) {\n        var gsap = (window as any).gsap;\n        if (gsap) {\n          gsap.to(overlay, { alpha: 1, duration: duration / 2, onComplete: function() {\n            engine.features.emit(''transition.midpoint'', data);\n            gsap.to(overlay, { alpha: 0, duration: duration / 2 });\n          }});\n        }\n      }\n    },\n    destroy: function() { if (overlay && overlay.parent) overlay.parent.removeChild(overlay); }\n  };\n}', true, true);

-- Done! Verify count
SELECT count(*) AS total_features FROM feature_bank_snippets;
SELECT category, count(*) AS count FROM feature_bank_snippets GROUP BY category ORDER BY category;
