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
 * Example: modelUrl("kaykit-platformer", "Assets/gltf/platform_4x4x1.gltf")
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

// ===== SCALE PRESETS for KayKit models =====
// KayKit GLTF models are small by default (~1 unit). These scales work well
// for a typical game camera at distance 10-20.
export const SCALES_3D = {
  // Platforms
  platform: 1.0,
  platformLarge: 1.5,
  platformSmall: 0.7,
  // Characters
  player: 0.8,
  enemy: 0.8,
  skeleton: 1.0,
  animatedCharacter: 0.15, // targetHeight for createAnimatedCharacter3D (world units) — bone deformation expands ~100x at render
  // Collectibles
  collectible: 0.5,
  coin: 0.4,
  gem: 0.5,
  // Environment
  tree: 1.2,
  bush: 0.6,
  rock: 0.8,
  cloud: 1.5,
  // Buildings (city builder)
  building: 1.0,
  vehicle: 0.6,
  road: 1.0,
  // Resources
  barrel: 0.5,
  ore: 0.4,
  wood: 0.5,
};

// ===== Common Game Constants =====
export const TOUCH_DEADZONE = 0.15;   // Joystick deadzone (0-1 range)
export const GRAVITY_3D = -20;         // Default gravity for cannon-es
export const JUMP_FORCE = 8;           // Default jump velocity
export const MOVE_SPEED = 5;           // Default movement speed

// Camera follow constants (3rd-person platformer defaults)
export const CAMERA_OFFSET_Y = 8;      // Height above player
export const CAMERA_OFFSET_Z = 12;     // Distance behind player
export const CAMERA_LERP = 3;          // Smoothing speed (higher = faster)
export const CAMERA_LOOK_Y = 1;        // Look-at Y offset above player
// Common AI aliases — prevent "undefined" crashes
export const CAMERA_LOOK_AHEAD = 5;    // Forward offset for camera look target
export const CAMERA_DISTANCE = CAMERA_OFFSET_Z;
export const CAMERA_HEIGHT = CAMERA_OFFSET_Y;
export const CAMERA_SMOOTH = 0.1;

// Collision / pickup distances
export const COLLECT_DISTANCE = 1.5;   // Distance to pick up collectibles
export const PLATFORM_GAP = 4;         // Default gap between platforms

// ===== Scene3D base class =====
// AI agents frequently write "extends Scene3D" when creating game scenes.
// This provides the base class so that pattern works without errors.
// Methods are called by Game3D.tsx: init() on mount, update(dt) per frame, cleanup() on unmount.
export class Scene3D {
  scene: any;
  camera: any;
  renderer: any;
  world: any;
  init() {}
  update(_dt: number) {}
  cleanup() {}
}

// ===== Globals — prevent "undefined" crashes when AI forgets to import =====
// AI models frequently use these constants without importing them.
// Assigning to window makes them available as globals in the Sandpack env.
Object.assign(window, {
  SCALES_3D, TOUCH_DEADZONE, GRAVITY_3D, JUMP_FORCE, MOVE_SPEED,
  CAMERA_OFFSET_Y, CAMERA_OFFSET_Z, CAMERA_LERP, CAMERA_LOOK_Y,
  CAMERA_LOOK_AHEAD, CAMERA_DISTANCE, CAMERA_HEIGHT, CAMERA_SMOOTH,
  COLLECT_DISTANCE, PLATFORM_GAP, Scene3D,
  createPlatform3D, createCollectible3D, createPlayer3D, createBarrier3D, createDecoration3D,
  createAnimatedCharacter3D, createCharacterController3D, createText3D,
  createPhysicsWorld, createPhysicsBody, createPhysicsGround, syncBodiesToMeshes, createContactMaterial,
  createGround3D, createSkyGradient, checkCollision, checkBoxCollision, createHUD,
  createKeyboardState, createTouchJoystick, createTapDetector, createSwipeDetector,
  createAnimationPlayer, createOrbitControls, onClickObject,
  loadGLTF, modelUrl, initRenderer, initScene, initCamera,
  THREE, CANNON,
});

// ===== Renderer =====

/**
 * Creates a WebGLRenderer sized to fill the container.
 * Handles window resize automatically.
 */
export function initRenderer(container: HTMLDivElement): typeof THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
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
 */
export function initScene(): typeof THREE.Scene {
  const scene = new THREE.Scene();

  // Ambient fill light
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  // Directional sun light with shadows
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(10, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);

  return scene;
}

// ===== Camera =====

/**
 * Creates a PerspectiveCamera that auto-updates aspect ratio on resize.
 */
