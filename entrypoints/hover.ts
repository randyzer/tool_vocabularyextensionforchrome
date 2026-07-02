import { startContentRuntime } from '../src/content';
import {
  startRuntimeOnce,
  type RuntimeLifecycleState,
} from '../src/content/runtime-lifecycle';

interface ContentGlobal {
  __contextVocabularyLifecycle__?: RuntimeLifecycleState;
}

export default defineUnlistedScript(async () => {
  const scope = globalThis as typeof globalThis & ContentGlobal;
  const state = scope.__contextVocabularyLifecycle__ ??= {};

  await startRuntimeOnce(
    state,
    startContentRuntime,
    (listener) => window.addEventListener('pagehide', listener, {
      once: true,
    }),
  );
});
