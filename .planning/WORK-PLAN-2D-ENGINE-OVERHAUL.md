# Work Plan: 2D Engine Overhaul — Phaser to Pixi.js + Proton

## Goal
Replace the Phaser-based 2D game engine with a new Pixi.js + Proton particle engine architecture that produces visually stunning 2D games with cinematic particle effects.

## Strategy
1. Clean removal of all Phaser code (clean slate)
2. Build new engine from scratch on Pixi.js + Proton
3. Each phase will be iterated until 100% complete

---

## Phase 1: Remove Phaser & Old 2D Engine (CLEAN SLATE)

### 1A. Delete 2D-Only Files (SAFE — no 3D impact)
- [ ] DELETE `packages/vibexe-engine/src/agents/game-developer.ts`
- [ ] DELETE `packages/vibexe-engine/src/shared/game-templates.ts`
- [ ] DELETE `packages/vibexe-engine/src/shared/game-assets-reference.ts`

### 1B. Remove 2D Exports from Index Files
- [ ] `packages/vibexe-engine/src/agents/index.ts` — remove gameDeveloper import+export (lines 17, 32)
- [ ] `packages/vibexe-engine/src/flows/index.ts` — remove GAME_FLOW definition (lines 71-81)
- [ ] `packages/vibexe-engine/src/index.ts` — remove GAME_TEMPLATE_FILES + GAME_ASSETS_REFERENCE exports (lines 69, 74)

### 1C. Surgical Edits in Shared Files (remove 2D branches, keep 3D)
- [ ] `apps/studio.vibexe.ai/app/api/app-builder/chat/route.ts`
  - Remove GAME_TEMPLATE_FILES import
  - Remove RUNNER_KEYWORDS, gameSubType for 2D
  - Remove 2D runner detection logic
  - Keep 3D game detection (isGame3d, RUNNER_3D_KEYWORDS, game-3d-developer)
  - Route all "game" requests to 3D pipeline for now (until new 2D engine ready)
- [ ] `apps/studio.vibexe.ai/app/(main)/app-builder/adapters/sandpack-adapter.ts`
  - Remove Phaser shim injection block (~lines 1400-1428)
- [ ] `apps/studio.vibexe.ai/app/(main)/app-builder/components/sandpack-preview.tsx`
  - Remove Phaser CDN resource injection (~lines 2359-2360)
- [ ] `apps/studio.vibexe.ai/app/(main)/app-builder/components/capture-screenshot-dialog.tsx`
  - Remove Phaser CDN resource conditional (~lines 275-276)
- [ ] `apps/studio.vibexe.ai/app/preview/[token]/preview-client.tsx`
  - Remove Phaser CDN resource conditional (~lines 192-193)
- [ ] `apps/studio.vibexe.ai/app/(main)/admin/games-engine/games-engine-client.tsx`
  - Remove GAME_TEMPLATE_FILES import
  - Remove phaser-3 engine definition
  - Remove all engine: "phaser-3" references

### 1D. Remove Phaser Dependency
- [ ] Remove "phaser" from any package.json dependencies

### 1E. Verify
- [ ] `npx tsc --noEmit` passes (no broken imports)
- [ ] 3D games still load and work
- [ ] Non-game apps (regular web apps) still work via Sandpack
- [ ] No remaining references to "phaser" in codebase (grep verify)

---

## Phase 2: Pixi.js + Proton Foundation

### 2A. Add Dependencies
- [ ] Add `pixi.js` (v8.x) and `proton-engine` (v7.x) to the CDN/import system
- [ ] Set up CDN shims for Sandpack (similar to how Phaser was loaded)
- [ ] OR: set up via lightweight runtime route (like 3D games use)

### 2B. Create New 2D Game Runtime
- [ ] New route: `/api/app-builder/game-runtime-2d` (or extend existing)
- [ ] Loads Pixi.js + Proton via CDN/ESM
- [ ] Provides same-origin iframe like 3D runtime
- [ ] Bootstrap: creates PIXI.Application, Proton instance, game loop

### 2C. Core Engine Architecture
- [ ] Create `packages/vibexe-engine/src/shared/game-2d-engine.ts`
  - Scene manager (boot, menu, game, gameover)
  - Game loop integration (PIXI ticker + Proton update)
  - Input handler (keyboard, touch, pointer)
  - Asset loader (PIXI.Assets)
  - Camera / viewport
  - Sprite management
  - Text/UI layer

### 2D. Physics Integration
- [ ] Evaluate: planck.js (Box2D port) vs matter.js vs lightweight custom
- [ ] Implement collision detection
- [ ] Implement gravity, velocity, forces
- [ ] Platform collision (one-way platforms)
- [ ] Character controller (walk, jump, double-jump)

---

## Phase 3: Proton Effects System

