import cron, { ScheduledTask } from 'node-cron';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { runAutoDeleteJob } from '@/modules/cronjob-settings/auto-delete.service';

let scheduledTask: ScheduledTask | null = null;
let isRunning = false;

export function startAutoDeleteCron(): void {
  if (!env.CRON_AUTO_DELETE_ENABLED) {
    logger.info('Auto-delete cron is disabled via CRON_AUTO_DELETE_ENABLED');
    return;
  }

  if (!cron.validate(env.CRON_AUTO_DELETE_SCHEDULE)) {
    logger.error(`Invalid CRON_AUTO_DELETE_SCHEDULE: ${env.CRON_AUTO_DELETE_SCHEDULE}`);
    return;
  }

  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule(env.CRON_AUTO_DELETE_SCHEDULE, () => {
    void (async () => {
      if (isRunning) {
        logger.warn('Auto-delete cron skipped: previous run still in progress');
        return;
      }

      isRunning = true;
      try {
        await runAutoDeleteJob();
      } catch (error) {
        logger.error('Auto-delete cron failed', error);
      } finally {
        isRunning = false;
      }
    })();
  });

  logger.info(`Auto-delete cron scheduled: ${env.CRON_AUTO_DELETE_SCHEDULE}`);
}

export function stopAutoDeleteCron(): void {
  scheduledTask?.stop();
  scheduledTask = null;
}
