import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '@/config/db';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { RoleModel } from '@/modules/role/role.model';
import { ModuleModel } from '@/modules/module/module.model';
import { PermissionModel } from '@/modules/permission/permission.model';
import { UserModel } from '@/modules/user/user.model';
import { DEFAULT_MODULES, ADMIN_DEFAULT_MODULE_SLUGS, ADMIN_DEFAULT_CRUD_MODULE_SLUGS, DEPRECATED_MODULE_SLUGS } from '@/constants/modules.seed';
import { seedReleaseMetadata } from '@/seeders/release-metadata.seed';
import { AUTH_PROVIDER, ROLES, ROLE_STATUS, USER_STATUS } from '@/constants';
import { hashPassword } from '@/utils/password';

/**
 * Idempotent database seeder.
 * Every step uses upsert/find-or-create semantics, so running it repeatedly
 * never creates duplicates and is safe in CI/CD and production bootstrap.
 */
const seedRoles = async (): Promise<void> => {
  const roles = [
    { name: 'Super Admin', slug: ROLES.SUPER_ADMIN, description: 'Full unrestricted access', isSystem: true, status: ROLE_STATUS.ACTIVE },
    { name: 'Sub Admin', slug: ROLES.SUB_ADMIN, description: 'Scoped admin with per-user module permissions', isSystem: true, status: ROLE_STATUS.ACTIVE },
    { name: 'Admin', slug: ROLES.ADMIN, description: 'Access limited to assigned modules', isSystem: true, status: ROLE_STATUS.ACTIVE },
  ];
  for (const role of roles) {
    await RoleModel.updateOne({ slug: role.slug }, { $set: role }, { upsert: true });
  }
  logger.info('Roles seeded');
};

const seedModules = async (): Promise<void> => {
  for (const moduleSeed of DEFAULT_MODULES) {
    await ModuleModel.updateOne({ slug: moduleSeed.slug }, { $set: moduleSeed }, { upsert: true });
  }

  if (DEPRECATED_MODULE_SLUGS.length > 0) {
    const deprecated = await ModuleModel.find({ slug: { $in: [...DEPRECATED_MODULE_SLUGS] } }).select('_id');
    const deprecatedIds = deprecated.map((m) => m._id);
    if (deprecatedIds.length > 0) {
      await PermissionModel.deleteMany({ moduleId: { $in: deprecatedIds } });
      await ModuleModel.deleteMany({ _id: { $in: deprecatedIds } });
    }
  }

  logger.info('Modules seeded');
};

/**
 * Super Admin permissions are implicit in code, but we still persist a full
 * matrix so the Permissions UI shows an accurate picture. Admin only gets
 * Dashboard view by default.
 */
const seedPermissions = async (): Promise<void> => {
  const [superAdminRole, adminRole, modules] = await Promise.all([
    RoleModel.findOne({ slug: ROLES.SUPER_ADMIN }),
    RoleModel.findOne({ slug: ROLES.ADMIN }),
    ModuleModel.find(),
  ]);
  if (!superAdminRole || !adminRole) throw new Error('Roles must be seeded before permissions');

  const rootModules = modules.filter((m) => !m.parentSlug);
  const childModules = modules.filter((m) => m.parentSlug);
  const childIds = childModules.map((m) => m._id);

  // Persist permissions on root modules only (children inherit at runtime).
  for (const moduleDoc of rootModules) {
    await PermissionModel.updateOne(
      { roleId: superAdminRole._id, moduleId: moduleDoc._id },
      { $set: { canView: true, canCreate: true, canUpdate: true, canDelete: true } },
      { upsert: true },
    );
  }

  const adminSlugs = new Set(ADMIN_DEFAULT_MODULE_SLUGS as readonly string[]);
  const adminCrudSlugs = new Set(ADMIN_DEFAULT_CRUD_MODULE_SLUGS as readonly string[]);
  for (const moduleDoc of rootModules) {
    const granted = adminSlugs.has(moduleDoc.slug);
    const crudGranted = adminCrudSlugs.has(moduleDoc.slug);
    await PermissionModel.updateOne(
      { roleId: adminRole._id, moduleId: moduleDoc._id },
      {
        $set: {
          canView: granted,
          canCreate: crudGranted,
          canUpdate: crudGranted,
          canDelete: crudGranted,
        },
      },
      { upsert: true },
    );
  }

  if (childIds.length > 0) {
    await PermissionModel.deleteMany({
      roleId: { $in: [superAdminRole._id, adminRole._id] },
      moduleId: { $in: childIds },
    });
  }

  logger.info('Permissions seeded');
};

const seedUsers = async (): Promise<void> => {
  const [superAdminRole, adminRole] = await Promise.all([
    RoleModel.findOne({ slug: ROLES.SUPER_ADMIN }),
    RoleModel.findOne({ slug: ROLES.ADMIN }),
  ]);
  if (!superAdminRole || !adminRole) throw new Error('Roles must be seeded before users');

  const accounts = [
    {
      email: env.SUPER_ADMIN_EMAIL,
      password: env.SUPER_ADMIN_PASSWORD,
      firstName: 'Super',
      lastName: 'Admin',
      role: superAdminRole._id,
    },
    {
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
      firstName: 'Admin',
      lastName: 'User',
      role: adminRole._id,
    },
  ];

  for (const account of accounts) {
    const email = account.email.toLowerCase();
    const passwordHash = await hashPassword(account.password);

    await UserModel.updateOne(
      { email },
      {
        $set: {
          firstName: account.firstName,
          lastName: account.lastName,
          name: `${account.firstName} ${account.lastName}`,
          email,
          password: passwordHash,
          provider: AUTH_PROVIDER.LOCAL,
          emailVerified: true,
          otpVerified: true,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
          role: account.role,
          status: USER_STATUS.ACTIVE,
        },
      },
      { upsert: true },
    );
    logger.info(`Upserted user: ${email}`);
  }
};

const run = async (): Promise<void> => {
  try {
    await connectDatabase();
    await seedRoles();
    await seedModules();
    await seedPermissions();
    await seedUsers();
    await seedReleaseMetadata();
    logger.info('Database seeding complete');
  } catch (error) {
    logger.error('Seeding failed', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
    await mongoose.disconnect();
  }
};

void run();
