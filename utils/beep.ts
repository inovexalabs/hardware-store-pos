// Short confirmation sounds for scanning (browser only, never throws).

let context: AudioContext | null = null;

function tone(frequency: number, durationMs: number, volume = 0.08) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    context ??= new Ctx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + durationMs / 1000);
  } catch {
    // sound is a nice-to-have
  }
}

/** high beep: item found / added */
export const beepOk = () => tone(1760, 90);
/** low buzz: nothing matched */
export const beepError = () => tone(220, 220, 0.1);
