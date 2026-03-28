#!/usr/bin/env node
/**
 * Sprite Generation Script
 * Generates clean, Kenney-style SVG sprites for the 2D game engine.
 * Output: packages/vibexe-engine/media-stock-sprites/2d/sprites/
 *
 * Run: node scripts/generate-sprites.mjs
 * Deploy: copy output dir to /opt/vibexe/media-stock/games/2d/sprites/ on server
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const OUT = join(import.meta.dirname, '..', 'packages', 'vibexe-engine', 'media-stock-sprites', '2d', 'sprites');

function write(subpath, svg) {
  const full = join(OUT, subpath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, svg.trim() + '\n');
}

// ===========================================================================
// PLATFORMS
// ===========================================================================

write('platforms/grass_block.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect x="4" y="28" width="120" height="96" rx="4" fill="#8B5E3C"/>
  <rect x="8" y="44" width="112" height="76" rx="2" fill="#7A5232" opacity="0.6"/>
  <rect x="4" y="4" width="120" height="32" rx="6" fill="#4CAF50"/>
  <rect x="8" y="6" width="50" height="10" rx="5" fill="#66BB6A" opacity="0.6"/>
  <rect x="64" y="10" width="30" height="6" rx="3" fill="#81C784" opacity="0.5"/>
  <circle cx="20" cy="60" r="4" fill="#6D4C2A" opacity="0.3"/>
  <circle cx="80" cy="80" r="3" fill="#6D4C2A" opacity="0.25"/>
  <circle cx="50" cy="100" r="5" fill="#6D4C2A" opacity="0.2"/>
  <rect x="2" y="2" width="124" height="124" rx="8" fill="none" stroke="#2D1B0E" stroke-width="4"/>
</svg>`);

write('platforms/stone_block.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect x="4" y="4" width="120" height="120" rx="4" fill="#808080"/>
  <rect x="4" y="4" width="120" height="20" rx="4" fill="#909090"/>
  <rect x="8" y="8" width="40" height="8" rx="3" fill="#A0A0A0" opacity="0.5"/>
  <line x1="4" y1="44" x2="124" y2="44" stroke="#6E6E6E" stroke-width="2" opacity="0.4"/>
  <line x1="64" y1="44" x2="64" y2="124" stroke="#6E6E6E" stroke-width="2" opacity="0.3"/>
  <circle cx="30" cy="70" r="3" fill="#6E6E6E" opacity="0.3"/>
  <circle cx="90" cy="100" r="4" fill="#6E6E6E" opacity="0.25"/>
  <rect x="2" y="2" width="124" height="124" rx="6" fill="none" stroke="#3D3D3D" stroke-width="4"/>
</svg>`);

write('platforms/ice_block.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs><linearGradient id="iceG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#E3F2FD"/><stop offset="100%" stop-color="#90CAF9"/></linearGradient></defs>
  <rect x="4" y="4" width="120" height="120" rx="6" fill="url(#iceG)"/>
  <rect x="4" y="4" width="120" height="16" rx="6" fill="#FFFFFF" opacity="0.6"/>
  <rect x="20" y="30" width="35" height="3" rx="1" fill="#FFFFFF" opacity="0.4" transform="rotate(-10 37 31)"/>
  <rect x="60" y="60" width="40" height="2" rx="1" fill="#FFFFFF" opacity="0.35" transform="rotate(5 80 61)"/>
  <rect x="15" y="80" width="25" height="2" rx="1" fill="#FFFFFF" opacity="0.3" transform="rotate(-5 27 81)"/>
  <rect x="2" y="2" width="124" height="124" rx="8" fill="none" stroke="#5C9DC5" stroke-width="4"/>
</svg>`);

write('platforms/sand_block.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect x="4" y="4" width="120" height="120" rx="4" fill="#E8C86A"/>
  <rect x="4" y="4" width="120" height="24" rx="4" fill="#F0D68A"/>
  <rect x="10" y="8" width="35" height="8" rx="4" fill="#F5E0A0" opacity="0.6"/>
  <circle cx="25" cy="60" r="2" fill="#D4B55A" opacity="0.4"/>
  <circle cx="70" cy="50" r="1.5" fill="#D4B55A" opacity="0.3"/>
  <circle cx="100" cy="80" r="2.5" fill="#D4B55A" opacity="0.35"/>
  <circle cx="40" cy="100" r="2" fill="#D4B55A" opacity="0.3"/>
  <rect x="2" y="2" width="124" height="124" rx="6" fill="none" stroke="#8B7535" stroke-width="4"/>
</svg>`);

write('platforms/dark_block.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect x="4" y="4" width="120" height="120" rx="4" fill="#37474F"/>
  <rect x="4" y="4" width="120" height="20" rx="4" fill="#455A64"/>
  <rect x="10" y="8" width="30" height="6" rx="3" fill="#546E7A" opacity="0.5"/>
  <line x1="20" y1="40" x2="20" y2="120" stroke="#7E57C2" stroke-width="1.5" opacity="0.3"/>
  <line x1="60" y1="50" x2="60" y2="110" stroke="#7E57C2" stroke-width="1" opacity="0.25"/>
  <line x1="100" y1="35" x2="100" y2="100" stroke="#7E57C2" stroke-width="1.5" opacity="0.2"/>
  <circle cx="20" cy="40" r="3" fill="#B39DDB" opacity="0.4"/>
  <circle cx="60" cy="50" r="2" fill="#B39DDB" opacity="0.3"/>
  <rect x="2" y="2" width="124" height="124" rx="6" fill="none" stroke="#1A1A2E" stroke-width="4"/>
</svg>`);

// ===========================================================================
// GROUND TILES (for tiling drawGroundStrip)
// ===========================================================================

write('ground/grass_top.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64" viewBox="0 0 128 64">
  <rect x="0" y="16" width="128" height="48" fill="#8B5E3C"/>
  <rect x="0" y="0" width="128" height="24" fill="#4CAF50"/>
  <path d="M0,20 Q8,8 16,18 Q24,6 32,16 Q40,4 48,18 Q56,10 64,16 Q72,6 80,18 Q88,8 96,16 Q104,4 112,18 Q120,8 128,16 L128,24 L0,24 Z" fill="#66BB6A" opacity="0.5"/>
  <rect x="0" y="24" width="128" height="4" fill="#7A5232" opacity="0.4"/>
</svg>`);

write('ground/dirt_fill.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect x="0" y="0" width="128" height="128" fill="#8B5E3C"/>
  <circle cx="20" cy="30" r="5" fill="#7A5232" opacity="0.3"/>
  <circle cx="80" cy="20" r="4" fill="#7A5232" opacity="0.25"/>
  <circle cx="50" cy="70" r="6" fill="#6D4C2A" opacity="0.2"/>
  <circle cx="110" cy="90" r="5" fill="#7A5232" opacity="0.25"/>
  <circle cx="30" cy="110" r="4" fill="#6D4C2A" opacity="0.2"/>
  <rect x="60" y="50" width="20" height="10" rx="5" fill="#6D4C2A" opacity="0.15"/>
</svg>`);

write('ground/stone_top.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64" viewBox="0 0 128 64">
  <rect x="0" y="0" width="128" height="64" fill="#808080"/>
  <rect x="0" y="0" width="128" height="12" fill="#909090"/>
  <path d="M0,10 L20,6 L40,12 L60,4 L80,10 L100,6 L120,12 L128,8 L128,16 L0,16 Z" fill="#A0A0A0" opacity="0.3"/>
</svg>`);

write('ground/ice_top.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64" viewBox="0 0 128 64">
  <rect x="0" y="0" width="128" height="64" fill="#90CAF9"/>
  <rect x="0" y="0" width="128" height="16" fill="#E3F2FD"/>
  <rect x="10" y="20" width="30" height="2" rx="1" fill="#FFFFFF" opacity="0.4" transform="rotate(-5 25 21)"/>
  <rect x="70" y="35" width="25" height="2" rx="1" fill="#FFFFFF" opacity="0.35"/>
</svg>`);

write('ground/sand_top.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64" viewBox="0 0 128 64">
  <rect x="0" y="0" width="128" height="64" fill="#E8C86A"/>
  <rect x="0" y="0" width="128" height="16" fill="#F0D68A"/>
  <path d="M0,12 Q16,6 32,14 Q48,4 64,12 Q80,6 96,14 Q112,4 128,12 L128,20 L0,20 Z" fill="#F5E0A0" opacity="0.4"/>
  <circle cx="30" cy="40" r="2" fill="#D4B55A" opacity="0.3"/>
  <circle cx="90" cy="50" r="1.5" fill="#D4B55A" opacity="0.25"/>
</svg>`);

// ===========================================================================
// TREES
// ===========================================================================

write('trees/round_tree.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="192" viewBox="0 0 128 192">
  <rect x="52" y="110" width="24" height="78" rx="4" fill="#6D4C41"/>
  <rect x="56" y="115" width="8" height="70" rx="2" fill="#8D6E63" opacity="0.4"/>
  <ellipse cx="64" cy="70" rx="54" ry="60" fill="#388E3C"/>
  <ellipse cx="50" cy="55" rx="30" ry="30" fill="#43A047" opacity="0.6"/>
  <ellipse cx="78" cy="60" rx="25" ry="25" fill="#4CAF50" opacity="0.5"/>
  <ellipse cx="64" cy="40" rx="20" ry="18" fill="#66BB6A" opacity="0.4"/>
  <ellipse cx="64" cy="70" rx="54" ry="60" fill="none" stroke="#1B5E20" stroke-width="3"/>
</svg>`);

write('trees/pine_tree.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="192" viewBox="0 0 96 192">
  <rect x="38" y="140" width="20" height="48" rx="3" fill="#5D4037"/>
  <polygon points="48,10 8,100 88,100" fill="#2E7D32"/>
  <polygon points="48,40 16,120 80,120" fill="#388E3C"/>
  <polygon points="48,70 20,150 76,150" fill="#43A047"/>
  <polygon points="48,10 8,100 88,100" fill="none" stroke="#1B5E20" stroke-width="2.5"/>
  <polygon points="48,40 16,120 80,120" fill="none" stroke="#1B5E20" stroke-width="2.5"/>
  <polygon points="48,70 20,150 76,150" fill="none" stroke="#1B5E20" stroke-width="2.5"/>
</svg>`);

write('trees/palm_tree.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="192" viewBox="0 0 128 192">
  <path d="M58,188 Q54,140 60,100 Q66,60 70,40" fill="none" stroke="#8D6E63" stroke-width="14" stroke-linecap="round"/>
  <path d="M60,186 Q56,140 62,100 Q68,60 72,40" fill="none" stroke="#A1887F" stroke-width="6" stroke-linecap="round" opacity="0.4"/>
  <path d="M70,40 Q30,20 5,50" fill="none" stroke="#2E7D32" stroke-width="8" stroke-linecap="round"/>
  <path d="M70,40 Q95,10 120,35" fill="none" stroke="#2E7D32" stroke-width="8" stroke-linecap="round"/>
  <path d="M70,40 Q40,5 20,30" fill="none" stroke="#388E3C" stroke-width="6" stroke-linecap="round"/>
  <path d="M70,40 Q100,25 115,55" fill="none" stroke="#388E3C" stroke-width="6" stroke-linecap="round"/>
  <path d="M70,40 Q60,15 45,15" fill="none" stroke="#43A047" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="72" cy="60" rx="8" ry="6" fill="#795548"/>
  <ellipse cx="62" cy="55" rx="6" ry="5" fill="#795548"/>
</svg>`);

write('trees/dead_tree.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="192" viewBox="0 0 96 192">
  <path d="M48,188 Q46,140 48,80 Q50,50 48,20" fill="none" stroke="#5D4037" stroke-width="12" stroke-linecap="round"/>
  <path d="M48,60 Q20,40 10,50" fill="none" stroke="#5D4037" stroke-width="6" stroke-linecap="round"/>
  <path d="M48,40 Q75,20 85,30" fill="none" stroke="#5D4037" stroke-width="5" stroke-linecap="round"/>
  <path d="M48,80 Q25,70 15,80" fill="none" stroke="#5D4037" stroke-width="4" stroke-linecap="round"/>
  <path d="M48,50 Q70,45 78,55" fill="none" stroke="#4E342E" stroke-width="3" stroke-linecap="round"/>
</svg>`);

// ===========================================================================
// BUSHES
// ===========================================================================

write('bushes/bush_green.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
  <ellipse cx="48" cy="42" rx="44" ry="20" fill="#388E3C"/>
  <ellipse cx="30" cy="35" rx="24" ry="22" fill="#43A047"/>
  <ellipse cx="65" cy="36" rx="26" ry="24" fill="#4CAF50"/>
  <ellipse cx="48" cy="28" rx="18" ry="16" fill="#66BB6A" opacity="0.6"/>
  <ellipse cx="48" cy="42" rx="44" ry="20" fill="none" stroke="#1B5E20" stroke-width="2.5"/>
</svg>`);

write('bushes/bush_flower.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
  <ellipse cx="48" cy="42" rx="44" ry="20" fill="#388E3C"/>
  <ellipse cx="32" cy="36" rx="22" ry="20" fill="#43A047"/>
  <ellipse cx="64" cy="37" rx="24" ry="22" fill="#4CAF50"/>
  <ellipse cx="48" cy="42" rx="44" ry="20" fill="none" stroke="#1B5E20" stroke-width="2.5"/>
  <circle cx="25" cy="30" r="5" fill="#E91E63"/>
  <circle cx="25" cy="30" r="2" fill="#F8BBD0"/>
  <circle cx="55" cy="25" r="4" fill="#FF9800"/>
  <circle cx="55" cy="25" r="1.5" fill="#FFE0B2"/>
  <circle cx="72" cy="33" r="5" fill="#E91E63"/>
  <circle cx="72" cy="33" r="2" fill="#F8BBD0"/>
  <circle cx="40" cy="22" r="3.5" fill="#9C27B0"/>
  <circle cx="40" cy="22" r="1.5" fill="#E1BEE7"/>
</svg>`);

// ===========================================================================
// CLOUDS
// ===========================================================================

write('clouds/cloud_puffy.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="128" viewBox="0 0 256 128">
  <ellipse cx="128" cy="80" rx="110" ry="40" fill="#ECEFF1" opacity="0.8"/>
  <ellipse cx="90" cy="70" rx="65" ry="50" fill="#FFFFFF" opacity="0.9"/>
  <ellipse cx="170" cy="68" rx="70" ry="52" fill="#FFFFFF" opacity="0.9"/>
  <ellipse cx="128" cy="55" rx="55" ry="42" fill="#FFFFFF"/>
  <ellipse cx="80" cy="60" rx="40" ry="30" fill="#F5F5F5" opacity="0.5"/>
  <ellipse cx="175" cy="58" rx="35" ry="28" fill="#F5F5F5" opacity="0.5"/>
</svg>`);

write('clouds/cloud_small.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64" viewBox="0 0 128 64">
  <ellipse cx="64" cy="40" rx="55" ry="20" fill="#ECEFF1" opacity="0.8"/>
  <ellipse cx="45" cy="35" rx="30" ry="25" fill="#FFFFFF" opacity="0.9"/>
  <ellipse cx="85" cy="34" rx="35" ry="26" fill="#FFFFFF" opacity="0.9"/>
  <ellipse cx="64" cy="28" rx="25" ry="20" fill="#FFFFFF"/>
</svg>`);

// ===========================================================================
// COLLECTIBLES
// ===========================================================================

write('collectibles/coin_gold.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><radialGradient id="coinG" cx="40%" cy="35%"><stop offset="0%" stop-color="#FFEE58"/><stop offset="60%" stop-color="#FFC107"/><stop offset="100%" stop-color="#FF8F00"/></radialGradient></defs>
  <circle cx="32" cy="32" r="26" fill="url(#coinG)"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="#FFB300" stroke-width="2" opacity="0.5"/>
  <text x="32" y="40" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="#FF8F00" opacity="0.6">$</text>
  <ellipse cx="26" cy="22" rx="8" ry="5" fill="#FFFFFF" opacity="0.3" transform="rotate(-20 26 22)"/>
  <circle cx="32" cy="32" r="26" fill="none" stroke="#E65100" stroke-width="3"/>
</svg>`);

write('collectibles/gem_red.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <polygon points="32,6 56,24 48,56 16,56 8,24" fill="#E53935"/>
  <polygon points="32,6 42,24 32,36 22,24" fill="#EF5350" opacity="0.7"/>
  <polygon points="32,6 42,24 32,18" fill="#FFCDD2" opacity="0.5"/>
  <polygon points="32,6 56,24 48,56 16,56 8,24" fill="none" stroke="#B71C1C" stroke-width="3"/>
</svg>`);

write('collectibles/gem_blue.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <polygon points="32,6 56,24 48,56 16,56 8,24" fill="#1E88E5"/>
  <polygon points="32,6 42,24 32,36 22,24" fill="#42A5F5" opacity="0.7"/>
  <polygon points="32,6 42,24 32,18" fill="#BBDEFB" opacity="0.5"/>
  <polygon points="32,6 56,24 48,56 16,56 8,24" fill="none" stroke="#0D47A1" stroke-width="3"/>
</svg>`);

write('collectibles/star.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <polygon points="32,4 39,22 58,22 43,34 49,52 32,42 15,52 21,34 6,22 25,22" fill="#FFD600"/>
  <polygon points="32,12 36,24 48,24 39,32 42,44 32,37 22,44 25,32 16,24 28,24" fill="#FFFF00" opacity="0.5"/>
  <polygon points="32,4 39,22 58,22 43,34 49,52 32,42 15,52 21,34 6,22 25,22" fill="none" stroke="#F57F17" stroke-width="2.5"/>
</svg>`);

write('collectibles/heart.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M32,56 C16,44 4,32 4,20 C4,10 12,4 22,4 C28,4 32,10 32,10 C32,10 36,4 42,4 C52,4 60,10 60,20 C60,32 48,44 32,56 Z" fill="#E53935"/>
  <path d="M32,50 C20,40 12,32 12,22 C12,16 16,10 22,10 C26,10 30,14 32,18" fill="#EF5350" opacity="0.5"/>
  <ellipse cx="22" cy="18" rx="6" ry="4" fill="#FFFFFF" opacity="0.35" transform="rotate(-25 22 18)"/>
  <path d="M32,56 C16,44 4,32 4,20 C4,10 12,4 22,4 C28,4 32,10 32,10 C32,10 36,4 42,4 C52,4 60,10 60,20 C60,32 48,44 32,56 Z" fill="none" stroke="#B71C1C" stroke-width="3"/>
</svg>`);

// ===========================================================================
// PROPS
// ===========================================================================

write('props/crate.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="4" y="4" width="56" height="56" rx="3" fill="#A1887F"/>
  <rect x="4" y="4" width="56" height="12" rx="3" fill="#BCAAA4" opacity="0.5"/>
  <line x1="4" y1="32" x2="60" y2="32" stroke="#795548" stroke-width="2" opacity="0.4"/>
  <line x1="32" y1="4" x2="32" y2="60" stroke="#795548" stroke-width="2" opacity="0.4"/>
  <rect x="26" y="26" width="12" height="12" rx="2" fill="#8D6E63"/>
  <rect x="2" y="2" width="60" height="60" rx="5" fill="none" stroke="#4E342E" stroke-width="4"/>
</svg>`);

write('props/barrel.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80">
  <ellipse cx="32" cy="72" rx="26" ry="8" fill="#5D4037"/>
  <rect x="6" y="12" width="52" height="60" rx="4" fill="#8D6E63"/>
  <rect x="8" y="12" width="20" height="60" rx="2" fill="#A1887F" opacity="0.3"/>
  <ellipse cx="32" cy="12" rx="26" ry="8" fill="#A1887F"/>
  <ellipse cx="32" cy="12" rx="26" ry="8" fill="none" stroke="#4E342E" stroke-width="2.5"/>
  <rect x="4" y="24" width="56" height="4" rx="2" fill="#795548"/>
  <rect x="4" y="56" width="56" height="4" rx="2" fill="#795548"/>
  <rect x="4" y="8" width="56" height="64" rx="4" fill="none" stroke="#3E2723" stroke-width="3"/>
</svg>`);

write('props/rock.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="64" viewBox="0 0 80 64">
  <path d="M10,58 L4,40 L15,20 L35,10 L55,8 L70,18 L76,35 L72,52 L55,60 Z" fill="#78909C"/>
  <path d="M15,20 L35,10 L55,8 L50,25 L30,30 Z" fill="#90A4AE" opacity="0.5"/>
  <path d="M10,58 L4,40 L15,20 L30,30 L20,48 Z" fill="#607D8B" opacity="0.4"/>
  <path d="M10,58 L4,40 L15,20 L35,10 L55,8 L70,18 L76,35 L72,52 L55,60 Z" fill="none" stroke="#37474F" stroke-width="3"/>
</svg>`);

write('props/fence.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
  <rect x="8" y="4" width="10" height="56" rx="2" fill="#A1887F"/>
  <polygon points="8,4 13,0 18,4" fill="#BCAAA4"/>
  <rect x="42" y="4" width="10" height="56" rx="2" fill="#A1887F"/>
  <polygon points="42,4 47,0 52,4" fill="#BCAAA4"/>
  <rect x="76" y="4" width="10" height="56" rx="2" fill="#A1887F"/>
  <polygon points="76,4 81,0 86,4" fill="#BCAAA4"/>
  <rect x="8" y="16" width="78" height="6" rx="2" fill="#8D6E63"/>
  <rect x="8" y="40" width="78" height="6" rx="2" fill="#8D6E63"/>
</svg>`);

write('props/sign_post.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="96" viewBox="0 0 80 96">
  <rect x="35" y="30" width="10" height="62" rx="2" fill="#6D4C41"/>
  <rect x="38" y="34" width="4" height="56" rx="1" fill="#8D6E63" opacity="0.4"/>
  <rect x="8" y="8" width="64" height="30" rx="4" fill="#A1887F"/>
  <rect x="8" y="8" width="64" height="10" rx="4" fill="#BCAAA4" opacity="0.4"/>
  <rect x="6" y="6" width="68" height="34" rx="6" fill="none" stroke="#4E342E" stroke-width="3"/>
</svg>`);

// ===========================================================================
// BACKGROUNDS
// ===========================================================================

write('backgrounds/hill_green.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256" viewBox="0 0 512 256">
  <path d="M0,256 L0,180 Q64,120 128,160 Q192,100 256,140 Q320,80 384,130 Q448,90 512,150 L512,256 Z" fill="#4CAF50" opacity="0.6"/>
  <path d="M0,256 L0,200 Q80,150 160,180 Q240,130 320,170 Q400,120 480,160 L512,140 L512,256 Z" fill="#388E3C" opacity="0.4"/>
</svg>`);

write('backgrounds/hill_snow.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256" viewBox="0 0 512 256">
  <path d="M0,256 L0,180 Q64,120 128,160 Q192,100 256,140 Q320,80 384,130 Q448,90 512,150 L512,256 Z" fill="#B0BEC5" opacity="0.6"/>
  <path d="M0,256 L0,200 Q80,150 160,180 Q240,130 320,170 Q400,120 480,160 L512,140 L512,256 Z" fill="#CFD8DC" opacity="0.4"/>
  <path d="M0,180 Q64,120 128,160 Q192,100 256,140 Q320,80 384,130 Q448,90 512,150" fill="none" stroke="#ECEFF1" stroke-width="6" opacity="0.7"/>
</svg>`);

write('backgrounds/mountain_rock.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256" viewBox="0 0 512 256">
  <polygon points="0,256 60,120 120,180 180,60 240,150 300,90 360,130 420,40 480,110 512,80 512,256" fill="#546E7A" opacity="0.6"/>
  <polygon points="180,60 200,40 220,70" fill="#78909C" opacity="0.4"/>
  <polygon points="420,40 440,20 460,50" fill="#78909C" opacity="0.4"/>
  <polygon points="0,256 80,160 160,200 250,100 340,170 430,80 512,130 512,256" fill="#455A64" opacity="0.4"/>
</svg>`);

console.log('All sprites generated in:', OUT);
