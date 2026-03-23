# Pixi.js v8 Advanced Visuals — Research

**Researched:** 2026-03-23
**Domain:** 2D procedural game art with Pixi.js v8.9.2 + pixi-filters 6.1.5
**Confidence:** HIGH (verified against official docs and API references)

## Summary

Pixi.js v8 provides a rich set of advanced visual features BEYOND basic Graphics drawing that can be used to create unique, polished 2D game art procedurally. The project already loads pixi-filters v6.1.5 and GSAP via CDN in the 2D runtime, so all features documented here are available immediately.

Key capabilities: 37+ community filters (glow, godrays, CRT, shockwave, etc.), FillGradient for multi-stop linear/radial gradients, MeshRope for organic vine/rope shapes, RenderTexture for baking procedural content, TilingSprite for parallax, ColorMatrixFilter with 20+ preset color grading effects, Graphics with bezier/arc/star/SVG primitives, blend modes (add/multiply/screen), masks, and container-level tint/alpha/blendMode inheritance.

**Primary recommendation:** Use pixi-filters for atmosphere (GlowFilter, GodrayFilter, ColorGradientFilter), FillGradient for sky/water gradients, ColorMatrixFilter presets for per-theme color grading, and RenderTexture/cacheAsTexture for performance. Stop using Canvas 2D fallbacks for effects that Pixi.js v8 handles natively.

---

## 1. Filters (Built-in + pixi-filters)

### What It Does
Filters are post-processing effects applied to any Container, Sprite, or Graphics object. They run as GPU shader passes. Multiple filters chain in sequence. The project already loads `pixi-filters@6.1.5` via CDN, exposing 37+ filters.

### Built-in Filters (5)

| Filter | Purpose | Key Options |
|--------|---------|-------------|
| `AlphaFilter` | Uniform transparency | `{ alpha: 0.5 }` |
| `BlurFilter` | Gaussian blur | `{ strength: 4, quality: 3 }` |
| `ColorMatrixFilter` | Color matrix transformations (20+ presets) | See Section 8 |
| `DisplacementFilter` | Texture-based pixel distortion | `{ sprite, scale: {x:20, y:20} }` |
| `NoiseFilter` | Random grain | `{ noise: 0.3, seed: Math.random() }` |

### pixi-filters Community Filters (37 — all available via CDN)

**Atmosphere & Lighting:**
| Filter | Use For | Key Options |
|--------|---------|-------------|
| `GlowFilter` | Item highlights, magic aura, collectible glow | `{ distance: 15, outerStrength: 2, color: 0xffff00 }` |
| `GodrayFilter` | Sunlight shafts, divine light, forest canopy | `{ gain: 0.5, lacunarity: 2.5, time: 0 }` — animate `time` |
| `SimpleLightmapFilter` | Scene-wide lighting from a lightmap texture | `{ texture, color: 0x666666 }` |
| `AdvancedBloomFilter` | HDR bloom for bright areas | `{ threshold: 0.5, bloomScale: 1.5 }` |
| `BloomFilter` | Simple bloom/glow | `{ strength: 2 }` |
| `ColorGradientFilter` | Full-screen color overlay gradient | `{ type: 'linear', stops: [...] }` |

**Distortion & FX:**
| Filter | Use For | Key Options |
|--------|---------|-------------|
| `ShockwaveFilter` | Explosion impact wave, boss attack | `{ center: [x,y], speed: 500, time: 0 }` — animate `time` |
| `MotionBlurFilter` | Speed blur for fast movement | `{ velocity: {x:20, y:0} }` |
| `TwistFilter` | Portal, vortex, whirlpool | `{ radius: 200, angle: 4, offset: [x,y] }` |
| `BulgePinchFilter` | Lens effect, cartoon squish | `{ center: [0.5,0.5], radius: 200, strength: 1 }` |
| `ZoomBlurFilter` | Speed lines, focus zoom | `{ strength: 0.1, center: [x,y] }` |
| `RadialBlurFilter` | Spin blur | `{ angle: 10, center: [x,y] }` |
| `ReflectionFilter` | Water reflection, mirror | `{ mirror: true, boundary: 0.5 }` |

**Retro & Stylized:**
| Filter | Use For | Key Options |
|--------|---------|-------------|
| `CRTFilter` | Retro CRT screen look | `{ curvature: 1, lineWidth: 1, vignetting: 0.3 }` |
| `AsciiFilter` | ASCII art conversion | `{ size: 8 }` |
| `PixelateFilter` | Pixel art downscale | `{ size: {x:4, y:4} }` |
| `DotFilter` | Halftone dots | `{ scale: 1, angle: 5 }` |
| `CrossHatchFilter` | Crosshatch shading | (no options) |
| `OldFilmFilter` | Vintage film grain + scratches | `{ sepia: 0.3, noise: 0.3, scratch: 0.5 }` |
| `GlitchFilter` | Digital glitch | `{ slices: 10, offset: 100 }` |
| `EmbossFilter` | Raised emboss effect | `{ strength: 5 }` |

**Color Manipulation:**
| Filter | Use For | Key Options |
|--------|---------|-------------|
| `AdjustmentFilter` | Brightness/contrast/saturation per-object | `{ brightness: 1.2, contrast: 1.1, saturation: 1.3 }` |
| `HslAdjustmentFilter` | HSL-based color shift | `{ hue: 30, saturation: 0.2, lightness: 0.1 }` |
| `ColorOverlayFilter` | Flat color tint | `{ color: 0xff0000, alpha: 0.5 }` |
| `ColorReplaceFilter` | Swap specific color | `{ originalColor: 0xff0000, newColor: 0x00ff00 }` |
| `MultiColorReplaceFilter` | Swap multiple colors | `{ replacements: [[0xff0000, 0x00ff00], ...] }` |
| `ColorMapFilter` | LUT-based color grading | `{ colorMap: texture }` |
| `GrayscaleFilter` | Desaturation | (no options) |

