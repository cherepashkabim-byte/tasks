import { describe, expect, it } from 'vitest';
import type { Task } from '../../store/types';
import type { Theme } from '../../store/types';
import {
  activeByTheme,
  allHabitsDone,
  daysLabel,
  splitHabits,
  deleteProjectQuestion,
  filterByTheme,
  progressLabel,
  progressPercent,
  motivation,
  justCompleted,
  completedProjects,
  isProjectComplete,
  projectProgress,
  projectThemes,
} from './model';

let seq = 0;
function task(p: Partial<Task>): Task {
  seq++;
  return {
    id: `t${seq}`,
    title: `Задача ${seq}`,
    note: '',
    projectId: 'p1',
    themeId: null,
    due: null,
    done: false,
    doneAt: null,
    createdAt: seq,
    ...p,
  };
}

describe('прогресс проекта «N из M»', () => {
  const tasks = [
    task({ projectId: 'p1', done: true }),
    task({ projectId: 'p1' }),
    task({ projectId: 'p1' }),
    task({ projectId: 'p2', done: true }),
  ];

  it('считает выполненные и все задачи только этого проекта', () => {
    expect(projectProgress(tasks, 'p1')).toEqual({ done: 1, total: 3 });
    expect(projectProgress(tasks, 'p2')).toEqual({ done: 1, total: 1 });
    expect(projectProgress(tasks, 'p3')).toEqual({ done: 0, total: 0 });
  });

  it('меняется, когда задачу отметили', () => {
    const after = tasks.map((t, i) => (i === 1 ? { ...t, done: true } : t));
    expect(projectProgress(after, 'p1')).toEqual({ done: 2, total: 3 });
  });

  it('подпись: «1 из 3», а для пустого проекта — «Нет задач»', () => {
    expect(progressLabel({ done: 1, total: 3 })).toBe('1 из 3');
    expect(progressLabel({ done: 0, total: 0 })).toBe('Нет задач');
  });
});

describe('подтверждение удаления проекта', () => {
  it('называет число задач с правильным окончанием', () => {
    expect(deleteProjectQuestion(0)).toBe('Удалить проект?');
    expect(deleteProjectQuestion(1)).toBe('Удалить проект и 1 задачу?');
    expect(deleteProjectQuestion(3)).toBe('Удалить проект и 3 задачи?');
    expect(deleteProjectQuestion(5)).toBe('Удалить проект и 5 задач?');
    expect(deleteProjectQuestion(11)).toBe('Удалить проект и 11 задач?');
    expect(deleteProjectQuestion(21)).toBe('Удалить проект и 21 задачу?');
    expect(deleteProjectQuestion(112)).toBe('Удалить проект и 112 задач?');
  });
});

const theme = (id: string, createdAt: number): Theme => ({ id, name: id, color: '#7C5CFF', createdAt });

describe('фильтр задач проекта по теме', () => {
  const a = task({ themeId: 'work' });
  const b = task({ themeId: 'home', done: true });
  const c = task({ themeId: null });
  const list = [a, b, c];

  it('без выбранной темы показывает всё, с темой — только её задачи (вместе с выполненными)', () => {
    expect(filterByTheme(list, null)).toEqual([a, b, c]);
    expect(filterByTheme(list, 'home')).toEqual([b]);
    expect(filterByTheme(list, 'nope')).toEqual([]);
  });

  it('чипы — только темы, которые встречаются в задачах проекта, в порядке создания тем', () => {
    const themes = [theme('home', 1), theme('idle', 2), theme('work', 3)];
    const other = task({ projectId: 'p2', themeId: 'idle' });
    expect(projectThemes([...list, other], themes, 'p1').map((t) => t.id)).toEqual(['home', 'work']);
  });
});

