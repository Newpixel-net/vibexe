# Work Plan: 2D Visual Variety — Every Game Looks Unique

## Problem
The seed variety system generates different parameters (theme, difficulty, mechanics) but games still look visually similar. Mountains are just color-swapped, terrain is the same shape, trees are identical, no atmospheric effects. Need to leverage Pixi.js v8's full feature set to make every game visually distinct.

## Research Completed
- `.planning/research/pixi-v8-advanced-visuals.md` (1107 lines)
- `.planning/research/procedural-2d-art-techniques.md` (1493 lines)
- Indie game analysis (Alto's Adventure, Celeste, Hollow Knight, Ori, Limbo, Terraria)
- Current engine audit (24 drawing functions, 8 palettes, 37+ unused filters)

## Architecture
All changes go into `packages/vibexe-engine/src/shared/game-2d-templates.ts` (VISUAL_HELPERS_CONTENT template exported as `src/config/assets.ts`). This is the single file that defines all visual drawing functions available to 2D games.

## Phases

### Phase A: Per-Biome Post-Processing + Atmosphere (~2 hours)
**Files:** `game-2d-templates.ts` (VISUAL_HELPERS_CONTENT + GAME_2D_SCENE_STARTER)

1. **Add `applyBiomePostProcessing(theme, container)` function** to VISUAL_HELPERS_CONTENT
   - Uses `PIXI.ColorMatrixFilter` presets per theme:
     - forest: saturate(0.15) + tint green + contrast(0.05)
     - sunset: kodachrome() + brightness(1.05)
     - space: night(0.15) + contrast(0.15)
     - volcanic: tint(0xff6644) + saturate(0.3) + contrast(0.15)
     - candy: saturate(0.25) + brightness(1.08)
     - arctic: tint(0xaaddff) + contrast(0.1) + brightness(1.03)
     - dark: brightness(0.7) + contrast(0.2) + desaturate partial
     - ocean: tint(0x88bbdd) + saturate(0.1)
   - Applied to the world container (not UI)

2. **Add `drawVignette(width, height)` function**
   - Radial gradient overlay: transparent center -> dark edges (alpha 0.35)
   - Added to UI layer (fixed position, not scrolling)

3. **Add `drawAtmosphericFog(worldW, groundY, fogColor, layerCount)` function**
   - 3 blurred semi-transparent ellipse layers at different Y positions
   - Each layer gets BlurFilter(8-16px)
   - Returns Container[] for parallax scrolling at different speeds in update()

4. **Update hybrid starter** to call:
   - `applyBiomePostProcessing(THEME, world)` after scene setup
   - `drawVignette(WW, WH)` added to UI container
   - `drawAtmosphericFog()` added between mountains and ground

### Phase B: L-System Trees + Vegetation Sway (~3 hours)
**Files:** `game-2d-templates.ts` (VISUAL_HELPERS_CONTENT)

1. **Add `drawLSystemTree(x, y, preset, theme, seed)` function**
   - 6 presets with different L-system rules:
     - `oak`: F[+F]F[-F][F], angle 25, gen 4 — forest/sunset
     - `pine`: F[+F][-F]F, angle 20, gen 5 — arctic
     - `palm`: F[+F], angle 35, gen 3 with curved trunk — ocean
     - `dead`: F[+F][-F], angle 30, gen 3, no leaves — volcanic/dark
     - `willow`: FF-[-F+F+F]+[+F-F-F], angle 22, gen 4 — dark
     - `candy`: Lollipop-style (straight trunk + spiral top) — candy
   - Uses seeded RNG for angle/length variation (not Math.random)
   - Draws trunk with decreasing thickness, leaves as circles at tips
   - Theme-driven colors from PAL.foliage / PAL.foliageLight
   - Generate once, cache via `app.renderer.generateTexture()`

2. **Add theme-to-tree-preset mapping**
   - `TREE_PRESETS: Record<string, string[]>` — each theme maps to 1-2 tree types
   - forest: ['oak'], sunset: ['oak'], arctic: ['pine', 'dead'], volcanic: ['dead'], candy: ['candy'], dark: ['willow', 'dead'], ocean: ['palm'], space: [] (no trees)

3. **Replace `drawTree()` calls in hybrid starter** with `drawLSystemTree()` using theme preset

4. **Add vegetation sway animation in update()**
   - `skew.x = Math.sin(time * 1.5 + tree.x * 0.01) * 0.015`
   - Different seed offset per tree so they don't sway in unison
   - Also apply to decorations

### Phase C: Additive Lighting + Bloom (~2 hours)
**Files:** `game-2d-templates.ts` (VISUAL_HELPERS_CONTENT + GAME_2D_SCENE_STARTER)

1. **Add `drawPointLight(x, y, radius, color, intensity)` function**
   - Radial gradient circle (bright center -> transparent edge)
   - `blendMode = 'add'` for additive compositing
   - Returns the Graphics object for animation

2. **Add `createLightingLayer(theme, platforms, decorations)` function**
   - Creates a Container with blendMode='add'
   - Places lights based on theme:
     - volcanic: orange lights at lava pools/vents, red glow along ground
     - dark: purple/green lights at mushrooms/lanterns, moonlight from above
     - space: cyan lights at pylons/antennas, star glow
     - ocean: bioluminescent blue-green at coral/seaweed
     - candy: pink/yellow glow at lollipops
     - forest: golden dappled light, firefly glow points
     - sunset: warm orange ambient from horizon
     - arctic: cool blue ambient, aurora shimmer
   - Optional: AdvancedBloomFilter on the light container

3. **Update hybrid starter** to create lighting layer after decorations

### Phase D: Dynamic Water/Lava Surfaces (~2 hours)
**Files:** `game-2d-templates.ts` (VISUAL_HELPERS_CONTENT + GAME_2D_SCENE_STARTER)

1. **Add `createWaterSurface(worldW, waterY, waterH, waterColor)` function**
   - Returns { container, update(time) }
   - Multi-sine wave surface redrawn each frame via g.clear()
   - Surface highlight line + specular sparkles
   - Semi-transparent gradient body
   - Only for themes: ocean, forest (pond)

2. **Add `createLavaSurface(worldW, lavaY, lavaH)` function**
   - Returns { container, update(time) }
   - Slow undulating surface with noise-driven cracks
   - Animated bubbles that appear and pop
   - Orange/red gradient with bright crack lines
   - Only for: volcanic theme

3. **Update hybrid starter** to conditionally create water/lava based on theme
   - ocean: water at groundY + some offset
   - volcanic: lava pools at specific positions
   - forest: optional small pond

### Phase E: GodrayFilter + Polish Effects (~1.5 hours)
**Files:** `game-2d-templates.ts` (VISUAL_HELPERS_CONTENT + GAME_2D_SCENE_STARTER)

1. **Add GodrayFilter to forest/sunset themes**
   - Apply to background container (mountains + sky)
   - Animate `godray.time += dt * 0.005` in update()
   - Subtle: gain=0.4, lacunarity=2.5

2. **Add DisplacementFilter for volcanic heat shimmer**
   - Generate noise texture via canvas
   - Apply to game world with low scale (5-10px)
   - Animate displacement sprite position

3. **Add wind system to update()**
   - Global wind variable that slowly changes via noise
   - Affects: tree sway amplitude, cloud speed, particle drift, grass lean
   - Per-theme wind strength: arctic=strong, forest=gentle, space=none

4. **Enhanced ambient particles per theme**
   - More varied particle sizes, colors, behaviors
   - Pulsing glow on firefly particles
   - Snow accumulation (tiny white dots on platforms)

## Verification Per Phase
1. `npx tsc --noEmit` — type check
2. Commit + push
3. Deploy to server via WHM terminal
4. Create 2D game from Dashboard Games tab
5. Verify visual effects visible and theme-appropriate
6. Create second game — verify visual variety
7. Check FPS stays above 50

## Performance Rules
- Generate procedural content ONCE, cache as sprite/texture
- Max 2-3 filters per container
- Water/lava redraw: keep step >= 4px
- L-system trees: max generation depth 5
- Fog layers: max 3 with blur
- Total filter GPU budget: < 4ms
