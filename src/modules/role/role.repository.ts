import { BaseRepository } from '@/repositories/base.repository';
import { IRole, RoleModel } from './role.model';
import { ROLE_STATUS } from '@/constants';
import { PaginatedResult, PaginationQuery } from '@/types';

class RoleRepository extends BaseRepository<IRole> {
  constructor() {
    super(RoleModel);
  }

  findBySlug(slug: string): Promise<IRole | null> {
    return RoleModel.findOne({ slug: slug.toLowerCase() }).exec();
  }

  findAllSorted(): Promise<IRole[]> {
    return RoleModel.find().sort({ createdAt: 1 }).exec();
  }

  async paginate(query: PaginationQuery): Promise<PaginatedResult<IRole>> {
    const { page, limit, search, status, sortBy = 'createdAt', sortOrder = 'asc' } = query;
    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      andConditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (status === ROLE_STATUS.ACTIVE) {
      andConditions.push({
        $or: [{ status: ROLE_STATUS.ACTIVE }, { status: { $exists: false } }],
      });
    } else if (status) {
      andConditions.push({ status });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

    const [items, total] = await Promise.all([
      RoleModel.find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      RoleModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export const roleRepository = new RoleRepository();
