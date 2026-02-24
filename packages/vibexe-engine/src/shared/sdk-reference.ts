/**
 * Shared SDK Reference — Single source of truth for @vibexe/sdk API documentation
 *
 * All agent prompts import from here to ensure consistent, correct SDK signatures.
 * Derived from packages/vibexe-sdk/src/data.ts and packages/vibexe-sdk/src/auth.ts.
 */

/** Core API reference with correct signatures and return types */
export const SDK_API_REFERENCE = `
## @vibexe/sdk — Complete API Reference

\`\`\`typescript
import { VibexeApp } from "@vibexe/sdk";
const app = new VibexeApp({ appId: "..." }); // appId injected at runtime

// ─── CRUD Operations ───
// list() returns PaginatedResponse, NOT a plain array
const result = await app.data.list("tasks");
const result = await app.data.list("tasks", {
  filter: { status: "active", assigned_to: userId },  // "filter" (singular), NOT "filters"
  sort: "created_at",                                  // string field name, NOT an object
  order: "desc",                                       // separate param: "asc" | "desc"
  page: 1,                                             // 1-indexed page number, NOT "offset"
  limit: 50,
  search: "urgent bug",                                // full-text search across indexed fields
});
// result = { data: Task[], pagination: { page, limit, total, totalPages } }
// Access the array: result.data
// Access pagination: result.pagination.total, result.pagination.totalPages

// Advanced filter operators (beyond equality)
const result = await app.data.list("products", {
  filter: {
    price: { gte: 10, lte: 100 },      // range: price >= 10 AND price <= 100
    status: { in: ["active", "featured"] },  // set: status IN ('active', 'featured')
    name: { like: "Pro%" },              // pattern: name ILIKE 'Pro%'
    stock: { gt: 0 },                    // greater than: stock > 0
    category: { ne: "archived" },        // not equal: category != 'archived'
  },
});
// Supported operators: eq, ne, gt, gte, lt, lte, like (ILIKE), in (array)
// Plain values still work: filter: { status: "active" } → equality

await app.data.get("tasks", id);                      // returns single item directly
await app.data.get("tasks", id, { include: ["author", "comments"] }); // with relations

// ─── Relation Population (include) ───
// Populate relation fields to avoid N+1 manual queries
const posts = await app.data.list("posts", {
  include: ["author", "category"],  // populate many-to-one relations
});
// posts.data[0].author = { id: 1, name: "John", ... }  (nested object, not just FK ID)
// posts.data[0].category = { id: 3, name: "Tech", ... }

const post = await app.data.get("posts", 1, { include: ["author", "comments"] });
// post.author = { id: 1, name: "John", ... }       (many-to-one: single object)
// post.comments = [{ id: 10, text: "Great!", ... }] (one-to-many: array of children)
// Max 5 includes per request. Only relation-type fields can be included.

await app.data.create("tasks", { title: "New", status: "active" }); // returns created item
await app.data.update("tasks", id, { status: "done" });             // returns updated item
await app.data.delete("tasks", id);                                  // returns void

// ─── Nested Create (parent + children in one call, atomic transaction) ───
const order = await app.data.create("orders", {
  customer_name: "John",
  total: 150,
  order_items: [                    // ← matches child entity table name
    { product_name: "Widget", qty: 2, price: 50 },
    { product_name: "Gadget", qty: 1, price: 50 },
  ],
});
// order = { id: 1, customer_name: "John", ..., order_items: [{ id: 1, order_id: 1, ... }, ...] }
// Children are created in a transaction — if any child fails, everything rolls back.
// The child entity must have a many-to-one FK pointing to the parent entity.

// ─── Reverse Relation Routes (access children via parent) ───
// List children: GET /data/{parent}/{id}/{children_table}
const comments = await app.data.listRelated("posts", postId, "comments", {
  sort: "created_at", order: "desc", limit: 50,
});
// comments = { data: [...], pagination: { page, limit, total, totalPages } }

// Create child under parent (auto-injects FK)
const comment = await app.data.createRelated("posts", postId, "comments", {
  text: "Great post!", user_id: userId,
});
// comment = { id: 10, post_id: postId, text: "Great post!", ... }

// ─── Deep Filtering (filter on related entity fields) ───
// Filter posts by author name (dot-notation on relation fields)
const result = await app.data.list("posts", {
  filter: { "author.name": "John" },           // author is a many-to-one relation
});
// Generates: LEFT JOIN authors ON posts.author_id = authors.id WHERE authors.name = 'John'

// Also supports filter operators on related fields
const result2 = await app.data.list("orders", {
  filter: { "customer.status": { ne: "banned" } },
});

// ─── Cascade Delete Warnings ───
// Preview what would be affected before deleting
const preview = await app.data.deleteWithInfo("authors", authorId, { dryRun: true });
// preview = { dryRun: true, wouldAffect: { posts: { count: 5, action: "SET NULL" } } }

// Delete with cascade info in response
const result3 = await app.data.deleteWithInfo("authors", authorId);
// result3 = { success: true, deleted: authorId, cascadeInfo: { posts: { count: 5, action: "SET NULL" } } }

// ─── Batch Operations ───
// Bulk create (up to 500 records per call, atomic transaction)
const batch = await app.data.createMany("tasks", [
  { title: "Task 1", status: "active" },
  { title: "Task 2", status: "active" },
]);
// batch = { created: 2, data: [{ id: 1, ... }, { id: 2, ... }] }

// Bulk update (each item needs id + data)
const updates = await app.data.updateMany("tasks", [
  { id: 1, data: { status: "done" } },
  { id: 2, data: { status: "done" } },
]);
// updates = { updated: 2, errors: 0, results: [...] }

// Bulk delete by IDs
const deleted = await app.data.deleteMany("tasks", [1, 2, 3]);
// deleted = { deleted: 3 }

// ─── Aggregation ───
// Get grouped statistics without fetching all rows
const stats = await app.data.aggregate("orders", {
  group: "status",    // group by this field
  count: true,        // include COUNT(*)
  sum: "amount",      // SUM(amount) — must be numeric field
  avg: "amount",      // AVG(amount) — must be numeric field
  min: "created_at",  // MIN(created_at)
  max: "created_at",  // MAX(created_at)
  filter: { status: { in: ["active", "completed"] } },  // same advanced filters
});
// stats = { data: [{ status: "active", count: 42, sum_amount: 15000, avg_amount: 357.14, ... }, ...] }

// Without group — returns single row with totals
const totals = await app.data.aggregate("orders", { count: true, sum: "amount" });
// totals = { data: [{ count: 100, sum_amount: 45000 }] }

// ─── Real-Time Subscriptions ───
// subscribe() opens an SSE connection and calls callback on data changes
const unsubscribe = app.data.subscribe("tasks", (event) => {
  // event.entity: string          — e.g. "tasks"
  // event.action: "created" | "updated" | "deleted"
  // event.record: the full row (created/updated) or { id } (deleted)
  // event.timestamp: ISO string
});

// With client-side filter (only receive events matching filter)
const unsub = app.data.subscribe("tasks", { filter: { status: "active" } }, (event) => {
  console.log("Active task changed:", event);
});

// Cleanup — call the returned function to close the connection
unsubscribe();

// ─── Auth ───
// signUp/signIn return AuthResponse { user, token }, NOT user directly
const response = await app.auth.signUp({ email, password, displayName }); // "displayName", NOT "name"
// response = { user: AppUser, token: string }
// response.user = { id, email, display_name, role, email_verified, auth_provider, avatar_url, created_at }

const response = await app.auth.signIn({ email, password });
// response = { user: AppUser, token: string }

// Social OAuth (popup-based — opens provider consent screen in popup window)
const { user, token } = await app.auth.signInWithGoogle();
const { user, token } = await app.auth.signInWithGitHub();
// Returns same AuthResponse { user, token }. Popup closes automatically.
// If user cancels popup, throws Error("Authentication cancelled").
// OAuth must be enabled in Dashboard > Settings > Auth for the provider.

await app.auth.signOut();
const user = await app.auth.getCurrentUser();   // returns AppUser | null
app.auth.isAuthenticated();                      // boolean (sync check)
const token = app.auth.getToken();               // returns string | null
// Session token: localStorage "vibexe_session" (SDK manages automatically)

// ─── Serverless Functions ───
// Invoke custom backend functions registered in the Functions panel
const result = await app.functions.invoke("calculatePrice", { items: [...] });
// Sends POST to /api/apps/{appId}/functions/{name}
// Returns whatever the function returns

// ─── Background Jobs (Scheduled Tasks) ───
// Create a recurring job that runs a registered function on a cron schedule
const job = await app.jobs.create({
  name: "daily-cleanup",
  functionName: "dailyCleanup",       // must be a registered function
  cronExpression: "0 2 * * *",        // 2 AM daily (min interval: 5 min)
  timezone: "UTC",
  description: "Clean up expired sessions",
  retryPolicy: { maxRetries: 3, initialDelayMs: 5000, maxDelayMs: 300000, backoffMultiplier: 2 },
  timeoutMs: 30000,
});

const { data: jobs, pagination } = await app.jobs.list({ page: 1, limit: 20 });
const jobDetail = await app.jobs.get(jobId);  // includes recentRuns array
await app.jobs.update(jobId, { enabled: false });
await app.jobs.delete(jobId);

// Manual trigger — run job immediately bypassing schedule
const run = await app.jobs.trigger(jobId);
// run = { status: "completed"|"failed"|"retrying", durationMs, runId }

// Run history
const { data: runs } = await app.jobs.runs(jobId, { page: 1, status: "failed" });

// Dead letter queue — jobs that exhausted all retries
const { data: dlq } = await app.jobs.dlq();
await app.jobs.acknowledgeDlq(dlqId);

// ─── Webhooks ───
// Create a webhook to be notified when events happen
const webhook = await app.webhooks.create({
  url: "https://example.com/webhooks/vibexe",
  events: ["entity.created:tasks", "user.signup"],
  description: "Notify Slack on new tasks",
  secret: "whsec_...",  // optional — enables HMAC-SHA256 payload signing
  headers: { "Authorization": "Bearer ..." },  // optional custom headers
});

// List all webhooks
const { webhooks } = await app.webhooks.list();

// Delete a webhook
await app.webhooks.delete(webhook.dbId);

// ─── File Storage ───
// Upload a file
const { url, path, size } = await app.storage.upload(fileInput.files[0], "avatars/photo.jpg");

// Get image URL with transforms (on-the-fly resize/format)
const thumbUrl = app.storage.getUrl("avatars/photo.jpg", { width: 200, height: 200, format: "webp" });

// List files with optional prefix
const { files, hasMore, cursor } = await app.storage.list("avatars/");
// files = [{ path, size, contentType, uploadedAt, url }, ...]

// Download as Blob
const blob = await app.storage.download("avatars/photo.jpg");

// Delete
await app.storage.delete("avatars/photo.jpg");
\`\`\`

**Entity naming**: \`define_entities\` uses PascalCase names (e.g. "BlogPost"). SDK calls use the auto-generated snake_case table name: \`app.data.list("blog_posts")\`.

### FK Cascade Options (define_entities)
Relation fields support an optional \`onDelete\` property:
- \`"SET NULL"\` (default) — child FK set to NULL when parent is deleted
- \`"CASCADE"\` — child rows are deleted when parent is deleted
- \`"RESTRICT"\` — parent deletion is blocked if children exist

Example in define_entities:
\`\`\`
{ name: "order_id", type: "relation", relationTo: "Order", relationType: "many-to-one", onDelete: "CASCADE" }
\`\`\`

### CRITICAL — Common Mistakes to Avoid
| Wrong (agents used to teach this) | Correct |
|-----------------------------------|---------|
| \`filters: { status: "active" }\` | \`filter: { status: "active" }\` (singular) |
| \`sort: { created_at: "desc" }\` | \`sort: "created_at", order: "desc"\` (separate params) |
| \`offset: page * PAGE_SIZE\` | \`page: 1\` (1-indexed page number) |
| \`signUp({ email, password, name })\` | \`signUp({ email, password, displayName })\` |
| \`const data = await app.data.list(...); setItems(data)\` | \`const result = await app.data.list(...); setItems(result.data)\` |
| \`const user = await app.auth.signIn(...)\` | \`const { user } = await app.auth.signIn(...)\` (returns AuthResponse) |
| "This account uses social login" error on signIn | User signed up via Google/GitHub (no password). Cannot use email/password signin. | Use \`app.auth.signInWithGoogle()\` or \`app.auth.signInWithGitHub()\` instead |
| Popup blocked when calling signInWithGoogle/signInWithGitHub | Browser blocks popups not triggered by user gesture | Call \`signInWithGoogle()\` directly inside a click handler, NOT in async chains or useEffect |
| \`app.data.aggregate("x", {})\` returns error | At least one aggregation param required | Pass \`count: true\`, \`sum: "field"\`, etc. |
| Manual N+1 queries to fetch related records | Use \`include\` to populate relations in one request | \`app.data.list("posts", { include: ["author"] })\` → \`post.author = { id, name, ... }\` |
| \`sum\`/\`avg\` aggregate on text field fails | \`sum\` and \`avg\` only work on numeric fields | Use numeric field names, or use \`count: true\` / \`min\` / \`max\` for non-numeric |
`;

