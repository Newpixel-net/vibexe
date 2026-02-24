import type { FileId, WorkspaceId } from "@vibexe-ai/protocol";
import type { VibexeStorage } from "@vibexe-ai/storage";
import { filePath } from "./utils";

export async function getFileText(args: {
	storage: VibexeStorage;
	workspaceId: WorkspaceId;
	fileId: FileId;
}) {
	const path = filePath({
		type: "studio",
		workspaceId: args.workspaceId,
		fileId: args.fileId,
	});
	const blob = await args.storage.getBlob(path);
	return Buffer.from(blob).toString();
}
