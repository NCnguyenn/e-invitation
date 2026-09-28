import React from 'react';

interface PoeticCornersProps {
  color?: 'crimson' | 'gold' | 'cyan' | 'rose' | 'rosegold';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PoeticCorners: React.FC<PoeticCornersProps> = ({
  color = 'rosegold',
  className = '',
  size = 'md',
}) => {
  const borderColor = {
    crimson: 'border-rose-400/60',
    gold: 'border-rosegold/60',
    cyan: 'border-pink-300/60',
    rose: 'border-rose-300/60',
    rosegold: 'border-rosegold/60',
  }[color];

  const cornerSize = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3.5 h-3.5',
    lg: 'w-5 h-5',
  }[size];

  return (
    <div className={`pointer-events-none absolute inset-0 rounded-3xl ${className}`}>
      {/* Top Left */}
      <span className={`absolute top-2 left-2 ${cornerSize} border-t-2 border-l-2 ${borderColor} rounded-tl-lg`} />
      {/* Top Right */}
      <span className={`absolute top-2 right-2 ${cornerSize} border-t-2 border-r-2 ${borderColor} rounded-tr-lg`} />
      {/* Bottom Left */}
      <span className={`absolute bottom-2 left-2 ${cornerSize} border-b-2 border-l-2 ${borderColor} rounded-bl-lg`} />
      {/* Bottom Right */}
      <span className={`absolute bottom-2 right-2 ${cornerSize} border-b-2 border-r-2 ${borderColor} rounded-br-lg`} />
    </div>
  );
};

// Alias for backwards compatibility
export const CyberCorners = PoeticCorners;
