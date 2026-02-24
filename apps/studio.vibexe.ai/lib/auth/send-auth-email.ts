import { sendEmail } from "@/services/external/email";

export async function sendVerificationEmail(
	email: string,
	token: string,
): Promise<void> {
	const subject = "Verify your email address";
	const body = `Your verification code is: ${token}\n\nThis code expires in 60 minutes.`;
	await sendEmail(subject, body, [
		{ userDisplayName: email, userEmail: email },
	]);
}

export async function sendPasswordResetEmail(
	email: string,
	resetUrl: string,
): Promise<void> {
	const subject = "Reset your password";
	const body = `Click the following link to reset your password:\n\n${resetUrl}\n\nThis link expires in 60 minutes.`;
	await sendEmail(subject, body, [
		{ userDisplayName: email, userEmail: email },
	]);
}
