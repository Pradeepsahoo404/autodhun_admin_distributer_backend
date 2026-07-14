import { FilterQuery } from 'mongoose';
import { BaseRepository } from '@/repositories/base.repository';
import { ITenant, TenantModel } from './tenant.model';
import { PaginatedResult, PaginationQuery } from '@/types';
import { TENANT_STATUS } from '@/constants/tenant';

class TenantRepository extends BaseRepository<ITenant> {
  constructor() {
    super(TenantModel);
  }

  findBySlug(slug: string): Promise<ITenant | null> {
    return this.findOne({ slug: slug.toLowerCase() });
  }

  async paginate(query: PaginationQuery & { status?: string; search?: string }): Promise<PaginatedResult<ITenant>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter: FilterQuery<ITenant> = {};

    if (query.status) filter.status = query.status;
    if (query.search?.trim()) {
      const q = query.search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { slug: { $regex: q, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  findActiveById(id: string): Promise<ITenant | null> {
    return this.findOne({ _id: id, status: TENANT_STATUS.ACTIVE });
  }
}

export const tenantRepository = new TenantRepository();
