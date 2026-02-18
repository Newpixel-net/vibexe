import type { SkillDefinition } from "../types";

export const animationPatterns: SkillDefinition = {
	id: "animation-patterns",
	name: "Animation Patterns",
	category: "specialized",
	description: "CSS animations, transitions, and interactive effects for visual polish",
	activationTriggers: ["animation", "transition", "hover", "scroll", "motion", "effect", "cursor"],
	content: `## Hover Effects
- Scale on hover: hover:scale-105 transition-transform duration-300
- Color transitions: transition-colors duration-200
- Opacity reveals: opacity-0 hover:opacity-100 transition-opacity
- Underline animations: Use pseudo-elements with scaleX transform

## Scroll Animations (CSS-only, no libraries)
- Intersection Observer for scroll-triggered animations:
  useEffect + IntersectionObserver to toggle "animate" class
- Fade-in on scroll: translate-y-8 opacity-0 to translate-y-0 opacity-100
- Staggered children: Use transition-delay with index-based delays

## Page Transitions
- Smooth section transitions: scroll-smooth on html element
- Fade between states: transition-all duration-500

## Custom Cursors
- Track mouse with useState + onMouseMove
- Render a fixed-position div following the cursor
- Mix-blend-mode for cursor effects: mix-blend-difference
- Scale cursor on interactive elements: onMouseEnter/Leave

## Loading and Skeleton States
- Pulse animation: animate-pulse on placeholder elements
- Skeleton screens: rounded bg-gray-800 animate-pulse elements

## Gradient Animations
- Background-size animation for moving gradients
- Inline style for complex gradients: background: linear-gradient(...)
- Animated gradient text: bg-clip-text text-transparent bg-gradient-to-r`,
	enabled: true,
};
