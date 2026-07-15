import { Schema, model, Document, Types } from 'mongoose';

export interface IUserPermission extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  moduleId: Types.ObjectId;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userPermissionSchema = new Schema<IUserPermission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    canView: { type: Boolean, default: false },
    canCreate: { type: Boolean, default: false },
    canUpdate: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userPermissionSchema.index({ userId: 1, moduleId: 1 }, { unique: true });

export const UserPermissionModel = model<IUserPermission>('UserPermission', userPermissionSchema);
