import { ensureWeeklyAlarm } from '../src/background/alarm-service';
import {
  digestService,
} from '../src/background/digest-service';
import {
  notifyDigest,
} from '../src/background/notification-service';
import {
  openDigestPanel,
} from '../src/background/panel-navigation';
import {
  ensureContentRegistration,
} from '../src/background/content-registration';
import { handleMessage } from '../src/background/message-handler';
import { WEEKLY_ALARM_NAME } from '../src/shared/constants';

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
    void ensureWeeklyAlarm().catch((error: unknown) => {
      console.error('Failed to synchronize weekly alarm', error);
    });
    void browser.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true,
    }).catch((error: unknown) => {
      console.error('Failed to configure side panel behavior', error);
    });
  });
  browser.runtime.onStartup.addListener(() => {
    syncContentRegistration();
    void ensureWeeklyAlarm().catch((error: unknown) => {
      console.error('Failed to synchronize weekly alarm', error);
    });
    void digestService.generate()
      .then((digest) => notifyDigest(digest))
      .catch((error: unknown) => {
        console.error('Failed to recover weekly digest on startup', error);
      });
  });
  browser.permissions.onAdded.addListener(syncContentRegistration);
  browser.permissions.onRemoved.addListener(syncContentRegistration);
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== WEEKLY_ALARM_NAME) {
      return;
    }

    void digestService.generate()
      .then((digest) => notifyDigest(digest))
      .catch((error: unknown) => {
        console.error('Failed to deliver weekly digest', error);
      });
  });
  browser.notifications.onClicked.addListener((notificationId) => {
    if (!notificationId.startsWith('digest:')) {
      return;
    }

    void openDigestPanel(notificationId.slice('digest:'.length)).catch(
      (error: unknown) => {
        console.error('Failed to open digest panel', error);
      },
    );
  });
  syncContentRegistration();
  void ensureWeeklyAlarm().catch((error: unknown) => {
    console.error('Failed to synchronize weekly alarm', error);
  });
});