/** Correct data hook pattern showing result.data destructuring */
export const SDK_HOOK_PATTERN = `
## Custom Data Hook Pattern

Every entity gets a dedicated hook that encapsulates ALL SDK interactions:

\`\`\`typescript
// src/hooks/useComments.ts
import { useState, useEffect, useCallback } from "react";
import { VibexeApp } from "@vibexe/sdk";
import type { Comment, CreateCommentInput } from "../types";

const app = new VibexeApp({ appId: "..." });

export function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await app.data.list("comments", {
        filter: { post_id: postId },
        sort: "created_at",
        order: "desc",
      });
      setComments(result.data);  // .data extracts the array from PaginatedResponse
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const createComment = async (input: CreateCommentInput) => {
    const comment = await app.data.create("comments", { ...input, post_id: postId });
    setComments(prev => [comment, ...prev]);
    return comment;
  };

  const deleteComment = async (id: string) => {
    await app.data.delete("comments", id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  // Real-time: auto-update when data changes on server
  useEffect(() => {
    const unsub = app.data.subscribe("comments", { filter: { post_id: postId } }, (event) => {
      if (event.action === "created") setComments(prev => [event.record as Comment, ...prev]);
      if (event.action === "updated") setComments(prev => prev.map(c => c.id === (event.record as Comment).id ? event.record as Comment : c));
      if (event.action === "deleted") setComments(prev => prev.filter(c => c.id !== (event.record as any).id));
    });
    return unsub;
  }, [postId]);

  return { comments, loading, error, createComment, deleteComment, refetch: fetchComments };
}
\`\`\`

### Hook Rules
- **One hook per entity** (or per entity + filter context, like \`useComments(postId)\`)
- **Components call hook methods** — never call \`app.data.*\` directly in components
- **Optimistic updates**: Update local state immediately, revert on error
- **Error handling**: Every SDK call in a try/catch, error stored in hook state
- **Loading states**: Set loading before fetch, clear in finally block
- **list() returns PaginatedResponse**: Always use \`result.data\` to get the array
`;

