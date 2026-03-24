// vibexe-integration/lib/file-tools.ts
// AI SDK tool definitions for file operations in App Builder
//
// This file provides createFileTools() which returns tool definitions
// for the AI to create, update, and delete files during code generation.
//
// Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/(main)/app-builder/lib/file-tools.ts

import { eq } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases, featureBankSnippets } from "@/db/schema";
import { inArray } from "drizzle-orm";
import {
	ensureAppDatabase,
	entityToTableName,
	type AppSchema,
} from "@/lib/app-database";
import { applySchema, diffAndApplySchema } from "@/lib/app-database/schema-executor";
import { deleteFile, getFileByPath, saveFile } from "./queries";

/**
 * Options for file creation filtering.
 * Used to prevent AI agents from overwriting pre-created templates
 * or creating forbidden files (e.g. BootScene, MenuScene).
 */
export interface FileToolsOptions {
	/** Paths that already exist as pre-created templates — silently skip overwrites */
	protectedPaths?: Set<string>;
	/** Regex patterns for files that should never be created */
	forbiddenPatterns?: RegExp[];
	/** Path rewrites: e.g. { "src/scenes/GameScene.ts": "src/scenes/GameScene3D.ts" } */
	pathRewrites?: Map<string, string>;
	/** If set, ONLY files matching at least one pattern can be created/updated */
	allowedPathPatterns?: RegExp[];
	/** Import path rewrites applied to file CONTENT (fix import/from mismatches after path rewrites) */
	importRewrites?: [RegExp, string][];
}

/**
 * Create file operation tools for AI SDK.
 * These tools allow the AI to create, update, and delete files
 * during the app generation process.
 *
 * @param appId - The builder app ID (bldr_xxx) to scope operations to
 * @param options - Optional filtering to protect templates and block forbidden files
 * @returns Object containing createFile, updateFile, deleteFile tools
 */
