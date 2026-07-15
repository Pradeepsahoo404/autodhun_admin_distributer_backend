import { Types } from 'mongoose';
import { ROLES } from '@/constants';
import { ApiError } from '@/utils/ApiError';
import { UserModel } from '@/modules/user/user.model';
import { roleRepository } from '@/modules/role/role.repository';

import { AuthUser } from '@/types/express';

/** Actor shape used for row-level data scoping across domain services. */
export interface ScopeActor {
  id: string;
  roleId?: string;
  roleSlug: string;
  isSuperAdmin: boolean;
  isSubAdmin: boolean;
  name?: string;
}

export function buildActorFromRequest(user: AuthUser): ScopeActor {
  return {
    id: user.id,
    roleId: user.roleId,
    roleSlug: user.role,
    isSuperAdmin: user.isSuperAdmin,
    isSubAdmin: user.isSubAdmin,
    name: user.name,
  };
}

export function resolveOwnerId(createdBy: unknown): string {
  if (!createdBy) return '';
  if (typeof createdBy === 'object' && createdBy !== null && '_id' in createdBy) {
    return String((createdBy as { _id: { toString(): string } })._id);
  }
  return String(createdBy);
}

/** Super Admin sees all rows; Sub Admin sees self + invited admins; Admin sees self only. */
export async function getScopeUserIds(actor: ScopeActor): Promise<string[] | null> {
  if (actor.isSuperAdmin) return null;

  if (actor.isSubAdmin) {
    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) return [actor.id];

    const childAdmins = await UserModel.find({
      role: adminRole._id,
      createdBy: new Types.ObjectId(actor.id),
    })
      .select('_id')
      .lean();

    return [actor.id, ...childAdmins.map((u) => u._id.toString())];
  }

  return [actor.id];
}

export async function buildCreatedByScope(actor: ScopeActor): Promise<Record<string, unknown>> {
  const ids = await getScopeUserIds(actor);
  if (ids === null) return {};
  if (ids.length === 1) return { createdBy: new Types.ObjectId(ids[0]) };
  return { createdBy: { $in: ids.map((id) => new Types.ObjectId(id)) } };
}

/** Scope labels by current owner — Super Admin sees all; Sub Admin sees self + invited admins. */
export async function buildOwnedByScope(actor: ScopeActor): Promise<Record<string, unknown>> {
  const ids = await getScopeUserIds(actor);
  if (ids === null) return {};
  if (ids.length === 1) return { ownedBy: ids[0] };
  return { ownedBy: { $in: ids } };
}

export async function assertOwnedByAccess(actor: ScopeActor, ownedBy: unknown): Promise<void> {
  if (actor.isSuperAdmin) return;

  const ownerId = resolveOwnerId(ownedBy);
  const ids = await getScopeUserIds(actor);
  if (!ids?.includes(ownerId)) {
    throw ApiError.forbidden('You do not have access to this label');
  }
}

export async function buildAssignedToScope(actor: ScopeActor): Promise<Record<string, unknown>> {
  if (actor.isSuperAdmin) return {};

  if (actor.isSubAdmin) {
    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) return { createdBy: new Types.ObjectId(actor.id) };

    const childAdmins = await UserModel.find({
      role: adminRole._id,
      createdBy: new Types.ObjectId(actor.id),
    })
      .select('_id')
      .lean();

    const childIds = childAdmins.map((u) => u._id);
    /** Sub Admin sees only entries they created, or assigned to Admins they invited. */
    if (childIds.length === 0) {
      return { createdBy: new Types.ObjectId(actor.id) };
    }

    return {
      $or: [
        { createdBy: new Types.ObjectId(actor.id) },
        { assignedTo: { $in: childIds } },
      ],
    };
  }

  return { assignedTo: new Types.ObjectId(actor.id) };
}

export async function assertCreatedByAccess(actor: ScopeActor, createdBy: unknown): Promise<void> {
  if (actor.isSuperAdmin) return;

  const ownerId = resolveOwnerId(createdBy);
  const ids = await getScopeUserIds(actor);
  if (!ids?.includes(ownerId)) {
    throw ApiError.forbidden('You do not have access to this record');
  }
}

/** Whether the actor can perform platform-wide workflow actions (not row-scoped). */
export function canManagePlatformWorkflow(actor: ScopeActor): boolean {
  return actor.isSuperAdmin || actor.isSubAdmin;
}
