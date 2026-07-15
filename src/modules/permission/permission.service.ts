import { permissionRepository } from './permission.repository';
import { roleRepository } from '@/modules/role/role.repository';
import { moduleRepository } from '@/modules/module/module.repository';
import { IModule } from '@/modules/module/module.model';
import { IPermission, PermissionModel } from './permission.model';
import { ApiError } from '@/utils/ApiError';
import { ROLES, PermissionAction, PERMISSION_ACTIONS } from '@/constants';
import { EffectivePermissionRow, ResolvedModulePermission } from '@/types';
import {
  buildModuleSlugMap,
  getChildModules,
  getRootModules,
  getRootSlug,
  isModuleVisibleForRole,
  isRootModule,
} from '@/utils/moduleHierarchy';
import { userPermissionRepository } from '@/modules/user-permission/user-permission.repository';
import { IUserPermission } from '@/modules/user-permission/user-permission.model';

const actionToField: Record<PermissionAction, keyof Pick<IPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>> = {
  view: PERMISSION_ACTIONS.VIEW,
  create: PERMISSION_ACTIONS.CREATE,
  update: PERMISSION_ACTIONS.UPDATE,
  delete: PERMISSION_ACTIONS.DELETE,
};

const toResolved = (mod: IModule, perms: Pick<IPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>): ResolvedModulePermission => ({
  moduleId: mod._id.toString(),
  name: mod.name,
  slug: mod.slug,
  route: mod.route,
  icon: mod.icon,
  order: mod.order,
  isPro: mod.isPro,
  group: mod.group,
  parentSlug: mod.parentSlug,
  canView: perms.canView,
  canCreate: perms.canCreate,
  canUpdate: perms.canUpdate,
  canDelete: perms.canDelete,
});

class PermissionService {
  /** Resolves sidebar for the authenticated principal (role or per-user for Sub Admin). */
  async resolveForUser(roleId: string, roleSlug: string, userId: string): Promise<ResolvedModulePermission[]> {
    if (roleSlug === ROLES.SUB_ADMIN) {
      return this.resolveForSubAdmin(userId);
    }
    return this.resolveForRole(roleId, roleSlug);
  }

  /**
   * Resolves the sidebar for a role. Permissions are stored on root modules only;
   * child modules inherit the root module's actions automatically.
   */
  async resolveForRole(roleId: string, roleSlug: string): Promise<ResolvedModulePermission[]> {
    const modules = await moduleRepository.findActiveSorted();
    const bySlug = buildModuleSlugMap(modules);
    const visibleModules = modules.filter((mod) => isModuleVisibleForRole(mod, bySlug, roleSlug));

    if (roleSlug === ROLES.SUPER_ADMIN) {
      return visibleModules.map((m) =>
        toResolved(m, { canView: true, canCreate: true, canUpdate: true, canDelete: true }),
      );
    }

    const rootPermBySlug = await this.loadRootPermissionMap(roleId);

    return visibleModules
      .filter((mod) => {
        const rootSlug = getRootSlug(mod, bySlug);
        return Boolean(rootPermBySlug.get(rootSlug)?.canView);
      })
      .map((mod) => {
        const rootSlug = getRootSlug(mod, bySlug);
        const rootPerm = rootPermBySlug.get(rootSlug)!;
        return toResolved(mod, rootPerm);
      })
      .sort((a, b) => a.order - b.order);
  }

  /** Sub Admin sidebar from per-user UserPermission rows. */
  private async resolveForSubAdmin(userId: string): Promise<ResolvedModulePermission[]> {
    const modules = await moduleRepository.findActiveSorted();
    const bySlug = buildModuleSlugMap(modules);
    const rootPermBySlug = await this.loadUserRootPermissionMap(userId);

    return modules
      .filter((mod) => isModuleVisibleForRole(mod, bySlug, ROLES.SUB_ADMIN))
      .filter((mod) => {
        const rootSlug = getRootSlug(mod, bySlug);
        if (rootSlug === 'notifications') return true;
        return Boolean(rootPermBySlug.get(rootSlug)?.canView);
      })
      .map((mod) => {
        const rootSlug = getRootSlug(mod, bySlug);
        const rootPerm = rootPermBySlug.get(rootSlug) ?? {
          canView: rootSlug === 'notifications',
          canCreate: false,
          canUpdate: false,
          canDelete: false,
        };
        return toResolved(mod, rootPerm);
      })
      .sort((a, b) => a.order - b.order);
  }

