import { ToastProvider } from "@giselle-internal/ui/toast";
import { SentryUserWrapper } from "@/components/sentry-user-wrapper";
import { InternalGiselleClientProvider } from "../(main)/internal-giselle-client-provider";

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
				<InternalGiselleClientProvider>
					{children}
				</InternalGiselleClientProvider>
			</ToastProvider>
		</SentryUserWrapper>
	);
}
