import React from 'react';

export function PrepWiseLogo({ light = true }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9D6BFF] to-[#6327E3] flex items-center justify-center shadow-md shadow-[#6327E3]/30 shrink-0">
        <svg viewBox="0 0 36 36" className="w-6 h-6" fill="none" aria-hidden="true">
          <path d="M18 6L4 13L18 20L32 13L18 6Z" fill="#FFFFFF" />
          <path d="M9 17.2V24.5C9 26.8 13.03 29 18 29C22.97 29 27 26.8 27 24.5V17.2L18 21.8L9 17.2Z" fill="#E9DDFF" />
          <path d="M30 14V24" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
          <circle cx="30" cy="25.5" r="1.8" fill="#FBBF24" />
        </svg>
      </div>
      <div>
        <div className={`font-display text-xl font-bold tracking-tight leading-none ${light ? 'text-white' : 'text-[#1A1635]'}`}>
          Divshinastudy
        </div>
        <div className={`text-[10px] tracking-wide mt-1 whitespace-nowrap ${light ? 'text-[#B8B0DC]' : 'text-[#6D658F]'}`}>
          Study · Practice · Excel
        </div>
      </div>
    </div>
  );
}

export function HeroGraduationIllustration() {
  return (
    <svg
      viewBox="0 0 280 200"
      className="w-56 sm:w-64 lg:w-72 h-auto select-none drop-shadow-[0_18px_24px_rgba(20,12,62,0.38)]"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pw-cap-top" x1="40" y1="32" x2="230" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#433878" />
          <stop offset="55%" stopColor="#261D52" />
          <stop offset="100%" stopColor="#161036" />
        </linearGradient>
        <linearGradient id="pw-book-bottom" x1="46" y1="142" x2="236" y2="178" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8F6BFF" />
          <stop offset="100%" stopColor="#5D32CE" />
        </linearGradient>
        <linearGradient id="pw-book-top" x1="72" y1="118" x2="220" y2="144" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E9D8FD" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient id="pw-tassel" x1="205" y1="80" x2="205" y2="174" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>

      {/* Motion spark lines left of cap matching reference */}
      <path d="M58 58L42 46" stroke="#DDD6FE" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <path d="M50 76L30 74" stroke="#DDD6FE" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <path d="M56 93L41 102" stroke="#DDD6FE" strokeWidth="3" strokeLinecap="round" opacity="0.65" />

      {/* Bottom blue-purple hardcover book */}
      <path d="M52 142H228C234 142 238 146 238 152V172C238 178 234 182 228 182H52C44 182 40 176 40 162C40 148 44 142 52 142Z" fill="url(#pw-book-bottom)" />
      <rect x="48" y="148" width="182" height="27" rx="5" fill="#F3F0FF" />
      <path d="M52 156H226M52 163H226M52 170H226" stroke="#D9D2F2" strokeWidth="1.5" />
      <path d="M40 162C40 150 46 144 54 144V180C46 180 40 174 40 162Z" fill="#5128B8" />

      {/* Upper slim cream/violet book */}
      <path d="M74 118H214C219 118 223 122 223 127V137C223 141 219 144 214 144H74C67 144 64 139 64 131C64 123 67 118 74 118Z" fill="url(#pw-book-top)" />
      <rect x="72" y="123" width="144" height="16" rx="3" fill="#FFFDF7" />
      <path d="M64 131C64 123 69 119 76 119V143C69 143 64 139 64 131Z" fill="#C4B5FD" />

      {/* Graduation Cap Crown */}
      <path d="M98 76V106C98 115 124 122 154 122C184 122 210 115 210 106V76H98Z" fill="#23194D" />
      <ellipse cx="154" cy="76" rx="56" ry="12" fill="#322566" />

      {/* Graduation Cap Board */}
      <path d="M154 24L60 60L154 96L248 60L154 24Z" fill="url(#pw-cap-top)" stroke="#6D57B8" strokeWidth="1.5" />
      <circle cx="154" cy="59" r="5" fill="#7C5CE6" />

      {/* Gold Tassel */}
      <path d="M154 59L206 78V130" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="206" cy="133" r="5.5" fill="#F59E0B" />
      <path d="M198 138H214L219 175C211 178 201 178 193 175L198 138Z" fill="url(#pw-tassel)" />
      <path d="M202 142L200 175M206 142V176M210 142L212 175" stroke="#B45309" strokeWidth="1.2" opacity="0.55" />
    </svg>
  );
}
