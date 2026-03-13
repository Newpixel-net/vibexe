"use client";

/**
 * SandpackPreview Component
 *
 * Live preview of generated React code using Sandpack.
 * Uses SandpackFileSync for incremental updates so the preview stays alive during streaming.
 *
 * Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/(main)/app-builder/components/sandpack-preview.tsx
 */

import {
	SandpackConsole,
	SandpackPreview as SandpackPreviewPane,
	SandpackProvider,
	useSandpack,
	useSandpackNavigation,
} from "@codesandbox/sandpack-react";
import {
	Camera,
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	ExternalLink,
	Crosshair,
	Globe,
	Grid3X3,
	Hand,
	Lightbulb,
	Monitor,
	Mountain,
	CloudSun,
	PersonStanding,
	Puzzle,
	ChevronRight,
	MousePointer2,
	Move,
	Redo2,
	RefreshCw,
	RotateCcw,
	RotateCw,
	Scaling,
	Smartphone,
	Tablet,
	Undo2,
	X,
} from "lucide-react";
import { MobilePublishPanel } from "./mobile-publish-panel";
import { PHONE_FRAME, PhoneFrame } from "./phone-frame";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppFile } from "../adapters/file-adapter";
import { useVisualEdit } from "../lib/visual-edit-context";
import { useGameEditor, type GizmoMode, type SceneDefinition, type SceneObjectDef } from "../lib/game-editor-context";
import { GameEditorPanel } from "./game-editor-panel";
import { GameSettingsPanel } from "./game-settings-panel";
import { SceneGizmo } from "./scene-gizmo";
import { TerrainPainterPanel } from "./terrain-painter-panel";
import { SkyWeatherPanel } from "./sky-weather-panel";
import { CharacterSystemPanel } from "./character-system-panel";
import { GameRuntimeIframe } from "./game-runtime-iframe";
import { DebugOverlay } from "./debug-overlay";
import type { RightPanelView } from "./right-panel-tabs";
import { VisualEditToolbar } from "./visual-edit-toolbar";
import {
	type SandpackFiles,
	type SandpackLanguageConfig,
	convertToSandpackFiles,
	extractDependencies,
} from "../adapters/sandpack-adapter";
import { isRtlLanguage } from "../lib/languages";
import { useToasts } from "@vibexe-internal/ui/toast";
import { ALL_MODULE_MANIFESTS, type ModuleManifest } from "@vibexe-ai/vibexe-engine";

/** Map module icon names → lucide components */
const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	Mountain,
	CloudSun,
	PersonStanding,
	Puzzle,
};

type DeviceSize = "desktop" | "tablet" | "mobile";

const DEVICE_SIZES: Record<DeviceSize, { width: number; label: string }> = {
	desktop: { width: 1280, label: "Desktop" },
	tablet: { width: 768, label: "Tablet" },
	mobile: { width: 375, label: "Mobile" },
};

export type PreviewMode = "browser" | "mobile-frame";

interface SandpackPreviewProps {
	appId: string;
	files: AppFile[];
	isGenerating?: boolean;
	onFileUpdate?: (fileId: string, content: string) => void;
	onFilesRefresh?: () => Promise<void> | void;
	onViewChange?: (view: RightPanelView) => void;
	onFileSelect?: (fileId: string) => void;
	previewMode?: PreviewMode;
	projectType?: string;
}

/**
 * Refresh button that triggers Sandpack refresh
 */
function RefreshButton() {
	const { refresh } = useSandpackNavigation();

	return (
		<button
			type="button"
			onClick={() => refresh()}
			className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm"
			title="Refresh preview"
		>
			<RefreshCw className="w-4 h-4" />
		</button>
	);
}

/**
 * Bridge that exposes useSandpackNavigation().refresh to parent via ref.
 * Lives inside SandpackProvider to access the hook.
 */
function SandpackRefreshBridge({ refreshRef }: { refreshRef: React.MutableRefObject<(() => void) | null> }) {
	const { refresh } = useSandpackNavigation();
	useEffect(() => {
		refreshRef.current = refresh;
		return () => { refreshRef.current = null; };
	}, [refresh, refreshRef]);
	return null;
}

/**
 * Inner component that syncs file changes to Sandpack via imperative API.
 * Lives inside SandpackProvider to access useSandpack() hook.
 * Debounces rapid updates to avoid race conditions during streaming.
 */
function SandpackFileSync({ files }: { files: SandpackFiles }) {
	const { sandpack } = useSandpack();
	const prevFilesRef = useRef<SandpackFiles>(files);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const prev = prevFilesRef.current;
		const updates: Array<[string, string]> = [];
		const deletes: string[] = [];

		for (const [path, file] of Object.entries(files)) {
			const code = typeof file === "string" ? file : file.code;
			const prevFile = prev[path];
			const prevCode = prevFile
				? typeof prevFile === "string"
					? prevFile
					: prevFile.code
				: undefined;

			if (prevCode !== code) {
				updates.push([path, code]);
			}
		}

		for (const path of Object.keys(prev)) {
			if (!(path in files)) {
				deletes.push(path);
			}
		}

		prevFilesRef.current = { ...files };

		if (updates.length === 0 && deletes.length === 0) return;

		// Debounce: clear pending flush and schedule new one
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			for (const [path, code] of updates) {
				sandpack.updateFile(path, code);
			}
			for (const path of deletes) {
				sandpack.deleteFile(path);
			}
		}, 300);
	}, [files, sandpack]);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	return null;
}

/**
 * CSS to make Sandpack fill its container
 * Sandpack uses .sp-wrapper as its main container class
 */
const sandpackFullHeightStyles = `
  .sandpack-container .sp-wrapper {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }
  .sandpack-container .sp-layout {
    height: 100% !important;
    flex: 1 !important;
  }
  .sandpack-container .sp-stack {
    height: 100% !important;
  }
  .sandpack-container .sp-preview-container {
    height: 100% !important;
  }
  .sandpack-container .sp-preview {
    height: 100% !important;
  }
  .sandpack-container .sp-preview iframe {
    height: 100% !important;
  }
`;

/**
 * Inline preview link in the toolbar - auto-enables share and shows a clickable URL with copy.
 */
