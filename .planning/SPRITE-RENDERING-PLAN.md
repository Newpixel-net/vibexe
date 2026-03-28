# Sprite-Based 2D Rendering — Replace All Primitives

## Goal
Replace ALL primitive Canvas drawing functions with sprite-based rendering using Kenney CC0 tileset packs. The AI keeps using the same API — only the visual output changes from ugly primitives to professional game art.

## Why Level Painter Failed
- Built a parallel system that conflicted with the existing template
- Complex procedural terrain + texture loading + async pipeline added too much complexity
- Mixed old primitives with new textured terrain = visual chaos
- The real problem was always: drawGroundStrip draws a gradient rectangle instead of game sprites

## Approach
Replace drawing functions in `config/assets.ts` (or wherever they live in the template strings). The functions keep the same signatures but render sprites instead of Canvas shapes.

## Kenney Asset Packs (CC0, all free)
1. **Platformer Pack Redux** — ground tiles, platforms, items, decorations
2. **Simplified Platformer Pack** — clean style ground/platform tiles
3. **Nature Kit** — trees, bushes, flowers, rocks
4. **Background Elements** — sky, clouds, mountains, parallax layers
5. **UI Pack** — hearts, buttons, HUD elements

## Functions to Replace
| Current Function | Renders Now | Should Render |
|---|---|---|
| `drawGroundStrip(x, y, w, h)` | Gradient rectangle | Tiled ground sprites with edge caps |
| `drawPlatformBlock(x, y, w, h)` | Colored block | Platform sprites with left/middle/right caps |
| `drawTree(x, y, scale)` | Circles on a stick | Tree sprite from tileset |
| `drawCoinToken(x, y, r)` | Yellow circle | Coin sprite |
| `drawEnemySlime(x, y, w, h)` | Blob shape | Enemy sprite |
| `drawHeart(x, y, size)` | Heart shape | Heart sprite from UI pack |
| `drawSkyGradient(w, h)` | Linear gradient | Parallax sky background sprite |
| `drawMountainRange(...)` | Triangle silhouettes | Mountain parallax sprite layers |
| `drawCloud(w, h)` | Ellipse | Cloud sprite |

## Texture Asset Pipeline
```
Kenney CC0 source → Download sprite sheets/PNGs
  → Upload to /opt/vibexe/media-stock/games/2d/tilesets/
  → Served via /api/app-builder/media-stock/2d/tilesets/{pack}/{file}.png
  → Loaded in game: new Image() + ctx.drawImage()
```

## Implementation Phases

### Phase 1: Download Kenney Packs + Setup
- Download Platformer Pack, Nature Kit, Background Elements
- Upload to media-stock server directory
- Verify serving via API endpoint

### Phase 2: Replace Ground/Platform Drawing
- `drawGroundStrip()` → tile ground sprites (left cap + middle tiles + right cap)
- `drawPlatformBlock()` → tile platform sprites with proper edges
- These are the most visible changes

### Phase 3: Replace Decorations
- `drawTree()` → tree sprites
- `drawCloud()` → cloud sprites
- `drawCoinToken()` → coin sprites
- Other decorations

### Phase 4: Replace Backgrounds
- `drawSkyGradient()` → sky background sprite/gradient
- `drawMountainRange()` → mountain parallax layers
- Background elements

### Phase 5: Update Level Painter (Optional)
- Once sprite-based drawing works, Level Painter can use the same sprite functions
- Instead of texture-filling a bitmap, it places sprite tiles along terrain contours
- This makes Level Painter and manual drawing use the SAME visual system

## Key Principles
- SAME API — AI code doesn't change, only the rendering
- NO parallel systems — improve what exists
- Quality from ASSETS, not algorithms
- Test each phase with real game creation
