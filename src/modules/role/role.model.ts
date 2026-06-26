import { Schema, model, Document, Types } from 'mongoose';
import { ROLE_STATUS, RoleStatus } from '@/constants';

export interface IRole extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  status: RoleStatus;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: '' },
    status: { type: String, enum: Object.values(ROLE_STATUS), default: ROLE_STATUS.ACTIVE },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const RoleModel = model<IRole>('Role', roleSchema);
