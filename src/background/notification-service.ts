import type { WeeklyDigest } from '../shared/models';
import { putDigest } from '../storage/digest-repository';

export async function notifyDigest(digest: WeeklyDigest): Promise<void> {
  if (digest.sentenceCount === 0 || digest.notificationShownAt) {
    return;
  }

  await browser.notifications.create(`digest:${digest.id}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon-128.png'),
    title: '本周语境生词已整理',
    message: `收藏 ${digest.sentenceCount} 个句子，遇到 ${digest.wordCount} 个生词。`,
  });

  await putDigest({ ...digest, notificationShownAt: Date.now() });
}
