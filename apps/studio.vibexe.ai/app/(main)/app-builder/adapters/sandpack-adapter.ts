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
import { ALL_MODULE_MANIFESTS } from "@vibexe-ai/vibexe-engine";

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

class ModulesClient {
  getInstalled() {
    return (typeof window !== "undefined" && window.__VIBEXE_INSTALLED_MODULES__) || [];
  }
  isInstalled(id) {
    return this.getInstalled().indexOf(id) !== -1;
  }
  getConfig(id) {
    var gs = typeof window !== "undefined" && window.__VIBEXE_GAME_SETTINGS__;
    if (!gs || !gs.modules || !gs.modules.installed) return null;
    var m = gs.modules.installed[id];
    return m && m.enabled ? m.config || {} : null;
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
    this.modules = new ModulesClient();
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

	// Inject Three.js r172 shim if any file imports it.
	// Core: CJS wrapper (same proven pattern as cannon-es).
	// Addons: ESM source → transform imports/exports → eval in function scope → attach to THREE.
	const usesThree = files.some(
		(f) => f.content && (f.content.includes("from 'three'") || f.content.includes('from "three"') || f.content.includes("(window as any).THREE")),
	);
	if (usesThree) {
		sandpackFiles["/node_modules/three/package.json"] = {
			code: JSON.stringify({ name: "three", version: "0.172.0", main: "index.js" }),
			hidden: true,
		};
		sandpackFiles["/node_modules/three/index.js"] = {
			code: [
				"// Three.js r172 shim — CJS core + ESM addon transform",
				"// Step 1: Load core via CJS wrapper (same pattern as cannon-es)",
				"if (typeof window.THREE === 'undefined') {",
				"  var _m = { exports: {} }, _e = _m.exports;",
				"  var xhr = new XMLHttpRequest();",
				"  xhr.open('GET', 'https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.cjs', false);",
				"  xhr.send();",
				"  if (xhr.status === 200) {",
				"    var _fakeReq = function(mod) { return {}; };",
				"    (new Function('module','exports','require', xhr.responseText))(_m, _e, _fakeReq);",
				"    window.THREE = _m.exports;",
				"  }",
				"}",
				"",
				"// Step 2: ESM addon loader — transforms ESM source to function scope",
				"function __loadThreeAddon(url, names) {",
				"  if (!window.THREE) return;",
				"  var xhr = new XMLHttpRequest();",
				"  xhr.open('GET', url, false);",
				"  xhr.send();",
				"  if (xhr.status !== 200) { console.warn('[Three.js shim] Failed to load:', url, xhr.status); return; }",
				"  var src = xhr.responseText;",
				"  // Replace ESM imports from 'three' with THREE reference",
				"  src = src.replace(/import\\s*\\{([^}]+)\\}\\s*from\\s*['\"]three['\"];?/g, 'var {$1} = THREE;');",
				"  src = src.replace(/import\\s*\\*\\s*as\\s+(\\w+)\\s+from\\s*['\"]three['\"];?/g, 'var $1 = THREE;');",
				"  // Replace cross-addon relative imports (already attached to THREE)",
				"  src = src.replace(/import\\s*\\{([^}]+)\\}\\s*from\\s*['\"][^'\"]*\\.js['\"];?/g, 'var {$1} = THREE;');",
				"  // Strip export keywords",
				"  src = src.replace(/export\\s+default\\s+/g, '');",
				"  src = src.replace(/export\\s+(class|function)\\s+/g, '$1 ');",
				"  src = src.replace(/export\\s+(const|let|var)\\s+/g, 'var ');",
				"  src = src.replace(/export\\s*\\{[^}]*\\};?/g, '');",
				"  // Build return statement for named exports",
				"  var ret = 'return {' + names.map(function(n) {",
				"    return n + ':typeof ' + n + '!==\"undefined\"?' + n + ':undefined';",
				"  }).join(',') + '};';",
				"  try {",
				"    var fn = new Function('THREE', src + '\\n' + ret);",
				"    var result = fn(window.THREE);",
				"    for (var k in result) { if (result[k] !== undefined) window.THREE[k] = result[k]; }",
				"  } catch(err) { console.warn('[Three.js shim] Addon error:', url, err.message); }",
				"}",
				"",
				"// Step 3: Load addons in dependency order",
				"var _cdnBase = 'https://cdn.jsdelivr.net/npm/three@0.172.0/examples/jsm';",
				"// Core addons",
				"__loadThreeAddon(_cdnBase + '/loaders/GLTFLoader.js', ['GLTFLoader']);",
				"__loadThreeAddon(_cdnBase + '/controls/OrbitControls.js', ['OrbitControls']);",
				"__loadThreeAddon(_cdnBase + '/controls/TransformControls.js', ['TransformControls']);",
				"// Post-processing (dependency order matters)",
				"__loadThreeAddon(_cdnBase + '/postprocessing/Pass.js', ['Pass','FullScreenQuad']);",
				"__loadThreeAddon(_cdnBase + '/shaders/CopyShader.js', ['CopyShader']);",
				"__loadThreeAddon(_cdnBase + '/shaders/LuminosityHighPassShader.js', ['LuminosityHighPassShader']);",
				"__loadThreeAddon(_cdnBase + '/postprocessing/MaskPass.js', ['MaskPass','ClearMaskPass']);",
				"__loadThreeAddon(_cdnBase + '/postprocessing/ShaderPass.js', ['ShaderPass']);",
				"__loadThreeAddon(_cdnBase + '/postprocessing/EffectComposer.js', ['EffectComposer']);",
				"__loadThreeAddon(_cdnBase + '/postprocessing/RenderPass.js', ['RenderPass']);",
				"__loadThreeAddon(_cdnBase + '/postprocessing/UnrealBloomPass.js', ['UnrealBloomPass']);",
				"",
				"console.log('[Three.js shim] r' + (window.THREE && window.THREE.REVISION) + ' loaded with ' + ",
				"  ['GLTFLoader','OrbitControls','TransformControls','EffectComposer'].filter(function(n){ return !!window.THREE[n]; }).length + '/4 core addons');",
				"module.exports = window.THREE;",
			].join("\n"),
			hidden: true,
		};
		// Post-processing shim — still needed as import target but addons are loaded above
		sandpackFiles["/node_modules/three-postprocessing-shim/package.json"] = {
			code: JSON.stringify({ name: "three-postprocessing-shim", version: "1.0.0", main: "index.js" }),
			hidden: true,
		};
		sandpackFiles["/node_modules/three-postprocessing-shim/index.js"] = {
			code: "// Post-processing classes already loaded by three/index.js shim\n",
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

	// ---- Vibexe Module Injection ----
	// Modules are self-contained feature packages injected as /node_modules/@vibexe/{id}/
	// They're only loaded if:
	//   1. Listed in __vibexe-modules.json (explicit install), OR
	//   2. Code imports from @vibexe/{id} (auto-detection fallback)

	// Read module manifest from __vibexe-modules.json OR from __game-settings.json
	const modulesFile = files.find(
		(f) => f.path === "src/__vibexe-modules.json" || f.path === "__vibexe-modules.json"
	);
	let installedModules: Record<string, { enabled: boolean; version?: string; config?: Record<string, unknown> }> = {};
	if (modulesFile?.content) {
		try {
			const parsed = JSON.parse(modulesFile.content);
			installedModules = parsed.installed || {};
		} catch { /* invalid JSON */ }
	}
	// Merge modules from game settings (always up-to-date, takes precedence)
	if (settingsFile?.content) {
		try {
			const gs = JSON.parse(settingsFile.content);
			if (gs.modules?.installed) {
				for (const [id, cfg] of Object.entries(gs.modules.installed as typeof installedModules)) {
					installedModules[id] = cfg;
				}
			}
		} catch { /* invalid JSON */ }
	}

	// Auto-detect module imports (fallback for projects without manifest)
	for (const mod of ALL_MODULE_MANIFESTS) {
		const moduleImport = `@vibexe/${mod.id}`;
		const usesModule = files.some(
			(f) => f.content && f.content.includes(moduleImport)
		);
		if (usesModule && !installedModules[mod.id]) {
			installedModules[mod.id] = { enabled: true, version: mod.version };
		}
	}

	// Inject enabled modules
	for (const [moduleId, moduleConfig] of Object.entries(installedModules)) {
		if (!moduleConfig.enabled) continue;

		const manifest = ALL_MODULE_MANIFESTS.find((m) => m.id === moduleId);
		if (!manifest) continue;

		const pkgName = `@vibexe/${moduleId}`;

		// Package.json
		sandpackFiles[`/node_modules/${pkgName}/package.json`] = {
			code: JSON.stringify({
				name: pkgName,
				version: manifest.version,
				main: "index.js",
			}),
			hidden: true,
		};

		// Module source - use runtimeCode from manifest, or generate a stub
		const moduleSource = manifest.runtimeCode || [
			`// @vibexe/${moduleId} module stub`,
			`// Runtime code will be populated by the module system`,
			`console.log('[Vibexe Module] ${manifest.name} v${manifest.version} loaded');`,
			`module.exports = {};`,
		].join("\n");

		sandpackFiles[`/node_modules/${pkgName}/index.js`] = {
			code: moduleSource,
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
		// Expose installed modules list for runtime access
		const enabledModuleIds = Object.entries(installedModules)
			.filter(([, cfg]) => cfg.enabled)
			.map(([id]) => id);
		if (enabledModuleIds.length > 0) {
			globals += `(window as any).__VIBEXE_INSTALLED_MODULES__ = ${JSON.stringify(enabledModuleIds)};\n`;
			globals += `console.log('[Vibexe] Injecting modules:', ${JSON.stringify(enabledModuleIds)});\n`;
			// Auto-import enabled modules so their runtimeCode executes
			for (const modId of enabledModuleIds) {
				globals += `console.log('[Vibexe] Requiring @vibexe/${modId}');\n`;
				globals += `require('@vibexe/${modId}');\n`;
			}
		}
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
						"if(e.fogEnabled){try{s.fog=new T.Fog(e.fogColor||e.backgroundColor||'#87CEEB',e.fogNear||30,e.fogFar||100)}catch(x){}}",
						"var amb=s.getObjectByName('__default_ambient__');if(amb&&e.ambientLightIntensity!=null)amb.intensity=e.ambientLightIntensity;if(amb&&e.ambientLightColor)try{amb.color=new T.Color(e.ambientLightColor)}catch(x){}",
						"var sun=s.getObjectByName('__default_sun__');if(sun&&e.sunLightIntensity!=null)sun.intensity=e.sunLightIntensity;if(sun&&e.sunLightColor)try{sun.color=new T.Color(e.sunLightColor)}catch(x){}",
						"var hemi=s.getObjectByName('__default_hemi__');if(hemi&&e.hemisphereIntensity!=null)hemi.intensity=e.hemisphereIntensity;if(hemi&&e.hemisphereSkyColor)try{hemi.color=new T.Color(e.hemisphereSkyColor)}catch(x){}if(hemi&&e.hemisphereGroundColor)try{hemi.groundColor=new T.Color(e.hemisphereGroundColor)}catch(x){}",
						// Camera FOV
						"if(c&&_gs.camera&&_gs.camera.fov!=null){c.fov=_gs.camera.fov;c.updateProjectionMatrix()}",
						// Physics gravity — override CANNON.World.gravity at runtime
						"var w=(window as any).__vibexe_world__;",
						"if(w&&_gs.physics&&_gs.physics.gravity!=null){try{w.gravity.set(0,_gs.physics.gravity,0)}catch(x){}}",
						// Audio settings — expose volume globals for game code
						"var _aus=_gs.audio;",
						"if(_aus){window.__vibexe_audio__={enabled:_aus.enabled!==false,masterVolume:_aus.masterVolume!=null?_aus.masterVolume:0.8,musicVolume:_aus.musicVolume!=null?_aus.musicVolume:0.5,sfxVolume:_aus.sfxVolume!=null?_aus.sfxVolume:0.7};if(_aus.enabled===false){var _allAudio=document.querySelectorAll('audio');for(var _ai2=0;_ai2<_allAudio.length;_ai2++){_allAudio[_ai2].muted=true;}}}",
						// Performance settings — apply pixelRatio, maxFPS
						"var _pfs=_gs.performance;",
						"if(_pfs){if(_pfs.pixelRatio!=null){var _prr=window.__vibexe_renderer__;if(_prr&&_prr.setPixelRatio){_prr.setPixelRatio(Math.max(0.5,Math.min(2,_pfs.pixelRatio)))}}if(_pfs.maxFPS!=null){window.__vibexe_maxFPS__=_pfs.maxFPS}if(_pfs.showFPS){var _fpsD=document.createElement('div');_fpsD.id='vibexe-fps';_fpsD.style.cssText='position:fixed;top:4px;left:4px;padding:2px 6px;background:rgba(0,0,0,0.7);color:#0f0;font:11px monospace;z-index:99999;pointer-events:none';document.body.appendChild(_fpsD);var _fc=0,_lt=performance.now();(function _fpsLoop(){_fc++;var now=performance.now();if(now-_lt>=1000){_fpsD.textContent=_fc+' FPS';_fc=0;_lt=now}requestAnimationFrame(_fpsLoop)})()}}",
						// Shadow quality — apply shadow map size and increase shadow camera far for large terrains
						"var _shq=(_gs.environment&&_gs.environment.shadowQuality)||'medium';",
						"var _shSize={low:512,medium:1024,high:2048}[_shq]||1024;",
						"s.traverse(function(obj){if(obj.isLight&&obj.shadow){obj.shadow.mapSize.width=_shSize;obj.shadow.mapSize.height=_shSize;if(obj.shadow.camera){obj.shadow.camera.far=200;obj.shadow.camera.left=-80;obj.shadow.camera.right=80;obj.shadow.camera.top=80;obj.shadow.camera.bottom=-80;obj.shadow.camera.updateProjectionMatrix()}}});",
						// Texture overrides — apply saved textures to scene-original objects
						"var _tov=_gs.textureOverrides;",
						"if(_tov&&_tov.length){var _tl=new T.TextureLoader();for(var _ti=0;_ti<_tov.length;_ti++){(function(_to){var _obj=null;s.traverse(function(ch){if(ch.name===_to.name)_obj=ch;});if(!_obj)return;_tl.load(_to.textureUrl,function(tex){tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(_to.tileX||1,_to.tileY||1);_obj.traverse(function(m){if(m.isMesh&&m.material){m.material.map=tex;m.material.needsUpdate=true;}});})})(_tov[_ti]);}}",
						// FPS cap — wrap requestAnimationFrame to throttle render loop
						"var _mfps=window.__vibexe_maxFPS__;",
						"if(_mfps&&_mfps>0&&_mfps<120){var _origRAF=window.requestAnimationFrame;var _frameInt=1000/_mfps;var _lastFrame=0;window.requestAnimationFrame=function(cb){return _origRAF.call(window,function(ts){if(ts-_lastFrame>=_frameInt){_lastFrame=ts;cb(ts)}else{_origRAF.call(window,cb)}})}}",
						"},100)})();\n",
					].join("");
				}
			} catch { /* invalid JSON */ }
		}
		// Inject game.loadScene() API — allows game code to request scene switches at runtime
		globals += [
			"(function(){",
			"var _vibexeGame = (window as any).__vibexe_game__ || {};",
			"_vibexeGame.loadScene = function(sceneName: string) {",
			"  window.parent.postMessage({ type: 'game-request-load-scene', sceneName: sceneName }, '*');",
			"};",
			"_vibexeGame.getScenes = function() {",
			"  var gs = (window as any).__VIBEXE_GAME_SETTINGS__;",
			"  return (gs && gs.scenes) ? gs.scenes.map(function(s: any) { return { id: s.id, name: s.name, isDefault: s.isDefault }; }) : [];",
			"};",
			"_vibexeGame.getActiveSceneId = function() {",
			"  var gs = (window as any).__VIBEXE_GAME_SETTINGS__;",
			"  return gs && gs.activeSceneId || '';",
			"};",
			"(window as any).__vibexe_game__ = _vibexeGame;",
			"})();\n",
		].join("");

		// Auto-detect player mesh for old saved projects that don't register __vibexe_playerMesh__
		// Polls every 2s for up to 30s. Detects by: animation controller (__play), character name, or physics body signature.
		// Old IIFE code stores playerBody as local var (not in userData), so we primarily detect via animations.
		globals += [
			"(function(){",
			"var _pm=0;",
			"var _pi=setInterval(function(){",
			"  if(window.__vibexe_playerMesh__){clearInterval(_pi);return;}",
			"  _pm++;if(_pm>15){clearInterval(_pi);return;}",
			"  var sc=window.__vibexe_scene__;",
			"  if(!sc)return;",
			"  var candidate=null;",
			"  sc.traverse(function(o){",
			"    if(candidate)return;",
			"    if(!o.userData)return;",
			// Primary: animated character mesh (has __play animation controller from loadModel)
			"    if(o.userData.__play){candidate=o;return;}",
			// Secondary: character-named mesh
			"    var n=(o.name||'').toLowerCase();",
			"    if(n.indexOf('character_')===0||n.indexOf('player')>=0){candidate=o;return;}",
			// Tertiary: physics body with fixedRotation (original check, in case userData.__physicsBody exists)
			"    if(o.userData.__physicsBody&&o.userData.__physicsBody.mass>0&&o.userData.__physicsBody.fixedRotation){candidate=o;return;}",
			"  });",
			"  if(candidate){",
			"    window.__vibexe_playerMesh__=candidate;",
			// Also link the CANNON physics body to userData if not already linked
			"    if(!candidate.userData.__physicsBody){",
			"      var w=window.__vibexe_world__;",
			"      if(w&&w.bodies){",
			"        for(var bi=0;bi<w.bodies.length;bi++){",
			"          var b=w.bodies[bi];",
			"          if(b.mass>0&&b.fixedRotation){",
			"            candidate.userData.__physicsBody=b;",
			"            console.log('[AutoDetect] Linked player physics body (mass:'+b.mass+')');",
			"            break;",
			"          }",
			"        }",
			"      }",
			"    }",
			"    console.log('[AutoDetect] Player mesh registered:',candidate.name||'unnamed','via',candidate.userData.__play?'animation':((candidate.name||'').toLowerCase().indexOf('character_')===0?'name':'physics'));",
			"  }",
			"},2000);",
			"})();\n",
		].join("");

		// Debug overlay — system health query handler (responds to parent frame requests)
		// Enhanced v2: rich diagnostics with problem detection for terrain solidity,
		// player physics, grounded state, and cross-system health analysis
		globals += [
			"(function(){",
			"window.addEventListener('message',function(ev){",
			"if(!ev.data||ev.data.type!=='vibexe-debug-query-systems')return;",
			"var r=[];",
			"var problems=[];",
			"var W=window;",

			// Renderer
			"var ren=W.__vibexe_renderer__;",
			"r.push({system:'Renderer',status:ren?'ok':'missing',details:ren?{pixelRatio:ren.getPixelRatio(),size:ren.getSize?((function(){var s=new(W.THREE||{}).Vector2();ren.getSize(s);return s.x+'x'+s.y})()):'?'}:null});",

			// Scene
			"var sc=W.__vibexe_scene__;",
			"var meshCount=0;var lightCount=0;",
			"if(sc){sc.traverse(function(o){if(o.isMesh)meshCount++;if(o.isLight)lightCount++;})}",
			"r.push({system:'Scene',status:sc?'ok':'missing',details:sc?{children:sc.children.length,meshes:meshCount,lights:lightCount,fog:sc.fog?'active':'none'}:null});",

			// Camera
			"var cam=W.__vibexe_camera__;",
			"r.push({system:'Camera',status:cam?'ok':'missing',details:cam?{fov:cam.fov,near:cam.near,far:cam.far,pos:cam.position?+cam.position.y.toFixed(1)+'y':'?'}:null});",

			// Physics World
			"var w=W.__vibexe_world__;",
			"var dynamicCount=0;var staticCount=0;",
			"if(w&&w.bodies){for(var bi=0;bi<w.bodies.length;bi++){if(w.bodies[bi].mass>0)dynamicCount++;else staticCount++;}}",
			"r.push({system:'Physics',status:w?'ok':'missing',details:w?{bodies:(w.bodies?w.bodies.length:0),dynamic:dynamicCount,static:staticCount,gravity:w.gravity?w.gravity.y:0}:null});",
			"if(!w)problems.push({id:'no-physics',severity:'error',msg:'Physics world not initialized — no collisions will work'});",

			// Terrain (FIXED: use __terrain__ not __terrainMesh__)
			"var tm=sc&&sc.getObjectByName?sc.getObjectByName('__terrain__'):null;",
			"var tData=W.__vibexe_terrainData;",
			"var tBody=W.__vibexe_terrainBody;",
			"var tPost=W.__vibexe_terrainPostStep;",
			"var tGetH=W.__vibexe_getTerrainHeight;",
			"var tStatus='off';",
			"if(tm&&tBody&&tPost)tStatus='ok';",
			"else if(tm&&!tBody)tStatus='inactive';",
			"else if(tm)tStatus='ok';",
			"var tDetails=null;",
			"if(tm){",
			"  tDetails={mesh:true,verts:tm.geometry&&tm.geometry.attributes&&tm.geometry.attributes.position?tm.geometry.attributes.position.count:0};",
			"  tDetails.physicsBody=!!tBody;",
			"  tDetails.postStepClamp=!!tPost;",
			"  tDetails.heightQuery=!!tGetH;",
			"  if(tData){tDetails.width=tData.width||'?';tDetails.depth=tData.depth||'?';tDetails.segments=tData.segments||'?';}",
			"}else{tDetails={mesh:false,physicsBody:!!tBody,heightData:!!tData};}",
			"r.push({system:'Terrain',status:tStatus,details:tDetails});",
			// Terrain problems
			"if(tm&&!tBody)problems.push({id:'terrain-no-physics',severity:'error',msg:'Terrain mesh exists but has NO physics body — characters fall through'});",
			"if(tm&&tBody&&!tPost)problems.push({id:'terrain-no-clamp',severity:'warn',msg:'Terrain has physics body but postStep clamp not active — bodies may clip through'});",
			"if(tm&&!tGetH)problems.push({id:'terrain-no-height-query',severity:'warn',msg:'Terrain height query function missing — spawn height may be wrong'});",

			// Player (enhanced with physics body, velocity, grounded state, terrain distance)
			"var pm=W.__vibexe_playerMesh__;",
			"var pb=pm&&pm.userData?pm.userData.__physicsBody:null;",
			"var pStatus=pm?'ok':'missing';",
			"var pDetails=null;",
			"if(pm){",
			"  pDetails={name:pm.name||'unknown',y:pm.position?+pm.position.y.toFixed(2):0};",
			"  pDetails.hasPhysicsBody=!!pb;",
			"  if(pb){",
			"    pDetails.velocity={x:+pb.velocity.x.toFixed(2),y:+pb.velocity.y.toFixed(2),z:+pb.velocity.z.toFixed(2)};",
			"    pDetails.grounded=pb.__canJump!==false;",
			"    pDetails.mass=pb.mass;",
			"    pDetails.damping=pb.linearDamping;",
			"  }",
			"  if(tGetH&&pm.position){",
			"    var terrainH=tGetH(pm.position.x,pm.position.z);",
			"    pDetails.terrainHeightBelow=+terrainH.toFixed(2);",
			"    pDetails.distFromTerrain=+(pm.position.y-terrainH).toFixed(2);",
			"  }",
			"}",
			"r.push({system:'Player',status:pStatus,details:pDetails});",
			// Player problems
			"if(pm&&!pb)problems.push({id:'player-no-physics',severity:'error',msg:'Player mesh exists but has NO physics body — movement/collision broken'});",
			"if(pm&&pb&&pb.__canJump===false&&pb.velocity&&Math.abs(pb.velocity.y)<0.1){",
			"  problems.push({id:'player-stuck-air',severity:'warn',msg:'Player not grounded but near-zero Y velocity — may be stuck in air'});",
			"}",
			"if(pm&&tGetH&&pm.position){",
			"  var _th=tGetH(pm.position.x,pm.position.z);",
			"  if(pm.position.y>_th+5)problems.push({id:'player-floating',severity:'warn',msg:'Player is '+((pm.position.y-_th).toFixed(1))+'u above terrain — may be air-walking'});",
			"  if(pm.position.y<_th-1)problems.push({id:'player-below-terrain',severity:'error',msg:'Player is BELOW terrain surface — fell through physics'});",
			"}",

			// Sky & Weather
			"var sw=W.__vibexe_skyWeather;",
			"r.push({system:'Sky & Weather',status:sw&&sw._active?'ok':(sw?'inactive':'off'),details:sw?{time:+(sw.solarTime||0).toFixed(3),fog:sw.config.fog.enabled,auto:sw.config.time.autoAdvance}:null});",

			// Adaptive Quality
			"var aq=W.__vibexe_adaptive_quality__;",
			"r.push({system:'Adaptive Quality',status:aq?'ok':'off',details:aq?{fps:aq.currentFps||0,reduced:aq.isReduced||false}:null});",

			// Audio
			"var au=W.__vibexe_audio__;",
			"r.push({system:'Audio',status:au?(au.enabled?'ok':'muted'):'off'});",

			// Modules
			"var mods=Object.keys(W.__vibexe_modules__||{});",
			"r.push({system:'Modules',status:mods.length>0?'ok':'none',details:{loaded:mods}});",

			// Auto-Physics check — count solid objects without physics bodies
			// Skip known non-solid: collectibles, decorations, player, sky, lights, characters, sub-meshes
			"if(sc&&w){",
			"  var solidNoPhys=0;var solidNames=[];",
			"  sc.traverse(function(o){",
			"    if(!o.isMesh)return;",
			"    var vt=o.userData&&o.userData.vibexeType;",
			"    if(vt==='collectible'||vt==='decoration'||vt==='player'||vt==='character')return;",
			"    var n=o.name||'';",
			"    if(n==='__terrain__'||n==='__groundPlane__'||n==='__skyDome__')return;",
			"    if(n.indexOf('Helper')>=0||n.indexOf('helper')>=0)return;",
			"    if(n.indexOf('Light')>=0||n.indexOf('light')>=0)return;",
			// Skip character meshes (Lily etc) — they're inside a Group managed by character controller
			"    if(o.parent&&o.parent.userData&&(o.parent.userData.vibexeType==='player'||o.parent.userData.vibexeType==='character'))return;",
			// Skip child meshes inside a parent that already has physics (GLTF sub-meshes)
			"    if(o.parent&&o.parent.userData&&o.parent.userData.__physicsBody)return;",
			// Skip objects that are part of collectibles/decorations by name prefix
			"    if(n.indexOf('Collectible')>=0||n.indexOf('Character')>=0||n.indexOf('Decoration')>=0)return;",
			// Only flag platform/barrier-type objects (these actually need physics)
			"    var isPlatformLike=n.indexOf('Platform')>=0||n.indexOf('Barrier')>=0||n.indexOf('Wall')>=0||n.indexOf('Floor')>=0||n.indexOf('Block')>=0||vt==='platform'||vt==='barrier';",
			"    if(!isPlatformLike)return;",
			"    if(!o.userData||!o.userData.__physicsBody){solidNoPhys++;if(solidNames.length<5)solidNames.push(n||'unnamed');}",
			"  });",
			"  if(solidNoPhys>0)problems.push({id:'objects-no-physics',severity:'warn',msg:solidNoPhys+' platform/barrier mesh(es) missing physics: '+solidNames.join(', ')+(solidNoPhys>5?'...':'')});",
			"}",

			// Send report with problems
			"try{window.parent.postMessage({type:'vibexe-debug-system-report-all',systems:r,problems:problems},'*')}catch(e){}",
			"});",
			"})();\n",
		].join("");

		globals += "\n";
		for (const entryKey of ["/index.js", "/index.jsx", "/index.ts", "/index.tsx"]) {
			const entry = sandpackFiles[entryKey];
			if (entry) {
				const existing = typeof entry === "string" ? entry : entry.code || "";
				sandpackFiles[entryKey] = {
					...(typeof entry === "object" ? entry : {}),
					code: globals + existing,
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

			// Clamp a numeric value to [min, max] — prevents invalid values from being injected
			const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

			// 1. Patch assets-3d.ts — replace hardcoded constants with actual settings values
			const assetsKey = Object.keys(sandpackFiles).find((p) => p.endsWith("/assets-3d.ts"));
			if (assetsKey) {
				const af = sandpackFiles[assetsKey];
				let code = typeof af === "string" ? af : af.code;
				// Map: [constantName, rawValue, min, max]
				const constMap: [string, number | undefined, number, number][] = [
					["GRAVITY_3D", gsObj.physics?.gravity, -200, 0],
					["FALL_GRAVITY", gsObj.physics?.fallGravity, -200, 0],
					["JUMP_FORCE", gsObj.physics?.jumpForce, 0, 100],
					["MOVE_SPEED", gsObj.physics?.moveSpeed, 0, 50],
					["RUN_SPEED", gsObj.physics?.runSpeed, 0, 50],
					["FRICTION", gsObj.physics?.friction, 0, 100],
					["COYOTE_TIME", gsObj.physics?.coyoteTime, 0, 2],
					["CAMERA_OFFSET_Y", gsObj.camera?.offsetY, -50, 100],
					["CAMERA_OFFSET_Z", gsObj.camera?.offsetZ, 0, 100],
					["CAMERA_HEIGHT", gsObj.camera?.offsetY, -50, 100],
					["CAMERA_DISTANCE", gsObj.camera?.offsetZ, 0, 100],
					["CAMERA_LERP", gsObj.camera?.lerp, 0.1, 30],
					["CAMERA_LOOK_AHEAD", gsObj.camera?.lookAhead, 0, 30],
					["CAMERA_LOOK_Y", gsObj.camera?.lookY, -20, 20],
				];
				let patchCount = 0;
				for (const [name, rawValue, min, max] of constMap) {
					if (rawValue == null || Number.isNaN(rawValue)) continue;
					const value = clamp(rawValue, min, max);
					const patterns = [
						new RegExp(`(export\\s+(?:const|let)\\s+${name}\\s*=\\s*)([^;]+)(;)`),
						new RegExp(`((?:var|let|const)\\s+${name}\\s*=\\s*)([^;]+)(;)`),
					];
					let matched = false;
					for (const re of patterns) {
						code = code.replace(re, (_m, g1, _g2, g3) => {
							matched = true;
							return `${g1}${value}${g3}`;
						});
						if (matched) break;
					}
					if (matched) {
						patchCount++;
					} else {
						console.warn(`[sandpack-adapter] Failed to patch ${name} — not found in template`);
					}
				}
				if (typeof af === "string") {
					sandpackFiles[assetsKey] = code;
				} else {
					(sandpackFiles[assetsKey] as SandpackFile).code = code;
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

					// Patch MAX_LIVES — startingLives from player settings
					// Engine templates use: const MAX_LIVES = __gsR.runner?.maxLives ?? __gsR.player?.startingLives ?? 3;
					if (sp.startingLives != null && !Number.isNaN(sp.startingLives)) {
						const lives = clamp(Math.round(sp.startingLives), 1, 99);
						const before = code;
						code = code.replace(
							/((?:const|let)\s+MAX_LIVES\s*=\s*)([^;]+)(;)/,
							`$1${lives}$3`,
						);
						if (code === before) {
							// Fallback: some templates use `let lives = N;` directly (e.g. squad-shooter)
							code = code.replace(
								/(let\s+lives\s*=\s*)(\d+)(;)/,
								`$1${lives}$3`,
							);
						}
						if (code === before) {
							console.warn("[sandpack-adapter] Failed to patch startingLives — MAX_LIVES / lives constant not found in GameScene3D.ts");
						}
					}
				}

				// Expose factory functions on window for character-system module
				// Old saved projects define these inside the IIFE but don't expose them
				if (!code.includes("__vibexe_createAnimatedCharacter3D")) {
					const before = code;
					code = code.replace(
						/(__vibexe_scene__\s*=\s*scene\s*;)/,
						`$1\n` +
						`if(typeof createAnimatedCharacter3D==='function')(window as any).__vibexe_createAnimatedCharacter3D=createAnimatedCharacter3D;\n` +
						`if(typeof createCharacterController3D==='function')(window as any).__vibexe_createCharacterController3D=createCharacterController3D;\n` +
						`if(typeof createPhysicsBody==='function')(window as any).__vibexe_createPhysicsBody=createPhysicsBody;`,
					);
					if (code === before) {
						console.warn("[sandpack-adapter] Failed to patch factory exposure — __vibexe_scene__ = scene not found in GameScene3D.ts");
						// Fallback: try matching just the scene variable assignment pattern
						code = code.replace(
							/(window\s*(?:as\s+any\s*)?\)\s*\.\s*__vibexe_scene__\s*=\s*scene\s*;)/,
							`$1\n` +
							`if(typeof createAnimatedCharacter3D==='function')(window as any).__vibexe_createAnimatedCharacter3D=createAnimatedCharacter3D;\n` +
							`if(typeof createCharacterController3D==='function')(window as any).__vibexe_createCharacterController3D=createCharacterController3D;\n` +
							`if(typeof createPhysicsBody==='function')(window as any).__vibexe_createPhysicsBody=createPhysicsBody;`,
						);
						if (code === before) {
							console.warn("[sandpack-adapter] Fallback factory patch also failed. Looking for scene assign...");
							// Last resort: check what patterns exist
							const sceneAssigns = code.match(/__vibexe_scene__[^;\n]{0,40}/g);
							console.warn("[sandpack-adapter] Scene patterns found:", sceneAssigns?.slice(0, 5));
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
