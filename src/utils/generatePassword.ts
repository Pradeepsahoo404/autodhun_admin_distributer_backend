/** Generates a random password that satisfies the app's password policy. */
export function generateSecurePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!&*';
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const all = upper + lower + digits + special;
  const rest = Array.from({ length: Math.max(length - required.length, 4) }, () => pick(all));

  return [...required, ...rest].sort(() => Math.random() - 0.5).join('');
}
