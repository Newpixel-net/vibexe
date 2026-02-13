# N8N Full Parity Master Plan

> 13+ Waves, 6-10 phases each. After each wave: push → deploy → verify in browser.
> Final wave: comprehensive end-to-end testing with complex AI Agent workflow.

---

## Wave 1: Undo/Redo System (Critical Safety Feature)

**Goal**: Full undo/redo for all canvas operations with Ctrl+Z / Ctrl+Shift+Z.

| Phase | Description |
|-------|-------------|
| 1.1 | Create `useUndoRedo` Zustand middleware — action history stack with max 50 entries |
| 1.2 | Track node add/delete/move operations as undoable actions |
| 1.3 | Track connection add/delete operations as undoable actions |
| 1.4 | Track node property changes (name, content) as undoable actions |
| 1.5 | Wire Ctrl+Z (undo) and Ctrl+Shift+Z (redo) keyboard shortcuts in `use-keyboard-shortcuts.ts` |
| 1.6 | Add Undo/Redo buttons to editor toolbar with disabled state when stack empty |
| 1.7 | Handle edge cases: undo node delete restores connections, undo during generation blocked |
| 1.8 | Test: create nodes, connect, delete, undo all, redo all — verify round-trip integrity |

**Push → Deploy → Verify**

---

## Wave 2: Rich Context Menu (12+ Options)

**Goal**: Right-click context menu matching N8N's feature set.

| Phase | Description |
|-------|-------------|
| 2.1 | Extend `context-menu/index.tsx` with full menu: Execute Step, Rename, Deactivate, Pin Data, Copy, Duplicate, Delete, Select All, Clear Selection, Tidy Up, Convert to Sub-workflow |
| 2.2 | Implement "Rename" — inline rename via F2 or context menu, focus editable text |
| 2.3 | Implement "Deactivate/Activate" toggle — `D` key + context menu, visual dimming overlay, skip in execution |
| 2.4 | Implement "Pin Data" toggle — `P` key + context menu (placeholder until Wave 4 full implementation) |
| 2.5 | Implement "Execute Step" — runs single node from context menu (already have `useNodeExecute`) |
| 2.6 | Implement "Select All" + "Clear Selection" — Ctrl+A and context menu |
| 2.7 | Add canvas background context menu (right-click on empty space): Add Node, Add Sticky Note, Paste, Select All, Tidy Up, Fit View |
| 2.8 | Style context menu with icons, separators, keyboard shortcut hints |

**Push → Deploy → Verify**

---

## Wave 3: Output Panel — Table/JSON/Schema Views

**Goal**: Per-node output inspection with 3 view modes after execution.

| Phase | Description |
|-------|-------------|
| 3.1 | Create `OutputPanel` component with 3 tabs: Table, JSON, Schema |
| 3.2 | Table view: Render output data as sortable table with columns auto-detected from keys |
| 3.3 | JSON view: Syntax-highlighted JSON viewer with expand/collapse and copy button |
| 3.4 | Schema view: Auto-generate and display data schema (types, nested structure) |
| 3.5 | Item count badge: Show "N items" in output panel header |
| 3.6 | Integrate into properties panel — new "Output" tab alongside Parameters/Settings/Comments |
| 3.7 | Wire to generation results: After execution completes, populate output panel with node's output data |
| 3.8 | Binary data preview: Show image thumbnails and file download links for binary outputs |
| 3.9 | Input panel: Similar 3-view display for incoming data from connected upstream nodes |

**Push → Deploy → Verify**

---

## Wave 4: Data Pinning System

**Goal**: Freeze node output data for iterative development — pin/unpin with `P` key.

| Phase | Description |
|-------|-------------|
| 4.1 | Add `pinnedData` field to node schema in protocol — optional JSON blob stored per-node |
| 4.2 | Pin action: Store current output data as `pinnedData` on node content |
| 4.3 | Unpin action: Clear `pinnedData` from node content |
| 4.4 | Execution integration: When node has pinnedData, skip execution and return pinned data as output |
| 4.5 | Visual indicator: "Pinned" badge on node + banner in output panel showing "This data is pinned" |
| 4.6 | Wire `P` keyboard shortcut and context menu "Pin/Unpin Data" option |
| 4.7 | Persist pinned data with workspace save — pinnedData survives page reload |
| 4.8 | Test: Execute node → pin → modify upstream → re-execute → verify pinned node uses frozen data |

