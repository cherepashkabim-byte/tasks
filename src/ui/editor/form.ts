import { NOTE_MAX, TITLE_MAX } from '../../store';
import type { Task } from '../../store/types';
import { addDays } from '../../dates';

export { NOTE_MAX, TITLE_MAX };

/** Можно ли сохранить название: не пустое (пробелы не считаются) и не длиннее лимита (по умолчанию — лимит задачи). */
export function canSave(title: string, max: number = TITLE_MAX): boolean {
  return title.trim().length > 0 && title.length <= max;
}

/** «150/200», когда набрано ≥ 75% лимита; иначе null — счётчик не показываем. */
export function limitCounter(len: number, max: number): string | null {
  return len >= max * 0.75 ? `${len}/${max}` : null;
}

export type EditorPrefill = { projectId?: string; themeId?: string | null; due?: string | null };
export type QuickDue = 'today' | 'tomorrow' | 'week' | 'none';
export type TaskDraft = { title: string; note: string; projectId: string; themeId: string | null; due: string | null };

/** Дата для быстрой кнопки срока; «Без срока» → null. */
export function quickDue(kind: QuickDue, today: string): string | null {
  switch (kind) {
    case 'today':
      return today;
    case 'tomorrow':
      return addDays(today, 1);
    case 'week':
      return addDays(today, 7);
    case 'none':
      return null;
  }
}

function isTask(x: Task | EditorPrefill): x is Task {
  return typeof (x as Task).id === 'string' && typeof (x as Task).title === 'string';
}

/** Начальные поля шторки: из задачи (правка) или из предзаполнения (новая задача). */
export function initialDraft(source: Task | EditorPrefill | undefined, inboxId: string): TaskDraft {
  if (source && isTask(source)) {
    const { title, note, projectId, themeId, due } = source;
    return { title, note, projectId, themeId, due };
  }
  return {
    title: '',
    note: '',
    projectId: source?.projectId ?? inboxId,
    themeId: source?.themeId ?? null,
    due: source?.due ?? null,
  };
}

/** Сетка месяца для календаря: недели с понедельника, ячейки — YYYY-MM-DD или null вне месяца. */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month0, 1));
  const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // пн = 0
  const mm = String(month0 + 1).padStart(2, '0');
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${mm}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
