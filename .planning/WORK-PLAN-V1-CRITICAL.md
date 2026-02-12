# Work Plan V1: CRITICAL Gaps (Tier 1)

**Date**: 2026-02-12
**Updated**: 2026-02-12
**Priority**: CRITICAL — Blocks real workflow building
**Gaps Covered**: 4 gaps from N8N Gap Analysis Tier 1
**Status**: ALL 4 GAPS COMPLETE

---

## Completion Summary (2026-02-12)

| Gap | Status | Notes |
|-----|--------|-------|
| GAP 1: Wire DAG Executor | COMPLETE | DAG detection, executeDag(), branch skipping, structured data all wired |
| GAP 2: Data Transform Execution | COMPLETE | All 4 handlers (code/filter/editFields/sort) dispatched from DAG executor |
| GAP 3: Expression System | BACKEND COMPLETE | Field access, system vars, condition evaluation all work. UI ExpressionInput component NOT YET BUILT |
| GAP 4: Error Handling | COMPLETE | NodeSettingsTab + PanelTabs on all operation nodes, retry logic in DAG executor |

**Remaining from V1**: ExpressionInput UI component (Step 3.4-3.6) — the `fx` toggle for switching between fixed values and expression mode on parameter fields.

---

## Current State Assessment

After codebase exploration, the foundation is significantly more complete than expected:

| Component | Status | What Exists |
|-----------|--------|-------------|
| Protocol schemas (10 node types) | COMPLETE | All Zod schemas in `packages/protocol/src/node/operations/` |
| Properties panels (10 nodes) | COMPLETE | `FlowControlPropertiesPanel` dispatcher with all 10 sub-panels |
| Node factories | COMPLETE | All nodes can be created on canvas |
| DAG executor | EXISTS | `packages/giselle/src/tasks/dag-executor.ts` with `DagNode`, `DagNodeResult` types |
| Flow control handlers | ALL 10 EXIST | `packages/giselle/src/flow-control/execute-*.ts` |
| Expression evaluator | EXISTS | `packages/giselle/src/expressions/evaluate.ts` |
| ErrorConfig | EXISTS | In `operation-node.ts` with retry, maxRetries, retryDelay, onError |
| StructuredDataOutput | EXISTS | In `packages/protocol/src/generation/output.ts` |
| Task DAG fields | EXISTS | `useDagExecution`, `dagNodeGenerationMap` on Task protocol |
| 3-Panel Layout | EXISTS | `three-panel-layout.tsx` using `react-resizable-panels` |

**The real gap is WIRING** — the pieces exist but aren't connected end-to-end.

---

## GAP 1: Flow Control Node Execution (Wire DAG Executor)

### Problem
10 flow control node types have schemas, UI panels, and execution handlers, but the DAG executor isn't connected to the main task execution pipeline. Selecting an If/Switch node on canvas shows a properties panel, but running the workflow skips these nodes entirely.

### Current Execution Flow
```
UI "Run" button
  → createAndStartTaskAction()
  → create-task.ts: buildLevels() → level-based sequential execution
  → Each level: fire all nodes in parallel
  → GenerationRunner.tsx: flow control cases return null (lines 65-76)
```

### Target Execution Flow
```
UI "Run" button
  → createAndStartTaskAction()
  → create-task.ts: detect flow control nodes → set useDagExecution=true
  → run-task.ts: if useDagExecution → executeDag() instead of executeSequential()
  → DAG executor: fire root nodes → propagate outputs → evaluate conditions → skip/fire branches
  → GenerationRunner.tsx: flow control nodes handled server-side (still return null on client)
```

### Implementation Steps

#### Step 1.1: Wire DAG detection in create-task.ts
**File**: `packages/giselle/src/tasks/create-task.ts`
- Find where `buildLevels()` is called
- Before building levels, scan nodes for flow control types: `if`, `switch`, `merge`, `loop`, `code`, `filter`, `editFields`, `sort`, `wait`, `errorTrigger`
- If any found: set `task.useDagExecution = true`
- Build DAG node map: `dagNodeGenerationMap` mapping nodeId → generationId for each flow control node
- Still call `buildLevels()` for backward compatibility, but mark the task for DAG execution

