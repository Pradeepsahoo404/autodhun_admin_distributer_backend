import { roleRepository } from './role.repository';
import { permissionRepository } from '@/modules/permission/permission.repository';
import { userRepository } from '@/modules/user/user.repository';
import { ApiError } from '@/utils/ApiError';
import { ROLE_STATUS } from '@/constants';
import { IRole } from './role.model';
import { PaginatedResult, PaginationQuery } from '@/types';
import { CreateRoleDto, UpdateRoleDto } from './role.validator';

class RoleService {
  list(query: PaginationQuery): Promise<PaginatedResult<IRole>> {
    return roleRepository.paginate(query);
  }

  /** Unpaginated list for dropdowns (permissions matrix, etc.). */
  listAll(): Promise<IRole[]> {
    return roleRepository.findAllSorted();
  }

  async getById(id: string): Promise<IRole> {
    const role = await roleRepository.findById(id);
    if (!role) throw ApiError.notFound('Role not found');
    return role;
  }

  async create(dto: CreateRoleDto): Promise<IRole> {
    const existing = await roleRepository.findBySlug(dto.slug);
    if (existing) throw ApiError.conflict('A role with this slug already exists');
    return roleRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      status: dto.status ?? ROLE_STATUS.ACTIVE,
      isSystem: false,
    });
  }

  async update(id: string, dto: UpdateRoleDto): Promise<IRole> {
    const role = await roleRepository.findById(id);
    if (!role) throw ApiError.notFound('Role not found');

    if (role.isSystem && dto.name !== undefined) {
      throw ApiError.forbidden('System role name cannot be changed');
    }

    const updated = await roleRepository.updateById(id, dto);
    return updated as IRole;
  }

  async remove(id: string): Promise<void> {
    const role = await roleRepository.findById(id);
    if (!role) throw ApiError.notFound('Role not found');
    if (role.isSystem) throw ApiError.forbidden('System roles cannot be deleted');

    const inUse = await userRepository.exists({ role: role._id });
    if (inUse) throw ApiError.conflict('Role is assigned to users and cannot be deleted');

    await permissionRepository.deleteMany({ roleId: role._id });
    await roleRepository.deleteById(id);
  }
}

export const roleService = new RoleService();
