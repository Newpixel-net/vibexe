#!/usr/bin/env node
/**
 * Spritesheet Re-Center Tool — Root Motion Removal
 *
 * Analyzes a spritesheet and re-centers each frame so the character's
 * visual center-of-mass stays consistent across all frames. This removes
 * "root motion drift" where the 3D animation's translation is baked into
 * the sprite frames, causing visual teleportation on animation transitions.
 *
 * Usage:
 *   node tools/spritesheet-recenter.mjs <sheet.png> <sheet.json> [--output <dir>] [--preview]
 *
 * What it does:
 *   1. Reads the spritesheet PNG + JSON metadata
 *   2. For each frame, finds the bounding box of non-transparent pixels
 *   3. Computes the center-of-mass (weighted by alpha) for each frame
 *   4. Re-draws each frame so the character is centered consistently
 *   5. Outputs a new spritesheet PNG + updated JSON
 *
 * The --preview flag generates a side-by-side comparison image.
 *
 * Part of the Vibexe 2D Engine sprite pipeline.
 * Future: integrate into the 3D→2D capture pipeline for automatic centering.
 */

import { createCanvas, loadImage } from 'canvas';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';

// ─── Configuration ───────────────────────────────────────────────────────────

const ALPHA_THRESHOLD = 20;   // Pixels with alpha <= this are "transparent"
const PADDING_PCT = 0.05;     // 5% padding around the centered character

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find bounding box and center-of-mass of non-transparent pixels in a region */
function analyzeRegion(imageData, rx, ry, rw, rh, fullWidth) {
  let minX = rw, maxX = 0, minY = rh, maxY = 0;
  let totalAlpha = 0, weightedX = 0, weightedY = 0;

  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const idx = ((ry + y) * fullWidth + (rx + x)) * 4;
      const a = imageData.data[idx + 3];
      if (a > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        totalAlpha += a;
        weightedX += x * a;
        weightedY += y * a;
      }
    }
  }

  if (totalAlpha === 0) {
    return { empty: true, centerX: rw / 2, centerY: rh / 2, bbox: null };
  }

  return {
    empty: false,
    centerX: weightedX / totalAlpha,
    centerY: weightedY / totalAlpha,
    bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
}

