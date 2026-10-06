import { describe, expect, it } from 'vitest';
import { activityGrid, activityStreak } from './activity';

// 2026-10-06 — вторник; 12 октября 2026 — понедельник.
const TODAY = '2026-10-06';

describe('activityGrid: 5 недель пн–вс', () => {
  const grid = activityGrid({ '2026-09-30': 2, '2026-10-06': 1, '2026-09-10': 4 }, '2026-09-14', TODAY);

  it('35 дней с понедельника 7 сентября до воскресенья 11 октября', () => {
    expect(grid).toHaveLength(35);
    expect(grid[0].date).toBe('2026-09-07');
    expect(grid[7].date).toBe('2026-09-14');
    expect(grid[34].date).toBe('2026-10-11');
    expect(grid[28].date).toBe('2026-10-05'); // последняя строка начинается с пн текущей недели
  });

  it('статусы: gray до первого дня, green/red, сегодня отмечено, будущее — future', () => {
    const byDate = Object.fromEntries(grid.map((c) => [c.date, c]));
    expect(byDate['2026-09-10']).toMatchObject({ status: 'gray', count: 4 });
    expect(byDate['2026-09-13'].status).toBe('gray');
    expect(byDate['2026-09-14'].status).toBe('red');
    expect(byDate['2026-09-30']).toMatchObject({ status: 'green', count: 2, today: false });
    expect(byDate['2026-10-06']).toMatchObject({ status: 'green', count: 1, today: true });
    expect(byDate['2026-10-07']).toMatchObject({ status: 'future', today: false });
    expect(grid.filter((c) => c.today)).toHaveLength(1);
    expect(grid.filter((c) => c.status === 'future')).toHaveLength(5);
  });

  it('пустое сегодня — красное; воскресенье — сегодня, будущих нет', () => {
    expect(activityGrid({}, '2026-01-01', TODAY)[29]).toMatchObject({ date: TODAY, status: 'red', today: true });
    const sunday = activityGrid({}, '2026-01-01', '2026-10-11');
    expect(sunday[34]).toMatchObject({ date: '2026-10-11', today: true });
    expect(sunday.some((c) => c.status === 'future')).toBe(false);
  });
});

describe('activityStreak', () => {
  it('считает подряд зелёные дни, заканчивая сегодня', () => {
    expect(activityStreak({ '2026-10-04': 1, '2026-10-05': 3, '2026-10-06': 1 }, TODAY)).toBe(3);
  });
  it('сегодня пусто — считает от вчера', () => {
    expect(activityStreak({ '2026-10-03': 1, '2026-10-04': 1, '2026-10-05': 2 }, TODAY)).toBe(3);
  });
  it('пропуск рвёт серию; вчера и сегодня пусто — 0', () => {
    expect(activityStreak({ '2026-10-02': 1, '2026-10-04': 1, '2026-10-05': 1 }, TODAY)).toBe(2);
    expect(activityStreak({ '2026-10-04': 1 }, TODAY)).toBe(0);
    expect(activityStreak({}, TODAY)).toBe(0);
  });
  it('серия через границу месяца', () => {
    expect(activityStreak({ '2026-09-30': 1, '2026-10-01': 1 }, '2026-10-01')).toBe(2);
  });
});
