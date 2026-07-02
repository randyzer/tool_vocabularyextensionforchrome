import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  SaveCaptureResult,
  Settings,
} from '../../src/shared/models';
import type { SentenceTarget } from '../../src/content/text-segmentation';

const { targetAtPoint } = vi.hoisted(() => ({
  targetAtPoint: vi.fn(),
}));

vi.mock('../../src/content/target-at-point', () => ({
  targetAtPoint,
}));

import { startContentRuntime } from '../../src/content';

const target: SentenceTarget = {
  word: 'ultimately',
  sentence: 'The proposal was ultimately rejected.',
  wordStart: 17,
  wordEnd: 27,
};

const settings: Settings = {
  enabled: true,
  autoSpeak: false,
  speechRate: 1,
  saveSource: true,
  notificationHour: 9,
  notificationMinute: 0,
  disabledOrigins: [],
  hostPermissionOnboardingComplete: true,
  schemaVersion: 1,
};

const saved: SaveCaptureResult = {
  capture: {
    id: 'capture-1',
    surfaceWord: target.word,
    normalizedWord: target.word,
    lemma: target.word,
    definitionsZh: ['最终'],
    sentence: target.sentence,
    wordStart: target.wordStart,
    wordEnd: target.wordEnd,
    sourceTitle: '',
    sourceUrl: 'http://localhost/',
    sourceOrigin: 'http://localhost',
    createdAt: 1,
    lastSeenAt: 1,
    encounterCount: 1,
    mastered: false,
    masteredKey: 0,
    lookupStatus: 'found',
    dedupeKey: 'capture-1',
  },
  savedAt: 1,
};

function dispatchPointerMove(): void {
  document.dispatchEvent(new PointerEvent('pointermove', {
    clientX: 20,
    clientY: 20,
  }));
}

function tooltipText(): string {
  const host = document.documentElement.querySelector<HTMLElement>(
    '[data-context-vocabulary-ui]',
  );
  return host?.shadowRoot?.textContent ?? '';
}

function undoButton(): HTMLButtonElement | null {
  const host = document.documentElement.querySelector<HTMLElement>(
    '[data-context-vocabulary-ui]',
  );
  return host?.shadowRoot?.querySelector('button') ?? null;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  document.documentElement
    .querySelectorAll('[data-context-vocabulary-ui]')
    .forEach((node) => node.remove());
});

describe('content runtime capture actions', () => {
  it('reports a rejected save without leaking it and allows retrying', async () => {
    vi.useFakeTimers();
    targetAtPoint.mockReturnValue(target);
    let saveAttempts = 0;
    const sendMessage = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case 'GET_SETTINGS':
          return { ok: true, data: settings };
        case 'LOOKUP_WORD':
          return {
            ok: true,
            data: {
              lookupStatus: 'found',
              entry: {
                lemma: target.word,
                definitionsZh: ['最终'],
              },
            },
          };
        case 'SAVE_CAPTURE':
          saveAttempts += 1;
          if (saveAttempts === 1) {
            throw new Error('transport failed');
          }
          return { ok: true, data: saved };
        default:
          throw new Error(`Unexpected message: ${message.type}`);
      }
    });
    vi.stubGlobal('browser', { runtime: { sendMessage } });
    const unhandled: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent): void => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onUnhandled);
    const stop = await startContentRuntime();

    dispatchPointerMove();
    await vi.advanceTimersByTimeAsync(2_500);
    expect(tooltipText()).toContain('保存失败，可重试');
    expect(unhandled).toEqual([]);

    targetAtPoint.mockReturnValueOnce(null);
    dispatchPointerMove();
    dispatchPointerMove();
    await vi.advanceTimersByTimeAsync(2_500);
    expect(saveAttempts).toBe(2);
    expect(undoButton()).not.toBeNull();

    stop();
    window.removeEventListener('unhandledrejection', onUnhandled);
  });

  it('reports a rejected undo and keeps the target guarded', async () => {
    vi.useFakeTimers();
    targetAtPoint.mockReturnValue(target);
    let saveAttempts = 0;
    const sendMessage = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case 'GET_SETTINGS':
          return { ok: true, data: settings };
        case 'LOOKUP_WORD':
          return {
            ok: true,
            data: {
              lookupStatus: 'found',
              entry: {
                lemma: target.word,
                definitionsZh: ['最终'],
              },
            },
          };
        case 'SAVE_CAPTURE':
          saveAttempts += 1;
          return { ok: true, data: saved };
        case 'UNDO_CAPTURE':
          throw new Error('transport failed');
        default:
          throw new Error(`Unexpected message: ${message.type}`);
      }
    });
    vi.stubGlobal('browser', { runtime: { sendMessage } });
    const stop = await startContentRuntime();

    dispatchPointerMove();
    await vi.advanceTimersByTimeAsync(2_500);
    undoButton()?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(tooltipText()).toContain('撤销失败');

    targetAtPoint.mockReturnValueOnce(null);
    dispatchPointerMove();
    dispatchPointerMove();
    await vi.advanceTimersByTimeAsync(2_500);
    expect(saveAttempts).toBe(1);

    stop();
  });
});
