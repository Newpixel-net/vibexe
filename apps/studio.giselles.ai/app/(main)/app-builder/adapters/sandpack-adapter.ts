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
const DEFAULT_APP = `export default function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">
        Hello from Sandpack!
      </h1>
      <p className="text-gray-600">
        Generate some code to see it here.
      </p>
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
    const qs = params.toString();
    const url = this.baseUrl + "/data/" + entity + (qs ? "?" + qs : "");
    const res = await fetch(url, { headers: this.headers });
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
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to aggregate " + entity);
    }
    return await res.json();
  }

  async get(entity, id) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/" + id, { headers: this.headers });
    if (!res.ok) throw new Error("Failed to get " + entity + "/" + id);
    const json = await res.json();
    return json.data;
  }

  async create(entity, data) {
    const res = await fetch(this.baseUrl + "/data/" + entity, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create " + entity);
    const json = await res.json();
    return json.data;
  }

  async update(entity, id, data) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/" + id, {
      method: "PUT",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update " + entity + "/" + id);
    const json = await res.json();
    return json.data;
  }

  async delete(entity, id) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/" + id, {
      method: "DELETE",
      headers: this.headers,
    });
    if (!res.ok) throw new Error("Failed to delete " + entity + "/" + id);
  }

  async createMany(entity, records) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/batch", {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error("Failed to batch create " + entity);
    return await res.json();
  }

  async updateMany(entity, updates) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/batch", {
      method: "PUT",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) throw new Error("Failed to batch update " + entity);
    return await res.json();
  }

  async deleteMany(entity, ids) {
    const res = await fetch(this.baseUrl + "/data/" + entity + "/batch", {
      method: "DELETE",
      headers: { ...this.headers, "Content-Type": "application/json" },
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

	// Always include custom index.html with Tailwind support + language/RTL
	sandpackFiles["/public/index.html"] = {
		code: langConfig ? buildIndexHtml(langConfig) : TAILWIND_INDEX_HTML,
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
