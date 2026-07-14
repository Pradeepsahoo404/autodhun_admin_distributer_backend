import { Schema, model, Document, Types } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';
import {
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_CATEGORY,
  SUPPORT_TICKET_ISSUE_TYPE,
  type SupportTicketStatus,
  type SupportTicketCategory,
  type SupportTicketIssueType,
} from './support-ticket.constants';

export interface ISupportTicket extends Document {
  _id: Types.ObjectId;
  ticketNumber: number;
  subject: string;
  category: SupportTicketCategory;
  issueType: SupportTicketIssueType;
  description: string;
  status: SupportTicketStatus;
  resolutionNote?: string;
  resolvedAt?: Date;
  tenantId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: { type: Number, required: true, unique: true, index: true },
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: Object.values(SUPPORT_TICKET_CATEGORY),
      required: true,
      index: true,
    },
    issueType: {
      type: String,
      enum: Object.values(SUPPORT_TICKET_ISSUE_TYPE),
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(SUPPORT_TICKET_STATUS),
      default: SUPPORT_TICKET_STATUS.IN_PROGRESS,
      index: true,
    },
    resolutionNote: { type: String, trim: true, default: '' },
    resolvedAt: { type: Date, default: null, index: true },
    tenantId: tenantIdField,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

supportTicketSchema.index({ subject: 'text', description: 'text' });

export const SupportTicketModel = model<ISupportTicket>('SupportTicket', supportTicketSchema);
