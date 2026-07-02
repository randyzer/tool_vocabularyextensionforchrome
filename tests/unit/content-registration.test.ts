import { describe, expect, it, vi } from 'vitest';
import {
  ensureContentRegistration,
  registrationAction,
  type ContentRegistrationDependencies,
} from '../../src/background/content-registration';
import {
  CONTENT_SCRIPT_ID,
  OPTIONAL_ORIGINS,
} from '../../src/shared/constants';

type TestDependencies = ContentRegistrationDependencies & {
  getMatchingTabs: ReturnType<typeof vi.fn>;
  inject: ReturnType<typeof vi.fn>;
};

function createDependencies(
  permitted: boolean,
  registered: boolean,
  tabs: Array<{ id?: number }> = [],
): TestDependencies {
  return {
    hasPermission: vi.fn().mockResolvedValue(permitted),
    getRegistrations: vi.fn().mockResolvedValue(
      registered ? [{ id: CONTENT_SCRIPT_ID }] : [],
    ),
    register: vi.fn(),
    unregister: vi.fn(),
    getMatchingTabs: vi.fn().mockResolvedValue(tabs),
    inject: vi.fn(),
  } as TestDependencies;
}

describe('content registration', () => {
  it('chooses register after grant and unregister after revoke', () => {
    expect(registrationAction(true, false)).toBe('register');
    expect(registrationAction(false, true)).toBe('unregister');
    expect(registrationAction(true, true)).toBe('none');
    expect(registrationAction(false, false)).toBe('none');
  });

  it('registers the unlisted hover script after permission is granted', async () => {
    const dependencies = createDependencies(true, false);

    await ensureContentRegistration(dependencies, OPTIONAL_ORIGINS);

    expect(dependencies.register).toHaveBeenCalledWith({
      id: CONTENT_SCRIPT_ID,
      js: ['hover.js'],
      matches: OPTIONAL_ORIGINS,
      allFrames: true,
      runAt: 'document_idle',
      persistAcrossSessions: true,
    });
    expect(dependencies.unregister).not.toHaveBeenCalled();
  });

  it('unregisters the hover script after permission is revoked', async () => {
    const dependencies = createDependencies(false, true);

    await ensureContentRegistration(dependencies, OPTIONAL_ORIGINS);

    expect(dependencies.unregister).toHaveBeenCalledWith([
      CONTENT_SCRIPT_ID,
    ]);
    expect(dependencies.register).not.toHaveBeenCalled();
  });

  it('injects the hover script into matching tabs that are already open', async () => {
    const dependencies = createDependencies(true, true, [
      { id: 42 },
      {},
    ]);

    await ensureContentRegistration(dependencies, OPTIONAL_ORIGINS);

    expect(dependencies.getMatchingTabs).toHaveBeenCalledOnce();
    expect(dependencies.inject).toHaveBeenCalledOnce();
    expect(dependencies.inject).toHaveBeenCalledWith(42);
  });
});
