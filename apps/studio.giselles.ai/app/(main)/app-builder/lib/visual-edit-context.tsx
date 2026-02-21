"use client";

/**
 * Visual Edit Context
 *
 * Shared state for visual element selection and editing.
 * Provides toggle, selection state, and iframe communication.
 */

import {
	type ReactNode,
	type RefObject,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

export interface SelectedElement {
	tagName: string;
	className: string;
	textContent: string;
	innerHTML: string;
	boundingRect: { top: number; left: number; width: number; height: number };
	selector: string;
	computedStyles: Record<string, string>;
	isDynamicContent?: boolean;
}

interface VisualEditState {
	enabled: boolean;
	selectedElement: SelectedElement | null;
	pendingVisualEditMessage: string | null;
}

interface VisualEditActions {
	toggleVisualEdit: () => void;
	setEnabled: (enabled: boolean) => void;
	selectElement: (el: SelectedElement) => void;
	deselectElement: () => void;
	setIframeRef: (ref: RefObject<HTMLIFrameElement | null>) => void;
	sendToIframe: (message: object) => void;
	sendVisualEditMessage: (message: string) => void;
	clearPendingMessage: () => void;
}

type VisualEditContextValue = VisualEditState & VisualEditActions;

const VisualEditContext = createContext<VisualEditContextValue | null>(null);

export function VisualEditProvider({ children }: { children: ReactNode }) {
	const [enabled, setEnabled] = useState(false);
	const [selectedElement, setSelectedElement] =
		useState<SelectedElement | null>(null);
	const [pendingVisualEditMessage, setPendingVisualEditMessage] = useState<
		string | null
	>(null);
	const iframeRefStore = useRef<RefObject<HTMLIFrameElement | null> | null>(
		null,
	);

	const setIframeRef = useCallback(
		(ref: RefObject<HTMLIFrameElement | null>) => {
			iframeRefStore.current = ref;
		},
		[],
	);

	const sendToIframe = useCallback((message: object) => {
		const iframe = iframeRefStore.current?.current;
		if (iframe?.contentWindow) {
			iframe.contentWindow.postMessage(message, "*");
		}
	}, []);

	const toggleVisualEdit = useCallback(() => {
		setEnabled((prev) => {
			const next = !prev;
			if (!next) {
				setSelectedElement(null);
			}
			return next;
		});
	}, []);

	// Send enable/disable to iframe when toggled
	useEffect(() => {
		sendToIframe({
			type: enabled ? "visual-edit-enable" : "visual-edit-disable",
		});
	}, [enabled, sendToIframe]);

	const selectElement = useCallback((el: SelectedElement) => {
		setSelectedElement(el);
	}, []);

	const deselectElement = useCallback(() => {
		setSelectedElement(null);
		sendToIframe({ type: "visual-edit-deselect-cmd" });
	}, [sendToIframe]);

	const sendVisualEditMessage = useCallback((message: string) => {
		setPendingVisualEditMessage(message);
	}, []);

	const clearPendingMessage = useCallback(() => {
		setPendingVisualEditMessage(null);
	}, []);

	return (
		<VisualEditContext.Provider
			value={{
				enabled,
				selectedElement,
				pendingVisualEditMessage,
				toggleVisualEdit,
				setEnabled,
				selectElement,
				deselectElement,
				setIframeRef,
				sendToIframe,
				sendVisualEditMessage,
				clearPendingMessage,
			}}
		>
			{children}
		</VisualEditContext.Provider>
	);
}

export function useVisualEdit(): VisualEditContextValue {
	const ctx = useContext(VisualEditContext);
	if (!ctx) {
		throw new Error("useVisualEdit must be used within VisualEditProvider");
	}
	return ctx;
}