#### Step 1.2: Add executeDag() to run-task.ts
**File**: `packages/giselle/src/tasks/run-task.ts`
- This file already imports all 10 `execute*` handlers
- Add a branch: if `task.useDagExecution === true` → call `executeDag()`
- `executeDag()` builds the DAG from task sequences/connections
- For each DAG node:
  - If it's a generation node (textGen, imageGen, etc.): create generation context, fire existing execution
  - If it's a flow control node: call the appropriate `execute*` handler
  - Propagate outputs to downstream nodes via `DagNodeResult.outputs` Map

#### Step 1.3: Connect DAG executor to generation system
**File**: `packages/giselle/src/tasks/dag-executor.ts`
- The DAG executor needs to:
  1. Resolve inputs for each node by collecting upstream `DagNodeResult.outputs`
  2. For generation nodes: create `GenerationContext` with resolved inputs, call existing `executeQuery`/`generateContent`/`executeIntegration`
  3. For flow control nodes: call `executeIf`/`executeSwitch`/etc. directly
  4. After node completion: check which downstream nodes are now ready (all required inputs satisfied)
  5. Fire ready nodes (event-driven, not level-based)

#### Step 1.4: Handle branch skipping
**File**: `packages/giselle/src/tasks/dag-executor.ts`
- When If node evaluates to `true`: fire `true` branch, skip `false` branch
- Skip means: mark node + all exclusive descendants as `skipped` state
- "Exclusive descendants" = nodes reachable ONLY through the skipped branch, not through any active branch
- Merge node with mode `chooseBranch`: waits for first active branch, ignores skipped branches

#### Step 1.5: Structured data passthrough
**File**: `packages/giselle/src/tasks/dag-executor.ts`
- Flow control nodes output `StructuredDataOutput` (type: "structured-data")
- The DAG executor stores outputs in a `Map<NodeId, Map<OutputPortName, unknown>>`
- When a downstream node needs input, resolve `{{nodeId:outputId}}` from this map
- For field-level access (Phase 2 expression system): `{{nodeId:outputId.field}}` uses dot-notation navigation

### Files Modified (Gap 1)

| File | Action | Lines Changed |
|------|--------|---------------|
| `packages/giselle/src/tasks/create-task.ts` | Modify | ~30 lines — DAG detection |
| `packages/giselle/src/tasks/run-task.ts` | Modify | ~50 lines — executeDag branch |
| `packages/giselle/src/tasks/dag-executor.ts` | Modify | ~200 lines — connect to generation system |
| `packages/giselle/src/tasks/shared/task-execution-utils.ts` | Modify | ~20 lines — DAG state transitions |

### Verification
- Create workflow: TextGen → If (check for "positive") → true: Slack "thanks" / false: Slack "escalate"
- Run workflow → verify If node evaluates → only one Slack integration fires
- Verify skipped branch shows as "skipped" status (not "failed" or "running")

---

## GAP 2: Data Transformation Node Execution

### Problem
Code, Filter, EditFields, Sort nodes have schemas and UI panels but no execution wiring. They need to process structured data (arrays/objects) and output structured data.

### Current State
- All 4 execution handlers exist in `packages/giselle/src/flow-control/`:
  - `execute-code.ts` — runs JS in sandboxed context
  - `execute-filter.ts` — filters array items by conditions
  - `execute-edit-fields.ts` — set/remove/rename fields
  - `execute-sort.ts` — multi-key sort
- These handlers take `DagNode` + `inputData: Map<string, unknown>` and return `DagNodeResult`
- They are NOT called from anywhere yet (only imported in `run-task.ts`)

### Implementation Steps

