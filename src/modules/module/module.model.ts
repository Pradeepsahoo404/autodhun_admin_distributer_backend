import { Schema, model, Document, Types } from 'mongoose';

export interface IModule extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  route: string;
  icon: string;
  order: number;
  isActive: boolean;
  isPro: boolean;
  group: string;
  parentSlug?: string;
  /** Which role(s) see this module branch in the sidebar. Set on root modules only. */
  audience?: 'shared' | 'super-admin' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const moduleSchema = new Schema<IModule>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    route: { type: String, required: true },
    icon: { type: String, default: 'Circle' },
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true },
    // Drives the "UPGRADE" badge in the sidebar for Pro-gated modules.
    isPro: { type: Boolean, default: false },
    // Sidebar section grouping: 'main' (product modules) or 'management' (admin tools).
    group: { type: String, default: 'main' },
    parentSlug: { type: String, trim: true, index: true },
    audience: { type: String, enum: ['shared', 'super-admin', 'admin'], default: 'shared' },
  },
  { timestamps: true },
);

export const ModuleModel = model<IModule>('Module', moduleSchema);
