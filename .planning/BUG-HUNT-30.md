# Vibexe Bug Hunt: 30 Critical Bugs & Security Holes

**Date:** 2026-03-20
**Context:** FPS crashed from 90+ to 3. Seven expert agents audited the entire codebase.
**Root Cause:** Module lifecycle design flaw — every recompile stacks new RAF loops, setIntervals, and event listeners on top of never-cleaned-up old ones.

---

## PERFORMANCE BUGS (1-20)

### BUG 1 — [CRITICAL] SWA: Duplicate requestAnimationFrame Creates Exponential Callback Stacking
- **File:** `packages/vibexe-engine/src/shared/modules/sky-weather-advanced/index.ts`
- **Lines:** 4320-4335
- **Problem:** `_startLoop()` schedules RAF both inside the loop closure (line 4324) AND before starting (line 4335). Each frame schedules 2 callbacks instead of 1. After N frames = 2^N pending callbacks.
- **Impact:** Single biggest FPS killer. Exponential CPU consumption within seconds.
- **Fix:** Remove the duplicate RAF call at line 4324. Keep only line 4335.

### BUG 2 — [CRITICAL] Water: 3 Independent requestAnimationFrame Loops (One Per Body)
- **File:** `packages/vibexe-engine/src/shared/modules/stylized-water/index.ts`
- **Lines:** 1034-1035, 1238
- **Problem:** Each water body creates its own RAF loop in its constructor. With 3 bodies = 3 competing animation loops fighting the main game loop.
- **Impact:** 3x frame scheduling overhead, GPU contention, timing chaos.
- **Fix:** Replace per-body RAF with a single shared WaterManager loop that updates all bodies.

### BUG 3 — [CRITICAL] All Modules: Stacking setInterval on Every Recompile
- **Files:**
  - `sky-weather-advanced/index.ts` lines 4850-4904 (100ms polling)
  - `stylized-water/index.ts` lines 2024-2114 (100ms polling)
  - `character-system/index.ts` lines 3617-3704 (100ms polling)
- **Problem:** Every bundle recompile injects module code fresh. Each injection creates a new setInterval. Old intervals are NOT reliably cleared — cleanup checks `window.__xxx_autoInitInterval` but race conditions allow stacking.
- **Impact:** After 10 reloads = 30+ active 100ms timers = 300+ callbacks/sec of orbital math, water sim, character state.
- **Fix:** Always clear previous interval BEFORE creating new one. Use a global guard flag.

### BUG 4 — [CRITICAL] All Modules: Event Listeners Never Removed on Reinit
- **Files:**
  - `sky-weather-advanced/index.ts` lines 4888-4895
  - `stylized-water/index.ts` lines 2097-2106
- **Problem:** `window.addEventListener('message', ...)` called in IIFE on every module injection. Never removed. Each reload adds another handler.
- **Impact:** After 10 reloads, every postMessage fires 10+ handlers. Cascading duplicate updates.
- **Fix:** Store listener ref, removeEventListener in destroy(). Check for existing listener before adding.

### BUG 5 — [CRITICAL] SWA: Cloud Texture Procedural Noise Every 3 Seconds
- **File:** `sky-weather-advanced/index.ts`
- **Lines:** 2283-2478 (updateTexture), 4436-4441 (call site)
- **Problem:** Cloud texture regenerated via double-nested loop with domain warping, 4x fBm layers, Worley noise, blur pass, then `putImageData()` (GPU stall). At 512x512 = 26M operations every 3s.
- **Impact:** 80-150ms CPU spike every 3 seconds. Combined with bug #1 (stacked RAF), fires every frame.
- **Fix:** Only regenerate when cloud settings actually change. Cache the texture. Move noise to GPU shader.

### BUG 6 — [CRITICAL] Terrain: Texture Memory Leak — No Dispose Before Reload
- **File:** `apps/studio.vibexe.ai/app/(main)/app-builder/lib/visual-edit-bridge.ts`
- **Lines:** 6092-6218
- **Problem:** 16 textures loaded per repaint (4 layers x 4 types). Old textures at `_rpTextures[idx]` are overwritten WITHOUT calling `.dispose()` first. Each texture = 2-4MB GPU VRAM.
- **Impact:** 32-64MB leaked per repaint. After 10 repaints = 320-640MB, GPU swaps to system RAM.
- **Fix:** Add `if (_rpTextures[idx]) _rpTextures[idx].dispose();` before every texture assignment.

