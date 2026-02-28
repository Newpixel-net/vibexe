/**
 * Game Template Files — Pre-created infrastructure injected into projects
 * BEFORE the AI agent starts generating code.
 *
 * The agent finds these files already existing and imports from them,
 * rather than trying to copy verbatim code (which models do unreliably).
 *
 * To add more template files, just add entries to GAME_TEMPLATE_FILES.
 */

export interface TemplateFile {
	path: string;
	content: string;
	language: string;
}

export const GAME_TEMPLATE_FILES: TemplateFile[] = [
	{
		path: "src/assets/loader.ts",
		language: "typescript",
		content: `export function ASSET(path: string): string {
  const origin = (window as any).__VIBEXE_API_ORIGIN__ || "";
  return \`\${origin}/api/app-builder/media-stock/\${encodeURI(path)}\`;
}

export function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn("Asset failed:", path);
      const fb = new Image(1, 1);
      fb.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      resolve(fb);
    };
    img.src = ASSET(path);
  });
}

export async function loadFrames(paths: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(paths.map(p => loadImage(p)));
}

export class SpriteAnimation {
  frames: HTMLImageElement[];
  fps: number;
  currentFrame = 0;
  elapsed = 0;
  constructor(frames: HTMLImageElement[], fps = 12) { this.frames = frames; this.fps = fps; }
  update(dt: number) {
    this.elapsed += dt;
    if (this.elapsed >= 1 / this.fps) { this.elapsed -= 1 / this.fps; this.currentFrame = (this.currentFrame + 1) % this.frames.length; }
  }
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    if (this.frames.length > 0) ctx.drawImage(this.frames[this.currentFrame], x, y, w, h);
  }
  drawFlipped(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    if (this.frames.length > 0) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(this.frames[this.currentFrame], 0, 0, w, h); ctx.restore(); }
  }
}
`,
	},
];
