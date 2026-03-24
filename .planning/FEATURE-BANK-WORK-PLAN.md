# Feature Bank Architecture — Work Plan

## Why This Exists

The current 2D game engine uses a hybrid-starter + patch_file approach that produces weak, repetitive results. The AI is over-constrained on structure but under-specified on quality. Every fix adds more guardrails, making the system increasingly brittle.

This plan replaces that approach with a **Feature Bank** — a library of pre-tested, composable code snippets that the AI assembles into games. When a feature doesn't exist in the bank, the AI writes custom code using the same engine API patterns it learned from the bank.

---

## Phase 1: Engine API Redesign

**Goal**: Create a clean, consistent engine API that is easy for AI to generate correct code against.

### 1.1 Define the new Engine2D public API surface

Current API is inconsistent (5 different patterns for creating things). Redesign to follow `engine.namespace.verb()` convention:

```ts
// Spawning
engine.spawn.player(x, y, config?)
engine.spawn.enemy(x, y, type, config?)
engine.spawn.platform(x, y, width, height, config?)
engine.spawn.coin(x, y, config?)
engine.spawn.projectile(x, y, direction, config?)
engine.spawn.text(x, y, text, style?)
engine.spawn.tilingSprite(texture, x, y, width, height)

// Effects (Proton particle presets)
engine.effects.rain(intensity?)
engine.effects.snow(density?)
engine.effects.fire(x, y, scale?)
engine.effects.smoke(x, y)
engine.effects.explosion(x, y, color?)
engine.effects.sparkle(x, y)
engine.effects.dust(x, y)
engine.effects.trail(target, color?)
engine.effects.ambient(type)  // fireflies, embers, dust, leaves, pollen
engine.effects.magic(x, y, color?)
engine.effects.shockwave(x, y)

// Juice (GSAP-powered game feel)
engine.juice.pop(obj, scale?, duration?)
engine.juice.shake(intensity?, duration?)
engine.juice.hitPause(ms?)
engine.juice.flash(obj, color?, duration?)
engine.juice.float(obj, amplitude?, speed?)
engine.juice.breathe(obj, scale?, speed?)
engine.juice.squash(obj)
engine.juice.typewriter(textObj, text, speed?)

// Physics
engine.physics.addBody(obj, config)
engine.physics.collider(a, b, callback?)
engine.physics.overlap(a, b, callback?)
engine.physics.gravity(value)

// Camera
engine.camera.follow(target, config?)
engine.camera.shake(intensity, duration)
engine.camera.zoom(level, duration?)
engine.camera.pan(x, y, duration?)
engine.camera.bounds(x, y, width, height)

// Audio
engine.audio.play(id)
engine.audio.music(id, loop?)
engine.audio.stopMusic()
engine.audio.volume(channel, level)

// Input (already good, keep as-is)
engine.input.left / right / up / down / jump
engine.input.pointer.x / y / down / justDown

// Scene
engine.scene.switch(name, data?)
engine.scene.add(sceneInstance)

// UI
engine.ui.healthBar(x, y, config?)
engine.ui.score(x, y, config?)
engine.ui.timer(x, y, config?)
engine.ui.text(x, y, text, style?)

// Assets (from asset bank)
engine.assets.sprite(key)        // returns PIXI.Sprite from asset bank
engine.assets.animation(key)     // returns AnimatedSprite
engine.assets.texture(key)       // returns PIXI.Texture
```

### 1.2 Implement the API wrapper

- File: `packages/vibexe-engine/src/shared/game-2d-engine.ts`
- Wrap existing functionality behind the new clean API
- Keep backward compatibility during transition (old methods still work)
- Each namespace is a class: `SpawnSystem`, `EffectsSystem`, `JuiceSystem`, `PhysicsSystem`, etc.

### 1.3 Write TypeScript interfaces

- File: `packages/vibexe-engine/src/shared/game-2d-types.ts`
- Define `FeatureConfig`, `SpawnConfig`, `EnemyConfig`, `PlatformConfig`, etc.
- These types serve as documentation AND validation for AI-generated configs

### Key files to modify:
- `packages/vibexe-engine/src/shared/game-2d-engine.ts` — main engine class
- `packages/vibexe-engine/src/shared/game-2d-effects.ts` — effects wrapper
- `packages/vibexe-engine/src/shared/game-2d-templates.ts` — update drawing helpers

---

## Phase 2: Feature Snippet Format & Interface

**Goal**: Define the standard format for feature bank snippets so they're composable, self-contained, and AI-friendly.

### 2.1 Define the Feature interface

