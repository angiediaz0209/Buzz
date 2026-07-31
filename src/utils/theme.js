// Per-event accent themes, all drawn from the Buzz palette so every event
// still looks like the same app.
// All class names must be written in full for Tailwind's purge to detect them.

const themes = {
  honey: {
    gradient: 'from-honey-400 to-honey-500',
    gradientBg: 'from-cream-100 to-cream-200',
    border: 'border-honey-400',
    text: 'text-honey-700',
    bg: 'bg-honey-100',
    accent: 'bg-honey-500',
    hoverBorder: 'hover:border-honey-400',
    dot: 'bg-honey-500',
    buttonBg: 'bg-honey-500',
    focusBorder: 'focus:border-honey-500',
    spinner: 'border-honey-500',
  },
  sage: {
    gradient: 'from-sage-300 to-sage-500',
    gradientBg: 'from-cream-100 to-sage-100',
    border: 'border-sage-400',
    text: 'text-sage-600',
    bg: 'bg-sage-100',
    accent: 'bg-sage-400',
    hoverBorder: 'hover:border-sage-400',
    dot: 'bg-sage-500',
    buttonBg: 'bg-sage-400',
    focusBorder: 'focus:border-sage-400',
    spinner: 'border-sage-500',
  },
  ink: {
    gradient: 'from-ink-700 to-ink-900',
    gradientBg: 'from-cream-100 to-stone-200',
    border: 'border-ink-700',
    text: 'text-ink-900',
    bg: 'bg-stone-200',
    accent: 'bg-ink-800',
    hoverBorder: 'hover:border-ink-500',
    dot: 'bg-ink-800',
    buttonBg: 'bg-ink-900',
    focusBorder: 'focus:border-ink-700',
    spinner: 'border-ink-800',
  },
  stone: {
    gradient: 'from-stone-300 to-stone-500',
    gradientBg: 'from-cream-100 to-stone-200',
    border: 'border-stone-400',
    text: 'text-stone-600',
    bg: 'bg-stone-200',
    accent: 'bg-stone-500',
    hoverBorder: 'hover:border-stone-400',
    dot: 'bg-stone-500',
    buttonBg: 'bg-stone-500',
    focusBorder: 'focus:border-stone-400',
    spinner: 'border-stone-500',
  },
};

// Events created before the rebrand still store the old palette names.
const LEGACY = {
  lavender: 'honey',
  peach: 'honey',
  softpink: 'sage',
  mint: 'sage',
  skyblue: 'ink',
};

export const THEME_OPTIONS = [
  { value: 'honey', label: 'Honey', color: 'bg-honey-500' },
  { value: 'sage', label: 'Sage', color: 'bg-sage-400' },
  { value: 'ink', label: 'Ink', color: 'bg-ink-800' },
  { value: 'stone', label: 'Stone', color: 'bg-stone-500' },
];

export function getTheme(colorTheme) {
  return themes[colorTheme] || themes[LEGACY[colorTheme]] || themes.honey;
}
