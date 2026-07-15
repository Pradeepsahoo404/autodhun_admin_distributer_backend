import { Request, Response } from 'express';
import { releaseCatalogService } from './release-catalog.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ApiError } from '@/utils/ApiError';
import { permissionService } from '@/modules/permission/permission.service';
import { LABEL_STATUS } from './release-catalog.constants';
import {
  CatalogListQueryDto,
  CreateCatalogNameDto,
  LabelManageQueryDto,
  UpdateLabelDto,
  UpdateLabelStatusDto,
} from './release-catalog.validator';

function catalogActor(req: Request) {
  return {
    id: req.user!.id,
    isSuperAdmin: req.user!.isSuperAdmin,
    isSubAdmin: req.user!.isSubAdmin,
    roleSlug: req.user!.role,
  };
}

async function assertManageAccess(req: Request, status: string): Promise<void> {
  if (req.user!.isSuperAdmin) return;

  const moduleSlug = status === LABEL_STATUS.INACTIVE ? 'label-block' : 'label-transfer';
  const allowed = await permissionService.can(
    req.user!.roleId,
    req.user!.role,
    moduleSlug,
    'view',
    req.user!.id,
  );

  if (!allowed) throw ApiError.forbidden(`No access to module: ${moduleSlug}`);
}

async function assertLabelMutationAccess(req: Request, action: 'update' | 'delete'): Promise<void> {
  if (req.user!.isSuperAdmin) return;

  const modules = ['label-transfer', 'label-block'] as const;
  for (const moduleSlug of modules) {
    const allowed = await permissionService.can(
      req.user!.roleId,
      req.user!.role,
      moduleSlug,
      action,
      req.user!.id,
    );
    if (allowed) return;
  }

  throw ApiError.forbidden('No permission to manage labels');
}

async function assertLabelCatalogAccess(req: Request): Promise<void> {
  if (req.user!.isSuperAdmin) return;

  /** Release forms, Issues assign forms, and label management all need the catalog. */
  const modules = ['release', 'issues', 'label-transfer', 'label-block'] as const;
  for (const moduleSlug of modules) {
    const allowed = await permissionService.can(
      req.user!.roleId,
      req.user!.role,
      moduleSlug,
      'view',
      req.user!.id,
    );
    if (allowed) return;
  }

  throw ApiError.forbidden('No access to labels catalog');
}

class ReleaseCatalogController {
  listArtists = asyncHandler(async (req: Request, res: Response) => {
    const items = await releaseCatalogService.listArtists(
      req.query as unknown as CatalogListQueryDto,
      catalogActor(req),
    );
    sendSuccess(res, items, 'Artists fetched');
  });

  listLanguages = asyncHandler(async (req: Request, res: Response) => {
    const items = await releaseCatalogService.listLanguages(req.query as unknown as CatalogListQueryDto);
    sendSuccess(res, items, 'Languages fetched');
  });

  listGenres = asyncHandler(async (req: Request, res: Response) => {
    const items = await releaseCatalogService.listGenres(req.query as unknown as CatalogListQueryDto);
    sendSuccess(res, items, 'Genres fetched');
  });

  createArtist = asyncHandler(async (req: Request, res: Response) => {
    const item = await releaseCatalogService.createArtist(req.body as CreateCatalogNameDto, req.user!.id);
    sendSuccess(res, item, 'Artist saved', 201);
  });

  listLabels = asyncHandler(async (req: Request, res: Response) => {
    await assertLabelCatalogAccess(req);
    const items = await releaseCatalogService.listLabels(
      req.query as unknown as CatalogListQueryDto,
      catalogActor(req),
    );
    sendSuccess(res, items, 'Labels fetched');
  });

  createLabel = asyncHandler(async (req: Request, res: Response) => {
    const item = await releaseCatalogService.createLabel(req.body as CreateCatalogNameDto, req.user!.id);
    sendSuccess(res, item, 'Label saved', 201);
  });

  listLabelsManage = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as LabelManageQueryDto;
    await assertManageAccess(req, query.status);
    const result = await releaseCatalogService.listLabelsManage(query, catalogActor(req));
    sendSuccess(res, result, 'Labels fetched');
  });

  updateLabel = asyncHandler(async (req: Request, res: Response) => {
    await assertLabelMutationAccess(req, 'update');
    const item = await releaseCatalogService.updateLabel(
      req.params.id,
      req.body as UpdateLabelDto,
      catalogActor(req),
    );
    sendSuccess(res, item, 'Label updated');
  });

  deleteLabel = asyncHandler(async (req: Request, res: Response) => {
    await assertLabelMutationAccess(req, 'delete');
    await releaseCatalogService.deleteLabel(req.params.id, catalogActor(req));
    sendSuccess(res, null, 'Label deleted');
  });

  updateLabelStatus = asyncHandler(async (req: Request, res: Response) => {
    await assertLabelMutationAccess(req, 'update');
    const item = await releaseCatalogService.updateLabelStatus(
      req.params.id,
      req.body as UpdateLabelStatusDto,
      catalogActor(req),
    );
    sendSuccess(res, item, 'Label status updated');
  });
}

export const releaseCatalogController = new ReleaseCatalogController();
