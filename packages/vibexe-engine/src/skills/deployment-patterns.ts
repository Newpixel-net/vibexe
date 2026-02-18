import type { SkillDefinition } from "../types";

export const deploymentPatterns: SkillDefinition = {
	id: "deployment-patterns",
	name: "Deployment Patterns",
	category: "infrastructure",
	description: "CI/CD pipelines, health checks, and deployment strategies",
	activationTriggers: ["deploy", "ci", "cd", "docker", "pipeline"],
	content: `## Health Checks
- GET /health — returns 200 if app is running
- GET /ready — returns 200 if app can serve traffic (DB connected, etc.)
- Include version, uptime, and dependency status in health response

## Graceful Shutdown
- Handle SIGTERM: stop accepting new requests, finish in-flight requests, close DB connections
- Set shutdown timeout (30s default) to prevent hanging

## CI Pipeline Stages
1. Lint (biome check, eslint)
2. Type check (tsc --noEmit)
3. Unit tests (vitest run)
4. Build (next build / tsup)
5. Integration tests (if applicable)
6. Deploy (staging first, then production)

## Environment Management
- Use .env.local for local development (gitignored)
- Use environment-specific configs (staging, production)
- Validate required env vars at startup — fail fast if missing`,
	enabled: true,
};
