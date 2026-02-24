import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import type { ReactNode } from "react";

export default async function AdminLayout({
	children,
}: {
	children: ReactNode;
}) {
	try {
		await requireAdmin();
	} catch {
		redirect("/");
	}

	return (
		<div className="h-full bg-bg">
			<div className="px-[40px] py-[24px] flex-1 max-w-[1200px] mx-auto w-full">
				{children}
			</div>
		</div>
	);
}
