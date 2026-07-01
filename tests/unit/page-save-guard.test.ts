import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PageSaveGuard } from '../../src/content/page-save-guard';
import type { SentenceTarget } from '../../src/content/text-segmentation';

const target: SentenceTarget = {
  word: 'ultimately',
  sentence: 'The proposal was ultimately rejected.',
  wordStart: 17,
  wordEnd: 27,
};

describe('PageSaveGuard', () => {
  it('saves a normalized sentence target only once', async () => {
    const guard = new PageSaveGuard();
    const operation = vi.fn().mockResolvedValue('capture-id');

    await expect(guard.save(target, operation)).resolves.toEqual({
      status: 'saved',
      value: 'capture-id',
    });
    await expect(guard.save({
      ...target,
      sentence: 'The  proposal was ultimately rejected. ',
    }, operation)).resolves.toEqual({ status: 'skipped' });
    expect(operation).toHaveBeenCalledOnce();
  });

  it('allows retrying after a failed save', async () => {
    const guard = new PageSaveGuard();
    const error = new Error('save failed');
    const operation = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('capture-id');

    await expect(guard.save(target, operation)).rejects.toBe(error);
    await expect(guard.save(target, operation)).resolves.toEqual({
      status: 'saved',
      value: 'capture-id',
    });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('skips a concurrent save for the same target', async () => {
    const guard = new PageSaveGuard();
    let resolveOperation: ((value: string) => void) | undefined;
    const operation = vi.fn(() => new Promise<string>((resolve) => {
      resolveOperation = resolve;
    }));

    const firstSave = guard.save(target, operation);
    await expect(guard.save(target, operation)).resolves.toEqual({
      status: 'skipped',
    });
    expect(operation).toHaveBeenCalledOnce();

    resolveOperation?.('capture-id');
    await expect(firstSave).resolves.toEqual({
      status: 'saved',
      value: 'capture-id',
    });
  });

  it('keeps a save guarded until undo succeeds', async () => {
    const guard = new PageSaveGuard();
    const saveOperation = vi.fn().mockResolvedValue('capture-id');
    const undoError = new Error('undo failed');

    await guard.save(target, saveOperation);
    await expect(
      guard.undo(target, () => Promise.reject(undoError)),
    ).rejects.toBe(undoError);
    await expect(guard.save(target, saveOperation)).resolves.toEqual({
      status: 'skipped',
    });

    await guard.undo(target, () => Promise.resolve());
    await expect(guard.save(target, saveOperation)).resolves.toEqual({
      status: 'saved',
      value: 'capture-id',
    });
    expect(saveOperation).toHaveBeenCalledTimes(2);
  });
});