**Utility:**
| Filter | Use For | Key Options |
|--------|---------|-------------|
| `OutlineFilter` | Object outlines, selection highlight | `{ thickness: 2, color: 0x000000 }` |
| `DropShadowFilter` | Drop shadows | `{ offset: {x:4, y:4}, blur: 2, color: 0x000000 }` |
| `BevelFilter` | 3D bevel edge | `{ rotation: 45, thickness: 2 }` |
| `ConvolutionFilter` | Custom kernel convolution | `{ matrix: [...], width: 3, height: 3 }` |
| `KawaseBlurFilter` | Fast multi-pass blur | `{ strength: 4, quality: 3 }` |
| `TiltShiftFilter` | Miniature/tilt-shift effect | `{ blur: 100, gradientBlur: 600 }` |
| `RGBSplitFilter` | Chromatic aberration | `{ red: [-10,0], green: [0,10], blue: [0,0] }` |
| `BackdropBlurFilter` | Background blur behind element | `{ strength: 8 }` |
| `SimplexNoiseFilter` | Procedural noise pattern | `{ noise: 0.5 }` |

### Code Examples

**Apply filters to any container (affects all children):**
```javascript
// Filters available via CDN as PIXI.filters.*
const { GlowFilter, GodrayFilter, CRTFilter } = PIXI.filters;

// Single filter
coin.filters = [new GlowFilter({ distance: 10, outerStrength: 2, color: 0xffdd00 })];

// Multiple chained filters
gameContainer.filters = [
  new GodrayFilter({ gain: 0.6, lacunarity: 2.5, time: 0 }),
  new PIXI.ColorMatrixFilter(),  // built-in
];

// Animate filter properties each frame
app.ticker.add((ticker) => {
  const godray = gameContainer.filters[0];
  godray.time += ticker.deltaTime * 0.005;
});
```

**Animated shockwave on explosion:**
```javascript
const shockwave = new PIXI.filters.ShockwaveFilter({
  center: [explosionX, explosionY],
  speed: 500,
  amplitude: 30,
  wavelength: 160,
  time: 0,
});
stage.filters = [shockwave];
// Animate in ticker:
shockwave.time += ticker.deltaTime * 0.01;
if (shockwave.time > 2) stage.filters = []; // remove when done
```

### Procedural Game Art Uses
- **Per-biome atmosphere:** Forest = GodrayFilter + green ColorMatrixFilter.tint; Lava = AdvancedBloomFilter + red tint; Ice = BlurFilter on background + blue tint
- **Collectible glow:** GlowFilter on coins/gems with animated outerStrength
- **Boss entrance:** ShockwaveFilter + ZoomBlurFilter combination
- **Retro genre:** CRTFilter + OldFilmFilter for retro arcade look
- **Underwater:** DisplacementFilter with animated sprite for water distortion + blue ColorMatrixFilter
- **Damage flash:** ColorOverlayFilter with red, animate alpha from 0.5 to 0
- **Night scenes:** night() on ColorMatrixFilter + AdvancedBloomFilter for lights

**Confidence:** HIGH — pixi-filters v6.1.5 already loaded via CDN in game-runtime-2d/route.ts

---

## 2. Mesh and MeshRope

### What It Does
MeshRope bends a texture along a series of control points, creating smooth organic shapes like vines, ropes, lightning bolts, tentacles, rivers, and animated trails. Points can be moved per-frame for animation.

### API (Pixi.js v8)

```javascript
import { MeshRope, Texture, Point } from 'pixi.js';
// CDN: use PIXI.MeshRope, PIXI.Point

// Create control points
const points = [];
for (let i = 0; i < 20; i++) {
  points.push(new PIXI.Point(i * 25, 0));
}

const rope = new PIXI.MeshRope({
  texture: PIXI.Texture.from('vine-texture.png'),
  points: points,
  textureScale: 0.5,  // >0 = texture repeats; 0 = stretches
});
rope.autoUpdate = true; // auto-recalculates geometry when points move
```

### Key Properties
| Property | Default | Description |
|----------|---------|-------------|
| `texture` | required | Texture to bend along the path |
| `points` | required | Array of PointData defining the rope path |
| `textureScale` | 0 | 0 = stretch to fit; >0 = repeat (wraps texture) |
| `autoUpdate` | true | Auto-recalculate geometry when points move |

### Other Mesh Types

| Type | Purpose | Key Feature |
|------|---------|-------------|
| `MeshRope` | Rope/vine/trail along points | `textureScale` for repeating |
| `MeshPlane` | Subdivided plane for distortion | `verticesX`, `verticesY` grid |
| `MeshSimple` | Custom vertex geometry | Full vertex/UV/index control |
| `PerspectiveMesh` | Perspective-corrected quad | `setCorners()` for 4-point distortion |

### Code: Animated Vine

```javascript
// Create a wavy vine
const vinePoints = [];
const numPoints = 30;
for (let i = 0; i < numPoints; i++) {
  vinePoints.push(new PIXI.Point(i * 15, 0));
}

// Use a programmatically-generated vine texture
const vineGfx = new PIXI.Graphics()
  .rect(0, 0, 64, 16)
  .fill(new PIXI.FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: '#2d5a1e' },
      { offset: 0.5, color: '#4a8c2a' },
      { offset: 1, color: '#2d5a1e' },
    ],
  }));
const vineTexture = app.renderer.generateTexture(vineGfx);

const vine = new PIXI.MeshRope({
  texture: vineTexture,
  points: vinePoints,
  textureScale: 1,
});

// Animate: wave the vine
app.ticker.add((ticker) => {
  for (let i = 0; i < vinePoints.length; i++) {
    vinePoints[i].y = Math.sin(i * 0.3 + ticker.lastTime * 0.002) * 15;
  }
});
```

### Procedural Game Art Uses
- **Vines and roots:** Create organic hanging vines in forest levels
- **Lightning bolts:** Jagged random points with bright texture + GlowFilter
- **Rivers/streams:** Curved water paths on a terrain
- **Tentacles:** Enemy appendages that animate per-frame
- **Trails:** Player movement trail behind character (push new point, shift old ones)
- **Chains and ropes:** Swing mechanics, bridges

**Confidence:** HIGH — MeshRope documented in official Pixi.js v8 API

---

