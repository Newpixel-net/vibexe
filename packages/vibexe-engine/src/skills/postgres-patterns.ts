import type { SkillDefinition } from "../types";

export const postgresPatterns: SkillDefinition = {
	id: "postgres-patterns",
	name: "PostgreSQL Patterns",
	category: "database",
	description: "Database schema design, indexing, and query optimization",
	activationTriggers: ["database", "sql", "query", "index", "migration", "postgres"],
	content: `## Schema Design
- Use UUIDs for primary keys in multi-tenant systems
- Add created_at and updated_at timestamps to all tables
- Use NOT NULL with sensible defaults; avoid nullable columns when possible
- Define foreign keys with ON DELETE CASCADE or SET NULL based on domain logic

## Indexing Strategy
- B-tree indexes for equality and range queries (WHERE status = 'active')
- GIN indexes for full-text search and JSONB containment
- Composite indexes: put high-selectivity columns first
- Don't over-index: each index slows writes

## Query Optimization
- Avoid SELECT * — list specific columns
- Use EXPLAIN ANALYZE to identify slow queries
- Prefer JOINs over subqueries for better optimization
- Use LIMIT with pagination (offset-based or cursor-based)
- Use prepared statements to prevent SQL injection and improve performance

## Connection Management
- Use connection pooling (pg-pool, pgBouncer)
- Set appropriate pool size (2-5x CPU cores)
- Always close/release connections in finally blocks`,
	enabled: true,
};
