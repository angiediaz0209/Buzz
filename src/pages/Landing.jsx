import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BuzzMark, Mascot } from '../components/BuzzBrand';
import { asset } from '../utils/urls';
import ThemeToggle from './../components/ThemeToggle';
import {
  QrCode,
  Smartphone,
  BellRing,
  ClipboardCheck,
  Users,
  Smile,
  Clock,
  ShieldCheck,
  Lock,
  Scale,
  Heart,
  ArrowRight
} from 'lucide-react';

const display = { fontFamily: "'Poppins', sans-serif" };

const STEPS = [
  {
    icon: QrCode,
    title: 'They scan your code',
    body: 'Put one QR on your table. No app to download, no paper list, no shouting over the crowd.'
  },
  {
    icon: Smartphone,
    title: 'They watch their turn',
    body: 'Their number, how many people are ahead, and the wait — updating live on their own phone.'
  },
  {
    icon: BellRing,
    title: 'You call the next one',
    body: "One tap. Their screen turns green and tells them it's their turn. You keep painting."
  }
];

const PERSONALITY = [
  { icon: ClipboardCheck, title: 'Organized', body: 'Keeps everything in order.' },
  { icon: Users, title: 'Helpful', body: 'Guides you through the line.' },
  { icon: Smile, title: 'Friendly', body: 'Always kind, always positive.' },
  { icon: Clock, title: 'Punctual', body: 'Respects your time.' }
];

const TRUST = [
  { icon: ShieldCheck, title: 'Trusted', body: 'Safe and reliable' },
  { icon: Lock, title: 'Secure', body: 'Your data is safe' },
  { icon: Scale, title: 'Fair', body: 'First come, first served' },
  { icon: Heart, title: 'Respectful', body: 'We value your time' }
];

