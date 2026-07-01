import { describe, expect, it } from 'vitest';
import { canTranslate } from '../../src/sidepanel/translator';

describe('sentence translator', () => {
  it('returns false when the browser API is absent', () => {
    expect(canTranslate({})).toBe(false);
  });

  it('returns true when Translator exists', () => {
    expect(canTranslate({ Translator: {} })).toBe(true);
  });
});
