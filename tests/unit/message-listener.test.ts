import { describe, expect, it, vi } from 'vitest';
import { createMessageListener } from '../../src/background/message-listener';

describe('Chrome message listener compatibility', () => {
  it('keeps the channel open and sends the asynchronous response', async () => {
    const response = {
      ok: true as const,
      data: { enabled: true },
    };
    const handler = vi.fn().mockResolvedValue(response);
    const sendResponse = vi.fn();
    const listener = createMessageListener(handler);

    expect(listener({ type: 'GET_SETTINGS' }, {}, sendResponse)).toBe(true);
    expect(sendResponse).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith(response);
    });
  });

  it('turns an unexpected handler rejection into an error response', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('BACKGROUND_CRASH'));
    const sendResponse = vi.fn();
    const listener = createMessageListener(handler);

    expect(listener({ type: 'GET_SETTINGS' }, {}, sendResponse)).toBe(true);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: 'BACKGROUND_CRASH',
      });
    });
  });
});
