"use client";

import { Component, type ReactNode } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
}

export class GitHubIntegrationErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="p-4 rounded-lg bg-bg-900/50 border border-white/5">
					<p className="text-sm text-text-muted">
						GitHub integration is currently unavailable. Please check
						your GitHub App configuration.
					</p>
				</div>
			);
		}

		return this.props.children;
	}
}
