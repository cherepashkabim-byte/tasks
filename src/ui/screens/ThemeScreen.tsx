import { useEffect, useMemo } from 'preact/hooks';
import type { Theme } from '../../store/types';
import { IconEdit } from '../components/icons';
import { EmptyState, Screen } from '../components/Screen';
import { TaskList } from '../components/TaskList';
import { useNav } from '../nav';
import { useAppState } from '../StoreContext';
import { ThemeForm } from './forms';
import { useSheetSession } from '../sheets/session';
import { activeByTheme, filterByTheme, plural } from './model';

/** Экран темы: все её задачи из всех проектов, у каждой подпись проекта. */
export function ThemeScreen({ id }: { id: string }) {
  const { themes, tasks } = useAppState();
  const nav = useNav();
  const form = useSheetSession<Theme>();
  const theme = themes.find((t) => t.id === id);
  const own = useMemo(() => filterByTheme(tasks, id), [tasks, id]);
  const active = activeByTheme(own).get(id) ?? 0;

  useEffect(() => {
    const top = nav.current;
    if (!theme && top?.name === 'theme' && top.id === id) nav.pop();
  }, [theme, nav.current]);
  if (!theme) return null;

  return (
    <Screen
      title={theme.name}
      subtitle={active ? `${active} ${plural(active, ['активная задача', 'активные задачи', 'активных задач'])}` : undefined}
      back
      actions={
        <button class="icon-btn" aria-label="Изменить тему" onClick={() => form.show(theme)}>
          <IconEdit />
        </button>
      }
    >
      <div class="theme-hero" style={`--sw:${theme.color}`} aria-hidden="true" />
      <TaskList
        tasks={own}
        showProject
        empty={
          own.length === 0 ? (
            <EmptyState emoji="🏷️" text="С этой темой пока нет задач. Нажми +, чтобы добавить" />
          ) : (
            <EmptyState emoji="🎉" text="Все задачи темы выполнены" />
          )
        }
      />
      {form.session && (
        <ThemeForm
          key={form.session.key}
          open={form.open}
          item={form.session.item}
          onClose={form.close}
          onDeleted={nav.pop}
        />
      )}
    </Screen>
  );
}
