import { Schema, model, Document, Types } from 'mongoose';

export const PROFILE_LINKING_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  IN_PROGRESS: 'in_progress',
} as const;

export type ProfileLinkingStatus = (typeof PROFILE_LINKING_STATUS)[keyof typeof PROFILE_LINKING_STATUS];

export interface IProfileLinking extends Document {
  _id: Types.ObjectId;
  labelName: string;
  isrcCode: string;
  facebookPageLink: string;
  instagramHandleName: string;
  status: ProfileLinkingStatus;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const profileLinkingSchema = new Schema<IProfileLinking>(
  {
    labelName: { type: String, required: true, trim: true },
    isrcCode: { type: String, required: true, trim: true, uppercase: true },
    facebookPageLink: { type: String, required: true, trim: true },
    instagramHandleName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(PROFILE_LINKING_STATUS),
      default: PROFILE_LINKING_STATUS.IN_PROGRESS,
      index: true,
    },
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

export const ProfileLinkingModel = model<IProfileLinking>('ProfileLinking', profileLinkingSchema);
