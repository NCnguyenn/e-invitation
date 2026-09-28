import React from 'react';

interface CyberBadgeProps {
  children: React.ReactNode;
  variant?: 'crimson' | 'gold' | 'cyan' | 'purple';
  icon?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CyberBadge: React.FC<CyberBadgeProps> = ({
  children,
  variant = 'crimson',
  icon,
  className = '',
  size = 'md',
}) => {
  const variantStyles = {
    crimson: 'bg-neon-crimson/10 border-neon-crimson/50 text-red-300 shadow-[0_0_12px_rgba(255,0,60,0.3)]',
    gold: 'bg-neon-gold/10 border-neon-gold/50 text-amber-300 shadow-[0_0_12px_rgba(255,184,0,0.3)]',
    cyan: 'bg-neon-cyan/10 border-neon-cyan/50 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)]',
    purple: 'bg-neon-purple/10 border-neon-purple/50 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]',
  }[variant];

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-0.5 tracking-wider',
    md: 'text-xs md:text-sm px-3.5 py-1 tracking-widest',
    lg: 'text-sm md:text-base px-4 py-1.5 tracking-widest',
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-2 font-tech font-bold uppercase border clip-cyber-badge backdrop-blur-md transition-all duration-300 ${variantStyles} ${sizeStyles} ${className}`}
    >
      {icon && <span className="text-current">{icon}</span>}
      <span>{children}</span>
    </div>
  );
};