export function initCamera(
  container: HTMLDivElement,
  fov: number = 60,
  near: number = 0.1,
  far: number = 1000,
): typeof THREE.PerspectiveCamera {
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
 *   const model = await loadGLTF(modelUrl("kaykit-platformer", "Assets/gltf/platform_4x4x1.gltf"));
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

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    base.setPointerCapture(e.pointerId);
    const rect = base.getBoundingClientRect();
    startX = rect.left + HALF;
    startY = rect.top + HALF;
    state.active = true;
    thumb.style.background = "rgba(255,255,255,0.7)";
  }

  function onPointerMove(e: PointerEvent) {
    if (!state.active) return;
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > HALF) { dx = (dx / dist) * HALF; dy = (dy / dist) * HALF; }
    state.x = dx / HALF;
    state.y = -dy / HALF; // Invert Y so up = positive
    thumb.style.transform = \`translate(calc(-50% + \${dx}px), calc(-50% + \${dy}px))\`;
  }

  function onPointerUp() {
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
 * Returns cleanup function.
 */
export function createTapDetector(
  container: HTMLElement,
  onTap: (x: number, y: number, isLeft: boolean) => void,
): () => void {
  let startTime = 0;
  let startX = 0;
  let startY = 0;

  function onDown(e: PointerEvent) {
    startTime = Date.now();
    startX = e.clientX;
    startY = e.clientY;
  }

  function onUp(e: PointerEvent) {
    const dt = Date.now() - startTime;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    // Tap = short press + small movement
    if (dt < 300 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
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
  threshold: number = 30,
): () => void {
  let startX = 0;
  let startY = 0;

  function onDown(e: PointerEvent) {
    startX = e.clientX;
    startY = e.clientY;
  }

  function onUp(e: PointerEvent) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
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

// ===== ANIMATION MIXER AUTO-UPDATE =====
// All animation mixers created by createAnimatedCharacter3D are tracked here.
// Game3D.tsx calls _updateAllMixers3D(delta) every frame — AI never needs to worry about it.
const _activeMixers3D: any[] = [];
function _updateAllMixers3D(delta: number) {
  for (const m of _activeMixers3D) m.update(delta);
}
(window as any)._updateAllMixers3D = _updateAllMixers3D;

// Auto-update character controllers — Game3D.tsx calls this every frame.
// Even if the AI forgets to call controller.update(delta) in its update loop,
// the framework still handles animation state transitions automatically.
const _activeControllers3D: Array<{ update: (delta: number) => void }> = [];
function _updateAllControllers3D(delta: number) {
  for (const ctrl of _activeControllers3D) ctrl.update(delta);
}
(window as any)._activeControllers3D = _activeControllers3D;
(window as any)._updateAllControllers3D = _updateAllControllers3D;

// ===== 3D FACTORY HELPERS — Force GLTF model loading =====
// These make it EASIER to use real KayKit models than to write raw geometry.
// Each factory: build URL → load GLTF (cached) → scale → position → add to scene → return {mesh, size}.
// "size" = half-extents that plug directly into createPhysicsBody("box", mass, pos, size).

const _modelCache3D: Map<string, any> = new Map();

async function _loadOrClone(url: string): Promise<any> {
  url = _autoCorrectModelUrl(url); // Normalize URL before cache lookup
  if (_modelCache3D.has(url)) {
    return _modelCache3D.get(url)!.clone();
  }
  const model = await loadGLTF(url);
  console.log("[3D] Loaded GLTF:", url);
  _modelCache3D.set(url, model);
  return model.clone();
}

function _colorModelUrl(name: string, color: string): string {
  return modelUrl("kaykit-platformer", \`Assets/gltf/\${color}/\${name}_\${color}.gltf\`);
}

function _neutralModelUrl(name: string): string {
  return modelUrl("kaykit-platformer", \`Assets/gltf/neutral/\${name}.gltf\`);
}

function _fallbackBox(w: number, h: number, d: number, color: number): any {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Valid pre-manufactured KayKit model variants (DO NOT add custom ones — they won't exist on disk)
const _VALID_PLATFORMS = ["1x1x1","2x2x1","2x2x2","2x2x4","4x2x1","4x2x2","4x2x4","4x4x1","4x4x2","4x4x4","6x2x1","6x2x2","6x2x4","6x6x1","6x6x2","6x6x4"];
const _VALID_BARRIERS = ["1x1x1","1x1x2","1x1x4","2x1x1","2x1x2","2x1x4","3x1x1","3x1x2","3x1x4","4x1x1","4x1x2","4x1x4"];

/**
 * Auto-correct invalid platform/barrier variant names in kaykit-platformer URLs.
 * Belt-and-suspenders safety net: even if AI bypasses factory helpers and constructs
 * URLs manually with arbitrary dimensions (e.g. "platform_8x4x1_red.gltf"), this
 * function snaps them to the nearest valid model file that actually exists on disk.
 */
function _autoCorrectModelUrl(url: string): string {
  const idx = url.indexOf("kaykit-platformer/Assets/gltf/");
  if (idx < 0) return url;

  const afterPack = url.substring(idx + "kaykit-platformer/Assets/gltf/".length);
  const parts = afterPack.split("/");
  if (parts.length !== 2) return url;

  const color = parts[0];
  const filename = parts[1]; // e.g. "platform_8x4x1_red.gltf"
  if (color === "neutral") return url; // neutral paths don't have color suffix

  const suffix = \`_\${color}.gltf\`;
  if (!filename.endsWith(suffix)) return url;
  const baseName = filename.slice(0, -suffix.length); // e.g. "platform_8x4x1"

  if (baseName.startsWith("platform_")) {
    const variant = baseName.slice("platform_".length);
    const snapped = _snapVariant(variant, _VALID_PLATFORMS);
    if (snapped !== variant) {
      return url.substring(0, url.lastIndexOf("/") + 1) + \`platform_\${snapped}_\${color}.gltf\`;
    }
  } else if (baseName.startsWith("barrier_")) {
    const variant = baseName.slice("barrier_".length);
    const snapped = _snapVariant(variant, _VALID_BARRIERS);
    if (snapped !== variant) {
      return url.substring(0, url.lastIndexOf("/") + 1) + \`barrier_\${snapped}_\${color}.gltf\`;
    }
  }

  return url;
}

function _snapVariant(variant: string, validList: string[]): string {
  if (validList.includes(variant)) return variant;
  // Parse requested dims and find closest valid variant by total volume
  const rp = variant.split("x").map(Number);
  const rVol = (rp[0]||4) * (rp[1]||4) * (rp[2]||1);
  let best = validList[0], bestDiff = Infinity;
  for (const v of validList) {
    const vp = v.split("x").map(Number);
    const diff = Math.abs(vp[0]*vp[1]*vp[2] - rVol);
    if (diff < bestDiff) { bestDiff = diff; best = v; }
  }
  console.warn(\`[3D] Invalid variant "\${variant}" → snapped to "\${best}"\`);
  return best;
}

// Parse "4x4x1" → {w:4, d:4, h:1}. Naming convention: WxDxH
function _parseDims(variant: string): { w: number; d: number; h: number } {
  const parts = variant.split("x").map(Number);
  return { w: parts[0] || 4, d: parts[1] || 4, h: parts[2] || 1 };
}

/**
 * Creates a KayKit platform tile at (x, y, z).
 * Returns { mesh, size } — size = half-extents for createPhysicsBody().
 *
 * Usage:
 *   const { mesh, size } = await createPlatform3D(scene, 0, 1, -5);
 *   const body = createPhysicsBody("box", 0, {x:0, y:1, z:-5}, size);
 *   world.addBody(body);
 */
export async function createPlatform3D(
  scene: any, x: number, y: number, z: number,
  opts?: { variant?: string; color?: string; scale?: number },
): Promise<{ mesh: any; size: { x: number; y: number; z: number } }> {
  const variant = _snapVariant(opts?.variant || "4x4x1", _VALID_PLATFORMS);
  const color = opts?.color || "blue";
  const scale = opts?.scale || SCALES_3D.platform;
  const dims = _parseDims(variant);
  const halfExtents = { x: (dims.w * scale) / 2, y: (dims.h * scale) / 2, z: (dims.d * scale) / 2 };

  let mesh: any;
  try {
    const url = _colorModelUrl(\`platform_\${variant}\`, color);
    mesh = await _loadOrClone(url);
    mesh.scale.setScalar(scale);
  } catch (err) {
    console.warn("[3D] createPlatform3D fallback — failed to load:", \`platform_\${variant}_\${color}\`, err);
    mesh = _fallbackBox(dims.w * scale, dims.h * scale, dims.d * scale, 0x4488cc);
  }
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { mesh, size: halfExtents };
}

/**
 * Creates a KayKit collectible (diamond, star, heart, ball) at (x, y, z).
 * Returns { mesh, size } for optional collision distance.
 *
 * Usage:
 *   const { mesh } = await createCollectible3D(scene, 3, 2, -8, { type: "star" });
 */
export async function createCollectible3D(
  scene: any, x: number, y: number, z: number,
  opts?: { type?: string; color?: string; scale?: number },
): Promise<{ mesh: any; size: { x: number; y: number; z: number } }> {
  const type = opts?.type || "diamond";
  const color = opts?.color || "blue";
  const scale = opts?.scale || SCALES_3D.collectible;
  const halfSize = scale * 0.5;

  let mesh: any;
  try {
    const url = _colorModelUrl(type, color);
    mesh = await _loadOrClone(url);
    mesh.scale.setScalar(scale);
  } catch (err) {
    console.warn("[3D] createCollectible3D fallback — failed to load:", \`\${type}_\${color}\`, err);
    mesh = _fallbackBox(scale, scale, scale, 0xffdd44);
    mesh.material.emissive = new THREE.Color(0xffdd44);
    mesh.material.emissiveIntensity = 0.3;
  }
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  scene.add(mesh);
  return { mesh, size: { x: halfSize, y: halfSize, z: halfSize } };
}

/**
 * Creates a KayKit player/character model at (x, y, z).
 * Default: "ball" (blue) — a good all-purpose player visual.
 * Returns { mesh, size } for physics body sizing.
 *
 * Usage:
 *   const { mesh, size } = await createPlayer3D(scene, 0, 2, 0);
 *   const body = createPhysicsBody("sphere", 5, {x:0, y:2, z:0}, size.x);
 */
export async function createPlayer3D(
  scene: any, x: number, y: number, z: number,
  opts?: { model?: string; color?: string; scale?: number; neutral?: boolean },
): Promise<{ mesh: any; size: { x: number; y: number; z: number } }> {
  const model = opts?.model || "ball";
  const color = opts?.color || "blue";
  const scale = opts?.scale || SCALES_3D.player;
  const halfSize = scale * 0.6;

  let mesh: any;
  try {
    const url = opts?.neutral ? _neutralModelUrl(model) : _colorModelUrl(model, color);
    mesh = await _loadOrClone(url);
    mesh.scale.setScalar(scale);
  } catch (err) {
    console.warn("[3D] createPlayer3D fallback — failed to load:", \`\${model}_\${color}\`, err);
    mesh = _fallbackBox(scale, scale * 1.5, scale, 0x4488ff);
  }
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  scene.add(mesh);
  return { mesh, size: { x: halfSize, y: halfSize, z: halfSize } };
}

/**
 * Creates a KayKit barrier/wall at (x, y, z).
 * Returns { mesh, size } for physics body.
 *
 * Usage:
 *   const { mesh, size } = await createBarrier3D(scene, 5, 0.5, -10, { variant: "3x1x4" });
 */
export async function createBarrier3D(
  scene: any, x: number, y: number, z: number,
  opts?: { variant?: string; color?: string; scale?: number; neutral?: boolean },
): Promise<{ mesh: any; size: { x: number; y: number; z: number } }> {
  const variant = _snapVariant(opts?.variant || "2x1x2", _VALID_BARRIERS);
  const color = opts?.color || "blue";
  const scale = opts?.scale || 1.0;
  const neutral = opts?.neutral ?? false;
  const dims = _parseDims(variant);
  const halfExtents = { x: (dims.w * scale) / 2, y: (dims.h * scale) / 2, z: (dims.d * scale) / 2 };

  let mesh: any;
  try {
    const url = neutral
      ? _neutralModelUrl(\`barrier_\${variant}\`)
      : _colorModelUrl(\`barrier_\${variant}\`, color);
    mesh = await _loadOrClone(url);
    mesh.scale.setScalar(scale);
  } catch (err) {
    console.warn("[3D] createBarrier3D fallback — failed to load:", \`barrier_\${variant}\`, err);
    mesh = _fallbackBox(dims.w * scale, dims.h * scale, dims.d * scale, 0x996633);
  }
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { mesh, size: halfExtents };
}

/**
 * Creates a KayKit decoration (pillar, floor, structure, sign, spring, etc.) at (x, y, z).
 * Neutral by default (most decorations are neutral-only).
 *
 * Usage:
 *   const { mesh } = await createDecoration3D(scene, -5, 0, -8, { type: "pillar_2x2x4" });
 *   const { mesh } = await createDecoration3D(scene, 3, 0, -12, { type: "structure_A" });
 */
export async function createDecoration3D(
  scene: any, x: number, y: number, z: number,
  opts?: { type?: string; color?: string; scale?: number; neutral?: boolean },
): Promise<{ mesh: any; size: { x: number; y: number; z: number } }> {
  const type = opts?.type || "pillar_2x2x4";
  const color = opts?.color || "blue";
  const scale = opts?.scale || 1.0;
  const neutral = opts?.neutral ?? true;

  let mesh: any;
  try {
    const url = neutral ? _neutralModelUrl(type) : _colorModelUrl(type, color);
    mesh = await _loadOrClone(url);
    mesh.scale.setScalar(scale);
  } catch (err) {
    console.warn("[3D] createDecoration3D fallback — failed to load:", type, err);
    mesh = _fallbackBox(scale * 2, scale * 4, scale * 2, 0x888888);
  }
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
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
  mesh.add(pivot);
  mesh.position.set(x, y, z);
  if (opts.rotation !== undefined) mesh.rotation.y = opts.rotation;
  scene.add(mesh);

  // Physics half-extents based on target height
  const halfExtents = { x: targetHeight * 0.3, y: targetHeight / 2, z: targetHeight * 0.3 };
  console.log("[3D] Character final: targetH=" + targetHeight + ", autoScale=" + autoScale.toFixed(3) + ", boneDeformed=" + usedBoneTransform);

  // --- Strip root motion + scale tracks from animation clips ---
  const allClips = gltf.animations || [];
  for (const clip of allClips) {
    for (let ti = clip.tracks.length - 1; ti >= 0; ti--) {
      const track = clip.tracks[ti];
      const isPos = track.name.endsWith(".position");
      const isScale = track.name.endsWith(".scale");
      if (!isPos && !isScale) continue;
      const suffix = isPos ? ".position" : ".scale";
      const nodePath = track.name.replace(suffix, "");
      const depth = nodePath === "" ? 0 : nodePath.split("/").length;
      if (depth === 0) {
        // Scene root — remove entirely (prevents overriding our autoScale or position)
        clip.tracks.splice(ti, 1);
      } else if (isPos && depth <= 2) {
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

    // Check if grounded
    const isGrounded = (physicsBody as any).__canJump !== false;
    const isRising = physicsBody.velocity.y > 2;

    // State machine
    let newState = state;
    if (!isGrounded && isRising) {
      newState = "jump";
    } else if (hSpeed > RUN_SPEED) {
      newState = "run";
    } else if (hSpeed > WALK_SPEED) {
      newState = "walk";
    } else {
      newState = "idle";
    }

    if (newState !== state) {
      state = newState;
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

      // Create renderer
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      container.appendChild(renderer.domElement);

      // Create camera
      const aspect = container.clientWidth / container.clientHeight;
      camera = new THREE.PerspectiveCamera(cameraFov, aspect, 0.1, 1000);
      camera.position.set(0, 8, 15);
      camera.lookAt(0, 2, 0);

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
        scene.background = new THREE.Color(bgColor);

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
        const world = createPhysicsWorld(GRAVITY_3D);
        if (world) createPhysicsGround(world);

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

        if (disposed) return;
        loading.setProgress(1);
        renderer.render(scene, camera);
        loading.remove();

        await new Promise<void>((resolve) => {
          if (disposed) { resolve(); return; }
          createMenuOverlay(container, resolve);
        });

        if (disposed) return;

        clock.start();
        const animate = () => {
          if (disposed) return;
          animFrameId = requestAnimationFrame(animate);
          const delta = clock.getDelta();
          // Auto-update all animation mixers (from createAnimatedCharacter3D)
          (window as any)._updateAllMixers3D?.(delta);
          try { gameScene.update(delta); } catch (_e) { /* AI code error — keep rendering */ }
          // Auto-update character controllers AFTER gameScene.update() — this reads
          // the velocity/position set by AI code and auto-switches idle/walk/run/jump.
          // Works as safety net even if AI doesn't call controller.update() itself.
          (window as any)._updateAllControllers3D?.(delta);
          renderer.render(scene, camera);
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
 * 3D Game Scene — CUSTOMIZE THIS FILE for your game!
 *
 * ALL game objects MUST use factory helpers from assets-3d.ts:
 *   createPlatform3D, createCollectible3D, createPlayer3D,
 *   createBarrier3D, createDecoration3D, createText3D
 * These load real KayKit GLTF 3D models with correct URLs and caching.
 * Do NOT use raw THREE.BoxGeometry or THREE.SphereGeometry for visible objects.
 */
import {
  createPlatform3D, createCollectible3D, createPlayer3D,
  createBarrier3D, createDecoration3D, createAnimatedCharacter3D,
  createText3D, createPhysicsBody, syncBodiesToMeshes, createKeyboardState,
  createGround3D, createSkyGradient, createHUD,
  CAMERA_OFFSET_Y, CAMERA_OFFSET_Z, CAMERA_LERP, CAMERA_LOOK_Y,
  COLLECT_DISTANCE, JUMP_FORCE, loadGLTF, SCALES_3D,
} from "../config/assets-3d";
import { modelUrl } from "../utils/media-stock-3d";

const THREE = (window as any).THREE;
const CANNON = (window as any).CANNON;

// ===== Game State =====
let scene: any, camera: any, renderer: any;
let player: any, playerBody: any, world: any;
let hud: any, keys: any, destroyKb: () => void;
const platforms: { mesh: any; body: any }[] = [];
const items: { mesh: any; collected: boolean }[] = [];
let score = 0;

export const GameScene = {
  world: null as any,

  async init(_scene: any, _camera: any, _renderer: any, container: HTMLDivElement, onProgress?: (p: number) => void) {
    scene = _scene; camera = _camera; renderer = _renderer;
    world = this.world;

    // Sky gradient + ground plane
    createSkyGradient(scene, 0x87CEEB, 0xE0F0FF);
    createGround3D(scene, 100, 0x88BB66);
    onProgress?.(0.1);

    // ===== PLATFORMS — createPlatform3D loads KayKit GLTF models =====
    const platPositions: [number, number, number][] = [
      [0, 0.5, 0], [5, 1, -6], [-4, 1.5, -12], [3, 2, -18], [-2, 2.5, -24],
      [6, 3, -30], [0, 3.5, -36],
    ];
    const colors = ["blue", "green", "red", "yellow"] as const;
    for (let i = 0; i < platPositions.length; i++) {
      const [x, y, z] = platPositions[i];
      const { mesh, size } = await createPlatform3D(scene, x, y, z, {
        variant: "4x4x1", color: colors[i % 4],
      });
      const body = createPhysicsBody("box", 0, { x, y, z }, size);
      if (world && body) world.addBody(body);
      platforms.push({ mesh, body });
    }
    onProgress?.(0.3);

    // ===== PLAYER — createPlayer3D loads KayKit character model =====
    const { mesh: pm, size: ps } = await createPlayer3D(scene, 0, 3, 0, { color: "blue" });
    player = pm;
    playerBody = createPhysicsBody("sphere", 5, { x: 0, y: 3, z: 0 }, ps.x);
    if (playerBody) {
      playerBody.linearDamping = 0.9;
      playerBody.angularDamping = 1.0;
      playerBody.fixedRotation = true;
    }
    if (world && playerBody) world.addBody(playerBody);
    onProgress?.(0.5);

    // ===== COLLECTIBLES — createCollectible3D loads KayKit diamond/star models =====
    const itemTypes = ["diamond", "star", "heart"] as const;
    for (let i = 0; i < platPositions.length - 2; i++) {
      const [x, , z] = platPositions[i + 1];
      const { mesh } = await createCollectible3D(scene, x, 3 + i * 0.5, z, {
        type: itemTypes[i % 3], color: "yellow",
      });
      items.push({ mesh, collected: false });
    }
    onProgress?.(0.7);

    // ===== BARRIERS — createBarrier3D loads KayKit wall models =====
    await createBarrier3D(scene, 2, 1, -9, { variant: "2x1x4", color: "red" });
    await createBarrier3D(scene, -3, 2, -21, { variant: "3x1x2", color: "red" });
    onProgress?.(0.8);

    // ===== DECORATIONS — createDecoration3D loads KayKit pillars/structures =====
    await createDecoration3D(scene, -8, 0, -5, { type: "pillar_2x2x4" });
    await createDecoration3D(scene, 10, 0, -20, { type: "structure_A" });
    onProgress?.(0.9);

    // HUD + keyboard
    hud = createHUD(container);
    hud.update({ score: 0 });
    const kb = createKeyboardState();
    keys = kb.keys;
    destroyKb = kb.destroy;

    // Jump detection
    playerBody.addEventListener("collide", (e: any) => {
      if (e.contact.ni.y > 0.5) (playerBody as any).__canJump = true;
    });
    onProgress?.(1);
  },

  update(delta: number) {
    if (!player || !world) return;
    world.step(1 / 60, delta, 3);

    // Player movement — VELOCITY-BASED (instant, responsive, no sliding)
    const SPEED = 5;
    const vx = ((keys.ArrowRight || keys.KeyD) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyA) ? 1 : 0);
    const vz = ((keys.ArrowDown || keys.KeyS) ? 1 : 0) - ((keys.ArrowUp || keys.KeyW) ? 1 : 0);
    if (vx !== 0 || vz !== 0) {
      const len = Math.sqrt(vx * vx + vz * vz);
      playerBody.velocity.x = (vx / len) * SPEED;
      playerBody.velocity.z = (vz / len) * SPEED;
    }
    if (keys.Space && (playerBody as any).__canJump) {
      playerBody.velocity.y = JUMP_FORCE;
      (playerBody as any).__canJump = false;
    }

    // Sync physics → meshes
    player.position.copy(playerBody.position);
    player.quaternion.copy(playerBody.quaternion);
    syncBodiesToMeshes(platforms);

    // Camera follow
    camera.position.x += (player.position.x - camera.position.x) * CAMERA_LERP * delta;
    camera.position.y += (player.position.y + CAMERA_OFFSET_Y - camera.position.y) * CAMERA_LERP * delta;
    camera.position.z += (player.position.z + CAMERA_OFFSET_Z - camera.position.z) * CAMERA_LERP * delta;
    camera.lookAt(player.position.x, player.position.y + CAMERA_LOOK_Y, player.position.z);

    // Collect items
    for (const c of items) {
      if (!c.collected && player.position.distanceTo(c.mesh.position) < COLLECT_DISTANCE) {
        c.collected = true;
        c.mesh.visible = false;
        score++;
        hud.update({ score });
      }
      if (!c.collected) c.mesh.rotation.y += delta * 2;
    }

    // Fall off world = reset
    if (player.position.y < -10) {
      playerBody.position.set(0, 5, 0);
      playerBody.velocity.set(0, 0, 0);
    }
  },

  cleanup() {
    destroyKb?.();
  },
};
`;

