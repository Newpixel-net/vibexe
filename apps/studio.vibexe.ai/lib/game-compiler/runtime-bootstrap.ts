/**
 * Runtime Bootstrap Generator — Produces the JavaScript globals that must execute
 * BEFORE any game code runs in the iframe.
 *
 * Extracted from sandpack-adapter.ts lines 1619-1902.
 * Generates a self-contained JS string (no TypeScript) that:
 * - Sets API origin, app ID, installed modules list
 * - Applies environment/camera/physics/audio/performance settings after scene init
 * - Applies renderer patches (pixelRatio cap, shadow quality)
 * - Provides game.loadScene() API
 * - Auto-detects player mesh for legacy projects
 * - Provides debug system health query handler
 */

interface BootstrapSettings {
	apiOrigin?: string;
	appId?: string;
	enabledModuleIds: string[];
	gameSettings?: Record<string, unknown>;
}

export function generateRuntimeBootstrap(opts: BootstrapSettings): string {
	const lines: string[] = [];
	lines.push("// Vibexe Runtime Bootstrap — injected before game bundle");

	// API origin + app ID
	if (opts.apiOrigin) lines.push(`window.__VIBEXE_API_ORIGIN__ = ${JSON.stringify(opts.apiOrigin)};`);
	if (opts.appId) lines.push(`window.__VIBEXE_APP_ID__ = ${JSON.stringify(opts.appId)};`);

	// Installed modules list
	if (opts.enabledModuleIds.length > 0) {
		lines.push(`window.__VIBEXE_INSTALLED_MODULES__ = ${JSON.stringify(opts.enabledModuleIds)};`);
	}

	// Game settings global
	const gs = opts.gameSettings;
	if (gs) {
		lines.push(`window.__VIBEXE_GAME_SETTINGS__ = ${JSON.stringify(gs)};`);
	}

	// Settings runtime override — applies AFTER scene initializes
	if (gs && (gs.environment || gs.camera || gs.physics)) {
		lines.push(generateSettingsOverride(gs));
	}

	// Game API — loadScene, getScenes, getActiveSceneId
	lines.push(generateGameAPI());

	// Auto-detect player mesh for legacy projects
	lines.push(generatePlayerAutoDetect());

	// Debug overlay — system health query handler
	lines.push(generateDebugHandler());

	return lines.join("\n");
}

