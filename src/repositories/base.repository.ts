import { FilterQuery, Model, UpdateQuery, QueryOptions, Document } from 'mongoose';

/**
 * Generic data-access layer. Encapsulates Mongoose so services never touch the
 * ODM directly — keeping persistence concerns isolated and swappable (DIP).
 */
export abstract class BaseRepository<T extends Document> {
  protected constructor(protected readonly model: Model<T>) {}

  create(payload: Partial<T>): Promise<T> {
    return this.model.create(payload) as unknown as Promise<T>;
  }

  findById(id: string, options?: QueryOptions): Promise<T | null> {
    return this.model.findById(id, null, options).exec();
  }

  findOne(filter: FilterQuery<T>, options?: QueryOptions): Promise<T | null> {
    return this.model.findOne(filter, null, options).exec();
  }

  find(filter: FilterQuery<T> = {}, options?: QueryOptions): Promise<T[]> {
    return this.model.find(filter, null, options).exec();
  }

  count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  updateById(id: string, update: UpdateQuery<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true }).exec();
  }

  updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<T | null> {
    return this.model.findOneAndUpdate(filter, update, { new: true, runValidators: true }).exec();
  }

  deleteById(id: string): Promise<T | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount?: number }> {
    return this.model.deleteMany(filter).exec();
  }

  exists(filter: FilterQuery<T>): Promise<boolean> {
    return this.model.exists(filter).then((doc) => Boolean(doc));
  }
}
