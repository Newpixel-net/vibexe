"use server";

import type { AppId } from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";

export async function getApp(input: { appId: AppId }) {
	const app = await vibexe.getApp(input);
	return { app };
}

export async function saveApp(input: Parameters<typeof vibexe.saveApp>[0]) {
	await vibexe.saveApp(input);
}

export async function deleteApp(
	input: Parameters<typeof vibexe.deleteApp>[0],
) {
	await vibexe.deleteApp(input);
}