function generateSettingsOverride(gs: Record<string, unknown>): string {
	// Check if sky-weather module is installed — if so, it manages bg/fog/lighting
	const hasSkyWeather = !!(
		gs.modules &&
		(gs.modules as Record<string, unknown>).installed &&
		((gs.modules as Record<string, unknown>).installed as Record<string, unknown>)["sky-weather"] &&
		(((gs.modules as Record<string, unknown>).installed as Record<string, unknown>)["sky-weather"] as Record<string, unknown>).enabled
	);

	return `(function(){
if(window.__vibexe_bootstrap_applied__)return;
window.__vibexe_bootstrap_applied__=true;
var _gs=${JSON.stringify(gs)};
var _n=0;
var _t=setInterval(function(){
_n++;
if(_n>100){clearInterval(_t);console.warn('[Bootstrap] Settings override timed out after 10s');return;}
var T=window.THREE;var s=window.__vibexe_scene__;var c=window.__vibexe_camera__;
if(!T||!s)return;
clearInterval(_t);
var e=_gs.environment||{};
var _swActive=${hasSkyWeather ? 'true' : 'false'}||!!window.__skyWeather_active;
if(!_swActive){
if(e.backgroundColor){try{s.background=new T.Color(e.backgroundColor)}catch(x){}}
if(e.fogEnabled){try{s.fog=new T.Fog(e.fogColor||e.backgroundColor||'#87CEEB',e.fogNear||30,e.fogFar||100)}catch(x){}}
var amb=s.getObjectByName('__default_ambient__');if(amb&&e.ambientLightIntensity!=null)amb.intensity=e.ambientLightIntensity;if(amb&&e.ambientLightColor)try{amb.color=new T.Color(e.ambientLightColor)}catch(x){}
var sun=s.getObjectByName('__default_sun__');if(sun&&e.sunLightIntensity!=null)sun.intensity=e.sunLightIntensity;if(sun&&e.sunLightColor)try{sun.color=new T.Color(e.sunLightColor)}catch(x){}
var hemi=s.getObjectByName('__default_hemi__');if(hemi&&e.hemisphereIntensity!=null)hemi.intensity=e.hemisphereIntensity;if(hemi&&e.hemisphereSkyColor)try{hemi.color=new T.Color(e.hemisphereSkyColor)}catch(x){}if(hemi&&e.hemisphereGroundColor)try{hemi.groundColor=new T.Color(e.hemisphereGroundColor)}catch(x){}
}
if(c&&_gs.camera&&_gs.camera.fov!=null){c.fov=_gs.camera.fov;c.updateProjectionMatrix()}
var w=window.__vibexe_world__;
if(w&&_gs.physics&&_gs.physics.gravity!=null){try{w.gravity.set(0,_gs.physics.gravity,0)}catch(x){}}
var _aus=_gs.audio;
if(_aus){window.__vibexe_audio__={enabled:_aus.enabled!==false,masterVolume:_aus.masterVolume!=null?_aus.masterVolume:0.8,musicVolume:_aus.musicVolume!=null?_aus.musicVolume:0.5,sfxVolume:_aus.sfxVolume!=null?_aus.sfxVolume:0.7};if(_aus.enabled===false){var _allAudio=document.querySelectorAll('audio');for(var _ai2=0;_ai2<_allAudio.length;_ai2++){_allAudio[_ai2].muted=true;}}}
var _pfs=_gs.performance;
if(_pfs){if(_pfs.pixelRatio!=null){var _prr=window.__vibexe_renderer__;if(_prr&&_prr.setPixelRatio){_prr.setPixelRatio(Math.max(0.5,Math.min(1.0,_pfs.pixelRatio)))}}if(_pfs.maxFPS!=null){window.__vibexe_maxFPS__=_pfs.maxFPS}if(_pfs.showFPS){var _existFps=document.getElementById('__vibexe_fps__');if(!_existFps){var _fpsD=document.createElement('div');_fpsD.id='__vibexe_fps__';_fpsD.style.cssText='position:fixed;top:4px;left:4px;padding:2px 6px;background:rgba(0,0,0,0.7);color:#0f0;font:11px monospace;z-index:99999;pointer-events:none';document.body.appendChild(_fpsD);var _fc=0,_lt=performance.now();(function _fpsLoop(){_fc++;var now=performance.now();if(now-_lt>=1000){var _el=document.getElementById('__vibexe_fps__');if(_el)_el.textContent=_fc+' FPS';_fc=0;_lt=now}window.__vibexe_fpsLoopId__=requestAnimationFrame(_fpsLoop)})()}}}
var _ren=window.__vibexe_renderer__;if(_ren){if(_ren.getPixelRatio()>1.0){_ren.setPixelRatio(1.0)}if(T.PCFShadowMap!==undefined&&_ren.shadowMap.type!==T.PCFShadowMap){_ren.shadowMap.type=T.PCFShadowMap;_ren.shadowMap.needsUpdate=true}if(_ren.shadowMap.autoUpdate!==false){_ren.shadowMap.autoUpdate=false;_ren.shadowMap.needsUpdate=true}}
var _shq=(_gs.environment&&_gs.environment.shadowQuality)||'medium';
var _shSize={low:512,medium:1024,high:2048}[_shq]||1024;
s.traverse(function(obj){if(obj.isLight&&obj.shadow){obj.shadow.mapSize.width=_shSize;obj.shadow.mapSize.height=_shSize;if(obj.shadow.camera){obj.shadow.camera.far=150;obj.shadow.camera.left=-40;obj.shadow.camera.right=40;obj.shadow.camera.top=40;obj.shadow.camera.bottom=-40;obj.shadow.camera.updateProjectionMatrix()}}});
var _tov=_gs.textureOverrides;
if(_tov&&_tov.length){var _tl=new T.TextureLoader();for(var _ti=0;_ti<_tov.length;_ti++){(function(_to){var _obj=null;s.traverse(function(ch){if(ch.name===_to.name)_obj=ch;});if(!_obj)return;_tl.load(_to.textureUrl,function(tex){tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(_to.tileX||1,_to.tileY||1);_obj.traverse(function(m){if(m.isMesh&&m.material&&!Array.isArray(m.material)){m.material.map=tex;m.material.needsUpdate=true;}});})})(_tov[_ti]);}}
var _mfps=window.__vibexe_maxFPS__;
if(_mfps&&_mfps>0&&_mfps<120){var _origRAF=window.requestAnimationFrame.__vibexe_original||window.requestAnimationFrame;var _frameInt=1000/_mfps;var _lastFrame=0;var _wrappedRAF=function(cb){return _origRAF.call(window,function(ts){if(ts-_lastFrame>=_frameInt){_lastFrame=ts;cb(ts)}else{_origRAF.call(window,cb)}})};_wrappedRAF.__vibexe_original=_origRAF;window.requestAnimationFrame=_wrappedRAF}
},100)})();`;
}

