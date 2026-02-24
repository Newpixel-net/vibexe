# Work Plan V4: MINOR Gaps (Tier 4)

**Date**: 2026-02-12
**Priority**: MINOR — Polish & UX improvements
**Gaps Covered**: 8+ items from N8N Gap Analysis Tier 4
**Depends On**: Work Plans V1-V3

---

## GAP 17: Sticky Notes on Canvas

### Problem
N8N supports canvas sticky notes with markdown, color picker, double-click to edit. Vibexe has no way to annotate workflows.

### Implementation
- Add `StickyNote` as a non-node canvas entity
- Fields: `text` (markdown), `color` (preset palette), `position`, `size`
- Render as colored rectangle with rendered markdown
- Double-click to edit inline
- Drag to move, resize handles on corners
- Store in workspace state alongside nodes/connections

### Effort: LOW (~200 lines)

---

## GAP 18: Node Versioning Display

### Problem
N8N shows "version 3.1 (Latest)" at the bottom of every node's Settings tab. Vibexe has no version display.

### Implementation
- Each node type already has a `version` field in some schemas (e.g., AiAgent has `version: "v1"`)
- Add version display to the `NodeSettingsTab` component (from V1 Gap 4)
- Show at bottom of Settings tab: "Node Version: v1"
- Future: Support version migration when schemas change

### Effort: VERY LOW (~20 lines)

---

## GAP 19: Per-Node Feedback Button

### Problem
N8N has "I wish this node would..." feedback button per node. Good for collecting user needs.

### Implementation
- Add small feedback icon to `NodePanelHeader`
- On click: open modal with textarea + node type context
- Submit sends to internal feedback endpoint
- Store in DB table `node_feedback(id, workspace_id, node_type, message, created_at)`
- Admin view to review feedback

### Effort: LOW (~150 lines)

---

## GAP 20: Python Support in Code Node

### Problem
N8N Code node supports JavaScript and Python. Vibexe is JavaScript-only.

### Current State
- `CodeNodeContent.language` field exists but only `"javascript"` is allowed
- `execute-code.ts` uses Node.js `vm` module for JS execution

### Implementation
- Add `"python"` to the language enum in `code-node.ts`
- Python execution options:
  1. **Pyodide** (WebAssembly Python runtime) — runs in-process, no external deps
  2. **Child process** — spawn Python interpreter on server
  3. **Docker container** — isolated Python execution (safest)
- Recommendation: Start with **child process** (simplest), upgrade to Docker for production
- CodePanel UI: Add language dropdown (JavaScript / Python)
- Syntax highlighting: Update code editor to detect language

### Effort: MEDIUM (~300 lines)
### Risk: Server must have Python installed; sandboxing concerns

---

## GAP 21: Ask AI Tab in Code Node

### Problem
N8N Code node has "Code" and "Ask AI" tabs. Users describe what they want in natural language, AI generates code.

### Implementation
- Add "Ask AI" tab to Code node properties panel
- Textarea for natural language description
- "Generate Code" button → calls LLM with context:
  - User's description
  - Input data schema (from upstream nodes)
  - Expected output format
  - Available variables (`items`, `data`)
- Generated code appears in Code tab for review/editing
- Uses the team's configured AI model (or default GPT-4o)

### Effort: MEDIUM (~250 lines)
### Dependencies: AI model API keys configured

---

## GAP 22: Node Naming (Custom Per-Node Names)

### Problem
N8N allows renaming every node (e.g., "AI Agent1" → "Sentiment Checker"). Vibexe shows type-based names only.

### Current State
- `PropertiesPanelHeader` already has `EditableText` component with `onChangeName` callback
- `defaultName(node)` function returns type-based names
- The naming infrastructure EXISTS — need to verify it works end-to-end

### Implementation
- Verify `onChangeName` persists to workspace state
- Canvas node labels should show custom name if set, type name otherwise
- AI Workflow Builder should respect custom names in the node roster
- Expression autocomplete should show custom names

### Effort: VERY LOW (~30 lines to verify/fix)

---

## GAP 23: Rename Output on Switch Rules

### Problem
N8N Switch rules have "Rename Output" toggle for naming output ports (e.g., "High Priority" instead of "Output 0").

### Current State
- SwitchRule schema has `outputPortName: string` field
- SwitchPanel UI shows rule name and output port name
- Port names are already configurable

