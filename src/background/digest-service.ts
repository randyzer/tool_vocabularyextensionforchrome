import type { WeeklyDigest } from '../shared/models';
import { listCaptures } from '../storage/capture-repository';
import {
  getDigestByPeriod,
  putDigest,
} from '../storage/digest-repository';

export function previousNaturalWeek(now: number): {
  periodStart: number;
  periodEnd: number;
} {
  const current = new Date(now);
  const day = current.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const currentMonday = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate() - daysSinceMonday,
    0,
    0,
    0,
    0,
  );
  const periodEnd = currentMonday.getTime();
  const periodStartDate = new Date(currentMonday);
  periodStartDate.setDate(periodStartDate.getDate() - 7);

  return {
    periodStart: periodStartDate.getTime(),
    periodEnd,
  };
}

interface DigestDependencies {
  findByPeriod: typeof getDigestByPeriod;
  listCaptures: typeof listCaptures;
  putDigest: typeof putDigest;
}

export function createDigestService(deps: DigestDependencies) {
  return {
    async generate(now = Date.now()): Promise<WeeklyDigest> {
      const { periodStart, periodEnd } = previousNaturalWeek(now);
      const existing = await deps.findByPeriod(periodStart, periodEnd);

      if (existing) {
        return existing;
      }

      const captures = await deps.listCaptures({
        from: periodStart,
        to: periodEnd,
      });
      const digest: WeeklyDigest = {
        id: crypto.randomUUID(),
        periodStart,
        periodEnd,
        generatedAt: now,
        captureIds: captures.map((capture) => capture.id),
        wordCount: new Set(captures.map((capture) => capture.lemma)).size,
        sentenceCount: captures.length,
      };

      await deps.putDigest(digest);
      return digest;
    },
  };
}

export const digestService = createDigestService({
  findByPeriod: getDigestByPeriod,
  listCaptures,
  putDigest,
});
