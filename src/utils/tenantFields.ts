import { Schema, Types } from 'mongoose';

/** Shared mongoose field for tenant-scoped feature documents. */
export const tenantIdField = {
  type: Schema.Types.ObjectId,
  ref: 'Tenant',
  default: null,
  index: true,
} as const;

export type TenantIdRef = Types.ObjectId | null;