#### Step 2.1: Wire data transform handlers into DAG executor
**File**: `packages/giselle/src/tasks/dag-executor.ts`
- In the node execution dispatcher, add cases for `code`, `filter`, `editFields`, `sort`
- Each case: collect upstream outputs → call handler → store result in DAG output map
- Data transform nodes always emit `StructuredDataOutput`

#### Step 2.2: Code node sandboxing
**File**: `packages/giselle/src/flow-control/execute-code.ts`
- Verify the sandbox uses Node.js `vm` module (or `vm2` for better isolation)
- Input: `items` variable (array from upstream), `data` object (merged upstream outputs)
- Timeout: configurable per-node (default 10s from schema)
- No network access, no filesystem access
- Return value becomes `StructuredDataOutput.data`

#### Step 2.3: Filter node condition evaluation
**File**: `packages/giselle/src/flow-control/execute-filter.ts`
- Uses `evaluateConditionGroup()` from `expressions/evaluate.ts` (same as If/Switch)
- Input: array of items
- For each item: evaluate condition group against item fields
- Output: `{ kept: [...], discarded: [...] }` or just kept items based on output port

#### Step 2.4: EditFields node field operations
**File**: `packages/giselle/src/flow-control/execute-edit-fields.ts`
- Input: object or array of objects
- For each operation in `operations` array:
  - `set`: add/update field with value (support expression evaluation in value)
  - `remove`: delete field
  - `rename`: rename field key
- If `keepOnlySet=true`: output only fields that were explicitly set
- Output: modified data as `StructuredDataOutput`

#### Step 2.5: Sort node multi-key sorting
**File**: `packages/giselle/src/flow-control/execute-sort.ts`
- Input: array
- Sort by `sortKeys` in order (primary, secondary, etc.)
- Each key: `{ field, direction: "asc"|"desc" }`
- Handle mixed types gracefully (string comparison for non-numeric)
- Output: sorted array as `StructuredDataOutput`

### Files Modified (Gap 2)

| File | Action | Lines Changed |
|------|--------|---------------|
| `packages/giselle/src/tasks/dag-executor.ts` | Modify | ~40 lines — data transform dispatch |
| `packages/giselle/src/flow-control/execute-code.ts` | Verify/Fix | ~20 lines — sandbox + input resolution |
| `packages/giselle/src/flow-control/execute-filter.ts` | Verify/Fix | ~10 lines — condition evaluation |
| `packages/giselle/src/flow-control/execute-edit-fields.ts` | Verify/Fix | ~10 lines — field operations |
| `packages/giselle/src/flow-control/execute-sort.ts` | Verify/Fix | ~10 lines — multi-key sort |

### Verification
- HTTP Integration → Filter (status=200) → EditFields (extract name) → Sort (by date) → Slack
- Code node: `return items.map(item => ({ ...item, processed: true }))`
- Verify data flows correctly between nodes with correct types

---

## GAP 3: Expression System (Dynamic Data Mapping)

### Problem
Currently only `{{nodeId:outputId}}` references work, and only in TipTap prompt fields. Users can't:
- Reference specific fields from upstream structured data
- Use system variables like `$now`, `$execution.id`
- Toggle between static values and expressions in node config fields
- See expression previews

### Current State
- `packages/giselle/src/expressions/evaluate.ts` exists with `evaluateConditionGroup()` used by If/Switch
- `{{nodeId:outputId}}` pattern resolution exists in `resolveQuery()`, `buildGenerationMessageForContentGeneration()`, and other resolvers
- NO field-level access (`{{nodeId:outputId.field}}`)
- NO system variables
- NO UI expression toggle on parameter fields

### Implementation Steps

#### Step 3.1: Extend expression evaluator for field access
**File**: `packages/giselle/src/expressions/evaluate.ts`

Add new expression syntax:
```
{{nodeId:outputId}}           — full output (existing)
{{nodeId:outputId.field}}     — field access from structured data
{{nodeId:outputId.field.sub}} — nested field access
{{nodeId:outputId.arr[0]}}    — array index access
{{$now}}                      — ISO timestamp
{{$today}}                    — ISO date (no time)
{{$execution.id}}             — current task ID
{{$execution.startedAt}}      — task start timestamp
```

