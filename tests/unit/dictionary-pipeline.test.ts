import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseEcdict,
  type DictionaryBuildEntry,
} from '../../scripts/dictionary/pipeline';

const fixturePath = resolve(
  process.cwd(),
  'tests/fixtures/dictionary/ecdict.csv',
);

describe('dictionary pipeline', () => {
  it('parses eligible ECDICT rows into runtime entries', async () => {
    const csv = await readFile(fixturePath, 'utf8');

    expect(parseEcdict(csv)).toEqual<Map<string, DictionaryBuildEntry>>(
      new Map([
        ['ability', {
          lemma: 'ability',
          phonetic: 'əˈbɪləti',
          partOfSpeech: ['n'],
          definitionsZh: ['n. 能力'],
          frequencyRank: 900,
          source: 'ecdict',
        }],
        ['running', {
          lemma: 'running',
          phonetic: 'ˈrʌnɪŋ',
          partOfSpeech: ['n'],
          definitionsZh: ['n. 跑步'],
          frequencyRank: 2200,
          source: 'ecdict',
        }],
      ]),
    );
  });

  it('rejects ECDICT files missing required columns', () => {
    expect(() => parseEcdict('word,translation\nability,能力\n'))
      .toThrow('ECDICT_MISSING_COLUMNS:phonetic,pos,oxford,tag,bnc,frq');
  });
});
