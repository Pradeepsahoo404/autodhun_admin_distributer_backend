import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '@/config/env';

/** Cryptographically secure numeric OTP of configured length. */
export const generateOtp = (length: number = env.OTP_LENGTH): string => {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(length, '0');
};

/** OTPs are stored hashed — they are credentials and must never be persisted in plaintext. */
export const hashOtp = (otp: string): Promise<string> => bcrypt.hash(otp, 10);

export const compareOtp = (otp: string, hashed: string): Promise<boolean> =>
  bcrypt.compare(otp, hashed);

export const getOtpExpiry = (): Date =>
  new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
