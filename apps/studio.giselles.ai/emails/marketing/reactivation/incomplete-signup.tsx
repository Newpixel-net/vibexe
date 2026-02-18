import {
	Body,
	Button,
	Container,
	Head,
	Heading,
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
	h1,
	link,
	main,
	section,
	signatureText,
	text,
	topBorder,
	topBorderSection,
} from "../../components";

interface IncompleteSignupEmailProps {
	userName?: string;
	completeSignupUrl?: string;
	resendCodeUrl?: string;
}

export const IncompleteSignupEmail = ({
	userName = "there",
	completeSignupUrl = "https://vibexe.online/signup/verify-email",
	resendCodeUrl = "https://vibexe.online/signup/verify-email",
}: IncompleteSignupEmailProps) => {
	return (
		<Html>
			<Head>
				<EmailFonts />
			</Head>
			<Preview>Complete your Vibexe signup</Preview>
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
						<Heading style={h1}>Verify your email.</Heading>
						<Text style={text}>
							Hi {userName}, we noticed you started signing up for Vibexe but
							didn&apos;t finish verifying your email.
						</Text>
						<Text style={text}>
							Complete your signup by verifying your email address. Enter the
							verification code we sent, or request a new one if you need it.
						</Text>
						<Button href={completeSignupUrl} style={button}>
							Verify your email
						</Button>
						<Text style={text}>
							Didn&apos;t receive a code?{" "}
							<Link href={resendCodeUrl} style={link}>
								Request a new verification code
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

IncompleteSignupEmail.PreviewProps = {
	userName: "John",
	completeSignupUrl: "https://vibexe.online/signup/verify-email",
	resendCodeUrl: "https://vibexe.online/signup/verify-email",
} as IncompleteSignupEmailProps;

export default IncompleteSignupEmail;
