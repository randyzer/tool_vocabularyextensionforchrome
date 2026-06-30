import { send } from '../../src/sidepanel/api';
import { OPTIONAL_ORIGINS } from '../../src/shared/constants';
import type { Settings } from '../../src/shared/models';

const rootCandidate = document.querySelector<HTMLElement>('#app');

if (!rootCandidate) {
  throw new Error('Missing #app root');
}

const root: HTMLElement = rootCandidate;

function appendTextElement(
  tagName: 'h1' | 'p',
  text: string,
): HTMLElement {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
}

async function render(): Promise<void> {
  const [settings, permitted] = await Promise.all([
    send<Settings>({ type: 'GET_SETTINGS' }),
    browser.permissions.contains({ origins: OPTIONAL_ORIGINS }),
  ]);
  root.replaceChildren();

  const heading = appendTextElement('h1', '语境生词本');
  const description = appendTextElement(
    'p',
    '插件只在本机处理你稳定悬停的单词和原句。',
  );
  const status = appendTextElement(
    'p',
    permitted
      ? '网页取词已启用。'
      : settings.hostPermissionOnboardingComplete
        ? '网页权限当前未启用，可重新授权。'
        : '开始前，需要允许插件读取你打开的英语网页。',
  );
  status.className = permitted ? 'status status--ok' : 'status';
  root.append(heading, description, status);

  if (permitted) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '允许在英语网页上取词';
  button.addEventListener('click', async () => {
    button.disabled = true;

    try {
      const granted = await browser.permissions.request({
        origins: OPTIONAL_ORIGINS,
      });
      await send<Settings>({
        type: 'SAVE_SETTINGS',
        patch: { hostPermissionOnboardingComplete: granted },
      });

      if (granted) {
        await send({ type: 'SYNC_CONTENT_REGISTRATION' });
        await render();
      } else {
        status.textContent = '未获得网页权限，你可以稍后再次尝试。';
        button.disabled = false;
      }
    } catch (error) {
      status.textContent = error instanceof Error
        ? `启用失败：${error.message}`
        : '启用失败，请重试。';
      button.disabled = false;
    }
  });
  root.append(button);
}

void render().catch((error: unknown) => {
  root.textContent = error instanceof Error
    ? `初始化失败：${error.message}`
    : '初始化失败，请重新打开侧边栏。';
});