Implementation:
- Parse expression with regex: `\{\{([^}]+)\}\}`
- If starts with `$`: resolve system variable
- If contains `.` after outputId: navigate JSON path
- Safe navigation only — return `undefined` for missing paths, NO eval()

#### Step 3.2: Wire expression resolution into DAG executor
**File**: `packages/giselle/src/tasks/dag-executor.ts`

When preparing inputs for a node:
1. Collect all upstream outputs in a resolution context
2. For each input port value, check for `{{...}}` patterns
3. Resolve each pattern using the extended evaluator
4. Pass resolved values to the node handler

#### Step 3.3: Wire expression resolution into existing generation resolvers
**Files**:
- `packages/giselle/src/generations/utils.ts` — `buildGenerationMessageForContentGeneration()`
- `packages/giselle/src/operations/execute-query.ts` — `resolveQuery()`
- Other resolvers that handle `{{nodeId:outputId}}` pattern

Extend the existing `{{nodeId:outputId}}` pattern matching:
- After matching `{{nd-XXX:otp-XXX}}`, check for additional `.field.sub` suffix
- If found: resolve the generation output, then navigate the JSON path
- Backward compatible — existing `{{nodeId:outputId}}` continues to return full output

#### Step 3.4: Create ExpressionInput UI component
**New file**: `internal-packages/workflow-designer-ui/src/editor/properties-panel/ui/expression-input.tsx`

Component that provides Fixed/Expression toggle on any parameter field:
- **Fixed mode** (default): Normal text input, number input, or dropdown
- **Expression mode**: Text input with `{{ }}` syntax, monospace font, autocomplete for node references
- Toggle button: small "fx" icon that switches between modes
- In expression mode: show resolved preview value below the input (dimmed text)

Props:
```typescript
interface ExpressionInputProps {
  value: string;
  onChange: (value: string) => void;
  mode: "fixed" | "expression";
  onModeChange: (mode: "fixed" | "expression") => void;
  type?: "text" | "number" | "select";
  options?: { label: string; value: string }[]; // for select type
  placeholder?: string;
  // For expression preview:
  availableNodes?: { id: string; name: string; outputs: { id: string; accessor: string }[] }[];
}
```

#### Step 3.5: Apply ExpressionInput to flow control panels
**Files**:
- `internal-packages/workflow-designer-ui/src/editor/properties-panel/flow-control-properties-panel/` (all sub-panels)

Replace static text inputs with `ExpressionInput` in:
- If/Switch/Filter condition `field` and `value` inputs
- EditFields `value` input (for `set` operation)
- Code node — no change needed (code is already an expression)
- Integration node config fields — enable expression mode on all text parameters

#### Step 3.6: Add expression autocomplete for node references
**New file**: `internal-packages/workflow-designer-ui/src/editor/properties-panel/ui/expression-autocomplete.tsx`

When typing `{{` in expression mode:
- Show dropdown of available upstream nodes (connected via inputs)
- After selecting a node, show its output ports
- After selecting an output port, show `.` to start field navigation
- If upstream node has structured output, show available fields

### Files Modified (Gap 3)

| File | Action | Lines Changed |
|------|--------|---------------|
| `packages/giselle/src/expressions/evaluate.ts` | Modify | ~80 lines — field access, system vars |
| `packages/giselle/src/tasks/dag-executor.ts` | Modify | ~30 lines — expression resolution in DAG |
| `packages/giselle/src/generations/utils.ts` | Modify | ~20 lines — field access in generation resolver |
| `packages/giselle/src/operations/execute-query.ts` | Modify | ~15 lines — field access in query resolver |
| `expression-input.tsx` | **New** | ~150 lines |
| `expression-autocomplete.tsx` | **New** | ~120 lines |
| Flow control panel files (6 files) | Modify | ~20 lines each — replace inputs with ExpressionInput |

