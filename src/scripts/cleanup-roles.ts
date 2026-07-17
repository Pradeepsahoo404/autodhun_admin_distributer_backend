import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import { ROLES } from '@/constants';
import { RoleModel } from '@/modules/role/role.model';
import { PermissionModel } from '@/modules/permission/permission.model';
import { UserModel } from '@/modules/user/user.model';

/**
 * Removes any role that is NOT one of the three canonical roles
 * (Super Admin, Sub Admin, Admin) — e.g. a stray "Master Admin" left in the DB.
 * A role is only deleted when no users are assigned to it; otherwise it is
 * reported so the assigned users can be reassigned first.
 */
const run = async (): Promise<void> => {
  try {
    await connectDatabase();

    const canonicalSlugs = Object.values(ROLES) as string[];
    const strayRoles = await RoleModel.find({ slug: { $nin: canonicalSlugs } });

    if (strayRoles.length === 0) {
      logger.info('No stray roles found — nothing to clean up.');
      return;
    }

    for (const role of strayRoles) {
      const userCount = await UserModel.countDocuments({ role: role._id });

      if (userCount > 0) {
        logger.warn(
          `Skipping "${role.name}" (slug: ${role.slug}) — ${userCount} user(s) assigned. ` +
            'Reassign these users to another role, then re-run this script.',
        );
        continue;
      }

      const permResult = await PermissionModel.deleteMany({ roleId: role._id });
      await RoleModel.deleteOne({ _id: role._id });
      logger.info(
        `Deleted role "${role.name}" (slug: ${role.slug}) and ${permResult.deletedCount} permission row(s).`,
      );
    }

    logger.info('Role cleanup complete.');
  } catch (error) {
    logger.error('Role cleanup failed', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
    await mongoose.disconnect();
  }
};

void run();
