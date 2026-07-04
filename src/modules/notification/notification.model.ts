import { Schema, model, Document, Types } from 'mongoose';

export const NOTIFICATION_TYPE = {
  RIGHTS_ENTRY_CREATED: 'rights_entry_created',
  RIGHTS_STATUS_UPDATED: 'rights_status_updated',
  ISSUES_ENTRY_ASSIGNED: 'issues_entry_assigned',
  ISSUES_OWNERSHIP_UPDATED: 'issues_ownership_updated',
  RELEASE_CREATED: 'release_created',
  RELEASE_UPDATED: 'release_updated',
  RELEASE_STATUS_UPDATED: 'release_status_updated',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  type: NotificationType;
  moduleSlug: string;
  moduleName: string;
  entryId: string;
  route: string;
  title: string;
  message: string;
  entrySummary: Record<string, string>;
  actor?: Types.ObjectId;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      required: true,
      index: true,
    },
    moduleSlug: { type: String, required: true, index: true },
    moduleName: { type: String, required: true },
    entryId: { type: String, required: true, index: true },
    route: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    entrySummary: { type: Schema.Types.Mixed, default: {} },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: null, index: true },
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

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

export const NotificationModel = model<INotification>('Notification', notificationSchema);
