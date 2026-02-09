import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { OAuthAppsSection } from "./oauth-apps-section";

export default async function AdminOAuthAppsPage() {
	try {
		await requireAdmin();
	} catch {
		redirect("/");
	}

	return (
		<div className="flex flex-col gap-[24px]">
			<div className="flex justify-between items-center">
				<h1
					className="text-[30px] font-sans font-medium text-[hsl(192,73%,84%)]"
					style={{
						textShadow:
							"0 0 20px #0087f6, 0 0 40px #0087f6, 0 0 60px #0087f6",
					}}
				>
					OAuth Apps
				</h1>
			</div>
			<p className="text-sm text-white/50 -mt-2">
				Configure OAuth2 client credentials for integration providers. One
				configuration can cover multiple pieces (e.g., a single Google config
				covers Sheets, Drive, Gmail, Calendar).
			</p>
			<OAuthAppsSection />
		</div>
	);
}
