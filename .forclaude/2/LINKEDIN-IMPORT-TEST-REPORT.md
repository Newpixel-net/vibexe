# N8N LinkedIn Workflow Import Test Report

**Date:** 2026-02-17 (updated)
**Source:** `Automated LinkedIn content creation with GPT-4 and DALL-E for scheduled posts.json`
**Template ID:** N8N #4968 (174,871 stars on n8n.io)
**Vibexe Workspace:** `wrks-5dLf8TNxdJAfIyhR`
**URL:** https://vibexe.online/workflows/wrks-5dLf8TNxdJAfIyhR
**N8N Instance:** https://instarep.app.n8n.cloud/workflow/PAd8JNrRpV5jJFZZJGvRF
**Previous Import:** `wrks-1e9GU2yY9cDA8LCm` (before sub-node wiring fix)

---

## Executive Summary

**RESULT: MOSTLY SUCCESSFUL -- 2 RENDERING BUGS FOUND**

All 13 nodes imported and all 13 connections stored in DB, but **only 11 of 13 connections render visually**. The 2 missing edges are sub-node connections targeting Content creator (`chainLlm` / `textGeneration`), which lacks bottom handles.

| Metric | Result |
|--------|--------|
| Total nodes imported | 13/13 (100%) |
| Connections in DB | 13/13 (100%) |
| **Connections rendered visually** | **11/13 (85%)** |
| Missing edges | 2 (sub-node connections to Content creator) |
| Disabled nodes | 3 (Structured Output Parser, Parser1, Parser2) |
| Sub-node wiring to aiAgent nodes | 4/4 (100%) -- FIX WORKING |
| Sub-node wiring to textGeneration nodes | 0/2 (0%) -- BUG |
| Main flow wiring | 7/7 (100%) |
| Banner | "Imported from N8N -- 3 nodes disabled" |

---

## Bug #1: 2 Sub-Node Connections Not Rendering (Content creator)

### Affected Connections
| # | Source Node | Target Node | N8N Type | Status |
|---|---|---|---|---|
| 9 | OpenAI Chat Model1 (chatModel) | Content creator (textGeneration) | `ai_languageModel` | **NOT RENDERED** |
| 12 | Structured Output Parser1 (toolNode) | Content creator (textGeneration) | `ai_outputParser` | **NOT RENDERED** |

### Root Cause
Content creator is N8N type `@n8n/n8n-nodes-langchain.chainLlm` which maps to Vibexe `textGeneration` content type. This renders as a **SmallCircleNode** (80px circle).

The sub-node edge routing in `v2-container.tsx` (line 455-461) sets:
```typescript
if (connection.connectionType === "subNode") {
    sourceHandle = "parent";  // ← circle's top handle
    const subType = connection.outputNode.content.type;
    if (subType === "chatModel") targetHandle = "chatModel";
    else if (subType === "toolNode") targetHandle = "tool";
}
```

But `SmallCircleNode` (textGeneration) does **NOT** have bottom handles named `"chatModel"` or `"tool"`. Those handles only exist on `WideNode` (aiAgent). React Flow silently drops edges when it can't find the target handle.

### Fix Options
1. **Map `chainLlm` to `aiAgent`** instead of `textGeneration` -- gives it wide box + bottom handles
2. **Add bottom handles to SmallCircleNode** for circle nodes that have sub-node connections
3. **Special-case in v2-container.tsx** -- for textGeneration targets, route sub-node edges to the left input handle instead of bottom handles

### Visual Evidence
- In the 59% zoom screenshot, OpenAI Chat Model1 and Structured Output Parser1 appear below Content creator but have **no visible dashed lines** connecting to it
- In contrast, the same sub-node types connecting to Content topic generator2 (aiAgent) and Hashtag generator /SEO (aiAgent) render correctly with dashed lines

---

## Bug #2: Model ID Hardcoded to gpt-5

### Issue
All chatModel sub-nodes display "gpt-5" instead of the original N8N model "gpt-4o-mini".

