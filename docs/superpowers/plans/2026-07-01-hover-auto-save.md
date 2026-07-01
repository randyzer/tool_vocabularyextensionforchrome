# Hover Auto-Save Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save a successfully looked-up word only after 2000ms of continued hover, and save the same text target at most once during the current page lifetime unless undo succeeds.

**Architecture:** Keep `HoverController` responsible for lookup/save timing and cancellation. Add a small `PageSaveGuard` that owns page-lifetime target keys and wraps save/undo operations so state changes happen only after successful operations; `startContentRuntime` composes it with the existing runtime messaging and tooltip.

**Tech Stack:** TypeScript, WXT, Chrome Manifest V3 runtime messaging, Vitest with Happy DOM, Playwright Chromium.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/shared/constants.ts` | Change the post-lookup auto-save delay from 1000ms to 2000ms. |
| `src/content/page-save-guard.ts` | Create normalized page target keys and coordinate guarded save/undo operations. |
| `src/content/index.ts` | Apply the page guard around existing save and undo messages. |
| `tests/unit/hover-controller.test.ts` | Lock the new 500ms lookup + 2000ms save timing. |
| `tests/unit/page-save-guard.test.ts` | Verify page-level deduplication, retry, normalization, and undo semantics. |
| `tests/e2e/hover-capture.spec.ts` | Verify one encounter per page and guard reset after navigation. |

## Task 1: Change the post-lookup delay to 2000ms

**Files:**
- Modify: `tests/unit/hover-controller.test.ts:20-45`
- Modify: `src/shared/constants.ts:1-3`

- [ ] **Step 1: Update the timing test so it fails against the current 1000ms constant**

Replace the first `HoverController` test with:

```ts
it('looks up after 500ms and auto-saves after another 2000ms', async () => {
  vi.useFakeTimers();
  const lookup = vi.fn().mockResolvedValue({ lookupStatus: 'found' });
  const save = vi.fn().mockResolvedValue(undefined);
  const controller = new HoverController({
    lookup,
    save,
    close: vi.fn(),
  });

  controller.enter({
    word: 'ultimately',
    sentence: 'It was ultimately rejected.',
    wordStart: 7,
    wordEnd: 17,
  });

  await vi.advanceTimersByTimeAsync(499);
  expect(lookup).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(lookup).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1_999);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```bash
pnpm exec vitest run tests/unit/hover-controller.test.ts
```

Expected: FAIL at `expect(save).not.toHaveBeenCalled()` because the current 1000ms delay saves too early.

- [ ] **Step 3: Make the minimal timing change**

In `src/shared/constants.ts`, change:

```ts
export const AUTO_SAVE_DELAY_MS = 2_000;
```

Do not modify `HOVER_DELAY_MS`; lookup must still start after 500ms.

- [ ] **Step 4: Run the focused test and confirm the green state**

Run:

```bash
pnpm exec vitest run tests/unit/hover-controller.test.ts
```

Expected: all tests in `tests/unit/hover-controller.test.ts` PASS.

- [ ] **Step 5: Commit the timing change**

```bash
git add src/shared/constants.ts tests/unit/hover-controller.test.ts
git commit -m "feat: extend hover auto-save delay"
```

## Task 2: Add the page-lifetime save guard

**Files:**
- Create: `src/content/page-save-guard.ts`
- Create: `tests/unit/page-save-guard.test.ts`

- [ ] **Step 1: Write failing tests for key normalization and successful deduplication**

Create `tests/unit/page-save-guard.test.ts`:

```ts
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PageSaveGuard } from '../../src/content/page-save-guard';
import type { SentenceTarget } from '../../src/content/text-segmentation';

const target: SentenceTarget = {
  word: 'ultimately',
  sentence: 'The proposal was ultimately rejected.',
  wordStart: 17,
  wordEnd: 27,
};

describe('PageSaveGuard', () => {
  it('runs save once for the same normalized page target', async () => {
    const guard = new PageSaveGuard();
    const operation = vi.fn().mockResolvedValue('saved');

    const first = await guard.save(target, operation);
    const repeated = await guard.save({
      ...target,
      sentence: 'The  proposal was ultimately rejected. ',
    }, operation);

    expect(first).toEqual({ status: 'saved', value: 'saved' });
    expect(repeated).toEqual({ status: 'skipped' });
    expect(operation).toHaveBeenCalledOnce();
  });

  it('allows retry after a failed save', async () => {
    const guard = new PageSaveGuard();
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('SAVE_FAILED'))
      .mockResolvedValueOnce('saved');

    await expect(guard.save(target, operation)).rejects.toThrow('SAVE_FAILED');
    await expect(guard.save(target, operation)).resolves.toEqual({
      status: 'saved',
      value: 'saved',
    });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('skips a concurrent save for the same target', async () => {
    const guard = new PageSaveGuard();
    let finishSave: ((value: string) => void) | undefined;
    const operation = vi.fn().mockImplementation(() => (
      new Promise<string>((resolve) => {
        finishSave = resolve;
      })
    ));

    const first = guard.save(target, operation);
    await expect(guard.save(target, operation)).resolves.toEqual({
      status: 'skipped',
    });
    finishSave?.('saved');

    await expect(first).resolves.toEqual({
      status: 'saved',
      value: 'saved',
    });
    expect(operation).toHaveBeenCalledOnce();
  });

  it('releases the target only after a successful undo', async () => {
    const guard = new PageSaveGuard();
    const save = vi.fn().mockResolvedValue('saved');

    await guard.save(target, save);
    await expect(guard.undo(
      target,
      vi.fn().mockRejectedValue(new Error('UNDO_FAILED')),
    )).rejects.toThrow('UNDO_FAILED');
    await expect(guard.save(target, save)).resolves.toEqual({
      status: 'skipped',
    });

    await guard.undo(target, vi.fn().mockResolvedValue(undefined));
    await expect(guard.save(target, save)).resolves.toEqual({
      status: 'saved',
      value: 'saved',
    });
    expect(save).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the new test and confirm the red state**

Run:

```bash
pnpm exec vitest run tests/unit/page-save-guard.test.ts
```

Expected: FAIL because `src/content/page-save-guard.ts` does not exist.

- [ ] **Step 3: Implement the guard**

Create `src/content/page-save-guard.ts`:

```ts
import {
  normalizeSentence,
  type SentenceTarget,
} from './text-segmentation';

export type GuardedSaveResult<T> =
  | { status: 'saved'; value: T }
  | { status: 'skipped' };

function targetKey(target: SentenceTarget): string {
  return JSON.stringify([
    target.word,
    normalizeSentence(target.sentence),
    target.wordStart,
  ]);
}

export class PageSaveGuard {
  private readonly pendingKeys = new Set<string>();
  private readonly savedKeys = new Set<string>();

  async save<T>(
    target: SentenceTarget,
    operation: () => Promise<T>,
  ): Promise<GuardedSaveResult<T>> {
    const key = targetKey(target);
    if (this.savedKeys.has(key) || this.pendingKeys.has(key)) {
      return { status: 'skipped' };
    }

    this.pendingKeys.add(key);
    try {
      const value = await operation();
      this.savedKeys.add(key);
      return { status: 'saved', value };
    } finally {
      this.pendingKeys.delete(key);
    }
  }

  async undo(
    target: SentenceTarget,
    operation: () => Promise<void>,
  ): Promise<void> {
    await operation();
    this.savedKeys.delete(targetKey(target));
  }
}
```

The in-memory sets intentionally have no persistence or reset method: a new content runtime creates a new guard on refresh or navigation.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
pnpm exec vitest run tests/unit/page-save-guard.test.ts
```

Expected: all four `PageSaveGuard` tests PASS.

- [ ] **Step 5: Run the content unit tests together**

Run:

```bash
pnpm exec vitest run tests/unit/page-save-guard.test.ts tests/unit/hover-controller.test.ts tests/unit/text-segmentation.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 6: Commit the guard**

```bash
git add src/content/page-save-guard.ts tests/unit/page-save-guard.test.ts
git commit -m "feat: guard page capture saves"
```

## Task 3: Wire guarded save and undo into the content runtime

**Files:**
- Modify: `src/content/index.ts:14-103`
- Modify: `tests/e2e/hover-capture.spec.ts`

- [ ] **Step 1: Add an end-to-end assertion that repeated hover does not increment the encounter count**

At the top of `tests/e2e/hover-capture.spec.ts`, add:

```ts
import type { Page } from '@playwright/test';
import type { Capture } from '../../src/shared/models';
import { expect, test } from './fixtures';

type CaptureListResponse =
  | { ok: true; data: Capture[] }
  | { ok: false; error: string };

async function listCaptures(page: Page): Promise<Capture[]> {
  return page.evaluate(async () => {
    const chromeApi = (globalThis as typeof globalThis & {
      chrome: {
        runtime: {
          sendMessage(message: unknown): Promise<unknown>;
        };
      };
    }).chrome;
    const response = await chromeApi.runtime.sendMessage({
      type: 'LIST_CAPTURES',
      filter: {},
    }) as CaptureListResponse;

    if (!response.ok) {
      throw new Error(response.error);
    }
    return response.data;
  });
}
```

Replace the final hover/assertion block in the existing test with:

```ts
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
await page.waitForTimeout(2_100);

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
```

- [ ] **Step 2: Run the focused E2E test and confirm the red state**

Run:

```bash
pnpm build:e2e
pnpm exec playwright test tests/e2e/hover-capture.spec.ts
```

Expected: FAIL because the second hover increments `encounterCount` to 2 before the page reload.

- [ ] **Step 3: Add guard and undo response types to the content runtime**

In `src/content/index.ts`, add the import:

```ts
import { PageSaveGuard } from './page-save-guard';
```

After `SaveResponse`, add:

```ts
type UndoResponse =
  | { ok: true }
  | { ok: false; error: string };
```

After the tooltip is created, instantiate one guard for this content runtime:

```ts
const tooltip = createTooltip();
const saveGuard = new PageSaveGuard();
```

- [ ] **Step 4: Wrap the existing save and undo operations**

Replace the current `async save(target)` dependency in `src/content/index.ts` with:

```ts
async save(target) {
  const result = await saveGuard.save(target, async () => {
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
      tooltip.showError('保存失败，可重试');
      throw new Error(response.error);
    }

    return response.data;
  });

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
        tooltip.showError('撤销失败');
        throw new Error(response.error);
      }
    }).catch(() => undefined);
  });

  return result.value;
},
```

This ordering guarantees:

- failed saves clear only the pending key and remain retryable;
- successful saves add the page key before the tooltip exposes undo;
- failed undo keeps the page key;
- successful undo deletes the page key and permits another save.

- [ ] **Step 5: Run unit tests and type checking**

Run:

```bash
pnpm exec vitest run tests/unit/page-save-guard.test.ts tests/unit/hover-controller.test.ts
pnpm typecheck
```

Expected: selected unit tests PASS and TypeScript reports no errors.

- [ ] **Step 6: Rebuild and rerun the focused E2E test**

Run:

```bash
pnpm build:e2e
pnpm exec playwright test tests/e2e/hover-capture.spec.ts
```

Expected: the test PASSes; the same page keeps `encounterCount` at 1, and reloading the page allows it to reach 2.

- [ ] **Step 7: Commit runtime integration**

```bash
git add src/content/index.ts tests/e2e/hover-capture.spec.ts
git commit -m "feat: prevent repeated page captures"
```

## Task 4: Full verification and distributable package

**Files:**
- Verify: all tracked source and test changes
- Generate: `.output/contextual-vocabulary-0.1.0-chrome.zip`

- [ ] **Step 1: Run the complete unit and integration test suite**

Run:

```bash
pnpm test
```

Expected: all Vitest suites PASS.

- [ ] **Step 2: Run the compiler check**

Run:

```bash
pnpm typecheck
```

Expected: TypeScript exits with code 0 and no diagnostics.

- [ ] **Step 3: Build the production extension**

Run:

```bash
pnpm build
```

Expected: WXT creates `.output/chrome-mv3` without build errors.

- [ ] **Step 4: Run all browser journeys**

Run:

```bash
pnpm test:e2e
```

Expected: all Playwright tests PASS, including hover capture, privacy exclusions, and weekly digest.

- [ ] **Step 5: Create the installable ZIP**

Run:

```bash
pnpm zip
```

Expected: WXT creates `.output/contextual-vocabulary-0.1.0-chrome.zip`.

- [ ] **Step 6: Record the package checksum**

Run:

```bash
shasum -a 256 .output/contextual-vocabulary-0.1.0-chrome.zip
```

Expected: one SHA-256 digest followed by the ZIP path. Include this digest in the handoff so the local package can be identified exactly.

- [ ] **Step 7: Confirm the worktree is clean**

Run:

```bash
git status --short --branch
```

Expected: branch is `main` and no tracked implementation changes remain uncommitted. The ignored `.output` package may exist without appearing in status.

## Acceptance checklist

- [ ] Lookup starts only after 500ms on an unchanged target.
- [ ] Save starts only after another 2000ms on the same target.
- [ ] Moving target, scrolling, or blurring still cancels pending work through `HoverController.leave()`.
- [ ] Re-hovering a successfully saved target still performs lookup and shows its definition.
- [ ] Re-hovering a successfully saved target on the same page does not send another save.
- [ ] A failed save can be retried.
- [ ] A successful undo permits saving the target again.
- [ ] A failed undo leaves the target guarded.
- [ ] Refreshing or navigating creates a fresh page guard.
- [ ] Full tests, type checking, production build, E2E, and ZIP packaging succeed.
