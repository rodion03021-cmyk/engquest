// Проигрывание одного урока (или сессии повторения): последовательность упражнений,
// проверка ответов, начисление XP. lessonLike = { id, phrases: [{en, ru}, ...] }.
const Lesson = (() => {
  let container, lesson, exercises, index, mistakes, xpGained, onComplete, onChange, onAnswer, trackCompletion;
  let buildAnswer = [];

  function start(targetContainer, lessonLike, callbacks) {
    container = targetContainer;
    lesson = lessonLike;
    // В обычном уроке порядок важен: каждое слово сначала встречается в упражнении
    // на узнавание и только потом — в более сложном, поэтому здесь не перемешиваем.
    // В повторении (SRS) слова уже изучены раньше, порядок можно перемешать.
    exercises = callbacks.isReview
      ? Exercises.shuffle(Exercises.buildReviewExercises(lessonLike.phrases))
      : Exercises.buildLessonExercises(lessonLike);
    index = 0;
    mistakes = 0;
    xpGained = 0;
    onComplete = callbacks.onComplete;
    onChange = callbacks.onChange || (() => {});
    onAnswer = callbacks.onAnswer || (() => {});
    trackCompletion = callbacks.trackCompletion !== false;
    render();
  }

  function progressLabel() {
    return `${index + 1} / ${exercises.length}`;
  }

  function render() {
    const ex = exercises[index];
    container.innerHTML = `
      <div class="lesson-progress">
        <div class="lesson-progress-bar"><div class="lesson-progress-fill" style="width:${(index / exercises.length) * 100}%"></div></div>
        <span class="lesson-progress-label">${progressLabel()}</span>
      </div>
      <div id="exercise-host"></div>
    `;
    const host = document.getElementById('exercise-host');
    if (ex.type === 'flashcard') renderFlashcard(host, ex);
    else if (ex.type === 'choice') renderChoice(host, ex);
    else if (ex.type === 'type') renderType(host, ex);
    else renderBuild(host, ex);
  }

  function renderFlashcard(host, ex) {
    host.innerHTML = `
      <div class="exercise-card flashcard-card">
        <div class="flashcard-label">Новое слово</div>
        <div class="flashcard-en">
          <button class="speak-btn speak-btn-lg" id="speak-btn" aria-label="Озвучить">🔊</button>
          <span>${ex.phrase.en}</span>
        </div>
        <div class="flashcard-ru">${ex.phrase.ru}</div>
        <button class="btn-primary" id="flashcard-next-btn" style="margin-top:24px;">Дальше</button>
      </div>
    `;
    document.getElementById('speak-btn').addEventListener('click', () => Speech.speak(ex.phrase.en));
    Speech.speak(ex.phrase.en);
    document.getElementById('flashcard-next-btn').addEventListener('click', next);
  }

  function renderChoice(host, ex) {
    const isListening = ex.mode === 'audio';
    host.innerHTML = `
      <div class="exercise-card">
        <div class="exercise-prompt ${isListening ? 'listening-prompt' : ''}">
          ${ex.direction === 'en-ru' ? `<button class="speak-btn ${isListening ? 'speak-btn-lg' : ''}" id="speak-btn" aria-label="Озвучить">🔊</button>` : ''}
          <span id="prompt-text" class="${isListening ? 'hidden' : ''}">${ex.prompt}</span>
        </div>
        <div class="options-grid">
          ${ex.options.map((opt, i) => `<button class="option-btn" data-opt="${i}">${opt}</button>`).join('')}
        </div>
        <div id="feedback-area"></div>
      </div>
    `;
    const speakBtn = document.getElementById('speak-btn');
    if (speakBtn) speakBtn.addEventListener('click', () => Speech.speak(ex.phrase.en));
    if (ex.direction === 'en-ru') Speech.speak(ex.phrase.en);

    host.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = ex.options[Number(btn.dataset.opt)];
        host.querySelectorAll('.option-btn').forEach((b) => (b.disabled = true));
        const correct = chosen === ex.correct;
        btn.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) {
          host.querySelectorAll('.option-btn').forEach((b) => {
            if (b.textContent === ex.correct) b.classList.add('correct');
          });
        }
        if (isListening) {
          const promptText = document.getElementById('prompt-text');
          promptText.textContent = ex.prompt;
          promptText.classList.remove('hidden');
        }
        handleResult(correct, 10, ex);
      });
    });
  }

  function renderType(host, ex) {
    host.innerHTML = `
      <div class="exercise-card">
        <div class="exercise-prompt"><span>${ex.prompt}</span></div>
        <input type="text" id="type-input" class="type-input" placeholder="Напиши перевод на английском" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="btn-primary" id="check-btn" style="margin-top:14px;">Проверить</button>
        <div id="feedback-area"></div>
      </div>
    `;
    const input = document.getElementById('type-input');
    input.focus();
    const checkBtn = document.getElementById('check-btn');
    const submit = () => {
      if (checkBtn.disabled) return;
      const correct = Exercises.normalizeAnswer(input.value) === Exercises.normalizeAnswer(ex.correct);
      input.disabled = true;
      checkBtn.disabled = true;
      input.classList.add(correct ? 'correct' : 'wrong');
      handleResult(correct, 15, ex);
    };
    checkBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  }

  function renderBuild(host, ex) {
    buildAnswer = [];
    host.innerHTML = `
      <div class="exercise-card">
        <div class="exercise-prompt">
          <button class="speak-btn" id="speak-btn" aria-label="Озвучить">🔊</button>
          <span>${ex.prompt}</span>
        </div>
        <div class="build-answer" id="build-answer"></div>
        <div class="build-pool" id="build-pool"></div>
        <div id="feedback-area"></div>
      </div>
    `;
    document.getElementById('speak-btn').addEventListener('click', () => Speech.speak(ex.phrase.en));

    const pool = document.getElementById('build-pool');
    ex.shuffled.forEach((word, i) => {
      const btn = document.createElement('button');
      btn.className = 'word-chip';
      btn.textContent = word;
      btn.dataset.idx = i;
      btn.addEventListener('click', () => {
        buildAnswer.push({ word, idx: i });
        btn.classList.add('used');
        btn.disabled = true;
        renderAnswerRow(ex, host);
      });
      pool.appendChild(btn);
    });
    renderAnswerRow(ex, host);
  }

  function renderAnswerRow(ex, host) {
    const answerEl = document.getElementById('build-answer');
    answerEl.innerHTML = '';
    buildAnswer.forEach((item, pos) => {
      const chip = document.createElement('button');
      chip.className = 'word-chip answer-chip';
      chip.textContent = item.word;
      chip.addEventListener('click', () => {
        buildAnswer.splice(pos, 1);
        const poolBtn = host.querySelector(`.word-chip[data-idx="${item.idx}"]`);
        if (poolBtn) {
          poolBtn.disabled = false;
          poolBtn.classList.remove('used');
        }
        renderAnswerRow(ex, host);
      });
      answerEl.appendChild(chip);
    });
    if (buildAnswer.length === ex.correctOrder.length) {
      const userOrder = buildAnswer.map((i) => i.word).join(' ');
      const correct = userOrder === ex.correctOrder.join(' ');
      host.querySelectorAll('.word-chip').forEach((b) => (b.disabled = true));
      answerEl.classList.add(correct ? 'correct' : 'wrong');
      handleResult(correct, 15, ex);
    }
  }

  function handleResult(correct, xpForCorrect, ex) {
    onAnswer(ex.phrase, correct);
    if (correct) {
      xpGained += xpForCorrect;
      Progress.addXp(xpForCorrect);
      Sound.playCorrect();
    } else {
      mistakes += 1;
      Progress.loseHeart();
      Sound.playWrong();
    }
    onChange();

    const feedback = document.getElementById('feedback-area');
    let panelHtml = '';
    if (!correct) {
      const exp = Exercises.explainMistake(ex);
      panelHtml = `
        <div class="mistake-panel">
          <div class="mistake-title">❌ Неправильно</div>
          <div class="mistake-text"><strong>${exp.answerLine}.</strong> ${exp.tip}</div>
        </div>
      `;
    } else if (ex.phrase.note) {
      // Заметка показывается по запросу, чтобы не мешать тренировке активного вспоминания.
      panelHtml = `
        <button class="info-toggle" id="info-toggle">ℹ️ Почему так?</button>
        <div class="info-panel hidden" id="info-panel">${ex.phrase.note}</div>
      `;
    }
    const heartsLeft = Progress.get().hearts;
    if (heartsLeft <= 0) {
      feedback.innerHTML = `${panelHtml}<button class="btn-primary" id="next-btn">Завершить</button>`;
      document.getElementById('next-btn').addEventListener('click', finishFail);
      return;
    }
    feedback.innerHTML = `${panelHtml}<button class="btn-primary" id="next-btn">${correct ? 'Дальше' : 'Понятно'}</button>`;
    document.getElementById('next-btn').addEventListener('click', next);
    const infoToggle = document.getElementById('info-toggle');
    if (infoToggle) {
      infoToggle.addEventListener('click', () => {
        document.getElementById('info-panel').classList.toggle('hidden');
      });
    }
  }

  function next() {
    index += 1;
    if (index >= exercises.length) {
      finishSuccess();
    } else {
      render();
    }
  }

  function finishSuccess() {
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    if (trackCompletion) Progress.completeLesson(lesson.id, stars);
    Sound.playComplete();
    onComplete({ success: true, xpGained, mistakes, stars });
  }

  function finishFail() {
    onComplete({ success: false, xpGained, mistakes });
  }

  return { start };
})();
