import { userRepository } from './user.repository';
import { roleRepository } from '@/modules/role/role.repository';
import { hashPassword } from '@/utils/password';
import { ApiError } from '@/utils/ApiError';
import { buildInviteAdminEmail, sendMail } from '@/utils/email';
import { generateSecurePassword } from '@/utils/generatePassword';
import { env } from '@/config/env';
import { AUTH_PROVIDER, ROLES, USER_STATUS } from '@/constants';
import { IUser } from './user.model';
import { PaginatedResult, PaginationQuery } from '@/types';
import { CreateUserDto, InviteAdminDto, ResendInviteDto, UpdateUserDto } from './user.validator';
import { IRole } from '@/modules/role/role.model';

class UserService {
  async list(query: PaginationQuery): Promise<PaginatedResult<IUser>> {
    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) {
      return { items: [], total: 0, page: query.page, limit: query.limit, totalPages: 0 };
    }

    return userRepository.paginate({
      ...query,
      roleId: adminRole._id.toString(),
    });
  }

  async getById(id: string): Promise<IUser> {
    const user = await userRepository.findByIdWithRole(id);
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actorId: string): Promise<IUser> {
    const existing = await userRepository.findByEmail(dto.email);
    if (existing) throw ApiError.conflict('A user with this email already exists');

    const role = await roleRepository.findById(dto.role);
    if (!role) throw ApiError.notFound('Assigned role does not exist');

    const password = await hashPassword(dto.password);
    const fullName = `${dto.firstName} ${dto.lastName ?? ''}`.trim();

    return userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName ?? '',
      name: fullName,
      email: dto.email,
      password,
      provider: AUTH_PROVIDER.LOCAL,
      emailVerified: true,
      otpVerified: true,
      role: role._id,
      status: dto.status ?? USER_STATUS.ACTIVE,
      createdBy: actorId as never,
      updatedBy: actorId as never,
    });
  }

  /** Super Admin invites a new Admin — generates credentials and emails them. */
  async inviteAdmin(dto: InviteAdminDto, actorId: string): Promise<IUser> {
    const existing = await userRepository.findByEmail(dto.email);
    if (existing) throw ApiError.conflict('A user with this email already exists');

    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) throw ApiError.internal('Admin role is not configured');

    const plainPassword = generateSecurePassword();
    const password = await hashPassword(plainPassword);
    const fullName = `${dto.firstName} ${dto.lastName ?? ''}`.trim();

    const user = await userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName ?? '',
      name: fullName,
      email: dto.email,
      password,
      provider: AUTH_PROVIDER.LOCAL,
      emailVerified: true,
      otpVerified: true,
      termsAccepted: false,
      role: adminRole._id,
      status: USER_STATUS.ACTIVE,
      createdBy: actorId as never,
      updatedBy: actorId as never,
    });

    await this.sendInviteEmail(user, plainPassword, dto.personalMessage);

    const populated = await userRepository.findByIdWithRole(user._id.toString());
    return populated as IUser;
  }

  /** Regenerates credentials and resends the invite email for an Admin user. */
  async resendInvite(id: string, dto: ResendInviteDto, actorId: string): Promise<IUser> {
    const user = await userRepository.findByIdWithRole(id);
    if (!user) throw ApiError.notFound('User not found');

    const role = user.role as unknown as IRole;
    if (role.slug === ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('Cannot resend invite for Super Admin');
    }
    if (role.slug !== ROLES.ADMIN) {
      throw ApiError.badRequest('Invite resend is only available for Admin users');
    }

    const plainPassword = generateSecurePassword();
    const password = await hashPassword(plainPassword);

    await userRepository.updateById(id, {
      password,
      status: USER_STATUS.ACTIVE,
      updatedBy: actorId as never,
    });

    await this.sendInviteEmail(user, plainPassword, dto.personalMessage);

    const updated = await userRepository.findByIdWithRole(id);
    return updated as IUser;
  }

  private async sendInviteEmail(user: IUser, plainPassword: string, personalMessage?: string): Promise<void> {
    const loginUrl = `${env.CLIENT_URL}/login`;
    const { subject, html, text } = buildInviteAdminEmail({
      name: user.name,
      email: user.email,
      password: plainPassword,
      loginUrl,
      personalMessage,
    });

    await sendMail({ to: user.email, subject, html, text });
  }

  async update(id: string, dto: UpdateUserDto, actorId: string): Promise<IUser> {
    const user = await userRepository.findByIdWithRole(id);
    if (!user) throw ApiError.notFound('User not found');

    const currentRole = user.role as unknown as IRole;
    if (currentRole.slug === ROLES.SUPER_ADMIN && (dto.role || dto.status === USER_STATUS.BLOCKED)) {
      throw ApiError.forbidden('Super Admin account cannot be downgraded or blocked');
    }

    const update: Partial<IUser> = { updatedBy: actorId as never };
    if (dto.firstName !== undefined) update.firstName = dto.firstName;
    if (dto.lastName !== undefined) update.lastName = dto.lastName;
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      update.name = `${dto.firstName ?? user.firstName} ${dto.lastName ?? user.lastName}`.trim();
    }
    if (dto.role) update.role = dto.role as never;
    if (dto.status) update.status = dto.status;
    if (dto.password) update.password = await hashPassword(dto.password);

    const updated = await userRepository.updateById(id, update);
    return updated as IUser;
  }

  async updateStatus(id: string, status: typeof USER_STATUS[keyof typeof USER_STATUS], actorId: string): Promise<IUser> {
    return this.update(id, { status }, actorId);
  }

  async remove(id: string, actorId: string): Promise<void> {
    if (id === actorId) throw ApiError.badRequest('You cannot delete your own account');

    const user = await userRepository.findByIdWithRole(id);
    if (!user) throw ApiError.notFound('User not found');

    const role = user.role as unknown as IRole;
    if (role.slug === ROLES.SUPER_ADMIN) throw ApiError.forbidden('Super Admin account cannot be deleted');

    await userRepository.deleteById(id);
  }
}

export const userService = new UserService();
