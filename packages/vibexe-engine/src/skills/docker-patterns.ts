import type { SkillDefinition } from "../types";

export const dockerPatterns: SkillDefinition = {
	id: "docker-patterns",
	name: "Docker Patterns",
	category: "infrastructure",
	description: "Multi-stage builds, compose, and container best practices",
	activationTriggers: ["docker", "container", "dockerfile", "compose"],
	content: `## Multi-Stage Builds
- Stage 1 (builder): Install deps, compile, run tests
- Stage 2 (runtime): Copy only production artifacts, use slim base image
- Use .dockerignore to exclude node_modules, .git, .env files

## Container Best Practices
- Run as non-root user (USER node)
- Use specific image tags, not :latest
- Order Dockerfile commands for optimal layer caching (COPY package.json first, then npm install, then COPY . .)
- Set HEALTHCHECK instruction for orchestrator health monitoring
- Use ENTRYPOINT for the main process, CMD for default arguments

## Docker Compose
- Define services with clear dependency ordering (depends_on)
- Use named volumes for persistent data
- Configure networks for service isolation
- Set resource limits (mem_limit, cpus)
- Use environment files for configuration`,
	enabled: true,
};
