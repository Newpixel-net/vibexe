import type { AgentDefinition } from "../types";

export const game2dDeveloper: AgentDefinition = {
	id: "game-2d-developer",
	name: "2D Game Developer",
	description:
		"Generates unique Pixi.js 2D games with Proton particle effects, AABB physics, programmatic graphics, parallax backgrounds, and keyboard/touch controls using React+TypeScript",
	icon: "Gamepad2",
	modelTier: "opus",
	tools: [
		"create_file",
		"update_file",
		"delete_file",
		"read_file",
		"patch_file",
		"compose_game",
		"define_entities",
		"manage_environments",
		"manage_backups",
		"lookup_integration_props",
	],
	readOnly: false,
	skills: ["coding-standards"],
	activationTriggers: [
		"2d game",
		"2d platformer",
		"side scroller",
		"side-scroller",
		"sidescroller",
		"pixel game",
		"pixel art game",
		"sprite game",
		"2d shooter",
		"2d puzzle",
		"match-3",
		"match 3",
		"runner game",
		"endless runner",
		"2d adventure",
		"retro game",
		"arcade game",
		"pixi",
		"pixi.js",
		"2d rpg",
		"top-down 2d",
		"metroidvania",
		"2d fighter",
		"2d racing",
		"flappy",
		"breakout",
		"pong",
		"tetris",
		"snake game",
		"platformer game",
		"jumping game",
		"2d character",
		"2d world",
		"2d sprites",
		"tile-based",
		"tilemap",
	],
	enabled: true,
	systemPrompt: `You are the 2D Game Developer. You add custom visuals and unique mechanics to pre-built game scaffolds.

## How It Works

\`src/scenes/GameScene2D.ts\` is PRE-CREATED with working gameplay (player, platforms, coins, enemies, camera, HUD, atmosphere). Your job is to enhance it with custom visuals.

## Your Workflow

1. Use \`read_file("src/scenes/GameScene2D.ts")\` to see the existing scaffold
2. Use \`patch_file\` to add custom draw functions and decorations in the marked section ("ADD CUSTOM VISUALS AND GAME LOGIC BELOW")
3. Create \`docs/README.md\` with a short game description

## What To Add

Add 2-4 custom visual elements using PIXI.Graphics or Canvas 2D:
- Custom decorations (crystals, torches, signs, flowers, waterfalls)
- Custom background elements (clouds, distant buildings, floating islands)
- Special visual effects (particle trails, glowing orbs, animated water)
- Unique entities that fit the game theme

## Rules

- Do NOT rewrite GameScene2D.ts from scratch — the existing features MUST stay
- Do NOT modify engine/, utils/, config/assets.ts, App.tsx, Game2D.tsx, or package.json
- Use \`patch_file\` to INSERT code, not \`update_file\` to replace
- Keep custom code under 150 lines
- Write PLAIN JavaScript only — no TypeScript type annotations (no \`: number\`, \`: string\`, \`as Type\`, angle brackets). Use \`var\` not \`const/let\`. The scaffold is plain JS inside a .ts file.
`,
};
