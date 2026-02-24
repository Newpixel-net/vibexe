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

interface LongTimeNoSeeEmailProps {
	userName?: string;
	returnUrl?: string;
	examplesGalleryUrl?: string;
	releaseNotesUrl?: string;
}

export const LongTimeNoSeeEmail = ({
	userName = "there",
	returnUrl = "https://vibexe.online",
	examplesGalleryUrl = "https://vibexe.online",
	releaseNotesUrl = "https://vibexe.online/docs/en/releases/release-notes",
}: LongTimeNoSeeEmailProps) => {
	return (
		<Html>
			<Head>
				<EmailFonts />
			</Head>
			<Preview>We've missed you at Vibexe 💫</Preview>
			<Body style={main}>
				<Container style={container}>
					<EmailHeader
						heading="It's been a while."
						subheading="Your agents are waiting for you."
					/>
					<Section style={topBorderSection}>
						<Hr style={topBorder} />
					</Section>
					<Section style={section}>
						<Text style={text}>
							Hi {userName},<br />
							<br />
							It&apos;s been a while since you last visited Vibexe.
							<br />
							<br />
							Your Stage and workspace are still here — ready whenever you are.
							<br />
							<br />
							We&apos;ve been busy. New templates, model updates, and
							orchestration features have been added to make building even
							smoother. Check out our{" "}
							<Link href={releaseNotesUrl} style={link}>
								release notes
							</Link>{" "}
							to see what&apos;s new.
							<br />
							<br />
							Jump back in, explore what&apos;s new, and keep creating.
						</Text>
						<Button href={returnUrl} style={button}>
							Return to Vibexe
						</Button>
						<Text style={text}>
							Need help or inspiration? Visit our{" "}
							<Link href={examplesGalleryUrl} style={link}>
								examples gallery
							</Link>{" "}
							or reach out anytime at{" "}
							<Link href="mailto:support@vibexe.online" style={link}>
								support@vibexe.online
							</Link>
							.
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

LongTimeNoSeeEmail.PreviewProps = {
	userName: "John",
	returnUrl: "https://vibexe.online",
	examplesGalleryUrl: "https://vibexe.online",
	releaseNotesUrl: "https://vibexe.online/docs/en/releases/release-notes",
} as LongTimeNoSeeEmailProps;

export default LongTimeNoSeeEmail;
