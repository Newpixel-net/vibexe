/**
 * 3D Game Template Files — Pre-created infrastructure injected into projects
 * BEFORE the AI agent starts generating code.
 *
 * Mirrors the 2D Phaser template pattern (game-templates.ts) exactly.
 * The agent finds these files already existing and imports from them.
 *
 * To add more template files, just add entries to GAME_3D_TEMPLATE_FILES.
 */

import type { TemplateFile } from "./game-templates";

export const GAME_3D_TEMPLATE_FILES: TemplateFile[] = [
	// ---------- Template 1: 3D Media-stock URL builder ----------
	{
		path: "src/utils/media-stock-3d.ts",
		language: "typescript",
		content: `/**
 * Builds a full URL for a 3D media-stock game asset.
 * Uses the platform-injected origin so it works inside Sandpack previews.
 *
 * Example: modelUrl("platformer-project", "objects/grid_platform.glb")
 */
export function modelUrl(packId: string, filename: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || "";
  return \`\${origin}/api/app-builder/media-stock-3d/\${packId}/\${encodeURI(filename)}\`;
}
`,
	},

	// ---------- Template 2: Core 3D helper functions ----------
	{
		path: "src/config/assets-3d.ts",
		language: "typescript",
		content: `import 'three';
import 'cannon-es';
import { modelUrl } from "../utils/media-stock-3d";
// Re-export so AI can import from assets-3d directly
export { modelUrl };

// ===== THREE.js + CANNON references =====
// The imports above trigger sync XHR shims that load THREE/CANNON into window.
const THREE = (window as any).THREE;
const CANNON = (window as any).CANNON;

// ===== r128 Compatibility Polyfills =====
// CapsuleGeometry doesn't exist in r128 (added r138). Polyfill so AI code doesn't crash.
if (THREE && !THREE.CapsuleGeometry) {
  THREE.CapsuleGeometry = class CapsuleGeometry extends THREE.CylinderGeometry {
    constructor(radius = 0.5, length = 1, capSegs = 8, radialSegs = 16) {
      super(radius, radius, length, radialSegs, 1, false);
    }
  };
}
// SRGBColorSpace / outputColorSpace don't exist in r128 (added r152). Polyfill.
if (THREE && !THREE.SRGBColorSpace) {
  THREE.SRGBColorSpace = "srgb";
  THREE.LinearSRGBColorSpace = "srgb-linear";
}

// ===== NaN-tolerant Quaternion patch =====
// AI-generated code often passes NaN/undefined values to rotation APIs,
// which crashes THREE.Quaternion.setFromEuler in the game loop. Instead of
// crashing the entire update(), silently skip bad rotations so the rest of
// the AI's code (animation switching, scoring, etc.) still executes.
if (THREE?.Quaternion?.prototype?.setFromEuler) {
  const _origSetFromEuler = THREE.Quaternion.prototype.setFromEuler;
  THREE.Quaternion.prototype.setFromEuler = function(euler: any, update?: boolean) {
    if (euler && (isNaN(euler.x) || isNaN(euler.y) || isNaN(euler.z))) {
      return this; // Skip bad rotation silently
    }
    return _origSetFromEuler.call(this, euler, update);
  };
}

// ===== SCALE PRESETS for Platformer Project + KayKit models =====
// Platformer Project GLB models from Unity — already world-scale (~1-4 units).
// KayKit GLTF models are small by default (~1 unit).
export const SCALES_3D = {
  // Platforms (Platformer Project)
  platform: 1.0,
  platformLarge: 1.5,
  platformSmall: 0.7,
  // Characters (Platformer Project)
  player: 1.0,          // Lily GLB — already correct scale from Unity export
  enemy: 1.0,           // Slime GLB — already correct scale
  skeleton: 1.0,        // KayKit skeleton
  animatedCharacter: 1.5, // targetHeight for createAnimatedCharacter3D (world units)
  // Collectibles (Platformer Project)
  collectible: 1.0,
  coin: 1.0,
  gem: 0.5,
  // Environment
  tree: 1.2,
  bush: 0.6,
  rock: 0.8,
  cloud: 1.5,
  // Buildings (city builder — KayKit)
  building: 1.0,
  vehicle: 0.6,
  road: 1.0,
  // Resources (KayKit)
  barrel: 0.5,
  ore: 0.4,
  wood: 0.5,
};

// ===== Game Settings (injected via window.__VIBEXE_GAME_SETTINGS__) =====
const __gs: any = typeof window !== 'undefined' ? (window as any).__VIBEXE_GAME_SETTINGS__ || {} : {};

// ===== Common Game Constants (Platformer Project physics) =====
export const TOUCH_DEADZONE = 0.15;   // Joystick deadzone (0-1 range)
export let GRAVITY_3D = __gs.physics?.gravity ?? -38;
export let FALL_GRAVITY = __gs.physics?.fallGravity ?? -65;
export let JUMP_FORCE = __gs.physics?.jumpForce ?? 17;
export const MIN_JUMP_FORCE = 10;      // Min jump height (tap Space)
export let MOVE_SPEED = __gs.physics?.moveSpeed ?? 6;
export let RUN_SPEED = __gs.physics?.runSpeed ?? 7.5;
export const ACCELERATION = 13;        // Ground acceleration
export const AIR_ACCELERATION = 32;    // Air acceleration (faster than ground!)
export let FRICTION = __gs.physics?.friction ?? 28;
export let COYOTE_TIME = __gs.physics?.coyoteTime ?? 0.15;
export const JUMP_BUFFER = 0.15;       // Seconds before landing a jump press is remembered
export const DASH_FORCE = 25;          // Dash velocity
export const DASH_DURATION = 0.3;      // Dash duration in seconds
export const SPIN_DURATION = 0.5;      // Spin attack duration
export const BACKFLIP_JUMP = 23;       // Backflip jump height (35% higher than normal)
export const GLIDE_GRAVITY = -10;      // Gliding gravity (very light)
export const GLIDE_MAX_FALL = -2;      // Max fall speed while gliding
export const WALL_DRAG_GRAVITY = -12;  // Wall slide gravity
export const WALL_JUMP_HEIGHT = 15;    // Wall jump vertical force
export const WALL_JUMP_DISTANCE = 8;   // Wall jump horizontal push
export const STOMP_FORCE = -20;        // Stomp downward force (additive per frame)
export const AIR_DIVE_FORCE = 16;      // Air dive forward force

// Camera follow constants (3rd-person platformer defaults)
export let CAMERA_OFFSET_Y = __gs.camera?.offsetY ?? 8;
export let CAMERA_OFFSET_Z = __gs.camera?.offsetZ ?? 12;
export let CAMERA_LERP = __gs.camera?.lerp ?? 3;
export let CAMERA_LOOK_Y = __gs.camera?.lookY ?? 1;
// Common AI aliases — prevent "undefined" crashes
export let CAMERA_LOOK_AHEAD = __gs.camera?.lookAhead ?? 5;
export let CAMERA_DISTANCE = CAMERA_OFFSET_Z;
export let CAMERA_HEIGHT = CAMERA_OFFSET_Y;
export const CAMERA_SMOOTH = 0.1;

// Collision / pickup distances
export const COLLECT_DISTANCE = 1.5;   // Distance to pick up collectibles
export const PLATFORM_GAP = 4;         // Default gap between platforms

// Enemy constants (Platformer Project: Slime)
export const ENEMY_GRAVITY = -35;      // Enemy gravity
export const ENEMY_SPOT_RANGE = 5;     // Range to detect player
export const ENEMY_VIEW_RANGE = 8;     // Extended view range
export const ENEMY_FOLLOW_SPEED = 4;   // Follow top speed
export const ENEMY_PATROL_SPEED = 2;   // Waypoint patrol speed
export const ENEMY_CONTACT_DAMAGE = 1; // Contact damage

// Platform mechanics
export const MOVING_PLATFORM_SPEED = 3;   // Moving platform speed
export const FALLING_PLATFORM_DELAY = 2;  // Seconds before falling
export const FALLING_PLATFORM_RESET = 5;  // Seconds before respawning
export const SPRING_FORCE = 25;            // Spring/bouncing platform force

// ===== Scene3D base class =====
// AI agents frequently write "extends Scene3D" when creating game scenes.
// This provides the base class so that pattern works without errors.
// Methods are called by Game3D.tsx: init() on mount, update(dt) per frame, cleanup() on unmount.
// Properties (scene, camera, renderer, world, container) are injected by Game3D.tsx BEFORE init().
export class Scene3D {
  scene: any;
  camera: any;
  renderer: any;
  world: any;
  container: any;
  init() {}
  update(_dt: number) {}
  cleanup() {}
}

// ===== Globals — prevent "undefined" crashes when AI forgets to import =====
// AI models frequently use these constants without importing them.
// Assigning to window makes them available as globals in the Sandpack env.
Object.assign(window, {
  SCALES_3D, TOUCH_DEADZONE, GRAVITY_3D, FALL_GRAVITY, JUMP_FORCE, MIN_JUMP_FORCE, MOVE_SPEED, RUN_SPEED,
  ACCELERATION, AIR_ACCELERATION, FRICTION, COYOTE_TIME, JUMP_BUFFER,
  DASH_FORCE, DASH_DURATION, SPIN_DURATION, BACKFLIP_JUMP,
  GLIDE_GRAVITY, GLIDE_MAX_FALL, WALL_DRAG_GRAVITY, WALL_JUMP_HEIGHT, WALL_JUMP_DISTANCE,
  STOMP_FORCE, AIR_DIVE_FORCE,
  CAMERA_OFFSET_Y, CAMERA_OFFSET_Z, CAMERA_LERP, CAMERA_LOOK_Y,
  CAMERA_LOOK_AHEAD, CAMERA_DISTANCE, CAMERA_HEIGHT, CAMERA_SMOOTH,
  COLLECT_DISTANCE, PLATFORM_GAP,
  ENEMY_GRAVITY, ENEMY_SPOT_RANGE, ENEMY_VIEW_RANGE, ENEMY_FOLLOW_SPEED, ENEMY_PATROL_SPEED, ENEMY_CONTACT_DAMAGE,
  MOVING_PLATFORM_SPEED, FALLING_PLATFORM_DELAY, FALLING_PLATFORM_RESET, SPRING_FORCE,
  Scene3D,
  createPlatform3D, createCollectible3D, createPlayer3D, createBarrier3D, createDecoration3D,
  createAnimatedCharacter3D, createCharacterController3D, createText3D,
  createPhysicsWorld, createPhysicsBody, createPhysicsGround, syncBodiesToMeshes, createContactMaterial,
  createGround3D, createSkyGradient, checkCollision, checkBoxCollision, createHUD,
  createKeyboardState, createTouchJoystick, createTapDetector, createSwipeDetector,
  hapticFeedback, tryLockLandscape,
  createAnimationPlayer, createOrbitControls, onClickObject,
  loadGLTF, modelUrl, initRenderer, initScene, initCamera,
  // Animation Registry
  createAnimationMap,
  // Audio System
  soundUrl, createAudioManager, playSound, playMusic, playSpatial3D, preloadSounds, muteMusic, unmuteMusic,
  // Post-Processing
  createPostProcessing, addFogEffect, setToneMapping,
  // Particles & VFX
  createParticleEmitter, createTrailRenderer,
  // Physics Triggers & Constraints
  createTriggerZone, createHingeConstraint, createSpringConstraint,
  createLockConstraint, createPointConstraint, createCompoundBody,
  setCollisionGroups,
  THREE, CANNON,
});

// ===== Renderer =====

/**
 * Creates a WebGLRenderer sized to fill the container.
 * IDEMPOTENT: If Game3D.tsx already created a renderer (stored on window.__vibexe_renderer__),
 * returns that instead of creating a duplicate. This prevents AI code from creating
 * a second canvas when it calls initRenderer() in its init() method.
 */
export function initRenderer(container: HTMLDivElement): typeof THREE.WebGLRenderer {
  // Return existing renderer if Game3D.tsx already created one
  if ((window as any).__vibexe_renderer__) return (window as any).__vibexe_renderer__;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);

  const onResize = () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener("resize", onResize);
  (renderer as any).__cleanupResize = () => window.removeEventListener("resize", onResize);

  return renderer;
}

// ===== Scene =====

/**
 * Creates a Scene with default lighting:
 * - Ambient light (soft fill)
 * - Directional light (sun) with shadows
 * IDEMPOTENT: Returns existing scene from Game3D.tsx if available.
 */
export function initScene(): typeof THREE.Scene {
  // Return existing scene if Game3D.tsx already created one
  if ((window as any).__vibexe_scene__) return (window as any).__vibexe_scene__;

  const scene = new THREE.Scene();

  // Balanced default lighting — total ~1.0 for clean Phong/cartoon rendering.
  const hemi = new THREE.HemisphereLight(0xEEF4FF, 0x886644, 0.35);
  hemi.name = "HemisphereLight";
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xFFFFFF, 0.15);
  ambient.name = "AmbientLight";
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xFFF8EE, 0.55);
  sun.name = "DirectionalLight";
  sun.position.set(8, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  return scene;
}

// ===== Camera =====

/**
 * Creates a PerspectiveCamera that auto-updates aspect ratio on resize.
 * IDEMPOTENT: Returns existing camera from Game3D.tsx if available.
 */
export function initCamera(
  container: HTMLDivElement,
  fov: number = 60,
  near: number = 0.1,
  far: number = 1000,
): typeof THREE.PerspectiveCamera {
  // Return existing camera if Game3D.tsx already created one
  if ((window as any).__vibexe_camera__) return (window as any).__vibexe_camera__;

  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 8, 15);
  camera.lookAt(0, 2, 0);

  const onResize = () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);
  (camera as any).__cleanupResize = () => window.removeEventListener("resize", onResize);

  return camera;
}

// ===== GLTF Loader (inline — no import needed) =====

/**
 * Loads a GLTF/GLB model. Returns a Promise that resolves to the loaded scene group.
 * Uses Three.js GLTFLoader bundled inline to avoid Sandpack module resolution issues.
 *
 * Usage:
 *   const model = await loadGLTF(modelUrl("platformer-project", "objects/grid_platform.glb"));
 *   scene.add(model);
 */
export async function loadGLTF(url: string): Promise<any> {
  // Auto-correct invalid model names (e.g. platform_8x4x1 → platform_4x4x1)
  url = _autoCorrectModelUrl(url);

  // Use THREE.GLTFLoader if available (loaded via CDN addons), otherwise use inline fetch+parse
  if (THREE.GLTFLoader) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();
      loader.load(
        url,
        (gltf: any) => resolve(gltf.scene),
        undefined,
        (err: any) => reject(err),
      );
    });
  }

  // Inline GLTF loader fallback: fetch + parse JSON + extract geometry
  const response = await fetch(url);
  if (!response.ok) throw new Error(\`Failed to load GLTF: \${url} (\${response.status})\`);

  const contentType = response.headers.get("content-type") || "";

  // GLB (binary) — parse using minimal inline parser
  if (url.endsWith(".glb") || contentType.includes("gltf-binary")) {
    const buffer = await response.arrayBuffer();
    return parseGLB(buffer);
  }

  // GLTF (JSON) — parse and load referenced buffers
  const json = await response.json();
  const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
  return parseGLTFJson(json, baseUrl);
}

// === Minimal GLB parser ===
function parseGLB(buffer: ArrayBuffer): any {
  const view = new DataView(buffer);
  // GLB header: magic(4) + version(4) + length(4)
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546C67) throw new Error("Invalid GLB magic");

  // Chunk 0: JSON
  const jsonLen = view.getUint32(12, true);
  const jsonBytes = new Uint8Array(buffer, 20, jsonLen);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes));

  // Chunk 1: Binary buffer (if present)
  let binBuffer: ArrayBuffer | null = null;
  const chunk1Offset = 20 + jsonLen;
  if (chunk1Offset < buffer.byteLength - 8) {
    const binLen = view.getUint32(chunk1Offset, true);
    binBuffer = buffer.slice(chunk1Offset + 8, chunk1Offset + 8 + binLen);
  }

  return buildSceneFromGLTF(json, binBuffer ? [binBuffer] : []);
}

// === Parse GLTF JSON and load external buffers ===
async function parseGLTFJson(json: any, baseUrl: string): Promise<any> {
  const buffers: ArrayBuffer[] = [];
  if (json.buffers) {
    for (const buf of json.buffers) {
      if (buf.uri) {
        const bufUrl = buf.uri.startsWith("data:") ? buf.uri : baseUrl + buf.uri;
        const resp = await fetch(bufUrl);
        buffers.push(await resp.arrayBuffer());
      }
    }
  }
  return buildSceneFromGLTF(json, buffers);
}

// === Build Three.js scene graph from GLTF data ===
function buildSceneFromGLTF(json: any, buffers: ArrayBuffer[]): any {
  const group = new THREE.Group();

  // Helper to read accessor data
  function getAccessorData(accessorIndex: number): Float32Array | Uint16Array | Uint32Array {
    const accessor = json.accessors[accessorIndex];
    const bufferView = json.bufferViews[accessor.bufferView];
    const buffer = buffers[bufferView.buffer || 0];
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const count = accessor.count;

    const typeSize: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    const numComponents = typeSize[accessor.type] || 1;
    const totalComponents = count * numComponents;

    // componentType: 5126=FLOAT, 5123=UNSIGNED_SHORT, 5125=UNSIGNED_INT
    if (accessor.componentType === 5126) return new Float32Array(buffer, byteOffset, totalComponents);
    if (accessor.componentType === 5123) return new Uint16Array(buffer, byteOffset, totalComponents);
    if (accessor.componentType === 5125) return new Uint32Array(buffer, byteOffset, totalComponents);
    return new Float32Array(buffer, byteOffset, totalComponents);
  }

  // Build meshes from GLTF data
  if (json.meshes) {
    for (const mesh of json.meshes) {
      for (const primitive of mesh.primitives) {
        const geometry = new THREE.BufferGeometry();

        // Position
        if (primitive.attributes.POSITION !== undefined) {
          const posData = getAccessorData(primitive.attributes.POSITION);
          geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(posData), 3));
        }

        // Normals
        if (primitive.attributes.NORMAL !== undefined) {
          const normalData = getAccessorData(primitive.attributes.NORMAL);
          geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normalData), 3));
        }

        // UV
        if (primitive.attributes.TEXCOORD_0 !== undefined) {
          const uvData = getAccessorData(primitive.attributes.TEXCOORD_0);
          geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvData), 2));
        }

        // Vertex colors
        if (primitive.attributes.COLOR_0 !== undefined) {
          const colorData = getAccessorData(primitive.attributes.COLOR_0);
          const accessor = json.accessors[primitive.attributes.COLOR_0];
          const numComponents = accessor.type === "VEC4" ? 4 : 3;
          geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colorData), numComponents));
        }

        // Indices
        if (primitive.indices !== undefined) {
          const indexData = getAccessorData(primitive.indices);
          geometry.setIndex(new THREE.BufferAttribute(
            indexData instanceof Uint32Array ? indexData : new Uint16Array(indexData),
            1,
          ));
        }

        geometry.computeBoundingSphere();

        // Material — use vertex colors if present, otherwise default
        let material: any;
        const hasVertexColors = primitive.attributes.COLOR_0 !== undefined;

        if (json.materials && primitive.material !== undefined) {
          const mat = json.materials[primitive.material];
          const pbr = mat.pbrMetallicRoughness || {};
          const baseColor = pbr.baseColorFactor || [1, 1, 1, 1];
          material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(baseColor[0], baseColor[1], baseColor[2]),
            metalness: pbr.metallicFactor ?? 0,
            roughness: pbr.roughnessFactor ?? 0.8,
            vertexColors: hasVertexColors,
            side: THREE.DoubleSide,
          });
          if (baseColor[3] < 1) {
            material.transparent = true;
            material.opacity = baseColor[3];
          }
          // Texture: extract embedded baseColorTexture from GLB binary buffer
          const baseColorTex = pbr.baseColorTexture;
          if (baseColorTex && json.textures && json.images) {
            const texDef = json.textures[baseColorTex.index];
            if (texDef && texDef.source !== undefined) {
              const imgDef = json.images[texDef.source];
              if (imgDef && imgDef.bufferView !== undefined && buffers.length > 0) {
                const bv = json.bufferViews[imgDef.bufferView];
                const buf = buffers[bv.buffer || 0];
                const imgBytes = new Uint8Array(buf, bv.byteOffset || 0, bv.byteLength);
                const blob = new Blob([imgBytes], { type: imgDef.mimeType || "image/png" });
                const objUrl = URL.createObjectURL(blob);
                const texImg = new Image();
                const tex = new THREE.Texture(texImg);
                texImg.onload = function() { tex.needsUpdate = true; URL.revokeObjectURL(objUrl); };
                texImg.src = objUrl;
                material.map = tex;
                material.needsUpdate = true;
              }
            }
          }
        } else {
          material = new THREE.MeshStandardMaterial({
            color: 0x88cc88,
            vertexColors: hasVertexColors,
            side: THREE.DoubleSide,
          });
        }

        const meshObj = new THREE.Mesh(geometry, material);
        meshObj.castShadow = true;
        meshObj.receiveShadow = true;
        group.add(meshObj);
      }
    }
  }

  // Apply node transforms from the default scene
  if (json.scenes && json.nodes) {
    const sceneIndex = json.scene ?? 0;
    const sceneDef = json.scenes[sceneIndex];
    if (sceneDef && sceneDef.nodes) {
      // If scene has transforms, try to apply root node transform
      for (const nodeIndex of sceneDef.nodes) {
        const node = json.nodes[nodeIndex];
        if (node.scale) group.scale.set(node.scale[0], node.scale[1], node.scale[2]);
        if (node.translation) group.position.set(node.translation[0], node.translation[1], node.translation[2]);
        if (node.rotation) group.quaternion.set(node.rotation[0], node.rotation[1], node.rotation[2], node.rotation[3]);
      }
    }
  }

  return group;
}

// ===== Sky gradient =====

/**
 * Creates a hemisphere-gradient sky background.
 */
export function createSkyGradient(
  scene: any,
  topColor: number = 0x87CEEB,
  bottomColor: number = 0xE0F0FF,
): void {
  scene.background = new THREE.Color(topColor);
  // Hemisphere light for ambient sky color
  const hemi = new THREE.HemisphereLight(topColor, bottomColor, 0.4);
  scene.add(hemi);
}

// ===== Ground plane =====

/**
 * Creates a flat ground plane with optional grid lines.
 */
export function createGround3D(
  scene: any,
  size: number = 100,
  color: number = 0x4a8f4a,
): any {
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid helper for visual reference
  const grid = new THREE.GridHelper(size, size / 2, 0x000000, 0x333333);
  grid.position.y = 0.01;
  (grid.material as any).opacity = 0.15;
  (grid.material as any).transparent = true;
  scene.add(grid);

  return ground;
}

// ===== Collision detection =====

/**
 * Simple distance-based collision check between two 3D objects.
 * Returns true if the distance between their positions is less than threshold.
 */
export function checkCollision(
  a: { position: { x: number; y: number; z: number } },
  b: { position: { x: number; y: number; z: number } },
  threshold: number = 1.5,
): boolean {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const dz = a.position.z - b.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) < threshold;
}

// ===== Box collision (AABB) =====

/**
 * Axis-Aligned Bounding Box collision between two objects with size.
 */
export function checkBoxCollision(
  a: { position: { x: number; y: number; z: number } },
  b: { position: { x: number; y: number; z: number } },
  aSize: { x: number; y: number; z: number },
  bSize: { x: number; y: number; z: number },
): boolean {
  return (
    Math.abs(a.position.x - b.position.x) < (aSize.x + bSize.x) / 2 &&
    Math.abs(a.position.y - b.position.y) < (aSize.y + bSize.y) / 2 &&
    Math.abs(a.position.z - b.position.z) < (aSize.z + bSize.z) / 2
  );
}

// ===== HUD overlay =====

/**
 * Creates an HTML overlay for game HUD (score, lives, etc.).
 * Returns DOM elements that can be updated during gameplay.
 */
export function createHUD(container: HTMLDivElement): {
  wrapper: HTMLDivElement;
  scoreEl: HTMLDivElement;
  livesEl: HTMLDivElement;
  setScore: (score: number) => void;
  setLives: (lives: number) => void;
  update: (data: any) => void;
  destroy: () => void;
} {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:absolute;top:0;left:0;right:0;padding:12px 16px;display:flex;justify-content:space-between;pointer-events:none;z-index:10;font-family:sans-serif;";

  const scoreEl = document.createElement("div");
  scoreEl.style.cssText = "color:#fff;font-size:20px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.5);";
  scoreEl.textContent = "Score: 0";

  const livesEl = document.createElement("div");
  livesEl.style.cssText = "color:#ff4444;font-size:20px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.5);";
  livesEl.textContent = "\\u2764 3";

  wrapper.appendChild(scoreEl);
  wrapper.appendChild(livesEl);
  container.appendChild(wrapper);

  const setScore = (score: number) => { scoreEl.textContent = \`Score: \${score}\`; };
  const setLives = (lives: number) => { livesEl.textContent = "\\u2764 ".repeat(lives).trim(); };

  return {
    wrapper,
    scoreEl,
    livesEl,
    setScore,
    setLives,
    // Flexible update: accepts object {score?, lives?} or positional (score, lives)
    update: (data: any) => {
      if (data && typeof data === "object") {
        if (data.score !== undefined) setScore(data.score);
        if (data.lives !== undefined) setLives(data.lives);
      } else if (typeof data === "number") {
        setScore(data);
      }
    },
    destroy: () => { wrapper.remove(); },
  };
}

// ===== Simple Keyboard State =====

/**
 * Tracks keyboard state for game input.
 * Returns an object with boolean flags for common game keys.
 */
export function createKeyboardState(): {
  keys: Record<string, boolean>;
  destroy: () => void;
} {
  const keys: Record<string, boolean> = {};
  const onDown = (e: KeyboardEvent) => { keys[e.code] = true; };
  const onUp = (e: KeyboardEvent) => { keys[e.code] = false; };
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  return {
    keys,
    destroy: () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    },
  };
}

// ===== CANNON.js Physics Helpers =====
// cannon-es loaded via sync XHR shim triggered by the import statement above.

/**
 * Creates a Cannon.js physics world with sensible defaults.
 * Returns the world instance for use in your game loop.
 *
 * Usage:
 *   const world = createPhysicsWorld();
 *   // In update(): world.step(1/60, delta, 3);
 */
export function createPhysicsWorld(gravity: number = -20): any {
  // IDEMPOTENT: Return existing world if Game3D.tsx already created one
  if ((window as any).__vibexe_world__) return (window as any).__vibexe_world__;

  if (!CANNON) {
    console.warn("cannon-es not loaded — add it to package.json dependencies");
    return null;
  }
  const world = new CANNON.World();
  world.gravity.set(0, gravity, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;
  // Default contact material (medium friction, slight bounce)
  const defaultMat = new CANNON.Material("default");
  const defaultContact = new CANNON.ContactMaterial(defaultMat, defaultMat, {
    friction: 0.4,
    restitution: 0.2,
  });
  world.addContactMaterial(defaultContact);
  world.defaultContactMaterial = defaultContact;
  return world;
}

/**
 * Creates a Cannon.js rigid body.
 * shape: "box" | "sphere" | "plane"
 * mass: 0 = static (platforms, ground), >0 = dynamic (player, enemies)
 * position: {x, y, z}
 * size: for box={x,y,z half-extents}, for sphere=radius (default 0.5)
 */
export function createPhysicsBody(
  shape: "box" | "sphere" | "plane",
  mass: number,
  position: { x: number; y: number; z: number },
  size?: { x: number; y: number; z: number } | number,
): any {
  if (!CANNON) return null;
  let cannonShape: any;
  if (shape === "box") {
    const s = (typeof size === "object" && size) ? size : { x: 0.5, y: 0.5, z: 0.5 };
    cannonShape = new CANNON.Box(new CANNON.Vec3(s.x, s.y, s.z));
  } else if (shape === "sphere") {
    const r = (typeof size === "number") ? size : 0.5;
    cannonShape = new CANNON.Sphere(r);
  } else {
    // Infinite ground plane facing up
    cannonShape = new CANNON.Plane();
  }
  const body = new CANNON.Body({ mass, shape: cannonShape });
  body.position.set(position.x, position.y, position.z);
  if (shape === "plane") {
    // Rotate plane to face upward (default is Z-up)
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  }
  return body;
}

/**
 * Creates a contact material with custom friction and restitution.
 */
export function createContactMaterial(
  world: any,
  friction: number = 0.4,
  restitution: number = 0.3,
): any {
  if (!CANNON || !world) return null;
  const mat = new CANNON.Material();
  const contact = new CANNON.ContactMaterial(mat, mat, { friction, restitution });
  world.addContactMaterial(contact);
  return { material: mat, contactMaterial: contact };
}

/**
 * Syncs a Three.js mesh position/rotation to its Cannon.js body.
 * Call this in update() after world.step().
 */
export function syncMeshToBody(mesh: any, body: any): void {
  if (!mesh || !body) return;
  mesh.userData.__physicsBody = body;
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
}

/**
 * Batch sync all mesh-body pairs. Convenience for update() loops.
 *
 * Usage:
 *   const pairs = [{ mesh: playerMesh, body: playerBody }, ...];
 *   // In update(): syncBodiesToMeshes(pairs);
 */
export function syncBodiesToMeshes(pairs: Array<{ mesh: any; body: any }>): void {
  for (const { mesh, body } of pairs) {
    syncMeshToBody(mesh, body);
  }
}

/**
 * Creates an infinite static ground plane body at y=0.
 */
export function createPhysicsGround(world: any): any {
  if (!CANNON || !world) return null;
  const body = createPhysicsBody("plane", 0, { x: 0, y: 0, z: 0 });
  world.addBody(body);
  return body;
}

// ===== Raycasting Helpers =====

/**
 * Sets up click-to-interact raycasting.
 * When the user clicks on one of the target objects, the callback fires
 * with the intersected object and the intersection point.
 *
 * Returns a cleanup function to remove the event listener.
 *
 * Usage:
 *   const cleanup = onClickObject(camera, container, [building1, building2], (obj, point) => {
 *     console.log("Clicked", obj.name, "at", point);
 *   });
 */
export function onClickObject(
  camera: any,
  container: HTMLElement,
  objects: any[],
  callback: (object: any, point: any) => void,
): () => void {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const handler = (event: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);
    if (intersects.length > 0) {
      // Find the root object from our target list
      let hit = intersects[0].object;
      while (hit.parent && !objects.includes(hit)) {
        hit = hit.parent;
      }
      callback(hit, intersects[0].point);
    }
  };

  container.addEventListener("click", handler);
  return () => container.removeEventListener("click", handler);
}

// ===== Animation Mixer Helper =====

/**
 * Creates an animation player for a GLTF model with animation clips.
 * Returns controls to play/stop named animations and an update() to call each frame.
 *
 * Usage:
 *   const gltf = await new Promise((res, rej) => {
 *     new THREE.GLTFLoader().load(url, res, undefined, rej);
 *   });
 *   const anim = createAnimationPlayer(gltf.scene, gltf.animations);
 *   anim.play("Walk");
 *   // In update(): anim.update(delta);
 */
export function createAnimationPlayer(
  model: any,
  clips: any[],
): {
  mixer: any;
  play: (name: string, crossFade?: number) => void;
  stop: () => void;
  update: (delta: number) => void;
} {
  const mixer = new THREE.AnimationMixer(model);
  let currentAction: any = null;

  return {
    mixer,
    play(name: string, crossFade: number = 0.3) {
      const clip = clips.find((c: any) => c.name === name);
      if (!clip) return;
      const action = mixer.clipAction(clip);
      if (currentAction && currentAction !== action) {
        currentAction.fadeOut(crossFade);
      }
      action.reset().fadeIn(crossFade).play();
      currentAction = action;
    },
    stop() {
      if (currentAction) {
        currentAction.fadeOut(0.2);
        currentAction = null;
      }
    },
    update(delta: number) {
      mixer.update(delta);
    },
  };
}

// ===== OrbitControls Helper =====

/**
 * Creates OrbitControls for camera interaction (rotate, zoom, pan).
 * Best for: city builders, exploration games, isometric views.
 *
 * Usage:
 *   const controls = createOrbitControls(camera, renderer.domElement);
 *   // In update(): controls.update();
 *   // In cleanup(): controls.dispose();
 */
export function createOrbitControls(
  camera: any,
  domElement: HTMLElement,
): any {
  if (!THREE.OrbitControls) {
    console.warn("OrbitControls not loaded — ensure Three.js addons are included");
    return { update() {}, dispose() {} };
  }
  const controls = new THREE.OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 100;
  controls.maxPolarAngle = Math.PI / 2.1; // Prevent going below ground
  controls.target.set(0, 0, 0);
  return controls;
}

// ===== Touch Helpers =====

/**
 * Creates a visible virtual joystick (bottom-left, 120px diameter).
 * Returns { x, y, active, destroy }. x/y range: -1 to 1.
 * Multi-touch safe: tracks a single pointer ID so other fingers
 * (tap-to-jump, shoot, etc.) work simultaneously.
 */
export function createTouchJoystick(container: HTMLElement): {
  x: number; y: number; active: boolean; destroy: () => void;
} {
  const state = { x: 0, y: 0, active: false, destroy: () => {} };
  const SIZE = 120;
  const HALF = SIZE / 2;

  // Base circle
  const base = document.createElement("div");
  base.style.cssText = \`position:absolute;bottom:24px;left:24px;width:\${SIZE}px;height:\${SIZE}px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);z-index:50;touch-action:none;pointer-events:auto;\`;

  // Thumb
  const thumb = document.createElement("div");
  thumb.style.cssText = \`position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.5);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;transition:background 0.1s;\`;
  base.appendChild(thumb);
  container.appendChild(base);

  let startX = 0, startY = 0;
  let joystickPointerId: number | null = null;

  function onPointerDown(e: PointerEvent) {
    if (joystickPointerId !== null) return;
    e.preventDefault();
    joystickPointerId = e.pointerId;
    base.setPointerCapture(e.pointerId);
    const rect = base.getBoundingClientRect();
    startX = rect.left + HALF;
    startY = rect.top + HALF;
    state.active = true;
    thumb.style.background = "rgba(255,255,255,0.7)";
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerId !== joystickPointerId) return;
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > HALF) { dx = (dx / dist) * HALF; dy = (dy / dist) * HALF; }
    state.x = dx / HALF;
    state.y = -dy / HALF; // Invert Y so up = positive
    thumb.style.transform = \`translate(calc(-50% + \${dx}px), calc(-50% + \${dy}px))\`;
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== joystickPointerId) return;
    joystickPointerId = null;
    state.active = false;
    state.x = 0;
    state.y = 0;
    thumb.style.transform = "translate(-50%,-50%)";
    thumb.style.background = "rgba(255,255,255,0.5)";
  }

  base.addEventListener("pointerdown", onPointerDown);
  base.addEventListener("pointermove", onPointerMove);
  base.addEventListener("pointerup", onPointerUp);
  base.addEventListener("pointercancel", onPointerUp);

  state.destroy = () => {
    base.removeEventListener("pointerdown", onPointerDown);
    base.removeEventListener("pointermove", onPointerMove);
    base.removeEventListener("pointerup", onPointerUp);
    base.removeEventListener("pointercancel", onPointerUp);
    base.remove();
  };

  return state;
}

/**
 * Detects taps on the container with left/right half split.
 * onTap(x, y, isLeft) — isLeft=true if tap was on the left half.
 * Multi-touch safe: tracks each pointer independently.
 * Returns cleanup function.
 */
export function createTapDetector(
  container: HTMLElement,
  onTap: (x: number, y: number, isLeft: boolean) => void,
): () => void {
  const pointerStarts = new Map<number, { x: number; y: number; time: number }>();

  function onDown(e: PointerEvent) {
    pointerStarts.set(e.pointerId, { x: e.clientX, y: e.clientY, time: Date.now() });
  }

  function onUp(e: PointerEvent) {
    const start = pointerStarts.get(e.pointerId);
    pointerStarts.delete(e.pointerId);
    if (!start) return;
    const dt = Date.now() - start.time;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dt < 300 && dx < 20 && dy < 20) {
      const rect = container.getBoundingClientRect();
      const isLeft = e.clientX < rect.left + rect.width / 2;
      onTap(e.clientX, e.clientY, isLeft);
    }
  }

  container.addEventListener("pointerdown", onDown);
  container.addEventListener("pointerup", onUp);

  return () => {
    container.removeEventListener("pointerdown", onDown);
    container.removeEventListener("pointerup", onUp);
  };
}

/**
 * Detects 4-directional swipes on the container.
 * onSwipe("left" | "right" | "up" | "down").
 * Returns cleanup function.
 */
export function createSwipeDetector(
  container: HTMLElement,
  onSwipe: (direction: "left" | "right" | "up" | "down") => void,
  threshold: number = 50,
): () => void {
  const pointerStarts = new Map<number, { x: number; y: number; time: number }>();
  const maxTime = 300;

  function onDown(e: PointerEvent) {
    pointerStarts.set(e.pointerId, { x: e.clientX, y: e.clientY, time: Date.now() });
  }

  function onUp(e: PointerEvent) {
    const start = pointerStarts.get(e.pointerId);
    pointerStarts.delete(e.pointerId);
    if (!start) return;
    const dt = Date.now() - start.time;
    if (dt > maxTime) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < threshold && absDy < threshold) return;
    if (absDx > absDy) {
      onSwipe(dx > 0 ? "right" : "left");
    } else {
      onSwipe(dy > 0 ? "down" : "up");
    }
  }

  container.addEventListener("pointerdown", onDown);
  container.addEventListener("pointerup", onUp);

  return () => {
    container.removeEventListener("pointerdown", onDown);
    container.removeEventListener("pointerup", onUp);
  };
}

// ===== HAPTIC FEEDBACK =====
export function hapticFeedback(style: "light" | "medium" | "heavy" = "light") {
  try {
    if ("vibrate" in navigator) {
      const durations = { light: 10, medium: 25, heavy: 50 };
      navigator.vibrate(durations[style]);
    }
  } catch (_) { /* not all devices support vibration */ }
}

// ===== ORIENTATION LOCK =====
export function tryLockLandscape() {
  try {
    const so = screen?.orientation;
    if (so && typeof so.lock === "function") {
      so.lock("landscape").catch(() => {});
    }
  } catch (_) { /* not supported */ }
}

// ===== ANIMATION MIXER AUTO-UPDATE =====
// All animation mixers created by createAnimatedCharacter3D are tracked here.
// Game3D.tsx calls _updateAllMixers3D(delta) every frame — AI never needs to worry about it.
const _activeMixers3D: any[] = [];
function _updateAllMixers3D(delta: number) {
  for (const m of _activeMixers3D) m.update(delta);
}
(window as any)._updateAllMixers3D = _updateAllMixers3D;
(window as any)._activeMixers3D = _activeMixers3D;

// Auto-update character controllers — Game3D.tsx calls this every frame.
// Even if the AI forgets to call controller.update(delta) in its update loop,
// the framework still handles animation state transitions automatically.
const _activeControllers3D: Array<{ update: (delta: number) => void }> = [];
function _updateAllControllers3D(delta: number) {
  for (const ctrl of _activeControllers3D) ctrl.update(delta);
}
(window as any)._activeControllers3D = _activeControllers3D;
(window as any)._updateAllControllers3D = _updateAllControllers3D;

// ===== PARTICLE SYSTEM AUTO-UPDATE =====
const _activeParticles3D: any[] = [];
function _updateAllParticles3D(delta: number) {
  for (let i = _activeParticles3D.length - 1; i >= 0; i--) {
    const p = _activeParticles3D[i];
    if (p._destroyed) { _activeParticles3D.splice(i, 1); continue; }
    p.update(delta);
    // Auto-destroy dead emitters to prevent ghost objects in scene tree
    if (!p.isAlive() && !p._destroyed) { p.destroy(); _activeParticles3D.splice(i, 1); }
  }
}
(window as any)._activeParticles3D = _activeParticles3D;
(window as any)._updateAllParticles3D = _updateAllParticles3D;

// ===== TRIGGER & SPRING AUTO-UPDATE =====
const _activeTriggers3D: any[] = [];
function _updateAllTriggers3D() {
  for (const t of _activeTriggers3D) if (!t._destroyed) t.check();
}
(window as any)._activeTriggers3D = _activeTriggers3D;
(window as any)._updateAllTriggers3D = _updateAllTriggers3D;

const _activeSprings3D: any[] = [];
function _updateAllSprings3D() {
  for (const s of _activeSprings3D) if (!s._destroyed) s.applyForce();
}
(window as any)._activeSprings3D = _activeSprings3D;
(window as any)._updateAllSprings3D = _updateAllSprings3D;

// ===== SPATIAL AUDIO AUTO-UPDATE =====
// Tracks all playSpatial3D() instances with attachTo() — updates panner position each frame.
const _activeSpatial3D: any[] = [];
function _updateAllSpatial3D() {
  for (let i = _activeSpatial3D.length - 1; i >= 0; i--) {
    const s = _activeSpatial3D[i];
    if (s._destroyed) { _activeSpatial3D.splice(i, 1); continue; }
    s._update();
  }
}
(window as any)._activeSpatial3D = _activeSpatial3D;
(window as any)._updateAllSpatial3D = _updateAllSpatial3D;

// ===== KNOWN ANIMATION MAPS =====
// Hardcoded clip name mappings for hosted GLB models.
// AI calls play("idle") → the map resolves to the actual clip name "Idle_5".
const _KNOWN_ANIMATION_MAPS: Record<string, Record<string, string>> = {
  "Warrior_figure_Animations.glb": {
    idle: "Jump_Over_Obstacle_2", run: "Walking", walk: "Left_Short_Hook_from_Guard",
    jump: "Running", attack: "Hit_Reaction_1",
    die: "High_Kick", hit: "Idle_5",
    kick: "Hit_Reaction_1", spin: "Dead",
    hook: "360_Power_Spin_Jump",
    shoot_walk: "Walk_Forward_While_Shooting",
  },
  // KayKit Skeleton characters — common clip aliases
  "Skeleton_Mage.glb": { idle: "Idle", walk: "Walking", run: "Running", attack: "Attack", die: "Death", hit: "Hit" },
  "Skeleton_Minion.glb": { idle: "Idle", walk: "Walking", run: "Running", attack: "Attack", die: "Death", hit: "Hit" },
  "Skeleton_Rogue.glb": { idle: "Idle", walk: "Walking", run: "Running", attack: "Attack", die: "Death", hit: "Hit" },
  "Skeleton_Warrior.glb": { idle: "Idle", walk: "Walking", run: "Running", attack: "Attack", die: "Death", hit: "Hit" },
};
(window as any)._KNOWN_ANIMATION_MAPS = _KNOWN_ANIMATION_MAPS;

// ===== AUDIO SINGLETON =====
let _audioCtx: AudioContext | null = null;
let _masterGain: GainNode | null = null;
let _musicGain: GainNode | null = null;
let _sfxGain: GainNode | null = null;
const _audioCache: Map<string, AudioBuffer> = new Map();
let _currentMusic: { el: HTMLAudioElement; fadeTimer?: any } | null = null;
let _musicMutedVol = 0; // saved volume before mute

/** Mute the currently-playing BGM (if any). Safe to call when nothing is playing. */
export function muteMusic(): void {
  if (_currentMusic) {
    _musicMutedVol = _currentMusic.el.volume;
    _currentMusic.el.volume = 0;
  }
}
/** Unmute the BGM, restoring its previous volume. */
export function unmuteMusic(): void {
  if (_currentMusic) {
    _currentMusic.el.volume = _musicMutedVol || 0.5;
  }
}

const _sfxPool: Map<string, number> = new Map(); // URL → active instance count

function _getAudioContext(): AudioContext {
  if (!_audioCtx) {
    const __gsAudio = ((window as any).__VIBEXE_GAME_SETTINGS__ || {}).audio || {};
    const audioEnabled = __gsAudio.enabled !== false;
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    _masterGain = _audioCtx.createGain();
    _masterGain.gain.value = audioEnabled ? (__gsAudio.masterVolume ?? 0.8) : 0;
    _masterGain.connect(_audioCtx.destination);
    _musicGain = _audioCtx.createGain();
    _musicGain.gain.value = __gsAudio.musicVolume ?? 0.5;
    _musicGain.connect(_masterGain);
    _sfxGain = _audioCtx.createGain();
    _sfxGain.gain.value = __gsAudio.sfxVolume ?? 1.0;
    _sfxGain.connect(_masterGain);
    // Set initial listener orientation so spatial audio works immediately
    // (forward: -Z, up: +Y — matches Three.js default camera orientation)
    try {
      const L = _audioCtx.listener;
      if (L.forwardX) {
        L.forwardX.value = 0; L.forwardY.value = 0; L.forwardZ.value = -1;
        L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      } else if (L.setOrientation) {
        L.setOrientation(0, 0, -1, 0, 1, 0);
      }
    } catch {}
  }
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}
(window as any)._getAudioContext = _getAudioContext;
(window as any)._audioCtx = null; // Updated after first call

// ===== 3D FACTORY HELPERS — Load Platformer Project GLB models =====
// These load real Platformer Project GLB models automatically.
// Each factory: build URL → load GLTF (cached) → scale → position → add to scene → return {mesh, size}.
// "size" = half-extents that plug directly into createPhysicsBody("box", mass, pos, size).

const _modelCache3D: Map<string, any> = new Map();

async function _loadOrClone(url: string): Promise<any> {
  if (_modelCache3D.has(url)) {
    return _modelCache3D.get(url)!.clone();
  }
  const model = await loadGLTF(url);
  console.log("[3D] Loaded GLTF:", url);
  _fixDecorationMaterials(model);
  _modelCache3D.set(url, model);
  return model.clone();
}

// Platformer Project model URL builder
function _ppModelUrl(subpath: string): string {
  return modelUrl("platformer-project", subpath);
}

// KayKit model URL builders (kept for city-builder, resource-bits, skeletons)
function _colorModelUrl(name: string, color: string): string {
  return modelUrl("kaykit-platformer", \`Assets/gltf/\${color}/\${name}_\${color}.gltf\`);
}

function _neutralModelUrl(name: string): string {
  return modelUrl("kaykit-platformer", \`Assets/gltf/neutral/\${name}.gltf\`);
}

/**
 * Fix materials on loaded decoration models for consistent rendering.
 * MeshStandardMaterial (PBR) requires environment maps to look correct.
 * Our scene editor uses basic directional/ambient lights — convert to
 * MeshPhongMaterial which renders predictably without IBL.
 */
function _fixDecorationMaterials(root: any): void {
  root.traverse((child: any) => {
    if (!child.isMesh || !child.material) return;
    const fixMat = (mat: any) => {
      if (!mat.isMeshStandardMaterial) return mat;
      const hasVtxColor = !!(child.geometry?.attributes?.color);
      const phong = new THREE.MeshPhongMaterial({
        color: mat.color ? mat.color.clone() : new THREE.Color(0xcccccc),
        map: mat.map || null,
        normalMap: mat.normalMap || null,
        emissive: new THREE.Color(0x111111),
        emissiveIntensity: 0.15,
        shininess: 12,
        transparent: mat.transparent || false,
        opacity: mat.opacity ?? 1,
        side: mat.side,
        alphaTest: mat.alphaTest || 0,
        vertexColors: hasVtxColor,
      });
      return phong;
    };
    if (Array.isArray(child.material)) {
      child.material = child.material.map(fixMat);
    } else {
      child.material = fixMat(child.material);
    }
  });
}

function _fallbackBox(w: number, h: number, d: number, color: number): any {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ===== Platformer Project model name mappings =====
// Each factory maps a type name to a GLB subpath in the platformer-project pack.
const _PP_PLATFORMS: Record<string, string> = {
  "grid": "objects/grid_platform.glb",
  "grid_platform": "objects/grid_platform.glb",
  "long": "objects/long_platform.glb",
  "long_platform": "objects/long_platform.glb",
  "bouncing": "objects/bouncing_platform.glb",
  "bouncing_platform": "objects/bouncing_platform.glb",
  "round_block": "objects/round_block.glb",
  "halfpipe_in": "objects/halfpipe_in.glb",
  "halfpipe_out": "objects/halfpipe_out.glb",
};

const _PP_COLLECTIBLES: Record<string, string> = {
  "coin": "objects/coin.glb",
  "star": "objects/star.glb",
  "heart": "objects/heart.glb",
  "disc": "objects/disc.glb",
  "diamond": "objects/star.glb", // backward compat alias
};

const _PP_HAZARDS: Record<string, string> = {
  "spikes": "objects/spikes.glb",
  "spikes_panel": "objects/spikes_panel.glb",
  "flamethrower": "objects/flamethrower.glb",
  "log": "objects/log.glb",
};

const _PP_DECORATIONS: Record<string, string> = {
  "sign": "objects/sign.glb",
  "garden": "objects/garden.glb",
  "dice": "objects/dice.glb",
  "sphere": "objects/sphere.glb",
  "checkpoint": "objects/checkpoint.glb",
  "end_panel": "objects/end_panel.glb",
  "item_box": "objects/item_box.glb",
  "button_panel": "objects/button_panel.glb",
  "glider": "objects/glider.glb",
  "lilyhead": "objects/lilyhead.glb",
};

// Size estimates for platformer-project models (half-extents for physics)
const _PP_PLATFORM_SIZES: Record<string, { x: number; y: number; z: number }> = {
  "grid": { x: 2, y: 0.25, z: 2 },
  "grid_platform": { x: 2, y: 0.25, z: 2 },
  "long": { x: 4, y: 0.25, z: 1 },
  "long_platform": { x: 4, y: 0.25, z: 1 },
  "bouncing": { x: 1.5, y: 0.3, z: 1.5 },
  "bouncing_platform": { x: 1.5, y: 0.3, z: 1.5 },
  "round_block": { x: 1, y: 1, z: 1 },
  "halfpipe_in": { x: 2, y: 1, z: 2 },
  "halfpipe_out": { x: 2, y: 1, z: 2 },
};

/**
 * Auto-correct invalid model URLs. For kaykit-platformer, snaps dimension variants.
 * Platformer-project models don't need correction (named models, not dimensions).
 */
function _autoCorrectModelUrl(url: string): string {
  // Only KayKit platformer needs dimension snapping
  const idx = url.indexOf("kaykit-platformer/Assets/gltf/");
  if (idx < 0) return url;

  const afterPack = url.substring(idx + "kaykit-platformer/Assets/gltf/".length);
  const parts = afterPack.split("/");
  if (parts.length !== 2) return url;

  const color = parts[0];
  const filename = parts[1];
  if (color === "neutral") return url;

  const suffix = \`_\${color}.gltf\`;
  if (!filename.endsWith(suffix)) return url;
  const baseName = filename.slice(0, -suffix.length);

  const _VALID_PLATFORMS = ["1x1x1","2x2x1","2x2x2","2x2x4","4x2x1","4x2x2","4x2x4","4x4x1","4x4x2","4x4x4","6x2x1","6x2x2","6x2x4","6x6x1","6x6x2","6x6x4"];
  const _VALID_BARRIERS = ["1x1x1","1x1x2","1x1x4","2x1x1","2x1x2","2x1x4","3x1x1","3x1x2","3x1x4","4x1x1","4x1x2","4x1x4"];

  if (baseName.startsWith("platform_")) {
    const variant = baseName.slice("platform_".length);
    // Only snap dimension-style variants (NxNxN). Skip named variants like slope_2x2x2, arrow_*, etc.
    if (/^\d+x\d+x\d+$/.test(variant) && !_VALID_PLATFORMS.includes(variant)) {
      const rp = variant.split("x").map(Number);
      const rVol = (rp[0]||4) * (rp[1]||4) * (rp[2]||1);
      let best = _VALID_PLATFORMS[0], bestDiff = Infinity;
      for (const v of _VALID_PLATFORMS) {
        const vp = v.split("x").map(Number);
        const diff = Math.abs(vp[0]*vp[1]*vp[2] - rVol);
        if (diff < bestDiff) { bestDiff = diff; best = v; }
      }
      console.warn(\`[3D] Invalid variant "\${variant}" → snapped to "\${best}"\`);
      return url.substring(0, url.lastIndexOf("/") + 1) + \`platform_\${best}_\${color}.gltf\`;
    }
  } else if (baseName.startsWith("barrier_")) {
    const variant = baseName.slice("barrier_".length);
    // Only snap dimension-style variants (NxNxN)
    if (/^\d+x\d+x\d+$/.test(variant) && !_VALID_BARRIERS.includes(variant)) {
      const rp = variant.split("x").map(Number);
      const rVol = (rp[0]||4) * (rp[1]||4) * (rp[2]||1);
      let best = _VALID_BARRIERS[0], bestDiff = Infinity;
      for (const v of _VALID_BARRIERS) {
        const vp = v.split("x").map(Number);
        const diff = Math.abs(vp[0]*vp[1]*vp[2] - rVol);
        if (diff < bestDiff) { bestDiff = diff; best = v; }
      }
      console.warn(\`[3D] Invalid variant "\${variant}" → snapped to "\${best}"\`);
      return url.substring(0, url.lastIndexOf("/") + 1) + \`barrier_\${best}_\${color}.gltf\`;
    }
  }

  return url;
}

/**
 * Creates a platform at (x, y, z) using Platformer Project GLB models.
 * Returns { mesh, size } — size = half-extents for createPhysicsBody().
 *
 * Usage:
 *   const { mesh, size } = await createPlatform3D(scene, 0, 1, -5);
 *   const body = createPhysicsBody("box", 0, {x:0, y:1, z:-5}, size);
 *   world.addBody(body);
 */
export async function createPlatform3D(
  scene: any, x: number, y: number, z: number,
  opts?: { type?: string; variant?: string; color?: string; scale?: number; _pack?: string; _path?: string },
): Promise<{ mesh: any; size: { x: number; y: number; z: number } }> {
  const type = opts?.type || opts?.variant || "grid";
  const scale = opts?.scale || SCALES_3D.platform;
  const typeKey = type.replace(/_platform$/, ""); // normalize "grid_platform" → "grid"
  const halfExtents = _PP_PLATFORM_SIZES[type] || _PP_PLATFORM_SIZES[typeKey] || { x: 2, y: 0.25, z: 2 };
  const scaledSize = { x: halfExtents.x * scale, y: halfExtents.y * scale, z: halfExtents.z * scale };

  let mesh: any;
  try {
    let url: string;
    if (opts?._pack && opts?._path) {
      url = modelUrl(opts._pack, opts._path);
    } else {
      const subpath = _PP_PLATFORMS[type] || _PP_PLATFORMS[typeKey] || _PP_PLATFORMS["grid"];
      url = _ppModelUrl(subpath);
    }
    mesh = await _loadOrClone(url);
    mesh.scale.setScalar(scale);
  } catch (err) {
    console.warn("[3D] createPlatform3D fallback — failed to load:", type, err);
    mesh = _fallbackBox(scaledSize.x * 2, scaledSize.y * 2, scaledSize.z * 2, 0x4488cc);
  }
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.name = \`Platform_\${type}\`;
  mesh.userData.vibexeType = "platform";
  mesh.userData.vibexeFactory = "createPlatform3D";
  mesh.userData.vibexeArgs = { x, y, z, type, scale };
  scene.add(mesh);
  return { mesh, size: scaledSize };
}

/**
 * Creates a collectible (coin, star, heart, disc) at (x, y, z).
 * Returns { mesh, size } for collision distance.
 *
 * Usage:
 *   const { mesh } = await createCollectible3D(scene, 3, 2, -8, { type: "star" });
 */
export async function createCollectible3D(
  scene: any, x: number, y: number, z: number,
  opts?: { type?: string; color?: string; scale?: number; _pack?: string; _path?: string },
): Promise<{ mesh: any; size: { x: number; y: number; z: number } }> {
  const type = opts?.type || "coin";
  const scale = opts?.scale || SCALES_3D.collectible;
  const halfSize = scale * 0.5;

  let mesh: any;
  try {
    let url: string;
    if (opts?._pack && opts?._path) {
      url = modelUrl(opts._pack, opts._path);
    } else {
      const subpath = _PP_COLLECTIBLES[type] || _PP_COLLECTIBLES["coin"];
      url = _ppModelUrl(subpath);
    }
    mesh = await _loadOrClone(url);
    mesh.scale.setScalar(scale);
  } catch (err) {
    console.warn("[3D] createCollectible3D fallback — failed to load:", type, err);
    mesh = _fallbackBox(scale, scale, scale, 0xffdd44);
    mesh.material.emissive = new THREE.Color(0xffdd44);
    mesh.material.emissiveIntensity = 0.3;
  }
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.name = \`Collectible_\${type}\`;
  mesh.userData.vibexeType = "collectible";
  mesh.userData.vibexeFactory = "createCollectible3D";
  mesh.userData.vibexeArgs = { x, y, z, type, scale };
  scene.add(mesh);
  return { mesh, size: { x: halfSize, y: halfSize, z: halfSize } };
}

/**
 * Creates a simple player model at (x, y, z).
 * For animated Lily character, use createAnimatedCharacter3D instead.
 * Returns { mesh, size } for physics body sizing.
 *
 * Usage:
 *   const { mesh, size } = await createPlayer3D(scene, 0, 2, 0);
 *   const body = createPhysicsBody("sphere", 5, {x:0, y:2, z:0}, size.x);
 */
export async function createPlayer3D(
  scene: any, x: number, y: number, z: number,
  opts?: { model?: string; color?: string; scale?: number; neutral?: boolean; _pack?: string; _path?: string },
): Promise<{ mesh: any; size: { x: number; y: number; z: number } }> {
  const model = opts?.model || "sphere";
  const scale = opts?.scale || SCALES_3D.player;
  const halfSize = scale * 0.6;

  let mesh: any;
  try {
    let url: string;
    if (opts?._pack && opts?._path) {
      url = modelUrl(opts._pack, opts._path);
    } else {
      // Try platformer-project objects first, then KayKit fallback
      const ppPath = model === "sphere" ? "objects/sphere.glb"
        : model === "lilyhead" ? "objects/lilyhead.glb"
        : \`objects/\${model}.glb\`;
      url = _ppModelUrl(ppPath);
    }
    mesh = await _loadOrClone(url);
    mesh.scale.setScalar(scale);
  } catch (err) {
    console.warn("[3D] createPlayer3D fallback — failed to load:", model, err);
    mesh = _fallbackBox(scale, scale * 1.5, scale, 0x4488ff);
  }
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.name = \`Player_\${model}\`;
  mesh.userData.vibexeType = "player";
  mesh.userData.__isPlayerCharacter = true;
  mesh.userData.vibexeFactory = "createPlayer3D";
  mesh.userData.vibexeArgs = { x, y, z, model, scale };
  scene.add(mesh);
  return { mesh, size: { x: halfSize, y: halfSize, z: halfSize } };
}

/**
 * Creates a hazard/barrier at (x, y, z) using Platformer Project models.
 * Returns { mesh, size } for physics body.
 *
 * Usage:
 *   const { mesh, size } = await createBarrier3D(scene, 5, 0.5, -10, { type: "spikes" });
 */
export async function createBarrier3D(
  scene: any, x: number, y: number, z: number,
  opts?: { type?: string; variant?: string; color?: string; scale?: number; neutral?: boolean; _pack?: string; _path?: string },
): Promise<{ mesh: any; size: { x: number; y: number; z: number } }> {
  const type = opts?.type || opts?.variant || "spikes";
  const scale = opts?.scale || 1.0;
  const halfExtents = { x: scale, y: scale * 0.5, z: scale };

  let mesh: any;
  try {
    let url: string;
    if (opts?._pack && opts?._path) {
      url = modelUrl(opts._pack, opts._path);
    } else {
      const subpath = _PP_HAZARDS[type] || _PP_HAZARDS["spikes"];
      url = _ppModelUrl(subpath);
    }
    mesh = await _loadOrClone(url);
    mesh.scale.setScalar(scale);
  } catch (err) {
    console.warn("[3D] createBarrier3D fallback — failed to load:", type, err);
    mesh = _fallbackBox(scale * 2, scale, scale * 2, 0xcc4444);
  }
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = \`Barrier_\${type}\`;
  mesh.userData.vibexeType = "barrier";
  mesh.userData.vibexeFactory = "createBarrier3D";
  mesh.userData.vibexeArgs = { x, y, z, type, scale };
  scene.add(mesh);
  return { mesh, size: halfExtents };
}

/**
 * Creates a decoration/interactive object at (x, y, z).
 * Uses Platformer Project models by default. For KayKit city-builder/resource-bits,
 * use _pack and _path options.
 *
 * Usage:
 *   const { mesh } = await createDecoration3D(scene, -5, 0, -8, { type: "checkpoint" });
 *   const { mesh } = await createDecoration3D(scene, 0, 0, 0, { type: "building_A", _pack: "kaykit-city-builder", _path: "Assets/gltf/building_A.gltf" });
 */
export async function createDecoration3D(
  scene: any, x: number, y: number, z: number,
  opts?: { type?: string; color?: string; scale?: number; neutral?: boolean; _pack?: string; _path?: string },
): Promise<{ mesh: any; size: { x: number; y: number; z: number } }> {
  const type = opts?.type || "sign";
  const scale = opts?.scale || 1.0;
  const _pack = opts?._pack;
  const _path = opts?._path;

  let mesh: any;
  try {
    let url: string;
    if (_pack && _path) {
      // Multi-pack: use explicit pack + path (city-builder, resource-bits, etc.)
      url = modelUrl(_pack, _path);
    } else {
      // Default: platformer-project objects
      const subpath = _PP_DECORATIONS[type] || \`objects/\${type}.glb\`;
      url = _ppModelUrl(subpath);
    }
    mesh = await _loadOrClone(url);
    mesh.scale.setScalar(scale);
  } catch (err) {
    console.warn("[3D] createDecoration3D fallback — failed to load:", type, err);
    mesh = _fallbackBox(scale * 2, scale * 4, scale * 2, 0x888888);
  }
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = \`Decoration_\${type}\`;
  mesh.userData.vibexeType = "decoration";
  mesh.userData.vibexeFactory = "createDecoration3D";
  mesh.userData.vibexeArgs = { x, y, z, type, scale, ...(_pack ? { _pack } : {}), ...(_path ? { _path } : {}) };
  scene.add(mesh);
  return { mesh, size: { x: scale, y: scale * 2, z: scale } };
}

// ===== ANIMATED CHARACTER FACTORY =====
// Loads a GLB model WITH skeletal animations (from Meshy.ai or similar).
// Returns mesh + play(clipName) function for animation control.
// Mixers are auto-updated by Game3D.tsx — no manual mixer.update() needed.

/**
 * Creates an animated 3D character (e.g., Meshy.ai warrior) at (x, y, z).
 * The GLB must contain embedded animation clips.
 *
 * Returns:
 *   mesh   — the loaded THREE.Group
 *   mixer  — THREE.AnimationMixer (auto-updated each frame)
 *   clips  — array of animation clip names found in the GLB
 *   play   — play("idle") starts that clip; fuzzy-matches by keyword
 *   stop   — stop all animations
 *   size   — bounding-box half-extents for physics
 *
 * Usage:
 *   const char = await createAnimatedCharacter3D(scene, 0, 0, 0, {
 *     url: modelUrl("meshy-characters", "Warrior_figure_Animations.glb"),
 *   });
 *   char.play("idle");               // start idle animation
 *   // later:
 *   char.play("running", { crossfade: 0.3 }); // smooth transition to run
 *   console.log(char.clips);          // ["Idle 5", "Running", "Walking", ...]
 */
export async function createAnimatedCharacter3D(
  scene: any, x: number, y: number, z: number,
  opts: { url: string; rotation?: number; targetHeight?: number },
): Promise<{
  mesh: any;
  mixer: any;
  clips: string[];
  play: (name: string, opts?: { loop?: boolean; crossfade?: number }) => void;
  stop: () => void;
  size: { x: number; y: number; z: number };
}> {
  // ALWAYS use SCALES_3D — ignore opts.targetHeight (AI passes huge values like 1.8 causing 100x+ scale)
  const targetHeight = SCALES_3D.animatedCharacter;
  const loader = new THREE.GLTFLoader();

  const gltf: any = await new Promise((resolve, reject) => {
    loader.load(opts.url, resolve, undefined, reject);
  });
  console.log("[3D] Loaded animated GLB:", opts.url, "clips:", gltf.animations?.length || 0);

  const inner = gltf.scene;
  inner.traverse((child: any) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // --- Auto-upright detection ---
  // Measure raw bounding box before any transforms
  const rawBox = new THREE.Box3().setFromObject(inner);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);
  console.log("[3D] Raw model size:", rawSize.x.toFixed(2), rawSize.y.toFixed(2), rawSize.z.toFixed(2));

  // If the model is "lying flat" (Y is the smallest axis and X or Z is taller),
  // it was exported Z-up. Rotate -90° on X to stand it upright.
  const maxHoriz = Math.max(rawSize.x, rawSize.z);
  if (rawSize.y < maxHoriz * 0.5) {
    inner.rotation.x = -Math.PI / 2;
    console.log("[3D] Auto-upright: rotated -90° on X (Z-up model detected)");
  }

  // --- Unity export Root bone fix (detection only) ---
  // Unity GLTF exports often bake a 180° Z rotation into the Root bone (handedness conversion).
  // Combined with Hips at -90° X, this causes the character to render face-down.
  // We detect here but apply the rotation AFTER pivot correction so measurements stay correct.
  let _needsUnityRootFix = false;
  if (inner.rotation.x === 0) {
    let _unityRootBone: any = null;
    inner.traverse((child: any) => {
      if (child.isBone && !_unityRootBone && child.name.toLowerCase() === "root") {
        _unityRootBone = child;
      }
    });
    if (_unityRootBone) {
      const qz = Math.abs(_unityRootBone.quaternion.z);
      const qw = Math.abs(_unityRootBone.quaternion.w);
      if (qz > 0.95 && qw < 0.1) {
        _needsUnityRootFix = true;
        console.log("[3D] Unity Root bone fix: detected Root bone 180° Z (will apply after pivot)");
      }
    }
  }

  // --- Measure ACTUAL rendered size using boneTransform (SkinnedMesh) ---
  // Box3.setFromObject only measures bind-pose geometry (can be 0.02 units for a
  // model whose bones expand it to 2+ units at render time). We MUST account for
  // bone deformation or the autoScale will be wildly too large.
  inner.updateMatrixWorld(true);
  let measuredHeight = 0;
  let measuredMinY = Infinity;
  let measuredMaxY = -Infinity;
  let usedBoneTransform = false;

  // Play first animation frame so bones are in a real pose (not flat bind pose)
  const tempClips = gltf.animations || [];
  if (tempClips.length > 0) {
    const tempMixer = new THREE.AnimationMixer(inner);
    tempMixer.clipAction(tempClips[0]).play();
    tempMixer.update(0);
  }

  inner.traverse((child: any) => {
    if (usedBoneTransform) return;
    if (child.isSkinnedMesh && child.skeleton && typeof child.boneTransform === "function") {
      try {
        child.skeleton.update();
        const posCount = child.geometry.attributes.position.count;
        const step = Math.max(1, Math.floor(posCount / 200));
        const v4 = new THREE.Vector4();
        let minY = Infinity, maxY = -Infinity;
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < posCount; i += step) {
          child.boneTransform(i, v4);
          if (v4.y < minY) minY = v4.y;
          if (v4.y > maxY) maxY = v4.y;
          if (v4.x < minX) minX = v4.x;
          if (v4.x > maxX) maxX = v4.x;
          if (v4.z < minZ) minZ = v4.z;
          if (v4.z > maxZ) maxZ = v4.z;
        }
        const boneH = maxY - minY;
        if (boneH > 0.001) {
          measuredHeight = boneH;
          measuredMinY = minY;
          measuredMaxY = maxY;
          usedBoneTransform = true;
          console.log("[3D] Bone-deformed size:", (maxX-minX).toFixed(3), boneH.toFixed(3), (maxZ-minZ).toFixed(3));
        }
      } catch (e) { /* boneTransform not available in this Three.js version */ }
    }
  });

  // Fallback: use geometry bounding box (for non-skinned models)
  if (!usedBoneTransform) {
    const corrBox = new THREE.Box3().setFromObject(inner);
    const corrSize = new THREE.Vector3();
    corrBox.getSize(corrSize);
    measuredHeight = corrSize.y || 1;
    measuredMinY = corrBox.min.y;
    console.log("[3D] Geometry size (no bones):", corrSize.x.toFixed(3), corrSize.y.toFixed(3), corrSize.z.toFixed(3));
  }

  // Cap autoScale at 1 — SkinnedMesh bone deformation expands models ~100x beyond bind-pose geometry.
  // Warrior GLB: bind-pose 0.017 units, bones expand to ~1.7 units at render.
  // With cap of 1: 0.017 * 1 * ~100x bone expansion → rendered ~1.7 units (proportional to 4x4x1 platforms).
  const MAX_AUTO_SCALE = 1;
  const rawAutoScale = targetHeight / measuredHeight;
  const autoScale = Math.min(rawAutoScale, MAX_AUTO_SCALE);
  inner.scale.setScalar(autoScale);
  if (rawAutoScale > MAX_AUTO_SCALE) {
    console.log("[3D] Auto-scale CAPPED:", autoScale.toFixed(3), "(raw was " + rawAutoScale.toFixed(1) + ", capped at " + MAX_AUTO_SCALE + ")");
  } else {
    console.log("[3D] Auto-scale:", autoScale.toFixed(3), "(" + measuredHeight.toFixed(3) + " → " + targetHeight + " units)");
  }

  // --- Pivot correction AFTER scaling ---
  // For bone-deformed models, use the bone-measured minY for feet placement
  inner.updateMatrixWorld(true);
  const scaledMinY = measuredMinY * autoScale;
  const pivotBox = new THREE.Box3().setFromObject(inner);
  const pivotCenter = new THREE.Vector3();
  pivotBox.getCenter(pivotCenter);
  const pivot = new THREE.Group();
  pivot.add(inner);
  // Use bone-measured minY (feet) for Y offset, geometry center for XZ
  pivot.position.set(-pivotCenter.x, -scaledMinY, -pivotCenter.z);

  // Wrapper Group: world position only, scale stays at 1
  const mesh = new THREE.Group();
  const urlParts = opts.url.split("/");
  const fileName = urlParts[urlParts.length - 1].replace(/\.(glb|gltf)$/i, "");
  mesh.name = "Character_" + fileName;
  mesh.userData = { vibexeType: "AnimatedCharacter", vibexeFactory: "createAnimatedCharacter3D", __isPlayerCharacter: true };
  mesh.userData.vibexeArgs = { x: x, y: y, z: z, url: opts.url };
  mesh.add(pivot);
  mesh.position.set(x, y, z);
  if (opts.rotation !== undefined) mesh.rotation.y = opts.rotation;

  // --- Apply deferred Unity Root bone fix ---
  // Applied AFTER pivot correction so measurements used the un-rotated geometry.
  // Unity GLTF exports bake 180° Z into Root bone (LH→RH conversion).
  // Combined with Hips -90° X, character lies face-down. -PI/2 X rotation stands her upright.
  // (PI would only flip face-down→face-up, still horizontal. -PI/2 rotates to vertical.)
  if (_needsUnityRootFix) {
    inner.rotation.x = -Math.PI / 2;
    // Recalculate pivot Y so feet touch ground after rotation.
    // The original pivot was calculated for face-down bind-pose; after -90° X rotation
    // the character stands upright but feet may float above the mesh origin.
    inner.updateMatrixWorld(true);
    pivot.updateMatrixWorld(true);
    mesh.updateMatrixWorld(true);
    const _footBoneNames = new Set(["foot_l", "foot_r", "toes_l", "toes_r", "leftfoot", "rightfoot", "lefttoebase", "righttoebase"]);
    let _lowestFootY = Infinity;
    const _wp = new THREE.Vector3();
    inner.traverse((child: any) => {
      if (child.isBone && _footBoneNames.has(child.name.toLowerCase())) {
        child.getWorldPosition(_wp);
        if (_wp.y < _lowestFootY) _lowestFootY = _wp.y;
      }
    });
    if (_lowestFootY !== Infinity) {
      const _feetOffset = _lowestFootY - mesh.position.y;
      if (Math.abs(_feetOffset) > 0.01) {
        pivot.position.y -= _feetOffset;
        console.log("[3D] Unity Root bone fix: pivot Y adjusted by " + (-_feetOffset).toFixed(4) + " to ground feet (feet were " + _feetOffset.toFixed(4) + " above ground)");
      }
    }
    // Foot bones sit inside the shoe mesh — sole geometry extends below the bone.
    // Raise the model slightly so the shoe sole touches the ground instead of clipping through.
    const _soleRaise = targetHeight * 0.07;
    pivot.position.y += _soleRaise;
    console.log("[3D] Unity Root bone fix: applied -90° X rotation + sole raise " + _soleRaise.toFixed(4));
  }

  scene.add(mesh);

  // Physics half-extents based on target height
  const halfExtents = { x: targetHeight * 0.3, y: targetHeight / 2, z: targetHeight * 0.3 };

  // Store correct character bounds for editor BoxHelper override.
  // SkinnedMesh bind-pose geometry gives wrong Box3 — editor needs these manual bounds.
  mesh.userData.__characterBounds = {
    halfX: halfExtents.x,
    halfZ: halfExtents.z,
    height: targetHeight,
  };

  console.log("[3D] Character final: targetH=" + targetHeight + ", autoScale=" + autoScale.toFixed(3) + ", boneDeformed=" + usedBoneTransform);

  // --- Strip root motion + scale tracks from animation clips ---
  // Only lock XZ position on the actual root bone (Hips), NOT all bones.
  // Three.js r128 GLTFLoader uses bare node names ("Hips.position", not "Armature/Hips.position"),
  // so depth-based detection fails — all bones appear at depth 1.
  const _ROOT_BONE_NAMES = new Set([
    "hips", "root", "mixamorig:hips", "mixamorigHips", "mixamorig_hips",
    "pelvis", "rootnode", "root_bone", "bip001", "bip01", "hip",
  ]);
  const allClips = gltf.animations || [];
  for (const clip of allClips) {
    for (let ti = clip.tracks.length - 1; ti >= 0; ti--) {
      const track = clip.tracks[ti];
      const isPos = track.name.endsWith(".position");
      const isScale = track.name.endsWith(".scale");
      if (!isPos && !isScale) continue;
      const suffix = isPos ? ".position" : ".scale";
      const nodePath = track.name.replace(suffix, "");
      if (nodePath === "") {
        // Scene root — remove entirely (prevents overriding our autoScale or position)
        clip.tracks.splice(ti, 1);
      } else if (isPos && _ROOT_BONE_NAMES.has(nodePath.toLowerCase())) {
        // Root bone position: lock XZ, keep Y for hip bobbing
        if (track.values && track.values.length >= 3) {
          const firstX = track.values[0];
          const firstZ = track.values[2];
          for (let j = 0; j < track.values.length; j += 3) {
            track.values[j] = firstX;
            track.values[j + 2] = firstZ;
          }
        }
      }
    }
  }

  // Animation setup — mixer targets inner (gltf.scene at original scale)
  const mixer = new THREE.AnimationMixer(inner);
  _activeMixers3D.push(mixer);

  const clipMap: Record<string, any> = {};
  const clipNames: string[] = [];
  for (const clip of allClips) {
    clipMap[clip.name] = clip;
    clipNames.push(clip.name);
  }
  console.log("[3D] Animation clips:", clipNames);

  let _currentAction: any = null;

  // Scored partial keyword match — prefers:
  //   3: clip name starts with keyword ("walk" → "Walking" over "Walk_Forward_While_Shooting")
  //   2: keyword at word boundary ("jump" → "Jump_Over_Obstacle" over "360_Power_Spin_Jump")
  //   1: keyword anywhere in name
  // Among same priority, shortest clip name wins.
  function _bestPartial(keyword: string): any {
    let best: string | null = null;
    let bestPri = 0;
    let bestLen = Infinity;
    for (const cn of clipNames) {
      const cl = cn.toLowerCase();
      if (!cl.includes(keyword)) continue;
      let pri: number;
      if (cl.startsWith(keyword)) {
        pri = 3;
      } else if (cl.includes("_" + keyword) || cl.includes(" " + keyword)) {
        pri = 2;
      } else {
        pri = 1;
      }
      if (pri > bestPri || (pri === bestPri && cn.length < bestLen)) {
        best = cn; bestPri = pri; bestLen = cn.length;
      }
    }
    return best ? clipMap[best] : null;
  }

  function findClip(name: string): any {
    // 1. Exact match
    if (clipMap[name]) return clipMap[name];
    // 2. Case-insensitive exact
    const lower = name.toLowerCase();
    for (const cn of clipNames) {
      if (cn.toLowerCase() === lower) return clipMap[cn];
    }
    // 3. Best scored partial match
    const partial = _bestPartial(lower);
    if (partial) return partial;
    // 4. Common aliases (scored)
    const aliases: Record<string, string[]> = {
      idle: ["idle"],
      run: ["running", "run"],
      walk: ["walking", "walk"],
      jump: ["jump", "leap"],
      attack: ["slash", "attack", "kick", "hook", "punch", "spin"],
      die: ["dead", "death", "die"],
      hit: ["hit", "reaction", "damage"],
    };
    const aliasKeys = aliases[lower];
    if (aliasKeys) {
      for (const kw of aliasKeys) {
        const m = _bestPartial(kw);
        if (m) return m;
      }
    }
    console.warn("[3D] Animation clip not found:", name, "Available:", clipNames);
    return null;
  }

  function play(name: string, playOpts?: { loop?: boolean; crossfade?: number }) {
    const clip = findClip(name);
    if (!clip) return;
    const action = mixer.clipAction(clip);

    // IDEMPOTENT: If same animation is already playing, do nothing.
    // This makes play() safe to call every frame (e.g. in update loop).
    if (_currentAction === action && action.isRunning()) return;

    const loop = playOpts?.loop !== false; // default true
    action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
    if (!loop) action.clampWhenFinished = true;

    if (_currentAction && _currentAction !== action) {
      const fade = playOpts?.crossfade ?? 0.25;
      action.reset().fadeIn(fade).play();
      _currentAction.fadeOut(fade);
    } else {
      action.reset().play();
    }
    _currentAction = action;
  }

  function stop() {
    mixer.stopAllAction();
    _currentAction = null;
  }

  // Auto-play idle so the character is always animating from the start.
  // AI code can switch to "walk"/"run" later via character.play("walk").
  play("idle");

  // Store animation data on mesh.userData for editor access
  mesh.userData.__clipNames = clipNames;
  mesh.userData.__play = play;
  mesh.userData.__stop = stop;
  mesh.userData.__currentClip = () => _currentAction?.getClip()?.name || null;
  mesh.userData.__pause = () => { if (_currentAction) _currentAction.paused = true; };
  mesh.userData.__resume = () => { if (_currentAction) _currentAction.paused = false; };
  mesh.userData.__getTime = () => ({
    time: _currentAction?.time ?? 0,
    duration: _currentAction?.getClip()?.duration ?? 0,
    clipName: _currentAction?.getClip()?.name ?? null,
    paused: _currentAction?.paused ?? false,
  });
  mesh.userData.__setTime = (t: number) => {
    if (_currentAction) { _currentAction.time = t; mixer.update(0); }
  };
  mesh.userData.__clipDurations = Object.fromEntries(
    allClips.map((c: any) => [c.name, c.duration])
  );

  // Auto-apply known animation map if URL matches a hosted model
  let _mapApplied = false;
  for (const [urlPattern, map] of Object.entries(_KNOWN_ANIMATION_MAPS)) {
    if (opts.url.includes(urlPattern)) {
      mesh.userData.__animMap = map;
      console.log("[3D] Auto-applied animation map for:", urlPattern);
      _mapApplied = true;
      break;
    }
  }
  // No known map found — auto-classify clips by name/duration heuristics
  if (!_mapApplied && allClips.length > 0) {
    const autoMap = _classifyClips(allClips);
    if (Object.keys(autoMap).length > 0) {
      mesh.userData.__animMap = autoMap;
      console.log("[3D] Auto-classified animation map:", autoMap);
    }
  }

  return { mesh, mixer, clips: clipNames, play, stop, size: halfExtents };
}

// ===== CHARACTER CONTROLLER =====
// Automatically manages animation states based on physics velocity.
// Handles idle/walk/run/jump/attack transitions + facing direction.

/**
 * Creates a character controller that auto-switches animations based on physics velocity.
 * Call controller.update(delta) every frame — it syncs mesh position, faces movement direction,
 * and transitions between idle/walk/run/jump/attack automatically.
 *
 * Usage:
 *   const warrior = await createAnimatedCharacter3D(scene, 0, 3, 0, { url: ... });
 *   const playerBody = createPhysicsBody("box", 5, {x:0, y:3, z:0}, warrior.size);
 *   const controller = createCharacterController3D(warrior, playerBody);
 *   // In update(): controller.update(delta);
 *   // Attack button: controller.attack();
 *   // Jump button: controller.jump();
 */
export function createCharacterController3D(
  character: { mesh: any; play: Function; stop: Function; clips: string[] },
  physicsBody: any,
  opts?: {
    walkSpeed?: number;
    runSpeed?: number;
    jumpAnim?: string;
    attackAnim?: string;
    idleAnim?: string;
    walkAnim?: string;
    runAnim?: string;
  }
): {
  update: (delta: number) => void;
  attack: () => void;
  jump: () => void;
  readonly state: string;
} {
  // Store physics body reference on mesh for Scene Editor overrides
  if (character.mesh && physicsBody) {
    character.mesh.userData.__physicsBody = physicsBody;
  }

  const WALK_SPEED = opts?.walkSpeed ?? 0.5;
  const RUN_SPEED = opts?.runSpeed ?? 5;
  const idleAnim = opts?.idleAnim ?? "idle";
  const walkAnim = opts?.walkAnim ?? "walk";
  const runAnim = opts?.runAnim ?? "run";
  const jumpAnim = opts?.jumpAnim ?? "jump";
  const attackAnim = opts?.attackAnim ?? "attack";

  let state = "idle";
  let isAttacking = false;
  let attackTimer = 0;
  let stateTimer = 0; // How long we've been in current state
  const MIN_STATE_HOLD = 0.15; // Minimum seconds before allowing state change (prevents flicker)
  // Track mesh position for direct-movement detection (AI may move mesh without physics)
  let lastMeshX = character.mesh.position.x;
  let lastMeshZ = character.mesh.position.z;
  // Frame guard: prevent double-update if AI also calls controller.update()
  let _lastUpdateMs = 0;

  function update(delta: number) {
    if (delta <= 0) return;
    const now = performance.now();
    if (now - _lastUpdateMs < 4) return; // Already updated this frame (16ms frame = 4ms threshold)
    _lastUpdateMs = now;

    // Sync mesh position to physics body (only if physics body moved)
    const physVx = physicsBody.velocity.x;
    const physVz = physicsBody.velocity.z;
    const physSpeed = Math.sqrt(physVx * physVx + physVz * physVz);

    if (physSpeed > 0.05) {
      // Physics body is moving — sync mesh to it
      character.mesh.position.copy(physicsBody.position);
      // Offset Y by half-height so feet (at mesh origin via pivot correction)
      // align with the bottom of the physics box (ground contact point).
      const __cb = character.mesh.userData?.__characterBounds;
      if (__cb) character.mesh.position.y -= __cb.height / 2;
    }
    // If physics velocity is near-zero, AI may be moving mesh directly — let it

    // Detect movement from EITHER physics velocity OR direct mesh movement
    const meshDx = character.mesh.position.x - lastMeshX;
    const meshDz = character.mesh.position.z - lastMeshZ;
    const meshSpeed = Math.sqrt(meshDx * meshDx + meshDz * meshDz) / Math.max(delta, 0.001);
    lastMeshX = character.mesh.position.x;
    lastMeshZ = character.mesh.position.z;

    // Use whichever speed is higher — handles both physics and direct-movement patterns
    const hSpeed = Math.max(physSpeed, meshSpeed);

    // Face movement direction (smooth rotation)
    if (hSpeed > 0.3) {
      // Prefer physics velocity direction, fallback to mesh delta direction
      const dirX = physSpeed > 0.3 ? physVx : meshDx;
      const dirZ = physSpeed > 0.3 ? physVz : meshDz;
      if (Math.abs(dirX) > 0.01 || Math.abs(dirZ) > 0.01) {
        const targetAngle = Math.atan2(dirX, dirZ);
        let current = character.mesh.rotation.y;
        let diff = targetAngle - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        character.mesh.rotation.y += diff * Math.min(1, delta * 10);
      }
    }

    // Attack cooldown
    if (isAttacking) {
      attackTimer -= delta;
      if (attackTimer <= 0) isAttacking = false;
      else return; // Don't switch animations during attack
    }

    stateTimer += delta;

    // Check if grounded
    const isGrounded = (physicsBody as any).__canJump !== false;
    const isRising = physicsBody.velocity.y > 2;

    // State machine with hysteresis — use lower thresholds to LEAVE a state
    // This prevents flickering when speed oscillates around a boundary
    let newState = state;
    if (!isGrounded && isRising) {
      newState = "jump";
    } else if (state === "run" ? hSpeed > RUN_SPEED * 0.6 : hSpeed > RUN_SPEED) {
      newState = "run";
    } else if (state === "walk" ? hSpeed > WALK_SPEED * 0.3 : hSpeed > WALK_SPEED) {
      newState = "walk";
    } else {
      newState = "idle";
    }

    // Only allow state change after minimum hold time (jump always allowed)
    if (newState !== state && (stateTimer >= MIN_STATE_HOLD || newState === "jump")) {
      state = newState;
      stateTimer = 0;
      if (state === "jump") {
        character.play(jumpAnim, { loop: false, crossfade: 0.15 });
      } else if (state === "run") {
        character.play(runAnim, { crossfade: 0.2 });
      } else if (state === "walk") {
        character.play(walkAnim, { crossfade: 0.2 });
      } else {
        character.play(idleAnim, { crossfade: 0.3 });
      }
    }
  }

  function attack() {
    if (isAttacking) return;
    isAttacking = true;
    attackTimer = 1.0;
    character.play(attackAnim, { loop: false, crossfade: 0.1 });
  }

  function jump() {
    state = "jump";
    character.play(jumpAnim, { loop: false, crossfade: 0.15 });
  }

  // Auto-register for framework-level updates — Game3D.tsx calls _updateAllControllers3D
  // every frame, so animations work even if AI forgets controller.update() in its update loop.
  _activeControllers3D.push({ update });

  return { update, attack, jump, get state() { return state; } };
}

// ===== TEXT SPRITE FACTORY =====
// Creates a 3D text label in world space using canvas-rendered sprites.
// Great for score displays, floating labels, health bars, etc.

/**
 * Creates a 3D text label at (x, y, z) using a canvas-rendered sprite.
 * Returns { sprite, update } — call update("new text") to change it.
 *
 * Usage:
 *   const scoreLabel = createText3D("Score: 0", { x: -8, y: 6, z: -10 });
 *   scene.add(scoreLabel.sprite);
 *   // later: scoreLabel.update("Score: 100");
 *
 * Also accepts scene as first arg (both patterns work):
 *   const label = createText3D(scene, "Hello", { x: 0, y: 5, z: 0 });
 */
export function createText3D(
  textOrScene: string | any,
  posOrText?: any,
  optsOrPos?: any,
  maybeOpts?: any,
): { sprite: any; update: (newText: string) => void } {
  let sceneRef: any = null;
  let text: string;
  let position: { x: number; y: number; z: number };
  let opts: any;

  if (typeof textOrScene === "string") {
    text = textOrScene;
    position = posOrText || { x: 0, y: 0, z: 0 };
    opts = optsOrPos || {};
  } else {
    sceneRef = textOrScene;
    text = posOrText || "";
    position = optsOrPos || { x: 0, y: 0, z: 0 };
    opts = maybeOpts || {};
  }

  const size = opts.size || 1;
  const rawColor = opts.color;
  const colorStr = rawColor !== undefined
    ? (typeof rawColor === "number" ? "#" + rawColor.toString(16).padStart(6, "0") : String(rawColor))
    : "#ffffff";
  const stroke = opts.stroke ?? false;
  const font = opts.font || "Bold 64px Arial";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 512;
  canvas.height = 128;

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(position.x, position.y, position.z);
  sprite.scale.set(size * 4, size, 1);
  sprite.renderOrder = 999;

  function render(t: string) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (stroke) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 6;
      ctx.strokeText(t, canvas.width / 2, canvas.height / 2);
    }
    ctx.fillStyle = colorStr;
    ctx.fillText(t, canvas.width / 2, canvas.height / 2);
    texture.needsUpdate = true;
  }

  render(text);
  if (sceneRef) sceneRef.add(sprite);

  return {
    sprite,
    update(newText: string) { render(newText); },
  };
}

// ===== ANIMATION MAP SYSTEM =====
// Auto-classifies animation clips by name and duration heuristics.

function _classifyClips(clips: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const clip of clips) {
    const name = clip.name.toLowerCase();
    const dur = clip.duration;
    const isLoop = clip.loop !== undefined ? clip.loop : true;
    if (name.includes("idle") || (dur > 2 && isLoop && !name.includes("walk") && !name.includes("run"))) {
      if (!map.idle) map.idle = clip.name;
    }
    if (name.includes("walk") || name.includes("walking")) {
      if (!map.walk) map.walk = clip.name;
    }
    if (name.includes("run") || name.includes("running") || name.includes("sprint")) {
      if (!map.run) map.run = clip.name;
    }
    if (name.includes("jump") || name.includes("leap")) {
      if (!map.jump) map.jump = clip.name;
    }
    if (name.includes("attack") || name.includes("slash") || name.includes("kick") || name.includes("punch") || name.includes("hit") && dur < 1.5) {
      if (!map.attack) map.attack = clip.name;
    }
    if (name.includes("dead") || name.includes("death") || name.includes("die")) {
      if (!map.die) map.die = clip.name;
    }
    if (name.includes("damage") || name.includes("hurt") || (name.includes("hit") && name.includes("react"))) {
      if (!map.hit) map.hit = clip.name;
    }
  }
  // Prefer exact matches over compound names (e.g. "Idle" over "ClimbIdle")
  for (const clip of clips) {
    const n = clip.name.toLowerCase();
    if (n === "idle" && map.idle && map.idle.toLowerCase() !== "idle") map.idle = clip.name;
    if (n === "walk" && map.walk && map.walk.toLowerCase() !== "walk") map.walk = clip.name;
    if (n === "run" && map.run && map.run.toLowerCase() !== "run") map.run = clip.name;
    if (n === "jump" && map.jump && map.jump.toLowerCase() !== "jump") map.jump = clip.name;
    if (n === "die" && map.die && map.die.toLowerCase() !== "die") map.die = clip.name;
  }
  return map;
}

/**
 * Creates an animation map for a character, enabling friendly name lookups.
 * If no explicit mappings provided, auto-classifies clips by name heuristics.
 *
 * Usage:
 *   const warrior = await createAnimatedCharacter3D(scene, 0, 0, 0, { url: ... });
 *   const animMap = createAnimationMap(warrior);          // auto-classify
 *   const animMap = createAnimationMap(warrior, { idle: "Idle_5", run: "Running" }); // explicit
 *   warrior.play(animMap.idle);  // plays the mapped clip
 */
export function createAnimationMap(
  character: { mesh: any; clips: string[]; play: Function },
  mappings?: Record<string, string>,
): Record<string, string> {
  const map = mappings || _classifyClips(
    character.clips.map((name: string) => ({ name, duration: 1, loop: true }))
  );
  character.mesh.userData.__animMap = map;
  return map;
}

// ===== AUDIO SYSTEM =====
// Web Audio API-based sound system with SFX pooling, BGM crossfade, and 3D spatial audio.

/**
 * Builds a URL for a media-stock audio file.
 * Usage: soundUrl("collect") → "https://vibexe.online/api/app-builder/media-stock-audio/collect.mp3"
 */
export function soundUrl(name: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || "";
  const ext = name.includes(".") ? "" : ".ogg";
  return \`\${origin}/api/app-builder/media-stock-audio/\${name}\${ext}\`;
}

/**
 * Preloads multiple sound effects into the audio cache for instant playback.
 * Call in init() for frequently used SFX to avoid frame stutter on first play.
 *
 * Usage:
 *   await preloadSounds([soundUrl("collect"), soundUrl("jump"), soundUrl("explosion")]);
 */
export async function preloadSounds(urls: string[]): Promise<void> {
  const ctx = _getAudioContext();
  await Promise.all(urls.map(async (url) => {
    if (_audioCache.has(url)) return;
    try {
      const resp = await fetch(url);
      const arrayBuf = await resp.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuf);
      _audioCache.set(url, buffer);
    } catch (e) {
      console.warn("[Audio] Preload failed:", url, e);
    }
  }));
}

/**
 * Creates an audio manager for global volume control.
 * Usage:
 *   const audio = createAudioManager();
 *   audio.setMasterVolume(0.5);
 *   audio.mute();
 */
export function createAudioManager(): {
  setMasterVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  resume: () => void;
} {
  _getAudioContext();
  let _muted = false;
  let _prevMaster = 0.8;
  return {
    setMasterVolume(v: number) { if (_masterGain) _masterGain.gain.value = v; },
    setMusicVolume(v: number) { if (_musicGain) _musicGain.gain.value = v; },
    setSfxVolume(v: number) { if (_sfxGain) _sfxGain.gain.value = v; },
    mute() { _muted = true; if (_masterGain) { _prevMaster = _masterGain.gain.value; _masterGain.gain.value = 0; } },
    unmute() { _muted = false; if (_masterGain) _masterGain.gain.value = _prevMaster; },
    toggleMute() { if (_muted) this.unmute(); else this.mute(); },
    resume() { if (_audioCtx?.state === "suspended") _audioCtx.resume(); },
  };
}

/**
 * Plays a one-shot sound effect via Web Audio API.
 * Caches decoded audio. Pools instances per URL.
 *
 * Usage:
 *   playSound(soundUrl("collect"), { volume: 0.8 });
 *   playSound(soundUrl("jump"));
 *   const sfx = playSound(soundUrl("explosion"), { pitch: 0.8, rate: 1.2 });
 *   sfx.stop();
 */
export async function playSound(
  url: string,
  opts?: { volume?: number; pitch?: number; rate?: number; maxInstances?: number; pan?: number },
): Promise<{ stop: () => void }> {
  const ctx = _getAudioContext();
  const maxInst = opts?.maxInstances ?? 5;
  const currentCount = _sfxPool.get(url) || 0;
  if (currentCount >= maxInst) return { stop() {} };

  let buffer = _audioCache.get(url);
  if (!buffer) {
    try {
      const resp = await fetch(url);
      const arrayBuf = await resp.arrayBuffer();
      buffer = await ctx.decodeAudioData(arrayBuf);
      _audioCache.set(url, buffer);
    } catch (e) {
      console.warn("[Audio] Failed to load:", url, e);
      return { stop() {} };
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = opts?.rate ?? 1.0;
  if (opts?.pitch) source.detune.value = (opts.pitch - 1) * 100;

  const gainNode = ctx.createGain();
  gainNode.gain.value = opts?.volume ?? 1.0;

  if (opts?.pan !== undefined) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = opts.pan;
    source.connect(gainNode).connect(panner).connect(_sfxGain!);
  } else {
    source.connect(gainNode).connect(_sfxGain!);
  }

  _sfxPool.set(url, currentCount + 1);
  source.onended = () => {
    _sfxPool.set(url, Math.max(0, (_sfxPool.get(url) || 1) - 1));
  };
  source.start(0);

  return {
    stop() { try { source.stop(); } catch {} },
  };
}

/**
 * Plays background music via HTMLAudioElement (better for long tracks).
 * Supports looping and crossfade between tracks.
 *
 * Usage:
 *   const music = playMusic(soundUrl("theme-adventure"), { loop: true, fadeIn: 1 });
 *   // later: switch tracks
 *   const music2 = playMusic(soundUrl("theme-action"), { crossfadeDuration: 2 });
 *   music.stop();
 */
export function playMusic(
  url: string,
  opts?: { volume?: number; loop?: boolean; fadeIn?: number; crossfadeDuration?: number },
): { stop: () => void; pause: () => void; resume: () => void; setVolume: (v: number) => void } {
  _getAudioContext();
  const vol = opts?.volume ?? 0.5;
  const loop = opts?.loop !== false;
  const fadeIn = opts?.fadeIn ?? 0;
  const crossfade = opts?.crossfadeDuration ?? 1.0;

  // rAF-based fade helper for smooth frame-synced volume transitions
  function _rafFade(
    el2: HTMLAudioElement, fromVol: number, toVol: number, duration: number, onDone?: () => void
  ): number {
    const startTime = performance.now();
    let rafId = 0;
    function tick() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / (duration * 1000));
      try { el2.volume = fromVol + (toVol - fromVol) * progress; } catch {}
      if (progress < 1) { rafId = requestAnimationFrame(tick); }
      else { onDone?.(); }
    }
    rafId = requestAnimationFrame(tick);
    return rafId;
  }

  // Crossfade out old music
  if (_currentMusic) {
    const old = _currentMusic;
    const startVol = old.el.volume;
    if (old.fadeTimer) cancelAnimationFrame(old.fadeTimer);
    old.fadeTimer = _rafFade(old.el, startVol, 0, crossfade, () => {
      old.el.pause();
      old.el.src = "";
    });
  }

  const el = new Audio(url);
  el.loop = loop;
  el.volume = fadeIn > 0 ? 0 : vol;
  el.play().catch(() => {});

  const entry = { el, fadeTimer: 0 as any };
  _currentMusic = entry;

  if (fadeIn > 0) {
    entry.fadeTimer = _rafFade(el, 0, vol, fadeIn);
  }

  return {
    stop() { el.pause(); el.src = ""; if (_currentMusic === entry) _currentMusic = null; },
    pause() { el.pause(); },
    resume() { el.play().catch(() => {}); },
    setVolume(v: number) { el.volume = v; },
  };
}

/**
 * Plays 3D positional audio using PannerNode (HRTF).
 * Sound attenuates with distance from the listener (camera).
 *
 * Usage:
 *   const fire = playSpatial3D(soundUrl("fire"), { x: 5, y: 1, z: -3 }, { loop: true });
 *   fire.setPosition(newX, newY, newZ);
 *   fire.attachTo(torchMesh); // auto-updates position each frame
 */
export async function playSpatial3D(
  url: string,
  position: { x: number; y: number; z: number },
  opts?: { volume?: number; loop?: boolean; refDistance?: number; maxDistance?: number; rolloff?: number },
): Promise<{ stop: () => void; setPosition: (x: number, y: number, z: number) => void; attachTo: (mesh: any) => void }> {
  const ctx = _getAudioContext();

  let buffer = _audioCache.get(url);
  if (!buffer) {
    try {
      const resp = await fetch(url);
      buffer = await ctx.decodeAudioData(await resp.arrayBuffer());
      _audioCache.set(url, buffer);
    } catch (e) {
      console.warn("[Audio] Spatial load failed:", url, e);
      return { stop() {}, setPosition() {}, attachTo() {} };
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = opts?.loop ?? false;

  const panner = ctx.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = opts?.refDistance ?? 1;
  panner.maxDistance = opts?.maxDistance ?? 50;
  panner.rolloffFactor = opts?.rolloff ?? 1;
  panner.setPosition(position.x, position.y, position.z);

  const gain = ctx.createGain();
  gain.gain.value = opts?.volume ?? 1;

  source.connect(gain).connect(panner).connect(_sfxGain!);
  source.start(0);

  let _attachedMesh: any = null;
  let _stopped = false;

  const spatialEntry = {
    _destroyed: false,
    _update() {
      if (_attachedMesh && _attachedMesh.position) {
        panner.setPosition(_attachedMesh.position.x, _attachedMesh.position.y, _attachedMesh.position.z);
      }
    },
  };
  _activeSpatial3D.push(spatialEntry);

  source.onended = () => { spatialEntry._destroyed = true; _stopped = true; };

  return {
    stop() {
      if (_stopped) return;
      _stopped = true;
      spatialEntry._destroyed = true;
      try { source.stop(); } catch {}
    },
    setPosition(x: number, y: number, z: number) { panner.setPosition(x, y, z); },
    attachTo(mesh: any) { _attachedMesh = mesh; },
  };
}

// ===== POST-PROCESSING =====

const POST_PROCESSING_PRESETS: Record<string, any> = {
  cinematic: { bloom: { strength: 0.4, radius: 0.4, threshold: 0.85 }, fog: { color: 0x88aacc, near: 20, far: 80 }, toneMapping: "ACESFilmic", exposure: 1.0 },
  vibrant: { bloom: { strength: 0.8, radius: 0.5, threshold: 0.6 }, toneMapping: "ACESFilmic", exposure: 1.2 },
  dark: { bloom: { strength: 0.3, radius: 0.3, threshold: 0.9 }, fog: { color: 0x111122, near: 5, far: 40 }, toneMapping: "Cineon", exposure: 0.7 },
  neon: { bloom: { strength: 1.5, radius: 0.6, threshold: 0.4 }, fog: { color: 0x050510, near: 10, far: 60 }, toneMapping: "ACESFilmic", exposure: 0.9 },
  natural: { bloom: { strength: 0.2, radius: 0.3, threshold: 0.9 }, fog: { color: 0xccddee, near: 30, far: 100 }, toneMapping: "Linear", exposure: 1.0 },
};
(window as any).POST_PROCESSING_PRESETS = POST_PROCESSING_PRESETS;

/**
 * Creates post-processing pipeline with EffectComposer.
 * Stores on window.__vibexe_composer__ — Game3D.tsx auto-uses it for rendering.
 *
 * Usage:
 *   const pp = createPostProcessing(renderer, scene, camera, "cinematic");
 *   // or custom:
 *   const pp = createPostProcessing(renderer, scene, camera);
 *   pp.addBloom({ strength: 1.0 });
 *   pp.addFog({ color: 0x000000, near: 5, far: 30 });
 */
export function createPostProcessing(
  renderer: any, scene: any, camera: any,
  preset?: string,
): { composer: any; addBloom: (opts?: any) => void; addFog: (opts?: any) => void; setPreset: (name: string) => void; destroy: () => void } | null {
  if (!THREE.EffectComposer) {
    console.warn("[PostFX] EffectComposer not loaded — post-processing unavailable");
    return null;
  }

  const composer = new THREE.EffectComposer(renderer);
  const renderPass = new THREE.RenderPass(scene, camera);
  composer.addPass(renderPass);
  (window as any).__vibexe_composer__ = composer;

  let _bloomPass: any = null;

  function addBloom(opts?: { strength?: number; radius?: number; threshold?: number }) {
    if (!THREE.UnrealBloomPass) { console.warn("[PostFX] UnrealBloomPass not loaded — bloom unavailable"); return; }
    if (_bloomPass) composer.removePass(_bloomPass);
    const res = new THREE.Vector2(renderer.domElement.width, renderer.domElement.height);
    _bloomPass = new THREE.UnrealBloomPass(res, opts?.strength ?? 0.5, opts?.radius ?? 0.4, opts?.threshold ?? 0.85);
    composer.addPass(_bloomPass);
  }

  function addFog(opts?: { color?: number; near?: number; far?: number }) {
    scene.fog = new THREE.Fog(opts?.color ?? 0x88aacc, opts?.near ?? 20, opts?.far ?? 80);
  }

  function setToneMappingInternal(type: string, exposure: number) {
    const map: Record<string, number> = { Linear: 1, Reinhard: 2, Cineon: 3, ACESFilmic: 4 };
    renderer.toneMapping = map[type] ?? 1;
    renderer.toneMappingExposure = exposure;
  }

  function setPreset(name: string) {
    const p = POST_PROCESSING_PRESETS[name];
    if (!p) { console.warn("[PostFX] Unknown preset:", name); return; }
    if (p.bloom) addBloom(p.bloom);
    if (p.fog) addFog(p.fog); else scene.fog = null;
    if (p.toneMapping) setToneMappingInternal(p.toneMapping, p.exposure ?? 1);
  }

  // Apply preset if given
  if (preset) setPreset(preset);

  return {
    composer,
    addBloom,
    addFog,
    setPreset,
    destroy() {
      (window as any).__vibexe_composer__ = null;
      composer.dispose?.();
    },
  };
}

/**
 * Shortcut: set scene fog.
 */
export function addFogEffect(scene: any, opts?: { color?: number; near?: number; far?: number }) {
  scene.fog = new THREE.Fog(opts?.color ?? 0x88aacc, opts?.near ?? 20, opts?.far ?? 80);
}

/**
 * Shortcut: set renderer tone mapping.
 */
export function setToneMapping(renderer: any, type?: string, exposure?: number) {
  const map: Record<string, number> = { Linear: 1, Reinhard: 2, Cineon: 3, ACESFilmic: 4 };
  renderer.toneMapping = map[type || "ACESFilmic"] ?? 4;
  renderer.toneMappingExposure = exposure ?? 1.0;
}

// ===== PARTICLE & VFX SYSTEM =====

const PARTICLE_PRESETS: Record<string, any> = {
  explosion:  { count: 50, mode: "burst", speed: 8, spread: 1, gravity: -10, life: 0.8, colors: [0xff6600, 0xff3300, 0xffaa00], sizeStart: 0.3, sizeEnd: 0 },
  sparkle:    { count: 20, mode: "burst", speed: 3, spread: 0.5, gravity: 0, life: 0.6, colors: [0xffff00, 0xffffff, 0xffdd44], sizeStart: 0.15, sizeEnd: 0 },
  dust:       { count: 15, mode: "burst", speed: 2, spread: 0.3, gravity: -3, life: 0.5, colors: [0x996633, 0xccaa66], sizeStart: 0.2, sizeEnd: 0.05 },
  fire:       { count: 30, mode: "continuous", emitRate: 20, speed: 3, spread: 0.2, gravity: 2, life: 1.0, colors: [0xff4400, 0xff6600, 0xffaa00], sizeStart: 0.25, sizeEnd: 0 },
  smoke:      { count: 20, mode: "continuous", emitRate: 10, speed: 1.5, spread: 0.3, gravity: 1, life: 2.0, colors: [0x666666, 0x888888, 0x444444], sizeStart: 0.2, sizeEnd: 0.5 },
  rain:       { count: 200, mode: "continuous", emitRate: 100, speed: 15, spread: 20, gravity: 0, life: 1.5, colors: [0x6688cc], sizeStart: 0.05, sizeEnd: 0.05, direction: { x: 0, y: -1, z: 0 } },
  snow:       { count: 150, mode: "continuous", emitRate: 30, speed: 2, spread: 15, gravity: 0, life: 4.0, colors: [0xffffff, 0xeeeeff], sizeStart: 0.1, sizeEnd: 0.08, direction: { x: 0, y: -1, z: 0 } },
  confetti:   { count: 80, mode: "burst", speed: 6, spread: 1, gravity: -5, life: 2.0, colors: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff], sizeStart: 0.15, sizeEnd: 0.1 },
};
(window as any).PARTICLE_PRESETS = PARTICLE_PRESETS;

/**
 * Creates a particle emitter at a position.
 * Supports preset names or custom configuration.
 *
 * Usage:
 *   // Sparkle burst on collect
 *   const sparks = createParticleEmitter(scene, { x: 3, y: 2, z: -5 }, "sparkle");
 *
 *   // Continuous fire on torch
 *   const fire = createParticleEmitter(scene, { x: 0, y: 1, z: 0 }, "fire");
 *   fire.stop(); // stop emitting (existing particles fade out)
 *   fire.destroy(); // remove immediately
 */
export function createParticleEmitter(
  scene: any,
  position: { x: number; y: number; z: number },
  presetOrConfig: string | any,
): { emit: () => void; stop: () => void; destroy: () => void; setPosition: (x: number, y: number, z: number) => void; isAlive: () => boolean } {
  const config = typeof presetOrConfig === "string"
    ? { ...(PARTICLE_PRESETS[presetOrConfig] || PARTICLE_PRESETS.sparkle) }
    : presetOrConfig;

  const MAX = config.count || 50;
  const positions = new Float32Array(MAX * 3);
  const velocities = new Float32Array(MAX * 3);
  const ages = new Float32Array(MAX);
  const lifetimes = new Float32Array(MAX);
  const sizes = new Float32Array(MAX);
  const colorArr = new Float32Array(MAX * 3);
  const colors = config.colors || [0xffffff];
  const sizeStart = config.sizeStart ?? 0.2;
  const sizeEnd = config.sizeEnd ?? 0;
  const speed = config.speed ?? 5;
  const spread = config.spread ?? 1;
  const gravity = config.gravity ?? 0;
  const life = config.life ?? 1;
  const dir = config.direction || null;

  let activeCount = 0;
  let _emitting = true;
  let _alive = true;
  let _destroyed = false;
  let _emitAccum = 0;

  const alphas = new Float32Array(MAX).fill(1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("color", new THREE.BufferAttribute(colorArr, 3));

  // Custom ShaderMaterial for per-vertex size + alpha (PointsMaterial has uniform size only)
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: [
      "attribute float aSize;",
      "attribute float aAlpha;",
      "varying vec3 vColor;",
      "varying float vAlpha;",
      "void main() {",
      "  vColor = color;",
      "  vAlpha = aAlpha;",
      "  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
      "  gl_PointSize = aSize * (300.0 / length(mvPosition.xyz));",
      "  gl_PointSize = max(gl_PointSize, 1.0);",
      "  gl_Position = projectionMatrix * mvPosition;",
      "}",
    ].join("\\n"),
    fragmentShader: [
      "varying vec3 vColor;",
      "varying float vAlpha;",
      "void main() {",
      "  float d = length(gl_PointCoord - vec2(0.5));",
      "  if (d > 0.5) discard;",
      "  float edgeFade = 1.0 - smoothstep(0.3, 0.5, d);",
      "  gl_FragColor = vec4(vColor, vAlpha * edgeFade);",
      "}",
    ].join("\\n"),
    vertexColors: true,
  });

  const points = new THREE.Points(geometry, material);
  points.name = "__particle_emitter";
  points.frustumCulled = false;
  scene.add(points);

  function _spawnOne(idx: number) {
    const i3 = idx * 3;
    positions[i3] = position.x + (Math.random() - 0.5) * spread * 0.5;
    positions[i3 + 1] = position.y + (Math.random() - 0.5) * spread * 0.5;
    positions[i3 + 2] = position.z + (Math.random() - 0.5) * spread * 0.5;

    if (dir) {
      velocities[i3] = dir.x * speed + (Math.random() - 0.5) * spread;
      velocities[i3 + 1] = dir.y * speed + (Math.random() - 0.5) * spread * 0.3;
      velocities[i3 + 2] = dir.z * speed + (Math.random() - 0.5) * spread;
    } else {
      velocities[i3] = (Math.random() - 0.5) * speed;
      velocities[i3 + 1] = Math.random() * speed;
      velocities[i3 + 2] = (Math.random() - 0.5) * speed;
    }

    ages[idx] = 0;
    lifetimes[idx] = life * (0.7 + Math.random() * 0.6);
    sizes[idx] = sizeStart;

    const c = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
    colorArr[i3] = c.r;
    colorArr[i3 + 1] = c.g;
    colorArr[i3 + 2] = c.b;
  }

  // Burst mode: spawn all at once, then stop emitting so it can auto-die
  if (config.mode === "burst") {
    for (let i = 0; i < MAX; i++) _spawnOne(i);
    activeCount = MAX;
    _emitting = false;
  }

  const emitter = {
    _destroyed: false,
    update(delta: number) {
      if (_destroyed) return;

      // Continuous mode: emit at rate
      if (config.mode === "continuous" && _emitting) {
        _emitAccum += delta * (config.emitRate || 20);
        while (_emitAccum >= 1 && activeCount < MAX) {
          _spawnOne(activeCount);
          activeCount++;
          _emitAccum -= 1;
        }
      }

      // Update all particles
      let alive = false;
      for (let i = 0; i < activeCount; i++) {
        ages[i] += delta;
        if (ages[i] >= lifetimes[i]) {
          sizes[i] = 0;
          continue;
        }
        alive = true;
        const t = ages[i] / lifetimes[i];
        sizes[i] = sizeStart + (sizeEnd - sizeStart) * t;
        alphas[i] = 1.0 - t; // Smooth fade from 1→0 over lifetime

        const i3 = i * 3;
        velocities[i3 + 1] += gravity * delta;
        positions[i3] += velocities[i3] * delta;
        positions[i3 + 1] += velocities[i3 + 1] * delta;
        positions[i3 + 2] += velocities[i3 + 2] * delta;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;

      if (!alive && !_emitting) {
        _alive = false;
      }
    },
    isAlive() { return _alive; },
    emit() { _emitting = true; },
    stop() { _emitting = false; },
    destroy() {
      _destroyed = true;
      _alive = false;
      emitter._destroyed = true;
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
    setPosition(x: number, y: number, z: number) {
      position = { x, y, z };
    },
  };

  _activeParticles3D.push(emitter);
  return emitter;
}

/**
 * Creates a trail renderer that follows a mesh.
 * Renders as a fading ribbon behind the moving object.
 *
 * Usage:
 *   const trail = createTrailRenderer(projectileMesh, scene, { color: 0xff4400, width: 0.3, length: 20 });
 *   // In update: trail is auto-updated
 *   trail.destroy(); // cleanup
 */
export function createTrailRenderer(
  mesh: any,
  scene: any,
  opts?: { color?: number; width?: number; length?: number; fade?: boolean },
): { destroy: () => void; setColor: (c: number) => void; setWidth: (w: number) => void } {
  const LENGTH = opts?.length ?? 20;
  const color = new THREE.Color(opts?.color ?? 0x00ff88);
  let width = opts?.width ?? 0.2;

  // Store trail centerline points (most recent first)
  const trail: { x: number; y: number; z: number }[] = [];

  // Quad-based ribbon: 2 vertices per segment, (LENGTH-1) quads → (LENGTH-1)*6 indices
  const vertCount = LENGTH * 2;
  const positions = new Float32Array(vertCount * 3);
  const alphas = new Float32Array(vertCount);
  const indices: number[] = [];
  for (let i = 0; i < LENGTH - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setIndex(indices);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: color } },
    vertexShader: [
      "attribute float aAlpha;",
      "varying float vAlpha;",
      "void main() {",
      "  vAlpha = aAlpha;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}",
    ].join("\\n"),
    fragmentShader: [
      "uniform vec3 uColor;",
      "varying float vAlpha;",
      "void main() {",
      "  gl_FragColor = vec4(uColor, vAlpha * 0.6);",
      "}",
    ].join("\\n"),
  });
  const ribbonMesh = new THREE.Mesh(geometry, material);
  ribbonMesh.frustumCulled = false;
  ribbonMesh.name = "__trail_renderer";
  scene.add(ribbonMesh);

  // Temp vectors for perpendicular calculation
  const _dir = new THREE.Vector3();
  const _perp = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  function _rebuildRibbon() {
    for (let i = 0; i < LENGTH; i++) {
      const alpha = 1.0 - (i / (LENGTH - 1));
      alphas[i * 2] = alpha;
      alphas[i * 2 + 1] = alpha;

      if (i >= trail.length) {
        // Not enough points yet — collapse to zero
        const last = trail.length > 0 ? trail[trail.length - 1] : { x: 0, y: 0, z: 0 };
        const vi = i * 2 * 3;
        positions[vi] = last.x; positions[vi + 1] = last.y; positions[vi + 2] = last.z;
        positions[vi + 3] = last.x; positions[vi + 4] = last.y; positions[vi + 5] = last.z;
        continue;
      }

      const p = trail[i];
      // Compute perpendicular direction for width offset
      if (i < trail.length - 1) {
        _dir.set(trail[i + 1].x - p.x, trail[i + 1].y - p.y, trail[i + 1].z - p.z);
      } else if (i > 0) {
        _dir.set(p.x - trail[i - 1].x, p.y - trail[i - 1].y, p.z - trail[i - 1].z);
      } else {
        _dir.set(0, 0, 1);
      }
      if (_dir.lengthSq() < 0.0001) _dir.set(0, 0, 1);
      _dir.normalize();
      _perp.crossVectors(_dir, _up);
      if (_perp.lengthSq() < 0.0001) _perp.crossVectors(_dir, new THREE.Vector3(1, 0, 0));
      _perp.normalize();

      const hw = width * 0.5; // half-width
      const vi = i * 2 * 3;
      positions[vi]     = p.x + _perp.x * hw;
      positions[vi + 1] = p.y + _perp.y * hw;
      positions[vi + 2] = p.z + _perp.z * hw;
      positions[vi + 3] = p.x - _perp.x * hw;
      positions[vi + 4] = p.y - _perp.y * hw;
      positions[vi + 5] = p.z - _perp.z * hw;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
  }

  let _destroyed = false;

  const trailObj = {
    _destroyed: false,
    update(_delta: number) {
      if (_destroyed) return;
      const pos = mesh.position;
      // Add current position at head
      trail.unshift({ x: pos.x, y: pos.y, z: pos.z });
      if (trail.length > LENGTH) trail.length = LENGTH;
      _rebuildRibbon();
    },
    isAlive() { return !_destroyed; },
    destroy() { _destroyed = true; trailObj._destroyed = true; scene.remove(ribbonMesh); geometry.dispose(); material.dispose(); },
    setColor(c: number) { material.uniforms.uColor.value.set(c); },
    setWidth(w: number) { width = w; },
  };

  _activeParticles3D.push(trailObj);
  return trailObj;
}

// ===== PHYSICS TRIGGERS, SENSORS & CONSTRAINTS =====

/** Collision group bitmasks for filtering. */
export const COLLISION_GROUPS = { PLAYER: 1, ENEMY: 2, PLATFORM: 4, TRIGGER: 8, PROJECTILE: 16, ALL: -1 };
(window as any).COLLISION_GROUPS = COLLISION_GROUPS;

/**
 * Creates an invisible trigger zone that fires callbacks on enter/exit/stay.
 * The body has collisionResponse=false — it detects overlap without blocking.
 *
 * Usage:
 *   const trigger = createTriggerZone(world, { x: 5, y: 1, z: -3 }, { x: 2, y: 2, z: 2 }, {
 *     onEnter: (body) => console.log("Entered!", body),
 *     onExit: (body) => console.log("Exited!", body),
 *   });
 */
export function createTriggerZone(
  world: any,
  position: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
  callbacks: { onEnter?: (body: any) => void; onExit?: (body: any) => void; onStay?: (body: any) => void },
): { body: any; destroy: () => void } {
  if (!CANNON || !world?.bodies) { return { body: null, destroy() {} }; }

  const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
  const body = new CANNON.Body({ mass: 0, shape, isTrigger: true });
  body.position.set(position.x, position.y, position.z);
  body.collisionResponse = false;
  world.addBody(body);

  const _inside: Set<any> = new Set();
  let _destroyed = false;

  const trigger = {
    body,
    _destroyed: false,
    check() {
      if (_destroyed) return;
      const currentInside: Set<any> = new Set();
      // Check all bodies in world for overlap
      for (const other of world.bodies) {
        if (other === body || other.mass < 0) continue;
        const dx = Math.abs(other.position.x - body.position.x);
        const dy = Math.abs(other.position.y - body.position.y);
        const dz = Math.abs(other.position.z - body.position.z);
        if (dx < size.x / 2 && dy < size.y / 2 && dz < size.z / 2) {
          currentInside.add(other);
          if (!_inside.has(other)) {
            callbacks.onEnter?.(other);
          } else {
            callbacks.onStay?.(other);
          }
        }
      }
      // Check exits
      for (const prev of _inside) {
        if (!currentInside.has(prev)) {
          callbacks.onExit?.(prev);
        }
      }
      _inside.clear();
      for (const c of currentInside) _inside.add(c);
    },
    destroy() { _destroyed = true; trigger._destroyed = true; world.removeBody(body); },
  };

  _activeTriggers3D.push(trigger);
  return trigger;
}

/**
 * Creates a hinge constraint between two bodies (e.g., a door).
 */
export function createHingeConstraint(
  bodyA: any, bodyB: any,
  pivotA: { x: number; y: number; z: number },
  pivotB: { x: number; y: number; z: number },
  axisA?: { x: number; y: number; z: number },
  axisB?: { x: number; y: number; z: number },
): { constraint: any; setMotorSpeed: (speed: number) => void; enableMotor: () => void; disableMotor: () => void; setLimits: (low: number, high: number) => void } | null {
  if (!CANNON) return null;
  const axis1 = axisA || { x: 0, y: 1, z: 0 };
  const axis2 = axisB || { x: 0, y: 1, z: 0 };
  const c = new CANNON.HingeConstraint(bodyA, bodyB, {
    pivotA: new CANNON.Vec3(pivotA.x, pivotA.y, pivotA.z),
    pivotB: new CANNON.Vec3(pivotB.x, pivotB.y, pivotB.z),
    axisA: new CANNON.Vec3(axis1.x, axis1.y, axis1.z),
    axisB: new CANNON.Vec3(axis2.x, axis2.y, axis2.z),
  });
  bodyA.world?.addConstraint(c);
  return {
    constraint: c,
    setMotorSpeed(speed: number) { c.setMotorSpeed(speed); },
    enableMotor() { c.enableMotor(); },
    disableMotor() { c.disableMotor(); },
    setLimits(low: number, high: number) { c.setLimits?.(low, high); },
  };
}

/**
 * Creates a spring constraint between two bodies (e.g., bouncy bridge).
 * Auto-registered for per-frame force application.
 */
export function createSpringConstraint(
  bodyA: any, bodyB: any,
  opts?: { stiffness?: number; damping?: number; restLength?: number;
    localAnchorA?: { x: number; y: number; z: number }; localAnchorB?: { x: number; y: number; z: number } },
): { spring: any; destroy: () => void } | null {
  if (!CANNON) return null;
  const spring = new CANNON.Spring(bodyA, bodyB, {
    stiffness: opts?.stiffness ?? 100,
    damping: opts?.damping ?? 5,
    restLength: opts?.restLength ?? 1,
    localAnchorA: opts?.localAnchorA ? new CANNON.Vec3(opts.localAnchorA.x, opts.localAnchorA.y, opts.localAnchorA.z) : undefined,
    localAnchorB: opts?.localAnchorB ? new CANNON.Vec3(opts.localAnchorB.x, opts.localAnchorB.y, opts.localAnchorB.z) : undefined,
  });
  let _destroyed = false;
  const s = {
    spring,
    _destroyed: false,
    applyForce() { if (!_destroyed) spring.applyForce(); },
    destroy() { _destroyed = true; s._destroyed = true; },
  };
  _activeSprings3D.push(s);
  return s;
}

/**
 * Creates a lock constraint (rigid attachment) between two bodies.
 */
export function createLockConstraint(bodyA: any, bodyB: any): { constraint: any; unlock: () => void } | null {
  if (!CANNON) return null;
  const c = new CANNON.LockConstraint(bodyA, bodyB);
  bodyA.world?.addConstraint(c);
  return {
    constraint: c,
    unlock() { bodyA.world?.removeConstraint(c); },
  };
}

/**
 * Creates a point-to-point (ball joint) constraint between two bodies.
 */
export function createPointConstraint(
  bodyA: any, bodyB: any,
  pivotA: { x: number; y: number; z: number },
  pivotB: { x: number; y: number; z: number },
): { constraint: any; destroy: () => void } | null {
  if (!CANNON) return null;
  const c = new CANNON.PointToPointConstraint(
    bodyA, new CANNON.Vec3(pivotA.x, pivotA.y, pivotA.z),
    bodyB, new CANNON.Vec3(pivotB.x, pivotB.y, pivotB.z),
  );
  bodyA.world?.addConstraint(c);
  return {
    constraint: c,
    destroy() { bodyA.world?.removeConstraint(c); },
  };
}

/**
 * Creates a compound (multi-shape) physics body.
 */
export function createCompoundBody(
  mass: number,
  position: { x: number; y: number; z: number },
  shapes: Array<{ type: "box" | "sphere"; size: any; offset: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number } }>,
): any {
  if (!CANNON) return null;
  const body = new CANNON.Body({ mass });
  body.position.set(position.x, position.y, position.z);
  for (const s of shapes) {
    let shape: any;
    if (s.type === "box") {
      const sz = typeof s.size === "number" ? { x: s.size, y: s.size, z: s.size } : s.size;
      shape = new CANNON.Box(new CANNON.Vec3(sz.x, sz.y, sz.z));
    } else {
      shape = new CANNON.Sphere(typeof s.size === "number" ? s.size : 0.5);
    }
    const offset = new CANNON.Vec3(s.offset.x, s.offset.y, s.offset.z);
    const orient = s.rotation ? new CANNON.Quaternion().setFromEuler(s.rotation.x, s.rotation.y, s.rotation.z) : undefined;
    body.addShape(shape, offset, orient);
  }
  return body;
}

/**
 * Sets collision group and mask on a physics body for filtering.
 */
export function setCollisionGroups(body: any, group: number, mask: number): void {
  if (!body) return;
  body.collisionFilterGroup = group;
  body.collisionFilterMask = mask;
}
`,
	},

	// ---------- Template 3: package.json with Three.js dependency ----------
	{
		path: "package.json",
		language: "json",
		content: `{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "three": "^0.128.0",
    "cannon-es": "^0.20.0"
  }
}
`,
	},

	// ---------- Template 4: React wrapper for Three.js ----------
	{
		path: "src/components/Game3D.tsx",
		language: "typescript",
		content: `import { useEffect, useRef } from "react";

interface GameSceneInterface {
  init(scene: any, camera: any, renderer: any, container: HTMLDivElement, onProgress?: (p: number) => void): void | Promise<void>;
  update(delta: number): void;
  cleanup?(): void;
}

interface Game3DProps {
  gameScene: GameSceneInterface | (new () => GameSceneInterface) | any;
  bgColor?: string;
  cameraFov?: number;
}

// ===== Overlay Helpers =====

function createLoadingOverlay(container: HTMLDivElement) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;font-family:sans-serif;color:#fff;transition:opacity 0.4s;";

  const label = document.createElement("div");
  label.style.cssText = "font-size:18px;margin-bottom:16px;opacity:0.7;";
  label.textContent = "Loading...";

  const barBg = document.createElement("div");
  barBg.style.cssText = "width:220px;height:6px;background:#333;border-radius:3px;overflow:hidden;";

  const barFill = document.createElement("div");
  barFill.style.cssText = "width:10%;height:100%;background:#00ff88;border-radius:3px;transition:width 0.2s;";
  barBg.appendChild(barFill);

  overlay.appendChild(label);
  overlay.appendChild(barBg);
  container.appendChild(overlay);

  return {
    setProgress(p: number) { barFill.style.width = Math.max(10, Math.min(100, p * 100)) + "%"; },
    remove() { overlay.style.opacity = "0"; setTimeout(() => overlay.remove(), 400); },
  };
}

function createMenuOverlay(container: HTMLDivElement, onStart: () => void) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:150;font-family:sans-serif;color:#fff;";

  const hsKey = "vibexe-3d-highscore";
  const best = parseInt(localStorage.getItem(hsKey) || "0", 10);

  const title = document.createElement("div");
  title.style.cssText = "font-size:36px;font-weight:bold;margin-bottom:12px;text-shadow:0 2px 8px rgba(0,0,0,0.5);";
  title.textContent = "\\u{1F3AE}";

  const hs = document.createElement("div");
  hs.style.cssText = "font-size:16px;color:#aaa;margin-bottom:32px;";
  hs.textContent = best > 0 ? "Best: " + best : "";

  const btn = document.createElement("div");
  btn.style.cssText = "font-size:22px;font-weight:bold;color:#00ff88;cursor:pointer;animation:pulse3d 1.2s ease-in-out infinite;pointer-events:none;";
  btn.textContent = "TAP TO START";

  // Pulse animation
  const style = document.createElement("style");
  style.textContent = "@keyframes pulse3d{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.05)}}";
  overlay.appendChild(style);

  overlay.appendChild(title);
  overlay.appendChild(hs);
  overlay.appendChild(btn);
  container.appendChild(overlay);

  // Enable click after 400ms delay
  setTimeout(() => {
    btn.style.pointerEvents = "auto";
    overlay.style.cursor = "pointer";
    const handler = () => {
      overlay.removeEventListener("click", handler);
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.3s";
      setTimeout(() => { overlay.remove(); onStart(); }, 300);
    };
    overlay.addEventListener("click", handler);
  }, 400);

  return { remove() { overlay.remove(); } };
}

/**
 * React wrapper for Three.js 3D games.
 * Handles: renderer, camera, scene, game loop, loading screen, menu, restart.
 *
 * The AI should NOT modify this file — import and use it in App.tsx.
 */
export default function Game3D({ gameScene: rawScene, bgColor = "#87CEEB", cameraFov = 60 }: Game3DProps) {
  // Normalize: AI may export a class instead of a plain object — handle both
  const gameScene: GameSceneInterface = typeof rawScene === 'function' ? new (rawScene as any)() : rawScene;
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const container = containerRef.current;
    let animFrameId = 0;
    let disposed = false;
    let renderer: any = null;
    let camera: any = null;
    let scene: any = null;
    let clock: any = null;

    // Hoist handlers (null-safe — libs load async)
    const onResize = () => {
      if (disposed || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      // Resize post-processing composer so bloom/effects stay sharp
      const __comp = (window as any).__vibexe_composer__;
      if (__comp) __comp.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const onVisChange = () => {
      if (!clock) return;
      if (document.hidden) clock.stop();
      else clock.start();
    };
    document.addEventListener("visibilitychange", onVisChange);

    function disposeScene() {
      cancelAnimationFrame(animFrameId);
      gameScene.cleanup?.();
      if (scene) {
        scene.traverse((obj: any) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
            else obj.material.dispose();
          }
        });
        while (scene.children.length > 0) scene.remove(scene.children[0]);
      }
      // Stop all music on restart
      try {
        const __cm = (window as any)._currentMusic;
        if (__cm?.el) { __cm.el.pause(); __cm.el.src = ""; }
      } catch {}
      // Clean up post-processing composer
      try { (window as any).__vibexe_composer__?.dispose?.(); } catch {}
      delete (window as any).__vibexe_composer__;
      // Clear scene + world from window so restart creates fresh ones
      // (renderer/camera persist across restarts)
      delete (window as any).__vibexe_scene__;
      delete (window as any).__vibexe_world__;
      Array.from(container.children).forEach((c) => {
        if (c !== renderer?.domElement) c.remove();
      });
    }

    // Async boot — wait for Three.js CDN shim before initializing
    (async () => {
      while (!(window as any).THREE && !disposed) {
        await new Promise(r => setTimeout(r, 50));
      }
      if (disposed) return;
      const THREE = (window as any).THREE;

      // Create renderer + store on window so idempotent helpers return it
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      const __perfSettings = ((window as any).__VIBEXE_GAME_SETTINGS__ || {}).performance || {};
      renderer.setPixelRatio(Math.min(__perfSettings.pixelRatio || window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      // NoToneMapping by default — Phong/Lambert materials already output LDR values.
      // Tone mapping (ACES/Reinhard) crushes contrast and desaturates cartoon colors.
      // Games that need HDR can enable tone mapping via createPostProcessing().
      renderer.toneMapping = THREE.NoToneMapping;
      container.appendChild(renderer.domElement);
      (window as any).__vibexe_renderer__ = renderer;

      // Create camera + store on window (game settings override FOV)
      const __gs = (window as any).__VIBEXE_GAME_SETTINGS__ || {};
      const aspect = container.clientWidth / container.clientHeight;
      camera = new THREE.PerspectiveCamera(__gs.camera?.fov ?? cameraFov, aspect, 0.1, 1000);
      camera.position.set(0, 8, 15);
      camera.lookAt(0, 2, 0);
      (window as any).__vibexe_camera__ = camera;

      clock = new THREE.Clock();

      async function initAndRun() {
        if (disposed) return;
        if (!gameScene || typeof gameScene.init !== 'function') {
          console.error('[Game3D] gameScene is invalid — check GameScene3D.ts exports:', gameScene);
          const err = document.createElement('div');
          err.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ff6b6b;font:16px/1.4 sans-serif;text-align:center;padding:20px;background:#111';
          err.textContent = 'Error: GameScene failed to load. Check console.';
          container.appendChild(err);
          return;
        }
        scene = new THREE.Scene();
        const __envBg = __gs.environment?.backgroundColor;
        scene.background = new THREE.Color(__envBg || bgColor);
        // Expose factories BEFORE init so spawn restoration can use them immediately
        // (persisted spawn block polls for __vibexeFactories with a 30s timeout)
        (window as any).__vibexeFactories = {
          createPlatform3D, createCollectible3D, createPlayer3D,
          createBarrier3D, createDecoration3D, createAnimatedCharacter3D,
        };
        (window as any).__vibexe_scene__ = scene;

        // Optional fog from game settings
        if (__gs.environment?.fogEnabled) {
          const __fogColor = __gs.environment?.fogColor || __envBg || bgColor;
          scene.fog = new THREE.Fog(
            __fogColor,
            __gs.environment?.fogNear ?? 30,
            __gs.environment?.fogFar ?? 100
          );
        }

        // Engine-wide default lighting — balanced for cartoon/Phong materials.
        // Total light budget ~1.0 so colors render faithfully without clipping.
        // Games can remove/replace these in their init() if needed.
        const _defHemi = new THREE.HemisphereLight(
          __gs.environment?.hemisphereSkyColor || '#eef4ff',
          __gs.environment?.hemisphereGroundColor || '#886644',
          __gs.environment?.hemisphereIntensity ?? 0.35
        );
        _defHemi.name = '__default_hemi__';
        scene.add(_defHemi);
        const _defAmbient = new THREE.AmbientLight(
          __gs.environment?.ambientLightColor || '#ffffff',
          __gs.environment?.ambientLightIntensity ?? 0.15
        );
        _defAmbient.name = '__default_ambient__';
        scene.add(_defAmbient);
        const _defSun = new THREE.DirectionalLight(
          __gs.environment?.sunLightColor || '#fff8ee',
          __gs.environment?.sunLightIntensity ?? 0.55
        );
        _defSun.name = '__default_sun__';
        _defSun.position.set(8, 20, 10);
        _defSun.castShadow = true;
        const __shadowSizes: Record<string, number> = { low: 512, medium: 1024, high: 2048 };
        const __shadowSize = __shadowSizes[__gs.environment?.shadowQuality || 'medium'] || 1024;
        _defSun.shadow.mapSize.width = __shadowSize;
        _defSun.shadow.mapSize.height = __shadowSize;
        _defSun.shadow.camera.near = 0.5;
        _defSun.shadow.camera.far = 50;
        _defSun.shadow.camera.left = -20;
        _defSun.shadow.camera.right = 20;
        _defSun.shadow.camera.top = 20;
        _defSun.shadow.camera.bottom = -20;
        _defSun.shadow.bias = -0.001;
        scene.add(_defSun);

        const loading = createLoadingOverlay(container);

        (container as any).__restartGame = () => {
          disposeScene();
          clock.stop();
          clock.start();
          initAndRun();
        };

        // Inject scene/camera/renderer/world as properties on gameScene so BOTH patterns work:
        // Pattern A (correct): init(scene, camera, renderer, container, onProgress) — uses args
        // Pattern B (AI class): init() with this.scene/this.camera — uses injected props
        (gameScene as any).scene = scene;
        (gameScene as any).camera = camera;
        (gameScene as any).renderer = renderer;
        (gameScene as any).container = container;

        // Auto-create physics world — always available as gameScene.world / this.world
        // Store on window so idempotent createPhysicsWorld() returns it
        const world = createPhysicsWorld(__gs.physics?.gravity ?? GRAVITY_3D);
        if (world) {
          createPhysicsGround(world);
          (window as any).__vibexe_world__ = world;
        }

        // Resilient world property: AI code often overwrites this.world with {} or null
        // during init(), then calls this.world.gravity.set() which crashes.
        // Use defineProperty so only actual CANNON.World objects (with .step) are accepted.
        let __pw = world;
        try {
          Object.defineProperty(gameScene, 'world', {
            get() { return __pw; },
            set(val: any) {
              if (val && typeof val.step === 'function') __pw = val;
              // Silently discard plain objects, null, undefined
            },
            configurable: true,
            enumerable: true,
          });
        } catch {
          // Fallback if defineProperty fails (frozen object, etc.)
          (gameScene as any).world = world;
        }

        await gameScene.init(scene, camera, renderer, container, (p: number) => {
          loading.setProgress(p);
        });

        // Apply scene editor transform overrides (saved via Save Scene button)
        // Data is set as window.__SCENE_OVERRIDES__ in GameScene3D.ts override block
        const __scOv = (window as any).__SCENE_OVERRIDES__;
        if (__scOv && typeof __scOv === 'object' && Object.keys(__scOv).length > 0) {
          const __facPfx = ["Platform_","Collectible_","Barrier_","Decoration_","Player_","Character_","Object_"];
          const __isFac = (n: string) => n ? __facPfx.some(p => n.startsWith(p)) : false;
          const __applied = new Set<string>();
          const __tryApply = () => {
            let rem = 0;
            for (const [name, o] of Object.entries(__scOv as Record<string, any>)) {
              if (__applied.has(name)) continue;
              let t: any = null;
              if (name.startsWith("UnnamedGroup_")) {
                const gi = parseInt(name.replace("UnnamedGroup_", ""), 10);
                let gc = 0;
                for (const ch of scene.children) {
                  if ((ch as any).type === "Group" && (ch as any).children?.length > 0 && !__isFac((ch as any).name || "")) {
                    if (gc === gi) { t = ch; break; }
                    gc++;
                  }
                }
              } else {
                scene.traverse((c: any) => { if (!t && c.name === name) t = c; });
              }
              if (t) {
                if (o.p) t.position.set(o.p[0], o.p[1], o.p[2]);
                if (o.r) t.rotation.set(o.r[0], o.r[1], o.r[2]);
                if (o.s) t.scale.set(o.s[0], o.s[1], o.s[2]);
                // Restore texture if saved
                if (o.t && o.t[0]) {
                  _applyTextureToMesh(t, o.t[0], o.t[1] || 1, o.t[2] || 1, 0, 0, 0, !!o.t[3]);
                  console.log("[SCENE_EDITOR] Applied:", name, "+texture");
                } else {
                  console.log("[SCENE_EDITOR] Applied:", name);
                }
                __applied.add(name);
              } else { rem++; }
            }
            return rem === 0;
          };
          if (!__tryApply()) {
            let __att = 0;
            const __iv = setInterval(() => {
              if (disposed) { clearInterval(__iv); return; }
              __att++;
              if (__tryApply() || __att > 100) {
                clearInterval(__iv);
                if (__att > 1) console.log("[SCENE_EDITOR] Override polling done after", __att, "polls");
              }
            }, 300);
          }
        }

        if (disposed) return;
        loading.setProgress(1);
        renderer.render(scene, camera);
        loading.remove();

        // ===== Post-Processing from Game Settings =====
        // Apply post-processing preset if configured via settings UI.
        // Uses the existing createPostProcessing() pipeline which stores
        // the EffectComposer on window.__vibexe_composer__ for the render loop.
        const __ppSettings = __gs.postProcessing;
        if (__ppSettings && __ppSettings.preset && __ppSettings.preset !== "none") {
          const __pp = createPostProcessing(renderer, scene, camera, __ppSettings.preset);
          if (__pp) {
            // Apply custom bloom overrides if user adjusted them from preset defaults
            const __presetData = POST_PROCESSING_PRESETS[__ppSettings.preset];
            const __customIntensity = __ppSettings.bloomIntensity;
            const __customThreshold = __ppSettings.bloomThreshold;
            if (__customIntensity != null || __customThreshold != null) {
              __pp.addBloom({
                strength: __customIntensity ?? __presetData?.bloom?.strength ?? 0.5,
                radius: __presetData?.bloom?.radius ?? 0.4,
                threshold: __customThreshold ?? __presetData?.bloom?.threshold ?? 0.85,
              });
            }
          }
        }

        // ===== Scene Editor Integration =====
        // Expose hooks for the game editor bridge to pause/resume and control camera.
        // MUST be set BEFORE menu overlay so Scene Editor can activate without waiting for tap.
        let __editorMode = false;
        let __editorOrbitControls: any = null;
        let __editorLastTime = 0;
        let __animProgressInterval: any = null;
        let __menuOverlay: { remove(): void } | null = null;
        let __menuResolve: (() => void) | null = null;

        (window as any).__vibexe_editor__ = {
          scene, camera, renderer,
          get world() { return (gameScene as any).world; },
          gameScene,
          get isEditing() { return __editorMode; },
          orbitControls: null as any,
          pause() {
            __editorMode = true;
            clock.stop();
            __editorLastTime = 0;
            // Mute BGM in editor mode
            muteMusic();
            // Auto-dismiss menu overlay if still showing
            if (__menuOverlay) {
              __menuOverlay.remove();
              __menuOverlay = null;
              if (__menuResolve) { __menuResolve(); __menuResolve = null; }
            }
            if (THREE.OrbitControls) {
              __editorOrbitControls = new THREE.OrbitControls(camera, renderer.domElement);
              __editorOrbitControls.enableDamping = true;
              __editorOrbitControls.dampingFactor = 0.08;
              // Unity-style: LEFT=select/gizmo, MIDDLE=pan, RIGHT=orbit, scroll=zoom
              __editorOrbitControls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
              __editorOrbitControls.screenSpacePanning = true;
              __editorOrbitControls.target.set(0, 1, 0);
              __editorOrbitControls.update();
              (window as any).__vibexe_editor__.orbitControls = __editorOrbitControls;
            }
          },
          resume() {
            __editorMode = false;
            if (__editorOrbitControls) {
              __editorOrbitControls.dispose();
              __editorOrbitControls = null;
              (window as any).__vibexe_editor__.orbitControls = null;
            }
            // Restore BGM when leaving editor mode
            unmuteMusic();
            clock.start();
          },
        };

        // Show menu overlay — but editor pause() can dismiss it
        await new Promise<void>((resolve) => {
          if (disposed) { resolve(); return; }
          __menuResolve = resolve;
          __menuOverlay = createMenuOverlay(container, () => {
            // Resume AudioContext on user interaction (autoplay policy)
            try { (window as any)._audioCtx?.resume(); (window as any)._getAudioContext?.(); } catch {}
            __menuOverlay = null;
            __menuResolve = null;
            resolve();
          });
        });

        if (disposed) return;

        // ===== Embedded Scene Editor Bridge =====
        // Runs in same context as game — no external script / IIFE issues.
        // Handles: postMessage, raycaster selection, TransformControls, scene tree serialization.
        {
          // Strip non-serializable values (functions, Three.js objects) from userData for postMessage
          function _safeUserData(ud: any): any {
            if (!ud || typeof ud !== "object") return {};
            const safe: any = {};
            for (const k of Object.keys(ud)) {
              const v = ud[k];
              if (typeof v === "function") continue;
              if (v && typeof v === "object") {
                if (v.isObject3D || v.isBufferGeometry || v.isMaterial || v instanceof HTMLElement) continue;
                try { JSON.stringify(v); safe[k] = v; } catch { continue; }
              } else {
                safe[k] = v;
              }
            }
            return safe;
          }

          let _bridgeActive = false;
          let _raycaster: any = null;
          let _mouse: any = null;
          let _selectedObj: any = null;
          let _boxHelper: any = null;
          let _transformControls: any = null;
          let _editorAnimId = 0;
          // Spawn mode state — set by palette selection
          let _spawnMode = false;
          let _spawnFactory: string | null = null;
          let _spawnArgs: Record<string, any> = {};

          const editor = (window as any).__vibexe_editor__;

          // ---- Scene Serializer ----
          function _serializeNode(obj: any): any {
            if (!obj) return null;
            const children: any[] = [];
            if (obj.children) {
              for (let i = 0; i < obj.children.length; i++) {
                const child = obj.children[i];
                if (child === _boxHelper) continue;
                if (child === _transformControls) continue;
                if (child.type === "BoxHelper" || child.type === "TransformControlsGizmo" || child.type === "TransformControlsPlane") continue;
                if (child.isTransformControls) continue;
                // Skip particles, trails, and Points objects (VFX internals)
                if (child.type === "Points") continue;
                if (child.name && (child.name.indexOf("__particle_") === 0 || child.name.indexOf("__trail_") === 0)) continue;
                const s = _serializeNode(child);
                if (s) children.push(s);
              }
            }
            let matColor: string | null = null;
            if (obj.material && obj.material.color) {
              try { matColor = "#" + obj.material.color.getHexString(); } catch {}
            }
            if (!matColor && obj.isGroup && obj.children) {
              for (let j = 0; j < obj.children.length; j++) {
                const c = obj.children[j];
                if (c.material && c.material.color) {
                  try { matColor = "#" + c.material.color.getHexString(); } catch {}
                  break;
                }
              }
            }
            return {
              uuid: obj.uuid,
              name: obj.name || obj.type,
              type: obj.type || "Object3D",
              position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
              rotation: {
                x: obj.rotation.x * 180 / Math.PI,
                y: obj.rotation.y * 180 / Math.PI,
                z: obj.rotation.z * 180 / Math.PI,
              },
              scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
              visible: obj.visible !== false,
              userData: _safeUserData(obj.userData),
              children,
              _isMesh: !!obj.isMesh,
              _isLight: !!obj.isLight,
              _isGroup: !!obj.isGroup,
              _materialColor: matColor,
            };
          }

          function _sendSceneTree() {
            const tree = _serializeNode(scene);
            window.parent.postMessage({ type: "game-editor-scene-tree", tree }, "*");
          }

          function _sendSelectedObject(obj: any) {
            if (!obj) {
              window.parent.postMessage({ type: "game-editor-object-deselected" }, "*");
              return;
            }
            let matColor: string | null = null;
            if (obj.material && obj.material.color) {
              try { matColor = "#" + obj.material.color.getHexString(); } catch {}
            }
            window.parent.postMessage({
              type: "game-editor-object-selected",
              uuid: obj.uuid,
              name: obj.name || obj.type,
              objType: obj.userData?.vibexeType || obj.type,
              position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
              rotation: {
                x: obj.rotation.x * 180 / Math.PI,
                y: obj.rotation.y * 180 / Math.PI,
                z: obj.rotation.z * 180 / Math.PI,
              },
              scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
              visible: obj.visible !== false,
              castShadow: !!obj.castShadow,
              userData: _safeUserData(obj.userData),
              _materialColor: matColor,
              _textureUrl: obj.userData?.vibexeArgs?.textureUrl || null,
              _textureTileX: obj.userData?.vibexeArgs?.textureTileX || 1,
              _textureTileY: obj.userData?.vibexeArgs?.textureTileY || 1,
              _textureRotation: obj.userData?.vibexeArgs?.textureRotation || 0,
              _textureOffsetX: obj.userData?.vibexeArgs?.textureOffsetX || 0,
              _textureOffsetY: obj.userData?.vibexeArgs?.textureOffsetY || 0,
              _hasPBR: obj.userData?.vibexeArgs?.hasPBR || false,
            }, "*");
          }

          // ---- Environment map for PBR ----
          let _envMapGenerated = false;
          function _ensureEnvironmentMap() {
            if (_envMapGenerated) return;
            const pmrem = new THREE.PMREMGenerator(renderer);
            pmrem.compileEquirectangularShader();
            _envMapGenerated = true;
            // Studio env — high contrast for realistic metal reflections
            // Dark sky/ground + concentrated bright lights = metals show dark body + bright highlights
            const envScene = new THREE.Scene();
            const _skyGeo = new THREE.SphereGeometry(50, 32, 16);
            envScene.add(new THREE.Mesh(_skyGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.4, 0.55), side: THREE.BackSide })));
            const _gndGeo = new THREE.SphereGeometry(49, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
            envScene.add(new THREE.Mesh(_gndGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.13, 0.1), side: THREE.BackSide })));
            const _pGeo = new THREE.PlaneGeometry(8, 8);
            const _addPanel = (x: number, y: number, z: number, r: number, g: number, b: number, sx: number, sy: number) => {
              const p = new THREE.Mesh(_pGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide }));
              p.position.set(x, y, z); p.lookAt(0, 0, 0); p.scale.set(sx, sy, 1);
              envScene.add(p);
            };
            _addPanel(0, 45, -10, 10, 9, 8, 2, 2);       // Key light (bright, small)
            _addPanel(-15, 40, 25, 4, 4, 5, 1.5, 1.5);   // Rim light
            _addPanel(35, 20, -15, 2, 2, 2.5, 2, 2);      // Fill (subtle)
            _addPanel(-35, 12, 8, 1, 1, 1.2, 2, 2);       // Fill (subtle)
            _addPanel(0, -30, 0, 0.5, 0.5, 0.6, 4, 4);   // Bottom fill (dim)
            scene.environment = pmrem.fromScene(envScene, 0, 0.1, 100).texture;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 2.5;
            pmrem.dispose(); _skyGeo.dispose(); _gndGeo.dispose(); _pGeo.dispose();

            // Moderate light boost for PBR (Standard material /PI factor)
            const _al = scene.getObjectByName("__default_ambient__") as any;
            if (_al) _al.intensity = Math.max(_al.intensity, 0.3);
            const _hl = scene.getObjectByName("__default_hemi__") as any;
            if (_hl) _hl.intensity = Math.max(_hl.intensity, 0.5);

            // PBR key light for specular highlights
            if (!scene.getObjectByName("__pbr_key__")) {
              const pbrKey = new THREE.DirectionalLight(0xFFFBF0, 1.2);
              pbrKey.name = "__pbr_key__";
              pbrKey.position.set(15, 30, -10);
              pbrKey.castShadow = false;
              scene.add(pbrKey);
            }
          }

          // ---- Texture helpers ----
          const _textureCache: Record<string, any> = {};
          const _originalMaps = new WeakMap<any, any>();

          function _applyTextureToMesh(obj: any, textureUrl: string, tileX: number, tileY: number, rotation?: number, offsetX?: number, offsetY?: number, hasPBR?: boolean) {
            // Resolve relative URLs for sandpack iframe (different origin)
            let _resolvedUrl = textureUrl;
            if (textureUrl.startsWith("/")) {
              const _apiOrigin = (window as any).__VIBEXE_API_ORIGIN__ || "";
              _resolvedUrl = _apiOrigin + textureUrl;
            }
            // Store immediately (before async load) so _sendSelectedObject picks it up
            if (!obj.userData) obj.userData = {};
            if (!obj.userData.vibexeArgs) obj.userData.vibexeArgs = {};
            obj.userData.vibexeArgs.textureUrl = textureUrl;
            obj.userData.vibexeArgs.textureTileX = tileX;
            obj.userData.vibexeArgs.textureTileY = tileY;
            obj.userData.vibexeArgs.textureRotation = rotation || 0;
            obj.userData.vibexeArgs.textureOffsetX = offsetX || 0;
            obj.userData.vibexeArgs.textureOffsetY = offsetY || 0;
            if (hasPBR) obj.userData.vibexeArgs.hasPBR = true;
            else delete obj.userData.vibexeArgs.hasPBR;
            const _rot = (rotation || 0) * Math.PI / 180;
            const _offX = offsetX || 0;
            const _offY = offsetY || 0;

            // === PBR path ===
            if (hasPBR) {
              _ensureEnvironmentMap();
              const _baseNoExt = _resolvedUrl.replace(/\.[^.]+$/, "");
              const _ext = _resolvedUrl.match(/\.[^.]+$/)?.[0] || ".jpg";
              const _normalUrl = _baseNoExt + "_Normal" + _ext;
              const _roughnessUrl = _baseNoExt + "_Roughness" + _ext;
              const _metalnessUrl = _baseNoExt + "_Metalness" + _ext;
              const _aoUrl = _baseNoExt + "_AO" + _ext;

              // Category-based metalness + normalScale from filename
              const _fname = _resolvedUrl.split("/").pop() || "";
              const _isMetal = /^Metal|^CorrugatedSteel|^DiamondPlate|^PaintedMetal/i.test(_fname);
              let _normalScale = 1.0;
              if (_isMetal) _normalScale = 0.8;
              else if (/^Brick/i.test(_fname)) _normalScale = 1.5;
              else if (/^Rock|^Paving/i.test(_fname)) _normalScale = 1.2;
              else if (/^Wood|^WoodFloor|^Planks/i.test(_fname)) _normalScale = 0.6;
              else if (/^Concrete|^Plaster/i.test(_fname)) _normalScale = 0.8;
              else if (/^Fabric|^Leather|^Carpet/i.test(_fname)) _normalScale = 0.5;
              else if (/^Marble|^Granite|^Onyx|^Travertine/i.test(_fname)) _normalScale = 0.7;
              else if (/^Asphalt|^Road/i.test(_fname)) _normalScale = 1.0;

              const _configureTex = (tex: any, isSRGB: boolean) => {
                const t = tex.clone();
                t.needsUpdate = true;
                t.wrapS = THREE.RepeatWrapping;
                t.wrapT = THREE.RepeatWrapping;
                t.repeat.set(tileX, tileY);
                t.rotation = _rot;
                t.center.set(0.5, 0.5);
                t.offset.set(_offX, _offY);
                t.anisotropy = 4;
                if (isSRGB && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
                return t;
              };

              const _loadTex = (url: string): Promise<any> => {
                if (url in _textureCache) return Promise.resolve(_textureCache[url]);
                return new Promise((resolve) => {
                  new THREE.TextureLoader().load(url, (tex: any) => {
                    _textureCache[url] = tex;
                    resolve(tex);
                  }, undefined, () => { _textureCache[url] = null; resolve(null); });
                });
              };

              Promise.all([
                _loadTex(_resolvedUrl),
                _loadTex(_normalUrl),
                _loadTex(_roughnessUrl),
                _isMetal ? _loadTex(_metalnessUrl) : Promise.resolve(null),
                _loadTex(_aoUrl),
              ]).then(([colorTex, normalTex, roughnessTex, metalnessTex, aoTex]: any[]) => {
                if (!colorTex) return;
                // Category-based metalness: only Metal* textures are truly metallic
                const _metalVal = _isMetal ? 0.95 : 0.0;
                const _envIntensity = _isMetal ? 1.0 : 0.3;
                const applyPBR = (child: any) => {
                  if (!child.isMesh || !child.material) return;
                  const mats = Array.isArray(child.material) ? child.material : [child.material];
                  const newMats = mats.map((mat: any) => {
                    if (!child.__vibexe_origMats) child.__vibexe_origMats = [];
                    child.__vibexe_origMats.push(mat);
                    const _matOpts: any = {
                      map: _configureTex(colorTex, true),
                      roughness: roughnessTex ? 1.0 : (_isMetal ? 0.3 : 0.7),
                      metalness: _metalVal,
                      envMapIntensity: _envIntensity,
                      side: THREE.DoubleSide,
                    };
                    if (scene.environment) _matOpts.envMap = scene.environment;
                    if (normalTex) {
                      _matOpts.normalMap = _configureTex(normalTex, false);
                      _matOpts.normalScale = new THREE.Vector2(_normalScale, _normalScale);
                    }
                    if (roughnessTex) _matOpts.roughnessMap = _configureTex(roughnessTex, false);
                    if (metalnessTex && _isMetal) _matOpts.metalnessMap = _configureTex(metalnessTex, false);
                    if (aoTex) {
                      _matOpts.aoMap = _configureTex(aoTex, false);
                      _matOpts.aoMapIntensity = 1.0;
                    }
                    const stdMat = new THREE.MeshStandardMaterial(_matOpts);
                    // AO requires uv2 attribute
                    if (aoTex && child.geometry && child.geometry.attributes.uv && !child.geometry.attributes.uv2) {
                      child.geometry.setAttribute("uv2", child.geometry.attributes.uv);
                    }
                    return stdMat;
                  });
                  child.material = Array.isArray(child.material) ? newMats : newMats[0];
                  if (Array.isArray(child.material)) child.material.forEach((m: any) => { m.needsUpdate = true; });
                  else if (child.material) child.material.needsUpdate = true;
                };
                obj.traverse(applyPBR);
                if (obj.isMesh && obj.material) applyPBR(obj);
              });
              return;
            }

            // === Non-PBR path (unchanged) ===
            const applyToMat = (mat: any, tex: any) => {
              if (!_originalMaps.has(mat)) {
                _originalMaps.set(mat, { map: mat.map, color: mat.color ? mat.color.clone() : null });
              }
              // Clone texture per material so repeat/wrap are independent
              const t = tex.clone();
              t.needsUpdate = true;
              t.wrapS = THREE.RepeatWrapping;
              t.wrapT = THREE.RepeatWrapping;
              t.repeat.set(tileX, tileY);
              t.rotation = _rot;
              t.center.set(0.5, 0.5);
              t.offset.set(_offX, _offY);
              // sRGB encoding so texture renders with correct colors under lighting
              if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
              t.anisotropy = 4;
              mat.map = t;
              // Set color to white so texture is not tinted by original material color
              if (mat.color) mat.color.set(0xffffff);
              mat.needsUpdate = true;
            };
            const apply = (tex: any) => {
              obj.traverse((child: any) => {
                if (!child.isMesh || !child.material) return;
                if (Array.isArray(child.material)) {
                  child.material.forEach((m: any) => applyToMat(m, tex));
                } else {
                  applyToMat(child.material, tex);
                }
              });
              // Also apply to obj itself if it's a mesh
              if (obj.isMesh && obj.material) {
                if (Array.isArray(obj.material)) {
                  obj.material.forEach((m: any) => applyToMat(m, tex));
                } else {
                  applyToMat(obj.material, tex);
                }
              }
              // userData already set at top of _applyTextureToMesh
            };
            if (_textureCache[_resolvedUrl]) {
              apply(_textureCache[_resolvedUrl]);
            } else {
              new THREE.TextureLoader().load(_resolvedUrl, (tex: any) => {
                _textureCache[_resolvedUrl] = tex;
                apply(tex);
              });
            }
          }

          function _removeTextureFromMesh(obj: any) {
            // PBR restoration: check for stored original materials
            const restorePBR = (child: any) => {
              if (child.__vibexe_origMats && child.isMesh) {
                const origMats = child.__vibexe_origMats;
                if (Array.isArray(child.material)) {
                  // Dispose PBR materials
                  child.material.forEach((m: any) => { if (m.dispose) m.dispose(); });
                  child.material = origMats.length > 1 ? origMats : origMats[0];
                } else {
                  if (child.material.dispose) child.material.dispose();
                  child.material = origMats[0];
                }
                delete child.__vibexe_origMats;
                return true;
              }
              return false;
            };
            let hadPBR = false;
            obj.traverse((child: any) => {
              if (restorePBR(child)) hadPBR = true;
            });
            if (obj.isMesh) {
              if (restorePBR(obj)) hadPBR = true;
            }

            if (!hadPBR) {
              // Non-PBR restoration (unchanged)
              const restore = (mat: any) => {
                if (_originalMaps.has(mat)) {
                  const orig = _originalMaps.get(mat);
                  // Restore both map and color (may be {map,color} object or legacy bare map)
                  if (orig && typeof orig === "object" && "map" in orig) {
                    mat.map = orig.map;
                    if (orig.color && mat.color) mat.color.copy(orig.color);
                  } else {
                    mat.map = orig; // legacy: was just the map
                  }
                  _originalMaps.delete(mat);
                  mat.needsUpdate = true;
                }
              };
              obj.traverse((child: any) => {
                if (!child.isMesh || !child.material) return;
                if (Array.isArray(child.material)) {
                  child.material.forEach(restore);
                } else {
                  restore(child.material);
                }
              });
              if (obj.isMesh && obj.material) {
                if (Array.isArray(obj.material)) {
                  obj.material.forEach(restore);
                } else {
                  restore(obj.material);
                }
              }
            }
            if (obj.userData?.vibexeArgs) {
              delete obj.userData.vibexeArgs.textureUrl;
              delete obj.userData.vibexeArgs.textureTileX;
              delete obj.userData.vibexeArgs.textureTileY;
              delete obj.userData.vibexeArgs.textureRotation;
              delete obj.userData.vibexeArgs.textureOffsetX;
              delete obj.userData.vibexeArgs.textureOffsetY;
              delete obj.userData.vibexeArgs.hasPBR;
            }
            delete obj.__hasTextureOverride;
          }

          // ---- Selection ----
          function _deselectObject() {
            if (_boxHelper) {
              scene.remove(_boxHelper);
              if (_boxHelper.dispose) _boxHelper.dispose();
              _boxHelper = null;
            }
            if (_transformControls) {
              _transformControls.detach();
              scene.remove(_transformControls);
              _transformControls.dispose();
              _transformControls = null;
            }
            _selectedObj = null;
            window.parent.postMessage({ type: "game-editor-object-deselected" }, "*");
          }

          function _selectObject(obj: any) {
            // Never attach TransformControls to the scene root — causes infinite recursion
            if (!obj || obj === scene || obj.type === "Scene" || !obj.parent) return;
            // When external bridge exists, DON'T create gizmo — let external bridge handle it.
            // Just track selection for spawn and notify parent.
            const _hasExt = !!(window as any).__vibexeExternalBridge;
            if (_hasExt) {
              _selectedObj = obj;
              if (obj) _sendSelectedObject(obj);
              return;
            }
            _deselectObject();
            if (!obj) return;
            _selectedObj = obj;

            _boxHelper = new THREE.BoxHelper(obj, 0x00ff88);
            _boxHelper.name = "__editor_box_helper__";
            // Override BoxHelper.update for animated characters — SkinnedMesh bind-pose gives wrong Box3
            if (obj.userData?.vibexeType === "AnimatedCharacter" && obj.userData.__characterBounds) {
              const _cb = obj.userData.__characterBounds;
              const _bObj = obj;
              _boxHelper.update = function() {
                const wp = new THREE.Vector3();
                _bObj.getWorldPosition(wp);
                const hx = _cb.halfX, hz = _cb.halfZ, h = _cb.height;
                const pos = this.geometry.attributes.position;
                if (!pos) return;
                const a = pos.array;
                // 8 vertices matching Three.js BoxHelper layout
                a[0]=wp.x+hx; a[1]=wp.y+h; a[2]=wp.z+hz;
                a[3]=wp.x-hx; a[4]=wp.y+h; a[5]=wp.z+hz;
                a[6]=wp.x-hx; a[7]=wp.y;   a[8]=wp.z+hz;
                a[9]=wp.x+hx; a[10]=wp.y;  a[11]=wp.z+hz;
                a[12]=wp.x+hx;a[13]=wp.y+h;a[14]=wp.z-hz;
                a[15]=wp.x-hx;a[16]=wp.y+h;a[17]=wp.z-hz;
                a[18]=wp.x-hx;a[19]=wp.y;  a[20]=wp.z-hz;
                a[21]=wp.x+hx;a[22]=wp.y;  a[23]=wp.z-hz;
                pos.needsUpdate = true;
                this.geometry.computeBoundingSphere();
              };
              _boxHelper.update();
            }
            scene.add(_boxHelper);

            // TransformControls must be loaded via sync XHR shim (sandpack-adapter.ts)
            // or externalResources CDN script. Check both captured ref and window.THREE.
            const TC = THREE.TransformControls || (window as any).THREE?.TransformControls;
            if (TC) {
              _transformControls = new TC(camera, renderer.domElement);
              _transformControls.name = "__editor_transform_controls__";
              _transformControls.attach(obj);
              _transformControls.addEventListener("dragging-changed", (e: any) => {
                if (editor.orbitControls) editor.orbitControls.enabled = !e.value;
              });
              _transformControls.addEventListener("objectChange", () => {
                if (_selectedObj) {
                  _sendSelectedObject(_selectedObj);
                  if (_boxHelper) _boxHelper.update();
                }
              });
              scene.add(_transformControls);
            } else {
              console.warn("[Editor] TransformControls not available — gizmo disabled. Ensure CDN loaded.");
            }
            _sendSelectedObject(obj);
          }

          function _findByUuid(obj: any, uuid: string): any {
            if (!obj) return null;
            if (obj.uuid === uuid) return obj;
            if (obj.children) {
              for (let i = 0; i < obj.children.length; i++) {
                const found = _findByUuid(obj.children[i], uuid);
                if (found) return found;
              }
            }
            return null;
          }

          function _findSceneParent(obj: any): any {
            if (!obj) return obj;
            let current = obj;
            while (current.parent && current.parent !== scene) current = current.parent;
            return current;
          }

          // ---- Click + Keyboard ----
          function _onCanvasClick(e: MouseEvent) {
            if (!_bridgeActive) return;
            // Dynamic check: if external bridge loaded, only handle spawn clicks
            const _hasExt = !!(window as any).__vibexeExternalBridge;
            if (_hasExt && !_spawnMode) return;
            if (_transformControls && _transformControls.dragging) return;
            const rect = renderer.domElement.getBoundingClientRect();
            _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            _raycaster.setFromCamera(_mouse, camera);

            // --- Spawn mode: raycast to find spawn position, then create object ---
            if (_spawnMode && _spawnFactory) {
              const allMeshes: any[] = [];
              scene.traverse((child: any) => {
                if (child.isMesh && child !== _boxHelper &&
                    child.type !== "TransformControlsGizmo" &&
                    child.type !== "TransformControlsPlane" &&
                    !child.name.startsWith("__editor_")) {
                  allMeshes.push(child);
                }
              });
              const spawnHits = _raycaster.intersectObjects(allMeshes, false);
              let spawnPos = { x: 0, y: 2, z: 0 };
              if (spawnHits.length > 0) {
                const pt = spawnHits[0].point;
                spawnPos = { x: pt.x, y: pt.y + 0.5, z: pt.z };
              } else {
                // No intersection — project click 10 units from camera
                const dir = new THREE.Vector3(_mouse.x, _mouse.y, 0.5).unproject(camera).sub(camera.position).normalize();
                const projPt = camera.position.clone().add(dir.multiplyScalar(10));
                spawnPos = { x: projPt.x, y: Math.max(0.5, projPt.y), z: projPt.z };
              }
              // Resolve __MODEL_URL__ placeholders in spawn args
              const _resolvedArgs2 = { ..._spawnArgs };
              for (const _k of Object.keys(_resolvedArgs2)) {
                const _v = _resolvedArgs2[_k];
                if (typeof _v === "string" && _v.startsWith("__MODEL_URL__")) {
                  const _rest = _v.slice(13); // "__MODEL_URL__".length
                  const _sep = _rest.indexOf("__");
                  if (_sep >= 0) {
                    _resolvedArgs2[_k] = modelUrl(_rest.slice(0, _sep), _rest.slice(_sep + 2));
                  }
                }
              }
              // Validate no unresolved __MODEL_URL__ placeholders remain
              let _hasUnresolved2 = false;
              for (const _uk2 of Object.keys(_resolvedArgs2)) {
                if (typeof _resolvedArgs2[_uk2] === "string" && _resolvedArgs2[_uk2].startsWith("__MODEL_URL__")) {
                  console.warn("[SPAWN] Failed to resolve model URL:", _resolvedArgs2[_uk2]);
                  _hasUnresolved2 = true;
                }
              }
              if (!_hasUnresolved2) {
              // Spawn via the same handler as palette double-click
              const _fns2: Record<string, Function> = {
                createPlatform3D, createCollectible3D, createPlayer3D,
                createBarrier3D, createDecoration3D, createAnimatedCharacter3D,
              };
              const fn2 = _fns2[_spawnFactory] || (window as any)[_spawnFactory];
              if (fn2) {
                (async () => {
                  try {
                    const result = await fn2(scene, spawnPos.x, spawnPos.y, spawnPos.z, _resolvedArgs2);
                    if (result?.mesh) {
                      result.mesh.userData.__spawned = true;
                      _sendSceneTree();
                      window.parent.postMessage({
                        type: "game-editor-object-spawned",
                        uuid: result.mesh.uuid,
                        name: result.mesh.name,
                      }, "*");
                      // Auto-reset spawn mode after successful spawn
                      _spawnMode = false;
                      _spawnFactory = null;
                      _spawnArgs = {};
                      renderer.domElement.style.cursor = "";
                      _selectObject(result.mesh);
                    }
                  } catch (spawnErr) {
                    console.warn("[Editor] Click-spawn failed:", spawnErr);
                  }
                })();
              }
              } // close _hasUnresolved2 guard
              return; // Don't fall through to selection
            }

            // --- Normal mode: select object ---
            const meshes: any[] = [];
            scene.traverse((child: any) => {
              if (child.isMesh && child !== _boxHelper &&
                  child.type !== "TransformControlsGizmo" &&
                  child.type !== "TransformControlsPlane" &&
                  !child.name.startsWith("__editor_") &&
                  !child.name.startsWith("__particle_") &&
                  !child.name.startsWith("__trail_")) {
                meshes.push(child);
              }
            });
            const intersects = _raycaster.intersectObjects(meshes, false);
            if (intersects.length > 0) {
              const target = _findSceneParent(intersects[0].object);
              if (target && target !== scene) _selectObject(target);
            } else {
              _deselectObject();
            }
          }

          function _onKeyDown(e: KeyboardEvent) {
            if (!_bridgeActive) return;
            if ((window as any).__vibexeExternalBridge) return; // External bridge handles keyboard
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            switch (e.key) {
              case "w": case "W":
                if (_transformControls) _transformControls.setMode("translate");
                window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "translate" }, "*");
                e.preventDefault(); break;
              case "e": case "E":
                if (_transformControls) _transformControls.setMode("rotate");
                window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "rotate" }, "*");
                e.preventDefault(); break;
              case "r": case "R":
                if (_transformControls) _transformControls.setMode("scale");
                window.parent.postMessage({ type: "game-editor-gizmo-mode", mode: "scale" }, "*");
                e.preventDefault(); break;
              case "Escape":
                _deselectObject(); e.preventDefault(); break;
              case "Delete": case "Backspace":
                if (_selectedObj) {
                  const uuid = _selectedObj.uuid;
                  scene.remove(_selectedObj);
                  _deselectObject();
                  _sendSceneTree();
                  window.parent.postMessage({ type: "game-editor-object-deleted", uuid }, "*");
                }
                e.preventDefault(); break;
            }
          }

          // ---- Editor Loop ----
          function _editorLoop() {
            if (!_bridgeActive) return;
            // External bridge has its own render loop — don't double-render
            if ((window as any).__vibexeExternalBridge) return;
            _editorAnimId = requestAnimationFrame(_editorLoop);
            if (editor.orbitControls) editor.orbitControls.update();
            if (_boxHelper && _selectedObj) _boxHelper.update();
            const __ec = (window as any).__vibexe_composer__;
            if (__ec) { __ec.render(); } else { renderer.render(scene, camera); }
          }

          // ---- Activate / Deactivate ----
          function _activateBridge() {
            if (_bridgeActive) return;
            _bridgeActive = true;
            editor.pause();
            _raycaster = new THREE.Raycaster();
            _mouse = new THREE.Vector2();
            // Always register click handler (needed for spawn mode).
            // Dynamic checks inside _onCanvasClick/_onKeyDown skip selection when external bridge is active.
            renderer.domElement.addEventListener("click", _onCanvasClick);
            window.addEventListener("keydown", _onKeyDown, true);
            _editorLoop(); // Dynamic check inside will skip if external bridge loaded
            // Only send ready/tree if no external bridge (it sends its own)
            if (!(window as any).__vibexeExternalBridge) {
              setTimeout(() => {
                _sendSceneTree();
                window.parent.postMessage({ type: "game-editor-ready" }, "*");
              }, 100);
            }
          }

          function _deactivateBridge() {
            if (!_bridgeActive) return;
            _bridgeActive = false;
            if (__animProgressInterval) { clearInterval(__animProgressInterval); __animProgressInterval = null; }
            cancelAnimationFrame(_editorAnimId);
            _deselectObject();
            renderer.domElement.removeEventListener("click", _onCanvasClick);
            window.removeEventListener("keydown", _onKeyDown, true);
            // Reset spawn mode
            _spawnMode = false;
            _spawnFactory = null;
            _spawnArgs = {};
            renderer.domElement.style.cursor = "";
            editor.resume();
            _raycaster = null;
            _mouse = null;
          }

          // ---- Property Updates ----
          function _updateProperty(uuid: string, property: string, value: any) {
            const obj = _findByUuid(scene, uuid);
            if (!obj) return;
            switch (property) {
              case "position.x": obj.position.x = Number(value); break;
              case "position.y": obj.position.y = Number(value); break;
              case "position.z": obj.position.z = Number(value); break;
              case "rotation.x": obj.rotation.x = Number(value) * Math.PI / 180; break;
              case "rotation.y": obj.rotation.y = Number(value) * Math.PI / 180; break;
              case "rotation.z": obj.rotation.z = Number(value) * Math.PI / 180; break;
              case "scale.x": obj.scale.x = Number(value); break;
              case "scale.y": obj.scale.y = Number(value); break;
              case "scale.z": obj.scale.z = Number(value); break;
              case "visible": obj.visible = !!value; break;
              case "name": obj.name = String(value); break;
            }
            if (_boxHelper && _selectedObj && _selectedObj.uuid === uuid) _boxHelper.update();
            _sendSelectedObject(obj);
            _sendSceneTree();
          }

          // ---- PostMessage Handler ----
          window.addEventListener("message", (e: MessageEvent) => {
            const d = e.data;
            if (!d || !d.type) return;
            if (d.type && d.type.startsWith("game-editor-") && d.type.includes("texture")) {
              console.log("[TEXTURE-MSG] Received message:", d.type, JSON.stringify(d));
            }
            const _extBridge = !!(window as any).__vibexeExternalBridge;
            switch (d.type) {
              case "game-editor-enable": _activateBridge(); break;
              case "game-editor-disable": _deactivateBridge(); break;
              // Selection/gizmo/property/delete/tree — deferred to external bridge when present
              case "game-editor-set-mode":
                if (!_extBridge && _transformControls && d.mode) _transformControls.setMode(d.mode);
                break;
              case "game-editor-select-by-uuid":
                if (!_extBridge && d.uuid) { const obj = _findByUuid(scene, d.uuid); if (obj) _selectObject(obj); }
                break;
              case "game-editor-deselect":
                if (!_extBridge) _deselectObject();
                break;
              case "game-editor-update-property":
                if (!_extBridge && d.uuid && d.property !== undefined) _updateProperty(d.uuid, d.property, d.value);
                break;
              case "game-editor-delete-object":
                if (!_extBridge && d.uuid) {
                  const toDelete = _findByUuid(scene, d.uuid);
                  if (toDelete) {
                    if (_selectedObj && _selectedObj.uuid === d.uuid) _deselectObject();
                    scene.remove(toDelete);
                    _sendSceneTree();
                  }
                }
                break;
              case "game-editor-request-tree":
                if (!_extBridge) _sendSceneTree();
                break;
              case "game-editor-get-animations":
                if (d.uuid) {
                  const animObj = _findByUuid(scene, d.uuid);
                  if (animObj?.userData?.__clipNames) {
                    window.parent.postMessage({
                      type: "game-editor-animation-clips",
                      uuid: d.uuid,
                      clips: animObj.userData.__clipNames,
                      currentClip: animObj.userData.__currentClip?.() || null,
                      animMap: animObj.userData.__animMap || null,
                      clipDurations: animObj.userData.__clipDurations || {},
                    }, "*");
                  }
                }
                break;
              case "game-editor-play-animation":
                if (d.uuid && d.clipName) {
                  const animTarget = _findByUuid(scene, d.uuid);
                  if (animTarget?.userData?.__play) {
                    animTarget.userData.__play(d.clipName);
                    // Start streaming progress back to parent
                    if (__animProgressInterval) clearInterval(__animProgressInterval);
                    __animProgressInterval = setInterval(() => {
                      if (!animTarget?.userData?.__getTime) { clearInterval(__animProgressInterval); __animProgressInterval = null; return; }
                      const info = animTarget.userData.__getTime();
                      try { window.parent.postMessage({ type: "game-editor-animation-progress", uuid: d.uuid, ...info }, "*"); } catch {}
                    }, 100);
                  }
                }
                break;
              case "game-editor-pause-animation":
                if (d.uuid) {
                  const pauseTarget = _findByUuid(scene, d.uuid);
                  pauseTarget?.userData?.__pause?.();
                }
                break;
              case "game-editor-resume-animation":
                if (d.uuid) {
                  const resumeTarget = _findByUuid(scene, d.uuid);
                  resumeTarget?.userData?.__resume?.();
                }
                break;
              case "game-editor-stop-animation":
                if (d.uuid) {
                  const stopTarget = _findByUuid(scene, d.uuid);
                  stopTarget?.userData?.__stop?.();
                  if (__animProgressInterval) { clearInterval(__animProgressInterval); __animProgressInterval = null; }
                  try { window.parent.postMessage({ type: "game-editor-animation-progress", uuid: d.uuid, time: 0, duration: 0, clipName: null, paused: false }, "*"); } catch {}
                }
                break;
              case "game-editor-seek-animation":
                if (d.uuid && typeof d.time === "number") {
                  const seekTarget = _findByUuid(scene, d.uuid);
                  seekTarget?.userData?.__setTime?.(d.time);
                }
                break;
              case "game-editor-spawn-object":
                if (d.factory && d.position) {
                  // Resolve __MODEL_URL__ placeholders in spawn args
                  const _spawnA = { ...(d.args || {}) };
                  for (const _k of Object.keys(_spawnA)) {
                    const _v = _spawnA[_k];
                    if (typeof _v === "string" && _v.startsWith("__MODEL_URL__")) {
                      const _rest = _v.slice(13);
                      const _sep = _rest.indexOf("__");
                      if (_sep >= 0) {
                        _spawnA[_k] = modelUrl(_rest.slice(0, _sep), _rest.slice(_sep + 2));
                      }
                    }
                  }
                  // Validate no unresolved __MODEL_URL__ placeholders remain
                  let _hasUnresolved = false;
                  for (const _uk of Object.keys(_spawnA)) {
                    if (typeof _spawnA[_uk] === "string" && _spawnA[_uk].startsWith("__MODEL_URL__")) {
                      console.warn("[SPAWN] Failed to resolve model URL:", _spawnA[_uk]);
                      _hasUnresolved = true;
                    }
                  }
                  if (_hasUnresolved) return;
                  const _fns: Record<string, Function> = {
                    createPlatform3D, createCollectible3D, createPlayer3D,
                    createBarrier3D, createDecoration3D, createAnimatedCharacter3D,
                  };
                  const fn = _fns[d.factory] || (window as any)[d.factory];
                  if (fn) {
                    (async () => {
                      try {
                        const result = await fn(scene, d.position.x, d.position.y, d.position.z, _spawnA);
                        if (result?.mesh) {
                          result.mesh.userData.__spawned = true;
                          _sendSceneTree();
                          window.parent.postMessage({
                            type: "game-editor-object-spawned",
                            uuid: result.mesh.uuid,
                            name: result.mesh.name,
                          }, "*");
                          _selectObject(result.mesh);
                        }
                      } catch (spawnErr) {
                        console.warn("[Editor] Spawn failed:", spawnErr);
                      }
                    })();
                  }
                }
                break;
              case "game-editor-get-spawned-objects": {
                // Collect all spawned objects for persistence across restart
                const spawned: any[] = [];
                const textureOverrides: any[] = [];
                scene.traverse((child: any) => {
                  if (child.userData?.__spawned && child.userData?.vibexeFactory) {
                    spawned.push({
                      factory: child.userData.vibexeFactory,
                      args: child.userData.vibexeArgs || {},
                      position: { x: child.position.x, y: child.position.y, z: child.position.z },
                      rotation: { x: child.rotation.x, y: child.rotation.y, z: child.rotation.z },
                      scale: { x: child.scale.x, y: child.scale.y, z: child.scale.z },
                    });
                  }
                  // Collect texture overrides for scene-original (non-spawned) objects
                  if (child.__hasTextureOverride && child.userData?.vibexeArgs?.textureUrl) {
                    textureOverrides.push({
                      name: child.name,
                      textureUrl: child.userData.vibexeArgs.textureUrl,
                      tileX: child.userData.vibexeArgs.textureTileX || 1,
                      tileY: child.userData.vibexeArgs.textureTileY || 1,
                      rotation: child.userData.vibexeArgs.textureRotation || 0,
                      offsetX: child.userData.vibexeArgs.textureOffsetX || 0,
                      offsetY: child.userData.vibexeArgs.textureOffsetY || 0,
                      hasPBR: child.userData.vibexeArgs.hasPBR || false,
                    });
                  }
                });
                window.parent.postMessage({ type: "game-editor-spawned-objects", objects: spawned, textureOverrides }, "*");
                break;
              }
              case "game-editor-cleanup-confirmed":
                // Host has finished collecting spawned objects — safe to release globals
                delete (window as any).__vibexe_scene__;
                delete (window as any).__vibexeFactories;
                break;
              case "game-editor-restore-spawned-objects": {
                // Recreate spawned objects from saved data
                const toRestore = d.objects || [];
                const _fnsRestore: Record<string, Function> = {
                  createPlatform3D, createCollectible3D, createPlayer3D,
                  createBarrier3D, createDecoration3D, createAnimatedCharacter3D,
                };
                (async () => {
                  for (const obj of toRestore) {
                    const fn = _fnsRestore[obj.factory] || (window as any)[obj.factory];
                    if (!fn) continue;
                    try {
                      const pos = obj.args || {};
                      const result = await fn(scene, obj.position.x, obj.position.y, obj.position.z, pos);
                      if (result?.mesh) {
                        result.mesh.userData.__spawned = true;
                        if (obj.rotation) result.mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
                        if (obj.scale) result.mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
                      }
                    } catch (restoreErr) {
                      console.warn("[Editor] Restore failed:", obj.factory, restoreErr);
                    }
                  }
                  _sendSceneTree();
                })();
                break;
              }
              case "game-editor-move-player": {
                // Live-sync: teleport player character to new spawn position (from Game Settings panel)
                if (!scene) break;
                scene.traverse((obj: any) => {
                  if (obj.userData?.__isPlayerCharacter) {
                    if (d.x !== undefined) obj.position.x = Number(d.x);
                    if (d.y !== undefined) obj.position.y = Number(d.y);
                    if (d.z !== undefined) obj.position.z = Number(d.z);
                    // Also teleport physics body if present
                    const body = obj.userData?.__physicsBody;
                    if (body) {
                      if (d.x !== undefined) body.position.x = Number(d.x);
                      if (d.y !== undefined) body.position.y = Number(d.y);
                      if (d.z !== undefined) body.position.z = Number(d.z);
                      body.velocity.set(0, 0, 0);
                      body.angularVelocity.set(0, 0, 0);
                    }
                    // Update selection UI if this is the selected object
                    if (_selectedObj && _selectedObj.uuid === obj.uuid) {
                      if (_boxHelper) _boxHelper.update();
                      _sendSelectedObject(obj);
                    }
                  }
                });
                break;
              }
              case "game-editor-set-spawn-mode":
                // Toggle spawn cursor mode + store factory/args for click-to-spawn
                _spawnMode = !!d.active;
                if (d.active && d.factory) {
                  _spawnFactory = d.factory;
                  _spawnArgs = d.args || {};
                  renderer.domElement.style.cursor = "crosshair";
                } else {
                  _spawnFactory = null;
                  _spawnArgs = {};
                  renderer.domElement.style.cursor = "";
                }
                break;
              case "game-editor-apply-texture": {
                // Apply texture to object by uuid
                console.log("[TEXTURE] Handler reached. uuid:", d.uuid, "url:", d.textureUrl, "hasPBR:", d.hasPBR);
                let _texTarget: any = null;
                scene.traverse((c: any) => { if (c.uuid === d.uuid) _texTarget = c; });
                console.log("[TEXTURE] Found target:", !!_texTarget, _texTarget?.name);
                if (_texTarget) {
                  _applyTextureToMesh(_texTarget, d.textureUrl, d.tileX || 1, d.tileY || 1, 0, 0, 0, d.hasPBR);
                  if (!_texTarget.userData.__spawned) _texTarget.__hasTextureOverride = true;
                  console.log("[TEXTURE] Applied. Sending selected object back.");
                  _sendSelectedObject(_texTarget);
                }
                break;
              }
              case "game-editor-remove-texture": {
                let _rtTarget: any = null;
                scene.traverse((c: any) => { if (c.uuid === d.uuid) _rtTarget = c; });
                if (_rtTarget) {
                  _removeTextureFromMesh(_rtTarget);
                  _sendSelectedObject(_rtTarget);
                }
                break;
              }
              case "game-editor-update-tiling": {
                let _utTarget: any = null;
                scene.traverse((c: any) => { if (c.uuid === d.uuid) _utTarget = c; });
                if (_utTarget && _utTarget.userData?.vibexeArgs?.textureUrl) {
                  const _utArgs = _utTarget.userData.vibexeArgs;
                  _applyTextureToMesh(_utTarget, _utArgs.textureUrl, d.tileX || 1, d.tileY || 1, _utArgs.textureRotation || 0, _utArgs.textureOffsetX || 0, _utArgs.textureOffsetY || 0, _utArgs.hasPBR);
                  _sendSelectedObject(_utTarget);
                }
                break;
              }
              case "game-editor-update-texture-params": {
                let _tpTarget: any = null;
                scene.traverse((c: any) => { if (c.uuid === d.uuid) _tpTarget = c; });
                if (_tpTarget && _tpTarget.userData?.vibexeArgs?.textureUrl) {
                  _applyTextureToMesh(_tpTarget, _tpTarget.userData.vibexeArgs.textureUrl, d.tileX || 1, d.tileY || 1, d.rotation || 0, d.offsetX || 0, d.offsetY || 0, _tpTarget.userData.vibexeArgs.hasPBR);
                  if (!_tpTarget.userData.__spawned) _tpTarget.__hasTextureOverride = true;
                  _sendSelectedObject(_tpTarget);
                }
                break;
              }
              case "game-editor-collect-all-transforms": {
                // Collect transforms of ONLY factory-created game objects for batch save
                if (!scene) break;
                const _allTf: Record<string, any> = {};
                const _nameCounts: Record<string, number> = {};
                const _fPrefixes = ["Platform_", "Collectible_", "Barrier_", "Decoration_", "Player_", "Character_", "UnnamedGroup_", "Object_"];
                scene.traverse((child: any) => {
                  // Auto-name unnamed objects
                  if (!child.name) {
                    if (child.userData?.vibexeFactory) {
                      child.name = (child.userData.vibexeFactory === "animatedCharacter" ? "Character_" : "Object_") + child.uuid.slice(0, 8);
                    } else if (child.type === "Group" && child.children?.length > 0 && child.parent === scene) {
                      let _ugC = 0;
                      for (let _ii = 0; _ii < scene.children.length; _ii++) {
                        const _cc = scene.children[_ii];
                        if (_cc === child) break;
                        if (!_cc.name && _cc.type === "Group" && _cc.children?.length > 0) _ugC++;
                      }
                      child.name = "UnnamedGroup_" + _ugC;
                    }
                  }
                  if (!child.name) return;
                  if (child.name.indexOf("__editor_") === 0) return;
                  if (child.type === "GridHelper") return;
                  // Skip ground planes
                  if (child.isMesh && !child.name && child.geometry?.type === "PlaneGeometry") {
                    const gp = child.geometry.parameters;
                    if (gp && (gp.width >= 50 || gp.height >= 50)) return;
                  }
                  if (child.isLight || child.isCamera || child.type === "BoxHelper") return;
                  // WHITELIST: Only factory-created name prefixes
                  let _isF = false;
                  for (let pi = 0; pi < _fPrefixes.length; pi++) {
                    if (child.name.indexOf(_fPrefixes[pi]) === 0) { _isF = true; break; }
                  }
                  if (!_isF) return;
                  // Stable index-based dedup: Name, Name#1, Name#2
                  if (!_nameCounts[child.name]) _nameCounts[child.name] = 0;
                  const _idx = _nameCounts[child.name]++;
                  const saveName = _idx === 0 ? child.name : child.name + "#" + _idx;
                  const _tf: any = {
                    position: { x: +child.position.x.toFixed(3), y: +child.position.y.toFixed(3), z: +child.position.z.toFixed(3) },
                    rotation: { x: +(child.rotation.x * 180 / Math.PI).toFixed(1), y: +(child.rotation.y * 180 / Math.PI).toFixed(1), z: +(child.rotation.z * 180 / Math.PI).toFixed(1) },
                    scale: { x: +child.scale.x.toFixed(3), y: +child.scale.y.toFixed(3), z: +child.scale.z.toFixed(3) },
                  };
                  // Include texture data if present
                  const _texUrl = child.userData?.vibexeArgs?.textureUrl;
                  if (_texUrl) {
                    _tf._textureUrl = _texUrl;
                    _tf._textureTileX = child.userData.vibexeArgs.textureTileX || 1;
                    _tf._textureTileY = child.userData.vibexeArgs.textureTileY || 1;
                    _tf._hasPBR = !!child.userData.vibexeArgs.hasPBR;
                  }
                  _allTf[saveName] = _tf;
                });
                console.log("[EmbeddedBridge] Collected transforms:", Object.keys(_allTf).length, "objects");
                window.parent.postMessage({ type: "game-editor-all-transforms", transforms: _allTf }, "*");
                break;
              }
              case "updateGameSettings": {
                const s = d.settings;
                if (!s) break;
                // --- Physics ---
                if (s.physics) {
                  if (s.physics.gravity !== undefined) { GRAVITY_3D = s.physics.gravity; (window as any).GRAVITY_3D = GRAVITY_3D; }
                  if (s.physics.fallGravity !== undefined) { FALL_GRAVITY = s.physics.fallGravity; (window as any).FALL_GRAVITY = FALL_GRAVITY; }
                  if (s.physics.jumpForce !== undefined) { JUMP_FORCE = s.physics.jumpForce; (window as any).JUMP_FORCE = JUMP_FORCE; }
                  if (s.physics.moveSpeed !== undefined) { MOVE_SPEED = s.physics.moveSpeed; (window as any).MOVE_SPEED = MOVE_SPEED; }
                  if (s.physics.runSpeed !== undefined) { RUN_SPEED = s.physics.runSpeed; (window as any).RUN_SPEED = RUN_SPEED; }
                  if (s.physics.friction !== undefined) { FRICTION = s.physics.friction; (window as any).FRICTION = FRICTION; }
                  if (s.physics.coyoteTime !== undefined) { COYOTE_TIME = s.physics.coyoteTime; (window as any).COYOTE_TIME = COYOTE_TIME; }
                  if (world && s.physics.gravity !== undefined) {
                    world.gravity.set(0, s.physics.gravity, 0);
                  }
                }
                // --- Camera ---
                if (s.camera) {
                  if (s.camera.fov !== undefined && camera) { camera.fov = s.camera.fov; camera.updateProjectionMatrix(); }
                  if (s.camera.offsetY !== undefined) { CAMERA_OFFSET_Y = s.camera.offsetY; CAMERA_HEIGHT = s.camera.offsetY; (window as any).CAMERA_OFFSET_Y = s.camera.offsetY; }
                  if (s.camera.offsetZ !== undefined) { CAMERA_OFFSET_Z = s.camera.offsetZ; CAMERA_DISTANCE = s.camera.offsetZ; (window as any).CAMERA_OFFSET_Z = s.camera.offsetZ; }
                  if (s.camera.lerp !== undefined) { CAMERA_LERP = s.camera.lerp; (window as any).CAMERA_LERP = s.camera.lerp; }
                  if (s.camera.lookY !== undefined) { CAMERA_LOOK_Y = s.camera.lookY; (window as any).CAMERA_LOOK_Y = s.camera.lookY; }
                  if (s.camera.lookAhead !== undefined) { CAMERA_LOOK_AHEAD = s.camera.lookAhead; (window as any).CAMERA_LOOK_AHEAD = s.camera.lookAhead; }
                }
                // --- Environment ---
                if (s.environment && scene) {
                  if (s.environment.backgroundColor !== undefined) scene.background = new THREE.Color(s.environment.backgroundColor);
                  const _al = scene.getObjectByName('__default_ambient__');
                  if (_al && s.environment.ambientLightIntensity !== undefined) (_al as any).intensity = s.environment.ambientLightIntensity;
                  if (_al && s.environment.ambientLightColor) (_al as any).color = new THREE.Color(s.environment.ambientLightColor);
                  const _sl = scene.getObjectByName('__default_sun__');
                  if (_sl && s.environment.sunLightIntensity !== undefined) (_sl as any).intensity = s.environment.sunLightIntensity;
                  if (_sl && s.environment.sunLightColor) (_sl as any).color = new THREE.Color(s.environment.sunLightColor);
                  const _hl = scene.getObjectByName('__default_hemi__');
                  if (_hl && s.environment.hemisphereIntensity !== undefined) (_hl as any).intensity = s.environment.hemisphereIntensity;
                  if (_hl && s.environment.hemisphereSkyColor) (_hl as any).color = new THREE.Color(s.environment.hemisphereSkyColor);
                  if (_hl && s.environment.hemisphereGroundColor) (_hl as any).groundColor = new THREE.Color(s.environment.hemisphereGroundColor);
                  if (s.environment.fogEnabled !== undefined) {
                    if (s.environment.fogEnabled) {
                      const _fogColor = s.environment.fogColor || s.environment.backgroundColor || '#87CEEB';
                      scene.fog = new THREE.Fog(_fogColor, s.environment.fogNear ?? 30, s.environment.fogFar ?? 100);
                    } else {
                      scene.fog = null;
                    }
                  } else if (scene.fog) {
                    if (s.environment.fogNear !== undefined) scene.fog.near = s.environment.fogNear;
                    if (s.environment.fogFar !== undefined) scene.fog.far = s.environment.fogFar;
                    if (s.environment.fogColor) scene.fog.color = new THREE.Color(s.environment.fogColor);
                  }
                  // Shadow quality
                  if (s.environment.shadowQuality) {
                    const _sl2 = scene.getObjectByName('__default_sun__');
                    if (_sl2) {
                      const _shSizes: Record<string, number> = { low: 512, medium: 1024, high: 2048 };
                      const _shSz = _shSizes[s.environment.shadowQuality] || 1024;
                      (_sl2 as any).shadow.mapSize.width = _shSz;
                      (_sl2 as any).shadow.mapSize.height = _shSz;
                      if ((_sl2 as any).shadow.map) {
                        (_sl2 as any).shadow.map.dispose();
                        (_sl2 as any).shadow.map = null;
                      }
                    }
                  }
                }
                // --- Audio ---
                if (s.audio && _masterGain) {
                  const enabled = s.audio.enabled !== false;
                  _masterGain.gain.value = enabled ? (s.audio.masterVolume ?? 0.8) : 0;
                  if (_musicGain && s.audio.musicVolume !== undefined) _musicGain.gain.value = s.audio.musicVolume;
                  if (_sfxGain && s.audio.sfxVolume !== undefined) _sfxGain.gain.value = s.audio.sfxVolume;
                  // Also update HTMLAudioElement volume directly (music bypasses Web Audio graph)
                  if (s.audio.musicVolume !== undefined && _currentMusic) {
                    _currentMusic.el.volume = s.audio.musicVolume;
                  }
                  if (!enabled && _currentMusic) {
                    _currentMusic.el.volume = 0;
                  }
                }
                // --- Post-Processing ---
                if (s.postProcessing) {
                  const _comp = (window as any).__vibexe_composer__;
                  if (_comp && _comp.passes) {
                    // Update bloom pass parameters if it exists
                    for (const _pass of _comp.passes) {
                      if (_pass.strength !== undefined) {
                        // This is a bloom pass (UnrealBloomPass)
                        if (s.postProcessing.bloomIntensity !== undefined) _pass.strength = s.postProcessing.bloomIntensity;
                        if (s.postProcessing.bloomThreshold !== undefined) _pass.threshold = s.postProcessing.bloomThreshold;
                      }
                    }
                  }
                  // If preset changed and no composer exists, create it
                  if (!_comp && s.postProcessing.preset && s.postProcessing.preset !== 'none' && renderer && scene && camera) {
                    const _pp = createPostProcessing(renderer, scene, camera, s.postProcessing.preset);
                    if (_pp && s.postProcessing.bloomIntensity != null) {
                      _pp.addBloom({
                        strength: s.postProcessing.bloomIntensity ?? 0.5,
                        radius: 0.4,
                        threshold: s.postProcessing.bloomThreshold ?? 0.85,
                      });
                    }
                  }
                }
                // --- Performance ---
                if (s.performance && renderer) {
                  if (s.performance.pixelRatio !== undefined) {
                    renderer.setPixelRatio(Math.min(s.performance.pixelRatio, 2));
                  }
                  if (s.performance.showFPS !== undefined) {
                    let _fpsDiv = document.getElementById('__vibexe_fps__');
                    if (s.performance.showFPS) {
                      if (!_fpsDiv) {
                        _fpsDiv = document.createElement('div');
                        _fpsDiv.id = '__vibexe_fps__';
                        _fpsDiv.style.cssText = 'position:fixed;top:4px;left:4px;background:rgba(0,0,0,0.7);color:#0f0;font:12px monospace;padding:2px 6px;z-index:99999;pointer-events:none';
                        document.body.appendChild(_fpsDiv);
                        let _frames = 0, _lastFps = performance.now();
                        const _fpsLoop = () => { _frames++; const now = performance.now(); if (now - _lastFps >= 1000) { const _el = document.getElementById('__vibexe_fps__'); if (_el) _el.textContent = _frames + ' FPS'; _frames = 0; _lastFps = now; } if (document.getElementById('__vibexe_fps__')) requestAnimationFrame(_fpsLoop); };
                        requestAnimationFrame(_fpsLoop);
                      }
                    } else if (_fpsDiv) {
                      _fpsDiv.remove();
                    }
                  }
                }
                break;
              }
            }
          });

          // Notify parent that embedded bridge is ready (external bridge sends its own notification)
          if (!(window as any).__vibexeExternalBridge) {
            try { window.parent.postMessage({ type: "game-editor-bridge-loaded" }, "*"); } catch {}
          }
        }
        // ===== End Scene Editor Bridge =====

        clock.start();
        const animate = () => {
          if (disposed) return;
          animFrameId = requestAnimationFrame(animate);

          // In editor mode, skip game logic — only render + tick animation mixers for preview
          if (__editorMode) {
            if (__editorOrbitControls) __editorOrbitControls.update();
            const __now = performance.now();
            const __ed = __editorLastTime ? (__now - __editorLastTime) / 1000 : 0;
            __editorLastTime = __now;
            // Tick animation mixers so animations preview in editor
            (window as any)._updateAllMixers3D?.(__ed);
            const __ec2 = (window as any).__vibexe_composer__;
            if (__ec2) { __ec2.render(__ed); } else { renderer.render(scene, camera); }
            return;
          }

          const delta = clock.getDelta();
          // Auto-update all animation mixers (from createAnimatedCharacter3D)
          (window as any)._updateAllMixers3D?.(delta);
          try { gameScene.update(delta); } catch (_e) { /* AI code error — keep rendering */ }
          // Auto-update character controllers AFTER gameScene.update() — this reads
          // the velocity/position set by AI code and auto-switches idle/walk/run/jump.
          // Works as safety net even if AI doesn't call controller.update() itself.
          (window as any)._updateAllControllers3D?.(delta);
          // Auto-update particles, triggers, springs
          (window as any)._updateAllParticles3D?.(delta);
          (window as any)._updateAllTriggers3D?.();
          (window as any)._updateAllSprings3D?.();
          // Update spatial audio: attached sounds follow meshes
          (window as any)._updateAllSpatial3D?.();
          // Update spatial audio listener position + orientation from camera
          try {
            const __ac = (window as any)._audioCtx;
            if (__ac && __ac.listener && camera) {
              if (__ac.listener.positionX) {
                __ac.listener.positionX.value = camera.position.x;
                __ac.listener.positionY.value = camera.position.y;
                __ac.listener.positionZ.value = camera.position.z;
              } else if (__ac.listener.setPosition) {
                __ac.listener.setPosition(camera.position.x, camera.position.y, camera.position.z);
              }
              // Listener orientation from camera quaternion (fixes panning on camera rotate)
              const __fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
              const __up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
              if (__ac.listener.forwardX) {
                __ac.listener.forwardX.value = __fwd.x;
                __ac.listener.forwardY.value = __fwd.y;
                __ac.listener.forwardZ.value = __fwd.z;
                __ac.listener.upX.value = __up.x;
                __ac.listener.upY.value = __up.y;
                __ac.listener.upZ.value = __up.z;
              } else if (__ac.listener.setOrientation) {
                __ac.listener.setOrientation(__fwd.x, __fwd.y, __fwd.z, __up.x, __up.y, __up.z);
              }
            }
          } catch {}
          // Render via post-processing composer if available, else standard render
          const __composer = (window as any).__vibexe_composer__;
          if (__composer) { __composer.render(delta); }
          else { renderer.render(scene, camera); }
        };
        animate();
      }

      initAndRun();
    })();

    return () => {
      disposed = true;
      disposeScene();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisChange);
      // Clean up window references so idempotent helpers create fresh on next mount
      delete (window as any).__vibexe_renderer__;
      delete (window as any).__vibexe_scene__;
      delete (window as any).__vibexe_camera__;
      delete (window as any).__vibexe_world__;
      delete (window as any).__vibexe_editor__;
      delete (window as any).__vibexeFactories;
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        touchAction: "none",
      }}
    />
  );
}
`,
	},

	// ---------- Template 5: GameOver 3D overlay (HTML-based) ----------
	{
		path: "src/scenes/GameOverScene3D.ts",
		language: "typescript",
		content: `/**
 * Game Over overlay — pure HTML/CSS over the 3D canvas.
 * Shows score, high score, and restart button.
 */

export function showGameOver(
  container: HTMLDivElement,
  score: number,
  onRestart: () => void,
): { destroy: () => void } {
  const overlay = document.createElement("div");
  overlay.style.cssText = \`
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.75); display: flex; flex-direction: column;
    align-items: center; justify-content: center; z-index: 100;
    font-family: sans-serif; color: white;
  \`;

  // High score
  const hsKey = "vibexe-3d-highscore";
  const prev = parseInt(localStorage.getItem(hsKey) || "0", 10);
  const best = Math.max(score, prev);
  localStorage.setItem(hsKey, String(best));
  const isNew = score > prev && score > 0;

  overlay.innerHTML = \`
    <div style="font-size:48px;font-weight:bold;color:#ff4444;margin-bottom:16px;">GAME OVER</div>
    <div style="font-size:32px;margin-bottom:8px;">Score: \${score}</div>
    <div style="font-size:20px;color:\${isNew ? '#ffdd44' : '#aaaaaa'};margin-bottom:32px;">
      \${isNew ? 'NEW BEST!' : 'Best: ' + best}
    </div>
    <button id="restart-btn" style="
      padding: 16px 48px; font-size: 24px; font-weight: bold;
      background: #00ff88; color: #000; border: none; border-radius: 12px;
      cursor: pointer; transition: transform 0.1s;
    ">PLAY AGAIN</button>
  \`;

  container.appendChild(overlay);

  const btn = overlay.querySelector("#restart-btn") as HTMLButtonElement;
  btn.addEventListener("mouseenter", () => { btn.style.transform = "scale(1.05)"; });
  btn.addEventListener("mouseleave", () => { btn.style.transform = "scale(1)"; });

  // Delay restart to prevent accidental click
  setTimeout(() => {
    btn.addEventListener("click", onRestart);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) onRestart();
    });
  }, 400);

  return {
    destroy: () => { overlay.remove(); },
  };
}
`,
	},

	// ---------- Template 6: App.tsx entry point ----------
	{
		path: "src/App.tsx",
		language: "typescript",
		content: `import Game3D from "./components/Game3D";
import GameSceneDefault, * as GameSceneModule from "./scenes/GameScene3D";

// Resolve GameScene from ANY export pattern the AI might use:
// export const GameScene = {...}, export class GameScene3D, export default {...}, etc.
function resolveGameScene() {
  const m = GameSceneModule as any;
  // Try common names first
  const byName = m.GameScene || m.GameScene3D || m.gameScene;
  if (byName) return byName;
  if (GameSceneDefault) return GameSceneDefault;
  // Fallback: scan all exports for anything with init()
  for (const key of Object.keys(m)) {
    const v = m[key];
    if (!v || key === "__esModule") continue;
    if (typeof v === "object" && typeof v.init === "function") return v;
    if (typeof v === "function" && v.prototype && typeof v.prototype.init === "function") return v;
  }
  return null;
}

const GameScene = resolveGameScene();

export default function App() {
  return <Game3D gameScene={GameScene} />;
}
`,
	},

	// ---------- Template 7: Sandbox config — disable infinite loop protection ----------
	{
		path: "sandbox.config.json",
		language: "json",
		content: `{
  "infiniteLoopProtection": false,
  "hardReloadOnChange": false,
  "view": "browser"
}
`,
	},

	// ---------- Template 8: Re-export shim for constants-3d → constants ----------
	// AI consistently creates "constants-3d.ts" which gets path-rewritten to "constants.ts".
	// But AI's GameScene3D.ts imports from "../config/constants-3d" — this shim bridges the gap.
	{
		path: "src/config/constants-3d.ts",
		language: "typescript",
		content: `// Re-export shim: AI imports from "constants-3d" but the canonical file is "constants.ts"
export * from "./constants";
`,
	},
];

