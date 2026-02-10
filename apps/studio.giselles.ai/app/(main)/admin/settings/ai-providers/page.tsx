import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import {
	AI_PROVIDERS,
	getProviderKeys,
	type ProviderKeyInfo,
} from "@/lib/ai-provider-keys";
import { AiProvidersPageClient } from "./page-client";

export default async function AiProvidersPage() {
	try {
		await requireAdmin();
	} catch {
		redirect("/");
	}

	const savedKeys = await getProviderKeys();
	const keyMap = new Map(savedKeys.map((k) => [k.provider, k]));

	const providers = AI_PROVIDERS.map((provider) => {
		const saved = keyMap.get(provider.id);
		return {
			...provider,
			isActive: saved?.isActive ?? false,
			maskedKey: saved?.maskedKey ?? null,
			updatedAt: saved?.updatedAt?.toISOString() ?? null,
			errorReason: saved?.errorReason ?? null,
		};
	});

	return <AiProvidersPageClient providers={providers} />;
}