export function createFileTools(appId: string, options?: FileToolsOptions) {
	const protectedPaths = options?.protectedPaths ?? new Set<string>();
	const forbiddenPatterns = options?.forbiddenPatterns ?? [];
	const pathRewrites = options?.pathRewrites ?? new Map<string, string>();
	const allowedPathPatterns = options?.allowedPathPatterns ?? [];
	const importRewrites = options?.importRewrites ?? [];

	/** Rewrite path if a mapping exists (e.g. GameScene.ts → GameScene3D.ts) */
	function rewritePath(filePath: string): string {
		const rewritten = pathRewrites.get(filePath);
		if (rewritten) {
			console.log(`[FileTools] Path rewrite: ${filePath} → ${rewritten}`);
			return rewritten;
		}
		return filePath;
	}

	/** Fix known import path mismatches in file content */
	function rewriteImports(content: string): string {
		if (importRewrites.length === 0) return content;
		let result = content;
		for (const [pattern, replacement] of importRewrites) {
			result = result.replace(pattern, replacement);
		}
		return result;
	}

	/** Check if a path is forbidden — returns rejection message or null */
	function checkForbidden(filePath: string): string | null {
		if (protectedPaths.has(filePath)) {
			console.log(`[FileTools] BLOCKED protected path: ${filePath}`);
			return `File "${filePath}" is a pre-created template and cannot be overwritten. Import from it instead.`;
		}
		for (const pattern of forbiddenPatterns) {
			if (pattern.test(filePath)) {
				console.log(`[FileTools] BLOCKED forbidden pattern: ${filePath}`);
				return `File "${filePath}" is BLOCKED. Do NOT create BootScene, MenuScene, or LoadingScene — Game3D.tsx already provides loading/menu/restart. Put ALL game logic in src/scenes/GameScene3D.ts. Only import from: ../config/assets-3d, ../utils/media-stock-3d, ../scenes/GameOverScene3D, ../config/constants.`;
			}
		}
		// Allowlist: if set, only matching paths can be created
		if (allowedPathPatterns.length > 0) {
			const isAllowed = allowedPathPatterns.some((p) => p.test(filePath));
			if (!isAllowed) {
				console.log(`[FileTools] BLOCKED by allowlist: ${filePath}`);
				// Detect 2D vs 3D by checking what's allowed
				const is2D = allowedPathPatterns.some((p) => p.toString().includes("GameScene2D"));
				if (is2D) {
					return `File "${filePath}" is not allowed. For 2D games you may ONLY create/update: src/scenes/GameScene2D.ts, src/config/constants.ts, docs/*.md. Do NOT create App.tsx, Game2D.tsx, or any other files. Put ALL game logic in GameScene2D.ts.`;
				}
				return `File "${filePath}" is not allowed. Only create: src/scenes/GameScene3D.ts, src/config/constants.ts, docs/*.md, src/objects/*.ts, src/utils/level-builder.ts. Put ALL game logic in GameScene3D.ts.`;
			}
		}
		return null;
	}

	return {
		create_file: tool({
			description:
				"Create a new file in the project. Use this when generating new code files like components, pages, utilities, or configuration files.",
			inputSchema: z.object({
				path: z
					.string()
					.describe(
						'File path relative to project root, e.g., "src/App.tsx" or "src/components/Button.tsx"',
					)
					.regex(
						/^[a-zA-Z0-9_\-./]+$/,
						"Path must contain only alphanumeric characters, underscores, hyphens, dots, and slashes",
					),
				content: z
					.string()
					.describe(
						"The complete file content including all imports and exports",
					),
				language: z
					.string()
					.optional()
					.describe(
						"Programming language for syntax highlighting (auto-detected if not provided)",
					),
			}),
			execute: async ({ path: rawPath, content: rawContent, language }) => {
				const path = rewritePath(rawPath);
				const content = rewriteImports(rawContent);
				const blocked = checkForbidden(path);
				if (blocked) {
					return { success: false, action: "created", path, error: blocked };
				}
				// Hard line count limit for 2D GameScene — prevents full rewrites
				const is2DScene = /GameScene2D\.ts$/i.test(path);
				if (is2DScene) {
					const lineCount = content.split("\n").length;
					if (lineCount > 600) {
						console.log(`[FileTools] BLOCKED GameScene2D.ts create: ${lineCount} lines (max 600).`);
						return {
							success: false,
							action: "created",
							path,
							error: `BLOCKED: GameScene2D.ts has ${lineCount} lines — max allowed is 600. The hybrid starter is ~350 lines. You must ENHANCE it by adding 50-150 lines, not rewrite from scratch.`,
						};
					}
				}
				try {
					const lang = language || inferLanguage(path);
					const file = await saveFile(appId, path, content, lang);
					return { success: true, action: "created", path, fileId: file.id };
				} catch (error) {
					console.error("create_file error:", error);
					return {
						success: false,
						action: "created",
						path,
						error: `Failed to create file: ${String(error)}`,
					};
				}
			},
		}),

		update_file: tool({
			description:
				"Update an existing file in the project. Use this when modifying existing code, fixing bugs, or adding features to existing files.",
			inputSchema: z.object({
				path: z.string().describe("File path to update"),
				content: z
					.string()
					.describe(
						"The new complete file content (replaces entire file contents)",
					),
			}),
			execute: async ({ path: rawPath, content: rawContent }) => {
				const path = rewritePath(rawPath);
				const content = rewriteImports(rawContent);
				const blocked = checkForbidden(path);
				if (blocked) {
					return { success: false, action: "updated", path, error: blocked };
				}
				// Hard line count limits for 2D GameScene — prevents rewrites AND replacements
				const is2DScene = /GameScene2D\.ts$/i.test(path);
				if (is2DScene) {
					const lineCount = content.split("\n").length;
					if (lineCount > 600) {
						console.log(`[FileTools] BLOCKED GameScene2D.ts update: ${lineCount} lines (max 600). Full rewrite.`);
						return {
							success: false,
							action: "updated",
							path,
							error: `BLOCKED: GameScene2D.ts has ${lineCount} lines — max allowed is 600. The hybrid starter is ~150-350 lines. You are REWRITING instead of ENHANCING. Use read_file first, then add only 50-150 lines of enhancements. Do NOT rewrite the entire file.`,
						};
					}
					if (lineCount < 120) {
						console.log(`[FileTools] BLOCKED GameScene2D.ts update: ${lineCount} lines (min 120). Replacement with skeleton.`);
						return {
							success: false,
							action: "updated",
							path,
							error: `BLOCKED: GameScene2D.ts has only ${lineCount} lines — the hybrid starter has 150-350 lines of working game code. You are REPLACING the full game with a skeleton. Use read_file to see the existing code, then use update_file with the FULL existing code PLUS your additions.`,
						};
					}
				}
				try {
					const lang = inferLanguage(path);
					const file = await saveFile(appId, path, content, lang);
					return { success: true, action: "updated", path, fileId: file.id };
				} catch (error) {
					console.error("update_file error:", error);
					return {
						success: false,
						action: "updated",
						path,
						error: `Failed to update file: ${String(error)}`,
					};
				}
			},
		}),

		delete_file: tool({
			description:
				"Delete a file from the project. Use this when removing unnecessary files or when a file is being replaced by another.",
			inputSchema: z.object({
				path: z.string().describe("File path to delete"),
			}),
			execute: async ({ path }) => {
				try {
					await deleteFile(appId, path);
					return { success: true, action: "deleted", path };
				} catch (error) {
					console.error("delete_file error:", error);
					return {
						success: false,
						action: "deleted",
						path,
						error: `Failed to delete file: ${String(error)}`,
					};
				}
			},
		}),

		patch_file: tool({
			description:
				"Safely add code to an existing file WITHOUT replacing it. Use this instead of update_file when you want to INSERT new code at a specific location. This preserves all existing code and only adds your new content. PREFERRED over update_file for GameScene2D.ts enhancements.",
			inputSchema: z.object({
				path: z.string().describe("File path to patch"),
				anchor: z
					.string()
					.describe(
						'A unique string that exists in the file to locate the insertion point. For GameScene2D.ts, use "// === AI ENHANCEMENT ZONE ===" or the closing brace of enter().',
					),
				position: z
					.enum(["before", "after"])
					.describe(
						"Insert the new code BEFORE or AFTER the anchor string",
					),
				code: z
					.string()
					.describe(
						"The new code to insert. This is ADDED to the file, not replacing anything.",
					),
			}),
			execute: async ({ path: rawPath, anchor, position, code }) => {
				const path = rewritePath(rawPath);
				const blocked = checkForbidden(path);
				if (blocked) {
					return { success: false, action: "patched", path, error: blocked };
				}
				try {
					// Read existing file
					const existing = await getFileByPath(appId, path);
					if (!existing) {
						return {
							success: false,
							action: "patched",
							path,
							error: `File not found: ${path}. Use create_file to create it first.`,
						};
					}
					const oldContent = existing.content ?? "";

					// Find anchor
					const anchorIdx = oldContent.indexOf(anchor);
					if (anchorIdx === -1) {
						return {
							success: false,
							action: "patched",
							path,
							error: `Anchor string not found in ${path}: "${anchor.slice(0, 80)}...". Use read_file first to find the correct anchor string.`,
						};
					}

					// Limit patch size (prevent massive insertions)
					const patchLines = code.split("\n").length;
					if (patchLines > 300) {
						return {
							success: false,
							action: "patched",
							path,
							error: `Patch too large: ${patchLines} lines (max 300). Add smaller enhancements incrementally.`,
						};
					}

					// Insert code
					let newContent: string;
					if (position === "before") {
						newContent =
							oldContent.slice(0, anchorIdx) +
							code +
							"\n" +
							oldContent.slice(anchorIdx);
					} else {
						const afterAnchor = anchorIdx + anchor.length;
						newContent =
							oldContent.slice(0, afterAnchor) +
							"\n" +
							code +
							oldContent.slice(afterAnchor);
					}

					const newContent2 = rewriteImports(newContent);
					const lang = inferLanguage(path);
					const file = await saveFile(appId, path, newContent2, lang);
					console.log(
						`[FileTools] PATCHED ${path}: +${patchLines} lines ${position} "${anchor.slice(0, 40)}..."`,
					);
					return {
						success: true,
						action: "patched",
						path,
						fileId: file.id,
						linesAdded: patchLines,
					};
				} catch (error) {
					console.error("patch_file error:", error);
					return {
						success: false,
						action: "patched",
						path,
						error: `Failed to patch file: ${String(error)}`,
					};
				}
			},
		}),

		read_file: tool({
			description:
				"Read the contents of an existing file in the project. Use this BEFORE update_file to understand the current code, or to inspect any file's implementation.",
			inputSchema: z.object({
				path: z
					.string()
					.describe(
						'File path relative to project root, e.g., "src/App.tsx" or "Blueprint.md"',
					),
			}),
			execute: async ({ path }) => {
				try {
					const file = await getFileByPath(appId, path);
					if (!file) {
						return {
							success: false,
							path,
							error: `File not found: ${path}`,
						};
					}
					return {
						success: true,
						path,
						content: file.content,
						language: file.language,
					};
				} catch (error) {
					console.error("read_file error:", error);
					return {
						success: false,
						path,
						error: `Failed to read file: ${String(error)}`,
					};
				}
			},
		}),

		compose_game: tool({
			description:
				"Compose a full-quality 2D game from Feature Bank snippets. Generates a production-ready GameScene2D.ts with 18 visual layers (sky, stars, parallax mountains, fog, clouds, decorations, ground, trees, platforms, player, coins, enemies, particles, UI, camera, juice, lighting, vignette), seeded PRNG for deterministic variety, CharacterController physics, collision handling, and full animation loop. Pass Creative Brief params directly.",
			inputSchema: z.object({
				theme: z.string().describe("Game theme palette key: forest, sunset, space, volcanic, candy, arctic, dark, ocean"),
				genre: z.string().describe("Game genre: platformer, runner, shooter, puzzle"),
				features: z.string().describe("JSON array of features: [{\"id\":\"double-jump\",\"config\":{\"maxJumps\":2}},...]"),
				customCode: z.string().optional().describe("Additional custom code to inject into the scene's enter() method (for mechanics not in the bank)"),
				seed: z.number().optional().describe("PRNG seed for deterministic world generation (default: 1234)"),
				worldWidth: z.number().optional().describe("World width in pixels (default: 4000)"),
				worldHeight: z.number().optional().describe("World height in pixels (default: 900)"),
				gravity: z.number().optional().describe("Gravity strength (default: 980)"),
				moveSpeed: z.number().optional().describe("Player move speed (default: 280)"),
				jumpForce: z.number().optional().describe("Player jump force (default: 520)"),
				platformCount: z.number().optional().describe("Number of platforms (default: 11)"),
				coinCount: z.number().optional().describe("Number of coins (default: 27)"),
				enemyCount: z.number().optional().describe("Number of enemies (default: 6)"),
				levelShape: z.string().optional().describe("Level layout shape: flat-wide, staircase-ascending, valley-bowl, hilly-undulating"),
				difficulty: z.string().optional().describe("Difficulty profile: gentle, balanced, hardcore"),
				doubleJump: z.boolean().optional().describe("Enable double jump (default: true)"),
				wallSlide: z.boolean().optional().describe("Enable wall slide (default: false)"),
				lives: z.number().optional().describe("Starting lives (default: 3)"),
			}),
			execute: async ({ theme, genre, features: featuresJson, customCode, seed, worldWidth, worldHeight, gravity, moveSpeed, jumpForce, platformCount, coinCount, enemyCount, levelShape, difficulty, doubleJump, wallSlide, lives }) => {
				try {
					// Parse features from JSON string
					let features: Array<{ id: string; config: Record<string, any> }> = [];
					try {
						features = JSON.parse(featuresJson || "[]");
					} catch {
						return { success: false, action: "composed", error: "Invalid features JSON. Expected: [{\"id\":\"double-jump\",\"config\":{}}]" };
					}

					// Resolve config values
					const cfg = {
						seed: seed ?? 1234,
						worldWidth: worldWidth ?? 4000,
						worldHeight: worldHeight ?? 900,
						gravity: gravity ?? 980,
						moveSpeed: moveSpeed ?? 280,
						jumpForce: jumpForce ?? 520,
						platformCount: platformCount ?? 11,
						coinCount: coinCount ?? 27,
						enemyCount: enemyCount ?? 6,
						levelShape: levelShape ?? "flat-wide",
						doubleJump: doubleJump ?? true,
						wallSlide: wallSlide ?? false,
						lives: lives ?? 3,
					};
					const groundY = cfg.worldHeight - 220;

					// Fetch all requested feature code from the bank
					const featureIds = features.map(f => f.id);
					const bankFeatures = featureIds.length > 0
						? await db.select().from(featureBankSnippets).where(inArray(featureBankSnippets.id, featureIds))
						: [];

					const foundIds = new Set(bankFeatures.map(f => f.id));
					const missingIds = featureIds.filter(id => !foundIds.has(id));

					// Build feature registration code
					let featureRegistrations = "";
					let featureFactories = "";

					for (const bankFeature of bankFeatures) {
						const config = features.find(f => f.id === bankFeature.id)?.config || {};
						const deps = (bankFeature.dependencies as string[]) || [];

						featureFactories += `
// --- Feature: ${bankFeature.name} (${bankFeature.id}) ---
var __feature_${bankFeature.id.replace(/-/g, "_")}_factory = (function() {
  try {
    ${bankFeature.code}
    return typeof create !== 'undefined' ? create
      : typeof createFeature !== 'undefined' ? createFeature
      : (typeof exports !== 'undefined' && exports.default) ? exports.default
      : function(cfg: any) { return { id: '${bankFeature.id}', init: function(){}, update: function(){}, destroy: function(){} }; };
  } catch(e) {
    console.warn('[FeatureBank] Failed to load ${bankFeature.id}:', e);
    return function(cfg: any) { return { id: '${bankFeature.id}', init: function(){}, update: function(){}, destroy: function(){} }; };
  }
})();
`;
						featureRegistrations += `    engine.features.register('${bankFeature.id}', __feature_${bankFeature.id.replace(/-/g, "_")}_factory, ${JSON.stringify(config)}, ${JSON.stringify(deps)});\n`;
					}

					// Generate the composed GameScene2D.ts — full production quality
					const sceneCode = `// Auto-composed from Feature Bank — ${features.length} features, seed ${cfg.seed}
import { Engine2D, GameScene, createGame2D, loadAssets, JuiceSystem } from "../engine/core";
import { createBody, createStaticBody, createOneWayPlatform, PhysicsWorld, CharacterController } from "../engine/physics";
import { createAmbientEffect, createSnowEffect, createRainEffect, getThemeEffects, onJumpDust, onLandImpact, onCollectSparkle, onDeathExplosion } from "../engine/effects";
import { PALETTES, lerpColor, setNoiseSeed, drawSkyGradient, drawStars, drawMountainRange, drawCloud, drawTree, drawGroundStrip, drawPlatformBlock, drawPlayerCharacter, drawCoinToken, drawEnemySlime, drawHeart, drawVignette, drawAtmosphericFog, drawLSystemTree, TREE_PRESETS, drawPointLight, createLightingLayer, createWaterSurface, createLavaSurface } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";

const PIXI = (window as any).PIXI;

// ======================== SEEDED PRNG (Mulberry32) ========================
var _seed = ${cfg.seed};
function _rng() { _seed |= 0; _seed = _seed + 0x6D2B79F5 | 0; var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function _rngRange(min: number, max: number) { return min + _rng() * (max - min); }
function _rngInt(min: number, max: number) { return Math.floor(_rngRange(min, max + 1)); }
function _rngPick<T>(arr: T[]): T { return arr[_rngInt(0, arr.length - 1)]; }

// ======================== CONFIGURATION ========================
var THEME = '${theme}';
var PAL = PALETTES[THEME] || PALETTES.forest;

var CONFIG = {
  gravity: ${cfg.gravity},
  worldWidth: ${cfg.worldWidth},
  worldHeight: ${cfg.worldHeight},
  groundY: ${groundY},
  playerSize: 48,
  playerStartX: 250,
  moveSpeed: ${cfg.moveSpeed},
  jumpForce: ${cfg.jumpForce},
  coinRadius: 10,
  enemySize: 44,
  enemySpeed: 60,
  lives: ${cfg.lives},
  platformCount: ${cfg.platformCount},
  enemyCount: ${cfg.enemyCount},
  coinCount: ${cfg.coinCount},
  levelShape: '${cfg.levelShape}' as 'flat-wide' | 'staircase-ascending' | 'valley-bowl' | 'hilly-undulating',
  doubleJump: ${cfg.doubleJump},
  wallSlide: ${cfg.wallSlide},
};

// ======================== LEVEL GENERATORS ========================
function _generatePlatformY(index: number, total: number): number {
  var t = index / Math.max(total - 1, 1);
  var minY = CONFIG.groundY - 360;
  var maxY = CONFIG.groundY - 80;
  switch (CONFIG.levelShape) {
    case 'staircase-ascending':
      return maxY - t * (maxY - minY) + _rngRange(-20, 20);
    case 'valley-bowl':
      var bowl = Math.abs(t - 0.5) * 2;
      return minY + bowl * (maxY - minY) * 0.6 + _rngRange(-15, 15);
    case 'hilly-undulating':
      return minY + (maxY - minY) * (0.5 + 0.4 * Math.sin(t * Math.PI * 3)) + _rngRange(-20, 20);
    default:
      return _rngRange(minY, maxY);
  }
}

function _generatePlatforms() {
  var plats = [];
  var spacing = (CONFIG.worldWidth - 600) / CONFIG.platformCount;
  for (var i = 0; i < CONFIG.platformCount; i++) {
    plats.push({
      x: 350 + i * spacing + _rngRange(-spacing * 0.2, spacing * 0.2),
      y: _generatePlatformY(i, CONFIG.platformCount),
      w: _rngInt(120, 200),
    });
  }
  return plats;
}

function _generateCoins(platforms: { x: number; y: number; w: number }[]) {
  var coins: { x: number; y: number }[] = [];
  var onPlatCount = Math.floor(CONFIG.coinCount * 0.6);
  var groundCount = CONFIG.coinCount - onPlatCount;
  for (var i = 0; i < onPlatCount; i++) {
    var p = platforms[_rngInt(0, platforms.length - 1)];
    coins.push({ x: p.x + _rngRange(-p.w * 0.3, p.w * 0.3), y: p.y - _rngRange(25, 45) });
  }
  for (var j = 0; j < groundCount; j++) {
    coins.push({ x: _rngRange(300, CONFIG.worldWidth - 200), y: CONFIG.groundY - 40 });
  }
  return coins;
}

function _generateEnemies() {
  var enemies: { x: number; range: number }[] = [];
  var spacing = (CONFIG.worldWidth - 400) / CONFIG.enemyCount;
  for (var i = 0; i < CONFIG.enemyCount; i++) {
    enemies.push({
      x: 500 + i * spacing + _rngRange(-spacing * 0.2, spacing * 0.2),
      range: _rngInt(80, 180),
    });
  }
  return enemies;
}

function _generateDecorations() {
  var count = _rngInt(10, 18);
  var decs: { x: number; type: number; size: number; flip: boolean }[] = [];
  var spacing = CONFIG.worldWidth / count;
  for (var i = 0; i < count; i++) {
    decs.push({
      x: i * spacing + _rngRange(20, spacing - 20),
      type: _rngInt(0, 3),
      size: _rngRange(1.8, 3.2),
      flip: _rng() > 0.5,
    });
  }
  return decs;
}

// ======================== THEME-SPECIFIC DRAWING ========================
function _drawDecoration(type: number, size: number): any {
  var g = new PIXI.Graphics();
  var s = size;
  switch (THEME) {
    case 'volcanic':
      if (type === 0) { g.beginFill(0xff3300, 0.8); g.drawEllipse(0, 0, 30*s, 8*s); g.endFill(); g.beginFill(0xff6600, 0.6); g.drawEllipse(0, -2, 20*s, 5*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x3a2a1a); g.moveTo(-8*s, 0); g.lineTo(8*s, 0); g.lineTo(4*s, -20*s); g.lineTo(-4*s, -20*s); g.endFill(); g.beginFill(0xff4400, 0.5); g.drawCircle(0, -20*s, 3*s); g.endFill(); }
      else if (type === 2) { g.beginFill(0x1a1a2a); g.moveTo(0, -35*s); g.lineTo(8*s, 0); g.lineTo(-8*s, 0); g.endFill(); g.beginFill(0xff4400, 0.3); g.moveTo(0, -30*s); g.lineTo(3*s, -10*s); g.lineTo(-3*s, -10*s); g.endFill(); }
      else { g.beginFill(0x4a3a2a); g.drawRoundedRect(-15*s, -12*s, 30*s, 12*s, 4); g.endFill(); }
      break;
    case 'arctic':
      if (type === 0) { g.beginFill(0x99ddff, 0.8); g.moveTo(0, -40*s); g.lineTo(6*s, -10*s); g.lineTo(0, 0); g.lineTo(-6*s, -10*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0xddeeff, 0.9); g.drawEllipse(0, 0, 25*s, 10*s); g.endFill(); }
      else if (type === 2) { g.beginFill(0x88bbdd); g.drawRoundedRect(-6*s, -45*s, 12*s, 45*s, 3); g.endFill(); g.beginFill(0x99ccee); g.drawCircle(0, -48*s, 8*s); g.endFill(); }
      else { for (var ic = 0; ic < 3; ic++) { var ix = (ic-1)*10*s; var ih = (20+ic*8)*s; g.beginFill(0xaaddff, 0.8); g.moveTo(ix-3*s, 0); g.lineTo(ix, -ih); g.lineTo(ix+3*s, 0); g.endFill(); } }
      break;
    case 'candy':
      if (type === 0) { g.beginFill(0x886644); g.drawRect(-2*s, -40*s, 4*s, 40*s); g.endFill(); g.beginFill(0xff6699); g.drawCircle(0, -48*s, 12*s); g.endFill(); g.beginFill(0xffaacc, 0.6); g.drawCircle(-3*s, -50*s, 5*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0xff3344); g.drawRoundedRect(-4*s, -35*s, 8*s, 35*s, 3); g.endFill(); for (var st = 0; st < 5; st++) { g.beginFill(0xffffff, 0.8); g.drawRect(-4*s, -35*s + st*14*s, 8*s, 4*s); g.endFill(); } }
      else if (type === 2) { g.beginFill(0x44cc88); g.drawEllipse(0, -12*s, 10*s, 14*s); g.endFill(); g.beginFill(0xffffff); g.drawCircle(-3*s, -14*s, 2*s); g.drawCircle(3*s, -14*s, 2*s); g.endFill(); }
      else { var sprColors = [0xff6699, 0x66ccff, 0xffcc33, 0x66ff99]; for (var sp = 0; sp < 8; sp++) { g.beginFill(sprColors[sp%sprColors.length]); g.drawRoundedRect(_rngRange(-15,15)*s, _rngRange(-8,0)*s, 6*s, 2*s, 1); g.endFill(); } }
      break;
    case 'space':
      if (type === 0) { g.beginFill(0x555566); g.drawCircle(0, -15*s, 14*s); g.endFill(); g.beginFill(0x444455); g.drawCircle(-5*s, -18*s, 5*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x44ff88, 0.8); g.moveTo(0, 0); g.quadraticCurveTo(15*s, -20*s, 5*s, -35*s); g.quadraticCurveTo(0, -25*s, 0, 0); g.endFill(); }
      else if (type === 2) { g.beginFill(0x333355); g.drawRect(-4*s, -40*s, 8*s, 40*s); g.endFill(); g.beginFill(0x6666ff, 0.7); g.drawCircle(0, -42*s, 6*s); g.endFill(); }
      else { g.beginFill(0x555577); g.drawRect(-2*s, -30*s, 4*s, 30*s); g.endFill(); g.beginFill(0x777799); g.drawEllipse(0, -32*s, 14*s, 6*s); g.endFill(); }
      break;
    case 'dark':
      if (type === 0) { g.beginFill(0x333344); g.drawRect(-2*s, -30*s, 4*s, 30*s); g.endFill(); g.beginFill(0xccccbb); g.drawCircle(0, -35*s, 8*s); g.endFill(); g.beginFill(0x1a1a2a); g.drawEllipse(-3*s, -36*s, 2.5*s, 3*s); g.drawEllipse(3*s, -36*s, 2.5*s, 3*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x333344); g.drawRect(-3*s, -15*s, 6*s, 15*s); g.endFill(); g.beginFill(0x6633aa); g.drawEllipse(0, -18*s, 14*s, 8*s); g.endFill(); g.beginFill(0xaa55ff, 0.4); g.drawEllipse(0, -18*s, 18*s, 10*s); g.endFill(); }
      else if (type === 2) { g.beginFill(0x444455); g.drawRoundedRect(-10*s, -30*s, 20*s, 30*s, 5*s); g.endFill(); g.beginFill(0x333344); g.drawRect(-1*s, -22*s, 2*s, 10*s); g.drawRect(-5*s, -18*s, 10*s, 2*s); g.endFill(); }
      else { g.beginFill(0x444455); g.drawRect(-2*s, -25*s, 4*s, 25*s); g.endFill(); g.beginFill(0x00ff88, 0.4); g.drawCircle(0, -26*s, 4*s); g.endFill(); }
      break;
    case 'ocean':
      if (type === 0) { g.beginFill(0xff6688); g.moveTo(0, 0); g.quadraticCurveTo(10*s, -20*s, 5*s, -30*s); g.quadraticCurveTo(2*s, -20*s, 0, 0); g.endFill(); g.beginFill(0xffaacc); g.drawCircle(4*s, -29*s, 3*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x228855, 0.8); for (var sw2 = 0; sw2 < 3; sw2++) { var sx2 = (sw2-1)*6*s; g.moveTo(sx2, 0); g.quadraticCurveTo(sx2+8*s, -15*s, sx2+2*s, -30*s-sw2*5*s); g.quadraticCurveTo(sx2-2*s, -15*s, sx2, 0); } g.endFill(); }
      else if (type === 2) { g.beginFill(0xffcc88); g.drawEllipse(0, -5*s, 12*s, 8*s); g.endFill(); }
      else { g.beginFill(0x556677); g.drawRect(-2*s, -30*s, 4*s, 30*s); g.endFill(); g.beginFill(0x667788); g.drawCircle(0, -32*s, 5*s); g.endFill(); }
      break;
    case 'sunset':
      if (type === 0) { g.beginFill(0x447733); g.drawRect(-2*s, -35*s, 4*s, 35*s); g.endFill(); for (var pet = 0; pet < 8; pet++) { var pa = pet*Math.PI/4; g.beginFill(0xffcc00); g.drawEllipse(Math.cos(pa)*8*s, -40*s+Math.sin(pa)*8*s, 5*s, 3*s); g.endFill(); } g.beginFill(0x885500); g.drawCircle(0, -40*s, 5*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x558833, 0.7); for (var tg = 0; tg < 5; tg++) { var tx2 = (tg-2)*5*s; g.moveTo(tx2, 0); g.quadraticCurveTo(tx2+4*s, -15*s, tx2+2*s, -25*s-_rng()*10*s); g.lineTo(tx2-1*s, -25*s-_rng()*10*s); g.quadraticCurveTo(tx2-4*s, -15*s, tx2, 0); } g.endFill(); }
      else if (type === 2) { g.beginFill(0x447733); g.drawRect(-2*s, -20*s, 4*s, 20*s); g.endFill(); var flColors = [0xff6688, 0xffaa44, 0xff88cc]; for (var fl = 0; fl < 6; fl++) { g.beginFill(flColors[fl%flColors.length], 0.8); g.drawCircle(_rngRange(-8,8)*s, (-22-_rng()*10)*s, (3+_rng()*2)*s); g.endFill(); } }
      else { g.beginFill(0x558844); g.drawRect(-1.5*s, -40*s, 3*s, 40*s); g.endFill(); g.beginFill(0x885533); g.drawEllipse(0, -42*s, 3.5*s, 8*s); g.endFill(); }
      break;
    default: // forest
      if (type === 0) { g.beginFill(0x886644); g.drawRect(-3*s, -12*s, 6*s, 12*s); g.endFill(); g.beginFill(0xcc3333); g.drawEllipse(0, -15*s, 12*s, 8*s); g.endFill(); g.beginFill(0xffffff, 0.7); g.drawCircle(-4*s, -17*s, 2*s); g.drawCircle(3*s, -14*s, 1.5*s); g.endFill(); }
      else if (type === 1) { g.beginFill(0x447733); g.drawRect(-1*s, -15*s, 2*s, 15*s); g.endFill(); g.beginFill(0xff6688); g.drawCircle(0, -17*s, 5*s); g.endFill(); g.beginFill(0xffdd44); g.drawCircle(0, -17*s, 2*s); g.endFill(); }
      else if (type === 2) { g.beginFill(0x338833, 0.8); for (var fn = 0; fn < 4; fn++) { var fa = (fn-1.5)*0.5; g.moveTo(0, 0); g.quadraticCurveTo(Math.sin(fa)*20*s, -15*s, Math.sin(fa)*15*s, -25*s); g.lineTo(Math.sin(fa)*12*s, -23*s); g.quadraticCurveTo(Math.sin(fa)*15*s, -12*s, 0, 0); } g.endFill(); }
      else { g.beginFill(0x5a3a1a); g.drawEllipse(0, -5*s, 20*s, 7*s); g.endFill(); g.beginFill(0x7a5a3a); g.drawCircle(-18*s, -5*s, 7*s); g.endFill(); }
      break;
  }
  return g;
}

function _drawGroundDetail(x: number, groundY2: number): any {
  var g = new PIXI.Graphics();
  g.x = x; g.y = groundY2;
  var ds = 2.5;
  switch (THEME) {
    case 'volcanic': g.lineStyle(3, 0xff4400, 0.7); g.moveTo(-20*ds, 4); g.lineTo(0, -6); g.lineTo(20*ds, 2); g.beginFill(0xff3300, 0.2); g.drawEllipse(0, 2, 16*ds, 4); g.endFill(); break;
    case 'arctic': g.beginFill(0xddeeff, 0.7); g.drawEllipse(0, 0, 35, 10); g.endFill(); break;
    case 'candy': var sc = [0xff6699, 0x66ccff, 0xffcc33, 0x66ff99]; for (var j = 0; j < 8; j++) { g.beginFill(sc[j%sc.length]); g.drawRoundedRect(_rngRange(-20,20), _rngRange(-4,4), 8, 3, 1); g.endFill(); } break;
    case 'space': g.lineStyle(2, 0x4488ff, 0.6); g.moveTo(-15, 4); g.lineTo(0, -4); g.lineTo(18, 6); g.beginFill(0x4488ff, 0.2); g.drawCircle(0, 0, 16); g.endFill(); break;
    case 'dark': g.beginFill(0x6633aa, 0.15); g.drawEllipse(0, -5, 40, 14); g.endFill(); break;
    case 'ocean': g.beginFill(0x66aadd, 0.35); g.drawCircle(-6, -8, 6); g.drawCircle(8, -14, 4.5); g.drawCircle(0, -22, 3); g.endFill(); break;
    default: g.beginFill(0x55aa33, 0.6); g.moveTo(-10, 0); g.lineTo(-6, -16); g.lineTo(-2, 0); g.moveTo(4, 0); g.lineTo(8, -12); g.lineTo(12, 0); g.endFill(); break;
  }
  return g;
}

${featureFactories}

// ======================== GAME SCENE ========================
export class GameScene2D implements GameScene {
  name = 'game';
  container: any;
  private physics!: PhysicsWorld;
  private playerGfx: any;
  private playerBody: any;
  private playerCtrl!: CharacterController;
  private score = 0;
  private lives = CONFIG.lives;
  private coins: { gfx: any; body: any; baseY: number }[] = [];
  private enemies: { gfx: any; body: any; startX: number; range: number; dir: number }[] = [];
  private clouds: { gfx: any; speed: number }[] = [];
  private bgLayers: { gfx: any; factor: number }[] = [];
  private stars: any;
  private decorTrees: any[] = [];
  private fogLayers: any[] = [];
  private treeSway: any[] = [];
  private waterSurface: any = null;
  private lavaSurface: any = null;
  private invincibleTimer = 0;
  private lastPlayerFacing = 1;
  private _lastAnim = '';

  constructor() { this.container = new PIXI.Container(); }

  async enter(engine: Engine2D): Promise<void> {
    this.physics = new PhysicsWorld(CONFIG.gravity);
    this.score = 0; this.lives = CONFIG.lives;
    this.coins = []; this.enemies = []; this.clouds = [];
    this.bgLayers = []; this.decorTrees = []; this.fogLayers = []; this.treeSway = [];
    this.invincibleTimer = 0;

    await _loadSpriteLib(THEME);
    setNoiseSeed(_seed);

    var W = engine.config.width;
    var H = engine.config.height;
    var WW = CONFIG.worldWidth;
    var WH = CONFIG.worldHeight;

    // ---- 1. GRADIENT SKY ----
    var sky = drawSkyGradient(WW, WH, PAL.skyTop, PAL.skyBottom);
    this.container.addChild(sky);

    // ---- 2. STARS ----
    this.stars = drawStars(WW, WH * 0.5, 80);
    this.container.addChild(this.stars);

    // ---- 3. PARALLAX MOUNTAINS (3 layers) ----
    for (var mi = 0; mi < 3; mi++) {
      var mColor = PAL.mountains[mi] || PAL.mountains[0];
      var mBaseY = CONFIG.groundY - 30 - mi * 60;
      var mGfx = drawMountainRange(WW, mBaseY, mColor, 0.4 + mi * 0.2, 60 + mi * 30, 120 + mi * 50, 250 - mi * 30, THEME, mi);
      this.container.addChild(mGfx);
      this.bgLayers.push({ gfx: mGfx, factor: 0.1 + mi * 0.15 });
    }

    // ---- 3b. ATMOSPHERIC FOG ----
    try {
      this.fogLayers = drawAtmosphericFog(WW, CONFIG.groundY, THEME);
      for (var fi2 = 0; fi2 < this.fogLayers.length; fi2++) {
        this.container.addChild(this.fogLayers[fi2]);
        this.bgLayers.push({ gfx: this.fogLayers[fi2], factor: 0.05 + fi2 * 0.08 });
      }
    } catch(e) {}

    // ---- 4. CLOUDS ----
    if (THEME !== 'space' && THEME !== 'dark') {
      var cloudCount = _rngInt(5, 10);
      for (var ci = 0; ci < cloudCount; ci++) {
        var cw = _rngRange(80, 200);
        var ch = _rngRange(25, 45);
        var cloud = drawCloud(cw, ch);
        cloud.x = _rngRange(0, WW);
        cloud.y = _rngRange(50, CONFIG.groundY * 0.4);
        if (THEME === 'volcanic') { cloud.tint = 0x997766; cloud.alpha = 0.5; }
        this.container.addChild(cloud);
        this.clouds.push({ gfx: cloud, speed: _rngRange(5, 15) });
      }
    }

    // ---- 5. THEME DECORATIONS (PRNG) ----
    var decData = _generateDecorations();
    for (var di = 0; di < decData.length; di++) {
      var dd = decData[di];
      var dec = _drawDecoration(dd.type, dd.size);
      dec.x = dd.x; dec.y = CONFIG.groundY;
      if (dd.flip) dec.scale.x = -1;
      this.container.addChild(dec);
      this.decorTrees.push(dec);
    }

    // ---- 6. GROUND ----
    var floorH = WH - CONFIG.groundY;
    var ground = drawGroundStrip(WW, CONFIG.groundY, floorH, PAL.ground, PAL.groundTop, THEME);
    this.container.addChild(ground);
    var groundBody = createStaticBody(WW / 2, CONFIG.groundY + 4, WW, 8);
    this.physics.addBody(groundBody);

    // ---- 6b. L-SYSTEM TREES ----
    var treePresetList = TREE_PRESETS[THEME] || [];
    if (treePresetList.length > 0) {
      var treeCount = _rngInt(4, 8);
      var treeSpacing = CONFIG.worldWidth / treeCount;
      for (var ti = 0; ti < treeCount; ti++) {
        var treePreset = treePresetList[_rngInt(0, treePresetList.length - 1)];
        var treeX = ti * treeSpacing + _rngRange(50, treeSpacing - 50);
        var treeSeed = _seed + ti * 137;
        var tree = drawLSystemTree(treeX, CONFIG.groundY, treePreset, THEME, treeSeed);
        this.container.addChild(tree);
        this.treeSway.push(tree);
      }
    }

    // ---- 6c. GROUND DETAILS ----
    var groundDetailCount = _rngInt(12, 24);
    var gdSpacing = CONFIG.worldWidth / groundDetailCount;
    for (var gdi = 0; gdi < groundDetailCount; gdi++) {
      var gdx = gdi * gdSpacing + _rngRange(10, gdSpacing - 10);
      var gd = _drawGroundDetail(gdx, CONFIG.groundY);
      this.container.addChild(gd);
    }

    // ---- 7. PLATFORMS (level-shape aware) ----
    var platforms = _generatePlatforms();
    for (var pi = 0; pi < platforms.length; pi++) {
      var p = platforms[pi];
      var platGfx = drawPlatformBlock(p.w, 24, PAL.platform, PAL.platformTop, THEME);
      platGfx.x = p.x; platGfx.y = p.y;
      this.container.addChild(platGfx);
      var platBody = createOneWayPlatform(p.x, p.y, p.w, 24);
      this.physics.addBody(platBody);
    }

    // ---- 8. PLAYER ----
    this.playerGfx = drawPlayerCharacter(CONFIG.playerSize, PAL.player, PAL.playerLight);
    this.playerGfx.x = CONFIG.playerStartX;
    this.playerGfx.y = CONFIG.groundY - 30;
    this.container.addChild(this.playerGfx);

    this.playerBody = createBody(CONFIG.playerStartX, CONFIG.groundY - 30, 28, 44);
    this.playerBody.sprite = this.playerGfx;
    this.playerBody.tag = 'player';
    this.physics.addBody(this.playerBody);
    this.playerCtrl = new CharacterController(this.playerBody, {
      moveSpeed: CONFIG.moveSpeed,
      jumpForce: CONFIG.jumpForce,
      doubleJump: CONFIG.doubleJump,
      wallSlide: CONFIG.wallSlide,
    });

    // ---- 9. COINS (60% platform, 40% ground) ----
    var coinData = _generateCoins(platforms);
    for (var coi = 0; coi < coinData.length; coi++) {
      var cp = coinData[coi];
      var coinGfx = drawCoinToken(CONFIG.coinRadius, PAL.coin, PAL.coinGlow);
      coinGfx.x = cp.x; coinGfx.y = cp.y;
      this.container.addChild(coinGfx);
      var coinBody = createBody(cp.x, cp.y, 18, 18, { isStatic: true, isSensor: true, tag: 'coin' });
      coinBody.sprite = coinGfx;
      this.physics.addBody(coinBody);
      this.coins.push({ gfx: coinGfx, body: coinBody, baseY: cp.y });
    }

    // ---- 10. ENEMIES (patrol ranges) ----
    var enemyData = _generateEnemies();
    for (var ei = 0; ei < enemyData.length; ei++) {
      var ed = enemyData[ei];
      var enemyGfx = drawEnemySlime(CONFIG.enemySize, PAL.enemy, PAL.enemyLight);
      enemyGfx.x = ed.x; enemyGfx.y = CONFIG.groundY - 18;
      this.container.addChild(enemyGfx);
      var enemyBody = createBody(ed.x, CONFIG.groundY - 18, 32, 28, { isStatic: true, isSensor: true, tag: 'enemy' });
      enemyBody.sprite = enemyGfx;
      this.physics.addBody(enemyBody);
      this.enemies.push({ gfx: enemyGfx, body: enemyBody, startX: ed.x, range: ed.range, dir: 1 });
    }

    // ---- 11. COLLISION HANDLER ----
    var self = this;
    this.physics.onSensorOverlap(function(a: any, b: any) {
      var coin = a.tag === 'coin' ? a : b.tag === 'coin' ? b : null;
      var enemy = a.tag === 'enemy' ? a : b.tag === 'enemy' ? b : null;
      var player = a.tag === 'player' ? a : b.tag === 'player' ? b : null;
      if (coin && player && coin.enabled !== false) {
        onCollectSparkle(engine.proton, coin.x, coin.y);
        if (coin.sprite) coin.sprite.visible = false;
        coin.enabled = false;
        self.score += 10;
        engine.features.emit('coin-collect', { score: self.score, x: coin.x, y: coin.y });
      }
      if (enemy && player && enemy.enabled !== false && self.invincibleTimer <= 0) {
        self.lives--;
        self.invincibleTimer = 1.5;
        engine.juice.shake(engine.world, 10, 0.3);
        engine.juice.hitPause(engine.app, 80);
        engine.juice.flash(self.playerGfx, 0xff0000, 0.15);
        onDeathExplosion(engine.proton, enemy.x, enemy.y, '#ff4444');
        self.playerBody.vy = -350;
        engine.features.emit('player-hit', { lives: self.lives });
        if (self.lives <= 0) {
          engine.scene.switch('gameover', { score: self.score });
        }
      }
    });

    // ---- 12. AMBIENT PARTICLES + WEATHER ----
    try {
      if (PAL.weather === 'snow') {
        var snowFx = createSnowEffect(W, H, 0.5);
        if (snowFx && snowFx.emitter) engine.addEmitter(snowFx.emitter);
        for (var spi = 0; spi < platforms.length; spi++) {
          var sp2 = platforms[spi];
          for (var sd = 0; sd < sp2.w / 8; sd++) {
            var snowDot = new PIXI.Graphics();
            snowDot.circle(0, 0, 1 + Math.random() * 1.5);
            snowDot.fill({ color: 0xeef4ff, alpha: 0.6 + Math.random() * 0.3 });
            snowDot.x = sp2.x - sp2.w / 2 + sd * 8 + Math.random() * 6;
            snowDot.y = sp2.y - 2 - Math.random() * 3;
            this.container.addChild(snowDot);
          }
        }
      } else if (PAL.weather === 'rain') {
        var rainFx = createRainEffect(W, H, 0.5);
        if (rainFx && rainFx.emitter) engine.addEmitter(rainFx.emitter);
      }
      if (PAL.ambient) {
        var ambientFx = createAmbientEffect(PAL.ambient as any, W, H);
        if (ambientFx && ambientFx.emitter) engine.addEmitter(ambientFx.emitter);
      }
      if (THEME === 'forest' || THEME === 'dark') {
        var fireflyCount = _rngInt(6, 14);
        for (var ffi = 0; ffi < fireflyCount; ffi++) {
          var ffGlow = new PIXI.Graphics();
          var ffColor = THEME === 'forest' ? 0xddff44 : 0xaa55ff;
          ffGlow.circle(0, 0, 3); ffGlow.fill({ color: ffColor, alpha: 0.6 });
          ffGlow.circle(0, 0, 8); ffGlow.fill({ color: ffColor, alpha: 0.15 });
          ffGlow.x = _rngRange(100, WW - 100);
          ffGlow.y = _rngRange(CONFIG.groundY * 0.3, CONFIG.groundY - 50);
          ffGlow.blendMode = 'add';
          this.container.addChild(ffGlow);
          this.decorTrees.push(ffGlow);
        }
      }
    } catch(e) {}

    // ---- 13. UI LAYER (handled by Feature Bank: score-counter, lives-system) ----
    var hint = engine.createText('WASD / Arrows + Space', { fontSize: 11, fill: 0x666666 });
    hint.anchor.set(0.5, 1); hint.x = W / 2; hint.y = H - 8;
    engine.ui.addChild(hint);

    // ---- 14. CAMERA ----
    engine.camera.follow(this.playerBody);
    engine.camera.worldWidth = CONFIG.worldWidth;
    engine.camera.worldHeight = CONFIG.worldHeight;
    engine.camera.smoothing = 0.08;

    // ---- 15. JUICE EFFECTS ----
    for (var ji = 0; ji < this.coins.length; ji++) {
      engine.juice.float(this.coins[ji].gfx, 5, 2 + _rng() * 0.5);
    }
    engine.juice.breathe(this.playerGfx, 1.03, 1.2);

    var _PIXI = (window as any).PIXI;
    if (_PIXI.filters && _PIXI.filters.DropShadowFilter && !this.playerGfx.filters) {
      this.playerGfx.filters = [new _PIXI.filters.DropShadowFilter({
        offset: { x: 3, y: 5 }, blur: 5, alpha: 0.5, color: 0x000000,
      })];
    }

    // ---- 15b. WATER/LAVA SURFACES ----
    try {
      if (THEME === 'ocean') {
        var waterY2 = CONFIG.groundY - 15;
        var waterH2 = CONFIG.worldHeight - waterY2;
        this.waterSurface = createWaterSurface(WW, waterY2, waterH2, 0x1a5276);
        this.container.addChild(this.waterSurface.container);
      } else if (THEME === 'forest') {
        var pondX = _rngRange(WW * 0.3, WW * 0.6);
        var pondW = _rngRange(300, 600);
        var pondY = CONFIG.groundY - 5;
        var pondH = CONFIG.worldHeight - pondY;
        this.waterSurface = createWaterSurface(pondW, pondY, pondH, 0x2d6a4f);
        this.waterSurface.container.x = pondX;
        this.container.addChild(this.waterSurface.container);
      } else if (THEME === 'volcanic') {
        var lavaY2 = CONFIG.groundY - 10;
        var lavaH2 = CONFIG.worldHeight - lavaY2;
        this.lavaSurface = createLavaSurface(WW, lavaY2, lavaH2);
        this.container.addChild(this.lavaSurface.container);
      }
    } catch(e) {}

    // ---- 16. LIGHTING LAYER ----
    try {
      var decorPositions = decData.map(function(d: any) { return { x: d.x, y: CONFIG.groundY }; });
      var lightLayer = createLightingLayer(THEME, WW, CONFIG.groundY, decorPositions);
      this.container.addChild(lightLayer);
    } catch(e) {}

    // ---- 17. POST-PROCESSING (disabled — ColorMatrixFilter causes half-screen tint with camera scroll) ----
    // applyBiomePostProcessing(THEME, this.container);

    // ---- 18. VIGNETTE ----
    try { var vig = drawVignette(W, H); engine.ui.addChild(vig); } catch(e) {}

    // ---- FEATURE BANK ----
${featureRegistrations}
    engine.features.initAll();

    // === AI ENHANCEMENT ZONE ===
${customCode ? "    " + customCode.split("\\n").join("\\n    ") : "    // Custom code goes here"}
  }

  update(engine: Engine2D, dt: number): void {
    this.physics.update(dt);

    // ---- Player movement ----
    if (this.playerCtrl) {
      var wasOnGround = this.playerCtrl.body.onGround;
      this.playerCtrl.update({
        left: engine.input.left,
        right: engine.input.right,
        jump: engine.input.jump,
      }, dt);

      if (engine.input.left) this.lastPlayerFacing = -1;
      if (engine.input.right) this.lastPlayerFacing = 1;
      this.playerGfx.scale.x = this.lastPlayerFacing;

      // AnimatedSprite animation switching
      if (this.playerGfx.textures && this.playerGfx.play) {
        var _sheet = _sheetCache && _sheetCache['hero'];
        if (_sheet && _sheet.animations) {
          var _anim = 'idle';
          if (!this.playerCtrl.body.onGround) _anim = 'jump';
          else if (engine.input.left || engine.input.right) _anim = 'walk';
          if (this._lastAnim !== _anim && _sheet.animations[_anim]) {
            this.playerGfx.textures = _sheet.animations[_anim];
            this.playerGfx.animationSpeed = _anim === 'walk' ? 0.12 : 0.08;
            this.playerGfx.play();
            this._lastAnim = _anim;
          }
        }
      }

      // Squash & stretch
      if (!this.playerCtrl.body.onGround) {
        var vy = this.playerCtrl.body.vy;
        if (vy < -100) this.playerGfx.scale.y = 1.15;
        else if (vy > 100) this.playerGfx.scale.y = 0.9;
      } else {
        this.playerGfx.scale.y += (1 - this.playerGfx.scale.y) * 0.2;
      }

      // Jump dust + land impact
      if (!this.playerCtrl.body.onGround && wasOnGround && this.playerCtrl.body.vy < 0) {
        onJumpDust(engine.proton, this.playerCtrl.body.x, this.playerCtrl.body.y + 22);
      }
      if (this.playerCtrl.body.onGround && !wasOnGround) {
        onLandImpact(engine.proton, this.playerCtrl.body.x, this.playerCtrl.body.y + 22);
        engine.juice.squash(this.playerGfx, 0.7, 1.15);
      }
    }

    // ---- Invincibility blink ----
    if (this.playerGfx) {
      if (this.invincibleTimer > 0) {
        this.invincibleTimer -= dt;
        this.playerGfx.alpha = Math.sin(this.invincibleTimer * 20) > 0 ? 1 : 0.3;
      } else {
        this.playerGfx.alpha = 1;
      }
    }

    // ---- Animate coins ----
    for (var c = 0; c < this.coins.length; c++) {
      var coin = this.coins[c];
      if (coin.gfx.visible) {
        coin.gfx.y = coin.baseY + Math.sin(engine.elapsed * 3 + coin.body.x * 0.01) * 5;
        coin.gfx.rotation = Math.sin(engine.elapsed * 2 + coin.body.x * 0.02) * 0.15;
        if (coin.gfx.children && coin.gfx.children[0]) {
          coin.gfx.children[0].alpha = 0.5 + 0.5 * Math.sin(engine.elapsed * 4 + coin.body.x * 0.03);
        }
        coin.body.y = coin.gfx.y;
      }
    }

    // ---- Animate enemies (patrol) ----
    for (var e = 0; e < this.enemies.length; e++) {
      var en = this.enemies[e];
      if (en.body.enabled === false) continue;
      en.gfx.x += en.dir * CONFIG.enemySpeed * dt;
      en.body.x = en.gfx.x;
      if (en.gfx.x > en.startX + en.range) en.dir = -1;
      if (en.gfx.x < en.startX - en.range) en.dir = 1;
      en.gfx.scale.x = en.dir;
      en.gfx.scale.y = 1 + Math.sin(engine.elapsed * 5 + e) * 0.08;
    }

    // ---- Star twinkle ----
    if (this.stars) this.stars.alpha = 0.6 + 0.4 * Math.sin(engine.elapsed * 0.5);

    // ---- Fall death ----
    if (this.playerCtrl && this.playerCtrl.body.y > CONFIG.worldHeight + 100) {
      engine.scene.switch('gameover', { score: this.score });
    }

    // ---- Fog drift ----
    for (var fg = 0; fg < this.fogLayers.length; fg++) {
      this.fogLayers[fg].x += (0.3 + fg * 0.2) * dt;
      if (this.fogLayers[fg].x > CONFIG.worldWidth * 0.1) this.fogLayers[fg].x = 0;
    }

    // ---- Wind system ----
    var _windStr = 0.5 + 0.5 * Math.sin(engine.elapsed * 0.15);
    var _windDir = Math.sin(engine.elapsed * 0.07) > 0 ? 1 : -1;

    // ---- Vegetation sway ----
    for (var sw = 0; sw < this.treeSway.length; sw++) {
      var treeObj = this.treeSway[sw];
      var swayA = Math.sin(engine.elapsed * 1.2 + treeObj.x * 0.008) * 0.018 * (0.5 + _windStr);
      var swayB = Math.sin(engine.elapsed * 2.1 + treeObj.x * 0.015) * 0.008;
      treeObj.skew.x = (swayA + swayB) * _windDir;
    }
    for (var dw = 0; dw < this.decorTrees.length; dw++) {
      var decObj = this.decorTrees[dw];
      decObj.skew.x = Math.sin(engine.elapsed * 1.5 + decObj.x * 0.01) * 0.012 * (0.5 + _windStr) * _windDir;
    }

    // ---- Cloud drift ----
    for (var cl = 0; cl < this.clouds.length; cl++) {
      var cloud2 = this.clouds[cl];
      cloud2.gfx.x += (cloud2.speed * (0.6 + _windStr * 0.8)) * dt;
      if (cloud2.gfx.x > CONFIG.worldWidth + 150) cloud2.gfx.x = -150;
    }

    // ---- Water/Lava animation ----
    if (this.waterSurface) { try { this.waterSurface.update(engine.elapsed); } catch(e) {} }
    if (this.lavaSurface) { try { this.lavaSurface.update(engine.elapsed); } catch(e) {} }

    engine.input.endFrame();
  }

  exit(engine: Engine2D): void {
    engine.features.destroy();
    engine.juice.killAll();
    this.container.removeChildren();
    engine.ui.removeChildren();
  }
}
`;
					// Save the composed scene file
					const file = await saveFile(appId, "src/scenes/GameScene2D.ts", sceneCode, "typescript");
					console.log(`[compose_game] Generated GameScene2D.ts with ${bankFeatures.length} bank features + ${missingIds.length} missing (seed: ${cfg.seed})`);

					return {
						success: true,
						action: "composed",
						path: "src/scenes/GameScene2D.ts",
						fileId: file.id,
						featuresLoaded: bankFeatures.map(f => f.id),
						featuresMissing: missingIds,
						totalFeatures: features.length,
						seed: cfg.seed,
						message: missingIds.length > 0
							? `Game composed with ${bankFeatures.length}/${features.length} features. Missing: ${missingIds.join(", ")}. Use patch_file to add custom implementations for missing features.`
							: `Game composed with all ${features.length} features from the Feature Bank.`,
					};
				} catch (error) {
					console.error("compose_game error:", error);
					return {
						success: false,
						action: "composed",
						error: `Failed to compose game: ${String(error)}`,
					};
				}
			},
		}),

		define_entities: tool({
			description:
				"Define the data entities (database tables) for the app's backend. Call this ONCE with all entities when the user describes data models, a backend, or needs to persist data. Each entity becomes a real PostgreSQL table with auto-generated CRUD API.",
			inputSchema: z.object({
				entities: z
					.array(
						z.object({
							name: z
								.string()
								.describe(
									'Entity name in PascalCase (e.g., "Course", "UserProgress", "BlogPost")',
								),
							fields: z.array(
								z.object({
									name: z
										.string()
										.describe(
											'Field name in snake_case (e.g., "title", "price", "is_published")',
										),
									type: z
										.enum([
											"text",
											"number",
											"boolean",
											"date",
											"json",
											"relation",
										])
										.describe(
											"Field data type. Use 'relation' for foreign key references to other entities.",
										),
									required: z
										.boolean()
										.optional()
										.describe("Whether this field is required (NOT NULL)"),
									unique: z
										.boolean()
										.optional()
										.describe("Whether this field must be unique"),
									relationTo: z
										.string()
										.optional()
										.describe(
											'For relation fields: the entity name this references (e.g., "Course")',
										),
								}),
							),
						}),
					)
					.describe("All entities to create. Each gets id, created_at, updated_at automatically."),
			}),
			execute: async ({ entities }) => {
				try {
					// Look up the app's dbId from the string appId
					const app = await db.query.builderApps.findFirst({
						where: eq(builderApps.id, appId as BuilderAppId),
						columns: { dbId: true },
					});

					if (!app) {
						return {
							success: false,
							error: `App not found: ${appId}`,
						};
					}

					// Ensure the app has a database
					const appDb = await ensureAppDatabase(app.dbId);
					if (appDb.status !== "active") {
						return {
							success: false,
							error: `Database is in '${appDb.status}' state. Please try again.`,
						};
					}

					// Build the schema
					const schema: AppSchema = {
						version: 1,
						entities: entities.map((e) => ({
							name: e.name,
							tableName: entityToTableName(e.name),
							fields: e.fields,
						})),
					};

					// Check if there's an existing schema to diff against
					const existingSchema = appDb.schemaJson as AppSchema | null;
					if (
						existingSchema &&
						existingSchema.entities &&
						existingSchema.entities.length > 0
					) {
						const diff = await diffAndApplySchema(
							appDb.databaseName,
							existingSchema,
							{ ...schema, version: existingSchema.version + 1 },
							appDb.dbId,
						);
						return {
							success: true,
							action: "updated_schema",
							database: appDb.databaseName,
							entities: schema.entities.map((e) => ({
								name: e.name,
								tableName: e.tableName,
								fields: e.fields.map((f) => f.name),
								apiEndpoint: `/api/apps/${appId}/data/${e.tableName}`,
							})),
							newTables: diff.newTables,
							newColumns: diff.newColumns,
							sdkImport: '@vibexe/sdk',
							sdkUsage: `import { VibexeApp } from "@vibexe/sdk";\nconst app = new VibexeApp({ appId: "${appId}" });`,
						};
					}

					// Fresh schema — apply from scratch
					await applySchema(appDb.databaseName, schema, appDb.dbId);

					return {
						success: true,
						action: "created_schema",
						database: appDb.databaseName,
						entities: schema.entities.map((e) => ({
							name: e.name,
							tableName: e.tableName,
							fields: e.fields.map((f) => f.name),
							apiEndpoint: `/api/apps/${appId}/data/${e.tableName}`,
						})),
						sdkImport: '@vibexe/sdk',
						sdkUsage: `import { VibexeApp } from "@vibexe/sdk";\nconst app = new VibexeApp({ appId: "${appId}" });`,
					};
				} catch (error) {
					console.error("define_entities error:", error);
					return {
						success: false,
						error: `Backend unavailable: ${error instanceof Error ? error.message : String(error)}. IMPORTANT: Continue building the app using create_file with localStorage for data persistence instead. Do NOT retry define_entities.`,
					};
				}
			},
		}),

		manage_environments: tool({
			description:
				"Manage multi-environment databases (development/staging/production) for the app. Use this to create environments, promote schemas between environments, preview schema diffs, or list existing environments.",
			inputSchema: z.object({
				action: z
					.enum(["list", "create", "promote", "diff", "delete"])
					.describe(
						'Action to perform: "list" shows all environments, "create" provisions a new staging/production database, "promote" copies schema from one env to another, "diff" previews schema differences, "delete" removes an environment',
					),
				environment: z
					.enum(["staging", "production"])
					.optional()
					.describe('Target environment for create/delete actions'),
				fromEnvironment: z
					.string()
					.optional()
					.describe('Source environment for promote/diff (e.g., "development")'),
				toEnvironment: z
					.string()
					.optional()
					.describe('Target environment for promote/diff (e.g., "staging")'),
			}),
			execute: async ({ action, environment, fromEnvironment, toEnvironment }) => {
				try {
					const app = await db.query.builderApps.findFirst({
						where: eq(builderApps.id, appId as BuilderAppId),
						columns: { dbId: true },
					});
					if (!app) return { success: false, error: `App not found: ${appId}` };

					const appDb = await db.query.builderAppDatabases.findFirst({
						where: eq(builderAppDatabases.appDbId, app.dbId),
					});
					if (!appDb) return { success: false, error: "No database found for this app" };

					switch (action) {
						case "list": {
							const { listEnvironments } = await import("@/lib/app-database/environment-manager");
							const environments = await listEnvironments(appDb.appDbId);
							return {
								success: true,
								action: "listed",
								environments: environments.map((e) => ({
									environment: e.environment,
									databaseName: e.databaseName,
									status: e.status,
									schemaVersion: e.schemaVersion,
									promotedAt: e.promotedAt,
									promotedFrom: e.promotedFrom,
								})),
							};
						}
						case "create": {
							if (!environment) return { success: false, error: 'Must specify "environment" (staging or production)' };
							const { createEnvironmentDatabase } = await import("@/lib/app-database/environment-manager");
							const result = await createEnvironmentDatabase(appDb.appDbId, environment);
							return {
								success: true,
								action: "created",
								environment,
								databaseName: result.databaseName,
								message: `${environment} environment created successfully. Use promote to copy your schema.`,
							};
						}
						case "promote": {
							if (!fromEnvironment || !toEnvironment) {
								return { success: false, error: 'Must specify "fromEnvironment" and "toEnvironment"' };
							}
							const { promoteEnvironment } = await import("@/lib/app-database/environment-manager");
							const result = await promoteEnvironment(appDb.appDbId, fromEnvironment, toEnvironment);
							return {
								success: true,
								action: "promoted",
								from: fromEnvironment,
								to: toEnvironment,
								newTables: result.newTables,
								newColumns: result.newColumns,
								message: `Schema promoted from ${fromEnvironment} to ${toEnvironment}. A pre-promote backup was created automatically.`,
							};
						}
						case "diff": {
							if (!fromEnvironment || !toEnvironment) {
								return { success: false, error: 'Must specify "fromEnvironment" and "toEnvironment"' };
							}
							const { listEnvironments, diffSchemas } = await import("@/lib/app-database/environment-manager");
							const envs = await listEnvironments(appDb.appDbId);
							const fromEnv = envs.find((e) => e.environment === fromEnvironment);
							const toEnv = envs.find((e) => e.environment === toEnvironment);
							if (!fromEnv) return { success: false, error: `Environment "${fromEnvironment}" not found` };
							if (!toEnv) return { success: false, error: `Environment "${toEnvironment}" not found` };
							const diff = diffSchemas(fromEnv.schemaJson, toEnv.schemaJson);
							const hasChanges = diff.newTables.length > 0 || diff.newColumns.length > 0 || diff.removedTables.length > 0 || diff.removedColumns.length > 0;
							return {
								success: true,
								action: "diff",
								from: fromEnvironment,
								to: toEnvironment,
								hasChanges,
								newTables: diff.newTables.map((t) => t.name),
								newColumns: diff.newColumns.map((c) => `${c.table}.${c.field.name}`),
								removedTables: diff.removedTables,
								removedColumns: diff.removedColumns.map((c) => `${c.table}.${c.field}`),
							};
						}
						case "delete": {
							if (!environment) return { success: false, error: 'Must specify "environment" to delete' };
							const { deleteEnvironmentDatabase } = await import("@/lib/app-database/environment-manager");
							await deleteEnvironmentDatabase(appDb.appDbId, environment);
							return {
								success: true,
								action: "deleted",
								environment,
								message: `${environment} environment deleted successfully.`,
							};
						}
						default:
							return { success: false, error: `Unknown action: ${action}` };
					}
				} catch (error) {
					console.error("manage_environments error:", error);
					return {
						success: false,
						error: `Environment operation failed: ${error instanceof Error ? error.message : String(error)}`,
					};
				}
			},
		}),

		lookup_integration_props: tool({
			description:
				"Look up available actions and their property schemas for an Activepieces integration piece. Call this BEFORE writing code that uses app.integrations.execute() to discover the exact property names an action expects. Without this, you will guess wrong property names and the integration will fail at runtime.",
			inputSchema: z.object({
				pieceName: z
					.string()
					.describe(
						'The piece name to look up (e.g. "slack", "sendgrid", "gmail", "hubspot")',
					),
				actionName: z
					.string()
					.optional()
					.describe(
						'Optional: specific action to get detailed properties for (e.g. "send_message", "send_email"). If omitted, returns all actions with their properties.',
					),
			}),
			execute: async ({ pieceName, actionName }) => {
				try {
					const { inspectPiece } = await import(
						"@vibexe-ai/activepieces-adapter/server"
					);
					const info = await inspectPiece(pieceName);

					if (actionName) {
						// Return detailed props for a specific action
						const action = info.actions.find((a) => a.name === actionName);
						if (!action) {
							return {
								success: false,
								pieceName,
								error: `Action "${actionName}" not found. Available actions: ${info.actions.map((a) => a.name).join(", ")}`,
							};
						}
						return {
							success: true,
							pieceName: info.name,
							displayName: info.displayName,
							action: action.name,
							actionDisplayName: action.displayName,
							description: action.description,
							requireAuth: action.requireAuth,
							properties: Object.values(action.props).map((p) => ({
								name: p.name,
								displayName: p.displayName,
								description: p.description,
								type: p.type,
								required: p.required,
								defaultValue: p.defaultValue,
								options: p.options,
							})),
						};
					}

					// Return all actions with their properties
					return {
						success: true,
						pieceName: info.name,
						displayName: info.displayName,
						authType: info.auth?.type ?? "none",
						actions: info.actions.map((a) => ({
							name: a.name,
							displayName: a.displayName,
							description: a.description,
							properties: Object.values(a.props).map((p) => ({
								name: p.name,
								type: p.type,
								required: p.required,
								description: p.description,
							})),
						})),
					};
				} catch (error) {
					return {
						success: false,
						pieceName,
						error: `Failed to look up piece "${pieceName}": ${String(error)}`,
					};
				}
			},
		}),

		manage_backups: tool({
			description:
				"Manage database backups for the app. Use this to create manual backups, list existing backups, restore from a backup, or delete old backups. Backups use pg_dump and are stored in S3.",
			inputSchema: z.object({
				action: z
					.enum(["list", "create", "restore", "delete"])
					.describe(
						'Action to perform: "list" shows all backups, "create" triggers a manual backup, "restore" restores from a backup, "delete" removes a backup',
					),
				environment: z
					.string()
					.optional()
					.describe('Environment to filter/create backups for (default: "development")'),
				backupId: z
					.number()
					.optional()
					.describe("Backup ID for restore/delete actions"),
			}),
			execute: async ({ action, environment, backupId }) => {
				try {
					const app = await db.query.builderApps.findFirst({
						where: eq(builderApps.id, appId as BuilderAppId),
						columns: { dbId: true },
					});
					if (!app) return { success: false, error: `App not found: ${appId}` };

					const appDb = await db.query.builderAppDatabases.findFirst({
						where: eq(builderAppDatabases.appDbId, app.dbId),
					});
					if (!appDb) return { success: false, error: "No database found for this app" };

					switch (action) {
						case "list": {
							const { builderAppBackups } = await import("@/db/schema");
							const { eq: eqOp, and, desc } = await import("drizzle-orm");
							let query = db
								.select()
								.from(builderAppBackups)
								.where(eqOp(builderAppBackups.appDbId, appDb.appDbId))
								.orderBy(desc(builderAppBackups.createdAt))
								.limit(20);
							const backups = await query;
							return {
								success: true,
								action: "listed",
								backups: backups.map((b) => ({
									id: b.dbId,
									environment: b.environment,
									backupType: b.backupType,
									sizeBytes: b.sizeBytes,
									status: b.status,
									createdAt: b.createdAt,
									expiresAt: b.expiresAt,
								})),
							};
						}
						case "create": {
							const env = environment || "development";
							const { resolveDatabase } = await import("@/lib/app-database/environment-manager");
							let dbName: string;
							try {
								dbName = await resolveDatabase(appDb.appDbId, env);
							} catch {
								dbName = appDb.databaseName;
							}
							const { createBackup } = await import("@/lib/app-backups/backup-manager");
							const result = await createBackup({
								appDbId: appDb.appDbId,
								databaseName: dbName,
								environment: env,
								backupType: "manual",
							});
							return {
								success: true,
								action: "created",
								environment: env,
								backupId: result.backupDbId,
								sizeBytes: result.sizeBytes,
								message: `Manual backup created for ${env} environment (${(result.sizeBytes / 1024).toFixed(1)} KB). Retained for 30 days.`,
							};
						}
						case "restore": {
							if (!backupId) return { success: false, error: 'Must specify "backupId" to restore' };
							const env = environment || "development";
							const { resolveDatabase } = await import("@/lib/app-database/environment-manager");
							let dbName: string;
							try {
								dbName = await resolveDatabase(appDb.appDbId, env);
							} catch {
								dbName = appDb.databaseName;
							}
							// Create a safety backup before restoring
							const { createBackup, restoreBackup } = await import("@/lib/app-backups/backup-manager");
							try {
								await createBackup({
									appDbId: appDb.appDbId,
									databaseName: dbName,
									environment: env,
									backupType: "pre-deploy",
								});
							} catch (e) {
								console.error("[Restore] Pre-restore backup failed:", e);
							}
							await restoreBackup({ backupDbId: backupId, targetDatabaseName: dbName });
							return {
								success: true,
								action: "restored",
								backupId,
								targetDatabase: dbName,
								message: `Database restored from backup #${backupId}. A safety backup was created before restoring.`,
							};
						}
						case "delete": {
							if (!backupId) return { success: false, error: 'Must specify "backupId" to delete' };
							const { deleteBackup } = await import("@/lib/app-backups/backup-manager");
							await deleteBackup(backupId);
							return {
								success: true,
								action: "deleted",
								backupId,
								message: `Backup #${backupId} deleted from S3 and database.`,
							};
						}
						default:
							return { success: false, error: `Unknown action: ${action}` };
					}
				} catch (error) {
					console.error("manage_backups error:", error);
					return {
						success: false,
						error: `Backup operation failed: ${error instanceof Error ? error.message : String(error)}`,
					};
				}
			},
		}),
	};
}

/**
 * Infer programming language from file extension
 * Used for syntax highlighting in the code editor
 */
function inferLanguage(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase();
	const langMap: Record<string, string> = {
		// JavaScript/TypeScript
		ts: "typescript",
		tsx: "typescript",
		js: "javascript",
		jsx: "javascript",
		mjs: "javascript",
		cjs: "javascript",
		// Styles
		css: "css",
		scss: "scss",
		sass: "sass",
		less: "less",
		// Markup
		html: "html",
		htm: "html",
		xml: "xml",
		svg: "xml",
		// Data
		json: "json",
		yaml: "yaml",
		yml: "yaml",
		toml: "toml",
		// Documentation
		md: "markdown",
		mdx: "markdown",
		// Other languages
		py: "python",
		rb: "ruby",
		go: "go",
		rs: "rust",
		java: "java",
		kt: "kotlin",
		swift: "swift",
		php: "php",
		sql: "sql",
		sh: "shell",
		bash: "shell",
		zsh: "shell",
		// Config
		env: "plaintext",
		gitignore: "plaintext",
		dockerignore: "plaintext",
	};
	return langMap[ext || ""] || "plaintext";
}
