import { ROLES } from '@/constants';
import { IUser } from '@/modules/user/user.model';

const BANK_NAME_PATTERN = /^[A-Za-z][A-Za-z\s.&'-]*$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;
const IFSC_PATTERN = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;

type ProfileCheckUser = Pick<IUser, 'bankDetails'>;

/** True when required bank details are saved (elevated accounts are always complete). */
export function isProfileComplete(user: ProfileCheckUser, roleSlug: string): boolean {
  if (roleSlug === ROLES.SUPER_ADMIN || roleSlug === ROLES.SUB_ADMIN) return true;

  const bank = user.bankDetails;
  const bankName = bank?.bankName?.trim() ?? '';
  const accountNumber = bank?.accountNumber?.trim() ?? '';
  const ifscCode = bank?.ifscCode?.trim().toUpperCase() ?? '';

  return Boolean(
    bankName &&
      accountNumber &&
      ifscCode &&
      BANK_NAME_PATTERN.test(bankName) &&
      ACCOUNT_NUMBER_PATTERN.test(accountNumber) &&
      IFSC_PATTERN.test(ifscCode),
  );
}
