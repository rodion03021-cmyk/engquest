// Озвучка английских фраз через Web Speech API (бесплатно, без интернета на десктопе).
const Speech = (() => {
  const supported = 'speechSynthesis' in window;

  function speak(text) {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  }

  return { speak, supported };
})();
