import { addDays, diffDays, mondayOf } from './index';

export { mondayOf };

/** Журнал: 'YYYY-MM-DD' → сколько закрыто за день. */
export type ActivityLog = Record<string, number>;

/** green — закрыто ≥1; red — ни одного; gray — до первого запуска; future — ещё не наступил. */
export type DayStatus = 'green' | 'red' | 'gray' | 'future';

export type ActivityCell = { date: string; count: number; status: DayStatus; today: boolean };

export const ACTIVITY_WEEKS = 5;

/**
 * Сетка карты действий: `weeks` строк по 7 дней (пн–вс), построчно;
 * последняя строка — неделя, в которой `today`.
 */
export function activityGrid(
  activity: ActivityLog,
  firstDay: string | null,
  today: string,
  weeks: number = ACTIVITY_WEEKS,
): ActivityCell[] {
  const start = addDays(mondayOf(today), -7 * (weeks - 1));
  const cells: ActivityCell[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i);
    const count = activity[date] ?? 0;
    const fromToday = diffDays(today, date);
    let status: DayStatus;
    if (fromToday > 0) status = 'future';
    else if (firstDay && diffDays(firstDay, date) < 0) status = 'gray';
    else status = count > 0 ? 'green' : 'red';
    cells.push({ date, count, status, today: fromToday === 0 });
  }
  return cells;
}

/** Дни подряд с закрытыми задачами, заканчивая сегодня; если сегодня ещё пусто — вчера. */
export function activityStreak(activity: ActivityLog, today: string): number {
  let day = (activity[today] ?? 0) > 0 ? today : addDays(today, -1);
  let n = 0;
  while ((activity[day] ?? 0) > 0) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}
