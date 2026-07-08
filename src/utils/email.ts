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

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
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

interface WhiteEmailLayoutOptions {
  recipientName: string;
  /** HTML paragraph content (inner HTML only — escape dynamic values before passing). */
  paragraphs: string[];
  /** Plain-text note shown in the gray left-border box. */
  noteBlock?: string;
  /** Use `code` for OTP-style large centered digits. */
  noteBlockVariant?: 'default' | 'code';
  instruction?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  supportEmail?: string;
}

/** Shared Autodhun white email layout (Virgin Music–style). */
function buildWhiteEmailLayout({
  recipientName,
  paragraphs,
  noteBlock,
  noteBlockVariant = 'default',
  instruction,
  ctaLabel,
  ctaUrl,
  supportEmail = env.MAIL_FROM_EMAIL,
}: WhiteEmailLayoutOptions): string {
  const safeName = escapeHtml(recipientName);
  const safeSupport = escapeHtml(supportEmail);

  const paragraphsHtml = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 20px;color:#111111;font-size:15px;line-height:1.7;">${paragraph}</p>`,
    )
    .join('');

  const isCodeBlock = noteBlockVariant === 'code';
  const noteHtml = noteBlock?.trim()
    ? `<div style="margin:0 0 28px;padding:${isCodeBlock ? '24px 18px' : '16px 18px'};background:#f9f9f9;border-left:3px solid #111111;">
        <p style="margin:0;color:#111111;${
          isCodeBlock
            ? 'font-size:36px;font-weight:700;letter-spacing:12px;line-height:1.3;text-align:center;'
            : 'font-size:14px;line-height:1.7;white-space:pre-wrap;'
        }">
          ${escapeHtml(noteBlock.trim()).replace(/\n/g, isCodeBlock ? '' : '<br/>')}
        </p>
      </div>`
    : '';

  const instructionHtml = instruction
    ? `<p style="margin:0 0 24px;color:#111111;font-size:15px;line-height:1.7;">${instruction}</p>`
    : '';

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<p style="margin:0 0 28px;">
          <a href="${ctaUrl}" style="color:#111111;font-size:14px;font-weight:700;text-decoration:underline;">
            ${escapeHtml(ctaLabel)}
          </a>
        </p>`
      : '';

  return `
  <div style="background:#f4f4f4;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;padding:40px 36px;">
      <p style="margin:0 0 20px;color:#111111;font-size:15px;line-height:1.7;">
        Hi ${safeName},
      </p>
      ${paragraphsHtml}
      ${noteHtml}
      ${instructionHtml}
      ${ctaHtml}
      <p style="margin:0 0 8px;color:#111111;font-size:14px;line-height:1.6;">
        If you have questions please contact
        <a href="mailto:${safeSupport}" style="color:#111111;text-decoration:underline;">${safeSupport}</a>.
      </p>
      <p style="margin:0;color:#111111;font-size:14px;line-height:1.6;">
        — The Autodhun Team
      </p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 24px;" />
      <p style="margin:0;text-align:center;color:#888888;font-size:12px;line-height:1.5;">
        You are receiving this email because you are an Autodhun user.
      </p>
    </div>
  </div>`;
}

function buildWhiteEmailText({
  recipientName,
  paragraphs,
  noteBlock,
  instruction,
  ctaLabel,
  ctaUrl,
  supportEmail = env.MAIL_FROM_EMAIL,
}: WhiteEmailLayoutOptions): string {
  return [
    `Hi ${recipientName},`,
    '',
    ...paragraphs.map((p) => p.replace(/<[^>]+>/g, '')),
    '',
    noteBlock?.trim() ? noteBlock.trim() : '',
    noteBlock?.trim() ? '' : null,
    instruction ?? '',
    instruction ? '' : null,
    ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : null,
    ctaLabel && ctaUrl ? '' : null,
    `If you have questions please contact ${supportEmail}.`,
    '',
    '— The Autodhun Team',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export const buildOtpEmail = (otp: string, purposeLabel: string): { subject: string; html: string; text: string } => {
  const subject = `Your ${purposeLabel} code: ${otp}`;
  const text = [
    'Hi,',
    '',
    `Use the code below to complete your ${purposeLabel.toLowerCase()}. This code expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
    '',
    otp,
    '',
    "If you didn't request this, you can safely ignore this email.",
    '',
    `If you have questions please contact ${env.MAIL_FROM_EMAIL}.`,
    '',
    '— The Autodhun Team',
  ].join('\n');

  const html = buildWhiteEmailLayout({
    recipientName: 'there',
    paragraphs: [
      `Use the code below to complete your ${escapeHtml(purposeLabel.toLowerCase())}. This code expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
    ],
    noteBlock: otp,
    noteBlockVariant: 'code',
    instruction: "If you didn't request this, you can safely ignore this email.",
  });

  return { subject, html, text };
};

interface PasswordUpdatedEmailOptions {
  recipientName: string;
  loginUrl: string;
  supportEmail?: string;
}

export const buildPasswordUpdatedEmail = ({
  recipientName,
  loginUrl,
  supportEmail,
}: PasswordUpdatedEmailOptions): { subject: string; html: string; text: string } => {
  const subject = 'Your Autodhun password has been updated';

  const layoutOptions: WhiteEmailLayoutOptions = {
    recipientName,
    paragraphs: ['Your password has been successfully updated.'],
    instruction:
      'If you did not make this change, please contact us immediately so we can help secure your account.',
    ctaLabel: 'Sign in to Autodhun',
    ctaUrl: loginUrl,
    supportEmail,
  };

  return {
    subject,
    html: buildWhiteEmailLayout(layoutOptions),
    text: buildWhiteEmailText(layoutOptions),
  };
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

export const buildInviteAdminEmail = ({
  name,
  email,
  password,
  loginUrl,
  personalMessage,
}: InviteAdminEmailOptions): { subject: string; html: string; text: string } => {
  const subject = 'You have been invited to Autodhun Admin';
  const customNote = personalMessage?.trim();
  const credentialsNote = [
    customNote ?? '',
    customNote ? '' : null,
    INVITE_PROFILE_BENEFITS_MESSAGE,
    '',
    `Login URL: ${loginUrl}`,
    `Email: ${email}`,
    `Password: ${password}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const layoutOptions: WhiteEmailLayoutOptions = {
    recipientName: name,
    paragraphs: [
      'You have been invited as an <strong>Admin</strong> on Autodhun. Use the credentials below to sign in.',
    ],
    noteBlock: credentialsNote,
    instruction: 'Please sign in and update your profile to access full benefits.',
    ctaLabel: 'Sign in to Autodhun Admin',
    ctaUrl: loginUrl,
  };

  const text = buildWhiteEmailText(layoutOptions);
  const html = buildWhiteEmailLayout(layoutOptions);

  return { subject, html, text };
};

const RELEASE_STATUS_EMAIL_CONTENT: Record<
  string,
  { introSuffix: string; instruction: string; ctaLabel: string }
> = {
  in_review: {
    introSuffix:
      'is now in review. Our content team is reviewing your submission and will update you when the status changes.',
    instruction: 'Please sign in to track your release status in the dashboard.',
    ctaLabel: 'Open dashboard',
  },
  correction: {
    introSuffix: 'has been sent back for correction.',
    instruction:
      'Please sign in, review your release, make the necessary updates, and resubmit.',
    ctaLabel: 'Review & fix release',
  },
  takedown: {
    introSuffix:
      'has been marked for takedown and is no longer moving through the review pipeline.',
    instruction: 'Please sign in to review your release in the Assets dashboard.',
    ctaLabel: 'View release',
  },
  qc_approval: {
    introSuffix:
      'has passed quality control and is approved. It will proceed toward going live on your selected platforms.',
    instruction: 'Please sign in to view your release in the Assets dashboard.',
    ctaLabel: 'View in Assets',
  },
  live: {
    introSuffix: 'is now live. You can view it in your Assets dashboard.',
    instruction: 'Please sign in to view your live release.',
    ctaLabel: 'View live release',
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
  correctionReasons?: string[];
}

export interface ReleaseCorrectionEmailOptions {
  recipientName: string;
  releaseTitle: string;
  artist: string;
  label: string;
  reasons: string[];
  dashboardUrl: string;
  supportEmail?: string;
}

/** White correction email with a descriptive note block. */
export const buildReleaseCorrectionEmail = ({
  recipientName,
  releaseTitle,
  artist,
  label,
  reasons,
  dashboardUrl,
  supportEmail,
}: ReleaseCorrectionEmailOptions): { subject: string; html: string; text: string } => {
  const safeTitle = escapeHtml(releaseTitle);
  const safeArtist = escapeHtml(artist);
  const safeLabel = escapeHtml(label);

  const noteBody = reasons.join('\n\n').trim();
  const subject = `Autodhun — "${releaseTitle}" requires correction`;

  const layoutOptions: WhiteEmailLayoutOptions = {
    recipientName,
    paragraphs: [
      `Your recent submission <strong>${safeTitle}</strong> by ${safeArtist} on ${safeLabel} has been sent back for correction.`,
    ],
    noteBlock: noteBody,
    instruction:
      'Please sign in, review your release, make the necessary updates, and resubmit.',
    ctaLabel: 'Review & fix release',
    ctaUrl: dashboardUrl,
    supportEmail,
  };

  return {
    subject,
    html: buildWhiteEmailLayout(layoutOptions),
    text: buildWhiteEmailText(layoutOptions),
  };
};

export const buildReleaseStatusUpdateEmail = ({
  recipientName,
  releaseTitle,
  artist,
  label,
  statusKey,
  statusLabel,
  dashboardUrl,
  correctionReasons,
}: ReleaseStatusUpdateEmailOptions): { subject: string; html: string; text: string } => {
  if (statusKey === 'correction' && correctionReasons?.length) {
    return buildReleaseCorrectionEmail({
      recipientName,
      releaseTitle,
      artist,
      label,
      reasons: correctionReasons,
      dashboardUrl,
    });
  }

  const content = RELEASE_STATUS_EMAIL_CONTENT[statusKey] ?? {
    introSuffix: `status has been updated to ${statusLabel}.`,
    instruction: 'Please sign in to review your release in the dashboard.',
    ctaLabel: 'Open dashboard',
  };

  const safeTitle = escapeHtml(releaseTitle);
  const safeArtist = escapeHtml(artist);
  const safeLabel = escapeHtml(label);

  const subject = `Autodhun — "${releaseTitle}" status updated to ${statusLabel}`;

  const layoutOptions: WhiteEmailLayoutOptions = {
    recipientName,
    paragraphs: [
      `Your recent submission <strong>${safeTitle}</strong> by ${safeArtist} on ${safeLabel} ${content.introSuffix}`,
    ],
    instruction: content.instruction,
    ctaLabel: content.ctaLabel,
    ctaUrl: dashboardUrl,
  };

  return {
    subject,
    html: buildWhiteEmailLayout(layoutOptions),
    text: buildWhiteEmailText(layoutOptions),
  };
};

export interface LabelTransferEmailOptions {
  recipientName: string;
  labelName: string;
  fromAdminName: string;
  transferredByName: string;
  dashboardUrl: string;
}

interface LabelUpdateEmailOptions {
  recipientName: string;
  previousName: string;
  newName: string;
  updatedByName: string;
  dashboardUrl: string;
}

export const buildLabelUpdateEmail = ({
  recipientName,
  previousName,
  newName,
  updatedByName,
  dashboardUrl,
}: LabelUpdateEmailOptions): { subject: string; html: string; text: string } => {
  const safePrevious = escapeHtml(previousName);
  const safeNew = escapeHtml(newName);
  const subject = `Autodhun — Your label "${newName}" has been updated`;

  const layoutOptions: WhiteEmailLayoutOptions = {
    recipientName,
    paragraphs: [
      `Your label name has been updated by a Super Admin. The label previously known as <strong>${safePrevious}</strong> is now <strong>${safeNew}</strong>.`,
      'This change applies across releases and catalog modules linked to this label.',
    ],
    noteBlock: [`Previous name: ${previousName}`, `New name: ${newName}`, `Updated by: ${updatedByName}`].join('\n'),
    instruction: 'Please sign in to review your labels and releases.',
    ctaLabel: 'View your labels',
    ctaUrl: dashboardUrl,
  };

  return {
    subject,
    html: buildWhiteEmailLayout(layoutOptions),
    text: buildWhiteEmailText(layoutOptions),
  };
};

export const buildLabelTransferEmail = ({
  recipientName,
  labelName,
  fromAdminName,
  transferredByName,
  dashboardUrl,
}: LabelTransferEmailOptions): { subject: string; html: string; text: string } => {
  const safeLabel = escapeHtml(labelName);
  const subject = `Autodhun — Label "${labelName}" transferred to you`;

  const layoutOptions: WhiteEmailLayoutOptions = {
    recipientName,
    paragraphs: [
      `The label <strong>${safeLabel}</strong> has been transferred to your account. You now have exclusive access to use it across releases and rights modules.`,
    ],
    noteBlock: [`Previous owner: ${fromAdminName}`, `Transferred by: ${transferredByName}`].join('\n'),
    instruction: 'Please sign in to manage your labels and releases.',
    ctaLabel: 'Open label transfer',
    ctaUrl: dashboardUrl,
  };

  return {
    subject,
    html: buildWhiteEmailLayout(layoutOptions),
    text: buildWhiteEmailText(layoutOptions),
  };
};
