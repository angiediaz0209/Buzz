import Logo from './Logo';

/** Wordmark lockup — hexagon mark plus the Buzz name */
export function BuzzMark({ size = 28, className = '', textClass = 'text-xl' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Logo size={size} />
      <span className={`font-extrabold tracking-tight ${textClass}`}>Buzz</span>
    </span>
  );
}

/**
 * The mascot. A WebP with a real alpha channel, so it sits on cream, ink,
 * honey or sage with nothing behind it — no plate, no matched backdrop.
 */
export function Mascot({ className = '', alt = '' }) {
  return <img src="/brand/mascot.webp" alt={alt} className={className} />;
}

/**
 * The row of little figures standing in line, as on the client queue screen.
 * Colours cycle through the brand palette; caps the drawing so a long line
 * doesn't overflow and shows the remainder as a count.
 */
const FIGURE_COLORS = ['#FDCA50', '#87B9A6', '#6BA592', '#F8B51E', '#9B968F'];

export function QueueFigures({ count, max = 5, className = '' }) {
  const shown = Math.min(count, max);
  const extra = count - shown;

  if (count <= 0) return null;

  return (
    <div className={`flex items-end justify-center gap-2 ${className}`}>
      {Array.from({ length: shown }).map((_, i) => (
        <svg
          key={i}
          width="22"
          height="34"
          viewBox="0 0 22 34"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="11" cy="6" r="5" fill={FIGURE_COLORS[i % FIGURE_COLORS.length]} />
          <path
            d="M11 13c-4 0-6.5 2.4-6.5 6.2V27c0 .8.6 1.4 1.4 1.4h1.3V33c0 .6.4 1 1 1h5.6c.6 0 1-.4 1-1v-4.6h1.3c.8 0 1.4-.6 1.4-1.4v-7.8C17.5 15.4 15 13 11 13z"
            fill={FIGURE_COLORS[i % FIGURE_COLORS.length]}
          />
        </svg>
      ))}
      {extra > 0 && (
        <span className="text-sm font-semibold text-stone-500 ml-1 mb-1">+{extra}</span>
      )}
    </div>
  );
}
