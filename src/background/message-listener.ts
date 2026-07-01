import type { ExtensionResponse } from '../shared/messages';

type MessageHandler = (message: unknown) => Promise<ExtensionResponse>;
type SendResponse = (response?: unknown) => void;

export function createMessageListener(handler: MessageHandler) {
  return (
    message: unknown,
    _sender: unknown,
    sendResponse: SendResponse,
  ): true => {
    void handler(message).then(
      (response) => sendResponse(response),
      (error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      }),
    );

    return true;
  };
}
