import { ApiError } from '@/utils/ApiError';

const API_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseApiDateString(value: string): Date | null {
  if (!API_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isPastApiDate(value: string): boolean {
  const parsed = parseApiDateString(value);
  if (!parsed) return true;
  const today = startOfDay(new Date());
  return startOfDay(parsed).getTime() < today.getTime();
}

export function assertFutureOrTodayApiDate(value: string, label: string): void {
  if (!parseApiDateString(value)) {
    throw ApiError.badRequest(`${label} must be a valid date (yyyy-MM-dd)`);
  }
  if (isPastApiDate(value)) {
    throw ApiError.badRequest(`${label} cannot be in the past`);
  }
}

export function assertScheduledOnOrAfterRelease(
  releasingDate: string,
  scheduledReleaseDate: string,
): void {
  const release = parseApiDateString(releasingDate);
  const scheduled = parseApiDateString(scheduledReleaseDate);
  if (!release || !scheduled) {
    throw ApiError.badRequest('Invalid releasing or scheduled date');
  }
  if (startOfDay(scheduled).getTime() < startOfDay(release).getTime()) {
    throw ApiError.badRequest('Scheduled release date cannot be before releasing date');
  }
}

export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function isPastTimeForToday(time: string): boolean {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return true;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  return minutes < current;
}
