import { BaseRepository } from '@/repositories/base.repository';
import { IUser, UserModel } from './user.model';
import { PaginatedResult, PaginationQuery } from '@/types';

class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  findByEmail(email: string, withPassword = false): Promise<IUser | null> {
    const query = UserModel.findOne({ email: email.toLowerCase() }).populate('role', 'name slug isSystem');
    if (withPassword) query.select('+password');
    return query.exec();
  }

  findByGoogleId(googleId: string): Promise<IUser | null> {
    return UserModel.findOne({ googleId }).populate('role', 'name slug isSystem').exec();
  }

  findByIdWithRole(id: string): Promise<IUser | null> {
    return UserModel.findById(id).populate('role', 'name slug isSystem').exec();
  }

  findByIdWithPassword(id: string): Promise<IUser | null> {
    return UserModel.findById(id).select('+password').exec();
  }

  async paginate(query: PaginationQuery): Promise<PaginatedResult<IUser>> {
    const {
      page,
      limit,
      search,
      status,
      roleId,
      tenantId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) {
      filter.status = status;
    }
    if (roleId) {
      filter.role = roleId;
    }
    if (tenantId) {
      filter.tenantId = tenantId;
    }

    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .select(
          'firstName lastName name email role status emailVerified termsAccepted tenantId lastLogin createdAt updatedAt',
        )
        .populate('role', 'name slug')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      UserModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async countAdminsCreatedSince(since: Date, adminRoleId: string, tenantId?: string | null): Promise<number> {
    const filter: Record<string, unknown> = {
      role: adminRoleId,
      createdAt: { $gte: since },
    };
    if (tenantId) filter.tenantId = tenantId;
    return UserModel.countDocuments(filter).exec();
  }

  async countAdmins(adminRoleId: string, tenantId?: string | null): Promise<number> {
    const filter: Record<string, unknown> = { role: adminRoleId };
    if (tenantId) filter.tenantId = tenantId;
    return UserModel.countDocuments(filter).exec();
  }
}

export const userRepository = new UserRepository();
