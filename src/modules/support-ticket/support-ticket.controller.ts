import { Request, Response } from 'express';
import { supportTicketService } from './support-ticket.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ListSupportTicketsQueryDto } from './support-ticket.validator';

class SupportTicketController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await supportTicketService.list(req.query as unknown as ListSupportTicketsQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
      name: req.user!.name,
    });
    sendSuccess(res, result.items, 'Support tickets fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await supportTicketService.getById(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
      name: req.user!.name,
    });
    sendSuccess(res, item, 'Support ticket fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await supportTicketService.create(req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
      name: req.user!.name,
    });
    sendSuccess(res, item, 'Support ticket created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await supportTicketService.update(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
      name: req.user!.name,
    });
    sendSuccess(res, item, 'Support ticket updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await supportTicketService.updateStatus(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
      name: req.user!.name,
    });
    sendSuccess(res, item, 'Support ticket status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await supportTicketService.remove(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
      name: req.user!.name,
    });
    sendSuccess(res, null, 'Support ticket deleted');
  });
}

export const supportTicketController = new SupportTicketController();
