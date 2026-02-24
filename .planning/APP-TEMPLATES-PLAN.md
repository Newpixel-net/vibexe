# App Templates — Full Implementation Plan

## Context

The Vibexe App Builder generates complete React+TypeScript+Tailwind apps with per-app databases, auth, and deployment. Users invest significant effort building apps (e.g., a 31-file Project Management Dashboard), but there's no way to save these as reusable templates or let other users discover and clone them.

The "App Template" panel exists in the Dashboard Settings sidebar but is currently a 54-line placeholder with a disabled button. This plan turns it into a full template publishing system with a discovery gallery.

---

## Phase 1: Database Schema

**Goal:** Create `builder_app_templates` table.

### Files
| Action | File |
|--------|------|
| MODIFY | `apps/studio.vibexe.ai/db/schema.ts` (~line 2162) |
| RUN ON SERVER | Direct psql SQL (drizzle-kit push is broken) |

### Schema
```sql
CREATE TABLE builder_app_templates (
  db_id SERIAL PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,                                      -- btpl_{nanoid}
  source_app_db_id INTEGER REFERENCES builder_apps(db_id) ON DELETE SET NULL,
  author_user_db_id INTEGER REFERENCES users(db_id),
  team_db_id INTEGER NOT NULL REFERENCES teams(db_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  tags TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  files_snapshot JSONB NOT NULL,                                -- Array<{path, content, language}>
  schema_snapshot JSONB,                                        -- entity definitions
  app_config JSONB DEFAULT '{}',                                -- {visibility, requireLogin}
  visibility TEXT NOT NULL DEFAULT 'public',                    -- public | team | private
  use_count INTEGER NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  entity_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX builder_app_templates_team_db_id_idx ON builder_app_templates(team_db_id);
CREATE INDEX builder_app_templates_category_idx ON builder_app_templates(category);
CREATE INDEX builder_app_templates_visibility_idx ON builder_app_templates(visibility);
CREATE INDEX builder_app_templates_use_count_idx ON builder_app_templates(use_count);
```

**Key decisions:**
- `files_snapshot` is JSONB (template survives source app deletion)
- `source_app_db_id` uses `ON DELETE SET NULL` (not cascade)
- Indexes on category, visibility, useCount for gallery queries

### Verify
- `pnpm build-sdk` compiles
- `\dt builder_app_templates` in psql shows table

---

## Phase 2: Publish API + Query Functions

**Goal:** Backend to snapshot apps into templates, with CRUD operations.

### Files
| Action | File |
|--------|------|
| CREATE | `app/(main)/app-builder/lib/template-queries.ts` |
| CREATE | `app/api/apps/[appId]/template/route.ts` |

### Query Functions (`template-queries.ts`)
Reuses patterns from `queries.ts` (createApp, duplicateApp):

| Function | Purpose |
|----------|---------|
| `publishTemplate(appId, teamDbId, userDbId, metadata)` | Snapshot files + entities + config → insert |
| `updateTemplate(templateId, data)` | Update metadata fields |
| `deleteTemplate(templateId)` | Remove template |
| `getTemplateBySourceApp(appDbId)` | Check if app already published |
| `getTemplateById(templateId)` | Single template with author info |
| `listTemplates(filters)` | Gallery list (no file content) |
| `incrementUseCount(templateDbId)` | Bump counter |
| `refreshTemplateSnapshot(templateId, appId)` | Re-snapshot from current app |

### API Contract (`/api/apps/{appId}/template`)

| Method | Purpose | Body |
|--------|---------|------|
| GET | Get template published from this app | — |
| POST | Publish new template | `{name, description, category, tags, visibility}` |
| PUT | Update template metadata / refresh snapshot | `{name?, description?, category?, tags?, visibility?, refresh?: boolean}` |
| DELETE | Unpublish template | — |

### Shared Constants
```typescript
export const TEMPLATE_CATEGORIES = [
  "Project Management", "E-Commerce", "Dashboard", "CRM",
  "Social", "Content Management", "Education", "Analytics",
  "Communication", "Utility", "Other",
] as const;
```

### Verify
- `curl -X POST /api/apps/bldr_DFd90XqiUtHp3U0D1S6FY/template` with metadata
- Check `builder_app_templates` has row with 31 files in snapshot