/** Correct auth flow pattern with AuthResponse destructuring */
export const SDK_AUTH_PATTERN = `
## Auth Flow Pattern

\`\`\`typescript
// src/hooks/useAuth.ts
const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const currentUser = await app.auth.getCurrentUser();
        setUser(currentUser);
      } catch {
        // No valid session — stay logged out
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await app.auth.signIn({ email, password });
    setUser(response.user);  // response = { user, token } — extract .user
    return response.user;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const response = await app.auth.signUp({ email, password, displayName }); // "displayName", NOT "name"
    setUser(response.user);  // response = { user, token } — extract .user
    return response.user;
  };

  // Social OAuth — popup-based, returns same AuthResponse
  const signInWithGoogle = async () => {
    const response = await app.auth.signInWithGoogle();
    setUser(response.user);
    return response.user;
  };

  const signInWithGitHub = async () => {
    const response = await app.auth.signInWithGitHub();
    setUser(response.user);
    return response.user;
  };

  const signOut = async () => {
    await app.auth.signOut();
    setUser(null);
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signInWithGoogle, signInWithGitHub, signOut, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
\`\`\`

### Auth Patterns
- **Public app**: No auth needed. Anyone can read/write.
- **Login required**: Wrap app with AuthProvider. Show Login/Register when no user.
- **Social login**: Add "Sign in with Google" / "Sign in with GitHub" buttons that call \`signInWithGoogle()\` / \`signInWithGitHub()\`. Opens a popup — user sees consent screen, popup closes automatically, SDK stores session. Provider must be enabled in Dashboard > Settings > Auth.
- **Mixed auth**: Offer both email/password AND social login. Accounts link by email — if a user signs up with email then later signs in with Google using the same email, it links to the same account.
- **Owner-only data**: The backend enforces RLS automatically — when the entity policy is set to "owner", the server auto-filters queries to \`user_id = currentUser\` and auto-injects \`user_id\` on create. No client-side filter needed.
- **Role-based**: The backend checks \`user.role\` against the entity's allowedRoles list. Use \`user.role\` in UI for conditional rendering: \`if (user.role === "admin")\`

### Row-Level Security (RLS) — Server-Side Enforcement
RLS is enforced automatically by the backend based on entity access policies. No SDK code changes are needed.

| Policy Level | Read Behavior | Write/Delete Behavior |
|-------------|--------------|----------------------|
| \`public\` | Anyone can read, no auth needed | Anyone can write/delete, no auth needed |
| \`authenticated\` | Must be logged in (Bearer token) | Must be logged in |
| \`owner\` | Only see rows where \`user_id\` = your user ID | Can only modify/delete your own rows. \`user_id\` is auto-set on create. |
| \`role\` | Only allowed roles can read | Only allowed roles can write/delete |
| \`custom\` | Server-defined WHERE clause with \`$userId\`/\`$userRole\` | Same custom WHERE for writes/deletes |

**For owner-based apps**: Add a \`user_id\` (number) field to your entities. The backend auto-populates it on create and filters on read/update/delete. Do NOT manually set \`user_id\` in create calls — the server enforces it.

**API key requests bypass RLS entirely** — they represent the app builder (admin access).
`;