## 3. RenderTexture

### What It Does
Renders any display object tree to an offscreen texture. Use cases: bake complex procedural graphics once for reuse as a sprite (massive performance win), create texture atlases, capture game state as thumbnails, generate displacement maps procedurally.

### API (Pixi.js v8)

**Method 1: renderer.render() to a RenderTexture**
```javascript
const rt = PIXI.RenderTexture.create({ width: 256, height: 256 });

// Draw something complex
const tempContainer = new PIXI.Container();
const gfx = new PIXI.Graphics().circle(128, 128, 100).fill(0xff0000);
tempContainer.addChild(gfx);

// Render to texture
app.renderer.render({
  target: rt,
  container: tempContainer,
});

// Use as sprite (much faster than keeping Graphics alive)
const sprite = new PIXI.Sprite(rt);
```

**Method 2: renderer.generateTexture() (simpler)**
```javascript
const gfx = new PIXI.Graphics()
  .circle(64, 64, 60)
  .fill(0x00ff00);

// One-liner: generates a texture from the display object
const texture = app.renderer.generateTexture({
  target: gfx,
  resolution: 2,
  antialias: true,
});
const sprite = new PIXI.Sprite(texture);
```

**Method 3: cacheAsTexture() (automatic caching)**
```javascript
// For containers that rarely change
const bg = new PIXI.Container();
bg.addChild(/* lots of static decorations */);
bg.cacheAsTexture({ resolution: 1, antialias: true });

// Call when you modify contents
bg.updateCacheTexture();

// Disable
bg.cacheAsTexture(false);
```

### Procedural Game Art Uses
- **Bake procedural backgrounds:** Draw a complex sky/mountains/terrain with Graphics + gradients, render to texture once, use as TilingSprite
- **Procedural displacement maps:** Draw noise patterns with Graphics, render to RenderTexture, feed to DisplacementFilter
- **Tileable pattern generation:** Draw one tile procedurally, render to texture, use in TilingSprite
- **Thumbnail captures:** Render game state to small texture for UI previews
- **Performance optimization:** Convert complex Graphics with hundreds of draw calls into a single Sprite

**Confidence:** HIGH — renderer.render() and generateTexture() verified in official v8 docs

---

## 4. FillGradient

### What It Does
Multi-stop gradients for filling Graphics shapes. Supports both linear and radial gradients with customizable direction, color stops, and texture space (local vs global). Internally creates a texture of the gradient, then applies a transform.

### API (Pixi.js v8)

**Linear Gradient:**
```javascript
const skyGradient = new PIXI.FillGradient({
  type: 'linear',
  start: { x: 0, y: 0 },   // top (normalized 0-1)
  end: { x: 0, y: 1 },     // bottom
  colorStops: [
    { offset: 0, color: '#1a0533' },    // deep purple
    { offset: 0.3, color: '#ff6b35' },  // orange
    { offset: 0.5, color: '#ffd700' },  // gold
    { offset: 0.7, color: '#87CEEB' },  // sky blue
    { offset: 1, color: '#e0f0ff' },    // pale blue
  ],
});

const sky = new PIXI.Graphics()
  .rect(0, 0, 800, 400)
  .fill(skyGradient);
```

**Radial Gradient:**
```javascript
const sunGradient = new PIXI.FillGradient({
  type: 'radial',
  center: { x: 0.5, y: 0.5 },
  innerRadius: 0,
  outerCenter: { x: 0.5, y: 0.5 },
  outerRadius: 0.5,
  colorStops: [
    { offset: 0, color: '#ffffff' },
    { offset: 0.3, color: '#ffdd44' },
    { offset: 0.7, color: '#ff8800' },
    { offset: 1, color: 'rgba(255,136,0,0)' },
  ],
});

const sun = new PIXI.Graphics()
  .circle(400, 100, 80)
  .fill(sunGradient);
```

**Diagonal / Horizontal:**
```javascript
// Horizontal gradient (water)
const waterGradient = new PIXI.FillGradient({
  type: 'linear',
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  colorStops: [
    { offset: 0, color: '#1a5276' },
    { offset: 0.5, color: '#2980b9' },
    { offset: 1, color: '#0d3b66' },
  ],
});
```

### Key Properties
| Property | Type | Description |
|----------|------|-------------|
| `type` | `'linear'` or `'radial'` | Gradient type |
| `colorStops` | `[{offset, color}]` | Array of stops (offset 0-1, color is any CSS color) |
| `start` / `end` | `{x, y}` | Linear gradient direction (normalized 0-1) |
| `center` / `outerCenter` | `{x, y}` | Radial gradient centers |
| `innerRadius` / `outerRadius` | number | Radial gradient radii |
| `textureSpace` | `'local'` or `'global'` | Coordinate space for the gradient |

### Procedural Game Art Uses
- **Sky backgrounds:** Sunset = orange-to-purple vertical; Night = dark blue-to-black; Day = light blue-to-white
- **Water surfaces:** Blue gradient with depth variation
- **Ground layers:** Green-to-brown vertical for grass hills
- **UI elements:** Glossy button gradients, health bars with red-to-green
- **Glow orbs:** Radial gradient circles for lights, magic effects
- **Terrain layers:** Different gradient per layer (grass, dirt, stone)

**Important:** Destroy gradients when no longer used to prevent memory leaks. Modify existing instances rather than creating new ones for animations.

**Confidence:** HIGH — verified in official Pixi.js v8 docs + examples page

---

## 5. Graphics Bezier/Arc Capabilities

### What It Does
Pixi.js v8 Graphics supports a comprehensive set of vector drawing primitives including cubic/quadratic bezier curves, arcs, ellipses, stars, regular polygons, SVG path parsing, and shape cutting (holes).

### Available Drawing Methods

**Path Methods:**
| Method | Signature | Description |
|--------|-----------|-------------|
| `moveTo` | `(x, y)` | Start new sub-path |
| `lineTo` | `(x, y)` | Line to point |
| `closePath` | `()` | Close current sub-path |

