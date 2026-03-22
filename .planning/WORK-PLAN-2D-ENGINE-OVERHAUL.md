# Work Plan: 2D Game Engine — Pixi.js + Proton

## Goal
Build a new 2D game engine on Pixi.js + Proton that produces visually stunning 2D games with cinematic particle effects. The AI builder should generate complete, polished 2D games in minutes.

## Context
- The old Phaser 2D engine has been fully removed (2026-03-23). Zero traces remain.
- All game requests currently route to the 3D pipeline as a temporary fallback.
- 20,454 existing 2D sprite assets on the server remain available via `/api/app-builder/media-stock/`.
- 3D engine (Three.js + modules) is completely separate and must NOT be touched.

## Technology Stack
- **Pixi.js v8.x** — rendering, sprites, containers, text, tiling, asset loading
- **Proton v7.1.5** (`proton-engine` npm) — particle effects engine (rain, fire, smoke, explosions, trails, ambient)
- **Custom AABB physics** — lightweight, zero-dependency (chosen over planck.js/matter.js for simplicity)
- **Proton.PixiRenderer** — native bridge between Proton particles and Pixi.js stage

## Proton Quick Reference
- 12 behaviours: Alpha, Scale, Color, Rotate, Force, Gravity, Attraction, Repulsion, GravityWell, RandomDrift, Cyclone, CrossZone, Collision
- 5 zones: PointZone, LineZone, CircleZone, RectZone, ImageZone
- 7 initializers: Life, Mass, Radius, Body, Position, Velocity, Rate
- 7 renderers: CanvasRenderer, WebGLRenderer, DomRenderer, PixelRenderer, PixiRenderer, EaselRenderer, CustomRenderer
- Emission: `emit()` (continuous), `emit('once')` (burst), `emit(0.5)` (timed), `preEmit(1.2)` (pre-fill)
- Object pooling built-in, zero GC pressure
- Energy model: behaviours interpolate from A→B over particle lifetime using easing functions

## Each phase will be iterated until 100% complete.

---

## Phase 1: Pixi.js + Proton Foundation — 100%

### 1A. Add Dependencies & Runtime — DONE
- [x] Add `pixi.js` (v8.9.2) and `proton-engine` (v7.1.5) via CDN in runtime route
- [x] Create lightweight runtime route `/api/app-builder/game-runtime-2d` (same-origin iframe, like 3D)
- [x] Bootstrap: PIXI.Application creation, Proton instance, ticker-driven game loop
- [x] Bundle injection via postMessage (same pattern as 3D runtime)
- [x] Cleanup on reload: destroy PIXI app, Proton instance, cancel animation frames

### 1B. Core Engine Architecture — DONE
- [x] Create `packages/vibexe-engine/src/shared/game-2d-engine.ts`
  - Engine2D class: PIXI.Application + Proton + ticker game loop
  - Scene manager: state machine with enter/update/exit lifecycle
  - InputManager: keyboard (WASD/arrows/space), pointer, justPressed/justReleased
  - Camera2D: smooth follow with dead zone, world bounds clamping, screenToWorld
  - AudioManager: Web Audio API with music/SFX channels, volume control
  - Sprite factories: createSprite, createAnimatedSprite, createTilingSprite, createText
  - UI layer: fixed container above game world
  - Asset loader: PIXI.Assets.load with progress tracking
  - Tab visibility: auto-pause when backgrounded

### 1C. Physics Integration — DONE
- [x] Chose lightweight custom AABB (zero-dependency, ~300 lines)
- [x] Create `packages/vibexe-engine/src/shared/game-2d-physics.ts`
  - PhysicsBody: position, velocity, acceleration, half-extents, mass, friction, bounce
  - PhysicsWorld: gravity, integration, AABB collision detection & resolution
  - One-way platform support (only collide from above)
  - Sensor bodies (trigger overlap events, no physics response)
  - CharacterController: walk, run, jump, double-jump, wall-slide, wall-jump
  - Coyote time (0.1s grace after leaving ground) + jump buffering (0.12s)
  - Air control (0.7 multiplier in air)
  - Auto sprite sync (body.sprite auto-positioned each frame)
  - Collision/overlap callbacks

### 1D. Verify Foundation — PENDING (requires deploy + live testing)
- [ ] A character sprite walks on a platform with gravity
- [ ] Rain particles fall via Proton.PixiRenderer on the same stage
- [ ] Input (WASD) moves the character, space jumps
- [ ] 60 FPS stable

---