/** Common data patterns with correct pagination, search, and cascading delete */
export const SDK_COMMON_PATTERNS = `
## Common Data Patterns

### Pagination
\`\`\`typescript
const PAGE_SIZE = 20;
const [page, setPage] = useState(1);  // 1-indexed
const result = await app.data.list("items", { limit: PAGE_SIZE, page });
setItems(result.data);
setTotalPages(result.pagination.totalPages);
\`\`\`

### Search + Filter
\`\`\`typescript
// Full-text search (uses PostgreSQL tsvector when configured, ILIKE fallback)
const result = await app.data.list("tasks", { search: "urgent bug" });
setTasks(result.data);

// Search + advanced filters combined
const fetchFiltered = async (searchTerm: string, filters: Record<string, unknown>) => {
  const cleanFilter = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) => v !== "" && v !== "all")
  );
  const result = await app.data.list("tasks", {
    search: searchTerm,
    filter: cleanFilter,
    sort: "created_at",
    order: "desc",
  });
  setTasks(result.data);
};

// Advanced range filter
const expensive = await app.data.list("products", {
  filter: { price: { gte: 100 }, status: { in: ["active", "featured"] } },
});
\`\`\`

### Aggregation
\`\`\`typescript
// Dashboard stats
const stats = await app.data.aggregate("orders", {
  group: "status", count: true, sum: "amount",
});
// stats.data = [{ status: "active", count: 42, sum_amount: 15000 }, ...]

// Total count without grouping
const { data: [totals] } = await app.data.aggregate("users", { count: true });
console.log("Total users:", totals.count);
\`\`\`

### Real-Time Subscription
\`\`\`typescript
// Subscribe to entity changes — auto-update UI when data changes
useEffect(() => {
  const unsub = app.data.subscribe("tasks", (event) => {
    if (event.action === "created") setTasks(prev => [...prev, event.record]);
    if (event.action === "updated") setTasks(prev => prev.map(t => t.id === event.record.id ? event.record : t));
    if (event.action === "deleted") setTasks(prev => prev.filter(t => t.id !== event.record.id));
  });
  return unsub; // cleanup on unmount
}, []);
\`\`\`

### Relation Population (include)
\`\`\`typescript
// Fetch posts with nested author and category objects (many-to-one)
const result = await app.data.list("posts", {
  include: ["author", "category"],
  sort: "created_at",
  order: "desc",
});
// result.data[0].author = { id: 1, name: "John", email: "john@..." }
// result.data[0].category = { id: 3, name: "Tech" }

// Fetch a single post with one-to-many children
const post = await app.data.get("posts", postId, { include: ["author", "comments"] });
// post.author = { id: 1, name: "John" }
// post.comments = [{ id: 10, text: "Great!", post_id: 1, ... }, ...]

// Combine with filters — filters still work when include is active
const result = await app.data.list("posts", {
  filter: { status: "published" },
  include: ["author"],
  limit: 10,
});
\`\`\`

### Cascading Delete
\`\`\`typescript
// Option 1: Use onDelete: "CASCADE" in define_entities (recommended for strict parent-child)
// The DB automatically deletes children when parent is deleted.

// Option 2: Preview cascade impact before deleting
const preview = await app.data.deleteWithInfo("projects", projectId, { dryRun: true });
// preview = { dryRun: true, wouldAffect: { tasks: { count: 12, action: "SET NULL" } } }
if (confirm(\`This will affect \${preview.wouldAffect.tasks?.count ?? 0} tasks. Continue?\`)) {
  await app.data.delete("projects", projectId);
}

// Option 3: Manual cascade (when you need custom cleanup logic)
const result = await app.data.list("tasks", { filter: { project_id: projectId } });
await Promise.all(result.data.map(t => app.data.delete("tasks", t.id)));
await app.data.delete("projects", projectId);
\`\`\`

### Reverse Relation Routes
\`\`\`typescript
// List children via parent — cleaner than filtering
const comments = await app.data.listRelated("posts", postId, "comments", {
  sort: "created_at", order: "desc",
});
// Same as: app.data.list("comments", { filter: { post_id: postId } })
// But more semantic and auto-validated against the schema.

// Create child via parent — FK auto-injected
const comment = await app.data.createRelated("posts", postId, "comments", {
  text: "Nice post!",
});
// Equivalent to: app.data.create("comments", { text: "Nice post!", post_id: postId })
\`\`\`

### Deep Filtering (filter on related fields)
\`\`\`typescript
// Filter by related entity fields using dot-notation
const result = await app.data.list("posts", {
  filter: { "author.name": "John", status: "published" },
});
// Combines: JOIN on author relation + WHERE on both tables
\`\`\`

### File Upload (profile picture)
\`\`\`typescript
const handleAvatarUpload = async (file: File) => {
  const { url } = await app.storage.upload(file, "avatars/" + user.id + ".jpg");
  await app.data.update("users", user.id, { avatar_url: url });
};

// Display with transform
<img src={app.storage.getUrl(user.avatar_url, { width: 80, height: 80, format: "webp" })} />
\`\`\`
`;

