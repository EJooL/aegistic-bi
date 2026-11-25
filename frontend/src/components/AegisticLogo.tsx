import React, { useId } from 'react';

interface AegisticLogoProps {
  onClick?: () => void;
  showSubtitle?: boolean;
  size?: 'sm' | 'md';
  variant?: 'light' | 'dark';
}

export const AegisticLogo: React.FC<AegisticLogoProps> = ({
  onClick,
  showSubtitle = false,
  size = 'md',
  variant = 'light',
}) => {
  const clipId = useId();
  const isDark = variant === 'dark';
  const shieldStroke = isDark ? '#FFFFFF' : '#09090B';
  const wordmarkPrimary = isDark ? 'text-[#FFFFFF]' : 'text-[#09090B]';
  const subtitleColor = isDark ? 'text-[#9CA3AF]' : 'text-[#4B5563]';

  const iconWidth = size === 'sm' ? 30 : 34;
  const iconHeight = size === 'sm' ? 33 : 38;

  const content = (
    <span className="inline-flex items-center gap-2.5 text-left">
      <svg
        width={iconWidth}
        height={iconHeight}
        viewBox="0 0 40 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <clipPath id={clipId}>
            <path d="M7.2 0H30.8V22.8C30.8 31.2 27.1 35.8 19 38.8C10.9 35.8 7.2 31.2 7.2 22.8V0Z" />
          </clipPath>
        </defs>

        {/* Three ascending bars clipped cleanly to the inner curved shield bottom */}
        <g clipPath={`url(#${clipId})`}>
          {/* Left slate bar */}
          <rect x="9.6" y="21.5" width="4.8" height="19" fill="#BDC4D0" />
          {/* Center sky-blue bar */}
          <rect x="16.1" y="16.2" width="4.9" height="24" fill="#5BC2F4" />
          {/* Right vibrant pink-red breakout arrow bar */}
          <path
            d="M19.6 12.6L28.0 2.0V39.5H22.8V12.6H19.6Z"
            fill="#FF0F5B"
          />
        </g>

        {/* Architectural shield outline with crisp top-right breakout opening */}
        <path
          d="M29.9 8.2L32.4 9.3V19.6C32.4 30.8 27.6 36.8 19 40.6C10.4 36.8 5.6 30.8 5.6 19.6V9.3L19 3.6L23.5 5.5"
          stroke={shieldStroke}
          strokeWidth="2.9"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      </svg>

      <span className="flex flex-col leading-none">
        <span
          className={`font-display font-bold tracking-[-0.035em] ${
            size === 'sm' ? 'text-[20px]' : 'text-[23px]'
          }`}
        >
          <span className={wordmarkPrimary}>Aegis</span>
          <span className="text-[#FF0F5B]">tic</span>
        </span>
        {showSubtitle && (
          <span className={`text-[11.5px] font-medium mt-1 ${subtitleColor}`}>
            Verified Semantic BI
          </span>
        )}
      </span>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0F5B] focus-visible:ring-offset-2"
      >
        {content}
      </button>
    );
  }

  return content;
};