/**
 * Character-aware variant of GAME_3D_SCENE_STARTER.
 * Uses createAnimatedCharacter3D + createCharacterController3D instead of createPlayer3D.
 * Injected when warrior/knight/fighter keywords are detected.
 */
export const GAME_3D_SCENE_STARTER_CHARACTER = `/**
 * 3D Game Scene — CUSTOMIZE THIS FILE for your game!
 *
 * Uses animated character (warrior) with createCharacterController3D
 * for automatic animation state management (idle/walk/run/jump/attack).
 */
import {
  createPlatform3D, createCollectible3D,
  createBarrier3D, createDecoration3D, createAnimatedCharacter3D,
  createCharacterController3D, createText3D,
  createPhysicsBody, syncBodiesToMeshes, createKeyboardState,
  createGround3D, createSkyGradient, createHUD,
  CAMERA_OFFSET_Y, CAMERA_OFFSET_Z, CAMERA_LERP, CAMERA_LOOK_Y,
  COLLECT_DISTANCE, JUMP_FORCE, loadGLTF, SCALES_3D,
} from "../config/assets-3d";
import { modelUrl } from "../utils/media-stock-3d";

const THREE = (window as any).THREE;
const CANNON = (window as any).CANNON;

// ===== Game State =====
let scene: any, camera: any, renderer: any;
let player: any, playerBody: any, world: any;
let controller: any;
let hud: any, keys: any, destroyKb: () => void;
const platforms: { mesh: any; body: any }[] = [];
const items: { mesh: any; collected: boolean }[] = [];
let score = 0;

export const GameScene = {
  world: null as any,

  async init(_scene: any, _camera: any, _renderer: any, container: HTMLDivElement, onProgress?: (p: number) => void) {
    scene = _scene; camera = _camera; renderer = _renderer;
    world = this.world;

    // Sky gradient + ground plane
    createSkyGradient(scene, 0x87CEEB, 0xE0F0FF);
    createGround3D(scene, 100, 0x88BB66);
    onProgress?.(0.1);

    // ===== PLATFORMS =====
    const platPositions: [number, number, number][] = [
      [0, 0.5, 0], [5, 1, -6], [-4, 1.5, -12], [3, 2, -18], [-2, 2.5, -24],
      [6, 3, -30], [0, 3.5, -36],
    ];
    const colors = ["blue", "green", "red", "yellow"] as const;
    for (let i = 0; i < platPositions.length; i++) {
      const [x, y, z] = platPositions[i];
      const { mesh, size } = await createPlatform3D(scene, x, y, z, {
        variant: "4x4x1", color: colors[i % 4],
      });
      const body = createPhysicsBody("box", 0, { x, y, z }, size);
      if (world && body) world.addBody(body);
      platforms.push({ mesh, body });
    }
    onProgress?.(0.3);

    // ===== ANIMATED CHARACTER (warrior) =====
    const warrior = await createAnimatedCharacter3D(scene, 0, 3, 0, {
      url: modelUrl("meshy-characters", "Warrior_figure_Animations.glb"),
    });
    player = warrior.mesh;
    playerBody = createPhysicsBody("box", 5, { x: 0, y: 3, z: 0 }, warrior.size);
    if (playerBody) {
      playerBody.linearDamping = 0.9; // Stop quickly when no input (prevents infinite sliding)
      playerBody.angularDamping = 1.0; // Prevent unwanted rotation
      playerBody.fixedRotation = true; // Controller handles facing direction
    }
    if (world && playerBody) world.addBody(playerBody);

    // Character controller — auto-manages idle/walk/run/jump/attack animations
    controller = createCharacterController3D(warrior, playerBody);
    onProgress?.(0.5);

    // ===== COLLECTIBLES =====
    const itemTypes = ["diamond", "star", "heart"] as const;
    for (let i = 0; i < platPositions.length - 2; i++) {
      const [x, , z] = platPositions[i + 1];
      const { mesh } = await createCollectible3D(scene, x, 3 + i * 0.5, z, {
        type: itemTypes[i % 3], color: "yellow",
      });
      items.push({ mesh, collected: false });
    }
    onProgress?.(0.7);

    // ===== BARRIERS =====
    await createBarrier3D(scene, 2, 1, -9, { variant: "2x1x4", color: "red" });
    await createBarrier3D(scene, -3, 2, -21, { variant: "3x1x2", color: "red" });
    onProgress?.(0.8);

    // ===== DECORATIONS =====
    await createDecoration3D(scene, -8, 0, -5, { type: "pillar_2x2x4" });
    await createDecoration3D(scene, 10, 0, -20, { type: "structure_A" });
    onProgress?.(0.9);

    // HUD + keyboard
    hud = createHUD(container);
    hud.update({ score: 0 });
    const kb = createKeyboardState();
    keys = kb.keys;
    destroyKb = kb.destroy;

    // Jump detection
    playerBody.addEventListener("collide", (e: any) => {
      if (e.contact.ni.y > 0.5) (playerBody as any).__canJump = true;
    });
    onProgress?.(1);
  },

  update(delta: number) {
    if (!player || !world) return;
    world.step(1 / 60, delta, 3);

    // Player movement — VELOCITY-BASED for instant, responsive walking
    // (Force-based movement is sluggish and causes sliding)
    const SPEED = 5;
    const vx = ((keys.ArrowRight || keys.KeyD) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyA) ? 1 : 0);
    const vz = ((keys.ArrowDown || keys.KeyS) ? 1 : 0) - ((keys.ArrowUp || keys.KeyW) ? 1 : 0);
    if (vx !== 0 || vz !== 0) {
      // Normalize diagonal movement
      const len = Math.sqrt(vx * vx + vz * vz);
      playerBody.velocity.x = (vx / len) * SPEED;
      playerBody.velocity.z = (vz / len) * SPEED;
    }
    if (keys.Space && (playerBody as any).__canJump) {
      playerBody.velocity.y = JUMP_FORCE;
      (playerBody as any).__canJump = false;
      controller.jump();
    }

    // Controller handles: mesh sync, facing direction, animation states
    controller.update(delta);

    // Sync platforms
    syncBodiesToMeshes(platforms);

    // Camera follow
    camera.position.x += (player.position.x - camera.position.x) * CAMERA_LERP * delta;
    camera.position.y += (player.position.y + CAMERA_OFFSET_Y - camera.position.y) * CAMERA_LERP * delta;
    camera.position.z += (player.position.z + CAMERA_OFFSET_Z - camera.position.z) * CAMERA_LERP * delta;
    camera.lookAt(player.position.x, player.position.y + CAMERA_LOOK_Y, player.position.z);

    // Collect items
    for (const c of items) {
      if (!c.collected && player.position.distanceTo(c.mesh.position) < COLLECT_DISTANCE) {
        c.collected = true;
        c.mesh.visible = false;
        score++;
        hud.update({ score });
      }
      if (!c.collected) c.mesh.rotation.y += delta * 2;
    }

    // Fall off world = reset
    if (player.position.y < -10) {
      playerBody.position.set(0, 5, 0);
      playerBody.velocity.set(0, 0, 0);
    }
  },

  cleanup() {
    destroyKb?.();
  },
};
`;