/** Error catalog entries for build-error-resolver — 6 new API mismatch diagnoses */
export const SDK_ERROR_CATALOG = `
### API Mismatch Errors (commonly caused by wrong SDK usage patterns)

| Error Pattern | Root Cause | Fix |
|--------------|-----------|-----|
| \`data.map is not a function\` or \`TypeError: X.map is not a function\` after \`app.data.list()\` | \`list()\` returns \`{ data: [...], pagination: {...} }\` (PaginatedResponse), NOT a plain array | Change \`const data = await app.data.list(...); data.map(...)\` to \`const result = await app.data.list(...); result.data.map(...)\` |
| \`user.email is undefined\` or \`Cannot read properties of undefined (reading 'email')\` after \`signIn()\` | \`signIn()\` returns \`{ user, token }\` (AuthResponse), NOT the user directly | Change \`const user = await app.auth.signIn(...)\` to \`const { user } = await app.auth.signIn(...)\` or \`const response = await app.auth.signIn(...); response.user\` |
| \`filters\` parameter seems to be ignored — data is not filtered | SDK parameter is \`filter\` (singular), not \`filters\` (plural) | Change \`{ filters: { status: "active" } }\` to \`{ filter: { status: "active" } }\` |
| Data not sorted despite passing sort option | \`sort\` must be a string field name with a separate \`order\` param, NOT an object | Change \`{ sort: { created_at: "desc" } }\` to \`{ sort: "created_at", order: "desc" }\` |
| \`display_name\` is null even though user entered a name on signup | SDK signup parameter is \`displayName\` (camelCase), not \`name\` | Change \`signUp({ email, password, name: "..." })\` to \`signUp({ email, password, displayName: "..." })\` |
| Pagination not working, always shows same data | SDK uses \`page\` (1-indexed page number), not \`offset\` | Change \`{ offset: page * PAGE_SIZE }\` to \`{ page: pageNumber }\` where pageNumber starts at 1 |
`;

