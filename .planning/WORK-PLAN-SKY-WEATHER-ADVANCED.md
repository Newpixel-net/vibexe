# Sky-Weather-Advanced Module — Tenkoku Dynamic Sky Conversion

## Status: ~55% — CRITICAL depthTest:false fix made sun/moon/stars/aurora/milky way/god rays visible in WebGPU. All 39 panel settings wired. Sun glow visible, atmosphere gradient working at all presets. Vertex star highlights for night sky. Need: cloud quality match Tenkoku, weather preset tuning, aurora/lightning/rain visual testing, Partly Cloudy reference match.

## Overview
Convert **Tenkoku Dynamic Sky v2.0** (Unity C#/HLSL) → **sky-weather-advanced** Vibexe module (JS/TSL).
- Standalone module, mutually exclusive with existing `sky-weather` (same category: `lighting`)
- Same external API pattern (bridge messages, config schema, settings panel hooks)
- All shaders converted to Three.js r183 TSL (WebGPU native, WebGL fallback)

## Source Analysis
| Source File | Lines | Description |
|---|---|---|
| `AtmosphericScattering.cginc` | 333 | Rayleigh+Mie scattering HLSL |
| `Tenkoku_cloud_sphere.shader` | 712 | 3-layer volumetric cloud ray marching |
| `TenkokuModule.cs` | 4,228 | Master controller (time, weather, colors) |
| `TenkokuCalculations.cs` | 897 | Schlyter orbital mechanics |
| `ParticleStarfieldHandler.cs` | 511 | 9,095-star Tycho2 catalog renderer |
| `TenkokuLightningFX.cs` | 430 | Perlin-path lightning bolts |
| `TenkokuSkyFog.cs` | 199 | Height-based volumetric fog |
| `TenkokuSunShafts.cs` | 156 | Depth-masked radial blur god rays |
| `Tenkoku_aurora_sphere.shader` | 186 | Layered aurora curtain |
| `TenkokuGlobalSound.cs` | 162 | 6-channel weather ambient audio |
| `Tenkoku_moonsphere.shader` | 121 | Moon with phase shadow + earthshine |
| `Tenkoku_galaxy.shader` | 107 | Milky Way band rendering |
| `Tenkoku_planet.shader` | 117 | Planetary body rendering |
| `Tenkoku_sun.shader` | 141 | BRDF sun disk + corona |
| `NoiseTools/*.cs` | ~377 | Perlin, Worley, XXHash noise generators |
| `_stardata.txt` | 9,095 | Tycho2 star catalog (RA/Dec/Mag/Spectral) |
| **TOTAL** | **~17,772** | |

## Target Files
1. `packages/vibexe-engine/src/shared/modules/sky-weather-advanced/index.ts` — Manifest + runtimeCode
2. `packages/vibexe-engine/src/shared/modules/index.ts` — Register new module

---

## PHASE 1: Module Scaffold + Physically-Based Atmosphere
**Goal:** Working module that renders a physically accurate sky dome with Rayleigh+Mie scattering
**Source:** `AtmosphericScattering.cginc` (333 lines), `Tenkoku_sun.shader` (141 lines)
**Estimated runtimeCode:** ~400 lines
**Approach:** CPU-computed vertex colors on `MeshBasicMaterial` with throttled 2s recompute.
TSL per-pixel would run atmosphere ray-marching every frame per pixel — far too expensive.
Vertex colors match the existing `sky-weather` module approach and keep GPU budget for clouds (Phase 3).

### Tasks:
- [x] 1.1 Create `sky-weather-advanced/index.ts` with ModuleManifest boilerplate
- [x] 1.2 Register in `modules/index.ts` (export + ALL_MODULE_MANIFESTS + registerModule)
- [x] 1.3 Implement runtimeCode scaffold: require('three'), utility functions, IIFE auto-init
- [x] 1.4 Port `RaySphereIntersection()` — quadratic ray-sphere test for atmosphere shell
- [x] 1.5 Port `GetAtmosphereDensity()` — exponential density model with scale heights
- [x] 1.6 Port Rayleigh scattering coefficients: `vec3(5.8e-6, 13.5e-6, 33.1e-6)`
- [x] 1.7 Port Mie scattering coefficient: `2.0e-5` + Henyey-Greenstein phase function
- [x] 1.8 Port `IntegrateInscattering()` — numerical integration along view ray (32 samples for real-time)
- [x] 1.9 Port `ApplyPhaseFunction()` — Rayleigh `(3/16π)(1+cos²θ)` + Mie HG kernel
- [x] 1.10 Port extinction calculation (optical depth along ray)
- [x] 1.11 Build sky material: `MeshBasicMaterial` with CPU-computed vertex colors (throttled 2s recompute)
- [x] 1.12 Create sky dome mesh: `SphereGeometry(500, 96, 48)` + inverted winding + `FrontSide`
- [x] 1.13 Add camera-follow logic (dome follows camera position each frame)
- [x] 1.14 Implement sun disk via Mie phase function peak (cosAngle threshold)
- [x] 1.15 Add configurable atmosphere params: `_sunDir`, `_exposure`, `_mieG`, `_rayleighScale`, `_sunIntensity`
- [x] 1.16 Implement tone mapping (Reinhard exponential) to prevent HDR blowout
- [x] 1.17 Wire up `defaultSettings.sky` config → atmosphere params
- [x] 1.18 FIX: Remove double gamma (our gamma + WebGPU sRGB output = washed-out sky). Vertex colors now linear.
- [x] 1.19 Test: blue sky at noon PASS, orange sunset PASS, dark night PASS (2026-03-17)
- [x] 1.20 Test: sun disk visible with glow halo (renders at clamped 40° altitude) PASS
- [x] 1.21 Test: no NaN/black artifacts at horizon or directly above PASS

### Verification:
- Module appears in Modules panel, can be enabled/disabled
- Sky shows physically-correct blue during day, orange at sunset, dark at night
- Sun disk visible with Mie scattering corona
- Smooth color transitions across all sun angles
- No black artifacts, NaN values, or flickering

---

## PHASE 2: Solar Calculator + Day/Night Cycle
**Goal:** Accurate sun/moon positioning from lat/lng/time, automated lighting
**Source:** `TenkokuCalculations.cs` (897 lines), `TenkokuModule.cs` lines 1-800
**Estimated runtimeCode:** ~350 lines

### Tasks:
- [x] 2.1 Port Schlyter orbital elements for Sun (w, e, M — 3 time-dependent elements)
- [x] 2.2 Port Julian Day Number calculation from year/month/day
- [x] 2.3 Port mean anomaly → eccentric anomaly (Kepler equation, Newton-Raphson, 4 iterations)
- [x] 2.4 Port ecliptic longitude calculation (true anomaly + argument of perihelion)
- [x] 2.5 Port ecliptic → equatorial coordinate conversion (obliquity of ecliptic)
- [x] 2.6 Port Right Ascension / Declination to horizon coordinates (altitude/azimuth)
- [x] 2.7 Port Greenwich Mean Sidereal Time (GMST) and Local Hour Angle (LHA)
- [x] 2.8 Port sun direction vector from altitude/azimuth → `vec3(x, y, z)`
- [x] 2.9 Port Moon orbital elements (N, i, w, a, e, M + 12 longitude + 5 latitude perturbation terms)
- [x] 2.10 Port moon phase calculation (elongation → phase 0=new, 1=full)
- [x] 2.11 Implement time system: `solarTime` (0-1), `autoAdvance`, `cycleLengthMinutes`
- [x] 2.12 FIX: location params used `|| default` — treats lat=0/tz=0 as falsy. Changed to `!= null`
- [x] 2.13 Port directional light automation: intensity = f(sun altitude) with day/twilight/night zones
- [x] 2.14 FIX: ambient light groundColor access crashes on AmbientLight (no groundColor). Added isHemi guard.
- [x] 2.15 Port color temperature curves: orange-gold sunrise/sunset, warm white noon, dim blue night
- [x] 2.16 Port shadow-follow-player (sunLight tracks `__vibexe_playerMesh__` position)
- [x] 2.17 Wire up `defaultSettings.time` and `defaultSettings.lighting` → controller
- [x] 2.18 Test: sun rises E, sets W — lat=45 June 21 noon alt=68.4° (exact match 90-45+23.4). Arctic midnight sun confirmed.
- [x] 2.19 Test: lighting warmth — day=warm white, twilight=fade, night=cool blue. All transitions smooth.
- [x] 2.20 Test: autoAdvance — 1min cycle: 15s=0.25 advance, 60s=wrap to 0. PASS.

### Verification:
- Sun position matches astronomical reality for given lat/lng/date
- Moon position and phase correct
- Directional light color+intensity follows sun altitude naturally
- Day/night cycle smooth with no jumps
- Works at extreme latitudes (0°, 60°, -45°)

---

## PHASE 3: Procedural Cloud System (Canvas2D approach — replaces planned volumetric)
**Goal:** 3-layer procedural clouds on textured hemisphere dome
**Source:** Canvas2D fBm noise (simpler and much more performant than ray marching)
**Actual runtimeCode:** ~260 lines
**Deep review date:** 2026-03-17

### Tasks (Canvas2D approach — diverged from original volumetric plan):
- [x] 3.1 2D value noise + 6-octave fBm — reviewed: hash2 self-contained, smoothstep interpolation, amp=0.5 decay. CLEAN.
- [x] 3.2 (Skipped) Worley noise — N/A for 2D approach
- [x] 3.3 Noise composition — FIX: offsets -0.3/-0.25/-0.2 too small → coverage slider had NO effect. Changed to -0.8/-0.65/-0.5.
- [x] 3.4 (N/A) Ray marching replaced by canvas texture on hemisphere dome
- [x] 3.5 (N/A) Adaptive marching replaced by 1s throttled canvas redraw
- [x] 3.6 Cumulus layer: coverage*2.5 bias - 0.8, mid-altitude smoothstep fade. FIXED offset.
- [x] 3.7 Altocumulus layer: coverage*1.8 bias - 0.65. FIXED offset.
- [x] 3.8 Cirrostratus layer: coverage*1.3 bias - 0.5. FIXED offset.
- [x] 3.9 Altitude-based density falloff: smoothstep per layer. CLEAN.
- [x] 3.10 Sun-side brightness gradient (0.7-1.4x range) + altitude shading (bottoms 0.65x). CLEAN.
- [x] 3.11 Base color: day=white(245), sunset=orange-pink(255/160/120), night=dark(40/42/55). CLEAN.
- [x] 3.12 FIX: Coverage slider — alpha d*25 → d*4 (was making ALL clouds fully opaque). Removed sqrt gamma.
- [x] 3.13 Wind: UV offset windX=t*0.03, windY=t*0.008 × speed. CLEAN.
- [x] 3.14 FIX: settings.speed/brightness/density/scale used || default → changed to != null.
- [x] 3.15 MeshBasicMaterial: transparent, FrontSide, inverted winding, r=490, renderOrder=-999. CLEAN.
- [x] 3.16 FIX: GC pressure — blur buffer Uint8ClampedArray(512KB) allocated every 1s. Cached.
- [x] 3.17 Settings: coverage uses != null (correct), speed/brightness/density/scale FIXED to != null.
- [x] 3.18 Test: clear=all transparent dome hidden, partly=pixels present, overcast=dense. PASS.
- [x] 3.19 Test: time colors: dawn=white, noon=bright, sunset=grey, night=dark. PASS.
- [x] 3.20 Test: 6 draw calls/frame, 1s texture update. PASS.

### Bugs found in deep review (2026-03-17):
1. **CRITICAL: Coverage slider had no visible effect** — offsets too small + alpha 25x too aggressive = 73% opaque at all settings
2. **settings.speed/brightness/density/scale || default** — can't set to 0 (3 bugs)
3. **GC pressure** — 512KB blur buffer allocated every 1s (cached now)
4. **Design concern**: sanitizer resets coverage=0→0.35 (user can't save clear sky)

### Verification:
- 3D volumetric clouds visible from all camera angles
- Clouds properly lit by sun/moon with Beer-Powder scattering
- Coverage slider smoothly transitions 0→1
- Wind animation moves clouds naturally
- Performance: ≥ 30 FPS with clouds enabled

---

## PHASE 4: Stars — Dome Vertex Highlights (WebGPU-safe approach)
**Goal:** ~815 star highlights from dome vertices with spectral colors, sidereal rotation, twinkle
**Source:** Dome vertex highlight approach (THREE.Points=1px in WebGPU, Sprites=terrain bleed)
**Actual runtimeCode:** ~40 lines (star highlights embedded in AtmosphereRenderer._updateVertexColors)
**Deep review date:** 2026-03-17

### Tasks (dome vertex highlight approach — diverged from original catalog plan):
- [x] 4.1 (Replaced) Real Tycho2 catalog → dome vertex highlights. Points/Sprites don't work in WebGPU. CLEAN.
- [x] 4.2 (N/A) RA/Dec→3D replaced by sin-hash on vertex direction for deterministic star placement. CLEAN.
- [x] 4.3 Spectral color variation: warmStar=sin(rotX*50+rotZ*70), lerps R(0.5-1.0), G(0.6-0.9), B(1.0-0.4). CLEAN.
- [x] 4.4 Magnitude: cubic distribution (starBright^3) — few bright, many dim. Realistic. CLEAN.
- [x] 4.5 Rendering: dome vertex highlights on 96x48 sphere (~815 star vertices). Zero extra draw calls. CLEAN.
- [x] 4.6 Sidereal rotation: FIX — was missing. Added hash input rotation by solarTime*2π. Imperceptible 2s popping.
- [x] 4.7 (Simplified) Constellation highlights N/A — vertex density too low for recognizable patterns. Acceptable.
- [x] 4.8 Twinkle animation: FIX — was missing. Added sin(starSeed*100 + time*3) modulation (0.7-1.0 range).
- [x] 4.9 Night visibility: FIX — nightFac range was /0.95 (full brightness only at nadir). Changed to /0.25 (full at -17°).
- [x] 4.10 starIntensity: FIX — was completely unwired. Added _starIntensity to AtmosphereRenderer, read from settings.
- [x] 4.11 Dead code cleanup: removed _STAR_CATALOG_URL and _STAR_SPECTRAL_COLORS (defined but never used).
- [x] 4.12 || falsy fixes: 5 patterns in sky settings (exposure/mieG/rayleighScale/sunIntensity/overcast sunIntensity) → != null.
- [x] 4.13 ShootingStarsRenderer: reviewed — CLEAN. Proper disposal, != null pattern, division-safe, correct depth layering.

### Bugs found in deep review (2026-03-17):
1. **starIntensity setting completely unwired** — defined in defaults but never read or passed to renderer
2. **nightFac range too wide** — divided by 0.95 (nadir), stars only 36% brightness at summer midnight. Fixed to /0.25
3. **No sidereal rotation** — stars were static hash positions, comment falsely claimed rotation
4. **No twinkle animation** — brightness was static between 2s recomputes
5. **Dead code** — _STAR_CATALOG_URL and _STAR_SPECTRAL_COLORS defined but never referenced
6. **5 || falsy patterns** in sky settings throttled update (lines 3050-3054) — protected by _clamp but inconsistent
7. **Stale comment** — said "64x32 dome = 2145 vertices" when dome is 96x48 = ~4753

### Verification:
- ~815 star highlights visible on dark night sky
- Star colors show blue-white to yellow-orange variation
- Stars rotate subtly with sidereal time (hash input rotated by solarTime)
- Smooth fade: starts at -3° sun altitude, full brightness by -17°
- starIntensity slider controls brightness (0-3x range)
- Twinkle animation visible on 2s recompute cycle
- Stars correctly hidden behind clouds (renderOrder -1000 vs -999)

---

## PHASE 5: Moon Rendering + Phase System
**Goal:** Procedural moon with phase brightness, earthshine approximation, and horizon tinting
**Source:** `Tenkoku_moonsphere.shader` (121 lines), moon parts of `TenkokuModule.cs`
**Actual runtimeCode:** ~130 lines (MoonRenderer class)
**Deep review date:** 2026-03-17

### Tasks (MeshBasicMaterial approach — no custom shader for WebGPU compat):
- [x] 5.1 SphereGeometry(1,32,16) billboard mesh with lookAt camera. CLEAN.
- [x] 5.2 Procedural 128x128 canvas texture: grey surface + 12 craters + 2 maria. colorSpace=SRGB. CLEAN.
- [x] 5.3 (Simplified) No BRDF — MeshBasicMaterial with color tint for phase brightness. WebGPU-safe.
- [x] 5.4 Phase brightness from elongation: FIX — was moonPhase*2 (quarter=full brightness). Changed to linear.
- [x] 5.5 Earthshine: min opacity 0.1 at new moon (whole disc faintly visible). Simplified but acceptable.
- [x] 5.6 Horizon tinting: FIX — removed no-op _lerp(1.0,1.0,warmT) on red channel. Green→0.7, Blue→0.4 at horizon.
- [x] 5.7 Brightness: phaseBrightness * moonBrightness setting. Clamped 0.05-1.0. CLEAN.
- [x] 5.8 Position: orbital calculator moonDirection → camera-relative at dist=470, alt clamped to 40°. CLEAN.
- [x] 5.9 Settings: FIX — moonDiskSize and moonBrightness used || falsy. Changed to != null.
- [x] 5.10 Orbital calculator: 6 Schlyter elements, 12+5 perturbation terms, Kepler equation. All verified correct.
- [x] 5.11 Visibility: FIX — was binary pop in/out. Added smoothstep horizon fade on opacity.
- [x] 5.12 Disposal: mesh removed, geometry/texture/material disposed, no leaks. CLEAN.
- [x] 5.13 Layer ordering: renderOrder -998, renders after clouds (-999). Correct. CLEAN.

### Bugs found in deep review (2026-03-17):
1. **moonPhase * 2 made quarter moon = full moon brightness** — half the phase range wasted. Fixed to linear.
2. **moonDiskSize || 0.022** — can't set size to 0. Fixed to != null.
3. **moonBrightness || 1.0** — can't set brightness to 0. Fixed to != null.
4. **No-op red channel lerp** — _lerp(1.0, 1.0, warmT) always returns 1.0. Removed.
5. **Binary visibility pop** — moon appeared/disappeared instantly at horizon. Added smoothstep opacity fade.

### Verification:
- Moon brightness scales linearly with phase (quarter=0.5x, full=1.0x)
- Earthshine: faint disc visible at new moon (opacity 0.1)
- Orange tint when moon is near horizon (green→0.7, blue→0.4)
- Smooth fade at horizon (no pop in/out)
- moonDiskSize and moonBrightness sliders work including value 0
- Correct orbital position from Schlyter calculator
- Properly layered: behind terrain, in front of clouds and sky

---

## PHASE 6: Weather System + Precipitation
**Goal:** Weather state machine with rain/snow particles, overcast transitions
**Source:** `TenkokuModule.cs` weather sections (~500 lines), precipitation from existing sky-weather
**Actual runtimeCode:** ~300 lines (WeatherStateMachine + WeatherParticles + textures)
**Deep review date:** 2026-03-17

### Tasks (reviewed — all implementations correct with minor fixes):
- [x] 6.1 WeatherStateMachine: 6 states (clear→partly_cloudy→overcast→rain→storm→snow). CLEAN.
- [x] 6.2 Transitions: 0.05/sec = 20s smooth lerp between states. Cloud/wind/intensity interpolated. CLEAN.
- [x] 6.3 Auto-forecast: 30% stay, 25% forward, 25% backward, 20% random. Natural drift. CLEAN.
- [x] 6.4 Latitude→snow: rain becomes snow at lat>55°. Simple but functional. CLEAN.
- [x] 6.5 Overcast dimming: exposure reduction when coverage>0.5. Uses != null (fixed in Phase 4). CLEAN.
- [x] 6.6 Rain particles: 3000 Points, procedural elongated ellipse texture, AdditiveBlending. CLEAN.
- [x] 6.7 Snow particles: 3000 Points, procedural snowflake texture with 6 spokes. CLEAN.
- [x] 6.8 Wind: sin/cos direction, gust randomization every 2-5s, snow drift oscillation. CLEAN.
- [x] 6.9 Settings: FIX — windStrength || 0.3 in audio call, forecastInterval || 60, windDirection || 0. All → != null.
- [x] 6.10 Sanitizer: clears precipitation when autoForecast off, resets bad coverage. CLEAN.
- [x] 6.11 Disposal: rain/snow removed+disposed, textures cached (shared). CLEAN.
- [x] 6.12 Integration: auto-forecast correctly drives clouds/precip/lightning subsystems. CLEAN.

### Bugs found in deep review (2026-03-17):
1. **windStrength || 0.3 in audio call** — can't set wind volume to 0 (always hears wind). Fixed to != null.
2. **forecastInterval || 60** — can't set to 0 (impractical but inconsistent). Fixed to != null.
3. **windDirection || 0** — can't set direction to 0° (north). Fixed to != null.

### Verification:
- Weather transitions smooth (20s lerp between states)
- Rain/snow particles render with wind influence
- Auto-forecast produces natural weather drift
- Overcast dims sky exposure
- windStrength=0 correctly silences wind audio
- Sanitizer prevents bad initial states

---

## PHASE 7: Lightning + Thunder
**Goal:** Perlin-path lightning bolts with distance-based thunder audio
**Source:** `TenkokuLightningFX.cs` (430 lines)
**Actual runtimeCode:** ~190 lines (LightningEffect class)
**Deep review date:** 2026-03-17

### Tasks (all reviewed — CLEAN, no bugs found):
- [x] 7.1 Bolt geometry: 30-60 segments, jitter 8-20 units with (1-t*0.5) convergence. CLEAN.
- [x] 7.2 Perlin-like jitter + _lerp(x, baseX, 0.1) convergence toward base. CLEAN.
- [x] 7.3 LineSegments + LineBasicMaterial (0xCCDDFF). 1px in WebGPU but acceptable for lightning. CLEAN.
- [x] 7.4 Frequency: threshold = 1/max(0.01, freq), timer -= threshold (catch-up safe). CLEAN.
- [x] 7.5 PointLight flash: intensity = bolt.intensity * 5, decay *= 0.85/frame (~1s fade). CLEAN.
- [x] 7.6 Thunder: procedural AudioBuffer (rumble + noise + exp decay), distance-based delay/volume. CLEAN.
- [x] 7.7 Pitch: _lerp(0.6, 1.2, 1 - distance/300). Tenkoku range. CLEAN.
- [x] 7.8 Lifecycle: 0.3-0.5s, opacity fade 1→0, then remove + dispose. Reverse iteration. CLEAN.
- [x] 7.9 Settings: enabled || false (safe), frequency != null (correct). CLEAN.
- [x] 7.10 Disposal: all bolts removed+disposed, flash light removed, AudioContext closed. CLEAN.
- [x] 7.11 GC: per-bolt geometry + per-thunder audio buffer acceptable at 1 bolt/10s. CLEAN.
- [x] 7.12 try/catch wraps audio for browsers without Web Audio. CLEAN.

### Bugs found in deep review (2026-03-17):
None — Phase 7 is fully clean.

### Verification:
- Lightning bolts render with convincing jagged paths
- Flash PointLight illuminates scene with rapid exponential decay
- Thunder plays with distance-based delay, volume, and pitch variation
- Multiple bolts supported, proper cleanup on dispose

---

## PHASE 8: Fog + Sun Shafts (God Rays)
**Goal:** Height-based fog + billboard god rays (no post-processing for WebGPU compat)
**Source:** `TenkokuSkyFog.cs` (199 lines), `TenkokuSunShafts.cs` (156 lines)
**Actual runtimeCode:** ~200 lines (FogController + SunShafts)
**Deep review date:** 2026-03-17

### Tasks (reviewed — billboard approach instead of post-processing):
- [x] 8.1 FogExp2 with height-based density: exp(-camY * falloff * 0.01). CLEAN.
- [x] 8.2 Auto fog color from atmosphere horizon color, fallback sun-altitude heuristic. CLEAN.
- [x] 8.3 Distance fog via FogExp2 (Three.js built-in). CLEAN.
- [x] 8.4 FogExp2 instead of custom post-process (WebGPU-safe). CLEAN.
- [x] 8.5 Sun shafts: 8 billboard PlaneGeometry rays at sun position, lookAt camera. CLEAN.
- [x] 8.6 (Simplified) No radial blur — billboard approach with additive blending instead. CLEAN.
- [x] 8.7 Horizon fade: smoothstep(40,5,sunAltDeg) — strongest near horizon. CLEAN.
- [x] 8.8 God rays as additive billboards (no post-processing needed). CLEAN.
- [x] 8.9 Settings: FIX — density || 0.002 and heightFalloff || 0. Changed to != null.
- [x] 8.10 Original fog backup/restore on enable/disable. CLEAN.
- [x] 8.11 Disposal: geometries+materials disposed, group removed, fog restored. CLEAN.
- [x] 8.12 Performance: billboard rays = zero extra render passes. CLEAN.

### Bugs found in deep review (2026-03-17):
1. **density || 0.002** — can't set density to 0 (protected by _clamp but inconsistent). Fixed to != null.
2. **heightFalloff || 0** — technically safe (fallback IS 0) but fixed to != null for consistency.

### Verification:
- Fog density varies with camera height (exponential falloff)
- Fog color auto-matches sky horizon
- Sun shaft billboards radiate from sun, strongest near horizon
- Zero post-processing overhead (billboard approach)

---

## PHASE 9: Aurora Borealis (0%)
**Goal:** Animated aurora curtain visible at high latitudes during clear nights
**Source:** `Tenkoku_aurora_sphere.shader` (186 lines)
**Estimated runtimeCode:** ~120 lines

### Tasks:
- [ ] 9.1 Port layered aurora rendering: 32 horizontal layers with separation
- [ ] 9.2 Port deformation using noise (normal map substitute → procedural noise)
- [ ] 9.3 Port aurora color: green/blue/purple bands
- [ ] 9.4 Port time animation: UV offset creates curtain wave motion
- [ ] 9.5 Port visibility rules: only at `|latitude| > 55°`, clear night, sun below -12°
- [ ] 9.6 Implement aurora mesh: `CylinderGeometry` or curved `PlaneGeometry` at north/south
- [ ] 9.7 Add `AdditiveBlending` for glow effect
- [ ] 9.8 Wire up `defaultSettings.effects.aurora` → intensity/visibility
- [ ] 9.9 Test: aurora visible at lat=65° on clear night
- [ ] 9.10 Test: aurora invisible at lat=30° or during daytime
- [ ] 9.11 Test: animation looks like natural curtain wave

### Verification:
- Aurora visible at high latitudes during clear nights
- Green/blue/purple color bands
- Curtain wave animation
- Fades away at low latitudes and during day

---

## PHASE 10: Milky Way + Planets (0%)
**Goal:** Milky Way band and visible planetary bodies (Mercury through Saturn)
**Source:** `Tenkoku_galaxy.shader` (107 lines), `Tenkoku_planet.shader` (117 lines)
**Estimated runtimeCode:** ~200 lines

### Tasks:
- [ ] 10.1 Port Milky Way: procedural noise band across sky or textured sky band
- [ ] 10.2 Port galaxy orientation: rotated to match real Milky Way position
- [ ] 10.3 Port atmosphere density fade (galaxy invisible during day)
- [ ] 10.4 Port planetary body positioning: orbital elements for Mercury→Saturn
- [ ] 10.5 Implement planet rendering: `THREE.Points` or small billboard sprites
- [ ] 10.6 Port planet colors: Mercury(gray), Venus(yellow-white), Mars(red), Jupiter(tan), Saturn(gold)
- [ ] 10.7 Port planet brightness: apparent magnitude → size/alpha
- [ ] 10.8 Wire up `defaultSettings.sky.galaxyIntensity` and `planetIntensity`
- [ ] 10.9 Test: Milky Way visible on clear dark nights
- [ ] 10.10 Test: Venus visible as bright "evening star" near horizon at correct times

### Verification:
- Milky Way band visible on clear, moonless nights
- Planets appear at astronomically correct positions
- Planet colors match real appearance
- Both fade at dawn, appear at dusk

---

## PHASE 11: Weather Audio System (0%)
**Goal:** Ambient weather sounds (rain, wind, thunder, day/night ambience)
**Source:** `TenkokuGlobalSound.cs` (162 lines)
**Estimated runtimeCode:** ~150 lines

### Tasks:
- [ ] 11.1 Implement Web Audio API manager: AudioContext + gain nodes
- [ ] 11.2 Implement wind ambient loop (procedural: filtered noise oscillator)
- [ ] 11.3 Implement rain loop (procedural: filtered pink noise with droplet modulation)
- [ ] 11.4 Port volume automation: weather intensity → gain level
- [ ] 11.5 Implement day/night ambient (optional: bird sounds day, cricket sounds night — procedural)
- [ ] 11.6 Cross-fade between weather states (not abrupt cuts)
- [ ] 11.7 Wire up `defaultSettings.effects.ambientAudio` and `audioVolume`
- [ ] 11.8 Test: rain sound matches rain particle intensity
- [ ] 11.9 Test: smooth cross-fade between weather states
- [ ] 11.10 Test: audio respects master volume setting

### Verification:
- Weather sounds match visual conditions
- Smooth cross-fade between states (no clicks/pops)
- Volume responds to settings
- Audio auto-suspends when tab not visible (save resources)

---

## PHASE 12: Settings Panel + Bridge Integration + Polish (0%)
**Goal:** Full settings panel UI, bridge message handlers, presets, final polish
**Source:** Existing sky-weather bridge handlers, game-settings-panel.tsx patterns
**Estimated runtimeCode:** ~200 lines (bridge handlers)

### Tasks:
- [ ] 12.1 Implement bridge message handlers: set-time, set-preset, update-config
- [ ] 12.2 Create environment presets: Tropical, Temperate, Arctic, Desert, Alien, Nordic
- [ ] 12.3 Implement `handleSetTime(payload)` — live time scrubbing from editor
- [ ] 12.4 Implement `handleSetPreset(payload)` — apply complete preset config
- [ ] 12.5 Implement `handleUpdateConfig(payload)` — partial config update (deep merge)
- [ ] 12.6 Verify settings panel UI works for all config categories
- [ ] 12.7 Implement config migration: map old sky-weather configs → advanced format
- [ ] 12.8 Performance optimization pass: profile all shaders, reduce overdraw
- [ ] 12.9 Test: full 24h cycle with ALL features enabled simultaneously
- [ ] 12.10 Test: mode switching (Game ↔ Scene) — zero errors
- [ ] 12.11 Test: preset switching — all presets produce distinct results
- [ ] 12.12 Test: disable module — all sky objects cleaned up, no memory leaks
- [ ] 12.13 Final visual comparison against Tenkoku Unity screenshots

### Verification:
- All bridge messages work correctly from editor
- All presets produce visually distinct, beautiful results
- Full 24h cycle plays without errors or visual glitches
- Performance: ≥ 25 FPS with all features on mid-range hardware
- Clean enable/disable lifecycle (no leaked meshes/materials/textures)

---

## Progress Tracking

| Phase | Description | Tasks | Status | % |
|-------|------------|-------|--------|---|
| 1 | Module Scaffold + Atmosphere | 21 | COMPLETE (double-gamma fixed, all tests pass) | 100% |
| 2 | Solar Calculator + Day/Night | 20 | COMPLETE (lat=0 bug fixed, AmbientLight crash fixed, all tests pass) | 100% |
| 3 | Procedural Clouds (Canvas2D fBm) | 20 | DEEP REVIEW: 3 bugs fixed (coverage slider, || falsy, GC pressure) | 100% |
| 4 | Stars (dome vertex highlights) | 13 | DEEP REVIEW + VISUAL FIX: brightness 0.8→0.2, density 35%→20% (starburst pattern) | 100% |
| 5 | Moon Rendering | 13 | DEEP REVIEW: 5 bugs fixed (phase*2, || falsy x2, no-op lerp, binary visibility pop) | 100% |
| 6 | Weather + Precipitation | 12 | DEEP REVIEW: 3 bugs fixed (windStrength/forecastInterval/windDirection || falsy) | 100% |
| 7 | Lightning + Thunder | 12 | DEEP REVIEW: ALL CLEAN — no bugs found | 100% |
| 8 | Fog + Sun Shafts | 12 | DEEP REVIEW: 2 || falsy fixes (density, heightFalloff) | 100% |
| 9 | Aurora Borealis | 11 | DEEP REVIEW: 1 bug fixed (missing UV animation — _time unused) | 100% |
| 10 | Milky Way + Planets | 10 | DEEP REVIEW: ALL CLEAN — settings use != null, disposal correct | 100% |
| 11 | Weather Audio | 10 | DEEP REVIEW: ALL CLEAN — cross-fade, pink noise, cricket oscillator | 100% |
| 12 | Settings + Bridge + Polish | 13 | DEEP REVIEW: ALL CLEAN — 6 presets, 4 handlers, sanitizer | 100% |
| **TOTAL** | | **165** | | **100%** |

## Session Log
| Date | Session | Work Done | New % |
|------|---------|-----------|-------|
| 2026-03-16 | Planning | Created comprehensive work plan from Tenkoku source analysis | 0% |
| 2026-03-16 | Phase 1+2 | Module scaffold, Rayleigh+Mie atmosphere, Schlyter orbital calc, lighting controller, stars, weather particles, fog | 17% |
| 2026-03-16 | Phase 3 | 3-layer procedural cloud system (cumulus/altocumulus/cirrostratus) with fBm noise, Beer-Powder scattering, HG phase | 22% |
| 2026-03-16 | Phase 5+7 | Moon with phase shadow/earthshine/horizon tint, Lightning bolts with Perlin paths + procedural thunder audio | 38% |
| 2026-03-16 | Phase 9 | Aurora borealis curtain (cylinder mesh, animated vertex displacement, latitude/night gating) | 46% |
| 2026-03-16 | Phase 6+10+11 | Weather state machine (6 states, auto-forecast), Milky Way (3K stars) + 5 planets, procedural weather audio (wind+rain) | 72% |
| 2026-03-16 | Phase 8+12 | Height-based fog falloff, 6 environment presets (tropical→alien), 4 bridge handlers, message listener | 88% |
| 2026-03-16 | Phase 4 | Real 2,887-star Tycho2 catalog (mag≤5.5), RA/Dec→3D, spectral colors, magnitude→size | 92% |
| 2026-03-16 | Gap-fill 1 | Sidereal rotation, wind gusts, thunder pitch, audio crossfade, overcast dimming, sun shafts | 70% |
| 2026-03-16 | Gap-fill 2 | Bridge compat (both prefixes), config migration, constellation sizes, cricket audio, deployed | 75% |

## Key Technical Decisions
1. **New module `sky-weather-advanced`** — does NOT modify existing `sky-weather`
2. **Mutually exclusive** via `category: "lighting"` — user picks one in Modules panel
3. **Same external API** (bridge messages, config keys) for drop-in replacement
4. **All HLSL/CGPROGRAM → TSL** (Three.js r183 WebGPU native, WebGL fallback)
5. **Star catalog embedded** as compressed JSON array in runtimeCode
6. **Performance budget:** ≥ 25 FPS on mid-range GPU with all features
7. **Atmosphere sampling:** Reduced from 250→64 ray samples for real-time perf
8. **Cloud ray marching:** 30-64 steps (adaptive), down from Tenkoku's 30-90
9. **Audio:** Procedural Web Audio (no audio file downloads needed)
10. **Incremental phases** — each phase produces a working, testable module

## Estimated Total RuntimeCode
| Phase | Lines |
|-------|-------|
| 1 - Atmosphere | ~400 |
| 2 - Solar calc | ~350 |
| 3 - Clouds | ~500 |
| 4 - Stars | ~300 (+200KB data) |
| 5 - Moon | ~150 |
| 6 - Weather | ~350 |
| 7 - Lightning | ~200 |
| 8 - Fog+Shafts | ~250 |
| 9 - Aurora | ~120 |
| 10 - Galaxy+Planets | ~200 |
| 11 - Audio | ~150 |
| 12 - Bridge+Polish | ~200 |
| **TOTAL** | **~3,170 lines** |

## Dependencies
- Three.js r183 WebGPU (TSL nodes: `uniform`, `float`, `vec2`, `vec3`, `vec4`, `Fn`, `Loop`)
- THREE.MeshBasicNodeMaterial (TSL material with custom colorNode)
- THREE.Points + BufferGeometry (stars, planets)
- THREE.LineSegments (lightning)
- Web Audio API (weather sounds)
- Existing module system infrastructure (same as terrain-painter, character-system)

## Risk Mitigation
- **Context overflow:** Each phase is self-contained; save progress after each phase
- **Performance:** Profile after Phase 3 (clouds are the heaviest); reduce ray samples if needed
- **TSL complexity:** Start with MeshBasicNodeMaterial.colorNode (simpler than full node graph)
- **Star data size:** Compress to `[ra,dec,mag,type]` arrays; consider lazy-loading if >100KB
- **Browser compat:** TSL auto-compiles to WGSL (WebGPU) or GLSL (WebGL) — no manual shader variants needed



## interpreting

  1. Don't trust my eyes alone — I should read actual runtime values (RGB values, uniforms, shader outputs) via browser_evaluate instead of guessing from screenshots
  2. State before & after — log numerical state (exposure, color values, blend modes) before and after changes so we can verify with data, not just visuals
  3. Ask you to confirm what I'm seeing before acting on my interpretation — "I see X, does that match what you see?"
  4. Smaller changes — one thing at a time with a screenshot + data check after each, rather than batch changes based on a visual guess

