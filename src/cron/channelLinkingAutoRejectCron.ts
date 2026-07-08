import cron, { ScheduledTask } from 'node-cron';
import { logger } from '@/config/logger';
import { channelLinkingService } from '@/modules/channel-linking/channel-linking.service';

let scheduledTask: ScheduledTask | null = null;
let isRunning = false;

/** Rejects in-process entries whose revenue was below the minimum and delay has elapsed. */
export function startChannelLinkingAutoRejectCron(): void {
  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule('* * * * *', () => {
    void (async () => {
      if (isRunning) return;

      isRunning = true;
      try {
        const count = await channelLinkingService.processAutoRejections();
        if (count > 0) {
          logger.info(`Channel linking auto-reject: ${count} entr${count === 1 ? 'y' : 'ies'} rejected`);
        }
      } catch (error) {
        logger.error('Channel linking auto-reject cron failed', error);
      } finally {
        isRunning = false;
      }
    })();
  });

  logger.info('Channel linking auto-reject cron scheduled: every minute');
}

export function stopChannelLinkingAutoRejectCron(): void {
  scheduledTask?.stop();
  scheduledTask = null;
}
