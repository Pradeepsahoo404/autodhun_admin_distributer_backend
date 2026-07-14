import { Schema, model, Document, Types } from 'mongoose';
import { AUTH_PROVIDER, AuthProvider, USER_STATUS, UserStatus } from '@/constants';

export interface IUserProfile {
  postalAddress?: string;
  state?: string;
  countryRegion?: string;
  phoneNumber?: string;
  labelName?: string;
}

export interface IUserBankDetails {
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  swiftCode?: string;
  micrCode?: string;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  password?: string;
  provider: AuthProvider;
  googleId?: string;
  avatarUrl?: string;
  profile?: IUserProfile;
  bankDetails?: IUserBankDetails;
  emailVerified: boolean;
  otpVerified: boolean;
  termsAccepted: boolean;
  termsAcceptedAt?: Date;
  role: Types.ObjectId;
  /** Tenant this user belongs to. null for platform Super Admin (→ Master in Phase 2). */
  tenantId?: Types.ObjectId | null;
  status: UserStatus;
  lastLogin?: Date;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: '', trim: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Not selected by default — callers must explicitly `.select('+password')`.
    password: { type: String, select: false },
    provider: {
      type: String,
      enum: Object.values(AUTH_PROVIDER),
      default: AUTH_PROVIDER.LOCAL,
    },
    googleId: { type: String, index: true, sparse: true },
    avatarUrl: { type: String, trim: true },
    profile: {
      postalAddress: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      countryRegion: { type: String, trim: true, default: '' },
      phoneNumber: { type: String, trim: true, default: '' },
      labelName: { type: String, trim: true, default: '' },
    },
    bankDetails: {
      bankName: { type: String, trim: true, default: '' },
      accountNumber: { type: String, trim: true, default: '' },
      ifscCode: { type: String, trim: true, default: '' },
      swiftCode: { type: String, trim: true, default: '' },
      micrCode: { type: String, trim: true, default: '' },
    },
    emailVerified: { type: Boolean, default: false },
    otpVerified: { type: Boolean, default: false },
    termsAccepted: { type: Boolean, default: false },
    termsAcceptedAt: { type: Date },
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true, index: true },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
      index: true,
    },
    lastLogin: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const UserModel = model<IUser>('User', userSchema);
