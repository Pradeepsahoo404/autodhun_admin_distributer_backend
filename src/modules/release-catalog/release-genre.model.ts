import { Schema, model, Document, Types } from 'mongoose';

export interface IReleaseGenre extends Document {
  _id: Types.ObjectId;
  name: string;
  normalizedName: string;
  subGenres: string[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const releaseGenreSchema = new Schema<IReleaseGenre>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    subGenres: { type: [String], required: true, default: [] },
    sortOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const ReleaseGenreModel = model<IReleaseGenre>('ReleaseGenre', releaseGenreSchema);