### Verification
- Create workflow: HTTP Integration → If (check `{{httpNode:result.status}} equals 200`)
- Verify expression preview shows resolved value
- Test `{{$now}}` in a text generation prompt
- Test field access: `{{aiAgent:output.sentiment}}` when AI Agent outputs structured JSON

---

## GAP 4: Per-Node Error Handling (Settings Tab UI)

### Problem
ErrorConfig exists in the protocol schema (retryOnFail, maxRetries, retryDelay, onError) but there is NO UI to configure it. When a node fails, the workflow crashes silently with no retry or recovery option.

### Current State
- `ErrorConfig` schema in `packages/protocol/src/node/operations/operation-node.ts`:
  ```
  retryOnFail: boolean (default false)
  maxRetries: number (default 3, 0-10)
  retryDelay: number (default 1000ms)
  onError: "stopWorkflow" | "continueOnFail" | "routeToError"
  ```
- NO UI to set these values
- DAG executor doesn't check `errorConfig` during execution
- ErrorTrigger node exists but isn't triggered on errors

### Implementation Steps

#### Step 4.1: Create NodeSettingsTab component
**New file**: `internal-packages/workflow-designer-ui/src/editor/properties-panel/ui/node-settings-tab.tsx`

A reusable "Settings" tab for every node's properties panel:
```
┌─ Settings ────────────────────────┐
│                                   │
│  Error Handling                   │
│  ─────────────                    │
│  Retry On Fail    [toggle: OFF]   │
│  Max Retries      [number: 3]     │
│  Retry Delay      [number: 1000ms]│
│                                   │
│  On Error         [dropdown]      │
│    ○ Stop Workflow                 │
│    ○ Continue On Fail              │
│    ○ Route To Error Handler        │
│                                   │
│  Node Info                        │
│  ─────────                        │
│  Notes            [textarea]      │
│  Show Note on Canvas [toggle]     │
│  Node Version     v1              │
│                                   │
└───────────────────────────────────┘
```

Components used: `SettingLabel`, `Toggle`, `Select`, `NumberInput` from existing UI library.

When "Retry On Fail" is OFF: hide Max Retries and Retry Delay fields.
When "On Error" is "Route To Error Handler": show info text about connecting to ErrorTrigger node.

#### Step 4.2: Add Parameters/Settings tab switcher to all node panels
**File**: `internal-packages/workflow-designer-ui/src/editor/properties-panel/ui/properties-panel.tsx`

Add a tab bar to `PropertiesPanelContent`:
```typescript
function PanelTabs({ activeTab, onTabChange }: { activeTab: "parameters" | "settings"; onTabChange: (tab: string) => void }) {
  return (
    <div className="flex border-b border-border-muted">
      <TabButton active={activeTab === "parameters"} onClick={() => onTabChange("parameters")}>Parameters</TabButton>
      <TabButton active={activeTab === "settings"} onClick={() => onTabChange("settings")}>Settings</TabButton>
    </div>
  );
}
```

#### Step 4.3: Integrate Settings tab into all operation node panels
**Files**: Every properties panel component that renders operation nodes

For generation nodes (TextGen, ImageGen, ContentGen, AiAgent, Integration, DataQuery, Query):
- The 3-panel layout already has a center "Parameters" panel
- Add tab switcher at the top of the center panel
- "Parameters" tab: existing content
- "Settings" tab: `NodeSettingsTab` component

For flow control nodes (If, Switch, Merge, Loop, Code, Filter, EditFields, Sort, Wait, ErrorTrigger):
- The single-column panel shows parameters directly
- Add tab switcher below the header
- "Parameters" tab: existing flow control panel content
- "Settings" tab: `NodeSettingsTab` component

#### Step 4.4: Wire error handling to store
**File**: `internal-packages/workflow-designer-ui/src/editor/app-designer/use-update-node-data-content.ts` (or similar)

