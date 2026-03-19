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
	version: "1.14.0",
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

// Invert triangle winding order so inside faces become FrontSide
// Required for WebGPU: BackSide + vertexColors/textures = invisible
function _invertWinding(geo) {
  var idx = geo.index;
  if (!idx) return;
  var arr = idx.array;
  for (var i = 0; i < arr.length; i += 3) {
    var tmp = arr[i]; arr[i] = arr[i + 2]; arr[i + 2] = tmp;
  }
  idx.needsUpdate = true;
}

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
  var lat = latitude != null ? latitude : 45;
  var lon = longitude != null ? longitude : 0;
  year = year || 2024;
  month = month || 6;
  day = day || 21;
  timezone = timezone != null ? timezone : 0;

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
var RAYLEIGH_SCALE_HEIGHT = 10000; // meters (Tenkoku sky shader: 10000)
var MIE_SCALE_HEIGHT = 3000;       // meters (Tenkoku: 5000, Earth std: 1200, compromise: 3000)

// Rayleigh scattering coefficients at sea level (per meter)
var RAYLEIGH_COEFF = [5.8e-6, 13.5e-6, 33.1e-6]; // RGB
// Mie scattering coefficient at sea level
var MIE_COEFF = 2.0e-5;

// Tenkoku incoming light spectral distribution — blue-biased
// Source: _IncomingLight = float4(3.6, 3.9, 6.0, 4) in Tenkoku_sky_elek.shader
// Normalized to ratios: R=0.80, G=0.867, B=1.333 (B/R ratio = 1.67x)
// This deepens the blue zenith and enriches sunset/sunrise colors
// Increased blue bias for richer Tenkoku-quality blue sky (was R=0.80 B=1.333)
var INCOMING_LIGHT_RATIO = [0.72, 0.84, 1.45];

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
  this._starIntensity = 1.0;  // from settings.sky.starIntensity
  this._solarTime = 0.45;     // for sidereal rotation of star highlights
  this._time = 0;             // elapsed time for star twinkle animation
  this._moonDir = [0, -1, 0]; // moon direction for atmosphere moon Mie glow
  this._nightBrightness = 0.2; // Reduced for darker nights matching Tenkoku reference
  this._overcastAmount = 0;   // 0-1 overcast weather dimming (from weather system)
  this._skyTintColor = [1, 1, 1]; // RGB tint multiplier (Tenkoku globalSkyColor)
  this._skyTintAlpha = 0;     // tint blend amount (0 = no tint)
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

  // Combine scattering with Tenkoku spectral incoming light (Task 1)
  // INCOMING_LIGHT_RATIO: R=0.80, G=0.867, B=1.333 — blue-biased for deeper blue zenith
  var intensity = this._sunIntensity;
  var r = (scatterR[0] * RAYLEIGH_COEFF[0] * phaseR + scatterM[0] * MIE_COEFF * phaseM) * intensity * INCOMING_LIGHT_RATIO[0];
  var gn = (scatterR[1] * RAYLEIGH_COEFF[1] * phaseR + scatterM[1] * MIE_COEFF * phaseM) * intensity * INCOMING_LIGHT_RATIO[1];
  var b = (scatterR[2] * RAYLEIGH_COEFF[2] * phaseR + scatterM[2] * MIE_COEFF * phaseM) * intensity * INCOMING_LIGHT_RATIO[2];

  // Sun disk (Mie peak for very narrow angle) — bright core
  if (cosAngle > this._sunDiskSize) {
    var sunG = 0.9995;
    var sunG2 = sunG * sunG;
    var sunPhase = (1 - sunG2) / (4 * PI * Math.pow(1 + sunG2 - 2 * sunG * cosAngle, 1.5));
    var sunAdd = sunPhase * 0.008 * intensity;
    r += scatterM[0] * sunAdd;
    gn += scatterM[1] * sunAdd;
    b += scatterM[2] * sunAdd;
  }
  // Sun corona — 6-ring concentric glow (ported from Tenkoku_sun.shader lines 89-94)
  // Each ring has a different dot-product threshold and weight
  if (sunDir[1] > -0.05) {
    var sunVis = _clamp(sunDir[1] + 0.1, 0, 1);
    var coronaAlpha = 0;
    // Ring 1: tight inner corona (cosAngle > 0.9995)
    coronaAlpha += Math.max(0, cosAngle - 0.9995) * 0.05 * 2000;
    // Ring 2: inner glow (cosAngle > 0.999)
    coronaAlpha += Math.max(0, cosAngle - 0.999) * 0.05 * 500;
    // Ring 3: warm corona (cosAngle > 0.997)
    coronaAlpha += Math.max(0, cosAngle - 0.997) * 0.1 * 100;
    // Ring 4: wide corona (cosAngle > 0.99)
    coronaAlpha += Math.max(0, cosAngle - 0.99) * 0.1 * 30;
    // Ring 5: atmospheric haze (cosAngle > 0.97)
    coronaAlpha += Math.max(0, cosAngle - 0.97) * 0.1 * 8;
    // Ring 6: wide sky haze (cosAngle > 0.93)
    coronaAlpha += Math.max(0, cosAngle - 0.93) * 1.0 * 1.5;
    coronaAlpha = _clamp(coronaAlpha, 0, 2.0) * sunVis;
    // Warm corona color (Tenkoku: lerp between corona and sun tint)
    r += coronaAlpha * 0.45;
    gn += coronaAlpha * 0.38;
    b += coronaAlpha * 0.22;
  }

  // Moon Mie scattering — multi-ring atmospheric glow around moon (Task 5)
  // Ported from Tenkoku_sky_elek.shader: concentric dot-product rings
  var moonDir = this._moonDir;
  if (moonDir[1] > -0.1) {
    var dotMoon = rd[0]*moonDir[0] + rd[1]*moonDir[1] + rd[2]*moonDir[2];
    var moonMie = 0;
    moonMie += Math.max(0, dotMoon - 0.9995) * 1.0;
    moonMie += Math.max(0, dotMoon - 0.999) * 1.0;
    moonMie += Math.max(0, dotMoon - 0.997) * 1.0;
    moonMie += Math.max(0, dotMoon - 0.990) * 0.75;
    moonMie += Math.max(0, dotMoon - 0.97) * 0.5;
    moonMie = _clamp(moonMie, 0, 1);
    var nightFac = _clamp(1.0 - sunDir[1] * 5, 0, 1);
    r += moonMie * 0.2 * nightFac;
    gn += moonMie * 0.28 * nightFac;
    b += moonMie * 0.4 * nightFac;
  }

  // Tone mapping (Reinhard exponential) — no manual gamma, WebGPU handles sRGB
  var exposure = this._exposure * 2.5;
  r = 1 - Math.exp(-r * exposure);
  gn = 1 - Math.exp(-gn * exposure);
  b = 1 - Math.exp(-b * exposure);

  // Multi-layer atmospheric perspective — 3 altitude bands (Tenkoku: 4-5 depth layers)
  var altDeg = Math.abs(viewDir[1]) * 90; // approximate altitude in degrees
  // Band 1: 0-5° — subtle white-blue haze at horizon
  var band1 = _clamp(1.0 - altDeg / 5.0, 0, 1);
  band1 = band1 * band1 * 0.08;
  r = _lerp(r, 0.60, band1);
  gn = _lerp(gn, 0.66, band1);
  b = _lerp(b, 0.78, band1);
  // Band 2: 5-15° — moderate blue-shift
  var band2 = _smoothstep(15, 5, altDeg) * _smoothstep(0, 5, altDeg);
  band2 *= 0.06;
  r = _lerp(r, 0.50, band2);
  gn = _lerp(gn, 0.58, band2);
  b = _lerp(b, 0.72, band2);
  // Band 3: 15-30° — subtle aerial perspective
  var band3 = _smoothstep(30, 15, altDeg) * _smoothstep(5, 15, altDeg);
  band3 *= 0.025;
  r = _lerp(r, 0.45, band3);
  gn = _lerp(gn, 0.55, band3);
  b = _lerp(b, 0.70, band3);

  // Horizon warmth — warm up near horizon when sun is low (Tenkoku golden glow)
  // Reduced from 0.50 to 0.35 — was adding too much orange even at noon
  var horizonFac = 1.0 - Math.abs(viewDir[1]);
  horizonFac = horizonFac * horizonFac * horizonFac;
  var sunHorizFac = Math.max(0, 1.0 - Math.abs(sunDir[1]) * 3.0);
  var warmth = horizonFac * sunHorizFac * 0.35;
  r += warmth * 1.0;
  gn += warmth * 0.45;
  b += warmth * 0.08;

  // Sun-facing horizon glow — extra warmth toward the sun
  var viewSunDot = rd[0]*sunDir[0] + rd[2]*sunDir[2];
  var sunGlow = _clamp(viewSunDot, 0, 1) * horizonFac * sunHorizFac * 0.25;
  r += sunGlow * 1.0;
  gn += sunGlow * 0.35;

  // Dawn/Dusk pink-purple band — Tenkoku Clear-Altostratus reference: prominent pink-rose band
  if (Math.abs(sunDir[1]) < 0.22) {
    var pinkAlt = _clamp(viewDir[1], 0, 1);
    var pinkBand = _smoothstep(0.0, 0.15, pinkAlt) * _smoothstep(0.65, 0.15, pinkAlt);
    var pinkStr = pinkBand * (1.0 - Math.abs(sunDir[1]) / 0.22) * 0.30;
    r += pinkStr * 1.0;
    gn += pinkStr * 0.12;
    b += pinkStr * 0.75;
  }
  // Upper sky purple tint at dawn/dusk — Tenkoku ref: purple zenith during golden hour
  if (Math.abs(sunDir[1]) < 0.18 && viewDir[1] > 0.25) {
    var purpleZenith = _smoothstep(0.25, 0.75, viewDir[1]);
    var purpleStr = purpleZenith * (1.0 - Math.abs(sunDir[1]) / 0.18) * 0.12;
    r += purpleStr * 0.65;
    b += purpleStr * 0.95;
  }

  // Boost saturation for vivid colors — Tenkoku has rich saturated skies
  var luma = r * 0.299 + gn * 0.587 + b * 0.114;
  var satBoost = 1.50; // was 1.35 — stronger for richer blue
  r = luma + (r - luma) * satBoost;
  gn = luma + (gn - luma) * satBoost;
  b = luma + (b - luma) * satBoost;

  // Deeper blue at zenith — Tenkoku ref: strong contrast between deep blue zenith and light horizon
  var zenithFac = _clamp(viewDir[1], 0, 1);
  zenithFac = zenithFac * zenithFac;
  b += zenithFac * 0.08; // was 0.04 — doubled for richer blue zenith
  r -= zenithFac * 0.04; // was 0.02 — remove more red from zenith
  gn -= zenithFac * 0.015; // was 0.005

  // Overcast sky desaturation — Tenkoku reference: dimmed blue-grey sky, not fully grey
  var overcast = this._overcastAmount;
  if (overcast > 0.4) {
    // Keep a cool blue-grey tint, not pure dark grey — Tenkoku clouds still show sky color
    var lum = r * 0.299 + gn * 0.587 + b * 0.114;
    var grey = lum * 0.45; // preserve more luminance (was 0.10 — way too dark)
    var overcastT = _clamp((overcast - 0.4) * 1.67, 0, 0.75); // 0 at 40%, 0.75 at 100% (was 0.92)
    r = _lerp(r, grey * 0.90, overcastT); // slightly warm/cool bias
    gn = _lerp(gn, grey * 0.95, overcastT);
    b = _lerp(b, grey * 1.10, overcastT); // keep slight blue tint
  }

  // Sky tinting (Task 12 — Tenkoku globalSkyColor)
  if (this._skyTintAlpha > 0) {
    r = _lerp(r, r * this._skyTintColor[0], this._skyTintAlpha);
    gn = _lerp(gn, gn * this._skyTintColor[1], this._skyTintAlpha);
    b = _lerp(b, b * this._skyTintColor[2], this._skyTintAlpha);
  }

  // Night sky brightness — near-black with subtle blue tint (Tenkoku ref: deep black zenith)
  var nightBright = this._nightBrightness;
  var nightR = 0.005 * nightBright; // was 0.008 — darker for more star contrast
  var nightG = 0.006 * nightBright; // was 0.010
  var nightB = 0.018 * nightBright; // was 0.025 — subtle blue tint
  r = Math.max(r, nightR);
  gn = Math.max(gn, nightG);
  b = Math.max(b, nightB);

  // Night horizon brightening — very subtle atmospheric glow (Tenkoku: visible but faint)
  var sunAlt01 = _clamp(sunDir[1], -1, 1);
  var isNight = _clamp(-sunAlt01 * 5, 0, 1);
  if (isNight > 0.01) {
    var nhFac = _clamp(1.0 - viewDir[1] * 3.0, 0, 1);
    nhFac = nhFac * nhFac * nhFac * nhFac; // quartic falloff — tighter near horizon
    var nightHorizon = nhFac * isNight * nightBright * 0.12;
    r += nightHorizon * 0.04;
    gn += nightHorizon * 0.045;
    b += nightHorizon * 0.07; // blue-ish horizon glow
  }

  return [_clamp(r, 0, 1), _clamp(gn, 0, 1), _clamp(b, 0, 1)];
};

// Build the sky dome mesh with vertex colors
AtmosphereRenderer.prototype.build = function(scene) {
  if (this.dome) return;

  var segW = 96, segH = 48; // keep original resolution — 128x64 caused FPS regression (2x vertex cost)
  // Dome radius must be < camera.far (typically 1000). Use 500 like working sky-weather module.
  this.geometry = new THREE.SphereGeometry(500, segW, segH);
  this.geometry.name = "__swa_sky_dome_geo__";
  // Invert winding so inside faces become FrontSide (WebGPU compat)
  _invertWinding(this.geometry);

  // Vertex colors buffer
  var posAttr = this.geometry.getAttribute("position");
  var colors = new Float32Array(posAttr.count * 3);
  this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  this.material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.FrontSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
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
    // Bayer 2x2 ordered dithering to break Mach banding (Phase F.2)
    var bayerIdx = ((i & 1) + ((i >> 3) & 1) * 2); // 0-3 from vertex index
    var bayerVal = [0, 2, 3, 1][bayerIdx] / 4.0 - 0.375; // centered [-0.375, 0.125]
    var dither = bayerVal * (1.0 / 128.0); // ~0.008 amplitude
    colors[i * 3] = _clamp(c[0] + dither, 0, 1);
    colors[i * 3 + 1] = _clamp(c[1] + dither, 0, 1);
    colors[i * 3 + 2] = _clamp(c[2] + dither, 0, 1);
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

// Get horizon color for fog integration — samples sky at horizon level
AtmosphereRenderer.prototype.getHorizonColor = function() {
  // Sample the sky color looking toward the horizon (y=0, z=-1)
  return this._computeSkyColor([0, 0.02, -1]);
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
// Sun Disk Billboard — follows sun direction with glow halo
// ============================================================

function SunDiskRenderer() {
  this._group = null;
  this._diskMesh = null;
  this._glowMesh = null;
}

SunDiskRenderer.prototype.build = function(scene) {
  if (this._group) return;
  this._group = new THREE.Group();
  this._group.name = "__swa_sun_disk__";
  this._group.renderOrder = -998;

  // Sun disk — bright white/yellow circle with hard edge (Tenkoku BRDF sun)
  // NormalBlending so it's visible against bright sky (additive = invisible on white)
  var diskGeo = new THREE.PlaneGeometry(20, 20);
  var diskCanvas = document.createElement("canvas");
  diskCanvas.width = 256; diskCanvas.height = 256;
  var dCtx = diskCanvas.getContext("2d");
  // Hard-edge sun disk with soft corona fringe
  var grad = dCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,245,1.0)");
  grad.addColorStop(0.35, "rgba(255,252,235,1.0)");
  grad.addColorStop(0.5, "rgba(255,245,210,0.95)");
  grad.addColorStop(0.7, "rgba(255,230,170,0.5)");
  grad.addColorStop(0.85, "rgba(255,210,130,0.15)");
  grad.addColorStop(1.0, "rgba(255,200,100,0.0)");
  dCtx.fillStyle = grad;
  dCtx.fillRect(0, 0, 256, 256);
  var diskTex = new THREE.CanvasTexture(diskCanvas);
  var diskMat = new THREE.MeshBasicMaterial({
    map: diskTex, transparent: true, depthWrite: false, depthTest: false, fog: false,
    side: THREE.DoubleSide, toneMapped: false,
  });
  this._diskMesh = new THREE.Mesh(diskGeo, diskMat);
  this._group.add(this._diskMesh);

  // Glow halo — larger atmospheric bloom around the sun
  var glowGeo = new THREE.PlaneGeometry(80, 80);
  var glowCanvas = document.createElement("canvas");
  glowCanvas.width = 256; glowCanvas.height = 256;
  var gCtx = glowCanvas.getContext("2d");
  var gGrad = gCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gGrad.addColorStop(0, "rgba(255,245,220,1.0)");
  gGrad.addColorStop(0.1, "rgba(255,240,200,0.85)");
  gGrad.addColorStop(0.25, "rgba(255,225,170,0.45)");
  gGrad.addColorStop(0.45, "rgba(255,210,130,0.15)");
  gGrad.addColorStop(0.7, "rgba(255,190,100,0.04)");
  gGrad.addColorStop(1.0, "rgba(255,170,70,0.0)");
  gCtx.fillStyle = gGrad;
  gCtx.fillRect(0, 0, 256, 256);
  var glowTex = new THREE.CanvasTexture(glowCanvas);
  var glowMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, depthWrite: false, depthTest: false, fog: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  this._glowMesh = new THREE.Mesh(glowGeo, glowMat);
  this._group.add(this._glowMesh);

  scene.add(this._group);
};

SunDiskRenderer.prototype.update = function(camera, sunDir, sunAltDeg, settings) {
  if (!this._group) return;

  // Position sun disk — clamp altitude so sun is visible from default orbit camera
  // Real orbital direction for lighting, but rendering capped at ~40° elevation
  // so the disk+glow appear near the top of the viewport instead of above it
  var dist = 450;
  var renderY = sunDir.y;
  if (renderY > 0.64) renderY = 0.64; // cap at sin(40°) ≈ 0.64
  var renderXZ = Math.sqrt(sunDir.x * sunDir.x + sunDir.z * sunDir.z) || 0.001;
  var targetXZ = Math.sqrt(1 - renderY * renderY);
  var xzScale = targetXZ / renderXZ;
  this._group.position.set(
    camera.position.x + sunDir.x * xzScale * dist,
    camera.position.y + renderY * dist,
    camera.position.z + sunDir.z * xzScale * dist
  );

  // Billboard: always face camera
  this._group.lookAt(camera.position);

  // Size — realistic sun disk with subtle horizon inflation
  var diskSize = (settings.sunDiskSize != null ? settings.sunDiskSize : 0.028) * 2500; // was 5000 — halved
  var diskScale = diskSize / 33;
  // Horizon size inflation: 1.15x at horizon (was 1.5x — way too large)
  var horizInflation = sunAltDeg < 15 ? _lerp(1.15, 1.0, _clamp(sunAltDeg / 15, 0, 1)) : 1.0;
  diskScale *= horizInflation;
  if (this._diskMesh) this._diskMesh.scale.setScalar(diskScale);
  // Glow halo: 3.5x disk scale (was 10x — way too large, covered 1/4 of screen)
  if (this._glowMesh) this._glowMesh.scale.setScalar(diskScale * 3.5);

  // Hide when sun below horizon
  this._group.visible = sunAltDeg > -2;

  // Fade near horizon
  var horizFade = _clamp((sunAltDeg + 2) / 10, 0, 1);
  if (this._diskMesh && this._diskMesh.material) this._diskMesh.material.opacity = horizFade;
  // Glow always visible when sun is up — strong opacity for Tenkoku-level prominence
  var glowOpacity = sunAltDeg < 20 ? horizFade * 1.0 : horizFade * 0.85;
  if (this._glowMesh && this._glowMesh.material) this._glowMesh.material.opacity = glowOpacity;

  // Warm sun color at low angles (orange-gold sunrise/sunset)
  if (this._diskMesh && this._diskMesh.material) {
    if (sunAltDeg < 20) {
      var warmT = _clamp(1 - sunAltDeg / 20, 0, 1);
      this._diskMesh.material.color.setRGB(1, _lerp(1, 0.7, warmT), _lerp(0.96, 0.25, warmT));
    } else {
      this._diskMesh.material.color.setRGB(1, 1, 0.96);
    }
  }
  // Glow color follows disk but softer
  if (this._glowMesh && this._glowMesh.material) {
    if (sunAltDeg < 20) {
      var warmT2 = _clamp(1 - sunAltDeg / 20, 0, 1);
      this._glowMesh.material.color.setRGB(1, _lerp(1, 0.75, warmT2), _lerp(0.9, 0.3, warmT2));
    } else {
      this._glowMesh.material.color.setRGB(1, 1, 0.9);
    }
  }
};

SunDiskRenderer.prototype.dispose = function(scene) {
  if (this._group && this._group.parent) this._group.parent.remove(this._group);
  this._group = null;
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
  // ADOPT existing scene lights (same approach as sky-weather module)
  // This avoids the bridge removing our lights as "duplicates"
  var self = this;
  this.sunLight = null;
  this.ambientLight = null;
  this._ownsLights = false;

  scene.traverse(function(obj) {
    // Prefer __default_sun__, fall back to any DirectionalLight
    if (obj.isDirectionalLight) {
      if (!self.sunLight || obj.name === "__default_sun__") {
        self.sunLight = obj;
      }
    }
    // Adopt first HemisphereLight or AmbientLight
    if (!self.ambientLight && (obj.isAmbientLight || obj.isHemisphereLight)) {
      self.ambientLight = obj;
    }
  });

  if (this.sunLight) {
    console.log("[SkyWeatherAdvanced] Adopted sun light:", this.sunLight.name);
  } else {
    // No existing sun light — create our own (shouldn't happen in normal game)
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sunLight.name = "__default_sun__"; // Use standard name to avoid bridge removal
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 200;
    var s = 40;
    this.sunLight.shadow.camera.left = -s;
    this.sunLight.shadow.camera.right = s;
    this.sunLight.shadow.camera.top = s;
    this.sunLight.shadow.camera.bottom = -s;
    this.sunLight.shadow.bias = -0.001;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);
    this._ownsLights = true;
    console.log("[SkyWeatherAdvanced] Created sun light (no existing found)");
  }

  if (this.ambientLight) {
    console.log("[SkyWeatherAdvanced] Adopted ambient light:", this.ambientLight.name);
  } else {
    this.ambientLight = new THREE.HemisphereLight(0x87CEEB, 0x362d15, 0.8);
    this.ambientLight.name = "__default_hemi__";
    scene.add(this.ambientLight);
    this._ownsLights = true;
    console.log("[SkyWeatherAdvanced] Created ambient light (no existing found)");
  }
};

