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
	version: "1.2.0",
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
var INCOMING_LIGHT_RATIO = [0.80, 0.867, 1.333];

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
  // Sun corona — wide warm bloom around sun (Tenkoku sun haze)
  if (cosAngle > 0.985 && sunDir[1] > -0.05) {
    var coronaT = _smoothstep(0.985, 0.999, cosAngle);
    var coronaI = coronaT * 0.25 * _clamp(sunDir[1] + 0.1, 0, 1);
    r += coronaI * 1.0;
    gn += coronaI * 0.9;
    b += coronaI * 0.55;
  }
  // Outer sun haze — very wide subtle warm glow (Tenkoku reference shows large halo)
  if (cosAngle > 0.96 && sunDir[1] > 0) {
    var hazeT = _smoothstep(0.96, 0.99, cosAngle);
    var hazeI = hazeT * 0.08 * _clamp(sunDir[1], 0, 0.5) * 2;
    r += hazeI * 1.0;
    gn += hazeI * 0.85;
    b += hazeI * 0.5;
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

  // Inscatter haze — subtle pale blue-white at horizon (atmospheric perspective)
  var horizonFac = 1.0 - Math.abs(viewDir[1]);
  var hazeFac = horizonFac * horizonFac * horizonFac * 0.15;
  r = _lerp(r, 0.65, hazeFac);
  gn = _lerp(gn, 0.70, hazeFac);
  b = _lerp(b, 0.78, hazeFac);

  // Horizon warmth — warm up near horizon when sun is low (Tenkoku golden glow)
  horizonFac = horizonFac * horizonFac * horizonFac;
  var sunHorizFac = Math.max(0, 1.0 - Math.abs(sunDir[1]) * 2.5);
  var warmth = horizonFac * sunHorizFac * 0.50;
  r += warmth * 1.0;
  gn += warmth * 0.45;
  b += warmth * 0.08;

  // Sun-facing horizon glow — extra warmth toward the sun
  var viewSunDot = rd[0]*sunDir[0] + rd[2]*sunDir[2];
  var sunGlow = _clamp(viewSunDot, 0, 1) * horizonFac * sunHorizFac * 0.25;
  r += sunGlow * 1.0;
  gn += sunGlow * 0.35;

  // Dawn/Dusk pink-purple band — mid-altitude coloring (Tenkoku Clear-Altostratus ref)
  if (Math.abs(sunDir[1]) < 0.20) {
    var pinkAlt = _clamp(viewDir[1], 0, 1);
    var pinkBand = _smoothstep(0.0, 0.12, pinkAlt) * _smoothstep(0.6, 0.12, pinkAlt);
    var pinkStr = pinkBand * (1.0 - Math.abs(sunDir[1]) / 0.20) * 0.18;
    r += pinkStr * 1.0;
    gn += pinkStr * 0.15;
    b += pinkStr * 0.8;
  }
  // Upper sky purple tint at dawn/dusk — zenith becomes purple (Tenkoku ref)
  if (Math.abs(sunDir[1]) < 0.15 && viewDir[1] > 0.3) {
    var purpleZenith = _smoothstep(0.3, 0.8, viewDir[1]);
    var purpleStr = purpleZenith * (1.0 - Math.abs(sunDir[1]) / 0.15) * 0.06;
    r += purpleStr * 0.6;
    b += purpleStr * 0.9;
  }

  // Boost saturation for vivid colors — stronger for richer sky
  var luma = r * 0.299 + gn * 0.587 + b * 0.114;
  var satBoost = 1.35;
  r = luma + (r - luma) * satBoost;
  gn = luma + (gn - luma) * satBoost;
  b = luma + (b - luma) * satBoost;

  // Deeper blue at zenith — stronger push for contrast between zenith and horizon
  var zenithFac = _clamp(viewDir[1], 0, 1);
  zenithFac = zenithFac * zenithFac;
  b += zenithFac * 0.04;
  r -= zenithFac * 0.02;
  gn -= zenithFac * 0.005;

  // Overcast sky desaturation — only at high coverage (70%+), gradual
  // Previous bug: overcast*3 caused FULL desaturation at just 35% coverage
  var overcast = this._overcastAmount;
  if (overcast > 0.5) {
    var grey = Math.max(r, Math.max(gn, b)) * 0.15;
    var overcastT = _clamp((overcast - 0.5) * 2, 0, 0.8); // 0 at 50%, 0.8 at 100%
    r = _lerp(r, grey, overcastT);
    gn = _lerp(gn, grey, overcastT);
    b = _lerp(b, grey, overcastT);
  }

  // Sky tinting (Task 12 — Tenkoku globalSkyColor)
  if (this._skyTintAlpha > 0) {
    r = _lerp(r, r * this._skyTintColor[0], this._skyTintAlpha);
    gn = _lerp(gn, gn * this._skyTintColor[1], this._skyTintAlpha);
    b = _lerp(b, b * this._skyTintColor[2], this._skyTintAlpha);
  }

  // Night sky brightness — dark blue-black gradient (not pure black)
  var nightBright = this._nightBrightness;
  var nightR = 0.018 * nightBright;
  var nightG = 0.022 * nightBright;
  var nightB = 0.045 * nightBright; // bluer night sky
  r = Math.max(r, nightR);
  gn = Math.max(gn, nightG);
  b = Math.max(b, nightB);

  // Night horizon brightening — atmospheric glow visible near horizon
  var sunAlt01 = _clamp(sunDir[1], -1, 1);
  var isNight = _clamp(-sunAlt01 * 5, 0, 1);
  if (isNight > 0.01) {
    var nhFac = _clamp(1.0 - viewDir[1] * 2.5, 0, 1);
    nhFac = nhFac * nhFac * nhFac; // cubic falloff for softer glow
    var nightHorizon = nhFac * isNight * nightBright * 0.2;
    r += nightHorizon * 0.06;
    gn += nightHorizon * 0.065;
    b += nightHorizon * 0.09; // blue-ish horizon glow
  }

  return [_clamp(r, 0, 1), _clamp(gn, 0, 1), _clamp(b, 0, 1)];
};

