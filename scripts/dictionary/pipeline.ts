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

export interface ParsedCustomWords {
  entries: Map<string, DictionaryBuildEntry>;
  notes: Map<string, { source: string; note?: string }>;
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

export function parseCustomWords(csv: string): ParsedCustomWords {
  const rows = parse(csv, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    info: true,
  }) as Array<{
    record: Record<string, string>;
    info: { lines: number };
  }>;
  const entries = new Map<string, DictionaryBuildEntry>();
  const notes = new Map<string, { source: string; note?: string }>();

  for (const { record, info } of rows) {
    const lemma = normalizeDictionaryWord(record.word ?? '');
    if (!WORD_PATTERN.test(lemma)) {
      throw new Error(`CUSTOM_INVALID_WORD:${lemma}:row=${info.lines}`);
    }
    if (entries.has(lemma)) {
      throw new Error(`CUSTOM_DUPLICATE_WORD:${lemma}:row=${info.lines}`);
    }

    const definitionsZh = uniqueNonEmpty(
      String(record.definitions_zh ?? '').split('|'),
    ).slice(0, 6);
    const source = String(record.source ?? '').trim();
    if (definitionsZh.length === 0 || source.length === 0) {
      throw new Error(`CUSTOM_REQUIRED_FIELD:${lemma}:row=${info.lines}`);
    }

    entries.set(lemma, {
      lemma,
      phonetic: String(record.phonetic ?? '').trim() || undefined,
      partOfSpeech: uniqueNonEmpty(
        String(record.part_of_speech ?? '').split('|'),
      ),
      definitionsZh,
      source: 'custom',
    });
    notes.set(lemma, {
      source,
      note: String(record.note ?? '').trim() || undefined,
    });
  }

  return { entries, notes };
}

export function parseBlocklist(text: string): Set<string> {
  const words = new Set<string>();

  text.split(/\r?\n/).forEach((raw, index) => {
    const value = raw.trim();
    if (!value || value.startsWith('#')) {
      return;
    }

    const word = normalizeDictionaryWord(value);
    if (!WORD_PATTERN.test(word)) {
      throw new Error(`BLOCKLIST_INVALID_WORD:${word}:row=${index + 1}`);
    }
    words.add(word);
  });

  return words;
}

export function mergeDictionaryEntries(
  upstream: Map<string, DictionaryBuildEntry>,
  custom: ParsedCustomWords,
  blocklist: Set<string>,
): Map<string, DictionaryBuildEntry> {
  const merged = new Map(upstream);

  for (const [word, entry] of custom.entries) {
    merged.set(word, entry);
  }
  for (const word of blocklist) {
    merged.delete(word);
  }

  return new Map([...merged.entries()].sort(([left], [right]) => (
    left.localeCompare(right, 'en')
  )));
}
