import { useEffect, useRef, useState } from 'preact/hooks';
import { ACTIVITY_WEEKS, activityGrid, activityStreak } from '../../dates/activity';
import { WEEKDAY_SHORT } from '../../dates';
import { useToday } from '../hooks/useToday';
import { dayHint, plural, streakLabel } from '../screens/model';
import { useAppState } from '../StoreContext';

const HINT_MS = 3000;

/** Карта действий на «Сроках»: последние ACTIVITY_WEEKS недель кружками, серия дней подряд, подсказка по тапу. */
export function ActivityMap() {
  const { activity, firstDay } = useAppState();
  const today = useToday();
  const cells = activityGrid(activity, firstDay, today);
  const streak = activityStreak(activity, today);
  const todayCount = activity[today] ?? 0;

  // перекраска сегодняшнего кружка: ловим переход 0 → ≥1 за тот же день
  const prev = useRef<{ date: string; count: number } | null>(null);
  const [popDate, setPopDate] = useState<string | null>(null);
  useEffect(() => {
    const p = prev.current;
    if (p && p.date === today && p.count === 0 && todayCount > 0) setPopDate(today);
    prev.current = { date: today, count: todayCount };
  }, [today, todayCount]);

  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), HINT_MS);
    return () => window.clearTimeout(id);
  }, [hint]);

  const hinted = hint ? cells.find((c) => c.date === hint) : undefined;

  return (
    <section class="glass act-map" aria-label="Карта действий">
      <div class="act-head">
        <span class={`act-streak${streak ? '' : ' act-streak--zero'}`}>{streakLabel(streak)}</span>
        <span class="act-caption">
          {ACTIVITY_WEEKS} {plural(ACTIVITY_WEEKS, ['неделя', 'недели', 'недель'])}
        </span>
      </div>
      <div class="act-grid" role="grid">
        {WEEKDAY_SHORT.map((w) => (
          <span key={w} class="act-wd" aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((c) => (
          <button
            key={c.date}
            type="button"
            class={`act-dot act-dot--${c.status}${c.today ? ' act-dot--today' : ''}${
              c.date === popDate && c.status === 'green' ? ' act-dot--pop' : ''
            }${c.date === hint ? ' act-dot--sel' : ''}`}
            aria-label={c.status === 'future' ? undefined : dayHint(c.date, c.count)}
            disabled={c.status === 'future'}
            onClick={() => setHint(hint === c.date ? null : c.date)}
          />
        ))}
      </div>
      <div class="act-hint" aria-live="polite">
        {hinted ? (
          <span key={hinted.date} class="act-hint-text">
            {dayHint(hinted.date, hinted.count)}
          </span>
        ) : null}
      </div>
    </section>
  );
}
