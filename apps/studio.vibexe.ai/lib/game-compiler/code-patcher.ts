/**
 * Game Code Patcher — Inlines settings values directly into source code.
 *
 * Extracted from sandpack-adapter.ts lines 1917-2155.
 * Patches physics constants, spawn positions, camera offsets, character system bridge,
 * and scene editor overrides directly into GameScene3D.ts and assets-3d.ts source code.
 *
 * This is needed because esbuild hoists imports, so window globals set in the entry
 * point may not be available when imported modules evaluate.
 */

interface GameSettings {
	physics?: {
		gravity?: number;
		fallGravity?: number;
		jumpForce?: number;
		moveSpeed?: number;
		runSpeed?: number;
		friction?: number;
		coyoteTime?: number;
	};
	camera?: {
		fov?: number;
		offsetY?: number;
		offsetZ?: number;
		lerp?: number;
		lookAhead?: number;
		lookY?: number;
	};
	player?: {
		spawnX?: number;
		spawnY?: number;
		spawnZ?: number;
		respawnX?: number;
		respawnY?: number;
		respawnZ?: number;
		startingLives?: number;
	};
	terrain?: {
		enabled?: boolean;
	};
	modules?: {
		installed?: Record<string, { enabled?: boolean }> | Array<{ id: string; enabled?: boolean }>;
	};
	animClipOverrides?: Record<string, string>;
}

function clamp(val: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, val));
}

function hasModule(gs: GameSettings, moduleId: string): boolean {
	const inst = gs.modules?.installed;
	if (!inst) return false;
	if (Array.isArray(inst)) {
		return inst.some((m) => m.id === moduleId && m.enabled !== false);
	}
	return !!(inst as Record<string, { enabled?: boolean }>)[moduleId]?.enabled;
}

/**
 * Patch assets-3d.ts — replace hardcoded physics/camera constants with settings values
 */
export function patchAssetsCode(code: string, gs: GameSettings): string {
	const constMap: [string, number | undefined, number, number][] = [
		["GRAVITY_3D", gs.physics?.gravity, -200, 0],
		["FALL_GRAVITY", gs.physics?.fallGravity, -200, 0],
		["JUMP_FORCE", gs.physics?.jumpForce, 0, 100],
		["MOVE_SPEED", gs.physics?.moveSpeed, 0, 50],
		["RUN_SPEED", gs.physics?.runSpeed, 0, 50],
		["FRICTION", gs.physics?.friction, 0, 100],
		["COYOTE_TIME", gs.physics?.coyoteTime, 0, 2],
		["CAMERA_OFFSET_Y", gs.camera?.offsetY, 3, 100],
		["CAMERA_OFFSET_Z", gs.camera?.offsetZ, 3, 100],
		["CAMERA_HEIGHT", gs.camera?.offsetY, 3, 100],
		["CAMERA_DISTANCE", gs.camera?.offsetZ, 3, 100],
		["CAMERA_LERP", gs.camera?.lerp, 0.1, 30],
		["CAMERA_LOOK_AHEAD", gs.camera?.lookAhead, 0, 30],
		["CAMERA_LOOK_Y", gs.camera?.lookY, -20, 20],
	];
	for (const [name, rawValue, min, max] of constMap) {
		if (rawValue == null || Number.isNaN(rawValue)) continue;
		const value = clamp(rawValue, min, max);
		const patterns = [
			new RegExp(`(export\\s+(?:const|let)\\s+${name}\\s*=\\s*)([^;]+)(;)`),
			new RegExp(`((?:var|let|const)\\s+${name}\\s*=\\s*)([^;]+)(;)`),
		];
		for (const re of patterns) {
			const before = code;
			code = code.replace(re, (_m, g1, _g2, g3) => `${g1}${value}${g3}`);
			if (code !== before) break;
		}
	}
	return code;
}

/**
 * Patch GameScene3D.ts — inline spawn positions, respawn, lives, character bridge
 */