function PreviewLink({ appId }: { appId: string }) {
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	// On mount, fetch or create share URL
	useEffect(() => {
		let cancelled = false;

		async function ensureShare() {
			try {
				// Check existing
				const getRes = await fetch(`/api/app-builder/apps/${appId}/share`);
				const getData = await getRes.json();
				if (getData.shareUrl) {
					if (!cancelled) setShareUrl(getData.shareUrl);
					return;
				}
				// Auto-enable
				const postRes = await fetch(`/api/app-builder/apps/${appId}/share`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ enabled: true }),
				});
				const postData = await postRes.json();
				if (!cancelled && postData.shareUrl) {
					setShareUrl(postData.shareUrl);
				}
			} catch {
				// Silently fail
			}
		}

		ensureShare();
		return () => { cancelled = true; };
	}, [appId]);

	const handleCopy = useCallback(async () => {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API may fail in some contexts
		}
	}, [shareUrl]);

	if (!shareUrl) return null;

	// Show shortened URL (strip https://)
	const displayUrl = shareUrl.replace(/^https?:\/\//, "");
	const truncated =
		displayUrl.length > 35
			? `${displayUrl.slice(0, 32)}...`
			: displayUrl;

	return (
		<div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50">
			<ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
			<a
				href={shareUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="text-xs text-muted-foreground hover:text-foreground truncate max-w-[200px]"
				title={shareUrl}
			>
				{truncated}
			</a>
			<button
				type="button"
				onClick={handleCopy}
				className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
				title={copied ? "Copied!" : "Copy link"}
			>
				{copied ? (
					<Check className="w-3 h-3 text-green-500" />
				) : (
					<Copy className="w-3 h-3" />
				)}
			</button>
		</div>
	);
}

/**
 * Code Viewer Overlay — shows source code with highlighted line
 * when "View in Code" is clicked from the Visual Edit toolbar.
 */
function CodeViewerOverlay({
	filePath,
	content,
	lineNumber,
	onClose,
}: {
	filePath: string;
	content: string;
	lineNumber: number;
	onClose: () => void;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const highlightRef = useRef<HTMLDivElement>(null);

	// Scroll to highlighted line after mount
	useEffect(() => {
		setTimeout(() => {
			highlightRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
		}, 50);
	}, []);

	// Close on Escape
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);

	const lines = content.split("\n");

	return (
		<div
			className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
			role="dialog"
			aria-modal="true"
			aria-label={`Source: ${filePath}`}
		>
			<div className="bg-[#0f0f1a] border border-white/[0.12] rounded-2xl w-[90%] max-w-3xl max-h-[80%] flex flex-col overflow-hidden shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
					<div className="flex items-center gap-2">
						<span className="text-xs font-mono text-violet-400">{filePath}</span>
						<span className="text-[10px] text-white/25">:{lineNumber}</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
				{/* Code area */}
				<div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-xs leading-5">
					{lines.map((line, idx) => {
						const ln = idx + 1;
						const isHighlighted = ln === lineNumber;
						return (
							<div
								key={ln}
								ref={isHighlighted ? highlightRef : undefined}
								className={`flex ${isHighlighted ? "bg-violet-500/15 border-l-2 border-violet-500" : "border-l-2 border-transparent hover:bg-white/[0.02]"}`}
							>
								<span className={`select-none w-12 text-right pr-3 flex-shrink-0 ${isHighlighted ? "text-violet-400" : "text-white/20"}`}>
									{ln}
								</span>
								<pre className="text-white/70 whitespace-pre overflow-x-auto pr-4">
									{line || " "}
								</pre>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

/**
 * Persist transform overrides to GameScene3D.ts source code.
 * Appends/updates a SCENE_EDITOR_OVERRIDES block at end of file.
 * This wraps GameScene.init to apply position/rotation/scale overrides
 * after the original init completes (so all factory-created objects exist).
 */
function updateTransformInSource(
	code: string,
	objectName: string,
	pos: { x: number; y: number; z: number },
	rot: { x: number; y: number; z: number },
	scl: { x: number; y: number; z: number },
	tex?: { url: string; tileX: number; tileY: number; hasPBR: boolean } | null,
	visible?: boolean,
	deletedNames?: string[],
): string {
	const MARKER_START = "// SCENE_EDITOR_OVERRIDES_START";
	const MARKER_END = "// SCENE_EDITOR_OVERRIDES_END";
	const DATA_MARKER = "// SCENE_EDITOR_OVERRIDES_DATA:";

	// Parse existing overrides from data marker if present
	let overrides: Record<string, any> = {};
	const dataMatch = code.match(
		new RegExp(
			DATA_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*(.+)",
		),
	);
	if (dataMatch) {
		try {
			overrides = JSON.parse(dataMatch[1]);
		} catch {}
	}

	// Strip existing overrides block
	const startIdx = code.indexOf(MARKER_START);
	const endIdx = code.indexOf(MARKER_END);
	if (startIdx !== -1 && endIdx !== -1) {
		code =
			code.substring(0, startIdx).trimEnd() +
			"\n" +
			code.substring(endIdx + MARKER_END.length).trimStart();
	}

	// Convert rotation from degrees to radians
	const rx = +((rot.x * Math.PI) / 180).toFixed(4);
	const ry = +((rot.y * Math.PI) / 180).toFixed(4);
	const rz = +((rot.z * Math.PI) / 180).toFixed(4);

	// Preserve existing texture data if not explicitly provided
	const existingTex = overrides[objectName]?.t;
	const existingVis = overrides[objectName]?.v;

	// Merge new transform (preserve texture + visibility if not overridden)
	overrides[objectName] = {
		p: [+pos.x.toFixed(3), +pos.y.toFixed(3), +pos.z.toFixed(3)],
		r: [rx, ry, rz],
		s: [+scl.x.toFixed(3), +scl.y.toFixed(3), +scl.z.toFixed(3)],
		...(tex ? { t: [tex.url, tex.tileX, tex.tileY, tex.hasPBR ? 1 : 0] } : existingTex ? { t: existingTex } : {}),
		...(visible === false ? { v: 0 } : existingVis !== undefined ? { v: existingVis } : {}),
	};

	// Merge deleted objects list (skip internal system objects like __skyDome__, __weatherParticles__)
	if (deletedNames && deletedNames.length > 0) {
		const filtered = deletedNames.filter((n: string) => !n.startsWith("__"));
		const existing: string[] = (overrides.__deleted || []).filter((n: string) => !n.startsWith("__"));
		overrides.__deleted = Array.from(new Set([...existing, ...filtered]));
		for (const dn of overrides.__deleted) delete overrides[dn]; // no point keeping transforms for deleted objects
	}

	const json = JSON.stringify(overrides);
	// Self-applying override: polls window.__vibexe_scene__ (set by Game3D.tsx)
	// rAF loop: continuously fights physics for 300 frames (5s).
	// Stops immediately when editor opens (__vibexe_editor__ guard).
	const block = `${MARKER_START}
${DATA_MARKER} ${json}
if (typeof window !== 'undefined') {
  window.__SCENE_OVERRIDES__ = ${json};
  (function() {
    var _ov = ${json};
    var _logged = {};
    var _cache = {};
    var _bodies = {};
    var _delDone = false;
    var _lastScene = null;
    var _frame = 0;
    var _MAX = 300;
    var _startTime = Date.now();
    var _MAX_WALL = 120000;
    var _fp = ["Platform_","Collectible_","Barrier_","Decoration_","Player_","Character_","Object_"];
    function _isF(n) { if(!n) return false; for(var i=0;i<_fp.length;i++) if(n.indexOf(_fp[i])===0) return true; return false; }
    function _findBody(mesh, name) {
      if (_bodies[name]) return _bodies[name];
      var pb = mesh.userData && mesh.userData.__physicsBody;
      if (pb && pb.position) { _bodies[name]=pb; return pb; }
      var w = window.__vibexe_world__;
      if (!w || !w.bodies) return null;
      // First try matching by mesh reference or name tag (auto-physics sets __meshRef/__meshName)
      for (var i = 0; i < w.bodies.length; i++) {
        var b = w.bodies[i];
        if (b.__meshRef === mesh || b.__meshName === name) {
          mesh.userData.__physicsBody = b;
          _bodies[name] = b;
          return b;
        }
      }
      // Fallback: proximity search with wider tolerance (2 units for large objects)
      var o = _ov[name];
      if (!o || !o.p) return null;
      var tx=o.p[0], ty=o.p[1], tz=o.p[2];
      for (var i = 0; i < w.bodies.length; i++) {
        var b = w.bodies[i];
        if (Math.abs(b.position.x-tx)<2 && Math.abs(b.position.y-ty)<2 && Math.abs(b.position.z-tz)<2) {
          mesh.userData.__physicsBody = b;
          _bodies[name] = b;
          return b;
        }
      }
      return null;
    }
    function _find(s, name) {
      if (_cache[name]) { if (_cache[name].parent) return _cache[name]; delete _cache[name]; delete _logged[name]; }
      var t = null;
      if (name.indexOf("UnnamedGroup_")===0) {
        var gi = parseInt(name.replace("UnnamedGroup_",""),10), gc = 0;
        for (var ci=0; ci<s.children.length; ci++) {
          var ch = s.children[ci];
          if (ch.type==="Group" && ch.children && ch.children.length>0 && !_isF(ch.name||"")) {
            if (gc===gi) { t=ch; break; } gc++;
          }
        }
      } else if (name.indexOf("#")!==-1) {
        var _parts = name.split("#"), _base = _parts[0], _ni = parseInt(_parts[1],10), _nc = 0;
        s.traverse(function(c) { if(!t && c.name===_base) { if(_nc===_ni) { t=c; } _nc++; } });
      } else {
        s.traverse(function(c) { if(!t && c.name===name) t=c; });
      }
      if (t) _cache[name] = t;
      return t;
    }
    function _apply() {
      if (Date.now() - _startTime > _MAX_WALL) { console.log("[SCENE_EDITOR] Override wall-time expired"); return; }
      var s = window.__vibexe_scene__;
      if (!s || !s.children) { requestAnimationFrame(_apply); return; }
      if (s !== _lastScene) { _cache={}; _bodies={}; _logged={}; _delDone=false; _lastScene=s; }
      var _inEditor = !!window.__vibexe_editor__;
      if (_ov.__deleted && _ov.__deleted.length) {
        var _rm = [];
        s.traverse(function(o) { if (o.name && o.name.substring(0,2) !== "__" && _ov.__deleted.indexOf(o.name) !== -1) _rm.push(o); });

        _rm.forEach(function(o) {
          if (o.parent) o.parent.remove(o);
          var w = window.__vibexe_world__;
          if (w && w.bodies) {
            for (var bi = w.bodies.length-1; bi >= 0; bi--) {
              if (w.bodies[bi].__meshRef === o || w.bodies[bi].__meshName === o.name) w.removeBody(w.bodies[bi]);
            }
          }
        });
        if (_rm.length && !_delDone) { console.log("[SCENE_EDITOR] Deleted " + _rm.length + " objects"); _delDone = true; }
      }
      var _gsPlayer = window.__VIBEXE_GAME_SETTINGS__ && window.__VIBEXE_GAME_SETTINGS__.player;
      var keys = Object.keys(_ov);
      for (var ki=0; ki<keys.length; ki++) {
        var name = keys[ki];
        if (name === "__deleted") continue;
        if (_gsPlayer && (name.indexOf("Character_")===0 || name.indexOf("Player_")===0)) continue;
        var o = _ov[name];
        var t = _find(s, name);
        if (!t) continue;
        if (o.v !== undefined) t.visible = !!o.v;
        if (_inEditor) continue;
        var _hasBody = false;
        if (o.p) {
          t.position.set(o.p[0],o.p[1],o.p[2]);
          var pb = _findBody(t, name);
          if (pb) {
            // Account for pivot offset (GLTF models with off-center pivots)
            var _pOff = pb.__pivotOffset || { x: 0, y: 0, z: 0 };
            pb.position.set(o.p[0] + _pOff.x, o.p[1] + _pOff.y, o.p[2] + _pOff.z);
            if(pb.velocity) pb.velocity.set(0,0,0); _hasBody=true;
          }
        }
        if (!_logged[name]) {
          if (o.r) t.rotation.set(o.r[0],o.r[1],o.r[2]);
          if (o.s) {
            t.scale.set(o.s[0],o.s[1],o.s[2]);
            // Update physics shape to match new scale
            var _spb = _findBody(t, name);
            if (_spb && _spb.shapes && _spb.shapes[0] && typeof CANNON !== 'undefined') {
              var _os = _spb.shapes[0];
              if (_os.halfExtents && _os.__origHE) {
                _spb.removeShape(_os);
                var _nhe = new CANNON.Vec3(_os.__origHE.x*Math.abs(o.s[0]), _os.__origHE.y*Math.abs(o.s[1]), _os.__origHE.z*Math.abs(o.s[2]));
                var _ns2 = new CANNON.Box(_nhe);
                _ns2.__origHE = _os.__origHE;
                _spb.addShape(_ns2);
              } else if (_os.halfExtents) {
                // First scale — save original half-extents
                _os.__origHE = { x: _os.halfExtents.x, y: _os.halfExtents.y, z: _os.halfExtents.z };
                _spb.removeShape(_os);
                var _nhe2 = new CANNON.Vec3(_os.__origHE.x*Math.abs(o.s[0]), _os.__origHE.y*Math.abs(o.s[1]), _os.__origHE.z*Math.abs(o.s[2]));
                var _ns3 = new CANNON.Box(_nhe2);
                _ns3.__origHE = _os.__origHE;
                _spb.addShape(_ns3);
              }
            }
          }
          if (o.t && o.t[0] && typeof THREE !== 'undefined') {
            (function(_obj, _ti) {
              var _tu = _ti[0], _tx = _ti[1]||1, _ty = _ti[2]||1, _pbr = !!_ti[3];
              var _ao = window.__VIBEXE_API_ORIGIN__ || '';
              if (_tu.charAt(0)==='/') _tu = _ao + _tu;
              if (!_obj.userData) _obj.userData = {};
              if (!_obj.userData.vibexeArgs) _obj.userData.vibexeArgs = {};
              _obj.userData.vibexeArgs.textureUrl = _ti[0];
              _obj.userData.vibexeArgs.textureTileX = _tx;
              _obj.userData.vibexeArgs.textureTileY = _ty;
              _obj.userData.vibexeArgs.hasPBR = _pbr;
              var _ldr = new THREE.TextureLoader();
              var _cfgTex = function(tex, isSRGB) {
                tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.RepeatWrapping;
                tex.repeat.set(_tx,_ty); tex.anisotropy=8; tex.generateMipmaps=true;
                tex.minFilter=THREE.LinearMipmapLinearFilter;
                tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
                return tex;
              };
              var _loadT = function(url, cb) { if(!url){cb(null);return;} _ldr.load(url, cb, undefined, function(){ cb(null); }); };
              if (_pbr) {
                var _b = _tu.replace(/\\.[^.]+$/,''), _e = (_tu.match(/\\.[^.]+$/)||['.jpg'])[0];
                var _fn = _tu.split('/').pop()||'';
                var _isM = /^Metal|^CorrugatedSteel|^DiamondPlate|^PaintedMetal/i.test(_fn);
                var _ns = 1.0;
                if (_isM) _ns=0.8; else if (/^Brick/i.test(_fn)) _ns=1.5;
                else if (/^Rock|^Paving/i.test(_fn)) _ns=1.2; else if (/^Wood|^WoodFloor|^Planks/i.test(_fn)) _ns=0.6;
                else if (/^Concrete|^Plaster/i.test(_fn)) _ns=0.8; else if (/^Fabric|^Leather|^Carpet/i.test(_fn)) _ns=0.5;
                else if (/^Marble|^Granite|^Onyx|^Travertine/i.test(_fn)) _ns=0.7;
                var _urls = [_tu, _b+'_Normal'+_e, _b+'_Roughness'+_e, _isM?_b+'_Metalness'+_e:'', ''];
                var _cnt=0, _res=[null,null,null,null,null];
                for (var _qi=0; _qi<5; _qi++) { (function(idx){ _loadT(_urls[idx], function(tex){ _res[idx]=tex; _cnt++; if(_cnt===5){
                  var cT=_res[0],nT=_res[1],rT=_res[2],mT=_res[3],aT=_res[4];
                  if(!cT) return;
                  // PBR env setup — inside callback so renderer/scene are guaranteed available
                  if (!window.__vibexe_pbr_env__) {
                    var _r = window.__vibexe_renderer__, _sc = window.__vibexe_scene__;
                    if (_r && _sc) {
                      window.__vibexe_pbr_env__ = true;
                      var _pm = new THREE.PMREMGenerator(_r); _pm.compileEquirectangularShader();
                      var _es2 = new THREE.Scene();
                      _es2.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16), new THREE.MeshBasicMaterial({color:new THREE.Color(0.35,0.4,0.55),side:THREE.BackSide})));
                      _es2.add(new THREE.Mesh(new THREE.SphereGeometry(49,32,16,0,Math.PI*2,Math.PI/2,Math.PI/2), new THREE.MeshBasicMaterial({color:new THREE.Color(0.15,0.13,0.1),side:THREE.BackSide})));
                      var _pg2=new THREE.PlaneGeometry(8,8), _ap2=function(x,y,z,cr,cg,cb,sx,sy){var p=new THREE.Mesh(_pg2,new THREE.MeshBasicMaterial({color:new THREE.Color(cr,cg,cb),side:THREE.DoubleSide}));p.position.set(x,y,z);p.lookAt(0,0,0);p.scale.set(sx,sy,1);_es2.add(p);};
                      _ap2(0,45,-10,10,9,8,2,2);_ap2(-15,40,25,4,4,5,1.5,1.5);_ap2(35,20,-15,2,2,2.5,2,2);_ap2(-35,12,8,1,1,1.2,2,2);_ap2(0,-30,0,0.5,0.5,0.6,4,4);
                      _sc.environment=_pm.fromScene(_es2,0,0.1,100).texture;
                      _r.toneMapping=THREE.ACESFilmicToneMapping; _r.toneMappingExposure=2.5;
                      var _hdriUrl2=(window.__VIBEXE_API_ORIGIN__||'')+'/api/app-builder/media-stock-3d/textures/env_studio.jpg';
                      new THREE.TextureLoader().load(_hdriUrl2,function(ht){ht.mapping=THREE.EquirectangularReflectionMapping;ht.colorSpace=THREE.SRGBColorSpace;var pm3=new THREE.PMREMGenerator(_r);pm3.compileEquirectangularShader();_sc.environment=pm3.fromEquirectangular(ht).texture;pm3.dispose();ht.dispose();console.log('[PBR] HDRI env upgraded');},undefined,function(){console.log('[PBR] HDRI not found, using procedural');});
                      _pm.dispose();
                      var _oal=_sc.getObjectByName('__default_ambient__'); if(_oal)_oal.intensity=Math.max(_oal.intensity,0.3);
                      var _ohl=_sc.getObjectByName('__default_hemi__'); if(_ohl)_ohl.intensity=Math.max(_ohl.intensity,0.5);
                      if(!_sc.getObjectByName('__pbr_key__')){var _pk=new THREE.DirectionalLight(0xFFFBF0,1.5);_pk.name='__pbr_key__';_pk.position.set(15,30,-10);_pk.castShadow=false;_sc.add(_pk);}
                      console.log('[SCENE_EDITOR] PBR env v46 (HDRI+AO)');
                    } else {
                      console.warn('[SCENE_EDITOR] PBR env FAILED: renderer=',!!_r,'scene=',!!_sc);
                    }
                  }
                  var _mVal=_isM?0.95:0.0, _eI=_isM?1.0:0.3;
                  var _envTex = (window.__vibexe_scene__ && window.__vibexe_scene__.environment) || null;
                  _obj.traverse(function(m){ if(!m.isMesh||!m.material) return;
                    var mo={map:_cfgTex(cT.clone(),true),roughness:rT?1.0:0.7,metalness:_mVal,envMapIntensity:_eI,side:THREE.DoubleSide};
                    if(_envTex) mo.envMap=_envTex;
                    if(nT){mo.normalMap=_cfgTex(nT.clone(),false);mo.normalScale=new THREE.Vector2(_ns,_ns);}
                    if(rT) mo.roughnessMap=_cfgTex(rT.clone(),false);
                    if(mT) mo.metalnessMap=_cfgTex(mT.clone(),false);
                    if(aT){mo.aoMap=_cfgTex(aT.clone(),false);mo.aoMapIntensity=1.0;}
                    m.material=new THREE.MeshStandardMaterial(mo);
                    if(aT&&m.geometry&&m.geometry.attributes.uv&&!m.geometry.attributes.uv2){m.geometry.setAttribute('uv2',m.geometry.attributes.uv);}
                    m.material.needsUpdate=true;
                  });
                  console.log('[SCENE_EDITOR] PBR applied:',_ti[0],'isMetal:',_isM,'metalness:',_mVal,'envMap:',!!_envTex);
                }}); })(_qi); }
              } else {
                _loadT(_tu, function(cTex) {
                  if (!cTex) return;
                  _cfgTex(cTex, true);
                  _obj.traverse(function(m) { if (m.isMesh && m.material) { m.material.map = cTex; m.material.needsUpdate = true; } });
                });
              }
            })(t, o.t);
          }
          _logged[name] = true;
          console.log("[SCENE_EDITOR] Applied: "+name+(_hasBody?" +body":"")+(o.t?" +texture":""));
        }
      }
      _frame++;
      // Early terrain generation at frame 5 — don't wait 300 frames for terrain to appear
      if (_frame === 5) _autoTerrain();
      if (_frame < _MAX) requestAnimationFrame(_apply);
      else {
        console.log("[SCENE_EDITOR] Override done after "+_frame+" frames, "+Object.keys(_bodies).length+" bodies");
        _autoPhysics(s);
        _autoTerrain(); // Second call is idempotent (_autoTerrainDone flag)
        // Delayed auto-physics retries — catch late-loading GLTF models and restored spawned objects
        setTimeout(function() { _autoPhysics(s); }, 5000);
        setTimeout(function() { _autoPhysics(s); }, 10000);
        setTimeout(function() { _autoPhysics(s); }, 15000);
      }
    }
    // Auto-terrain: regenerate terrain from persisted config if it exists
    var _autoTerrainDone = false;
    function _autoTerrain() {
      if (_autoTerrainDone) return;
      _autoTerrainDone = true;
      var gs = window.__VIBEXE_GAME_SETTINGS__;
      if (!gs || !gs.terrain || !gs.terrain.enabled) {
        console.log("[AutoTerrain] No terrain config in settings, skipping. gs.terrain=", gs && gs.terrain);
        return;
      }
      var tc = gs.terrain;
      // Only auto-generate if no terrain already exists in scene
      var scene = window.__vibexe_scene__;
      if (scene && scene.getObjectByName && scene.getObjectByName("__terrain__")) {
        console.log("[AutoTerrain] Terrain already exists, skipping");
        return;
      }
      console.log("[AutoTerrain] Regenerating terrain from saved config:", tc.width, "x", (tc.depth||tc.width), "h=", tc.heightScale, "biome=", tc.biome||"default");
      // Send generate message — bridge handler picks this up
      window.postMessage({
        type: "terrain-painter-generate-terrain",
        settings: {
          terrainWidth: tc.width || 200,
          terrainDepth: tc.depth || 200,
          terrainHeightScale: tc.heightScale || 40,
          terrainSegments: tc.segments || 256,
          sculptHeightData: tc.sculptHeightData || null,
        },
        biome: tc.biome || null,
        seed: tc.seed || 0,
      }, "*");
      // After terrain generates, auto-repaint with saved layers (with retry if terrain not ready)
      if (tc.layers && tc.layers.length > 0) {
        var _repaintRetries = 0;
        function _sendRepaint() {
          var _scene = window.__vibexe_scene__;
          if (_scene && _scene.getObjectByName && !_scene.getObjectByName("__terrain__") && _repaintRetries < 3) {
            _repaintRetries++;
            console.log("[AutoTerrain] Terrain not ready for repaint, retry "+_repaintRetries+"/3 in 2s");
            setTimeout(_sendRepaint, 2000);
            return;
          }
          var _defMods = [
            [{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.2, minFalloff: 0.02, maxFalloff: 0.08 } }, { type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 25, minFalloff: 5, maxFalloff: 10 } }],
            [{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.03, max: 0.35, minFalloff: 0.03, maxFalloff: 0.1 } }, { type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 30, minFalloff: 3, maxFalloff: 10 } }],
            [{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.1, max: 0.95, minFalloff: 0.08, maxFalloff: 0.1 } }],
            [{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.72, max: 1.0, minFalloff: 0.08, maxFalloff: 0.02 } }, { type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 45, minFalloff: 5, maxFalloff: 10 } }]
          ];
          window.postMessage({
            type: "terrain-painter-repaint",
            layers: tc.layers.map(function(l, idx) {
              return {
                name: l.textureUrl ? l.textureUrl.split("/").pop().replace(/\.[^.]+$/, "") : "Layer",
                enabled: l.enabled !== false,
                diffuseUrl: l.textureUrl || "",
                tileSize: l.tileSize || 4,
                opacity: l.opacity != null ? l.opacity : 100,
                roughness: l.roughness != null ? l.roughness : 0.85,
                normalIntensity: l.normalIntensity != null ? l.normalIntensity : 1.0,
                metallic: l.metallic || false,
                modifiers: l.modifiers && l.modifiers.length > 0 ? l.modifiers : (_defMods[idx] || []),
                materialId: l.materialId,
                emissionUrl: l.emissionUrl,
                emissionIntensity: l.emissionIntensity,
              };
            })
          }, "*");
        }
        setTimeout(_sendRepaint, 1500);
      }
    }
    // Auto-physics: scan scene meshes and create CANNON bodies for objects that need them
    // Runs multiple times (idempotent — skips objects that already have bodies)
    function _autoPhysics(scene) {
      var w = window.__vibexe_world__;
      if (!w) return;
      var CANNON = window.CANNON;
      if (!CANNON) return;
      var created = 0, skipped = 0;
      // Types that should be solid (static physics bodies)
      var solidTypes = { platform: true, barrier: true };
      // Types that are trigger-only (no solid body, collected via distance)
      var triggerTypes = { collectible: true };
      // Types that are visual-only (no physics)
      var decorTypes = { decoration: true };
      // Types that already have special handling
      var playerTypes = { player: true, AnimatedCharacter: true };
      scene.traverse(function(obj) {
        if (!obj.isMesh && !obj.isGroup) return;
        if (!obj.userData) return;
        // Skip if already has a physics body
        if (obj.userData.__physicsBody) { skipped++; return; }
        // Also check if a body was found in the _bodies cache
        if (obj.name && _bodies[obj.name]) { skipped++; return; }
        // Check by vibexeType
        var vType = obj.userData.vibexeType;
        // Also infer type from name prefix if vibexeType not set
        if (!vType && obj.name) {
          if (obj.name.indexOf("Platform_") === 0 || obj.name.indexOf("platform") === 0) vType = "platform";
          else if (obj.name.indexOf("Barrier_") === 0 || obj.name.indexOf("barrier") === 0) vType = "barrier";
          else if (obj.name.indexOf("Collectible_") === 0 || obj.name.indexOf("collectible") === 0) vType = "collectible";
          else if (obj.name.indexOf("Decoration_") === 0 || obj.name.indexOf("decoration") === 0) vType = "decoration";
        }
        if (!vType) return;
        if (playerTypes[vType]) return;
        if (decorTypes[vType]) return;
        if (triggerTypes[vType]) return;
        if (!solidTypes[vType]) return;
        // Compute bounding box for physics shape
        var box = new THREE.Box3();
        if (obj.isGroup || obj.children.length > 0) {
          // For groups, compute from all children
          obj.traverse(function(child) {
            if (child.isMesh && child.geometry) {
              child.geometry.computeBoundingBox();
              var childBox = child.geometry.boundingBox.clone();
              childBox.applyMatrix4(child.matrixWorld);
              box.expandByObject(child);
            }
          });
        } else if (obj.geometry) {
          obj.geometry.computeBoundingBox();
          box.copy(obj.geometry.boundingBox);
          box.applyMatrix4(obj.matrixWorld);
        }
        if (box.isEmpty()) return;
        var size = new THREE.Vector3();
        box.getSize(size);
        var center = new THREE.Vector3();
        box.getCenter(center);
        // Half-extents for CANNON Box shape (minimum 0.1 to avoid degenerate)
        var hx = Math.max(size.x * 0.5, 0.05);
        var hy = Math.max(size.y * 0.5, 0.05);
        var hz = Math.max(size.z * 0.5, 0.05);
        var shape = new CANNON.Box(new CANNON.Vec3(hx, hy, hz));
        shape.__origHE = { x: hx, y: hy, z: hz };
        var body = new CANNON.Body({ mass: 0, shape: shape });
        body.position.set(center.x, center.y, center.z);
        body.type = CANNON.Body.STATIC;
        body.__meshRef = obj;
        body.__meshName = obj.name;
        body.__autoPhysics = true;
        // Store offset from mesh origin to bbox center (for GLTF offset pivots)
        body.__pivotOffset = { x: center.x - obj.position.x, y: center.y - obj.position.y, z: center.z - obj.position.z };
        // Store the mesh scale at creation time so we can detect scale changes
        body.__lastScale = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };
        w.addBody(body);
        obj.userData.__physicsBody = body;
        // === Rapier parallel collider (Phase 3) ===
        var _apR = window.RAPIER;
        var _apRW = window.__vibexe_rapierWorld__;
        if (_apR && _apRW) {
          try {
            var _rbd = _apR.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z);
            var _rb = _apRW.createRigidBody(_rbd);
            var _rcd = _apR.ColliderDesc.cuboid(hx, hy, hz);
            _apRW.createCollider(_rcd, _rb);
            obj.userData.__rapierBody = _rb;
          } catch(e) {}
        }
        if (obj.name) _bodies[obj.name] = body;
        created++;
      });
      if (created > 0) console.log("[AutoPhysics] Created "+created+" physics bodies ("+skipped+" already had bodies)" + (window.__vibexe_rapierWorld__ ? " (+ Rapier)" : ""));
      else if (skipped > 0) console.log("[AutoPhysics] All "+skipped+" objects already have physics bodies");
      else console.log("[AutoPhysics] No objects needed physics bodies");
    }
    requestAnimationFrame(_apply);
  })();
}
${MARKER_END}`;

	return code.trimEnd() + "\n" + block + "\n";
}

/**
 * Main preview component with responsive toggles and console.
 * No key on SandpackProvider - SandpackFileSync handles incremental
 * updates so the preview iframe stays alive during streaming.
 */
export function SandpackPreview({
	appId,
	files,
	isGenerating,
	onFileUpdate,
	onFilesRefresh,
	onViewChange,
	onFileSelect,
	previewMode = "browser",
	projectType = "app",
}: SandpackPreviewProps) {
	const isMobileFrame = previewMode === "mobile-frame";
	const [device, setDevice] = useState<DeviceSize>(isMobileFrame ? "mobile" : "desktop");
	const [showConsole, setShowConsole] = useState(false);
	const visualEdit = useVisualEdit();
	const gameEditor = useGameEditor();
	// Auto-fetch animation overrides on mount if character-system module is installed
	// (overrides are normally fetched only when selecting a character in scene mode)
	const animOverridesFetched = useRef(false);
	useEffect(() => {
		if (animOverridesFetched.current) return;
		const installed = gameEditor.gameSettings?.modules?.installed;
		const hasCharSys = installed && (installed as Record<string, { enabled?: boolean }>)["character-system"]?.enabled;
		if (hasCharSys) {
			animOverridesFetched.current = true;
			// Overrides are keyed by GLB filename (without extension), not the character ID.
			// Character system sets __characterModel = modelFileName.replace(/\.glb$/i, "")
			// Map character IDs to their model filenames:
			const charModelMap: Record<string, string> = { warrior: "Warrior_figure_Animations" };
			const charId = gameEditor.gameSettings?.character?.id || "warrior";
			const modelId = charModelMap[charId] || charModelMap.warrior;
			gameEditor.fetchAnimOverrides(modelId);
		}
	}, [gameEditor.gameSettings?.modules?.installed]); // eslint-disable-line react-hooks/exhaustive-deps

	// Merge animation clip renames into gameSettings so character-system can use renamed names
	const gameSettingsWithOverrides = useMemo(() => {
		const gs = gameEditor.gameSettings;
		const ov = gameEditor.animClipOverrides;
		if (!ov || Object.keys(ov).length === 0) return gs;
		return { ...gs, animClipOverrides: ov };
	}, [gameEditor.gameSettings, gameEditor.animClipOverrides]);

	const { toast } = useToasts();
	const iframeContainerRef = useRef<HTMLDivElement>(null);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const [iframeBounds, setIframeBounds] = useState<DOMRect | null>(null);
	// Refs for stable access inside message handler (avoids stale closure)
	const filesRef = useRef(files);
	filesRef.current = files;
	const onFileUpdateRef = useRef(onFileUpdate);
	onFileUpdateRef.current = onFileUpdate;
	const onFilesRefreshRef = useRef(onFilesRefresh);
	onFilesRefreshRef.current = onFilesRefresh;
	const gameEditorRef = useRef(gameEditor);
	gameEditorRef.current = gameEditor;
	const visualEditRef = useRef(visualEdit);
	visualEditRef.current = visualEdit;
	// Debounce timers for gizmo drag to prevent React re-render storms
	const playerPosUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cameraMoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [codeViewer, setCodeViewer] = useState<{
		filePath: string;
		content: string;
		lineNumber: number;
	} | null>(null);

	// Detect game mode
	const isGameMode = projectType === "game" || projectType === "game-mobile";

	// Ref for triggering Sandpack refresh from outside SandpackProvider
	const sandpackRefreshRef = useRef<(() => void) | null>(null);

	// Recompile when animation overrides arrive (async fetch completes after first compile)
	const prevOverridesLen = useRef(0);
	useEffect(() => {
		const len = Object.keys(gameEditor.animClipOverrides || {}).length;
		if (len > 0 && prevOverridesLen.current === 0) {
			// Overrides just arrived — force recompile so character system gets renamed clips
			setTimeout(() => { sandpackRefreshRef.current?.(); }, 200);
		}
		prevOverridesLen.current = len;
	}, [gameEditor.animClipOverrides]);

	// Track whether scene transforms were modified during editor session
	const sceneModifiedDuringEditRef = useRef(false);

	// Save-all-transforms resolver for batch save
	const allTransformsResolverRef = useRef<((transforms: Record<string, any>) => void) | null>(null);
	// Spawned objects persistence — saved before restart, restored after
	const spawnedObjectsRef = useRef<any[]>([]);
	// Texture overrides for scene-original objects (not spawned) — persist across reloads
	const textureOverridesRef = useRef<any[]>([]);
	// Track deleted object names for persistence across save
	const deletedObjectsRef = useRef<string[]>([]);
	// Editor lights persistence — saved to game settings, restored after reload
	const lightsRef = useRef<Array<{ name: string; type: "point" | "spot"; color: string; intensity: number; position: { x: number; y: number; z: number }; distance?: number; decay?: number; angle?: number; penumbra?: number; target?: { x: number; y: number; z: number } }>>([]);
	// Light dropdown state
	const [lightDropdownOpen, setLightDropdownOpen] = useState(false);

	// Close light dropdown when editor is disabled
	useEffect(() => {
		if (!gameEditor.enabled) setLightDropdownOpen(false);
	}, [gameEditor.enabled]);

	// Close light dropdown on outside click
	useEffect(() => {
		if (!lightDropdownOpen) return;
		const close = () => setLightDropdownOpen(false);
		// Delay to avoid closing immediately from the same click that opened it
		const timer = setTimeout(() => {
			window.addEventListener("click", close, { once: true });
		}, 0);
		return () => { clearTimeout(timer); window.removeEventListener("click", close); };
	}, [lightDropdownOpen]);

	// Mutex to prevent concurrent settings saves
	const savingSettingsRef = useRef(false);
	// Debounce timer for settings saves (prevents double Sandpack rebuilds)
	const saveSettingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingSettingsRef = useRef<import("../lib/game-editor-context").GameSettings | null>(null);
	// Track last loaded settings content to avoid redundant re-parses
	const lastLoadedSettingsContentRef = useRef<string | null>(null);
	// Debounce timer for transform persistence (prevents 60+ DB writes/sec during drag)
	const persistTransformTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingTransformRef = useRef<{ name: string; pos: any; rot: any; scl: any } | null>(null);

	// Register save handler with game editor context
	useEffect(() => {
		if (!isGameMode) return;
		const saveAllTransforms = async () => {
			const iframe = iframeRef.current;
			if (!iframe?.contentWindow) {
				console.warn("[GameEditor] No iframe for save");
				return;
			}
			const deletions = deletedObjectsRef.current;
			// Request all transforms from bridge
			iframe.contentWindow.postMessage({ type: "game-editor-collect-all-transforms" }, "*");
			// Wait for response with 8s timeout
			const transforms = await new Promise<Record<string, any>>((resolve) => {
				allTransformsResolverRef.current = resolve;
				setTimeout(() => {
					if (allTransformsResolverRef.current === resolve) {
						allTransformsResolverRef.current = null;
						toast("Save timed out — saving what we have", { type: "warning" });
						resolve({});
					}
				}, 8000);
			});
			const names = Object.keys(transforms);
			if (names.length === 0 && deletions.length === 0) {
				console.log("[GameEditor] No transforms or deletions to save");
				return;
			}
			console.log("[GameEditor] Saving:", names.length, "objects,", deletions.length, "deletions");
			// Find GameScene3D.ts
			const currentFiles = filesRef.current;
			const currentOnFileUpdate = onFileUpdateRef.current;
			const sceneFile = currentFiles.find((f) => f.path?.includes("GameScene3D"));
			if (!sceneFile?.content || !currentOnFileUpdate) {
				console.warn("[GameEditor] Cannot save: GameScene3D.ts not found");
				return;
			}
			// Apply all transforms to source code
			let code = sceneFile.content;
			if (names.length > 0) {
				for (const name of names) {
					const t = transforms[name];
					const texData = t._textureUrl ? { url: t._textureUrl, tileX: t._textureTileX || 1, tileY: t._textureTileY || 1, hasPBR: !!t._hasPBR } : null;
					const vis = t._visible === false ? false : undefined;
					code = updateTransformInSource(code, name, t.position, t.rotation, t.scale, texData, vis, deletions);
				}
			} else if (deletions.length > 0) {
				// Deletions only — no transforms, use a dummy call to merge deletions into overrides
				code = updateTransformInSource(code, "__dummy__", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, null, undefined, deletions);
				// Remove the dummy entry from the JSON data marker
				code = code.replace(/"__dummy__":\{[^}]*\},?/g, "").replace(/,\}/g, "}");
			}
			if (code !== sceneFile.content) {
				currentOnFileUpdate(sceneFile.id, code);
				// Save to DB
				try {
					await fetch(`/api/app-builder/apps/${appId}/files`, {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ path: sceneFile.path, content: code }),
					});
					console.log("[GameEditor] DB save complete for", names.length, "objects,", deletions.length, "deletions");
					toast("Scene saved", { type: "success" });
					deletedObjectsRef.current = [];
				} catch (err) {
					console.warn("[GameEditor] DB save failed:", err);
					toast("Failed to save scene", { type: "error" });
				}
			} else {
				toast("Scene saved", { type: "success" });
			}
		};
		gameEditor.setSaveHandler(saveAllTransforms);
	}, [isGameMode, appId, gameEditor.setSaveHandler, toast]);

	// Load game settings from files — re-runs when the settings file content changes
	const settingsFileContent = useMemo(() => {
		if (!isGameMode) return null;
		const settingsFile = files.find((f) => f.path === "src/__game-settings.json" || f.path === "__game-settings.json");
		return settingsFile?.content ?? null;
	}, [isGameMode, files]);

	useEffect(() => {
		if (!settingsFileContent) return;
		// Skip if we already loaded this exact content (avoids overwriting in-progress edits)
		if (settingsFileContent === lastLoadedSettingsContentRef.current) return;
		lastLoadedSettingsContentRef.current = settingsFileContent;
		try {
			gameEditor.setGameSettings(JSON.parse(settingsFileContent));
		} catch { /* invalid JSON */ }
	}, [settingsFileContent, gameEditor.setGameSettings]);

	// Send settings to the game iframe via postMessage (reliable delivery after game loads)
	const sendSettingsToGame = useCallback((settings: import("../lib/game-editor-context").GameSettings) => {
		const iframe = iframeRef.current;
		if (!iframe?.contentWindow) return;
		iframe.contentWindow.postMessage({
			type: "applySettings",
			settings,
		}, "*");
	}, []);

	// Save game settings to DB + trigger Sandpack refresh (debounced 500ms)
	const _doSaveSettings = useCallback(async (settings: import("../lib/game-editor-context").GameSettings) => {
		// Prevent concurrent saves
		if (savingSettingsRef.current) return;
		savingSettingsRef.current = true;
		try {
			const content = JSON.stringify(settings, null, 2);
			// Track that we initiated this content so the load effect doesn't re-parse it
			lastLoadedSettingsContentRef.current = content;
			const currentOnFileUpdate = onFileUpdateRef.current;
			// Find or create the settings file
			const existingFile = filesRef.current.find((f) => f.path === "src/__game-settings.json" || f.path === "__game-settings.json");
			const filePath = existingFile?.path || "src/__game-settings.json";
			// Save to DB
			try {
				await fetch(`/api/app-builder/apps/${appId}/files`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ path: filePath, content }),
				});
			} catch (err) {
				console.warn("[GameSettings] DB save failed:", err);
			}
			// Also save modules manifest so sandpack-adapter can inject modules
			if (settings.modules?.installed) {
				const modulesJson = JSON.stringify({ installed: settings.modules.installed }, null, 2);
				fetch(`/api/app-builder/apps/${appId}/files`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ path: "src/__vibexe-modules.json", content: modulesJson }),
				}).catch(() => { /* non-critical */ });
			}
			// Update file in state so convertToSandpackFiles re-runs with new settings
			if (currentOnFileUpdate && existingFile) {
				currentOnFileUpdate(existingFile.id, content);
			}
			// When scene editor is active, skip refresh/recompile to preserve terrain + scene state.
			// Settings are already saved to DB and applied via postMessage.
			if (gameEditorRef.current.enabled) {
				sendSettingsToGame(settings);
			} else if (currentOnFileUpdate && existingFile) {
				// Wait for SandpackFileSync to process the updated files, then full refresh
				setTimeout(() => {
					sandpackRefreshRef.current?.();
					// Send settings via postMessage after refresh starts loading
					setTimeout(() => sendSettingsToGame(settings), 1000);
				}, 600);
			} else {
				// First-time save: file not yet in state — refetch all files from API
				// so convertToSandpackFiles gets the new settings file
				const refreshFn = onFilesRefreshRef.current;
				if (refreshFn) {
					await refreshFn();
					// After files are refreshed, wait for SandpackFileSync + then reload
					setTimeout(() => {
						sandpackRefreshRef.current?.();
						setTimeout(() => sendSettingsToGame(settings), 1000);
					}, 800);
				} else {
					// Fallback: just refresh (settings won't apply until page reload)
					setTimeout(() => {
						sandpackRefreshRef.current?.();
						setTimeout(() => sendSettingsToGame(settings), 1000);
					}, 600);
				}
			}
		} finally {
			savingSettingsRef.current = false;
		}
	}, [appId, sendSettingsToGame]);

	// Debounced wrapper — coalesces rapid settings changes into a single save+rebuild
	const handleSaveSettings = useCallback((settings: import("../lib/game-editor-context").GameSettings) => {
		pendingSettingsRef.current = settings;
		if (saveSettingsTimerRef.current) clearTimeout(saveSettingsTimerRef.current);
		saveSettingsTimerRef.current = setTimeout(() => {
			const s = pendingSettingsRef.current;
			pendingSettingsRef.current = null;
			if (s) _doSaveSettings(s);
		}, 500);
	}, [_doSaveSettings]);

	// Active module panel (null = none open, module id = that module's panel)
	const [activeModulePanel, setActiveModulePanel] = useState<string | null>(null);
	const terrainPainterOpen = activeModulePanel === "terrain-painter";
	const setTerrainPainterOpen = (v: boolean | ((prev: boolean) => boolean)) => {
		setActiveModulePanel((prev) => {
			const wasOpen = prev === "terrain-painter";
			const next = typeof v === "function" ? v(wasOpen) : v;
			return next ? "terrain-painter" : null;
		});
	};
	// Modules dropdown in toolbar
	const [modulesDropdownOpen, setModulesDropdownOpen] = useState(false);

	// Close modules dropdown when editor is disabled
	useEffect(() => {
		if (!gameEditor.enabled) setModulesDropdownOpen(false);
	}, [gameEditor.enabled]);

	// Close modules dropdown on outside click
	useEffect(() => {
		if (!modulesDropdownOpen) return;
		const close = () => setModulesDropdownOpen(false);
		const timer = setTimeout(() => {
			window.addEventListener("click", close, { once: true });
		}, 0);
		return () => { clearTimeout(timer); window.removeEventListener("click", close); };
	}, [modulesDropdownOpen]);

	// Landscape/portrait rotation toggle for mobile-frame mode
	const [isLandscape, setIsLandscape] = useState(false);
	const toggleRotation = useCallback(() => setIsLandscape((v) => !v), []);

	// Phone frame scaling — same physical device always, CSS rotate for landscape
	const mobileContainerRef = useRef<HTMLDivElement>(null);
	const [phoneScale, setPhoneScale] = useState(0.75);
	// The phone frame is always portrait native dimensions
	const frameNativeW = PHONE_FRAME.bezelW + 6;
	const frameNativeH = PHONE_FRAME.bezelH + 12;

	useEffect(() => {
		if (!isMobileFrame) return;
		const container = mobileContainerRef.current;
		if (!container) return;

		const update = () => {
			const cw = container.clientWidth;
			const ch = container.clientHeight;
			if (cw > 0 && ch > 0) {
				const availW = cw - 48;
				const availH = ch - 16;
				if (isLandscape) {
					// Landscape: visual width = frameNativeH, visual height = frameNativeW (swapped)
					setPhoneScale(Math.min(1, availW / frameNativeH, availH / frameNativeW));
				} else {
					// Portrait: visual matches native dimensions
					setPhoneScale(Math.min(1, availW / frameNativeW, availH / frameNativeH));
				}
			}
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(container);
		return () => observer.disconnect();
	}, [isMobileFrame, isLandscape, frameNativeW, frameNativeH]);

	// View in Code callback for the toolbar
	const handleViewInCode = useCallback(
		(fileId: string, filePath: string, lineNumber: number) => {
			const file = files.find((f) => f.id === fileId);
			if (file?.content) {
				setCodeViewer({ filePath, content: file.content, lineNumber });
			}
		},
		[files],
	);

	// Register iframe ref with context once mounted
	useEffect(() => {
		// Query the Sandpack iframe
		const container = iframeContainerRef.current;
		if (!container) return;
		let registeredIframe: HTMLIFrameElement | null = null;
		const findIframe = () => {
			// For lightweight runtime, iframeRef.current is set directly by React's ref prop.
			// For Sandpack, it's set here via querySelector.
			const iframe = iframeRef.current || container.querySelector("iframe");
			if (iframe && iframe !== registeredIframe) {
				registeredIframe = iframe as HTMLIFrameElement;
				iframeRef.current = registeredIframe;
				visualEdit.setIframeRef(iframeRef as React.RefObject<HTMLIFrameElement | null>);
				gameEditor.setIframeRef(iframeRef as React.RefObject<HTMLIFrameElement | null>);
			}
		};
		findIframe();
		// Observe DOM changes to catch Sandpack iframe insertion
		const observer = new MutationObserver(findIframe);
		observer.observe(container, { childList: true, subtree: true });
		// Also retry after a short delay — React ref may be set after useEffect runs
		const retryTimer = setTimeout(findIframe, 100);
		return () => { observer.disconnect(); clearTimeout(retryTimer); };
	}, [visualEdit.setIframeRef, gameEditor.setIframeRef]);

	// Update iframe bounds when selection changes or window resizes
	useEffect(() => {
		if (!visualEdit.selectedElement || !iframeRef.current) {
			setIframeBounds(null);
			return;
		}
		const updateBounds = () => {
			if (iframeRef.current) {
				setIframeBounds(iframeRef.current.getBoundingClientRect());
			}
		};
		updateBounds();
		window.addEventListener("resize", updateBounds);
		window.addEventListener("scroll", updateBounds);
		return () => {
			window.removeEventListener("resize", updateBounds);
			window.removeEventListener("scroll", updateBounds);
		};
	}, [visualEdit.selectedElement]);

	// Listen for postMessage from Sandpack iframe
	// Uses refs to avoid re-attaching handler on every gameEditor/visualEdit state change
	useEffect(() => {
		const handler = (e: MessageEvent) => {
			const gameEditor = gameEditorRef.current;
			const visualEdit = visualEditRef.current;
			const data = e.data;
			if (!data || typeof data !== "object" || !data.type) return;
			try {
			if (data.type === "visual-edit-select") {
				visualEdit.selectElement({
					tagName: data.tagName,
					className: data.className,
					textContent: data.textContent,
					innerHTML: data.innerHTML,
					boundingRect: data.boundingRect,
					selector: data.selector,
					computedStyles: data.computedStyles,
					isDynamicContent: data.isDynamicContent,
				});
				// Update iframe bounds when an element is selected
				if (iframeRef.current) {
					setIframeBounds(iframeRef.current.getBoundingClientRect());
				}
			} else if (data.type === "visual-edit-deselect") {
				visualEdit.deselectElement();
			}
			// Game editor messages
			else if (data.type === "game-editor-bridge-loaded") {
				console.log("[GameEditor] Bridge loaded in iframe, editor enabled:", gameEditor.enabled);
				const iframe = iframeRef.current;
				// If editor is already enabled (user clicked before bridge loaded), re-send enable
				if (gameEditor.enabled && iframe?.contentWindow) {
					console.log("[GameEditor] Re-sending game-editor-enable to bridge");
					const activeScene = gameEditor.getActiveScene();
					iframe.contentWindow.postMessage({
						type: "game-editor-enable",
						cameraPosition: activeScene?.cameraPosition,
						cameraTarget: activeScene?.cameraTarget,
					}, "*");
				}
				// Send current game settings after bridge is ready
				if (iframe?.contentWindow) {
					setTimeout(() => {
						iframe.contentWindow?.postMessage({
							type: "applySettings",
							settings: gameEditor.gameSettings,
						}, "*");
					}, 200);
					// Re-apply FX preset on reload if set (bridge handles FX independently)
					const pp = gameEditor.gameSettings.postProcessing;
					if (pp?.preset && pp.preset !== "none") {
						setTimeout(() => {
							iframe.contentWindow?.postMessage({
								type: "game-editor-apply-fx",
								preset: pp.preset,
								bloomIntensity: pp.bloomIntensity,
								bloomThreshold: pp.bloomThreshold,
							}, "*");
						}, 2000);
					}
				}
				// Restore spawned objects from previous session (if any)
				if (spawnedObjectsRef.current.length > 0 && iframe?.contentWindow) {
					const objectsToRestore = [...spawnedObjectsRef.current];
					console.log("[GameEditor] Restoring", objectsToRestore.length, "spawned objects after reload");
					// Delay to let game scene fully initialize before sending restore command.
					// Auto-physics is triggered by the "game-editor-spawned-restored" completion
					// message from the bridge (no fixed timer — waits for all GLTF loads to finish).
					setTimeout(() => {
						iframe.contentWindow?.postMessage({ type: "game-editor-restore-spawned-objects", objects: objectsToRestore }, "*");
					}, 3000);
				}
				// Restore texture overrides for scene-original objects
				// First check persisted game settings (survives full page reload)
				if (textureOverridesRef.current.length === 0 && gameEditor.gameSettings.textureOverrides?.length) {
					textureOverridesRef.current = gameEditor.gameSettings.textureOverrides;
				}
				if (textureOverridesRef.current.length > 0 && iframe?.contentWindow) {
					const overrides = [...textureOverridesRef.current];
					console.log("[GameEditor] Restoring", overrides.length, "texture overrides after reload");
					setTimeout(() => {
						iframe.contentWindow?.postMessage({ type: "game-editor-apply-texture-overrides", overrides }, "*");
					}, 2000);
				}
				// Restore editor lights from game settings (both game mode and scene editor)
				const savedLights = gameEditor.gameSettings.lights;
				if (savedLights && savedLights.length > 0 && iframe?.contentWindow) {
					lightsRef.current = savedLights;
					console.log("[GameEditor] Restoring", savedLights.length, "lights after reload");
					setTimeout(() => {
						iframe.contentWindow?.postMessage({ type: "game-editor-restore-lights", lights: savedLights }, "*");
					}, 2500);
				}
				// Restore sky-weather config on reload/bridge-load if module is installed
				const swCfg = gameEditor.gameSettings.skyWeather;
				if (swCfg && iframe?.contentWindow) {
					const swModule = gameEditor.gameSettings.modules?.installed?.["sky-weather"];
					const isSwInstalled = swModule?.enabled;
					if (isSwInstalled) {
						setTimeout(() => {
							console.log("[GameEditor] Restoring sky-weather config after bridge load");
							iframe.contentWindow?.postMessage({
								type: "sky-weather-update-config",
								config: swCfg,
							}, "*");
							// Also restore time
							if (swCfg.time?.solarTime !== undefined) {
								iframe.contentWindow?.postMessage({
									type: "sky-weather-set-time",
									solarTime: swCfg.time.solarTime,
									autoAdvance: swCfg.time.autoAdvance,
									cycleLengthMinutes: swCfg.time.cycleLengthMinutes,
								}, "*");
							}
						}, 3000); // After module initialization
					}
				}
				// Auto-generate terrain after bridge load if terrain config exists
				// Works in BOTH Scene editor mode and Game mode
				// Skip if we just exited scene editor — the exit handler already triggers terrain gen
				if (justExitedEditorRef.current) {
					justExitedEditorRef.current = false;
				} else if (iframe?.contentWindow) {
					const terrainCfg = gameEditor.gameSettings.terrain;
					const _inst = gameEditor.gameSettings.modules?.installed;
					const terrainModuleInstalled = _inst && typeof _inst === "object"
						? (Array.isArray(_inst)
							? _inst.some((m: any) => m.id === "terrain-painter" && m.enabled !== false)
							: !!(_inst as any)["terrain-painter"]?.enabled)
						: false;
					if (terrainCfg?.enabled && terrainModuleInstalled) {
						// Scene editor: 3s (bridge already active). Game mode: 8s (wait for IIFE + GLTF loads)
						const terrainDelay = gameEditor.enabled ? 3000 : 8000;
						setTimeout(() => {
							console.log("[GameEditor] Auto-generating terrain after bridge load (editor:", gameEditor.enabled, ") biome:", terrainCfg.biome || "default");
							iframe.contentWindow?.postMessage({
								type: "terrain-painter-generate-terrain",
								settings: {
									terrainWidth: terrainCfg.width || 200,
									terrainDepth: terrainCfg.depth || 200,
									terrainHeightScale: terrainCfg.heightScale || 40,
									terrainSegments: terrainCfg.segments || 256,
									sculptHeightData: terrainCfg.sculptHeightData || null,
								},
								biome: terrainCfg.biome || null,
								seed: terrainCfg.seed || 0,
							}, "*");
							if (terrainCfg.layers && terrainCfg.layers.length > 0) {
								const _defMods = [
									[{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0, max: 0.2, minFalloff: 0.02, maxFalloff: 0.08 } }, { type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 25, minFalloff: 5, maxFalloff: 10 } }],
									[{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.03, max: 0.35, minFalloff: 0.03, maxFalloff: 0.1 } }, { type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 30, minFalloff: 3, maxFalloff: 10 } }],
									[{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.1, max: 0.95, minFalloff: 0.08, maxFalloff: 0.1 } }],
									[{ type: "Height", enabled: true, blendMode: "Multiply", opacity: 100, params: { min: 0.72, max: 1.0, minFalloff: 0.08, maxFalloff: 0.02 } }, { type: "Slope", enabled: true, blendMode: "Multiply", opacity: 100, params: { minAngle: 0, maxAngle: 45, minFalloff: 5, maxFalloff: 10 } }],
								];
								setTimeout(() => {
									iframe.contentWindow?.postMessage({
										type: "terrain-painter-repaint",
										layers: terrainCfg.layers!.map((l: any, idx: number) => ({
											name: l.textureUrl?.split("/").pop()?.replace(/\.[^.]+$/, "") || "Layer",
											enabled: l.enabled !== false,
											diffuseUrl: l.textureUrl || "",
											tileSize: l.tileSize || 4,
											opacity: l.opacity != null ? l.opacity : 100,
											roughness: l.roughness != null ? l.roughness : 0.85,
											normalIntensity: l.normalIntensity != null ? l.normalIntensity : 1.0,
											metallic: l.metallic || false,
											modifiers: l.modifiers && l.modifiers.length > 0 ? l.modifiers : (_defMods[idx] || []),
											materialId: l.materialId,
											emissionUrl: l.emissionUrl,
											emissionIntensity: l.emissionIntensity,
										})),
									}, "*");
								}, 1000);
							}
						}, terrainDelay);
					}
				}
			} else if (data.type === "game-editor-scene-tree") {
				gameEditor.updateSceneTree(data.tree);
			} else if (data.type === "game-editor-object-selected") {
				gameEditor.updateSelectedObject({
					uuid: data.uuid,
					name: data.name,
					type: data.objType || data.type,
					position: data.position,
					rotation: data.rotation,
					scale: data.scale,
					visible: data.visible,
					castShadow: data.castShadow,
					userData: data.userData,
					_materialColor: data._materialColor,
					_textureUrl: data._textureUrl,
					_textureTileX: data._textureTileX,
					_textureTileY: data._textureTileY,
					_textureRotation: data._textureRotation,
					_textureOffsetX: data._textureOffsetX,
					_textureOffsetY: data._textureOffsetY,
					// Light properties
					_isEditorLight: data._isEditorLight,
					_lightType: data._lightType,
					_lightColor: data._lightColor,
					_lightIntensity: data._lightIntensity,
					_lightDistance: data._lightDistance,
					_lightDecay: data._lightDecay,
					_lightAngle: data._lightAngle,
					_lightPenumbra: data._lightPenumbra,
					_lightTarget: data._lightTarget,
				});
				// Live-sync player character position to Game Settings spawn
				// Only auto-sync when pick-spawn mode is active (not on every selection)
				const isPlayer = data.userData?.__isPlayerCharacter
					|| data.userData?.vibexeType === "player"
					|| data.userData?.vibexeType === "AnimatedCharacter"
					|| data.name?.startsWith("Character_")
					|| data.name?.startsWith("Player_");
				if (isPlayer && data.position && gameEditor.pickSpawnActive) {
					gameEditor.updateGameSettings({
						player: {
							spawnX: Math.round(data.position.x * 100) / 100,
							spawnY: Math.round(data.position.y * 100) / 100,
							spawnZ: Math.round(data.position.z * 100) / 100,
						},
					});
				}
			} else if (data.type === "game-editor-object-deselected") {
				gameEditor.updateSelectedObject(null);
			} else if (data.type === "game-editor-gizmo-mode") {
				gameEditor.setGizmoMode(data.mode as GizmoMode);
			} else if (data.type === "game-editor-snap-changed") {
				gameEditor.setSnapEnabled(!!data.snap);
			} else if (data.type === "game-editor-gizmo-space") {
				gameEditor.setGizmoSpace(data.space as "world" | "local");
			} else if (data.type === "game-editor-camera-orientation") {
				gameEditor.setCameraQuaternion(data.quaternion);
			} else if (data.type === "game-editor-camera-state") {
				// Persist camera position/target from the bridge into the active scene
				if (data.position && data.target) {
					const sceneId = gameEditor.activeSceneId;
					if (sceneId) {
						gameEditor.updateSceneCamera(sceneId, data.position, data.target);
					}
				}
			} else if (data.type === "game-editor-projection-changed") {
				gameEditor.setEditorProjection(data.projection as "perspective" | "orthographic");
			} else if (data.type === "game-editor-pivot-mode-changed") {
				gameEditor.setPivotMode(data.mode as "center" | "pivot");
			} else if (data.type === "game-editor-camera-moved") {
				// TC drag on camera — debounced update to inspector + settings
				if (gameEditor.selectedObject?.userData?._isSyntheticCameraNode && data.position) {
					if (cameraMoveTimer.current) clearTimeout(cameraMoveTimer.current);
					cameraMoveTimer.current = setTimeout(() => {
						cameraMoveTimer.current = null;
						gameEditor.updateSelectedObject({
							...gameEditor.selectedObject!,
							position: data.position,
						});
						gameEditor.setGameSettings({
							...gameEditor.gameSettings,
							camera: {
								...gameEditor.gameSettings.camera,
								offsetY: data.offsetY,
								offsetZ: data.offsetZ,
							},
						});
					}, 200);
				}
			} else if (data.type === "game-editor-undo-redo-state") {
				gameEditor.setUndoRedoState(!!data.canUndo, !!data.canRedo);
			} else if (data.type === "game-editor-object-duplicated") {
				gameEditor.requestSceneTree();
			} else if (data.type === "game-editor-request-group") {
				gameEditor.groupSelected();
			} else if (data.type === "game-editor-objects-grouped" || data.type === "game-editor-objects-ungrouped") {
				gameEditor.requestSceneTree();
			} else if (data.type === "game-editor-scene-dirty") {
				gameEditor.setDirty(true);
			} else if (data.type === "game-editor-object-deleted") {
				const deletedName = data.name as string;
				if (deletedName && !deletedObjectsRef.current.includes(deletedName)) {
					deletedObjectsRef.current = [...deletedObjectsRef.current, deletedName];
					// Auto-persist deletion to source code so it survives reload (Bug #7)
					const delFiles = filesRef.current;
					const delOnUpdate = onFileUpdateRef.current;
					const delSceneFile = delFiles.find((f) => f.path?.includes("GameScene3D"));
					if (delSceneFile?.content && delOnUpdate) {
						const delCode = updateTransformInSource(
							delSceneFile.content, "__del_marker__",
							{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 },
							null, undefined, deletedObjectsRef.current
						).replace(/"__del_marker__":\{[^}]*\},?/g, "").replace(/,\}/g, "}");
						if (delCode !== delSceneFile.content) {
							delOnUpdate(delSceneFile.id, delCode);
							fetch(`/api/app-builder/apps/${appId}/files`, {
								method: "PUT",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ path: delSceneFile.path, content: delCode }),
							}).catch(() => {});
						}
					}
				}
				// Refresh scene tree so hierarchy reflects the deletion
				gameEditor.requestSceneTree();
				// If the deleted object was selected, deselect it
				if (data.uuid && gameEditor.selectedObject?.uuid === data.uuid) {
					gameEditor.updateSelectedObject(null);
				}
			} else if (data.type === "game-editor-animation-clips") {
				gameEditor.setAnimationClips(data.clips || [], data.currentClip, data.animMap, data.clipDurations);
			} else if (data.type === "game-editor-animation-progress") {
				gameEditor.updateAnimProgress(data.time ?? 0, data.duration ?? 0, data.clipName ?? null, data.paused ?? false);
			} else if (data.type === "game-editor-do-spawn") {
				// Spawn mode: bridge raycast found a position, forward spawn to iframe
				gameEditor.spawnObject(data.factory, data.position, data.args);
			} else if (data.type === "game-editor-object-spawned") {
				gameEditor.requestSceneTree();
				gameEditor.setDirty(true);
				// Register spawn for undo (bridge tracks by uuid, same as duplicate undo)
				const iframe = iframeRef.current;
				if (iframe?.contentWindow && data.uuid) {
					iframe.contentWindow.postMessage({ type: "game-editor-register-spawn-undo", uuid: data.uuid }, "*");
				}
				// Collect all spawned objects so we can restore them after refresh
				if (iframe?.contentWindow) {
					iframe.contentWindow.postMessage({ type: "game-editor-get-spawned-objects" }, "*");
				}
			} else if (data.type === "game-editor-spawned-objects") {
				// Store spawned objects for restoration after restart
				spawnedObjectsRef.current = data.objects || [];
				// Store texture overrides for scene-original objects + persist to DB
				if (data.textureOverrides && data.textureOverrides.length > 0) {
					textureOverridesRef.current = data.textureOverrides;
					// Persist to game settings so they survive full page reload
					const texOverrides = data.textureOverrides.map((o: any) => ({
						name: o.name,
						textureUrl: o.textureUrl,
						tileX: o.tileX || 1,
						tileY: o.tileY || 1,
						hasPBR: !!o.hasPBR,
					}));
					gameEditor.updateGameSettings({ textureOverrides: texOverrides });
				}
			} else if (data.type === "game-editor-spawned-restored") {
				// All spawned objects finished loading (GLTF loads complete) — now run auto-physics
				console.log("[GameEditor] Spawned objects restored (" + (data.count || 0) + "), running auto-physics");
				const iframe = iframeRef.current;
				if (iframe?.contentWindow) {
					iframe.contentWindow.postMessage({ type: "run-auto-physics" }, "*");
				}
			} else if (data.type === "terrain-heightmap-data") {
				// Store sculpt heightmap data for persistence and save to DB
				if (data.data && typeof data.data === "string") {
					const terrainCfg = gameEditor.gameSettings.terrain;
					if (terrainCfg) {
						terrainCfg.sculptHeightData = data.data;
						console.log("[GameEditor] Stored sculpt heightmap:", data.vertexCount, "vertices");
						// Persist sculpt data to DB so it survives page reload
						const updatedSettings = { ...gameEditor.gameSettings, terrain: { ...terrainCfg } };
						handleSaveSettings(updatedSettings);
					}
				}
			} else if (data.type === "game-editor-all-transforms") {
				// Resolve pending save-all-transforms promise
				if (allTransformsResolverRef.current) {
					allTransformsResolverRef.current(data.transforms || {});
					allTransformsResolverRef.current = null;
				}
			} else if (data.type === "game-editor-persist-transform") {
				// Persist transform changes to source code — debounced to max 1 write per 400ms
				const objName = data.name as string;
				if (!objName) return;
				pendingTransformRef.current = {
					name: objName,
					pos: data.position as { x: number; y: number; z: number },
					rot: data.rotation as { x: number; y: number; z: number },
					scl: data.scale as { x: number; y: number; z: number },
				};
				if (persistTransformTimerRef.current) return; // already scheduled
				persistTransformTimerRef.current = setTimeout(() => {
					persistTransformTimerRef.current = null;
					const pending = pendingTransformRef.current;
					pendingTransformRef.current = null;
					if (!pending) return;
					const currentFiles = filesRef.current;
					const currentOnFileUpdate = onFileUpdateRef.current;
					if (!currentOnFileUpdate) return;
					const sceneFile = currentFiles.find((f) => f.path?.includes("GameScene3D"));
					if (!sceneFile?.content) return;
					const updated = updateTransformInSource(sceneFile.content, pending.name, pending.pos, pending.rot, pending.scl);
					if (updated !== sceneFile.content) {
						sceneModifiedDuringEditRef.current = true;
						currentOnFileUpdate(sceneFile.id, updated);
						fetch(`/api/app-builder/apps/${appId}/files`, {
							method: "PUT",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ path: sceneFile.path, content: updated }),
						}).catch((err) => console.warn("[GameEditor] DB save failed:", err));
					}
				}, 400);
			} else if (data.type === "game-editor-scene-state") {
				// Bridge responded with current scene's object/camera state for scene switching
				const sceneId = data.sceneId as string;
				const objects = (data.objects || []) as SceneObjectDef[];
				const cameraPos = data.cameraPosition as number[] | undefined;
				const cameraTarget = data.cameraTarget as number[] | undefined;
				if (sceneId) {
					gameEditor.updateSceneObjects(sceneId, objects);
					if (cameraPos && cameraTarget) {
						gameEditor.updateSceneCamera(sceneId, cameraPos, cameraTarget);
					}
					console.log("[GameEditor] Saved scene state for:", sceneId, objects.length, "objects");
				}
			} else if (data.type === "game-editor-scene-loaded") {
				// Bridge finished loading a scene -- request fresh scene tree
				gameEditor.requestSceneTree();
				console.log("[GameEditor] Scene loaded:", data.sceneId);
			} else if (data.type === "game-request-load-scene") {
				// Game code requested a scene switch via game.loadScene(sceneName)
				const sceneName = data.sceneName as string;
				if (sceneName) {
					const targetScene = gameEditor.scenes.find(
						(s) => s.name === sceneName || s.id === sceneName
					);
					if (targetScene) {
						console.log("[GameEditor] Game requested scene switch to:", targetScene.name);
						gameEditor.switchScene(targetScene.id);
					} else {
						console.warn("[GameEditor] Scene not found:", sceneName);
					}
				}
			} else if (data.type === "vibexe-character-swapped") {
				// Character system swapped the player — refresh scene tree so new character appears in hierarchy
				console.log("[GameEditor] Character swapped to:", data.characterName);
				if (gameEditor.enabled) gameEditor.requestSceneTree();
			} else if (data.type === "game-editor-scene-changed") {
				// Generic scene change notification — refresh tree
				if (gameEditor.enabled) gameEditor.requestSceneTree();
			} else if (data.type === "game-editor-light-added") {
				// Track new light in lightsRef and persist to game settings
				const lightData = {
					name: data.name as string,
					type: data.lightType as "point" | "spot",
					color: (data.color as string) || "#ffffff",
					intensity: (data.intensity as number) || 1,
					position: data.position as { x: number; y: number; z: number },
					distance: data.distance as number | undefined,
					decay: data.decay as number | undefined,
					angle: data.angle as number | undefined,
					penumbra: data.penumbra as number | undefined,
					target: data.target as { x: number; y: number; z: number } | undefined,
				};
				lightsRef.current = [...lightsRef.current, lightData];
				gameEditor.updateGameSettings({ lights: lightsRef.current });
				handleSaveSettings({ ...gameEditor.gameSettings, lights: lightsRef.current });
				gameEditor.requestSceneTree();
			} else if (data.type === "game-editor-light-removed") {
				lightsRef.current = lightsRef.current.filter((l) => l.name !== data.name);
				gameEditor.updateGameSettings({ lights: lightsRef.current });
				handleSaveSettings({ ...gameEditor.gameSettings, lights: lightsRef.current });
			} else if (data.type === "game-editor-lights-collected") {
				// Update lightsRef from bridge (authoritative source during editor session)
				lightsRef.current = data.lights || [];
				gameEditor.updateGameSettings({ lights: lightsRef.current });
			} else if (data.type === "game-editor-lights-restored") {
				console.log("[GameEditor] Lights restored:", data.count);
			} else if (data.type === "game-editor-player-position-update") {
				// When user drags the player character in scene editor, debounce spawn position update
				// to prevent 60fps React re-renders during gizmo drag
				if (data.position) {
					if (playerPosUpdateTimer.current) clearTimeout(playerPosUpdateTimer.current);
					playerPosUpdateTimer.current = setTimeout(() => {
						playerPosUpdateTimer.current = null;
						gameEditor.updateGameSettings({
							player: {
								spawnX: Math.round(data.position.x * 100) / 100,
								spawnY: Math.round(data.position.y * 100) / 100,
								spawnZ: Math.round(data.position.z * 100) / 100,
							},
						});
					}, 250);
				}
			} else if (data.type === "game-editor-ground-click") {
				// Ground/terrain click with no object hit — used for pick-spawn/pick-respawn
				if (gameEditor.pickSpawnActive && data.position) {
					gameEditor.updateGameSettings({
						player: {
							spawnX: data.position.x,
							spawnY: data.position.y + 1,
							spawnZ: data.position.z,
						},
					});
					gameEditor.togglePickSpawn();
				} else if (gameEditor.pickRespawnActive && data.position) {
					gameEditor.updateGameSettings({
						player: {
							respawnY: data.position.y,
						},
					});
					gameEditor.togglePickRespawn();
				}
			}
			} catch (err) {
				console.error("[MessageHandler] Error processing message:", data.type, err);
			}
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, []); // eslint-disable-line react-hooks/exhaustive-deps -- uses refs for stable access

	// When exiting Scene Editor after transforms were modified, refresh Sandpack
	// so the game reloads with SCENE_EDITOR_OVERRIDES applied from source code.
	const prevEditorEnabledRef = useRef(false);
	const justExitedEditorRef = useRef(false);
	useEffect(() => {
		const wasEnabled = prevEditorEnabledRef.current;
		prevEditorEnabledRef.current = gameEditor.enabled;
		if (wasEnabled && !gameEditor.enabled) {
			// Flag to suppress duplicate terrain gen from bridge-loaded handler
			justExitedEditorRef.current = true;
			// Request heightmap data before bridge deactivates (for sculpt persistence)
			const iframe = iframeRef.current;
			if (iframe?.contentWindow && gameEditor.gameSettings.terrain?.enabled) {
				iframe.contentWindow.postMessage({ type: "terrain-get-heightmap" }, "*");
			}
			// Collect latest light positions from bridge before deactivation
			if (iframe?.contentWindow && lightsRef.current.length > 0) {
				iframe.contentWindow.postMessage({ type: "game-editor-collect-lights" }, "*");
			}
			// Send sky-weather config to iframe on Scene→Game transition
			const swCfg = gameEditor.gameSettings.skyWeather;
			if (swCfg && iframe?.contentWindow) {
				const swMod = gameEditor.gameSettings.modules?.installed?.["sky-weather"];
				const isSwInstalled = swMod?.enabled;
				if (isSwInstalled) {
					setTimeout(() => {
						console.log("[GameEditor] Restoring sky-weather config after Scene→Game exit");
						iframe.contentWindow?.postMessage({
							type: "sky-weather-update-config",
							config: swCfg,
						}, "*");
						if (swCfg.time?.solarTime !== undefined) {
							iframe.contentWindow?.postMessage({
								type: "sky-weather-set-time",
								solarTime: swCfg.time.solarTime,
								autoAdvance: swCfg.time.autoAdvance,
								cycleLengthMinutes: swCfg.time.cycleLengthMinutes,
							}, "*");
						}
					}, 1500); // After bridge deactivation
				}
			}
			// Refresh sandpack if objects were moved during edit session
			if (sceneModifiedDuringEditRef.current) {
				console.log("[GameEditor] Scene modified during edit session — refreshing preview to apply overrides");
				sceneModifiedDuringEditRef.current = false;
				setTimeout(() => { sandpackRefreshRef.current?.(); }, 400);
			}
			// Always auto-regenerate terrain on Scene→Game transition if terrain config exists
			const terrainCfg = gameEditor.gameSettings.terrain;
			const _inst2 = gameEditor.gameSettings.modules?.installed;
			const terrainModuleInstalled = _inst2 && typeof _inst2 === "object"
				? (Array.isArray(_inst2)
					? _inst2.some((m: any) => m.id === "terrain-painter" && m.enabled !== false)
					: !!(_inst2 as any)["terrain-painter"]?.enabled)
				: false;
			if (terrainCfg?.enabled && terrainModuleInstalled) {
				// Terrain regeneration is handled by the IIFE's _autoTerrain() which runs
				// AFTER the recompile settles (new bundle injected). This avoids the race
				// condition where React-level generate creates terrain, then recompile
				// destroys it, and repaint arrives at an empty scene.
				// The IIFE's _autoTerrain reads biome+seed+layers from saved game settings.
				console.log("[GameEditor] Terrain will auto-regenerate via IIFE after recompile settles");
			}
		}
	}, [gameEditor.enabled]);

	// Warn before leaving with unsaved changes
	useEffect(() => {
		if (!isGameMode) return;
		const handler = (e: BeforeUnloadEvent) => {
			if (gameEditor.isDirty) { e.preventDefault(); e.returnValue = ""; }
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [isGameMode, gameEditor.isDirty]);

	// Keyboard shortcuts for visual edit
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// Don't intercept if focus is in an input/textarea
			const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
			if (tag === "input" || tag === "textarea" || tag === "select") return;

			if (e.key === "Escape" && visualEdit.enabled) {
				if (visualEdit.selectedElement) {
					visualEdit.deselectElement();
				} else {
					visualEdit.setEnabled(false);
				}
				e.preventDefault();
			}
			if (e.key === "v" && !e.ctrlKey && !e.metaKey && !e.altKey) {
				visualEdit.toggleVisualEdit();
				e.preventDefault();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [visualEdit]);

	// Forward keyboard shortcuts to bridge when game editor is active
	useEffect(() => {
		if (!gameEditor.enabled) return;
		const handler = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
			if (tag === "input" || tag === "textarea" || tag === "select") return;
			const iframe = iframeRef.current;
			if (!iframe?.contentWindow) return;
			// Ctrl+G — Group selected objects (handled at parent level, multi-select state lives here)
			const key = e.key.toLowerCase();
			if ((e.ctrlKey || e.metaKey) && key === "g") {
				gameEditor.groupSelected();
				e.preventDefault();
				return;
			}
			// Forward relevant keys
			const forwarded = ["f", "g", "w", "e", "r", "q", "x", "escape", "delete", "backspace"].includes(key)
				|| ((e.ctrlKey || e.metaKey) && (key === "z" || key === "y" || key === "d"));
			if (forwarded) {
				iframe.contentWindow.postMessage({
					type: "game-editor-viewport-keydown",
					key: e.key,
					ctrlKey: e.ctrlKey,
					metaKey: e.metaKey,
					shiftKey: e.shiftKey,
				}, "*");
				e.preventDefault();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [gameEditor.enabled]);

	// Forward mouse events from parent page to Sandpack iframe via postMessage
	// This is needed because native mouse events don't reliably propagate into cross-origin iframes
	useEffect(() => {
		if (!gameEditor.enabled) return;
		let lastClickTime = 0;
		let dragging = false;

		const getIframeCoords = (e: MouseEvent) => {
			const iframe = iframeRef.current;
			if (!iframe) return null;
			const rect = iframe.getBoundingClientRect();
			return { iframe, rect, x: e.clientX - rect.left, y: e.clientY - rect.top };
		};

		const handleMouseDown = (e: MouseEvent) => {
			if (e.button !== 0) return;
			const info = getIframeCoords(e);
			if (!info) return;
			const { iframe, rect } = info;
			// Only forward clicks that land on the iframe area
			if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
			// Don't forward if clicking on the game editor panel (overlaid on right side)
			const target = e.target as HTMLElement;
			if (target.closest("[data-game-editor-panel]")) return;

			const now = Date.now();
			const isDoubleClick = (now - lastClickTime) < 300;
			lastClickTime = now;
			dragging = true;

			iframe.contentWindow?.postMessage({
				type: "game-editor-viewport-click",
				clientX: info.x,
				clientY: info.y,
				isDoubleClick,
			}, "*");
		};

		const handleMouseMove = (e: MouseEvent) => {
			if (!dragging) return;
			const info = getIframeCoords(e);
			if (!info) return;
			info.iframe.contentWindow?.postMessage({
				type: "game-editor-viewport-mousemove",
				clientX: info.x,
				clientY: info.y,
			}, "*");
		};

		const handleMouseUp = (e: MouseEvent) => {
			if (!dragging) return;
			dragging = false;
			const info = getIframeCoords(e);
			if (!info) return;
			info.iframe.contentWindow?.postMessage({
				type: "game-editor-viewport-mouseup",
				clientX: info.x,
				clientY: info.y,
			}, "*");
		};

		window.addEventListener("mousedown", handleMouseDown, true);
		window.addEventListener("mousemove", handleMouseMove, true);
		window.addEventListener("mouseup", handleMouseUp, true);
		return () => {
			window.removeEventListener("mousedown", handleMouseDown, true);
			window.removeEventListener("mousemove", handleMouseMove, true);
			window.removeEventListener("mouseup", handleMouseUp, true);
		};
	}, [gameEditor.enabled]);

	// Detect language from generated files (Blueprint.md or App.tsx may contain lang hints)
	const langConfig = useMemo((): SandpackLanguageConfig | undefined => {
		for (const f of files) {
			if (!f.content) continue;
			// Check for explicit lang/dir markers the AI may have included
			const langMatch = f.content.match(/(?:lang|language)[=:]\s*["']?([a-z]{2}(?:-[A-Z]{2})?)["']?/i);
			const dirMatch = f.content.match(/dir[=:]\s*["']?(rtl|ltr)["']?/i);
			if (langMatch) {
				const code = langMatch[1].toLowerCase();
				return { lang: code, dir: isRtlLanguage(code) ? "rtl" : "ltr" };
			}
			if (dirMatch && dirMatch[1].toLowerCase() === "rtl") {
				// RTL detected but no specific lang — check content for Hebrew/Arabic chars
				const allContent = files.map((x) => x.content || "").join("");
				const hebrewCount = (allContent.match(/[\u0590-\u05FF]/g) || []).length;
				const arabicCount = (allContent.match(/[\u0600-\u06FF]/g) || []).length;
				const lang = hebrewCount > arabicCount ? "he" : arabicCount > 0 ? "ar" : "he";
				return { lang, dir: "rtl" };
			}
		}
		// Scan all file content for non-Latin script to auto-detect
		const allText = files.map((f) => f.content || "").join("");
		const hebrewChars = (allText.match(/[\u0590-\u05FF]/g) || []).length;
		const arabicChars = (allText.match(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
		const cjkChars = (allText.match(/[\u4E00-\u9FFF\u3040-\u30FF]/g) || []).length;
		if (hebrewChars > 20) return { lang: "he", dir: "rtl" };
		if (arabicChars > 20) return { lang: "ar", dir: "rtl" };
		if (cjkChars > 20) return { lang: "zh", dir: "ltr" };
		return undefined; // Default English LTR
	}, [files]);

	// Convert files to Sandpack format
	// Pass the real origin so the SDK calls vibexe.online APIs (not the Sandpack iframe's origin)
	const apiOrigin = typeof window !== "undefined" ? window.location.origin : "";
	const sandpackFiles = useMemo(() => convertToSandpackFiles(files, langConfig, apiOrigin, appId), [files, langConfig, apiOrigin, appId]);
	const dependencies = useMemo(() => extractDependencies(files), [files]);

	// Lightweight runtime: use server-compiled iframe instead of Sandpack for 3D games
	// Eliminates ~15-20 FPS overhead from in-browser bundling
	const useLightweightRuntime = isGameMode && !!dependencies.three;

	// Enabled module IDs for lightweight runtime compiler
	const enabledModuleIds = useMemo(() => {
		const installed = gameEditor.gameSettings?.modules?.installed;
		if (!installed) return [] as string[];
		return Object.entries(installed)
			.filter(([, mod]) => (mod as { enabled?: boolean })?.enabled)
			.map(([id]) => id);
	}, [gameEditor.gameSettings?.modules?.installed]);

	// Visual Edit bridge loaded as external script (bypasses Sandpack's bundler)
	// Phaser CDN loaded when game projects use it (Sandpack's bundler can't handle the 4MB package)
	const externalResources = useMemo(() => {
		const resources = ["https://cdn.tailwindcss.com"];
		if (dependencies.phaser) {
			resources.push("https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js");
		}
		// Three.js r172 is loaded via CJS shim in sandpack-adapter.ts (no UMD/global scripts in r160+)
		// No externalResources needed for Three.js — the shim handles core + all addons
		// Bridge MUST load AFTER Three.js CDN — game editor bridge checks window.THREE on init
		if (typeof window !== "undefined") {
			resources.push(`${window.location.origin}/api/app-builder/bridge?v=89`);
		}
		return resources;
	}, [dependencies, isGameMode]);

	// Calculate preview width based on device
	const previewWidth = DEVICE_SIZES[device].width;

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-transparent">
			{/* Inject Sandpack styles */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Internal CSS string constant, not user input */}
			<style dangerouslySetInnerHTML={{ __html: sandpackFullHeightStyles }} />

			{/* Glass toolbar */}
			<div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.03]">
				{/* Glass device toggles */}
				<div className="flex items-center gap-1">
					{isMobileFrame ? (
						/* Mobile-frame mode: mobile indicator + rotate button */
						<div className="flex items-center gap-1.5">
							<div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl bg-white/[0.08] text-white/90 border border-white/[0.12]">
								<Smartphone className="w-3.5 h-3.5" />
								<span className="hidden sm:inline">Mobile</span>
							</div>
							<button
								type="button"
								onClick={toggleRotation}
								className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl transition-all duration-200 ${
									isLandscape
										? "bg-white/[0.08] text-white/90 border border-white/[0.12]"
										: "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
								}`}
								title={isLandscape ? "Portrait (9:16)" : "Landscape (16:9)"}
							>
								<RotateCw className="w-3.5 h-3.5" />
								<span className="hidden sm:inline">
									{isLandscape ? "Portrait" : "Landscape"}
								</span>
							</button>
						</div>
					) : (
						(Object.keys(DEVICE_SIZES) as DeviceSize[]).map((size) => {
							const Icon =
								size === "desktop"
									? Monitor
									: size === "tablet"
										? Tablet
										: Smartphone;
							const isActive = device === size;
							return (
								<button
									type="button"
									key={size}
									onClick={() => setDevice(size)}
									className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl transition-all duration-200 ${
										isActive
											? "bg-white/[0.08] text-white/90 border border-white/[0.12]"
											: "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
									}`}
									title={DEVICE_SIZES[size].label}
								>
									<Icon className="w-3.5 h-3.5" />
									<span className="hidden sm:inline">
										{DEVICE_SIZES[size].label}
									</span>
								</button>
							);
						})
					)}
				</div>

				{/* Visual Edit / Scene Editor toggle + Preview link + Actions */}
				<div className="flex items-center gap-2">
					{isGameMode && dependencies.three ? (
						<>
							<div className="flex items-center bg-white/[0.04] rounded-xl border border-white/[0.08] overflow-hidden">
								<button
									type="button"
									onClick={() => { if (!gameEditor.enabled) gameEditor.toggleEditor(); }}
									className={`px-3 py-1.5 text-xs transition-all ${
										gameEditor.enabled
											? "bg-emerald-500/[0.15] text-emerald-300"
											: "text-white/40 hover:text-white/60"
									}`}
								>
									Scene
								</button>
								<div className="w-px h-4 bg-white/[0.08]" />
								<button
									type="button"
									onClick={() => { if (gameEditor.enabled) gameEditor.toggleEditor(); }}
									className={`px-3 py-1.5 text-xs transition-all ${
										!gameEditor.enabled
											? "bg-blue-500/[0.15] text-blue-300"
											: "text-white/40 hover:text-white/60"
									}`}
								>
									Game
								</button>
							</div>
							{gameEditor.enabled && (
								<div className="flex items-center gap-0.5 border-l border-white/[0.08] pl-2">
									{([
										{ mode: "pan" as const, icon: Hand, label: "Pan (Q)", key: "Q" },
										{ mode: "translate" as const, icon: Move, label: "Move (W)", key: "W" },
										{ mode: "rotate" as const, icon: RotateCcw, label: "Rotate (E)", key: "E" },
										{ mode: "scale" as const, icon: Scaling, label: "Scale (R)", key: "R" },
									]).map(({ mode, icon: Icon, label, key }) => (
										<button
											key={mode}
											type="button"
											onClick={() => gameEditor.setGizmoMode(mode)}
											className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-all duration-150 ${
												gameEditor.gizmoMode === mode
													? "bg-emerald-500/[0.15] text-emerald-300"
													: "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
											}`}
											title={label}
										>
											<Icon className="w-3.5 h-3.5" />
											<span className="hidden lg:inline">{key}</span>
										</button>
									))}
									<button
										type="button"
										onClick={gameEditor.toggleSnap}
										className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-all duration-150 ${
											gameEditor.snapEnabled
												? "bg-amber-500/[0.15] text-amber-300"
												: "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
										}`}
										title="Grid Snap (G)"
									>
										<Grid3X3 className="w-3.5 h-3.5" />
									</button>
									<button
										type="button"
										onClick={gameEditor.toggleGizmoSpace}
										className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-all duration-150 ${
											gameEditor.gizmoSpace === "local"
												? "bg-blue-500/[0.15] text-blue-300"
												: "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
										}`}
										title={gameEditor.gizmoSpace === "world" ? "World Space (X)" : "Local Space (X)"}
									>
										{gameEditor.gizmoSpace === "world" ? <Globe className="w-3.5 h-3.5" /> : <Crosshair className="w-3.5 h-3.5" />}
									</button>
									{gameEditor.selectedObject && (
										<button
											type="button"
											onClick={gameEditor.togglePivotMode}
											className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-all duration-150 ${
												gameEditor.pivotMode === "pivot"
													? "bg-violet-500/[0.15] text-violet-300"
													: "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
											}`}
											title={gameEditor.pivotMode === "center" ? "Center (orbit center fixed)" : "Pivot (orbit follows selection)"}
										>
											<Crosshair className="w-3.5 h-3.5" />
											<span className="text-[10px]">{gameEditor.pivotMode === "pivot" ? "Pivot" : "Center"}</span>
										</button>
									)}
									<button
										type="button"
										onClick={gameEditor.undoAction}
										className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-all duration-150 ${
											gameEditor.canUndo
												? "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
												: "text-white/15 cursor-not-allowed"
										}`}
										title="Undo (Ctrl+Z)"
										disabled={!gameEditor.canUndo}
									>
										<Undo2 className="w-3.5 h-3.5" />
									</button>
									<button
										type="button"
										onClick={gameEditor.redoAction}
										className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-all duration-150 ${
											gameEditor.canRedo
												? "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
												: "text-white/15 cursor-not-allowed"
										}`}
										title="Redo (Ctrl+Shift+Z)"
										disabled={!gameEditor.canRedo}
									>
										<Redo2 className="w-3.5 h-3.5" />
									</button>
									<div className="w-px h-4 bg-white/[0.08] mx-0.5" />
									{/* Unified Modules dropdown */}
									<div className="relative">
										<button
											type="button"
											onClick={() => setModulesDropdownOpen((v) => !v)}
											className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-all duration-150 ${
												activeModulePanel
													? "bg-purple-500/[0.15] text-purple-300"
													: modulesDropdownOpen
														? "bg-white/[0.06] text-white/70"
														: "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
											}`}
											title="Modules"
										>
											<Puzzle className="w-3.5 h-3.5" />
											<span className="hidden lg:inline">Modules</span>
											<ChevronDown className="w-2.5 h-2.5 opacity-50" />
										</button>
										{modulesDropdownOpen && (() => {
											const enabledModules = ALL_MODULE_MANIFESTS.filter(
												(m) => gameEditor.gameSettings.modules?.installed?.[m.id]?.enabled
											);
											return (
												<div className="absolute top-full left-0 mt-1 bg-[#141418] border border-white/[0.12] rounded-xl shadow-2xl z-50 min-w-[200px] py-1.5 backdrop-blur-xl">
													{enabledModules.length === 0 ? (
														<div className="px-3 py-3 text-center">
															<Puzzle className="w-5 h-5 text-white/20 mx-auto mb-1.5" />
															<p className="text-[10px] text-white/30">No modules enabled</p>
															<button
																type="button"
																className="mt-2 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
																onClick={() => {
																	setModulesDropdownOpen(false);
																	if (!gameEditor.isSettingsOpen) gameEditor.toggleSettings?.();
																}}
															>
																Open Settings → Modules
															</button>
														</div>
													) : (
														<>
															<div className="px-3 py-1 text-[9px] font-medium text-white/25 uppercase tracking-wider">Installed Modules</div>
															{enabledModules.map((mod) => {
																const Icon = MODULE_ICONS[mod.icon] || Puzzle;
																const isActive = activeModulePanel === mod.id;
																return (
																	<button
																		key={mod.id}
																		type="button"
																		className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] transition-all ${
																			isActive
																				? "bg-purple-500/[0.12] text-purple-300"
																				: "text-white/60 hover:bg-white/[0.06] hover:text-white/90"
																		}`}
																		onClick={() => {
																			if (gameEditor.isSettingsOpen) gameEditor.toggleSettings?.();
																			setActiveModulePanel(isActive ? null : mod.id);
																			setModulesDropdownOpen(false);
																		}}
																	>
																		<Icon className="w-3.5 h-3.5 flex-shrink-0" />
																		<div className="flex-1 text-left">
																			<div className="font-medium">{mod.name}</div>
																			<div className="text-[9px] text-white/30 mt-0.5">{mod.description.slice(0, 50)}{mod.description.length > 50 ? "…" : ""}</div>
																		</div>
																		{isActive && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
																	</button>
																);
															})}
														</>
													)}
													<div className="border-t border-white/[0.06] mt-1 pt-1">
														<button
															type="button"
															className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[10px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
															onClick={() => {
																setModulesDropdownOpen(false);
																if (!gameEditor.isSettingsOpen) gameEditor.toggleSettings?.();
															}}
														>
															<span>Manage Modules</span>
															<ChevronRight className="w-3 h-3 ml-auto opacity-50" />
														</button>
													</div>
												</div>
											);
										})()}
									</div>
									<div className="relative">
										<button
											type="button"
											onClick={() => setLightDropdownOpen((v) => !v)}
											className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg transition-all duration-150 ${
												lightDropdownOpen
													? "bg-yellow-500/[0.15] text-yellow-300"
													: "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
											}`}
											title="Add Light"
										>
											<Lightbulb className="w-3.5 h-3.5" />
											<span className="hidden lg:inline">Light</span>
										</button>
										{lightDropdownOpen && (
											<div className="absolute top-full left-0 mt-1 bg-[#1a1a1a] border border-white/[0.12] rounded-lg shadow-xl z-50 min-w-[140px] py-1">
												<button
													type="button"
													className="w-full text-left px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-colors"
													onClick={() => {
														gameEditor.addLight("point");
														setLightDropdownOpen(false);
													}}
												>
													Point Light
												</button>
												<button
													type="button"
													className="w-full text-left px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-colors"
													onClick={() => {
														gameEditor.addLight("spot");
														setLightDropdownOpen(false);
													}}
												>
													Spot Light
												</button>
											</div>
										)}
									</div>
								</div>
							)}
						</>
					) : (
						<button
							type="button"
							onClick={visualEdit.toggleVisualEdit}
							className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl transition-all duration-200 ${
								visualEdit.enabled
									? "bg-violet-500/[0.15] text-violet-300 border border-violet-500/[0.25]"
									: "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
							}`}
							title={visualEdit.enabled ? "Disable Visual Edit (V)" : "Enable Visual Edit (V)"}
						>
							<MousePointer2 className="w-3.5 h-3.5" />
							<span className="hidden sm:inline">Visual Edit</span>
						</button>
					)}
					<PreviewLink appId={appId} />
					<button
						type="button"
						onClick={() => setShowConsole(!showConsole)}
						className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-xl transition-all duration-200 ${
							showConsole
								? "bg-white/[0.08] text-white/90 border border-white/[0.12]"
								: "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
						}`}
					>
						{showConsole ? (
							<ChevronDown className="w-3.5 h-3.5" />
						) : (
							<ChevronUp className="w-3.5 h-3.5" />
						)}
						Console
					</button>
				</div>
			</div>

			{/* Sandpack container - fills remaining space */}
			<div className="sandpack-container relative flex-1 flex flex-col min-h-0 overflow-hidden bg-muted/20 p-2">
				{isMobileFrame ? (
					/* Mobile frame mode: phone frame (left) + publish panel (right) */
					<div className="flex items-center justify-center gap-6 w-full h-full">
						<div ref={mobileContainerRef} className="flex-1 min-w-0 flex items-center justify-center h-full">
						{/* Scaled phone wrapper — sized to visual footprint (swapped for landscape) */}
						<div className={`flex-shrink-0 relative flex items-center justify-center ${isLandscape ? "overflow-visible" : "overflow-hidden"}`} style={{ width: Math.round((isLandscape ? frameNativeH : frameNativeW) * phoneScale), height: Math.round((isLandscape ? frameNativeW : frameNativeH) * phoneScale) }}>
							<div style={{ width: frameNativeW, height: frameNativeH, transform: `scale(${phoneScale})${isLandscape ? " rotate(-90deg)" : ""}`, transformOrigin: "center center" }}>
						<PhoneFrame>
							<div
								ref={iframeContainerRef}
								className="relative w-full h-full"
							>
								{useLightweightRuntime ? (
									<GameRuntimeIframe
										appId={appId}
										files={files}
										gameSettings={gameSettingsWithOverrides}
										enabledModuleIds={enabledModuleIds}
										iframeRef={iframeRef as React.RefObject<HTMLIFrameElement | null>}
										refreshRef={sandpackRefreshRef}
										suppressRecompile={gameEditor.enabled}
									/>
								) : (
								<SandpackProvider
									template="react-ts"
									files={sandpackFiles}
									customSetup={{
										dependencies,
									}}
									options={{
										autorun: true,
										autoReload: true,
										recompileMode: "delayed",
										recompileDelay: 300,
										externalResources,
									}}
									theme="auto"
								>
									<SandpackFileSync files={sandpackFiles} />
									<SandpackRefreshBridge refreshRef={sandpackRefreshRef} />
									<div className="relative w-full h-full flex flex-col">
										<div className={`flex-1 min-h-0 ${showConsole ? "" : "h-full"}`}>
											<SandpackPreviewPane
												showNavigator={false}
												showRefreshButton={false}
												showOpenInCodeSandbox={false}
												style={{
													height: "100%",
													width: "100%",
												}}
											/>
										</div>
										{showConsole && (
											<div className="h-32 flex-shrink-0 border-t border-border bg-background">
												<SandpackConsole
													showHeader={false}
													style={{ height: "100%" }}
												/>
											</div>
										)}
										<div className="absolute top-2 right-2">
											<RefreshButton />
										</div>
									</div>
								</SandpackProvider>
								)}

								{visualEdit.enabled && visualEdit.selectedElement && (
									<VisualEditToolbar
										iframeBounds={iframeBounds}
										files={files}
										onFileUpdate={onFileUpdate || (() => {})}
										onViewChange={onViewChange || (() => {})}
										onFileSelect={onFileSelect || (() => {})}
										onViewInCode={handleViewInCode}
									/>
								)}

								{codeViewer && (
									<CodeViewerOverlay
										filePath={codeViewer.filePath}
										content={codeViewer.content}
										lineNumber={codeViewer.lineNumber}
										onClose={() => setCodeViewer(null)}
									/>
								)}
							</div>
						</PhoneFrame>
							</div>
						</div>
						</div>

						<div className="flex-shrink-0 self-center">
							<MobilePublishPanel appId={appId} />
						</div>
					</div>
				) : (
					/* Standard browser mode */
					<div
						ref={iframeContainerRef}
						className="bg-background rounded-lg shadow-lg overflow-hidden flex-1 min-h-0 transition-all duration-200 mx-auto relative"
						style={{
							width: device === "desktop" ? "100%" : previewWidth,
							maxWidth: "100%",
						}}
					>
						{useLightweightRuntime ? (
							<GameRuntimeIframe
								appId={appId}
								files={files}
								gameSettings={gameSettingsWithOverrides}
								enabledModuleIds={enabledModuleIds}
								iframeRef={iframeRef as React.RefObject<HTMLIFrameElement | null>}
								refreshRef={sandpackRefreshRef}
								suppressRecompile={gameEditor.enabled}
							/>
						) : (
						<SandpackProvider
							template="react-ts"
							files={sandpackFiles}
							customSetup={{
								dependencies,
							}}
							options={{
								autorun: true,
								autoReload: true,
								recompileMode: "delayed",
								recompileDelay: 300,
								externalResources,
							}}
							theme="auto"
						>
							<SandpackFileSync files={sandpackFiles} />
							<SandpackRefreshBridge refreshRef={sandpackRefreshRef} />
							<div className="relative w-full h-full flex flex-col">
								{/* Preview pane - takes all space minus console */}
								<div className={`flex-1 min-h-0 ${showConsole ? "" : "h-full"}`}>
									<SandpackPreviewPane
										showNavigator={false}
										showRefreshButton={false}
										showOpenInCodeSandbox={false}
										style={{
											height: "100%",
											width: "100%",
										}}
									/>
								</div>

								{/* Console panel (collapsible) */}
								{showConsole && (
									<div className="h-40 flex-shrink-0 border-t border-border bg-background">
										<SandpackConsole
											showHeader={false}
											style={{
												height: "100%",
											}}
										/>
									</div>
								)}

								{/* Refresh button overlay */}
								<div className="absolute top-2 right-2">
									<RefreshButton />
								</div>
							</div>
						</SandpackProvider>
						)}

						{/* Visual Edit Toolbar (floating overlay) */}
						{visualEdit.enabled && visualEdit.selectedElement && (
							<VisualEditToolbar
								iframeBounds={iframeBounds}
								files={files}
								onFileUpdate={onFileUpdate || (() => {})}
								onViewChange={onViewChange || (() => {})}
								onFileSelect={onFileSelect || (() => {})}
								onViewInCode={handleViewInCode}
							/>
						)}

						{/* Code Viewer Overlay */}
						{codeViewer && (
							<CodeViewerOverlay
								filePath={codeViewer.filePath}
								content={codeViewer.content}
								lineNumber={codeViewer.lineNumber}
								onClose={() => setCodeViewer(null)}
							/>
						)}

					</div>
				)}

				{/* Camera Preview PIP title bar — only when camera selected */}
				{gameEditor.enabled && isGameMode && gameEditor.selectedObject?.userData?._isSyntheticCameraNode && (
					<div className="absolute pointer-events-none z-50 flex flex-col" style={{ bottom: 4, left: 4 }}>
						<div className="flex items-center gap-1.5 px-2 py-1 bg-[#2a2a2a]/95 border border-white/15 border-b-0 rounded-t" style={{ width: 200 }}>
							<span className="text-white/40 text-xs">&#9776;</span>
							<Camera className="w-2.5 h-2.5 text-blue-400/70" />
							<span className="text-[10px] font-medium text-white/80">Main Camera</span>
						</div>
						<div style={{ width: 200, height: 120 }} className="border border-white/15 border-t-0 rounded-b" />
					</div>
				)}

				{/* Scene Gizmo (orientation cube) */}
				{gameEditor.enabled && isGameMode && <SceneGizmo />}

				{/* Debug Overlay — Runtime diagnostics (game mode only) */}
				{isGameMode && !gameEditor.enabled && <DebugOverlay iframeRef={iframeRef} />}

				{/* Game Editor Panel / Module Panel / Settings Panel (overlaid on right side — mutually exclusive) */}
				{gameEditor.enabled && isGameMode && (
					activeModulePanel === "terrain-painter" ? (
						<TerrainPainterPanel
							sendToIframe={gameEditor.sendToIframe}
							onClose={() => setActiveModulePanel(null)}
							initialConfig={gameEditor.gameSettings.terrain}
							onTerrainConfigChanged={(config) => {
								// Preserve sculptHeightData from in-memory state (panel config doesn't include it)
								const existingSculpt = gameEditor.gameSettings.terrain?.sculptHeightData;
								const mergedConfig = existingSculpt ? { ...config, sculptHeightData: existingSculpt } : config;
								gameEditor.updateGameSettings({ terrain: mergedConfig });
								// Auto-save terrain config to JSON file so it persists across iframe reloads
								const updatedSettings = { ...gameEditor.gameSettings, terrain: mergedConfig };
								handleSaveSettings(updatedSettings);
							}}
						/>
					) : activeModulePanel === "sky-weather" ? (
						<SkyWeatherPanel
							sendToIframe={gameEditor.sendToIframe}
							onClose={() => setActiveModulePanel(null)}
							settings={gameEditor.gameSettings}
							onChange={(skyConfig) => {
								// Live preview only — updates React state + postMessage, NO file write, NO refresh
								gameEditor.updateGameSettings({ skyWeather: skyConfig });
							}}
							onSave={(skyConfig) => {
								// Persist to DB — only called on explicit save or panel close
								// Also mirror to modules.installed config so auto-init picks it up
								const modules = { ...gameEditor.gameSettings.modules };
								if (modules.installed?.["sky-weather"]) {
									modules.installed = { ...modules.installed, "sky-weather": { ...modules.installed["sky-weather"], config: skyConfig } };
								}
								const updatedSettings = { ...gameEditor.gameSettings, skyWeather: skyConfig, modules };
								handleSaveSettings(updatedSettings);
							}}
						/>
					) : activeModulePanel === "character-system" ? (
						<CharacterSystemPanel
							sendToIframe={gameEditor.sendToIframe}
							onClose={() => setActiveModulePanel(null)}
							settings={gameEditor.gameSettings}
							onChange={(charConfig) => {
								// Live preview only — updates React state + postMessage, NO file write, NO refresh
								gameEditor.updateGameSettings({ character: charConfig });
							}}
							onSave={(charConfig) => {
								// Persist to DB — only called on explicit save or panel close
								const modules = { ...gameEditor.gameSettings.modules };
								if (modules.installed?.["character-system"]) {
									modules.installed = { ...modules.installed, "character-system": { ...modules.installed["character-system"], config: charConfig as unknown as Record<string, unknown> } };
								}
								const updatedSettings = { ...gameEditor.gameSettings, character: charConfig, modules };
								handleSaveSettings(updatedSettings);
							}}
						/>
					) : gameEditor.isSettingsOpen ? (
						<GameSettingsPanel
							settings={gameEditor.gameSettings}
							onChange={gameEditor.updateGameSettings}
							onSave={handleSaveSettings}
							onClose={gameEditor.toggleSettings}
						/>
					) : (
						<GameEditorPanel settingsProps={{ onSave: handleSaveSettings }} />
					)
				)}
			</div>
		</div>
	);
}
