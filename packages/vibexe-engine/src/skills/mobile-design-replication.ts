import type { SkillDefinition } from "../types";

export const mobileDesignReplication: SkillDefinition = {
	id: "mobile-design-replication",
	name: "Mobile Design Replication",
	category: "specialized",
	description: "Patterns for recreating mobile app designs from screenshots and mockup images",
	activationTriggers: ["mobile", "app", "screenshot", "mockup", "clone", "replicate", "design", "ios", "android"],
	content: `## Reading Design Images
- Analyze each screenshot systematically: navigation pattern, color palette, typography, component types, spacing
- Identify the app's navigation model: tab bar, drawer, stack, or hybrid
- Note the primary accent color, background tones, and text hierarchy
- Catalog recurring UI components (cards, lists, headers, action buttons, modals)

## Color Extraction from Screenshots
- Extract exact colors visible in the design — use arbitrary Tailwind values: bg-[#1a1a2e] text-[#e94560]
- Create a design tokens file (src/utils/design-tokens.ts) mapping: primary, secondary, background, surface, text-primary, text-secondary, accent, error, success
- Dark themes: set html/body background, ensure all surfaces use the correct dark tone
- Gradient patterns: use bg-gradient-to-b from-[#hex] to-[#hex]

## Mobile Layout Patterns
- **Tab-based**: Bottom tab bar with 3-5 items, content area above — most common mobile pattern
- **List-detail**: Master list on main screen, tap navigates to detail view with back button
- **Dashboard**: Grid of cards/stats at top, scrollable content below, optional FAB
- **Social feed**: Avatar + content cards, pull-to-refresh, infinite scroll pattern
- **E-commerce**: Product grid, category filters, cart badge on nav, sticky add-to-cart on detail

## Component Mapping
- Navigation bar → fixed top-0, h-14, flex items-center justify-between px-4, backdrop-blur
- Bottom tab bar → fixed bottom-0, h-16, grid grid-cols-N, items-center, border-t, bg-white
- Card → rounded-2xl p-4 bg-white shadow-sm (or bg-[surface-color] for dark themes)
- List item → flex items-center gap-3 p-4, with border-b or gap between items
- Avatar → w-10 h-10 rounded-full bg-gray-200 overflow-hidden
- Badge/pill → px-2.5 py-0.5 rounded-full text-xs font-medium
- FAB → fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-lg, primary color
- Bottom sheet → fixed inset-x-0 bottom-0 rounded-t-3xl bg-white p-6, backdrop overlay

## Touch Interaction Patterns
- Tap feedback: active:scale-95 active:opacity-80 transition-transform duration-100
- Long press: use onTouchStart/onTouchEnd with setTimeout for context menus
- Swipe actions: translateX with touch events for delete/archive on list items
- Pull-to-refresh: track touchmove delta, show spinner, trigger data reload
- Scroll snap: snap-x snap-mandatory for horizontal carousels

## Skeleton Loading
- Match the layout shape: rounded rectangles with animate-pulse bg-gray-200
- Show 3-5 skeleton items matching the list/grid structure
- Use the same border-radius and sizing as real components`,
	enabled: true,
};
