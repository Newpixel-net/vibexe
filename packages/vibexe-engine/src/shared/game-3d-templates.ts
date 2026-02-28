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
		content: `import { modelUrl } from "../utils/media-stock-3d";

// ===== THREE.js reference (loaded via CDN shim) =====
const THREE = (window as any).THREE;

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
  // Unity FBX (these are oversized — scale DOWN)
  unityCharacter: 0.01,
  unityEnvironment: 0.01,
  unityProp: 0.01,
};

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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    "three": "^0.162.0"
  }
}
`,
	},

	// ---------- Template 4: React wrapper for Three.js ----------
	{
		path: "src/components/Game3D.tsx",
		language: "typescript",
		content: `import { useEffect, useRef } from "react";

const THREE = (window as any).THREE;

interface GameSceneInterface {
  init(scene: any, camera: any, renderer: any, container: HTMLDivElement): void | Promise<void>;
  update(delta: number): void;
  cleanup?(): void;
}

interface Game3DProps {
  gameScene: GameSceneInterface;
  bgColor?: string;
  cameraFov?: number;
}

/**
 * React wrapper for Three.js 3D games.
 * Creates renderer, camera, scene and runs the game loop.
 *
 * The AI should NOT modify this file — import and use it in App.tsx.
 *
 * Usage in App.tsx:
 *   import Game3D from "./components/Game3D";
 *   import { GameScene } from "./scenes/GameScene";
 *   export default function App() {
 *     return <Game3D gameScene={GameScene} />;
 *   }
 *
 * Your GameScene must export an object with:
 *   init(scene, camera, renderer, container) — set up the 3D world
 *   update(delta) — called every frame, delta in seconds
 *   cleanup() — optional, called on unmount
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

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Create camera
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(cameraFov, aspect, 0.1, 1000);
    camera.position.set(0, 8, 15);
    camera.lookAt(0, 2, 0);

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);

    // Handle resize
    const onResize = () => {
      if (disposed) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // Initialize game scene
    const clock = new THREE.Clock();
    const startGame = async () => {
      await gameScene.init(scene, camera, renderer, container);

      // Game loop
      const animate = () => {
        if (disposed) return;
        animFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        gameScene.update(delta);
        renderer.render(scene, camera);
      };
      animate();
    };
    startGame();

    // Pause/resume on visibility change
    const onVisChange = () => {
      if (document.hidden) clock.stop();
      else clock.start();
    };
    document.addEventListener("visibilitychange", onVisChange);

    // Cleanup
    return () => {
      disposed = true;
      cancelAnimationFrame(animFrameId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisChange);
      gameScene.cleanup?.();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
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
import { GameScene } from "./scenes/GameScene";

export default function App() {
  return <Game3D gameScene={GameScene} />;
}
`,
	},
];