## Phase 2: Proton Effects System — 100%

### 2A. Effect Presets Library — DONE
- [x] Create `packages/vibexe-engine/src/shared/game-2d-effects.ts`
- [x] 12 pre-built effect factory functions:
  - `createRainEffect` — LineZone top, diagonal velocity, Alpha fade, CrossZone kill
  - `createSnowEffect` — LineZone top, RandomDrift flutter, slow fall
  - `createFireEffect` — CircleZone, Scale grow→shrink, Color orange→red→black
  - `createSmokeEffect` — upward velocity, Alpha fade, Scale grow, RandomDrift
  - `createExplosionEffect` — burst emit('once'), radial velocity, Gravity, Scale shrink
  - `createSparkleEffect` — random radial, Scale shrink, Color yellow→white
  - `createDustEffect` — burst on land/run, small scale, fast fade
  - `createBloodEffect` — burst, Gravity, Color red→dark, Scale shrink
  - `createTrailEffect` — continuous, Scale shrink, Alpha fade, themed color
  - `createBubbleEffect` — upward velocity, RandomDrift, Scale random
  - `createMagicEffect` — Cyclone vortex, Color shift
  - `createAmbientEffect` — 5 types (fireflies, dust, leaves, embers, pollen)
- [x] Each function returns `{ emitter, start(), stop(), destroy(), moveTo(x,y) }`

### 2B. Theme-Matched Auto-Effects — DONE
- [x] `getThemeEffects(theme, width, height)` function with 10 themes:
  - nature → leaves + dust | dark → embers + smoke | space → dust
  - cartoon → pollen | mountain → snow | forest → fireflies + pollen
  - underwater → bubbles | volcanic → embers + fire | desert → dust | urban → dust

### 2C. Gameplay Trigger System — DONE
- [x] 6 one-shot trigger helpers with auto-cleanup:
  - `onJumpDust(proton, x, y)` → dust puff
  - `onLandImpact(proton, x, y)` → impact dust
  - `onCollectSparkle(proton, x, y)` → sparkle burst
  - `onDamageHit(proton, x, y, theme)` → blood or sparkle based on theme
  - `onDeathExplosion(proton, x, y, color)` → explosion burst
  - `onRunTrail(proton, x, y)` → trailing dust

### 2D. Particle Texture Assets — DEFERRED
- [ ] Create/source small PNG textures for particles
- [ ] Upload to server
- [ ] Note: Proton uses colored circles by default (no texture needed for initial launch)

---

## Phase 3: Asset Pipeline & Game Templates — 100%

### 3A. Asset System — DONE
- [x] Create `packages/vibexe-engine/src/shared/game-2d-assets.ts`
  - `AssetPack2D` interface with id, name, style, spriteCount, serverPath, categories
  - `PACKS_2D` array: 3 character packs (robot, zombie, alien), 6 environment packs, platforms, items
  - `SCALES_2D` constants for all asset types (player: 0.15, enemy: 0.12, coin: 0.06, etc.)
  - `PARALLAX_CONFIGS` for all 6 environments with per-layer parallax factors
  - `buildAssetReferencePrompt()` for agent prompt injection

### 3B. Game Templates — DONE
- [x] Create `packages/vibexe-engine/src/shared/game-2d-templates.ts`
- [x] 8 TemplateFile entries:
  - `src/engine/core.ts` — Engine2D bootstrap, scene manager, game loop
  - `src/engine/input.ts` — VirtualJoystick, onTapZone (mobile)
  - `src/engine/physics.ts` — PhysicsWorld, CharacterController
  - `src/engine/effects.ts` — All 12+ Proton effect presets
  - `src/utils/media-stock.ts` — spriteUrl(), loadSprite(), loadSprites()
  - `src/config/assets.ts` — SCALES, createGameSprite, createAnimatedGameSprite, createParallaxBackground, CHARACTER_FRAMES, ENVIRONMENTS
  - `src/components/Game2D.tsx` — React wrapper
  - `src/scenes/GameOverScene.ts` — Game over screen with particle effects
- [x] 4 scene starters: GAME_2D_SCENE_STARTER, _RUNNER, _PUZZLE, _SHOOTER

### 3C. Parallax System — DONE
- [x] createParallaxBackground() in assets.ts template
  - PIXI.TilingSprite-based multi-layer parallax
  - Auto-calculated parallax factors per layer
  - Compatible with all 6 environment packs (4-11 layers each)
  - Scrolls via tilePosition.x in update loop

---

