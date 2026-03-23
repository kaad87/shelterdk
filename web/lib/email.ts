// lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "ShelterDK <onboarding@resend.dev>";

export async function sendContactEmail(opts: {
  toEmail: string;
  toName: string;
  senderName: string;
  senderEmail: string;
  message: string;
  postTitle: string;
}) {
  const { toEmail, toName, senderName, senderEmail, message, postTitle } = opts;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    replyTo: senderEmail,
    subject: `Ny besked om dit opslag: ${postTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #2C3E50;">Hej ${toName}!</h2>
        <p>Du har fået en besked om dit opslag <strong>"${postTitle}"</strong> på ShelterDK.</p>
        <hr style="border: 1px solid #eee;" />
        <p><strong>Fra:</strong> ${senderName} (${senderEmail})</p>
        <p><strong>Besked:</strong></p>
        <p style="background: #f9f9f9; padding: 12px; border-radius: 8px;">${message.replace(/\n/g, "<br>")}</p>
        <hr style="border: 1px solid #eee;" />
        <p style="color: #666; font-size: 14px;">Du kan svare direkte på denne email for at kontakte ${senderName}.</p>
        <p style="color: #999; font-size: 12px;">Denne email er sendt via <a href="https://shelterdk.dk/turvenner">ShelterDK Turvenner</a></p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error("Kunne ikke sende email.");
  }
}