// Build the sky dome mesh with vertex colors
AtmosphereRenderer.prototype.build = function(scene) {
  if (this.dome) return;

  var segW = 96, segH = 48; // high resolution = ~4600 vertices, ~1600 star highlights at night
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
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];

    // Stars are now rendered on a separate textured dome (StarField class)
    // instead of vertex highlights which caused visible triangle patterns.
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

  // Size — Tenkoku reference shows prominent sun disk with wide glow
  // sunDiskSize 0.028 → scale 4.2 (84 world-unit disk at 450 dist ≈ 10.7° apparent)
  var diskSize = (settings.sunDiskSize != null ? settings.sunDiskSize : 0.028) * 5000;
  var diskScale = diskSize / 33; // large enough to be Tenkoku-like
  if (this._diskMesh) this._diskMesh.scale.setScalar(diskScale);
  // Glow halo: 6x disk scale (geometry is 4x larger → 24x total = ~50° visible bloom)
  if (this._glowMesh) this._glowMesh.scale.setScalar(diskScale * 6.0);

  // Hide when sun below horizon
  this._group.visible = sunAltDeg > -2;

  // Fade near horizon
  var horizFade = _clamp((sunAltDeg + 2) / 10, 0, 1);
  if (this._diskMesh && this._diskMesh.material) this._diskMesh.material.opacity = horizFade;
  // Glow always visible when sun is up — stronger opacity for visibility from wider angles
  var glowOpacity = sunAltDeg < 20 ? horizFade * 0.95 : horizFade * 0.7;
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

