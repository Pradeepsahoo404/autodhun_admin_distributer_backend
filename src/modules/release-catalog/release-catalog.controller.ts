import { Request, Response } from 'express';
import { releaseCatalogService } from './release-catalog.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { CatalogListQueryDto, CreateCatalogNameDto } from './release-catalog.validator';

class ReleaseCatalogController {
  listArtists = asyncHandler(async (req: Request, res: Response) => {
    const items = await releaseCatalogService.listArtists(req.query as unknown as CatalogListQueryDto);
    sendSuccess(res, items, 'Artists fetched');
  });

  createArtist = asyncHandler(async (req: Request, res: Response) => {
    const item = await releaseCatalogService.createArtist(req.body as CreateCatalogNameDto, req.user!.id);
    sendSuccess(res, item, 'Artist saved', 201);
  });

  listLabels = asyncHandler(async (req: Request, res: Response) => {
    const items = await releaseCatalogService.listLabels(req.query as unknown as CatalogListQueryDto);
    sendSuccess(res, items, 'Labels fetched');
  });

  createLabel = asyncHandler(async (req: Request, res: Response) => {
    const item = await releaseCatalogService.createLabel(req.body as CreateCatalogNameDto, req.user!.id);
    sendSuccess(res, item, 'Label saved', 201);
  });
}

export const releaseCatalogController = new ReleaseCatalogController();
