# WORK PLAN: Tenkoku Dynamic Sky Conversion

> **Status**: ~40% complete (honest)
> **Module**: `sky-weather-advanced`
> **Source**: Tenkoku v1.2.1 (4228 lines C# + 15 shaders)
> **Target**: Vibexe runtimeCode (~2940 lines JS, Three.js r183 WebGPU)

## What WORKS (verified):
- Sky dome with Rayleigh+Mie (CPU vertex colors)
- Schlyter sun positioning
- Light adoption + mutual exclusion
- Star catalog (2,887 stars)
- Settings panel (39 config props, 6 tabs)
- Blue sky + dusk/dawn transitions

## What NEEDS WORK (12 phases, priority order):
1. Atmosphere accuracy (gradients, Mie phase, night floor)
2. Clouds (coverage, wind scroll, overcast darkening)
3. Sun (verify Kepler, timezone, DST)
4. Moon (12 perturbation terms, phase visual)
5. Weather state machine (auto-forecast, SmoothStep)
6. Fog (height fog, auto-color, heat distortion)
7. Precipitation (rain 5000 particles, snow 1500, wind force)
8. Stars (sidereal rotation, spectral colors)
9. Panel polish (remaining controls)
10. Effects (aurora, rainbow, sun shafts, milky way, planets)
11. Lightning (bolt geometry, thunder tiers)
12. Audio (6 channels, weather crossfade)

## Tenkoku Source Files:
- `TenkokuModule.cs` (4228 lines) — main controller
- `TenkokuCalculations.cs` — orbital mechanics
- `Tenkoku_sky_legacy.shader` — atmosphere
- `AtmosphericScattering.cginc` — Rayleigh+Mie math
- `Tenkoku_cloud_plane.shader` — clouds
- `Tenkoku_FX_Fog.shader` — fog + rainbow
- `TenkokuLightningFX.cs` — lightning bolts
- `TenkokuGlobalSound.cs` — audio system
