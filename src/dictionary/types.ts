import type { DictionaryEntry } from '../shared/models';

export type DictionaryShard = Record<string, DictionaryEntry>;

export type LookupResult =
  | { lookupStatus: 'found'; entry: DictionaryEntry }
  | { lookupStatus: 'not_found' };
