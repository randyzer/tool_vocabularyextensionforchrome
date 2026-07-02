import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  mergeDictionaryEntries,
  parseBlocklist,
  parseCustomWords,
  parseEcdict,
  type DictionaryBuildEntry,
} from '../../scripts/dictionary/pipeline';

const fixturePath = resolve(
  process.cwd(),
  'tests/fixtures/dictionary/ecdict.csv',
);
const customFixturePath = resolve(
  process.cwd(),
  'tests/fixtures/dictionary/custom-words.csv',
);
const blocklistFixturePath = resolve(
  process.cwd(),
  'tests/fixtures/dictionary/blocklist.txt',
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

  it('lets custom words override ECDICT and applies the blocklist', async () => {
    const [ecdictCsv, customCsv, blocklist] = await Promise.all([
      readFile(fixturePath, 'utf8'),
      readFile(customFixturePath, 'utf8'),
      readFile(blocklistFixturePath, 'utf8'),
    ]);

    const merged = mergeDictionaryEntries(
      parseEcdict(ecdictCsv),
      parseCustomWords(customCsv),
      parseBlocklist(blocklist),
    );

    expect(merged.get('ability')?.definitionsZh).toEqual(['本领', '能力']);
    expect(merged.get('ability')?.source).toBe('custom');
    expect(merged.get('cloud-native')?.definitionsZh).toEqual(['云原生']);
    expect(merged.has('running')).toBe(false);
  });

  it('reports the row for duplicate custom keys', () => {
    const csv = [
      'word,phonetic,part_of_speech,definitions_zh,source,note',
      'Ability,,n,能力,maintainer,first',
      'ability,,n,本领,maintainer,duplicate',
    ].join('\n');

    expect(() => parseCustomWords(csv))
      .toThrow('CUSTOM_DUPLICATE_WORD:ability:row=3');
  });

  it('reports invalid blocklist rows', () => {
    expect(() => parseBlocklist('valid\nbad123\n'))
      .toThrow('BLOCKLIST_INVALID_WORD:bad123:row=2');
  });
});
