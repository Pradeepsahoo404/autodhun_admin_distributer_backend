import { Schema, model, Document, Types } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';

export const CONTENT_ID_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  IN_PROGRESS: 'in_progress',
} as const;

export type ContentIdStatus = (typeof CONTENT_ID_STATUS)[keyof typeof CONTENT_ID_STATUS];

export interface IContentId extends Document {
  _id: Types.ObjectId;
  labelName: string;
  isrcCode: string;
  status: ContentIdStatus;
  tenantId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const contentIdSchema = new Schema<IContentId>(
  {
    labelName: { type: String, required: true, trim: true },
    isrcCode: { type: String, required: true, trim: true, uppercase: true },
    status: {
      type: String,
      enum: Object.values(CONTENT_ID_STATUS),
      default: CONTENT_ID_STATUS.IN_PROGRESS,
      index: true,
    },
    tenantId: tenantIdField,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const ContentIdModel = model<IContentId>('ContentId', contentIdSchema);
