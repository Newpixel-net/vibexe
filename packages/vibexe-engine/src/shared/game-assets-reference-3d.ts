/**
 * 3D Game Assets Reference — Catalog for 3D game generation agents.
 *
 * Injected into 3D game agent prompt. Edit HERE to update all 3D game generation.
 * Assets served from: /opt/vibexe/media-stock/games-3d/ via /api/app-builder/media-stock-3d/
 *
 * 8 packs, 1,272 files, 286 MB total. Organized 2026-02-28.
 *
 * CRITICAL: Two art style families that must NEVER be mixed:
 *  - KayKit (cartoon low-poly) — GLTF format, web-ready
 *  - Unity 3D Game Kit (realistic dark fantasy) — FBX format, needs FBXLoader
 */

// ============================================================================
// ART STYLE FAMILIES — NEVER MIX BETWEEN FAMILIES
// ============================================================================

export interface AssetPack3D {
  id: string;
  name: string;
  family: "kaykit" | "unity" | "stylized";
  format: "gltf" | "glb" | "fbx" | "obj";
  fileCount: number;
  sizeMB: number;
  serverPath: string;
  description: string;
  categories: Record<string, string[]>;
}

// ============================================================================
// PACK DEFINITIONS
// ============================================================================

export const PACKS_3D: AssetPack3D[] = [
  // ---- KAYKIT FAMILY (Cartoon Low-Poly, GLTF, Web-Ready) ----
  {
    id: "kaykit-platformer",
    name: "KayKit Platformer Pack",
    family: "kaykit",
    format: "gltf",
    fileCount: 766,
    sizeMB: 17,
    serverPath: "kaykit-platformer",
    description: "370 GLTF models for 3D platformer games. Each base model has 5 color variants (neutral, blue, green, red, yellow). Cartoon low-poly style.",
    categories: {
      platforms: [
        "platform_2x2x1", "platform_2x2x2", "platform_2x2x4",
        "platform_4x2x1", "platform_4x2x2", "platform_4x2x4",
        "platform_4x4x1", "platform_4x4x2", "platform_4x4x4",
        "platform_6x2x1", "platform_6x2x2", "platform_6x2x4",
        "platform_6x6x1", "platform_6x6x2", "platform_6x6x4",
        "platform_slope_2x2x2", "platform_slope_2x4x4", "platform_slope_2x6x4",
        "platform_slope_4x2x2", "platform_slope_4x4x4", "platform_slope_4x6x4",
        "platform_slope_6x2x2",
        "platform_arrow_2x2x1", "platform_arrow_4x4x1",
        "platform_decorative_1x1x1", "platform_decorative_2x2x2",
        "platform_hole_6x6x1",
      ],
      barriers: [
        "barrier_1x1x1", "barrier_1x1x2",
        "barrier_2x1x1", "barrier_2x1x2", "barrier_2x1x4",
        "barrier_3x1x1", "barrier_3x1x2", "barrier_3x1x4",
      ],
      arches: ["arch", "arch_wide"],
      collectibles: ["ball", "chest", "coin", "crystal", "gem", "heart", "key", "ring", "star"],
      environment: ["bush", "cloud", "lamp", "mushroom", "rock", "sign", "tree", "water"],
      structures: ["block", "bridge", "castle_tower", "column", "door", "floor", "gate", "pillar", "ramp", "stairs", "tower", "wall"],
      interactive: ["button", "flag", "spike", "spring", "switch"],
    },
  },
  {
    id: "kaykit-city-builder",
    name: "KayKit City Builder Bits",
    family: "kaykit",
    format: "gltf",
    fileCount: 89,
    sizeMB: 4,
    serverPath: "kaykit-city-builder",
    description: "41 GLTF models for city/town building games. Buildings, vehicles, roads, and street furniture. Same cartoon low-poly style as platformer pack.",
    categories: {
      buildings: [
        "building_A", "building_B", "building_C", "building_D",
        "building_E", "building_F", "building_G",
        "building_H", "building_H_withoutBase",
      ],
      vehicles: ["car_hatchback", "car_police", "car_sedan", "car_stationwagon", "car_taxi"],
      roads: [
        "road_corner", "road_corner_curved", "road_junction",
        "road_straight", "road_straight_crossing", "road_tsplit",
      ],
      streetProps: [
        "bush", "dumpster", "firehydrant", "streetlight",
        "trafficlight_A", "trafficlight_B", "trafficlight_C",
        "trash_A", "trash_B", "watertower",
      ],
    },
  },
  {
    id: "kaykit-resource-bits",
    name: "KayKit Resource Bits",
    family: "kaykit",
    format: "gltf",
    fileCount: 158,
    sizeMB: 4,
    serverPath: "kaykit-resource-bits",
    description: "76 GLTF models of crafting/gathering resources. Ores, wood, stone, textiles, barrels. Same cartoon style. Perfect for survival/crafting games.",
    categories: {
      barrels: ["Barrel_A", "Barrel_B", "Barrel_C"],
      coal: ["Coal_Chunks_Large", "Coal_Chunks_Small"],
      copper: ["Copper_Brick", "Copper_Ingot", "Copper_Nugget_Small", "Copper_Nuggets", "Copper_Ore"],
      gold: [
        "Gold_Brick", "Gold_Ingot", "Gold_Nugget_Small", "Gold_Nuggets",
        "Gold_Bricks_Stack_Large", "Gold_Bricks_Stack_Medium", "Gold_Bricks_Stack_Small",
      ],
      iron: [
        "Iron_Brick", "Iron_Ingot", "Iron_Ore",
        "Iron_Bricks_Stack_Large", "Iron_Bricks_Stack_Medium", "Iron_Bricks_Stack_Small",
      ],
      silver: ["Silver_Nuggets", "Silver_Nugget_Small"],
      stone: [
        "Stone_Brick", "Stone_Chunks_Large", "Stone_Chunks_Small",
        "Stone_Bricks_Stack_Large", "Stone_Bricks_Stack_Medium", "Stone_Bricks_Stack_Small",
      ],
      textiles: [
        "Textiles_A", "Textiles_B", "Textiles_C",
        "Textiles_Stack_Large", "Textiles_Stack_Large_Colored", "Textiles_Stack_Small",
      ],
      wood: [
        "Wood_Log_A", "Wood_Log_B", "Wood_Log_Stack",
        "Wood_Plank_A", "Wood_Plank_B", "Wood_Plank_C",
        "Wood_Planks_Stack_Large", "Wood_Planks_Stack_Medium", "Wood_Planks_Stack_Small",
      ],
    },
  },
  {
    id: "kaykit-skeletons",
    name: "KayKit Skeleton Character Pack",
    family: "kaykit",
    format: "gltf",
    fileCount: 31,
    sizeMB: 19,
    serverPath: "kaykit-skeletons",
    description: "17 3D skeleton models (4 animated GLB characters + 13 GLTF equipment pieces). Cartoon low-poly undead enemies.",
    categories: {
      characters: [
        "Skeleton_Mage.glb", "Skeleton_Minion.glb",
        "Skeleton_Rogue.glb", "Skeleton_Warrior.glb",
      ],
      weapons: [
        "Skeleton_Axe.gltf", "Skeleton_Blade.gltf",
        "Skeleton_Crossbow.gltf", "Skeleton_Staff.gltf",
      ],
      projectiles: [
        "Skeleton_Arrow.gltf", "Skeleton_Arrow_Broken.gltf",
        "Skeleton_Arrow_Half.gltf", "Skeleton_Arrow_Broken_Half.gltf",
        "Skeleton_Quiver.gltf",
      ],
      shields: [
        "Skeleton_Shield_Large_A.gltf", "Skeleton_Shield_Large_B.gltf",
        "Skeleton_Shield_Small_A.gltf", "Skeleton_Shield_Small_B.gltf",
      ],
    },
  },

  // ---- UNITY FAMILY (Realistic Dark Fantasy, FBX, Needs FBXLoader) ----
  {
    id: "unity-gamekit-characters",
    name: "Unity 3D Game Kit Characters",
    family: "unity",
    format: "fbx",
    fileCount: 92,
    sizeMB: 156,
    serverPath: "unity-gamekit-characters",
    description: "5 rigged characters with 17+ animations each (FBX). Realistic dark fantasy style. Each character has separate FBX files for animations (@ActionName suffix).",
    categories: {
      characters: ["Grenadier", "Gunner", "Pistol", "Spitter", "Staff"],
      animations: [
        "@CloseRangeAttack", "@Death", "@Hit", "@Idle",
        "@MeleeAttack", "@RangeAttack", "@RangeAttack2",
        "@TurnLeft45", "@TurnLeft90", "@TurnLeft135", "@TurnLeft180",
        "@TurnRight45", "@TurnRight90", "@TurnRight135", "@TurnRight180",
        "@Walk", "@WalkFast",
      ],
    },
  },
  {
    id: "unity-gamekit-environment",
    name: "Unity 3D Game Kit Environment",
    family: "unity",
    format: "fbx",
    fileCount: 62,
    sizeMB: 56,
    serverPath: "unity-gamekit-environment",
    description: "62 environment FBX models. Cliffs, rocks, vegetation in 3 sizes (Large/Medium/Small). Realistic dark fantasy terrain.",
    categories: {
      cliffs: [
        "CliffBig01", "CliffBig02", "CliffBig03",
        "CliffEdge01", "CliffEdge02", "CliffEdge03", "CliffEdge04",
      ],
      rocks: [
        "RockChunk01",
        "RockFloating01", "RockFloating02", "RockFloating03", "RockFloating04",
        "RockLedge01", "RockLedge02", "RockSwamp01",
        "SmallRock01", "SmallRock02", "SmallRock03",
      ],
      terrain: ["Ridge01", "Ridge02", "GroundCover01", "GroundCover02"],
      vegetation: [
        "VegetationLarge01", "VegetationLarge02", "VegetationLarge03",
        "VegetationLarge04", "VegetationLarge05", "VegetationLarge06",
        "VegetationMedium01", "VegetationMedium02", "VegetationMedium03",
        "VegetationMedium04", "VegetationMedium05",
        "VegetationSmall01", "VegetationSmall02", "VegetationSmall03",
        "VegetationSmall04", "VegetationSmall05", "VegetationSmall06", "VegetationSmall07",
      ],
      plants: [
        "Fungus", "FungusClump",
        "HangingMoss01", "HangingMoss02", "HangingMoss03",
        "HangingVine", "HangingVine2",
      ],
    },
  },
  {
    id: "unity-gamekit-props",
    name: "Unity 3D Game Kit Props",
    family: "unity",
    format: "fbx",
    fileCount: 71,
    sizeMB: 32,
    serverPath: "unity-gamekit-props",
    description: "52 FBX prop models + 19 PNG textures. Walls, stairs, switches for dungeon/castle environments. Realistic dark fantasy.",
    categories: {
      stairs: [
        "StairsNarrow01", "StairsNarrowBroken01",
        "StairsWide01", "StairsWideBroken01",
      ],
      walls: [
        "WallCorner02", "WallCorner01Broken", "WallCornerBig01Broken",
        "WallCornerL01", "WallCornerR01",
        "WallHuge01", "WallHuge02",
        "WallLong01", "WallLong01Broken", "WallLong02", "WallLong02Broken",
        "WallShort01", "WallShort02",
        "WallTallCorner01", "WallTallLong01", "WallTallShort01",
      ],
      interactive: ["SwitchStanding", "WeaponPedestal"],
    },
  },

  // ---- STYLIZED (Standalone, OBJ format) ----
  {
    id: "stylized-tools",
    name: "Stylized 3D Tools",
    family: "stylized",
    format: "obj",
    fileCount: 3,
    sizeMB: 0.2,
    serverPath: "stylized-tools",
    description: "3 hand-painted tool models (OBJ). Standalone stylized items for any cartoon/fantasy game.",
    categories: {
      tools: ["axe", "pickaxe", "hammer"],
    },
  },
];

