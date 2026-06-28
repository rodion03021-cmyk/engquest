// Дневник на английском (принцип "Output с первого дня"): пользователь пишет
// простые предложения каждый день, ошибки не страшны — это активная практика.
const Journal = (() => {
  const STORAGE_KEY = 'engquest_journal_v1';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  let entries = load();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function addEntry(text) {
    if (!text.trim()) return;
    entries.unshift({ date: new Date().toISOString().slice(0, 10), text: text.trim() });
    save();
  }

  function getEntries() {
    return entries;
  }

  return { addEntry, getEntries };
})();