/** Re-draw a frame region centered at targetCX, targetCY */
function recenterFrame(srcCtx, dstCtx, sx, sy, sw, sh, dx, dy, analysis, targetCX, targetCY) {
  if (analysis.empty) return;

  // How much to shift the content
  const shiftX = Math.round(targetCX - analysis.centerX);
  const shiftY = Math.round(targetCY - analysis.centerY);

  // Clear destination
  dstCtx.clearRect(dx, dy, sw, sh);

  // Draw shifted
  dstCtx.drawImage(
    srcCtx.canvas,
    sx, sy, sw, sh,           // source frame
    dx + shiftX, dy + shiftY, sw, sh  // destination with offset
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node tools/spritesheet-recenter.mjs <sheet.png> <sheet.json> [--output <dir>] [--preview]');
    console.log('');
    console.log('Removes root motion drift from spritesheets by re-centering each frame.');
    console.log('');
    console.log('Options:');
    console.log('  --output <dir>   Output directory (default: same as input with _centered suffix)');
    console.log('  --preview        Generate a before/after comparison image');
    console.log('  --vertical-only  Only center vertically (keep horizontal motion)');
    console.log('  --report         Print per-frame drift analysis without modifying files');
    process.exit(1);
  }

  const pngPath = args[0];
  const jsonPath = args[1];
  const outputDir = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  const preview = args.includes('--preview');
  const reportOnly = args.includes('--report');
  const verticalOnly = args.includes('--vertical-only');

  // Load spritesheet
  console.log(`Loading spritesheet: ${pngPath}`);
  const img = await loadImage(pngPath);
  const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'));

  // Parse frame data from JSON (supports TexturePacker and Vibexe formats)
  const frames = jsonData.frames;
  let frameList;

  if (Array.isArray(frames)) {
    // Array format: [{ filename, frame: { x, y, w, h } }]
    frameList = frames;
  } else {
    // Object format: { "frame_name": { frame: { x, y, w, h } } }
    frameList = Object.entries(frames).map(([name, data]) => ({
      filename: name,
      frame: data.frame,
      ...data,
    }));
  }

  console.log(`Found ${frameList.length} frames in ${img.width}x${img.height} sheet`);

  // Draw source image to canvas for pixel access
  const srcCanvas = createCanvas(img.width, img.height);
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(img, 0, 0);
  const fullImageData = srcCtx.getImageData(0, 0, img.width, img.height);

  // ── Step 1: Analyze all frames ────────────────────────────────────────────

  const analyses = [];
  let totalCX = 0, totalCY = 0, validCount = 0;

  for (const entry of frameList) {
    const f = entry.frame;
    const analysis = analyzeRegion(fullImageData, f.x, f.y, f.w, f.h, img.width);
    analyses.push({ ...entry, analysis });

    if (!analysis.empty) {
      totalCX += analysis.centerX;
      totalCY += analysis.centerY;
      validCount++;
    }
  }

  // Target center: average center-of-mass across all frames (or frame center)
  const targetCX = validCount > 0 ? totalCX / validCount : frameList[0].frame.w / 2;
  const targetCY = validCount > 0 ? totalCY / validCount : frameList[0].frame.h / 2;

  // ── Step 2: Report drift ──────────────────────────────────────────────────

  console.log(`\nTarget center: (${targetCX.toFixed(1)}, ${targetCY.toFixed(1)})`);
  console.log('─'.repeat(70));
  console.log('Frame'.padEnd(30) + 'CenterX'.padEnd(10) + 'CenterY'.padEnd(10) + 'DriftX'.padEnd(10) + 'DriftY');
  console.log('─'.repeat(70));

  let maxDrift = 0;
  for (const entry of analyses) {
    const a = entry.analysis;
    if (a.empty) {
      console.log(`${(entry.filename || '?').padEnd(30)} (empty frame)`);
      continue;
    }
    const dx = a.centerX - targetCX;
    const dy = a.centerY - targetCY;
    const drift = Math.sqrt(dx * dx + dy * dy);
    if (drift > maxDrift) maxDrift = drift;
    console.log(
      `${(entry.filename || '?').substring(0, 29).padEnd(30)}` +
      `${a.centerX.toFixed(1).padEnd(10)}${a.centerY.toFixed(1).padEnd(10)}` +
      `${(dx >= 0 ? '+' : '') + dx.toFixed(1).padEnd(9)}${(dy >= 0 ? '+' : '') + dy.toFixed(1)}`
    );
  }

  console.log('─'.repeat(70));
  console.log(`Max drift: ${maxDrift.toFixed(1)}px (${(maxDrift / frameList[0].frame.w * 100).toFixed(1)}% of frame width)`);

  if (reportOnly) {
    console.log('\n(Report only mode — no files modified)');
    return;
  }

  if (maxDrift < 2) {
    console.log('\nDrift is negligible — no re-centering needed.');
    return;
  }

  // ── Step 3: Re-center frames ──────────────────────────────────────────────

  console.log(`\nRe-centering ${frameList.length} frames...`);
  const dstCanvas = createCanvas(img.width, img.height);
  const dstCtx = dstCanvas.getContext('2d');
  // Start with transparent background
  dstCtx.clearRect(0, 0, img.width, img.height);

  for (const entry of analyses) {
    const f = entry.frame;
    const a = entry.analysis;

    if (a.empty) {
      // Copy empty frames as-is
      dstCtx.drawImage(srcCanvas, f.x, f.y, f.w, f.h, f.x, f.y, f.w, f.h);
      continue;
    }

    const applyCX = verticalOnly ? a.centerX : targetCX;
    recenterFrame(srcCtx, dstCtx, f.x, f.y, f.w, f.h, f.x, f.y, a, applyCX, targetCY);
  }

  // ── Step 4: Save output ───────────────────────────────────────────────────

  const outDir = outputDir || dirname(pngPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const baseName = basename(pngPath, '.png');
  const outPng = join(outDir, outputDir ? basename(pngPath) : `${baseName}_centered.png`);
  const outJson = join(outDir, outputDir ? basename(jsonPath) : basename(jsonPath).replace('.json', '_centered.json'));

  // Save PNG
  const pngBuffer = dstCanvas.toBuffer('image/png');
  writeFileSync(outPng, pngBuffer);
  console.log(`Saved: ${outPng} (${(pngBuffer.length / 1024).toFixed(0)}KB)`);

  // Save JSON (frame positions unchanged — only pixel content moved within frames)
  writeFileSync(outJson, JSON.stringify(jsonData, null, 2));
  console.log(`Saved: ${outJson}`);

  // ── Step 5: Preview (optional) ────────────────────────────────────────────

  if (preview) {
    const pw = img.width * 2 + 20;
    const ph = img.height + 40;
    const previewCanvas = createCanvas(pw, ph);
    const previewCtx = previewCanvas.getContext('2d');

    // Dark background
    previewCtx.fillStyle = '#1a1a2e';
    previewCtx.fillRect(0, 0, pw, ph);

    // Labels
    previewCtx.fillStyle = '#ffffff';
    previewCtx.font = '14px monospace';
    previewCtx.fillText('BEFORE (original)', 10, 20);
    previewCtx.fillText('AFTER (re-centered)', img.width + 30, 20);

    // Side by side
    previewCtx.drawImage(srcCanvas, 0, 30);
    previewCtx.drawImage(dstCanvas, img.width + 20, 30);

    // Draw center lines on both
    previewCtx.strokeStyle = 'rgba(255,0,0,0.3)';
    previewCtx.setLineDash([4, 4]);
    for (const entry of analyses) {
      const f = entry.frame;
      const cx = f.x + targetCX;
      // Before
      previewCtx.beginPath();
      previewCtx.moveTo(cx, 30 + f.y);
      previewCtx.lineTo(cx, 30 + f.y + f.h);
      previewCtx.stroke();
      // After
      previewCtx.beginPath();
      previewCtx.moveTo(cx + img.width + 20, 30 + f.y);
      previewCtx.lineTo(cx + img.width + 20, 30 + f.y + f.h);
      previewCtx.stroke();
    }

    const previewPath = join(outDir, `${baseName}_comparison.png`);
    writeFileSync(previewPath, previewCanvas.toBuffer('image/png'));
    console.log(`Preview: ${previewPath}`);
  }

  console.log('\nDone! Root motion removed.');
}

main().catch(err => { console.error(err); process.exit(1); });
