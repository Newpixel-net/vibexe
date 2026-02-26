# Error Handling Audit Report — App Builder Generation Pipeline

**Date**: 2026-02-26
**Trigger**: Fireworks AI credits exhausted mid-generation (Super Mario mobile game build)
**Scope**: Full audit of error handling across the app builder generation pipeline

---

## Executive Summary

The Vibexe App Builder has **no graceful degradation** when an AI provider fails mid-generation. Files created before the failure are safely persisted (auto-save works), but the user experience degrades significantly: a generic error banner appears with no retry option, the generation state gets stuck, and there's no automatic fallback to another provider. This report catalogs **12 specific gaps** across 4 system layers with proposed fixes.

---

## Test Scenario: What Actually Happens When Fireworks Credits Run Out

1. User starts "Build Super Mario game" -> Kimi K2.5 via Fireworks API
2. Fireworks returns HTTP 402/429 (payment required / rate limit exceeded)
3. **Two possible failure points**:
   - **Before first chunk**: `streamText()` throws synchronously -> caught by `catch (error)` at `route.ts:744` -> returns HTTP 500 JSON `{ error: "Internal server error" }` -> client shows red banner "Error: Internal server error"
   - **Mid-stream** (after some files created): SSE connection drops -> `useChat` detects broken stream -> `onError` fires -> console.error + red banner "Error: Failed to fetch"
4. Files created before the failure ARE saved (each `create_file` persists immediately)
5. User sees generic error, no retry button, no explanation of cause

---

## Layer 1: Server-Side Error Handling (chat/route.ts)

### Gap 1: No `onError` Callback on `streamText()`
**File**: `app/api/app-builder/chat/route.ts:688-738`
**Severity**: CRITICAL

The `streamText()` call has `onStepFinish` and `onFinish` callbacks but **no `onError` callback**. When the AI provider fails mid-stream:
- The error propagates through the SSE transport as a broken connection
- Server-side, there's no logging of WHY the stream failed (only `[Chat API] Error:` in the catch block, which only catches pre-stream errors)
- `onFinish` may or may not fire depending on when the error occurs

**Fix**: Add `onError` callback to log the specific provider error with model/provider context.

### Gap 2: No Provider-Specific Error Parsing
**File**: `app/api/app-builder/chat/route.ts:744-750`
**Severity**: HIGH

The catch block returns a generic `"Internal server error"` regardless of the actual error:
- Fireworks 402 (credits exhausted) -> "Internal server error"
- Anthropic 429 (rate limited) -> "Internal server error"
- Network timeout -> "Internal server error"
- Invalid API key -> "Internal server error"

The actual error object is logged to server console but never sent to the client in a useful format.

**Fix**: Parse the error, extract provider name + HTTP status, return actionable error message:
- 402: "Fireworks AI credits exhausted. Switch to another model or add credits."
- 429: "Rate limited. Please wait 30 seconds and try again."
- 401: "Invalid API key for [provider]. Check your settings."
- Network: "Could not reach [provider]. Check your internet connection."

### Gap 3: No Automatic Model Fallback
**File**: `app/api/app-builder/chat/route.ts` (entire flow)
**Severity**: HIGH

When Fireworks fails, the system does NOT:
- Try NVIDIA (same Kimi K2.5 model, different provider)
- Try Claude Sonnet 4.5 (different model, reliable provider)
- Try any other configured provider

The V2 engine (`generate-content.ts`) has fallback model support, but the App Builder's V1 `streamText()` call has zero retry/fallback logic.

**Fix**: Wrap `streamText()` in a try-catch with fallback chain:
1. Primary model (user-selected or default)
2. Same-tier fallback (e.g., Fireworks -> NVIDIA for Kimi K2.5)
3. Cross-tier fallback (e.g., Kimi K2.5 -> Claude Sonnet 4.5)
4. Send a data event telling the client which model was used as fallback

---

## Layer 2: Client-Side Error Handling (chat-column.tsx)

### Gap 4: Minimal `onError` Handler
**File**: `app/(main)/app-builder/components/chat-column.tsx:458-461`
**Severity**: HIGH

```typescript
onError: (error) => {
    console.error("Chat error:", error);
    setIsThinking(false);
},
```

This handler:
- Logs to browser console (invisible to users)
- Resets `isThinking` flag
- Does NOT reset `isGenerating` / phase timeline state
- Does NOT parse or categorize the error
- Does NOT trigger any recovery flow

