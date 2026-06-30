import {
  ensureContentRegistration,
} from '../src/background/content-registration';
import { handleMessage } from '../src/background/message-handler';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message) => handleMessage(message),
  );

  const syncContentRegistration = (): void => {
    void ensureContentRegistration().catch((error: unknown) => {
      console.error('Failed to synchronize content registration', error);
    });
  };

  browser.runtime.onInstalled.addListener(() => {
    syncContentRegistration();
    void browser.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true,
    }).catch((error: unknown) => {
      console.error('Failed to configure side panel behavior', error);
    });
  });
  browser.runtime.onStartup.addListener(syncContentRegistration);
  browser.permissions.onAdded.addListener(syncContentRegistration);
  browser.permissions.onRemoved.addListener(syncContentRegistration);
  syncContentRegistration();
});
