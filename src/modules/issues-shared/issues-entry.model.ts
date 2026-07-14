import { Schema, model, models, Document, Types, Model } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';
import {
  ISSUES_ENTRY_ASSET_TYPES,
  ISSUES_ENTRY_OWNERSHIP,
  ISSUES_ENTRY_STATUS,
  IssuesEntryAssetType,
  IssuesEntryOwnership,
  IssuesEntryStatus,
} from './issues-entry.constants';

export interface IIssuesEntry extends Document {
  _id: Types.ObjectId;
  otherParty: string;
  assetName: string;
  assetType: IssuesEntryAssetType;
  isrcCode: string;
  overlappingAssetName: string;
  labelName: string;
  status: IssuesEntryStatus;
  ownership: IssuesEntryOwnership;
  assignedTo: Types.ObjectId;
  tenantId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const issuesEntrySchema = new Schema<IIssuesEntry>(
  {
    otherParty: { type: String, required: true, trim: true },
    assetName: { type: String, required: true, trim: true },
    assetType: {
      type: String,
      enum: ISSUES_ENTRY_ASSET_TYPES,
      required: true,
    },
    isrcCode: { type: String, required: true, trim: true, uppercase: true },
    overlappingAssetName: { type: String, required: true, trim: true },
    labelName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(ISSUES_ENTRY_STATUS),
      default: ISSUES_ENTRY_STATUS.ACTIVE,
      index: true,
    },
    ownership: {
      type: String,
      enum: ['', ...Object.values(ISSUES_ENTRY_OWNERSHIP)],
      default: '',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

const modelCache = new Map<string, Model<IIssuesEntry>>();

export function getIssuesEntryModel(modelName: string): Model<IIssuesEntry> {
  const cached = modelCache.get(modelName);
  if (cached) return cached;

  const issuesModel =
    (models[modelName] as Model<IIssuesEntry> | undefined) ??
    model<IIssuesEntry>(modelName, issuesEntrySchema, modelName);

  modelCache.set(modelName, issuesModel);
  return issuesModel;
}
