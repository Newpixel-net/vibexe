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

	// Console log collector — captures tagged logs for diagnostics
	lines.push(generateLogCollector());

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
var _rpw=window.__vibexe_rapierWorld__;
if(_rpw&&_gs.physics&&_gs.physics.gravity!=null){try{_rpw.gravity={x:0.0,y:_gs.physics.gravity,z:0.0}}catch(x){}}
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
    // Create spawn marker at player position
    var T=window.THREE;
    if(T&&!sc.getObjectByName('__editor_spawn_marker__')){
      var _sg=new T.SphereGeometry(0.3,16,16);
      var _sm=new T.MeshBasicMaterial({color:0x00ff88,transparent:true,opacity:0.6});
      var _mk=new T.Mesh(_sg,_sm);
      _mk.name='__editor_spawn_marker__';
      _mk.raycast=function(){};
      _mk.position.copy(candidate.position);
      _mk.position.y-=0.3;
      sc.add(_mk);
      console.log('[Spawn] Marker created at player position');
    }
  }
},2000);
})();`;
}

function generateLogCollector(): string {
	return `(function(){
var _logRing=[];var _logMax=200;
window.__vibexe_logRing__=_logRing;
var _tags=['[TerrainPhysics]','[CharacterSystem]','[SkyWeather]','[AutoPhysics]','[Rapier]','[AutoDetect]','[Bootstrap]','[Module','[GLTF','[Terrain','[Physics','[Camera','[Spawn','[KCC]','[PerfGuard]','[AdaptiveQuality]','[Audio]','[Scene]','[Bridge]','[BoundaryGrid]'];
var _origLog=console.log;var _origWarn=console.warn;var _origErr=console.error;
function _capture(level,args){
  var msg='';for(var i=0;i<args.length;i++){var a=args[i];msg+=(i>0?' ':'')+((a&&typeof a==='object')?JSON.stringify(a):String(a));}
  var tagged=false;for(var t=0;t<_tags.length;t++){if(msg.indexOf(_tags[t])>=0){tagged=true;break;}}
  if(!tagged&&level==='log')return;
  _logRing.push({t:Date.now(),l:level,m:msg.substring(0,500)});
  if(_logRing.length>_logMax)_logRing.shift();
}
console.log=function(){_capture('log',arguments);_origLog.apply(console,arguments);};
console.warn=function(){_capture('warn',arguments);_origWarn.apply(console,arguments);};
console.error=function(){_capture('err',arguments);_origErr.apply(console,arguments);};
window.addEventListener('error',function(ev){_logRing.push({t:Date.now(),l:'err',m:'[Uncaught] '+(ev.message||'')+' at '+(ev.filename||'?')+':'+(ev.lineno||'?')});if(_logRing.length>_logMax)_logRing.shift();});
window.addEventListener('unhandledrejection',function(ev){_logRing.push({t:Date.now(),l:'err',m:'[UnhandledPromise] '+(ev.reason?String(ev.reason).substring(0,300):'unknown')});if(_logRing.length>_logMax)_logRing.shift();});
window.addEventListener('message',function(ev){
  if(!ev.data||ev.data.type!=='vibexe-debug-query-logs')return;
  try{window.parent.postMessage({type:'vibexe-debug-log-report',logs:_logRing.slice(-100)},'*')}catch(e){}
});
})();`;
}

function generateDebugHandler(): string {
	return `(function(){
var _prevSolarTime=null;var _solarSampleTime=0;
window.addEventListener('message',function(ev){
if(!ev.data||ev.data.type!=='vibexe-debug-query-systems')return;
var r=[];
var problems=[];
var W=window;

// === 1. RENDERER ===
var ren=W.__vibexe_renderer__;
var comp=W.__vibexe_composer__;
var _bloomPass=null;if(comp&&comp.passes){for(var _bp=0;_bp<comp.passes.length;_bp++){if(comp.passes[_bp].constructor&&comp.passes[_bp].constructor.name==='UnrealBloomPass'){_bloomPass=comp.passes[_bp];break}}}
r.push({system:'Renderer',status:ren?'ok':'missing',details:ren?{pixelRatio:ren.getPixelRatio(),devicePR:W.devicePixelRatio||1,size:ren.getSize?((function(){var s=new(W.THREE||{}).Vector2();ren.getSize(s);return s.x+'x'+s.y})()):'?',shadows:ren.shadowMap.enabled,shadowType:ren.shadowMap.type===1?'PCF':ren.shadowMap.type===2?'PCFSoft':'Basic',shadowAutoUpdate:ren.shadowMap.autoUpdate,toneMapping:['No','Linear','Reinhard','Cineon','ACES'][ren.toneMapping]||ren.toneMapping,bloom:_bloomPass?(_bloomPass.enabled?'ON':'OFF'):'none',composer:comp?'active':'none'}:null});
if(ren&&ren.getPixelRatio()>1.5)problems.push({id:'high-pixel-ratio',severity:'warn',msg:'Pixel ratio '+ren.getPixelRatio().toFixed(2)+' exceeds 1.5 cap — performance impact'});

// === 2. SCENE ===
var sc=W.__vibexe_scene__;
var meshCount=0;var lightCount=0;var skinnedCount=0;var totalTris=0;
if(sc){sc.traverse(function(o){if(o.isMesh){meshCount++;if(o.isSkinnedMesh)skinnedCount++;if(o.geometry&&o.geometry.index)totalTris+=o.geometry.index.count/3;else if(o.geometry&&o.geometry.attributes&&o.geometry.attributes.position)totalTris+=o.geometry.attributes.position.count/3;}if(o.isLight)lightCount++;})}
var _fogInfo='none';
if(sc&&sc.fog){if(sc.fog.density!==undefined){_fogInfo='exp2 d:'+sc.fog.density.toFixed(4);}else{_fogInfo='linear near:'+Math.round(sc.fog.near||0)+' far:'+Math.round(sc.fog.far||0);}}
r.push({system:'Scene',status:sc?'ok':'missing',details:sc?{children:sc.children.length,meshes:meshCount,skinned:skinnedCount,lights:lightCount,triangles:totalTris>1000?Math.round(totalTris/1000)+'k':Math.round(totalTris),fog:_fogInfo,background:sc.background?'set':'none'}:null});
if(meshCount>500)problems.push({id:'high-mesh-count',severity:'warn',msg:meshCount+' meshes in scene — may impact performance'});
if(totalTris>500000)problems.push({id:'high-tri-count',severity:'warn',msg:Math.round(totalTris/1000)+'k triangles — consider LOD or culling'});

// === 3. CAMERA ===
var cam=W.__vibexe_camera__;
r.push({system:'Camera',status:cam?'ok':'missing',details:cam?{fov:cam.fov,near:cam.near,far:cam.far,pos:cam.position?(+cam.position.x.toFixed(1)+','+cam.position.y.toFixed(1)+','+cam.position.z.toFixed(1)):'?',charCtrlCam:!!W.__charCtrl_camActive,orbitYaw:W.__charCtrl_orbitYaw!=null?(+W.__charCtrl_orbitYaw.toFixed(2)+'rad'):'N/A'}:null});

// === 4. CANNON PHYSICS ===
var w=W.__vibexe_world__;
var dynamicCount=0;var staticCount=0;
if(w&&w.bodies){for(var bi=0;bi<w.bodies.length;bi++){if(w.bodies[bi].mass>0)dynamicCount++;else staticCount++;}}
r.push({system:'CANNON Physics',status:w?'ok':'missing',details:w?{bodies:(w.bodies?w.bodies.length:0),dynamic:dynamicCount,static:staticCount,gravity:w.gravity?w.gravity.y:0}:null});
if(!w)problems.push({id:'no-cannon',severity:'warn',msg:'CANNON.js physics world not initialized'});

// === 5. RAPIER PHYSICS ===
var _rp=W.RAPIER;var _rpw=W.__vibexe_rapierWorld__;
var rpStatus='off';var rpDetails=null;
if(_rp&&_rpw){rpStatus='ok';var _rpBodies=0;var _rpColl=0;try{_rpBodies=_rpw.bodies?_rpw.bodies.len():0;_rpColl=_rpw.colliders?_rpw.colliders.len():0;}catch(e){}
rpDetails={wasmLoaded:true,bodies:_rpBodies,colliders:_rpColl,terrainHF:!!W.__vibexe_rapierTerrainCollider__,terrainBody:!!W.__vibexe_rapierTerrainBody__,gravity:_rpw.gravity?+_rpw.gravity.y.toFixed(1):'?'};}
else if(_rp){rpStatus='inactive';rpDetails={wasmLoaded:true,worldCreated:false};}
else{rpDetails={wasmLoaded:false};}
r.push({system:'Rapier Physics',status:rpStatus,details:rpDetails});
if(_rp&&!_rpw)problems.push({id:'rapier-no-world',severity:'error',msg:'Rapier WASM loaded but world not created'});
if(w&&_rpw){var _cg=w.gravity?w.gravity.y:0;var _rg=_rpw.gravity?_rpw.gravity.y:0;if(Math.abs(_cg-_rg)>1)problems.push({id:'gravity-mismatch',severity:'warn',msg:'CANNON gravity ('+_cg+') != Rapier gravity ('+_rg+') — physics inconsistency'});}

// === 6. TERRAIN (unified) ===
var tm=sc&&sc.getObjectByName?sc.getObjectByName('__terrain__'):null;
var tBody=W.__vibexe_terrainBody;
var tPost=W.__vibexe_terrainPostStep;
var tGetH=W.__vibexe_getTerrainHeight;
var _td=W.__vibexe_terrainData;
var rapierTerrain=!!W.__vibexe_rapierTerrainCollider__;
var cannonTerrain=!!tBody;
var tStatus='off';
if(tm&&(cannonTerrain||rapierTerrain))tStatus='ok';else if(tm&&!cannonTerrain&&!rapierTerrain)tStatus='inactive';else if(tm)tStatus='ok';
var tDetails=null;
if(tm){tDetails={mesh:true,verts:tm.geometry&&tm.geometry.attributes&&tm.geometry.attributes.position?tm.geometry.attributes.position.count:0,cannonBody:cannonTerrain,rapierHF:rapierTerrain,postStepClamp:!!tPost,heightQuery:!!tGetH,visualHeightFn:!!W.__vibexe_getVisualTerrainHeight,surfaceOffset:W.__vibexe_terrainSurfaceOffset||0,boundaryGrid:!!W.__vibexe_terrainBoundaryGrid};}else{tDetails={mesh:false,cannonBody:cannonTerrain,rapierHF:rapierTerrain};}
if(_td){tDetails.dataSize=_td.segX+'x'+_td.segZ;tDetails.terrainSize=(_td.width||0)+'x'+(_td.depth||0);tDetails.heightRange=(_td.minY!=null?_td.minY.toFixed(1):'?')+' - '+(_td.maxY!=null?_td.maxY.toFixed(1):'?');}
r.push({system:'Terrain',status:tStatus,details:tDetails});
if(tm&&!cannonTerrain&&!rapierTerrain)problems.push({id:'terrain-no-physics',severity:'error',msg:'Terrain mesh exists but has NO physics collider (neither CANNON nor Rapier)'});
if(tm&&rapierTerrain&&!_td)problems.push({id:'terrain-no-data',severity:'warn',msg:'Rapier terrain collider exists but __vibexe_terrainData is missing'});

// === 7. PLAYER ===
var pm=W.__vibexe_playerMesh__;
var pb=pm&&pm.userData?pm.userData.__physicsBody:null;
var rapierKCC=W.__charCtrl_rapier;
var hasPhys=!!pb||!!rapierKCC;
r.push({system:'Player',status:pm?'ok':'missing',details:pm?{name:pm.name||'unknown',pos:pm.position?(+pm.position.x.toFixed(1)+','+pm.position.y.toFixed(1)+','+pm.position.z.toFixed(1)):'?',hasPhysicsBody:hasPhys,physicsType:rapierKCC?'rapier-kcc':(pb?'cannon':'none'),visible:pm.visible}:null});
if(pm&&!hasPhys)problems.push({id:'player-no-physics',severity:'error',msg:'Player mesh has NO physics body'});
if(pm&&pm.position&&pm.position.y<-50)problems.push({id:'player-fallen',severity:'error',msg:'Player Y='+pm.position.y.toFixed(1)+' — fell through world'});

// === 8. CHARACTER CONTROLLER ===
var _ccActive=!!W.__charCtrl_active;
var _ccDetails={active:_ccActive};
if(_ccActive){
  _ccDetails.engine=rapierKCC?'Rapier KCC':'CANNON';
  _ccDetails.grounded='N/A';
  if(rapierKCC&&rapierKCC.kcc){try{_ccDetails.grounded=rapierKCC.kcc.computedGrounded()?'yes':'airborne';}catch(e){}}
  if(pm&&pm.position&&tm){var _gH=W.__vibexe_getTerrainHeight;if(_gH){var _th=_gH(pm.position.x,pm.position.z);if(_th!=null){_ccDetails.terrainGap=+(pm.position.y-_th).toFixed(2);if(_ccDetails.terrainGap>=0&&_ccDetails.terrainGap<1.0)_ccDetails.onTerrain=true;}}}
  _ccDetails.snapToGround=rapierKCC&&rapierKCC.kcc?true:false;
  _ccDetails.orbitYaw=W.__charCtrl_orbitYaw!=null?+(W.__charCtrl_orbitYaw*180/Math.PI).toFixed(0)+'deg':'N/A';
  _ccDetails.orbitPitch=W.__charCtrl_orbitPitch!=null?+(W.__charCtrl_orbitPitch*180/Math.PI).toFixed(0)+'deg':'N/A';
}
r.push({system:'Character Controller',status:_ccActive?'ok':'off',details:_ccDetails});
if(!_ccActive&&pm)problems.push({id:'char-ctrl-inactive',severity:'warn',msg:'Player mesh exists but character controller not active'});

// === 9. SKY & WEATHER (deep check) ===
var sw=W.__vibexe_skyWeather;
var swStatus='off';var swDetails=null;
if(sw){
  var _swState=null;try{_swState=sw.getState?sw.getState():null;}catch(e){}
  var _swCfg=sw.config||{};var _swTime=_swCfg.time||{};
  var _st=+(sw.solarTime||0).toFixed(4);
  var _autoAdv=!!_swTime.autoAdvance;
  var _cycleLen=_swTime.cycleLengthMinutes||0;
  var _timeLabel='unknown';
  if(_st<0.21)_timeLabel='Night';else if(_st<0.29)_timeLabel='Dawn';else if(_st<0.42)_timeLabel='Morning';else if(_st<0.58)_timeLabel='Noon';else if(_st<0.71)_timeLabel='Afternoon';else if(_st<0.79)_timeLabel='Dusk';else _timeLabel='Night';
  var _advStatus='checking';
  var now=Date.now();
  if(_prevSolarTime!==null&&_autoAdv&&(now-_solarSampleTime)>1500){
    _advStatus=Math.abs(_st-_prevSolarTime)>0.00005?'yes':'STALLED';
  }
  if(now-_solarSampleTime>1500||_prevSolarTime===null){_prevSolarTime=_st;_solarSampleTime=now;}
  swStatus=sw._active?'ok':(sw.scene?'inactive':'off');
  swDetails={solarTime:_st,timeOfDay:_timeLabel,autoAdvance:_autoAdv,advancing:_autoAdv?_advStatus:'disabled',cycleLenMin:_cycleLen,skyDome:!!(sw.skyDome&&sw.skyDome.mesh),lighting:!!(sw.lighting),stars:!!(sw.stars)};
  if(_autoAdv&&_advStatus==='STALLED'){
    problems.push({id:'sky-cycle-stalled',severity:'error',msg:'Day/night autoAdvance is ON but solarTime is NOT changing (stuck at '+_st+')'});
  }
  if(sw._active&&!sw.skyDome)problems.push({id:'sky-no-dome',severity:'warn',msg:'SkyWeather active but skyDome not created'});
}
r.push({system:'Sky & Weather',status:swStatus,details:swDetails});

// === 10. ADAPTIVE QUALITY ===
var aq=W.__vibexe_adaptive_quality__;
r.push({system:'Adaptive Quality',status:aq?'ok':'off',details:aq?{fps:aq.fps||0,pixelRatio:aq.currentPixelRatio,reductions:aq.reductions||0,shadowsOff:!!aq.shadowsOff,degraded:aq.reductions>0}:null});

// === 11. PERFORMANCE ===
var cullDist=W.__vibexe_cullDistance__||120;
var fpsCounter=document.getElementById('__vibexe_fps__');
var gameFps=fpsCounter?parseInt(fpsCounter.textContent)||0:0;
if(!gameFps&&aq&&aq.fps)gameFps=Math.round(aq.fps);
var perfStatus=gameFps>=40?'ok':(gameFps>=25?'inactive':(gameFps>0?'inactive':'missing'));
var _memInfo=null;if(W.performance&&W.performance.memory){try{_memInfo={usedMB:Math.round(W.performance.memory.usedJSHeapSize/1048576),totalMB:Math.round(W.performance.memory.totalJSHeapSize/1048576)};}catch(e){}}
var _drawCalls=null;if(ren&&ren.info&&ren.info.render){_drawCalls=ren.info.render.calls;}
r.push({system:'Performance',status:perfStatus,details:{gameFps:gameFps,cullDistance:cullDist,skipComposer:!!W.__vibexe_skipComposer__,editorActive:!!W.__vibexe_editor_active__,drawCalls:_drawCalls!=null?_drawCalls:'?',memory:_memInfo,maxFPS:W.__vibexe_maxFPS__||'none'}});
if(gameFps>0&&gameFps<25)problems.push({id:'low-fps',severity:'error',msg:'Game FPS critically low: '+gameFps});
else if(gameFps>=25&&gameFps<40)problems.push({id:'low-fps-warn',severity:'warn',msg:'Game FPS below target: '+gameFps});

// === 12. AUDIO ===
var au=W.__vibexe_audio__;
var _acState='N/A';try{var _ac=new(W.AudioContext||W.webkitAudioContext)();_acState=_ac.state;_ac.close();}catch(e){}
r.push({system:'Audio',status:au?(au.enabled?'ok':'muted'):'off',details:au?{enabled:au.enabled,masterVol:au.masterVolume,musicVol:au.musicVolume,sfxVol:au.sfxVolume,contextState:_acState}:null});

// === 13. MODULES ===
var mods=Object.keys(W.__vibexe_modules__||{});
var _modExpected=W.__VIBEXE_INSTALLED_MODULES__||[];
var _modMissing=[];
for(var _mi=0;_mi<_modExpected.length;_mi++){if(mods.indexOf(_modExpected[_mi])<0)_modMissing.push(_modExpected[_mi]);}
r.push({system:'Modules',status:mods.length>0?'ok':'none',details:{loaded:mods,expected:_modExpected,missing:_modMissing}});
if(_modMissing.length>0)problems.push({id:'modules-missing',severity:'error',msg:'Expected modules not loaded: '+_modMissing.join(', ')});

// === 14. GLTF / MODELS ===
var _gltfCount=0;var _gltfNames=[];
if(sc){sc.traverse(function(o){if(o.userData&&o.userData.__gltfSource){_gltfCount++;if(_gltfNames.length<10)_gltfNames.push(o.name||'unnamed');}else if(o.type==='Group'&&o.children.length>0){var hasSkinned=false;o.traverse(function(c){if(c.isSkinnedMesh)hasSkinned=true;});if(hasSkinned&&_gltfNames.indexOf(o.name)<0){_gltfCount++;if(_gltfNames.length<10)_gltfNames.push(o.name||'unnamed');}}});}
r.push({system:'GLTF Models',status:_gltfCount>0?'ok':'none',details:{count:_gltfCount,models:_gltfNames}});

// === 15. SPAWN / RESPAWN ===
var _gs=W.__VIBEXE_GAME_SETTINGS__||{};
var _spawnPos=_gs.spawnPosition||null;
var _spawnMarker=sc&&sc.getObjectByName?sc.getObjectByName('__editor_spawn_marker__'):null;
var _spawnSource='not set';var _spawnStatus='off';var _spawnDisplay='default (origin)';
if(_spawnPos){_spawnStatus='ok';_spawnSource='gameSettings';_spawnDisplay=_spawnPos.x+','+_spawnPos.y+','+_spawnPos.z;}
else if(pm&&pm.position){_spawnStatus='ok';_spawnSource='player position';_spawnDisplay=+pm.position.x.toFixed(1)+','+pm.position.y.toFixed(1)+','+pm.position.z.toFixed(1);}
r.push({system:'Spawn',status:_spawnStatus,details:{position:_spawnDisplay,source:_spawnSource,marker:!!_spawnMarker,respawnY:_gs.respawnY||'default'}});

// === 16. LIGHTS (detailed) ===
var _lightDetails=[];
if(sc){sc.traverse(function(o){if(!o.isLight)return;var ld={name:o.name||o.type,type:o.type,intensity:o.intensity};if(o.shadow)ld.castShadow=o.castShadow;if(o.shadow&&o.shadow.mapSize)ld.shadowRes=o.shadow.mapSize.x;_lightDetails.push(ld);});}
var _shadowLights=_lightDetails.filter(function(l){return l.castShadow;});
r.push({system:'Lighting',status:_lightDetails.length>0?'ok':'missing',details:{total:_lightDetails.length,shadowCasters:_shadowLights.length,list:_lightDetails.slice(0,8).map(function(l){return l.name+'('+l.type+',i:'+l.intensity+')'})}});
if(_lightDetails.length===0)problems.push({id:'no-lights',severity:'warn',msg:'No lights in scene'});
if(_shadowLights.length>3)problems.push({id:'many-shadow-casters',severity:'warn',msg:_shadowLights.length+' shadow-casting lights — may impact performance'});

// === 17. SOLID OBJECTS CHECK ===
if(sc){
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

// === 18. GAME SETTINGS INTEGRITY ===
var _gsCheck=W.__VIBEXE_GAME_SETTINGS__;
var _gsDetails={loaded:!!_gsCheck};
if(_gsCheck){
  _gsDetails.scenes=_gsCheck.scenes?_gsCheck.scenes.length:0;
  _gsDetails.modules=_gsCheck.modules&&_gsCheck.modules.installed?Object.keys(_gsCheck.modules.installed).length:0;
  _gsDetails.hasCamera=!!_gsCheck.camera;
  _gsDetails.hasPhysics=!!_gsCheck.physics;
  _gsDetails.hasTerrain=!!(_gsCheck.modules&&_gsCheck.modules.installed&&_gsCheck.modules.installed['terrain-painter']);
  _gsDetails.hasCharCtrl=!!(_gsCheck.modules&&_gsCheck.modules.installed&&_gsCheck.modules.installed['character-system']);
}
r.push({system:'Game Settings',status:_gsCheck?'ok':'missing',details:_gsDetails});
if(!_gsCheck)problems.push({id:'no-game-settings',severity:'error',msg:'__VIBEXE_GAME_SETTINGS__ not loaded'});

// === 19. ERROR LOG SUMMARY ===
var _logRing=W.__vibexe_logRing__||[];
var _errCount=0;var _warnCount=0;var _recentErrors=[];
for(var _li=0;_li<_logRing.length;_li++){
  if(_logRing[_li].l==='err'){_errCount++;if(_recentErrors.length<3)_recentErrors.push(_logRing[_li].m.substring(0,80));}
  if(_logRing[_li].l==='warn')_warnCount++;
}
r.push({system:'Console Health',status:_errCount>0?'inactive':(_warnCount>5?'inactive':'ok'),details:{errors:_errCount,warnings:_warnCount,totalLogs:_logRing.length,recentErrors:_recentErrors}});
if(_errCount>5)problems.push({id:'many-errors',severity:'warn',msg:_errCount+' errors captured in console — check logs for details'});

try{window.parent.postMessage({type:'vibexe-debug-system-report-all',systems:r,problems:problems},'*')}catch(e){}
});
})();`;
}
