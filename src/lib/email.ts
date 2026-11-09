import 'server-only';
import { config } from './config';

/**
 * Transactional email via Resend's HTTP API (https://resend.com). Set RESEND_API_KEY and EMAIL_FROM.
 * Without them, messages are printed to the server log so local development still works.
 */
export const emailConfigured = !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(to: string, subject: string, text: string) {
  if (!emailConfigured) {
    if (config.isProd) console.warn(`[email] RESEND_API_KEY/EMAIL_FROM not set; dropping email to ${to}: ${subject}`);
    else console.log(`\n[email to ${to}] ${subject}\n${text}\n`);
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  });
  if (!r.ok) console.error('[email] send failed', r.status, await r.text().catch(() => ''));
}
