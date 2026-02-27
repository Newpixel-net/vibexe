/**
 * Sandpack File Adapter
 *
 * Converts AppFile[] to Sandpack's file format for live preview.
 * Sandpack React template expects files at root level (/App.js, /index.js).
 * Includes Tailwind CSS support via Play CDN.
 *
 * Supports multi-file projects with:
 * - Nested directory structures (src/components/Header.tsx -> /components/Header.tsx)
 * - Context providers wrapping App
 * - Custom hooks files
 * - Utility files
 * - Type definition files
 * - Auto-generated entry point with proper imports
 */

import type { AppFile } from "./file-adapter";

export interface SandpackFile {
	code: string;
	hidden?: boolean;
	active?: boolean;
	readOnly?: boolean;
}

export interface SandpackFiles {
	[path: string]: SandpackFile | string;
}

/** Language configuration for Sandpack preview */
export interface SandpackLanguageConfig {
	/** ISO 639-1 code (e.g. "he", "ar", "en") */
	lang: string;
	/** Text direction */
	dir: "ltr" | "rtl";
}

/**
 * Build index.html with Tailwind Play CDN and dynamic language/RTL support.
 */
function buildIndexHtml(langConfig?: SandpackLanguageConfig): string {
	const lang = langConfig?.lang || "en";
	const dir = langConfig?.dir || "ltr";
	const isRtl = dir === "rtl";

	const rtlStyles = isRtl
		? `
        /* RTL base styles */
        [dir="rtl"] { direction: rtl; text-align: right; }
        [dir="rtl"] .flex { flex-direction: row-reverse; }
        [dir="rtl"] .space-x-1 > :not([hidden]) ~ :not([hidden]),
        [dir="rtl"] .space-x-2 > :not([hidden]) ~ :not([hidden]),
        [dir="rtl"] .space-x-3 > :not([hidden]) ~ :not([hidden]),
        [dir="rtl"] .space-x-4 > :not([hidden]) ~ :not([hidden]),
        [dir="rtl"] .space-x-6 > :not([hidden]) ~ :not([hidden]),
        [dir="rtl"] .space-x-8 > :not([hidden]) ~ :not([hidden]) {
          --tw-space-x-reverse: 1;
        }
        [dir="rtl"] .ml-auto { margin-left: unset; margin-right: auto; }
        [dir="rtl"] .mr-auto { margin-right: unset; margin-left: auto; }
        [dir="rtl"] .text-left { text-align: right; }
        [dir="rtl"] .text-right { text-align: left; }
        [dir="rtl"] .pl-4, [dir="rtl"] .pl-6, [dir="rtl"] .pl-8 { padding-left: 0; padding-right: inherit; }
        [dir="rtl"] .pr-4, [dir="rtl"] .pr-6, [dir="rtl"] .pr-8 { padding-right: 0; padding-left: inherit; }`
		: "";

	return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App Preview</title>
    <!-- Google Fonts preconnect for fast loading -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <!-- Tailwind CSS Play CDN - compiles Tailwind classes in browser -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              primary: '#3b82f6',
              secondary: '#64748b',
            }
          }
        }
      }
    </script>
    <style type="text/tailwindcss">
      @layer base {
        body {
          @apply antialiased;
        }
        html {
          scroll-behavior: smooth;
        }${rtlStyles}
      }
    </style>
  </head>
  <body dir="${dir}">
    <div id="root"></div>
  </body>
</html>
`;
}

/** Default index.html (English, LTR) — kept for backward compat */
const TAILWIND_INDEX_HTML = buildIndexHtml();

/**
 * Default App.tsx if no App file exists
 */
const DEFAULT_APP = `import { useState, useEffect } from "react";

const CODE_LINES = [
  [{ t: 'export default ', c: 'kw' }, { t: 'function ', c: 'kw' }, { t: 'App', c: 'fn' }, { t: '() {', c: 'tx' }],
  [{ t: '  ', c: 'tx' }, { t: 'return', c: 'kw' }, { t: ' (', c: 'tx' }],
  [{ t: '    <', c: 'tx' }, { t: 'div', c: 'tg' }, { t: ' className=', c: 'tx' }, { t: '"app"', c: 'st' }, { t: '>', c: 'tx' }],
  [{ t: '      <', c: 'tx' }, { t: 'h1', c: 'tg' }, { t: '>', c: 'tx' }, { t: 'Welcome', c: 'tx' }, { t: '</', c: 'tx' }, { t: 'h1', c: 'tg' }, { t: '>', c: 'tx' }],
  [{ t: '    </', c: 'tx' }, { t: 'div', c: 'tg' }, { t: '>', c: 'tx' }],
  [{ t: '  );', c: 'kw' }],
  [{ t: '}', c: 'kw' }],
];

const WIREFRAMES = [
  { id: 'nav',   x: 40,  y: 30,  w: 320, h: 28,  label: '<nav>',   delay: 0 },
  { id: 'side',  x: 40,  y: 72,  w: 60,  h: 180, label: '<aside>', delay: 400 },
  { id: 'hero',  x: 114, y: 72,  w: 246, h: 90,  label: '<hero>',  delay: 800 },
  { id: 'card1', x: 114, y: 176, w: 117, h: 76,  label: '<card>',  delay: 1200 },
  { id: 'card2', x: 243, y: 176, w: 117, h: 76,  label: '<card>',  delay: 1600 },
];

