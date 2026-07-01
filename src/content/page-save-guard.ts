import {
  normalizeSentence,
  type SentenceTarget,
} from './text-segmentation';

export type GuardedSaveResult<T> = {
  status: 'saved';
  value: T;
} | {
  status: 'skipped';
};

function targetKey(target: SentenceTarget): string {
  return JSON.stringify([
    target.word,
    normalizeSentence(target.sentence),
    target.wordStart,
  ]);
}

export class PageSaveGuard {
  private pendingKeys = new Set<string>();

  private savedKeys = new Set<string>();

  async save<T>(
    target: SentenceTarget,
    operation: () => Promise<T>,
  ): Promise<GuardedSaveResult<T>> {
    const key = targetKey(target);

    if (this.savedKeys.has(key) || this.pendingKeys.has(key)) {
      return { status: 'skipped' };
    }

    this.pendingKeys.add(key);
    try {
      const value = await operation();
      this.savedKeys.add(key);
      return { status: 'saved', value };
    } finally {
      this.pendingKeys.delete(key);
    }
  }

  async undo(
    target: SentenceTarget,
    operation: () => Promise<void>,
  ): Promise<void> {
    const key = targetKey(target);

    await operation();
    this.savedKeys.delete(key);
  }
}
