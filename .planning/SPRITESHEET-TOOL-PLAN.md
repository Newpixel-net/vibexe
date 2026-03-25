# Plan: 3D-to-2D Spritesheet Tool + 2D Scene Editor Fix

## Context

Vibexe has a powerful 3D engine (Three.js r183) and a 2D engine (PixiJS 8.9.2), but no way to convert 3D models into 2D sprite assets. Users can get 3D models from meshy.ai and other sources, but can't use them in 2D games. Additionally, the 2D Scene Editor tab is completely non-functional — the bridge, data model, and object tree are all 3D-only.

This plan builds a "3D to 2D Spritesheet" pipeline that:
1. Captures 3D models as 2D frame sequences (rotation + skeletal animation)
2. Packs frames into PIXI.Spritesheet-compatible atlases
3. Integrates into the scene editor workflow
4. Auto-registers generated spritesheets for immediate use in 2D games

**Model input:** URL paste + local file upload + built-in media-stock 3D browser.

## Build Order

**Part 1 (first session):** Phase 1-4 — Core capture tool, packer, UI, storage
**Part 2 (next session):** Phase 5-7 — 2D scene editor fix, 3D mod scene, auto-integration

| Phase | What | Files Changed | Depends On | Part |
|-------|------|---------------|------------|------|
| **1** | Spritesheet capture engine (offscreen Three.js → PNG frames) | New: `lib/spritesheet-capture.ts` | Nothing | 1 |
| **2** | Spritesheet packer (frames → atlas PNG + JSON) | New: `lib/spritesheet-packer.ts` | Phase 1 | 1 |
| **3** | Capture Tool UI (modal dialog with 3D preview + media-stock browser) | New: `components/spritesheet-tool-dialog.tsx` | Phase 1+2 | 1 |
| **4** | Server storage endpoint for spritesheets | New: `app/api/app-builder/spritesheets/route.ts` | Phase 2 | 1 |
| **5** | Fix 2D scene "Add Scene" functionality | Edit: `game-editor-context.tsx`, `game-editor-panel.tsx` | Nothing | 2 |
| **6** | 3D Mod Scene type in 2D games | Edit: `game-editor-panel.tsx`, `game-editor-context.tsx`, `sandpack-preview.tsx` | Phase 5 | 2 |
| **7** | Integration: auto-register spritesheet in 2D game assets | Edit: `game-2d-engine.ts`, `game-2d-templates.ts`, `chat/route.ts` | Phase 4 | 2 |

---

## Phase 1: Spritesheet Capture Engine

**New file:** `apps/studio.vibexe.ai/app/(main)/app-builder/lib/spritesheet-capture.ts`

**Reuses pattern from:** `apps/studio.vibexe.ai/app/(main)/app-builder/lib/asset-thumbnail-renderer.ts`
- Same singleton WebGLRenderer with `preserveDrawingBuffer: true`
- Same GLTFLoader + model caching
- Same autoFit (Box3 bounding → center + scale)

**Class: `SpritesheetCapture`**

```
Properties:
  - THREE, GLTFLoader, renderer, scene, camera (same as thumbnail renderer)
  - frameWidth, frameHeight (configurable, default 128)

Methods:
  async init(width?: number, height?: number): void
    - Create WebGLRenderer (offscreen, no DOM attach)
    - PerspectiveCamera(45, aspect, 0.1, 100)
    - Scene with ambient + directional light
    - Transparent background (alpha: true)

  async loadModel(url: string): { model, animations, mixer }
    - GLTFLoader.load() → returns scene + AnimationClip[]
    - If has animations: create AnimationMixer
    - autoFit model to camera view
    - Returns { model, animations: clip[], mixer }

  captureRotation(model, config): Blob[]
    - config: { frames: 30, axis: 'y'|'x'|'z', angles?: number[] }
    - For each frame:
      1. Rotate model by (360/frames * i) degrees on axis
      2. renderer.render(scene, camera)
      3. canvas.toBlob() → collect
    - Returns array of PNG blobs

  captureAnimation(model, mixer, clip, config): Blob[]
    - config: { frames: 16, angles?: number[] }
    - For each frame:
      1. Set mixer.time = clip.duration * (i / frames)
      2. mixer.update(0) to apply pose
      3. renderer.render(scene, camera)
      4. canvas.toBlob() → collect
    - Returns array of PNG blobs

  captureMultiAngle(model, mixer, clip, config): Map<string, Blob[]>
    - config: { angles: [0, 45, 90, 135, 180, 225, 270, 315], animFrames: 8 }
    - For each angle:
      1. Set camera orbit position
      2. captureAnimation (or captureRotation if no anim)
    - Returns Map<angleName, Blob[]>
    - angleName: 'front', 'front-right', 'right', etc.

  dispose(): void
```

