import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabaseForTest } from '../../src/storage/database';
import {
  listCaptures,
  saveCapture,
  undoCapture,
  updateCapture,
} from '../../src/storage/capture-repository';
import {
  getDigest,
  getDigestByPeriod,
  listDigests,
  putDigest,
} from '../../src/storage/digest-repository';
import type { WeeklyDigest } from '../../src/shared/models';

beforeEach(clearDatabaseForTest);

const input = {
  surfaceWord: 'Ultimately',
  sentence: 'The proposal was ultimately rejected.',
  wordStart: 17,
  wordEnd: 27,
  sourceTitle: 'Article',
  sourceUrl: 'https://example.com/article',
};

const dictionaryEntry = {
  lemma: 'ultimately',
  definitionsZh: ['最终'],
};

describe('capture repository', () => {
  it('deduplicates the same lemma, sentence, and source origin', async () => {
    const first = await saveCapture(input, dictionaryEntry, 100);
    const second = await saveCapture(input, dictionaryEntry, 200);

    expect(second.capture.id).toBe(first.capture.id);
    expect(second.capture.encounterCount).toBe(2);
    expect(second.capture.lastSeenAt).toBe(200);
  });

  it('undoes the latest duplicate encounter without deleting the capture', async () => {
    const first = await saveCapture(input, dictionaryEntry, 100);
    const second = await saveCapture(input, dictionaryEntry, 200);

    await undoCapture(second.capture.id, second.savedAt);

    const captures = await listCaptures({});
    expect(captures).toHaveLength(1);
    expect(captures[0]?.id).toBe(first.capture.id);
    expect(captures[0]?.encounterCount).toBe(1);
  });

  it('deletes a newly created capture when undone', async () => {
    const result = await saveCapture(input, dictionaryEntry, 100);

    await undoCapture(result.capture.id, result.savedAt);

    expect(await listCaptures({})).toEqual([]);
  });

  it('rejects a stale undo token', async () => {
    const first = await saveCapture(input, dictionaryEntry, 100);
    await saveCapture(input, dictionaryEntry, 200);

    await expect(
      undoCapture(first.capture.id, first.savedAt),
    ).rejects.toThrow('UNDO_STALE');
  });

  it('updates and filters mastered captures', async () => {
    const result = await saveCapture(input, dictionaryEntry, 100);

    await updateCapture(result.capture.id, true);

    expect(await listCaptures({ mastered: false })).toEqual([]);
    expect((await listCaptures({ mastered: true }))[0]).toMatchObject({
      id: result.capture.id,
      mastered: true,
      masteredKey: 1,
    });
  });
});

describe('digest repository', () => {
  it('retrieves digests by id and natural-week period', async () => {
    const digest: WeeklyDigest = {
      id: crypto.randomUUID(),
      periodStart: 100,
      periodEnd: 200,
      generatedAt: 250,
      captureIds: [],
      wordCount: 0,
      sentenceCount: 0,
    };

    await putDigest(digest);

    await expect(getDigest(digest.id)).resolves.toEqual(digest);
    await expect(getDigestByPeriod(100, 200)).resolves.toEqual(digest);
    await expect(listDigests()).resolves.toEqual([digest]);
  });

  it('rejects two digest ids for the same period', async () => {
    const first: WeeklyDigest = {
      id: crypto.randomUUID(),
      periodStart: 100,
      periodEnd: 200,
      generatedAt: 250,
      captureIds: [],
      wordCount: 0,
      sentenceCount: 0,
    };
    await putDigest(first);

    await expect(putDigest({
      ...first,
      id: crypto.randomUUID(),
    })).rejects.toThrow();
  });
});
