export function StaticBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          'radial-gradient(120% 80% at 20% 10%, color-mix(in srgb, var(--color-fire) 22%, transparent), transparent 55%), radial-gradient(90% 70% at 85% 25%, color-mix(in srgb, var(--color-panel-grey) 30%, transparent), transparent 60%), var(--page-bg)',
      }}
    />
  );
}