SkyLightingController.prototype.update = function(sunDir, sunAltDeg, settings) {
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
      // Night: dim moonlight from above (Tenkoku: moonLightIntensity=0.25, reduced for dark nights)
      this.sunLight.intensity = 0.06;
      this.sunLight.position.set(20, 80, 20);
    }

    // Sun color temperature
    if (altNorm > 0.15) {
      // High sun (>13.5°): warm white
      this.sunLight.color.setRGB(1.0, 0.96, 0.92);
    } else if (altNorm > 0) {
      // Low sun (0°-13.5°): orange-gold
      var warmT = _smoothstep(0, 0.15, altNorm);
      this.sunLight.color.setRGB(
        _lerp(1.0, 1.0, warmT),
        _lerp(0.65, 0.96, warmT),
        _lerp(0.3, 0.92, warmT)
      );
    } else {
      // Below horizon: cool blue moonlight
      this.sunLight.color.setRGB(0.3, 0.35, 0.55);
    }
  }

  if (autoAmbient && this.ambientLight) {
    var ambIntensity = settings.ambientIntensity != null ? settings.ambientIntensity : 0.4;
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
      // Night — dark ambient for dramatic nights (moonlight + stars provide visibility)
      this.ambientLight.intensity = 0.05;
      this.ambientLight.color.setRGB(0.08, 0.08, 0.18);
      if (isHemi) this.ambientLight.groundColor.setRGB(0.02, 0.02, 0.04);
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
// Weather Particles (rain/snow)
// ============================================================

function WeatherParticles() {
  this._rain = null;
  this._snow = null;
  this._rainGeo = null;
  this._snowGeo = null;
  this._rainMat = null;
  this._snowMat = null;
  this._particleCount = 2000;
  this._windDir = 0;
  this._windStrength = 0.3;
}

WeatherParticles.prototype.init = function(scene) {
  // Rain
  this._rainGeo = new THREE.BufferGeometry();
  var rPos = new Float32Array(this._particleCount * 3);
  var rVel = new Float32Array(this._particleCount);
  for (var i = 0; i < this._particleCount; i++) {
    // Cluster more particles near center for denser visual feel
    var rDist = Math.pow(Math.random(), 0.6); // bias toward center
    var rAngle = Math.random() * TWO_PI;
    rPos[i*3]   = Math.cos(rAngle) * rDist * 50;
    rPos[i*3+1] = Math.random() * 50;
    rPos[i*3+2] = Math.sin(rAngle) * rDist * 50;
    rVel[i] = 18 + Math.random() * 12; // faster rain
  }
  this._rainGeo.setAttribute("position", new THREE.BufferAttribute(rPos, 3));
  this._rainVelocities = rVel;

  this._rainMat = new THREE.PointsMaterial({
    map: _getSwaRainTex(),
    size: 2.0, // prominent rain streaks (Tenkoku shows dense visible streaks)
    transparent: true,
    opacity: 0.85,
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
    var sDist = Math.pow(Math.random(), 0.6);
    var sAngle = Math.random() * TWO_PI;
    sPos[j*3]   = Math.cos(sAngle) * sDist * 45;
    sPos[j*3+1] = Math.random() * 35;
    sPos[j*3+2] = Math.sin(sAngle) * sDist * 45;
    sVel[j] = 1.5 + Math.random() * 2.5; // slightly faster
  }
  this._snowGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  this._snowVelocities = sVel;

  this._snowMat = new THREE.PointsMaterial({
    map: _getSwaSnowTex(),
    size: 2.5, // large visible snowflakes (Tenkoku reference)
    transparent: true,
    opacity: 0.9,
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
  this._windDir = (settings.windDirection != null ? settings.windDirection : 0) * DEG2RAD;
  this._windStrength = settings.windStrength != null ? settings.windStrength : 0.3;

  this._rain.visible = precipType === "rain" && intensity > 0;
  this._snow.visible = precipType === "snow" && intensity > 0;

  if (this._rain.visible) {
    this._animateParticles(this._rainGeo, this._rainVelocities, dt, camera, intensity, true);
    this._rainMat.opacity = _clamp(intensity * 0.8, 0.2, 0.95);
  }
  if (this._snow.visible) {
    this._animateParticles(this._snowGeo, this._snowVelocities, dt, camera, intensity, false);
    this._snowMat.opacity = _clamp(intensity * 0.9, 0.3, 0.95);
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
// Star Field — Canvas-baked texture on separate dome
// ============================================================
// Stars rendered as round dots on a pre-baked canvas texture applied to a
// dedicated sphere dome. This avoids vertex color triangle interpolation
// artifacts that made vertex highlights look like geometric starbursts.
// WebGPU-safe: MeshBasicMaterial + CanvasTexture, no Points/Sprites.

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

  // Spectral colors — Tenkoku uses 7 spectral types
  var spectralColors = [
    [155, 185, 255],  // O/B type — hot blue-white
    [195, 210, 255],  // B type — blue-white
    [225, 235, 255],  // A type — white
    [255, 255, 245],  // F type — yellow-white
    [255, 240, 200],  // G type — yellow (like our Sun)
    [255, 215, 155],  // K type — orange
    [255, 175, 125],  // M type — red-orange (coolest, most common)
  ];
  var typeWeights = [0.02, 0.04, 0.08, 0.14, 0.22, 0.25, 0.25];

  var stars = [];

  // Tenkoku reference: hundreds of TINY white dots, not glowing orbs
  // --- Layer 1: 15 brightest stars — small dots with very tight glow ---
  for (var i = 0; i < 15; i++) {
    var sx = Math.random() * W;
    var sy = Math.random() * H * 0.45;
    var radius = 1.2 + Math.random() * 0.8; // 1.2-2px
    var glowR = radius * 2; // 2.4-4px (very tight)
    var brightness = 0.95 + Math.random() * 0.05;
    var colorIdx = Math.floor(Math.random() * 4);
    var col = spectralColors[colorIdx];

    var grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
    grad.addColorStop(0, "rgba(255,255,255," + brightness + ")");
    grad.addColorStop(0.3, "rgba(255,255,255," + (brightness * 0.5) + ")");
    grad.addColorStop(0.6, "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + (brightness * 0.1) + ")");
    grad.addColorStop(1, "rgba(" + col[0] + "," + col[1] + "," + col[2] + ",0)");
    ctx.fillStyle = grad;
    ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
    stars.push({ x: sx, y: sy, r: radius, brightness: brightness });
  }

  // --- Layer 2: 120 medium stars — tiny white dots ---
  for (var i = 0; i < 120; i++) {
    var sx = Math.random() * W;
    var sy = Math.random() * H * 0.48;
    var radius = 0.7 + Math.random() * 0.6; // 0.7-1.3px
    var brightness = 0.7 + Math.random() * 0.3;
    var rnd = Math.random(), cumul = 0, colorIdx = 6;
    for (var ci = 0; ci < typeWeights.length; ci++) {
      cumul += typeWeights[ci]; if (rnd < cumul) { colorIdx = ci; break; }
    }
    var col = spectralColors[colorIdx];
    var glowR = radius * 1.5;
    var grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
    grad.addColorStop(0, "rgba(255,255,255," + brightness + ")");
    grad.addColorStop(0.4, "rgba(255,255,255," + (brightness * 0.3) + ")");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
    stars.push({ x: sx, y: sy, r: radius, brightness: brightness });
  }

  // --- Layer 3: 4000 faint background stars (tiny scattered dots) ---
  for (var i = 0; i < 4000; i++) {
    var sx = Math.random() * W;
    var sy = Math.random() * H * 0.50;
    var mag = Math.random();
    mag = mag * mag;
    var radius = 0.3 + mag * 0.6; // 0.3-0.9px (tiny!)
    var brightness = 0.15 + mag * 0.55; // 0.15-0.7
    var rnd = Math.random(), cumul = 0, colorIdx = 6;
    for (var ci = 0; ci < typeWeights.length; ci++) {
      cumul += typeWeights[ci]; if (rnd < cumul) { colorIdx = ci; break; }
    }
    var col = spectralColors[colorIdx];
    // Tiny white dots — Tenkoku style
    var glowR3 = radius * 1.3;
    var grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR3);
    grad.addColorStop(0, "rgba(255,255,255," + brightness + ")");
    grad.addColorStop(0.5, "rgba(255,255,255," + (brightness * 0.15) + ")");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(sx - glowR3, sy - glowR3, glowR3 * 2, glowR3 * 2);
    stars.push({ x: sx, y: sy, r: radius, brightness: brightness });
  }

  this._canvas = canvas;
  this._starData = stars;
  return canvas;
};

StarField.prototype.init = function(scene) {
  if (this._dome) return;

  var canvas = this._generateStarTexture();
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

StarField.prototype.update = function(sunAltDeg, camera, time, settings, solarTime) {
  if (!this._dome) return;

  var starIntensity = settings.starIntensity != null ? settings.starIntensity : 1.0;

  // Night visibility: bright stars appear at -3° (civil twilight), full sky by -12°
  var nightFac = sunAltDeg < -12 ? 1 : (sunAltDeg < -3 ? _smoothstep(-3, -12, sunAltDeg) : 0);

  var visible = nightFac > 0.01 && starIntensity > 0.01;
  this._dome.visible = visible;

  if (visible && camera) {
    this._dome.position.copy(camera.position);
    // Sidereal rotation
    this._dome.rotation.y = solarTime * TWO_PI;
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

// 2D fBm — 4 octaves (octaves 5-6 are sub-pixel on dome)
CloudSystem.prototype._fbm2 = function(x, y) {
  var val = 0, amp = 0.5, freq = 1.0;
  for (var i = 0; i < 4; i++) {
    val += amp * this._noise2(x * freq, y * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return val;
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
    // Night: visible grey-blue (clouds should be seen against starfield)
    baseR = 55; baseG = 58; baseB = 72;
  }

  // Sun-side lighting direction (horizontal angle for gradient overlay)
  // sunX > 0 means sun is to the right of the dome texture
  var sunAngle = Math.atan2(this._sunDir[2], sunX);

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

      // Layer 1: Cumulus — large puffy formations with sharp edges
      // coverage=0 → nearly empty, 0.35 → scattered patches, 0.7 → mostly covered, 1.0 → full
      var n1 = this._fbm2(nx * 0.6 + windX, ny * 0.6 + windY);
      var c1 = _clamp(n1 + coverage * 2.0 - 1.0, 0, 1);
      c1 = c1 * c1 * c1; // cube for sharper puffy edges (Tenkoku-style distinct cumulus)
      var fade1 = _smoothstep(0.05, 0.18, v) * _smoothstep(0.88, 0.35, v);
      c1 *= fade1;

      // Layer 2: Altocumulus — medium scattered patches
      var n2 = this._fbm2(nx * 1.3 + windX * 1.2 + 50, ny * 1.3 + windY * 0.8 + 50);
      var c2 = _clamp(n2 + coverage * 1.5 - 0.8, 0, 1) * 0.35;
      var fade2 = _smoothstep(0.08, 0.22, v) * _smoothstep(0.90, 0.4, v);
      c2 *= fade2;

      // Layer 3: Cirrus — thin wispy horizontal streaks (Tenkoku: very subtle, stretched)
      var n3 = this._fbm2(nx * 6.0 + windX * 0.4 + 120, ny * 0.5 + windY * 0.2 + 120);
      var c3 = _clamp(n3 + coverage * 0.8 - 0.55, 0, 1) * 0.15;
      var fade3 = _smoothstep(0.0, 0.05, v) * _smoothstep(0.45, 0.12, v);
      c3 *= fade3;

      // Combined density — lower multiplier for more transparent clouds
      var d = _clamp((c1 + c2 + c3) * density, 0, 1);
      if (d < 0.01) continue;

      hasCloud = true;

      // Sun-facing brightness gradient — stronger contrast for realistic look
      var pixAngle = u * TWO_PI;
      var sunDot = Math.cos(pixAngle - sunAngle) * 0.5 + 0.5;
      // Higher contrast: dark backs (0.4x) vs bright sun-facing (1.8x) — Tenkoku-style 3D look
      var lightMul = _lerp(0.4, 1.8, sunDot) * brightness;
      // Altitude shading: cloud bottoms significantly darker (self-shadowing)
      lightMul *= _lerp(0.4, 1.0, 1.0 - v);

      var r = _clamp(baseR * lightMul / 255, 0, 1);
      var g = _clamp(baseG * lightMul / 255, 0, 1);
      var b = _clamp(baseB * lightMul / 255, 0, 1);

      // Alpha: gradual opacity — most clouds semi-transparent, only dense cores nearly opaque
      var alpha = _clamp(d * 2.0, 0, 0.85) * altFade;

      pix[idx]     = Math.round(r * 255);
      pix[idx + 1] = Math.round(g * 255);
      pix[idx + 2] = Math.round(b * 255);
      pix[idx + 3] = Math.round(alpha * 255);
    }
  }

  // Edge softening: simple 3x3 box blur on alpha channel for softer cloud edges
  if (hasCloud) {
    if (!this._blurBuf || this._blurBuf.length !== W * H) this._blurBuf = new Uint8ClampedArray(W * H);
    var blurAlpha = this._blurBuf;
    for (var by = 1; by < H - 1; by++) {
      for (var bx = 1; bx < W - 1; bx++) {
        var sum = 0;
        for (var ky = -1; ky <= 1; ky++) {
          for (var kx = -1; kx <= 1; kx++) {
            sum += pix[((by + ky) * W + (bx + kx)) * 4 + 3];
          }
        }
        blurAlpha[by * W + bx] = Math.round(sum / 9);
      }
    }
    for (var by2 = 1; by2 < H - 1; by2++) {
      for (var bx2 = 1; bx2 < W - 1; bx2++) {
        pix[(by2 * W + bx2) * 4 + 3] = blurAlpha[by2 * W + bx2];
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  if (this._tex) this._tex.needsUpdate = true;
  if (this._dome) this._dome.visible = hasCloud;
};

CloudSystem.prototype.update = function(dt, camera, sunDir, settings) {
  this._time += dt;
  this._sunDir = [sunDir.x, sunDir.y, sunDir.z];
  this._coverage = settings.coverage != null ? settings.coverage : 0.35;
  this._speed = settings.speed != null ? settings.speed : 1.0;
  this._brightness = settings.brightness != null ? settings.brightness : 1.0;
  this._density = settings.density != null ? settings.density : 0.85;
  this._scale = settings.scale != null ? settings.scale : 3.0;

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

  // Generate procedural moon texture via Canvas
  var texSize = 128;
  var canvas = document.createElement("canvas");
  canvas.width = canvas.height = texSize;
  var ctx = canvas.getContext("2d");

  // Base: light grey lunar surface
  ctx.fillStyle = "#b8b0a8";
  ctx.fillRect(0, 0, texSize, texSize);

  // Add procedural "craters" (darker circles)
  var craters = [
    [0.3, 0.4, 0.12], [0.55, 0.3, 0.08], [0.7, 0.6, 0.15],
    [0.4, 0.7, 0.1], [0.25, 0.6, 0.06], [0.6, 0.45, 0.05],
    [0.5, 0.55, 0.18], [0.35, 0.25, 0.04], [0.75, 0.35, 0.07],
    [0.2, 0.5, 0.09], [0.65, 0.75, 0.06], [0.45, 0.15, 0.05],
  ];
  for (var i = 0; i < craters.length; i++) {
    var cx = craters[i][0] * texSize, cy = craters[i][1] * texSize, cr = craters[i][2] * texSize;
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    grad.addColorStop(0, "rgba(80,75,70,0.5)");
    grad.addColorStop(0.7, "rgba(100,95,90,0.3)");
    grad.addColorStop(1, "rgba(184,176,168,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, TWO_PI);
    ctx.fill();
  }

  // Maria (dark areas)
  ctx.fillStyle = "rgba(70,65,60,0.3)";
  ctx.beginPath();
  ctx.ellipse(texSize * 0.45, texSize * 0.4, texSize * 0.2, texSize * 0.15, 0.3, 0, TWO_PI);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(texSize * 0.55, texSize * 0.55, texSize * 0.12, texSize * 0.1, -0.2, 0, TWO_PI);
  ctx.fill();

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

  // Atmospheric glow halo behind moon (like Tenkoku reference)
  var glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  var glowCtx = glowCanvas.getContext("2d");
  var glowGrad = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  glowGrad.addColorStop(0, "rgba(240,235,220,0.6)");
  glowGrad.addColorStop(0.15, "rgba(230,225,215,0.35)");
  glowGrad.addColorStop(0.4, "rgba(200,200,210,0.1)");
  glowGrad.addColorStop(0.7, "rgba(180,185,200,0.03)");
  glowGrad.addColorStop(1, "rgba(160,170,190,0)");
  glowCtx.fillStyle = glowGrad;
  glowCtx.fillRect(0, 0, 128, 128);
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
  this._glowMesh.renderOrder = -998.5; // behind moon
  this._glowMesh.frustumCulled = false;
  scene.add(this._glowMesh);
};

MoonRenderer.prototype.update = function(camera, moonDir, sunDir, moonPhase, sunAltDeg, settings) {
  if (!this._mesh) return;

  this._size = (settings.moonDiskSize != null ? settings.moonDiskSize : 0.022) * 2800;
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
  this._mesh.scale.setScalar(this._size);
  this._mesh.lookAt(camera ? camera.position : new THREE.Vector3(0, 0, 0));

  // Phase rendering: brightness scales linearly with phase (quarter=0.5, full=1.0)
  var phaseBrightness = _clamp(moonPhase, 0.05, 1.0) * this._brightness;

  // Horizon tint: orange when moon is low (reduce green and blue channels)
  var moonAlt = moonDir.y;
  var r = phaseBrightness, g = phaseBrightness, b = phaseBrightness;
  if (moonAlt < 0.15 && moonAlt > -0.05) {
    var warmT = 1 - _smoothstep(-0.05, 0.15, moonAlt);
    g *= _lerp(1.0, 0.7, warmT);
    b *= _lerp(1.0, 0.4, warmT);
  }
  this._mat.color.setRGB(r, g, b);

  // Opacity: phase-based + smooth horizon fade (no pop in/out)
  var horizonFade = _smoothstep(-0.05, 0.05, moonDir.y);
  this._mat.opacity = _clamp(phaseBrightness + 0.1, 0.1, 0.95) * horizonFade;

  // Visibility: hide when fully below horizon (after fade completes)
  this._mesh.visible = moonDir.y > -0.05;

  // Glow halo — follows moon position, scales 18x larger for Tenkoku-scale halo
  if (this._glowMesh) {
    this._glowMesh.visible = this._mesh.visible;
    if (this._glowMesh.visible && camera) {
      this._glowMesh.position.copy(this._mesh.position);
      this._glowMesh.scale.setScalar(this._size * 18);
      this._glowMesh.lookAt(camera.position);
      this._glowMesh.material.opacity = phaseBrightness * horizonFade * 0.55;
    }
  }
};

MoonRenderer.prototype.dispose = function(scene) {
  if (this._mesh && this._mesh.parent) this._mesh.parent.remove(this._mesh);
  if (this._glowMesh && this._glowMesh.parent) this._glowMesh.parent.remove(this._glowMesh);
  if (this._geo) this._geo.dispose();
  if (this._glowGeo) this._glowGeo.dispose();
  if (this._moonTex) this._moonTex.dispose();
  if (this._mat) this._mat.dispose();
  if (this._glowMat) this._glowMat.dispose();
  this._mesh = null;
  this._glowMesh = null;
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
  // Flash light for lightning illumination
  this._flashLight = new THREE.PointLight(0xCCDDFF, 0, 500);
  this._flashLight.name = "__swa_lightning_flash__";
  scene.add(this._flashLight);
};

LightningEffect.prototype._generateBolt = function(camera) {
  if (!camera) return null;

  // Random direction from camera
  var angle = Math.random() * TWO_PI;
  var distance = 100 + Math.random() * 200;
  var baseX = camera.position.x + Math.sin(angle) * distance;
  var baseZ = camera.position.z + Math.cos(angle) * distance;
  var topY = camera.position.y + 80 + Math.random() * 40;
  var bottomY = camera.position.y - 5;

  var segments = 30 + Math.floor(Math.random() * 30);
  var positions = new Float32Array(segments * 2 * 3); // line segments need pairs

  var x = baseX, y = topY, z = baseZ;
  var stepY = (topY - bottomY) / segments;
  var jitter = 8 + Math.random() * 12;

  for (var i = 0; i < segments; i++) {
    // Start point
    positions[i*6]   = x;
    positions[i*6+1] = y;
    positions[i*6+2] = z;

    // Perlin-like jitter with convergence
    var t = i / segments;
    x += (Math.random() - 0.5) * jitter * (1 - t * 0.5);
    y -= stepY;
    z += (Math.random() - 0.5) * jitter * (1 - t * 0.5);

    // Converge toward base
    x = _lerp(x, baseX, 0.1);
    z = _lerp(z, baseZ, 0.1);

    // End point
    positions[i*6+3] = x;
    positions[i*6+4] = y;
    positions[i*6+5] = z;
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  var mat = new THREE.LineBasicMaterial({
    color: 0xCCDDFF,
    transparent: true,
    opacity: 1.0,
    linewidth: 2,
  });

  var line = new THREE.LineSegments(geo, mat);
  line.name = "__swa_bolt__";
  line.frustumCulled = false;
  this._scene.add(line);

  return {
    mesh: line,
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

        // Flash
        this._flashLight.position.copy(bolt.position);
        this._flashLight.intensity = bolt.intensity * 5;

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

  // Decay flash light
  if (this._flashLight.intensity > 0) {
    this._flashLight.intensity *= 0.85;
    if (this._flashLight.intensity < 0.01) this._flashLight.intensity = 0;
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
      this._auroraTex.offset.x = this._time * 0.02;
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
  this._transitionSpeed = 0.05; // per second
  this._forecastTimer = 0;
  this._forecastInterval = 60; // seconds between auto-forecast
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

  // Interpolate values
  var from = this._stateValues(this._currentState);
  var to = this._stateValues(this._targetState);
  var t = this._transition;

  this.cloudCoverage = _lerp(from.cloud, to.cloud, t);
  this.precipIntensity = _lerp(from.intensity, to.intensity, t);
  this.windStrength = _lerp(from.wind, to.wind, t);
  this.precipType = t > 0.5 ? to.precip : from.precip;
  this.lightningEnabled = t > 0.5 ? to.lightning : from.lightning;

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
  // Milky Way: band of faint points across the sky
  var mwCount = 3000;
  this._milkyGeo = new THREE.BufferGeometry();
  var mwPos = new Float32Array(mwCount * 3);
  var mwCol = new Float32Array(mwCount * 3);
  var mwSize = new Float32Array(mwCount);

  for (var i = 0; i < mwCount; i++) {
    // Milky Way band: concentrated along galactic plane
    // Galactic plane tilted ~63° from celestial equator
    var galLon = Math.random() * TWO_PI;
    var galLat = (Math.random() - 0.5) * 0.4; // narrow band ±0.2 rad
    var r = 4750;

    // Rotate galactic coords to equatorial (simplified tilt)
    var tilt = 63 * DEG2RAD;
    var x = r * Math.cos(galLat) * Math.cos(galLon);
    var y = r * Math.cos(galLat) * Math.sin(galLon);
    var z = r * Math.sin(galLat);

    // Apply tilt rotation around X axis
    var y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
    var z2 = y * Math.sin(tilt) + z * Math.cos(tilt);

    mwPos[i*3]   = x;
    mwPos[i*3+1] = y2;
    mwPos[i*3+2] = z2;

    // Milky Way color: faint blue-white with occasional warm tones
    var warmth = Math.random();
    mwCol[i*3]   = 0.7 + warmth * 0.3;
    mwCol[i*3+1] = 0.75 + warmth * 0.15;
    mwCol[i*3+2] = 0.85 + (1 - warmth) * 0.15;

    mwSize[i] = 0.8 + Math.random() * 1.5;
  }

  this._milkyGeo.setAttribute("position", new THREE.BufferAttribute(mwPos, 3));
  this._milkyGeo.setAttribute("color", new THREE.BufferAttribute(mwCol, 3));

  this._milkyMat = new THREE.PointsMaterial({
    vertexColors: true,
    size: 1.2,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    depthTest: false,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
  });

  this._milkyWay = new THREE.Points(this._milkyGeo, this._milkyMat);
  this._milkyWay.name = "__swa_milky_way__";
  this._milkyWay.renderOrder = -998;
  this._milkyWay.frustumCulled = false;
  this._milkyWay.visible = false;
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
      this._milkyMat.opacity = nightFac * 0.25 * galaxyIntensity;
      if (camera) this._milkyWay.position.copy(camera.position);
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

SunShafts.prototype.update = function(camera, sunDir, sunAltDeg, settings) {
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

FogController.prototype.update = function(scene, sunAltDeg, settings, skyHorizonColor) {
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
  var baseDensity = _clamp(settings.density != null ? settings.density : 0.002, 0.0005, 0.01);
  var heightFalloff = settings.heightFalloff != null ? settings.heightFalloff : 0;

  // Height-based fog: increase density at lower camera heights
  var density = baseDensity;
  if (heightFalloff > 0) {
    var camera = window.__vibexe_camera__ || null;
    if (!camera) { scene.traverse(function(obj) { if (obj.isCamera && !camera) camera = obj; }); }
    if (camera) {
      var camY = Math.max(0, camera.position.y);
      // Exponential height falloff: denser at ground level
      var heightMult = Math.exp(-camY * heightFalloff * 0.01);
      density = baseDensity * (1 + heightMult * 3);
    }
  }

  if (!scene.fog || !scene.fog.isFogExp2) {
    scene.fog = new THREE.FogExp2(0x87CEEB, density);
  } else {
    scene.fog.density = density;
  }

  // Auto fog color: prefer sky horizon color from atmosphere, fall back to sun-altitude heuristic
  if (settings.autoColor !== false) {
    if (skyHorizonColor && skyHorizonColor.length >= 3) {
      scene.fog.color.setRGB(skyHorizonColor[0], skyHorizonColor[1], skyHorizonColor[2]);
    } else {
      var altNorm = _clamp(sunAltDeg / 90, -1, 1);
      if (altNorm > 0.1) {
        // Day: light blue-white
        scene.fog.color.setRGB(0.7, 0.8, 0.9);
      } else if (altNorm > -0.05) {
        // Sunset: warm orange-pink
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

  // Sanitize settings — fix known-bad values from old DB saves
  // All checks use != null guard to avoid treating null/undefined as numeric
  var sky = this.settings.sky;
  if (sky.mieDirectionalG == null || sky.mieDirectionalG < 0.5) sky.mieDirectionalG = 0.76;
  if (sky.exposure == null || sky.exposure < 0.5 || sky.exposure > 4) sky.exposure = 1.2;
  if (sky.sunIntensity == null || sky.sunIntensity < 10) sky.sunIntensity = 22.0;
  if (sky.nightBrightness == null) sky.nightBrightness = 0.2;
  var fog = this.settings.fog;
  if (fog.density != null && fog.density > 0.05) fog.density = 0.015;
  var clouds = this.settings.clouds;
  // If coverage was saved as exactly 0 or null, restore to default partly-cloudy
  if (clouds.coverage == null) {
    clouds.coverage = 0.35;
  }
  // Allow full 0-1 range — weather presets need high values
  if (clouds.brightness == null || clouds.brightness < 0.1) clouds.brightness = 1.0;
  // Clear rain/snow if auto-forecast is off
  var precip = this.settings.precipitation;
  if (precip && precip.type !== "none" && !(this.settings.weather || {}).autoForecast) {
    precip.type = "none";
    precip.intensity = 0;
  }
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

  this._time = 0;
  this._lastUpdate = Date.now();
  this._skyUpdateTimer = 0;
  this._skyUpdateInterval = 2.0; // Recompute sky colors every 2 seconds (expensive)
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
  this.atmosphere._nightBrightness = initSky.nightBrightness != null ? initSky.nightBrightness : 0.2;
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
    mieDirectionalG: 0.82,
    starIntensity: 1.0,
    nightBrightness: 0.2,
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
    // mieG must be 0.6-0.99 for directional sun scattering (saved settings may have bad values)
    this.atmosphere._mieG = _clamp(skySettings.mieDirectionalG != null ? skySettings.mieDirectionalG : 0.76, 0.6, 0.99);
    this.atmosphere._rayleighScale = _clamp(skySettings.rayleighScale != null ? skySettings.rayleighScale : 1.0, 0.5, 3.0);
    this.atmosphere._sunIntensity = _clamp(skySettings.sunIntensity != null ? skySettings.sunIntensity : 22.0, 5.0, 50.0);
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

    // Overcast reduces exposure (in addition to atmosphere desaturation)
    if (overcastAmt > 0.5) {
      this.atmosphere._exposure *= _lerp(1.0, 0.6, (overcastAmt - 0.5) * 2);
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

  // Lighting
  this.lighting.update(
    this.orbital.sunDirection,
    sunAltDeg,
    this.settings.lighting || {}
  );

  // Clouds
  this.clouds.update(dt, camera, this.orbital.sunDirection, this.settings.clouds || {});
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
  this.stars.update(sunAltDeg, camera, this._time, this.settings.sky || {}, ts.solarTime != null ? ts.solarTime : 0.45);

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

  // Fog — pass sky horizon color for accurate color matching
  var horizonColor = this.atmosphere.getHorizonColor();
  this.fog.update(this.scene, sunAltDeg, this.settings.fog || {}, horizonColor);

  // Sun Shafts (god rays) — skip if disabled
  var _eff = this.settings.effects || {};
  if (_eff.godRays) {
    this.sunShafts.update(camera, this.orbital.sunDirection, sunAltDeg, _eff);
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
  if (sky.mieDirectionalG == null || sky.mieDirectionalG < 0.5) sky.mieDirectionalG = 0.76;
  if (sky.exposure == null || sky.exposure < 0.3 || sky.exposure > 4) sky.exposure = 1.2;
  if (sky.sunIntensity == null || sky.sunIntensity < 3) sky.sunIntensity = 22.0;
  if (sky.nightBrightness == null) sky.nightBrightness = 0.2;
  var fog = this.settings.fog;
  if (fog.density != null && fog.density > 0.05) fog.density = 0.015;
  if (!fog.enabled) { fog.enabled = true; fog.density = fog.density != null ? fog.density : 0.002; }
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