### Implementation
- Verify port names display correctly on canvas edges
- Add tooltip on canvas showing port name when hovering over Switch output connections

### Effort: VERY LOW (~20 lines)

---

## GAP 24: Drag-to-Reorder Rules

### Problem
N8N Switch routing rules have drag handles for reordering. Rules are evaluated top-to-bottom, first match wins.

### Implementation
- Add drag handles to Switch and Filter rule lists
- Use `@dnd-kit/sortable` or similar React DnD library
- On reorder: update the `rules` array order in the store
- Visual: grip icon on left side of each rule row

### Effort: LOW (~100 lines)

---

## GAP 25: Command Palette

### Problem
N8N has "Open command palette" for quick search across nodes, actions, settings.

### Implementation
- `Cmd+K` / `Ctrl+K` keyboard shortcut
- Opens modal with search input
- Search across: node types (to add), existing nodes (to select), settings, recent actions
- Results grouped by category
- Enter to execute action (add node, navigate to node, open settings)

### Effort: MEDIUM (~300 lines)

---

## GAP 26: HTTP Request Node (Native)

### Problem
Vibexe relies on Activepieces HTTP piece for HTTP requests. A native HTTP node would be simpler.

### Current State
- HTTP piece from Activepieces works and is tested
- It requires integration node setup (piece name, action name, config)

### Implementation
- This is already effectively solved by the Activepieces HTTP piece
- Consider creating a shortcut: when user adds "HTTP Request" from node picker, auto-configure an Integration node with `pieceName: "@activepieces/piece-http"` and `actionName: "send_request"`
- No new node type needed

### Effort: VERY LOW (~30 lines — just a node picker alias)

---

## GAP 27: Batch Processing

### Problem
N8N supports batch execution (process N items at a time). Useful for rate-limited APIs.

### Implementation
- Add `batchSize` field to Loop node:
  ```typescript
  batchSize: number; // default: 1 (process one at a time)
  batchDelay: number; // ms between batches
  ```
- Loop executor processes `batchSize` items per iteration
- Add delay between batches to respect rate limits

### Effort: LOW (~80 lines)

---

## GAP 28: Return Intermediate Steps (Agent Reasoning)

### Problem
N8N can show the AI agent's reasoning chain (intermediate tool calls, thought process). Vibexe shows final output only.

### Current State
- `ReasoningOutput` type exists in `output.ts` (type: "reasoning", content: string)
- Some models (grok-3-mini) already produce reasoning output
- "Thinking Process" button exists for reasoning-capable models

### Implementation
- For AI Agent multi-step execution: capture each tool call + result as intermediate steps
- Store as array of `{ step: number, action: string, input: object, output: object }`
- Display in output panel as expandable step list
- Each step shows: tool name, input parameters, output result, duration

### Effort: MEDIUM (~200 lines)
### Dependencies: AI Agent execution with tool use

---

## GAP 29: Node Deactivate (Skip Without Removing)

### Problem
N8N has a "Deactivate" button on every node hover. Disabled nodes are skipped during execution but remain on canvas (visually dimmed).