### 3A. Effect Presets Library
- [ ] Create `packages/vibexe-engine/src/shared/game-2d-effects.ts`
- [ ] Pre-built effect functions that return configured Proton emitters:
  - `createRainEffect(width, height, intensity)`
  - `createSnowEffect(width, height, density)`
  - `createFireEffect(x, y, scale)`
  - `createSmokeEffect(x, y)`
  - `createExplosionEffect(x, y, color)`
  - `createSparkleEffect(x, y)` (collectibles)
  - `createTrailEffect(followTarget)` (player trail)
  - `createDustEffect(x, y)` (landing/running dust)
  - `createBubbleEffect(x, y)` (underwater)
  - `createAmbientEffect(type, width, height)` (fireflies, dust motes, leaves)
  - `createBloodEffect(x, y)` (combat)
  - `createMagicEffect(x, y, color)` (spells/power-ups)

### 3B. Theme-Matched Auto-Effects
- [ ] Map art themes to default ambient effects:
  - Nature Adventure → leaf particles + dust motes
  - Dark World → smoke wisps + ember particles
  - Space Mission → star particles + nebula dust
  - Cartoon World → sparkle particles
  - Mountain Range → snow/mist particles
  - Deep Forest → firefly particles + pollen

### 3C. Trigger System
- [ ] Event-driven effect triggers:
  - `onJump()` → dust puff
  - `onLand()` → impact dust
  - `onCollect()` → sparkle burst
  - `onDamage()` → hit particles
  - `onDeath()` → explosion
  - `onRun()` → trailing dust

---

## Phase 4: Asset Pipeline & Templates

### 4A. Adapt Asset System
- [ ] Create `packages/vibexe-engine/src/shared/game-2d-assets.ts`
- [ ] Asset catalog compatible with Pixi.js (PIXI.Assets.load)
- [ ] Retain existing 20,454 sprites from media-stock
- [ ] Add particle texture assets (smoke.png, fire.png, rain.png, sparkle.png, etc.)
- [ ] Spritesheet support (TexturePacker format for Pixi.js)

### 4B. Game Templates
- [ ] Create `packages/vibexe-engine/src/shared/game-2d-templates.ts`
- [ ] Pre-created files for new 2D games:
  - `src/engine/core.ts` — Engine bootstrap, scene manager, game loop
  - `src/engine/effects.ts` — Proton effects helpers
  - `src/engine/physics.ts` — Physics helpers
  - `src/engine/input.ts` — Input handling
  - `src/config/assets.ts` — Asset catalog
  - `src/scenes/BootScene.ts` — Asset preloading
  - `src/scenes/MenuScene.ts` — Title screen with ambient particles
  - `src/scenes/GameScene.ts` — Main gameplay
  - `src/scenes/GameOverScene.ts` — End screen with effects

### 4C. Parallax System
- [ ] Pixi.js-native parallax (TilingSprite, multi-layer)
- [ ] Integrate with existing 6 environment packs
- [ ] Auto-scrolling with camera follow

---

## Phase 5: AI Agent Integration

### 5A. New Game Developer Agent
- [ ] Create `packages/vibexe-engine/src/agents/game-2d-developer.ts`
- [ ] System prompt teaches AI to generate Pixi.js + Proton code
- [ ] Complete API reference for:
  - PIXI.Application, Container, Sprite, TilingSprite, Text, Graphics
  - Proton emitters, behaviours, zones, renderers
  - Physics integration
  - Scene lifecycle
  - Asset loading patterns
- [ ] Effect selection guide based on game type/theme
- [ ] Common mistakes documentation

### 5B. Flow Integration
- [ ] Register new agent in agents/index.ts
- [ ] Create GAME_2D_FLOW in flows/index.ts
- [ ] Update chat/route.ts to route 2D game requests to new agent
- [ ] Update admin games-engine panel with new engine entry

### 5C. Smart Defaults
- [ ] AI auto-selects theme-appropriate ambient particle effects
- [ ] AI auto-adds gameplay particle triggers (jump dust, collect sparkle, etc.)
- [ ] AI generates complete, runnable games with effects from first prompt

---

## Phase 6: Testing & Visual Quality

### 6A. Smoke Tests
- [ ] Generate platformer game → verify it runs with effects
- [ ] Generate runner game → verify it runs with effects
- [ ] Generate puzzle game → verify it runs
- [ ] Test all 6 art themes with matching ambient effects
- [ ] Performance: target 60 FPS with 500+ particles active

### 6B. Visual Quality Pass
- [ ] Compare generated game visuals against Proton example demos
- [ ] Tune effect intensities, colors, timings
- [ ] Ensure particle effects don't obscure gameplay
- [ ] Test on different screen sizes

### 6C. Edge Cases
- [ ] Multiple simultaneous effects (rain + explosion + trail)
- [ ] Effect cleanup on scene transitions
- [ ] Memory management (pool sizing, emitter destruction)
- [ ] Mobile touch input compatibility

---

## DO NOT TOUCH (3D Engine — separate)
- game-3d-developer.ts
- game-3d-templates.ts
- game-assets-reference-3d.ts
- game-runtime/route.ts (3D runtime)
- compile/route.ts (3D compiler)
- All modules in shared/modules/ (character-system, terrain, water, sky, etc.)
- visual-edit-bridge.ts, game-editor-bridge.ts
- GameRuntimeIframe (3D only)

## DO NOT TOUCH (Shared infrastructure)
- media-stock API routes (serves both 2D and 3D assets)
- Sandpack adapter (used for non-game web apps)
- General chat/route.ts 3D detection logic