describe('счётчик активных задач темы', () => {
  it('считает только невыполненные задачи из всех проектов', () => {
    const list = [
      task({ themeId: 'work', projectId: 'p1' }),
      task({ themeId: 'work', projectId: 'p2' }),
      task({ themeId: 'work', done: true }),
      task({ themeId: 'home', done: true }),
      task({ themeId: null }),
    ];
    const counts = activeByTheme(list);
    expect(counts.get('work')).toBe(2);
    expect(counts.get('home') ?? 0).toBe(0);
  });
});


describe('шкала прогресса: процент', () => {
  it('выполненные / все, округление вниз; пустой проект — 0%', () => {
    expect(progressPercent({ done: 0, total: 0 })).toBe(0);
    expect(progressPercent({ done: 0, total: 5 })).toBe(0);
    expect(progressPercent({ done: 1, total: 3 })).toBe(33);
    expect(progressPercent({ done: 2, total: 3 })).toBe(66);
    expect(progressPercent({ done: 199, total: 200 })).toBe(99);
    expect(progressPercent({ done: 4, total: 4 })).toBe(100);
  });
});

describe('шкала прогресса: мотивирующая фраза', () => {
  // total = 200, чтобы на 99% оставалась не одна задача.
  const at = (percent: number) => motivation({ done: percent * 2, total: 200 });

  it('фразы по этапам на границах 0/1/24/25/49/50/74/75/99/100', () => {
    expect(at(0)).toBe('Пора начинать — первая задача ждёт');
    expect(at(1)).toBe('Хороший старт');
    expect(at(24)).toBe('Хороший старт');
    expect(at(25)).toBe('Набираешь ход');
    expect(at(49)).toBe('Набираешь ход');
    expect(at(50)).toBe('Это уже половина!');
    expect(at(74)).toBe('Это уже половина!');
    expect(at(75)).toBe('Финишная прямая');
    expect(at(99)).toBe('Финишная прямая');
    expect(at(100)).toBe('Проект закрыт 🎉');
  });

  it('пустой проект — как 0%', () => {
    expect(motivation({ done: 0, total: 0 })).toBe('Пора начинать — первая задача ждёт');
  });

  it('осталась ровно одна задача и она не единственная — «дожми»', () => {
    expect(motivation({ done: 1, total: 2 })).toBe('Осталась одна задача — дожми!');
    expect(motivation({ done: 9, total: 10 })).toBe('Осталась одна задача — дожми!');
    expect(motivation({ done: 0, total: 1 })).toBe('Пора начинать — первая задача ждёт');
  });

  it('одна выполненная из многих (0% после округления) — уже «Хороший старт»', () => {
    expect(motivation({ done: 1, total: 150 })).toBe('Хороший старт');
  });
});

describe('шкала прогресса: момент закрытия проекта', () => {
  it('отметка последней задачи — переход к 100%', () => {
    expect(justCompleted({ done: 2, total: 3 }, { done: 3, total: 3 })).toBe(true);
    expect(justCompleted({ done: 0, total: 1 }, { done: 1, total: 1 })).toBe(true);
  });

  it('открытие экрана уже закрытого проекта — не переход', () => {
    expect(justCompleted(null, { done: 3, total: 3 })).toBe(false);
  });

  it('проект уже был на 100% — повторно не празднуем', () => {
    expect(justCompleted({ done: 3, total: 3 }, { done: 3, total: 3 })).toBe(false);
  });

  it('пустой проект и неполный прогресс — не переход', () => {
    expect(justCompleted({ done: 0, total: 0 }, { done: 0, total: 0 })).toBe(false);
    expect(justCompleted({ done: 1, total: 3 }, { done: 2, total: 3 })).toBe(false);
  });

  it('100% из-за удаления последней невыполненной, а не отметки, — не салют', () => {
    expect(justCompleted({ done: 2, total: 3 }, { done: 2, total: 2 })).toBe(false);
  });
});

