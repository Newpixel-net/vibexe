/**
 * Sandpack File Adapter
 *
 * Converts AppFile[] to Sandpack's file format for live preview.
 * Sandpack React template expects files at root level (/App.js, /index.js).
 * Includes Tailwind CSS support via Play CDN.
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/adapters/sandpack-adapter.ts
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

/**
 * Custom index.html with Tailwind Play CDN
 * This enables Tailwind CSS classes to work in the preview
 */
const TAILWIND_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App Preview</title>
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
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

/**
 * Default entry point for React apps
 */
const DEFAULT_INDEX = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(<App />);
`;

/**
 * Default App.jsx if no App file exists
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
 * Convert AppFile[] to Sandpack files format
 *
 * Sandpack React template expects:
 * - /App.js as the main component
 * - /index.js as the entry point
 *
 * This adapter:
 * - Strips src/ prefix from paths (src/App.tsx -> /App.tsx)
 * - Auto-generates /index.js entry point
 * - Includes custom index.html with Tailwind CDN
 * - Skips non-code files (markdown, etc.)
 */
export function convertToSandpackFiles(files: AppFile[]): SandpackFiles {
  const sandpackFiles: SandpackFiles = {};

  // Always include custom index.html with Tailwind support
  sandpackFiles["/public/index.html"] = {
    code: TAILWIND_INDEX_HTML,
    hidden: true,
  };

  // Check if we have any code files
  const codeFiles = files.filter((f) =>
    f.language === "javascript" ||
    f.language === "typescript" ||
    f.language === "javascriptreact" ||
    f.language === "typescriptreact" ||
    f.path.endsWith(".js") ||
    f.path.endsWith(".jsx") ||
    f.path.endsWith(".ts") ||
    f.path.endsWith(".tsx")
  );

  if (codeFiles.length === 0) {
    // No code files yet, use defaults
    sandpackFiles["/App.js"] = { code: DEFAULT_APP };
    sandpackFiles["/index.js"] = { code: DEFAULT_INDEX, hidden: true };
    return sandpackFiles;
  }

  // Convert each code file
  for (const file of codeFiles) {
    // Normalize path: strip src/ prefix and ensure leading /
    let path = file.path;

    // Remove src/ prefix if present
    if (path.startsWith("src/")) {
      path = path.slice(4); // Remove "src/"
    }

    // Ensure leading /
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Add to files
    sandpackFiles[path] = {
      code: file.content || "",
      active: isAppFile(path),
    };
  }

  // Ensure we have an entry point at /index.js
  const hasIndex = Object.keys(sandpackFiles).some((p) =>
    (p === "/index.js" || p === "/index.jsx" || p === "/index.ts" || p === "/index.tsx")
  );

  if (!hasIndex) {
    // Find the main App file
    const appFile = Object.keys(sandpackFiles).find((p) => isAppFile(p));
    if (appFile) {
      // Create index that imports the App
      const fileName = appFile.split("/").pop() || "App.jsx";
      const importName = fileName.replace(/\.(jsx?|tsx?)$/, "");
      sandpackFiles["/index.js"] = {
        code: `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./${importName}";

const root = createRoot(document.getElementById("root"));
root.render(<App />);
`,
        hidden: true,
      };
    } else {
      // Use defaults
      sandpackFiles["/index.js"] = { code: DEFAULT_INDEX, hidden: true };
      sandpackFiles["/App.js"] = { code: DEFAULT_APP };
    }
  }

  // Debug: log the converted files
  console.log("[sandpack-adapter] Converted files:", Object.keys(sandpackFiles));

  return sandpackFiles;
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
 * Extract dependencies from package.json file if present
 * Falls back to default React deps
 */
export function extractDependencies(files: AppFile[]): Record<string, string> {
  const pkgFile = files.find(
    (f) => f.path === "package.json" || f.path.endsWith("/package.json")
  );

  if (pkgFile && pkgFile.content) {
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
