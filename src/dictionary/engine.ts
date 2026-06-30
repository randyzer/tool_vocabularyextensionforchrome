import { candidateLemmas } from './normalize';
import type { DictionaryShard, LookupResult } from './types';

export class DictionaryEngine {
  private readonly cache = new Map<
    string,
    Promise<DictionaryShard>
  >();

  constructor(
    private readonly loadShard: (
      key: string,
    ) => Promise<DictionaryShard> = async (key) => {
      const getRuntimeUrl = browser.runtime.getURL as (
        path: string,
      ) => string;
      const url = getRuntimeUrl(`dictionary/${key}.json`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`DICTIONARY_SHARD_${response.status}`);
      }

      return response.json() as Promise<DictionaryShard>;
    },
  ) {}

  async lookup(surfaceWord: string): Promise<LookupResult> {
    for (const candidate of candidateLemmas(surfaceWord)) {
      const key = candidate.charAt(0);

      if (!/^[a-z]$/.test(key)) {
        continue;
      }

      const shard = await this.getShard(key);
      const entry = shard[candidate];

      if (entry) {
        return { lookupStatus: 'found', entry };
      }
    }

    return { lookupStatus: 'not_found' };
  }

  private getShard(key: string): Promise<DictionaryShard> {
    const existing = this.cache.get(key);

    if (existing) {
      return existing;
    }

    const loading = this.loadShard(key);
    this.cache.set(key, loading);
    return loading;
  }
}
