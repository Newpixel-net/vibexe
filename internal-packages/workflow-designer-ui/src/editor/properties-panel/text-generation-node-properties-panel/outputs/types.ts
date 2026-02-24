import type {
	Connection,
	NodeBase,
	NodeLike,
	Output,
} from "@vibexe-ai/protocol";

export type ConnectedOutputWithDetails<T extends NodeBase = NodeLike> =
	Output & {
		node: T;
		connection: Connection;
	};
