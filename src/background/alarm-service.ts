import { WEEKLY_ALARM_NAME } from '../shared/constants';
import { getSettings } from '../storage/settings-repository';

function nextMondayAt(now: Date, hour: number, minute: number): number {
  const candidate = new Date(now);
  const daysUntilMonday = (1 - now.getDay() + 7) % 7;

  candidate.setDate(now.getDate() + daysUntilMonday);
  candidate.setHours(hour, minute, 0, 0);

  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return candidate.getTime();
}

export async function ensureWeeklyAlarm(now = new Date()): Promise<void> {
  const settings = await getSettings();
  const existing = await browser.alarms.get(WEEKLY_ALARM_NAME);
  const scheduled = nextMondayAt(
    now,
    settings.notificationHour,
    settings.notificationMinute,
  );
  const drift = existing
    ? Math.abs(existing.scheduledTime - scheduled)
    : Number.POSITIVE_INFINITY;

  if (!existing || drift > 60_000) {
    await browser.alarms.clear(WEEKLY_ALARM_NAME);
    await browser.alarms.create(WEEKLY_ALARM_NAME, {
      when: scheduled,
      periodInMinutes: 7 * 24 * 60,
    });
  }
}
