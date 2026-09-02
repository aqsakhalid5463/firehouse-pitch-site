import Image from 'next/image';

/**
 * A large editorial service card: photograph first, copy underneath.
 *
 * The photographs are the client's own, and they were shot in mixed
 * lighting on a bright day — dropped straight onto a near-black page
 * they read as six glowing rectangles and pull focus from the ribbon.
 * So they sit dimmed and desaturated at rest and resolve to full
 * strength on hover, which also gives the grid something to reward
 * pointer exploration with.
 *
 * `priority` is threaded through for the first row only; the rest are
 * lazy by default, since six 2048px-wide JPEGs above the fold would
 * dominate the page's loading budget.
 */
export function ServiceCard({
  index,
  title,
  body,
  image,
  alt,
  tall,
  priority = false,
}: {
  index: number;
  title: string;
  body: string;
  image: string;
  alt: string;
  tall: boolean;
  priority?: boolean;
}) {
  return (
    <article className="group relative">
      <div
        className={`relative overflow-hidden rounded-3xl ring-1 ring-bone/10 ${
          tall ? 'aspect-4/5' : 'aspect-4/3'
        }`}
      >
        <Image
          src={image}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 46vw, (min-width: 768px) 90vw, 100vw"
          className="object-cover brightness-[0.8] saturate-[0.65] transition duration-700 ease-out group-hover:scale-[1.05] group-hover:brightness-105 group-hover:saturate-100"
        />

        {/* Grounds the image into the page so its bottom edge doesn't
            cut a hard rectangle against the dark background. Confined to
            the bottom third: spanning the full height buried more than
            half of some photographs in black, since these are dim,
            overcast shots to begin with. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-dark-bg/85 to-transparent"
        />

        {/* The ribbon runs down the page in brand red; this edge marker
            is the card acknowledging it on hover. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-fire transition-transform duration-500 ease-out group-hover:scale-y-100"
        />

        <span
          aria-hidden="true"
          className="absolute top-6 left-6 text-xs font-semibold tracking-[0.25em] text-bone/70"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      <h3 className="mt-7 text-[clamp(1.5rem,2.4vw,2rem)] font-semibold tracking-tight">
        {title}
      </h3>
      <p className="mt-3 max-w-md leading-relaxed text-bone/60">{body}</p>
    </article>
  );
}
