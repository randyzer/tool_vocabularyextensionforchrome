import type {
  DictionaryEntry,
  SaveCaptureResult,
  Settings,
} from '../shared/models';
import { HoverController } from './hover-controller';
import {
  PageSaveGuard,
  type GuardedSaveResult,
} from './page-save-guard';
import { targetAtPoint } from './target-at-point';
import { createTooltip } from './tooltip';

type LookupData =
  | { lookupStatus: 'found'; entry: DictionaryEntry }
  | { lookupStatus: 'not_found' };

type LookupResponse =
  | { ok: true; data: LookupData }
  | { ok: false; error: string };

type SaveResponse =
  | { ok: true; data: SaveCaptureResult }
  | { ok: false; error: string };

type UndoResponse =
  | { ok: true }
  | { ok: false; error: string };

type SettingsResponse =
  | { ok: true; data: Settings }
  | { ok: false; error: string };

export async function startContentRuntime(): Promise<() => void> {
  const settingsResponse = await browser.runtime.sendMessage({
    type: 'GET_SETTINGS',
  }) as SettingsResponse;

  if (
    !settingsResponse.ok
    || !settingsResponse.data.enabled
    || settingsResponse.data.disabledOrigins.includes(location.origin)
  ) {
    return () => undefined;
  }

  const tooltip = createTooltip();
  const saveGuard = new PageSaveGuard();
  let lastKey = '';
  let lastRect = new DOMRect();

  const controller = new HoverController({
    async lookup(target) {
      const response = await browser.runtime.sendMessage({
        type: 'LOOKUP_WORD',
        word: target.word,
      }) as LookupResponse;

      if (!response.ok) {
        tooltip.showError(response.error);
        return { lookupStatus: 'not_found' };
      }

      if (response.data.lookupStatus === 'found') {
        const settingsResponse = await browser.runtime.sendMessage({
          type: 'GET_SETTINGS',
        }) as SettingsResponse;

        if (settingsResponse.ok && settingsResponse.data.autoSpeak) {
          void browser.runtime.sendMessage({
            type: 'SPEAK_WORD',
            word: target.word,
          });
        }

        tooltip.show(response.data.entry, lastRect);
      } else {
        tooltip.showError('离线词典未收录');
      }

      return { lookupStatus: response.data.lookupStatus };
    },

    async save(target) {
      let result: GuardedSaveResult<SaveCaptureResult>;
      try {
        result = await saveGuard.save(target, async () => {
          const response = await browser.runtime.sendMessage({
            type: 'SAVE_CAPTURE',
            payload: {
              ...target,
              surfaceWord: target.word,
              sourceTitle: document.title,
              sourceUrl: window.location.href,
            },
          }) as SaveResponse;

          if (!response.ok) {
            throw new Error(response.error);
          }

          return response.data;
        });
      } catch {
        tooltip.showError('保存失败，可重试');
        return;
      }

      if (result.status === 'skipped') {
        return;
      }

      tooltip.showSaved(() => {
        void saveGuard.undo(target, async () => {
          const response = await browser.runtime.sendMessage({
            type: 'UNDO_CAPTURE',
            captureId: result.value.capture.id,
            savedAt: result.value.savedAt,
          }) as UndoResponse;

          if (!response.ok) {
            throw new Error(response.error);
          }
        }).catch(() => {
          tooltip.showError('撤销失败');
        });
      });

      return result.value;
    },

    close: () => tooltip.hide(),
  });

  const onPointerMove = (event: PointerEvent): void => {
    const isTooltipEvent = event.composedPath().some(
      (node) => (
        node instanceof Element
        && node.matches('[data-context-vocabulary-ui]')
      ),
    );
    if (isTooltipEvent) {
      return;
    }

    const target = targetAtPoint(event.clientX, event.clientY);
    const key = target
      ? `${target.word}:${target.sentence}:${target.wordStart}`
      : '';

    if (key === lastKey) {
      return;
    }

    lastKey = key;

    if (!target) {
      controller.leave();
      return;
    }

    lastRect = new DOMRect(event.clientX, event.clientY, 1, 1);
    controller.enter(target);
  };

  const cancel = (): void => controller.leave();

  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('scroll', cancel, {
    passive: true,
    capture: true,
  });
  window.addEventListener('blur', cancel);

  return () => {
    controller.destroy();
    tooltip.destroy();
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('scroll', cancel, true);
    window.removeEventListener('blur', cancel);
  };
}
