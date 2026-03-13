# Test-Driven Development Workflow

Enforces test-first development for new features, bug fixes, and refactors.
Adapted from ECC's tdd-workflow for the Vibexe monorepo (Vitest + Playwright).

## When to Use
- Writing new API routes or services
- Fixing bugs (write failing test first, then fix)
- Refactoring existing code
- Adding new components with logic

## Workflow

### Step 1: Define the behavior
Write a 1-line user story:
```
As a [role], I want [action], so that [benefit]
```

### Step 2: Write failing tests FIRST (RED)
Create `*.test.ts` file next to the implementation file.

**Unit/Integration tests (Vitest):**
```typescript
import { describe, it, expect, vi } from "vitest";

describe("featureName", () => {
  it("does the expected thing", async () => {
    // Arrange → Act → Assert
  });

  it("handles edge case", async () => {
    // Test error path
  });
});
```

**API route tests:**
```typescript
import { describe, it, expect, vi } from "vitest";

describe("GET /api/endpoint", () => {
  it("returns data for authenticated user", async () => {
    // Mock auth, call route handler, assert response
  });

  it("returns 401 for unauthenticated request", async () => {
    // Assert auth guard works
  });
});
```

**E2E tests (Playwright) — only for critical user flows:**
```typescript
import { test, expect } from "@playwright/test";

test("user can complete workflow", async ({ page }) => {
  await page.goto("/app-builder/...");
  // Test the full user journey
});
```

### Step 3: Run tests — they MUST fail
```bash
pnpm -F studio.vibexe.ai test -- --run path/to/test.test.ts
```
If tests pass without implementation, the tests are wrong.

### Step 4: Write minimal implementation (GREEN)
Write the smallest amount of code to make tests pass. No extras.

### Step 5: Run tests — they MUST pass
```bash
pnpm -F studio.vibexe.ai test -- --run path/to/test.test.ts
```

### Step 6: Refactor (IMPROVE)
Clean up while keeping tests green. Then run full checks:
```bash
pnpm format && pnpm check-types && pnpm test
```

## Test File Placement
- Place test files next to source: `feature.ts` → `feature.test.ts`
- E2E tests go in `apps/studio.vibexe.ai/tests/e2e/`
- Test files use `*.test.ts` or `*.test.tsx` pattern

## Mocking Patterns

**Database (Drizzle):**
```typescript
vi.mock("@/drizzle", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
```

**Auth:**
```typescript
vi.mock("@/lib/auth/get-user", () => ({
  getUser: vi.fn(() => Promise.resolve({ id: "user_123" })),
}));
```

**External services:**
```typescript
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));
```

## Common Mistakes
- Testing implementation details instead of behavior
- Tests that depend on each other (no isolation)
- Skipping error/edge case paths
- Writing tests AFTER code (defeats purpose)

## DO
- Test what users see and what APIs return
- Use semantic selectors in E2E (`getByRole`, `getByText`)
- Mock external dependencies, not internal logic
- One assertion focus per test

## DON'T
- Test internal state or private methods
- Use brittle CSS selectors in E2E
- Skip the RED step (tests must fail first)
- Add tests for trivial getters/setters
