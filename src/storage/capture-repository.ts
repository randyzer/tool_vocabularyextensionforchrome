import { normalizeSentence } from '../content/text-segmentation';
import { normalizeWord } from '../dictionary/normalize';
import type {
  Capture,
  CaptureFilter,
  DictionaryEntry,
  SaveCaptureInput,
  SaveCaptureResult,
} from '../shared/models';
import { assertWordOffset } from '../shared/validation';
import { getDatabase } from './database';

function createDedupeKey(
  lemma: string,
  sentence: string,
  sourceOrigin: string,
): string {
  return JSON.stringify([lemma, normalizeSentence(sentence), sourceOrigin]);
}

export async function saveCapture(
  input: SaveCaptureInput,
  dictionaryEntry: DictionaryEntry,
  now = Date.now(),
): Promise<SaveCaptureResult> {
  assertWordOffset(
    input.sentence,
    input.surfaceWord,
    input.wordStart,
    input.wordEnd,
  );

  const normalizedWord = normalizeWord(input.surfaceWord);
  const lemma = normalizeWord(dictionaryEntry.lemma);
  const sourceOrigin = new URL(input.sourceUrl).origin;
  const dedupeKey = createDedupeKey(
    lemma,
    input.sentence,
    sourceOrigin,
  );
  const database = await getDatabase();
  const transaction = database.transaction('captures', 'readwrite');
  const store = transaction.objectStore('captures');
  const existing = await store.index('dedupeKey').get(dedupeKey);

  if (existing) {
    const capture: Capture = {
      ...existing,
      sourceTitle: input.sourceTitle,
      sourceUrl: input.sourceUrl,
      lastSeenAt: now,
      encounterCount: existing.encounterCount + 1,
    };
    await store.put(capture);
    await transaction.done;
    return { capture, savedAt: now };
  }

  const capture: Capture = {
    id: crypto.randomUUID(),
    surfaceWord: input.surfaceWord,
    normalizedWord,
    lemma,
    phonetic: dictionaryEntry.phonetic,
    partOfSpeech: dictionaryEntry.partOfSpeech,
    definitionsZh: dictionaryEntry.definitionsZh,
    sentence: normalizeSentence(input.sentence),
    wordStart: input.wordStart,
    wordEnd: input.wordEnd,
    sourceTitle: input.sourceTitle,
    sourceUrl: input.sourceUrl,
    sourceOrigin,
    createdAt: now,
    lastSeenAt: now,
    encounterCount: 1,
    mastered: false,
    masteredKey: 0,
    lookupStatus: 'found',
    dedupeKey,
  };

  await store.add(capture);
  await transaction.done;
  return { capture, savedAt: now };
}

export async function undoCapture(
  captureId: string,
  savedAt: number,
): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction('captures', 'readwrite');
  const store = transaction.objectStore('captures');
  const capture = await store.get(captureId);

  if (!capture) {
    throw new Error('CAPTURE_NOT_FOUND');
  }
  if (capture.lastSeenAt !== savedAt) {
    throw new Error('UNDO_STALE');
  }

  if (capture.encounterCount === 1) {
    await store.delete(captureId);
  } else {
    await store.put({
      ...capture,
      encounterCount: capture.encounterCount - 1,
      lastSeenAt: capture.createdAt,
    });
  }

  await transaction.done;
}

export async function listCaptures(
  filter: CaptureFilter,
): Promise<Capture[]> {
  const captures = await (await getDatabase()).getAll('captures');
  return captures
    .filter((capture) => (
      (filter.from === undefined || capture.lastSeenAt >= filter.from)
      && (filter.to === undefined || capture.lastSeenAt <= filter.to)
      && (filter.lemma === undefined || capture.lemma === filter.lemma)
      && (
        filter.mastered === undefined
        || capture.mastered === filter.mastered
      )
    ))
    .sort((left, right) => right.lastSeenAt - left.lastSeenAt);
}

export async function updateCapture(
  captureId: string,
  mastered: boolean,
): Promise<Capture> {
  const database = await getDatabase();
  const transaction = database.transaction('captures', 'readwrite');
  const store = transaction.objectStore('captures');
  const capture = await store.get(captureId);

  if (!capture) {
    throw new Error('CAPTURE_NOT_FOUND');
  }

  const updated: Capture = {
    ...capture,
    mastered,
    masteredKey: mastered ? 1 : 0,
  };
  await store.put(updated);
  await transaction.done;
  return updated;
}

export async function deleteCapture(captureId: string): Promise<void> {
  await (await getDatabase()).delete('captures', captureId);
}
