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
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	ExternalLink,
	Gamepad2,
	Grid3X3,
	Monitor,
	MousePointer2,
	Move,
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
import { useGameEditor, type GizmoMode } from "../lib/game-editor-context";
import { GameEditorPanel } from "./game-editor-panel";
import { GameSettingsPanel } from "./game-settings-panel";
import type { RightPanelView } from "./right-panel-tabs";
import { VisualEditToolbar } from "./visual-edit-toolbar";
import {
	type SandpackFiles,
	type SandpackLanguageConfig,
	convertToSandpackFiles,
	extractDependencies,
} from "../adapters/sandpack-adapter";
import { isRtlLanguage } from "../lib/languages";

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

	// Merge new transform (preserve texture if not overridden)
	overrides[objectName] = {
		p: [+pos.x.toFixed(3), +pos.y.toFixed(3), +pos.z.toFixed(3)],
		r: [rx, ry, rz],
		s: [+scl.x.toFixed(3), +scl.y.toFixed(3), +scl.z.toFixed(3)],
		...(tex ? { t: [tex.url, tex.tileX, tex.tileY, tex.hasPBR ? 1 : 0] } : existingTex ? { t: existingTex } : {}),
	};

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
      var o = _ov[name];
      if (!o || !o.p) return null;
      var tx=o.p[0], ty=o.p[1], tz=o.p[2];
      for (var i = 0; i < w.bodies.length; i++) {
        var b = w.bodies[i];
        if (Math.abs(b.position.x-tx)<0.5 && Math.abs(b.position.y-ty)<0.5 && Math.abs(b.position.z-tz)<0.5) {
          mesh.userData.__physicsBody = b;
          _bodies[name] = b;
          return b;
        }
      }
      return null;
    }
    function _find(s, name) {
      if (_cache[name]) return _cache[name];
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
      if (window.__vibexe_editor__) { requestAnimationFrame(_apply); return; }
      var s = window.__vibexe_scene__;
      if (!s || !s.children) { requestAnimationFrame(_apply); return; }
      if (s !== _lastScene) { _cache={}; _bodies={}; _logged={}; _lastScene=s; }
      var _gsPlayer = window.__VIBEXE_GAME_SETTINGS__ && window.__VIBEXE_GAME_SETTINGS__.player;
      var keys = Object.keys(_ov);
      for (var ki=0; ki<keys.length; ki++) {
        var name = keys[ki];
        if (_gsPlayer && (name.indexOf("Character_")===0 || name.indexOf("Player_")===0)) continue;
        var o = _ov[name];
        var t = _find(s, name);
        if (!t) continue;
        var _hasBody = false;
        if (o.p) {
          t.position.set(o.p[0],o.p[1],o.p[2]);
          var pb = _findBody(t, name);
          if (pb) { pb.position.set(o.p[0],o.p[1],o.p[2]); if(pb.velocity) pb.velocity.set(0,0,0); _hasBody=true; }
        }
        if (!_logged[name]) {
          if (o.r) t.rotation.set(o.r[0],o.r[1],o.r[2]);
          if (o.s) t.scale.set(o.s[0],o.s[1],o.s[2]);
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
                if (isSRGB) { tex.encoding=3001; tex.colorSpace='srgb'; }
                else { tex.encoding=3000; tex.colorSpace='srgb-linear'; }
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
                var _urls = [_tu, _b+'_Normal'+_e, _b+'_Roughness'+_e, _isM?_b+'_Metalness'+_e:'', _b+'_AO'+_e];
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
                      _sc.environment=_pm.fromScene(_es2,0,0.1,100).texture; _pm.dispose();
                      _r.toneMapping=4; _r.toneMappingExposure=2.5;
                      var _oal=_sc.getObjectByName('__default_ambient__'); if(_oal)_oal.intensity=Math.max(_oal.intensity,0.3);
                      var _ohl=_sc.getObjectByName('__default_hemi__'); if(_ohl)_ohl.intensity=Math.max(_ohl.intensity,0.5);
                      if(!_sc.getObjectByName('__pbr_key__')){var _pk=new THREE.DirectionalLight(0xFFFBF0,1.2);_pk.name='__pbr_key__';_pk.position.set(15,30,-10);_pk.castShadow=false;_sc.add(_pk);}
                      console.log('[SCENE_EDITOR] PBR env v45 (exposure 2.5)');
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
                    m.material=new THREE.MeshStandardMaterial(mo);
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
      if (_frame < _MAX) requestAnimationFrame(_apply);
      else console.log("[SCENE_EDITOR] Override done after "+_frame+" frames, "+Object.keys(_bodies).length+" bodies");
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
	const [codeViewer, setCodeViewer] = useState<{
		filePath: string;
		content: string;
		lineNumber: number;
	} | null>(null);

	// Detect game mode
	const isGameMode = projectType === "game" || projectType === "game-mobile";

	// Ref for triggering Sandpack refresh from outside SandpackProvider
	const sandpackRefreshRef = useRef<(() => void) | null>(null);

	// Track whether scene transforms were modified during editor session
	const sceneModifiedDuringEditRef = useRef(false);

	// Save-all-transforms resolver for batch save
	const allTransformsResolverRef = useRef<((transforms: Record<string, any>) => void) | null>(null);
	// Spawned objects persistence — saved before restart, restored after
	const spawnedObjectsRef = useRef<any[]>([]);

	// Mutex to prevent concurrent settings saves
	const savingSettingsRef = useRef(false);
	// Track last loaded settings content to avoid redundant re-parses
	const lastLoadedSettingsContentRef = useRef<string | null>(null);

	// Register save handler with game editor context
	useEffect(() => {
		if (!isGameMode) return;
		const saveAllTransforms = async () => {
			const iframe = iframeRef.current;
			if (!iframe?.contentWindow) {
				console.warn("[GameEditor] No iframe for save");
				return;
			}
			// Request all transforms from bridge
			iframe.contentWindow.postMessage({ type: "game-editor-collect-all-transforms" }, "*");
			// Wait for response
			const transforms = await new Promise<Record<string, any>>((resolve) => {
				allTransformsResolverRef.current = resolve;
				setTimeout(() => {
					if (allTransformsResolverRef.current === resolve) {
						allTransformsResolverRef.current = null;
						resolve({});
					}
				}, 3000);
			});
			const names = Object.keys(transforms);
			if (names.length === 0) {
				console.log("[GameEditor] No transforms to save");
				return;
			}
			console.log("[GameEditor] Saving all transforms:", names.length, "objects");
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
			for (const name of names) {
				const t = transforms[name];
				const texData = t._textureUrl ? { url: t._textureUrl, tileX: t._textureTileX || 1, tileY: t._textureTileY || 1, hasPBR: !!t._hasPBR } : null;
				code = updateTransformInSource(code, name, t.position, t.rotation, t.scale, texData);
			}
			// Debug: uncomment to check save comparison
			// console.log("[GameEditor] Save comparison: changed=", code !== sceneFile.content);
			if (code !== sceneFile.content) {
				currentOnFileUpdate(sceneFile.id, code);
				// Save to DB
				try {
					await fetch(`/api/app-builder/apps/${appId}/files`, {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ path: sceneFile.path, content: code }),
					});
					console.log("[GameEditor] DB save complete for", names.length, "objects");
				} catch (err) {
					console.warn("[GameEditor] DB save failed:", err);
				}
			}
		};
		gameEditor.setSaveHandler(saveAllTransforms);
	}, [isGameMode, appId, gameEditor.setSaveHandler]);

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

	// Save game settings to DB + trigger Sandpack refresh
	const handleSaveSettings = useCallback(async (settings: import("../lib/game-editor-context").GameSettings) => {
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
			// Update file in state so convertToSandpackFiles re-runs with new settings
			if (currentOnFileUpdate && existingFile) {
				currentOnFileUpdate(existingFile.id, content);
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
		const findIframe = () => {
			const iframe = container.querySelector("iframe");
			if (iframe && iframe !== iframeRef.current) {
				iframeRef.current = iframe;
				visualEdit.setIframeRef(iframeRef as React.RefObject<HTMLIFrameElement | null>);
				gameEditor.setIframeRef(iframeRef as React.RefObject<HTMLIFrameElement | null>);
			}
		};
		findIframe();
		// Observe DOM changes to catch Sandpack iframe insertion
		const observer = new MutationObserver(findIframe);
		observer.observe(container, { childList: true, subtree: true });
		return () => observer.disconnect();
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
	useEffect(() => {
		const handler = (e: MessageEvent) => {
			const data = e.data;
			if (!data || typeof data !== "object" || !data.type) return;
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
					iframe.contentWindow.postMessage({ type: "game-editor-enable" }, "*");
				}
				// Send current game settings after bridge is ready
				if (iframe?.contentWindow) {
					setTimeout(() => {
						iframe.contentWindow?.postMessage({
							type: "applySettings",
							settings: gameEditor.gameSettings,
						}, "*");
					}, 200);
				}
				// Restore spawned objects from previous session (if any)
				if (spawnedObjectsRef.current.length > 0 && iframe?.contentWindow) {
					const objectsToRestore = [...spawnedObjectsRef.current];
					console.log("[GameEditor] Restoring", objectsToRestore.length, "spawned objects after reload");
					// Delay to let game scene fully initialize
					setTimeout(() => {
						iframe.contentWindow?.postMessage({ type: "game-editor-restore-spawned-objects", objects: objectsToRestore }, "*");
					}, 500);
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
				});
				// Live-sync player character position to Game Settings spawn
				const isPlayer = data.userData?.__isPlayerCharacter
					|| data.userData?.vibexeType === "player"
					|| data.userData?.vibexeType === "AnimatedCharacter"
					|| data.name?.startsWith("Character_")
					|| data.name?.startsWith("Player_");
				if (isPlayer && data.position) {
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
				// Sync gizmo space state from bridge
			} else if (data.type === "game-editor-undo-redo-state") {
				gameEditor.setUndoRedoState(!!data.canUndo, !!data.canRedo);
			} else if (data.type === "game-editor-object-duplicated") {
				gameEditor.requestSceneTree();
			} else if (data.type === "game-editor-scene-dirty") {
				gameEditor.setDirty(true);
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
				// Collect all spawned objects so we can restore them after refresh
				const iframe = iframeRef.current;
				if (iframe?.contentWindow) {
					iframe.contentWindow.postMessage({ type: "game-editor-get-spawned-objects" }, "*");
				}
			} else if (data.type === "game-editor-spawned-objects") {
				// Store spawned objects for restoration after restart
				spawnedObjectsRef.current = data.objects || [];
			} else if (data.type === "game-editor-all-transforms") {
				// Resolve pending save-all-transforms promise
				if (allTransformsResolverRef.current) {
					allTransformsResolverRef.current(data.transforms || {});
					allTransformsResolverRef.current = null;
				}
			} else if (data.type === "game-editor-persist-transform") {
				// Persist transform changes to source code (GameScene3D.ts)
				const currentFiles = filesRef.current;
				const currentOnFileUpdate = onFileUpdateRef.current;
				if (!currentOnFileUpdate) return;
				const objName = data.name as string;
				const pos = data.position as { x: number; y: number; z: number };
				const rot = data.rotation as { x: number; y: number; z: number };
				const scl = data.scale as { x: number; y: number; z: number };
				if (!objName) return;
				// Find GameScene3D.ts file
				const sceneFile = currentFiles.find((f) => f.path?.includes("GameScene3D"));
				if (!sceneFile?.content) {
					console.warn("[GameEditor] Cannot persist: GameScene3D.ts not found in files", currentFiles.length);
					return;
				}
				const updated = updateTransformInSource(sceneFile.content, objName, pos, rot, scl);
				if (updated !== sceneFile.content) {
					console.log("[GameEditor] Persisting transform for:", objName, "pos:", pos);
					sceneModifiedDuringEditRef.current = true;
					currentOnFileUpdate(sceneFile.id, updated);
					// Also save to database so changes survive page refresh
					fetch(`/api/app-builder/apps/${appId}/files`, {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ path: sceneFile.path, content: updated }),
					}).catch((err) => console.warn("[GameEditor] DB save failed:", err));
				} else {
					console.warn("[GameEditor] No change after updateTransformInSource for:", objName);
				}
			}
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, [visualEdit, gameEditor]);

	// When exiting Scene Editor after transforms were modified, refresh Sandpack
	// so the game reloads with SCENE_EDITOR_OVERRIDES applied from source code.
	const prevEditorEnabledRef = useRef(false);
	useEffect(() => {
		const wasEnabled = prevEditorEnabledRef.current;
		prevEditorEnabledRef.current = gameEditor.enabled;
		if (wasEnabled && !gameEditor.enabled && sceneModifiedDuringEditRef.current) {
			console.log("[GameEditor] Scene modified during edit session — refreshing preview to apply overrides");
			sceneModifiedDuringEditRef.current = false;
			// Delay to let SandpackFileSync process the last file update
			setTimeout(() => { sandpackRefreshRef.current?.(); }, 400);
		}
	}, [gameEditor.enabled]);

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
			// Forward relevant keys
			const key = e.key.toLowerCase();
			const forwarded = ["f", "g", "w", "e", "r", "escape", "delete", "backspace"].includes(key)
				|| ((e.ctrlKey || e.metaKey) && (key === "z" || key === "d"));
			if (forwarded) {
				iframe.contentWindow.postMessage({
					type: "game-editor-viewport-keydown",
					key: e.key,
					ctrlKey: e.ctrlKey,
					metaKey: e.metaKey,
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

	// Visual Edit bridge loaded as external script (bypasses Sandpack's bundler)
	// Phaser CDN loaded when game projects use it (Sandpack's bundler can't handle the 4MB package)
	const externalResources = useMemo(() => {
		const resources = ["https://cdn.tailwindcss.com"];
		if (dependencies.phaser) {
			resources.push("https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js");
		}
		if (dependencies.three) {
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js");
			// Post-processing addons (EffectComposer, UnrealBloomPass)
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/Pass.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js");
			resources.push("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js");
		}
		// Bridge MUST load AFTER Three.js CDN — game editor bridge checks window.THREE on init
		if (typeof window !== "undefined") {
			resources.push(`${window.location.origin}/api/app-builder/bridge?v=44`);
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
							<button
								type="button"
								onClick={gameEditor.toggleEditor}
								className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl transition-all duration-200 ${
									gameEditor.enabled
										? "bg-emerald-500/[0.15] text-emerald-300 border border-emerald-500/[0.25]"
										: "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
								}`}
								title={gameEditor.enabled ? "Exit Scene Editor" : "Scene Editor"}
							>
								<Gamepad2 className="w-3.5 h-3.5" />
								<span className="hidden sm:inline">Scene Editor</span>
							</button>
							{gameEditor.enabled && (
								<div className="flex items-center gap-0.5 border-l border-white/[0.08] pl-2">
									{([
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
										onClick={gameEditor.undoAction}
										className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg text-white/35 hover:bg-white/[0.04] hover:text-white/60 transition-all duration-150"
										title="Undo (Ctrl+Z)"
									>
										<Undo2 className="w-3.5 h-3.5" />
									</button>
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

				{/* Game Editor Panel / Settings Panel (overlaid on right side — mutually exclusive) */}
				{gameEditor.enabled && isGameMode && (
					gameEditor.isSettingsOpen ? (
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
