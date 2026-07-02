import {
  CONTENT_SCRIPT_ID,
  OPTIONAL_ORIGINS,
} from '../shared/constants';

const contentScriptOrigins = import.meta.env.MODE === 'test'
  ? ['http://127.0.0.1/*']
  : OPTIONAL_ORIGINS;

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
  getMatchingTabs(): Promise<Array<{ id?: number }>>;
  inject(tabId: number): Promise<void>;
}

export async function hasHostPermission(
  origins: string[] = contentScriptOrigins,
): Promise<boolean> {
  return browser.permissions.contains({ origins });
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

function browserDependencies(
  origins: string[],
): ContentRegistrationDependencies {
  return {
    hasPermission: () => hasHostPermission(origins),
    getRegistrations: () => (
      browser.scripting.getRegisteredContentScripts()
    ),
    register: async (registration) => {
      await browser.scripting.registerContentScripts([registration]);
    },
    unregister: async (ids) => {
      await browser.scripting.unregisterContentScripts({ ids });
    },
    getMatchingTabs: () => browser.tabs.query({ url: origins }),
    inject: async (tabId) => {
      await browser.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ['/hover.js'],
      });
    },
  };
}

export async function ensureContentRegistration(
  dependencies: ContentRegistrationDependencies = browserDependencies(
    contentScriptOrigins,
  ),
  origins: string[] = contentScriptOrigins,
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
      matches: origins,
      allFrames: true,
      runAt: 'document_idle',
      persistAcrossSessions: true,
    });
  } else if (action === 'unregister') {
    await dependencies.unregister([CONTENT_SCRIPT_ID]);
  }

  if (!permitted) {
    return;
  }

  const tabs = await dependencies.getMatchingTabs();
  await Promise.allSettled(
    tabs.flatMap((tab) => (
      tab.id === undefined ? [] : [dependencies.inject(tab.id)]
    )),
  );
}
