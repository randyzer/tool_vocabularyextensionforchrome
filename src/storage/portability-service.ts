import { z } from 'zod';
import type { ExportPayload, Settings } from '../shared/models';
import { getDatabase } from './database';
import { getSettings, saveSettings } from './settings-repository';

const captureSchema = z.object({
  id: z.string().uuid(),
  surfaceWord: z.string().min(1).max(80),
  normalizedWord: z.string().min(1).max(80),
  lemma: z.string().min(1).max(80),
  phonetic: z.string().max(200).optional(),
  partOfSpeech: z.array(z.string().max(30)).optional(),
  definitionsZh: z.array(z.string().max(500)).max(10),
  sentence: z.string().min(1).max(2_000),
  wordStart: z.number().int().nonnegative(),
  wordEnd: z.number().int().positive(),
  sourceTitle: z.string().max(500),
  sourceUrl: z.string().url().max(4_096),
  sourceOrigin: z.string().max(500),
  createdAt: z.number(),
  lastSeenAt: z.number(),
  encounterCount: z.number().int().positive(),
  mastered: z.boolean(),
  masteredKey: z.union([z.literal(0), z.literal(1)]),
  lookupStatus: z.enum(['found', 'not_found']),
  dedupeKey: z.string().max(3_000),
});

const digestSchema = z.object({
  id: z.string().uuid(),
  periodStart: z.number(),
  periodEnd: z.number(),
  generatedAt: z.number(),
  captureIds: z.array(z.string().uuid()).max(50_000),
  wordCount: z.number().int().nonnegative(),
  sentenceCount: z.number().int().nonnegative(),
  notificationShownAt: z.number().optional(),
});

const settingsSchema: z.ZodType<Settings> = z.object({
  enabled: z.boolean(),
  autoSpeak: z.boolean(),
  speechRate: z.number(),
  saveSource: z.boolean(),
  notificationHour: z.number(),
  notificationMinute: z.number(),
  disabledOrigins: z.array(z.string()),
  hostPermissionOnboardingComplete: z.boolean(),
  schemaVersion: z.number(),
});

const exportPayloadSchema: z.ZodType<ExportPayload> = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  captures: z.array(captureSchema).max(50_000),
  digests: z.array(digestSchema).max(1_000),
  settings: settingsSchema,
});

export function validateImport(value: unknown): ExportPayload {
  if (
    typeof value !== 'object'
    || value === null
    || !('version' in value)
    || value.version !== 1
  ) {
    throw new Error('UNSUPPORTED_EXPORT_VERSION');
  }

  if (
    'captures' in value
    && Array.isArray(value.captures)
    && value.captures.length > 50_000
  ) {
    throw new Error('IMPORT_TOO_LARGE');
  }

  return exportPayloadSchema.parse(value);
}

export async function exportData(): Promise<ExportPayload> {
  const db = await getDatabase();

  return {
    version: 1,
    exportedAt: Date.now(),
    captures: await db.getAll('captures'),
    digests: await db.getAll('digests'),
    settings: await getSettings(),
  };
}

export async function importData(raw: unknown): Promise<void> {
  const payload = validateImport(raw);
  const db = await getDatabase();
  const tx = db.transaction(['captures', 'digests'], 'readwrite');

  await tx.objectStore('captures').clear();
  await tx.objectStore('digests').clear();

  for (const capture of payload.captures) {
    await tx.objectStore('captures').put(capture);
  }

  for (const digest of payload.digests) {
    await tx.objectStore('digests').put(digest);
  }

  await tx.done;
  await saveSettings(payload.settings);
}

export async function clearAllData(): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(['captures', 'digests'], 'readwrite');

  await tx.objectStore('captures').clear();
  await tx.objectStore('digests').clear();
  await tx.done;

  await browser.storage.local.clear();
  await browser.storage.session.clear();
}
