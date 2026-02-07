import { NextResponse } from "next/server";
import { fetchCurrentTeam } from "@/services/teams";
import { deleteCredential } from "@/services/integrations/credential-store";

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ credentialId: string }> },
) {
	try {
		const { credentialId } = await params;
		const id = Number.parseInt(credentialId, 10);
		if (Number.isNaN(id)) {
			return NextResponse.json(
				{ error: "Invalid credential ID" },
				{ status: 400 },
			);
		}

		const team = await fetchCurrentTeam();
		const deleted = await deleteCredential(team.dbId, id);

		if (!deleted) {
			return NextResponse.json(
				{ error: "Credential not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to delete credential:", error);
		return NextResponse.json(
			{ error: "Failed to delete credential" },
			{ status: 500 },
		);
	}
}