## Phase 4: AI Agent Integration — 100%

### 4A. New Game Developer Agent — DONE
- [x] Create `packages/vibexe-engine/src/agents/game-2d-developer.ts`
  - id: "game-2d-developer", modelTier: "opus"
  - 35+ activation triggers (2d game, platformer, runner, puzzle, pixi, etc.)
  - Complete system prompt with:
    - Engine2D API reference (Application, Container, scene lifecycle)
    - InputManager quick reference (keyboard, pointer, directions)
    - Physics quick reference (PhysicsWorld, CharacterController, bodies)
    - Particle effects quick reference (all 12 presets, themes, triggers)
    - Asset loading reference (sprites, animations, parallax)
    - Camera reference (follow, smoothing, dead zone, screenToWorld)
    - 4 game type patterns (platformer, runner, puzzle, shooter)
    - 20 common mistakes documentation
    - 8 mandatory quality rules
    - Full 2D asset catalog (injected via buildAssetReferencePrompt)

### 4B. Flow & Route Integration — DONE
- [x] Register agent in `agents/index.ts`
- [x] Create `GAME_2D_FLOW` in `flows/index.ts`
- [x] Export 2D templates + assets from engine `index.ts`
- [x] Update `chat/route.ts`:
  - Added `GAME_2D_KEYWORDS` (35+ keywords)
  - Added `RUNNER_2D_KEYWORDS`, `SHOOTER_2D_KEYWORDS`, `PUZZLE_2D_KEYWORDS`
  - 2D detection runs before 3D fallback
  - 2D sub-genre detection (runner, shooter, puzzle)
  - Inject GAME_2D_TEMPLATE_FILES for 2D games
  - Inject GAME_2D_SCENE_STARTER (genre-specific) for 2D games
  - Inject 2D asset reference for 2D games
  - 2D build phase addendum (factory pattern instructions)
  - 2D injected files notification
  - Fallback: existing Game2D.tsx template forces 2D mode
- [x] Update admin `games-engine-client.tsx`:
  - Added Pixi.js 2D engine entry (v8.9)
  - Added 4 2D genre entries (2d-platformer, 2d-runner, 2d-puzzle, 2d-shooter)

### 4C. Smart Defaults — DONE (via agent prompt)
- [x] Agent system prompt mandates theme-appropriate ambient effects
- [x] Agent system prompt mandates gameplay triggers (jump dust, collect sparkle, death explosion)
- [x] Agent system prompt mandates parallax background + score display
- [x] Pre-emission documented in effects API reference

---

## Phase 5: Testing & Visual Quality — 0% (PENDING DEPLOY)

### 5A. Smoke Tests
- [ ] Prompt: "Create a platformer game" → verify runs with parallax, character, physics, effects
- [ ] Prompt: "Create a runner game" → verify auto-scroll, lanes, obstacles, effects
- [ ] Prompt: "Create a puzzle game" → verify grid, drag-drop, sparkle effects
- [ ] Test all 6 art themes with matching ambient effects
- [ ] Performance: target 60 FPS with 500+ active particles

### 5B. Visual Quality Pass
- [ ] Compare generated game visuals against Proton example demos (pixi-game, fireworks, etc.)
- [ ] Tune effect intensities, colors, timings per theme
- [ ] Ensure particle effects enhance but don't obscure gameplay
- [ ] Test on different screen sizes (desktop, tablet, mobile)

### 5C. Edge Cases
- [ ] Multiple simultaneous effects (rain + explosion + trail + ambient)
- [ ] Effect cleanup on scene transitions (no particle leaks)
- [ ] Memory management: pool sizing, emitter destruction, Proton.destroy()
- [ ] Mobile touch input: virtual joystick, tap-to-jump, swipe-to-switch-lane
- [ ] Tab visibility: pause Proton when tab backgrounded (amendChangeTabsBug)

---

## DO NOT TOUCH (3D Engine — completely separate)
- game-3d-developer.ts, game-3d-templates.ts, game-assets-reference-3d.ts
- game-runtime/route.ts (3D runtime), compile/route.ts (3D compiler)
- All modules in shared/modules/ (character-system, terrain-painter, stylized-water, sky-weather-advanced)
- visual-edit-bridge.ts, game-editor-bridge.ts, GameRuntimeIframe

## DO NOT TOUCH (Shared infrastructure)
- media-stock API routes (serves both 2D and 3D assets)
- Sandpack adapter (used for non-game web apps)
- General chat/route.ts 3D detection logic
