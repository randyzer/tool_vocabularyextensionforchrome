import { describe, expect, it, vi } from 'vitest';
import type { WeeklyDigest } from '../../src/shared/models';
import {
  createDigestService,
  previousNaturalWeek,
} from '../../src/background/digest-service';

describe('weekly digest', () => {
  it('returns the previous Monday-to-Monday window', () => {
    const now = new Date('2026-06-30T12:00:00+08:00').getTime();
    const period = previousNaturalWeek(now);

    expect(new Date(period.periodStart).getDay()).toBe(1);
    expect(new Date(period.periodEnd).getDay()).toBe(1);
    expect(period.periodEnd - period.periodStart).toBe(
      7 * 24 * 60 * 60 * 1_000,
    );
  });

  it('returns an existing digest instead of creating a duplicate', async () => {
    const existing: WeeklyDigest = {
      id: crypto.randomUUID(),
      periodStart: 0,
      periodEnd: 1,
      generatedAt: 2,
      captureIds: [],
      wordCount: 0,
      sentenceCount: 0,
    };
    const service = createDigestService({
      findByPeriod: vi.fn().mockResolvedValue(existing),
      listCaptures: vi.fn(),
      putDigest: vi.fn(),
    });

    expect(await service.generate(1_000)).toBe(existing);
  });
});
