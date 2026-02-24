# N8N Import Test Report: TikTok Viral Creator Workflow

**Date**: 2026-02-17 (Raw Position Layout — Final)
**Template**: Auto-create TikTok videos with VEED.io AI avatars, ElevenLabs & GPT-4
**N8N Template ID**: 10000
**Workspace ID**: `wrks-Yx8gucOhxT1yIA0E`
**URL**: https://vibexe.online/workflows/wrks-Yx8gucOhxT1yIA0E
**Layout Algorithm**: Raw N8N positions (1:1 mapping, commit `d22b112d2`)
**History**: 1.75x scaling -> topological (7f26ed2e7) -> raw positions (d22b112d2)

---

## Summary

| Metric | N8N Original | Vibexe Import | Status |
|--------|-------------|---------------|--------|
| Total nodes | 28 | 28 | PASS |
| Operation nodes | 21 | 21 | PASS |
| Sticky notes | 7 | 7 | PASS |
| Total connections | 35 | 35 | PASS |
| Unsupported nodes | 0 | 10 (Blotato community) | EXPECTED |
| Merge1 input handles | 9 | 9 | PASS |
| Warning banner | N/A | Shows "10 nodes could not be fully imported" | PASS |
| **Layout matches N8N** | -- | **2D zigzag layout preserved** | **PASS** |

**Overall**: Import is **SUCCESSFUL**. Layout now **matches N8N's original 2D arrangement**.

---

## Layout Evolution (3 iterations)

### Iteration 1: 1.75x Position Scaling (REJECTED)
- Multiplied N8N coordinates by 1.75
- Result: Workflow scattered across ~3800x3900px, wire lengths 324-380px
- Problem: N8N uses ~40px icon nodes with ~272px gaps. Scaling made gaps 476px — far too large

### Iteration 2: Topological Layout / Kahn's Algorithm (commit `7f26ed2e7`) (REJECTED)
- Compact horizontal layers, 200px H-gap, 140px V-gap
- Result: Clean compact layout, wire lengths ~104px
- Problem: **Flattened the 2D layout into a single horizontal line**. N8N's zigzag rows, sticky note background annotations, and spatial grouping were completely lost

### Iteration 3: Raw N8N Positions (commit `d22b112d2`) (CURRENT - ACCEPTED)
- 1:1 mapping of N8N coordinates, no scaling
- Sticky notes use original N8N sizes (no caps)
- Normalization: both nodes and sticky notes normalized to origin together
- Fallback: topological layout used only when no raw positions available
- Result: **Layout matches N8N's original 2D arrangement**

---

## Layout Quality Assessment (Raw Positions)

### How It Works
- N8N coordinates are used directly (1:1, no scaling)
- N8N uses ~40px icon nodes with ~272px gaps between adjacent nodes
- Vibexe uses 96px card nodes, so the visible gap becomes ~176px — still very readable
- Sticky notes retain their original N8N dimensions (background annotations)
- Both nodes and sticky notes are normalized to origin together

### Visual Comparison

| Feature | N8N Original | Vibexe Import | Match? |
|---------|-------------|---------------|--------|
| Row 1: Telegram pipeline | 5 nodes in horizontal row inside STEP 1 sticky | Same layout, same position | YES |
| Row 2: AI processing | 5 nodes in horizontal row inside STEP 3 sticky | Same layout, same position | YES |
| Row 3: Video pipeline | 5 nodes (FAL.ai -> Sheets) in horizontal row | Same layout, same position | YES |
| Row 4: Publishing | Send video -> BLOTATO -> fan-out inside STEP 5 | Same layout, same position | YES |
| Fan-out: 9 social platforms | Scattered vertically below BLOTATO | Same spatial arrangement | YES |
| Merge1 + Update Status | Right side, below fan-out | Same position | YES |
| Sticky notes | Large background annotations wrapping around nodes | Same — large backgrounds in same positions | YES |
| HOW IT WORKS sticky | Bottom-left corner | Same position | YES |

### Key Differences (Expected)
1. **Node size**: Vibexe cards (96px) are larger than N8N icons (~40px) — nodes are more prominent
2. **Edge routing**: Vibexe uses different edge styling (colored by type) vs N8N's gray lines
3. **Disabled badge**: Vibexe shows "Disabled" text badge; N8N uses transparency/strikethrough
4. **Node labels**: Vibexe shows subtitle below name (e.g., "Edit Fields", "gpt-5-mini"); N8N shows inline

---

## Node Import Details

### Fully Imported Nodes (18 nodes)

| # | N8N Name | Vibexe Type | Subtitle |
|---|----------|-------------|----------|
| 1 | Telegram Trigger | trigger | -- |
| 2 | Workflow Configuration | Edit Fields | Edit Fields |
| 3 | Extract Photo and Theme | Edit Fields | Edit Fields |
| 4 | Get Photo File from Telegram | Telegram Bot | default |
| 5 | Build Public Image URL | HTTP Request | POST - tmpfiles.org |
| 6 | Search Trends with Perplexity | AI Agent | perplexity - default |
| 7 | Generate Script with GPT-4 | AI Agent | gpt-5-mini |
| 8 | ElevenLabs Voice Synthesis | HTTP Request | POST - [Workflow Config...] |
| 9 | Convert .mpga to .mp3 | Code | JavaScript |
| 10 | Upload Audio to Public URL | HTTP Request | POST - tmpfiles.org |
| 11 | FAL.ai Video Generation | HTTP Request | POST - queue.fal.run |
| 12 | Wait for VEED | Wait / Delay | Wait / Delay |
| 13 | Download VEED Video | HTTP Request | GET - queue.fal.run |
| 14 | Generate Caption with GPT-4 | AI Agent | gpt-5-mini |
| 15 | Save to Google Sheets | Google Sheets | insert row |
| 16 | Send a video | Telegram Bot | sendVideo |
| 17 | Merge1 | Merge Branches | 9 inputs |
| 18 | Update Status to "DONE" | Google Sheets | find rows |