---

## Phase 3: Template Panel Rewrite (Publishing UI)

**Goal:** Replace disabled placeholder with full publish/manage form.

### Files
| Action | File |
|--------|------|
| REWRITE | `app/(main)/app-builder/components/app-template-panel.tsx` |

### Three States

**1. Not Published** — Publish form:
- Name (pre-filled from app name)
- Description (textarea)
- Category (dropdown from TEMPLATE_CATEGORIES)
- Tags (comma-separated input)
- Visibility (radio: Public / Team Only / Private)
- "Publish Template" button

**2. Published** — Template info card:
- Editable metadata fields
- Stats display (file count, entity count, use count)
- "Update Snapshot" button (re-captures current files)
- "Update Metadata" button
- "Unpublish" button with confirmation dialog

**3. Loading** — Skeleton shimmer

### UI Pattern
Follows existing dashboard panels (`authentication-panel.tsx`, `domains-panel.tsx`):
- `max-w-3xl mx-auto space-y-6` layout
- `rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm` cards
- `@vibexe-internal/ui/dialog` for confirmation

### Verify
- Navigate to Dashboard > Settings > App Template
- Publish the Project Management Dashboard as template
- Verify metadata appears in "Published" state
- Update description → saved
- Refresh snapshot → file count stays 31
- Unpublish → reverts to "Not Published"

---

## Phase 4: Discovery APIs (List + Detail + Clone)

**Goal:** Public-facing APIs for the template gallery.

### Files
| Action | File |
|--------|------|
| CREATE | `app/api/app-templates/route.ts` |
| CREATE | `app/api/app-templates/[templateId]/route.ts` |
| CREATE | `app/api/app-templates/[templateId]/clone/route.ts` |

### List API
```
GET /api/app-templates?category=Dashboard&search=project&limit=20&offset=0
→ { templates: [...], total: N, categories: [...] }
```
- Returns metadata only (no filesSnapshot)
- Filters: category (exact), search (ilike on name+description)
- Visibility: public OR same team
- Sort by useCount desc

### Detail API
```
GET /api/app-templates/{templateId}
→ { ...metadata, filePaths: [...], entityNames: [...] }
```
- Returns file paths (not content) and entity names for preview

### Clone API (most complex)
```
POST /api/app-templates/{templateId}/clone
Body: { "name": "My Dashboard" }
→ { appId, redirectPath }
```

**Clone logic:**
1. Auth + team membership check
2. Fetch template with snapshots
3. `createApp(teamDbId, userDbId, name)` — new app record
4. Bulk-insert files from `filesSnapshot` into `builderFiles`
5. If `schemaSnapshot` has entities:
   - `ensureAppDatabase(newApp.dbId)` from `lib/app-database/manager.ts`
   - `applySchema(dbName, schemaSnapshot, dbId)` from `lib/app-database/schema-executor.ts`
6. Apply `appConfig` (requireLogin, visibility)
7. `incrementUseCount(template.dbId)`
8. Return redirect path

### Verify
- GET `/api/app-templates` returns published template
- Clone creates new app with 31 files
- Per-app database provisioned with 3 entity tables
- Data browser works on cloned app
- Template useCount incremented

---

## Phase 5: Template Gallery UI

**Goal:** When users click "New App", show a template gallery instead of immediately creating a blank app.

### Files
| Action | File |
|--------|------|
| CREATE | `app/(main)/app-builder/components/template-gallery.tsx` |
| MODIFY | `app/(main)/app-builder/components/app-builder-list.tsx` |

### Gallery Modal Layout
```
┌──────────────────────────────────────────┐
│  Create New App                      [X] │
├──────────────────────────────────────────┤
│  [🔍 Search templates...]               │
│                                          │
│  ┌──────┐  ┌────────────────────────┐    │
│  │ All  │  │ ✨ Start from Scratch  │    │
│  │ PM   │  │  Blank canvas          │    │
│  │ CRM  │  ├────────────────────────┤    │
│  │ Dash │  │ 📊 Project Mgmt        │    │
│  │ Shop │  │  31 files · 3 entities │    │
│  │ ...  │  │  [Use Template]        │    │
│  └──────┘  ├────────────────────────┤    │
│            │ 🛒 E-Commerce Store     │    │
│            │  25 files · 4 entities │    │
│            │  [Use Template]        │    │
│            └────────────────────────┘    │
└──────────────────────────────────────────┘
```

