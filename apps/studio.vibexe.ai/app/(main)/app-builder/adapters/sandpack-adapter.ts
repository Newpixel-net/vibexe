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
 * Detect Phaser game projects and auto-generate an App.tsx that wires up scenes.
 * If /components/Game.tsx exists AND /scenes/*Scene.ts files exist, it generates
 * the correct App.tsx that imports all scenes and passes them to <Game />.
 * Returns null if the project isn't a game.
 */
function tryGenerateGameApp(sandpackFiles: SandpackFiles): string | null {
	// Check for the pre-created Game.tsx wrapper
	const hasGame = Object.keys(sandpackFiles).some(
		(p) => p === "/components/Game.tsx" || p === "/components/Game.jsx",
	);
	if (!hasGame) return null;

	// Find all scene files (e.g. /scenes/BootScene.ts, /scenes/GameScene.ts)
	const scenePaths = Object.keys(sandpackFiles)
		.filter((p) => /^\/scenes\/\w+Scene\.tsx?$/.test(p))
		.sort((a, b) => {
			// Boot first, then Menu, then Game, then GameOver, then alphabetical
			const order = ["Boot", "Menu", "Game", "GameOver"];
			const aName = a.match(/\/(\w+)Scene/)?.[1] || "";
			const bName = b.match(/\/(\w+)Scene/)?.[1] || "";
			const aIdx = order.indexOf(aName);
			const bIdx = order.indexOf(bName);
			if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
			if (aIdx !== -1) return -1;
			if (bIdx !== -1) return 1;
			return a.localeCompare(b);
		});

	if (scenePaths.length === 0) return null;

	// Build imports and scene array
	const imports: string[] = ['import Game from "./components/Game";'];
	const sceneNames: string[] = [];
	for (const p of scenePaths) {
		const name = p.match(/\/(\w+Scene)/)?.[1];
		if (!name) continue;
		const importPath = p.replace(/\.tsx?$/, "");
		imports.push(`import { ${name} } from ".${importPath}";`);
		sceneNames.push(name);
	}

	return `${imports.join("\n")}

export default function App() {
  return <Game scenes={[${sceneNames.join(", ")}]} />;
}
`;
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
	// Inject runtime globals (API origin, app ID, game settings) into index.html for ALL projects.
	// Games use window.__VIBEXE_API_ORIGIN__ in the ASSET() helper; SDK apps use it too.
	let runtimeGlobals = "";
	if (apiOrigin) runtimeGlobals += `window.__VIBEXE_API_ORIGIN__ = ${JSON.stringify(apiOrigin)};\n`;
	if (appId) runtimeGlobals += `window.__VIBEXE_APP_ID__ = ${JSON.stringify(appId)};\n`;
	// Find game settings file (used by entry point injection + post-process patching below)
	const settingsFile = files.find((f) => f.path === "src/__game-settings.json" || f.path === "__game-settings.json");
	// NOTE: Game settings injection moved to entry point prepend block below.
	// Sandpack does NOT execute inline <script> tags in index.html <body>.
	// runtimeGlobals only contains apiOrigin/appId for non-game apps now.
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
		sandpackFiles["/index.tsx"] = {
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
			sandpackFiles["/index.tsx"] = {
				code: generateEntryPoint(importPath, contextProviders),
				hidden: true,
			};
		} else if (codeFiles.length > 3) {
			// Try game-specific auto-generation first (Game.tsx + Scene files)
			const gameApp = tryGenerateGameApp(sandpackFiles);
			const generatedApp = gameApp ?? generateAppFromComponents(sandpackFiles, contextProviders);
			sandpackFiles["/App.tsx"] = { code: generatedApp };
			sandpackFiles["/index.tsx"] = {
				code: generateEntryPoint("./App", contextProviders),
				hidden: true,
			};
		} else {
			sandpackFiles["/index.tsx"] = {
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

	// Inject Phaser shim if any file imports it.
	// Sandpack's bundler evaluates modules via its own transpiler, NOT through HTML script loading.
	// So externalResources and <head> scripts don't help — the bundler can evaluate the shim
	// BEFORE the CDN script has loaded. The fix: the shim itself synchronously fetches and evals
	// the Phaser CDN bundle via XMLHttpRequest, guaranteeing window.Phaser is set before returning.
	// This blocks the main thread briefly (~1-3s for the 4MB file) but only happens once per session.
	const usesPhaser = files.some(
		(f) => f.content && (f.content.includes("from 'phaser'") || f.content.includes('from "phaser"')),
	);
	if (usesPhaser) {
		sandpackFiles["/node_modules/phaser/package.json"] = {
			code: JSON.stringify({ name: "phaser", version: "3.90.0", main: "index.js" }),
			hidden: true,
		};
		sandpackFiles["/node_modules/phaser/index.js"] = {
			code: [
				"// Phaser shim: synchronously load Phaser CDN if not already available.",
				"// Sandpack's bundler evaluates this module BEFORE externalResources scripts load,",
				"// so we must fetch+eval Phaser ourselves to guarantee window.Phaser exists.",
				"if (typeof window.Phaser === 'undefined') {",
				"  var xhr = new XMLHttpRequest();",
				"  xhr.open('GET', 'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js', false);",
				"  xhr.send();",
				"  if (xhr.status === 200) {",
				"    (0, eval)(xhr.responseText);",
				"  }",
				"}",
				"module.exports = window.Phaser;",
			].join("\n"),
			hidden: true,
		};
	}

	// Inject Three.js shim if any file imports it.
	// Same pattern as Phaser: synchronously fetch + eval CDN bundle via XMLHttpRequest.
	const usesThree = files.some(
		(f) => f.content && (f.content.includes("from 'three'") || f.content.includes('from "three"') || f.content.includes("(window as any).THREE")),
	);
	if (usesThree) {
		sandpackFiles["/node_modules/three/package.json"] = {
			code: JSON.stringify({ name: "three", version: "0.128.0", main: "index.js" }),
			hidden: true,
		};
		sandpackFiles["/node_modules/three/index.js"] = {
			code: [
				"// Three.js shim: synchronously load Three.js CDN if not already available.",
				"// Sandpack's bundler evaluates this module BEFORE externalResources scripts load,",
				"// so we must fetch+eval Three.js ourselves to guarantee window.THREE exists.",
				"if (typeof window.THREE === 'undefined') {",
				"  var xhr = new XMLHttpRequest();",
				"  xhr.open('GET', 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js', false);",
				"  xhr.send();",
				"  if (xhr.status === 200) {",
				"    (0, eval)(xhr.responseText);",
				"  }",
				"}",
				"// Also load GLTFLoader addon",
				"if (window.THREE && !window.THREE.GLTFLoader) {",
				"  var xhr2 = new XMLHttpRequest();",
				"  xhr2.open('GET', 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js', false);",
				"  xhr2.send();",
				"  if (xhr2.status === 200) {",
				"    (0, eval)(xhr2.responseText);",
				"  }",
				"}",
				"// Also load OrbitControls addon",
				"if (window.THREE && !window.THREE.OrbitControls) {",
				"  var xhr3 = new XMLHttpRequest();",
				"  xhr3.open('GET', 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', false);",
				"  xhr3.send();",
				"  if (xhr3.status === 200) { (0, eval)(xhr3.responseText); }",
				"}",
				"// Also load TransformControls addon (needed for Scene Editor gizmos)",
				"if (window.THREE && !window.THREE.TransformControls) {",
				"  var xhr4 = new XMLHttpRequest();",
				"  xhr4.open('GET', 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js', false);",
				"  xhr4.send();",
				"  if (xhr4.status === 200) { (0, eval)(xhr4.responseText); }",
				"}",
				"module.exports = window.THREE;",
			].join("\n"),
			hidden: true,
		};
		// Also load Three.js post-processing addons (EffectComposer, UnrealBloomPass, etc.)
		// These extend window.THREE with post-processing classes.
		sandpackFiles["/node_modules/three-postprocessing-shim/package.json"] = {
			code: JSON.stringify({ name: "three-postprocessing-shim", version: "1.0.0", main: "index.js" }),
			hidden: true,
		};
		sandpackFiles["/node_modules/three-postprocessing-shim/index.js"] = {
			code: [
				"// Post-processing shim: load Three.js r128 post-processing addons",
				"if (window.THREE && !window.THREE.EffectComposer) {",
				"  var urls = [",
				"    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js',",
				"    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/Pass.js',",
				"    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js',",
				"    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js',",
				"    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js',",
				"    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js',",
				"    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js',",
				"  ];",
				"  for (var i = 0; i < urls.length; i++) {",
				"    var xhr = new XMLHttpRequest();",
				"    xhr.open('GET', urls[i], false);",
				"    xhr.send();",
				"    if (xhr.status === 200) { (0, eval)(xhr.responseText); }",
				"  }",
				"}",
			].join("\n"),
			hidden: true,
		};
	}

	// Inject cannon-es shim if any file imports it.
	// cannon-es has no UMD build — only CJS. We wrap the CJS source with a fake module object,
	// eval it, and assign module.exports to window.CANNON.
	const usesCannon = files.some(
		(f) => f.content && (f.content.includes("cannon-es") || f.content.includes("CANNON")),
	);
	if (usesCannon) {
		sandpackFiles["/node_modules/cannon-es/package.json"] = {
			code: JSON.stringify({ name: "cannon-es", version: "0.20.0", main: "index.js" }),
			hidden: true,
		};
		sandpackFiles["/node_modules/cannon-es/index.js"] = {
			code: [
				"// cannon-es shim: synchronously load CJS bundle and expose as window.CANNON.",
				"if (typeof window.CANNON === 'undefined') {",
				"  var m = { exports: {} }, e = m.exports;",
				"  var xhr = new XMLHttpRequest();",
				"  xhr.open('GET', 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.cjs.js', false);",
				"  xhr.send();",
				"  if (xhr.status === 200) {",
			"    var fakeRequire = function(mod) { if (mod === 'perf_hooks') return { performance: window.performance }; return {}; };",
			"    (new Function('module','exports','require',xhr.responseText))(m,e,fakeRequire); window.CANNON = m.exports;",
			"  }",
				"}",
				"module.exports = window.CANNON;",
			].join("\n"),
			hidden: true,
		};
	}

	// Prepend runtime globals to ALL entry point files so they're set before any app code runs.
	// Sandpack prefers .tsx > .ts > .jsx > .js, so we must inject into every variant that exists.
	// NOTE: Sandpack does NOT execute inline <script> tags in index.html <body>.
	// All runtime globals MUST go here (entry point prepend) to actually execute.
	{
		let globals = "// Runtime globals injected by Vibexe\n";
		if (apiOrigin) globals += `(window as any).__VIBEXE_API_ORIGIN__ = ${JSON.stringify(apiOrigin)};\n`;
		if (appId) globals += `(window as any).__VIBEXE_APP_ID__ = ${JSON.stringify(appId)};\n`;
		// Inject game settings global + runtime override for environment/physics/camera
		if (settingsFile?.content) {
			try {
				const so = JSON.parse(settingsFile.content);
				globals += `(window as any).__VIBEXE_GAME_SETTINGS__ = ${JSON.stringify(so)};\n`;
				// Runtime override: apply settings AFTER scene initializes (async via setInterval).
				// Handles environment (bg, fog, lights), physics gravity, and camera FOV.
				// Physics constants & camera offsets are also handled by inline patching (Step 2 below),
				// but gravity override via world.gravity.y provides a runtime fallback.
				if (so.environment || so.camera || so.physics) {
					globals += [
						"(function(){",
						`var _gs=${JSON.stringify(so)};`,
						"var _n=0;",
						"var _t=setInterval(function(){",
						"_n++;",
						"var T=(window as any).THREE;var s=(window as any).__vibexe_scene__;var c=(window as any).__vibexe_camera__;",
						"if(!T||!s)return;",
						"clearInterval(_t);",
						// Environment
						"var e=_gs.environment||{};",
						"if(e.backgroundColor){try{s.background=new T.Color(e.backgroundColor)}catch(x){}}",
						"if(e.fogEnabled){try{s.fog=new T.Fog(e.backgroundColor||'#87CEEB',e.fogNear||30,e.fogFar||100)}catch(x){}}",
						"var amb=s.getObjectByName('__default_ambient__');if(amb&&e.ambientLightIntensity!=null)amb.intensity=e.ambientLightIntensity;",
						"var sun=s.getObjectByName('__default_sun__');if(sun&&e.sunLightIntensity!=null)sun.intensity=e.sunLightIntensity;",
						"var hemi=s.getObjectByName('__default_hemi__');if(hemi&&e.hemisphereIntensity!=null)hemi.intensity=e.hemisphereIntensity;",
						// Camera FOV
						"if(c&&_gs.camera&&_gs.camera.fov!=null){c.fov=_gs.camera.fov;c.updateProjectionMatrix()}",
						// Physics gravity — override CANNON.World.gravity at runtime
						"var w=(window as any).__vibexe_world__;",
						"if(w&&_gs.physics&&_gs.physics.gravity!=null){try{w.gravity.set(0,_gs.physics.gravity,0)}catch(x){}}",
						"},100)})();\n",
					].join("");
				}
			} catch { /* invalid JSON */ }
		}
		// Character Y-offset fix: correct mesh feet position relative to physics body center.
		// Without this, mesh.position.copy(physicsBody.position) places the mesh at the body
		// CENTER, but pivot correction puts feet at local Y=0, causing characters to float
		// above the ground by halfHeight. Patches renderer.render to fix Y before each frame.
		globals += [
			"(function(){",
			"var _cn=0;",
			"var _ct=setInterval(function(){",
			"_cn++;if(_cn>100){clearInterval(_ct);return}",
			"var _r=(window as any).__vibexe_renderer__;",
			"if(!_r||!_r.render)return;",
			"clearInterval(_ct);",
			"var _origR=_r.render;",
			"var _chrs=[] as any[];var _lsc:any=null;",
			"_r.render=function(_s:any,_c:any){",
			// Skip Y-offset correction when Scene Editor is active —
			// the editor controls character position directly via game-editor-move-player.
			// Without this guard, the correction fights the editor's position changes.
			// NOTE: __vibexe_editor__ is always truthy (it's the game's scene/camera object).
			// __vibexe_editor_active__ is a boolean set by activateBridge/deactivateBridge.
			"if(_s&&!(window as any).__vibexe_editor_active__){",
			"var _w=(window as any).__vibexe_world__;",
			"if(_w&&_w.bodies){",
			"if(_s!==_lsc){_chrs=[];_lsc=_s;if(_s.traverse)_s.traverse(function(_o:any){var _cb=_o.userData&&_o.userData.__characterBounds;if(_cb&&_cb.height)_chrs.push(_o)})}",
			"for(var _ci=0;_ci<_chrs.length;_ci++){",
			"var _o=_chrs[_ci];var _hh=_o.userData.__characterBounds.height/2;",
			"for(var _bi=0;_bi<_w.bodies.length;_bi++){",
			"var _b=_w.bodies[_bi];",
			"if(_b.mass>0&&Math.abs(_b.position.x-_o.position.x)<0.5&&Math.abs(_b.position.z-_o.position.z)<0.5&&Math.abs(_b.position.y-_o.position.y)<0.15){",
			"_o.position.y=_b.position.y-_hh;break}",
			"}}}",
			"}",
			"return _origR.call(this,_s,_c)",
			"};",
			"},100)})();\n",
		].join("");

		globals += "\n";
		for (const entryKey of ["/index.js", "/index.jsx", "/index.ts", "/index.tsx"]) {
			if (sandpackFiles[entryKey]) {
				sandpackFiles[entryKey] = {
					...sandpackFiles[entryKey],
					code: globals + (sandpackFiles[entryKey].code || ""),
				};
			}
		}
	}

	// Post-process: Patch 3D game source code with INLINE settings values.
	// IMPORTANT: Sandpack's bundler hoists imports, so window globals set in the entry point
	// are NOT available when imported modules evaluate. We must inline actual literal values
	// directly into the source code instead of reading from window.__VIBEXE_GAME_SETTINGS__.
	if (settingsFile?.content) {
		try {
			const gsObj = JSON.parse(settingsFile.content);

			// 1. Patch assets-3d.ts — replace hardcoded constants with actual settings values
			const assetsKey = Object.keys(sandpackFiles).find((p) => p.endsWith("/assets-3d.ts"));
			if (assetsKey) {
				const af = sandpackFiles[assetsKey];
				let code = typeof af === "string" ? af : af.code;
				// Map: [constantName, settingsPath, value]
				const constMap: [string, number | undefined][] = [
					["GRAVITY_3D", gsObj.physics?.gravity],
					["FALL_GRAVITY", gsObj.physics?.fallGravity],
					["JUMP_FORCE", gsObj.physics?.jumpForce],
					["MOVE_SPEED", gsObj.physics?.moveSpeed],
					["RUN_SPEED", gsObj.physics?.runSpeed],
					["FRICTION", gsObj.physics?.friction],
					["COYOTE_TIME", gsObj.physics?.coyoteTime],
					["CAMERA_OFFSET_Y", gsObj.camera?.offsetY],
					["CAMERA_OFFSET_Z", gsObj.camera?.offsetZ],
					["CAMERA_HEIGHT", gsObj.camera?.offsetY],
					["CAMERA_DISTANCE", gsObj.camera?.offsetZ],
					["CAMERA_LERP", gsObj.camera?.lerp],
					["CAMERA_LOOK_AHEAD", gsObj.camera?.lookAhead],
					["CAMERA_LOOK_Y", gsObj.camera?.lookY],
				];
				let patchCount = 0;
				for (const [name, value] of constMap) {
					if (value == null) continue; // only patch if setting has a value
					const re = new RegExp(`(export\\s+const\\s+${name}\\s*=\\s*)([^;]+)(;)`);
					const m = code.match(re);
					if (m) {
						code = code.replace(re, `$1${value}$3`);
						patchCount++;
					}
				}
				if (patchCount > 0) {
					if (typeof af === "string") {
						sandpackFiles[assetsKey] = code;
					} else {
						(sandpackFiles[assetsKey] as SandpackFile).code = code;
					}
				}
			}

			// 2. Patch GameScene3D.ts — inline spawn position values from settings
			const sceneKey = Object.keys(sandpackFiles).find((p) => p.endsWith("GameScene3D.ts"));
			if (sceneKey) {
				const sf = sandpackFiles[sceneKey];
				let code = typeof sf === "string" ? sf : sf.code;
				const sp = gsObj.player;
				if (sp) {
					// Replace createAnimatedCharacter3D spawn args with literal values
					if (sp.spawnX != null || sp.spawnY != null || sp.spawnZ != null) {
						code = code.replace(
							/(createAnimatedCharacter3D\s*\(\s*scene\s*,\s*)([^,]+)(\s*,\s*)([^,]+)(\s*,\s*)([^,]+)(\s*,)/,
							(_, p1, x, p2, y, p3, z, p4) =>
								`${p1}${sp.spawnX ?? x.trim()}${p2}${sp.spawnY ?? y.trim()}${p3}${sp.spawnZ ?? z.trim()}${p4}`,
						);
						// Also patch createPlayer3D spawn args
						code = code.replace(
							/(createPlayer3D\s*\(\s*scene\s*,\s*)([^,]+)(\s*,\s*)([^,]+)(\s*,\s*)([^,]+)(\s*[,)])/,
							(_, p1, x, p2, y, p3, z, p4) =>
								`${p1}${sp.spawnX ?? x.trim()}${p2}${sp.spawnY ?? y.trim()}${p3}${sp.spawnZ ?? z.trim()}${p4}`,
						);
						// Replace createPhysicsBody position object
						code = code.replace(
							/(createPhysicsBody\s*\([^,]+,\s*[^,]+,\s*)\{\s*x:\s*([^,]+),\s*y:\s*([^,]+),\s*z:\s*([^}]+)\}/,
							(_, prefix, x, y, z) =>
								`${prefix}{ x: ${sp.spawnX ?? x.trim()}, y: ${sp.spawnY ?? y.trim()}, z: ${sp.spawnZ ?? z.trim()} }`,
						);
					}

					// Patch respawn position variable declarations
					if (sp.respawnX != null || sp.respawnY != null || sp.respawnZ != null) {
						let respawnPatched = false;
						// Try patching variable declarations first (new template)
						if (code.includes("const respawnX")) {
							if (sp.respawnX != null) {
								code = code.replace(
									/(const respawnX\s*=\s*)([^;]+)(;)/,
									`$1${sp.respawnX}$3`,
								);
							}
							if (sp.respawnY != null) {
								code = code.replace(
									/(const respawnY\s*=\s*)([^;]+)(;)/,
									`$1${sp.respawnY}$3`,
								);
							}
							if (sp.respawnZ != null) {
								code = code.replace(
									/(const respawnZ\s*=\s*)([^;]+)(;)/,
									`$1${sp.respawnZ}$3`,
								);
							}
							respawnPatched = true;
						}
						// Fallback for old projects: patch hardcoded .position.set(X,Y,Z) in respawn block
						// Pattern: .position.set(X, Y, Z); followed by .velocity.set(0, 0, 0);
						if (!respawnPatched) {
							code = code.replace(
								/(\.position\.set\s*\(\s*)([^,]+)(\s*,\s*)([^,]+)(\s*,\s*)([^)]+)(\s*\)\s*;\s*\n[^;]*\.velocity\.set\s*\(\s*0\s*,\s*0\s*,\s*0\s*\))/,
								(_, pre, x, s1, y, s2, z, post) =>
									`${pre}${sp.respawnX ?? x.trim()}${s1}${sp.respawnY ?? y.trim()}${s2}${sp.respawnZ ?? z.trim()}${post}`,
							);
						}
					}

					// Also patch spawn variable declarations (for modules where __gs is unavailable)
					if (sp.spawnX != null) {
						code = code.replace(
							/(const spawnX\s*=\s*)([^;]+)(;)/,
							`$1${sp.spawnX}$3`,
						);
					}
					if (sp.spawnY != null) {
						code = code.replace(
							/(const spawnY\s*=\s*)([^;]+)(;)/,
							`$1${sp.spawnY}$3`,
						);
					}
					if (sp.spawnZ != null) {
						code = code.replace(
							/(const spawnZ\s*=\s*)([^;]+)(;)/,
							`$1${sp.spawnZ}$3`,
						);
					}

					// Also patch SCENE_EDITOR_OVERRIDES — update Character_/Player_ positions
					if (code.includes("SCENE_EDITOR_OVERRIDES_DATA:")) {
						const dataMatch = code.match(/SCENE_EDITOR_OVERRIDES_DATA:\s*(.+)/);
						if (dataMatch) {
							try {
								const ov = JSON.parse(dataMatch[1]);
								for (const key of Object.keys(ov)) {
									if (key.startsWith("Character_") || key.startsWith("Player_")) {
										if (ov[key].p) {
											if (sp.spawnX !== undefined) ov[key].p[0] = sp.spawnX;
											if (sp.spawnY !== undefined) ov[key].p[1] = sp.spawnY;
											if (sp.spawnZ !== undefined) ov[key].p[2] = sp.spawnZ;
										}
									}
								}
								const newJson = JSON.stringify(ov);
								const oldJson = dataMatch[1].trim();
								code = code.split(oldJson).join(newJson);
							} catch { /* invalid override JSON — skip */ }
						}
					}
				}
				if (typeof sf === "string") {
					sandpackFiles[sceneKey] = code;
				} else {
					(sandpackFiles[sceneKey] as SandpackFile).code = code;
				}
			}

			// 3. Environment settings handled by runtime override in entry point (async setInterval)
		} catch { /* invalid settings JSON — skip all patching */ }
	}

	// Patch: Inject sole raise for character pivot (prevents shoe sole clipping through floor).
	// Old templates lack this fix; new templates from the updated engine already include it.
	// This runs independently of game settings — always applies to assets-3d.ts.
	{
		const assetsKey = Object.keys(sandpackFiles).find((p) => p.endsWith("/assets-3d.ts"));
		if (assetsKey) {
			const af = sandpackFiles[assetsKey];
			let code = typeof af === "string" ? af : af.code;
			if (!code.includes("_soleRaise") && code.includes("_needsUnityRootFix")) {
				code = code.replace(
					/(console\.log\("\[3D\] Unity Root bone fix: applied -90[^"]+"\);)/,
					"$1\n    var _soleRaise = targetHeight * 0.07; pivot.position.y += _soleRaise;",
				);
				if (typeof af === "string") {
					sandpackFiles[assetsKey] = code;
				} else {
					(sandpackFiles[assetsKey] as SandpackFile).code = code;
				}
			}
		}
	}

	// =====================================================================
	// Runtime patches for existing projects (stored engine code in DB).
	// These fix bugs that are already fixed in the template source but
	// don't take effect until a project is regenerated.
	// =====================================================================

	// Patch assets-3d.ts for existing projects
	{
		const assetsKey2 = Object.keys(sandpackFiles).find((p) => p.endsWith("/assets-3d.ts"));
		if (assetsKey2) {
			const af2 = sandpackFiles[assetsKey2];
			let code = typeof af2 === "string" ? af2 : af2.code;

			// Phase 2: Fix _autoCorrectModelUrl — add dimension-pattern guard
			// Old code "corrects" names like "decorative_1x1x1" by snapping them to valid platform dimensions.
			// The guard prevents this by checking if the baseName IS a dimension pattern or a named decorative.
			if (code.includes("_autoCorrectModelUrl") && !code.includes("_dimGuardApplied")) {
				// Match both TS signature (url: string): string and plain JS (url)
				code = code.replace(
					/function\s+_autoCorrectModelUrl\s*\([^)]*\)\s*(?::\s*string\s*)?\{/,
					`function _autoCorrectModelUrl(url) {
  var _dimGuardApplied = true;
  var _parts = url.split("/"); var _fname = _parts[_parts.length - 1] || "";
  var _bn = _fname.replace(/\\.[^.]+$/, "").replace(/_(blue|green|red|yellow)$/, "");
  if (/^\\d+x\\d+x\\d+$/.test(_bn) || /^platform_decorative_/.test(_bn) || /^platform_slope_/.test(_bn) || /^platform_arrow_/.test(_bn)) return url;`,
				);
			}

			// Bug 1 fix: Convert PBR materials to Phong for ALL loaded models.
			// MeshStandardMaterial (PBR) renders white/grey without environment maps.
			// Patch _loadOrClone to apply the fix to EVERY model, not just decorations.

			// Step 1: Inject _fixDecorationMaterials function definition if not present
			if (code.includes("_loadOrClone") && !code.includes("_fixDecorationMaterials")) {
				code = code.replace(
					/((?:async\s+)?function\s+_loadOrClone\s*\()/,
					`function _fixDecorationMaterials(root) {
  root.traverse(function(child) {
    if (!child.isMesh || !child.material) return;
    var fixMat = function(mat) {
      if (!mat.isMeshStandardMaterial) return mat;
      var hasVtxColor = !!(child.geometry && child.geometry.attributes && child.geometry.attributes.color);
      var phong = new THREE.MeshPhongMaterial({
        color: mat.color ? mat.color.clone() : new THREE.Color(0xcccccc),
        map: mat.map || null,
        normalMap: mat.normalMap || null,
        emissive: new THREE.Color(0x111111),
        emissiveIntensity: 0.15,
        shininess: 12,
        transparent: mat.transparent || false,
        opacity: mat.opacity != null ? mat.opacity : 1,
        side: mat.side,
        alphaTest: mat.alphaTest || 0,
        vertexColors: hasVtxColor,
      });
      return phong;
    };
    if (Array.isArray(child.material)) {
      child.material = child.material.map(fixMat);
    } else {
      child.material = fixMat(child.material);
    }
  });
}
$1`,
				);
			}

			// Step 2: Inject _fixDecorationMaterials(model) call inside _loadOrClone
			// Use negative lookahead to only inject if not already there
			if (code.includes("_loadOrClone")) {
				code = code.replace(
					/(console\.log\s*\(\s*"\[3D\]\s*Loaded\s*GLTF:"\s*,\s*url\s*\)\s*;)(?!\s*\n\s*_fixDecorationMaterials)/,
					`$1\n  _fixDecorationMaterials(model);`,
				);
			}

			// Expose __vibexeFactories from assets-3d.ts where factory functions ARE in scope.
			// The spawn restoration block (injected into Game3D.tsx) polls for this global.
			// Old projects don't have it. We MUST set it here, NOT in Game3D.tsx,
			// because Game3D.tsx doesn't import the factory functions directly.
			if (!code.includes("__vibexeFactories")) {
				code += `\n// Expose factories for scene editor spawn restoration
if (typeof window !== "undefined") {
  (window).__vibexeFactories = {
    createPlatform3D: typeof createPlatform3D !== "undefined" ? createPlatform3D : undefined,
    createCollectible3D: typeof createCollectible3D !== "undefined" ? createCollectible3D : undefined,
    createPlayer3D: typeof createPlayer3D !== "undefined" ? createPlayer3D : undefined,
    createBarrier3D: typeof createBarrier3D !== "undefined" ? createBarrier3D : undefined,
    createDecoration3D: typeof createDecoration3D !== "undefined" ? createDecoration3D : undefined,
    createAnimatedCharacter3D: typeof createAnimatedCharacter3D !== "undefined" ? createAnimatedCharacter3D : undefined,
  };
}
`;
			}

			if (typeof af2 === "string") {
				sandpackFiles[assetsKey2] = code;
			} else {
				(sandpackFiles[assetsKey2] as SandpackFile).code = code;
			}
		}
	}

	// Patch Game3D.tsx engine code for existing projects
	// NOTE: Engine code (__vibexeFactories, factory maps, message handlers, spawn mode)
	// lives in Game3D.tsx, NOT GameScene3D.ts (which is the AI-generated scene setup).
	{
		const sceneKey2 = Object.keys(sandpackFiles).find((p) => p.endsWith("Game3D.tsx"));
		if (sceneKey2) {
			const sf2 = sandpackFiles[sceneKey2];
			let code = typeof sf2 === "string" ? sf2 : sf2.code;

			// Phase 1: Expose __vibexe_scene__ BEFORE gameScene.init()
			// Factories are exposed from assets-3d.ts (where they're in scope).
			// Here we only handle __vibexe_scene__ and factory-move for new-ish projects.
			if (code.includes("await gameScene.init(")) {
				const hasSceneGlobal = code.includes("__vibexe_scene__");
				const hasFactories = code.includes("__vibexeFactories");

				// Old project: inject __vibexe_scene__ = scene before init
				// (factories are handled in assets-3d.ts patch, NOT here)
				if (!hasSceneGlobal) {
					code = code.replace(
						/await\s+gameScene\.init\(/,
						`(window).__vibexe_scene__ = scene;\n    await gameScene.init(`,
					);
				}

				// Case B: Has factories but AFTER init — move before init
				if (hasFactories) {
					const initIdx = code.indexOf("await gameScene.init(");
					const factoriesIdx = code.indexOf("__vibexeFactories");
					if (factoriesIdx > initIdx) {
						code = code.replace(
							/await\s+gameScene\.init\(/,
							`(window).__vibexeFactories = {
      createPlatform3D: createPlatform3D,
      createCollectible3D: createCollectible3D,
      createPlayer3D: createPlayer3D,
      createBarrier3D: createBarrier3D,
      createDecoration3D: createDecoration3D,
      createAnimatedCharacter3D: typeof createAnimatedCharacter3D !== "undefined" ? createAnimatedCharacter3D : undefined,
    };
    await gameScene.init(`,
						);
					}
				}
			}

			// Phase 6: Ensure createAnimatedCharacter3D is in factory maps (_fns / _fns2)
			// Old code may lack it in one or both maps, causing animated character spawn to silently fail.
			if (code.includes("createDecoration3D: createDecoration3D") && !code.includes("createAnimatedCharacter3D: createAnimatedCharacter3D")) {
				code = code.replace(
					/createDecoration3D:\s*createDecoration3D,?\s*\}/g,
					`createDecoration3D: createDecoration3D,
      createAnimatedCharacter3D: typeof createAnimatedCharacter3D !== "undefined" ? createAnimatedCharacter3D : undefined
    }`,
				);
			}

			// Phase 7: __MODEL_URL__ resolution robustness — skip spawn if URL unresolved
			if (code.includes("__MODEL_URL__") && !code.includes("_urlValidationPatch")) {
				// After resolving __MODEL_URL__ placeholders, skip spawn if resolution failed
				code = code.replace(
					/(for\s*\(\s*(?:var|const|let)\s+_k\s+of\s+Object\.keys\(_spawnA\)\s*\)[\s\S]*?_spawnA\[_k\]\s*=\s*modelUrl[^;]+;[\s\S]*?\}[\s\S]*?\})/,
					`$1
                  var _urlValidationPatch = true;
                  var _hasUnresolved = false;
                  for (var _uk of Object.keys(_spawnA)) {
                    if (typeof _spawnA[_uk] === "string" && _spawnA[_uk].startsWith("__MODEL_URL__")) {
                      console.warn("[SPAWN] Failed to resolve model URL:", _spawnA[_uk]);
                      _hasUnresolved = true;
                    }
                  }
                  if (_hasUnresolved) return;`,
				);
			}

			// Phase 8: Spawn mode visual feedback — crosshair cursor
			// Old projects may lack the cursor change in the spawn mode handler
			if (code.includes("game-editor-set-spawn-mode") && !code.includes("style.cursor")) {
				code = code.replace(
					/(_spawnMode\s*=\s*!!d\.active;[\s\S]*?_spawnArgs\s*=\s*d\.args[^;]*;)/,
					`$1\n                  renderer.domElement.style.cursor = d.active ? "crosshair" : "";`,
				);
			}

			// Phase 9: Defer cleanup until host confirms objects collected
			// Add game-editor-cleanup-confirmed handler alongside existing editor message handlers
			if (!code.includes("game-editor-cleanup-confirmed") && code.includes("game-editor-enable")) {
				// Insert the handler in the switch/case block before a known case
				code = code.replace(
					/(case\s*["']game-editor-get-spawned-objects["']\s*:)/,
					`case "game-editor-cleanup-confirmed":
                delete (window).__vibexe_scene__;
                delete (window).__vibexeFactories;
                break;
              $1`,
				);
			}

			// Phase 10: Inject texture library helpers + message handlers for existing projects
			if (!code.includes("game-editor-apply-texture") && code.includes("game-editor-enable")) {
				// 10a: Inject _textureCache, _originalMaps, _applyTextureToMesh, _removeTextureFromMesh
				// before the _sendSelectedObject function
				if (code.includes("function _sendSelectedObject")) {
					code = code.replace(
						/(function _sendSelectedObject)/,
						`var _textureCache = {};
          var _originalMaps = new WeakMap();
          var _envMapGenerated = false;
          function _ensureEnvironmentMap() {
            if (_envMapGenerated) return;
            _envMapGenerated = true;
            var pmrem = new THREE.PMREMGenerator(renderer);
            pmrem.compileEquirectangularShader();
            var envScene = new THREE.Scene();
            var _skyG = new THREE.SphereGeometry(50, 32, 16);
            envScene.add(new THREE.Mesh(_skyG, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 2.1, 2.5), side: THREE.BackSide })));
            var _gndG = new THREE.SphereGeometry(49, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
            envScene.add(new THREE.Mesh(_gndG, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.12), side: THREE.BackSide })));
            var _pG = new THREE.PlaneGeometry(8, 8);
            var _aP = function(x,y,z,r,g,b,sx,sy) {
              var p = new THREE.Mesh(_pG, new THREE.MeshBasicMaterial({ color: new THREE.Color(r,g,b), side: THREE.DoubleSide }));
              p.position.set(x,y,z); p.lookAt(0,0,0); p.scale.set(sx,sy,1);
              envScene.add(p);
            };
            _aP(0,45,-5, 20,20,18, 4, 4);
            _aP(20,25,-15, 15,14,12, 3, 2.5);
            _aP(-25,20,-10, 5,7,10, 2.5, 2);
            _aP(5,30,10, 10,8,5, 2, 1.5);
            _aP(0,-10,0, 3,3,4, 5, 5);
            _aP(30,5,15, 6,6,8, 2, 2);
            _aP(-30,10,15, 4,5,7, 2, 2);
            scene.environment = pmrem.fromScene(envScene, 0, 0.1, 100).texture;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            pmrem.dispose(); _skyG.dispose(); _gndG.dispose(); _pG.dispose();
            var _hdriUrl = (window.__VIBEXE_API_ORIGIN__ || "") + "/api/app-builder/media-stock-3d/textures/env_studio.jpg";
            new THREE.TextureLoader().load(_hdriUrl, function(hdriTex) {
              hdriTex.mapping = THREE.EquirectangularReflectionMapping;
              var pmrem2 = new THREE.PMREMGenerator(renderer);
              scene.environment = pmrem2.fromEquirectangular(hdriTex).texture;
              pmrem2.dispose(); hdriTex.dispose();
            }, undefined, function() {});
            if (!scene.getObjectByName("__pbr_key__")) {
              var pbrKey = new THREE.DirectionalLight(0xFFFBF0, 1.5);
              pbrKey.name = "__pbr_key__";
              pbrKey.position.set(15, 30, -10);
              pbrKey.castShadow = false;
              scene.add(pbrKey);
            }
          }
          function _applyTextureToMesh(obj, textureUrl, tileX, tileY, rotation, offsetX, offsetY, hasPBR) {
            var _resolvedUrl = textureUrl;
            if (textureUrl.charAt(0) === "/") {
              _resolvedUrl = (window.__VIBEXE_API_ORIGIN__ || "") + textureUrl;
            }
            if (!obj.userData) obj.userData = {};
            if (!obj.userData.vibexeArgs) obj.userData.vibexeArgs = {};
            obj.userData.vibexeArgs.textureUrl = textureUrl;
            obj.userData.vibexeArgs.textureTileX = tileX;
            obj.userData.vibexeArgs.textureTileY = tileY;
            obj.userData.vibexeArgs.textureRotation = rotation || 0;
            obj.userData.vibexeArgs.textureOffsetX = offsetX || 0;
            obj.userData.vibexeArgs.textureOffsetY = offsetY || 0;
            if (hasPBR) obj.userData.vibexeArgs.hasPBR = true;
            else delete obj.userData.vibexeArgs.hasPBR;
            var _rot = ((rotation || 0) * Math.PI) / 180;
            var _offX = offsetX || 0;
            var _offY = offsetY || 0;
            if (hasPBR) {
              _ensureEnvironmentMap();
              var _baseNoExt = _resolvedUrl.replace(/\\.[^.]+$/, "");
              var _ext = (_resolvedUrl.match(/\\.[^.]+$/) || [".jpg"])[0];
              var _normalUrl = _baseNoExt + "_Normal" + _ext;
              var _roughnessUrl = _baseNoExt + "_Roughness" + _ext;
              var _metalnessUrl = _baseNoExt + "_Metalness" + _ext;
              var _aoUrl = _baseNoExt + "_AO" + _ext;
              var _fname = _resolvedUrl.split("/").pop() || "";
              var _nScale = 1.0;
              if (/^Metal/i.test(_fname)) _nScale = 0.8;
              else if (/^Brick/i.test(_fname)) _nScale = 1.5;
              else if (/^Rock|^Paving/i.test(_fname)) _nScale = 1.2;
              else if (/^Wood|^WoodFloor|^Planks/i.test(_fname)) _nScale = 0.6;
              else if (/^Concrete|^Plaster/i.test(_fname)) _nScale = 0.8;
              else if (/^Fabric|^Leather|^Carpet/i.test(_fname)) _nScale = 0.5;
              else if (/^Marble|^Granite|^Onyx|^Travertine/i.test(_fname)) _nScale = 0.7;
              var _configureTex = function(tex, isSRGB) {
                var t = tex.clone(); t.needsUpdate = true;
                t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
                t.repeat.set(tileX, tileY); t.rotation = _rot;
                t.center.set(0.5, 0.5); t.offset.set(_offX, _offY);
                t.anisotropy = 4;
                if (isSRGB && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
                return t;
              };
              var _loadTex = function(url) {
                if (url in _textureCache) return Promise.resolve(_textureCache[url]);
                return new Promise(function(resolve) {
                  new THREE.TextureLoader().load(url, function(tex) { _textureCache[url] = tex; resolve(tex); }, undefined, function() { _textureCache[url] = null; resolve(null); });
                });
              };
              Promise.all([_loadTex(_resolvedUrl), _loadTex(_normalUrl), _loadTex(_roughnessUrl), _loadTex(_metalnessUrl), _loadTex(_aoUrl)])
                .then(function(maps) {
                  var colorTex = maps[0], normalTex = maps[1], roughnessTex = maps[2], metalnessTex = maps[3], aoTex = maps[4];
                  if (!colorTex) return;
                  var applyPBR = function(child) {
                    if (!child.isMesh || !child.material) return;
                    var mats = Array.isArray(child.material) ? child.material : [child.material];
                    var newMats = mats.map(function(mat) {
                      if (!child.__vibexe_origMats) child.__vibexe_origMats = [];
                      child.__vibexe_origMats.push(mat);
                      var _mOpts = {
                        map: _configureTex(colorTex, true),
                        roughness: roughnessTex ? 1.0 : 0.7,
                        metalness: metalnessTex ? 1.0 : 0.0,
                        envMapIntensity: metalnessTex ? 2.0 : 1.0
                      };
                      if (normalTex) { _mOpts.normalMap = _configureTex(normalTex, false); _mOpts.normalScale = new THREE.Vector2(_nScale, _nScale); }
                      if (roughnessTex) _mOpts.roughnessMap = _configureTex(roughnessTex, false);
                      if (metalnessTex) _mOpts.metalnessMap = _configureTex(metalnessTex, false);
                      if (aoTex) { _mOpts.aoMap = _configureTex(aoTex, false); _mOpts.aoMapIntensity = 1.0; }
                      var stdMat = new THREE.MeshStandardMaterial(_mOpts);
                      if (aoTex && child.geometry && child.geometry.attributes.uv && !child.geometry.attributes.uv2) {
                        child.geometry.setAttribute("uv2", child.geometry.attributes.uv);
                      }
                      return stdMat;
                    });
                    child.material = Array.isArray(child.material) ? newMats : newMats[0];
                  };
                  obj.traverse(applyPBR);
                  if (obj.isMesh && obj.material) applyPBR(obj);
                });
              return;
            }
            var applyToMat = function(mat, tex) {
              if (!_originalMaps.has(mat)) _originalMaps.set(mat, { map: mat.map, color: mat.color ? mat.color.clone() : null });
              var t = tex.clone();
              t.needsUpdate = true;
              t.wrapS = THREE.RepeatWrapping;
              t.wrapT = THREE.RepeatWrapping;
              t.repeat.set(tileX, tileY);
              t.rotation = _rot;
              t.center.set(0.5, 0.5);
              t.offset.set(_offX, _offY);
              if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
              t.anisotropy = 4;
              mat.map = t;
              if (mat.color) mat.color.set(0xffffff);
              mat.needsUpdate = true;
            };
            var apply = function(tex) {
              obj.traverse(function(child) {
                if (!child.isMesh || !child.material) return;
                var mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(function(m) { applyToMat(m, tex); });
              });
              if (obj.isMesh && obj.material) {
                var ms = Array.isArray(obj.material) ? obj.material : [obj.material];
                ms.forEach(function(m) { applyToMat(m, tex); });
              }
            };
            if (_textureCache[_resolvedUrl]) { apply(_textureCache[_resolvedUrl]); }
            else { new THREE.TextureLoader().load(_resolvedUrl, function(tex) { _textureCache[_resolvedUrl] = tex; apply(tex); }); }
          }
          function _removeTextureFromMesh(obj) {
            var restorePBR = function(child) {
              if (child.__vibexe_origMats && child.isMesh) {
                var origMats = child.__vibexe_origMats;
                if (Array.isArray(child.material)) {
                  child.material.forEach(function(m) { if (m.dispose) m.dispose(); });
                  child.material = origMats.length > 1 ? origMats : origMats[0];
                } else {
                  if (child.material.dispose) child.material.dispose();
                  child.material = origMats[0];
                }
                delete child.__vibexe_origMats;
                return true;
              }
              return false;
            };
            var hadPBR = false;
            obj.traverse(function(child) { if (restorePBR(child)) hadPBR = true; });
            if (obj.isMesh && restorePBR(obj)) hadPBR = true;
            if (!hadPBR) {
              var restore = function(mat) {
                if (_originalMaps.has(mat)) { var orig = _originalMaps.get(mat); if (orig && typeof orig === "object" && "map" in orig) { mat.map = orig.map; if (orig.color && mat.color) mat.color.copy(orig.color); } else { mat.map = orig; } _originalMaps.delete(mat); mat.needsUpdate = true; }
              };
              obj.traverse(function(child) {
                if (!child.isMesh || !child.material) return;
                var mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(restore);
              });
              if (obj.isMesh && obj.material) {
                var ms = Array.isArray(obj.material) ? obj.material : [obj.material];
                ms.forEach(restore);
              }
            }
            if (obj.userData && obj.userData.vibexeArgs) {
              delete obj.userData.vibexeArgs.textureUrl;
              delete obj.userData.vibexeArgs.textureTileX;
              delete obj.userData.vibexeArgs.textureTileY;
              delete obj.userData.vibexeArgs.textureRotation;
              delete obj.userData.vibexeArgs.textureOffsetX;
              delete obj.userData.vibexeArgs.textureOffsetY;
              delete obj.userData.vibexeArgs.hasPBR;
            }
            delete obj.__hasTextureOverride;
          }
          $1`,
					);
				}

				// 10b: Extend _sendSelectedObject payload with texture fields
				if (!code.includes("_textureUrl:")) {
					const _texFields = `
              _textureUrl: obj.userData && obj.userData.vibexeArgs ? obj.userData.vibexeArgs.textureUrl || null : null,
              _textureTileX: obj.userData && obj.userData.vibexeArgs ? obj.userData.vibexeArgs.textureTileX || 1 : 1,
              _textureTileY: obj.userData && obj.userData.vibexeArgs ? obj.userData.vibexeArgs.textureTileY || 1 : 1,
              _textureRotation: obj.userData && obj.userData.vibexeArgs ? obj.userData.vibexeArgs.textureRotation || 0 : 0,
              _textureOffsetX: obj.userData && obj.userData.vibexeArgs ? obj.userData.vibexeArgs.textureOffsetX || 0 : 0,
              _textureOffsetY: obj.userData && obj.userData.vibexeArgs ? obj.userData.vibexeArgs.textureOffsetY || 0 : 0,
              _hasPBR: obj.userData && obj.userData.vibexeArgs ? obj.userData.vibexeArgs.hasPBR || false : false,`;
					if (code.includes("_materialColor: matColor,")) {
						// Anchor on _materialColor if it exists
						code = code.replace(
							/_materialColor:\s*matColor,\s*\}/,
							`_materialColor: matColor,${_texFields}
              }`,
						);
					} else if (code.includes("function _sendSelectedObject")) {
						// Fallback: anchor on castShadow or userData inside _sendSelectedObject
						const anchored = code.replace(
							/(userData:\s*_safeUserData\(obj\.userData\),?\s*)(},\s*"\*"\))/,
							`$1${_texFields}
              $2`,
						);
						if (anchored !== code) {
							code = anchored;
						} else {
							// Last resort: anchor on castShadow line
							code = code.replace(
								/(castShadow:\s*!!obj\.castShadow,?\s*)(},\s*"\*"\))/,
								`$1${_texFields}
              $2`,
							);
						}
					}
				}

				// 10c: Inject 3 texture message handlers before game-editor-get-spawned-objects
				// These handlers send the full selected-object message directly (not via _sendSelectedObject)
				// to guarantee texture fields are included even if _sendSelectedObject wasn't patched
				code = code.replace(
					/(case\s*["']game-editor-get-spawned-objects["']\s*:)/,
					`case "game-editor-apply-texture": {
                console.log("[TEXTURE] apply-texture handler reached. uuid:", d.uuid, "url:", d.textureUrl, "hasPBR:", d.hasPBR);
                var _texTarget = null;
                scene.traverse(function(c) { if (c.uuid === d.uuid) _texTarget = c; });
                console.log("[TEXTURE] Found target:", !!_texTarget, _texTarget ? _texTarget.name : "none");
                if (_texTarget) {
                  _applyTextureToMesh(_texTarget, d.textureUrl, d.tileX || 1, d.tileY || 1, 0, 0, 0, d.hasPBR);
                  if (!_texTarget.userData.__spawned) _texTarget.__hasTextureOverride = true;
                  var _mc = null;
                  if (_texTarget.material && _texTarget.material.color) { try { _mc = "#" + _texTarget.material.color.getHexString(); } catch(e) {} }
                  var _tA = _texTarget.userData && _texTarget.userData.vibexeArgs ? _texTarget.userData.vibexeArgs : {};
                  window.parent.postMessage({
                    type: "game-editor-object-selected",
                    uuid: _texTarget.uuid,
                    name: _texTarget.name || _texTarget.type,
                    objType: _texTarget.userData && _texTarget.userData.vibexeType ? _texTarget.userData.vibexeType : _texTarget.type,
                    position: { x: _texTarget.position.x, y: _texTarget.position.y, z: _texTarget.position.z },
                    rotation: { x: _texTarget.rotation.x * 180 / Math.PI, y: _texTarget.rotation.y * 180 / Math.PI, z: _texTarget.rotation.z * 180 / Math.PI },
                    scale: { x: _texTarget.scale.x, y: _texTarget.scale.y, z: _texTarget.scale.z },
                    visible: _texTarget.visible !== false,
                    castShadow: !!_texTarget.castShadow,
                    userData: (function(ud) { try { return JSON.parse(JSON.stringify(ud || {})); } catch(e) { return {}; } })(_texTarget.userData),
                    _materialColor: _mc,
                    _textureUrl: _tA.textureUrl || null,
                    _textureTileX: _tA.textureTileX || 1,
                    _textureTileY: _tA.textureTileY || 1,
                    _textureRotation: _tA.textureRotation || 0,
                    _textureOffsetX: _tA.textureOffsetX || 0,
                    _textureOffsetY: _tA.textureOffsetY || 0,
                    _hasPBR: _tA.hasPBR || false,
                  }, "*");
                  console.log("[TEXTURE] Sent object-selected with textureUrl:", _tA.textureUrl);
                }
                break;
              }
              case "game-editor-remove-texture": {
                var _rtTarget = null;
                scene.traverse(function(c) { if (c.uuid === d.uuid) _rtTarget = c; });
                if (_rtTarget) {
                  _removeTextureFromMesh(_rtTarget);
                  var _mc2 = null;
                  if (_rtTarget.material && _rtTarget.material.color) { try { _mc2 = "#" + _rtTarget.material.color.getHexString(); } catch(e) {} }
                  window.parent.postMessage({
                    type: "game-editor-object-selected",
                    uuid: _rtTarget.uuid,
                    name: _rtTarget.name || _rtTarget.type,
                    objType: _rtTarget.userData && _rtTarget.userData.vibexeType ? _rtTarget.userData.vibexeType : _rtTarget.type,
                    position: { x: _rtTarget.position.x, y: _rtTarget.position.y, z: _rtTarget.position.z },
                    rotation: { x: _rtTarget.rotation.x * 180 / Math.PI, y: _rtTarget.rotation.y * 180 / Math.PI, z: _rtTarget.rotation.z * 180 / Math.PI },
                    scale: { x: _rtTarget.scale.x, y: _rtTarget.scale.y, z: _rtTarget.scale.z },
                    visible: _rtTarget.visible !== false,
                    castShadow: !!_rtTarget.castShadow,
                    userData: (function(ud) { try { return JSON.parse(JSON.stringify(ud || {})); } catch(e) { return {}; } })(_rtTarget.userData),
                    _materialColor: _mc2,
                    _textureUrl: null,
                    _textureTileX: 1,
                    _textureTileY: 1,
                    _textureRotation: 0,
                    _textureOffsetX: 0,
                    _textureOffsetY: 0,
                    _hasPBR: false,
                  }, "*");
                }
                break;
              }
              case "game-editor-update-tiling": {
                var _utTarget = null;
                scene.traverse(function(c) { if (c.uuid === d.uuid) _utTarget = c; });
                if (_utTarget && _utTarget.userData && _utTarget.userData.vibexeArgs && _utTarget.userData.vibexeArgs.textureUrl) {
                  var _utA = _utTarget.userData.vibexeArgs;
                  _applyTextureToMesh(_utTarget, _utA.textureUrl, d.tileX || 1, d.tileY || 1, _utA.textureRotation || 0, _utA.textureOffsetX || 0, _utA.textureOffsetY || 0, _utA.hasPBR);
                  var _mc3 = null;
                  if (_utTarget.material && _utTarget.material.color) { try { _mc3 = "#" + _utTarget.material.color.getHexString(); } catch(e) {} }
                  window.parent.postMessage({
                    type: "game-editor-object-selected",
                    uuid: _utTarget.uuid,
                    name: _utTarget.name || _utTarget.type,
                    objType: _utTarget.userData && _utTarget.userData.vibexeType ? _utTarget.userData.vibexeType : _utTarget.type,
                    position: { x: _utTarget.position.x, y: _utTarget.position.y, z: _utTarget.position.z },
                    rotation: { x: _utTarget.rotation.x * 180 / Math.PI, y: _utTarget.rotation.y * 180 / Math.PI, z: _utTarget.rotation.z * 180 / Math.PI },
                    scale: { x: _utTarget.scale.x, y: _utTarget.scale.y, z: _utTarget.scale.z },
                    visible: _utTarget.visible !== false,
                    castShadow: !!_utTarget.castShadow,
                    userData: (function(ud) { try { return JSON.parse(JSON.stringify(ud || {})); } catch(e) { return {}; } })(_utTarget.userData),
                    _materialColor: _mc3,
                    _textureUrl: _utA.textureUrl || null,
                    _textureTileX: _utA.textureTileX || 1,
                    _textureTileY: _utA.textureTileY || 1,
                    _textureRotation: _utA.textureRotation || 0,
                    _textureOffsetX: _utA.textureOffsetX || 0,
                    _textureOffsetY: _utA.textureOffsetY || 0,
                    _hasPBR: _utA.hasPBR || false,
                  }, "*");
                }
                break;
              }
              case "game-editor-update-texture-params": {
                var _tpTarget = null;
                scene.traverse(function(c) { if (c.uuid === d.uuid) _tpTarget = c; });
                if (_tpTarget && _tpTarget.userData && _tpTarget.userData.vibexeArgs && _tpTarget.userData.vibexeArgs.textureUrl) {
                  _applyTextureToMesh(_tpTarget, _tpTarget.userData.vibexeArgs.textureUrl, d.tileX || 1, d.tileY || 1, d.rotation || 0, d.offsetX || 0, d.offsetY || 0, _tpTarget.userData.vibexeArgs.hasPBR);
                  if (!_tpTarget.userData.__spawned) _tpTarget.__hasTextureOverride = true;
                  var _mc4 = null;
                  if (_tpTarget.material && _tpTarget.material.color) { try { _mc4 = "#" + _tpTarget.material.color.getHexString(); } catch(e) {} }
                  var _tpA = _tpTarget.userData.vibexeArgs;
                  window.parent.postMessage({
                    type: "game-editor-object-selected",
                    uuid: _tpTarget.uuid,
                    name: _tpTarget.name || _tpTarget.type,
                    objType: _tpTarget.userData && _tpTarget.userData.vibexeType ? _tpTarget.userData.vibexeType : _tpTarget.type,
                    position: { x: _tpTarget.position.x, y: _tpTarget.position.y, z: _tpTarget.position.z },
                    rotation: { x: _tpTarget.rotation.x * 180 / Math.PI, y: _tpTarget.rotation.y * 180 / Math.PI, z: _tpTarget.rotation.z * 180 / Math.PI },
                    scale: { x: _tpTarget.scale.x, y: _tpTarget.scale.y, z: _tpTarget.scale.z },
                    visible: _tpTarget.visible !== false,
                    castShadow: !!_tpTarget.castShadow,
                    userData: (function(ud) { try { return JSON.parse(JSON.stringify(ud || {})); } catch(e) { return {}; } })(_tpTarget.userData),
                    _materialColor: _mc4,
                    _textureUrl: _tpA.textureUrl || null,
                    _textureTileX: _tpA.textureTileX || 1,
                    _textureTileY: _tpA.textureTileY || 1,
                    _textureRotation: _tpA.textureRotation || 0,
                    _textureOffsetX: _tpA.textureOffsetX || 0,
                    _textureOffsetY: _tpA.textureOffsetY || 0,
                    _hasPBR: _tpA.hasPBR || false,
                  }, "*");
                }
                break;
              }
              $1`,
				);

				// 10d: Extend game-editor-get-spawned-objects to collect textureOverrides
				if (code.includes("game-editor-spawned-objects") && !code.includes("textureOverrides")) {
					code = code.replace(
						/window\.parent\.postMessage\(\s*\{\s*type:\s*["']game-editor-spawned-objects["']\s*,\s*objects:\s*spawned\s*\}\s*,/,
						`var textureOverrides = [];
                scene.traverse(function(child) {
                  if (child.__hasTextureOverride && child.userData && child.userData.vibexeArgs && child.userData.vibexeArgs.textureUrl) {
                    textureOverrides.push({ name: child.name, textureUrl: child.userData.vibexeArgs.textureUrl, tileX: child.userData.vibexeArgs.textureTileX || 1, tileY: child.userData.vibexeArgs.textureTileY || 1, rotation: child.userData.vibexeArgs.textureRotation || 0, offsetX: child.userData.vibexeArgs.textureOffsetX || 0, offsetY: child.userData.vibexeArgs.textureOffsetY || 0, hasPBR: child.userData.vibexeArgs.hasPBR || false });
                  }
                });
                window.parent.postMessage({ type: "game-editor-spawned-objects", objects: spawned, textureOverrides: textureOverrides },`,
					);
				}
			}

			if (typeof sf2 === "string") {
				sandpackFiles[sceneKey2] = code;
			} else {
				(sandpackFiles[sceneKey2] as SandpackFile).code = code;
			}
		}
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
