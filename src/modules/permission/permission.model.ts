import { Schema, model, Document, Types } from 'mongoose';

export interface IPermission extends Document {
  _id: Types.ObjectId;
  roleId: Types.ObjectId;
  moduleId: Types.ObjectId;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    canView: { type: Boolean, default: false },
    canCreate: { type: Boolean, default: false },
    canUpdate: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One permission document per (role, module) pair.
permissionSchema.index({ roleId: 1, moduleId: 1 }, { unique: true });

export const PermissionModel = model<IPermission>('Permission', permissionSchema);
