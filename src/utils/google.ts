import { OAuth2Client } from 'google-auth-library';
import { env } from '@/config/env';
import { ApiError } from './ApiError';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

/**
 * Verifies a Google ID token issued to our client and returns a normalized
 * profile. Throws if the token is invalid, untrusted or missing an email.
 */
export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleProfile> => {
  if (!env.GOOGLE_CLIENT_ID) throw ApiError.internal('Google OAuth is not configured');

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized('Invalid Google credentials');
  }

  if (!payload?.email) throw ApiError.unauthorized('Google account has no email');

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    firstName: payload.given_name ?? payload.name ?? payload.email.split('@')[0],
    lastName: payload.family_name ?? '',
    name: payload.name ?? `${payload.given_name ?? ''} ${payload.family_name ?? ''}`.trim(),
    avatarUrl: payload.picture,
    emailVerified: Boolean(payload.email_verified),
  };
};
