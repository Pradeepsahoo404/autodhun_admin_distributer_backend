import { permissionRepository } from './permission.repository';
import { roleRepository } from '@/modules/role/role.repository';
import { moduleRepository } from '@/modules/module/module.repository';
import { IPermission, PermissionModel } from './permission.model';
import { ApiError } from '@/utils/ApiError';
import { PermissionAction, PERMISSION_ACTIONS, ROLES } from '@/constants';
import { EffectivePermissionRow, ResolvedModulePermission } from '@/types';
import {
  buildModuleSlugMap,
  getChildModules,
  getRootModules,
  getRootSlug,
  isModuleVisibleForRole,
  isRootModule,
} from '@/utils/moduleHierarchy';
import { IModule } from '@/modules/module/module.model';
import { isElevatedRole } from '@/utils/roles';

const actionToField: Record<
  PermissionAction,
  keyof Pick<IPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>
> = {
  view: PERMISSION_ACTIONS.VIEW,
  create: PERMISSION_ACTIONS.CREATE,
  update: PERMISSION_ACTIONS.UPDATE,
  delete: PERMISSION_ACTIONS.DELETE,
};

const toResolved = (
  mod: IModule,
  perms: Pick<IPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>,
): ResolvedModulePermission => ({
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

export interface PermissionActor {
  id: string;
  role: string;
  isMasterAdmin: boolean;
  isSuperAdmin: boolean;
  tenantId: string | null;
}

class PermissionService {
  /**
   * Resolves the sidebar for a role. Permissions are stored on root modules only;
   * child modules inherit the root module's actions automatically.
   * Admin users resolve against their tenant matrix (global template fallback).
   */
  async resolveForRole(
    roleId: string,
    roleSlug: string,
    tenantId: string | null = null,
  ): Promise<ResolvedModulePermission[]> {
    const modules = await moduleRepository.findActiveSorted();
    const bySlug = buildModuleSlugMap(modules);
    const visibleModules = modules.filter((mod) => isModuleVisibleForRole(mod, bySlug, roleSlug));

    if (isElevatedRole(roleSlug)) {
      return visibleModules.map((m) =>
        toResolved(m, { canView: true, canCreate: true, canUpdate: true, canDelete: true }),
      );
    }

    const effectiveTenantId = roleSlug === ROLES.ADMIN ? tenantId : null;
    if (effectiveTenantId) {
      await this.ensureTenantAdminPermissions(effectiveTenantId);
    }

    const rootPermBySlug = await this.loadRootPermissionMap(roleId, effectiveTenantId);

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

  /** Authorization check — always evaluates against the root module's permission row. */
  async can(
    roleId: string,
    roleSlug: string,
    moduleSlug: string,
    action: PermissionAction,
    tenantId: string | null = null,
  ): Promise<boolean> {
    if (isElevatedRole(roleSlug)) return true;

    const modules = await moduleRepository.findActiveSorted();
    const moduleDoc = modules.find((m) => m.slug === moduleSlug);
    if (!moduleDoc) return false;

    const bySlug = buildModuleSlugMap(modules);
    const rootSlug = getRootSlug(moduleDoc, bySlug);
    const rootModule = modules.find((m) => m.slug === rootSlug);
    if (!rootModule) return false;

    const effectiveTenantId = roleSlug === ROLES.ADMIN ? tenantId : null;
    if (effectiveTenantId) {
      await this.ensureTenantAdminPermissions(effectiveTenantId);
    }

    const permission = await permissionRepository.findByRoleAndModule(
      roleId,
      rootModule._id.toString(),
      effectiveTenantId,
    );
    if (!permission) return false;

    return Boolean(permission[actionToField[action]]);
  }

  /**
   * Permission matrix for the admin UI: root modules only for the target role.
   * `tenantId` scopes Admin-role matrix per organization.
   */
  async getMatrix(
    roleId: string,
    roleSlug: string,
    tenantId: string | null = null,
  ): Promise<EffectivePermissionRow[]> {
    const modules = await moduleRepository.findActiveSorted();
    const bySlug = buildModuleSlugMap(modules);
    const rootModules = getRootModules(modules).filter(
      (mod) => mod.isActive && isModuleVisibleForRole(mod, bySlug, roleSlug),
    );

    if (isElevatedRole(roleSlug)) {
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

    const effectiveTenantId = roleSlug === ROLES.ADMIN ? tenantId : null;
    if (effectiveTenantId) {
      await this.ensureTenantAdminPermissions(effectiveTenantId);
    }

    const rootPermBySlug = await this.loadRootPermissionMap(roleId, effectiveTenantId);

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

  async list(roleId?: string, tenantId: string | null = null): Promise<IPermission[]> {
    const permissions = roleId
      ? await permissionRepository.findByRole(roleId, tenantId)
      : await permissionRepository.find();
    if (!roleId) return permissions;

    const modules = await moduleRepository.findAllSorted();
    const rootIds = new Set(getRootModules(modules).map((m) => m._id.toString()));

    return permissions.filter((p) => rootIds.has(p.moduleId.toString()));
  }

  async setPermission(
    input: {
      roleId: string;
      moduleId: string;
      canView?: boolean;
      canCreate?: boolean;
      canUpdate?: boolean;
      canDelete?: boolean;
      tenantId?: string | null;
    },
    actor: PermissionActor,
  ): Promise<IPermission> {
    const scope = await this.resolveWriteScope(input.roleId, input.tenantId, actor);
    const [role, moduleDoc] = await Promise.all([
      roleRepository.findById(input.roleId),
      moduleRepository.findById(input.moduleId),
    ]);
    if (!role) throw ApiError.notFound('Role not found');
    if (!moduleDoc) throw ApiError.notFound('Module not found');
    if (!isRootModule(moduleDoc)) {
      throw ApiError.badRequest('Permissions can only be set on main modules');
    }
    if (isElevatedRole(role.slug)) {
      throw ApiError.badRequest('Elevated role permissions are implicit and cannot be edited');
    }

    const result = await permissionRepository.upsert(
      input.roleId,
      input.moduleId,
      {
        canView: input.canView ?? false,
        canCreate: input.canCreate ?? false,
        canUpdate: input.canUpdate ?? false,
        canDelete: input.canDelete ?? false,
      },
      scope.tenantId,
    );
    if (!result) throw ApiError.internal('Failed to persist permission');

    await this.clearChildPermissions(input.roleId, scope.tenantId);
    return result;
  }

  async bulkSet(
    roleId: string,
    rows: Array<{
      moduleId: string;
      canView?: boolean;
      canCreate?: boolean;
      canUpdate?: boolean;
      canDelete?: boolean;
    }>,
    actor: PermissionActor,
    requestedTenantId?: string | null,
  ): Promise<IPermission[]> {
    const role = await roleRepository.findById(roleId);
    if (!role) throw ApiError.notFound('Role not found');
    if (isElevatedRole(role.slug)) {
      throw ApiError.badRequest('Elevated role permissions are implicit and cannot be edited');
    }

    const scope = await this.resolveWriteScope(roleId, requestedTenantId, actor);

    const modules = await moduleRepository.findAllSorted();
    const rootIds = new Set(getRootModules(modules).map((m) => m._id.toString()));

    for (const row of rows) {
      if (!rootIds.has(row.moduleId)) {
        throw ApiError.badRequest('Permissions can only be set on main modules');
      }
    }

    const results = await Promise.all(
      rows.map((row) =>
        permissionRepository.upsert(
          roleId,
          row.moduleId,
          {
            canView: row.canView ?? false,
            canCreate: row.canCreate ?? false,
            canUpdate: row.canUpdate ?? false,
            canDelete: row.canDelete ?? false,
          },
          scope.tenantId,
        ),
      ),
    );

    await this.clearChildPermissions(roleId, scope.tenantId);
    return results.filter((r): r is IPermission => r !== null);
  }

  async update(id: string, actions: Partial<IPermission>, actor: PermissionActor): Promise<IPermission> {
    const existing = await permissionRepository.findById(id);
    if (!existing) throw ApiError.notFound('Permission not found');

    const existingTenantId = existing.tenantId ? existing.tenantId.toString() : null;
    if (!actor.isMasterAdmin) {
      if (!actor.tenantId || existingTenantId !== actor.tenantId) {
        throw ApiError.forbidden('Cannot modify permissions for another tenant');
      }
    }

    const updated = await permissionRepository.updateById(id, actions);
    if (!updated) throw ApiError.notFound('Permission not found');
    return updated;
  }

  async remove(id: string, actor: PermissionActor): Promise<void> {
    const existing = await permissionRepository.findById(id);
    if (!existing) throw ApiError.notFound('Permission not found');

    const existingTenantId = existing.tenantId ? existing.tenantId.toString() : null;
    if (!actor.isMasterAdmin) {
      if (!actor.tenantId || existingTenantId !== actor.tenantId) {
        throw ApiError.forbidden('Cannot delete permissions for another tenant');
      }
    }

    const deleted = await permissionRepository.deleteById(id);
    if (!deleted) throw ApiError.notFound('Permission not found');
  }

  /**
   * Clone global Admin template permissions into a tenant on first use / tenant create.
   * Idempotent — no-op if tenant rows already exist.
   */
  async ensureTenantAdminPermissions(tenantId: string): Promise<void> {
    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) return;

    const roleId = adminRole._id.toString();
    const existing = await permissionRepository.countByRole(roleId, tenantId);
    if (existing > 0) return;

    const globals = await permissionRepository.findByRole(roleId, null);
    if (globals.length === 0) return;

    await Promise.all(
      globals.map((perm) =>
        permissionRepository.upsert(
          roleId,
          perm.moduleId.toString(),
          {
            canView: perm.canView,
            canCreate: perm.canCreate,
            canUpdate: perm.canUpdate,
            canDelete: perm.canDelete,
          },
          tenantId,
        ),
      ),
    );
  }

  private async resolveWriteScope(
    roleId: string,
    requestedTenantId: string | null | undefined,
    actor: PermissionActor,
  ): Promise<{ tenantId: string | null }> {
    const role = await roleRepository.findById(roleId);
    if (!role) throw ApiError.notFound('Role not found');

    if (actor.isMasterAdmin) {
      // Master may edit global template (null) or a specific tenant Admin matrix.
      if (role.slug !== ROLES.ADMIN && requestedTenantId) {
        throw ApiError.badRequest('Tenant-scoped permissions are only supported for the Admin role');
      }
      return { tenantId: requestedTenantId ?? null };
    }

    // Tenant Super Admin — only Admin role for own tenant.
    if (!actor.tenantId) {
      throw ApiError.forbidden('Your account is not assigned to a tenant');
    }
    if (role.slug !== ROLES.ADMIN) {
      throw ApiError.forbidden('You can only configure Admin permissions for your organization');
    }
    if (requestedTenantId && requestedTenantId !== actor.tenantId) {
      throw ApiError.forbidden('Cannot configure another tenant');
    }
    return { tenantId: actor.tenantId };
  }

  private async loadRootPermissionMap(
    roleId: string,
    tenantId: string | null,
  ): Promise<Map<string, Pick<IPermission, 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'>>> {
    let permissions = await permissionRepository.findByRoleWithModules(roleId, tenantId);

    // Fallback to global template if tenant copy is empty (should be rare after ensure).
    if (tenantId && permissions.length === 0) {
      permissions = await permissionRepository.findByRoleWithModules(roleId, null);
    }

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

  private async clearChildPermissions(roleId: string, tenantId: string | null): Promise<void> {
    const modules = await moduleRepository.findAllSorted();
    const childIds = getChildModules(modules).map((m) => m._id);
    if (childIds.length === 0) return;

    const filter =
      tenantId === null
        ? {
            roleId,
            moduleId: { $in: childIds },
            $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
          }
        : { roleId, moduleId: { $in: childIds }, tenantId };

    await PermissionModel.deleteMany(filter);
  }
}

export const permissionService = new PermissionService();
