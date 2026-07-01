import type { Capture } from '../../shared/models';
import { send } from '../api';
import { canTranslate, translateSentence } from '../translator';

export function createHighlightedSentence(
  sentence: string,
  start: number,
  end: number,
): HTMLElement {
  const paragraph = document.createElement('p');
  paragraph.className = 'capture-sentence';
  paragraph.append(document.createTextNode(sentence.slice(0, start)));

  const mark = document.createElement('mark');
  mark.textContent = sentence.slice(start, end);
  paragraph.append(mark, document.createTextNode(sentence.slice(end)));

  return paragraph;
}

export function createCaptureCard(
  capture: Capture,
  refresh: () => void,
): HTMLElement {
  const article = document.createElement('article');
  article.className = 'capture-card';

  const heading = document.createElement('h2');
  heading.textContent = capture.phonetic
    ? `${capture.lemma} /${capture.phonetic}/`
    : capture.lemma;

  const definitions = document.createElement('p');
  definitions.className = 'capture-definitions';
  definitions.textContent = capture.definitionsZh.slice(0, 3).join('；');

  const sentence = createHighlightedSentence(
    capture.sentence,
    capture.wordStart,
    capture.wordEnd,
  );

  const controls = document.createElement('div');
  controls.className = 'card-actions';

  const speak = document.createElement('button');
  speak.type = 'button';
  speak.textContent = '发音';
  speak.addEventListener('click', () => {
    void send({
      type: 'SPEAK_WORD',
      word: capture.surfaceWord,
    });
  });

  const mastered = document.createElement('button');
  mastered.type = 'button';
  mastered.textContent = capture.mastered ? '取消已掌握' : '已掌握';
  mastered.addEventListener('click', async () => {
    await send({
      type: 'UPDATE_CAPTURE',
      id: capture.id,
      mastered: !capture.mastered,
    });
    refresh();
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '删除';
  remove.addEventListener('click', async () => {
    await send({ type: 'DELETE_CAPTURE', id: capture.id });
    refresh();
  });

  controls.append(speak, mastered, remove);

  if (canTranslate()) {
    const translate = document.createElement('button');
    translate.type = 'button';
    translate.textContent = '翻译整句';
    translate.addEventListener('click', async () => {
      translate.disabled = true;

      try {
        const translated = document.createElement('p');
        translated.className = 'capture-translation';
        translated.textContent = await translateSentence(capture.sentence);
        article.append(translated);
      } catch {
        const error = document.createElement('p');
        error.className = 'capture-translation';
        error.textContent = '当前 Chrome 无法下载或使用离线翻译模型。';
        article.append(error);
      } finally {
        translate.disabled = false;
      }
    });
    controls.append(translate);
  }

  article.append(heading, definitions, sentence, controls);

  return article;
}