### Root Cause
`node-mapping.ts` line 201:
```typescript
"@n8n/n8n-nodes-langchain.lmchatopenai": {
    type: "chatModel",
    provider: "openai",
    defaultModelId: "openai/gpt-5",  // ← Hardcoded, ignores N8N params
},
```

The converter (`converter.ts` line 978) uses `mapping.defaultModelId` instead of extracting the actual model from the N8N node's `parameters.model.value`.

### Impact
- Cosmetic only for display
- When executed, the agent would use gpt-5 instead of the intended gpt-4o-mini
- Cost difference: gpt-5 is significantly more expensive than gpt-4o-mini

---

## Bug #3: Structured Output Parsers Always Disabled

### Issue
All 3 Structured Output Parsers show "DISABLED" overlay.

### Root Cause
`converter.ts` line 991-996:
```typescript
case "toolNode": {
    return {
        ...
        disabled: true,  // ← Always disabled for all toolNode types
    };
}
```

Output parsers map to `toolNode` in `node-mapping.ts`, and the converter hardcodes `disabled: true` for all toolNode types.

### Impact
- Sub-nodes show grayed out with "DISABLED" badge
- They still connect via edges (when target handles exist)
- Label shows "Tool" instead of "Output Parser"
- N8N output parsers are active, functional components

---

## Complete Node Mapping Table

| # | N8N Node Name | N8N Type | Vibexe Content Type | Vibexe Display | Status |
|---|---|---|---|---|---|
| 1 | Schedule Trigger | `scheduleTrigger` | `nativeTrigger(schedule)` | Clock icon, "Schedule Trigger" | PASS |
| 2 | Content topic generator2 | `langchain.agent` | `aiAgent(tools)` | Wide box - "Agent . gpt-5" + Model*/Memory/Tool | PASS |
| 3 | OpenAI Chat Model | `langchain.lmChatOpenAi` | `chatModel(openai)` | Circle, "Model" label | PASS |
| 4 | Structured Output Parser | `langchain.outputParserStructured` | `toolNode(builtinTool)` | Circle, "Tool" label, DISABLED | KNOWN |
| 5 | Content creator | `langchain.chainLlm` | `textGeneration(openai)` | Circle, "gpt-5" subtitle | **ISSUE** |
| 6 | OpenAI Chat Model1 | `langchain.lmChatOpenAi` | `chatModel(openai)` | Circle, "Model" label | PASS |
| 7 | Structured Output Parser1 | `langchain.outputParserStructured` | `toolNode(builtinTool)` | Circle, "Tool" label, DISABLED | KNOWN |
| 8 | OpenAI (DALL-E) | `langchain.openAi` | `textGeneration(openai)` | Circle, "gpt-5" subtitle | PASS |
| 9 | Hashtag generator /SEO | `langchain.agent` | `aiAgent(tools)` | Wide box - "Agent . gpt-5" + Model*/Memory/Tool | PASS |
| 10 | OpenAI Chat Model2 | `langchain.lmChatOpenAi` | `chatModel(openai)` | Circle, "Model" label | PASS |
| 11 | Structured Output Parser2 | `langchain.outputParserStructured` | `toolNode(builtinTool)` | Circle, "Tool" label, DISABLED | KNOWN |
| 12 | Merge | `merge` | `nativeMerge` | Card - "Merge Branches", Input 1/Input 2 | PASS |
| 13 | LinkedIn | `linkedIn` | `integration(linkedin)` | Card - LinkedIn icon, "LinkedIn . default" | PASS |

**Score: 13/13 nodes created (100%), 10/13 rendering correctly**

---

## Connection Mapping Table

