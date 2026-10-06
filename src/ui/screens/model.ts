/* Чистая логика экранов проектов и тем: подсчёты, фильтры, подписи. Тесты — model.test.ts. */
import type { Habit, HabitChecks, Task, Theme } from '../../store/types';
import { isScheduled } from '../../dates/habits';
import { formatDate, WEEKDAY_SHORT } from '../../dates';

export type Progress = { done: number; total: number };

/** Сколько задач проекта выполнено из всех. */
export function projectProgress(tasks: Task[], projectId: string): Progress {
  let done = 0;
  let total = 0;
  for (const t of tasks) {
    if (t.projectId !== projectId) continue;
    total++;
    if (t.done) done++;
  }
  return { done, total };
}

/** «3 из 7»; для пустого проекта — «Нет задач». */
export function progressLabel(p: Progress): string {
  return p.total === 0 ? 'Нет задач' : `${p.done} из ${p.total}`;
}

/** Проект закрыт: задачи есть, и все выполнены. Единственное место этого условия. */
export function isProjectComplete(p: Progress): boolean {
  return p.total > 0 && p.done === p.total;
}

/** Процент выполненных задач проекта, округлённый вниз; без задач — 0. */
export function progressPercent(p: Progress): number {
  return p.total > 0 ? Math.floor((p.done * 100) / p.total) : 0;
}

/** Мотивирующая фраза под шкалой — по этапу прогресса (история 28 спецификации). */
export function motivation(p: Progress): string {
  if (isProjectComplete(p)) return 'Проект закрыт 🎉';
  if (p.total > 1 && p.total - p.done === 1) return 'Осталась одна задача — дожми!';
  if (p.done === 0) return 'Пора начинать — первая задача ждёт';
  const pct = progressPercent(p);
  if (pct < 25) return 'Хороший старт';
  if (pct < 50) return 'Набираешь ход';
  if (pct < 75) return 'Это уже половина!';
  return 'Финишная прямая';
}

/** Довела ли отметка задачи проект до 100% (prev — прогресс до изменения, null — экран только открыт). */
export function justCompleted(prev: Progress | null, next: Progress): boolean {
  if (!prev) return false;
  return !isProjectComplete(prev) && isProjectComplete(next) && next.done > prev.done;
}

export type ProgressSnapshot = Map<string, Progress>;

/**
 * Какие проекты только что закрылись (переход к 100% отметкой задачи) — сравнение с прошлым снимком; prev = null — первый снимок.
 * Проект, которого не было в прошлом снимке (не было задач), не празднуется: так возврат удалённой выполненной задачи не даёт салют.
 */
export function completedProjects(
  prev: ProgressSnapshot | null,
  tasks: Task[],
): { completed: string[]; snapshot: ProgressSnapshot } {
  const snapshot: ProgressSnapshot = new Map();
  for (const t of tasks) {
    const p = snapshot.get(t.projectId) ?? { done: 0, total: 0 };
    snapshot.set(t.projectId, { done: p.done + (t.done ? 1 : 0), total: p.total + 1 });
  }
  const completed: string[] = [];
  if (prev) {
    for (const [id, next] of snapshot) {
      const before = prev.get(id);
      if (before && justCompleted(before, next)) completed.push(id);
    }
  }
  return { completed, snapshot };
}

/** Русское окончание: plural(n, ['задача', 'задачи', 'задач']). */
export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

/** Вопрос перед удалением проекта: «Удалить проект и N задач?». */
export function deleteProjectQuestion(taskCount: number): string {
  if (taskCount === 0) return 'Удалить проект?';
  return `Удалить проект и ${taskCount} ${plural(taskCount, ['задачу', 'задачи', 'задач'])}?`;
}

/** Задачи с выбранной темой; themeId = null — без фильтра. */
export function filterByTheme(tasks: Task[], themeId: string | null): Task[] {
  return themeId === null ? tasks : tasks.filter((t) => t.themeId === themeId);
}

/** Темы для чипов на экране проекта: только те, что есть у его задач, в порядке списка тем. */
export function projectThemes(tasks: Task[], themes: Theme[], projectId: string): Theme[] {
  const used = new Set<string>();
  for (const t of tasks) if (t.projectId === projectId && t.themeId) used.add(t.themeId);
  return themes.filter((th) => used.has(th.id));
}

/** Число активных (невыполненных) задач по каждой теме — по всем проектам. */
export function activeByTheme(tasks: Task[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) if (!t.done && t.themeId) m.set(t.themeId, (m.get(t.themeId) ?? 0) + 1);
  return m;
}

/** Эмодзи на выбор для проекта. */
export const PROJECT_EMOJI = [
  '📁', '💼', '🏠', '🎯', '🚀', '💡', '📚', '🛒',
  '💪', '❤️', '🎨', '✈️', '💰', '🎓', '🌱', '🧩',
] as const;

// --- карта действий -------------------------------------------------------

/** Над картой действий: «🔥 N дней подряд»; без серии — «Начни серию сегодня». */
export function streakLabel(n: number): string {
  if (n <= 0) return 'Начни серию сегодня';
  return `🔥 ${n} ${plural(n, ['день', 'дня', 'дней'])} подряд`;
}

/** Подсказка по тапу на кружок: «пн, 12 окт — закрыто 3». */
export function dayHint(iso: string, count: number): string {
  return `${formatDate(iso)} — закрыто ${count}`;
}

// --- привычки -------------------------------------------------------------

/** Эмодзи для привычек — свой набор. */
// prettier-ignore
export const HABIT_EMOJI = [
  '🏋️', '📖', '🧖', '🏃', '🧘', '💧', '🥗', '😴',
  '✍️', '🎸', '🧠', '🚶', '🚴', '🦷', '💊', '🌅',
] as const;

export const HABITS_ALL_DONE = 'Все привычки на сегодня выполнены 💪';
export const HABITS_EMPTY = 'Добавь первую привычку — например, 📖 чтение или 🏋️ зал';

/** Расписание словами: «Каждый день», «По будням», «По выходным» или «пн, ср, пт». */
export function daysLabel(days: readonly number[]): string {
  const key = [...days].sort((a, b) => a - b).join('');
  if (key === '0123456') return 'Каждый день';
  if (key === '01234') return 'По будням';
  if (key === '56') return 'По выходным';
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(', ');
}

/** «Сегодня» — привычки по расписанию на сегодняшний день недели; rest — остальные. Порядок сохраняется. */
export function splitHabits(habits: Habit[], today: string): { today: Habit[]; rest: Habit[] } {
  const out = { today: [] as Habit[], rest: [] as Habit[] };
  for (const h of habits) (isScheduled(h, today) ? out.today : out.rest).push(h);
  return out;
}

/** Все сегодняшние привычки отмечены (и они вообще есть). */
export function allHabitsDone(todayHabits: Habit[], checks: HabitChecks, today: string): boolean {
  return todayHabits.length > 0 && todayHabits.every((h) => checks[h.id]?.includes(today));
}
