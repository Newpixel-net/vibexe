"use client";

/**
 * AuthenticationPanel Component
 *
 * Configure authentication methods for the app's end users.
 * Toggles for email/password, Google, and other social auth providers.
 */

import {
	KeyRound,
	Mail,
	Shield,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface AuthenticationPanelProps {
	appId: string;
}

interface AuthMethod {
	id: string;
	label: string;
	description: string;
	icon: string;
	enabled: boolean;
	available: boolean;
}

const DEFAULT_AUTH_METHODS: AuthMethod[] = [
	{
		id: "email_password",
		label: "Email and password authentication",
		description: "Members can log in with email and password",
		icon: "mail",
		enabled: true,
		available: true,
	},
	{
		id: "google",
		label: "Google authentication",
		description: "Members can log in with a Google account",
		icon: "google",
		enabled: false,
		available: true,
	},
	{
		id: "github",
		label: "GitHub authentication",
		description: "Members can log in with a GitHub account",
		icon: "github",
		enabled: false,
		available: true,
	},
	{
		id: "microsoft",
		label: "Microsoft authentication",
		description: "Members can log in with a Microsoft account",
		icon: "microsoft",
		enabled: false,
		available: false,
	},
	{
		id: "apple",
		label: "Apple authentication",
		description: "Members can log in with an Apple account",
		icon: "apple",
		enabled: false,
		available: false,
	},
];

function AuthIcon({ type }: { type: string }) {
	switch (type) {
		case "google":
			return (
				<svg className="h-5 w-5" viewBox="0 0 24 24">
					<path
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
						fill="#4285F4"
					/>
					<path
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						fill="#34A853"
					/>
					<path
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						fill="#FBBC05"
					/>
					<path
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						fill="#EA4335"
					/>
				</svg>
			);
		case "github":
			return (
				<svg className="h-5 w-5 text-foreground" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
				</svg>
			);
		case "microsoft":
			return (
				<svg className="h-5 w-5" viewBox="0 0 24 24">
					<rect x="1" y="1" width="10" height="10" fill="#F25022" />
					<rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
					<rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
					<rect x="13" y="13" width="10" height="10" fill="#FFB900" />
				</svg>
			);
		case "apple":
			return (
				<svg className="h-5 w-5 text-foreground" viewBox="0 0 24 24" fill="currentColor">
					<path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
				</svg>
			);
		default:
			return <Mail className="h-5 w-5 text-muted-foreground" />;
	}
}

export function AuthenticationPanel({ appId }: AuthenticationPanelProps) {
	const [methods, setMethods] = useState<AuthMethod[]>(DEFAULT_AUTH_METHODS);

	const toggleMethod = useCallback((methodId: string) => {
		setMethods((prev) =>
			prev.map((m) =>
				m.id === methodId && m.available ? { ...m, enabled: !m.enabled } : m,
			),
		);
		// TODO: Persist to API when app-level auth settings storage is added
	}, []);

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						Authentication
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Configure the authentication methods that members of your app
						can use to log in.
					</p>
				</div>

				{/* Auth Methods */}
				<div className="space-y-3">
					{methods.map((method) => (
						<div
							key={method.id}
							className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
						>
							<div className="flex items-center gap-4">
								<div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
									<AuthIcon type={method.icon} />
								</div>
								<div>
									<h3 className="text-sm font-medium text-foreground">
										{method.label}
									</h3>
									<p className="text-xs text-muted-foreground">
										{method.description}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => toggleMethod(method.id)}
								disabled={!method.available}
								className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
									method.enabled
										? "bg-foreground"
										: "bg-muted-foreground/20"
								} ${!method.available ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
							>
								<span
									className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
										method.enabled
											? "translate-x-6"
											: "translate-x-1"
									}`}
								/>
							</button>
						</div>
					))}
				</div>

				{/* SSO Section */}
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-4">
							<div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
								<Shield className="h-5 w-5 text-muted-foreground" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<h3 className="text-sm font-medium text-foreground">
										Single Sign-on (SSO)
									</h3>
									<span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
										Coming Soon
									</span>
								</div>
								<p className="text-xs text-muted-foreground mt-0.5">
									Allow members to log in using a custom SSO that
									fits your organization's needs.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
