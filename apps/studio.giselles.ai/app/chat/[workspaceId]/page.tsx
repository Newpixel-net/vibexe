import { WorkspaceId } from "@giselles-ai/protocol";
import { notFound } from "next/navigation";
import { ChatWidget } from "./chat-widget";

export const metadata = {
	title: "Chat",
};

export default async function ChatPage({
	params,
}: {
	params: Promise<{ workspaceId: string }>;
}) {
	const { workspaceId: workspaceIdStr } = await params;

	const parseResult = WorkspaceId.safeParse(workspaceIdStr);
	if (!parseResult.success) {
		return notFound();
	}

	return <ChatWidget workspaceId={parseResult.data} />;
}
