import { BaseRepository } from '@/repositories/base.repository';
import { INotification, NotificationModel } from './notification.model';
import { PaginatedResult } from '@/types';

interface ListQuery {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

class NotificationRepository extends BaseRepository<INotification> {
  constructor() {
    super(NotificationModel);
  }

  async paginateForRecipient(
    recipientId: string,
    query: ListQuery,
  ): Promise<PaginatedResult<INotification>> {
    const { page, limit, unreadOnly } = query;
    const filter: Record<string, unknown> = { recipient: recipientId };
    if (unreadOnly) {
      filter.readAt = null;
    }

    const [items, total] = await Promise.all([
      NotificationModel.find(filter)
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      NotificationModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  countUnread(recipientId: string): Promise<number> {
    return NotificationModel.countDocuments({ recipient: recipientId, readAt: null }).exec();
  }

  markRead(id: string, recipientId: string): Promise<INotification | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: id, recipient: recipientId },
      { readAt: new Date() },
      { new: true },
    )
      .populate('actor', 'name email')
      .exec();
  }

  markAllRead(recipientId: string): Promise<number> {
    return NotificationModel.updateMany(
      { recipient: recipientId, readAt: null },
      { readAt: new Date() },
    ).then((result) => result.modifiedCount);
  }

  createMany(payloads: Partial<INotification>[]): Promise<INotification[]> {
    return NotificationModel.insertMany(payloads) as unknown as Promise<INotification[]>;
  }
}

export const notificationRepository = new NotificationRepository();