SkyLightingController.prototype.update = function(sunDir, sunAltDeg, settings, weatherState) {
  if (!this.sunLight) return;

  var autoSun = settings.autoSunLight !== false;
  var autoAmbient = settings.autoAmbient !== false;

  if (autoSun) {
    // Sun intensity based on altitude
    var altNorm = _clamp(sunAltDeg / 90, -1, 1);
    var dayIntensity = settings.sunIntensity != null ? settings.sunIntensity : 1.5;

    if (altNorm > 0.05) {
      // Day: full intensity, position from sun direction
      this.sunLight.intensity = dayIntensity * _smoothstep(0.05, 0.2, altNorm);
      this.sunLight.position.set(sunDir.x * 100, sunDir.y * 100, sunDir.z * 100);
    } else if (altNorm > -0.1) {
      // Twilight: fade from sun to moonlight
      this.sunLight.intensity = dayIntensity * _smoothstep(-0.1, 0.05, altNorm) * 0.3;
      this.sunLight.position.set(sunDir.x * 100, sunDir.y * 100, sunDir.z * 100);
    } else {
      // Night: moonlight from above (Tenkoku: nightBright*1.2 + moonBright = 1.48 intensity)
      this.sunLight.intensity = 0.12;
      this.sunLight.position.set(20, 80, 20);
    }

    // Sun color temperature
    var sunR = 1.0, sunG = 0.96, sunB = 0.92;
    if (altNorm > 0.15) {
      sunR = 1.0; sunG = 0.96; sunB = 0.92;
    } else if (altNorm > 0) {
      var warmT = _smoothstep(0, 0.15, altNorm);
      sunR = _lerp(1.0, 1.0, warmT);
      sunG = _lerp(0.65, 0.96, warmT);
      sunB = _lerp(0.3, 0.92, warmT);
    } else {
      sunR = 0.3; sunG = 0.35; sunB = 0.55;
    }
    // Weather-state sun color blending (Phase E.1)
    var ws = weatherState || "clear";
    if (ws === "storm") {
      sunR = _lerp(sunR, 0.55, 0.35); sunG = _lerp(sunG, 0.58, 0.35); sunB = _lerp(sunB, 0.65, 0.35);
    } else if (ws === "rain") {
      sunR = _lerp(sunR, 0.65, 0.25); sunG = _lerp(sunG, 0.68, 0.25); sunB = _lerp(sunB, 0.75, 0.25);
    } else if (ws === "overcast") {
      sunR = _lerp(sunR, 0.75, 0.18); sunG = _lerp(sunG, 0.77, 0.18); sunB = _lerp(sunB, 0.82, 0.18);
    } else if (ws === "snow") {
      sunR = _lerp(sunR, 0.85, 0.20); sunG = _lerp(sunG, 0.88, 0.20); sunB = _lerp(sunB, 0.94, 0.20);
    }
    this.sunLight.color.setRGB(sunR, sunG, sunB);
  }

  if (autoAmbient && this.ambientLight) {
    var ambIntensity = settings.ambientIntensity != null ? settings.ambientIntensity : 0.4;
    // Weather-driven ambient intensity (Phase E.2)
    var ws2 = weatherState || "clear";
    if (ws2 === "storm") ambIntensity *= 0.55;       // dimmed
    else if (ws2 === "rain") ambIntensity *= 0.65;    // slightly dim
    else if (ws2 === "overcast") ambIntensity *= 0.78; // subtle dim
    else if (ws2 === "snow") ambIntensity *= 0.85;    // slightly bright (reflective snow)
    else ambIntensity *= 1.15;                        // clear: mild boost
    var isHemi = this.ambientLight.isHemisphereLight;
    if (sunAltDeg > 10) {
      // Day ambient
      this.ambientLight.intensity = ambIntensity;
      this.ambientLight.color.setRGB(0.53, 0.81, 0.92);      // sky blue
      if (isHemi) this.ambientLight.groundColor.setRGB(0.21, 0.18, 0.08); // warm ground
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
      // Night — dim but visible ambient (Tenkoku: nightBrightness=0.4, ambient=0.08)
      this.ambientLight.intensity = 0.08;
      this.ambientLight.color.setRGB(0.10, 0.10, 0.20);
      if (isHemi) this.ambientLight.groundColor.setRGB(0.03, 0.03, 0.05);
    }
  }

  // Shadow toggle (reactive to settings)
  if (this.sunLight) {
    this.sunLight.castShadow = settings.shadowsEnabled !== false;
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
  // Only remove lights we created (not adopted ones)
  if (this._ownsLights) {
    if (this.sunLight) {
      if (this.sunLight.target) scene.remove(this.sunLight.target);
      scene.remove(this.sunLight);
      if (this.sunLight.shadow && this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose();
      }
    }
    if (this.ambientLight) {
      scene.remove(this.ambientLight);
    }
  }
  this.sunLight = null;
  this.ambientLight = null;
};


// ============================================================
// Procedural Weather Particle Textures
// ============================================================

var __swa_texCache = {};

function _getSwaSnowTex() {
  if (__swa_texCache.snow && __swa_texCache._snowV3) return __swa_texCache.snow;
  var s = 32, h = s / 2;
  var c = document.createElement("canvas"); c.width = c.height = s;
  var x = c.getContext("2d");
  // Tiny soft round dot — NO crystal arms (Tenkoku Ref 6: nearly invisible tiny dots)
  var g = x.createRadialGradient(h, h, 0, h, h, h * 0.7);
  g.addColorStop(0.0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.3, "rgba(240,245,255,0.5)");
  g.addColorStop(0.6, "rgba(225,235,255,0.15)");
  g.addColorStop(1.0, "rgba(210,225,255,0.0)");
  x.fillStyle = g;
  x.beginPath(); x.arc(h, h, h * 0.7, 0, TWO_PI); x.fill();
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  __swa_texCache.snow = t;
  __swa_texCache._snowV3 = true;
  return t;
}

function _getSwaRainTex() {
  if (__swa_texCache.rain) return __swa_texCache.rain;
  var w = 16, ht = 128; // very elongated streak (1:8 ratio)
  var c = document.createElement("canvas"); c.width = w; c.height = ht;
  var x = c.getContext("2d");
  var g = x.createLinearGradient(0, 0, 0, ht);
  g.addColorStop(0.0, "rgba(200,220,255,0.0)");
  g.addColorStop(0.1, "rgba(210,225,255,0.4)");
  g.addColorStop(0.3, "rgba(220,235,255,0.9)");
  g.addColorStop(0.7, "rgba(220,235,255,0.9)");
  g.addColorStop(0.9, "rgba(210,225,255,0.4)");
  g.addColorStop(1.0, "rgba(200,220,255,0.0)");
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(w / 2, ht / 2, w / 2 - 1, ht / 2, 0, 0, Math.PI * 2);
  x.fill();
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  __swa_texCache.rain = t;
  return t;
}


// ============================================================
// Weather Particles (rain/snow) — InstancedMesh billboard implementation
// WebGPU note: THREE.Points renders as 1px in r183 WebGPU renderer.
// Solution: InstancedMesh with PlaneGeometry + MeshBasicMaterial.
// Each particle is a tiny camera-facing quad (billboard).
// MeshBasicMaterial + CanvasTexture is fully WebGPU-compatible.
// COMPILER_VERSION: 17
// ============================================================

function WeatherParticles() {
  this._rain = null;       // THREE.InstancedMesh
  this._snow = null;       // THREE.InstancedMesh
  this._splash = null;     // THREE.InstancedMesh
  this._rainMat = null;
  this._snowMat = null;
  this._splashMat = null;
  // Particle state arrays (JS arrays — not BufferGeometry)
  this._rainPos = null;    // Float32Array [x,y,z, x,y,z, ...]
  this._rainVel = null;    // Float32Array [speed, ...]
  this._snowPos = null;
  this._snowVel = null;
  this._splashPos = null;
  this._splashVel = null;
  this._rainCount = 1000;
  this._snowCount = 800;
  this._splashCount = 200;
  this._windDir = 0;
  this._windStrength = 0.3;
  this._cameraInitDone = false;
  // Reusable matrix helpers for per-instance billboard updates
  this._mtx = new THREE.Matrix4();
  this._pos3 = new THREE.Vector3();
  this._scl3 = new THREE.Vector3();
  this._quat = new THREE.Quaternion();
  // Pre-allocated objects to avoid per-frame GC pressure
  this._rainTiltQ = new THREE.Quaternion();
  this._tiltAxis = new THREE.Vector3(1, 0, 0);
  this._anchorPos = new THREE.Vector3();
  this._zeroMtx = new THREE.Matrix4().makeScale(0, 0, 0);
}

WeatherParticles.prototype.init = function(scene) {
  var i, rDist, rAngle;

  // ---- Rain InstancedMesh ----
  // PlaneGeometry(width, height): 0.08 wide × 1.5 tall → thin diagonal streak (Tenkoku Ref 2)
  var rainGeo = new THREE.PlaneGeometry(0.08, 1.5);
  this._rainMat = new THREE.MeshBasicMaterial({
    map: _getSwaRainTex(),
    transparent: true,
    opacity: 0.15,       // Tenkoku: translucent streaks
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    alphaTest: 0.01,
  });
  this._rain = new THREE.InstancedMesh(rainGeo, this._rainMat, this._rainCount);
  this._rain.name = "__swa_rain__";
  this._rain.frustumCulled = false;
  this._rain.visible = false;
  // Initialise all instances off-screen
  var zeroMtx = new THREE.Matrix4().makeScale(0, 0, 0);
  for (i = 0; i < this._rainCount; i++) this._rain.setMatrixAt(i, zeroMtx);
  this._rain.instanceMatrix.needsUpdate = true;
  scene.add(this._rain);

  // Rain particle state
  this._rainPos = new Float32Array(this._rainCount * 3);
  this._rainVel = new Float32Array(this._rainCount);
  for (i = 0; i < this._rainCount; i++) {
    rDist = Math.pow(Math.random(), 0.6);
    rAngle = Math.random() * TWO_PI;
    this._rainPos[i*3]   = Math.cos(rAngle) * rDist * 50;
    this._rainPos[i*3+1] = Math.random() * 50;
    this._rainPos[i*3+2] = Math.sin(rAngle) * rDist * 50;
    this._rainVel[i] = 18 + Math.random() * 12;
  }

  // ---- Snow InstancedMesh ----
  // PlaneGeometry(0.25, 0.25) → tiny round dot (was 1.0 = huge star shapes)
  var snowGeo = new THREE.PlaneGeometry(0.25, 0.25);
  this._snowMat = new THREE.MeshBasicMaterial({
    map: _getSwaSnowTex(),
    transparent: true,
    opacity: 0.5,        // Tenkoku: alpha ~0.45
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    alphaTest: 0.01,
  });
  this._snow = new THREE.InstancedMesh(snowGeo, this._snowMat, this._snowCount);
  this._snow.name = "__swa_snow__";
  this._snow.frustumCulled = false;
  this._snow.visible = false;
  for (i = 0; i < this._snowCount; i++) this._snow.setMatrixAt(i, zeroMtx);
  this._snow.instanceMatrix.needsUpdate = true;
  scene.add(this._snow);

  // Snow particle state
  this._snowPos = new Float32Array(this._snowCount * 3);
  this._snowVel = new Float32Array(this._snowCount);
  for (i = 0; i < this._snowCount; i++) {
    var sDist = Math.pow(Math.random(), 0.6);
    var sAngle = Math.random() * TWO_PI;
    this._snowPos[i*3]   = Math.cos(sAngle) * sDist * 45;
    this._snowPos[i*3+1] = Math.random() * 35;
    this._snowPos[i*3+2] = Math.sin(sAngle) * sDist * 45;
    this._snowVel[i] = 3.0 + Math.random() * 4.0; // faster fall so snow reaches ground quickly
  }

  // ---- Splash InstancedMesh ----
  // PlaneGeometry(0.4, 0.4) → small round splash drop
  var splashGeo = new THREE.PlaneGeometry(0.4, 0.4);
  this._splashMat = new THREE.MeshBasicMaterial({
    map: _getSwaSnowTex(), // reuse round texture for splash drops
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    alphaTest: 0.01,
  });
  this._splash = new THREE.InstancedMesh(splashGeo, this._splashMat, this._splashCount);
  this._splash.name = "__swa_rain_splash__";
  this._splash.frustumCulled = false;
  this._splash.visible = false;
  for (i = 0; i < this._splashCount; i++) this._splash.setMatrixAt(i, zeroMtx);
  this._splash.instanceMatrix.needsUpdate = true;
  scene.add(this._splash);

  // Splash particle state
  this._splashPos = new Float32Array(this._splashCount * 3);
  this._splashVel = new Float32Array(this._splashCount);
  for (i = 0; i < this._splashCount; i++) {
    var spDist = Math.pow(Math.random(), 0.5);
    var spAngle = Math.random() * TWO_PI;
    this._splashPos[i*3]   = Math.cos(spAngle) * spDist * 40;
    this._splashPos[i*3+1] = Math.random() * 3;
    this._splashPos[i*3+2] = Math.sin(spAngle) * spDist * 40;
    this._splashVel[i] = 3 + Math.random() * 5;
  }
};

WeatherParticles.prototype.update = function(dt, camera, settings) {
  var precipType = settings.type || "none";
  var intensity = settings.intensity || 0;
  this._windDir = (settings.windDirection != null ? settings.windDirection : 0) * DEG2RAD;
  this._windStrength = settings.windStrength != null ? settings.windStrength : 0.3;

  // Reposition all particles near player on first real update
  if (!this._cameraInitDone && camera) {
    this._cameraInitDone = true;
    var pm = window.__vibexe_playerMesh__;
    var cx = pm ? pm.position.x : camera.position.x;
    var cy = pm ? pm.position.y : camera.position.y;
    var cz = pm ? pm.position.z : camera.position.z;
    for (var ri = 0; ri < this._rainCount; ri++) {
      this._rainPos[ri*3]   = cx + (Math.random() - 0.5) * 50;
      this._rainPos[ri*3+1] = cy + 3 + Math.random() * 25; // close to player
      this._rainPos[ri*3+2] = cz + (Math.random() - 0.5) * 50;
    }
    for (var si = 0; si < this._snowCount; si++) {
      this._snowPos[si*3]   = cx + (Math.random() - 0.5) * 40;
      this._snowPos[si*3+1] = cy + 3 + Math.random() * 18; // close to player
      this._snowPos[si*3+2] = cz + (Math.random() - 0.5) * 40;
    }
    for (var ski = 0; ski < this._splashCount; ski++) {
      this._splashPos[ski*3]   = cx + (Math.random() - 0.5) * 30;
      this._splashPos[ski*3+1] = cy;
      this._splashPos[ski*3+2] = cz + (Math.random() - 0.5) * 30;
    }
  }

  var showRain = precipType === "rain" && intensity > 0;
  var showSnow = precipType === "snow" && intensity > 0;
  var showSplash = precipType === "rain" && intensity > 0.3;

  this._rain.visible = showRain;
  this._snow.visible = showSnow;
  this._splash.visible = showSplash;

  if (showRain) {
    this._rainMat.opacity = _clamp(intensity * 0.2, 0.05, 0.25);
    this._animateBillboards(this._rain, this._rainPos, this._rainVel, dt, camera, intensity, true);
  }
  if (showSnow) {
    this._snowMat.opacity = _clamp(intensity * 0.35, 0.08, 0.35);
    this._animateBillboards(this._snow, this._snowPos, this._snowVel, dt, camera, intensity, false);
  }
  if (showSplash) {
    this._splashMat.opacity = _clamp(intensity * 0.5, 0.1, 0.45);
    this._animateSplash(dt, camera, intensity);
  }
};

// Animate particle positions and write InstancedMesh matrices each frame.
// Billboard: apply camera quaternion so each quad faces the camera.
// Rain: also tilted along wind direction for streak appearance.
WeatherParticles.prototype._animateBillboards = function(mesh, posArr, velArr, dt, camera, intensity, isRain) {
  var count = mesh.count;
  var activeCount = Math.floor(count * _clamp(intensity, 0, 1));
  var windX = Math.sin(this._windDir) * this._windStrength * (isRain ? 30 : 2);
  var windZ = Math.cos(this._windDir) * this._windStrength * (isRain ? 30 : 2);
  // Use player position if available (particles should fall AROUND the player, not camera)
  var playerMesh = window.__vibexe_playerMesh__;
  var anchorPos = playerMesh ? playerMesh.position : (camera ? camera.position : {x:0, y:0, z:0});
  // Reuse pre-allocated Vector3 instead of creating new object every frame
  var camPos = this._anchorPos;
  camPos.set(anchorPos.x, anchorPos.y, anchorPos.z);
  var spread = isRain ? 50 : 40;
  var ceiling = isRain ? 25 : 18;
  var camQ = camera ? camera.quaternion : this._quat;

  // Compute billboard quaternion once per frame using pre-allocated objects (no new Quaternion/Vector3)
  var billboardQ;
  if (isRain) {
    var tiltAngle = Math.atan2(
      this._windStrength * Math.sin(this._windDir) * 30,
      18 + this._windStrength * Math.cos(this._windDir) * 30
    );
    this._rainTiltQ.setFromAxisAngle(this._tiltAxis, tiltAngle);
    billboardQ = this._quat.copy(camQ).multiply(this._rainTiltQ);
  } else {
    billboardQ = camQ;
  }

  var mtx = this._mtx;
  var pos3 = this._pos3;
  var scl3 = this._scl3;
  var zeroMtx = this._zeroMtx;
  scl3.set(1, 1, 1);

  // Ground level: use player Y - 5 as fallback (skip expensive terrain height lookups)
  var groundY = camPos.y - 5;

  for (var i = 0; i < count; i++) {
    if (i >= activeCount) {
      mesh.setMatrixAt(i, zeroMtx);
      continue;
    }

    // Advance particle position
    posArr[i*3]   += windX * dt;
    posArr[i*3+1] -= velArr[i] * dt;
    posArr[i*3+2] += windZ * dt;

    // Snow: gentle horizontal drift
    if (!isRain) {
      posArr[i*3]   += Math.sin(posArr[i*3+1] * 0.3 + i) * 0.5 * dt;
      posArr[i*3+2] += Math.cos(posArr[i*3+1] * 0.2 + i * 1.3) * 0.5 * dt;
    }

    // Recycle when below ground or too far from anchor
    if (posArr[i*3+1] < groundY) {
      posArr[i*3]   = camPos.x + (Math.random() - 0.5) * spread;
      posArr[i*3+1] = camPos.y + 3 + Math.random() * ceiling;
      posArr[i*3+2] = camPos.z + (Math.random() - 0.5) * spread;
    } else {
      var dx = posArr[i*3] - camPos.x, dz = posArr[i*3+2] - camPos.z;
      if (dx*dx + dz*dz > spread * spread * 1.5) {
        posArr[i*3]   = camPos.x + (Math.random() - 0.5) * spread;
        posArr[i*3+1] = camPos.y + 3 + Math.random() * ceiling;
        posArr[i*3+2] = camPos.z + (Math.random() - 0.5) * spread;
      }
    }

    // Build instance matrix: position + billboard quaternion (same for all)
    pos3.set(posArr[i*3], posArr[i*3+1], posArr[i*3+2]);
    mtx.compose(pos3, billboardQ, scl3);
    mesh.setMatrixAt(i, mtx);
  }
  mesh.instanceMatrix.needsUpdate = true;
};

// Rain splash animation — ground-level particles that burst upward then fall back
WeatherParticles.prototype._animateSplash = function(dt, camera, intensity) {
  var count = this._splashCount;
  var activeCount = Math.floor(count * _clamp(intensity, 0, 1));
  var camPos = camera ? camera.position : this._anchorPos;
  var camQ = camera ? camera.quaternion : this._quat;
  var mtx = this._mtx;
  var pos3 = this._pos3;
  var scl3 = this._scl3;
  var zeroMtx = this._zeroMtx;
  scl3.set(1, 1, 1);

  for (var i = 0; i < count; i++) {
    if (i >= activeCount) {
      this._splash.setMatrixAt(i, zeroMtx);
      continue;
    }
    // Splash rises then falls
    this._splashPos[i*3+1] += this._splashVel[i] * dt;
    this._splashVel[i] -= 15 * dt; // gravity
    // Recycle
    if (this._splashPos[i*3+1] < -0.5 || this._splashVel[i] < -8) {
      this._splashPos[i*3]   = camPos.x + (Math.random() - 0.5) * 50;
      this._splashPos[i*3+1] = 0;
      this._splashPos[i*3+2] = camPos.z + (Math.random() - 0.5) * 50;
      this._splashVel[i] = 3 + Math.random() * 5;
    }
    pos3.set(this._splashPos[i*3], this._splashPos[i*3+1], this._splashPos[i*3+2]);
    mtx.compose(pos3, camQ, scl3);
    this._splash.setMatrixAt(i, mtx);
  }
  this._splash.instanceMatrix.needsUpdate = true;
};

WeatherParticles.prototype.dispose = function(scene) {
  if (this._rain) { scene.remove(this._rain); this._rain.geometry.dispose(); }
  if (this._snow) { scene.remove(this._snow); this._snow.geometry.dispose(); }
  if (this._splash) { scene.remove(this._splash); this._splash.geometry.dispose(); }
  if (this._rainMat) this._rainMat.dispose();
  if (this._snowMat) this._snowMat.dispose();
  if (this._splashMat) this._splashMat.dispose();
};


// ============================================================
// Star Field — Canvas-baked texture on separate dome
// ============================================================
// Stars rendered as round dots on a pre-baked canvas texture applied to a
// dedicated sphere dome. This avoids vertex color triangle interpolation
// artifacts that made vertex highlights look like geometric starbursts.
// WebGPU-safe: MeshBasicMaterial + CanvasTexture, no Points/Sprites.

// Tenkoku Star Catalog — 400 brightest stars extracted from _stardata.txt
// Format: [ra_hours, dec_degrees, magnitude, spectralType, spectralSub, lumClass]
// RA in decimal hours (0-24), Dec in decimal degrees (-90 to +90)
// Spectral: 0=O 1=B 2=A 3=F 4=G 5=K 6=M | LumClass: 1=I 2=II 3=III 4=IV 5=V
var STAR_CATALOG_400 = [
[14.6600,-60.8353,0.01,4,2,5],[18.6156,38.7836,0.03,2,0,5],[14.2610,19.1825,0.04,5,1,1],
[5.2782,45.9978,0.08,4,5,3],[5.2423,-8.2017,0.12,1,8,1],[7.6553,5.2250,0.38,3,5,4],
[1.6288,-57.2367,0.46,1,3,5],[5.9194,7.4069,0.50,6,1,1],[14.0637,-60.3731,0.61,1,1,3],
[6.3992,-52.6958,0.72,3,0,2],[19.8461,8.8683,0.77,2,7,5],[4.5986,16.5092,0.85,5,5,2],
[16.4900,-26.4319,0.96,6,1,1],[13.4198,-11.1614,0.98,1,1,3],[7.7553,28.0261,1.14,5,0,3],
[22.9608,-29.6222,1.16,2,3,5],[12.7954,-59.6886,1.25,1,0,1],[20.6905,45.2806,1.25,2,2,1],
[12.4432,-63.0992,1.33,1,0,1],[14.6601,-60.8353,1.33,5,1,5],[10.1395,11.9672,1.35,1,7,5],
[6.7525,-16.7161,1.46,2,1,5],[6.9771,-28.9722,1.50,1,2,2],[12.5193,-57.1128,1.63,6,3,1],
[17.5603,-37.1036,1.63,1,2,4],[5.4186,6.3497,1.64,1,2,3],[5.4384,28.6078,1.65,1,7,3],
[9.2199,-69.7172,1.68,2,2,4],[5.5860,-1.2019,1.70,1,0,1],[12.4435,-63.0997,1.73,1,1,5],
[22.1372,-46.9608,1.74,1,7,4],[12.9001,55.9597,1.77,2,0,5],[8.1587,-47.3367,1.78,0,0,5],
[3.4054,49.8614,1.79,3,5,1],[11.0621,61.7508,1.79,5,0,3],[7.1394,-26.3931,1.84,3,8,1],
[18.3496,-34.3842,1.85,1,9,1],[8.3752,-59.5097,1.86,5,3,3],[13.7923,49.3133,1.86,1,3,5],
[17.6219,-42.9978,1.87,3,1,2],[5.9927,44.9472,1.90,2,2,4],[16.8115,-69.0275,1.92,5,2,2],
[6.6286,16.3992,1.93,2,0,4],[20.4274,-56.7350,1.94,1,2,4],[8.7454,-54.7083,1.96,2,1,5],
[6.3782,-17.9558,1.98,1,1,2],[7.5766,31.8886,1.98,2,1,5],[9.4597,-8.6594,1.98,5,3,2],
[2.1197,23.4628,2.00,5,2,2],[15.9782,25.9339,2.00,1,0,5],[2.5303,89.2642,2.02,3,7,1],
[18.9210,-26.2967,2.02,1,2,5],[0.7262,-17.9864,2.04,4,9,1],[5.6794,-1.9428,2.05,0,9,1],
[0.1398,29.0906,2.06,1,8,4],[1.1621,35.6206,2.06,6,0,2],[5.7956,-9.6694,2.06,1,0,1],
[14.1116,-36.3697,2.06,5,0,2],[14.8453,74.1556,2.08,5,4,2],[17.5824,12.5603,2.08,2,5,3],
[22.7114,-46.8847,2.10,6,5,3],[3.0862,40.9556,2.12,1,8,5],[11.8178,14.5719,2.14,2,3,5],
[12.6942,-48.9597,2.17,2,1,4],[20.3701,40.2567,2.20,3,8,1],[9.1857,-43.4328,2.21,5,4,1],
[0.6771,56.5372,2.23,5,0,3],[5.5334,-0.2992,2.23,0,9,1],[15.5783,26.7147,2.23,2,0,5],
[17.9434,51.4886,2.23,5,5,3],[8.0597,-40.0033,2.25,0,5,5],[9.2846,-59.2753,2.25,2,8,1],
[2.1195,42.3297,2.26,5,3,2],[0.1529,59.1497,2.27,3,2,3],[13.3988,54.9253,2.27,2,1,5],
[16.8360,-34.2928,2.29,5,2,1],[13.6649,-53.4664,2.30,1,1,3],[14.6986,-47.3881,2.30,1,1,1],
[14.5914,-42.1578,2.31,1,1,5],[15.9809,-22.6217,2.32,1,0,1],[11.0306,56.3825,2.37,2,1,5],
[0.4381,-42.3061,2.39,5,0,3],[21.7360,9.8750,2.39,5,2,1],[17.7081,-39.0297,2.41,1,1,1],
[23.0627,28.0828,2.42,6,2,1],[17.1637,-15.7250,2.43,2,2,5],[11.8972,53.6947,2.44,2,0,5],
[21.3098,62.5856,2.44,2,7,5],[7.4015,-29.3031,2.45,1,5,1],[20.7543,33.9703,2.46,5,0,2],
[0.9452,60.7167,2.47,1,0,4],[23.0790,15.2050,2.49,1,9,5],[9.3683,-55.0100,2.50,1,2,4],
[3.0379,4.0897,2.53,6,1,1],[13.9112,-47.2886,2.55,1,2,1],[11.2353,20.5236,2.56,2,4,5],
[16.6190,-10.5672,2.56,0,9,5],[5.5439,-17.8222,2.58,3,0,1],[12.2936,-17.5419,2.59,1,8,3],
[12.1385,-50.7217,2.60,1,2,4],[19.0431,-29.8803,2.60,2,2,3],[10.3326,19.8417,2.61,5,1,2],
[15.2551,-9.3828,2.61,1,8,5],[5.9927,37.2125,2.62,2,0,5],[16.0520,-19.8050,2.62,1,1,5],
[1.9066,20.8081,2.64,2,5,5],[5.6600,-34.0742,2.64,1,7,4],[12.5569,-23.3964,2.65,4,5,2],
[15.7377,6.4256,2.65,5,2,3],[1.4304,60.2353,2.68,2,5,3],[13.9114,18.3978,2.68,4,0,4],
[14.9749,-43.1339,2.68,1,2,3],[4.9500,33.1661,2.69,5,3,2],[10.7827,-49.4203,2.69,4,5,3],
[12.5191,-69.1353,2.69,1,2,4],[17.5072,-37.2956,2.69,1,2,4],[7.2865,-37.0972,2.70,5,3,1],
[14.7494,27.0742,2.70,5,0,2],[18.3502,-29.8281,2.70,5,3,2],[19.7713,10.6133,2.72,5,3,2],
[16.2349,-3.6944,2.74,6,0,1],[16.3997,61.5142,2.74,4,8,2],[13.3156,-36.7139,2.75,2,2,5],
[14.8473,-16.0422,2.75,2,3,4],[10.7160,-64.3944,2.76,1,0,5],[5.5862,-5.9097,2.77,0,9,3],
[16.5037,21.4897,2.77,4,7,3],[17.7183,4.5672,2.77,5,2,3],[15.5269,-41.1739,2.78,1,2,4],
[5.1339,-5.0864,2.79,2,3,3],[17.5067,52.3014,2.79,4,2,1],[0.4363,-77.2542,2.80,4,2,4],
[12.1943,-58.7489,2.80,1,2,4],[8.1266,-24.3042,2.81,3,6,2],[16.6886,31.6028,2.81,4,0,4],
[18.4665,-25.4214,2.81,5,1,2],[16.5999,-28.2158,2.82,1,0,5],[0.2205,15.1836,2.83,1,2,4],
[13.0366,10.9592,2.83,4,8,3],[5.4181,-20.7594,2.84,4,5,2],[3.9642,31.8836,2.85,1,1,1],
[15.9189,-63.4306,2.85,3,2,3],[17.4218,-55.5289,2.85,5,3,1],[1.9794,-61.5697,2.86,3,0,5],
[22.3112,-60.2603,2.86,5,3,3],[3.7915,24.1133,2.87,1,7,3],[19.8123,45.1314,2.87,1,9,1],
[21.7496,-16.1278,2.87,2,0,5],[6.3829,22.5139,2.88,6,3,3],[7.5766,31.8903,2.88,2,2,5],
[3.9674,40.0103,2.89,1,0,5],[15.3454,-68.6797,2.89,2,1,5],[15.9809,-26.1142,2.89,1,1,5],
[16.3535,-25.5928,2.89,1,1,3],[19.1621,-21.0236,2.89,3,2,2],[7.4520,8.2894,2.90,1,8,5],
[12.9335,38.3183,2.90,2,0,5],[21.5260,-5.5711,2.91,4,0,1],[3.0775,53.5064,2.93,4,8,3],
[6.8338,-50.6147,2.93,5,1,3],[22.6912,30.2214,2.94,4,2,2],[3.9671,-13.5083,2.95,6,0,1],
[12.4949,-16.5156,2.95,1,9,5],[17.5296,-49.8761,2.95,1,2,5],[22.0962,-0.3197,2.96,4,2,1],
[6.7327,25.1311,2.98,4,8,1],[9.7642,23.7742,2.98,4,1,2],[5.0323,43.8231,2.99,3,0,1],
[18.1098,-30.4242,2.99,5,0,3],[19.1026,13.8636,2.99,2,0,5],[2.1697,35.0506,3.00,2,5,3],
[5.6276,21.1425,3.00,1,4,3],[12.1394,-22.6197,3.00,5,2,1],[13.3464,-23.1717,3.00,4,8,2],
[3.7582,47.7878,3.01,1,5,3],[9.7859,-65.0711,3.01,2,6,1],[11.1827,44.4986,3.01,5,1,3],
[21.8988,-37.3644,3.01,1,8,3],[6.3387,-30.0633,3.02,1,2,5],[7.0289,-23.8333,3.02,1,3,1],
[14.5344,38.3083,3.03,2,7,3],[17.7931,-40.1272,3.03,3,2,1],[2.3220,-2.9778,3.04,6,7,3],
[13.8259,-42.4728,3.04,1,2,4],[10.3325,41.4994,3.05,6,0,3],[12.7522,-68.1081,3.05,1,2,5],
[15.3455,71.8339,3.05,2,3,2],[19.2379,67.6611,3.07,4,9,3],[16.8992,-38.0472,3.08,1,1,5],
[19.5120,27.9597,3.08,5,3,2],[20.2945,-14.7814,3.08,3,8,5],[8.9219,5.9456,3.11,4,9,2],
[10.8265,-16.1947,3.11,5,2,3],[18.2935,-36.7617,3.11,6,3,1],[20.5983,-47.2914,3.11,5,0,3],
[5.9282,-35.7686,3.12,5,2,3],[9.3138,34.3950,3.13,5,7,3],[9.5233,-56.9944,3.13,5,5,3],
[11.5954,-63.0189,3.13,1,9,3],[14.9751,-42.1047,3.13,1,2,4],[16.9933,-55.9900,3.13,5,3,3],
[8.9783,48.0444,3.14,2,7,4],[17.2507,24.8392,3.14,2,3,4],[17.2437,36.8092,3.16,5,3,2],
[5.1001,41.2347,3.17,1,3,5],[6.6107,-43.1961,3.17,1,8,3],[9.5469,51.6772,3.17,3,6,4],
[17.1674,65.7147,3.17,1,6,3],[18.7617,-26.9906,3.17,1,8,3],[4.8302,6.9611,3.19,3,6,5],
[5.0799,-22.3711,3.19,5,5,3],[14.6912,-64.9756,3.19,2,0,5],[16.9606,9.3750,3.20,5,2,3],
[21.2168,30.2269,3.20,4,8,2],[17.8465,-37.0433,3.21,5,2,3],[23.6557,77.6325,3.21,5,1,3],
[15.3548,-40.6472,3.22,1,1,1],[20.1881,-0.8214,3.23,1,9,1],[21.4766,70.5608,3.23,1,1,4],
[2.9708,-40.3047,3.24,2,4,3],[3.7870,-74.2389,3.24,6,2,3],[16.3050,-4.6925,3.24,4,9,1],
[19.0249,32.6894,3.24,1,9,3],[7.4864,-43.3017,3.25,5,5,3],[18.3527,-2.8986,3.26,5,0,3],
[0.6555,30.8614,3.27,5,3,3],[4.5669,-55.0450,3.27,2,0,3],[6.7703,-61.9414,3.27,2,7,4],
[14.1063,-26.6817,3.27,5,2,2],[17.3360,-24.9994,3.27,1,2,4],[22.8767,-15.8208,3.27,2,3,5],
[6.2482,22.5067,3.28,6,3,3],[15.0432,-25.2817,3.29,6,3,2],[15.4620,59.0381,3.29,5,2,3],
[1.0576,-46.7186,3.31,4,8,3],[5.2325,-16.2056,3.31,1,9,3],[12.2560,57.0325,3.31,2,3,5],
[10.2862,-70.0389,3.32,1,8,3],[10.4828,-61.6853,3.32,1,4,5],[19.1629,-27.6700,3.32,5,1,2],
[17.1932,-43.2392,3.33,3,3,3],[7.8210,-24.8597,3.34,4,6,1],[11.2349,15.4292,3.34,2,2,5],
[17.4232,-56.3769,3.34,1,1,1],[17.9337,-9.7736,3.34,5,0,3],[4.2448,-62.4739,3.35,4,8,2],
[22.1804,58.2014,3.35,5,1,1],[5.4189,-2.3972,3.36,1,1,5],[6.7316,12.8953,3.36,3,5,3],
[8.5041,60.7181,3.36,4,5,3],[19.4222,3.1147,3.36,3,3,4],[13.5781,-0.5958,3.37,2,3,5],
[15.3964,-44.6892,3.37,1,2,4],[1.9065,63.6706,3.38,1,3,3],[8.8120,6.4189,3.38,4,5,3],
[12.9268,3.3975,3.38,6,3,2],[3.0796,38.8406,3.39,6,4,2],[4.4769,15.8708,3.40,2,7,3],
[10.2497,-61.3322,3.40,5,3,2],[22.6909,10.8308,3.40,1,8,5],[1.4569,-43.3178,3.41,6,0,2],
[1.8574,29.5789,3.41,3,6,4],[13.8259,-41.6878,3.41,1,2,4],[15.2045,-52.0989,3.41,4,8,3],
[15.9814,-38.3972,3.41,1,2,1],[17.7741,27.7206,3.42,4,5,4],[20.7497,-66.2031,3.42,2,7,3],
[20.7360,61.8389,3.43,5,0,4],[0.8149,57.8153,3.44,3,9,5],[9.2255,-58.9669,3.44,1,2,4],
[10.2880,23.4172,3.44,3,0,3],[19.1049,-4.8822,3.44,1,9,5],[1.1432,-10.1822,3.45,5,1,1],
[10.2855,42.9147,3.45,2,2,4],[18.7934,33.3628,3.45,1,8,2],[2.7210,3.2364,3.47,2,3,5],
[4.0112,12.4903,3.47,1,3,5],[7.0501,-27.9342,3.47,5,7,1],[7.9505,-53.0011,3.47,1,3,4],
[15.2586,33.3147,3.47,4,8,3],[19.9987,19.4925,3.47,6,0,2],[11.3071,33.0961,3.48,5,3,2],
[17.2505,14.3903,3.48,6,5,1],[22.7160,24.6011,3.48,4,8,2],[22.8268,-51.3167,3.49,2,3,5],
[1.7343,-15.9375,3.50,4,8,5],[15.0321,40.3906,3.50,4,8,3],[18.4860,-45.9686,3.51,1,3,4],
[18.9804,-21.1064,3.51,5,1,3],[8.2793,9.1858,3.52,5,4,3],[9.6319,9.8922,3.52,3,6,2],
[10.1271,16.7628,3.52,2,0,1],[22.8275,66.2003,3.52,5,0,2],[4.4763,19.1806,3.53,4,9,1],
[7.3351,21.9822,3.53,3,2,4],[15.8694,-3.4303,3.53,2,0,5],[16.7148,38.9222,3.53,4,7,1],
[22.1407,6.1978,3.53,2,2,5],[3.7140,-9.7639,3.54,5,0,4],[5.5334,9.9344,3.54,0,8,3],
[9.9949,-54.5697,3.54,1,5,1],[11.5061,-31.8567,3.54,4,7,3],[17.6218,-15.3986,3.54,3,0,4],
[5.7952,-14.8219,3.55,2,3,5],[14.3073,-46.0578,3.55,1,2,1],[0.3262,-8.8239,3.56,5,1,1],
[2.2939,-51.5119,3.56,1,8,5],[4.3266,-33.7983,3.56,1,9,5],[11.3078,-14.7814,3.56,4,8,3],
[15.3972,-36.2614,3.56,5,5,3],[20.1427,-66.1817,3.56,4,6,1],[1.7137,48.6283,3.57,5,3,2],
[7.7517,24.3981,3.57,4,8,3],[16.8640,-37.9486,3.57,1,2,4],[18.3313,72.7328,3.57,3,7,5],
[20.2459,-12.5447,3.57,4,8,3],[7.2896,16.5403,3.58,2,3,5],[14.5347,30.3714,3.58,5,3,2],
[15.5853,-28.1353,3.58,5,3,3],[12.3521,-60.4011,3.59,5,3,1],[1.3571,-8.1831,3.60,5,0,3],
[3.4529,9.0286,3.60,4,6,3],[5.2796,-6.8444,3.60,1,5,3],[5.7320,-22.4478,3.60,3,6,5],
[6.8680,33.9608,3.60,2,3,3],[9.0626,47.1567,3.60,2,1,5],[9.5397,-40.4667,3.60,3,3,4],
[7.7490,-37.9722,3.61,5,2,1],[10.1688,-12.3542,3.61,5,0,3],[11.8445,1.7647,3.61,3,9,5],
[1.5247,15.3456,3.62,4,7,3],[8.6462,-52.9219,3.62,1,3,4],[13.0636,-71.5489,3.62,5,2,3],
[16.8647,-42.3603,3.62,5,4,3],[17.4604,-60.6836,3.62,1,8,5],[17.7744,-64.7239,3.62,5,2,2],
[23.0383,42.3283,3.62,1,6,3],[2.8322,27.2606,3.63,1,8,5],[3.7916,24.0533,3.63,1,8,3],
[20.5896,14.5953,3.63,3,5,4],[11.7604,-66.7289,3.64,2,7,3],[4.3822,15.6272,3.65,5,0,2],
[12.6942,-1.4494,3.65,3,0,5],[14.0726,64.3758,3.65,2,0,3],[20.9155,-58.4542,3.65,5,1,2],
[0.6553,53.8969,3.66,1,2,4],[15.6153,-29.7778,3.66,1,2,5],[18.1096,-50.0911,3.66,1,2,1],
[23.1575,-21.1725,3.66,5,1,3],[9.5446,63.0619,3.67,3,0,4],[15.7388,15.4219,3.67,2,2,4],
[8.7260,-33.1864,3.68,1,1,1],[12.6942,-1.4494,3.68,3,0,5],[15.4648,29.1058,3.68,3,0,5],
[21.6183,-16.6622,3.68,3,0,5],[3.3284,-21.7578,3.69,6,3,1],[4.8009,5.6047,3.69,1,2,3],
[9.7664,-62.5072,3.69,4,5,1],[23.2866,3.2822,3.69,4,9,2],[1.9790,-51.6089,3.70,4,8,3],
[3.7914,24.1133,3.70,1,6,3],[17.9897,29.2500,3.70,4,8,2],[5.9361,-14.1681,3.71,3,1,3],
[11.7654,47.7797,3.71,5,0,1],[15.8597,4.4781,3.71,2,2,5],[19.8749,6.4078,3.71,4,8,4],
[4.8517,2.4406,3.72,1,3,3],[5.9862,54.2847,3.72,5,0,2],[14.7171,1.8928,3.72,2,0,5],
[21.0779,43.9275,3.72,5,4,1],[21.2483,38.0497,3.72,3,2,4],[1.8571,-10.3350,3.73,5,0,3],
[3.5828,-9.4583,3.73,5,2,5],[7.8858,-40.5822,3.73,5,1,1],[18.1249,9.5639,3.73,2,4,4],
[3.4134,9.7328,3.74,1,9,5],[21.4396,-22.4114,3.74,4,4,1],[22.8766,-7.5792,3.74,6,2,1],
[5.0268,41.0753,3.75,5,4,2],[9.0603,-47.0978,3.75,5,2,3],[16.3652,19.1531,3.75,2,9,3],
[17.8432,2.7072,3.75,2,0,5],[17.8975,56.8722,3.75,5,2,2],[22.4669,58.4222,3.75,3,5,1],
[2.8533,55.8956,3.76,5,3,1],[4.3822,17.5425,3.76,5,0,2],[5.5604,-62.4897,3.76,3,6,1],
[16.8298,-59.0414,3.76,5,5,3],[21.6913,-77.3900,3.76,5,0,3],[22.1169,25.3450,3.76,3,5,5],
[3.7532,42.5786,3.77,3,5,2],[8.4289,-66.1369,3.77,5,1,3],[19.0781,-21.7417,3.77,4,9,3],
[19.2851,53.3686,3.77,4,9,3],[20.6606,15.9119,3.77,1,9,4],[20.7946,-9.4958,3.77,2,1,5],
[22.5215,50.2825,3.77,2,1,5],[7.1458,-70.4989,3.78,5,0,3],[10.8916,-58.8533,3.78,5,1,3],
[7.0685,20.5703,3.79,3,7,5]
];

// Tenkoku spectral colors (0-255 sRGB for canvas) — derived from ParticleStarfieldHandler.cs
// Then blended 50% toward [128,153,255] (Tenkoku baseLerpColor)
var SPECTRAL_COLORS_255 = [
  [155, 185, 255],  // 0=O  Blue
  [195, 210, 255],  // 1=B  Blue-white
  [225, 235, 255],  // 2=A  White
  [253, 255, 245],  // 3=F  Yellow-white
  [255, 250, 200],  // 4=G  Yellow
  [255, 215, 155],  // 5=K  Orange
  [255, 80, 60]     // 6=M  Red
];

function StarField() {
  this._dome = null;
  this._geo = null;
  this._mat = null;
  this._tex = null;
  this._canvas = null;
  this._starData = null; // cached star positions for twinkle
}

StarField.prototype._generateStarTexture = function() {
  var W = 2048, H = 1024;
  var canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext("2d");

  // Black background (transparent won't work with additive blending on dark sky)
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, W, H);

  var stars = [];

  // --- Layer 1: 400 real catalog stars at correct RA/Dec positions ---
  // RA/Dec -> equirectangular UV:
  //   u = ra / 24  (0-1)
  //   v = 0.5 - dec / 180  (0=north pole, 0.5=equator, 1=south pole)
  // Only render stars above ~-5 deg declination equivalent on sphere
  // (v < 0.53 = upper hemisphere + slight below equator for horizon stars)
  for (var i = 0; i < STAR_CATALOG_400.length; i++) {
    var entry = STAR_CATALOG_400[i];
    var ra = entry[0], dec = entry[1], mag = entry[2];
    var specType = entry[3], specSub = entry[4], lumClass = entry[5];

    // RA/Dec to equirectangular pixel coordinates
    var u = ra / 24.0;
    var v = 0.5 - (dec / 180.0);

    // Render ALL catalog stars across full sphere — latitude rotation handles visibility
    // Stars below equator (v > 0.5) visible from southern latitudes
    if (v < 0.0) v += 1.0;
    if (v > 1.0) v -= 1.0;

    var sx = u * W;
    var sy = v * H;

    // Magnitude to visual size (Tenkoku formula adapted)
    // mag range 0-4: bigger = brighter
    var magNorm = _clamp(mag / 4.0, 0, 1);
    var radius = _lerp(2.0, 0.6, magNorm);
    var brightness = _lerp(1.0, 0.4, magNorm);

    // Luminosity class modifiers (from Tenkoku ParticleStarfieldHandler.cs)
    if (lumClass === 1) { radius *= 1.2; brightness = Math.min(brightness * 1.5, 1.0); }
    else if (lumClass === 2) { radius *= 1.1; brightness = Math.min(brightness * 1.3, 1.0); }
    else if (lumClass === 3) { brightness = Math.min(brightness * 1.15, 1.0); }

    // Get spectral color with sub-type interpolation
    var col = SPECTRAL_COLORS_255[specType];
    if (specType < 6 && specSub > 0) {
      var nextCol = SPECTRAL_COLORS_255[specType + 1];
      var t = specSub / 9.0;
      col = [
        Math.round(col[0] + (nextCol[0] - col[0]) * t),
        Math.round(col[1] + (nextCol[1] - col[1]) * t),
        Math.round(col[2] + (nextCol[2] - col[2]) * t)
      ];
    }

    // Draw star with glow
    var glowR = radius * 2.5;
    if (mag < 1.5) {
      // Very bright stars get larger glow
      glowR = radius * 3.5;
      var grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      grad.addColorStop(0, "rgba(255,255,255," + brightness + ")");
      grad.addColorStop(0.2, "rgba(255,255,255," + (brightness * 0.6) + ")");
      grad.addColorStop(0.5, "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + (brightness * 0.15) + ")");
      grad.addColorStop(1, "rgba(" + col[0] + "," + col[1] + "," + col[2] + ",0)");
      ctx.fillStyle = grad;
      ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
    } else if (mag < 2.5) {
      // Medium-bright stars
      var grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      grad.addColorStop(0, "rgba(255,255,255," + brightness + ")");
      grad.addColorStop(0.3, "rgba(255,255,255," + (brightness * 0.4) + ")");
      grad.addColorStop(0.7, "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + (brightness * 0.08) + ")");
      grad.addColorStop(1, "rgba(" + col[0] + "," + col[1] + "," + col[2] + ",0)");
      ctx.fillStyle = grad;
      ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
    } else {
      // Fainter catalog stars — small tight dot
      var grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      grad.addColorStop(0, "rgba(255,255,255," + brightness + ")");
      grad.addColorStop(0.4, "rgba(255,255,255," + (brightness * 0.25) + ")");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
    }
    stars.push({ x: sx, y: sy, r: radius, brightness: brightness });
  }

  // --- Layer 2: 10000 random stars with galactic plane clustering + magnitude tiers ---
  // Cover FULL sphere — latitude rotation handles visibility
  var typeWeights = [0.02, 0.04, 0.08, 0.14, 0.22, 0.25, 0.25];

  // Galactic plane: tilted ~62.9° from celestial equator, centered at ~y=0.45 on texture
  var galacticCenterY = 0.45;
  var galacticWidth = 20.0 / 180.0; // ~20° band mapped to 0-1 range

  // Pre-compute cluster seeds along galactic plane (Phase G.3)
  var clusterSeeds = [];
  for (var cs = 0; cs < 18; cs++) {
    clusterSeeds.push({
      x: Math.random() * W,
      y: (galacticCenterY + (Math.random() - 0.5) * galacticWidth * 0.8) * H,
      count: 30 + Math.floor(Math.random() * 25),
      spread: 8 + Math.random() * 12,
    });
  }

  for (var i = 0; i < 10000; i++) {
    var sx, sy;
    // Galactic plane density bias: 3x density within galactic band (Phase G.1)
    if (Math.random() < 0.35) {
      // Place near galactic plane
      sx = Math.random() * W;
      sy = (galacticCenterY + (Math.random() - 0.5) * galacticWidth) * H;
    } else {
      sx = Math.random() * W;
      sy = Math.random() * H;
    }

    // 3-tier magnitude bins (Phase G.2)
    var magRoll = Math.random();
    var radius, brightness;
    if (magRoll < 0.05) {
      // Bright 5%: r=1.2-1.8, bright
      radius = 1.2 + Math.random() * 0.6;
      brightness = 0.75 + Math.random() * 0.20;
    } else if (magRoll < 0.25) {
      // Medium 20%: r=0.6-1.0
      radius = 0.6 + Math.random() * 0.4;
      brightness = 0.45 + Math.random() * 0.35;
    } else {
      // Faint 75%: r=0.3-0.5
      radius = 0.3 + Math.random() * 0.2;
      brightness = 0.20 + Math.random() * 0.25;
    }

    // Spectral color tints (Tenkoku Ref 1: blue, white, orange stars visible)
    var starColors = [
      [155,175,255], // O — hot blue
      [170,190,255], // B — blue-white
      [210,220,255], // A — white
      [255,245,230], // F — warm white
      [255,230,180], // G — yellow (Sun-like)
      [255,190,130], // K — orange
      [255,120,80],  // M — red
    ];
    var rnd = Math.random(), cumul = 0, colorIdx = 6;
    for (var ci = 0; ci < typeWeights.length; ci++) {
      cumul += typeWeights[ci]; if (rnd < cumul) { colorIdx = ci; break; }
    }
    var sc = starColors[colorIdx];
    // Only apply strong tint to bright stars; faint stars stay near-white
    var tintStr = magRoll < 0.25 ? 1.0 : 0.3; // bright/medium get full tint, faint get subtle
    var sR = Math.round(_lerp(255, sc[0], tintStr));
    var sG = Math.round(_lerp(255, sc[1], tintStr));
    var sB = Math.round(_lerp(255, sc[2], tintStr));
    var glowR3 = radius * 1.3;
    var grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR3);
    grad.addColorStop(0, "rgba(" + sR + "," + sG + "," + sB + "," + brightness + ")");
    grad.addColorStop(0.5, "rgba(" + sR + "," + sG + "," + sB + "," + (brightness * 0.12) + ")");
    grad.addColorStop(1, "rgba(" + sR + "," + sG + "," + sB + ",0)");
    ctx.fillStyle = grad;
    ctx.fillRect(sx - glowR3, sy - glowR3, glowR3 * 2, glowR3 * 2);
    stars.push({ x: sx, y: sy, r: radius, brightness: brightness });
  }

  // Cluster extra stars at seed positions (Phase G.3)
  for (var ci2 = 0; ci2 < clusterSeeds.length; ci2++) {
    var seed = clusterSeeds[ci2];
    for (var cj = 0; cj < seed.count; cj++) {
      var csx = seed.x + (Math.random() - 0.5) * seed.spread * 2;
      var csy = seed.y + (Math.random() - 0.5) * seed.spread * 2;
      if (csx < 0) csx += W; if (csx >= W) csx -= W;
      if (csy < 0 || csy >= H) continue;
      var cr = 0.25 + Math.random() * 0.35;
      var cb = 0.20 + Math.random() * 0.30;
      var cgr = cr * 1.2;
      var cgrad = ctx.createRadialGradient(csx, csy, 0, csx, csy, cgr);
      cgrad.addColorStop(0, "rgba(255,255,255," + cb + ")");
      cgrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cgrad;
      ctx.fillRect(csx - cgr, csy - cgr, cgr * 2, cgr * 2);
      stars.push({ x: csx, y: csy, r: cr, brightness: cb });
    }
  }

  this._canvas = canvas;
  this._starData = stars;
  return canvas;
};

