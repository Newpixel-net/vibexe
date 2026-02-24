# Deprecate `apps/studio.vibexe.ai` `/api/vibexe` catch-all

`apps/studio.vibexe.ai` currently exposes a catch-all handler at `/api/vibexe/*`.
This handler does not enforce Studio authn/authz at the HTTP boundary, so we will deprecate it and replace it with narrowly scoped endpoints.

## Current state

- Catch-all route: `apps/studio.vibexe.ai/app/api/vibexe/[...next-vibexe]/route.ts`
- Handler configuration: `apps/studio.vibexe.ai/app/vibexe.ts` (via `NextVibexe({ basePath: "/api/vibexe", ... })`)

What it currently handles (via `packages/nextjs/src/next-vibexe-engine.ts`):

- **Generated images**: `GET /api/vibexe/generations/:generationId/generated-images/:filename`
- **GitHub webhook**: `POST /api/vibexe/github-webhook`
- **(Potentially) other internal routes**: JSON/FormData routes under `@vibexe-ai/http` depending on how the catch-all is used.

Notable current dependencies:

- Studio task UI / generation UI expects generated images to be served under `/api/vibexe`:
  - `internal-packages/workflow-designer-ui/src/ui/generation-view.tsx` (hardcoded `src={`/api/vibexe${content.pathname}`}`)
  - Imported by Studio pages:
    - `apps/studio.vibexe.ai/app/(main)/tasks/[taskId]/ui/step-item.tsx`
    - `apps/studio.vibexe.ai/app/(main)/tasks/[taskId]/ui/final-step-output.tsx`
- Auth middleware explicitly exempts the current webhook path:
  - `apps/studio.vibexe.ai/proxy.ts` (matcher excludes `api/vibexe/github-webhook`)

## Target state

Replace the catch-all with dedicated routes:

- **GitHub webhook**: `POST /webhooks/github`
- **Generated images**: `GET /api/generations/:generationId/generated-images/:filename`

After migration:

- Remove `apps/studio.vibexe.ai/app/api/vibexe/[...next-vibexe]/route.ts` entirely.
- Remove any remaining `/api/vibexe` hardcoded references (UI, docs, tests, constants).

## Migration / rollout approach

We should roll out in a safe, incremental order:

1. Add the new endpoints (keeping the existing `/api/vibexe` endpoints working).
2. Update Studio UI to use the new generated-image endpoint.
3. Update GitHub App webhook URL to point to the new endpoint.
4. Monitor for inbound traffic to the old webhook path and for broken image fetches.
5. Delete the catch-all route.

## Tasks

- [ ] Add `POST /webhooks/github` handler (e.g. `apps/studio.vibexe.ai/app/webhooks/github/route.ts`)
  - [ ] Verify GitHub signature using the same secret as the current handler
  - [ ] Delegate to the existing GitHub webhook handling logic (keep behavior unchanged)
  - [ ] Update `apps/studio.vibexe.ai/proxy.ts` to exempt `/webhooks/github` from auth middleware
  - [ ] Update GitHub App settings to use the new webhook URL
  - [ ] Temporarily keep accepting `POST /api/vibexe/github-webhook` during rollout (optional, but recommended)
- [ ] Add `GET /api/generations/:generationId/generated-images/:filename` handler
  - [ ] Implement it as a narrow read-only route that serves the generated image blob with correct headers
  - [ ] Update `internal-packages/workflow-designer-ui/src/ui/generation-view.tsx` to stop prefixing `/api/vibexe`
  - [ ] Verify Studio task pages render generated images correctly after the change
- [ ] Delete the catch-all route `apps/studio.vibexe.ai/app/api/vibexe/[...next-vibexe]/route.ts`
  - [ ] Remove `/api/vibexe` references that become dead (e.g. `apps/studio.vibexe.ai/app/basePath.ts`, docs/tests)
  - [ ] Ensure no other runtime callers still depend on `/api/vibexe/*`

## Done

- [ ] (this document) Added a concrete deprecation plan and task checklist.

## Changelog

- 2026-01-15: Created