### BUG 7 — [HIGH] Terrain: Double Repaint on Initialization
- **File:** `visual-edit-bridge.ts` lines 5287-6282
- **Problem:** "REPAINT CASE HIT" fires twice during init. Second repaint loads all 16 textures again (without disposing the first set), then hits "No textures + all default gray — preserving existing material" fallback.
- **Impact:** 32 texture loads instead of 16. Double GPU upload. Wasted 2-4 seconds.
- **Fix:** Add guard to prevent re-triggering repaint while one is in progress.

### BUG 8 — [HIGH] Water: 18 Texture Load Requests on Init (6 Per Body x 3 Bodies)
- **File:** `stylized-water/index.ts` lines 1148-1171, 961-976
- **Problem:** Each body calls `_loadTexture()` 6 times. Each call creates a NEW `THREE.TextureLoader()`. With 3 bodies = 18 HTTP requests + 18 loader instances. Textures not shared across bodies.
- **Impact:** Network congestion, duplicate GPU memory (same texture uploaded 3x).
- **Fix:** Global texture cache keyed by URL. Load each unique texture once, share across bodies.

### BUG 9 — [HIGH] Water: Material Recompilation on Every Config Update
- **File:** `stylized-water/index.ts` lines 1522-1692
- **Problem:** `updateSettings()` → `_rebuildGeometry()` disposes material and creates brand new TSL material. If config updates come rapidly (slider drag, preset switch), GPU shader recompiles per frame.
- **Impact:** Each TSL compilation = 50-200ms GPU stall. Death spiral with slider interactions.
- **Fix:** Debounce `_rebuildGeometry()`. Batch config updates. Only rebuild on geometry-affecting changes.

### BUG 10 — [HIGH] Water: 3 Underwater Overlays Attached to Camera
- **File:** `stylized-water/index.ts` lines 1270-1303
- **Problem:** Each water body creates its own underwater overlay quad with `renderOrder = 999`. All 3 attached to camera simultaneously.
- **Impact:** 3 fullscreen quads rendered at highest priority. Only 1 should ever be active.
- **Fix:** Singleton underwater overlay managed by WaterManager. Only the nearest body's overlay activates.

### BUG 11 — [HIGH] Character: GLB Model Never Disposed on Swap
- **File:** `character-system/index.ts` lines 534-797
- **Problem:** Loading new character creates new GLTFLoader, AnimationMixer, and skinned meshes. Old character's textures, materials, geometry, and temp mixer are never disposed.
- **Impact:** 10-25MB leaked per character swap. Multiple swaps = hundreds of MB.
- **Fix:** Dispose old character's scene graph, materials, textures, and mixers before loading new one.

### BUG 12 — [HIGH] SWA: Sky Vertex Colors Recomputed Every 2 Seconds
- **File:** `sky-weather-advanced/index.ts` lines 681-712, 4369-4412
- **Problem:** `_updateVertexColors()` loops over ~24K vertices with 10+ trig calls each, then sets `needsUpdate = true` triggering full geometry recompile in WebGPU.
- **Impact:** 240K trig operations + GPU geometry reupload every 2 seconds. With stacked RAF, fires every frame.
- **Fix:** Increase update interval. Move sky coloring to GPU shader (TSL colorNode). Avoid vertex color approach.

### BUG 13 — [HIGH] SWA: Moon Canvas GPU Stalls (getImageData + putImageData)
- **File:** `sky-weather-advanced/index.ts` lines 2555-2566, 2635, 2738-2802
- **Problem:** Moon texture uses `getImageData` (GPU→CPU stall) and `putImageData` (CPU→GPU stall) for phase rendering. Double GPU sync on every phase change.
- **Impact:** 5-20ms GPU stall per update. Blocks entire render pipeline.
- **Fix:** Pre-render all 20 moon phases at init. Swap textures instead of re-rendering.

### BUG 14 — [HIGH] PostFX: 4 Always-On Passes Stacked by Default
- **Files:** `game-runtime/route.ts` lines 411-438, `compiler.ts` lines 818-830
- **Problem:** Bloom + FXAA + Vignette + Saturation all enabled by default since commits 7b8dc4e33 and 9b135b41b. Every game pays the GPU cost even if not needed.
- **Impact:** ~15-25% GPU overhead on every frame for effects the user may not want.
- **Fix:** Make PostFX opt-in per preset. Default to bloom-only or none. Let user enable individually.

