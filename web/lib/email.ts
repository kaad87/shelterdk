// lib/email.ts
import { Resend } from "resend";

export const FROM_EMAIL = "ShelterDK <no-reply@shelterdk.dk>";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendContactEmail(opts: {
  toEmail: string;
  toName: string;
  senderName: string;
  senderEmail: string;
  message: string;
  postTitle: string;
}) {
  const { toEmail, toName, senderName, senderEmail, message, postTitle } = opts;

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    replyTo: senderEmail,
    subject: `Ny besked om dit opslag: ${escapeHtml(postTitle)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #2C3E50;">Hej ${escapeHtml(toName)}!</h2>
        <p>Du har fået en besked om dit opslag <strong>"${escapeHtml(postTitle)}"</strong> på ShelterDK.</p>
        <hr style="border: 1px solid #eee;" />
        <p><strong>Fra:</strong> ${escapeHtml(senderName)} (${escapeHtml(senderEmail)})</p>
        <p><strong>Besked:</strong></p>
        <p style="background: #f9f9f9; padding: 12px; border-radius: 8px;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        <hr style="border: 1px solid #eee;" />
        <p style="color: #666; font-size: 14px;">Du kan svare direkte på denne email for at kontakte ${escapeHtml(senderName)}.</p>
        <p style="color: #999; font-size: 12px;">Denne email er sendt via <a href="https://shelterdk.dk/turvenner">ShelterDK Turvenner</a></p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error("Kunne ikke sende email.");
  }
}
