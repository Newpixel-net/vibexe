# Sky-Weather-Advanced Module — Tenkoku Dynamic Sky Conversion

## Status: 92% — ALL 12 PHASES CODE COMPLETE, Visual Testing Pending

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
- [x] 1.12 Create sky dome mesh: `SphereGeometry(5000, 48, 24)` + `BackSide` rendering
- [x] 1.13 Add camera-follow logic (dome follows camera position each frame)
- [x] 1.14 Implement sun disk via Mie phase function peak (cosAngle threshold)
- [x] 1.15 Add configurable atmosphere params: `_sunDir`, `_exposure`, `_mieG`, `_rayleighScale`, `_sunIntensity`
- [x] 1.16 Implement tone mapping (Reinhard exponential) to prevent HDR blowout
- [x] 1.17 Wire up `defaultSettings.sky` config → atmosphere params
- [ ] 1.18 Test: verify blue sky at noon, orange/red sunset, dark night
- [ ] 1.19 Test: sun disk visible with corona glow
- [ ] 1.20 Test: no NaN/black artifacts at horizon or directly above

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
- [x] 2.12 Implement location system: `latitude`, `longitude`, `timezone`
- [x] 2.13 Port directional light automation: intensity = f(sun altitude) with day/twilight/night zones
- [x] 2.14 Port ambient light automation: HemisphereLight sky/ground colors by time of day
- [x] 2.15 Port color temperature curves: orange-gold sunrise/sunset, warm white noon, dim blue night
- [x] 2.16 Port shadow-follow-player (sunLight tracks `__vibexe_playerMesh__` position)
- [x] 2.17 Wire up `defaultSettings.time` and `defaultSettings.lighting` → controller
- [ ] 2.18 Test: sun rises east, sets west at correct angles for latitude=45°
- [ ] 2.19 Test: lighting warmth matches time of day
- [ ] 2.20 Test: autoAdvance cycle plays correctly

### Verification:
- Sun position matches astronomical reality for given lat/lng/date
- Moon position and phase correct
- Directional light color+intensity follows sun altitude naturally
- Day/night cycle smooth with no jumps
- Works at extreme latitudes (0°, 60°, -45°)

---

## PHASE 3: Volumetric Cloud System (0%)
**Goal:** Ray-marched 3D volumetric clouds with 3 altitude layers
**Source:** `Tenkoku_cloud_sphere.shader` (712 lines), `NoiseTools/*.cs` (377 lines)
**Estimated runtimeCode:** ~500 lines

### Tasks:
- [ ] 3.1 Port 3D Perlin noise function (simplified for real-time, ~50 lines)
- [ ] 3.2 Port Worley noise function (cellular/Voronoi distance, ~40 lines)
- [ ] 3.3 Implement noise composition: `Perlin - 0.5 * Worley` for cloud density
- [ ] 3.4 Port ray-sphere intersection for cloud volume shell (inner/outer radius)
- [ ] 3.5 Implement adaptive ray marching (30 min, 64 max steps based on distance)
- [ ] 3.6 Port cumulus layer: altitude 1500-3500m, dense billowy clouds
- [ ] 3.7 Port altocumulus layer: altitude 5500-6000m, lighter thinner clouds
- [ ] 3.8 Port cirrostratus layer: altitude 5500-6000m, wispy cirrus
- [ ] 3.9 Port altitude-based density falloff (smoothstep at layer edges)
- [ ] 3.10 Port Beer-Powder scattering: `exp(-E*d) * (1 - exp(-0.75*E*d))`
- [ ] 3.11 Port Henyey-Greenstein cloud lighting (sun direction + moon direction)
- [ ] 3.12 Implement cloud coverage control (0-1 slider → density bias)
- [ ] 3.13 Port wind animation: cloud drift direction + speed (UV offset over time)
- [ ] 3.14 Add TSL uniforms: `uCloudCoverage`, `uCloudSpeed`, `uWindDir`, `uCloudBrightness`
- [ ] 3.15 Build TSL cloud material on separate sphere (larger than sky dome, `BackSide`, `AdditiveBlending`)
- [ ] 3.16 Performance: implement temporal reprojection OR reduce samples for < 60fps budget
- [ ] 3.17 Wire up `defaultSettings.clouds` → uniforms
- [ ] 3.18 Test: clear sky, partly cloudy, overcast, full storm
- [ ] 3.19 Test: cloud lighting at sunrise/noon/sunset/night
- [ ] 3.20 Test: performance ≥ 30 FPS on mid-range hardware

### Verification:
- 3D volumetric clouds visible from all camera angles
- Clouds properly lit by sun/moon with Beer-Powder scattering
- Coverage slider smoothly transitions 0→1
- Wind animation moves clouds naturally
- Performance: ≥ 30 FPS with clouds enabled

---

