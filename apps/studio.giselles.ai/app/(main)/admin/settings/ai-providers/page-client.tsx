"use client";

import { Button } from "@giselle-internal/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@giselle-internal/ui/dialog";
import { Input } from "@giselle-internal/ui/input";
import { PageHeading } from "@giselle-internal/ui/page-heading";
import {
	BrainCircuit,
	Globe,
	Search,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
	type ActionState,
	deleteProviderKeyAction,
	saveProviderKeyAction,
} from "./actions";

type ProviderData = {
	id: string;
	name: string;
	envVar: string;
	placeholder: string;
	description: string;
	isActive: boolean;
	maskedKey: string | null;
	updatedAt: string | null;
};

type AiProvidersPageClientProps = {
	providers: ProviderData[];
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
	anthropic: <BrainCircuit className="size-6" />,
	openai: <Sparkles className="size-6" />,
	google: <Globe className="size-6" />,
	perplexity: <Search className="size-6" />,
};

function ProviderCard({
	provider,
	onConfigure,
}: {
	provider: ProviderData;
	onConfigure: (provider: ProviderData) => void;
}) {
	return (
		<div className="relative rounded-[12px] overflow-hidden px-[24px] py-[20px] w-full bg-white/[0.02] backdrop-blur-[8px] border-[0.5px] border-white/8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(255,255,255,0.2)] before:content-[''] before:absolute before:inset-0 before:bg-white before:opacity-[0.02] before:rounded-[inherit] before:pointer-events-none">
			<div className="relative z-10 flex items-start justify-between gap-4">
				<div className="flex items-start gap-4">
					<div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white-800">
						{PROVIDER_ICONS[provider.id] ?? <Sparkles className="size-6" />}
					</div>
					<div className="flex flex-col gap-1.5">
						<h3 className="text-[16px] font-medium text-white-900">
							{provider.name}
						</h3>
						<p className="text-[13px] text-text-muted leading-[1.4]">
							{provider.description}
						</p>
						<div className="flex items-center gap-3 mt-1">
							<span
								className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full ${
									provider.isActive
										? "bg-green-500/20 text-green-400"
										: "bg-white/[0.05] text-text-muted"
								}`}
							>
								<span
									className={`w-1.5 h-1.5 rounded-full ${
										provider.isActive ? "bg-green-400" : "bg-text-muted"
									}`}
								/>
								{provider.isActive ? "Active" : "Not configured"}
							</span>
							{provider.maskedKey && (
								<span className="text-xs text-text-muted font-mono">
									{provider.maskedKey}
								</span>
							)}
						</div>
					</div>
				</div>
				<button
					type="button"
					onClick={() => onConfigure(provider)}
					className="px-4 py-2 text-sm font-medium rounded-lg bg-white/[0.05] border border-white/[0.1] text-white-800 hover:bg-white/[0.08] hover:text-white-900 transition-colors cursor-pointer"
				>
					Configure
				</button>
			</div>
		</div>
	);
}

function ConfigureDialog({
	provider,
	isOpen,
	onOpenChange,
}: {
	provider: ProviderData;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [apiKey, setApiKey] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSaveTransition] = useTransition();
	const [isDeleting, startDeleteTransition] = useTransition();

	const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		startSaveTransition(async () => {
			const formData = new FormData();
			formData.set("provider", provider.id);
			formData.set("apiKey", apiKey);
			const result: ActionState = await saveProviderKeyAction(
				undefined,
				formData,
			);
			if (result.success) {
				setApiKey("");
				onOpenChange(false);
			} else {
				setError(result.error ?? "Failed to save");
			}
		});
	};

	const handleDelete = () => {
		setError(null);
		startDeleteTransition(async () => {
			const formData = new FormData();
			formData.set("provider", provider.id);
			const result: ActionState = await deleteProviderKeyAction(
				undefined,
				formData,
			);
			if (result.success) {
				onOpenChange(false);
			} else {
				setError(result.error ?? "Failed to delete");
			}
		});
	};

	const isPending = isSaving || isDeleting;

	return (
		<Dialog open={isOpen} onOpenChange={isPending ? () => {} : onOpenChange}>
			<DialogContent variant="glass">
				<DialogHeader>
					<DialogTitle className="text-[20px] font-semibold text-white-900">
						Configure {provider.name}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSave} className="mt-4 space-y-5">
					<p className="text-sm text-text-muted">{provider.description}</p>

					{provider.isActive && provider.maskedKey && (
						<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400">
							<span className="w-2 h-2 rounded-full bg-green-400" />
							Current key: {provider.maskedKey}
						</div>
					)}

					<div className="space-y-2">
						<label
							htmlFor="apiKey"
							className="block text-sm text-white-800"
						>
							API Key
						</label>
						<Input
							id="apiKey"
							name="apiKey"
							type="password"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							placeholder={provider.placeholder}
							className="w-full font-mono"
							disabled={isPending}
						/>
						<p className="text-xs text-text-muted">
							Environment variable: <code>{provider.envVar}</code>
						</p>
					</div>

					{error && (
						<div className="rounded-md border border-error-500/40 bg-error-500/10 px-3 py-2 text-sm text-error-200">
							{error}
						</div>
					)}

					<DialogFooter>
						<div className="flex w-full items-center justify-between">
							<div>
								{provider.isActive && (
									<button
										type="button"
										onClick={handleDelete}
										disabled={isPending}
										className="flex items-center gap-1.5 px-3 py-2 text-sm text-error-200 hover:text-error-500 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
									>
										<Trash2 className="size-4" />
										Remove key
									</button>
								)}
							</div>
							<div className="flex gap-2">
								<Button
									type="button"
									variant="filled"
									size="large"
									disabled={isPending}
									onClick={() => onOpenChange(false)}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									variant="primary"
									size="large"
									disabled={isPending || !apiKey.trim()}
								>
									{isSaving ? "Saving..." : "Save key"}
								</Button>
							</div>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function AiProvidersPageClient({
	providers,
}: AiProvidersPageClientProps) {
	const [configuring, setConfiguring] = useState<ProviderData | null>(null);

	return (
		<div className="h-full bg-bg">
			<div className="px-[40px] py-[24px] flex-1 max-w-[1200px] mx-auto w-full">
				<div className="flex flex-col gap-4 mb-8">
					<PageHeading glow>AI Provider Keys</PageHeading>
					<p className="text-text-muted text-[14px] leading-[20px] font-geist">
						Manage API keys for AI providers. Keys are encrypted and stored
						securely. Changes take effect immediately without requiring a
						server restart.
					</p>
				</div>

				<div className="grid gap-4">
					{providers.map((provider) => (
						<ProviderCard
							key={provider.id}
							provider={provider}
							onConfigure={setConfiguring}
						/>
					))}
				</div>
			</div>

			{configuring && (
				<ConfigureDialog
					key={configuring.id}
					provider={configuring}
					isOpen={true}
					onOpenChange={(open) => {
						if (!open) setConfiguring(null);
					}}
				/>
			)}
		</div>
	);
}
