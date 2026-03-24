# Plan: Scene Templates in Feature Bank + compose_game Refactor

## Context

The current compose_game generates ONE scene type (platformer) regardless of genre. The old system had 4 hardcoded starters (platformer=883 lines, runner=146 lines, puzzle=183 lines, shooter=179 lines). We need a composable approach where:

1. Base scene templates live in the Feature Bank as a new "Scene Templates" category
2. compose_game picks the right base scene by genre
3. The route injects a base scene during setup (so the preview works during the plan phase)
4. The AI can enhance/replace it with Feature Bank features on the build phase

## Current State (what's broken)

- compose_game only generates platformer scenes regardless of `genre` param
- Route.ts disabled hybrid starter injection → no game during plan phase → "No entry point" compile error
- `applyBiomePostProcessing` causes half-screen filter with camera scroll (disabled but should stay off)
- Feature Bank score-counter/lives-system snippets duplicate compose_game's built-in UI (partially fixed)
- AI using Kimi K2.5 does plan-only first turn (README only, maxSteps=5) → no game file created

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Feature Bank DB (featureBankSnippets table)          │
├──────────────────┬──────────────────────────────────┤
│ Scene Templates  │ platformer-base (~500 lines)     │
│ (type: "scene")  │ runner-base (~300 lines)         │
│                  │ shooter-base (~300 lines)        │
│                  │ puzzle-base (~300 lines)         │
├──────────────────┼──────────────────────────────────┤
│ Mechanics        │ double-jump, wall-slide, dash... │
│ Enemies/AI       │ enemy-patrol, enemy-chase...     │
│ Collectibles     │ coin-collect, power-ups...       │
│ UI/HUD           │ score-counter, lives-system...   │
│ Effects          │ screen-shake, rain-weather...    │
│ Systems          │ checkpoint, level-transition...  │
└──────────────────┴──────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ compose_game (file-tools.ts)                        │
│                                                     │
│  1. Fetch base scene snippet by genre               │
│  2. Inject Creative Brief params (theme, seed,      │
│     gravity, moveSpeed, etc.) via string replace     │
│  3. Fetch mechanic/effect snippets                  │
│  4. Register snippets in FeatureManager             │
│  5. Save GameScene2D.ts                             │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ Route.ts (chat/route.ts)                            │
│                                                     │
│  Setup phase (before AI runs):                      │
│  1. Fetch base scene snippet for detected genre     │
│  2. Inject Creative Brief params                    │
│  3. Save as GameScene2D.ts → preview works          │
│                                                     │
│  Plan phase (maxSteps=5):                           │
│  - AI creates README → user sees working game       │
│                                                     │
│  Build phase (maxSteps=100):                        │
│  - AI calls compose_game with Feature Bank          │
│    selections → replaces base with featured version │
│  - Or uses patch_file to enhance base scene         │
└─────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create Base Scene Snippet Code (4 files)

Write the 4 genre base scene snippets. Each is a complete, working GameScene2D.ts template with **placeholder tokens** for Creative Brief params.

**Placeholder tokens** (replaced at generation time):
```
__THEME__ → 'forest'
__SEED__ → 1234
__GRAVITY__ → 980
__MOVE_SPEED__ → 280
__JUMP_FORCE__ → 520
__WORLD_WIDTH__ → 4000
__WORLD_HEIGHT__ → 900
__GROUND_Y__ → 680
__PLATFORM_COUNT__ → 11
__COIN_COUNT__ → 27
__ENEMY_COUNT__ → 6
__LEVEL_SHAPE__ → 'flat-wide'
__DOUBLE_JUMP__ → true
__WALL_SLIDE__ → false
__LIVES__ → 3
__ENEMY_SPEED__ → 60
__START_SPEED__ → 220 (runner)
__MAX_SPEED__ → 550 (runner)
__GRID_COLS__ → 7 (puzzle)
__GRID_ROWS__ → 7 (puzzle)
__GEM_COLOR_COUNT__ → 6 (puzzle)
__FIRE_RATE__ → 0.14 (shooter)
__ENEMY_SPAWN_RATE__ → 1.4 (shooter)
```

**Source material for each:**