| # | Source → Target | Type | DB Stored | Edge Rendered | Status |
|---|---|---|---|---|---|
| 1 | Schedule Trigger → Content topic generator2 | main | YES | YES | PASS |
| 2 | Content topic generator2 → Content creator | main | YES | YES | PASS |
| 3 | Content creator → OpenAI (DALL-E) | main (fan-out 1/2) | YES | YES | PASS |
| 4 | Content creator → Hashtag generator /SEO | main (fan-out 2/2) | YES | YES | PASS |
| 5 | OpenAI (DALL-E) → Merge (Input 1) | main | YES | YES | PASS |
| 6 | Hashtag generator /SEO → Merge (Input 2) | main | YES | YES | PASS |
| 7 | Merge → LinkedIn | main | YES | YES | PASS |
| 8 | OpenAI Chat Model → Content topic generator2 | ai_languageModel (subNode) | YES | YES | PASS |
| 9 | OpenAI Chat Model1 → Content creator | ai_languageModel (subNode) | YES | **NO** | **FAIL** |
| 10 | OpenAI Chat Model2 → Hashtag generator /SEO | ai_languageModel (subNode) | YES | YES | PASS |
| 11 | Structured Output Parser → Content topic generator2 | ai_outputParser (subNode) | YES | YES | PASS |
| 12 | Structured Output Parser1 → Content creator | ai_outputParser (subNode) | YES | **NO** | **FAIL** |
| 13 | Structured Output Parser2 → Hashtag generator /SEO | ai_outputParser (subNode) | YES | YES | PASS |

**Score: 13/13 in DB (100%), 11/13 rendered (85%)**

---

## Sub-Node Wiring Fix Verification

The `connectionType: "subNode"` fix from the previous session (commit `60a4d458d`) is **WORKING CORRECTLY** for aiAgent target nodes:

### Content topic generator2 (aiAgent) -- CORRECT
- OpenAI Chat Model: dashed line from circle TOP → agent BOTTOM (Model* port, filled)
- Structured Output Parser: dashed line from circle TOP → agent BOTTOM (Tool port, count shows "Tool (1)")

### Hashtag generator /SEO (aiAgent) -- CORRECT
- OpenAI Chat Model2: dashed line from circle TOP → agent BOTTOM (Model* port, filled)
- Structured Output Parser2: dashed line from circle TOP → agent BOTTOM (Tool port, count shows "Tool (1)")

