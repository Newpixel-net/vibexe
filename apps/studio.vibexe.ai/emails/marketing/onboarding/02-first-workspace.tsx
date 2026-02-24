import {
	Body,
	Button,
	Container,
	Head,
	Hr,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import {
	button,
	container,
	EmailFonts,
	EmailFooter,
	EmailHeader,
	link,
	main,
	section,
	signatureText,
	text,
	topBorder,
	topBorderSection,
} from "../../components";

interface FirstWorkspaceEmailProps {
	userName?: string;
	createWorkspaceUrl?: string;
	stageUrl?: string;
	docsUrl?: string;
}

export const FirstWorkspaceEmail = ({
	userName = "there",
	createWorkspaceUrl = "https://vibexe.online",
	stageUrl: _stageUrl = "https://vibexe.online/stage",
	docsUrl = "https://vibexe.online/docs/en/guides/introduction",
}: FirstWorkspaceEmailProps) => {
	return (
		<Html>
			<Head>
				<EmailFonts />
			</Head>
			<Preview>Ready to collaborate? Create your workspace 🛠️</Preview>
			<Body style={main}>
				<Container style={container}>
					<EmailHeader
						heading="Ready to collaborate?"
						subheading="Create your workspace."
					/>
					<Section style={topBorderSection}>
						<Hr style={topBorder} />
					</Section>
					<Section style={section}>
						<Text style={text}>
							Hi {userName},<br />
							<br />
							You&apos;ve explored Vibexe&apos;s Stage — now it&apos;s time to
							take the next step.
							<br />
							<br />
							Create a dedicated workspace for your team to collaborate, build
							agents visually with the Node Builder, and manage integrations
							together — all in one place.
							<br />
							<br />
							Workspaces are shared within your team, allowing everyone to
							collaborate on building and managing AI agents together. Connect
							GitHub, use multiple AI models, and access your knowledge store —
							everything you need to build powerful agents.
						</Text>
						<Button href={createWorkspaceUrl} style={button}>
							Create your workspace
						</Button>
						<Text style={text}>
							Need help getting started? Check out our{" "}
							<Link href={docsUrl} style={link}>
								documentation
							</Link>
							.
							<br />
							<br />
							Or keep experimenting in your personal Stage.
						</Text>
						<Text style={signatureText}>
							—<br />
							The Vibexe Team
							<br />
							<Link href="https://vibexe.online" style={link}>
								https://vibexe.online
							</Link>
						</Text>
					</Section>
					<Section style={topBorderSection}>
						<Hr style={topBorder} />
					</Section>
				</Container>
				<EmailFooter />
			</Body>
		</Html>
	);
};

FirstWorkspaceEmail.PreviewProps = {
	userName: "John",
	createWorkspaceUrl: "https://vibexe.online",
	stageUrl: "https://vibexe.online/stage",
	docsUrl: "https://vibexe.online/docs/en/guides/introduction",
} as FirstWorkspaceEmailProps;

export default FirstWorkspaceEmail;