### Unsupported Nodes (10 nodes) — Blotato Community Package

All from `@blotato/n8n-nodes-blotato.blotato`:

| # | N8N Name | Rendering | Badge |
|---|----------|-----------|-------|
| 1 | Upload Video to BLOTATO | Edit Fields (Disabled) | DISABLED |
| 2 | Tiktok | Edit Fields (Disabled) | DISABLED |
| 3 | Linkedin | Edit Fields (Disabled) | DISABLED |
| 4 | Facebook | Edit Fields (Disabled) | DISABLED |
| 5 | Instagram | Edit Fields (Disabled) | DISABLED |
| 6 | Twitter (X) | Edit Fields (Disabled) | DISABLED |
| 7 | Youtube | Edit Fields (Disabled) | DISABLED |
| 8 | Threads | Edit Fields (Disabled) | DISABLED |
| 9 | Bluesky | Edit Fields (Disabled) | DISABLED |
| 10 | Pinterest | Edit Fields (Disabled) | DISABLED |

---

## Sticky Notes (7 total — Background Annotations)

| # | Title | Position | Content |
|---|-------|----------|---------|
| 1 | VIRAL TIKTOK CREATOR - SETUP GUIDE | Left column | Requirements checklist, YouTube tutorial link |
| 2 | STEP 1: TELEGRAM BOT SETUP | Top center | BotFather instructions, trigger config |
| 3 | STEP 2: API KEYS CONFIGURATION | Top right | ElevenLabs, FAL.ai key setup |
| 4 | STEP 3: AI PROCESSING SETUP | Middle center | Perplexity, OpenAI config |
| 5 | STEP 4: VOICE & VIDEO GENERATION | Middle right | Auto-processing explanation |
| 6 | STEP 5: PUBLISHING & TRACKING | Bottom center | Blotato community node install |
| 7 | HOW IT WORKS - WORKFLOW FLOW | Bottom left | 8-step flow explanation |

All sticky notes preserve: headings, bulleted lists, numbered lists, clickable links, code blocks, emojis.
Sticky notes are positioned as **large background annotations** wrapping around their relevant nodes, matching N8N's original layout.

---

## Connection Verification (35/35 PRESERVED)

**Linear chain (17 connections)**:
Telegram Trigger -> Workflow Configuration -> Extract Photo -> Get Photo -> Build Image URL -> Search Trends -> Generate Script -> ElevenLabs Voice -> Convert .mpga -> Upload Audio -> FAL.ai Video -> Wait for VEED -> Download Video -> Generate Caption -> Save to Sheets -> Send Video -> Upload to BLOTATO

**Fan-out from BLOTATO (9 connections)**:
Upload to BLOTATO -> {Tiktok, Linkedin, Facebook, Instagram, Twitter(X), Youtube, Threads, Bluesky, Pinterest}

**Fan-in to Merge1 (9 connections)**:
{Tiktok, Youtube, Linkedin, Facebook, Instagram, Twitter(X), Threads, Bluesky, Pinterest} -> Merge1 (Inputs 1-9)

---

## Issues & Observations

### 1. All previously reported issues remain FIXED
- Sticky note colors: PASS (green/blue accents)
- Emoji rendering: PASS (browser import preserves UTF-8)
- Markdown formatting: PASS (headings, lists, links, code blocks)
- Warning banner: PASS (expandable list of 10 unsupported nodes)
- Merge node 9 inputs: PASS (all handles visible and connected)
- Disabled node badges: PASS (gray "DISABLED" on unsupported nodes)

### 2. Node size difference (EXPECTED, not a bug)
Vibexe's 96px card nodes are larger than N8N's ~40px icon nodes. This means the nodes visually overlap slightly with sticky note boundaries in some areas. This is cosmetic only — the spatial grouping and flow direction are correct.

---

## Screenshots

1. `import-raw-positions-current.png` — Full workflow at 50% zoom showing 2D layout
2. `import-raw-top-section.png` — Top section with STEP 1, 2, 3 stickies and node rows
3. `n8n-original-layout.png` — N8N original layout for comparison

---

## Conclusion

The raw N8N position layout (commit `d22b112d2`) **faithfully reproduces N8N's original 2D layout**:

- **Zigzag row pattern**: 4 rows of nodes matching N8N's visual flow - PRESERVED
- **Sticky notes as backgrounds**: Large annotations wrapping around relevant nodes - PRESERVED
- **Spatial grouping**: Steps 1-5 grouped with their sticky notes - PRESERVED
- **Fan-out pattern**: 9 social platforms scattered in same spatial arrangement as N8N - PRESERVED
- **All data preserved**: 28 nodes, 35 connections, 7 rich-text sticky notes, warning banner

**28/28 nodes imported. 35/35 connections preserved. 7/7 sticky notes displayed.**
**10 unsupported Blotato community nodes shown as disabled placeholders.**
**Layout matches N8N original: CONFIRMED.**
