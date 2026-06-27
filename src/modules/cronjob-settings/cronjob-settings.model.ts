import { Schema, model, Document, Types } from 'mongoose';

export const CRONJOB_SETTINGS_KEY = 'auto-delete';

export interface IModuleDeleteResult {
  module: string;
  label: string;
  deletedCount: number;
}

export interface ICronjobSettings extends Document {
  _id: Types.ObjectId;
  key: string;
  retentionDays: number;
  enabled: boolean;
  lastRunAt?: Date;
  lastRunDeletedCount: number;
  lastRunResults: IModuleDeleteResult[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const moduleDeleteResultSchema = new Schema<IModuleDeleteResult>(
  {
    module: { type: String, required: true },
    label: { type: String, required: true },
    deletedCount: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const cronjobSettingsSchema = new Schema<ICronjobSettings>(
  {
    key: { type: String, required: true, unique: true, default: CRONJOB_SETTINGS_KEY },
    retentionDays: { type: Number, required: true, default: 30, min: 1, max: 3650 },
    enabled: { type: Boolean, required: true, default: true },
    lastRunAt: { type: Date },
    lastRunDeletedCount: { type: Number, default: 0 },
    lastRunResults: { type: [moduleDeleteResultSchema], default: [] },
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

export const CronjobSettingsModel = model<ICronjobSettings>('CronjobSettings', cronjobSettingsSchema);