| Genre | Source | Lines | Key adaptations |
|-------|--------|-------|-----------------|
| platformer-base | GAME_2D_SCENE_STARTER (lines 2321-3202) | ~500 | Remove built-in score/lives UI (Feature Bank handles), remove applyBiomePostProcessing, use placeholder tokens, add FeatureManager init/destroy, emit events for coin-collect and player-hit |
| runner-base | GAME_2D_SCENE_STARTER_RUNNER (lines 3205-3350) | ~300 | Same visual atmosphere as platformer (sky, mountains, fog, clouds), auto-scroll mechanics, speed ramp, procedural platform spawning, emit events |
| puzzle-base | GAME_2D_SCENE_STARTER_PUZZLE (lines 3353-3535) | ~300 | Grid-based board, match-3 detection, gravity cascade, gem rendering, pointer input, emit events |
| shooter-base | GAME_2D_SCENE_STARTER_SHOOTER (lines 3538-3716) | ~300 | Starfield background, bullet system, wave spawner, enemy ships, auto-fire, emit events |

**All 4 share:**
- Seeded PRNG (Mulberry32)
- Theme palette system (PALETTES[THEME])
- Sprite library preloading (_loadSpriteLib)
- FeatureManager init in enter(), destroy in exit()
- AI ENHANCEMENT ZONE marker for patch_file
- Event emission (coin-collect, player-hit, enemy-kill, etc.)
- Controls hint in UI
- Vignette on UI layer (no applyBiomePostProcessing)

**All 4 EXCLUDE (Feature Bank handles these):**
- Score display (score-counter snippet)
- Lives display (lives-system snippet)
- applyBiomePostProcessing (causes filter bugs)

### Step 2: Seed Scene Templates into Feature Bank DB

SQL INSERT for each scene template:

```sql
INSERT INTO feature_bank_snippets (id, name, description, category, type, engine, version, keywords, parameters, dependencies, genres, code, is_built_in, is_verified)
VALUES
  ('platformer-base', 'Platformer Base Scene', 'Complete platformer with platforms, coins, enemies, physics, camera follow', 'Scene Templates', 'scene', '2d', '1.0.0',
   '["platformer","side-scroller","jump","platform"]',
   '[{"name":"theme","type":"string","default":"forest"},{"name":"seed","type":"number","default":1234}, ...]',
   '[]', '["platformer"]',
   '<full scene code with __PLACEHOLDER__ tokens>',
   true, true),
  ('runner-base', ...),
  ('puzzle-base', ...),
  ('shooter-base', ...);
```

### Step 3: Create generateBaseScene() Function

**File:** `apps/studio.vibexe.ai/app/(main)/app-builder/lib/scene-generator.ts` (new file)

```typescript
export async function generateBaseScene(
  genre: string,
  params: Record<string, any>
): Promise<string> {
  // 1. Fetch the scene template from Feature Bank by genre
  const templateId = `${genre}-base`;
  const [template] = await db.select()
    .from(featureBankSnippets)
    .where(eq(featureBankSnippets.id, templateId));

  if (!template) {
    // Fallback to platformer-base
    const [fallback] = await db.select()
      .from(featureBankSnippets)
      .where(eq(featureBankSnippets.id, 'platformer-base'));
    if (!fallback) throw new Error('No base scene template found');
    return replaceParams(fallback.code, params);
  }

  return replaceParams(template.code, params);
}

function replaceParams(code: string, params: Record<string, any>): string {
  let result = code;
  for (const [key, value] of Object.entries(params)) {
    const token = `__${key.replace(/([A-Z])/g, '_$1').toUpperCase()}__`;
    result = result.replace(new RegExp(token, 'g'), String(value));
  }
  return result;
}
```

### Step 4: Update Route.ts — Re-enable Starter Injection via Feature Bank

**File:** `apps/studio.vibexe.ai/app/api/app-builder/chat/route.ts`

Replace the disabled injection block (lines 993-995) with:

```typescript
// 2D games: inject base scene from Feature Bank during setup
if (isGame2d && !existingPaths.has("src/scenes/GameScene2D.ts")) {
  try {
    const subGenre = isShooter2d ? "shooter" : isRunner2d ? "runner" : isPuzzle2d ? "puzzle" : "platformer";
    const params = game2dBrief ? {
      theme: game2dBrief.theme,
      seed: game2dBrief.seed,
      gravity: game2dBrief.gravity,
      moveSpeed: game2dBrief.moveSpeed,
      jumpForce: game2dBrief.jumpForce,
      worldWidth: game2dBrief.worldWidth,
      platformCount: game2dBrief.platformCount,
      coinCount: game2dBrief.coinCount,
      enemyCount: game2dBrief.enemyCount,
      levelShape: game2dBrief.levelShape,
      // Genre-specific params
      startSpeed: game2dBrief.startSpeed,
      maxSpeed: game2dBrief.maxSpeed,
      gridCols: game2dBrief.gridCols,
      gridRows: game2dBrief.gridRows,
      gemColorCount: game2dBrief.gemColorCount,
      fireRate: game2dBrief.fireRate,
      enemySpawnRate: game2dBrief.enemySpawnRate,
    } : {};

    const sceneCode = await generateBaseScene(subGenre, params);
    await saveFile(appId, "src/scenes/GameScene2D.ts", sceneCode, "typescript");
    console.log(`[Chat API] Base scene injected via Feature Bank: ${subGenre}-base`);
  } catch (e) {
    console.error(`[Chat API] Base scene injection failed:`, e);
  }
}
```

### Step 5: Refactor compose_game Tool

**File:** `apps/studio.vibexe.ai/app/(main)/app-builder/lib/file-tools.ts`

Replace the 640-line hardcoded template in compose_game with:

```typescript
compose_game: tool({
  description: "Compose a 2D game from Feature Bank...",
  inputSchema: z.object({ /* same params */ }),
  execute: async (params) => {
    // 1. Generate base scene from Feature Bank template
    const sceneBase = await generateBaseScene(params.genre, {
      theme: params.theme,
      seed: params.seed ?? 1234,
      gravity: params.gravity ?? 980,
      // ... all params
    });

    // 2. Fetch mechanic snippets from Feature Bank
    const features = JSON.parse(params.features || "[]");
    const bankFeatures = await fetchFeatures(features);

    // 3. Inject Feature Bank registrations into scene
    const sceneCode = injectFeatures(sceneBase, bankFeatures, features);

    // 4. Inject custom code if provided
    const finalCode = params.customCode
      ? sceneCode.replace('// === AI ENHANCEMENT ZONE ===',
          `// === AI ENHANCEMENT ZONE ===\n    ${params.customCode}`)
      : sceneCode;

    // 5. Save
    await saveFile(appId, "src/scenes/GameScene2D.ts", finalCode, "typescript");
    return { success: true, ... };
  }
})
```

This makes compose_game a thin assembler (~50 lines) instead of carrying 640 lines of hardcoded template.

### Step 6: Update System Prompt

**File:** `packages/vibexe-engine/src/agents/game-2d-developer.ts`

Update RULE #0.5 to reflect:
- A base scene already exists (injected during setup)
- compose_game REPLACES it with Feature Bank selections
- patch_file ENHANCES the existing scene
- The AI should choose: compose_game for full rebuild, patch_file for targeted additions

### Step 7: Update Addenda in Route.ts

**File:** `apps/studio.vibexe.ai/app/api/app-builder/chat/route.ts`

Update runtime addenda to tell the AI:
- "A base [genre] scene is already working in the preview"
- "Call compose_game to replace it with Feature Bank features, or use patch_file to enhance it"
- Keep compose_game params from Creative Brief

### Step 8: Test All 4 Genres

For each genre (platformer, runner, puzzle, shooter):
1. Create game in vibexe.online
2. Verify: plan phase shows working game in preview
3. Say "build it" → verify AI calls compose_game or patch_file
4. Verify: game compiles, runs, features work

### Step 9: Commit, Push, Deploy

Single commit with all changes. Deploy via WHM terminal.

## Files Modified

| File | Change |
|------|--------|
| `apps/studio.vibexe.ai/app/(main)/app-builder/lib/scene-generator.ts` | **NEW** — generateBaseScene() function |
| `apps/studio.vibexe.ai/app/(main)/app-builder/lib/file-tools.ts` | Major: refactor compose_game to use scene-generator instead of hardcoded template |
| `apps/studio.vibexe.ai/app/api/app-builder/chat/route.ts` | Medium: re-enable starter injection via Feature Bank, update addenda |
| `packages/vibexe-engine/src/agents/game-2d-developer.ts` | Medium: update system prompt for new workflow |
| `tools/seed-scene-templates.sql` | **NEW** — SQL to seed 4 scene templates into Feature Bank |

## Files NOT Modified

| File | Why |
|------|-----|
| `game-2d-templates.ts` | Keep old starters for reference (source material for snippets) |
| `game-2d-seed.ts` | Unchanged — still drives Creative Brief |
| `game-2d-engine.ts` | Unchanged — FeatureManager already integrated |
| `game-2d-assets.ts` | Unchanged — drawing helpers work as-is |
| `compiler.ts` | Unchanged — just needs GameScene2D.ts to exist |
| `db/schema.ts` | Unchanged — featureBankSnippets table already supports type="scene" |

## Key Design Decisions

1. **Scene templates as Feature Bank entries** — Not hardcoded in compose_game. Can be edited via admin UI, new genres added without deployment.

2. **Placeholder token system** — `__THEME__`, `__SEED__`, etc. Simple string replacement, no template engine needed. Works with the existing Feature Bank code column.

3. **Route injects base scene during setup** — Same as old system but dynamic. Preview works during plan phase. AI can replace/enhance on build phase.

4. **No applyBiomePostProcessing** — Removed from all scene templates. The ColorMatrixFilter causes rendering issues with camera-scrolled containers.

5. **No built-in score/lives UI** — Feature Bank snippets handle UI. Events emitted (coin-collect, player-hit) for snippets to react to.

6. **compose_game becomes thin assembler** — Fetches scene template + mechanic snippets, assembles, saves. ~50 lines instead of 640.

## Genre Scene Template Specs

### platformer-base (~500 lines)
- 18 visual layers (sky, stars, mountains, fog, clouds, decorations, ground, trees, ground details, platforms, player, coins, enemies, weather, camera, juice, water/lava, lighting, vignette)
- CharacterController with doubleJump/wallSlide
- Seeded PRNG level generation (levelShape-aware)
- Collision: coin-collect event, player-hit event
- Camera follow with smoothing

### runner-base (~300 lines)
- Visual atmosphere (sky, stars, mountains, fog, clouds)
- Auto-scrolling: player.vx = speed (constant)
- Procedural platform generation (infinite spawning)
- Speed ramp: startSpeed → maxSpeed over time
- Jump-only control (no horizontal input)
- Score = distance + coins
- Fall = instant game over (1 life)

### puzzle-base (~300 lines)
- Centered grid board with cell backgrounds
- Random gem initialization (prevents starting matches)
- Pointer input: select gem, swap with adjacent
- Match-3 detection (horizontal + vertical)
- Gravity cascade with GSAP animation
- New gem spawning at top
- Score = matched gems × 10

### shooter-base (~300 lines)
- Dark starfield background (scrolling stars)
- Player ship at bottom center, horizontal movement only
- Auto-fire bullet system (cyan bullets, upward)
- Wave-based enemy spawning (speed scales with wave)
- Bullet-enemy collision (distance check)
- Player-enemy collision (damage + invincibility)
- Score = kills × 100, wave++ every 1000 pts

## Rollback Strategy

- Old hybrid starters still exist in game-2d-templates.ts
- If Feature Bank scene templates fail, route.ts can fall back to buildGame2dSceneStarter() functions
- Re-import the old starter functions and add fallback in the injection block

## Verification Checklist

- [ ] platformer-base: preview works during plan phase, compose_game replaces on build
- [ ] runner-base: auto-scroll works, speed ramp, fall death
- [ ] puzzle-base: grid renders, match-3 works, cascade animates
- [ ] shooter-base: bullets fire, enemies spawn, wave progression
- [ ] Feature Bank snippets (score-counter, lives-system) work with all 4 genres
- [ ] No duplicate UI elements
- [ ] No half-screen filter
- [ ] Theme follows user's explicit request
- [ ] Different seeds produce visually different levels
