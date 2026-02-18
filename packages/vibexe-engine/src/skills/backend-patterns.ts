import type { SkillDefinition } from "../types";

export const backendPatterns: SkillDefinition = {
	id: "backend-patterns",
	name: "Backend Patterns",
	category: "framework",
	description: "API design, authentication, and middleware patterns",
	activationTriggers: ["api", "server", "auth", "middleware", "endpoint", "route"],
	content: `## API Architecture
- Controller → Service → Repository pattern for separation of concerns
- Controllers handle HTTP request/response; services contain business logic
- Validate all input at the boundary using Zod schemas
- Return consistent error format: { error: string, code: string, details?: unknown }

## Authentication
- JWT for stateless auth; session tokens for server-rendered apps
- Store tokens in httpOnly cookies, not localStorage
- Implement refresh token rotation for long-lived sessions
- Hash passwords with bcrypt (cost factor 12+)

## Middleware
- Auth middleware: verify token, attach user to request context
- Validation middleware: parse and validate request body/params
- Error middleware: catch all unhandled errors, log and return safe response
- Rate limiting: per-IP or per-user with sliding window

## Error Handling
- Never expose stack traces in production responses
- Log full error details server-side; return sanitized messages to client
- Use typed error classes for different failure modes
- Return appropriate HTTP status codes (400 for validation, 401 for auth, 404 for not found, 500 for server)`,
	enabled: true,
};
