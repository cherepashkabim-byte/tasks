/** Всплеск частиц вокруг галочки (задачи и привычки); цвет — CSS-переменная `--burst` у предка. */
const PARTICLES = 12;

/** Разлёт частиц (px) по третям круга и их размер: md — у задачи, lg — у большой галочки привычки. */
const SIZES = {
  md: { dist: [30, 22, 26], dot: [6, 4] },
  lg: { dist: [38, 28, 33], dot: [7, 5] },
} as const;

export function Burst({ size = 'md' }: { size?: keyof typeof SIZES }) {
  const { dist, dot } = SIZES[size];
  return (
    <span class="burst" aria-hidden="true">
      {Array.from({ length: PARTICLES }, (_, i) => (
        <i
          key={i}
          style={`--a:${(360 / PARTICLES) * i + (i % 2 ? 12 : 0)}deg;--d:${dist[i % 3]}px;--s:${dot[i % 2]}px`}
        />
      ))}
    </span>
  );
}
