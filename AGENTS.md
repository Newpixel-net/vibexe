# AGENTS.md - Vibexe Development Guide

## Development Philosophy

### Core Principle: **Less is more**
Keep every implementation as small and obvious as possible.

### Guidelines
- **Simplicity first** – Prefer the simplest data structures and APIs that work
- **Avoid needless abstractions** – Refactor only when duplication hurts
- **Remove dead code early** – `pnpm tidy` scans for unused files/deps and lets you delete them in one command
- **Minimize dependencies** – Before adding a dependency, ask "Can we do this with what we already have?"
- **Consistency wins** – Follow existing naming and file-layout patterns; if you must diverge, document why
- **Explicit over implicit** – Favor clear, descriptive names and type annotations over clever tricks
- **Fail fast** – Validate inputs, throw early, and surface actionable errors
- **Let the code speak** – If you need a multi-paragraph comment, refactor until intent is obvious

## Project Overview

Vibexe is built to design and run AI workflows beyond prompt chains. Not a chat. Not a chain. A system you can run.

### Key Features:

- Visual editor
- Instant execution
- No infra headaches
- Open source — self-host or use our cloud

## Architecture

### Monorepo Structure

Vibexe uses a **Turborepo monorepo** with pnpm workspaces, organized into four main directories:

```
/workspace
├── apps/                    # Deployable applications
│   ├── studio.vibexe.ai/  # Vibexe Cloud (production)
│   └── ui.vibexe.ai/      # UI component showcase
├── packages/                # Published SDK packages (@vibexe-ai/*)
├── internal-packages/       # Internal shared packages (@vibexe-internal/*)
└── tools/                   # Development utilities
```

### Package Layers

**SDK Packages (`packages/@vibexe-ai/*`):**
- `protocol` — Core domain types and schemas (Workspace, Node, Task, Generation)
- `vibexe` — Engine implementation (tasks, generations, triggers, integrations)
- `react` — React hooks and components for client integration
- `nextjs` — Next.js integration with route handlers
- `language-model` — Language model abstractions and cost calculations
- `language-model-registry` — Provider-specific model implementations
- `rag` — RAG pipeline (chunking, embedding, querying)
- `github-tool` — GitHub integration utilities

**Internal Packages (`internal-packages/@vibexe-internal/*`):**
- `workflow-designer-ui` — Visual workflow editor (React Flow-based)
- `ui` — Shared UI components (Radix-based)

### Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 22+ |
| Package Manager | pnpm 10+ |
| Build System | Turborepo |
| Web Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Styling | Tailwind CSS 4 |
| State Management | Zustand (editor), SWR (data fetching) |
| Validation | Zod v4 |
| Database | PostgreSQL with Drizzle ORM |
| Vector Store | pgvector |
| Formatting/Linting | Biome |
| Testing | Vitest |
| AI SDK | Vercel AI SDK |

### Data Flow

```
Workspace (JSON) → Protocol Types → Vibexe Engine → Task Execution → Generation Output
                                          ↓
                          Language Model Registry → AI Provider APIs
```

### Key Domain Concepts

- **Workspace** — A visual workflow containing nodes and connections
- **Node** — Either an OperationNode (actions, text generation, triggers) or VariableNode (text, files, vector stores)
- **Task** — An executable instance of a workflow with sequences of generations
- **Generation** — A single step execution (created → queued → running → completed/failed)
- **App** — A published workflow entry point with parameters

## Development Workflow

TBD
### Initial Setup

```sh
pnpm install        # Install all dependencies
pnpm build-sdk      # Build SDK packages (required before running apps)
```

### Development Commands

```sh
# Development
pnpm dev:studio.vibexe.ai  # Start Vibexe Cloud

# Build
pnpm build-sdk               # Build SDK packages
pnpm -F studio.vibexe.ai build  # Build Vibexe Cloud

# Quality Checks
pnpm format                  # Format code with Biome
pnpm check-types             # Type-check all packages
pnpm test                    # Run all tests
pnpm tidy                    # Find unused files/dependencies
pnpm tidy --fix              # Remove unused files/dependencies
```

### After Every Code Change

Run these commands in order:
1. `pnpm format` — Format code
2. `pnpm build-sdk` — Rebuild SDK packages
3. `pnpm check-types` — Verify types
4. `pnpm tidy` — Check for unused code
5. `pnpm test` — Run tests
6. Update `.continuity/` per-branch ledger — Reflect the change immediately

### API addition rule (Vibexe ↔ HTTP)

