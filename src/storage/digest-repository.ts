import type { WeeklyDigest } from '../shared/models';
import { getDatabase } from './database';

export async function putDigest(digest: WeeklyDigest): Promise<void> {
  await (await getDatabase()).put('digests', digest);
}

export async function getDigest(
  digestId: string,
): Promise<WeeklyDigest | undefined> {
  return (await getDatabase()).get('digests', digestId);
}

export async function getDigestByPeriod(
  periodStart: number,
  periodEnd: number,
): Promise<WeeklyDigest | undefined> {
  return (await getDatabase()).getFromIndex(
    'digests',
    'periodKey',
    [periodStart, periodEnd],
  );
}

export async function listDigests(): Promise<WeeklyDigest[]> {
  const digests = await (await getDatabase()).getAll('digests');
  return digests.sort(
    (left, right) => right.generatedAt - left.generatedAt,
  );
}
