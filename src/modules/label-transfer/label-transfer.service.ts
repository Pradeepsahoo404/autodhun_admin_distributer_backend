import { ROLES, USER_STATUS } from '@/constants';
import { env } from '@/config/env';
import { LabelTransferModel, ILabelTransfer } from '@/modules/label-transfer/label-transfer.model';
import { ReleaseLabelModel } from '@/modules/release-catalog/release-label.model';
import { LABEL_STATUS } from '@/modules/release-catalog/release-catalog.constants';
import { roleRepository } from '@/modules/role/role.repository';
import { UserModel } from '@/modules/user/user.model';
import { NOTIFICATION_TYPE } from '@/modules/notification/notification.model';
import { notificationRepository } from '@/modules/notification/notification.repository';
import { ApiError } from '@/utils/ApiError';
import { buildLabelTransferEmail, sendMail } from '@/utils/email';
import { ensureLabelOwnershipBackfill, findActiveAdminUsers } from '@/utils/labelOwnership';
import {
  assertOwnedByAccess,
  canManagePlatformWorkflow,
  getScopeUserIds,
  type ScopeActor,
} from '@/utils/dataScope';
import { logger } from '@/config/logger';
import { TransferLabelDto, LabelTransferListQueryDto } from './label-transfer.validator';
import { PaginatedResult } from '@/types';
import { Types } from 'mongoose';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  isSubAdmin: boolean;
  roleSlug: string;
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
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can view label transfer overview');
    }

    await ensureLabelOwnershipBackfill();

    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) return { admins: [] };

    const adminFilter: Record<string, unknown> = {
      role: adminRole._id,
      status: USER_STATUS.ACTIVE,
    };
    if (actor.isSubAdmin) {
      adminFilter.createdBy = new Types.ObjectId(actor.id);
    }

    const scopeIds = await getScopeUserIds(actor as ScopeActor);
    const labelFilter: Record<string, unknown> = { status: LABEL_STATUS.ACTIVE };
    if (scopeIds) {
      labelFilter.ownedBy = { $in: scopeIds };
    }

    const [admins, labels] = await Promise.all([
      UserModel.find(adminFilter).select('name email').sort({ name: 1 }).lean(),
      ReleaseLabelModel.find(labelFilter).select('name ownedBy createdAt').sort({ name: 1 }).lean(),
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
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can transfer labels');
    }

    await ensureLabelOwnershipBackfill();

    const label = await ReleaseLabelModel.findById(dto.labelId).exec();
    if (!label) throw ApiError.notFound('Label not found');
    if (label.status !== LABEL_STATUS.ACTIVE) {
      throw ApiError.badRequest('Only active labels can be transferred');
    }
    await assertOwnedByAccess(actor as ScopeActor, label.ownedBy);

    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) throw ApiError.badRequest('Admin role is not configured');

    const recipientFilter: Record<string, unknown> = {
      _id: dto.toUserId,
      role: adminRole._id,
      status: USER_STATUS.ACTIVE,
    };
    if (actor.isSubAdmin) {
      recipientFilter.createdBy = new Types.ObjectId(actor.id);
    }

    const recipient = await UserModel.findOne(recipientFilter).select('name email').exec();

    if (!recipient) {
      throw ApiError.badRequest(
        actor.isSubAdmin
          ? 'Recipient must be an active Admin you created'
          : 'Recipient must be an active Admin user',
      );
    }

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
        transferredByName: transferredBy?.name?.trim() || actor.name || 'Admin',
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
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can list transfer recipients');
    }

    return findActiveAdminUsers(actor);
  }

  async listHistory(
    query: LabelTransferListQueryDto,
    actor: Actor,
  ): Promise<PaginatedResult<ILabelTransfer>> {
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can view label transfer history');
    }

    const filter: Record<string, unknown> = {};
    const scopeIds = await getScopeUserIds(actor as ScopeActor);

    if (scopeIds) {
      filter.$or = [
        { fromUser: { $in: scopeIds } },
        { toUser: { $in: scopeIds } },
        { transferredBy: actor.id },
      ];
    }

    if (query.search?.trim()) {
      const regex = { $regex: query.search.trim(), $options: 'i' };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or as unknown[] }, { labelName: regex }];
        delete filter.$or;
      } else {
        filter.labelName = regex;
      }
    }

    const [items, total] = await Promise.all([
      LabelTransferModel.find(filter)
        .populate('fromUser', 'name email')
        .populate('toUser', 'name email')
        .populate('transferredBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      LabelTransferModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}

export const labelTransferService = new LabelTransferService();
