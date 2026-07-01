import { PENDING_DIGEST_KEY } from '../shared/constants';

export async function openDigestPanel(digestId: string): Promise<void> {
  await browser.storage.session.set({ [PENDING_DIGEST_KEY]: digestId });

  const windows = await browser.windows.getAll({ windowTypes: ['normal'] });
  const active = windows.find((window) => window.focused) ?? windows[0];

  if (!active?.id) {
    throw new Error('NO_BROWSER_WINDOW');
  }

  await browser.sidePanel.open({ windowId: active.id });
}