**Key decisions:**
- Offscreen only — never visible to user during capture
- Use `renderer.domElement.toBlob()` wrapped in Promise for async capture
- Model positioned at origin, camera orbits around it
- Transparent background so sprites can be placed on any game background

---

## Phase 2: Spritesheet Packer

**New file:** `apps/studio.vibexe.ai/app/(main)/app-builder/lib/spritesheet-packer.ts`

**Input:** Array of `{ name: string, blob: Blob, width: number, height: number }`
**Output:** `{ atlasBlob: Blob, metadata: SpritesheetJSON }`

**Algorithm: Simple row packing** (no external lib needed)
1. All frames same size (from capture) → trivial grid layout
2. Calculate grid: cols = Math.ceil(sqrt(frameCount)), rows = Math.ceil(frameCount/cols)
3. Atlas size = cols * frameWidth × rows * frameHeight
4. Create canvas at atlas size
5. Draw each frame blob at grid position
6. Generate PIXI.Spritesheet JSON:

```json
{
  "frames": {
    "roll_0000": { "frame": {"x":0,"y":0,"w":128,"h":128}, "sourceSize": {"w":128,"h":128}, "spriteSourceSize": {"x":0,"y":0,"w":128,"h":128} },
    "roll_0001": { "frame": {"x":128,"y":0,"w":128,"h":128}, ... }
  },
  "animations": {
    "roll": ["roll_0000", "roll_0001", ...],
    "idle": ["idle_0000", "idle_0001", ...]
  },
  "meta": {
    "image": "spritesheet.png",
    "size": {"w": atlasWidth, "h": atlasHeight},
    "format": "RGBA8888",
    "scale": "1"
  }
}
```

**Functions:**
```
packFrames(frames: CapturedFrame[], config): { atlasBlob, metadata }
  - config: { padding?: number, maxWidth?: number, prefix?: string }

packMultiAngle(angleMap: Map<string, CapturedFrame[]>, config): { atlasBlob, metadata }
  - Packs all angles + all animation frames into one atlas
  - Animation names: "walk_front", "walk_right", "idle_front", etc.

generateMetadata(layout, config): SpritesheetJSON
  - Pure function: frame positions → PIXI format JSON
```

---

## Phase 3: Capture Tool UI (Dialog)

**New file:** `apps/studio.vibexe.ai/app/(main)/app-builder/components/spritesheet-tool-dialog.tsx`

**Follows pattern from:** `capture-screenshot-dialog.tsx` (FormData upload, phased workflow)

**UI Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  3D → 2D Spritesheet Generator                    [X]   │
├───────────────────────┬──────────────────────────────────┤
│                       │  Model Source                    │
│                       │  [URL] [Upload] [Media Stock]    │
│   3D Preview          │  ┌──────────────────────────┐   │
│   (Three.js canvas    │  │ URL: https://...model.glb │   │
│    with OrbitControls │  └──────────────────────────┘   │
│    — user can orbit   │                                  │
│    to inspect model)  │  Settings                        │
│                       │  Frame Size: [64|128|256|512]    │
│                       │  Frame Count: [8|16|24|30]       │
│                       │  Rotation Axis: [X|Y|Z]         │
│                       │  Background: [transparent|solid] │
│                       │                                  │
│                       │  Animations (if model has):      │
│                       │  ☑ idle  ☑ walk  ☐ attack       │
│                       │                                  │
│                       │  Multi-Angle:                    │
├───────────────────────┤  ☐ Enable (4/8 directions)       │
│  Flipbook Preview     │  Angles: [4|8]                   │
│  (quick 8-frame       │                                  │
│   AnimatedSprite      │  [Preview Flipbook]              │
│   playback to         │  [Generate Spritesheet]          │
│   validate before     │                                  │
│   full generation)    │  Status: Ready / Capturing...    │
│                       │  Progress: ████████░░ 80%        │
└───────────────────────┴──────────────────────────────────┘
```

**Model Source Tabs:**
- **URL tab**: Text input for pasting any .glb/.gltf URL (meshy.ai, Sketchfab, etc.)
- **Upload tab**: Drag-drop zone or file browse button for local .glb files. Uploads to MinIO first, then loads into 3D preview.
- **Media Stock tab**: Grid browser of existing 3D model packs:
  - `kaykit-platformer` (766 files) — platforms, characters, props
  - `kaykit-city-builder` (89 files) — buildings, vehicles
  - `meshy-characters` — animated character GLBs
  - `platformer-project` — Lily.glb, Slime.glb
  - Each item shows thumbnail (reuse `useAssetThumbnail` hook from `asset-thumbnail-renderer.ts`)
  - Click to load into 3D preview

**States/Phases:**
1. `idle` — Model loaded, settings configured, waiting for user
2. `previewing` — Flipbook preview playing (quick 8-frame capture)
3. `capturing` — Full frame capture in progress (progress bar)
4. `packing` — Atlas generation
5. `uploading` — Upload to MinIO storage
6. `done` — Shows result: atlas preview, download links, "Use in Game" button

**Props:**
```typescript
interface SpritesheetToolDialogProps {
  appId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated?: (result: { atlasUrl: string, metadataUrl: string }) => void
}
```

**3D Preview Canvas:**
- Embedded Three.js canvas (NOT an iframe — direct renderer in dialog)
- OrbitControls for user to inspect model
- Model loaded from URL input or file upload
- User can orbit to choose preferred viewing angle

**Flipbook Preview:**
- After quick capture (8 frames), show animated preview
- Uses canvas cycling through frames at game speed
- User validates "this looks right" before full generation

**Generate Flow:**
1. Capture all frames (rotation + selected animations + multi-angle if enabled)
2. Pack into atlas
3. Upload atlas PNG + JSON to `/api/apps/{appId}/storage/spritesheets/{name}/`
4. Return URLs for immediate use

---

## Phase 4: Server Storage Endpoint

**New file:** `apps/studio.vibexe.ai/app/api/app-builder/spritesheets/route.ts`

**POST** — Upload generated spritesheet
```
Body (FormData):
  - atlas: File (PNG blob)
  - metadata: File (JSON blob)
  - name: string (e.g. "fighter-roll")
  - appId: string

