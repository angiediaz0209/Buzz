// Color tones for the share cards. Kept out of the component file so React
// Fast Refresh still works there (a module may export components OR values).
// Class names are written in full so Tailwind's purge can detect them.
// qrFg is the QR code's ink colour — kept dark enough to stay scannable.

export const TONES = {
  honey: {
    iconBg: 'bg-honey-100',
    iconText: 'text-honey-700',
    copy: 'bg-honey-100 text-honey-700 hover:bg-honey-200',
    qrActive: 'bg-honey-500 text-ink-900',
    pillActive: 'bg-honey-500 text-ink-900',
    link: 'text-honey-700 hover:text-ink-900',
    qrFg: '#B87D0C'
  },
  sage: {
    iconBg: 'bg-sage-100',
    iconText: 'text-sage-600',
    copy: 'bg-sage-100 text-sage-600 hover:bg-sage-200',
    qrActive: 'bg-sage-400 text-ink-900',
    pillActive: 'bg-sage-500 text-white',
    link: 'text-sage-600 hover:text-ink-900',
    qrFg: '#548C7A'
  },
  ink: {
    iconBg: 'bg-stone-200',
    iconText: 'text-ink-800',
    copy: 'bg-stone-200 text-ink-800 hover:bg-stone-300',
    qrActive: 'bg-ink-900 text-white',
    pillActive: 'bg-ink-900 text-white',
    link: 'text-ink-800 hover:text-ink-900',
    qrFg: '#18232A'
  }
};
