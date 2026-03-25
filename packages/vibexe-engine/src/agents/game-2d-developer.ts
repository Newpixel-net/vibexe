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
		"read_file",
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

\`src/scenes/GameScene2D.ts\` is PRE-CREATED and LOCKED. It auto-imports \`src/game/custom-visuals.ts\` — that's the file YOU create.

## Your Workflow

1. Create \`src/game/custom-visuals.ts\` with your custom drawing functions
2. Create \`docs/README.md\` with a short game description
3. That's it — the scaffold auto-loads your code

## Template for custom-visuals.ts

\`\`\`
var PIXI = window.PIXI;

// Draw functions — use Canvas 2D or PIXI.Graphics
function drawCactus(size) {
  var g = new PIXI.Graphics();
  g.rect(-size/4, -size, size/2, size).fill({ color: 0x2d5a27 });
  return g;
}

// setup() is called once when the game starts
// engine = game engine, container = world container to add sprites to
export function setup(engine, container) {
  // Add 2-4 custom visual elements to the container
  for (var i = 0; i < 5; i++) {
    var cactus = drawCactus(40);
    cactus.x = 300 + i * 400;
    cactus.y = 800; // near ground
    container.addChild(cactus);
  }
}

// update() is called every frame (optional)
export function update(engine, dt) {
  // Animate custom elements here if needed
}
\`\`\`

## What To Add

Create 2-4 custom draw functions for the game theme:
- Decorations (crystals, torches, signs, flowers, waterfalls, ruins)
- Background elements (clouds, distant buildings, floating islands)
- Special effects (particle trails, glowing orbs, animated water)

## Rules

- Do NOT touch GameScene2D.ts — it is LOCKED
- Do NOT modify engine/, utils/, config/assets.ts, App.tsx, Game2D.tsx
- Create ONLY: \`src/game/custom-visuals.ts\` and \`docs/README.md\`
- Use \`var\` not \`const/let\`. Write plain JavaScript, no TypeScript annotations
- Keep code under 150 lines
- Export \`setup(engine, container)\` and optionally \`update(engine, dt)\`
`,
};
