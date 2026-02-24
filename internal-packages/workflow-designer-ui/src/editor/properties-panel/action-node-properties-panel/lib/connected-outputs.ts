import type {
	ConnectionId,
	Input,
	NodeLike,
	Output,
} from "@vibexe-ai/protocol";

export type InputWithConnectedOutput = Input & {
	connectedOutput?: Output & { node: NodeLike } & {
		connectionId: ConnectionId;
	};
};
