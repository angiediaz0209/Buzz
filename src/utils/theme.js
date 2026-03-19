// Maps colorTheme values to Tailwind classes
// All class names must be written in full for Tailwind's purge to detect them

const themes = {
  lavender: {
    gradient: 'from-lavender-500 to-softpink-500',
    gradientBg: 'from-lavender-50 to-softpink-50',
    border: 'border-lavender-400',
    text: 'text-lavender-600',
    bg: 'bg-lavender-100',
    accent: 'bg-lavender-500',
    hoverBorder: 'hover:border-lavender-300',
    dot: 'bg-lavender-600',
    buttonBg: 'bg-lavender-500',
    focusBorder: 'focus:border-lavender-500',
    spinner: 'border-lavender-600',
  },
  mint: {
    gradient: 'from-mint-500 to-mint-600',
    gradientBg: 'from-mint-50 to-mint-100',
    border: 'border-mint-400',
    text: 'text-mint-600',
    bg: 'bg-mint-100',
    accent: 'bg-mint-500',
    hoverBorder: 'hover:border-mint-300',
    dot: 'bg-mint-600',
    buttonBg: 'bg-mint-500',
    focusBorder: 'focus:border-mint-500',
    spinner: 'border-mint-600',
  },
  softpink: {
    gradient: 'from-softpink-500 to-softpink-600',
    gradientBg: 'from-softpink-50 to-softpink-100',
    border: 'border-softpink-400',
    text: 'text-softpink-600',
    bg: 'bg-softpink-100',
    accent: 'bg-softpink-500',
    hoverBorder: 'hover:border-softpink-300',
    dot: 'bg-softpink-600',
    buttonBg: 'bg-softpink-500',
    focusBorder: 'focus:border-softpink-500',
    spinner: 'border-softpink-600',
  },
  peach: {
    gradient: 'from-peach-400 to-peach-500',
    gradientBg: 'from-peach-50 to-peach-100',
    border: 'border-peach-400',
    text: 'text-peach-600',
    bg: 'bg-peach-100',
    accent: 'bg-peach-500',
    hoverBorder: 'hover:border-peach-300',
    dot: 'bg-peach-600',
    buttonBg: 'bg-peach-500',
    focusBorder: 'focus:border-peach-500',
    spinner: 'border-peach-600',
  },
  skyblue: {
    gradient: 'from-skyblue-400 to-skyblue-500',
    gradientBg: 'from-skyblue-50 to-skyblue-100',
    border: 'border-skyblue-400',
    text: 'text-skyblue-600',
    bg: 'bg-skyblue-100',
    accent: 'bg-skyblue-500',
    hoverBorder: 'hover:border-skyblue-300',
    dot: 'bg-skyblue-600',
    buttonBg: 'bg-skyblue-500',
    focusBorder: 'focus:border-skyblue-500',
    spinner: 'border-skyblue-600',
  },
};

export function getTheme(colorTheme) {
  return themes[colorTheme] || themes.lavender;
}
