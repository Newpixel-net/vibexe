import type { SkillDefinition } from "../types";

export const apiDesign: SkillDefinition = {
	id: "api-design",
	name: "API Design",
	category: "framework",
	description: "REST conventions, pagination, filtering, and versioning",
	activationTriggers: ["api", "rest", "endpoint", "pagination", "versioning"],
	content: `## Resource Naming
- Use plural nouns: /users, /posts, /comments
- Nest related resources: /users/:id/posts
- Use kebab-case for multi-word resources: /user-profiles

## HTTP Methods
- GET: Read (safe, idempotent)
- POST: Create (not idempotent)
- PUT: Full replace (idempotent)
- PATCH: Partial update (idempotent)
- DELETE: Remove (idempotent)

## Status Codes
- 200: Success with body
- 201: Created (with Location header)
- 204: Success, no body (DELETE)
- 400: Bad request (validation error)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized)
- 404: Not found
- 409: Conflict (duplicate)
- 500: Server error

## Pagination
- Use limit/offset for simple pagination: ?limit=20&offset=40
- Use cursor-based for large datasets: ?cursor=abc123&limit=20
- Return total count in response: { data: [...], total: 150, limit: 20, offset: 0 }

## Filtering & Sorting
- Filter: ?status=active&role=admin
- Sort: ?sort=created_at&order=desc
- Search: ?q=search+term`,
	enabled: true,
};
