# N8N Import Visual Fixes — Work Plan

## Problem Statement
When importing complex N8N workflows (47+ nodes), the Vibexe canvas displays a visual mess:
- Sticky notes render as dark note cards instead of light background sections
- Node spacing is too tight for Vibexe's larger node sizes (96-224px vs N8N's ~50px)
- Disabled/placeholder nodes are visually indistinguishable from active nodes
- Absorbed LangChain sub-nodes clutter the canvas unnecessarily
- Auto-arrange destroys the original imported layout
- 66+ connections create visual spaghetti

**Goal**: "We should get the same display no matter what it looks like on the CANVAS" — the imported workflow should visually match the N8N original layout.

## Root Cause Analysis

### N8N vs Vibexe Node Size Comparison
| Element | N8N Size | Vibexe Size | Ratio |
|---------|----------|-------------|-------|
| Standard node | ~50x50px (icon) | 96x96px (card) | 1.9x |
| AI Agent node | ~50x50px (icon) | 224x96px (wide) | 4.5x wide |
| Sub-node | ~30x30px (badge) | 80x80px (circle) | 2.7x |
| Node label | Below, ~80px wide | Below, 130px div | 1.6x |

### N8N Sticky Notes = Section Containers
In N8N, sticky notes are **transparent colored background rectangles** up to 3804x1728px that group nodes into visual sections. In Vibexe, they render as **opaque dark cards** with colored left borders — fundamentally wrong for this use case.

### Coordinate Mapping
N8N positions are used 1:1 with no scaling. The typical 272px center-to-center gap was designed for ~50px N8N icons. With Vibexe's 96px cards, visible gap = 176px (acceptable). With 224px wide AI Agent nodes, visible gap = 48px (near-overlap).

---

## Phase 1: Sticky Note Section Mode (HIGH PRIORITY)

**Effort**: ~2 hours | **Impact**: Transforms visual quality of all imported workflows

### What
Add a "section" rendering mode to sticky notes that matches N8N's background section style.

### Files to Modify
1. `packages/protocol/src/workspace/index.ts` — Add `mode` to StickyNote schema
2. `packages/activepieces-adapter/src/n8n/converter.ts` — Set `mode: "section"` for imported notes
3. `internal-packages/workflow-designer-ui/src/editor/node/sticky-note-node.tsx` — Dual rendering
4. `internal-packages/workflow-designer-ui/src/editor/v2/components/v2-container.tsx` — Pass mode to RF node

### Schema Change
```typescript
// packages/protocol/src/workspace/index.ts
export const StickyNote = z.object({
    id: z.string(),
    text: z.string().default(""),
    color: z.enum(["yellow", "blue", "green", "pink", "gray"]).default("yellow"),
    position: z.object({ x: z.number(), y: z.number() }),
    size: z.object({ width: z.number(), height: z.number() }).default({ width: 200, height: 150 }),
    mode: z.enum(["note", "section"]).default("note"),  // NEW
});
```

### Converter Change
```typescript
// converter.ts — createStickyNote()
return {
    id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    color,
    position: { x: n8nNode.position[0], y: n8nNode.position[1] },
    size: { width, height },
    mode: "section",  // NEW — imported N8N sticky notes are always sections
};
```

### Section Rendering Style
```
Background: accent color at 12-18% opacity (e.g., rgba(128,128,128,0.12) for gray)
Border: none (no left accent border)
Text: rendered at top-left, heading style, lower opacity
Content area: transparent — nodes show through
No hover controls (no edit button, no color picker)
z-index: -1 (already implemented)
```

### Section Color Map
| Color | Section Background |
|-------|--------------------|
| yellow | rgba(234, 179, 8, 0.12) |
| blue | rgba(59, 130, 246, 0.12) |
| green | rgba(34, 197, 94, 0.12) |
| pink | rgba(236, 72, 153, 0.12) |
| gray | rgba(156, 163, 175, 0.12) |

---

## Phase 2: Coordinate Scaling (MEDIUM PRIORITY)

**Effort**: ~1 hour | **Impact**: Prevents node overlap and tight spacing

### What
Apply a 1.5x scale factor to imported N8N coordinates so Vibexe's larger nodes have room.

### Files to Modify
1. `packages/activepieces-adapter/src/n8n/converter.ts` — Scale in `computeLayout()` and `createStickyNote()`

