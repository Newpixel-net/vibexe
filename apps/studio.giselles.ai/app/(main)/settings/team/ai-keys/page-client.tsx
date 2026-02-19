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
	AlertTriangle,
	BrainCircuit,
	Globe,
	Key,
	Search,
	Sparkles,
	Trash2,
	Zap,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
	type ActionState,
	deleteTeamProviderKeyAction,
	saveTeamProviderKeyAction,
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
	errorReason: "key_mismatch" | "decrypt_failed" | null;
};

type TeamAiKeysPageClientProps = {
	providers: ProviderData[];
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
	anthropic: <BrainCircuit className="size-6" />,
	openai: <Sparkles className="size-6" />,
	google: <Globe className="size-6" />,
	perplexity: <Search className="size-6" />,
	xai: <Zap className="size-6" />,
	nvidia: <Sparkles className="size-6" />,
};

function ProviderCard({
	provider,
	onConfigure,
}: {
	provider: ProviderData;
	onConfigure: (provider: ProviderData) => void;
}) {
	const hasError = provider.errorReason != null;

	return (
		<div
			className={`relative rounded-[12px] overflow-hidden px-[24px] py-[20px] w-full bg-white/[0.02] backdrop-blur-[8px] border-[0.5px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(255,255,255,0.2)] before:content-[''] before:absolute before:inset-0 before:bg-white before:opacity-[0.02] before:rounded-[inherit] before:pointer-events-none ${
				hasError
					? "border-red-500/50 ring-1 ring-red-500/20"
					: "border-white/8"
			}`}
		>
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
							{hasError ? (
								<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-red-500/20 text-red-400">
									<AlertTriangle className="size-3" />
									Key needs re-entry
								</span>
							) : (
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
							)}
							{provider.maskedKey && !hasError && (
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
			const result: ActionState = await saveTeamProviderKeyAction(
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
			const result: ActionState = await deleteTeamProviderKeyAction(
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

					{provider.errorReason && (
						<div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
							<AlertTriangle className="size-4 mt-0.5 shrink-0" />
							<span>
								{provider.errorReason === "key_mismatch"
									? "This key was encrypted with a different encryption key and cannot be read. Please enter a new API key."
									: "This key could not be decrypted. Please enter a new API key."}
							</span>
						</div>
					)}

					{!provider.errorReason && provider.isActive && provider.maskedKey && (
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

export function TeamAiKeysPageClient({
	providers,
}: TeamAiKeysPageClientProps) {
	const [configuring, setConfiguring] = useState<ProviderData | null>(null);

	const hasDecryptErrors = providers.some((p) => p.errorReason != null);

	return (
		<div className="flex flex-col gap-[24px]">
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-3">
					<Key className="size-6 text-white-800" />
					<PageHeading glow>AI Provider Keys</PageHeading>
				</div>
				<p className="text-text-muted text-[14px] leading-[20px] font-geist">
					Bring your own API keys for AI providers. Your team&apos;s keys
					are used instead of platform keys, giving you control over your
					own quotas and billing. Keys are encrypted at rest.
				</p>
			</div>

			{hasDecryptErrors && (
				<div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30">
					<AlertTriangle className="size-5 text-red-400 mt-0.5 shrink-0" />
					<div className="text-sm text-red-300">
						<p className="font-medium">
							One or more API keys cannot be decrypted.
						</p>
						<p className="mt-1 text-red-300/80">
							This usually means the server&apos;s encryption key has
							changed. Please re-enter the affected keys below.
						</p>
					</div>
				</div>
			)}

			<div className="grid gap-4">
				{providers.map((provider) => (
					<ProviderCard
						key={provider.id}
						provider={provider}
						onConfigure={setConfiguring}
					/>
				))}
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
