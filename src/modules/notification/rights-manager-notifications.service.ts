import { ROLES, USER_STATUS } from '@/constants';
import {
  buildEntrySummary,
  RIGHTS_MANAGER_MODULES,
  RightsManagerModuleSlug,
} from '@/constants/rightsManagerModules';
import { IUser } from '@/modules/user/user.model';
import { UserModel } from '@/modules/user/user.model';
import { roleRepository } from '@/modules/role/role.repository';
import { NOTIFICATION_TYPE } from './notification.model';
import { notificationRepository } from './notification.repository';
import { logger } from '@/config/logger';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  name?: string;
}

function resolveOwnerId(createdBy: unknown): string | null {
  if (!createdBy) return null;
  if (typeof createdBy === 'object' && createdBy !== null && '_id' in createdBy) {
    return String((createdBy as { _id: { toString(): string } })._id);
  }
  return String(createdBy);
}

function formatStatusLabel(status: string): string {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'active') return 'Active';
  if (status === 'inactive') return 'Deactive';
  return status;
}

class RightsManagerNotificationsService {
  private async findSuperAdminIds(): Promise<string[]> {
    const role = await roleRepository.findBySlug(ROLES.SUPER_ADMIN);
    if (!role) return [];

    const users = await UserModel.find({
      role: role._id,
      status: USER_STATUS.ACTIVE,
    })
      .select('_id')
      .exec();

    return users.map((u) => u._id.toString());
  }

  private buildRoute(moduleSlug: RightsManagerModuleSlug, entryId: string): string {
    const base = RIGHTS_MANAGER_MODULES[moduleSlug].route;
    return `${base}?entry=${entryId}`;
  }

  async notifyEntryCreated(
    moduleSlug: RightsManagerModuleSlug,
    entry: Record<string, unknown> & { _id: { toString(): string } },
    actor: Actor,
  ): Promise<void> {
    if (actor.isSuperAdmin) return;

    try {
      const config = RIGHTS_MANAGER_MODULES[moduleSlug];
      const entryId = entry._id.toString();
      const summary = buildEntrySummary(moduleSlug, entry);
      const creator = entry.createdBy as IUser | undefined;
      const creatorName =
        creator && typeof creator === 'object' && 'name' in creator ? creator.name : actor.name ?? 'Admin';

      const superAdminIds = await this.findSuperAdminIds();
      if (superAdminIds.length === 0) return;

      const payloads = superAdminIds.map((recipientId) => ({
        recipient: recipientId as never,
        type: NOTIFICATION_TYPE.RIGHTS_ENTRY_CREATED,
        moduleSlug,
        moduleName: config.name,
        entryId,
        route: this.buildRoute(moduleSlug, entryId),
        title: `New ${config.name} entry`,
        message: `${creatorName} submitted a new ${config.name} entry for review.`,
        entrySummary: summary,
        actor: actor.id as never,
      }));

      await notificationRepository.createMany(payloads);
    } catch (error) {
      logger.error('Failed to notify super admins of rights manager entry', { moduleSlug, error });
    }
  }

  async notifyStatusUpdated(
    moduleSlug: RightsManagerModuleSlug,
    entry: Record<string, unknown> & { _id: { toString(): string } },
    newStatus: string,
    actor: Actor,
  ): Promise<void> {
    if (!actor.isSuperAdmin) return;

    try {
      const ownerId = resolveOwnerId(entry.createdBy);
      if (!ownerId || ownerId === actor.id) return;

      const config = RIGHTS_MANAGER_MODULES[moduleSlug];
      const entryId = entry._id.toString();
      const summary = buildEntrySummary(moduleSlug, { ...entry, status: newStatus });
      const statusLabel = formatStatusLabel(newStatus);

      await notificationRepository.create({
        recipient: ownerId as never,
        type: NOTIFICATION_TYPE.RIGHTS_STATUS_UPDATED,
        moduleSlug,
        moduleName: config.name,
        entryId,
        route: this.buildRoute(moduleSlug, entryId),
        title: `${config.name} status updated`,
        message: `Your ${config.name} entry status was updated to ${statusLabel}.`,
        entrySummary: summary,
        actor: actor.id as never,
      });
    } catch (error) {
      logger.error('Failed to notify admin of rights manager status update', { moduleSlug, error });
    }
  }
}

export const rightsManagerNotificationsService = new RightsManagerNotificationsService();