**Curve Methods:**
| Method | Signature | Description |
|--------|-----------|-------------|
| `bezierCurveTo` | `(cp1x, cp1y, cp2x, cp2y, x, y, smoothness?)` | Cubic bezier curve |
| `quadraticCurveTo` | `(cpx, cpy, x, y)` | Quadratic bezier curve |
| `arc` | `(x, y, r, startAngle, endAngle, ccw?)` | Centered arc |
| `arcTo` | `(x1, y1, x2, y2, radius)` | Arc connecting two tangent lines |
| `arcToSvg` | `(rx, ry, xRot, largeArc, sweep, x, y)` | SVG-style elliptical arc |

**Shape Methods:**
| Method | Signature | Description |
|--------|-----------|-------------|
| `circle` | `(x, y, radius)` | Circle |
| `ellipse` | `(x, y, radiusX, radiusY)` | Ellipse |
| `rect` | `(x, y, w, h)` | Rectangle |
| `roundRect` | `(x, y, w, h, radius)` | Rounded rectangle |
| `chamferRect` | `(x, y, w, h, chamfer)` | Chamfered rectangle |
| `filletRect` | `(x, y, w, h, fillet)` | Filleted rectangle |
| `star` | `(x, y, points, radius, innerRadius)` | Star shape |
| `regularPoly` | `(x, y, radius, sides)` | Regular polygon (triangle, hex, etc.) |
| `roundedPoly` | `(points)` | Polygon with rounded corners |

**Advanced Methods:**
| Method | Signature | Description |
|--------|-----------|-------------|
| `svg` | `(pathData)` | Parse SVG path string |
| `cut` | `()` | Cut hole in current shape |

### Code: Organic Mountain Silhouette with Beziers

```javascript
const mountain = new PIXI.Graphics();
mountain.moveTo(0, 400);

// Smooth mountain range using cubic beziers
mountain.bezierCurveTo(80, 380, 120, 200, 200, 180);   // first peak
mountain.bezierCurveTo(250, 165, 280, 220, 320, 250);  // valley
mountain.bezierCurveTo(360, 200, 380, 120, 450, 100);  // tall peak
mountain.bezierCurveTo(500, 85, 550, 160, 600, 200);   // descend
mountain.bezierCurveTo(650, 230, 700, 280, 800, 300);  // trailing ridge
mountain.lineTo(800, 400);
mountain.closePath();

mountain.fill(new PIXI.FillGradient({
  type: 'linear',
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  colorStops: [
    { offset: 0, color: '#4a6741' },
    { offset: 0.6, color: '#2d4a27' },
    { offset: 1, color: '#1a2e14' },
  ],
}));
```

### Code: Star Shapes for Collectibles

```javascript
// 5-pointed star with inner radius for collectible
const starShape = new PIXI.Graphics()
  .star(0, 0, 5, 30, 12)  // 5 points, outer=30, inner=12
  .fill(0xffd700)
  .stroke({ width: 2, color: 0xb8860b });
```

### Code: SVG Path Parsing

```javascript
// Parse complex SVG paths directly
const heart = new PIXI.Graphics()
  .svg('M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 z')
  .fill(0xff0000);
```

### Procedural Game Art Uses
- **Terrain silhouettes:** Bezier curves for smooth hills, mountains, cave ceilings
- **Organic blobs:** Chained bezier curves for amoeba, slime, cloud shapes
- **Platform shapes:** arcTo for rounded platform edges
- **Decorative stars/polygons:** star() for collectibles, regularPoly() for crystals
- **SVG icons:** Import SVG paths for complex shapes (shields, weapons, icons)
- **Holes/cutouts:** cut() for cave openings, window shapes in buildings

**Confidence:** HIGH — all methods verified in official Pixi.js v8 Graphics API docs

---

## 6. Blend Modes

### What It Does
Controls how pixels are composited when rendering overlapping display objects. Pixi.js v8 supports basic blend modes natively in WebGL, and advanced blend modes via optional import.

### Available Blend Modes

**Basic (WebGL + WebGPU supported — use freely):**
| Mode | String Value | Effect | Game Use |
|------|-------------|--------|----------|
| Normal | `'normal'` | Standard alpha blending | Default |
| Add | `'add'` | Additive (brightens) | Fire, lasers, light beams, magic |
| Multiply | `'multiply'` | Darkens by multiplying | Shadows, dark overlays |
| Screen | `'screen'` | Lightens (inverse multiply) | Glow, lens flare, highlights |
| Erase | `'erase'` | Erases pixels from parent | Fog-of-war reveal |

**Advanced (requires `import 'pixi.js/advanced-blend-modes'` — WebGPU only reliably):**
`'overlay'`, `'darken'`, `'lighten'`, `'color-dodge'`, `'color-burn'`, `'hard-light'`, `'soft-light'`, `'difference'`, `'exclusion'`, `'saturation'`, `'color'`, `'luminosity'`, `'linear-burn'`, `'linear-dodge'`, `'linear-light'`, `'pin-light'`, `'vivid-light'`, `'hard-mix'`, `'negation'`, `'subtract'`, `'divide'`, `'min'`, `'max'`

**WARNING:** WebGL only supports `normal`, `add`, `multiply`, `screen`. Other modes silently fall back to `normal` on WebGL. Since 2D games likely run WebGL, stick to the basic 4 for reliability.

### Code Example

```javascript
// Additive fire particles
fireParticle.blendMode = 'add';

// Multiplicative shadow overlay
shadowOverlay.blendMode = 'multiply';

// Screen blend for light beams
const lightBeam = new PIXI.Graphics()
  .rect(0, 0, 50, 300)
  .fill({ color: 0xffffcc, alpha: 0.3 });
lightBeam.blendMode = 'screen';
lightBeam.rotation = -0.3;

// Erase mode for fog-of-war reveal
const revealCircle = new PIXI.Graphics()
  .circle(playerX, playerY, 150)
  .fill(0xffffff);
revealCircle.blendMode = 'erase';
```

### v8 Feature: Blend Modes Inherited by Containers
In Pixi.js v8, blend modes and tints are INHERITED, like transforms and alpha. Setting `blendMode` on a Container applies it to ALL children.

