import type { SkillDefinition } from "../types";

export const frontendPatterns: SkillDefinition = {
	id: "frontend-patterns",
	name: "Frontend Patterns",
	category: "framework",
	description: "React, Next.js, and Tailwind CSS best practices",
	activationTriggers: ["react", "component", "tailwind", "css", "ui", "hook", "state"],
	content: `## Component Composition
- Break UI into small, focused components (< 100 lines each)
- Use composition over prop drilling — pass children, render props
- Extract custom hooks for stateful logic (useAuth, useFetch, useDebounce)
- Colocate related files: Component.tsx + useComponent.ts + component.test.ts

## Hooks Best Practices
- useMemo only for expensive computations, not simple derivations
- useCallback only when passing callbacks to memoized children
- useEffect cleanup functions for subscriptions and timers
- Custom hooks should start with "use" and return typed values

## Tailwind CSS
- Utility-first: compose small classes instead of custom CSS
- Responsive: mobile-first with sm:, md:, lg:, xl: breakpoints
- Dark mode: use dark: variant for theme support
- Consistent spacing: stick to the spacing scale (p-2, p-4, p-6, p-8)
- Extract repeated class combinations into component abstractions, not @apply

## Accessibility
- Semantic HTML: button for actions, a for navigation, proper heading hierarchy
- ARIA labels for icon-only buttons and non-text content
- Keyboard navigation: focusable elements, visible focus rings
- Color contrast: minimum 4.5:1 for normal text, 3:1 for large text`,
	enabled: true,
};
