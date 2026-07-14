import { Schema, model, Document, Types } from 'mongoose';

export interface ILabelUpdate extends Document {
  _id: Types.ObjectId;
  label: Types.ObjectId;
  previousName: string;
  newName: string;
  owner: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const labelUpdateSchema = new Schema<ILabelUpdate>(
  {
    label: { type: Schema.Types.ObjectId, ref: 'ReleaseLabel', required: true, index: true },
    previousName: { type: String, required: true, trim: true },
    newName: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

export const LabelUpdateModel = model<ILabelUpdate>('LabelUpdate', labelUpdateSchema);
