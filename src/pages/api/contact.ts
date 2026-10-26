/**
 * Contact form endpoint for the Kontakt section (the only server route; every page is static).
 * Same rules as our other Astro sites: no CAPTCHA, honeypot + rate limit + strict validation,
 * the enquiry is stored before the mail is sent so a failed mail never loses a lead.
 *
 * Environment (Hostinger Node.js app settings), see .env.example:
 *   SMTP_HOST, SMTP_PORT (465 = TLS, 587 = STARTTLS), SMTP_USER, SMTP_PASS, SMTP_AUTO_TLS ("false" = never upgrade)
 *   MAIL_FROM, MAIL_FROM_NAME, MAIL_TO (comma separated, default MAIL_FROM)
 *   SUBMISSIONS_DIR (default ./data/submissions, outside the public folder)
 */
import type { APIRoute } from 'astro';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import messages from '../../i18n/form.json';

export const prerender = false;

const env = (k: string) => process.env[k] ?? import.meta.env[k];
const hits = new Map<string, number[]>();
const LIMIT = 5; // per IP
const WINDOW = 10 * 60 * 1000; // 10 minutes

const msg = (key: keyof typeof messages) => messages[key];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const field = (form: FormData, name: string, max: number) =>
  String(form.get(name) ?? '')
    .trim()
    .slice(0, max);

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ ok: false, message: msg('form_error') }, 400);

  // Honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (field(form, 'website', 200) !== '') return json({ ok: true, message: msg('form_ok') });

  const ip = clientAddress || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return json({ ok: false, message: msg('form_error') }, 429);
  recent.push(now);
  hits.set(ip, recent);

  const entry = {
    at: new Date().toISOString(),
    name: field(form, 'name', 200),
    company: field(form, 'company', 200),
    email: field(form, 'email', 200),
    modules: field(form, 'modules', 600),
    message: field(form, 'message', 5000),
    page: request.headers.get('referer') ?? '',
    // IP and user agent are deliberately not stored (data minimisation); the IP only lives in memory for the rate limit
    mail: 'pending',
  };
  const consent = form.get('consent') != null;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(entry.email);
  if (!entry.name || !emailOk || !consent) {
    return json({ ok: false, message: msg('form_invalid') }, 422);
  }

  const dir = env('SUBMISSIONS_DIR') || path.join(process.cwd(), 'data', 'submissions');
  const file = path.join(dir, `${entry.at.slice(0, 7)}.jsonl`);
  try {
    await mkdir(dir, { recursive: true });
    await appendFile(file, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.error('[contact] store failed', e);
  }

  if (env('SMTP_HOST')) {
    try {
      const port = Number(env('SMTP_PORT') || 465);
      const user = env('SMTP_USER');
      const fromAddr = env('MAIL_FROM') || user;
      const transport = nodemailer.createTransport({
        host: env('SMTP_HOST'),
        port,
        secure: port === 465,
        ignoreTLS: String(env('SMTP_AUTO_TLS')).toLowerCase() === 'false',
        ...(user ? { auth: { user, pass: env('SMTP_PASS') } } : {}),
      });
      await transport.sendMail({
        from: env('MAIL_FROM_NAME') ? { name: env('MAIL_FROM_NAME'), address: fromAddr } : fromAddr,
        to: env('MAIL_TO') || fromAddr,
        replyTo: entry.email,
        subject: `Neue Anfrage über pe-admin.de${entry.company ? ` (${entry.company})` : ''}`,
        text: [
          `Name: ${entry.name}`,
          `Firma: ${entry.company || '-'}`,
          `E-Mail: ${entry.email}`,
          `Ausgewählte Module: ${entry.modules || '-'}`,
          `Seite: ${entry.page}`,
          '',
          entry.message || '(keine Nachricht)',
        ].join('\n'),
      });
      await appendFile(file, JSON.stringify({ at: entry.at, mail: 'sent' }) + '\n').catch(() => {});
    } catch (e) {
      console.error('[contact] mail failed', e);
      // the enquiry is stored; still tell the visitor it arrived
    }
  }
  return json({ ok: true, message: msg('form_ok') });
};