/** Review checklist entries for code-reviewer — 6 new API mismatch checks */
export const SDK_REVIEW_CHECKLIST = `
### SDK API Parameter Checks (verify correct parameter names and return types)

| Pattern to Flag | Problem | Correct Usage |
|-----------------|---------|---------------|
| \`filters:\` in SDK list() options | Wrong param name — data won't be filtered | Use \`filter:\` (singular) |
| \`sort: { field: "direction" }\` or \`sort: { created_at: "desc" }\` | Sort must be a string, not an object | Use \`sort: "field_name", order: "asc" \\| "desc"\` |
| \`offset:\` in SDK list() options | Wrong param name — pagination won't work | Use \`page: N\` (1-indexed page number) |
| \`setItems(data)\` or \`data.map()\` directly after \`app.data.list()\` | list() returns PaginatedResponse \`{ data, pagination }\`, not an array | Use \`result.data.map()\` or \`setItems(result.data)\` |
| \`signUp({ name: ... })\` or \`signUp({ ..., name })\` | Wrong param name — display_name won't be saved | Use \`signUp({ displayName: ... })\` |
| \`const user = await app.auth.signIn(...)\` then \`user.email\` | signIn returns \`{ user, token }\`, not user directly | Destructure: \`const { user } = await app.auth.signIn(...)\` |
| \`signInWithGoogle()\` called in useEffect or async chain | Popup will be blocked by browser. Must be in direct click handler. | Move call into onClick handler: \`<button onClick={() => signInWithGoogle()}>...\` |
| \`filter: { price: ">100" }\` for range queries | String comparison, not numeric. Use advanced operators | \`filter: { price: { gt: 100 } }\` |
| \`app.data.aggregate("orders", { sum: "status" })\` | \`sum\`/\`avg\` must be numeric fields | Use \`count: true\` or \`min\`/\`max\` for non-numeric fields |
`;

