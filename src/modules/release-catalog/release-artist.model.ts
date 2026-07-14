import { Schema, model, Document, Types } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';

export interface IReleaseArtist extends Document {
  _id: Types.ObjectId;
  name: string;
  normalizedName: string;
  tenantId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const releaseArtistSchema = new Schema<IReleaseArtist>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true, index: true },
    tenantId: tenantIdField,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

releaseArtistSchema.index({ tenantId: 1, normalizedName: 1 }, { unique: true });

export const ReleaseArtistModel = model<IReleaseArtist>('ReleaseArtist', releaseArtistSchema);
