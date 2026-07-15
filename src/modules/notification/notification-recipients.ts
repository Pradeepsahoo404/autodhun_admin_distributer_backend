import { ROLES, USER_STATUS } from '@/constants';
import { permissionService } from '@/modules/permission/permission.service';
import { roleRepository } from '@/modules/role/role.repository';
import { UserModel } from '@/modules/user/user.model';

export interface OversightRecipient {
  id: string;
  name: string;
  email: string;
}

/**
 * Returns all active Super Admins plus the actor's active parent Sub Admin.
 * The parent is included only when they have view access to the notification's
 * module, keeping Sub Admin notifications limited to their invited Admins.
 */
export async function findOversightRecipients(
  actorId: string,
  moduleSlug: string,
): Promise<OversightRecipient[]> {
  const [superAdminRole, subAdminRole, actor] = await Promise.all([
    roleRepository.findBySlug(ROLES.SUPER_ADMIN),
    roleRepository.findBySlug(ROLES.SUB_ADMIN),
    UserModel.findById(actorId).select('createdBy').lean(),
  ]);

  const recipients: OversightRecipient[] = [];

  if (superAdminRole) {
    const superAdmins = await UserModel.find({
      role: superAdminRole._id,
      status: USER_STATUS.ACTIVE,
    })
      .select('_id name email')
      .lean();

    recipients.push(
      ...superAdmins.map((user) => ({
        id: user._id.toString(),
        name: user.name?.trim() || 'Super Admin',
        email: user.email?.trim() || '',
      })),
    );
  }

  if (actor?.createdBy && subAdminRole) {
    const parent = await UserModel.findOne({
      _id: actor.createdBy,
      role: subAdminRole._id,
      status: USER_STATUS.ACTIVE,
    })
      .select('_id name email role')
      .lean();

    if (
      parent &&
      (await permissionService.can(
        parent.role.toString(),
        ROLES.SUB_ADMIN,
        moduleSlug,
        'view',
        parent._id.toString(),
      ))
    ) {
      recipients.push({
        id: parent._id.toString(),
        name: parent.name?.trim() || 'Sub Admin',
        email: parent.email?.trim() || '',
      });
    }
  }

  return [
    ...new Map(
      recipients
        .filter((recipient) => recipient.id !== actorId)
        .map((recipient) => [recipient.id, recipient]),
    ).values(),
  ];
}

export async function findOversightRecipientIds(
  actorId: string,
  moduleSlug: string,
): Promise<string[]> {
  return (await findOversightRecipients(actorId, moduleSlug)).map(({ id }) => id);
}
