import type { SkillDefinition } from "../types";

export const securityReview: SkillDefinition = {
	id: "security-review",
	name: "Security Review",
	category: "specialized",
	description:
		"Security patterns for React apps built with @vibexe/sdk — XSS prevention, auth guards, input validation, data safety",
	activationTriggers: [
		"security",
		"auth",
		"validation",
		"sanitize",
		"xss",
		"injection",
		"csrf",
		"secrets",
		"owasp",
		"audit",
		"vulnerability",
	],
	content: `## XSS Prevention
- React JSX auto-escapes by default — this is the primary defense
- NEVER use dangerouslySetInnerHTML with user-supplied content
- Validate URLs before using in href/src attributes (block javascript: protocol)
- If HTML rendering is needed, sanitize with DOMPurify first
- Never build event handler strings from user data

## Authentication Patterns (@vibexe/sdk)
- Check app.auth.isAuthenticated() before rendering protected content
- Call app.auth.getCurrentUser() on mount to restore session from localStorage
- Wrap protected routes/pages with an AuthGuard component
- Clear password fields after submission — never keep in React state
- Handle auth errors gracefully (show message, don't expose details)
- On signOut: call app.auth.signOut(), clear localStorage, redirect to login

## Input Validation
- Validate all form inputs before calling app.data.create/update
- Check required fields, email format, number ranges, string lengths
- Sanitize text inputs: trim whitespace, limit length
- Validate numeric inputs: no negative prices, enforce min/max
- Never pass raw user input to SDK without validation

## Session Token Safety
- Token is stored as vibexe_session in localStorage
- Never display tokens in UI, logs, or error messages
- Never pass tokens in URL query parameters
- Only send tokens via Authorization header (SDK handles this)
- Always call localStorage.removeItem on signOut

## Data Access Patterns
- Filter data by authenticated user when appropriate (ownership checks)
- Don't expose entity IDs that allow enumeration (sequential IDs)
- Add confirmation dialogs before destructive actions (delete)
- Use POST for state-changing operations, GET for reads only
- Validate entity IDs from URL params before querying

## Sensitive Data
- Never hardcode passwords, API keys, or secrets in source files
- Remove console.log statements that output user data or tokens
- Mask PII in UI where appropriate (email: a***@example.com)
- Show generic error messages to users, not stack traces or DB errors
- Don't store sensitive data in React state longer than needed

## Unsafe Code Patterns to Flag
- eval(), Function(), new Function() with any input
- window.location set from user-controlled data (open redirect)
- postMessage without origin validation
- setTimeout/setInterval with string arguments
- innerHTML set via DOM manipulation (bypasses React escaping)`,
	enabled: true,
};
