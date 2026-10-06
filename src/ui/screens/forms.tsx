import { useEffect, useRef, useState } from 'preact/hooks';
import { ALL_DAYS, NAME_MAX, PALETTE } from '../../store';
import type { Habit, Project, Theme } from '../../store/types';
import { tg } from '../../tg';
import { IconCheck, IconTrash } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { useConfirm } from '../hooks/useConfirm';
import { canSave } from '../editor/form';
import { useAppState, useStore } from '../StoreContext';
import { useToast } from '../toast';
import { deleteProjectQuestion, HABIT_EMOJI, PROJECT_EMOJI } from './model';
import { WEEKDAY_SHORT } from '../../dates';
import type { SheetFormProps } from '../sheets/session';


function ColorPicker({ value, onPick }: { value: string; onPick(hex: string): void }) {
  return (
    <div class="swatches" role="radiogroup" aria-label="Цвет">
      {PALETTE.map((c) => {
        const on = c.hex.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c.hex}
            role="radio"
            aria-checked={on}
            aria-label={c.name}
            class={`swatch${on ? ' is-on' : ''}`}
            style={`--sw:${c.hex}`}
            onClick={() => {
              tg.haptic('selection');
              onPick(c.hex);
            }}
          >
            <IconCheck />
          </button>
        );
      })}
    </div>
  );
}

type EmojiPickerProps = { value: string; color: string; options?: readonly string[]; onPick(e: string): void };

