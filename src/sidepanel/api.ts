import type {
  ExtensionRequest,
  ExtensionResponse,
} from '../shared/messages';

export type MessageTransport = (
  request: ExtensionRequest,
) => Promise<unknown>;

export async function send<T = void>(
  request: ExtensionRequest,
  transport: MessageTransport = (message) => (
    browser.runtime.sendMessage(message)
  ),
): Promise<T> {
  const response = await transport(request) as ExtensionResponse;

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.data as T;
}