function Landing() {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-cream-100/90 backdrop-blur border-b border-cream-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <BuzzMark size={30} textClass="text-lg sm:text-xl" className="text-ink-900" />

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
          {currentUser ? (
            <Link
              to="/dashboard"
              className="bg-ink-900 text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-ink-700 transition-colors shrink-0"
              style={display}
            >
              <span className="sm:hidden">Dashboard</span>
              <span className="hidden sm:inline">Go to dashboard</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              {/* Hidden on phones — the hero CTA already covers signing in */}
              <Link
                to="/login"
                className="hidden sm:inline-flex px-4 py-2.5 rounded-xl font-bold text-sm text-ink-900 hover:bg-cream-200 transition-colors"
                style={display}
              >
                Log in
              </Link>
              <Link
                to="/login"
                className="bg-honey-500 text-ink-900 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-honey-600 transition-colors shadow-sm"
                style={display}
              >
                <span className="sm:hidden">Log in</span>
                <span className="hidden sm:inline">Get started</span>
              </Link>
            </div>
          )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 md:pt-16 md:pb-24">
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
          <div className="order-2 md:order-1">
            <p
              className="text-xs sm:text-sm font-bold tracking-[0.15em] text-honey-700 uppercase mb-4"
              style={display}
            >
              Organized. Friendly. Always here.
            </p>

            <h1
              className="text-[2rem] sm:text-5xl lg:text-6xl font-black text-ink-900 leading-[1.05] mb-4 sm:mb-5"
              style={display}
            >
              Your place in line, made{' '}
              <span className="text-honey-500">simple</span>.
            </h1>

            <p className="text-base sm:text-lg text-ink-500 leading-relaxed mb-6 sm:mb-8 max-w-md">
              A friendly queue for face painters, balloon artists and anyone with a
              line of excited kids. Your clients scan once and watch their turn from
              their own phone — no clipboard, no crowd around your chair.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to={currentUser ? '/dashboard' : '/login'}
                className="inline-flex items-center justify-center gap-2 bg-honey-500 text-ink-900 px-7 py-4 rounded-2xl font-extrabold text-lg hover:bg-honey-600 transition-colors shadow-lg"
                style={display}
              >
                {currentUser ? 'Go to dashboard' : 'Start free'}
                <ArrowRight size={20} />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center justify-center gap-2 bg-white text-ink-900 px-7 py-4 rounded-2xl font-extrabold text-lg border-2 border-cream-300 hover:border-honey-400 transition-colors"
                style={display}
              >
                See how it works
              </a>
            </div>

            <p className="text-sm text-stone-600 mt-5">
              Free to start · No app for your clients to install
            </p>
          </div>

          <div className="order-1 md:order-2 flex justify-center">
            <Mascot
              alt="Buzz, a friendly bee holding a clipboard"
              className="w-40 sm:w-64 md:w-full max-w-sm h-auto"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-cream-50 border-y border-cream-300 py-12 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-2xl sm:text-4xl font-black text-ink-900 text-center mb-3"
            style={display}
          >
            Three steps and the line runs itself
          </h2>
          <p className="text-ink-500 text-center mb-8 md:mb-12 max-w-xl mx-auto">
            You set it up once at the start of your event. After that you only ever
            tap one button.
          </p>

          <div className="grid md:grid-cols-3 gap-5 md:gap-6">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-cream-200 relative"
              >
                <span
                  className="absolute -top-3 -left-2 w-9 h-9 rounded-full bg-ink-900 text-honey-400 flex items-center justify-center text-sm font-black"
                  style={display}
                >
                  {i + 1}
                </span>
                <div className="w-14 h-14 rounded-2xl bg-honey-100 flex items-center justify-center mb-5">
                  <step.icon size={26} className="text-honey-700" />
                </div>
                <h3 className="text-xl font-extrabold text-ink-900 mb-2" style={display}>
                  {step.title}
                </h3>
                <p className="text-ink-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What clients see */}
      <section className="py-12 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="flex justify-center">
              <img
                src={asset("brand/phone-queue.jpg")}
                alt="A client's phone showing number 23 with a 12 minute wait"
                className="w-full max-w-[260px] h-auto rounded-2xl"
              />
            </div>

            <div>
              <h2
                className="text-2xl sm:text-4xl font-black text-ink-900 mb-4"
                style={display}
              >
                This is what your clients see
              </h2>
              <p className="text-lg text-ink-500 leading-relaxed mb-6">
                Their number, the people ahead of them, and an honest wait estimate.
                They can wander off, get a snack, and come back when it&apos;s their
                turn — because the page tells them.
              </p>
              <ul className="space-y-3">
                {[
                  'Updates by itself — no refreshing',
                  'Turns green the moment you call them',
                  'They can tell you if they can no longer make it'
                ].map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-sage-200 flex items-center justify-center shrink-0 mt-0.5">
                      <ClipboardCheck size={14} className="text-sage-600" />
                    </span>
                    <span className="text-ink-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Personality */}
      <section className="bg-ink-900 py-12 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-2xl sm:text-4xl font-black text-cream-100 text-center mb-8 md:mb-12"
            style={display}
          >
            Meet Buzz
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {PERSONALITY.map((trait) => (
              <div
                key={trait.title}
                className="bg-ink-800 rounded-3xl p-4 sm:p-6 text-center border border-ink-700"
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-honey-500 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <trait.icon size={22} className="text-ink-900" />
                </div>
                <h3 className="font-extrabold text-cream-100 mb-1" style={display}>
                  {trait.title}
                </h3>
                <p className="text-sm text-stone-400">{trait.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-honey-400 rounded-[2rem] p-8 sm:p-12 text-center relative overflow-hidden">
            <Mascot className="w-32 sm:w-40 h-auto mx-auto mb-4" />
            <h2
              className="text-2xl sm:text-4xl font-black text-ink-900 mb-3"
              style={display}
            >
              Ready for a calmer line?
            </h2>
            <p className="text-ink-700 text-base sm:text-lg mb-7 sm:mb-8 max-w-md mx-auto">
              Set up your first event in a couple of minutes. Buzz handles the waiting.
            </p>
            <Link
              to={currentUser ? '/dashboard' : '/login'}
              className="inline-flex items-center justify-center gap-2 bg-ink-900 text-white px-6 sm:px-8 py-4 rounded-2xl font-extrabold text-base sm:text-lg hover:bg-ink-700 transition-colors shadow-lg whitespace-nowrap"
              style={display}
            >
              {currentUser ? 'Go to dashboard' : 'Get started free'}
              <ArrowRight size={20} className="shrink-0" />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="bg-cream-50 border-t border-cream-300 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {TRUST.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <item.icon size={20} className="text-sage-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-ink-900 text-sm" style={display}>
                    {item.title}
                  </p>
                  <p className="text-sm text-stone-600">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-cream-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BuzzMark size={26} textClass="text-base" className="text-ink-900" />
          <p className="text-sm text-stone-600">
            Organized. Friendly. Always here.
          </p>
          <Link
            to={currentUser ? '/dashboard' : '/login'}
            className="text-sm font-bold text-ink-900 hover:text-honey-700 transition-colors"
            style={display}
          >
            {currentUser ? 'Dashboard' : 'Log in'} →
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
