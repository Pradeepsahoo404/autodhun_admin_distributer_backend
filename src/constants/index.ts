/** Canonical role slugs used throughout the RBAC layer. */
export const ROLES = {
  SUPER_ADMIN: 'super-admin',
  SUB_ADMIN: 'sub-admin',
  ADMIN: 'admin',
} as const;

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];

/** Account status lifecycle. */
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

/** Shown when a deactivated admin tries to sign in or use an existing session. */
export const USER_INACTIVE_MESSAGE =
  'Your account is inactive. To make it active, please contact the Owner.';

/** Role status — active roles can be assigned; inactive are hidden from assignment. */
export const ROLE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type RoleStatus = (typeof ROLE_STATUS)[keyof typeof ROLE_STATUS];

/** Authentication provider that created/owns the account. */
export const AUTH_PROVIDER = {
  LOCAL: 'local',
  GOOGLE: 'google',
} as const;

export type AuthProvider = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];

/** OTP intent — determines lifecycle and the action taken after verification. */
export const OTP_PURPOSE = {
  REGISTER: 'REGISTER',
  LOGIN: 'LOGIN',
  FORGOT_PASSWORD: 'FORGOT_PASSWORD',
} as const;

export type OtpPurpose = (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE];

/** Permission actions that can be granted per module. */
export const PERMISSION_ACTIONS = {
  VIEW: 'canView',
  CREATE: 'canCreate',
  UPDATE: 'canUpdate',
  DELETE: 'canDelete',
} as const;

export type PermissionAction = 'view' | 'create' | 'update' | 'delete';

/** Token type discriminator embedded in JWT payloads. */
export const TOKEN_TYPE = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;

export const REFRESH_TOKEN_COOKIE = 'refreshToken';

/** Rights Manager legal module entry lifecycle. */
export const LEGAL_MODULE_STATUS = {
  IN_PROGRESS: 'in_progress',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type LegalModuleStatus = (typeof LEGAL_MODULE_STATUS)[keyof typeof LEGAL_MODULE_STATUS];
