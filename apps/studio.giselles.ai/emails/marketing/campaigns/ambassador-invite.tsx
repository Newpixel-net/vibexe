import {
	Body,
	Button,
	Container,
	Head,
	Hr,
	Html,
	Img,
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
	getEmailAssetUrl,
	link,
	main,
	section,
	signatureText,
	text,
	topBorder,
	topBorderSection,
} from "../../components";

interface AmbassadorInviteEmailProps {
	userName?: string;
	applyUrl?: string;
}

export const AmbassadorInviteEmail = ({
	userName = "there",
	applyUrl = "https://vibexe.online/ambassador",
}: AmbassadorInviteEmailProps) => {
	const heroImageSrc = getEmailAssetUrl("ambassador-invite.jpg");
	return (
		<Html>
			<Head>
				<EmailFonts />
			</Head>
			<Preview>Join the Vibexe Ambassador Program 🪶</Preview>
			<Body style={main}>
				<Container style={container}>
					<EmailHeader />
					<Section style={imageSection}>
						<Img
							src={heroImageSrc}
							width="600"
							alt="Vibexe Ambassador Program"
							style={image}
						/>
					</Section>
					<Section style={section}>
						<Text style={text}>Hi {userName},</Text>
						<Text style={text}>
							We&apos;re inviting a select group of creators and developers to
							join the early Vibexe Ambassador Program.
						</Text>
						<Text style={text}>
							As an ambassador, you&apos;ll gain early access to new features,
							shape upcoming releases, and help define how teams build with AI.
						</Text>
						<Button href={applyUrl} style={button}>
							Apply Now
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

AmbassadorInviteEmail.PreviewProps = {
	userName: "John",
	applyUrl: "https://vibexe.online/ambassador",
} as AmbassadorInviteEmailProps;

const imageSection = {
	padding: "0",
	margin: "0",
};

const image = {
	width: "100%",
	maxWidth: "600px",
	display: "block",
	margin: "0 auto",
};

export default AmbassadorInviteEmail;
