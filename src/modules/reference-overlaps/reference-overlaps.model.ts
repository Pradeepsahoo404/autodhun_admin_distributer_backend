import { Schema, model, Document, Types } from 'mongoose';

export const REFERENCE_OVERLAP_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type ReferenceOverlapStatus =
  (typeof REFERENCE_OVERLAP_STATUS)[keyof typeof REFERENCE_OVERLAP_STATUS];

export const REFERENCE_OVERLAP_OWNERSHIP = {
  YES: 'yes',
  NO: 'no',
} as const;

export type ReferenceOverlapOwnership =
  | (typeof REFERENCE_OVERLAP_OWNERSHIP)[keyof typeof REFERENCE_OVERLAP_OWNERSHIP]
  | '';

export const REFERENCE_OVERLAP_ASSET_TYPES = [
  'Track',
  'Album',
  'Music Video',
  'Composition',
  'Other',
] as const;

export type ReferenceOverlapAssetType = (typeof REFERENCE_OVERLAP_ASSET_TYPES)[number];

export interface IReferenceOverlap extends Document {
  _id: Types.ObjectId;
  otherParty: string;
  assetName: string;
  assetType: ReferenceOverlapAssetType;
  isrcCode: string;
  overlappingAssetName: string;
  labelName: string;
  status: ReferenceOverlapStatus;
  ownership: ReferenceOverlapOwnership;
  assignedTo: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const referenceOverlapSchema = new Schema<IReferenceOverlap>(
  {
    otherParty: { type: String, required: true, trim: true },
    assetName: { type: String, required: true, trim: true },
    assetType: {
      type: String,
      enum: REFERENCE_OVERLAP_ASSET_TYPES,
      required: true,
    },
    isrcCode: { type: String, required: true, trim: true, uppercase: true },
    overlappingAssetName: { type: String, required: true, trim: true },
    labelName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(REFERENCE_OVERLAP_STATUS),
      default: REFERENCE_OVERLAP_STATUS.ACTIVE,
      index: true,
    },
    ownership: {
      type: String,
      enum: ['', ...Object.values(REFERENCE_OVERLAP_OWNERSHIP)],
      default: '',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

export const ReferenceOverlapModel = model<IReferenceOverlap>(
  'ReferenceOverlap',
  referenceOverlapSchema,
);