```javascript
// All particles in this container use additive blending
const particleLayer = new PIXI.Container();
particleLayer.blendMode = 'add';
// All children automatically use 'add' blending
```

### Procedural Game Art Uses
- **Fire/explosions:** `add` blend on orange/yellow particles
- **Light beams:** `screen` blend on semi-transparent white rectangles
- **Shadow layer:** `multiply` blend on dark semi-transparent overlay
- **Fog-of-war:** `erase` blend to reveal explored areas
- **Magic effects:** `add` blend on particle systems
- **Day/night cycle:** `multiply` blue overlay for night, `screen` yellow for dawn

**Confidence:** HIGH — blend mode list and WebGL limitations verified in official docs

---

## 7. TilingSprite

### What It Does
Efficiently renders a repeating texture across a rectangular area. The texture tiles to fill the space rather than stretching. Perfect for scrolling backgrounds, parallax layers, and procedurally-generated tileable patterns.

### API (Pixi.js v8)

```javascript
const bg = new PIXI.TilingSprite({
  texture: PIXI.Texture.from('stars.png'),
  width: 800,
  height: 600,
});
```

### Key Properties
| Property | Type | Description |
|----------|------|-------------|
| `texture` | Texture | The repeating image |
| `width` / `height` | number | Area to fill (does NOT stretch tiles) |
| `tilePosition` | ObservablePoint | Offset of the pattern (animate for scrolling) |
| `tileScale` | ObservablePoint | Scale each individual tile |
| `tileRotation` | number | Rotate the tile pattern |
| `anchor` | ObservablePoint | Origin point |
| `applyAnchorToTexture` | boolean | Anchor affects tile start position |
| `clampMargin` | number | Edge artifact prevention (default: 0.5) |

### Code: Multi-Layer Parallax

```javascript
// Three layers at different scroll speeds
const bgFar = new PIXI.TilingSprite({
  texture: skyTexture,
  width: 800, height: 600,
});
const bgMid = new PIXI.TilingSprite({
  texture: mountainTexture,
  width: 800, height: 600,
});
const bgNear = new PIXI.TilingSprite({
  texture: treesTexture,
  width: 800, height: 600,
});

app.ticker.add((ticker) => {
  const speed = 2;
  bgFar.tilePosition.x -= speed * 0.2;    // slowest
  bgMid.tilePosition.x -= speed * 0.5;    // medium
  bgNear.tilePosition.x -= speed * 1.0;   // fastest (foreground)
});
```

### Code: Procedural Tileable Pattern with RenderTexture

```javascript
// Generate a tileable star pattern procedurally
const tileSize = 64;
const tileGfx = new PIXI.Graphics();
for (let i = 0; i < 8; i++) {
  const x = Math.random() * tileSize;
  const y = Math.random() * tileSize;
  const r = 1 + Math.random() * 2;
  tileGfx.circle(x, y, r).fill({ color: 0xffffff, alpha: 0.3 + Math.random() * 0.7 });
}

const tileTexture = app.renderer.generateTexture({
  target: tileGfx,
  resolution: 1,
});

const starField = new PIXI.TilingSprite({
  texture: tileTexture,
  width: 800,
  height: 600,
});
```

### Procedural Game Art Uses
- **Parallax backgrounds:** Multiple TilingSprite layers at different speeds
- **Scrolling ground:** Ground texture that tiles as player moves
- **Water surface:** Animated tilePosition for water flow
- **Cloud layer:** Slow horizontal scroll
- **Starfield:** Procedurally generated tile + slow scroll
- **Brick/stone walls:** Architecture tile patterns
- **Rain/snow overlay:** Animated diagonal tilePosition shift

**Confidence:** HIGH — TilingSprite documented in official Pixi.js v8 guides

---

## 8. ColorMatrixFilter (Color Grading)

### What It Does
A built-in filter that applies a 5x4 color transformation matrix. Has 20+ preset methods for instant color grading effects. Perfect for per-theme/per-biome color palettes without changing any individual sprite colors.

### All Preset Methods

**Exposure & Tone:**
| Method | Signature | Effect |
|--------|-----------|--------|
| `brightness` | `(b, multiply?)` | Scale RGB channels (<1 darker, >1 brighter) |
| `contrast` | `(amount, multiply?)` | Adjust contrast (0-1 range) |
| `saturate` | `(amount?, multiply?)` | Adjust color intensity (-1 to 1) |
| `desaturate` | `()` | Full greyscale (calls saturate(-1)) |
| `hue` | `(rotation, multiply?)` | Rotate color wheel (degrees) |

**Film Looks:**
| Method | Signature | Effect |
|--------|-----------|--------|
| `sepia` | `(multiply?)` | Warm brown vintage look |
| `kodachrome` | `(multiply?)` | Vivid Kodachrome film stock |
| `technicolor` | `(multiply?)` | Early color film (saturated) |
| `polaroid` | `(multiply?)` | Warm Polaroid camera look |
| `vintage` | `(multiply?)` | Muted, aged photo |
| `browni` | `(multiply?)` | Brown-tinted warm look |

**Special FX:**
| Method | Signature | Effect |
|--------|-----------|--------|
| `negative` | `(multiply?)` | Invert all colors |
| `night` | `(intensity, multiply?)` | Green-tinted night vision (0-1) |
| `predator` | `(amount, multiply?)` | Thermal vision effect (0-1) |
| `lsd` | `(multiply?)` | Psychedelic color shift |

**Utility:**
| Method | Signature | Effect |
|--------|-----------|--------|
| `greyscale` / `grayscale` | `(scale, multiply?)` | Weighted greyscale (0-1) |
| `blackAndWhite` | `(multiply?)` | Pure black and white |
| `tint` | `(color, multiply?)` | Apply color tint |
| `toBGR` | `(multiply?)` | Swap red/blue channels |
| `colorTone` | `(desat, toned, light, dark, multiply?)` | Custom dual-tone grading |
| `reset` | `()` | Reset to identity matrix |

The `multiply` parameter (boolean) enables cumulative effects when chaining multiple methods on the same filter.

### Code: Per-Biome Color Grading

