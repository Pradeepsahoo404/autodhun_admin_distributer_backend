import { userRepository } from './user.repository';
import { roleRepository } from '@/modules/role/role.repository';
import { tenantRepository } from '@/modules/tenant/tenant.repository';
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
import { isElevatedRole, isMasterAdminRole } from '@/utils/roles';

export interface UserActor {
  id: string;
  role: string;
  isMasterAdmin: boolean;
  isSuperAdmin: boolean;
  tenantId: string | null;
}

class UserService {
  async list(query: PaginationQuery, actor: UserActor): Promise<PaginatedResult<IUser>> {
    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) {
      return { items: [], total: 0, page: query.page, limit: query.limit, totalPages: 0 };
    }

    const tenantId = this.resolveListTenantId(query.tenantId, actor);

    return userRepository.paginate({
      ...query,
      roleId: adminRole._id.toString(),
      ...(tenantId ? { tenantId } : {}),
    });
  }

  async getById(id: string, actor: UserActor): Promise<IUser> {
    const user = await userRepository.findByIdWithRole(id);
    if (!user) throw ApiError.notFound('User not found');
    this.assertCanAccessUser(user, actor);
    return user;
  }

  async create(dto: CreateUserDto, actor: UserActor): Promise<IUser> {
    if (!actor.isMasterAdmin && !actor.tenantId) {
      throw ApiError.forbidden('Your account is not assigned to a tenant');
    }

    const existing = await userRepository.findByEmail(dto.email);
    if (existing) throw ApiError.conflict('A user with this email already exists');

    const role = await roleRepository.findById(dto.role);
    if (!role) throw ApiError.notFound('Assigned role does not exist');
    if (!actor.isMasterAdmin && role.slug !== ROLES.ADMIN) {
      throw ApiError.forbidden('You can only create Admin users');
    }

    const tenantId = actor.isMasterAdmin
      ? ((dto as CreateUserDto & { tenantId?: string }).tenantId ?? null)
      : actor.tenantId;
    if (!tenantId) {
      throw ApiError.badRequest('tenantId is required when creating an Admin');
    }

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
      tenantId: tenantId as never,
      status: dto.status ?? USER_STATUS.ACTIVE,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
  }

  /** Super Admin (or Master with tenantId) invites a new Admin. */
  async inviteAdmin(dto: InviteAdminDto & { tenantId?: string }, actor: UserActor): Promise<IUser> {
    const tenantId = await this.resolveInviteTenantId(dto.tenantId, actor);

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
      tenantId: tenantId as never,
      status: USER_STATUS.ACTIVE,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });

    await this.sendInviteEmail(user, plainPassword, dto.personalMessage);

    const populated = await userRepository.findByIdWithRole(user._id.toString());
    return populated as IUser;
  }

  async resendInvite(id: string, dto: ResendInviteDto, actor: UserActor): Promise<IUser> {
    const user = await userRepository.findByIdWithRole(id);
    if (!user) throw ApiError.notFound('User not found');
    this.assertCanAccessUser(user, actor);

    const role = user.role as unknown as IRole;
    if (isElevatedRole(role.slug)) {
      throw ApiError.forbidden('Cannot resend invite for Master / Super Admin');
    }
    if (role.slug !== ROLES.ADMIN) {
      throw ApiError.badRequest('Invite resend is only available for Admin users');
    }

    const plainPassword = generateSecurePassword();
    const password = await hashPassword(plainPassword);

    await userRepository.updateById(id, {
      password,
      status: USER_STATUS.ACTIVE,
      updatedBy: actor.id as never,
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

  async update(id: string, dto: UpdateUserDto, actor: UserActor): Promise<IUser> {
    const user = await userRepository.findByIdWithRole(id);
    if (!user) throw ApiError.notFound('User not found');
    this.assertCanAccessUser(user, actor);

    if (id === actor.id && dto.status && dto.status !== USER_STATUS.ACTIVE) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }

    const currentRole = user.role as unknown as IRole;
    if (isElevatedRole(currentRole.slug) && (dto.role || dto.status === USER_STATUS.BLOCKED)) {
      throw ApiError.forbidden('Master / Super Admin account cannot be downgraded or blocked');
    }

    if (dto.role && !actor.isMasterAdmin) {
      const nextRole = await roleRepository.findById(dto.role);
      if (!nextRole || nextRole.slug !== ROLES.ADMIN) {
        throw ApiError.forbidden('You can only assign the Admin role');
      }
    }

    const $set: Record<string, unknown> = { updatedBy: actor.id as never };

    if (dto.firstName !== undefined) $set.firstName = dto.firstName;
    if (dto.lastName !== undefined) $set.lastName = dto.lastName;
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      $set.name = `${dto.firstName ?? user.firstName} ${dto.lastName ?? user.lastName}`.trim();
    }
    if (dto.role) $set.role = dto.role;
    if (dto.status) $set.status = dto.status;
    if (dto.password) $set.password = await hashPassword(dto.password);

    if (dto.postalAddress !== undefined) $set['profile.postalAddress'] = dto.postalAddress;
    if (dto.state !== undefined) $set['profile.state'] = dto.state;
    if (dto.countryRegion !== undefined) $set['profile.countryRegion'] = dto.countryRegion;
    if (dto.phoneNumber !== undefined) $set['profile.phoneNumber'] = dto.phoneNumber;
    if (dto.labelName !== undefined) $set['profile.labelName'] = dto.labelName;

    if (dto.bankName !== undefined) $set['bankDetails.bankName'] = dto.bankName;
    if (dto.accountNumber !== undefined) $set['bankDetails.accountNumber'] = dto.accountNumber;
    if (dto.ifscCode !== undefined) $set['bankDetails.ifscCode'] = dto.ifscCode;
    if (dto.swiftCode !== undefined) $set['bankDetails.swiftCode'] = dto.swiftCode;
    if (dto.micrCode !== undefined) $set['bankDetails.micrCode'] = dto.micrCode;

    const updated = await userRepository.updateById(id, { $set });
    if (!updated) throw ApiError.internal('Failed to update user');

    const populated = await userRepository.findByIdWithRole(id);
    return populated as IUser;
  }

  async updateStatus(
    id: string,
    status: (typeof USER_STATUS)[keyof typeof USER_STATUS],
    actor: UserActor,
  ): Promise<IUser> {
    return this.update(id, { status }, actor);
  }

  async remove(id: string, actor: UserActor): Promise<void> {
    if (id === actor.id) throw ApiError.badRequest('You cannot delete your own account');

    const user = await userRepository.findByIdWithRole(id);
    if (!user) throw ApiError.notFound('User not found');
    this.assertCanAccessUser(user, actor);

    const role = user.role as unknown as IRole;
    if (isElevatedRole(role.slug)) throw ApiError.forbidden('Master / Super Admin account cannot be deleted');

    await userRepository.deleteById(id);
  }

  async getAdminCreationStats(actor: UserActor): Promise<{
    total: number;
    last7Days: number;
    last30Days: number;
    last90Days: number;
    last365Days: number;
  }> {
    const adminRole = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!adminRole) {
      return { total: 0, last7Days: 0, last30Days: 0, last90Days: 0, last365Days: 0 };
    }

    const roleId = adminRole._id.toString();
    const tenantId = actor.isMasterAdmin ? null : actor.tenantId;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const [total, last7Days, last30Days, last90Days, last365Days] = await Promise.all([
      userRepository.countAdmins(roleId, tenantId),
      userRepository.countAdminsCreatedSince(new Date(now - 7 * dayMs), roleId, tenantId),
      userRepository.countAdminsCreatedSince(new Date(now - 30 * dayMs), roleId, tenantId),
      userRepository.countAdminsCreatedSince(new Date(now - 90 * dayMs), roleId, tenantId),
      userRepository.countAdminsCreatedSince(new Date(now - 365 * dayMs), roleId, tenantId),
    ]);

    return { total, last7Days, last30Days, last90Days, last365Days };
  }

  private resolveListTenantId(queryTenantId: string | undefined, actor: UserActor): string | null {
    if (actor.isMasterAdmin) {
      return queryTenantId ?? null;
    }
    if (!actor.tenantId) {
      throw ApiError.forbidden('Your account is not assigned to a tenant');
    }
    return actor.tenantId;
  }

  private async resolveInviteTenantId(
    requestedTenantId: string | undefined,
    actor: UserActor,
  ): Promise<string> {
    if (actor.isMasterAdmin || isMasterAdminRole(actor.role)) {
      if (!requestedTenantId) {
        throw ApiError.badRequest('tenantId is required when Master invites an Admin');
      }
      const tenant = await tenantRepository.findById(requestedTenantId);
      if (!tenant) throw ApiError.notFound('Tenant not found');
      return requestedTenantId;
    }

    if (!actor.tenantId) {
      throw ApiError.forbidden('Your account is not assigned to a tenant');
    }
    if (requestedTenantId && requestedTenantId !== actor.tenantId) {
      throw ApiError.forbidden('Cannot invite admins for another tenant');
    }
    return actor.tenantId;
  }

  private assertCanAccessUser(user: IUser, actor: UserActor): void {
    if (actor.isMasterAdmin) return;
    const userTenantId = user.tenantId ? user.tenantId.toString() : null;
    if (!actor.tenantId || userTenantId !== actor.tenantId) {
      throw ApiError.forbidden('You do not have access to this user');
    }
  }
}

export const userService = new UserService();
