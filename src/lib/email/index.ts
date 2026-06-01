import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM ?? 'GhostWriter <hello@ghostwriterai.com>';

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendEmail(params: {
  to: string; subject: string; html: string; text?: string;
}) {
  const resend = getResend();
  if (!resend) { console.warn('[email] RESEND_API_KEY not set — skipping'); return; }
  try {
    await resend.emails.send({ from: FROM, to: params.to,
      subject: params.subject, html: params.html, text: params.text });
  } catch (err) { console.error('[email] Send failed:', err); }
}
