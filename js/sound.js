// Звуковые эффекты через Web Audio API (синтез тонов — без внешних аудиофайлов).
const Sound = (() => {
  const STORAGE_KEY = 'engquest_sound_muted_v1';
  let ctx = null;

  function isMuted() {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  function setMuted(muted) {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  }

  function toggleMuted() {
    const next = !isMuted();
    setMuted(next);
    return next;
  }

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, startTime, duration, type, peakGain) {
    const audio = getCtx();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = audio.currentTime + startTime;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function playCorrect() {
    if (isMuted()) return;
    tone(880, 0, 0.12, 'sine', 0.18);
    tone(1318.5, 0.08, 0.16, 'sine', 0.16);
  }

  function playWrong() {
    if (isMuted()) return;
    tone(220, 0, 0.22, 'sine', 0.16);
  }

  function playComplete() {
    if (isMuted()) return;
    tone(523.25, 0, 0.14, 'sine', 0.16);
    tone(659.25, 0.12, 0.14, 'sine', 0.16);
    tone(783.99, 0.24, 0.22, 'sine', 0.18);
  }

  function playAchievement() {
    if (isMuted()) return;
    tone(659.25, 0, 0.1, 'triangle', 0.16);
    tone(880, 0.1, 0.18, 'triangle', 0.18);
  }

  return { isMuted, toggleMuted, playCorrect, playWrong, playComplete, playAchievement };
})();
