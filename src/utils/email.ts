import nodemailer, { Transporter } from 'nodemailer';
import { env, isDevelopment, isProduction } from '@/config/env';
import { logger } from '@/config/logger';

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (!env.SMTP_HOST || !env.SMTP_USER) return null;
  if (!transporter) {
    // Port 587 → STARTTLS (secure: false). Port 465 → implicit TLS (secure: true).
    const secure = env.SMTP_SECURE || env.SMTP_PORT === 465;
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure,
      requireTLS: !secure && env.SMTP_PORT === 587,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      tls: { minVersion: 'TLSv1.2' },
    });
  }
  return transporter;
};

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Logged to console in development when SMTP delivery fails. */
  devOtpFallback?: string;
}

export const sendMail = async ({
  to,
  subject,
  html,
  text,
  devOtpFallback,
}: SendMailOptions): Promise<void> => {
  const tx = getTransporter();
  const from = `"${env.MAIL_FROM_NAME}" <${env.SMTP_USER || env.MAIL_FROM_EMAIL}>`;

  if (!tx) {
    logger.warn(`[MAIL:DEV] SMTP not configured. Email to ${to} not sent. Subject: ${subject}`);
    if (devOtpFallback) logger.warn(`[MAIL:DEV] OTP for ${to}: ${devOtpFallback}`);
    return;
  }

  try {
    await tx.sendMail({ from, to, subject, html, text });
    if (!isProduction) logger.debug(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    logger.error('SMTP send failed', error);
    if (isDevelopment && devOtpFallback) {
      logger.warn(`[MAIL:DEV] Delivery failed — use this OTP for ${to}: ${devOtpFallback}`);
      return;
    }
    throw error;
  }
};

export const buildOtpEmail = (otp: string, purposeLabel: string): { subject: string; html: string; text: string } => {
  const subject = `Your ${purposeLabel} code: ${otp}`;
  const text = `Your ${purposeLabel} verification code is ${otp}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`;
  const html = `
  <div style="background:#0a0a0a;padding:40px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#111111;border:1px solid #1f1f1f;border-radius:16px;padding:40px;">
      <h1 style="color:#ffffff;font-size:22px;margin:0 0 8px;">Verify your account</h1>
      <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Use the 6-digit code below to complete your ${purposeLabel.toLowerCase()}. This code expires in ${env.OTP_EXPIRY_MINUTES} minutes.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;font-size:34px;letter-spacing:12px;font-weight:700;color:#A3FF12;background:#0a0a0a;border:1px solid #1f1f1f;border-radius:12px;padding:18px 24px;">
          ${otp}
        </span>
      </div>
      <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:24px 0 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>`;
  return { subject, html, text };
};

interface InviteAdminEmailOptions {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
  personalMessage?: string;
}

const INVITE_PROFILE_BENEFITS_MESSAGE =
  'Update your profile details to access full benefits.';

/** Branded admin invite email with login credentials. */
export const buildInviteAdminEmail = ({
  name,
  email,
  password,
  loginUrl,
  personalMessage,
}: InviteAdminEmailOptions): { subject: string; html: string; text: string } => {
  const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const subject = 'You have been invited to Autodhun Admin';
  const customNote = personalMessage?.trim();
  const safeCustomNote = customNote ? escapeHtml(customNote) : '';
  const customNoteBlock = safeCustomNote
    ? `<p style="color:#9ca3af;font-size:13px;line-height:1.7;margin:0 0 16px;">${safeCustomNote}</p>`
    : '';
  const profileBenefitsBlock = `<p style="color:#d1d5db;font-size:14px;line-height:1.7;margin:0 0 20px;padding:16px;border-left:3px solid #A3FF12;background:#0d0d0d;border-radius:8px;">${INVITE_PROFILE_BENEFITS_MESSAGE}</p>`;

  const text = [
    `Hi ${name},`,
    '',
    INVITE_PROFILE_BENEFITS_MESSAGE,
    customNote ? `\n${customNote}` : '',
    '',
    'You have been invited as an Admin on Autodhun.',
    `Login URL: ${loginUrl}`,
    `Email: ${email}`,
    `Temporary password: ${password}`,
  ].join('\n');

  const html = `
  <div style="background:#0a0a0a;padding:40px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#111111;border:1px solid #1f1f1f;border-radius:16px;padding:40px;">
      <h1 style="color:#ffffff;font-size:22px;margin:0 0 8px;">Welcome to Autodhun Admin</h1>
      <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Hi ${name}, you have been invited as an <strong style="color:#A3FF12;">Admin</strong>. Use the credentials below to sign in.
      </p>
      ${profileBenefitsBlock}
      ${customNoteBlock}
      <div style="background:#0a0a0a;border:1px solid #1f1f1f;border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="margin:0 0 10px;color:#9ca3af;font-size:13px;"><strong style="color:#fff;">Login URL:</strong> <a href="${loginUrl}" style="color:#A3FF12;">${loginUrl}</a></p>
        <p style="margin:0 0 10px;color:#9ca3af;font-size:13px;"><strong style="color:#fff;">Email:</strong> ${email}</p>
        <p style="margin:0;color:#9ca3af;font-size:13px;"><strong style="color:#fff;">Password:</strong> <span style="color:#A3FF12;font-weight:700;">${password}</span></p>
      </div>
      <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;">
        If you did not expect this invite, contact your administrator.
      </p>
    </div>
  </div>`;

  return { subject, html, text };
};
