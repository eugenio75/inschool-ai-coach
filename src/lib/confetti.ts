/**
 * Lightweight confetti effect using canvas — zero dependencies
 */
export function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = window.innerWidth * 2;
  canvas.height = window.innerHeight * 2;
  ctx.scale(2, 2);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const colors = ["#E57373", "#1D9E75", "#378ADD", "#BA7517", "#7F77DD", "#FFD700", "#FF69B4"];

  interface Particle {
    x: number; y: number; vx: number; vy: number;
    w: number; h: number; color: string; rot: number; vr: number;
    life: number;
  }

  const particles: Particle[] = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: W * 0.5 + (Math.random() - 0.5) * W * 0.4,
      y: H * 0.3,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 12 - 4,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2,
      life: 1,
    });
  }

  let frame = 0;
  function animate() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.rot += p.vr;
      p.life -= 0.008;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (alive && frame < 200) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(animate);
}

/**
 * Play a positive sound for correct answers
 */
export function playCorrectSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25]; // C5, E5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });
  } catch {}
}
