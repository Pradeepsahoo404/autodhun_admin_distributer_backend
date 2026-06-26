import { BaseRepository } from '@/repositories/base.repository';
import { IModule, ModuleModel } from './module.model';

class ModuleRepository extends BaseRepository<IModule> {
  constructor() {
    super(ModuleModel);
  }

  findBySlug(slug: string): Promise<IModule | null> {
    return ModuleModel.findOne({ slug: slug.toLowerCase() }).exec();
  }

  findActiveSorted(): Promise<IModule[]> {
    return ModuleModel.find({ isActive: true }).sort({ order: 1 }).exec();
  }

  findAllSorted(): Promise<IModule[]> {
    return ModuleModel.find().sort({ order: 1 }).exec();
  }

  findByParentSlug(parentSlug: string): Promise<IModule[]> {
    return ModuleModel.find({ parentSlug }).exec();
  }

  async findDescendantIds(rootSlug: string): Promise<string[]> {
    const ids: string[] = [];
    const queue = [rootSlug];

    while (queue.length > 0) {
      const parent = queue.shift()!;
      const children = await ModuleModel.find({ parentSlug: parent }).select('_id slug').exec();
      for (const child of children) {
        ids.push(child._id.toString());
        queue.push(child.slug);
      }
    }

    return ids;
  }

  deleteManyByIds(ids: string[]): Promise<{ deletedCount?: number }> {
    return ModuleModel.deleteMany({ _id: { $in: ids } }).exec();
  }
}

export const moduleRepository = new ModuleRepository();
