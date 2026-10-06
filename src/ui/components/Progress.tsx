import { useEffect, useRef, useState } from 'preact/hooks';
import { PALETTE } from '../../store';
import { tg } from '../../tg';
import { useNav } from '../nav';
import { completedProjects, isProjectComplete, justCompleted, motivation, progressPercent, type Progress, type ProgressSnapshot } from '../screens/model';
import { useStore } from '../StoreContext';
import { useToast } from '../toast';
import { confetti, reducedMotion } from './confetti';

const COUNT_MS = 700;

/** Полоска прогресса проекта: заливка градиентом цвета проекта, плавно доезжает до нового значения. */
export function ProgressBar({ progress, color, size = 'sm' }: { progress: Progress; color: string; size?: 'sm' | 'lg' }) {
  const pct = progressPercent(progress);
  return (
    <span
      class={`pbar pbar--${size}`}
      style={`--sw:${color}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <span class="pbar__fill" style={`transform: scaleX(${pct / 100})`} />
    </span>
  );
}

/** Число, которое «набегает» от прежнего значения к новому. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value || reducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min((now - t0) / COUNT_MS, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start + (value - start) * eased);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown}</>;
}

/** Крупная шкала «NN%» на экране проекта с мотивирующей фразой; салют в момент перехода к 100%. */
export function ProjectProgress({ progress, color }: { progress: Progress; color: string }) {
  const pct = progressPercent(progress);
  const phrase = motivation(progress);
  const prev = useRef<Progress | null>(null);
  const [party, setParty] = useState(false);

  useEffect(() => {
    // Салют и haptic запускает ProjectCelebration (на любом экране); здесь — только акцент на числе.
    if (justCompleted(prev.current, progress)) {
      setParty(true);
    } else if (progress.done !== progress.total || progress.total === 0) {
      setParty(false);
    }
    prev.current = progress;
  }, [progress.done, progress.total]);

  const complete = isProjectComplete(progress);

  return (
    <section class={`pprog glass${complete ? ' is-complete' : ''}${party ? ' is-party' : ''}`} style={`--sw:${color}`}>
      <div class="pprog__top">
        <div class="pprog__pct" aria-label={`Выполнено ${pct}%`}>
          <CountUp value={pct} />
          <span class="pprog__sign">%</span>
        </div>
        <div key={phrase} class="pprog__phrase" aria-live="polite">
          {phrase}
        </div>
      </div>
      <ProgressBar progress={progress} color={color} size="lg" />
    </section>
  );
}

/** Празднует закрытие проекта на любом экране: отметка задачи довела проект до 100% → салют, haptic success,
    тост «Проект закрыт 🎉» (на экране этого проекта тоста нет — там фраза под шкалой). Один раз на переход. */
export function ProjectCelebration() {
  const store = useStore();
  const toast = useToast();
  const nav = useNav();
  const route = useRef(nav.current);
  route.current = nav.current;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let prev: ProgressSnapshot | null = null;
    const check = () => {
      const state = store.getState();
      if (!state.ready) return;
      const { completed, snapshot } = completedProjects(prev, state.tasks);
      prev = snapshot;
      if (completed.length === 0) return;
      tg.haptic('success');
      confetti(PALETTE.map((c) => c.hex));
      const here = route.current;
      for (const id of completed) {
        if (here?.name === 'project' && here.id === id) continue;
        const p = state.projects.find((x) => x.id === id);
        toastRef.current.show({ text: p ? `Проект закрыт 🎉 ${p.emoji} ${p.name}` : 'Проект закрыт 🎉' });
      }
    };
    check();
    return store.subscribe(check);
  }, [store]);

  return null;
}
