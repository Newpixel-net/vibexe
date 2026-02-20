/**
 * App Exporter — Generate a self-hosted ZIP package for any app.
 *
 * Includes source files, database schema, Docker config, and setup docs.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderFiles,
	builderAppDatabases,
} from "@/db/schema";

export interface ExportResult {
	success: boolean;
	files: Map<string, string>;
	appName: string;
	error?: string;
}

/**
 * Generate all export files for an app.
 * Returns a Map<filePath, content> that the caller can ZIP.
 */
export async function generateExport(appId: string): Promise<ExportResult> {
	try {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
		});
		if (!app) return { success: false, files: new Map(), appName: "", error: "App not found" };

		const dbFiles = await db.query.builderFiles.findMany({
			where: eq(builderFiles.appDbId, app.dbId),
		});

		const appName = (app.name || "my-app")
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-")
			.replace(/-+/g, "-");

		const exportFiles = new Map<string, string>();

		// 1. Source files
		for (const f of dbFiles) {
			if (f.content && f.path !== "Blueprint.md") {
				exportFiles.set(`${appName}/${f.path}`, f.content);
			}
			if (f.path === "Blueprint.md" && f.content) {
				exportFiles.set(`${appName}/docs/Blueprint.md`, f.content);
			}
		}

		// 2. Schema SQL (if app has a database)
		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, app.dbId),
		});

		if (appDb?.schemaJson) {
			const schema = appDb.schemaJson as {
				entities?: Array<{
					name: string;
					tableName: string;
					fields: Array<{
						name: string;
						type: string;
						required?: boolean;
						unique?: boolean;
						relationTo?: string;
					}>;
				}>;
			};

			if (schema.entities?.length) {
				const sqlLines: string[] = [
					"-- Auto-generated schema for " + app.name,
					"-- Created by Vibexe App Builder",
					"",
				];

				for (const entity of schema.entities) {
					sqlLines.push(`CREATE TABLE IF NOT EXISTS "${entity.tableName}" (`);
					const cols = ["  id SERIAL PRIMARY KEY"];

					for (const field of entity.fields) {
						let sqlType = "TEXT";
						switch (field.type) {
							case "number":
								sqlType = "NUMERIC";
								break;
							case "boolean":
								sqlType = "BOOLEAN DEFAULT false";
								break;
							case "date":
								sqlType = "TIMESTAMPTZ";
								break;
							case "json":
								sqlType = "JSONB DEFAULT '{}'";
								break;
							case "relation":
								sqlType = "INTEGER";
								break;
							default:
								sqlType = "TEXT";
						}

						let col = `  "${field.name}" ${sqlType}`;
						if (field.required) col += " NOT NULL";
						if (field.unique) col += " UNIQUE";
						if (field.type === "relation" && field.relationTo) {
							const refTable = schema.entities.find(
								(e) => e.name === field.relationTo,
							)?.tableName;
							if (refTable) col += ` REFERENCES "${refTable}"(id)`;
						}
						cols.push(col);
					}

					cols.push('  "created_at" TIMESTAMPTZ DEFAULT NOW()');
					cols.push('  "updated_at" TIMESTAMPTZ DEFAULT NOW()');
					sqlLines.push(cols.join(",\n"));
					sqlLines.push(");");
					sqlLines.push("");
				}

				// Auth tables
				sqlLines.push("-- App user authentication tables");
				sqlLines.push(`CREATE TABLE IF NOT EXISTS "_app_users" (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user',
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`);
				sqlLines.push("");
				sqlLines.push(`CREATE TABLE IF NOT EXISTS "_app_sessions" (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "_app_users"(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`);

				exportFiles.set(`${appName}/schema.sql`, sqlLines.join("\n"));
			}
		}

		// 3. Package.json
		exportFiles.set(
			`${appName}/package.json`,
			JSON.stringify(
				{
					name: appName,
					version: "1.0.0",
					private: true,
					scripts: {
						dev: "vite",
						build: "vite build",
						preview: "vite preview",
						"db:setup": "psql -f schema.sql",
					},
					dependencies: {
						react: "^18.2.0",
						"react-dom": "^18.2.0",
					},
					devDependencies: {
						"@types/react": "^18.2.0",
						"@types/react-dom": "^18.2.0",
						"@vitejs/plugin-react": "^4.2.0",
						typescript: "^5.3.0",
						vite: "^5.0.0",
						autoprefixer: "^10.4.0",
						postcss: "^8.4.0",
						tailwindcss: "^3.4.0",
					},
				},
				null,
				2,
			),
		);

		// 4. Vite config
		exportFiles.set(
			`${appName}/vite.config.ts`,
			`import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,
		);

		// 5. tsconfig.json
		exportFiles.set(
			`${appName}/tsconfig.json`,
			JSON.stringify(
				{
					compilerOptions: {
						target: "ES2020",
						useDefineForClassFields: true,
						lib: ["ES2020", "DOM", "DOM.Iterable"],
						module: "ESNext",
						skipLibCheck: true,
						moduleResolution: "bundler",
						allowImportingTsExtensions: true,
						resolveJsonModule: true,
						isolatedModules: true,
						noEmit: true,
						jsx: "react-jsx",
						strict: true,
						noUnusedLocals: false,
						noUnusedParameters: false,
					},
					include: ["src"],
				},
				null,
				2,
			),
		);

		// 6. Tailwind config
		exportFiles.set(
			`${appName}/tailwind.config.js`,
			`/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`,
		);

		// 7. PostCSS config
		exportFiles.set(
			`${appName}/postcss.config.js`,
			`export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
		);

		// 8. index.html for Vite
		exportFiles.set(
			`${appName}/index.html`,
			`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${app.name || "My App"}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`,
		);

		// 9. main.tsx entry point
		exportFiles.set(
			`${appName}/src/main.tsx`,
			`import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
		);

		// 10. index.css for Tailwind
		exportFiles.set(
			`${appName}/src/index.css`,
			`@tailwind base;
@tailwind components;
@tailwind utilities;
`,
		);

		// 11. .env.example
		const envLines = [
			"# Database (only needed if app uses define_entities)",
			"DATABASE_URL=postgresql://user:password@localhost:5432/" + appName,
			"",
			"# App settings",
			"VITE_APP_NAME=" + (app.name || "My App"),
		];
		exportFiles.set(`${appName}/.env.example`, envLines.join("\n"));

		// 12. Dockerfile
		exportFiles.set(
			`${appName}/Dockerfile`,
			`FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`,
		);

		// 13. nginx.conf for Docker
		exportFiles.set(
			`${appName}/nginx.conf`,
			`server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`,
		);

		// 14. docker-compose.yml
		const hasDb = !!appDb?.schemaJson;
		const compose: Record<string, unknown> = {
			version: "3.8",
			services: {
				app: {
					build: ".",
					ports: ["3000:80"],
					...(hasDb ? { depends_on: ["db"] } : {}),
					environment: hasDb
						? [
								`DATABASE_URL=postgresql://app:app@db:5432/${appName}`,
							]
						: [],
				},
			},
		};
		if (hasDb) {
			(compose.services as Record<string, unknown>).db = {
				image: "postgres:16-alpine",
				environment: [
					`POSTGRES_DB=${appName}`,
					"POSTGRES_USER=app",
					"POSTGRES_PASSWORD=app",
				],
				ports: ["5432:5432"],
				volumes: [`db-data:/var/lib/postgresql/data`, `./schema.sql:/docker-entrypoint-initdb.d/01-schema.sql`],
			};
			compose.volumes = { "db-data": {} };
		}

		// Simple YAML serializer for docker-compose
		exportFiles.set(
			`${appName}/docker-compose.yml`,
			generateSimpleYaml(compose),
		);

		// 15. README.md
		exportFiles.set(
			`${appName}/README.md`,
			`# ${app.name || "My App"}

${app.description || "Built with Vibexe App Builder."}

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Production (Docker)

\`\`\`bash
docker-compose up -d
\`\`\`

${hasDb ? `## Database Setup

\`\`\`bash
# Create database and apply schema
createdb ${appName}
psql -d ${appName} -f schema.sql
\`\`\`
` : ""}
## Tech Stack