### BUG 15 — [HIGH] Water: Refraction Settings Still in Presets After Code Removal
- **File:** `stylized-water/index.ts` (PRESETS object)
- **Problem:** Commits removed refraction shader code but left `refractionEnabled: true` in 6 presets (ocean, tropical, river, mediterranean, realistic, clear-pool). Settings are persisted to game files. If code is ever re-added, all saved games re-enable the 28-FPS-killing feature.
- **Impact:** Ticking time bomb. Also confusing for settings UI.
- **Fix:** Remove all `refractionEnabled`, `refractionStrength`, `refractionThickness` from presets.

### BUG 16 — [MEDIUM] Water: Buoyancy Iterates ALL Rigid Bodies 3x Per Frame
- **File:** `stylized-water/index.ts` lines 1232-1235, 1419-1456
- **Problem:** Each water body's animation loop runs buoyancy every 3rd frame. Each call iterates ALL Rapier rigid bodies via `forEachRigidBody()`. With 3 bodies = 3 full iterations.
- **Impact:** O(3N) per frame where N = total rigid bodies. Scales badly.
- **Fix:** Single buoyancy pass in WaterManager that checks all bodies at once.

### BUG 17 — [MEDIUM] SWA: Precipitation Instance Matrix Upload Every Frame
- **File:** `sky-weather-advanced/index.ts` lines 1173, 1205, 1237, 1381, 1415
- **Problem:** Rain/snow particles set `instanceMatrix.needsUpdate = true` every frame. For 5000 particles = 320KB GPU upload per frame = 19.2MB/sec at 60 FPS.
- **Impact:** Constant GPU bus pressure during weather effects.
- **Fix:** Only set needsUpdate when particles actually moved (they always do, but could batch updates).

### BUG 18 — [MEDIUM] Terrain: Missing Roughness & AO Texture Disposal
- **File:** `terrain-painter/runtime/terrain-painter.ts` lines 263-271
- **Problem:** `dispose()` cleans up diffuse and normal textures but NOT roughness or AO textures from the visual-edit-bridge repaint cycle.
- **Impact:** Roughness + AO textures (8 total) leak on every terrain disposal.
- **Fix:** Track and dispose all texture types in dispose().

### BUG 19 — [MEDIUM] Console.log in Hot Paths
- **File:** `compiler.ts` lines 929, 943, 1015, 1089
- **Problem:** PerfGuard logs FPS every 2s via `console.log`. In WebGPU, console operations flush the GPU pipeline.
- **Impact:** 1-3ms stall every 2 seconds. Small but adds up.
- **Fix:** Gate behind `__VIBEXE_DEBUG__` flag or remove entirely.

### BUG 20 — [MEDIUM] 4K Skybox Textures Doubled VRAM Usage
- **File:** `media-stock/games-3d/skybox-themes/*.webp`
- **Problem:** Commit 35674abe7 upgraded skybox from 2048x1024 JPEG to 4096x2048 WebP. 4x pixel count.
- **Impact:** Each skybox now consumes ~32MB GPU VRAM instead of ~8MB. Under VRAM pressure, this tips the balance.
- **Fix:** Use 2048x1024 as default, offer 4K as quality option. Or generate mipmaps and let GPU manage LOD.

---

## SECURITY BUGS (21-30)

### BUG 21 — [CRITICAL] MCP Endpoint: Zero Authentication
- **File:** `apps/studio.vibexe.ai/app/api/mcp/[workspaceId]/route.ts:25`
- **Problem:** `POST /api/mcp/[workspaceId]` has no auth. Anyone who guesses a workspace ID can execute workflows, trigger AI generations, send emails via integrations.
- **Fix:** Require workspace API key or session auth. Validate caller has workspace access.

### BUG 22 — [CRITICAL] SQL Injection via `onDelete` in Schema Executor
- **File:** `apps/studio.vibexe.ai/lib/app-database/schema-executor.ts:227-228`
- **Problem:** `onDelete` field from user-controlled JSON interpolated directly into DDL: `ON DELETE ${onDelete}`. Attacker can inject `CASCADE; DROP TABLE _app_users; --`.
- **Fix:** Validate against allowlist: `["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"]`.

