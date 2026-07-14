import { FilterQuery, Types } from 'mongoose';
import { BaseRepository } from '@/repositories/base.repository';
import { IPermission, PermissionModel } from './permission.model';
import { IModule } from '@/modules/module/module.model';

export interface PopulatedPermission extends Omit<IPermission, 'moduleId'> {
  moduleId: IModule;
}

function tenantScopeFilter(tenantId: string | null | undefined): FilterQuery<IPermission> {
  if (tenantId) {
    return { tenantId: new Types.ObjectId(tenantId) };
  }
  return { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] };
}

class PermissionRepository extends BaseRepository<IPermission> {
  constructor() {
    super(PermissionModel);
  }

  findByRole(roleId: string, tenantId?: string | null): Promise<IPermission[]> {
    return PermissionModel.find({
      roleId,
      ...tenantScopeFilter(tenantId ?? null),
    }).exec();
  }

  /** All permissions for a role joined with active module metadata (sidebar source). */
  findByRoleWithModules(roleId: string, tenantId?: string | null): Promise<PopulatedPermission[]> {
    return PermissionModel.find({
      roleId,
      ...tenantScopeFilter(tenantId ?? null),
    })
      .populate<{ moduleId: IModule }>('moduleId')
      .exec() as unknown as Promise<PopulatedPermission[]>;
  }

  findByRoleAndModule(
    roleId: string,
    moduleId: string,
    tenantId?: string | null,
  ): Promise<IPermission | null> {
    return PermissionModel.findOne({
      roleId,
      moduleId,
      ...tenantScopeFilter(tenantId ?? null),
    }).exec();
  }

  countByRole(roleId: string, tenantId: string | null): Promise<number> {
    return PermissionModel.countDocuments({
      roleId,
      ...tenantScopeFilter(tenantId),
    }).exec();
  }

  /** Idempotent grant — used by the seeder and the permissions API. */
  upsert(
    roleId: string,
    moduleId: string,
    actions: Partial<Pick<IPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>>,
    tenantId: string | null = null,
  ): Promise<IPermission | null> {
    const tenantFilter = tenantId
      ? { tenantId: new Types.ObjectId(tenantId) }
      : { tenantId: null };

    return PermissionModel.findOneAndUpdate(
      { roleId, moduleId, ...tenantFilter },
      {
        $set: {
          roleId,
          moduleId,
          tenantId: tenantId ? new Types.ObjectId(tenantId) : null,
          ...actions,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
  }
}

export const permissionRepository = new PermissionRepository();
