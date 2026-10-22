import type { CSSProperties } from "react";
import { Html, Head, Body, Container, Section, Heading, Text, Preview, Img, Button, Link, Hr, render, toPlainText } from "@react-email/components";
import { emailContent, emailBranding, type EmailContent, type EmailBranding } from "../../contracts/src/notification-channels.ts";

// Email-safe sRGB values from payloadbay/brand/DESIGN.md; no remote fonts or UI CSS.
const styles: Record<string, CSSProperties> = {
	body: {
		margin: 0,
		padding: "24px 12px",
		backgroundColor: "#f3f6fb",
		color: "#0C192A",
		fontFamily: "Arial, Helvetica, sans-serif",
	},
	card: {
		width: "100%",
		maxWidth: "600px",
		margin: "0 auto",
		padding: "32px",
		border: "1px solid #dce3ee",
		borderRadius: "16px",
		backgroundColor: "#ffffff",
		boxSizing: "border-box",
	},
	title: {
		margin: "24px 0 16px",
		fontSize: "24px",
		lineHeight: "32px",
		fontWeight: 700,
		color: "#0C192A",
	},
	copy: {
		margin: "0 0 16px",
		fontSize: "16px",
		lineHeight: "26px",
		color: "#24344c",
		overflowWrap: "anywhere",
	},
	code: {
		margin: "24px 0",
		padding: "20px 12px",
		borderRadius: "12px",
		backgroundColor: "#edf4ff",
		textAlign: "center",
		fontSize: "32px",
		fontFamily: "monospace",
		letterSpacing: "8px",
		fontWeight: 700,
		color: "#0C192A",
	},
	button: {
		padding: "14px 24px",
		borderRadius: "10px",
		fontSize: "16px",
		lineHeight: "24px",
		fontWeight: 700,
		color: "#ffffff",
		textDecoration: "none",
		textAlign: "center",
		boxSizing: "border-box",
	},
	muted: {
		margin: "16px 0 0",
		fontSize: "12px",
		lineHeight: "20px",
		color: "#64748b",
		overflowWrap: "anywhere",
	},
};

const darkMode = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
.email-body { background-color: #03060D !important; }
.email-card { background-color: #0C192A !important; border-color: #232933 !important; }
.email-title { color: #FCFCFC !important; }
.email-copy { color: #dce5f2 !important; }
.email-muted { color: #91A1B9 !important; }
.email-code { background-color: #1A2432 !important; color: #FCFCFC !important; }
}
@media (max-width: 480px) {
.email-card { padding: 20px !important; }
.email-action { display: block !important; width: 100% !important; }
}
`;

/** One wrapper for OTP, invitations and alerts. Raw HTML is an explicit admin-owned override. */
function EmailTemplate({ message, branding }: { message: EmailContent; branding: EmailBranding }) {
	return (
		<Html lang='en'>
			<Head>
				<meta name='viewport' content='width=device-width, initial-scale=1' />
				<meta name='color-scheme' content='light dark' />
				<style>{darkMode}</style>
			</Head>
			<Preview>{message.preview ?? message.title}</Preview>
			<Body className='email-body' style={styles.body}>
				<Container className='email-card' style={{ ...styles.card, borderTop: "4px solid " + branding.accent }}>
					<Section>{branding.logoUrl ? <Img src={branding.logoUrl} alt={branding.name} width={160} style={{ maxWidth: "100%", height: "auto" }} /> : <Text style={{ ...styles.copy, fontWeight: 700, color: branding.accent }}>{branding.name}</Text>}</Section>
					<Heading as='h1' className='email-title' style={styles.title}>
						{message.title}
					</Heading>
					{message.html ? (
						<Section dangerouslySetInnerHTML={{ __html: message.html }} />
					) : (
						<Section>
							{message.paragraphs.map((paragraph, index) => (
								<Text key={index} className='email-copy' style={styles.copy}>
									{paragraph}
								</Text>
							))}
							{message.code && (
								<Text className='email-code' style={styles.code}>
									{message.code}
								</Text>
							)}
							{message.action && (
								<Section style={{ margin: "24px 0" }}>
									<Button href={message.action.url} className='email-action' style={{ ...styles.button, backgroundColor: branding.accent }}>
										{message.action.label}
									</Button>
									<Text className='email-muted' style={styles.muted}>
										Or open this address:{" "}
										<Link href={message.action.url} style={{ color: branding.accent, wordBreak: "break-all" }}>
											{message.action.url}
										</Link>
									</Text>
								</Section>
							)}
						</Section>
					)}
					<Hr style={{ borderColor: "#dce3ee", margin: "24px 0 0" }} />
					<Text className='email-muted' style={styles.muted}>
						{branding.footer}
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

export async function renderEmailMessage(input: EmailContent, appearance: EmailBranding) {
	const message = emailContent.parse(input);
	const branding = emailBranding.parse(appearance);
	const html = await render(<EmailTemplate message={message} branding={branding} />);

	return { subject: message.subject, html, text: message.text ?? toPlainText(html) };
}