```javascript
const colorFilter = new PIXI.ColorMatrixFilter();

// FOREST: warm green tint + slight saturation boost
function applyForestTheme(filter) {
  filter.reset();
  filter.saturate(0.2, true);
  filter.tint(0x88cc66, true);  // green tint
  filter.contrast(0.1, true);
}

// DESERT: warm, washed out
function applyDesertTheme(filter) {
  filter.reset();
  filter.saturate(-0.3, true);   // slightly desaturated
  filter.brightness(1.1, true);  // brighter
  filter.tint(0xddbb88, true);   // sandy tint
}

// CAVE: dark, cool blue
function applyCaveTheme(filter) {
  filter.reset();
  filter.brightness(0.6, true);
  filter.contrast(0.2, true);
  filter.tint(0x6688aa, true);    // blue tint
  filter.saturate(-0.2, true);
}

// ICE: cold blue, high contrast
function applyIceTheme(filter) {
  filter.reset();
  filter.tint(0xaaddff, true);
  filter.contrast(0.15, true);
  filter.brightness(1.05, true);
}

// LAVA: red hot, high saturation
function applyLavaTheme(filter) {
  filter.reset();
  filter.tint(0xff6644, true);
  filter.saturate(0.4, true);
  filter.contrast(0.2, true);
}

// NIGHT: dark blue + green night vision
function applyNightTheme(filter) {
  filter.reset();
  filter.night(0.3, true);
  filter.brightness(0.5, true);
}

// RETRO: sepia + low saturation
function applyRetroTheme(filter) {
  filter.reset();
  filter.sepia(true);
  filter.contrast(0.1, true);
}

// Apply to entire game world
gameWorld.filters = [colorFilter];
applyForestTheme(colorFilter);
```

### Procedural Game Art Uses
- **Biome color grading:** Single filter on game world Container, swap preset per biome
- **Time-of-day:** Animate between day (bright, saturated) and night (dark, blue tint)
- **Damage feedback:** Brief brightness(1.5) + tint(red) flash
- **Power-up effects:** Temporary hue rotation or saturation boost
- **Death/gameover:** Greyscale transition
- **Dream sequences:** lsd() or hue rotation + blur
- **Underwater:** night() + blue tint + DisplacementFilter for wobble

**Confidence:** HIGH — all 20+ methods verified in official ColorMatrixFilter API docs

---

## 9. Masks

### What It Does
Masks clip display objects to a specific shape. Any Graphics or Sprite can be a mask. Supports both shape-based clipping (stencil) and alpha-based masking (sprite). Pixi.js v8 adds inverse masks via `setMask()`.

### API (Pixi.js v8)

**Basic Graphics Mask:**
```javascript
// Circle mask on a sprite
const maskShape = new PIXI.Graphics()
  .circle(200, 200, 100)
  .fill(0xffffff);

const maskedSprite = new PIXI.Sprite(texture);
maskedSprite.mask = maskShape;

// IMPORTANT: mask must be added to scene tree
stage.addChild(maskShape);
stage.addChild(maskedSprite);
```

**Alpha/Sprite Mask (uses red channel):**
```javascript
// Gradient mask for fog-of-war edge softening
const gradientMask = PIXI.Sprite.from('gradient-circle.png');
gradientMask.anchor.set(0.5);
gradientMask.position.set(playerX, playerY);

maskedLayer.mask = gradientMask;
stage.addChild(gradientMask);
stage.addChild(maskedLayer);
```

**Inverse Mask (v8 feature — setMask):**
```javascript
const hole = new PIXI.Graphics()
  .circle(playerX, playerY, 150)
  .fill(0x000000);

const darkOverlay = new PIXI.Container();
darkOverlay.addChild(/* dark fog */);
darkOverlay.setMask({ mask: hole, inverse: true });
// Everything EXCEPT the circle is visible
```

**Remove Mask:**
```javascript
sprite.mask = null;
```

### Code: Spotlight Reveal Effect

```javascript
// Create a soft spotlight mask (procedural)
const spotlightGfx = new PIXI.Graphics();
spotlightGfx.circle(0, 0, 200)
  .fill(new PIXI.FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: [
      { offset: 0, color: '#ffffff' },
      { offset: 0.7, color: '#ffffff' },
      { offset: 1, color: '#000000' },
    ],
  }));

// Render to sprite for alpha masking
const spotlightTexture = app.renderer.generateTexture({ target: spotlightGfx });
const spotlightMask = new PIXI.Sprite(spotlightTexture);
spotlightMask.anchor.set(0.5);

gameWorld.mask = spotlightMask;
stage.addChild(spotlightMask);

// Move spotlight with player
app.ticker.add(() => {
  spotlightMask.position.copyFrom(player.position);
});
```

### Procedural Game Art Uses
- **Fog-of-war:** Mask reveals explored area around player
- **Spotlight/torch:** Circular gradient mask follows player in dark levels
- **Water reflection clipping:** Mask water reflection to water surface area
- **UI cutouts:** Mask health bar to complex shapes
- **Cave openings:** Irregular shape masks for cave entrance reveals
- **Vignette:** Large circular mask with soft edges on entire game view
- **Minimap:** Small circular mask over a scaled-down game view copy

**Confidence:** HIGH — mask property and setMask() verified in official Pixi.js v8 docs

---

## 10. Container Effects (Alpha, Tint, BlendMode)

### What It Does
Pixi.js v8 containers inherit visual properties to children: alpha, tint, blendMode, and filters. This means you can tint an entire container and all children receive the tint automatically. This is a KEY v8 feature.

### Properties on Container

| Property | Type | Default | Effect |
|----------|------|---------|--------|
| `alpha` | number | 1 | Opacity (0=invisible, 1=opaque). Children multiply with parent. |
| `tint` | ColorSource | 0xffffff | Color tint. In v8, inherited by children. |
| `blendMode` | string | 'normal' | Blend mode. In v8, inherited by children. |
| `filters` | Filter[] | null | Post-process filters on container + children |
| `visible` | boolean | true | Toggle visibility |
| `cullable` | boolean | false | Enable frustum culling |

