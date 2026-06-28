// Маршрутизация экранов: карта уроков -> урок / повторение -> результат.
(() => {
  const app = document.getElementById('app');
  const topBar = document.getElementById('top-bar');
  const backBtn = document.getElementById('btn-back');
  const muteBtn = document.getElementById('btn-mute');
  const voiceBtn = document.getElementById('btn-voice');
  const toastHost = document.getElementById('toast-host');

  let lastStats = { hearts: null, xp: null, streak: null };

  function popStat(rowId) {
    const row = document.getElementById(rowId);
    row.classList.remove('stat-pop');
    // перезапускаем анимацию принудительно
    void row.offsetWidth;
    row.classList.add('stat-pop');
  }

  function refreshTopBar() {
    const p = Progress.get();
    document.getElementById('stat-hearts').textContent = p.hearts;
    document.getElementById('stat-xp').textContent = p.xp;
    document.getElementById('stat-streak').textContent = p.streak;
    if (lastStats.hearts !== null && p.hearts !== lastStats.hearts) popStat('stat-hearts-row');
    if (lastStats.xp !== null && p.xp !== lastStats.xp) popStat('stat-xp-row');
    if (lastStats.streak !== null && p.streak !== lastStats.streak) popStat('stat-streak-row');
    lastStats = { hearts: p.hearts, xp: p.xp, streak: p.streak };
  }

  function refreshMuteBtn() {
    muteBtn.textContent = Sound.isMuted() ? '🔇' : '🔊';
  }

  muteBtn.addEventListener('click', () => {
    Sound.toggleMuted();
    refreshMuteBtn();
  });
  refreshMuteBtn();
  voiceBtn.addEventListener('click', showVoicePicker);

  function showAchievementToast(def) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <span class="achievement-toast-icon">${def.icon}</span>
      <span>
        <div class="achievement-toast-title">🎉 Новое достижение</div>
        <div class="achievement-toast-name">${def.title}</div>
      </span>
    `;
    toastHost.appendChild(toast);
    setTimeout(() => toast.remove(), 3600);
  }

  function checkAchievements() {
    const stats = Progress.getStats();
    stats.wordsLearned = SRS.getWordCount();
    const newly = Achievements.checkAndUnlock(stats);
    if (newly.length) {
      Sound.playAchievement();
      newly.forEach((def, i) => setTimeout(() => showAchievementToast(def), i * 400));
    }
  }

  // Уроки внутри юнита всегда разблокируются по порядку. Юниты с independent:true
  // не зависят от других юнитов и доступны сразу, независимо от их позиции в UNITS.
  // Обычные юниты выстраиваются в цепочку только между собой (chainUnits), поэтому
  // добавление нового независимого юнита в начало списка не блокирует уже пройденные уроки.
  function isLessonUnlocked(unit, lessonIdx) {
    // Уже пройденный урок остаётся открытым всегда, даже если порядок юнитов
    // позже поменялся — иначе переставленный учебный план "запер" бы прогресс.
    if (Progress.isLessonCompleted(unit.lessons[lessonIdx].id)) return true;
    if (lessonIdx > 0) {
      return Progress.isLessonCompleted(unit.lessons[lessonIdx - 1].id);
    }
    if (unit.independent) return true;
    const chainUnits = UNITS.filter((u) => !u.independent);
    const unitPos = chainUnits.findIndex((u) => u.id === unit.id);
    if (unitPos === 0) return true;
    const prevUnitLessons = chainUnits[unitPos - 1].lessons;
    return Progress.isLessonCompleted(prevUnitLessons[prevUnitLessons.length - 1].id);
  }

  function levelBadge(unit) {
    return unit.level ? `<span class="level-badge">${unit.level}</span>` : '';
  }

  function renderUnitBlock(unit) {
    let html = `<h2 class="unit-title">${unit.icon} ${unit.title} ${levelBadge(unit)}</h2>`;
    unit.lessons.forEach((lesson, lessonIdx) => {
      const unlocked = isLessonUnlocked(unit, lessonIdx);
      const stars = Progress.getLessonStars(lesson.id);
      const starsStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      html += `
        <button class="lesson-node ${unlocked ? '' : 'locked'}" data-unit="${unit.id}" data-lesson="${lesson.id}" ${unlocked ? '' : 'disabled'}>
          <span class="lesson-node-title">${unlocked ? '' : '🔒 '}${lesson.title}</span>
          ${unlocked ? `<span class="lesson-node-stars">${starsStr}</span>` : ''}
        </button>
      `;
    });
    return html;
  }

  function findLesson(lessonId) {
    for (const unit of UNITS) {
      const lesson = unit.lessons.find((l) => l.id === lessonId);
      if (lesson) return lesson;
    }
    return null;
  }

  function showMap() {
    backBtn.classList.add('hidden');
    topBar.classList.remove('hidden');
    refreshTopBar();
    const dueCount = SRS.getDueCount();
    const independentUnits = UNITS.filter((u) => u.independent);
    const chainUnits = UNITS.filter((u) => !u.independent);

    const dailyXp = Progress.getDailyXp();
    const goal = Progress.DAILY_XP_GOAL;
    const goalPct = Math.min(100, Math.round((dailyXp / goal) * 100));

    let html = `<div class="map-screen"><h1 class="app-title">EngQuest</h1>`;
    html += `
      <div class="daily-plan-card">
        <div class="daily-plan-title">📅 Ежедневный план</div>
        <div class="daily-plan-text">Утро (10–15 мин) — повтори слова. День (15–20 мин) — пройди урок. Вечер (10 мин) — напиши 3–5 предложений в дневник. Главное правило: 20–30 минут каждый день лучше 3 часов раз в неделю.</div>
        <div class="daily-goal-row">
          <div class="daily-goal-bar"><div class="daily-goal-fill" style="width:${goalPct}%"></div></div>
          <span class="daily-goal-label">${dailyXp}/${goal} XP сегодня</span>
        </div>
      </div>
      <div class="nav-row">
        <button class="nav-btn" id="journal-btn">📔 Дневник</button>
        <button class="nav-btn" id="achievements-btn">🏆 Достижения</button>
        <button class="nav-btn" id="resources-btn">📚 Ресурсы и методика</button>
      </div>
      <button class="review-btn" id="review-btn" ${dueCount ? '' : 'disabled'}>
        🔁 ${dueCount ? `Повторить слова (${dueCount})` : 'Нет слов для повторения'}
      </button>
    `;
    independentUnits.forEach((unit) => {
      html += renderUnitBlock(unit);
    });
    chainUnits.forEach((unit) => {
      html += renderUnitBlock(unit);
    });
    html += `</div>`;
    app.innerHTML = html;

    app.querySelectorAll('.lesson-node:not(.locked)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lesson = findLesson(btn.dataset.lesson);
        showLessonIntro(lesson);
      });
    });
    if (dueCount) document.getElementById('review-btn').addEventListener('click', startReview);
    document.getElementById('journal-btn').addEventListener('click', showJournal);
    document.getElementById('achievements-btn').addEventListener('click', showAchievements);
    document.getElementById('resources-btn').addEventListener('click', showResources);
  }

  function renderVoiceList() {
    const host = document.getElementById('voice-list');
    if (!host) return;
    const voices = Speech.englishVoices();
    if (!voices.length) {
      host.innerHTML = `<p class="journal-empty">Голоса ещё загружаются... Подожди секунду.</p>`;
      return;
    }
    const savedURI = Speech.getSavedVoiceURI();
    host.innerHTML = voices
      .map((v, i) => {
        const selected = savedURI ? savedURI === v.voiceURI : i === 0;
        return `
          <div class="voice-card ${selected ? 'selected' : ''}" data-voice-uri="${encodeURIComponent(v.voiceURI)}">
            <div class="voice-info">
              <div class="voice-name">${v.name}</div>
              <div class="voice-lang">${v.lang}</div>
            </div>
            <button class="voice-play-btn" data-action="play" aria-label="Прослушать">▶️</button>
            <button class="voice-select-btn" data-action="select">${selected ? '✓ Выбран' : 'Выбрать'}</button>
          </div>
        `;
      })
      .join('');
    host.querySelectorAll('.voice-card').forEach((card) => {
      const voiceURI = decodeURIComponent(card.dataset.voiceUri);
      card.querySelector('[data-action="play"]').addEventListener('click', () => {
        Speech.speakWithVoice('Hello, how are you today?', voiceURI);
      });
      card.querySelector('[data-action="select"]').addEventListener('click', () => {
        Speech.setVoice(voiceURI);
        renderVoiceList();
      });
    });
  }

  function showVoicePicker() {
    backBtn.classList.remove('hidden');
    topBar.classList.remove('hidden');
    refreshTopBar();
    app.innerHTML = `
      <div class="voice-screen">
        <h2 class="achievements-title">🎙️ Выбор голоса</h2>
        <p class="journal-hint">Если озвучка звучит слишком "по-роботски" — попробуй другие голоса (нажми ▶️) и выбери тот, что нравится больше. Список голосов зависит от твоего телефона/браузера.</p>
        <div id="voice-list"></div>
      </div>
    `;
    Speech.refreshVoices();
    renderVoiceList();
    setTimeout(renderVoiceList, 400); // на случай, если голоса подгрузились с опозданием
  }

  function showAchievements() {
    backBtn.classList.remove('hidden');
    topBar.classList.remove('hidden');
    refreshTopBar();
    const stats = Progress.getStats();
    stats.wordsLearned = SRS.getWordCount();
    const cards = Achievements.all()
      .map((def) => {
        const unlocked = Achievements.isUnlocked(def.id) || def.check(stats);
        return `
          <div class="achievement-card ${unlocked ? '' : 'locked'}">
            <div class="achievement-icon">${unlocked ? def.icon : '🔒'}</div>
            <div>
              <div class="achievement-name">${def.title}</div>
              <div class="achievement-desc">${def.desc}</div>
            </div>
          </div>
        `;
      })
      .join('');
    app.innerHTML = `
      <div class="achievements-screen">
        <h2 class="achievements-title">🏆 Достижения</h2>
        ${cards}
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderJournalEntries(entries) {
    const host = document.getElementById('journal-entries');
    if (!entries.length) {
      host.innerHTML = `<p class="journal-empty">Записей пока нет — начни с сегодняшней.</p>`;
      return;
    }
    host.innerHTML = entries
      .map(
        (e) => `
        <div class="journal-entry">
          <div class="journal-entry-date">${e.date}</div>
          <div class="journal-entry-text">${escapeHtml(e.text)}</div>
        </div>
      `
      )
      .join('');
  }

  function showJournal() {
    backBtn.classList.remove('hidden');
    topBar.classList.remove('hidden');
    refreshTopBar();
    app.innerHTML = `
      <div class="journal-screen">
        <h2 class="journal-title">📔 Дневник на английском</h2>
        <p class="journal-hint">Каждый день пиши 3–5 простых предложений о том, что делал, видел или чувствуешь. Ошибки — это нормально, не жди «готовности». Потом можешь вставить текст в чат с Claude или ChatGPT и попросить проверить ошибки.</p>
        <textarea id="journal-input" class="journal-input" placeholder="Today I..."></textarea>
        <button class="btn-primary" id="journal-save-btn">Сохранить запись</button>
        <div class="journal-entries" id="journal-entries"></div>
      </div>
    `;
    renderJournalEntries(Journal.getEntries());
    document.getElementById('journal-save-btn').addEventListener('click', () => {
      const textarea = document.getElementById('journal-input');
      if (!textarea.value.trim()) return;
      Journal.addEntry(textarea.value);
      textarea.value = '';
      renderJournalEntries(Journal.getEntries());
    });
  }

  function showResources() {
    backBtn.classList.remove('hidden');
    topBar.classList.remove('hidden');
    refreshTopBar();
    app.innerHTML = `
      <div class="resources-screen">
        <h2 class="resources-title">📚 Методика и ресурсы</h2>
        <div class="resources-block">
          <div class="resources-block-title">Три принципа, на которых построено приложение</div>
          <ul class="resources-list">
            <li><strong>Comprehensible Input (Крашен)</strong> — учи через понимание материала чуть сложнее текущего уровня, а не через зубрёжку правил.</li>
            <li><strong>Spaced Repetition (Эббингауз)</strong> — повторяй слово в момент, когда почти забыл — для этого раздел «Повторение слов».</li>
            <li><strong>Output с первого дня</strong> — говори и пиши сразу, пусть с ошибками — для этого раздел «Дневник».</li>
          </ul>
        </div>
        <div class="resources-block">
          <div class="resources-block-title">Три ошибки, которые тормозят большинство учеников</div>
          <ul class="resources-list">
            <li>Ждать «готовности», чтобы начать говорить. Решение: говори с первого дня, пусть с ошибками.</li>
            <li>Зубрить грамматику, не говоря. Решение: 80% времени — практика, 20% — теория.</li>
            <li>Заниматься нерегулярно. Решение: минимум 20–30 минут, но каждый день — это важнее интенсивности.</li>
          </ul>
        </div>
        <div class="resources-block">
          <div class="resources-block-title">Внешние ресурсы для дополнительной практики</div>
          <ul class="resources-list links-list">
            <li><a href="https://forvo.com" target="_blank" rel="noopener">Forvo.com</a> — слушай, как носители произносят любое слово.</li>
            <li><a href="https://youglish.com" target="_blank" rel="noopener">YouGlish.com</a> — то же слово в реальных видео на YouTube.</li>
            <li><a href="https://www.bbc.co.uk/learningenglish" target="_blank" rel="noopener">BBC Learning English</a> — слушание и чтение для начинающих, медленная речь.</li>
            <li><a href="https://www.ted.com" target="_blank" rel="noopener">TED Talks</a> — слушание с субтитрами на английском (уровень B1–B2).</li>
            <li><a href="https://apps.ankiweb.net" target="_blank" rel="noopener">Anki</a> — лучший бесплатный инструмент для интервального повторения.</li>
            <li><a href="https://www.tandem.net" target="_blank" rel="noopener">Tandem</a> и <a href="https://www.hellotalk.com" target="_blank" rel="noopener">HelloTalk</a> — бесплатный языковой обмен с носителями.</li>
            <li><a href="https://www.lingq.com" target="_blank" rel="noopener">LingQ</a> — чтение с накоплением словаря (метод Стива Кауфманна).</li>
          </ul>
        </div>
      </div>
    `;
  }

  function showLessonIntro(lesson) {
    backBtn.classList.remove('hidden');
    topBar.classList.remove('hidden');
    refreshTopBar();
    const gf = lesson.grammarFocus;
    app.innerHTML = `
      <div class="intro-screen">
        <div class="intro-icon">🔍</div>
        <h2 class="intro-lesson-title">${lesson.title}</h2>
        <div class="intro-card">
          <div class="intro-card-title">${gf ? gf.title : '🔑 Новые слова'}</div>
          <p class="intro-card-text">${gf ? gf.text : `В этом уроке — новые слова и фразы по теме «${lesson.title}».`}</p>
        </div>
        <button class="btn-primary" id="start-lesson-btn">Начать урок</button>
      </div>
    `;
    document.getElementById('start-lesson-btn').addEventListener('click', () => startLesson(lesson));
  }

  function startLesson(lesson) {
    if (Progress.get().hearts <= 0) Progress.refillHearts();
    backBtn.classList.remove('hidden');
    topBar.classList.remove('hidden');
    refreshTopBar();
    app.innerHTML = `<div id="lesson-container"></div>`;
    const lessonContainer = document.getElementById('lesson-container');
    Lesson.start(lessonContainer, lesson, {
      onChange: refreshTopBar,
      onAnswer: (phrase) => SRS.registerPhrase(phrase),
      onComplete: (result) => showResult(result, { isReview: false, lesson }),
    });
  }

  function startReview() {
    const due = SRS.getDueCards(10);
    if (!due.length) return;
    if (Progress.get().hearts <= 0) Progress.refillHearts();
    backBtn.classList.remove('hidden');
    topBar.classList.remove('hidden');
    refreshTopBar();
    app.innerHTML = `<div id="lesson-container"></div>`;
    const lessonContainer = document.getElementById('lesson-container');
    Lesson.start(lessonContainer, { id: 'review-session', phrases: due }, {
      onChange: refreshTopBar,
      onAnswer: (phrase, correct) => SRS.reviewResult(phrase.en, correct),
      trackCompletion: false,
      isReview: true,
      onComplete: (result) => showResult(result, { isReview: true }),
    });
  }

  function showResult(result, ctx) {
    backBtn.classList.add('hidden');
    refreshTopBar();
    if (result.success) checkAchievements();
    const starsStr = result.success && !ctx.isReview ? '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars) : '';
    const title = result.success ? (ctx.isReview ? 'Повторение завершено!' : 'Урок пройден!') : 'Жизни закончились';
    const continueLabel = result.success ? 'Продолжить' : ctx.isReview ? 'Повторить ещё раз' : 'Повторить урок';
    app.innerHTML = `
      <div class="result-screen">
        <div class="result-emoji">${result.success ? '🎉' : '💔'}</div>
        <h1>${title}</h1>
        ${starsStr ? `<div class="result-stars">${starsStr}</div>` : ''}
        ${!result.success ? `<p>Попробуй ещё раз — жизни восстановлены.</p>` : ''}
        <p class="result-xp">+${result.xpGained} XP</p>
        <button class="btn-primary" id="result-continue">${continueLabel}</button>
      </div>
    `;
    document.getElementById('result-continue').addEventListener('click', () => {
      if (result.success) {
        showMap();
      } else if (ctx.isReview) {
        Progress.refillHearts();
        startReview();
      } else {
        Progress.refillHearts();
        startLesson(ctx.lesson);
      }
    });
  }

  backBtn.addEventListener('click', showMap);

  Progress.touchStreak();
  checkAchievements();
  showMap();
})();
