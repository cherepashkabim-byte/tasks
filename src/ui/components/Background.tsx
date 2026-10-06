/** Тёмный фон с мягкими градиентными пятнами. */
export function Background() {
  return (
    <div class="bg" aria-hidden="true">
      <div class="bg__blob bg__blob--violet" />
      <div class="bg__blob bg__blob--teal" />
    </div>
  );
}
