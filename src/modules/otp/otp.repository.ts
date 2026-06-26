import { BaseRepository } from '@/repositories/base.repository';
import { OtpPurpose } from '@/constants';
import { IOtp, OtpModel } from './otp.model';

class OtpRepository extends BaseRepository<IOtp> {
  constructor() {
    super(OtpModel);
  }

  /** Remove any outstanding OTPs for a user+purpose before issuing a new one. */
  invalidateExisting(userId: string, purpose: OtpPurpose): Promise<{ deletedCount?: number }> {
    return OtpModel.deleteMany({ userId, purpose }).exec();
  }

  findActive(userId: string, purpose: OtpPurpose): Promise<IOtp | null> {
    return OtpModel.findOne({ userId, purpose, verified: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  findLatest(userId: string, purpose: OtpPurpose): Promise<IOtp | null> {
    return OtpModel.findOne({ userId, purpose }).sort({ createdAt: -1 }).exec();
  }
}

export const otpRepository = new OtpRepository();
