// Озвучка английских фраз через Web Speech API (бесплатно, без интернета на десктопе).
const Speech = (() => {
  const STORAGE_KEY = 'engquest_voice_v1';
  const supported = 'speechSynthesis' in window;
  let cachedVoices = [];

  function refreshVoices() {
    if (!supported) return;
    cachedVoices = window.speechSynthesis.getVoices();
  }

  if (supported) {
    refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  }

  function englishVoices() {
    return cachedVoices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
  }

  function getSavedVoiceURI() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function setVoice(voiceURI) {
    localStorage.setItem(STORAGE_KEY, voiceURI);
  }

  // Голоса "Google" (сетевые) на Android обычно звучат заметно естественнее
  // встроенных локальных голосов — предпочитаем их, если пользователь сам не выбрал голос.
  function pickBestVoice() {
    const voices = englishVoices();
    if (!voices.length) return null;
    const savedURI = getSavedVoiceURI();
    if (savedURI) {
      const saved = voices.find((v) => v.voiceURI === savedURI);
      if (saved) return saved;
    }
    const usVoices = voices.filter((v) => v.lang.toLowerCase() === 'en-us');
    const pool = usVoices.length ? usVoices : voices;
    const google = pool.find((v) => /google/i.test(v.name));
    return google || pool[0];
  }

  function applyVoice(utter, voice) {
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      utter.lang = 'en-US';
    }
    utter.rate = 0.9;
  }

  function speak(text) {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    applyVoice(utter, pickBestVoice());
    window.speechSynthesis.speak(utter);
  }

  // Для прослушивания конкретного голоса в настройках, не трогая сохранённый выбор.
  function speakWithVoice(text, voiceURI) {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = cachedVoices.find((v) => v.voiceURI === voiceURI);
    applyVoice(utter, voice);
    window.speechSynthesis.speak(utter);
  }

  // На некоторых версиях Android Chrome getVoices() возвращает пустой список, пока
  // движок озвучки не "разбужен" хотя бы одним вызовом speak() — поэтому перед опросом
  // списка голосов проигрываем беззвучную фразу, чтобы спровоцировать его инициализацию.
  function warmUp() {
    if (!supported) return;
    try {
      const utter = new SpeechSynthesisUtterance(' ');
      utter.volume = 0;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      // игнорируем — это просто попытка "разбудить" движок, не критично при ошибке
    }
  }

  return { speak, speakWithVoice, warmUp, supported, englishVoices, refreshVoices, getSavedVoiceURI, setVoice };
})();