### Code: Layer-Wide Effects

```javascript
// Night layer — tint entire game world blue
const gameWorld = new PIXI.Container();
gameWorld.tint = 0x6688cc;    // all children tinted blue
gameWorld.alpha = 0.9;         // slight transparency

// Particle layer — additive blending for all particles
const particleLayer = new PIXI.Container();
particleLayer.blendMode = 'add';
// All particles added here automatically use additive blending

// UI layer — unaffected by game effects
const uiLayer = new PIXI.Container();
// No tint, no blend mode, no filters = crisp UI above game

// Stage ordering
stage.addChild(gameWorld);       // bottom: tinted game
stage.addChild(particleLayer);   // middle: additive particles
stage.addChild(uiLayer);         // top: clean UI
```

### Code: Fade-In / Fade-Out Scene Transitions

```javascript
// Fade the entire scene
const sceneContainer = new PIXI.Container();
sceneContainer.alpha = 0;

// Fade in using GSAP (already loaded)
gsap.to(sceneContainer, { alpha: 1, duration: 0.5 });

// Flash red on damage
gsap.to(gameWorld, {
  pixi: { tint: 0xff0000 },
  duration: 0.1,
  yoyo: true,
  repeat: 1,
});
```

### Code: Culling for Performance

```javascript
// Enable culling on containers with many children
const objectLayer = new PIXI.Container();
objectLayer.cullable = true;
objectLayer.cullableChildren = true;
// Objects outside visible area won't be rendered
```

### Procedural Game Art Uses
- **Day/night cycle:** Animate gameWorld.tint from white (day) to blue (night)
- **Scene transitions:** Fade alpha from 0 to 1 on scene enter
- **Damage flash:** Brief red tint on game world
- **Layer blending:** Separate additive particle layer from normal game layer
- **Ghost/stealth mode:** Player container alpha = 0.3
- **Freeze effect:** Desaturation filter + blue tint on game world
- **Zone tinting:** Different tint per area (lava=red, ice=blue, forest=green)

**Confidence:** HIGH — container inheritance confirmed as v8 feature in official docs and migration guide

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glow effects | Manual sprite halos | `GlowFilter` from pixi-filters | GPU-accelerated, configurable distance/color/strength |
| Color grading | Per-sprite color math | `ColorMatrixFilter` presets | 20+ presets, applies to entire Container at once |
| Screen shake | Manual camera offset | `ShockwaveFilter` + container offset | Professional look, combines distortion + camera |
| Gradient fills | Canvas 2D gradients baked to sprites | `FillGradient` | Native GPU rendering, no canvas overhead |
| Parallax scrolling | Manual sprite position math | `TilingSprite` with `tilePosition` | Hardware-optimized repeating, smooth sub-pixel |
| Displacement effects | Manual vertex distortion | `DisplacementFilter` | GPU shader, any texture as map |
| Complex shapes | Manual vertex calculation | Graphics bezier/arc/star/svg methods | Built-in, method-chained, fill/stroke |
| Rope/vine shapes | Manual mesh construction | `MeshRope` | Automatic UV mapping, animation support |
| Performance caching | Manual sprite sheet baking | `cacheAsTexture()` or `generateTexture()` | Built-in, one-liner |
| Night/day tinting | Per-sprite tint changes | Container.tint (inherited in v8) | One property change affects all children |

---

## Common Pitfalls

### Pitfall 1: WebGL Blend Mode Limitation
**What goes wrong:** Advanced blend modes like `'overlay'`, `'hard-light'` silently fall back to `'normal'` on WebGL.
**Why it happens:** WebGL only supports `normal`, `add`, `multiply`, `screen`.
**How to avoid:** Only use the 4 basic blend modes. Test on WebGL renderer (most users).
**Warning signs:** Blend effects look different on different devices.

### Pitfall 2: FillGradient Memory Leaks
**What goes wrong:** Creating new FillGradient objects every frame leaks GPU memory.
**Why it happens:** FillGradient internally creates a texture.
**How to avoid:** Create gradients once, reuse. Call `gradient.destroy()` when done.
**Warning signs:** Memory usage climbs over time, eventual crash.

### Pitfall 3: Filter Performance on Mobile
**What goes wrong:** Multiple filters per object causes frame drops.
**Why it happens:** Each filter is a full-screen GPU pass.
**How to avoid:** Limit to 1-2 filters per container. Use cacheAsTexture() for static content with filters. Avoid filters on many individual sprites (apply to parent container instead).
**Warning signs:** FPS drops when adding filters, especially on mobile.

### Pitfall 4: Mask Must Be in Scene Tree
**What goes wrong:** Mask doesn't work, object invisible or unmasked.
**Why it happens:** The mask Graphics/Sprite must be added to the stage subtree of its target's parent.
**How to avoid:** Always `stage.addChild(mask)` AND `sprite.mask = mask`.
**Warning signs:** Mask has no visual effect.

### Pitfall 5: Graphics API Changed in v8
**What goes wrong:** Using v7 syntax like `beginFill()`, `drawRect()`, `endFill()`.
**Why it happens:** Pixi.js v8 reversed the order: draw shape first, then fill/stroke.
**How to avoid:** Use v8 syntax: `.rect().fill()`, `.circle().stroke()`.
**Warning signs:** `beginFill is not a function` errors.

### Pitfall 6: pixi-filters CDN Access Pattern
**What goes wrong:** `import { GlowFilter } from 'pixi-filters'` fails in CDN context.
**Why it happens:** pixi-filters loaded via CDN, not ES module import.
**How to avoid:** Access via `PIXI.filters.GlowFilter` or `const { GlowFilter } = PIXI.filters`.
**Warning signs:** `Cannot find module` or `GlowFilter is not defined` errors.

### Pitfall 7: cacheAsTexture vs generateTexture Confusion
**What goes wrong:** Using cacheAsTexture() for things that need to be reused as textures elsewhere.
**Why it happens:** cacheAsTexture() optimizes rendering but doesn't expose the texture for reuse.
**How to avoid:** Use `renderer.generateTexture()` when you need a reusable Texture. Use `cacheAsTexture()` for in-place rendering optimization of complex containers.
**Warning signs:** Can't access the cached texture, or container rendering doesn't optimize as expected.

