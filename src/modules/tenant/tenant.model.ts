import { Schema, model, Document, Types } from 'mongoose';
import { TENANT_STATUS, TenantStatus } from '@/constants/tenant';

export interface ITenant extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  status: TenantStatus;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TENANT_STATUS),
      default: TENANT_STATUS.ACTIVE,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const TenantModel = model<ITenant>('Tenant', tenantSchema);
