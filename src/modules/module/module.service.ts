import { moduleRepository } from './module.repository';
import { permissionRepository } from '@/modules/permission/permission.repository';
import { ApiError } from '@/utils/ApiError';
import { DEPRECATED_MODULE_SLUGS } from '@/constants/modules.seed';
import { IModule } from './module.model';
import { CreateModuleDto, UpdateModuleDto } from './module.validator';
import { getRootModules } from '@/utils/moduleHierarchy';

export interface ModuleListQuery {
  rootsOnly?: boolean;
  search?: string;
  status?: 'active' | 'inactive';
}

const deprecatedSlugs = new Set<string>(DEPRECATED_MODULE_SLUGS);

class ModuleService {
  async list(options: ModuleListQuery = {}): Promise<IModule[]> {
    const { rootsOnly = false, search, status } = options;
    let modules = await moduleRepository.findAllSorted();

    // Hide legacy modules removed from the product (still in DB until re-seed).
    modules = modules.filter((m) => !deprecatedSlugs.has(m.slug));

    if (rootsOnly) modules = getRootModules(modules);

    if (status === 'active') modules = modules.filter((m) => m.isActive);
    if (status === 'inactive') modules = modules.filter((m) => !m.isActive);

    if (search?.trim()) {
      const term = search.trim().toLowerCase();
      modules = modules.filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          m.slug.toLowerCase().includes(term) ||
          m.route.toLowerCase().includes(term),
      );
    }

    return modules;
  }

  async getById(id: string): Promise<IModule> {
    const moduleDoc = await moduleRepository.findById(id);
    if (!moduleDoc) throw ApiError.notFound('Module not found');
    return moduleDoc;
  }

  async create(dto: CreateModuleDto): Promise<IModule> {
    const existing = await moduleRepository.findBySlug(dto.slug);
    if (existing) throw ApiError.conflict('A module with this slug already exists');
    return moduleRepository.create(dto);
  }

  async update(id: string, dto: UpdateModuleDto): Promise<IModule> {
    const moduleDoc = await moduleRepository.findById(id);
    if (!moduleDoc) throw ApiError.notFound('Module not found');
    const updated = await moduleRepository.updateById(id, dto);
    return updated as IModule;
  }

  async remove(id: string): Promise<void> {
    const moduleDoc = await moduleRepository.findById(id);
    if (!moduleDoc) throw ApiError.notFound('Module not found');

    const descendantIds = await moduleRepository.findDescendantIds(moduleDoc.slug);
    const allModuleIds = [moduleDoc._id.toString(), ...descendantIds];

    await permissionRepository.deleteMany({ moduleId: { $in: allModuleIds } });
    await moduleRepository.deleteManyByIds(allModuleIds);
  }
}

export const moduleService = new ModuleService();
