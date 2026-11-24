import React from 'react';

interface AegisticLogoProps {
  onClick?: () => void;
  showSubtitle?: boolean;
  size?: 'sm' | 'md';
}

export const AegisticLogo: React.FC<AegisticLogoProps> = ({
  onClick,
  showSubtitle = false,
  size = 'md',
}) => {
  const iconSize = size === 'sm' ? 28 : 32;

  const content = (
    <span className="inline-flex items-center gap-2.5 text-left">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Flat Swiss geometric mark combining #67689E and #FF0F5B */}
        <rect x="1" y="1" width="14" height="30" rx="2" fill="#67689E" />
        <path
          d="M17 1H24C27.866 1 31 4.13401 31 8C31 11.866 27.866 15 24 15H17V1Z"
          fill="#FF0F5B"
        />
        <rect
          x="17.75"
          y="17.75"
          width="12.5"
          height="12.5"
          rx="1.5"
          stroke="#09090B"
          strokeWidth="1.5"
          fill="#FFFFFF"
        />
        <rect x="21.5" y="21.5" width="5" height="5" fill="#5BC2F4" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="inline-flex items-baseline gap-0.5 font-display text-[18px] font-bold tracking-[-0.03em] text-[#09090B]">
          Aegistic
          <span
            className="inline-block w-1.5 h-1.5 bg-[#FF0F5B] ml-0.5"
            aria-hidden="true"
          />
        </span>
        {showSubtitle && (
          <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#4B5563] mt-1">
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
        className="inline-flex items-center focus:outline-none focus:ring-2 focus:ring-[#67689E] rounded"
      >
        {content}
      </button>
    );
  }

  return content;
};
