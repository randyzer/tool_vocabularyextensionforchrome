import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  startRuntimeOnce,
  type RuntimeLifecycleState,
} from '../../src/content/runtime-lifecycle';

describe('content runtime lifecycle', () => {
  it('starts once until pagehide and then permits a fresh runtime', async () => {
    const state: RuntimeLifecycleState = {};
    const stop = vi.fn();
    const start = vi.fn().mockResolvedValue(stop);
    let onPageHide: (() => void) | undefined;
    const registerPageHide = vi.fn((listener: () => void) => {
      onPageHide = listener;
    });

    await Promise.all([
      startRuntimeOnce(state, start, registerPageHide),
      startRuntimeOnce(state, start, registerPageHide),
    ]);

    expect(start).toHaveBeenCalledOnce();
    expect(registerPageHide).toHaveBeenCalledOnce();

    onPageHide?.();
    expect(stop).toHaveBeenCalledOnce();

    await startRuntimeOnce(state, start, registerPageHide);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('allows retry when runtime startup fails', async () => {
    const state: RuntimeLifecycleState = {};
    const start = vi.fn()
      .mockRejectedValueOnce(new Error('START_FAILED'))
      .mockResolvedValueOnce(vi.fn());
    const registerPageHide = vi.fn();

    await expect(startRuntimeOnce(
      state,
      start,
      registerPageHide,
    )).rejects.toThrow('START_FAILED');
    await expect(startRuntimeOnce(
      state,
      start,
      registerPageHide,
    )).resolves.toBeUndefined();

    expect(start).toHaveBeenCalledTimes(2);
  });
});
