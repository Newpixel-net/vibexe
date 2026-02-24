import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { SuggestionsClient } from "./suggestions-client";

export default async function AdminSuggestionsPage() {
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
					Suggestion Templates
				</h1>
			</div>
			<p className="text-sm text-white/50 -mt-2">
				Manage smart suggestion templates shown to returning users in the App
				Builder. Templates are matched against project state using conditions.
			</p>
			<SuggestionsClient />
		</div>
	);
}