### Scaling Logic
```typescript
const IMPORT_SCALE = 1.5;

// In computeLayout(), after using raw positions:
for (const id of Object.keys(positions)) {
    positions[id] = {
        x: positions[id].x * IMPORT_SCALE,
        y: positions[id].y * IMPORT_SCALE,
    };
}

// In createStickyNote():
position: {
    x: n8nNode.position[0] * IMPORT_SCALE,
    y: n8nNode.position[1] * IMPORT_SCALE,
},
size: {
    width: width * IMPORT_SCALE,
    height: height * IMPORT_SCALE,
},
```

### Expected Result
| Metric | Before (1.0x) | After (1.5x) |
|--------|---------------|---------------|
| Card node visible gap | 176px | 312px |
| Wide node visible gap | 48px | 184px |
| Parallel path gap | 80px | 168px |
| Canvas span | 4192 x 1536 | 6288 x 2304 |

---

## Phase 3: Disabled Node Visual Treatment (MEDIUM PRIORITY)

**Effort**: ~1.5 hours | **Impact**: Users can instantly see which nodes need attention

### What
Render disabled/placeholder nodes with reduced opacity, dashed borders, and status badges.

### Files to Modify
1. `internal-packages/workflow-designer-ui/src/editor/v2/components/v2-container.tsx` — Pass `disabled` to RF node data
2. `internal-packages/workflow-designer-ui/src/editor/node/card-node.tsx` — Disabled styling
3. All other node shape components (wide, circle, hexagon, small-circle)

### Visual Treatment
- **Opacity**: 40% for the entire node
- **Border**: 1px dashed instead of solid
- **Badge**: Small "Disabled" or "Placeholder" text below node name
- **Connections**: Dashed lines to/from disabled nodes

---

## Phase 4: Hide Absorbed Sub-Nodes (LOW PRIORITY)

**Effort**: ~30 min | **Impact**: Removes 4 unnecessary clutter nodes

### What
LangChain sub-nodes (Think, Structured Output Parser) that are absorbed into parent AI Agent nodes should not appear on the canvas.

### Approach A (Simple — Recommended)
In `v2-container.tsx`, filter out nodes where `node.disabled === true` AND node name ends with known sub-node patterns ("Think", "Structured Output Parser", "Output Parser").

### Approach B (Proper)
In converter, add `absorbed: true` flag to sub-nodes. In `v2-container.tsx`, filter out `absorbed` nodes.

---

## Phase 5: Auto-Arrange Warning for Imports (LOW PRIORITY)

**Effort**: ~30 min | **Impact**: Prevents accidental layout destruction

### What
Show a confirmation dialog when auto-arrange is triggered on an imported workflow.

### Files to Modify
1. `internal-packages/workflow-designer-ui/src/editor/hooks/use-auto-arrange.ts`
2. Store import source in workspace metadata

---

## Phase 6: Connection Styling for Disabled Nodes (NICE TO HAVE)

**Effort**: ~1 hour | **Impact**: Reduces visual noise

### What
Connections to/from disabled nodes render as dashed, lower opacity. Fan-out connections use bundled routing.

---

## Implementation Order

```
Phase 1 (Sticky Section Mode) ← DO FIRST, biggest visual impact
    ↓
Phase 2 (Coordinate Scaling) ← DO SECOND, fixes spacing
    ↓
Phase 3 (Disabled Node Styling) ← DO THIRD, visual clarity
    ↓
Phase 4 (Hide Absorbed Nodes) ← Quick win after Phase 3
    ↓
Phase 5 (Auto-Arrange Warning) ← Optional
    ↓
Phase 6 (Connection Styling) ← Optional
```

## Verification Plan
1. Re-import the NanoBanana workflow after each phase
2. Compare canvas layout with original N8N screenshot
3. Check:
   - [ ] Sticky notes appear as colored background sections
   - [ ] Nodes are spaced comfortably (no overlap)
   - [ ] Disabled nodes are visually distinct
   - [ ] Absorbed sub-nodes are hidden or minimized
   - [ ] Overall layout matches N8N's 5-section structure
   - [ ] Build succeeds (`pnpm build-sdk && pnpm --filter studio.vibexe.ai build`)
