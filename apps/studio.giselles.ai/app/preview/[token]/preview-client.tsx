"use client";

import {
	SandpackPreview as SandpackPreviewPane,
	SandpackProvider,
} from "@codesandbox/sandpack-react";
import { useMemo } from "react";
import type { AppFile } from "@/app/(main)/app-builder/adapters/file-adapter";
import {
	convertToSandpackFiles,
	extractDependencies,
} from "@/app/(main)/app-builder/adapters/sandpack-adapter";

interface PreviewClientProps {
	appName: string;
	appId: string;
	files: AppFile[];
}

const fullScreenStyles = `
  html, body, #__next { height: 100%; margin: 0; }
  .sp-wrapper { height: 100vh !important; }
  .sp-layout { height: 100% !important; }
  .sp-stack { height: 100% !important; }
  .sp-preview-container { height: 100% !important; }
  .sp-preview { height: 100% !important; }
  .sp-preview iframe { height: 100% !important; }
`;

export function PreviewClient({ appName, appId, files }: PreviewClientProps) {
	const apiOrigin = typeof window !== "undefined" ? window.location.origin : "";
	const sandpackFiles = useMemo(() => convertToSandpackFiles(files, undefined, apiOrigin, appId), [files, apiOrigin, appId]);
	const dependencies = useMemo(() => extractDependencies(files), [files]);

	return (
		<div className="h-dvh w-screen flex flex-col bg-background">
			{/* Minimal header */}
			<div className="h-10 flex items-center justify-between px-4 border-b border-border bg-muted/30 flex-shrink-0">
				<span className="text-sm font-medium text-foreground truncate">
					{appName}
				</span>
				<span className="text-xs text-muted-foreground">
					Built with Vibexe
				</span>
			</div>

			{/* Full-screen Sandpack preview */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Internal CSS constant */}
			<style dangerouslySetInnerHTML={{ __html: fullScreenStyles }} />
			<div className="flex-1 min-h-0">
				<SandpackProvider
					template="react-ts"
					files={sandpackFiles}
					customSetup={{ dependencies }}
					options={{
						autorun: true,
						autoReload: true,
						recompileMode: "delayed",
						recompileDelay: 300,
						externalResources: ["https://cdn.tailwindcss.com"],
					}}
					theme="auto"
				>
					<SandpackPreviewPane
						showNavigator={false}
						showRefreshButton={false}
						showOpenInCodeSandbox={false}
						style={{ height: "100%", width: "100%" }}
					/>
				</SandpackProvider>
			</div>
		</div>
	);
}
