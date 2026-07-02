import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  downloadEcdictSource,
  parseGithubCommitResponse,
  resolveLatestEcdictCommit,
} from '../../scripts/dictionary/update';

const commit = '0123456789abcdef';
const committedAt = '2026-07-01T00:00:00Z';
const rawUrl = (
  `https://raw.githubusercontent.com/skywind3000/ECDICT/${commit}/ecdict.csv`
);

describe('dictionary update downloads', () => {
  it('parses a GitHub commit into a pinned source URL', () => {
    expect(parseGithubCommitResponse({
      sha: commit,
      commit: { committer: { date: committedAt } },
    })).toEqual({
      commit,
      committedAt,
      url: rawUrl,
    });
  });

  it('resolves the commit before downloading its pinned CSV', async () => {
    const csv = 'word,translation\nability,能力\n';
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sha: commit,
        commit: { committer: { date: committedAt } },
      })))
      .mockResolvedValueOnce(new Response(csv));

    const source = await resolveLatestEcdictCommit(
      fetcher as unknown as typeof fetch,
    );
    const downloaded = await downloadEcdictSource(
      source,
      fetcher as unknown as typeof fetch,
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://api.github.com/repos/skywind3000/ECDICT/commits/master',
    );
    expect(fetcher.mock.calls[1]?.[0]).toBe(rawUrl);
    expect(downloaded.csv).toBe(csv);
    expect(downloaded.metadata.sha256).toBe(
      createHash('sha256').update(csv).digest('hex'),
    );
  });

  it('uses an available GitHub token for commit lookup', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      sha: commit,
      commit: { committer: { date: committedAt } },
    })));

    await resolveLatestEcdictCommit(
      fetcher as unknown as typeof fetch,
      'test-token',
    );

    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: 'Bearer test-token',
      },
    });
  });

  it('falls back to Git only when the anonymous API quota is exhausted', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('rate limited', {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0' },
    }));
    const fallback = vi.fn().mockResolvedValue({
      commit,
      committedAt,
      url: rawUrl,
    });

    await expect(resolveLatestEcdictCommit(
      fetcher as unknown as typeof fetch,
      undefined,
      fallback,
    )).resolves.toEqual({
      commit,
      committedAt,
      url: rawUrl,
    });
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('does not hide non-rate-limit commit lookup failures', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('forbidden', {
      status: 403,
      headers: { 'x-ratelimit-remaining': '59' },
    }));
    const fallback = vi.fn();

    await expect(resolveLatestEcdictCommit(
      fetcher as unknown as typeof fetch,
      undefined,
      fallback,
    )).rejects.toThrow('ECDICT_COMMIT_LOOKUP_FAILED:403');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('reports non-successful CSV downloads', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('unavailable', { status: 503 }),
    );

    await expect(downloadEcdictSource({
      commit,
      committedAt,
      url: rawUrl,
    }, fetcher as unknown as typeof fetch))
      .rejects.toThrow('ECDICT_DOWNLOAD_FAILED:503');
  });
});
