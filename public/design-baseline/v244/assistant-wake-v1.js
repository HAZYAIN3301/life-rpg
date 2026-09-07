/* Satoru Assistant Wake v1 — чистый разбор голосового вызова.
 *
 * Браузер не может быть системной Siri: он не получает микрофон в фоне и не
 * должен слушать без явного согласия. Этот модуль решает только проверяемую
 * часть контракта: распознаёт фразу «Сатору …» в уже полученном transcript и
 * возвращает остаток как ЧЕРНОВИК. Никакое действие и даже отправка сообщения
 * отсюда не выполняются.
 */
(function exposeAssistantWake(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AssistantWakeV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAssistantWake() {
  'use strict';

  const VERSION = '1.0.0';
  const WAKE_WORDS = Object.freeze(['Сатору', 'Satoru']);
  // Wake word обязан быть первым смысловым словом. Иначе подкаст или ответ Тени,
  // где имя встретилось в середине фразы, внезапно открыл бы помощника.
  const PREFIX = /^(?:\s*(?:эй|hey|ok|okay)[\s,;:!?.—-]+)?\s*(?:сатору|satoru)(?=$|[^\p{L}\p{N}])/iu;

  function parseTranscript(value) {
    const transcript = String(value == null ? '' : value).trim();
    if (!transcript) return { triggered: false, transcript: '', command: '' };
    const match = PREFIX.exec(transcript);
    if (!match) return { triggered: false, transcript, command: '' };
    const command = transcript.slice(match[0].length).replace(/^[\s,;:!?.—-]+/u, '').trim();
    return { triggered: true, transcript, command };
  }

  function supported(win) {
    const host = win || (typeof window !== 'undefined' ? window : null);
    return !!(host && (host.SpeechRecognition || host.webkitSpeechRecognition));
  }

  return Object.freeze({ VERSION, WAKE_WORDS, parseTranscript, supported });
});
