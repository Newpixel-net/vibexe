import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFilesForSharedApp } from "@/app/(main)/app-builder/lib/queries";
import { PreviewClient } from "./preview-client";

interface Props {
	params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { token } = await params;
	const result = await getFilesForSharedApp(token);

	if (!result) {
		return { title: "Not Found" };
	}

	return {
		title: `${result.app.name} — Preview`,
		description: result.app.description || `Live preview of ${result.app.name}`,
	};
}

export default async function PreviewPage({ params }: Props) {
	const { token } = await params;
	const result = await getFilesForSharedApp(token);

	if (!result) notFound();

	const files = result.files.map((f) => ({
		id: f.id,
		path: f.path,
		content: f.content,
		language: f.language,
	}));

	return (
		<PreviewClient
			appName={result.app.name}
			appId={result.app.id}
			files={files}
		/>
	);
}
