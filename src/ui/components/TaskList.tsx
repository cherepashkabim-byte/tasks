import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { compareByDue } from '../../dates';
import type { Project, Task, Theme } from '../../store/types';
import { tg } from '../../tg';
import { useToday } from '../hooks/useToday';
import { useAppState } from '../StoreContext';
import { IconChevron, IconPlus } from './icons';
import { TaskCard } from './TaskCard';

/** Справочники проектов и тем по id — для подписей на карточках. */
export function useTaskLookup() {
  const { projects, themes } = useAppState();
  return useMemo(
    () => ({
      project: new Map<string, Project>(projects.map((p) => [p.id, p])),
      theme: new Map<string, Theme>(themes.map((t) => [t.id, t])),
    }),
    [projects, themes],
  );
}

type CardsProps = { tasks: Task[]; showProject?: boolean; today?: string };

/** Просто столбик карточек в заданном порядке. */
export function TaskCards({ tasks, showProject = true, today }: CardsProps) {
  const lookup = useTaskLookup();
  const now = useToday();
  return (
    <div class="task-cards">
      {tasks.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          project={lookup.project.get(t.projectId)}
          theme={t.themeId ? lookup.theme.get(t.themeId) : undefined}
          today={today ?? now}
          showProject={showProject}
        />
      ))}
    </div>
  );
}

type GroupProps = {
  title: string;
  count?: number;
  tone?: 'danger' | 'accent';
  /** Кнопка «+» в заголовке группы. */
  onAdd?(): void;
  children: ComponentChildren;
};

/** Группа задач с заголовком (например «Сегодня» на экране «Сроки»). */
export function TaskGroup({ title, count, tone, onAdd, children }: GroupProps) {
  return (
    <section class={`group${tone ? ` group--${tone}` : ''}`}>
      <header class="group__head">
        <h2 class="group__title">{title}</h2>
        {count !== undefined && <span class="group__count">{count}</span>}
        {onAdd && (
          <button class="group__add" aria-label={`Добавить задачу: ${title}`} onClick={onAdd}>
            <IconPlus />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

type ListProps = {
  /** Все задачи экрана — активные и выполненные; список сам их разделит. */
  tasks: Task[];
  showProject?: boolean;
  /** Что показать, когда активных задач нет. */
  empty?: ComponentChildren;
  /** Действия внутри раскрытого блока «Выполнено» (например «Очистить выполненные»). */
  doneActions?: ComponentChildren;
};

/** Активные задачи по сроку + свёрнутый блок «Выполнено (N)». */
export function TaskList({ tasks, showProject = true, empty, doneActions }: ListProps) {
  const [showDone, setShowDone] = useState(false);
  const active = useMemo(() => tasks.filter((t) => !t.done).sort(compareByDue), [tasks]);
  const done = useMemo(
    () => tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    [tasks],
  );

  return (
    <div class="task-list">
      {active.length ? <TaskCards tasks={active} showProject={showProject} /> : empty}
      {done.length > 0 && (
        <section class={`done-block${showDone ? ' is-open' : ''}`}>
          <button
            class="done-block__toggle"
            aria-expanded={showDone}
            onClick={() => {
              tg.haptic('selection');
              setShowDone((v) => !v);
            }}
          >
            <span class="done-block__chev">
              <IconChevron />
            </span>
            Выполнено ({done.length})
          </button>
          {showDone && (
            <div class="done-block__body">
              <TaskCards tasks={done} showProject={showProject} />
              {doneActions && <div class="done-block__actions">{doneActions}</div>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
