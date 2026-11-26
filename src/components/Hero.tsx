export function Hero() {
  return (
    <div className="hero">
      <div className="eyebrow">
        <span>Alpago Technology</span>
        <i />
      </div>
      <h1>Project Portfolio</h1>
      <p className="sub">Real-time overview of our technology initiatives and progress.</p>
    </div>
  );
}

/**
 * Architectural backdrop behind the title. Drawn rather than photographed so
 * the build ships with no binary asset — swap in an <img> if you'd rather use
 * the original building photograph.
 */
export function HeroBackdrop() {
  return (
    <div className="hero-img" aria-hidden="true">
      <svg viewBox="0 0 900 330" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="fa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3d434a" />
            <stop offset="1" stopColor="#14171a" />
          </linearGradient>
          <linearGradient id="fb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#262b31" />
            <stop offset="1" stopColor="#0d1012" />
          </linearGradient>
          <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#52585f" />
            <stop offset="1" stopColor="#1b1f23" />
          </linearGradient>
          <pattern id="win" width="26" height="20" patternUnits="userSpaceOnUse">
            <rect width="26" height="20" fill="none" />
            <rect x="1.5" y="1.5" width="22" height="16" fill="rgba(255,255,255,.055)" />
          </pattern>
        </defs>
        <rect width="900" height="330" fill="#0b0d0f" />
        <path d="M300 330 L300 92 L620 18 L620 330 Z" fill="url(#fb)" />
        <path d="M300 92 L620 18 L620 60 L300 134 Z" fill="url(#fc)" opacity=".75" />
        <path d="M300 134 L620 60 L620 330 L300 330 Z" fill="url(#win)" opacity=".85" />
        <path d="M620 18 L900 76 L900 330 L620 330 Z" fill="url(#fa)" opacity=".55" />
        <path d="M620 60 L900 118 L900 330 L620 330 Z" fill="url(#win)" opacity=".4" />
        <path d="M620 18 L900 76" stroke="rgba(255,255,255,.22)" strokeWidth="1.2" />
        <path d="M300 92 L620 18" stroke="rgba(255,255,255,.26)" strokeWidth="1.2" />
        <rect x="640" y="150" width="260" height="180" fill="rgba(0,0,0,.25)" />
      </svg>
    </div>
  );
}
