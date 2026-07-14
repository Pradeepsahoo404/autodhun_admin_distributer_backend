import { ROLES, USER_STATUS } from '@/constants';
import { ReleaseLabelModel } from '@/modules/release-catalog/release-label.model';
import { roleRepository } from '@/modules/role/role.repository';
import { UserModel } from '@/modules/user/user.model';
import { ApiError } from '@/utils/ApiError';
import { isPlatformMaster } from '@/utils/tenantScope';

export interface LabelAccessActor {
  id: string;
  isSuperAdmin: boolean;
  isMasterAdmin?: boolean;
  tenantId?: string | null;
  role?: string;
}

function normalizeLabelName(name: string): string {
  return name.trim().toLowerCase();
}

let ownershipBackfillPromise: Promise<void> | null = null;

/** Ensures legacy labels have ownedBy set from createdBy. */
export async function ensureLabelOwnershipBackfill(): Promise<void> {
  if (!ownershipBackfillPromise) {
    ownershipBackfillPromise = (async () => {
      const missing = await ReleaseLabelModel.find({
        $or: [{ ownedBy: { $exists: false } }, { ownedBy: null }],
      }).select('_id createdBy');

      if (missing.length === 0) return;

      await Promise.all(
        missing.map((label) =>
          ReleaseLabelModel.updateOne({ _id: label._id }, { $set: { ownedBy: label.createdBy } }),
        ),
      );
    })();
  }

  await ownershipBackfillPromise;
}

export async function assertLabelsAccessible(
  actor: LabelAccessActor,
  ...labelNames: Array<string | undefined | null>
): Promise<void> {
  if (Boolean(actor.isMasterAdmin) || isPlatformMaster({
    isMasterAdmin: actor.isMasterAdmin,
    role: actor.role ?? '',
  })) {
    return;
  }

  await ensureLabelOwnershipBackfill();

  const names = [...new Set(labelNames.map((name) => name?.trim()).filter(Boolean) as string[])];
  if (names.length === 0) return;

  const normalizedNames = names.map(normalizeLabelName);
  const filter: Record<string, unknown> = { normalizedName: { $in: normalizedNames } };
  if (actor.tenantId) {
    filter.tenantId = actor.tenantId;
  } else {
    throw ApiError.forbidden('Your account is not assigned to a tenant');
  }

  const labels = await ReleaseLabelModel.find(filter)
    .select('name normalizedName ownedBy status tenantId')
    .lean();

  const labelByNormalized = new Map(labels.map((label) => [label.normalizedName, label]));

  for (const name of names) {
    const label = labelByNormalized.get(normalizeLabelName(name));
    if (!label) {
      throw ApiError.badRequest(`Label "${name}" is not available. Create it from your release form first.`);
    }

    if (label.status && label.status !== 'active') {
      throw ApiError.forbidden(`Label "${name}" is blocked and cannot be used`);
    }

    // Super Admin: any active label in tenant. Admin: must own the label.
    if (actor.isSuperAdmin) continue;

    if (String(label.ownedBy) !== actor.id) {
      throw ApiError.forbidden(`You do not have access to label "${name}"`);
    }
  }
}

export async function findActiveAdminUsers(
  tenantId?: string | null,
): Promise<Array<{ _id: string; name: string; email: string }>> {
  const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
  if (!adminRole) return [];

  const filter: Record<string, unknown> = {
    role: adminRole._id,
    status: USER_STATUS.ACTIVE,
  };
  if (tenantId) {
    filter.tenantId = tenantId;
  }

  const users = await UserModel.find(filter)
    .select('name email')
    .sort({ name: 1 })
    .lean();

  return users.map((user) => ({
    _id: user._id.toString(),
    name: user.name?.trim() || user.email,
    email: user.email,
  }));
}
