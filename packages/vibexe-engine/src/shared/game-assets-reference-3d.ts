/**
 * 3D Game Assets Reference — Catalog for 3D game generation agents.
 *
 * Injected into 3D game agent prompt. Edit HERE to update all 3D game generation.
 * Assets served from: /opt/vibexe/media-stock/games-3d/ via /api/app-builder/media-stock-3d/
 *
 * 5 packs, ~500 models, 44 MB total. Rebuilt from disk inventory 2026-03-01.
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
  family: "kaykit" | "stylized" | "meshy";
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
    description:
      "370 GLTF models for 3D platformer games. 38 neutral-only models + 83 base models in 4 color variants (blue, green, red, yellow). Cartoon low-poly style.",
    categories: {
      // --- COLOR VARIANTS (83 base × 4 colors = 332 files) ---
      // Path: Assets/gltf/{color}/{name}_{color}.gltf
      // Colors: blue, green, red, yellow (NO neutral versions of these)
      platforms_color: [
        "platform_1x1x1",
        "platform_2x2x1", "platform_2x2x2", "platform_2x2x4",
        "platform_4x2x1", "platform_4x2x2", "platform_4x2x4",
        "platform_4x4x1", "platform_4x4x2", "platform_4x4x4",
        "platform_6x2x1", "platform_6x2x2", "platform_6x2x4",
        "platform_6x6x1", "platform_6x6x2", "platform_6x6x4",
      ],
      platforms_special_color: [
        "platform_arrow_2x2x1", "platform_arrow_4x4x1",
        "platform_decorative_1x1x1", "platform_decorative_2x2x2",
        "platform_hole_6x6x1",
      ],
      platform_slopes_color: [
        "platform_slope_2x2x2", "platform_slope_2x4x4", "platform_slope_2x6x4",
        "platform_slope_4x2x2", "platform_slope_4x4x4", "platform_slope_4x6x4",
        "platform_slope_6x2x2", "platform_slope_6x4x4", "platform_slope_6x6x4",
      ],
      barriers_color: [
        "barrier_1x1x1", "barrier_1x1x2", "barrier_1x1x4",
        "barrier_2x1x1", "barrier_2x1x2", "barrier_2x1x4",
        "barrier_3x1x1", "barrier_3x1x2", "barrier_3x1x4",
        "barrier_4x1x1", "barrier_4x1x2", "barrier_4x1x4",
      ],
      arches_color: ["arch", "arch_tall", "arch_wide"],
      collectibles_color: ["ball", "diamond", "heart", "star"],
      bombs_color: ["bomb_A", "bomb_B"],
      bracing_color: ["bracing_large", "bracing_medium", "bracing_small"],
      interactive_color: ["button_base", "flag_A", "flag_B", "flag_C", "power", "spring_pad"],
      hoops_color: ["hoop", "hoop_angled"],
      levers_color: ["lever_floor_base", "lever_wall_base_A", "lever_wall_base_B"],
      pipes_color: [
        "pipe_180_A", "pipe_180_B", "pipe_90_A", "pipe_90_B",
        "pipe_end", "pipe_straight_A", "pipe_straight_B",
      ],
      railings_color: [
        "railing_corner_double", "railing_corner_padded", "railing_corner_single",
        "railing_straight_double", "railing_straight_padded", "railing_straight_single",
      ],
      signage_color: [
        "signage_arrows_left", "signage_arrows_right",
        "signage_arrow_stand", "signage_arrow_wall",
      ],
      misc_color: ["cone"],

      // --- NEUTRAL ONLY (38 files, no color variants) ---
      // Path: Assets/gltf/neutral/{name}.gltf
      neutral_barriers: [
        "barrier_1x1x1", "barrier_1x1x2", "barrier_1x1x4",
        "barrier_2x1x1", "barrier_2x1x2", "barrier_2x1x4",
        "barrier_3x1x1", "barrier_3x1x2", "barrier_3x1x4",
        "barrier_4x1x1", "barrier_4x1x2", "barrier_4x1x4",
      ],
      neutral_floors: ["floor_wood_1x1", "floor_wood_2x2", "floor_wood_2x6", "floor_wood_4x4"],
      neutral_pillars: [
        "pillar_1x1x1", "pillar_1x1x2", "pillar_1x1x4", "pillar_1x1x8",
        "pillar_2x2x2", "pillar_2x2x4", "pillar_2x2x8",
      ],
      neutral_structures: ["structure_A", "structure_B", "structure_C"],
      neutral_struts: ["strut_horizontal", "strut_vertical"],
      neutral_signage: ["signage_arrows_left", "signage_arrows_right", "signage_finish", "signage_finish_wide"],
      neutral_misc: ["ball", "bomb", "cone", "platform_wood_1x1x1", "sign", "spring"],
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
    description:
      "41 GLTF models for city/town building games. Buildings, vehicles, roads, and street furniture. Path: Assets/gltf/{name}.gltf",
    categories: {
      ground: ["base"],
      buildings: [
        "building_A", "building_A_withoutBase",
        "building_B", "building_B_withoutBase",
        "building_C", "building_C_withoutBase",
        "building_D", "building_D_withoutBase",
        "building_E", "building_E_withoutBase",
        "building_F", "building_F_withoutBase",
        "building_G", "building_G_withoutBase",
        "building_H", "building_H_withoutBase",
      ],
      vehicles: ["car_hatchback", "car_police", "car_sedan", "car_stationwagon", "car_taxi"],
      roads: [
        "road_corner", "road_corner_curved", "road_junction",
        "road_straight", "road_straight_crossing", "road_tsplit",
      ],
      streetProps: [
        "bench", "box_A", "box_B", "bush", "dumpster", "firehydrant", "streetlight",
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
    description:
      "76 GLTF models of crafting/gathering resources. Metals, fuel, wood, stone, textiles, parts. Path: Assets/gltf/{name}.gltf",
    categories: {
      copper: [
        "Copper_Bar", "Copper_Bars",
        "Copper_Bars_Stack_Large", "Copper_Bars_Stack_Medium", "Copper_Bars_Stack_Small",
        "Copper_Nugget_Large", "Copper_Nugget_Medium", "Copper_Nugget_Small", "Copper_Nuggets",
      ],
      fuel: [
        "Fuel_A_Barrel", "Fuel_A_Barrel_Dirty", "Fuel_A_Barrels", "Fuel_A_Jerrycan",
        "Fuel_B_Barrel", "Fuel_B_Barrel_Dirty", "Fuel_B_Barrels", "Fuel_B_Jerrycan",
        "Fuel_C_Barrel", "Fuel_C_Barrel_Dirty", "Fuel_C_Barrels", "Fuel_C_Jerrycan",
      ],
      gold: [
        "Gold_Bar", "Gold_Bars",
        "Gold_Bars_Stack_Large", "Gold_Bars_Stack_Medium", "Gold_Bars_Stack_Small",
        "Gold_Nugget_Large", "Gold_Nugget_Medium", "Gold_Nugget_Small", "Gold_Nuggets",
      ],
      iron: [
        "Iron_Bar", "Iron_Bars",
        "Iron_Bars_Stack_Large", "Iron_Bars_Stack_Medium", "Iron_Bars_Stack_Small",
        "Iron_Nugget_Large", "Iron_Nugget_Medium", "Iron_Nugget_Small", "Iron_Nuggets",
      ],
      pallets: ["Pallet_Wood", "Pallet_Wood_Covered_A", "Pallet_Wood_Covered_B"],
      parts: ["Parts_Cog", "Parts_Pile_Large", "Parts_Pile_Medium", "Parts_Pile_Small"],
      silver: [
        "Silver_Bar", "Silver_Bars",
        "Silver_Bars_Stack_Large", "Silver_Bars_Stack_Medium", "Silver_Bars_Stack_Small",
        "Silver_Nugget_Large", "Silver_Nugget_Medium", "Silver_Nugget_Small", "Silver_Nuggets",
      ],
      stone: [
        "Stone_Brick",
        "Stone_Bricks_Stack_Large", "Stone_Bricks_Stack_Medium", "Stone_Bricks_Stack_Small",
        "Stone_Chunks_Large", "Stone_Chunks_Small",
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
    description:
      "17 models (4 animated GLB characters + 13 GLTF equipment). Files at pack root: {name}.gltf or {name}.glb",
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
    description: "3 hand-painted tool models (OBJ). Files at pack root: {name}01.obj",
    categories: {
      tools: ["axe01", "pickaxe01", "hammer01"],
    },
  },

  // ---- MESHY CHARACTERS (Animated, GLB, Skeletal) ----
  {
    id: "meshy-characters",
    name: "Meshy Animated Characters",
    family: "meshy",
    format: "glb",
    fileCount: 1,
    sizeMB: 12,
    serverPath: "meshy-characters",
    description:
      "Animated character models from Meshy.ai with embedded skeletal animations (idle, run, walk, jump, attack, death). GLB format with textures baked in. Use createAnimatedCharacter3D() to load.",
    categories: {
      warriors: ["Warrior_figure_Animations"],
    },
  },
];

// ============================================================================
// AGENT PROMPT REFERENCE — Injected into 3D game agent system prompt
// ============================================================================

export const GAME_3D_ASSETS_REFERENCE = `
## 3D Asset Catalog — 6 Packs (56 MB)

**API endpoint**: \`/api/app-builder/media-stock-3d/{pack-id}/{path-to-file}\`

### Art Style: KayKit Cartoon Low-Poly (GLTF)

All packs share the same bright, cartoon low-poly aesthetic. Consistent look guaranteed.
- Load with: \`loadGLTF()\` from assets-3d.ts (GLTF, web-native)
- Use for: platformers, city builders, survival/crafting, kids games, casual 3D

---

### KAYKIT PLATFORMER — 370 GLTF Models (17 MB)
Pack: \`kaykit-platformer\`

**IMPORTANT: Two different path patterns exist!**

#### Color Models (83 base × 4 colors = 332 files)
Colors: **blue, green, red, yellow** (there is NO neutral version of these models)
Path: \`Assets/gltf/{color}/{name}_{color}.gltf\`
Example: \`Assets/gltf/blue/platform_4x4x1_blue.gltf\`

**Platforms (16 sizes):** platform_1x1x1, platform_2x2x1, platform_2x2x2, platform_2x2x4, platform_4x2x1, platform_4x2x2, platform_4x2x4, platform_4x4x1, platform_4x4x2, platform_4x4x4, platform_6x2x1, platform_6x2x2, platform_6x2x4, platform_6x6x1, platform_6x6x2, platform_6x6x4
**Platform Specials (5):** platform_arrow_2x2x1, platform_arrow_4x4x1, platform_decorative_1x1x1, platform_decorative_2x2x2, platform_hole_6x6x1
**Platform Slopes (9):** platform_slope_2x2x2, platform_slope_2x4x4, platform_slope_2x6x4, platform_slope_4x2x2, platform_slope_4x4x4, platform_slope_4x6x4, platform_slope_6x2x2, platform_slope_6x4x4, platform_slope_6x6x4
**Barriers (12):** barrier_1x1x1, barrier_1x1x2, barrier_1x1x4, barrier_2x1x1, barrier_2x1x2, barrier_2x1x4, barrier_3x1x1, barrier_3x1x2, barrier_3x1x4, barrier_4x1x1, barrier_4x1x2, barrier_4x1x4
**Arches (3):** arch, arch_tall, arch_wide
**Collectibles (4):** ball, diamond, heart, star
**Bombs (2):** bomb_A, bomb_B
**Bracing (3):** bracing_large, bracing_medium, bracing_small
**Interactive (6):** button_base, flag_A, flag_B, flag_C, power, spring_pad
**Hoops (2):** hoop, hoop_angled
**Levers (3):** lever_floor_base, lever_wall_base_A, lever_wall_base_B
**Pipes (7):** pipe_180_A, pipe_180_B, pipe_90_A, pipe_90_B, pipe_end, pipe_straight_A, pipe_straight_B
**Railings (6):** railing_corner_double, railing_corner_padded, railing_corner_single, railing_straight_double, railing_straight_padded, railing_straight_single
**Signage (4):** signage_arrows_left, signage_arrows_right, signage_arrow_stand, signage_arrow_wall
**Other (1):** cone

#### Neutral Models (38 files, no color variants)
Path: \`Assets/gltf/neutral/{name}.gltf\`
Example: \`Assets/gltf/neutral/pillar_2x2x4.gltf\`

**Barriers (12):** barrier_1x1x1 through barrier_4x1x4 (same names as color, but neutral version)
**Wood Floors (4):** floor_wood_1x1, floor_wood_2x2, floor_wood_2x6, floor_wood_4x4
**Pillars (7):** pillar_1x1x1, pillar_1x1x2, pillar_1x1x4, pillar_1x1x8, pillar_2x2x2, pillar_2x2x4, pillar_2x2x8
**Structures (3):** structure_A, structure_B, structure_C
**Struts (2):** strut_horizontal, strut_vertical
**Signage (4):** signage_arrows_left, signage_arrows_right, signage_finish, signage_finish_wide
**Other (6):** ball, bomb, cone, platform_wood_1x1x1, sign, spring

---

### KAYKIT CITY BUILDER — 41 GLTF Models (4 MB)
Pack: \`kaykit-city-builder\`
Path: \`Assets/gltf/{name}.gltf\`
Example: \`Assets/gltf/building_A.gltf\`

**Ground (1):** base
**Buildings (16):** building_A through building_H, each with a _withoutBase variant
**Vehicles (5):** car_hatchback, car_police, car_sedan, car_stationwagon, car_taxi
**Roads (6):** road_corner, road_corner_curved, road_junction, road_straight, road_straight_crossing, road_tsplit
**Street Props (13):** bench, box_A, box_B, bush, dumpster, firehydrant, streetlight, trafficlight_A, trafficlight_B, trafficlight_C, trash_A, trash_B, watertower

---

### KAYKIT RESOURCE BITS — 76 GLTF Models (4 MB)
Pack: \`kaykit-resource-bits\`
Path: \`Assets/gltf/{name}.gltf\`
Example: \`Assets/gltf/Gold_Bar.gltf\`
**Note: Names are PascalCase with underscores (e.g. Gold_Bar, not gold_bar)**

**Copper (9):** Copper_Bar, Copper_Bars, Copper_Bars_Stack_Large/Medium/Small, Copper_Nugget_Large/Medium/Small, Copper_Nuggets
**Fuel Barrels (12):** Fuel_A_Barrel, Fuel_A_Barrel_Dirty, Fuel_A_Barrels, Fuel_A_Jerrycan (same for B, C)
**Gold (9):** Gold_Bar, Gold_Bars, Gold_Bars_Stack_Large/Medium/Small, Gold_Nugget_Large/Medium/Small, Gold_Nuggets
**Iron (9):** Iron_Bar, Iron_Bars, Iron_Bars_Stack_Large/Medium/Small, Iron_Nugget_Large/Medium/Small, Iron_Nuggets
**Pallets (3):** Pallet_Wood, Pallet_Wood_Covered_A, Pallet_Wood_Covered_B
**Parts (4):** Parts_Cog, Parts_Pile_Large, Parts_Pile_Medium, Parts_Pile_Small
**Silver (9):** Silver_Bar, Silver_Bars, Silver_Bars_Stack_Large/Medium/Small, Silver_Nugget_Large/Medium/Small, Silver_Nuggets
**Stone (6):** Stone_Brick, Stone_Bricks_Stack_Large/Medium/Small, Stone_Chunks_Large, Stone_Chunks_Small
**Textiles (6):** Textiles_A/B/C, Textiles_Stack_Large, Textiles_Stack_Large_Colored, Textiles_Stack_Small
**Wood (9):** Wood_Log_A/B, Wood_Log_Stack, Wood_Plank_A/B/C, Wood_Planks_Stack_Large/Medium/Small

---

### KAYKIT SKELETONS — 17 Models (19 MB)
Pack: \`kaykit-skeletons\`
Path: files at pack root — \`{name}.gltf\` or \`{name}.glb\`
Example: \`Skeleton_Warrior.glb\`

**Animated Characters (4 GLB):** Skeleton_Mage, Skeleton_Minion, Skeleton_Rogue, Skeleton_Warrior
**Weapons (4 GLTF):** Skeleton_Axe, Skeleton_Blade, Skeleton_Crossbow, Skeleton_Staff
**Projectiles (5 GLTF):** Skeleton_Arrow, Skeleton_Arrow_Broken, Skeleton_Arrow_Half, Skeleton_Arrow_Broken_Half, Skeleton_Quiver
**Shields (4 GLTF):** Skeleton_Shield_Large_A/B, Skeleton_Shield_Small_A/B

---

### STYLIZED TOOLS — 3 OBJ (0.2 MB)
Pack: \`stylized-tools\`
Path: files at pack root — \`{name}.obj\`
Example: \`axe01.obj\`

**Tools (3):** axe01.obj, pickaxe01.obj, hammer01.obj

---

### Loading 3D Assets — USE FACTORY HELPERS (Recommended)

**Factory helpers** handle URL construction, caching, scaling, positioning, and fallbacks automatically.
Import from assets-3d.ts (already pre-created):

\`\`\`typescript
import {
  createPlatform3D, createCollectible3D, createPlayer3D,
  createBarrier3D, createDecoration3D, createPhysicsBody,
} from "../config/assets-3d";

// Platform — returns { mesh, size } where size = physics half-extents
const { mesh: plat, size: platSize } = await createPlatform3D(scene, 0, 1, -5);
const platBody = createPhysicsBody("box", 0, { x: 0, y: 1, z: -5 }, platSize);
world.addBody(platBody);

// Different color + size
const { mesh: redPlat } = await createPlatform3D(scene, 5, 2, -10, { variant: "6x6x1", color: "red" });

// Collectible (diamond, star, heart, ball)
const { mesh: gem } = await createCollectible3D(scene, 3, 2, -8, { type: "star", color: "yellow" });

// Player character
const { mesh: player, size: playerSize } = await createPlayer3D(scene, 0, 2, 0);
const playerBody = createPhysicsBody("sphere", 5, { x: 0, y: 2, z: 0 }, playerSize.x);

// Barrier / wall
const { mesh: wall, size: wallSize } = await createBarrier3D(scene, -5, 0.5, -10, { variant: "3x1x4" });

// Decoration (pillar, floor, structure — neutral by default)
const { mesh: pillar } = await createDecoration3D(scene, -3, 0, -8, { type: "pillar_2x2x4" });
const { mesh: floor } = await createDecoration3D(scene, 0, 0, 0, { type: "floor_wood_4x4" });
\`\`\`

**Factory functions available:** \`createPlatform3D\`, \`createCollectible3D\`, \`createPlayer3D\`, \`createBarrier3D\`, \`createDecoration3D\`.
All return \`{ mesh, size }\`. Models are cached internally — creating 20 platforms loads the GLTF only once.

### Advanced: Raw loadGLTF (for city-builder, resource-bits, skeletons)

For packs without factory helpers, use \`loadGLTF(modelUrl(...))\` directly:

\`\`\`typescript
import { loadGLTF, SCALES_3D } from "../config/assets-3d";
import { modelUrl } from "../utils/media-stock-3d";

// City builder — Assets/gltf/{name}.gltf
const building = await loadGLTF(modelUrl("kaykit-city-builder", "Assets/gltf/building_A.gltf"));

// Resource bits — Assets/gltf/{Name}.gltf (PascalCase)
const gold = await loadGLTF(modelUrl("kaykit-resource-bits", "Assets/gltf/Gold_Bar.gltf"));

// Skeletons — files at pack root (GLB includes textures)
const warrior = await loadGLTF(modelUrl("kaykit-skeletons", "Skeleton_Warrior.glb"));
warrior.scale.setScalar(SCALES_3D.skeleton);
scene.add(warrior);
\`\`\`

### CRITICAL PATH RULES
1. **Platformer color models**: \`Assets/gltf/{color}/{name}_{color}.gltf\` — platforms, arches, collectibles, pipes, railings etc.
2. **Platformer neutral models**: \`Assets/gltf/neutral/{name}.gltf\` — pillars, floors, structures, struts etc.
3. **City builder & Resource bits**: \`Assets/gltf/{name}.gltf\`
4. **Skeletons**: \`{name}.gltf\` or \`{name}.glb\` (at root)
5. **Stylized tools**: \`{name}.obj\` (at root)

### MESHY ANIMATED CHARACTERS — Skeletal Animations (12 MB)
Pack: \`meshy-characters\`
Format: GLB (single file with mesh + textures + animations)
**MUST use \`createAnimatedCharacter3D()\`** — NOT loadGLTF.

**Warrior** — Muscular barbarian warrior with 10 animation clips:
File: \`Warrior_figure_Animations.glb\`
Animations: "360 Power Spin Jump", "Dead", "High Kick", "Hit Reaction 1", "Idle 5", "Jump Over Obstacle 2", "Left Short Hook from Guard", "Running", "Walk Forward While Shooting", "Walking"

\`\`\`typescript
import { createAnimatedCharacter3D } from "../config/assets-3d";
import { modelUrl } from "../utils/media-stock-3d";

// Load animated character
const warrior = await createAnimatedCharacter3D(scene, 0, 0, 0, {
  url: modelUrl("meshy-characters", "Warrior_figure_Animations.glb"),
  scale: 1.0,
});

// Play animations (fuzzy match — "idle" finds "Idle 5", "run" finds "Running")
warrior.play("idle");                              // idle animation
warrior.play("run", { crossfade: 0.3 });           // smooth transition to running
warrior.play("walk");                              // walking
warrior.play("jump", { loop: false });             // jump (plays once)
warrior.play("attack");                            // High Kick
warrior.play("hit", { loop: false });              // hit reaction
warrior.play("die", { loop: false });              // death animation

// Access all clip names
console.log(warrior.clips); // ["Idle 5", "Running", "Walking", ...]

// Physics body
const body = createPhysicsBody("box", 5, {x:0, y:0, z:0}, warrior.size);
world.addBody(body);

// Move character — update mesh position from physics each frame
warrior.mesh.position.copy(body.position);
\`\`\`

Animations are **auto-updated** — no need to call mixer.update(). Just call \`warrior.play("run")\` and the animation transitions smoothly.

---

### Art Style Selection Guide

| User Request | Recommended Pack(s) |
|-------------|---------------------|
| "platformer", "3D platformer" | kaykit-platformer |
| "city builder", "town sim" | kaykit-city-builder |
| "survival", "crafting" | kaykit-resource-bits + kaykit-platformer |
| "skeleton enemies", "undead" | kaykit-skeletons + kaykit-platformer |
| "RPG", "adventure" | kaykit-skeletons + kaykit-platformer |
| "warrior", "fighter", "animated character" | meshy-characters + kaykit-platformer |
| "action game", "combat", "hack and slash" | meshy-characters + kaykit-platformer |
| "kids 3D game", "casual 3D" | kaykit-platformer |
| Default / unspecified | kaykit-platformer |

All packs share the same KayKit cartoon low-poly aesthetic — safe to combine any KayKit packs.
`;
