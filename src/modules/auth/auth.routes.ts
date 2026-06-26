import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { uploadAvatar } from '@/middlewares/upload.middleware';
import { authRateLimiter } from '@/middlewares/rateLimiter';
import { validate } from '@/middlewares/validate.middleware';
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  googleAuthSchema,
  acceptTermsSchema,
  termsStatusQuerySchema,
  changePasswordSchema,
  updateProfileSchema,
  updateBankDetailsSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validator';

const router = Router();

router.use(authRateLimiter);

router.post('/register', validate({ body: registerSchema }), authController.register);
router.post('/verify-register-otp', validate({ body: verifyOtpSchema }), authController.verifyRegisterOtp);
router.get('/terms-status', validate({ query: termsStatusQuerySchema }), authController.getTermsStatus);
router.post('/accept-terms', validate({ body: acceptTermsSchema }), authController.acceptTerms);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/verify-login-otp', validate({ body: verifyOtpSchema }), authController.verifyLoginOtp);
router.post('/resend-otp', validate({ body: resendOtpSchema }), authController.resendOtp);
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), authController.forgotPassword);
router.post('/reset-password', validate({ body: resetPasswordSchema }), authController.resetPassword);
router.post('/google', validate({ body: googleAuthSchema }), authController.google);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post('/me/avatar', authenticate, uploadAvatar, authController.uploadAvatar);
router.post(
  '/me/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
router.patch(
  '/me/profile',
  authenticate,
  validate({ body: updateProfileSchema }),
  authController.updateProfile,
);
router.patch(
  '/me/bank-details',
  authenticate,
  validate({ body: updateBankDetailsSchema }),
  authController.updateBankDetails,
);

export const authRoutes = router;
