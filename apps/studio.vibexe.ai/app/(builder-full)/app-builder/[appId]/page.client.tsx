// Individual App Builder Page (Client Component)
// Full-screen mode without Vibexe sidebar
//
// Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/(builder-full)/app-builder/[appId]/page.client.tsx

"use client";

import { BuilderLayout } from "@/app/(main)/app-builder/components/builder-layout";
import type { AppFile } from "@/app/(main)/app-builder/types/vibesdk";

interface PageClientProps {
	app: {
		id: string;
		name: string;
	};
	files: AppFile[];
}

export function PageClient({ app, files }: PageClientProps) {
	return <BuilderLayout app={app} files={files} />;
}