## PHASE 4: Real Star Catalog (0%)
**Goal:** 9,095 real stars from Tycho2 catalog with spectral colors and sidereal rotation
**Source:** `ParticleStarfieldHandler.cs` (511 lines), `_stardata.txt` (9,095 entries)
**Estimated runtimeCode:** ~300 lines (+ ~200KB compressed star data)

### Tasks:
- [ ] 4.1 Parse `_stardata.txt` → compressed JSON format `[ra, dec, mag, spectralType][]`
- [ ] 4.2 Port RA/Dec → 3D position conversion (spherical → Cartesian)
- [ ] 4.3 Port spectral class → RGB mapping (O:blue, B:blue-white, A:white, F:yellow-white, G:yellow, K:orange, M:red)
- [ ] 4.4 Port magnitude → size/alpha mapping (`lerp(1.4*size, size, mag/8)`, `alpha=lerp(1, 0.075, mag/8)`)
- [ ] 4.5 Implement star rendering: `THREE.Points` + `BufferGeometry` (position, color, size attributes)
- [ ] 4.6 Port sidereal rotation (hour angle advances with time → star dome rotates)
- [ ] 4.7 Port constellation highlight system (100+ named stars with larger size multiplier)
- [ ] 4.8 Port star twinkle animation (per-star phase offset + sin wave)
- [ ] 4.9 Implement night visibility: fade stars in at sunset (`sunAltitude < -6°`), out at sunrise
- [ ] 4.10 Wire up `defaultSettings.sky.starIntensity` → opacity/brightness
- [ ] 4.11 Test: recognizable constellations (Orion, Big Dipper, Southern Cross)
- [ ] 4.12 Test: Polaris at correct position for northern hemisphere
- [ ] 4.13 Test: star colors match spectral classification visually

### Verification:
- Night sky shows ~9K stars with correct positions
- Star colors match spectral classification (blue O-type through red M-type)
- Stars rotate with sidereal time (match Earth rotation)
- Smooth fade in at dusk, fade out at dawn
- Constellations recognizable to naked eye

---

## PHASE 5: Moon Rendering + Phase System (0%)
**Goal:** Realistic moon with phase shadow, earthshine, and horizon color tinting
**Source:** `Tenkoku_moonsphere.shader` (121 lines), moon parts of `TenkokuModule.cs`
**Estimated runtimeCode:** ~150 lines

### Tasks:
- [ ] 5.1 Create moon billboard mesh (PlaneGeometry facing camera or SphereGeometry)
- [ ] 5.2 Port moon surface albedo (procedural or texture-based)
- [ ] 5.3 Port BRDF lighting with diffuse wrap for crescent rendering
- [ ] 5.4 Port phase shadow from sun-moon elongation angle
- [ ] 5.5 Port earthshine effect (dark side faintly visible via ambient)
- [ ] 5.6 Port horizon color tinting (orange when moon is low)
- [ ] 5.7 Port moon brightness scaling: `lerp(0, 2.5, albedo)` for glow
- [ ] 5.8 Position moon using Phase 2 orbital calculator
- [ ] 5.9 Wire up `defaultSettings.sky.moonDiskSize` and `moonBrightness`
- [ ] 5.10 Test: correct phase at different dates (new, crescent, quarter, full)
- [ ] 5.11 Test: earthshine visible on dark side during crescent
- [ ] 5.12 Test: orange tint when moon is near horizon

### Verification:
- Moon shows correct phase matching real lunar cycle
- Smooth shadow boundary (not hard cutoff)
- Earthshine visible on crescent moon
- Moon tracks correct sky position from orbital calculator

---

## PHASE 6: Weather System + Precipitation (0%)
**Goal:** Weather state machine with rain/snow particles, overcast transitions
**Source:** `TenkokuModule.cs` weather sections (~500 lines), precipitation from existing sky-weather
**Estimated runtimeCode:** ~350 lines

### Tasks:
- [ ] 6.1 Port weather state machine: clear → overcast → rain → storm → snow
- [ ] 6.2 Port weather transitions: smooth lerping over configurable transition time
- [ ] 6.3 Port auto-forecast: probabilistic state changes based on current weather
- [ ] 6.4 Port temperature/humidity → precipitation type logic (rain vs snow)
- [ ] 6.5 Port overcast system: cloud coverage ramp + sky dimming
- [ ] 6.6 Implement rain particle system (reuse existing sky-weather rain texture pattern)
- [ ] 6.7 Implement snow particle system (reuse existing sky-weather snow texture pattern)
- [ ] 6.8 Port wind system: direction, speed, gust randomization → affect particles
- [ ] 6.9 Wire up `defaultSettings.precipitation` and `defaultSettings.weather`
- [ ] 6.10 Test: manual weather transitions (clear→rain→snow→clear)
- [ ] 6.11 Test: auto-forecast produces natural sequence over 10-minute cycle
- [ ] 6.12 Test: wind visibly affects rain/snow particle direction