/**
 * GameScene3D.ts STARTER TEMPLATE — Pre-created for new 3D game projects.
 *
 * This starter uses ALL 5 factory helpers so the AI sees the pattern and
 * continues it when customizing the game. The AI uses `update_file` to
 * replace the content while keeping the factory helper import pattern.
 *
 * NOT included in GAME_3D_TEMPLATE_FILES to avoid protectedPaths blocking.
 * Injected separately in route.ts.
 */
export const GAME_3D_SCENE_STARTER = `/**
 * 3D Platformer Scene — Platformer Project Kit
 *
 * Uses Lily (animated character) as player with createAnimatedCharacter3D.
 * ALL objects use factory helpers — they load Platformer Project GLB models.
 * Professional mechanics: asymmetric gravity, coyote time, variable jump.
 */
import {
  createPlatform3D, createCollectible3D,
  createBarrier3D, createDecoration3D, createAnimatedCharacter3D,
  createCharacterController3D, createText3D,
  createPhysicsBody, syncBodiesToMeshes, createKeyboardState,
  createGround3D, createSkyGradient, createHUD,
  playSound, soundUrl, preloadSounds,
  hapticFeedback, tryLockLandscape,
  CAMERA_OFFSET_Y, CAMERA_OFFSET_Z, CAMERA_LERP, CAMERA_LOOK_Y,
  COLLECT_DISTANCE, JUMP_FORCE, COYOTE_TIME, JUMP_BUFFER,
  FALL_GRAVITY, GRAVITY_3D, MOVE_SPEED,
  loadGLTF, SCALES_3D,
} from "../config/assets-3d";
import { modelUrl } from "../utils/media-stock-3d";

const THREE = (window as any).THREE;
const CANNON = (window as any).CANNON;

// ===== Game State =====
let scene: any, camera: any, renderer: any;
let lily: any, lilyController: any, playerBody: any, world: any;
let hud: any, keys: any, destroyKb: () => void;
const platforms: { mesh: any; body: any }[] = [];
const items: { mesh: any; collected: boolean }[] = [];
let score = 0;
let coyoteTimer = 0;  // Time since last grounded
let jumpBufferTimer = 0; // Time since jump was pressed

export const GameScene = {
  world: null as any,

  async init(_scene: any, _camera: any, _renderer: any, container: HTMLDivElement, onProgress?: (p: number) => void) {
    scene = _scene; camera = _camera; renderer = _renderer;
    world = this.world;
    score = 0;
    coyoteTimer = 0;
    jumpBufferTimer = 0;
    platforms.length = 0;
    items.length = 0;

    // Sky gradient + ground plane
    createSkyGradient(scene, 0x87CEEB, 0xE0F0FF);
    createGround3D(scene, 100, 0x88BB66);
    onProgress?.(0.1);

    // Preload audio
    await preloadSounds([
      soundUrl("platformer-project/sfx/jump_0.wav"),
      soundUrl("platformer-project/sfx/coin01.wav"),
    ]);

    // ===== PLATFORMS — Platformer Project GLB models =====
    const platPositions: [number, number, number][] = [
      [0, 0.5, 0], [5, 1, -6], [-4, 1.5, -12], [3, 2, -18], [-2, 2.5, -24],
      [6, 3, -30], [0, 3.5, -36],
    ];
    const platTypes = ["grid", "long", "grid", "bouncing", "grid", "long", "grid"];
    for (let i = 0; i < platPositions.length; i++) {
      const [x, y, z] = platPositions[i];
      const { mesh, size } = await createPlatform3D(scene, x, y, z, {
        type: platTypes[i % platTypes.length],
      });
      const body = createPhysicsBody("box", 0, { x, y, z }, size);
      if (world && body) world.addBody(body);
      if (mesh && body) mesh.userData.__physicsBody = body;
      platforms.push({ mesh, body });
    }
    onProgress?.(0.3);

    // ===== PLAYER — Lily animated character =====
    const __gs = (window as any).__VIBEXE_GAME_SETTINGS__ || {};
    const spawnX = __gs.player?.spawnX ?? 0;
    const spawnY = __gs.player?.spawnY ?? 3;
    const spawnZ = __gs.player?.spawnZ ?? 0;
    const respawnX = __gs.player?.respawnX ?? 0;
    const respawnY = __gs.player?.respawnY ?? 5;
    const respawnZ = __gs.player?.respawnZ ?? 0;
    const lilyResult = await createAnimatedCharacter3D(scene, spawnX, spawnY, spawnZ, {
      url: modelUrl("platformer-project", "characters/Lily.glb"),
    });
    lily = lilyResult;
    playerBody = createPhysicsBody("box", 5, { x: spawnX, y: spawnY, z: spawnZ }, lily.size);
    if (playerBody) {
      playerBody.linearDamping = 0.9;
      playerBody.angularDamping = 1.0;
      playerBody.fixedRotation = true;
    }
    if (world && playerBody) world.addBody(playerBody);
    if (lily.mesh && playerBody) lily.mesh.userData.__physicsBody = playerBody;
    lilyController = createCharacterController3D(lilyResult, playerBody);
    onProgress?.(0.5);

    // ===== COLLECTIBLES — coins, stars, hearts =====
    const itemTypes = ["coin", "star", "heart"] as const;
    for (let i = 0; i < platPositions.length - 2; i++) {
      const [x, , z] = platPositions[i + 1];
      const { mesh } = await createCollectible3D(scene, x, 3 + i * 0.5, z, {
        type: itemTypes[i % 3],
      });
      items.push({ mesh, collected: false });
    }
    onProgress?.(0.7);

    // ===== HAZARDS — spikes =====
    await createBarrier3D(scene, 2, 1, -9, { type: "spikes" });
    await createBarrier3D(scene, -3, 2, -21, { type: "spikes_panel" });
    onProgress?.(0.8);

    // ===== DECORATIONS — signs, garden =====
    await createDecoration3D(scene, -8, 0, -5, { type: "sign" });
    await createDecoration3D(scene, 10, 0, -20, { type: "garden" });
    onProgress?.(0.9);

    // HUD + keyboard
    hud = createHUD(container);
    hud.update({ score: 0 });
    const kb = createKeyboardState();
    keys = kb.keys;
    destroyKb = kb.destroy;

    // Jump detection
    playerBody.addEventListener("collide", (e: any) => {
      if (e.contact.ni.y > 0.5) {
        (playerBody as any).__canJump = true;
        coyoteTimer = 0;
      }
    });
    onProgress?.(1);
  },

  update(delta: number) {
    if (!lily || !world) return;

    // Asymmetric gravity: lighter going up, heavier falling
    const vy = playerBody.velocity.y;
    world.gravity.set(0, vy > 0 ? GRAVITY_3D : FALL_GRAVITY, 0);
    world.step(1 / 60, delta, 3);

    // Coyote time + jump buffer
    if ((playerBody as any).__canJump) {
      coyoteTimer = 0;
    } else {
      coyoteTimer += delta;
    }
    if (jumpBufferTimer > 0) jumpBufferTimer -= delta;

    // Player movement — VELOCITY-BASED
    const vx = ((keys.ArrowRight || keys.KeyD) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyA) ? 1 : 0);
    const vz = ((keys.ArrowDown || keys.KeyS) ? 1 : 0) - ((keys.ArrowUp || keys.KeyW) ? 1 : 0);
    if (vx !== 0 || vz !== 0) {
      const len = Math.sqrt(vx * vx + vz * vz);
      playerBody.velocity.x = (vx / len) * MOVE_SPEED;
      playerBody.velocity.z = (vz / len) * MOVE_SPEED;
    }

    // Jump with coyote time + jump buffer
    if (keys.Space) {
      jumpBufferTimer = JUMP_BUFFER;
    }
    const canJump = (playerBody as any).__canJump || coyoteTimer < COYOTE_TIME;
    if (jumpBufferTimer > 0 && canJump) {
      playerBody.velocity.y = JUMP_FORCE;
      (playerBody as any).__canJump = false;
      coyoteTimer = COYOTE_TIME; // Consume coyote time
      jumpBufferTimer = 0;
      playSound(soundUrl("platformer-project/sfx/jump_0.wav"), { volume: 0.6 });
      hapticFeedback("light");
    }

    // Sync physics → meshes
    // Offset mesh Y by half-height so feet (at mesh origin via pivot correction)
    // align with the bottom of the physics box (ground contact point).
    lily.mesh.position.copy(playerBody.position);
    lily.mesh.position.y -= lily.size.y;
    syncBodiesToMeshes(platforms);

    // Camera follow
    camera.position.x += (lily.mesh.position.x - camera.position.x) * CAMERA_LERP * delta;
    camera.position.y += (lily.mesh.position.y + CAMERA_OFFSET_Y - camera.position.y) * CAMERA_LERP * delta;
    camera.position.z += (lily.mesh.position.z + CAMERA_OFFSET_Z - camera.position.z) * CAMERA_LERP * delta;
    camera.lookAt(lily.mesh.position.x, lily.mesh.position.y + CAMERA_LOOK_Y, lily.mesh.position.z);

    // Collect items
    for (const c of items) {
      if (!c.collected && lily.mesh.position.distanceTo(c.mesh.position) < COLLECT_DISTANCE) {
        c.collected = true;
        c.mesh.visible = false;
        score++;
        hud.update({ score });
        playSound(soundUrl("platformer-project/sfx/coin01.wav"), { volume: 0.7 });
        hapticFeedback("light");
      }
      if (!c.collected) c.mesh.rotation.y += delta * 2;
    }

    // Fall off world = reset to respawn point
    if (lily.mesh.position.y < -10) {
      playerBody.position.set(respawnX, respawnY, respawnZ);
      playerBody.velocity.set(0, 0, 0);
      hapticFeedback("heavy");
    }
  },

  cleanup() {
    destroyKb?.();
  },
};
`;

