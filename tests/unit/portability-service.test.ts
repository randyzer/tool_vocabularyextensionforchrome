import { describe, expect, it } from 'vitest';
import { validateImport } from '../../src/storage/portability-service';

describe('import validation', () => {
  it('rejects incompatible versions before writing', () => {
    expect(() => validateImport({ version: 2 })).toThrow(
      'UNSUPPORTED_EXPORT_VERSION',
    );
  });

  it('rejects oversized capture collections', () => {
    expect(() => validateImport({
      version: 1,
      exportedAt: Date.now(),
      captures: Array.from({ length: 50_001 }, () => ({})),
      digests: [],
      settings: {},
    })).toThrow('IMPORT_TOO_LARGE');
  });
});
