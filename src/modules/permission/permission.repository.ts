import { BaseRepository } from '@/repositories/base.repository';
import { IPermission, PermissionModel } from './permission.model';
import { IModule } from '@/modules/module/module.model';

export interface PopulatedPermission extends Omit<IPermission, 'moduleId'> {
  moduleId: IModule;
}

class PermissionRepository extends BaseRepository<IPermission> {
  constructor() {
    super(PermissionModel);
  }

  findByRole(roleId: string): Promise<IPermission[]> {
    return PermissionModel.find({ roleId }).exec();
  }

  /** All permissions for a role joined with active module metadata (sidebar source). */
  findByRoleWithModules(roleId: string): Promise<PopulatedPermission[]> {
    return PermissionModel.find({ roleId })
      .populate<{ moduleId: IModule }>('moduleId')
      .exec() as unknown as Promise<PopulatedPermission[]>;
  }

  findByRoleAndModule(roleId: string, moduleId: string): Promise<IPermission | null> {
    return PermissionModel.findOne({ roleId, moduleId }).exec();
  }

  /** Idempotent grant — used by the seeder and the permissions API. */
  upsert(
    roleId: string,
    moduleId: string,
    actions: Partial<Pick<IPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>>,
  ): Promise<IPermission | null> {
    return PermissionModel.findOneAndUpdate(
      { roleId, moduleId },
      { $set: { roleId, moduleId, ...actions } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
  }
}

export const permissionRepository = new PermissionRepository();
