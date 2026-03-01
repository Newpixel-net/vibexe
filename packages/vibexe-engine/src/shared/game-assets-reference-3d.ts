/**
 * 3D Game Assets Reference — Catalog for 3D game generation agents.
 *
 * Injected into 3D game agent prompt. Edit HERE to update all 3D game generation.
 * Assets served from: /opt/vibexe/media-stock/games-3d/ via /api/app-builder/media-stock-3d/
 *
 * 5 packs, 1,047 files, 44 MB total. Organized 2026-02-28.
 *
 * All packs use KayKit cartoon low-poly style (GLTF, web-ready).
 * Stylized tools (OBJ) can be mixed with KayKit.
 */

// ============================================================================
// ART STYLE — KayKit cartoon low-poly (GLTF) + Stylized (OBJ)
// ============================================================================

export interface AssetPack3D {
  id: string;
  name: string;
  family: "kaykit" | "stylized";
  format: "gltf" | "glb" | "obj";
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
## 3D Asset Catalog — 507 Models in 5 Packs (44 MB)

**Server path**: \`/opt/vibexe/media-stock/games-3d/{pack-id}/\`
**API endpoint**: \`/api/app-builder/media-stock-3d/{pack-id}/{path-to-file}\`

### Art Style: KayKit Cartoon Low-Poly (GLTF)

All packs share the same bright, cartoon low-poly aesthetic. Consistent look guaranteed.
- Load with: \`loadGLTF()\` from assets-3d.ts (GLTF, web-native)
- Use for: platformers, city builders, survival/crafting, kids games, casual 3D
- Stylized tools (OBJ, 3 models) can be mixed with KayKit

### KAYKIT PLATFORMER — 370 GLTF Models (17 MB)
Pack: \`kaykit-platformer\` | Style: Cartoon low-poly
Color variants: Each base model has 5 versions in **color subdirectories** (neutral, blue, green, red, yellow)
Path pattern: \`Assets/gltf/{color}/{name}_{color}.gltf\` — neutral has no suffix: \`Assets/gltf/neutral/{name}.gltf\`
Example: \`Assets/gltf/neutral/platform_4x4x1.gltf\`, \`Assets/gltf/blue/platform_4x4x1_blue.gltf\`, \`Assets/gltf/red/platform_4x4x1_red.gltf\`

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

### STYLIZED TOOLS — 3 OBJ (0.2 MB)
Pack: \`stylized-tools\` | Style: Hand-painted cartoon

**Tools (3):** axe, pickaxe, hammer
Can mix with KayKit family for crafting/survival games.

### Loading 3D Assets

Use the \`loadGLTF()\` helper from assets-3d.ts (already pre-created):

\`\`\`typescript
import { loadGLTF, SCALES_3D } from "../config/assets-3d";
import { modelUrl } from "../utils/media-stock-3d";

// KayKit GLTF model
const platform = await loadGLTF(modelUrl("kaykit-platformer", "Assets/gltf/neutral/platform_4x4x1.gltf"));
platform.scale.setScalar(SCALES_3D.platform);
scene.add(platform);

// Blue color variant — note the color subdirectory + suffix
const bluePlatform = await loadGLTF(modelUrl("kaykit-platformer", "Assets/gltf/blue/platform_4x4x1_blue.gltf"));

// KayKit Skeletons (GLB — self-contained, includes textures)
const warrior = await loadGLTF(modelUrl("kaykit-skeletons", "Skeleton_Warrior.glb"));
warrior.scale.setScalar(SCALES_3D.skeleton);
scene.add(warrior);
\`\`\`

### Art Style Selection Guide

| User Request | Recommended Pack(s) |
|-------------|---------------------|
| "platformer", "3D platformer" | kaykit-platformer |
| "city builder", "town sim" | kaykit-city-builder |
| "survival", "crafting" | kaykit-resource-bits + kaykit-platformer |
| "skeleton enemies", "undead" | kaykit-skeletons + kaykit-platformer |
| "RPG", "adventure" | kaykit-skeletons + kaykit-platformer |
| "kids 3D game", "casual 3D" | kaykit-platformer |
| Default / unspecified | kaykit-platformer |

All packs share the same KayKit cartoon low-poly aesthetic — safe to combine any KayKit packs.
Stylized tools (axe, pickaxe, hammer) can be added to any KayKit scene.
`;
