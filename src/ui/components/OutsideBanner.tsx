import { tg } from '../../tg';

/** Ненавязчивая плашка, когда облако Telegram недоступно и данные лежат только в localStorage. */
export function OutsideBanner() {
  const text = tg.isTelegram
    ? 'Облако Telegram недоступно — обнови Telegram. Пока данные только на этом устройстве'
    : 'Открыто вне Telegram — данные только в этом браузере';
  return <div class="outside-banner">{text}</div>;
}
