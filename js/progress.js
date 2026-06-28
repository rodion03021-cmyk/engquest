// Хранение прогресса игрока в localStorage (свой прогресс на каждом устройстве).
const Progress = (() => {
  const STORAGE_KEY = 'engquest_progress_v1';
  const HEARTS_MAX = 5;
  const DAILY_XP_GOAL = 50;

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function defaultState() {
    return {
      xp: 0,
      hearts: HEARTS_MAX,
      heartsMax: HEARTS_MAX,
      streak: 0,
      lastActiveDate: null,
      completedLessons: {}, // lessonId -> stars (1-3)
      dailyXp: 0,
      dailyXpDate: null,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  let state = load();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function touchStreak() {
    const today = todayStr();
    if (state.lastActiveDate === today) return;
    if (state.lastActiveDate) {
      const last = new Date(state.lastActiveDate);
      const diffDays = Math.round((new Date(today) - last) / 86400000);
      state.streak = diffDays === 1 ? state.streak + 1 : 1;
    } else {
      state.streak = 1;
    }
    state.lastActiveDate = today;
    save();
  }

  function ensureDailyXp() {
    const today = todayStr();
    if (state.dailyXpDate !== today) {
      state.dailyXpDate = today;
      state.dailyXp = 0;
    }
  }

  function addXp(amount) {
    ensureDailyXp();
    state.xp += amount;
    state.dailyXp += amount;
    save();
  }

  function getDailyXp() {
    ensureDailyXp();
    save();
    return state.dailyXp;
  }

  function getStats() {
    const stars = Object.values(state.completedLessons);
    return {
      xp: state.xp,
      streak: state.streak,
      lessonsCompleted: stars.length,
      perfectLessons: stars.filter((s) => s === 3).length,
    };
  }

  function loseHeart() {
    state.hearts = Math.max(0, state.hearts - 1);
    save();
    return state.hearts;
  }

  function refillHearts() {
    state.hearts = state.heartsMax;
    save();
  }

  function completeLesson(lessonId, stars) {
    const prevStars = state.completedLessons[lessonId] || 0;
    state.completedLessons[lessonId] = Math.max(prevStars, stars);
    save();
  }

  function isLessonCompleted(lessonId) {
    return !!state.completedLessons[lessonId];
  }

  function getLessonStars(lessonId) {
    return state.completedLessons[lessonId] || 0;
  }

  function get() {
    return state;
  }

  return {
    DAILY_XP_GOAL,
    touchStreak,
    addXp,
    getDailyXp,
    getStats,
    loseHeart,
    refillHearts,
    completeLesson,
    isLessonCompleted,
    getLessonStars,
    get,
  };
})();
