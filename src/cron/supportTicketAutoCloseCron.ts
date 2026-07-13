import cron, { ScheduledTask } from 'node-cron';
import { logger } from '@/config/logger';
import { supportTicketAutoCloseService } from '@/modules/support-ticket/support-ticket-auto-close.service';

let scheduledTask: ScheduledTask | null = null;
let isRunning = false;

/** Closes resolved support tickets after 48 hours. */
export function startSupportTicketAutoCloseCron(): void {
  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule('0 * * * *', () => {
    void (async () => {
      if (isRunning) return;

      isRunning = true;
      try {
        const count = await supportTicketAutoCloseService.processAutoClose();
        if (count > 0) {
          logger.info(`Support ticket auto-close: ${count} ticket${count === 1 ? '' : 's'} closed`);
        }
      } catch (error) {
        logger.error('Support ticket auto-close cron failed', error);
      } finally {
        isRunning = false;
      }
    })();
  });

  logger.info('Support ticket auto-close cron scheduled: every hour');
}

export function stopSupportTicketAutoCloseCron(): void {
  scheduledTask?.stop();
  scheduledTask = null;
}