/** Correct mock return shapes for TDD testing */
export const SDK_MOCK_PATTERNS = `
### SDK Mock Pattern

\`\`\`typescript
// src/utils/__tests__/mocks.ts — SDK mock for testing
export const mockApp = {
  data: {
    list: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
    get: vi.fn().mockResolvedValue(null), // get(entity, id, options?) — options.include populates relations
    create: vi.fn().mockImplementation((entity, data) =>
      Promise.resolve({ id: "mock-id", ...data, created_at: new Date().toISOString() })
    ),
    update: vi.fn().mockImplementation((entity, id, data) =>
      Promise.resolve({ id, ...data })
    ),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteWithInfo: vi.fn().mockResolvedValue({ success: true, deleted: 1 }),
    listRelated: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
    createRelated: vi.fn().mockImplementation((entity, id, relation, data) =>
      Promise.resolve({ id: "mock-id", ...data, created_at: new Date().toISOString() })
    ),
    subscribe: vi.fn().mockReturnValue(() => {}), // returns unsubscribe function
    aggregate: vi.fn().mockResolvedValue({ data: [] }),
  },
  auth: {
    signUp: vi.fn().mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", display_name: null, role: "user", email_verified: false, auth_provider: "email", avatar_url: null, created_at: new Date().toISOString() },
      token: "mock-token",
    }),
    signIn: vi.fn().mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", display_name: null, role: "user", email_verified: false, auth_provider: "email", avatar_url: null, created_at: new Date().toISOString() },
      token: "mock-token",
    }),
    signInWithGoogle: vi.fn().mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", display_name: "Test User", role: "user", email_verified: true, auth_provider: "google", avatar_url: "https://lh3.googleusercontent.com/photo.jpg", created_at: new Date().toISOString() },
      token: "mock-token",
    }),
    signInWithGitHub: vi.fn().mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", display_name: "Test User", role: "user", email_verified: true, auth_provider: "github", avatar_url: "https://avatars.githubusercontent.com/u/123", created_at: new Date().toISOString() },
      token: "mock-token",
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockReturnValue(null),
    isAuthenticated: vi.fn().mockReturnValue(false),
    getToken: vi.fn().mockReturnValue(null),
  },
  storage: {
    upload: vi.fn().mockResolvedValue({ url: "/storage/test.jpg", path: "test.jpg", size: 1024, contentType: "image/jpeg" }),
    download: vi.fn().mockResolvedValue(new Blob()),
    list: vi.fn().mockResolvedValue({ files: [], hasMore: false }),
    delete: vi.fn().mockResolvedValue(undefined),
    getUrl: vi.fn().mockImplementation((path, transforms) => "/storage/" + path),
  },
  functions: {
    invoke: vi.fn().mockResolvedValue(null),
  },
  jobs: {
    create: vi.fn().mockResolvedValue({ id: 1, name: "test-job", function_name: "testFn", cron_expression: "*/5 * * * *", enabled: true }),
    list: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
    get: vi.fn().mockResolvedValue({ id: 1, name: "test-job", recentRuns: [] }),
    update: vi.fn().mockResolvedValue({ id: 1, enabled: false }),
    delete: vi.fn().mockResolvedValue(undefined),
    trigger: vi.fn().mockResolvedValue({ status: "completed", durationMs: 100, runId: 1 }),
    runs: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
    dlq: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
    acknowledgeDlq: vi.fn().mockResolvedValue(undefined),
  },
  webhooks: {
    create: vi.fn().mockResolvedValue({ dbId: 1, url: "https://example.com/webhook", events: ["entity.created:tasks"], enabled: true }),
    list: vi.fn().mockResolvedValue({ webhooks: [] }),
    delete: vi.fn().mockResolvedValue(undefined),
  },
};
\`\`\`

**Important**: \`list()\` mock returns \`{ data: [], pagination: {...} }\` — NOT a plain array. \`signUp\`/\`signIn\` mocks return \`{ user: {...}, token: "..." }\` — NOT a user object directly.
`;

/** Correct E2E auth flow validation with proper destructuring */
export const SDK_E2E_AUTH_FLOW = `
### Auth Flow Validation Pattern
\`\`\`typescript
async function validateAuthFlow(): Promise<FlowResult> {
  const steps: FlowResult["steps"] = [];
  const testEmail = \\\`e2e-\\\${Date.now()}@test.com\\\`;
  const testPassword = "TestPass123!";

  try {
    // Sign up — returns { user, token }, extract user
    const signUpResponse = await app.auth.signUp({
      email: testEmail,
      password: testPassword,
      displayName: "E2E User",  // "displayName", NOT "name"
    });
    steps.push({ name: "Sign up new user", pass: !!signUpResponse.user?.id });

    // Sign out
    await app.auth.signOut();
    steps.push({ name: "Sign out", pass: !app.auth.isAuthenticated() });

    // Sign back in — returns { user, token }, extract user
    const signInResponse = await app.auth.signIn({ email: testEmail, password: testPassword });
    steps.push({ name: "Sign in", pass: !!signInResponse.user?.id });

    // Check current user
    const current = await app.auth.getCurrentUser();
    steps.push({ name: "Get current user", pass: current?.email === testEmail });

    // Clean up
    await app.auth.signOut();
    steps.push({ name: "Final sign out", pass: true });
  } catch (err) {
    steps.push({ name: "Auth flow", pass: false, error: String(err) });
  }

  return { flow: "Authentication", steps };
}
\`\`\`
`;

/** Background jobs API reference for agents */
export const SDK_JOBS_REFERENCE = `
## Background Jobs — Scheduled Task Management

Jobs run registered functions on a cron schedule with automatic retry and dead letter queue.

### Creating a Job
\`\`\`typescript
const job = await app.jobs.create({
  name: "daily-cleanup",          // unique name per app
  functionName: "dailyCleanup",   // must match a registered function name
  cronExpression: "0 2 * * *",    // standard 5-field cron (min: */5 * * * *)
  timezone: "UTC",                // optional, default UTC
  description: "Clean expired sessions",
  retryPolicy: {
    maxRetries: 3,                // default 3
    initialDelayMs: 5000,         // default 5s
    maxDelayMs: 300000,           // default 5min
    backoffMultiplier: 2,         // default 2 (exponential)
  },
  timeoutMs: 30000,               // max 30000
});
\`\`\`

### Job Lifecycle
1. Job created with \`next_run_at\` calculated from cron expression
2. Central cron (every minute) picks up due jobs, executes function in sandbox
3. On failure: retries with exponential backoff (delay = initialDelayMs * multiplier^attempt)
4. After maxRetries exhausted: writes to Dead Letter Queue (_app_job_dlq)
5. DLQ entries can be acknowledged via dashboard or SDK

### SDK Methods
\`\`\`
app.jobs.create(input)           — Create/upsert a scheduled job
app.jobs.list({ page, limit })   — List jobs (paginated)
app.jobs.get(jobId)              — Get job details + recent runs
app.jobs.update(jobId, data)     — Update job config
app.jobs.delete(jobId)           — Delete job + all runs
app.jobs.trigger(jobId)          — Run immediately (bypasses schedule)
app.jobs.runs(jobId, opts)       — Run history (paginated, filterable by status)
app.jobs.dlq({ page })           — List dead letter queue entries
app.jobs.acknowledgeDlq(dlqId)  — Mark DLQ entry as handled
\`\`\`

### Example: Daily Report Job
\`\`\`typescript
// 1. Register the function
// functions/dailyReport.ts
export default async function(ctx) {
  const { data: [totals] } = await ctx.db.query(
    'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL \\'1 day\\') as today FROM "orders"'
  );
  console.log("Daily report:", totals);
  // Could also call ctx.fetch to post to Slack/email
  return totals;
}

// 2. Create the job via SDK
const job = await app.jobs.create({
  name: "daily-report",
  functionName: "dailyReport",
  cronExpression: "0 9 * * *",  // 9 AM daily
});
\`\`\`
`;

