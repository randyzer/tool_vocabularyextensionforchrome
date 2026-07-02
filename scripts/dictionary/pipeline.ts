import { parse } from 'csv-parse/sync';

const WORD_PATTERN = /^[a-z][a-z'-]*$/;
const REQUIRED_ECDICT_COLUMNS = [
  'word',
  'phonetic',
  'pos',
  'translation',
  'oxford',
  'tag',
  'bnc',
  'frq',
] as const;

export interface DictionaryBuildEntry {
  lemma: string;
  phonetic?: string;
  partOfSpeech?: string[];
  definitionsZh: string[];
  frequencyRank?: number;
  source: 'ecdict' | 'custom';
}

export function normalizeDictionaryWord(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('en')
    .replaceAll('’', "'");
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function assertColumns(csv: string): void {
  const [header = ''] = csv.replace(/^\uFEFF/, '').split(/\r?\n/, 1);
  const columns = header.split(',').map((value) => value.trim());
  const missing = REQUIRED_ECDICT_COLUMNS.filter(
    (column) => !columns.includes(column),
  );

  if (missing.length > 0) {
    throw new Error(`ECDICT_MISSING_COLUMNS:${missing.join(',')}`);
  }
}

export function parseEcdict(csv: string): Map<string, DictionaryBuildEntry> {
  assertColumns(csv);
  const rows = parse(csv, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  }) as Array<Record<string, string>>;
  const entries = new Map<string, DictionaryBuildEntry>();

  for (const row of rows) {
    const lemma = normalizeDictionaryWord(row.word ?? '');
    const definitionsZh = uniqueNonEmpty(
      String(row.translation ?? '').split(/\r?\n/),
    ).slice(0, 6);
    const bncRank = Number(row.bnc) || 0;
    const contemporaryRank = Number(row.frq) || 0;
    const eligible = (
      String(row.tag ?? '').trim().length > 0
      || String(row.oxford ?? '').trim() === '1'
      || (bncRank > 0 && bncRank <= 50_000)
      || (contemporaryRank > 0 && contemporaryRank <= 50_000)
    );

    if (!WORD_PATTERN.test(lemma) || definitionsZh.length === 0 || !eligible) {
      continue;
    }

    const ranks = [bncRank, contemporaryRank].filter((rank) => rank > 0);
    entries.set(lemma, {
      lemma,
      phonetic: String(row.phonetic ?? '').trim() || undefined,
      partOfSpeech: uniqueNonEmpty(
        [...String(row.pos ?? '').matchAll(/([a-z]+):/gi)]
          .map((match) => match[1] ?? ''),
      ),
      definitionsZh,
      frequencyRank: ranks.length > 0 ? Math.min(...ranks) : undefined,
      source: 'ecdict',
    });
  }

  return entries;
}
