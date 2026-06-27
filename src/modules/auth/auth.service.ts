import { userRepository } from '@/modules/user/user.repository';
import { roleRepository } from '@/modules/role/role.repository';
import { otpService } from '@/modules/otp/otp.service';
import { hashPassword, comparePassword } from '@/utils/password';
import { issueTokenPair, verifyRefreshToken } from '@/utils/jwt';
import { verifyGoogleIdToken } from '@/utils/google';
import { deleteCloudinaryImage, uploadAvatarImage } from '@/utils/cloudinaryUpload';
import { ApiError } from '@/utils/ApiError';
import { AUTH_PROVIDER, OTP_PURPOSE, ROLES, USER_STATUS, USER_INACTIVE_MESSAGE } from '@/constants';
import { IUser } from '@/modules/user/user.model';
import { IRole } from '@/modules/role/role.model';
import { AuthResult, AuthTokens, AuthUserDto, PendingOtpResult, LoginResult, toAuthUserDto } from './auth.types';

interface RegisterInput {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  acceptTerms: true;
}

interface LoginInput {
  email: string;
  password: string;
  acceptTerms: true;
}

class AuthService {
  /** Resolves the role slug from a populated-or-id role reference. */
  private resolveRoleSlug(user: IUser): string {
    const role = user.role as unknown as IRole | undefined;
    return role && typeof role === 'object' && 'slug' in role ? role.slug : '';
  }

  private async getDefaultRole(): Promise<IRole> {
    const role = await roleRepository.findBySlug(ROLES.ADMIN);
    if (!role) throw ApiError.internal('Default role is not seeded. Run the database seeder.');
    return role;
  }

  private async markTermsAccepted(userId: string): Promise<void> {
    await userRepository.updateById(userId, {
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    });
  }

  async getTermsStatus(email: string): Promise<{ termsAccepted: boolean }> {
    const user = await userRepository.findByEmail(email);
    if (!user) return { termsAccepted: false };
    return { termsAccepted: Boolean(user.termsAccepted) };
  }

  /** Persists terms acceptance for an existing account (e.g. when the user checks the box). */
  async acceptTerms(email: string): Promise<{ termsAccepted: boolean }> {
    const user = await userRepository.findByEmail(email);
    if (!user) throw ApiError.notFound('Account not found');
    await this.markTermsAccepted(user._id.toString());
    return { termsAccepted: true };
  }

