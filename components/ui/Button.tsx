import Link from 'next/link';

export function Button({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide transition-all duration-300';
  const styles =
    variant === 'primary'
      ? 'bg-fire text-white hover:brightness-110 hover:shadow-[0_0_36px_-6px_var(--color-fire)]'
      : 'border border-current/30 hover:border-current/70';

  const external = href.startsWith('tel:') || href.startsWith('mailto:');
  const Cmp = external ? 'a' : Link;

  return (
    <Cmp href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </Cmp>
  );
}
