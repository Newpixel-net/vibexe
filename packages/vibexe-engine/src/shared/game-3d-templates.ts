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

// ===== THREE.js + CANNON references =====
// The imports above trigger sync XHR shims that load THREE/CANNON into window.
const THREE = (window as any).THREE;
const CANNON = (window as any).CANNON;

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

  return {
    wrapper,
    scoreEl,
    livesEl,
    setScore: (score: number) => { scoreEl.textContent = \`Score: \${score}\`; },
    setLives: (lives: number) => { livesEl.textContent = "\\u2764 ".repeat(lives).trim(); },
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
  gameScene: GameSceneInterface;
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
export default function Game3D({ gameScene, bgColor = "#87CEEB", cameraFov = 60 }: Game3DProps) {
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
        scene = new THREE.Scene();
        scene.background = new THREE.Color(bgColor);

        const loading = createLoadingOverlay(container);

        (container as any).__restartGame = () => {
          disposeScene();
          clock.stop();
          clock.start();
          initAndRun();
        };

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
          gameScene.update(delta);
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
import { GameScene } from "./scenes/GameScene3D";

export default function App() {
  return <Game3D gameScene={GameScene} />;
}
`,
	},
];
