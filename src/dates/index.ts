import type { Task } from '../store/types';

export type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

export const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none'];

export const BUCKET_TITLES: Record<Bucket, string> = {
  overdue: 'Просрочено',
  today: 'Сегодня',
  tomorrow: 'Завтра',
  week: 'На неделе',
  later: 'Позже',
  none: 'Без срока',
};

const DAY_MS = 86_400_000;

/** Календарный день YYYY-MM-DD → номер дня (UTC-арифметика, без влияния часовых поясов и перевода часов). */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayNumber(n: number): string {
  const dt = new Date(n * DAY_MS);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Разница в днях: b − a. */
export function diffDays(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

export function addDays(iso: string, n: number): string {
  return fromDayNumber(dayNumber(iso) + n);
}

/** Сегодня по часам устройства, в его часовом поясе. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function bucketOf(due: string | null, today: string): Bucket {
  if (due === null) return 'none';
  const diff = diffDays(today, due);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'week';
  return 'later';
}

/** Сортировка задач: сначала по сроку (без срока — в конце), затем по времени создания. */
export function compareByDue(a: Task, b: Task): number {
  if (a.due !== b.due) {
    if (a.due === null) return 1;
    if (b.due === null) return -1;
    return a.due < b.due ? -1 : 1;
  }
  return a.createdAt - b.createdAt;
}

/** Активные (невыполненные) задачи по группам сроков; пустые группы не возвращаются. */
export function groupTasks(tasks: Task[], today: string): { bucket: Bucket; tasks: Task[] }[] {
  const byBucket = new Map<Bucket, Task[]>();
  for (const t of tasks) {
    if (t.done) continue;
    const b = bucketOf(t.due, today);
    const list = byBucket.get(b);
    if (list) list.push(t);
    else byBucket.set(b, [t]);
  }
  return BUCKET_ORDER.filter((b) => byBucket.has(b)).map((bucket) => ({
    bucket,
    tasks: byBucket.get(bucket)!.sort(compareByDue),
  }));
}

/** Короткие названия дней недели, 0 = пн … 6 = вс (как `weekdayOf` и `Habit.days`). */
export const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;
/** Месяцы в родительном падеже, коротко: «12 окт». */
export const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] as const;
/** Месяцы полностью, для заголовка календаря. */
export const MONTH_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
] as const;

/** День недели, 0 = пн … 6 = вс. */
export function weekdayOf(iso: string): number {
  return (((dayNumber(iso) + 3) % 7) + 7) % 7; // 1970-01-01 — четверг
}

/** Понедельник недели, в которую входит день. */
export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayOf(iso));
}

/** «пн, 12 окт»; год добавляется, если он не совпадает с годом `today`. */
export function formatDate(iso: string, today?: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const sameYear = !today || today.slice(0, 4) === iso.slice(0, 4);
  return `${WEEKDAY_SHORT[weekdayOf(iso)]}, ${d} ${MONTH_SHORT[m - 1]}${sameYear ? '' : ` ${y}`}`;
}

export function formatDue(due: string | null, today: string): { text: string; overdue: boolean } {
  if (due === null) return { text: '', overdue: false };
  const diff = diffDays(today, due);
  if (diff < 0) return { text: `просрочено ${-diff} дн.`, overdue: true };
  if (diff === 0) return { text: 'Сегодня', overdue: false };
  if (diff === 1) return { text: 'Завтра', overdue: false };
  return { text: formatDate(due, today), overdue: false };
}
