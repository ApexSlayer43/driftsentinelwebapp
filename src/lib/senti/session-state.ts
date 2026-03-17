// src/lib/senti/session-state.ts
// Lightweight session state resolver for the Senti chat route.
// Mirrors the backend session-clock.ts logic but runs in the Next.js API route.

import type { SessionConfig } from '@/lib/types';
import type { SessionStateInfo } from './context';

const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function parseHhMm(s: string): { hours: number; minutes: number } | null {
  const parts = s.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0]!, 10);
  const m = parseInt(parts[1]!, 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { hours: h, minutes: m };
}

function getUtcOffsetMinutes(ianaTimezone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);

  let localHour = get('hour');
  if (localHour === 24) localHour = 0;

  const localAsUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    localHour, get('minute'), get('second'),
  );
  return Math.round((localAsUtc - date.getTime()) / 60_000);
}

function localTimeToUtc(localHhMm: string, dateStr: string, ianaTimezone: string): Date | null {
  const time = parseHhMm(localHhMm);
  if (!time) return null;

  const dateParts = dateStr.split('-').map(Number);
  const y = dateParts[0]!;
  const mo = dateParts[1]!;
  const d = dateParts[2]!;
  const roughUtc = new Date(Date.UTC(y, mo - 1, d, time.hours, time.minutes));
  const offsetMinutes = getUtcOffsetMinutes(ianaTimezone, roughUtc);
  const actualUtc = new Date(
    Date.UTC(y, mo - 1, d, time.hours, time.minutes) - offsetMinutes * 60_000,
  );

  const verifyOffset = getUtcOffsetMinutes(ianaTimezone, actualUtc);
  if (verifyOffset !== offsetMinutes) {
    return new Date(
      Date.UTC(y, mo - 1, d, time.hours, time.minutes) - verifyOffset * 60_000,
    );
  }
  return actualUtc;
}

interface SessionBoundary {
  start_utc: Date;
  end_utc: Date;
  name: string;
}

function resolveSessionBoundaries(
  session: SessionConfig,
  dateStr: string,
  userTimezone: string | null,
): SessionBoundary | null {
  const tz = session.market_tz || userTimezone;
  if (!tz) {
    const start = parseHhMm(session.start_local || session.start_utc);
    const end = parseHhMm(session.end_local || session.end_utc);
    if (!start || !end) return null;

    const dateParts = dateStr.split('-').map(Number);
    const fy = dateParts[0]!;
    const fm = dateParts[1]!;
    const fd = dateParts[2]!;
    return {
      start_utc: new Date(Date.UTC(fy, fm - 1, fd, start.hours, start.minutes)),
      end_utc: new Date(Date.UTC(fy, fm - 1, fd, end.hours, end.minutes)),
      name: session.name,
    };
  }

  const startLocal = session.start_local || session.start_utc;
  const endLocal = session.end_local || session.end_utc;

  const startUtc = localTimeToUtc(startLocal, dateStr, tz);
  const endUtc = localTimeToUtc(endLocal, dateStr, tz);
  if (!startUtc || !endUtc) return null;

  if (endUtc <= startUtc) {
    endUtc.setUTCDate(endUtc.getUTCDate() + 1);
    const nextDateStr = endUtc.toISOString().slice(0, 10);
    const correctedEnd = localTimeToUtc(endLocal, nextDateStr, tz);
    if (correctedEnd) {
      return { start_utc: startUtc, end_utc: correctedEnd, name: session.name };
    }
  }

  return { start_utc: startUtc, end_utc: endUtc, name: session.name };
}

/**
 * Compute current session state for the Senti prompt context.
 */
export function computeSessionState(
  sessions: SessionConfig[],
  userTimezone: string | null,
): SessionStateInfo {
  const now = new Date();

  let userLocalTime: string | undefined;
  if (userTimezone) {
    try {
      userLocalTime = now.toLocaleTimeString('en-US', {
        timeZone: userTimezone,
        hour: '2-digit', minute: '2-digit', hour12: false,
      });
    } catch {
      // ignore
    }
  }

  if (!sessions || sessions.length === 0) {
    return { state: 'OFF_DAY', userLocalTime, userTimezone: userTimezone ?? undefined };
  }

  const dateStr = now.toISOString().slice(0, 10);

  let localDayIndex: number;
  if (userTimezone) {
    try {
      const dayStr = now.toLocaleDateString('en-US', {
        timeZone: userTimezone,
        weekday: 'short',
      });
      localDayIndex = DAY_MAP[dayStr] ?? now.getUTCDay();
    } catch {
      localDayIndex = now.getUTCDay();
    }
  } else {
    localDayIndex = now.getUTCDay();
  }

  let nextSessionStart: Date | null = null;
  let closestPreSessionGap = Infinity;

  for (const session of sessions) {
    const boundaries = resolveSessionBoundaries(session, dateStr, userTimezone);
    if (!boundaries) continue;

    const rawDays = Array.isArray(session.days) ? session.days : [];
    const dayIndices = rawDays
      .map(d => DAY_MAP[d])
      .filter((n): n is number => n != null);
    const daySet = new Set(dayIndices.length > 0 ? dayIndices : [0, 1, 2, 3, 4, 5, 6]);

    if (!daySet.has(localDayIndex)) continue;

    const { start_utc: startUtc, end_utc: endUtc } = boundaries;

    if (now >= startUtc && now <= endUtc) {
      const elapsed = Math.round((now.getTime() - startUtc.getTime()) / 60_000);
      const remaining = Math.round((endUtc.getTime() - now.getTime()) / 60_000);
      return {
        state: 'IN_SESSION',
        currentSession: session.name,
        minutesElapsed: elapsed,
        minutesRemaining: remaining,
        userLocalTime,
        userTimezone: userTimezone ?? undefined,
      };
    }

    if (now < startUtc) {
      const gap = startUtc.getTime() - now.getTime();
      if (gap < closestPreSessionGap) {
        closestPreSessionGap = gap;
        nextSessionStart = startUtc;
      }
    }
  }

  if (nextSessionStart) {
    return {
      state: 'PRE_SESSION',
      nextSessionStart: nextSessionStart.toISOString(),
      userLocalTime,
      userTimezone: userTimezone ?? undefined,
    };
  }

  // Check if any session was active today
  let hadSessionToday = false;
  for (const session of sessions) {
    const rawDays = Array.isArray(session.days) ? session.days : [];
    const dayIndices = rawDays
      .map(d => DAY_MAP[d])
      .filter((n): n is number => n != null);
    const daySet = new Set(dayIndices.length > 0 ? dayIndices : [0, 1, 2, 3, 4, 5, 6]);
    if (daySet.has(localDayIndex)) {
      hadSessionToday = true;
      break;
    }
  }

  return {
    state: hadSessionToday ? 'POST_SESSION' : 'OFF_DAY',
    userLocalTime,
    userTimezone: userTimezone ?? undefined,
  };
}
