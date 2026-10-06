import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Project } from '../../store/types';
import { tg } from '../../tg';
import { IconEdit } from '../components/icons';
import { ProjectProgress } from '../components/Progress';
import { EmptyState, Screen } from '../components/Screen';
import { TaskList } from '../components/TaskList';
import { useConfirm } from '../hooks/useConfirm';
import { useNav } from '../nav';
import { useAppState, useStore } from '../StoreContext';
import { useToast } from '../toast';
import { ProjectForm } from './forms';
import { useSheetSession } from '../sheets/session';
import { filterByTheme, progressLabel, projectProgress, projectThemes } from './model';

/** Экран проекта: чипы тем для фильтра, активные задачи, свёрнутый блок «Выполнено» с очисткой. */
export function ProjectScreen({ id }: { id: string }) {
  const { projects, themes, tasks } = useAppState();
  const nav = useNav();
  const form = useSheetSession<Project>();
  const project = projects.find((p) => p.id === id);
  const [themeId, setThemeId] = useState<string | null>(null);

  const own = useMemo(() => tasks.filter((t) => t.projectId === id), [tasks, id]);
  const chips = useMemo(() => projectThemes(tasks, themes, id), [tasks, themes, id]);
  // Выбранная тема пропала (удалили или сняли со всех задач) — сбрасываем фильтр.
  const filter = themeId && chips.some((t) => t.id === themeId) ? themeId : null;
  const shown = useMemo(() => filterByTheme(own, filter), [own, filter]);

  // Проект удалили (например, с другого устройства) — уходим назад.
  useEffect(() => {
    const top = nav.current;
    if (!project && top?.name === 'project' && top.id === id) nav.pop();
  }, [project, nav.current]);
  if (!project) return null;

  const progress = projectProgress(tasks, id);
  const filterName = filter ? chips.find((t) => t.id === filter)?.name : null;

  return (
    <Screen
      title={`${project.emoji} ${project.name}`}
      subtitle={progress.total ? `Выполнено ${progressLabel(progress)}` : 'Пока без задач'}
      back
      actions={
        <button class="icon-btn" aria-label="Изменить проект" onClick={() => form.show(project)}>
          <IconEdit />
        </button>
      }
    >
      <ProjectProgress progress={progress} color={project.color} />
      {chips.length > 0 && (
        <div class="chips filter-chips" role="tablist" aria-label="Фильтр по теме">
          <button
            class={`chip${filter === null ? ' is-on' : ''}`}
            role="tab"
            aria-selected={filter === null}
            onClick={() => {
              tg.haptic('selection');
              setThemeId(null);
            }}
          >
            Все
          </button>
          {chips.map((t) => (
            <button
              key={t.id}
              class={`chip chip--theme${filter === t.id ? ' is-on' : ''}`}
              style={`--chip:${t.color}`}
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => {
                tg.haptic('selection');
                setThemeId(filter === t.id ? null : t.id);
              }}
            >
              <span class="chip__dot" />
              {t.name}
            </button>
          ))}
        </div>
      )}
      <TaskList
        key={filter ?? 'all'}
        tasks={shown}
        showProject={false}
        empty={
          own.length === 0 ? (
            <EmptyState emoji="📝" text="В проекте пока нет задач. Нажми +, чтобы добавить" />
          ) : filterName ? (
            <EmptyState emoji="🔍" text={`Нет активных задач с темой «${filterName}»`} />
          ) : (
            <EmptyState emoji="🎉" text="Все задачи проекта выполнены" />
          )
        }
        doneActions={<ClearDone projectId={id} />}
      />
      {form.session && (
        <ProjectForm
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

/** «Очистить выполненные» с подтверждением вторым касанием. */
function ClearDone({ projectId }: { projectId: string }) {
  const store = useStore();
  const toast = useToast();
  const confirm = useConfirm();

  return (
    <button
      class={`clear-btn${confirm.armed ? ' is-armed' : ''}`}
      onClick={() =>
        confirm.tap(() => {
          const n = store.clearDone(projectId);
          tg.haptic('success');
          toast.show({ text: `Удалено выполненных: ${n}` });
        })
      }
    >
      {confirm.armed ? 'Точно очистить? Нажми ещё раз' : 'Очистить выполненные'}
    </button>
  );
}
