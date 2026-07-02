export interface RuntimeLifecycleState {
  activation?: Promise<void>;
}

export async function startRuntimeOnce(
  state: RuntimeLifecycleState,
  start: () => Promise<() => void>,
  registerPageHide: (listener: () => void) => void,
): Promise<void> {
  if (state.activation) {
    await state.activation;
    return;
  }

  let activation: Promise<void>;
  activation = (async () => {
    const stop = await start();
    registerPageHide(() => {
      if (state.activation !== activation) {
        return;
      }

      state.activation = undefined;
      stop();
    });
  })();
  state.activation = activation;

  try {
    await activation;
  } catch (error) {
    if (state.activation === activation) {
      state.activation = undefined;
    }
    throw error;
  }
}
