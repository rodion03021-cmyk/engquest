// Генерация упражнений урока из списка фраз (data/units.js).
const Exercises = (() => {
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function allPhrases() {
    const out = [];
    UNITS.forEach((u) => u.lessons.forEach((l) => l.phrases.forEach((p) => out.push(p))));
    return out;
  }

  function pickDistractors(correct, count) {
    const pool = allPhrases().filter((p) => p !== correct);
    return shuffle(pool).slice(0, count);
  }

  function normalizeAnswer(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[?!.,']/g, '')
      .replace(/\s+/g, ' ');
  }

  // Грамматический/орфографический комментарий: конкретная заметка из data/units.js
  // (phrase.note), если она есть, иначе — общая подсказка по типу упражнения.
  function getTip(ex) {
    if (ex.phrase.note) return ex.phrase.note;
    if (ex.type === 'build') {
      return 'В английском предложении обычно порядок такой: подлежащее → сказуемое → остальные слова — в отличие от русского, где порядок более свободный.';
    }
    if (ex.type === 'type') {
      return 'Сравни своё написание с правильным ответом буква за буквой — обрати внимание на окончания и пробелы.';
    }
    return 'Запомни это слово или фразу — она появится в разделе «Повторение слов».';
  }

  // Объяснение ошибки: правильный ответ + комментарий из getTip.
  function explainMistake(ex) {
    let answerLine;
    if (ex.type === 'build') answerLine = `Правильный порядок слов: «${ex.correctOrder.join(' ')}»`;
    else if (ex.type === 'type') answerLine = `Правильный ответ: «${ex.correct}»`;
    else answerLine = `Правильный перевод: «${ex.correct}»`;
    return { answerLine, tip: getTip(ex) };
  }

  function buildChoiceExercise(phrase, direction, mode) {
    const distractors = pickDistractors(phrase, 3);
    const correctText = direction === 'en-ru' ? phrase.ru : phrase.en;
    const options = shuffle([
      correctText,
      ...distractors.map((d) => (direction === 'en-ru' ? d.ru : d.en)),
    ]);
    return {
      type: 'choice',
      direction,
      mode: mode || 'text', // 'text' - показываем фразу, 'audio' - только озвучка (упражнение на слух)
      phrase,
      prompt: direction === 'en-ru' ? phrase.en : phrase.ru,
      options,
      correct: correctText,
    };
  }

  function buildOrderExercise(phrase) {
    const words = phrase.en.split(' ');
    return {
      type: 'build',
      phrase,
      prompt: phrase.ru,
      correctOrder: words,
      shuffled: shuffle(words),
    };
  }

  function buildTypeExercise(phrase) {
    return {
      type: 'type',
      phrase,
      prompt: phrase.ru,
      correct: phrase.en,
    };
  }

  // Карточка нового слова: просто показывает en+ru+произношение, без вопроса.
  // Это первый шаг знакомства со словом — до неё quiz "угадай перевод" был
  // чистым гаданием для слов, которые пользователь видит впервые.
  function buildFlashcard(phrase) {
    return { type: 'flashcard', phrase };
  }

  function buildPracticeExercise(phrase, kindIndex) {
    const PRACTICE_CYCLE = ['listening', 'choice-ru-en', 'build', 'type'];
    let kind = PRACTICE_CYCLE[kindIndex % PRACTICE_CYCLE.length];
    const wordCount = phrase.en.split(' ').length;
    if (kind === 'build' && wordCount < 3) kind = 'choice-ru-en';
    switch (kind) {
      case 'choice-ru-en':
        return buildChoiceExercise(phrase, 'ru-en', 'text');
      case 'listening':
        return buildChoiceExercise(phrase, 'en-ru', 'audio');
      case 'type':
        return buildTypeExercise(phrase);
      case 'build':
        return buildOrderExercise(phrase);
      default:
        return buildChoiceExercise(phrase, 'ru-en', 'text');
    }
  }

  // Новый урок: учим словами небольшими порциями (batch), по принципу
  // "Presentation -> Practice". Для каждого слова: сначала карточка (flashcard) —
  // просто видишь en+ru+произношение, без вопроса; затем упражнение на узнавание
  // перевода (видишь английскую фразу + слышишь + выбираешь перевод из вариантов);
  // и только после этого слово встречается в более сложном упражнении той же
  // порции (на слух, сборка фразы или ввод текста). Без карточки первый quiz был
  // бы чистым гаданием — пользователь не мог знать перевод слова, которое видит
  // в первый раз. Так пользователь никогда не должен угадывать, писать или
  // собирать слово, перевод которого ему не показали явно.
  const BATCH_SIZE = 4;

  function buildLessonExercises(lesson) {
    const exercises = [];
    const phrases = lesson.phrases;
    for (let start = 0; start < phrases.length; start += BATCH_SIZE) {
      const batch = phrases.slice(start, start + BATCH_SIZE);
      batch.forEach((phrase) => {
        exercises.push(buildFlashcard(phrase));
        exercises.push(buildChoiceExercise(phrase, 'en-ru', 'text'));
      });
      batch.forEach((phrase, i) => exercises.push(buildPracticeExercise(phrase, i)));
    }
    return exercises;
  }

  // Повторение слов (SRS): слова уже изучены раньше, поэтому достаточно одного
  // упражнения на слово — порядок результата перемешивается вызывающей стороной.
  function buildReviewExercises(phrases) {
    const KIND_CYCLE = ['choice-en-ru', 'listening', 'choice-ru-en', 'type', 'build'];
    return phrases.map((phrase, i) => {
      let kind = KIND_CYCLE[i % KIND_CYCLE.length];
      const wordCount = phrase.en.split(' ').length;
      if (kind === 'build' && wordCount < 3) kind = 'choice-ru-en';
      switch (kind) {
        case 'choice-en-ru':
          return buildChoiceExercise(phrase, 'en-ru', 'text');
        case 'choice-ru-en':
          return buildChoiceExercise(phrase, 'ru-en', 'text');
        case 'listening':
          return buildChoiceExercise(phrase, 'en-ru', 'audio');
        case 'type':
          return buildTypeExercise(phrase);
        case 'build':
          return buildOrderExercise(phrase);
        default:
          return buildChoiceExercise(phrase, 'en-ru', 'text');
      }
    });
  }

  return { buildLessonExercises, buildReviewExercises, shuffle, normalizeAnswer, explainMistake, getTip };
})();
