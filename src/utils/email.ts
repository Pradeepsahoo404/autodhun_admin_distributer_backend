import { Resend } from 'resend';
import { env, isDevelopment, isProduction } from '@/config/env';
import { logger } from '@/config/logger';

let resend: Resend | null = null;

const getResend = (): Resend | null => {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
};

const getFromAddress = (): string => {
  if (env.MAIL_FROM) return env.MAIL_FROM;
  return `${env.MAIL_FROM_NAME} <${env.MAIL_FROM_EMAIL}>`;
};

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Logged to console in development when email delivery fails. */
  devOtpFallback?: string;
}

export const sendMail = async ({
  to,
  subject,
  html,
  text,
  devOtpFallback,
}: SendMailOptions): Promise<void> => {
  const client = getResend();
  const from = getFromAddress();

  if (!client) {
    logger.warn(`[MAIL:DEV] Resend not configured. Email to ${to} not sent. Subject: ${subject}`);
    if (devOtpFallback) logger.warn(`[MAIL:DEV] OTP for ${to}: ${devOtpFallback}`);
    return;
  }

  try {
    const { error } = await client.emails.send({ from, to, subject, html, text });
    if (error) throw error;
    if (!isProduction) logger.debug(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    logger.error('Resend send failed', error);
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

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const RELEASE_STATUS_EMAIL_CONTENT: Record<
  string,
  { headline: string; message: string; badgeColor: string; badgeTextColor: string; ctaLabel: string }
> = {
  in_review: {
    headline: 'Release Under Review',
    message:
      'Your release is now in review. Our content team is reviewing your submission and will update you when the status changes.',
    badgeColor: '#eab308',
    badgeTextColor: '#000000',
    ctaLabel: 'Open Dashboard',
  },
  correction: {
    headline: 'Correction Required',
    message:
      'Your release requires corrections before it can move forward. Please sign in, review your release, make the necessary updates, and resubmit.',
    badgeColor: '#f97316',
    badgeTextColor: '#ffffff',
    ctaLabel: 'Review & Fix Release',
  },
  qc_approval: {
    headline: 'QC Approved',
    message:
      'Great news! Your release has passed quality control and is approved. It will proceed toward going live on your selected platforms.',
    badgeColor: '#a855f7',
    badgeTextColor: '#ffffff',
    ctaLabel: 'View in Assets',
  },
  live: {
    headline: 'Your Release is Live!',
    message:
      'Congratulations! Your release is now live. You can view it in your Assets dashboard.',
    badgeColor: '#A3FF12',
    badgeTextColor: '#000000',
    ctaLabel: 'View Live Release',
  },
};

export interface ReleaseStatusUpdateEmailOptions {
  recipientName: string;
  releaseTitle: string;
  artist: string;
  label: string;
  statusKey: string;
  statusLabel: string;
  dashboardUrl: string;
  isrc?: string;
}

/** Branded email sent to release creator when Super Admin updates release status. */
export const buildReleaseStatusUpdateEmail = ({
  recipientName,
  releaseTitle,
  artist,
  label,
  statusKey,
  statusLabel,
  dashboardUrl,
  isrc,
}: ReleaseStatusUpdateEmailOptions): { subject: string; html: string; text: string } => {
  const content = RELEASE_STATUS_EMAIL_CONTENT[statusKey] ?? {
    headline: 'Release Status Updated',
    message: `Your release status has been updated to ${statusLabel}.`,
    badgeColor: '#A3FF12',
    badgeTextColor: '#000000',
    ctaLabel: 'Open Dashboard',
  };

  const safeTitle = escapeHtml(releaseTitle);
  const safeArtist = escapeHtml(artist);
  const safeLabel = escapeHtml(label);
  const safeName = escapeHtml(recipientName);
  const safeStatus = escapeHtml(statusLabel);
  const safeIsrc = isrc ? escapeHtml(isrc) : '';

  const subject = `Autodhun — "${releaseTitle}" status updated to ${statusLabel}`;

  const isrcRow = safeIsrc
    ? `<tr>
        <td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px;vertical-align:top;">ISRC</td>
        <td style="padding:8px 0;color:#ffffff;font-size:13px;vertical-align:top;">${safeIsrc}</td>
      </tr>`
    : '';

  const text = [
    `Hi ${recipientName},`,
    '',
    content.headline,
    '',
    content.message,
    '',
    'Release details:',
    `- Title: ${releaseTitle}`,
    `- Artist: ${artist}`,
    `- Label: ${label}`,
    `- Status: ${statusLabel}`,
    isrc ? `- ISRC: ${isrc}` : '',
    '',
    `View dashboard: ${dashboardUrl}`,
    '',
    '— Autodhun Admin',
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
  <div style="background:#0a0a0a;padding:40px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#111111;border:1px solid #1f1f1f;border-radius:16px;padding:40px;">
      <p style="margin:0 0 16px;color:#6b7280;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Autodhun Admin</p>
      <h1 style="color:#ffffff;font-size:22px;margin:0 0 8px;">${content.headline}</h1>
      <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 20px;">
        Hi ${safeName}, ${content.message}
      </p>

      <div style="margin:0 0 20px;">
        <span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${content.badgeColor};color:${content.badgeTextColor};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
          ${safeStatus}
        </span>
      </div>

      <div style="background:#0a0a0a;border:1px solid #1f1f1f;border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="margin:0 0 12px;color:#ffffff;font-size:13px;font-weight:700;">Release Details</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px;vertical-align:top;">Title</td>
            <td style="padding:8px 0;color:#ffffff;font-size:13px;vertical-align:top;">${safeTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Artist</td>
            <td style="padding:8px 0;color:#ffffff;font-size:13px;vertical-align:top;">${safeArtist}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Label</td>
            <td style="padding:8px 0;color:#ffffff;font-size:13px;vertical-align:top;">${safeLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Status</td>
            <td style="padding:8px 0;color:#ffffff;font-size:13px;vertical-align:top;">${safeStatus}</td>
          </tr>
          ${isrcRow}
        </table>
      </div>

      <div style="text-align:center;margin:0 0 24px;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#A3FF12;color:#000000;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 28px;">
          ${content.ctaLabel}
        </a>
      </div>

      <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;">
        This is an automated notification from Autodhun Admin. If you have questions about this update, contact your Super Admin.
      </p>
    </div>
  </div>`;

  return { subject, html, text };
};