  /** Authorization check — always evaluates against the root module's permission row. */
  async can(
    roleId: string,
    roleSlug: string,
    moduleSlug: string,
    action: PermissionAction,
    userId?: string,
  ): Promise<boolean> {
    if (roleSlug === ROLES.SUPER_ADMIN) return true;

    if (roleSlug === ROLES.SUB_ADMIN && userId) {
      return this.canForSubAdmin(userId, moduleSlug, action);
    }

    const modules = await moduleRepository.findActiveSorted();
    const moduleDoc = modules.find((m) => m.slug === moduleSlug);
    if (!moduleDoc) return false;

    const bySlug = buildModuleSlugMap(modules);
    const rootSlug = getRootSlug(moduleDoc, bySlug);
    const rootModule = modules.find((m) => m.slug === rootSlug);
    if (!rootModule) return false;

    const permission = await permissionRepository.findByRoleAndModule(roleId, rootModule._id.toString());
    if (!permission) return false;

    return Boolean(permission[actionToField[action]]);
  }

  private async canForSubAdmin(userId: string, moduleSlug: string, action: PermissionAction): Promise<boolean> {
    const modules = await moduleRepository.findActiveSorted();
    const moduleDoc = modules.find((m) => m.slug === moduleSlug);
    if (!moduleDoc) return false;

    const bySlug = buildModuleSlugMap(modules);
    if (!isModuleVisibleForRole(moduleDoc, bySlug, ROLES.SUB_ADMIN)) return false;

    const rootSlug = getRootSlug(moduleDoc, bySlug);
    if (rootSlug === 'notifications') return action === 'view';

    const rootModule = modules.find((m) => m.slug === rootSlug);
    if (!rootModule) return false;

    const map = await this.loadUserRootPermissionMap(userId);
    const perm = map.get(rootSlug);
    if (!perm) return false;

    return Boolean(perm[actionToField[action]]);
  }

  /**
   * Permission matrix for the admin UI: root modules only for the target role.
   * Child modules inherit from their parent at runtime (sidebar, guards, APIs).
   */
  async getMatrix(roleId: string, roleSlug: string): Promise<EffectivePermissionRow[]> {
    const modules = await moduleRepository.findActiveSorted();
    const bySlug = buildModuleSlugMap(modules);
    const rootModules = getRootModules(modules).filter(
      (mod) => mod.isActive && isModuleVisibleForRole(mod, bySlug, roleSlug),
    );

    if (roleSlug === ROLES.SUPER_ADMIN) {
      return rootModules.map((mod) => ({
        moduleId: mod._id.toString(),
        name: mod.name,
        slug: mod.slug,
        parentSlug: mod.parentSlug,
        group: mod.group,
        order: mod.order,
        isRoot: true,
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      }));
    }

    const rootPermBySlug = await this.loadRootPermissionMap(roleId);

    return rootModules.map((mod) => {
      const perms = rootPermBySlug.get(mod.slug) ?? {
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      };

      return {
        moduleId: mod._id.toString(),
        name: mod.name,
        slug: mod.slug,
        parentSlug: mod.parentSlug,
        group: mod.group,
        order: mod.order,
        isRoot: true,
        ...perms,
      };
    });
  }

  async list(roleId?: string): Promise<IPermission[]> {
    const permissions = roleId ? await permissionRepository.findByRole(roleId) : await permissionRepository.find();
    if (!roleId) return permissions;

    const modules = await moduleRepository.findAllSorted();
    const rootIds = new Set(getRootModules(modules).map((m) => m._id.toString()));

    return permissions.filter((p) => rootIds.has(p.moduleId.toString()));
  }

  async setPermission(input: {
    roleId: string;
    moduleId: string;
    canView?: boolean;
    canCreate?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
  }): Promise<IPermission> {
    const [role, moduleDoc] = await Promise.all([
      roleRepository.findById(input.roleId),
      moduleRepository.findById(input.moduleId),
    ]);
    if (!role) throw ApiError.notFound('Role not found');
    if (!moduleDoc) throw ApiError.notFound('Module not found');
    if (!isRootModule(moduleDoc)) {
      throw ApiError.badRequest('Permissions can only be set on main modules');
    }
    if (role.slug === ROLES.SUPER_ADMIN || role.slug === ROLES.SUB_ADMIN) {
      throw ApiError.badRequest('Super Admin and Sub Admin permissions are implicit or per-user and cannot be edited here');
    }

    const result = await permissionRepository.upsert(input.roleId, input.moduleId, {
      canView: input.canView ?? false,
      canCreate: input.canCreate ?? false,
      canUpdate: input.canUpdate ?? false,
      canDelete: input.canDelete ?? false,
    });
    if (!result) throw ApiError.internal('Failed to persist permission');

    await this.clearChildPermissions(input.roleId);
    return result;
  }