describe('закрытие проекта с любого экрана', () => {
  const tasksOf = (spec: Record<string, boolean[]>): Task[] =>
    Object.entries(spec).flatMap(([projectId, done]) => done.map((d) => task({ projectId, done: d })));

  it('первый снимок (открытие приложения) ничего не празднует', () => {
    const r = completedProjects(null, tasksOf({ a: [true, true] }));
    expect(r.completed).toEqual([]);
  });

  it('отметка последней задачи в одном проекте — празднуем только его, один раз', () => {
    const first = completedProjects(null, tasksOf({ a: [true, false], b: [false, false] }));
    const second = completedProjects(first.snapshot, tasksOf({ a: [true, true], b: [false, false] }));
    expect(second.completed).toEqual(['a']);
    const third = completedProjects(second.snapshot, tasksOf({ a: [true, true], b: [false, false] }));
    expect(third.completed).toEqual([]);
  });

  it('удаление последней невыполненной задачи — не празднуем', () => {
    const first = completedProjects(null, tasksOf({ a: [true, false] }));
    expect(completedProjects(first.snapshot, tasksOf({ a: [true] })).completed).toEqual([]);
  });

  it('«Отменить» удаление выполненной задачи в пустой проект — не празднуем', () => {
    // в проекте была одна выполненная задача; её удалили — проект пуст; «Отменить» вернул её
    const removed = completedProjects(null, tasksOf({ b: [false] }));
    const restored = completedProjects(removed.snapshot, tasksOf({ a: [true], b: [false] }));
    expect(restored.completed).toEqual([]);
  });

  it('условие «проект закрыт» — есть задачи и все выполнены', () => {
    expect(isProjectComplete({ done: 0, total: 0 })).toBe(false);
    expect(isProjectComplete({ done: 2, total: 3 })).toBe(false);
    expect(isProjectComplete({ done: 3, total: 3 })).toBe(true);
  });
});

import { dayHint, streakLabel } from './model';

describe('карта действий: подписи', () => {
  it('серия: «🔥 N дней подряд», 0 → «Начни серию сегодня»', () => {
    expect(streakLabel(0)).toBe('Начни серию сегодня');
    expect(streakLabel(1)).toBe('🔥 1 день подряд');
    expect(streakLabel(3)).toBe('🔥 3 дня подряд');
    expect(streakLabel(12)).toBe('🔥 12 дней подряд');
  });
  it('подсказка дня: «пн, 12 окт — закрыто 3»', () => {
    expect(dayHint('2026-10-12', 3)).toBe('пн, 12 окт — закрыто 3');
    expect(dayHint('2026-10-13', 0)).toBe('вт, 13 окт — закрыто 0');
  });
});

describe('привычки: подписи и разбивка', () => {
  const h = (id: string, days: number[]) => ({ id, name: id, emoji: '📖', color: '#7C5CFF', days, createdAt: 0 });

  it('расписание словами', () => {
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Каждый день');
    expect(daysLabel([0, 1, 2, 3, 4])).toBe('По будням');
    expect(daysLabel([5, 6])).toBe('По выходным');
    expect(daysLabel([0, 2, 4])).toBe('пн, ср, пт');
  });

  it('«Сегодня» — запланированные на сегодняшний день недели, остальные — отдельно; все ли отмечены', () => {
    // 2026-10-06 — вторник (1)
    const habits = [h('a', [1]), h('b', [0, 2]), h('c', [0, 1, 2, 3, 4, 5, 6])];
    const { today, rest } = splitHabits(habits, '2026-10-06');
    expect(today.map((x) => x.id)).toEqual(['a', 'c']);
    expect(rest.map((x) => x.id)).toEqual(['b']);
    expect(allHabitsDone(today, { a: ['2026-10-06'] }, '2026-10-06')).toBe(false);
    expect(allHabitsDone(today, { a: ['2026-10-06'], c: ['2026-10-05', '2026-10-06'] }, '2026-10-06')).toBe(true);
    expect(allHabitsDone([], {}, '2026-10-06')).toBe(false);
  });
});