**Fix**: Parse error message, categorize, show contextual recovery options, reset all generation state.

### Gap 5: Generic Error Banner with No Actions
**File**: `app/(main)/app-builder/components/chat-column.tsx:1450-1455`
**Severity**: HIGH

```tsx
{error && (
  <div className="px-4 py-2 text-sm text-red-400 bg-red-500/[0.06] border-t border-red-500/[0.1]">
    Error: {error.message}
  </div>
)}
```

Problems:
- Shows raw `error.message` (e.g., "Failed to fetch" — meaningless to users)
- No retry button
- No "switch model" suggestion
- No "your files are safe" reassurance
- Subtle glass styling — easy to miss on dark backgrounds
- No auto-dismiss or manual dismiss
- Stays forever until next successful message

**Fix**: Replace with an actionable error card:
```
Generation stopped: [provider] returned an error.
[X] files were saved successfully before the error.
[Retry with same model] [Switch to Claude Sonnet] [Dismiss]
```

### Gap 6: Phase Timeline Gets Stuck on Error
**File**: `app/(main)/app-builder/components/chat-column.tsx` (phase tracking)
**Severity**: CRITICAL

When a stream dies mid-generation:
- Active phases remain in `"generating"` status with a perpetual spinner
- Tool events show as `"interrupted"` (amber icon) but phases never auto-complete/error
- The phase progress bar freezes (e.g., "5 of 12 files" forever)
- `isGenerationComplete` never becomes true because phases aren't marked as `"error"` or `"completed"`

The user sees a frozen progress indicator with no way to dismiss or reset it.

**Fix**: When `onError` fires, scan active phases and mark them as `"error"`. Show accurate count: "8 of 18 files created before error."

### Gap 7: No "Retry" or "Resume" Mechanism
**File**: `app/(main)/app-builder/components/chat-column.tsx` + `chat-input.tsx`
**Severity**: HIGH

After a generation error:
- The stop button disappears (correct)
- The input box is re-enabled (correct)
- But there's no "Retry" button to re-send the same prompt
- There's no "Resume" button to continue from where it stopped
- The user must manually type "continue" or re-explain what they want

The continuation analysis skill handles returning users well, but it doesn't specifically detect "generation was interrupted mid-build" vs "user left voluntarily."

**Fix**: After error, show a prominent "Resume Generation" button that re-sends the last user message with context about what was already created.

---

## Layer 3: Model Resolver (model-resolver.ts)

### Gap 8: No Health Check / Provider Status
**File**: `app/(main)/app-builder/lib/model-resolver.ts`
**Severity**: MEDIUM

`resolveModel()` blindly returns a provider instance with no validation:
- Empty API key (`""`) is accepted without warning
- No ping/health check before starting generation
- No provider status tracking (e.g., "Fireworks is down")

**Fix**: Add pre-flight validation: check API key is non-empty, optionally ping provider before starting long generation.

### Gap 9: No Fallback Model Chain Configuration
**File**: `app/(main)/app-builder/lib/model-resolver.ts`
**Severity**: MEDIUM

`MODEL_OPTIONS` lists 7 models but has no concept of fallback order. When the user-selected model fails, there's no automatic way to pick the next best option.

**Fix**: Add a `fallbackModelId` field to `ModelOption` or a separate fallback chain config:
```typescript
const FALLBACK_CHAIN: Record<string, string[]> = {
  "kimi-k2-5-fireworks": ["kimi-k2-5", "claude-sonnet-4-5"],
  "kimi-k2-5": ["kimi-k2-5-fireworks", "claude-sonnet-4-5"],
  "claude-sonnet-4-5": ["claude-opus-4-6", "gpt-4o"],
  // ...
};
```

---

## Layer 4: Continuation & Recovery

### Gap 10: Continuation Analysis Doesn't Detect Interrupted Builds
**File**: `packages/vibexe-engine/src/skills/continuation-analysis.ts`
**Severity**: MEDIUM

The continuation analysis framework checks for:
- TODO/FIXME comments
- Empty function bodies
- Missing features vs Blueprint

But it does NOT check for:
- "App has docs/README.md with 18 files planned but only 8 code files exist" (interrupted build)
- "Chat history ends with an error message" (provider failure)
- Missing `src/App.tsx` (the root file — if this is missing, build was interrupted very early)