/** Backend function file conventions for AI agents */
export const SDK_FUNCTIONS_REFERENCE = `
## Backend Functions — File Convention

Backend functions live in the \`functions/\` directory. Each file exports a default async function
that receives a context object (\`ctx\`). Functions are registered with a trigger type:

### HTTP Endpoint Function
\`\`\`typescript
// functions/calculatePrice.ts
export default async function(ctx) {
  const { items } = ctx.request.body;
  const products = await ctx.db.query(
    'SELECT * FROM "products" WHERE id = ANY($1)',
    [items.map(i => i.product_id)]
  );
  const total = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.product_id);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);
  return { total, currency: "USD" };
}
// Trigger: { triggerType: "http" }
// Call from frontend: app.functions.invoke("calculatePrice", { items })
\`\`\`

### Entity Hook Function
\`\`\`typescript
// functions/validateOrder.ts
export default async function(ctx) {
  // ctx.data = the incoming record data
  // ctx.record = the existing record (for update/delete)
  // ctx.entity = entity name
  // ctx.hookType = "beforeCreate" | "afterCreate" | etc.
  if (!ctx.data.total || ctx.data.total <= 0) {
    throw new Error("Order total must be positive");
  }
  // Return modified data (for "before" hooks)
  return { ...ctx.data, validated_at: new Date().toISOString() };
}
// Trigger: { triggerType: "entity_hook", triggerConfig: { entity: "orders", hook: "beforeCreate" } }
\`\`\`

### Scheduled Function
\`\`\`typescript
// functions/dailyCleanup.ts
export default async function(ctx) {
  const result = await ctx.db.query(
    'DELETE FROM "sessions" WHERE expires_at < NOW() RETURNING id'
  );
  console.log("Cleaned up " + result.length + " expired sessions");
}
// Trigger: { triggerType: "scheduled", triggerConfig: { cron: "0 2 * * *" } }
\`\`\`

### Context Object API
\`\`\`
ctx.db.query(sql, params)     — Parameterized SQL query, returns row array
ctx.db.list(entity, options)  — List rows { data, total } (same as SDK)
ctx.db.get(entity, id)        — Get single row by ID
ctx.db.create(entity, data)   — Insert row, returns created row
ctx.db.update(entity, id, d)  — Update row, returns updated row
ctx.db.delete(entity, id)     — Delete row, returns boolean
ctx.auth                      — { userId, email, role } or null
ctx.env                       — App secrets (key-value from Secrets panel)
ctx.fetch                     — Global fetch for external API calls
ctx.storage.upload(path, buf, ct)  — Upload Buffer to app storage
ctx.storage.download(path)         — Download file, returns Buffer
ctx.storage.list(prefix?)          — List files [{path, size, url}]
ctx.storage.delete(path)           — Delete file from storage
ctx.storage.getUrl(path, transforms?) — Get URL string (with optional transforms)
ctx.console.log/warn/error    — Captured to app logs
ctx.request                   — (HTTP only) { body, headers, query, method }
ctx.data / ctx.record         — (Hook only) mutation data / existing record
ctx.hookType                  — (Hook only) "beforeCreate" | "afterCreate" | etc.
\`\`\`

### Hook Types
| Hook | Runs | Can modify? | Can abort? |
|------|------|------------|------------|
| beforeCreate | Before INSERT | Return modified data | Throw to abort |
| afterCreate  | After INSERT  | No | No (fire-and-forget) |
| beforeUpdate | Before UPDATE | Return modified data | Throw to abort |
| afterUpdate  | After UPDATE  | No | No (fire-and-forget) |
| beforeDelete | Before DELETE | No | Throw to abort |
| afterDelete  | After DELETE  | No | No (fire-and-forget) |
`;
