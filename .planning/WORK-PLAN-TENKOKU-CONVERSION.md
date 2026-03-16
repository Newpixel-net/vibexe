# WORK PLAN: Tenkoku Dynamic Sky Conversion

> **Status**: ~40% (infrastructure done, visuals need work)
> **Module**: `sky-weather-advanced` (~2960 lines JS)
> **Constraint**: No ShaderMaterial (WebGPU) — use MeshBasicMaterial or Canvas2D textures
> **Panel**: `sky-weather-panel.tsx` — 6 tabs, 39 config props, 3x2 grid tabs

## DONE (verified):
- [x] Sky dome atmosphere (Rayleigh+Mie vertex colors, 2s throttle)
- [x] Schlyter sun positioning (lat/lon/date/timezone)
- [x] Light adoption + mutual exclusion
- [x] Star catalog loaded (2,887 Tycho2 stars)
- [x] Settings panel (Tenkoku-style, 6 tabs)
- [x] Day/night cycle with autoAdvance
- [x] Better defaults (afternoon, 35% clouds, fog on, cycle on)

## PHASE 1: TEXTURE-BASED CLOUDS (NEXT — highest visual impact)
**Problem**: Vertex-color clouds on 48x16 dome are invisible. Need texture approach.
**Solution**: Canvas2D procedural noise → CanvasTexture on cloud dome

Tasks:
1. [ ] Create 512x256 Canvas2D for cloud noise rendering
2. [ ] Implement 2D FBM noise on canvas (3 octaves)
3. [ ] Coverage threshold: `noise > (1 - coverage)` → white, else transparent
4. [ ] Wind scroll: offset UV each frame by `windSpeed * dt`
5. [ ] Cloud lighting: sun-facing side brighter (dot product with sun dir)
6. [ ] Apply as `map` on MeshBasicMaterial with `alphaMap` or RGBA canvas
7. [ ] 3 cloud types: Cumulus (low, thick), Cirrus (high, wispy), Altostratus (thin layer)
8. [ ] Update texture every 0.5-1s (canvas is cheap)
9. [ ] Overcast: high coverage → dark, uniform cloud layer
10. [ ] Visual test: Cloudy/Partly Cloudy/Clear should match Tenkoku reference images

## PHASE 2: SUN DISK + GLOW
**Reference**: Tenkoku shows visible sun disk with bright halo (Mie glow)

Tasks:
1. [ ] Sun billboard: bright white circle sprite following sun direction
2. [ ] Sun glow: larger semi-transparent halo (Mie scattering visual)
3. [ ] Sun color: white at noon, orange at sunrise/sunset (from gradient)
4. [ ] Sun below horizon: fade out, no rendering
5. [ ] Eclipse support: moon disc can occlude sun (stretch goal)

## PHASE 3: ATMOSPHERE POLISH
**Reference**: Tenkoku has deep blue zenith, warm golden horizon, night floor color

Tasks:
1. [ ] Night sky floor: minimum color `(0.027, 0.02, 0.025)` * nightBrightness
2. [ ] Overcast desaturation: `lerp(color, grayscale, overcast*2)`
3. [ ] Horizon density boost: warmer/hazier at horizon
4. [ ] Exposure control: scale final colors by exposure slider
5. [ ] Gradient-based color system (sky/horizon/sun gradients by time of day)

## PHASE 4: MOON (perturbations + phase visual)
Tasks:
1. [ ] 12 longitude perturbation terms (Evection -1.274°, etc.)
2. [ ] 5 latitude + 2 distance corrections
3. [ ] Moon phase visual: clip/rotate disc by sun-moon angle
4. [ ] Moon Mie glow: halo around moon at night
5. [ ] Moon light: modulate ambient by moonPhase * nightFactor

## PHASE 5: WEATHER EFFECTS (rain, snow, overcast)
**Reference**: Rain as white diagonal streaks, snow as white dots, dark overcast sky

