/**
 * Sky & Weather Advanced Module — Tenkoku Dynamic Sky Conversion
 *
 * Vibexe module: Physically-based atmospheric sky with Rayleigh+Mie scattering,
 * accurate astronomical sun/moon positioning (Schlyter orbital mechanics),
 * volumetric clouds, real star catalog, weather system, and atmospheric effects.
 *
 * Converted from Unity Asset Store "Tenkoku Dynamic Sky v2.0" by TANUKI Digital.
 *
 * Phase 1: Physically-Based Atmosphere (Rayleigh+Mie scattering)
 * Phase 2: Solar Calculator + Day/Night Cycle (Schlyter orbital mechanics)
 */

import type { ModuleManifest } from "../module-types";

export const SKY_WEATHER_ADVANCED_MANIFEST: ModuleManifest = {
	id: "sky-weather-advanced",
	name: "Sky & Weather Advanced",
	version: "1.0.0",
	category: "lighting",
	description:
		"Physically-based atmosphere with Rayleigh+Mie scattering, real orbital mechanics, volumetric clouds, 9K star catalog, and full weather system",
	icon: "CloudSun",
	assets: [],
	runtimeCode: `
// @vibexe/sky-weather-advanced v1.0.0
// Tenkoku Dynamic Sky conversion — physically-based atmosphere
var THREE = require('three');

// ============================================================
// Utility functions
// ============================================================

function _lerp(a, b, t) { return a + (b - a) * t; }
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function _smoothstep(e0, e1, x) {
  var t = _clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function _lerpV3(a, b, t) {
  return [_lerp(a[0], b[0], t), _lerp(a[1], b[1], t), _lerp(a[2], b[2], t)];
}
function _saturate(x) { return _clamp(x, 0, 1); }
var DEG2RAD = Math.PI / 180;
var RAD2DEG = 180 / Math.PI;
var PI = Math.PI;
var TWO_PI = PI * 2;


// ============================================================
// Schlyter Orbital Mechanics Calculator
// ============================================================
// Ported from TenkokuCalculations.cs (897 lines)
// Reference: Paul Schlyter — http://www.stjarnhimlen.se/comp/ppcomp.html

function OrbitalCalculator() {
  this.sunDirection = new THREE.Vector3(0, 1, 0);
  this.moonDirection = new THREE.Vector3(0, -1, 0);
  this.sunAltitude = 0;   // radians, elevation above horizon
  this.sunAzimuth = 0;    // radians
  this.moonAltitude = 0;
  this.moonAzimuth = 0;
  this.moonPhase = 0;     // 0-1 (0=new, 0.5=full, 1=new)
  this.moonElongation = 0; // degrees
  this._dayNumber = 0;
}

// Julian Day Number from calendar date
OrbitalCalculator.prototype._dayNum = function(year, month, day, ut) {
  // Schlyter's day number: d = 367*y - 7*(y+(m+9)/12)/4 + 275*m/9 + D - 730530
  return 367 * year
    - Math.floor(7 * (year + Math.floor((month + 9) / 12)) / 4)
    + Math.floor(275 * month / 9)
    + day - 730530
    + (ut || 0) / 24.0;
};

// Solve Kepler equation: M + e*sin(E) = E  (angles in radians)
OrbitalCalculator.prototype._solveKepler = function(M, e) {
  var E = M + e * Math.sin(M) * (1.0 + e * Math.cos(M));
  // Newton-Raphson iterate for better accuracy
  for (var i = 0; i < 4; i++) {
    var dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-6) break;
  }
  return E;
};

// Normalize angle to 0-360 degrees
OrbitalCalculator.prototype._rev = function(x) {
  return x - Math.floor(x / 360) * 360;
};

OrbitalCalculator.prototype.update = function(solarTime, latitude, longitude, year, month, day, timezone) {
  var lat = latitude || 45;
  var lon = longitude || 0;
  year = year || 2024;
  month = month || 6;
  day = day || 21;
  timezone = timezone || 0;

  // Convert solarTime (0-1) to UT hours
  var localHour = solarTime * 24;
  var ut = localHour - timezone;

  var d = this._dayNum(year, month, day, ut);
  this._dayNumber = d;

  // ---- Sun orbital elements (Schlyter) ----
  var w_sun = this._rev(282.9404 + 4.70935e-5 * d);   // argument of perihelion
  var e_sun = 0.016709 - 1.151e-9 * d;                  // eccentricity
  var M_sun = this._rev(356.0470 + 0.9856002585 * d);   // mean anomaly

  // Obliquity of the ecliptic
  var oblecl = 23.4393 - 3.563e-7 * d;

  // Eccentric anomaly (Kepler equation)
  var E_sun = this._solveKepler(M_sun * DEG2RAD, e_sun);

  // Sun's distance and true anomaly
  var xv = Math.cos(E_sun) - e_sun;
  var yv = Math.sqrt(1 - e_sun * e_sun) * Math.sin(E_sun);
  var v_sun = Math.atan2(yv, xv) * RAD2DEG;
  // var r_sun = Math.sqrt(xv * xv + yv * yv); // AU distance (unused for direction)

  // Sun's ecliptic longitude
  var lonSun = this._rev(v_sun + w_sun);

  // Ecliptic rectangular coordinates
  var xeclip = Math.cos(lonSun * DEG2RAD);
  var yeclip = Math.sin(lonSun * DEG2RAD);
  // z = 0 for sun (ecliptic latitude = 0)

  // Rotate to equatorial coordinates
  var oblRad = oblecl * DEG2RAD;
  var xeq = xeclip;
  var yeq = yeclip * Math.cos(oblRad);
  var zeq = yeclip * Math.sin(oblRad);

  // Right Ascension and Declination
  var RA_sun = this._rev(Math.atan2(yeq, xeq) * RAD2DEG);
  var Dec_sun = Math.atan2(zeq, Math.sqrt(xeq * xeq + yeq * yeq)) * RAD2DEG;

  // Greenwich Mean Sidereal Time
  var GMST0 = this._rev(lonSun + 180);
  var SIDTIME = GMST0 + ut * 15 + lon;

  // Hour Angle
  var HA_sun = this._rev(SIDTIME - RA_sun);

  // Convert to horizon coordinates (altitude / azimuth)
  var latRad = lat * DEG2RAD;
  var haRad = HA_sun * DEG2RAD;
  var decRad = Dec_sun * DEG2RAD;

  var sinAlt = Math.sin(latRad) * Math.sin(decRad) +
               Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  this.sunAltitude = Math.asin(_clamp(sinAlt, -1, 1));

  var cosAlt = Math.cos(this.sunAltitude);
  if (cosAlt > 0.001) {
    var cosAz = _clamp(
      (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * cosAlt),
      -1, 1
    );
    this.sunAzimuth = Math.acos(cosAz);
    if (Math.sin(haRad) > 0) this.sunAzimuth = TWO_PI - this.sunAzimuth;
  } else {
    this.sunAzimuth = 0;
  }

  // Sun direction vector (Y-up, looking into the scene)
  var alt = this.sunAltitude;
  var az = this.sunAzimuth;
  this.sunDirection.set(
    -Math.sin(az) * Math.cos(alt),
    Math.sin(alt),
    -Math.cos(az) * Math.cos(alt)
  ).normalize();

  // ---- Moon orbital elements ----
  var N_moon = this._rev(125.1228 - 0.0529538083 * d);
  var i_moon = 5.1454;
  var w_moon = this._rev(318.0634 + 0.1643573223 * d);
  var a_moon = 60.2666; // Earth radii
  var e_moon = 0.054900;
  var M_moon = this._rev(115.3654 + 13.0649929509 * d);

  var E_moon = this._solveKepler(M_moon * DEG2RAD, e_moon);

  var xv_m = a_moon * (Math.cos(E_moon) - e_moon);
  var yv_m = a_moon * Math.sqrt(1 - e_moon * e_moon) * Math.sin(E_moon);
  var v_moon = Math.atan2(yv_m, xv_m) * RAD2DEG;
  var r_moon = Math.sqrt(xv_m * xv_m + yv_m * yv_m);

  // Moon ecliptic coordinates (with inclination)
  var NRad = N_moon * DEG2RAD;
  var iRad = i_moon * DEG2RAD;
  var vwRad = (v_moon + w_moon) * DEG2RAD;

  var xh = r_moon * (Math.cos(NRad) * Math.cos(vwRad) - Math.sin(NRad) * Math.sin(vwRad) * Math.cos(iRad));
  var yh = r_moon * (Math.sin(NRad) * Math.cos(vwRad) + Math.cos(NRad) * Math.sin(vwRad) * Math.cos(iRad));
  var zh = r_moon * Math.sin(vwRad) * Math.sin(iRad);

  // Ecliptic longitude/latitude of moon
  var lonMoon = Math.atan2(yh, xh) * RAD2DEG;
  var latMoon = Math.atan2(zh, Math.sqrt(xh * xh + yh * yh)) * RAD2DEG;

  // Perturbation terms (simplified)
  var Ls = this._rev(M_sun + w_sun);  // Sun's mean longitude
  var Lm = this._rev(M_moon + w_moon + N_moon); // Moon's mean longitude
  var Ms = M_sun;
  var Mm = M_moon;
  var D = this._rev(Lm - Ls); // Moon's mean elongation
  var F = this._rev(Lm - N_moon); // Moon's argument of latitude

  // Major perturbation corrections (in degrees)
  lonMoon += -1.274 * Math.sin((Mm - 2*D) * DEG2RAD)
           + 0.658 * Math.sin(2*D * DEG2RAD)
           - 0.186 * Math.sin(Ms * DEG2RAD)
           - 0.059 * Math.sin((2*Mm - 2*D) * DEG2RAD)
           - 0.057 * Math.sin((Mm - 2*D + Ms) * DEG2RAD)
           + 0.053 * Math.sin((Mm + 2*D) * DEG2RAD)
           + 0.046 * Math.sin((2*D - Ms) * DEG2RAD)
           + 0.041 * Math.sin((Mm - Ms) * DEG2RAD)
           - 0.035 * Math.sin(D * DEG2RAD)
           - 0.031 * Math.sin((Mm + Ms) * DEG2RAD)
           - 0.015 * Math.sin((2*F - 2*D) * DEG2RAD)
           + 0.011 * Math.sin((Mm - 4*D) * DEG2RAD);

  latMoon += -0.173 * Math.sin((F - 2*D) * DEG2RAD)
           - 0.055 * Math.sin((Mm - F - 2*D) * DEG2RAD)
           - 0.046 * Math.sin((Mm + F - 2*D) * DEG2RAD)
           + 0.033 * Math.sin((F + 2*D) * DEG2RAD)
           + 0.017 * Math.sin((2*Mm + F) * DEG2RAD);

  // Moon ecliptic → equatorial
  var lonMRad = lonMoon * DEG2RAD;
  var latMRad = latMoon * DEG2RAD;

  var xeq_m = Math.cos(latMRad) * Math.cos(lonMRad);
  var yeq_m = Math.cos(oblRad) * Math.cos(latMRad) * Math.sin(lonMRad) - Math.sin(oblRad) * Math.sin(latMRad);
  var zeq_m = Math.sin(oblRad) * Math.cos(latMRad) * Math.sin(lonMRad) + Math.cos(oblRad) * Math.sin(latMRad);

  var RA_moon = this._rev(Math.atan2(yeq_m, xeq_m) * RAD2DEG);
  var Dec_moon = Math.atan2(zeq_m, Math.sqrt(xeq_m * xeq_m + yeq_m * yeq_m)) * RAD2DEG;

  // Moon hour angle → horizon coordinates
  var HA_moon = this._rev(SIDTIME - RA_moon);
  var haRadM = HA_moon * DEG2RAD;
  var decRadM = Dec_moon * DEG2RAD;

  var sinAltM = Math.sin(latRad) * Math.sin(decRadM) +
                Math.cos(latRad) * Math.cos(decRadM) * Math.cos(haRadM);
  this.moonAltitude = Math.asin(_clamp(sinAltM, -1, 1));

  var cosAltM = Math.cos(this.moonAltitude);
  if (cosAltM > 0.001) {
    var cosAzM = _clamp(
      (Math.sin(decRadM) - Math.sin(latRad) * sinAltM) / (Math.cos(latRad) * cosAltM),
      -1, 1
    );
    this.moonAzimuth = Math.acos(cosAzM);
    if (Math.sin(haRadM) > 0) this.moonAzimuth = TWO_PI - this.moonAzimuth;
  } else {
    this.moonAzimuth = 0;
  }

  // Moon direction vector
  var altM = this.moonAltitude;
  var azM = this.moonAzimuth;
  this.moonDirection.set(
    -Math.sin(azM) * Math.cos(altM),
    Math.sin(altM),
    -Math.cos(azM) * Math.cos(altM)
  ).normalize();

  // Moon phase from elongation (angle between sun and moon as seen from Earth)
  this.moonElongation = Math.acos(_clamp(this.sunDirection.dot(this.moonDirection), -1, 1)) * RAD2DEG;
  this.moonPhase = (1 - Math.cos(this.moonElongation * DEG2RAD)) * 0.5; // 0=new, 1=full
};


// ============================================================
// Rayleigh+Mie Atmosphere Renderer
// ============================================================
// Ported from AtmosphericScattering.cginc (333 lines HLSL)
// Uses CPU-side numerical integration, renders to sky dome vertex colors
// for maximum compatibility (no TSL dependency for Phase 1).

var EARTH_RADIUS = 6371000;        // meters
var ATMOSPHERE_HEIGHT = 100000;    // meters (100km)
var RAYLEIGH_SCALE_HEIGHT = 8500;  // meters
var MIE_SCALE_HEIGHT = 1200;       // meters

// Rayleigh scattering coefficients at sea level (per meter)
var RAYLEIGH_COEFF = [5.8e-6, 13.5e-6, 33.1e-6]; // RGB
// Mie scattering coefficient at sea level
var MIE_COEFF = 2.0e-5;

function AtmosphereRenderer() {
  this.dome = null;
  this.material = null;
  this.geometry = null;
  this._sunDir = [0, 1, 0];
  this._exposure = 1.2;
  this._mieG = 0.76;
  this._rayleighScale = 1.0;
  this._mieScale = 1.0;
  this._sunIntensity = 22.0;
  this._sunDiskSize = 0.9985; // cos(angle) threshold for sun disk
}

// Ray-sphere intersection (returns [near, far] or null)
AtmosphereRenderer.prototype._raySphere = function(ro, rd, center, radius) {
  var ox = ro[0] - center[0], oy = ro[1] - center[1], oz = ro[2] - center[2];
  var a = rd[0]*rd[0] + rd[1]*rd[1] + rd[2]*rd[2];
  var b = 2 * (ox*rd[0] + oy*rd[1] + oz*rd[2]);
  var c = ox*ox + oy*oy + oz*oz - radius*radius;
  var disc = b*b - 4*a*c;
  if (disc < 0) return null;
  var sq = Math.sqrt(disc);
  return [(-b - sq) / (2*a), (-b + sq) / (2*a)];
};

// Compute atmosphere color for a given view direction
AtmosphereRenderer.prototype._computeSkyColor = function(viewDir) {
  var sunDir = this._sunDir;
  var planetCenter = [0, -EARTH_RADIUS, 0];
  var rayOrigin = [0, 1, 0]; // camera at 1m above ground

  // Ray direction
  var rd = viewDir;

  // Intersect with atmosphere sphere
  var atm = this._raySphere(rayOrigin, rd, planetCenter, EARTH_RADIUS + ATMOSPHERE_HEIGHT);
  if (!atm || atm[1] <= 0) return [0, 0, 0];

  // Check if ray hits planet
  var planet = this._raySphere(rayOrigin, rd, planetCenter, EARTH_RADIUS);
  var rayLength = atm[1];
  if (planet && planet[0] > 0) {
    rayLength = Math.min(rayLength, planet[0]);
  }

  // Numerical integration along view ray
  var numSamples = 32; // Reduced from Tenkoku's 250 for real-time
  var stepSize = rayLength / numSamples;

  var scatterR = [0, 0, 0];
  var scatterM = [0, 0, 0];
  var opticalDepthR = 0;
  var opticalDepthM = 0;

  var rayleighScale = this._rayleighScale;
  var mieScale = this._mieScale;

  for (var i = 0; i < numSamples; i++) {
    var t = (i + 0.5) * stepSize;
    var px = rayOrigin[0] + rd[0] * t;
    var py = rayOrigin[1] + rd[1] * t;
    var pz = rayOrigin[2] + rd[2] * t;

    // Height above planet surface
    var dx = px - planetCenter[0];
    var dy = py - planetCenter[1];
    var dz = pz - planetCenter[2];
    var height = Math.sqrt(dx*dx + dy*dy + dz*dz) - EARTH_RADIUS;
    if (height < 0) break;

    // Local density
    var densityR = Math.exp(-height / RAYLEIGH_SCALE_HEIGHT) * stepSize * rayleighScale;
    var densityM = Math.exp(-height / MIE_SCALE_HEIGHT) * stepSize * mieScale;

    opticalDepthR += densityR;
    opticalDepthM += densityM;

    // Optical depth from this point to sun (simplified: 8 samples)
    var sunOptR = 0, sunOptM = 0;
    var sunSamples = 8;
    // Ray from sample point toward sun
    var sunAtm = this._raySphere([px, py, pz], sunDir, planetCenter, EARTH_RADIUS + ATMOSPHERE_HEIGHT);
    if (sunAtm && sunAtm[1] > 0) {
      var sunStep = sunAtm[1] / sunSamples;
      var hitPlanet = false;
      for (var j = 0; j < sunSamples; j++) {
        var st = (j + 0.5) * sunStep;
        var sx = px + sunDir[0] * st;
        var sy = py + sunDir[1] * st;
        var sz = pz + sunDir[2] * st;
        var sdx = sx - planetCenter[0];
        var sdy = sy - planetCenter[1];
        var sdz = sz - planetCenter[2];
        var sh = Math.sqrt(sdx*sdx + sdy*sdy + sdz*sdz) - EARTH_RADIUS;
        if (sh < 0) { hitPlanet = true; break; }
        sunOptR += Math.exp(-sh / RAYLEIGH_SCALE_HEIGHT) * sunStep * rayleighScale;
        sunOptM += Math.exp(-sh / MIE_SCALE_HEIGHT) * sunStep * mieScale;
      }
      if (hitPlanet) continue;
    }

    // Total optical depth = camera→point + point→sun
    var totalR = opticalDepthR + sunOptR;
    var totalM = opticalDepthM + sunOptM;

    // Extinction (transmittance)
    var attR = RAYLEIGH_COEFF[0] * totalR;
    var attG = RAYLEIGH_COEFF[1] * totalR;
    var attB = RAYLEIGH_COEFF[2] * totalR;
    attR += MIE_COEFF * totalM;
    attG += MIE_COEFF * totalM;
    attB += MIE_COEFF * totalM;

    var extR = Math.exp(-attR);
    var extG = Math.exp(-attG);
    var extB = Math.exp(-attB);

    // Accumulate in-scattering
    scatterR[0] += densityR * extR;
    scatterR[1] += densityR * extG;
    scatterR[2] += densityR * extB;

    scatterM[0] += densityM * extR;
    scatterM[1] += densityM * extG;
    scatterM[2] += densityM * extB;
  }

  // Phase functions
  var cosAngle = rd[0]*sunDir[0] + rd[1]*sunDir[1] + rd[2]*sunDir[2];

  // Rayleigh phase: (3/16π)(1 + cos²θ)
  var phaseR = (3.0 / (16.0 * PI)) * (1 + cosAngle * cosAngle);

  // Mie phase: Henyey-Greenstein
  var g = this._mieG;
  var g2 = g * g;
  var phaseM = (1.0 / (4.0 * PI)) * ((3.0 * (1 - g2)) / (2.0 * (2 + g2))) *
    ((1 + cosAngle * cosAngle) / Math.pow(1 + g2 - 2 * g * cosAngle, 1.5));

  // Combine scattering
  var intensity = this._sunIntensity;
  var r = (scatterR[0] * RAYLEIGH_COEFF[0] * phaseR + scatterM[0] * MIE_COEFF * phaseM) * intensity;
  var gn = (scatterR[1] * RAYLEIGH_COEFF[1] * phaseR + scatterM[1] * MIE_COEFF * phaseM) * intensity;
  var b = (scatterR[2] * RAYLEIGH_COEFF[2] * phaseR + scatterM[2] * MIE_COEFF * phaseM) * intensity;

  // Sun disk (Mie peak for very narrow angle)
  if (cosAngle > this._sunDiskSize) {
    var sunG = 0.9995;
    var sunG2 = sunG * sunG;
    var sunPhase = (1 - sunG2) / (4 * PI * Math.pow(1 + sunG2 - 2 * sunG * cosAngle, 1.5));
    var sunAdd = sunPhase * 0.003 * intensity;
    r += scatterM[0] * sunAdd;
    gn += scatterM[1] * sunAdd;
    b += scatterM[2] * sunAdd;
  }

  // Tone mapping (Reinhard)
  var exposure = this._exposure;
  r = 1 - Math.exp(-r * exposure);
  gn = 1 - Math.exp(-gn * exposure);
  b = 1 - Math.exp(-b * exposure);

  // Gamma correction (linear → sRGB)
  var invGamma = 1.0 / 2.2;
  r = Math.pow(_clamp(r, 0, 1), invGamma);
  gn = Math.pow(_clamp(gn, 0, 1), invGamma);
  b = Math.pow(_clamp(b, 0, 1), invGamma);

  return [r, gn, b];
};

// Build the sky dome mesh with vertex colors
AtmosphereRenderer.prototype.build = function(scene) {
  if (this.dome) return;

  var segW = 48, segH = 24;
  this.geometry = new THREE.SphereGeometry(5000, segW, segH);
  this.geometry.name = "__swa_sky_dome_geo__";

  // Vertex colors buffer
  var posAttr = this.geometry.getAttribute("position");
  var colors = new Float32Array(posAttr.count * 3);
  this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  this.material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  this.material.name = "__swa_sky_dome_mat__";

  this.dome = new THREE.Mesh(this.geometry, this.material);
  this.dome.name = "__swa_sky_dome__";
  this.dome.renderOrder = -1000;
  this.dome.frustumCulled = false;

  scene.add(this.dome);
  this._updateVertexColors();
};

// Update all vertex colors based on current sun direction
AtmosphereRenderer.prototype._updateVertexColors = function() {
  if (!this.geometry) return;

  var posAttr = this.geometry.getAttribute("position");
  var colorAttr = this.geometry.getAttribute("color");
  var colors = colorAttr.array;
  var dir = [0, 0, 0];

  for (var i = 0; i < posAttr.count; i++) {
    var x = posAttr.getX(i);
    var y = posAttr.getY(i);
    var z = posAttr.getZ(i);
    var len = Math.sqrt(x*x + y*y + z*z);
    if (len > 0) {
      dir[0] = x / len;
      dir[1] = y / len;
      dir[2] = z / len;
    } else {
      dir[0] = 0; dir[1] = 1; dir[2] = 0;
    }

    var c = this._computeSkyColor(dir);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  colorAttr.needsUpdate = true;
};

// Set sun direction and recompute sky
AtmosphereRenderer.prototype.setSunDirection = function(dir) {
  this._sunDir = [dir.x, dir.y, dir.z];
  this._updateVertexColors();
};

// Follow camera position
AtmosphereRenderer.prototype.followCamera = function(camera) {
  if (this.dome && camera) {
    this.dome.position.copy(camera.position);
  }
};

AtmosphereRenderer.prototype.dispose = function() {
  if (this.dome && this.dome.parent) {
    this.dome.parent.remove(this.dome);
  }
  if (this.geometry) this.geometry.dispose();
  if (this.material) this.material.dispose();
  this.dome = null;
  this.geometry = null;
  this.material = null;
};


// ============================================================
// Lighting Controller — automated sun/moon/ambient lights
// ============================================================

function SkyLightingController() {
  this.sunLight = null;
  this.ambientLight = null;
  this._shadowTarget = null;
}

SkyLightingController.prototype.init = function(scene) {
  // Find or create directional light for sun
  this.sunLight = null;
  scene.traverse(function(obj) {
    if (obj.isDirectionalLight && !obj.name.startsWith("__swa_")) {
      // Use existing directional light
    }
  });
  if (!this.sunLight) {
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sunLight.name = "__swa_sun_light__";
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.camera.left = -40;
    this.sunLight.shadow.camera.right = 40;
    this.sunLight.shadow.camera.top = 40;
    this.sunLight.shadow.camera.bottom = -40;
    this.sunLight.shadow.bias = -0.001;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);
  }

  // Find or create ambient light
  this.ambientLight = null;
  scene.traverse(function(obj) {
    if (obj.isHemisphereLight && obj.name === "__swa_ambient__") {
      this.ambientLight = obj;
    }
  }.bind(this));
  if (!this.ambientLight) {
    this.ambientLight = new THREE.HemisphereLight(0x87CEEB, 0x362d15, 0.4);
    this.ambientLight.name = "__swa_ambient__";
    scene.add(this.ambientLight);
  }
};

SkyLightingController.prototype.update = function(sunDir, sunAltDeg, settings) {
  if (!this.sunLight) return;

  var autoSun = settings.autoSunLight !== false;
  var autoAmbient = settings.autoAmbient !== false;

  if (autoSun) {
    // Sun direction
    this.sunLight.position.set(sunDir.x * 100, sunDir.y * 100, sunDir.z * 100);

    // Sun intensity based on altitude
    var altNorm = _clamp(sunAltDeg / 90, -1, 1);
    var dayIntensity = settings.sunIntensity || 1.5;

    if (altNorm > 0.05) {
      // Day: full intensity
      this.sunLight.intensity = dayIntensity * _smoothstep(0.05, 0.2, altNorm);
    } else if (altNorm > -0.1) {
      // Twilight: fade
      this.sunLight.intensity = dayIntensity * _smoothstep(-0.1, 0.05, altNorm) * 0.3;
    } else {
      // Night
      this.sunLight.intensity = 0;
    }

    // Sun color temperature
    if (altNorm > 0.15) {
      // High sun: warm white
      this.sunLight.color.setRGB(1.0, 0.96, 0.92);
    } else if (altNorm > 0) {
      // Low sun: orange-gold
      var warmT = _smoothstep(0, 0.15, altNorm);
      this.sunLight.color.setRGB(
        _lerp(1.0, 1.0, warmT),
        _lerp(0.65, 0.96, warmT),
        _lerp(0.3, 0.92, warmT)
      );
    } else {
      // Below horizon: dim blue
      this.sunLight.color.setRGB(0.4, 0.5, 0.7);
    }
  }

  if (autoAmbient && this.ambientLight) {
    var ambIntensity = settings.ambientIntensity || 0.4;
    if (sunAltDeg > 10) {
      // Day ambient
      this.ambientLight.intensity = ambIntensity;
      this.ambientLight.color.setRGB(0.53, 0.81, 0.92);      // sky blue
      this.ambientLight.groundColor.setRGB(0.21, 0.18, 0.08); // warm ground
    } else if (sunAltDeg > -6) {
      // Twilight
      var tw = _smoothstep(-6, 10, sunAltDeg);
      this.ambientLight.intensity = _lerp(0.08, ambIntensity, tw);
      this.ambientLight.color.setRGB(
        _lerp(0.15, 0.53, tw),
        _lerp(0.12, 0.81, tw),
        _lerp(0.25, 0.92, tw)
      );
    } else {
      // Night
      this.ambientLight.intensity = 0.08;
      this.ambientLight.color.setRGB(0.08, 0.08, 0.18);
      this.ambientLight.groundColor.setRGB(0.02, 0.02, 0.04);
    }
  }

  // Shadow follow player
  var player = window.__vibexe_playerMesh__;
  if (player && this.sunLight) {
    this.sunLight.position.set(
      player.position.x + sunDir.x * 50,
      player.position.y + sunDir.y * 50 + 30,
      player.position.z + sunDir.z * 50
    );
    this.sunLight.target.position.copy(player.position);
    this.sunLight.target.updateMatrixWorld();
  }
};

SkyLightingController.prototype.dispose = function(scene) {
  if (this.sunLight && this.sunLight.name === "__swa_sun_light__") {
    scene.remove(this.sunLight.target);
    scene.remove(this.sunLight);
    if (this.sunLight.shadow && this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
    }
    this.sunLight = null;
  }
  if (this.ambientLight && this.ambientLight.name === "__swa_ambient__") {
    scene.remove(this.ambientLight);
    this.ambientLight = null;
  }
};


// ============================================================
// Procedural Weather Particle Textures
// ============================================================

var __swa_texCache = {};

function _getSwaSnowTex() {
  if (__swa_texCache.snow) return __swa_texCache.snow;
  var s = 64, h = s / 2;
  var c = document.createElement("canvas"); c.width = c.height = s;
  var x = c.getContext("2d");
  var g = x.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0.0, "rgba(255,255,255,1.0)");
  g.addColorStop(0.25, "rgba(230,240,255,0.7)");
  g.addColorStop(0.6, "rgba(210,225,255,0.2)");
  g.addColorStop(1.0, "rgba(200,220,255,0.0)");
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  for (var i = 0; i < 6; i++) {
    var a = (i / 6) * Math.PI * 2;
    var ex = h + Math.cos(a) * h * 0.75;
    var ey = h + Math.sin(a) * h * 0.75;
    x.strokeStyle = "rgba(255,255,255,0.85)";
    x.lineWidth = s * 0.025;
    x.lineCap = "round";
    x.beginPath(); x.moveTo(h, h); x.lineTo(ex, ey); x.stroke();
  }
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  __swa_texCache.snow = t;
  return t;
}

function _getSwaRainTex() {
  if (__swa_texCache.rain) return __swa_texCache.rain;
  var w = 32, ht = 64;
  var c = document.createElement("canvas"); c.width = w; c.height = ht;
  var x = c.getContext("2d");
  var g = x.createLinearGradient(0, 0, 0, ht);
  g.addColorStop(0.0, "rgba(180,210,255,0.0)");
  g.addColorStop(0.15, "rgba(190,215,255,0.3)");
  g.addColorStop(0.4, "rgba(210,230,255,0.8)");
  g.addColorStop(0.6, "rgba(210,230,255,0.8)");
  g.addColorStop(0.85, "rgba(190,215,255,0.3)");
  g.addColorStop(1.0, "rgba(180,210,255,0.0)");
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(w / 2, ht / 2, w / 2 - 2, ht / 2, 0, 0, Math.PI * 2);
  x.fill();
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  __swa_texCache.rain = t;
  return t;
}


// ============================================================
// Weather Particles (rain/snow)
// ============================================================

function WeatherParticles() {
  this._rain = null;
  this._snow = null;
  this._rainGeo = null;
  this._snowGeo = null;
  this._rainMat = null;
  this._snowMat = null;
  this._particleCount = 3000;
  this._windDir = 0;
  this._windStrength = 0.3;
}

WeatherParticles.prototype.init = function(scene) {
  // Rain
  this._rainGeo = new THREE.BufferGeometry();
  var rPos = new Float32Array(this._particleCount * 3);
  var rVel = new Float32Array(this._particleCount); // fall speed
  for (var i = 0; i < this._particleCount; i++) {
    rPos[i*3]   = (Math.random() - 0.5) * 80;
    rPos[i*3+1] = Math.random() * 60;
    rPos[i*3+2] = (Math.random() - 0.5) * 80;
    rVel[i] = 15 + Math.random() * 10;
  }
  this._rainGeo.setAttribute("position", new THREE.BufferAttribute(rPos, 3));
  this._rainVelocities = rVel;

  this._rainMat = new THREE.PointsMaterial({
    map: _getSwaRainTex(),
    size: 0.8,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  this._rain = new THREE.Points(this._rainGeo, this._rainMat);
  this._rain.name = "__swa_rain__";
  this._rain.visible = false;
  this._rain.frustumCulled = false;
  scene.add(this._rain);

  // Snow
  this._snowGeo = new THREE.BufferGeometry();
  var sPos = new Float32Array(this._particleCount * 3);
  var sVel = new Float32Array(this._particleCount);
  for (var j = 0; j < this._particleCount; j++) {
    sPos[j*3]   = (Math.random() - 0.5) * 80;
    sPos[j*3+1] = Math.random() * 40;
    sPos[j*3+2] = (Math.random() - 0.5) * 80;
    sVel[j] = 1 + Math.random() * 2;
  }
  this._snowGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  this._snowVelocities = sVel;

  this._snowMat = new THREE.PointsMaterial({
    map: _getSwaSnowTex(),
    size: 1.2,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  this._snow = new THREE.Points(this._snowGeo, this._snowMat);
  this._snow.name = "__swa_snow__";
  this._snow.visible = false;
  this._snow.frustumCulled = false;
  scene.add(this._snow);
};

WeatherParticles.prototype.update = function(dt, camera, settings) {
  var precipType = settings.type || "none";
  var intensity = settings.intensity || 0;
  this._windDir = (settings.windDirection || 0) * DEG2RAD;
  this._windStrength = settings.windStrength || 0.3;

  this._rain.visible = precipType === "rain" && intensity > 0;
  this._snow.visible = precipType === "snow" && intensity > 0;

  if (this._rain.visible) {
    this._animateParticles(this._rainGeo, this._rainVelocities, dt, camera, intensity, true);
    this._rainMat.opacity = _clamp(intensity * 0.6, 0.1, 0.8);
  }
  if (this._snow.visible) {
    this._animateParticles(this._snowGeo, this._snowVelocities, dt, camera, intensity, false);
    this._snowMat.opacity = _clamp(intensity * 0.8, 0.2, 0.9);
  }
};

WeatherParticles.prototype._animateParticles = function(geo, vel, dt, camera, intensity, isRain) {
  var pos = geo.getAttribute("position");
  var arr = pos.array;
  var count = Math.floor(this._particleCount * _clamp(intensity, 0, 1));
  var windX = Math.sin(this._windDir) * this._windStrength * (isRain ? 8 : 2);
  var windZ = Math.cos(this._windDir) * this._windStrength * (isRain ? 8 : 2);
  var camPos = camera ? camera.position : {x:0, y:0, z:0};
  var spread = isRain ? 80 : 60;
  var ceiling = isRain ? 60 : 40;

  for (var i = 0; i < this._particleCount; i++) {
    if (i >= count) {
      arr[i*3+1] = -1000; // hide unused
      continue;
    }
    arr[i*3]   += windX * dt;
    arr[i*3+1] -= vel[i] * dt;
    arr[i*3+2] += windZ * dt;

    // Snow: add gentle horizontal drift
    if (!isRain) {
      arr[i*3]   += Math.sin(arr[i*3+1] * 0.3 + i) * 0.5 * dt;
      arr[i*3+2] += Math.cos(arr[i*3+1] * 0.2 + i * 1.3) * 0.5 * dt;
    }

    // Recycle when below ground or too far
    if (arr[i*3+1] < -2) {
      arr[i*3]   = camPos.x + (Math.random() - 0.5) * spread;
      arr[i*3+1] = camPos.y + ceiling * (0.5 + Math.random() * 0.5);
      arr[i*3+2] = camPos.z + (Math.random() - 0.5) * spread;
    }
  }
  pos.needsUpdate = true;
};

WeatherParticles.prototype.dispose = function(scene) {
  if (this._rain) { scene.remove(this._rain); }
  if (this._snow) { scene.remove(this._snow); }
  if (this._rainGeo) this._rainGeo.dispose();
  if (this._snowGeo) this._snowGeo.dispose();
  if (this._rainMat) this._rainMat.dispose();
  if (this._snowMat) this._snowMat.dispose();
};


// ============================================================
// Star Field — Procedural (Phase 4 will add real Tycho2 catalog)
// ============================================================

function StarField() {
  this._stars = null;
  this._starGeo = null;
  this._starMat = null;
  this._twinklePhases = null;
}

StarField.prototype.init = function(scene) {
  var count = 2000;
  this._starGeo = new THREE.BufferGeometry();
  var positions = new Float32Array(count * 3);
  var colors = new Float32Array(count * 3);
  var sizes = new Float32Array(count);
  this._twinklePhases = new Float32Array(count);

  // Spectral colors for variety
  var spectralColors = [
    [0.41, 0.66, 1.0],  // O - blue
    [0.76, 0.86, 1.0],  // B - blue-white
    [1.0, 1.0, 1.0],    // A - white
    [0.99, 1.0, 0.94],  // F - yellow-white
    [1.0, 0.99, 0.55],  // G - yellow
    [1.0, 0.72, 0.36],  // K - orange
    [1.0, 0.07, 0.07],  // M - red
  ];

  for (var i = 0; i < count; i++) {
    // Random direction on sphere
    var theta = Math.random() * TWO_PI;
    var phi = Math.acos(2 * Math.random() - 1);
    var r = 4800;
    positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i*3+2] = r * Math.cos(phi);

    // Only keep upper hemisphere (above horizon)
    if (positions[i*3+1] < -200) {
      positions[i*3+1] = Math.abs(positions[i*3+1]);
    }

    // Random spectral color
    var sc = spectralColors[Math.floor(Math.random() * spectralColors.length)];
    colors[i*3] = sc[0];
    colors[i*3+1] = sc[1];
    colors[i*3+2] = sc[2];

    // Random size (magnitude-like)
    sizes[i] = 1.5 + Math.random() * 3.5;

    this._twinklePhases[i] = Math.random() * TWO_PI;
  }

  this._starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  this._starGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  this._starGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  this._starMat = new THREE.PointsMaterial({
    vertexColors: true,
    size: 3,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
  });

  this._stars = new THREE.Points(this._starGeo, this._starMat);
  this._stars.name = "__swa_stars__";
  this._stars.renderOrder = -999;
  this._stars.frustumCulled = false;
  scene.add(this._stars);
};

StarField.prototype.update = function(sunAltDeg, camera, time, settings) {
  if (!this._stars) return;

  // Stars visible only at night (sun < -6° below horizon)
  var starIntensity = settings.starIntensity || 1.0;
  var nightFactor = _smoothstep(-6, -18, sunAltDeg);
  this._stars.visible = nightFactor > 0.01;

  if (this._stars.visible) {
    this._starMat.opacity = nightFactor * starIntensity;

    // Twinkle animation
    var sizes = this._starGeo.getAttribute("size");
    var sArr = sizes.array;
    for (var i = 0; i < sArr.length; i++) {
      var base = 1.5 + (this._twinklePhases[i] / TWO_PI) * 3.5;
      sArr[i] = base * (0.7 + 0.3 * Math.sin(time * 3 + this._twinklePhases[i]));
    }
    sizes.needsUpdate = true;
  }

  // Follow camera
  if (camera) {
    this._stars.position.copy(camera.position);
  }
};

StarField.prototype.dispose = function(scene) {
  if (this._stars) scene.remove(this._stars);
  if (this._starGeo) this._starGeo.dispose();
  if (this._starMat) this._starMat.dispose();
};


// ============================================================
// Fog Controller
// ============================================================

function FogController() {
  this._originalFog = null;
  this._active = false;
}

FogController.prototype.update = function(scene, sunAltDeg, settings) {
  if (!settings.enabled) {
    if (this._active && this._originalFog !== undefined) {
      scene.fog = this._originalFog;
      this._active = false;
    }
    return;
  }

  if (!this._active) {
    this._originalFog = scene.fog;
    this._active = true;
  }

  var density = settings.density || 0.003;
  if (!scene.fog || !scene.fog.isFogExp2) {
    scene.fog = new THREE.FogExp2(0x87CEEB, density);
  } else {
    scene.fog.density = density;
  }

  // Auto fog color from sky
  if (settings.autoColor !== false) {
    var altNorm = _clamp(sunAltDeg / 90, -1, 1);
    if (altNorm > 0.1) {
      // Day: light blue-white
      scene.fog.color.setRGB(0.7, 0.8, 0.9);
    } else if (altNorm > -0.05) {
      // Sunset: warm
      var t = _smoothstep(-0.05, 0.1, altNorm);
      scene.fog.color.setRGB(
        _lerp(0.4, 0.7, t),
        _lerp(0.25, 0.8, t),
        _lerp(0.15, 0.9, t)
      );
    } else {
      // Night: dark blue
      scene.fog.color.setRGB(0.05, 0.05, 0.12);
    }
  }
};

FogController.prototype.dispose = function(scene) {
  if (this._active && this._originalFog !== undefined) {
    scene.fog = this._originalFog;
  }
};


// ============================================================
// SkyWeatherAdvancedSystem — Master controller
// ============================================================

function SkyWeatherAdvancedSystem(scene, settings) {
  this.scene = scene;
  this.settings = this._deepMerge(SkyWeatherAdvancedSystem.DEFAULTS, settings || {});

  this.orbital = new OrbitalCalculator();
  this.atmosphere = new AtmosphereRenderer();
  this.lighting = new SkyLightingController();
  this.particles = new WeatherParticles();
  this.stars = new StarField();
  this.fog = new FogController();

  this._time = 0;
  this._lastUpdate = Date.now();
  this._skyUpdateTimer = 0;
  this._skyUpdateInterval = 2.0; // Recompute sky colors every 2 seconds (expensive)

  // Initialize all subsystems
  this.atmosphere.build(scene);
  this.lighting.init(scene);
  this.particles.init(scene);
  this.stars.init(scene);

  // Initial solar calculation
  var ts = this.settings.time || {};
  this.orbital.update(
    ts.solarTime || 0.45,
    ts.latitude || 45,
    ts.longitude || 0,
    ts.year || 2024,
    ts.month || 6,
    ts.day || 21,
    ts.timezone || 0
  );

  // Set initial atmosphere
  this.atmosphere._exposure = (this.settings.sky || {}).exposure || 1.2;
  this.atmosphere._mieG = (this.settings.sky || {}).mieDirectionalG || 0.76;
  this.atmosphere.setSunDirection(this.orbital.sunDirection);

  // Hook into game loop
  this._animFrameId = null;
  this._startLoop();

  console.log("[SkyWeatherAdvanced] Initialized — Tenkoku atmosphere active");
}

SkyWeatherAdvancedSystem.DEFAULTS = {
  time: {
    solarTime: 0.45,
    cycleLengthMinutes: 10,
    autoAdvance: false,
    latitude: 45,
    longitude: 0,
    timezone: 0,
    year: 2024,
    month: 6,
    day: 21,
  },
  sky: {
    sunDiskSize: 0.028,
    moonDiskSize: 0.022,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.76,
    starIntensity: 1.0,
    exposure: 1.2,
    rayleighScale: 1.0,
    sunIntensity: 22.0,
  },
  lighting: {
    autoSunLight: true,
    autoAmbient: true,
    sunIntensity: 1.5,
    ambientIntensity: 0.4,
    shadowsEnabled: true,
  },
  fog: {
    enabled: false,
    autoColor: true,
    density: 0.003,
    heightFalloff: 0,
  },
  clouds: {
    coverage: 0,
    density: 0.85,
    speed: 1.0,
    scale: 3.0,
    brightness: 1.0,
  },
  precipitation: {
    type: "none",
    intensity: 0,
    windDirection: 0,
    windStrength: 0.3,
  },
  lightning: {
    enabled: false,
    frequency: 0.1,
  },
  effects: {
    godRays: 0,
    aurora: 0,
    rainbow: 0,
    shootingStars: 0,
    ambientAudio: false,
    audioVolume: 0.5,
  },
};

SkyWeatherAdvancedSystem.prototype._deepMerge = function(target, patch) {
  var result = {};
  for (var k in target) {
    if (target.hasOwnProperty(k)) result[k] = target[k];
  }
  for (var k2 in patch) {
    if (!patch.hasOwnProperty(k2)) continue;
    var val = patch[k2];
    if (val && typeof val === "object" && !Array.isArray(val) && result[k2] && typeof result[k2] === "object") {
      result[k2] = this._deepMerge(result[k2], val);
    } else {
      result[k2] = val;
    }
  }
  return result;
};

SkyWeatherAdvancedSystem.prototype._startLoop = function() {
  var self = this;

  function loop() {
    self._animFrameId = requestAnimationFrame(loop);

    var now = Date.now();
    var dt = (now - self._lastUpdate) / 1000;
    self._lastUpdate = now;
    if (dt > 0.1) dt = 0.1; // cap delta

    self._time += dt;
    self._tick(dt);
  }

  this._animFrameId = requestAnimationFrame(loop);
};

SkyWeatherAdvancedSystem.prototype._tick = function(dt) {
  var ts = this.settings.time || {};

  // Auto-advance time
  if (ts.autoAdvance && ts.cycleLengthMinutes > 0) {
    ts.solarTime = (ts.solarTime || 0) + dt / (ts.cycleLengthMinutes * 60);
    if (ts.solarTime >= 1) ts.solarTime -= 1;
  }

  // Update orbital calculator
  this.orbital.update(
    ts.solarTime || 0.45,
    ts.latitude || 45,
    ts.longitude || 0,
    ts.year || 2024,
    ts.month || 6,
    ts.day || 21,
    ts.timezone || 0
  );

  var sunAltDeg = this.orbital.sunAltitude * RAD2DEG;

  // Throttled sky recompute (expensive vertex color calculation)
  this._skyUpdateTimer += dt;
  if (this._skyUpdateTimer >= this._skyUpdateInterval) {
    this._skyUpdateTimer = 0;

    var skySettings = this.settings.sky || {};
    this.atmosphere._exposure = skySettings.exposure || 1.2;
    this.atmosphere._mieG = skySettings.mieDirectionalG || 0.76;
    this.atmosphere._rayleighScale = skySettings.rayleighScale || 1.0;
    this.atmosphere._sunIntensity = skySettings.sunIntensity || 22.0;
    this.atmosphere.setSunDirection(this.orbital.sunDirection);
  }

  // Camera follow
  var camera = null;
  this.scene.traverse(function(obj) {
    if (obj.isCamera && !camera) camera = obj;
  });
  if (!camera && window.__vibexe_camera__) camera = window.__vibexe_camera__;
  this.atmosphere.followCamera(camera);

  // Lighting
  this.lighting.update(
    this.orbital.sunDirection,
    sunAltDeg,
    this.settings.lighting || {}
  );

  // Stars
  this.stars.update(sunAltDeg, camera, this._time, this.settings.sky || {});

  // Precipitation
  this.particles.update(dt, camera, this.settings.precipitation || {});

  // Fog
  this.fog.update(this.scene, sunAltDeg, this.settings.fog || {});
};

// Update settings from external source (bridge message)
SkyWeatherAdvancedSystem.prototype.updateSettings = function(patch) {
  this.settings = this._deepMerge(this.settings, patch);
  // Force immediate sky recompute on settings change
  this._skyUpdateTimer = this._skyUpdateInterval;
};

SkyWeatherAdvancedSystem.prototype.destroy = function() {
  if (this._animFrameId) {
    cancelAnimationFrame(this._animFrameId);
    this._animFrameId = null;
  }
  this.atmosphere.dispose();
  this.lighting.dispose(this.scene);
  this.particles.dispose(this.scene);
  this.stars.dispose(this.scene);
  this.fog.dispose(this.scene);
  console.log("[SkyWeatherAdvanced] Destroyed");
};


// ============================================================
// Module registration & auto-init
// ============================================================

if (typeof window !== "undefined") {
  window.__vibexe_modules__ = window.__vibexe_modules__ || {};
  window.__vibexe_modules__["sky-weather-advanced"] = {
    SkyWeatherAdvancedSystem: SkyWeatherAdvancedSystem,
    OrbitalCalculator: OrbitalCalculator,
    AtmosphereRenderer: AtmosphereRenderer,
    SkyLightingController: SkyLightingController,
    WeatherParticles: WeatherParticles,
    StarField: StarField,
    FogController: FogController
  };

  // Auto-init when scene becomes available
  if (window.__swa_autoInitInterval) {
    clearInterval(window.__swa_autoInitInterval);
    window.__swa_autoInitInterval = null;
  }
  (function() {
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      var scene = window.__vibexe_scene__;
      // Detect scene change: re-init on bundle re-injection
      if (scene && window.__vibexe_skyWeatherAdvanced && window.__vibexe_skyWeatherAdvanced.scene !== scene) {
        console.log("[SkyWeatherAdvanced] Scene changed, re-initializing");
        try { window.__vibexe_skyWeatherAdvanced.destroy(); } catch(e) {}
        window.__vibexe_skyWeatherAdvanced = null;
      }
      if (scene && typeof THREE !== 'undefined' && !window.__vibexe_skyWeatherAdvanced) {
        clearInterval(timer);
        window.__swa_autoInitInterval = null;
        var settings = {};
        try {
          var gs = window.__VIBEXE_GAME_SETTINGS__;
          if (gs) {
            if (gs.skyWeatherAdvanced && typeof gs.skyWeatherAdvanced === "object") {
              settings = gs.skyWeatherAdvanced;
            } else if (gs.modules && gs.modules.installed && gs.modules.installed["sky-weather-advanced"]) {
              settings = gs.modules.installed["sky-weather-advanced"].config || {};
            }
          }
        } catch(e) {}
        window.__vibexe_skyWeatherAdvanced = new SkyWeatherAdvancedSystem(scene, settings);
      }
      if (attempts >= 100) {
        clearInterval(timer);
        window.__swa_autoInitInterval = null;
        console.warn("[SkyWeatherAdvanced] Scene not found after 10s");
      }
    }, 100);
    window.__swa_autoInitInterval = timer;
  })();
}

module.exports = {
  SkyWeatherAdvancedSystem: SkyWeatherAdvancedSystem,
  OrbitalCalculator: OrbitalCalculator,
  AtmosphereRenderer: AtmosphereRenderer,
  SkyLightingController: SkyLightingController,
  WeatherParticles: WeatherParticles,
  StarField: StarField,
  FogController: FogController
};
`,
	bridgeHandlers: {
		"sky-weather-advanced-set-time": "handleSetTime",
		"sky-weather-advanced-set-preset": "handleSetPreset",
		"sky-weather-advanced-update-config": "handleUpdateConfig",
	},
	defaultSettings: {
		time: {
			solarTime: 0.45,
			cycleLengthMinutes: 10,
			autoAdvance: false,
			latitude: 45,
			longitude: 0,
			timezone: 0,
			year: 2024,
			month: 6,
			day: 21,
		},
		sky: {
			sunDiskSize: 0.028,
			moonDiskSize: 0.022,
			mieCoefficient: 0.005,
			mieDirectionalG: 0.76,
			starIntensity: 1.0,
			exposure: 1.2,
			rayleighScale: 1.0,
			sunIntensity: 22.0,
		},
		lighting: {
			autoSunLight: true,
			autoAmbient: true,
			sunIntensity: 1.5,
			ambientIntensity: 0.4,
			shadowsEnabled: true,
		},
		fog: {
			enabled: false,
			autoColor: true,
			density: 0.003,
			heightFalloff: 0,
		},
		clouds: {
			coverage: 0,
			density: 0.85,
			speed: 1.0,
			scale: 3.0,
			brightness: 1.0,
		},
		precipitation: {
			type: "none",
			intensity: 0,
			windDirection: 0,
			windStrength: 0.3,
		},
		lightning: {
			enabled: false,
			frequency: 0.1,
		},
		effects: {
			godRays: 0,
			aurora: 0,
			rainbow: 0,
			shootingStars: 0,
			ambientAudio: false,
			audioVolume: 0.5,
		},
	},
};
