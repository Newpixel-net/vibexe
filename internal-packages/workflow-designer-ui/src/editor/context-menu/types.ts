export interface ContextMenuProps {
	id: string;
	top?: number;
	left?: number;
	right?: number;
	bottom?: number;
	onClose: () => void;
	onExecute?: () => void;
	onSelectAll?: () => void;
	onFitView?: () => void;
	onTidyUp?: () => void;
}
