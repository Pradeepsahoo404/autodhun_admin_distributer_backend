import { supportTicketRepository } from './support-ticket.repository';
import { SUPPORT_TICKET_AUTO_CLOSE_HOURS } from './support-ticket.constants';

class SupportTicketAutoCloseService {
  async processAutoClose(): Promise<number> {
    const cutoff = new Date(Date.now() - SUPPORT_TICKET_AUTO_CLOSE_HOURS * 60 * 60 * 1000);
    return supportTicketRepository.closeExpiredResolvedTickets(cutoff);
  }
}

export const supportTicketAutoCloseService = new SupportTicketAutoCloseService();
