import { Button } from "@vibexe-internal/ui/button";
import { SiGithub } from "@icons-pack/react-simple-icons";
import Link from "next/link";
import { GitHubAppInstallButton } from "@/packages/components/github-app-install-button";

type GitHubConnectionHeaderProps = {
	account?: string;
	installationUrl?: string;
	installed: boolean;
};

export function GitHubConnectionHeader({
	account,
	installationUrl,
	installed,
}: GitHubConnectionHeaderProps) {
	return (
		<div className="relative rounded-[12px] overflow-hidden px-[24px] py-[16px] w-full bg-white/[0.02] backdrop-blur-[8px] border-[0.5px] border-white/8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(255,255,255,0.2)]">
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-4">
					<SiGithub className="w-8 h-8" />
					<div>
						<h2 className="text-text text-[16px] leading-[22.4px] font-medium font-geist">
							GitHub
						</h2>
						{account ? (
							<div className="text-[12px] leading-[20.4px] text-text-muted font-medium font-geist">
								Logged in as (
								<span className="text-blue-80">@{account}</span>)
							</div>
						) : (
							<div className="text-[12px] leading-[20.4px] text-text-muted font-medium font-geist">
								Not connected
							</div>
						)}
					</div>
				</div>
				<div>
					{account && installationUrl ? (
						<GitHubAppInstallButton
							installationUrl={installationUrl}
							installed={installed}
						/>
					) : (
						<Button asChild variant="primary" size="large">
							<Link href="/settings/account/authentication">
								Configure GitHub App
							</Link>
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