When adding a new **public API** to `packages/vibexe/src/vibexe.ts`, also add the corresponding routing entry to `packages/http/src/router.ts` (typically `jsonRoutes.<name>` using `vibexe.<name>.inputSchema`) so the API is reachable through the HTTP layer (e.g., via `NextVibexe`).

### Testing

```sh
pnpm test                           # Run all tests
pnpm -F @vibexe-ai/vibexe test   # Run tests for a specific package
cd packages/vibexe && vitest       # Run tests in watch mode
vitest run src/tasks/run-task.test.ts  # Run a specific test file
```

Test files follow the `*.test.ts` naming pattern and use Vitest.

### Pull Request Guidelines

- Create PRs in **meaningful minimum units** — even 1 commit or ~20 lines is fine
- Feature flags protect unreleased features, so submit PRs for any meaningful work
- **~500 lines**: Consider wrapping up for a PR
- **1000 lines**: Maximum threshold — avoid exceeding this

## Key Conventions

### Naming

TBD
**File Names: kebab-case**
```
✅ user-profile.ts
✅ api-client.tsx
✅ text-generation.ts
❌ UserProfile.ts
❌ apiClient.tsx
```

**Components: PascalCase**
```
✅ UserProfile
✅ TextGenerationNode
❌ userProfile
```

**Variables and Functions: camelCase**
```
✅ userEmail
✅ calculateTotalPrice()
✅ validateUserInput()
❌ user_email
```

**Booleans: Prefix with `is`, `has`, `can`, `should`**
```
✅ isEnabled, hasPermission, canEdit, shouldRetry
✅ isCompletedGeneration(), hasActiveSubscription()
❌ enabled, permission, completed
```

**ID Types: Prefixed strings with branded types**
```typescript
// packages/protocol/src/node/base.ts
export const NodeId = createIdGenerator("nd");     // "nd_xxx"
export const InputId = createIdGenerator("inp");   // "inp_xxx"
export const OutputId = createIdGenerator("otp");  // "otp_xxx"
```

### Code Style

TBD
**Formatting (Biome)**
- Tab indentation
- Double quotes for strings
- Organized imports (auto-sorted)

**TypeScript**
- Prefer explicit types over `any`
- Use Zod schemas for runtime validation and type inference:
  ```typescript
  export const Workspace = z.object({
    id: WorkspaceId.schema,
    nodes: z.array(NodeLike),
    connections: z.array(Connection),
  });
  export type Workspace = z.infer<typeof Workspace>;
  ```
- Use discriminated unions for variant types:
  ```typescript
  export const Node = z.discriminatedUnion("type", [
    OperationNode,
    VariableNode,
  ]);
  ```

**React**
- Functional components with hooks
- Zustand for complex state (editor store)
- SWR for server data fetching
- Selective subscriptions to minimize re-renders:
  ```typescript
  // Good: Subscribe only to needed data
  const node = useEditorStore((s) => s.nodesById[nodeId]);
  
  // Bad: Subscribe to entire state
  const state = useEditorStore((s) => s);
  ```

**Async/Await**
- Prefer async/await over raw promises
- Use try/catch for error handling

### Error Handling

TBD
**Custom Error Classes with Symbol Markers**

For cross-package error identification, use Symbol-based instance checking:

```typescript
const marker = "vibexe.react.error.APICallError";
const symbol = Symbol.for(marker);

export class APICallError extends ReactError {
  private readonly [symbol] = true;
  
  static isInstance(error: unknown): error is APICallError {
    return ReactError.hasMarker(error, marker);
  }
}
```

**Validation Errors**

Handle Zod validation errors at API boundaries:
```typescript
try {
  return await jsonRoutes[routerPath](vibexe)({ input });
} catch (e) {
  if (e instanceof ZodError) {
    return new Response("Invalid request body", { status: 400 });
  }
  return new Response("Internal Server Error", { status: 500 });
}
```

**Exhaustive Type Checking**

Use `never` type for exhaustive switch statements:
```typescript
switch (generation.context.operationNode.content.type) {
  case "action":
    // handle action
    break;
  case "textGeneration":
    // handle text generation
    break;
  default: {
    const _exhaustiveCheck: never = generation.context.operationNode.content.type;
    throw new Error(`Unhandled type: ${_exhaustiveCheck}`);
  }
}
```

**Fail Fast**

Validate inputs early and throw with actionable messages:
```typescript
if (!generation) {
  throw new Error(`Generation(id: ${generationId}) is not found`);
}

if (!config.vectorStoreQueryService) {
  throw new Error("No vector store query service provided");
}
```

### Feature Flags

