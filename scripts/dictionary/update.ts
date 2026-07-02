import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { buildDictionary } from './build';
import { readCommittedDictionary } from './files';
import {
  compareDictionaryIndexes,
  renderDictionaryReport,
  type DictionarySourceMetadata,
  type DictionaryUpdateReport,
} from './pipeline';

const COMMIT_API = (
  'https://api.github.com/repos/skywind3000/ECDICT/commits/master'
);
const ECDICT_REPOSITORY = 'https://github.com/skywind3000/ECDICT.git';
const projectRoot = resolve(import.meta.dirname, '../..');
const sourceDirectory = resolve(projectRoot, 'data/source');
const outputDirectory = resolve(projectRoot, 'public/dictionary');
const requestHeaders = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'contextual-vocabulary-dictionary-updater/0.1.0',
};
const execFileAsync = promisify(execFile);

export interface ResolvedEcdictSource {
  commit: string;
  committedAt: string;
  url: string;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function parseGithubCommitResponse(
  value: unknown,
): ResolvedEcdictSource {
  const response = value as {
    sha?: unknown;
    commit?: { committer?: { date?: unknown } };
  };
  const commit = response.sha;
  const committedAt = response.commit?.committer?.date;

  if (
    typeof commit !== 'string'
    || !/^[a-f0-9]{7,64}$/i.test(commit)
    || typeof committedAt !== 'string'
    || Number.isNaN(Date.parse(committedAt))
  ) {
    throw new Error('ECDICT_INVALID_COMMIT_RESPONSE');
  }

  return {
    commit,
    committedAt,
    url: (
      `https://raw.githubusercontent.com/skywind3000/ECDICT/${commit}/ecdict.csv`
    ),
  };
}

export async function resolveLatestEcdictCommitFromGit(): Promise<
  ResolvedEcdictSource
> {
  const temporaryDirectory = await mkdtemp(
    resolve(tmpdir(), 'ecdict-git-'),
  );

  try {
    await execFileAsync('git', ['init', '--quiet'], {
      cwd: temporaryDirectory,
    });
    await execFileAsync('git', [
      'fetch',
      '--quiet',
      '--depth=1',
      '--filter=blob:none',
      ECDICT_REPOSITORY,
      'refs/heads/master',
    ], {
      cwd: temporaryDirectory,
      maxBuffer: 1024 * 1024,
    });
    const result = await execFileAsync(
      'git',
      ['show', '-s', '--format=%H%n%cI', 'FETCH_HEAD'],
      {
        cwd: temporaryDirectory,
        maxBuffer: 1024 * 1024,
      },
    );
    const [commit, committedAt] = String(result.stdout).trim().split(/\r?\n/);
    return parseGithubCommitResponse({
      sha: commit,
      commit: { committer: { date: committedAt } },
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function resolveLatestEcdictCommit(
  fetcher: typeof fetch = fetch,
  token: string | undefined = (
    process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  ),
  fallbackResolver: () => Promise<ResolvedEcdictSource> = (
    resolveLatestEcdictCommitFromGit
  ),
): Promise<ResolvedEcdictSource> {
  const response = await fetcher(COMMIT_API, {
    headers: {
      ...requestHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    if (
      !token
      && response.status === 403
      && response.headers.get('x-ratelimit-remaining') === '0'
    ) {
      return fallbackResolver();
    }
    throw new Error(`ECDICT_COMMIT_LOOKUP_FAILED:${response.status}`);
  }
  return parseGithubCommitResponse(await response.json());
}

export async function downloadEcdictSource(
  source: ResolvedEcdictSource,
  fetcher: typeof fetch = fetch,
): Promise<{ csv: string; metadata: DictionarySourceMetadata }> {
  const response = await fetcher(source.url, {
    headers: requestHeaders,
  });
  if (!response.ok) {
    throw new Error(`ECDICT_DOWNLOAD_FAILED:${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error('ECDICT_DOWNLOAD_EMPTY');
  }

  return {
    csv: bytes.toString('utf8'),
    metadata: {
      source: 'ECDICT',
      commit: source.commit,
      committedAt: source.committedAt,
      url: source.url,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  };
}

async function publishDownloadedSource(
  csv: string,
  metadata: DictionarySourceMetadata,
): Promise<void> {
  const parent = dirname(sourceDirectory);
  const temporaryDirectory = resolve(
    parent,
    `.source-tmp-${process.pid}-${randomUUID()}`,
  );
  const backupDirectory = resolve(
    parent,
    `.source-backup-${process.pid}-${randomUUID()}`,
  );
  let hasBackup = false;

  await mkdir(temporaryDirectory, { recursive: true });
  try {
    await Promise.all([
      writeFile(resolve(temporaryDirectory, 'ecdict.csv'), csv),
      writeFile(
        resolve(temporaryDirectory, 'ecdict-source.json'),
        `${JSON.stringify(metadata, null, 2)}\n`,
      ),
    ]);

    if (await pathExists(sourceDirectory)) {
      await rename(sourceDirectory, backupDirectory);
      hasBackup = true;
    }

    try {
      await rename(temporaryDirectory, sourceDirectory);
    } catch (error) {
      if (hasBackup) {
        await rename(backupDirectory, sourceDirectory);
        hasBackup = false;
      }
      throw error;
    }

    if (hasBackup) {
      await rm(backupDirectory, { recursive: true, force: true });
      hasBackup = false;
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
    if (hasBackup && !await pathExists(sourceDirectory)) {
      await rename(backupDirectory, sourceDirectory);
    }
  }
}

export async function updateDictionary(): Promise<void> {
  const previous = await readCommittedDictionary(outputDirectory);
  const resolved = await resolveLatestEcdictCommit();
  const downloaded = await downloadEcdictSource(resolved);
  await publishDownloadedSource(downloaded.csv, downloaded.metadata);
  await buildDictionary();
  const next = await readCommittedDictionary(outputDirectory);
  const comparison = compareDictionaryIndexes(
    previous.serializedEntries,
    next.serializedEntries,
  );
  const report: DictionaryUpdateReport = {
    sourceMetadata: downloaded.metadata,
    previousEntryCount: previous.entryCount,
    nextEntryCount: next.entryCount,
    ...comparison,
  };
  const markdown = renderDictionaryReport(report);

  await Promise.all([
    writeFile(
      resolve(sourceDirectory, 'dictionary-update-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    ),
    writeFile(
      resolve(sourceDirectory, 'dictionary-update-report.md'),
      markdown,
    ),
  ]);
  console.log(markdown);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;

if (import.meta.url === invokedPath) {
  await updateDictionary();
}
