/**
 * Reference Patterns — compact technique snippets for AI inspiration.
 * NOT full games. Just short examples of key patterns the AI should use creatively.
 */

export const GAME_2D_REFERENCE_GAMES = `
## Reference Patterns — Use These Techniques Creatively

### Pattern 1: Custom Drawing Functions (Canvas 2D → PIXI.Sprite)
\`\`\`typescript
function drawCrystal(size: number, color: number): PIXI.Sprite {
  var w = size, h = size * 1.5;
  var canvas = document.createElement("canvas");
  canvas.width = w * 2; canvas.height = h * 2;
  var ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.beginPath(); ctx.moveTo(w/2, 0); ctx.lineTo(w, h*0.7); ctx.lineTo(w/2, h); ctx.lineTo(0, h*0.7); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.4; ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(w/2, 0); ctx.lineTo(w*0.65, h*0.35); ctx.lineTo(w/2, h*0.5); ctx.closePath(); ctx.fill();
  var s = new PIXI.Sprite(PIXI.Texture.from(canvas)); s.anchor.set(0.5, 1); return s;
}
\`\`\`

### Pattern 2: Custom Entity with PIXI.Graphics
\`\`\`typescript
function drawNeonPlatform(w: number, h: number, color: number): PIXI.Graphics {
  var g = new PIXI.Graphics();
  g.rect(0, 0, w, h).fill({ color: 0x111122 });
  g.rect(1, 1, w-2, 2).fill({ color, alpha: 0.9 });
  g.rect(1, h-3, w-2, 2).fill({ color, alpha: 0.9 });
  return g;
}
\`\`\`

### Pattern 3: Scene Structure (REQUIRED pattern)
\`\`\`typescript
export default class GameScene2D implements GameScene {
  name = 'game';                        // REQUIRED — engine looks up by name
  container = new PIXI.Container();     // REQUIRED — engine adds to stage
  private _update: ((dt: number) => void) | null = null;

  async enter(engine: Engine2D) {
    var PAL = PALETTES["chosen_theme"];
    var app = engine.app, W = app.screen.width, H = app.screen.height;
    // Build visual layers, physics, entities...
    this._update = (dt) => { /* game loop */ };
  }
  update(engine: Engine2D, dt: number) { this._update?.(dt); }
  exit(engine: Engine2D) { engine.juice.killAll(); }
}
\`\`\`

### Pattern 4: Visual Layer Stack (order matters)
\`\`\`typescript
// Layer 1: Sky background
this.container.addChild(drawSkyGradient(W, H, PAL.skyTop, PAL.skyBottom));
// Layer 2: Stars/particles (optional)
var stars = drawStars(W, H * 0.4, 50); stars.alpha = 0.3; this.container.addChild(stars);
// Layer 3: Parallax mountains
for (var i = 0; i < 3; i++) {
  this.container.addChild(drawMountainRange(W, GROUND_Y, PAL.mountains[i], 0.5 - i*0.15, 60, 160, 200));
}
// Layer 4: Trees/decoration
// Layer 5: Ground strip
this.container.addChild(drawGroundStrip(W, 60, PAL.ground, PAL.groundEdge));
// Layer 6: Platforms, entities, player ON TOP
\`\`\`

### Pattern 5: Physics + Player Setup
\`\`\`typescript
var physics = new PhysicsWorld(0, 980);
createStaticBody(physics, W/2, GROUND_Y + 30, W, 60); // ground
createStaticBody(physics, 800, GROUND_Y - 120, 200, 20); // platform
var playerBody = createBody(physics, 200, GROUND_Y - 50, 28, 40);
var ctrl = new CharacterController(playerBody, { moveSpeed: 280, jumpForce: 520 });
\`\`\`

### Pattern 6: Camera Follow
\`\`\`typescript
// In enter(): set camera target
engine.camera.follow(playerSprite); // pass the sprite object, not x/y
// The engine auto-updates camera each frame — no need to call in update()
// Camera auto-applies to this.container via engine tick
\`\`\`

### Pattern 7: Collectible with Juice
\`\`\`typescript
var coin = drawCoinToken(18);
coin.x = 500; coin.y = GROUND_Y - 100;
this.container.addChild(coin);
engine.juice.float(coin, 4, 1.5); // gentle floating
// On collect:
onCollectSparkle(engine, coin.x, coin.y);
engine.juice.pop(coin);
score++;
\`\`\`

### Pattern 8: Enemy AI (simple chaser)
\`\`\`typescript
var enemy = { sprite: drawEnemySprite(24, 0xFF4444), x: 600, y: GROUND_Y - 30, dir: -1, speed: 60 };
this.container.addChild(enemy.sprite);
// In update: patrol or chase
enemy.x += enemy.dir * enemy.speed * dt;
if (enemy.x < patrolMin || enemy.x > patrolMax) enemy.dir *= -1;
enemy.sprite.x = enemy.x; enemy.sprite.y = enemy.y;
\`\`\`

### Pattern 9: Lighting & Atmosphere
\`\`\`typescript
var lighting = createLightingLayer(W, H, 0.3); // darkens scene
this.container.addChild(lighting);
var vignette = drawVignette(W, H, 0.4);
this.container.addChild(vignette);
// Ambient particles
createAmbientEffect(engine, this.container, "fireflies", W, H);
\`\`\`

### Pattern 10: HUD (fixed position, added to engine stage)
\`\`\`typescript
var hud = new PIXI.Container();
var scoreTxt = new PIXI.Text({ text: "Score: 0", style: { fill: 0xFFFFFF, fontSize: 18, fontWeight: "bold", stroke: { color: 0x000000, width: 3 } } });
scoreTxt.x = 10; scoreTxt.y = 10;
hud.addChild(scoreTxt);
engine.app.stage.addChild(hud); // HUD on stage, not world — stays fixed
// Update: scoreTxt.text = "Score: " + score;
\`\`\`

### Key Rules:
1. **Draw custom entities** — every game MUST have unique drawXXX() functions
2. **Different layouts** — wide exploration, tight precision, vertical ascent, branching paths
3. **Different gameplay loops** — collecting, combat, speed runs, puzzle exploration
4. **Different atmospheres** — warm fireflies, neon glow, cold blizzard, underwater, space
5. **Use engine juice** — shake, pop, float, breathe, hitPause for game feel
6. **Use this.container** — all game objects go in this.container, NOT engine.app.stage
`;
