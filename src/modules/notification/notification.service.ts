import { notificationRepository } from './notification.repository';
import { ApiError } from '@/utils/ApiError';
import { INotification } from './notification.model';
import { PaginatedResult } from '@/types';
import { ListNotificationQueryDto } from './notification.validator';

class NotificationService {
  list(recipientId: string, query: ListNotificationQueryDto): Promise<PaginatedResult<INotification>> {
    return notificationRepository.paginateForRecipient(recipientId, query);
  }

  unreadCount(recipientId: string): Promise<number> {
    return notificationRepository.countUnread(recipientId);
  }

  async markRead(id: string, recipientId: string): Promise<INotification> {
    const updated = await notificationRepository.markRead(id, recipientId);
    if (!updated) throw ApiError.notFound('Notification not found');
    return updated;
  }

  markAllRead(recipientId: string): Promise<number> {
    return notificationRepository.markAllRead(recipientId);
  }
}

export const notificationService = new NotificationService();
