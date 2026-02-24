"use server";

import { vibexe } from "@/app/vibexe";

export async function createDataStore(
	input: Parameters<typeof vibexe.createDataStore>[0],
) {
	return { dataStore: await vibexe.createDataStore(input) };
}

export async function getDataStore(
	input: Parameters<typeof vibexe.getDataStore>[0],
) {
	return { dataStore: await vibexe.getDataStore(input) };
}

export async function updateDataStore(
	input: Parameters<typeof vibexe.updateDataStore>[0],
) {
	return { dataStore: await vibexe.updateDataStore(input) };
}

export async function deleteDataStore(
	input: Parameters<typeof vibexe.deleteDataStore>[0],
) {
	return { dataStore: await vibexe.deleteDataStore(input) };
}
