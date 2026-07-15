import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { UserModel } from '@/modules/user/user.model';
import { LabelUpdateModel, ILabelUpdate } from './label-update.model';
import { LabelUpdateListQueryDto } from './label-update.validator';
import { PaginatedResult } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { buildLabelUpdateEmail, sendMail } from '@/utils/email';
import { canManagePlatformWorkflow, getScopeUserIds, type ScopeActor } from '@/utils/dataScope';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  isSubAdmin: boolean;
  roleSlug: string;
}

interface RecordLabelUpdateInput {
  labelId: string;
  previousName: string;
  newName: string;
  ownerId: string;
  updatedById: string;
}

class LabelUpdateService {
  async recordUpdate(input: RecordLabelUpdateInput): Promise<void> {
    if (input.previousName.trim() === input.newName.trim()) return;

    await LabelUpdateModel.create({
      label: input.labelId,
      previousName: input.previousName.trim(),
      newName: input.newName.trim(),
      owner: input.ownerId,
      updatedBy: input.updatedById,
    });

    await this.notifyOwnerByEmail(input);
  }

  private async notifyOwnerByEmail(input: RecordLabelUpdateInput): Promise<void> {
    const [owner, updatedBy] = await Promise.all([
      UserModel.findById(input.ownerId).select('name email').lean(),
      UserModel.findById(input.updatedById).select('name email').lean(),
    ]);

    if (!owner?.email) return;

    const recipientName = owner.name?.trim() || owner.email;
    const updatedByName = updatedBy?.name?.trim() || updatedBy?.email || 'Super Admin';
    const dashboardUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/dashboard/assets/label-transfer`;

    try {
      const { subject, html, text } = buildLabelUpdateEmail({
        recipientName,
        previousName: input.previousName.trim(),
        newName: input.newName.trim(),
        updatedByName,
        dashboardUrl,
      });

      await sendMail({ to: owner.email, subject, html, text });
    } catch (error) {
      logger.error('Failed to email label owner after label update', {
        labelId: input.labelId,
        ownerId: input.ownerId,
        error,
      });
    }
  }

  async list(query: LabelUpdateListQueryDto, actor: Actor): Promise<PaginatedResult<ILabelUpdate>> {
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can view label update history');
    }

    const filter: Record<string, unknown> = {};
    const scopeIds = await getScopeUserIds(actor as ScopeActor);
    if (scopeIds) {
      filter.owner = { $in: scopeIds };
    }

    if (query.search?.trim()) {
      const regex = { $regex: query.search.trim(), $options: 'i' };
      filter.$or = [{ previousName: regex }, { newName: regex }];
    }

    const [items, total] = await Promise.all([
      LabelUpdateModel.find(filter)
        .populate('label', 'name status')
        .populate('owner', 'name email')
        .populate('updatedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      LabelUpdateModel.countDocuments(filter),
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

export const labelUpdateService = new LabelUpdateService();