function EmojiPicker({ value, color, options = PROJECT_EMOJI, onPick }: EmojiPickerProps) {
  return (
    <div class="emoji-grid" role="radiogroup" aria-label="Эмодзи">
      {options.map((e) => (
        <button
          key={e}
          role="radio"
          aria-checked={value === e}
          class={`emoji-opt${value === e ? ' is-on' : ''}`}
          style={`--sw:${color}`}
          onClick={() => {
            tg.haptic('selection');
            onPick(e);
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

type NameFieldProps = {
  value: string;
  placeholder: string;
  autoFocus: boolean;
  onInput(v: string): void;
  onEnter(): void;
};

function NameField({ value, placeholder, autoFocus, onInput, onEnter }: NameFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, []);
  return (
    <input
      ref={ref}
      class="form-name"
      type="text"
      placeholder={placeholder}
      maxLength={NAME_MAX}
      value={value}
      enterKeyHint="done"
      onInput={(e) => onInput(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}

type FooterProps = {
  canDelete: boolean;
  question: string;
  saveLabel: string;
  saveDisabled: boolean;
  onSave(): void;
  onDelete(): void;
};

/** Низ шторки: корзина + «Сохранить». Первый тап по корзине — вопрос «Удалить …?» на всю ширину, второй — удаление; через 3 с сброс. */
function FormFooter({ canDelete, question, saveLabel, saveDisabled, onSave, onDelete }: FooterProps) {
  const confirm = useConfirm();
  return (
    <>
      {canDelete && (
        <button
          class={`sheet-btn--danger${confirm.armed ? ' is-armed is-wide' : ''}`}
          aria-label={confirm.armed ? question : 'Удалить'}
          onClick={() =>
            confirm.tap(() => {
              tg.haptic('heavy');
              onDelete();
            })
          }
        >
          <IconTrash />
          {confirm.armed && <span>{question}</span>}
        </button>
      )}
      {!confirm.armed && (
        <button class="btn-accent sheet-btn--save" disabled={saveDisabled} onClick={onSave}>
          {saveLabel}
        </button>
      )}
    </>
  );
}

const validName = (name: string) => canSave(name, NAME_MAX);

type FormProps<T> = SheetFormProps<T>;

/** Шторка создания/правки проекта: название, эмодзи, цвет; удаление с подтверждением «Удалить проект и N задач?». */
export function ProjectForm({ open, item, onClose, onDeleted }: FormProps<Project>) {
  const store = useStore();
  const toast = useToast();
  const { projects, tasks } = useAppState();
  const [name, setName] = useState(item?.name ?? '');
  const [emoji, setEmoji] = useState<string>(item?.emoji ?? PROJECT_EMOJI[0]);
  const [color, setColor] = useState(item?.color ?? PALETTE[projects.length % PALETTE.length].hex);
  const taskCount = item ? tasks.filter((t) => t.projectId === item.id).length : 0;

  const save = () => {
    if (!validName(name)) return;
    if (item) store.updateProject(item.id, { name, emoji, color });
    else store.addProject({ name, emoji, color });
    tg.haptic('success');
    onClose();
  };

  const remove = () => {
    if (!item) return;
    onClose();
    onDeleted?.();
    if (store.removeProject(item.id)) toast.show({ text: `Проект «${item.name}» удалён` });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? 'Проект' : 'Новый проект'}
      footer={
        <FormFooter
          canDelete={!!item && !item.inbox}
          question={deleteProjectQuestion(taskCount)}
          saveLabel={item ? 'Сохранить' : 'Создать проект'}
          saveDisabled={!validName(name)}
          onSave={save}
          onDelete={remove}
        />
      }
    >
      <div class="form-head" style={`--sw:${color}`}>
        <span class="form-head__badge">{emoji}</span>
        <NameField value={name} placeholder="Название проекта" autoFocus={!item} onInput={setName} onEnter={save} />
      </div>
      {item?.inbox && <div class="ed-hint">«Входящие» нельзя удалить — сюда попадают задачи без проекта</div>}
      <div class="ed-section">
        <div class="ed-label">Эмодзи</div>
        <EmojiPicker value={emoji} color={color} onPick={setEmoji} />
      </div>
      <div class="ed-section">
        <div class="ed-label">Цвет</div>
        <ColorPicker value={color} onPick={setColor} />
      </div>
    </Sheet>
  );
}

/** Шторка создания/правки темы: название и цвет; удаление снимает метку, задачи остаются. */
export function ThemeForm({ open, item, onClose, onDeleted }: FormProps<Theme>) {
  const store = useStore();
  const toast = useToast();
  const { themes } = useAppState();
  const [name, setName] = useState(item?.name ?? '');
  const [color, setColor] = useState(item?.color ?? PALETTE[themes.length % PALETTE.length].hex);

  const save = () => {
    if (!validName(name)) return;
    if (item) store.updateTheme(item.id, { name, color });
    else store.addTheme({ name, color });
    tg.haptic('success');
    onClose();
  };

  const remove = () => {
    if (!item) return;
    onClose();
    onDeleted?.();
    store.removeTheme(item.id);
    toast.show({ text: `Тема «${item.name}» удалена, задачи остались` });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? 'Тема' : 'Новая тема'}
      footer={
        <FormFooter
          canDelete={!!item}
          question="Удалить тему? Задачи останутся, метка с них снимется"
          saveLabel={item ? 'Сохранить' : 'Создать тему'}
          saveDisabled={!validName(name)}
          onSave={save}
          onDelete={remove}
        />
      }
    >
      <div class="form-head" style={`--sw:${color}`}>
        <span class="form-head__dot" />
        <NameField value={name} placeholder="Название темы" autoFocus={!item} onInput={setName} onEnter={save} />
      </div>
      <div class="ed-section">
        <div class="ed-label">Цвет</div>
        <ColorPicker value={color} onPick={setColor} />
      </div>
    </Sheet>
  );
}

/** Дни недели чипами пн–вс; последний выбранный день снять нельзя. */
type DayChipsProps = { value: number[]; color: string; onChange(update: (days: number[]) => number[]): void };

function DayChips({ value, color, onChange }: DayChipsProps) {
  return (
    <div class="day-chips" role="group" aria-label="Дни недели">
      {ALL_DAYS.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            class={`day-chip${on ? ' is-on' : ''}`}
            style={`--sw:${color}`}
            aria-pressed={on}
            onClick={() => {
              if (on && value.length === 1) {
                tg.haptic('warning');
                return;
              }
              tg.haptic('selection');
              onChange((cur) =>
                cur.includes(d)
                  ? cur.length > 1
                    ? cur.filter((x) => x !== d)
                    : cur
                  : [...cur, d].sort((a, b) => a - b),
              );
            }}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

/** Шторка создания/правки привычки: название, эмодзи, цвет, дни недели; удаление историю карты не стирает. */
export function HabitForm({ open, item, onClose }: FormProps<Habit>) {
  const store = useStore();
  const toast = useToast();
  const { habits } = useAppState();
  const [name, setName] = useState(item?.name ?? '');
  const [emoji, setEmoji] = useState<string>(item?.emoji ?? HABIT_EMOJI[1]);
  const [color, setColor] = useState(item?.color ?? PALETTE[habits.length % PALETTE.length].hex);
  const [days, setDays] = useState<number[]>(item?.days ?? [...ALL_DAYS]);

  const save = () => {
    if (!validName(name) || !days.length) return;
    if (item) store.updateHabit(item.id, { name, emoji, color, days });
    else store.addHabit({ name, emoji, color, days });
    tg.haptic('success');
    onClose();
  };

  const remove = () => {
    if (!item) return;
    onClose();
    store.removeHabit(item.id);
    toast.show({ text: `Привычка «${item.name}» удалена` });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? 'Привычка' : 'Новая привычка'}
      footer={
        <FormFooter
          canDelete={!!item}
          question="Удалить привычку? Карта действий сохранится"
          saveLabel={item ? 'Сохранить' : 'Создать привычку'}
          saveDisabled={!validName(name) || !days.length}
          onSave={save}
          onDelete={remove}
        />
      }
    >
      <div class="form-head" style={`--sw:${color}`}>
        <span class="form-head__badge">{emoji}</span>
        <NameField value={name} placeholder="Например, чтение" autoFocus={!item} onInput={setName} onEnter={save} />
      </div>
      <div class="ed-section">
        <div class="ed-label">Дни недели</div>
        <DayChips value={days} color={color} onChange={setDays} />
      </div>
      <div class="ed-section">
        <div class="ed-label">Эмодзи</div>
        <EmojiPicker value={emoji} color={color} options={HABIT_EMOJI} onPick={setEmoji} />
      </div>
      <div class="ed-section">
        <div class="ed-label">Цвет</div>
        <ColorPicker value={color} onPick={setColor} />
      </div>
    </Sheet>
  );
}
