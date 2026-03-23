# Procedural 2D Game Art Generation Techniques - Research

**Researched:** 2026-03-23
**Domain:** Procedural 2D art generation for Pixi.js v8 browser games
**Confidence:** HIGH (algorithms well-established; Pixi.js v8 API verified against official docs)

## Summary

This document catalogs procedural 2D art generation techniques used in successful indie games (Terraria, Alto's Adventure, Limbo, Celeste, Dead Cells, Hollow Knight), adapted for implementation with Pixi.js v8's Graphics API and HTML Canvas 2D fallbacks.

The Vibexe 2D engine already has strong foundations: seeded 1D noise (`noise1D`, `fbm`), color utilities (`darken`, `lighten`, `lerpColor`), FillGradient wrappers (`makeLinearGradient`, `makeRadialGradient`), theme-driven mountain profiles, and Canvas 2D sprite rendering (`_makeCanvas`, `_canvasToSprite`). The techniques below build on this existing infrastructure.

**Primary recommendation:** Layer multiple cheap techniques (noise silhouettes + parallax fog + color grading + subtle animation) rather than one expensive technique. The combinatorial variety is enormous and each individual piece runs well within 60fps budgets.

---

## 1. Procedural Terrain Silhouettes

### 1.1 Multi-Octave Noise Profiles (ALREADY IMPLEMENTED)

The codebase already uses `fbm()` with per-theme profiles (`MOUNTAIN_PROFILES`) for mountain silhouettes. This is the industry standard approach.

**Core algorithm:**
```
height(x) = sum for i in 0..octaves:
    amplitude_i * noise(x * frequency_i)
where:
    amplitude_i = persistence ^ i
    frequency_i = lacunarity ^ i
```

**Redistribution for terrain variety:**
```
// Flat valleys with sharp peaks (volcanic)
height = pow(rawNoise, 2.0)

// Rolling gentle hills (candy)
height = pow(rawNoise, 0.5)

// Ridged mountains (alpine)
height = 2 * (0.5 - abs(0.5 - rawNoise))

// Terraced (mesa/plateau)
height = round(rawNoise * steps) / steps
```

- **Complexity:** O(octaves) per sample, trivially fast. 60fps: YES
- **Visual impact:** HIGH -- drives the entire landscape character
- **Implementation difficulty:** LOW (already done in codebase)
- **Source:** Red Blob Games terrain-from-noise (HIGH confidence)

### 1.2 Midpoint Displacement (Alternative to Noise)

Simpler than Perlin noise, used in many indie platformers. Good for quick prototypes.

**Pseudocode:**
```
function midpointDisplacement(left, right, roughness, depth):
    if depth <= 0: return
    mid = (left + right) / 2
    midHeight = (leftHeight + rightHeight) / 2 + random(-1,1) * roughness
    midpointDisplacement(left, mid, roughness * 0.5, depth - 1)
    midpointDisplacement(mid, right, roughness * 0.5, depth - 1)
```

- **Complexity:** O(2^depth), but depth rarely exceeds 8-10. 60fps: YES
- **Visual impact:** MEDIUM -- less control than fbm but faster to implement
- **Implementation difficulty:** LOW

### 1.3 Warp/Distortion for Alien Landscapes

Domain warping creates organic, otherworldly terrain by feeding noise back into itself.

**Pseudocode:**
```
function warpedTerrain(x):
    // First pass: get warp offset
    warpX = fbm(x * 0.01 + 100)
    // Second pass: sample with warped coordinate
    return fbm((x + warpX * 200) * 0.005)
```

**Pixi.js implementation:**
```typescript
// Generate warped terrain profile
for (let x = 0; x <= worldW; x += step) {
    const warp = fbm((x + seedOffset) * 0.003, 2, 0.5, 2.0) * 150;
    const h = fbm((x + warp) * prof.freq, prof.octaves, prof.persistence, prof.lacunarity, prof.exponent);
    points.push(baseY - minH - h * (maxH - minH));
}
```

- **Complexity:** 2x noise lookups per sample. 60fps: YES
- **Visual impact:** HIGH -- creates uniquely alien, flowing terrain
- **Implementation difficulty:** LOW (just compose existing fbm calls)

### 1.4 Erosion Simulation (Simplified)

Thermal erosion can be approximated cheaply for 1D terrain profiles.

**Pseudocode:**
```
function thermalErosion(heightMap, iterations, threshold):
    for iter in 0..iterations:
        for i in 1..heightMap.length-1:
            diff = heightMap[i] - heightMap[i-1]
            if abs(diff) > threshold:
                transfer = diff * 0.3
                heightMap[i] -= transfer
                heightMap[i-1] += transfer
```

- **Complexity:** O(n * iterations), ~3-5 iterations sufficient. 60fps: YES (one-time generation)
- **Visual impact:** MEDIUM -- smooths jagged peaks into natural slopes
- **Implementation difficulty:** LOW

---

## 2. Procedural Vegetation

### 2.1 Simplified L-System Trees

L-systems encode tree growth as string rewriting rules interpreted as turtle graphics commands. For 2D games, a 3-4 generation system produces good results.

**Core algorithm:**
```
Alphabet: F (forward), + (turn right), - (turn left), [ (push state), ] (pop state)
Axiom:    "F"
Rule:     F -> "F[+F]F[-F]F"

Interpretation:
    F: draw line forward (length shrinks each generation)
    +: rotate right by angle (25-35 degrees typical)
    -: rotate left by angle
    [: save position+angle to stack
    ]: restore position+angle from stack
```

**Pixi.js Graphics implementation:**
```typescript
function drawLSystemTree(g: Graphics, x: number, y: number,
    generations: number, angle: number, length: number, thickness: number) {

    let axiom = "F";
    const rule = "FF+[+F-F-F]-[-F+F+F]";

    // Expand string
    for (let gen = 0; gen < generations; gen++) {
        axiom = axiom.split('').map(c => c === 'F' ? rule : c).join('');
    }

    // Interpret with turtle graphics
    const stack: {x:number, y:number, angle:number, len:number, thick:number}[] = [];
    let cx = x, cy = y, ca = -90; // start pointing up
    let len = length, thick = thickness;

    for (const char of axiom) {
        switch(char) {
            case 'F':
                const nx = cx + Math.cos(ca * Math.PI/180) * len;
                const ny = cy + Math.sin(ca * Math.PI/180) * len;
                g.moveTo(cx, cy);
                g.lineTo(nx, ny);
                g.stroke({ color: 0x5a3a1a, width: thick });
                cx = nx; cy = ny;
                break;
            case '+': ca += angle + (Math.random()-0.5)*10; break;
            case '-': ca -= angle + (Math.random()-0.5)*10; break;
            case '[':
                stack.push({x:cx, y:cy, angle:ca, len, thick});
                len *= 0.7; thick *= 0.65;
                break;
            case ']':
                const s = stack.pop()!;
                cx=s.x; cy=s.y; ca=s.angle; len=s.len; thick=s.thick;
                break;
        }
    }
}
```

**Common L-System presets for trees:**
| Tree Type | Axiom | Rule | Angle | Generations |
|-----------|-------|------|-------|-------------|
| Oak | F | F[+F]F[-F][F] | 25 | 4 |
| Pine | F | F[+F][-F]F | 20 | 5 |
| Willow | F | FF-[-F+F+F]+[+F-F-F] | 22 | 4 |
| Bush | F | F[+F]F[-F]F | 30 | 3 |
| Coral | F | F[+F][-F] | 35 | 5 |

- **Complexity:** O(rule_length ^ generations) for expansion, O(string_length) for rendering. Keep generations <= 5. 60fps: YES (generate once, cache as sprite)
- **Visual impact:** VERY HIGH -- infinite tree variety from simple rules
- **Implementation difficulty:** MEDIUM
- **Source:** Wikipedia L-system, gpfault.net tree generation (HIGH confidence)

### 2.2 Recursive Branching (Simplified)

For faster implementation than L-systems, direct recursive branching produces good trees.

**Pseudocode:**
```typescript
function drawBranch(g: Graphics, x: number, y: number,
    angle: number, length: number, depth: number, thickness: number) {
    if (depth <= 0) {
        // Draw leaf cluster at branch tip
        g.circle(x, y, 4 + Math.random() * 6);
        g.fill({ color: leafColor, alpha: 0.6 + Math.random() * 0.4 });
        return;
    }

    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;

    g.moveTo(x, y);
    g.lineTo(endX, endY);
    g.stroke({ color: trunkColor, width: thickness });

    // Branch into 2-3 sub-branches with randomized angles
    const branchCount = 2 + (Math.random() > 0.7 ? 1 : 0);
    const spread = 0.4 + Math.random() * 0.3;

    for (let i = 0; i < branchCount; i++) {
        const branchAngle = angle + (i - (branchCount-1)/2) * spread
                            + (Math.random() - 0.5) * 0.2;
        const branchLen = length * (0.6 + Math.random() * 0.15);
        drawBranch(g, endX, endY, branchAngle, branchLen,
                   depth - 1, thickness * 0.65);
    }
}
```

- **Complexity:** O(3^depth), depth 5-7. 60fps: YES (generate once)
- **Visual impact:** HIGH -- natural looking with randomization
- **Implementation difficulty:** LOW

### 2.3 Procedural Flowers, Mushrooms, Coral

**Flower (petal ring with center):**
```typescript
function drawFlower(g: Graphics, x: number, y: number,
    petalCount: number, petalSize: number, color: number) {
    for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const px = x + Math.cos(angle) * petalSize * 0.6;
        const py = y + Math.sin(angle) * petalSize * 0.6;
        g.ellipse(px, py, petalSize * 0.5, petalSize * 0.8);
        g.fill(lighten(color, i % 2 === 0 ? 10 : -10));
    }
    // Center
    g.circle(x, y, petalSize * 0.3);
    g.fill(darken(color, 30));
}
```

**Mushroom (cap + stem with spots):**
```typescript
function drawMushroom(g: Graphics, x: number, y: number,
    capW: number, capH: number, stemH: number, color: number) {
    // Stem
    g.roundRect(x - capW * 0.15, y - stemH, capW * 0.3, stemH, 4);
    g.fill(lighten(color, 40));
    // Cap - half ellipse
    g.ellipse(x, y - stemH, capW * 0.5, capH);
    g.fill(color);
    // Cap bottom shadow
    g.ellipse(x, y - stemH + capH * 0.6, capW * 0.45, capH * 0.3);
    g.fill({ color: darken(color, 30), alpha: 0.3 });
    // Spots
    for (let i = 0; i < 4; i++) {
        const sx = x + (Math.random() - 0.5) * capW * 0.6;
        const sy = y - stemH + (Math.random() - 0.5) * capH * 0.5;
        g.circle(sx, sy, 2 + Math.random() * 3);
        g.fill({ color: lighten(color, 50), alpha: 0.7 });
    }
}
```

- **Complexity:** O(1) per instance. 60fps: YES
- **Visual impact:** MEDIUM -- adds variety to foreground scenery
- **Implementation difficulty:** LOW

### 2.4 Vegetation Sway Animation

**Sine-wave sway for plants/grass:**
```typescript
// In update loop (dt = delta time in seconds):
const time = engine._elapsed;
for (const plant of plants) {
    // Base sway from wind
    const sway = Math.sin(time * 1.5 + plant.x * 0.01) * 3;
    // Secondary harmonic for natural feel
    const sway2 = Math.sin(time * 2.7 + plant.x * 0.02) * 1.5;
    plant.skew.x = (sway + sway2) * 0.01;
    // Slight scale pulse
    plant.scale.y = 1 + Math.sin(time * 0.8 + plant.x * 0.005) * 0.02;
}
```

**Key insight:** Use `skew.x` for sway (anchored at bottom), NOT rotation. Set `pivot.y` to the bottom of the sprite so it sways from the base.

- **Complexity:** O(n) per frame, n = number of plants. 60fps: YES (even 200+ plants)
- **Visual impact:** HIGH -- brings static scenes to life
- **Implementation difficulty:** LOW

---

## 3. Procedural Architecture

### 3.1 Rule-Based Building Generation

Buildings are composed from a grammar of structural elements.

**Algorithm:**
```
Building = Foundation + Floors[] + Roof

Floor = WallLeft + WindowPattern + WallRight + Ledge?
WindowPattern = repeat(Window | Balcony | Wall, 3-6 times)
Roof = Flat | Peaked | Domed | Crenelated

Rules:
- Width = 60-200px, derived from seed
- FloorCount = 2-8, derived from seed
- FloorHeight = 30-50px
- WindowSpacing = width / (windowCount + 1)
- Style = {medieval, modern, ruins, castle}
```

**Pixi.js implementation sketch:**
```typescript
function drawBuilding(g: Graphics, x: number, y: number,
    seed: number, style: string) {
    const rng = mulberry32(seed);
    const width = 80 + rng() * 120;
    const floors = 2 + Math.floor(rng() * 5);
    const floorH = 35 + rng() * 15;
    const totalH = floors * floorH;

    // Foundation
    g.rect(x, y - totalH, width, totalH);
    g.fill(darken(wallColor, 10));

    // Windows per floor
    for (let f = 0; f < floors; f++) {
        const fy = y - (f + 1) * floorH;
        const winCount = 2 + Math.floor(rng() * 3);
        const spacing = width / (winCount + 1);
        for (let w = 0; w < winCount; w++) {
            const wx = x + spacing * (w + 1) - 6;
            const wy = fy + floorH * 0.2;
            g.rect(wx, wy, 12, floorH * 0.5);
            g.fill(0x334466);
            // Window glow
            g.rect(wx + 1, wy + 1, 10, floorH * 0.5 - 2);
            g.fill({ color: 0xffdd88, alpha: rng() > 0.3 ? 0.4 : 0 });
        }
        // Floor ledge
        if (rng() > 0.5) {
            g.rect(x - 2, fy + floorH - 3, width + 4, 3);
            g.fill(darken(wallColor, 20));
        }
    }

    // Roof
    const roofStyle = Math.floor(rng() * 3);
    if (roofStyle === 0) { // Peaked
        g.moveTo(x - 5, y - totalH);
        g.lineTo(x + width / 2, y - totalH - 30);
        g.lineTo(x + width + 5, y - totalH);
        g.closePath();
        g.fill(0x884433);
    }
    // ... other roof types
}
```

### 3.2 Brick/Stone Patterns

**Running bond brick pattern:**
```typescript
function drawBrickPattern(g: Graphics, x: number, y: number,
    w: number, h: number, brickW: number, brickH: number, color: number) {
    for (let row = 0; row < h / brickH; row++) {
        const offset = (row % 2) * (brickW / 2); // stagger alternate rows
        for (let col = -1; col < w / brickW + 1; col++) {
            const bx = x + col * brickW + offset;
            const by = y + row * brickH;
            // Slight color variation per brick
            const brickColor = lerpColor(color, darken(color, 15),
                                         Math.random() * 0.5);
            g.rect(bx + 0.5, by + 0.5, brickW - 1, brickH - 1);
            g.fill(brickColor);
        }
    }
    // Mortar lines (drawn as gaps between bricks)
    g.rect(x, y, w, h);
    g.stroke({ color: darken(color, 30), width: 1 });
}
```

### 3.3 Ruins and Broken Structures

Apply "destruction" to generated buildings by removing random sections.

```typescript
function applyRuinEffect(building: Graphics, seed: number,
    destructionLevel: number /* 0-1 */) {
    const rng = mulberry32(seed);
    // Irregular top edge (broken wall)
    // Remove blocks from top based on noise
    for (let x = 0; x < width; x += 8) {
        const keepHeight = totalH * (1 - destructionLevel * rng());
        // Use .cut() to remove sections above keepHeight
        // Or draw the building only up to keepHeight at each x
    }
    // Add rubble at base
    for (let i = 0; i < destructionLevel * 15; i++) {
        const rx = baseX + rng() * width;
        const ry = baseY + rng() * 10;
        g.rect(rx, ry, 4 + rng() * 8, 3 + rng() * 5);
        g.fill(wallColor);
    }
}
```

- **Complexity:** O(floors * windows) for generation. 60fps: YES (generate once)
- **Visual impact:** HIGH -- makes cities/towns feel unique
- **Implementation difficulty:** MEDIUM

---

## 4. Atmospheric Effects

### 4.1 Parallax Fog Layers

Multiple semi-transparent layers scrolling at different rates create depth.

**Algorithm:**
```typescript
// Create 3-5 fog layers at different depths
function createFogLayers(worldW: number, worldH: number,
    fogColor: number, count: number): Container[] {
    const layers: Container[] = [];

    for (let i = 0; i < count; i++) {
        const depth = (i + 1) / count; // 0.2 to 1.0
        const g = new PIXI.Graphics();

        // Draw fog as overlapping ellipses with noise-driven positions
        const fogY = worldH * (0.3 + depth * 0.5);
        for (let x = -100; x < worldW + 100; x += 30 + Math.random() * 50) {
            const fw = 100 + Math.random() * 200;
            const fh = 20 + Math.random() * 40;
            g.ellipse(x, fogY + Math.random() * 30, fw, fh);
            g.fill({ color: fogColor, alpha: 0.03 + depth * 0.05 });
        }

        // Apply blur for softness
        if (PIXI.BlurFilter) {
            g.filters = [new PIXI.BlurFilter(8 + i * 4)];
        }

        layers.push(g);
    }
    return layers;
}

// In update loop:
for (let i = 0; i < fogLayers.length; i++) {
    const speed = 0.1 + i * 0.05; // deeper = slower
    fogLayers[i].x += speed * dt * windDirection;
    // Wrap around
    if (fogLayers[i].x > worldW) fogLayers[i].x = -worldW;
}
```

- **Complexity:** O(layers) per frame for scrolling. 60fps: YES
- **Visual impact:** HIGH -- instant depth and atmosphere
- **Implementation difficulty:** LOW

### 4.2 Volumetric Light Rays (God Rays)

Two approaches for 2D god rays:

**Approach A: Radial triangle fan (cheap, good enough):**
```typescript
function drawGodRays(container: Container, sourceX: number, sourceY: number,
    rayCount: number, maxLength: number, color: number) {
    const g = new PIXI.Graphics();
    for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 0.6 + Math.PI * 0.2;
        const spread = 0.02 + Math.random() * 0.03;
        const len = maxLength * (0.5 + Math.random() * 0.5);

        g.moveTo(sourceX, sourceY);
        g.lineTo(
            sourceX + Math.cos(angle - spread) * len,
            sourceY + Math.sin(angle - spread) * len
        );
        g.lineTo(
            sourceX + Math.cos(angle + spread) * len,
            sourceY + Math.sin(angle + spread) * len
        );
        g.closePath();
        g.fill({ color, alpha: 0.02 + Math.random() * 0.03 });
    }
    container.addChild(g);
    return g;
}
```

**Approach B: pixi-filters GodrayFilter (best quality):**
```typescript
import { GodrayFilter } from 'pixi-filters';

const godray = new GodrayFilter({
    angle: 30,
    gain: 0.5,
    lacunarity: 2.5,
    parallel: true,
    time: 0,
});
backgroundContainer.filters = [godray];

// Animate in update loop:
godray.time += dt * 0.5;
```

- **Complexity:** Triangle fan: O(rayCount). Filter: GPU shader. 60fps: YES
- **Visual impact:** VERY HIGH -- dramatic and beautiful
- **Implementation difficulty:** LOW (filter) to MEDIUM (custom)

### 4.3 Heat Shimmer / Underwater Distortion

Use Pixi.js DisplacementFilter with an animated displacement map.

```typescript
// Create displacement sprite from noise texture
const displacementSprite = PIXI.Sprite.from(noiseTexture);
displacementSprite.texture.source.wrapMode = 'repeat';

const displacementFilter = new PIXI.DisplacementFilter({
    sprite: displacementSprite,
    scale: { x: 10, y: 20 },
});
gameContainer.filters = [displacementFilter];

// Animate displacement for shimmer:
displacementSprite.y += dt * 30;
displacementSprite.x += dt * 10;
```

- **Complexity:** GPU shader, negligible CPU. 60fps: YES
- **Visual impact:** HIGH -- sells heat/underwater instantly
- **Implementation difficulty:** LOW (built into Pixi.js)

### 4.4 Rain with Wind and Accumulation

Extend the existing `createRainEffect()` from game-2d-effects.ts:

```typescript
// Wind-affected rain angle
const windAngle = 250 + windStrength * 30; // degrees, 250=slight left, 280=vertical
emitter.addInitialize(new Proton.Velocity(
    new Proton.Span(4 + windStrength * 3, 8 + windStrength * 5),
    new Proton.Span(windAngle - 10, windAngle + 10), 'polar'
));

// Splash particles on ground contact
// (use a separate emitter triggered when rain particles cross groundY)
const splashEmitter = new Proton.Emitter();
splashEmitter.rate = new Proton.Rate(new Proton.Span(1, 3), 0.05);
splashEmitter.addInitialize(new Proton.Life(0.1, 0.3));
splashEmitter.addInitialize(new Proton.Radius(1, 3));
splashEmitter.addInitialize(new Proton.Velocity(
    new Proton.Span(1, 3), new Proton.Span(70, 110), 'polar'
));
```

### 4.5 Day/Night Color Grading

Use ColorMatrixFilter or direct palette interpolation.

```typescript
// Time-of-day color grading
function applyTimeOfDay(container: Container, timeNormalized: number /* 0-1 */) {
    const colorMatrix = new PIXI.ColorMatrixFilter();

    if (timeNormalized < 0.25) {
        // Night: desaturate, blue tint
        colorMatrix.night(0.3 + timeNormalized * 2, false);
    } else if (timeNormalized < 0.35) {
        // Dawn: warm orange tint
        colorMatrix.sunset(true);
        colorMatrix.brightness(0.8 + (timeNormalized - 0.25) * 2, false);
    } else if (timeNormalized < 0.75) {
        // Day: normal
        colorMatrix.brightness(1.0, false);
    } else {
        // Dusk-to-night transition
        const t = (timeNormalized - 0.75) / 0.25;
        colorMatrix.night(t * 0.3, false);
    }

    container.filters = [colorMatrix];
}
```

- **Complexity:** GPU shader for ColorMatrixFilter. 60fps: YES
- **Visual impact:** VERY HIGH -- transforms entire mood
- **Implementation difficulty:** LOW

---

## 5. Water and Lava

### 5.1 Sine-Wave Water Surface

**Multi-sine water with reflected sky color:**
```typescript
function drawWaterSurface(g: Graphics, worldW: number, waterY: number,
    waterH: number, time: number, waterColor: number) {

    g.clear();
    const step = 4;

    // Surface wave = sum of multiple sine waves
    function waveHeight(x: number): number {
        return Math.sin(x * 0.02 + time * 1.5) * 4
             + Math.sin(x * 0.035 + time * 2.3) * 2.5
             + Math.sin(x * 0.008 + time * 0.7) * 8;
    }

    // Draw water body
    g.moveTo(0, waterY + waveHeight(0));
    for (let x = step; x <= worldW; x += step) {
        g.lineTo(x, waterY + waveHeight(x));
    }
    g.lineTo(worldW, waterY + waterH);
    g.lineTo(0, waterY + waterH);
    g.closePath();

    const waterGrad = makeLinearGradient(waterColor, darken(waterColor, 40), waterH);
    g.fill(waterGrad);

    // Surface highlight line
    g.moveTo(0, waterY + waveHeight(0) - 1);
    for (let x = step; x <= worldW; x += step) {
        g.lineTo(x, waterY + waveHeight(x) - 1);
    }
    g.stroke({ color: lighten(waterColor, 50), alpha: 0.3, width: 2 });

    // Specular sparkles
    for (let sx = 0; sx < worldW; sx += 40 + Math.random() * 60) {
        const sparkleY = waterY + waveHeight(sx);
        const sparkleAlpha = Math.max(0, Math.sin(time * 3 + sx * 0.1)) * 0.4;
        g.circle(sx, sparkleY, 1.5);
        g.fill({ color: 0xffffff, alpha: sparkleAlpha });
    }
}
```

**CRITICAL:** Redraw water surface every frame. Use `g.clear()` at start.

- **Complexity:** O(worldW / step) per frame. 60fps: YES
- **Visual impact:** HIGH -- dynamic, beautiful water
- **Implementation difficulty:** LOW

### 5.2 Lava with Noise-Based Bubbling

```typescript
function drawLavaSurface(g: Graphics, worldW: number, lavaY: number,
    lavaH: number, time: number) {

    g.clear();

    // Slow undulating surface
    function lavaWave(x: number): number {
        return Math.sin(x * 0.015 + time * 0.5) * 6
             + Math.sin(x * 0.04 + time * 0.8) * 3;
    }

    // Body
    g.moveTo(0, lavaY + lavaWave(0));
    for (let x = 4; x <= worldW; x += 4) {
        g.lineTo(x, lavaY + lavaWave(x));
    }
    g.lineTo(worldW, lavaY + lavaH);
    g.lineTo(0, lavaY + lavaH);
    g.closePath();
    g.fill(0x880000);

    // Bright crust cracks
    for (let cx = 0; cx < worldW; cx += 20 + noise1D(cx * 0.05 + time) * 40) {
        const crackY = lavaY + lavaWave(cx) + 3;
        g.moveTo(cx, crackY);
        g.lineTo(cx + 8 + noise1D(cx * 0.1) * 15, crackY + 2);
        g.lineTo(cx + 20 + noise1D(cx * 0.07) * 10, crackY - 1);
        g.stroke({ color: 0xff6600, alpha: 0.5 + noise1D(cx * 0.02 + time) * 0.4, width: 2 });
    }

    // Bubbles (animated circles that appear and pop)
    for (let bx = 0; bx < worldW; bx += 50 + noise1D(bx * 0.03) * 80) {
        const bubblePhase = (time * 0.5 + noise1D(bx * 0.1)) % 1;
        if (bubblePhase < 0.3) {
            const br = bubblePhase * 20;
            const by = lavaY + lavaWave(bx) + 5 - bubblePhase * 10;
            g.circle(bx, by, br);
            g.fill({ color: 0xff4400, alpha: 0.4 * (1 - bubblePhase / 0.3) });
        }
    }
}
```

- **Complexity:** Similar to water. 60fps: YES
- **Visual impact:** HIGH
- **Implementation difficulty:** LOW

### 5.3 Waterfall (Particle + Mesh Combo)

Combine a static mesh (curved shape) with particle overlay.

```typescript
// Static waterfall shape
function drawWaterfallMesh(g: Graphics, x: number, topY: number,
    bottomY: number, width: number) {
    // Curved water column
    g.moveTo(x - width/2, topY);
    g.bezierCurveTo(x - width/2, topY + (bottomY-topY)*0.3,
                     x - width*0.8, topY + (bottomY-topY)*0.7,
                     x - width/2, bottomY);
    g.lineTo(x + width/2, bottomY);
    g.bezierCurveTo(x + width*0.8, topY + (bottomY-topY)*0.7,
                     x + width/2, topY + (bottomY-topY)*0.3,
                     x + width/2, topY);
    g.closePath();
    g.fill({ color: 0x88ccff, alpha: 0.5 });
}

// Overlay: Proton particle stream for spray
const sprayEmitter = new Proton.Emitter();
sprayEmitter.rate = new Proton.Rate(new Proton.Span(3, 8), 0.02);
sprayEmitter.addInitialize(new Proton.Life(0.5, 1.5));
sprayEmitter.addInitialize(new Proton.Radius(2, 6));
sprayEmitter.addInitialize(new Proton.Position(
    new Proton.LineZone(x - width/2, topY, x + width/2, topY)
));
sprayEmitter.addInitialize(new Proton.Velocity(
    new Proton.Span(3, 8), new Proton.Span(260, 280), 'polar'
));
```

- **Complexity:** Particles: O(active_particles). 60fps: YES (keep < 200 particles)
- **Visual impact:** HIGH
- **Implementation difficulty:** MEDIUM

---

## 6. Procedural Patterns

### 6.1 Voronoi Diagrams (Crystal/Ice/Lava Cracking)

For game use, a simplified nearest-seed Voronoi is sufficient.

**Algorithm:**
```typescript
function drawVoronoiPattern(ctx: CanvasRenderingContext2D,
    width: number, height: number, seedCount: number,
    cellColor: (seedIdx: number) => string,
    edgeColor: string) {

    // Generate random seed points
    const seeds: {x: number, y: number}[] = [];
    for (let i = 0; i < seedCount; i++) {
        seeds.push({ x: Math.random() * width, y: Math.random() * height });
    }

    // For each pixel, find nearest seed (brute force for small grids)
    const imageData = ctx.createImageData(width, height);
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            let minDist = Infinity, minIdx = 0;
            let secondDist = Infinity;
            for (let i = 0; i < seeds.length; i++) {
                const d = Math.hypot(px - seeds[i].x, py - seeds[i].y);
                if (d < minDist) { secondDist = minDist; minDist = d; minIdx = i; }
                else if (d < secondDist) { secondDist = d; }
            }
            // Edge detection: if close to boundary between two cells
            const isEdge = (secondDist - minDist) < 2;
            // Set pixel color based on cell or edge
        }
    }
    ctx.putImageData(imageData, 0, 0);
}
```

**Performance optimization for games:** Render to a Canvas texture once, then use as `PIXI.Sprite.from(canvas)`. For animated Voronoi (lava cracking), only re-render every 5-10 frames.

**Use cases:**
- Crystal: Blue/white cells with bright white edges
- Ice: Pale blue cells with cyan edges
- Lava cracking: Dark red cells with bright orange edges
- Stained glass: Colorful cells with dark edges

- **Complexity:** O(width * height * seedCount) for brute force. Use spatial hash for > 50 seeds. 60fps: Generate once as texture, YES. Per-frame: NO for large areas.
- **Visual impact:** VERY HIGH -- instantly recognizable patterns
- **Implementation difficulty:** MEDIUM

### 6.2 Cellular Automata for Cave Generation

Standard B678/S345678 rule set produces organic caves.

**Algorithm:**
```typescript
function generateCave(width: number, height: number,
    fillProbability: number, iterations: number): boolean[][] {

    // Initialize random grid
    let grid: boolean[][] = [];
    for (let y = 0; y < height; y++) {
        grid[y] = [];
        for (let x = 0; x < width; x++) {
            // Border cells are always walls
            if (x === 0 || x === width-1 || y === 0 || y === height-1) {
                grid[y][x] = true;
            } else {
                grid[y][x] = Math.random() < fillProbability; // ~0.45
            }
        }
    }

    // Iterate cellular automata
    for (let iter = 0; iter < iterations; iter++) {
        const newGrid: boolean[][] = [];
        for (let y = 0; y < height; y++) {
            newGrid[y] = [];
            for (let x = 0; x < width; x++) {
                const neighbors = countAliveNeighbors(grid, x, y);
                if (grid[y][x]) {
                    // Survival: stay alive if >= 3 neighbors
                    newGrid[y][x] = neighbors >= 3;
                } else {
                    // Birth: become alive if >= 6 neighbors
                    newGrid[y][x] = neighbors >= 6;
                }
            }
        }
        grid = newGrid;
    }

    return grid;
}

function countAliveNeighbors(grid: boolean[][], x: number, y: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= grid[0].length || ny < 0 || ny >= grid.length) {
                count++; // Out of bounds = wall
            } else if (grid[ny][nx]) {
                count++;
            }
        }
    }
    return count;
}
```

**Rendering cave tiles with Pixi.js:**
```typescript
// Render each cell as a colored rectangle
for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
        if (grid[y][x]) {
            g.rect(x * tileSize, y * tileSize, tileSize, tileSize);
            g.fill(wallColor);
        }
    }
}
```

**Parameters that converge well:**
- Fill probability: 0.45-0.50
- Iterations: 4-6 (converges by ~5)
- Grid size: 60x40 tiles for a screen-sized cave

- **Complexity:** O(width * height * iterations). One-time generation. 60fps: YES
- **Visual impact:** HIGH -- organic cave shapes, no two alike
- **Implementation difficulty:** LOW
- **Source:** Jeremy Kun's cellular automaton cave generation (HIGH confidence)

### 6.3 Decorative Patterns

**Dot pattern (halftone/stipple):**
```typescript
for (let y = 0; y < height; y += spacing) {
    for (let x = 0; x < width; x += spacing) {
        const offset = (Math.floor(y / spacing) % 2) * (spacing / 2);
        const dotSize = 1 + noise1D((x + offset + y) * 0.01) * 2;
        g.circle(x + offset, y, dotSize);
        g.fill({ color: patternColor, alpha: 0.3 });
    }
}
```

**Checker pattern:**
```typescript
for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
        if ((Math.floor(x/size) + Math.floor(y/size)) % 2 === 0) {
            g.rect(x, y, size, size);
            g.fill(color1);
        }
    }
}
```

- **Complexity:** O(area / spacing^2). 60fps: YES (generate once)
- **Visual impact:** MEDIUM
- **Implementation difficulty:** LOW

---

## 7. Color Theory for Procedural Art

### 7.1 HSL Manipulation Utilities

**Essential conversion functions (ADD to visual helpers):**
```typescript
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
        Math.round(hue2rgb(p, q, h + 1/3) * 255),
        Math.round(hue2rgb(p, q, h) * 255),
        Math.round(hue2rgb(p, q, h - 1/3) * 255),
    ];
}

function hexToHsl(hex: number): [number, number, number] {
    return rgbToHsl((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function hslToHex(h: number, s: number, l: number): number {
    const [r, g, b] = hslToRgb(h, s, l);
    return (r << 16) | (g << 8) | b;
}
```

### 7.2 Harmonious Palette Generation

**Golden ratio hue distribution (best for procedural):**
```typescript
function generateGoldenRatioPalette(baseHue: number, count: number,
    saturation: number, lightness: number): number[] {
    const goldenRatio = 0.618033988749895;
    const colors: number[] = [];
    let hue = baseHue;

    for (let i = 0; i < count; i++) {
        colors.push(hslToHex(hue, saturation, lightness));
        hue = (hue + goldenRatio) % 1.0;
    }
    return colors;
}
```

**Standard harmony schemes:**
```typescript
function complementary(baseHue: number): number[] {
    return [baseHue, (baseHue + 0.5) % 1.0];
}

function analogous(baseHue: number, spread: number = 1/12): number[] {
    return [
        (baseHue - spread + 1) % 1.0,
        baseHue,
        (baseHue + spread) % 1.0,
    ];
}

function triadic(baseHue: number): number[] {
    return [baseHue, (baseHue + 1/3) % 1.0, (baseHue + 2/3) % 1.0];
}

function splitComplementary(baseHue: number): number[] {
    return [baseHue, (baseHue + 5/12) % 1.0, (baseHue + 7/12) % 1.0];
}

// Generate a full game palette from a single base hue
function generateGamePalette(baseHue: number): ColorPalette {
    const skyH = baseHue;
    const groundH = (baseHue + 0.33) % 1.0;
    const accentH = (baseHue + 0.5) % 1.0;

    return {
        skyTop: hslToHex(skyH, 0.6, 0.1),
        skyBottom: hslToHex(skyH, 0.5, 0.4),
        ground: hslToHex(groundH, 0.4, 0.3),
        groundTop: hslToHex(groundH, 0.5, 0.4),
        platform: hslToHex(groundH, 0.3, 0.25),
        player: hslToHex(accentH, 0.7, 0.55),
        enemy: hslToHex((accentH + 0.15) % 1.0, 0.6, 0.45),
        coin: hslToHex(0.13, 0.9, 0.55), // always golden
        // ...
    };
}
```

### 7.3 Making Procedural Art Feel "Designed"

**Key principles:**
1. **Limit the palette:** 3-5 hues max. Use saturation/lightness variation within those hues.
2. **Temperature gradient:** Warm in foreground (oranges, yellows), cool in background (blues, purples).
3. **Value contrast:** Player and interactables should have highest contrast against background.
4. **Saturation depth:** Desaturate distant layers (aerial perspective).
5. **Accent color rule:** Use one high-saturation color for focal points (coins, UI, hazards). Everything else is muted.

```typescript
// Atmospheric perspective: desaturate and lighten distant layers
function applyDepthDesaturation(color: number, depth: number /* 0=near, 1=far */): number {
    const [h, s, l] = hexToHsl(color);
    return hslToHex(
        h,
        s * (1 - depth * 0.6),        // reduce saturation with depth
        l + (1 - l) * depth * 0.3      // lighten with depth (fog effect)
    );
}
```

- **Complexity:** O(1) per color computation. 60fps: YES
- **Visual impact:** VERY HIGH -- the single biggest factor in "professional vs amateur" look
- **Implementation difficulty:** LOW (just math)
- **Source:** Shahriar Shahrabi's procedural color algorithm, Martin Ankerl golden ratio colors (MEDIUM confidence)

---

## 8. Polish Techniques

### 8.1 Outline/Glow for Readability

**Approach A: pixi-filters OutlineFilter:**
```typescript
import { OutlineFilter } from 'pixi-filters';

// Thick outline for player/interactables readability
player.filters = [new OutlineFilter({
    thickness: 2,
    color: 0x000000,
    quality: 0.5, // 0.1 to 1.0, lower = faster
})];
```

**Approach B: pixi-filters GlowFilter:**
```typescript
import { GlowFilter } from 'pixi-filters';

// Glow for collectibles/hazards
coin.filters = [new GlowFilter({
    distance: 10,
    outerStrength: 2,
    innerStrength: 0,
    color: 0xffdd00,
    quality: 0.3,
})];
```

**Approach C: Manual outline (no filters dependency):**
```typescript
// Draw the same shape slightly larger behind in outline color
function drawWithOutline(g: Graphics, drawFn: () => void,
    outlineColor: number, outlineWidth: number) {
    // Draw outline at offsets
    const offsets = [[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1],[-1,0],[1,0]];
    for (const [dx, dy] of offsets) {
        g.setTransform(dx * outlineWidth, dy * outlineWidth);
        drawFn(); // draw in outline color
    }
    g.setTransform(0, 0);
    drawFn(); // draw in normal color on top
}
```

- **Complexity:** Filter: GPU shader. Manual: 8x draw overhead. 60fps: YES (both)
- **Visual impact:** HIGH -- essential for gameplay readability
- **Implementation difficulty:** LOW

### 8.2 Subtle Animation (Breathing, Bobbing, Pulsing)

**Breathing (scale oscillation):**
```typescript
sprite.scale.set(
    baseScale + Math.sin(time * 2) * 0.02,
    baseScale + Math.sin(time * 2) * 0.03
);
```

**Bobbing (vertical float):**
```typescript
sprite.y = baseY + Math.sin(time * 1.5 + sprite.x * 0.01) * 3;
```

**Pulsing glow (alpha oscillation on glow):**
```typescript
// If using GlowFilter:
glowFilter.outerStrength = 1.5 + Math.sin(time * 3) * 0.5;

// If using alpha:
sprite.alpha = 0.7 + Math.sin(time * 2.5) * 0.3;
```

**Squash & stretch (on land/impact):**
```typescript
function squashAndStretch(sprite: any, t: number /* 0-1 */) {
    // t=0: normal, t goes through squash then back
    const squash = 1 + Math.sin(t * Math.PI) * 0.2;
    sprite.scale.x = 1 / squash;  // compress horizontally
    sprite.scale.y = squash;       // stretch vertically
}
```

- **Complexity:** O(1) per animated object. 60fps: YES
- **Visual impact:** MEDIUM-HIGH -- brings static scenes to life
- **Implementation difficulty:** LOW

### 8.3 Juice Effects

**Screen shake:**
```typescript
function screenShake(camera: Camera2D, intensity: number, duration: number) {
    const startTime = performance.now();
    const originalOffset = { x: camera.offsetX, y: camera.offsetY };

    function shakeFrame() {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed >= duration) {
            camera.offsetX = originalOffset.x;
            camera.offsetY = originalOffset.y;
            return;
        }
        const decay = 1 - elapsed / duration; // linear decay
        const shakeX = (Math.random() - 0.5) * 2 * intensity * decay;
        const shakeY = (Math.random() - 0.5) * 2 * intensity * decay;
        camera.offsetX = originalOffset.x + shakeX;
        camera.offsetY = originalOffset.y + shakeY;
        requestAnimationFrame(shakeFrame);
    }
    shakeFrame();
}

// Usage:
screenShake(engine.camera, 8, 0.2); // 8px intensity, 0.2s duration
```

**Hit freeze (frame pause):**
```typescript
function hitFreeze(engine: Engine2D, durationMs: number) {
    engine._paused = true;
    setTimeout(() => { engine._paused = false; }, durationMs);
}
// Usage: hitFreeze(engine, 50); // 50ms freeze on impact
```

**Impact particles:**
```typescript
function spawnImpactParticles(proton: any, x: number, y: number,
    color: string, count: number) {
    const emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(count, 0);
    emitter.addInitialize(new Proton.Life(0.2, 0.5));
    emitter.addInitialize(new Proton.Radius(2, 6));
    emitter.addInitialize(new Proton.Velocity(
        new Proton.Span(3, 8), new Proton.Span(0, 360), 'polar'
    ));
    emitter.addBehaviour(new Proton.Scale(1, 0));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Color(color));
    emitter.addBehaviour(new Proton.Gravity(3));
    emitter.p.x = x;
    emitter.p.y = y;
    emitter.emit('once');
    proton.addEmitter(emitter);

    // Auto-cleanup
    setTimeout(() => {
        emitter.stop();
        proton.removeEmitter(emitter);
    }, 600);
}
```

- **Complexity:** O(1) for shake/freeze, O(particles) for impact. 60fps: YES
- **Visual impact:** VERY HIGH -- the difference between "feels good" and "feels flat"
- **Implementation difficulty:** LOW

### 8.4 Post-Processing Stack

**Recommended filter stack for polished 2D games:**

```typescript
function applyPostProcessing(stage: Container, options: {
    bloom?: boolean,
    vignette?: boolean,
    colorGrade?: boolean,
    crt?: boolean,
}) {
    const filters: Filter[] = [];

    if (options.bloom) {
        // Subtle bloom on bright elements
        filters.push(new AdvancedBloomFilter({
            threshold: 0.6,
            bloomScale: 0.4,
            brightness: 1.0,
            blur: 4,
            quality: 4,
        }));
    }

    if (options.vignette) {
        // Darken edges via ColorMatrixFilter
        // Or use a pre-baked radial gradient overlay
        const vignette = new PIXI.Graphics();
        const vigGrad = new PIXI.FillGradient({
            type: 'radial',
            center: { x: 0.5, y: 0.5 },
            innerRadius: 0.3,
            outerRadius: 0.7,
            colorStops: [
                { offset: 0, color: 'rgba(0,0,0,0)' },
                { offset: 1, color: 'rgba(0,0,0,0.4)' },
            ],
        });
        vignette.rect(0, 0, screenW, screenH);
        vignette.fill(vigGrad);
        // Add to UI layer (fixed position)
    }

    if (options.colorGrade) {
        const cm = new PIXI.ColorMatrixFilter();
        cm.contrast(0.1, false);
        cm.saturate(0.1, false);
        filters.push(cm);
    }

    if (options.crt) {
        // Retro CRT effect
        filters.push(new CRTFilter({
            curvature: 3,
            lineWidth: 1,
            lineContrast: 0.1,
            noise: 0.1,
            noiseSize: 1,
            vignetting: 0.2,
            seed: Math.random(),
        }));
    }

    stage.filters = filters;
}
```

**Performance budget for filters:**
- 1 BlurFilter: ~0.5ms GPU
- 1 ColorMatrixFilter: ~0.1ms GPU
- 1 AdvancedBloomFilter: ~1ms GPU
- 1 DisplacementFilter: ~0.3ms GPU
- Total budget at 60fps: ~16ms. Keep filters under 3ms total.

- **Complexity:** All GPU shaders. 60fps: YES (with budget limits above)
- **Visual impact:** VERY HIGH -- transforms the entire visual feel
- **Implementation difficulty:** LOW (just configure existing filters)

---

## Available Pixi.js v8 Graphics API Methods

For reference, verified methods available in Pixi.js v8:

### Drawing Methods
| Method | Purpose |
|--------|---------|
| `rect(x, y, w, h)` | Rectangle |
| `roundRect(x, y, w, h, radius)` | Rounded rectangle |
| `circle(x, y, r)` | Circle |
| `ellipse(x, y, rx, ry)` | Ellipse |
| `arc(x, y, r, start, end)` | Arc |
| `moveTo(x, y)` | Move pen |
| `lineTo(x, y)` | Line to point |
| `bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)` | Cubic bezier |
| `quadraticCurveTo(cpx, cpy, x, y)` | Quadratic bezier |
| `closePath()` | Close current path |
| `cut()` | Cut holes in shapes |
| `svg(pathData)` | Load SVG path data |
| `star(x, y, points, radius, innerRadius)` | Star shape |
| `clear()` | Clear all geometry |

### Fill Options
| Type | Example |
|------|---------|
| Solid color | `.fill(0xff0000)` or `.fill('red')` |
| With alpha | `.fill({ color: 0xff0000, alpha: 0.5 })` |
| Linear gradient | `.fill(new FillGradient({ type: 'linear', ... }))` |
| Radial gradient | `.fill(new FillGradient({ type: 'radial', ... }))` |
| Texture | `.fill(texture)` |

### Stroke Options
| Type | Example |
|------|---------|
| Basic | `.stroke({ color: 0x000000, width: 2 })` |
| With alpha | `.stroke({ color: 0x000000, width: 2, alpha: 0.5 })` |

Source: Official Pixi.js v8 documentation (HIGH confidence)

---

## Available Pixi.js Community Filters

Relevant filters for procedural art (from pixi-filters package):

| Filter | Use Case | GPU Cost |
|--------|----------|----------|
| AdvancedBloomFilter | Glow on bright elements | Medium |
| GodrayFilter | Volumetric light beams | Medium |
| GlowFilter | Object outline glow | Low-Medium |
| OutlineFilter | Solid outline for readability | Low |
| DropShadowFilter | Drop shadows | Low |
| ShockwaveFilter | Expanding wave distortion | Low |
| DisplacementFilter | Heat shimmer, underwater | Low |
| ColorMatrixFilter | Color grading, day/night | Very Low |
| BlurFilter | Fog softening, depth of field | Low-Medium |
| CRTFilter | Retro TV effect | Low |
| AdjustmentFilter | Brightness/contrast/saturation | Very Low |
| HslAdjustmentFilter | HSL color adjustment | Very Low |
| MotionBlurFilter | Speed lines effect | Medium |
| ReflectionFilter | Water reflections | Medium |
| SimplexNoiseFilter | Procedural noise overlay | Low |

Source: pixi-filters official documentation (HIGH confidence)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Noise functions | Custom Perlin/Simplex | Existing `noise1D`/`fbm` in codebase, or `simplex-noise` npm package | Edge cases, performance optimization already done |
| Gaussian blur | Manual convolution | `PIXI.BlurFilter` | GPU-accelerated, handles edge cases |
| Color grading | Per-pixel manipulation | `PIXI.ColorMatrixFilter` | GPU shader, handles all edge cases |
| Particle effects | Custom particle system | Proton.js (already integrated) | Life management, physics, renderers all handled |
| Gradient fills | Canvas 2D fallback strips | `PIXI.FillGradient` (v8 native) | GPU-rendered, smooth, memory efficient |
| God rays | Triangle fan overlays | `GodrayFilter` from pixi-filters | Animated, configurable, GPU-accelerated |
| Displacement/shimmer | Manual pixel shifting | `PIXI.DisplacementFilter` | GPU shader, smooth, performant |
| Outline effects | 8-direction redraw | `OutlineFilter` from pixi-filters | Cleaner, faster, configurable |

---

## Common Pitfalls

### Pitfall 1: Regenerating Procedural Content Every Frame
**What goes wrong:** Calling `drawMountainRange()` or `drawTree()` inside the update loop destroys framerate.
**Why it happens:** Graphics primitives are expensive to build. The GPU cost is in geometry upload, not rendering.
**How to avoid:** Generate procedural content ONCE during scene setup, cache as Container or Sprite. Only redraw things that actually animate (water surface, particles).
**Warning signs:** FPS drops when more procedural objects are on screen.

### Pitfall 2: Too Many Filters
**What goes wrong:** Stacking 4+ filters drops FPS below 30.
**Why it happens:** Each filter requires a full-screen render-to-texture pass.
**How to avoid:** Maximum 2-3 filters on any single container. Use a single ColorMatrixFilter instead of separate brightness + contrast + saturation filters. Profile with `app.ticker.FPS`.
**Warning signs:** FPS drop that scales with screen resolution.

### Pitfall 3: Noise Without Seeding
**What goes wrong:** Terrain looks different every reload, breaking reproducibility.
**Why it happens:** Using `Math.random()` instead of seeded noise.
**How to avoid:** Always use the existing `setNoiseSeed()` + `noise1D()`/`fbm()` functions. Pass seed from the game's seed system.
**Warning signs:** "My terrain was different when I reloaded."

### Pitfall 4: Graphics Object Bloat
**What goes wrong:** Memory usage grows as Graphics objects accumulate geometry.
**Why it happens:** Never calling `.clear()` on redrawn Graphics, or creating new Graphics objects without destroying old ones.
**How to avoid:** For animated procedural content (water), reuse one Graphics object with `.clear()` each frame. For static content, generate once and cache.
**Warning signs:** Memory usage climbing over time, eventual browser tab crash.

### Pitfall 5: Overly Uniform Procedural Art
**What goes wrong:** Everything looks computer-generated and sterile.
**Why it happens:** Using pure math without deliberate imperfection.
**How to avoid:** Add controlled randomness to every parameter: size +/- 15%, color +/- 10%, position +/- 5px, rotation +/- 5 degrees. The "designed not random" feel comes from constraining the randomness within harmonious bounds, not eliminating it.
**Warning signs:** All trees look identical, platforms are perfectly spaced.

### Pitfall 6: Ignoring Render Order for Depth
**What goes wrong:** Foreground objects appear behind background objects.
**Why it happens:** Adding children to container in arbitrary order.
**How to avoid:** Use explicit z-ordering: sky (first) -> distant mountains -> near mountains -> ground -> platforms -> entities -> foreground foliage -> UI. Use `container.sortableChildren = true` and `sprite.zIndex` for dynamic sorting.
**Warning signs:** Visual glitches where near objects disappear behind far objects.

---

## Performance Budget Reference

Target: **60 FPS** (16.67ms per frame) in browser

| Category | Budget | Notes |
|----------|--------|-------|
| JavaScript logic | 4ms | Physics, AI, input |
| Procedural animation | 2ms | Water redraw, sway, bobbing |
| Particle update | 1ms | Proton.update() |
| GPU filters | 3ms | Max 2-3 filters |
| GPU rendering | 6ms | Draw calls, texture uploads |
| **Total** | **16ms** | Headroom for GC pauses |

**Rules of thumb:**
- Graphics.clear() + redraw: ~0.1ms for simple shapes, ~1ms for complex terrain profile
- Canvas 2D texture generation: 1-5ms per sprite (do once, cache)
- Proton particles: ~0.5ms per 100 active particles
- Filter pass: 0.1-1.5ms each depending on filter type and resolution

---

## Existing Codebase Assets (DO NOT DUPLICATE)

The Vibexe 2D engine already provides these in `game-2d-templates.ts`:

| Function | What It Does |
|----------|--------------|
| `noise1D(x)` | 1D value noise with smoothstep |
| `fbm(x, octaves, persistence, lacunarity, exponent)` | Fractal Brownian Motion |
| `setNoiseSeed(s)` | Set noise seed for reproducibility |
| `drawSkyGradient()` | Full sky with light rays |
| `drawStars()` | Randomized star field with sparkles |
| `drawMountainRange()` | Theme-driven noise-based mountain silhouettes |
| `drawCloud()` | Puffy volumetric cloud |
| `drawTree()` | 3D-shaded tree with trunk and canopy |
| `drawGroundStrip()` | Multi-layer ground with theme-specific details |
| `_drawPlayerCanvas()` | Canvas 2D player character |
| `_drawCoinCanvas()` | Canvas 2D coin with glow |
| `_drawSlimeCanvas()` | Canvas 2D slime enemy |
| `_drawPlatformCanvas()` | Canvas 2D platform with grass |
| `makeLinearGradient()` | FillGradient wrapper with fallback |
| `makeRadialGradient()` | FillGradient wrapper with fallback |
| `lerpColor()` / `darken()` / `lighten()` | Color utilities |
| `PALETTES` | 8 theme color palettes |
| `MOUNTAIN_PROFILES` | Per-theme noise parameters |

All new techniques should integrate with these existing functions, not replace them.

---

## Sources

### Primary (HIGH confidence)
- [Pixi.js v8 Graphics API](https://pixijs.com/8.x/guides/components/scene-objects/graphics) -- official docs, verified methods
- [Pixi.js v8 Graphics Fill](https://pixijs.com/8.x/guides/components/scene-objects/graphics/graphics-fill) -- FillGradient API, verified
- [Pixi.js v8 Filters](https://pixijs.com/8.x/guides/components/filters) -- built-in filters, verified
- [pixi-filters documentation](https://pixijs.io/filters/docs/) -- community filters catalog, verified
- [Red Blob Games: Making maps with noise](https://www.redblobgames.com/maps/terrain-from-noise/) -- terrain noise techniques
- [Jeremy Kun: Cellular Automaton Cave Generation](https://www.jeremykun.com/2012/07/29/the-cellular-automaton-method-for-cave-generation/) -- cave algorithm
- [Wikipedia: L-system](https://en.wikipedia.org/wiki/L-system) -- L-system rules and interpretation

### Secondary (MEDIUM confidence)
- [gpfault.net: Generating Trees](https://gpfault.net/posts/generating-trees.txt.html) -- L-system implementation details
- [Martin Ankerl: Random Colors Programmatically](https://martin.ankerl.com/2009/12/09/how-to-create-random-colors-programmatically/) -- golden ratio color distribution
- [Shahriar Shahrabi: Procedural Color Algorithm](https://shahriyarshahrabi.medium.com/procedural-color-algorithm-a37739f6dc1) -- Gurney-based color harmony
- [Voronoi Diagrams in Game Development](https://www.gamegeniuslab.com/tutorial-post/voronoi-diagrams-in-game-development-procedural-maps-ai-territories-stylish-effects/) -- game-oriented Voronoi

### Tertiary (LOW confidence)
- [Terraria-style generation forum discussions](https://gamedev.net/forums/topic/630940-how-to-use-perlin-noise-in-terrain-generation/) -- community patterns, not officially documented
- [Game juice best practices](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design) -- general game design advice
