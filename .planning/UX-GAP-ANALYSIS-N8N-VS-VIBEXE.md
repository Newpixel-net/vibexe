# UX Gap Analysis: N8N vs Vibexe (2026-02-13)

## Test Setup
- **Vibexe workflow**: `wrks-G3ADLfUu3uGPOwoj` — Schedule Trigger -> AI Agent (gpt-5) -> If -> Loop -> Code
- **N8N workflow**: `FyTVW6OQ1HKtHt1QfehP1` — Same node types: Schedule Trigger, AI Agent, If, Loop, Code, HTTP Request, Merge, Switch, sub-nodes
- **Both tested via browser at 100-130% zoom**

---

## CRITICAL GAPS (Must Fix — Breaks Core UX)

### GAP 1: Multi-output "+" connects ALL outputs instead of one
- **Severity**: CRITICAL
- **N8N**: Each output handle (true/false, done/loop) has its OWN "+" button. Click "+" next to "true" to add a node connected ONLY to the "true" output.
- **Vibexe**: Single "+" per node. When clicking "+" on If node, the new node gets connected to BOTH "true" AND "false" outputs. Same for Loop (both "done" and "loop" connect).
- **Impact**: Makes branching logic impossible. The whole point of If/Switch is routing data to different paths — connecting all outputs defeats the purpose.
- **Root cause**: `useConnectNodes` iterates ALL outputs: `for (const output of outputNode.outputs)`.
- **Fix**: Per-output "+" buttons next to each labeled handle, passing specific `outputId` to `useConnectNodes`.

### GAP 2: Properties panel blocks entire canvas
- **Severity**: CRITICAL
- **N8N**: Properties panel slides in from right side as a side panel. Canvas remains visible and interactive behind it. Users can see the full workflow while editing node parameters.
- **Vibexe**: Properties panel opens as a full-screen dialog overlay (`<dialog>`). Canvas is completely hidden. Must close panel to see workflow topology.
- **Impact**: Users lose context of where the node sits in the workflow. Cannot compare node settings with upstream/downstream nodes. Every edit requires open-close-open cycles.
- **Fix**: Replace dialog with a side panel (right drawer, ~400px wide). Canvas shrinks but remains visible.

### GAP 3: Single-click opens properties panel
- **Severity**: HIGH
- **N8N**: Click node once = select it (blue border, shows basic info). Double-click = opens properties panel. Can inspect workflow without opening any panels.
- **Vibexe**: Single click immediately opens full-screen properties panel dialog. Cannot select a node without opening the panel.
- **Impact**: Extremely disruptive workflow. Users just want to select/move/delete nodes but get a modal every time.
- **Fix**: Single-click = select. Double-click = open properties side panel.

---

## HIGH PRIORITY GAPS (Significant UX Improvements)

### GAP 4: No per-output handle "+" buttons
- **Severity**: HIGH (related to GAP 1)
- **N8N**: Each handle on multi-output nodes (If: true+false, Switch: 0+1+2, Loop: done+loop) shows a small "+" icon next to the output label. Each "+" adds a node connected to ONLY that specific output.
- **Vibexe**: Only a single "+" button on the right side of the node. No per-handle "+" buttons.
- **Fix**: Render "+" icon next to each labeled output handle. Wire each to create a node connected to that specific output.

### GAP 5: Edge routing and styling
- **Severity**: HIGH
- **N8N**: Smooth bezier curves that auto-route intelligently. Edges curve to avoid overlapping nodes. Colors sometimes match source node category.
- **Vibexe**: Straight lines with sharp angles. All edges are the same blue/cyan color regardless of source. Edges from multi-output nodes (true+false) cross and overlap.
- **Fix**: Use smoothstep or bezier edge type in ReactFlow. Color edges to match source node category. Add slight offset for multi-output edges.

### GAP 6: Node colors too uniform for flow control
- **Severity**: MEDIUM-HIGH
- **N8N**: Each category has distinct colors — triggers (green), AI (blue/white), flow control (green diamond), data transforms (purple curly braces), integrations (per-brand color).
- **Vibexe**: If, Switch, Loop, Merge, Filter, Wait, Code all share the SAME cyan/teal color. Only Code is different (orange). Hard to distinguish flow control nodes from each other at a glance.
- **Fix**: Assign distinct colors per sub-category:
  - Branching (If, Switch): Green
  - Looping (Loop): Green-cyan
  - Merging (Merge): Blue
  - Data transforms (Code, Filter, Edit Fields, Sort): Purple/indigo
  - Flow timing (Wait): Orange

### GAP 7: Code node shape
- **Severity**: MEDIUM
- **N8N**: Code node uses a distinctive curly-braces `{ }` shape — immediately recognizable as "code".
- **Vibexe**: Code node uses the same 96x96 square shape as If/Loop/Switch. Distinguished only by color (orange vs cyan).
- **Fix**: Create a hexagon or curly-brace shape for Code nodes (like N8N).

### GAP 8: Integration node naming
- **Severity**: MEDIUM
- **N8N**: Integration nodes show action below name (e.g., "HTTP Request / GET:", "GetAll collection in Adalo / getAll:"). Clear what the node does.
- **Vibexe**: Integration nodes show technical piece names. Less user-friendly labeling.
- **Fix**: Show action subtitle below integration node name.

---

## MEDIUM PRIORITY GAPS (Polish and Completeness)

