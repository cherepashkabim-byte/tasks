import { addDays, BUCKET_TITLES, formatDate, groupTasks, type Bucket } from '../../dates';
import { ActivityMap } from '../components/ActivityMap';
import { EmptyState, Screen } from '../components/Screen';
import { TaskCards, TaskGroup } from '../components/TaskList';
import { useEditor } from '../editor/TaskEditor';
import { useToday } from '../hooks/useToday';
import { useAppState } from '../StoreContext';

/** Вкладка «Сроки»: активные задачи группами Просрочено / Сегодня / Завтра / На неделе / Позже / Без срока. */
export function DueScreen() {
  const { tasks, ready } = useAppState();
  const today = useToday();
  const editor = useEditor();
  const groups = groupTasks(tasks, today);
  const active = groups.reduce((n, g) => n + g.tasks.length, 0);

  const addFor = (b: Bucket) => {
    if (b === 'today') return () => editor.open({ due: today });
    if (b === 'tomorrow') return () => editor.open({ due: addDays(today, 1) });
    if (b === 'none') return () => editor.open({ due: null });
    return undefined;
  };

  const subtitle = `${capitalize(formatDate(today))}${active ? ` · активных: ${active}` : ''}`;

  return (
    <Screen title="Сроки" subtitle={subtitle}>
      {ready ? <ActivityMap /> : null}
      {groups.length === 0 ? (
        ready || tasks.length ? (
          tasks.length === 0 ? (
            <EmptyState emoji="✨" text="Здесь будут твои задачи. Нажми +, чтобы добавить первую" />
          ) : (
            <EmptyState emoji="🎉" text="Все задачи выполнены. Можно выдохнуть — или нажать +" />
          )
        ) : null
      ) : (
        groups.map(({ bucket, tasks: list }) => (
          <TaskGroup
            key={bucket}
            title={BUCKET_TITLES[bucket]}
            count={list.length}
            tone={bucket === 'overdue' ? 'danger' : bucket === 'today' ? 'accent' : undefined}
            onAdd={addFor(bucket)}
          >
            <TaskCards tasks={list} today={today} />
          </TaskGroup>
        ))
      )}
    </Screen>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
