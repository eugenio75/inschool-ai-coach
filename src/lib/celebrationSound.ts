/**
 * Genera un suono celebrativo con Web Audio API — zero file audio, zero dipendenze
 */
export function playCelebrationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gainNode.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.12 + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
      oscillator.start(ctx.currentTime + i * 0.12);
      oscillator.stop(ctx.currentTime + i * 0.12 + 0.4);
    });
  } catch {
    // Silently fail
  }
}
