// Production build for GitHub Pages.
//
// Project sites are served from /<repo-name>/, so the bundle needs a matching
// base path. That path is derived from package.json "homepage" rather than
// hardcoded, so renaming the repository only means updating that one field.
import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

if (!pkg.homepage) {
  console.error(
    'package.json needs a "homepage" (e.g. https://user.github.io/repo) ' +
      'so the GitHub Pages base path can be derived.'
  );
  process.exit(1);
}

// "https://user.github.io/buzz" -> "/buzz/"
const base = new URL(pkg.homepage).pathname.replace(/\/?$/, '/');

console.log(`Building for GitHub Pages — base ${base}`);
execFileSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: base }
});

// GitHub Pages has no server-side rewrites; serving the SPA as the 404 page is
// what makes deep links work.
copyFileSync('dist/index.html', 'dist/404.html');
console.log('Copied index.html -> 404.html so deep links resolve');