### Implementation
- Add `disabled: boolean` field to `NodeBase` (or `OperationNode`)
- Canvas rendering: dimmed opacity (0.4) + strikethrough label for disabled nodes
- DAG executor: skip disabled nodes (treat as if they don't exist)
- Hover control: toggle button (play/pause icon)
- Useful for debugging: temporarily remove a node from execution without deleting it

### Effort: LOW (~100 lines)

---

## GAP 30: Mock Data / Test Data

### Problem
N8N Output panel offers "set mock data" so users can define what a node pretends to output, letting them build downstream nodes before upstream is ready.

### Implementation
- Add "Set Mock Data" button to OutputPanel
- On click: open JSON editor
- User enters mock output JSON
- When mock data is set: downstream nodes resolve `{{nodeId:outputId}}` from mock instead of real execution
- Visual indicator: "MOCK" badge on the node when mock data is active
- Mock data persists in workspace state

### Effort: MEDIUM (~200 lines)
### Dependencies: V1 Gap 3 (Expression system must resolve from mock data)

---

## GAP 31: Logs Panel

### Problem
N8N has a bottom "Logs" panel showing execution logs. Vibexe errors only visible in browser console.

### Implementation
- Add collapsible bottom panel to the editor layout
- Toggle via footer button "Logs" (next to existing "Run History")
- Show structured log entries: timestamp, level (info/warn/error), node name, message
- During execution: real-time log streaming
- Log sources: node execution events, expression evaluation warnings, API errors
- "Pop out" button to open in separate window

### Effort: MEDIUM (~300 lines)

---

## Implementation Order

```
Quick Wins (< 1 hour each):
  ├── GAP 18: Node Versioning Display (~20 lines)
  ├── GAP 22: Node Naming verification (~30 lines)
  ├── GAP 23: Switch Output Rename verification (~20 lines)
  └── GAP 26: HTTP Node alias (~30 lines)

Easy (1-2 hours each):
  ├── GAP 17: Sticky Notes (~200 lines)
  ├── GAP 19: Feedback Button (~150 lines)
  ├── GAP 24: Drag-to-Reorder (~100 lines)
  ├── GAP 27: Batch Processing (~80 lines)
  └── GAP 29: Node Deactivate (~100 lines)

Medium (half-day each):
  ├── GAP 21: Ask AI in Code Node (~250 lines)
  ├── GAP 25: Command Palette (~300 lines)
  ├── GAP 28: Intermediate Steps (~200 lines)
  ├── GAP 30: Mock Data (~200 lines)
  └── GAP 31: Logs Panel (~300 lines)

Larger (1+ day):
  └── GAP 20: Python in Code Node (~300 lines + server setup)
```

---

## Total Effort Summary

| Gap | Effort | Est. Lines |
|-----|--------|------------|
| 17. Sticky Notes | LOW | ~200 |
| 18. Node Versioning | VERY LOW | ~20 |
| 19. Feedback Button | LOW | ~150 |
| 20. Python Support | MEDIUM | ~300 |
| 21. Ask AI in Code | MEDIUM | ~250 |
| 22. Node Naming | VERY LOW | ~30 |
| 23. Rename Output | VERY LOW | ~20 |
| 24. Drag-to-Reorder | LOW | ~100 |
| 25. Command Palette | MEDIUM | ~300 |
| 26. HTTP Node Alias | VERY LOW | ~30 |
| 27. Batch Processing | LOW | ~80 |
| 28. Intermediate Steps | MEDIUM | ~200 |
| 29. Node Deactivate | LOW | ~100 |
| 30. Mock Data | MEDIUM | ~200 |
| 31. Logs Panel | MEDIUM | ~300 |
| **TOTAL** | | **~2,280** |

---

## Cross-Plan Summary: All 31 Gaps

| Plan | Tier | Gaps | New Lines | Depends On |
|------|------|------|-----------|-----------|
| V1 CRITICAL | 1 | 4 gaps (DAG wiring, Data Transform, Expressions, Error Handling) | ~1,325 | None |
| V2 HIGH | 2 | 6 gaps (Sub-Nodes, AI Chains, RAG, History, Multi-Trigger, 3-Panel) | ~3,600 | V1 |
| V3 MODERATE | 3 | 6 gaps (Guardrails, Fallback, Forms, Events, Data Table, MCP Server) | ~2,800 | V1, V2 |
| V4 MINOR | 4 | 15 gaps (Polish, UX, Developer Experience) | ~2,280 | V1-V3 |
| **GRAND TOTAL** | | **31 gaps** | **~10,005 lines** | |

### Overall Assessment After Plans
- **Vibexe current**: ~40% N8N feature parity
- **After V1 (CRITICAL)**: ~60% parity — workflows actually work with branching and data transforms
- **After V2 (HIGH)**: ~75% parity — execution visibility, AI chains, sub-nodes
- **After V3 (MODERATE)**: ~85% parity — production features, forms, event triggers
- **After V4 (MINOR)**: ~95% parity — full UX polish

### Unique Vibexe Advantages Over N8N
Even at 95% parity, Vibexe will have features N8N lacks:
1. **AI Workflow Builder** — natural language to workflow (N8N doesn't have this)
2. **Chat Trigger Widget** — embeddable chat for end users
3. **Visual AI Agent Composition** — if sub-node architecture is done well
4. **Activepieces Integration Layer** — different ecosystem than N8N's native integrations
5. **TipTap Rich Prompt Editor** — better prompt editing than N8N's plain text
6. **Multi-Provider Model Support** — OpenAI, Anthropic, xAI Grok, NVIDIA NIM in one platform