/**
 * Character-aware variant of GAME_3D_SCENE_STARTER.
 * Now uses Lily by default (same as main starter since Platformer Project).
 * This variant is used when warrior/knight/fighter/character keywords are detected.
 * Identical to GAME_3D_SCENE_STARTER since Lily is the default player.
 */
export const GAME_3D_SCENE_STARTER_CHARACTER = GAME_3D_SCENE_STARTER;

// =============================================================================
// 3D ENDLESS RUNNER SCENE STARTER
// Temple Run / Subway Surfers style — auto-forward, 3-lane, segment recycling
// =============================================================================
export const GAME_3D_SCENE_STARTER_RUNNER = `/**
 * 3D Endless Runner — Auto-forward, 3-lane dodging, segment recycling
 *
 * ALL game objects MUST use factory helpers from assets-3d.ts.
 * Do NOT use raw THREE.BoxGeometry or THREE.SphereGeometry for visible objects.
 */
import {
  createPlatform3D, createCollectible3D,
  createBarrier3D, createDecoration3D, createAnimatedCharacter3D,
  createCharacterController3D, createText3D,
  createPhysicsBody, syncBodiesToMeshes, createKeyboardState,
  createGround3D, createSkyGradient, createHUD,
  createSwipeDetector, playSound, playMusic, soundUrl,
  createParticleEmitter,
  COLLECT_DISTANCE, JUMP_FORCE, loadGLTF, SCALES_3D,
} from "../config/assets-3d";
import { modelUrl } from "../utils/media-stock-3d";

const THREE = (window as any).THREE;
const CANNON = (window as any).CANNON;

// ===== Runner Constants (overridable via game settings) =====
const __gsR = (window as any).__VIBEXE_GAME_SETTINGS__ || {};
const LANE_X = [-3, 0, 3];          // 3 lane positions
const LANE_SWITCH_SPEED = 0.15;     // Tween lerp factor per frame
const INITIAL_SPEED = __gsR.runner?.initialSpeed ?? 8;
const MAX_SPEED = __gsR.runner?.maxSpeed ?? 25;
const SPEED_RAMP = 0.15;            // Speed increase per second
const SEGMENT_LENGTH = 12;          // Z length of each platform segment
const SEGMENT_COUNT = 8;            // Segments visible ahead
const SPAWN_Z_AHEAD = SEGMENT_COUNT * SEGMENT_LENGTH;
const RECYCLE_Z_BEHIND = 20;        // Recycle when this far behind camera
const BARRIER_CHANCE = 0.35;        // Chance per segment per lane
const COLLECTIBLE_CHANCE = 0.4;     // Chance per segment per lane
const MAX_LIVES = __gsR.runner?.maxLives ?? __gsR.player?.startingLives ?? 3;
const INVULN_TIME = 1.5;            // Seconds of invulnerability after hit
const JUMP_VELOCITY = __gsR.runner?.jumpVelocity ?? 10;

// ===== Game State =====
let scene: any, camera: any, renderer: any;
let player: any, playerBody: any, world: any;
let controller: any;
let hud: any, keys: any, destroyKb: () => void;
let destroySwipe: () => void;

let currentLane = 1;       // 0=left, 1=center, 2=right
let targetX = 0;           // Target X for lane tween
let speed = INITIAL_SPEED;
let distance = 0;
let score = 0;
let lives = MAX_LIVES;
let invulnTimer = 0;
let gameOver = false;
let gameStarted = false;

// Segment pool
interface Segment {
  platforms: { mesh: any; body: any }[];
  barriers: { mesh: any; body: any; lane: number }[];
  collectibles: { mesh: any; collected: boolean; lane: number }[];
  decorations: any[];
  z: number;
}
const segments: Segment[] = [];
let nextSegmentZ = 0;

export const GameScene = {
  world: null as any,

  async init(s: any, c: any, r: any) {
    scene = s; camera = c; renderer = r;
    world = this.world;

    // Sky
    createSkyGradient(scene, "#87CEEB", "#E0F7FF");

    // Ground (visual only — physics segments handle collision)
    const groundGeo = new THREE.PlaneGeometry(20, 2000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a7d44, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -900);
    ground.receiveShadow = true;
    scene.add(ground);

    // Lane markers (subtle lines)
    for (const lx of [-1.5, 1.5]) {
      const lineGeo = new THREE.PlaneGeometry(0.05, 2000);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.2, transparent: true });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(lx, 0.01, -900);
      scene.add(line);
    }

    // Animated warrior character
    const characterResult = await createAnimatedCharacter3D(scene, 0, 0.5, 0, {
      url: modelUrl("kaykit-skeletons", "Skeleton_Warrior.glb"),
      targetHeight: 1.8,
    });
    player = characterResult.mesh;
    // Scale up character for runner visibility (camera is far back at z+10)
    player.scale.set(3, 3, 3);

    // Physics body for player
    playerBody = createPhysicsBody("box", 5, { x: 0, y: 1.5, z: 0 }, { x: 0.4, y: 0.8, z: 0.4 });
    if (playerBody) {
      playerBody.fixedRotation = true;
      playerBody.linearDamping = 0.1;
      playerBody.angularDamping = 1;
    }
    if (world && playerBody) world.addBody(playerBody);

    // Ground detection
    playerBody.addEventListener("collide", (e: any) => {
      if (e.contact && e.contact.ni) {
        const ny = e.contact.ni.y;
        if (Math.abs(ny) > 0.5) {
          (playerBody as any).__canJump = true;
        }
      }
    });
    (playerBody as any).__canJump = true;

    // Character controller for animation states
    controller = createCharacterController3D(characterResult, playerBody, {
      walkSpeed: 1,
      runSpeed: 4,
    });

    // Camera setup — behind and above player
    camera.position.set(0, 6, 12);
    camera.lookAt(0, 1, 0);

    // Keyboard
    const kb = createKeyboardState();
    keys = kb.keys;
    destroyKb = kb.destroy;

    // Touch swipe
    const container = renderer.domElement.parentElement || renderer.domElement;
    destroySwipe = createSwipeDetector(container, (dir) => {
      if (gameOver) return;
      if (!gameStarted) { gameStarted = true; }
      if (dir === "left" && currentLane > 0) {
        currentLane--;
        targetX = LANE_X[currentLane];
      } else if (dir === "right" && currentLane < 2) {
        currentLane++;
        targetX = LANE_X[currentLane];
      } else if (dir === "up") {
        tryJump();
      }
    });

    // HUD
    hud = createHUD(container);
    hud.update({ score: 0, lives: MAX_LIVES, custom: "Distance: 0m | Swipe or press arrows to start" });

    // Spawn initial segments
    nextSegmentZ = 0;
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      await spawnSegment(i < 3);
    }

    // Music
    playMusic(soundUrl("theme-adventure"), { loop: true, volume: 0.3, fadeIn: 2 });

    // Force run animation
    characterResult.play("running");
  },

  update(delta: number) {
    if (gameOver) return;
    if (!gameStarted) {
      if (keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.Space ||
          keys.KeyA || keys.KeyD || keys.KeyW) {
        gameStarted = true;
      }
      controller.update(delta);
      return;
    }

    // Physics step
    world.step(1 / 60, delta, 3);

    // Speed ramp
    speed = Math.min(MAX_SPEED, speed + SPEED_RAMP * delta);

    // Auto-forward movement (negative Z = forward)
    playerBody.velocity.z = -speed;

    // Lane switching — keyboard (with cooldown)
    if (keys.ArrowLeft || keys.KeyA) {
      if (currentLane > 0 && !(playerBody as any).__laneSwitching) {
        currentLane--;
        targetX = LANE_X[currentLane];
        (playerBody as any).__laneSwitching = true;
        setTimeout(() => { (playerBody as any).__laneSwitching = false; }, 200);
      }
    }
    if (keys.ArrowRight || keys.KeyD) {
      if (currentLane < 2 && !(playerBody as any).__laneSwitching) {
        currentLane++;
        targetX = LANE_X[currentLane];
        (playerBody as any).__laneSwitching = true;
        setTimeout(() => { (playerBody as any).__laneSwitching = false; }, 200);
      }
    }

    // Jump
    if (keys.ArrowUp || keys.KeyW || keys.Space) {
      tryJump();
    }

    // Tween X position toward target lane
    const currentX = playerBody.position.x;
    const dx = targetX - currentX;
    if (Math.abs(dx) > 0.05) {
      playerBody.position.x += dx * LANE_SWITCH_SPEED * (delta * 60);
      playerBody.velocity.x = 0;
    } else {
      playerBody.position.x = targetX;
      playerBody.velocity.x = 0;
    }

    // Update controller (syncs mesh + animations)
    controller.update(delta);

    // Distance tracking (score is collectible-only, distance shown separately)
    distance += speed * delta;

    // Invulnerability timer
    if (invulnTimer > 0) {
      invulnTimer -= delta;
      player.visible = Math.floor(invulnTimer * 10) % 2 === 0;
    } else {
      player.visible = true;
    }

    // Check barrier collisions
    for (const seg of segments) {
      for (const b of seg.barriers) {
        const bPos = b.mesh.position;
        const pPos = player.position;
        const dz = Math.abs(pPos.z - bPos.z);
        const dxB = Math.abs(pPos.x - bPos.x);
        if (dz < 1.2 && dxB < 1.0 && pPos.y < bPos.y + 1.5 && invulnTimer <= 0) {
          hitBarrier();
        }
      }

      // Check collectible pickups
      for (const c of seg.collectibles) {
        if (c.collected) continue;
        const cPos = c.mesh.position;
        const pPos = player.position;
        const dist = Math.sqrt(
          (pPos.x - cPos.x) ** 2 + (pPos.y - cPos.y) ** 2 + (pPos.z - cPos.z) ** 2
        );
        if (dist < COLLECT_DISTANCE) {
          c.collected = true;
          c.mesh.visible = false;
          score += 50;
          playSound(soundUrl("collect"), { volume: 0.6 });
          createParticleEmitter(scene, cPos.x, cPos.y, cPos.z, { preset: "sparkle", count: 15, duration: 0.5 });
        }
      }
    }

    // Recycle segments behind camera
    recycleSegments();

    // Spin collectibles
    for (const seg of segments) {
      for (const c of seg.collectibles) {
        if (!c.collected) c.mesh.rotation.y += delta * 3;
      }
    }

    // Camera follow — behind and above
    const camTargetX = player.position.x * 0.5;
    const camTargetY = player.position.y + 4;
    const camTargetZ = player.position.z + 10;
    camera.position.x += (camTargetX - camera.position.x) * 3 * delta;
    camera.position.y += (camTargetY - camera.position.y) * 3 * delta;
    camera.position.z += (camTargetZ - camera.position.z) * 5 * delta;
    camera.lookAt(player.position.x, player.position.y + 1, player.position.z);

    // HUD update
    hud.update({ score, lives, custom: \`Distance: \${Math.floor(distance)}m | Speed: \${speed.toFixed(1)}\` });

    // Fall off edge = lose life
    if (player.position.y < -5) {
      lives--;
      if (lives <= 0) {
        triggerGameOver();
      } else {
        respawnPlayer();
      }
    }
  },

  cleanup() {
    destroyKb?.();
    destroySwipe?.();
  },
};

// ===== Helper Functions =====

function tryJump() {
  if ((playerBody as any).__canJump && !gameOver) {
    playerBody.velocity.y = JUMP_VELOCITY;
    (playerBody as any).__canJump = false;
    playSound(soundUrl("jump"), { volume: 0.4 });
    controller.jump();
  }
}

function hitBarrier() {
  lives--;
  invulnTimer = INVULN_TIME;
  playSound(soundUrl("hit"), { volume: 0.7 });
  createParticleEmitter(scene, player.position.x, player.position.y + 1, player.position.z, {
    preset: "explosion", count: 20, duration: 0.6,
  });
  speed = Math.max(INITIAL_SPEED, speed * 0.7);
  if (lives <= 0) {
    triggerGameOver();
  }
  hud.update({ score, lives, custom: \`Distance: \${Math.floor(distance)}m\` });
}

function triggerGameOver() {
  gameOver = true;
  playerBody.velocity.set(0, 0, 0);

  const finalDist = Math.floor(distance);
  const hsKey = "vibexe-3d-runner-highscore";
  const prev = parseInt(localStorage.getItem(hsKey) || "0", 10);
  const best = Math.max(finalDist, prev);
  localStorage.setItem(hsKey, String(best));
  const isNew = finalDist > prev && finalDist > 0;

  const container = renderer.domElement.parentElement || renderer.domElement;
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);z-index:100;color:white;font-family:sans-serif;";
  overlay.innerHTML = \`
    <h1 style="font-size:48px;margin:0;color:#ff4444;">GAME OVER</h1>
    <p style="font-size:24px;margin:8px 0;">Score: \${finalDist}</p>
    \${isNew ? '<p style="font-size:18px;color:#FFD700;margin:4px 0;">NEW BEST!</p>' : ''}
  \`;
  const btn = document.createElement("button");
  btn.textContent = "PLAY AGAIN";
  btn.style.cssText = "margin-top:20px;padding:14px 40px;font-size:20px;background:#00ff88;color:#000;border:none;border-radius:12px;cursor:pointer;font-weight:bold;";
  btn.addEventListener("click", () => { overlay.remove(); restartGame(); });
  overlay.appendChild(btn);
  container.appendChild(overlay);

  playSound(soundUrl("explosion"), { volume: 0.5 });
}

function restartGame() {
  for (const seg of segments) {
    for (const p of seg.platforms) { scene.remove(p.mesh); world.removeBody(p.body); }
    for (const b of seg.barriers) { scene.remove(b.mesh); if (b.body) world.removeBody(b.body); }
    for (const c of seg.collectibles) { scene.remove(c.mesh); }
    for (const d of seg.decorations) { scene.remove(d); }
  }
  segments.length = 0;

  currentLane = 1;
  targetX = 0;
  speed = INITIAL_SPEED;
  distance = 0;
  score = 0;
  lives = MAX_LIVES;
  invulnTimer = 0;
  gameOver = false;
  gameStarted = true;
  nextSegmentZ = 0;

  playerBody.position.set(0, 1.5, 0);
  playerBody.velocity.set(0, 0, 0);
  (playerBody as any).__canJump = true;

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    spawnSegment(i < 3);
  }

  hud.update({ score: 0, lives: MAX_LIVES, custom: "Distance: 0m" });
}

function respawnPlayer() {
  playerBody.position.set(LANE_X[currentLane], 2, playerBody.position.z + 3);
  playerBody.velocity.set(0, 0, -speed);
  (playerBody as any).__canJump = true;
  invulnTimer = INVULN_TIME;
}

async function spawnSegment(safe: boolean = false) {
  const z = nextSegmentZ;
  nextSegmentZ -= SEGMENT_LENGTH;

  const seg: Segment = { platforms: [], barriers: [], collectibles: [], decorations: [], z };

  // Ground platform segment (wide, flat)
  for (let lx = -1; lx <= 1; lx++) {
    const { mesh, size } = await createPlatform3D(scene, lx * 4, -0.5, z - SEGMENT_LENGTH / 2, {
      variant: "4x4x1",
      color: lx === 0 ? "blue" : "green",
    });
    const body = createPhysicsBody("box", 0, { x: lx * 4, y: -0.5, z: z - SEGMENT_LENGTH / 2 }, size);
    if (world && body) world.addBody(body);
    if (mesh && body) mesh.userData.__physicsBody = body;
    seg.platforms.push({ mesh, body });
  }

  if (!safe) {
    // Random barriers in lanes
    for (let lane = 0; lane < 3; lane++) {
      if (Math.random() < BARRIER_CHANCE) {
        const bx = LANE_X[lane];
        const bz = z - SEGMENT_LENGTH * (0.3 + Math.random() * 0.4);
        const { mesh, size } = await createBarrier3D(scene, bx, 0.5, bz, {
          variant: "2x1x2",
          color: "red",
        });
        const body = createPhysicsBody("box", 0, { x: bx, y: 0.5, z: bz }, size);
        if (world && body) world.addBody(body);
        if (mesh && body) mesh.userData.__physicsBody = body;
        seg.barriers.push({ mesh, body, lane });
      }
    }

    // Collectibles in lanes without barriers
    const barrierLanes = new Set(seg.barriers.map(b => b.lane));
    for (let lane = 0; lane < 3; lane++) {
      if (!barrierLanes.has(lane) && Math.random() < COLLECTIBLE_CHANCE) {
        const cx = LANE_X[lane];
        const cz = z - SEGMENT_LENGTH * (0.3 + Math.random() * 0.4);
        const { mesh } = await createCollectible3D(scene, cx, 1.5, cz, {
          type: ["diamond", "star", "heart"][Math.floor(Math.random() * 3)] as any,
          color: "yellow",
        });
        seg.collectibles.push({ mesh, collected: false, lane });
      }
    }
  }

  // Side decorations
  if (Math.random() < 0.5) {
    const side = Math.random() < 0.5 ? -7 : 7;
    const { mesh } = await createDecoration3D(scene, side, 0, z - SEGMENT_LENGTH / 2, {
      type: "pillar_2x2x4",
      color: "green",
    });
    seg.decorations.push(mesh);
  }

  segments.push(seg);
}

function recycleSegments() {
  const playerZ = player.position.z;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg.z > playerZ + RECYCLE_Z_BEHIND) {
      for (const p of seg.platforms) { scene.remove(p.mesh); world.removeBody(p.body); }
      for (const b of seg.barriers) { scene.remove(b.mesh); if (b.body) world.removeBody(b.body); }
      for (const c of seg.collectibles) { scene.remove(c.mesh); }
      for (const d of seg.decorations) { scene.remove(d); }
      segments.splice(i, 1);
      spawnSegment(false);
    }
  }
}
`;

