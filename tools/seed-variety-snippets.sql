-- Feature Bank Variety Snippets
-- 25+ snippets for enemy behaviors, platform types, visual styles, gameplay systems, atmospheres
-- Run via: PGPASSWORD=V1bexe2026Pg psql -h 127.0.0.1 -U vibexe -d vibexe -f tools/seed-variety-snippets.sql

-- Clean previous variety snippets (idempotent)
DELETE FROM feature_bank_snippets WHERE id IN (
  'enemy-patrol', 'enemy-chase', 'enemy-ranged', 'enemy-swarm', 'enemy-flying', 'enemy-boss',
  'platform-moving', 'platform-crumbling', 'platform-ice', 'platform-bounce', 'platform-disappearing',
  'style-neon-glow', 'style-pixel-retro', 'style-painterly', 'style-cartoon-bold',
  'system-timer', 'system-keys-gates', 'system-checkpoint', 'system-combo', 'system-powerup-magnet', 'system-wall-jump',
  'atmosphere-warm', 'atmosphere-cold', 'atmosphere-dark', 'atmosphere-underwater', 'atmosphere-storm'
);

-- ===== ENEMY BEHAVIOR SNIPPETS =====

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'enemy-patrol',
  'Patrol Enemy',
  'Basic enemy that walks back and forth between two points. Configurable speed, patrol distance, and visual size.',
  'Enemy Behaviors',
  'feature',
  '2d',
  '1.0.0',
  '["enemy", "patrol", "walk", "guard"]'::jsonb,
  '[{"name":"speed","type":"number","default":60},{"name":"distance","type":"number","default":150},{"name":"size","type":"number","default":36}]'::jsonb,
  '[]'::jsonb,
  '["platformer","runner"]'::jsonb,
  'function create(cfg) {
  var enemies = [];
  return {
    id: "enemy-patrol",
    init: function(engine) {
      // Enemies are created by the scene — this feature manages patrol behavior
    },
    update: function(engine, dt) {
      // Override: scene should call this.patrol(enemy, dt) for each enemy
    },
    destroy: function() { enemies = []; },
    onEvent: function(ev, data) {},
    // Helper: add an enemy to patrol management
    addEnemy: function(body, startX) {
      enemies.push({ body: body, startX: startX, dir: 1 });
    },
    patrolAll: function(dt) {
      var speed = cfg.speed || 60;
      var dist = cfg.distance || 150;
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        e.body.x += e.dir * speed * dt;
        if (e.body.sprite) e.body.sprite.x = e.body.x;
        if (Math.abs(e.body.x - e.startX) > dist) {
          e.dir *= -1;
          if (e.body.sprite) e.body.sprite.scale.x = e.dir > 0 ? 1 : -1;
        }
      }
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'enemy-chase',
  'Chase Enemy',
  'Enemy that detects the player within a configurable range and chases aggressively. Speed increases when pursuing.',
  'Enemy Behaviors',
  'feature',
  '2d',
  '1.0.0',
  '["enemy", "chase", "aggressive", "pursue", "hunt"]'::jsonb,
  '[{"name":"chaseSpeed","type":"number","default":140},{"name":"detectionRange","type":"number","default":300},{"name":"idleSpeed","type":"number","default":40}]'::jsonb,
  '[]'::jsonb,
  '["platformer"]'::jsonb,
  'function create(cfg) {
  var enemies = [];
  var playerBody = null;
  return {
    id: "enemy-chase",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { enemies = []; playerBody = null; },
    onEvent: function(ev, data) {},
    setPlayer: function(body) { playerBody = body; },
    addEnemy: function(body, startX) {
      enemies.push({ body: body, startX: startX, chasing: false });
    },
    chaseAll: function(dt) {
      if (!playerBody) return;
      var chaseSpd = cfg.chaseSpeed || 140;
      var range = cfg.detectionRange || 300;
      var idleSpd = cfg.idleSpeed || 40;
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        var dx = playerBody.x - e.body.x;
        var dist = Math.abs(dx);
        e.chasing = dist < range;
        var spd = e.chasing ? chaseSpd : idleSpd;
        var dir = e.chasing ? (dx > 0 ? 1 : -1) : (Math.sin(Date.now() * 0.001 + i) > 0 ? 1 : -1);
        e.body.x += dir * spd * dt;
        if (e.body.sprite) {
          e.body.sprite.x = e.body.x;
          e.body.sprite.scale.x = dir > 0 ? 1 : -1;
          e.body.sprite.tint = e.chasing ? 0xFF4444 : 0xFFFFFF;
        }
      }
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'enemy-ranged',
  'Ranged Enemy',
  'Enemy that stands at distance and fires projectiles at the player on a configurable interval.',
  'Enemy Behaviors',
  'feature',
  '2d',
  '1.0.0',
  '["enemy", "ranged", "shoot", "projectile", "tactical"]'::jsonb,
  '[{"name":"fireInterval","type":"number","default":2.5},{"name":"projectileSpeed","type":"number","default":250},{"name":"projectileColor","type":"number","default":16720896}]'::jsonb,
  '[]'::jsonb,
  '["platformer","shooter"]'::jsonb,
  'function create(cfg) {
  var shooters = [];
  var projectiles = [];
  var playerBody = null;
  var container = null;
  return {
    id: "enemy-ranged",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { shooters = []; projectiles = []; },
    onEvent: function(ev, data) {},
    setPlayer: function(body) { playerBody = body; },
    setContainer: function(c) { container = c; },
    addShooter: function(body) {
      shooters.push({ body: body, timer: cfg.fireInterval || 2.5 });
    },
    updateAll: function(dt) {
      if (!playerBody || !container) return;
      var interval = cfg.fireInterval || 2.5;
      var speed = cfg.projectileSpeed || 250;
      var color = cfg.projectileColor || 0xFF6600;
      for (var i = 0; i < shooters.length; i++) {
        var s = shooters[i];
        s.timer -= dt;
        if (s.timer <= 0) {
          s.timer = interval;
          var dir = playerBody.x > s.body.x ? 1 : -1;
          var g = new PIXI.Graphics();
          g.rect(-6, -2, 12, 4).fill({ color: color });
          g.x = s.body.x; g.y = s.body.y;
          container.addChild(g);
          projectiles.push({ gfx: g, vx: dir * speed });
        }
      }
      for (var j = projectiles.length - 1; j >= 0; j--) {
        projectiles[j].gfx.x += projectiles[j].vx * dt;
        if (projectiles[j].gfx.x < -100 || projectiles[j].gfx.x > 10000) {
          container.removeChild(projectiles[j].gfx);
          projectiles.splice(j, 1);
        }
      }
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'enemy-swarm',
  'Swarm Enemy',
  'Many small enemies that cluster together and follow the nearest one to the player. Creates overwhelming group behavior.',
  'Enemy Behaviors',
  'feature',
  '2d',
  '1.0.0',
  '["enemy", "swarm", "cluster", "group", "overwhelming"]'::jsonb,
  '[{"name":"speed","type":"number","default":80},{"name":"separationDist","type":"number","default":25}]'::jsonb,
  '[]'::jsonb,
  '["platformer","shooter"]'::jsonb,
  'function create(cfg) {
  var swarm = [];
  var playerBody = null;
  return {
    id: "enemy-swarm",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { swarm = []; },
    onEvent: function(ev, data) {},
    setPlayer: function(body) { playerBody = body; },
    addMember: function(body) { swarm.push({ body: body }); },
    updateSwarm: function(dt) {
      if (!playerBody) return;
      var spd = cfg.speed || 80;
      var sep = cfg.separationDist || 25;
      for (var i = 0; i < swarm.length; i++) {
        var m = swarm[i];
        var dx = playerBody.x - m.body.x;
        var dy = playerBody.y - m.body.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        m.body.x += (dx / dist) * spd * dt;
        m.body.y += (dy / dist) * spd * dt * 0.3;
        if (m.body.sprite) { m.body.sprite.x = m.body.x; m.body.sprite.y = m.body.y; }
        for (var j = 0; j < swarm.length; j++) {
          if (i === j) continue;
          var sx = m.body.x - swarm[j].body.x;
          var sy = m.body.y - swarm[j].body.y;
          var sd = Math.sqrt(sx * sx + sy * sy) || 1;
          if (sd < sep) { m.body.x += (sx / sd) * 2; m.body.y += (sy / sd) * 2; }
        }
      }
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'enemy-flying',
  'Flying Enemy',
  'Bat-like enemy that moves in sine wave patterns through the air. Creates aerial hazards.',
  'Enemy Behaviors',
  'feature',
  '2d',
  '1.0.0',
  '["enemy", "flying", "bat", "aerial", "sine"]'::jsonb,
  '[{"name":"speed","type":"number","default":100},{"name":"amplitude","type":"number","default":60},{"name":"frequency","type":"number","default":2}]'::jsonb,
  '[]'::jsonb,
  '["platformer","shooter"]'::jsonb,
  'function create(cfg) {
  var flyers = [];
  return {
    id: "enemy-flying",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { flyers = []; },
    onEvent: function(ev, data) {},
    addFlyer: function(body, baseY) {
      flyers.push({ body: body, baseY: baseY, t: Math.random() * Math.PI * 2, dir: 1 });
    },
    updateFlyers: function(dt) {
      var spd = cfg.speed || 100;
      var amp = cfg.amplitude || 60;
      var freq = cfg.frequency || 2;
      for (var i = 0; i < flyers.length; i++) {
        var f = flyers[i];
        f.t += dt * freq;
        f.body.x += f.dir * spd * dt;
        f.body.y = f.baseY + Math.sin(f.t) * amp;
        if (f.body.sprite) { f.body.sprite.x = f.body.x; f.body.sprite.y = f.body.y; }
      }
    }
  };
}',
  true, true
);

-- ===== PLATFORM VARIETY SNIPPETS =====

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'platform-moving',
  'Moving Platform',
  'Platform that moves horizontally or vertically between two points. Player rides along.',
  'Platform Types',
  'feature',
  '2d',
  '1.0.0',
  '["platform", "moving", "elevator", "horizontal", "vertical"]'::jsonb,
  '[{"name":"speed","type":"number","default":80},{"name":"distance","type":"number","default":200},{"name":"axis","type":"string","default":"x"}]'::jsonb,
  '[]'::jsonb,
  '["platformer"]'::jsonb,
  'function create(cfg) {
  var platforms = [];
  return {
    id: "platform-moving",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { platforms = []; },
    onEvent: function(ev, data) {},
    addPlatform: function(body, gfx, startX, startY) {
      platforms.push({ body: body, gfx: gfx, startX: startX, startY: startY, t: 0 });
    },
    updatePlatforms: function(dt) {
      var spd = cfg.speed || 80;
      var dist = cfg.distance || 200;
      var axis = cfg.axis || "x";
      for (var i = 0; i < platforms.length; i++) {
        var p = platforms[i];
        p.t += dt * spd / dist;
        var offset = Math.sin(p.t) * dist;
        if (axis === "x") { p.body.x = p.startX + offset; }
        else { p.body.y = p.startY + offset; }
        if (p.gfx) { p.gfx.x = p.body.x; p.gfx.y = p.body.y; }
      }
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'platform-crumbling',
  'Crumbling Platform',
  'Platform that shakes and falls after the player stands on it for a short time. Adds tension and urgency.',
  'Platform Types',
  'feature',
  '2d',
  '1.0.0',
  '["platform", "crumbling", "break", "fall", "collapse"]'::jsonb,
  '[{"name":"delay","type":"number","default":0.8},{"name":"shakeIntensity","type":"number","default":3}]'::jsonb,
  '[]'::jsonb,
  '["platformer"]'::jsonb,
  'function create(cfg) {
  var platforms = [];
  return {
    id: "platform-crumbling",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { platforms = []; },
    onEvent: function(ev, data) {},
    addPlatform: function(body, gfx) {
      platforms.push({ body: body, gfx: gfx, timer: -1, baseX: 0, baseY: 0, fallen: false });
    },
    triggerCrumble: function(body) {
      for (var i = 0; i < platforms.length; i++) {
        if (platforms[i].body === body && platforms[i].timer < 0) {
          platforms[i].timer = cfg.delay || 0.8;
          platforms[i].baseX = platforms[i].gfx.x;
          platforms[i].baseY = platforms[i].gfx.y;
        }
      }
    },
    updatePlatforms: function(dt, physics) {
      var shake = cfg.shakeIntensity || 3;
      for (var i = 0; i < platforms.length; i++) {
        var p = platforms[i];
        if (p.timer >= 0 && !p.fallen) {
          p.timer -= dt;
          p.gfx.x = p.baseX + (Math.random() - 0.5) * shake * 2;
          p.gfx.y = p.baseY + (Math.random() - 0.5) * shake;
          if (p.timer <= 0) {
            p.fallen = true;
            p.gfx.alpha = 0;
            if (physics && physics.removeBody) physics.removeBody(p.body);
          }
        }
      }
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'platform-ice',
  'Ice Platform',
  'Slippery platform with reduced friction. Player slides when changing direction.',
  'Platform Types',
  'feature',
  '2d',
  '1.0.0',
  '["platform", "ice", "slippery", "slide", "friction"]'::jsonb,
  '[{"name":"friction","type":"number","default":0.02},{"name":"color","type":"number","default":8965358}]'::jsonb,
  '[]'::jsonb,
  '["platformer"]'::jsonb,
  'function create(cfg) {
  var icePlatforms = new Set();
  return {
    id: "platform-ice",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { icePlatforms.clear(); },
    onEvent: function(ev, data) {},
    markAsIce: function(body) { icePlatforms.add(body); },
    isOnIce: function(playerBody, groundBodies) {
      for (var i = 0; i < groundBodies.length; i++) {
        if (icePlatforms.has(groundBodies[i])) return true;
      }
      return false;
    },
    applyIcePhysics: function(playerBody, dt) {
      var fric = cfg.friction || 0.02;
      playerBody.vx *= (1 - fric);
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'platform-bounce',
  'Bounce Platform',
  'Bouncy platform that launches the player upward on contact. Great for vertical traversal.',
  'Platform Types',
  'feature',
  '2d',
  '1.0.0',
  '["platform", "bounce", "spring", "jump", "launch"]'::jsonb,
  '[{"name":"bounceForce","type":"number","default":800},{"name":"color","type":"number","default":16744192}]'::jsonb,
  '[]'::jsonb,
  '["platformer"]'::jsonb,
  'function create(cfg) {
  var bouncePads = new Set();
  return {
    id: "platform-bounce",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { bouncePads.clear(); },
    onEvent: function(ev, data) {},
    markAsBounce: function(body) { bouncePads.add(body); },
    isBounce: function(body) { return bouncePads.has(body); },
    applyBounce: function(playerBody, engine) {
      playerBody.vy = -(cfg.bounceForce || 800);
      if (engine.juice) {
        engine.juice.squash(playerBody.sprite, 0.7, 1.4);
        engine.juice.shake(engine.app.stage.children[0], 4, 0.15);
      }
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'platform-disappearing',
  'Disappearing Platform',
  'Platform that fades in and out on a timer. Requires timing to traverse.',
  'Platform Types',
  'feature',
  '2d',
  '1.0.0',
  '["platform", "disappearing", "blink", "fade", "timing"]'::jsonb,
  '[{"name":"onDuration","type":"number","default":2},{"name":"offDuration","type":"number","default":1.5}]'::jsonb,
  '[]'::jsonb,
  '["platformer"]'::jsonb,
  'function create(cfg) {
  var platforms = [];
  return {
    id: "platform-disappearing",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { platforms = []; },
    onEvent: function(ev, data) {},
    addPlatform: function(body, gfx, offset) {
      platforms.push({ body: body, gfx: gfx, timer: offset || 0, visible: true });
    },
    updatePlatforms: function(dt, physics) {
      var onDur = cfg.onDuration || 2;
      var offDur = cfg.offDuration || 1.5;
      for (var i = 0; i < platforms.length; i++) {
        var p = platforms[i];
        p.timer += dt;
        var cycle = onDur + offDur;
        var phase = p.timer % cycle;
        var shouldShow = phase < onDur;
        if (shouldShow !== p.visible) {
          p.visible = shouldShow;
          p.gfx.alpha = shouldShow ? 1 : 0.15;
          p.body.sensor = !shouldShow;
        }
      }
    }
  };
}',
  true, true
);

-- ===== VISUAL STYLE SNIPPETS =====

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'style-neon-glow',
  'Neon Glow Style',
  'Applies neon glow effects: dark background, bright outlines, additive blending on key elements.',
  'Visual Styles',
  'feature',
  '2d',
  '1.0.0',
  '["style", "neon", "glow", "dark", "cyberpunk", "additive"]'::jsonb,
  '[{"name":"glowColor","type":"number","default":65535},{"name":"intensity","type":"number","default":0.8}]'::jsonb,
  '[]'::jsonb,
  '["platformer","shooter","runner"]'::jsonb,
  'function create(cfg) {
  return {
    id: "style-neon-glow",
    init: function(engine) {
      engine.app.renderer.background.color = 0x050510;
    },
    update: function(engine, dt) {},
    destroy: function() {},
    onEvent: function(ev, data) {},
    applyGlow: function(displayObject) {
      try {
        displayObject.filters = displayObject.filters || [];
        displayObject.filters.push(new PIXI.BlurFilter({ strength: 2 }));
      } catch(e) {}
    },
    drawNeonRect: function(x, y, w, h, color) {
      var g = new PIXI.Graphics();
      g.roundRect(0, 0, w, h, 3).fill({ color: 0x111122, alpha: 0.6 }).stroke({ color: color || cfg.glowColor, width: 2 });
      g.rect(2, 0, w - 4, 2).fill({ color: color || cfg.glowColor, alpha: 0.9 });
      g.x = x; g.y = y; g.pivot.set(w / 2, h);
      return g;
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'style-pixel-retro',
  'Pixel Retro Style',
  'Rounds positions to grid, applies limited palette effect, adds optional scanlines.',
  'Visual Styles',
  'feature',
  '2d',
  '1.0.0',
  '["style", "pixel", "retro", "8bit", "scanlines", "grid"]'::jsonb,
  '[{"name":"gridSize","type":"number","default":4},{"name":"scanlines","type":"boolean","default":true}]'::jsonb,
  '[]'::jsonb,
  '["platformer","shooter","puzzle"]'::jsonb,
  'function create(cfg) {
  var scanlineGfx = null;
  return {
    id: "style-pixel-retro",
    init: function(engine) {
      if (cfg.scanlines !== false) {
        scanlineGfx = new PIXI.Graphics();
        var h = 600; try { h = engine.app.screen.height; } catch(e) {}
        var w = 800; try { w = engine.app.screen.width; } catch(e) {}
        for (var y = 0; y < h; y += 4) {
          scanlineGfx.rect(0, y, w, 1).fill({ color: 0x000000, alpha: 0.08 });
        }
        engine.app.stage.addChild(scanlineGfx);
      }
    },
    update: function(engine, dt) {},
    destroy: function() { scanlineGfx = null; },
    onEvent: function(ev, data) {},
    snapToGrid: function(obj) {
      var grid = cfg.gridSize || 4;
      obj.x = Math.round(obj.x / grid) * grid;
      obj.y = Math.round(obj.y / grid) * grid;
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'style-painterly',
  'Painterly Soft Style',
  'Applies blur on backgrounds, soft edges, watercolor-like feel. Creates dreamy atmosphere.',
  'Visual Styles',
  'feature',
  '2d',
  '1.0.0',
  '["style", "painterly", "soft", "blur", "watercolor", "dreamy"]'::jsonb,
  '[{"name":"blurStrength","type":"number","default":2},{"name":"bgAlpha","type":"number","default":0.85}]'::jsonb,
  '[]'::jsonb,
  '["platformer","puzzle"]'::jsonb,
  'function create(cfg) {
  return {
    id: "style-painterly",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() {},
    onEvent: function(ev, data) {},
    softenBackground: function(displayObject) {
      try {
        displayObject.filters = [new PIXI.BlurFilter({ strength: cfg.blurStrength || 2 })];
        displayObject.alpha = cfg.bgAlpha || 0.85;
      } catch(e) {}
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'style-cartoon-bold',
  'Cartoon Bold Style',
  'Thick outlines on all entities, saturated colors, exaggerated proportions.',
  'Visual Styles',
  'feature',
  '2d',
  '1.0.0',
  '["style", "cartoon", "bold", "outline", "thick", "saturated"]'::jsonb,
  '[{"name":"outlineWidth","type":"number","default":3},{"name":"outlineColor","type":"number","default":0}]'::jsonb,
  '[]'::jsonb,
  '["platformer","runner","puzzle"]'::jsonb,
  'function create(cfg) {
  return {
    id: "style-cartoon-bold",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() {},
    onEvent: function(ev, data) {},
    drawBoldRect: function(x, y, w, h, fillColor) {
      var g = new PIXI.Graphics();
      g.roundRect(0, 0, w, h, 6).fill({ color: fillColor }).stroke({ color: cfg.outlineColor || 0x000000, width: cfg.outlineWidth || 3 });
      g.x = x; g.y = y; g.pivot.set(w / 2, h);
      return g;
    },
    drawBoldCircle: function(x, y, r, fillColor) {
      var g = new PIXI.Graphics();
      g.circle(0, 0, r).fill({ color: fillColor }).stroke({ color: cfg.outlineColor || 0x000000, width: cfg.outlineWidth || 3 });
      g.x = x; g.y = y;
      return g;
    }
  };
}',
  true, true
);

-- ===== GAMEPLAY SYSTEM SNIPPETS =====

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'system-timer',
  'Timer System',
  'Countdown timer with configurable duration. Emits timer-tick and timer-expired events. Coins can add bonus time.',
  'Gameplay Systems',
  'feature',
  '2d',
  '1.0.0',
  '["timer", "countdown", "time", "pressure", "urgency"]'::jsonb,
  '[{"name":"duration","type":"number","default":90},{"name":"bonusPerCoin","type":"number","default":3}]'::jsonb,
  '[]'::jsonb,
  '["platformer","runner","shooter"]'::jsonb,
  'function create(cfg) {
  var timeLeft = cfg.duration || 90;
  var textObj = null;
  return {
    id: "system-timer",
    init: function(engine) {},
    update: function(engine, dt) {
      timeLeft -= dt;
      if (textObj) textObj.text = Math.ceil(Math.max(0, timeLeft)).toString();
      if (timeLeft <= 10 && textObj) textObj.style.fill = 0xFF0000;
      if (timeLeft <= 0) engine.events && engine.events.emit("timer-expired", {});
    },
    destroy: function() { textObj = null; },
    onEvent: function(ev, data) {
      if (ev === "coin-collect") timeLeft += cfg.bonusPerCoin || 3;
    },
    setTextObject: function(txt) { textObj = txt; },
    getTimeLeft: function() { return timeLeft; }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'system-keys-gates',
  'Keys and Gates',
  'Colored key/gate puzzle system. Collecting a key opens the matching gate. Supports multiple colors.',
  'Gameplay Systems',
  'feature',
  '2d',
  '1.0.0',
  '["keys", "gates", "puzzle", "unlock", "colored", "door"]'::jsonb,
  '[{"name":"colors","type":"json","default":[16728200,4498687,11206420]}]'::jsonb,
  '[]'::jsonb,
  '["platformer"]'::jsonb,
  'function create(cfg) {
  var collected = {};
  var gates = [];
  return {
    id: "system-keys-gates",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { collected = {}; gates = []; },
    onEvent: function(ev, data) {},
    collectKey: function(colorIdx, engine) {
      collected[colorIdx] = true;
      for (var i = 0; i < gates.length; i++) {
        if (gates[i].colorIdx === colorIdx && !gates[i].open) {
          gates[i].open = true;
          gates[i].gfx.alpha = 0;
          if (gates[i].body && gates[i].physics) gates[i].physics.removeBody(gates[i].body);
          if (engine.juice) engine.juice.shake(engine.app.stage.children[0], 6, 0.2);
        }
      }
    },
    addGate: function(gfx, body, physics, colorIdx) {
      gates.push({ gfx: gfx, body: body, physics: physics, colorIdx: colorIdx, open: false });
    },
    hasKey: function(colorIdx) { return !!collected[colorIdx]; },
    getColors: function() { return cfg.colors || [0xFF4488, 0x44AAFF, 0xAAFF44]; }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'system-checkpoint',
  'Checkpoint System',
  'Flag-based checkpoint save system. Player respawns at last activated checkpoint on death.',
  'Gameplay Systems',
  'feature',
  '2d',
  '1.0.0',
  '["checkpoint", "save", "respawn", "flag", "progress"]'::jsonb,
  '[{"name":"flagColor","type":"number","default":16711680}]'::jsonb,
  '[]'::jsonb,
  '["platformer","runner"]'::jsonb,
  'function create(cfg) {
  var checkpoints = [];
  var lastCheckpoint = null;
  return {
    id: "system-checkpoint",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() { checkpoints = []; lastCheckpoint = null; },
    onEvent: function(ev, data) {
      if (ev === "player-death" && lastCheckpoint) {
        // Scene should read getSpawnPoint() after death
      }
    },
    addCheckpoint: function(x, y, gfx) {
      checkpoints.push({ x: x, y: y, gfx: gfx, activated: false });
    },
    activate: function(x, y, engine) {
      for (var i = 0; i < checkpoints.length; i++) {
        var cp = checkpoints[i];
        if (Math.abs(cp.x - x) < 40 && Math.abs(cp.y - y) < 60 && !cp.activated) {
          cp.activated = true;
          lastCheckpoint = { x: cp.x, y: cp.y };
          if (cp.gfx) cp.gfx.tint = cfg.flagColor || 0xFF0000;
          if (engine.juice) engine.juice.pop(cp.gfx, 1.3, 0.2);
        }
      }
    },
    getSpawnPoint: function() { return lastCheckpoint; }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'system-combo',
  'Combo Counter',
  'Kill/collect combo system that multiplies score. Combo resets after a configurable timeout.',
  'Gameplay Systems',
  'feature',
  '2d',
  '1.0.0',
  '["combo", "multiplier", "score", "chain", "streak"]'::jsonb,
  '[{"name":"timeout","type":"number","default":3},{"name":"baseScore","type":"number","default":50}]'::jsonb,
  '[]'::jsonb,
  '["platformer","shooter"]'::jsonb,
  'function create(cfg) {
  var combo = 0;
  var timer = 0;
  var textObj = null;
  return {
    id: "system-combo",
    init: function(engine) {},
    update: function(engine, dt) {
      if (combo > 0) {
        timer -= dt;
        if (timer <= 0) { combo = 0; if (textObj) textObj.text = ""; }
        else if (textObj) { textObj.text = "COMBO x" + combo; }
      }
    },
    destroy: function() { textObj = null; },
    onEvent: function(ev, data) {
      if (ev === "enemy-kill" || ev === "coin-collect") {
        combo++;
        timer = cfg.timeout || 3;
      }
    },
    hit: function(engine) {
      combo++;
      timer = cfg.timeout || 3;
      var score = (cfg.baseScore || 50) * combo;
      if (textObj && engine.juice) engine.juice.pop(textObj, 1.4, 0.2);
      return score;
    },
    getCombo: function() { return combo; },
    getMultiplier: function() { return Math.max(1, combo); },
    setTextObject: function(txt) { textObj = txt; }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'system-powerup-magnet',
  'Collectible Magnet',
  'Attracts nearby collectibles toward the player. Configurable range and pull strength.',
  'Gameplay Systems',
  'feature',
  '2d',
  '1.0.0',
  '["powerup", "magnet", "attract", "collect", "pull"]'::jsonb,
  '[{"name":"range","type":"number","default":120},{"name":"pullSpeed","type":"number","default":300}]'::jsonb,
  '[]'::jsonb,
  '["platformer","runner"]'::jsonb,
  'function create(cfg) {
  var active = false;
  var collectibles = [];
  var playerBody = null;
  return {
    id: "system-powerup-magnet",
    init: function(engine) {},
    update: function(engine, dt) {
      if (!active || !playerBody) return;
      var range = cfg.range || 120;
      var pull = cfg.pullSpeed || 300;
      for (var i = 0; i < collectibles.length; i++) {
        var c = collectibles[i];
        if (!c.sprite) continue;
        var dx = playerBody.x - c.sprite.x;
        var dy = playerBody.y - c.sprite.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < range && dist > 5) {
          c.sprite.x += (dx / dist) * pull * dt;
          c.sprite.y += (dy / dist) * pull * dt;
          if (c.body) { c.body.x = c.sprite.x; c.body.y = c.sprite.y; }
        }
      }
    },
    destroy: function() { collectibles = []; },
    onEvent: function(ev, data) {},
    setPlayer: function(body) { playerBody = body; },
    addCollectible: function(sprite, body) { collectibles.push({ sprite: sprite, body: body }); },
    activate: function() { active = true; },
    deactivate: function() { active = false; },
    isActive: function() { return active; }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'system-wall-jump',
  'Wall Jump',
  'Enhanced wall interaction: slide down walls slowly, jump off walls in opposite direction.',
  'Gameplay Systems',
  'feature',
  '2d',
  '1.0.0',
  '["wall", "jump", "slide", "walljump", "movement"]'::jsonb,
  '[{"name":"slideSpeed","type":"number","default":50},{"name":"jumpForce","type":"number","default":450},{"name":"kickX","type":"number","default":250}]'::jsonb,
  '[]'::jsonb,
  '["platformer"]'::jsonb,
  'function create(cfg) {
  var onWall = false;
  var wallDir = 0;
  return {
    id: "system-wall-jump",
    init: function(engine) {},
    update: function(engine, dt) {},
    destroy: function() {},
    onEvent: function(ev, data) {},
    checkWall: function(playerBody, walls) {
      onWall = false; wallDir = 0;
      for (var i = 0; i < walls.length; i++) {
        var w = walls[i];
        if (Math.abs(playerBody.x - w.x) < (playerBody.w / 2 + w.w / 2 + 2) && playerBody.y > w.y && playerBody.y < w.y + w.h) {
          onWall = true;
          wallDir = playerBody.x < w.x ? 1 : -1;
          break;
        }
      }
      if (onWall && playerBody.vy > 0) {
        playerBody.vy = Math.min(playerBody.vy, cfg.slideSpeed || 50);
      }
      return onWall;
    },
    wallJump: function(playerBody) {
      if (!onWall) return false;
      playerBody.vy = -(cfg.jumpForce || 450);
      playerBody.vx = -wallDir * (cfg.kickX || 250);
      onWall = false;
      return true;
    },
    isOnWall: function() { return onWall; }
  };
}',
  true, true
);

-- ===== ATMOSPHERE SNIPPETS =====

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'atmosphere-warm',
  'Warm Atmosphere',
  'Warm golden lighting with firefly particles. Creates cozy, inviting feel.',
  'Atmospheres',
  'feature',
  '2d',
  '1.0.0',
  '["atmosphere", "warm", "firefly", "golden", "cozy"]'::jsonb,
  '[{"name":"particleCount","type":"number","default":30},{"name":"lightColor","type":"number","default":16769800}]'::jsonb,
  '[]'::jsonb,
  '["platformer","puzzle"]'::jsonb,
  'function create(cfg) {
  var particles = [];
  var container = null;
  return {
    id: "atmosphere-warm",
    init: function(engine) {},
    update: function(engine, dt) {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.t += dt * (0.5 + p.speed);
        p.gfx.x = p.baseX + Math.sin(p.t * 1.3) * 30;
        p.gfx.y = p.baseY + Math.sin(p.t * 0.7) * 20;
        p.gfx.alpha = 0.3 + Math.sin(p.t * 2) * 0.3;
      }
    },
    destroy: function() { particles = []; container = null; },
    onEvent: function(ev, data) {},
    setup: function(cont, worldW, worldH) {
      container = cont;
      var count = cfg.particleCount || 30;
      for (var i = 0; i < count; i++) {
        var g = new PIXI.Graphics();
        g.circle(0, 0, 2 + Math.random() * 2).fill({ color: cfg.lightColor || 0xFFEE88, alpha: 0.6 });
        g.x = Math.random() * worldW; g.y = Math.random() * worldH * 0.8;
        container.addChild(g);
        particles.push({ gfx: g, baseX: g.x, baseY: g.y, t: Math.random() * 10, speed: 0.3 + Math.random() * 0.5 });
      }
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'atmosphere-cold',
  'Cold Atmosphere',
  'Ice blue tint with snow particles and breath vapor effect near player.',
  'Atmospheres',
  'feature',
  '2d',
  '1.0.0',
  '["atmosphere", "cold", "snow", "ice", "winter", "frost"]'::jsonb,
  '[{"name":"snowCount","type":"number","default":50},{"name":"tintColor","type":"number","default":11189231}]'::jsonb,
  '[]'::jsonb,
  '["platformer","runner"]'::jsonb,
  'function create(cfg) {
  var snowflakes = [];
  var container = null;
  return {
    id: "atmosphere-cold",
    init: function(engine) {},
    update: function(engine, dt) {
      for (var i = 0; i < snowflakes.length; i++) {
        var s = snowflakes[i];
        s.gfx.y += s.speed * dt;
        s.gfx.x += Math.sin(s.t + s.gfx.y * 0.01) * 0.5;
        s.t += dt;
        if (s.gfx.y > s.maxY) { s.gfx.y = -10; s.gfx.x = Math.random() * s.worldW; }
      }
    },
    destroy: function() { snowflakes = []; container = null; },
    onEvent: function(ev, data) {},
    setup: function(cont, worldW, worldH) {
      container = cont;
      var count = cfg.snowCount || 50;
      for (var i = 0; i < count; i++) {
        var g = new PIXI.Graphics();
        var size = 1 + Math.random() * 3;
        g.circle(0, 0, size).fill({ color: 0xFFFFFF, alpha: 0.4 + Math.random() * 0.4 });
        g.x = Math.random() * worldW; g.y = Math.random() * worldH;
        container.addChild(g);
        snowflakes.push({ gfx: g, speed: 20 + Math.random() * 40, t: Math.random() * 10, maxY: worldH, worldW: worldW });
      }
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'atmosphere-dark',
  'Dark Atmosphere',
  'Limited visibility with light radius around player. Embers float in the darkness.',
  'Atmospheres',
  'feature',
  '2d',
  '1.0.0',
  '["atmosphere", "dark", "embers", "fog", "visibility", "torch"]'::jsonb,
  '[{"name":"lightRadius","type":"number","default":200},{"name":"emberCount","type":"number","default":20}]'::jsonb,
  '[]'::jsonb,
  '["platformer","shooter"]'::jsonb,
  'function create(cfg) {
  var embers = [];
  var container = null;
  var darkOverlay = null;
  return {
    id: "atmosphere-dark",
    init: function(engine) {},
    update: function(engine, dt) {
      for (var i = 0; i < embers.length; i++) {
        var e = embers[i];
        e.gfx.y -= e.speed * dt;
        e.gfx.x += Math.sin(e.t) * 0.3;
        e.t += dt * 2;
        e.gfx.alpha = 0.3 + Math.sin(e.t * 3) * 0.3;
        if (e.gfx.y < -20) { e.gfx.y = e.maxY + 10; e.gfx.x = Math.random() * e.worldW; }
      }
    },
    destroy: function() { embers = []; container = null; darkOverlay = null; },
    onEvent: function(ev, data) {},
    setup: function(cont, worldW, worldH) {
      container = cont;
      var count = cfg.emberCount || 20;
      for (var i = 0; i < count; i++) {
        var g = new PIXI.Graphics();
        g.circle(0, 0, 1.5 + Math.random()).fill({ color: 0xFF6622, alpha: 0.5 });
        g.x = Math.random() * worldW; g.y = Math.random() * worldH;
        container.addChild(g);
        embers.push({ gfx: g, speed: 15 + Math.random() * 25, t: Math.random() * 10, maxY: worldH, worldW: worldW });
      }
    },
    createDarkOverlay: function(screenW, screenH) {
      darkOverlay = new PIXI.Graphics();
      darkOverlay.rect(0, 0, screenW, screenH).fill({ color: 0x000000, alpha: 0.6 });
      return darkOverlay;
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'atmosphere-storm',
  'Storm Atmosphere',
  'Rain particles, periodic lightning flashes, and optional wind affecting player movement.',
  'Atmospheres',
  'feature',
  '2d',
  '1.0.0',
  '["atmosphere", "storm", "rain", "lightning", "wind", "thunder"]'::jsonb,
  '[{"name":"rainCount","type":"number","default":80},{"name":"lightningInterval","type":"number","default":8},{"name":"windForce","type":"number","default":30}]'::jsonb,
  '[]'::jsonb,
  '["platformer","runner","shooter"]'::jsonb,
  'function create(cfg) {
  var raindrops = [];
  var container = null;
  var lightningTimer = cfg.lightningInterval || 8;
  var flashOverlay = null;
  return {
    id: "atmosphere-storm",
    init: function(engine) {},
    update: function(engine, dt) {
      var wind = cfg.windForce || 30;
      for (var i = 0; i < raindrops.length; i++) {
        var r = raindrops[i];
        r.gfx.y += r.speed * dt;
        r.gfx.x += wind * dt;
        if (r.gfx.y > r.maxY) { r.gfx.y = -20; r.gfx.x = Math.random() * r.worldW; }
      }
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        lightningTimer = (cfg.lightningInterval || 8) + Math.random() * 4;
        if (flashOverlay) {
          flashOverlay.alpha = 0.7;
          setTimeout(function() { if (flashOverlay) flashOverlay.alpha = 0; }, 120);
        }
      }
    },
    destroy: function() { raindrops = []; container = null; flashOverlay = null; },
    onEvent: function(ev, data) {},
    setup: function(cont, worldW, worldH, stage) {
      container = cont;
      var count = cfg.rainCount || 80;
      for (var i = 0; i < count; i++) {
        var g = new PIXI.Graphics();
        g.rect(0, 0, 1, 8 + Math.random() * 8).fill({ color: 0xAABBDD, alpha: 0.3 + Math.random() * 0.3 });
        g.rotation = 0.15;
        g.x = Math.random() * worldW; g.y = Math.random() * worldH;
        container.addChild(g);
        raindrops.push({ gfx: g, speed: 300 + Math.random() * 200, maxY: worldH, worldW: worldW });
      }
      flashOverlay = new PIXI.Graphics();
      flashOverlay.rect(0, 0, worldW, worldH).fill({ color: 0xFFFFFF, alpha: 0 });
      if (stage) stage.addChild(flashOverlay);
    }
  };
}',
  true, true
);

INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES (
  'atmosphere-underwater',
  'Underwater Atmosphere',
  'Blue tint, bubble particles rising, optional wavy distortion effect.',
  'Atmospheres',
  'feature',
  '2d',
  '1.0.0',
  '["atmosphere", "underwater", "bubbles", "ocean", "aquatic", "deep"]'::jsonb,
  '[{"name":"bubbleCount","type":"number","default":25},{"name":"tintAlpha","type":"number","default":0.15}]'::jsonb,
  '[]'::jsonb,
  '["platformer","puzzle"]'::jsonb,
  'function create(cfg) {
  var bubbles = [];
  var container = null;
  return {
    id: "atmosphere-underwater",
    init: function(engine) {},
    update: function(engine, dt) {
      for (var i = 0; i < bubbles.length; i++) {
        var b = bubbles[i];
        b.gfx.y -= b.speed * dt;
        b.gfx.x += Math.sin(b.t + b.gfx.y * 0.02) * 0.4;
        b.t += dt;
        b.gfx.scale.set(0.8 + Math.sin(b.t * 3) * 0.15);
        if (b.gfx.y < -20) { b.gfx.y = b.maxY + 10; b.gfx.x = Math.random() * b.worldW; }
      }
    },
    destroy: function() { bubbles = []; container = null; },
    onEvent: function(ev, data) {},
    setup: function(cont, worldW, worldH) {
      container = cont;
      // Blue tint overlay
      var tint = new PIXI.Graphics();
      tint.rect(0, 0, worldW, worldH).fill({ color: 0x0044AA, alpha: cfg.tintAlpha || 0.15 });
      container.addChild(tint);
      // Bubbles
      var count = cfg.bubbleCount || 25;
      for (var i = 0; i < count; i++) {
        var g = new PIXI.Graphics();
        var size = 2 + Math.random() * 5;
        g.circle(0, 0, size).stroke({ color: 0xAADDFF, width: 1, alpha: 0.5 });
        g.x = Math.random() * worldW; g.y = Math.random() * worldH;
        container.addChild(g);
        bubbles.push({ gfx: g, speed: 20 + Math.random() * 40, t: Math.random() * 10, maxY: worldH, worldW: worldW });
      }
    }
  };
}',
  true, true
);
