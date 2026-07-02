import type { Page } from '@playwright/test';
import type { Capture } from '../../src/shared/models';
import { expect, test } from './fixtures';

type CaptureListResponse =
  | { ok: true; data: Capture[] }
  | { ok: false; error: string };

async function listCaptures(page: Page): Promise<Capture[]> {
  const response = await page.evaluate(async () => {
    const chromeApi = (globalThis as typeof globalThis & {
      chrome: {
        runtime: {
          sendMessage(message: unknown): Promise<unknown>;
        };
      };
    }).chrome;

    return chromeApi.runtime.sendMessage({
      type: 'LIST_CAPTURES',
      filter: {},
    });
  }) as CaptureListResponse;

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.data;
}

test('hovering a word saves a highlighted source sentence', async ({
  context,
  extensionId,
}) => {
  const worker = context.serviceWorkers()[0]
    ?? await context.waitForEvent('serviceworker');
  const extensionPage = await context.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await worker.evaluate(async () => {
    const chromeApi = (globalThis as typeof globalThis & {
      chrome: {
        scripting: {
          registerContentScripts(scripts: unknown[]): Promise<void>;
        };
      };
    }).chrome;
    await chromeApi.scripting.registerContentScripts([{
      id: 'e2e-hover',
      js: ['hover.js'],
      matches: ['http://127.0.0.1/*'],
      runAt: 'document_idle',
    }]);
  });
  await extensionPage.evaluate(async () => {
    const chromeApi = (globalThis as typeof globalThis & {
      chrome: {
        runtime: {
          sendMessage(message: unknown): Promise<unknown>;
        };
      };
    }).chrome;
    await chromeApi.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      patch: {
        hostPermissionOnboardingComplete: true,
        autoSpeak: false,
      },
    });
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/article.html');
  await page.locator('#target-word').hover();
  await expect.poll(
    async () => (await listCaptures(extensionPage)).length,
    { timeout: 5_000 },
  ).toBe(1);

  await page.mouse.move(1, 1);
  await page.locator('#target-word').hover();
  await page.waitForTimeout(700);
  await expect(
    page.locator('[data-context-vocabulary-ui]'),
  ).toHaveAttribute('data-state', 'visible');
  await page.waitForTimeout(2_500);

  let captures = await listCaptures(extensionPage);
  expect(captures).toHaveLength(1);
  expect(captures[0]?.encounterCount).toBe(1);

  await page.reload();
  await page.locator('#target-word').hover();
  await expect.poll(
    async () => (await listCaptures(extensionPage))[0]?.encounterCount,
    { timeout: 5_000 },
  ).toBe(2);

  captures = await listCaptures(extensionPage);
  expect(captures).toHaveLength(1);

  await extensionPage.reload();
  await expect(extensionPage.locator('mark')).toHaveText('ultimately');
});