- React 18 + TypeScript
- Tailwind CSS
- Vite (build tool)
${hasDb ? "- PostgreSQL 16\n" : ""}
---

*Exported from [Vibexe](https://vibexe.online)*
`,
		);

		return { success: true, files: exportFiles, appName };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Export failed";
		return { success: false, files: new Map(), appName: "", error: msg };
	}
}

function generateSimpleYaml(obj: unknown, indent = 0): string {
	const pad = "  ".repeat(indent);
	if (obj === null || obj === undefined) return "null";
	if (typeof obj === "string") return obj;
	if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
	if (Array.isArray(obj)) {
		return obj.map((item) => {
			if (typeof item === "string") return `${pad}- ${item}`;
			return `${pad}-\n${generateSimpleYaml(item, indent + 1)}`;
		}).join("\n");
	}
	if (typeof obj === "object") {
		return Object.entries(obj as Record<string, unknown>)
			.map(([key, val]) => {
				if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
					return `${pad}${key}: ${val}`;
				}
				if (Array.isArray(val)) {
					return `${pad}${key}:\n${generateSimpleYaml(val, indent + 1)}`;
				}
				return `${pad}${key}:\n${generateSimpleYaml(val, indent + 1)}`;
			})
			.join("\n");
	}
	return String(obj);
}
