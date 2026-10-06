import { describe, expect, it } from 'vitest';
import { canSave, initialDraft, limitCounter, monthGrid, quickDue } from './form';

describe('форма задачи: валидация', () => {
  it('пустое и пробельное название сохранить нельзя', () => {
    expect(canSave('')).toBe(false);
    expect(canSave('   \n\t ')).toBe(false);
    expect(canSave(' Купить хлеб ')).toBe(true);
  });

  it('название длиннее 200 символов сохранить нельзя', () => {
    expect(canSave('a'.repeat(200))).toBe(true);
    expect(canSave('a'.repeat(201))).toBe(false);
  });

  it('название проекта/темы проверяется своим лимитом 60', () => {
    expect(canSave('a'.repeat(60), 60)).toBe(true);
    expect(canSave('a'.repeat(61), 60)).toBe(false);
    expect(canSave('  ', 60)).toBe(false);
  });

  it('счётчик появляется только при приближении к лимиту', () => {
    expect(limitCounter(10, 200)).toBeNull();
    expect(limitCounter(149, 200)).toBeNull();
    expect(limitCounter(150, 200)).toBe('150/200');
    expect(limitCounter(1000, 1000)).toBe('1000/1000');
  });
});

describe('форма задачи: срок и предзаполнение', () => {
  it('быстрые кнопки срока ставят правильную дату, «Без срока» снимает её', () => {
    expect(quickDue('today', '2026-10-06')).toBe('2026-10-06');
    expect(quickDue('tomorrow', '2026-10-06')).toBe('2026-10-07');
    expect(quickDue('week', '2026-10-06')).toBe('2026-10-13');
    expect(quickDue('week', '2026-12-28')).toBe('2027-01-04');
    expect(quickDue('none', '2026-10-06')).toBeNull();
  });

  it('новая задача без контекста — во «Входящие», без темы и срока', () => {
    expect(initialDraft(undefined, 'inbox')).toEqual({
      title: '',
      note: '',
      projectId: 'inbox',
      themeId: null,
      due: null,
    });
  });

  it('предзаполнение подставляет тему, проект и срок', () => {
    expect(initialDraft({ themeId: 'th1', due: '2026-10-06' }, 'inbox')).toEqual({
      title: '',
      note: '',
      projectId: 'inbox',
      themeId: 'th1',
      due: '2026-10-06',
    });
    expect(initialDraft({ projectId: 'p1' }, 'inbox').projectId).toBe('p1');
  });

  it('правка существующей задачи открывается с её полями', () => {
    const task = {
      id: 't1',
      title: 'Позвонить',
      note: 'маме',
      projectId: 'p2',
      themeId: 'th2',
      due: '2026-10-09',
      done: false,
      doneAt: null,
      createdAt: 1,
    };
    expect(initialDraft(task, 'inbox')).toEqual({
      title: 'Позвонить',
      note: 'маме',
      projectId: 'p2',
      themeId: 'th2',
      due: '2026-10-09',
    });
  });
});

describe('календарь', () => {
  it('октябрь 2026: неделя с понедельника, 1-е — четверг', () => {
    const g = monthGrid(2026, 9);
    expect(g).toHaveLength(5);
    expect(g[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(g[4]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
  });

  it('февраль 2027 ровно в 4 недели', () => {
    const g = monthGrid(2027, 1);
    expect(g).toHaveLength(4);
    expect(g[0][0]).toBe('2027-02-01');
    expect(g[3][6]).toBe('2027-02-28');
  });
});