### Content creator (textGeneration) -- BROKEN
- OpenAI Chat Model1: **no visible edge** (target handle "chatModel" doesn't exist on SmallCircleNode)
- Structured Output Parser1: **no visible edge** (target handle "tool" doesn't exist on SmallCircleNode)

---

## Visual Comparison: N8N vs Vibexe

### Node Shape Differences

| Node Category | N8N Shape | Vibexe Shape | Match? |
|---|---|---|---|
| AI Agent nodes (2) | Wide card with Chat Model*/Memory/Tool/Output Parser sub-ports | Wide card with Model*/Memory/Tool buttons | MATCH |
| Chat Model sub-nodes (3) | Round circle, "Model" label, OpenAI icon | Round circle, "Model" label, OpenAI icon | MATCH |
| Output Parser sub-nodes (3) | Round circle, `<>` icon, "Output Parser" label | Round circle, "Tool" label, DISABLED badge | PARTIAL |
| LLM Chain (Content creator) | Wide card with Model*/Output Parser sub-ports below | **Small circle** (textGeneration), "gpt-5" subtitle | **MISMATCH** |
| Standalone OpenAI (DALL-E) | Round circle, "Generate Image" subtitle | Small circle (textGeneration), "gpt-5" subtitle | PARTIAL |
| Schedule Trigger | Green clock icon | Gray clock icon | MATCH |
| Merge (2-input) | Card with Input 1/Input 2, "append" | Card with Input 1/Input 2, "Merge Branches" | MATCH |
| LinkedIn | Blue `in` icon, "create: post" | Red LinkedIn icon, "LinkedIn . default" | PARTIAL |

### Key Visual Differences

1. **Content creator shape**: N8N renders `chainLlm` as a wide card with bottom sub-ports (like an Agent). Vibexe renders it as a small circle (textGeneration). This is the most significant visual difference and the root cause of Bug #1.

2. **Sub-node wiring direction**: For aiAgent nodes (Content topic gen, Hashtag gen), sub-node wires correctly go from circle TOP to agent BOTTOM -- matching N8N. For Content creator (textGeneration), wires don't render at all.

3. **Output Parser labels**: N8N shows "Output Parser". Vibexe shows "Tool" with DISABLED overlay.

4. **Model IDs**: All nodes show "gpt-5" instead of original "gpt-4o-mini".

5. **DALL-E node**: Shows as text generation circle instead of image generation node.

---

## Workflow Architecture

```
                                    ┌─────────────┐
                                    │   OpenAI     │ (DALL-E image gen)
                                    │   gpt-5      │
                                    └──────┬───────┘
                                           │
                                           ▼ Input 1
┌──────────┐    ┌──────────────────┐   ┌───────────┐   ┌──────────┐    ┌──────────┐
│ Schedule  │──▶│Content topic     │──▶│ Content   │   │  Merge   │──▶│ LinkedIn │
│ Trigger   │   │generator2        │   │ creator   │──▶│ Branches │   │ default  │
│           │   │Agent · gpt-5     │   │ gpt-5     │   │          │   │          │
└──────────┘   └──────────────────┘   └───────────┘   └──────────┘   └──────────┘
                │  Model* │ Tool(1)    │  ??? │ ???        ▲ Input 2
                ▼         ▼            ▼      ▼            │
           ┌────────┐ ┌────────┐  ┌────────┐ ┌────────┐   │
           │ OpenAI │ │Parser  │  │OpenAI  │ │Parser1 │   │
           │ Chat   │ │(DISABL)│  │Chat    │ │(DISABL)│ ┌───────────────────┐
           │ Model  │ │        │  │Model1  │ │        │ │ Hashtag generator │
           │[circle]│ │[circle]│  │[circle]│ │[circle]│ │ /SEO              │
           └───┬────┘ └───┬────┘  └───┬────┘ └───┬────┘ │ Agent · gpt-5    │
               │ ✓        │ ✓        │ ✗        │ ✗    └───────────────────┘
               │ renders  │ renders  │ MISSING  │ MISS  │  Model* │ Tool(1)
               │ edge     │ edge     │ edge     │ ING   ▼         ▼
               │          │          │          │  ┌────────┐ ┌────────┐
               └──────────┘          └──────────┘  │ OpenAI │ │Parser2 │
                                                   │ Chat   │ │(DISABL)│
                                                   │ Model2 │ │        │
                                                   │[circle]│ │[circle]│
                                                   └───┬────┘ └───┬────┘
                                                       │ ✓        │ ✓
                                                       │ renders  │ renders
                                                       │ edge     │ edge
                                                       └──────────┘
```

**Legend:**
- ✓ = sub-node edge renders correctly (dashed line, circle TOP → agent BOTTOM)
- ✗ = sub-node edge stored in DB but NOT rendered (target node is SmallCircleNode without bottom handles)

---

## Data Flow

1. **Schedule Trigger** fires every 6 hours
2. **Content topic generator2** (AI Agent) generates content topics using GPT-4o-mini with structured JSON output (title, rationale, hook)
3. **Content creator** (LLM Chain) writes LinkedIn post text + image description
4. **Fan-out** from Content creator to two parallel paths:
   - **Path A** (top): **OpenAI** generates DALL-E image → **Merge Input 1**
   - **Path B** (bottom): **Hashtag generator /SEO** generates hashtags → **Merge Input 2**
5. **Merge** combines image + hashtag data (append mode)
6. **LinkedIn** publishes post with image and hashtags

---

## Node Content Preservation

### Prompts (all preserved correctly)

| Node | Prompt Length | Key Content |
|---|---|---|
| Content topic generator2 | ~1,200 chars | "Content Researcher Assistant at Agentic Vibe" - generates content topics |
| Content creator | ~200 chars | Uses `{{ $json.output[0].title }}` N8N expression references |
| Hashtag generator /SEO | ~800 chars | "SEO specialist for LinkedIn" - generates hashtags |

### Structured Output Schemas (preserved in disabled parser nodes)

| Parser | Output Fields |
|---|---|
| Structured Output Parser | `title`, `rationale`, `hook` (array) |
| Structured Output Parser1 | `post title`, `post content`, `image description` |
| Structured Output Parser2 | `post title`, `post content`, `image description`, `Hashtags` (array) |

---

## Import API Response

```json
{
  "redirectPath": "/workflows/wrks-5dLf8TNxdJAfIyhR",
  "nodeCount": 13,
  "connectionCount": 13,
  "warnings": [],
  "hasFlowControl": true,
  "nodeTypeCounts": {
    "trigger": 1,
    "aiAgent": 2,
    "chatModel": 3,
    "toolNode": 3,
    "textGeneration": 2,
    "merge": 1,
    "integration": 1
  },
  "importMeta": {
    "source": "n8n",
    "nodesNeedingCredentials": 0,
    "expressionsPartiallyTranslated": 0,
    "cyclesConverted": 0,
    "disabledNodes": 0,
    "scheduleConfig": {
      "cronExpression": "0 */6 * * *",
      "timezone": "UTC"
    }
  }
}
```

---

## Comparison with Previous Import Tests

| Metric | ASMR (32 nodes) | TikTok (33 nodes) | LinkedIn (13 nodes) |
|--------|-----------------|-------------------|---------------------|
| Node import rate | 32/32 (100%) | 33/33 (100%) | 13/13 (100%) |
| Connection DB rate | 28/28 (100%) | 35/35 (100%) | 13/13 (100%) |
| **Connection render rate** | **N/A** | **N/A** | **11/13 (85%)** |
| Disabled nodes | 3 | 10 (Blotato) | 3 (Output Parsers) |
| AI Agent cards | 3 | 0 | 2 |
| Sub-node wiring bugs | N/A (before fix) | N/A | 2 (chainLlm target) |

---

## Priority Fix List

### P0 - Must Fix
1. **Sub-node edge rendering for textGeneration targets** (Bug #1) -- 2 edges don't render because SmallCircleNode lacks bottom handles. Fix: Either map `chainLlm` to `aiAgent`, or add bottom handles to SmallCircleNode, or special-case the edge routing.

### P1 - Should Fix
2. **Extract actual model ID from N8N params** (Bug #2) -- Read `parameters.model.value` instead of using hardcoded `defaultModelId`. All 6 model-using nodes affected.

### P2 - Nice to Have
3. **Output Parser label** -- Show "Output Parser" instead of "Tool" for parser nodes
4. **DALL-E node visual** -- Show "Generate Image" instead of "gpt-5" for image generation nodes
5. **LinkedIn action name** -- Extract actual action from N8N type instead of "default"
6. **Output Parser disabled state** -- Consider making parsers active (not disabled)

---

## Overall Assessment

| Metric | Score |
|--------|-------|
| Node Import | 13/13 (100%) |
| Connection DB Storage | 13/13 (100%) |
| **Connection Rendering** | **11/13 (85%)** |
| Sub-node Wiring (aiAgent targets) | 4/4 (100%) |
| Sub-node Wiring (textGeneration targets) | 0/2 (0%) |
| Content Fidelity | 100% (all prompts, schemas preserved) |
| Fan-out/Fan-in | Perfectly preserved (1→2 and 2→1) |

**VERDICT: MOSTLY WORKING -- 1 RENDERING BUG TO FIX**

The sub-node wiring fix (`connectionType: "subNode"`) works perfectly for aiAgent target nodes, validating the previous session's work. The remaining issue is specific to `chainLlm` → `textGeneration` nodes which don't have bottom handles. This affects any N8N workflow where an LLM Chain has attached language model or output parser sub-nodes.

The fix is straightforward: either upgrade `chainLlm` mapping from `textGeneration` to `aiAgent` (giving it bottom handles), or add conditional bottom handles to SmallCircleNode when sub-node connections exist.
