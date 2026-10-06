import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDue } from '../../dates';
import type { Project, Task, Theme } from '../../store/types';
import { tg } from '../../tg';
import { useEditor } from '../editor/TaskEditor';
import { useStore } from '../StoreContext';
import { Burst } from './Burst';
import { IconCheck } from './icons';

/** Тайминги отметки: галочка и частицы → карточка схлопывается → задача уходит в «Выполнено». */
const LEAVE_AT = 420;
const TOGGLE_AT = 680;

export type TaskCardProps = {
  task: Task;
  project?: Project;
  theme?: Theme;
  today: string;
  /** Показывать подпись проекта (на «Сроках» и в теме — да, внутри проекта — нет). */
  showProject?: boolean;
  /** Тап по карточке; по умолчанию открывает редактор задачи. */
  onOpen?(task: Task): void;
};

type Phase = 'idle' | 'checking' | 'leaving';

/** Карточка задачи: круглый чекбокс, название, пилюля темы, проект, срок. */
export function TaskCard({ task, project, theme, today, showProject = true, onOpen }: TaskCardProps) {
  const store = useStore();
  const editor = useEditor();
  const [phase, setPhase] = useState<Phase>('idle');
  const leaveTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const burstColor = theme?.color ?? project?.color ?? 'var(--accent-1)';
  const due = formatDue(task.due, today);
  const checked = task.done || phase !== 'idle';

  const onCheck = () => {
    if (task.done) {
      tg.haptic('light');
      store.toggleDone(task.id);
      return;
    }
    if (phase !== 'idle') return;
    tg.haptic('success');
    setPhase('checking');
    leaveTimer.current = window.setTimeout(() => setPhase('leaving'), LEAVE_AT);
    // Не отменяется при размонтировании: отметка должна дойти до стора, даже если экран сменили.
    window.setTimeout(() => store.toggleDone(task.id), TOGGLE_AT);
  };

  return (
    <div class={`task-wrap${phase === 'leaving' ? ' is-leaving' : ''}`}>
      <div class="task-wrap__inner">
        <article
          class={`task glass${task.done ? ' is-done' : ''}${phase !== 'idle' ? ' is-checking' : ''}${
            due.overdue && !checked ? ' is-overdue' : ''
          }`}
          style={`--burst:${burstColor}`}
        >
          <button
            class={`check${checked ? ' is-checked' : ''}`}
            role="checkbox"
            aria-checked={checked}
            aria-label={task.done ? 'Вернуть в работу' : 'Отметить выполненной'}
            onClick={onCheck}
          >
            <span class="check__ring">
              <IconCheck />
            </span>
            {phase !== 'idle' && <Burst />}
          </button>
          <button class="task__body" onClick={() => (onOpen ? onOpen(task) : editor.open(task))}>
            <span class="task__title">{task.title}</span>
            {task.note && <span class="task__note">{task.note}</span>}
            {(theme || (showProject && project) || due.text) && (
              <span class="task__meta">
                {theme && (
                  <span class="pill" style={`--pill:${theme.color}`}>
                    {theme.name}
                  </span>
                )}
                {showProject && project && (
                  <span class="task__project">
                    {project.emoji} {project.name}
                  </span>
                )}
                {due.text && <span class={`task__due${due.overdue ? ' is-overdue' : ''}`}>{due.text}</span>}
              </span>
            )}
          </button>
        </article>
      </div>
    </div>
  );
}
