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

interface WelcomeEmailProps {
	userName?: string;
	stageUrl?: string;
	createWorkspaceUrl?: string;
	examplesGalleryUrl?: string;
}

export const WelcomeEmail = ({
	userName = "there",
	stageUrl = "https://vibexe.online/stage",
	createWorkspaceUrl = "https://vibexe.online",
	examplesGalleryUrl = "https://vibexe.online",
}: WelcomeEmailProps) => {
	return (
		<Html>
			<Head>
				<EmailFonts />
			</Head>
			<Preview>Welcome to Vibexe — your AI workspace starts here 🪶</Preview>
			<Body style={main}>
				<Container style={container}>
					<EmailHeader
						heading="Welcome to Vibexe."
						subheading="Your journey to build AI agents begins here."
					/>
					<Section style={topBorderSection}>
						<Hr style={topBorder} />
					</Section>
					<Section style={section}>
						<Text style={text}>
							Hi {userName},<br />
							<br />
							Your account is ready, and you can now explore Vibexe&apos;s
							Stage — your personal environment to test and run your AI agents
							instantly.
							<br />
							<br />
							Select an agent, input parameters, and watch it perform. No setup
							required — just start testing.
							<br />
							<br />
							Or express your ideas by creating your first workspace.
						</Text>
						<Button href={stageUrl} style={button}>
							The stage awaits
						</Button>
						<Button href={createWorkspaceUrl} style={button}>
							Create your workspace
						</Button>
						<Text style={text}>
							Need inspiration? Visit our{" "}
							<Link href={examplesGalleryUrl} style={link}>
								examples gallery
							</Link>{" "}
							or contact us anytime at{" "}
							<Link href="mailto:support@vibexe.online" style={link}>
								support@vibexe.online
							</Link>
							.
						</Text>
						<Text style={signatureText}>
							If you didn&apos;t sign up for Vibexe, you can safely ignore this
							email.
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

WelcomeEmail.PreviewProps = {
	userName: "John",
	stageUrl: "https://vibexe.online/stage",
	createWorkspaceUrl: "https://vibexe.online",
	examplesGalleryUrl: "https://vibexe.online",
} as WelcomeEmailProps;

export default WelcomeEmail;
