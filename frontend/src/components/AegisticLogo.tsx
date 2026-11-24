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
        {/* Chamfered architectural shield silhouette */}
        <path
          d="M16 1.5L28.5 5.5V17.5L16 30.5L3.5 17.5V5.5L16 1.5Z"
          fill="#09090B"
        />
        {/* Three ascending verified analytics bars */}
        <rect x="8.5" y="15.5" width="3.8" height="6" rx="0.5" fill="#BDC4D0" />
        <rect x="14.1" y="12" width="3.8" height="9.5" rx="0.5" fill="#5BC2F4" />
        <rect x="19.7" y="8" width="3.8" height="13.5" rx="0.5" fill="#FF0F5B" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-display font-bold tracking-[-0.03em] text-[20px] text-[#09090B]">
          Aegistic
        </span>
        {showSubtitle && (
          <span className="text-[11px] font-medium tracking-normal text-[#4B5563] mt-1">
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
        className="inline-flex items-center focus:outline-none focus:ring-2 focus:ring-[#FF0F5B] rounded"
      >
        {content}
      </button>
    );
  }

  return content;
};
