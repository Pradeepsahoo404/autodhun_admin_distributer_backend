import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '@/config/env';
import { TOKEN_TYPE } from '@/constants';
import { ApiError } from './ApiError';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string; // role slug
  type: (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];
}

type TokenSubject = Omit<JwtPayload, 'type'>;

export const signAccessToken = (subject: TokenSubject): string =>
  jwt.sign({ ...subject, type: TOKEN_TYPE.ACCESS }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);

export const signRefreshToken = (subject: TokenSubject): string =>
  jwt.sign({ ...subject, type: TOKEN_TYPE.REFRESH }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    if (payload.type !== TOKEN_TYPE.ACCESS) throw ApiError.unauthorized('Invalid token type');
    return payload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
    if (payload.type !== TOKEN_TYPE.REFRESH) throw ApiError.unauthorized('Invalid token type');
    return payload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }
};

export const issueTokenPair = (subject: TokenSubject): { accessToken: string; refreshToken: string } => ({
  accessToken: signAccessToken(subject),
  refreshToken: signRefreshToken(subject),
});
