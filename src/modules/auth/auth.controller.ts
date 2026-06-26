import { Request, Response } from 'express';
import { authService } from './auth.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ApiError } from '@/utils/ApiError';
import { isProduction } from '@/config/env';
import { REFRESH_TOKEN_COOKIE } from '@/constants';
import { AuthTokens, LoginResult } from './auth.types';

/** Refresh token is stored in an httpOnly cookie — never exposed to JS. */
const setRefreshCookie = (res: Response, refreshToken: string): void => {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
};

const respondWithSession = (res: Response, result: { user: unknown; tokens: AuthTokens }, message: string): void => {
  setRefreshCookie(res, result.tokens.refreshToken);
  sendSuccess(res, { user: result.user, accessToken: result.tokens.accessToken }, message);
};

class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    sendSuccess(res, result, result.message, 201);
  });

  verifyRegisterOtp = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.verifyRegisterOtp(req.body.email, req.body.otp);
    respondWithSession(res, result, 'Account verified successfully');
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const result: LoginResult = await authService.login(req.body);
    if ('tokens' in result) {
      respondWithSession(res, result, 'Logged in successfully');
      return;
    }
    sendSuccess(res, result, result.message);
  });

  verifyLoginOtp = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.verifyLoginOtp(req.body.email, req.body.otp);
    respondWithSession(res, result, 'Logged in successfully');
  });

  resendOtp = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resendOtp(req.body.email, req.body.purpose);
    sendSuccess(res, result, result.message);
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    sendSuccess(res, result, result.message);
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body.email, req.body.otp, req.body.newPassword);
    sendSuccess(res, null, 'Password reset successfully');
  });

  google = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.googleAuth(req.body.idToken);
    respondWithSession(res, result, 'Logged in with Google');
  });

  getTermsStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.getTermsStatus(req.query.email as string);
    sendSuccess(res, result, 'Terms status');
  });

  acceptTerms = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.acceptTerms(req.body.email);
    sendSuccess(res, result, 'Terms accepted');
  });

  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE] ?? req.body?.refreshToken;
    if (!token) throw ApiError.unauthorized('Refresh token missing');
    const tokens = await authService.refreshTokens(token);
    setRefreshCookie(res, tokens.refreshToken);
    sendSuccess(res, { accessToken: tokens.accessToken }, 'Token refreshed');
  });

  logout = asyncHandler(async (_req: Request, res: Response) => {
    clearRefreshCookie(res);
    sendSuccess(res, null, 'Logged out successfully');
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getCurrentUser(req.user!.id);
    sendSuccess(res, user, 'Current session');
  });

  uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('Avatar image is required');
    const user = await authService.updateAvatar(req.user!.id, req.file);
    sendSuccess(res, user, 'Profile photo updated');
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    sendSuccess(res, null, 'Password updated successfully');
  });

  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.updateProfile(req.user!.id, req.body);
    sendSuccess(res, user, 'Profile updated successfully');
  });

  updateBankDetails = asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.updateBankDetails(req.user!.id, req.user!.role, req.body);
    sendSuccess(res, user, 'Bank details saved successfully');
  });
}

export const authController = new AuthController();
