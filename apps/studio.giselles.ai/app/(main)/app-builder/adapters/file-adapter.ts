/**
 * File Adapter
 *
 * Converts between AppFile format and VibeSDK's FileType.
 * This adapter enables using VibeSDK components with the app builder data model.
 */

import type { FileType } from "../types/vibesdk";

/**
 * App file representation from the database.
 * Matches the builder_files table structure.
 */
export interface AppFile {
  id: string;
  path: string;
  content: string | null;
  language?: string | null;
}

/**
 * Map file extension to Monaco language identifier
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    mjs: "javascript",
    cjs: "javascript",

    // Web
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "scss",
    less: "less",

    // Data
    json: "json",
    jsonc: "json",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    toml: "toml",

    // Markup
    md: "markdown",
    mdx: "markdown",

    // Config
    env: "plaintext",
    gitignore: "plaintext",
    dockerignore: "plaintext",

    // Other
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    prisma: "prisma",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    ps1: "powershell",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    h: "cpp",
    cs: "csharp",
    php: "php",
  };

  return languageMap[ext ?? ""] ?? "plaintext";
}

/**
 * Convert a single AppFile to FileType
 *
 * @param file - AppFile from database
 * @param options - Optional status flags for file state
 * @returns FileType compatible with VibeSDK components
 */
export function toFileType(
  file: AppFile,
  options?: {
    isGenerating?: boolean;
    needsFixing?: boolean;
    hasErrors?: boolean;
  }
): FileType {
  return {
    id: file.id,
    filePath: file.path,
    fileContents: file.content ?? "",
    language: getLanguageFromPath(file.path),
    isGenerating: options?.isGenerating,
    needsFixing: options?.needsFixing,
    hasErrors: options?.hasErrors,
  };
}

/**
 * Convert an array of AppFiles to FileTypes
 *
 * @param files - Array of AppFiles
 * @param generatingPaths - Set of file paths currently being generated
 * @returns Array of FileTypes compatible with VibeSDK components
 */
export function toFileTypes(
  files: AppFile[],
  generatingPaths?: Set<string>
): FileType[] {
  return files.map((file) =>
    toFileType(file, {
      isGenerating: generatingPaths?.has(file.path),
    })
  );
}

/**
 * Convert a FileType back to AppFile
 *
 * This is useful when VibeSDK components return file data
 * that needs to be saved to the backend.
 *
 * @param file - VibeSDK FileType
 * @returns AppFile compatible with database model
 */
export function fromFileType(file: FileType): AppFile {
  return {
    id: file.id,
    path: file.filePath,
    content: file.fileContents,
  };
}

/**
 * Convert an array of FileTypes back to AppFiles
 *
 * @param files - Array of VibeSDK FileTypes
 * @returns Array of AppFiles compatible with database
 */
export function fromFileTypes(files: FileType[]): AppFile[] {
  return files.map(fromFileType);
}
