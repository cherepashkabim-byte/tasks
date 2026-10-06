import { describe, expect, it } from 'vitest';
import type { Task } from '../store/types';
import { bucketOf, formatDue, groupTasks } from './index';

const today = '2026-10-06'; // вторник

describe('bucketOf', () => {
  it('раскладывает сроки по шести группам, включая границы', () => {
    expect(bucketOf('2026-10-05', today)).toBe('overdue'); // вчера
    expect(bucketOf('2025-12-31', today)).toBe('overdue');
    expect(bucketOf('2026-10-06', today)).toBe('today');
    expect(bucketOf('2026-10-07', today)).toBe('tomorrow');
    expect(bucketOf('2026-10-08', today)).toBe('week'); // +2
    expect(bucketOf('2026-10-13', today)).toBe('week'); // +7
    expect(bucketOf('2026-10-14', today)).toBe('later'); // +8
    expect(bucketOf('2027-01-01', today)).toBe('later');
    expect(bucketOf(null, today)).toBe('none');
  });

  it('считает границы через конец месяца и года', () => {
    expect(bucketOf('2027-01-01', '2026-12-31')).toBe('tomorrow');
    expect(bucketOf('2026-11-07', '2026-10-31')).toBe('week'); // +7
    expect(bucketOf('2026-11-08', '2026-10-31')).toBe('later'); // +8
  });
});

function task(id: string, due: string | null, createdAt: number, done = false): Task {
  return { id, title: id, note: '', projectId: 'p', themeId: null, due, done, doneAt: done ? 1 : null, createdAt };
}

describe('groupTasks', () => {
  it('выдаёт непустые группы по порядку, без выполненных, внутри — по дате, затем по времени создания', () => {
    const tasks = [
      task('later', '2026-12-01', 1),
      task('none-new', null, 50),
      task('today-new', '2026-10-06', 30),
      task('week-far', '2026-10-12', 1),
      task('overdue-recent', '2026-10-05', 1),
      task('none-old', null, 10),
      task('today-old', '2026-10-06', 20),
      task('week-near', '2026-10-09', 99),
      task('overdue-old', '2026-09-01', 5),
      task('done-today', '2026-10-06', 1, true),
    ];
    const groups = groupTasks(tasks, today);
    expect(groups.map((g) => [g.bucket, g.tasks.map((t) => t.id)])).toEqual([
      ['overdue', ['overdue-old', 'overdue-recent']],
      ['today', ['today-old', 'today-new']],
      ['week', ['week-near', 'week-far']],
      ['later', ['later']],
      ['none', ['none-old', 'none-new']],
    ]);
  });

  it('пустой список — пустой результат', () => {
    expect(groupTasks([], today)).toEqual([]);
  });
});

describe('formatDue', () => {
  it('пишет срок по-русски', () => {
    expect(formatDue('2026-10-06', today)).toEqual({ text: 'Сегодня', overdue: false });
    expect(formatDue('2026-10-07', today)).toEqual({ text: 'Завтра', overdue: false });
    expect(formatDue('2026-10-12', today)).toEqual({ text: 'пн, 12 окт', overdue: false });
    expect(formatDue('2026-11-01', today)).toEqual({ text: 'вс, 1 ноя', overdue: false });
    expect(formatDue('2027-01-04', today)).toEqual({ text: 'пн, 4 янв 2027', overdue: false });
  });

  it('просроченные — «просрочено N дн.»', () => {
    expect(formatDue('2026-10-03', today)).toEqual({ text: 'просрочено 3 дн.', overdue: true });
    expect(formatDue('2026-10-05', today)).toEqual({ text: 'просрочено 1 дн.', overdue: true });
  });

  it('без срока — пустой текст', () => {
    expect(formatDue(null, today)).toEqual({ text: '', overdue: false });
  });
});
