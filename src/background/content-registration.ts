import {
  CONTENT_SCRIPT_ID,
  OPTIONAL_ORIGINS,
} from '../shared/constants';

interface ContentScriptRegistration {
  id: string;
  js: string[];
  matches: string[];
  allFrames: boolean;
  runAt: 'document_idle';
  persistAcrossSessions: boolean;
}

export interface ContentRegistrationDependencies {
  hasPermission(): Promise<boolean>;
  getRegistrations(): Promise<Array<{ id: string }>>;
  register(registration: ContentScriptRegistration): Promise<void>;
  unregister(ids: string[]): Promise<void>;
}

export async function hasHostPermission(): Promise<boolean> {
  return browser.permissions.contains({ origins: OPTIONAL_ORIGINS });
}

export function registrationAction(
  permitted: boolean,
  registered: boolean,
): 'register' | 'unregister' | 'none' {
  if (permitted && !registered) {
    return 'register';
  }
  if (!permitted && registered) {
    return 'unregister';
  }
  return 'none';
}

function browserDependencies(): ContentRegistrationDependencies {
  return {
    hasPermission: hasHostPermission,
    getRegistrations: () => (
      browser.scripting.getRegisteredContentScripts()
    ),
    register: async (registration) => {
      await browser.scripting.registerContentScripts([registration]);
    },
    unregister: async (ids) => {
      await browser.scripting.unregisterContentScripts({ ids });
    },
  };
}

export async function ensureContentRegistration(
  dependencies: ContentRegistrationDependencies = browserDependencies(),
): Promise<void> {
  const [permitted, registrations] = await Promise.all([
    dependencies.hasPermission(),
    dependencies.getRegistrations(),
  ]);
  const registered = registrations.some(
    (registration) => registration.id === CONTENT_SCRIPT_ID,
  );
  const action = registrationAction(permitted, registered);

  if (action === 'register') {
    await dependencies.register({
      id: CONTENT_SCRIPT_ID,
      js: ['hover.js'],
      matches: OPTIONAL_ORIGINS,
      allFrames: true,
      runAt: 'document_idle',
      persistAcrossSessions: true,
    });
  } else if (action === 'unregister') {
    await dependencies.unregister([CONTENT_SCRIPT_ID]);
  }
}
