// Достижения: список условий + хранение уже разблокированных в localStorage.
const Achievements = (() => {
  const STORAGE_KEY = 'engquest_achievements_v1';

  const DEFS = [
    { id: 'first-lesson', icon: '🌱', title: 'Первые шаги', desc: 'Пройди первый урок', check: (s) => s.lessonsCompleted >= 1 },
    { id: 'lessons-10', icon: '📘', title: '10 уроков', desc: 'Пройди 10 уроков', check: (s) => s.lessonsCompleted >= 10 },
    { id: 'lessons-30', icon: '🏆', title: '30 уроков', desc: 'Пройди 30 уроков', check: (s) => s.lessonsCompleted >= 30 },
    { id: 'streak-7', icon: '🔥', title: 'Неделя без пропусков', desc: '7 дней подряд', check: (s) => s.streak >= 7 },
    { id: 'streak-30', icon: '🔥🔥', title: 'Месяц подряд', desc: '30 дней подряд', check: (s) => s.streak >= 30 },
    { id: 'words-50', icon: '📚', title: '50 слов', desc: 'Выучено 50 слов и фраз', check: (s) => s.wordsLearned >= 50 },
    { id: 'words-200', icon: '📖', title: '200 слов', desc: 'Выучено 200 слов и фраз', check: (s) => s.wordsLearned >= 200 },
    { id: 'xp-1000', icon: '💎', title: '1000 XP', desc: 'Набери 1000 очков опыта', check: (s) => s.xp >= 1000 },
    { id: 'perfect-10', icon: '⭐', title: 'Перфекционист', desc: '10 уроков на 3 звезды', check: (s) => s.perfectLessons >= 10 },
  ];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { unlocked: [] };
    } catch (e) {
      return { unlocked: [] };
    }
  }

  let state = load();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function isUnlocked(id) {
    return state.unlocked.includes(id);
  }

  function checkAndUnlock(stats) {
    const newly = [];
    DEFS.forEach((def) => {
      if (!isUnlocked(def.id) && def.check(stats)) {
        state.unlocked.push(def.id);
        newly.push(def);
      }
    });
    if (newly.length) save();
    return newly;
  }

  function all() {
    return DEFS;
  }

  return { all, isUnlocked, checkAndUnlock };
})();
