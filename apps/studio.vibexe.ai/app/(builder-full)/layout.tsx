import { ToastProvider } from "@vibexe-internal/ui/toast";
import { SentryUserWrapper } from "@/components/sentry-user-wrapper";
import { InternalVibexeClientProvider } from "../(main)/internal-vibexe-client-provider";

/**
 * Full-screen layout for App Builder [appId] view.
 * No sidebar, no header - just the content.
 */
export default function BuilderFullLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<SentryUserWrapper>
			<ToastProvider>
				<InternalVibexeClientProvider>
					{children}
				</InternalVibexeClientProvider>
			</ToastProvider>
		</SentryUserWrapper>
	);
}
