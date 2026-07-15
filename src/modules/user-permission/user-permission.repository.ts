import { IUserPermission, UserPermissionModel } from './user-permission.model';

class UserPermissionRepository {
  findByUser(userId: string): Promise<IUserPermission[]> {
    return UserPermissionModel.find({ userId }).populate('moduleId').exec();
  }

  findByUserWithModules(userId: string): Promise<IUserPermission[]> {
    return UserPermissionModel.find({ userId })
      .populate({
        path: 'moduleId',
        select: 'name slug route icon order isPro group parentSlug isActive audience',
      })
      .exec();
  }

  async upsert(
    userId: string,
    moduleId: string,
    actions: Pick<IUserPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>,
  ): Promise<IUserPermission | null> {
    return UserPermissionModel.findOneAndUpdate(
      { userId, moduleId },
      { $set: actions },
      { upsert: true, new: true, runValidators: true },
    ).exec();
  }

  async bulkUpsert(
    userId: string,
    rows: Array<{
      moduleId: string;
      canView?: boolean;
      canCreate?: boolean;
      canUpdate?: boolean;
      canDelete?: boolean;
    }>,
  ): Promise<IUserPermission[]> {
    const results = await Promise.all(
      rows.map((row) =>
        this.upsert(userId, row.moduleId, {
          canView: row.canView ?? false,
          canCreate: row.canCreate ?? false,
          canUpdate: row.canUpdate ?? false,
          canDelete: row.canDelete ?? false,
        }),
      ),
    );
    return results.filter((r): r is IUserPermission => r !== null);
  }

  deleteByUser(userId: string): Promise<void> {
    return UserPermissionModel.deleteMany({ userId }).then(() => undefined);
  }
}

export const userPermissionRepository = new UserPermissionRepository();
