let context = null,
  enabled = false;
export function setAudio(value) {
  enabled = value;
  if (!value) return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume().catch(() => {});
  } catch {
    enabled = false;
  }
}
export function tone(type = 'click') {
  if (!enabled || !context) return;
  const notes =
    type === 'hit'
      ? [85, 45]
      : type === 'good'
        ? [220, 330, 440]
        : type === 'bad'
          ? [110, 65]
          : [180];
  for (let i = 0; i < notes.length; i++) {
    const start = context.currentTime + i * 0.06,
      osc = context.createOscillator(),
      gain = context.createGain();
    osc.type = type === 'hit' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(notes[i], start);
    osc.frequency.exponentialRampToValueAtTime(notes[i] * 0.7, start + 0.12);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.045, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain).connect(context.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  }
}
