/**
 * Terrain Painter Module — Manifest & Registration
 *
 * First Vibexe module: GPU-accelerated procedural terrain texturing.
 * Converted from Unity Asset Store "Procedural Terrain Painter" by Staggart Creations.
 *
 * Features:
 * - Height-based texturing (snow on peaks, sand in valleys)
 * - Slope-based texturing (rock on cliffs, grass on flat areas)
 * - Curvature-based texturing (dirt in crevices, moss on ridges)
 * - Noise-based organic variation
 * - Direction-based texturing (sun-facing vs shadow)
 * - Texture mask overlays
 * - Up to 8 texture layers with modifier stacks
 * - GPU-accelerated via WebGLRenderTarget pipeline
 */

import type { ModuleManifest } from "../module-types";

export const TERRAIN_PAINTER_MANIFEST: ModuleManifest = {
	id: "terrain-painter",
	name: "Procedural Terrain Painter",
	version: "1.0.0",
	category: "terrain",
	description:
		"GPU-accelerated terrain texturing based on height, slope, curvature, noise & direction",
	icon: "Mountain",
	assets: [
		"textures/terrain/grass.jpg",
		"textures/terrain/rock.jpg",
		"textures/terrain/sand.jpg",
		"textures/terrain/snow.jpg",
		"textures/terrain/dirt.jpg",
	],
	runtimeCode: `
// @vibexe/terrain-painter v1.0.0
// Procedural terrain generation, PBR painting, sculpting, physics
var THREE = require('three');
var CANNON = typeof window !== 'undefined' ? window.CANNON : null;

// ============================================================
// SimplexNoise — 2D simplex noise with fBm, ridged, warp
// ============================================================

var _grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
var _p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
var _perm = new Array(512);
for (var _i = 0; _i < 512; _i++) _perm[_i] = _p[_i & 255];

function SimplexNoise() {}

SimplexNoise.noise2D = function(xin, yin) {
  var F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  var G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
  var s = (xin + yin) * F2;
  var i = Math.floor(xin + s);
  var j = Math.floor(yin + s);
  var t = (i + j) * G2;
  var X0 = i - t, Y0 = j - t;
  var x0 = xin - X0, y0 = yin - Y0;
  var i1, j1;
  if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
  var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  var x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
  var ii = i & 255, jj = j & 255;
  var gi0 = _perm[ii + _perm[jj]] % 12;
  var gi1 = _perm[ii + i1 + _perm[jj + j1]] % 12;
  var gi2 = _perm[ii + 1 + _perm[jj + 1]] % 12;
  var n0 = 0, n1 = 0, n2 = 0;
  var t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * (_grad3[gi0][0] * x0 + _grad3[gi0][1] * y0); }
  var t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * (_grad3[gi1][0] * x1 + _grad3[gi1][1] * y1); }
  var t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * (_grad3[gi2][0] * x2 + _grad3[gi2][1] * y2); }
  return 70.0 * (n0 + n1 + n2);
};

SimplexNoise.fbm = function(x, y, octaves, lacunarity, gain) {
  var sum = 0, amp = 1, freq = 1, maxAmp = 0;
  for (var o = 0; o < octaves; o++) {
    sum += SimplexNoise.noise2D(x * freq, y * freq) * amp;
    maxAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / maxAmp;
};

SimplexNoise.ridgedMultifractal = function(x, y, octaves, lacunarity, gain, sharpness) {
  var sum = 0, amp = 1, freq = 1, prev = 1;
  for (var o = 0; o < octaves; o++) {
    var n = SimplexNoise.noise2D(x * freq, y * freq);
    n = 1.0 - Math.abs(n);
    n = Math.pow(n, sharpness);
    n *= prev;
    prev = Math.max(0.01, n);
    sum += n * amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum;
};

SimplexNoise.domainWarp = function(x, y, strength) {
  var wx = SimplexNoise.fbm(x + 5.2, y + 1.3, 3, 2.0, 0.5) * strength;
  var wy = SimplexNoise.fbm(x + 9.7, y + 6.8, 3, 2.0, 0.5) * strength;
  return [x + wx, y + wy];
};

SimplexNoise.smoothstep = function(edge0, edge1, x) {
  var t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};


// ============================================================
// TerrainGenerator
// ============================================================

function TerrainGenerator(scene, options) {
  this.scene = scene;
  this.width = (options && options.width) || 100;
  this.depth = (options && options.depth) || 100;
  this.heightScale = (options && options.heightScale != null) ? options.heightScale : 30;
  this.segments = (options && options.segments) || 128;
  this.mesh = null;
  this.heightData = null;
  this.minY = 0;
  this.maxY = 0;
  this._segX = this.segments + 1;
  this._segZ = this.segments + 1;
}

TerrainGenerator.prototype.generate = function() {
  // Remove existing terrain
  var old = this.scene.getObjectByName("__terrain__");
  if (old) {
    this.scene.remove(old);
    if (old.geometry) old.geometry.dispose();
    if (old.material) {
      // T-L1 fix: dispose material textures before disposing material itself
      var _texKeys = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "bumpMap", "displacementMap"];
      for (var _ti = 0; _ti < _texKeys.length; _ti++) { if (old.material[_texKeys[_ti]]) { try { old.material[_texKeys[_ti]].dispose(); } catch(e) {} } }
      old.material.dispose();
    }
  }

  var W = this.width, D = this.depth, H = this.heightScale, seg = this.segments;
  var segX = this._segX, segZ = this._segZ;

  // Create geometry laid flat on XZ plane
  var geo = new THREE.PlaneGeometry(W, D, seg, seg);
  geo.rotateX(-Math.PI / 2);

  var pos = geo.attributes.position;
  var minY = Infinity, maxY = -Infinity;
  var halfW = W * 0.5, halfD = D * 0.5;
  var heightData = new Float32Array(segX * segZ);

  for (var vi = 0; vi < pos.count; vi++) {
    var vx = pos.getX(vi);
    var vz = pos.getZ(vi);
    var nx = vx / W;
    var nz = vz / D;

    // Edge falloff
    var edgeX = 1.0 - Math.pow(2.0 * Math.abs(nx), 3);
    var edgeZ = 1.0 - Math.pow(2.0 * Math.abs(nz), 3);
    var edgeFalloff = SimplexNoise.smoothstep(0, 0.25, Math.max(0, Math.min(edgeX, edgeZ)));

    // Domain warp for organic shapes
    var warpPt = SimplexNoise.domainWarp(nx * 1.5, nz * 1.5, 0.45);
    var wx = warpPt[0], wz = warpPt[1];

    // Scale 1: Continental base (domain-warped fBm) — broad mountain shape
    var continental = (SimplexNoise.fbm(wx * 1.0, wz * 1.0, 6, 2.0, 0.5) + 1) * 0.5;
    continental = Math.pow(continental, 2.2);

    // Scale 2: Mountain ridges (ridged multifractal) — sharp peaks
    var ridges = SimplexNoise.ridgedMultifractal(nx * 2.5 + 3.7, nz * 2.5 + 1.2, 5, 2.1, 0.5, 2.5);
    ridges *= 0.3;

    // Scale 3: Rolling foothills — medium frequency variation
    var hills = SimplexNoise.fbm(nx * 5.0 + 7.3, nz * 5.0 + 2.8, 4, 2.0, 0.5) * 0.06;

    // Scale 4: Fine surface detail (altitude-dependent)
    var detail = SimplexNoise.fbm(nx * 12.0, nz * 12.0, 3, 2.0, 0.4) * 0.02;

    // Compose: continental 60% + ridges, with altitude-dependent roughness
    var baseH = continental * 0.6 + ridges;
    var roughDetail = (hills + detail) * (0.3 + Math.min(1, baseH) * 0.7);

    var h = (baseH + roughDetail) * edgeFalloff * H;
    pos.setY(vi, h);
    heightData[vi] = h;
    if (h < minY) minY = h;
    if (h > maxY) maxY = h;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // ========== Post-generation Erosion Pipeline ==========
  // Thermal erosion: material slides downhill when slope exceeds talus angle
  var THERMAL_ITERATIONS = 40;
  var TALUS_ANGLE = 0.6; // ~31 degrees
  var THERMAL_RATE = 0.4;
  for (var ti = 0; ti < THERMAL_ITERATIONS; ti++) {
    for (var tz = 1; tz < seg; tz++) {
      for (var tx = 1; tx < seg; tx++) {
        var ci = tz * segX + tx;
        var ch = heightData[ci];
        // 4-neighbor differences
        var diffs = [
          { idx: ci - 1, d: ch - heightData[ci - 1] },
          { idx: ci + 1, d: ch - heightData[ci + 1] },
          { idx: ci - segX, d: ch - heightData[ci - segX] },
          { idx: ci + segX, d: ch - heightData[ci + segX] }
        ];
        var maxDiff = 0, totalDiff = 0;
        for (var di = 0; di < 4; di++) {
          if (diffs[di].d > TALUS_ANGLE) {
            totalDiff += diffs[di].d;
            if (diffs[di].d > maxDiff) maxDiff = diffs[di].d;
          }
        }
        if (totalDiff > 0) {
          var moved = maxDiff * THERMAL_RATE * 0.5;
          heightData[ci] -= moved;
          for (var di2 = 0; di2 < 4; di2++) {
            if (diffs[di2].d > TALUS_ANGLE) {
              heightData[diffs[di2].idx] += moved * (diffs[di2].d / totalDiff);
            }
          }
        }
      }
    }
  }

  // Feature-preserving smooth (Laplacian, 3 iterations)
  var SMOOTH_ITERATIONS = 3;
  var SMOOTH_FACTOR = 0.35;
  for (var si = 0; si < SMOOTH_ITERATIONS; si++) {
    var smoothed = new Float32Array(heightData.length);
    for (var sz = 0; sz < segZ; sz++) {
      for (var sx = 0; sx < segX; sx++) {
        var sidx = sz * segX + sx;
        if (sx === 0 || sx === segX - 1 || sz === 0 || sz === segZ - 1) {
          smoothed[sidx] = heightData[sidx];
          continue;
        }
        var avg4 = (heightData[sidx-1] + heightData[sidx+1] + heightData[sidx-segX] + heightData[sidx+segX]) * 0.25;
        var diff = avg4 - heightData[sidx];
        // Feature-preserving: only smooth small differences (preserve ridges)
        var blendAmt = Math.min(1.0, 2.0 / (1.0 + Math.abs(diff) * 8.0));
        smoothed[sidx] = heightData[sidx] + diff * SMOOTH_FACTOR * blendAmt;
      }
    }
    heightData = smoothed;
  }

  // Write eroded heights back to geometry
  minY = Infinity; maxY = -Infinity;
  for (var ei = 0; ei < pos.count; ei++) {
    pos.setY(ei, heightData[ei]);
    if (heightData[ei] < minY) minY = heightData[ei];
    if (heightData[ei] > maxY) maxY = heightData[ei];
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Normalize so minimum height = 0 (terrain IS the game floor)
  if (minY !== 0) {
    var shift = -minY;
    for (var nvi = 0; nvi < pos.count; nvi++) {
      var shiftedY = pos.getY(nvi) + shift;
      pos.setY(nvi, shiftedY);
      heightData[nvi] = shiftedY;
    }
    maxY += shift;
    minY = 0;
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // Per-vertex height (0-1) and slope (degrees) attributes
  var heightArr = new Float32Array(pos.count);
  var slopeArr = new Float32Array(pos.count);
  var normAttr = geo.attributes.normal;
  var range = maxY - minY || 1;
  for (var vi2 = 0; vi2 < pos.count; vi2++) {
    heightArr[vi2] = (pos.getY(vi2) - minY) / range;
    var ny = normAttr.getY(vi2);
    slopeArr[vi2] = Math.acos(Math.min(1, Math.abs(ny))) * (180 / Math.PI);
  }
  geo.setAttribute("terrainHeight", new THREE.BufferAttribute(heightArr, 1));
  geo.setAttribute("terrainSlope", new THREE.BufferAttribute(slopeArr, 1));

  // Vertex colors: mountain gradient (dirt/grass/rock/snow)
  var colors = new Float32Array(pos.count * 3);
  for (var vi3 = 0; vi3 < pos.count; vi3++) {
    var nh = heightArr[vi3];
    var slope = slopeArr[vi3];
    var r, g, b;
    // Snow on high peaks (soft transition)
    if (nh > 0.65 && slope < 40) {
      var sf = SimplexNoise.smoothstep(0.6, 0.75, nh);
      r = 0.75 + sf * 0.2; g = 0.78 + sf * 0.18; b = 0.82 + sf * 0.15;
    }
    // Rock on steep slopes (at any height)
    else if (slope > 35) {
      var rockVar = SimplexNoise.noise2D(pos.getX(vi3) * 0.1, pos.getZ(vi3) * 0.1) * 0.08;
      r = 0.42 + rockVar; g = 0.40 + rockVar; b = 0.38 + rockVar;
    }
    // Grass on mid-heights
    else if (nh > 0.15 && nh <= 0.65) {
      var grassVar = SimplexNoise.noise2D(pos.getX(vi3) * 0.15, pos.getZ(vi3) * 0.15) * 0.06;
      var heightBlend = SimplexNoise.smoothstep(0.15, 0.3, nh);
      r = 0.28 + grassVar; g = 0.42 + grassVar + heightBlend * 0.05; b = 0.18 + grassVar;
    }
    // Dirt/sand at low elevations
    else {
      var dirtVar = SimplexNoise.noise2D(pos.getX(vi3) * 0.12, pos.getZ(vi3) * 0.12) * 0.05;
      r = 0.48 + dirtVar; g = 0.38 + dirtVar; b = 0.25 + dirtVar;
    }
    colors[vi3 * 3] = r;
    colors[vi3 * 3 + 1] = g;
    colors[vi3 * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  var mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: false
  });

  var mesh = new THREE.Mesh(geo, mat);
  mesh.name = "__terrain__";
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.userData.vibexeType = "Terrain";
  mesh.userData.__isTerrain = true;
  mesh.userData.__terrainMinY = minY;
  mesh.userData.__terrainMaxY = maxY;
  mesh.userData.__terrainWidth = W;
  this.scene.add(mesh);

  this.mesh = mesh;
  this.heightData = heightData;
  this.minY = minY;
  this.maxY = maxY;

  // Store globally for physics and height queries
  window.__vibexe_terrainData = {
    heightData: heightData,
    width: W,
    depth: D,
    segX: segX,
    segZ: segZ,
    minY: minY,
    maxY: maxY
  };

  // Bilinear interpolation height query (O(1) per call)
  var self = this;
  window.__vibexe_getTerrainHeight = function(x, z) {
    return self.getHeightAt(x, z);
  };

  // X7 fix: publish terrain surface offset for character-system module interop
  // This offset accounts for PBR grass/vegetation visual height above geometric surface
  window.__vibexe_terrainSurfaceOffset = 0.15;

  // Hide ground plane and grid
  this.scene.traverse(function(child) {
    if (child === mesh) return;
    if (child.isMesh && !child.name) {
      var cGeo = child.geometry;
      if (cGeo && cGeo.type === "PlaneGeometry") {
        var cParams = cGeo.parameters;
        if (cParams && (cParams.width >= 50 || cParams.height >= 50)) {
          child.visible = false;
          child.userData.__hiddenByTerrain = true;
        }
      }
    }
    if (child.isGridHelper || child.type === "GridHelper") {
      child.visible = false;
      child.userData.__hiddenByTerrain = true;
    }
  });

  console.log("[TerrainGenerator] Generated:", pos.count, "vertices, height range:", minY.toFixed(1), "-", maxY.toFixed(1));
  return mesh;
};

TerrainGenerator.prototype.getHeightAt = function(x, z) {
  var td = window.__vibexe_terrainData;
  if (!td || !td.heightData) return null;
  // T3 fix: return null for positions outside terrain bounds
  var halfW = td.width * 0.5, halfD = td.depth * 0.5;
  if (x < -halfW || x > halfW || z < -halfD || z > halfD) return null;
  var gx = (x + halfW) / td.width * (td.segX - 1);
  var gz = (z + halfD) / td.depth * (td.segZ - 1);
  gx = Math.max(0, Math.min(td.segX - 2, gx));
  gz = Math.max(0, Math.min(td.segZ - 2, gz));
  var ix = Math.floor(gx), iz = Math.floor(gz);
  var fx = gx - ix, fz = gz - iz;
  var i00 = iz * td.segX + ix;
  // T2 fix: bounds check before array access
  var maxIdx = i00 + td.segX + 1;
  if (maxIdx >= td.heightData.length || i00 < 0) return null;
  var h00 = td.heightData[i00];
  var h10 = td.heightData[i00 + 1];
  var h01 = td.heightData[i00 + td.segX];
  var h11 = td.heightData[i00 + td.segX + 1];
  var result = h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
  return isNaN(result) ? null : result;
};

TerrainGenerator.prototype.getMesh = function() {
  return this.mesh;
};

TerrainGenerator.prototype.getHeightData = function() {
  return this.heightData;
};

TerrainGenerator.prototype.destroy = function() {
  if (this.mesh) {
    this.scene.remove(this.mesh);
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
    this.mesh = null;
  }
  this.heightData = null;
  window.__vibexe_terrainData = null;
  window.__vibexe_getTerrainHeight = null;
  // T-L2 fix: clear surface offset global on terrain destroy
  window.__vibexe_terrainSurfaceOffset = 0;
};


// ============================================================
// TerrainPhysics — CANNON.js Heightfield + Rapier Heightfield
// ============================================================

function TerrainPhysics(terrainGenerator) {
  this.terrainGen = terrainGenerator;
  this.body = null;
  this.shape = null;
  this.world = null;
  this._postStepFn = null;
  this._watcherInterval = null;
  // Rapier terrain collider (parallel physics world)
  this._rapierBody = null;
  this._rapierCollider = null;
}

// Helper: Build Rapier heightfield from terrain data
TerrainPhysics.prototype._setupRapierHeightfield = function(td) {
  var R = window.RAPIER;
  var rw = window.__vibexe_rapierWorld__;
  if (!R || !rw || !td) return;

  // Remove previous Rapier terrain
  if (this._rapierCollider) {
    try { rw.removeCollider(this._rapierCollider, true); } catch(e) {}
    this._rapierCollider = null;
  }
  if (this._rapierBody) {
    try { rw.removeRigidBody(this._rapierBody); } catch(e) {}
    this._rapierBody = null;
  }

  try {
    // Rapier heightfield: nrows (X) x ncols (Z), Float32Array in row-major order
    // Our heightData[z * segX + x] → rapier heights[x * segZ + z]
    var nrows = td.segX;
    var ncols = td.segZ;
    var heights = new Float32Array(nrows * ncols);
    for (var x = 0; x < nrows; x++) {
      for (var z = 0; z < ncols; z++) {
        heights[x * ncols + z] = td.heightData[z * nrows + x];
      }
    }

    // Scale: heightfield spans -scale/2 to +scale/2 on X and Z, heights scaled by Y
    var scale = { x: td.width, y: 1.0, z: td.depth };
    var colliderDesc = R.ColliderDesc.heightfield(nrows, ncols, heights, scale);

    // Fixed body at origin (Rapier centers the heightfield automatically)
    var bodyDesc = R.RigidBodyDesc.fixed();
    this._rapierBody = rw.createRigidBody(bodyDesc);
    this._rapierCollider = rw.createCollider(colliderDesc, this._rapierBody);

    window.__vibexe_rapierTerrainBody__ = this._rapierBody;
    window.__vibexe_rapierTerrainCollider__ = this._rapierCollider;
    console.log("[TerrainPhysics] Rapier heightfield created:", nrows, "x", ncols, "scale:", td.width + "x" + td.depth);
  } catch(err) {
    console.error("[TerrainPhysics] Rapier heightfield failed:", err);
  }
};

TerrainPhysics.prototype.setup = function(world) {
  // T15 fix: prefer module-level CANNON capture, fallback to window (protects against global overwrites)
  var C = CANNON || window.CANNON;
  if (!C || !world) {
    // World not ready — set up a watcher
    console.warn("[TerrainPhysics] World not ready — will create heightfield when physics starts");
    var self = this;
    // T4 fix: clear any prior watcher from previous terrain instance to prevent leaks
    if (window.__vibexe_terrainPhysicsWatcher) {
      clearInterval(window.__vibexe_terrainPhysicsWatcher);
      window.__vibexe_terrainPhysicsWatcher = null;
    }
    if (!this._watcherInterval) {
      this._watcherInterval = setInterval(function() {
        var dC = window.CANNON;
        var dW = window.__vibexe_world__;
        var dTD = window.__vibexe_terrainData;
        if (dC && dW && dTD && !window.__vibexe_terrainBody) {
          clearInterval(self._watcherInterval);
          self._watcherInterval = null;
          window.__vibexe_terrainPhysicsWatcher = null;
          self.setup(dW);
        }
      }, 200);
      window.__vibexe_terrainPhysicsWatcher = this._watcherInterval;
    }
    return;
  }

  this.world = world;

  // Remove previous terrain body
  if (window.__vibexe_terrainBody) {
    try { world.removeBody(window.__vibexe_terrainBody); } catch(e) {}
    window.__vibexe_terrainBody = null;
  }

  // Disable infinite ground plane (terrain replaces it)
  for (var bi = 0; bi < world.bodies.length; bi++) {
    var gpBody = world.bodies[bi];
    if (gpBody.mass === 0 && gpBody.shapes && gpBody.shapes.length === 1 && gpBody.shapes[0] instanceof C.Plane) {
      gpBody.position.set(0, -10000, 0);
      gpBody.updateMassProperties();
      window.__vibexe_groundPlaneBody = gpBody;
      console.log("[TerrainPhysics] Disabled ground plane (moved to Y=-10000)");
      break;
    }
  }

  var td = window.__vibexe_terrainData;
  if (!td) return;

  // Build column-major height matrix for CANNON Heightfield
  // CANNON grid: hz=0 → world Z=+D/2, hz=end → world Z=-D/2 (after rotation+offset)
  // HeightData: row 0 → world Z=-D/2, row end → world Z=+D/2
  // So we reverse Z: use (segZ - 1 - hz) to align CANNON grid with visual mesh
  var matrix = [];
  for (var hx = 0; hx < td.segX; hx++) {
    matrix.push([]);
    for (var hz = 0; hz < td.segZ; hz++) {
      matrix[hx].push(td.heightData[(td.segZ - 1 - hz) * td.segX + hx]);
    }
  }

  var elementSize = td.width / (td.segX - 1);
  try {
    this.shape = new C.Heightfield(matrix, { elementSize: elementSize });
    this.body = new C.Body({ mass: 0, type: C.Body.STATIC });
    this.body.addShape(this.shape);
    // CANNON Heightfield: height along local Z, rotate -90 X to align with world Y
    this.body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.body.position.set(-td.width / 2, 0, td.depth / 2);
    world.addBody(this.body);
    window.__vibexe_terrainBody = this.body;
    window.__vibexe_terrainHFShape = this.shape;
    console.log("[TerrainPhysics] Heightfield body created:", td.segX, "x", td.segZ, "elementSize:", elementSize.toFixed(3));
  } catch(err) {
    console.error("[TerrainPhysics] Failed to create heightfield:", err);
  }

  // PostStep terrain clamp + active ground-following
  // Runs after every physics step to ensure dynamic bodies stay ON terrain.
  // Two modes:
  //   1. Below terrain → snap up immediately (safety net)
  //   2. Within threshold above terrain & not jumping → snap to surface (ground-follow)
  // Mode 2 is critical because CANNON Heightfield collision is unreliable for Box shapes
  // (catches on edges, leaves gaps) and low-gravity settings cause slow floaty descent.
  // T14 fix: remove old PostStep listener before adding new one (prevents duplicate listeners on re-init)
  if (window.__vibexe_terrainPostStep) {
    try { world.removeEventListener("postStep", window.__vibexe_terrainPostStep); } catch(e) {}
    window.__vibexe_terrainPostStep = null;
  }
  {
    this._postStepFn = function() {
      var getH = window.__vibexe_getTerrainHeight;
      var w = window.__vibexe_world__;
      if (!getH || !w) return;
      for (var pi = 0; pi < w.bodies.length; pi++) {
        var pb = w.bodies[pi];
        if (pb.mass <= 0) continue;
        // Skip sleeping bodies (saves CPU — they're not moving)
        if (pb.sleepState === 2) continue;
        var th = getH(pb.position.x, pb.position.z);
        if (th == null) continue;
        // Compute half-height from body's shape bounds (not hardcoded)
        var halfH = 0.5;
        if (pb.shapes && pb.shapes.length > 0) {
          var s0 = pb.shapes[0];
          if (s0.halfExtents) halfH = s0.halfExtents.y;
          else if (s0.radius) halfH = s0.radius;
          else if (s0.height) halfH = s0.height * 0.5;
          else if (s0.boundingSphereRadius) halfH = s0.boundingSphereRadius;
        }
        var minY = th + halfH;
        if (pb.position.y < minY) {
          // Below terrain — snap up immediately
          pb.position.y = minY;
          if (pb.velocity.y < 0) pb.velocity.y = 0;
          pb.__canJump = true;
        } else if ((pb.position.y - minY) < 3.0 && pb.velocity.y <= 0) {
          // T7 fix: only snap when falling or at rest (was vy<=1.5, caught mid-jump)
          // Active ground-following: within 3 units of terrain and falling/stationary
          pb.position.y = minY;
          if (pb.velocity.y < 0) pb.velocity.y = 0;
          pb.__canJump = true;
        }
      }
    };
    window.__vibexe_terrainPostStep = this._postStepFn;
    world.addEventListener("postStep", this._postStepFn);
    console.log("[TerrainPhysics] PostStep terrain clamp + ground-following registered");
  }

  // Also create Rapier heightfield (parallel world — for KCC terrain collision)
  this._setupRapierHeightfield(td);
};

TerrainPhysics.prototype.rebuild = function() {
  // T15 fix: prefer module-level CANNON capture
  var C = CANNON || window.CANNON;
  var world = this.world || window.__vibexe_world__;
  var td = window.__vibexe_terrainData;
  if (!C || !world || !td) return;

  // Remove old body
  if (window.__vibexe_terrainBody) {
    try { world.removeBody(window.__vibexe_terrainBody); } catch(e) {}
  }

  // Build new height matrix from updated heightData (Z-reversed to match CANNON grid)
  var matrix = [];
  for (var sx = 0; sx < td.segX; sx++) {
    matrix.push([]);
    for (var sz = 0; sz < td.segZ; sz++) {
      matrix[sx].push(td.heightData[(td.segZ - 1 - sz) * td.segX + sx]);
    }
  }

  var elementSize = td.width / (td.segX - 1);
  try {
    this.shape = new C.Heightfield(matrix, { elementSize: elementSize });
    this.body = new C.Body({ mass: 0, type: C.Body.STATIC });
    this.body.addShape(this.shape);
    this.body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.body.position.set(-td.width / 2, 0, td.depth / 2);
    world.addBody(this.body);
    window.__vibexe_terrainBody = this.body;
    window.__vibexe_terrainHFShape = this.shape;
  } catch(err) {
    console.error("[TerrainPhysics] Rebuild failed:", err);
  }

  // Also rebuild Rapier heightfield
  this._setupRapierHeightfield(td);
};

TerrainPhysics.prototype.destroy = function() {
  if (this._watcherInterval) {
    clearInterval(this._watcherInterval);
    this._watcherInterval = null;
  }
  var world = this.world || window.__vibexe_world__;
  if (this.body && world) {
    try { world.removeBody(this.body); } catch(e) {}
  }
  if (this._postStepFn && world) {
    try { world.removeEventListener("postStep", this._postStepFn); } catch(e) {}
  }
  // Clean up Rapier terrain
  var rw = window.__vibexe_rapierWorld__;
  if (this._rapierCollider && rw) {
    try { rw.removeCollider(this._rapierCollider, true); } catch(e) {}
  }
  if (this._rapierBody && rw) {
    try { rw.removeRigidBody(this._rapierBody); } catch(e) {}
  }
  window.__vibexe_terrainBody = null;
  window.__vibexe_terrainHFShape = null;
  window.__vibexe_terrainPostStep = null;
  window.__vibexe_rapierTerrainBody__ = null;
  window.__vibexe_rapierTerrainCollider__ = null;
  this.body = null;
  this.shape = null;
  this.world = null;
  this._rapierBody = null;
  this._rapierCollider = null;
};


// ============================================================
// TerrainSculpt — Raise/Lower/Flatten/Smooth brushes
// ============================================================

function TerrainSculpt(terrainGenerator, terrainPhysics) {
  this.terrainGen = terrainGenerator;
  this.terrainPhysics = terrainPhysics;
  this._targetHeight = 0;
}

TerrainSculpt.prototype.setTargetHeight = function(h) {
  this._targetHeight = h;
};

TerrainSculpt.prototype.applyBrush = function(worldX, worldZ, type, size, strength, falloff) {
  var mesh = this.terrainGen.mesh;
  if (!mesh) return;
  var geo = mesh.geometry;
  var pos = geo.attributes.position;
  var td = window.__vibexe_terrainData;
  if (!td) return;

  var R = size;
  var str = strength;
  var R2 = R * R;
  var modified = false;

  for (var vi = 0; vi < pos.count; vi++) {
    var vx = pos.getX(vi);
    var vz = pos.getZ(vi);
    var dx = vx - worldX;
    var dz = vz - worldZ;
    var dist2 = dx * dx + dz * dz;
    if (dist2 > R2) continue;

    var dist = Math.sqrt(dist2);
    var alpha;
    if (falloff === "flat") {
      alpha = 1.0;
    } else if (falloff === "linear") {
      alpha = 1.0 - dist / R;
    } else {
      // gaussian
      var t = dist / R;
      alpha = Math.exp(-t * t * 3.0);
    }

    var curY = pos.getY(vi);

    switch (type) {
      case "raise":
        pos.setY(vi, curY + alpha * str);
        break;
      case "lower":
        pos.setY(vi, curY - alpha * str);
        break;
      case "flatten":
        pos.setY(vi, curY + (this._targetHeight - curY) * alpha * str);
        break;
      case "smooth": {
        var gx = vi % td.segX;
        var gz = Math.floor(vi / td.segX);
        var sum = 0, cnt = 0;
        for (var nz = -1; nz <= 1; nz++) {
          for (var nx = -1; nx <= 1; nx++) {
            var ngx = gx + nx, ngz = gz + nz;
            if (ngx >= 0 && ngx < td.segX && ngz >= 0 && ngz < td.segZ) {
              var ni = ngz * td.segX + ngx;
              if (ni < pos.count) {
                sum += pos.getY(ni);
                cnt++;
              }
            }
          }
        }
        var avg = cnt > 0 ? sum / cnt : curY;
        pos.setY(vi, curY + (avg - curY) * alpha * str);
        break;
      }
    }

    if (vi < td.heightData.length) {
      td.heightData[vi] = pos.getY(vi);
    }
    modified = true;
  }

  if (modified) {
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    // Recompute minY/maxY
    var newMinY = Infinity, newMaxY = -Infinity;
    for (var mi = 0; mi < pos.count; mi++) {
      var yy = pos.getY(mi);
      if (yy < newMinY) newMinY = yy;
      if (yy > newMaxY) newMaxY = yy;
    }
    td.minY = newMinY;
    td.maxY = newMaxY;

    // Update terrainHeight and terrainSlope attributes
    var hAttr = geo.attributes.terrainHeight;
    var sAttr = geo.attributes.terrainSlope;
    if (hAttr && sAttr) {
      var norms = geo.attributes.normal;
      var hRange = td.maxY - td.minY || 1;
      for (var ui = 0; ui < pos.count; ui++) {
        var nh = (pos.getY(ui) - td.minY) / hRange;
        hAttr.setX(ui, Math.max(0, Math.min(1, nh)));
        var ny = norms.getY(ui);
        sAttr.setX(ui, Math.acos(Math.abs(ny)) * (180 / Math.PI));
      }
      hAttr.needsUpdate = true;
      sAttr.needsUpdate = true;
    }

    // Rebuild physics heightfield after sculpt
    if (this.terrainPhysics) {
      this.terrainPhysics.rebuild();
    }
  }
};


// ============================================================
// TerrainPainter — Facade combining all subsystems
// ============================================================

function TerrainPainter(scene, options) {
  this.scene = scene;
  this.options = options || {};
  this.generator = new TerrainGenerator(scene, options);
  this.physics = new TerrainPhysics(this.generator);
  this.sculpt = new TerrainSculpt(this.generator, this.physics);
}

TerrainPainter.prototype.generate = function(options) {
  if (options) {
    if (options.width !== undefined) this.generator.width = options.width;
    if (options.depth !== undefined) this.generator.depth = options.depth;
    if (options.heightScale !== undefined) this.generator.heightScale = options.heightScale;
    if (options.segments !== undefined) {
      this.generator.segments = options.segments;
      this.generator._segX = options.segments + 1;
      this.generator._segZ = options.segments + 1;
    }
  }
  return this.generator.generate();
};

TerrainPainter.prototype.getHeightAt = function(x, z) {
  return this.generator.getHeightAt(x, z);
};

TerrainPainter.prototype.applyBrush = function(worldX, worldZ, type, size, strength, falloff) {
  this.sculpt.applyBrush(worldX, worldZ, type, size, strength, falloff);
};

TerrainPainter.prototype.setTargetHeight = function(h) {
  this.sculpt.setTargetHeight(h);
};

TerrainPainter.prototype.setupPhysics = function(world) {
  this.physics.setup(world || window.__vibexe_world__);
};

TerrainPainter.prototype.getMesh = function() {
  return this.generator.getMesh();
};

TerrainPainter.prototype.getHeightData = function() {
  return this.generator.getHeightData();
};

TerrainPainter.prototype.destroy = function() {
  this.physics.destroy();
  this.generator.destroy();
};


// ============================================================
// Auto-detect player mesh (for old saved projects that don't register it)
// ============================================================

if (typeof window !== 'undefined' && !window.__vibexe_playerMesh__) {
  // X3 fix: Reset retry counter on reload to prevent stale state
  window.__vibexe_playerDetectRetry = 0;
  // Poll for scene availability, then find the animated character mesh
  var _detectPlayer = function() {
    if (window.__vibexe_playerMesh__) return; // Already set by newer template
    var scene = window.__vibexe_scene__;
    if (!scene) { setTimeout(_detectPlayer, 500); return; }
    // Find the player mesh: animated character with a physicsBody (mass > 0)
    var found = null;
    scene.traverse(function(obj) {
      if (found) return;
      if (obj.userData && obj.userData.__physicsBody && obj.userData.__physicsBody.mass > 0) {
        // Check if this looks like a character (has animation mixer or specific name)
        if (obj.userData.__physicsBody.fixedRotation) {
          found = obj;
        }
      }
    });
    if (found) {
      window.__vibexe_playerMesh__ = found;
      console.log("[TerrainPainter] Auto-detected player mesh:", found.name || "unnamed");
    } else {
      // T-L4 fix: always increment counter (was re-initializing to 0 on each call due to falsy check)
      window.__vibexe_playerDetectRetry++;
      if (window.__vibexe_playerDetectRetry < 20) setTimeout(_detectPlayer, 1000);
    }
  };
  setTimeout(_detectPlayer, 2000); // Start detecting after initial load
}

// ============================================================
// Register module and exports
// ============================================================

if (typeof window !== 'undefined') {
  window.__vibexe_modules__ = window.__vibexe_modules__ || {};
  window.__vibexe_modules__["terrain-painter"] = {
    TerrainPainter: TerrainPainter,
    TerrainGenerator: TerrainGenerator,
    TerrainPhysics: TerrainPhysics,
    TerrainSculpt: TerrainSculpt,
    SimplexNoise: SimplexNoise
  };
}

module.exports = { TerrainPainter: TerrainPainter, TerrainGenerator: TerrainGenerator, TerrainPhysics: TerrainPhysics, TerrainSculpt: TerrainSculpt, SimplexNoise: SimplexNoise };
`,
	bridgeHandlers: {
		"terrain-painter-repaint": "handleRepaint",
		"terrain-painter-add-layer": "handleAddLayer",
		"terrain-painter-remove-layer": "handleRemoveLayer",
		"terrain-painter-add-modifier": "handleAddModifier",
		"terrain-painter-remove-modifier": "handleRemoveModifier",
		"terrain-painter-update-modifier": "handleUpdateModifier",
		"terrain-painter-update-layer": "handleUpdateLayer",
		"terrain-painter-set-resolution": "handleSetResolution",
		"terrain-painter-generate-terrain": "handleGenerateTerrain",
		"terrain-painter-load-heightmap": "handleLoadHeightmap",
	},
	defaultSettings: {
		splatmapResolution: 256,
		terrain: {
			width: 100,
			depth: 100,
			heightScale: 30,
			segments: 128,
		},
		layers: [],
	},
};

// Re-export runtime classes for direct import
export { TerrainPainter } from "./runtime/terrain-painter";
export { TerrainMesh } from "./runtime/terrain-mesh";
export { ModifierStack } from "./runtime/modifier-stack";
export { Modifier, BlendMode, FilterPass } from "./runtime/modifier";
export { LayerSettings } from "./runtime/layer-settings";
export {
	HeightModifier,
	SlopeModifier,
	CurvatureModifier,
	CurvatureSolver,
	NoiseModifier,
	NoiseType,
	DirectionModifier,
	TextureMaskModifier,
} from "./runtime/modifiers";