```ts
interface GameFeature {
  // Metadata (stored in DB)
  id: string;                          // unique slug: "double-jump"
  name: string;                        // "Double Jump"
  description: string;                 // "Allows player to jump again mid-air"
  category: string;                    // "Mechanics/Movement/Double Jump"
  type: 'instruction' | 'condition' | 'event';
  engine: '2d' | '3d' | 'shared';
  version: string;                     // semver
  keywords: string[];                  // ["jump", "air", "movement", "platformer"]
  parameters: FeatureParameter[];      // configurable params with types/defaults
  dependencies: string[];              // other feature IDs this requires
  genres: string[];                    // ["platformer", "runner"] — which genres this fits

  // Code (stored in DB as text)
  code: string;                        // the TypeScript implementation
}

interface FeatureParameter {
  name: string;                        // "maxJumps"
  type: 'number' | 'string' | 'boolean' | 'color' | 'select';
  default: any;                        // 2
  min?: number;                        // 1
  max?: number;                        // 5
  description: string;                 // "Maximum number of air jumps"
  options?: string[];                  // for 'select' type
}
```

### 2.2 Define the runtime interface each snippet implements

```ts
interface FeatureRuntime {
  id: string;
  init(engine: Engine2D, config: Record<string, any>): void;
  update?(engine: Engine2D, dt: number): void;
  destroy?(): void;
  onEvent?(event: string, data: any): void;
}
```

Every snippet exports a function that returns a `FeatureRuntime`. The engine's feature manager calls `init()` on start, `update()` each frame, and `destroy()` on cleanup.

### 2.3 Example snippet: Double Jump

```ts
// Feature: double-jump
// Category: Mechanics/Movement
// Parameters: maxJumps (number, default: 2, min: 1, max: 5)

export default function createDoubleJump(config: { maxJumps: number }) {
  let jumpsRemaining = config.maxJumps;
  let isGrounded = false;

  return {
    id: 'double-jump',

    init(engine: Engine2D) {
      // Listen for ground state changes from physics
    },

    update(engine: Engine2D, dt: number) {
      // Check grounded state
      const player = engine.getPlayer();
      if (!player) return;

      isGrounded = player.body?.isGrounded ?? false;
      if (isGrounded) jumpsRemaining = config.maxJumps;

      // Handle jump input
      if (engine.input.jump && jumpsRemaining > 0) {
        player.body.vy = -engine.settings.jumpForce;
        jumpsRemaining--;

        // Effects
        if (!isGrounded) {
          engine.effects.dust(player.x, player.y + player.height / 2);
          engine.juice.squash(player.sprite);
        }
      }
    },

    destroy() {
      // cleanup if needed
    }
  };
}
```

### 2.4 Feature Manager in the engine

- File: `packages/vibexe-engine/src/shared/game-2d-feature-manager.ts`
- `FeatureManager.register(feature)` — adds feature to active list
- `FeatureManager.updateAll(dt)` — calls update on all registered features
- `FeatureManager.emit(event, data)` — broadcasts events to all features
- `FeatureManager.destroy()` — cleanup all features
- Handles dependency resolution (if feature A requires feature B, B inits first)

---

## Phase 3: Database & Admin UI

**Goal**: Build the feature bank storage and visual admin hub.

### 3.1 Database schema

Add to existing Drizzle schema in `apps/studio.vibexe.ai/db/schema.ts`:

```ts
export const featureBankSnippets = pgTable('feature_bank_snippets', {
  id: text('id').primaryKey(),                    // "double-jump"
  dbId: serial('db_id').unique(),
  name: text('name').notNull(),                   // "Double Jump"
  description: text('description').notNull(),
  category: text('category').notNull(),           // "Mechanics/Movement"
  type: text('type').notNull(),                   // "instruction" | "condition" | "event"
  engine: text('engine').notNull(),               // "2d" | "3d" | "shared"
  version: text('version').notNull().default('1.0.0'),
  keywords: json('keywords').$type<string[]>().default([]),
  parameters: json('parameters').$type<FeatureParameter[]>().default([]),
  dependencies: json('dependencies').$type<string[]>().default([]),
  genres: json('genres').$type<string[]>().default([]),
  code: text('code').notNull(),                   // TypeScript implementation
  isBuiltIn: boolean('is_built_in').default(false), // shipped with engine vs user-created
  isVerified: boolean('is_verified').default(false), // tested and approved
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 3.2 API routes

Under `apps/studio.vibexe.ai/app/api/admin/feature-bank/`:

```
GET    /api/admin/feature-bank/snippets          — list all (with filters: engine, type, category, genre, search)
GET    /api/admin/feature-bank/snippets/[id]     — get one snippet with full code
POST   /api/admin/feature-bank/snippets          — create new snippet
PUT    /api/admin/feature-bank/snippets/[id]     — update snippet
DELETE /api/admin/feature-bank/snippets/[id]     — delete snippet
GET    /api/admin/feature-bank/categories        — list all categories (tree)
POST   /api/admin/feature-bank/validate          — validate snippet code against engine
```

All routes protected by `requireAdmin()`.

Builder-facing (non-admin) endpoint:
```
GET    /api/app-builder/feature-bank/snippets    — list available snippets (no code, just metadata)
GET    /api/app-builder/feature-bank/snippets/[id]/code — get snippet code (for compilation)
```

### 3.3 Admin Hub UI

Under `apps/studio.vibexe.ai/app/(main)/admin/games-engine/`:

Add a "Feature Bank" tab to the existing games engine admin page, or create a new page at `admin/feature-bank/`.

**UI Components:**
- **Snippet list** — grid/list view with cards showing name, description, category, type badge, engine badge, version
- **Category sidebar** — tree navigation (Mechanics/Movement, Mechanics/Combat, Effects/Weather, etc.)
- **Type filter** — toggle tabs: Instructions / Conditions / Events (like Game Creator 2)
- **Engine filter** — 2D / 3D / Shared
- **Search** — full-text search across name, description, keywords
- **Snippet detail/editor** — Monaco editor for code, parameter form builder, metadata fields
- **Preview** — ability to test a snippet in an isolated engine sandbox
- **Import/Export** — JSON export/import for sharing snippets

---

## Phase 4: AI Integration

**Goal**: Rewire the AI game generation pipeline to use the feature bank.

### 4.1 New AI workflow

Replace the current `game-2d-developer.ts` system prompt (373 lines) with a new approach:

**Step 1: Feature Selection (structured output)**

AI receives: user prompt + available features catalog + available assets catalog

AI generates structured JSON:
```json
{
  "theme": "forest",
  "genre": "platformer",
  "features": [
    { "id": "double-jump", "config": { "maxJumps": 2 } },
    { "id": "coin-magnet", "config": { "range": 100 } },
    { "id": "enemy-patrol", "config": { "speed": 80 } },
    { "id": "breakable-block", "config": {} },
    { "id": "rain-weather", "config": { "intensity": 0.5 } }
  ],
  "assets": {
    "player": "knight_hero",
    "enemy": "forest_slime",
    "coin": "gold_coin",
    "platform": "grass_block"
  },
  "layout": {
    "worldWidth": 4000,
    "worldHeight": 800,
    "platformCount": 14,
    "coinCount": 25,
    "enemyCount": 6
  },
  "wiring": [
    { "event": "player.collect.coin", "actions": ["sparkle-effect", "score.add(10)", "juice.pop"] },
    { "event": "player.hit.enemy", "actions": ["screen-shake", "lives.lose(1)", "dust-effect"] },
    { "event": "player.die", "actions": ["explosion-effect", "scene.switch('game-over')"] }
  ]
}
```

**Step 2: Assembly**

The compiler:
1. Fetches feature code from the bank
2. Generates the scene file by composing features
3. Injects asset references
4. Applies layout generation
5. Wires events according to the wiring config

**Step 3: Custom code (if needed)**

If the user asks for something not in the bank:
- AI writes a custom feature snippet using the same `FeatureRuntime` interface
- The snippet is added as a `custom-feature.ts` file
- It follows the exact same pattern as bank features (AI learned from examples)
- If the custom code crashes, the base game still works (graceful degradation)

### 4.2 New system prompt

Replace 373 lines with ~50 lines:

```
You are a 2D game designer for the Vibexe engine (PixiJS + Proton + GSAP).

WORKFLOW:
1. Select features from the Feature Bank to match the user's request
2. Configure each feature's parameters
3. Choose assets from the Asset Bank
4. Define the level layout
5. Wire events (what happens when things interact)
6. If something isn't in the Feature Bank, write a custom feature using the FeatureRuntime interface

OUTPUT: JSON game specification (see schema below)

QUALITY STANDARDS:
- Every game must have ambient particle effects (theme-appropriate)
- Every game must have juice effects (screen shake on hits, pop on collect, squash on land)
- Platforms must have visual depth (shadows, grass, gradients)
- Characters must be multi-part sprites with animations

AVAILABLE FEATURES:
[dynamically injected list from feature bank — name + description + parameters only]

AVAILABLE ASSETS:
[dynamically injected from asset bank]

