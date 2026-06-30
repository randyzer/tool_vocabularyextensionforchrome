export function normalizeWord(word: string): string {
  return word
    .trim()
    .toLocaleLowerCase('en')
    .replaceAll('’', "'");
}

export function candidateLemmas(word: string): string[] {
  const normalized = normalizeWord(word);
  const values = [normalized];

  if (normalized.endsWith('ies') && normalized.length > 4) {
    values.push(`${normalized.slice(0, -3)}y`);
  }
  if (normalized.endsWith('es') && normalized.length > 3) {
    values.push(normalized.slice(0, -2));
  }
  if (normalized.endsWith('s') && normalized.length > 3) {
    values.push(normalized.slice(0, -1));
  }
  if (normalized.endsWith('ied') && normalized.length > 4) {
    values.push(`${normalized.slice(0, -3)}y`);
  }
  if (normalized.endsWith('ed') && normalized.length > 4) {
    values.push(
      normalized.slice(0, -2),
      normalized.slice(0, -1),
    );
  }
  if (normalized.endsWith('ing') && normalized.length > 5) {
    const stem = normalized.slice(0, -3);
    values.push(stem, `${stem}e`);

    if (stem.at(-1) === stem.at(-2)) {
      values.push(stem.slice(0, -1));
    }
  }

  return [...new Set(values.filter(Boolean))];
}
