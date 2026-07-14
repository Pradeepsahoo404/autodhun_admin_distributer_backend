import mongoose from 'mongoose';
import { ApiError } from '@/utils/ApiError';
import { TENANT_STATUS, LEGACY_TENANT_NAME, LEGACY_TENANT_SLUG } from '@/constants/tenant';
import { AUTH_PROVIDER, ROLES, USER_STATUS, TENANT_INACTIVE_MESSAGE } from '@/constants';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { hashPassword } from '@/utils/password';
import { generateSecurePassword } from '@/utils/generatePassword';
import { buildInviteAdminEmail, sendMail } from '@/utils/email';
import { roleRepository } from '@/modules/role/role.repository';
import { userRepository } from '@/modules/user/user.repository';
import { permissionService } from '@/modules/permission/permission.service';
import { TenantModel, ITenant } from './tenant.model';
import { tenantRepository } from './tenant.repository';
import { UserModel, IUser } from '@/modules/user/user.model';
import { CreateTenantDto, ListTenantsQueryDto, UpdateTenantDto } from './tenant.validator';
import { PaginatedResult } from '@/types';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export interface TenantWithSuperAdmin {
  tenant: ITenant;
  superAdmin: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
  };
  /** Only when Master supplied no password (generated). */
  temporaryPassword?: string;
}

class TenantService {
  list(query: ListTenantsQueryDto): Promise<PaginatedResult<ITenant>> {
    return tenantRepository.paginate(query);
  }

