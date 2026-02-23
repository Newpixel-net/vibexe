/**
 * App Deployment Builder
 *
 * Bundles React/TypeScript apps from builderFiles into static files
 * served by Apache. Uses esbuild with a virtual filesystem plugin.
 *
 * Strategy:
 * - React/ReactDOM loaded from CDN via <script> tags (UMD → window globals)
 * - esbuild bundles app code as IIFE, with React shimmed from window globals
 * - Vibexe SDK loaded as separate <script> (global VibexeApp class)
 * - Tailwind CSS via Play CDN
 *
 * Output: /home/vibexe/public_html/apps/{subdomain}/
 *   index.html, bundle.js, vibexe-sdk.js, [styles.css]
 */

import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderFiles } from "@/db/schema";

const DEPLOY_ROOT =
	process.env.DEPLOY_ROOT ?? "/home/vibexe/public_html/apps";

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function generateIndexHtml(appName: string, hasCss: boolean): string {
	const v = Date.now(); // Cache-busting version
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(appName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = {
      theme: { extend: { colors: { primary: '#3b82f6', secondary: '#64748b' } } }
    }
  <\/script>
  <style type="text/tailwindcss">
    @layer base { body { @apply antialiased; } html { scroll-behavior: smooth; } }
  </style>${hasCss ? `\n  <link rel="stylesheet" href="styles.css?v=${v}" />` : ""}
  <!-- React 18 from CDN (UMD → window.React, window.ReactDOM) -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
</head>
<body>
  <div id="root"></div>
  <script src="vibexe-sdk.js?v=${v}"><\/script>
  <script src="bundle.js?v=${v}"><\/script>
</body>
</html>`;
}

function generateSdkSource(appId: string): string {
	return `(function(g){
class DataClient{constructor(b,h){this.b=b;this.h=h}
async list(e,o){o=o||{};var p=new URLSearchParams();if(o.page)p.set("page",String(o.page));if(o.limit)p.set("limit",String(o.limit));if(o.sort)p.set("sort",o.sort);if(o.order)p.set("order",o.order);if(o.filter){for(var k in o.filter){var v=o.filter[k];if(v!==null&&typeof v==="object"&&!Array.isArray(v)){for(var op in v){if(op==="in"&&Array.isArray(v[op]))p.set("filter["+k+"][in]",v[op].join(","));else if(v[op]!==undefined)p.set("filter["+k+"]["+op+"]",String(v[op]))}}else p.set("filter["+k+"]",String(v))}}if(o.search)p.set("search",o.search);var q=p.toString();var r=await fetch(this.b+"/data/"+e+(q?"?"+q:""),{headers:this.h});if(!r.ok){var err=await r.json().catch(function(){return{}});throw new Error(err.error||"Failed")}return await r.json()}
async aggregate(e,o){o=o||{};var p=new URLSearchParams();if(o.group)p.set("group",o.group);if(o.count)p.set("count","true");if(o.sum)p.set("sum",o.sum);if(o.avg)p.set("avg",o.avg);if(o.min)p.set("min",o.min);if(o.max)p.set("max",o.max);if(o.filter){for(var k in o.filter){var v=o.filter[k];if(v!==null&&typeof v==="object"&&!Array.isArray(v)){for(var op in v){if(op==="in"&&Array.isArray(v[op]))p.set("filter["+k+"][in]",v[op].join(","));else if(v[op]!==undefined)p.set("filter["+k+"]["+op+"]",String(v[op]))}}else p.set("filter["+k+"]",String(v))}}var q=p.toString();var r=await fetch(this.b+"/data/"+e+"/aggregate"+(q?"?"+q:""),{headers:this.h});if(!r.ok){var err=await r.json().catch(function(){return{}});throw new Error(err.error||"Aggregate failed")}return await r.json()}
async get(e,id){var r=await fetch(this.b+"/data/"+e+"/"+id,{headers:this.h});if(!r.ok)throw new Error("Not found");return(await r.json()).data}
async create(e,d){var r=await fetch(this.b+"/data/"+e,{method:"POST",headers:Object.assign({},this.h,{"Content-Type":"application/json"}),body:JSON.stringify(d)});if(!r.ok)throw new Error("Create failed");return(await r.json()).data}
async update(e,id,d){var r=await fetch(this.b+"/data/"+e+"/"+id,{method:"PUT",headers:Object.assign({},this.h,{"Content-Type":"application/json"}),body:JSON.stringify(d)});if(!r.ok)throw new Error("Update failed");return(await r.json()).data}
async delete(e,id){var r=await fetch(this.b+"/data/"+e+"/"+id,{method:"DELETE",headers:this.h});if(!r.ok)throw new Error("Delete failed")}
async createMany(e,recs){var r=await fetch(this.b+"/data/"+e+"/batch",{method:"POST",headers:Object.assign({},this.h,{"Content-Type":"application/json"}),body:JSON.stringify({records:recs})});if(!r.ok)throw new Error("Batch create failed");return await r.json()}
async updateMany(e,ups){var r=await fetch(this.b+"/data/"+e+"/batch",{method:"PUT",headers:Object.assign({},this.h,{"Content-Type":"application/json"}),body:JSON.stringify({updates:ups})});if(!r.ok)throw new Error("Batch update failed");return await r.json()}
async deleteMany(e,ids){var r=await fetch(this.b+"/data/"+e+"/batch",{method:"DELETE",headers:Object.assign({},this.h,{"Content-Type":"application/json"}),body:JSON.stringify({ids:ids})});if(!r.ok)throw new Error("Batch delete failed");return await r.json()}
subscribe(e,a,b){var o=typeof a==="function"?{}:a;var cb=typeof a==="function"?a:b;var f=o.filter;var pp="entities="+encodeURIComponent(e);var tk=typeof localStorage!=="undefined"?localStorage.getItem("vibexe_session"):null;if(tk)pp+="&token="+encodeURIComponent(tk);var u=this.b+"/data/subscribe?"+pp;var es=new EventSource(u);es.onmessage=function(ev){try{var d=JSON.parse(ev.data);if(d.type==="connected")return;if(f&&d.action!=="deleted"){var r=d.record;var ok=Object.keys(f).every(function(k){return r[k]===f[k]});if(!ok)return}cb(d)}catch(x){}};return function(){es.close()}}
}
class AuthClient{constructor(b,h){this.b=b;this.h=h;this.t=typeof window!=="undefined"?localStorage.getItem("vibexe_session"):null}
async signUp(o){var r=await fetch(this.b+"/auth/signup",{method:"POST",headers:Object.assign({},this.h,{"Content-Type":"application/json"}),body:JSON.stringify({email:o.email,password:o.password,display_name:o.displayName})});if(!r.ok)throw new Error("Signup failed");var d=await r.json();this._s(d.token);return d}
async signIn(o){var r=await fetch(this.b+"/auth/signin",{method:"POST",headers:Object.assign({},this.h,{"Content-Type":"application/json"}),body:JSON.stringify({email:o.email,password:o.password})});if(!r.ok)throw new Error("Signin failed");var d=await r.json();this._s(d.token);return d}
async signOut(){if(this.t){try{await fetch(this.b+"/auth/signout",{method:"POST",headers:Object.assign({},this.h,{Authorization:"Bearer "+this.t})})}catch(e){}}this._c()}
async getCurrentUser(){if(!this.t)return null;var r=await fetch(this.b+"/auth/me",{headers:Object.assign({},this.h,{Authorization:"Bearer "+this.t})});if(!r.ok){this._c();return null}return(await r.json()).user}
async signInWithGoogle(){return this._op("google")}
async signInWithGitHub(){return this._op("github")}
_op(p){var s=this;return new Promise(function(ok,no){var w=500,h=600,l=window.screenX+(window.outerWidth-w)/2,t=window.screenY+(window.outerHeight-h)/2;var pu=window.open(s.b+"/auth/oauth/"+p,"vibexe-oauth-"+p,"width="+w+",height="+h+",left="+l+",top="+t+",popup=yes");if(!pu){no(new Error("Failed to open popup"));return}function onM(e){if(!e.data||e.data.type!=="vibexe-oauth")return;cl();if(e.data.error)no(new Error(e.data.error));else if(e.data.token&&e.data.user){s._s(e.data.token);ok({user:e.data.user,token:e.data.token})}else no(new Error("Invalid OAuth response"))}var pi=setInterval(function(){if(pu.closed){cl();no(new Error("Authentication cancelled"))}},500);function cl(){window.removeEventListener("message",onM);clearInterval(pi);if(!pu.closed)pu.close()}window.addEventListener("message",onM)})}
isAuthenticated(){return this.t!==null}
getToken(){return this.t}
_s(t){this.t=t;if(typeof window!=="undefined")localStorage.setItem("vibexe_session",t)}
_c(){this.t=null;if(typeof window!=="undefined")localStorage.removeItem("vibexe_session")}
}
class FunctionsClient{constructor(b,h){this.b=b;this.h=h}
async invoke(n,d){var r=await fetch(this.b+"/functions/"+encodeURIComponent(n),{method:"POST",headers:Object.assign({},this.h,{"Content-Type":"application/json"}),body:d!==undefined?JSON.stringify(d):undefined});if(!r.ok){var err=await r.json().catch(function(){return{}});throw new Error(err.error||"Function failed")}return(await r.json()).data}
}
class StorageClient{constructor(b,h){this.b=b;this.h=h}
_ah(){var h=Object.assign({},this.h);var t=typeof window!=="undefined"?localStorage.getItem("vibexe_session"):null;if(t)h["Authorization"]="Bearer "+t;return h}
async upload(f,p){var fd=new FormData();fd.append("file",f);if(p)fd.append("path",p);var h=this._ah();delete h["Content-Type"];var r=await fetch(this.b+"/storage",{method:"POST",headers:h,body:fd});if(!r.ok){var e=await r.json().catch(function(){return{}});throw new Error(e.error||"Upload failed")}return await r.json()}
async download(p){var r=await fetch(this.b+"/storage/"+p,{headers:this._ah()});if(!r.ok)throw new Error("Download failed");return await r.blob()}
async list(p,o){var q=new URLSearchParams();if(p)q.set("prefix",p);if(o&&o.limit)q.set("limit",String(o.limit));if(o&&o.cursor)q.set("cursor",o.cursor);var s=q.toString();var r=await fetch(this.b+"/storage"+(s?"?"+s:""),{headers:this._ah()});if(!r.ok)throw new Error("List failed");return await r.json()}
async delete(p){var r=await fetch(this.b+"/storage/"+p,{method:"DELETE",headers:this._ah()});if(!r.ok)throw new Error("Delete failed")}
getUrl(p,t){var u=this.b+"/storage/"+p;if(t){var q=new URLSearchParams();if(t.width)q.set("width",String(t.width));if(t.height)q.set("height",String(t.height));if(t.format)q.set("format",t.format);if(t.quality)q.set("quality",String(t.quality));var s=q.toString();if(s)u+="?"+s}return u}
}
class WebhooksClient{constructor(b,h){this.b=b;this.h=h}
async create(c){var r=await fetch(this.b+"/webhooks",{method:"POST",headers:Object.assign({},this.h,{"Content-Type":"application/json"}),body:JSON.stringify(c)});if(!r.ok){var e=await r.json().catch(function(){return{}});throw new Error(e.error||"Failed to create webhook")}return(await r.json()).webhook}
async list(){var r=await fetch(this.b+"/webhooks",{headers:this.h});if(!r.ok)throw new Error("Failed to list webhooks");return await r.json()}
async delete(id){var r=await fetch(this.b+"/webhooks",{method:"DELETE",headers:Object.assign({},this.h,{"Content-Type":"application/json"}),body:JSON.stringify({webhookDbId:id})});if(!r.ok)throw new Error("Failed to delete webhook")}
}
class VibexeApp{constructor(c){this.appId=c.appId;var base=(c.baseUrl||g.location.protocol+"//vibexe.online")+"/api/apps/"+c.appId;var h={};if(c.apiKey)h["X-Vibexe-Api-Key"]=c.apiKey;this.data=new DataClient(base,h);this.auth=new AuthClient(base,h);this.functions=new FunctionsClient(base,h);this.storage=new StorageClient(base,h);this.webhooks=new WebhooksClient(base,h)}}
g.VibexeApp=VibexeApp;
})(typeof globalThis!=="undefined"?globalThis:window);
`;
}

function isCodeFile(path: string): boolean {
	return /\.(jsx?|tsx?|css)$/.test(path);
}

function isAppFile(path: string): boolean {
	const lower = path.toLowerCase();
	return lower.includes("app.") && /\.(jsx?|tsx?)$/.test(lower);
}

function extractProviderName(content: string): string | null {
	const m = content.match(/export\s+(?:default\s+)?function\s+(\w*Provider)/);
	if (m) return m[1];
	const c = content.match(/export\s+const\s+(\w*Provider)\s*=/);
	if (c) return c[1];
	return null;
}

function hasDefaultExport(content: string): boolean {
	return (
		/export\s+default\s+/.test(content) ||
		/export\s*\{\s*[^}]*\bdefault\b/.test(content)
	);
}

function extractAppComponentName(content: string): string | null {
	// export default function Foo / export function Foo
	const fn = content.match(
		/export\s+(?:default\s+)?function\s+(\w+)/,
	);
	if (fn) return fn[1];
	// export const Foo = ...
	const cn = content.match(/export\s+(?:default\s+)?const\s+(\w+)\s*=/);
	if (cn) return cn[1];
	// function Foo ... export default Foo
	const def = content.match(/export\s+default\s+(\w+)/);
	if (def) return def[1];
	return null;
}

function generateEntryPoint(
	appPath: string,
	appContent: string,
	providers: Array<{ path: string; name: string }>,
): string {
	const isDefault = hasDefaultExport(appContent);
	const compName = extractAppComponentName(appContent) || "App";
	const importPath = `./${appPath.replace(/\.(tsx?|jsx?)$/, "")}`;
	const appImport = isDefault
		? `import ${compName} from "${importPath}";`
		: `import { ${compName} } from "${importPath}";`;

	const lines = [
		'import React from "react";',
		'import { createRoot } from "react-dom/client";',
		appImport,
	];
	for (const p of providers) {
		lines.push(
			`import { ${p.name} } from "./${p.path.replace(/\.(tsx?|jsx?)$/, "")}";`,
		);
	}
	lines.push(
		"",
		'const root = createRoot(document.getElementById("root"));',
	);
	if (providers.length === 0) {
		lines.push(`root.render(<${compName} />);`);
	} else {
		let jsx = `<${compName} />`;
		for (const p of [...providers].reverse()) {
			jsx = `<${p.name}>${jsx}</${p.name}>`;
		}
		lines.push(`root.render(${jsx});`);
	}
	return lines.join("\n");
}

/**
 * Create the esbuild virtual-fs plugin.
 * All app files live in a Map; React/ReactDOM are shimmed from window globals.
 */
/** Normalize a virtual path: resolve `.` and `..` segments */
function normalizePath(p: string): string {
	const parts = p.split("/");
	const out: string[] = [];
	for (const seg of parts) {
		if (seg === "." || seg === "") continue;
		if (seg === "..") {
			out.pop();
		} else {
			out.push(seg);
		}
	}
	return out.join("/");
}

function createVirtualPlugin(
	files: Map<string, string>,
): import("esbuild").Plugin {
	// Shim modules: import react → window.React
	const shims: Record<string, string> = {
		react: "module.exports = window.React;",
		"react-dom": "module.exports = window.ReactDOM;",
		"react-dom/client":
			"module.exports = { createRoot: window.ReactDOM.createRoot };",
		"react/jsx-runtime":
			"module.exports = { jsx: window.React.createElement, jsxs: window.React.createElement, Fragment: window.React.Fragment };",
		"react/jsx-dev-runtime":
			"module.exports = { jsxDEV: window.React.createElement, Fragment: window.React.Fragment };",
	};

	return {
		name: "virtual-fs",
		setup(build) {
			// Resolve npm packages
			build.onResolve({ filter: /^[^./]/ }, (args) => {
				if (shims[args.path]) {
					return { path: args.path, namespace: "shim" };
				}
				// Check virtual files (bare paths like "components/Foo")
				for (const ext of ["", ".tsx", ".ts", ".jsx", ".js"]) {
					if (files.has(args.path + ext))
						return { path: args.path + ext, namespace: "virtual" };
				}
				// Unknown npm package — treat as empty module
				return { path: args.path, namespace: "shim" };
			});

			// Resolve relative imports
			build.onResolve({ filter: /^\./ }, (args) => {
				const dir = args.importer
					? args.importer.replace(/[^/]+$/, "")
					: "";
				const base = normalizePath(dir + args.path);
				const exts = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
				for (const ext of exts) {
					if (files.has(base + ext))
						return { path: base + ext, namespace: "virtual" };
				}
				// Try without directory
				const bare = args.path.replace(/^\.\//, "");
				for (const ext of exts) {
					if (files.has(bare + ext))
						return { path: bare + ext, namespace: "virtual" };
				}
				return { path: args.path, namespace: "shim" };
			});

			// Load shim modules
			build.onLoad({ filter: /.*/, namespace: "shim" }, (args) => {
				return {
					contents: shims[args.path] || "module.exports = {};",
					loader: "js",
				};
			});

			// Load virtual files
			build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
				const content = files.get(args.path);
				if (content === undefined)
					return { errors: [{ text: `Not found: ${args.path}` }] };
				const ext = args.path.split(".").pop() || "tsx";
				const loaders: Record<string, import("esbuild").Loader> = {
					tsx: "tsx", ts: "ts", jsx: "jsx", js: "js", css: "css",
				};
				return { contents: content, loader: loaders[ext] || "tsx" };
			});
		},
	};
}

export interface BuildResult {
	success: boolean;
	outputDir: string;
	log: string;
	files: string[];
	errors?: string[];
}

/**
 * Build and deploy an app to static files.
 */
export async function buildApp(
	appId: string,
	subdomain: string,
): Promise<BuildResult> {
	const logs: string[] = [];
	const log = (msg: string) =>
		logs.push(`[${new Date().toISOString()}] ${msg}`);

	try {
		log(`Build started: app=${appId}, subdomain=${subdomain}`);

		// 1. Fetch app + files
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
		});
		if (!app) throw new Error(`App ${appId} not found`);

		const dbFiles = await db.query.builderFiles.findMany({
			where: eq(builderFiles.appDbId, app.dbId),
		});

		// 2. Separate code and CSS files
		const virtualFiles = new Map<string, string>();
		const cssContents: string[] = [];

		for (const f of dbFiles) {
			if (!f.content || f.path === "Blueprint.md") continue;
			let path = f.path;
			if (path.startsWith("src/")) path = path.slice(4);

			if (path.endsWith(".css")) {
				cssContents.push(f.content);
			} else if (isCodeFile(path)) {
				// Rewrite @vibexe/sdk imports to use window global
				const content = f.content.replace(
					/import\s*\{[^}]*\}\s*from\s*["']@vibexe\/sdk["'];?/g,
					"const { VibexeApp } = window;",
				);
				virtualFiles.set(path, content);
			}
		}

		log(`${virtualFiles.size} code files, ${cssContents.length} CSS files`);
		if (virtualFiles.size === 0) throw new Error("No code files in app");

		// 3. Find App component + context providers
		let appPath: string | null = null;
		const providers: Array<{ path: string; name: string }> = [];

		for (const [path, content] of virtualFiles) {
			if (isAppFile(path)) appPath = path;
			if (
				path.toLowerCase().includes("context") ||
				path.toLowerCase().includes("provider")
			) {
				const name = extractProviderName(content);
				if (name) providers.push({ path, name });
			}
		}

		if (!appPath) {
			const fallback = [...virtualFiles.keys()].find((p) =>
				p.toLowerCase().includes("app."),
			);
			if (fallback) appPath = fallback;
			else throw new Error("No App component found");
		}
		log(`Entry: ${appPath}, ${providers.length} providers`);

		// 4. Generate entry and add to virtual FS
		const appContent = virtualFiles.get(appPath) || "";
		virtualFiles.set(
			"__entry__.tsx",
			generateEntryPoint(appPath, appContent, providers),
		);

		// 5. Bundle with esbuild
		let esbuild: typeof import("esbuild");
		try {
			esbuild = await import("esbuild");
		} catch {
			throw new Error("esbuild not available");
		}

		log("Bundling with esbuild...");
		const ESBUILD_TIMEOUT_MS = 30_000;
		const buildPromise = esbuild.build({
			stdin: {
				contents: virtualFiles.get("__entry__.tsx")!,
				loader: "tsx",
				resolveDir: "/",
				sourcefile: "__entry__.tsx",
			},
			bundle: true,
			format: "iife",
			target: ["es2020"],
			jsx: "transform",
			jsxFactory: "React.createElement",
			jsxFragment: "React.Fragment",
			minify: true,
			write: false,
			plugins: [createVirtualPlugin(virtualFiles)],
			define: { "process.env.NODE_ENV": '"production"' },
			logLevel: "silent",
		});
		const result = await Promise.race([
			buildPromise,
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("esbuild build timed out after 30s")), ESBUILD_TIMEOUT_MS),
			),
		]);

		if (result.errors.length > 0) {
			const errs = result.errors.map((e) => e.text);
			log(`Errors: ${errs.join("; ")}`);
			return {
				success: false,
				outputDir: "",
				log: logs.join("\n"),
				files: [],
				errors: errs,
			};
		}

		const bundleJs = result.outputFiles?.[0]?.text || "";
		log(`Bundle: ${Math.round(bundleJs.length / 1024)} KB`);

		// Enforce bundle size limit (10 MB)
		const MAX_BUNDLE_BYTES = 10 * 1024 * 1024;
		if (bundleJs.length > MAX_BUNDLE_BYTES) {
			throw new Error(
				`Bundle too large: ${Math.round(bundleJs.length / 1024)} KB exceeds ${MAX_BUNDLE_BYTES / 1024 / 1024} MB limit. Reduce code size or split dependencies.`,
			);
		}

		// 6. Write output
		const outputDir = join(DEPLOY_ROOT, subdomain);
		await mkdir(outputDir, { recursive: true });

		const hasCss = cssContents.length > 0;
		const outFiles: string[] = [];

		await writeFile(
			join(outputDir, "index.html"),
			generateIndexHtml(app.name, hasCss),
			"utf-8",
		);
		outFiles.push("index.html");

		await writeFile(
			join(outputDir, "vibexe-sdk.js"),
			generateSdkSource(appId),
			"utf-8",
		);
		outFiles.push("vibexe-sdk.js");

		await writeFile(join(outputDir, "bundle.js"), bundleJs, "utf-8");
		outFiles.push("bundle.js");

		if (hasCss) {
			await writeFile(
				join(outputDir, "styles.css"),
				cssContents.join("\n"),
				"utf-8",
			);
			outFiles.push("styles.css");
		}

		log(`Done. ${outFiles.length} files → ${outputDir}`);

		return {
			success: true,
			outputDir,
			log: logs.join("\n"),
			files: outFiles,
		};
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		log(`FAILED: ${msg}`);
		return {
			success: false,
			outputDir: "",
			log: logs.join("\n"),
			files: [],
			errors: [msg],
		};
	}
}

/**
 * Remove deployed files for a subdomain.
 */
export async function removeDeployment(subdomain: string): Promise<void> {
	const { rm } = await import("node:fs/promises");
	await rm(join(DEPLOY_ROOT, subdomain), { recursive: true, force: true });
}
