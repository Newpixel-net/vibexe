import type { SkillDefinition } from "../types";

export const securityReview: SkillDefinition = {
	id: "security-review",
	name: "Security Review",
	category: "specialized",
	description:
		"OWASP Top 10, input validation, secrets management, auth patterns, and Vibexe platform-specific security",
	activationTriggers: [
		"security",
		"auth",
		"validation",
		"sanitize",
		"xss",
		"injection",
		"csrf",
		"ssrf",
		"secrets",
		"owasp",
		"audit",
		"vulnerability",
	],
	content: `## OWASP Top 10 Checklist
1. **Injection**: Use parameterized queries (Drizzle tagged templates); never concatenate user input into SQL or use sql.raw() with untrusted data
2. **Broken Auth**: Enforce session validation on every route; use httpOnly+secure+sameSite cookies; implement account lockout
3. **Sensitive Data**: Encrypt secrets with AES-256-GCM (vault package); never log PII or API keys; mask in error responses
4. **XXE**: Disable external entity processing in XML parsers; validate uploaded file contents
5. **Broken Access Control**: Verify permissions on every request with sessionMiddleware/assertWorkspaceAccess; default deny; filter all queries by teamDbId
6. **Misconfiguration**: Remove default credentials; check Next.js middleware matcher covers all protected routes; no directory listing
7. **XSS**: Escape all output; never use dangerouslySetInnerHTML with user content; set Content-Security-Policy headers; sanitize with DOMPurify if rendering HTML
8. **Insecure Deserialization**: Validate with Zod schemas at API boundaries; never trust client-sent JSON structure
9. **Known Vulnerabilities**: Keep dependencies updated via Dependabot; audit with npm audit; check CVE databases
10. **Logging**: Log security events (auth failures, access violations); use Pino structured logging; never log secrets or tokens

## Input Validation Patterns
- Validate type, length, range, and format with Zod schemas on ALL API routes
- Whitelist allowed values over blacklisting dangerous ones
- Sanitize HTML input with DOMPurify if rendering user content
- Validate URL inputs against allowlists; block private IP ranges for SSRF prevention
- Check file upload types, sizes, and content (not just extensions)

## Secrets Management
- All secrets in environment variables via .env.local, never in source code
- No credentials in commit history — .env files in .gitignore
- Encrypt stored secrets (OAuth tokens, API keys) with TOKEN_ENCRYPTION_KEY via vault package
- Use lazy initialization pattern (?? "" defaults) for module-level env reads to prevent build-time exposure
- Rotate secrets regularly; use short-lived tokens where possible

## Auth Patterns (Vibexe-Specific)
- sessionMiddleware wraps all protected API routes — missing it = auth bypass
- assertWorkspaceAccess validates team membership — missing it = horizontal escalation
- OAuth2 callback must validate state parameter to prevent CSRF
- Password reset tokens must be single-use with expiry
- Session cookies: httpOnly=true, secure=true, sameSite=lax

## Database Security (Drizzle ORM)
- Always use Drizzle's tagged template literals for queries (auto-parameterized)
- Never use sql.raw() with user-controlled strings
- All multi-tenant queries MUST include teamDbId/userId filter
- Per-app database tables use prefixed naming (_app_*) for isolation
- Validate all identifiers (table names, column names) against allowlists if dynamic

## App Builder Security
- User-generated code runs in Sandpack (iframe sandbox) during preview
- Deployed apps are esbuild IIFE bundles — client-only, no server execution
- Bridge script (visual-edit-bridge.ts) communicates only via postMessage
- Cross-app isolation: each app has its own prefixed database tables
- Never include platform secrets in deployed app bundles

## Rate Limiting
- Auth endpoints (login, signup, password reset) need rate limiting
- AI generation endpoints need per-user token budgets
- API routes need request-per-minute caps
- Webhook endpoints need signature verification + rate limits`,
	enabled: true,
};