  async getById(id: string): Promise<ITenant & { superAdmin?: Record<string, unknown> | null }> {
    const tenant = await tenantRepository.findById(id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const saRole = await roleRepository.findBySlug(ROLES.SUPER_ADMIN);
    let superAdmin: Record<string, unknown> | null = null;
    if (saRole) {
      const user = await UserModel.findOne({
        tenantId: tenant._id,
        role: saRole._id,
      })
        .select('_id firstName lastName name email status createdAt')
        .lean()
        .exec();
      if (user) {
        superAdmin = {
          id: user._id.toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          email: user.email,
          status: user.status,
          createdAt: user.createdAt,
        };
      }
    }

    return Object.assign(tenant, { superAdmin });
  }

  /**
   * Master provisions a tenant + its Super Admin in one transaction.
   * Super Admin gets full elevated access within that tenant (Phase 6 scopes data).
   */
  async createWithSuperAdmin(dto: CreateTenantDto, actorId: string): Promise<TenantWithSuperAdmin> {
    const slug = (dto.slug ?? slugify(dto.name)).toLowerCase();
    if (!slug) throw ApiError.badRequest('Invalid tenant slug');
    if (slug === LEGACY_TENANT_SLUG) {
      throw ApiError.badRequest('This tenant slug is reserved');
    }

    const existingSlug = await tenantRepository.findBySlug(slug);
    if (existingSlug) throw ApiError.conflict('A tenant with this slug already exists');

    const email = dto.superAdmin.email.toLowerCase().trim();
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw ApiError.conflict('A user with this email already exists');

    const saRole = await roleRepository.findBySlug(ROLES.SUPER_ADMIN);
    if (!saRole) throw ApiError.internal('Super Admin role is not configured. Run the seeder.');

    const plainPassword = dto.superAdmin.password?.trim() || generateSecurePassword();
    const passwordHash = await hashPassword(plainPassword);
    const firstName = dto.superAdmin.firstName.trim();
    const lastName = (dto.superAdmin.lastName ?? '').trim();
    const fullName = `${firstName} ${lastName}`.trim();

    const session = await mongoose.startSession();
    let tenant!: ITenant;
    let superAdminUser!: IUser;

    try {
      session.startTransaction();

      const [createdTenant] = await TenantModel.create(
        [
          {
            name: dto.name.trim(),
            slug,
            status: dto.status ?? TENANT_STATUS.ACTIVE,
            createdBy: actorId,
          },
        ],
        { session },
      );
      tenant = createdTenant;

      const [createdUser] = await UserModel.create(
        [
          {
            firstName,
            lastName,
            name: fullName,
            email,
            password: passwordHash,
            provider: AUTH_PROVIDER.LOCAL,
            emailVerified: true,
            otpVerified: true,
            termsAccepted: false,
            role: saRole._id,
            tenantId: tenant._id,
            status: USER_STATUS.ACTIVE,
            createdBy: actorId,
            updatedBy: actorId,
          },
        ],
        { session },
      );
      superAdminUser = createdUser;

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    await permissionService.ensureTenantAdminPermissions(tenant._id.toString()).catch((error) => {
      logger.error('Failed to seed tenant Admin permissions', { tenantId: tenant._id.toString(), error });
    });

    await this.sendSuperAdminInvite(superAdminUser, plainPassword).catch((error) => {
      logger.error('Failed to email tenant Super Admin invite', { email, error });
    });

    return {
      tenant,
      superAdmin: {
        id: superAdminUser._id.toString(),
        firstName: superAdminUser.firstName,
        lastName: superAdminUser.lastName,
        name: superAdminUser.name,
        email: superAdminUser.email,
      },
      ...(!dto.superAdmin.password ? { temporaryPassword: plainPassword } : {}),
    };
  }

  /** @deprecated use createWithSuperAdmin — retained for internal Legacy bootstrap only */
  async create(dto: Omit<CreateTenantDto, 'superAdmin'> & { superAdmin?: never }, actorId?: string): Promise<ITenant> {
    const slug = (dto.slug ?? slugify(dto.name)).toLowerCase();
    if (!slug) throw ApiError.badRequest('Invalid tenant slug');

    const existing = await tenantRepository.findBySlug(slug);
    if (existing) throw ApiError.conflict('A tenant with this slug already exists');

    return tenantRepository.create({
      name: dto.name.trim(),
      slug,
      status: dto.status ?? TENANT_STATUS.ACTIVE,
      createdBy: actorId as never,
    });
  }

  async update(id: string, dto: UpdateTenantDto, actorId?: string): Promise<ITenant> {
    const tenant = await tenantRepository.findById(id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    if (tenant.slug === LEGACY_TENANT_SLUG && dto.status === TENANT_STATUS.INACTIVE) {
      throw ApiError.badRequest('Legacy tenant cannot be deactivated while used for migration');
    }

    const updated = await tenantRepository.updateById(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      updatedBy: actorId as never,
    });
    if (!updated) throw ApiError.internal('Failed to update tenant');
    return updated;
  }

  async ensureLegacyTenant(actorId?: string): Promise<ITenant> {
    const existing = await tenantRepository.findBySlug(LEGACY_TENANT_SLUG);
    if (existing) return existing;

    return tenantRepository.create({
      name: LEGACY_TENANT_NAME,
      slug: LEGACY_TENANT_SLUG,
      status: TENANT_STATUS.ACTIVE,
      createdBy: actorId as never,
    });
  }

  /** True when tenant exists and is active (Master / no-tenant users always pass). */
  async assertTenantActive(tenantId: string | null | undefined): Promise<void> {
    if (!tenantId) return;
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant || tenant.status !== TENANT_STATUS.ACTIVE) {
      throw ApiError.forbidden(TENANT_INACTIVE_MESSAGE);
    }
  }

  private async sendSuperAdminInvite(user: IUser, plainPassword: string): Promise<void> {
    const loginUrl = `${env.CLIENT_URL}/login`;
    const { subject, html, text } = buildInviteAdminEmail({
      name: user.name,
      email: user.email,
      password: plainPassword,
      loginUrl,
      personalMessage:
        'You have been provisioned as a Super Admin (tenant owner) on Autodhun. You can manage your organization and invite Admins.',
    });
    await sendMail({ to: user.email, subject: subject.replace('Admin', 'Super Admin'), html, text });
  }
}

export const tenantService = new TenantService();