When user changes ErrorConfig in Settings tab:
- Update the node's `errorConfig` field in the workspace store
- This gets persisted and included in the generation context when the workflow runs

#### Step 4.5: Implement retry logic in DAG executor
**File**: `packages/giselle/src/tasks/dag-executor.ts`

When a node fails:
1. Check `errorConfig.retryOnFail`
2. If true: retry up to `errorConfig.maxRetries` times with `errorConfig.retryDelay` ms between
3. If still failing after retries, check `errorConfig.onError`:
   - `"stopWorkflow"`: Mark task as failed, stop all execution
   - `"continueOnFail"`: Set node output to `null`/empty, continue firing downstream nodes
   - `"routeToError"`: Find connected ErrorTrigger node, fire it with error context

#### Step 4.6: Connect ErrorTrigger node
**File**: `packages/giselle/src/flow-control/execute-error-trigger.ts`

Already implemented — receives `errorMessage`, `failedNodeId`, `failedNodeName`, `timestamp` from input data and outputs them. The DAG executor needs to route to this node when `onError === "routeToError"`.

### Files Modified (Gap 4)

| File | Action | Lines Changed |
|------|--------|---------------|
| `node-settings-tab.tsx` | **New** | ~200 lines |
| `properties-panel.tsx` | Modify | ~40 lines — tab switcher |
| `packages/giselle/src/tasks/dag-executor.ts` | Modify | ~60 lines — retry + error routing |
| ~15 properties panel files | Modify | ~10 lines each — integrate Settings tab |

### Verification
- Add a node that intentionally fails (HTTP to invalid URL)
- Enable "Retry On Fail" with 3 retries, 2s delay → verify 3 retry attempts in logs
- Set "On Error: Continue On Fail" → verify downstream nodes still execute with null input
- Set "On Error: Route To Error Handler" → connect ErrorTrigger → Slack → verify error message sent

---

## Implementation Order

```
Week 1: GAP 1 — Wire DAG executor (foundation for everything)
  ├── Step 1.1: DAG detection in create-task.ts
  ├── Step 1.2: executeDag() in run-task.ts
  ├── Step 1.3: Connect DAG executor to generation system
  ├── Step 1.4: Branch skipping
  └── Step 1.5: Structured data passthrough

Week 2: GAP 2 — Data transform execution (depends on DAG)
  ├── Step 2.1: Wire data transform handlers
  ├── Step 2.2-2.5: Verify/fix each handler
  └── Integration testing with real workflows

Week 3: GAP 4 — Error handling (depends on DAG)
  ├── Step 4.1: NodeSettingsTab component
  ├── Step 4.2-4.3: Tab switcher integration
  ├── Step 4.4: Wire to store
  └── Step 4.5-4.6: Retry logic + ErrorTrigger routing

Week 4: GAP 3 — Expression system (can parallelize with Week 3)
  ├── Step 3.1: Extend expression evaluator
  ├── Step 3.2-3.3: Wire into DAG + generation resolvers
  ├── Step 3.4-3.5: ExpressionInput component
  └── Step 3.6: Expression autocomplete
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| DAG executor breaks existing workflows | HIGH | Dual path: useDagExecution=false → existing buildLevels() unchanged |
| Expression evaluation injection | HIGH | Safe JSON navigation only, NO eval(), sandboxed Code node via vm |
| Loop infinite execution | MEDIUM | maxIterations default 100, configurable safety limit |
| Error retry storms | MEDIUM | Max 10 retries, exponential backoff option, circuit breaker |
| Large structured data | LOW | No size limits in protocol, but add warning for >1MB outputs |

---

## Total Effort Summary

| Gap | New Files | Modified Files | Est. Lines |
|-----|-----------|----------------|------------|
| 1. DAG Wiring | 0 | 4 | ~300 |
| 2. Data Transform | 0 | 5 | ~90 |
| 3. Expression System | 2 | ~12 | ~535 |
| 4. Error Handling | 1 | ~17 | ~400 |
| **TOTAL** | **3** | **~38** | **~1,325** |
