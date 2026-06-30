import { describe, expect, it, vi } from 'vitest';
import { DictionaryEngine } from '../../src/dictionary/engine';
import {
  candidateLemmas,
  normalizeWord,
} from '../../src/dictionary/normalize';

describe('dictionary normalization', () => {
  it('normalizes curly apostrophes and case', () => {
    expect(normalizeWord('ISN’T')).toBe("isn't");
  });

  it('offers controlled inflection candidates', () => {
    expect(candidateLemmas('studies').slice(0, 2)).toEqual([
      'studies',
      'study',
    ]);
    expect(candidateLemmas('running')).toContain('run');
    expect(candidateLemmas('rejected')).toContain('reject');
  });
});

describe('DictionaryEngine', () => {
  it('finds a lemma through inflection candidates', async () => {
    const loadShard = vi.fn(async () => ({
      run: {
        lemma: 'run',
        definitionsZh: ['跑'],
      },
    }));
    const engine = new DictionaryEngine(loadShard);

    await expect(engine.lookup('running')).resolves.toEqual({
      lookupStatus: 'found',
      entry: {
        lemma: 'run',
        definitionsZh: ['跑'],
      },
    });
  });

  it('loads each letter shard once', async () => {
    const loadShard = vi.fn(async () => ({
      run: {
        lemma: 'run',
        definitionsZh: ['跑'],
      },
    }));
    const engine = new DictionaryEngine(loadShard);

    await engine.lookup('running');
    await engine.lookup('run');

    expect(loadShard).toHaveBeenCalledOnce();
    expect(loadShard).toHaveBeenCalledWith('r');
  });

  it('returns an explicit miss', async () => {
    const engine = new DictionaryEngine(async () => ({}));

    await expect(engine.lookup('xyzzy')).resolves.toEqual({
      lookupStatus: 'not_found',
    });
  });
});