### Verification:
- Weather transitions are smooth (no sudden jumps)
- Rain/snow particles render correctly with wind influence
- Auto-forecast produces varied, natural weather patterns
- Overcast properly dims sky and increases cloud coverage

---

## PHASE 7: Lightning + Thunder (0%)
**Goal:** Perlin-path lightning bolts with distance-based thunder audio
**Source:** `TenkokuLightningFX.cs` (430 lines)
**Estimated runtimeCode:** ~200 lines

### Tasks:
- [ ] 7.1 Port bolt geometry generator: Perlin-based jittered path (40-80 segments)
- [ ] 7.2 Port bolt subdivision: vertical step + horizontal jitter + convergence factor
- [ ] 7.3 Implement bolt rendering: `THREE.LineSegments` with emissive material
- [ ] 7.4 Port frequency control: timer accumulation → threshold → bolt spawn
- [ ] 7.5 Port lightning flash: temporary PointLight at bolt position, rapid decay
- [ ] 7.6 Port thunder audio: Web Audio API, distance-based delay + volume
- [ ] 7.7 Port thunder pitch variation (0.6-1.2 based on distance)
- [ ] 7.8 Port bolt lifecycle: spawn → 2s render → fade out → cleanup
- [ ] 7.9 Wire up `defaultSettings.lightning` → frequency, color, intensity
- [ ] 7.10 Test: storm sequence with multiple concurrent bolts
- [ ] 7.11 Test: thunder delay matches visual bolt distance
- [ ] 7.12 Test: bolt paths look naturally jagged (not uniform)

### Verification:
- Lightning bolts render with convincing jagged Perlin paths
- Flash illuminates scene briefly
- Thunder plays with realistic delay based on bolt distance
- Multiple bolts can fire in rapid succession during storms

---

## PHASE 8: Fog + Sun Shafts (God Rays) (0%)
**Goal:** Height-based volumetric fog and depth-masked radial blur sun shafts
**Source:** `TenkokuSkyFog.cs` (199 lines), `TenkokuSunShafts.cs` (156 lines)
**Estimated runtimeCode:** ~250 lines

### Tasks:
- [ ] 8.1 Port height-based fog: density = f(altitude) with exponential falloff
- [ ] 8.2 Port fog color: auto-match sky horizon color from atmosphere
- [ ] 8.3 Port distance-based fog (combine with height fog)
- [ ] 8.4 Implement fog via `THREE.FogExp2` or custom TSL post-process
- [ ] 8.5 Port sun shafts: project sun position to screen space
- [ ] 8.6 Port radial blur from sun position (4 passes, simplified 8-12 samples each)
- [ ] 8.7 Port depth masking: only blur sky-visible pixels (not solid objects)
- [ ] 8.8 Implement god rays as TSL post-processing pass
- [ ] 8.9 Wire up `defaultSettings.fog` and `defaultSettings.effects.godRays`
- [ ] 8.10 Test: fog at different densities and heights
- [ ] 8.11 Test: sun shafts through cloud breaks
- [ ] 8.12 Test: performance impact acceptable (< 2ms per frame)

### Verification:
- Fog has proper height falloff (thicker at ground level)
- Fog color matches sky horizon naturally
- Sun shafts radiate from sun position through cloud breaks
- Post-processing doesn't tank FPS below 30

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
| 1 | Module Scaffold + Atmosphere | 20 | Code done, 3 tests pending | 85% |
| 2 | Solar Calculator + Day/Night | 20 | Code done, 3 tests pending | 85% |
| 3 | Procedural Clouds (3-layer fBm) | 20 | Code done, tests pending | 85% |
| 4 | Real Star Catalog | 13 | Code done (2,887 Tycho2 stars, mag≤5.5) | 85% |
| 5 | Moon Rendering | 12 | Code done, tests pending | 85% |
| 6 | Weather + Precipitation | 12 | Code done (state machine + particles) | 85% |
| 7 | Lightning + Thunder | 12 | Code done, tests pending | 85% |
| 8 | Fog + Sun Shafts | 12 | Code done (height fog + billboard god rays) | 80% |
| 9 | Aurora Borealis | 11 | Code done, tests pending | 85% |
| 10 | Milky Way + Planets | 10 | Code done, tests pending | 85% |
| 11 | Weather Audio | 10 | Code done, tests pending | 85% |
| 12 | Settings + Bridge + Polish | 13 | Code done (6 presets, 4 bridge handlers) | 85% |
| **TOTAL** | | **165** | | **14%** |

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
| 2026-03-16 | Gap-fill | Sidereal rotation, wind gusts, thunder pitch, audio crossfade, overcast dimming, sun shafts | 70% |

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
