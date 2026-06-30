export interface SpeechAdapter {
  stop(): void | Promise<void>;
  speak(
    text: string,
    options: { lang: string; rate: number },
  ): void | Promise<void>;
}

export async function speakWord(
  word: string,
  rate: number,
  adapter: SpeechAdapter = browser.tts,
): Promise<void> {
  await adapter.stop();
  await adapter.speak(word, {
    lang: 'en-US',
    rate,
  });
}
