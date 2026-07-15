import { env } from '@/config/env';
import { ISupportTicket } from '@/modules/support-ticket/support-ticket.model';
import { NOTIFICATION_TYPE } from './notification.model';
import { notificationRepository } from './notification.repository';
import {
  buildSupportTicketCreatedEmail,
  buildSupportTicketStatusUpdatedEmail,
  sendMail,
} from '@/utils/email';
import { logger } from '@/config/logger';
import type { SupportTicketStatus } from '@/modules/support-ticket/support-ticket.constants';
import { SUPPORT_TICKET_ISSUE_TYPE_LABELS } from '@/modules/support-ticket/support-ticket.constants';
import { findOversightRecipients } from './notification-recipients';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  isSubAdmin?: boolean;
  name?: string;
}

const HELP_SUPPORT_MODULE = {
  slug: 'help-support',
  name: 'Help & Support',
  route: '/dashboard/help-support',
} as const;

function resolveOwner(createdBy: unknown): { id: string; name: string; email: string } | null {
  if (!createdBy || typeof createdBy !== 'object' || !('_id' in createdBy)) return null;

  const owner = createdBy as { _id: { toString(): string }; name?: string; email?: string };
  const email = owner.email?.trim();
  if (!email) return null;

  return {
    id: owner._id.toString(),
    name: owner.name?.trim() || 'Admin',
    email,
  };
}

function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

function formatIssueTypeLabel(issueType: string): string {
  return SUPPORT_TICKET_ISSUE_TYPE_LABELS[issueType as keyof typeof SUPPORT_TICKET_ISSUE_TYPE_LABELS] ?? issueType;
}

function buildTicketRoute(ticketId: string): string {
  return `${HELP_SUPPORT_MODULE.route}/${ticketId}`;
}

function buildTicketDashboardUrl(ticketId: string): string {
  const base = env.CLIENT_URL.replace(/\/$/, '');
  return `${base}${buildTicketRoute(ticketId)}`;
}

class SupportTicketNotificationsService {
  async notifyTicketCreated(ticket: ISupportTicket, actor: Actor): Promise<void> {
    if (actor.isSuperAdmin) return;

    const ticketId = ticket._id.toString();
    const creatorName = actor.name ?? 'Admin';
    const summary = {
      ticketNumber: String(ticket.ticketNumber),
      subject: ticket.subject,
      category: ticket.category,
      issueType: ticket.issueType,
      status: ticket.status,
    };

    try {
      const recipients = await findOversightRecipients(actor.id, HELP_SUPPORT_MODULE.slug);
      if (recipients.length === 0) return;

      const payloads = recipients.map((recipient) => ({
        recipient: recipient.id as never,
        type: NOTIFICATION_TYPE.SUPPORT_TICKET_CREATED,
        moduleSlug: HELP_SUPPORT_MODULE.slug,
        moduleName: HELP_SUPPORT_MODULE.name,
        entryId: ticketId,
        route: buildTicketRoute(ticketId),
        title: 'New support request',
        message: `${creatorName} submitted a new support request (#${ticket.ticketNumber}).`,
        entrySummary: summary,
        actor: actor.id as never,
      }));

      await notificationRepository.createMany(payloads);
    } catch (error) {
      logger.error('Failed to notify reviewers of new support ticket', { error });
    }

    try {
      const recipients = await findOversightRecipients(actor.id, HELP_SUPPORT_MODULE.slug);
      await Promise.all(
        recipients.filter((recipient) => Boolean(recipient.email)).map(async (recipient) => {
          const { subject, html, text } = buildSupportTicketCreatedEmail({
            recipientName: recipient.name,
            ticketNumber: ticket.ticketNumber,
            subjectLine: ticket.subject,
            ticketType: formatIssueTypeLabel(ticket.issueType),
            creatorName,
            dashboardUrl: buildTicketDashboardUrl(ticketId),
          });
          await sendMail({ to: recipient.email, subject, html, text });
        }),
      );
    } catch (error) {
      logger.error('Failed to email reviewers of new support ticket', { error });
    }
  }

  async notifyTicketStatusUpdated(
    ticket: ISupportTicket,
    newStatus: SupportTicketStatus,
    actor: Actor,
    summary: Record<string, string> = {},
    resolutionNote?: string,
  ): Promise<void> {
    if (!actor.isSuperAdmin && !actor.isSubAdmin) return;

    const owner = resolveOwner(ticket.createdBy);
    if (!owner || owner.id === actor.id) return;

    const ticketId = ticket._id.toString();
    const statusLabel = formatStatusLabel(newStatus);

    try {
      await notificationRepository.create({
        recipient: owner.id as never,
        type: NOTIFICATION_TYPE.SUPPORT_TICKET_STATUS_UPDATED,
        moduleSlug: HELP_SUPPORT_MODULE.slug,
        moduleName: HELP_SUPPORT_MODULE.name,
        entryId: ticketId,
        route: buildTicketRoute(ticketId),
        title: 'Support ticket updated',
        message: `Your support request #${ticket.ticketNumber} was updated to ${statusLabel}.`,
        entrySummary: { ...summary, status: newStatus },
        actor: actor.id as never,
      });
    } catch (error) {
      logger.error('Failed to notify admin of support ticket status update', { error });
    }

    try {
      const { subject, html, text } = buildSupportTicketStatusUpdatedEmail({
        recipientName: owner.name,
        ticketNumber: ticket.ticketNumber,
        subjectLine: ticket.subject,
        statusLabel,
        resolutionNote,
        dashboardUrl: buildTicketDashboardUrl(ticketId),
      });
      await sendMail({ to: owner.email, subject, html, text });
    } catch (error) {
      logger.error('Failed to email admin of support ticket status update', { error });
    }
  }
}

export const supportTicketNotificationsService = new SupportTicketNotificationsService();
