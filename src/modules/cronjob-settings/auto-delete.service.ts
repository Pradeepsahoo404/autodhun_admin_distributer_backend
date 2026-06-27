import { Model, Types } from 'mongoose';
import { logger } from '@/config/logger';
import { AUTO_DELETE_TARGETS } from './auto-delete.registry';
import { CronjobSettingsModel, CRONJOB_SETTINGS_KEY, IModuleDeleteResult } from './cronjob-settings.model';

const BATCH_SIZE = 100;

async function deleteOldRecordsInBatches(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  cutoffDate: Date,
): Promise<number> {
  let totalDeleted = 0;

  while (true) {
    const docs = await model
      .find({ createdAt: { $lt: cutoffDate } })
      .select('_id')
      .limit(BATCH_SIZE)
      .lean<{ _id: Types.ObjectId }[]>();

    if (docs.length === 0) break;

    const result = await model.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
    totalDeleted += result.deletedCount ?? 0;

    if (docs.length < BATCH_SIZE) break;
  }

  return totalDeleted;
}

export interface AutoDeleteRunResult {
  retentionDays: number;
  cutoffDate: string;
  totalDeleted: number;
  results: IModuleDeleteResult[];
}

export async function runAutoDeleteJob(options?: { force?: boolean }): Promise<AutoDeleteRunResult | null> {
  const settings = await CronjobSettingsModel.findOne({ key: CRONJOB_SETTINGS_KEY }).lean();

  if (!settings?.enabled && !options?.force) {
    logger.info('Auto-delete cron skipped: disabled in settings');
    return null;
  }

  const retentionDays = settings?.retentionDays ?? 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  cutoffDate.setHours(0, 0, 0, 0);

  const results: IModuleDeleteResult[] = [];
  let totalDeleted = 0;

  for (const target of AUTO_DELETE_TARGETS) {
    try {
      const deletedCount = await deleteOldRecordsInBatches(target.model, cutoffDate);
      results.push({ module: target.module, label: target.label, deletedCount });
      totalDeleted += deletedCount;

      if (deletedCount > 0) {
        logger.info(`Auto-delete: removed ${deletedCount} record(s) from ${target.label}`);
      }
    } catch (error) {
      logger.error(`Auto-delete failed for ${target.label}`, error);
      results.push({ module: target.module, label: target.label, deletedCount: 0 });
    }
  }

  await CronjobSettingsModel.updateOne(
    { key: CRONJOB_SETTINGS_KEY },
    {
      $set: {
        lastRunAt: new Date(),
        lastRunDeletedCount: totalDeleted,
        lastRunResults: results,
      },
    },
  );

  logger.info(`Auto-delete completed: ${totalDeleted} record(s) removed (retention: ${retentionDays} days)`);

  return {
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
    totalDeleted,
    results,
  };
}
