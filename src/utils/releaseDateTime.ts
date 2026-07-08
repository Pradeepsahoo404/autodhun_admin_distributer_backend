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
  const hms = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (hms) {
    const hour = Number(hms[1]);
    const minute = Number(hms[2]);
    const second = Number(hms[3]);
    if (hour < 0 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
    return hour * 60 + minute + Math.floor(second / 60);
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function isValidCrbtStartTime(value: string): boolean {
  const trimmed = value.trim();
  if (!/^(\d{1,2}):(\d{2}):(\d{2})$/.test(trimmed)) return false;
  const [, h, m, s] = trimmed.match(/^(\d+):(\d+):(\d+)$/) ?? [];
  if (!h || !m || !s) return false;
  const minute = Number(m);
  const second = Number(s);
  return minute >= 0 && minute <= 59 && second >= 0 && second <= 59 && Number(h) >= 0;
}

export function isTodayOrPastApiDate(value: string): boolean {
  const parsed = parseApiDateString(value);
  if (!parsed) return true;
  const today = startOfDay(new Date());
  return startOfDay(parsed).getTime() <= today.getTime();
}

export function tomorrowApiDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isPastTimeForToday(time: string): boolean {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return true;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  return minutes < current;
}
