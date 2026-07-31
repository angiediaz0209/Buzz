import { Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

/**
 * Light/dark switch. Sized up (`big`) for the kiosk and client screens, where
 * it may be tapped on an iPad at arm's length or in a dim venue.
 */
function ThemeToggle({ big = false, className = '' }) {
  const [dark, toggle] = useDarkMode();
  const size = big ? 24 : 18;

  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      className={`inline-flex items-center justify-center rounded-xl text-stone-500 hover:text-ink-900 hover:bg-cream-200 transition-colors ${
        big ? 'p-3' : 'p-2'
      } ${className}`}
    >
      {dark ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  );
}

export default ThemeToggle;