### GAP 9: Execution visualization
- **Severity**: MEDIUM
- **N8N**: Running a workflow shows animated dots flowing along edges. Nodes turn green (success) or red (failure) with item count badges ("3 items").
- **Vibexe**: Basic "Running..." badge on nodes. No edge animation. No item count display.
- **Fix**: Add edge animation during execution. Show item counts on nodes after execution.

### GAP 10: Inline data preview on edges
- **Severity**: MEDIUM
- **N8N**: After execution, small "N items" badge appears on edges. Click edge to see data flowing between nodes.
- **Vibexe**: No edge data preview.
- **Fix**: Add clickable data badges on edges post-execution.

### GAP 11: Unconfigured node warnings
- **Severity**: MEDIUM
- **N8N**: Orange triangle warning icons prominently displayed on nodes that need configuration.
- **Vibexe**: Subtle "Needs setup" styling (reduced opacity). Easy to miss.
- **Fix**: Add prominent warning icon/badge on unconfigured nodes.

### GAP 12: Two-step integration selection
- **Severity**: MEDIUM
- **N8N**: Type node name directly in search, single click to add ANY node type (trigger, action, logic, integration).
- **Vibexe**: "What happens next?" panel requires choosing category first (AI Generation, Action in app, Context & Data, Logic), then sub-selecting. Extra click for every node.
- **Fix**: Make search box the primary interaction. Typing should search ALL node types at once.

### GAP 13: Canvas-level node addition
- **Severity**: MEDIUM
- **N8N**: "+" button in toolbar, drag from suggestions, or click anywhere on empty canvas to get node picker.
- **Vibexe**: Can only add nodes via "+" on existing nodes or bottom toolbar (limited). No canvas-click-to-add.
- **Fix**: Add click-on-canvas to open node picker at click position.

### GAP 14: Execution button prominence
- **Severity**: LOW-MEDIUM
- **N8N**: Large red "Execute workflow" button at bottom center. Impossible to miss.
- **Vibexe**: "Run" button at top right, smaller and less prominent.
- **Fix**: Consider larger/more prominent run button or keep at top but make it more visually distinct.

### GAP 15: Node renaming UX
- **Severity**: LOW
- **N8N**: Click node name directly to rename inline on the canvas.
- **Vibexe**: Must open properties panel to rename. Title in properties panel is editable but requires dialog open.
- **Fix**: Make node name clickable for inline rename on canvas.

### GAP 16: Logs/output panel
- **Severity**: LOW
- **N8N**: Collapsible logs panel at bottom with "Pop out" to separate window.
- **Vibexe**: Execution history in separate Executions tab.
- **Fix**: Add collapsible output/logs panel at bottom of editor.

### GAP 17: AI Builder integration
- **Severity**: LOW
- **N8N**: "n8n AI" panel docked on right side with Ask/Build modes, always accessible.
- **Vibexe**: AI builder accessible via separate dialog.
- **Fix**: Optional — could dock AI builder panel on right side.

---

## ALREADY MATCHING (Implemented in Vibexe)

These features are at parity or close to parity:

| Feature | Status |
|---------|--------|
| D-shape triggers | Matching |
| Wide AI Agent nodes | Matching |
| Square flow control shapes | Matching (N8N uses diamonds) |
| Small circle sub-nodes | Matching |
| Sub-node bottom handles on AI Agent | Matching |
| Named output handles (true/false, done/loop) | Matching |
| Hover toolbar (Execute, Disable, Duplicate, Delete) | Matching |
| MiniMap | Matching |
| Zoom controls | Matching |
| Sticky notes | Matching (N8N: yellow, Vibexe: styled) |
| Edge rendering | Matching (fixed in commit 0bb35625e) |
| Search in "What happens next?" panel | Matching |
| Flow control nodes (If, Switch, Loop, Merge, etc.) | Matching |
| Cascade deletion (AI Agent deletes sub-nodes) | Matching |

---

## PRIORITY IMPLEMENTATION ORDER

### Wave 1: Core Interaction Fix (CRITICAL)
1. **Per-output "+" buttons** — Each labeled handle gets its own "+" icon
2. **useConnectNodes fix** — Accept specific `outputId` parameter, connect only that output
3. **Properties panel -> side panel** — Replace `<dialog>` with right drawer
4. **Double-click to open** — Single click = select, double-click = open panel

### Wave 2: Visual Polish
5. **Edge routing** — Switch to smoothstep/bezier edges with per-category colors
6. **Color diversity** — Distinct colors for branching vs looping vs data transform
7. **Code node shape** — Hexagon or curly-brace shape
8. **Unconfigured node warnings** — Prominent warning badges

### Wave 3: Workflow Building UX
9. **Unified search** — One search box that finds ALL node types
10. **Canvas-click-to-add** — Click empty area to open node picker
11. **Integration naming** — Show action subtitle on nodes
12. **Node inline rename** — Click name on canvas to rename

### Wave 4: Execution Polish
13. **Edge animation** — Animated dots during execution
14. **Item count badges** — Show data count on nodes after execution
15. **Edge data preview** — Click edge to see data
16. **Collapsible logs panel** — Bottom panel for output

---

## Estimated Effort

| Wave | Items | Est. Files Modified | Complexity |
|------|-------|-------------------|------------|
| Wave 1 | 4 | ~8-10 | High (architectural) |
| Wave 2 | 4 | ~5-6 | Medium |
| Wave 3 | 4 | ~6-8 | Medium |
| Wave 4 | 4 | ~8-10 | Medium-High |

**Total**: 16 items across 4 waves
