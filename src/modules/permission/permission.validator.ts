import { z } from 'zod';
import { objectId } from '@/validators/common.validator';

export const listPermissionQuerySchema = z.object({
  roleId: objectId.optional(),
  tenantId: objectId.optional(),
});

export const matrixPermissionQuerySchema = z.object({
  roleId: objectId,
  tenantId: objectId.optional(),
});

export const bulkSetPermissionSchema = z.object({
  roleId: objectId,
  tenantId: objectId.optional().nullable(),
  permissions: z
    .array(
      z.object({
        moduleId: objectId,
        canView: z.boolean().optional().default(false),
        canCreate: z.boolean().optional().default(false),
        canUpdate: z.boolean().optional().default(false),
        canDelete: z.boolean().optional().default(false),
      }),
    )
    .min(1, 'At least one permission row is required'),
});

export const setPermissionSchema = z.object({
  roleId: objectId,
  moduleId: objectId,
  tenantId: objectId.optional().nullable(),
  canView: z.boolean().optional().default(false),
  canCreate: z.boolean().optional().default(false),
  canUpdate: z.boolean().optional().default(false),
  canDelete: z.boolean().optional().default(false),
});

export const updatePermissionSchema = z.object({
  canView: z.boolean().optional(),
  canCreate: z.boolean().optional(),
  canUpdate: z.boolean().optional(),
  canDelete: z.boolean().optional(),
});

export type SetPermissionDto = z.infer<typeof setPermissionSchema>;
