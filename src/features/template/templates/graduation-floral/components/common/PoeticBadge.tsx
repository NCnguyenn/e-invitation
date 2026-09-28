import React from 'react';

interface PoeticBadgeProps {
  children: React.ReactNode;
  variant?: 'rose' | 'rosegold' | 'cream' | 'petal';
  icon?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PoeticBadge: React.FC<PoeticBadgeProps> = ({
  children,
  variant = 'rose',
  icon,
  className = '',
  size = 'md',
}) => {
  const variantStyles = {
    rose: 'bg-rose-50/90 border-rose-200 text-rose-700 shadow-[0_4px_12px_rgba(251,113,133,0.15)]',
    rosegold: 'bg-rosegold-light/40 border-rosegold text-rosegold-dark shadow-[0_4px_12px_rgba(221,167,165,0.2)]',
    cream: 'bg-poetic-cream/90 border-rosegold/30 text-poetic-text shadow-sm',
    petal: 'bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200 text-pink-700',
  }[variant];

  const sizeStyles = {
    sm: 'text-xs px-3 py-1 tracking-wider',
    md: 'text-xs sm:text-sm px-4 py-1.5 tracking-widest',
    lg: 'text-sm sm:text-base px-5 py-2 tracking-widest',
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-serif uppercase border rounded-full backdrop-blur-md transition-all duration-300 ${variantStyles} ${sizeStyles} ${className}`}
    >
      {icon && <span className="text-current text-xs">{icon}</span>}
      <span>{children}</span>
    </div>
  );
};

// Alias for backwards compatibility
export const CyberBadge = PoeticBadge;
