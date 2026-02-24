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

interface WebinarInvitationEmailProps {
	userName?: string;
	webinarDate?: string;
	webinarTime?: string;
	joinUrl?: string;
}

export const WebinarInvitationEmail = ({
	userName = "there",
	webinarDate = "January 15, 2025",
	webinarTime = "2:00 PM EST",
	joinUrl = "https://vibexe.online/webinar",
}: WebinarInvitationEmailProps) => {
	return (
		<Html>
			<Head>
				<EmailFonts />
			</Head>
			<Preview>Join us for Building AI Agents with Vibexe</Preview>
			<Body style={main}>
				<Container style={container}>
					<EmailHeader
						heading="Let's grow together."
						subheading="Become a Vibexe Ambassador."
					/>
					<Section style={topBorderSection}>
						<Hr style={topBorder} />
					</Section>
					<Section style={section}>
						<Text style={text}>Hi {userName},</Text>
						<Text style={text}>
							We&apos;re hosting a live webinar: &quot;Building AI Agents with
							Vibexe.&quot;
						</Text>
						<Text style={text}>
							🗓️ Date: {webinarDate}
							<br />⏰ Time: {webinarTime}
						</Text>
						<Text style={text}>
							Learn how to design, deploy, and scale AI agents — and get your
							questions answered directly by our team.
						</Text>
						<Button href={joinUrl} style={button}>
							Join Event
						</Button>
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

WebinarInvitationEmail.PreviewProps = {
	userName: "John",
	webinarDate: "January 15, 2025",
	webinarTime: "2:00 PM EST",
	joinUrl: "https://vibexe.online/webinar",
} as WebinarInvitationEmailProps;

export default WebinarInvitationEmail;
