// Buzz mark: honey hexagon with the bee's face inside.
// Drawn as SVG rather than using the PNG so it stays crisp and works on any
// background (the PNG crop carries a cream backing).
function Logo({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Hexagon */}
      <path
        d="M16 1.6l11.4 6.6a2.4 2.4 0 011.2 2.08v11.44a2.4 2.4 0 01-1.2 2.08L16 30.4 4.6 23.8a2.4 2.4 0 01-1.2-2.08V10.28A2.4 2.4 0 014.6 8.2L16 1.6z"
        fill="#FDCA50"
        stroke="#18232A"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      {/* Antennae */}
      <path
        d="M12.4 10.2C11.5 8.6 10.6 7.6 9.6 7.1M19.6 10.2c.9-1.6 1.8-2.6 2.8-3.1"
        stroke="#18232A"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="9.1" cy="6.6" r="1.5" fill="#18232A" />
      <circle cx="22.9" cy="6.6" r="1.5" fill="#18232A" />

      {/* Head */}
      <path
        d="M16 9.6c4.2 0 7 2.5 7 5.9 0 3.5-3 6.1-7 6.1s-7-2.6-7-6.1c0-3.4 2.8-5.9 7-5.9z"
        fill="#18232A"
      />

      {/* Glasses */}
      <circle cx="12.9" cy="15.1" r="2.5" fill="#FDCA50" />
      <circle cx="19.1" cy="15.1" r="2.5" fill="#FDCA50" />

      {/* Body stripe below the head */}
      <path
        d="M10.6 23.1h10.8c-.9 1.5-2.9 2.5-5.4 2.5s-4.5-1-5.4-2.5z"
        fill="#18232A"
      />
      <rect x="11.6" y="21.4" width="8.8" height="1.5" rx="0.75" fill="#F8B51E" />
    </svg>
  );
}

export default Logo;
