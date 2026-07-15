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

  async paginate(query: PaginationQuery & { createdBy?: string }): Promise<PaginatedResult<IUser>> {
    const { page, limit, search, status, roleId, createdBy, sortBy = 'createdAt', sortOrder = 'desc' } = query;
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
    if (createdBy) {
      filter.createdBy = createdBy;
    }

    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .select(
          'firstName lastName name email role status emailVerified termsAccepted lastLogin createdBy createdAt updatedAt',
        )
        .populate('role', 'name slug')
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      UserModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async countAdminsCreatedSince(since: Date, adminRoleId: string): Promise<number> {
    return UserModel.countDocuments({
      role: adminRoleId,
      createdAt: { $gte: since },
    }).exec();
  }

  async countAdmins(adminRoleId: string): Promise<number> {
    return UserModel.countDocuments({ role: adminRoleId }).exec();
  }
}

export const userRepository = new UserRepository();
