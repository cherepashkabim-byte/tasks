import { addDays, diffDays, todayISO, weekdayOf } from './index';

export { weekdayOf };

/** Что нужно от привычки календарной логике: расписание (0 = пн … 6 = вс) и момент создания. */
export type HabitSchedule = { days: readonly number[] };
export type HabitTimeline = HabitSchedule & { createdAt: number };

/**
 * done — отмечена; missed — по расписанию, но пропущена; off — день не по расписанию;
 * before — до создания привычки; pending — сегодня по расписанию, ещё не отмечена.
 */
export type HabitDayStatus = 'done' | 'missed' | 'off' | 'before' | 'pending';
export type HabitDay = { date: string; status: HabitDayStatus; today: boolean };

export const HABIT_STRIP_DAYS = 7;

export function isScheduled(habit: HabitSchedule, iso: string): boolean {
  return habit.days.includes(weekdayOf(iso));
}

function dayStatus(habit: HabitTimeline, checked: Set<string>, date: string, today: string): HabitDayStatus {
  if (checked.has(date)) return 'done';
  if (diffDays(todayISO(new Date(habit.createdAt)), date) < 0) return 'before';
  if (!isScheduled(habit, date)) return 'off';
  return date === today ? 'pending' : 'missed';
}

/** Полоска за последние `n` дней, от старого к сегодняшнему. */
export function habitStrip(
  habit: HabitTimeline,
  checks: readonly string[],
  today: string,
  n: number = HABIT_STRIP_DAYS,
): HabitDay[] {
  const checked = new Set(checks);
  const out: HabitDay[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({ date, status: dayStatus(habit, checked, date, today), today: i === 0 });
  }
  return out;
}

/**
 * Серия подряд выполненных запланированных дней, заканчивая сегодня.
 * Незапланированные дни и неотмеченное сегодня серию не рвут; дни до создания её заканчивают.
 */
export function habitStreak(habit: HabitTimeline, checks: readonly string[], today: string): number {
  const checked = new Set(checks);
  const start = todayISO(new Date(habit.createdAt));
  let n = 0;
  for (let day = today; diffDays(start, day) >= 0; day = addDays(day, -1)) {
    const status = dayStatus(habit, checked, day, today);
    if (status === 'done') n++;
    else if (status === 'missed') break;
  }
  return n;
}