  /**
   * Bulk upsert for the permission matrix. Only root module rows are accepted;
   * child modules inherit automatically and any stale child rows are removed.
   */
  async bulkSet(
    roleId: string,
    rows: Array<{
      moduleId: string;
      canView?: boolean;
      canCreate?: boolean;
      canUpdate?: boolean;
      canDelete?: boolean;
    }>,
  ): Promise<IPermission[]> {
    const role = await roleRepository.findById(roleId);
    if (!role) throw ApiError.notFound('Role not found');
    if (role.slug === ROLES.SUPER_ADMIN || role.slug === ROLES.SUB_ADMIN) {
      throw ApiError.badRequest('Super Admin and Sub Admin permissions are implicit or per-user and cannot be edited here');
    }

    const modules = await moduleRepository.findAllSorted();
    const rootIds = new Set(getRootModules(modules).map((m) => m._id.toString()));

    for (const row of rows) {
      if (!rootIds.has(row.moduleId)) {
        throw ApiError.badRequest('Permissions can only be set on main modules');
      }
    }

    const results = await Promise.all(
      rows.map((row) =>
        permissionRepository.upsert(roleId, row.moduleId, {
          canView: row.canView ?? false,
          canCreate: row.canCreate ?? false,
          canUpdate: row.canUpdate ?? false,
          canDelete: row.canDelete ?? false,
        }),
      ),
    );

    await this.clearChildPermissions(roleId);
    return results.filter((r): r is IPermission => r !== null);
  }

  async update(id: string, actions: Partial<IPermission>): Promise<IPermission> {
    const updated = await permissionRepository.updateById(id, actions);
    if (!updated) throw ApiError.notFound('Permission not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await permissionRepository.deleteById(id);
    if (!deleted) throw ApiError.notFound('Permission not found');
  }

  /** Permission matrix for a Sub Admin user (root modules only). */
  async getUserMatrix(userId: string): Promise<EffectivePermissionRow[]> {
    const modules = await moduleRepository.findActiveSorted();
    const bySlug = buildModuleSlugMap(modules);
    const rootModules = getRootModules(modules).filter(
      (mod) => mod.isActive && isModuleVisibleForRole(mod, bySlug, ROLES.SUB_ADMIN),
    );
    const rootPermBySlug = await this.loadUserRootPermissionMap(userId);

    return rootModules.map((mod) => {
      const perms = rootPermBySlug.get(mod.slug) ?? {
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      };
      return {
        moduleId: mod._id.toString(),
        name: mod.name,
        slug: mod.slug,
        parentSlug: mod.parentSlug,
        group: mod.group,
        order: mod.order,
        isRoot: true,
        ...perms,
      };
    });
  }

  async bulkSetForUser(
    userId: string,
    rows: Array<{
      moduleId: string;
      canView?: boolean;
      canCreate?: boolean;
      canUpdate?: boolean;
      canDelete?: boolean;
    }>,
  ): Promise<IUserPermission[]> {
    const modules = await moduleRepository.findAllSorted();
    const bySlug = buildModuleSlugMap(modules);
    const allowedRootIds = new Set(
      getRootModules(modules)
        .filter((m) => isModuleVisibleForRole(m, bySlug, ROLES.SUB_ADMIN))
        .map((m) => m._id.toString()),
    );

    for (const row of rows) {
      if (!allowedRootIds.has(row.moduleId)) {
        throw ApiError.badRequest('Permissions can only be set on modules available to Sub Admins');
      }
    }

    return userPermissionRepository.bulkUpsert(userId, rows);
  }

  private async loadUserRootPermissionMap(
    userId: string,
  ): Promise<Map<string, Pick<IUserPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>>> {
    const permissions = await userPermissionRepository.findByUserWithModules(userId);
    const map = new Map<string, Pick<IUserPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>>();

    for (const perm of permissions) {
      const mod = perm.moduleId as unknown as IModule;
      if (!mod?.isActive || mod.parentSlug) continue;
      map.set(mod.slug, {
        canView: perm.canView,
        canCreate: perm.canCreate,
        canUpdate: perm.canUpdate,
        canDelete: perm.canDelete,
      });
    }

    return map;
  }

  private async loadRootPermissionMap(
    roleId: string,
  ): Promise<Map<string, Pick<IPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>>> {
    const permissions = await permissionRepository.findByRoleWithModules(roleId);
    const map = new Map<string, Pick<IPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>>();

    for (const perm of permissions) {
      const mod = perm.moduleId;
      if (!mod?.isActive || mod.parentSlug) continue;
      map.set(mod.slug, {
        canView: perm.canView,
        canCreate: perm.canCreate,
        canUpdate: perm.canUpdate,
        canDelete: perm.canDelete,
      });
    }

    return map;
  }

  private async clearChildPermissions(roleId: string): Promise<void> {
    const modules = await moduleRepository.findAllSorted();
    const childIds = getChildModules(modules).map((m) => m._id);
    if (childIds.length === 0) return;
    await PermissionModel.deleteMany({ roleId, moduleId: { $in: childIds } });
  }
}

export const permissionService = new PermissionService();