Feature flags protect unreleased features, allowing safe merges to main and production deploys.

**Step 1: Define the flag in `apps/studio.vibexe.ai/flags.ts`**

```typescript
export const myNewFeatureFlag = flag<boolean>({
  key: "my-new-feature",
  async decide() {
    if (process.env.NODE_ENV === "development") {
      return takeLocalEnv("MY_NEW_FEATURE_FLAG");
    }
    const edgeConfig = await get(`flag__${this.key}`);
    if (edgeConfig === undefined) {
      return false;
    }
    return edgeConfig === true || edgeConfig === "true";
  },
  description: "Enable my new feature",
  options: [
    { value: false, label: "disable" },
    { value: true, label: "Enable" },
  ],
  defaultValue: false,
});
```

**Step 2: Use on server (Next.js server components, data loaders)**

```typescript
// apps/studio.vibexe.ai/app/workspaces/[workspaceId]/data-loader.ts
const myNewFeature = await myNewFeatureFlag();
return {
  // ...
  featureFlags: {
    // ...existing flags
    myNewFeature,
  },
};
```

**Step 3: Expose to React components**

Add the flag to the `FeatureFlagContextValue` interface:

```typescript
// packages/react/src/feature-flags/context.ts
export interface FeatureFlagContextValue {
  // ...existing flags
  myNewFeature: boolean;
}
```

Add to `WorkspaceProvider` defaults:

```typescript
// packages/react/src/workspace/provider.tsx
<FeatureFlagContext
  value={{
    // ...existing flags
    myNewFeature: featureFlag?.myNewFeature ?? false,
  }}
>
```

**Step 4: Use in React components**

```typescript
import { useFeatureFlag } from "@vibexe-ai/react";

function MyComponent() {
  const { myNewFeature } = useFeatureFlag();
  
  if (!myNewFeature) {
    return null; // or fallback UI
  }
  
  return <NewFeatureUI />;
}
```

**Local development**: Set the environment variable (e.g., `MY_NEW_FEATURE_FLAG=true`) in `.env.local`.

**Production**: Configure via Vercel Edge Config with key `flag__my-new-feature`.

## Continuity (per-branch ledgers + batched summary)
Keep “human intent” and session context in-repo for review **without frequent merge conflicts** by using a two-layer model:
- `CONTINUITY.md`: a **batched snapshot** (low churn), updated occasionally.
- `.continuity/`: **per-branch ledgers** (high churn), updated on every request / during work.

### Agent behavior spec
- Locate ledger (every user request):
  - Determine current git branch name: `git rev-parse --abbrev-ref HEAD`.
  - Sanitize branch by replacing `/` with `__`.
- Find ledger file:
  - In `.continuity/`, find files whose filename ends with `-<sanitizedBranch>.md` (suffix match).
  - If multiple match, pick the latest by lexicographically greatest datetime prefix `YYYYMMDD-HHMMSS`.
- Reuse / create:
  - If one exists: read it first and update it as needed.
  - If none exists: create `YYYYMMDD-HHMMSS-<sanitizedBranch>.md` initialized from `.continuity/template.md` and the current user request.

### Notes on the two-layer model
- Read **both** `CONTINUITY.md` and the current `.continuity/` branch ledger to understand context.
- Write high-churn notes only to `.continuity/` (what changed, why, tradeoffs, open questions, working set).
- Periodically batch-summarize `.continuity/*` into `CONTINUITY.md` (“as of <date>”).

### `functions.update_plan` vs the Ledger
- `functions.update_plan` is for short-term execution scaffolding while you work (a small 3–7 step plan with pending/in_progress/completed).
- `CONTINUITY.md` is a batched summary; per-branch ledgers live in `.continuity/`.
- Keep them consistent: summarize `.continuity/` into `CONTINUITY.md` periodically (not every micro-step).

### In replies
- Begin with a brief “Ledger Snapshot” based on the current per-branch ledger (Goal + Now/Next + Open Questions). Print the full ledger only when it materially changes or when the user asks.

### `CONTINUITY.md` format (keep headings)
- Goal (incl. success criteria):
- Constraints/Assumptions:
- Key decisions:
- State:
- Done:
- Now:
- Next:
- Open questions (UNCONFIRMED if needed):
- Working set (files/ids/commands):

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **vibexe** (10058 symbols, 27603 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/vibexe/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/vibexe/context` | Codebase overview, check index freshness |
| `gitnexus://repo/vibexe/clusters` | All functional areas |
| `gitnexus://repo/vibexe/processes` | All execution flows |
| `gitnexus://repo/vibexe/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
