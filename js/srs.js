// Упрощённый алгоритм интервального повторения (SM-2 lite) для слов/фраз.
const SRS = (() => {
  const STORAGE_KEY = 'engquest_srs_v1';
  const STEPS = [1, 3, 7, 14, 30, 60]; // дни до следующего повторения по уровню

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { cards: {} };
    } catch (e) {
      return { cards: {} };
    }
  }

  let state = load();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // Добавляет слово в SRS при первом изучении (в уроке). Если карточка уже есть — не трогаем её график.
  function registerPhrase(phrase) {
    if (state.cards[phrase.en]) return;
    state.cards[phrase.en] = {
      ru: phrase.ru,
      level: 0,
      nextReview: todayStr(),
    };
    save();
  }

  function getDueCards(limit) {
    const today = todayStr();
    const due = Object.entries(state.cards)
      .filter(([, c]) => c.nextReview <= today)
      .sort((a, b) => (a[1].nextReview < b[1].nextReview ? -1 : 1))
      .map(([en, c]) => ({ en, ru: c.ru }));
    return limit ? due.slice(0, limit) : due;
  }

  function getDueCount() {
    return getDueCards().length;
  }

  function getWordCount() {
    return Object.keys(state.cards).length;
  }

  function reviewResult(en, correct) {
    const card = state.cards[en];
    if (!card) return;
    if (correct) {
      card.level = Math.min(card.level + 1, STEPS.length - 1);
    } else {
      card.level = 0;
    }
    card.nextReview = addDays(todayStr(), STEPS[card.level]);
    save();
  }

  return { registerPhrase, getDueCards, getDueCount, getWordCount, reviewResult };
})();
