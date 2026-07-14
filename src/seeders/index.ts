import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '@/config/db';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { RoleModel } from '@/modules/role/role.model';
import { ModuleModel } from '@/modules/module/module.model';
import { PermissionModel } from '@/modules/permission/permission.model';
import { UserModel } from '@/modules/user/user.model';
import {
  DEFAULT_MODULES,
  ADMIN_DEFAULT_MODULE_SLUGS,
  ADMIN_DEFAULT_CRUD_MODULE_SLUGS,
  DEPRECATED_MODULE_SLUGS,
} from '@/constants/modules.seed';
import { seedReleaseMetadata } from '@/seeders/release-metadata.seed';
import { backfillFeatureTenantIds } from '@/seeders/backfill-feature-tenants';
import { AUTH_PROVIDER, ROLES, ROLE_STATUS, USER_STATUS } from '@/constants';
import { hashPassword } from '@/utils/password';
import { tenantService } from '@/modules/tenant/tenant.service';
import { permissionService } from '@/modules/permission/permission.service';

/**
 * Idempotent database seeder.
 * Every step uses upsert/find-or-create semantics, so running it repeatedly
 * never creates duplicates and is safe in CI/CD and production bootstrap.
 */
const seedRoles = async (): Promise<void> => {
  const roles = [
    {
      name: 'Master Admin',
      slug: ROLES.MASTER_ADMIN,
      description: 'Platform owner — all tenants',
      isSystem: true,
      status: ROLE_STATUS.ACTIVE,
    },
    {
      name: 'Super Admin',
      slug: ROLES.SUPER_ADMIN,
      description: 'Tenant owner — full access within one tenant',
      isSystem: true,
      status: ROLE_STATUS.ACTIVE,
    },
    {
      name: 'Admin',
      slug: ROLES.ADMIN,
      description: 'Tenant staff — access limited to assigned modules',
      isSystem: true,
      status: ROLE_STATUS.ACTIVE,
    },
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
 * Master + Super Admin permissions are implicit in code, but we still persist a
 * full matrix so the Permissions UI shows an accurate picture.
 */
const seedPermissions = async (): Promise<void> => {
  // Drop legacy unique index from pre-tenant Permission schema (ignore if missing).
  try {
    await PermissionModel.collection.dropIndex('roleId_1_moduleId_1');
  } catch {
    /* index may already be gone */
  }

  const [masterRole, superAdminRole, adminRole, modules] = await Promise.all([
    RoleModel.findOne({ slug: ROLES.MASTER_ADMIN }),
    RoleModel.findOne({ slug: ROLES.SUPER_ADMIN }),
    RoleModel.findOne({ slug: ROLES.ADMIN }),
    ModuleModel.find(),
  ]);
  if (!masterRole || !superAdminRole || !adminRole) {
    throw new Error('Roles must be seeded before permissions');
  }

  const rootModules = modules.filter((m) => !m.parentSlug);
  const childModules = modules.filter((m) => m.parentSlug);
  const childIds = childModules.map((m) => m._id);
  const elevatedRoleIds = [masterRole._id, superAdminRole._id];

  for (const roleId of elevatedRoleIds) {
    for (const moduleDoc of rootModules) {
      await PermissionModel.updateOne(
        { roleId, moduleId: moduleDoc._id, tenantId: null },
        {
          $set: {
            canView: true,
            canCreate: true,
            canUpdate: true,
            canDelete: true,
            tenantId: null,
          },
        },
        { upsert: true },
      );
    }
  }

  const adminSlugs = new Set(ADMIN_DEFAULT_MODULE_SLUGS as readonly string[]);
  const adminCrudSlugs = new Set(ADMIN_DEFAULT_CRUD_MODULE_SLUGS as readonly string[]);
  for (const moduleDoc of rootModules) {
    const granted = adminSlugs.has(moduleDoc.slug);
    const crudGranted = adminCrudSlugs.has(moduleDoc.slug);
    await PermissionModel.updateOne(
      { roleId: adminRole._id, moduleId: moduleDoc._id, tenantId: null },
      {
        $set: {
          canView: granted,
          canCreate: crudGranted,
          canUpdate: crudGranted,
          canDelete: crudGranted,
          tenantId: null,
        },
      },
      { upsert: true },
    );
  }

  if (childIds.length > 0) {
    await PermissionModel.deleteMany({
      roleId: { $in: [...elevatedRoleIds, adminRole._id] },
      moduleId: { $in: childIds },
    });
  }

  logger.info('Permissions seeded');
};

const seedUsers = async (): Promise<void> => {
  const [masterRole, superAdminRole, adminRole] = await Promise.all([
    RoleModel.findOne({ slug: ROLES.MASTER_ADMIN }),
    RoleModel.findOne({ slug: ROLES.SUPER_ADMIN }),
    RoleModel.findOne({ slug: ROLES.ADMIN }),
  ]);
  if (!masterRole || !superAdminRole || !adminRole) {
    throw new Error('Roles must be seeded before users');
  }

  const legacyTenant = await tenantService.ensureLegacyTenant();
  const legacyTenantId = legacyTenant._id as Types.ObjectId;

  // Phase 2 cutover: former platform Super Admin account → Master Admin.
  // Use SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD env (existing creds).
  const masterEmail = env.SUPER_ADMIN_EMAIL.toLowerCase();
  const masterPasswordHash = await hashPassword(env.SUPER_ADMIN_PASSWORD);

  await UserModel.updateOne(
    { email: masterEmail },
    {
      $set: {
        firstName: 'Master',
        lastName: 'Admin',
        name: 'Master Admin',
        email: masterEmail,
        password: masterPasswordHash,
        provider: AUTH_PROVIDER.LOCAL,
        emailVerified: true,
        otpVerified: true,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
        role: masterRole._id,
        status: USER_STATUS.ACTIVE,
        tenantId: null,
      },
    },
    { upsert: true },
  );
  logger.info(`Upserted Master Admin: ${masterEmail}`);

  // Any remaining users still on the old platform Super Admin role → Master.
  const migrated = await UserModel.updateMany(
    { role: superAdminRole._id, email: { $ne: masterEmail } },
    { $set: { role: masterRole._id, tenantId: null } },
  );
  if (migrated.modifiedCount > 0) {
    logger.info(`Migrated ${migrated.modifiedCount} legacy Super Admin user(s) → Master Admin`);
  }

  const adminEmail = env.ADMIN_EMAIL.toLowerCase();
  const adminPasswordHash = await hashPassword(env.ADMIN_PASSWORD);
  await UserModel.updateOne(
    { email: adminEmail },
    {
      $set: {
        firstName: 'Admin',
        lastName: 'User',
        name: 'Admin User',
        email: adminEmail,
        password: adminPasswordHash,
        provider: AUTH_PROVIDER.LOCAL,
        emailVerified: true,
        otpVerified: true,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
        role: adminRole._id,
        status: USER_STATUS.ACTIVE,
        tenantId: legacyTenantId,
      },
    },
    { upsert: true },
  );
  logger.info(`Upserted Admin: ${adminEmail}`);

  const adminBackfill = await UserModel.updateMany(
    {
      role: adminRole._id,
      $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
    },
    { $set: { tenantId: legacyTenantId } },
  );
  if (adminBackfill.modifiedCount > 0) {
    logger.info(`Backfilled tenantId on ${adminBackfill.modifiedCount} admin user(s)`);
  }

  await permissionService.ensureTenantAdminPermissions(legacyTenantId.toString());
  logger.info('Ensured Legacy tenant Admin permission matrix');
};

const run = async (): Promise<void> => {
  try {
    await connectDatabase();
    await seedRoles();
    await seedModules();
    await seedPermissions();
    await seedUsers();
    await seedReleaseMetadata();
    await backfillFeatureTenantIds();
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
