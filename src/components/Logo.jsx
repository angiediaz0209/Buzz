function Logo({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Paint palette */}
      <path
        d="M16 2C8.268 2 2 8.268 2 16c0 7.732 6.268 14 14 14 1.105 0 2-.895 2-2 0-.52-.195-1-.52-1.36-.31-.35-.48-.79-.48-1.24 0-1.1.9-2 2-2h2.36c4.34 0 7.86-3.52 7.86-7.86C29.22 8.56 23.36 2 16 2z"
        fill="url(#palette-gradient)"
      />
      {/* Paint dots */}
      <circle cx="10" cy="13" r="2.5" fill="#7C3AED" />
      <circle cx="15" cy="9" r="2.5" fill="#EC4899" />
      <circle cx="21" cy="11" r="2.5" fill="#F59E0B" />
      <circle cx="11" cy="19" r="2.5" fill="#10B981" />
      <defs>
        <linearGradient id="palette-gradient" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#F9A8D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default Logo;