### BUG 23 — [CRITICAL] User Functions: Unrestricted Raw SQL Access
- **File:** `apps/studio.vibexe.ai/lib/app-functions/context.ts:165-166`
- **Problem:** `db.query(sql)` passes user SQL to database with full privileges. Can DROP tables, read `pg_shadow`, ALTER schemas.
- **Fix:** Use restricted PostgreSQL role for function execution. Block DDL statement types.

### BUG 24 — [HIGH] Chat & Form Endpoints: No Rate Limiting (Credit Exhaustion)
- **Files:** `app/api/chat/[workspaceId]/route.ts:22`, `app/api/form/[workspaceId]/route.ts:84`
- **Problem:** No rate limiting on endpoints that trigger expensive AI generations. Attacker can exhaust API credits.
- **Fix:** Add `checkRateLimit()` per workspace+IP. 10 requests/minute.

### BUG 25 — [HIGH] CORS Wildcard on Cookie-Authenticated Endpoints
- **Files:** `next.config.ts:209-213`, `app/api/mcp/[workspaceId]/route.ts:288`
- **Problem:** `Access-Control-Allow-Origin: *` on endpoints that also accept session cookies. Malicious site can make cross-origin requests carrying the builder's cookie.
- **Fix:** Check Origin against allowlist for cookie-auth endpoints. Use `*` only for token-auth-only endpoints.

### BUG 26 — [HIGH] Hardcoded Admin Email Fallback in Source Code
- **File:** `apps/studio.vibexe.ai/lib/admin-guard.ts:3-4`
- **Problem:** `process.env.ADMIN_EMAIL ?? "newpixel.net1@gmail.com"` — if env var not set, anyone registering with that email becomes admin.
- **Fix:** Remove fallback. Require ADMIN_EMAIL env var. Throw if not set.

### BUG 27 — [HIGH] vm.Script Sandbox Is Not a Security Boundary
- **File:** `apps/studio.vibexe.ai/lib/app-functions/runner.ts:140-201`
- **Problem:** Uses `node:vm` which Node.js docs explicitly say is NOT a security sandbox. Shared prototypes with host. Regular escape techniques discovered.
- **Fix:** Use `isolated-vm` or subprocess-based sandboxing for defense in depth.

### BUG 28 — [MEDIUM] Missing Content-Security-Policy Header
- **File:** `apps/studio.vibexe.ai/next.config.ts:141-236`
- **Problem:** Main app has X-Frame-Options etc. but no CSP. CSP is the strongest XSS defense.
- **Fix:** Add baseline CSP: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...`

### BUG 29 — [MEDIUM] Webhook Intake: No Rate Limiting
- **File:** `apps/studio.vibexe.ai/app/api/webhooks/[path]/route.ts:61`
- **Problem:** Each webhook hit triggers workflow execution. No rate limit. Attacker can flood to exhaust resources.
- **Fix:** Rate limit per webhook path + source IP.

### BUG 30 — [MEDIUM] In-Memory Rate Limiter Resets on PM2 Restart
- **File:** `apps/studio.vibexe.ai/lib/rate-limiter.ts`
- **Problem:** Rate limiter uses `Map` in memory. PM2 restart = all limits cleared. Attacker can time brute-force to deployments. Cluster mode = each worker has separate limits.
- **Fix:** Use PostgreSQL-backed rate limiting (already exists in `app/api/_lib/rate-limit.ts`). Apply to auth endpoints.

---

## PRIORITY EXECUTION ORDER

### Phase 1: Stop the Bleeding (FPS from 3 to 60+)
1. BUG 1 — Remove duplicate RAF in SWA
2. BUG 2 — Single shared water animation loop
3. BUG 3 — Fix setInterval stacking in all 3 modules
4. BUG 4 — Fix event listener stacking in all modules
5. BUG 6 — Add texture dispose before reload

### Phase 2: Stabilize at 90+ FPS
6. BUG 5 — Cache cloud texture, only regen on change
7. BUG 7 — Prevent double terrain repaint
8. BUG 8 — Global texture cache for water
9. BUG 9 — Debounce water material rebuild
10. BUG 11 — Dispose old character on swap

### Phase 3: Optimize
11. BUG 12 — Move sky coloring to GPU
12. BUG 13 — Pre-render moon phases
13. BUG 14 — Make PostFX opt-in
14. BUG 15 — Clean up refraction preset settings
15-20. Remaining medium bugs

### Phase 4: Security Hardening
21-30. All security bugs in priority order