StarField.prototype.init = function(scene) {
  if (this._dome) return;

  // Cache star texture globally so it survives SWA reinit (Scene↔Game mode switch)
  // Force regeneration for v2 star clustering + magnitude tiers (Phase G.4)
  if (!__swa_texCache.starCanvas || !__swa_texCache._starV3) {
    __swa_texCache.starCanvas = this._generateStarTexture();
    __swa_texCache._starV3 = true;
  }
  var canvas = __swa_texCache.starCanvas;
  this._canvas = canvas;
  this._tex = new THREE.CanvasTexture(canvas);
  this._tex.colorSpace = THREE.SRGBColorSpace;

  this._geo = new THREE.SphereGeometry(495, 64, 32);
  this._geo.name = "__swa_star_dome_geo__";
  // Invert winding so we see inside faces
  _invertWinding(this._geo);

  this._mat = new THREE.MeshBasicMaterial({
    map: this._tex,
    side: THREE.FrontSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true, // Enable so terrain occludes stars (fixes bleed-through)
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  this._mat.name = "__swa_star_dome_mat__";

  this._dome = new THREE.Mesh(this._geo, this._mat);
  this._dome.name = "__swa_star_dome__";
  this._dome.renderOrder = -999.5; // between sky dome (-1000) and cloud dome (-999)
  this._dome.frustumCulled = false;
  this._dome.visible = false;
  scene.add(this._dome);

  console.log("[SkyWeatherAdvanced] Stars rendered via canvas-baked dome texture (WebGPU-safe)");
};

StarField.prototype.update = function(sunAltDeg, camera, time, settings, solarTime, latitude) {
  if (!this._dome) return;

  var starIntensity = settings.starIntensity != null ? settings.starIntensity : 1.0;

  // Night visibility: bright stars appear at -3° (civil twilight), full sky by -12°
  var nightFac = sunAltDeg < -12 ? 1 : (sunAltDeg < -3 ? _smoothstep(-3, -12, sunAltDeg) : 0);

  var visible = nightFac > 0.01 && starIntensity > 0.01;
  this._dome.visible = visible;

  if (visible && camera) {
    this._dome.position.copy(camera.position);
    // Latitude rotation: tilt the celestial sphere to match observer's latitude
    // At equator (lat=0): no tilt. At north pole (lat=90): north celestial pole at zenith.
    var lat = (latitude != null ? latitude : 45) * DEG2RAD;
    this._dome.rotation.set(0, 0, 0); // reset
    this._dome.rotation.x = (PI / 2 - lat); // tilt by co-latitude
    // Sidereal rotation around the celestial pole axis (local Y after tilt)
    this._dome.rotateY(solarTime * TWO_PI);
    // Full opacity at night — the canvas texture already has correct alpha per star
    this._mat.opacity = nightFac * starIntensity;
  }
};

StarField.prototype.dispose = function(scene) {
  if (this._dome && this._dome.parent) this._dome.parent.remove(this._dome);
  if (this._geo) this._geo.dispose();
  if (this._tex) this._tex.dispose();
  if (this._mat) this._mat.dispose();
  this._dome = null;
  this._canvas = null;
  this._starData = null;
};


// ============================================================
// Shooting Stars (Meteors) — Occasional bright streaks at night
// ============================================================

function ShootingStarsRenderer() {
  this._meteors = [];
  this._scene = null;
  this._spawnTimer = 0;
  this._spawnRate = 1.0; // scale 0-2
}

ShootingStarsRenderer.prototype.init = function(scene) {
  this._scene = scene;
};

ShootingStarsRenderer.prototype._spawn = function(camera) {
  if (!camera || !this._scene) return;

  // Random start position on upper hemisphere at radius 450
  var theta = Math.random() * TWO_PI;
  var phi = Math.random() * PI * 0.4 + 0.1; // 6°-78° above horizon
  var r = 450;
  var startX = camera.position.x + r * Math.sin(phi) * Math.cos(theta);
  var startY = camera.position.y + r * Math.cos(phi);
  var startZ = camera.position.z + r * Math.sin(phi) * Math.sin(theta);

  // Random direction — mostly downward and sideways
  var dTheta = theta + (Math.random() - 0.5) * 1.5;
  var speed = 300 + Math.random() * 200;
  var dx = Math.cos(dTheta) * speed;
  var dy = -(0.5 + Math.random() * 0.5) * speed;
  var dz = Math.sin(dTheta) * speed;

  // Trail: 4 line segments
  var segCount = 4;
  var positions = new Float32Array((segCount + 1) * 3);
  var colors = new Float32Array((segCount + 1) * 3);

  // All points start at the spawn position
  for (var i = 0; i <= segCount; i++) {
    positions[i * 3]     = startX;
    positions[i * 3 + 1] = startY;
    positions[i * 3 + 2] = startZ;
    // Bright white head fading to transparent tail
    var fade = 1.0 - (i / segCount);
    colors[i * 3]     = fade;
    colors[i * 3 + 1] = fade;
    colors[i * 3 + 2] = fade * 0.9;
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  var mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    linewidth: 2,
  });

  var line = new THREE.Line(geo, mat);
  line.name = "__swa_meteor__";
  line.frustumCulled = false;
  this._scene.add(line);

  var maxLife = 0.3 + Math.random() * 0.5; // 0.3-0.8 seconds
  this._meteors.push({
    mesh: line,
    geo: geo,
    mat: mat,
    life: 0,
    maxLife: maxLife,
    startX: startX,
    startY: startY,
    startZ: startZ,
    dx: dx,
    dy: dy,
    dz: dz,
    segCount: segCount,
  });
};

ShootingStarsRenderer.prototype.update = function(dt, camera, sunAltDeg, settings) {
  this._spawnRate = (settings.shootingStars != null) ? settings.shootingStars : 0;

  // Only spawn at night (sun altitude < -6°)
  var isNight = sunAltDeg < -6;

  // Spawn new meteors
  if (isNight && this._spawnRate > 0.01) {
    this._spawnTimer += dt;
    // Average interval: 4 seconds at rate=1, 2 seconds at rate=2
    var interval = 4.0 / Math.max(0.01, this._spawnRate);
    // Add some randomness
    if (this._spawnTimer >= interval * (0.5 + Math.random())) {
      this._spawnTimer = 0;
      this._spawn(camera);
    }
  }

  // Update existing meteors
  for (var i = this._meteors.length - 1; i >= 0; i--) {
    var m = this._meteors[i];
    m.life += dt;

    var t = m.life / m.maxLife;
    if (t >= 1.0) {
      // Remove
      this._scene.remove(m.mesh);
      m.geo.dispose();
      m.mat.dispose();
      this._meteors.splice(i, 1);
      continue;
    }

    // Update trail positions — head moves forward, tail segments follow
    var posAttr = m.geo.getAttribute("position");
    var arr = posAttr.array;
    var sc = m.segCount;

    // Shift tail segments backward (oldest last)
    for (var s = sc; s > 0; s--) {
      arr[s * 3]     = arr[(s - 1) * 3];
      arr[s * 3 + 1] = arr[(s - 1) * 3 + 1];
      arr[s * 3 + 2] = arr[(s - 1) * 3 + 2];
    }

    // Move head
    arr[0] = m.startX + m.dx * m.life;
    arr[1] = m.startY + m.dy * m.life;
    arr[2] = m.startZ + m.dz * m.life;
    posAttr.needsUpdate = true;

    // Fade out over lifetime
    m.mat.opacity = 1.0 - t * t;
  }
};

ShootingStarsRenderer.prototype.dispose = function(scene) {
  for (var i = 0; i < this._meteors.length; i++) {
    scene.remove(this._meteors[i].mesh);
    this._meteors[i].geo.dispose();
    this._meteors[i].mat.dispose();
  }
  this._meteors = [];
};


// ============================================================
// Rainbow Renderer — Arc visible after rain when sun is low
// ============================================================

function RainbowRenderer() {
  this._mesh = null;
  this._geo = null;
  this._mat = null;
  this._opacity = 0;
  this._targetOpacity = 0;
  this._precipWasActive = false;
  this._precipEndTime = 0;
}

RainbowRenderer.prototype.build = function(scene) {
  if (this._mesh) return;

  // Create rainbow gradient texture via Canvas2D
  var texW = 256, texH = 64;
  var canvas = document.createElement("canvas");
  canvas.width = texW; canvas.height = texH;
  var ctx = canvas.getContext("2d");

  // ROYGBIV vertical gradient with soft alpha edges
  var grad = ctx.createLinearGradient(0, 0, 0, texH);
  grad.addColorStop(0.0,  "rgba(255,0,0,0)");
  grad.addColorStop(0.08, "rgba(255,0,0,0.6)");
  grad.addColorStop(0.18, "rgba(255,127,0,0.7)");
  grad.addColorStop(0.30, "rgba(255,255,0,0.7)");
  grad.addColorStop(0.42, "rgba(0,200,0,0.7)");
  grad.addColorStop(0.55, "rgba(0,130,255,0.7)");
  grad.addColorStop(0.68, "rgba(75,0,130,0.6)");
  grad.addColorStop(0.80, "rgba(148,0,211,0.5)");
  grad.addColorStop(0.92, "rgba(148,0,211,0)");
  grad.addColorStop(1.0,  "rgba(148,0,211,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, texW, texH);

  var rainbowTex = new THREE.CanvasTexture(canvas);
  rainbowTex.wrapS = THREE.RepeatWrapping;

  // Torus geometry for the arc — only upper half visible
  // innerRadius=180, outerRadius differs by tube thickness
  this._geo = new THREE.TorusGeometry(200, 12, 16, 64, PI);
  this._geo.name = "__swa_rainbow_geo__";

  this._mat = new THREE.MeshBasicMaterial({
    map: rainbowTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  });
  this._mat.name = "__swa_rainbow_mat__";

  this._mesh = new THREE.Mesh(this._geo, this._mat);
  this._mesh.name = "__swa_rainbow__";
  this._mesh.renderOrder = -996;
  this._mesh.frustumCulled = false;
  this._mesh.visible = false;
  scene.add(this._mesh);
};

RainbowRenderer.prototype.update = function(dt, camera, sunDir, sunAltDeg, precipSettings, settings) {
  if (!this._mesh) return;

  var rainbowScale = (settings.rainbow != null) ? settings.rainbow : 0;
  var precipActive = precipSettings && precipSettings.type === "rain" && (precipSettings.intensity || 0) > 0.1;

  // Track precipitation end time
  if (precipActive) {
    this._precipWasActive = true;
    this._precipEndTime = Date.now();
  }

  // Rainbow visible when: recently rained (within 30s) AND sun is 10-42°
  var timeSincePrecip = (Date.now() - this._precipEndTime) / 1000;
  var recentlyRained = this._precipWasActive && timeSincePrecip < 30 && !precipActive;
  var sunInRange = sunAltDeg >= 10 && sunAltDeg <= 42;

  this._targetOpacity = (recentlyRained && sunInRange && rainbowScale > 0.01) ?
    rainbowScale * 0.5 * (1.0 - timeSincePrecip / 30) : 0;

  // Fade in/out over 5 seconds
  var fadeSpeed = 1.0 / 5.0; // per second
  if (this._opacity < this._targetOpacity) {
    this._opacity = Math.min(this._opacity + fadeSpeed * dt, this._targetOpacity);
  } else {
    this._opacity = Math.max(this._opacity - fadeSpeed * dt, this._targetOpacity);
  }

  this._mesh.visible = this._opacity > 0.01;
  if (!this._mesh.visible) return;

  this._mat.opacity = this._opacity;

  // Position: opposite to sun direction, elevated 20° above horizon
  if (camera) {
    var dist = 400;
    // Rainbow appears opposite the sun
    var antiSunX = -sunDir.x;
    var antiSunZ = -sunDir.z;
    var len = Math.sqrt(antiSunX * antiSunX + antiSunZ * antiSunZ) || 1;
    antiSunX /= len;
    antiSunZ /= len;

    this._mesh.position.set(
      camera.position.x + antiSunX * dist,
      camera.position.y + 60,
      camera.position.z + antiSunZ * dist
    );

    // Face the camera
    this._mesh.lookAt(camera.position);
    // Tilt the arc so it forms an upward arch
    this._mesh.rotation.z = 0;
  }

  // Clear precipWasActive after 30 seconds to reset rainbow state
  if (timeSincePrecip > 30) {
    this._precipWasActive = false;
  }
};

RainbowRenderer.prototype.dispose = function(scene) {
  if (this._mesh && this._mesh.parent) this._mesh.parent.remove(this._mesh);
  if (this._geo) this._geo.dispose();
  if (this._mat) this._mat.dispose();
  this._mesh = null;
};


// ============================================================
// Cloud System — Canvas2D procedural noise on a textured dome
// ============================================================
// Renders 3 cloud layers (cumulus/altocumulus/cirrostratus) as
// white-on-transparent noise onto an offscreen canvas, applied
// as a CanvasTexture on a hemisphere MeshBasicMaterial.

function CloudSystem() {
  this._dome = null;
  this._geo = null;
  this._mat = null;
  this._tex = null;
  this._canvas = null;
  this._ctx = null;
  this._sunDir = [0, 1, 0];
  this._coverage = 0.5;
  this._speed = 1.0;
  this._brightness = 1.0;
  this._density = 0.85;
  this._scale = 3.0;
  this._time = 0;
  this._CW = 512;
  this._CH = 256;
  this._blurBuf = null; // cached blur buffer to avoid GC pressure
  this._imgData = null; // cached ImageData to avoid allocation per update
  this._moonDir = [0, -1, 0]; // moon direction for night cloud lighting
  this._moonPhase = 0.5;      // 0=new, 0.5=full
}

// 2D hash — returns 0..1
CloudSystem.prototype._hash2 = function(x, y) {
  var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

// 2D value noise with smoothstep interpolation
CloudSystem.prototype._noise2 = function(x, y) {
  var ix = Math.floor(x), iy = Math.floor(y);
  var fx = x - ix, fy = y - iy;
  var ux = fx * fx * (3 - 2 * fx);
  var uy = fy * fy * (3 - 2 * fy);
  var h = this._hash2;
  var n00 = h(ix, iy), n10 = h(ix + 1, iy);
  var n01 = h(ix, iy + 1), n11 = h(ix + 1, iy + 1);
  var nx0 = n00 + (n10 - n00) * ux;
  var nx1 = n01 + (n11 - n01) * ux;
  return nx0 + (nx1 - nx0) * uy;
};

// 2D fBm — 4 octaves (was 5, octave 5 adds sub-pixel detail invisible on dome)
CloudSystem.prototype._fbm2 = function(x, y) {
  var val = 0, amp = 0.5, freq = 1.0;
  for (var i = 0; i < 4; i++) {
    val += amp * this._noise2(x * freq, y * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return val;
};

// 2D Worley (cellular) noise — cheap 2x2 check (4 cells, not 9) for rounded puff shapes
CloudSystem.prototype._worley2 = function(x, y) {
  var ix = Math.floor(x), iy = Math.floor(y);
  var fx = x - ix, fy = y - iy;
  var minDist = 999;
  // Check only 4 nearest cells (current + 3 neighbors based on fractional position)
  var sx = fx > 0.5 ? 1 : -1, sy = fy > 0.5 ? 1 : -1;
  var cx, cy, ddx, ddy, d;
  cx = ix + this._hash2(ix, iy); cy = iy + this._hash2(iy + 7, ix + 13);
  ddx = x - cx; ddy = y - cy; d = ddx*ddx + ddy*ddy; if (d < minDist) minDist = d;
  cx = ix+sx + this._hash2(ix+sx, iy); cy = iy + this._hash2(iy + 7, ix+sx + 13);
  ddx = x - cx; ddy = y - cy; d = ddx*ddx + ddy*ddy; if (d < minDist) minDist = d;
  cx = ix + this._hash2(ix, iy+sy); cy = iy+sy + this._hash2(iy+sy + 7, ix + 13);
  ddx = x - cx; ddy = y - cy; d = ddx*ddx + ddy*ddy; if (d < minDist) minDist = d;
  cx = ix+sx + this._hash2(ix+sx, iy+sy); cy = iy+sy + this._hash2(iy+sy + 7, ix+sx + 13);
  ddx = x - cx; ddy = y - cy; d = ddx*ddx + ddy*ddy; if (d < minDist) minDist = d;
  return Math.sqrt(minDist);
};

// Cheap domain warping — single noise lookup to break tile regularity (full fbm was too expensive)
// Reusable 2-element array to avoid ~295k allocations per cloud texture update
CloudSystem.prototype._warpResult = [0, 0];
CloudSystem.prototype._domainWarp = function(x, y) {
  var ox = this._noise2(x * 0.3 + 100, y * 0.3 + 200) * 1.8;
  var oy = this._noise2(x * 0.3 + 300, y * 0.3 + 400) * 1.8;
  this._warpResult[0] = x + ox;
  this._warpResult[1] = y + oy;
  return this._warpResult;
};

CloudSystem.prototype.build = function(scene) {
  if (this._dome) return;

  // Offscreen canvas for cloud texture
  this._canvas = document.createElement("canvas");
  this._canvas.width = this._CW;
  this._canvas.height = this._CH;
  this._ctx = this._canvas.getContext("2d");

  this._tex = new THREE.CanvasTexture(this._canvas);
  this._tex.wrapS = THREE.RepeatWrapping;
  this._tex.wrapT = THREE.ClampToEdgeWrapping;
  this._tex.colorSpace = "srgb";

  // Upper hemisphere dome — inverted winding + FrontSide (WebGPU compat)
  this._geo = new THREE.SphereGeometry(490, 64, 32, 0, TWO_PI, 0, PI * 0.5);
  this._geo.name = "__swa_cloud_geo__";
  _invertWinding(this._geo);

  this._mat = new THREE.MeshBasicMaterial({
    map: this._tex,
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
  });
  this._mat.name = "__swa_cloud_mat__";

  this._dome = new THREE.Mesh(this._geo, this._mat);
  this._dome.name = "__swa_cloud_dome__";
  this._dome.renderOrder = -999;
  this._dome.frustumCulled = false;
  scene.add(this._dome);
};

CloudSystem.prototype.updateTexture = function(atmosphere) {
  if (!this._ctx) return;
  var ctx = this._ctx;
  var W = this._CW, H = this._CH;
  var coverage = this._coverage;
  var density = this._density;
  var brightness = this._brightness;
  var scale = this._scale;
  var t = this._time * this._speed;
  var sunY = this._sunDir[1];
  var sunX = this._sunDir[0];

  // Clear to fully transparent
  ctx.clearRect(0, 0, W, H);

  if (coverage <= 0.01) {
    if (this._tex) this._tex.needsUpdate = true;
    if (this._dome) this._dome.visible = false;
    return;
  }

  var imgData = ctx.createImageData(W, H);
  var pix = imgData.data;
  var hasCloud = false;

  // Cloud base color from sun altitude
  var baseR, baseG, baseB;
  if (sunY > 0.1) {
    // Daytime: white clouds
    baseR = 245; baseG = 245; baseB = 250;
  } else if (sunY > -0.05) {
    // Sunset/sunrise: orange-pink
    var st = _smoothstep(-0.05, 0.1, sunY);
    baseR = Math.round(_lerp(255, 245, st));
    baseG = Math.round(_lerp(160, 245, st));
    baseB = Math.round(_lerp(120, 250, st));
  } else {
    // Night: subtle dark blue-grey (visible against starfield but not overpowering)
    baseR = 35; baseG = 38; baseB = 52;
  }

  // Light direction — use moon at night for cloud edge lighting
  var lightX = sunX, lightZ = this._sunDir[2];
  var isNightCloud = sunY < -0.05;
  if (isNightCloud) {
    lightX = this._moonDir[0]; lightZ = this._moonDir[2];
  }
  var sunAngle = Math.atan2(lightZ, lightX);

  for (var py = 0; py < H; py++) {
    // v = 0 at top (zenith), 1 at bottom (horizon)
    var v = py / H;

    // Altitude-based fade: clouds thin out near zenith and near horizon edge
    var altFade = _smoothstep(0.0, 0.08, v) * _smoothstep(1.0, 0.8, v);

    for (var px = 0; px < W; px++) {
      var u = px / W;
      var idx = (py * W + px) * 4;

      // Map canvas coords to noise space (u wraps horizontally like longitude)
      var nx = u * scale * 4.0;
      var ny = v * scale * 2.0;

      // Wind scroll offset
      var windX = t * 0.03;
      var windY = t * 0.008;

      // Layer 1: Cumulus — billowy 3D puffs via domain-warped fBm minus Worley (Tenkoku: distinct puffs)
      // coverage=0 → nearly empty, 0.35 → scattered patches, 0.7 → mostly covered, 1.0 → full
      var warpedCumulus = this._domainWarp(nx * 0.5 + windX, ny * 0.5 + windY);
      var n1 = this._fbm2(warpedCumulus[0], warpedCumulus[1]);
      var w1 = this._worley2(nx * 0.5 + windX, ny * 0.5 + windY);
      var c1 = _clamp(n1 - w1 * 0.45 + coverage * 2.2 - 1.0, 0, 1);
      c1 = Math.pow(c1, 3.5); // 3.5 power for distinct separated puffs
      // Altitude scatter: offset the fade band per-column so clouds appear at varying heights
      var altOffset = this._noise2(u * 3.0 + 77, 0.5) * 0.12; // ±0.12 altitude variation
      var fade1 = _smoothstep(0.04 + altOffset, 0.16 + altOffset, v) * _smoothstep(0.75, 0.30, v);
      c1 *= fade1;

      // Layer 2: Altocumulus — medium scattered patches
      var n2 = this._fbm2(nx * 1.3 + windX * 1.2 + 50, ny * 1.3 + windY * 0.8 + 50);
      var c2 = _clamp(n2 + coverage * 1.5 - 0.8, 0, 1) * 0.35;
      var fade2 = _smoothstep(0.08, 0.22, v) * _smoothstep(0.90, 0.4, v);
      c2 *= fade2;

      // Layer 3: Cirrus — thin wispy horizontal streaks (12x stretch for better wispy look)
      var n3 = this._fbm2(nx * 12.0 + windX * 0.3 + 120, ny * 0.4 + windY * 0.15 + 120);
      var c3 = _clamp(n3 + coverage * 0.9 - 0.5, 0, 1) * 0.18;
      var fade3 = _smoothstep(0.0, 0.04, v) * _smoothstep(0.40, 0.10, v);
      c3 *= fade3;

      // Layer 4: Overcast — uniform flat layer at high coverage (Tenkoku: 4th pass)
      var c4 = 0;
      if (coverage > 0.6) {
        var n4 = this._fbm2(nx * 2.0 + windX * 0.5 + 200, ny * 1.5 + windY * 0.3 + 200);
        // Smoother overcast but with subtle wispy detail (Tenkoku Ref 2/6: not totally flat)
        var noiseAmp = _lerp(0.45, 0.20, _clamp((coverage - 0.6) * 2.5, 0, 1));
        c4 = _clamp((coverage - 0.6) * 2.5 * (0.5 + n4 * noiseAmp), 0, 0.7);
        // Add wispy cirrus-like detail on top of overcast layer
        var wipsy = this._noise2(nx * 5.0 + windX * 0.2 + 500, ny * 2.0 + windY * 0.1 + 500);
        c4 += wipsy * 0.08 * _clamp((coverage - 0.7) * 3.3, 0, 1);
      }

      // Front-to-back layer compositing with Beer transmission (Tenkoku cloud_sphere.shader)
      // Overcast (farthest) → Cirrus → Altocumulus → Cumulus (closest to camera)
      var t4 = Math.exp(-c4 * 2.0); // overcast transmission
      var t3 = Math.exp(-c3 * 3.0); // cirrus transmission
      var t2 = Math.exp(-c2 * 2.5); // altocumulus transmission
      var t1 = Math.exp(-c1 * 2.0); // cumulus transmission
      var d = _clamp((1 - t1 * t2 * t3 * t4) * density, 0, 1);
      if (d < 0.01) continue;

      hasCloud = true;

      // Sun-facing brightness gradient — stronger contrast for realistic look
      var pixAngle = u * TWO_PI;
      var sunDot = Math.cos(pixAngle - sunAngle) * 0.5 + 0.5;
      // Beer-Powder + Henyey-Greenstein cloud lighting (ported from Tenkoku_cloud_sphere.shader)
      // Beer's law extinction: exp(-extinct * depth) — dark cloud interiors
      var optDepth = d * 8.0; // increased from 6.0 for more contrast
      var extinctCoeff = 1.5; // increased from 1.2 for deeper shadows
      var beer = Math.exp(-extinctCoeff * optDepth);
      // Beer-Powder: silver lining effect on thin cloud edges facing the sun
      var beerPowder = beer * (1 - Math.exp(-extinctCoeff * 0.75 * optDepth));
      // Henyey-Greenstein phase function (Tenkoku: g=0.55 for more forward scattering)
      var cosA = sunDot * 2 - 1; // remap 0..1 → -1..1
      var hgG = 0.55, hgG2 = hgG * hgG;
      var hgPhase = 0.5 * (1 - hgG2) / Math.pow(1 + hgG2 - hgG * cosA, 2.0);
      // Combine: brighter sun-lit edges + darker shadowed areas
      var scatter = beerPowder * hgPhase * 3.2; // increased from 2.5
      var ambient = beer * 0.28; // reduced from 0.35 for more contrast
      var lightMul = (scatter + ambient) * brightness;
      // Moon-lit clouds at night: scale by moonPhase (Phase C.2)
      if (isNightCloud) {
        lightMul *= this._moonPhase * 0.35; // moonPhase 0=dark, 1=full moonlight
        lightMul = Math.max(lightMul, 0.08); // minimum visibility
      }
      // Overcast sun glow: diffuse bright spot at sun position when coverage > 0.7 (Phase C.3)
      if (coverage > 0.7 && !isNightCloud) {
        var glowStr = _clamp((coverage - 0.7) * 3.3, 0, 1);
        var glowDot = _clamp(sunDot * 2 - 0.6, 0, 1);
        glowDot = glowDot * glowDot; // gaussian-like falloff
        lightMul += glowStr * glowDot * 0.4;
      }
      // Altitude shading: darker cloud bottoms (Tenkoku: self-shadowing)
      lightMul *= _lerp(0.25, 1.0, 1.0 - v); // was 0.35

      var r = _clamp(baseR * lightMul / 255, 0, 1);
      var g = _clamp(baseG * lightMul / 255, 0, 1);
      var b = _clamp(baseB * lightMul / 255, 0, 1);

      // Horizon fog blend — distant clouds blue-tint + alpha fade (Tenkoku: atmospheric perspective)
      var horizFogFade = _smoothstep(0.75, 0.55, v);
      var horizBlend = (1 - horizFogFade) * 0.6;
      r = _lerp(r, 0.45, horizBlend); // shift toward blue-grey (not just darken)
      g = _lerp(g, 0.52, horizBlend);
      b = _lerp(b, 0.68, horizBlend);

      // Alpha: Tenkoku ref shows dense opaque cumulus cores with soft transparent edges
      var alpha = _clamp(d * 2.5, 0, 0.93) * altFade * horizFogFade;

      pix[idx]     = Math.round(r * 255);
      pix[idx + 1] = Math.round(g * 255);
      pix[idx + 2] = Math.round(b * 255);
      pix[idx + 3] = Math.round(alpha * 255);
    }
  }

  // Edge softening: single-pass 3-wide horizontal blur on alpha (was 4-loop separable 5x1)
  // Reduced from 4 full-texture passes to 1 to eliminate periodic frame stutter
  if (hasCloud) {
    if (!this._blurBuf || this._blurBuf.length !== W * H) this._blurBuf = new Uint8ClampedArray(W * H);
    var blurAlpha = this._blurBuf;
    for (var by = 0; by < H; by++) {
      var rowOff = by * W;
      for (var bx = 1; bx < W - 1; bx++) {
        blurAlpha[rowOff + bx] = (
          pix[(rowOff + bx - 1) * 4 + 3] +
          pix[(rowOff + bx) * 4 + 3] * 2 +
          pix[(rowOff + bx + 1) * 4 + 3]
        ) >> 2; // divide by 4 via bit shift (no Math.round)
      }
    }
    for (var by1 = 0; by1 < H; by1++) {
      var ro = by1 * W;
      for (var bx1 = 1; bx1 < W - 1; bx1++) {
        pix[(ro + bx1) * 4 + 3] = blurAlpha[ro + bx1];
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  if (this._tex) this._tex.needsUpdate = true;
  if (this._dome) this._dome.visible = hasCloud;
};

CloudSystem.prototype.update = function(dt, camera, sunDir, settings, moonDir, moonPhase) {
  this._time += dt;
  this._sunDir = [sunDir.x, sunDir.y, sunDir.z];
  this._coverage = settings.coverage != null ? settings.coverage : 0.35;
  this._speed = settings.speed != null ? settings.speed : 1.0;
  this._brightness = settings.brightness != null ? settings.brightness : 1.0;
  this._density = settings.density != null ? settings.density : 0.85;
  this._scale = settings.scale != null ? settings.scale : 3.0;
  if (moonDir) this._moonDir = [moonDir.x, moonDir.y, moonDir.z];
  if (moonPhase != null) this._moonPhase = moonPhase;

  if (this._dome && camera) {
    this._dome.position.copy(camera.position);
  }

  if (this._dome) {
    this._dome.visible = this._coverage > 0.01;
  }
};

CloudSystem.prototype.dispose = function(scene) {
  if (this._dome && this._dome.parent) this._dome.parent.remove(this._dome);
  if (this._geo) this._geo.dispose();
  if (this._mat) this._mat.dispose();
  if (this._tex) this._tex.dispose();
  this._dome = null;
  this._canvas = null;
  this._ctx = null;
};


// ============================================================
// Moon Renderer — Procedural moon with phase shadow + earthshine
// ============================================================
// Ported from Tenkoku_moonsphere.shader (121 lines)

function MoonRenderer() {
  this._mesh = null;
  this._geo = null;
  this._mat = null;
  this._moonDir = new THREE.Vector3(0, -1, 0);
  this._sunDir = new THREE.Vector3(0, 1, 0);
  this._moonPhase = 0.5; // 0=new, 1=full
  this._size = 150;
  this._brightness = 1.0;
}

MoonRenderer.prototype.build = function(scene) {
  if (this._mesh) return;

  // Cache moon texture globally to avoid heavy canvas regen on Scene↔Game mode switch
  var texSize = 256;
  var canvas;
  if (__swa_texCache.moonCanvas) {
    canvas = __swa_texCache.moonCanvas;
  } else {
  canvas = document.createElement("canvas");
  canvas.width = canvas.height = texSize;
  var ctx = canvas.getContext("2d");

  // Base: light grey lunar surface with subtle radial gradient (brighter center)
  var baseGrad = ctx.createRadialGradient(texSize*0.48, texSize*0.45, 0, texSize*0.5, texSize*0.5, texSize*0.5);
  baseGrad.addColorStop(0, "#c0b8b0"); // brighter center (highlands)
  baseGrad.addColorStop(0.6, "#b0a8a0");
  baseGrad.addColorStop(1, "#988f88"); // darker edges (limb darkening)
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, texSize, texSize);

  // Surface noise texture (subtle elevation variation)
  var moonHash = function(x,y) { var n = Math.sin(x*127.1+y*311.7)*43758.5; return n-Math.floor(n); };
  var moonNoise = function(x,y) {
    var ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    var ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
    return moonHash(ix,iy)*(1-ux)*(1-uy)+moonHash(ix+1,iy)*ux*(1-uy)+moonHash(ix,iy+1)*(1-ux)*uy+moonHash(ix+1,iy+1)*ux*uy;
  };
  var imgD = ctx.getImageData(0,0,texSize,texSize);
  for (var py=0; py<texSize; py++) {
    for (var px=0; px<texSize; px++) {
      var nv = moonNoise(px*0.08,py*0.08)*0.5 + moonNoise(px*0.16,py*0.16)*0.25 + moonNoise(px*0.32,py*0.32)*0.125;
      var variation = (nv - 0.4) * 30; // subtle brightness variation
      var idx = (py*texSize+px)*4;
      imgD.data[idx] = _clamp(imgD.data[idx] + variation, 0, 255);
      imgD.data[idx+1] = _clamp(imgD.data[idx+1] + variation, 0, 255);
      imgD.data[idx+2] = _clamp(imgD.data[idx+2] + variation, 0, 255);
    }
  }
  ctx.putImageData(imgD, 0, 0);

  // Maria (dark basaltic plains — major lunar features)
  // Mare Imbrium (upper left)
  ctx.fillStyle = "rgba(60,55,50,0.35)";
  ctx.beginPath(); ctx.ellipse(texSize*0.38, texSize*0.32, texSize*0.18, texSize*0.16, 0.2, 0, TWO_PI); ctx.fill();
  // Mare Serenitatis (upper center-right)
  ctx.fillStyle = "rgba(65,58,52,0.3)";
  ctx.beginPath(); ctx.ellipse(texSize*0.55, texSize*0.35, texSize*0.10, texSize*0.09, -0.1, 0, TWO_PI); ctx.fill();
  // Mare Tranquillitatis (center-right)
  ctx.fillStyle = "rgba(58,52,48,0.32)";
  ctx.beginPath(); ctx.ellipse(texSize*0.60, texSize*0.48, texSize*0.12, texSize*0.10, 0.3, 0, TWO_PI); ctx.fill();
  // Oceanus Procellarum (left side, large)
  ctx.fillStyle = "rgba(62,56,50,0.28)";
  ctx.beginPath(); ctx.ellipse(texSize*0.30, texSize*0.50, texSize*0.15, texSize*0.22, 0.1, 0, TWO_PI); ctx.fill();
  // Mare Nubium (lower left)
  ctx.fillStyle = "rgba(68,60,55,0.25)";
  ctx.beginPath(); ctx.ellipse(texSize*0.40, texSize*0.68, texSize*0.10, texSize*0.08, -0.15, 0, TWO_PI); ctx.fill();

  // Craters (24 hand-placed, matching approximate real positions)
  var craters = [
    // Major craters
    [0.22, 0.20, 0.08], [0.70, 0.25, 0.06], [0.80, 0.45, 0.05],
    [0.35, 0.78, 0.07], [0.55, 0.75, 0.04], [0.75, 0.70, 0.06],
    [0.15, 0.45, 0.05], [0.65, 0.15, 0.04], [0.42, 0.12, 0.03],
    [0.88, 0.55, 0.04], [0.28, 0.62, 0.05], [0.50, 0.60, 0.03],
    // Smaller craters
    [0.18, 0.30, 0.025], [0.32, 0.45, 0.02], [0.72, 0.38, 0.025],
    [0.45, 0.28, 0.02], [0.60, 0.62, 0.025], [0.25, 0.55, 0.02],
    [0.82, 0.30, 0.02], [0.38, 0.85, 0.025], [0.55, 0.18, 0.02],
    [0.68, 0.82, 0.02], [0.12, 0.65, 0.025], [0.48, 0.42, 0.02],
  ];
  for (var i = 0; i < craters.length; i++) {
    var cx = craters[i][0]*texSize, cy = craters[i][1]*texSize, cr = craters[i][2]*texSize;
    // Crater shadow (dark inner)
    var grad = ctx.createRadialGradient(cx-cr*0.15, cy-cr*0.15, 0, cx, cy, cr);
    grad.addColorStop(0, "rgba(60,55,50,0.55)");
    grad.addColorStop(0.5, "rgba(80,75,70,0.35)");
    grad.addColorStop(0.8, "rgba(100,95,90,0.15)");
    grad.addColorStop(1, "rgba(184,176,168,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TWO_PI); ctx.fill();
    // Bright rim (sunlit edge)
    if (cr > texSize*0.03) {
      ctx.strokeStyle = "rgba(200,195,190,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx+cr*0.1, cy+cr*0.1, cr*0.85, 0, TWO_PI); ctx.stroke();
    }
  }

  // Ray craters (bright ejecta rays from young impacts — Tycho, Copernicus)
  ctx.globalCompositeOperation = "lighter";
  // Tycho (southern hemisphere)
  for (var ri = 0; ri < 8; ri++) {
    var rayAngle = ri * PI / 4 + 0.2;
    var rayLen = texSize * (0.15 + Math.random() * 0.1);
    ctx.strokeStyle = "rgba(200,195,190,0.08)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(texSize*0.45, texSize*0.78);
    ctx.lineTo(texSize*0.45 + Math.cos(rayAngle)*rayLen, texSize*0.78 + Math.sin(rayAngle)*rayLen);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  __swa_texCache.moonCanvas = canvas;
  } // end of cache generation block
  var ctx = canvas.getContext("2d");

  // Store base moon texture for phase shadow overlay
  this._moonBaseImageData = ctx.getImageData(0, 0, texSize, texSize);
  this._moonCanvas = canvas;
  this._moonCtx = ctx;
  this._moonTexSize = texSize;
  this._lastRenderedPhase = -1;

  var moonTex = new THREE.CanvasTexture(canvas);
  moonTex.colorSpace = THREE.SRGBColorSpace;

  this._geo = new THREE.SphereGeometry(1, 32, 16);
  this._geo.name = "__swa_moon_geo__";
  this._moonTex = moonTex;

  // WebGPU-compatible: MeshBasicMaterial with texture (no ShaderMaterial)
  this._mat = new THREE.MeshBasicMaterial({
    map: moonTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: false,
  });
  this._mat.name = "__swa_moon_mat__";

  this._mesh = new THREE.Mesh(this._geo, this._mat);
  this._mesh.name = "__swa_moon__";
  this._mesh.renderOrder = -998;
  this._mesh.frustumCulled = false;
  scene.add(this._mesh);

  // Primary atmospheric glow — widened gradient for slow falloff (Phase H.1)
  var glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 256;
  var glowCtx = glowCanvas.getContext("2d");
  var glowGrad = glowCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  glowGrad.addColorStop(0, "rgba(245,240,230,0.70)");
  glowGrad.addColorStop(0.05, "rgba(242,238,230,0.55)");
  glowGrad.addColorStop(0.12, "rgba(238,235,228,0.40)");
  glowGrad.addColorStop(0.22, "rgba(230,228,224,0.28)");
  glowGrad.addColorStop(0.35, "rgba(220,220,222,0.16)");
  glowGrad.addColorStop(0.50, "rgba(210,212,218,0.08)");
  glowGrad.addColorStop(0.70, "rgba(195,200,212,0.03)");
  glowGrad.addColorStop(0.85, "rgba(185,190,205,0.01)");
  glowGrad.addColorStop(1, "rgba(170,178,195,0)");
  glowCtx.fillStyle = glowGrad;
  glowCtx.fillRect(0, 0, 256, 256);
  var glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;

  this._glowGeo = new THREE.PlaneGeometry(1, 1);
  this._glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  this._glowMesh = new THREE.Mesh(this._glowGeo, this._glowMat);
  this._glowMesh.name = "__swa_moon_glow__";
  this._glowMesh.renderOrder = -998.5;
  this._glowMesh.frustumCulled = false;
  scene.add(this._glowMesh);

  // Secondary wide halo billboard — subtle outer atmospheric ring (Phase H.2)
  var haloCanvas = document.createElement("canvas");
  haloCanvas.width = haloCanvas.height = 256;
  var haloCtx = haloCanvas.getContext("2d");
  var haloGrad = haloCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  haloGrad.addColorStop(0, "rgba(220,225,235,0.10)");
  haloGrad.addColorStop(0.15, "rgba(210,215,228,0.07)");
  haloGrad.addColorStop(0.35, "rgba(195,200,218,0.04)");
  haloGrad.addColorStop(0.60, "rgba(180,188,210,0.015)");
  haloGrad.addColorStop(1, "rgba(160,170,200,0)");
  haloCtx.fillStyle = haloGrad;
  haloCtx.fillRect(0, 0, 256, 256);
  var haloTex = new THREE.CanvasTexture(haloCanvas);
  haloTex.colorSpace = THREE.SRGBColorSpace;

  this._haloGeo = new THREE.PlaneGeometry(1, 1);
  this._haloMat = new THREE.MeshBasicMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  this._haloMesh = new THREE.Mesh(this._haloGeo, this._haloMat);
  this._haloMesh.name = "__swa_moon_halo__";
  this._haloMesh.renderOrder = -998.6; // behind primary glow
  this._haloMesh.frustumCulled = false;
  scene.add(this._haloMesh);
};

MoonRenderer.prototype.update = function(camera, moonDir, sunDir, moonPhase, sunAltDeg, settings) {
  if (!this._mesh) return;

  this._size = (settings.moonDiskSize != null ? settings.moonDiskSize : 0.022) * 900; // was 2800 — way too large, moon covered half the screen
  this._brightness = settings.moonBrightness != null ? settings.moonBrightness : 1.0;

  // Position moon — clamp altitude so it's visible from default orbit camera
  var dist = 470;
  var moonRenderY = moonDir.y;
  if (moonRenderY > 0.64) moonRenderY = 0.64; // cap at ~40° elevation
  var moonXZ = Math.sqrt(moonDir.x * moonDir.x + moonDir.z * moonDir.z) || 0.001;
  var moonTargetXZ = Math.sqrt(1 - moonRenderY * moonRenderY);
  var moonXZScale = moonTargetXZ / moonXZ;
  if (camera) {
    this._mesh.position.set(
      camera.position.x + moonDir.x * moonXZScale * dist,
      camera.position.y + moonRenderY * dist,
      camera.position.z + moonDir.z * moonXZScale * dist
    );
  }
  // Horizon inflation: 1.15x at horizon (was 1.5x — way too large)
  var moonHorizInflation = moonDir.y < 0.15 ? _lerp(1.15, 1.0, _clamp(moonDir.y / 0.15, 0, 1)) : 1.0;
  this._mesh.scale.setScalar(this._size * moonHorizInflation);
  this._mesh.lookAt(camera ? camera.position : new THREE.Vector3(0, 0, 0));

  // Phase shadow rendering — Tenkoku computes dot(Normal, SunForward) for lit/dark terminator
  // We approximate by painting a shadow arc on the canvas texture based on phase
  var phaseBrightness = _clamp(moonPhase, 0.05, 1.0) * this._brightness;
  var phaseQuantized = Math.round(moonPhase * 20) / 20; // 20 discrete steps to avoid constant redraws
  if (this._moonCanvas && this._moonCtx && this._lastRenderedPhase !== phaseQuantized) {
    this._lastRenderedPhase = phaseQuantized;
    var ts = this._moonTexSize;
    var mctx = this._moonCtx;
    // Restore base texture
    mctx.putImageData(this._moonBaseImageData, 0, 0);
    // Draw phase shadow — moonPhase: 0=new (all dark), 0.5=full (all lit), 1=new
    // Shadow is an ellipse clipped to circle. The ellipse width varies with phase.
    var phase01 = moonPhase; // 0=new, 0.5=first quarter, 1=full
    if (phase01 < 0.98) { // don't shadow when nearly full
      var cx = ts / 2, cy = ts / 2, cr = ts / 2 - 1;
      mctx.save();
      mctx.beginPath();
      mctx.arc(cx, cy, cr, 0, TWO_PI);
      mctx.clip();
      // Shadow ellipse: narrow at full, covers half at quarter, covers all at new
      var shadowAlpha = _clamp(1.0 - phase01 * 1.1, 0, 0.92);
      // Terminator position: -1 (all dark) to +1 (all lit)
      var termX = (phase01 * 2 - 1); // -1 at new, 0 at quarter, +1 at full
      mctx.fillStyle = "rgba(5,5,10," + shadowAlpha + ")";
      mctx.beginPath();
      // Draw shadow as a half-circle + ellipse to simulate terminator
      if (termX <= 0) {
        // Waxing: shadow on the left, bright on the right
        mctx.ellipse(cx, cy, cr * (1 + termX), cr, 0, -PI / 2, PI / 2, true);
        mctx.arc(cx, cy, cr, PI / 2, -PI / 2, true);
      } else {
        // Waning: shadow on the right
        mctx.ellipse(cx, cy, cr * (1 - termX), cr, 0, PI / 2, -PI / 2, true);
        mctx.arc(cx, cy, cr, -PI / 2, PI / 2, true);
      }
      mctx.fill();
      mctx.restore();
    }
    if (this._moonTex) this._moonTex.needsUpdate = true;
  }

  // Horizon tint: orange when moon is low (Tenkoku: moonHorizColor = 1, 0.27, 0)
  var moonAlt = moonDir.y;
  var r = 1.0, g = 1.0, b = 1.0;
  if (moonAlt < 0.15 && moonAlt > -0.05) {
    var warmT = 1 - _smoothstep(-0.05, 0.15, moonAlt);
    g *= _lerp(1.0, 0.7, warmT);
    b *= _lerp(1.0, 0.4, warmT);
  }
  this._mat.color.setRGB(r, g, b);

  // Opacity: smooth horizon fade — keep full opacity (phase shadow handles visual phase)
  var horizonFade = _smoothstep(-0.05, 0.05, moonDir.y);
  this._mat.opacity = _clamp(0.85 * this._brightness, 0.1, 0.95) * horizonFade;

  // Visibility: hide when fully below horizon (after fade completes)
  this._mesh.visible = moonDir.y > -0.05;

  // Primary glow halo — widened to 8x (Phase H.1)
  if (this._glowMesh) {
    this._glowMesh.visible = this._mesh.visible;
    if (this._glowMesh.visible && camera) {
      this._glowMesh.position.copy(this._mesh.position);
      this._glowMesh.scale.setScalar(this._size * 8.0); // widened from 4x to 8x
      this._glowMesh.lookAt(camera.position);
      // Altitude-based halo color: warm at horizon, cool blue-white at zenith (Phase H.3)
      var haloAlt = _clamp(moonDir.y, 0, 1);
      var haloR = _lerp(1.0, 0.85, haloAlt);
      var haloG = _lerp(0.88, 0.90, haloAlt);
      var haloB = _lerp(0.75, 1.0, haloAlt);
      this._glowMat.color.setRGB(haloR, haloG, haloB);
      this._glowMat.opacity = phaseBrightness * horizonFade * 0.72;
    }
  }

  // Secondary wide halo (Phase H.2)
  if (this._haloMesh) {
    this._haloMesh.visible = this._mesh.visible;
    if (this._haloMesh.visible && camera) {
      this._haloMesh.position.copy(this._mesh.position);
      this._haloMesh.scale.setScalar(this._size * 16.0); // 16x for wide atmospheric halo
      this._haloMesh.lookAt(camera.position);
      var haloAlt2 = _clamp(moonDir.y, 0, 1);
      var haloR2 = _lerp(1.0, 0.82, haloAlt2);
      var haloG2 = _lerp(0.85, 0.88, haloAlt2);
      var haloB2 = _lerp(0.70, 1.0, haloAlt2);
      this._haloMat.color.setRGB(haloR2, haloG2, haloB2);
      this._haloMat.opacity = phaseBrightness * horizonFade * 0.08; // very subtle
    }
  }
};

MoonRenderer.prototype.dispose = function(scene) {
  if (this._mesh && this._mesh.parent) this._mesh.parent.remove(this._mesh);
  if (this._glowMesh && this._glowMesh.parent) this._glowMesh.parent.remove(this._glowMesh);
  if (this._haloMesh && this._haloMesh.parent) this._haloMesh.parent.remove(this._haloMesh);
  if (this._geo) this._geo.dispose();
  if (this._glowGeo) this._glowGeo.dispose();
  if (this._haloGeo) this._haloGeo.dispose();
  if (this._moonTex) this._moonTex.dispose();
  if (this._mat) this._mat.dispose();
  if (this._glowMat) this._glowMat.dispose();
  if (this._haloMat) this._haloMat.dispose();
  this._mesh = null;
  this._glowMesh = null;
  this._haloMesh = null;
};


// ============================================================
// Lightning Effect — Perlin-path bolts + thunder audio
// ============================================================
// Ported from TenkokuLightningFX.cs (430 lines)

function LightningEffect() {
  this._bolts = [];
  this._flashLight = null;
  this._scene = null;
  this._timer = 0;
  this._frequency = 0.1;
  this._enabled = false;
  this._audioCtx = null;
}

LightningEffect.prototype.init = function(scene) {
  this._scene = scene;
  // Flash light for lightning illumination — increased range + intensity (Phase D.3)
  this._flashLight = new THREE.PointLight(0xCCDDFF, 0, 800);
  this._flashLight.name = "__swa_lightning_flash__";
  scene.add(this._flashLight);

  // Flash glow billboard at bolt base (Phase D.4)
  var glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  var gctx = glowCanvas.getContext("2d");
  var grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(200,220,255,0.8)");
  grad.addColorStop(0.3, "rgba(180,200,240,0.35)");
  grad.addColorStop(0.6, "rgba(150,170,220,0.1)");
  grad.addColorStop(1, "rgba(120,140,200,0)");
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 128, 128);
  this._glowTex = new THREE.CanvasTexture(glowCanvas);
  this._glowTex.colorSpace = THREE.SRGBColorSpace;
  this._glowGeo = new THREE.PlaneGeometry(1, 1);
  this._glowMat = new THREE.MeshBasicMaterial({
    map: this._glowTex, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  this._glowMesh = new THREE.Mesh(this._glowGeo, this._glowMat);
  this._glowMesh.name = "__swa_bolt_glow__";
  this._glowMesh.frustumCulled = false;
  this._glowMesh.visible = false;
  scene.add(this._glowMesh);
};

// Generate a path of 3D points for a lightning bolt
LightningEffect.prototype._generatePath = function(startX, startY, startZ, endY, baseX, baseZ, segments, jitter) {
  var path = [];
  var x = startX, y = startY, z = startZ;
  var stepY = (startY - endY) / segments;
  for (var i = 0; i <= segments; i++) {
    path.push([x, y, z]);
    var t = i / segments;
    x += (Math.random() - 0.5) * jitter * (1 - t * 0.5);
    y -= stepY;
    z += (Math.random() - 0.5) * jitter * (1 - t * 0.5);
    x = _lerp(x, baseX, 0.1);
    z = _lerp(z, baseZ, 0.1);
  }
  return path;
};

// Build camera-facing ribbon mesh from path vertices (Phase D.1)
LightningEffect.prototype._buildRibbon = function(path, width, camera) {
  var n = path.length;
  if (n < 2) return null;
  var positions = new Float32Array((n - 1) * 6 * 3); // 2 triangles per segment = 6 verts
  var camPos = camera ? camera.position : new THREE.Vector3();
  var idx = 0;
  for (var i = 0; i < n - 1; i++) {
    var p0 = path[i], p1 = path[i + 1];
    // Taper: wide at top, narrow at bottom
    var t = i / (n - 1);
    var w = width * _lerp(1.0, 0.15, t);
    // Tangent along bolt
    var tx = p1[0] - p0[0], ty = p1[1] - p0[1], tz = p1[2] - p0[2];
    // View direction (camera to midpoint)
    var mx = (p0[0] + p1[0]) * 0.5 - camPos.x;
    var my = (p0[1] + p1[1]) * 0.5 - camPos.y;
    var mz = (p0[2] + p1[2]) * 0.5 - camPos.z;
    // Cross product tangent × view = perpendicular (billboard direction)
    var cx = ty * mz - tz * my;
    var cy = tz * mx - tx * mz;
    var cz = tx * my - ty * mx;
    var cl = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    cx = cx / cl * w; cy = cy / cl * w; cz = cz / cl * w;
    // Quad: p0-w, p0+w, p1-w, p1+w → 2 triangles
    // Tri 1: p0-w, p0+w, p1-w
    positions[idx++] = p0[0] - cx; positions[idx++] = p0[1] - cy; positions[idx++] = p0[2] - cz;
    positions[idx++] = p0[0] + cx; positions[idx++] = p0[1] + cy; positions[idx++] = p0[2] + cz;
    positions[idx++] = p1[0] - cx; positions[idx++] = p1[1] - cy; positions[idx++] = p1[2] - cz;
    // Tri 2: p0+w, p1+w, p1-w
    positions[idx++] = p0[0] + cx; positions[idx++] = p0[1] + cy; positions[idx++] = p0[2] + cz;
    positions[idx++] = p1[0] + cx; positions[idx++] = p1[1] + cy; positions[idx++] = p1[2] + cz;
    positions[idx++] = p1[0] - cx; positions[idx++] = p1[1] - cy; positions[idx++] = p1[2] - cz;
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions.slice(0, idx), 3));
  return geo;
};

LightningEffect.prototype._generateBolt = function(camera) {
  if (!camera) return null;

  var angle = Math.random() * TWO_PI;
  var distance = 100 + Math.random() * 200;
  var baseX = camera.position.x + Math.sin(angle) * distance;
  var baseZ = camera.position.z + Math.cos(angle) * distance;
  var topY = camera.position.y + 80 + Math.random() * 40;
  var bottomY = camera.position.y - 5;
  var segments = 30 + Math.floor(Math.random() * 30);
  var jitter = 8 + Math.random() * 12;

  // Main bolt path
  var mainPath = this._generatePath(baseX, topY, baseZ, bottomY, baseX, baseZ, segments, jitter);
  var mainGeo = this._buildRibbon(mainPath, 3.0, camera);

  // Branch forks — 2-4 branches from random points (Phase D.2)
  var branchCount = 2 + Math.floor(Math.random() * 3);
  var branchGeos = [];
  for (var bi = 0; bi < branchCount; bi++) {
    var forkIdx = 3 + Math.floor(Math.random() * (mainPath.length * 0.6));
    if (forkIdx >= mainPath.length) forkIdx = Math.floor(mainPath.length * 0.5);
    var fp = mainPath[forkIdx];
    var branchSegs = 8 + Math.floor(Math.random() * 12);
    var branchEndY = fp[1] - 15 - Math.random() * 25;
    var branchBaseX = fp[0] + (Math.random() - 0.5) * 30;
    var branchBaseZ = fp[2] + (Math.random() - 0.5) * 30;
    var branchPath = this._generatePath(fp[0], fp[1], fp[2], branchEndY, branchBaseX, branchBaseZ, branchSegs, jitter * 0.7);
    var branchGeo = this._buildRibbon(branchPath, 1.2, camera);
    if (branchGeo) branchGeos.push(branchGeo);
  }

  // Merge all geometries
  var allGeos = [mainGeo];
  for (var gi = 0; gi < branchGeos.length; gi++) allGeos.push(branchGeos[gi]);
  // Simple merge: combine position buffers
  var totalVerts = 0;
  for (var mi = 0; mi < allGeos.length; mi++) {
    if (allGeos[mi]) totalVerts += allGeos[mi].getAttribute("position").count;
  }
  var merged = new Float32Array(totalVerts * 3);
  var off = 0;
  for (var mi2 = 0; mi2 < allGeos.length; mi2++) {
    if (!allGeos[mi2]) continue;
    var src = allGeos[mi2].getAttribute("position").array;
    merged.set(src, off);
    off += src.length;
    allGeos[mi2].dispose();
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(merged, 3));

  var mat = new THREE.MeshBasicMaterial({
    color: 0xCCDDFF,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });

  var mesh = new THREE.Mesh(geo, mat);
  mesh.name = "__swa_bolt__";
  mesh.frustumCulled = false;
  this._scene.add(mesh);

  return {
    mesh: mesh,
    geo: geo,
    mat: mat,
    life: 0,
    maxLife: 0.3 + Math.random() * 0.2,
    intensity: 0.5 + Math.random() * 0.5,
    position: new THREE.Vector3(baseX, (topY + bottomY) / 2, baseZ),
    distance: distance,
  };
};

LightningEffect.prototype._playThunder = function(distance) {
  try {
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    var ctx = this._audioCtx;
    if (ctx.state === "suspended") ctx.resume();

    // Delay based on distance (speed of sound ~343 m/s, game scale ~1:10)
    var delay = _clamp(distance / 50, 0.1, 3.0);
    var volume = _clamp(1 - distance / 300, 0.1, 0.8);

    // Generate thunder-like noise burst
    var duration = 1.5 + Math.random() * 1.5;
    var sampleRate = ctx.sampleRate;
    var buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    var data = buffer.getChannelData(0);

    // Low-frequency rumble with exponential decay
    for (var i = 0; i < data.length; i++) {
      var t = i / sampleRate;
      var decay = Math.exp(-t * 2);
      // Mix of low-freq rumble + white noise bursts
      data[i] = ((Math.random() - 0.5) * 0.6 +
        Math.sin(t * 40 + Math.random()) * 0.3 +
        Math.sin(t * 80) * 0.1) * decay;
    }

    var source = ctx.createBufferSource();
    source.buffer = buffer;
    // Pitch variation: closer = higher pitch, distant = lower rumble (Tenkoku 0.6-1.2 range)
    source.playbackRate.value = _lerp(0.6, 1.2, 1 - distance / 300);
    var gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime + delay);
  } catch(e) {
    // Audio not available, skip
  }
};

LightningEffect.prototype.update = function(dt, camera, settings) {
  this._enabled = settings.enabled || false;
  this._frequency = settings.frequency != null ? settings.frequency : 0.1;

  // Spawn new bolts
  if (this._enabled && camera) {
    this._timer += dt;
    var threshold = 1.0 / Math.max(0.01, this._frequency);
    if (this._timer >= threshold) {
      this._timer -= threshold;
      var bolt = this._generateBolt(camera);
      if (bolt) {
        this._bolts.push(bolt);

        // Flash — increased intensity (Phase D.3)
        this._flashLight.position.copy(bolt.position);
        this._flashLight.intensity = bolt.intensity * 15;

        // Flash glow billboard (Phase D.4)
        if (this._glowMesh) {
          this._glowMesh.visible = true;
          this._glowMesh.position.copy(bolt.position);
          this._glowMesh.position.y -= 20; // near bolt base
          this._glowMesh.scale.setScalar(60 + Math.random() * 40);
          if (camera) this._glowMesh.lookAt(camera.position);
          this._glowMat.opacity = 0.7;
        }

        // Thunder
        this._playThunder(bolt.distance);
      }
    }
  }

  // Update existing bolts
  for (var i = this._bolts.length - 1; i >= 0; i--) {
    var b = this._bolts[i];
    b.life += dt;

    // Fade out
    var fadeT = b.life / b.maxLife;
    b.mat.opacity = 1 - fadeT;

    if (b.life >= b.maxLife) {
      // Remove
      this._scene.remove(b.mesh);
      b.geo.dispose();
      b.mat.dispose();
      this._bolts.splice(i, 1);
    }
  }

  // Decay flash light + glow
  if (this._flashLight.intensity > 0) {
    this._flashLight.intensity *= 0.85;
    if (this._flashLight.intensity < 0.01) this._flashLight.intensity = 0;
  }
  if (this._glowMat && this._glowMat.opacity > 0) {
    this._glowMat.opacity *= 0.82;
    if (this._glowMat.opacity < 0.01) {
      this._glowMat.opacity = 0;
      if (this._glowMesh) this._glowMesh.visible = false;
    }
  }
};

LightningEffect.prototype.dispose = function(scene) {
  for (var i = 0; i < this._bolts.length; i++) {
    scene.remove(this._bolts[i].mesh);
    this._bolts[i].geo.dispose();
    this._bolts[i].mat.dispose();
  }
  this._bolts = [];
  if (this._flashLight) scene.remove(this._flashLight);
  if (this._glowMesh) { scene.remove(this._glowMesh); this._glowGeo.dispose(); this._glowMat.dispose(); this._glowTex.dispose(); }
  if (this._audioCtx) {
    try { this._audioCtx.close(); } catch(e) {}
  }
};


// ============================================================
// Aurora Borealis — Animated curtain visible at high latitudes
// ============================================================
// Ported from Tenkoku_aurora_sphere.shader (186 lines)

function AuroraRenderer() {
  this._mesh = null;
  this._geo = null;
  this._mat = null;
  this._time = 0;
  this._visible = false;
}

AuroraRenderer.prototype.build = function(scene) {
  if (this._mesh) return;

  // Generate aurora texture
  var texSize = 256;
  var canvas = document.createElement("canvas");
  canvas.width = texSize; canvas.height = texSize;
  var ctx = canvas.getContext("2d");

  // Vertical gradient bands of green/blue/purple
  for (var y = 0; y < texSize; y++) {
    var t = y / texSize;
    var r = Math.floor(_lerp(20, 100, Math.sin(t * PI) * 0.5) * (0.5 + 0.5 * Math.sin(t * 8)));
    var g = Math.floor(_lerp(180, 255, Math.sin(t * PI)) * (0.6 + 0.4 * Math.sin(t * 6 + 1)));
    var b = Math.floor(_lerp(80, 200, Math.sin(t * PI * 0.7 + 0.5)) * (0.4 + 0.6 * Math.sin(t * 5 + 2)));
    var a = Math.sin(t * PI) * 0.6;
    ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + a + ")";
    ctx.fillRect(0, y, texSize, 1);
  }

  var auroraTex = new THREE.CanvasTexture(canvas);
  auroraTex.wrapS = THREE.RepeatWrapping;
  auroraTex.wrapT = THREE.ClampToEdgeWrapping;

  // Cylinder geometry for aurora curtain
  this._geo = new THREE.CylinderGeometry(450, 450, 80, 64, 16, true);
  this._geo.name = "__swa_aurora_geo__";

  this._auroraTex = auroraTex;
  // WebGPU-compatible: MeshBasicMaterial with texture (no ShaderMaterial)
  this._mat = new THREE.MeshBasicMaterial({
    map: auroraTex,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  this._mat.name = "__swa_aurora_mat__";

  this._mesh = new THREE.Mesh(this._geo, this._mat);
  this._mesh.name = "__swa_aurora__";
  this._mesh.renderOrder = -997;
  this._mesh.frustumCulled = false;
  this._mesh.visible = false;
  this._mesh.position.y = 400; // high in the sky but within camera.far (1000)
  scene.add(this._mesh);
};

AuroraRenderer.prototype.update = function(dt, camera, latitude, sunAltDeg, settings) {
  this._time += dt;
  if (!this._mesh) return;

  var auroraIntensity = settings.aurora || 0;
  // Aurora only visible at high latitudes, clear night
  var latAbs = Math.abs(latitude != null ? latitude : 45);
  var nightFac = sunAltDeg < -12 ? 1 : (sunAltDeg < -6 ? _smoothstep(-6, -12, sunAltDeg) : 0);
  var latFac = latAbs > 55 ? 1 : (latAbs > 45 ? _smoothstep(45, 55, latAbs) : 0);

  this._visible = auroraIntensity > 0.01 && nightFac > 0.01 && latFac > 0.01;
  this._mesh.visible = this._visible;

  if (this._visible) {
    this._mat.opacity = auroraIntensity * nightFac * latFac * 0.6;
    // Curtain wave animation: slowly scroll texture UV for aurora motion
    if (this._auroraTex) {
      this._auroraTex.offset.x = this._time * 0.15; // Tenkoku: aurSpd = 0.15
      this._auroraTex.offset.y = Math.sin(this._time * 0.3) * 0.05;
    }
    if (camera) {
      this._mesh.position.x = camera.position.x;
      this._mesh.position.z = camera.position.z;
    }
  }
};

AuroraRenderer.prototype.dispose = function(scene) {
  if (this._mesh && this._mesh.parent) this._mesh.parent.remove(this._mesh);
  if (this._geo) this._geo.dispose();
  if (this._auroraTex) this._auroraTex.dispose();
  if (this._mat) this._mat.dispose();
  this._mesh = null;
};


// ============================================================
// Weather State Machine — auto-forecast + transitions
// ============================================================
// Ported from TenkokuModule.cs weather sections

var WEATHER_STATES = ["clear", "partly_cloudy", "overcast", "rain", "storm", "snow"];

function WeatherStateMachine() {
  this._currentState = "clear";
  this._targetState = "clear";
  this._transition = 0; // 0=at target, 0-1=transitioning
  this._transitionSpeed = 0.017; // per second (~60s full transition, Tenkoku default)
  this._forecastTimer = 0;
  this._forecastInterval = 300; // seconds between auto-forecast (Tenkoku: 5 min default)
  this._autoForecast = false;
  // Derived weather values (interpolated during transitions)
  this.cloudCoverage = 0;
  this.precipType = "none";
  this.precipIntensity = 0;
  this.lightningEnabled = false;
  this.windStrength = 0.3;
}

WeatherStateMachine.prototype._stateValues = function(state) {
  switch (state) {
    case "clear":         return { cloud: 0.0,  precip: "none", intensity: 0, lightning: false, wind: 0.1 };
    case "partly_cloudy": return { cloud: 0.35, precip: "none", intensity: 0, lightning: false, wind: 0.2 };
    case "overcast":      return { cloud: 0.75, precip: "none", intensity: 0, lightning: false, wind: 0.4 };
    case "rain":          return { cloud: 0.85, precip: "rain", intensity: 0.6, lightning: false, wind: 0.5 };
    case "storm":         return { cloud: 1.0,  precip: "rain", intensity: 1.0, lightning: true, wind: 0.8 };
    case "snow":          return { cloud: 0.8,  precip: "snow", intensity: 0.7, lightning: false, wind: 0.3 };
    default:              return { cloud: 0.0,  precip: "none", intensity: 0, lightning: false, wind: 0.1 };
  }
};

WeatherStateMachine.prototype.setState = function(state) {
  if (WEATHER_STATES.indexOf(state) >= 0) {
    this._targetState = state;
    this._transition = 0;
  }
};

WeatherStateMachine.prototype.update = function(dt, settings) {
  this._autoForecast = settings.autoForecast || false;
  this._forecastInterval = settings.forecastInterval != null ? settings.forecastInterval : 60;

  // Auto-forecast: randomly pick next weather state
  if (this._autoForecast) {
    this._forecastTimer += dt;
    if (this._forecastTimer >= this._forecastInterval) {
      this._forecastTimer = 0;
      // Weighted random: prefer states adjacent to current
      var idx = WEATHER_STATES.indexOf(this._currentState);
      var roll = Math.random();
      if (roll < 0.3) {
        // Stay same
      } else if (roll < 0.55) {
        idx = Math.min(idx + 1, WEATHER_STATES.length - 1);
      } else if (roll < 0.8) {
        idx = Math.max(idx - 1, 0);
      } else {
        idx = Math.floor(Math.random() * WEATHER_STATES.length);
      }
      this._targetState = WEATHER_STATES[idx];
      this._transition = 0;
    }
  }

  // Transition smoothly
  if (this._currentState !== this._targetState) {
    this._transition += dt * this._transitionSpeed;
    if (this._transition >= 1) {
      this._transition = 0;
      this._currentState = this._targetState;
    }
  }

  // Interpolate values using SmoothStep (Tenkoku: Mathf.SmoothStep)
  var from = this._stateValues(this._currentState);
  var to = this._stateValues(this._targetState);
  var t = this._transition;
  var st = t * t * (3 - 2 * t); // smoothstep for natural transitions

  this.cloudCoverage = _lerp(from.cloud, to.cloud, st);
  // Rain 2x faster transition (Tenkoku: patternTime * 2.0 for rain)
  var rainT = _clamp(t * 2, 0, 1); rainT = rainT * rainT * (3 - 2 * rainT);
  this.precipIntensity = _lerp(from.intensity, to.intensity, rainT);
  this.windStrength = _lerp(from.wind, to.wind, st);
  this.precipType = rainT > 0.5 ? to.precip : from.precip;
  // Lightning 2x faster (Tenkoku: patternTime * 2.0)
  this.lightningEnabled = rainT > 0.5 ? to.lightning : from.lightning;
  // Couple rain to overcast (Tenkoku: rain *= lerp(-1, 1, overcastAmt))
  // Rain only possible when cloud coverage > 50%
  this.precipIntensity *= _clamp(_lerp(-1, 1, this.cloudCoverage), 0, 1);

  // Wind gust randomization (Tenkoku-style turbulence)
  this._gustTimer = (this._gustTimer || 0) + dt;
  if (this._gustTimer > 2 + Math.random() * 3) {
    this._gustTimer = 0;
    this.windStrength += (Math.random() - 0.3) * 0.15;
    this.windStrength = _clamp(this.windStrength, 0, 1);
  }

  // Temperature-based precipitation type: below 0°C → snow, above → rain
  // Simplified: use latitude as temperature proxy (higher lat = colder)
  var latitude = Math.abs(settings.latitude != null ? settings.latitude : 45);
  if (this.precipType === "rain" && latitude > 55) {
    this.precipType = "snow"; // cold enough for snow at high latitudes
  }
};


// ============================================================
// Milky Way + Planets — Night sky deep-space objects
// ============================================================
// Ported from Tenkoku_galaxy.shader + Tenkoku_planet.shader

function MilkyWayAndPlanets() {
  this._milkyWay = null;
  this._milkyGeo = null;
  this._milkyMat = null;
  this._planetGroup = null;
  this._planetSprites = null;
  this._planetMats = null;
}

MilkyWayAndPlanets.prototype.init = function(scene) {
  // Milky Way: Canvas-textured dome with procedural nebula band
  // Cache globally to avoid heavy canvas regen on Scene↔Game mode switch
  var mwW = 512, mwH = 256; // reduced from 1024x512 for faster init
  var mwCanvas;
  if (__swa_texCache.milkyWayCanvas) {
    mwCanvas = __swa_texCache.milkyWayCanvas;
  } else {
  mwCanvas = document.createElement("canvas");
  mwCanvas.width = mwW; mwCanvas.height = mwH;
  var mwCtx = mwCanvas.getContext("2d");
  mwCtx.fillStyle = "rgba(0,0,0,0)";
  mwCtx.clearRect(0, 0, mwW, mwH);

  // Galactic plane band: tilted ~63° from celestial equator
  // On equirectangular canvas, the galactic plane is a sinusoidal curve
  var tilt = 63 * DEG2RAD;
  var galCenter = 266.4 * DEG2RAD; // galactic center RA ~17h46m = 266.4°
  var hashMW = function(x, y) { var n = Math.sin(x*127.1+y*311.7)*43758.5453; return n-Math.floor(n); };
  var noiseMW = function(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x-ix, fy = y-iy;
    var ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
    return hashMW(ix,iy)*(1-ux)*(1-uy) + hashMW(ix+1,iy)*ux*(1-uy) + hashMW(ix,iy+1)*(1-ux)*uy + hashMW(ix+1,iy+1)*ux*uy;
  };
  var fbmMW = function(x, y) {
    return noiseMW(x,y)*0.5 + noiseMW(x*2,y*2)*0.25 + noiseMW(x*4,y*4)*0.125 + noiseMW(x*8,y*8)*0.0625;
  };

  var imgD = mwCtx.createImageData(mwW, mwH);
  var pxD = imgD.data;
  for (var py = 0; py < mwH; py++) {
    var dec = (0.5 - py / mwH) * PI; // -90° to +90°
    for (var px = 0; px < mwW; px++) {
      var ra = (px / mwW) * TWO_PI;
      // Convert equatorial (RA,Dec) to galactic latitude approximation
      // Galactic lat ≈ sin(dec)*cos(tilt) - cos(dec)*sin(ra - galCenter)*sin(tilt)
      var sinB = Math.sin(dec)*Math.cos(tilt) - Math.cos(dec)*Math.sin(ra - galCenter)*Math.sin(tilt);
      var galLat = Math.asin(_clamp(sinB, -1, 1));
      // Band intensity: Gaussian falloff from galactic equator
      var bandWidth = 0.18; // radians (~10°)
      var bandIntensity = Math.exp(-galLat*galLat / (2*bandWidth*bandWidth));
      if (bandIntensity < 0.02) continue;
      // Add noise for nebula-like structure
      var nx = px * 0.015 + 50, ny = py * 0.02 + 30;
      var noiseVal = fbmMW(nx, ny);
      var density = bandIntensity * (0.4 + noiseVal * 0.8);
      // Brighter near galactic center (RA ~266°)
      var centerDist = Math.abs(ra - galCenter);
      if (centerDist > PI) centerDist = TWO_PI - centerDist;
      var centerBoost = Math.exp(-centerDist * centerDist / (1.2 * 1.2)) * 0.5;
      density += centerBoost * bandIntensity;
      density = _clamp(density, 0, 1);
      // Color: blue-white with warm center
      var warmth = centerBoost / 0.5;
      var idx = (py * mwW + px) * 4;
      pxD[idx]   = Math.round(_lerp(160, 200, warmth) * density);
      pxD[idx+1] = Math.round(_lerp(170, 185, warmth) * density);
      pxD[idx+2] = Math.round(_lerp(210, 195, warmth) * density);
      pxD[idx+3] = Math.round(density * 120); // semi-transparent
    }
  }
  mwCtx.putImageData(imgD, 0, 0);
  // Add scattered bright star clusters in the band
  for (var s = 0; s < 800; s++) {
    var sx = Math.random() * mwW;
    var sy = Math.random() * mwH;
    var ra2 = (sx / mwW) * TWO_PI;
    var dec2 = (0.5 - sy / mwH) * PI;
    var sinB2 = Math.sin(dec2)*Math.cos(tilt) - Math.cos(dec2)*Math.sin(ra2 - galCenter)*Math.sin(tilt);
    if (Math.abs(sinB2) > 0.25) continue; // only in the band
    var br = 0.3 + Math.random() * 0.5;
    var sr = 0.5 + Math.random() * 1.0;
    var g2 = mwCtx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    g2.addColorStop(0, "rgba(200,210,240," + br + ")");
    g2.addColorStop(1, "rgba(200,210,240,0)");
    mwCtx.fillStyle = g2;
    mwCtx.fillRect(sx - sr, sy - sr, sr*2, sr*2);
  }
  __swa_texCache.milkyWayCanvas = mwCanvas;
  } // end of cache generation block

  var mwTex = new THREE.CanvasTexture(mwCanvas);
  mwTex.colorSpace = THREE.SRGBColorSpace;
  this._milkyGeo = new THREE.SphereGeometry(493, 64, 32);
  _invertWinding(this._milkyGeo);
  this._milkyMat = new THREE.MeshBasicMaterial({
    map: mwTex,
    side: THREE.FrontSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  this._milkyWay = new THREE.Mesh(this._milkyGeo, this._milkyMat);
  this._milkyWay.name = "__swa_milky_way__";
  this._milkyWay.renderOrder = -999.3; // between star dome (-999.5) and clouds (-999)
  this._milkyWay.frustumCulled = false;
  this._milkyWay.visible = false;
  // Tilt 63° to match galactic plane orientation
  this._milkyWay.rotation.x = tilt;
  scene.add(this._milkyWay);

  // Planets: 5 bright planets as Sprites (WebGPU renders Sprites properly, not Points)
  var planetData = [
    { name: "Mercury", color: [0.7, 0.7, 0.7], size: 5 },
    { name: "Venus",   color: [1.0, 0.95, 0.8], size: 8 },
    { name: "Mars",    color: [1.0, 0.5, 0.3], size: 6 },
    { name: "Jupiter", color: [0.9, 0.85, 0.7], size: 7 },
    { name: "Saturn",  color: [0.95, 0.9, 0.6], size: 5.5 },
  ];

  var pCanvas = document.createElement("canvas");
  pCanvas.width = 32; pCanvas.height = 32;
  var pCtx = pCanvas.getContext("2d");
  var pGrad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  pGrad.addColorStop(0, "rgba(255,255,255,1.0)");
  pGrad.addColorStop(0.12, "rgba(255,255,255,0.9)");
  pGrad.addColorStop(0.35, "rgba(255,255,255,0.3)");
  pGrad.addColorStop(1.0, "rgba(255,255,255,0.0)");
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 32, 32);
  var planetTex = new THREE.CanvasTexture(pCanvas);

  this._planetSprites = [];
  this._planetMats = [];
  this._planetGroup = new THREE.Group();
  this._planetGroup.name = "__swa_planets__";
  this._planetGroup.renderOrder = -998;
  this._planetGroup.frustumCulled = false;
  this._planetGroup.visible = false;

  for (var j = 0; j < planetData.length; j++) {
    var pm = new THREE.SpriteMaterial({
      map: planetTex,
      color: new THREE.Color(planetData[j].color[0], planetData[j].color[1], planetData[j].color[2]),
      transparent: true, opacity: 0.8,
      depthWrite: false, depthTest: false, fog: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    var ps = new THREE.Sprite(pm);
    ps.scale.setScalar(planetData[j].size);
    ps.position.set(0, -1000, 0);
    this._planetGroup.add(ps);
    this._planetSprites.push(ps);
    this._planetMats.push(pm);
  }
  scene.add(this._planetGroup);
  this._planetData = planetData;
};

MilkyWayAndPlanets.prototype.update = function(sunAltDeg, camera, time, dayNumber, settings) {
  var nightFac = _smoothstep(-6, -18, sunAltDeg);
  var galaxyIntensity = settings.galaxyIntensity != null ? settings.galaxyIntensity : 1.0;
  var planetIntensity = settings.planetIntensity != null ? settings.planetIntensity : 1.0;

  // Milky Way
  if (this._milkyWay) {
    this._milkyWay.visible = nightFac > 0.01 && galaxyIntensity > 0.01;
    if (this._milkyWay.visible) {
      this._milkyMat.opacity = nightFac * 0.45 * galaxyIntensity;
      if (camera) {
        this._milkyWay.position.copy(camera.position);
      }
    }
  }

  // Planets: sprite-based rendering (WebGPU-compatible)
  if (this._planetGroup) {
    this._planetGroup.visible = nightFac > 0.05 && planetIntensity > 0.01;
    if (this._planetGroup.visible) {
      var pOpacity = nightFac * 0.8 * planetIntensity;
      for (var pm = 0; pm < this._planetMats.length; pm++) {
        this._planetMats[pm].opacity = pOpacity;
      }

      var periods = [87.97, 224.7, 687.0, 4332.6, 10759.2];
      var dist = 460;
      for (var pi = 0; pi < this._planetSprites.length; pi++) {
        var angle = ((dayNumber || 0) / periods[pi]) * TWO_PI + pi * 1.2;
        var elev = 0.2 + Math.sin(angle * 0.3 + pi) * 0.3;
        this._planetSprites[pi].position.set(
          Math.cos(angle) * dist * Math.cos(elev),
          Math.sin(elev) * dist,
          Math.sin(angle) * dist * Math.cos(elev)
        );
      }

      if (camera) this._planetGroup.position.copy(camera.position);
    }
  }
};

MilkyWayAndPlanets.prototype.dispose = function(scene) {
  if (this._milkyWay) scene.remove(this._milkyWay);
  if (this._planetGroup) scene.remove(this._planetGroup);
  if (this._milkyGeo) this._milkyGeo.dispose();
  if (this._milkyMat) this._milkyMat.dispose();
  if (this._planetMats) {
    for (var i = 0; i < this._planetMats.length; i++) {
      this._planetMats[i].dispose();
    }
  }
};


// ============================================================
// Weather Audio — Procedural ambient sounds
// ============================================================
// Ported from TenkokuGlobalSound.cs (162 lines)

function WeatherAudio() {
  this._ctx = null;
  this._masterGain = null;
  this._windNode = null;
  this._windGain = null;
  this._rainNode = null;
  this._rainGain = null;
  this._enabled = false;
  this._volume = 0.5;
}

WeatherAudio.prototype._ensureContext = function() {
  if (this._ctx) return true;
  try {
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._volume;
    this._masterGain.connect(this._ctx.destination);

    // Wind: filtered white noise
    var windBuf = this._ctx.createBuffer(1, this._ctx.sampleRate * 2, this._ctx.sampleRate);
    var windData = windBuf.getChannelData(0);
    for (var i = 0; i < windData.length; i++) {
      windData[i] = (Math.random() - 0.5) * 0.3;
    }
    this._windNode = this._ctx.createBufferSource();
    this._windNode.buffer = windBuf;
    this._windNode.loop = true;
    var windFilter = this._ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 400;
    windFilter.Q.value = 0.5;
    this._windGain = this._ctx.createGain();
    this._windGain.gain.value = 0;
    this._windNode.connect(windFilter);
    windFilter.connect(this._windGain);
    this._windGain.connect(this._masterGain);
    this._windNode.start();

    // Rain: filtered pink noise with higher frequency
    var rainBuf = this._ctx.createBuffer(1, this._ctx.sampleRate * 2, this._ctx.sampleRate);
    var rainData = rainBuf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (var j = 0; j < rainData.length; j++) {
      var white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      rainData[j] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }
    this._rainNode = this._ctx.createBufferSource();
    this._rainNode.buffer = rainBuf;
    this._rainNode.loop = true;
    var rainFilter = this._ctx.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 2000;
    rainFilter.Q.value = 0.3;
    this._rainGain = this._ctx.createGain();
    this._rainGain.gain.value = 0;
    this._rainNode.connect(rainFilter);
    rainFilter.connect(this._rainGain);
    this._rainGain.connect(this._masterGain);
    this._rainNode.start();

    // Night ambient: cricket-like chirp oscillator (high-freq modulated sine)
    this._nightOsc = this._ctx.createOscillator();
    this._nightOsc.type = "sine";
    this._nightOsc.frequency.value = 4200; // cricket frequency
    var nightLFO = this._ctx.createOscillator();
    nightLFO.type = "square";
    nightLFO.frequency.value = 6; // chirp rate
    var lfoGain = this._ctx.createGain();
    lfoGain.gain.value = 4200; // modulate frequency fully
    nightLFO.connect(lfoGain);
    lfoGain.connect(this._nightOsc.frequency);
    this._nightGain = this._ctx.createGain();
    this._nightGain.gain.value = 0;
    this._nightOsc.connect(this._nightGain);
    this._nightGain.connect(this._masterGain);
    this._nightOsc.start();
    nightLFO.start();

    return true;
  } catch(e) {
    return false;
  }
};

WeatherAudio.prototype.update = function(precipType, precipIntensity, windStrength, settings, sunAltDeg) {
  this._enabled = settings.ambientAudio || false;
  this._volume = settings.audioVolume != null ? settings.audioVolume : 0.5;

  if (!this._enabled) {
    // Smooth fade out (not abrupt cut)
    if (this._windGain) this._windGain.gain.value *= 0.95;
    if (this._rainGain) this._rainGain.gain.value *= 0.95;
    return;
  }

  if (!this._ensureContext()) return;
  if (this._ctx.state === "suspended") this._ctx.resume();

  // Smooth cross-fade master volume (no clicks/pops)
  var targetMaster = this._volume;
  var currentMaster = this._masterGain.gain.value;
  this._masterGain.gain.value = currentMaster + (targetMaster - currentMaster) * 0.1;

  // Wind volume: always present, scales with weather intensity
  var targetWind = _clamp(0.05 + windStrength * 0.3, 0, 0.4);
  // Day/night ambient: wind is slightly louder at night (more noticeable)
  var isNight = (sunAltDeg || 0) < -6;
  if (isNight) targetWind = Math.max(targetWind, 0.08);
  // Smooth cross-fade wind
  var curWind = this._windGain.gain.value;
  this._windGain.gain.value = curWind + (targetWind - curWind) * 0.05;

  // Rain/snow volume with smooth cross-fade
  var targetRain = precipType === "rain" || precipType === "snow" ? precipIntensity * 0.5 : 0;
  targetRain = _clamp(targetRain, 0, 0.5);
  var curRain = this._rainGain.gain.value;
  this._rainGain.gain.value = curRain + (targetRain - curRain) * 0.05;

  // Night ambient: crickets (only at night, no rain)
  if (this._nightGain) {
    var targetNight = isNight && precipIntensity < 0.2 ? 0.02 : 0;
    var curNight = this._nightGain.gain.value;
    this._nightGain.gain.value = curNight + (targetNight - curNight) * 0.03;
  }
};

WeatherAudio.prototype.dispose = function() {
  try {
    if (this._windNode) this._windNode.stop();
    if (this._rainNode) this._rainNode.stop();
    if (this._nightOsc) this._nightOsc.stop();
    if (this._ctx) this._ctx.close();
  } catch(e) {}
  this._ctx = null;
};


// ============================================================
// Sun Shafts (God Rays) — Screen-space light shaft billboard
// ============================================================
// Simplified from TenkokuSunShafts.cs (156 lines)
// Full post-process radial blur requires depth buffer access;
// this uses additive billboard sprites radiating from sun position.

function SunShafts() {
  this._group = null;
  this._rays = [];
  this._sunDir = new THREE.Vector3(0, 1, 0);
  this._intensity = 0;
}

SunShafts.prototype.build = function(scene) {
  if (this._group) return;
  this._group = new THREE.Group();
  this._group.name = "__swa_sun_shafts__";
  this._group.renderOrder = -997;

  // Create ray billboards — elongated planes radiating from sun
  var rayCount = 8;
  var rayTex = this._createRayTexture();

  for (var i = 0; i < rayCount; i++) {
    var angle = (i / rayCount) * TWO_PI + Math.random() * 0.3;
    var length = 600 + Math.random() * 400;
    var width = 80 + Math.random() * 60;

    var geo = new THREE.PlaneGeometry(width, length);
    var mat = new THREE.MeshBasicMaterial({
      map: rayTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = angle;
    mesh.frustumCulled = false;
    this._group.add(mesh);
    this._rays.push({ mesh: mesh, mat: mat, angle: angle, baseLength: length });
  }

  scene.add(this._group);
};

SunShafts.prototype._createRayTexture = function() {
  var s = 64;
  var canvas = document.createElement("canvas");
  canvas.width = s; canvas.height = s * 4;
  var ctx = canvas.getContext("2d");

  // Elongated gradient fade (bright center, transparent edges)
  var grad = ctx.createLinearGradient(0, 0, 0, s * 4);
  grad.addColorStop(0, "rgba(255,240,200,0)");
  grad.addColorStop(0.3, "rgba(255,240,200,0.15)");
  grad.addColorStop(0.5, "rgba(255,245,220,0.25)");
  grad.addColorStop(0.7, "rgba(255,240,200,0.15)");
  grad.addColorStop(1, "rgba(255,240,200,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s * 4);

  // Horizontal fade (narrower at edges)
  var grad2 = ctx.createLinearGradient(0, 0, s, 0);
  grad2.addColorStop(0, "rgba(0,0,0,0)");
  grad2.addColorStop(0.3, "rgba(255,255,255,0.5)");
  grad2.addColorStop(0.5, "rgba(255,255,255,1)");
  grad2.addColorStop(0.7, "rgba(255,255,255,0.5)");
  grad2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, s, s * 4);

  var tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

SunShafts.prototype.update = function(camera, sunDir, sunAltDeg, settings, cloudCoverage) {
  if (!this._group) return;

  this._intensity = settings.godRays != null ? settings.godRays : 0.5;

  // Only visible when sun is above horizon and intensity > 0
  var visible = this._intensity > 0.01 && sunAltDeg > -2;
  this._group.visible = visible;
  if (!visible) return;

  // Position at sun location
  var dist = 450;
  if (camera) {
    this._group.position.set(
      camera.position.x + sunDir.x * dist,
      camera.position.y + sunDir.y * dist,
      camera.position.z + sunDir.z * dist
    );
    this._group.lookAt(camera.position);
  }

  // Fade based on sun altitude (strongest near horizon)
  var horizonFade = _smoothstep(40, 5, sunAltDeg); // strongest at low sun
  var opacity = this._intensity * horizonFade * 0.3;

  // Terrain occlusion — fade god rays when sun is behind terrain
  if (camera && typeof window !== "undefined" && window.__vibexe_getVisualTerrainHeight) {
    var sampleX = camera.position.x + sunDir.x * 50;
    var sampleZ = camera.position.z + sunDir.z * 50;
    var terrainH = window.__vibexe_getVisualTerrainHeight(sampleX, sampleZ);
    if (terrainH != null) {
      var sunRefY = camera.position.y + sunDir.y * 50;
      if (terrainH > sunRefY) {
        // Sun is behind terrain — fade to near zero
        var occlude = _clamp((terrainH - sunRefY) / 10, 0, 1);
        opacity *= (1 - occlude * 0.95);
      }
    }
  }

  // Cloud coverage fade — overcast blocks god rays
  var cc = cloudCoverage != null ? cloudCoverage : 0;
  if (cc > 0.5) {
    opacity *= _lerp(1, 0.05, _smoothstep(0.5, 0.9, cc));
  }

  for (var i = 0; i < this._rays.length; i++) {
    this._rays[i].mat.opacity = opacity * (0.5 + Math.random() * 0.5);
  }
};

SunShafts.prototype.dispose = function(scene) {
  if (this._group) {
    for (var i = 0; i < this._rays.length; i++) {
      this._rays[i].mesh.geometry.dispose();
      this._rays[i].mat.dispose();
    }
    scene.remove(this._group);
  }
  this._group = null;
  this._rays = [];
};


// ============================================================
// Fog Controller
// ============================================================

function FogController() {
  this._originalFog = null;
  this._active = false;
}

FogController.prototype.update = function(scene, sunAltDeg, settings, skyHorizonColor, weatherInfo) {
  if (settings.enabled === false) {
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

  // Clamp fog density to sane range — saved settings from DB may have bad values
  var baseDensity = _clamp(settings.density != null ? settings.density : 0.002, 0.0005, 0.008);
  var heightFalloff = settings.heightFalloff != null ? settings.heightFalloff : 0;

  // Height-based fog: increase density at lower camera heights
  var density = baseDensity;
  if (heightFalloff > 0) {
    var camera = window.__vibexe_camera__ || null;
    if (!camera) { scene.traverse(function(obj) { if (obj.isCamera && !camera) camera = obj; }); }
    if (camera) {
      var camY = Math.max(0, camera.position.y);
      // Exponential height falloff: denser at ground level (reduced multiplier)
      var heightMult = Math.exp(-camY * heightFalloff * 0.01);
      density = baseDensity * (1 + heightMult * 1.5); // was *3, caused extreme washout
    }
  }
  // Weather-coupled fog density — rain/storm auto-bumps density (Phase B.2)
  var wi = weatherInfo || {};
  if (wi.precipType === "rain") {
    density += wi.precipIntensity * 0.002; // rain haze
  } else if (wi.precipType === "snow") {
    density += wi.precipIntensity * 0.003; // snow reduces visibility more
  }
  if (wi.weatherState === "storm") {
    density = Math.max(density, 0.005); // storm minimum fog
  }
  // Hard cap: never exceed 0.012 (was uncapped — could reach 0.02+ with heightFalloff)
  density = Math.min(density, 0.012);

  if (!scene.fog || !scene.fog.isFogExp2) {
    scene.fog = new THREE.FogExp2(0x87CEEB, density);
  } else {
    scene.fog.density = density;
  }

  // Auto fog color: prefer sky horizon color from atmosphere, fall back to sun-altitude heuristic
  if (settings.autoColor !== false) {
    var fogR, fogG, fogB;
    if (skyHorizonColor && skyHorizonColor.length >= 3) {
      fogR = skyHorizonColor[0]; fogG = skyHorizonColor[1]; fogB = skyHorizonColor[2];
    } else {
      var altNorm = _clamp(sunAltDeg / 90, -1, 1);
      if (altNorm > 0.1) {
        fogR = 0.7; fogG = 0.8; fogB = 0.9;
      } else if (altNorm > -0.05) {
        var t = _smoothstep(-0.05, 0.1, altNorm);
        fogR = _lerp(0.4, 0.7, t);
        fogG = _lerp(0.25, 0.8, t);
        fogB = _lerp(0.15, 0.9, t);
      } else {
        fogR = 0.05; fogG = 0.05; fogB = 0.12;
      }
    }
    // Weather-tinted fog color (Phase E.3) — storms darker, snow brighter, dawn warm
    if (wi.weatherState === "storm") {
      fogR = _lerp(fogR, 0.30, 0.35); fogG = _lerp(fogG, 0.33, 0.35); fogB = _lerp(fogB, 0.40, 0.35);
    } else if (wi.weatherState === "rain") {
      fogR = _lerp(fogR, 0.40, 0.22); fogG = _lerp(fogG, 0.44, 0.22); fogB = _lerp(fogB, 0.50, 0.22);
    } else if (wi.weatherState === "snow") {
      fogR = _lerp(fogR, 0.72, 0.25); fogG = _lerp(fogG, 0.74, 0.25); fogB = _lerp(fogB, 0.78, 0.25);
    }
    scene.fog.color.setRGB(fogR, fogG, fogB);
  }
};

FogController.prototype.dispose = function(scene) {
  if (this._active && this._originalFog !== undefined) {
    scene.fog = this._originalFog;
  }
};


// ============================================================
// Valley / Ground Fog — semi-transparent plane at ground level
// ============================================================

function ValleyFog() {
  this._mesh = null;
  this._mat = null;
}

ValleyFog.prototype.build = function(scene) {
  var geo = new THREE.PlaneGeometry(800, 800);
  geo.rotateX(-Math.PI / 2); // lay flat
  this._mat = new THREE.MeshBasicMaterial({
    color: 0xcccccc,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  this._mesh = new THREE.Mesh(geo, this._mat);
  this._mesh.renderOrder = 900; // above terrain, below clouds
  this._mesh.frustumCulled = false;
  this._mesh.visible = false;
  scene.add(this._mesh);
};

ValleyFog.prototype.update = function(camera, sunAltDeg, fogSettings, weatherState) {
  if (!this._mesh) return;

  // Only visible when fog is enabled and valleyFog not explicitly disabled
  var fogEnabled = fogSettings && fogSettings.enabled !== false;
  var valleyEnabled = fogSettings && fogSettings.valleyFog !== false;
  if (!fogEnabled || !valleyEnabled) {
    this._mesh.visible = false;
    return;
  }

  this._mesh.visible = true;

  // Position: follow camera XZ, fixed Y at terrain base
  var baseY = (typeof window !== "undefined" && window.__vibexe_terrainBaseY__) || -2;
  if (camera) {
    this._mesh.position.set(camera.position.x, baseY, camera.position.z);
  }

  // Opacity based on weather state and time of day
  var opacity = 0.08; // clear default
  if (weatherState === "storm") {
    opacity = 0.35;
  } else if (weatherState === "rain") {
    opacity = 0.28;
  } else if (weatherState === "snow") {
    opacity = 0.32;
  } else if (weatherState === "overcast") {
    opacity = 0.15;
  }

  // Dawn/dusk boost (sun 0-15 degrees)
  if (sunAltDeg > -2 && sunAltDeg < 15) {
    var dawnBoost = _smoothstep(15, 3, sunAltDeg) * 0.18;
    opacity += dawnBoost;
  }
  // Night reduction
  if (sunAltDeg < -5) {
    opacity *= 0.5;
  }

  this._mat.opacity = _clamp(opacity, 0, 0.45);

  // Color: match scene fog color if available, slightly lighter
  var scene = this._mesh.parent;
  if (scene && scene.fog && scene.fog.color) {
    var fc = scene.fog.color;
    this._mat.color.setRGB(
      Math.min(1, fc.r + 0.12),
      Math.min(1, fc.g + 0.12),
      Math.min(1, fc.b + 0.10)
    );
  }
};

ValleyFog.prototype.dispose = function(scene) {
  if (this._mesh) {
    if (this._mesh.geometry) this._mesh.geometry.dispose();
    if (this._mat) this._mat.dispose();
    scene.remove(this._mesh);
    this._mesh = null;
    this._mat = null;
  }
};


// ============================================================
// SkyWeatherAdvancedSystem — Master controller
// ============================================================

function SkyWeatherAdvancedSystem(scene, settings) {
  this.scene = scene;
  this.settings = this._deepMerge(SkyWeatherAdvancedSystem.DEFAULTS, settings || {});

  // Sanitize settings — fix known-bad values from old DB saves
  // All checks use != null guard to avoid treating null/undefined as numeric
  var sky = this.settings.sky;
  if (sky.mieDirectionalG == null || sky.mieDirectionalG < 0.3) sky.mieDirectionalG = 0.65;
  if (sky.exposure == null || sky.exposure < 0.2 || sky.exposure > 4) sky.exposure = 1.2;
  if (sky.sunIntensity == null || sky.sunIntensity < 3) sky.sunIntensity = 22.0;
  if (sky.nightBrightness == null) sky.nightBrightness = 0.25;
  var fog = this.settings.fog;
  if (fog.density != null && fog.density > 0.05) fog.density = 0.008;
  var clouds = this.settings.clouds;
  // If coverage was saved as exactly 0 or null, restore to default partly-cloudy
  if (clouds.coverage == null) {
    clouds.coverage = 0.35;
  }
  // Allow full 0-1 range — weather presets need high values
  if (clouds.brightness == null || clouds.brightness < 0.1) clouds.brightness = 1.0;
  // Precipitation is preserved from saved settings — weather presets set it explicitly
  // (Previously cleared precipitation when auto-forecast was off, breaking presets)
  // Fix timezone/longitude mismatch — timezone should roughly match longitude/15
  var ts = this.settings.time;
  if (ts.longitude != null && ts.timezone != null) {
    var expectedTz = Math.round(ts.longitude / 15);
    // If mismatch is > 3 hours, reset to defaults (Japan)
    if (Math.abs(ts.timezone - expectedTz) > 3) {
      ts.latitude = 35;
      ts.longitude = 136;
      ts.timezone = 9;
    }
  }
  // Set fog defaults if not configured (don't force — respect user preference)
  if (fog.density == null) fog.density = 0.002;

  this.orbital = new OrbitalCalculator();
  this.atmosphere = new AtmosphereRenderer();
  this.lighting = new SkyLightingController();
  this.clouds = new CloudSystem();
  this.moon = new MoonRenderer();
  this.lightning = new LightningEffect();
  this.aurora = new AuroraRenderer();
  this.weather = new WeatherStateMachine();
  this.milkyWay = new MilkyWayAndPlanets();
  this.sunShafts = new SunShafts();
  this.sunDisk = new SunDiskRenderer();
  this.audio = new WeatherAudio();
  this.particles = new WeatherParticles();
  this.stars = new StarField();
  this.shootingStars = new ShootingStarsRenderer();
  this.rainbow = new RainbowRenderer();
  this.fog = new FogController();
  this.valleyFog = new ValleyFog();

  this._time = 0;
  this._lastUpdate = Date.now();
  this._skyUpdateTimer = 0;
  this._skyUpdateInterval = 2.0; // Recompute sky colors every 2 seconds
  this._cloudUpdateTimer = 0;
  this._cloudUpdateInterval = 3.0; // Recompute cloud noise every 3 seconds (wind UV offset still per-frame)

  // Initialize all subsystems
  this.atmosphere.build(scene);
  this.clouds.build(scene);
  this.moon.build(scene);
  this.lightning.init(scene);
  this.aurora.build(scene);
  this.milkyWay.init(scene);
  this.sunShafts.build(scene);
  this.sunDisk.build(scene);
  this.lighting.init(scene);
  this.particles.init(scene);
  this.stars.init(scene);
  this.shootingStars.init(scene);
  this.rainbow.build(scene);
  this.valleyFog.build(scene);

  // Initial solar calculation
  var ts = this.settings.time || {};
  this.orbital.update(
    ts.solarTime != null ? ts.solarTime : 0.45,
    ts.latitude != null ? ts.latitude : 45,
    ts.longitude != null ? ts.longitude : 0,
    ts.year || 2024,
    ts.month || 6,
    ts.day || 21,
    ts.timezone != null ? ts.timezone : 0
  );

  // Set initial atmosphere
  var initSky = this.settings.sky || {};
  this.atmosphere._exposure = initSky.exposure != null ? initSky.exposure : 1.2;
  this.atmosphere._mieG = initSky.mieDirectionalG != null ? initSky.mieDirectionalG : 0.76;
  this.atmosphere._starIntensity = initSky.starIntensity != null ? initSky.starIntensity : 1.0;
  this.atmosphere._nightBrightness = initSky.nightBrightness != null ? initSky.nightBrightness : 0.25;
  this.atmosphere._solarTime = ts.solarTime != null ? ts.solarTime : 0.45;
  this.atmosphere._moonDir = [this.orbital.moonDirection.x, this.orbital.moonDirection.y, this.orbital.moonDirection.z];
  this.atmosphere.setSunDirection(this.orbital.sunDirection);

  // Set scene.background to zenith color as safety net (dome gradient renders on top)
  // Vertex colors are now in linear space (no manual gamma), use directly
  this._origBg = this.scene ? this.scene.background : null;
  var zenithColor = this.atmosphere._computeSkyColor([0, 1, 0]);
  if (this.scene) {
    this.scene.background = new THREE.Color(zenithColor[0], zenithColor[1], zenithColor[2]);
  }

  // Initialize cloud coverage + render immediately
  var cs = this.settings.clouds || {};
  this.clouds._coverage = cs.coverage != null ? cs.coverage : 0.35;
  this.clouds._sunDir = [this.orbital.sunDirection.x, this.orbital.sunDirection.y, this.orbital.sunDirection.z];
  if (this.clouds._dome) this.clouds._dome.visible = this.clouds._coverage > 0.01;
  this.clouds.updateTexture(this.atmosphere);

  // Hook into game loop
  this._animFrameId = null;
  this._startLoop();

  console.log("[SkyWeatherAdvanced] Initialized — Tenkoku atmosphere active");
}

SkyWeatherAdvancedSystem.DEFAULTS = {
  time: {
    solarTime: 0.65,
    cycleLengthMinutes: 10,
    autoAdvance: true,
    latitude: 35,
    longitude: 136,
    timezone: 9,
    year: 2024,
    month: 6,
    day: 21,
  },
  sky: {
    sunDiskSize: 0.028,
    moonDiskSize: 0.022,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.65,
    starIntensity: 1.0,
    nightBrightness: 0.25,
    exposure: 1.2,
    rayleighScale: 1.0,
    sunIntensity: 22.0,
    galaxyIntensity: 0,
    planetIntensity: 0,
    moonBrightness: 1.0,
  },
  lighting: {
    autoSunLight: true,
    autoAmbient: true,
    sunIntensity: 1.5,
    ambientIntensity: 0.4,
    shadowsEnabled: true,
  },
  fog: {
    enabled: true,
    autoColor: true,
    density: 0.0015,
    heightFalloff: 0.3,
  },
  clouds: {
    coverage: 0.35,
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
  weather: {
    autoForecast: false,
    forecastInterval: 60,
  },
  effects: {
    godRays: 0.5,
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

  // Orphan detection: re-add sky dome if removed from scene
  if (this.atmosphere.dome && !this.atmosphere.dome.parent && this.scene) {
    this.scene.add(this.atmosphere.dome);
  }

  // Auto-advance time
  if (ts.autoAdvance && ts.cycleLengthMinutes > 0) {
    ts.solarTime = (ts.solarTime != null ? ts.solarTime : 0) + dt / (ts.cycleLengthMinutes * 60);
    if (ts.solarTime >= 1) ts.solarTime -= 1;
  }

  // Update orbital calculator — skip if inputs unchanged (32 trig + Kepler = expensive)
  var _st = ts.solarTime != null ? ts.solarTime : 0.45;
  if (this._lastSolarTime === undefined || Math.abs(_st - this._lastSolarTime) > 0.001) {
    this._lastSolarTime = _st;
    this.orbital.update(
      _st,
      ts.latitude != null ? ts.latitude : 45,
      ts.longitude != null ? ts.longitude : 0,
      ts.year || 2024,
      ts.month || 6,
      ts.day || 21,
      ts.timezone != null ? ts.timezone : 0
    );
  }

  var sunAltDeg = this.orbital.sunAltitude * RAD2DEG;

  // Throttled sky recompute (expensive vertex color calculation)
  this._skyUpdateTimer += dt;
  if (this._skyUpdateTimer >= this._skyUpdateInterval) {
    this._skyUpdateTimer = 0;

    var skySettings = this.settings.sky || {};
    this.atmosphere._exposure = _clamp(skySettings.exposure != null ? skySettings.exposure : 1.2, 0.3, 5.0);
    // mieG: 0.3-0.99 (Tenkoku default 0.5, our default 0.65)
    this.atmosphere._mieG = _clamp(skySettings.mieDirectionalG != null ? skySettings.mieDirectionalG : 0.65, 0.3, 0.99);
    this.atmosphere._rayleighScale = _clamp(skySettings.rayleighScale != null ? skySettings.rayleighScale : 1.0, 0.5, 3.0);
    this.atmosphere._sunIntensity = _clamp(skySettings.sunIntensity != null ? skySettings.sunIntensity : 22.0, 2.0, 50.0);
    this.atmosphere._starIntensity = _clamp(skySettings.starIntensity != null ? skySettings.starIntensity : 1.0, 0, 3.0);
    this.atmosphere._nightBrightness = _clamp(skySettings.nightBrightness != null ? skySettings.nightBrightness : 0.2, 0, 1.0);
    this.atmosphere._solarTime = ts.solarTime != null ? ts.solarTime : 0.45;
    this.atmosphere._time = this._time;
    this.atmosphere._moonDir = [this.orbital.moonDirection.x, this.orbital.moonDirection.y, this.orbital.moonDirection.z];

    // Overcast amount for atmosphere desaturation (Task 6)
    var overcastAmt = (this.settings.clouds || {}).coverage != null ? (this.settings.clouds || {}).coverage : 0;
    this.atmosphere._overcastAmount = overcastAmt;

    // Sky tinting from settings (Task 12)
    if (skySettings.skyTintColor) {
      this.atmosphere._skyTintColor = skySettings.skyTintColor;
      this.atmosphere._skyTintAlpha = skySettings.skyTintAlpha != null ? skySettings.skyTintAlpha : 0;
    }

    this.atmosphere.setSunDirection(this.orbital.sunDirection);

    // Sync scene.background to zenith color as fallback (dome gradient renders on top)
    var zenithColor = this.atmosphere._computeSkyColor([0, 1, 0]);
    if (this.scene) {
      if (!this.scene.background) this.scene.background = new THREE.Color();
      this.scene.background.setRGB(zenithColor[0], zenithColor[1], zenithColor[2]);
    }

    // Overcast reduces exposure mildly (desaturation handles most of the dimming)
    if (overcastAmt > 0.6) {
      this.atmosphere._exposure *= _lerp(1.0, 0.82, (overcastAmt - 0.6) * 2.5); // was 0.6 at 50%, now 0.82 at 60%
    }
  }

  // Camera follow — use cached ref, global first (O(1)), traverse only as fallback once
  if (!this._cachedCamera) {
    if (window.__vibexe_camera__) {
      this._cachedCamera = window.__vibexe_camera__;
    } else {
      this.scene.traverse(function(obj) {
        if (obj.isCamera && !this._cachedCamera) this._cachedCamera = obj;
      }.bind(this));
    }
  }
  var camera = this._cachedCamera || null;
  if (camera) this.atmosphere.followCamera(camera);

  // Lighting — pass weather state for color grading
  this.lighting.update(
    this.orbital.sunDirection,
    sunAltDeg,
    this.settings.lighting || {},
    this.weather._currentState
  );

  // Clouds
  this.clouds.update(dt, camera, this.orbital.sunDirection, this.settings.clouds || {}, this.orbital.moonDirection, this.orbital.moonPhase);
  this._cloudUpdateTimer += dt;
  if (this._cloudUpdateTimer >= this._cloudUpdateInterval) {
    this._cloudUpdateTimer = 0;
    this.clouds.updateTexture(this.atmosphere);
  }

  // Moon
  this.moon.update(
    camera,
    this.orbital.moonDirection,
    this.orbital.sunDirection,
    this.orbital.moonPhase,
    sunAltDeg,
    this.settings.sky || {}
  );

  // Stars (with sidereal rotation)
  this.stars.update(sunAltDeg, camera, this._time, this.settings.sky || {}, ts.solarTime != null ? ts.solarTime : 0.45, ts.latitude);

  // Shooting stars (meteors) — skip during daytime (sun > 5°)
  if (sunAltDeg < 5) {
    this.shootingStars.update(dt, camera, sunAltDeg, this.settings.effects || {});
  }

  // Lightning — skip if disabled
  var _ltn = this.settings.lightning || {};
  if (_ltn.enabled) {
    this.lightning.update(dt, camera, _ltn);
  }

  // Aurora — skip if latitude < 50 (aurora invisible at low latitudes)
  var _lat = (this.settings.time || {}).latitude;
  _lat = _lat != null ? _lat : 45;
  if (_lat >= 50) {
    this.aurora.update(dt, camera, _lat, sunAltDeg, this.settings.effects || {});
  }

  // Weather state machine (auto-forecast drives clouds, precipitation, lightning)
  var weatherSettings = this.settings.weather || {};
  weatherSettings.latitude = _lat;
  this.weather.update(dt, weatherSettings);

  // Apply weather state to subsystems if auto-forecast is active
  if ((this.settings.weather || {}).autoForecast) {
    this.settings.clouds.coverage = this.weather.cloudCoverage;
    this.settings.precipitation.type = this.weather.precipType;
    this.settings.precipitation.intensity = this.weather.precipIntensity;
    this.settings.precipitation.windStrength = this.weather.windStrength;
    this.settings.lightning.enabled = this.weather.lightningEnabled;

    // Overcast dimming: reduce sky exposure and sun intensity when heavily overcast
    var overcastDim = _clamp(this.weather.cloudCoverage - 0.5, 0, 0.5) * 2; // 0 at 50%, 1 at 100%
    var baseSunInt = (this.settings.sky || {}).sunIntensity;
    this.atmosphere._sunIntensity = _lerp(
      baseSunInt != null ? baseSunInt : 22.0,
      8.0,
      overcastDim
    );
  }

  // Precipitation
  this.particles.update(dt, camera, this.settings.precipitation || {});

  // Rainbow — visible after rain when sun is low
  this.rainbow.update(
    dt, camera, this.orbital.sunDirection, sunAltDeg,
    this.settings.precipitation || {},
    this.settings.effects || {}
  );

  // Milky Way + Planets — skip during daytime (sun > 5°)
  if (sunAltDeg < 5) {
    this.milkyWay.update(sunAltDeg, camera, this._time, this.orbital._dayNumber, this.settings.sky || {});
  }

  // Weather Audio
  this.audio.update(
    this.settings.precipitation.type || "none",
    this.settings.precipitation.intensity || 0,
    this.settings.precipitation.windStrength != null ? this.settings.precipitation.windStrength : 0.3,
    this.settings.effects || {},
    sunAltDeg
  );

  // Fog — pass sky horizon color + weather info for accurate color matching
  var horizonColor = this.atmosphere.getHorizonColor();
  var _wi = {
    weatherState: this.weather._currentState,
    precipType: (this.settings.precipitation || {}).type || "none",
    precipIntensity: (this.settings.precipitation || {}).intensity || 0,
  };
  this.fog.update(this.scene, sunAltDeg, this.settings.fog || {}, horizonColor, _wi);

  // Valley fog — ground-level mist plane
  this.valleyFog.update(camera, sunAltDeg, this.settings.fog || {}, this.weather._currentState);

  // Sun Shafts (god rays) — skip if disabled
  var _eff = this.settings.effects || {};
  var _cloudCov = (this.settings.clouds || {}).coverage || 0;
  if (_eff.godRays) {
    this.sunShafts.update(camera, this.orbital.sunDirection, sunAltDeg, _eff, _cloudCov);
  }

  // Sun disk billboard
  this.sunDisk.update(camera, this.orbital.sunDirection, sunAltDeg, this.settings.sky || {});
};

// Update settings from external source (bridge message)
SkyWeatherAdvancedSystem.prototype.updateSettings = function(patch) {
  this.settings = this._deepMerge(this.settings, patch);

  // Re-sanitize after every settings update — panel sends full DB config
  // which may contain bad saved values that override our init sanitization
  var sky = this.settings.sky;
  if (sky.mieDirectionalG == null || sky.mieDirectionalG < 0.3) sky.mieDirectionalG = 0.65;
  if (sky.exposure == null || sky.exposure < 0.2 || sky.exposure > 4) sky.exposure = 1.2;
  if (sky.sunIntensity == null || sky.sunIntensity < 2) sky.sunIntensity = 22.0;
  if (sky.nightBrightness == null) sky.nightBrightness = 0.25;
  var fog = this.settings.fog;
  if (fog.density != null && fog.density > 0.05) fog.density = 0.008;
  // Respect user's fog preference — don't force enable
  // Cloud coverage: DB saves 0 which means no clouds — restore default
  var clouds = this.settings.clouds;
  if (clouds.coverage == null) clouds.coverage = 0.35;
  // Allow full 0-1 range — weather presets need high coverage (Overcast=0.95, Stormy=0.95)
  if (clouds.brightness == null || clouds.brightness < 0.1) clouds.brightness = 1.0;
  var ts = this.settings.time;
  if (ts.longitude != null && ts.timezone != null) {
    var expectedTz = Math.round(ts.longitude / 15);
    if (Math.abs(ts.timezone - expectedTz) > 3) {
      ts.latitude = 35; ts.longitude = 136; ts.timezone = 9;
    }
  }

  // Force immediate sky recompute on settings change
  this._skyUpdateTimer = this._skyUpdateInterval;
  this._cloudUpdateTimer = this._cloudUpdateInterval;
};

SkyWeatherAdvancedSystem.prototype.destroy = function() {
  if (this._animFrameId) {
    cancelAnimationFrame(this._animFrameId);
    this._animFrameId = null;
  }
  // Restore original scene background
  if (this.scene && this._origBg !== undefined) {
    this.scene.background = this._origBg;
  }
  this.atmosphere.dispose();
  this.clouds.dispose(this.scene);
  this.moon.dispose(this.scene);
  this.lightning.dispose(this.scene);
  this.aurora.dispose(this.scene);
  this.milkyWay.dispose(this.scene);
  this.sunShafts.dispose(this.scene);
  this.sunDisk.dispose(this.scene);
  this.audio.dispose();
  this.lighting.dispose(this.scene);
  this.particles.dispose(this.scene);
  this.stars.dispose(this.scene);
  this.shootingStars.dispose(this.scene);
  this.rainbow.dispose(this.scene);
  this.fog.dispose(this.scene);
  this.valleyFog.dispose(this.scene);
  console.log("[SkyWeatherAdvanced] Destroyed");
};


// ============================================================
// Environment Presets
// ============================================================

var ENVIRONMENT_PRESETS = {
  tropical: {
    time: { latitude: 10, solarTime: 0.42 },
    sky: { exposure: 1.4, mieDirectionalG: 0.85 },
    clouds: { coverage: 0.3, speed: 0.5, brightness: 1.2 },
    fog: { enabled: true, density: 0.002 },
    effects: { aurora: 0 },
  },
  temperate: {
    time: { latitude: 45, solarTime: 0.45 },
    sky: { exposure: 1.2, mieDirectionalG: 0.76 },
    clouds: { coverage: 0.4, speed: 1.0, brightness: 1.0 },
    fog: { enabled: false },
    effects: { aurora: 0 },
  },
  arctic: {
    time: { latitude: 68, solarTime: 0.35 },
    sky: { exposure: 1.0, mieDirectionalG: 0.7 },
    clouds: { coverage: 0.6, speed: 1.5, brightness: 0.8 },
    fog: { enabled: true, density: 0.005, heightFalloff: 2 },
    precipitation: { type: "snow", intensity: 0.3, windStrength: 0.5 },
    effects: { aurora: 0.7 },
  },
  desert: {
    time: { latitude: 25, solarTime: 0.52 },
    sky: { exposure: 1.6, mieDirectionalG: 0.9, rayleighScale: 0.8 },
    clouds: { coverage: 0.05, speed: 0.3, brightness: 1.3 },
    fog: { enabled: true, density: 0.001 },
    effects: { aurora: 0 },
  },
  alien: {
    time: { latitude: 30, solarTime: 0.4 },
    sky: { exposure: 0.8, mieDirectionalG: 0.95, rayleighScale: 2.0, sunIntensity: 15 },
    clouds: { coverage: 0.7, speed: 2.0, brightness: 0.6 },
    fog: { enabled: true, density: 0.008 },
    effects: { aurora: 0.5 },
  },
  nordic: {
    time: { latitude: 60, solarTime: 0.3 },
    sky: { exposure: 1.1, mieDirectionalG: 0.72 },
    clouds: { coverage: 0.55, speed: 1.2, brightness: 0.9 },
    fog: { enabled: true, density: 0.004, heightFalloff: 3 },
    precipitation: { type: "none", windStrength: 0.6 },
    effects: { aurora: 0.4 },
  },
};

SkyWeatherAdvancedSystem.prototype.applyPreset = function(presetName) {
  var preset = ENVIRONMENT_PRESETS[presetName];
  if (preset) {
    this.updateSettings(preset);
    console.log("[SkyWeatherAdvanced] Applied preset: " + presetName);
  }
};


// ============================================================
// Bridge Message Handlers
// ============================================================

SkyWeatherAdvancedSystem.prototype.handleBridgeMessage = function(type, payload) {
  // Normalize: accept both "sky-weather-" and "sky-weather-advanced-" prefixes
  // so the existing SkyWeatherPanel UI works without modification
  var t = type.replace("sky-weather-advanced-", "").replace("sky-weather-", "");

  switch (t) {
    case "set-time":
      if (payload.solarTime !== undefined) {
        this.settings.time.solarTime = payload.solarTime;
      }
      if (payload.autoAdvance !== undefined) {
        this.settings.time.autoAdvance = payload.autoAdvance;
      }
      this._skyUpdateTimer = this._skyUpdateInterval; // force sky refresh
      break;

    case "set-preset":
      if (payload.preset) {
        this.applyPreset(payload.preset);
      }
      break;

    case "update-config":
      this.updateSettings(payload.config || payload);
      break;

    case "set-weather":
      if (payload.state) {
        this.weather.setState(payload.state);
      }
      break;
  }
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
    CloudSystem: CloudSystem,
    MoonRenderer: MoonRenderer,
    LightningEffect: LightningEffect,
    AuroraRenderer: AuroraRenderer,
    WeatherStateMachine: WeatherStateMachine,
    MilkyWayAndPlanets: MilkyWayAndPlanets,
    WeatherAudio: WeatherAudio,
    SunShafts: SunShafts,
    SunDiskRenderer: SunDiskRenderer,
    SkyLightingController: SkyLightingController,
    WeatherParticles: WeatherParticles,
    StarField: StarField,
    ShootingStarsRenderer: ShootingStarsRenderer,
    RainbowRenderer: RainbowRenderer,
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
            // Config migration: if old sky-weather config exists, use it as fallback
            if (!Object.keys(settings).length) {
              if (gs.skyWeather && typeof gs.skyWeather === "object") {
                settings = gs.skyWeather;
                console.log("[SkyWeatherAdvanced] Migrated config from sky-weather");
              } else if (gs.modules && gs.modules.installed && gs.modules.installed["sky-weather"]) {
                settings = gs.modules.installed["sky-weather"].config || {};
                console.log("[SkyWeatherAdvanced] Migrated config from sky-weather module");
              }
            }
          }
        } catch(e) {}
        window.__vibexe_skyWeatherAdvanced = new SkyWeatherAdvancedSystem(scene, settings);

        // Listen for bridge messages
        window.addEventListener("message", function(ev) {
          if (!ev.data || !ev.data.type) return;
          var sys = window.__vibexe_skyWeatherAdvanced;
          if (!sys) return;
          if (ev.data.type.indexOf("sky-weather-") === 0) {
            sys.handleBridgeMessage(ev.data.type, ev.data.payload || ev.data);
          }
        });
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
  ShootingStarsRenderer: ShootingStarsRenderer,
  RainbowRenderer: RainbowRenderer,
  FogController: FogController
};
`,
	bridgeHandlers: {
		"sky-weather-advanced-set-time": "handleSetTime",
		"sky-weather-advanced-set-preset": "handleSetPreset",
		"sky-weather-advanced-update-config": "handleUpdateConfig",
		"sky-weather-advanced-set-weather": "handleSetWeather",
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
			galaxyIntensity: 1.0,
			planetIntensity: 1.0,
			moonBrightness: 1.0,
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
		weather: {
			autoForecast: false,
			forecastInterval: 60,
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
