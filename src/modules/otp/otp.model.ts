import { Schema, model, Document, Types } from 'mongoose';
import { OTP_PURPOSE, OtpPurpose } from '@/constants';

export interface IOtp extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  otp: string; // bcrypt hash of the code, never plaintext
  purpose: OtpPurpose;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    otp: { type: String, required: true },
    purpose: { type: String, enum: Object.values(OTP_PURPOSE), required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// TTL index: expired, unverified OTP documents are automatically purged by MongoDB.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ userId: 1, purpose: 1 });

export const OtpModel = model<IOtp>('Otp', otpSchema);