function generateGameAPI(): string {
	return `(function(){
var _vibexeGame = window.__vibexe_game__ || {};
_vibexeGame.loadScene = function(sceneName) {
  window.parent.postMessage({ type: 'game-request-load-scene', sceneName: sceneName }, '*');
};
_vibexeGame.getScenes = function() {
  var gs = window.__VIBEXE_GAME_SETTINGS__;
  return (gs && gs.scenes) ? gs.scenes.map(function(s) { return { id: s.id, name: s.name, isDefault: s.isDefault }; }) : [];
};
_vibexeGame.getActiveSceneId = function() {
  var gs = window.__VIBEXE_GAME_SETTINGS__;
  return gs && gs.activeSceneId || '';
};
window.__vibexe_game__ = _vibexeGame;
})();`;
}

function generatePlayerAutoDetect(): string {
	return `(function(){
var _pm=0;
var _pi=setInterval(function(){
  if(window.__vibexe_playerMesh__){clearInterval(_pi);return;}
  _pm++;if(_pm>15){clearInterval(_pi);return;}
  var sc=window.__vibexe_scene__;
  if(!sc)return;
  var candidate=null;
  sc.traverse(function(o){
    if(candidate)return;
    if(!o.userData)return;
    if(o.userData.__play){candidate=o;return;}
    var n=(o.name||'').toLowerCase();
    if(n.indexOf('character_')===0||n.indexOf('player')>=0){candidate=o;return;}
    if(o.userData.__physicsBody&&o.userData.__physicsBody.mass>0&&o.userData.__physicsBody.fixedRotation){candidate=o;return;}
  });
  if(candidate){
    window.__vibexe_playerMesh__=candidate;
    if(!candidate.userData.__physicsBody){
      var w=window.__vibexe_world__;
      if(w&&w.bodies){
        for(var bi=0;bi<w.bodies.length;bi++){
          var b=w.bodies[bi];
          if(b.mass>0&&b.fixedRotation){
            candidate.userData.__physicsBody=b;
            break;
          }
        }
      }
    }
    console.log('[AutoDetect] Player mesh registered:',candidate.name||'unnamed');
  }
},2000);
})();`;
}

