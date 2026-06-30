import { describe, expect, it, vi } from 'vitest';
import { speakWord } from '../../src/background/speech-service';

describe('speech service', () => {
  it('stops current speech before speaking with an English voice', async () => {
    const order: string[] = [];
    const adapter = {
      stop: vi.fn(async () => {
        order.push('stop');
      }),
      speak: vi.fn(async () => {
        order.push('speak');
      }),
    };

    await speakWord('ultimately', 1.25, adapter);

    expect(order).toEqual(['stop', 'speak']);
    expect(adapter.speak).toHaveBeenCalledWith('ultimately', {
      lang: 'en-US',
      rate: 1.25,
    });
  });
});
