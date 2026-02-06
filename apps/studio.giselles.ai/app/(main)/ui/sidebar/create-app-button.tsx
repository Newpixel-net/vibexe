"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback } from "react";
import { GlassButton } from "@/components/ui/glass-button";

type CreateAppState = {
	error?: string;
};

const initialState: CreateAppState = {};

export function CreateAppButton() {
	const router = useRouter();

	const createApp = useCallback(
		async (_: CreateAppState): Promise<CreateAppState> => {
			try {
				const response = await fetch("/api/app-builder/apps", {
					method: "POST",
				});
				if (!response.ok) {
					throw new Error(`Failed to create app: ${response.status}`);
				}

				const data = (await response.json()) as { redirectPath?: string };
				if (!data.redirectPath) {
					throw new Error("Missing redirect path");
				}

				router.push(data.redirectPath);
				return {};
			} catch (error) {
				console.error(error);
				return { error: "Failed to create app. Please try again." };
			}
		},
		[router],
	);

	const [state, formAction, pending] = useActionState(createApp, initialState);

	return (
		<form action={formAction} className="w-full">
			{state.error ? (
				<p className="text-sm text-error-500 mt-2" role="alert">
					{state.error}
				</p>
			) : null}
			<GlassButton
				type="submit"
				aria-label="Create App"
				className="w-full whitespace-nowrap"
				disabled={pending}
			>
				<span className="grid place-items-center rounded-full size-4 bg-primary-200 opacity-50">
					<PlusIcon className="size-3 text-background group-hover:text-background transition-colors" />
				</span>
				Create App
			</GlassButton>
		</form>
	);
}