function generateDebugHandler(): string {
	return `(function(){
window.addEventListener('message',function(ev){
if(!ev.data||ev.data.type!=='vibexe-debug-query-systems')return;
var r=[];
var problems=[];
var W=window;
var ren=W.__vibexe_renderer__;
var comp=W.__vibexe_composer__;
var _bloomPass=null;if(comp&&comp.passes){for(var _bp=0;_bp<comp.passes.length;_bp++){if(comp.passes[_bp].constructor&&comp.passes[_bp].constructor.name==='UnrealBloomPass'){_bloomPass=comp.passes[_bp];break}}}
r.push({system:'Renderer',status:ren?'ok':'missing',details:ren?{pixelRatio:ren.getPixelRatio(),devicePR:W.devicePixelRatio||1,size:ren.getSize?((function(){var s=new(W.THREE||{}).Vector2();ren.getSize(s);return s.x+'x'+s.y})()):'?',shadows:ren.shadowMap.enabled,shadowType:ren.shadowMap.type===1?'PCF':ren.shadowMap.type===2?'PCFSoft':'Basic',shadowAutoUpdate:ren.shadowMap.autoUpdate,toneMapping:['No','Linear','Reinhard','Cineon','ACES'][ren.toneMapping]||ren.toneMapping,bloom:_bloomPass?(_bloomPass.enabled?'ON':'OFF'):'none',composer:comp?'active':'none'}:null});
var sc=W.__vibexe_scene__;
var meshCount=0;var lightCount=0;
if(sc){sc.traverse(function(o){if(o.isMesh)meshCount++;if(o.isLight)lightCount++;})}
r.push({system:'Scene',status:sc?'ok':'missing',details:sc?{children:sc.children.length,meshes:meshCount,lights:lightCount,fog:sc.fog?'active':'none'}:null});
var cam=W.__vibexe_camera__;
r.push({system:'Camera',status:cam?'ok':'missing',details:cam?{fov:cam.fov,near:cam.near,far:cam.far,pos:cam.position?+cam.position.y.toFixed(1)+'y':'?'}:null});
var w=W.__vibexe_world__;
var dynamicCount=0;var staticCount=0;
if(w&&w.bodies){for(var bi=0;bi<w.bodies.length;bi++){if(w.bodies[bi].mass>0)dynamicCount++;else staticCount++;}}
r.push({system:'Physics',status:w?'ok':'missing',details:w?{bodies:(w.bodies?w.bodies.length:0),dynamic:dynamicCount,static:staticCount,gravity:w.gravity?w.gravity.y:0}:null});
if(!w)problems.push({id:'no-physics',severity:'error',msg:'Physics world not initialized'});
var tm=sc&&sc.getObjectByName?sc.getObjectByName('__terrain__'):null;
var tBody=W.__vibexe_terrainBody;
var tPost=W.__vibexe_terrainPostStep;
var tGetH=W.__vibexe_getTerrainHeight;
var tStatus='off';
if(tm&&tBody&&tPost)tStatus='ok';else if(tm&&!tBody)tStatus='inactive';else if(tm)tStatus='ok';
var tDetails=null;
if(tm){tDetails={mesh:true,verts:tm.geometry&&tm.geometry.attributes&&tm.geometry.attributes.position?tm.geometry.attributes.position.count:0};tDetails.physicsBody=!!tBody;tDetails.postStepClamp=!!tPost;tDetails.heightQuery=!!tGetH;}else{tDetails={mesh:false,physicsBody:!!tBody};}
r.push({system:'Terrain',status:tStatus,details:tDetails});
if(tm&&!tBody)problems.push({id:'terrain-no-physics',severity:'error',msg:'Terrain mesh exists but has NO physics body'});
var pm=W.__vibexe_playerMesh__;
var pb=pm&&pm.userData?pm.userData.__physicsBody:null;
var rapierKCC=W.__charCtrl_rapier;
var hasPhys=!!pb||!!rapierKCC;
r.push({system:'Player',status:pm?'ok':'missing',details:pm?{name:pm.name||'unknown',y:pm.position?+pm.position.y.toFixed(2):0,hasPhysicsBody:hasPhys,physicsType:rapierKCC?'rapier-kcc':(pb?'cannon':'none')}:null});
if(pm&&!hasPhys)problems.push({id:'player-no-physics',severity:'error',msg:'Player mesh has NO physics body'});
var sw=W.__vibexe_skyWeather;
r.push({system:'Sky & Weather',status:sw&&sw._active?'ok':(sw?'inactive':'off'),details:sw?{time:+(sw.solarTime||0).toFixed(3)}:null});
var aq=W.__vibexe_adaptive_quality__;
r.push({system:'Adaptive Quality',status:aq?'ok':'off',details:aq?{fps:aq.fps||0,pixelRatio:aq.currentPixelRatio,reductions:aq.reductions||0}:null});
var cullDist=W.__vibexe_cullDistance__||120;
var fpsCounter=document.getElementById('__vibexe_fps__');
var gameFps=fpsCounter?parseInt(fpsCounter.textContent)||0:0;
if(!gameFps&&aq&&aq.fps)gameFps=Math.round(aq.fps);
r.push({system:'Performance',status:gameFps>=50?'ok':(gameFps>=30?'inactive':(gameFps>0?'inactive':'missing')),details:{gameFps:gameFps,cullDistance:cullDist,skipComposer:!!W.__vibexe_skipComposer__,editorActive:!!W.__vibexe_editor_active__}});
var au=W.__vibexe_audio__;
r.push({system:'Audio',status:au?(au.enabled?'ok':'muted'):'off'});
var mods=Object.keys(W.__vibexe_modules__||{});
r.push({system:'Modules',status:mods.length>0?'ok':'none',details:{loaded:mods}});
if(sc&&w){
  var solidNoPhys=0;var solidNames=[];
  sc.traverse(function(o){
    if(!o.isMesh)return;
    var vt=o.userData&&o.userData.vibexeType;
    if(vt==='collectible'||vt==='decoration'||vt==='player'||vt==='character')return;
    var n=o.name||'';
    if(n==='__terrain__'||n==='__groundPlane__'||n==='__skyDome__')return;
    if(n.indexOf('Helper')>=0||n.indexOf('Light')>=0)return;
    if(o.parent&&o.parent.userData&&(o.parent.userData.vibexeType==='player'||o.parent.userData.vibexeType==='character'))return;
    if(o.parent&&o.parent.userData&&o.parent.userData.__physicsBody)return;
    if(n.indexOf('Collectible')>=0||n.indexOf('Character')>=0||n.indexOf('Decoration')>=0)return;
    var isPlatformLike=n.indexOf('Platform')>=0||n.indexOf('Barrier')>=0||n.indexOf('Wall')>=0||n.indexOf('Floor')>=0||n.indexOf('Block')>=0||vt==='platform'||vt==='barrier';
    if(!isPlatformLike)return;
    if(!o.userData||!o.userData.__physicsBody){solidNoPhys++;if(solidNames.length<5)solidNames.push(n||'unnamed');}
  });
  if(solidNoPhys>0)problems.push({id:'objects-no-physics',severity:'warn',msg:solidNoPhys+' platform/barrier mesh(es) missing physics: '+solidNames.join(', ')});
}
try{window.parent.postMessage({type:'vibexe-debug-system-report-all',systems:r,problems:problems},'*')}catch(e){}
});
})();`;
}
