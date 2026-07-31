import { useState } from 'react';

export const THEME_KEY = 'buzz-theme';

/**
 * Reads and flips dark mode.
 *
 * The initial value comes from the `dark` class that the inline script in
 * index.html already applied, so there's no flash and no setState-in-effect —
 * the DOM is the source of truth at mount.
 */
export function useDarkMode() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);

    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {
      // Private browsing can refuse storage; the toggle still works for this visit
    }

    // Keep the browser/PWA chrome in step with the page
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next ? '#141d23' : '#F8B51E');
  };

  return [dark, toggle];
}
