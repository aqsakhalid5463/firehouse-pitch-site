export function StaticBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          'radial-gradient(120% 80% at 20% 10%, rgba(226,61,40,0.22), transparent 55%), radial-gradient(90% 70% at 85% 25%, rgba(255,138,61,0.16), transparent 60%), var(--page-bg)',
      }}
    />
  );
}
