import { otpRepository } from './otp.repository';
import { userRepository } from '@/modules/user/user.repository';
import { generateOtp, hashOtp, compareOtp, getOtpExpiry } from '@/utils/otp';
import { buildOtpEmail, sendMail } from '@/utils/email';
import { ApiError } from '@/utils/ApiError';
import { env } from '@/config/env';
import { OtpPurpose, OTP_PURPOSE } from '@/constants';

const PURPOSE_LABEL: Record<OtpPurpose, string> = {
  [OTP_PURPOSE.REGISTER]: 'Registration',
  [OTP_PURPOSE.LOGIN]: 'Login',
  [OTP_PURPOSE.FORGOT_PASSWORD]: 'Password reset',
};

class OtpService {
  /**
   * Generates, persists (hashed) and emails a fresh OTP. Enforces a resend
   * cooldown so the endpoint can't be used to spam a user's inbox.
   */
  async generateAndSend(userId: string, email: string, purpose: OtpPurpose): Promise<{ resendAfter: number }> {
    const latest = await otpRepository.findLatest(userId, purpose);
    if (latest) {
      const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
      const remaining = env.OTP_RESEND_COOLDOWN_SECONDS - elapsed;
      if (remaining > 0 && !latest.verified) {
        throw ApiError.tooManyRequests(`Please wait ${Math.ceil(remaining)}s before requesting a new code`);
      }
    }

    await otpRepository.invalidateExisting(userId, purpose);

    const code = generateOtp();
    const hashed = await hashOtp(code);
    await otpRepository.create({
      userId: userId as never,
      otp: hashed,
      purpose,
      expiresAt: getOtpExpiry(),
      verified: false,
      attempts: 0,
    });

    const { subject, html, text } = buildOtpEmail(code, PURPOSE_LABEL[purpose]);
    await sendMail({ to: email, subject, html, text, devOtpFallback: code });

    return { resendAfter: env.OTP_RESEND_COOLDOWN_SECONDS };
  }

  /**
   * Verifies a submitted code: checks existence, expiry, attempt limit and value.
   * Marks the record verified on success so it cannot be reused.
   */
  async verify(userId: string, code: string, purpose: OtpPurpose): Promise<void> {
    const record = await otpRepository.findActive(userId, purpose);
    if (!record) throw ApiError.badRequest('No active verification code. Please request a new one.');

    if (record.expiresAt.getTime() < Date.now()) {
      await otpRepository.deleteById(record._id.toString());
      throw ApiError.badRequest('Verification code has expired. Please request a new one.');
    }

    if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
      await otpRepository.deleteById(record._id.toString());
      throw ApiError.tooManyRequests('Too many incorrect attempts. Please request a new code.');
    }

    const isMatch = await compareOtp(code, record.otp);
    if (!isMatch) {
      await otpRepository.updateById(record._id.toString(), { $inc: { attempts: 1 } } as never);
      throw ApiError.badRequest('Invalid verification code');
    }

    await otpRepository.updateById(record._id.toString(), { verified: true });
  }

  /** Used by the resend endpoint where we must first resolve the user by email. */
  async resend(email: string, purpose: OtpPurpose): Promise<{ resendAfter: number }> {
    const user = await userRepository.findByEmail(email);
    if (!user) throw ApiError.notFound('No account associated with this email');
    return this.generateAndSend(user._id.toString(), user.email, purpose);
  }
}

export const otpService = new OtpService();
