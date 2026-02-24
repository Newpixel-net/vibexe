# V2 Implementation Plan: HIGH Priority Gaps (Updated)

**Date**: 2026-02-12
**Status**: IN PROGRESS
**Based On**: WORK-PLAN-V2-HIGH.md + codebase research

---

## Updated Gap Assessments (Post-Research)

| Gap | Original Est. | Actual Completeness | Remaining Work |
|-----|--------------|-------------------|---------------|
| 5. Sub-Nodes | 0% | **~90%** | Verify execution-time resolution |
| 6. Chain Templates | 0% | **0%** | Full implementation needed |
| 7. RAG External | ~90% | **~90%** | External provider configs (DEFERRED) |
| 8. Execution History | 0% | **~70%** | Enable feature flag + per-node detail |
| 9. Multiple Triggers | 0% | **~95%** | No restrictions found, just verify |
| 10. 3-Panel All Nodes | ~40% | **~40%** | Extend isThreePanelNode + OutputPanel |

---

## Phase A: Quick Wins (Enable Existing Features)

### A.1: Enable layoutV3 Feature Flag
**Status**: The Executions tab, header tabs (Editor/Executions/Sharing), and dropdown menu ALL EXIST but are hidden behind `layoutV3` feature flag in `apps/studio.vibexe.ai/flags.ts`.
- `layoutV3` reads `LAYOUT_V3_FLAG` env var, defaults to false
- **Fix**: Set `LAYOUT_V3_FLAG=true` in server `.env.local`
- **OR**: Change the flag to default to `true` in code
- **Impact**: Exposes Executions tab (RunHistoryTable), dropdown menu (Rename/Duplicate/Delete)

### A.2: Verify Multiple Triggers (GAP 9)
**Status**: NO RESTRICTIONS found on multiple triggers.
- `isSupportedConnection()` allows trigger → operation connections
- No addNode() validation prevents multiple triggers
- `scheduled_workflows` and `webhook_endpoints` tables support multiple entries per workspace
- **Action**: Test adding 2 trigger nodes in the same workflow
- **Remaining**: Ensure task creation identifies which trigger fired

### A.3: Verify Sub-Node Execution (GAP 5)
**Status**: Sub-node UI is FULLY FUNCTIONAL in v2-container.tsx.
- chatModel, toolNode, memoryNode sub-nodes create real nodes + connections
- `connectionType: "subNode"` connections are created
- **Action**: Verify AI Agent execution reads connected chatModel sub-node's model config
- **Check**: `generate-content.ts` — does it look for sub-node connections?

---

## Phase B: Chain Templates (GAP 6) — ~300 lines

### B.1: Chain Template Registry
**New file**: `packages/vibexe/src/chains/chain-templates.ts`

5 templates:
1. **Information Extractor** — Extract structured data from text
2. **Sentiment Analysis** — Classify positive/negative/neutral
3. **Summarization** — Summarize with configurable length
4. **Text Classifier** — Classify into user-defined categories
5. **AI Transform** — Transform data format with instructions

Each template provides:
- `systemPrompt`: Pre-built instruction
- `outputSchema`: JSON Schema for structured output
- `inputDescription`: What the input should contain

### B.2: Template Dropdown in AI Agent Panel
**Modify**: `internal-packages/workflow-designer-ui/src/editor/properties-panel/ai-agent-node-properties-panel/index.tsx`

Add dropdown at top of panel:
- "Custom" (default), "Information Extractor", "Sentiment Analysis", "Summarization", "Text Classifier", "AI Transform"
- Selecting template auto-fills: systemPrompt, structuredOutput.enabled=true, structuredOutput.schema

### B.3: Node Picker Category
**Modify**: `what-happens-next-panel.tsx` or toolbar
- Add "AI Chains" category showing template shortcuts
- Clicking creates AI Agent node pre-configured with template

---

## Phase C: 3-Panel Extension (GAP 10) — ~200 lines

### C.1: Extend isThreePanelNode()
**Modify**: `internal-packages/workflow-designer-ui/src/editor/properties-panel/index.tsx`
**Modify**: `internal-packages/workflow-designer-ui/src/editor/v2/components/v2-container.tsx`

Add flow control types: if, switch, merge, loop, code, filter, editFields, sort, wait, errorTrigger

### C.2: Output Panel for Flow Control Nodes
**Challenge**: OutputPanel shows generation results. Flow control nodes use DAG executor, not generation system.
**Solution**: Store DAG node results in workspace state so OutputPanel can display them.
- Add structured data display to OutputPanel (JSON tree viewer)
- For flow control nodes: show last execution's DAG result
- Note: This depends on DAG execution actually storing results (may need run-task.ts changes)

---

## Phase D: Execution History Enhancement (GAP 8) — ~200 lines

### D.1: Enable Executions Tab
- layoutV3 flag → true (Phase A.1)
- RunHistoryTable already renders in Executions tab content (v2-placeholder.tsx)

### D.2: Per-Node Execution Detail
- When clicking a past run in history: load generation data for each node
- Show per-node: status, duration, token usage
- Highlight nodes on canvas with status colors

### D.3: "Skipped" Canvas Indicator
- NodeGenerationStatusBadge already shows: Waiting, Generating, Completed
- Add: "Skipped" state for nodes in non-active branches (gray/dimmed)

---

## Implementation Order

```
Phase A: Quick Wins (~30 min)
  ├── A.1: Enable layoutV3 flag (or change default)
  ├── A.2: Test multiple triggers
  └── A.3: Verify sub-node execution

Phase B: Chain Templates (~2-3 hours)
  ├── B.1: chain-templates.ts registry
  ├── B.2: Template dropdown in AI Agent panel
  └── B.3: Node picker category

Phase C: 3-Panel Extension (~1-2 hours)
  ├── C.1: Extend isThreePanelNode()
  └── C.2: Structured data in OutputPanel

Phase D: Execution History (~1-2 hours)
  ├── D.1: (Done via A.1)
  ├── D.2: Per-node detail view
  └── D.3: Skipped indicator
```

---

## Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `apps/studio.vibexe.ai/flags.ts` | A.1 | layoutV3 → true |
| `packages/vibexe/src/chains/chain-templates.ts` | B.1 | **NEW** |
| `ai-agent-node-properties-panel/index.tsx` | B.2 | Add template dropdown |
| `what-happens-next-panel.tsx` | B.3 | Add AI Chains category |
| `properties-panel/index.tsx` | C.1 | Extend isThreePanelNode() |
| `v2-container.tsx` | C.1 | Extend width logic |
| `output-panel.tsx` | C.2 | Structured data display |
| `node-generation-status-badge.tsx` | D.3 | Add skipped state |
