import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatDate } from '../../dates';
import type { Task } from '../../store/types';
import { tg } from '../../tg';
import { Sheet } from '../components/Sheet';
import { IconCalendar, IconTrash } from '../components/icons';
import { useConfirm } from '../hooks/useConfirm';
import { useToday } from '../hooks/useToday';
import { useAppState, useStore } from '../StoreContext';
import { useToast } from '../toast';
import { useSheetSession } from '../sheets/session';
import { Calendar } from './Calendar';
import {
  canSave,
  initialDraft,
  limitCounter,
  NOTE_MAX,
  quickDue,
  TITLE_MAX,
  type EditorPrefill,
  type QuickDue,
  type TaskDraft,
} from './form';

export type { EditorPrefill };

type EditorApi = {
  /** Открыть шторку: без аргумента или с предзаполнением — новая задача; с задачей — правка. */
  open(source?: EditorPrefill | Task): void;
  close(): void;
};

const Ctx = createContext<EditorApi | null>(null);

/** Держит одну шторку редактора задачи на всё приложение. */
export function EditorProvider({ children }: { children: ComponentChildren }) {
  const sheet = useSheetSession<EditorPrefill | Task>();
  const { show, close } = sheet;
  const api = useMemo<EditorApi>(() => ({ open: (source) => show(source), close }), [show, close]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {sheet.session && (
        <TaskEditor key={sheet.session.key} source={sheet.session.item} open={sheet.open} onClose={close} />
      )}
    </Ctx.Provider>
  );
}

export function useEditor(): EditorApi {
  const e = useContext(Ctx);
  if (!e) throw new Error('useEditor вне EditorProvider');
  return e;
}

const QUICK: { kind: QuickDue; label: string }[] = [
  { kind: 'today', label: 'Сегодня' },
  { kind: 'tomorrow', label: 'Завтра' },
  { kind: 'week', label: 'Через неделю' },
  { kind: 'none', label: 'Без срока' },
];

function isTask(x: EditorPrefill | Task | undefined): x is Task {
  return !!x && typeof (x as Task).id === 'string';
}

type EditorProps = { source?: EditorPrefill | Task; open: boolean; onClose(): void };

/** Нижняя шторка: название, заметка, проект, тема, срок. */
function TaskEditor({ source, open, onClose }: EditorProps) {
  const store = useStore();
  const toast = useToast();
  const { projects, themes } = useAppState();
  const today = useToday();
  const editing = isTask(source) ? source : null;

  const [draft, setDraft] = useState<TaskDraft>(() => initialDraft(source, store.inboxId()));
  const [calendar, setCalendar] = useState(false);
  const confirmDelete = useConfirm();
  const titleRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const set = (patch: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // Новая задача — сразу фокус в названии (клавиатура поднимается вместе со шторкой).
  useEffect(() => {
    if (!editing) titleRef.current?.focus();
  }, []);

  // Заметка растёт по содержимому.
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.note]);

  const valid = canSave(draft.title);

  const save = useCallback(() => {
    if (!canSave(draft.title)) return;
    if (editing) store.updateTask(editing.id, draft);
    else store.addTask(draft);
    tg.haptic('success');
    onClose();
  }, [draft, editing, store, onClose]);

  const remove = () => {
    if (!editing) return;
    confirmDelete.tap(() => {
      const removed = store.removeTask(editing.id);
      tg.haptic('heavy');
      onClose();
      if (removed) {
        toast.show({
          text: 'Задача удалена',
          duration: 5000,
          action: { label: 'Отменить', onClick: () => store.restoreTask(removed) },
        });
      }
    });
  };

  const titleCounter = limitCounter(draft.title.length, TITLE_MAX);
  const noteCounter = limitCounter(draft.note.length, NOTE_MAX);
  const activeQuick = QUICK.find((q) => quickDue(q.kind, today) === draft.due)?.kind;

  const footer = (
    <>
      {editing && (
        <button
          class={`sheet-btn sheet-btn--danger${confirmDelete.armed ? ' is-armed' : ''}`}
          onClick={remove}
          aria-label="Удалить задачу"
        >
          <IconTrash />
          {confirmDelete.armed && <span>Точно удалить?</span>}
        </button>
      )}
      <button class="btn-accent sheet-btn--save" disabled={!valid} onClick={save}>
        {editing ? 'Сохранить' : 'Добавить задачу'}
      </button>
    </>
  );

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Задача' : 'Новая задача'} footer={footer}>
      <div class="ed-field ed-field--title">
        <input
          ref={titleRef}
          class="ed-title"
          type="text"
          placeholder="Что нужно сделать?"
          maxLength={TITLE_MAX}
          value={draft.title}
          enterKeyHint="done"
          onInput={(e) => set({ title: e.currentTarget.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.isComposing) {
              e.preventDefault();
              save();
            }
          }}
        />
        {titleCounter && <span class="ed-counter">{titleCounter}</span>}
      </div>
      <div class="ed-field">
        <textarea
          ref={noteRef}
          class="ed-note"
          rows={2}
          placeholder="Заметка"
          maxLength={NOTE_MAX}
          value={draft.note}
          onInput={(e) => set({ note: e.currentTarget.value })}
        />
        {noteCounter && <span class="ed-counter">{noteCounter}</span>}
      </div>

      <div class="ed-section">
        <div class="ed-label">Проект</div>
        <div class="chips">
          {projects.map((p) => (
            <button
              key={p.id}
              class={`chip${draft.projectId === p.id ? ' is-on' : ''}`}
              style={`--chip:${p.color}`}
              onClick={() => {
                tg.haptic('selection');
                set({ projectId: p.id });
              }}
            >
              <span class="chip__emoji">{p.emoji}</span>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div class="ed-section">
        <div class="ed-label">Тема</div>
        <div class="chips">
          <button
            class={`chip${draft.themeId === null ? ' is-on' : ''}`}
            onClick={() => {
              tg.haptic('selection');
              set({ themeId: null });
            }}
          >
            Без темы
          </button>
          {themes.map((t) => (
            <button
              key={t.id}
              class={`chip chip--theme${draft.themeId === t.id ? ' is-on' : ''}`}
              style={`--chip:${t.color}`}
              onClick={() => {
                tg.haptic('selection');
                set({ themeId: t.id });
              }}
            >
              <span class="chip__dot" />
              {t.name}
            </button>
          ))}
          {themes.length === 0 && <span class="ed-hint">Темы появятся во вкладке «Темы»</span>}
        </div>
      </div>

      <div class="ed-section">
        <div class="ed-label">
          Срок
          {draft.due && <span class="ed-label__value">{formatDate(draft.due, today)}</span>}
        </div>
        <div class="chips chips--wrap">
          {QUICK.map((q) => (
            <button
              key={q.kind}
              class={`chip${activeQuick === q.kind ? ' is-on' : ''}`}
              onClick={() => {
                tg.haptic('selection');
                set({ due: quickDue(q.kind, today) });
                setCalendar(false);
              }}
            >
              {q.label}
            </button>
          ))}
          <button
            class={`chip chip--icon${calendar || (draft.due && !activeQuick) ? ' is-on' : ''}`}
            aria-label="Выбрать дату в календаре"
            aria-expanded={calendar}
            onClick={() => {
              tg.haptic('selection');
              setCalendar((c) => !c);
            }}
          >
            <IconCalendar />
          </button>
        </div>
        {calendar && (
          <Calendar
            value={draft.due}
            today={today}
            onPick={(iso) => {
              tg.haptic('selection');
              set({ due: iso });
            }}
          />
        )}
      </div>
    </Sheet>
  );
}
