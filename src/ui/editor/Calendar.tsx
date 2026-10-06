import { useState } from 'preact/hooks';
import { tg } from '../../tg';
import { IconBack, IconChevron } from '../components/icons';
import { monthGrid } from './form';
import { MONTH_FULL, WEEKDAY_SHORT } from '../../dates';


type Props = { value: string | null; today: string; onPick(iso: string): void };

/** Компактный календарь месяца; неделя с понедельника. */
export function Calendar({ value, today, onPick }: Props) {
  const start = value ?? today;
  const [ym, setYm] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const shift = (d: number) => {
    tg.haptic('selection');
    setYm(({ y, m }) => {
      const n = y * 12 + m + d;
      return { y: Math.floor(n / 12), m: n % 12 };
    });
  };
  const weeks = monthGrid(ym.y, ym.m);

  return (
    <div class="cal">
      <div class="cal__head">
        <button class="cal__nav" aria-label="Предыдущий месяц" onClick={() => shift(-1)}>
          <IconBack />
        </button>
        <div class="cal__month">
          {MONTH_FULL[ym.m]} <span>{ym.y}</span>
        </div>
        <button class="cal__nav" aria-label="Следующий месяц" onClick={() => shift(1)}>
          <IconChevron />
        </button>
      </div>
      <div class="cal__grid" key={`${ym.y}-${ym.m}`}>
        {WEEKDAY_SHORT.map((w, i) => (
          <div key={w} class={`cal__wd${i > 4 ? ' is-weekend' : ''}`}>
            {w}
          </div>
        ))}
        {weeks.flat().map((iso, i) =>
          iso ? (
            <button
              key={iso}
              class={[
                'cal__day',
                iso === value && 'is-selected',
                iso === today && 'is-today',
                iso < today && 'is-past',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onPick(iso)}
            >
              {Number(iso.slice(8))}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}
