import { IUser, IUserBankDetails, IUserProfile } from '@/modules/user/user.model';
import { isProfileComplete } from '@/utils/profileCompletion';
import { isMasterAdminRole } from '@/utils/roles';

const emptyProfile = (): IUserProfile => ({
  postalAddress: '',
  state: '',
  countryRegion: '',
  phoneNumber: '',
  labelName: '',
});

const emptyBankDetails = (): IUserBankDetails => ({
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  swiftCode: '',
  micrCode: '',
});

/** Safe, serializable user representation returned to clients. */
export interface AuthUserDto {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  termsAccepted: boolean;
  status: string;
  provider: string;
  profileCompleted: boolean;
  avatarUrl?: string;
  profile?: IUserProfile;
  bankDetails?: IUserBankDetails;
  lastLogin?: Date;
  /** null for Master Admin / unscoped elevated accounts. */
  tenantId: string | null;
  isMasterAdmin: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUserDto;
  tokens: AuthTokens;
}

export interface PendingOtpResult {
  email: string;
  purpose: string;
  resendAfter: number;
  message: string;
}

export type LoginResult = PendingOtpResult | AuthResult;

export const toAuthUserDto = (user: IUser, roleSlug: string): AuthUserDto => ({
  id: user._id.toString(),
  firstName: user.firstName,
  lastName: user.lastName,
  name: user.name,
  email: user.email,
  role: roleSlug,
  emailVerified: user.emailVerified,
  termsAccepted: Boolean(user.termsAccepted),
  status: user.status,
  provider: user.provider,
  profileCompleted: isProfileComplete(user, roleSlug),
  avatarUrl: user.avatarUrl,
  profile: {
    ...emptyProfile(),
    postalAddress: user.profile?.postalAddress ?? '',
    state: user.profile?.state ?? '',
    countryRegion: user.profile?.countryRegion ?? '',
    phoneNumber: user.profile?.phoneNumber ?? '',
    labelName: user.profile?.labelName ?? '',
  },
  bankDetails: {
    ...emptyBankDetails(),
    bankName: user.bankDetails?.bankName ?? '',
    accountNumber: user.bankDetails?.accountNumber ?? '',
    ifscCode: user.bankDetails?.ifscCode ?? '',
    swiftCode: user.bankDetails?.swiftCode ?? '',
    micrCode: user.bankDetails?.micrCode ?? '',
  },
  lastLogin: user.lastLogin,
  tenantId: user.tenantId ? user.tenantId.toString() : null,
  isMasterAdmin: isMasterAdminRole(roleSlug),
});
