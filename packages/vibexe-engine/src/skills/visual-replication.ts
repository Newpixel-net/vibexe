import type { SkillDefinition } from "../types";

export const visualReplication: SkillDefinition = {
	id: "visual-replication",
	name: "Visual Replication",
	category: "specialized",
	description: "Patterns for recreating website designs from reference analysis",
	activationTriggers: ["replicate", "clone", "copy", "recreate", "pixel-perfect", "match"],
	content: `## Color System Replication
- Extract exact hex values from analysis — never substitute with Tailwind named colors
- Use arbitrary values: bg-[#0a0a0a] text-[#c8ff00] border-[#333333]
- Define CSS variables in a constants file for reuse: --color-primary, --color-accent
- Dark themes: set body/html background, not just container

## Typography Replication
- Import exact fonts via Google Fonts @import in a <style> tag
- Match the type scale exactly: use arbitrary sizes like text-[96px], text-[14px]
- Match font weights: font-[600], font-[700]
- Match letter-spacing: tracking-[0.02em], tracking-[-0.05em]
- Match line-height: leading-[1.1], leading-[1.6]

## Layout Replication
- Full-viewport sections: min-h-screen or h-screen
- Centered content with max-w constraint: max-w-7xl mx-auto
- Grid layouts: grid grid-cols-2 lg:grid-cols-3 gap-8
- Sticky/fixed navigation: fixed top-0 w-full z-50
- Backdrop blur on nav: backdrop-blur-md bg-black/80

## Image Handling
- Replace inaccessible images with high-quality placeholders
- Use picsum.photos/WIDTH/HEIGHT for photo placeholders
- Use placehold.co/WIDTHxHEIGHT/HEX/HEX for branded placeholders
- Preserve aspect ratios: aspect-video, aspect-square, aspect-[16/9]
- Object-fit for images: object-cover object-center

## Responsive Fidelity
- Desktop-first for replication (match the desktop design first)
- Add mobile breakpoints: stack grids, reduce font sizes, collapse nav
- Test common breakpoints: 1440px, 1024px, 768px, 375px`,
	enabled: true,
};
