/**
 * The background for everything after the hero.
 *
 * Once the road dissolves behind the departing truck the page would
 * otherwise be flat black for its entire remaining length, which reads
 * as "the design stopped" rather than as a deliberate dark ground. This
 * gives it depth without competing with the ribbon or the photographs:
 * a faint surveyor's grid, radially masked so it never reaches a hard
 * edge, under two very soft drifting glows.
 *
 * Pure CSS and non-interactive — no canvas, no rAF — so it costs nothing
 * per frame and cannot contend with the 3D scene for the main thread.
 */
export function PageField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
      style={{
        // The field begins exactly where the pinned opening ends, and
        // both the grid and the clipped top glow would otherwise start
        // on a hard horizontal seam right under the 3D scene. Fading
        // the whole layer in over the first 240px makes the handoff
        // from road to page continuous.
        maskImage: 'linear-gradient(to bottom, transparent 0, black 240px)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 240px)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in srgb, var(--color-silver-glass) 7%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-silver-glass) 7%, transparent) 1px, transparent 1px)',
          backgroundSize: '88px 88px',
          // Fades the grid out towards the edges so it reads as ground
          // receding rather than as a texture bolted onto a rectangle.
          maskImage:
            'radial-gradient(120% 60% at 50% 40%, black 0%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(120% 60% at 50% 40%, black 0%, transparent 78%)',
        }}
      />
      <div className="animate-field-drift absolute -top-40 -left-32 size-[46rem] rounded-full bg-fire/[0.07] blur-[130px]" />
      <div className="animate-field-drift-slow absolute top-1/2 -right-40 size-[52rem] rounded-full bg-silver-glass/[0.05] blur-[150px]" />
    </div>
  );
}
