import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import Logo from './Logo';

/**
 * The paper version of a share card: a full-page sign you can tape to a table
 * or stand in a frame.
 *
 * It renders into a portal at the end of <body> rather than inside the card.
 * The app keeps its own layout height while printing, so a sign nested in the
 * page would come out followed by blank pages; as a direct child of body it is
 * the only thing left standing once body.printing-sign hides its siblings.
 * Hidden on screen either way — see the .print-portal rules in index.css.
 *
 * Colours are inline rather than Tailwind classes on purpose. The dark-mode
 * layer remaps .bg-white / .text-ink-900, and a sign printed from dark mode
 * still has to come out dark-on-white. Sizes are px, which print as 1/96in,
 * so the layout lands the same on Letter and A4.
 */

const INK = '#18232A';
const HONEY = '#F8B51E';
const HONEY_SOFT = '#FDEFC8';
const STONE = '#7D7873';
const CREAM = '#E8D4BE';

// Backgrounds are off by default in the print dialog; this asks for them anyway.
// Every fill below is decorative — the sign still reads if a printer ignores it.
const exactColor = {
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact'
};

export function PrintSign({ eventName, headline, subhead, steps = [], url, qrFg = INK }) {
  return createPortal(
    <div
      className="print-portal"
      style={{
        ...exactColor,
        background: '#fff',
        color: INK,
        textAlign: 'center',
        padding: '8px 24px',
        fontFamily: 'inherit'
      }}
    >
      {/* Brand mark */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 20
        }}
      >
        <Logo size={34} />
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Buzz</span>
      </div>

      {eventName && (
        <p
          style={{
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: STONE,
            marginBottom: 14
          }}
        >
          {eventName}
        </p>
      )}

      <h1
        style={{
          fontSize: 62,
          lineHeight: 1.05,
          fontWeight: 900,
          letterSpacing: '-0.03em',
          margin: 0
        }}
      >
        {headline}
      </h1>

      {subhead && (
        <p style={{ fontSize: 25, color: STONE, marginTop: 14, fontWeight: 500 }}>{subhead}</p>
      )}

      {/* The code itself, framed so it reads as something to point a phone at */}
      <div
        style={{
          ...exactColor,
          display: 'inline-block',
          marginTop: 26,
          padding: 8,
          borderRadius: 28,
          border: `6px solid ${HONEY}`,
          background: '#fff'
        }}
      >
        {/* marginSize keeps the 4-module quiet zone inside the code itself, so
            the honey frame can sit close without breaking the scan */}
        <QRCodeSVG value={url} size={380} level="H" marginSize={4} fgColor={qrFg} />
      </div>

      <p style={{ fontSize: 21, fontWeight: 700, marginTop: 20 }}>
        Point your phone camera at the code
      </p>

      {steps.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 34,
            marginTop: 28,
            paddingTop: 22,
            borderTop: `2px solid ${CREAM}`
          }}
        >
          {steps.map((step, i) => (
            <div key={step} style={{ width: 190 }}>
              <span
                style={{
                  ...exactColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: HONEY_SOFT,
                  border: `2px solid ${HONEY}`,
                  fontSize: 19,
                  fontWeight: 800,
                  marginBottom: 10
                }}
              >
                {i + 1}
              </span>
              <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>{step}</p>
            </div>
          ))}
        </div>
      )}

      {/* Fallback for a phone that won't scan — and for anyone who wants to type it */}
      <p
        style={{
          fontSize: 13,
          color: STONE,
          marginTop: 24,
          wordBreak: 'break-all'
        }}
      >
        No camera? Go to {url}
      </p>
    </div>,
    document.body
  );
}

export default PrintSign;
