import { describe, expect, it, vi } from 'vitest';
import { send } from '../../src/sidepanel/api';

describe('side-panel message client', () => {
  it('returns typed response data', async () => {
    const transport = vi.fn().mockResolvedValue({
      ok: true,
      data: { enabled: true },
    });

    await expect(send<{ enabled: boolean }>(
      { type: 'GET_SETTINGS' },
      transport,
    )).resolves.toEqual({ enabled: true });
  });

  it('throws an explicit background error', async () => {
    const transport = vi.fn().mockResolvedValue({
      ok: false,
      error: 'PERMISSION_DENIED',
    });

    await expect(send(
      { type: 'SYNC_CONTENT_REGISTRATION' },
      transport,
    )).rejects.toThrow('PERMISSION_DENIED');
  });
});