**Fix**: Add an "Interrupted Build Detection" section:
1. Compare planned files (from README) vs actual files
2. If < 50% of planned files exist, suggest "Resume build" as top priority
3. If `src/App.tsx` is missing, flag as "Build was interrupted before the root component"

### Gap 11: Wiki Sync Fires Even on Partial Builds
**File**: `app/api/app-builder/chat/route.ts:727-736`
**Severity**: LOW

`syncWiki()` runs in `onFinish` whenever `totalFileCalls > 0`. If the stream fails after creating 3 of 18 files:
- `onFinish` fires with the partial file list
- Wiki generates ARCHITECTURE.md, API-REFERENCE.md etc. based on 3 files
- These wiki docs describe a "complete" architecture that doesn't exist yet
- When user resumes, the wiki context misleads the AI about what's built

**Fix**: Check `event.finishReason` in `onFinish`. Only sync wiki if `finishReason !== "error"` and `finishReason !== "abort"`.

### Gap 12: No Partial Build State Indicator
**File**: Multiple (DB + UI)
**Severity**: MEDIUM

The app record in `builder_apps` has no field to indicate build state. The dashboard shows all apps the same way whether they have 3 files (interrupted) or 30 files (complete). The "Welcome back" card shows continuation suggestions but doesn't flag interrupted builds.

**Fix**: Track generation state per app: `build_status: "planning" | "building" | "complete" | "interrupted"`. Show visual indicator on dashboard cards.

---

## Summary Matrix

| # | Gap | Layer | Severity | Effort | Impact |
|---|-----|-------|----------|--------|--------|
| 1 | No `onError` on `streamText()` | Server | CRITICAL | Low | No server-side error logging for mid-stream failures |
| 2 | Generic error responses | Server | HIGH | Medium | Users can't understand or act on errors |
| 3 | No model fallback | Server | HIGH | Medium | Single point of failure per generation |
| 4 | Minimal `onError` handler | Client | HIGH | Low | Error state not properly cleaned up |
| 5 | Generic error banner | Client | HIGH | Medium | Users don't know what to do |
| 6 | Phase timeline stuck | Client | CRITICAL | Medium | Frozen UI after mid-stream failure |
| 7 | No retry/resume mechanism | Client | HIGH | Medium | Users must manually recover |
| 8 | No provider health check | Resolver | MEDIUM | Low | Starts generation with bad config |
| 9 | No fallback chain | Resolver | MEDIUM | Medium | Can't auto-switch providers |
| 10 | No interrupted build detection | Engine | MEDIUM | Low | Continuation misses interrupted state |
| 11 | Wiki sync on partial builds | Server | LOW | Low | Misleading wiki docs |
| 12 | No build state indicator | DB+UI | MEDIUM | Medium | Dashboard doesn't show interrupted apps |

---

## Recommended Implementation Order

### Phase 1: Critical Fixes (immediate)
1. **Gap 1**: Add `onError` to `streamText()` — 5 lines
2. **Gap 2**: Parse provider errors, return actionable messages — 30 lines
3. **Gap 4**: Enhance `onError` handler to reset all generation state — 10 lines
4. **Gap 6**: Auto-complete phases on error — 15 lines

### Phase 2: Recovery UX (high priority)
5. **Gap 5**: Actionable error card with retry/switch buttons — 40 lines
6. **Gap 7**: Resume Generation button — 30 lines
7. **Gap 11**: Conditional wiki sync — 5 lines

### Phase 3: Resilience (medium priority)
8. **Gap 3**: Model fallback chain — 50 lines
9. **Gap 9**: Fallback chain configuration — 20 lines
10. **Gap 8**: Pre-flight API key validation — 15 lines

### Phase 4: Polish (lower priority)
11. **Gap 10**: Interrupted build detection in continuation — 20 lines
12. **Gap 12**: Build state tracking in DB — 30 lines

**Total estimated new code**: ~270 lines across 6 files

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/api/app-builder/chat/route.ts` | Gaps 1, 2, 3, 11 |
| `app/(main)/app-builder/components/chat-column.tsx` | Gaps 4, 5, 6, 7 |
| `app/(main)/app-builder/lib/model-resolver.ts` | Gaps 8, 9 |
| `packages/vibexe-engine/src/skills/continuation-analysis.ts` | Gap 10 |
| `app/(main)/app-builder/lib/queries.ts` | Gap 12 (build_status field) |
| `app/(main)/app-builder/components/messages.tsx` | Gap 6 (phase error state) |
