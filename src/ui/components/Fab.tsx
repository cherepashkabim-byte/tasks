import { useEditor, type EditorPrefill } from '../editor/TaskEditor';
import { useNav, type Route } from '../nav';
import { useHabitForm } from '../sheets/habitForm';
import { IconPlus } from './icons';

/** Что подставить в новую задачу по текущему экрану: внутри проекта — проект, внутри темы — тему. */
export function contextPrefill(route: Route | null): EditorPrefill {
  if (!route) return {};
  switch (route.name) {
    case 'project':
      return { projectId: route.id };
    case 'theme':
      return { themeId: route.id };
  }
}

/** Плавающая кнопка «+» — видна на всех вкладках и вложенных экранах; на вкладке «Привычки» создаёт привычку. */
export function Fab() {
  const nav = useNav();
  const editor = useEditor();
  const habitForm = useHabitForm();
  const habits = !nav.current && nav.tab === 'habits';
  return (
    <button
      class="fab"
      aria-label={habits ? 'Новая привычка' : 'Новая задача'}
      onClick={() => (habits ? habitForm.open() : editor.open(contextPrefill(nav.current)))}
    >
      <IconPlus />
    </button>
  );
}
