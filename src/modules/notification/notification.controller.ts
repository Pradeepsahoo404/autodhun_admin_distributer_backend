import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { notificationService } from './notification.service';

class NotificationController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationService.list(req.user!.id, req.query as never);
    sendSuccess(res, result.items, 'Notifications fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  unreadCount = asyncHandler(async (req: Request, res: Response) => {
    const count = await notificationService.unreadCount(req.user!.id);
    sendSuccess(res, { count }, 'Unread count fetched');
  });

  markRead = asyncHandler(async (req: Request, res: Response) => {
    const data = await notificationService.markRead(req.params.id, req.user!.id);
    sendSuccess(res, data, 'Notification marked as read');
  });

  markAllRead = asyncHandler(async (req: Request, res: Response) => {
    const count = await notificationService.markAllRead(req.user!.id);
    sendSuccess(res, { count }, 'All notifications marked as read');
  });
}

export const notificationController = new NotificationController();
