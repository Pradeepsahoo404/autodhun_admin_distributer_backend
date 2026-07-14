import { Schema, model, Document, Types } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';

export interface ILabelTransfer extends Document {
  _id: Types.ObjectId;
  label: Types.ObjectId;
  labelName: string;
  fromUser: Types.ObjectId;
  toUser: Types.ObjectId;
  transferredBy: Types.ObjectId;
  tenantId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const labelTransferSchema = new Schema<ILabelTransfer>(
  {
    label: { type: Schema.Types.ObjectId, ref: 'ReleaseLabel', required: true, index: true },
    labelName: { type: String, required: true, trim: true },
    fromUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: tenantIdField,
    transferredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const LabelTransferModel = model<ILabelTransfer>('LabelTransfer', labelTransferSchema);
