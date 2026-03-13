# Search First — Research Before You Code

Systematizes "search for existing solutions before implementing" to avoid reinventing the wheel.
Adapted from ECC's search-first skill for the Vibexe ecosystem.

## When to Use
- Starting a new feature that likely has existing solutions
- Adding a dependency or integration
- Before creating a new utility, helper, or abstraction
- When asked "add X functionality"

## Workflow

### 1. Check if it already exists in the repo
```
Search the codebase first:
- Grep for related function names, types, or patterns
- Check internal-packages/ for shared utilities
- Check packages/ for SDK-level abstractions
- Look in the existing module system (packages/vibexe-engine/src/shared/modules/)
```

### 2. Check if an MCP server already does it
We have these MCP servers available:
- **context7** — Up-to-date library docs and examples
- **playwright** — Browser automation and testing
- **sketchfab** — 3D model search and download
- **meshy** — AI 3D generation and rigging
- **ssh-manager** — Server management
- **memory** — Knowledge graph

Before building custom integrations, check if an MCP tool already provides the capability.

### 3. Search for existing packages
- **npm**: Search for well-maintained packages with good TypeScript support
- **GitHub**: Search for reference implementations
- Use context7 MCP to get latest docs for any library before using it

### 4. Evaluate candidates

| Signal | Action |
|--------|--------|
| Exact match, well-maintained, MIT/Apache | **Adopt** — install and use directly |
| Partial match, good foundation | **Extend** — install + write thin wrapper |
| Multiple weak matches | **Compose** — combine 2-3 small packages |
| Nothing suitable found | **Build** — write custom, informed by research |

### 5. Check compatibility
Before adopting any package:
- Does it work with our stack? (Next.js 16, React 19, Node 22, pnpm)
- Does it have TypeScript types?
- Is it actively maintained? (check last commit date, open issues)
- Does it add significant bundle size?
- Does it conflict with existing dependencies?

## Decision Checklist
Before writing ANY new utility:
- [ ] Searched the codebase (`Grep` / `Glob`)
- [ ] Checked internal-packages/ and packages/
- [ ] Checked MCP servers for existing capability
- [ ] Searched npm for maintained packages
- [ ] Evaluated bundle size impact
- [ ] Confirmed no existing solution works

## Anti-Patterns
- **Jumping to code**: Writing a utility without checking if one exists
- **Ignoring MCP**: Not checking if an MCP server already provides the capability
- **Over-customizing**: Wrapping a library so heavily it loses its benefits
- **Dependency bloat**: Installing a massive package for one small feature
- **Ignoring internal packages**: Not checking if @vibexe-internal/ui or other shared packages already have the component

## Vibexe-Specific Search Order
1. `internal-packages/` — Shared UI, workflow editor components
2. `packages/` — SDK packages (@vibexe-ai/*)
3. `packages/vibexe-engine/src/shared/modules/` — Game engine modules
4. MCP servers — Existing integrations
5. npm — External packages
6. Build custom — Last resort, with research informing the design
