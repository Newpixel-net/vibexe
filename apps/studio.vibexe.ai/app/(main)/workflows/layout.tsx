import { DocsLink } from "@vibexe-internal/ui/docs-link";
import { PageHeading } from "@vibexe-internal/ui/page-heading";
import type { ReactNode } from "react";
import { CreateWorkspaceButton } from "./create-workspace-button";
import { ImportWorkflowButton } from "./import-workflow-button";

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<div className="h-full bg-bg">
			<div className="px-[40px] py-[24px] flex-1 max-w-[1200px] mx-auto w-full">
				<div className="flex justify-between items-center mb-8">
					<PageHeading glow>Workflows</PageHeading>
					<div className="flex items-center gap-4">
						<DocsLink
							href="https://docs.vibexe.ai/en/guides/workspaces"
							target="_blank"
							rel="noopener noreferrer"
						>
							About Workflows
						</DocsLink>
						<ImportWorkflowButton />
						<CreateWorkspaceButton label="New Workflow" />
					</div>
				</div>
				{children}
			</div>
		</div>
	);
}
