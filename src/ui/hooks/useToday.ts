import { useEffect, useState } from 'preact/hooks';
import { todayISO } from '../../dates';

/** Сегодняшняя дата YYYY-MM-DD; обновляется после полуночи и при возврате в приложение. */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const update = () => setToday(todayISO());
    const id = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return today;
}
