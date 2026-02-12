import { WorkspaceId } from "@giselles-ai/protocol";
import { notFound } from "next/navigation";
import { FormPage } from "./form-page";

export const metadata = {
	title: "Form",
};

export default async function FormRoute({
	params,
}: {
	params: Promise<{ workspaceId: string }>;
}) {
	const { workspaceId: workspaceIdStr } = await params;

	const parseResult = WorkspaceId.safeParse(workspaceIdStr);
	if (!parseResult.success) {
		return notFound();
	}

	return <FormPage workspaceId={parseResult.data} />;
}
