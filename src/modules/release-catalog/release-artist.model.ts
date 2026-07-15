import { Schema, model, Document, Types } from 'mongoose';

export interface IReleaseArtist extends Document {
  _id: Types.ObjectId;
  name: string;
  normalizedName: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const releaseArtistSchema = new Schema<IReleaseArtist>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

/** Each user keeps their own artist catalog — same name allowed across different owners. */
releaseArtistSchema.index({ createdBy: 1, normalizedName: 1 }, { unique: true });

export const ReleaseArtistModel = model<IReleaseArtist>('ReleaseArtist', releaseArtistSchema);