export function patchGameSceneCode(code: string, gs: GameSettings): string {
	const sp = gs.player;
	if (!sp) return code;

	// Spawn position — createAnimatedCharacter3D args
	if (sp.spawnX != null || sp.spawnY != null || sp.spawnZ != null) {
		code = code.replace(
			/(createAnimatedCharacter3D\s*\(\s*scene\s*,\s*)([^,]+)(\s*,\s*)([^,]+)(\s*,\s*)([^,]+)(\s*,)/,
			(_, p1, x, p2, y, p3, z, p4) =>
				`${p1}${sp.spawnX ?? x.trim()}${p2}${sp.spawnY ?? y.trim()}${p3}${sp.spawnZ ?? z.trim()}${p4}`,
		);
		// createPlayer3D spawn args
		code = code.replace(
			/(createPlayer3D\s*\(\s*scene\s*,\s*)([^,]+)(\s*,\s*)([^,]+)(\s*,\s*)([^,]+)(\s*[,)])/,
			(_, p1, x, p2, y, p3, z, p4) =>
				`${p1}${sp.spawnX ?? x.trim()}${p2}${sp.spawnY ?? y.trim()}${p3}${sp.spawnZ ?? z.trim()}${p4}`,
		);
		// createPhysicsBody position object
		code = code.replace(
			/(createPhysicsBody\s*\([^,]+,\s*[^,]+,\s*)\{\s*x:\s*([^,]+),\s*y:\s*([^,]+),\s*z:\s*([^}]+)\}/,
			(_, prefix, x, y, z) =>
				`${prefix}{ x: ${sp.spawnX ?? x.trim()}, y: ${sp.spawnY ?? y.trim()}, z: ${sp.spawnZ ?? z.trim()} }`,
		);
	}

	// Respawn position
	if (sp.respawnX != null || sp.respawnY != null || sp.respawnZ != null) {
		let respawnPatched = false;
		if (code.includes("const respawnX")) {
			if (sp.respawnX != null) code = code.replace(/(const respawnX\s*=\s*)([^;]+)(;)/, `$1${sp.respawnX}$3`);
			if (sp.respawnY != null) code = code.replace(/(const respawnY\s*=\s*)([^;]+)(;)/, `$1${sp.respawnY}$3`);
			if (sp.respawnZ != null) code = code.replace(/(const respawnZ\s*=\s*)([^;]+)(;)/, `$1${sp.respawnZ}$3`);
			respawnPatched = true;
		}
		if (!respawnPatched) {
			code = code.replace(
				/(\.position\.set\s*\(\s*)([^,]+)(\s*,\s*)([^,]+)(\s*,\s*)([^)]+)(\s*\)\s*;\s*\n[^;]*\.velocity\.set\s*\(\s*0\s*,\s*0\s*,\s*0\s*\))/,
				(_, pre, x, s1, y, s2, z, post) =>
					`${pre}${sp.respawnX ?? x.trim()}${s1}${sp.respawnY ?? y.trim()}${s2}${sp.respawnZ ?? z.trim()}${post}`,
			);
		}
	}

	// Spawn variable declarations
	if (sp.spawnX != null) code = code.replace(/(const spawnX\s*=\s*)([^;]+)(;)/, `$1${sp.spawnX}$3`);
	if (sp.spawnY != null) code = code.replace(/(const spawnY\s*=\s*)([^;]+)(;)/, `$1${sp.spawnY}$3`);
	if (sp.spawnZ != null) code = code.replace(/(const spawnZ\s*=\s*)([^;]+)(;)/, `$1${sp.spawnZ}$3`);

	// SCENE_EDITOR_OVERRIDES — update Character_/Player_ positions
	if (code.includes("SCENE_EDITOR_OVERRIDES_DATA:")) {
		const dataMatch = code.match(/SCENE_EDITOR_OVERRIDES_DATA:\s*(.+)/);
		if (dataMatch) {
			try {
				const ov = JSON.parse(dataMatch[1]);
				for (const key of Object.keys(ov)) {
					if (key.startsWith("Character_") || key.startsWith("Player_")) {
						if (ov[key].p) {
							if (sp.spawnX !== undefined) ov[key].p[0] = sp.spawnX;
							if (sp.spawnY !== undefined) ov[key].p[1] = sp.spawnY;
							if (sp.spawnZ !== undefined) ov[key].p[2] = sp.spawnZ;
						}
					}
				}
				code = code.split(dataMatch[1].trim()).join(JSON.stringify(ov));
			} catch { /* invalid override JSON */ }
		}
	}

	// Patch MAX_LIVES
	if (sp.startingLives != null && !Number.isNaN(sp.startingLives)) {
		const lives = clamp(Math.round(sp.startingLives), 1, 99);
		const before = code;
		code = code.replace(/((?:const|let)\s+MAX_LIVES\s*=\s*)([^;]+)(;)/, `$1${lives}$3`);
		if (code === before) code = code.replace(/(let\s+lives\s*=\s*)(\d+)(;)/, `$1${lives}$3`);
	}

	// Strip system objects (__ prefixed) from scene override __deleted array
	// Old saved files may have __skyDome__, __weatherParticles__ in __deleted
	code = code.replace(
		/(__deleted\s*:\s*\[)([^\]]*)\]/g,
		(_match, prefix, items) => {
			const filtered = items
				.split(",")
				.map((s: string) => s.trim())
				.filter((s: string) => s && !/"__[^"]*__"/.test(s))
				.join(",");
			return `${prefix}${filtered}]`;
		},
	);

	// Character System bridge — redirect lily.mesh when character module swaps
	if (hasModule(gs, "character-system") && code.includes("lily = lilyResult") && code.includes("lily.mesh")) {
		code = code.replace(
			/(lily\s*=\s*lilyResult\s*;)/,
			`$1\n` +
			`    // [CharSystem Bridge] Redirect lily.mesh/size when character module swaps\n` +
			`    var _csAttempts = 0;\n` +
			`    var _csRedirect = setInterval(function() {\n` +
			`      if (++_csAttempts > 100) { clearInterval(_csRedirect); return; }\n` +
			`      var _pm = (window as any).__vibexe_playerMesh__;\n` +
			`      if (_pm && _pm !== lily.mesh) {\n` +
			`        lily.mesh = _pm;\n` +
			`        var _cb = _pm.userData?.__characterBounds;\n` +
			`        if (_cb) lily.size = { x: _cb.halfX, y: _cb.height / 2, z: _cb.halfZ };\n` +
			`        clearInterval(_csRedirect);\n` +
			`        console.log("[CharBridge] Redirected lily.mesh to", _pm.name);\n` +
			`      }\n` +
			`    }, 200);\n`,
		);
	}

	// Clear stale terrain config if module not installed
	if (!hasModule(gs, "terrain-painter") && gs.terrain) {
		gs.terrain.enabled = false;
	}

	return code;
}

/**
 * Apply all patches to a set of files. Mutates the files map in-place.
 */
export function patchGameFiles(
	files: Map<string, string>,
	settings: GameSettings,
): void {
	// Patch assets-3d.ts
	for (const [path, content] of files) {
		if (path.endsWith("/assets-3d.ts") || path.endsWith("assets-3d.ts")) {
			files.set(path, patchAssetsCode(content, settings));
		}
	}

	// Patch GameScene3D.ts
	for (const [path, content] of files) {
		if (path.endsWith("GameScene3D.ts")) {
			files.set(path, patchGameSceneCode(content, settings));
		}
	}
}
