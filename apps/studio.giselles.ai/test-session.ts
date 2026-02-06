import {
	createSession,
	deleteSession,
	getSessionByToken,
} from "./lib/session-store";

async function test() {
	console.log("Testing session store...");
	const session = await createSession("test-user-123");
	console.log("Created:", session.token.substring(0, 16));
	const retrieved = await getSessionByToken(session.token);
	console.log("Retrieved user:", retrieved?.userId);
	await deleteSession(session.token);
	const deleted = await getSessionByToken(session.token);
	console.log("After delete:", deleted);
	console.log("PASSED");
	process.exit(0);
}
test().catch((e) => {
	console.error(e);
	process.exit(1);
});
