import { ROLES, USER_STATUS } from '@/constants';
import { env } from '@/config/env';
import { LabelTransferModel } from '@/modules/label-transfer/label-transfer.model';
import { ReleaseLabelModel } from '@/modules/release-catalog/release-label.model';
import { LABEL_STATUS } from '@/modules/release-catalog/release-catalog.constants';
import { roleRepository } from '@/modules/role/role.repository';
import { UserModel } from '@/modules/user/user.model';
import { NOTIFICATION_TYPE } from '@/modules/notification/notification.model';
import { notificationRepository } from '@/modules/notification/notification.repository';
import { ApiError } from '@/utils/ApiError';
import { buildLabelTransferEmail, sendMail } from '@/utils/email';
import { ensureLabelOwnershipBackfill, findActiveAdminUsers } from '@/utils/labelOwnership';
import { logger } from '@/config/logger';
import { TransferLabelDto } from './label-transfer.validator';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  name?: string;
}

export interface LabelTransferOverviewLabel {
  id: string;
  name: string;
  createdAt: string;
}

export interface LabelTransferOverviewAdmin {
  id: string;
  name: string;
  email: string;
  labels: LabelTransferOverviewLabel[];
}

class LabelTransferService {
  async getOverview(actor: Actor): Promise<{ admins: LabelTransferOverviewAdmin[] }> {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can view label transfer overview');
    }

    await ensureLabelOwnershipBackfill();

    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) return { admins: [] };

    const [admins, labels] = await Promise.all([
      UserModel.find({ role: adminRole._id, status: USER_STATUS.ACTIVE })
        .select('name email')
        .sort({ name: 1 })
        .lean(),
      ReleaseLabelModel.find({ status: LABEL_STATUS.ACTIVE })
        .select('name ownedBy createdAt')
        .sort({ name: 1 })
        .lean(),
    ]);

    const labelsByOwner = new Map<string, LabelTransferOverviewLabel[]>();
    for (const label of labels) {
      const ownerId = String(label.ownedBy);
      const bucket = labelsByOwner.get(ownerId) ?? [];
      bucket.push({
        id: label._id.toString(),
        name: label.name,
        createdAt: label.createdAt.toISOString(),
      });
      labelsByOwner.set(ownerId, bucket);
    }

    return {
      admins: admins.map((admin) => {
        const id = admin._id.toString();
        return {
          id,
          name: admin.name?.trim() || admin.email,
          email: admin.email,
          labels: labelsByOwner.get(id) ?? [],
        };
      }),
    };
  }

  async transfer(dto: TransferLabelDto, actor: Actor) {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can transfer labels');
    }

    await ensureLabelOwnershipBackfill();

    const label = await ReleaseLabelModel.findById(dto.labelId).exec();
    if (!label) throw ApiError.notFound('Label not found');
    if (label.status !== LABEL_STATUS.ACTIVE) {
      throw ApiError.badRequest('Only active labels can be transferred');
    }

    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) throw ApiError.badRequest('Admin role is not configured');

    const recipient = await UserModel.findOne({
      _id: dto.toUserId,
      role: adminRole._id,
      status: USER_STATUS.ACTIVE,
    })
      .select('name email')
      .exec();

    if (!recipient) throw ApiError.badRequest('Recipient must be an active Admin user');

    const fromUserId = label.ownedBy.toString();
    if (fromUserId === dto.toUserId) {
      throw ApiError.badRequest('Label is already owned by this admin');
    }

    const [fromUser, transferredBy] = await Promise.all([
      UserModel.findById(fromUserId).select('name email').lean(),
      UserModel.findById(actor.id).select('name email').lean(),
    ]);

    label.ownedBy = recipient._id;
    await label.save();

    await LabelTransferModel.create({
      label: label._id,
      labelName: label.name,
      fromUser: fromUserId,
      toUser: recipient._id,
      transferredBy: actor.id,
    });

    const recipientName = recipient.name?.trim() || recipient.email;
    const fromName = fromUser?.name?.trim() || fromUser?.email || 'Previous owner';
    const dashboardUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/dashboard/assets/label-transfer`;

    try {
      const { subject, html, text } = buildLabelTransferEmail({
        recipientName,
        labelName: label.name,
        fromAdminName: fromName,
        transferredByName: transferredBy?.name?.trim() || actor.name || 'Super Admin',
        dashboardUrl,
      });

      await sendMail({ to: recipient.email, subject, html, text });
    } catch (error) {
      logger.error('Failed to email recipient of label transfer', { labelId: label._id, error });
    }

    try {
      await notificationRepository.create({
        recipient: recipient._id as never,
        type: NOTIFICATION_TYPE.LABEL_TRANSFERRED,
        moduleSlug: 'label-transfer',
        moduleName: 'Label Transfer',
        entryId: label._id.toString(),
        route: '/dashboard/assets/label-transfer',
        title: 'Label transferred to you',
        message: `The label "${label.name}" has been transferred to your account.`,
        entrySummary: {
          labelName: label.name,
          fromAdmin: fromName,
        },
        actor: actor.id as never,
      });
    } catch (error) {
      logger.error('Failed to notify recipient of label transfer', { labelId: label._id, error });
    }

    const populated = await ReleaseLabelModel.findById(label._id)
      .populate('ownedBy', 'name email')
      .populate('createdBy', 'name email')
      .lean();

    return populated;
  }

  async listRecipientOptions(actor: Actor) {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can list transfer recipients');
    }

    return findActiveAdminUsers();
  }
}

export const labelTransferService = new LabelTransferService();