Tasks:
1. [ ] Rain: Three.js Points with elongated sprites falling at angle
2. [ ] Snow: Three.js Points with round sprites floating down
3. [ ] Wind affects particle direction (rain: 46x force, snow: 2x)
4. [ ] Overcast darkening: reduce sky brightness + ambient
5. [ ] Weather transitions: SmoothStep between states over configurable time
6. [ ] Auto-forecast: random weather changes at configurable interval

## PHASE 6: FOG + ATMOSPHERE HAZE
Tasks:
1. [ ] Three.js scene.fog integration (FogExp2)
2. [ ] Auto-color fog from sky horizon color
3. [ ] Fog density slider → scene.fog.density
4. [ ] Distance haze: far objects blend toward horizon color

## PHASE 7: STARS + SIDEREAL ROTATION
Tasks:
1. [ ] Sidereal time rotation (stars rotate ~1°/day faster than sun)
2. [ ] Star visibility: fade in at civil twilight (sun < -6°)
3. [ ] Spectral colors: O(blue) B A F G(yellow) K(orange) M(red)
4. [ ] Magnitude→brightness scaling
5. [ ] Verify night sky at lat=35 shows Polaris near north

## PHASE 8: EFFECTS (aurora, sun shafts, milky way)
Tasks:
1. [ ] Aurora: animated curtain mesh at high latitudes, speed/intensity controls
2. [ ] Sun shafts: billboard planes radiating from sun direction
3. [ ] Milky Way: textured sphere layer visible at night
4. [ ] Shooting stars: occasional particle streaks

## PHASE 9: LIGHTNING + THUNDER
Tasks:
1. [ ] Lightning bolt: Line geometry with Perlin noise jitter (40-80 vertices)
2. [ ] Flash: pulse scene light intensity
3. [ ] Thunder: delayed audio (distance-based: near/medium/far)
4. [ ] Frequency: configurable, linked to storm intensity

## PHASE 10: AUDIO SYSTEM
Tasks:
1. [ ] 6 audio channels: wind, turbulence×2, rain, ambDay, ambNight
2. [ ] Volume crossfade by weather state + time of day
3. [ ] Thunder: 5-source pool with spatial positioning

## PHASE 11: PANEL COMPLETENESS
Tasks:
1. [ ] Verify all 39 config props actually affect rendering
2. [ ] Add missing Tenkoku controls: atmosphereDensity, horizonDensity, skyBrightness, nightBrightness
3. [ ] Add "Sync to System Time" button
4. [ ] Config persistence: save→reload→values restored verification

## PHASE 12: PLANET ORBITS + ECLIPSES
Tasks:
1. [ ] Mercury-Neptune orbital mechanics with perturbations
2. [ ] Planet rendering as small bright dots
3. [ ] Solar eclipse: moon disc occludes sun at correct alignment

---

## KEY TECHNICAL NOTES:
- **No ShaderMaterial**: WebGPU renderer rejects it → use MeshBasicMaterial or Canvas2D textures
- **Vertex alpha**: WebGPU MeshBasicMaterial ignores 4th component of vertex colors
- **Cloud approach**: Must use Canvas2D texture, NOT vertex colors (resolution too low, alpha unsupported)
- **Saved config**: Existing projects have saved `skyWeatherAdvanced` in DB — defaults only affect new projects. Use "Reset to Defaults" to apply new defaults to existing projects.

## TENKOKU REFERENCE FILES:
- `TenkokuModule.cs` (4228 lines) — main controller, 130+ settings
- `TenkokuCalculations.cs` — Schlyter orbital mechanics
- `AtmosphericScattering.cginc` — Rayleigh+Mie scattering math
- `Tenkoku_cloud_plane.shader` — cloud UV scroll + lighting
- `Tenkoku_FX_Fog.shader` — fog + rainbow rendering
- `TenkokuLightningFX.cs` — bolt geometry + thunder
- `TenkokuGlobalSound.cs` — 6-channel audio
- `ParticleStarfieldHandler.cs` — 9,095 star catalog
