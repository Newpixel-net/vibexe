# Build Error Resolver

Fix build and type errors with surgical precision. Minimal changes only.
Adapted from ECC's build-error-resolver for the Vibexe turbo monorepo.

## Mission
Fix the error, verify the build passes, move on. Speed and precision over perfection.

## When to Use
- `pnpm check-types` fails
- `npx turbo build` fails
- Import/module resolution errors
- TypeScript type errors after a change

## Diagnostic Commands

Run these to collect all errors:
```bash
# Type check all packages
pnpm check-types

# Build the main app (use --force if engine packages changed)
npx turbo build --filter=studio.vibexe.ai --force

# Type check a specific package
pnpm -F studio.vibexe.ai exec tsc --noEmit --pretty

# Check for lint issues
pnpm format --check
```

## Workflow

### 1. Collect ALL errors first
Don't fix one-by-one. Run `pnpm check-types` and read the full output.
Categorize: type errors, import errors, config issues, dependency issues.

### 2. Fix with minimal changes
For each error:
1. Read the error message — understand expected vs actual type
2. Find the smallest fix (type annotation, null check, import path)
3. Apply fix
4. Re-run check to verify

### 3. Common Fixes

| Error | Fix |
|-------|-----|
| `implicitly has 'any' type` | Add type annotation |
| `Object is possibly 'undefined'` | Optional chaining `?.` or null check |
| `Property does not exist` | Add to interface or use `?.` |
| `Cannot find module` | Check tsconfig paths, fix import |
| `Type 'X' not assignable to 'Y'` | Cast or fix the type |
| Turbo cache stale | Add `--force` flag |
| Module not found after engine change | `pnpm build-sdk` first |

### 4. Vibexe-Specific Gotchas
- **Always use `--force`** when sandpack-preview.tsx or engine packages change (turbo cache stale)
- **Run `pnpm build-sdk`** before building the main app if SDK packages changed
- **Biome formatting** can cause type-check to show stale errors — run `pnpm format` first
- **Drizzle schema changes** need `pnpm -F studio.vibexe.ai db:generate` before build

## DO
- Add type annotations where missing
- Add null checks where needed
- Fix imports/exports
- Fix configuration files
- Re-run full check after each batch of fixes

## DON'T
- Refactor unrelated code
- Change architecture
- Rename variables (unless causing the error)
- Add new features
- Change logic flow (unless fixing the error)
- Use `any` as a fix (use `unknown` + type guard instead)

## Success Criteria
- `pnpm check-types` exits clean
- `npx turbo build --filter=studio.vibexe.ai --force` succeeds
- No new errors introduced
- Minimal lines changed (< 5% of affected file)

## Quick Recovery
```bash
# Clear all caches and rebuild
rm -rf apps/studio.vibexe.ai/.next && npx turbo build --filter=studio.vibexe.ai --force

# Rebuild SDK packages
pnpm build-sdk

# Fix auto-fixable format issues
pnpm format
```
