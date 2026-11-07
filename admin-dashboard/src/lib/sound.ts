/**
 * New-order chime built on the Web Audio API — no audio files needed.
 *
 * Browsers block audio until the user has interacted with the page, so the
 * dashboard calls ensureAudioUnlocked() from a click handler (the sound
 * toggle). If the browser still blocks playback, the visual alert banner
 * and the highlighted order card remain fully functional.
 */

let audioContext: AudioContext | null = null;

export function ensureAudioUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      audioContext = new Ctor();
    }
    if (audioContext.state === "suspended") void audioContext.resume();
    return audioContext.state === "running";
  } catch {
    return false;
  }
}

/** Pleasant rising three-note chime played when a new order arrives. */
export function playNewOrderChime(): void {
  if (!audioContext || audioContext.state !== "running") return;
  const now = audioContext.currentTime;
  const notes = [880, 1174.66, 1567.98]; // A5 → D6 → G6
  notes.forEach((frequency, index) => {
    const start = now + index * 0.16;
    const oscillator = audioContext!.createOscillator();
    const gain = audioContext!.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    oscillator.connect(gain);
    gain.connect(audioContext!.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.55);
  });
}
