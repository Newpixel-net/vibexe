# Work Plan 3: Unity Gap-Closing

**Branch**: `fix/scene-editor-persist`
**Status**: IN PROGRESS
**Started**: 2026-03-09

## Goal
Close the most impactful feature gaps between Vibexe and Unity to elevate the
3D game builder from "prototype tool" to "production-ready game builder."

## Priority Order (Impact vs Effort)

---

### Phase 1: Larger Maps & Terrain LOD _(HIGH IMPACT, MEDIUM EFFORT)_
**Goal**: Support terrain up to 500x500 with configurable quality

- [ ] 1.1 Increase terrain segments option (128/256/512) in UI
- [ ] 1.2 Add terrain width/depth sliders (100-500 range)
- [ ] 1.3 Terrain mesh LOD — reduce geometry detail at distance
- [ ] 1.4 Update physics heightfield to match larger terrains
- [ ] 1.5 Performance guard — warn when segments > 256

**Files**: terrain-mesh.ts, terrain-painter-panel.tsx, terrain-physics.ts

---

### Phase 2: Multi-Scene / Level System _(CRITICAL GAP, HIGH EFFORT)_
**Goal**: Users can create multiple levels and switch between them

- [ ] 2.1 Scene definition type (SceneDef: name, objects[], terrain, settings)
- [ ] 2.2 SceneManager class (load, unload, switch, getCurrentScene)
- [ ] 2.3 Level list UI in game settings panel
- [ ] 2.4 Scene transition effects (fade/wipe)
- [ ] 2.5 Per-scene terrain & object persistence
- [ ] 2.6 Bridge handlers for scene switching messages
- [ ] 2.7 Template code: `game.loadScene("level2")` API

**Files**: game-editor-context.tsx, sandpack-preview.tsx, visual-edit-bridge.ts, game-3d-templates.ts

---

### Phase 3: Optimization Systems _(HIGH IMPACT, MEDIUM EFFORT)_
**Goal**: 2-5x performance improvement for complex scenes

- [ ] 3.1 Enable frustum culling on all game objects (currently disabled)
- [ ] 3.2 Object pooling system for collectibles/particles
- [ ] 3.3 Distance-based LOD for mesh objects (3 levels)
- [ ] 3.4 Instanced rendering for repeated objects (same model)
- [ ] 3.5 Texture atlas for terrain layers (reduce draw calls)
- [ ] 3.6 FPS-adaptive quality (auto-reduce pixelRatio if FPS drops)

**Files**: game-3d-templates.ts, visual-edit-bridge.ts

---

### Phase 4: Enhanced Game Export _(MEDIUM IMPACT, MEDIUM EFFORT)_
**Goal**: Export as PWA installable + better standalone builds

- [ ] 4.1 PWA manifest generation in export
- [ ] 4.2 Service worker for offline play
- [ ] 4.3 Add Capacitor config for iOS/Android wrapping
- [ ] 4.4 Optimized production build (tree-shaking, minification)
- [ ] 4.5 Asset preloading progress bar

**Files**: export-panel.tsx, export API route

---

### Phase 5: Editor Quality-of-Life _(MEDIUM IMPACT, MEDIUM EFFORT)_
**Goal**: Undo/redo, multi-select, prefabs

- [ ] 5.1 Undo/redo history stack (position, rotation, scale, delete)
- [ ] 5.2 Multi-select with Shift+Click
- [ ] 5.3 Group selected objects
- [ ] 5.4 Save/load prefabs (reusable object groups)
- [ ] 5.5 Duplicate selected object (Ctrl+D)

**Files**: game-editor-bridge.ts, sandpack-preview.tsx

---

### Phase 6: Advanced Lighting _(MEDIUM IMPACT, LOW EFFORT)_
**Goal**: Point lights, spot lights, shadow quality controls

- [ ] 6.1 Add point light creation in scene editor
- [ ] 6.2 Add spot light with cone angle
- [ ] 6.3 Shadow quality presets (Low/Med/High/Ultra)
- [ ] 6.4 Light color picker in inspector
- [ ] 6.5 Ambient light intensity slider

**Files**: game-3d-templates.ts, game-editor-bridge.ts, sandpack-preview.tsx

---

## Execution Order
Phase 1 → Phase 3 → Phase 6 → Phase 5 → Phase 2 → Phase 4

Rationale: Start with terrain expansion and optimization (immediate user value),
then lighting (visual quality), editor QoL (workflow), multi-scene (architecture),
and export (final polish).