export default function App() {
  const [phase, setPhase] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [particles] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      left: 8 + Math.random() * 84,
      dur: 6 + Math.random() * 8,
      delay: Math.random() * 6,
      size: 2 + Math.random() * 2,
    }))
  );

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 4200);
    const t2 = setTimeout(() => setPhase(2), 9500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (phase !== 1) return;
    var total = 0;
    for (var li = 0; li < CODE_LINES.length; li++) {
      for (var si = 0; si < CODE_LINES[li].length; si++) {
        total += CODE_LINES[li][si].t.length;
      }
      total += 1;
    }
    var i = 0;
    var iv = setInterval(function() {
      i++;
      setTypedChars(i);
      if (i >= total) clearInterval(iv);
    }, 35);
    return function() { clearInterval(iv); };
  }, [phase]);

  var renderCode = function() {
    var count = 0;
    var result = [];
    for (var li = 0; li < CODE_LINES.length; li++) {
      var line = CODE_LINES[li];
      var lineSpans = [];
      for (var si = 0; si < line.length; si++) {
        var seg = line[si];
        var visible = '';
        for (var ci = 0; ci < seg.t.length; ci++) {
          count++;
          if (count <= typedChars) visible += seg.t[ci];
        }
        if (visible) {
          lineSpans.push(<span key={si} className={"code-" + seg.c}>{visible}</span>);
        }
      }
      count++;
      if (lineSpans.length > 0) {
        result.push(<div key={li} style={{ minHeight: '1.7em' }}>{lineSpans}</div>);
      } else if (count <= typedChars) {
        result.push(<div key={li} style={{ minHeight: '1.7em' }} />);
      }
    }
    return result;
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#0A0A1A',
      overflow: 'hidden', position: 'relative', fontFamily: 'system-ui, sans-serif',
    }}>
      <style>{\`
        @keyframes drawIn {
          from { stroke-dashoffset: 1000; opacity: 0; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes labelIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.92); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes float {
          0%   { transform: translateY(100vh) scale(0); opacity: 0; }
          10%  { opacity: 0.6; transform: translateY(90vh) scale(1); }
          90%  { opacity: 0.3; }
          100% { transform: translateY(-10vh) scale(0.5); opacity: 0; }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(124,58,237,0.4)); }
          50%      { filter: drop-shadow(0 0 16px rgba(124,58,237,0.8)); }
        }
        @keyframes vFadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        .dot-grid {
          background-image: radial-gradient(circle, rgba(124,58,237,0.12) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .code-kw { color: #A78BFA; }
        .code-fn { color: #67E8F9; }
        .code-tg { color: #38BDF8; }
        .code-st { color: #34D399; }
        .code-tx { color: #CBD5E1; }
        .cursor-blink { animation: blink 0.8s step-end infinite; }
      \`}</style>

      {/* Dot grid background */}
      <div className="dot-grid" style={{
        position: 'absolute', inset: 0, opacity: phase === 2 ? 0.3 : 0.6,
        transition: 'opacity 1s',
      }} />

      {/* Act 1: Blueprint Wireframes */}
      {phase <= 1 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: phase === 1 ? 'fadeOut 0.8s ease-in forwards' : undefined,
        }}>
          <svg viewBox="0 0 400 290" style={{
            width: '70%', maxWidth: 560, animation: 'glowPulse 3s ease-in-out infinite',
          }}>
            {WIREFRAMES.map(w => (
              <g key={w.id}>
                <rect
                  x={w.x} y={w.y} width={w.w} height={w.h}
                  rx={4} fill="none" stroke="#7C3AED" strokeWidth={1.5}
                  strokeDasharray="1000" strokeDashoffset="1000"
                  style={{
                    animation: \`drawIn 1s ease-out \${w.delay}ms forwards\`,
                  }}
                />
                {/* Inner detail lines for hero */}
                {w.id === 'hero' && (
                  <>
                    <line x1={w.x+16} y1={w.y+20} x2={w.x+w.w-16} y2={w.y+20}
                      stroke="#4F46E5" strokeWidth={1} opacity={0}
                      style={{ animation: \`drawIn 0.6s ease-out \${w.delay+400}ms forwards\` }} />
                    <line x1={w.x+16} y1={w.y+34} x2={w.x+w.w-60} y2={w.y+34}
                      stroke="#4F46E5" strokeWidth={1} opacity={0}
                      style={{ animation: \`drawIn 0.6s ease-out \${w.delay+550}ms forwards\` }} />
                    <rect x={w.x+16} y={w.y+52} width={80} height={22} rx={4}
                      fill="none" stroke="#4F46E5" strokeWidth={1} opacity={0}
                      style={{ animation: \`drawIn 0.6s ease-out \${w.delay+700}ms forwards\` }} />
                  </>
                )}
                {/* Label */}
                <text
                  x={w.x + 6} y={w.y + 14}
                  fill="#7C3AED" fontSize={9} fontFamily="monospace" opacity={0}
                  style={{ animation: \`labelIn 0.4s ease-out \${w.delay + 600}ms forwards\` }}
                >{w.label}</text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Act 2: Living Code */}
      {phase === 1 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.8s ease-out 0.6s both',
        }}>
          <div style={{
            background: 'rgba(15,15,35,0.85)', border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 12, padding: '28px 32px', maxWidth: 520, width: '80%',
            boxShadow: '0 0 40px rgba(124,58,237,0.15)',
          }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ color: '#64748B', fontSize: 11, marginLeft: 8, fontFamily: 'monospace' }}>App.tsx</span>
            </div>
            <pre style={{
              fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
              fontSize: 14, lineHeight: 1.7, margin: 0, minHeight: 180,
            }}>
              {renderCode()}
              <span className="cursor-blink" style={{
                display: 'inline-block', width: 2, height: 16,
                background: '#7C3AED', verticalAlign: 'text-bottom', marginLeft: 1,
              }} />
            </pre>
          </div>
        </div>
      )}

      {/* Act 3: Finale */}
      {phase === 2 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 1.2s ease-out both',
        }}>
          {/* Gradient glow */}
          <div style={{
            position: 'absolute', width: 320, height: 320, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, rgba(79,70,229,0.08) 50%, transparent 70%)',
            filter: 'blur(40px)', pointerEvents: 'none',
          }} />

          {/* V Logo */}
          <svg width="80" height="80" viewBox="0 0 80 80" style={{
            animation: 'vFadeIn 1s ease-out both', marginBottom: 28,
          }}>
            <defs>
              <linearGradient id="vg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7C3AED" />
                <stop offset="100%" stopColor="#4F46E5" />
              </linearGradient>
            </defs>
            <path d="M20 18 L40 62 L60 18" fill="none" stroke="url(#vg)"
              strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <p style={{
            color: '#E2E8F0', fontSize: 20, fontWeight: 600,
            letterSpacing: '-0.01em', textAlign: 'center',
            animation: 'fadeIn 1s ease-out 0.4s both', margin: 0,
          }}>
            Your app starts with a single prompt
          </p>
          <p style={{
            color: '#64748B', fontSize: 14, marginTop: 12,
            animation: 'fadeIn 1s ease-out 0.8s both',
          }}>
            Describe what you want to build
          </p>
        </div>
      )}

      {/* Floating particles (finale only) */}
      {phase === 2 && particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.left + '%', bottom: 0,
          width: p.size, height: p.size, borderRadius: '50%',
          background: 'rgba(124,58,237,0.5)',
          animation: \`float \${p.dur}s ease-in-out \${p.delay}s infinite\`,
          pointerEvents: 'none',
        }} />
      ))}
    </div>
  );
}
`;

/**
 * Inlined Vibexe SDK for Sandpack browser preview.
 * This is a bundled version of @vibexe/sdk that works in the Sandpack iframe.
 */
const VIBEXE_SDK_SOURCE = `
class DataClient {
  constructor(baseUrl, headers) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  _authHeaders() {
    var h = Object.assign({}, this.headers);
    var t = typeof window !== "undefined" ? localStorage.getItem("vibexe_session") : null;
    if (t) h["Authorization"] = "Bearer " + t;
    return h;
  }

  async list(entity, options = {}) {
    const params = new URLSearchParams();
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    if (options.sort) params.set("sort", options.sort);
    if (options.order) params.set("order", options.order);
    if (options.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
          for (const [op, opVal] of Object.entries(value)) {
            if (op === "in" && Array.isArray(opVal)) {
              params.set("filter[" + key + "][in]", opVal.join(","));
            } else if (opVal !== undefined) {
              params.set("filter[" + key + "][" + op + "]", String(opVal));
            }
          }
        } else {
          params.set("filter[" + key + "]", String(value));
        }
      }
    }
    if (options.search) params.set("search", options.search);
    if (options.include && options.include.length) params.set("include", options.include.join(","));
    const qs = params.toString();
    const url = this.baseUrl + "/data/" + entity + (qs ? "?" + qs : "");
    const res = await fetch(url, { headers: this._authHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to list " + entity);
    }
    return await res.json();
  }

  async aggregate(entity, options = {}) {
    const params = new URLSearchParams();
    if (options.group) params.set("group", options.group);
    if (options.count) params.set("count", "true");
    if (options.sum) params.set("sum", options.sum);
    if (options.avg) params.set("avg", options.avg);
    if (options.min) params.set("min", options.min);
    if (options.max) params.set("max", options.max);
    if (options.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
          for (const [op, opVal] of Object.entries(value)) {
            if (op === "in" && Array.isArray(opVal)) {
              params.set("filter[" + key + "][in]", opVal.join(","));
            } else if (opVal !== undefined) {
              params.set("filter[" + key + "][" + op + "]", String(opVal));
            }
          }
        } else {
          params.set("filter[" + key + "]", String(value));
        }
      }
    }
    const qs = params.toString();
    const url = this.baseUrl + "/data/" + entity + "/aggregate" + (qs ? "?" + qs : "");
    const res = await fetch(url, { headers: this._authHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to aggregate " + entity);
    }
    return await res.json();
  }

  async get(entity, id, options) {
    const params = new URLSearchParams();
    if (options && options.include && options.include.length) params.set("include", options.include.join(","));
    const qs = params.toString();
    const res = await fetch(this.baseUrl + "/data/" + entity + "/" + id + (qs ? "?" + qs : ""), { headers: this._authHeaders() });
    if (!res.ok) throw new Error("Failed to get " + entity + "/" + id);
    const json = await res.json();
    return json.data;
  }

  async create(entity, data) {
    const res = await fetch(this.baseUrl + "/data/" + entity, {
      method: "POST",
      headers: { ...this._authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create " + entity);
    const json = await res.json();
    return json.data;
  }

  async update(entity, id, data) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/" + id, {
      method: "PUT",
      headers: { ...this._authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update " + entity + "/" + id);
    const json = await res.json();
    return json.data;
  }

  async delete(entity, id) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/" + id, {
      method: "DELETE",
      headers: this._authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete " + entity + "/" + id);
  }

  async listRelated(entity, id, relation, options) {
    options = options || {};
    const params = new URLSearchParams();
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    if (options.sort) params.set("sort", options.sort);
    if (options.order) params.set("order", options.order);
    if (options.filter) {
      for (const [k, v] of Object.entries(options.filter)) {
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
          for (const [op, opVal] of Object.entries(v)) {
            if (op === "in" && Array.isArray(opVal)) params.set("filter[" + k + "][in]", opVal.join(","));
            else if (opVal !== undefined) params.set("filter[" + k + "][" + op + "]", String(opVal));
          }
        } else params.set("filter[" + k + "]", String(v));
      }
    }
    const qs = params.toString();
    const res = await fetch(this.baseUrl + "/data/" + entity + "/" + id + "/" + relation + (qs ? "?" + qs : ""), { headers: this._authHeaders() });
    if (!res.ok) throw new Error("Failed to list " + entity + "/" + id + "/" + relation);
    return await res.json();
  }

  async createRelated(entity, id, relation, data) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/" + id + "/" + relation, {
      method: "POST",
      headers: { ...this._authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create " + entity + "/" + id + "/" + relation);
    const json = await res.json();
    return json.data;
  }

  async deleteWithInfo(entity, id, options) {
    const params = new URLSearchParams();
    if (options && options.dryRun) params.set("dryRun", "true");
    const qs = params.toString();
    const res = await fetch(this.baseUrl + "/data/" + entity + "/" + id + (qs ? "?" + qs : ""), {
      method: "DELETE",
      headers: this._authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete " + entity + "/" + id);
    return await res.json();
  }

  async createMany(entity, records) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/batch", {
      method: "POST",
      headers: { ...this._authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error("Failed to batch create " + entity);
    return await res.json();
  }

  async updateMany(entity, updates) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/batch", {
      method: "PUT",
      headers: { ...this._authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) throw new Error("Failed to batch update " + entity);
    return await res.json();
  }

  async deleteMany(entity, ids) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/batch", {
      method: "DELETE",
      headers: { ...this._authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error("Failed to batch delete " + entity);
    return await res.json();
  }

  subscribe(entity, optionsOrCallback, maybeCallback) {
    const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
    const filter = options.filter;
    var params = "entities=" + encodeURIComponent(entity);
    var token = typeof localStorage !== "undefined" ? localStorage.getItem("vibexe_session") : null;
    if (token) params += "&token=" + encodeURIComponent(token);
    const url = this.baseUrl + "/data/subscribe?" + params;
    const es = new EventSource(url);
    es.onmessage = function(e) {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "connected") return;
        if (filter && event.action !== "deleted") {
          const r = event.record;
          const ok = Object.keys(filter).every(function(k) { return r[k] === filter[k]; });
          if (!ok) return;
        }
        callback(event);
      } catch (err) {}
    };
    return function() { es.close(); };
  }
}

class AuthClient {
  constructor(baseUrl, headers) {
    this.baseUrl = baseUrl;
    this.headers = headers;
    this.sessionToken = typeof window !== "undefined" ? localStorage.getItem("vibexe_session") : null;
  }

  async signUp({ email, password, displayName }) {
    const res = await fetch(this.baseUrl + "/auth/signup", {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
    if (!res.ok) throw new Error("Signup failed");
    const data = await res.json();
    this._setSession(data.token);
    return data;
  }

  async signIn({ email, password }) {
    const res = await fetch(this.baseUrl + "/auth/signin", {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Signin failed");
    const data = await res.json();
    this._setSession(data.token);
    return data;
  }

  async signOut() {
    if (this.sessionToken) {
      try {
        await fetch(this.baseUrl + "/auth/signout", {
          method: "POST",
          headers: { ...this.headers, Authorization: "Bearer " + this.sessionToken },
        });
      } catch {}
    }
    this._clearSession();
  }

  async getCurrentUser() {
    if (!this.sessionToken) return null;
    const res = await fetch(this.baseUrl + "/auth/me", {
      headers: { ...this.headers, Authorization: "Bearer " + this.sessionToken },
    });
    if (!res.ok) { this._clearSession(); return null; }
    const data = await res.json();
    return data.user;
  }

  async signInWithGoogle() { return this._oauthPopup("google"); }
  async signInWithGitHub() { return this._oauthPopup("github"); }

  _oauthPopup(provider) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var w = 500, h = 600;
      var left = window.screenX + (window.outerWidth - w) / 2;
      var top = window.screenY + (window.outerHeight - h) / 2;
      var popup = window.open(
        self.baseUrl + "/auth/oauth/" + provider,
        "vibexe-oauth-" + provider,
        "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top + ",popup=yes"
      );
      if (!popup) { reject(new Error("Failed to open popup")); return; }
      function onMsg(e) {
        if (e.origin !== window.location.origin) return;
        if (!e.data || e.data.type !== "vibexe-oauth") return;
        cleanup();
        if (e.data.error) reject(new Error(e.data.error));
        else if (e.data.token && e.data.user) { self._setSession(e.data.token); resolve({ user: e.data.user, token: e.data.token }); }
        else reject(new Error("Invalid OAuth response"));
      }
      var poll = setInterval(function() { if (popup.closed) { cleanup(); reject(new Error("Authentication cancelled")); } }, 500);
      function cleanup() { window.removeEventListener("message", onMsg); clearInterval(poll); if (!popup.closed) popup.close(); }
      window.addEventListener("message", onMsg);
    });
  }

  isAuthenticated() { return this.sessionToken !== null; }
  getToken() { return this.sessionToken; }

  _setSession(token) {
    this.sessionToken = token;
    if (typeof window !== "undefined") localStorage.setItem("vibexe_session", token);
  }

  _clearSession() {
    this.sessionToken = null;
    if (typeof window !== "undefined") localStorage.removeItem("vibexe_session");
  }
}

class FunctionsClient {
  constructor(baseUrl, headers) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  async invoke(name, data) {
    const url = this.baseUrl + "/functions/" + encodeURIComponent(name);
    const res = await fetch(url, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Function failed: " + res.status);
    }
    return (await res.json()).data;
  }
}

class IntegrationsClient {
  constructor(baseUrl, headers) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  _ah() {
    var h = Object.assign({}, this.headers);
    var t = typeof window !== "undefined" ? localStorage.getItem("vibexe_session") : null;
    if (t) h["Authorization"] = "Bearer " + t;
    return h;
  }

  async execute(piece, action, props) {
    var r = await fetch(this.baseUrl + "/integrations/" + encodeURIComponent(piece) + "/execute", {
      method: "POST",
      headers: Object.assign({}, this._ah(), { "Content-Type": "application/json" }),
      body: JSON.stringify({ action: action, properties: props || {} }),
    });
    if (!r.ok) {
      var e = await r.json().catch(function() { return {}; });
      throw new Error(e.error || "Integration failed: " + r.status);
    }
    return (await r.json()).data;
  }
}

class StorageClient {
  constructor(baseUrl, headers) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  _authHeaders() {
    var h = Object.assign({}, this.headers);
    var t = typeof window !== "undefined" ? localStorage.getItem("vibexe_session") : null;
    if (t) h["Authorization"] = "Bearer " + t;
    return h;
  }

  async upload(file, path) {
    var fd = new FormData();
    fd.append("file", file);
    if (path) fd.append("path", path);
    var h = this._authHeaders();
    delete h["Content-Type"];
    var res = await fetch(this.baseUrl + "/storage", { method: "POST", headers: h, body: fd });
    if (!res.ok) { var err = await res.json().catch(function(){return{}}); throw new Error(err.error || "Upload failed"); }
    return await res.json();
  }

  async download(path) {
    var res = await fetch(this.baseUrl + "/storage/" + path, { headers: this._authHeaders() });
    if (!res.ok) throw new Error("Download failed: " + res.status);
    return await res.blob();
  }

  async list(prefix, options) {
    var p = new URLSearchParams();
    if (prefix) p.set("prefix", prefix);
    if (options && options.limit) p.set("limit", String(options.limit));
    if (options && options.cursor) p.set("cursor", options.cursor);
    var qs = p.toString();
    var res = await fetch(this.baseUrl + "/storage" + (qs ? "?" + qs : ""), { headers: this._authHeaders() });
    if (!res.ok) throw new Error("List failed");
    return await res.json();
  }

  async delete(path) {
    var res = await fetch(this.baseUrl + "/storage/" + path, { method: "DELETE", headers: this._authHeaders() });
    if (!res.ok) throw new Error("Delete failed");
  }

  getUrl(path, transforms) {
    var url = this.baseUrl + "/storage/" + path;
    if (transforms) {
      var p = new URLSearchParams();
      if (transforms.width) p.set("width", String(transforms.width));
      if (transforms.height) p.set("height", String(transforms.height));
      if (transforms.format) p.set("format", transforms.format);
      if (transforms.quality) p.set("quality", String(transforms.quality));
      var qs = p.toString();
      if (qs) url += "?" + qs;
    }
    return url;
  }
}

class JobsClient {
  constructor(baseUrl, headers) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  async create(job) {
    const res = await fetch(this.baseUrl + "/jobs", {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(job),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create job"); }
    return (await res.json()).data;
  }

  async list(options) {
    var p = new URLSearchParams();
    if (options && options.page) p.set("page", String(options.page));
    if (options && options.limit) p.set("limit", String(options.limit));
    var qs = p.toString();
    const res = await fetch(this.baseUrl + "/jobs" + (qs ? "?" + qs : ""), { headers: this.headers });
    if (!res.ok) throw new Error("Failed to list jobs");
    return await res.json();
  }

  async get(jobId) {
    const res = await fetch(this.baseUrl + "/jobs/" + jobId, { headers: this.headers });
    if (!res.ok) throw new Error("Job not found");
    return (await res.json()).data;
  }

  async update(jobId, data) {
    const res = await fetch(this.baseUrl + "/jobs/" + jobId, {
      method: "PUT",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to update job"); }
    return (await res.json()).data;
  }

  async delete(jobId) {
    const res = await fetch(this.baseUrl + "/jobs/" + jobId, { method: "DELETE", headers: this.headers });
    if (!res.ok) throw new Error("Failed to delete job");
  }

  async trigger(jobId) {
    const res = await fetch(this.baseUrl + "/jobs/" + jobId + "/trigger", { method: "POST", headers: this.headers });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to trigger job"); }
    return (await res.json()).data;
  }

  async runs(jobId, options) {
    var p = new URLSearchParams();
    if (options && options.page) p.set("page", String(options.page));
    if (options && options.limit) p.set("limit", String(options.limit));
    if (options && options.status) p.set("status", options.status);
    var qs = p.toString();
    const res = await fetch(this.baseUrl + "/jobs/" + jobId + "/runs" + (qs ? "?" + qs : ""), { headers: this.headers });
    if (!res.ok) throw new Error("Failed to list job runs");
    return await res.json();
  }

  async dlq(options) {
    var p = new URLSearchParams();
    if (options && options.page) p.set("page", String(options.page));
    if (options && options.all) p.set("all", "true");
    var qs = p.toString();
    const res = await fetch(this.baseUrl + "/jobs/dlq" + (qs ? "?" + qs : ""), { headers: this.headers });
    if (!res.ok) throw new Error("Failed to list DLQ");
    return await res.json();
  }

  async acknowledgeDlq(dlqId) {
    const res = await fetch(this.baseUrl + "/jobs/dlq", {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ dlqId }),
    });
    if (!res.ok) throw new Error("Failed to acknowledge DLQ entry");
  }
}

class WebhooksClient {
  constructor(baseUrl, headers) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  async create(config) {
    const res = await fetch(this.baseUrl + "/webhooks", {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to create webhook"); }
    return (await res.json()).webhook;
  }

  async list() {
    const res = await fetch(this.baseUrl + "/webhooks", { headers: this.headers });
    if (!res.ok) throw new Error("Failed to list webhooks");
    return await res.json();
  }

  async delete(webhookDbId) {
    const res = await fetch(this.baseUrl + "/webhooks", {
      method: "DELETE",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ webhookDbId }),
    });
    if (!res.ok) throw new Error("Failed to delete webhook");
  }
}

export class VibexeApp {
  constructor(config) {
    // Runtime appId override (injected by Sandpack host) takes precedence over hardcoded config
    const resolvedAppId = (typeof window !== "undefined" && window.__VIBEXE_APP_ID__) || config.appId;
    this.appId = resolvedAppId;
    const origin = config.baseUrl
      || (typeof window !== "undefined" && window.__VIBEXE_API_ORIGIN__)
      || (typeof window !== "undefined" ? window.location.origin : "");
    const base = origin + "/api/apps/" + resolvedAppId;
    const headers = {};
    if (config.apiKey) headers["X-Vibexe-Api-Key"] = config.apiKey;
    this.data = new DataClient(base, headers);
    this.auth = new AuthClient(base, headers);
    this.functions = new FunctionsClient(base, headers);
    this.integrations = new IntegrationsClient(base, headers);
    this.jobs = new JobsClient(base, headers);
    this.storage = new StorageClient(base, headers);
    this.webhooks = new WebhooksClient(base, headers);
  }
}
`;

/**
 * Check if a file is a code file (JS/TS/JSX/TSX)
 */
function isCodeFile(file: AppFile): boolean {
	const codeLanguages = [
		"javascript",
		"typescript",
		"javascriptreact",
		"typescriptreact",
	];
	const codeExtensions = [".js", ".jsx", ".ts", ".tsx"];
	return (
		codeLanguages.includes(file.language || "") ||
		codeExtensions.some((ext) => file.path.endsWith(ext))
	);
}

/**
 * Check if a file path is the main App component
 */
function isAppFile(path: string): boolean {
	const lower = path.toLowerCase();
	return (
		lower.includes("app.") &&
		(lower.endsWith(".jsx") ||
			lower.endsWith(".tsx") ||
			lower.endsWith(".js") ||
			lower.endsWith(".ts"))
	);
}

/**
 * Detect context provider files (files that export *Provider or *Context)
 */
function isContextFile(file: AppFile): boolean {
	if (!file.content) return false;
	const path = file.path.toLowerCase();
	return (
		path.includes("context") ||
		path.includes("provider") ||
		/export\s+(default\s+)?function\s+\w*Provider/i.test(file.content) ||
		/export\s+const\s+\w*Context/i.test(file.content)
	);
}

/**
 * Generate entry point that wraps App with detected context providers
 */
function generateEntryPoint(
	appImportPath: string,
	contextFiles: Array<{ sandpackPath: string; providerName: string }>,
): string {
	const lines: string[] = [
		'import React from "react";',
		'import { createRoot } from "react-dom/client";',
		`import App from "${appImportPath}";`,
	];

	// Import context providers
	for (const ctx of contextFiles) {
		const importPath = ctx.sandpackPath.replace(/\.(tsx?|jsx?)$/, "");
		lines.push(`import { ${ctx.providerName} } from "${importPath}";`);
	}

	lines.push("");
	lines.push('const root = createRoot(document.getElementById("root"));');

	if (contextFiles.length === 0) {
		lines.push("root.render(<App />);");
	} else {
		// Wrap App with providers
		let jsx = "<App />";
		for (const ctx of contextFiles.reverse()) {
			jsx = `<${ctx.providerName}>${jsx}</${ctx.providerName}>`;
		}
		lines.push(`root.render(${jsx});`);
	}

	return lines.join("\n");
}

/**
 * Extract provider component name from file content
 */
function extractProviderName(content: string): string | null {
	const match = content.match(
		/export\s+(?:default\s+)?function\s+(\w*Provider)/,
	);
	if (match) return match[1];

	const constMatch = content.match(
		/export\s+const\s+(\w*Provider)\s*=/,
	);
	if (constMatch) return constMatch[1];

	return null;
}

/**
 * Auto-generate an App.tsx when component files exist but no App entry point was created.
 * Searches for the most likely "main" component (DashboardLayout, HomePage, MainLayout, etc.)
 * and creates a minimal App.tsx that renders it.
 */
function generateAppFromComponents(
	sandpackFiles: SandpackFiles,
	contextProviders: Array<{ sandpackPath: string; providerName: string }>,
): string {
	const allPaths = Object.keys(sandpackFiles).filter(
		(p) => p.endsWith(".tsx") || p.endsWith(".jsx"),
	);

	// Priority order for finding the main component
	const mainPatterns = [
		/DashboardLayout/i,
		/MainLayout/i,
		/AppLayout/i,
		/Layout/i,
		/DashboardHome/i,
		/Dashboard/i,
		/HomePage/i,
		/Home/i,
		/MainPage/i,
		/Main/i,
		/LoginPage/i,
	];

	let mainPath: string | null = null;
	for (const pattern of mainPatterns) {
		const found = allPaths.find((p) => pattern.test(p));
		if (found) {
			mainPath = found;
			break;
		}
	}

	// Fallback: pick the longest file (likely the most complex/main component)
	if (!mainPath && allPaths.length > 0) {
		let maxLen = 0;
		for (const p of allPaths) {
			const file = sandpackFiles[p];
			const code = typeof file === "string" ? file : file?.code || "";
			if (code.length > maxLen) {
				maxLen = code.length;
				mainPath = p;
			}
		}
	}

	if (!mainPath) {
		return DEFAULT_APP;
	}

	// Extract component name from path
	const fileName = mainPath.split("/").pop()?.replace(/\.(tsx|jsx)$/, "") || "Main";
	const importPath = mainPath.replace(/\.(tsx|jsx)$/, "");
	const importFrom = importPath.startsWith("/") ? `.${importPath}` : `./${importPath}`;

	// Check if the component has a default export
	const fileObj = sandpackFiles[mainPath];
	const code = typeof fileObj === "string" ? fileObj : fileObj?.code || "";
	const hasDefault = /export\s+default/.test(code);
	const importStatement = hasDefault
		? `import ${fileName} from "${importFrom}";`
		: `import { ${fileName} } from "${importFrom}";`;

	// Wrap with context providers if detected
	let providerImports = "";
	let jsx = `<${fileName} />`;
	for (const ctx of contextProviders) {
		const ctxImport = ctx.sandpackPath.replace(/\.(tsx?|jsx?)$/, "");
		const ctxFrom = ctxImport.startsWith("/") ? `.${ctxImport}` : `./${ctxImport}`;
		providerImports += `import { ${ctx.providerName} } from "${ctxFrom}";\n`;
		jsx = `<${ctx.providerName}>${jsx}</${ctx.providerName}>`;
	}

	return `${importStatement}
${providerImports}
export default function App() {
  return ${jsx};
}
`;
}

/**
 * Convert AppFile[] to Sandpack files format
 *
 * Handles:
 * - Strips src/ prefix from paths (src/App.tsx -> /App.tsx)
 * - Nested directories (src/components/Header.tsx -> /components/Header.tsx)
 * - Auto-generates /index.js entry point with context provider wrapping
 * - Includes custom index.html with Tailwind CDN
 * - Skips non-code files (markdown, etc.)
 * - CSS files included but referenced via CDN instead
 */
export function convertToSandpackFiles(files: AppFile[], langConfig?: SandpackLanguageConfig, apiOrigin?: string, appId?: string): SandpackFiles {
	const sandpackFiles: SandpackFiles = {};

	// Check if files include a manifest.json (PWA)
	const hasManifest = files.some((f) => f.path === "manifest.json" || f.path.endsWith("/manifest.json"));

	// Always include custom index.html with Tailwind support + language/RTL + PWA meta if manifest
	let indexHtml = langConfig ? buildIndexHtml(langConfig) : TAILWIND_INDEX_HTML;
	if (hasManifest) {
		// Inject PWA meta tags before </head>
		const pwaMeta = `    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="manifest" href="/manifest.json" />`;
		indexHtml = indexHtml.replace("</head>", `${pwaMeta}\n  </head>`);
	}
	// Inject runtime globals (API origin, app ID) into index.html for ALL projects.
	// Games use window.__VIBEXE_API_ORIGIN__ in the ASSET() helper; SDK apps use it too.
	let runtimeGlobals = "";
	if (apiOrigin) runtimeGlobals += `window.__VIBEXE_API_ORIGIN__ = ${JSON.stringify(apiOrigin)};\n`;
	if (appId) runtimeGlobals += `window.__VIBEXE_APP_ID__ = ${JSON.stringify(appId)};\n`;
	if (runtimeGlobals) {
		indexHtml = indexHtml.replace(
			"<div id=\"root\">",
			`<script>${runtimeGlobals}</script>\n    <div id="root">`,
		);
	}
	sandpackFiles["/public/index.html"] = {
		code: indexHtml,
		hidden: true,
	};

	// Filter to code files only
	const codeFiles = files.filter(isCodeFile);

	if (codeFiles.length === 0) {
		sandpackFiles["/App.tsx"] = { code: DEFAULT_APP };
		sandpackFiles["/index.js"] = {
			code: generateEntryPoint("./App", []),
			hidden: true,
		};
		return sandpackFiles;
	}

	// Track context providers for entry point wrapping
	const contextProviders: Array<{
		sandpackPath: string;
		providerName: string;
	}> = [];

	// Convert each code file
	for (const file of codeFiles) {
		let path = file.path;

		// Remove src/ prefix if present
		if (path.startsWith("src/")) {
			path = path.slice(4);
		}

		// Ensure leading /
		if (!path.startsWith("/")) {
			path = `/${path}`;
		}

		sandpackFiles[path] = {
			code: file.content || "",
			active: isAppFile(path),
		};

		// Detect context providers
		if (isContextFile(file)) {
			const providerName = extractProviderName(file.content || "");
			if (providerName) {
				contextProviders.push({ sandpackPath: path, providerName });
			}
		}
	}

	// Ensure we have an entry point
	const hasIndex = Object.keys(sandpackFiles).some(
		(p) =>
			p === "/index.js" ||
			p === "/index.jsx" ||
			p === "/index.ts" ||
			p === "/index.tsx",
	);

	if (!hasIndex) {
		const appFile = Object.keys(sandpackFiles).find((p) => isAppFile(p));
		if (appFile) {
			const importName = appFile.replace(/\.(jsx?|tsx?)$/, "");
			const importPath = importName.startsWith("/")
				? `.${importName}`
				: `./${importName}`;
			sandpackFiles["/index.js"] = {
				code: generateEntryPoint(importPath, contextProviders),
				hidden: true,
			};
		} else if (codeFiles.length > 3) {
			// No App file but we have component files — auto-generate an App.tsx
			// that imports the most likely main component
			const generatedApp = generateAppFromComponents(sandpackFiles, contextProviders);
			sandpackFiles["/App.tsx"] = { code: generatedApp };
			sandpackFiles["/index.js"] = {
				code: generateEntryPoint("./App", contextProviders),
				hidden: true,
			};
		} else {
			sandpackFiles["/index.js"] = {
				code: generateEntryPoint("./App", []),
				hidden: true,
			};
			if (!sandpackFiles["/App.tsx"]) {
				sandpackFiles["/App.tsx"] = { code: DEFAULT_APP };
			}
		}
	}

	// Also include CSS files (Tailwind CDN handles most styling, but include any custom CSS)
	const cssFiles = files.filter(
		(f) =>
			f.path.endsWith(".css") ||
			f.language === "css" ||
			f.language === "scss",
	);
	for (const cssFile of cssFiles) {
		let path = cssFile.path;
		if (path.startsWith("src/")) path = path.slice(4);
		if (!path.startsWith("/")) path = `/${path}`;
		sandpackFiles[path] = {
			code: cssFile.content || "",
			hidden: true,
		};
	}

	// Include JSON files (like package.json) if present
	const jsonFiles = files.filter(
		(f) => f.path.endsWith(".json") && !f.path.includes("node_modules"),
	);
	for (const jsonFile of jsonFiles) {
		let path = jsonFile.path;
		if (!path.startsWith("/")) path = `/${path}`;
		sandpackFiles[path] = {
			code: jsonFile.content || "",
			hidden: true,
		};
	}

	// Inject Vibexe SDK if any file imports it
	const usesVibexeSdk = files.some(
		(f) => f.content && f.content.includes("@vibexe/sdk"),
	);
	if (usesVibexeSdk) {
		sandpackFiles["/node_modules/@vibexe/sdk/package.json"] = {
			code: JSON.stringify({ name: "@vibexe/sdk", version: "1.0.0", main: "index.js" }),
			hidden: true,
		};
		// Inject runtime overrides so the SDK calls the correct server and app from within Sandpack's iframe
		let sdkSetup = "";
		if (apiOrigin) sdkSetup += `window.__VIBEXE_API_ORIGIN__ = ${JSON.stringify(apiOrigin)};\n`;
		if (appId) sdkSetup += `window.__VIBEXE_APP_ID__ = ${JSON.stringify(appId)};\n`;
		sandpackFiles["/node_modules/@vibexe/sdk/index.js"] = {
			code: sdkSetup + VIBEXE_SDK_SOURCE,
			hidden: true,
		};
	}

	return sandpackFiles;
}

/**
 * Extract dependencies from package.json file if present
 * Falls back to default React deps
 */
export function extractDependencies(files: AppFile[]): Record<string, string> {
	const pkgFile = files.find(
		(f) => f.path === "package.json" || f.path.endsWith("/package.json"),
	);

	if (pkgFile?.content) {
		try {
			const pkg = JSON.parse(pkgFile.content);
			return {
				...pkg.dependencies,
				...pkg.devDependencies,
			};
		} catch {
			// Invalid JSON, use defaults
		}
	}

	// Default dependencies for React apps
	return {
		react: "^18.2.0",
		"react-dom": "^18.2.0",
	};
}