**Push → Deploy → Verify**

---

## Wave 5: Expression Editor with Autocomplete

**Goal**: `{{ }}` expression syntax in parameter fields with autocomplete for upstream data.

| Phase | Description |
|-------|-------------|
| 5.1 | Create `ExpressionEditor` component — text input that detects `{{ }}` and switches to expression mode |
| 5.2 | Variable system: `$json` (current item data), `$input` (input data), `$node["Name"]` (any node's output) |
| 5.3 | Autocomplete dropdown: Show available variables when typing `$` or `{{` |
| 5.4 | Upstream data browser: Panel showing available fields from connected upstream nodes |
| 5.5 | JavaScript expression evaluation: Support full JS expressions inside `{{ }}` |
| 5.6 | Expression preview: Show live evaluated result below expression field |
| 5.7 | Integrate into prompt editors and parameter fields across all node types |
| 5.8 | Built-in helpers: `$now`, `$today`, `$workflow.id`, `$execution.id`, `$vars` |
| 5.9 | Error highlighting: Red underline for invalid expressions with error tooltip |

**Push → Deploy → Verify**

---

## Wave 6: Insert Node on Edge + Snap to Grid + Tidy Up

**Goal**: Drop nodes on connections, snap-to-grid, and auto-arrange.

| Phase | Description |
|-------|-------------|
| 6.1 | Insert on edge: Detect when dragging a node over a connection line |
| 6.2 | Visual feedback: Highlight connection line when node hovers over it |
| 6.3 | On drop: Split connection — source→new_node→target, position node at midpoint |
| 6.4 | Snap to grid: Add 20px grid snap toggle in editor toolbar |
| 6.5 | Grid visualization: Toggle dotted grid background visibility |
| 6.6 | Alignment guides: Show blue guide lines when nodes align horizontally/vertically |
| 6.7 | "Tidy Up" button: Auto-arrange all nodes in a clean left-to-right DAG layout |
| 6.8 | Tidy Up algorithm: Topological sort → layer assignment → minimize edge crossings → position |

**Push → Deploy → Verify**

---

## Wave 7: Partial Execution ("Execute to Here")

**Goal**: Execute a node and all its required predecessors, stopping at the selected node.

| Phase | Description |
|-------|-------------|
| 7.1 | Compute predecessor subgraph: Given target node, find all ancestors via BFS on connections |
| 7.2 | Create partial execution task: Build task with only the predecessor subgraph nodes |
| 7.3 | "Execute to Here" context menu option + hover toolbar button |
| 7.4 | Visual execution path: Highlight nodes that will execute (dim others) before running |
| 7.5 | Execution with pinned data: Skip nodes with pinned data in the predecessor chain |
| 7.6 | Progress indicators: Show running/completed/pending status on each node during partial execution |
| 7.7 | Result display: After partial execution, auto-open output panel of the target node |

**Push → Deploy → Verify**

---

## Wave 8: Sticky Notes + Enhanced Keyboard Shortcuts

**Goal**: Canvas annotations and full keyboard shortcut parity with N8N.

| Phase | Description |
|-------|-------------|
| 8.1 | Create `StickyNote` node type — resizable, colored rectangle with markdown content |
| 8.2 | Sticky note editor: Double-click to edit, supports bold/italic/lists (markdown) |
| 8.3 | Color picker: 6 preset colors for sticky note backgrounds |
| 8.4 | Resize handles: Drag corners/edges to resize sticky notes |
| 8.5 | Z-ordering: Sticky notes render behind regular nodes (lower z-index) |
| 8.6 | `Shift+S` shortcut to create sticky note at cursor position |
| 8.7 | New shortcuts: `D` = deactivate, `P` = pin, `F2` = rename, `Delete` = delete, `Enter` = open properties |
| 8.8 | Shortcut overlay: `?` key shows keyboard shortcuts reference panel |

**Push → Deploy → Verify**

---

## Wave 9: AI Agent Type Variants + Memory Expansion

**Goal**: Multiple AI Agent types and additional memory backends.

| Phase | Description |
|-------|-------------|
| 9.1 | Agent type selector in AI Agent properties: Tools Agent (default), Conversational, Plan & Execute, ReAct, SQL |
| 9.2 | Conversational Agent: Multi-turn within single execution, no tool calling, pure chat |
| 9.3 | Plan & Execute Agent: Two-phase — LLM creates plan, then executes steps sequentially |
| 9.4 | ReAct Agent: Thought → Action → Observation loop with explicit reasoning |
| 9.5 | SQL Agent: Specialized for database queries — schema inspection, query generation, execution |
| 9.6 | PostgreSQL Chat Memory sub-node: Persist conversations in Postgres (use existing DB) |
| 9.7 | Redis Chat Memory sub-node: Memory via Redis key-value store |
| 9.8 | Zep Memory sub-node: Long-term + semantic memory via Zep server |
| 9.9 | Output Parsers: Structured (JSON schema), Auto-fixing (retry on parse fail), Item List |

**Push → Deploy → Verify**

---

## Wave 10: Sub-Workflow + Webhook Response + Custom Variables

**Goal**: Workflow composition, HTTP response control, and reusable variables.

| Phase | Description |
|-------|-------------|
| 10.1 | "Execute Sub-workflow" node: Select another workspace, pass input data, receive output |
| 10.2 | "Execute Sub-workflow Trigger": Entry point in called workflow ("When executed by another workflow") |
| 10.3 | "Respond to Webhook" node: Custom HTTP response (status code, headers, body) for webhook triggers |
| 10.4 | Custom Variables system: Key-value store at team level, accessible via `$vars.keyName` |
| 10.5 | Variables management UI: Settings page for creating/editing/deleting variables |
| 10.6 | Variable precedence: Team-scoped variables override global defaults |
| 10.7 | Wire `$vars` into expression editor autocomplete from Wave 5 |
| 10.8 | "Convert to Sub-workflow" context menu: Extract selected node(s) into a new workspace |

**Push → Deploy → Verify**

---

## Wave 11: Workflow Version History

**Goal**: Save, view, and restore previous workflow versions.

| Phase | Description |
|-------|-------------|
| 11.1 | DB table: `workflow_versions` (id, workspace_id, version_number, snapshot JSON, created_at, created_by) |
| 11.2 | Auto-save version on every manual save (deduplicate if no changes) |
| 11.3 | Version history panel: Sidebar showing version list with timestamps and author |
| 11.4 | Version preview: Click version to see read-only snapshot of that version's canvas |
| 11.5 | Restore version: Button to restore a historical version (creates new version from old snapshot) |
| 11.6 | Version diff: Visual diff showing added/removed/modified nodes between versions |
| 11.7 | Retention policy: Keep last 50 versions per workflow, auto-prune older ones |

**Push → Deploy → Verify**

---

## Wave 12: Additional Data Transform Nodes

**Goal**: Complete the data transformation toolkit matching N8N's core nodes.

| Phase | Description |
|-------|-------------|
| 12.1 | "Aggregate" node: Combine items — sum, average, count, min, max, concatenate by field |
| 12.2 | "Summarize" node: Generate summary statistics (mean, median, mode, percentiles) |
| 12.3 | "Limit" node: Restrict output to first/last N items |
| 12.4 | "Remove Duplicates" node: Deduplicate items by specified key fields |
| 12.5 | "Rename Keys" node: Rename object property keys with mapping table |
| 12.6 | "Split Out" node: Split array field into individual items (flatten) |
| 12.7 | "Compare Datasets" node: Compare two inputs — outputs: In A only, In B only, Same, Different |
| 12.8 | Register all new nodes in node-registry, add to "What happens next?" panel, update AI workflow builder system prompt |

**Push → Deploy → Verify**

---

## Wave 13: Polish + Missing Minor Features

**Goal**: Close remaining minor gaps and polish the overall experience.

| Phase | Description |
|-------|-------------|
| 13.1 | Data mapping drag-and-drop: Drag field from output panel to parameter field to auto-generate expression |
| 13.2 | Node deactivated state: Full visual dimming with strikethrough label, execution skip logic |
| 13.3 | Connection animation: Pulse/flow animation on edges during execution |
| 13.4 | Execution timeline: Node-by-node timing display in run history (duration per node) |
| 13.5 | Workflow tags: Add tagging system for organizing workflows in dashboard |
| 13.6 | Workflow folders: Nested folder hierarchy for workspace organization |
| 13.7 | Template library: Pre-built workflow templates accessible from "New Workflow" dialog |
| 13.8 | Error workflow: Configure a separate workflow that runs when main workflow fails |

**Push → Deploy → Verify**

---

## Wave 14: Comprehensive End-to-End Testing

**Goal**: Build a complex multi-node workflow exercising ALL features, identify bugs and remaining gaps.

| Phase | Description |
|-------|-------------|
| 14.1 | Create complex workflow: Manual Trigger → If → (true) AI Agent with Tools → Loop → Filter → Code → Sort → End |
| 14.2 | Add sub-nodes: Chat Model (grok-4-fast), Memory (window buffer), 2 Tools (HTTP + Slack) |
| 14.3 | Add branching: Switch node with 3 cases after AI Agent output |
| 14.4 | Add data pinning: Pin AI Agent output, verify downstream uses pinned data |
| 14.5 | Test undo/redo: Delete nodes, undo, verify connections restored |
| 14.6 | Test context menu: Right-click every node type, verify all options work |
| 14.7 | Test expression editor: Use `{{ $json.field }}` expressions in Code node and prompts |
| 14.8 | Test output panel: Verify Table/JSON/Schema views on every node's output |
| 14.9 | Test sticky notes: Add annotations explaining workflow sections |
| 14.10 | Execute full workflow end-to-end, verify all nodes complete successfully |
| 14.11 | Document all bugs found, create fix plan |

**Push → Deploy → Verify → Bug Fix Cycle**

---

## Execution Order & Dependencies

```
Wave 1 (Undo/Redo)          ← Foundation — must be first for safe development
Wave 2 (Context Menu)        ← Quick win, high visibility
Wave 3 (Output Panel)        ← Required before Data Pinning
Wave 4 (Data Pinning)        ← Depends on Output Panel (Wave 3)
Wave 5 (Expression Editor)   ← Depends on Output Panel for variable browsing
Wave 6 (Insert on Edge)      ← Independent
Wave 7 (Partial Execution)   ← Depends on Data Pinning (Wave 4)
Wave 8 (Sticky Notes)        ← Independent
Wave 9 (AI Agent Types)      ← Independent
Wave 10 (Sub-workflow)       ← Independent
Wave 11 (Version History)    ← Independent
Wave 12 (Data Transform)     ← Independent
Wave 13 (Polish)             ← After all major features
Wave 14 (Testing)            ← After everything
```

## Deploy Process (Per Wave)

```bash
# Local: commit and push
git add -A && git commit -m "Wave N: <description>" && git push origin main

# Server (WHM Terminal):
source /home/vibexe/.nvm/nvm.sh && nvm use 24
cd /opt/giselle
git fetch vibexe && git reset --hard vibexe/main
pnpm build-sdk && pnpm --filter studio.giselles.ai build
pm2 flush giselle && pm2 restart giselle

# Verify: Open vibexe.online in browser, test wave features
```

---

## Total Scope

- **14 waves** × ~8 phases each = **~110 implementation phases**
- **Estimated files touched**: 80-120 new/modified files
- **New node types**: ~10 (sticky note, aggregate, summarize, limit, remove-duplicates, rename-keys, split-out, compare-datasets, sub-workflow, webhook-response)
- **New UI components**: ~15 (expression editor, output panel, version history, variable manager, etc.)
- **New DB tables**: ~3 (workflow_versions, custom_variables, pinned_data)
