import { Types } from 'mongoose';
import { ROLES, USER_STATUS } from '@/constants';
import { UserModel } from '@/modules/user/user.model';
import { RoleModel } from '@/modules/role/role.model';

/**
 * Active elevated notification recipients.
 * - With `tenantId`: Super Admins for that tenant + all Master Admins.
 * - Without: all Master + Super Admin (legacy platform broadcast).
 */
export async function findElevatedRecipientIds(tenantId?: string | null): Promise<string[]> {
  const roles = await RoleModel.find({
    slug: { $in: [ROLES.MASTER_ADMIN, ROLES.SUPER_ADMIN] },
  })
    .select('_id slug')
    .lean()
    .exec();

  if (roles.length === 0) return [];

  const masterRole = roles.find((r) => r.slug === ROLES.MASTER_ADMIN);
  const superAdminRole = roles.find((r) => r.slug === ROLES.SUPER_ADMIN);

  if (tenantId) {
    const or: Record<string, unknown>[] = [];
    if (masterRole) {
      or.push({ role: masterRole._id });
    }
    if (superAdminRole) {
      or.push({
        role: superAdminRole._id,
        tenantId: new Types.ObjectId(tenantId),
      });
    }
    if (or.length === 0) return [];

    const users = await UserModel.find({
      status: USER_STATUS.ACTIVE,
      $or: or,
    })
      .select('_id')
      .lean()
      .exec();

    return users.map((u) => u._id.toString());
  }

  const users = await UserModel.find({
    role: { $in: roles.map((r) => r._id) },
    status: USER_STATUS.ACTIVE,
  })
    .select('_id')
    .lean()
    .exec();

  return users.map((u) => u._id.toString());
}

export async function findElevatedRecipients(
  tenantId?: string | null,
): Promise<Array<{ id: string; name: string; email: string }>> {
  const roles = await RoleModel.find({
    slug: { $in: [ROLES.MASTER_ADMIN, ROLES.SUPER_ADMIN] },
  })
    .select('_id slug')
    .lean()
    .exec();

  if (roles.length === 0) return [];

  const masterRole = roles.find((r) => r.slug === ROLES.MASTER_ADMIN);
  const superAdminRole = roles.find((r) => r.slug === ROLES.SUPER_ADMIN);

  let users;
  if (tenantId) {
    const or: Record<string, unknown>[] = [];
    if (masterRole) {
      or.push({ role: masterRole._id });
    }
    if (superAdminRole) {
      or.push({
        role: superAdminRole._id,
        tenantId: new Types.ObjectId(tenantId),
      });
    }
    if (or.length === 0) return [];

    users = await UserModel.find({
      status: USER_STATUS.ACTIVE,
      $or: or,
    })
      .select('_id name email')
      .exec();
  } else {
    users = await UserModel.find({
      role: { $in: roles.map((r) => r._id) },
      status: USER_STATUS.ACTIVE,
    })
      .select('_id name email')
      .exec();
  }

  return users
    .filter((user) => Boolean(user.email))
    .map((user) => ({
      id: user._id.toString(),
      name: user.name || 'Admin',
      email: user.email,
    }));
}
