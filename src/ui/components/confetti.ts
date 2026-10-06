/* Салют из конфетти на весь экран (~1.5 с) на своём canvas, без зависимостей. При prefers-reduced-motion не запускается. */

const DURATION = 1500;
const COUNT = 140;

type Piece = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; color: string };

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Запустить салют цветами colors. Возвращает false, если анимации отключены. */
export function confetti(colors: readonly string[]): boolean {
  if (reducedMotion() || typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return false;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  // Два залпа снизу по краям и один из центра сверху.
  const pieces: Piece[] = [];
  for (let i = 0; i < COUNT; i++) {
    const side = i % 3;
    const fromLeft = side === 0;
    const fromTop = side === 2;
    const angle = fromTop
      ? Math.PI / 2 + (Math.random() - 0.5) * 1.6
      : (fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3) + (Math.random() - 0.5) * 0.7;
    const speed = fromTop ? 2 + Math.random() * 4 : 9 + Math.random() * 8;
    pieces.push({
      x: fromTop ? W / 2 + (Math.random() - 0.5) * W * 0.6 : fromLeft ? 0 : W,
      y: fromTop ? -10 : H * 0.85,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      w: 6 + Math.random() * 5,
      h: 9 + Math.random() * 7,
      color: colors[i % colors.length],
    });
  }

  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const t = now - start;
    const k = Math.min((now - last) / 16.7, 3);
    last = now;
    ctx.clearRect(0, 0, W, H);
    const fade = t > DURATION - 400 ? Math.max(0, (DURATION - t) / 400) : 1;
    ctx.globalAlpha = fade;
    for (const p of pieces) {
      p.vy += 0.32 * k;
      p.vx *= 0.985;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.rot += p.vr * k;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.abs(Math.cos(p.rot * 2)), p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
  return true;
}
