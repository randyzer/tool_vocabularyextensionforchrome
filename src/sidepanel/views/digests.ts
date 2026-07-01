import { PENDING_DIGEST_KEY } from '../../shared/constants';
import type { Capture, WeeklyDigest } from '../../shared/models';
import { send } from '../api';
import { createCaptureCard } from '../components/capture-card';

export async function renderDigests(
  container: HTMLElement,
  refresh: () => void,
): Promise<void> {
  const stored = await browser.storage.session.get(PENDING_DIGEST_KEY);
  const digests = await send<WeeklyDigest[]>({ type: 'LIST_DIGESTS' });
  const selectedId = (stored[PENDING_DIGEST_KEY] as string | undefined)
    ?? digests[0]?.id;

  container.replaceChildren();

  for (const digest of digests) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'digest-tab';
    button.textContent = new Date(digest.periodStart).toLocaleDateString();
    button.toggleAttribute('aria-current', digest.id === selectedId);
    button.addEventListener('click', async () => {
      await browser.storage.session.set({ [PENDING_DIGEST_KEY]: digest.id });
      refresh();
    });
    container.append(button);
  }

  const selected = digests.find((digest) => digest.id === selectedId);

  if (!selected) {
    container.append(document.createTextNode('还没有周报。'));
    return;
  }

  const captures = await send<Capture[]>({
    type: 'LIST_CAPTURES',
    filter: {
      from: selected.periodStart,
      to: selected.periodEnd,
    },
  });

  for (const capture of captures) {
    container.append(createCaptureCard(capture, refresh));
  }
}
