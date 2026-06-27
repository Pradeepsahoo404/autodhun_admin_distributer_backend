import { Types } from 'mongoose';
import { ApiError } from '@/utils/ApiError';
import { AUTO_DELETE_TARGETS } from './auto-delete.registry';
import { runAutoDeleteJob } from './auto-delete.service';
import {
  CronjobSettingsModel,
  CRONJOB_SETTINGS_KEY,
  ICronjobSettings,
} from './cronjob-settings.model';
import { UpdateCronjobSettingsDto } from './cronjob-settings.validator';

const DEFAULT_RETENTION_DAYS = 30;

export interface CronjobSettingsResponse {
  retentionDays: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunDeletedCount: number;
  lastRunResults: ICronjobSettings['lastRunResults'];
  targets: {
    module: string;
    label: string;
    group: 'legal' | 'issues';
  }[];
  updatedAt: string | null;
}

function toResponse(doc: ICronjobSettings): CronjobSettingsResponse {
  return {
    retentionDays: doc.retentionDays,
    enabled: doc.enabled,
    lastRunAt: doc.lastRunAt?.toISOString() ?? null,
    lastRunDeletedCount: doc.lastRunDeletedCount ?? 0,
    lastRunResults: doc.lastRunResults ?? [],
    targets: AUTO_DELETE_TARGETS.map(({ module, label, group }) => ({ module, label, group })),
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  };
}

class CronjobSettingsService {
  async getOrCreate(): Promise<CronjobSettingsResponse> {
    let doc = await CronjobSettingsModel.findOne({ key: CRONJOB_SETTINGS_KEY });

    if (!doc) {
      doc = await CronjobSettingsModel.create({
        key: CRONJOB_SETTINGS_KEY,
        retentionDays: DEFAULT_RETENTION_DAYS,
        enabled: true,
      });
    }

    return toResponse(doc);
  }

  async update(dto: UpdateCronjobSettingsDto, actorId: string): Promise<CronjobSettingsResponse> {
    const doc = await CronjobSettingsModel.findOneAndUpdate(
      { key: CRONJOB_SETTINGS_KEY },
      {
        $set: {
          retentionDays: dto.retentionDays,
          enabled: dto.enabled,
          updatedBy: new Types.ObjectId(actorId),
        },
        $setOnInsert: {
          key: CRONJOB_SETTINGS_KEY,
          lastRunDeletedCount: 0,
          lastRunResults: [],
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    if (!doc) throw ApiError.internal('Failed to update cronjob settings');
    return toResponse(doc);
  }

  async runNow() {
    const settings = await CronjobSettingsModel.findOne({ key: CRONJOB_SETTINGS_KEY }).lean();
    if (!settings) {
      throw ApiError.badRequest('Configure auto-delete settings before running');
    }

    const result = await runAutoDeleteJob({ force: true });
    const updated = await this.getOrCreate();

    return {
      run: result,
      settings: updated,
    };
  }
}

export const cronjobSettingsService = new CronjobSettingsService();