// ============================================================================
// AGENT PROMPT REFERENCE — Injected into 3D game agent system prompt
// ============================================================================

export const GAME_3D_ASSETS_REFERENCE = `
## 3D Asset Catalog — 1,272 Models in 8 Packs (286 MB)

**Server path**: \`/opt/vibexe/media-stock/games-3d/{pack-id}/\`
**API endpoint**: \`/api/app-builder/media-stock-3d/{pack-id}/{filename}\`

### CRITICAL: Art Style Families — NEVER MIX

There are TWO distinct art families. Mixing them creates ugly, incoherent visuals.

**Family 1: KayKit (Cartoon Low-Poly)** — 4 packs, GLTF format, web-ready for Three.js
- Bright colors, simple geometry, consistent low-poly aesthetic
- Load with: \`GLTFLoader\` (native Three.js)
- Use for: casual games, platformers, kids games, city builders, survival/crafting

**Family 2: Unity 3D Game Kit (Realistic Dark Fantasy)** — 3 packs, FBX format
- Dark, detailed, realistic textures and models
- Load with: \`FBXLoader\` (from three/examples)
- Use for: RPGs, dungeon crawlers, dark adventure games

**Family 3: Stylized (Standalone)** — 1 pack, OBJ format
- 3 hand-painted tools, can mix with KayKit if needed

### KAYKIT PLATFORMER — 370 GLTF Models (17 MB)
Pack: \`kaykit-platformer\` | Style: Cartoon low-poly
Color variants: Each base model has 5 versions (neutral + _blue, _green, _red, _yellow)
Example: \`platform_4x4x1.gltf\`, \`platform_4x4x1_blue.gltf\`, \`platform_4x4x1_red.gltf\`

**Platforms (22 base × 5 colors = 110):**
Sizes: 2x2, 4x2, 4x4, 6x2, 6x6 in heights x1, x2, x4
Slopes: 2x2x2, 2x4x4, 2x6x4, 4x2x2, 4x4x4, 4x6x4, 6x2x2
Special: arrow_2x2x1, arrow_4x4x1, decorative_1x1x1, decorative_2x2x2, hole_6x6x1

**Barriers (8 base × 5 colors = 40):**
barrier_1x1x1, barrier_1x1x2, barrier_2x1x1, barrier_2x1x2, barrier_2x1x4, barrier_3x1x1, barrier_3x1x2, barrier_3x1x4

**Collectibles (9 base × 5 colors = 45):**
ball, chest, coin, crystal, gem, heart, key, ring, star

**Environment (8+ base × 5 colors):**
bush, cloud, lamp, mushroom, rock, sign, tree, water

**Structures (12+ base × 5 colors):**
arch, arch_wide, block, bridge, castle_tower, column, door, floor, gate, pillar, ramp, stairs, tower, wall

**Interactive (5 base × 5 colors):**
button, flag, spike, spring, switch

### KAYKIT CITY BUILDER — 41 GLTF Models (4 MB)
Pack: \`kaykit-city-builder\` | Style: Cartoon low-poly (same as platformer)

**Buildings (9):** building_A through building_H, building_H_withoutBase
**Vehicles (5):** car_hatchback, car_police, car_sedan, car_stationwagon, car_taxi
**Roads (6):** road_corner, road_corner_curved, road_junction, road_straight, road_straight_crossing, road_tsplit
**Street Props (10):** bush, dumpster, firehydrant, streetlight, trafficlight_A/B/C, trash_A/B, watertower

### KAYKIT RESOURCE BITS — 76 GLTF Models (4 MB)
Pack: \`kaykit-resource-bits\` | Style: Cartoon low-poly (same as platformer)

**Barrels (3):** Barrel_A, Barrel_B, Barrel_C
**Ores & Metals:** Coal (2), Copper (5), Gold (7), Iron (6), Silver (2), Stone (6)
Each ore type has: Brick, Ingot, Nugget/Ore, and Stack variants (Small/Medium/Large)
**Textiles (6):** Textiles_A/B/C, Stack variants
**Wood (9):** Wood_Log_A/B, Wood_Log_Stack, Wood_Plank_A/B/C, Wood_Planks_Stack_Small/Medium/Large

### KAYKIT SKELETONS — 17 Models (19 MB)
Pack: \`kaykit-skeletons\` | Style: Cartoon low-poly (same family)

**Animated Characters (4 GLB):** Skeleton_Mage, Skeleton_Minion, Skeleton_Rogue, Skeleton_Warrior
**Weapons (4 GLTF):** Skeleton_Axe, Skeleton_Blade, Skeleton_Crossbow, Skeleton_Staff
**Projectiles (5 GLTF):** Skeleton_Arrow, Skeleton_Arrow_Broken, Skeleton_Arrow_Half, Skeleton_Arrow_Broken_Half, Skeleton_Quiver
**Shields (4 GLTF):** Skeleton_Shield_Large_A/B, Skeleton_Shield_Small_A/B
**Texture:** skeleton_texture.png

### UNITY CHARACTERS — 91 FBX (156 MB)
Pack: \`unity-gamekit-characters\` | Style: Realistic dark fantasy

**5 Characters:** Grenadier, Gunner, Pistol, Spitter, Staff
Each character has a base mesh FBX + ~17 animation FBX files with @ActionName suffix:
@CloseRangeAttack, @Death, @Hit, @Idle, @MeleeAttack, @RangeAttack, @RangeAttack2,
@TurnLeft45/90/135/180, @TurnRight45/90/135/180, @Walk, @WalkFast
Also includes: @SpitterSpit (Spitter-specific)

### UNITY ENVIRONMENT — 62 FBX (56 MB)
Pack: \`unity-gamekit-environment\` | Style: Realistic dark fantasy

**Cliffs (7):** CliffBig01-03, CliffEdge01-04
**Rocks (11):** RockChunk01, RockFloating01-04, RockLedge01-02, RockSwamp01, SmallRock01-03
**Terrain (4):** Ridge01-02, GroundCover01-02
**Vegetation Large (6+):** VegetationLarge01-06 (with _02 variants)
**Vegetation Medium (5+):** VegetationMedium01-05 (with _02 variants)
**Vegetation Small (7+):** VegetationSmall01-07 (with _02/_03 variants)
**Plants (7):** Fungus, FungusClump, HangingMoss01-03, HangingVine, HangingVine2

### UNITY PROPS — 52 FBX + 19 PNG (32 MB)
Pack: \`unity-gamekit-props\` | Style: Realistic dark fantasy

**Stairs (4):** StairsNarrow01, StairsNarrowBroken01, StairsWide01, StairsWideBroken01
**Walls (16):** WallCorner02, WallCorner01Broken, WallCornerBig01Broken, WallCornerL01/R01, WallHuge01-02, WallLong01/01Broken/02/02Broken, WallShort01-02, WallTallCorner01/Long01/Short01
**Interactive (2):** SwitchStanding, WeaponPedestal

### STYLIZED TOOLS — 3 OBJ (0.2 MB)
Pack: \`stylized-tools\` | Style: Hand-painted cartoon

**Tools (3):** axe, pickaxe, hammer
Can mix with KayKit family for crafting/survival games.

### Loading 3D Assets in Three.js

\`\`\`typescript
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

const API_BASE = window.__VIBEXE_API_ORIGIN__ + "/api/app-builder/media-stock-3d";

// KayKit (GLTF) — web-native, preferred
const gltfLoader = new GLTFLoader();
gltfLoader.load(\`\${API_BASE}/kaykit-platformer/Assets/gltf/platform_4x4x1.gltf\`, (gltf) => {
  scene.add(gltf.scene);
});

// KayKit Skeletons (GLB — self-contained, includes textures)
gltfLoader.load(\`\${API_BASE}/kaykit-skeletons/Skeleton_Warrior.glb\`, (gltf) => {
  scene.add(gltf.scene);
});

// Unity (FBX) — needs FBXLoader
const fbxLoader = new FBXLoader();
fbxLoader.load(\`\${API_BASE}/unity-gamekit-characters/Grenadier.fbx\`, (fbx) => {
  fbx.scale.set(0.01, 0.01, 0.01); // FBX models are often oversized
  scene.add(fbx);
});
\`\`\`

### Art Style Selection Guide

| User Request | Recommended Pack(s) | Family |
|-------------|---------------------|--------|
| "platformer", "3D platformer" | kaykit-platformer | KayKit |
| "city builder", "town sim" | kaykit-city-builder | KayKit |
| "survival", "crafting" | kaykit-resource-bits + kaykit-platformer | KayKit |
| "skeleton enemies", "undead" | kaykit-skeletons + kaykit-platformer | KayKit |
| "RPG", "dungeon" | unity-characters + unity-props + unity-environment | Unity |
| "dark fantasy", "horror 3D" | unity-characters + unity-environment | Unity |
| "kids 3D game", "casual 3D" | kaykit-platformer | KayKit |
| Default / unspecified | kaykit-platformer | KayKit |

### FORBIDDEN Combinations
- KayKit platformer platforms + Unity dark fantasy characters (art style clash)
- Unity realistic walls + KayKit cartoon buildings (completely different aesthetics)
- Unity FBX props mixed into a KayKit GLTF scene (different lighting/material models)
- Stylized tools with Unity dark fantasy (style mismatch)
`;
