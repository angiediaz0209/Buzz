import { QrCode, Copy, ExternalLink, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { TONES } from '../utils/shareTones';
import { PrintSign } from './PrintSign';

// One share target: audience-first label, no raw URL, Copy / QR / Open.
// The `sign*` props are the wall sign that Print produces — see PrintSign.
export function ShareCard({
  tone,
  icon,
  audience,
  purpose,
  url,
  openLabel,
  qrOpen,
  onToggleQR,
  onCopy,
  onPrint,
  printing,
  signEyebrow,
  signHeadline,
  signSubhead,
  signSteps,
  picker,
  qrNote
}) {
  const t = TONES[tone];
  const Icon = icon;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 border-2 border-cream-200">
      {/* Mounted only while this card is the one being printed */}
      {printing && (
        <PrintSign
          eventName={signEyebrow}
          headline={signHeadline}
          subhead={signSubhead}
          steps={signSteps}
          url={url}
          qrFg={t.qrFg}
        />
      )}

      <div>
        <div className="flex items-start gap-2 mb-4">
          <div className={`p-2 ${t.iconBg} rounded-lg shrink-0`}>
            <Icon size={18} className={t.iconText} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-ink-900 leading-tight">{audience}</h3>
            <p className="text-xs text-stone-500 mt-0.5">{purpose}</p>
          </div>
        </div>

        {picker}

        <div className="flex gap-2">
          <button
            onClick={onCopy}
            title={url}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${t.copy}`}
          >
            <Copy size={16} />
            Copy
          </button>
          <button
            onClick={onToggleQR}
            aria-expanded={qrOpen}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
              qrOpen ? t.qrActive : 'bg-cream-200 text-ink-700 hover:bg-cream-300'
            }`}
          >
            <QrCode size={16} />
            QR
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={openLabel}
            aria-label={openLabel}
            className="flex items-center justify-center px-3 py-2 bg-cream-200 text-ink-700 rounded-lg hover:bg-cream-300 transition-colors"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      {qrOpen && (
        <div className="mt-4 pt-4 border-t border-cream-200 text-center">
          <QRCodeSVG value={url} size={200} level="H" marginSize={4} fgColor={t.qrFg} />

          {qrNote && <p className="text-stone-400 text-xs mt-2">{qrNote}</p>}

          {onPrint && (
            <button
              onClick={onPrint}
              className={`mt-3 flex items-center justify-center gap-2 text-sm font-medium mx-auto transition-colors ${t.link}`}
            >
              <Printer size={14} />
              Print this sign
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Stands in for a card when there's no active event to point it at
export function SharePlaceholder({ icon, audience, blurb }) {
  const Icon = icon;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 border-2 border-dashed border-cream-200">
      <div className="flex items-start gap-2 mb-3">
        <div className="p-2 bg-cream-200 rounded-lg shrink-0">
          <Icon size={18} className="text-stone-400" />
        </div>
        <h3 className="font-bold text-stone-400 leading-tight">{audience}</h3>
      </div>
      <p className="text-sm text-stone-500">{blurb}</p>
    </div>
  );
}