  /**
   * Step 1 of registration. Creates an unverified local account (or reuses an
   * existing unverified one) and dispatches a REGISTER OTP. Verified accounts
   * are rejected so the endpoint can't be used for account enumeration abuse.
   */
  async register(input: RegisterInput): Promise<PendingOtpResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing && existing.emailVerified) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const role = await this.getDefaultRole();
    const password = await hashPassword(input.password);
    const fullName = `${input.firstName} ${input.lastName ?? ''}`.trim();

    const termsAt = new Date();
    let user: IUser;
    if (existing) {
      const updated = await userRepository.updateById(existing._id.toString(), {
        firstName: input.firstName,
        lastName: input.lastName ?? '',
        name: fullName,
        password,
        role: role._id,
        termsAccepted: true,
        termsAcceptedAt: termsAt,
      });
      user = updated as IUser;
    } else {
      user = await userRepository.create({
        firstName: input.firstName,
        lastName: input.lastName ?? '',
        name: fullName,
        email: input.email.toLowerCase(),
        password,
        provider: AUTH_PROVIDER.LOCAL,
        emailVerified: false,
        otpVerified: false,
        termsAccepted: true,
        termsAcceptedAt: termsAt,
        role: role._id,
        status: USER_STATUS.ACTIVE,
      });
    }

    const { resendAfter } = await otpService.generateAndSend(user._id.toString(), user.email, OTP_PURPOSE.REGISTER);
    return {
      email: user.email,
      purpose: OTP_PURPOSE.REGISTER,
      resendAfter,
      message: 'Verification code sent to your email',
    };
  }

  /** Step 2 of registration. Verifies OTP, marks email verified and logs the user in. */
  async verifyRegisterOtp(email: string, otp: string): Promise<AuthResult> {
    const user = await userRepository.findByEmail(email);
    if (!user) throw ApiError.notFound('Account not found');
    if (user.emailVerified) throw ApiError.badRequest('Email is already verified');

    await otpService.verify(user._id.toString(), otp, OTP_PURPOSE.REGISTER);

    const updated = await userRepository.updateById(user._id.toString(), {
      emailVerified: true,
      otpVerified: true,
      lastLogin: new Date(),
    });

    return this.buildAuthResult(updated as IUser);
  }

  /**
   * Step 1 of login. Validates credentials, then dispatches a LOGIN OTP.
   * Super Admin accounts skip OTP and receive tokens immediately.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const user = await userRepository.findByEmail(input.email, true);
    if (!user || !user.password) throw ApiError.unauthorized('Invalid email or password');

    const valid = await comparePassword(input.password, user.password);
    if (!valid) throw ApiError.unauthorized('Invalid email or password');

    if (!user.emailVerified) throw ApiError.forbidden('Please verify your email before logging in');
    if (user.status !== USER_STATUS.ACTIVE) throw ApiError.forbidden(USER_INACTIVE_MESSAGE);

    await this.markTermsAccepted(user._id.toString());

    if (this.resolveRoleSlug(user) === ROLES.SUPER_ADMIN) {
      const updated = await userRepository.updateById(user._id.toString(), { lastLogin: new Date() });
      return this.buildAuthResult(updated as IUser);
    }

    const { resendAfter } = await otpService.generateAndSend(user._id.toString(), user.email, OTP_PURPOSE.LOGIN);
    return {
      email: user.email,
      purpose: OTP_PURPOSE.LOGIN,
      resendAfter,
      message: 'Login verification code sent to your email',
    };
  }

  /** Step 2 of login. Verifies the LOGIN OTP and issues tokens. */
  async verifyLoginOtp(email: string, otp: string): Promise<AuthResult> {
    const user = await userRepository.findByEmail(email);
    if (!user) throw ApiError.notFound('Account not found');
    if (user.status !== USER_STATUS.ACTIVE) throw ApiError.forbidden(USER_INACTIVE_MESSAGE);

    await otpService.verify(user._id.toString(), otp, OTP_PURPOSE.LOGIN);

    const updated = await userRepository.updateById(user._id.toString(), { lastLogin: new Date() });
    return this.buildAuthResult(updated as IUser);
  }

  async resendOtp(email: string, purpose: string): Promise<PendingOtpResult> {
    const purposeMap: Record<string, typeof OTP_PURPOSE[keyof typeof OTP_PURPOSE]> = {
      [OTP_PURPOSE.LOGIN]: OTP_PURPOSE.LOGIN,
      [OTP_PURPOSE.REGISTER]: OTP_PURPOSE.REGISTER,
      [OTP_PURPOSE.FORGOT_PASSWORD]: OTP_PURPOSE.FORGOT_PASSWORD,
    };
    const validPurpose = purposeMap[purpose];
    if (!validPurpose) throw ApiError.badRequest('Invalid OTP purpose');

    const { resendAfter } = await otpService.resend(email, validPurpose);
    return { email, purpose: validPurpose, resendAfter, message: 'A new code has been sent' };
  }

  /** Step 1 of password reset — emails a verification code (local accounts only; Super Admin included). */
  async forgotPassword(email: string): Promise<PendingOtpResult> {
    const user = await userRepository.findByEmail(email, true);
    if (!user) throw ApiError.notFound('No account associated with this email');
    if (user.provider === AUTH_PROVIDER.GOOGLE) {
      throw ApiError.badRequest('Password reset is not available for Google sign-in accounts');
    }
    if (!user.emailVerified) throw ApiError.badRequest('Please verify your email before resetting your password');
    if (user.status !== USER_STATUS.ACTIVE) throw ApiError.forbidden(USER_INACTIVE_MESSAGE);

    const { resendAfter } = await otpService.generateAndSend(
      user._id.toString(),
      user.email,
      OTP_PURPOSE.FORGOT_PASSWORD,
    );

    return {
      email: user.email,
      purpose: OTP_PURPOSE.FORGOT_PASSWORD,
      resendAfter,
      message: 'Password reset code sent to your email',
    };
  }

  /** Step 2 of password reset — verifies the emailed code and sets a new password. */
  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const user = await userRepository.findByEmail(email, true);
    if (!user) throw ApiError.notFound('Account not found');
    if (user.provider === AUTH_PROVIDER.GOOGLE) {
      throw ApiError.badRequest('Password reset is not available for Google sign-in accounts');
    }

    await otpService.verify(user._id.toString(), otp, OTP_PURPOSE.FORGOT_PASSWORD);

    const password = await hashPassword(newPassword);
    const updated = await userRepository.updateById(user._id.toString(), { password, provider: AUTH_PROVIDER.LOCAL });
    if (!updated) throw ApiError.internal('Failed to reset password');
  }

  /**
   * Google sign-in/up. Creates the account on first contact with emailVerified=true
   * and skips the OTP flow entirely, then issues tokens immediately.
   */
  async googleAuth(idToken: string): Promise<AuthResult> {
    const profile = await verifyGoogleIdToken(idToken);

    let user = await userRepository.findByGoogleId(profile.googleId);
    if (!user) user = await userRepository.findByEmail(profile.email);

    const termsAt = new Date();

    if (!user) {
      const role = await this.getDefaultRole();
      user = await userRepository.create({
        firstName: profile.firstName,
        lastName: profile.lastName,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        provider: AUTH_PROVIDER.GOOGLE,
        googleId: profile.googleId,
        emailVerified: true,
        otpVerified: true,
        termsAccepted: true,
        termsAcceptedAt: termsAt,
        role: role._id,
        status: USER_STATUS.ACTIVE,
        lastLogin: new Date(),
      });
    } else {
      user = (await userRepository.updateById(user._id.toString(), {
        firstName: profile.firstName,
        lastName: profile.lastName,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        googleId: user.googleId ?? profile.googleId,
        provider: user.provider === AUTH_PROVIDER.LOCAL ? user.provider : AUTH_PROVIDER.GOOGLE,
        emailVerified: true,
        termsAccepted: true,
        termsAcceptedAt: termsAt,
        lastLogin: new Date(),
      })) as IUser;
    }

    if (user.status !== USER_STATUS.ACTIVE) throw ApiError.forbidden(USER_INACTIVE_MESSAGE);
    return this.buildAuthResult(user);
  }

  /** Returns the full authenticated profile for the `/auth/me` endpoint. */
  async getCurrentUser(userId: string): Promise<AuthUserDto> {
    const user = await userRepository.findByIdWithRole(userId);
    if (!user) throw ApiError.unauthorized('User no longer exists');
    if (user.status !== USER_STATUS.ACTIVE) throw ApiError.forbidden(USER_INACTIVE_MESSAGE);
    return toAuthUserDto(user, this.resolveRoleSlug(user));
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.provider !== AUTH_PROVIDER.LOCAL || !user.password) {
      throw ApiError.badRequest('Password change is not available for Google sign-in accounts');
    }

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) throw ApiError.unauthorized('Current password is incorrect');

    const password = await hashPassword(newPassword);
    const updated = await userRepository.updateById(userId, { password });
    if (!updated) throw ApiError.internal('Failed to update password');
  }

  async updateProfile(
    userId: string,
    input: {
      firstName: string;
      lastName?: string;
      postalAddress?: string;
      state?: string;
      countryRegion?: string;
      phoneNumber?: string;
      labelName?: string;
    },
  ): Promise<AuthUserDto> {
    const user = await userRepository.findByIdWithRole(userId);
    if (!user) throw ApiError.notFound('User not found');

    const lastName = input.lastName ?? '';
    const name = `${input.firstName} ${lastName}`.trim();

    const updated = await userRepository.updateById(userId, {
      $set: {
        firstName: input.firstName,
        lastName,
        name,
        'profile.postalAddress': input.postalAddress ?? '',
        'profile.state': input.state ?? '',
        'profile.countryRegion': input.countryRegion ?? '',
        'profile.phoneNumber': input.phoneNumber ?? '',
        'profile.labelName': input.labelName ?? '',
      },
    });
    if (!updated) throw ApiError.internal('Failed to update profile');

    return this.getCurrentUser(userId);
  }

  async updateBankDetails(
    userId: string,
    roleSlug: string,
    input: {
      bankName?: string;
      accountNumber?: string;
      ifscCode?: string;
      swiftCode?: string;
      micrCode?: string;
    },
  ): Promise<AuthUserDto> {
    if (roleSlug === ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('Bank details are not applicable for Super Admin accounts');
    }

    const user = await userRepository.findByIdWithRole(userId);
    if (!user) throw ApiError.notFound('User not found');

    const updated = await userRepository.updateById(userId, {
      $set: {
        'bankDetails.bankName': input.bankName ?? '',
        'bankDetails.accountNumber': input.accountNumber ?? '',
        'bankDetails.ifscCode': input.ifscCode ?? '',
        'bankDetails.swiftCode': input.swiftCode ?? '',
        'bankDetails.micrCode': input.micrCode ?? '',
      },
    });
    if (!updated) throw ApiError.internal('Failed to update bank details');

    return this.getCurrentUser(userId);
  }

  async updateAvatar(userId: string, file: Express.Multer.File): Promise<AuthUserDto> {
    const user = await userRepository.findByIdWithRole(userId);
    if (!user) throw ApiError.notFound('User not found');

    if (user.avatarUrl) {
      await deleteCloudinaryImage(user.avatarUrl);
    }

    const avatarUrl = await uploadAvatarImage(file.buffer, userId);

    const updated = await userRepository.updateById(userId, { avatarUrl });
    if (!updated) throw ApiError.internal('Failed to update profile photo');

    return this.getCurrentUser(userId);
  }

  /** Issues a fresh token pair from a valid refresh token (rotation entry point). */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const payload = verifyRefreshToken(refreshToken);
    const user = await userRepository.findByIdWithRole(payload.sub);
    if (!user) throw ApiError.unauthorized('User no longer exists');
    if (user.status !== USER_STATUS.ACTIVE) throw ApiError.forbidden(USER_INACTIVE_MESSAGE);

    return issueTokenPair({
      sub: user._id.toString(),
      email: user.email,
      role: this.resolveRoleSlug(user),
    });
  }

  private async buildAuthResult(user: IUser): Promise<AuthResult> {
    const populated = await userRepository.findByIdWithRole(user._id.toString());
    const target = populated ?? user;
    const roleSlug = this.resolveRoleSlug(target);
    const tokens = issueTokenPair({ sub: target._id.toString(), email: target.email, role: roleSlug });
    return { user: toAuthUserDto(target, roleSlug), tokens };
  }
}

export const authService = new AuthService();
