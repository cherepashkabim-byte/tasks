import { isNearStorageLimit, storageKeyCount } from '../../store';
import type { Project } from '../../store/types';
import { tg } from '../../tg';
import { IconChevron, IconPlus, IconWarning } from '../components/icons';
import { ProgressBar } from '../components/Progress';
import { EmptyState, Screen } from '../components/Screen';
import { useConfirm } from '../hooks/useConfirm';
import { useNav } from '../nav';
import { useAppState, useStore } from '../StoreContext';
import { useToast } from '../toast';
import { ProjectForm } from './forms';
import { useSheetSession } from '../sheets/session';
import { isProjectComplete, plural, progressLabel, progressPercent, projectProgress, type Progress } from './model';

/** Вкладка «Проекты»: стеклянные карточки с эмодзи, цветом и прогрессом «N из M». */
export function ProjectsScreen() {
  const state = useAppState();
  const nav = useNav();
  const form = useSheetSession<Project>();
  const { projects, tasks, ready } = state;

  return (
    <Screen
      title="Проекты"
      subtitle={projects.length ? `${projects.length} ${plural(projects.length, ['проект', 'проекта', 'проектов'])}` : undefined}
      actions={
        <button class="icon-btn icon-btn--accent" aria-label="Новый проект" onClick={() => form.show()}>
          <IconPlus />
        </button>
      }
    >
      {isNearStorageLimit(state) && <StorageWarning />}
      {projects.length === 0 && ready ? (
        <EmptyState emoji="📁" text="Проектов пока нет. Нажми + вверху, чтобы создать первый" />
      ) : (
        <div class="cards">
          {projects.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              progress={projectProgress(tasks, p.id)}
              index={i}
              onOpen={() => {
                tg.haptic('light');
                nav.push({ name: 'project', id: p.id });
              }}
            />
          ))}
        </div>
      )}
      {form.session && (
        <ProjectForm key={form.session.key} open={form.open} item={form.session.item} onClose={form.close} />
      )}
    </Screen>
  );
}

function ProjectCard({
  project,
  progress,
  index,
  onOpen,
}: {
  project: Project;
  progress: Progress;
  index: number;
  onOpen(): void;
}) {
  const complete = isProjectComplete(progress);
  return (
    <button
      class={`pcard glass${complete ? ' is-complete' : ''}`}
      style={`--sw:${project.color}; --i:${Math.min(index, 10)}`}
      onClick={onOpen}
    >
      <span class="pcard__badge">{project.emoji}</span>
      <span class="pcard__body">
        <span class="pcard__top">
          <span class="pcard__name">{project.name}</span>
          <span class="pcard__count">{progressLabel(progress)}</span>
          <span class="pcard__pct">{progressPercent(progress)}%</span>
        </span>
        <ProgressBar progress={progress} color={project.color} />
      </span>
      <span class="pcard__chev">
        <IconChevron />
      </span>
    </button>
  );
}

/** Предупреждение о пределе облака Telegram (>900 задач) с очисткой выполненных во всех проектах. */
function StorageWarning() {
  const store = useStore();
  const toast = useToast();
  const state = useAppState();
  const { projects, tasks } = state;
  const confirm = useConfirm();
  const doneCount = tasks.filter((t) => t.done).length;

  const clear = () =>
    confirm.tap(() => {
      const n = projects.reduce((sum, p) => sum + store.clearDone(p.id), 0);
      tg.haptic('success');
      toast.show({ text: `Удалено выполненных: ${n}` });
    });

  return (
    <div class="warn glass">
      <div class="warn__icon">
        <IconWarning />
      </div>
      <div class="warn__body">
        <div class="warn__title">Хранилище почти заполнено</div>
        <div class="warn__text">
          Занято {storageKeyCount(state)} записей из примерно 1000 в облаке Telegram. Очисти выполненные задачи,
          чтобы освободить место.
        </div>
        {doneCount > 0 && (
          <button class={`warn__btn${confirm.armed ? ' is-armed' : ''}`} onClick={clear}>
            {confirm.armed ? `Точно удалить ${doneCount}?` : `Очистить выполненные (${doneCount})`}
          </button>
        )}
      </div>
    </div>
  );
}