EXAMPLE (a polished forest platformer):
[one complete JSON example showing good feature selection, wiring, and layout]
```

### 4.3 Fallback system

When AI writes custom code and it fails at runtime:
1. Compiler wraps each custom feature in try/catch
2. If a feature's `init()` or `update()` throws, it's silently disabled
3. Base game (bank features) continues working
4. Error is logged and shown in the game command center
5. AI can be prompted to fix the specific failing feature

### 4.4 Update the compiler

- File: `apps/studio.vibexe.ai/lib/game-compiler/compiler.ts`
- Add feature bank compilation mode:
  - Fetch feature code from DB
  - Generate scene file from JSON spec
  - Bundle features as modules
  - Inject asset loading
  - Apply try/catch wrappers on custom features

### 4.5 Update file-tools.ts

- Replace `patch_file` workflow with `compose_game` tool
- AI uses `compose_game` to submit the JSON game specification
- Add `add_custom_feature` tool for writing custom code when needed
- Keep `read_file` so AI can inspect generated output

---

## Phase 5: Filling the Bank — Initial Feature Set

**Goal**: Create 40-50 core features covering the most common 2D game mechanics.

### 5.1 Source material for feature logic

| Source | License | What To Extract |
|--------|---------|-----------------|
| Phaser 3 examples (5000+) | MIT | Mechanic logic, patterns, parameter ranges |
| Ct.js catmods | MIT | Modular architecture patterns, PixiJS-compatible code |
| Our existing engine code | Ours | Water/lava, L-system trees, Proton effects, GSAP juice |
| Game Creator 2 Hub | Reference only | Category structure, parameter design, feature descriptions |

### 5.2 Initial feature list by category

**Mechanics / Movement (8)**
- `basic-movement` — left/right walk + jump
- `double-jump` — extra mid-air jumps
- `wall-slide` — slide down walls + wall jump
- `dash` — horizontal dash with cooldown + afterimage
- `crouch` — crouch + crawl through tight spaces
- `ladder-climb` — climb vertical ladders
- `swimming` — buoyancy + swim controls in water zones
- `grapple-hook` — swing from attach points

**Mechanics / Combat (6)**
- `melee-attack` — close-range swing with hitbox
- `projectile-shoot` — fire bullets/arrows with cooldown
- `enemy-stomp` — bounce on enemies to kill them (Mario-style)
- `knockback` — push back on damage
- `invincibility-frames` — brief invulnerability after taking damage
- `shield-block` — block incoming damage

**Enemies / AI (5)**
- `enemy-patrol` — walk back and forth between points
- `enemy-chase` — follow player when in range
- `enemy-fly` — flying enemy with sine-wave movement
- `enemy-shoot` — ranged enemy that fires at player
- `enemy-boss` — large enemy with multiple attack phases

**Collectibles / Items (5)**
- `coin-collect` — pickup coins with score increment
- `coin-magnet` — attract nearby coins toward player
- `power-up-speed` — temporary speed boost
- `power-up-invincible` — temporary invincibility with glow
- `health-pickup` — restore health/lives

**Level / World (6)**
- `moving-platform` — platform moves on a path
- `breakable-block` — block shatters when hit (with particles)
- `spike-trap` — stationary hazard that damages player
- `spring-pad` — bounces player high (with squash effect)
- `checkpoint` — save respawn position
- `portal-teleport` — teleport between two points

**Effects / Visual (5)**
- `rain-weather` — rain particles + puddle splashes
- `snow-weather` — snow particles + accumulation
- `ambient-particles` — theme-based ambient (fireflies, embers, dust, etc.)
- `parallax-background` — multi-layer scrolling mountains/clouds
- `day-night-cycle` — gradual sky color transition

**UI / HUD (4)**
- `health-display` — hearts or health bar
- `score-counter` — animated score with juice on change
- `timer-countdown` — countdown with urgency effects when low
- `minimap` — small overview of level

**Systems (5)**
- `lives-system` — life count + game over flow
- `combo-system` — chain kills/collects for multiplier
- `difficulty-scaling` — enemies get harder over time
- `camera-follow` — smooth camera with dead zones + bounds
- `screen-transition` — fade/wipe between scenes

**Total: ~44 features** — enough to create diverse, polished games across platformer, runner, shooter, and puzzle genres.

### 5.3 Feature writing process

For each feature:
1. Define metadata (name, category, parameters, keywords, genres)
2. Write implementation using the new `engine.*` API
3. Include built-in visual polish (particles, juice, sounds where appropriate)
4. Test in isolated sandbox
5. Mark as `isVerified: true`
6. Add to database via admin UI or seed script

---

## Phase 6: Asset Bank Integration

**Goal**: Connect the feature bank to an asset catalog so AI picks sprites/sounds by name.

### 6.1 Asset catalog table

```ts
export const assetBankItems = pgTable('asset_bank_items', {
  id: text('id').primaryKey(),                    // "knight_hero"
  dbId: serial('db_id').unique(),
  name: text('name').notNull(),                   // "Knight Hero"
  type: text('type').notNull(),                   // "sprite" | "spritesheet" | "sound" | "music" | "background"
  category: text('category').notNull(),           // "Characters/Heroes"
  engine: text('engine').notNull(),               // "2d" | "3d" | "shared"
  url: text('url').notNull(),                     // CDN/storage URL
  metadata: json('metadata').$type<AssetMetadata>(), // frame count, dimensions, states, etc.
  tags: json('tags').$type<string[]>().default([]),
  license: text('license').default('internal'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 6.2 Populate with existing assets

- Import from `media-stock/games/2d/sprites/` (Kenney CC0 library already there)
- Add metadata: frame counts, animation states, dimensions
- Organize into categories matching the feature bank's expectations

### 6.3 AI asset generation fallback

When a requested asset doesn't exist in the bank:
- AI generates using Hugging Face Inference API (when credits available)
- Or falls back to programmatic canvas drawing (existing system)
- Generated assets can be saved to the bank for reuse

---

## Phase 7: Migration & Cleanup

**Goal**: Transition from the old hybrid-starter system to the new feature bank system.

### 7.1 Parallel run

- Keep old `game-2d-developer.ts` agent working
- Add new `game-2d-composer.ts` agent that uses the feature bank
- Feature flag in admin panel: `useFeatureBank: boolean`
- A/B test: compare output quality between old and new approaches

### 7.2 Deprecation

Once feature bank approach is validated:
- Remove hybrid starter templates from `game-2d-templates.ts`
- Remove `patch_file` tool for game files
- Remove the 373-line system prompt
- Remove guardrails (line count limits, forbidden patterns, etc.)
- Clean up `file-tools.ts` game-specific overrides

### 7.3 Update admin games engine page

- Add feature bank management tab
- Add asset bank management tab
- Add A/B comparison tool (generate same prompt with both approaches)
- Add quality metrics dashboard (if we build validation later)

---

## Execution Order

| Order | Phase | What | Depends On |
|-------|-------|------|------------|
| 1 | Phase 1 | Engine API redesign | Nothing |
| 2 | Phase 2 | Feature snippet format + Feature Manager | Phase 1 |
| 3 | Phase 3 | Database schema + API routes | Phase 2 |
| 4 | Phase 5 | Write initial 44 features | Phase 1 + 2 |
| 5 | Phase 3 | Admin Hub UI | Phase 3 API + Phase 5 features |
| 6 | Phase 4 | AI integration (new prompt + compiler) | Phase 2 + 3 + 5 |
| 7 | Phase 6 | Asset bank integration | Phase 3 |
| 8 | Phase 7 | Migration + cleanup | Phase 4 + 6 |

Phases 1-2 can be done immediately. Phase 5 (writing features) can happen in parallel with Phase 3 (database/UI). Phase 4 (AI integration) needs the features to exist first.

---

## Key Files Reference

| File | Role |
|------|------|
| `packages/vibexe-engine/src/shared/game-2d-engine.ts` | Engine core — API redesign here |
| `packages/vibexe-engine/src/shared/game-2d-effects.ts` | Proton effects — wrap in engine.effects |
| `packages/vibexe-engine/src/shared/game-2d-templates.ts` | Drawing helpers — keep as internal, expose via engine.spawn |
| `packages/vibexe-engine/src/shared/game-2d-feature-manager.ts` | NEW — feature lifecycle management |
| `packages/vibexe-engine/src/shared/game-2d-types.ts` | NEW — TypeScript interfaces |
| `packages/vibexe-engine/src/agents/game-2d-developer.ts` | OLD system prompt — replace with game-2d-composer.ts |
| `apps/studio.vibexe.ai/db/schema.ts` | Add feature_bank + asset_bank tables |
| `apps/studio.vibexe.ai/app/api/admin/feature-bank/` | NEW — admin API routes |
| `apps/studio.vibexe.ai/app/api/app-builder/feature-bank/` | NEW — builder-facing API |
| `apps/studio.vibexe.ai/lib/game-compiler/compiler.ts` | Update — feature bank compilation mode |
| `apps/studio.vibexe.ai/app/(main)/app-builder/lib/file-tools.ts` | Update — replace patch_file with compose_game |
| `apps/studio.vibexe.ai/app/api/app-builder/chat/route.ts` | Update — new AI orchestration flow |
