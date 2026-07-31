// The app is served from the domain root on Firebase Hosting but from
// /artistline/ on GitHub Pages. Vite injects the build's base as BASE_URL
// (always with a trailing slash), so everything that needs an absolute path
// goes through here instead of hardcoding a leading slash.

export const BASE = import.meta.env.BASE_URL;

/** Router basename: '' at the domain root, '/artistline' on GitHub Pages. */
export const ROUTER_BASE = BASE.replace(/\/$/, '');

/** Path to a file in public/ — e.g. asset('brand/mascot.webp'). */
export const asset = (path) => `${BASE}${String(path).replace(/^\//, '')}`;

/**
 * Fully-qualified URL to a route, for QR codes and links people copy.
 * Must include the base or the codes point at a 404 on GitHub Pages.
 */
export const appUrl = (path) =>
  `${window.location.origin}${BASE}${String(path).replace(/^\//, '')}`;