### Integration Changes (`app-builder-list.tsx`)
- "New App" button opens gallery dialog instead of calling `createAppAction`
- Gallery's "Start from Scratch" calls existing `createAppAction` (server action)
- Gallery's "Use Template" calls clone API → redirect

### Verify
- Click "New App" → gallery opens
- Template cards show with correct metadata
- Category filter works
- Search works (debounced)
- "Start from Scratch" creates blank app (existing behavior)
- "Use Template" clones app with all files + entities
- Loading states during clone

---

## Phase 6: End-to-End Test with Project Management Dashboard

**Goal:** Publish the test app and verify full round-trip.

### Steps
1. Open `bldr_DFd90XqiUtHp3U0D1S6FY` → Dashboard > Settings > App Template
2. Publish: name="Project Management Dashboard", category="Project Management", tags="kanban,task,team"
3. Verify DB: `SELECT id, name, file_count, entity_count FROM builder_app_templates;`
4. Go to App Builder list → "New App" → see template in gallery
5. Click "Use Template" → new app created
6. Verify: 31 files, 3 entity tables, auth works, data browser works

### Checklist
- [ ] Template row in DB with file_count=31, entity_count=3
- [ ] Gallery shows template with stats
- [ ] Clone creates unique app (bldr_ prefix)
- [ ] All files copied (Blueprint.md + 31 code files)
- [ ] Per-app DB provisioned (vibexe_app_ prefix)
- [ ] Entity tables exist (tasks, projects, team_members + auth tables)
- [ ] Template useCount incremented
- [ ] Original app unchanged
- [ ] Second clone also works (independent copy)

---

## Dependency Graph

```
Phase 1 (DB Schema)
   ↓
Phase 2 (Publish API)
   ↓
   ├─→ Phase 3 (Template Panel UI) ─────┐
   └─→ Phase 4 (Discovery APIs)         │
           ↓                             │
        Phase 5 (Gallery UI)             │
           ↓                             │
        Phase 6 (E2E Test) ←─────────────┘
```

Phases 3 & 4 can run in parallel. Phase 5 needs Phase 4. Phase 6 needs 3 + 5.

---

## Files Summary

### New (6 files)
| File | Purpose |
|------|---------|
| `app/(main)/app-builder/lib/template-queries.ts` | All template DB operations |
| `app/api/apps/[appId]/template/route.ts` | Publish/update/unpublish (GET/POST/PUT/DELETE) |
| `app/api/app-templates/route.ts` | List templates (GET) |
| `app/api/app-templates/[templateId]/route.ts` | Template detail (GET) |
| `app/api/app-templates/[templateId]/clone/route.ts` | Clone template → new app (POST) |
| `app/(main)/app-builder/components/template-gallery.tsx` | Gallery modal UI |

### Modified (3 files)
| File | Changes |
|------|---------|
| `db/schema.ts` | Add builderAppTemplates table + relations + types |
| `components/app-template-panel.tsx` | Full rewrite: publish form + published state + update/unpublish |
| `components/app-builder-list.tsx` | "New App" opens gallery dialog |

### Critical References (read-only)
| File | Used For |
|------|----------|
| `app/(main)/app-builder/lib/queries.ts` | Pattern: createApp, duplicateApp, saveFile |
| `lib/app-database/manager.ts` | ensureAppDatabase (used by clone) |
| `lib/app-database/schema-executor.ts` | applySchema (used by clone) |
| `lib/app-database/schema-types.ts` | AppSchema type |
| `lib/auth/get-user.ts` | Auth pattern for APIs |

---

## Deploy Command (after each phase)
```bash
# On server:
cd /opt/vibexe && source /home/vibexe/.nvm/nvm.sh && nvm use 24 && \
git fetch vibexe && git reset --hard vibexe/main && \
pnpm build-sdk && pnpm --filter studio.vibexe.ai build && \
pm2 flush vibexe && pm2 restart vibexe
```

Phase 1 also requires psql SQL execution before deploy.