// =============================================================================
// 3D TOP-DOWN SHOOTER SCENE STARTER
// Squad Shooter / Archero style — top-down camera, wave enemies, bullet pool
// Procedural tile-based arena with squad-shooter GLTF models
// =============================================================================
export const GAME_3D_SCENE_STARTER_SHOOTER = `/**
 * 3D Top-Down Shooter — Procedural arena, wave-based enemies, FSM AI, hit feedback
 *
 * Uses squad-shooter asset pack for all characters, enemies, weapons, and world tiles.
 * Arena is procedurally generated each game using seeded RNG.
 * Do NOT use kaykit factory helpers — load squad-shooter GLBs directly via loadGLTF.
 */
import {
  loadGLTF, createPhysicsBody, createKeyboardState, createHUD,
  createTouchJoystick, createText3D, createSkyGradient,
  playSound, playMusic, soundUrl, createParticleEmitter,
  COLLECT_DISTANCE,
} from "../config/assets-3d";
import { modelUrl } from "../utils/media-stock-3d";

const THREE = (window as any).THREE;
const CANNON = (window as any).CANNON;

// ===== Constants (overridable via game settings) =====
const __gsS = (window as any).__VIBEXE_GAME_SETTINGS__ || {};
const PACK = "squad-shooter";
const GRID_SIZE = 10;
const TILE_SIZE = 4;
const ARENA_HALF = (GRID_SIZE * TILE_SIZE) / 2;
const PLAYER_SPEED = __gsS.shooter?.playerSpeed ?? 6;
const BULLET_SPEED = __gsS.shooter?.bulletSpeed ?? 20;
const BULLET_POOL_SIZE = 40;
const FIRE_RATE = __gsS.shooter?.fireRate ?? 0.25;
const CAM_HEIGHT = __gsS.shooter?.camHeight ?? 20;
const CAM_BACK = __gsS.shooter?.camBack ?? 16;
const ENEMY_SHIFT = 0.12;
const SHAKE_DECAY = 8;
const SPAWN_MIN_DIST = 8;
const PLAYER_HEIGHT = 3.5;
const ENEMY_HEIGHT = 2.8;
const BOSS_HEIGHT = 4.5;

// ===== Seeded PRNG (mulberry32) =====
function mulberry32(seed: number) {
  return function(): number {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ===== Model Color Palette =====
// GLB exports from Unity have grey baseColorFactor (0.4-0.5). Colors must be assigned.
// No tone mapping = what you set is what you get. Use natural vibrant colors.
const MODEL_COLORS: Record<string, number> = {
  // Players — bright blue (hero color). Both rigged and non-rigged variants.
  'characters/player/Character_01': 0x3388FF,
  'characters/player/Character_02': 0x2266DD,
  'characters/player/Character_03': 0x55AAFF,
  'characters/player/Main_Char_01': 0x3388FF,
  'characters/player/Main_Char_02': 0x2266DD,
  'characters/player/Main_Char_03': 0x55AAFF,
  // Enemies — distinct per type
  'characters/enemies/Normal': 0xDDDDDD,
  'characters/enemies/Skinny': 0xEEAA55,
  'characters/enemies/Mine': 0x667788,
  'characters/enemies/Pistolman': 0xEE8800,
  'characters/enemies/RifleMan': 0xDD3333,
  'characters/enemies/CowBoy': 0xCC6600,
  'characters/enemies/Bomber': 0xDD4400,
  'characters/enemies/Grenader': 0x33BB33,
  'characters/enemies/ShotgunMan': 0xCC2222,
  'characters/enemies/MeeleMan': 0x9933CC,
  'characters/enemies/Sniper': 0x22AA44,
  'characters/enemies/Boss_Bomber': 0xDD1100,
  'characters/enemies/Old_Boss': 0xBB0000,
  'characters/enemies/Sniper_Boss': 0x117722,
  // Environment world_1 — warm sand ground + dark brown blocks for contrast
  'environment/world_1/1_Ground': 0xC4A858,
  'environment/world_1/1_Border': 0x5A2810,
  'environment/world_1/1_Block': 0x6B4020,
  'environment/world_1/1_Wall': 0x3A1A08,
  // Environment world_2 — slightly cooler sand palette
  'environment/world_2/2_Ground': 0xB89E4C,
  'environment/world_2/2_Border': 0x4A1E0C,
  'environment/world_2/2_Block': 0x5A3518,
  'environment/world_2/2_Wall': 0x2E1405,
  // Weapons — metallic tones
  'weapons/Shotgun': 0x999999,
  'weapons/Minigun': 0x777799,
  'weapons/Grenade_launcher': 0x779933,
  'weapons/Teslagun': 0x2299BB,
  // Collectibles — bright reward colors
  'misc/Coin': 0xFFDD00,
  'misc/Ring': 0x00CCDD,
  'misc/Chest': 0xDDA011,
  // Particles
  'particles/Bullet': 0xEEEE22,
  'particles/heal_plus': 0x22DD22,
  'particles/Shield_capsule': 0x2299DD,
  'particles/Light_ring': 0xDDDD66,
};
// Emissive: very subtle glow on characters/collectibles. Zero on environment.
// Without tone mapping, even small emissive values are clearly visible.
const CHAR_EMISSIVE_STRENGTH = 0.08;
const COLLECTIBLE_EMISSIVE = 0.15;
const ENV_EMISSIVE = 0;

function findModelColor(subpath: string): number | null {
  // Exact match first, then prefix match (longest prefix wins)
  if (MODEL_COLORS[subpath] !== undefined) return MODEL_COLORS[subpath];
  // Remove .glb extension for matching
  const clean = subpath.replace(/\.glb$/i, '');
  if (MODEL_COLORS[clean] !== undefined) return MODEL_COLORS[clean];
  // Prefix match — find longest matching key
  let best: string | null = null;
  for (const key of Object.keys(MODEL_COLORS)) {
    if (clean.startsWith(key) && (!best || key.length > best.length)) best = key;
  }
  return best ? MODEL_COLORS[best] : null;
}

// ===== GLTF Cache =====
const _cache = new Map<string, any>();

// Convert materials from PBR (MeshStandardMaterial) to MeshPhongMaterial + apply color tint
function _convertMaterials(root: any, subpath: string, tint: number | null) {
  const isCharacter = subpath.startsWith('characters/');
  const isCollectible = subpath.startsWith('misc/') || subpath.startsWith('particles/');
  const isEnvironment = subpath.startsWith('environment/');
  root.traverse((c: any) => {
    if (c.isMesh && c.material) {
      const convertMat = (mat: any) => {
        if (!mat.isMeshStandardMaterial) return mat;
        const hasVertexColors = !!(c.geometry && c.geometry.attributes && c.geometry.attributes.color);
        const hasTexture = !!mat.map;
        const baseColor = hasTexture ? new THREE.Color(0xffffff) : (tint !== null ? new THREE.Color(tint) : (mat.color ? mat.color.clone() : new THREE.Color(0xffffff)));
        let emissiveColor = new THREE.Color(0x000000);
        if (tint !== null) {
          if (isCollectible) emissiveColor = new THREE.Color(tint).multiplyScalar(COLLECTIBLE_EMISSIVE);
          else if (isCharacter) emissiveColor = new THREE.Color(tint).multiplyScalar(CHAR_EMISSIVE_STRENGTH);
          else if (isEnvironment) emissiveColor = new THREE.Color(tint).multiplyScalar(ENV_EMISSIVE);
        }
        const phong = new THREE.MeshPhongMaterial({
          color: baseColor,
          map: mat.map || null,
          emissive: emissiveColor,
          emissiveMap: mat.emissiveMap || null,
          normalMap: mat.normalMap || null,
          opacity: mat.opacity !== undefined ? mat.opacity : 1,
          transparent: !!mat.transparent,
          side: mat.side !== undefined ? mat.side : THREE.FrontSide,
          vertexColors: hasVertexColors,
          skinning: !!mat.skinning,
          specular: new THREE.Color(0x111111),
          shininess: 8,
        });
        if (mat.alphaMap) phong.alphaMap = mat.alphaMap;
        if (mat.alphaTest) phong.alphaTest = mat.alphaTest;
        return phong;
      };
      if (Array.isArray(c.material)) {
        c.material = c.material.map(convertMat);
      } else {
        c.material = convertMat(c.material);
      }
    }
  });
}

async function loadModel(subpath: string, cloneMats = false): Promise<any> {
  const url = modelUrl(PACK, subpath);
  let mesh: any;
  try {
    const isCharacter = subpath.startsWith('characters/');

    if (_cache.has(url)) {
      // Cache hit — clone (safe for static Mesh, NOT for SkinnedMesh)
      mesh = _cache.get(url)!.clone();
    } else if (isCharacter) {
      // Characters: load full GLTF to check for animations
      const gltf: any = await new Promise((resolve, reject) => {
        const loader = new THREE.GLTFLoader();
        loader.load(url, resolve, undefined, reject);
      });
      mesh = gltf.scene;
      const rawClips = gltf.animations || [];
      console.log("[3D] Loaded character:", subpath, "clips:", rawClips.length,
        rawClips.length > 0 ? rawClips.map((c: any) => c.name).join(", ") : "(static)");
      const tint = findModelColor(subpath);
      _convertMaterials(mesh, subpath, tint);

      if (rawClips.length > 0) {
        // Animated/rigged model — DO NOT cache (SkinnedMesh clone breaks skeleton).
        // Each instance gets its own AnimationMixer.
        // Strip root motion on known root bones (prevents character sliding)
        const ROOT_BONES = new Set(["hips","root","mixamorig:hips","mixamorigHips","pelvis","rootnode","hip","bip001"]);
        for (const clip of rawClips) {
          for (let ti = clip.tracks.length - 1; ti >= 0; ti--) {
            const track = clip.tracks[ti];
            const parts = track.name.split(".");
            const nodePath = parts.slice(0, -1).join(".");
            const prop = parts[parts.length - 1];
            if (prop === "scale") { clip.tracks.splice(ti, 1); continue; }
            if (prop === "position" && ROOT_BONES.has(nodePath.toLowerCase())) {
              if (track.values && track.values.length >= 3) {
                const firstX = track.values[0], firstZ = track.values[2];
                for (let j = 0; j < track.values.length; j += 3) {
                  track.values[j] = firstX;
                  track.values[j + 2] = firstZ;
                }
              }
            }
          }
        }

        const mixer = new THREE.AnimationMixer(mesh);
        const mixersArr = (window as any)._activeMixers3D;
        if (mixersArr) mixersArr.push(mixer);

        // Build clip map with scored matching
        const clipMap: Record<string, any> = {};
        const clipNames: string[] = [];
        for (const clip of rawClips) {
          clipMap[clip.name] = mixer.clipAction(clip);
          clipNames.push(clip.name);
        }

        let currentAction: any = null;
        function findClip(keyword: string): any {
          const kw = keyword.toLowerCase();
          let best: string | null = null, bestPri = 0, bestLen = Infinity;
          for (const cn of clipNames) {
            const cl = cn.toLowerCase();
            if (!cl.includes(kw)) continue;
            const pri = cl.startsWith(kw) ? 3 : (cl.includes("_" + kw) || cl.includes(" " + kw)) ? 2 : 1;
            if (pri > bestPri || (pri === bestPri && cn.length < bestLen)) {
              best = cn; bestPri = pri; bestLen = cn.length;
            }
          }
          return best ? clipMap[best] : null;
        }

        function play(name: string) {
          const action = findClip(name);
          if (!action) return;
          if (currentAction === action && action.isRunning()) return; // idempotent
          action.setLoop(THREE.LoopRepeat, Infinity);
          if (currentAction) {
            action.reset().play();
            currentAction.crossFadeTo(action, 0.2, true);
          } else {
            action.reset().play();
          }
          currentAction = action;
        }

        mesh.userData.__play = play;
        mesh.userData.__clips = clipNames;
        mesh.userData.__mixer = mixer;
        play("idle"); // auto-play idle on load
      } else {
        // Check if mesh has SkinnedMesh — if so, DO NOT cache/clone
        // (Three.js r128 clone() on SkinnedMesh shares skeleton → invisible)
        let hasSkinned = false;
        mesh.traverse((c: any) => { if (c.isSkinnedMesh) hasSkinned = true; });
        if (hasSkinned) {
          console.log("[3D] SkinnedMesh detected (0 clips), skipping cache:", subpath);
          // Don't cache — each load gets fresh instance
        } else {
          // Static character model (enemies without skinning) — safe to cache + clone
          _cache.set(url, mesh);
          mesh = mesh.clone();
        }
      }
    } else {
      // Non-character: load + cache normally
      const original = await loadGLTF(url);
      console.log("[3D] Loaded GLTF:", subpath);
      const tint = findModelColor(subpath);
      _convertMaterials(original, subpath, tint);
      _cache.set(url, original);
      mesh = original.clone();
    }
    if (cloneMats) {
      mesh.traverse((c: any) => {
        if (c.material) {
          c.material = Array.isArray(c.material) ? c.material.map((m: any) => m.clone()) : c.material.clone();
        }
      });
    }
    return mesh;
  } catch (e) {
    console.warn("[3D] Failed to load:", subpath, e);
    return new THREE.Group();
  }
}

function scaleToHeight(mesh: any, targetH: number) {
  const box = new THREE.Box3().setFromObject(mesh);
  const sz = new THREE.Vector3(); box.getSize(sz);
  if (sz.y > 0.001) mesh.scale.multiplyScalar(targetH / sz.y);
}

function enableShadows(mesh: any, cast = true, receive = false) {
  mesh.traverse((c: any) => {
    if (c.isMesh) { c.castShadow = cast; c.receiveShadow = receive; }
  });
}

function scaleToTile(mesh: any, targetX: number, targetZ: number) {
  const box = new THREE.Box3().setFromObject(mesh);
  const sz = new THREE.Vector3(); box.getSize(sz);
  if (sz.x > 0.001 && sz.z > 0.001) {
    const s = Math.min(targetX / sz.x, targetZ / sz.z);
    mesh.scale.multiplyScalar(s);
  }
}

// Scale to fit within maxSize on the LARGEST dimension (prevents flat objects like rings from becoming enormous)
function scaleToFit(mesh: any, maxSize: number) {
  const box = new THREE.Box3().setFromObject(mesh);
  const sz = new THREE.Vector3(); box.getSize(sz);
  const biggest = Math.max(sz.x, sz.y, sz.z);
  if (biggest > 0.001) mesh.scale.multiplyScalar(maxSize / biggest);
}

// ===== Enemy Tiers =====
const ENEMY_TIERS = [
  { tier: 1, minWave: 1, models: ["Normal.glb", "Skinny.glb", "Mine.glb"], hp: 25, speed: 1.8, damage: 1 },
  { tier: 2, minWave: 3, models: ["Pistolman_1.glb", "RifleMan.glb", "CowBoy_1.glb"], hp: 45, speed: 2.2, damage: 1 },
  { tier: 3, minWave: 5, models: ["Bomber_1.glb", "Grenader.glb", "ShotgunMan_1.glb", "MeeleMan.glb"], hp: 65, speed: 2.6, damage: 2 },
  { tier: 4, minWave: 7, models: ["RifleMan_ELITE.glb", "Pistolman_Elite.glb", "ShotgunMan_ELITE.glb", "MeeleMan_Elite.glb", "Sniper_Elite.glb"], hp: 90, speed: 3.0, damage: 2 },
];
const BOSS_MODELS = ["Boss_Bomber.glb", "Old_Boss.glb", "Sniper_Boss.glb"];
const PLAYER_MODELS = ["Character_01.glb", "Character_02.glb", "Character_03.glb"];

// ===== Game State =====
let scene: any, camera: any, renderer: any, container: HTMLDivElement;
let playerMesh: any, playerBody: any, world: any;
let playerPlay: ((name: string) => void) | null = null;
let playerAnimState = "idle";
let hud: any, keys: any, destroyKb: () => void, destroyJoystick: () => void;
let score = 0, wave = 0, lives = 5, gameOver = false;
let lastFireTime = 0, gameTime = 0, shakeIntensity = 0, difficulty = 1;
let joyX = 0, joyZ = 0;
let arenaSpawnPoints: { x: number; z: number }[] = [];

const bullets: { mesh: any; vel: any; active: boolean; damage: number }[] = [];
const enemies: { mesh: any; body: any; hp: number; maxHp: number; state: string; stateTime: number; speed: number; damage: number; isBoss: boolean; flashTimer: number; play?: (name: string) => void }[] = [];
const collectibles: { mesh: any; collected: boolean; type: string }[] = [];
const floatingTexts: { sprite: any; vel: number; life: number }[] = [];

// ===== Arena Generator =====
// Grid-based system: each cell = TILE_SIZE × TILE_SIZE on a GRID_SIZE × GRID_SIZE grid.
// Quadrant-balanced: arena divided into 4 quadrants, each gets ~equal cover pieces.
// Spacing rule: blocks avoid adjacency (prevents clumping), center 2x2 reserved for player.
async function generateShooterArena(onProgress?: (p: number) => void) {
  const seed = Date.now();
  const rng = mulberry32(seed);
  const theme = rng() > 0.5 ? "world_2" : "world_1";
  const prefix = theme === "world_2" ? "2" : "1";
  arenaSpawnPoints = [];

  // Grid: 0=walkable, 1=1x1block, 2=wall, 3=multi-cell-secondary
  const grid: number[][] = [];
  for (let i = 0; i < GRID_SIZE; i++) grid.push(new Array(GRID_SIZE).fill(0));

  function g2w(gx: number, gz: number): [number, number] {
    return [(gx - GRID_SIZE / 2 + 0.5) * TILE_SIZE, (gz - GRID_SIZE / 2 + 0.5) * TILE_SIZE];
  }
  function pick<T>(arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }
  function cellFree(gx: number, gz: number): boolean {
    return gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE && grid[gx][gz] === 0;
  }
  function inCenter(gx: number, gz: number): boolean {
    // Small 2x2 exclusion zone for player spawn only
    return Math.abs(gx - (GRID_SIZE - 1) / 2) <= 1.0 && Math.abs(gz - (GRID_SIZE - 1) / 2) <= 1.0;
  }
  function quadrant(gx: number, gz: number): number {
    const mid = GRID_SIZE / 2;
    return (gx < mid ? 0 : 1) + (gz < mid ? 0 : 2);
  }
  function hasAdjacentBlock(gx: number, gz: number): boolean {
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = gx + dx, nz = gz + dz;
      if (nx >= 0 && nx < GRID_SIZE && nz >= 0 && nz < GRID_SIZE && grid[nx][nz] !== 0) return true;
    }
    return false;
  }

  // === Complete tile catalogs (ALL models per theme, verified from server inventory) ===
  // world_2 is missing Ground_Half and Border_4; everything else identical
  const isWorld1 = theme === "world_1";
  const GROUNDS = [\`\${prefix}_Ground_1.glb\`];
  const GROUND_HALF = isWorld1 ? [\`\${prefix}_Ground_Half.glb\`] : [];
  const BORDERS = isWorld1
    ? [\`\${prefix}_Border_1.glb\`, \`\${prefix}_Border_2.glb\`, \`\${prefix}_Border_3.glb\`, \`\${prefix}_Border_4.glb\`]
    : [\`\${prefix}_Border_1.glb\`, \`\${prefix}_Border_2.glb\`, \`\${prefix}_Border_3.glb\`];
  const BORDER_CORNER = \`\${prefix}_Border_Corner.glb\`;
  const BORDER_EXIT = \`\${prefix}_Border_Exit.glb\`;
  const BORDER_HALF = \`\${prefix}_Border_Half.glb\`;
  const BORDER_QUARTER = \`\${prefix}_Border_Quarter.glb\`;
  const BLOCKS_1x1 = [\`\${prefix}_Block_1x1_Big.glb\`, \`\${prefix}_Block_1x1_Medium.glb\`, \`\${prefix}_Block_1x1_Small.glb\`];
  const BLOCKS_1x1_HALF = [\`\${prefix}_Block_1x1_Big_Half.glb\`, \`\${prefix}_Block_1x1_Medium_Half.glb\`, \`\${prefix}_Block_1x1_Small_Half.glb\`];
  const BLOCKS_1x2 = [\`\${prefix}_Block_1x2_Big.glb\`, \`\${prefix}_Block_1x2_Medium.glb\`, \`\${prefix}_Block_1x2_Small.glb\`];
  const BLOCKS_1x2_HALF = [\`\${prefix}_Block_1x2_Big_Half.glb\`, \`\${prefix}_Block_1x2_Medium_Half.glb\`];
  const BLOCK_2x2 = \`\${prefix}_Block_2x2_Big_Half.glb\`;
  const WALL_1x1 = \`\${prefix}_Wall_1x1.glb\`;
  const WALL_1x2 = \`\${prefix}_Wall_1x2.glb\`;
  const WALL_CORNER = \`\${prefix}_Wall_corner.glb\`;

  // --- Step 1: GROUND tiles (full grid + occasional Ground_Half for variety) ---
  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const [wx, wz] = g2w(gx, gz);
      const gFile = (GROUND_HALF.length > 0 && rng() > 0.92) ? pick(GROUND_HALF) : pick(GROUNDS);
      const mesh = await loadModel(\`environment/\${theme}/\${gFile}\`);
      scaleToTile(mesh, TILE_SIZE, TILE_SIZE);
      mesh.position.set(wx, 0, wz);
      enableShadows(mesh, false, true);
      scene.add(mesh);
    }
  }
  onProgress?.(0.12);

  // --- Step 2: BORDERS (all 4 variants + corners + exits + half/quarter accents) ---
  const edgeOff = ARENA_HALF + TILE_SIZE * 0.4;
  // 1-2 random exits for visual interest
  const exitSet = new Set<string>();
  for (let e = 0; e < 1 + Math.floor(rng() * 2); e++) {
    exitSet.add(\`\${Math.floor(rng() * 4)}_\${1 + Math.floor(rng() * (GRID_SIZE - 2))}\`);
  }
  for (let i = 0; i < GRID_SIZE; i++) {
    const pos = (i - GRID_SIZE / 2 + 0.5) * TILE_SIZE;
    for (const [side, x, z, rot] of [
      [0, pos, -edgeOff, Math.PI], [1, pos, edgeOff, 0],
      [2, -edgeOff, pos, -Math.PI / 2], [3, edgeOff, pos, Math.PI / 2],
    ] as [number, number, number, number][]) {
      const isExit = exitSet.has(\`\${side}_\${i}\`);
      const borderFile = isExit ? BORDER_EXIT : pick(BORDERS);
      const bm = await loadModel(\`environment/\${theme}/\${borderFile}\`);
      scaleToTile(bm, TILE_SIZE, TILE_SIZE);
      bm.position.set(x, 0, z); bm.rotation.y = rot;
      enableShadows(bm, true, false); scene.add(bm);
      if (!isExit) {
        const isNS = side <= 1;
        addStaticBody(x, z, isNS ? TILE_SIZE : 2, isNS ? 2 : TILE_SIZE);
      }
    }
  }
  // 4 corners
  for (const [sx, sz, rot] of [[-1,-1,0], [-1,1,-0.5], [1,-1,0.5], [1,1,1]] as [number,number,number][]) {
    const cm = await loadModel(\`environment/\${theme}/\${BORDER_CORNER}\`);
    scaleToTile(cm, TILE_SIZE, TILE_SIZE);
    cm.position.set(sx * edgeOff, 0, sz * edgeOff); cm.rotation.y = rot * Math.PI;
    enableShadows(cm, true, false); scene.add(cm);
  }
  // Border_Half and Border_Quarter accent pieces at corners
  for (const [sx, sz, rot] of [[-1,-1,Math.PI], [1,-1,Math.PI/2], [-1,1,-Math.PI/2], [1,1,0]] as [number,number,number][]) {
    if (rng() > 0.4) {
      const hb = await loadModel(\`environment/\${theme}/\${BORDER_HALF}\`);
      scaleToTile(hb, TILE_SIZE * 0.5, TILE_SIZE);
      hb.position.set(sx * (edgeOff + TILE_SIZE * 0.25), 0, sz * (edgeOff + TILE_SIZE * 0.25));
      hb.rotation.y = rot; enableShadows(hb, true, false); scene.add(hb);
    }
    if (rng() > 0.5) {
      const qb = await loadModel(\`environment/\${theme}/\${BORDER_QUARTER}\`);
      scaleToTile(qb, TILE_SIZE * 0.3, TILE_SIZE * 0.3);
      qb.position.set(sx * (edgeOff - TILE_SIZE * 0.15), 0, sz * (edgeOff - TILE_SIZE * 0.15));
      qb.rotation.y = rot; enableShadows(qb, true, false); scene.add(qb);
    }
  }
  onProgress?.(0.22);

  // --- Step 3: COVER blocks — quadrant-balanced placement ---
  // Collect all placeable interior cells (not edge row, not center)
  // Group by quadrant to guarantee even distribution across arena
  const quadCells: [number, number][][] = [[], [], [], []]; // 4 quadrants
  for (let gx = 1; gx < GRID_SIZE - 1; gx++) {
    for (let gz = 1; gz < GRID_SIZE - 1; gz++) {
      if (inCenter(gx, gz)) continue;
      quadCells[quadrant(gx, gz)].push([gx, gz]);
    }
  }
  // Shuffle each quadrant independently
  for (const qc of quadCells) {
    for (let i = qc.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [qc[i], qc[j]] = [qc[j], qc[i]];
    }
  }

  // 3a: Place 1 large 2x2 block per quadrant pair (2 total, diagonal quadrants)
  const q2x2Pairs = rng() > 0.5 ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]];
  for (const qIdx of [q2x2Pairs[0][0], q2x2Pairs[1][0]]) {
    for (const [gx, gz] of quadCells[qIdx]) {
      if (cellFree(gx, gz) && cellFree(gx+1, gz) && cellFree(gx, gz+1) && cellFree(gx+1, gz+1)
        && !inCenter(gx+1, gz) && !inCenter(gx, gz+1) && !inCenter(gx+1, gz+1)) {
        grid[gx][gz] = 1; grid[gx+1][gz] = 3; grid[gx][gz+1] = 3; grid[gx+1][gz+1] = 3;
        const [wx, wz] = g2w(gx, gz);
        const cx = wx + TILE_SIZE * 0.5, cz = wz + TILE_SIZE * 0.5;
        const m = await loadModel(\`environment/\${theme}/\${BLOCK_2x2}\`);
        scaleToTile(m, TILE_SIZE * 1.8, TILE_SIZE * 1.8);
        m.position.set(cx, 0, cz); m.rotation.y = rng() * Math.PI * 2;
        enableShadows(m, true, true); scene.add(m);
        addStaticBody(cx, cz, TILE_SIZE * 1.5, TILE_SIZE * 1.5);
        break; // one per target quadrant
      }
    }
  }

  // 3b: Place 1-2 wide 1x2 blocks per quadrant (4-8 total)
  for (let qi = 0; qi < 4; qi++) {
    const target1x2 = 1 + Math.floor(rng() * 2);
    let placed = 0;
    for (const [gx, gz] of quadCells[qi]) {
      if (placed >= target1x2) break;
      if (!cellFree(gx, gz)) continue;
      const horiz = rng() > 0.5;
      const gx2 = horiz ? gx + 1 : gx, gz2 = horiz ? gz : gz + 1;
      if (!cellFree(gx2, gz2) || inCenter(gx2, gz2)) continue;
      grid[gx][gz] = 1; grid[gx2][gz2] = 3;
      const [wx1, wz1] = g2w(gx, gz);
      const [wx2, wz2] = g2w(gx2, gz2);
      const cx = (wx1 + wx2) / 2, cz = (wz1 + wz2) / 2;
      const isHalf = rng() > 0.6;
      const bf = pick(isHalf ? BLOCKS_1x2_HALF : BLOCKS_1x2);
      const m = await loadModel(\`environment/\${theme}/\${bf}\`);
      scaleToTile(m, horiz ? TILE_SIZE * 1.8 : TILE_SIZE * 0.85, horiz ? TILE_SIZE * 0.85 : TILE_SIZE * 1.8);
      m.position.set(cx, 0, cz);
      if (!horiz) m.rotation.y = Math.PI / 2;
      enableShadows(m, true, true); scene.add(m);
      addStaticBody(cx, cz, horiz ? TILE_SIZE * 1.5 : TILE_SIZE * 0.7, horiz ? TILE_SIZE * 0.7 : TILE_SIZE * 1.5);
      placed++;
    }
  }

  // 3c: Fill each quadrant with 1x1 blocks (~25% of available cells, with spacing)
  for (let qi = 0; qi < 4; qi++) {
    const target = Math.max(3, Math.floor(quadCells[qi].length * 0.25));
    let placed = 0;
    for (const [gx, gz] of quadCells[qi]) {
      if (placed >= target) break;
      if (!cellFree(gx, gz)) continue;
      // Spacing: skip if adjacent to another block (prevents clumping)
      if (hasAdjacentBlock(gx, gz) && rng() > 0.35) continue;
      grid[gx][gz] = 1;
      const [wx, wz] = g2w(gx, gz);
      const isHalf = rng() > 0.55;
      const bf = pick(isHalf ? BLOCKS_1x1_HALF : BLOCKS_1x1);
      const m = await loadModel(\`environment/\${theme}/\${bf}\`);
      scaleToTile(m, TILE_SIZE * 0.85, TILE_SIZE * 0.85);
      m.position.set(wx, 0, wz); m.rotation.y = rng() * Math.PI * 2;
      enableShadows(m, true, true); scene.add(m);
      addStaticBody(wx, wz, TILE_SIZE * 0.7, TILE_SIZE * 0.7);
      placed++;
    }
  }
  onProgress?.(0.28);

  // --- Step 4: WALLS — 1 per quadrant (4 total, mix of L-shapes and lines) ---
  for (let qi = 0; qi < 4; qi++) {
    const wallCandidates = quadCells[qi].filter(([gx, gz]) => cellFree(gx, gz));
    for (let i = wallCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [wallCandidates[i], wallCandidates[j]] = [wallCandidates[j], wallCandidates[i]];
    }
    let wallPlaced = false;
    for (const [gx, gz] of wallCandidates) {
      if (wallPlaced) break;
      if (!cellFree(gx, gz)) continue;
      // Try L-shape
      const makeL = rng() > 0.4 && cellFree(gx+1, gz) && cellFree(gx, gz+1)
        && !inCenter(gx+1, gz) && !inCenter(gx, gz+1);
      if (makeL) {
        grid[gx][gz] = 2; grid[gx+1][gz] = 2; grid[gx][gz+1] = 2;
        const [wx, wz] = g2w(gx, gz);
        const co = await loadModel(\`environment/\${theme}/\${WALL_CORNER}\`);
        scaleToTile(co, TILE_SIZE * 0.8, TILE_SIZE * 0.8);
        co.position.set(wx, 0, wz); co.rotation.y = [0, Math.PI/2, Math.PI, -Math.PI/2][Math.floor(rng()*4)];
        enableShadows(co, true, false); scene.add(co);
        addStaticBody(wx, wz, TILE_SIZE * 0.6, TILE_SIZE * 0.6);
        for (const [dx, dz] of [[1,0],[0,1]]) {
          const [ewx, ewz] = g2w(gx + dx, gz + dz);
          const ew = await loadModel(\`environment/\${theme}/\${WALL_1x1}\`);
          scaleToTile(ew, TILE_SIZE * 0.8, TILE_SIZE * 0.8);
          ew.position.set(ewx, 0, ewz); enableShadows(ew, true, false); scene.add(ew);
          addStaticBody(ewx, ewz, TILE_SIZE * 0.6, TILE_SIZE * 0.6);
        }
        wallPlaced = true;
      } else {
        grid[gx][gz] = 2;
        const [wx, wz] = g2w(gx, gz);
        const long = rng() > 0.5 && cellFree(gx+1, gz) && !inCenter(gx+1, gz);
        if (long) grid[gx+1][gz] = 2;
        const wallFile = long ? WALL_1x2 : WALL_1x1;
        const wm = await loadModel(\`environment/\${theme}/\${wallFile}\`);
        const wallRot = rng() > 0.5 ? 0 : Math.PI / 2;
        if (long) {
          const [wx2] = g2w(gx+1, gz);
          const mx = (wx + wx2) / 2;
          scaleToTile(wm, TILE_SIZE * 1.8, TILE_SIZE * 0.8);
          wm.position.set(mx, 0, wz); wm.rotation.y = wallRot;
          enableShadows(wm, true, false); scene.add(wm);
          addStaticBody(mx, wz, TILE_SIZE * 1.5, TILE_SIZE * 0.6);
        } else {
          scaleToTile(wm, TILE_SIZE * 0.8, TILE_SIZE * 0.8);
          wm.position.set(wx, 0, wz); wm.rotation.y = wallRot;
          enableShadows(wm, true, false); scene.add(wm);
          addStaticBody(wx, wz, TILE_SIZE * 0.6, TILE_SIZE * 0.6);
        }
        wallPlaced = true;
      }
    }
  }
  onProgress?.(0.3);

  // --- Step 5: Spawn points — all walkable (grid=0) cells away from player ---
  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      if (grid[gx][gz] !== 0) continue;
      const [wx, wz] = g2w(gx, gz);
      const d = Math.sqrt(wx * wx + wz * wz);
      if (d > SPAWN_MIN_DIST) arenaSpawnPoints.push({ x: wx, z: wz });
    }
  }
}

function addStaticBody(x: number, z: number, sx: number, sz: number) {
  if (!world) return;
  const body = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(x, 1, z), shape: new CANNON.Box(new CANNON.Vec3(sx / 2, 2, sz / 2)) });
  world.addBody(body);
}

// ===== GameScene =====
export const GameScene = {
  world: null as any,

  async init(_scene: any, _camera: any, _renderer: any, _container: HTMLDivElement, onProgress?: (p: number) => void) {
    scene = _scene; camera = _camera; renderer = _renderer; container = _container;
    world = this.world;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // NO tone mapping — Phong materials don't need HDR→LDR compression.
    // Tone mapping (ACES/Reinhard) kills contrast and desaturates cartoon colors.
    renderer.toneMapping = THREE.NoToneMapping;

    // Remove default Game3D.tsx lights (we need custom lighting for top-down shooter)
    const defaultLights = scene.children.filter((c: any) => c.isLight);
    defaultLights.forEach((l: any) => scene.remove(l));

    // Clean sky blue background
    scene.background = new THREE.Color(0x6CB4D9);

    // Cartoon lighting: hemisphere fill + one directional sun.
    // Total ~1.0 (hemi 0.35 + ambient 0.15 + sun 0.5) — no color clipping with NoToneMapping.
    const hemi = new THREE.HemisphereLight(0xEEF4FF, 0x886633, 0.35);
    scene.add(hemi);

    const shooterAmbient = new THREE.AmbientLight(0xFFFFFF, 0.15);
    scene.add(shooterAmbient);

    // Main sun — moderate intensity, crisp shadows
    const shooterSun = new THREE.DirectionalLight(0xFFF8EE, 0.5);
    shooterSun.position.set(8, 40, -8);
    shooterSun.castShadow = true;
    shooterSun.shadow.mapSize.width = 2048;
    shooterSun.shadow.mapSize.height = 2048;
    shooterSun.shadow.camera.near = 0.5;
    shooterSun.shadow.camera.far = 80;
    shooterSun.shadow.camera.left = -ARENA_HALF;
    shooterSun.shadow.camera.right = ARENA_HALF;
    shooterSun.shadow.camera.top = ARENA_HALF;
    shooterSun.shadow.camera.bottom = -ARENA_HALF;
    shooterSun.shadow.bias = -0.001;
    scene.add(shooterSun);

    // Base ground plane beneath tile arena
    const basePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_HALF * 3, ARENA_HALF * 3),
      new THREE.MeshPhongMaterial({ color: 0xA88030, shininess: 3, specular: new THREE.Color(0x111111) })
    );
    basePlane.rotation.x = -Math.PI / 2;
    basePlane.position.y = -0.05;
    basePlane.receiveShadow = true;
    scene.add(basePlane);

    onProgress?.(0.05);

    // Procedural arena
    await generateShooterArena(onProgress);

    // ===== PLAYER =====
    const pm = PLAYER_MODELS[Math.floor(Math.random() * PLAYER_MODELS.length)];
    playerMesh = await loadModel(\`characters/player/\${pm}\`, true);
    // Diagnostic: verify player mesh loaded correctly
    {
      const pbox = new THREE.Box3().setFromObject(playerMesh);
      const psz = new THREE.Vector3(); pbox.getSize(psz);
      let meshCount = 0, skinnedCount = 0;
      playerMesh.traverse((c: any) => { if (c.isMesh) meshCount++; if (c.isSkinnedMesh) skinnedCount++; });
      console.log("[3D] Player model:", pm, "| meshes:", meshCount, "skinned:", skinnedCount,
        "| raw size:", psz.x.toFixed(3), psz.y.toFixed(3), psz.z.toFixed(3));
    }
    scaleToHeight(playerMesh, PLAYER_HEIGHT);
    enableShadows(playerMesh, true, false);
    playerMesh.position.set(0, 0, 0);
    scene.add(playerMesh);
    {
      const pbox2 = new THREE.Box3().setFromObject(playerMesh);
      const psz2 = new THREE.Vector3(); pbox2.getSize(psz2);
      console.log("[3D] Player after scale:", psz2.x.toFixed(2), psz2.y.toFixed(2), psz2.z.toFixed(2),
        "| scale:", playerMesh.scale.x.toFixed(4));
    }
    // Store animation controller from loadModel
    playerPlay = playerMesh.userData.__play || null;
    playerAnimState = "idle";
    if (playerPlay) {
      console.log("[3D] Player animations:", playerMesh.userData.__clips?.join(", ") || "none");
    }

    playerBody = createPhysicsBody("box", 5, { x: 0, y: 1.25, z: 0 }, { x: 0.5, y: 1.25, z: 0.5 });
    if (playerBody) { playerBody.linearDamping = 0.95; playerBody.fixedRotation = true; }
    if (world && playerBody) world.addBody(playerBody);
    onProgress?.(0.4);

    // ===== BULLET POOL =====
    let bulletTemplate: any = null;
    try {
      bulletTemplate = await loadModel("particles/Bullet.glb");
      scaleToHeight(bulletTemplate, 0.35);
    } catch (e) { bulletTemplate = null; }
    for (let i = 0; i < BULLET_POOL_SIZE; i++) {
      let mesh: any;
      if (bulletTemplate) {
        mesh = bulletTemplate.clone();
      } else {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 6, 6),
          new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 0.8 })
        );
      }
      mesh.visible = false;
      scene.add(mesh);
      bullets.push({ mesh, vel: new THREE.Vector3(), active: false, damage: 10 });
    }
    onProgress?.(0.5);

    // ===== COLLECTIBLES =====
    const collectDefs = [
      { path: "misc/Coin.glb", type: "coin" },
      { path: "misc/Ring.glb", type: "ring" },
      { path: "misc/Chest.glb", type: "chest" },
    ];
    const cPositions = arenaSpawnPoints.filter(p => Math.sqrt(p.x * p.x + p.z * p.z) < ARENA_HALF * 0.7);
    for (let i = cPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cPositions[i], cPositions[j]] = [cPositions[j], cPositions[i]];
    }
    for (let i = 0; i < Math.min(8, cPositions.length); i++) {
      const ci = collectDefs[i % collectDefs.length];
      try {
        const mesh = await loadModel(ci.path);
        scaleToFit(mesh, 1.0);
        mesh.position.set(cPositions[i].x, 0.6, cPositions[i].z);
        scene.add(mesh);
        collectibles.push({ mesh, collected: false, type: ci.type });
      } catch (e) { console.warn("[3D] collectible load failed:", ci.path); }
    }
    onProgress?.(0.7);

    // ===== WEAPON PICKUPS =====
    const weaponDefs = [
      { path: "weapons/Shotgun.glb", name: "shotgun" },
      { path: "weapons/Minigun.glb", name: "minigun" },
      { path: "weapons/Grenade_launcher.glb", name: "grenade" },
      { path: "weapons/Teslagun.glb", name: "tesla" },
    ];
    const wPositions = arenaSpawnPoints.filter(p => Math.sqrt(p.x * p.x + p.z * p.z) > 6);
    for (let i = wPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wPositions[i], wPositions[j]] = [wPositions[j], wPositions[i]];
    }
    for (let i = 0; i < Math.min(3, wPositions.length); i++) {
      const wi = weaponDefs[i % weaponDefs.length];
      try {
        const mesh = await loadModel(wi.path);
        scaleToFit(mesh, 1.2);
        mesh.position.set(wPositions[i].x, 0.8, wPositions[i].z);
        scene.add(mesh);
        collectibles.push({ mesh, collected: false, type: "weapon_" + wi.name });
      } catch (e) { console.warn("[3D] weapon load failed:", wi.path); }
    }
    onProgress?.(0.8);

    // ===== HUD =====
    hud = createHUD(container);
    hud.update({ score: 0, lives, custom: \`Wave: 1\` });

    // ===== CONTROLS =====
    const kb = createKeyboardState(); keys = kb.keys; destroyKb = kb.destroy;
    const joy = createTouchJoystick(container, (dx: number, dy: number) => { joyX = dx; joyZ = dy; });
    destroyJoystick = joy.destroy;
    container.addEventListener("pointerdown", onShoot);

    // Top-down camera
    camera.position.set(0, CAM_HEIGHT, CAM_BACK);
    camera.lookAt(0, 0, 0);

    // Start music
    try { playMusic(soundUrl("squad-shooter/music/game_music")); } catch(e) {}

    // First wave
    spawnWave();
    onProgress?.(1);
  },

  update(delta: number) {
    if (!playerMesh || !world || gameOver) return;
    gameTime += delta;
    world.step(1 / 60, delta, 3);

    // === Player movement ===
    let mx = ((keys.ArrowRight || keys.KeyD) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyA) ? 1 : 0);
    let mz = ((keys.ArrowDown || keys.KeyS) ? 1 : 0) - ((keys.ArrowUp || keys.KeyW) ? 1 : 0);
    mx += joyX; mz += joyZ;
    const isMoving = Math.abs(mx) > 0.1 || Math.abs(mz) > 0.1;
    if (isMoving) {
      const len = Math.sqrt(mx * mx + mz * mz);
      playerBody.velocity.x = (mx / len) * PLAYER_SPEED;
      playerBody.velocity.z = (mz / len) * PLAYER_SPEED;
      playerMesh.rotation.y = Math.atan2(mx, mz);
      if (playerPlay && playerAnimState !== "run") { playerPlay("run"); playerAnimState = "run"; }
    } else {
      if (playerPlay && playerAnimState !== "idle") { playerPlay("idle"); playerAnimState = "idle"; }
    }
    const clamp = ARENA_HALF - 1;
    playerBody.position.x = Math.max(-clamp, Math.min(clamp, playerBody.position.x));
    playerBody.position.z = Math.max(-clamp, Math.min(clamp, playerBody.position.z));
    playerMesh.position.set(playerBody.position.x, 0, playerBody.position.z);

    // === Procedural player animation (bob + tilt) — only for static meshes ===
    if (!playerPlay) {
      // No AnimationMixer → use procedural bob/tilt
      if (isMoving) {
        playerMesh.position.y = Math.sin(gameTime * 12) * 0.15;
        playerMesh.rotation.x = Math.sin(gameTime * 6) * 0.06;
      } else {
        playerMesh.position.y = Math.sin(gameTime * 2) * 0.05;
        playerMesh.rotation.x = 0;
      }
    }

    // === Auto-fire at nearest enemy ===
    if (gameTime - lastFireTime > FIRE_RATE && enemies.length > 0) {
      let nearest: any = null, nearDist = Infinity;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const d = playerMesh.position.distanceTo(e.mesh.position);
        if (d < nearDist && d < 25) { nearDist = d; nearest = e; }
      }
      if (nearest) { fireBullet(playerMesh.position, nearest.mesh.position); lastFireTime = gameTime; }
    }

    // === Update bullets ===
    for (const b of bullets) {
      if (!b.active) continue;
      b.mesh.position.add(b.vel.clone().multiplyScalar(delta));
      if (Math.abs(b.mesh.position.x) > ARENA_HALF + 5 || Math.abs(b.mesh.position.z) > ARENA_HALF + 5) {
        b.active = false; b.mesh.visible = false; continue;
      }
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (b.mesh.position.distanceTo(e.mesh.position) < 2.0) {
          b.active = false; b.mesh.visible = false;
          damageEnemy(e, b.damage, b.vel);
          break;
        }
      }
    }

    // === Update enemies (FSM) ===
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.hp <= 0) continue;
      e.stateTime += delta;
      if (e.flashTimer > 0) {
        e.flashTimer -= delta;
        if (e.flashTimer <= 0) e.mesh.traverse((c: any) => { if (c.material) c.material.emissive?.set(0x000000); });
      }
      const dist = playerMesh.position.distanceTo(e.mesh.position);
      const dir = new THREE.Vector3().subVectors(playerMesh.position, e.mesh.position).normalize();

      const prevState = e.state;
      if (e.hp / e.maxHp < 0.2 && e.state !== "flee") { e.state = "flee"; e.stateTime = 0; }
      else if (dist < 8 && e.state !== "flee" && e.state !== "attack") { e.state = "attack"; e.stateTime = 0; }
      else if (dist < 20 && e.state === "idle") { e.state = "follow"; e.stateTime = 0; }

      // Switch animation on state change
      if (e.play && e.state !== prevState) {
        switch (e.state) {
          case "idle": e.play("idle"); break;
          case "follow": case "flee": e.play("run"); break;
          case "attack": e.play("attack"); break;
        }
      }

      switch (e.state) {
        case "idle":
          if (e.stateTime > 2) {
            e.stateTime = 0;
            const a = Math.random() * Math.PI * 2;
            if (e.body) { e.body.velocity.x = Math.cos(a) * e.speed * 0.5; e.body.velocity.z = Math.sin(a) * e.speed * 0.5; }
          }
          break;
        case "follow":
          if (e.body) { e.body.velocity.x = dir.x * e.speed; e.body.velocity.z = dir.z * e.speed; }
          e.mesh.lookAt(playerMesh.position.x, e.mesh.position.y, playerMesh.position.z);
          break;
        case "attack":
          if (e.body) { e.body.velocity.x = dir.x * e.speed * 1.5; e.body.velocity.z = dir.z * e.speed * 1.5; }
          e.mesh.lookAt(playerMesh.position.x, e.mesh.position.y, playerMesh.position.z);
          if (dist < 2.5 && e.stateTime > 0.5) { hitPlayer(e.damage); e.stateTime = 0; }
          if (dist > 12) { e.state = "follow"; e.stateTime = 0; }
          break;
        case "flee":
          if (e.body) { e.body.velocity.x = -dir.x * e.speed; e.body.velocity.z = -dir.z * e.speed; }
          break;
      }
      if (e.body) e.mesh.position.set(e.body.position.x, 0, e.body.position.z);

      // === Procedural enemy animation — only for static (non-animated) meshes ===
      if (!e.play) {
        const t = gameTime + i * 1.7; // offset per enemy so they don't sync
        switch (e.state) {
          case "idle":
            e.mesh.position.y = Math.sin(t * 2) * 0.04;
            e.mesh.rotation.x = 0;
            break;
          case "follow": case "flee":
            e.mesh.position.y = Math.abs(Math.sin(t * 10)) * 0.2;
            e.mesh.rotation.x = 0.1;
            break;
          case "attack": {
            e.mesh.position.y = Math.abs(Math.sin(t * 14)) * 0.25;
            const baseS = e.mesh.userData.__baseScale || 1;
            const atkPulse = 1 + Math.sin(e.stateTime * 8) * 0.08;
            const s = baseS * atkPulse;
            e.mesh.scale.set(s, s, s);
            e.mesh.rotation.x = 0.15;
            break;
          }
        }
      } else {
        // Animated model: reset scale if it was ever modified by attack pulse
        const baseS = e.mesh.userData.__baseScale;
        if (baseS && e.state !== "attack") {
          e.mesh.scale.set(baseS, baseS, baseS);
        }
      }
    }

    // Wave clear
    const alive = enemies.filter(e => e.hp > 0).length;
    if (alive === 0 && enemies.length > 0) {
      enemies.length = 0;
      setTimeout(() => { if (!gameOver) spawnWave(); }, 2000);
    }

    // === Camera ===
    let camTX = playerMesh.position.x, camTZ = playerMesh.position.z + CAM_BACK;
    let nearE: any = null, nearED = Infinity;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const d = playerMesh.position.distanceTo(e.mesh.position);
      if (d < nearED) { nearED = d; nearE = e; }
    }
    if (nearE) {
      camTX += (nearE.mesh.position.x - playerMesh.position.x) * ENEMY_SHIFT;
      camTZ += (nearE.mesh.position.z - playerMesh.position.z) * ENEMY_SHIFT;
    }
    camera.position.x += (camTX - camera.position.x) * 5 * delta;
    camera.position.y += (CAM_HEIGHT - camera.position.y) * 5 * delta;
    camera.position.z += (camTZ - camera.position.z) * 5 * delta;
    if (shakeIntensity > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shakeIntensity;
      camera.position.z += (Math.random() - 0.5) * shakeIntensity;
      shakeIntensity *= Math.exp(-SHAKE_DECAY * delta);
    }
    camera.lookAt(playerMesh.position.x, 0, playerMesh.position.z);

    // === Collectibles ===
    for (const c of collectibles) {
      if (c.collected) continue;
      if (playerMesh.position.distanceTo(c.mesh.position) < COLLECT_DISTANCE) {
        c.collected = true; c.mesh.visible = false;
        if (c.type.startsWith("weapon_")) {
          try { playSound(soundUrl("squad-shooter/sfx/upgrade")); } catch(e) {}
          createParticleEmitter(scene, c.mesh.position.x, c.mesh.position.y, c.mesh.position.z, { preset: "sparkle", count: 10 });
        } else {
          score += c.type === "chest" ? 200 : c.type === "ring" ? 100 : 50;
          try { playSound(soundUrl("squad-shooter/sfx/coin_pickup")); } catch(e) {}
          createParticleEmitter(scene, c.mesh.position.x, c.mesh.position.y, c.mesh.position.z, { preset: "sparkle" });
        }
      }
      c.mesh.rotation.y += delta * 2;
    }

    // === Floating texts ===
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.life -= delta;
      ft.sprite.position.y += ft.vel * delta;
      if (ft.sprite.material) ft.sprite.material.opacity = Math.max(0, ft.life);
      if (ft.life <= 0) { scene.remove(ft.sprite); floatingTexts.splice(i, 1); }
    }

    hud.update({ score, lives, custom: \`Wave: \${wave}\` });
  },

  cleanup() {
    destroyKb?.(); destroyJoystick?.();
    container?.removeEventListener("pointerdown", onShoot);
  },
};

// ===== Helper Functions =====

function fireBullet(from: any, toward: any) {
  const b = bullets.find(b => !b.active);
  if (!b) return;
  b.active = true; b.mesh.visible = true;
  b.mesh.position.copy(from); b.mesh.position.y = 1;
  const dir = new THREE.Vector3().subVectors(toward, from).normalize();
  b.vel.set(dir.x * BULLET_SPEED, 0, dir.z * BULLET_SPEED);
  try { playSound(soundUrl("squad-shooter/sfx/shot")); } catch(e) {}
}

function damageEnemy(enemy: any, dmg: number, bulletVel: any) {
  enemy.hp -= dmg;
  shakeIntensity = 0.3;
  enemy.flashTimer = 0.15;
  enemy.mesh.traverse((c: any) => { if (c.material) c.material.emissive?.set(0xffffff); });
  if (enemy.body && bulletVel) {
    const kb = bulletVel.clone().normalize().multiplyScalar(3);
    enemy.body.velocity.x += kb.x; enemy.body.velocity.z += kb.z;
  }
  const { sprite } = createText3D(\`-\${dmg}\`, { x: enemy.mesh.position.x, y: 2.5, z: enemy.mesh.position.z }, { color: "#ff4444", size: 0.6 });
  if (sprite) { if (sprite.material) sprite.material.transparent = true; floatingTexts.push({ sprite, vel: 2, life: 0.8 }); }
  try { playSound(soundUrl("squad-shooter/sfx/enemy_hit_1")); } catch(e) {}
  createParticleEmitter(scene, enemy.mesh.position.x, 1, enemy.mesh.position.z, { preset: "explosion", count: 6, lifetime: 0.3 });

  if (enemy.hp <= 0) {
    score += enemy.isBoss ? 500 : 100;
    try { playSound(soundUrl("squad-shooter/sfx/explosion")); } catch(e) {}
    createParticleEmitter(scene, enemy.mesh.position.x, 1, enemy.mesh.position.z, { preset: "explosion", count: 15, lifetime: 0.5 });
    // Remove mixer from auto-update array to prevent memory leak
    const mixer = enemy.mesh.userData.__mixer;
    if (mixer) {
      mixer.stopAllAction();
      const arr = (window as any)._activeMixers3D;
      if (arr) { const idx = arr.indexOf(mixer); if (idx >= 0) arr.splice(idx, 1); }
    }
    scene.remove(enemy.mesh);
    if (enemy.body && world) world.removeBody(enemy.body);
  }
}

function hitPlayer(dmg: number) {
  lives -= 1;
  shakeIntensity = 0.5;
  try { playSound(soundUrl("squad-shooter/sfx/player_hit")); } catch(e) {}
  if (playerMesh) {
    playerMesh.traverse((c: any) => { if (c.material) c.material.emissive?.set(0xff0000); });
    setTimeout(() => { playerMesh?.traverse((c: any) => { if (c.material) c.material.emissive?.set(0x000000); }); }, 150);
  }
  if (lives <= 0) {
    gameOver = true;
    import("../scenes/GameOverScene3D").then(m => m.showGameOver(container, score, () => { window.location.reload(); }));
  }
}

function onShoot(e: PointerEvent) {
  if (gameOver || !playerMesh) return;
}

async function spawnWave() {
  wave++;
  difficulty = 1 + (wave - 1) * 0.15;
  const baseCount = 3 + wave * 2;
  const isBossWave = wave % 5 === 0;
  const availableTiers = ENEMY_TIERS.filter(t => wave >= t.minWave);

  for (let i = 0; i < baseCount; i++) {
    if (arenaSpawnPoints.length === 0) break;
    const sp = arenaSpawnPoints[Math.floor(Math.random() * arenaSpawnPoints.length)];
    const sx = sp.x + (Math.random() - 0.5) * 2;
    const sz = sp.z + (Math.random() - 0.5) * 2;
    const isThisBoss = isBossWave && i === 0;

    try {
      let mesh: any, hp: number, speed: number, dmg: number;
      if (isThisBoss) {
        const bm = BOSS_MODELS[Math.floor(Math.random() * BOSS_MODELS.length)];
        mesh = await loadModel(\`characters/enemies/\${bm}\`, true);
        scaleToHeight(mesh, BOSS_HEIGHT);
        hp = 200 * difficulty; speed = 1.5; dmg = 3;
        try { playSound(soundUrl("squad-shooter/sfx/boss_scream")); } catch(e) {}
      } else {
        const tier = availableTiers[Math.floor(Math.random() * availableTiers.length)];
        const mn = tier.models[Math.floor(Math.random() * tier.models.length)];
        mesh = await loadModel(\`characters/enemies/\${mn}\`, true);
        scaleToHeight(mesh, ENEMY_HEIGHT);
        hp = tier.hp * difficulty; speed = tier.speed + wave * 0.1; dmg = tier.damage;
      }

      // Save base scale for procedural animations
      mesh.userData.__baseScale = mesh.scale.x;
      mesh.position.set(sx, 0, sz);
      enableShadows(mesh, true, false);
      scene.add(mesh);
      const body = createPhysicsBody("box", 3, { x: sx, y: 1.0, z: sz }, { x: 0.5, y: 1.0, z: 0.5 });
      if (body) { body.linearDamping = 0.9; body.fixedRotation = true; }
      if (world && body) world.addBody(body);

      enemies.push({
        mesh, body, hp, maxHp: hp,
        state: "idle", stateTime: 0,
        speed, damage: dmg,
        isBoss: isThisBoss, flashTimer: 0,
        play: mesh.userData.__play || undefined,
      });
    } catch (e) { console.warn("[3D] Enemy load failed:", e); }
  }
  hud.update({ score, custom: \`Wave: \${wave} | HP: \${lives}\` });
}
`;
