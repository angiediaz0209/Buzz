import { UserPlus, Search, ArrowLeft } from 'lucide-react';
import { BuzzMark } from './BuzzBrand';
import ThemeToggle from './ThemeToggle';

/**
 * The two ways into a line: take a new number, or look up one you already have.
 * Shared by the kiosk, the artist's public page and the client join link so all
 * three entry points offer the same choice.
 *
 * Buttons are deliberately oversized — this gets used on an iPad at arm's
 * length and on phones by people holding a child.
 */
function TurnChoice({ title, subtitle, onGetTurn, onFindTurn, onBack }) {
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-stone-600 hover:text-ink-900 transition-colors py-2"
          >
            <ArrowLeft size={22} />
            <span className="font-semibold text-lg">Back</span>
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <BuzzMark size={28} textClass="text-lg" className="text-ink-900" />
          <ThemeToggle big />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center w-full max-w-3xl mx-auto py-6">
        {title && (
          <div className="text-center mb-6 sm:mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-900">{title}</h1>
            {subtitle && <p className="text-stone-600 mt-2 text-lg">{subtitle}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <button
            onClick={onGetTurn}
            className="bg-honey-400 hover:bg-honey-500 active:bg-honey-500 rounded-[2rem] shadow-lg
                       min-h-[190px] sm:min-h-0 sm:aspect-square
                       flex flex-col items-center justify-center gap-4 sm:gap-6 p-6 transition-colors"
          >
            <UserPlus size={72} strokeWidth={2.25} className="text-ink-900 sm:hidden" />
            <UserPlus size={96} strokeWidth={2.25} className="text-ink-900 hidden sm:block" />
            <span className="text-ink-900 text-3xl sm:text-4xl font-extrabold leading-tight">
              Get a turn
            </span>
            <span className="text-ink-700 text-base sm:text-lg font-medium -mt-2">
              Join the line now
            </span>
          </button>

          <button
            onClick={onFindTurn}
            className="bg-white hover:border-sage-400 active:border-sage-400 border-[3px] border-cream-300 rounded-[2rem] shadow-lg
                       min-h-[190px] sm:min-h-0 sm:aspect-square
                       flex flex-col items-center justify-center gap-4 sm:gap-6 p-6 transition-colors"
          >
            <Search size={72} strokeWidth={2.25} className="text-sage-500 sm:hidden" />
            <Search size={96} strokeWidth={2.25} className="text-sage-500 hidden sm:block" />
            <span className="text-ink-900 text-3xl sm:text-4xl font-extrabold leading-tight">
              Find my turn
            </span>
            <span className="text-ink-700 text-base sm:text-lg font-medium -mt-2">
              Already in line
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default TurnChoice;
