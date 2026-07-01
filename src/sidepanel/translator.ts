interface TranslatorInstance {
  translate(text: string): Promise<string>;
}

interface TranslatorConstructor {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?(monitor: EventTarget): void;
  }): Promise<TranslatorInstance>;
}

interface TranslatorScope {
  Translator?: TranslatorConstructor | object;
}

export function canTranslate(
  scope: TranslatorScope = globalThis as TranslatorScope,
): boolean {
  return 'Translator' in scope;
}

export async function translateSentence(sentence: string): Promise<string> {
  const constructor = (globalThis as TranslatorScope).Translator as
    | TranslatorConstructor
    | undefined;

  if (!constructor) {
    throw new Error('TRANSLATOR_UNAVAILABLE');
  }

  const availability = await constructor.availability({
    sourceLanguage: 'en',
    targetLanguage: 'zh',
  });

  if (availability === 'unavailable') {
    throw new Error('LANGUAGE_PAIR_UNAVAILABLE');
  }

  const translator = await constructor.create({
    sourceLanguage: 'en',
    targetLanguage: 'zh',
  });

  return translator.translate(sentence);
}
