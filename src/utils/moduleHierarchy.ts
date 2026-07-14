import { IModule } from '@/modules/module/module.model';
import { ROLES } from '@/constants';

type ModuleRef = Pick<IModule, 'slug' | 'parentSlug'>;

/** A top-level module with no parent — permissions are managed at this level only. */
export const isRootModule = (module: ModuleRef): boolean => !module.parentSlug;

export const buildModuleSlugMap = (modules: ModuleRef[]): Map<string, ModuleRef> =>
  new Map(modules.map((m) => [m.slug, m]));

/** Walks `parentSlug` links to the top-level ancestor used for permission checks. */
export const getRootSlug = (module: ModuleRef, bySlug: Map<string, ModuleRef>): string => {
  let current = module;
  const visited = new Set<string>();

  while (current.parentSlug && bySlug.has(current.parentSlug)) {
    if (visited.has(current.slug)) break;
    visited.add(current.slug);
    current = bySlug.get(current.parentSlug)!;
  }

  return current.slug;
};

/** All descendant module ids under a root slug (recursive). */
export const collectDescendantModuleIds = (rootSlug: string, modules: IModule[]): string[] => {
  const ids: string[] = [];

  const visit = (parentSlug: string): void => {
    for (const mod of modules) {
      if (mod.parentSlug === parentSlug) {
        ids.push(mod._id.toString());
        visit(mod.slug);
      }
    }
  };

  visit(rootSlug);
  return ids;
};

export const getRootModules = <T extends ModuleRef>(modules: T[]): T[] => modules.filter(isRootModule);

export const getChildModules = <T extends ModuleRef>(modules: T[]): T[] => modules.filter((m) => !isRootModule(m));

type ModuleWithAudience = ModuleRef & { audience?: string };

/** Root module audience — children inherit from their top-level ancestor. */
export const getRootAudience = (module: ModuleWithAudience, bySlug: Map<string, ModuleWithAudience>): string => {
  const rootSlug = getRootSlug(module, bySlug);
  return bySlug.get(rootSlug)?.audience ?? 'shared';
};

/** Whether a module branch should appear in the sidebar for the given role. */
export const isModuleVisibleForRole = (
  module: ModuleWithAudience,
  bySlug: Map<string, ModuleWithAudience>,
  roleSlug: string,
): boolean => {
  const audience = getRootAudience(module, bySlug);
  if (audience === 'shared') return true;
  // Master sees former Super Admin branches (+ later master-only modules).
  if (roleSlug === ROLES.MASTER_ADMIN) {
    return audience === 'super-admin' || audience === 'master-admin';
  }
  if (roleSlug === ROLES.SUPER_ADMIN) return audience === 'super-admin';
  if (roleSlug === ROLES.ADMIN) return audience === 'admin';
  return audience === 'shared';
};
