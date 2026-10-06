import { describe, expect, it } from 'vitest';
import { habitStreak, habitStrip, isScheduled } from './habits';

/** Полдень локального дня — createdAt не зависит от часового пояса машины. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

// Октябрь 2026: 1 — четверг, 4 — воскресенье, 5 — понедельник, 6 — вторник.
const TODAY = '2026-10-06';

describe('isScheduled', () => {
  it('день недели: 0 = пн … 6 = вс', () => {
    const weekend = { days: [5, 6] };
    expect(isScheduled(weekend, '2026-10-03')).toBe(true); // сб
    expect(isScheduled(weekend, '2026-10-04')).toBe(true); // вс
    expect(isScheduled(weekend, '2026-10-05')).toBe(false); // пн
    expect(isScheduled({ days: [0] }, '2026-10-05')).toBe(true);
    expect(isScheduled({ days: [3] }, '2026-10-01')).toBe(true); // чт
  });
});

describe('habitStrip', () => {
  it('7 дней по порядку: выполнена / пропущена / не по расписанию / до создания / сегодня ждёт', () => {
    // пн, ср, пт, вс; создана в пт 2 окт
    const h = { days: [0, 2, 4, 6], createdAt: at(2026, 10, 2) };
    const strip = habitStrip(h, ['2026-10-02', '2026-10-05'], TODAY);
    expect(strip.map((c) => [c.date, c.status])).toEqual([
      ['2026-09-30', 'before'], // ср, до создания
      ['2026-10-01', 'before'], // чт
      ['2026-10-02', 'done'], // пт
      ['2026-10-03', 'off'], // сб
      ['2026-10-04', 'missed'], // вс
      ['2026-10-05', 'done'], // пн
      ['2026-10-06', 'off'], // вт, сегодня
    ]);
    expect(strip.map((c) => c.today)).toEqual([false, false, false, false, false, false, true]);
  });

  it('сегодня по расписанию и не отмечено — «ждёт», а не «пропущено»; отмечено — выполнено', () => {
    const h = { days: [1], createdAt: at(2026, 9, 1) }; // вторники
    expect(habitStrip(h, [], TODAY)[6].status).toBe('pending');
    expect(habitStrip(h, [TODAY], TODAY)[6].status).toBe('done');
  });
});

describe('habitStreak', () => {
  const daily = { days: [0, 1, 2, 3, 4, 5, 6], createdAt: at(2026, 9, 1) };

  it('подряд выполненные запланированные дни; пропуск рвёт серию', () => {
    expect(habitStreak(daily, ['2026-10-03', '2026-10-04', '2026-10-05', TODAY], TODAY)).toBe(4);
    expect(habitStreak(daily, ['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', TODAY], TODAY)).toBe(3);
    expect(habitStreak(daily, [], TODAY)).toBe(0);
  });

  it('сегодня, если ещё не отмечено, серию не рвёт', () => {
    expect(habitStreak(daily, ['2026-10-04', '2026-10-05'], TODAY)).toBe(2);
  });

  it('незапланированные дни серию не рвут', () => {
    const mwf = { days: [0, 2, 4], createdAt: at(2026, 9, 1) }; // пн, ср, пт
    // пт 25 сен, пн 28, ср 30, пт 2 окт, пн 5 — подряд; вт 6 не по расписанию
    const checks = ['2026-09-25', '2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05'];
    expect(habitStreak(mwf, checks, TODAY)).toBe(5);
    // пропущена ср 30 сен — серия с пт 2 окт
    expect(habitStreak(mwf, ['2026-09-28', '2026-10-02', '2026-10-05'], TODAY)).toBe(2);
  });

  it('дни до создания серию заканчивают, а не считаются пропуском навсегда', () => {
    const fresh = { days: [0, 1, 2, 3, 4, 5, 6], createdAt: at(2026, 10, 5) };
    expect(habitStreak(fresh, ['2026-10-05', TODAY], TODAY)).toBe(2);
  });
});