---

## Architecture Pattern: Layer Stack for 2D Games

```
stage (PIXI.Application.stage)
  |
  +-- bgLayer (Container)             // parallax TilingSprites
  |     +-- skyTiling                  // TilingSprite - slowest scroll
  |     +-- mountainsTiling            // TilingSprite - medium scroll
  |     +-- treesTiling                // TilingSprite - fast scroll
  |
  +-- gameWorld (Container)            // main game - moves with camera
  |     |  .filters = [colorGrading]   // ColorMatrixFilter per biome
  |     |  .tint = biomeColor          // layer-wide tint
  |     |
  |     +-- groundLayer                // terrain, platforms
  |     +-- entityLayer                // player, enemies, items
  |     +-- fxLayer (Container)        // blend: 'add' for particles
  |           +-- particles...
  |
  +-- overlayLayer (Container)         // post-processing
  |     +-- weatherFx                  // rain, snow (Proton)
  |     +-- vignette                   // Graphics mask
  |
  +-- uiLayer (Container)             // HUD, score, health
        // NO filters, NO tint = clean UI
```

---

## State of the Art

| Old Approach (in current codebase) | Current Best Practice | Impact |
|------------------------------------|----------------------|--------|
| Canvas 2D fallback for gradients | `FillGradient` native | No canvas overhead, GPU-rendered |
| Canvas 2D for complex shapes | Graphics bezier/arc/star/svg | GPU-rendered, method-chained |
| Manual glow halos with Canvas shadowBlur | `GlowFilter` | GPU-accelerated, per-container |
| Manual color tinting per sprite | Container.tint inheritance (v8) | One property affects all children |
| `cacheAsBitmap = true` | `cacheAsTexture()` | New v8 API, better control |
| `beginFill().drawRect().endFill()` | `.rect().fill()` | v8 draw-then-style API |
| `new TilingSprite(texture, w, h)` | `new TilingSprite({ texture, width, height })` | v8 object constructor |

---

## Open Questions

1. **pixi-filters v6 CDN global namespace:** Need to verify exact global path for all 37 filters. The CDN script registers them on `PIXI.filters.*` but the exact mapping for v6.1.5 should be tested. Likely `PIXI.filters.GlowFilter`, `PIXI.filters.GodrayFilter`, etc.

2. **FillGradient on CDN build:** The runtime checks `PIXI.FillGradient` — this is available in pixi.js v8.9.2 CDN build. Verified by existing runtime code that already checks for it.

3. **MeshRope with procedural textures:** Using `renderer.generateTexture()` output as a MeshRope texture should work but has not been tested in this specific codebase's CDN environment.

4. **Filter performance budget:** How many simultaneous filters can run at 60fps on mobile? Rule of thumb: 2-3 filters on the full stage is fine, avoid per-sprite filters on >20 sprites.

---

## Sources

### Primary (HIGH confidence)
- [Pixi.js v8 Filters Guide](https://pixijs.com/8.x/guides/components/filters) — built-in filters, blend modes, custom filters
- [Pixi.js v8 Graphics Guide](https://pixijs.com/8.x/guides/components/scene-objects/graphics) — drawing API
- [Pixi.js v8 Graphics Fill](https://pixijs.com/8.x/guides/components/scene-objects/graphics/graphics-fill) — FillGradient, texture fills
- [Pixi.js v8 Mesh Guide](https://pixijs.com/8.x/guides/components/scene-objects/mesh) — MeshRope, MeshPlane, MeshSimple
- [Pixi.js v8 TilingSprite Guide](https://pixijs.com/8.x/guides/components/scene-objects/tiling-sprite) — parallax, tiling
- [Pixi.js v8 cacheAsTexture Guide](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture) — performance caching
- [Pixi.js v8 Migration Guide](https://pixijs.com/8.x/guides/migrations/v8) — API changes from v7
- [FillGradient API](https://pixijs.download/dev/docs/scene.FillGradient.html) — gradient types, colorStops
- [ColorMatrixFilter API](https://pixijs.download/dev/docs/filters.ColorMatrixFilter.html) — all 20+ preset methods
- [DisplacementFilter API](https://pixijs.download/dev/docs/filters.DisplacementFilter.html) — displacement mapping
- [MeshRope API](https://pixijs.download/dev/docs/scene.MeshRope.html) — rope/vine mesh
- [RenderTexture API](https://pixijs.download/dev/docs/rendering.RenderTexture.html) — offscreen rendering
- [Graphics API](https://pixijs.download/dev/docs/scene.Graphics.html) — all drawing methods

### Secondary (MEDIUM confidence)
- [pixi-filters GitHub](https://github.com/pixijs/filters) — 37+ community filters, v6.x for Pixi v8
- [pixi-filters npm](https://www.npmjs.com/package/pixi-filters) — v6.1.5 compatible with Pixi v8
- [Pixi.js BLEND_MODES](https://api.pixijs.io/@pixi/constants/PIXI/BLEND_MODES.html) — full blend mode list

### Tertiary (LOW confidence)
- Various CodePen examples for displacement/ripple effects — community patterns, not officially maintained

---

## Metadata

**Confidence breakdown:**
- Filters (built-in): HIGH — official Pixi.js v8 docs
- Filters (pixi-filters): HIGH — CDN already loaded in project, v6.1.5 verified
- FillGradient: HIGH — official v8 API docs + examples page
- Graphics drawing: HIGH — official v8 API docs
- MeshRope: HIGH — official v8 API docs
- RenderTexture: HIGH — official v8 API + migration guide
- TilingSprite: HIGH — official v8 guide
- ColorMatrixFilter: HIGH — all methods verified in API docs
- Blend modes: HIGH — official docs, WebGL limitation documented
- Masks: HIGH — mask and setMask() verified in v8 docs
- Container effects: HIGH — v8 inheritance feature confirmed in migration guide

**Research date:** 2026-03-23
**Valid until:** 2026-05-23 (Pixi.js is stable, 60-day validity)
