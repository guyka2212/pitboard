let audio = null;

/** Plays the frequencies one after another, `step` seconds apart. */
export function playTones(frequencies, { type = 'sine', volume = 0.2, step = 0.18 } = {}) {
  audio = audio || new AudioContext();
  const now = audio.currentTime;
  frequencies.forEach((frequency, i) => {
    const start = now + i * step;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + step - 0.02);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + step - 0.01);
  });
}

// Loud and rising, to be heard over a noisy pit.
export const alarm = () => playTones([660, 880, 1100], { type: 'square', volume: 0.25 });

// Short and soft: a new chat message is not an emergency.
export const chime = () => playTones([880, 1320], { volume: 0.12, step: 0.12 });