Response:
  { atlasUrl, metadataUrl, name, frameCount, size }

Storage path:
  apps/{appId}/spritesheets/{name}/sheet.png
  apps/{appId}/spritesheets/{name}/sheet.json
```

**GET** — List available spritesheets for an app
```
Query: appId
Response: { sheets: [{ name, atlasUrl, metadataUrl, frameCount }] }
```

Uses existing `storage-manager.ts` `uploadFile()` function.

---

---

## Phase 5: Fix 2D Scene "Add Scene" (Part 2)

**Problem:** Scene CRUD (addScene, removeScene, etc.) works at the data level but the 2D runtime has no bridge to actually switch scenes. The scene panel shows scenes but clicking them does nothing in 2D.

**Files to modify:**
- `apps/studio.vibexe.ai/app/(main)/app-builder/lib/game-editor-context.tsx`
- `apps/studio.vibexe.ai/app/(main)/app-builder/components/game-editor-panel.tsx`

**Changes:**

1. **Add `is2DGame` flag to GameEditorContext** (derived from file existence check)
2. **In addScene()**: For 2D games, create scene with 2D-compatible defaults (no objects array needed — 2D scenes are code-defined in GameScene2D.ts)
3. **In switchScene()**: For 2D games, post `vibexe-2d-switch-scene` message to iframe instead of `game-editor-switch-scene`
4. **Scene panel UI**: Show scene type indicator — "2D Scene" vs "3D Mod Scene"
5. **Remove 3D-only UI for 2D scenes**: Hide scene hierarchy tree, gizmo controls, terrain panel when viewing a 2D scene

**SceneDefinition extension:**
```typescript
interface SceneDefinition {
  // ... existing fields ...
  type?: '2d' | '3d-mod'  // NEW — default '2d' for 2D games, '3d' for 3D games
}
```

---

## Phase 6: 3D Mod Scene Type in 2D Games (Part 2)

**Concept:** When user clicks "+" to add a scene in a 2D game, show a dropdown:
- "2D Scene" (default) — standard Pixi.js scene
- "3D Mod Scene" — opens a Three.js canvas for model viewing + spritesheet capture

**When 3D Mod Scene is active:**
- The preview area loads the 3D runtime (`/api/app-builder/game-runtime`) instead of the 2D runtime
- Scene panel shows model loading UI instead of sprite hierarchy
- Toolbar shows the "Generate Spritesheet" button prominently
- Clicking "Generate Spritesheet" opens the Phase 3 dialog pre-loaded with the scene's model

**Files to modify:**
- `apps/studio.vibexe.ai/app/(main)/app-builder/components/game-editor-panel.tsx` — Add scene type selector in "+" dropdown
- `apps/studio.vibexe.ai/app/(main)/app-builder/components/sandpack-preview.tsx` — Conditionally load 3D runtime for 3D-mod scenes
- `apps/studio.vibexe.ai/app/(main)/app-builder/lib/game-editor-context.tsx` — Scene type in data model

**3D Mod Scene panel content:**
```
┌─────────────────────────────┐
│ SCENE: Fighter Model  [3D] │
├─────────────────────────────┤
│ Model: fighter.glb    [📂]  │
│ Animations: idle, walk [▶]  │
│                             │
│ [Generate Spritesheet]      │
│ [Capture Single Frame]      │
│                             │
│ Generated Assets:           │
│  - fighter-roll.png         │
│  - fighter-idle.png         │
└─────────────────────────────┘
```

---

## Phase 7: Auto-Register Spritesheet in 2D Game (Part 2)

**After spritesheet is generated and stored, make it immediately usable:**

1. **Inject spritesheet loader into 2D game template** — Add to the boot sequence in `game-2d-engine.ts` ENGINE_CORE_CONTENT:
   ```
   engine.assets.loadSpritesheet(name, atlasUrl, metadataUrl)
   ```

2. **Register in AssetsSystem** — Add method to AssetsSystem:
   ```
   async loadSpritesheet(name: string, atlasUrl: string, jsonUrl: string): Promise<void>
     - Fetch JSON, load atlas texture
     - Parse with PIXI.Spritesheet
     - Store in _cache as name → spritesheet
     - Available via: engine.assets.animation(name, 'roll')
   ```

3. **Notify AI agent** — When spritesheet exists, include in system prompt:
   ```
   Available custom spritesheets:
   - "fighter" (animations: roll, idle, walk) — engine.assets.animation('fighter', 'roll')
   ```

4. **File injection** — When 2D game has generated spritesheets, inject a `src/config/spritesheets.ts` file listing all available sheets with URLs.

**Files to modify:**
- `packages/vibexe-engine/src/shared/game-2d-engine.ts` — Add `loadSpritesheet()` to AssetsSystem
- `packages/vibexe-engine/src/shared/game-2d-templates.ts` — Add spritesheet config template file
- `apps/studio.vibexe.ai/app/api/app-builder/chat/route.ts` — Include spritesheet info in AI prompt

---

## Critical Files Reference

| File | Role |
|------|------|
| `app/(main)/app-builder/lib/asset-thumbnail-renderer.ts` | **Reuse pattern**: offscreen Three.js render → canvas capture |
| `app/(main)/app-builder/components/capture-screenshot-dialog.tsx` | **Reuse pattern**: phased capture dialog + upload flow |
| `app/(main)/app-builder/lib/game-editor-context.tsx` | Scene CRUD, SceneDefinition type, bridge messaging |
| `app/(main)/app-builder/components/game-editor-panel.tsx` | Scene panel UI (lines 348-446) |
| `app/(main)/app-builder/components/sandpack-preview.tsx` | Scene/Game toggle, 2D detection (line 2344), runtime loading |
| `lib/app-storage/storage-manager.ts` | `uploadFile()`, `downloadFile()`, `listFiles()` |
| `app/api/apps/[appId]/storage/route.ts` | HTTP upload endpoint (FormData, magic byte validation) |
| `app/api/app-builder/game-runtime/route.ts` | 3D runtime HTML (Three.js r183 + GLTFLoader + OrbitControls) |
| `app/api/app-builder/game-runtime-2d/route.ts` | 2D runtime HTML (PixiJS 8.9.2) |
| `packages/vibexe-engine/src/shared/game-2d-engine.ts` | ENGINE_CORE_CONTENT, AssetsSystem, FeatureManager |

---

## Verification Plan

After EACH phase:

1. **Build check**: `pnpm build-sdk && pnpm --filter studio.vibexe.ai build` — must succeed
2. **Deploy**: Push + deploy to production server
3. **Functional test via browser**:
   - Phase 1-2: Unit test capture + packing in browser console
   - Phase 3: Open dialog, load a GLB model, generate spritesheet, verify atlas PNG + JSON
   - Phase 4: Verify API endpoint stores and retrieves spritesheets
   - Phase 5: In 2D game, click Scene tab → add scene → verify it appears in list
   - Phase 6: Add "3D Mod Scene" → verify 3D canvas loads with orbit controls
   - Phase 7: Generate spritesheet → create 2D game → verify AI can use the spritesheet

4. **If build fails**: Fix errors, rebuild, redeploy — repeat until clean
5. **If feature doesn't work in production**: Check PM2 logs, fix, redeploy — repeat until working
6. **Repeat verification cycle** until everything is fully operational — do not mark done until proven working

---

## Estimated Scope

- **New files**: 4 (capture engine, packer, dialog component, API route)
- **Modified files**: 6 (game-editor-context, game-editor-panel, sandpack-preview, game-2d-engine, game-2d-templates, chat route)
- **Total phases**: 7 across 2 parts
  - Part 1 (this session): Phase 1-4 — core capture pipeline
  - Part 2 (next session): Phase 5-7 — scene editor integration
