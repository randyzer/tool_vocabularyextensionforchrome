import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Capture, WeeklyDigest } from '../shared/models';

interface ContextualVocabularyDb extends DBSchema {
  captures: {
    key: string;
    value: Capture;
    indexes: {
      dedupeKey: string;
      createdAt: number;
      lemma: string;
      mastered: number;
    };
  };
  digests: {
    key: string;
    value: WeeklyDigest;
    indexes: {
      periodKey: [number, number];
      generatedAt: number;
    };
  };
}

const DATABASE_NAME = 'contextual-vocabulary';
const DATABASE_VERSION = 1;

let databasePromise: Promise<IDBPDatabase<ContextualVocabularyDb>> | undefined;

export function getDatabase(): Promise<IDBPDatabase<ContextualVocabularyDb>> {
  databasePromise ??= openDB<ContextualVocabularyDb>(
    DATABASE_NAME,
    DATABASE_VERSION,
    {
      upgrade(database) {
        const captures = database.createObjectStore('captures', {
          keyPath: 'id',
        });
        captures.createIndex('dedupeKey', 'dedupeKey', { unique: true });
        captures.createIndex('createdAt', 'createdAt');
        captures.createIndex('lemma', 'lemma');
        captures.createIndex('mastered', 'masteredKey');

        const digests = database.createObjectStore('digests', {
          keyPath: 'id',
        });
        digests.createIndex(
          'periodKey',
          ['periodStart', 'periodEnd'],
          { unique: true },
        );
        digests.createIndex('generatedAt', 'generatedAt');
      },
    },
  );

  return databasePromise;
}

export async function clearDatabaseForTest(): Promise<void> {
  if (databasePromise) {
    (await databasePromise).close();
    databasePromise = undefined;
  }

  await deleteDB(DATABASE_NAME);
}
