/**
 * Suono di notifica per il Pomodoro — campanella dolce
 */
export function playPomodoroSound(type: "break" | "focus") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    if (type === "break") {
      // Pausa: 3 note discendenti dolci
      const notes = [880, 659.25, 523.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.2);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.2);
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + i * 0.2 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.5);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.5);
      });
    } else {
      // Ripresa focus: 2 note ascendenti energiche
      const notes = [523.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.35);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.35);
      });
    }
  } catch {
    // Silently fail
  }
}
